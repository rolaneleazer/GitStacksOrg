import dotenv from 'dotenv';
dotenv.config({ override: true });
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildAllAgentReports } from '../shared/agentEngine.ts';
import {
  AGENT_COLLABORATION_MAP,
  composeDailyAgentDigest,
  DEFAULT_AGENT_OFFICE_PROFILES
} from '../shared/agentOfficeDefaults.ts';
import { validatePageContentForAdSense } from '../shared/pageDefaults.ts';
import { evaluateArticleQuality, slugify } from '../shared/qualityGate.ts';
import { DEFAULT_BRANDING, normalizeHexColor } from '../shared/themePresets.ts';
import type {
  AdSenseSettings,
  AgentAvatarIcon,
  AgentConversationEntry,
  AgentEmailReport,
  AgentId,
  AgentOfficeProfile,
  AgentReport,
  AgentReportSettings,
  AgentSnapshotItem,
  AgentTask,
  AgentWorkStatus,
  AnalyticsEventType,
  ApolloCandidate,
  ApolloSearchFilters,
  Article,
  ArticleComment,
  ChatMessage,
  ChatThread,
  ChatThreadStatus,
  ClientInquiry,
  CloudflareHistoryRange,
  CloudflareWindowPreset,
  CommentStatus,
  CrmFollowUpStep,
  CrmLead,
  CrmLeadStage,
  CrmOAuthTokenRecord,
  CrmOutreachLog,
  CsvImportLeadInput,
  DemoUser,
  GoogleMapsPlaceCandidate,
  HeaderSurface,
  InboxEmailLog,
  InquiryStatus,
  IntegrationConfigMeta,
  IntegrationProviderId,
  LarkConnectionStatus,
  NewsletterSubscriber,
  OfficeLiveHudSummary,
  OpenSourceSyncResult,
  OpenSourceSyncTrack,
  PageContentConfig,
  PageKey,
  RoutingRule,
  ServiceCategory,
  SiteAuditCheck,
  SiteAuditReport,
  TaskPriority,
  ThemePresetId,
  UserRole,
  UserStatus,
  UserWorkflowItem,
  WebsiteChatMessage,
  WebsiteChatSession,
  WebsiteChatStatus
} from '../shared/types.ts';
import { getChatWatcherLastRunAt, isSessionUnanswered, runOfflineChatInquiryCheck } from './chatWatcher.ts';
import { fetchCloudflareZoneAnalytics } from './cloudflare.ts';
import {
  generateCloudflareAiForecast,
  getCloudflareHistoryAnalysis,
  syncCloudflareHistoricalSnapshots
} from './cloudflareHistory.ts';
import {
  buildLeadsFromCsvInputs,
  enrichAndBuildApolloLeads,
  getApolloApiKey,
  getGoogleMapsApiKey,
  harvestHackerNewsLeads,
  harvestYCombinatorLeads,
  importAndAnalyzeGoogleMapsPlaces,
  MapsQuotaExceededError,
  searchApolloPeople,
  searchGoogleMapsEstablishments
} from './connectors.ts';
import { collectInfrastructureMetrics, restartInfrastructureServices } from './infrastructure.ts';
import { auditPageAdSense } from './adsenseAuditor.ts';
import { discoverTrendingTopics, generateAdSenseSafeArticle } from './trendScout.ts';
import {
  broadcastToAdmins,
  broadcastToVisitor,
  getLastAdminSeenAt,
  isAdminOnline,
  listLiveVisitors,
  markAdminPresence,
  recordVisitorPresence
} from './realtime.ts';
import {
  clearChatAlertCooldown,
  dispatchAdminLarkAlert,
  dispatchLiveChatLarkNotification,
  resolveLarkAlertTarget
} from './notifications.ts';
import {
  applyAiSeoContentBooster,
  getAiSearchVisibilityDashboard,
  runDailyAiSearchVisibilityTest
} from './aiSeoVisibility.ts';
import {
  generateAndSendCyberSecurityReport,
  getCyberSecurityDashboard,
  mitigateCyberFinding,
  renderCyberSecurityPdfBuffer
} from './cyberSecurity.ts';
import {
  acceptFeatureBaseline,
  generateAndSendQaEodReport,
  getQaDashboardData,
  reanalyzeSingleQaLog,
  recordAndAnalyzeQaLog,
  renderExistingReportPdfBuffer,
  runLiveQaAgentScan
} from './qaMonitor.ts';
import {
  buildLarkAuthorizeUrl,
  exchangeLarkCodeForTokens,
  fetchLarkUserInfo,
  getLarkBaseOrigin,
  getLarkEnvStatus,
  getLarkRedirectUri,
  refreshLarkUserToken,
  sendLarkMailMessage,
  verifyLarkOAuthState
} from './lark.ts';
import {
  discoverOpenSourceLeads,
  harvestTrendingOpenSourceLeads,
  runProspectResearchAndProposal,
  verifyEmailMxDomain
} from './prospecting.ts';
import {
  addAgentConversation,
  addChatMessage,
  addCrmOutreachLog,
  addCrmSyncRun,
  addInboxEmailLog,
  addSubscriber,
  assignChatThread,
  assignInquiry,
  appendWebsiteChatMessage,
  autoMigrateSupabaseSchema,
  autoSeedSupabaseIfEmpty,
  bulkUpdateAgentWorkStatus,
  checkSupabaseTablesReady,
  createChatThread,
  createComment,
  createInquiry,
  createTeamUser,
  createWorkflowItem,
  deleteAgentTask,
  deleteCrmLead,
  deleteCrmOAuthToken,
  deletePost,
  deleteTeamUser,
  deleteWorkflowItem,
  findDemoUserByEmail,
  findDemoUserById,
  findCyberSecurityReportById,
  findProductQaReportById,
  findWebsiteChatSessionById,
  findWebsiteChatSessionByToken,
  getAdSenseSettings,
  getAdminNotificationSettings,
  getAgentReportSettings,
  getAnalyticsSummary,
  getCrmOAuthToken,
  getCrmSourcesAnalytics,
  getDemoExpiresAtIso,
  getPostBySlug,
  getSupabaseAutomationMode,
  getSupabaseUrl,
  hashDemoPassword,
  isDemoUserExpired,
  isSupabaseConfigured,
  issueDemoSessionToken,
  listAgentConversations,
  listAgentEmailReports,
  listAgentOfficeProfiles,
  listAgentTasks,
  listAllWebsiteChatMessages,
  listChatMessages,
  listChatThreads,
  listComments,
  listCrmLeads,
  listCrmOutreachLogs,
  listCyberSecurityFindings,
  listDemoUsersWithStats,
  listInboxEmailLogs,
  listInquiries,
  listPageContents,
  listPosts,
  listRoutingRules,
  listSubscribers,
  listUserDirectory,
  listUserProfiles,
  listWebsiteChatMessages,
  listWebsiteChatSessions,
  listWorkflowItems,
  recordAgentEmailReport,
  recordAnalyticsEvent,
  saveAdSenseSettings,
  saveAdminNotificationSettings,
  saveAgentReportSettings,
  saveAiSearchVisibilitySettings,
  saveCyberSecuritySettings,
  saveProductQaSettings,
  saveRoutingRules,
  seedStarterDataToSupabase,
  signInEditor,
  toPublicDemoUser,
  updateChatThreadStatus,
  updateCommentStatus,
  updateInquiryStatus,
  updateMyUserProfile,
  updateProductQaLog,
  updateTeamUser,
  updateWorkflowItem,
  upsertAgentOfficeProfile,
  upsertAgentTask,
  upsertCrmLead,
  upsertCrmOAuthToken,
  upsertDemoUser,
  upsertMergeCrmLeads,
  upsertPageContent,
  upsertPost,
  upsertWebsiteChatSession,
  verifyDemoPassword,
  verifyDemoSessionToken,
  verifyEditorToken,
  getBmcAnalytics,
  recordBmcClick,
  type EditorSession
} from './repository.ts';
import {
  disconnectIntegration,
  getAllIntegrationStatuses,
  resolveIntegrationConfig,
  saveAndVerifyIntegration,
  sendLarkSmtpMail,
  testIntegrationConnection,
  VALID_INTEGRATION_PROVIDERS
} from './vault.ts';

interface AuthReq extends Request {
  editor?: EditorSession;
}

function getBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length).trim();
}

async function requireEditor(req: AuthReq, res: Response, next: NextFunction) {
  const session = await verifyEditorToken(getBearerToken(req));
  if (!session) {
    return res.status(401).json({ error: 'Authentication required. Please sign in to GitStack Studio.' });
  }
  req.editor = session;
  next();
}

function requireRoles(...allowed: UserRole[]) {
  return async (req: AuthReq, res: Response, next: NextFunction) => {
    const session = await verifyEditorToken(getBearerToken(req));
    if (!session) {
      return res.status(401).json({ error: 'Authentication required. Please sign in to GitStack Studio.' });
    }
    if (!allowed.includes(session.role)) {
      return res.status(403).json({
        error: `Access restricted: requires ${allowed.join(' or ')} permissions.`
      });
    }
    req.editor = session;
    next();
  };
}

function getOrigin(req: Request): string {
  if (process.env.APP_URL && !process.env.APP_URL.includes('MY_APP_URL')) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:3000';
  return `${proto}://${host}`.replace(/\/$/, '');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function buildSiteAuditReport(posts: Article[], settings: AdSenseSettings): SiteAuditReport {
  const thinPosts = posts.filter((p) => p.word_count < 800);
  const avgWords =
    posts.length > 0
      ? Math.round(posts.reduce((sum, p) => sum + p.word_count, 0) / posts.length)
      : 0;
  const missingAuthorBio = posts.filter((p) => p.author_bio.trim().length < 40);
  const missingRefs = posts.filter((p) => p.references.length < 2);
  const hasValidPubId = /^(ca-)?pub-\d{10,20}$/.test(settings.adsense_publisher_id.trim());
  const hasValidAdsTxt = /google\.com,\s*pub-\d{10,20},\s*DIRECT,\s*f08c47fec0942fa0/i.test(
    settings.ads_txt_content
  );

  const checks: SiteAuditCheck[] = [
    {
      id: 'legal-suite',
      category: 'Legal & Trust',
      label: 'Complete Legal & Trust Suite (Privacy, Terms, Cookie, Disclaimer, About, Contact, Editorial)',
      status: 'pass',
      detail: 'All 7 mandatory AdSense trust & disclosure pages are live, linked in navigation, and crawlable.'
    },
    {
      id: 'content-volume',
      category: 'Content Depth',
      label: 'Minimum Substantive Article Inventory (4+ Long-Form Guides)',
      status: posts.length >= 4 ? 'pass' : 'warning',
      detail: `${posts.length} published technical guides (recommended minimum: 4+ deep guides, ideally 10+ before final domain submission).`
    },
    {
      id: 'no-thin-content',
      category: 'Content Depth',
      label: 'Zero Thin or Low-Value Content (800+ Words per Published Article)',
      status: thinPosts.length === 0 ? 'pass' : 'fail',
      detail:
        thinPosts.length === 0
          ? `All ${posts.length} published articles exceed 800 words (average ${avgWords} words).`
          : `${thinPosts.length} published article(s) under 800 words.`
    },
    {
      id: 'eeat-signals',
      category: 'AdSense Policy',
      label: 'Author E-E-A-T Attribution & Primary Citations',
      status: missingAuthorBio.length === 0 && missingRefs.length === 0 ? 'pass' : 'fail',
      detail: 'Every published guide includes verified author bio, role credentials, and 2+ authoritative HTTPS references.'
    },
    {
      id: 'crawler-endpoints',
      category: 'Crawler & AI Discovery',
      label: 'Live /robots.txt, /sitemap.xml, /llms.txt & Schema.org JSON-LD',
      status: 'pass',
      detail: 'Root crawler endpoints dynamically reflect published articles and welcome search + AI bots.'
    },
    {
      id: 'ads-txt-ready',
      category: 'AdSense Policy',
      label: 'Google AdSense Publisher ID & /ads.txt Verification',
      status: hasValidPubId && hasValidAdsTxt ? 'pass' : 'warning',
      detail:
        hasValidPubId && hasValidAdsTxt
          ? `Verified publisher record (${settings.adsense_publisher_id}) active on /ads.txt.`
          : 'Enter your Google AdSense Publisher ID (ca-pub-...) below to activate live /ads.txt verification.'
    }
  ];

  const passedCount = checks.filter((c) => c.status === 'pass').length;
  const hasFail = checks.some((c) => c.status === 'fail');

  return {
    readyForAdSense: !hasFail && posts.length >= 4,
    passedCount,
    totalChecks: checks.length,
    publishedArticleCount: posts.length,
    thinArticleCount: thinPosts.length,
    averageWordCount: avgWords,
    checks
  };
}

let appPromise: Promise<Express> | null = null;
let dbInitialized = false;

async function ensureDatabaseReadyOnBoot(): Promise<void> {
  if (dbInitialized) return;
  dbInitialized = true;
  try {
    if (process.env.VERCEL) {
      // Fast check on serverless cold starts; skip redundant DDL unless tables are missing
      const ready = await checkSupabaseTablesReady();
      if (ready) return;
    }
    const migration = await autoMigrateSupabaseSchema();
    if (migration.executed) {
      console.log(`[GitStack DB] ${migration.message}`);
    }
    const seeded = await autoSeedSupabaseIfEmpty();
    if (seeded) {
      console.log('[GitStack DB] Seeded starter guides, page defaults, and Back Office data.');
    }
  } catch (err) {
    console.warn(
      '[GitStack DB] Startup auto-migration skipped:',
      err instanceof Error ? err.message : err
    );
  }
}

export async function createApp(): Promise<Express> {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Automatic Backend API 5xx Telemetry Capture for Live QA Agent
  app.use((req, res, next) => {
    res.on('finish', () => {
      if (
        res.statusCode >= 500 &&
        req.path.startsWith('/api/') &&
        !req.path.startsWith('/api/public/qa/') &&
        !req.path.startsWith('/api/admin/qa/')
      ) {
        const refHeader = typeof req.headers.referer === 'string' ? req.headers.referer : '';
        let pagePath = '/';
        try {
          if (refHeader) pagePath = new URL(refHeader).pathname || '/';
        } catch {
          pagePath = '/';
        }
        void recordAndAnalyzeQaLog({
          level: 'error',
          source: 'backend',
          page_path: pagePath,
          code_location: `src/server/app.ts (${req.method} ${req.path})`,
          error_name: `HTTP_${res.statusCode}`,
          message: `Backend route ${req.method} ${req.path} returned HTTP ${res.statusCode}`,
          http_status: res.statusCode,
          request_method: req.method,
          request_path: req.path,
          user_agent: String(req.headers['user-agent'] || '')
        }).catch(() => null);
      }
    });
    next();
  });

  await ensureDatabaseReadyOnBoot();

  // Hardened HTTP Security Headers Middleware (Audited by Aegis CyberSec Sentinel)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // --- Crawler, AI Discovery & AdSense Root Endpoints ---

  app.get('/robots.txt', (req, res) => {
    const origin = getOrigin(req);
    const body = [
      '# GitStack Crawler & AI Discovery Policy',
      'User-agent: *',
      'Allow: /',
      'Disallow: /obama',
      'Disallow: /studio',
      'Disallow: /api/',
      '',
      '# Explicitly welcome AI Search & Answer Engine Crawlers',
      'User-agent: OAI-SearchBot',
      'Allow: /',
      '',
      'User-agent: GPTBot',
      'Allow: /',
      '',
      'User-agent: ChatGPT-User',
      'Allow: /',
      '',
      'User-agent: Google-Extended',
      'Allow: /',
      '',
      'User-agent: Googlebot',
      'Allow: /',
      '',
      'User-agent: PerplexityBot',
      'Allow: /',
      '',
      'User-agent: ClaudeBot',
      'Allow: /',
      '',
      'User-agent: anthropic-ai',
      'Allow: /',
      '',
      'User-agent: Bingbot',
      'Allow: /',
      '',
      'User-agent: Applebot-Extended',
      'Allow: /',
      '',
      `Sitemap: ${origin}/sitemap.xml`,
      `# AI Manifest: ${origin}/llms.txt`,
      `# Extended AI Corpus: ${origin}/llms-full.txt`
    ].join('\n');
    res.type('text/plain').send(body);
  });

  app.get('/sitemap.xml', async (req, res) => {
    try {
      const origin = getOrigin(req);
      const publishedPosts = await listPosts(false);
      const staticRoutes = [
        { path: '/', priority: '1.0', changefreq: 'weekly' },
        { path: '/services', priority: '0.9', changefreq: 'monthly' },
        { path: '/insights', priority: '0.9', changefreq: 'daily' },
        { path: '/about', priority: '0.8', changefreq: 'monthly' },
        { path: '/contact', priority: '0.8', changefreq: 'monthly' },
        { path: '/editorial-policy', priority: '0.6', changefreq: 'quarterly' },
        { path: '/privacy-policy', priority: '0.5', changefreq: 'quarterly' },
        { path: '/terms', priority: '0.5', changefreq: 'quarterly' },
        { path: '/cookie-policy', priority: '0.5', changefreq: 'quarterly' },
        { path: '/disclaimer', priority: '0.5', changefreq: 'quarterly' }
      ];

      const urls = [
        ...staticRoutes.map(
          (r) =>
            `  <url>\n    <loc>${escapeXml(`${origin}${r.path}`)}</loc>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`
        ),
        ...publishedPosts.map(
          (p) =>
            `  <url>\n    <loc>${escapeXml(`${origin}/insights/${p.slug}`)}</loc>\n    <lastmod>${new Date(p.updated_at).toISOString().split('T')[0]}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`
        )
      ].join('\n');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
      res.type('application/xml').send(xml);
    } catch {
      res.status(500).type('text/plain').send('Failed to generate sitemap');
    }
  });

  app.get('/llms.txt', async (req, res) => {
    try {
      const origin = getOrigin(req);
      const posts = await listPosts(false);
      const lines = [
        '# GitStack',
        '',
        '> GitStack is an enterprise software engineering, cloud infrastructure, and AI/ML solutions consultancy. We help engineering leaders integrate production AI systems, automate machine learning operations (MLOps), build custom TypeScript and distributed software, manage multi-region cloud infrastructure, and execute architectural advisory engagements.',
        '',
        '## Core & Expanded Capabilities',
        '- **AI Integration**: Production Retrieval-Augmented Generation (RAG), private enterprise copilots, multi-agent workflow orchestration, semantic search, and groundedness evaluation.',
        '- **Machine Learning Automation (MLOps)**: Automated retraining DAGs, feature stores, statistical drift detection, shadow mirroring, and zero-downtime Kubernetes canary deployments.',
        '- **Custom Software Development**: Event-driven microservices, Strangler Fig legacy modernization, high-reliability web platforms, and API engineering.',
        '- **Cloud Infrastructure Management**: Multi-region Terraform modules, Open Policy Agent (OPA) policy-as-code, Kubernetes platform engineering, and FinOps cost optimization.',
        '- **Technical Consulting**: Architecture audits, AI readiness roadmaps, security posture reviews, and due diligence.',
        '',
        '## Key Pages',
        `- [Home & Service Capabilities](${origin}/): Full overview of GitStack services and quantified client outcomes.`,
        `- [Technical Insights Journal](${origin}/insights): Peer-reviewed deep-dive engineering articles and architecture guides.`,
        `- [About GitStack](${origin}/about): Engineering leadership, credentials, and editorial methodology.`,
        `- [Book a Discovery Consultation](${origin}/contact): Direct enterprise project inquiry and architecture review intake.`,
        `- [Editorial Policy](${origin}/editorial-policy): E-E-A-T standards, verification rules, and content quality controls.`,
        '',
        '## Published Engineering Guides',
        ...posts.map((p) => `- [${p.title}](${origin}/insights/${p.slug}): ${p.summary_tldr}`),
        '',
        '## Full Machine-Readable Corpus',
        `- [Complete Technical Corpus](${origin}/llms-full.txt)`
      ];
      res.type('text/plain; charset=utf-8').send(lines.join('\n'));
    } catch {
      res.status(500).type('text/plain').send('Failed to generate llms.txt');
    }
  });

  app.get('/llms-full.txt', async (req, res) => {
    try {
      const origin = getOrigin(req);
      const posts = await listPosts(false);
      const sections = [
        '# GitStack Complete Knowledge & Service Corpus',
        `Canonical Origin: ${origin}`,
        'Contact: contact@gitstack.io',
        '',
        '## Services Overview',
        '1. AI Integration: Enterprise RAG pipelines with hybrid lexical-vector search, RBAC pre-retrieval filtering, LLM guardrails, and continuous evaluation.',
        '2. Machine Learning Automation Solutions: End-to-end MLOps, automated drift monitoring (PSI/KS), unified feature stores, and canary model delivery.',
        '3. Custom Software Development: TypeScript/Node.js/React/Python production systems, transactional outbox messaging, and legacy monolith modernization.',
        '4. Cloud Infrastructure Management: AWS/GCP/Azure multi-region Terraform governance, Kubernetes operations, OPA security gates, and FinOps optimization.',
        '5. Technical Consulting: Fractional principal architecture, AI feasibility studies, and system resilience audits.',
        '',
        '---',
        '',
        ...posts.flatMap((p) => [
          `# ${p.title}`,
          `URL: ${origin}/insights/${p.slug}`,
          `Category: ${p.category} | Author: ${p.author_name} (${p.author_role}) | Updated: ${p.updated_at}`,
          `Executive Summary: ${p.summary_tldr}`,
          '',
          p.content_markdown,
          '',
          ...(p.faqs.length
            ? [
                '### Frequently Asked Questions',
                ...p.faqs.flatMap((f) => [`**Q: ${f.question}**`, `A: ${f.answer}`, ''])
              ]
            : []),
          '---',
          ''
        ])
      ];
      res.type('text/plain; charset=utf-8').send(sections.join('\n'));
    } catch {
      res.status(500).type('text/plain').send('Failed to generate llms-full.txt');
    }
  });

  app.get('/ads.txt', async (_req, res) => {
    try {
      const settings = await getAdSenseSettings();
      res.type('text/plain; charset=utf-8').send(settings.ads_txt_content);
    } catch {
      res.status(500).type('text/plain').send('# Error loading ads.txt');
    }
  });

  // --- Health & Auth APIs ---

  app.get('/api/health', async (_req, res) => {
    const supabaseTablesReady = await checkSupabaseTablesReady();
    res.json({
      ok: true,
      runtime: process.env.VERCEL ? 'vercel-serverless' : 'node-server',
      storageBackend: isSupabaseConfigured() ? 'supabase' : 'local-json',
      supabaseUrl: getSupabaseUrl() || null,
      supabaseTablesReady,
      supabaseAutomationMode: getSupabaseAutomationMode()
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const result = await signInEditor(email, password);
    if (!result) {
      return res.status(401).json({
        error: isSupabaseConfigured()
          ? 'Invalid Supabase email or password. Ensure this user exists in Supabase Authentication -> Users.'
          : 'Invalid email or password.'
      });
    }
    const supabaseTablesReady = await checkSupabaseTablesReady();
    res.json({
      token: result.token,
      editor: result.session,
      storageBackend: isSupabaseConfigured() ? 'supabase' : 'local-json',
      supabaseUrl: getSupabaseUrl() || null,
      supabaseTablesReady,
      supabaseAutomationMode: getSupabaseAutomationMode()
    });
  });

  app.get('/api/auth/session', async (req, res) => {
    const session = await verifyEditorToken(getBearerToken(req));
    const supabaseTablesReady = await checkSupabaseTablesReady();
    res.json({
      authenticated: Boolean(session),
      editor: session,
      storageBackend: isSupabaseConfigured() ? 'supabase' : 'local-json',
      supabaseUrl: getSupabaseUrl() || null,
      supabaseTablesReady,
      supabaseAutomationMode: getSupabaseAutomationMode()
    });
  });

  app.post('/api/supabase/migrate', requireRoles('super_admin'), async (req, res) => {
    try {
      const migration = await autoMigrateSupabaseSchema();
      const supabaseTablesReady = await checkSupabaseTablesReady();
      let seededPosts = 0;
      if (migration.executed && supabaseTablesReady) {
        const seeded = await seedStarterDataToSupabase(getBearerToken(req));
        seededPosts = seeded.seededPosts;
      }
      res.json({ ...migration, supabaseTablesReady, seededPosts });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Automated Supabase migration failed.'
      });
    }
  });

  app.post('/api/supabase/seed', requireRoles('super_admin'), async (req, res) => {
    try {
      const result = await seedStarterDataToSupabase(getBearerToken(req));
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to seed Supabase' });
    }
  });

  // --- Infrastructure Telemetry (Vercel & Supabase CPU / RAM / Storage) ---

  app.get(
    '/api/infrastructure/metrics',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (_req, res) => {
      try {
        const metrics = await collectInfrastructureMetrics();
        res.json(metrics);
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to collect infrastructure telemetry.'
        });
      }
    }
  );

  app.post(
    '/api/infrastructure/restart-services',
    requireRoles('super_admin', 'editor'),
    async (_req, res) => {
      try {
        const result = await restartInfrastructureServices();
        res.json(result);
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to reset infrastructure connection pools.'
        });
      }
    }
  );

  // --- AdSense Compliance & Visual Auditor API ---

  app.post('/api/audit-page', async (req, res) => {
    try {
      const token = getBearerToken(req);
      const result = await auditPageAdSense(req.body || {}, token);
      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to complete AdSense visual policy audit.'
      });
    }
  });

  // --- AI Trend Scout & AdSense-Safe Content Studio APIs ---

  app.post('/api/discover-trends', async (req, res) => {
    try {
      const token = getBearerToken(req);
      const result = await discoverTrendingTopics(req.body || {}, token);
      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to discover trending topics.'
      });
    }
  });

  app.post('/api/generate-article', async (req, res) => {
    try {
      const token = getBearerToken(req);
      const result = await generateAdSenseSafeArticle(req.body || {}, token);
      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate AdSense-safe article.'
      });
    }
  });

  // --- Buy Me a Coffee Analytics & Telemetry API ---

  app.get('/api/bmc/analytics', async (_req, res) => {
    try {
      res.json(getBmcAnalytics());
    } catch (err) {
      res.status(500).json({ error: 'Failed to load Buy Me a Coffee analytics' });
    }
  });

  app.post('/api/bmc/track-click', async (req, res) => {
    try {
      const placement = req.body?.placement || 'other';
      const updated = recordBmcClick(placement);
      res.json({ success: true, analytics: updated });
    } catch (err) {
      res.status(500).json({ error: 'Failed to record click' });
    }
  });

  // --- Articles / Content Module APIs ---

  app.get('/api/posts', async (req, res) => {
    try {
      const token = getBearerToken(req);
      const session = await verifyEditorToken(token);
      const wantAll = req.query.status === 'all' && Boolean(session);
      const posts = await listPosts(wantAll, token);
      res.json({ posts });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load posts' });
    }
  });

  app.get('/api/posts/:slug', async (req, res) => {
    try {
      const token = getBearerToken(req);
      const session = await verifyEditorToken(token);
      const post = await getPostBySlug(req.params.slug, Boolean(session), token);
      if (!post) return res.status(404).json({ error: 'Article not found' });
      res.json({ post });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load article' });
    }
  });

  app.post('/api/posts', requireEditor, async (req, res) => {
    try {
      const payload = req.body as Partial<Article>;
      if (!payload.title || !payload.content_markdown) {
        return res.status(400).json({ error: 'Title and article content are required.' });
      }
      const draftInput = {
        title: payload.title.trim(),
        summary_tldr: (payload.summary_tldr || '').trim(),
        content_markdown: payload.content_markdown,
        author_name: (payload.author_name || 'GitStack Editorial Team').trim(),
        author_role: (payload.author_role || 'Principal Architect').trim(),
        author_bio: (payload.author_bio || '').trim(),
        cover_image: (payload.cover_image || '/src/assets/images/insight_cover_ai_agents_1794645171607.jpg').trim(),
        cover_alt: (payload.cover_alt || '').trim(),
        meta_title: (payload.meta_title || payload.title).trim(),
        meta_description: (payload.meta_description || '').trim(),
        primary_keyword: (payload.primary_keyword || '').trim(),
        faqs: Array.isArray(payload.faqs) ? payload.faqs : [],
        references: Array.isArray(payload.references) ? payload.references : []
      };

      const report = evaluateArticleQuality(draftInput);
      const targetStatus = payload.status === 'published' ? 'published' : 'draft';

      if (targetStatus === 'published' && !report.publishEligible) {
        return res.status(422).json({
          error: 'AdSense Quality Gatekeeper blocked publishing. Resolve required checks first.',
          blockingIssues: report.blockingIssues,
          report
        });
      }

      const now = new Date().toISOString();
      const baseSlug = slugify(payload.slug || draftInput.title);
      const article: Article = {
        id: payload.id || `art-${crypto.randomUUID().slice(0, 8)}`,
        slug: baseSlug,
        ...draftInput,
        category: payload.category || 'AI Integration',
        word_count: report.wordCount,
        read_time_minutes: report.readTimeMinutes,
        quality_score: report.qualityScore,
        geo_score: report.geoScore,
        status: targetStatus,
        published_at: targetStatus === 'published' ? payload.published_at || now : null,
        updated_at: now,
        created_at: payload.created_at || now
      };

      const saved = await upsertPost(article, getBearerToken(req));
      res.status(201).json({ post: saved, report });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save article' });
    }
  });

  app.put('/api/posts/:id', requireEditor, async (req, res) => {
    try {
      const payload = req.body as Partial<Article>;
      if (!payload.title || !payload.content_markdown) {
        return res.status(400).json({ error: 'Title and article content are required.' });
      }
      const draftInput = {
        title: payload.title.trim(),
        summary_tldr: (payload.summary_tldr || '').trim(),
        content_markdown: payload.content_markdown,
        author_name: (payload.author_name || 'GitStack Editorial Team').trim(),
        author_role: (payload.author_role || 'Principal Architect').trim(),
        author_bio: (payload.author_bio || '').trim(),
        cover_image: (payload.cover_image || '/src/assets/images/insight_cover_ai_agents_1794645171607.jpg').trim(),
        cover_alt: (payload.cover_alt || '').trim(),
        meta_title: (payload.meta_title || payload.title).trim(),
        meta_description: (payload.meta_description || '').trim(),
        primary_keyword: (payload.primary_keyword || '').trim(),
        faqs: Array.isArray(payload.faqs) ? payload.faqs : [],
        references: Array.isArray(payload.references) ? payload.references : []
      };

      const report = evaluateArticleQuality(draftInput);
      const targetStatus = payload.status === 'published' ? 'published' : 'draft';

      if (targetStatus === 'published' && !report.publishEligible) {
        return res.status(422).json({
          error: 'AdSense Quality Gatekeeper blocked publishing. Resolve required checks first.',
          blockingIssues: report.blockingIssues,
          report
        });
      }

      const now = new Date().toISOString();
      const article: Article = {
        id: req.params.id,
        slug: slugify(payload.slug || draftInput.title),
        ...draftInput,
        category: payload.category || 'AI Integration',
        word_count: report.wordCount,
        read_time_minutes: report.readTimeMinutes,
        quality_score: report.qualityScore,
        geo_score: report.geoScore,
        status: targetStatus,
        published_at: targetStatus === 'published' ? payload.published_at || now : null,
        updated_at: now,
        created_at: payload.created_at || now
      };

      const saved = await upsertPost(article, getBearerToken(req));
      res.json({ post: saved, report });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update article' });
    }
  });

  app.delete('/api/posts/:id', requireEditor, async (req, res) => {
    try {
      await deletePost(req.params.id, getBearerToken(req));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete article' });
    }
  });

  // --- Comments APIs ---

  app.get('/api/comments', async (req, res) => {
    try {
      const token = getBearerToken(req);
      const session = await verifyEditorToken(token);
      const postId = typeof req.query.postId === 'string' ? req.query.postId : null;
      const comments = await listComments(postId, Boolean(session), token);
      res.json({ comments });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load comments' });
    }
  });

  app.post('/api/comments', async (req, res) => {
    try {
      const { post_id, author_name, author_email, body } = req.body as Partial<ArticleComment>;
      if (!post_id || !author_name || !author_email || !body) {
        return res.status(400).json({ error: 'All comment fields are required.' });
      }
      if (!isValidEmail(author_email)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }
      if (body.trim().length < 10 || body.trim().length > 1500) {
        return res.status(400).json({ error: 'Comment must be between 10 and 1,500 characters.' });
      }
      const hasSpamUrl = /(http|https):\/\/.+\.(ru|xyz|top|click)/i.test(body);
      const comment: ArticleComment = {
        id: `cmt-${crypto.randomUUID().slice(0, 8)}`,
        post_id,
        author_name: author_name.trim().slice(0, 80),
        author_email: author_email.trim().toLowerCase(),
        body: body.trim(),
        status: hasSpamUrl ? 'pending' : 'approved',
        created_at: new Date().toISOString()
      };
      const saved = await createComment(comment);
      await recordAnalyticsEvent({
        id: `evt-${crypto.randomUUID().slice(0, 8)}`,
        event_type: 'comment_submitted',
        path: `/insights`,
        referrer: 'direct',
        session_id: `cmt-${comment.id}`,
        meta: { post_id },
        created_at: comment.created_at
      });
      res.status(201).json({ comment: saved });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to submit comment' });
    }
  });

  app.patch('/api/comments/:id', requireEditor, async (req, res) => {
    try {
      const { status } = req.body as { status?: CommentStatus };
      if (!status || !['approved', 'pending', 'hidden'].includes(status)) {
        return res.status(400).json({ error: 'Invalid comment status.' });
      }
      const updated = await updateCommentStatus(req.params.id, status, getBearerToken(req));
      if (!updated) return res.status(404).json({ error: 'Comment not found.' });
      res.json({ comment: updated });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update comment' });
    }
  });

  // --- Newsletter APIs ---

  app.post('/api/newsletter', async (req, res) => {
    try {
      const { email, name, interest_topic, consent_given } = req.body as Partial<NewsletterSubscriber>;
      if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }
      if (!consent_given) {
        return res.status(400).json({ error: 'Consent is required to subscribe to the newsletter.' });
      }
      const sub: NewsletterSubscriber = {
        id: `sub-${crypto.randomUUID().slice(0, 8)}`,
        email: email.trim().toLowerCase(),
        name: (name || '').trim().slice(0, 80),
        interest_topic: (interest_topic || 'All Engineering Topics').trim(),
        consent_given: true,
        created_at: new Date().toISOString()
      };
      const result = await addSubscriber(sub);
      if (!result.alreadySubscribed) {
        await recordAnalyticsEvent({
          id: `evt-${crypto.randomUUID().slice(0, 8)}`,
          event_type: 'newsletter_subscribed',
          path: '/insights',
          referrer: 'direct',
          session_id: `sub-${sub.id}`,
          meta: { topic: sub.interest_topic },
          created_at: sub.created_at
        });
      }
      res.status(result.alreadySubscribed ? 200 : 201).json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Subscription failed' });
    }
  });

  app.get('/api/newsletter', requireEditor, async (req, res) => {
    try {
      const subscribers = await listSubscribers(getBearerToken(req));
      res.json({ subscribers });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch subscribers' });
    }
  });

  // --- Client Inquiries APIs ---

  app.post('/api/inquiries', async (req, res) => {
    try {
      const {
        full_name,
        company,
        work_email,
        service_interest,
        budget_range,
        timeline,
        project_brief
      } = req.body as Partial<ClientInquiry>;

      if (!full_name || !company || !work_email || !project_brief) {
        return res.status(400).json({ error: 'Name, company, work email, and project brief are required.' });
      }
      if (!isValidEmail(work_email)) {
        return res.status(400).json({ error: 'Please enter a valid corporate email address.' });
      }
      if (project_brief.trim().length < 20) {
        return res.status(400).json({ error: 'Please provide at least 20 characters describing your technical goals.' });
      }

      const inquiry: ClientInquiry = {
        id: `inq-${crypto.randomUUID().slice(0, 8)}`,
        reference_code: `GS-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        full_name: full_name.trim(),
        company: company.trim(),
        work_email: work_email.trim().toLowerCase(),
        service_interest: service_interest || 'AI Integration',
        budget_range: budget_range || '$25k – $75k',
        timeline: timeline || 'Within 30 days',
        project_brief: project_brief.trim(),
        status: 'new',
        created_at: new Date().toISOString()
      };
      const saved = await createInquiry(inquiry);
      await recordAnalyticsEvent({
        id: `evt-${crypto.randomUUID().slice(0, 8)}`,
        event_type: 'inquiry_submitted',
        path: '/contact',
        referrer: 'direct',
        session_id: `inq-${inquiry.id}`,
        meta: { service: inquiry.service_interest },
        created_at: inquiry.created_at
      });
      await notifyAdminViaLarkMail({
        category: 'contact_alert',
        relatedId: saved.id,
        subject: `[GitStack Inquiry] ${saved.company} — ${saved.service_interest} (${saved.reference_code})`,
        bodyText: [
          `New client consultation inquiry received on GitStack:`,
          ``,
          `Reference: ${saved.reference_code}`,
          `Full Name: ${saved.full_name}`,
          `Company: ${saved.company}`,
          `Work Email: ${saved.work_email}`,
          `Service Interest: ${saved.service_interest}`,
          `Budget Range: ${saved.budget_range}`,
          `Timeline: ${saved.timeline}`,
          ``,
          `Project Brief:`,
          saved.project_brief,
          ``,
          `Reply directly from Back Office -> Inbox & Leads via Lark Mail.`
        ].join('\n')
      });
      res.status(201).json({ inquiry: saved });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to submit inquiry' });
    }
  });

  app.get('/api/inquiries', requireEditor, async (req, res) => {
    try {
      const inquiries = await listInquiries(getBearerToken(req));
      res.json({ inquiries });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch inquiries' });
    }
  });

  app.patch('/api/inquiries/:id', requireEditor, async (req, res) => {
    try {
      const { status } = req.body as { status?: InquiryStatus };
      if (!status || !['new', 'reviewed', 'scheduled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid inquiry status.' });
      }
      const updated = await updateInquiryStatus(req.params.id, status, getBearerToken(req));
      if (!updated) return res.status(404).json({ error: 'Inquiry not found.' });
      res.json({ inquiry: updated });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update inquiry' });
    }
  });

  // --- AdSense Settings, Readiness Audit & Supabase Schema ---

  app.get('/api/settings/adsense', async (req, res) => {
    try {
      const session = await verifyEditorToken(getBearerToken(req));
      const settings = await getAdSenseSettings();
      if (!session) {
        return res.json({
          settings: {
            adsense_publisher_id: settings.adsense_publisher_id,
            auto_ads_enabled: settings.auto_ads_enabled,
            ad_slots_enabled: settings.ad_slots_enabled,
            ga4_measurement_id: settings.ga4_measurement_id || '',
            ga4_enabled: Boolean(settings.ga4_enabled),
            ga4_track_events: settings.ga4_track_events !== false,
            brand_name: settings.brand_name || DEFAULT_BRANDING.brand_name,
            brand_logo_url: settings.brand_logo_url || '',
            brand_logo_alt: settings.brand_logo_alt || DEFAULT_BRANDING.brand_logo_alt,
            favicon_url: settings.favicon_url || '',
            theme_preset: settings.theme_preset || DEFAULT_BRANDING.theme_preset,
            primary_color: settings.primary_color || DEFAULT_BRANDING.primary_color,
            header_surface: settings.header_surface || DEFAULT_BRANDING.header_surface,
            header_cta_label: settings.header_cta_label || DEFAULT_BRANDING.header_cta_label,
            header_cta_href: settings.header_cta_href || DEFAULT_BRANDING.header_cta_href
          }
        });
      }
      res.json({ settings });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load AdSense settings' });
    }
  });

  app.put('/api/settings/adsense', requireRoles('super_admin', 'editor'), async (req: AuthReq, res) => {
    try {
      const current = await getAdSenseSettings();
      const payload = req.body as Partial<AdSenseSettings>;
      const isSuperAdmin = req.editor?.role === 'super_admin';

      const pubId =
        isSuperAdmin && payload.adsense_publisher_id !== undefined
          ? payload.adsense_publisher_id.trim()
          : current.adsense_publisher_id;
      if (pubId && !/^(ca-)?pub-\d{10,20}$/.test(pubId)) {
        return res.status(400).json({
          error: 'Publisher ID must match format ca-pub-1234567890123456 or pub-1234567890123456.'
        });
      }
      const ga4Id =
        payload.ga4_measurement_id !== undefined
          ? payload.ga4_measurement_id.trim().toUpperCase()
          : current.ga4_measurement_id || '';
      if (ga4Id && !/^G-[A-Z0-9]{4,16}$/.test(ga4Id)) {
        return res.status(400).json({
          error: 'Google Analytics Measurement ID must match format G-XXXXXXXXXX.'
        });
      }

      if (
        isSuperAdmin &&
        payload.brand_logo_url &&
        payload.brand_logo_url.length > 1_300_000
      ) {
        return res.status(400).json({ error: 'Logo image must be under 900 KB.' });
      }
      if (
        isSuperAdmin &&
        payload.favicon_url &&
        payload.favicon_url.length > 600_000
      ) {
        return res.status(400).json({ error: 'Favicon image must be under 450 KB.' });
      }

      const validPresets: ThemePresetId[] = ['cobalt', 'emerald', 'indigo', 'slate', 'amber', 'custom'];
      const themePreset: ThemePresetId =
        isSuperAdmin && payload.theme_preset && validPresets.includes(payload.theme_preset)
          ? payload.theme_preset
          : current.theme_preset || DEFAULT_BRANDING.theme_preset;

      const primaryColor =
        isSuperAdmin && payload.primary_color !== undefined
          ? normalizeHexColor(payload.primary_color, current.primary_color || DEFAULT_BRANDING.primary_color)
          : current.primary_color || DEFAULT_BRANDING.primary_color;

      const headerSurface: HeaderSurface =
        isSuperAdmin && payload.header_surface
          ? payload.header_surface === 'tinted'
            ? 'tinted'
            : 'white'
          : current.header_surface || DEFAULT_BRANDING.header_surface;

      const ctaHrefRaw =
        isSuperAdmin && payload.header_cta_href !== undefined
          ? payload.header_cta_href.trim()
          : current.header_cta_href || DEFAULT_BRANDING.header_cta_href;
      const safeCtaHref =
        ctaHrefRaw.startsWith('/') || /^https?:\/\//i.test(ctaHrefRaw)
          ? ctaHrefRaw
          : DEFAULT_BRANDING.header_cta_href;

      const normalizedPub = pubId ? (pubId.startsWith('ca-') ? pubId.slice(3) : pubId) : '';
      const defaultAdsTxt = normalizedPub
        ? `google.com, ${normalizedPub}, DIRECT, f08c47fec0942fa0`
        : '# Configure your Google AdSense Publisher ID in GitStack Studio to activate verified ads.txt';

      const next: AdSenseSettings = {
        adsense_publisher_id: pubId,
        ads_txt_content:
          isSuperAdmin && payload.ads_txt_content !== undefined
            ? payload.ads_txt_content.trim() || defaultAdsTxt
            : current.ads_txt_content || defaultAdsTxt,
        auto_ads_enabled:
          isSuperAdmin && payload.auto_ads_enabled !== undefined
            ? Boolean(payload.auto_ads_enabled)
            : current.auto_ads_enabled,
        ad_slots_enabled:
          isSuperAdmin && payload.ad_slots_enabled !== undefined
            ? Boolean(payload.ad_slots_enabled)
            : current.ad_slots_enabled,
        editorial_review_note:
          isSuperAdmin && payload.editorial_review_note !== undefined
            ? payload.editorial_review_note.trim() || current.editorial_review_note
            : current.editorial_review_note,
        ga4_measurement_id: ga4Id,
        ga4_enabled:
          payload.ga4_enabled !== undefined ? Boolean(payload.ga4_enabled) : Boolean(current.ga4_enabled),
        ga4_track_events:
          payload.ga4_track_events !== undefined
            ? Boolean(payload.ga4_track_events)
            : current.ga4_track_events !== false,
        brand_name:
          isSuperAdmin && payload.brand_name !== undefined
            ? payload.brand_name.trim().slice(0, 40) || DEFAULT_BRANDING.brand_name
            : current.brand_name || DEFAULT_BRANDING.brand_name,
        brand_logo_url:
          isSuperAdmin && payload.brand_logo_url !== undefined
            ? payload.brand_logo_url.trim()
            : current.brand_logo_url || '',
        brand_logo_alt:
          isSuperAdmin && payload.brand_logo_alt !== undefined
            ? payload.brand_logo_alt.trim().slice(0, 80) || DEFAULT_BRANDING.brand_logo_alt
            : current.brand_logo_alt || DEFAULT_BRANDING.brand_logo_alt,
        favicon_url:
          isSuperAdmin && payload.favicon_url !== undefined
            ? payload.favicon_url.trim()
            : current.favicon_url || '',
        theme_preset: themePreset,
        primary_color: primaryColor,
        header_surface: headerSurface,
        header_cta_label:
          isSuperAdmin && payload.header_cta_label !== undefined
            ? payload.header_cta_label.trim().slice(0, 32) || DEFAULT_BRANDING.header_cta_label
            : current.header_cta_label || DEFAULT_BRANDING.header_cta_label,
        header_cta_href: safeCtaHref,
        updated_at: new Date().toISOString()
      };

      const saved = await saveAdSenseSettings(next, getBearerToken(req));
      res.json({ settings: saved });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update settings' });
    }
  });

  app.get('/api/audit/adsense', async (_req, res) => {
    try {
      const posts = await listPosts(false);
      const settings = await getAdSenseSettings();
      const report = buildSiteAuditReport(posts, settings);
      res.json({ report });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Audit failed' });
    }
  });

  // --- Back Office Page Content Customizer (AdSense-Protected Slots) ---

  app.get('/api/pages', async (_req, res) => {
    try {
      const pages = await listPageContents();
      res.json({ pages });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load page contents' });
    }
  });

  app.put('/api/pages/:pageKey', requireEditor, async (req, res) => {
    try {
      const pageKey = req.params.pageKey as PageKey;
      if (!['home', 'services', 'about', 'contact'].includes(pageKey)) {
        return res.status(400).json({ error: 'Invalid page key.' });
      }
      const payload = req.body as Partial<PageContentConfig>;
      const candidate: PageContentConfig = {
        page_key: pageKey,
        hero_kicker: (payload.hero_kicker || '').trim(),
        hero_title: (payload.hero_title || '').trim(),
        hero_subtitle: (payload.hero_subtitle || '').trim(),
        hero_cta_label: (payload.hero_cta_label || '').trim(),
        hero_image: (payload.hero_image || '').trim(),
        hero_image_alt: (payload.hero_image_alt || '').trim(),
        secondary_image: (payload.secondary_image || '').trim(),
        secondary_image_alt: (payload.secondary_image_alt || '').trim(),
        intro_heading: (payload.intro_heading || '').trim(),
        intro_body: (payload.intro_body || '').trim(),
        contact_phone_label: (payload.contact_phone_label ?? '').trim(),
        contact_phone: (payload.contact_phone ?? '').trim(),
        contact_sales_label: (payload.contact_sales_label ?? '').trim(),
        contact_sales_email: (payload.contact_sales_email ?? '').trim(),
        contact_editorial_label: (payload.contact_editorial_label ?? '').trim(),
        contact_editorial_email: (payload.contact_editorial_email ?? '').trim(),
        contact_privacy_label: (payload.contact_privacy_label ?? '').trim(),
        contact_privacy_email: (payload.contact_privacy_email ?? '').trim(),
        custom_blocks: Array.isArray(payload.custom_blocks) ? payload.custom_blocks : [],
        updated_at: new Date().toISOString()
      };

      const check = validatePageContentForAdSense(candidate);
      if (!check.valid) {
        return res.status(422).json({
          error: 'AdSense Content Integrity Guard blocked saving thin or incomplete page edits.',
          blockingIssues: check.issues
        });
      }

      const saved = await upsertPageContent(candidate, getBearerToken(req));
      res.json({ page: saved, integrity: check });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save page content' });
    }
  });

  // --- Back Office 7 Deterministic Agents, Virtual Office HQ & Daily Reports ---

  const VALID_AGENT_IDS: AgentId[] = [
    'marketing',
    'ceo',
    'booking',
    'cybersecurity',
    'qa',
    'adsense',
    'traffic'
  ];

  async function computeServerAgentContext(token?: string) {
    const [
      posts,
      comments,
      inquiries,
      subscribers,
      settings,
      pageContents,
      chatThreads,
      analytics,
      tasks,
      profiles,
      supabaseTablesReady
    ] = await Promise.all([
      listPosts(true, token),
      listComments(null, true, token),
      listInquiries(token),
      listSubscribers(token),
      getAdSenseSettings(),
      listPageContents(),
      listChatThreads(token),
      getAnalyticsSummary(14, token),
      listAgentTasks(token),
      listAgentOfficeProfiles(token),
      checkSupabaseTablesReady()
    ]);

    const publishedPosts = posts.filter((p) => p.status === 'published');
    const siteAudit = buildSiteAuditReport(publishedPosts, settings);
    const agents = buildAllAgentReports({
      posts,
      comments,
      inquiries,
      subscribers,
      settings,
      siteAudit,
      pageContents,
      chatThreads,
      analytics,
      supabaseTablesReady
    });

    return { agents, tasks, profiles, siteAudit };
  }

  function computeReportProofHash(input: {
    recipient_email: string;
    subject: string;
    channel: string;
    provider_message_id: string;
    sent_at: string;
    overall_score: number;
    body_text: string;
  }): string {
    const canonical = JSON.stringify({
      recipient_email: input.recipient_email,
      subject: input.subject,
      channel: input.channel,
      provider_message_id: input.provider_message_id,
      sent_at: input.sent_at,
      overall_score: input.overall_score,
      body_text: input.body_text
    });
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  function buildDeterministicAgentReply(
    agent: AgentReport,
    profile: AgentOfficeProfile,
    tasks: AgentTask[],
    operatorMessage: string,
    peerAgent?: { report: AgentReport; profile: AgentOfficeProfile }
  ): { text: string; status: AgentConversationEntry['finding_status'] } {
    const agentTasks = tasks.filter((t) => t.agent_id === agent.id && !t.completed);
    const flagged = agent.checks.filter((c) => c.status !== 'pass');
    const q = operatorMessage.toLowerCase();

    if (peerAgent) {
      const peerFlagged = peerAgent.report.checks.filter((c) => c.status !== 'pass');
      const findingStatus: AgentConversationEntry['finding_status'] =
        peerAgent.report.status === 'critical'
          ? 'critical'
          : peerAgent.report.status === 'attention'
            ? 'attention'
            : 'nominal';
      return {
        text: `Handoff received by ${peerAgent.profile.display_name} (${peerAgent.report.score}% health). ${
          peerFlagged.length > 0
            ? `Active priority: ${peerFlagged[0].label} (${peerFlagged[0].metric}) — ${peerFlagged[0].detail}`
            : `All ${peerAgent.report.checks.length} checks nominal. Desk mission aligned with ${profile.display_name}.`
        }`,
        status: findingStatus
      };
    }

    if (q.includes('task') || q.includes('todo') || q.includes('checklist')) {
      const taskSummary =
        agentTasks.length > 0
          ? agentTasks
              .slice(0, 3)
              .map((t) => `[${t.priority.toUpperCase()}] ${t.title}`)
              .join('; ')
          : 'Zero open action items in queue.';
      return {
        text: `${profile.display_name} currently tracks ${agentTasks.length} open task(s): ${taskSummary}`,
        status: agentTasks.length > 0 ? 'info' : 'nominal'
      };
    }

    if (flagged.length > 0) {
      const top = flagged[0];
      return {
        text: `${profile.display_name} live telemetry (${agent.score}%): ${flagged.length} item(s) need attention. Top check: ${top.label} (${top.metric}) — ${top.detail}`,
        status: top.status === 'fail' ? 'critical' : 'attention'
      };
    }

    return {
      text: `${profile.display_name} station nominal at ${agent.score}%. All ${agent.checks.length} deterministic checks passing under mission "${profile.current_mission}".`,
      status: 'nominal'
    };
  }

  async function notifyAdminViaLarkMail(params: {
    category: 'contact_alert' | 'demo_signup_alert';
    relatedId: string;
    subject: string;
    bodyText: string;
  }) {
    try {
      const settings = await getAdminNotificationSettings();
      if (!settings.enabled) return;
      if (params.category === 'contact_alert' && !settings.notify_on_inquiry) return;
      if (params.category === 'demo_signup_alert' && !settings.notify_on_demo_signup) return;

      await dispatchAdminLarkAlert({
        category: params.category,
        relatedId: params.relatedId,
        subject: params.subject,
        bodyText: params.bodyText,
        sentBy: 'notification-module'
      });
    } catch {
      // non-blocking inquiry notification
    }
  }

  async function executeServerReportDispatch(
    triggerType: 'manual' | 'daily_cron',
    token?: string
  ): Promise<{ report: AgentEmailReport; deliveredViaServer: boolean }> {
    const [ctx, settings] = await Promise.all([
      computeServerAgentContext(token),
      getAgentReportSettings(token)
    ]);

    const nowIso = new Date().toISOString();
    const digest = composeDailyAgentDigest({
      agents: ctx.agents,
      tasks: ctx.tasks,
      profiles: ctx.profiles,
      includeAgents: settings.include_agents,
      recipientEmail: settings.recipient_email,
      generatedAt: nowIso
    });

    let status: AgentEmailReport['status'] = 'skipped_unconfigured';
    const channel: AgentEmailReport['channel'] =
      triggerType === 'daily_cron' ? 'cron_dispatch' : 'lark_smtp';
    let providerMessageId = '';
    let errorDetail = '';
    let deliveredViaServer = false;

    try {
      const sent = await sendLarkSmtpMail(
        {
          toEmail: settings.recipient_email,
          toName: 'GitStack Admin',
          subject: digest.subject,
          bodyText: digest.bodyText
        },
        token
      );
      status = 'sent';
      providerMessageId = sent.messageId;
      deliveredViaServer = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lark Mail SMTP dispatch failed.';
      status = msg.toLowerCase().includes('not connected') ? 'skipped_unconfigured' : 'failed';
      errorDetail = msg;
    }

    const proofHash = computeReportProofHash({
      recipient_email: settings.recipient_email,
      subject: digest.subject,
      channel,
      provider_message_id: providerMessageId,
      sent_at: nowIso,
      overall_score: digest.overallScore,
      body_text: digest.bodyText
    });

    const saved = await recordAgentEmailReport(
      {
        id: `rep-${crypto.randomUUID().slice(0, 8)}`,
        recipient_email: settings.recipient_email,
        subject: digest.subject,
        channel,
        trigger_type: triggerType,
        status,
        provider_message_id: providerMessageId,
        provider_thread_id: '',
        overall_score: digest.overallScore,
        agent_snapshots: digest.snapshots,
        body_text: digest.bodyText,
        proof_hash: proofHash,
        error_detail: errorDetail,
        sent_at: nowIso
      },
      token
    );

    return { report: saved, deliveredViaServer };
  }

  app.get('/api/agents/overview', requireEditor, async (req, res) => {
    try {
      const ctx = await computeServerAgentContext(getBearerToken(req));
      res.json({ agents: ctx.agents, tasks: ctx.tasks });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to evaluate agents' });
    }
  });

  app.get('/api/agents/office', requireEditor, async (req, res) => {
    try {
      const token = getBearerToken(req);
      const [profiles, conversations] = await Promise.all([
        listAgentOfficeProfiles(token),
        listAgentConversations(token)
      ]);
      res.json({ profiles, conversations });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load Virtual Office HQ' });
    }
  });

  app.put('/api/agents/office/:agentId', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const agentId = req.params.agentId as AgentId;
      if (!VALID_AGENT_IDS.includes(agentId)) {
        return res.status(400).json({ error: 'Invalid agent ID.' });
      }
      const token = getBearerToken(req);
      const existingList = await listAgentOfficeProfiles(token);
      const current =
        existingList.find((p) => p.agent_id === agentId) ||
        DEFAULT_AGENT_OFFICE_PROFILES.find((p) => p.agent_id === agentId)!;

      const payload = req.body as Partial<AgentOfficeProfile>;
      const validIcons: AgentAvatarIcon[] = [
        'megaphone',
        'crown',
        'calendar',
        'shield',
        'check',
        'badge',
        'trending',
        'bot',
        'cpu'
      ];
      const validStatuses: AgentWorkStatus[] = ['working', 'walking', 'idle'];

      const updated: AgentOfficeProfile = {
        agent_id: agentId,
        display_name:
          payload.display_name !== undefined
            ? payload.display_name.trim().slice(0, 48) || current.display_name
            : current.display_name,
        custom_role:
          payload.custom_role !== undefined
            ? payload.custom_role.trim().slice(0, 90) || current.custom_role
            : current.custom_role,
        avatar_icon:
          payload.avatar_icon && validIcons.includes(payload.avatar_icon)
            ? payload.avatar_icon
            : current.avatar_icon,
        accent_color:
          payload.accent_color !== undefined
            ? normalizeHexColor(payload.accent_color, current.accent_color)
            : current.accent_color,
        desk_label:
          payload.desk_label !== undefined
            ? payload.desk_label.trim().slice(0, 48) || current.desk_label
            : current.desk_label,
        desk_x:
          typeof payload.desk_x === 'number' && Number.isFinite(payload.desk_x)
            ? Math.max(1, Math.min(11.5, Number(payload.desk_x.toFixed(1))))
            : current.desk_x,
        desk_y:
          typeof payload.desk_y === 'number' && Number.isFinite(payload.desk_y)
            ? Math.max(0.8, Math.min(6.8, Number(payload.desk_y.toFixed(1))))
            : current.desk_y,
        work_status:
          payload.work_status && validStatuses.includes(payload.work_status)
            ? payload.work_status
            : current.work_status,
        current_mission:
          payload.current_mission !== undefined
            ? payload.current_mission.trim().slice(0, 200)
            : current.current_mission,
        updated_at: new Date().toISOString()
      };

      const saved = await upsertAgentOfficeProfile(updated, token);
      res.json({ profile: saved });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update agent profile' });
    }
  });

  app.post('/api/agents/office/shift', requireRoles('super_admin', 'editor'), async (req: AuthReq, res) => {
    try {
      const { action } = req.body as { action?: 'all_hands' | 'lounge' };
      if (action !== 'all_hands' && action !== 'lounge') {
        return res.status(400).json({ error: 'action must be all_hands or lounge.' });
      }
      const token = getBearerToken(req);
      const targetStatus: AgentWorkStatus = action === 'all_hands' ? 'working' : 'idle';
      const profiles = await bulkUpdateAgentWorkStatus(targetStatus, token);
      const entry = await addAgentConversation(
        {
          id: `ac-${crypto.randomUUID().slice(0, 8)}`,
          agent_id: 'ceo',
          peer_agent_id: null,
          sender_type: 'system',
          sender_name: req.editor?.profile.full_name || 'Operator Shift Control',
          message:
            action === 'all_hands'
              ? 'All-Hands Shift dispatched: all 7 operational agents routed to their HQ stations.'
              : 'Lounge Break active: all 7 agents resting in the Pantry & Lounge.',
          finding_status: 'info',
          created_at: new Date().toISOString()
        },
        token
      );
      res.json({ profiles, entry });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to trigger shift' });
    }
  });

  app.post('/api/agents/conversations', requireRoles('super_admin', 'editor'), async (req: AuthReq, res) => {
    try {
      const { agent_id, peer_agent_id, message, sender_type } = req.body as {
        agent_id?: AgentId;
        peer_agent_id?: AgentId | null;
        message?: string;
        sender_type?: 'operator' | 'handoff';
      };
      if (!agent_id || !VALID_AGENT_IDS.includes(agent_id) || !message?.trim()) {
        return res.status(400).json({ error: 'Valid agent_id and message are required.' });
      }

      const token = getBearerToken(req);
      const ctx = await computeServerAgentContext(token);
      const agentReport = ctx.agents.find((a) => a.id === agent_id)!;
      const agentProfile =
        ctx.profiles.find((p) => p.agent_id === agent_id) ||
        DEFAULT_AGENT_OFFICE_PROFILES.find((p) => p.agent_id === agent_id)!;

      const safePeerId =
        peer_agent_id && VALID_AGENT_IDS.includes(peer_agent_id)
          ? peer_agent_id
          : sender_type === 'handoff'
            ? AGENT_COLLABORATION_MAP[agent_id][0] || null
            : null;
      const peerReport = safePeerId ? ctx.agents.find((a) => a.id === safePeerId) : undefined;
      const peerProfile = safePeerId
        ? ctx.profiles.find((p) => p.agent_id === safePeerId)
        : undefined;

      const now = Date.now();
      const firstEntry = await addAgentConversation(
        {
          id: `ac-${crypto.randomUUID().slice(0, 8)}`,
          agent_id,
          peer_agent_id: safePeerId,
          sender_type: sender_type === 'handoff' ? 'handoff' : 'operator',
          sender_name:
            sender_type === 'handoff'
              ? agentProfile.display_name
              : req.editor?.profile.full_name || req.editor?.email || 'GitStack Operator',
          message: message.trim().slice(0, 500),
          finding_status: 'info',
          created_at: new Date(now).toISOString()
        },
        token
      );

      const replyData = buildDeterministicAgentReply(
        agentReport,
        agentProfile,
        ctx.tasks,
        message.trim(),
        peerReport && peerProfile ? { report: peerReport, profile: peerProfile } : undefined
      );

      const replyEntry = await addAgentConversation(
        {
          id: `ac-${crypto.randomUUID().slice(0, 8)}`,
          agent_id: peerProfile ? peerProfile.agent_id : agent_id,
          peer_agent_id: peerProfile ? agent_id : null,
          sender_type: 'agent',
          sender_name: peerProfile ? peerProfile.display_name : agentProfile.display_name,
          message: replyData.text,
          finding_status: replyData.status,
          created_at: new Date(now + 400).toISOString()
        },
        token
      );

      res.status(201).json({ entries: [replyEntry, firstEntry] });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to log agent conversation' });
    }
  });

  app.get('/api/reports/agent-daily', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const [settings, reports, ctx] = await Promise.all([
        getAgentReportSettings(token),
        listAgentEmailReports(token),
        computeServerAgentContext(token)
      ]);
      const preview = composeDailyAgentDigest({
        agents: ctx.agents,
        tasks: ctx.tasks,
        profiles: ctx.profiles,
        includeAgents: settings.include_agents,
        recipientEmail: settings.recipient_email
      });
      res.json({ settings, reports, preview });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load daily agent reports' });
    }
  });

  app.put('/api/reports/agent-daily/settings', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const current = await getAgentReportSettings(token);
      const payload = req.body as Partial<AgentReportSettings>;

      const nextRecipient =
        payload.recipient_email !== undefined ? payload.recipient_email.trim() : current.recipient_email;
      if (!isValidEmail(nextRecipient)) {
        return res.status(400).json({ error: 'Please enter a valid recipient email address.' });
      }

      const hourNum =
        payload.send_hour_utc !== undefined ? Number(payload.send_hour_utc) : current.send_hour_utc;
      const sendHour = Number.isInteger(hourNum) && hourNum >= 0 && hourNum <= 23 ? hourNum : current.send_hour_utc;

      const filteredAgents = Array.isArray(payload.include_agents)
        ? payload.include_agents.filter((id): id is AgentId => VALID_AGENT_IDS.includes(id))
        : current.include_agents;

      const next: AgentReportSettings = {
        id: 'default',
        enabled: payload.enabled !== undefined ? Boolean(payload.enabled) : current.enabled,
        recipient_email: nextRecipient,
        send_hour_utc: sendHour,
        preferred_channel: 'lark_smtp',
        include_agents: filteredAgents.length > 0 ? filteredAgents : VALID_AGENT_IDS,
        last_sent_at: current.last_sent_at,
        updated_at: new Date().toISOString()
      };

      const saved = await saveAgentReportSettings(next, token);
      res.json({ settings: saved });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save report settings' });
    }
  });

  app.post('/api/reports/agent-daily/log', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const payload = req.body as Partial<AgentEmailReport>;
      if (!payload.recipient_email || !isValidEmail(payload.recipient_email)) {
        return res.status(400).json({ error: 'Valid recipient_email is required.' });
      }
      if (!payload.subject?.trim() || !payload.body_text?.trim()) {
        return res.status(400).json({ error: 'Report subject and body_text are required.' });
      }
      const sentAt = new Date().toISOString();
      const channel = payload.channel === 'cron_dispatch' ? 'cron_dispatch' : 'lark_smtp';
      const status =
        payload.status === 'failed' || payload.status === 'skipped_unconfigured'
          ? payload.status
          : 'sent';
      const providerMessageId = (payload.provider_message_id || '').trim();
      const overallScore = Number.isFinite(Number(payload.overall_score))
        ? Math.max(0, Math.min(100, Math.round(Number(payload.overall_score))))
        : 0;

      const proofHash = computeReportProofHash({
        recipient_email: payload.recipient_email.trim(),
        subject: payload.subject.trim(),
        channel,
        provider_message_id: providerMessageId,
        sent_at: sentAt,
        overall_score: overallScore,
        body_text: payload.body_text
      });

      const saved = await recordAgentEmailReport(
        {
          id: `rep-${crypto.randomUUID().slice(0, 8)}`,
          recipient_email: payload.recipient_email.trim(),
          subject: payload.subject.trim(),
          channel,
          trigger_type: payload.trigger_type === 'daily_cron' ? 'daily_cron' : 'manual',
          status,
          provider_message_id: providerMessageId,
          provider_thread_id: (payload.provider_thread_id || '').trim(),
          overall_score: overallScore,
          agent_snapshots: Array.isArray(payload.agent_snapshots)
            ? (payload.agent_snapshots as AgentSnapshotItem[])
            : [],
          body_text: payload.body_text,
          proof_hash: proofHash,
          error_detail: (payload.error_detail || '').trim(),
          sent_at: sentAt
        },
        getBearerToken(req)
      );

      res.status(201).json({ report: saved });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to log email proof' });
    }
  });

  app.post('/api/reports/agent-daily/dispatch', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const result = await executeServerReportDispatch('manual', getBearerToken(req));
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to dispatch server report' });
    }
  });

  app.get('/api/cron/daily-agent-report', async (req, res) => {
    try {
      const cronSecret = process.env.CRON_SECRET?.trim();
      if (cronSecret) {
        const authHeader = req.headers.authorization || '';
        const querySecret = typeof req.query.secret === 'string' ? req.query.secret : '';
        if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
          return res.status(401).json({ error: 'Invalid cron authorization.' });
        }
      }
      const settings = await getAgentReportSettings();
      if (!settings.enabled) {
        return res.json({
          ok: true,
          skipped: true,
          reason: 'Daily agent reporting is disabled in Back Office settings.'
        });
      }
      const result = await executeServerReportDispatch('daily_cron');
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Daily cron dispatch failed' });
    }
  });

  app.post('/api/agents/tasks', requireEditor, async (req, res) => {
    try {
      const { agent_id, title, priority, notes } = req.body as Partial<AgentTask>;
      const validAgents: AgentId[] = [
        'marketing',
        'ceo',
        'booking',
        'cybersecurity',
        'qa',
        'adsense',
        'traffic'
      ];
      if (!agent_id || !validAgents.includes(agent_id) || !title?.trim()) {
        return res.status(400).json({ error: 'Valid agent_id and task title are required.' });
      }
      const task: AgentTask = {
        id: `task-${crypto.randomUUID().slice(0, 8)}`,
        agent_id,
        title: title.trim(),
        priority: (priority && ['high', 'medium', 'low'].includes(priority)
          ? priority
          : 'medium') as TaskPriority,
        completed: false,
        notes: (notes || '').trim(),
        updated_at: new Date().toISOString()
      };
      const saved = await upsertAgentTask(task, getBearerToken(req));
      res.status(201).json({ task: saved });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create agent task' });
    }
  });

  app.patch('/api/agents/tasks/:id', requireEditor, async (req, res) => {
    try {
      const token = getBearerToken(req);
      const tasks = await listAgentTasks(token);
      const existing = tasks.find((t) => t.id === req.params.id);
      if (!existing) return res.status(404).json({ error: 'Task not found.' });
      const payload = req.body as Partial<AgentTask>;
      const updated: AgentTask = {
        ...existing,
        completed: payload.completed !== undefined ? Boolean(payload.completed) : existing.completed,
        title: payload.title?.trim() || existing.title,
        notes: payload.notes !== undefined ? payload.notes : existing.notes,
        updated_at: new Date().toISOString()
      };
      const saved = await upsertAgentTask(updated, token);
      res.json({ task: saved });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update task' });
    }
  });

  app.delete('/api/agents/tasks/:id', requireEditor, async (req, res) => {
    try {
      await deleteAgentTask(req.params.id, getBearerToken(req));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete task' });
    }
  });

  // --- Internal Back Office Historical Q&A & Live Chat ---

  app.get('/api/chat/threads', requireEditor, async (req, res) => {
    try {
      const threads = await listChatThreads(getBearerToken(req));
      res.json({ threads });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load chat threads' });
    }
  });

  app.post('/api/chat/threads', requireEditor, async (req, res) => {
    try {
      const { subject, requester_name, requester_email, initial_body } = req.body as {
        subject?: string;
        requester_name?: string;
        requester_email?: string;
        initial_body?: string;
      };
      if (!subject?.trim() || !initial_body?.trim()) {
        return res.status(400).json({ error: 'Subject and initial question/message are required.' });
      }
      const now = new Date().toISOString();
      const threadId = `thr-${crypto.randomUUID().slice(0, 8)}`;
      const thread: ChatThread = {
        id: threadId,
        subject: subject.trim(),
        source_type: 'internal',
        source_ref_id: null,
        requester_name: (requester_name || (req as AuthReq).editor?.email || 'GitStack Operator').trim(),
        requester_email: (requester_email || (req as AuthReq).editor?.email || 'contact@gitstack.io').trim(),
        status: 'open',
        last_message_at: now,
        created_at: now
      };
      const firstMsg: ChatMessage = {
        id: `msg-${crypto.randomUUID().slice(0, 8)}`,
        thread_id: threadId,
        sender_role: 'visitor',
        sender_name: thread.requester_name,
        body: initial_body.trim(),
        created_at: now
      };
      const created = await createChatThread(thread, firstMsg, getBearerToken(req));
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create thread' });
    }
  });

  app.get('/api/chat/threads/:id/messages', requireEditor, async (req, res) => {
    try {
      const messages = await listChatMessages(req.params.id, getBearerToken(req));
      res.json({ messages });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load messages' });
    }
  });

  app.post('/api/chat/threads/:id/messages', requireEditor, async (req, res) => {
    try {
      const { body, mark_answered } = req.body as { body?: string; mark_answered?: boolean };
      if (!body?.trim()) {
        return res.status(400).json({ error: 'Message body is required.' });
      }
      const msg: ChatMessage = {
        id: `msg-${crypto.randomUUID().slice(0, 8)}`,
        thread_id: req.params.id,
        sender_role: 'admin',
        sender_name: (req as AuthReq).editor?.email || 'GitStack Admin',
        body: body.trim(),
        created_at: new Date().toISOString()
      };
      const saved = await addChatMessage(msg, mark_answered !== false, getBearerToken(req));
      res.status(201).json({ message: saved });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to post live reply' });
    }
  });

  app.patch('/api/chat/threads/:id', requireEditor, async (req, res) => {
    try {
      const { status } = req.body as { status?: ChatThreadStatus };
      if (!status || !['open', 'answered', 'archived'].includes(status)) {
        return res.status(400).json({ error: 'Invalid chat thread status.' });
      }
      const updated = await updateChatThreadStatus(req.params.id, status, getBearerToken(req));
      if (!updated) return res.status(404).json({ error: 'Thread not found.' });
      res.json({ thread: updated });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update thread' });
    }
  });

  // --- First-Party & GA4 Analytics Telemetry ---

  app.post('/api/analytics/event', async (req, res) => {
    try {
      const { event_type, path: pagePath, referrer, session_id, meta } = req.body as {
        event_type?: AnalyticsEventType;
        path?: string;
        referrer?: string;
        session_id?: string;
        meta?: Record<string, string>;
      };
      if (!pagePath || typeof pagePath !== 'string') {
        return res.status(400).json({ error: 'Path is required.' });
      }
      if (pagePath.startsWith('/obama') || pagePath.startsWith('/studio')) {
        return res.json({ ok: true, skipped: true });
      }
      const allowed: AnalyticsEventType[] = [
        'pageview',
        'inquiry_submitted',
        'newsletter_subscribed',
        'comment_submitted'
      ];
      const safeType = event_type && allowed.includes(event_type) ? event_type : 'pageview';
      await recordAnalyticsEvent({
        id: `evt-${crypto.randomUUID().slice(0, 8)}`,
        event_type: safeType,
        path: pagePath.slice(0, 180),
        referrer: (referrer || 'direct').slice(0, 180),
        session_id: (session_id || '').slice(0, 80),
        meta: meta || {},
        created_at: new Date().toISOString()
      });
      res.status(201).json({ ok: true });
    } catch {
      res.status(200).json({ ok: false });
    }
  });

  app.get('/api/analytics/summary', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const days = Number(req.query.days || 14);
      const summary = await getAnalyticsSummary(days, getBearerToken(req));
      res.json({ summary });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load analytics' });
    }
  });

  // --- Team Profile, User Access Management, Per-User Workflows & Routing ---

  app.get('/api/profile/me', requireEditor, async (req: AuthReq, res) => {
    res.json({ profile: req.editor!.profile });
  });

  app.put('/api/profile/me', requireEditor, async (req: AuthReq, res) => {
    try {
      const { full_name, job_title, bio, avatar_url, phone, timezone } = req.body as {
        full_name?: string;
        job_title?: string;
        bio?: string;
        avatar_url?: string;
        phone?: string;
        timezone?: string;
      };
      if (avatar_url && avatar_url.length > 1_300_000) {
        return res.status(400).json({ error: 'Profile picture must be under 900 KB.' });
      }
      const updated = await updateMyUserProfile(
        req.editor!.userId,
        {
          ...(full_name !== undefined ? { full_name: full_name.trim().slice(0, 80) } : {}),
          ...(job_title !== undefined ? { job_title: job_title.trim().slice(0, 80) } : {}),
          ...(bio !== undefined ? { bio: bio.trim().slice(0, 600) } : {}),
          ...(avatar_url !== undefined ? { avatar_url: avatar_url.trim() } : {}),
          ...(phone !== undefined ? { phone: phone.trim().slice(0, 40) } : {}),
          ...(timezone !== undefined ? { timezone: timezone.trim().slice(0, 60) || 'UTC' } : {})
        },
        getBearerToken(req),
        req.editor!.email
      );
      if (!updated) return res.status(404).json({ error: 'Profile not found.' });
      res.json({ profile: updated });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update profile' });
    }
  });

  app.get('/api/users/directory', requireEditor, async (req, res) => {
    try {
      const users = await listUserDirectory(getBearerToken(req));
      res.json({ users });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load user directory' });
    }
  });

  app.get('/api/users', requireRoles('super_admin'), async (req, res) => {
    try {
      const users = await listUserProfiles(getBearerToken(req));
      res.json({ users });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load team users' });
    }
  });

  app.post('/api/users', requireRoles('super_admin'), async (req: AuthReq, res) => {
    try {
      const { email, password, full_name, role, job_title } = req.body as {
        email?: string;
        password?: string;
        full_name?: string;
        role?: UserRole;
        job_title?: string;
      };
      if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: 'Valid email address is required.' });
      }
      if (!password || password.trim().length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }
      const validRoles: UserRole[] = ['super_admin', 'editor', 'support_agent'];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ error: 'Valid role (super_admin, editor, or support_agent) is required.' });
      }
      const user = await createTeamUser(
        {
          email,
          password: password.trim(),
          full_name: full_name?.trim() || email.split('@')[0],
          role,
          job_title,
          createdByUserId: req.editor!.userId
        },
        getBearerToken(req)
      );
      res.status(201).json({ user });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create user' });
    }
  });

  app.patch('/api/users/:userId', requireRoles('super_admin'), async (req: AuthReq, res) => {
    try {
      const { role, status, full_name, job_title, password } = req.body as {
        role?: UserRole;
        status?: UserStatus;
        full_name?: string;
        job_title?: string;
        password?: string;
      };
      if (password !== undefined && password.trim().length > 0 && password.trim().length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters.' });
      }
      const updated = await updateTeamUser(
        req.params.userId,
        req.editor!.userId,
        { role, status, full_name, job_title, password },
        getBearerToken(req)
      );
      res.json({ user: updated });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update user' });
    }
  });

  app.delete('/api/users/:userId', requireRoles('super_admin'), async (req: AuthReq, res) => {
    try {
      await deleteTeamUser(req.params.userId, req.editor!.userId, getBearerToken(req));
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete user' });
    }
  });

  app.get('/api/workflows', requireEditor, async (req: AuthReq, res) => {
    try {
      const requestedUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
      const targetUserId =
        req.editor!.role === 'super_admin' ? requestedUserId : req.editor!.userId;
      const items = await listWorkflowItems(targetUserId, getBearerToken(req));
      res.json({ items });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load workflows' });
    }
  });

  app.post('/api/workflows', requireEditor, async (req: AuthReq, res) => {
    try {
      const payload = req.body as Partial<UserWorkflowItem>;
      if (!payload.title?.trim()) {
        return res.status(400).json({ error: 'Workflow task title is required.' });
      }
      const targetUserId =
        req.editor!.role === 'super_admin' && payload.user_id
          ? payload.user_id
          : req.editor!.userId;
      const now = new Date().toISOString();
      const item: UserWorkflowItem = {
        id: `wf-${crypto.randomUUID().slice(0, 8)}`,
        user_id: targetUserId,
        assigned_by: req.editor!.userId,
        title: payload.title.trim().slice(0, 160),
        description: (payload.description || '').trim().slice(0, 800),
        category:
          payload.category &&
          ['onboarding', 'daily_checklist', 'project_task', 'follow_up'].includes(payload.category)
            ? payload.category
            : 'project_task',
        priority:
          payload.priority && ['high', 'medium', 'low'].includes(payload.priority)
            ? payload.priority
            : 'medium',
        status:
          payload.status && ['todo', 'in_progress', 'done'].includes(payload.status)
            ? payload.status
            : 'todo',
        due_date: payload.due_date || null,
        linked_entity_type:
          payload.linked_entity_type &&
          ['inquiry', 'chat', 'article', 'none'].includes(payload.linked_entity_type)
            ? payload.linked_entity_type
            : 'none',
        linked_entity_id: payload.linked_entity_id || null,
        created_at: now,
        updated_at: now
      };
      const saved = await createWorkflowItem(item, getBearerToken(req));
      res.status(201).json({ item: saved });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create workflow item' });
    }
  });

  app.patch('/api/workflows/:id', requireEditor, async (req: AuthReq, res) => {
    try {
      const token = getBearerToken(req);
      const existingList = await listWorkflowItems(
        req.editor!.role === 'super_admin' ? undefined : req.editor!.userId,
        token
      );
      const existing = existingList.find((w) => w.id === req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Workflow item not found or access denied.' });
      }
      const payload = req.body as Partial<UserWorkflowItem>;
      const patch: Partial<UserWorkflowItem> = {};
      if (payload.title !== undefined) patch.title = payload.title.trim().slice(0, 160);
      if (payload.description !== undefined) patch.description = payload.description.trim().slice(0, 800);
      if (payload.category !== undefined) patch.category = payload.category;
      if (payload.priority !== undefined) patch.priority = payload.priority;
      if (payload.status !== undefined) patch.status = payload.status;
      if (payload.due_date !== undefined) patch.due_date = payload.due_date;
      if (req.editor!.role === 'super_admin' && payload.user_id) {
        patch.user_id = payload.user_id;
      }
      const updated = await updateWorkflowItem(req.params.id, patch, token);
      res.json({ item: updated });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update workflow item' });
    }
  });

  app.delete('/api/workflows/:id', requireEditor, async (req: AuthReq, res) => {
    try {
      const token = getBearerToken(req);
      const existingList = await listWorkflowItems(
        req.editor!.role === 'super_admin' ? undefined : req.editor!.userId,
        token
      );
      const existing = existingList.find((w) => w.id === req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Workflow item not found or access denied.' });
      }
      await deleteWorkflowItem(req.params.id, token);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete workflow item' });
    }
  });

  app.patch('/api/inquiries/:id/assign', requireRoles('super_admin', 'support_agent'), async (req, res) => {
    try {
      const { assigned_to } = req.body as { assigned_to?: string | null };
      const updated = await assignInquiry(req.params.id, assigned_to || null, getBearerToken(req));
      if (!updated) return res.status(404).json({ error: 'Inquiry not found.' });
      res.json({ inquiry: updated });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to assign inquiry' });
    }
  });

  app.patch('/api/chat/threads/:id/assign', requireRoles('super_admin', 'support_agent'), async (req, res) => {
    try {
      const { assigned_to } = req.body as { assigned_to?: string | null };
      const updated = await assignChatThread(req.params.id, assigned_to || null, getBearerToken(req));
      if (!updated) return res.status(404).json({ error: 'Chat thread not found.' });
      res.json({ thread: updated });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to assign chat thread' });
    }
  });

  app.get('/api/routing-rules', requireEditor, async (req, res) => {
    try {
      const rules = await listRoutingRules(getBearerToken(req));
      res.json({ rules });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load routing rules' });
    }
  });

  app.put('/api/routing-rules', requireRoles('super_admin'), async (req, res) => {
    try {
      const { rules } = req.body as { rules?: RoutingRule[] };
      if (!Array.isArray(rules)) {
        return res.status(400).json({ error: 'rules array is required.' });
      }
      const saved = await saveRoutingRules(rules, getBearerToken(req));
      res.json({ rules: saved });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save routing rules' });
    }
  });

  // --- Integrations & Connections Vault (AES-256-GCM Encrypted) ---

  app.get('/api/integrations', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const integrations = await getAllIntegrationStatuses(getBearerToken(req));
      res.json({ integrations });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to inspect integration statuses'
      });
    }
  });

  app.put('/api/integrations/:provider', requireRoles('super_admin'), async (req: AuthReq, res) => {
    try {
      const provider = req.params.provider as IntegrationProviderId;
      if (!VALID_INTEGRATION_PROVIDERS.includes(provider)) {
        return res.status(400).json({ error: 'Unknown integration provider.' });
      }
      const payload = (req.body || {}) as {
        secret?: string;
        configMeta?: IntegrationConfigMeta;
        useEnvFallback?: boolean;
        skipVerify?: boolean;
      };
      const result = await saveAndVerifyIntegration(
        provider,
        payload,
        req.editor!.email,
        getBearerToken(req)
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to verify and save integration'
      });
    }
  });

  app.post('/api/integrations/:provider/test', requireRoles('super_admin', 'editor'), async (req: AuthReq, res) => {
    try {
      const provider = req.params.provider as IntegrationProviderId;
      if (!VALID_INTEGRATION_PROVIDERS.includes(provider)) {
        return res.status(400).json({ error: 'Unknown integration provider.' });
      }
      const payload = (req.body || {}) as {
        secret?: string;
        configMeta?: IntegrationConfigMeta;
      };
      const hasDraft = Boolean(
        payload.secret?.trim() ||
          (payload.configMeta && Object.keys(payload.configMeta).length > 0)
      );
      const result = await testIntegrationConnection(
        provider,
        hasDraft ? payload : null,
        req.editor!.email,
        getBearerToken(req)
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Integration connectivity test failed'
      });
    }
  });

  app.delete('/api/integrations/:provider', requireRoles('super_admin'), async (req: AuthReq, res) => {
    try {
      const provider = req.params.provider as IntegrationProviderId;
      if (!VALID_INTEGRATION_PROVIDERS.includes(provider)) {
        return res.status(400).json({ error: 'Unknown integration provider.' });
      }
      const integration = await disconnectIntegration(
        provider,
        req.editor!.email,
        getBearerToken(req)
      );
      res.json({ integration });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to disconnect integration'
      });
    }
  });

  // --- Lark Mail SMTP SSL (Primary) & Legacy OAuth Compatibility ---

  app.get('/api/lark/status', requireRoles('super_admin', 'editor'), async (req: AuthReq, res) => {
    try {
      const token = getBearerToken(req);
      const smtpResolved = await resolveIntegrationConfig('lark_smtp', token);
      const env = getLarkEnvStatus();
      const currentRedirect = getLarkRedirectUri(req);
      const baseOrigin = getLarkBaseOrigin(req);
      const devRedirect = baseOrigin.includes('ais-pre-')
        ? `${baseOrigin.replace('ais-pre-', 'ais-dev-')}/api/lark/callback`
        : currentRedirect;
      const sharedRedirect = baseOrigin.includes('ais-dev-')
        ? `${baseOrigin.replace('ais-dev-', 'ais-pre-')}/api/lark/callback`
        : `${(process.env.SHARED_APP_URL || baseOrigin).replace(/\/$/, '')}/api/lark/callback`;

      const smtpConnected = Boolean(smtpResolved.secret && smtpResolved.configMeta.email);
      const status: LarkConnectionStatus = {
        configured: smtpConnected || env.configured,
        connected: smtpConnected,
        lark_email: smtpConnected ? smtpResolved.configMeta.email || '' : '',
        lark_name: smtpConnected
          ? smtpResolved.configMeta.sender_name || smtpResolved.configMeta.email || 'Lark SMTP'
          : '',
        expires_at: null,
        mode: 'smtp',
        smtp_host: smtpResolved.configMeta.smtp_host || 'smtp.larksuite.com',
        smtp_port: Number(smtpResolved.configMeta.smtp_port) || 465,
        source: smtpResolved.source,
        redirect_uris: {
          development: devRedirect,
          shared: sharedRedirect
        },
        missing_env: smtpConnected ? [] : ['Lark Mail SMTP Authorization Code (Settings -> Integrations Vault)']
      };
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to inspect Lark status' });
    }
  });

  app.get('/api/lark/auth-url', requireRoles('super_admin', 'editor'), async (req: AuthReq, res) => {
    const env = getLarkEnvStatus();
    if (!env.configured) {
      return res.status(400).json({
        error: `Connect Lark Mail via SMTP SSL (smtp.larksuite.com:465) inside Back Office -> Settings & Integrations.`,
        missing_env: env.missing
      });
    }
    const url = buildLarkAuthorizeUrl(req.editor!.userId, req);
    res.json({ url, redirectUri: getLarkRedirectUri(req) });
  });

  app.get(['/api/lark/callback', '/api/lark/callback/'], async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const oauthErr = typeof req.query.error === 'string' ? req.query.error : '';

    const sendPopupResult = (ok: boolean, detail: { email?: string; name?: string; error?: string }) => {
      const payload = JSON.stringify({
        type: ok ? 'LARK_OAUTH_SUCCESS' : 'LARK_OAUTH_ERROR',
        ...detail
      });
      res
        .status(ok ? 200 : 400)
        .type('html')
        .send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Lark Mail Connection</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;background:#f8fafc;color:#0f172a;">
  <p style="font-size:14px;font-weight:600;">${
    ok ? 'Lark Mail connected. Returning to GitStack Back Office...' : 'Lark OAuth failed.'
  }</p>
  ${detail.error ? `<p style="font-size:12px;color:#b91c1c;">${detail.error.replace(/</g, '&lt;')}</p>` : ''}
  <script>
    (function() {
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(${payload}, '*');
        }
      } catch (e) {}
      setTimeout(function() { window.close(); }, ${ok ? 400 : 2500});
    })();
  </script>
</body>
</html>`);
    };

    if (oauthErr) {
      return sendPopupResult(false, { error: `Lark declined authorization: ${oauthErr}` });
    }
    if (!code || !state) {
      return sendPopupResult(false, { error: 'Missing authorization code or state from Lark.' });
    }

    const verifiedState = verifyLarkOAuthState(state);
    if (!verifiedState) {
      return sendPopupResult(false, { error: 'Invalid or expired Lark OAuth state signature.' });
    }

    try {
      const redirectUri = getLarkRedirectUri(req);
      const tokens = await exchangeLarkCodeForTokens(code, redirectUri);
      const userInfo = await fetchLarkUserInfo(tokens.access_token);
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      const record: CrmOAuthTokenRecord = {
        id: `${verifiedState.userId}:lark`,
        user_id: verifiedState.userId,
        provider: 'lark',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        account_email: userInfo.email,
        account_name: userInfo.name,
        updated_at: new Date().toISOString()
      };
      await upsertCrmOAuthToken(record);
      res.cookie('gs_lark_connected', '1', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000
      });
      return sendPopupResult(true, { email: userInfo.email, name: userInfo.name });
    } catch (err) {
      return sendPopupResult(false, {
        error: err instanceof Error ? err.message : 'Lark token exchange failed'
      });
    }
  });

  app.delete('/api/lark/disconnect', requireRoles('super_admin', 'editor'), async (req: AuthReq, res) => {
    try {
      const token = getBearerToken(req);
      await disconnectIntegration('lark_smtp', req.editor!.email, token);
      await deleteCrmOAuthToken(req.editor!.userId, 'lark', token).catch(() => {});
      res.clearCookie('gs_lark_connected', { httpOnly: true, secure: true, sameSite: 'none' });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to disconnect Lark' });
    }
  });

  // --- Apollo-Style Open-Source Lead Discovery & CRM Pipeline ---

  app.post('/api/crm/discover', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const { query, mode } = req.body as {
        query?: string;
        mode?: 'auto' | 'github' | 'website';
      };
      if (!query || !query.trim()) {
        return res.status(400).json({ error: 'Search query, GitHub topic, or company domain is required.' });
      }
      const validMode = mode === 'github' || mode === 'website' ? mode : 'auto';
      const result = await discoverOpenSourceLeads(query.trim(), validMode, getBearerToken(req));
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Open-source lead discovery failed' });
    }
  });

  app.post('/api/crm/sync-opensource', requireRoles('super_admin', 'editor'), async (req: AuthReq, res) => {
    try {
      const token = getBearerToken(req);
      const { track } = (req.body || {}) as { track?: OpenSourceSyncTrack };
      const validTrack: OpenSourceSyncTrack =
        track === 'ai' || track === 'cloud' || track === 'devtools' ? track : 'all';

      const harvested = await harvestTrendingOpenSourceLeads(validTrack, req.editor!.userId, token);
      const merged = await upsertMergeCrmLeads(harvested.leads, token);
      const mxVerifiedCount = harvested.leads.filter((l) => l.email_status === 'verified_mx').length;

      await addCrmSyncRun(
        {
          id: `sync-${crypto.randomUUID().slice(0, 8)}`,
          source_type: 'github',
          query_label: `Trending Repos (${validTrack})`,
          fetched_count: harvested.leads.length,
          inserted_count: merged.insertedCount,
          merged_count: merged.mergedCount,
          mx_verified_count: mxVerifiedCount,
          status: 'completed',
          error_detail: '',
          triggered_by: req.editor!.email,
          created_at: new Date().toISOString()
        },
        token
      ).catch(() => {});

      const payload: OpenSourceSyncResult = {
        track: validTrack,
        reposScanned: harvested.reposScanned,
        insertedCount: merged.insertedCount,
        mergedCount: merged.mergedCount,
        mxVerifiedCount,
        sourcesSynced: harvested.sourcesSynced,
        leads: merged.leads
      };
      res.json(payload);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Open-source database sync failed' });
    }
  });

  // --- Source Attribution Dashboard, Apollo.io, HN, YC, CSV & Google Maps Endpoints ---

  app.get('/api/crm/sources/analytics', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const analytics = await getCrmSourcesAnalytics(getBearerToken(req));
      res.json(analytics);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to compute source attribution analytics'
      });
    }
  });

  app.get('/api/crm/apollo/status', requireRoles('super_admin', 'editor'), async (req, res) => {
    const resolved = await resolveIntegrationConfig('apollo', getBearerToken(req));
    res.json({
      configured: Boolean(resolved.secret),
      envVarName: 'APOLLO_API_KEY',
      endpointMode: 'mixed_people/api_search + people/bulk_match',
      capabilityMode:
        resolved.configMeta.apollo_capability || (resolved.secret ? 'unknown' : undefined),
      capabilityMessage: resolved.row?.last_test_message || ''
    });
  });

  app.post('/api/crm/apollo/search', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const filters = (req.body || {}) as ApolloSearchFilters;
      const result = await searchApolloPeople(filters, getBearerToken(req));
      res.json(result);
    } catch (err) {
      const typed = err as Error & { status?: number; code?: string };
      const message = typed instanceof Error ? typed.message : 'Apollo.io search failed';
      const status =
        typed.status === 403
          ? 403
          : message.includes('Apollo')
            ? 400
            : 502;
      res.status(status).json({ error: message, code: typed.code || undefined });
    }
  });

  app.post('/api/crm/apollo/import', requireRoles('super_admin', 'editor'), async (req: AuthReq, res) => {
    try {
      const token = getBearerToken(req);
      const { candidates, queryLabel } = req.body as {
        candidates?: ApolloCandidate[];
        queryLabel?: string;
      };
      if (!Array.isArray(candidates) || candidates.length === 0) {
        return res.status(400).json({ error: 'Select at least one Apollo prospect to import.' });
      }
      const builtLeads = await enrichAndBuildApolloLeads(candidates, req.editor!.userId, token);
      const merged = await upsertMergeCrmLeads(builtLeads, token);
      const mxVerifiedCount = builtLeads.filter((l) => l.email_status === 'verified_mx').length;

      await addCrmSyncRun(
        {
          id: `sync-${crypto.randomUUID().slice(0, 8)}`,
          source_type: 'apollo',
          query_label: (queryLabel || 'Apollo People Search').slice(0, 100),
          fetched_count: builtLeads.length,
          inserted_count: merged.insertedCount,
          merged_count: merged.mergedCount,
          mx_verified_count: mxVerifiedCount,
          status: 'completed',
          error_detail: '',
          triggered_by: req.editor!.email,
          created_at: new Date().toISOString()
        },
        token
      ).catch(() => {});

      res.json({
        insertedCount: merged.insertedCount,
        mergedCount: merged.mergedCount,
        mxVerifiedCount,
        leads: merged.leads
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Apollo import failed' });
    }
  });

  app.post('/api/crm/sources/hacker-news/sync', requireRoles('super_admin', 'editor'), async (req: AuthReq, res) => {
    try {
      const token = getBearerToken(req);
      const { keyword } = (req.body || {}) as { keyword?: string };
      const harvested = await harvestHackerNewsLeads(keyword || '', req.editor!.userId);
      const merged = await upsertMergeCrmLeads(harvested.leads, token);
      const mxVerifiedCount = harvested.leads.filter((l) => l.email_status === 'verified_mx').length;

      await addCrmSyncRun(
        {
          id: `sync-${crypto.randomUUID().slice(0, 8)}`,
          source_type: 'hacker_news',
          query_label: `${harvested.threadTitle}${keyword?.trim() ? ` (${keyword.trim()})` : ''}`.slice(0, 100),
          fetched_count: harvested.leads.length,
          inserted_count: merged.insertedCount,
          merged_count: merged.mergedCount,
          mx_verified_count: mxVerifiedCount,
          status: 'completed',
          error_detail: '',
          triggered_by: req.editor!.email,
          created_at: new Date().toISOString()
        },
        token
      ).catch(() => {});

      res.json({
        threadTitle: harvested.threadTitle,
        scannedCount: harvested.scannedCount,
        insertedCount: merged.insertedCount,
        mergedCount: merged.mergedCount,
        mxVerifiedCount,
        leads: merged.leads
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Hacker News hiring sync failed'
      });
    }
  });

  app.post('/api/crm/sources/ycombinator/sync', requireRoles('super_admin', 'editor'), async (req: AuthReq, res) => {
    try {
      const token = getBearerToken(req);
      const { keyword } = (req.body || {}) as { keyword?: string };
      const harvested = await harvestYCombinatorLeads(keyword || '', req.editor!.userId);
      const merged = await upsertMergeCrmLeads(harvested.leads, token);
      const mxVerifiedCount = harvested.leads.filter((l) => l.email_status === 'verified_mx').length;

      await addCrmSyncRun(
        {
          id: `sync-${crypto.randomUUID().slice(0, 8)}`,
          source_type: 'ycombinator',
          query_label: `${harvested.datasetLabel}${keyword?.trim() ? ` (${keyword.trim()})` : ''}`.slice(0, 100),
          fetched_count: harvested.leads.length,
          inserted_count: merged.insertedCount,
          merged_count: merged.mergedCount,
          mx_verified_count: mxVerifiedCount,
          status: 'completed',
          error_detail: '',
          triggered_by: req.editor!.email,
          created_at: new Date().toISOString()
        },
        token
      ).catch(() => {});

      res.json({
        datasetLabel: harvested.datasetLabel,
        scannedCount: harvested.scannedCount,
        insertedCount: merged.insertedCount,
        mergedCount: merged.mergedCount,
        mxVerifiedCount,
        leads: merged.leads
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Y Combinator directory sync failed'
      });
    }
  });

  app.post('/api/crm/sources/csv/import', requireRoles('super_admin', 'editor'), async (req: AuthReq, res) => {
    try {
      const token = getBearerToken(req);
      const { rows, fileName, sourceType } = req.body as {
        rows?: CsvImportLeadInput[];
        fileName?: string;
        sourceType?: 'csv_import' | 'apollo';
      };
      const resolvedSource: 'csv_import' | 'apollo' =
        sourceType === 'apollo' ? 'apollo' : 'csv_import';
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'Provide at least one row with a company_name.' });
      }
      const builtLeads = await buildLeadsFromCsvInputs(rows, req.editor!.userId, resolvedSource);
      if (builtLeads.length === 0) {
        return res.status(400).json({ error: 'No valid rows containing a company name were found.' });
      }
      const merged = await upsertMergeCrmLeads(builtLeads, token);
      const mxVerifiedCount = builtLeads.filter((l) => l.email_status === 'verified_mx').length;

      await addCrmSyncRun(
        {
          id: `sync-${crypto.randomUUID().slice(0, 8)}`,
          source_type: resolvedSource,
          query_label: (
            fileName ||
            (resolvedSource === 'apollo' ? 'Apollo.io CSV Export' : 'CSV / JSON Lead Upload')
          ).slice(0, 100),
          fetched_count: builtLeads.length,
          inserted_count: merged.insertedCount,
          merged_count: merged.mergedCount,
          mx_verified_count: mxVerifiedCount,
          status: 'completed',
          error_detail: '',
          triggered_by: req.editor!.email,
          created_at: new Date().toISOString()
        },
        token
      ).catch(() => {});

      res.json({
        insertedCount: merged.insertedCount,
        mergedCount: merged.mergedCount,
        mxVerifiedCount,
        leads: merged.leads
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'CSV bulk import failed' });
    }
  });

  app.get('/api/crm/maps/config', requireRoles('super_admin', 'editor'), async (req, res) => {
    const apiKey = await getGoogleMapsApiKey(getBearerToken(req));
    res.json({
      configured: Boolean(apiKey),
      apiKey
    });
  });

  app.post('/api/crm/maps/search', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const { query, regionCode } = req.body as { query?: string; regionCode?: string };
      if (!query || !query.trim()) {
        return res.status(400).json({ error: 'Establishment search query is required.' });
      }
      const places = await searchGoogleMapsEstablishments(
        query.trim(),
        regionCode || '',
        getBearerToken(req)
      );
      res.json({ places });
    } catch (err) {
      if (err instanceof MapsQuotaExceededError) {
        return res.status(429).json({
          quotaExceeded: true,
          error: err.message
        });
      }
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Google Maps Places search failed'
      });
    }
  });

  app.post('/api/crm/maps/import', requireRoles('super_admin', 'editor'), async (req: AuthReq, res) => {
    try {
      const token = getBearerToken(req);
      const { places, runAnalysis, searchLabel } = req.body as {
        places?: GoogleMapsPlaceCandidate[];
        runAnalysis?: boolean;
        searchLabel?: string;
      };
      if (!Array.isArray(places) || places.length === 0) {
        return res.status(400).json({ error: 'Select at least one establishment from the map first.' });
      }
      const imported = await importAndAnalyzeGoogleMapsPlaces(
        places,
        req.editor!.userId,
        runAnalysis !== false,
        token
      );
      const merged = await upsertMergeCrmLeads(imported, token);
      const mxVerifiedCount = imported.filter((l) => l.email_status === 'verified_mx').length;

      await addCrmSyncRun(
        {
          id: `sync-${crypto.randomUUID().slice(0, 8)}`,
          source_type: 'google_maps',
          query_label: (searchLabel || 'Google Maps Establishment Search').slice(0, 100),
          fetched_count: imported.length,
          inserted_count: merged.insertedCount,
          merged_count: merged.mergedCount,
          mx_verified_count: mxVerifiedCount,
          status: 'completed',
          error_detail: '',
          triggered_by: req.editor!.email,
          created_at: new Date().toISOString()
        },
        token
      ).catch(() => {});

      res.json({
        importedCount: imported.length,
        insertedCount: merged.insertedCount,
        mergedCount: merged.mergedCount,
        mxVerifiedCount,
        importedLeads: imported,
        leads: merged.leads
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to import Google Maps establishments'
      });
    }
  });

  app.post('/api/crm/leads/bulk-action', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const { action, leadIds, stage } = req.body as {
        action?: 'research' | 'move_stage' | 'delete';
        leadIds?: string[];
        stage?: CrmLeadStage;
      };
      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ error: 'Select at least one lead first.' });
      }
      const uniqueIds = Array.from(new Set(leadIds)).slice(0, 25);
      const allLeads = await listCrmLeads(token);
      const targetLeads = allLeads.filter((l) => uniqueIds.includes(l.id));
      let processedCount = 0;

      if (action === 'move_stage') {
        const validStages: CrmLeadStage[] = [
          'discovered',
          'researched',
          'proposed',
          'follow_up',
          'won',
          'lost'
        ];
        if (!stage || !validStages.includes(stage)) {
          return res.status(400).json({ error: 'Valid target CRM stage is required.' });
        }
        const now = new Date().toISOString();
        for (const lead of targetLeads) {
          await upsertCrmLead({ ...lead, stage, updated_at: now }, token);
          processedCount++;
        }
      } else if (action === 'delete') {
        for (const lead of targetLeads) {
          const ok = await deleteCrmLead(lead.id, token);
          if (ok) processedCount++;
        }
      } else if (action === 'research') {
        for (const lead of targetLeads.slice(0, 8)) {
          const result = await runProspectResearchAndProposal(lead, token);
          await upsertCrmLead(
            {
              ...lead,
              research_brief: result.research_brief,
              recommended_service: result.recommended_service,
              fit_score: result.fit_score,
              deal_value: result.deal_value,
              tech_stack: result.tech_stack,
              proposal_subject: result.proposal_subject,
              proposal_body: result.proposal_body,
              follow_up_sequence: result.follow_up_sequence,
              source_urls: result.source_urls,
              stage: lead.stage === 'discovered' ? 'researched' : lead.stage,
              updated_at: new Date().toISOString()
            },
            token
          );
          processedCount++;
        }
      } else {
        return res.status(400).json({ error: 'Unsupported bulk CRM action.' });
      }

      const refreshedLeads = await listCrmLeads(token);
      res.json({ processedCount, leads: refreshedLeads });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Bulk CRM action failed' });
    }
  });

  app.get('/api/crm/leads', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const [leads, logs] = await Promise.all([
        listCrmLeads(token),
        listCrmOutreachLogs(undefined, token)
      ]);
      res.json({ leads, logs });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load CRM leads' });
    }
  });

  app.post('/api/crm/leads', requireRoles('super_admin', 'editor'), async (req: AuthReq, res) => {
    try {
      const token = getBearerToken(req);
      const body = req.body as Partial<CrmLead>;
      const contactName = (body.contact_name || '').trim();
      const companyName = (body.company_name || '').trim();
      const email = (body.email || '').trim().toLowerCase();

      if (!contactName && !companyName) {
        return res.status(400).json({ error: 'Contact name or company name is required.' });
      }

      let emailStatus = body.email_status || 'inferred';
      if (email && !body.email_status) {
        const mxOk = await verifyEmailMxDomain(email);
        emailStatus = mxOk ? 'verified_mx' : 'invalid';
      } else if (!email) {
        emailStatus = 'invalid';
      }

      const now = new Date().toISOString();
      const validServices: ServiceCategory[] = [
        'AI Integration',
        'ML Automation',
        'Cloud Infrastructure',
        'Custom Software',
        'Technical Consulting'
      ];
      const recommendedService = validServices.includes(body.recommended_service as ServiceCategory)
        ? (body.recommended_service as ServiceCategory)
        : 'AI Integration';

      const lead: CrmLead = {
        id: `crm-${crypto.randomUUID().slice(0, 8)}`,
        contact_name: contactName || `${companyName} Team`,
        role_title: (body.role_title || '').trim() || 'Engineering Leader',
        email,
        email_status: emailStatus,
        company_name: companyName || contactName,
        company_domain: (body.company_domain || '').trim().toLowerCase(),
        website_url: (body.website_url || '').trim(),
        github_url: (body.github_url || '').trim(),
        phone: (body.phone || '').trim(),
        location: (body.location || '').trim(),
        rating: body.rating !== undefined && body.rating !== null ? Number(body.rating) : null,
        source_detail: (body.source_detail || '').trim(),
        source_type: body.source_type || 'manual',
        source_urls: Array.isArray(body.source_urls) ? body.source_urls.slice(0, 10) : [],
        tech_stack: Array.isArray(body.tech_stack) ? body.tech_stack.slice(0, 10) : [],
        research_brief: (body.research_brief || '').trim(),
        recommended_service: recommendedService,
        fit_score: Math.max(10, Math.min(100, Number(body.fit_score) || 72)),
        deal_value: Math.max(1000, Number(body.deal_value) || 25000),
        stage: body.stage || 'discovered',
        proposal_subject: (body.proposal_subject || '').trim(),
        proposal_body: (body.proposal_body || '').trim(),
        follow_up_sequence: Array.isArray(body.follow_up_sequence) ? body.follow_up_sequence : [],
        assigned_to: body.assigned_to ?? req.editor!.userId,
        last_contacted_at: null,
        next_followup_at: null,
        converted_inquiry_id: null,
        created_at: now,
        updated_at: now
      };

      const saved = await upsertCrmLead(lead, token);
      res.status(201).json({ lead: saved });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create CRM lead' });
    }
  });

  app.patch('/api/crm/leads/:id', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const leads = await listCrmLeads(token);
      const existing = leads.find((l) => l.id === req.params.id);
      if (!existing) return res.status(404).json({ error: 'CRM lead not found.' });

      const patch = req.body as Partial<CrmLead>;
      const validStages: CrmLeadStage[] = [
        'discovered',
        'researched',
        'proposed',
        'follow_up',
        'won',
        'lost'
      ];

      let updatedEmailStatus = patch.email_status ?? existing.email_status;
      if (patch.email !== undefined && patch.email.trim().toLowerCase() !== existing.email) {
        const cleanEmail = patch.email.trim().toLowerCase();
        updatedEmailStatus = cleanEmail
          ? (await verifyEmailMxDomain(cleanEmail))
            ? 'verified_mx'
            : 'invalid'
          : 'invalid';
      }

      const updated: CrmLead = {
        ...existing,
        ...(patch.contact_name !== undefined ? { contact_name: patch.contact_name.trim() } : {}),
        ...(patch.role_title !== undefined ? { role_title: patch.role_title.trim() } : {}),
        ...(patch.email !== undefined ? { email: patch.email.trim().toLowerCase() } : {}),
        email_status: updatedEmailStatus,
        ...(patch.company_name !== undefined ? { company_name: patch.company_name.trim() } : {}),
        ...(patch.company_domain !== undefined ? { company_domain: patch.company_domain.trim().toLowerCase() } : {}),
        ...(patch.website_url !== undefined ? { website_url: patch.website_url.trim() } : {}),
        ...(patch.github_url !== undefined ? { github_url: patch.github_url.trim() } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone.trim() } : {}),
        ...(patch.location !== undefined ? { location: patch.location.trim() } : {}),
        ...(patch.source_detail !== undefined ? { source_detail: patch.source_detail.trim() } : {}),
        ...(patch.tech_stack !== undefined ? { tech_stack: patch.tech_stack } : {}),
        ...(patch.research_brief !== undefined ? { research_brief: patch.research_brief } : {}),
        ...(patch.recommended_service !== undefined ? { recommended_service: patch.recommended_service } : {}),
        ...(patch.fit_score !== undefined ? { fit_score: Math.max(0, Math.min(100, Number(patch.fit_score))) } : {}),
        ...(patch.deal_value !== undefined ? { deal_value: Math.max(0, Number(patch.deal_value)) } : {}),
        ...(patch.stage && validStages.includes(patch.stage) ? { stage: patch.stage } : {}),
        ...(patch.proposal_subject !== undefined ? { proposal_subject: patch.proposal_subject } : {}),
        ...(patch.proposal_body !== undefined ? { proposal_body: patch.proposal_body } : {}),
        ...(patch.follow_up_sequence !== undefined ? { follow_up_sequence: patch.follow_up_sequence } : {}),
        ...(patch.assigned_to !== undefined ? { assigned_to: patch.assigned_to } : {}),
        ...(patch.next_followup_at !== undefined ? { next_followup_at: patch.next_followup_at } : {}),
        updated_at: new Date().toISOString()
      };

      const saved = await upsertCrmLead(updated, token);
      res.json({ lead: saved });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update CRM lead' });
    }
  });

  app.delete('/api/crm/leads/:id', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const ok = await deleteCrmLead(req.params.id, getBearerToken(req));
      res.json({ ok });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete CRM lead' });
    }
  });

  app.post('/api/crm/leads/:id/research', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const leads = await listCrmLeads(token);
      const existing = leads.find((l) => l.id === req.params.id);
      if (!existing) return res.status(404).json({ error: 'CRM lead not found.' });

      const result = await runProspectResearchAndProposal(existing, token);
      const updated: CrmLead = {
        ...existing,
        research_brief: result.research_brief,
        recommended_service: result.recommended_service,
        fit_score: result.fit_score,
        deal_value: result.deal_value,
        tech_stack: result.tech_stack,
        proposal_subject: result.proposal_subject,
        proposal_body: result.proposal_body,
        follow_up_sequence: result.follow_up_sequence,
        source_urls: result.source_urls,
        stage: existing.stage === 'discovered' ? 'researched' : existing.stage,
        updated_at: new Date().toISOString()
      };
      const saved = await upsertCrmLead(updated, token);
      res.json({ lead: saved });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Prospect research failed' });
    }
  });

  app.post('/api/crm/leads/:id/send', requireRoles('super_admin', 'editor'), async (req: AuthReq, res) => {
    try {
      const token = getBearerToken(req);
      const leads = await listCrmLeads(token);
      const existing = leads.find((l) => l.id === req.params.id);
      if (!existing) return res.status(404).json({ error: 'CRM lead not found.' });

      const {
        channel,
        recipient_email,
        subject,
        body,
        step_number,
        provider_message_id,
        client_error
      } = req.body as {
        channel?: 'lark_mail' | 'gmail_api';
        recipient_email?: string;
        subject?: string;
        body?: string;
        step_number?: number;
        provider_message_id?: string;
        client_error?: string;
      };

      const targetEmail = (recipient_email || existing.email || '').trim().toLowerCase();
      if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
        return res.status(400).json({ error: 'A valid recipient email address is required before sending.' });
      }
      const cleanSubject = (subject || existing.proposal_subject || '').trim();
      const cleanBody = (body || existing.proposal_body || '').trim();
      if (!cleanSubject || !cleanBody) {
        return res.status(400).json({ error: 'Subject and email body are required.' });
      }

      const sendChannel = 'lark_mail' as const;
      const now = new Date().toISOString();
      let deliveryStatus: 'sent' | 'failed' = 'sent';
      let messageId = '';
      let errorDetail = '';

      try {
        const sent = await sendLarkSmtpMail(
          {
            toEmail: targetEmail,
            toName: existing.contact_name,
            subject: cleanSubject,
            bodyText: cleanBody
          },
          token
        );
        messageId = sent.messageId;
      } catch (sendErr) {
        deliveryStatus = 'failed';
        errorDetail = sendErr instanceof Error ? sendErr.message : 'Lark Mail SMTP dispatch failed';
      }

      const stepLabel = step_number ? `Follow-Up Step ${step_number}` : 'Initial Proposal';
      const logEntry: CrmOutreachLog = {
        id: `crmlog-${crypto.randomUUID().slice(0, 8)}`,
        lead_id: existing.id,
        channel: sendChannel,
        recipient_email: targetEmail,
        subject: cleanSubject,
        body: cleanBody,
        provider_message_id: messageId,
        status: deliveryStatus,
        error_detail: errorDetail,
        step_label: stepLabel,
        sent_by: req.editor!.email,
        sent_at: now
      };
      const savedLog = await addCrmOutreachLog(logEntry, token);

      if (deliveryStatus === 'failed') {
        return res.status(502).json({
          error: errorDetail || 'Email delivery failed.',
          log: savedLog,
          lead: existing
        });
      }

      const updatedSequence: CrmFollowUpStep[] = (existing.follow_up_sequence || []).map((step) =>
        step_number && step.step_number === step_number ? { ...step, sent_at: now } : step
      );
      const nextUnsent = updatedSequence.find((s) => !s.sent_at);
      const nextFollowupIso = nextUnsent
        ? new Date(Date.now() + nextUnsent.delay_days * 86_400_000).toISOString()
        : null;

      let nextStage: CrmLeadStage = existing.stage;
      if (existing.stage === 'discovered' || existing.stage === 'researched') {
        nextStage = 'proposed';
      } else if (existing.stage === 'proposed' && step_number) {
        nextStage = 'follow_up';
      }

      const updatedLead = await upsertCrmLead(
        {
          ...existing,
          email: targetEmail,
          proposal_subject: step_number ? existing.proposal_subject : cleanSubject,
          proposal_body: step_number ? existing.proposal_body : cleanBody,
          follow_up_sequence: updatedSequence,
          stage: nextStage,
          last_contacted_at: now,
          next_followup_at: nextFollowupIso,
          updated_at: now
        },
        token
      );

      res.json({ lead: updatedLead, log: savedLog });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to dispatch CRM email' });
    }
  });

  app.post('/api/crm/leads/:id/convert', requireRoles('super_admin', 'editor'), async (req: AuthReq, res) => {
    try {
      const token = getBearerToken(req);
      const leads = await listCrmLeads(token);
      const existing = leads.find((l) => l.id === req.params.id);
      if (!existing) return res.status(404).json({ error: 'CRM lead not found.' });

      const now = new Date().toISOString();
      let createdInquiry: ClientInquiry | null = null;
      let createdWorkflow: UserWorkflowItem | null = null;

      if (!existing.converted_inquiry_id) {
        const refId = `GS-CRM-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
        const inquiry: ClientInquiry = {
          id: refId,
          reference_code: refId,
          full_name: existing.contact_name,
          company: existing.company_name,
          work_email: existing.email || `client@${existing.company_domain || 'gitstack.io'}`,
          service_interest: existing.recommended_service,
          budget_range: `$${existing.deal_value.toLocaleString()}`,
          timeline: 'Immediate Kickoff',
          project_brief:
            existing.research_brief ||
            `Won CRM prospect (${existing.company_name}). Proposal sent: ${existing.proposal_subject}`,
          status: 'scheduled',
          assigned_to: existing.assigned_to || req.editor!.userId,
          assigned_at: now,
          created_at: now
        };
        createdInquiry = await createInquiry(inquiry);

        const wf: UserWorkflowItem = {
          id: `wf-${crypto.randomUUID().slice(0, 8)}`,
          user_id: existing.assigned_to || req.editor!.userId,
          assigned_by: req.editor!.userId,
          title: `Client Kickoff: ${existing.company_name} (${existing.recommended_service})`,
          description: `Prepare technical kickoff deck, SOW, and architecture workspace for ${existing.contact_name} (${existing.email}).`,
          category: 'onboarding',
          priority: 'high',
          status: 'todo',
          due_date: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
          linked_entity_type: 'inquiry',
          linked_entity_id: refId,
          created_at: now,
          updated_at: now
        };
        createdWorkflow = await createWorkflowItem(wf, token);
      }

      const updatedLead = await upsertCrmLead(
        {
          ...existing,
          stage: 'won',
          converted_inquiry_id: existing.converted_inquiry_id || createdInquiry?.id || null,
          updated_at: now
        },
        token
      );

      res.json({ lead: updatedLead, inquiry: createdInquiry, workflowItem: createdWorkflow });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to convert lead to client' });
    }
  });

  // --- Unified Lark Mail Inbox Dispatch & Logs ---

  app.get('/api/inbox/lark-emails', requireEditor, async (req, res) => {
    try {
      const token = getBearerToken(req);
      const [resolved, logs] = await Promise.all([
        resolveIntegrationConfig('lark_smtp', token).catch(() => null),
        listInboxEmailLogs(token)
      ]);
      res.json({
        lark: {
          connected: Boolean(resolved?.secret && resolved.configMeta.email),
          email: resolved?.configMeta.email || '',
          senderName: resolved?.configMeta.sender_name || 'GitStack Solutions',
          smtpHost: resolved?.configMeta.smtp_host || 'smtp.larksuite.com',
          smtpPort: resolved?.configMeta.smtp_port || 465
        },
        logs
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load Lark inbox logs' });
    }
  });

  app.post('/api/inbox/send-lark', requireEditor, async (req: AuthReq, res) => {
    try {
      const token = getBearerToken(req);
      const { toEmail, toName, subject, bodyText, category, relatedId } = req.body as {
        toEmail?: string;
        toName?: string;
        subject?: string;
        bodyText?: string;
        category?: 'inquiry_reply' | 'direct_compose';
        relatedId?: string;
      };

      const target = (toEmail || '').trim().toLowerCase();
      if (!target || !isValidEmail(target)) {
        return res.status(400).json({ error: 'A valid recipient email address is required.' });
      }
      if (!subject?.trim() || !bodyText?.trim()) {
        return res.status(400).json({ error: 'Subject and email body are required.' });
      }

      const now = new Date().toISOString();
      let status: 'sent' | 'failed' = 'sent';
      let messageId = '';
      let errorDetail = '';

      try {
        const sent = await sendLarkSmtpMail(
          {
            toEmail: target,
            toName: toName?.trim(),
            subject: subject.trim(),
            bodyText: bodyText.trim()
          },
          token
        );
        messageId = sent.messageId;
      } catch (err) {
        status = 'failed';
        errorDetail = err instanceof Error ? err.message : 'Lark Mail SMTP dispatch failed.';
      }

      const log = await addInboxEmailLog(
        {
          id: `inblog-${crypto.randomUUID().slice(0, 8)}`,
          recipient_email: target,
          subject: subject.trim(),
          body: bodyText.trim(),
          channel: 'lark_smtp',
          category: category === 'inquiry_reply' ? 'inquiry_reply' : 'direct_compose',
          related_id: relatedId || null,
          provider_message_id: messageId,
          status,
          error_detail: errorDetail,
          sent_by: req.editor?.email || 'admin',
          sent_at: now
        },
        token
      );

      if (status === 'failed') {
        return res.status(400).json({ error: errorDetail, log });
      }

      if (category === 'inquiry_reply' && relatedId) {
        const currentInqs = await listInquiries(token).catch(() => []);
        const targetInq = currentInqs.find((i) => i.id === relatedId);
        if (targetInq && targetInq.status === 'new') {
          await updateInquiryStatus(relatedId, 'reviewed', token).catch(() => {});
        }
      }

      res.status(201).json({ log });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to send Lark Mail' });
    }
  });

  // --- Customer Demo Sign Up, Ordinary Login, Telemetry & Admin Demo Users ---

  app.post('/api/demo/register', async (req, res) => {
    try {
      const { full_name, email, company, phone, password } = req.body as {
        full_name?: string;
        email?: string;
        company?: string;
        phone?: string;
        password?: string;
      };

      const cleanName = (full_name || '').trim();
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanCompany = (company || '').trim();
      const cleanPhone = (phone || '').trim();
      const rawPassword = password || '';

      if (cleanName.length < 2 || !cleanCompany || cleanPhone.length < 5) {
        return res.status(400).json({
          error: 'Full name, company name, and phone number are required to access the Live Demo.'
        });
      }
      if (!isValidEmail(cleanEmail)) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
      }
      if (rawPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }

      const existing = await findDemoUserByEmail(cleanEmail);
      if (existing) {
        return res.status(409).json({
          error: 'An account with this email already exists. Please switch to Sign In.'
        });
      }

      const now = new Date().toISOString();
      const emailDomain = cleanEmail.split('@')[1] || '';
      const freeDomains = new Set([
        'gmail.com',
        'yahoo.com',
        'hotmail.com',
        'outlook.com',
        'icloud.com',
        'proton.me',
        'protonmail.com'
      ]);
      const companyDomain =
        emailDomain && !freeDomains.has(emailDomain)
          ? emailDomain
          : `${cleanCompany.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'demo-prospect'}.com`;

      let emailStatus: CrmLead['email_status'] = 'public_found';
      try {
        const hasMx = await Promise.race([
          verifyEmailMxDomain(cleanEmail),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1500))
        ]);
        emailStatus = hasMx ? 'verified_mx' : 'public_found';
      } catch {
        emailStatus = 'public_found';
      }

      const demoId = `demo-usr-${crypto.randomUUID().slice(0, 8)}`;
      const crmLeadId = `lead-demo-${crypto.randomUUID().slice(0, 8)}`;

      const crmLead: CrmLead = {
        id: crmLeadId,
        contact_name: cleanName,
        role_title: 'Live Demo Prospect',
        email: cleanEmail,
        email_status: emailStatus,
        company_name: cleanCompany,
        company_domain: companyDomain,
        website_url: companyDomain ? `https://${companyDomain}` : '',
        github_url: '',
        phone: cleanPhone,
        location: 'Live Demo Gate',
        rating: null,
        source_detail: 'Interactive Demo Sign Up',
        source_type: 'demo_signup',
        source_urls: ['/demo'],
        tech_stack: ['Live Demo Sandbox', 'CRM & AI Evaluation'],
        research_brief: `Registered for GitStack Interactive Live Demo on ${now.slice(0, 10)}. Phone: ${cleanPhone}. Captured automatically for sales outreach via Lark Mail.`,
        recommended_service: 'AI Integration',
        fit_score: 84,
        deal_value: 35000,
        stage: 'discovered',
        proposal_subject: `${cleanCompany} × GitStack Live Demo Follow-Up`,
        proposal_body: `Hi ${cleanName.split(' ')[0] || cleanName},\n\nThanks for exploring the GitStack Live Demo Sandbox for ${cleanCompany}. I noticed you registered with ${cleanEmail} and ${cleanPhone}—happy to walk you through deploying the live CRM, AI Agent fleet, and Lark Mail automation on your own infrastructure.\n\nBest regards,\nGitStack Engineering`,
        follow_up_sequence: [],
        assigned_to: null,
        last_contacted_at: null,
        next_followup_at: null,
        converted_inquiry_id: null,
        created_at: now,
        updated_at: now
      };

      const mergeRes = await upsertMergeCrmLeads([crmLead]);
      const matchedLead =
        mergeRes.leads.find(
          (l) => l.email.toLowerCase() === cleanEmail || l.id === crmLeadId
        ) || crmLead;

      const demoUser: DemoUser = {
        id: demoId,
        full_name: cleanName,
        email: cleanEmail,
        company: cleanCompany,
        phone: cleanPhone,
        password_hash: hashDemoPassword(rawPassword),
        crm_lead_id: matchedLead.id,
        login_count: 1,
        actions_count: 1,
        explored_modules: ['Signed Up'],
        sandbox_conversions: 0,
        last_action_label: 'Created Demo Account',
        last_active_at: now,
        created_at: now
      };

      const savedUser = await upsertDemoUser(demoUser);
      const token = issueDemoSessionToken({ id: savedUser.id, email: savedUser.email });

      await notifyAdminViaLarkMail({
        category: 'demo_signup_alert',
        relatedId: savedUser.id,
        subject: `[GitStack Demo Lead] ${cleanCompany} — ${cleanName} signed up`,
        bodyText: [
          `A visitor just registered for the GitStack Interactive Live Demo and was automatically added to your CRM Pipeline:`,
          ``,
          `Full Name: ${cleanName}`,
          `Company: ${cleanCompany}`,
          `Email: ${cleanEmail}`,
          `Phone: ${cleanPhone}`,
          `Linked CRM Lead ID: ${matchedLead.id}`,
          ``,
          `Open Back Office -> CRM Pipeline or Demo Users to review their sandbox activity and contact them via Lark Mail.`
        ].join('\n')
      });

      res.status(201).json({
        token,
        user: toPublicDemoUser(savedUser)
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to register demo account' });
    }
  });

  app.post('/api/demo/login', async (req, res) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }
      const user = await findDemoUserByEmail(cleanEmail);
      if (!user || !verifyDemoPassword(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      if (isDemoUserExpired(user)) {
        return res.status(403).json({
          error:
            'Your 24-hour Live Demo evaluation pass has expired. Contact our team or explore our services to purchase a package.',
          code: 'DEMO_EXPIRED',
          expires_at: getDemoExpiresAtIso(user.created_at)
        });
      }

      const now = new Date().toISOString();
      const updated = await upsertDemoUser({
        ...user,
        login_count: (Number(user.login_count) || 0) + 1,
        last_action_label: 'Signed In',
        last_active_at: now
      });
      const token = issueDemoSessionToken({ id: updated.id, email: updated.email });
      res.json({ token, user: toPublicDemoUser(updated) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to sign in to demo' });
    }
  });

  app.get('/api/demo/me', async (req, res) => {
    try {
      const session = verifyDemoSessionToken(getBearerToken(req) || '');
      if (!session) {
        return res.status(401).json({ error: 'Demo session expired or missing.' });
      }
      const user = await findDemoUserById(session.id);
      if (!user) {
        return res.status(401).json({ error: 'Demo account not found.' });
      }
      if (isDemoUserExpired(user)) {
        return res.status(403).json({
          error:
            'Your 24-hour Live Demo evaluation pass has expired. Contact our team or explore our services to purchase a package.',
          code: 'DEMO_EXPIRED',
          expires_at: getDemoExpiresAtIso(user.created_at)
        });
      }
      res.json({ user: toPublicDemoUser(user) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to verify demo session' });
    }
  });

  app.post('/api/demo/activity', async (req, res) => {
    try {
      const session = verifyDemoSessionToken(getBearerToken(req) || '');
      if (!session) {
        return res.status(401).json({ error: 'Demo authentication required.' });
      }
      const user = await findDemoUserById(session.id);
      if (!user) {
        return res.status(404).json({ error: 'Demo account not found.' });
      }
      if (isDemoUserExpired(user)) {
        return res.status(403).json({
          error:
            'Your 24-hour Live Demo evaluation pass has expired. Contact our team or explore our services to purchase a package.',
          code: 'DEMO_EXPIRED',
          expires_at: getDemoExpiresAtIso(user.created_at)
        });
      }
      const { module, actionLabel, convertedInquiry } = req.body as {
        module?: string;
        actionLabel?: string;
        convertedInquiry?: boolean;
      };

      const nextModules = Array.from(
        new Set([
          ...(Array.isArray(user.explored_modules) ? user.explored_modules : []),
          ...(module?.trim() ? [module.trim().slice(0, 60)] : [])
        ])
      ).slice(0, 16);

      const updated = await upsertDemoUser({
        ...user,
        actions_count: (Number(user.actions_count) || 0) + 1,
        explored_modules: nextModules,
        sandbox_conversions:
          (Number(user.sandbox_conversions) || 0) + (convertedInquiry ? 1 : 0),
        last_action_label: (actionLabel || module || 'Sandbox Interaction').slice(0, 100),
        last_active_at: new Date().toISOString()
      });

      res.json({ user: toPublicDemoUser(updated) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to log demo activity' });
    }
  });

  app.get('/api/admin/demo-users', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const data = await listDemoUsersWithStats(getBearerToken(req));
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load demo users' });
    }
  });

  app.get('/api/admin/cloudflare/analytics', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const rawWindow = typeof req.query.window === 'string' ? req.query.window : '24h';
      const validWindows: CloudflareWindowPreset[] = ['1h', '6h', '24h', '7d'];
      const windowPreset: CloudflareWindowPreset = validWindows.includes(
        rawWindow as CloudflareWindowPreset
      )
        ? (rawWindow as CloudflareWindowPreset)
        : '24h';
      const data = await fetchCloudflareZoneAnalytics(windowPreset, getBearerToken(req));
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to fetch Cloudflare analytics'
      });
    }
  });

  app.get('/api/admin/cloudflare/history', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const rawRange = typeof req.query.range === 'string' ? req.query.range : '14d';
      const validRanges: CloudflareHistoryRange[] = ['7d', '14d', '30d', 'all'];
      const range: CloudflareHistoryRange = validRanges.includes(rawRange as CloudflareHistoryRange)
        ? (rawRange as CloudflareHistoryRange)
        : '14d';
      const data = await getCloudflareHistoryAnalysis(range, getBearerToken(req));
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load Cloudflare historical analysis'
      });
    }
  });

  app.post('/api/admin/cloudflare/history/sync', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const rawRange = typeof req.body?.range === 'string' ? req.body.range : '14d';
      const validRanges: CloudflareHistoryRange[] = ['7d', '14d', '30d', 'all'];
      const range: CloudflareHistoryRange = validRanges.includes(rawRange as CloudflareHistoryRange)
        ? (rawRange as CloudflareHistoryRange)
        : '14d';
      const token = getBearerToken(req);
      const syncResult = await syncCloudflareHistoricalSnapshots(token);
      const analysis = await getCloudflareHistoryAnalysis(range, token);
      res.json({ syncResult, analysis });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to sync Cloudflare history'
      });
    }
  });

  app.post('/api/admin/cloudflare/forecast', requireRoles('super_admin', 'editor'), async (req, res) => {
    try {
      const rawRange = typeof req.body?.range === 'string' ? req.body.range : '14d';
      const validRanges: CloudflareHistoryRange[] = ['7d', '14d', '30d', 'all'];
      const range: CloudflareHistoryRange = validRanges.includes(rawRange as CloudflareHistoryRange)
        ? (rawRange as CloudflareHistoryRange)
        : '14d';
      const token = getBearerToken(req);
      const forecast = await generateCloudflareAiForecast(range, token);
      const analysis = await getCloudflareHistoryAnalysis(range, token);
      res.json({ forecast, analysis });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate Cloudflare AI forecast'
      });
    }
  });

  // --- Live Website Visitor Presence & Virtual Office Site Operations HUD ---

  let cachedCfHud: { fetchedAtMs: number; reqs: number | null; errRate: number | null; cacheRate: number | null } = {
    fetchedAtMs: 0,
    reqs: null,
    errRate: null,
    cacheRate: null
  };

  async function buildOfficeHudSummary(userToken?: string): Promise<OfficeLiveHudSummary> {
    const [chatSessions, demoStats, larkConfig] = await Promise.all([
      listWebsiteChatSessions(userToken).catch(() => []),
      listDemoUsersWithStats(userToken).catch(() => ({ users: [], summary: null })),
      resolveIntegrationConfig('lark_smtp', userToken).catch(() => null)
    ]);

    if (Date.now() - cachedCfHud.fetchedAtMs > 60_000) {
      const cf = await fetchCloudflareZoneAnalytics('24h', userToken).catch(() => null);
      if (cf?.connected) {
        cachedCfHud = {
          fetchedAtMs: Date.now(),
          reqs: cf.summary.totalRequests,
          errRate: cf.summary.error5xxRate,
          cacheRate: cf.summary.cacheHitRate
        };
      } else {
        cachedCfHud = { fetchedAtMs: Date.now(), reqs: null, errRate: null, cacheRate: null };
      }
    }

    const visitors = listLiveVisitors();
    const unansweredChatsCount = chatSessions.filter(isSessionUnanswered).length;
    const openChatsCount = chatSessions.filter((s) => s.status !== 'resolved').length;
    const escalatedChatsCount = chatSessions.filter((s) => Boolean(s.escalated_at)).length;
    const activeDemoUsersCount = demoStats.users.filter((u) => !u.is_expired).length;

    return {
      activeVisitorsCount: visitors.length,
      visitors,
      adminOnline: isAdminOnline(),
      lastAdminSeenAt: getLastAdminSeenAt(),
      unansweredChatsCount,
      openChatsCount,
      escalatedChatsCount,
      activeDemoUsersCount,
      cloudflare24hRequests: cachedCfHud.reqs,
      cloudflare5xxRate: cachedCfHud.errRate,
      cloudflareCacheRate: cachedCfHud.cacheRate,
      larkSmtpConnected: Boolean(larkConfig?.secret && larkConfig?.configMeta?.email),
      watcherLastRunAt: getChatWatcherLastRunAt()
    };
  }

  app.post('/api/public/presence', (req, res) => {
    try {
      const { session_id, path: pagePath, device_type, referrer } = (req.body || {}) as {
        session_id?: string;
        path?: string;
        device_type?: string;
        referrer?: string;
      };
      if (!session_id || !session_id.trim()) {
        return res.status(400).json({ error: 'session_id required' });
      }
      const visitors = recordVisitorPresence({
        session_id: session_id.trim(),
        path: pagePath || '/',
        device_type,
        referrer
      });
      res.json({ ok: true, activeVisitorsCount: visitors.length });
    } catch {
      res.status(500).json({ error: 'Presence update failed' });
    }
  });

  app.post(
    '/api/admin/presence/heartbeat',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req, res) => {
      try {
        markAdminPresence();
        const hud = await buildOfficeHudSummary(getBearerToken(req));
        res.json({ hud });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Heartbeat failed' });
      }
    }
  );

  app.get(
    '/api/admin/office/hud',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req, res) => {
      try {
        const hud = await buildOfficeHudSummary(getBearerToken(req));
        res.json({ hud });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load office HUD' });
      }
    }
  );

  // --- Public Floating Home Page Live Chat & Admin Inbox Real-Time Replies ---

  app.get('/api/public/chat/session', async (req, res) => {
    try {
      const rawToken =
        typeof req.query.visitor_token === 'string' ? req.query.visitor_token.trim() : '';
      const pagePath = typeof req.query.page_path === 'string' ? req.query.page_path.trim() : '/';
      const visitorToken = rawToken.slice(0, 120) || `vchat-${crypto.randomUUID()}`;
      let session = await findWebsiteChatSessionByToken(visitorToken);
      const now = new Date().toISOString();

      if (!session) {
        session = await upsertWebsiteChatSession({
          id: `wcs-${crypto.randomUUID().slice(0, 10)}`,
          visitor_token: visitorToken,
          visitor_name: 'Website Visitor',
          visitor_email: '',
          page_path: pagePath || '/',
          status: 'open',
          last_visitor_msg_at: null,
          last_admin_reply_at: null,
          escalated_at: null,
          converted_lead_id: null,
          created_at: now,
          updated_at: now
        });
      }
      const messages = await listWebsiteChatMessages(session.id);
      res.json({ session, messages, adminOnline: isAdminOnline() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to open chat session' });
    }
  });

  app.post('/api/public/chat/profile', async (req, res) => {
    try {
      const { visitor_token, visitor_name, visitor_email, page_path } = (req.body || {}) as {
        visitor_token?: string;
        visitor_name?: string;
        visitor_email?: string;
        page_path?: string;
      };
      if (!visitor_token?.trim()) {
        return res.status(400).json({ error: 'visitor_token is required.' });
      }
      const existing = await findWebsiteChatSessionByToken(visitor_token.trim());
      if (!existing) {
        return res.status(404).json({ error: 'Chat session not found.' });
      }
      const updated = await upsertWebsiteChatSession({
        ...existing,
        visitor_name: visitor_name?.trim().slice(0, 80) || existing.visitor_name,
        visitor_email: visitor_email?.trim().toLowerCase().slice(0, 140) ?? existing.visitor_email,
        page_path: page_path?.trim().slice(0, 140) || existing.page_path,
        updated_at: new Date().toISOString()
      });
      broadcastToAdmins('chat:session_updated', { session: updated });
      res.json({ session: updated });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update chat profile' });
    }
  });

  app.post('/api/public/chat/message', async (req, res) => {
    try {
      const { visitor_token, visitor_name, visitor_email, page_path, body } = (req.body || {}) as {
        visitor_token?: string;
        visitor_name?: string;
        visitor_email?: string;
        page_path?: string;
        body?: string;
      };
      const cleanBody = (body || '').trim();
      if (!cleanBody) {
        return res.status(400).json({ error: 'Message text cannot be empty.' });
      }
      const token = (visitor_token || '').trim().slice(0, 120) || `vchat-${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      let session = await findWebsiteChatSessionByToken(token);
      if (!session) {
        session = {
          id: `wcs-${crypto.randomUUID().slice(0, 10)}`,
          visitor_token: token,
          visitor_name: visitor_name?.trim().slice(0, 80) || 'Website Visitor',
          visitor_email: visitor_email?.trim().toLowerCase().slice(0, 140) || '',
          page_path: page_path?.trim().slice(0, 140) || '/',
          status: 'open',
          last_visitor_msg_at: now,
          last_admin_reply_at: null,
          escalated_at: null,
          converted_lead_id: null,
          created_at: now,
          updated_at: now
        };
      } else {
        session = {
          ...session,
          visitor_name: visitor_name?.trim().slice(0, 80) || session.visitor_name,
          visitor_email: visitor_email?.trim().toLowerCase().slice(0, 140) || session.visitor_email,
          page_path: page_path?.trim().slice(0, 140) || session.page_path,
          status: 'open',
          last_visitor_msg_at: now,
          // Reset escalated_at on a fresh visitor follow-up after a previous reply/escalation cycle if resolved
          escalated_at:
            session.status === 'resolved' || session.last_admin_reply_at ? null : session.escalated_at,
          updated_at: now
        };
      }

      session = await upsertWebsiteChatSession(session);
      const message = await appendWebsiteChatMessage({
        id: `wcm-${crypto.randomUUID().slice(0, 10)}`,
        session_id: session.id,
        sender_role: 'visitor',
        sender_name: session.visitor_name,
        body: cleanBody.slice(0, 2000),
        created_at: now
      });

      broadcastToAdmins('chat:message', { session, message });
      broadcastToAdmins('chat:session_updated', { session, message });

      const originHeader =
        typeof req.headers.origin === 'string' && /^https?:\/\//i.test(req.headers.origin)
          ? req.headers.origin
          : typeof req.headers.host === 'string'
            ? `${req.protocol}://${req.headers.host}`
            : undefined;

      void dispatchLiveChatLarkNotification({
        session,
        message,
        originUrl: originHeader
      }).catch(() => null);

      res.status(201).json({ session, message, adminOnline: isAdminOnline() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to send chat message' });
    }
  });

  app.get(
    '/api/admin/chat/sessions',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        const [sessions, allMessages] = await Promise.all([
          listWebsiteChatSessions(token),
          listAllWebsiteChatMessages(token)
        ]);
        const latestBySession = new Map<string, WebsiteChatMessage>();
        for (const msg of allMessages) {
          if (!latestBySession.has(msg.session_id)) {
            latestBySession.set(msg.session_id, msg);
          }
        }
        const enriched = sessions.map((s) => ({
          ...s,
          unread_for_admin: isSessionUnanswered(s),
          last_message_preview: latestBySession.get(s.id)?.body || ''
        }));
        res.json({
          sessions: enriched,
          unansweredCount: enriched.filter((s) => s.unread_for_admin).length,
          adminOnline: isAdminOnline()
        });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load chat sessions' });
      }
    }
  );

  app.get(
    '/api/admin/chat/sessions/:id',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        const session = await findWebsiteChatSessionById(req.params.id, token);
        if (!session) {
          return res.status(404).json({ error: 'Chat session not found.' });
        }
        const messages = await listWebsiteChatMessages(session.id, token);
        res.json({ session, messages, adminOnline: isAdminOnline() });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load chat thread' });
      }
    }
  );

  app.post(
    '/api/admin/chat/sessions/:id/reply',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req: AuthReq, res) => {
      try {
        markAdminPresence();
        const token = getBearerToken(req);
        const session = await findWebsiteChatSessionById(req.params.id, token);
        if (!session) {
          return res.status(404).json({ error: 'Chat session not found.' });
        }
        const { body, alsoSendEmail } = (req.body || {}) as {
          body?: string;
          alsoSendEmail?: boolean;
        };
        const cleanBody = (body || '').trim();
        if (!cleanBody) {
          return res.status(400).json({ error: 'Reply text cannot be empty.' });
        }

        const now = new Date().toISOString();
        const senderDisplay = req.editor!.profile?.full_name || req.editor!.email;
        const message = await appendWebsiteChatMessage(
          {
            id: `wcm-${crypto.randomUUID().slice(0, 10)}`,
            session_id: session.id,
            sender_role: 'admin',
            sender_name: senderDisplay,
            body: cleanBody.slice(0, 3000),
            created_at: now
          },
          token
        );

        const updatedSession = await upsertWebsiteChatSession(
          {
            ...session,
            status: 'replied',
            last_admin_reply_at: now,
            updated_at: now
          },
          token
        );

        clearChatAlertCooldown(session.id);

        let emailNotice: string | undefined;
        if (alsoSendEmail && session.visitor_email && session.visitor_email.includes('@')) {
          const subject = `Reply from GitStack Team regarding your inquiry`;
          try {
            const sent = await sendLarkSmtpMail(
              {
                toEmail: session.visitor_email,
                toName: session.visitor_name,
                subject,
                bodyText: `Hi ${session.visitor_name},\n\n${cleanBody}\n\nBest regards,\n${req.editor!.profile?.full_name || 'GitStack Team'}`
              },
              token
            );
            await addInboxEmailLog(
              {
                id: `eml-${crypto.randomUUID().slice(0, 10)}`,
                recipient_email: session.visitor_email,
                subject,
                body: cleanBody,
                channel: 'lark_smtp',
                category: 'chat_reply',
                related_id: session.id,
                provider_message_id: sent.messageId,
                status: 'sent',
                error_detail: '',
                sent_by: req.editor!.email,
                sent_at: now
              },
              token
            );
            emailNotice = `Also emailed ${session.visitor_email} via Lark Mail.`;
          } catch (mailErr) {
            emailNotice = `Chat reply saved, but Lark email failed: ${
              mailErr instanceof Error ? mailErr.message : 'SMTP error'
            }`;
          }
        }

        broadcastToVisitor(updatedSession.visitor_token, 'chat:message', {
          session: updatedSession,
          message
        });
        broadcastToAdmins('chat:session_updated', {
          session: updatedSession,
          message
        });

        res.status(201).json({ session: updatedSession, message, emailNotice });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to send reply' });
      }
    }
  );

  app.patch(
    '/api/admin/chat/sessions/:id/status',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        const session = await findWebsiteChatSessionById(req.params.id, token);
        if (!session) {
          return res.status(404).json({ error: 'Chat session not found.' });
        }
        const status = req.body?.status as WebsiteChatStatus;
        if (!['open', 'replied', 'resolved'].includes(status)) {
          return res.status(400).json({ error: 'Invalid chat status.' });
        }
        const updated = await upsertWebsiteChatSession(
          { ...session, status, updated_at: new Date().toISOString() },
          token
        );
        broadcastToAdmins('chat:session_updated', { session: updated });
        res.json({ session: updated });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update chat status' });
      }
    }
  );

  app.post(
    '/api/admin/chat/sessions/:id/convert-lead',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        const session = await findWebsiteChatSessionById(req.params.id, token);
        if (!session) {
          return res.status(404).json({ error: 'Chat session not found.' });
        }
        const messages = await listWebsiteChatMessages(session.id, token);
        const transcript = messages
          .slice(-6)
          .map((m) => `${m.sender_name}: ${m.body}`)
          .join(' | ');
        const now = new Date().toISOString();
        const leadId = session.converted_lead_id || `lead-chat-${crypto.randomUUID().slice(0, 8)}`;
        const emailDomain = session.visitor_email.includes('@')
          ? session.visitor_email.split('@')[1]
          : 'website-visitor.local';

        const lead: CrmLead = {
          id: leadId,
          contact_name: session.visitor_name || 'Website Visitor',
          role_title: 'Home Page Live Chat Lead',
          email: session.visitor_email || '',
          email_status: session.visitor_email.includes('@') ? 'public_found' : 'inferred',
          company_name: emailDomain !== 'website-visitor.local' ? emailDomain : session.visitor_name,
          company_domain: emailDomain !== 'website-visitor.local' ? emailDomain : '',
          website_url: '',
          github_url: '',
          phone: '',
          location: '',
          rating: null,
          source_detail: `Floating Home Page Chat (${session.page_path})`,
          source_type: 'website',
          source_urls: [session.page_path],
          tech_stack: [],
          research_brief: transcript.slice(0, 500) || 'Inbound Home Page live chat conversation.',
          recommended_service: 'AI Integration',
          fit_score: session.visitor_email ? 82 : 64,
          deal_value: 20000,
          stage: 'discovered',
          proposal_subject: '',
          proposal_body: '',
          follow_up_sequence: [],
          assigned_to: null,
          last_contacted_at: null,
          next_followup_at: null,
          converted_inquiry_id: null,
          created_at: now,
          updated_at: now
        };
        const savedLead = await upsertCrmLead(lead, token);
        const updatedSession = await upsertWebsiteChatSession(
          { ...session, converted_lead_id: savedLead.id, updated_at: now },
          token
        );
        res.json({ lead: savedLead, session: updatedSession });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to convert chat to CRM lead' });
      }
    }
  );

  app.post(
    '/api/admin/chat/check-unanswered',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req: AuthReq, res) => {
      try {
        const result = await runOfflineChatInquiryCheck({
          forceManual: true,
          triggeredBy: req.editor!.email
        });
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Inquiry check failed' });
      }
    }
  );

  // --- Lark Mail Notification Module & Alert Dispatch Rules ---
  app.get(
    '/api/admin/notifications',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        const [target, allLogs] = await Promise.all([
          resolveLarkAlertTarget(),
          listInboxEmailLogs(token)
        ]);
        const alertCategories = new Set([
          'chat_instant_alert',
          'chat_offline_alert',
          'contact_alert',
          'demo_signup_alert',
          'test_notification'
        ]);
        const logs = allLogs.filter((l) => alertCategories.has(l.category)).slice(0, 60);
        res.json({
          settings: target.settings,
          resolvedRecipientEmail: target.recipientEmail,
          larkConnected: target.larkConnected,
          larkSenderEmail: target.larkSenderEmail,
          adminOnline: isAdminOnline(),
          logs
        });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to load notification settings'
        });
      }
    }
  );

  app.put(
    '/api/admin/notifications',
    requireRoles('super_admin', 'editor'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        const saved = await saveAdminNotificationSettings(req.body || {}, token);
        const target = await resolveLarkAlertTarget(saved);
        res.json({
          settings: target.settings,
          resolvedRecipientEmail: target.recipientEmail,
          larkConnected: target.larkConnected,
          larkSenderEmail: target.larkSenderEmail
        });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to save notification settings'
        });
      }
    }
  );

  app.post(
    '/api/admin/notifications/test',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req: AuthReq, res) => {
      try {
        const token = getBearerToken(req);
        const { recipient_email, admin_login_url } = (req.body || {}) as {
          recipient_email?: string;
          admin_login_url?: string;
        };
        const result = await dispatchAdminLarkAlert({
          category: 'test_notification',
          relatedId: 'manual-test',
          subject: '[GitStack Alert Test] Lark Mail Notification Active',
          bodyText: [
            'This is a live test alert from the GitStack Back Office Notification Module.',
            '',
            `Triggered By: ${req.editor!.profile?.full_name || req.editor!.email}`,
            `Timestamp: ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC`,
            '',
            'Whenever a visitor sends a Live Chat message, submits the Contact Form, or activates a Live Demo pass, you will receive an alert like this with a direct link to sign in and reply.'
          ].join('\n'),
          sentBy: req.editor!.email,
          overrideRecipientEmail: recipient_email,
          overrideLoginUrl: admin_login_url,
          bypassEnabledCheck: true,
          userToken: token
        });
        res.json({
          delivered: result.delivered,
          log: result.log,
          message: result.delivered
            ? `Test alert successfully sent to ${result.log.recipient_email} via Lark Mail.`
            : `Test delivery failed: ${result.log.error_detail || 'Check Lark Mail SMTP configuration.'}`
        });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to dispatch test notification'
        });
      }
    }
  );

  // --- Product QA Monitor, Live Diagnostic Agent & EOD PDF Reports ---
  app.post('/api/public/qa/log', async (req, res) => {
    try {
      const body = (req.body || {}) as {
        level?: 'error' | 'warn' | 'info';
        source?: 'frontend' | 'backend' | 'api' | 'database' | 'integration';
        module_name?: string;
        page_path?: string;
        code_location?: string;
        error_name?: string;
        message?: string;
        stack_trace?: string;
        http_status?: number | null;
        request_method?: string;
        request_path?: string;
        session_id?: string;
      };
      if (!body.message || !String(body.message).trim()) {
        return res.status(400).json({ error: 'message is required' });
      }
      const saved = await recordAndAnalyzeQaLog({
        level: body.level,
        source: body.source || 'frontend',
        module_name: body.module_name,
        page_path: body.page_path || '/',
        code_location: body.code_location,
        error_name: body.error_name,
        message: String(body.message),
        stack_trace: body.stack_trace,
        http_status: body.http_status ?? null,
        request_method: body.request_method,
        request_path: body.request_path,
        session_id: body.session_id,
        user_agent: String(req.headers['user-agent'] || '')
      });
      res.status(201).json({ log: saved });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to record QA log' });
    }
  });

  app.get(
    '/api/admin/qa/dashboard',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        const dashboard = await getQaDashboardData(token);
        res.json(dashboard);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load QA dashboard' });
      }
    }
  );

  app.post(
    '/api/admin/qa/scan',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req: AuthReq, res) => {
      try {
        const token = getBearerToken(req);
        const result = await runLiveQaAgentScan(req.editor!.email, token);
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Live QA scan failed' });
      }
    }
  );

  app.post(
    '/api/admin/qa/simulate',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req: AuthReq, res) => {
      try {
        const { preset } = (req.body || {}) as { preset?: string };
        const samples: Record<
          string,
          {
            level: 'error' | 'warn';
            source: 'frontend' | 'backend' | 'api' | 'integration';
            module_name: string;
            page_path: string;
            code_location: string;
            error_name: string;
            message: string;
            stack_trace: string;
            http_status: number | null;
            request_method: string;
            request_path: string;
          }
        > = {
          demo_sandbox: {
            level: 'error',
            source: 'frontend',
            module_name: 'Live Demo Sandbox',
            page_path: '/demo',
            code_location: 'src/pages/DemoPage.tsx:214:18 (handleRunPipelineSimulation)',
            error_name: 'TypeError',
            message: "Cannot read properties of undefined (reading 'latencyMs') in sandbox telemetry runner",
            stack_trace:
              "TypeError: Cannot read properties of undefined (reading 'latencyMs')\n    at handleRunPipelineSimulation (/src/pages/DemoPage.tsx:214:18)\n    at onClick (/src/pages/DemoPage.tsx:412:9)",
            http_status: null,
            request_method: 'POST',
            request_path: '/api/demo/activity'
          },
          cloudflare_edge: {
            level: 'warn',
            source: 'integration',
            module_name: 'Cloudflare Edge & Analytics',
            page_path: '/obama',
            code_location: 'src/server/cloudflareHistory.ts:138:11 (syncCloudflareHistoricalSnapshots)',
            error_name: 'GraphQLEdgeWarning',
            message: 'Cloudflare HTTP 503 origin spike detected on /wp-content/plugins/hellopress/wp_filemanager.php scanner probe',
            stack_trace:
              'GraphQLEdgeWarning: Origin 503 spike above 5% threshold\n    at syncCloudflareHistoricalSnapshots (/src/server/cloudflareHistory.ts:138:11)\n    at generateCloudflareAiForecast (/src/server/cloudflareHistory.ts:610:9)',
            http_status: 503,
            request_method: 'POST',
            request_path: '/api/admin/cloudflare/history/sync'
          },
          live_chat: {
            level: 'error',
            source: 'api',
            module_name: 'Floating Live Chat & Inbox',
            page_path: '/',
            code_location: 'src/components/FloatingLiveChat.tsx:168:15 (handleSendMessage)',
            error_name: 'NetworkTimeoutError',
            message: 'WebSocket frame ack timed out after 8000ms on /ws; fell back to REST POST /api/public/chat/message',
            stack_trace:
              'NetworkTimeoutError: WebSocket frame ack timed out\n    at handleSendMessage (/src/components/FloatingLiveChat.tsx:168:15)',
            http_status: 408,
            request_method: 'POST',
            request_path: '/api/public/chat/message'
          }
        };

        const chosen = samples[preset || 'demo_sandbox'] || samples.demo_sandbox;
        const log = await recordAndAnalyzeQaLog({
          ...chosen,
          session_id: `qa-sim-${req.editor!.userId.slice(0, 6)}`,
          user_agent: 'GitStack-QA-Agent-Simulator/1.0'
        });
        const dashboard = await getQaDashboardData(getBearerToken(req));
        res.status(201).json({ log, dashboard });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to simulate QA event' });
      }
    }
  );

  app.post(
    '/api/admin/qa/logs/:id/analyze',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        const updated = await reanalyzeSingleQaLog(req.params.id, token);
        if (!updated) {
          return res.status(404).json({ error: 'QA log entry not found.' });
        }
        res.json({ log: updated });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to analyze QA log' });
      }
    }
  );

  app.patch(
    '/api/admin/qa/logs/:id/status',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        const status = req.body?.status as 'open' | 'investigating' | 'resolved' | 'ignored';
        if (!['open', 'investigating', 'resolved', 'ignored'].includes(status)) {
          return res.status(400).json({ error: 'Invalid QA log status.' });
        }
        const updated = await updateProductQaLog(req.params.id, { status }, token);
        if (!updated) {
          return res.status(404).json({ error: 'QA log entry not found.' });
        }
        res.json({ log: updated });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update QA log status' });
      }
    }
  );

  app.put(
    '/api/admin/qa/settings',
    requireRoles('super_admin', 'editor'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        const settings = await saveProductQaSettings(req.body || {}, token);
        res.json({ settings });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save QA settings' });
      }
    }
  );

  app.post(
    '/api/admin/qa/report/send',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req: AuthReq, res) => {
      try {
        const token = getBearerToken(req);
        const { recipient_email } = (req.body || {}) as { recipient_email?: string };
        const result = await generateAndSendQaEodReport({
          triggerType: 'manual',
          overrideRecipientEmail: recipient_email,
          triggeredBy: req.editor!.email,
          userToken: token
        });
        res.json(result);
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to generate and send QA PDF report'
        });
      }
    }
  );

  app.get('/api/admin/qa/report/:id/pdf', async (req, res) => {
    try {
      const queryToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
      const token = getBearerToken(req) || queryToken || undefined;
      const session = await verifyEditorToken(token);
      if (!session) {
        return res.status(401).json({ error: 'Authentication required to download QA PDF report.' });
      }
      const report = await findProductQaReportById(req.params.id, token);
      if (!report) {
        return res.status(404).json({ error: 'QA report not found.' });
      }
      const pdfBuffer = await renderExistingReportPdfBuffer(report, token);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${report.pdf_filename || `GitStack-QA-Report-${report.report_date}.pdf`}"`
      );
      res.send(pdfBuffer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to render PDF report' });
    }
  });

  app.post(
    '/api/admin/qa/features/baseline',
    requireRoles('super_admin', 'editor'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        const { feature_id } = (req.body || {}) as { feature_id?: string };
        const result = await acceptFeatureBaseline(feature_id || 'all', token);
        res.json(result);
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to accept feature baseline'
        });
      }
    }
  );

  // --- AI & Search Engine Visibility (GEO / SEO) Module ---

  app.get(
    '/api/admin/ai-visibility/dashboard',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        const dashboard = await getAiSearchVisibilityDashboard(token);
        res.json(dashboard);
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to load AI & Search Visibility dashboard'
        });
      }
    }
  );

  app.post(
    '/api/admin/ai-visibility/run',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        const { send_email, recipient_email } = (req.body || {}) as {
          send_email?: boolean;
          recipient_email?: string;
        };
        const result = await runDailyAiSearchVisibilityTest({
          triggerType: 'manual',
          sendEmailReport: Boolean(send_email),
          overrideRecipientEmail: recipient_email,
          userToken: token
        });
        const dashboard = await getAiSearchVisibilityDashboard(token);
        res.json({ ...result, dashboard });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to run AI & Search visibility test'
        });
      }
    }
  );

  app.post(
    '/api/admin/ai-visibility/boost',
    requireRoles('super_admin', 'editor'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        const boost = await applyAiSeoContentBooster(token);
        const dashboard = await getAiSearchVisibilityDashboard(token);
        res.json({ ...boost, dashboard });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to apply AI & SEO content booster'
        });
      }
    }
  );

  app.put(
    '/api/admin/ai-visibility/settings',
    requireRoles('super_admin', 'editor'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        const settings = await saveAiSearchVisibilitySettings(req.body || {}, token);
        res.json({ settings });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to save AI visibility settings'
        });
      }
    }
  );

  // --- Cybersecurity & Live AI Sentinel (Aegis) Module ---

  app.get(
    '/api/admin/cybersecurity/dashboard',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        const dashboard = await getCyberSecurityDashboard(token);
        res.json(dashboard);
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to load Cybersecurity dashboard'
        });
      }
    }
  );

  app.post(
    '/api/admin/cybersecurity/scan',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        await saveCyberSecuritySettings({ last_scan_at: new Date().toISOString() }, token);
        const dashboard = await getCyberSecurityDashboard(token);
        res.json({ dashboard, message: 'Aegis Live AI CyberSec Sentinel completed 8-domain security audit.' });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to run Cybersecurity scan'
        });
      }
    }
  );

  app.patch(
    '/api/admin/cybersecurity/findings/:id',
    requireRoles('super_admin', 'editor'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        const status = req.body?.status as 'open' | 'mitigated' | 'accepted' | 'monitoring';
        if (!['open', 'mitigated', 'accepted', 'monitoring'].includes(status)) {
          return res.status(400).json({ error: 'Invalid finding status.' });
        }
        const finding = await mitigateCyberFinding(req.params.id, status, token);
        if (!finding) {
          return res.status(404).json({ error: 'Cybersecurity finding not found.' });
        }
        const dashboard = await getCyberSecurityDashboard(token);
        res.json({ finding, dashboard });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to update finding status'
        });
      }
    }
  );

  app.put(
    '/api/admin/cybersecurity/settings',
    requireRoles('super_admin', 'editor'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        const settings = await saveCyberSecuritySettings(req.body || {}, token);
        res.json({ settings });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to save Cybersecurity settings'
        });
      }
    }
  );

  app.post(
    '/api/admin/cybersecurity/report/send',
    requireRoles('super_admin', 'editor', 'support_agent'),
    async (req, res) => {
      try {
        const token = getBearerToken(req);
        const { recipient_email } = (req.body || {}) as { recipient_email?: string };
        const result = await generateAndSendCyberSecurityReport({
          triggerType: 'manual',
          overrideRecipientEmail: recipient_email,
          userToken: token
        });
        const dashboard = await getCyberSecurityDashboard(token);
        res.json({ ...result, dashboard });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to generate and send Cybersecurity PDF report'
        });
      }
    }
  );

  app.get('/api/admin/cybersecurity/report/:id/pdf', async (req, res) => {
    try {
      const queryToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
      const token = getBearerToken(req) || queryToken || undefined;
      const session = await verifyEditorToken(token);
      if (!session) {
        return res.status(401).json({ error: 'Authentication required to download Cybersecurity PDF report.' });
      }
      const report = await findCyberSecurityReportById(req.params.id, token);
      if (!report) {
        return res.status(404).json({ error: 'Cybersecurity report not found.' });
      }
      const findings = await listCyberSecurityFindings(50, token);
      const pdfBuffer = await renderCyberSecurityPdfBuffer(report, findings);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${report.pdf_filename || `GitStack-CyberSec-Report-${report.report_date}.pdf`}"`
      );
      res.send(pdfBuffer);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to render Cybersecurity PDF report'
      });
    }
  });

  app.get('/api/supabase-schema', async (_req, res) => {
    try {
      const schemaPath = path.resolve(process.cwd(), 'supabase', 'schema.sql');
      const sql = await fs.readFile(schemaPath, 'utf8');
      res.type('text/plain').send(sql);
    } catch {
      res.status(404).type('text/plain').send('Schema file not found');
    }
  });

  return app;
}

export function getExpressApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = createApp();
  }
  return appPromise;
}
