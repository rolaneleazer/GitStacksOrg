import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CustomBlocksSection } from '../components/CustomBlocksSection.tsx';
import { InquiryForm } from '../components/InquiryForm.tsx';
import { NewsletterCard } from '../components/NewsletterCard.tsx';
import { ResilientImage } from '../components/ResilientImage.tsx';
import { applySeoMetadata } from '../lib/seo.ts';
import { DEFAULT_PAGE_CONTENTS } from '../shared/pageDefaults.ts';
import type { Article, PageContentConfig, ServiceCategory } from '../shared/types.ts';

interface HomePageProps {
  articles: Article[];
  pageContent?: PageContentConfig;
  onNavigate: (path: string) => void;
}

const CAPABILITY_SPECS: Record<
  ServiceCategory,
  {
    number: string;
    headline: string;
    summary: string;
    deliverables: string[];
    stack: string;
    governance: string;
  }
> = {
  'AI Integration': {
    number: '01',
    headline: 'Enterprise AI Integration & Agentic Systems',
    summary:
      'Embed grounded language models, private Retrieval-Augmented Generation (RAG), and deterministic tool-using workflows directly into your CRM, ERP, and internal engineering platforms.',
    deliverables: [
      'Hybrid lexical + dense vector retrieval pipelines with cross-encoder reranking',
      'Pre-retrieval role-based access control (RBAC) preventing cross-tenant data leakage',
      'Automated groundedness regression suites measuring citation accuracy before deploy'
    ],
    stack: 'TypeScript, Python, OpenAI / Gemini APIs, pgvector, Redis, OpenTelemetry',
    governance: 'Zero-retention model endpoints, prompt-injection isolation, and audit logging.'
  },
  'ML Automation': {
    number: '02',
    headline: 'Machine Learning Automation & MLOps Pipelines',
    summary:
      'Eliminate manual notebook deployments with automated feature stores, statistical drift detectors, reproducible training DAGs, and zero-downtime canary model promotion.',
    deliverables: [
      'Event-driven retraining workflows triggered by PSI/KS feature and prediction drift',
      'Unified offline-online feature definitions preventing training-serving skew',
      'Shadow traffic mirroring and progressive Kubernetes canary rollbacks in <3 seconds'
    ],
    stack: 'Kubernetes, PyTorch, ONNX Runtime, Airflow / Temporal, Prometheus, Terraform',
    governance: 'Immutable model lineage registry, subgroup bias gates, and SLO cost budgets.'
  },
  'Custom Software': {
    number: '03',
    headline: 'Custom Software & Platform Engineering',
    summary:
      'Build resilient web platforms, high-throughput APIs, and event-driven TypeScript microservices—or modernize legacy monoliths incrementally without risky big-bang rewrites.',
    deliverables: [
      'Strangler Fig API gateway decomposition with zero-downtime cutovers',
      'Transactional outbox event buses ensuring strict database-to-broker consistency',
      'End-to-end typed React & Node.js applications built for WCAG AA accessibility'
    ],
    stack: 'TypeScript, React, Next.js, Node.js, PostgreSQL, Supabase, Kafka',
    governance: 'Automated CI contract testing, SBOM dependency scanning, and peer-reviewed PR gates.'
  },
  'Cloud Infrastructure': {
    number: '04',
    headline: 'Cloud Infrastructure Management & FinOps',
    summary:
      'Architect multi-region AWS, GCP, and hybrid cloud environments governed by modular Terraform, Policy-as-Code security checks, and continuous cost optimization.',
    deliverables: [
      'Layered Terraform modules separating foundation IAM, data stores, and compute',
      'Open Policy Agent (OPA) CI gates blocking misconfigured ports or public buckets',
      'Multi-region failover automation, Kubernetes autoscaling, and FinOps right-sizing'
    ],
    stack: 'AWS, Google Cloud, Terraform, Kubernetes, OPA/Conftest, Datadog',
    governance: 'SOC2/ISO-aligned infrastructure baselines with automated drift reconciliation.'
  },
  'Technical Consulting': {
    number: '05',
    headline: 'Technical Consulting & Architecture Advisory',
    summary:
      'Partner with GitStack principal architects for AI readiness roadmaps, build-vs-buy assessments, system resilience audits, and executive technical due diligence.',
    deliverables: [
      '2-week architecture diagnostic covering latency bottlenecks, cloud spend, and AI ROI',
      'Executive build-vs-buy evaluation across foundation models, vector stores, and SaaS',
      'Hands-on engineering team enablement, coding standards, and incident playbooks'
    ],
    stack: 'Architecture Blueprints, Threat Modeling, Load Testing, FinOps Audits',
    governance: 'Vendor-neutral recommendations anchored in measurable engineering KPIs.'
  }
};

const HOME_FAQS = [
  {
    question: 'What services does GitStack provide beyond custom software and cloud management?',
    answer:
      'Alongside custom software development, cloud infrastructure management, and technical consulting, GitStack delivers production AI Integration (enterprise RAG pipelines, private copilots, agentic automation) and Machine Learning Automation Solutions (end-to-end MLOps, drift monitoring, and automated retraining).'
  },
  {
    question: 'How quickly can GitStack take an AI or ML automation initiative to production?',
    answer:
      'Most engagements start with a 2-week Architecture & Data Readiness Sprint, followed by a production-hardened pilot integrated with your identity and security controls within 4 to 8 weeks.'
  },
  {
    question: 'How does GitStack prevent sensitive company data from leaking through AI integrations?',
    answer:
      'We enforce zero-retention enterprise model contracts, strip PII where required, and apply pre-retrieval role-based access control (RBAC) filters at the search query layer so users only retrieve documents they are already authorized to read.'
  },
  {
    question: 'Can GitStack work alongside our existing internal engineering team?',
    answer:
      'Yes. We operate either as a dedicated delivery pod owning end-to-end milestones or embedded directly alongside your staff engineers—shipping through your Git repositories, CI/CD pipelines, and observability stack.'
  }
];

export function HomePage({ articles, pageContent, onNavigate }: HomePageProps) {
  const cms = pageContent || DEFAULT_PAGE_CONTENTS.home;
  const [activeService, setActiveService] = useState<ServiceCategory>('AI Integration');
  const [selectedInquiryService, setSelectedInquiryService] =
    useState<ServiceCategory>('AI Integration');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  useEffect(() => {
    const origin = window.location.origin;
    applySeoMetadata({
      title: 'GitStack — AI Integration, ML Automation & Cloud Engineering',
      description:
        'GitStack delivers AI integration, machine learning automation, custom software development, cloud infrastructure management, and technical consulting.',
      path: '/',
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            name: 'GitStack',
            url: origin,
            potentialAction: {
              '@type': 'SearchAction',
              target: `${origin}/insights?q={search_term_string}`,
              'query-input': 'required name=search_term_string'
            }
          },
          {
            '@type': 'FAQPage',
            mainEntity: HOME_FAQS.map((f) => ({
              '@type': 'Question',
              name: f.question,
              acceptedAnswer: { '@type': 'Answer', text: f.answer }
            }))
          }
        ]
      }
    });
  }, []);

  const spec = CAPABILITY_SPECS[activeService];

  const jumpToConsultation = (service: ServiceCategory) => {
    setSelectedInquiryService(service);
    const el = document.getElementById('consultation');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div>
      {/* 1. Hero Section — Split Editorial Composition */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14 lg:py-20">
          <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
            <div className="flex flex-col justify-between lg:col-span-6">
              <div>
                <p className="text-xs font-semibold tracking-wide text-[#1E40AF]">
                  {cms.hero_kicker}
                </p>
                <h1 className="mt-4 font-display text-[clamp(2.25rem,4vw,3.5rem)] font-bold leading-[1.1] tracking-tight text-slate-900">
                  {cms.hero_title}
                </h1>
                <p className="mt-5 max-w-xl text-base leading-[1.7] text-slate-600">
                  {cms.hero_subtitle}
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-5">
                <button
                  type="button"
                  onClick={() => jumpToConsultation('AI Integration')}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#1E40AF] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{cms.hero_cta_label || 'Schedule Discovery Call'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/insights')}
                  className="text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-[#1E40AF] hover:decoration-[#1E40AF] transition-colors whitespace-nowrap shrink-0"
                >
                  Read Engineering Insights
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[280px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                <ResilientImage
                  src={cms.hero_image || DEFAULT_PAGE_CONTENTS.home.hero_image}
                  alt={cms.hero_image_alt || DEFAULT_PAGE_CONTENTS.home.hero_image_alt}
                  className="h-full w-full object-cover"
                  fallbackTitle="GitStack Engineering Studio"
                />
              </div>
            </div>
          </div>

          {/* Full-Width 4-Column Quantitative Proof Strip Below Split */}
          <div className="mt-12 grid grid-cols-2 gap-6 border-t border-slate-200 pt-8 md:grid-cols-4">
            <div>
              <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                99.98%
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Production SLA across managed multi-region cloud workloads
              </p>
            </div>
            <div>
              <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                -41%
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Average manual triage reduction after AI workflow deployment
              </p>
            </div>
            <div>
              <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                &lt; 350ms
              </div>
              <p className="mt-1 text-xs text-slate-600">
                p95 enterprise RAG retrieval latency with RBAC filtering
              </p>
            </div>
            <div>
              <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                4–8 Weeks
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Typical sprint cadence from architecture audit to live pilot
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Core & Expanded Capabilities — Interactive Architecture Explorer + Asymmetric Bento */}
      <section id="ai-ml" className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wide text-[#1E40AF]">
              Expanded Service Portfolio
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
              {cms.intro_heading || DEFAULT_PAGE_CONTENTS.home.intro_heading}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/services')}
            className="text-sm font-semibold text-[#1E40AF] hover:underline whitespace-nowrap shrink-0"
          >
            View full service matrix →
          </button>
        </div>

        {/* Interactive Capability Switcher */}
        <div className="mt-8 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          {(Object.keys(CAPABILITY_SPECS) as ServiceCategory[]).map((cat) => {
            const active = activeService === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveService(cat)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#1E40AF] text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {CAPABILITY_SPECS[cat].number}. {cat}
              </button>
            );
          })}
        </div>

        {/* Asymmetric Bento Detail Grid */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white p-8 lg:col-span-7 flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono font-medium text-slate-500">
                Practice {spec.number} · {activeService}
              </div>
              <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900">
                {spec.headline}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{spec.summary}</p>

              <div className="mt-6 border-t border-slate-200 pt-6">
                <h4 className="text-xs font-semibold text-slate-900">Key Engineering Deliverables</h4>
                <ul className="mt-3 space-y-2.5 text-sm text-slate-700">
                  {spec.deliverables.map((d) => (
                    <li key={d} className="flex items-start gap-2.5">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#1E40AF]" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 border-t border-slate-200 pt-6 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-slate-900">Core Technology Stack</div>
                <p className="mt-1 font-mono text-xs leading-relaxed text-slate-600">{spec.stack}</p>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900">Security &amp; Governance</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{spec.governance}</p>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => jumpToConsultation(activeService)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#1E40AF] bg-white px-4 py-2.5 text-xs font-semibold text-[#1E40AF] hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Scope a {activeService} Engagement</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:col-span-5">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                <ResilientImage
                  src={cms.secondary_image || DEFAULT_PAGE_CONTENTS.home.secondary_image}
                  alt={cms.secondary_image_alt || DEFAULT_PAGE_CONTENTS.home.secondary_image_alt}
                  className="h-full w-full object-cover"
                  fallbackTitle="AI & MLOps Pipeline"
                />
              </div>
              <div className="p-5">
                <div className="text-xs text-slate-500">New Capability · AI &amp; MLOps</div>
                <h4 className="mt-1 font-display text-base font-bold text-slate-900">
                  Deterministic AI Pipelines Without Black-Box Risk
                </h4>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  Every model integration ships with citation verification, permission filtering,
                  and automated drift alerts.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="grid grid-cols-5 items-stretch">
                <div className="col-span-2 bg-slate-100">
                  <ResilientImage
                    src="/src/assets/images/cloud_infra_architecture_1794645172181.jpg"
                    alt="Cloud infrastructure systems architect workstation"
                    className="h-full w-full object-cover"
                    fallbackTitle="Cloud Infrastructure"
                  />
                </div>
                <div className="col-span-3 p-5">
                  <div className="text-xs text-slate-500">Foundation · Cloud &amp; Software</div>
                  <h4 className="mt-1 font-display text-base font-bold text-slate-900">
                    Policy-Governed Cloud Operations
                  </h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    Multi-region Terraform, Kubernetes autoscaling, and FinOps cost controls wired
                    into your CI/CD workflows.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Adjacent Proof of Impact — Quantified Case Studies */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wide text-[#1E40AF]">
              Verified Delivery Outcomes
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
              Measurable Engineering Impact Across Production Systems
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            <article className="rounded-xl border border-slate-200 bg-[#FAFAFC] p-6 flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-500">
                  AI Integration · Global Freight &amp; Customs
                </div>
                <div className="mt-3 font-mono text-2xl font-bold text-[#1E40AF] tabular-nums">
                  68% Faster Resolution
                </div>
                <h3 className="mt-2 font-display text-lg font-bold text-slate-900">
                  Hybrid RAG Customs Compliance Copilot
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Replaced manual tariff lookups across 45,000 regulatory PDFs with an RBAC-filtered
                  hybrid search + reranking assistant delivering cited answers in under 320ms.
                </p>
              </div>
              <p className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">
                Measured over 6 months post-launch · 97.2% citation faithfulness
              </p>
            </article>

            <article className="rounded-xl border border-slate-200 bg-[#FAFAFC] p-6 flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-500">
                  ML Automation · FinTech Risk Operations
                </div>
                <div className="mt-3 font-mono text-2xl font-bold text-[#1E40AF] tabular-nums">
                  6 Weeks → 4 Hours
                </div>
                <h3 className="mt-2 font-display text-lg font-bold text-slate-900">
                  Automated Drift Detection &amp; Canary MLOps
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Automated feature store pipelines and Kubernetes shadow-to-canary rollouts cut
                  model retraining lead time from six weeks to four hours with zero downtime.
                </p>
              </div>
              <p className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">
                Measured across 14 production scoring models · $420k annual fraud savings
              </p>
            </article>

            <article className="rounded-xl border border-slate-200 bg-[#FAFAFC] p-6 flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-500">
                  Cloud &amp; Software · B2B SaaS Platform
                </div>
                <div className="mt-3 font-mono text-2xl font-bold text-[#1E40AF] tabular-nums">
                  -34% Cloud Spend
                </div>
                <h3 className="mt-2 font-display text-lg font-bold text-slate-900">
                  Multi-Region Terraform &amp; TypeScript Modernization
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Decomposed a monolithic API using the Strangler Fig pattern and right-sized
                  multi-region Kubernetes pools under automated OPA policy gates.
                </p>
              </div>
              <p className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">
                Measured over Q1–Q3 2026 · Zero customer-facing deployment incidents
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* 4. Featured Technical Insights Preview */}
      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[#1E40AF]">
              Technical Insights Journal
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
              Peer-Reviewed Architecture Guides
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/insights')}
            className="text-sm font-semibold text-[#1E40AF] hover:underline whitespace-nowrap shrink-0"
          >
            Browse all guides →
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {articles.slice(0, 4).map((article) => (
            <article
              key={article.id}
              className="group rounded-xl border border-slate-200 bg-white p-6 hover:border-slate-300 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-[#1E40AF]">{article.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{article.read_time_minutes} min read</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{article.word_count} words</span>
                </div>
                <h3 className="mt-3 font-display text-xl font-bold leading-snug text-slate-900 group-hover:text-[#1E40AF] transition-colors">
                  <a
                    href={`/insights/${article.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(`/insights/${article.slug}`);
                    }}
                  >
                    {article.title}
                  </a>
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-600 line-clamp-3">
                  {article.summary_tldr}
                </p>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
                <span>
                  By {article.author_name} · {article.author_role}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate(`/insights/${article.slug}`)}
                  className="font-semibold text-[#1E40AF] hover:underline whitespace-nowrap shrink-0"
                >
                  Read guide
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10">
          <NewsletterCard />
        </div>
      </section>

      {/* 5. Structured AI-Discoverable FAQ */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <p className="text-xs font-semibold tracking-wide text-[#1E40AF]">
            Common Engineering &amp; Engagement Questions
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900">
            Working With GitStack
          </h2>
          <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
            {HOME_FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={faq.question} className="py-4">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 text-left font-display text-base font-semibold text-slate-900 hover:text-[#1E40AF]"
                  >
                    <span>{faq.question}</span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                    )}
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{faq.answer}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. Interactive Client Lead Capture */}
      <section id="consultation" className="border-t border-slate-200 bg-[#FAFAFC]">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:py-20">
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-semibold tracking-wide text-[#1E40AF]">
              Start an Architecture Conversation
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
              Book a Technical Discovery Call
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Share your system goals, timeline, and constraints. You will speak directly with a
              GitStack principal engineer—not a generic sales script.
            </p>
          </div>
          <InquiryForm defaultService={selectedInquiryService} />
        </div>
      </section>

      <CustomBlocksSection blocks={cms.custom_blocks} onNavigate={onNavigate} />
    </div>
  );
}
