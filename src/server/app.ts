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
  Article,
  ArticleComment,
  ChatMessage,
  ChatThread,
  ChatThreadStatus,
  ClientInquiry,
  CommentStatus,
  HeaderSurface,
  InquiryStatus,
  NewsletterSubscriber,
  PageContentConfig,
  PageKey,
  RoutingRule,
  SiteAuditCheck,
  SiteAuditReport,
  TaskPriority,
  ThemePresetId,
  UserRole,
  UserStatus,
  UserWorkflowItem
} from '../shared/types.ts';
import { collectInfrastructureMetrics } from './infrastructure.ts';
import {
  addAgentConversation,
  addChatMessage,
  addSubscriber,
  assignChatThread,
  assignInquiry,
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
  deletePost,
  deleteTeamUser,
  deleteWorkflowItem,
  getAdSenseSettings,
  getAgentReportSettings,
  getAnalyticsSummary,
  getPostBySlug,
  getSupabaseAutomationMode,
  getSupabaseUrl,
  isSupabaseConfigured,
  listAgentConversations,
  listAgentEmailReports,
  listAgentOfficeProfiles,
  listAgentTasks,
  listChatMessages,
  listChatThreads,
  listComments,
  listInquiries,
  listPageContents,
  listPosts,
  listRoutingRules,
  listSubscribers,
  listUserDirectory,
  listUserProfiles,
  listWorkflowItems,
  recordAgentEmailReport,
  recordAnalyticsEvent,
  saveAdSenseSettings,
  saveAgentReportSettings,
  saveRoutingRules,
  seedStarterDataToSupabase,
  signInEditor,
  updateChatThreadStatus,
  updateCommentStatus,
  updateInquiryStatus,
  updateMyUserProfile,
  updateTeamUser,
  updateWorkflowItem,
  upsertAgentOfficeProfile,
  upsertAgentTask,
  upsertPageContent,
  upsertPost,
  verifyEditorToken,
  type EditorSession
} from './repository.ts';

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

  await ensureDatabaseReadyOnBoot();

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
      'User-agent: ChatGPT-User',
      'Allow: /',
      '',
      'User-agent: Google-Extended',
      'Allow: /',
      '',
      'User-agent: PerplexityBot',
      'Allow: /',
      '',
      'User-agent: ClaudeBot',
      'Allow: /',
      '',
      `Sitemap: ${origin}/sitemap.xml`,
      `# AI Manifest: ${origin}/llms.txt`
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

    const resendKey = process.env.RESEND_API_KEY?.trim();
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || 'GitStack Agents <onboarding@resend.dev>';

    let status: AgentEmailReport['status'] = 'skipped_unconfigured';
    let channel: AgentEmailReport['channel'] = 'cron_dispatch';
    let providerMessageId = '';
    let errorDetail = '';
    let deliveredViaServer = false;

    if (resendKey) {
      channel = triggerType === 'daily_cron' ? 'cron_dispatch' : 'resend_api';
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [settings.recipient_email],
            subject: digest.subject,
            text: digest.bodyText
          })
        });
        const payload = (await resendRes.json().catch(() => ({}))) as {
          id?: string;
          message?: string;
          error?: { message?: string };
        };
        if (resendRes.ok && payload.id) {
          status = 'sent';
          providerMessageId = payload.id;
          deliveredViaServer = true;
        } else {
          status = 'failed';
          errorDetail =
            payload.message || payload.error?.message || `Resend returned HTTP ${resendRes.status}.`;
        }
      } catch (err) {
        status = 'failed';
        errorDetail = err instanceof Error ? err.message : 'Resend network delivery error.';
      }
    } else {
      errorDetail =
        'RESEND_API_KEY is not configured for unattended background cron email sending. Use "Send via Gmail Now" in Back Office or configure RESEND_API_KEY in Vercel environment variables.';
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
        preferred_channel:
          payload.preferred_channel === 'resend' || payload.preferred_channel === 'gmail'
            ? payload.preferred_channel
            : current.preferred_channel,
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
      const channel =
        payload.channel === 'resend_api' || payload.channel === 'cron_dispatch'
          ? payload.channel
          : 'gmail_api';
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
        getBearerToken(req)
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
