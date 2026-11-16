import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Database,
  Globe,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  X
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { InquiryForm } from '../components/InquiryForm.tsx';
import {
  api,
  DemoExpiredError,
  getStoredDemoToken,
  setStoredDemoToken
} from '../lib/api.ts';
import { applySeoMetadata } from '../lib/seo.ts';
import {
  createInitialDemoAgents,
  createInitialDemoLeads,
  createInitialDemoLogs,
  createInitialDemoTasks,
  DEMO_DISCOVERY_ITEMS,
  simulateDemoAiResearch,
  type DemoDiscoveryItem
} from '../shared/demoSandboxData.ts';
import type {
  AgentReport,
  AgentTask,
  CrmLead,
  CrmLeadStage,
  CrmOutreachLog,
  EmailVerificationStatus,
  LeadSourceType,
  PublicDemoUser,
  ServiceCategory
} from '../shared/types.ts';

interface DemoPageProps {
  onNavigate: (path: string) => void;
}

type DemoTab = 'crm' | 'agents' | 'discover' | 'sources';

const STAGES: { id: CrmLeadStage; label: string }[] = [
  { id: 'discovered', label: 'Discovered' },
  { id: 'researched', label: 'Researched' },
  { id: 'proposed', label: 'Proposed' },
  { id: 'follow_up', label: 'Follow-Up' },
  { id: 'won', label: 'Won' }
];

const SOURCE_LABELS: Record<LeadSourceType, string> = {
  github: 'GitHub Open-Source',
  apollo: 'Apollo.io',
  google_maps: 'Google Maps Places',
  hacker_news: 'Hacker News Hiring',
  ycombinator: 'Y Combinator',
  csv_import: 'CSV Upload',
  website: 'Web Scraper',
  gemini_search: 'AI Search',
  demo_signup: 'Live Demo Signups',
  manual: 'Manual Entry'
};

const EMAIL_STATUS_META: Record<EmailVerificationStatus, { text: string; tone: string }> = {
  verified_mx: { text: 'MX Verified', tone: 'text-[#16A34A]' },
  public_found: { text: 'Public Found', tone: 'text-sky-700' },
  inferred: { text: 'Inferred', tone: 'text-amber-700' },
  invalid: { text: 'Unverified', tone: 'text-slate-500' }
};

export function DemoPage({ onNavigate }: DemoPageProps) {
  // Demo Visitor Authentication State (isolated from Admin Back Office auth)
  const [authChecked, setAuthChecked] = useState(false);
  const [demoUser, setDemoUser] = useState<PublicDemoUser | null>(null);
  const [demoExpiredInfo, setDemoExpiredInfo] = useState<{
    message: string;
    expiresAt?: string;
    email?: string;
    company?: string;
  } | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [activeTab, setActiveTab] = useState<DemoTab>('crm');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Isolated browser sandbox state (never touches live Back Office DB or secrets)
  const [leads, setLeads] = useState<CrmLead[]>(createInitialDemoLeads);
  const [logs, setLogs] = useState<CrmOutreachLog[]>(createInitialDemoLogs);
  const [agents, setAgents] = useState<AgentReport[]>(createInitialDemoAgents);
  const [tasks, setTasks] = useState<AgentTask[]>(createInitialDemoTasks);
  const [exploredModules, setExploredModules] = useState<Set<string>>(
    () => new Set(['CRM Pipeline'])
  );

  // CRM controls
  const [crmViewMode, setCrmViewMode] = useState<'directory' | 'pipeline'>('directory');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | LeadSourceType>('all');
  const [filterStage, setFilterStage] = useState<'all' | CrmLeadStage>('all');
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [researchingId, setResearchingId] = useState<string | null>(null);
  const [sendModalLead, setSendModalLead] = useState<CrmLead | null>(null);
  const [sendSubject, setSendSubject] = useState('');
  const [sendBody, setSendBody] = useState('');

  // Agents controls
  const [auditingAgents, setAuditingAgents] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Discovery controls
  const [discoveryCategory, setDiscoveryCategory] = useState<
    'all' | 'google_maps' | 'github' | 'hacker_news'
  >('all');
  const [discoveryFilter, setDiscoveryFilter] = useState('');

  // Notice & Real Conversion Modal
  const [notice, setNotice] = useState<string | null>(null);
  const [conversionOpen, setConversionOpen] = useState(false);
  const [conversionService, setConversionService] = useState<ServiceCategory>('AI Integration');

  useEffect(() => {
    applySeoMetadata({
      title: 'Interactive Platform Demo | GitStack',
      description:
        'Test-drive GitStack’s Apollo-style B2B CRM, multi-source lead discovery, and 7 autonomous AI engineering agents inside a safe browser sandbox.',
      path: '/demo'
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const token = getStoredDemoToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    api
      .getDemoMe()
      .then((user) => {
        if (!active) return;
        if (user?.is_expired) {
          setStoredDemoToken(null);
          setDemoUser(null);
          setDemoExpiredInfo({
            message:
              'Your 24-hour Live Demo evaluation pass has expired. Contact our team or explore our services to purchase a package.',
            expiresAt: user.expires_at,
            email: user.email,
            company: user.company
          });
          return;
        }
        setDemoUser(user);
      })
      .catch((err) => {
        if (!active) return;
        setStoredDemoToken(null);
        setDemoUser(null);
        if (err instanceof DemoExpiredError) {
          setDemoExpiredInfo({
            message: err.message,
            expiresAt: err.expiresAt
          });
        }
      })
      .finally(() => {
        if (active) setAuthChecked(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const recordTelemetry = useCallback(
    (moduleLabel: string, actionLabel: string, convertedInquiry = false) => {
      if (!getStoredDemoToken()) return;
      api
        .trackDemoActivity({
          module: moduleLabel,
          actionLabel,
          convertedInquiry
        })
        .then((user) => {
          if (user) setDemoUser(user);
        })
        .catch((err) => {
          if (err instanceof DemoExpiredError) {
            setDemoUser(null);
            setDemoExpiredInfo({
              message: err.message,
              expiresAt: err.expiresAt
            });
          }
        });
    },
    []
  );

  const handleRegisterDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (
      !regFullName.trim() ||
      !regEmail.trim() ||
      !regCompany.trim() ||
      !regPhone.trim() ||
      regPassword.length < 6
    ) {
      setAuthError(
        'Please complete Full Name, Work Email, Company, Phone, and a Password (min 6 characters).'
      );
      return;
    }
    setAuthSubmitting(true);
    try {
      const res = await api.registerDemoUser({
        full_name: regFullName.trim(),
        email: regEmail.trim(),
        company: regCompany.trim(),
        phone: regPhone.trim(),
        password: regPassword
      });
      setStoredDemoToken(res.token);
      setDemoExpiredInfo(null);
      setDemoUser(res.user);
      setNotice(
        `Welcome to the GitStack Live Demo, ${res.user.full_name}. Your 24-hour sandbox pass is active.`
      );
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to create your demo account.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLoginDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!loginEmail.trim() || !loginPassword) {
      setAuthError('Enter your registered email and password.');
      return;
    }
    setAuthSubmitting(true);
    try {
      const res = await api.loginDemoUser({
        email: loginEmail.trim(),
        password: loginPassword
      });
      setStoredDemoToken(res.token);
      setDemoExpiredInfo(null);
      setDemoUser(res.user);
      setNotice(`Signed back in as ${res.user.full_name} (${res.user.company}).`);
    } catch (err) {
      if (err instanceof DemoExpiredError) {
        setDemoUser(null);
        setDemoExpiredInfo({
          message: err.message,
          expiresAt: err.expiresAt,
          email: loginEmail.trim().toLowerCase()
        });
      } else {
        setAuthError(err instanceof Error ? err.message : 'Invalid demo email or password.');
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleDemoSignOut = () => {
    setStoredDemoToken(null);
    setDemoUser(null);
    setDemoExpiredInfo(null);
    setNotice(null);
  };

  const markExplored = (label: string, actionLabel?: string) => {
    setExploredModules((prev) => {
      if (prev.has(label)) return prev;
      const next = new Set(prev);
      next.add(label);
      return next;
    });
    recordTelemetry(label, actionLabel || `Opened ${label}`);
  };

  const handleSelectTab = (tab: DemoTab, label: string) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
    markExplored(label, `Viewed ${label}`);
  };

  const handleResetSandbox = () => {
    setLeads(createInitialDemoLeads());
    setLogs(createInitialDemoLogs());
    setAgents(createInitialDemoAgents());
    setTasks(createInitialDemoTasks());
    setSelectedLead(null);
    setSendModalLead(null);
    setNotice('Sandbox state restored to original sample dataset.');
  };

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return leads.filter((l) => {
      if (filterSource !== 'all' && l.source_type !== filterSource) return false;
      if (filterStage !== 'all' && l.stage !== filterStage) return false;
      if (!q) return true;
      return (
        l.company_name.toLowerCase().includes(q) ||
        l.contact_name.toLowerCase().includes(q) ||
        l.tech_stack.some((t) => t.toLowerCase().includes(q)) ||
        l.recommended_service.toLowerCase().includes(q)
      );
    });
  }, [leads, searchQuery, filterSource, filterStage]);

  const pipelineStats = useMemo(() => {
    const totalValue = leads.reduce((sum, l) => sum + (Number(l.deal_value) || 0), 0);
    const mxCount = leads.filter((l) => l.email_status === 'verified_mx').length;
    const wonCount = leads.filter((l) => l.stage === 'won').length;
    return {
      totalLeads: leads.length,
      totalValue,
      mxPercent: leads.length ? Math.round((mxCount / leads.length) * 100) : 0,
      wonCount
    };
  }, [leads]);

  const sourceBreakdown = useMemo(() => {
    const grouped = new Map<
      LeadSourceType,
      { count: number; value: number; mx: number; won: number }
    >();
    for (const l of leads) {
      const prev = grouped.get(l.source_type) || { count: 0, value: 0, mx: 0, won: 0 };
      prev.count += 1;
      prev.value += Number(l.deal_value) || 0;
      if (l.email_status === 'verified_mx') prev.mx += 1;
      if (l.stage === 'won') prev.won += 1;
      grouped.set(l.source_type, prev);
    }
    return Array.from(grouped.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [leads]);

  const handleStageChange = (leadId: string, nextStage: CrmLeadStage) => {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId ? { ...l, stage: nextStage, updated_at: new Date().toISOString() } : l
      )
    );
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, stage: nextStage } : null));
    }
    setNotice(`Moved sandbox lead to "${nextStage.replace('_', ' ')}" stage.`);
    recordTelemetry('CRM Pipeline', `Moved lead stage to ${nextStage}`);
  };

  const handleRunAiResearch = (lead: CrmLead) => {
    setResearchingId(lead.id);
    markExplored('AI Lead Research & Proposal Draft', `AI Researched ${lead.company_name}`);
    setTimeout(() => {
      const updated = simulateDemoAiResearch(lead);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)));
      if (selectedLead?.id === lead.id) {
        setSelectedLead(updated);
      }
      setResearchingId(null);
      setNotice(
        `Simulated AI Research complete for ${lead.company_name}: drafted proposal and 2 follow-up steps.`
      );
    }, 320);
  };

  const openSendSimulation = (lead: CrmLead) => {
    setSendModalLead(lead);
    setSendSubject(
      lead.proposal_subject || `${lead.recommended_service} Proposal for ${lead.company_name}`
    );
    setSendBody(
      lead.proposal_body ||
        `Hi ${lead.contact_name},\n\nSharing our architecture proposal for ${lead.company_name}.`
    );
  };

  const handleConfirmSimulatedSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendModalLead) return;
    const now = new Date().toISOString();
    const simId = `smtp-sim-${Math.random().toString(36).slice(2, 10)}`;

    const newLog: CrmOutreachLog = {
      id: `demo-log-${Date.now()}`,
      lead_id: sendModalLead.id,
      channel: 'lark_mail',
      recipient_email: sendModalLead.email,
      subject: sendSubject.trim(),
      body: sendBody.trim(),
      provider_message_id: simId,
      status: 'sent',
      error_detail: '',
      step_label: 'Sandbox Proposal Dispatch',
      sent_by: demoUser?.email || 'sandbox-demo@gitstack.io',
      sent_at: now
    };

    setLogs((prev) => [newLog, ...prev]);
    setLeads((prev) =>
      prev.map((l) =>
        l.id === sendModalLead.id
          ? {
              ...l,
              stage: l.stage === 'discovered' || l.stage === 'researched' ? 'proposed' : l.stage,
              last_contacted_at: now,
              updated_at: now
            }
          : l
      )
    );
    markExplored('Approve-to-Send Lark Mail', `Simulated Lark Mail to ${sendModalLead.company_name}`);
    setNotice(
      `Sandbox simulation logged (Lark SMTP SSL · ${simId}). No real email was dispatched.`
    );
    setSendModalLead(null);
  };

  const handleRunAgentAudit = () => {
    setAuditingAgents(true);
    markExplored('7 Autonomous Agents', 'Ran 7-Agent Health Audit');
    setTimeout(() => {
      setAgents((prev) =>
        prev.map((a) => ({
          ...a,
          score: a.id === 'ceo' ? 92 : Math.min(99, a.score + (a.score < 97 ? 1 : 0)),
          status: a.id === 'ceo' ? 'healthy' : a.status
        }))
      );
      setAuditingAgents(false);
      setNotice('Simulated deterministic health audit completed across all 7 GitStack agents.');
    }, 350);
  };

  const handleAddDemoTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const item: AgentTask = {
      id: `demo-task-${Date.now()}`,
      agent_id: 'marketing',
      title: newTaskTitle.trim(),
      priority: 'medium',
      completed: false,
      notes: 'Added in interactive sandbox.',
      updated_at: new Date().toISOString()
    };
    setTasks((prev) => [item, ...prev]);
    setNewTaskTitle('');
  };

  const handleImportDiscoveryCandidate = (item: DemoDiscoveryItem) => {
    const c = item.candidate;
    const exists = leads.some(
      (l) =>
        (c.company_domain && l.company_domain === c.company_domain) ||
        (c.email && l.email.toLowerCase() === c.email.toLowerCase())
    );
    if (exists) {
      setNotice(`${c.company_name} is already in your sandbox CRM pipeline.`);
      return;
    }
    const now = new Date().toISOString();
    const newLead: CrmLead = {
      id: `demo-lead-${Date.now()}`,
      contact_name: c.contact_name,
      role_title: c.role_title,
      email: c.email,
      email_status: c.email_status,
      company_name: c.company_name,
      company_domain: c.company_domain,
      website_url: c.website_url,
      github_url: c.github_url,
      phone: c.phone || '',
      location: c.location || '',
      rating: c.rating ?? null,
      source_detail: c.source_detail,
      source_type: c.source_type,
      source_urls: c.source_urls,
      tech_stack: c.tech_stack,
      research_brief: c.snippet,
      recommended_service:
        c.source_type === 'google_maps'
          ? 'AI Integration'
          : c.source_type === 'github'
            ? 'Cloud Infrastructure'
            : 'Custom Software',
      fit_score: c.fit_score,
      deal_value: 46000,
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
    setLeads((prev) => [newLead, ...prev]);
    markExplored('Multi-Source & Maps Discovery', `Imported ${c.company_name} in Sandbox`);
    setNotice(`Imported ${c.company_name} into your sandbox CRM pipeline.`);
  };

  const visibleDiscoveryItems = useMemo(() => {
    const q = discoveryFilter.trim().toLowerCase();
    return DEMO_DISCOVERY_ITEMS.filter((item) => {
      if (discoveryCategory !== 'all' && item.category !== discoveryCategory) return false;
      if (!q) return true;
      return (
        item.candidate.company_name.toLowerCase().includes(q) ||
        item.candidate.snippet.toLowerCase().includes(q) ||
        (item.candidate.location || '').toLowerCase().includes(q) ||
        item.candidate.tech_stack.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [discoveryCategory, discoveryFilter]);

  const conversionBrief = useMemo(() => {
    const exploredList = Array.from(exploredModules).join(', ');
    return `Interested in deploying a custom GitStack platform similar to the interactive demo (${exploredList}). Please share architecture recommendations and sprint pricing.`;
  }, [exploredModules]);

  const openRealInquiry = (service: ServiceCategory = 'AI Integration') => {
    setConversionService(service);
    setConversionOpen(true);
  };

  const navItems: {
    id: DemoTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }[] = [
    { id: 'crm', label: 'CRM & Pipeline', icon: Briefcase, count: leads.length },
    { id: 'agents', label: '7 Autonomous Agents', icon: Bot, count: agents.length },
    {
      id: 'discover',
      label: 'Discovery & Map Finder',
      icon: MapPin,
      count: DEMO_DISCOVERY_ITEMS.length
    },
    { id: 'sources', label: 'Attribution & Audit Logs', icon: Database, count: logs.length }
  ];

  const activeNav = navItems.find((n) => n.id === activeTab) || navItems[0];

  const demoPassTiming = useMemo(() => {
    if (!demoUser) return { expired: false, label: '' };
    const expiresIso =
      demoUser.expires_at ||
      new Date(new Date(demoUser.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString();
    const remainingMs = new Date(expiresIso).getTime() - nowMs;
    if (demoUser.is_expired || remainingMs <= 0) {
      return { expired: true, label: '24h Pass Expired' };
    }
    const hrs = Math.floor(remainingMs / 3_600_000);
    const mins = Math.floor((remainingMs % 3_600_000) / 60_000);
    return { expired: false, label: `${hrs}h ${mins}m remaining (24h pass)` };
  }, [demoUser, nowMs]);

  if (!authChecked) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-xs text-slate-500">
        Verifying your GitStack Live Demo session...
      </div>
    );
  }

  if (demoExpiredInfo || (demoUser && demoPassTiming.expired)) {
    const expiredMessage =
      demoExpiredInfo?.message ||
      'Your 24-hour Live Demo evaluation pass has ended. Reach out to our team or select an engineering package to launch GitStack for your business.';
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12 sm:py-20">
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-10 text-center space-y-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-[#D97706]">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <div className="font-mono text-xs font-semibold uppercase tracking-wide text-[#D97706]">
              24-Hour Evaluation Pass Ended
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Your 24-Hour Live Demo Access Has Expired
            </h1>
            <p className="mx-auto max-w-lg text-sm leading-relaxed text-slate-600">
              {expiredMessage}
            </p>
            {(demoExpiredInfo?.email || demoUser?.email) && (
              <p className="font-mono text-xs text-slate-500">
                Account: {demoExpiredInfo?.email || demoUser?.email}
                {(demoExpiredInfo?.company || demoUser?.company) &&
                  ` · ${demoExpiredInfo?.company || demoUser?.company}`}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-xs text-slate-600 space-y-1.5">
            <div className="font-semibold text-slate-900">Ready to deploy GitStack in production?</div>
            <p className="leading-relaxed">
              Our engineering team installs the full CRM, multi-source lead intelligence, Lark Mail
              SMTP automation, and 7 Autonomous Agents directly on your dedicated Supabase &amp;
              cloud environment.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => onNavigate('/contact')}
              className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--gs-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--gs-primary-hover)] whitespace-nowrap"
            >
              <span>Contact Us to Get Started</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/services')}
              className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
            >
              <span>Explore Services &amp; Packages</span>
            </button>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={handleDemoSignOut}
              className="text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              Sign in or register with a different work email
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!demoUser) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          {/* Left Context Column */}
          <div className="lg:col-span-5 space-y-5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--gs-primary)]">
              <Lock className="h-4 w-4" />
              <span>24-Hour Customer Live Demo Pass</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Create Your Free 24-Hour Sandbox Account to Explore Live Demo
            </h1>
            <p className="text-sm leading-relaxed text-slate-600">
              Sign up in seconds—no email verification required. Get full 24-hour interactive access
              to our Apollo-style B2B CRM, AI Research Assistant, Google Maps &amp; GitHub Prospect
              Discovery, Lark Mail Outreach simulator, and 7 Autonomous Agents console.
            </p>

            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-800">
                Included Inside Your 24-Hour Sandbox
              </div>
              <ul className="space-y-2.5 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A] mt-0.5" />
                  <span>Full B2B CRM Directory, Kanban Stage Board &amp; AI Proposal Drafting</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A] mt-0.5" />
                  <span>Google Maps Local Lead Finder &amp; GitHub Open-Source Discovery</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A] mt-0.5" />
                  <span>7 Autonomous Operational Agents &amp; Approve-to-Send Lark Mail</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-[var(--gs-primary)] mt-0.5" />
                  <span>Active for 24 hours from registration — explore safely with zero risk</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Registration / Login Card */}
          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setAuthError(null);
                }}
                className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  authMode === 'register'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Sign Up for Demo</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthError(null);
                }}
                className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  authMode === 'login'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Existing Demo Login</span>
              </button>
            </div>

            {authMode === 'register' ? (
              <form onSubmit={handleRegisterDemo} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="demo-full-name"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Full Name
                    </label>
                    <input
                      id="demo-full-name"
                      type="text"
                      required
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="Alex Rivera"
                      className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="demo-company"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Company Name
                    </label>
                    <input
                      id="demo-company"
                      type="text"
                      required
                      value={regCompany}
                      onChange={(e) => setRegCompany(e.target.value)}
                      placeholder="Acme Logistics Inc."
                      className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="demo-email"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Work Email
                    </label>
                    <input
                      id="demo-email"
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="alex@company.com"
                      className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="demo-phone"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Phone Number
                    </label>
                    <input
                      id="demo-phone"
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+1 (415) 555-0192"
                      className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="demo-password"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Create Password (minimum 6 characters)
                  </label>
                  <input
                    id="demo-password"
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Choose a password to return anytime"
                    className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                  />
                </div>

                {authError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700"
                  >
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--gs-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
                >
                  <span>
                    {authSubmitting ? 'Unlocking Live Demo...' : 'Create Account & Launch Live Demo'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <p className="text-[11px] text-slate-500 text-center">
                  Instant access — no email verification link needed.
                </p>
              </form>
            ) : (
              <form onSubmit={handleLoginDemo} className="space-y-4">
                <div>
                  <label
                    htmlFor="demo-login-email"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Registered Email
                  </label>
                  <input
                    id="demo-login-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="alex@company.com"
                    className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="demo-login-password"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Password
                  </label>
                  <input
                    id="demo-login-password"
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your demo password"
                    className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                  />
                </div>

                {authError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700"
                  >
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--gs-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
                >
                  <span>{authSubmitting ? 'Signing In...' : 'Sign In to Live Demo'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Customer Sandbox Strip */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 sm:px-6 py-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#D97706]">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Interactive Customer Sandbox</span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[var(--gs-primary)] tabular-nums">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{demoPassTiming.label}</span>
            </span>
          </div>
          <h1 className="mt-1 font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            GitStack AI &amp; Revenue Operations Live Demo
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleResetSandbox}
            className="min-h-[42px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Sandbox</span>
          </button>
          <button
            type="button"
            onClick={handleDemoSignOut}
            className="min-h-[42px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
          <button
            type="button"
            onClick={() => openRealInquiry('AI Integration')}
            className="min-h-[42px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
          >
            <span>Request This System</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Mobile Drawer Toggle */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="text-xs font-bold text-slate-900 truncate">
            Demo Workspace · {activeNav.label}
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen((p) => !p)}
            aria-label="Toggle Demo Workspace Navigation"
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-slate-200 p-1.5 text-slate-700"
          >
            {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* 260px Sidebar Navigation */}
        <aside
          className={`${mobileNavOpen ? 'block' : 'hidden'} lg:block w-full lg:w-[260px] shrink-0`}
        >
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 lg:sticky lg:top-24">
            <div className="border-b border-slate-200 pb-3 space-y-1">
              <div className="text-[11px] font-semibold text-[var(--gs-primary)]">
                Authenticated Demo Evaluator
              </div>
              <div className="font-display text-sm font-bold text-slate-900 truncate">
                {demoUser.full_name}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-600 truncate">
                <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                <span className="truncate">{demoUser.company}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500 truncate">
                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                <span className="truncate">{demoUser.phone}</span>
              </div>
            </div>

            <nav aria-label="Demo Workspace Sections" className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTab(item.id, item.label)}
                    className={`min-h-[42px] w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors text-left ${
                      active
                        ? 'bg-[var(--gs-primary)] text-white'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {typeof item.count === 'number' && (
                      <span
                        className={`font-mono text-[11px] tabular-nums shrink-0 ${
                          active ? 'text-white/80' : 'text-slate-400'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-slate-200 pt-3 space-y-2.5">
              <div className="text-[11px] text-slate-600 leading-relaxed">
                Want this connected to your real Supabase, Apollo.io, Google Maps, and Lark Mail
                SMTP workflows?
              </div>
              <button
                type="button"
                onClick={() => openRealInquiry('Custom Software')}
                className="min-h-[40px] w-full rounded-lg border border-[var(--gs-primary)] bg-white px-3 py-2 text-xs font-semibold text-[var(--gs-primary)] hover:bg-[var(--gs-soft-bg)]"
              >
                Convert to Real Inquiry
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/services')}
                className="min-h-[36px] w-full text-center text-[11px] font-medium text-slate-500 hover:text-slate-900"
              >
                Compare Engineering Packages
              </button>
            </div>
          </div>
        </aside>

        {/* Main Sandbox Canvas */}
        <div className="flex-1 min-w-0 space-y-5">
          {notice && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900">
              <span>{notice}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="Dismiss sandbox notice"
                className="p-1 opacity-70 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* TAB 1: APOLLO-STYLE B2B CRM & KANBAN */}
          {activeTab === 'crm' && (
            <div className="space-y-5">
              {/* KPI Strip */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-[11px] font-medium text-slate-500">Sample Leads</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {pipelineStats.totalLeads}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-[11px] font-medium text-slate-500">Pipeline Value</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    ${pipelineStats.totalValue.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-[11px] font-medium text-slate-500">DNS MX Verified</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-[#16A34A] tabular-nums">
                    {pipelineStats.mxPercent}%
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-[11px] font-medium text-slate-500">Won Deals</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {pipelineStats.wonCount}
                  </div>
                </div>
              </div>

              {/* Filter & View Switcher Bar */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 flex-wrap items-center gap-2.5">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter company, contact, or tech stack..."
                      className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <select
                    value={filterSource}
                    onChange={(e) => setFilterSource(e.target.value as 'all' | LeadSourceType)}
                    aria-label="Filter by source"
                    className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-[var(--gs-primary)] focus:outline-none"
                  >
                    <option value="all">All Sources</option>
                    <option value="github">GitHub Open-Source</option>
                    <option value="google_maps">Google Maps Places</option>
                    <option value="apollo">Apollo.io</option>
                    <option value="hacker_news">Hacker News Hiring</option>
                    <option value="ycombinator">Y Combinator</option>
                  </select>
                  <select
                    value={filterStage}
                    onChange={(e) => setFilterStage(e.target.value as 'all' | CrmLeadStage)}
                    aria-label="Filter by stage"
                    className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-[var(--gs-primary)] focus:outline-none"
                  >
                    <option value="all">All Stages</option>
                    {STAGES.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCrmViewMode('directory')}
                    className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      crmViewMode === 'directory'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Directory
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrmViewMode('pipeline')}
                    className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      crmViewMode === 'pipeline'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Kanban Board
                  </button>
                </div>
              </div>

              {/* Directory Table */}
              {crmViewMode === 'directory' ? (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Company &amp; Contact</th>
                          <th className="px-4 py-3">Source &amp; Email</th>
                          <th className="px-4 py-3">Fit / Value</th>
                          <th className="px-4 py-3">Stage</th>
                          <th className="px-4 py-3 text-right">Interactive Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredLeads.map((lead) => {
                          const emailMeta = EMAIL_STATUS_META[lead.email_status];
                          return (
                            <tr key={lead.id} className="hover:bg-slate-50/70">
                              <td className="px-4 py-3.5 align-top">
                                <button
                                  type="button"
                                  onClick={() => setSelectedLead(lead)}
                                  className="text-left font-bold text-slate-900 hover:text-[var(--gs-primary)]"
                                >
                                  {lead.company_name}
                                </button>
                                <div className="text-[11px] text-slate-600">
                                  {lead.contact_name} · {lead.role_title}
                                </div>
                                <div className="mt-1 text-[11px] text-slate-500">
                                  {lead.tech_stack.slice(0, 4).join(' · ')}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 align-top">
                                <div className="font-medium text-slate-800">
                                  {SOURCE_LABELS[lead.source_type]}
                                </div>
                                <div className="mt-0.5 font-mono text-[11px] text-slate-600">
                                  {lead.email}
                                </div>
                                <div className={`mt-0.5 text-[11px] font-semibold ${emailMeta.tone}`}>
                                  {emailMeta.text}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 align-top font-mono tabular-nums">
                                <div className="font-bold text-slate-900">
                                  {lead.fit_score}% Fit
                                </div>
                                <div className="text-[11px] text-slate-600">
                                  ${lead.deal_value.toLocaleString()}
                                </div>
                                <div className="mt-0.5 font-sans text-[11px] text-slate-500">
                                  {lead.recommended_service}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 align-top">
                                <select
                                  value={lead.stage}
                                  onChange={(e) =>
                                    handleStageChange(lead.id, e.target.value as CrmLeadStage)
                                  }
                                  aria-label={`Stage for ${lead.company_name}`}
                                  className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800"
                                >
                                  {STAGES.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-3.5 align-top text-right">
                                <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    disabled={researchingId === lead.id}
                                    onClick={() => handleRunAiResearch(lead)}
                                    className="min-h-[36px] whitespace-nowrap inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    <Sparkles className="h-3 w-3 text-[var(--gs-primary)]" />
                                    <span>
                                      {researchingId === lead.id ? 'Drafting...' : 'AI Research'}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openSendSimulation(lead)}
                                    className="min-h-[36px] whitespace-nowrap inline-flex items-center gap-1 rounded-lg bg-[var(--gs-primary)] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                                  >
                                    <Send className="h-3 w-3" />
                                    <span>Approve Send</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Kanban Board */
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
                  {STAGES.map((stage) => {
                    const colLeads = filteredLeads.filter((l) => l.stage === stage.id);
                    return (
                      <div
                        key={stage.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <span className="font-display text-xs font-bold text-slate-900">
                            {stage.label}
                          </span>
                          <span className="font-mono text-xs text-slate-500 tabular-nums">
                            {colLeads.length}
                          </span>
                        </div>
                        <div className="space-y-2.5">
                          {colLeads.length === 0 ? (
                            <div className="py-6 text-center text-[11px] text-slate-400">
                              No leads in stage
                            </div>
                          ) : (
                            colLeads.map((lead) => (
                              <div
                                key={lead.id}
                                className="rounded-lg border border-slate-200 bg-white p-3 space-y-2"
                              >
                                <button
                                  type="button"
                                  onClick={() => setSelectedLead(lead)}
                                  className="block text-left text-xs font-bold text-slate-900 hover:text-[var(--gs-primary)]"
                                >
                                  {lead.company_name}
                                </button>
                                <div className="text-[11px] text-slate-600">
                                  {lead.contact_name} · {lead.recommended_service}
                                </div>
                                <div className="flex items-center justify-between font-mono text-[11px] text-slate-700 tabular-nums">
                                  <span>{lead.fit_score}% Fit</span>
                                  <span>${lead.deal_value.toLocaleString()}</span>
                                </div>
                                <select
                                  value={lead.stage}
                                  onChange={(e) =>
                                    handleStageChange(lead.id, e.target.value as CrmLeadStage)
                                  }
                                  aria-label={`Move ${lead.company_name}`}
                                  className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700"
                                >
                                  {STAGES.map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                      Stage: {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: 7 AUTONOMOUS AGENTS */}
          {activeTab === 'agents' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">
                    7 Deterministic Operational &amp; AI Agents
                  </h2>
                  <p className="mt-1 text-xs text-slate-600">
                    Simulate live workspace scoring across SEO, Content, Funnel, Compliance, QA,
                    Operations, and Growth telemetry.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={auditingAgents}
                  onClick={handleRunAgentAudit}
                  className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${auditingAgents ? 'animate-spin' : ''}`} />
                  <span>{auditingAgents ? 'Auditing...' : 'Run Simulated Audit'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-sm font-bold text-slate-900">
                          {agent.name}
                        </h3>
                        <p className="text-[11px] text-slate-500">{agent.role}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className={`font-mono text-lg font-bold tabular-nums ${
                            agent.status === 'healthy' ? 'text-[#16A34A]' : 'text-[#D97706]'
                          }`}
                        >
                          {agent.score}%
                        </div>
                        <div className="text-[11px] font-semibold text-slate-500 capitalize">
                          {agent.status}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600">{agent.summary}</p>
                    <div className="border-t border-slate-200 pt-2.5 space-y-1.5">
                      {agent.checks.map((c) => (
                        <div key={c.id} className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-700 font-medium">{c.label}</span>
                          <span className="font-mono text-slate-600 tabular-nums">{c.metric}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Sandbox Tasks */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Interactive Agent Action Queue ({tasks.filter((t) => !t.completed).length} Open)
                  </h3>
                  <form onSubmit={handleAddDemoTask} className="flex gap-2">
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Add a sample agent task..."
                      className="min-h-[38px] rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="min-h-[38px] whitespace-nowrap inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Task</span>
                    </button>
                  </form>
                </div>
                <div className="divide-y divide-slate-200">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-xs"
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() =>
                            setTasks((prev) =>
                              prev.map((t) =>
                                t.id === task.id ? { ...t, completed: !t.completed } : t
                              )
                            )
                          }
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span
                          className={`truncate ${
                            task.completed ? 'line-through text-slate-400' : 'text-slate-800 font-medium'
                          }`}
                        >
                          {task.title}
                        </span>
                      </label>
                      <button
                        type="button"
                        aria-label="Delete demo task"
                        onClick={() => setTasks((prev) => prev.filter((t) => t.id !== task.id))}
                        className="p-1.5 text-slate-400 hover:text-[#DC2626]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MULTI-SOURCE & GOOGLE MAPS DISCOVERY PREVIEW */}
          {activeTab === 'discover' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-display text-base font-bold text-slate-900">
                      Multi-Source &amp; Google Maps Discovery Simulator
                    </h2>
                    <p className="mt-1 text-xs text-slate-600">
                      Preview how GitStack discovers decision makers from Google Maps local
                      establishments, GitHub open-source repositories, and Hacker News hiring threads.
                    </p>
                  </div>
                  <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
                    {(
                      [
                        ['all', 'All Channels'],
                        ['google_maps', 'Google Maps'],
                        ['github', 'GitHub OSS'],
                        ['hacker_news', 'HN Hiring']
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setDiscoveryCategory(id)}
                        className={`min-h-[34px] rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                          discoveryCategory === id
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={discoveryFilter}
                    onChange={(e) => setDiscoveryFilter(e.target.value)}
                    placeholder="Filter sample prospects by city, industry, or stack (e.g. San Francisco, Kubernetes, Healthcare)..."
                    className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3.5 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {visibleDiscoveryItems.map((item) => {
                  const c = item.candidate;
                  const alreadyInCrm = leads.some(
                    (l) =>
                      (c.company_domain && l.company_domain === c.company_domain) ||
                      (c.email && l.email.toLowerCase() === c.email.toLowerCase())
                  );
                  return (
                    <div
                      key={c.id}
                      className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-display text-sm font-bold text-slate-900">
                              {c.company_name}
                            </h3>
                            <div className="text-[11px] text-slate-500">
                              {c.contact_name} · {c.role_title}
                            </div>
                          </div>
                          <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                            {c.fit_score}% Fit
                          </span>
                        </div>

                        <p className="text-xs leading-relaxed text-slate-600">{c.snippet}</p>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                          <span className="font-mono text-slate-800">{c.email}</span>
                          <span>·</span>
                          <span className={EMAIL_STATUS_META[c.email_status].tone + ' font-semibold'}>
                            {EMAIL_STATUS_META[c.email_status].text}
                          </span>
                          {c.location && (
                            <>
                              <span>·</span>
                              <span>{c.location}</span>
                            </>
                          )}
                        </div>

                        {item.coordinates && (
                          <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                            {item.address} · ({item.coordinates.lat.toFixed(4)},{' '}
                            {item.coordinates.lng.toFixed(4)}) · {item.ratingLabel}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                          <Globe className="h-3.5 w-3.5" />
                          <span>{c.source_detail}</span>
                        </span>
                        <button
                          type="button"
                          disabled={alreadyInCrm}
                          onClick={() => handleImportDiscoveryCandidate(item)}
                          className="min-h-[38px] whitespace-nowrap inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                        >
                          {alreadyInCrm ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>In Sandbox CRM</span>
                            </>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5" />
                              <span>Import to Sandbox CRM</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: SOURCE ATTRIBUTION, AUDIT LOGS & REAL INQUIRY CONVERSION */}
          {activeTab === 'sources' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h2 className="font-display text-sm font-bold text-slate-900">
                    Lead Source Attribution &amp; Pipeline Contribution
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Real-time breakdown of your sandbox CRM leads by acquisition channel.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Channel</th>
                        <th className="px-4 py-3 text-right">Leads</th>
                        <th className="px-4 py-3 text-right">MX Verified</th>
                        <th className="px-4 py-3 text-right">Pipeline Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {sourceBreakdown.map(([src, m]) => (
                        <tr key={src}>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {SOURCE_LABELS[src]}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums">
                            {m.count}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[#16A34A] tabular-nums">
                            {m.mx}/{m.count}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                            ${m.value.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Simulated Outreach Audit Log ({logs.length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-200">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="px-5 py-3.5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{log.subject}</div>
                        <div className="text-[11px] text-slate-500">
                          To: <span className="font-mono">{log.recipient_email}</span> · Lark Mail SMTP
                          SSL · {log.step_label}
                        </div>
                      </div>
                      <div className="font-mono text-[11px] text-[#16A34A] tabular-nums shrink-0">
                        {log.provider_message_id}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inline Conversion Callout */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-xl">
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Ready to Build This Architecture for Your Team?
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    We deploy custom AI CRM pipelines, private RAG copilots, and operational agent
                    consoles connected to your real databases and mail servers in 4–8 weeks.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openRealInquiry('AI Integration')}
                  className="min-h-[44px] whitespace-nowrap shrink-0 inline-flex items-center gap-2 rounded-lg bg-[var(--gs-primary)] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                >
                  <span>Convert Sandbox to Real Inquiry</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lead Dossier Drawer Modal */}
      {selectedLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Sample Lead Dossier"
        >
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <div className="text-[11px] font-semibold text-[var(--gs-primary)]">
                  Sandbox Lead Dossier · {SOURCE_LABELS[selectedLead.source_type]}
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  {selectedLead.company_name}
                </h3>
                <div className="text-xs text-slate-600">
                  {selectedLead.contact_name} · {selectedLead.role_title} ·{' '}
                  <span className="font-mono">{selectedLead.email}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                aria-label="Close dossier"
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-800">Technical Research Brief</div>
              <p className="whitespace-pre-line rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                {selectedLead.research_brief}
              </p>
            </div>

            {selectedLead.proposal_body && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-800">
                  Drafted Proposal ({selectedLead.recommended_service})
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-xs text-slate-700">
                  <div className="font-semibold text-slate-900">
                    Subject: {selectedLead.proposal_subject}
                  </div>
                  <p className="whitespace-pre-line leading-relaxed">{selectedLead.proposal_body}</p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => handleRunAiResearch(selectedLead)}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Sparkles className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
                <span>Simulate AI Research</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = selectedLead;
                  setSelectedLead(null);
                  openSendSimulation(target);
                }}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Preview Approve &amp; Send</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulated Approve & Send Modal */}
      {sendModalLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Simulated Proposal Send"
        >
          <form
            onSubmit={handleConfirmSimulatedSend}
            className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="text-[11px] font-semibold text-[#D97706]">
                  Sandbox Simulation — No External Email Sent
                </div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Approve &amp; Dispatch Proposal to {sendModalLead.company_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSendModalLead(null)}
                aria-label="Close send modal"
                className="p-1 text-slate-500 hover:bg-slate-100 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Mail Channel (Simulated)
                </label>
                <input
                  type="text"
                  readOnly
                  value="Lark Mail SMTP SSL (smtp.larksuite.com:465)"
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Recipient
                </label>
                <input
                  type="text"
                  readOnly
                  value={sendModalLead.email}
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Subject</label>
              <input
                type="text"
                required
                value={sendSubject}
                onChange={(e) => setSendSubject(e.target.value)}
                className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Body</label>
              <textarea
                rows={6}
                required
                value={sendBody}
                onChange={(e) => setSendBody(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => setSendModalLead(null)}
                className="min-h-[40px] rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Simulate Dispatch &amp; Log Proof</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Real Inquiry Conversion Modal */}
      {conversionOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Request Custom GitStack Architecture"
        >
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="text-[11px] font-semibold text-[var(--gs-primary)]">
                  Live Consultation Intake
                </div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Request This Platform for Your Organization
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  Submit a real project inquiry to GitStack&rsquo;s engineering team with context from
                  the demo modules you explored.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConversionOpen(false)}
                aria-label="Close inquiry modal"
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <InquiryForm
              compact
              defaultService={conversionService}
              defaultBrief={conversionBrief}
              defaultFullName={demoUser.full_name}
              defaultCompany={demoUser.company}
              defaultWorkEmail={demoUser.email}
              onSubmitted={() =>
                recordTelemetry('Inquiry Conversion', 'Submitted Real Architecture Inquiry', true)
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
