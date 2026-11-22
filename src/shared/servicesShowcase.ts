import type { CustomContentBlock, WorkspaceModuleId } from './types.ts';

export type BackOfficeCategoryId =
  | 'cat-command'
  | 'cat-growth'
  | 'cat-clients'
  | 'cat-analytics'
  | 'cat-content'
  | 'cat-system';

export interface BackOfficeCategoryShowcase {
  id: BackOfficeCategoryId;
  code: string;
  name: string;
  summary: string;
  moduleCount: number;
  slideId: string;
  seoFocus: string;
}

export interface BackOfficeModuleShowcase {
  id: WorkspaceModuleId;
  order: string;
  categoryId: BackOfficeCategoryId;
  categoryName: string;
  name: string;
  headline: string;
  problemSolved: string;
  detailedDescription: string;
  capabilities: string[];
  architectureNote: string;
  seoKeywords: string[];
  slideId: string;
  demoRoute: string;
}

export interface ServiceShowcaseSlide {
  id: string;
  title: string;
  category: string;
  categoryId: BackOfficeCategoryId;
  caption: string;
  image_url: string;
  image_alt: string;
  cta_label: string;
  cta_href: string;
  module_id?: string;
  isCustomUpload?: boolean;
}

export interface ServicesFaqItem {
  question: string;
  answer: string;
}

export const SERVICES_SEO_META = {
  title: 'Enterprise AI Automation, Custom SaaS & Back Office ERP',
  description:
    'Explore GitStack’s 28-module Back Office ERP, turnkey B2B SaaS platforms, and enterprise AI automation—preview workflows live in our interactive demo.',
  keywords: [
    'Enterprise AI Automation',
    'Custom SaaS Development',
    'Back Office ERP Platform',
    'AI Agent Orchestration',
    'Search Console & SEO Automation',
    'B2B SaaS Engineering'
  ]
};

export const DEFAULT_SERVICE_SHOWCASE_SLIDES: ServiceShowcaseSlide[] = [
  {
    id: 'slide-command-agents',
    title: 'Command Center & 8 Autonomous AI Agents',
    category: 'Command & Agents',
    categoryId: 'cat-command',
    caption:
      'Virtual Office HQ coordinating 8 specialized AI agents across SEO, cybersecurity, QA, booking, and executive strategy with SLA workflow boards and real-time alert routing.',
    image_url: '/src/assets/images/bo_command_agents_1795316018621.jpg',
    image_alt:
      'GitStack Back Office ERP Command Dashboard showing 8 autonomous AI agents, priority workflow queue, and real-time system health metrics',
    cta_label: 'Launch Agents in Live Demo',
    cta_href: '/demo?tab=backoffice',
    module_id: 'agents'
  },
  {
    id: 'slide-growth-seo',
    title: 'Search Console, Google Trends & AI Visibility Engine',
    category: 'Growth, SEO & Social',
    categoryId: 'cat-growth',
    caption:
      'Live Google Search Console query diagnostics, AI search citation monitoring, trend velocity discovery, social campaign drafting, and our 100-point AdSense & GEO Publishing Gatekeeper.',
    image_url: '/src/assets/images/bo_growth_seo_1795316018091.jpg',
    image_alt:
      'GitStack Growth and Search Console SEO cockpit displaying CTR curves, keyword impressions table, Google Trends velocity cards, and 100/100 publishing gatekeeper scores',
    cta_label: 'Explore Growth Suite in Demo',
    cta_href: '/demo?tab=backoffice',
    module_id: 'search_console'
  },
  {
    id: 'slide-crm-inbox',
    title: 'Revenue Pipeline, Contact-Gated Live Chat & Auto-Response',
    category: 'Revenue, CRM & Clients',
    categoryId: 'cat-clients',
    caption:
      'Contact-gated website chat requiring verified Full Name, Phone, and Email before persisting leads, paired with instant keyword auto-response templates, Lark Mail sync, and Kanban CRM tracking.',
    image_url: '/src/assets/images/bo_crm_inbox_1795316018170.jpg',
    image_alt:
      'GitStack Revenue CRM and Lead Inbox workspace featuring verified visitor contact cards, live chat transcript, quick auto-response templates, and pipeline conversion stages',
    cta_label: 'Test CRM & Inbox in Live Demo',
    cta_href: '/demo?tab=backoffice',
    module_id: 'inbox'
  },
  {
    id: 'slide-analytics-telemetry',
    title: 'GA4 Conversion Funnels, Tag Manager & Cloudflare Telemetry',
    category: 'Analytics & Telemetry',
    categoryId: 'cat-analytics',
    caption:
      'Unified product telemetry correlating Google Analytics 4 engagement, Google Tag Manager dataLayer triggers, and Cloudflare edge cache hit ratios in a single executive view.',
    image_url: '/src/assets/images/bo_analytics_telemetry_1795316018341.jpg',
    image_alt:
      'GitStack Analytics and Edge Telemetry dashboard combining GA4 conversion funnels, GTM event trigger matrix, and Cloudflare bandwidth and cache latency graphs',
    cta_label: 'Inspect Telemetry in Demo',
    cta_href: '/demo?tab=backoffice',
    module_id: 'analytics'
  },
  {
    id: 'slide-content-brand',
    title: 'CMS Page Editor, Screenshot Slots & Brand Theme Studio',
    category: 'Content & Appearance',
    categoryId: 'cat-content',
    caption:
      'Update hero headlines, upload production Back Office screenshots, synchronize brand contact registries across pages, and customize white-label theme tokens with AdSense Integrity Shield validation.',
    image_url: '/src/assets/images/bo_content_brand_1795316018735.jpg',
    image_alt:
      'GitStack Page Content Editor and Branding Studio interface displaying live section copy controls, image upload dropzones, color theme tokens, and AdSense integrity checks',
    cta_label: 'Preview Content Studio in Demo',
    cta_href: '/demo?tab=backoffice',
    module_id: 'pages'
  },
  {
    id: 'slide-platform-security',
    title: 'Supabase Quota Shield, Demo Guard & Cybersecurity Sentinel',
    category: 'Platform, Security & Admin',
    categoryId: 'cat-system',
    caption:
      'Real-time Vercel and Supabase quota protection with TTL caching and background loop throttles, automated Demo Guard drift isolation emails, QA audit logs, and RBAC governance.',
    image_url: '/src/assets/images/bo_platform_security_1795316017614.jpg',
    image_alt:
      'GitStack Platform Security and Quota Shield console showing Vercel deployment health, Supabase egress and log ingestion gauges, Demo Guard verifier, and RBAC audit logs',
    cta_label: 'Inspect Security Ops in Demo',
    cta_href: '/demo?tab=backoffice',
    module_id: 'resources'
  }
];

export const BACK_OFFICE_CATEGORIES_SHOWCASE: BackOfficeCategoryShowcase[] = [
  {
    id: 'cat-command',
    code: '01',
    name: 'Command & Agents',
    summary:
      'Autonomous virtual office orchestration, cross-team SLA workflows, and real-time operational alert routing.',
    moduleCount: 3,
    slideId: 'slide-command-agents',
    seoFocus: 'Enterprise AI Agent Orchestration & Workflow Automation'
  },
  {
    id: 'cat-growth',
    code: '02',
    name: 'Growth, SEO & Social',
    summary:
      'Full-funnel organic discovery across Google Search Console, AI answer engines, trend velocity, and policy-gated publishing.',
    moduleCount: 5,
    slideId: 'slide-growth-seo',
    seoFocus: 'Technical SEO, Search Console & AI Visibility Automation'
  },
  {
    id: 'cat-clients',
    code: '03',
    name: 'Revenue, CRM & Clients',
    summary:
      'Contact-gated lead capture, instant Q&A auto-response playbooks, unified Lark Mail inbox, and B2B pipeline tracking.',
    moduleCount: 6,
    slideId: 'slide-crm-inbox',
    seoFocus: 'B2B CRM Pipeline, Contact-Gated Live Chat & Lead Inbox'
  },
  {
    id: 'cat-analytics',
    code: '04',
    name: 'Analytics & Telemetry',
    summary:
      'First-party conversion tracking combining GA4, Google Tag Manager dataLayer governance, and Cloudflare edge analytics.',
    moduleCount: 3,
    slideId: 'slide-analytics-telemetry',
    seoFocus: 'GA4 Conversion Telemetry, GTM Governance & Edge Analytics'
  },
  {
    id: 'cat-content',
    code: '05',
    name: 'Content & Appearance',
    summary:
      'CMS page customizer with image upload slots, unified phone/email contact registry, and white-label theme presets.',
    moduleCount: 3,
    slideId: 'slide-content-brand',
    seoFocus: 'Headless CMS Page Editor & White-Label SaaS Branding'
  },
  {
    id: 'cat-system',
    code: '06',
    name: 'Platform, Security & Admin',
    summary:
      'Cloud quota protection, continuous QA probes, cybersecurity scanning, Demo Guard isolation, and RBAC administration.',
    moduleCount: 8,
    slideId: 'slide-platform-security',
    seoFocus: 'Cloud FinOps Quota Shield, Demo Guard & Zero-Trust Admin'
  }
];

export const BACK_OFFICE_MODULES_SHOWCASE: BackOfficeModuleShowcase[] = [
  // Category 1: Command & Agents (3)
  {
    id: 'agents',
    order: '01',
    categoryId: 'cat-command',
    categoryName: 'Command & Agents',
    name: 'Overview & AI Agents HQ',
    headline: 'Virtual Office Command Center Coordinating 8 Autonomous AI Specialists',
    problemSolved:
      'Eliminates fragmented operational dashboards by uniting executive metrics and 8 deterministic AI agents in one real-time headquarters.',
    detailedDescription:
      'Monitors live system health across CEO Strategy, Marketing & Growth, Booking & Lead Triage, Cybersecurity Sentinel, Product QA, AdSense Compliance, Traffic Intelligence, and Demo Guard—surfacing prioritized remediations before issues affect revenue.',
    capabilities: [
      'Real-time health scoring across all 8 autonomous engineering & growth agents',
      'Interactive Virtual Office HQ view with priority escalation drill-downs',
      '1-click execution of deterministic remediation tasks & backlog syncing',
      'Executive summary telemetry for conversion velocity, crawlability, and uptime'
    ],
    architectureNote:
      'Deterministic server-side rule engine paired with Gemini synthesis and cached status snapshots.',
    seoKeywords: ['AI Agent HQ', 'Enterprise AI Automation', 'Virtual Office Operations'],
    slideId: 'slide-command-agents',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'workflows',
    order: '02',
    categoryId: 'cat-command',
    categoryName: 'Command & Agents',
    name: 'Team Workflows & Task Orchestration',
    headline: 'Cross-Functional Engineering & Operations Task Pipeline',
    problemSolved:
      'Stops critical agent findings and client requests from stalling in spreadsheets or disconnected chat threads.',
    detailedDescription:
      'Converts agent recommendations, inbound inquiries, and engineering milestones into structured workflow tasks with priority tiers, owner assignments, SLA countdowns, and audit completion history.',
    capabilities: [
      'Priority-ranked action queues (High / Medium / Low) linked to target modules',
      'Direct jump-to-module action links for immediate issue resolution',
      'Role-scoped task assignment across admin, editor, and ops leads',
      'Persistent status lifecycle from open triage through verified completion'
    ],
    architectureNote:
      'PostgreSQL/Supabase persistent task ledger with server-side validation and RBAC checks.',
    seoKeywords: ['Workflow Automation', 'Operations Task Queue', 'Enterprise SLA Tracking'],
    slideId: 'slide-command-agents',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'notifications',
    order: '03',
    categoryId: 'cat-command',
    categoryName: 'Command & Agents',
    name: 'Notifications & Real-Time Alerts',
    headline: 'Multi-Channel Incident, Lead & Security Dispatch Rules',
    problemSolved:
      'Prevents missed high-value leads, security anomalies, or demo drift events with configurable real-time routing.',
    detailedDescription:
      'Centralizes critical system events and routes instant SMTP / Lark Mail alerts based on severity thresholds—covering unanswered live chat leads, QA failures, cybersecurity probes, and Demo Guard drift alerts.',
    capabilities: [
      'Unified chronological alert inbox with category filtering & acknowledge actions',
      'Instant email trigger rules for critical security and Demo Guard events',
      'Configurable recipient routing for executive, engineering, and sales teams',
      'Deduplicated alert cooldowns preventing inbox fatigue and quota spikes'
    ],
    architectureNote:
      'Event-driven SMTP dispatch pipeline with cooldown rate-limiting and audit trail.',
    seoKeywords: ['Real-Time Alerting', 'SMTP Lead Notifications', 'Incident Routing'],
    slideId: 'slide-command-agents',
    demoRoute: '/demo?tab=backoffice'
  },

  // Category 2: Growth, SEO & Social (5)
  {
    id: 'search_console',
    order: '04',
    categoryId: 'cat-growth',
    categoryName: 'Growth, SEO & Social',
    name: 'Search Console & Technical SEO',
    headline: 'Google Search Console Indexing, Sitemap & Keyword Performance Cockpit',
    problemSolved:
      'Removes guesswork from organic search rankings by tracking impressions, CTR, canonical health, and URL indexing directly inside the ERP.',
    detailedDescription:
      'Integrates search impression analytics, SSR page indexability checks, dynamic XML sitemap verification, and keyword position diagnostics so engineering and marketing teams act on live Search Console signals immediately.',
    capabilities: [
      'Live URL inspection & SSR canonical/robots verification across all public routes',
      'Query-level impressions, clicks, CTR, and average ranking position breakdowns',
      'Dynamic sitemap.xml & robots.txt compliance validation',
      '1-click metadata optimization recommendations for high-intent B2B keywords'
    ],
    architectureNote:
      'SSR HTML verification paired with Google Search Console OAuth/API telemetry caching.',
    seoKeywords: ['Google Search Console ERP', 'Technical SEO Cockpit', 'SSR Schema Optimization'],
    slideId: 'slide-growth-seo',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'marketing',
    order: '05',
    categoryId: 'cat-growth',
    categoryName: 'Growth, SEO & Social',
    name: 'Marketing & Social Distribution',
    headline: 'Multi-Channel Campaign Composer & Brand Asset Publisher',
    problemSolved:
      'Eliminates manual copy-pasting when announcing new engineering releases, insights, or SaaS case studies.',
    detailedDescription:
      'Transforms published insights and service launches into platform-tailored LinkedIn, X, and Facebook campaign posts with UTM link attribution and studio-approved visual pairing.',
    capabilities: [
      'Channel-specific copy adaptation for LinkedIn, X, and developer communities',
      'Automated UTM tagging aligned with GA4 acquisition tracking',
      'Studio cover asset selection & unique visual assignment per campaign',
      'Scheduled distribution history and campaign engagement tracking'
    ],
    architectureNote:
      'AI-assisted editorial synthesis grounded strictly in verified page and article metadata.',
    seoKeywords: ['B2B SaaS Marketing Automation', 'UTM Campaign Builder', 'Social Distribution'],
    slideId: 'slide-growth-seo',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'google_trends',
    order: '06',
    categoryId: 'cat-growth',
    categoryName: 'Growth, SEO & Social',
    name: 'Google Trends Topic Agent',
    headline: 'Rising Enterprise Search Demand Discovery & Content Ideation',
    problemSolved:
      'Identifies surging enterprise AI and SaaS search queries weeks before competitors publish around them.',
    detailedDescription:
      'Monitors rising regional and global technology search velocity, scores commercial alignment with GitStack engineering services, and feeds validated topic briefs directly into the editorial pipeline.',
    capabilities: [
      'Real-time trend velocity tracking across AI, MLOps, Cloud, and B2B SaaS queries',
      'Commercial-intent relevance scoring mapped to service lines',
      '1-click promotion of breakout keywords into structured article drafts',
      'Historical trend snapshot archiving for quarterly content roadmaps'
    ],
    architectureNote:
      'Automated trend ingestion with server-side keyword clustering and TTL caching.',
    seoKeywords: ['Google Trends Automation', 'Keyword Demand Intelligence', 'SEO Topic Discovery'],
    slideId: 'slide-growth-seo',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'ai_visibility',
    order: '07',
    categoryId: 'cat-growth',
    categoryName: 'Growth, SEO & Social',
    name: 'AI & Search Visibility (GEO)',
    headline: 'Generative Engine Optimization for ChatGPT, Perplexity & Google AI Overviews',
    problemSolved:
      'Protects brand discovery as buyers shift from classic ten-blue-link search to AI answer engines.',
    detailedDescription:
      'Audits llms.txt discoverability, Schema.org JSON-LD entity density, citation formatting, and factual answer clarity across all pages to maximize brand inclusion in AI-synthesized search responses.',
    capabilities: [
      'Automated Generative Engine Optimization (GEO) & citation readiness scoring',
      'llms.txt and structured FAQPage / SoftwareApplication schema verification',
      'Periodic AI crawler accessibility & semantic density audits',
      'Actionable snippet & entity-graph remediation checklists'
    ],
    architectureNote:
      'Dedicated GEO scoring engine evaluating SSR markup and structured JSON-LD.',
    seoKeywords: ['Generative Engine Optimization', 'AI Search Visibility', 'Schema.org JSON-LD'],
    slideId: 'slide-growth-seo',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'articles',
    order: '08',
    categoryId: 'cat-growth',
    categoryName: 'Growth, SEO & Social',
    name: 'Articles & Publishing Gatekeeper',
    headline: '100-Point Editorial Quality, E-E-A-T & Unique AI Cover Studio',
    problemSolved:
      'Blocks thin, repetitive, or non-compliant drafts from ever reaching production and damaging domain authority.',
    detailedDescription:
      'Full markdown editorial workbench enforcing strict word-count depth, H2 structural hierarchy, primary source references, FAQ generation, and unique topic-specific AI cover imagery before publication is unlocked.',
    capabilities: [
      'Hardened 4-pillar Quality Gate (AdSense Policy, E-E-A-T Trust, GEO, On-Page SEO)',
      'Unique AI-generated cover artwork per article topic with curated fallbacks',
      'Live word count, keyword density, and read-time telemetry as you write',
      'Automated FAQ & primary reference extraction with JSON-LD Article schema output'
    ],
    architectureNote:
      'Dual client/server publication gatekeeper paired with Imagen cover generation.',
    seoKeywords: ['Technical Editorial CMS', 'E-E-A-T Quality Gate', 'AdSense Compliance Studio'],
    slideId: 'slide-growth-seo',
    demoRoute: '/demo?tab=backoffice'
  },

  // Category 3: Revenue, CRM & Clients (6)
  {
    id: 'crm',
    order: '09',
    categoryId: 'cat-clients',
    categoryName: 'Revenue, CRM & Clients',
    name: 'CRM & Enterprise Prospecting',
    headline: 'B2B Consultation Pipeline, Deal Scoring & Account Conversion Hub',
    problemSolved:
      'Stops qualified enterprise inquiries from slipping through disconnected inboxes without owner follow-up.',
    detailedDescription:
      'Tracks every project brief and qualified chat conversation from initial discovery through technical scoping and scheduled architecture calls, complete with reference codes, budget bands, and team assignments.',
    capabilities: [
      'Structured lead intake ledger with unique reference codes (GS-XXXX)',
      'Status progression tracking (New → Reviewed → Scheduled) with assignee logs',
      'Direct promotion of verified live chat transcripts into formal CRM opportunities',
      'Service-line and budget tier segmentation for executive forecasting'
    ],
    architectureNote:
      'Transactional CRM table backed by Supabase with strict server-side sanitization.',
    seoKeywords: ['Enterprise B2B CRM', 'Lead Pipeline Management', 'SaaS Prospecting'],
    slideId: 'slide-crm-inbox',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'inbox',
    order: '10',
    categoryId: 'cat-clients',
    categoryName: 'Revenue, CRM & Clients',
    name: 'Lark Mail & Unified Lead Inbox',
    headline: 'Real-Time Visitor Chat Console, Inquiry Triage & Offline SMTP Escalation',
    problemSolved:
      'Guarantees zero missed sales conversations whether engineering leads are online in the Back Office or offline.',
    detailedDescription:
      'Unifies website live chat threads, project consultation briefs, Lark Mail SMTP dispatches, and article comment/newsletter feeds in one triaged command inbox with automatic 2-minute offline email escalation.',
    capabilities: [
      'Live bi-directional reply stream for active verified website visitors',
      'Automated 2-minute offline watcher dispatching full chat transcripts to Lark Mail',
      'Zero-bloat session purge keeping anonymous unverified visitors out of the database',
      '1-click CRM lead conversion and Lark Mail outbound dispatch logs'
    ],
    architectureNote:
      'WebSocket-ready polling inbox with background inquiry watcher and SMTP fallback.',
    seoKeywords: ['Unified Lead Inbox', 'Lark Mail Integration', 'Live Visitor Support Desk'],
    slideId: 'slide-crm-inbox',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'chat_auto_response',
    order: '11',
    categoryId: 'cat-clients',
    categoryName: 'Revenue, CRM & Clients',
    name: 'Chat Auto-Response & Prompt Studio',
    headline: 'Instant Pre-Approved Q&A Chips & Keyword Auto-Replies Zeroing API Waste',
    problemSolved:
      'Delivers sub-50ms accurate answers to common pricing, SLA, and service questions without burning LLM tokens or database quotas.',
    detailedDescription:
      'Empowers administrators to author clickable quick-question templates and keyword-matched instant answers displayed inside the public chat widget—only routing complex custom questions to live staff.',
    capabilities: [
      'Clickable pre-populated FAQ question chips for effortless visitor self-service',
      'Priority-ordered keyword trigger engine returning verified answers instantaneously',
      'Dynamic live previews and enable/disable toggles per response template',
      'Zero external AI cost for deterministic FAQ and pricing inquiries'
    ],
    architectureNote:
      'Cached server-side template matching paired with lightweight client quick-reply UI.',
    seoKeywords: ['Chat Auto-Response Engine', 'FAQ Chatbot Templates', 'Zero-Latency Support'],
    slideId: 'slide-crm-inbox',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'chat',
    order: '12',
    categoryId: 'cat-clients',
    categoryName: 'Revenue, CRM & Clients',
    name: 'Internal Team Q&A Chat Box',
    headline: 'Private Engineering & Operations Collaboration Thread',
    problemSolved:
      'Keeps internal scoping notes, deployment sign-offs, and client handoff context tied directly to the Back Office workspace.',
    detailedDescription:
      'Encrypted internal staff messaging channel inside the authenticated Back Office where architects and operations managers coordinate responses on active deals and incidents.',
    capabilities: [
      'Role-authenticated internal team messaging separated from public visitor chat',
      'Persistent chronological archive for compliance and shift handovers',
      'Fast contextual coordination during live visitor escalations',
      'Zero third-party workspace dependency or external chat seat licensing'
    ],
    architectureNote:
      'Authenticated REST/WebSocket team channel scoped strictly to verified editor sessions.',
    seoKeywords: ['Internal Team Chat', 'Operations Collaboration Hub', 'Authenticated Messaging'],
    slideId: 'slide-crm-inbox',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'demo_users',
    order: '13',
    categoryId: 'cat-clients',
    categoryName: 'Revenue, CRM & Clients',
    name: 'Demo Users & Evaluation Pass Leads',
    headline: '24-Hour Interactive Sandbox Provisioning & Buyer Intent Tracking',
    problemSolved:
      'Captures verified business evaluators testing your SaaS demos while tracking which product modules generated highest engagement.',
    detailedDescription:
      'Manages time-boxed 24-hour evaluation credentials issued on the Live Demo portal—recording company name, work email, contact phone, active window, and sandbox expiration automatically.',
    capabilities: [
      'Automated 24-hour tokenized evaluation pass issuance and expiry control',
      'Lead qualification table showing company, verified email, and phone details',
      'Telemetry linking prospect sessions to tested SaaS products & Back Office tabs',
      'Instant pass revocation or extension controls for enterprise sales demos'
    ],
    architectureNote:
      'JWT/HMAC time-boxed demo session middleware strictly isolated from production tables.',
    seoKeywords: ['Interactive SaaS Demo Lead Capture', 'Evaluation Pass Provisioning', 'Product-Led Sales'],
    slideId: 'slide-crm-inbox',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'buymeacoffee',
    order: '14',
    categoryId: 'cat-clients',
    categoryName: 'Revenue, CRM & Clients',
    name: 'Buy Me a Coffee & Micro-Support Hub',
    headline: 'Configurable Reader Support Placements & Conversion Click Telemetry',
    problemSolved:
      'Monetizes open-source engineering blueprints and technical guides without intrusive popups or broken layout shifts.',
    detailedDescription:
      'Configures brand-aligned Buy Me a Coffee button copy, typography, color styling, and placement across header, footer, and floating widgets while tracking placement-by-placement conversion clicks.',
    capabilities: [
      'Independent toggles for Header, Footer, and Floating support button placements',
      'Custom button label, hex color, font pairing, and screen corner positioning',
      'Real-time attribution counter splitting header, footer, and floating click volume',
      'Instant preview sync across all public SSR and client-rendered routes'
    ],
    architectureNote:
      'Lightweight event telemetry stored via cached settings and batch-safe click endpoints.',
    seoKeywords: ['Developer Monetization Hub', 'Creator Support Attribution', 'SaaS Settings'],
    slideId: 'slide-crm-inbox',
    demoRoute: '/demo?tab=backoffice'
  },

  // Category 4: Analytics & Telemetry (3)
  {
    id: 'analytics',
    order: '15',
    categoryId: 'cat-analytics',
    categoryName: 'Analytics & Telemetry',
    name: 'Google Analytics (GA4) Integration',
    headline: 'First-Party Funnel Tracking, Event Instrumentation & Conversion Metrics',
    problemSolved:
      'Prevents blind spots across public landing pages, insights reading depth, demo launches, and consultation form conversions.',
    detailedDescription:
      'Deploys Google Analytics 4 dynamically via verified Measurement IDs (`G-XXXXXXXXXX`), firing semantic custom events across service clicks, live demo launches, and inquiry submissions.',
    capabilities: [
      'Zero-code GA4 Measurement ID injection with admin traffic exclusion safeguards',
      'Structured conversion event tracking for consultation briefs and demo activations',
      'Cross-route SPA + SSR virtual pageview synchronization',
      'Consent-respecting telemetry hooks ready for GDPR/CCPA banners'
    ],
    architectureNote:
      'Dynamic script loader governed by Back Office settings and strict route exclusion.',
    seoKeywords: ['GA4 Enterprise Analytics', 'SaaS Conversion Tracking', 'SPA Pageview Telemetry'],
    slideId: 'slide-analytics-telemetry',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'tag_manager',
    order: '16',
    categoryId: 'cat-analytics',
    categoryName: 'Analytics & Telemetry',
    name: 'Google Tag Manager (GTM) & dataLayer',
    headline: 'Governed Marketing Container, Conversion Events & Admin Exclusion',
    problemSolved:
      'Eliminates fragile manual script edits in source code when marketing teams deploy attribution pixels or A/B tags.',
    detailedDescription:
      'Validates and injects GTM containers (`GTM-XXXXXXX`) safely across public routes while automatically suppressing execution on authenticated Back Office paths (`/obama`) to protect admin telemetry hygiene.',
    capabilities: [
      'Strict container format validation and dual head/body noscript snippet injection',
      'Typed `window.dataLayer` push governance for form submits, demo starts, and CTAs',
      'Automatic exclusion toggle keeping Back Office admin sessions unpolluted',
      'Consent-mode compatible event dispatching'
    ],
    architectureNote:
      'Safe SSR/client container bootstrapper with admin-route firewall.',
    seoKeywords: ['Google Tag Manager Governance', 'dataLayer Architecture', 'Attribution Telemetry'],
    slideId: 'slide-analytics-telemetry',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'cloudflare',
    order: '17',
    categoryId: 'cat-analytics',
    categoryName: 'Analytics & Telemetry',
    name: 'Cloudflare Edge & Traffic Analytics',
    headline: 'Global Edge Bandwidth, Cache Hit Ratio & Bot Mitigation Snapshots',
    problemSolved:
      'Surfaces edge caching efficiency, origin offload savings, and anomalous bot traffic spikes before origin servers feel load.',
    detailedDescription:
      'Captures automated Cloudflare edge telemetry snapshots tracking total requests, cached vs. uncached bandwidth ratios, regional threat blocks, and time-series traffic health inside the ERP.',
    capabilities: [
      'Live Cache Hit Ratio tracking measuring CDN bandwidth savings in real time',
      'Periodic edge telemetry snapshot scheduler with historical trend comparison',
      'Threat and automated crawler mitigation counters per region',
      'Edge performance diagnostics supporting Core Web Vitals optimization'
    ],
    architectureNote:
      'Scheduled Cloudflare GraphQL Analytics sync with Supabase snapshot archiving.',
    seoKeywords: ['Cloudflare Edge Analytics', 'CDN Cache Ratio Monitoring', 'WAF Telemetry'],
    slideId: 'slide-analytics-telemetry',
    demoRoute: '/demo?tab=backoffice'
  },

  // Category 5: Content & Appearance (3)
  {
    id: 'pages',
    order: '18',
    categoryId: 'cat-content',
    categoryName: 'Content & Appearance',
    name: 'Page Content Editor & Screenshot Slots',
    headline: 'AdSense-Protected Public Copy, Custom Sections & Services Slider Uploader',
    problemSolved:
      'Empowers non-engineers to update headlines, upload real product screenshots, and publish sections without risking layout regressions.',
    detailedDescription:
      'Controls core copy, primary hero visuals, custom content blocks, and Services Back Office screenshot slider slots across Home, Services, About, and Contact—protected by automated thin-content and alt-text validation.',
    capabilities: [
      'Structured visual & copy editing for Home, Services, About, and Contact routes',
      'Dedicated Back Office screenshot uploader for the Services Showcase Photo Slider',
      'AdSense & SEO Integrity Shield blocking thin copy or missing alt attributes',
      '1-click default restoration and instant public SSR cache invalidation'
    ],
    architectureNote:
      'JSONB-backed page config merged with type-safe defaults and instant cache busting.',
    seoKeywords: ['AdSense-Safe CMS', 'Screenshot Showcase Uploader', 'Enterprise Page Editor'],
    slideId: 'slide-content-brand',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'contact_registry',
    order: '19',
    categoryId: 'cat-content',
    categoryName: 'Content & Appearance',
    name: 'Emails, Phones & Names Registry',
    headline: 'Single-Source Directory Synchronizing Legal, Footer & Contact Channels',
    problemSolved:
      'Stops stale phone numbers, mismatched support emails, or wrong legal entity names from lingering across footer and policy pages.',
    detailedDescription:
      'Maintains authoritative organization names, phone lines, sales emails, editorial contacts, and privacy officer addresses—scanning public pages for drift and propagating updates globally in one save.',
    capabilities: [
      'Centralized directory covering sales, editorial, privacy, and direct phone lines',
      'Automated cross-page consistency audit flagging out-of-sync footer or legal copy',
      'Batch synchronization propagating updated contact details across SSR & SPA routes',
      'Instant clickable `tel:` and `mailto:` link validation'
    ],
    architectureNote:
      'Server-side registry validator scanning persisted page configs and legal templates.',
    seoKeywords: ['Contact Directory Governance', 'Brand Trust Consistency', 'SSR Footer Sync'],
    slideId: 'slide-content-brand',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'branding',
    order: '20',
    categoryId: 'cat-content',
    categoryName: 'Content & Appearance',
    name: 'White-Label Branding & Theme Studio',
    headline: 'Dynamic Brand Name, Logo, Favicon, Color Tokens & Header CTA Customizer',
    problemSolved:
      'Makes the entire Back Office ERP and public portal rebrandable for client deployments without CSS rewrites.',
    detailedDescription:
      'Applies live CSS custom properties (`--gs-primary`, surface modes), custom SVG/PNG brand logos, browser favicons, and header CTA targets dynamically across every public page and SSR shell.',
    capabilities: [
      '6 curated enterprise color presets plus custom hex primary token picker',
      'Custom logo, alt-text, and dynamic browser favicon synchronization',
      'Configurable navigation bar surface style and primary conversion CTA button',
      'Zero-flicker CSS variable injection across both client SPA and SSR responses'
    ],
    architectureNote:
      'CSS variable runtime token injector mirrored directly inside SSR HTML head tags.',
    seoKeywords: ['White-Label SaaS Platform', 'Dynamic Brand Theme Engine', 'CSS Token Studio'],
    slideId: 'slide-content-brand',
    demoRoute: '/demo?tab=backoffice'
  },

  // Category 6: Platform, Security & Admin (8)
  {
    id: 'resources',
    order: '21',
    categoryId: 'cat-system',
    categoryName: 'Platform, Security & Admin',
    name: 'Vercel & Supabase Quota Shield',
    headline: 'Database Egress Caching, Log Ingestion Throttles & Infra FinOps Monitor',
    problemSolved:
      'Prevents unexpected database quota overages, runaway egress bills, and noisy polling loops in production.',
    detailedDescription:
      'Monitors Vercel deployments and Supabase database health while providing Quota Shield controls: in-memory TTL response caching, CDN cache-control headers, background loop interval throttling, and legacy session purges.',
    capabilities: [
      'Live Quota Shield switches adjusting server cache TTLs and agent loop intervals',
      '1-click stale visitor chat & operational log purge to reclaim database storage',
      'Slim column projections and uncached-to-cached CDN egress optimization',
      'Vercel build/deployment telemetry alongside Supabase row and storage gauges'
    ],
    architectureNote:
      'In-memory LRU/TTL cache middleware paired with configurable loop cadence governors.',
    seoKeywords: ['Supabase Quota Shield', 'Cloud FinOps Monitor', 'Database Egress Optimization'],
    slideId: 'slide-platform-security',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'qa',
    order: '22',
    categoryId: 'cat-system',
    categoryName: 'Platform, Security & Admin',
    name: 'Product QA & Functional Health Probes',
    headline: 'Automated Endpoint, Route, Navigation & Form Integrity Verifier',
    problemSolved:
      'Catches broken API endpoints, regressing routes, or form validation errors in production before customers encounter them.',
    detailedDescription:
      'Executes synthetic production probes verifying public routes, SSR rendering, API JSON contracts, inquiry form validation, and live chat endpoints—recording latency and pass/fail audit history.',
    capabilities: [
      'End-to-end verification of SSR pages, API routes, and form submission handlers',
      'Scheduled background health probes with millisecond response latency logging',
      'Actionable failure diagnostics mapped directly to the affected subsystem',
      'Historical QA run timeline demonstrating continuous 99.9% platform stability'
    ],
    architectureNote:
      'Server-side synthetic self-probe runner with throttled background loop execution.',
    seoKeywords: ['Automated Product QA', 'Synthetic API Monitoring', 'Production Health Checks'],
    slideId: 'slide-platform-security',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'cybersecurity',
    order: '23',
    categoryId: 'cat-system',
    categoryName: 'Platform, Security & Admin',
    name: 'Cybersecurity & AI Threat Sentinel',
    headline: 'HTTP Header Hardening, Auth Guard Audits & OWASP Surface Scanner',
    problemSolved:
      'Detects missing security headers, exposed routes, or auth drift across deployments automatically.',
    detailedDescription:
      'Continuously inspects HTTP response security posture (CSP, HSTS, X-Frame-Options, Referrer-Policy), admin route authorization enforcement, secret hygiene, and suspicious payload patterns.',
    capabilities: [
      'Automated OWASP and HTTP security header posture grading',
      'Admin JWT & bearer-token boundary verification across every write endpoint',
      'Real-time security event feed with AI-assisted remediation explanations',
      'Zero-trust validation ensuring public demos cannot escalate privileges'
    ],
    architectureNote:
      'Continuous header & endpoint posture auditor backed by immutable security event logs.',
    seoKeywords: ['Cybersecurity Sentinel', 'SaaS Security Posture', 'Zero-Trust Admin Protection'],
    slideId: 'slide-platform-security',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'demo_guard',
    order: '24',
    categoryId: 'cat-system',
    categoryName: 'Platform, Security & Admin',
    name: 'Demo Guard & Isolation Sentinel',
    headline: 'Code-Level Sandbox Isolation & Real-Time Admin Drift Email Alerts',
    problemSolved:
      'Guarantees public interactive demos stay 100% read-only and never mutate production data or break real admin modules.',
    detailedDescription:
      'Dedicated verification agent inspecting showcase source code and runtime endpoints to prove zero production mutation leaks from `/demo`, paired with health checks verifying all real authenticated Back Office modules stay operational—sending instant email alerts on any drift.',
    capabilities: [
      'Static & runtime isolation audit confirming `/demo` triggers zero production writes',
      'Live verification of all authenticated production Back Office modules and endpoints',
      'Instant real-time SMTP email alerts upon detecting any code drift or mutation leak',
      'Timestamped verification ledger inspectable immediately inside the Back Office'
    ],
    architectureNote:
      'AST/source-pattern sentinel + live admin endpoint probe with instant email dispatch.',
    seoKeywords: ['Demo Sandbox Isolation', 'Production Drift Detection', 'Demo Guard Sentinel'],
    slideId: 'slide-platform-security',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'data_explorer',
    order: '25',
    categoryId: 'cat-system',
    categoryName: 'Platform, Security & Admin',
    name: 'Data Explorer & Schema Inspector',
    headline: 'Read-Safe Database Table Browser, Row Counts & Export Diagnostics',
    problemSolved:
      'Gives engineering leads immediate visibility into live database tables without opening external SQL consoles.',
    detailedDescription:
      'Inspects persisted records across articles, inquiries, live chats, demo passes, settings, and telemetry tables with pagination, search filtering, and row-count diagnostics.',
    capabilities: [
      'Table-by-table inspection across all core SaaS and ERP persistence collections',
      'Paginated row previews avoiding full-table egress spikes',
      'Unified visibility across both Supabase PostgreSQL and local fallback stores',
      'Quick diagnostics for verifying webhook deliveries and record timestamps'
    ],
    architectureNote:
      'Paginated admin-only read proxy respecting strict row limits and column projections.',
    seoKeywords: ['Database Table Explorer', 'SaaS Admin Data Inspector', 'PostgreSQL Diagnostics'],
    slideId: 'slide-platform-security',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'users',
    order: '26',
    categoryId: 'cat-system',
    categoryName: 'Platform, Security & Admin',
    name: 'User Access & Role Governance (RBAC)',
    headline: 'Multi-Role Team Provisioning Across Super Admin, Editor & Viewer Scopes',
    problemSolved:
      'Prevents over-privileged team accounts by enforcing least-privilege roles across editorial, ops, and infrastructure panels.',
    detailedDescription:
      'Creates, updates, suspends, and audits internal staff accounts with granular role boundaries (`super_admin`, `editor`, `analyst`) enforced on every server API route.',
    capabilities: [
      'Server-enforced RBAC separating Super Admin, Editor, and Analyst capabilities',
      'Instant account provisioning, role promotion, and session revocation',
      'Last-login activity tracking and password policy enforcement',
      'Protected founder lockout safeguards preventing accidental self-demotion'
    ],
    architectureNote:
      'JWT + Supabase Auth role middleware validated on every `/api/admin/*` and write endpoint.',
    seoKeywords: ['Enterprise RBAC Governance', 'Multi-Tenant Access Control', 'Admin User Management'],
    slideId: 'slide-platform-security',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'adsense',
    order: '27',
    categoryId: 'cat-system',
    categoryName: 'Platform, Security & Admin',
    name: 'Settings, AdSense & Platform Integrations',
    headline: 'Publisher ID, ads.txt Management & Global System Configuration',
    problemSolved:
      'Centralizes AdSense publisher compliance, automated ads.txt serving, and editorial policy flags without code redeploys.',
    detailedDescription:
      'Governs AdSense publisher verification (`ca-pub-...`), dynamic `/ads.txt` endpoint rendering, editorial review notes, and global platform feature toggles from one audited panel.',
    capabilities: [
      'Live `/ads.txt` file generation and verification with zero deploy lag',
      'AdSense auto-ads and slot toggles strictly guarded against thin/admin routes',
      'Global integration health status across SMTP, Gemini AI, and cloud storage',
      'Instant settings cache invalidation updating SSR headers across all routes'
    ],
    architectureNote:
      'Cached site settings table driving both Express `/ads.txt` responses and HTML head injection.',
    seoKeywords: ['AdSense Publisher Compliance', 'ads.txt Automation', 'SaaS Settings Hub'],
    slideId: 'slide-platform-security',
    demoRoute: '/demo?tab=backoffice'
  },
  {
    id: 'profile',
    order: '28',
    categoryId: 'cat-system',
    categoryName: 'Platform, Security & Admin',
    name: 'Operator Profile & Security Preferences',
    headline: 'Personalized Admin Identity, Author Attribution & Password Controls',
    problemSolved:
      'Keeps operator display credentials, author bios, and authentication hygiene self-service and consistent.',
    detailedDescription:
      'Manages individual administrator profile details, E-E-A-T engineering author attribution metadata, session verification state, and secure credential updates.',
    capabilities: [
      'Self-service operator display name, engineering role title, and bio updates',
      'Synchronized E-E-A-T author card attribution across technical articles',
      'Secure password rotation and active session verification status',
      'Direct sign-out and token cleanup across client & server sessions'
    ],
    architectureNote:
      'Scoped authenticated user endpoint isolating personal profile mutations to the caller.',
    seoKeywords: ['Operator Profile Hub', 'E-E-A-T Author Identity', 'Admin Credential Security'],
    slideId: 'slide-platform-security',
    demoRoute: '/demo?tab=backoffice'
  }
];

export const SERVICES_ENTERPRISE_FAQS: ServicesFaqItem[] = [
  {
    question: 'What is included in GitStack’s 28-module Back Office ERP & Custom SaaS architecture?',
    answer:
      'Our Back Office ERP unifies 28 production modules across 6 operational categories: Command & 8 AI Agents, Growth/SEO/Search Console, Revenue/CRM/Contact-Gated Live Chat, GA4/GTM/Cloudflare Telemetry, CMS Page & Brand Customization, and Cloud Quota Shield, QA & Cybersecurity Governance. Every system can be deployed standalone or customized to your enterprise workflow.'
  },
  {
    question: 'Can we test the Back Office ERP and turnkey B2B SaaS products before signing a contract?',
    answer:
      'Yes. Visit our Live Interactive Demo (/demo) to request an instant 24-hour business evaluation pass and test Omnichannel Inventory Sync, BIR EIS E-Invoicing, AI Concierge, FlowCRM & Invoice Chaser, and our read-only 28-module Back Office OS mirror directly in your browser.'
  },
  {
    question: 'How does GitStack prevent public demos from touching production databases or exceeding cloud quotas?',
    answer:
      'Our Demo Guard isolation agent continuously verifies that all public demo interactions stay 100% read-only in browser memory without mutating production tables. Simultaneously, our Quota Shield enforces TTL in-memory caching, CDN headers, contact-gated live chat capture, and background loop throttling to keep cloud egress and database usage minimal.'
  },
  {
    question: 'Can we upload our own real Back Office screenshots into the Services page showcase slider?',
    answer:
      'Yes. Inside the Back Office Page Content Editor for /services, dedicated screenshot slider slots let administrators upload custom PNG/JPG/WebP captures from production, adjust captions and alt text for Search Console SEO, reorder slides, and publish updates immediately without developer intervention.'
  },
  {
    question: 'Do we receive full intellectual property ownership and source code for custom SaaS deployments?',
    answer:
      'Yes. All turnkey B2B SaaS installations and custom Enterprise AI Automation builds deploy directly onto your dedicated cloud infrastructure with 100% intellectual property ownership, documented Terraform/CI pipelines, and optional ongoing DevOps SLA support.'
  }
];

export function resolveServiceShowcaseSlides(
  customBlocks?: CustomContentBlock[]
): ServiceShowcaseSlide[] {
  const slideBlocks = (customBlocks || []).filter(
    (b) => b.kind === 'showcase_slide' || (typeof b.id === 'string' && b.id.startsWith('slide-'))
  );

  if (slideBlocks.length === 0) {
    return DEFAULT_SERVICE_SHOWCASE_SLIDES;
  }

  const visibleCustomSlides = slideBlocks
    .filter((b) => b.visible)
    .map((b, idx): ServiceShowcaseSlide => {
      const matchingDefault = DEFAULT_SERVICE_SHOWCASE_SLIDES.find((d) => d.id === b.id);
      const categoryName = b.category_label?.trim() || matchingDefault?.category || 'Back Office ERP';
      const categoryMatch = BACK_OFFICE_CATEGORIES_SHOWCASE.find(
        (c) => c.name.toLowerCase() === categoryName.toLowerCase()
      );
      return {
        id: b.id || `slide-custom-${idx + 1}`,
        title: b.heading.trim() || matchingDefault?.title || `Back Office Module Showcase #${idx + 1}`,
        category: categoryName,
        categoryId: categoryMatch?.id || matchingDefault?.categoryId || 'cat-command',
        caption: b.body.trim() || matchingDefault?.caption || '',
        image_url: b.image_url.trim() || matchingDefault?.image_url || DEFAULT_SERVICE_SHOWCASE_SLIDES[0].image_url,
        image_alt:
          b.image_alt.trim() ||
          matchingDefault?.image_alt ||
          `${b.heading.trim() || 'GitStack Back Office ERP'} interface screenshot`,
        cta_label: b.cta_label.trim() || matchingDefault?.cta_label || 'Open in Live Demo',
        cta_href: b.cta_href.trim() || matchingDefault?.cta_href || '/demo?tab=backoffice',
        module_id: b.module_id || matchingDefault?.module_id,
        isCustomUpload: Boolean(
          b.image_url.trim() && b.image_url.trim() !== matchingDefault?.image_url
        )
      };
    });

  return visibleCustomSlides.length > 0 ? visibleCustomSlides : DEFAULT_SERVICE_SHOWCASE_SLIDES;
}
