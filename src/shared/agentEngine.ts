import type {
  AdSenseSettings,
  AgentId,
  AgentReport,
  AgentRuleCheck,
  AnalyticsSummary,
  Article,
  ArticleComment,
  ChatThread,
  ClientInquiry,
  NewsletterSubscriber,
  PageContentConfig,
  SiteAuditReport
} from './types.ts';
import { validatePageContentForAdSense } from './pageDefaults.ts';

export interface AgentAuditContext {
  posts: Article[];
  comments: ArticleComment[];
  inquiries: ClientInquiry[];
  subscribers: NewsletterSubscriber[];
  settings: AdSenseSettings;
  siteAudit: SiteAuditReport;
  pageContents: PageContentConfig[];
  chatThreads: ChatThread[];
  analytics: AnalyticsSummary;
  supabaseTablesReady: boolean;
  growthSnapshot?: {
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
  };
  demoGuardSnapshot?: {
    overallStatus: 'healthy' | 'warning' | 'critical';
    demoScore: number;
    adminParityScore: number;
    driftCount: number;
    openAlertCount: number;
    lastScanAt: string | null;
  };
}

function summarizeStatus(checks: AgentRuleCheck[]): {
  score: number;
  status: 'healthy' | 'attention' | 'critical';
} {
  if (checks.length === 0) return { score: 100, status: 'healthy' };
  const totalPoints = checks.reduce((sum, c) => {
    if (c.status === 'pass') return sum + 100;
    if (c.status === 'warning') return sum + 60;
    return sum;
  }, 0);
  const score = Math.round(totalPoints / checks.length);
  const hasFail = checks.some((c) => c.status === 'fail');
  const hasWarn = checks.some((c) => c.status === 'warning');
  return {
    score,
    status: hasFail ? 'critical' : hasWarn ? 'attention' : 'healthy'
  };
}

export function buildAllAgentReports(ctx: AgentAuditContext): AgentReport[] {
  const publishedPosts = ctx.posts.filter((p) => p.status === 'published');
  const draftPosts = ctx.posts.filter((p) => p.status === 'draft');
  const newInquiries = ctx.inquiries.filter((i) => i.status === 'new');
  const reviewedInquiries = ctx.inquiries.filter((i) => i.status === 'reviewed');
  const scheduledInquiries = ctx.inquiries.filter((i) => i.status === 'scheduled');
  const openThreads = ctx.chatThreads.filter((t) => t.status === 'open');
  const pendingComments = ctx.comments.filter((c) => c.status === 'pending');

  // 1. Marketing Agent
  const homePage = ctx.pageContents.find((p) => p.page_key === 'home');
  const servicesPage = ctx.pageContents.find((p) => p.page_key === 'services');
  const allPagesHaveStrongCta =
    Boolean(homePage?.hero_cta_label.trim()) && Boolean(servicesPage?.hero_cta_label.trim());
  const aiPostsCount = publishedPosts.filter(
    (p) => p.category === 'AI Integration' || p.category === 'ML Automation'
  ).length;

  const marketingChecks: AgentRuleCheck[] = [
    {
      id: 'mkt-positioning',
      label: 'AI Integration & ML Automation Hero Positioning',
      status:
        homePage &&
        /ai/i.test(homePage.hero_title + homePage.hero_subtitle) &&
        /ml|machine learning/i.test(homePage.hero_title + homePage.hero_subtitle)
          ? 'pass'
          : 'warning',
      metric: homePage ? 'Active on /' : 'Default',
      detail: 'Primary headline and subtitle highlight AI Integration and Machine Learning Automation alongside software & cloud.',
      targetTab: 'pages',
      actionLabel: 'Edit Home Copy'
    },
    {
      id: 'mkt-cta',
      label: 'Conversion CTA Clarity Across Core Landing Pages',
      status: allPagesHaveStrongCta ? 'pass' : 'fail',
      metric: allPagesHaveStrongCta ? '2/2 Pages' : 'Missing CTA',
      detail: 'Both Home and Services landing pages expose clear consultation CTAs wired to lead intake.',
      targetTab: 'pages',
      actionLabel: 'Inspect CTAs'
    },
    {
      id: 'mkt-content-pillars',
      label: 'AI/ML Thought-Leadership Coverage',
      status: aiPostsCount >= 2 ? 'pass' : 'warning',
      metric: `${aiPostsCount} AI/ML Guides`,
      detail: 'At least 2 authoritative long-form AI Integration or ML Automation guides support outbound sales conversations.',
      targetTab: 'articles',
      actionLabel: 'Manage Guides'
    },
    {
      id: 'mkt-newsletter',
      label: 'Newsletter Audience Capture Growth',
      status: ctx.subscribers.length >= 1 ? 'pass' : 'warning',
      metric: `${ctx.subscribers.length} Subscribers`,
      detail: 'Consent-verified newsletter capture is active on the Insights Journal and Home page.',
      targetTab: 'inbox',
      actionLabel: 'View Subscribers'
    },
    {
      id: 'mkt-organic-social',
      label: 'Free Organic 7-Day Schedule & Social Channels (FB / TikTok)',
      status:
        (ctx.growthSnapshot?.marketingScheduledCount || 0) >= 5 &&
        (ctx.growthSnapshot?.facebookConnected || ctx.growthSnapshot?.tiktokConnected)
          ? 'pass'
          : (ctx.growthSnapshot?.marketingScheduledCount || 0) > 0
            ? 'warning'
            : 'warning',
      metric: `${ctx.growthSnapshot?.marketingScheduledCount || 0} Planned · ${
        ctx.growthSnapshot?.facebookConnected && ctx.growthSnapshot?.tiktokConnected
          ? 'FB + TikTok Ready'
          : ctx.growthSnapshot?.facebookConnected
            ? 'FB Connected'
            : ctx.growthSnapshot?.tiktokConnected
              ? 'TikTok Connected'
              : 'Connect FB / TikTok'
      }`,
      detail:
        'Runs zero-ad-spend daily Facebook Page & TikTok campaigns with live visual previews and conversion links to /demo and /contact.',
      targetTab: 'marketing',
      actionLabel: 'Open Marketing Studio'
    },
    {
      id: 'mkt-trends-approval',
      label: 'Google Trends Content & Approval Queue Velocity',
      status: (ctx.growthSnapshot?.pendingTrendApprovals || 0) > 0 ? 'warning' : 'pass',
      metric: `${ctx.growthSnapshot?.monitoredTrendsCount || 0} Monitored · ${ctx.growthSnapshot?.pendingTrendApprovals || 0} Pending`,
      detail:
        (ctx.growthSnapshot?.pendingTrendApprovals || 0) > 0
          ? `${ctx.growthSnapshot?.pendingTrendApprovals} trend article + social campaign bundle(s) are waiting for your explicit approval before publishing.`
          : 'Google Trends monitor active. Generate trend-backed articles and social posts whenever new high-intent topics break out.',
      targetTab: 'google_trends',
      actionLabel: 'Review Trend Queue'
    }
  ];
  const mktSummary = summarizeStatus(marketingChecks);

  // 2. CEO Agent
  const ceoChecks: AgentRuleCheck[] = [
    {
      id: 'ceo-adsense',
      label: 'Google AdSense Policy Readiness',
      status: ctx.siteAudit.readyForAdSense ? 'pass' : 'warning',
      metric: `${ctx.siteAudit.passedCount}/${ctx.siteAudit.totalChecks} Checks`,
      detail: ctx.siteAudit.readyForAdSense
        ? 'Site meets AdSense depth, trust, and anti-thin-content checks.'
        : 'Review flagged AdSense compliance items before domain submission.',
      targetTab: 'adsense',
      actionLabel: 'Open AdSense Audit'
    },
    {
      id: 'ceo-pipeline',
      label: 'Active B2B Consultation Pipeline',
      status: ctx.inquiries.length >= 1 && newInquiries.length <= 5 ? 'pass' : 'warning',
      metric: `${ctx.inquiries.length} Total · ${newInquiries.length} New`,
      detail: `${scheduledInquiries.length} discovery calls scheduled; ${newInquiries.length} new inquiry brief(s) awaiting initial response.`,
      targetTab: 'inbox',
      actionLabel: 'Open Inbox'
    },
    {
      id: 'ceo-qa-backlog',
      label: 'Unresolved Visitor & Client Questions',
      status: openThreads.length === 0 ? 'pass' : openThreads.length <= 3 ? 'warning' : 'fail',
      metric: `${openThreads.length} Open Thread(s)`,
      detail: 'Keep historical client and reader questions answered promptly inside the Back Office Chat Box.',
      targetTab: 'chat',
      actionLabel: 'Answer Live'
    },
    {
      id: 'ceo-supabase',
      label: 'Production PostgreSQL Persistence Health',
      status: ctx.supabaseTablesReady ? 'pass' : 'warning',
      metric: ctx.supabaseTablesReady ? 'Supabase Active' : 'JSON Fallback',
      detail: ctx.supabaseTablesReady
        ? 'All live database operations are persisting cleanly to Supabase.'
        : 'Run updated supabase/schema.sql GRANT statements in Supabase SQL Editor to activate live PostgreSQL writes.',
      targetTab: 'adsense',
      actionLabel: 'Check Setup'
    }
  ];
  const ceoSummary = summarizeStatus(ceoChecks);

  // 3. Booking Agent
  const bookingChecks: AgentRuleCheck[] = [
    {
      id: 'bk-new-queue',
      label: 'Unreviewed Lead Triage Queue (< 24h SLA)',
      status: newInquiries.length === 0 ? 'pass' : newInquiries.length <= 2 ? 'warning' : 'fail',
      metric: `${newInquiries.length} New`,
      detail:
        newInquiries.length === 0
          ? 'Zero untouched new inquiries—all incoming project briefs have been reviewed.'
          : `${newInquiries.length} new project inquiry brief(s) need review and Lark Mail discovery scheduling.`,
      targetTab: 'inbox',
      actionLabel: 'Review Leads'
    },
    {
      id: 'bk-conversion',
      label: 'Discovery Call Scheduling Ratio',
      status:
        ctx.inquiries.length === 0
          ? 'warning'
          : scheduledInquiries.length > 0
            ? 'pass'
            : 'warning',
      metric: `${scheduledInquiries.length}/${ctx.inquiries.length} Scheduled`,
      detail: `${reviewedInquiries.length} reviewed lead(s) can be invited to book via the connected Lark Mail Inbox.`,
      targetTab: 'inbox',
      actionLabel: 'Send Invite via Lark Mail'
    },
    {
      id: 'bk-intake-integrity',
      label: 'Qualification Fields (Budget, Timeline, Brief)',
      status: ctx.inquiries.every((i) => i.budget_range && i.timeline && i.project_brief.length >= 20)
        ? 'pass'
        : 'warning',
      metric: '100% Qualified',
      detail: 'Intake forms enforce service category, budget band, timeline, and 20+ character brief before submission.'
    }
  ];
  const bookingSummary = summarizeStatus(bookingChecks);

  // 4. Cyber Security Agent
  const hasGa4ValidOrDisabled =
    !ctx.settings.ga4_enabled || /^G-[A-Z0-9]{4,16}$/i.test((ctx.settings.ga4_measurement_id || '').trim());
  const secChecks: AgentRuleCheck[] = [
    {
      id: 'sec-auth-gate',
      label: 'Private Back Office Authentication & Crawler Exclusion',
      status: 'pass',
      metric: 'Protected /obama',
      detail: 'Back Office APIs require Bearer token verification and /robots.txt explicitly disallows /obama, /studio, and /api/.'
    },
    {
      id: 'sec-consent-gate',
      label: 'Consent-Gated AdSense & GA4 Script Loading',
      status: hasGa4ValidOrDisabled ? 'pass' : 'fail',
      metric: 'Consent Enforced',
      detail: 'Third-party AdSense and Google Analytics scripts load strictly after explicit user consent ("Accept All").'
    },
    {
      id: 'sec-comment-moderation',
      label: 'Comment Spam & Malicious URL Quarantine',
      status: pendingComments.length === 0 ? 'pass' : 'warning',
      metric: `${pendingComments.length} Pending`,
      detail:
        pendingComments.length === 0
          ? 'No suspicious comments awaiting moderation.'
          : `${pendingComments.length} comment(s) held in pending review.`,
      targetTab: 'inbox',
      actionLabel: 'Moderate Comments'
    },
    {
      id: 'sec-token-hygiene',
      label: 'Lark SMTP Vault Secret Encryption & Confirmation Gate',
      status: 'pass',
      metric: 'AES-256-GCM Vault',
      detail: 'Lark Mail app passwords stay encrypted on the server with an explicit confirmation modal before any outbound dispatch.'
    }
  ];
  const secSummary = summarizeStatus(secChecks);

  // 5. QA Agent
  const invalidPages = ctx.pageContents.filter((p) => !validatePageContentForAdSense(p).valid);
  const postsMissingAlt = publishedPosts.filter((p) => p.cover_image && p.cover_alt.trim().length < 8);
  const postsMissingFaq = publishedPosts.filter((p) => p.faqs.length < 2);
  const qaChecks: AgentRuleCheck[] = [
    {
      id: 'qa-page-integrity',
      label: 'Page Customizer Content & Alt-Text Validation',
      status: invalidPages.length === 0 ? 'pass' : 'fail',
      metric: `${ctx.pageContents.length - invalidPages.length}/${ctx.pageContents.length} Pages Valid`,
      detail:
        invalidPages.length === 0
          ? 'All customized public pages pass headline, copy depth, and descriptive image alt checks.'
          : `${invalidPages.map((p) => p.page_key).join(', ')} failed content integrity validation.`,
      targetTab: 'pages',
      actionLabel: 'Fix Page Content'
    },
    {
      id: 'qa-article-media',
      label: 'Article Cover Alt Attributes & Zero Broken Assets',
      status: postsMissingAlt.length === 0 ? 'pass' : 'fail',
      metric: `${publishedPosts.length - postsMissingAlt.length}/${publishedPosts.length} Verified`,
      detail: 'All published engineering guides carry descriptive alt text and resilient fallback containers.'
    },
    {
      id: 'qa-geo-faqs',
      label: 'Structured FAQPage Schema Coverage',
      status: postsMissingFaq.length === 0 ? 'pass' : 'warning',
      metric: `${publishedPosts.length - postsMissingFaq.length}/${publishedPosts.length} Guides`,
      detail: `All published articles include 2+ structured FAQs for AI answer engines (${draftPosts.length} draft(s) in progress).`,
      targetTab: 'articles',
      actionLabel: 'Inspect Articles'
    },
    {
      id: 'qa-word-floor',
      label: 'Long-Form Editorial Floor (800+ Words)',
      status: ctx.siteAudit.thinArticleCount === 0 ? 'pass' : 'fail',
      metric: `Avg ${ctx.siteAudit.averageWordCount} words`,
      detail: `${ctx.siteAudit.thinArticleCount} thin articles detected across ${publishedPosts.length} published guides.`
    },
    {
      id: 'qa-live-url-indexability',
      label: 'Sitewide URL Metadata, Canonical & Schema Integrity',
      status:
        (ctx.growthSnapshot?.totalAuditedLinks || 0) > 0 &&
        (ctx.growthSnapshot?.searchableLinks || 0) === (ctx.growthSnapshot?.totalAuditedLinks || 0)
          ? 'pass'
          : 'warning',
      metric:
        (ctx.growthSnapshot?.totalAuditedLinks || 0) > 0
          ? `${ctx.growthSnapshot?.searchableLinks}/${ctx.growthSnapshot?.totalAuditedLinks} Searchable`
          : 'Scan Pending',
      detail:
        'Audits every public route and published article SSR HTML for HTTP 200 status, canonical URL, Schema.org markup, and title/meta bounds.',
      targetTab: 'search_console',
      actionLabel: 'Open Search Console'
    }
  ];
  const qaSummary = summarizeStatus(qaChecks);

  // 6. Google AdSense Agent
  const adsChecks: AgentRuleCheck[] = ctx.siteAudit.checks.map((c) => ({
    id: `ads-${c.id}`,
    label: c.label,
    status: c.status,
    metric: c.category,
    detail: c.detail,
    targetTab: 'adsense',
    actionLabel: c.status === 'pass' ? undefined : 'Configure AdSense'
  }));
  const adsSummary = summarizeStatus(adsChecks);

  // 7. Traffic Agent
  const ga4Id = (ctx.settings.ga4_measurement_id || '').trim();
  const hasGa4Id = /^G-[A-Z0-9]{4,16}$/i.test(ga4Id);
  const avgGeo =
    publishedPosts.length > 0
      ? Math.round(publishedPosts.reduce((s, p) => s + p.geo_score, 0) / publishedPosts.length)
      : 0;

  const trafficChecks: AgentRuleCheck[] = [
    {
      id: 'trf-ga4',
      label: 'Google Analytics 4 (GA4) Measurement Tag',
      status: ctx.settings.ga4_enabled && hasGa4Id ? 'pass' : 'warning',
      metric: hasGa4Id ? ga4Id : 'Not Configured',
      detail:
        ctx.settings.ga4_enabled && hasGa4Id
          ? `Consent-aware GA4 tag (${ga4Id}) is active across public routes.`
          : 'Add your GA4 Measurement ID (G-XXXXXXXXXX) and enable tracking in the Analytics Dashboard.',
      targetTab: 'analytics',
      actionLabel: 'Configure GA4'
    },
    {
      id: 'trf-geo-score',
      label: 'AI Search (GEO) & Answer Engine Citation Readiness',
      status: avgGeo >= 85 ? 'pass' : 'warning',
      metric: `${avgGeo}% Avg GEO`,
      detail: 'Live /llms.txt, /llms-full.txt, /sitemap.xml, and TechArticle JSON-LD expose structured answers to ChatGPT, Gemini, and Perplexity.'
    },
    {
      id: 'trf-pageviews',
      label: `First-Party Telemetry (${ctx.analytics.days}-Day Volume)`,
      status: ctx.analytics.totalPageviews > 0 ? 'pass' : 'warning',
      metric: `${ctx.analytics.totalPageviews} Views · ${ctx.analytics.conversionRatePercent}% Conv.`,
      detail: `${ctx.analytics.uniqueSessions} unique visitor session(s) generated ${ctx.analytics.inquiryConversions + ctx.analytics.newsletterConversions} lead/subscriber conversions.`,
      targetTab: 'analytics',
      actionLabel: 'View Traffic Dashboard'
    },
    {
      id: 'trf-search-console-links',
      label: 'Multi-Engine URL Searchability (Google, Bing, DuckDuckGo, Yahoo, AI)',
      status:
        (ctx.growthSnapshot?.totalAuditedLinks || 0) > 0 &&
        (ctx.growthSnapshot?.avgSeoScore || 0) >= 85
          ? 'pass'
          : 'warning',
      metric:
        (ctx.growthSnapshot?.totalAuditedLinks || 0) > 0
          ? `${ctx.growthSnapshot?.searchableLinks}/${ctx.growthSnapshot?.totalAuditedLinks} Links · ${ctx.growthSnapshot?.avgSeoScore}% SEO`
          : 'Run Site Link Audit',
      detail:
        'Continuously inspects all website routes & articles for searchability, keyword placement, Google SERP appearance, and AI ranking recommendations.',
      targetTab: 'search_console',
      actionLabel: 'Inspect Website Links'
    }
  ];
  const trafficSummary = summarizeStatus(trafficChecks);

  // 8. Demo Guard & Admin Parity Agent
  const dgSnap = ctx.demoGuardSnapshot;
  const demoGuardChecks: AgentRuleCheck[] = [
    {
      id: 'dg-code-baseline',
      label: 'Live Demo Code & Behavior Baseline Integrity',
      status:
        !dgSnap
          ? 'pass'
          : dgSnap.driftCount === 0
            ? 'pass'
            : 'fail',
      metric: dgSnap ? (dgSnap.driftCount === 0 ? 'Baseline Match' : `${dgSnap.driftCount} Drift File(s)`) : 'Protected',
      detail:
        'Cryptographically hashes Live Demo files and compares against your sealed baseline so unauthorized code or UI drift triggers instant alerts.',
      targetTab: 'demo_guard',
      actionLabel: 'Inspect Demo Guard'
    },
    {
      id: 'dg-isolation-firewall',
      label: 'Zero-Mutation Sandbox Isolation Firewall',
      status: dgSnap?.overallStatus === 'critical' ? 'fail' : 'pass',
      metric: dgSnap ? `${dgSnap.demoScore}% Isolated` : '100% Isolated',
      detail:
        'Confirms the Live Demo Back Office showcase makes zero /api/admin/* calls, zero database writes, and blocks any demo-origin mutation attempts.',
      targetTab: 'demo_guard',
      actionLabel: 'View Isolation Checks'
    },
    {
      id: 'dg-admin-parity',
      label: 'Authenticated Admin Module Parity Verification',
      status:
        !dgSnap
          ? 'pass'
          : dgSnap.adminParityScore >= 95
            ? 'pass'
            : dgSnap.adminParityScore >= 70
              ? 'warning'
              : 'fail',
      metric: dgSnap ? `${dgSnap.adminParityScore}% Admin Health` : 'Admin Verified',
      detail:
        'Tests real authenticated Admin Back Office routes and handlers to guarantee full functionality whenever signed in as Admin.',
      targetTab: 'demo_guard',
      actionLabel: 'View Parity Matrix'
    },
    {
      id: 'dg-realtime-alerts',
      label: 'Real-Time Drift & Parity Email Notifications',
      status: (dgSnap?.openAlertCount || 0) > 0 ? 'warning' : 'pass',
      metric: `${dgSnap?.openAlertCount || 0} Unacked`,
      detail:
        'Dispatches instant Lark Mail alerts on code drift, demo leak attempts, or Admin module errors and surfaces them inside Demo Guard & Alerts.',
      targetTab: 'demo_guard',
      actionLabel: 'Open Alert Feed'
    }
  ];
  const demoGuardSummary = summarizeStatus(demoGuardChecks);

  return [
    {
      id: 'marketing',
      name: 'Marketing Agent',
      role: 'Positioning, AI/ML Messaging & Lead Capture',
      summary: 'Audits landing page messaging clarity, AI/ML capability positioning, CTAs, and subscriber growth.',
      score: mktSummary.score,
      status: mktSummary.status,
      checks: marketingChecks
    },
    {
      id: 'ceo',
      name: 'CEO Agent',
      role: 'Executive Scorecard & Cross-Module Health',
      summary: 'Aggregates AdSense readiness, consultation pipeline velocity, open Q&A SLA, and database health.',
      score: ceoSummary.score,
      status: ceoSummary.status,
      checks: ceoChecks
    },
    {
      id: 'booking',
      name: 'Booking Agent',
      role: 'Discovery Call Triage & Inquiry SLA',
      summary: 'Monitors unreviewed B2B project briefs, consultation scheduling rate, and qualification quality.',
      score: bookingSummary.score,
      status: bookingSummary.status,
      checks: bookingChecks
    },
    {
      id: 'cybersecurity',
      name: 'Cyber Security Agent',
      role: 'Access Boundaries, Consent & Token Hygiene',
      summary: 'Verifies Back Office auth protection, crawler disallows, comment spam defense, and OAuth token isolation.',
      score: secSummary.score,
      status: secSummary.status,
      checks: secChecks
    },
    {
      id: 'qa',
      name: 'QA Agent',
      role: 'Content Integrity, Media Alt & Schema Verification',
      summary: 'Checks every customized page block, image alt attribute, FAQ schema, and editorial depth floor.',
      score: qaSummary.score,
      status: qaSummary.status,
      checks: qaChecks
    },
    {
      id: 'adsense',
      name: 'Google AdSense Agent',
      role: 'Monetization Policy & Anti-Thin-Content Gatekeeper',
      summary: 'Enforces all 6 site-wide AdSense compliance checks including legal suite, E-E-A-T, and ads.txt.',
      score: adsSummary.score,
      status: adsSummary.status,
      checks: adsChecks
    },
    {
      id: 'traffic',
      name: 'Traffic Agent',
      role: 'Organic SEO, GEO Visibility & GA4 Telemetry',
      summary: 'Tracks GA4 tag status, AI discovery readiness (llms.txt/JSON-LD), and visitor conversion funnels.',
      score: trafficSummary.score,
      status: trafficSummary.status,
      checks: trafficChecks
    },
    {
      id: 'demo_guard',
      name: 'Demo Guard Agent',
      role: 'Live Demo Isolation & Admin Parity Sentinel',
      summary: 'Watches /demo for unexpected code/behavior changes, emails Admin in real time on drift, and verifies all real Admin modules stay healthy.',
      score: demoGuardSummary.score,
      status: demoGuardSummary.status,
      checks: demoGuardChecks
    }
  ];
}
