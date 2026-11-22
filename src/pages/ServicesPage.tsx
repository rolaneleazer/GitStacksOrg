import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Cpu,
  ExternalLink,
  Layers,
  Maximize2,
  Package,
  Pause,
  Play,
  Receipt,
  Search,
  Sparkles,
  TrendingUp,
  X
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { CustomBlocksSection } from '../components/CustomBlocksSection.tsx';
import { InquiryForm } from '../components/InquiryForm.tsx';
import { ResilientImage } from '../components/ResilientImage.tsx';
import { applySeoMetadata } from '../lib/seo.ts';
import { DEFAULT_PAGE_CONTENTS } from '../shared/pageDefaults.ts';
import {
  BACK_OFFICE_CATEGORIES_SHOWCASE,
  BACK_OFFICE_MODULES_SHOWCASE,
  resolveServiceShowcaseSlides,
  SERVICES_ENTERPRISE_FAQS,
  SERVICES_SEO_META,
  type BackOfficeCategoryId,
  type BackOfficeModuleShowcase
} from '../shared/servicesShowcase.ts';
import type { PageContentConfig } from '../shared/types.ts';

// 1. THE 4 TURNKEY B2B SAAS PRODUCT ARCHITECTURES (OFFERED AS MANAGED SYSTEMS)
const SAAS_PRODUCT_SYSTEMS = [
  {
    id: 'inventory_sync',
    demoHash: 'inventory_sync',
    name: 'Gitstack Inventory Sync',
    tagline: 'Omnichannel Stock Allocation & Order Reconciliation Engine',
    category: 'Retail & E-Commerce Infrastructure',
    icon: Package,
    summary:
      'Engineered for multi-store retailers and e-commerce brands selling across Shopee, Lazada, TikTok Shop, and physical brick-and-mortar POS counters. Eliminates stockouts and double-selling with sub-150ms distributed webhook dispatch.',
    technicalSpecs: [
      { label: 'Event Ingestion', value: 'Asynchronous webhook listeners with idempotency keys & retry backoff' },
      { label: 'Concurrency Control', value: 'Redis-backed distributed mutex locks avoiding race conditions' },
      { label: 'Marketplace Sync', value: 'Bidirectional Shopee Open Platform, Lazada Open API & TikTok Shop APIs' },
      { label: 'Latency SLA', value: '<150ms stock sync across all connected sales channels' },
      { label: 'Database Storage', value: 'PostgreSQL ACID-compliant multi-tenant catalog & audit logs' }
    ],
    pricing: {
      setupPhp: '₱55,000',
      monthlyPhp: '₱14,500/mo',
      sla: '99.9% Uptime SLA · 24/7 Priority DevOps Monitoring'
    },
    sampleScenarios: [
      'Simultaneous 11.11 / Payday flash sale surges across Shopee and TikTok Live',
      'Automated warehouse replenishment alerts when items drop below safety buffer',
      'Unified SKU barcode mapping across multiple online merchant IDs'
    ]
  },
  {
    id: 'einvoice',
    demoHash: 'einvoice',
    name: 'Gitstack E-Invoice Portal',
    tagline: 'BIR EIS-Ready Electronic Invoicing & Digital Signing Gateway',
    category: 'Fintech & Fiscal Compliance',
    icon: Receipt,
    summary:
      'Purpose-built for Philippine corporations and SMEs complying with BIR Revenue Regulations No. 8-2022 and 9-2021. Generates cryptographic JWS signatures, validates JSON payloads, and prints compliant customer tax invoices.',
    technicalSpecs: [
      { label: 'Compliance Standard', value: 'Bureau of Internal Revenue EIS RR 8-2022 & RR 9-2021 CAS' },
      { label: 'Digital Signing', value: 'Hardware Security Module (HSM) RSASSA-PKCS1-v1_5 SHA-256 JWS tokens' },
      { label: 'Tax Calculations', value: 'Automated 12% VAT separation, zero-rated & exempt transaction ledger' },
      { label: 'Customer Receipts', value: 'Printable vector PDF invoice layout with dynamic BIR verification QR' },
      { label: 'Audit Trail', value: 'Immutable 10-year encrypted archive with transmission UUID timestamps' }
    ],
    pricing: {
      setupPhp: '₱65,000',
      monthlyPhp: '₱18,000/mo',
      sla: 'Continuous BIR Schema Updates · Certified Digital Token Backup'
    },
    sampleScenarios: [
      'Retail POS counters transmitting high-volume electronic invoices directly to BIR EIS',
      'B2B consulting & service retainers issuing compliant digital billing statements',
      'E-commerce order fulfillment requiring automated VAT tax invoices'
    ]
  },
  {
    id: 'ai_concierge',
    demoHash: 'ai_concierge',
    name: 'Gitstack AI Concierge',
    tagline: 'Autonomous Multichannel SME Support & Booking Lead Engine',
    category: 'AI Customer Operations',
    icon: Bot,
    summary:
      'Provides 24/7 intelligent customer triage, price quotations in Philippine Pesos (₱), and calendar reservation booking across Web Chat, Facebook Messenger, and Viber. Zero hallucinations with strict domain grounding.',
    technicalSpecs: [
      { label: 'Supported Channels', value: 'Web Chat SDK, Meta Graph API (Messenger), Viber Business API' },
      { label: 'Knowledge Base', value: 'Strictly bounded business FAQs, price sheets, and service catalogs' },
      { label: 'Response Latency', value: '<400ms average response with human-like typing simulation' },
      { label: 'Lead Capture', value: 'Instant CRM synchronization, Google Sheets export & webhook dispatch' },
      { label: 'Human Handoff', value: 'Seamless escalation to staff inbox with complete visitor chat history' }
    ],
    pricing: {
      setupPhp: '₱40,000',
      monthlyPhp: '₱12,500/mo',
      sla: '100% Data Privacy (Zero Customer Data Training) · 99.9% API SLA'
    },
    sampleScenarios: [
      'Dental & medical clinics automating after-hours appointment scheduling and rates inquiry',
      'Automotive repair shops providing instant preventive maintenance pricing',
      'B2B packaging manufacturers quoting bulk tiered carton packaging on Viber'
    ]
  },
  {
    id: 'flowcrm',
    demoHash: 'flowcrm',
    name: 'Gitstack FlowCRM & Chaser',
    tagline: 'Client Deal Pipeline, Digital Quotes & Automated Receivables Chaser',
    category: 'Revenue Operations & Collections',
    icon: TrendingUp,
    summary:
      'Designed for agencies, consultants, law firms, and service contractors. Combines a visual 4-stage Kanban pipeline with an automated overdue invoice chaser that delivers polite SMS and Viber reminders with 1-click GCash & Maya payment portals.',
    technicalSpecs: [
      { label: 'Pipeline Stages', value: 'New Inquiry → Quote Sent → In Progress → Overdue Collections' },
      { label: 'Automated Chaser', value: 'Configurable D+3, D+7, D+14 escalation sequences via Email, Viber & SMS' },
      { label: 'Client Payment Portal', value: 'Direct checkout with GCash QR, Maya Wallet, and BDO/BPI online wire' },
      { label: 'Settlement Sync', value: 'Real-time invoice reconciliation marking deals settled upon payment' },
      { label: 'Cashflow Analytics', value: 'Automated DSO (Days Sales Outstanding) tracking & revenue forecasts' }
    ],
    pricing: {
      setupPhp: '₱50,000',
      monthlyPhp: '₱15,000/mo',
      sla: 'Multi-Tenant Data Encryption · Automated Daily Offsite Backups'
    },
    sampleScenarios: [
      'Interior design and architectural studios chasing phased milestone payments',
      'Corporate law and accounting retainers automating monthly subscription billing',
      'Commercial catering and event planners capturing deposits and final balances'
    ]
  }
];

// 2. CORE ENTERPRISE ENGINEERING PRACTICES
const CORE_ENGINEERING_PRACTICES = [
  {
    code: '01',
    name: 'AI Integration Services',
    audience: 'Enterprises embedding LLMs into proprietary workflows and internal knowledge',
    outcomes: [
      'Hybrid lexical + vector Retrieval-Augmented Generation (RAG) with inline source citations',
      'Pre-retrieval role-based access control (RBAC) enforcing document permissions',
      'Deterministic agentic workflows with human-in-the-loop approval thresholds',
      'Automated groundedness & regression evaluation pipelines on every prompt or model update'
    ]
  },
  {
    code: '02',
    name: 'Machine Learning Automation Solutions',
    audience: 'Data & product teams operationalizing predictive models at production scale',
    outcomes: [
      'End-to-end MLOps pipelines on Kubernetes with immutable container promotion',
      'Unified offline-online feature stores eliminating training-serving skew',
      'Continuous statistical drift detection (PSI, KS, calibration error) with automated triggers',
      'Shadow traffic mirroring and <3-second progressive canary rollbacks'
    ]
  },
  {
    code: '03',
    name: 'Custom Software Development',
    audience: 'Product organizations launching new platforms or modernizing legacy monoliths',
    outcomes: [
      'TypeScript, React, Next.js, and Node.js distributed web and API engineering',
      'Incremental Strangler Fig legacy decomposition with zero-downtime edge routing',
      'Transactional outbox event-driven architectures for strict financial/data consistency',
      'WCAG AA accessible interfaces engineered for sub-second Core Web Vitals'
    ]
  },
  {
    code: '04',
    name: 'Cloud Infrastructure Management',
    audience: 'Engineering organizations scaling multi-region reliability and FinOps governance',
    outcomes: [
      'Layered Terraform Infrastructure-as-Code modules with strict blast-radius isolation',
      'Open Policy Agent (OPA) CI guardrails blocking security regressions pre-apply',
      'Multi-region Kubernetes orchestration, disaster recovery runbooks, and active failover',
      'Continuous FinOps instance right-sizing and GPU inference cost optimization'
    ]
  },
  {
    code: '05',
    name: 'Technical Consulting & Architecture Audits',
    audience: 'CTOs, VPs of Engineering, and investors needing objective technical clarity',
    outcomes: [
      '2-week comprehensive codebase, cloud spend, and AI feasibility diagnostics',
      'Build-vs-buy evaluations across foundation models, vector databases, and cloud vendors',
      'Security posture hardening, SOC2/ISO technical readiness, and incident response playbooks',
      'Embedded principal engineering mentorship for scaling product squads'
    ]
  }
];

type LightboxModalState =
  | { mode: 'slide'; slideIndex: number }
  | { mode: 'module'; module: BackOfficeModuleShowcase }
  | null;

export function ServicesPage({
  pageContent,
  onNavigate
}: {
  pageContent?: PageContentConfig;
  onNavigate: (path: string) => void;
}) {
  const cms = pageContent || DEFAULT_PAGE_CONTENTS.services;
  const slides = useMemo(() => resolveServiceShowcaseSlides(cms.custom_blocks), [cms.custom_blocks]);

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isHoverPaused, setIsHoverPaused] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | BackOfficeCategoryId>('all');
  const [moduleSearch, setModuleSearch] = useState('');
  const [lightbox, setLightbox] = useState<LightboxModalState>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Keep slide index within bounds when custom slides change
  const safeSlideIndex = slides.length > 0 ? activeSlideIndex % slides.length : 0;
  const activeSlide = slides[safeSlideIndex];

  // Auto-play slider loop (pauses on hover, manual pause, or open lightbox)
  useEffect(() => {
    if (!isAutoPlaying || isHoverPaused || lightbox !== null || slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % slides.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [isAutoPlaying, isHoverPaused, lightbox, slides.length]);

  // Lightbox keyboard navigation (Esc, ArrowLeft, ArrowRight)
  useEffect(() => {
    if (!lightbox) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightbox(null);
      } else if (lightbox.mode === 'slide' && e.key === 'ArrowRight') {
        setLightbox((prev) =>
          prev && prev.mode === 'slide'
            ? { mode: 'slide', slideIndex: (prev.slideIndex + 1) % slides.length }
            : prev
        );
      } else if (lightbox.mode === 'slide' && e.key === 'ArrowLeft') {
        setLightbox((prev) =>
          prev && prev.mode === 'slide'
            ? { mode: 'slide', slideIndex: (prev.slideIndex - 1 + slides.length) % slides.length }
            : prev
        );
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightbox, slides.length]);

  // Filter 28 Back Office modules across 6 categories + keyword search
  const filteredModules = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    return BACK_OFFICE_MODULES_SHOWCASE.filter((mod) => {
      if (activeCategory !== 'all' && mod.categoryId !== activeCategory) return false;
      if (!q) return true;
      const haystack = [
        mod.name,
        mod.categoryName,
        mod.headline,
        mod.problemSolved,
        mod.detailedDescription,
        ...mod.capabilities,
        ...mod.seoKeywords
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [activeCategory, moduleSearch]);

  // SEO & Schema.org Graph synchronization
  const leadSlideImage = slides[0]?.image_url || cms.hero_image;
  useEffect(() => {
    const origin = window.location.origin;
    applySeoMetadata({
      title: 'Enterprise AI Automation, SaaS & Back Office ERP | GitStack',
      description: cms.hero_subtitle || SERVICES_SEO_META.description,
      path: '/services',
      ogImage: leadSlideImage,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Service',
            name: 'Enterprise AI Automation, Custom SaaS & Back Office ERP',
            serviceType: 'Enterprise Software Engineering, AI Automation & Back Office ERP',
            description: cms.hero_subtitle || SERVICES_SEO_META.description,
            url: `${origin}/services`,
            provider: {
              '@type': 'Organization',
              name: 'GitStack',
              url: origin
            },
            hasOfferCatalog: {
              '@type': 'OfferCatalog',
              name: 'GitStack SaaS Systems, 28-Module Back Office ERP & Engineering Services',
              itemListElement: [
                ...SAAS_PRODUCT_SYSTEMS.map((prod, i) => ({
                  '@type': 'ListItem',
                  position: i + 1,
                  item: {
                    '@type': 'SoftwareApplication',
                    name: prod.name,
                    applicationCategory: prod.category,
                    operatingSystem: 'Web, Cloud SaaS',
                    description: prod.summary,
                    url: `${origin}/demo#${prod.demoHash}`
                  }
                })),
                ...BACK_OFFICE_MODULES_SHOWCASE.map((mod, i) => ({
                  '@type': 'ListItem',
                  position: SAAS_PRODUCT_SYSTEMS.length + i + 1,
                  item: {
                    '@type': 'SoftwareApplication',
                    name: `GitStack Back Office ERP — ${mod.name}`,
                    applicationCategory: `BusinessApplication · ${mod.categoryName}`,
                    operatingSystem: 'Web, Cloud SaaS',
                    description: `${mod.headline}. ${mod.problemSolved}`,
                    url: `${origin}/demo?tab=backoffice`
                  }
                })),
                ...CORE_ENGINEERING_PRACTICES.map((svc, i) => ({
                  '@type': 'ListItem',
                  position:
                    SAAS_PRODUCT_SYSTEMS.length + BACK_OFFICE_MODULES_SHOWCASE.length + i + 1,
                  item: {
                    '@type': 'Service',
                    name: svc.name,
                    description: svc.outcomes.join(' '),
                    provider: { '@type': 'Organization', name: 'GitStack' }
                  }
                }))
              ]
            }
          },
          {
            '@type': 'FAQPage',
            mainEntity: SERVICES_ENTERPRISE_FAQS.map((faq) => ({
              '@type': 'Question',
              name: faq.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer
              }
            }))
          }
        ]
      }
    });
  }, [cms.hero_subtitle, leadSlideImage]);

  const handleJumpToCategoryFromSlide = (categoryId: BackOfficeCategoryId) => {
    setActiveCategory(categoryId);
    setModuleSearch('');
    const el = document.getElementById('backoffice-modules');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleScopeInInquiry = () => {
    setLightbox(null);
    const el = document.getElementById('services-inquiry');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const resolveSlideForModule = (mod: BackOfficeModuleShowcase) => {
    const byId = slides.find((s) => s.id === mod.slideId || s.module_id === mod.id);
    if (byId) return byId;
    const byCat = slides.find((s) => s.categoryId === mod.categoryId);
    return byCat || slides[0];
  };

  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14 lg:py-16 space-y-16 sm:space-y-20">
        {/* HERO SECTION */}
        <section className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-4">
            <p className="font-mono text-xs font-semibold tracking-wide text-[var(--gs-primary)] uppercase">
              {cms.hero_kicker}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12]">
              {cms.hero_title}
            </h1>
            <p className="text-base sm:text-lg leading-relaxed text-slate-600 max-w-2xl">
              {cms.hero_subtitle}
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/demo?tab=backoffice')}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[var(--gs-primary)] px-5 py-2.5 text-xs font-bold text-white hover:bg-[var(--gs-primary-hover)] transition-colors whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Launch Live Back Office Demo</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <a
                href="#backoffice-modules"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Explore 28 ERP Modules</span>
              </a>
              <a
                href="#services-inquiry"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Request Proposal</span>
              </a>
            </div>
          </div>

          {/* Right Quantitative Architecture Snapshot & Hero Preview Trigger */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Production Architecture Footprint
              </span>
              <button
                type="button"
                onClick={() => setLightbox({ mode: 'slide', slideIndex: safeSlideIndex })}
                className="text-xs font-semibold text-[var(--gs-primary)] hover:underline whitespace-nowrap shrink-0"
              >
                Open Gallery
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="font-mono text-2xl font-bold text-slate-900 tabular-nums">28</div>
                <div className="mt-0.5 text-xs font-semibold text-slate-700">Back Office Modules</div>
                <div className="text-[11px] text-slate-500">Across 6 core categories</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="font-mono text-2xl font-bold text-[var(--gs-primary)] tabular-nums">
                  8
                </div>
                <div className="mt-0.5 text-xs font-semibold text-slate-700">AI Operations Agents</div>
                <div className="text-[11px] text-slate-500">SEO, QA, Security, Guard</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="font-mono text-2xl font-bold text-slate-900 tabular-nums">4</div>
                <div className="mt-0.5 text-xs font-semibold text-slate-700">Turnkey SaaS Systems</div>
                <div className="text-[11px] text-slate-500">Ready for cloud rollout</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="font-mono text-2xl font-bold text-[#16A34A] tabular-nums">100%</div>
                <div className="mt-0.5 text-xs font-semibold text-slate-700">Isolated Sandbox</div>
                <div className="text-[11px] text-slate-500">Zero production risk</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1: INTERACTIVE BACK OFFICE ERP & SAAS PHOTO SLIDER */}
        <section id="product-showcase-slider" className="space-y-5 scroll-mt-20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-4">
            <div>
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--gs-primary)]">
                Interactive Product Tour · Production Screenshots &amp; UI Showcase
              </div>
              <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900">
                Inside the GitStack Back Office ERP Workspace
              </h2>
              <p className="mt-1 text-sm text-slate-600 max-w-3xl">
                Browse all 6 operational layers powering our live platform—click any preview to inspect
                full-screen or jump straight into the interactive read-only Live Demo.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-xs font-bold text-slate-700 tabular-nums px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50">
                {String(safeSlideIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={() => setIsAutoPlaying((prev) => !prev)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                aria-label={isAutoPlaying ? 'Pause showcase slider' : 'Play showcase slider'}
              >
                {isAutoPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>{isAutoPlaying ? 'Pause' : 'Auto-Play'}</span>
              </button>
              <button
                type="button"
                onClick={() => setLightbox({ mode: 'slide', slideIndex: safeSlideIndex })}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Lightbox</span>
              </button>
            </div>
          </div>

          {activeSlide && (
            <div
              onMouseEnter={() => setIsHoverPaused(true)}
              onMouseLeave={() => setIsHoverPaused(false)}
              className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs"
            >
              {/* Subtle auto-play bar */}
              <div className="h-1 w-full bg-slate-100">
                <div
                  className="h-full bg-[var(--gs-primary)] transition-all duration-300"
                  style={{
                    width: `${((safeSlideIndex + 1) / slides.length) * 100}%`,
                    opacity: isAutoPlaying && !isHoverPaused ? 1 : 0.45
                  }}
                />
              </div>

              {/* 16:9 Clean Viewport */}
              <div className="relative aspect-[16/9] bg-slate-100 group">
                <button
                  type="button"
                  onClick={() => setLightbox({ mode: 'slide', slideIndex: safeSlideIndex })}
                  className="block h-full w-full text-left focus:outline-none"
                  aria-label={`Inspect ${activeSlide.title} full-screen`}
                >
                  <ResilientImage
                    key={activeSlide.image_url}
                    src={activeSlide.image_url}
                    alt={activeSlide.image_alt}
                    className="h-full w-full object-cover"
                    fallbackTitle={activeSlide.title}
                  />
                </button>

                {/* Prev / Next Controls */}
                {slides.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSlideIndex((prev) => (prev - 1 + slides.length) % slides.length)
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full border border-slate-200 bg-white/95 text-slate-800 shadow-sm flex items-center justify-center hover:bg-white transition-colors"
                      aria-label="Previous Back Office slide"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSlideIndex((prev) => (prev + 1) % slides.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full border border-slate-200 bg-white/95 text-slate-800 shadow-sm flex items-center justify-center hover:bg-white transition-colors"
                      aria-label="Next Back Office slide"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              {/* Below-Image Architectural Caption & Direct Actions */}
              <div className="border-t border-slate-200 bg-slate-50/70 p-5 sm:p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1.5 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-semibold text-[var(--gs-primary)]">
                    <span>{activeSlide.category}</span>
                    {activeSlide.isCustomUpload && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="text-[#16A34A]">Production Capture</span>
                      </>
                    )}
                  </div>
                  <h3 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                    {activeSlide.title}
                  </h3>
                  <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
                    {activeSlide.caption}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleJumpToCategoryFromSlide(activeSlide.categoryId)}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <span>View Category Modules</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate(activeSlide.cta_href || '/demo?tab=backoffice')}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--gs-primary-hover)] whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{activeSlide.cta_label || 'Test in Live Demo'}</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Thumbnail Filmstrip Selector Rail */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {slides.map((slide, idx) => {
              const isSelected = idx === safeSlideIndex;
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => {
                    setActiveSlideIndex(idx);
                    setIsAutoPlaying(false);
                  }}
                  className={`group text-left rounded-xl border p-2 transition-all ${
                    isSelected
                      ? 'border-[var(--gs-primary)] bg-blue-50/40 ring-2 ring-[var(--gs-primary)]/15'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="aspect-[16/9] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    <ResilientImage
                      src={slide.image_url}
                      alt={slide.title}
                      className="h-full w-full object-cover"
                      fallbackTitle={slide.category}
                    />
                  </div>
                  <div className="mt-2 px-0.5">
                    <div className="font-mono text-[10px] font-bold text-[var(--gs-primary)] tabular-nums">
                      {String(idx + 1).padStart(2, '0')} · {slide.category}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-slate-800 line-clamp-1">
                      {slide.title}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: ALL 28 BACK OFFICE ERP MODULES ACROSS 6 CATEGORIES */}
        <section id="backoffice-modules" className="space-y-6 scroll-mt-20">
          <div className="border-b border-slate-200 pb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--gs-primary)]">
                Complete Back Office ERP Module Catalog
              </div>
              <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900">
                All 28 Production Modules Across 6 Operational Categories
              </h2>
              <p className="mt-1 text-sm text-slate-600 max-w-3xl">
                Filter by operational domain or search capabilities. Click any module to inspect its
                problem solved, technical architecture, SEO capabilities, and Live Demo preview.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/demo?tab=backoffice')}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-900 hover:bg-slate-50 whitespace-nowrap shrink-0 self-start lg:self-auto"
            >
              <Sparkles className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
              <span>Interactive Back Office Mirror</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>

          {/* Filter Bar: 6 Category Tabs + Live Search Input */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1.5">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  activeCategory === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                All Modules (28)
              </button>
              {BACK_OFFICE_CATEGORIES_SHOWCASE.map((cat) => {
                const selected = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                      selected
                        ? 'bg-[var(--gs-primary)] text-white'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    {cat.code}. {cat.name} ({cat.moduleCount})
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  value={moduleSearch}
                  onChange={(e) => setModuleSearch(e.target.value)}
                  placeholder="Search modules (e.g. Search Console, CRM, Quota Shield, Auto-Response)..."
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span className="font-mono font-semibold tabular-nums">
                  Showing {filteredModules.length} of {BACK_OFFICE_MODULES_SHOWCASE.length} modules
                </span>
                {(activeCategory !== 'all' || moduleSearch.trim()) && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('all');
                      setModuleSearch('');
                    }}
                    className="font-semibold text-[var(--gs-primary)] hover:underline whitespace-nowrap"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 28-Module Grid */}
          {filteredModules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                No Back Office modules matched &ldquo;{moduleSearch}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('all');
                  setModuleSearch('');
                }}
                className="inline-flex min-h-[38px] items-center rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Show All 28 Modules
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredModules.map((mod) => (
                <article
                  key={mod.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                      <span className="font-bold text-[var(--gs-primary)] tabular-nums">
                        Module {mod.order}
                      </span>
                      <span className="text-slate-500 truncate">{mod.categoryName}</span>
                    </div>

                    <div>
                      <h3 className="font-display text-base font-bold text-slate-900 leading-snug">
                        {mod.name}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-slate-700 leading-snug">
                        {mod.headline}
                      </p>
                    </div>

                    <p className="text-xs leading-relaxed text-slate-600">{mod.problemSolved}</p>

                    <ul className="space-y-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-700">
                      {mod.capabilities.slice(0, 3).map((cap) => (
                        <li key={cap} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#16A34A] mt-0.5" />
                          <span>{cap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setLightbox({ mode: 'module', module: mod })}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0"
                    >
                      <Maximize2 className="h-3 w-3" />
                      <span>Inspect Module</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate(mod.demoRoute)}
                      className="inline-flex min-h-[38px] items-center gap-1 text-xs font-semibold text-[var(--gs-primary)] hover:underline whitespace-nowrap shrink-0"
                    >
                      <span>Try Live Demo</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 3: TURNKEY B2B SAAS SYSTEMS WITH ARCHITECTURAL SPECS & PRICING */}
        <section id="turnkey-systems" className="space-y-8 scroll-mt-20">
          <div className="border-b border-slate-200 pb-4">
            <div className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-[var(--gs-primary)]">
              <Layers className="h-4 w-4" />
              <span>Turnkey Managed SaaS Solutions</span>
            </div>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-slate-900">
              Four Production-Grade B2B SaaS Systems Ready for Deployment
            </h2>
            <p className="mt-2 text-sm text-slate-600 max-w-3xl leading-relaxed">
              We deploy, configure, and maintain these high-impact platforms directly on your dedicated
              cloud infrastructure. Each platform includes custom business rule integration, enterprise SLAs,
              and 100% intellectual property ownership.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {SAAS_PRODUCT_SYSTEMS.map((system) => {
              const Icon = system.icon;

              return (
                <div
                  key={system.id}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-slate-300 transition-colors"
                >
                  {/* Card Header Banner */}
                  <div className="border-b border-slate-200 bg-slate-50/70 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-[var(--gs-primary)] text-white flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <h3 className="font-display text-lg font-bold text-slate-900">
                            {system.name}
                          </h3>
                          <span className="text-slate-300">·</span>
                          <span className="font-mono text-xs font-semibold text-slate-600">
                            {system.category}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{system.tagline}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigate(`/demo#${system.demoHash}`)}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-[var(--gs-primary)] hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Open Live Demo</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onNavigate(`/contact?service=${encodeURIComponent(system.name)}`)
                        }
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[var(--gs-primary-hover)] transition-colors whitespace-nowrap shrink-0"
                      >
                        <span>Request Setup</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card Content Grid */}
                  <div className="p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left: Summary & Typical SME Scenarios */}
                    <div className="lg:col-span-7 space-y-5">
                      <p className="text-sm leading-relaxed text-slate-700">{system.summary}</p>

                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          Target Enterprise &amp; SME Use Cases
                        </h4>
                        <ul className="mt-2.5 space-y-2 text-xs text-slate-600">
                          {system.sampleScenarios.map((scenario, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A] mt-0.5" />
                              <span>{scenario}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Architecture Specs Box */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2.5">
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Cpu className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
                          <span>Technical Architecture &amp; Latency Guarantees</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {system.technicalSpecs.map((spec, sIdx) => (
                            <div key={sIdx} className="space-y-0.5">
                              <span className="font-semibold text-slate-700">{spec.label}:</span>{' '}
                              <span className="text-slate-600">{spec.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right: Commercial Pricing & SLA Column */}
                    <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
                      <div>
                        <span className="text-[11px] font-mono font-bold uppercase text-slate-500">
                          Commercial Pricing
                        </span>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="font-display text-2xl font-bold text-slate-900 tabular-nums">
                            {system.pricing.setupPhp}
                          </span>
                          <span className="text-xs text-slate-500">one-time turnkey onboarding</span>
                        </div>
                        <div className="mt-1 text-sm font-semibold text-[var(--gs-primary)] font-mono tabular-nums">
                          + {system.pricing.monthlyPhp} managed retainer
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-3 text-xs text-slate-600 space-y-1.5">
                        <div className="font-semibold text-slate-800">SLA &amp; Support Scope:</div>
                        <p className="leading-snug">{system.pricing.sla}</p>
                        <p className="text-[11px] text-slate-500">
                          Includes automated database replication, security patches &amp; dedicated Slack/Lark hotline.
                        </p>
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate(`/contact?service=${encodeURIComponent(system.name)}`)
                          }
                          className="w-full min-h-[44px] rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                          <span>Schedule Technical Scoping Call</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 4: CORE ENTERPRISE ENGINEERING PRACTICES */}
        <section className="space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <div className="font-mono text-xs font-bold uppercase tracking-wider text-slate-500">
              Custom Engineering Practices
            </div>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900">
              End-to-End Enterprise Software &amp; AI Automation Capabilities
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              For organizations with custom cloud footprints, proprietary datasets, and specialized MLOps requirements.
            </p>
          </div>

          <div className="space-y-5">
            {CORE_ENGINEERING_PRACTICES.map((svc) => (
              <section
                key={svc.code}
                className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8 grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12"
              >
                <div className="lg:col-span-5">
                  <div className="font-mono text-xs font-medium text-[var(--gs-primary)] tabular-nums">
                    Practice {svc.code}
                  </div>
                  <h3 className="mt-2 font-display text-2xl font-bold text-slate-900">{svc.name}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    <span className="font-semibold text-slate-800">Best suited for:</span>{' '}
                    {svc.audience}
                  </p>
                  <div className="mt-5 sm:mt-6">
                    <a
                      href="#services-inquiry"
                      className="inline-flex min-h-[44px] sm:min-h-0 items-center gap-1.5 text-xs font-semibold text-[var(--gs-primary)] hover:underline"
                    >
                      <span>Scope this capability</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
                <div className="lg:col-span-7 border-t border-slate-200 pt-6 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
                  <h4 className="text-xs font-semibold text-slate-900">
                    Deliverables &amp; Architecture
                  </h4>
                  <ul className="mt-4 space-y-3 text-sm text-slate-700">
                    {svc.outcomes.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gs-primary)]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ))}
          </div>
        </section>

        {/* SECTION 5: ENTERPRISE FAQ ACCORDION */}
        <section id="services-faq" className="space-y-5 scroll-mt-20">
          <div className="border-b border-slate-200 pb-4">
            <div className="font-mono text-xs font-bold uppercase tracking-wider text-slate-500">
              Procurement, Architecture &amp; Live Demo Questions
            </div>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {SERVICES_ENTERPRISE_FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={faq.question}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full px-5 sm:px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                  >
                    <span className="font-display text-sm sm:text-base font-bold text-slate-900">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-5 text-sm leading-relaxed text-slate-600">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 6: TECHNICAL INSIGHTS LINK */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900">
              {cms.intro_heading || 'Want to inspect our engineering architecture standards first?'}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {cms.intro_body ||
                'Read our deep-dive implementation blueprints in the Technical Insights Journal.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/insights')}
            className="min-h-[44px] w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-900 hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            Explore Technical Insights
          </button>
        </div>

        {/* SECTION 7: INQUIRY INTAKE FORM */}
        <div id="services-inquiry" className="mt-12 sm:mt-14 scroll-mt-20">
          <h2 className="mb-6 font-display text-2xl font-bold text-slate-900">
            {cms.hero_cta_label || 'Request a Technical Proposal'}
          </h2>
          <InquiryForm />
        </div>
      </div>

      <CustomBlocksSection blocks={cms.custom_blocks} onNavigate={onNavigate} />

      {/* LIGHTBOX & MODULE DETAIL MODAL */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Back Office Product Inspection Modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 sm:p-6 backdrop-blur-xs"
          onClick={() => setLightbox(null)}
        >
          <div
            className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {lightbox.mode === 'slide' ? (
              (() => {
                const modalSlide = slides[lightbox.slideIndex % slides.length] || activeSlide;
                return (
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="font-bold text-[var(--gs-primary)] tabular-nums">
                          {String((lightbox.slideIndex % slides.length) + 1).padStart(2, '0')} /{' '}
                          {String(slides.length).padStart(2, '0')}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="font-semibold text-slate-700">{modalSlide.category}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLightbox(null)}
                        className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                        aria-label="Close lightbox"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="relative aspect-[16/9] bg-slate-100">
                      <ResilientImage
                        key={modalSlide.image_url}
                        src={modalSlide.image_url}
                        alt={modalSlide.image_alt}
                        className="h-full w-full object-contain bg-slate-950"
                        fallbackTitle={modalSlide.title}
                      />
                      {slides.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setLightbox({
                                mode: 'slide',
                                slideIndex:
                                  (lightbox.slideIndex - 1 + slides.length) % slides.length
                              })
                            }
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full border border-slate-200 bg-white/95 text-slate-900 flex items-center justify-center hover:bg-white"
                            aria-label="Previous slide in lightbox"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setLightbox({
                                mode: 'slide',
                                slideIndex: (lightbox.slideIndex + 1) % slides.length
                              })
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full border border-slate-200 bg-white/95 text-slate-900 flex items-center justify-center hover:bg-white"
                            aria-label="Next slide in lightbox"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>

                    <div className="border-t border-slate-200 p-5 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <h3 className="font-display text-lg font-bold text-slate-900">
                          {modalSlide.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                          {modalSlide.caption}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setLightbox(null);
                            handleJumpToCategoryFromSlide(modalSlide.categoryId);
                          }}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <span>Inspect Category Modules</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate(modalSlide.cta_href || '/demo?tab=backoffice')}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--gs-primary-hover)] whitespace-nowrap"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Launch Live Demo</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              (() => {
                const mod = lightbox.module;
                const previewSlide = resolveSlideForModule(mod);
                return (
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-200 px-5 sm:px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                        <span className="font-bold text-[var(--gs-primary)] tabular-nums">
                          Module {mod.order}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="font-semibold text-slate-700">{mod.categoryName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLightbox(null)}
                        className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                        aria-label="Close module inspection modal"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      <div className="lg:col-span-6 space-y-3">
                        <div className="aspect-[16/9] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                          <ResilientImage
                            key={previewSlide.image_url}
                            src={previewSlide.image_url}
                            alt={previewSlide.image_alt}
                            className="h-full w-full object-cover"
                            fallbackTitle={mod.name}
                          />
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
                          <div className="font-semibold text-slate-800">Architecture Note</div>
                          <p className="mt-1 text-slate-600 leading-relaxed">
                            {mod.architectureNote}
                          </p>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          Search Console Focus: {mod.seoKeywords.join(' · ')}
                        </div>
                      </div>

                      <div className="lg:col-span-6 space-y-4">
                        <div>
                          <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
                            {mod.name}
                          </h3>
                          <p className="mt-1 text-xs font-semibold text-[var(--gs-primary)]">
                            {mod.headline}
                          </p>
                        </div>

                        <p className="text-sm leading-relaxed text-slate-700">
                          {mod.detailedDescription}
                        </p>

                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-900">
                            Production Capabilities
                          </div>
                          <ul className="mt-2.5 space-y-2 text-xs text-slate-700">
                            {mod.capabilities.map((cap) => (
                              <li key={cap} className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A] mt-0.5" />
                                <span>{cap}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="pt-2 flex flex-wrap items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => onNavigate(mod.demoRoute)}
                            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--gs-primary-hover)] whitespace-nowrap shrink-0"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Open Back Office Live Demo</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={handleScopeInInquiry}
                            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                          >
                            <span>Scope Custom Rollout</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
}
