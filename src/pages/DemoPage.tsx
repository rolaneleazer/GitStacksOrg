import {
  AlertCircle,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  FileCheck,
  Globe,
  Headphones,
  Layers,
  Lock,
  LogOut,
  Mail,
  Package,
  Phone,
  Receipt,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  Zap
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { AiConciergeDemo } from '../components/demo/AiConciergeDemo.tsx';
import { DemoBackOfficeShowcase } from '../components/demo/DemoBackOfficeShowcase.tsx';
import { EInvoicePortalDemo } from '../components/demo/EInvoicePortalDemo.tsx';
import { FlowCrmChaserDemo } from '../components/demo/FlowCrmChaserDemo.tsx';
import { InventorySyncDemo } from '../components/demo/InventorySyncDemo.tsx';
import {
  DemoExpiredError,
  api,
  getStoredDemoToken,
  setStoredDemoToken
} from '../lib/api.ts';
import { applySeoMetadata } from '../lib/seo.ts';
import type { PublicDemoUser } from '../shared/types.ts';

interface DemoPageProps {
  onNavigate: (path: string) => void;
}

export type DemoProductKey =
  | 'inventory_sync'
  | 'einvoice'
  | 'ai_concierge'
  | 'flowcrm'
  | 'back_office';

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
  },
  {
    key: 'back_office',
    title: 'GitStack Back Office OS',
    shortLabel: 'Back Office OS',
    tagline:
      'Clickable 27-module Operations, SEO, Social, CRM, Analytics & AI Agent Command Center (mock read-only simulation)',
    badge: 'SaaS Operations OS',
    icon: Layers,
    accentColor: 'text-emerald-600'
  }
];

function calculateRemainingTime(expiresAt?: string): {
  isExpired: boolean;
  hours: number;
  minutes: number;
  seconds: number;
  label: string;
} {
  if (!expiresAt) {
    return { isExpired: false, hours: 24, minutes: 0, seconds: 0, label: '24h 00m' };
  }
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) {
    return { isExpired: true, hours: 0, minutes: 0, seconds: 0, label: 'Expired' };
  }
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return {
    isExpired: false,
    hours,
    minutes,
    seconds,
    label: `${hours}h ${String(minutes).padStart(2, '0')}m remaining`
  };
}

export function DemoPage({ onNavigate }: DemoPageProps) {
  // Authentication & 24-Hour Access State
  const [authStatus, setAuthStatus] = useState<'loading' | 'unauthenticated' | 'authenticated' | 'expired'>('loading');
  const [currentUser, setCurrentUser] = useState<PublicDemoUser | null>(null);
  const [remainingTime, setRemainingTime] = useState<{
    isExpired: boolean;
    hours: number;
    minutes: number;
    seconds: number;
    label: string;
  }>({ isExpired: false, hours: 24, minutes: 0, seconds: 0, label: '24h' });

  // Form states for the mandatory gatekeeper
  const [authTab, setAuthTab] = useState<'signup' | 'signin'>('signup');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('GitStackDemo2026!');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active product sandbox tab
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
      if (tabParam === 'backoffice' || tabParam === 'back_office') return 'back_office';
    }
    return 'inventory_sync';
  };

  const [activeProduct, setActiveProduct] = useState<DemoProductKey>(getInitialTab);
  const [demoResetKey, setDemoResetKey] = useState(0);

  useEffect(() => {
    applySeoMetadata({
      title: 'Interactive B2B SaaS Product Demos | GitStack',
      description:
        'Test-drive 5 turnkey SME software systems engineered by GitStack: Omnichannel Inventory Sync, BIR EIS E-Invoicing, AI Concierge Lead Gen, FlowCRM with Automated Invoice Chaser, and Back Office OS. Requires 24-hour business evaluation pass.',
      path: '/demo'
    });
  }, []);

  // Validate session on mount
  useEffect(() => {
    let mounted = true;
    const token = getStoredDemoToken();

    if (!token) {
      setAuthStatus('unauthenticated');
      return;
    }

    api
      .getDemoMe()
      .then((user) => {
        if (!mounted) return;
        if (!user || typeof user !== 'object') {
          setAuthStatus('unauthenticated');
          return;
        }

        const rem = calculateRemainingTime(user?.expires_at);
        if (rem.isExpired) {
          setAuthStatus('expired');
          setCurrentUser(user);
        } else {
          setCurrentUser(user);
          setRemainingTime(rem);
          setAuthStatus('authenticated');
        }
      })
      .catch((err) => {
        if (!mounted) return;
        if (err instanceof DemoExpiredError || (err instanceof Error && err.message.includes('expired'))) {
          setAuthStatus('expired');
        } else {
          setAuthStatus('unauthenticated');
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // 10-second countdown ticker for authenticated users
  useEffect(() => {
    if (authStatus !== 'authenticated' || !currentUser?.expires_at) return;

    const tick = () => {
      const rem = calculateRemainingTime(currentUser?.expires_at);
      setRemainingTime(rem);
      if (rem.isExpired) {
        setAuthStatus('expired');
      }
    };

    tick();
    const timer = setInterval(tick, 10000);
    return () => clearInterval(timer);
  }, [authStatus, currentUser?.expires_at]);

  const handleSelectProduct = (key: DemoProductKey) => {
    setActiveProduct(key);
    api.trackDemoActivity({
      module: key,
      actionLabel: `Viewed ${key} Interactive Sandbox`
    }).catch(() => {});
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState(null, '', `/demo#${key}`);
    }
  };

  const handleCtaClick = (serviceTitle: string) => {
    api.trackDemoActivity({
      module: activeProduct,
      actionLabel: `Clicked CTA for ${serviceTitle}`,
      convertedInquiry: true
    }).catch(() => {});
    onNavigate(`/contact?service=${encodeURIComponent(serviceTitle)}&source=demo_cta`);
  };

  const handleResetSandbox = () => {
    setDemoResetKey((k) => k + 1);
    api.trackDemoActivity({
      module: activeProduct,
      actionLabel: 'Reset sandbox data'
    }).catch(() => {});
  };

  const handleLogout = () => {
    setStoredDemoToken(null);
    setCurrentUser(null);
    setAuthStatus('unauthenticated');
    setAuthError(null);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (authTab === 'signup') {
        if (!fullName.trim() || !company.trim() || !workEmail.trim()) {
          throw new Error('Please fill in your full name, company, and work email.');
        }
        if (!phone.trim() || phone.trim().length < 5) {
          throw new Error('Please provide a valid phone/mobile number (at least 5 characters).');
        }
        if (!password || password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }

        const res = await api.registerDemoUser({
          full_name: fullName.trim(),
          email: workEmail.trim().toLowerCase(),
          company: company.trim(),
          phone: phone.trim(),
          password: password.trim()
        });

        const user = res?.user ?? null;
        if (!user) {
          throw new Error('Registration succeeded, but evaluation session details were missing. Please sign in.');
        }
        setCurrentUser(user);
        const rem = calculateRemainingTime(user?.expires_at);
        if (rem.isExpired) {
          setAuthStatus('expired');
        } else {
          setRemainingTime(rem);
          setAuthStatus('authenticated');
        }
      } else {
        if (!workEmail.trim() || !password) {
          throw new Error('Please enter both your work email and password.');
        }

        const res = await api.loginDemoUser({
          email: workEmail.trim().toLowerCase(),
          password: password.trim()
        });

        const user = res?.user ?? null;
        if (!user) {
          throw new Error('Unable to load your evaluation profile. Please try again.');
        }
        setCurrentUser(user);
        const rem = calculateRemainingTime(user?.expires_at);
        if (rem.isExpired) {
          setAuthStatus('expired');
        } else {
          setRemainingTime(rem);
          setAuthStatus('authenticated');
        }
      }
    } catch (err) {
      if (err instanceof DemoExpiredError || (err instanceof Error && err.message.includes('expired'))) {
        setAuthStatus('expired');
      } else {
        setAuthError(err instanceof Error ? err.message : 'Authentication failed. Please verify your details.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const activeProductMeta = DEMO_PRODUCTS.find((p) => p.key === activeProduct) ?? DEMO_PRODUCTS[0];

  // ==========================================
  // VIEW 1: LOADING SPINNER
  // ==========================================
  if (authStatus === 'loading') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center space-y-4">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-[var(--gs-primary)] animate-pulse">
          <Clock className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Verifying 24-Hour Evaluation Sandbox Pass...</h2>
        <p className="text-xs text-slate-500">Checking enterprise access token and trial limits</p>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: EXPIRED LOCKOUT PAYWALL (BUY SERVICES)
  // ==========================================
  if (authStatus === 'expired') {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12 sm:py-16 space-y-8">
        <div className="overflow-hidden rounded-3xl border border-red-200/80 bg-white shadow-xl">
          {/* Top Lockout Header */}
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 px-6 sm:px-10 py-8 text-white space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-xs">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-200" />
              <span>24-Hour Evaluation Period Concluded</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
              Your 24-Hour Live Demo Evaluation Has Expired
            </h1>
            <p className="text-sm sm:text-base text-red-100 max-w-2xl leading-relaxed">
              Sandbox access is limited to a strict 24-hour evaluation window. Your trial pass has
              ended, and access to this account’s interactive demo environment is now locked.
            </p>
          </div>

          {/* Value Pitch & Purchase Services Section */}
          <div className="p-6 sm:p-10 space-y-8">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 sm:p-6 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
                <Sparkles className="h-4 w-4 text-amber-700" />
                <span>Ready to Deploy This Architecture in Your Company?</span>
              </div>
              <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
                To continue using these systems or deploy custom instances for your operations, hire
                GitStack software engineering services. We engineer, integrate, and host production-grade
                software tailored directly to your enterprise workflows.
              </p>
            </div>

            {/* What you get when you hire GitStack */}
            <div className="space-y-4">
              <h3 className="font-display text-sm font-bold tracking-wide uppercase text-slate-700">
                Enterprise Engineering Services &amp; Deliverables
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Dedicated Cloud Deployment</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Hosted in your private AWS, GCP, or Azure VPC with automated Terraform IaC and 99.9% uptime SLAs.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Omnichannel &amp; BIR EIS Integrations</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Live Shopee, Lazada, TikTok Shop, POS, and certified BIR EIS tax transmission webhooks.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>100% IP &amp; Source Code Ownership</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Full intellectual property transfer with complete Git repositories, Dockerfiles, and API docs.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Principal Senior Engineers</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Direct access to senior software architects (13+ years experience) with dedicated weekly delivery sprints.
                  </p>
                </div>
              </div>
            </div>

            {/* High-Impact Action CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  onNavigate(
                    '/contact?service=Enterprise%20System%20Deployment&source=demo_expired_lockout'
                  )
                }
                className="flex-1 min-h-[48px] rounded-xl bg-[var(--gs-primary)] px-6 py-3.5 text-xs sm:text-sm font-bold text-white hover:bg-[var(--gs-primary-hover)] transition-all shadow-md flex items-center justify-center gap-2 text-center"
              >
                <span>Hire GitStack / Book Architecture Consultation</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('/services')}
                className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-center"
              >
                <span>View Services &amp; Packages</span>
              </button>
            </div>

            {/* Account Switcher Footer */}
            <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-slate-400" />
                <span>Need to evaluate with another corporate email?</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="font-medium text-[var(--gs-primary)] hover:underline"
              >
                Sign out or register new account →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: MANDATORY SIGN UP & LOGIN GATEKEEPER
  // ==========================================
  if (authStatus === 'unauthenticated') {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-16 space-y-10">
        {/* Header Pitch */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-3.5 py-1 text-xs font-semibold text-[var(--gs-primary)] shadow-2xs">
            <Lock className="h-3.5 w-3.5" />
            <span>Mandatory Evaluation Access Gatekeeper · 24-Hour Limit</span>
          </div>

          <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Sign Up to Access GitStack’s Live Product Demos
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Interactive sandbox environments are reserved for business evaluators. Create your
            corporate evaluation account to receive a <strong>24-hour evaluation pass</strong> to test-drive
            all 5 turnkey enterprise systems.
          </p>
        </div>

        {/* 5 Systems Preview Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {DEMO_PRODUCTS.map((prod) => {
            const Icon = prod.icon;
            return (
              <div
                key={prod.key}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2 hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-lg bg-indigo-50 text-[var(--gs-primary)] flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {prod.badge}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-xs">{prod.shortLabel}</h3>
                <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                  {prod.tagline}
                </p>
              </div>
            );
          })}
        </div>

        {/* Auth Box */}
        <div className="max-w-lg mx-auto rounded-3xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-slate-200 bg-slate-50/60 p-1.5">
            <button
              type="button"
              onClick={() => {
                setAuthTab('signup');
                setAuthError(null);
              }}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all ${
                authTab === 'signup'
                  ? 'bg-white text-[var(--gs-primary)] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign Up for 24-Hour Pass
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthTab('signin');
                setAuthError(null);
              }}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all ${
                authTab === 'signin'
                  ? 'bg-white text-[var(--gs-primary)] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In to Existing Pass
            </button>
          </div>

          <div className="p-6 sm:p-8 space-y-5">
            <div className="space-y-1">
              <h2 className="font-bold text-slate-900 text-base">
                {authTab === 'signup'
                  ? 'Register Your 24-Hour Evaluation Sandbox'
                  : 'Resume Your Evaluation Session'}
              </h2>
              <p className="text-xs text-slate-500">
                {authTab === 'signup'
                  ? 'Access expires exactly 24 hours from creation. Valid work details required.'
                  : 'Enter your registered corporate email to resume your 24-hour sandbox.'}
              </p>
            </div>

            {authError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              {authTab === 'signup' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Alex Rivera"
                        className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[var(--gs-primary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--gs-primary)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Company / Organization <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="e.g. Apex Retail Group"
                        className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[var(--gs-primary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--gs-primary)]"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Work Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={workEmail}
                    onChange={(e) => setWorkEmail(e.target.value)}
                    placeholder="alex@apexretail.ph"
                    className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[var(--gs-primary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--gs-primary)]"
                  />
                </div>
              </div>

              {authTab === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile / Phone / WhatsApp / Viber <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+63 917 123 4567"
                      className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[var(--gs-primary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--gs-primary)]"
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Required for simulated Viber/SMS payment reminder chaser workflows.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[var(--gs-primary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--gs-primary)] font-mono"
                  />
                </div>
              </div>

              {/* 24-Hour Notice Box */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-slate-600 flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-[var(--gs-primary)] shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong>Strict 24-Hour Window:</strong> Your sandbox is provisioned for exactly 24
                  hours. Once expired, you will need to purchase GitStack engineering services to deploy or
                  license these software systems for your business.
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full min-h-[44px] rounded-xl bg-[var(--gs-primary)] px-5 py-2.5 text-xs font-bold text-white hover:bg-[var(--gs-primary-hover)] transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <span>Processing...</span>
                ) : authTab === 'signup' ? (
                  <>
                    <span>Create Account &amp; Unlock 24h Sandbox</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    <span>Sign In &amp; Resume Sandbox</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 4: AUTHENTICATED ACTIVE SANDBOX (24-HOUR TIMER RUNNING)
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Active 24-Hour Sandbox Navigation Bar */}
      <div className="sticky top-16 z-30 border-b border-indigo-100 bg-white/95 backdrop-blur-md px-4 sm:px-6 py-2.5 shadow-xs">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left: User badge & live countdown */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>Active 24h Evaluation Pass</span>
            </span>

            <span className="inline-flex items-center gap-1.5 font-mono font-bold text-slate-800 bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 rounded-lg">
              <Clock className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
              <span>{remainingTime.label}</span>
            </span>

            {currentUser && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-slate-600">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                <strong>{currentUser.full_name}</strong> · {currentUser.company}
              </span>
            )}
          </div>

          {/* Right: Reset, Hire Us, and Exit actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleResetSandbox}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 transition-colors"
              title="Reset sample data back to initial defaults"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset Data</span>
            </button>

            <button
              type="button"
              onClick={() => handleCtaClick(activeProductMeta.title)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-1 text-xs font-bold text-white hover:bg-[var(--gs-primary-hover)] transition-colors shadow-2xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Hire GitStack / Buy Services</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-50 transition-colors"
              title="Sign out of evaluation pass"
            >
              <LogOut className="h-3 w-3" />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-2 sm:py-4 space-y-8">
        {/* 1. HERO HEADER */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 lg:p-10 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/70 px-3 py-1 text-xs font-semibold text-[var(--gs-primary)]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Interactive Production Demos · 100% Client-Side Sandbox</span>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>24-Hour Active Sandbox Verified</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
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
        <div key={demoResetKey}>
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
          {activeProduct === 'back_office' && (
            <DemoBackOfficeShowcase onCtaClick={handleCtaClick} />
          )}
        </div>

        {/* 4. COMMERCIAL DEPLOYMENT FOOTER */}
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
                onClick={() =>
                  onNavigate(`/contact?service=${encodeURIComponent(activeProductMeta.title)}&source=demo_footer`)
                }
                className="min-h-[46px] w-full rounded-xl bg-[var(--gs-primary)] px-5 py-3 text-xs sm:text-sm font-bold text-white hover:bg-[var(--gs-primary-hover)] flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <span>Hire GitStack for {activeProductMeta.shortLabel}</span>
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
    </div>
  );
}
