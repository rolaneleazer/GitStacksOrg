import type {
  AdSenseSettings,
  AgentId,
  AgentReport,
  AgentTask,
  AnalyticsEventType,
  AnalyticsSummary,
  Article,
  ArticleComment,
  ChatMessage,
  ChatThread,
  ChatThreadStatus,
  ClientInquiry,
  CommentStatus,
  InquiryStatus,
  NewsletterSubscriber,
  PageContentConfig,
  PageKey,
  SiteAuditReport,
  TaskPriority
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
    const errObj = data as { error?: string; blockingIssues?: string[] };
    const err = new Error(errObj.error || `Request failed (${res.status})`) as Error & {
      blockingIssues?: string[];
      status?: number;
    };
    err.blockingIssues = errObj.blockingIssues;
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export const api = {
  async login(email: string, password: string) {
    const res = await request<{
      token: string;
      editor: { email: string; provider: 'supabase' | 'local' };
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
      editor: { email: string; provider: 'supabase' | 'local' } | null;
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
  }
};
