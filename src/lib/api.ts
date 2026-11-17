import type {
  AdSenseSettings,
  AdminNotificationSettings,
  AgentConversationEntry,
  AgentEmailReport,
  AgentId,
  AgentOfficeProfile,
  AgentReport,
  AgentReportSettings,
  AgentSnapshotItem,
  AgentTask,
  AnalyticsEventType,
  AnalyticsSummary,
  ApolloCandidate,
  ApolloSearchFilters,
  BmcAnalyticsData,
  BmcClickEvent,
  ApolloStatusResponse,
  Article,
  ArticleComment,
  ChatMessage,
  ChatThread,
  ChatThreadStatus,
  ClientInquiry,
  CloudflareAiForecast,
  CloudflareAnalyticsResponse,
  CloudflareHistoryAnalysisResponse,
  CloudflareHistoryRange,
  CloudflareWindowPreset,
  CommentStatus,
  CrmLead,
  CrmOutreachLog,
  CrmSourcesAnalyticsResponse,
  CsvImportLeadInput,
  DemoUsersSummaryStats,
  DirectoryUser,
  DiscoveredProspectCandidate,
  GoogleMapsConfigResponse,
  GoogleMapsPlaceCandidate,
  InboxEmailLog,
  InfrastructureMetricsResponse,
  InquiryStatus,
  IntegrationConfigMeta,
  IntegrationProviderId,
  IntegrationStatusItem,
  LarkConnectionStatus,
  NewsletterSubscriber,
  OfficeLiveHudSummary,
  OpenSourceSyncResult,
  OpenSourceSyncTrack,
  PageContentConfig,
  PageKey,
  ProductQaDashboardResponse,
  ProductQaLog,
  ProductQaReport,
  ProductQaSettings,
  PublicDemoUser,
  QaFeatureCheckItem,
  QaLogStatus,
  RoutingRule,
  SiteAuditReport,
  TaskPriority,
  UserProfile,
  UserRole,
  UserStatus,
  UserWorkflowItem,
  WebsiteChatMessage,
  WebsiteChatSession,
  WebsiteChatStatus,
  WebsiteChatThreadResponse,
  AiSearchVisibilityDashboardResponse,
  AiSearchVisibilityRun,
  AiSearchVisibilitySettings,
  CyberFindingStatus,
  CyberSecurityDashboardResponse,
  CyberSecurityFinding,
  CyberSecurityReport,
  CyberSecuritySettings,
  GtmDashboardResponse,
  GtmEventCategory,
  GtmEventLog,
  GtmSettingsConfig
} from '../shared/types.ts';
import { pushGtmEvent } from './tagManager.ts';

const TOKEN_KEY = 'gitstack_studio_token';
const DEMO_TOKEN_KEY = 'gitstack_demo_token';
const SESSION_ID_KEY = 'gitstack_visitor_sid';
const FLOATING_CHAT_TOKEN_KEY = 'gitstack_floating_chat_token';

export class DemoExpiredError extends Error {
  code = 'DEMO_EXPIRED';
  expiresAt?: string;

  constructor(message: string, expiresAt?: string) {
    super(message);
    this.name = 'DemoExpiredError';
    this.expiresAt = expiresAt;
  }
}

export function getStoredToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      window.sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      window.sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore storage restrictions
  }
}

export function getStoredDemoToken(): string | null {
  try {
    return window.localStorage.getItem(DEMO_TOKEN_KEY) || window.sessionStorage.getItem(DEMO_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredDemoToken(token: string | null): void {
  try {
    if (token) {
      window.localStorage.setItem(DEMO_TOKEN_KEY, token);
      window.sessionStorage.setItem(DEMO_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(DEMO_TOKEN_KEY);
      window.sessionStorage.removeItem(DEMO_TOKEN_KEY);
    }
  } catch {
    // ignore storage restrictions
  }
}

function getVisitorSessionId(): string {
  try {
    let sid = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (!sid) {
      sid = `vis-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(SESSION_ID_KEY, sid);
    }
    return sid;
  } catch {
    return 'vis-anon';
  }
}

export function getRealtimeWsUrl(): string {
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

export function getOrCreateFloatingChatToken(): string {
  try {
    let token = window.localStorage.getItem(FLOATING_CHAT_TOKEN_KEY);
    if (!token) {
      token = `vchat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(FLOATING_CHAT_TOKEN_KEY, token);
    }
    return token;
  } catch {
    return `vchat-anon-${Math.random().toString(36).slice(2, 8)}`;
  }
}

export function getExistingFloatingChatToken(): string | null {
  try {
    return window.localStorage.getItem(FLOATING_CHAT_TOKEN_KEY);
  } catch {
    return null;
  }
}

interface CacheRecord {
  data: unknown;
  timestamp: number;
}

const getCache = new Map<string, CacheRecord>();
const inflightPromises = new Map<string, Promise<unknown>>();
const SWR_TTL_MS = 30_000;

export function invalidateClientApiCache(pattern?: string): void {
  if (!pattern) {
    getCache.clear();
    inflightPromises.clear();
    return;
  }
  for (const key of Array.from(getCache.keys())) {
    if (key.includes(pattern)) {
      getCache.delete(key);
    }
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const token = getStoredToken();
  const isGet = method === 'GET';

  // Invalidate read caches on mutations
  if (!isGet) {
    if (url.includes('/api/posts')) invalidateClientApiCache('/api/posts');
    if (url.includes('/api/comments')) invalidateClientApiCache('/api/comments');
    if (url.includes('/api/adsense')) invalidateClientApiCache('/api/adsense');
    if (url.includes('/api/settings') || url.includes('/api/admin/gtm/settings')) {
      invalidateClientApiCache('/api/settings');
    }
    if (url.includes('/api/pages')) invalidateClientApiCache('/api/pages');
    if (url.includes('/api/crm')) invalidateClientApiCache('/api/crm');
    if (url.includes('/api/inbox')) invalidateClientApiCache('/api/inbox');
    if (url.includes('/api/qa')) invalidateClientApiCache('/api/qa');
    if (url.includes('/api/cyber')) invalidateClientApiCache('/api/cyber');
  }

  // Request deduplication & SWR caching for GET requests
  const cacheKey = `${url}:${token || 'anon'}`;
  if (isGet) {
    const inflight = inflightPromises.get(cacheKey);
    if (inflight) {
      return inflight as Promise<T>;
    }
    const cached = getCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < SWR_TTL_MS) {
      return cached.data as T;
    }
  }

  const executeFetch = async (): Promise<T> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(url, { ...options, headers });
    const text = await res.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text };
    }
    if (!res.ok) {
      const errObj = data as { error?: string; blockingIssues?: string[]; quotaExceeded?: boolean };
      const err = new Error(errObj.error || `Request failed (${res.status})`) as Error & {
        blockingIssues?: string[];
        status?: number;
        quotaExceeded?: boolean;
      };
      err.blockingIssues = errObj.blockingIssues;
      err.status = res.status;
      err.quotaExceeded = errObj.quotaExceeded;
      throw err;
    }

    if (isGet) {
      getCache.set(cacheKey, { data, timestamp: Date.now() });
      if (getCache.size > 100) {
        const oldestKey = getCache.keys().next().value;
        if (oldestKey) getCache.delete(oldestKey);
      }
    }
    return data as T;
  };

  if (isGet) {
    const promise = executeFetch().finally(() => {
      inflightPromises.delete(cacheKey);
    });
    inflightPromises.set(cacheKey, promise);
    return promise;
  }

  return executeFetch();
}

export const api = {
  async login(email: string, password: string) {
    const res = await request<{
      token: string;
      editor: {
        userId: string;
        email: string;
        provider: 'supabase' | 'local';
        role: UserRole;
        profile: UserProfile;
      };
      storageBackend: 'supabase' | 'local-json';
      supabaseUrl: string | null;
      supabaseTablesReady: boolean;
      supabaseAutomationMode: 'db-url' | 'management-api' | 'manual';
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setStoredToken(res.token);
    return res;
  },

  async getSession() {
    return request<{
      authenticated: boolean;
      editor: {
        userId: string;
        email: string;
        provider: 'supabase' | 'local';
        role: UserRole;
        profile: UserProfile;
      } | null;
      storageBackend: 'supabase' | 'local-json';
      supabaseUrl: string | null;
      supabaseTablesReady: boolean;
      supabaseAutomationMode: 'db-url' | 'management-api' | 'manual';
    }>('/api/auth/session');
  },

  async migrateSupabase() {
    return request<{
      executed: boolean;
      mode: 'db-url' | 'management-api' | 'manual';
      message: string;
      supabaseTablesReady: boolean;
      seededPosts: number;
    }>('/api/supabase/migrate', {
      method: 'POST'
    });
  },

  async seedSupabase() {
    return request<{ seededPosts: number }>('/api/supabase/seed', {
      method: 'POST'
    });
  },

  logout() {
    setStoredToken(null);
  },

  async listPosts(includeDrafts = false) {
    const qs = includeDrafts ? '?status=all' : '';
    return request<{ posts: Article[] }>(`/api/posts${qs}`);
  },

  async getPost(slug: string) {
    return request<{ post: Article }>(`/api/posts/${encodeURIComponent(slug)}`);
  },

  async createPost(payload: Partial<Article>) {
    return request<{ post: Article }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updatePost(id: string, payload: Partial<Article>) {
    return request<{ post: Article }>(`/api/posts/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async deletePost(id: string) {
    return request<{ ok: boolean }>(`/api/posts/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },

  async listComments(postId?: string) {
    const qs = postId ? `?postId=${encodeURIComponent(postId)}` : '';
    return request<{ comments: ArticleComment[] }>(`/api/comments${qs}`);
  },

  async submitComment(payload: {
    post_id: string;
    author_name: string;
    author_email: string;
    body: string;
  }) {
    const res = await request<{ comment: ArticleComment }>('/api/comments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    pushGtmEvent('comment_submitted', { post_id: payload.post_id });
    return res;
  },

  async updateCommentStatus(id: string, status: CommentStatus) {
    return request<{ comment: ArticleComment }>(`/api/comments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async subscribeNewsletter(payload: {
    email: string;
    name?: string;
    interest_topic?: string;
    consent_given: boolean;
  }) {
    const res = await request<{ subscriber: NewsletterSubscriber; alreadySubscribed: boolean }>(
      '/api/newsletter',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
    pushGtmEvent(
      'newsletter_subscribed',
      { interest_topic: payload.interest_topic || 'general' },
      { isConversion: true }
    );
    return res;
  },

  async listSubscribers() {
    return request<{ subscribers: NewsletterSubscriber[] }>('/api/newsletter');
  },

  async submitInquiry(payload: {
    full_name: string;
    company: string;
    work_email: string;
    service_interest: string;
    budget_range: string;
    timeline: string;
    project_brief: string;
  }) {
    const res = await request<{ inquiry: ClientInquiry }>('/api/inquiries', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    pushGtmEvent(
      'inquiry_submitted',
      {
        service_interest: payload.service_interest,
        budget_range: payload.budget_range
      },
      { isConversion: true }
    );
    return res;
  },

  async listInquiries() {
    return request<{ inquiries: ClientInquiry[] }>('/api/inquiries');
  },

  async updateInquiryStatus(id: string, status: InquiryStatus) {
    return request<{ inquiry: ClientInquiry }>(`/api/inquiries/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async getAdSenseSettings() {
    return request<{ settings: AdSenseSettings }>('/api/settings/adsense');
  },

  async saveAdSenseSettings(payload: Partial<AdSenseSettings>) {
    return request<{ settings: AdSenseSettings }>('/api/settings/adsense', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async getSiteAudit() {
    return request<{ report: SiteAuditReport }>('/api/audit/adsense');
  },

  // --- Back Office Page Content Customizer ---
  async listPageContents() {
    return request<{ pages: PageContentConfig[] }>('/api/pages');
  },

  async savePageContent(pageKey: PageKey, payload: PageContentConfig) {
    return request<{ page: PageContentConfig }>(`/api/pages/${encodeURIComponent(pageKey)}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  // --- Back Office 7 Agents ---
  async getAgentsOverview() {
    return request<{ agents: AgentReport[]; tasks: AgentTask[] }>('/api/agents/overview');
  },

  async createAgentTask(payload: {
    agent_id: AgentId;
    title: string;
    priority: TaskPriority;
    notes?: string;
  }) {
    return request<{ task: AgentTask }>('/api/agents/tasks', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateAgentTask(id: string, payload: Partial<AgentTask>) {
    return request<{ task: AgentTask }>(`/api/agents/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  async deleteAgentTask(id: string) {
    return request<{ ok: boolean }>(`/api/agents/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },

  // --- Internal Back Office Chat Box ---
  async listChatThreads() {
    return request<{ threads: ChatThread[] }>('/api/chat/threads');
  },

  async createChatThread(payload: {
    subject: string;
    requester_name?: string;
    requester_email?: string;
    initial_body: string;
  }) {
    return request<{ thread: ChatThread; message: ChatMessage }>('/api/chat/threads', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async listChatMessages(threadId: string) {
    return request<{ messages: ChatMessage[] }>(
      `/api/chat/threads/${encodeURIComponent(threadId)}/messages`
    );
  },

  async replyToChatThread(threadId: string, body: string, markAnswered = true) {
    return request<{ message: ChatMessage }>(
      `/api/chat/threads/${encodeURIComponent(threadId)}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ body, mark_answered: markAnswered })
      }
    );
  },

  async updateChatThreadStatus(threadId: string, status: ChatThreadStatus) {
    return request<{ thread: ChatThread }>(`/api/chat/threads/${encodeURIComponent(threadId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  // --- Analytics & GA4 ---
  trackAnalyticsEvent(
    eventType: AnalyticsEventType,
    path: string,
    meta: Record<string, string> = {}
  ) {
    if (path.startsWith('/obama') || path.startsWith('/studio')) return;
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: eventType,
        path,
        referrer: document.referrer || 'direct',
        session_id: getVisitorSessionId(),
        meta
      })
    }).catch(() => {});
  },

  async getAnalyticsSummary(days: 7 | 14 | 30 = 14) {
    return request<{ summary: AnalyticsSummary }>(`/api/analytics/summary?days=${days}`);
  },

  // --- Profile, Team Access, Workflows & Routing ---
  async getMyProfile() {
    return request<{ profile: UserProfile }>('/api/profile/me');
  },

  async updateMyProfile(
    payload: Partial<Pick<UserProfile, 'full_name' | 'job_title' | 'bio' | 'avatar_url' | 'phone' | 'timezone'>>
  ) {
    return request<{ profile: UserProfile }>('/api/profile/me', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async getUserDirectory() {
    return request<{ users: DirectoryUser[] }>('/api/users/directory');
  },

  async listUsers() {
    return request<{ users: UserProfile[] }>('/api/users');
  },

  async createUser(payload: {
    email: string;
    password: string;
    full_name: string;
    role: UserRole;
    job_title?: string;
  }) {
    return request<{ user: UserProfile }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateUser(
    userId: string,
    payload: {
      role?: UserRole;
      status?: UserStatus;
      full_name?: string;
      job_title?: string;
      password?: string;
    }
  ) {
    return request<{ user: UserProfile }>(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  async deleteUser(userId: string) {
    return request<{ ok: boolean }>(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });
  },

  async listWorkflows(userId?: string) {
    const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return request<{ items: UserWorkflowItem[] }>(`/api/workflows${qs}`);
  },

  async createWorkflow(payload: Partial<UserWorkflowItem>) {
    return request<{ item: UserWorkflowItem }>('/api/workflows', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateWorkflow(id: string, payload: Partial<UserWorkflowItem>) {
    return request<{ item: UserWorkflowItem }>(`/api/workflows/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  async deleteWorkflow(id: string) {
    return request<{ ok: boolean }>(`/api/workflows/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },

  async assignInquiry(id: string, assigned_to: string | null) {
    return request<{ inquiry: ClientInquiry }>(`/api/inquiries/${encodeURIComponent(id)}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assigned_to })
    });
  },

  async assignChatThread(id: string, assigned_to: string | null) {
    return request<{ thread: ChatThread }>(`/api/chat/threads/${encodeURIComponent(id)}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assigned_to })
    });
  },

  async listRoutingRules() {
    return request<{ rules: RoutingRule[] }>('/api/routing-rules');
  },

  async saveRoutingRules(rules: RoutingRule[]) {
    return request<{ rules: RoutingRule[] }>('/api/routing-rules', {
      method: 'PUT',
      body: JSON.stringify({ rules })
    });
  },

  async getInfrastructureMetrics() {
    return request<InfrastructureMetricsResponse>('/api/infrastructure/metrics');
  },

  async restartInfrastructureServices() {
    const res = await request<{
      success: boolean;
      message: string;
      connectionsTerminated: number;
      poolsReset: boolean;
      cacheCleared: boolean;
      sampledAt: string;
    }>('/api/infrastructure/restart-services', {
      method: 'POST'
    });
    invalidateClientApiCache();
    return res;
  },

  async auditPageAdSense(payload: {
    url?: string;
    imageBase64?: string;
    mimeType?: string;
  }) {
    return request<any>('/api/audit-page', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async discoverTrends(payload: {
    niche: string;
    country?: string;
    keywords?: string;
  }) {
    return request<{
      topics: Array<{
        id: string;
        title: string;
        searchIntent: 'Informational' | 'Commercial' | 'News';
        opportunity: 'High' | 'Surging' | 'Breakout';
        summary: string;
        sources: { title: string; url: string }[];
        keyAngles: string[];
      }>;
      niche: string;
      country: string;
    }>('/api/discover-trends', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async generateAdSenseArticle(payload: {
    topic: string;
    niche: string;
    country?: string;
    sources?: { title: string; url: string }[];
  }) {
    return request<{
      title: string;
      slug: string;
      summary: string;
      category: string;
      authorName: string;
      tags: string[];
      content: string;
      wordCount: number;
      policyBadge: 'AdSense Policy Safe' | 'Needs Human Attribution';
      policyNotes: string[];
      sources: { title: string; url: string }[];
    }>('/api/generate-article', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getBmcAnalytics() {
    return request<BmcAnalyticsData>('/api/bmc/analytics');
  },

  async trackBmcClick(placement: 'header' | 'footer' | 'floating' | 'other') {
    pushGtmEvent('buy_me_a_coffee_click', { placement }, { isConversion: true });
    return request<{ success: boolean; analytics: BmcAnalyticsData }>('/api/bmc/track-click', {
      method: 'POST',
      body: JSON.stringify({ placement })
    });
  },

  // --- Virtual Office HQ & Daily Agent Email Proof Reports ---
  async getAgentsOffice() {
    return request<{
      profiles: AgentOfficeProfile[];
      conversations: AgentConversationEntry[];
    }>('/api/agents/office');
  },

  async updateAgentOfficeProfile(
    agentId: AgentId,
    payload: Partial<AgentOfficeProfile>
  ) {
    return request<{ profile: AgentOfficeProfile }>(
      `/api/agents/office/${encodeURIComponent(agentId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload)
      }
    );
  },

  async triggerOfficeShift(action: 'all_hands' | 'lounge') {
    return request<{ profiles: AgentOfficeProfile[]; entry: AgentConversationEntry }>(
      '/api/agents/office/shift',
      {
        method: 'POST',
        body: JSON.stringify({ action })
      }
    );
  },

  async sendAgentConversation(payload: {
    agent_id: AgentId;
    peer_agent_id?: AgentId | null;
    message: string;
    sender_type?: 'operator' | 'handoff';
  }) {
    return request<{ entries: AgentConversationEntry[] }>('/api/agents/conversations', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getDailyAgentReports() {
    return request<{
      settings: AgentReportSettings;
      reports: AgentEmailReport[];
      preview: {
        subject: string;
        bodyText: string;
        overallScore: number;
        snapshots: AgentSnapshotItem[];
      };
    }>('/api/reports/agent-daily');
  },

  async saveDailyReportSettings(payload: Partial<AgentReportSettings>) {
    return request<{ settings: AgentReportSettings }>('/api/reports/agent-daily/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async dispatchServerAgentReport() {
    return request<{ report: AgentEmailReport; deliveredViaServer: boolean }>(
      '/api/reports/agent-daily/dispatch',
      { method: 'POST' }
    );
  },

  // --- Lark Open Platform OAuth & Apollo-Style CRM ---
  async getLarkStatus() {
    return request<LarkConnectionStatus>('/api/lark/status');
  },

  async getLarkAuthUrl() {
    return request<{ url: string; redirectUri: string }>('/api/lark/auth-url');
  },

  async disconnectLark() {
    return request<{ ok: boolean }>('/api/lark/disconnect', { method: 'DELETE' });
  },

  async discoverCrmLeads(query: string, mode: 'auto' | 'github' | 'website' = 'auto') {
    return request<{ candidates: DiscoveredProspectCandidate[]; sourcesChecked: string[] }>(
      '/api/crm/discover',
      {
        method: 'POST',
        body: JSON.stringify({ query, mode })
      }
    );
  },

  async listCrmLeads() {
    return request<{ leads: CrmLead[]; logs: CrmOutreachLog[] }>('/api/crm/leads');
  },

  async createCrmLead(payload: Partial<CrmLead>) {
    return request<{ lead: CrmLead }>('/api/crm/leads', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateCrmLead(id: string, payload: Partial<CrmLead>) {
    return request<{ lead: CrmLead }>(`/api/crm/leads/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  async deleteCrmLead(id: string) {
    return request<{ ok: boolean }>(`/api/crm/leads/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },

  async researchCrmLead(id: string) {
    return request<{ lead: CrmLead }>(`/api/crm/leads/${encodeURIComponent(id)}/research`, {
      method: 'POST'
    });
  },

  async sendCrmProposal(
    id: string,
    payload: {
      channel: 'lark_mail';
      recipient_email: string;
      subject: string;
      body: string;
      step_number?: number;
    }
  ) {
    return request<{ lead: CrmLead; log: CrmOutreachLog }>(
      `/api/crm/leads/${encodeURIComponent(id)}/send`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
  },

  async convertCrmLeadToWon(id: string) {
    return request<{
      lead: CrmLead;
      inquiry: ClientInquiry | null;
      workflowItem: UserWorkflowItem | null;
    }>(`/api/crm/leads/${encodeURIComponent(id)}/convert`, {
      method: 'POST'
    });
  },

  async syncOpenSourceLeads(track: OpenSourceSyncTrack = 'all') {
    return request<OpenSourceSyncResult>('/api/crm/sync-opensource', {
      method: 'POST',
      body: JSON.stringify({ track })
    });
  },

  async bulkCrmAction(payload: {
    action: 'research' | 'move_stage' | 'delete';
    leadIds: string[];
    stage?: CrmLead['stage'];
  }) {
    return request<{ processedCount: number; leads: CrmLead[] }>('/api/crm/leads/bulk-action', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getCrmSourcesAnalytics() {
    return request<CrmSourcesAnalyticsResponse>('/api/crm/sources/analytics');
  },

  async getApolloStatus() {
    return request<ApolloStatusResponse>('/api/crm/apollo/status');
  },

  async searchApolloPeople(filters: ApolloSearchFilters) {
    return request<{ candidates: ApolloCandidate[]; totalEntries: number }>('/api/crm/apollo/search', {
      method: 'POST',
      body: JSON.stringify(filters)
    });
  },

  async importApolloLeads(candidates: ApolloCandidate[], queryLabel?: string) {
    return request<{
      insertedCount: number;
      mergedCount: number;
      mxVerifiedCount: number;
      leads: CrmLead[];
    }>('/api/crm/apollo/import', {
      method: 'POST',
      body: JSON.stringify({ candidates, queryLabel })
    });
  },

  async syncHackerNewsLeads(keyword = '') {
    return request<{
      threadTitle: string;
      scannedCount: number;
      insertedCount: number;
      mergedCount: number;
      mxVerifiedCount: number;
      leads: CrmLead[];
    }>('/api/crm/sources/hacker-news/sync', {
      method: 'POST',
      body: JSON.stringify({ keyword })
    });
  },

  async syncYCombinatorLeads(keyword = '') {
    return request<{
      datasetLabel: string;
      scannedCount: number;
      insertedCount: number;
      mergedCount: number;
      mxVerifiedCount: number;
      leads: CrmLead[];
    }>('/api/crm/sources/ycombinator/sync', {
      method: 'POST',
      body: JSON.stringify({ keyword })
    });
  },

  async importCsvLeads(
    rows: CsvImportLeadInput[],
    fileName?: string,
    sourceType: 'csv_import' | 'apollo' = 'csv_import'
  ) {
    return request<{
      insertedCount: number;
      mergedCount: number;
      mxVerifiedCount: number;
      leads: CrmLead[];
    }>('/api/crm/sources/csv/import', {
      method: 'POST',
      body: JSON.stringify({ rows, fileName, sourceType })
    });
  },

  async getGoogleMapsConfig() {
    return request<GoogleMapsConfigResponse>('/api/crm/maps/config');
  },

  async searchGoogleMapsPlaces(query: string, regionCode = '') {
    return request<{ places: GoogleMapsPlaceCandidate[] }>('/api/crm/maps/search', {
      method: 'POST',
      body: JSON.stringify({ query, regionCode })
    });
  },

  async importGoogleMapsPlaces(
    places: GoogleMapsPlaceCandidate[],
    runAnalysis = true,
    searchLabel?: string
  ) {
    return request<{
      importedCount: number;
      insertedCount: number;
      mergedCount: number;
      mxVerifiedCount: number;
      importedLeads: CrmLead[];
      leads: CrmLead[];
    }>('/api/crm/maps/import', {
      method: 'POST',
      body: JSON.stringify({ places, runAnalysis, searchLabel })
    });
  },

  // --- Encrypted Integrations & Connections Vault ---
  async listIntegrations() {
    return request<{ integrations: IntegrationStatusItem[] }>('/api/integrations');
  },

  async saveIntegration(
    provider: IntegrationProviderId,
    payload: {
      secret?: string;
      configMeta?: IntegrationConfigMeta;
      useEnvFallback?: boolean;
      skipVerify?: boolean;
    }
  ) {
    return request<{
      integration: IntegrationStatusItem;
      testResult: { ok: boolean; latencyMs: number; message: string };
    }>(`/api/integrations/${encodeURIComponent(provider)}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async testIntegration(
    provider: IntegrationProviderId,
    payload?: {
      secret?: string;
      configMeta?: IntegrationConfigMeta;
    }
  ) {
    return request<{
      integration: IntegrationStatusItem;
      testResult: { ok: boolean; latencyMs: number; message: string };
    }>(`/api/integrations/${encodeURIComponent(provider)}/test`, {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  },

  async disconnectIntegration(provider: IntegrationProviderId) {
    return request<{ integration: IntegrationStatusItem }>(
      `/api/integrations/${encodeURIComponent(provider)}`,
      { method: 'DELETE' }
    );
  },

  // --- Unified Lark Mail Inbox ---
  async getInboxLarkEmails() {
    return request<{
      lark: {
        connected: boolean;
        email: string;
        senderName: string;
        smtpHost: string;
        smtpPort: number;
      };
      logs: InboxEmailLog[];
    }>('/api/inbox/lark-emails');
  },

  async sendInboxLarkEmail(payload: {
    toEmail: string;
    toName?: string;
    subject: string;
    bodyText: string;
    category?: 'inquiry_reply' | 'direct_compose';
    relatedId?: string;
  }) {
    return request<{ log: InboxEmailLog }>('/api/inbox/send-lark', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // --- Customer Demo Sign Up, Ordinary Login, Telemetry & Admin Stats ---
  async registerDemoUser(payload: {
    full_name: string;
    email: string;
    company: string;
    phone: string;
    password: string;
  }) {
    const res = await fetch('/api/demo/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = (await res.json().catch(() => ({}))) as {
      token?: string;
      user?: PublicDemoUser;
      error?: string;
    };
    if (!res.ok || !data.token || !data.user) {
      throw new Error(data.error || `Registration failed (HTTP ${res.status})`);
    }
    setStoredDemoToken(data.token);
    pushGtmEvent('demo_signup', { company: payload.company }, { isConversion: true });
    return { token: data.token, user: data.user };
  },

  async loginDemoUser(payload: { email: string; password: string }) {
    const res = await fetch('/api/demo/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = (await res.json().catch(() => ({}))) as {
      token?: string;
      user?: PublicDemoUser;
      error?: string;
      code?: string;
      expires_at?: string;
    };
    if (res.status === 403 && data.code === 'DEMO_EXPIRED') {
      setStoredDemoToken(null);
      throw new DemoExpiredError(
        data.error || 'Your 24-hour Live Demo evaluation pass has expired.',
        data.expires_at
      );
    }
    if (!res.ok || !data.token || !data.user) {
      throw new Error(data.error || `Sign in failed (HTTP ${res.status})`);
    }
    setStoredDemoToken(data.token);
    return { token: data.token, user: data.user };
  },

  async getDemoMe() {
    const token = getStoredDemoToken();
    if (!token) return null;
    const res = await fetch('/api/demo/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 403) {
      const data = (await res.json().catch(() => ({}))) as {
        code?: string;
        error?: string;
        expires_at?: string;
      };
      setStoredDemoToken(null);
      if (data.code === 'DEMO_EXPIRED') {
        throw new DemoExpiredError(
          data.error || 'Your 24-hour Live Demo evaluation pass has expired.',
          data.expires_at
        );
      }
      return null;
    }
    if (!res.ok) {
      if (res.status === 401) setStoredDemoToken(null);
      return null;
    }
    const data = (await res.json().catch(() => ({}))) as { user?: PublicDemoUser };
    return data.user || null;
  },

  async trackDemoActivity(payload: {
    module?: string;
    actionLabel?: string;
    convertedInquiry?: boolean;
  }) {
    const token = getStoredDemoToken();
    if (!token) return null;
    const res = await fetch('/api/demo/activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    if (res.status === 403) {
      const data = (await res.json().catch(() => ({}))) as {
        code?: string;
        error?: string;
        expires_at?: string;
      };
      setStoredDemoToken(null);
      if (data.code === 'DEMO_EXPIRED') {
        throw new DemoExpiredError(
          data.error || 'Your 24-hour Live Demo evaluation pass has expired.',
          data.expires_at
        );
      }
      return null;
    }
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { user?: PublicDemoUser };
    return data.user || null;
  },

  async getAdminDemoUsers() {
    return request<{ users: PublicDemoUser[]; summary: DemoUsersSummaryStats }>(
      '/api/admin/demo-users'
    );
  },

  async getCloudflareAnalytics(windowPreset: CloudflareWindowPreset = '24h') {
    return request<CloudflareAnalyticsResponse>(
      `/api/admin/cloudflare/analytics?window=${encodeURIComponent(windowPreset)}`
    );
  },

  async getCloudflareHistory(range: CloudflareHistoryRange = '14d') {
    return request<CloudflareHistoryAnalysisResponse>(
      `/api/admin/cloudflare/history?range=${encodeURIComponent(range)}`
    );
  },

  async syncCloudflareHistory(range: CloudflareHistoryRange = '14d') {
    return request<{
      syncResult: {
        syncedHours: number;
        totalSnapshots: number;
        zoneId: string;
        zoneName: string;
        error?: string;
      };
      analysis: CloudflareHistoryAnalysisResponse;
    }>('/api/admin/cloudflare/history/sync', {
      method: 'POST',
      body: JSON.stringify({ range })
    });
  },

  async generateCloudflareForecast(range: CloudflareHistoryRange = '14d') {
    return request<{
      forecast: CloudflareAiForecast;
      analysis: CloudflareHistoryAnalysisResponse;
    }>('/api/admin/cloudflare/forecast', {
      method: 'POST',
      body: JSON.stringify({ range })
    });
  },

  // --- Live Website Presence & Virtual Office HUD ---
  async sendPublicPresence(pagePath: string) {
    const sid = getVisitorSessionId();
    const width = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const device_type = width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
    const referrer = typeof document !== 'undefined' ? document.referrer || '' : '';
    const res = await fetch('/api/public/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sid, path: pagePath || '/', device_type, referrer })
    });
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as { ok: boolean; activeVisitorsCount: number } | null;
  },

  async sendAdminHeartbeat() {
    return request<{ hud: OfficeLiveHudSummary }>('/api/admin/presence/heartbeat', {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  async getOfficeHud() {
    return request<{ hud: OfficeLiveHudSummary }>('/api/admin/office/hud');
  },

  // --- Floating Home Page Live Chat & Admin Inbox Replies ---
  async getPublicChatSession(visitorToken: string, pagePath = '/') {
    const res = await fetch(
      `/api/public/chat/session?visitor_token=${encodeURIComponent(visitorToken)}&page_path=${encodeURIComponent(pagePath)}`
    );
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || `Failed to load live chat (HTTP ${res.status})`);
    }
    return (await res.json()) as WebsiteChatThreadResponse;
  },

  async updatePublicChatProfile(payload: {
    visitor_token: string;
    visitor_name?: string;
    visitor_email?: string;
    page_path?: string;
  }) {
    const res = await fetch('/api/public/chat/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || `Failed to update visitor profile (HTTP ${res.status})`);
    }
    return (await res.json()) as { session: WebsiteChatSession };
  },

  async sendPublicChatMessage(payload: {
    visitor_token: string;
    visitor_name?: string;
    visitor_email?: string;
    page_path?: string;
    body: string;
  }) {
    const res = await fetch('/api/public/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || `Failed to send message (HTTP ${res.status})`);
    }
    return (await res.json()) as {
      session: WebsiteChatSession;
      message: WebsiteChatMessage;
      adminOnline: boolean;
    };
  },

  async listAdminChatSessions() {
    return request<{
      sessions: WebsiteChatSession[];
      unansweredCount: number;
      adminOnline: boolean;
    }>('/api/admin/chat/sessions');
  },

  async getAdminChatThread(sessionId: string) {
    return request<WebsiteChatThreadResponse>(
      `/api/admin/chat/sessions/${encodeURIComponent(sessionId)}`
    );
  },

  async replyAdminChatSession(sessionId: string, body: string, alsoSendEmail = false) {
    return request<{
      session: WebsiteChatSession;
      message: WebsiteChatMessage;
      emailNotice?: string;
    }>(`/api/admin/chat/sessions/${encodeURIComponent(sessionId)}/reply`, {
      method: 'POST',
      body: JSON.stringify({ body, alsoSendEmail })
    });
  },

  async updateAdminChatStatus(sessionId: string, status: WebsiteChatStatus) {
    return request<{ session: WebsiteChatSession }>(
      `/api/admin/chat/sessions/${encodeURIComponent(sessionId)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status })
      }
    );
  },

  async convertAdminChatToLead(sessionId: string) {
    return request<{ lead: CrmLead; session: WebsiteChatSession }>(
      `/api/admin/chat/sessions/${encodeURIComponent(sessionId)}/convert-lead`,
      {
        method: 'POST',
        body: JSON.stringify({})
      }
    );
  },

  async checkUnansweredChatInquiries() {
    return request<{
      checkedCount: number;
      escalatedCount: number;
      adminOnline: boolean;
      skippedReason?: string;
      escalatedSessionIds: string[];
    }>('/api/admin/chat/check-unanswered', {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  // --- Notification Module & Lark Mail Alert Dispatch ---
  async getAdminNotifications() {
    return request<{
      settings: AdminNotificationSettings;
      resolvedRecipientEmail: string;
      larkConnected: boolean;
      larkSenderEmail: string;
      adminOnline: boolean;
      logs: InboxEmailLog[];
    }>('/api/admin/notifications');
  },

  async saveAdminNotifications(payload: Partial<AdminNotificationSettings>) {
    return request<{
      settings: AdminNotificationSettings;
      resolvedRecipientEmail: string;
      larkConnected: boolean;
      larkSenderEmail: string;
    }>('/api/admin/notifications', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async sendTestAdminNotification(payload?: {
    recipient_email?: string;
    admin_login_url?: string;
  }) {
    return request<{
      delivered: boolean;
      log: InboxEmailLog;
      message: string;
    }>('/api/admin/notifications/test', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  },

  // --- Product QA Monitor, Live Diagnostic Agent & EOD PDF Reports ---
  reportClientQaError(payload: {
    level?: 'error' | 'warn' | 'info';
    source?: 'frontend' | 'backend' | 'api' | 'database' | 'integration';
    module_name?: string;
    page_path?: string;
    code_location?: string;
    error_name?: string;
    message: string;
    stack_trace?: string;
    http_status?: number | null;
    request_method?: string;
    request_path?: string;
  }) {
    const pagePath =
      payload.page_path || (typeof window !== 'undefined' ? window.location.pathname || '/' : '/');
    fetch('/api/public/qa/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        page_path: pagePath,
        session_id: getVisitorSessionId()
      })
    }).catch(() => {});
  },

  async getQaDashboard() {
    return request<ProductQaDashboardResponse>('/api/admin/qa/dashboard');
  },

  async runQaScan() {
    return request<{ analyzedCount: number; dashboard: ProductQaDashboardResponse }>(
      '/api/admin/qa/scan',
      {
        method: 'POST',
        body: JSON.stringify({})
      }
    );
  },

  async simulateQaEvent(preset: 'demo_sandbox' | 'cloudflare_edge' | 'live_chat') {
    return request<{ log: ProductQaLog; dashboard: ProductQaDashboardResponse }>(
      '/api/admin/qa/simulate',
      {
        method: 'POST',
        body: JSON.stringify({ preset })
      }
    );
  },

  async analyzeQaLog(logId: string) {
    return request<{ log: ProductQaLog }>(
      `/api/admin/qa/logs/${encodeURIComponent(logId)}/analyze`,
      {
        method: 'POST',
        body: JSON.stringify({})
      }
    );
  },

  async updateQaLogStatus(logId: string, status: QaLogStatus) {
    return request<{ log: ProductQaLog }>(
      `/api/admin/qa/logs/${encodeURIComponent(logId)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status })
      }
    );
  },

  async saveQaSettings(payload: Partial<ProductQaSettings>) {
    return request<{ settings: ProductQaSettings }>('/api/admin/qa/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async sendQaEodReport(payload?: { recipient_email?: string }) {
    return request<{
      report: ProductQaReport;
      delivered: boolean;
      message: string;
    }>('/api/admin/qa/report/send', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  },

  getQaReportPdfUrl(reportId: string): string {
    const token = getStoredToken() || '';
    return `/api/admin/qa/report/${encodeURIComponent(reportId)}/pdf${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  async acceptQaFeatureBaseline(featureId: string) {
    return request<{ featureChecks: QaFeatureCheckItem[]; settings: ProductQaSettings }>(
      '/api/admin/qa/features/baseline',
      {
        method: 'POST',
        body: JSON.stringify({ feature_id: featureId })
      }
    );
  },

  // --- AI & Search Engine Visibility (GEO / SEO) ---
  async getAiVisibilityDashboard() {
    return request<AiSearchVisibilityDashboardResponse>('/api/admin/ai-visibility/dashboard');
  },

  async runAiVisibilityTest(payload?: { send_email?: boolean; recipient_email?: string }) {
    return request<{
      run: AiSearchVisibilityRun;
      emailDelivered: boolean;
      message: string;
      dashboard: AiSearchVisibilityDashboardResponse;
    }>('/api/admin/ai-visibility/run', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  },

  async applyAiSeoBooster() {
    return request<{
      updatedPages: string[];
      run: AiSearchVisibilityRun;
      message: string;
      dashboard: AiSearchVisibilityDashboardResponse;
    }>('/api/admin/ai-visibility/boost', {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  async saveAiVisibilitySettings(payload: Partial<AiSearchVisibilitySettings>) {
    return request<{ settings: AiSearchVisibilitySettings }>('/api/admin/ai-visibility/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  // --- Cybersecurity & Live AI Sentinel (Aegis) ---
  async getCyberSecurityDashboard() {
    return request<CyberSecurityDashboardResponse>('/api/admin/cybersecurity/dashboard');
  },

  async runCyberSecurityScan() {
    return request<{ dashboard: CyberSecurityDashboardResponse; message: string }>(
      '/api/admin/cybersecurity/scan',
      {
        method: 'POST',
        body: JSON.stringify({})
      }
    );
  },

  async updateCyberFindingStatus(findingId: string, status: CyberFindingStatus) {
    return request<{ finding: CyberSecurityFinding; dashboard: CyberSecurityDashboardResponse }>(
      `/api/admin/cybersecurity/findings/${encodeURIComponent(findingId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status })
      }
    );
  },

  async saveCyberSecuritySettings(payload: Partial<CyberSecuritySettings>) {
    return request<{ settings: CyberSecuritySettings }>('/api/admin/cybersecurity/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async sendCyberSecurityReport(payload?: { recipient_email?: string }) {
    return request<{
      report: CyberSecurityReport;
      delivered: boolean;
      message: string;
      dashboard: CyberSecurityDashboardResponse;
    }>('/api/admin/cybersecurity/report/send', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  },

  getCyberSecurityReportPdfUrl(reportId: string): string {
    const token = getStoredToken() || '';
    return `/api/admin/cybersecurity/report/${encodeURIComponent(reportId)}/pdf${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  // --- Google Tag Manager (GTM) Telemetry, Settings & OAuth Vault ---
  async getGtmDashboard(days: 1 | 7 | 14 | 30 = 7) {
    return request<GtmDashboardResponse>(`/api/admin/gtm/dashboard?days=${days}`);
  },

  async saveGtmSettings(payload: Partial<GtmSettingsConfig>) {
    return request<{ settings: AdSenseSettings; gtmSettings: GtmSettingsConfig }>(
      '/api/admin/gtm/settings',
      {
        method: 'PUT',
        body: JSON.stringify(payload)
      }
    );
  },

  async sendGtmTestEvent(payload?: {
    event_name?: string;
    event_category?: GtmEventCategory;
    is_conversion?: boolean;
    days?: number;
  }) {
    return request<{
      ok: boolean;
      event: GtmEventLog;
      dashboard: GtmDashboardResponse;
    }>('/api/admin/gtm/test-event', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  }
};
