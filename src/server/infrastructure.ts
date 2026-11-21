import { performance } from 'node:perf_hooks';
import { Client as PgClient } from 'pg';
import type {
  InfrastructureAlert,
  InfrastructureMetricsResponse,
  InfrastructureSamplePoint,
  InfrastructureTableMetric
} from '../shared/types.ts';
import {
  getSupabaseClient,
  getSupabaseProjectRef,
  isSupabaseConfigured,
  normalizePostgresUrl,
  resetSupabaseClientPools
} from './repository.ts';
import { getCachedOrFetch, invalidateCache } from './cache.ts';
import { getCacheTtlMultiplier } from './quotaShield.ts';

const VERCEL_HOBBY_RAM_LIMIT_MB = 2048;
const VERCEL_HOBBY_MAX_DURATION_SEC = 300;
const VERCEL_HOBBY_BANDWIDTH_GB = 100;
const SUPABASE_FREE_STORAGE_LIMIT_MB = 500;
const MAX_HISTORY_POINTS = 30;

let lastCpuUsage = process.cpuUsage();
let lastCpuWallMs = performance.now();
let hasSampledOnce = false;
const sampleHistory: InfrastructureSamplePoint[] = [];

const TRACKED_TABLES = [
  'posts',
  'comments',
  'subscribers',
  'inquiries',
  'site_settings',
  'page_contents',
  'agent_tasks',
  'chat_threads',
  'chat_messages',
  'analytics_events',
  'user_profiles',
  'user_workflow_items',
  'routing_rules'
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function measureEventLoopLagMs(): Promise<number> {
  return new Promise((resolve) => {
    const start = performance.now();
    setTimeout(() => {
      const elapsed = performance.now() - start;
      resolve(round2(Math.max(0, elapsed)));
    }, 0);
  });
}

function computeCpuPercent(): number {
  const nowWall = performance.now();
  const elapsedMs = Math.max(10, nowWall - lastCpuWallMs);
  const delta = process.cpuUsage(lastCpuUsage);
  lastCpuUsage = process.cpuUsage();
  lastCpuWallMs = nowWall;
  const totalCpuMs = (delta.user + delta.system) / 1000;
  // Vercel Hobby runs 1 vCPU; cap percentage cleanly at 100%
  return round2(Math.min(100, Math.max(0.1, (totalCpuMs / elapsedMs) * 100)));
}

interface PostgresTelemetryResult {
  connected: boolean;
  databaseSizeMb: number;
  activeConnections: number;
  maxConnections: number;
  cacheHitRatioPercent: number;
  tables: InfrastructureTableMetric[];
}

async function queryPostgresTelemetry(): Promise<PostgresTelemetryResult | null> {
  const rawDbUrl = process.env.SUPABASE_DB_URL?.trim();
  if (!rawDbUrl) return null;

  const { url: dbUrl } = normalizePostgresUrl(rawDbUrl);
  const pg = new PgClient({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 3500,
    query_timeout: 4000,
    statement_timeout: 4000
  });

  try {
    await pg.connect();

    const [dbRes, tablesRes, connRes, maxConnRes, cacheRes] = await Promise.all([
      pg.query<{ bytes: string }>('SELECT pg_database_size(current_database())::bigint AS bytes'),
      pg.query<{
        table_name: string;
        total_bytes: string;
        data_bytes: string;
        index_bytes: string;
        row_estimate: string;
      }>(`
        SELECT
          c.relname AS table_name,
          pg_total_relation_size(c.oid)::bigint AS total_bytes,
          pg_relation_size(c.oid)::bigint AS data_bytes,
          pg_indexes_size(c.oid)::bigint AS index_bytes,
          COALESCE(s.n_live_tup, 0)::bigint AS row_estimate
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY total_bytes DESC
        LIMIT 25
      `),
      pg.query<{ active: string }>(
        "SELECT count(*)::bigint AS active FROM pg_stat_activity WHERE datname = current_database()"
      ),
      pg.query<{ max_connections: string }>('SHOW max_connections'),
      pg.query<{ hit_ratio: string | null }>(`
        SELECT
          CASE
            WHEN (blks_hit + blks_read) = 0 THEN 100.0
            ELSE ROUND((blks_hit::numeric / (blks_hit + blks_read)) * 100, 2)
          END AS hit_ratio
        FROM pg_stat_database
        WHERE datname = current_database()
      `)
    ]);

    const bytesToMb = (val: string | number) => round2(Number(val || 0) / (1024 * 1024));
    const tables: InfrastructureTableMetric[] = tablesRes.rows.map((r) => ({
      tableName: r.table_name,
      totalMb: bytesToMb(r.total_bytes),
      dataMb: bytesToMb(r.data_bytes),
      indexMb: bytesToMb(r.index_bytes),
      rowEstimate: Number(r.row_estimate || 0)
    }));

    return {
      connected: true,
      databaseSizeMb: bytesToMb(dbRes.rows[0]?.bytes || 0),
      activeConnections: Number(connRes.rows[0]?.active || 0),
      maxConnections: Number(maxConnRes.rows[0]?.max_connections || 60),
      cacheHitRatioPercent: Number(cacheRes.rows[0]?.hit_ratio ?? 100),
      tables
    };
  } catch {
    return null;
  } finally {
    await pg.end().catch(() => {});
  }
}

async function querySupabaseRestEstimate(): Promise<{
  databaseSizeMb: number;
  tables: InfrastructureTableMetric[];
}> {
  if (!isSupabaseConfigured()) {
    return { databaseSizeMb: 0, tables: [] };
  }
  const sb = getSupabaseClient();
  const counts = await Promise.all(
    TRACKED_TABLES.map(async (tableName) => {
      try {
        const { count } = await sb.from(tableName).select('id', { count: 'exact', head: true });
        const rows = count || 0;
        // Conservative ~2.5 KB/row estimate when direct Postgres stats aren't enabled
        const dataMb = round2((rows * 2560) / (1024 * 1024));
        const indexMb = round2(dataMb * 0.25);
        return {
          tableName,
          totalMb: round2(dataMb + indexMb),
          dataMb,
          indexMb,
          rowEstimate: rows
        };
      } catch {
        return { tableName, totalMb: 0, dataMb: 0, indexMb: 0, rowEstimate: 0 };
      }
    })
  );

  counts.sort((a, b) => b.totalMb - a.totalMb);
  const sumMb = round2(counts.reduce((acc, t) => acc + t.totalMb, 0) + 18.5);
  return { databaseSizeMb: sumMb, tables: counts };
}

interface VercelApiTelemetry {
  apiConfigured: boolean;
  projectName: string | null;
  framework: string | null;
  latestDeploymentState: string | null;
  latestDeploymentUrl: string | null;
  latestDeploymentCreatedAt: string | null;
}

async function queryVercelApiTelemetry(): Promise<VercelApiTelemetry> {
  const token = process.env.VERCEL_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (!token) {
    return {
      apiConfigured: false,
      projectName: process.env.VERCEL_PROJECT_NAME || null,
      framework: 'vite',
      latestDeploymentState: process.env.VERCEL ? 'READY' : null,
      latestDeploymentUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
      latestDeploymentCreatedAt: null
    };
  }

  try {
    const teamQs = teamId ? `teamId=${encodeURIComponent(teamId)}` : '';
    const projectEndpoint = projectId
      ? `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}${teamQs ? `?${teamQs}` : ''}`
      : `https://api.vercel.com/v9/projects?limit=1${teamQs ? `&${teamQs}` : ''}`;

    const projRes = await fetch(projectEndpoint, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000)
    });
    if (!projRes.ok) {
      return {
        apiConfigured: true,
        projectName: null,
        framework: null,
        latestDeploymentState: `API ${projRes.status}`,
        latestDeploymentUrl: null,
        latestDeploymentCreatedAt: null
      };
    }

    const projJson = (await projRes.json()) as {
      id?: string;
      name?: string;
      framework?: string;
      projects?: { id: string; name: string; framework?: string }[];
    };
    const project = projJson.projects ? projJson.projects[0] : projJson;
    const resolvedId = project?.id || projectId;

    let depState: string | null = null;
    let depUrl: string | null = null;
    let depCreatedAt: string | null = null;

    if (resolvedId) {
      const depQs = new URLSearchParams({ projectId: resolvedId, limit: '1' });
      if (teamId) depQs.set('teamId', teamId);
      const depRes = await fetch(`https://api.vercel.com/v6/deployments?${depQs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000)
      });
      if (depRes.ok) {
        const depJson = (await depRes.json()) as {
          deployments?: { state?: string; readyState?: string; url?: string; createdAt?: number }[];
        };
        const latest = depJson.deployments?.[0];
        if (latest) {
          depState = latest.readyState || latest.state || null;
          depUrl = latest.url ? `https://${latest.url}` : null;
          depCreatedAt = latest.createdAt ? new Date(latest.createdAt).toISOString() : null;
        }
      }
    }

    return {
      apiConfigured: true,
      projectName: project?.name || null,
      framework: project?.framework || 'vite',
      latestDeploymentState: depState,
      latestDeploymentUrl: depUrl,
      latestDeploymentCreatedAt: depCreatedAt
    };
  } catch {
    return {
      apiConfigured: true,
      projectName: null,
      framework: null,
      latestDeploymentState: 'TIMEOUT',
      latestDeploymentUrl: null,
      latestDeploymentCreatedAt: null
    };
  }
}

interface SupabaseManagementTelemetry {
  apiConfigured: boolean;
  projectName: string | null;
  projectRegion: string | null;
  projectStatus: string | null;
}

async function querySupabaseManagementApi(
  projectRef?: string
): Promise<SupabaseManagementTelemetry> {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token || !projectRef) {
    return {
      apiConfigured: false,
      projectName: null,
      projectRegion: null,
      projectStatus: null
    };
  }
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000)
    });
    if (!res.ok) {
      return {
        apiConfigured: true,
        projectName: null,
        projectRegion: null,
        projectStatus: `API ${res.status}`
      };
    }
    const json = (await res.json()) as { name?: string; region?: string; status?: string };
    return {
      apiConfigured: true,
      projectName: json.name || null,
      projectRegion: json.region || null,
      projectStatus: json.status || null
    };
  } catch {
    return {
      apiConfigured: true,
      projectName: null,
      projectRegion: null,
      projectStatus: 'TIMEOUT'
    };
  }
}

export async function collectInfrastructureMetrics(): Promise<InfrastructureMetricsResponse> {
  const ttlMs = Math.round(45_000 * getCacheTtlMultiplier());
  return getCachedOrFetch(
    'infra:metrics',
    ttlMs,
    async () => {
      const reqStart = performance.now();
      const coldStart = !hasSampledOnce;
      hasSampledOnce = true;

      const projectRef = getSupabaseProjectRef() || null;

  const [eventLoopLagMs, pgTelemetry, vercelApi, sbMgmt] = await Promise.all([
    measureEventLoopLagMs(),
    queryPostgresTelemetry(),
    queryVercelApiTelemetry(),
    querySupabaseManagementApi(projectRef || undefined)
  ]);

  let tables = pgTelemetry?.tables || [];
  let databaseSizeMb = pgTelemetry?.databaseSizeMb || 0;
  let supabaseSourceMode: InfrastructureMetricsResponse['supabase']['sourceMode'] = pgTelemetry
    ? sbMgmt.apiConfigured
      ? 'postgres+api'
      : 'postgres'
    : 'supabase-rest-estimate';

  if (!pgTelemetry) {
    const restFallback = await querySupabaseRestEstimate();
    tables = restFallback.tables;
    databaseSizeMb = restFallback.databaseSizeMb;
  }

  const mem = process.memoryUsage();
  const toMb = (b: number) => round2(b / (1024 * 1024));
  const rssMb = toMb(mem.rss);
  const heapUsedMb = toMb(mem.heapUsed);
  const heapTotalMb = toMb(mem.heapTotal);
  const externalMb = toMb(mem.external);
  const ramUsedPercent = round2(Math.min(100, (rssMb / VERCEL_HOBBY_RAM_LIMIT_MB) * 100));
  const cpuPercent = computeCpuPercent();

  const storageUsedPercent = round2(
    Math.min(100, (databaseSizeMb / SUPABASE_FREE_STORAGE_LIMIT_MB) * 100)
  );
  const totalRowsEstimate = tables.reduce((sum, t) => sum + t.rowEstimate, 0);
  const activeConnections = pgTelemetry?.activeConnections ?? 1;
  const maxConnections = pgTelemetry?.maxConnections ?? 60;
  const cacheHitRatioPercent = pgTelemetry?.cacheHitRatioPercent ?? 100;
  const apiLatencyMs = round2(performance.now() - reqStart);
  const sampledAt = new Date().toISOString();

  sampleHistory.push({
    timestamp: sampledAt,
    cpuPercent,
    eventLoopLagMs,
    rssMb,
    heapUsedMb,
    dbSizeMb: databaseSizeMb,
    apiLatencyMs
  });
  if (sampleHistory.length > MAX_HISTORY_POINTS) {
    sampleHistory.splice(0, sampleHistory.length - MAX_HISTORY_POINTS);
  }

  const alerts: InfrastructureAlert[] = [];

  if (storageUsedPercent >= 90) {
    alerts.push({
      id: 'sb-storage-critical',
      provider: 'supabase',
      severity: 'critical',
      title: 'Supabase Free Storage Near 500 MB Cap',
      detail: `Database size is ${databaseSizeMb} MB (${storageUsedPercent}%). Prune old analytics_events or upgrade tier.`
    });
  } else if (storageUsedPercent >= 75) {
    alerts.push({
      id: 'sb-storage-warn',
      provider: 'supabase',
      severity: 'warning',
      title: 'Supabase Storage Above 75% Threshold',
      detail: `Database size is ${databaseSizeMb} MB of the 500 MB Free plan limit.`
    });
  } else {
    alerts.push({
      id: 'sb-storage-ok',
      provider: 'supabase',
      severity: 'nominal',
      title: 'Supabase Storage Healthy',
      detail: `${databaseSizeMb} MB used of 500 MB Free limit (${storageUsedPercent}%).`
    });
  }

  if (ramUsedPercent >= 85) {
    alerts.push({
      id: 'vercel-ram-critical',
      provider: 'vercel',
      severity: 'critical',
      title: 'Serverless Function RAM High',
      detail: `Process RSS is ${rssMb} MB (${ramUsedPercent}% of 2048 MB Hobby ceiling).`
    });
  } else if (ramUsedPercent >= 65) {
    alerts.push({
      id: 'vercel-ram-warn',
      provider: 'vercel',
      severity: 'warning',
      title: 'Elevated Function Memory Usage',
      detail: `Process RSS is ${rssMb} MB of 2048 MB Hobby limit.`
    });
  } else {
    alerts.push({
      id: 'vercel-ram-ok',
      provider: 'vercel',
      severity: 'nominal',
      title: 'Vercel Compute Memory Nominal',
      detail: `${rssMb} MB RSS (${heapUsedMb} MB V8 Heap) within 2048 MB Hobby allowance.`
    });
  }

  if (cpuPercent >= 85) {
    alerts.push({
      id: 'vercel-cpu-warn',
      provider: 'vercel',
      severity: 'warning',
      title: 'High vCPU Utilization',
      detail: `Node process CPU delta reached ${cpuPercent}% on 1 vCPU share.`
    });
  }

  if (pgTelemetry && cacheHitRatioPercent < 95) {
    alerts.push({
      id: 'sb-cache-warn',
      provider: 'supabase',
      severity: 'warning',
      title: 'Postgres Buffer Cache Hit Below 95%',
      detail: `Cache hit ratio is ${cacheHitRatioPercent}%. Frequent queries are reading from disk.`
    });
  }

  const isVercelEnv = Boolean(process.env.VERCEL);

  return {
    sampledAt,
    environment: isVercelEnv ? 'vercel' : 'local',
    region: process.env.VERCEL_REGION || (isVercelEnv ? 'iad1' : 'local-node'),
    nodeVersion: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    coldStart,
    vercel: {
      cpuPercent,
      eventLoopLagMs,
      rssMb,
      heapUsedMb,
      heapTotalMb,
      externalMb,
      ramLimitMb: VERCEL_HOBBY_RAM_LIMIT_MB,
      ramUsedPercent,
      functionMaxDurationSec: VERCEL_HOBBY_MAX_DURATION_SEC,
      bandwidthLimitGb: VERCEL_HOBBY_BANDWIDTH_GB,
      sourceMode: vercelApi.apiConfigured ? 'runtime+api' : 'runtime-only',
      apiConfigured: vercelApi.apiConfigured,
      projectName: vercelApi.projectName,
      framework: vercelApi.framework,
      latestDeploymentState: vercelApi.latestDeploymentState,
      latestDeploymentUrl: vercelApi.latestDeploymentUrl,
      latestDeploymentCreatedAt: vercelApi.latestDeploymentCreatedAt
    },
    supabase: {
      databaseSizeMb,
      storageLimitMb: SUPABASE_FREE_STORAGE_LIMIT_MB,
      storageUsedPercent,
      activeConnections,
      maxConnections,
      cacheHitRatioPercent,
      totalRowsEstimate,
      tables,
      sourceMode: supabaseSourceMode,
      postgresDirectConnected: Boolean(pgTelemetry),
      apiConfigured: sbMgmt.apiConfigured,
      projectRef,
      projectName: sbMgmt.projectName,
      projectRegion: sbMgmt.projectRegion,
      projectStatus: sbMgmt.projectStatus
    },
        history: [...sampleHistory],
        alerts
      };
    },
    14
  );
}

export async function restartInfrastructureServices(): Promise<{
  success: boolean;
  message: string;
  connectionsTerminated: number;
  poolsReset: boolean;
  cacheCleared: boolean;
  sampledAt: string;
}> {
  // 1. Reset client connection pool singletons and server caches
  resetSupabaseClientPools();
  invalidateCache();

  // 2. Terminate idle & hanging PostgreSQL connections if direct DB URL configured
  let connectionsTerminated = 0;
  const rawDbUrl = process.env.SUPABASE_DB_URL?.trim();
  if (rawDbUrl) {
    try {
      const { url: dbUrl } = normalizePostgresUrl(rawDbUrl);
      const pg = new PgClient({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 4000,
        query_timeout: 4000,
        statement_timeout: 4000
      });
      await pg.connect();
      // Terminate idle connections holding pool slots
      const killRes = await pg.query<{ count: string }>(`
        WITH killed AS (
          SELECT pg_terminate_backend(pid) AS terminated
          FROM pg_stat_activity
          WHERE pid <> pg_backend_pid()
            AND datname = current_database()
            AND (
              state IN ('idle', 'idle in transaction', 'idle in transaction (aborted)')
              OR (query_start IS NOT NULL AND clock_timestamp() - query_start > interval '30 seconds')
            )
        )
        SELECT COUNT(*)::text as count FROM killed WHERE terminated = true;
      `);
      connectionsTerminated = parseInt(killRes.rows[0]?.count || '0', 10);
      await pg.end();
    } catch (err) {
      console.warn('[restartInfrastructureServices] Postgres termination note:', err);
    }
  }

  // 3. Clear memory if global.gc is exposed
  if (typeof globalThis.gc === 'function') {
    try {
      globalThis.gc();
    } catch {
      // ignore
    }
  }

  return {
    success: true,
    message: `Infrastructure connection pools reset. ${connectionsTerminated} idle database backend(s) terminated and cache cleared.`,
    connectionsTerminated,
    poolsReset: true,
    cacheCleared: true,
    sampledAt: new Date().toISOString()
  };
}

