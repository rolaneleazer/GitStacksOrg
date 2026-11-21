import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  QuotaShieldLoopId,
  QuotaShieldLoopState,
  QuotaShieldStatusResponse,
  QuotaShieldUpdatePayload
} from '../shared/types.ts';
import { getCacheStats, invalidateCache } from './cache.ts';

const IS_VERCEL = Boolean(process.env.VERCEL);
const CONFIG_DIR = IS_VERCEL
  ? path.join(os.tmpdir(), 'gitstack-data')
  : path.resolve(process.cwd(), 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'quota-shield.json');

export const AUDIT_TRIGGER_CLEANUP_SQL = `-- Run once in Supabase SQL Editor to stop noisy log/telemetry tables from duplicating rows into data_audit_logs & Realtime:
DO $$
DECLARE
  t TEXT;
  noisy_tables TEXT[] := ARRAY[
    'analytics_events',
    'gtm_event_logs',
    'product_qa_logs',
    'cloudflare_snapshots',
    'inbox_email_logs',
    'demo_guard_alerts',
    'cyber_security_reports',
    'ai_search_runs'
  ];
BEGIN
  FOREACH t IN ARRAY noisy_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_gitstack_audit ON public.%I;', t);
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I;', t);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END LOOP;
END $$;`;

interface PersistedQuotaConfig {
  lowQuotaMode: boolean;
  cacheTtlMultiplier: number;
  loops: Record<
    QuotaShieldLoopId,
    {
      enabled: boolean;
      intervalSeconds: number;
    }
  >;
}

interface RuntimeLoopMeta {
  label: string;
  description: string;
  defaultIntervalSeconds: number;
  lastRunAt: string | null;
  lastOutcome: 'idle' | 'executed' | 'skipped_idle' | 'paused' | 'serverless_disabled' | 'error';
  runsCount: number;
  skippedCount: number;
}

const DEFAULT_CONFIG: PersistedQuotaConfig = {
  lowQuotaMode: false,
  cacheTtlMultiplier: 1,
  loops: {
    qa_monitor: { enabled: true, intervalSeconds: 900 },
    demo_guard: { enabled: true, intervalSeconds: 900 },
    cyber_security: { enabled: true, intervalSeconds: 3600 },
    ai_visibility: { enabled: true, intervalSeconds: 3600 },
    chat_watcher: { enabled: true, intervalSeconds: 300 },
    cloudflare_snapshot: { enabled: true, intervalSeconds: 3600 }
  }
};

const LOOP_META: Record<QuotaShieldLoopId, RuntimeLoopMeta> = {
  qa_monitor: {
    label: 'Product QA Agent',
    description: 'Analyzes open error logs & triggers EOD QA report (skips 11-table drift query on idle ticks).',
    defaultIntervalSeconds: 900,
    lastRunAt: null,
    lastOutcome: 'idle',
    runsCount: 0,
    skippedCount: 0
  },
  demo_guard: {
    label: 'Demo Guard Sentinel',
    description: 'Verifies /demo file hashes in memory first; skips DB parity queries when files are unchanged.',
    defaultIntervalSeconds: 900,
    lastRunAt: null,
    lastOutcome: 'idle',
    runsCount: 0,
    skippedCount: 0
  },
  cyber_security: {
    label: 'CyberSecurity Daily Check',
    description: 'Evaluates daily UTC report window in memory before reading Supabase settings.',
    defaultIntervalSeconds: 3600,
    lastRunAt: null,
    lastOutcome: 'idle',
    runsCount: 0,
    skippedCount: 0
  },
  ai_visibility: {
    label: 'AI & SEO Visibility Check',
    description: 'Checks daily UTC visibility schedule with in-memory date guard.',
    defaultIntervalSeconds: 3600,
    lastRunAt: null,
    lastOutcome: 'idle',
    runsCount: 0,
    skippedCount: 0
  },
  chat_watcher: {
    label: 'Offline Live Chat Watcher',
    description: 'Checks unanswered visitor chat threads; skips DB lookup when no active chat threads exist.',
    defaultIntervalSeconds: 300,
    lastRunAt: null,
    lastOutcome: 'idle',
    runsCount: 0,
    skippedCount: 0
  },
  cloudflare_snapshot: {
    label: 'Cloudflare Hourly Snapshot',
    description: 'Persists hourly edge telemetry snapshot for forecasting.',
    defaultIntervalSeconds: 3600,
    lastRunAt: null,
    lastOutcome: 'idle',
    runsCount: 0,
    skippedCount: 0
  }
};

let configLoaded = false;
let currentConfig: PersistedQuotaConfig = structuredClone(DEFAULT_CONFIG);
const lastAttemptMs: Record<QuotaShieldLoopId, number> = {
  qa_monitor: 0,
  demo_guard: 0,
  cyber_security: 0,
  ai_visibility: 0,
  chat_watcher: 0,
  cloudflare_snapshot: 0
};

async function loadPersistedConfig(): Promise<PersistedQuotaConfig> {
  if (configLoaded) return currentConfig;
  configLoaded = true;
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedQuotaConfig>;
    currentConfig = {
      lowQuotaMode: Boolean(parsed.lowQuotaMode),
      cacheTtlMultiplier:
        typeof parsed.cacheTtlMultiplier === 'number' && parsed.cacheTtlMultiplier >= 1
          ? Math.min(5, parsed.cacheTtlMultiplier)
          : 1,
      loops: {
        qa_monitor: {
          enabled: parsed.loops?.qa_monitor?.enabled ?? DEFAULT_CONFIG.loops.qa_monitor.enabled,
          intervalSeconds: Math.max(
            300,
            Number(parsed.loops?.qa_monitor?.intervalSeconds) || DEFAULT_CONFIG.loops.qa_monitor.intervalSeconds
          )
        },
        demo_guard: {
          enabled: parsed.loops?.demo_guard?.enabled ?? DEFAULT_CONFIG.loops.demo_guard.enabled,
          intervalSeconds: Math.max(
            300,
            Number(parsed.loops?.demo_guard?.intervalSeconds) || DEFAULT_CONFIG.loops.demo_guard.intervalSeconds
          )
        },
        cyber_security: {
          enabled:
            parsed.loops?.cyber_security?.enabled ?? DEFAULT_CONFIG.loops.cyber_security.enabled,
          intervalSeconds: Math.max(
            300,
            Number(parsed.loops?.cyber_security?.intervalSeconds) ||
              DEFAULT_CONFIG.loops.cyber_security.intervalSeconds
          )
        },
        ai_visibility: {
          enabled:
            parsed.loops?.ai_visibility?.enabled ?? DEFAULT_CONFIG.loops.ai_visibility.enabled,
          intervalSeconds: Math.max(
            300,
            Number(parsed.loops?.ai_visibility?.intervalSeconds) ||
              DEFAULT_CONFIG.loops.ai_visibility.intervalSeconds
          )
        },
        chat_watcher: {
          enabled:
            parsed.loops?.chat_watcher?.enabled ?? DEFAULT_CONFIG.loops.chat_watcher.enabled,
          intervalSeconds: Math.max(
            120,
            Number(parsed.loops?.chat_watcher?.intervalSeconds) ||
              DEFAULT_CONFIG.loops.chat_watcher.intervalSeconds
          )
        },
        cloudflare_snapshot: {
          enabled:
            parsed.loops?.cloudflare_snapshot?.enabled ??
            DEFAULT_CONFIG.loops.cloudflare_snapshot.enabled,
          intervalSeconds: Math.max(
            900,
            Number(parsed.loops?.cloudflare_snapshot?.intervalSeconds) ||
              DEFAULT_CONFIG.loops.cloudflare_snapshot.intervalSeconds
          )
        }
      }
    };
  } catch {
    currentConfig = structuredClone(DEFAULT_CONFIG);
  }
  return currentConfig;
}

async function savePersistedConfig(next: PersistedQuotaConfig): Promise<void> {
  currentConfig = next;
  configLoaded = true;
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
  } catch {
    // Non-fatal in read-only runtimes
  }
}

export function getCacheTtlMultiplier(): number {
  return currentConfig.lowQuotaMode ? Math.max(2.5, currentConfig.cacheTtlMultiplier) : currentConfig.cacheTtlMultiplier;
}

export function isLoopActiveNow(loopId: QuotaShieldLoopId): boolean {
  if (IS_VERCEL) return false;
  const cfg = currentConfig.loops[loopId];
  if (!cfg || !cfg.enabled) return false;
  if (
    currentConfig.lowQuotaMode &&
    (loopId === 'qa_monitor' || loopId === 'demo_guard' || loopId === 'cloudflare_snapshot')
  ) {
    return false;
  }
  return true;
}

/**
 * Gate called inside background setInterval ticks.
 * Ensures loops obey dynamic intervals, pause toggles, Low-Quota Shield mode, and Vercel serverless guards.
 */
export async function shouldRunLoopTick(loopId: QuotaShieldLoopId): Promise<boolean> {
  await loadPersistedConfig();
  if (IS_VERCEL) {
    LOOP_META[loopId].lastOutcome = 'serverless_disabled';
    LOOP_META[loopId].skippedCount += 1;
    return false;
  }
  if (!isLoopActiveNow(loopId)) {
    LOOP_META[loopId].lastOutcome = 'paused';
    LOOP_META[loopId].skippedCount += 1;
    return false;
  }

  const effectiveIntervalSec = currentConfig.lowQuotaMode
    ? Math.max(currentConfig.loops[loopId].intervalSeconds, 1800)
    : currentConfig.loops[loopId].intervalSeconds;

  const now = Date.now();
  if (lastAttemptMs[loopId] > 0 && now - lastAttemptMs[loopId] < effectiveIntervalSec * 1000) {
    return false;
  }

  lastAttemptMs[loopId] = now;
  return true;
}

export function recordLoopOutcome(
  loopId: QuotaShieldLoopId,
  outcome: 'executed' | 'skipped_idle' | 'error'
): void {
  const meta = LOOP_META[loopId];
  meta.lastRunAt = new Date().toISOString();
  meta.lastOutcome = outcome;
  if (outcome === 'executed') {
    meta.runsCount += 1;
  } else if (outcome === 'skipped_idle') {
    meta.skippedCount += 1;
  }
}

export async function getQuotaShieldStatus(): Promise<QuotaShieldStatusResponse> {
  const cfg = await loadPersistedConfig();
  const cacheStats = getCacheStats();
  const loopIds = Object.keys(LOOP_META) as QuotaShieldLoopId[];

  const loops: QuotaShieldLoopState[] = loopIds.map((id) => {
    const meta = LOOP_META[id];
    const loopCfg = cfg.loops[id];
    const active = isLoopActiveNow(id);
    return {
      id,
      label: meta.label,
      description: meta.description,
      enabled: loopCfg.enabled,
      effectiveActive: active,
      intervalSeconds: loopCfg.intervalSeconds,
      defaultIntervalSeconds: meta.defaultIntervalSeconds,
      lastRunAt: meta.lastRunAt,
      lastOutcome: IS_VERCEL ? 'serverless_disabled' : active ? meta.lastOutcome : 'paused',
      runsCount: meta.runsCount,
      skippedCount: meta.skippedCount
    };
  });

  return {
    lowQuotaMode: cfg.lowQuotaMode,
    cacheTtlMultiplier: getCacheTtlMultiplier(),
    serverlessLoopsSuppressed: IS_VERCEL,
    cacheStats,
    loops,
    auditTriggerSql: AUDIT_TRIGGER_CLEANUP_SQL,
    updatedAt: new Date().toISOString()
  };
}

export async function updateQuotaShieldConfig(
  payload: QuotaShieldUpdatePayload
): Promise<QuotaShieldStatusResponse> {
  const cfg = await loadPersistedConfig();
  const next: PersistedQuotaConfig = {
    lowQuotaMode: payload.lowQuotaMode !== undefined ? Boolean(payload.lowQuotaMode) : cfg.lowQuotaMode,
    cacheTtlMultiplier:
      payload.cacheTtlMultiplier !== undefined
        ? Math.max(1, Math.min(5, Number(payload.cacheTtlMultiplier) || 1))
        : cfg.cacheTtlMultiplier,
    loops: { ...cfg.loops }
  };

  if (payload.loops) {
    for (const [rawId, patch] of Object.entries(payload.loops)) {
      const id = rawId as QuotaShieldLoopId;
      if (!next.loops[id] || !patch) continue;
      next.loops[id] = {
        enabled: patch.enabled !== undefined ? Boolean(patch.enabled) : next.loops[id].enabled,
        intervalSeconds:
          patch.intervalSeconds !== undefined
            ? Math.max(120, Math.min(86400, Number(patch.intervalSeconds) || next.loops[id].intervalSeconds))
            : next.loops[id].intervalSeconds
      };
    }
  }

  await savePersistedConfig(next);
  return getQuotaShieldStatus();
}

export async function flushQuotaShieldCache(): Promise<{
  clearedEntries: number;
  status: QuotaShieldStatusResponse;
}> {
  const clearedEntries = invalidateCache();
  const status = await getQuotaShieldStatus();
  return { clearedEntries, status };
}
