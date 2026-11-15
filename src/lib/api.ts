import type {
  AdSenseSettings,
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
  ApolloStatusResponse,
  Article,
  ArticleComment,
  ChatMessage,
  ChatThread,
  ChatThreadStatus,
  ClientInquiry,
  CommentStatus,
  CrmLead,
  CrmOutreachLog,
  CrmSourcesAnalyticsResponse,
  CsvImportLeadInput,
  DirectoryUser,
  DiscoveredProspectCandidate,
  GoogleMapsConfigResponse,
  GoogleMapsPlaceCandidate,
  InfrastructureMetricsResponse,
  InquiryStatus,
  LarkConnectionStatus,
  NewsletterSubscriber,
  OpenSourceSyncResult,
  OpenSourceSyncTrack,
  PageContentConfig,
  PageKey,
  RoutingRule,
  SiteAuditReport,
  TaskPriority,
  UserProfile,
  UserRole,
  UserStatus,
  UserWorkflowItem
} from '../shared/types.ts';

const TOKEN_KEY = 'gitstack_studio_token';
const SESSION_ID_KEY = 'gitstack_visitor_sid';

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

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
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
  return data as T;
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
    return request<{ comment: ArticleComment }>('/api/comments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
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
    return request<{ subscriber: NewsletterSubscriber; alreadySubscribed: boolean }>(
      '/api/newsletter',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
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
    return request<{ inquiry: ClientInquiry }>('/api/inquiries', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
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

  async logGmailAgentReport(payload: {
    recipient_email: string;
    subject: string;
    body_text: string;
    provider_message_id: string;
    provider_thread_id?: string;
    status: 'sent' | 'failed' | 'skipped_unconfigured';
    overall_score: number;
    agent_snapshots: AgentSnapshotItem[];
    error_detail?: string;
  }) {
    return request<{ report: AgentEmailReport }>('/api/reports/agent-daily/log', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        channel: 'gmail_api',
        trigger_type: 'manual'
      })
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
      channel: 'lark_mail' | 'gmail_api';
      recipient_email: string;
      subject: string;
      body: string;
      step_number?: number;
      provider_message_id?: string;
      client_error?: string;
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

  async importCsvLeads(rows: CsvImportLeadInput[], fileName?: string) {
    return request<{
      insertedCount: number;
      mergedCount: number;
      mxVerifiedCount: number;
      leads: CrmLead[];
    }>('/api/crm/sources/csv/import', {
      method: 'POST',
      body: JSON.stringify({ rows, fileName })
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
  }
};

