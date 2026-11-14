import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode2,
  FileEdit,
  FileText,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AgentsWorkspace } from '../components/backoffice/AgentsWorkspace.tsx';
import { AnalyticsDashboard } from '../components/backoffice/AnalyticsDashboard.tsx';
import { InboxWorkspace } from '../components/backoffice/InboxWorkspace.tsx';
import { InternalChatBox } from '../components/backoffice/InternalChatBox.tsx';
import { PageEditorPanel } from '../components/backoffice/PageEditorPanel.tsx';
import { MarkdownRenderer } from '../components/MarkdownRenderer.tsx';
import { api } from '../lib/api.ts';
import { applySeoMetadata } from '../lib/seo.ts';
import { buildArticleJsonLd, evaluateArticleQuality, slugify } from '../shared/qualityGate.ts';
import type {
  AdSenseSettings,
  AgentId,
  AgentReport,
  AgentTask,
  AnalyticsSummary,
  Article,
  ArticleComment,
  ArticleFAQ,
  ArticleReference,
  ChatThread,
  ChatThreadStatus,
  ClientInquiry,
  CommentStatus,
  InquiryStatus,
  NewsletterSubscriber,
  PageContentConfig,
  PageKey,
  ServiceCategory,
  SiteAuditReport,
  TaskPriority
} from '../shared/types.ts';

interface StudioPageProps {
  onArticlesChanged: () => void;
  onPagesChanged: () => void;
  onSettingsChanged: (settings: AdSenseSettings) => void;
  onNavigate: (path: string) => void;
}

type StudioTab =
  | 'agents'
  | 'pages'
  | 'inbox'
  | 'chat'
  | 'analytics'
  | 'articles'
  | 'adsense';

const COVER_PRESETS = [
  {
    label: 'Optical Prism (AI & Systems)',
    url: '/src/assets/images/insight_cover_ai_agents_1794645171607.jpg'
  },
  {
    label: 'Isometric ML Pipeline',
    url: '/src/assets/images/ai_ml_pipeline_visual_1794645170877.jpg'
  },
  {
    label: 'Cloud Engineering Desk',
    url: '/src/assets/images/cloud_infra_architecture_1794645172181.jpg'
  },
  {
    label: 'GitStack Architecture Studio',
    url: '/src/assets/images/hero_gitstack_architecture_1794645171609.jpg'
  }
];

function createEmptyDraft(): Partial<Article> {
  return {
    title: '',
    slug: '',
    summary_tldr: '',
    category: 'AI Integration',
    author_name: 'Elena Vance',
    author_role: 'Principal AI Systems Architect, GitStack',
    author_bio:
      'Elena leads AI Integration architecture at GitStack, designing retrieval pipelines and LLM governance layers for regulated enterprises.',
    cover_image: COVER_PRESETS[0].url,
    cover_alt:
      'Geometric optical glass prisms refracting cobalt blue light on a white studio surface',
    meta_title: '',
    meta_description: '',
    primary_keyword: '',
    faqs: [
      { question: '', answer: '' },
      { question: '', answer: '' }
    ],
    references: [
      { title: '', url: '' },
      { title: '', url: '' }
    ],
    content_markdown:
      '## Problem Context and Architecture Scope\n\nDescribe the operational bottleneck and production requirements clearly.\n\n## Core System Design\n\nBreak down data flow, failure modes, and security boundaries.\n\n## Production Verification and Metrics\n\nExplain how engineering teams monitor reliability, latency, and cost in production.',
    status: 'draft'
  };
}

export function StudioPage({
  onArticlesChanged,
  onPagesChanged,
  onSettingsChanged,
  onNavigate
}: StudioPageProps) {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [editorEmail, setEditorEmail] = useState('');
  const [storageBackend, setStorageBackend] = useState<'supabase' | 'local-json'>('local-json');
  const [supabaseUrl, setSupabaseUrl] = useState<string | null>(null);
  const [supabaseTablesReady, setSupabaseTablesReady] = useState(false);
  const [supabaseAutomationMode, setSupabaseAutomationMode] = useState<'db-url' | 'management-api' | 'manual'>('manual');
  const [migratingSupabase, setMigratingSupabase] = useState(false);
  const [seedingSupabase, setSeedingSupabase] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Back Office Navigation & Data State
  const [activeTab, setActiveTab] = useState<StudioTab>('agents');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);

  const [agents, setAgents] = useState<AgentReport[]>([]);
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [pageContents, setPageContents] = useState<PageContentConfig[]>([]);
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [analyticsDays, setAnalyticsDays] = useState<7 | 14 | 30>(14);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);

  const [posts, setPosts] = useState<Article[]>([]);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [inquiries, setInquiries] = useState<ClientInquiry[]>([]);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [auditReport, setAuditReport] = useState<SiteAuditReport | null>(null);
  const [adSenseForm, setAdSenseForm] = useState<AdSenseSettings>({
    adsense_publisher_id: '',
    ads_txt_content: '',
    auto_ads_enabled: false,
    ad_slots_enabled: false,
    editorial_review_note: '',
    ga4_measurement_id: '',
    ga4_enabled: false,
    ga4_track_events: true,
    updated_at: ''
  });

  // Editor state
  const [draft, setDraft] = useState<Partial<Article>>(createEmptyDraft);
  const [previewMode, setPreviewMode] = useState<'write' | 'preview' | 'schema'>('write');
  const [savingPost, setSavingPost] = useState(false);
  const [postMessage, setPostMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [savingAdSense, setSavingAdSense] = useState(false);
  const [adSenseMessage, setAdSenseMessage] = useState<string | null>(null);

  useEffect(() => {
    applySeoMetadata({
      title: 'GitStack Private Back Office',
      description: 'Protected operator workspace for GitStack pages, agents, inbox, chat, and analytics.',
      path: '/obama',
      robots: 'noindex, nofollow'
    });
  }, []);

  const loadWorkspaceData = useCallback(async (daysWindow: 7 | 14 | 30 = analyticsDays) => {
    setLoadingWorkspace(true);
    try {
      const [
        postsRes,
        commentsRes,
        inqRes,
        subRes,
        settingsRes,
        auditRes,
        pagesRes,
        agentsRes,
        chatRes,
        analyticsRes
      ] = await Promise.all([
        api.listPosts(true),
        api.listComments(),
        api.listInquiries(),
        api.listSubscribers(),
        api.getAdSenseSettings(),
        api.getSiteAudit(),
        api.listPageContents(),
        api.getAgentsOverview(),
        api.listChatThreads(),
        api.getAnalyticsSummary(daysWindow)
      ]);
      setPosts(postsRes.posts);
      setComments(commentsRes.comments);
      setInquiries(inqRes.inquiries);
      setSubscribers(subRes.subscribers);
      setAdSenseForm(settingsRes.settings);
      setAuditReport(auditRes.report);
      setPageContents(pagesRes.pages);
      setAgents(agentsRes.agents);
      setAgentTasks(agentsRes.tasks);
      setChatThreads(chatRes.threads);
      setAnalyticsSummary(analyticsRes.summary);
    } catch (err) {
      console.error('Failed loading studio workspace:', err);
    } finally {
      setLoadingWorkspace(false);
    }
  }, [analyticsDays]);

  useEffect(() => {
    api
      .getSession()
      .then((res) => {
        setAuthenticated(res.authenticated);
        setStorageBackend(res.storageBackend);
        setSupabaseUrl(res.supabaseUrl);
        setSupabaseTablesReady(res.supabaseTablesReady);
        setSupabaseAutomationMode(res.supabaseAutomationMode || 'manual');
        if (res.storageBackend === 'local-json') {
          setLoginEmail('admin@gitstack.io');
        }
        if (res.editor) {
          setEditorEmail(res.editor.email);
          loadWorkspaceData(14);
        }
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setCheckingAuth(false));
  }, [loadWorkspaceData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      const res = await api.login(loginEmail, loginPassword);
      setAuthenticated(true);
      setEditorEmail(res.editor.email);
      setStorageBackend(res.storageBackend);
      setSupabaseUrl(res.supabaseUrl);
      setSupabaseTablesReady(res.supabaseTablesReady);
      setSupabaseAutomationMode(res.supabaseAutomationMode || 'manual');
      await loadWorkspaceData(analyticsDays);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    api.logout();
    setAuthenticated(false);
    setEditorEmail('');
  };

  const qualityReport = useMemo(
    () =>
      evaluateArticleQuality({
        title: draft.title || '',
        summary_tldr: draft.summary_tldr || '',
        content_markdown: draft.content_markdown || '',
        author_name: draft.author_name || '',
        author_role: draft.author_role || '',
        author_bio: draft.author_bio || '',
        cover_image: draft.cover_image || '',
        cover_alt: draft.cover_alt || '',
        meta_title: draft.meta_title || draft.title || '',
        meta_description: draft.meta_description || '',
        primary_keyword: draft.primary_keyword || '',
        faqs: (draft.faqs || []) as ArticleFAQ[],
        references: (draft.references || []) as ArticleReference[]
      }),
    [draft]
  );

  const handleSaveArticle = async (targetStatus: 'draft' | 'published') => {
    setPostMessage(null);
    if (!draft.title?.trim()) {
      setPostMessage({ type: 'err', text: 'Article title is required.' });
      return;
    }
    if (targetStatus === 'published' && !qualityReport.publishEligible) {
      setPostMessage({
        type: 'err',
        text: 'Publish blocked by AdSense Quality Gatekeeper. Resolve required checks on the right.'
      });
      return;
    }

    setSavingPost(true);
    try {
      const payload: Partial<Article> = {
        ...draft,
        slug: draft.slug?.trim() || slugify(draft.title),
        meta_title: draft.meta_title?.trim() || draft.title,
        status: targetStatus
      };
      const res = draft.id
        ? await api.updatePost(draft.id, payload)
        : await api.createPost(payload);
      setDraft(res.post);
      setPostMessage({
        type: 'ok',
        text:
          targetStatus === 'published'
            ? 'Article published! Sitemap, llms.txt, and JSON-LD endpoints updated.'
            : 'Draft saved.'
      });
      await loadWorkspaceData(analyticsDays);
      onArticlesChanged();
    } catch (err) {
      setPostMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to save article.'
      });
    } finally {
      setSavingPost(false);
    }
  };

  const handleDeleteArticle = async (id: string) => {
    try {
      await api.deletePost(id);
      if (draft.id === id) setDraft(createEmptyDraft());
      await loadWorkspaceData(analyticsDays);
      onArticlesChanged();
    } catch (err) {
      setPostMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to delete article.'
      });
    }
  };

  const handleSaveAdSense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAdSense(true);
    setAdSenseMessage(null);
    try {
      const res = await api.saveAdSenseSettings(adSenseForm);
      setAdSenseForm(res.settings);
      onSettingsChanged(res.settings);
      const [auditRes, agentsRes] = await Promise.all([
        api.getSiteAudit(),
        api.getAgentsOverview()
      ]);
      setAuditReport(auditRes.report);
      setAgents(agentsRes.agents);
      setAdSenseMessage('AdSense settings & live /ads.txt saved successfully.');
    } catch (err) {
      setAdSenseMessage(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSavingAdSense(false);
    }
  };

  const handleSaveGa4Settings = async (patch: {
    ga4_measurement_id: string;
    ga4_enabled: boolean;
    ga4_track_events: boolean;
  }) => {
    const res = await api.saveAdSenseSettings({
      ...adSenseForm,
      ...patch
    });
    setAdSenseForm(res.settings);
    onSettingsChanged(res.settings);
    const agentsRes = await api.getAgentsOverview();
    setAgents(agentsRes.agents);
  };

  const handleChangeAnalyticsDays = async (nextDays: 7 | 14 | 30) => {
    setAnalyticsDays(nextDays);
    const res = await api.getAnalyticsSummary(nextDays);
    setAnalyticsSummary(res.summary);
  };

  const handleSavePageContent = async (pageKey: PageKey, config: PageContentConfig) => {
    const res = await api.savePageContent(pageKey, config);
    setPageContents((prev) => {
      const exists = prev.some((p) => p.page_key === pageKey);
      return exists ? prev.map((p) => (p.page_key === pageKey ? res.page : p)) : [...prev, res.page];
    });
    onPagesChanged();
    const agentsRes = await api.getAgentsOverview();
    setAgents(agentsRes.agents);
  };

  const handleCreateAgentTask = async (payload: {
    agent_id: AgentId;
    title: string;
    priority: TaskPriority;
    notes?: string;
  }) => {
    const res = await api.createAgentTask(payload);
    setAgentTasks((prev) => [res.task, ...prev]);
  };

  const handleToggleAgentTask = async (task: AgentTask) => {
    const res = await api.updateAgentTask(task.id, { completed: !task.completed });
    setAgentTasks((prev) => prev.map((t) => (t.id === task.id ? res.task : t)));
  };

  const handleDeleteAgentTask = async (id: string) => {
    await api.deleteAgentTask(id);
    setAgentTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLoadChatMessages = useCallback(async (threadId: string) => {
    const res = await api.listChatMessages(threadId);
    return res.messages;
  }, []);

  const handleCreateChatThread = async (payload: {
    subject: string;
    requester_name?: string;
    requester_email?: string;
    initial_body: string;
  }) => {
    const res = await api.createChatThread(payload);
    setChatThreads((prev) => [res.thread, ...prev]);
    return res.thread;
  };

  const handleSendChatReply = async (threadId: string, body: string, markAnswered = true) => {
    const res = await api.replyToChatThread(threadId, body, markAnswered);
    if (markAnswered) {
      setChatThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? { ...t, status: 'answered', last_message_at: new Date().toISOString() }
            : t
        )
      );
    }
    return res.message;
  };

  const handleUpdateChatStatus = async (threadId: string, status: ChatThreadStatus) => {
    const res = await api.updateChatThreadStatus(threadId, status);
    setChatThreads((prev) => prev.map((t) => (t.id === threadId ? res.thread : t)));
  };

  const handleJumpToSection = (section: string) => {
    const validTabs: StudioTab[] = [
      'agents',
      'pages',
      'inbox',
      'chat',
      'analytics',
      'articles',
      'adsense'
    ];
    if (validTabs.includes(section as StudioTab)) {
      setActiveTab(section as StudioTab);
    }
  };

  const handleDownloadSchema = async () => {
    try {
      const res = await fetch('/api/supabase-schema');
      const sql = await res.text();
      const blob = new Blob([sql], { type: 'text/sql' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gitstack-supabase-schema.sql';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const handleExportSubscribersCsv = () => {
    const header = 'Name,Email,Interest Topic,Consent,Subscribed At\n';
    const rows = subscribers
      .map(
        (s) =>
          `"${(s.name || '').replace(/"/g, '""')}","${s.email}","${s.interest_topic.replace(/"/g, '""')}",${s.consent_given},"${s.created_at}"`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gitstack-newsletter-subscribers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (checkingAuth) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center text-sm text-slate-600">
        Verifying Back Office session...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 lg:py-24">
        <div className="rounded-xl border border-slate-200 bg-white p-8">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1E40AF]">
            <Lock className="h-4 w-4" />
            <span>Private Operator Access Only</span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold text-slate-900">
            GitStack Back Office
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Sign in with your Supabase Email/Password credentials (no Google Sign-In) to manage
            all 7 operational agents, public page content, Gmail &amp; lead inbox, internal chat,
            and Google Analytics.
          </p>

          {storageBackend === 'supabase' ? (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-slate-700">
              <div className="font-semibold text-slate-900">Supabase Project Connected</div>
              <p className="mt-1 font-mono text-[11px] text-slate-600 break-all">{supabaseUrl}</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
                Use the Email &amp; Password user configured in your Supabase Dashboard under{' '}
                <strong>Authentication → Users</strong>.
                {!supabaseTablesReady &&
                  ' Note: Run supabase/schema.sql in your Supabase SQL Editor to activate PostgreSQL tables.'}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
              <div className="font-semibold text-slate-900">Preview Operator Credentials</div>
              <p className="mt-1 font-mono">
                Email: admin@gitstack.io
                <br />
                Password: gitstack-studio-2026
              </p>
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label htmlFor="studio-email" className="block text-xs font-semibold text-slate-700">
                Operator Email
              </label>
              <input
                id="studio-email"
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#1E40AF] focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="studio-pass" className="block text-xs font-semibold text-slate-700">
                Password
              </label>
              <input
                id="studio-pass"
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter password"
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#1E40AF] focus:bg-white focus:outline-none"
              />
            </div>
            {loginError && <p className="text-xs font-medium text-red-700">{loginError}</p>}
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full rounded-lg bg-[#1E40AF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60"
            >
              {loggingIn ? 'Signing in...' : 'Sign In to Back Office'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const navItems: {
    id: StudioTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }[] = [
    { id: 'agents', label: 'Overview & 7 Agents', icon: Bot, count: agents.length || 7 },
    { id: 'pages', label: 'Page Content Editor', icon: FileEdit },
    { id: 'inbox', label: 'Gmail & Lead Inbox', icon: Mail, count: inquiries.length },
    {
      id: 'chat',
      label: 'Live Q&A Chat Box',
      icon: MessageSquare,
      count: chatThreads.filter((t) => t.status === 'open').length
    },
    { id: 'analytics', label: 'Google Analytics', icon: BarChart3 },
    { id: 'articles', label: 'Articles & Gatekeeper', icon: FileText, count: posts.length },
    { id: 'adsense', label: 'AdSense & Supabase', icon: ShieldCheck }
  ];

  const activeNav = navItems.find((n) => n.id === activeTab)!;

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-8">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Mobile Sidebar Toggle */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="text-xs font-bold text-slate-900">
            Back Office · {activeNav.label}
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen((p) => !p)}
            aria-label="Toggle Back Office Navigation"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-700"
          >
            {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* 260px Left Sidebar Navigation */}
        <aside
          className={`${
            mobileNavOpen ? 'block' : 'hidden'
          } lg:block w-full lg:w-[260px] shrink-0`}
        >
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 lg:sticky lg:top-24">
            <div className="border-b border-slate-200 pb-3">
              <div className="text-[11px] font-semibold text-[#1E40AF]">
                GitStack Operator Suite
              </div>
              <div className="mt-0.5 font-display text-base font-bold text-slate-900">
                Private Back Office
              </div>
              <div className="mt-1 text-[11px] text-slate-500 truncate">{editorEmail}</div>
            </div>

            <nav aria-label="Back Office Sections" className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors text-left ${
                      active
                        ? 'bg-[#1E40AF] text-white'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {typeof item.count === 'number' && (
                      <span
                        className={`font-mono text-[11px] tabular-nums shrink-0 ${
                          active ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-slate-200 pt-3 space-y-2 text-[11px] text-slate-500">
              <div className="flex items-center justify-between">
                <span>Store</span>
                <span className="font-mono text-slate-700">{storageBackend}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Workspace Canvas */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Breadcrumb Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4">
            <div>
              <div className="text-[11px] font-medium text-slate-500">
                GitStack Back Office / <span className="text-[#1E40AF]">{activeNav.label}</span>
              </div>
              <h1 className="mt-0.5 font-display text-xl font-bold text-slate-900">
                {activeNav.label}
              </h1>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>AdSense Readiness:</span>
              <span className="font-mono font-bold text-[#16A34A] tabular-nums">
                {auditReport ? `${auditReport.passedCount}/${auditReport.totalChecks}` : '—'}
              </span>
            </div>
          </div>

          {/* PANEL 1: OVERVIEW & 7 DETERMINISTIC AGENTS */}
          {activeTab === 'agents' && (
            <AgentsWorkspace
              agents={agents}
              tasks={agentTasks}
              loading={loadingWorkspace}
              onRefresh={() => loadWorkspaceData(analyticsDays)}
              onJumpToSection={handleJumpToSection}
              onCreateTask={handleCreateAgentTask}
              onToggleTask={handleToggleAgentTask}
              onDeleteTask={handleDeleteAgentTask}
            />
          )}

          {/* PANEL 2: PAGE CONTENT & MEDIA CUSTOMIZER */}
          {activeTab === 'pages' && (
            <PageEditorPanel
              key={pageContents.map((p) => p.updated_at).join('|') || 'pages-default'}
              pages={pageContents}
              onSavePage={handleSavePageContent}
              onPreviewRoute={onNavigate}
            />
          )}

          {/* PANEL 3: GMAIL & LEAD INBOX */}
          {activeTab === 'inbox' && (
            <InboxWorkspace
              inquiries={inquiries}
              comments={comments}
              subscribers={subscribers}
              onUpdateInquiryStatus={async (id, status) => {
                await api.updateInquiryStatus(id, status);
                setInquiries((prev) =>
                  prev.map((row) => (row.id === id ? { ...row, status } : row))
                );
              }}
              onUpdateCommentStatus={async (id, status) => {
                await api.updateCommentStatus(id, status);
                setComments((prev) =>
                  prev.map((row) => (row.id === id ? { ...row, status } : row))
                );
              }}
              onExportSubscribersCsv={handleExportSubscribersCsv}
            />
          )}

          {/* PANEL 4: INTERNAL CHAT BOX & HISTORICAL Q&A */}
          {activeTab === 'chat' && (
            <InternalChatBox
              threads={chatThreads}
              onLoadMessages={handleLoadChatMessages}
              onCreateThread={handleCreateChatThread}
              onSendReply={handleSendChatReply}
              onUpdateStatus={handleUpdateChatStatus}
            />
          )}

          {/* PANEL 5: GOOGLE ANALYTICS SETTINGS & DASHBOARD */}
          {activeTab === 'analytics' && (
            <AnalyticsDashboard
              key={adSenseForm.updated_at || 'ga4'}
              settings={adSenseForm}
              summary={analyticsSummary}
              days={analyticsDays}
              onChangeDays={handleChangeAnalyticsDays}
              onSaveGa4Settings={handleSaveGa4Settings}
            />
          )}

          {/* PANEL 6: ARTICLES & PRE-PUBLISH QUALITY GATEKEEPER */}
          {activeTab === 'articles' && (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-8">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-sm font-bold text-slate-900">
                      Managed Engineering Guides ({posts.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(createEmptyDraft());
                        setPostMessage(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E40AF] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>New Guide</span>
                    </button>
                  </div>

                  <div className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
                    {posts.map((p) => (
                      <div
                        key={p.id}
                        className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              setDraft(p);
                              setPostMessage(null);
                            }}
                            className="text-left font-medium text-sm text-slate-900 hover:text-[#1E40AF] truncate block max-w-lg"
                          >
                            {p.title}
                          </button>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span
                              className={
                                p.status === 'published'
                                  ? 'font-semibold text-[#16A34A]'
                                  : 'font-semibold text-amber-700'
                              }
                            >
                              {p.status === 'published' ? 'Published' : 'Draft'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{p.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{p.word_count} words</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">Quality {p.quality_score}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {p.status === 'published' && (
                            <button
                              type="button"
                              onClick={() => onNavigate(`/insights/${p.slug}`)}
                              className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              View
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setDraft(p);
                              setPostMessage(null);
                            }}
                            className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${p.title}`}
                            onClick={() => handleDeleteArticle(p.id)}
                            className="rounded border border-slate-200 p-1 text-slate-500 hover:border-red-200 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Editor Form */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      {draft.id ? 'Edit Engineering Guide' : 'Draft New Engineering Guide'}
                    </h2>
                    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => setPreviewMode('write')}
                        className={`rounded-md px-3 py-1 text-xs font-medium ${
                          previewMode === 'write'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        Editor
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewMode('preview')}
                        className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium ${
                          previewMode === 'preview'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        <Eye className="h-3 w-3" />
                        <span>Preview</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewMode('schema')}
                        className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium ${
                          previewMode === 'schema'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        <FileCode2 className="h-3 w-3" />
                        <span>GEO / JSON-LD</span>
                      </button>
                    </div>
                  </div>

                  {previewMode === 'write' && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-700">
                            Article Title
                          </label>
                          <input
                            type="text"
                            value={draft.title || ''}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                title: e.target.value,
                                slug: d.id ? d.slug : slugify(e.target.value)
                              }))
                            }
                            placeholder="e.g., Implementing Deterministic Guardrails for Enterprise AI Agents"
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-[#1E40AF] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">
                            URL Slug
                          </label>
                          <input
                            type="text"
                            value={draft.slug || ''}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, slug: slugify(e.target.value) }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 font-mono px-3 py-2 text-xs text-slate-800 focus:border-[#1E40AF] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">
                            Category
                          </label>
                          <select
                            value={draft.category || 'AI Integration'}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                category: e.target.value as ServiceCategory
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#1E40AF] focus:outline-none"
                          >
                            <option value="AI Integration">AI Integration</option>
                            <option value="ML Automation">ML Automation</option>
                            <option value="Cloud Infrastructure">Cloud Infrastructure</option>
                            <option value="Custom Software">Custom Software</option>
                            <option value="Technical Consulting">Technical Consulting</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs">
                          <label className="font-semibold text-slate-700">
                            Executive Answer Summary (LLM / GEO Citation Block)
                          </label>
                          <span className="font-mono text-slate-500 tabular-nums">
                            {(draft.summary_tldr || '').length} / 110–340 chars
                          </span>
                        </div>
                        <textarea
                          rows={2}
                          value={draft.summary_tldr || ''}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, summary_tldr: e.target.value }))
                          }
                          placeholder="Concise 2-sentence factual summary that ChatGPT, Gemini, and Perplexity can quote directly..."
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-[#1E40AF] focus:outline-none"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs">
                          <label className="font-semibold text-slate-700">
                            Article Body (Markdown — Use ## H2 sections, tables, and code blocks)
                          </label>
                          <span className="font-mono text-slate-500 tabular-nums">
                            {qualityReport.wordCount} / 800+ words required
                          </span>
                        </div>
                        <textarea
                          rows={14}
                          value={draft.content_markdown || ''}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, content_markdown: e.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 font-mono px-3.5 py-3 text-xs leading-relaxed text-slate-900 focus:border-[#1E40AF] focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2">
                        <div>
                          <div className="flex justify-between text-xs">
                            <label className="font-semibold text-slate-700">Meta Title</label>
                            <span className="font-mono text-slate-500 tabular-nums">
                              {(draft.meta_title || '').length}/68
                            </span>
                          </div>
                          <input
                            type="text"
                            value={draft.meta_title || ''}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, meta_title: e.target.value }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#1E40AF] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">
                            Primary Target Keyword
                          </label>
                          <input
                            type="text"
                            value={draft.primary_keyword || ''}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, primary_keyword: e.target.value }))
                            }
                            placeholder="e.g., enterprise RAG pipelines"
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#1E40AF] focus:outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <div className="flex justify-between text-xs">
                            <label className="font-semibold text-slate-700">
                              Meta Description
                            </label>
                            <span className="font-mono text-slate-500 tabular-nums">
                              {(draft.meta_description || '').length}/115–165
                            </span>
                          </div>
                          <textarea
                            rows={2}
                            value={draft.meta_description || ''}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, meta_description: e.target.value }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#1E40AF] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">
                            Author Name
                          </label>
                          <input
                            type="text"
                            value={draft.author_name || ''}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, author_name: e.target.value }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">
                            Author Role
                          </label>
                          <input
                            type="text"
                            value={draft.author_role || ''}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, author_role: e.target.value }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-700">
                            Author Credentials Bio (E-E-A-T)
                          </label>
                          <input
                            type="text"
                            value={draft.author_bio || ''}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, author_bio: e.target.value }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">
                            Cover Image
                          </label>
                          <select
                            value={draft.cover_image || COVER_PRESETS[0].url}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, cover_image: e.target.value }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                          >
                            {COVER_PRESETS.map((c) => (
                              <option key={c.url} value={c.url}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">
                            Image Alt Description
                          </label>
                          <input
                            type="text"
                            value={draft.cover_alt || ''}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, cover_alt: e.target.value }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                          />
                        </div>
                      </div>

                      <div className="space-y-4 border-t border-slate-200 pt-5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-semibold text-slate-900">
                            Structured FAQs for AI Search (Min 2 pairs)
                          </h3>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((d) => ({
                                ...d,
                                faqs: [...(d.faqs || []), { question: '', answer: '' }]
                              }))
                            }
                            className="text-xs font-semibold text-[#1E40AF] hover:underline"
                          >
                            + Add FAQ
                          </button>
                        </div>
                        {(draft.faqs || []).map((faq, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
                          >
                            <input
                              type="text"
                              value={faq.question}
                              onChange={(e) => {
                                const next = [...(draft.faqs || [])];
                                next[idx] = { ...next[idx], question: e.target.value };
                                setDraft((d) => ({ ...d, faqs: next }));
                              }}
                              placeholder={`Question ${idx + 1}`}
                              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900"
                            />
                            <textarea
                              rows={2}
                              value={faq.answer}
                              onChange={(e) => {
                                const next = [...(draft.faqs || [])];
                                next[idx] = { ...next[idx], answer: e.target.value };
                                setDraft((d) => ({ ...d, faqs: next }));
                              }}
                              placeholder="Direct, authoritative answer (30+ chars)..."
                              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3 border-t border-slate-200 pt-5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-semibold text-slate-900">
                            Primary Source Citations (Min 2 HTTPS links)
                          </h3>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((d) => ({
                                ...d,
                                references: [...(d.references || []), { title: '', url: '' }]
                              }))
                            }
                            className="text-xs font-semibold text-[#1E40AF] hover:underline"
                          >
                            + Add Source
                          </button>
                        </div>
                        {(draft.references || []).map((ref, idx) => (
                          <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <input
                              type="text"
                              value={ref.title}
                              onChange={(e) => {
                                const next = [...(draft.references || [])];
                                next[idx] = { ...next[idx], title: e.target.value };
                                setDraft((d) => ({ ...d, references: next }));
                              }}
                              placeholder="Source Title (e.g., NIST AI RMF)"
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900"
                            />
                            <input
                              type="url"
                              value={ref.url}
                              onChange={(e) => {
                                const next = [...(draft.references || [])];
                                next[idx] = { ...next[idx], url: e.target.value };
                                setDraft((d) => ({ ...d, references: next }));
                              }}
                              placeholder="https://..."
                              className="rounded-lg border border-slate-200 font-mono px-3 py-1.5 text-xs text-slate-900"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {previewMode === 'preview' && (
                    <div className="py-2">
                      <h2 className="font-display text-2xl font-bold text-slate-900">
                        {draft.title || 'Untitled Draft'}
                      </h2>
                      <p className="mt-2 text-sm text-slate-600">{draft.summary_tldr}</p>
                      <div className="mt-6 border-t border-slate-200 pt-6">
                        <MarkdownRenderer markdown={draft.content_markdown || ''} />
                      </div>
                    </div>
                  )}

                  {previewMode === 'schema' && (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-600">
                        Live Schema.org JSON-LD injected into the document head for Google, ChatGPT,
                        Gemini, and Perplexity crawlers:
                      </p>
                      <pre className="max-h-[480px] overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-100">
                        {JSON.stringify(
                          buildArticleJsonLd(
                            {
                              id: draft.id || 'preview',
                              slug: draft.slug || slugify(draft.title || 'preview'),
                              title: draft.title || 'Preview',
                              summary_tldr: draft.summary_tldr || '',
                              content_markdown: draft.content_markdown || '',
                              category: (draft.category as ServiceCategory) || 'AI Integration',
                              author_name: draft.author_name || '',
                              author_role: draft.author_role || '',
                              author_bio: draft.author_bio || '',
                              cover_image: draft.cover_image || '',
                              cover_alt: draft.cover_alt || '',
                              meta_title: draft.meta_title || '',
                              meta_description: draft.meta_description || '',
                              primary_keyword: draft.primary_keyword || '',
                              faqs: (draft.faqs || []) as ArticleFAQ[],
                              references: (draft.references || []) as ArticleReference[],
                              word_count: qualityReport.wordCount,
                              read_time_minutes: qualityReport.readTimeMinutes,
                              quality_score: qualityReport.qualityScore,
                              geo_score: qualityReport.geoScore,
                              status: 'published',
                              published_at: new Date().toISOString(),
                              updated_at: new Date().toISOString(),
                              created_at: new Date().toISOString()
                            },
                            window.location.origin
                          ),
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}

                  {postMessage && (
                    <div
                      className={`rounded-lg border px-4 py-3 text-xs font-medium ${
                        postMessage.type === 'ok'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-red-200 bg-red-50 text-red-800'
                      }`}
                    >
                      {postMessage.text}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
                    <button
                      type="button"
                      disabled={savingPost}
                      onClick={() => handleSaveArticle('draft')}
                      className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Save as Draft
                    </button>
                    <button
                      type="button"
                      disabled={savingPost || !qualityReport.publishEligible}
                      onClick={() => handleSaveArticle('published')}
                      className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {qualityReport.publishEligible
                        ? 'Publish Live (Gatekeeper Cleared)'
                        : `Publish Locked (${qualityReport.blockingIssues.length} checks pending)`}
                    </button>
                  </div>
                </div>
              </div>

              <aside className="lg:col-span-4 space-y-6">
                <div className="sticky top-24 rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#1E40AF]">
                    <ShieldCheck className="h-4 w-4" />
                    <span>AdSense Quality &amp; GEO Gatekeeper</span>
                  </div>
                  <h3 className="mt-1.5 font-display text-base font-bold text-slate-900">
                    {qualityReport.publishEligible
                      ? 'Cleared for Publication'
                      : 'Action Required Before Publishing'}
                  </h3>

                  <div className="mt-4 grid grid-cols-3 gap-3 border-y border-slate-200 py-3 text-center">
                    <div>
                      <div className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                        {qualityReport.wordCount}
                      </div>
                      <div className="text-[11px] text-slate-500">Words</div>
                    </div>
                    <div>
                      <div className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                        {qualityReport.qualityScore}%
                      </div>
                      <div className="text-[11px] text-slate-500">AdSense Gate</div>
                    </div>
                    <div>
                      <div className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                        {qualityReport.geoScore}%
                      </div>
                      <div className="text-[11px] text-slate-500">AI Search</div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3 max-h-[540px] overflow-y-auto pr-1">
                    {qualityReport.checks.map((check) => (
                      <div
                        key={check.id}
                        className={`rounded-lg border p-3 text-xs ${
                          check.passed
                            ? 'border-slate-200 bg-slate-50/70'
                            : 'border-amber-200 bg-amber-50/70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-slate-900">{check.label}</span>
                          {check.passed ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
                          )}
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                          {check.pillar} · {check.measuredValue} (target: {check.targetValue})
                        </div>
                        {!check.passed && (
                          <p className="mt-1.5 text-[11px] leading-relaxed text-amber-900">
                            {check.remediation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          )}

          {/* PANEL 7: ADSENSE READINESS AUDIT, ADS.TXT & SUPABASE SCHEMA */}
          {activeTab === 'adsense' && (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-7">
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-display text-lg font-bold text-slate-900">
                        Google AdSense Policy Readiness Audit
                      </h2>
                      <p className="mt-1 text-xs text-slate-600">
                        Automated inspection of thin-content thresholds, E-E-A-T signals, legal
                        pages, and crawler endpoints.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => api.getSiteAudit().then((r) => setAuditReport(r.report))}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Re-Scan</span>
                    </button>
                  </div>

                  {auditReport && (
                    <>
                      <div className="mt-5 grid grid-cols-3 gap-4 border-y border-slate-200 py-4">
                        <div>
                          <div className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                            {auditReport.passedCount}/{auditReport.totalChecks}
                          </div>
                          <div className="text-xs text-slate-500">Checks Passing</div>
                        </div>
                        <div>
                          <div className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                            {auditReport.averageWordCount}
                          </div>
                          <div className="text-xs text-slate-500">Avg. Words / Guide</div>
                        </div>
                        <div>
                          <div className="font-mono text-xl font-bold text-[#16A34A] tabular-nums">
                            {auditReport.thinArticleCount}
                          </div>
                          <div className="text-xs text-slate-500">Thin Pages (&lt;800w)</div>
                        </div>
                      </div>

                      <div className="mt-5 space-y-3">
                        {auditReport.checks.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 text-xs"
                          >
                            {c.status === 'pass' ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" />
                            ) : (
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            )}
                            <div>
                              <div className="font-semibold text-slate-900">{c.label}</div>
                              <p className="mt-1 text-slate-600">{c.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Live Search &amp; AI Crawler Endpoints
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Served dynamically from Express for Googlebot, AdSense verification bots,
                    ChatGPT Search, Gemini, Perplexity, and Claude.
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { path: '/llms.txt', desc: 'AI Search Summary Manifest' },
                      { path: '/llms-full.txt', desc: 'Complete AI Ingestion Corpus' },
                      { path: '/sitemap.xml', desc: 'Dynamic XML Search Sitemap' },
                      { path: '/robots.txt', desc: 'Search & AI Bot Directives' },
                      { path: '/ads.txt', desc: 'Google AdSense Authorized Sellers' }
                    ].map((ep) => (
                      <a
                        key={ep.path}
                        href={ep.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 hover:border-[#1E40AF] transition-colors"
                      >
                        <div>
                          <div className="font-mono text-xs font-semibold text-[#1E40AF]">
                            {ep.path}
                          </div>
                          <div className="text-[11px] text-slate-500">{ep.desc}</div>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6 lg:col-span-5">
                <form
                  onSubmit={handleSaveAdSense}
                  className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
                >
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Publisher ID &amp; ads.txt Configuration
                  </h2>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Google AdSense Publisher ID
                    </label>
                    <input
                      type="text"
                      value={adSenseForm.adsense_publisher_id}
                      onChange={(e) => {
                        const val = e.target.value;
                        const cleanPub = val.trim().replace(/^ca-/, '');
                        setAdSenseForm((prev) => ({
                          ...prev,
                          adsense_publisher_id: val,
                          ads_txt_content: /^(pub-\d{10,20})$/.test(cleanPub)
                            ? `google.com, ${cleanPub}, DIRECT, f08c47fec0942fa0`
                            : prev.ads_txt_content
                        }));
                      }}
                      placeholder="ca-pub-1234567890123456"
                      className="mt-1 w-full rounded-lg border border-slate-200 font-mono px-3 py-2 text-xs text-slate-900 focus:border-[#1E40AF] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Live /ads.txt File Content
                    </label>
                    <textarea
                      rows={4}
                      value={adSenseForm.ads_txt_content}
                      onChange={(e) =>
                        setAdSenseForm((prev) => ({ ...prev, ads_txt_content: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 font-mono px-3 py-2 text-xs text-slate-900 focus:border-[#1E40AF] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2.5 pt-1 text-xs text-slate-700">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={adSenseForm.ad_slots_enabled}
                        onChange={(e) =>
                          setAdSenseForm((prev) => ({
                            ...prev,
                            ad_slots_enabled: e.target.checked
                          }))
                        }
                        className="rounded border-slate-300 text-[#1E40AF]"
                      />
                      <span>Enable CLS-safe in-article Ad Slots (consent-gated)</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={adSenseForm.auto_ads_enabled}
                        onChange={(e) =>
                          setAdSenseForm((prev) => ({
                            ...prev,
                            auto_ads_enabled: e.target.checked
                          }))
                        }
                        className="rounded border-slate-300 text-[#1E40AF]"
                      />
                      <span>Load Google AdSense Auto Ads script upon consent</span>
                    </label>
                  </div>

                  {adSenseMessage && (
                    <p className="text-xs font-medium text-[#16A34A]">{adSenseMessage}</p>
                  )}

                  <button
                    type="submit"
                    disabled={savingAdSense}
                    className="w-full rounded-lg bg-[#1E40AF] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1D4ED8]"
                  >
                    {savingAdSense ? 'Saving...' : 'Save AdSense & ads.txt Configuration'}
                  </button>
                </form>

                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Supabase PostgreSQL &amp; Auto-Migration Status
                  </h3>
                  <div className="mt-2 space-y-1.5 text-xs text-slate-600">
                    <p>
                      Backend mode:{' '}
                      <strong className="text-slate-900">
                        {storageBackend === 'supabase'
                          ? 'Supabase Connected'
                          : 'Local Preview Store'}
                      </strong>
                    </p>
                    {supabaseUrl && (
                      <p className="font-mono text-[11px] text-slate-500 break-all">
                        {supabaseUrl}
                      </p>
                    )}
                    <p>
                      Schema tables:{' '}
                      <strong className={supabaseTablesReady ? 'text-[#16A34A]' : 'text-amber-700'}>
                        {supabaseTablesReady
                          ? 'Active (posts, comments, subscribers, inquiries, page_contents, agent_tasks, chat_threads, chat_messages, analytics_events, site_settings)'
                          : 'Pending — run auto-migration or schema.sql once'}
                      </strong>
                    </p>
                    <p>
                      Auto-migration:{' '}
                      <strong className={supabaseAutomationMode === 'manual' ? 'text-slate-700' : 'text-[#16A34A]'}>
                        {supabaseAutomationMode === 'db-url'
                          ? 'Enabled automatically on startup (SUPABASE_DB_URL)'
                          : supabaseAutomationMode === 'management-api'
                            ? 'Enabled automatically on startup (SUPABASE_ACCESS_TOKEN)'
                            : 'Manual SQL mode — add SUPABASE_DB_URL or SUPABASE_ACCESS_TOKEN to environment secrets for 100% automatic migrations'}
                      </strong>
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {storageBackend === 'supabase' && (
                      <button
                        type="button"
                        disabled={migratingSupabase}
                        onClick={async () => {
                          setMigratingSupabase(true);
                          setSeedMessage(null);
                          try {
                            const res = await api.migrateSupabase();
                            setSupabaseTablesReady(res.supabaseTablesReady);
                            setSeedMessage(res.message);
                            if (res.executed) {
                              await loadWorkspaceData(analyticsDays);
                              onArticlesChanged();
                              onPagesChanged();
                            }
                          } catch (err) {
                            setSeedMessage(
                              err instanceof Error ? err.message : 'Auto-migration failed.'
                            );
                          } finally {
                            setMigratingSupabase(false);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E40AF] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${migratingSupabase ? 'animate-spin' : ''}`} />
                        <span>{migratingSupabase ? 'Migrating...' : 'Run Auto-Migration Now'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/supabase-schema');
                          const sql = await res.text();
                          await navigator.clipboard.writeText(sql);
                          setSeedMessage('Copied schema.sql to clipboard — paste once in Supabase SQL Editor.');
                        } catch {
                          setSeedMessage('Unable to copy automatically. Use Download schema.sql instead.');
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy schema.sql</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadSchema}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download schema.sql</span>
                    </button>
                    {storageBackend === 'supabase' && supabaseTablesReady && (
                      <button
                        type="button"
                        disabled={seedingSupabase}
                        onClick={async () => {
                          setSeedingSupabase(true);
                          setSeedMessage(null);
                          try {
                            const res = await api.seedSupabase();
                            setSeedMessage(
                              `Synced ${res.seededPosts} starter guides to Supabase.`
                            );
                            await loadWorkspaceData(analyticsDays);
                            onArticlesChanged();
                          } catch (err) {
                            setSeedMessage(
                              err instanceof Error ? err.message : 'Failed syncing to Supabase.'
                            );
                          } finally {
                            setSeedingSupabase(false);
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#1E40AF] bg-white px-3.5 py-2 text-xs font-semibold text-[#1E40AF] hover:bg-blue-50 disabled:opacity-60"
                      >
                        <span>
                          {seedingSupabase ? 'Syncing...' : 'Sync Starter Guides'}
                        </span>
                      </button>
                    )}
                  </div>
                  {seedMessage && (
                    <p className="mt-3 text-xs font-medium text-slate-700">{seedMessage}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
