import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Briefcase,
  Bug,
  CheckCircle2,
  Cloud,
  Coffee,
  Compass,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileCode2,
  FileEdit,
  FileText,
  Lock,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MessageSquare,
  Palette,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
  TrendingUp,
  UserCheck,
  UserCog,
  Workflow,
  X
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdSenseVisualAuditor } from '../components/backoffice/AdSenseVisualAuditor.tsx';
import { AgentsWorkspace } from '../components/backoffice/AgentsWorkspace.tsx';
import { AiSearchVisibilityPanel } from '../components/backoffice/AiSearchVisibilityPanel.tsx';
import { AiTrendContentStudio } from '../components/backoffice/AiTrendContentStudio.tsx';
import { AnalyticsDashboard } from '../components/backoffice/AnalyticsDashboard.tsx';
import type { DateRangeSelection } from '../components/backoffice/AnalyticsSharedSections.tsx';
import { BrandingThemePanel } from '../components/backoffice/BrandingThemePanel.tsx';
import { BuyMeACoffeeHubPanel } from '../components/backoffice/BuyMeACoffeeHubPanel.tsx';
import { CloudflareAnalyticsPanel } from '../components/backoffice/CloudflareAnalyticsPanel.tsx';
import { CrmProspectingPanel } from '../components/backoffice/CrmProspectingPanel.tsx';
import { CyberSecurityPanel } from '../components/backoffice/CyberSecurityPanel.tsx';
import { DataExplorerPanel } from '../components/backoffice/DataExplorerPanel.tsx';
import { DemoUsersDashboardPanel } from '../components/backoffice/DemoUsersDashboardPanel.tsx';
import { GoogleTrendsPanel } from '../components/backoffice/GoogleTrendsPanel.tsx';
import { InboxWorkspace } from '../components/backoffice/InboxWorkspace.tsx';
import { InfrastructureMonitor } from '../components/backoffice/InfrastructureMonitor.tsx';
import { IntegrationsVaultPanel } from '../components/backoffice/IntegrationsVaultPanel.tsx';
import { InternalChatBox } from '../components/backoffice/InternalChatBox.tsx';
import { MarketingStudioPanel } from '../components/backoffice/MarketingStudioPanel.tsx';
import { NotificationModulePanel } from '../components/backoffice/NotificationModulePanel.tsx';
import { PageEditorPanel } from '../components/backoffice/PageEditorPanel.tsx';
import { ProductQaPanel } from '../components/backoffice/ProductQaPanel.tsx';
import { ProfilePanel } from '../components/backoffice/ProfilePanel.tsx';
import { SearchConsolePanel } from '../components/backoffice/SearchConsolePanel.tsx';
import { TagManagerPanel } from '../components/backoffice/TagManagerPanel.tsx';
import { UserAccessPanel } from '../components/backoffice/UserAccessPanel.tsx';
import { UserWorkflowsPanel } from '../components/backoffice/UserWorkflowsPanel.tsx';
import { MarkdownRenderer } from '../components/MarkdownRenderer.tsx';
import {
  api,
  getRealtimeWsUrl,
  getStoredToken
} from '../lib/api.ts';
import { applySeoMetadata } from '../lib/seo.ts';
import { buildArticleJsonLd, evaluateArticleQuality, slugify } from '../shared/qualityGate.ts';
import { DEFAULT_ADSENSE_SETTINGS } from '../shared/seedData.ts';
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
  DirectoryUser,
  InquiryStatus,
  NewsletterSubscriber,
  PageContentConfig,
  PageKey,
  RoutingRule,
  ServiceCategory,
  SiteAuditReport,
  TaskPriority,
  UserProfile,
  UserRole,
  UserStatus,
  UserWorkflowItem
} from '../shared/types.ts';

interface StudioPageProps {
  onArticlesChanged: () => void;
  onPagesChanged: () => void;
  onSettingsChanged: (settings: AdSenseSettings) => void;
  onNavigate: (path: string) => void;
}

type StudioTab =
  | 'agents'
  | 'crm'
  | 'pages'
  | 'branding'
  | 'buymeacoffee'
  | 'inbox'
  | 'notifications'
  | 'chat'
  | 'workflows'
  | 'analytics'
  | 'tag_manager'
  | 'cloudflare'
  | 'ai_visibility'
  | 'search_console'
  | 'marketing'
  | 'google_trends'
  | 'resources'
  | 'qa'
  | 'cybersecurity'
  | 'articles'
  | 'users'
  | 'demo_users'
  | 'data_explorer'
  | 'adsense'
  | 'profile';

const ROLE_TABS: Record<UserRole, StudioTab[]> = {
  super_admin: [
    'agents',
    'crm',
    'pages',
    'branding',
    'buymeacoffee',
    'inbox',
    'notifications',
    'chat',
    'workflows',
    'analytics',
    'tag_manager',
    'cloudflare',
    'ai_visibility',
    'search_console',
    'marketing',
    'google_trends',
    'resources',
    'qa',
    'cybersecurity',
    'articles',
    'users',
    'demo_users',
    'data_explorer',
    'adsense',
    'profile'
  ],
  editor: [
    'agents',
    'crm',
    'pages',
    'articles',
    'notifications',
    'demo_users',
    'workflows',
    'analytics',
    'tag_manager',
    'cloudflare',
    'ai_visibility',
    'search_console',
    'marketing',
    'google_trends',
    'resources',
    'qa',
    'cybersecurity',
    'profile'
  ],
  support_agent: [
    'inbox',
    'notifications',
    'chat',
    'workflows',
    'ai_visibility',
    'resources',
    'qa',
    'cybersecurity',
    'profile'
  ]
};

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  editor: 'Editor',
  support_agent: 'Support Agent'
};

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
    title: 'Enterprise Architecture Blueprint: Production Reliability & Cloud FinOps Guide',
    slug: 'enterprise-architecture-blueprint-production-reliability-finops',
    summary_tldr:
      'Production cloud platforms require transaction connection pooling, idempotent asynchronous event pipelines, and policy-as-code governance to deliver sub-250ms API latency at predictable unit cost.',
    category: 'AI Integration',
    author_name: 'Ronel Molina',
    author_role: 'Principal Cloud Architect · 13+ Years Distributed Systems Experience',
    author_bio:
      'Principal Cloud Architect with 13+ years of experience designing high-throughput backend systems, MLOps pipelines, and enterprise compliance architectures.',
    cover_image: COVER_PRESETS[0].url,
    cover_alt:
      'Geometric optical glass prisms refracting cobalt blue light on a white studio surface',
    meta_title: 'Enterprise Cloud Architecture & FinOps Blueprint | GitStack',
    meta_description:
      'Step-by-step GitStack production architecture guide covering connection pooling, transactional outbox pipelines, observability, and cloud FinOps controls.',
    primary_keyword: 'enterprise cloud architecture',
    faqs: [
      {
        question: 'How do serverless APIs avoid exhausting PostgreSQL database connections?',
        answer:
          'Route stateless serverless workers through a transaction pooler on port 6543 using a singleton client wrapper with prepared statements disabled so concurrent requests share pooled backend sockets safely.'
      },
      {
        question: 'Why is the transactional outbox pattern preferred over dual writes to message brokers?',
        answer:
          'Persisting business state changes and outgoing domain events inside a single ACID database transaction eliminates silent message loss during transient network blips or worker restarts.'
      }
    ],
    references: [
      {
        title: 'GitStack Technical Insights & Case Studies',
        url: 'https://git-stack.org/insights'
      },
      {
        title: 'Google Search Central Helpful Content Guidelines',
        url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content'
      }
    ],
    content_markdown: `## 1. Problem Context and Production Architecture Scope

Modern engineering organizations scaling B2B SaaS, AI automation, and enterprise data platforms rarely struggle with initial prototype velocity; they struggle when concurrent customer traffic, strict regulatory compliance, and multi-region latency requirements expose brittle monolithic coupling. Without clear architectural boundaries around persistence, asynchronous queues, and observability, routine feature releases trigger unexpected database lock contention, 504 gateway timeouts, and runaway monthly cloud spend.

At GitStack, every production architecture engagement begins by establishing deterministic reliability budgets, explicit service ownership boundaries, and automated FinOps telemetry before writing application controllers. Replace this opening context with the specific customer problem, target industry, and operational benchmarks relevant to your new guide.

## 2. Core System Design & Integration Topology

Reliable distributed systems separate latency-critical user interactions from heavy background processing such as document parsing, third-party webhook delivery, and compliance reporting. Incoming API requests validate authentication claims and payload schemas at the edge, persist authoritative state inside a single ACID transaction, and enqueue downstream work cleanly via a transactional outbox table.

- **Edge Schema & Identity Verification**: Enforce strict runtime payload validation and role-based access control prior to invoking downstream business logic or AI retrieval layers.
- **Singleton Transaction Pooling**: Share pooled PostgreSQL connections through port 6543 in serverless runtimes so traffic spikes never exhaust active backend processes.
- **Idempotent Webhook & Queue Processing**: Tag every asynchronous command with a deterministic UUID key so network retries never create duplicate invoices, charges, or notifications.
- **Zero-Trust Secret Isolation**: Keep third-party API keys, database strings, and OAuth tokens exclusively inside server-side encrypted vaults with automated rotation audits.

## 3. Step-by-Step Implementation Blueprint

Standardize your database access and asynchronous worker pattern so every microservice enforces consistent connection reuse, structured logging, and predictable retry behavior under regional load spikes.

\`\`\`typescript
interface ReliabilityPolicy {
  maxPoolConnections: number;
  requestTimeoutMs: number;
  retryBackoffMs: number[];
}

export const PRODUCTION_POLICY: ReliabilityPolicy = {
  maxPoolConnections: 1,
  requestTimeoutMs: 4000,
  retryBackoffMs: [250, 1000, 3000]
};
\`\`\`

Document your concrete environment variables, deployment topology (e.g., Singapore or Tokyo primary database region), and schema migration safeguards here so fellow engineers can reproduce your configuration safely without guesswork.

## 4. Production Verification, Cost Governance & Benchmarks

Shipping production systems without continuous telemetry turns minor regressions into silent revenue leaks. Pair distributed OpenTelemetry tracing with explicit database Disk IO alerts, p95 endpoint latency budgets, and automated unit-cost dashboards.

| Operational Metric | Baseline Target | Verification Mechanism |
| :--- | :--- | :--- |
| API p95 Response Latency | Under 250 milliseconds | Distributed edge-to-SQL trace histograms |
| Database Connection Saturation | Below 65% pool ceiling | Transaction pooler metrics and idle timeout |
| Asynchronous Delivery Reliability | 99.95% within 5 seconds | Outbox lag alerting and dead-letter replay |
| Monthly Compute Efficiency | 30% to 45% cost reduction | Automated idle-resource and query audits |

Review query execution plans quarterly, prune unindexed full-table scans, and verify backup restore drills on staging snapshots before every major release cycle.

## 5. Frequently Asked Questions & Engineering Takeaways

Summarize the primary architectural trade-offs readers should evaluate before adopting this pattern, and link directly to GitStack Engineering Services or live technical demonstrations where prospective enterprise teams can explore implementation support.`,
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
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('super_admin');
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
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
  const [adsenseSubView, setAdsenseSubView] = useState<'auditor' | 'settings'>('auditor');
  const [articlesSubView, setArticlesSubView] = useState<'trend_studio' | 'managed'>('trend_studio');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [workspaceNotice, setWorkspaceNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [agents, setAgents] = useState<AgentReport[]>([]);
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [pageContents, setPageContents] = useState<PageContentConfig[]>([]);
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [analyticsRange, setAnalyticsRange] = useState<DateRangeSelection>(() => {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 13 * 86400_000).toISOString().slice(0, 10);
    return { preset: '14d', startDate: start, endDate: end };
  });
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);

  const [teamDirectory, setTeamDirectory] = useState<DirectoryUser[]>([]);
  const [teamUsers, setTeamUsers] = useState<UserProfile[]>([]);
  const [workflows, setWorkflows] = useState<UserWorkflowItem[]>([]);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);

  const [posts, setPosts] = useState<Article[]>([]);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [inquiries, setInquiries] = useState<ClientInquiry[]>([]);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [auditReport, setAuditReport] = useState<SiteAuditReport | null>(null);
  const [adSenseForm, setAdSenseForm] = useState<AdSenseSettings>(DEFAULT_ADSENSE_SETTINGS);

  // Editor state
  const [draft, setDraft] = useState<Partial<Article>>(createEmptyDraft);
  const [previewMode, setPreviewMode] = useState<'write' | 'preview' | 'schema'>('write');
  const [savingPost, setSavingPost] = useState(false);
  const [postMessage, setPostMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [savingAdSense, setSavingAdSense] = useState(false);
  const [adSenseMessage, setAdSenseMessage] = useState<string | null>(null);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    applySeoMetadata({
      title: 'GitStack Private Back Office',
      description: 'Protected operator workspace for GitStack pages, agents, inbox, chat, workflows, and analytics.',
      path: '/obama',
      robots: 'noindex, nofollow'
    });
  }, []);

  const loadWorkspaceData = useCallback(
    async (targetRange: DateRangeSelection = analyticsRange, roleOverride?: UserRole) => {
      const effectiveRole = roleOverride || currentUserRole;
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
          profileRes,
          dirRes,
          workflowsRes,
          rulesRes,
          analyticsRes,
          usersRes
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
          api.getMyProfile(),
          api.getUserDirectory(),
          api.listWorkflows(),
          api.listRoutingRules(),
          effectiveRole === 'super_admin' || effectiveRole === 'editor'
            ? api.getAnalyticsSummary({
                preset: targetRange.preset,
                startDate: targetRange.startDate,
                endDate: targetRange.endDate
              })
            : Promise.resolve({ summary: null }),
          effectiveRole === 'super_admin'
            ? api.listUsers()
            : Promise.resolve({ users: [] as UserProfile[] })
        ]);
        setPosts(postsRes.posts);
        setComments(commentsRes.comments);
        setInquiries(inqRes.inquiries);
        setSubscribers(subRes.subscribers);
        setAdSenseForm(settingsRes.settings);
        onSettingsChanged(settingsRes.settings);
        setAuditReport(auditRes.report);
        setPageContents(pagesRes.pages);
        setAgents(agentsRes.agents);
        setAgentTasks(agentsRes.tasks);
        setChatThreads(chatRes.threads);
        setCurrentProfile(profileRes.profile);
        setTeamDirectory(dirRes.users);
        setWorkflows(workflowsRes.items);
        setRoutingRules(rulesRes.rules);
        setAnalyticsSummary(analyticsRes.summary);
        setTeamUsers(usersRes.users);
      } catch (err) {
        console.error('Failed loading studio workspace:', err);
      } finally {
        setLoadingWorkspace(false);
      }
    },
    [analyticsRange, currentUserRole, onSettingsChanged]
  );

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
          setCurrentUserId(res.editor.userId);
          setCurrentUserRole(res.editor.role);
          setCurrentProfile(res.editor.profile);
          setActiveTab((prev) =>
            ROLE_TABS[res.editor!.role].includes(prev) ? prev : ROLE_TABS[res.editor!.role][0]
          );
          loadWorkspaceData(analyticsRange, res.editor.role);
        }
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setCheckingAuth(false));
  }, [loadWorkspaceData]);

  // Continuous Back Office operator presence heartbeat + WS join while logged in
  useEffect(() => {
    if (!authenticated) return;
    api.sendAdminHeartbeat().catch(() => {});
    const hbInterval = window.setInterval(() => {
      api.sendAdminHeartbeat().catch(() => {});
    }, 60_000);

    let ws: WebSocket | null = null;
    try {
      const wsUrl = getRealtimeWsUrl();
      const token = getStoredToken();
      if (wsUrl && token) {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          ws?.send(JSON.stringify({ type: 'admin:join', token }));
        };
      }
    } catch {
      // HTTP heartbeat covers fallback
    }

    return () => {
      window.clearInterval(hbInterval);
      if (ws && ws.readyState < 2) ws.close();
    };
  }, [authenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      const res = await api.login(loginEmail, loginPassword);
      setAuthenticated(true);
      setEditorEmail(res.editor.email);
      setCurrentUserId(res.editor.userId);
      setCurrentUserRole(res.editor.role);
      setCurrentProfile(res.editor.profile);
      setStorageBackend(res.storageBackend);
      setSupabaseUrl(res.supabaseUrl);
      setSupabaseTablesReady(res.supabaseTablesReady);
      setSupabaseAutomationMode(res.supabaseAutomationMode || 'manual');
      setActiveTab(ROLE_TABS[res.editor.role][0]);
      await loadWorkspaceData(analyticsRange, res.editor.role);
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
    setCurrentUserId('');
    setCurrentProfile(null);
    setTeamUsers([]);
    setTeamDirectory([]);
    setWorkflows([]);
    setWorkspaceNotice(null);
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
      await loadWorkspaceData(analyticsRange);
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
      await loadWorkspaceData(analyticsRange);
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

  const handleSaveBmcSettings = async (patch: Partial<AdSenseSettings>): Promise<boolean> => {
    setSavingAdSense(true);
    setWorkspaceNotice(null);
    try {
      const res = await api.saveAdSenseSettings({
        ...adSenseForm,
        ...patch
      });
      setAdSenseForm(res.settings);
      onSettingsChanged(res.settings);
      setWorkspaceNotice({ type: 'ok', text: 'Buy Me a Coffee configuration saved and synced sitewide.' });
      const agentsRes = await api.getAgentsOverview();
      setAgents(agentsRes.agents);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save Buy Me a Coffee settings.';
      setWorkspaceNotice({ type: 'err', text: msg });
      throw err;
    } finally {
      setSavingAdSense(false);
    }
  };

  const handleChangeAnalyticsRange = async (nextRange: DateRangeSelection) => {
    setAnalyticsRange(nextRange);
    const res = await api.getAnalyticsSummary({
      preset: nextRange.preset,
      startDate: nextRange.startDate,
      endDate: nextRange.endDate
    });
    setAnalyticsSummary(res.summary);
  };

  const handleRefreshAnalyticsSummary = async () => {
    const res = await api.getAnalyticsSummary({
      preset: analyticsRange.preset,
      startDate: analyticsRange.startDate,
      endDate: analyticsRange.endDate
    });
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

  const handleSaveBranding = async (patch: Partial<AdSenseSettings>) => {
    setSavingBranding(true);
    setWorkspaceNotice(null);
    try {
      const res = await api.saveAdSenseSettings({
        ...adSenseForm,
        ...patch
      });
      setAdSenseForm(res.settings);
      onSettingsChanged(res.settings);
      setWorkspaceNotice({ type: 'ok', text: 'Header, logo, and sitewide theme saved.' });
    } catch (err) {
      setWorkspaceNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to save branding settings.'
      });
    } finally {
      setSavingBranding(false);
    }
  };

  const handleSaveMyProfile = async (
    updates: Partial<Pick<UserProfile, 'full_name' | 'job_title' | 'bio' | 'avatar_url' | 'phone' | 'timezone'>>
  ) => {
    setSavingProfile(true);
    setWorkspaceNotice(null);
    try {
      const res = await api.updateMyProfile(updates);
      setCurrentProfile(res.profile);
      setTeamUsers((prev) =>
        prev.map((u) => (u.user_id === res.profile.user_id ? res.profile : u))
      );
      setTeamDirectory((prev) =>
        prev.map((u) =>
          u.user_id === res.profile.user_id
            ? {
                user_id: res.profile.user_id,
                email: res.profile.email,
                full_name: res.profile.full_name,
                role: res.profile.role,
                job_title: res.profile.job_title,
                avatar_url: res.profile.avatar_url,
                status: res.profile.status
              }
            : u
        )
      );
      setWorkspaceNotice({ type: 'ok', text: 'Your profile and picture have been updated.' });
    } catch (err) {
      setWorkspaceNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to update profile.'
      });
      throw err;
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateTeamUser = async (payload: {
    email: string;
    password: string;
    full_name: string;
    role: UserRole;
    job_title?: string;
  }) => {
    setWorkspaceNotice(null);
    try {
      const res = await api.createUser(payload);
      setTeamUsers((prev) => [...prev, res.user]);
      setTeamDirectory((prev) => [
        ...prev,
        {
          user_id: res.user.user_id,
          email: res.user.email,
          full_name: res.user.full_name,
          role: res.user.role,
          job_title: res.user.job_title,
          avatar_url: res.user.avatar_url,
          status: res.user.status
        }
      ]);
      setWorkspaceNotice({
        type: 'ok',
        text: `Provisioned user ${res.user.email} (${ROLE_LABELS[res.user.role]}).`
      });
    } catch (err) {
      setWorkspaceNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to create user.'
      });
      throw err;
    }
  };

  const handleUpdateTeamUser = async (
    userId: string,
    payload: { role?: UserRole; status?: UserStatus; password?: string }
  ) => {
    setWorkspaceNotice(null);
    try {
      const res = await api.updateUser(userId, payload);
      setTeamUsers((prev) => prev.map((u) => (u.user_id === userId ? res.user : u)));
      setTeamDirectory((prev) =>
        prev.map((u) =>
          u.user_id === userId
            ? {
                user_id: res.user.user_id,
                email: res.user.email,
                full_name: res.user.full_name,
                role: res.user.role,
                job_title: res.user.job_title,
                avatar_url: res.user.avatar_url,
                status: res.user.status
              }
            : u
        )
      );
      setWorkspaceNotice({
        type: 'ok',
        text: payload.password
          ? `Password updated for ${res.user.email}.`
          : `Access updated for ${res.user.email}.`
      });
    } catch (err) {
      setWorkspaceNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to update team user.'
      });
      throw err;
    }
  };

  const handleDeleteTeamUser = async (userId: string) => {
    setWorkspaceNotice(null);
    try {
      await api.deleteUser(userId);
      setTeamUsers((prev) => prev.filter((u) => u.user_id !== userId));
      setTeamDirectory((prev) => prev.filter((u) => u.user_id !== userId));
      setWorkspaceNotice({ type: 'ok', text: 'User account deleted.' });
    } catch (err) {
      setWorkspaceNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to delete team user.'
      });
      throw err;
    }
  };

  const handleCreateWorkflow = async (payload: Partial<UserWorkflowItem>) => {
    setWorkspaceNotice(null);
    try {
      const res = await api.createWorkflow(payload);
      setWorkflows((prev) => [res.item, ...prev]);
      setWorkspaceNotice({ type: 'ok', text: 'Workflow task added to queue.' });
    } catch (err) {
      setWorkspaceNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to create workflow item.'
      });
      throw err;
    }
  };

  const handleUpdateWorkflow = async (id: string, patch: Partial<UserWorkflowItem>) => {
    setWorkspaceNotice(null);
    try {
      const res = await api.updateWorkflow(id, patch);
      setWorkflows((prev) => prev.map((w) => (w.id === id ? res.item : w)));
    } catch (err) {
      setWorkspaceNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to update workflow item.'
      });
      throw err;
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    setWorkspaceNotice(null);
    try {
      await api.deleteWorkflow(id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      setWorkspaceNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to delete workflow item.'
      });
      throw err;
    }
  };

  const handleAssignInquiry = async (id: string, assignedTo: string | null) => {
    setWorkspaceNotice(null);
    try {
      const res = await api.assignInquiry(id, assignedTo);
      setInquiries((prev) => prev.map((row) => (row.id === id ? res.inquiry : row)));
      setWorkspaceNotice({ type: 'ok', text: 'Inquiry assignment updated.' });
    } catch (err) {
      setWorkspaceNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to assign inquiry.'
      });
    }
  };

  const handleAssignThread = async (threadId: string, assignedTo: string | null) => {
    setWorkspaceNotice(null);
    try {
      const res = await api.assignChatThread(threadId, assignedTo);
      setChatThreads((prev) => prev.map((row) => (row.id === threadId ? res.thread : row)));
      setWorkspaceNotice({ type: 'ok', text: 'Chat thread assignment updated.' });
    } catch (err) {
      setWorkspaceNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to assign thread.'
      });
    }
  };

  const handleSaveRoutingRules = async (rules: RoutingRule[]) => {
    setWorkspaceNotice(null);
    try {
      const res = await api.saveRoutingRules(rules);
      setRoutingRules(res.rules);
      setWorkspaceNotice({ type: 'ok', text: 'Auto-routing rules saved.' });
    } catch (err) {
      setWorkspaceNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to save routing rules.'
      });
      throw err;
    }
  };

  const handleJumpToSection = (section: string) => {
    const allowed = ROLE_TABS[currentUserRole];
    if (allowed.includes(section as StudioTab)) {
      setActiveTab(section as StudioTab);
      setWorkspaceNotice(null);
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
      <div className="mx-auto max-w-md px-4 sm:px-6 py-10 sm:py-16 lg:py-24">
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--gs-primary)]">
            <Lock className="h-4 w-4" />
            <span>Private Operator Access Only</span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold text-slate-900">
            GitStack Back Office
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Sign in with your Supabase Email/Password credentials (no Google Sign-In) to manage
            all 7 operational agents, public page content, branding, team workflows, Lark Mail &amp;
            lead inbox, internal chat, and Google Analytics.
          </p>

          {storageBackend === 'supabase' ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-[var(--gs-soft-bg)] p-3.5 text-xs text-slate-700">
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
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
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
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
              />
            </div>
            {loginError && <p className="text-xs font-medium text-red-700">{loginError}</p>}
            <button
              type="submit"
              disabled={loggingIn}
              className="min-h-[44px] w-full rounded-lg bg-[var(--gs-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
            >
              {loggingIn ? 'Signing in...' : 'Sign In to Back Office'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const allNavItems: {
    id: StudioTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }[] = [
    { id: 'agents', label: 'Overview & 7 Agents', icon: Bot, count: agents.length || 7 },
    { id: 'crm', label: 'CRM & Prospecting', icon: Briefcase },
    { id: 'pages', label: 'Page Content Editor', icon: FileEdit },
    { id: 'branding', label: 'Branding & Theme', icon: Palette },
    { id: 'buymeacoffee', label: 'Buy Me a Coffee Hub', icon: Coffee },
    { id: 'inbox', label: 'Lark Mail & Lead Inbox', icon: Mail, count: inquiries.length },
    { id: 'notifications', label: 'Notifications & Alerts', icon: Bell },
    {
      id: 'chat',
      label: 'Live Q&A Chat Box',
      icon: MessageSquare,
      count: chatThreads.filter((t) => t.status === 'open').length
    },
    {
      id: 'workflows',
      label: 'Team Workflows',
      icon: Workflow,
      count: workflows.filter((w) => w.status !== 'done').length
    },
    { id: 'analytics', label: 'Google Analytics', icon: BarChart3 },
    { id: 'tag_manager', label: 'Tag Manager (GTM)', icon: Tags },
    { id: 'cloudflare', label: 'Cloudflare Analytics', icon: Cloud },
    { id: 'ai_visibility', label: 'AI & Search Visibility', icon: Sparkles },
    { id: 'search_console', label: 'Search Console & SEO', icon: Search },
    { id: 'marketing', label: 'Marketing & Social', icon: Megaphone },
    { id: 'google_trends', label: 'Google Trends Agent', icon: TrendingUp },
    { id: 'resources', label: 'Vercel & Supabase Monitor', icon: Activity },
    { id: 'qa', label: 'Product QA & Logs', icon: Bug },
    { id: 'cybersecurity', label: 'Cybersecurity & AI Sentinel', icon: Shield },
    { id: 'articles', label: 'Articles & Gatekeeper', icon: FileText, count: posts.length },
    { id: 'users', label: 'User Access', icon: UserCog, count: teamUsers.length },
    { id: 'demo_users', label: 'Demo Users & Leads', icon: UserCheck },
    { id: 'data_explorer', label: 'Data & Tables', icon: Database },
    { id: 'adsense', label: 'Settings & Integrations', icon: ShieldCheck },
    { id: 'profile', label: 'My Profile', icon: UserCheck }
  ];

  const allowedTabs = ROLE_TABS[currentUserRole];
  const navItems = allNavItems.filter((item) => allowedTabs.includes(item.id));
  const currentTab: StudioTab = allowedTabs.includes(activeTab) ? activeTab : navItems[0].id;
  const activeNav = navItems.find((n) => n.id === currentTab) || navItems[0];

  const displayName = currentProfile?.full_name || editorEmail.split('@')[0] || 'Operator';
  const avatarInitials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
  const canAssignLeads = currentUserRole === 'super_admin' || currentUserRole === 'support_agent';

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Mobile Sidebar Toggle */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="text-xs font-bold text-slate-900 truncate">
            Back Office · {activeNav.label}
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen((p) => !p)}
            aria-label="Toggle Back Office Navigation"
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-slate-200 p-1.5 text-slate-700"
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
            <div className="border-b border-slate-200 pb-3 flex items-center gap-3">
              {currentProfile?.avatar_url ? (
                <img
                  src={currentProfile.avatar_url}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 rounded-full border border-slate-200 object-cover shrink-0"
                />
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: 'var(--gs-primary)' }}
                >
                  {avatarInitials || 'GS'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-[var(--gs-primary)] truncate">
                  {ROLE_LABELS[currentUserRole]}
                </div>
                <div className="font-display text-sm font-bold text-slate-900 truncate">
                  {displayName}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{editorEmail}</div>
              </div>
            </div>

            <nav aria-label="Back Office Sections" className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileNavOpen(false);
                      setWorkspaceNotice(null);
                    }}
                    className={`min-h-[42px] w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors text-left ${
                      active
                        ? 'bg-[var(--gs-primary)] text-white'
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
                          active ? 'text-white/80' : 'text-slate-400'
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
                className="min-h-[42px] w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 sm:px-6 py-4">
            <div>
              <div className="text-[11px] font-medium text-slate-500">
                GitStack Back Office /{' '}
                <span className="text-[var(--gs-primary)]">{activeNav.label}</span>
              </div>
              <h1 className="mt-0.5 font-display text-lg sm:text-xl font-bold text-slate-900">
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

          {workspaceNotice && (
            <div
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
                workspaceNotice.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              <span>{workspaceNotice.text}</span>
              <button
                type="button"
                onClick={() => setWorkspaceNotice(null)}
                aria-label="Dismiss notification"
                className="p-1 opacity-70 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* PANEL 1: OVERVIEW & 7 DETERMINISTIC AGENTS */}
          {currentTab === 'agents' && (
            <AgentsWorkspace
              agents={agents}
              tasks={agentTasks}
              loading={loadingWorkspace}
              onRefresh={() => loadWorkspaceData(analyticsRange)}
              onJumpToSection={handleJumpToSection}
              onCreateTask={handleCreateAgentTask}
              onToggleTask={handleToggleAgentTask}
              onDeleteTask={handleDeleteAgentTask}
            />
          )}

          {/* PANEL 1B: APOLLO-STYLE CRM, OPEN-SOURCE LEAD FINDER & LARK MAIL */}
          {currentTab === 'crm' && (
            <CrmProspectingPanel
              onOpenSettings={
                currentUserRole === 'super_admin' ? () => setActiveTab('adsense') : undefined
              }
              onDealWon={({ inquiry, workflowItem }) => {
                if (inquiry) {
                  setInquiries((prev) => [inquiry, ...prev]);
                }
                if (workflowItem) {
                  setWorkflows((prev) => [workflowItem, ...prev]);
                }
              }}
            />
          )}

          {/* PANEL 2: PAGE CONTENT & MEDIA CUSTOMIZER */}
          {currentTab === 'pages' && (
            <PageEditorPanel
              key={pageContents.map((p) => p.updated_at).join('|') || 'pages-default'}
              pages={pageContents}
              onSavePage={handleSavePageContent}
              onPreviewRoute={onNavigate}
            />
          )}

          {/* PANEL 2B: HEADER, LOGO & SITEWIDE THEME CUSTOMIZER */}
          {currentTab === 'branding' && (
            <BrandingThemePanel
              key={adSenseForm.updated_at || 'branding'}
              settings={adSenseForm}
              onSave={handleSaveBranding}
              saving={savingBranding}
            />
          )}

          {/* PANEL 2C: BUY ME A COFFEE HUB & LIVE CONTROLLER */}
          {currentTab === 'buymeacoffee' && (
            <BuyMeACoffeeHubPanel
              key={adSenseForm.updated_at || 'buymeacoffee'}
              settings={adSenseForm}
              onSave={handleSaveBmcSettings}
              saving={savingAdSense}
            />
          )}

          {/* PANEL 3: LARK MAIL & LEAD INBOX */}
          {currentTab === 'inbox' && (
            <InboxWorkspace
              inquiries={inquiries}
              comments={comments}
              subscribers={subscribers}
              teamUsers={teamDirectory}
              onAssignInquiry={canAssignLeads ? handleAssignInquiry : undefined}
              onOpenSettings={
                currentUserRole === 'super_admin' ? () => setActiveTab('adsense') : undefined
              }
              onOpenNotifications={() => setActiveTab('notifications')}
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

          {/* PANEL 3B: LARK MAIL NOTIFICATION MODULE */}
          {currentTab === 'notifications' && (
            <NotificationModulePanel
              currentUserRole={currentUserRole}
              onOpenSettings={
                currentUserRole === 'super_admin' ? () => setActiveTab('adsense') : undefined
              }
              onOpenInbox={() => setActiveTab('inbox')}
            />
          )}

          {/* PANEL 4: INTERNAL CHAT BOX & HISTORICAL Q&A */}
          {currentTab === 'chat' && (
            <InternalChatBox
              threads={chatThreads}
              teamUsers={teamDirectory}
              onAssignThread={canAssignLeads ? handleAssignThread : undefined}
              onLoadMessages={handleLoadChatMessages}
              onCreateThread={handleCreateChatThread}
              onSendReply={handleSendChatReply}
              onUpdateStatus={handleUpdateChatStatus}
            />
          )}

          {/* PANEL 4B: PER-USER TEAM WORKFLOWS & ROUTING */}
          {currentTab === 'workflows' && (
            <UserWorkflowsPanel
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              directory={teamDirectory}
              workflows={workflows}
              inquiries={inquiries}
              chatThreads={chatThreads}
              routingRules={routingRules}
              onCreateWorkflow={handleCreateWorkflow}
              onUpdateWorkflow={handleUpdateWorkflow}
              onDeleteWorkflow={handleDeleteWorkflow}
              onAssignInquiry={handleAssignInquiry}
              onAssignThread={handleAssignThread}
              onSaveRoutingRules={handleSaveRoutingRules}
              onOpenChatThread={() => setActiveTab('chat')}
            />
          )}

          {/* PANEL 5: GOOGLE ANALYTICS SETTINGS & DASHBOARD */}
          {currentTab === 'analytics' && (
            <AnalyticsDashboard
              key={adSenseForm.updated_at || 'ga4'}
              settings={adSenseForm}
              summary={analyticsSummary}
              range={analyticsRange}
              onChangeRange={handleChangeAnalyticsRange}
              onRefreshSummary={handleRefreshAnalyticsSummary}
              onSaveGa4Settings={handleSaveGa4Settings}
            />
          )}

          {/* PANEL 5-GTM: GOOGLE TAG MANAGER & DATALAYER TELEMETRY HUB */}
          {currentTab === 'tag_manager' && (
            <TagManagerPanel
              key={adSenseForm.updated_at || 'gtm'}
              settings={adSenseForm}
              onSettingsUpdated={(next) => {
                setAdSenseForm(next);
                onSettingsChanged(next);
              }}
            />
          )}

          {/* PANEL 5A: CLOUDFLARE REAL-TIME EDGE & TRAFFIC ANALYTICS */}
          {currentTab === 'cloudflare' && (
            <CloudflareAnalyticsPanel
              onOpenSettings={
                currentUserRole === 'super_admin' ? () => setActiveTab('adsense') : undefined
              }
            />
          )}

          {/* PANEL 5A-2: AI & SEARCH ENGINE VISIBILITY (GEO / SEO) */}
          {currentTab === 'ai_visibility' && (
            <AiSearchVisibilityPanel
              currentUserRole={currentUserRole}
              onPagesBoosted={() => {
                onPagesChanged();
                loadWorkspaceData(analyticsRange);
              }}
            />
          )}

          {/* PANEL 5A-3: GOOGLE SEARCH CONSOLE & MULTI-ENGINE URL AUDITOR */}
          {currentTab === 'search_console' && <SearchConsolePanel />}

          {/* PANEL 5A-4: FREE ORGANIC MARKETING & SOCIAL MEDIA STUDIO */}
          {currentTab === 'marketing' && <MarketingStudioPanel />}

          {/* PANEL 5A-5: GOOGLE TRENDS MONITOR & MANDATORY APPROVAL QUEUE */}
          {currentTab === 'google_trends' && (
            <GoogleTrendsPanel
              onArticlePublished={() => {
                loadWorkspaceData(analyticsRange);
                onArticlesChanged();
              }}
              onOpenMarketing={() => setActiveTab('marketing')}
            />
          )}

          {/* PANEL 5B: VERCEL & SUPABASE LIVE RESOURCE MONITOR */}
          {currentTab === 'resources' && (
            <InfrastructureMonitor currentUserRole={currentUserRole} />
          )}

          {/* PANEL 5C: PRODUCT QA LOGS, SYSTEM FEATURE REGISTRY & EOD PDF REPORT */}
          {currentTab === 'qa' && (
            <ProductQaPanel
              currentUserRole={currentUserRole}
              onOpenSettings={
                currentUserRole === 'super_admin' ? () => setActiveTab('adsense') : undefined
              }
            />
          )}

          {/* PANEL 5D: CYBERSECURITY POSTURE & LIVE AI SENTINEL (AEGIS) */}
          {currentTab === 'cybersecurity' && (
            <CyberSecurityPanel
              currentUserRole={currentUserRole}
              onOpenSettings={
                currentUserRole === 'super_admin' ? () => setActiveTab('adsense') : undefined
              }
            />
          )}

          {/* PANEL 8: USER ACCESS MANAGEMENT (SUPER ADMIN) */}
          {currentTab === 'users' && (
            <UserAccessPanel
              currentUserId={currentUserId}
              users={teamUsers}
              onCreateUser={handleCreateTeamUser}
              onUpdateUser={handleUpdateTeamUser}
              onDeleteUser={handleDeleteTeamUser}
            />
          )}

          {/* PANEL 8B: ISOLATED LIVE DEMO USERS & TELEMETRY */}
          {currentTab === 'demo_users' && (
            <DemoUsersDashboardPanel onOpenCrm={() => setActiveTab('crm')} />
          )}

          {/* PANEL 8C: SUPER ADMIN LIVE DATA EXPLORER & AUDIT LOGS */}
          {currentTab === 'data_explorer' && currentUserRole === 'super_admin' && (
            <DataExplorerPanel />
          )}

          {/* PANEL 9: MY PROFILE & PICTURE */}
          {currentTab === 'profile' && currentProfile && (
            <ProfilePanel
              profile={currentProfile}
              onSaveProfile={handleSaveMyProfile}
              saving={savingProfile}
            />
          )}

          {/* PANEL 6: ARTICLES & PRE-PUBLISH QUALITY GATEKEEPER */}
          {currentTab === 'articles' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setArticlesSubView('trend_studio')}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                    articlesSubView === 'trend_studio'
                      ? 'bg-[var(--gs-primary)] text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Compass className="h-4 w-4" />
                  <span>AI Trend Scout &amp; Content Studio</span>
                </button>
                <button
                  type="button"
                  onClick={() => setArticlesSubView('managed')}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                    articlesSubView === 'managed'
                      ? 'bg-[var(--gs-primary)] text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  <span>Managed Articles ({posts.length})</span>
                </button>
              </div>

              {articlesSubView === 'trend_studio' ? (
                <AiTrendContentStudio
                  onPostPublished={() => {
                    loadWorkspaceData(analyticsRange);
                    onArticlesChanged();
                  }}
                  onNavigateToInsights={() => onNavigate('/insights')}
                />
              ) : (
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-8 min-w-0">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-display text-sm font-bold text-slate-900">
                      Managed Engineering Guides ({posts.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(createEmptyDraft());
                        setPostMessage(null);
                      }}
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
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
                            onClick={async () => {
                              setPostMessage(null);
                              if (p.content_markdown && p.content_markdown.trim().length > 0) {
                                setDraft(p);
                                return;
                              }
                              try {
                                const full = await api.getPost(p.slug);
                                setDraft(full.post);
                              } catch {
                                setDraft(p);
                              }
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
                            onClick={async () => {
                              setPostMessage(null);
                              if (p.content_markdown && p.content_markdown.trim().length > 0) {
                                setDraft(p);
                                return;
                              }
                              try {
                                const full = await api.getPost(p.slug);
                                setDraft(full.post);
                              } catch {
                                setDraft(p);
                              }
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

                  <div className="flex flex-col-reverse sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3 border-t border-slate-200 pt-5">
                    <button
                      type="button"
                      disabled={savingPost}
                      onClick={() => handleSaveArticle('draft')}
                      className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Save as Draft
                    </button>
                    <button
                      type="button"
                      disabled={savingPost || !qualityReport.publishEligible}
                      onClick={() => handleSaveArticle('published')}
                      className="min-h-[44px] rounded-lg bg-[var(--gs-primary)] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
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
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--gs-primary)]">
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
            </div>
          )}

          {/* PANEL 7: SETTINGS, INTEGRATIONS VAULT, ADSENSE AUDIT & SUPABASE SCHEMA */}
          {currentTab === 'adsense' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setAdsenseSubView('auditor')}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                    adsenseSubView === 'auditor'
                      ? 'bg-[var(--gs-primary)] text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  <span>AdSense Compliance &amp; Visual Auditor (Gemini Vision)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdsenseSubView('settings')}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                    adsenseSubView === 'settings'
                      ? 'bg-[var(--gs-primary)] text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>API Integrations Vault &amp; Site Settings</span>
                </button>
              </div>

              {adsenseSubView === 'auditor' ? (
                <AdSenseVisualAuditor />
              ) : (
                <div className="space-y-8">
                  <IntegrationsVaultPanel />

                  <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-7 min-w-0">
                <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAdsenseSubView('auditor')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Live Visual &amp; SSR Audit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => api.getSiteAudit().then((r) => setAuditReport(r.report))}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Re-Scan</span>
                      </button>
                    </div>
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
                    className="min-h-[44px] w-full rounded-lg bg-[var(--gs-primary)] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                  >
                    {savingAdSense ? 'Saving...' : 'Save AdSense & ads.txt Configuration'}
                  </button>
                </form>

                <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
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
                              await loadWorkspaceData(analyticsRange);
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
                        className="min-h-[42px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
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
                      className="min-h-[42px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy schema.sql</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadSchema}
                      className="min-h-[42px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
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
                            await loadWorkspaceData(analyticsRange);
                            onArticlesChanged();
                          } catch (err) {
                            setSeedMessage(
                              err instanceof Error ? err.message : 'Failed syncing to Supabase.'
                            );
                          } finally {
                            setSeedingSupabase(false);
                          }
                        }}
                        className="min-h-[42px] inline-flex items-center gap-2 rounded-lg border border-[var(--gs-primary)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--gs-primary)] hover:bg-[var(--gs-soft-bg)] disabled:opacity-60"
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
          </div>
        )}
      </div>
    )}
        </div>
      </div>
    </div>
  );
}
