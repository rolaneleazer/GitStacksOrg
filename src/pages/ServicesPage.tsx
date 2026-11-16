import {
  ArrowRight,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  CreditCard,
  Database,
  ExternalLink,
  Layers,
  Package,
  Receipt,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap
} from 'lucide-react';
import React, { useEffect } from 'react';
import { CustomBlocksSection } from '../components/CustomBlocksSection.tsx';
import { InquiryForm } from '../components/InquiryForm.tsx';
import { ResilientImage } from '../components/ResilientImage.tsx';
import { applySeoMetadata } from '../lib/seo.ts';
import { DEFAULT_PAGE_CONTENTS } from '../shared/pageDefaults.ts';
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

export function ServicesPage({
  pageContent,
  onNavigate
}: {
  pageContent?: PageContentConfig;
  onNavigate: (path: string) => void;
}) {
  const cms = pageContent || DEFAULT_PAGE_CONTENTS.services;

  useEffect(() => {
    const origin = window.location.origin;
    applySeoMetadata({
      title: 'Services & Turnkey B2B SaaS Systems | GitStack Engineering',
      description:
        'Explore GitStack’s turnkey software systems (Omnichannel Inventory Sync, BIR EIS E-Invoicing, AI Concierge, FlowCRM) alongside our core engineering practices in AI, ML, Cloud & Software.',
      path: '/services',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'GitStack Engineering Services & SaaS Systems',
        url: `${origin}/services`,
        itemListElement: [
          ...SAAS_PRODUCT_SYSTEMS.map((prod, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
              '@type': 'SoftwareApplication',
              name: prod.name,
              applicationCategory: prod.category,
              description: prod.summary,
              provider: { '@type': 'Organization', name: 'GitStack' }
            }
          })),
          ...CORE_ENGINEERING_PRACTICES.map((svc, i) => ({
            '@type': 'ListItem',
            position: SAAS_PRODUCT_SYSTEMS.length + i + 1,
            item: {
              '@type': 'Service',
              name: svc.name,
              description: svc.outcomes.join(' '),
              provider: { '@type': 'Organization', name: 'GitStack' }
            }
          }))
        ]
      }
    });
  }, []);

  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14 lg:py-20 space-y-16 sm:space-y-20">
        {/* HERO SECTION */}
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-4">
            <p className="text-xs font-semibold tracking-wide text-[var(--gs-primary)]">
              {cms.hero_kicker}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
              {cms.hero_title}
            </h1>
            <p className="text-base sm:text-lg leading-relaxed text-slate-600">
              {cms.hero_subtitle}
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <a
                href="#turnkey-systems"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-5 py-2.5 text-xs font-bold text-white hover:bg-[var(--gs-primary-hover)] transition-colors"
              >
                <span>View Turnkey SaaS Systems</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={() => onNavigate('/demo')}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                <span>Test Live Interactive Demos</span>
              </button>
            </div>
          </div>

          {cms.hero_image && (
            <div className="lg:col-span-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 aspect-[16/10] shadow-sm">
              <ResilientImage
                src={cms.hero_image}
                alt={cms.hero_image_alt || cms.hero_title}
                className="h-full w-full object-cover"
                fallbackTitle="GitStack Services"
              />
            </div>
          )}
        </div>

        {/* SECTION 1: TURNKEY B2B SAAS SYSTEMS WITH ARCHITECTURAL SPECS & PRICING */}
        <div id="turnkey-systems" className="space-y-8 scroll-mt-20">
          <div className="border-b border-slate-200 pb-4">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--gs-primary)]">
              <Layers className="h-4 w-4" />
              <span>Turnkey Managed SaaS Solutions</span>
            </div>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-slate-900">
              Four Production-Grade Systems Ready for Deployment
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
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs hover:border-slate-300 transition-all"
                >
                  {/* Card Header Banner */}
                  <div className="border-b border-slate-200 bg-slate-50/70 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-[var(--gs-primary)] text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-lg font-bold text-slate-900">
                            {system.name}
                          </span>
                          <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                            {system.category}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{system.tagline}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigate(`/demo#${system.demoHash}`)}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-bold text-[var(--gs-primary)] hover:bg-indigo-100 transition-colors"
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
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[var(--gs-primary-hover)] transition-colors shadow-2xs"
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
                          Target SME Use Cases:
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
                          <span className="font-display text-2xl font-bold text-slate-900">
                            {system.pricing.setupPhp}
                          </span>
                          <span className="text-xs text-slate-500">one-time turnkey onboarding</span>
                        </div>
                        <div className="mt-1 text-sm font-semibold text-indigo-700 font-mono">
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
                          className="w-full min-h-[42px] rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 flex items-center justify-center gap-2"
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
        </div>

        {/* SECTION 2: CORE ENTERPRISE ENGINEERING PRACTICES */}
        <div className="space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Custom Engineering Practices
            </div>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900">
              End-to-End Enterprise Software &amp; AI Capabilities
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
                  <div className="font-mono text-xs font-medium text-[var(--gs-primary)]">
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
        </div>

        {/* SECTION 3: TECHNICAL INSIGHTS LINK */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900">
              Want to inspect our engineering architecture standards first?
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Read our deep-dive implementation blueprints in the Technical Insights Journal.
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

        {/* SECTION 4: INQUIRY INTAKE FORM */}
        <div id="services-inquiry" className="mt-12 sm:mt-14 scroll-mt-20">
          <h2 className="mb-6 font-display text-2xl font-bold text-slate-900">
            {cms.hero_cta_label || 'Request a Technical Proposal'}
          </h2>
          <InquiryForm />
        </div>
      </div>

      <CustomBlocksSection blocks={cms.custom_blocks} onNavigate={onNavigate} />
    </div>
  );
}
