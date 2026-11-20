import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  GoogleTrendMonitorItem,
  GrowthModuleEmailConfig,
  GrowthModuleEmailLog,
  GrowthModuleKey,
  MarketingPublishProof,
  MarketingScheduleItem,
  SearchConsoleAuditRun,
  TrendApprovalBundle
} from '../shared/types.ts';

interface GrowthSuiteStore {
  searchConsoleRuns: SearchConsoleAuditRun[];
  marketingSchedule: MarketingScheduleItem[];
  marketingProofs: MarketingPublishProof[];
  marketingLastGeneratedAt: string | null;
  trendsRegion: string;
  trendsLastScannedAt: string | null;
  trendsFeedSourceMode: 'google_trends_rss' | 'google_search_grounding' | 'gitstack_trend_radar';
  trendsNotice?: string;
  monitoredTrends: GoogleTrendMonitorItem[];
  trendApprovalQueue: TrendApprovalBundle[];
  emailConfigs: Record<GrowthModuleKey, GrowthModuleEmailConfig>;
  emailLogs: GrowthModuleEmailLog[];
}

const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL
  ? path.join(os.tmpdir(), 'gitstack-data')
  : path.resolve(process.cwd(), 'data');
const GROWTH_FILE = path.join(DATA_DIR, 'gitstack-growth-store.json');

const DEFAULT_RECIPIENT = (
  process.env.STUDIO_ADMIN_EMAIL || 'gitstackitsolution@gmail.com'
).trim().toLowerCase();

function createDefaultEmailConfig(module: GrowthModuleKey): GrowthModuleEmailConfig {
  return {
    module,
    enabled: true,
    recipient_email: DEFAULT_RECIPIENT,
    frequency: 'daily',
    send_hour_utc: module === 'search_console' ? 1 : module === 'marketing' ? 2 : 3,
    last_sent_at: null,
    updated_at: new Date().toISOString()
  };
}

function createDefaultStore(): GrowthSuiteStore {
  return {
    searchConsoleRuns: [],
    marketingSchedule: [],
    marketingProofs: [],
    marketingLastGeneratedAt: null,
    trendsRegion: 'PH',
    trendsLastScannedAt: null,
    trendsFeedSourceMode: 'google_trends_rss',
    monitoredTrends: [],
    trendApprovalQueue: [],
    emailConfigs: {
      search_console: createDefaultEmailConfig('search_console'),
      marketing: createDefaultEmailConfig('marketing'),
      google_trends: createDefaultEmailConfig('google_trends')
    },
    emailLogs: []
  };
}

let memoryStore: GrowthSuiteStore | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function normalizeStore(raw: Partial<GrowthSuiteStore> | null | undefined): GrowthSuiteStore {
  const base = createDefaultStore();
  if (!raw || typeof raw !== 'object') return base;
  return {
    searchConsoleRuns: Array.isArray(raw.searchConsoleRuns) ? raw.searchConsoleRuns.slice(0, 15) : [],
    marketingSchedule: Array.isArray(raw.marketingSchedule) ? raw.marketingSchedule : [],
    marketingProofs: Array.isArray(raw.marketingProofs) ? raw.marketingProofs.slice(0, 80) : [],
    marketingLastGeneratedAt: raw.marketingLastGeneratedAt || null,
    trendsRegion: raw.trendsRegion || 'PH',
    trendsLastScannedAt: raw.trendsLastScannedAt || null,
    trendsFeedSourceMode: raw.trendsFeedSourceMode || 'google_trends_rss',
    trendsNotice: raw.trendsNotice,
    monitoredTrends: Array.isArray(raw.monitoredTrends) ? raw.monitoredTrends : [],
    trendApprovalQueue: Array.isArray(raw.trendApprovalQueue) ? raw.trendApprovalQueue.slice(0, 60) : [],
    emailConfigs: {
      search_console: {
        ...base.emailConfigs.search_console,
        ...(raw.emailConfigs?.search_console || {}),
        module: 'search_console'
      },
      marketing: {
        ...base.emailConfigs.marketing,
        ...(raw.emailConfigs?.marketing || {}),
        module: 'marketing'
      },
      google_trends: {
        ...base.emailConfigs.google_trends,
        ...(raw.emailConfigs?.google_trends || {}),
        module: 'google_trends'
      }
    },
    emailLogs: Array.isArray(raw.emailLogs) ? raw.emailLogs.slice(0, 120) : []
  };
}

export async function readGrowthStore(): Promise<GrowthSuiteStore> {
  if (memoryStore) return memoryStore;
  try {
    const text = await fs.readFile(GROWTH_FILE, 'utf8');
    memoryStore = normalizeStore(JSON.parse(text) as Partial<GrowthSuiteStore>);
  } catch {
    memoryStore = createDefaultStore();
  }
  return memoryStore;
}

export async function updateGrowthStore(
  mutator: (store: GrowthSuiteStore) => void
): Promise<GrowthSuiteStore> {
  const store = await readGrowthStore();
  mutator(store);
  memoryStore = normalizeStore(store);

  const snapshot = JSON.stringify(memoryStore, null, 2);
  writeQueue = writeQueue
    .then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(GROWTH_FILE, snapshot, 'utf8');
    })
    .catch(() => {
      // keep in-memory store if filesystem is read-only
    });
  await writeQueue;
  return memoryStore;
}

export async function getGrowthModuleEmailConfig(
  module: GrowthModuleKey
): Promise<GrowthModuleEmailConfig> {
  const store = await readGrowthStore();
  return store.emailConfigs[module];
}

export async function saveGrowthModuleEmailConfig(
  module: GrowthModuleKey,
  patch: Partial<GrowthModuleEmailConfig>
): Promise<GrowthModuleEmailConfig> {
  const store = await updateGrowthStore((s) => {
    s.emailConfigs[module] = {
      ...s.emailConfigs[module],
      ...patch,
      module,
      updated_at: new Date().toISOString()
    };
  });
  return store.emailConfigs[module];
}

export async function appendGrowthModuleEmailLog(
  entry: GrowthModuleEmailLog
): Promise<GrowthModuleEmailLog> {
  await updateGrowthStore((s) => {
    s.emailLogs = [entry, ...s.emailLogs].slice(0, 120);
    if (entry.status === 'sent') {
      s.emailConfigs[entry.module].last_sent_at = entry.sent_at;
    }
  });
  return entry;
}

export async function listGrowthModuleEmailLogs(
  module: GrowthModuleKey
): Promise<GrowthModuleEmailLog[]> {
  const store = await readGrowthStore();
  return store.emailLogs.filter((l) => l.module === module).slice(0, 25);
}

export interface AgentGrowthSnapshot {
  totalAuditedLinks: number;
  searchableLinks: number;
  avgSeoScore: number;
  lastSearchScanAt: string | null;
  marketingScheduledCount: number;
  marketingPublishedCount: number;
  facebookConnected: boolean;
  tiktokConnected: boolean;
  monitoredTrendsCount: number;
  pendingTrendApprovals: number;
}

export async function getAgentGrowthSnapshot(
  facebookConnected: boolean,
  tiktokConnected: boolean
): Promise<AgentGrowthSnapshot> {
  const store = await readGrowthStore();
  const latestRun = store.searchConsoleRuns[0] || null;
  return {
    totalAuditedLinks: latestRun?.totalLinks || 0,
    searchableLinks: latestRun?.searchableLinks || 0,
    avgSeoScore: latestRun?.avgSeoScore || 0,
    lastSearchScanAt: latestRun?.scannedAt || null,
    marketingScheduledCount: store.marketingSchedule.length,
    marketingPublishedCount: store.marketingProofs.filter((p) => p.status === 'published').length,
    facebookConnected,
    tiktokConnected,
    monitoredTrendsCount: store.monitoredTrends.length,
    pendingTrendApprovals: store.trendApprovalQueue.filter(
      (b) => b.status === 'pending_approval'
    ).length
  };
}
