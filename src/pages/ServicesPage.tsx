import { ArrowRight, Check } from 'lucide-react';
import { useEffect } from 'react';
import { CustomBlocksSection } from '../components/CustomBlocksSection.tsx';
import { InquiryForm } from '../components/InquiryForm.tsx';
import { ResilientImage } from '../components/ResilientImage.tsx';
import { applySeoMetadata } from '../lib/seo.ts';
import { DEFAULT_PAGE_CONTENTS } from '../shared/pageDefaults.ts';
import type { PageContentConfig } from '../shared/types.ts';

const SERVICE_MATRIX = [
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
      title: 'Services — AI Integration, ML Automation, Cloud & Software | GitStack',
      description:
        'Explore GitStack services: AI Integration, Machine Learning Automation, Custom Software Development, Cloud Infrastructure Management, and Technical Consulting.',
      path: '/services',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'GitStack Engineering Services',
        url: `${origin}/services`,
        itemListElement: SERVICE_MATRIX.map((svc, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Service',
            name: svc.name,
            description: svc.outcomes.join(' '),
            provider: { '@type': 'Organization', name: 'GitStack' }
          }
        }))
      }
    });
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-14 lg:py-20">
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="text-xs font-semibold tracking-wide text-[#1E40AF]">
            {cms.hero_kicker}
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-900">
            {cms.hero_title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            {cms.hero_subtitle}
          </p>
        </div>
        {cms.hero_image && (
          <div className="lg:col-span-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 aspect-[16/10]">
            <ResilientImage
              src={cms.hero_image}
              alt={cms.hero_image_alt || cms.hero_title}
              className="h-full w-full object-cover"
              fallbackTitle="GitStack Services"
            />
          </div>
        )}
      </div>

      <div className="mt-12 space-y-6">
        {SERVICE_MATRIX.map((svc) => (
          <section
            key={svc.code}
            className="rounded-xl border border-slate-200 bg-white p-8 grid grid-cols-1 gap-8 lg:grid-cols-12"
          >
            <div className="lg:col-span-5">
              <div className="font-mono text-xs font-medium text-[#1E40AF]">
                Practice {svc.code}
              </div>
              <h2 className="mt-2 font-display text-2xl font-bold text-slate-900">{svc.name}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                <span className="font-semibold text-slate-800">Best suited for:</span>{' '}
                {svc.audience}
              </p>
              <div className="mt-6">
                <a
                  href="#services-inquiry"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E40AF] hover:underline"
                >
                  <span>Scope this capability</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
            <div className="lg:col-span-7 border-t border-slate-200 pt-6 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
              <h3 className="text-xs font-semibold text-slate-900">Deliverables &amp; Architecture</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-700">
                {svc.outcomes.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1E40AF]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-900 hover:bg-slate-100 whitespace-nowrap shrink-0"
        >
          Explore Technical Insights
        </button>
      </div>

      <div id="services-inquiry" className="mt-14">
        <h2 className="mb-6 font-display text-2xl font-bold text-slate-900">
          {cms.hero_cta_label || 'Request a Technical Proposal'}
        </h2>
        <InquiryForm />
      </div>

      <div className="mt-12 -mx-6">
        <CustomBlocksSection blocks={cms.custom_blocks} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
