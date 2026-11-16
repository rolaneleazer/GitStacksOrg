import {
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  FileCheck,
  Layers,
  Package,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { AiConciergeDemo } from '../components/demo/AiConciergeDemo.tsx';
import { EInvoicePortalDemo } from '../components/demo/EInvoicePortalDemo.tsx';
import { FlowCrmChaserDemo } from '../components/demo/FlowCrmChaserDemo.tsx';
import { InventorySyncDemo } from '../components/demo/InventorySyncDemo.tsx';
import { applySeoMetadata } from '../lib/seo.ts';

interface DemoPageProps {
  onNavigate: (path: string) => void;
}

export type DemoProductKey = 'inventory_sync' | 'einvoice' | 'ai_concierge' | 'flowcrm';

interface DemoProductMeta {
  key: DemoProductKey;
  title: string;
  shortLabel: string;
  tagline: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

const DEMO_PRODUCTS: DemoProductMeta[] = [
  {
    key: 'inventory_sync',
    title: 'Gitstack Inventory Sync',
    shortLabel: 'Inventory Sync',
    tagline: 'Omnichannel stock deduction & real-time webhook sync across Shopee, Lazada, TikTok & POS',
    badge: 'Retail & E-Commerce',
    icon: Package,
    accentColor: 'text-indigo-600'
  },
  {
    key: 'einvoice',
    title: 'Gitstack E-Invoice',
    shortLabel: 'BIR E-Invoice',
    tagline: 'BIR EIS-compliant electronic invoicing with 12% VAT logic, JWS signatures & JSON payloads',
    badge: 'Fintech & Compliance',
    icon: Receipt,
    accentColor: 'text-blue-600'
  },
  {
    key: 'ai_concierge',
    title: 'Gitstack AI Concierge',
    shortLabel: 'AI Concierge',
    tagline: 'Automated 24/7 customer support, price quote generation & appointment booking for SMEs',
    badge: 'AI Automation',
    icon: Bot,
    accentColor: 'text-teal-600'
  },
  {
    key: 'flowcrm',
    title: 'Gitstack FlowCRM',
    shortLabel: 'FlowCRM & Chaser',
    tagline: 'Client deal pipeline, digital quote builder & automated Viber/SMS overdue invoice chaser',
    badge: 'Revenue Operations',
    icon: TrendingUp,
    accentColor: 'text-violet-600'
  }
];

export function DemoPage({ onNavigate }: DemoPageProps) {
  // Determine initial tab from URL hash or search param if present
  const getInitialTab = (): DemoProductKey => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      const matched = DEMO_PRODUCTS.find((p) => p.key === hash);
      if (matched) return matched.key;

      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'invoice' || tabParam === 'einvoice') return 'einvoice';
      if (tabParam === 'concierge' || tabParam === 'ai') return 'ai_concierge';
      if (tabParam === 'crm' || tabParam === 'flowcrm') return 'flowcrm';
      if (tabParam === 'inventory' || tabParam === 'sync') return 'inventory_sync';
    }
    return 'inventory_sync';
  };

  const [activeProduct, setActiveProduct] = useState<DemoProductKey>(getInitialTab);

  useEffect(() => {
    applySeoMetadata({
      title: 'Interactive B2B SaaS Product Demos | GitStack',
      description:
        'Test-drive 4 turnkey SME software systems engineered by GitStack: Omnichannel Inventory Sync, BIR EIS E-Invoicing, AI Concierge Lead Gen, and FlowCRM with Automated Invoice Chaser.',
      path: '/demo'
    });
  }, []);

  const handleSelectProduct = (key: DemoProductKey) => {
    setActiveProduct(key);
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState(null, '', `/demo#${key}`);
    }
  };

  const handleCtaClick = (serviceTitle: string) => {
    onNavigate(`/contact?service=${encodeURIComponent(serviceTitle)}`);
  };

  const activeProductMeta = DEMO_PRODUCTS.find((p) => p.key === activeProduct) || DEMO_PRODUCTS[0];

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      {/* 1. HERO HEADER */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 lg:p-10 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/70 px-3 py-1 text-xs font-semibold text-[var(--gs-primary)]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Interactive Production Demos · 100% Client-Side Sandbox</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-block h-2 w-2 rounded-full bg-[#16A34A]" />
            <span>Zero Sign-In Friction · Instant 1-Click Evaluation</span>
          </div>
        </div>

        <div className="max-w-3xl space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">
            Experience GitStack’s Turnkey B2B SaaS Systems in Action
          </h1>
          <p className="text-sm sm:text-base leading-relaxed text-slate-600">
            Test-drive the exact production workflows we deploy for fast-growing Philippine and global
            enterprises. Each sandbox is pre-loaded with realistic SME business scenarios, real-time
            calculations, simulated order webhooks, and digital signing logic.
          </p>
        </div>

        {/* 2. MASTER PRODUCT TAB SWITCHER */}
        <div className="pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {DEMO_PRODUCTS.map((prod) => {
              const Icon = prod.icon;
              const active = activeProduct === prod.key;

              return (
                <button
                  key={prod.key}
                  type="button"
                  onClick={() => handleSelectProduct(prod.key)}
                  className={`min-h-[72px] text-left rounded-xl p-3.5 border transition-all flex items-start gap-3 ${
                    active
                      ? 'border-[var(--gs-primary)] bg-indigo-50/40 shadow-sm ring-1 ring-[var(--gs-primary)]'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                  }`}
                >
                  <div
                    className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                      active
                        ? 'bg-[var(--gs-primary)] text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display text-xs font-bold text-slate-900 truncate">
                        {prod.shortLabel}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {prod.badge}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. ACTIVE PRODUCT SANDBOX CONTAINER */}
      <div>
        {activeProduct === 'inventory_sync' && (
          <InventorySyncDemo onCtaClick={handleCtaClick} />
        )}
        {activeProduct === 'einvoice' && (
          <EInvoicePortalDemo onCtaClick={handleCtaClick} />
        )}
        {activeProduct === 'ai_concierge' && (
          <AiConciergeDemo onCtaClick={handleCtaClick} />
        )}
        {activeProduct === 'flowcrm' && (
          <FlowCrmChaserDemo onCtaClick={handleCtaClick} />
        )}
      </div>

      {/* 4. PRODUCTION ARCHITECTURE & COMMERCIAL DEPLOYMENT FOOTER */}
      <div className="rounded-2xl border border-slate-200 bg-slate-900 text-white p-6 sm:p-8 lg:p-10 shadow-md">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-mono font-semibold text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Production Infrastructure &amp; Commercial SLAs</span>
            </div>

            <h2 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
              Ready to Deploy These Systems in Your Company?
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              Every sandbox on this page is an extract of our battle-tested enterprise architectures.
              We deploy full-stack implementations tailored to your exact business operations—complete
              with dedicated AWS infrastructure, high-concurrency PostgreSQL databases, live ERP
              synchronization, and 24/7 engineering monitoring.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs text-slate-300 font-mono">
              <div className="rounded-lg border border-slate-800 bg-slate-800/60 p-3">
                <div className="text-white font-bold">14-Day Delivery</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Rapid production sprint rollout</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-800/60 p-3">
                <div className="text-white font-bold">100% IP Ownership</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Source code &amp; keys transferred</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-800/60 p-3">
                <div className="text-white font-bold">99.9% Uptime SLA</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Guaranteed enterprise support</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => onNavigate(`/contact?service=${encodeURIComponent(activeProductMeta.title)}`)}
              className="min-h-[46px] w-full rounded-xl bg-[var(--gs-primary)] px-5 py-3 text-xs sm:text-sm font-bold text-white hover:bg-[var(--gs-primary-hover)] flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <span>Get {activeProductMeta.shortLabel} for Your Business</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/services')}
              className="min-h-[46px] w-full rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-3 text-xs sm:text-sm font-semibold text-slate-200 hover:bg-slate-700 hover:text-white flex items-center justify-center gap-2 transition-all"
            >
              <span>Compare Engineering Specs on Services</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
