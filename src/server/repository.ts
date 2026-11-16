import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client as PgClient } from 'pg';
import {
  DEFAULT_AGENT_OFFICE_PROFILES,
  DEFAULT_AGENT_REPORT_SETTINGS,
  SEED_AGENT_CONVERSATIONS
} from '../shared/agentOfficeDefaults.ts';
import { DEFAULT_PAGE_CONTENTS } from '../shared/pageDefaults.ts';
import {
  DEFAULT_ADSENSE_SETTINGS,
  SEED_AGENT_TASKS,
  SEED_ANALYTICS_EVENTS,
  SEED_ARTICLES,
  SEED_CHAT_MESSAGES,
  SEED_CHAT_THREADS,
  SEED_COMMENTS,
  SEED_INQUIRIES,
  SEED_ROUTING_RULES,
  SEED_SUBSCRIBERS,
  SEED_USER_PROFILES,
  SEED_USER_WORKFLOWS
} from '../shared/seedData.ts';
import type {
  AdSenseSettings,
  AgentConversationEntry,
  AgentEmailReport,
  AgentId,
  AgentOfficeProfile,
  AgentReportSettings,
  AgentTask,
  AgentWorkStatus,
  AnalyticsEvent,
  AnalyticsSummary,
  Article,
  ArticleComment,
  ChatMessage,
  ChatThread,
  ChatThreadStatus,
  ClientInquiry,
  CloudflareAiForecast,
  CloudflareHourlySnapshot,
  CommentStatus,
  CrmLead,
  CrmOAuthTokenRecord,
  CrmOutreachLog,
  CrmSourcesAnalyticsResponse,
  CrmSyncRun,
  DemoUser,
  DemoUsersSummaryStats,
  DirectoryUser,
  InboxEmailLog,
  InquiryStatus,
  IntegrationProviderId,
  IntegrationSecretRecord,
  LeadSourceType,
  NewsletterSubscriber,
  PageContentConfig,
  PageKey,
  PublicDemoUser,
  RoutingRule,
  SourceBreakdownMetric,
  UserProfile,
  UserRole,
  UserStatus,
  UserWorkflowItem,
  WebsiteChatMessage,
  WebsiteChatSession
} from '../shared/types.ts';

interface LocalDatabase {
  posts: Article[];
  comments: ArticleComment[];
  subscribers: NewsletterSubscriber[];
  inquiries: ClientInquiry[];
  site_settings: AdSenseSettings;
  page_contents?: Record<PageKey, PageContentConfig>;
  agent_tasks?: AgentTask[];
  chat_threads?: ChatThread[];
  chat_messages?: ChatMessage[];
  analytics_events?: AnalyticsEvent[];
  user_profiles?: UserProfile[];
  user_workflow_items?: UserWorkflowItem[];
  routing_rules?: RoutingRule[];
  agent_office_profiles?: AgentOfficeProfile[];
  agent_conversations?: AgentConversationEntry[];
  agent_report_settings?: AgentReportSettings;
  agent_email_reports?: AgentEmailReport[];
  crm_leads?: CrmLead[];
  crm_outreach_logs?: CrmOutreachLog[];
  crm_oauth_tokens?: CrmOAuthTokenRecord[];
  crm_sync_runs?: CrmSyncRun[];
  crm_integration_secrets?: IntegrationSecretRecord[];
  demo_users?: DemoUser[];
  inbox_email_logs?: InboxEmailLog[];
  cloudflare_hourly_snapshots?: CloudflareHourlySnapshot[];
  cloudflare_ai_forecasts?: CloudflareAiForecast[];
  website_chat_sessions?: WebsiteChatSession[];
  website_chat_messages?: WebsiteChatMessage[];
}

const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL
  ? path.join(os.tmpdir(), 'gitstack-data')
  : path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'gitstack-store.json');

const LOCAL_TOKEN_SECRET =
  process.env.STUDIO_SESSION_SECRET ||
  crypto.createHash('sha256').update(process.cwd() + '_gitstack_studio_v1').digest('hex');

const PRIMARY_ADMIN_EMAIL = (process.env.STUDIO_ADMIN_EMAIL || 'gitstackitsolution@gmail.com').trim().toLowerCase();
const FALLBACK_ADMIN_EMAIL = (process.env.STUDIO_ADMIN_EMAIL || 'gitstackitsolution@gmail.com').trim().toLowerCase();
const FALLBACK_ADMIN_PASSWORD = process.env.STUDIO_ADMIN_PASSWORD || 'gitstack-studio-2026';

export function getSupabaseUrl(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL
  )?.trim() || undefined;
}

function getSupabasePublicKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY
  )?.trim() || undefined;
}

function getSupabaseServiceKey(): string | undefined {
  const activeUrl = getSupabaseUrl();
  const baseUrl = process.env.SUPABASE_URL?.trim();
  if (!baseUrl || !activeUrl || baseUrl !== activeUrl) {
    return undefined;
  }
  return (
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    undefined
  );
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && (getSupabasePublicKey() || getSupabaseServiceKey()));
}

export function getSupabaseClient(userToken?: string): SupabaseClient {
  const url = getSupabaseUrl()!;
  const serviceKey = getSupabaseServiceKey();
  const publicKey = getSupabasePublicKey();

  if (userToken && !serviceKey && publicKey) {
    return createClient(url, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${userToken}`
        }
      }
    });
  }

  return createClient(url, serviceKey || publicKey!, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function isFallbackableDbError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    error.code === '42501' ||
    msg.includes('could not find the table') ||
    msg.includes('could not find the') ||
    msg.includes('does not exist') ||
    msg.includes('permission denied')
  );
}

export type SupabaseAutomationMode = 'db-url' | 'management-api' | 'manual';

export function getSupabaseAutomationMode(): SupabaseAutomationMode {
  if (process.env.SUPABASE_DB_URL?.trim()) return 'db-url';
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim() && getSupabaseProjectRef()) return 'management-api';
  return 'manual';
}

export function getSupabaseProjectRef(): string | undefined {
  const url = getSupabaseUrl();
  if (!url) return undefined;
  const match = url.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match?.[1];
}

export async function checkSupabaseTablesReady(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const client = getSupabaseClient();
    const [
      postsRes,
      pagesRes,
      profilesRes,
      wfRes,
      rulesRes,
      officeRes,
      reportsRes,
      crmRes,
      demoRes,
      inboxRes
    ] = await Promise.all([
      client.from('posts').select('id').limit(1),
      client.from('page_contents').select('page_key').limit(1),
      client.from('user_profiles').select('user_id').limit(1),
      client.from('user_workflow_items').select('id').limit(1),
      client.from('routing_rules').select('id').limit(1),
      client.from('agent_office_profiles').select('agent_id').limit(1),
      client.from('agent_email_reports').select('id').limit(1),
      client.from('crm_leads').select('id').limit(1),
      client.from('demo_users').select('id').limit(1),
      client.from('inbox_email_logs').select('id').limit(1)
    ]);
    return (
      !postsRes.error &&
      !pagesRes.error &&
      !profilesRes.error &&
      !wfRes.error &&
      !rulesRes.error &&
      !officeRes.error &&
      !reportsRes.error &&
      !crmRes.error &&
      !demoRes.error &&
      !inboxRes.error
    );
  } catch {
    return false;
  }
}

export function normalizePostgresUrl(raw: string): { url: string; host: string } {
  const trimmed = raw.trim();
  const schemeIdx = trimmed.indexOf('://');
  const lastAt = trimmed.lastIndexOf('@');
  if (schemeIdx === -1 || lastAt === -1) {
    return { url: trimmed, host: '' };
  }
  const prefix = trimmed.slice(0, schemeIdx + 3);
  const authPart = trimmed.slice(schemeIdx + 3, lastAt);
  const hostAndRest = trimmed.slice(lastAt + 1);
  const colonIdx = authPart.indexOf(':');
  const encodedAuth =
    colonIdx === -1
      ? authPart
      : `${authPart.slice(0, colonIdx)}:${encodeURIComponent(decodeURIComponentSafe(authPart.slice(colonIdx + 1)))}`;
  const hostMatch = hostAndRest.match(/^([^:/?]+)/);
  return { url: `${prefix}${encodedAuth}@${hostAndRest}`, host: hostMatch?.[1] || '' };
}

function decodeURIComponentSafe(val: string): string {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

export async function autoMigrateSupabaseSchema(): Promise<{
  executed: boolean;
  mode: SupabaseAutomationMode;
  message: string;
}> {
  const mode = getSupabaseAutomationMode();
  if (!isSupabaseConfigured()) {
    return {
      executed: false,
      mode,
      message: 'Supabase URL and Publishable Key are not configured yet.'
    };
  }

  const schemaPath = path.resolve(process.cwd(), 'supabase', 'schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');

  if (mode === 'db-url') {
    const { url: dbUrl, host } = normalizePostgresUrl(process.env.SUPABASE_DB_URL!);
    const apiProjectRef = getSupabaseProjectRef();
    const dbRefMatch = host.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i);
    if (apiProjectRef && dbRefMatch && dbRefMatch[1].toLowerCase() !== apiProjectRef.toLowerCase()) {
      return {
        executed: false,
        mode,
        message: `Project mismatch: NEXT_PUBLIC_SUPABASE_URL targets "${apiProjectRef}", while SUPABASE_DB_URL targets "${dbRefMatch[1]}". Align both to the same Supabase project before running migrations.`
      };
    }

    const pg = new PgClient({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 4500,
      query_timeout: 8000
    });
    try {
      await pg.connect();
      await pg.query(sql);
      return {
        executed: true,
        mode,
        message: 'Supabase PostgreSQL schema and policies migrated automatically via SUPABASE_DB_URL.'
      };
    } finally {
      await pg.end().catch(() => {});
    }
  }

  if (mode === 'management-api') {
    const token = process.env.SUPABASE_ACCESS_TOKEN!.trim();
    const projectRef = getSupabaseProjectRef()!;
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Supabase Management API migration failed (${res.status}): ${text}`);
    }
    return {
      executed: true,
      mode,
      message: 'Supabase PostgreSQL schema and policies migrated automatically via SUPABASE_ACCESS_TOKEN.'
    };
  }

  return {
    executed: false,
    mode: 'manual',
    message:
      'Automatic DDL requires SUPABASE_DB_URL or SUPABASE_ACCESS_TOKEN in your environment secrets (the Publishable Key cannot execute CREATE TABLE).'
  };
}

function signLocalToken(email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ email, exp: Date.now() + 1000 * 60 * 60 * 24 })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', LOCAL_TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyLocalToken(token: string): { email: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', LOCAL_TOKEN_SECRET).update(payload).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      email: string;
      exp: number;
    };
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return { email: parsed.email };
  } catch {
    return null;
  }
}

function ensureLocalShape(db: LocalDatabase): LocalDatabase {
  return {
    posts: db.posts || SEED_ARTICLES,
    comments: db.comments || SEED_COMMENTS,
    subscribers: db.subscribers || SEED_SUBSCRIBERS,
    inquiries: db.inquiries || SEED_INQUIRIES,
    site_settings: { ...DEFAULT_ADSENSE_SETTINGS, ...(db.site_settings || {}) },
    page_contents: db.page_contents || { ...DEFAULT_PAGE_CONTENTS },
    agent_tasks: db.agent_tasks || [...SEED_AGENT_TASKS],
    chat_threads: db.chat_threads || [...SEED_CHAT_THREADS],
    chat_messages: db.chat_messages || [...SEED_CHAT_MESSAGES],
    analytics_events: db.analytics_events || [...SEED_ANALYTICS_EVENTS],
    user_profiles: db.user_profiles || [...SEED_USER_PROFILES],
    user_workflow_items: db.user_workflow_items || [...SEED_USER_WORKFLOWS],
    routing_rules: db.routing_rules || [...SEED_ROUTING_RULES],
    agent_office_profiles: db.agent_office_profiles || [...DEFAULT_AGENT_OFFICE_PROFILES],
    agent_conversations: db.agent_conversations || [...SEED_AGENT_CONVERSATIONS],
    agent_report_settings: {
      ...DEFAULT_AGENT_REPORT_SETTINGS,
      ...(db.agent_report_settings || {})
    },
    agent_email_reports: db.agent_email_reports || [],
    crm_leads: db.crm_leads || [],
    crm_outreach_logs: db.crm_outreach_logs || [],
    crm_oauth_tokens: db.crm_oauth_tokens || [],
    crm_sync_runs: db.crm_sync_runs || [],
    crm_integration_secrets: db.crm_integration_secrets || [],
    demo_users: db.demo_users || [],
    inbox_email_logs: db.inbox_email_logs || []
  };
}

async function readLocalDb(): Promise<LocalDatabase> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return ensureLocalShape(JSON.parse(raw) as LocalDatabase);
  } catch {
    const initial = ensureLocalShape({
      posts: SEED_ARTICLES,
      comments: SEED_COMMENTS,
      subscribers: SEED_SUBSCRIBERS,
      inquiries: SEED_INQUIRIES,
      site_settings: DEFAULT_ADSENSE_SETTINGS
    });
    await writeLocalDb(initial);
    return initial;
  }
}

async function writeLocalDb(data: LocalDatabase): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export interface EditorSession {
  userId: string;
  email: string;
  provider: 'supabase' | 'local';
  role: UserRole;
  profile: UserProfile;
}

async function resolveOrBootstrapUserProfile(
  userId: string,
  email: string,
  userToken?: string
): Promise<UserProfile | null> {
  const cleanEmail = email.trim().toLowerCase();
  const isPrimaryAdmin = cleanEmail === PRIMARY_ADMIN_EMAIL;
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient(userToken);
    const { data: existingById, error: idErr } = await sb
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .limit(1);

    if (!idErr && existingById && existingById[0]) {
      const profile = existingById[0] as UserProfile;
      if (isPrimaryAdmin && profile.role !== 'super_admin') {
        const { data: upgraded } = await sb
          .from('user_profiles')
          .update({ role: 'super_admin', status: 'active', updated_at: now })
          .eq('user_id', userId)
          .select()
          .single();
        return (upgraded as UserProfile) || { ...profile, role: 'super_admin', status: 'active' };
      }
      if (profile.status === 'suspended') return null;
      return profile;
    }

    if (!idErr) {
      // Check if an account exists by email (for first bootstrap) or count super_admins
      const { data: byEmail } = await sb
        .from('user_profiles')
        .select('*')
        .eq('email', cleanEmail)
        .limit(1);

      if (byEmail && byEmail[0]) {
        const prev = byEmail[0] as UserProfile;
        const { data: migrated } = await sb
          .from('user_profiles')
          .update({ user_id: userId, updated_at: now })
          .eq('email', cleanEmail)
          .select()
          .maybeSingle();
        if (prev.status === 'suspended' && !isPrimaryAdmin) return null;
        return (migrated as UserProfile) || { ...prev, user_id: userId };
      }

      const { count: adminCount } = await sb
        .from('user_profiles')
        .select('user_id', { count: 'exact', head: true })
        .eq('role', 'super_admin');

      const assignedRole: UserRole = isPrimaryAdmin || (adminCount ?? 0) === 0 ? 'super_admin' : 'editor';
      const newProfile: UserProfile = {
        user_id: userId,
        email: cleanEmail,
        full_name: isPrimaryAdmin ? 'GitStack Founder' : cleanEmail.split('@')[0],
        role: assignedRole,
        job_title: assignedRole === 'super_admin' ? 'Principal Architect & Founder' : 'Editorial Operator',
        bio: '',
        avatar_url: '',
        phone: '',
        timezone: 'UTC',
        status: 'active',
        created_at: now,
        updated_at: now
      };
      const { data: inserted, error: insertErr } = await sb
        .from('user_profiles')
        .upsert(newProfile, { onConflict: 'email' })
        .select()
        .maybeSingle();
      if (!insertErr && inserted) return inserted as UserProfile;
      return newProfile;
    }

    if (!isFallbackableDbError(idErr)) {
      throw new Error(idErr.message);
    }
  }

  const db = await readLocalDb();
  const profiles = db.user_profiles || [];
  let found = profiles.find((p) => p.user_id === userId || p.email.toLowerCase() === cleanEmail);
  if (!found) {
    const hasAdmin = profiles.some((p) => p.role === 'super_admin' && p.status === 'active');
    found = {
      user_id: userId,
      email: cleanEmail,
      full_name: isPrimaryAdmin ? 'GitStack Founder' : cleanEmail.split('@')[0],
      role: isPrimaryAdmin || !hasAdmin ? 'super_admin' : 'editor',
      job_title: isPrimaryAdmin || !hasAdmin ? 'Principal Architect & Founder' : 'Team Member',
      bio: '',
      avatar_url: '',
      phone: '',
      timezone: 'UTC',
      status: 'active',
      created_at: now,
      updated_at: now
    };
    db.user_profiles = [...profiles, found];
    await writeLocalDb(db);
  }
  if (isPrimaryAdmin && found.role !== 'super_admin') {
    found.role = 'super_admin';
    found.status = 'active';
    await writeLocalDb(db);
  }
  if (found.status === 'suspended') return null;
  return found;
}

export async function signInEditor(
  email: string,
  password: string
): Promise<{ token: string; session: EditorSession } | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient();
    const { data, error } = await sb.auth.signInWithPassword({
      email: cleanEmail,
      password
    });
    if (error || !data.session?.access_token || !data.user?.email) {
      return null;
    }
    const profile = await resolveOrBootstrapUserProfile(
      data.user.id,
      data.user.email,
      data.session.access_token
    );
    if (!profile) return null;
    return {
      token: data.session.access_token,
      session: {
        userId: profile.user_id,
        email: data.user.email,
        provider: 'supabase',
        role: profile.role,
        profile
      }
    };
  }

  if (cleanEmail === FALLBACK_ADMIN_EMAIL && password === FALLBACK_ADMIN_PASSWORD) {
    const profile = await resolveOrBootstrapUserProfile('usr-primary-admin', cleanEmail);
    if (!profile) return null;
    return {
      token: signLocalToken(cleanEmail),
      session: {
        userId: profile.user_id,
        email: cleanEmail,
        provider: 'local',
        role: profile.role,
        profile
      }
    };
  }
  return null;
}

export async function verifyEditorToken(token: string | undefined): Promise<EditorSession | null> {
  if (!token) return null;
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient().auth.getUser(token);
    if (error || !data.user?.email) return null;
    const profile = await resolveOrBootstrapUserProfile(data.user.id, data.user.email, token);
    if (!profile) return null;
    return {
      userId: profile.user_id,
      email: data.user.email,
      provider: 'supabase',
      role: profile.role,
      profile
    };
  }
  const verified = verifyLocalToken(token);
  if (!verified) return null;
  const profile = await resolveOrBootstrapUserProfile('usr-primary-admin', verified.email);
  if (!profile) return null;
  return {
    userId: profile.user_id,
    email: verified.email,
    provider: 'local',
    role: profile.role,
    profile
  };
}

export async function seedStarterDataToSupabase(userToken?: string): Promise<{ seededPosts: number }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase environment variables are not configured.');
  }
  const sb = getSupabaseClient(userToken);
  const { error: postsErr } = await sb
    .from('posts')
    .upsert(SEED_ARTICLES, { onConflict: 'id', ignoreDuplicates: true });
  if (postsErr) throw new Error(postsErr.message);

  await sb.from('comments').upsert(SEED_COMMENTS, { onConflict: 'id', ignoreDuplicates: true });
  await sb
    .from('site_settings')
    .upsert({ id: 'default', ...DEFAULT_ADSENSE_SETTINGS }, { onConflict: 'id', ignoreDuplicates: true });

  // Also seed Back Office tables gracefully without overwriting user customizations
  await sb
    .from('page_contents')
    .upsert(Object.values(DEFAULT_PAGE_CONTENTS), { onConflict: 'page_key', ignoreDuplicates: true });
  await sb.from('agent_tasks').upsert(SEED_AGENT_TASKS, { onConflict: 'id', ignoreDuplicates: true });
  await sb.from('chat_threads').upsert(SEED_CHAT_THREADS, { onConflict: 'id', ignoreDuplicates: true });
  await sb.from('chat_messages').upsert(SEED_CHAT_MESSAGES, { onConflict: 'id', ignoreDuplicates: true });
  await sb.from('analytics_events').upsert(SEED_ANALYTICS_EVENTS, { onConflict: 'id', ignoreDuplicates: true });
  await sb.from('routing_rules').upsert(SEED_ROUTING_RULES, { onConflict: 'id', ignoreDuplicates: true });

  return { seededPosts: SEED_ARTICLES.length };
}

export async function autoSeedSupabaseIfEmpty(): Promise<boolean> {
  if (!isSupabaseConfigured() || !getSupabaseServiceKey()) return false;
  const sb = getSupabaseClient();
  const { count, error } = await sb.from('posts').select('id', { count: 'exact', head: true });
  if (error) return false;
  if ((count ?? 0) === 0) {
    await seedStarterDataToSupabase();
    return true;
  }
  // Ensure routing_rules has starter rows if table is newly added
  const { count: rulesCount } = await sb.from('routing_rules').select('id', { count: 'exact', head: true });
  if ((rulesCount ?? 0) === 0) {
    await sb.from('routing_rules').upsert(SEED_ROUTING_RULES, { onConflict: 'id', ignoreDuplicates: true });
  }
  return false;
}

export async function listPosts(includeDrafts: boolean, userToken?: string): Promise<Article[]> {
  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient(userToken);
    let query = sb.from('posts').select('*').order('updated_at', { ascending: false });
    if (!includeDrafts) {
      query = query.eq('status', 'published');
    }
    const { data, error } = await query;
    if (!error) {
      const rows = (data || []) as Article[];
      if (rows.length === 0 && !includeDrafts) {
        return SEED_ARTICLES;
      }
      return rows;
    }
    if (!isFallbackableDbError(error)) {
      throw new Error(error.message);
    }
  }

  const db = await readLocalDb();
  const posts = includeDrafts ? db.posts : db.posts.filter((p) => p.status === 'published');
  return [...posts].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export async function getPostBySlug(
  slug: string,
  includeDrafts: boolean,
  userToken?: string
): Promise<Article | null> {
  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient(userToken);
    let query = sb.from('posts').select('*').eq('slug', slug).limit(1);
    if (!includeDrafts) {
      query = query.eq('status', 'published');
    }
    const { data, error } = await query;
    if (!error) {
      if (data && data[0]) return data[0] as Article;
      const seedFallback = SEED_ARTICLES.find((p) => p.slug === slug);
      return seedFallback || null;
    }
    if (!isFallbackableDbError(error)) {
      throw new Error(error.message);
    }
  }

  const db = await readLocalDb();
  const found = db.posts.find((p) => p.slug === slug);
  if (!found) return null;
  if (!includeDrafts && found.status !== 'published') return null;
  return found;
}

export async function upsertPost(article: Article, userToken?: string): Promise<Article> {
  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient(userToken);
    const { data, error } = await sb
      .from('posts')
      .upsert(article, { onConflict: 'id' })
      .select()
      .single();
    if (!error && data) return data as Article;
    if (error && !isFallbackableDbError(error)) {
      throw new Error(error.message);
    }
  }

  const db = await readLocalDb();
  const idx = db.posts.findIndex((p) => p.id === article.id);
  if (idx >= 0) {
    db.posts[idx] = article;
  } else {
    db.posts.unshift(article);
  }
  await writeLocalDb(db);
  return article;
}

export async function deletePost(id: string, userToken?: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabaseClient(userToken).from('posts').delete().eq('id', id);
    if (!error) return true;
    if (!isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const before = db.posts.length;
  db.posts = db.posts.filter((p) => p.id !== id);
  db.comments = db.comments.filter((c) => c.post_id !== id);
  await writeLocalDb(db);
  return db.posts.length < before;
}

export async function listComments(
  postId: string | null,
  includeAll: boolean,
  userToken?: string
): Promise<ArticleComment[]> {
  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient(userToken);
    let query = sb.from('comments').select('*').order('created_at', { ascending: false });
    if (postId) query = query.eq('post_id', postId);
    if (!includeAll) query = query.eq('status', 'approved');
    const { data, error } = await query;
    if (!error) return (data || []) as ArticleComment[];
    if (!isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return db.comments
    .filter((c) => (!postId || c.post_id === postId) && (includeAll || c.status === 'approved'))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function createComment(comment: ArticleComment): Promise<ArticleComment> {
  const autoAssignee = await resolveAutoAssignee('chat', 'comment');
  const threadId = `thr-cmt-${comment.id}`;
  const thread: ChatThread = {
    id: threadId,
    subject: `Reader Comment: ${comment.body.slice(0, 64)}`,
    source_type: 'comment',
    source_ref_id: comment.id,
    requester_name: comment.author_name,
    requester_email: comment.author_email,
    status: 'open',
    assigned_to: autoAssignee,
    assigned_at: autoAssignee ? comment.created_at : null,
    last_message_at: comment.created_at,
    created_at: comment.created_at
  };
  const msg: ChatMessage = {
    id: `msg-${crypto.randomUUID().slice(0, 8)}`,
    thread_id: threadId,
    sender_role: 'visitor',
    sender_name: comment.author_name,
    body: comment.body,
    created_at: comment.created_at
  };

  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient();
    const { error } = await sb.from('comments').insert(comment);
    if (!error) {
      try {
        await sb.from('chat_threads').insert(thread);
        await sb.from('chat_messages').insert(msg);
      } catch {
        // Non-blocking chat thread creation
      }
      return comment;
    }
    if (!isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  db.comments.unshift(comment);
  db.chat_threads!.unshift(thread);
  db.chat_messages!.push(msg);
  await writeLocalDb(db);
  return comment;
}

export async function updateCommentStatus(
  id: string,
  status: CommentStatus,
  userToken?: string
): Promise<ArticleComment | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('comments')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (!error) return data as ArticleComment;
    if (!isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const item = db.comments.find((c) => c.id === id);
  if (!item) return null;
  item.status = status;
  await writeLocalDb(db);
  return item;
}

export async function listSubscribers(userToken?: string): Promise<NewsletterSubscriber[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('subscribers')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) return (data || []) as NewsletterSubscriber[];
    if (!isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return [...db.subscribers].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function addSubscriber(
  sub: NewsletterSubscriber
): Promise<{ subscriber: NewsletterSubscriber; alreadySubscribed: boolean }> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabaseClient().from('subscribers').insert(sub);
    if (!error) return { subscriber: sub, alreadySubscribed: false };
    if (error.code === '23505') {
      return { subscriber: sub, alreadySubscribed: true };
    }
    if (!isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const existing = db.subscribers.find((s) => s.email.toLowerCase() === sub.email.toLowerCase());
  if (existing) {
    return { subscriber: existing, alreadySubscribed: true };
  }
  db.subscribers.unshift(sub);
  await writeLocalDb(db);
  return { subscriber: sub, alreadySubscribed: false };
}

export async function listInquiries(userToken?: string): Promise<ClientInquiry[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('inquiries')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) return (data || []) as ClientInquiry[];
    if (!isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return [...db.inquiries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function createInquiry(inquiry: ClientInquiry): Promise<ClientInquiry> {
  const autoAssignee = await resolveAutoAssignee('inquiry', inquiry.service_interest);
  const chatAssignee = autoAssignee || (await resolveAutoAssignee('chat', 'inquiry'));
  const enrichedInquiry: ClientInquiry = {
    ...inquiry,
    assigned_to: autoAssignee,
    assigned_at: autoAssignee ? inquiry.created_at : null
  };
  const threadId = `thr-inq-${inquiry.id}`;
  const thread: ChatThread = {
    id: threadId,
    subject: `${inquiry.service_interest} Inquiry · ${inquiry.company} (${inquiry.reference_code})`,
    source_type: 'inquiry',
    source_ref_id: inquiry.id,
    requester_name: `${inquiry.full_name} (${inquiry.company})`,
    requester_email: inquiry.work_email,
    status: 'open',
    assigned_to: chatAssignee,
    assigned_at: chatAssignee ? inquiry.created_at : null,
    last_message_at: inquiry.created_at,
    created_at: inquiry.created_at
  };
  const msg: ChatMessage = {
    id: `msg-${crypto.randomUUID().slice(0, 8)}`,
    thread_id: threadId,
    sender_role: 'visitor',
    sender_name: inquiry.full_name,
    body: `${inquiry.project_brief}\n\nBudget: ${inquiry.budget_range} · Timeline: ${inquiry.timeline}`,
    created_at: inquiry.created_at
  };

  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient();
    const { error } = await sb.from('inquiries').insert(enrichedInquiry);
    if (!error) {
      try {
        await sb.from('chat_threads').insert(thread);
        await sb.from('chat_messages').insert(msg);
      } catch {
        // Non-blocking chat thread creation
      }
      return enrichedInquiry;
    }
    if (!isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  db.inquiries.unshift(enrichedInquiry);
  db.chat_threads!.unshift(thread);
  db.chat_messages!.push(msg);
  await writeLocalDb(db);
  return enrichedInquiry;
}

export async function updateInquiryStatus(
  id: string,
  status: InquiryStatus,
  userToken?: string
): Promise<ClientInquiry | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('inquiries')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (!error) return data as ClientInquiry;
    if (!isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const item = db.inquiries.find((i) => i.id === id);
  if (!item) return null;
  item.status = status;
  await writeLocalDb(db);
  return item;
}

export async function assignInquiry(
  id: string,
  assignedTo: string | null,
  userToken?: string
): Promise<ClientInquiry | null> {
  const assignedAt = assignedTo ? new Date().toISOString() : null;
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('inquiries')
      .update({ assigned_to: assignedTo, assigned_at: assignedAt })
      .eq('id', id)
      .select()
      .single();
    if (!error && data) return data as ClientInquiry;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const item = db.inquiries.find((i) => i.id === id);
  if (!item) return null;
  item.assigned_to = assignedTo;
  item.assigned_at = assignedAt;
  await writeLocalDb(db);
  return item;
}

export async function getAdSenseSettings(): Promise<AdSenseSettings> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient()
      .from('site_settings')
      .select('*')
      .eq('id', 'default')
      .limit(1);
    if (!error && data && data[0]) {
      const row = data[0] as AdSenseSettings & { id?: string };
      return {
        adsense_publisher_id: row.adsense_publisher_id || '',
        ads_txt_content: row.ads_txt_content || DEFAULT_ADSENSE_SETTINGS.ads_txt_content,
        auto_ads_enabled: Boolean(row.auto_ads_enabled),
        ad_slots_enabled: Boolean(row.ad_slots_enabled),
        editorial_review_note:
          row.editorial_review_note || DEFAULT_ADSENSE_SETTINGS.editorial_review_note,
        ga4_measurement_id: row.ga4_measurement_id || '',
        ga4_enabled: Boolean(row.ga4_enabled),
        ga4_track_events: row.ga4_track_events !== undefined ? Boolean(row.ga4_track_events) : true,
        brand_name: row.brand_name || DEFAULT_ADSENSE_SETTINGS.brand_name,
        brand_logo_url: row.brand_logo_url || '',
        brand_logo_alt: row.brand_logo_alt || DEFAULT_ADSENSE_SETTINGS.brand_logo_alt,
        favicon_url: row.favicon_url || '',
        theme_preset: row.theme_preset || DEFAULT_ADSENSE_SETTINGS.theme_preset,
        primary_color: row.primary_color || DEFAULT_ADSENSE_SETTINGS.primary_color,
        header_surface: row.header_surface === 'tinted' ? 'tinted' : 'white',
        header_cta_label: row.header_cta_label || DEFAULT_ADSENSE_SETTINGS.header_cta_label,
        header_cta_href: row.header_cta_href || DEFAULT_ADSENSE_SETTINGS.header_cta_href,
        updated_at: row.updated_at || new Date().toISOString()
      };
    }
    if (error && !isFallbackableDbError(error)) {
      console.warn('Supabase settings fallback:', error.message);
    }
  }

  const db = await readLocalDb();
  return { ...DEFAULT_ADSENSE_SETTINGS, ...(db.site_settings || {}) };
}

export async function saveAdSenseSettings(
  next: AdSenseSettings,
  userToken?: string
): Promise<AdSenseSettings> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('site_settings')
      .upsert({ id: 'default', ...next }, { onConflict: 'id' })
      .select()
      .single();
    if (!error && data) return data as AdSenseSettings;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  db.site_settings = next;
  await writeLocalDb(db);
  return next;
}

// --- Page Content & Media Customizer ---

export async function listPageContents(): Promise<PageContentConfig[]> {
  const keys: PageKey[] = ['home', 'services', 'about', 'contact'];
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient().from('page_contents').select('*');
    if (!error && Array.isArray(data)) {
      const byKey = new Map((data as PageContentConfig[]).map((r) => [r.page_key, r]));
      return keys.map((k) => ({ ...DEFAULT_PAGE_CONTENTS[k], ...(byKey.get(k) || {}) }));
    }
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return keys.map((k) => ({
    ...DEFAULT_PAGE_CONTENTS[k],
    ...(db.page_contents?.[k] || {})
  }));
}

export async function upsertPageContent(
  config: PageContentConfig,
  userToken?: string
): Promise<PageContentConfig> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('page_contents')
      .upsert(config, { onConflict: 'page_key' })
      .select()
      .single();
    if (!error && data) return data as PageContentConfig;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  db.page_contents = db.page_contents || { ...DEFAULT_PAGE_CONTENTS };
  db.page_contents[config.page_key] = config;
  await writeLocalDb(db);
  return config;
}

// --- 7-Agent Operational Checklists ---

export async function listAgentTasks(userToken?: string): Promise<AgentTask[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('agent_tasks')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      return data as AgentTask[];
    }
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return db.agent_tasks || [...SEED_AGENT_TASKS];
}

export async function upsertAgentTask(task: AgentTask, userToken?: string): Promise<AgentTask> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('agent_tasks')
      .upsert(task, { onConflict: 'id' })
      .select()
      .single();
    if (!error && data) return data as AgentTask;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const tasks = db.agent_tasks || [];
  const idx = tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) tasks[idx] = task;
  else tasks.unshift(task);
  db.agent_tasks = tasks;
  await writeLocalDb(db);
  return task;
}

export async function deleteAgentTask(id: string, userToken?: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabaseClient(userToken).from('agent_tasks').delete().eq('id', id);
    if (!error) return true;
    if (!isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const before = (db.agent_tasks || []).length;
  db.agent_tasks = (db.agent_tasks || []).filter((t) => t.id !== id);
  await writeLocalDb(db);
  return db.agent_tasks.length < before;
}

// --- Internal Back Office Historical Q&A & Live Chat ---

export async function listChatThreads(userToken?: string): Promise<ChatThread[]> {
  let threads: ChatThread[] = [];
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('chat_threads')
      .select('*')
      .order('last_message_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      threads = data as ChatThread[];
    } else if (error && !isFallbackableDbError(error)) {
      throw new Error(error.message);
    } else {
      const db = await readLocalDb();
      threads = [...(db.chat_threads || [])];
    }
  } else {
    const db = await readLocalDb();
    threads = [...(db.chat_threads || [])];
  }

  return threads.sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  );
}

export async function listChatMessages(threadId: string, userToken?: string): Promise<ChatMessage[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (!error && Array.isArray(data)) {
      return data as ChatMessage[];
    }
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return (db.chat_messages || [])
    .filter((m) => m.thread_id === threadId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export async function createChatThread(
  thread: ChatThread,
  initialMessage: ChatMessage,
  userToken?: string
): Promise<{ thread: ChatThread; message: ChatMessage }> {
  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient(userToken);
    const { error: tErr } = await sb.from('chat_threads').insert(thread);
    if (!tErr) {
      const { error: mErr } = await sb.from('chat_messages').insert(initialMessage);
      if (!mErr) return { thread, message: initialMessage };
      if (!isFallbackableDbError(mErr)) throw new Error(mErr.message);
    } else if (!isFallbackableDbError(tErr)) {
      throw new Error(tErr.message);
    }
  }

  const db = await readLocalDb();
  db.chat_threads = db.chat_threads || [];
  db.chat_messages = db.chat_messages || [];
  db.chat_threads.unshift(thread);
  db.chat_messages.push(initialMessage);
  await writeLocalDb(db);
  return { thread, message: initialMessage };
}

export async function addChatMessage(
  msg: ChatMessage,
  markAnswered: boolean,
  userToken?: string
): Promise<ChatMessage> {
  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient(userToken);
    const { error } = await sb.from('chat_messages').insert(msg);
    if (!error) {
      await sb
        .from('chat_threads')
        .update({
          last_message_at: msg.created_at,
          ...(markAnswered ? { status: 'answered' } : {})
        })
        .eq('id', msg.thread_id);
      return msg;
    }
    if (!isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  db.chat_messages = db.chat_messages || [];
  db.chat_messages.push(msg);
  const thr = (db.chat_threads || []).find((t) => t.id === msg.thread_id);
  if (thr) {
    thr.last_message_at = msg.created_at;
    if (markAnswered) thr.status = 'answered';
  }
  await writeLocalDb(db);
  return msg;
}

export async function updateChatThreadStatus(
  id: string,
  status: ChatThreadStatus,
  userToken?: string
): Promise<ChatThread | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('chat_threads')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (!error && data) return data as ChatThread;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const thr = (db.chat_threads || []).find((t) => t.id === id);
  if (!thr) return null;
  thr.status = status;
  await writeLocalDb(db);
  return thr;
}

// --- Analytics Events & Aggregation ---

export async function recordAnalyticsEvent(evt: AnalyticsEvent): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabaseClient().from('analytics_events').insert(evt);
    if (!error) return;
    if (!isFallbackableDbError(error)) {
      console.warn('Analytics insert warning:', error.message);
    }
  }

  const db = await readLocalDb();
  db.analytics_events = db.analytics_events || [];
  db.analytics_events.push(evt);
  if (db.analytics_events.length > 5000) {
    db.analytics_events = db.analytics_events.slice(-5000);
  }
  await writeLocalDb(db);
}

export async function getAnalyticsSummary(
  days = 14,
  userToken?: string
): Promise<AnalyticsSummary> {
  const safeDays = [7, 14, 30].includes(days) ? days : 14;
  const cutoffMs = Date.now() - safeDays * 24 * 60 * 60 * 1000;
  let events: AnalyticsEvent[] = [];

  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('analytics_events')
      .select('*')
      .gte('created_at', new Date(cutoffMs).toISOString())
      .order('created_at', { ascending: true });
    if (!error && Array.isArray(data)) {
      events = data as AnalyticsEvent[];
    } else if (error && !isFallbackableDbError(error)) {
      throw new Error(error.message);
    } else {
      const db = await readLocalDb();
      events = (db.analytics_events || []).filter(
        (e) => new Date(e.created_at).getTime() >= cutoffMs
      );
    }
  } else {
    const db = await readLocalDb();
    events = (db.analytics_events || []).filter(
      (e) => new Date(e.created_at).getTime() >= cutoffMs
    );
  }

  const pageviews = events.filter((e) => e.event_type === 'pageview');
  const inquiryConversions = events.filter((e) => e.event_type === 'inquiry_submitted').length;
  const newsletterConversions = events.filter((e) => e.event_type === 'newsletter_subscribed').length;
  const commentSubmissions = events.filter((e) => e.event_type === 'comment_submitted').length;
  const sessions = new Set(events.map((e) => e.session_id).filter(Boolean));

  const dayMap = new Map<string, { pageviews: number; conversions: number }>();
  for (let i = safeDays - 1; i >= 0; i--) {
    const key = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    dayMap.set(key, { pageviews: 0, conversions: 0 });
  }
  for (const evt of events) {
    const dayKey = evt.created_at.slice(0, 10);
    const bucket = dayMap.get(dayKey);
    if (!bucket) continue;
    if (evt.event_type === 'pageview') bucket.pageviews += 1;
    else bucket.conversions += 1;
  }

  const pageCount = new Map<string, number>();
  const refCount = new Map<string, number>();
  for (const pv of pageviews) {
    pageCount.set(pv.path, (pageCount.get(pv.path) || 0) + 1);
    const ref = pv.referrer?.trim() || 'direct';
    refCount.set(ref, (refCount.get(ref) || 0) + 1);
  }

  const uniqueSessions = sessions.size;
  const totalConversions = inquiryConversions + newsletterConversions;
  const conversionRatePercent =
    uniqueSessions > 0 ? Number(((totalConversions / uniqueSessions) * 100).toFixed(1)) : 0;

  return {
    days: safeDays,
    totalPageviews: pageviews.length,
    uniqueSessions,
    inquiryConversions,
    newsletterConversions,
    commentSubmissions,
    conversionRatePercent,
    dailySeries: Array.from(dayMap.entries()).map(([date, val]) => ({
      date,
      pageviews: val.pageviews,
      conversions: val.conversions
    })),
    topPages: Array.from(pageCount.entries())
      .map(([p, views]) => ({ path: p, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8),
    topReferrers: Array.from(refCount.entries())
      .map(([referrer, visits]) => ({ referrer, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 6)
  };
}

// --- Chat Thread Assignment ---

export async function assignChatThread(
  id: string,
  assignedTo: string | null,
  userToken?: string
): Promise<ChatThread | null> {
  const assignedAt = assignedTo ? new Date().toISOString() : null;
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('chat_threads')
      .update({ assigned_to: assignedTo, assigned_at: assignedAt })
      .eq('id', id)
      .select()
      .single();
    if (!error && data) return data as ChatThread;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const thr = (db.chat_threads || []).find((t) => t.id === id);
  if (!thr) return null;
  thr.assigned_to = assignedTo;
  thr.assigned_at = assignedAt;
  await writeLocalDb(db);
  return thr;
}

// --- Team User Profiles & Access Management ---

export async function listUserProfiles(userToken?: string): Promise<UserProfile[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error && Array.isArray(data)) {
      return data as UserProfile[];
    }
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return db.user_profiles || [...SEED_USER_PROFILES];
}

export async function listUserDirectory(userToken?: string): Promise<DirectoryUser[]> {
  const profiles = await listUserProfiles(userToken);
  return profiles.map((p) => ({
    user_id: p.user_id,
    email: p.email,
    full_name: p.full_name,
    role: p.role,
    job_title: p.job_title,
    avatar_url: p.avatar_url,
    status: p.status
  }));
}

export async function updateMyUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'full_name' | 'job_title' | 'bio' | 'avatar_url' | 'phone' | 'timezone'>>,
  userToken?: string,
  emailHint?: string
): Promise<UserProfile | null> {
  const now = new Date().toISOString();
  const cleanEmail = emailHint?.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient(userToken);
    const { data, error } = await sb
      .from('user_profiles')
      .update({ ...updates, updated_at: now })
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (!error && data) return data as UserProfile;

    // Self-heal when existing row has mismatched user_id (e.g. seeded primary admin email) or hasn't been inserted yet
    if (!error && !data && cleanEmail) {
      const { data: byEmail, error: emailUpdateErr } = await sb
        .from('user_profiles')
        .update({ ...updates, user_id: userId, updated_at: now })
        .eq('email', cleanEmail)
        .select()
        .maybeSingle();
      if (!emailUpdateErr && byEmail) return byEmail as UserProfile;

      const isPrimaryAdmin = cleanEmail === PRIMARY_ADMIN_EMAIL;
      const bootstrapRow: UserProfile = {
        user_id: userId,
        email: cleanEmail,
        full_name: updates.full_name?.trim() || (isPrimaryAdmin ? 'GitStack Founder' : cleanEmail.split('@')[0]),
        role: isPrimaryAdmin ? 'super_admin' : 'editor',
        job_title: updates.job_title?.trim() || (isPrimaryAdmin ? 'Principal Architect & Founder' : 'Editorial Operator'),
        bio: updates.bio?.trim() || '',
        avatar_url: updates.avatar_url?.trim() || '',
        phone: updates.phone?.trim() || '',
        timezone: updates.timezone?.trim() || 'UTC',
        status: 'active',
        created_at: now,
        updated_at: now
      };
      const { data: upserted, error: upsertErr } = await sb
        .from('user_profiles')
        .upsert(bootstrapRow, { onConflict: 'email' })
        .select()
        .maybeSingle();
      if (!upsertErr && upserted) return upserted as UserProfile;
      if (upsertErr && !isFallbackableDbError(upsertErr)) throw new Error(upsertErr.message);
    }

    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const list = db.user_profiles || [...SEED_USER_PROFILES];
  let idx = list.findIndex((p) => p.user_id === userId);
  if (idx === -1 && cleanEmail) {
    idx = list.findIndex((p) => p.email.toLowerCase() === cleanEmail);
  }
  if (idx === -1) {
    if (!cleanEmail) return null;
    const isPrimaryAdmin = cleanEmail === PRIMARY_ADMIN_EMAIL;
    const created: UserProfile = {
      user_id: userId,
      email: cleanEmail,
      full_name: updates.full_name?.trim() || (isPrimaryAdmin ? 'GitStack Founder' : cleanEmail.split('@')[0]),
      role: isPrimaryAdmin ? 'super_admin' : 'editor',
      job_title: updates.job_title?.trim() || 'Principal Architect',
      bio: updates.bio?.trim() || '',
      avatar_url: updates.avatar_url?.trim() || '',
      phone: updates.phone?.trim() || '',
      timezone: updates.timezone?.trim() || 'UTC',
      status: 'active',
      created_at: now,
      updated_at: now
    };
    list.push(created);
    db.user_profiles = list;
    await writeLocalDb(db);
    return created;
  }
  list[idx] = { ...list[idx], ...updates, user_id: userId, updated_at: now };
  db.user_profiles = list;
  await writeLocalDb(db);
  return list[idx];
}

export async function createTeamUser(
  input: {
    email: string;
    password: string;
    full_name: string;
    role: UserRole;
    job_title?: string;
    createdByUserId: string;
  },
  userToken?: string
): Promise<UserProfile> {
  const cleanEmail = input.email.trim().toLowerCase();
  const now = new Date().toISOString();
  let newUserId = `usr-${crypto.randomUUID().slice(0, 8)}`;

  if (isSupabaseConfigured()) {
    const serviceKey = getSupabaseServiceKey();
    if (!serviceKey) {
      throw new Error(
        'SUPABASE_SECRET_KEY is required on the server to provision new Supabase Auth users directly.'
      );
    }
    const adminClient = createClient(getSupabaseUrl()!, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: input.full_name.trim(),
        role: input.role
      }
    });
    if (authErr || !authData.user) {
      throw new Error(authErr?.message || 'Failed to create user in Supabase Auth.');
    }
    newUserId = authData.user.id;
  }

  const profile: UserProfile = {
    user_id: newUserId,
    email: cleanEmail,
    full_name: input.full_name.trim() || cleanEmail.split('@')[0],
    role: input.role,
    job_title: (input.job_title || '').trim() || (
      input.role === 'super_admin'
        ? 'Super Admin'
        : input.role === 'editor'
          ? 'Technical Editor'
          : 'Support Specialist'
    ),
    bio: '',
    avatar_url: '',
    phone: '',
    timezone: 'UTC',
    status: 'active',
    created_at: now,
    updated_at: now
  };

  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient(userToken);
    const { data, error } = await sb
      .from('user_profiles')
      .upsert(profile, { onConflict: 'user_id' })
      .select()
      .single();
    if (!error && data) {
      await createWorkflowItem(
        {
          id: `wf-${crypto.randomUUID().slice(0, 8)}`,
          user_id: newUserId,
          assigned_by: input.createdByUserId,
          title: 'Complete My Profile & timezone settings',
          description: 'Add your avatar photo, engineering role title, and local timezone in My Profile.',
          category: 'onboarding',
          priority: 'medium',
          status: 'todo',
          due_date: null,
          linked_entity_type: 'none',
          linked_entity_id: null,
          created_at: now,
          updated_at: now
        },
        userToken
      ).catch(() => {});
      return data as UserProfile;
    }
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  db.user_profiles = [...(db.user_profiles || []), profile];
  await writeLocalDb(db);
  return profile;
}

export async function updateTeamUser(
  targetUserId: string,
  actorUserId: string,
  updates: {
    role?: UserRole;
    status?: UserStatus;
    full_name?: string;
    job_title?: string;
    password?: string;
  },
  userToken?: string
): Promise<UserProfile> {
  const all = await listUserProfiles(userToken);
  const target = all.find((u) => u.user_id === targetUserId);
  if (!target) throw new Error('User profile not found.');

  const activeAdmins = all.filter((u) => u.role === 'super_admin' && u.status === 'active');
  const isTargetLastActiveAdmin =
    target.role === 'super_admin' && target.status === 'active' && activeAdmins.length <= 1;

  if (isTargetLastActiveAdmin) {
    if (updates.role && updates.role !== 'super_admin') {
      throw new Error('Cannot demote the last active Super Admin.');
    }
    if (updates.status === 'suspended') {
      throw new Error('Cannot suspend the last active Super Admin.');
    }
  }
  if (targetUserId === actorUserId && updates.status === 'suspended') {
    throw new Error('You cannot suspend your own active session.');
  }

  if (updates.password && updates.password.trim().length >= 8 && isSupabaseConfigured()) {
    const serviceKey = getSupabaseServiceKey();
    if (!serviceKey) {
      throw new Error('SUPABASE_SECRET_KEY is required to reset user passwords.');
    }
    const adminClient = createClient(getSupabaseUrl()!, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { error: pwErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
      password: updates.password.trim()
    });
    if (pwErr) throw new Error(pwErr.message);
  }

  const now = new Date().toISOString();
  const patch: Partial<UserProfile> = {
    ...(updates.role ? { role: updates.role } : {}),
    ...(updates.status ? { status: updates.status } : {}),
    ...(updates.full_name !== undefined ? { full_name: updates.full_name.trim() } : {}),
    ...(updates.job_title !== undefined ? { job_title: updates.job_title.trim() } : {}),
    updated_at: now
  };

  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('user_profiles')
      .update(patch)
      .eq('user_id', targetUserId)
      .select()
      .single();
    if (!error && data) return data as UserProfile;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const list = db.user_profiles || [];
  const idx = list.findIndex((u) => u.user_id === targetUserId);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch };
    db.user_profiles = list;
    await writeLocalDb(db);
    return list[idx];
  }
  throw new Error('User not found.');
}

export async function deleteTeamUser(
  targetUserId: string,
  actorUserId: string,
  userToken?: string
): Promise<boolean> {
  if (targetUserId === actorUserId) {
    throw new Error('You cannot delete your own active account.');
  }
  const all = await listUserProfiles(userToken);
  const target = all.find((u) => u.user_id === targetUserId);
  if (!target) throw new Error('User profile not found.');

  const activeAdmins = all.filter((u) => u.role === 'super_admin' && u.status === 'active');
  if (target.role === 'super_admin' && target.status === 'active' && activeAdmins.length <= 1) {
    throw new Error('Cannot delete the last active Super Admin.');
  }

  if (isSupabaseConfigured()) {
    const serviceKey = getSupabaseServiceKey();
    if (serviceKey) {
      const adminClient = createClient(getSupabaseUrl()!, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { error: delAuthErr } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (delAuthErr && !delAuthErr.message.toLowerCase().includes('not found')) {
        throw new Error(delAuthErr.message);
      }
    }
    const sb = getSupabaseClient(userToken);
    await sb.from('inquiries').update({ assigned_to: null }).eq('assigned_to', targetUserId);
    await sb.from('chat_threads').update({ assigned_to: null }).eq('assigned_to', targetUserId);
    await sb.from('routing_rules').update({ assignee_user_id: null }).eq('assignee_user_id', targetUserId);
    const { error } = await sb.from('user_profiles').delete().eq('user_id', targetUserId);
    if (!error) return true;
    if (!isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  db.user_profiles = (db.user_profiles || []).filter((u) => u.user_id !== targetUserId);
  db.user_workflow_items = (db.user_workflow_items || []).filter((w) => w.user_id !== targetUserId);
  db.inquiries = db.inquiries.map((i) =>
    i.assigned_to === targetUserId ? { ...i, assigned_to: null } : i
  );
  db.chat_threads = (db.chat_threads || []).map((t) =>
    t.assigned_to === targetUserId ? { ...t, assigned_to: null } : t
  );
  await writeLocalDb(db);
  return true;
}

// --- Per-User Workflow Items ---

export async function listWorkflowItems(
  userId?: string,
  userToken?: string
): Promise<UserWorkflowItem[]> {
  if (isSupabaseConfigured()) {
    let query = getSupabaseClient(userToken)
      .from('user_workflow_items')
      .select('*')
      .order('updated_at', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (!error && Array.isArray(data)) return data as UserWorkflowItem[];
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const items = db.user_workflow_items || [...SEED_USER_WORKFLOWS];
  return userId ? items.filter((w) => w.user_id === userId) : items;
}

export async function createWorkflowItem(
  item: UserWorkflowItem,
  userToken?: string
): Promise<UserWorkflowItem> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('user_workflow_items')
      .insert(item)
      .select()
      .single();
    if (!error && data) return data as UserWorkflowItem;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  db.user_workflow_items = [item, ...(db.user_workflow_items || [])];
  await writeLocalDb(db);
  return item;
}

export async function updateWorkflowItem(
  id: string,
  patch: Partial<UserWorkflowItem>,
  userToken?: string
): Promise<UserWorkflowItem | null> {
  const updatedPatch = { ...patch, updated_at: new Date().toISOString() };
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('user_workflow_items')
      .update(updatedPatch)
      .eq('id', id)
      .select()
      .single();
    if (!error && data) return data as UserWorkflowItem;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const list = db.user_workflow_items || [];
  const idx = list.findIndex((w) => w.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...updatedPatch };
  db.user_workflow_items = list;
  await writeLocalDb(db);
  return list[idx];
}

export async function deleteWorkflowItem(id: string, userToken?: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabaseClient(userToken)
      .from('user_workflow_items')
      .delete()
      .eq('id', id);
    if (!error) return true;
    if (!isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const before = (db.user_workflow_items || []).length;
  db.user_workflow_items = (db.user_workflow_items || []).filter((w) => w.id !== id);
  await writeLocalDb(db);
  return db.user_workflow_items.length < before;
}

// --- Deterministic Auto-Routing Rules ---

export async function listRoutingRules(userToken?: string): Promise<RoutingRule[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('routing_rules')
      .select('*')
      .order('source_type', { ascending: true });
    if (!error && Array.isArray(data)) {
      return data.length > 0 ? (data as RoutingRule[]) : [...SEED_ROUTING_RULES];
    }
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return db.routing_rules || [...SEED_ROUTING_RULES];
}

export async function saveRoutingRules(
  rules: RoutingRule[],
  userToken?: string
): Promise<RoutingRule[]> {
  const now = new Date().toISOString();
  const normalized = rules.map((r) => ({ ...r, updated_at: now }));
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('routing_rules')
      .upsert(normalized, { onConflict: 'id' })
      .select();
    if (!error && Array.isArray(data)) return data as RoutingRule[];
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  db.routing_rules = normalized;
  await writeLocalDb(db);
  return normalized;
}

async function resolveAutoAssignee(
  sourceType: 'inquiry' | 'chat',
  matchKey: string
): Promise<string | null> {
  try {
    const [rules, users] = await Promise.all([listRoutingRules(), listUserProfiles()]);
    const activeIds = new Set(users.filter((u) => u.status === 'active').map((u) => u.user_id));
    const exact = rules.find(
      (r) =>
        r.enabled &&
        r.source_type === sourceType &&
        r.match_key.toLowerCase() === matchKey.toLowerCase() &&
        r.assignee_user_id &&
        activeIds.has(r.assignee_user_id)
    );
    if (exact?.assignee_user_id) return exact.assignee_user_id;

    const fallback = rules.find(
      (r) =>
        r.enabled &&
        r.source_type === sourceType &&
        r.match_key === 'default' &&
        r.assignee_user_id &&
        activeIds.has(r.assignee_user_id)
    );
    return fallback?.assignee_user_id || null;
  } catch {
    return null;
  }
}

// --- Virtual Office HQ Profiles, Conversations & Daily Email Report Proof Logs ---

export async function listAgentOfficeProfiles(userToken?: string): Promise<AgentOfficeProfile[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('agent_office_profiles')
      .select('*');
    if (!error && Array.isArray(data)) {
      const byId = new Map<AgentId, AgentOfficeProfile>();
      for (const def of DEFAULT_AGENT_OFFICE_PROFILES) {
        byId.set(def.agent_id, def);
      }
      for (const row of data as AgentOfficeProfile[]) {
        byId.set(row.agent_id, {
          ...row,
          desk_x: Number(row.desk_x),
          desk_y: Number(row.desk_y)
        });
      }
      return Array.from(byId.values());
    }
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return db.agent_office_profiles || [...DEFAULT_AGENT_OFFICE_PROFILES];
}

export async function upsertAgentOfficeProfile(
  profile: AgentOfficeProfile,
  userToken?: string
): Promise<AgentOfficeProfile> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('agent_office_profiles')
      .upsert(profile, { onConflict: 'agent_id' })
      .select()
      .single();
    if (!error && data) {
      const row = data as AgentOfficeProfile;
      return { ...row, desk_x: Number(row.desk_x), desk_y: Number(row.desk_y) };
    }
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const list = db.agent_office_profiles || [...DEFAULT_AGENT_OFFICE_PROFILES];
  const idx = list.findIndex((p) => p.agent_id === profile.agent_id);
  if (idx >= 0) list[idx] = profile;
  else list.push(profile);
  db.agent_office_profiles = list;
  await writeLocalDb(db);
  return profile;
}

export async function bulkUpdateAgentWorkStatus(
  workStatus: AgentWorkStatus,
  userToken?: string
): Promise<AgentOfficeProfile[]> {
  const current = await listAgentOfficeProfiles(userToken);
  const now = new Date().toISOString();
  const updated = current.map((p) => ({ ...p, work_status: workStatus, updated_at: now }));

  if (isSupabaseConfigured()) {
    const { error } = await getSupabaseClient(userToken)
      .from('agent_office_profiles')
      .upsert(updated, { onConflict: 'agent_id' });
    if (!error) return updated;
    if (!isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  db.agent_office_profiles = updated;
  await writeLocalDb(db);
  return updated;
}

export async function listAgentConversations(
  userToken?: string
): Promise<AgentConversationEntry[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('agent_conversations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(120);
    if (!error && Array.isArray(data)) {
      return data.length > 0 ? (data as AgentConversationEntry[]) : [...SEED_AGENT_CONVERSATIONS];
    }
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return [...(db.agent_conversations || SEED_AGENT_CONVERSATIONS)].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function addAgentConversation(
  entry: AgentConversationEntry,
  userToken?: string
): Promise<AgentConversationEntry> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('agent_conversations')
      .insert(entry)
      .select()
      .single();
    if (!error && data) return data as AgentConversationEntry;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const list = db.agent_conversations || [...SEED_AGENT_CONVERSATIONS];
  list.unshift(entry);
  db.agent_conversations = list.slice(0, 200);
  await writeLocalDb(db);
  return entry;
}

export async function getAgentReportSettings(userToken?: string): Promise<AgentReportSettings> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('agent_report_settings')
      .select('*')
      .eq('id', 'default')
      .limit(1);
    if (!error && data && data[0]) {
      return { ...DEFAULT_AGENT_REPORT_SETTINGS, ...(data[0] as AgentReportSettings) };
    }
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return { ...DEFAULT_AGENT_REPORT_SETTINGS, ...(db.agent_report_settings || {}) };
}

export async function saveAgentReportSettings(
  settings: AgentReportSettings,
  userToken?: string
): Promise<AgentReportSettings> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('agent_report_settings')
      .upsert(settings, { onConflict: 'id' })
      .select()
      .single();
    if (!error && data) return data as AgentReportSettings;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  db.agent_report_settings = settings;
  await writeLocalDb(db);
  return settings;
}

export async function listAgentEmailReports(userToken?: string): Promise<AgentEmailReport[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('agent_email_reports')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(60);
    if (!error && Array.isArray(data)) {
      return data as AgentEmailReport[];
    }
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return [...(db.agent_email_reports || [])].sort(
    (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
  );
}

export async function recordAgentEmailReport(
  report: AgentEmailReport,
  userToken?: string
): Promise<AgentEmailReport> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('agent_email_reports')
      .insert(report)
      .select()
      .single();
    if (!error && data) {
      if (report.status === 'sent') {
        const current = await getAgentReportSettings(userToken);
        await saveAgentReportSettings(
          { ...current, last_sent_at: report.sent_at, updated_at: report.sent_at },
          userToken
        ).catch(() => {});
      }
      return data as AgentEmailReport;
    }
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const list = db.agent_email_reports || [];
  list.unshift(report);
  db.agent_email_reports = list.slice(0, 100);
  if (report.status === 'sent') {
    db.agent_report_settings = {
      ...DEFAULT_AGENT_REPORT_SETTINGS,
      ...(db.agent_report_settings || {}),
      last_sent_at: report.sent_at,
      updated_at: report.sent_at
    };
  }
  await writeLocalDb(db);
  return report;
}

// --- Apollo-Style CRM Leads, Outreach Logs & Lark OAuth Tokens ---

export async function listCrmLeads(userToken?: string): Promise<CrmLead[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('crm_leads')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      return data as CrmLead[];
    }
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return [...(db.crm_leads || [])].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export async function upsertCrmLead(lead: CrmLead, userToken?: string): Promise<CrmLead> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('crm_leads')
      .upsert(lead, { onConflict: 'id' })
      .select()
      .single();
    if (!error && data) return data as CrmLead;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const list = db.crm_leads || [];
  const idx = list.findIndex((l) => l.id === lead.id);
  if (idx >= 0) list[idx] = lead;
  else list.unshift(lead);
  db.crm_leads = list;
  await writeLocalDb(db);
  return lead;
}

export async function upsertMergeCrmLeads(
  incomingLeads: CrmLead[],
  userToken?: string
): Promise<{
  insertedCount: number;
  mergedCount: number;
  leads: CrmLead[];
}> {
  if (incomingLeads.length === 0) {
    return {
      insertedCount: 0,
      mergedCount: 0,
      leads: await listCrmLeads(userToken)
    };
  }

  const existingLeads = await listCrmLeads(userToken);
  const byEmail = new Map<string, CrmLead>();
  const byDomain = new Map<string, CrmLead>();
  const byGithub = new Map<string, CrmLead>();

  const indexLead = (row: CrmLead) => {
    if (row.email) byEmail.set(row.email.trim().toLowerCase(), row);
    if (row.company_domain) byDomain.set(row.company_domain.trim().toLowerCase(), row);
    if (row.github_url) byGithub.set(row.github_url.trim().toLowerCase(), row);
  };
  for (const row of existingLeads) indexLead(row);

  let insertedCount = 0;
  let mergedCount = 0;
  const toPersist: CrmLead[] = [];
  const now = new Date().toISOString();

  const statusRank: Record<CrmLead['email_status'], number> = {
    verified_mx: 4,
    public_found: 3,
    inferred: 2,
    invalid: 1
  };

  for (const inc of incomingLeads) {
    const emailKey = inc.email?.trim().toLowerCase() || '';
    const domainKey = inc.company_domain?.trim().toLowerCase() || '';
    const githubKey = inc.github_url?.trim().toLowerCase() || '';

    const match =
      (emailKey && byEmail.get(emailKey)) ||
      (domainKey && byDomain.get(domainKey)) ||
      (githubKey && byGithub.get(githubKey)) ||
      null;

    if (match) {
      const mergedStack = Array.from(
        new Set([...(match.tech_stack || []), ...(inc.tech_stack || [])])
      ).slice(0, 10);
      const mergedSources = Array.from(
        new Set([...(match.source_urls || []), ...(inc.source_urls || [])])
      ).slice(0, 10);

      const useIncomingEmail =
        Boolean(inc.email) &&
        (!match.email || statusRank[inc.email_status] > statusRank[match.email_status]);

      const merged: CrmLead = {
        ...match,
        contact_name: match.contact_name || inc.contact_name,
        role_title: match.role_title || inc.role_title,
        email: useIncomingEmail ? inc.email : match.email,
        email_status: useIncomingEmail ? inc.email_status : match.email_status,
        company_name: match.company_name || inc.company_name,
        company_domain: match.company_domain || inc.company_domain,
        website_url: match.website_url || inc.website_url,
        github_url: match.github_url || inc.github_url,
        phone: match.phone || inc.phone || '',
        location: match.location || inc.location || '',
        rating: match.rating ?? inc.rating ?? null,
        source_detail: match.source_detail || inc.source_detail || '',
        tech_stack: mergedStack,
        source_urls: mergedSources,
        research_brief:
          match.research_brief && match.research_brief.length >= 80
            ? match.research_brief
            : inc.research_brief || match.research_brief,
        fit_score: Math.max(match.fit_score || 0, inc.fit_score || 0),
        deal_value: Math.max(match.deal_value || 0, inc.deal_value || 0),
        updated_at: now
      };
      toPersist.push(merged);
      indexLead(merged);
      mergedCount++;
    } else {
      toPersist.push(inc);
      indexLead(inc);
      insertedCount++;
    }
  }

  if (isSupabaseConfigured() && toPersist.length > 0) {
    const client = getSupabaseClient(userToken);
    const { error } =
      !userToken && mergedCount === 0
        ? await client.from('crm_leads').insert(toPersist)
        : await client.from('crm_leads').upsert(toPersist, { onConflict: 'id' });
    if (!error) {
      return {
        insertedCount,
        mergedCount,
        leads: userToken ? await listCrmLeads(userToken) : toPersist
      };
    }
    if (!isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const map = new Map<string, CrmLead>();
  for (const existing of db.crm_leads || []) map.set(existing.id, existing);
  for (const row of toPersist) map.set(row.id, row);
  db.crm_leads = Array.from(map.values()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  await writeLocalDb(db);

  return {
    insertedCount,
    mergedCount,
    leads: db.crm_leads
  };
}

export async function deleteCrmLead(id: string, userToken?: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabaseClient(userToken)
      .from('crm_leads')
      .delete()
      .eq('id', id);
    if (!error) return true;
    if (!isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const before = (db.crm_leads || []).length;
  db.crm_leads = (db.crm_leads || []).filter((l) => l.id !== id);
  db.crm_outreach_logs = (db.crm_outreach_logs || []).filter((log) => log.lead_id !== id);
  await writeLocalDb(db);
  return db.crm_leads.length < before;
}

export async function listCrmOutreachLogs(
  leadId?: string,
  userToken?: string
): Promise<CrmOutreachLog[]> {
  if (isSupabaseConfigured()) {
    let query = getSupabaseClient(userToken)
      .from('crm_outreach_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(120);
    if (leadId) query = query.eq('lead_id', leadId);
    const { data, error } = await query;
    if (!error && Array.isArray(data)) return data as CrmOutreachLog[];
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const list = db.crm_outreach_logs || [];
  return (leadId ? list.filter((l) => l.lead_id === leadId) : list).sort(
    (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
  );
}

export async function addCrmOutreachLog(
  log: CrmOutreachLog,
  userToken?: string
): Promise<CrmOutreachLog> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('crm_outreach_logs')
      .insert(log)
      .select()
      .single();
    if (!error && data) return data as CrmOutreachLog;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const list = db.crm_outreach_logs || [];
  list.unshift(log);
  db.crm_outreach_logs = list.slice(0, 300);
  await writeLocalDb(db);
  return log;
}

export async function getCrmOAuthToken(
  userId: string,
  provider: 'lark' = 'lark',
  userToken?: string
): Promise<CrmOAuthTokenRecord | null> {
  const tokenId = `${userId}:${provider}`;
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('crm_oauth_tokens')
      .select('*')
      .eq('id', tokenId)
      .limit(1);
    if (!error && data && data[0]) return data[0] as CrmOAuthTokenRecord;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return (db.crm_oauth_tokens || []).find((t) => t.id === tokenId) || null;
}

export async function upsertCrmOAuthToken(
  record: CrmOAuthTokenRecord,
  userToken?: string
): Promise<CrmOAuthTokenRecord> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('crm_oauth_tokens')
      .upsert(record, { onConflict: 'id' })
      .select()
      .single();
    if (!error && data) return data as CrmOAuthTokenRecord;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const list = db.crm_oauth_tokens || [];
  const idx = list.findIndex((t) => t.id === record.id);
  if (idx >= 0) list[idx] = record;
  else list.unshift(record);
  db.crm_oauth_tokens = list;
  await writeLocalDb(db);
  return record;
}

export async function deleteCrmOAuthToken(
  userId: string,
  provider: 'lark' = 'lark',
  userToken?: string
): Promise<boolean> {
  const tokenId = `${userId}:${provider}`;
  if (isSupabaseConfigured()) {
    const { error } = await getSupabaseClient(userToken)
      .from('crm_oauth_tokens')
      .delete()
      .eq('id', tokenId);
    if (!error) return true;
    if (!isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const before = (db.crm_oauth_tokens || []).length;
  db.crm_oauth_tokens = (db.crm_oauth_tokens || []).filter((t) => t.id !== tokenId);
  await writeLocalDb(db);
  return db.crm_oauth_tokens.length < before;
}

const LEAD_SOURCE_LABELS: Record<LeadSourceType, string> = {
  github: 'GitHub Trending & Repos',
  website: 'Company Website Scraper',
  gemini_search: 'Gemini AI Search',
  apollo: 'Apollo.io API',
  google_maps: 'Google Maps Places',
  hacker_news: 'Hacker News Hiring',
  ycombinator: 'Y Combinator Directory',
  csv_import: 'CSV / JSON Import',
  demo_signup: 'Live Demo Signups',
  manual: 'Manual Entry'
};

export async function listCrmSyncRuns(userToken?: string): Promise<CrmSyncRun[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('crm_sync_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(80);
    if (!error && Array.isArray(data)) return data as CrmSyncRun[];
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return [...(db.crm_sync_runs || [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function addCrmSyncRun(
  run: CrmSyncRun,
  userToken?: string
): Promise<CrmSyncRun> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('crm_sync_runs')
      .insert(run)
      .select()
      .single();
    if (!error && data) return data as CrmSyncRun;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const list = db.crm_sync_runs || [];
  list.unshift(run);
  db.crm_sync_runs = list.slice(0, 150);
  await writeLocalDb(db);
  return run;
}

export async function getCrmSourcesAnalytics(
  userToken?: string
): Promise<CrmSourcesAnalyticsResponse> {
  const [leads, logs, syncRuns] = await Promise.all([
    listCrmLeads(userToken),
    listCrmOutreachLogs(undefined, userToken),
    listCrmSyncRuns(userToken)
  ]);

  const leadSourceById = new Map<string, LeadSourceType>();
  for (const lead of leads) {
    leadSourceById.set(lead.id, lead.source_type);
  }

  const sourceOrder: LeadSourceType[] = [
    'github',
    'apollo',
    'google_maps',
    'hacker_news',
    'ycombinator',
    'website',
    'gemini_search',
    'csv_import',
    'demo_signup',
    'manual'
  ];

  const bySource: SourceBreakdownMetric[] = sourceOrder.map((src) => {
    const matchingLeads = leads.filter((l) => l.source_type === src);
    const matchingRuns = syncRuns.filter((r) => r.source_type === src);
    const leadCount = matchingLeads.length;
    const verifiedMxCount = matchingLeads.filter((l) => l.email_status === 'verified_mx').length;
    const mxRatePercent = leadCount > 0 ? Math.round((verifiedMxCount / leadCount) * 100) : 0;
    const avgFitScore =
      leadCount > 0
        ? Math.round(matchingLeads.reduce((s, l) => s + (Number(l.fit_score) || 0), 0) / leadCount)
        : 0;
    const totalDealValue = matchingLeads
      .filter((l) => l.stage !== 'lost')
      .reduce((s, l) => s + (Number(l.deal_value) || 0), 0);
    const wonCount = matchingLeads.filter((l) => l.stage === 'won').length;
    const outreachSentCount = logs.filter(
      (lg) => lg.status === 'sent' && leadSourceById.get(lg.lead_id) === src
    ).length;

    const latestRunDate = matchingRuns[0]?.created_at || null;
    const latestLeadDate =
      matchingLeads.length > 0
        ? matchingLeads.reduce(
            (latest, l) => (l.created_at > latest ? l.created_at : latest),
            matchingLeads[0].created_at
          )
        : null;
    const lastSyncedAt =
      latestRunDate && latestLeadDate
        ? latestRunDate > latestLeadDate
          ? latestRunDate
          : latestLeadDate
        : latestRunDate || latestLeadDate;

    return {
      source_type: src,
      label: LEAD_SOURCE_LABELS[src],
      leadCount,
      verifiedMxCount,
      mxRatePercent,
      avgFitScore,
      totalDealValue,
      wonCount,
      outreachSentCount,
      lastSyncedAt
    };
  });

  const totalLeads = leads.length;
  const verifiedMxCount = leads.filter((l) => l.email_status === 'verified_mx').length;
  const verifiedMxPercent =
    totalLeads > 0 ? Math.round((verifiedMxCount / totalLeads) * 100) : 0;
  const totalPipelineValue = leads
    .filter((l) => l.stage !== 'lost')
    .reduce((sum, l) => sum + (Number(l.deal_value) || 0), 0);
  const wonDeals = leads.filter((l) => l.stage === 'won').length;
  const activeSourcesCount = bySource.filter((b) => b.leadCount > 0 || b.lastSyncedAt).length;

  return {
    totals: {
      totalLeads,
      verifiedMxCount,
      verifiedMxPercent,
      totalPipelineValue,
      wonDeals,
      activeSourcesCount,
      totalSyncRuns: syncRuns.length
    },
    bySource: bySource.sort((a, b) => b.leadCount - a.leadCount || b.totalDealValue - a.totalDealValue),
    syncRuns: syncRuns.slice(0, 40)
  };
}

// --- Encrypted Server-Side Integrations Vault ---

export async function listIntegrationSecretRows(
  userToken?: string
): Promise<IntegrationSecretRecord[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('crm_integration_secrets')
      .select('*');
    if (!error && Array.isArray(data)) {
      return data as IntegrationSecretRecord[];
    }
    if (error && !isFallbackableDbError(error)) {
      throw new Error(error.message);
    }
  }

  const db = await readLocalDb();
  return [...(db.crm_integration_secrets || [])];
}

export async function getIntegrationSecretRow(
  provider: IntegrationProviderId,
  userToken?: string
): Promise<IntegrationSecretRecord | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('crm_integration_secrets')
      .select('*')
      .eq('provider', provider)
      .limit(1);
    if (!error && data && data[0]) {
      return data[0] as IntegrationSecretRecord;
    }
    if (error && !isFallbackableDbError(error)) {
      throw new Error(error.message);
    }
  }

  const db = await readLocalDb();
  return (db.crm_integration_secrets || []).find((r) => r.provider === provider) || null;
}

export async function upsertIntegrationSecretRow(
  record: IntegrationSecretRecord,
  userToken?: string
): Promise<IntegrationSecretRecord> {
  let savedFromSupabase: IntegrationSecretRecord | null = null;
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('crm_integration_secrets')
      .upsert(record, { onConflict: 'provider' })
      .select()
      .single();
    if (!error && data) {
      savedFromSupabase = data as IntegrationSecretRecord;
    } else if (error && !isFallbackableDbError(error)) {
      throw new Error(error.message);
    }
  }

  // Always mirror lark_smtp locally too so unauthenticated public routes (Demo Signup / Contact / Cron) can resolve encrypted credentials cleanly.
  if (!savedFromSupabase || record.provider === 'lark_smtp') {
    const db = await readLocalDb();
    const list = db.crm_integration_secrets || [];
    const idx = list.findIndex((r) => r.provider === record.provider);
    if (idx >= 0) list[idx] = savedFromSupabase || record;
    else list.push(savedFromSupabase || record);
    db.crm_integration_secrets = list;
    await writeLocalDb(db);
  }
  return savedFromSupabase || record;
}

// --- Customer Demo Users Auth & Telemetry + Unified Inbox Lark Email Logs ---

const DEMO_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function getDemoExpiresAtIso(createdAt: string): string {
  const parsed = new Date(createdAt).getTime();
  const base = Number.isFinite(parsed) ? parsed : Date.now();
  return new Date(base + DEMO_LIFETIME_MS).toISOString();
}

export function isDemoUserExpired(user: Pick<DemoUser, 'created_at'>): boolean {
  const expiresMs = new Date(getDemoExpiresAtIso(user.created_at)).getTime();
  return Date.now() >= expiresMs;
}

export function toPublicDemoUser(user: DemoUser): PublicDemoUser {
  const { password_hash: _ignored, ...rest } = user;
  const expiresAt = getDemoExpiresAtIso(user.created_at);
  return {
    ...rest,
    expires_at: expiresAt,
    is_expired: Date.now() >= new Date(expiresAt).getTime()
  };
}

export function hashDemoPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyDemoPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function issueDemoSessionToken(user: { id: string; email: string }): string {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(
    JSON.stringify({ id: user.id, email: user.email.toLowerCase(), exp, typ: 'demo' })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', LOCAL_TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyDemoSessionToken(token: string): { id: string; email: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', LOCAL_TOKEN_SECRET).update(payload).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      id: string;
      email: string;
      exp: number;
      typ?: string;
    };
    if (parsed.typ !== 'demo' || !parsed.exp || Date.now() > parsed.exp || !parsed.id) return null;
    return { id: parsed.id, email: parsed.email };
  } catch {
    return null;
  }
}

export async function listDemoUsersRaw(userToken?: string): Promise<DemoUser[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('demo_users')
      .select('*')
      .order('last_active_at', { ascending: false })
      .limit(500);
    if (!error && Array.isArray(data)) {
      return data as DemoUser[];
    }
    if (error && !isFallbackableDbError(error)) {
      throw new Error(error.message);
    }
  }

  const db = await readLocalDb();
  return [...(db.demo_users || [])].sort(
    (a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime()
  );
}

export async function findDemoUserByEmail(email: string): Promise<DemoUser | null> {
  const normalized = email.trim().toLowerCase();
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient()
      .from('demo_users')
      .select('*')
      .eq('email', normalized)
      .limit(1);
    if (!error && data && data[0]) return data[0] as DemoUser;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return (db.demo_users || []).find((u) => u.email.toLowerCase() === normalized) || null;
}

export async function findDemoUserById(id: string): Promise<DemoUser | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient()
      .from('demo_users')
      .select('*')
      .eq('id', id)
      .limit(1);
    if (!error && data && data[0]) return data[0] as DemoUser;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return (db.demo_users || []).find((u) => u.id === id) || null;
}

export async function upsertDemoUser(user: DemoUser): Promise<DemoUser> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient()
      .from('demo_users')
      .upsert(user, { onConflict: 'id' })
      .select()
      .single();
    if (!error && data) return data as DemoUser;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const list = db.demo_users || [];
  const idx = list.findIndex((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
  if (idx >= 0) list[idx] = user;
  else list.unshift(user);
  db.demo_users = list;
  await writeLocalDb(db);
  return user;
}

export async function listDemoUsersWithStats(userToken?: string): Promise<{
  users: PublicDemoUser[];
  summary: DemoUsersSummaryStats;
}> {
  const raw = await listDemoUsersRaw(userToken);
  const users = raw.map(toPublicDemoUser);
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const summary: DemoUsersSummaryStats = {
    totalUsers: users.length,
    activeLast7Days: users.filter((u) => new Date(u.last_active_at).getTime() >= sevenDaysAgo).length,
    totalActions: users.reduce((sum, u) => sum + (Number(u.actions_count) || 0), 0),
    totalLogins: users.reduce((sum, u) => sum + (Number(u.login_count) || 0), 0),
    totalConversions: users.reduce((sum, u) => sum + (Number(u.sandbox_conversions) || 0), 0),
    linkedCrmLeads: users.filter((u) => Boolean(u.crm_lead_id)).length
  };
  return { users, summary };
}

export async function listInboxEmailLogs(userToken?: string): Promise<InboxEmailLog[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('inbox_email_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(100);
    if (!error && Array.isArray(data)) {
      return data as InboxEmailLog[];
    }
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return [...(db.inbox_email_logs || [])].sort(
    (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
  );
}

export async function addInboxEmailLog(
  log: InboxEmailLog,
  userToken?: string
): Promise<InboxEmailLog> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('inbox_email_logs')
      .insert(log)
      .select()
      .single();
    if (!error && data) return data as InboxEmailLog;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const list = db.inbox_email_logs || [];
  list.unshift(log);
  db.inbox_email_logs = list.slice(0, 200);
  await writeLocalDb(db);
  return log;
}

// --- Cloudflare Historical Hourly Snapshots & Gemini AI Forecasts ---

export async function upsertCloudflareHourlySnapshots(
  snapshots: CloudflareHourlySnapshot[],
  userToken?: string
): Promise<number> {
  if (snapshots.length === 0) return 0;

  if (isSupabaseConfigured()) {
    const { error } = await getSupabaseClient(userToken)
      .from('cloudflare_hourly_snapshots')
      .upsert(snapshots, { onConflict: 'zone_id,bucket_hour' });
    if (!error) {
      return snapshots.length;
    }
    if (!isFallbackableDbError(error)) {
      throw new Error(error.message);
    }
  }

  const db = await readLocalDb();
  const existing = db.cloudflare_hourly_snapshots || [];
  const byKey = new Map<string, CloudflareHourlySnapshot>();
  for (const row of existing) {
    byKey.set(`${row.zone_id}:${row.bucket_hour}`, row);
  }
  for (const snap of snapshots) {
    byKey.set(`${snap.zone_id}:${snap.bucket_hour}`, snap);
  }
  db.cloudflare_hourly_snapshots = Array.from(byKey.values())
    .sort((a, b) => new Date(b.bucket_hour).getTime() - new Date(a.bucket_hour).getTime())
    .slice(0, 2400);
  await writeLocalDb(db);
  return snapshots.length;
}

export async function listCloudflareHourlySnapshots(
  zoneId: string,
  sinceIso?: string,
  userToken?: string
): Promise<CloudflareHourlySnapshot[]> {
  if (isSupabaseConfigured()) {
    let query = getSupabaseClient(userToken)
      .from('cloudflare_hourly_snapshots')
      .select('*')
      .eq('zone_id', zoneId)
      .order('bucket_hour', { ascending: true })
      .limit(2400);
    if (sinceIso) {
      query = query.gte('bucket_hour', sinceIso);
    }
    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      return data.map((row) => ({
        ...row,
        requests: Number(row.requests) || 0,
        bytes: Number(row.bytes) || 0,
        cached_requests: Number(row.cached_requests) || 0,
        status_1xx: Number(row.status_1xx) || 0,
        status_2xx: Number(row.status_2xx) || 0,
        status_3xx: Number(row.status_3xx) || 0,
        status_4xx: Number(row.status_4xx) || 0,
        status_5xx: Number(row.status_5xx) || 0,
        top_paths: Array.isArray(row.top_paths) ? row.top_paths : [],
        top_countries: Array.isArray(row.top_countries) ? row.top_countries : []
      })) as CloudflareHourlySnapshot[];
    }
    if (error && !isFallbackableDbError(error)) {
      throw new Error(error.message);
    }
  }

  const db = await readLocalDb();
  const sinceMs = sinceIso ? new Date(sinceIso).getTime() : 0;
  return (db.cloudflare_hourly_snapshots || [])
    .filter((s) => s.zone_id === zoneId && (!sinceIso || new Date(s.bucket_hour).getTime() >= sinceMs))
    .sort((a, b) => new Date(a.bucket_hour).getTime() - new Date(b.bucket_hour).getTime());
}

export async function getCloudflareAiForecast(
  zoneId: string,
  userToken?: string
): Promise<CloudflareAiForecast | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('cloudflare_ai_forecasts')
      .select('*')
      .eq('zone_id', zoneId)
      .limit(1);
    if (!error && data && data[0] && data[0].forecast_payload) {
      return data[0].forecast_payload as CloudflareAiForecast;
    }
    if (error && !isFallbackableDbError(error)) {
      throw new Error(error.message);
    }
  }

  const db = await readLocalDb();
  return (db.cloudflare_ai_forecasts || []).find((f) => f.zoneId === zoneId) || null;
}

export async function upsertCloudflareAiForecast(
  forecast: CloudflareAiForecast,
  userToken?: string
): Promise<CloudflareAiForecast> {
  if (isSupabaseConfigured()) {
    const row = {
      zone_id: forecast.zoneId,
      zone_name: forecast.zoneName,
      model_used: forecast.modelUsed,
      horizon_days: forecast.horizonDays,
      range_analyzed: forecast.rangeAnalyzed,
      forecast_payload: forecast,
      generated_at: forecast.generatedAt
    };
    const { error } = await getSupabaseClient(userToken)
      .from('cloudflare_ai_forecasts')
      .upsert(row, { onConflict: 'zone_id' });
    if (!error) return forecast;
    if (!isFallbackableDbError(error)) {
      throw new Error(error.message);
    }
  }

  const db = await readLocalDb();
  const list = db.cloudflare_ai_forecasts || [];
  const idx = list.findIndex((f) => f.zoneId === forecast.zoneId);
  if (idx >= 0) list[idx] = forecast;
  else list.unshift(forecast);
  db.cloudflare_ai_forecasts = list;
  await writeLocalDb(db);
  return forecast;
}

// --- Floating Home Page Website Live Chat ---

export async function findWebsiteChatSessionByToken(
  visitorToken: string
): Promise<WebsiteChatSession | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient()
      .from('website_chat_sessions')
      .select('*')
      .eq('visitor_token', visitorToken)
      .limit(1);
    if (!error && data && data[0]) return data[0] as WebsiteChatSession;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return (db.website_chat_sessions || []).find((s) => s.visitor_token === visitorToken) || null;
}

export async function findWebsiteChatSessionById(
  sessionId: string,
  userToken?: string
): Promise<WebsiteChatSession | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('website_chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .limit(1);
    if (!error && data && data[0]) return data[0] as WebsiteChatSession;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return (db.website_chat_sessions || []).find((s) => s.id === sessionId) || null;
}

export async function upsertWebsiteChatSession(
  session: WebsiteChatSession,
  userToken?: string
): Promise<WebsiteChatSession> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('website_chat_sessions')
      .upsert(session, { onConflict: 'id' })
      .select()
      .single();
    if (!error && data) return data as WebsiteChatSession;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const list = db.website_chat_sessions || [];
  const idx = list.findIndex((s) => s.id === session.id || s.visitor_token === session.visitor_token);
  if (idx >= 0) list[idx] = session;
  else list.unshift(session);
  db.website_chat_sessions = list.slice(0, 300);
  await writeLocalDb(db);
  return session;
}

export async function listWebsiteChatSessions(userToken?: string): Promise<WebsiteChatSession[]> {
  let sessions: WebsiteChatSession[] = [];
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('website_chat_sessions')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(200);
    if (!error && Array.isArray(data)) {
      sessions = data as WebsiteChatSession[];
    } else if (error && !isFallbackableDbError(error)) {
      throw new Error(error.message);
    } else {
      const db = await readLocalDb();
      sessions = [...(db.website_chat_sessions || [])];
    }
  } else {
    const db = await readLocalDb();
    sessions = [...(db.website_chat_sessions || [])];
  }

  return sessions.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export async function listWebsiteChatMessages(
  sessionId: string,
  userToken?: string
): Promise<WebsiteChatMessage[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('website_chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(300);
    if (!error && Array.isArray(data)) {
      return data as WebsiteChatMessage[];
    }
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return (db.website_chat_messages || [])
    .filter((m) => m.session_id === sessionId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export async function listAllWebsiteChatMessages(
  userToken?: string
): Promise<WebsiteChatMessage[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('website_chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(800);
    if (!error && Array.isArray(data)) {
      return data as WebsiteChatMessage[];
    }
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  return [...(db.website_chat_messages || [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function appendWebsiteChatMessage(
  msg: WebsiteChatMessage,
  userToken?: string
): Promise<WebsiteChatMessage> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient(userToken)
      .from('website_chat_messages')
      .insert(msg)
      .select()
      .single();
    if (!error && data) return data as WebsiteChatMessage;
    if (error && !isFallbackableDbError(error)) throw new Error(error.message);
  }

  const db = await readLocalDb();
  const list = db.website_chat_messages || [];
  list.push(msg);
  db.website_chat_messages = list.slice(-1500);
  await writeLocalDb(db);
  return msg;
}





