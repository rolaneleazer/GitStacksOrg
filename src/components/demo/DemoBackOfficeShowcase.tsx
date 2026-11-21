import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  Briefcase,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cloud,
  Coffee,
  Compass,
  Contact2,
  Database,
  FileEdit,
  FileText,
  Lock,
  Mail,
  Megaphone,
  Menu,
  MessageSquare,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tags,
  TrendingUp,
  UserCheck,
  UserCog,
  Workflow,
  X
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  createInitialDemoAgents,
  createInitialDemoBackOfficeState,
  createInitialDemoLeads,
  createInitialDemoTasks,
  simulateDemoAiResearch
} from '../../shared/demoSandboxData.ts';
import type {
  AgentId,
  AgentReport,
  AgentTask,
  CrmLead,
  WorkspaceCategoryConfig,
  WorkspaceModuleId
} from '../../shared/types.ts';
import {
  createDefaultWorkspaceCategories,
  DEFAULT_MODULE_LABELS
} from '../../shared/workspaceLayout.ts';

interface DemoBackOfficeShowcaseProps {
  onCtaClick: (serviceTitle: string) => void;
}

const MODULE_ICONS: Record<WorkspaceModuleId, React.ComponentType<{ className?: string }>> = {
  agents: Bot,
  workflows: Workflow,
  notifications: Bell,
  search_console: Search,
  marketing: Megaphone,
  google_trends: TrendingUp,
  ai_visibility: Sparkles,
  articles: FileText,
  crm: Briefcase,
  inbox: Mail,
  chat: MessageSquare,
  demo_users: UserCheck,
  buymeacoffee: Coffee,
  analytics: BarChart3,
  tag_manager: Tags,
  cloudflare: Cloud,
  pages: FileEdit,
  contact_registry: Contact2,
  branding: Palette,
  resources: Activity,
  qa: Bug,
  cybersecurity: Shield,
  demo_guard: ShieldAlert,
  data_explorer: Database,
  users: UserCog,
  adsense: ShieldCheck,
  profile: UserCheck
};

const STAGE_LABEL: Record<CrmLead['stage'], string> = {
  discovered: 'Discovered',
  researched: 'AI Researched',
  proposed: 'Proposal Ready',
  follow_up: 'Follow-Up Active',
  won: 'Won Deal',
  lost: 'Closed / Lost'
};

export function DemoBackOfficeShowcase({ onCtaClick }: DemoBackOfficeShowcaseProps) {
  const [categories, setCategories] = useState<WorkspaceCategoryConfig[]>(() =>
    createDefaultWorkspaceCategories()
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<WorkspaceModuleId>('agents');

  // Strictly client-side ephemeral mock state
  const [agents] = useState<AgentReport[]>(() => createInitialDemoAgents());
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId>('ceo');
  const [tasks, setTasks] = useState<AgentTask[]>(() => createInitialDemoTasks());
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const [leads, setLeads] = useState<CrmLead[]>(() => createInitialDemoLeads());
  const [selectedLeadId, setSelectedLeadId] = useState<string>('demo-lead-2');

  const [boState, setBoState] = useState(() => createInitialDemoBackOfficeState());
  const [selectedSearchUrl, setSelectedSearchUrl] = useState<string>(
    () => createInitialDemoBackOfficeState().searchUrls[0]?.url || ''
  );
  const [chatReplyInput, setChatReplyInput] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [simArticleTitle, setSimArticleTitle] = useState(
    'Zero-Trust Multi-Tenant RAG Pipelines on AWS & PostgreSQL'
  );
  const [simArticleWordCount, setSimArticleWordCount] = useState(1420);

  const [workflowRows, setWorkflowRows] = useState([
    { id: 'wf-1', title: 'Review VectorTrace EKS FinOps proposal', owner: 'Rolan Molano', done: false },
    { id: 'wf-2', title: 'Verify MX deliverability on HN batch #14', owner: 'Aria (Marketing)', done: true },
    { id: 'wf-3', title: 'Approve BIR EIS weekly trend guide', owner: 'Content Lead', done: false }
  ]);

  const showSimToast = (msg: string) => {
    setToastMessage(msg);
  };

  const handleResetSimulation = () => {
    setCategories(createDefaultWorkspaceCategories());
    setTasks(createInitialDemoTasks());
    setLeads(createInitialDemoLeads());
    const fresh = createInitialDemoBackOfficeState();
    setBoState(fresh);
    setSelectedSearchUrl(fresh.searchUrls[0]?.url || '');
    setNewTaskTitle('');
    setChatReplyInput('');
    showSimToast('Sandbox Back Office data reset to initial sample state.');
  };

  const activeCategory = useMemo(
    () => categories.find((c) => c.moduleIds.includes(activeModule)) || categories[0],
    [categories, activeModule]
  );
  const activeLabel =
    activeModule === 'agents'
      ? 'Overview & 8 Agents'
      : DEFAULT_MODULE_LABELS[activeModule] || 'Workspace Module';

  const selectedAgent =
    agents.find((a) => a.id === selectedAgentId) || agents[0];
  const selectedLead =
    leads.find((l) => l.id === selectedLeadId) || leads[0];
  const activeSearchAudit =
    boState.searchUrls.find((u) => u.url === selectedSearchUrl) || boState.searchUrls[0];

  const handleSelectModule = (modId: WorkspaceModuleId) => {
    setActiveModule(modId);
    setMobileDrawerOpen(false);
    setToastMessage(null);
  };

  const toggleCategoryCollapse = (catId: string) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === catId ? { ...c, collapsed: !c.collapsed } : c))
    );
  };

  const handleAddSimTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const item: AgentTask = {
      id: `sim-task-${Date.now()}`,
      agent_id: selectedAgentId,
      title: newTaskTitle.trim(),
      priority: 'medium',
      completed: false,
      notes: 'Created inside read-only client simulation.',
      updated_at: new Date().toISOString()
    };
    setTasks((prev) => [item, ...prev]);
    setNewTaskTitle('');
    showSimToast('Added simulated agent task in browser memory only.');
  };

  const handleRunSimResearch = (leadId: string) => {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? simulateDemoAiResearch(l) : l)));
    showSimToast('Simulated AI research brief & proposal drafted inside sandbox memory.');
  };

  const handleAdvanceLeadStage = (leadId: string, nextStage: CrmLead['stage']) => {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: nextStage } : l)));
    showSimToast(`Updated sample deal stage to ${STAGE_LABEL[nextStage]} (local sandbox state).`);
  };

  const handleSimPublishSocial = (postId: string) => {
    setBoState((prev) => ({
      ...prev,
      socialSchedule: prev.socialSchedule.map((p) =>
        p.id === postId ? { ...p, status: 'simulated_published' } : p
      )
    }));
    showSimToast('Simulated social dispatch marked complete (no external Graph/TikTok API called).');
  };

  const handleSimTrendAction = (
    bundleId: string,
    nextStatus: 'approved_simulated' | 'rejected_simulated'
  ) => {
    setBoState((prev) => ({
      ...prev,
      trendQueue: prev.trendQueue.map((b) =>
        b.id === bundleId ? { ...b, status: nextStatus } : b
      )
    }));
    showSimToast(
      nextStatus === 'approved_simulated'
        ? 'Trend bundle approved inside sandbox queue (production insights unchanged).'
        : 'Trend bundle rejected inside sandbox queue.'
    );
  };

  const handleSendSimChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatReplyInput.trim()) return;
    setBoState((prev) => ({
      ...prev,
      chatMessages: [
        ...prev.chatMessages,
        {
          id: `demo-msg-${Date.now()}`,
          sender: 'operator',
          author: 'Sandbox Operator (You)',
          text: chatReplyInput.trim(),
          time: 'Just now'
        }
      ]
    }));
    setChatReplyInput('');
    showSimToast('Simulated live chat reply posted to browser memory.');
  };

  const renderSidebarNavContent = (isMobile: boolean) => (
    <div className="space-y-2.5">
      {categories.map((cat) => (
        <div key={cat.id} className="space-y-1">
          <button
            type="button"
            onClick={() => toggleCategoryCollapse(cat.id)}
            className="w-full flex items-center justify-between gap-2 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800"
          >
            <span className="truncate">{cat.name}</span>
            {cat.collapsed ? (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            )}
          </button>

          {!cat.collapsed && (
            <div className="space-y-0.5">
              {cat.moduleIds.map((modId) => {
                const Icon = MODULE_ICONS[modId] || Compass;
                const active = activeModule === modId;
                const label =
                  modId === 'agents'
                    ? 'Overview & 8 Agents'
                    : DEFAULT_MODULE_LABELS[modId] || modId;
                return (
                  <button
                    key={modId}
                    type="button"
                    onClick={() => handleSelectModule(modId)}
                    title={label}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors text-left ${
                      active
                        ? 'bg-[var(--gs-primary)] text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {(!sidebarCollapsed || isMobile) && <span className="truncate">{label}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderActiveModuleView = () => {
    // 1. OVERVIEW & AGENTS
    if (activeModule === 'agents') {
      const agentTasks = tasks.filter((t) => t.agent_id === selectedAgent.id);
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="text-[11px] font-medium text-slate-500">Active AI Agents</div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                {agents.length + 1} Ready
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="text-[11px] font-medium text-slate-500">Demo Pipeline Value</div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                ${leads.reduce((s, l) => s + l.deal_value, 0).toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="text-[11px] font-medium text-slate-500">Open Agent Tasks</div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                {tasks.filter((t) => !t.completed).length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="text-[11px] font-medium text-slate-500">Isolation Boundary</div>
              <div className="mt-1 font-mono text-xl font-bold text-emerald-700 tabular-nums">
                100% Mock
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {agents.map((ag) => {
                const selected = ag.id === selectedAgent.id;
                return (
                  <button
                    key={ag.id}
                    type="button"
                    onClick={() => setSelectedAgentId(ag.id)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      selected
                        ? 'border-[var(--gs-primary)] bg-indigo-50/40 ring-1 ring-[var(--gs-primary)]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-xs font-bold text-slate-900">{ag.name}</span>
                      <span className="font-mono text-xs font-bold text-emerald-700 tabular-nums">
                        {ag.score}%
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">{ag.role}</p>
                    <p className="mt-2 text-[11px] text-slate-700 line-clamp-2">{ag.summary}</p>
                  </button>
                );
              })}
            </div>

            <div className="xl:col-span-5 rounded-xl border border-slate-200 bg-white p-4 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--gs-primary)]">
                  Agent Inspection (Sample)
                </div>
                <h3 className="mt-0.5 font-display text-sm font-bold text-slate-900">
                  {selectedAgent.name}
                </h3>
                <p className="mt-1 text-xs text-slate-600">{selectedAgent.summary}</p>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-700">Audit Checks</div>
                {selectedAgent.checks.map((chk) => (
                  <div key={chk.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 text-xs">
                    <div className="flex items-center justify-between font-semibold text-slate-900">
                      <span>{chk.label}</span>
                      <span className="font-mono text-emerald-700">{chk.metric}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-600">{chk.detail}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddSimTask} className="flex gap-2">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Add simulated checklist task..."
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--gs-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </form>

              <div className="space-y-1.5">
                {(agentTasks.length > 0 ? agentTasks : tasks).map((t) => (
                  <label
                    key={t.id}
                    className="flex items-start gap-2 rounded-lg border border-slate-200 p-2 text-xs cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={t.completed}
                      onChange={() =>
                        setTasks((prev) =>
                          prev.map((row) =>
                            row.id === t.id ? { ...row, completed: !row.completed } : row
                          )
                        )
                      }
                      className="mt-0.5"
                    />
                    <span className={t.completed ? 'line-through text-slate-400' : 'text-slate-800'}>
                      {t.title}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 2. SEARCH CONSOLE & SEO
    if (activeModule === 'search_console' || activeModule === 'ai_visibility') {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 space-y-2.5">
            {boState.searchUrls.map((item) => {
              const selected = activeSearchAudit?.url === item.url;
              return (
                <button
                  key={item.url}
                  type="button"
                  onClick={() => setSelectedSearchUrl(item.url)}
                  className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                    selected
                      ? 'border-[var(--gs-primary)] bg-indigo-50/40'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-900">
                    <span className="truncate">{item.url}</span>
                    <span className="font-mono text-emerald-700 tabular-nums">{item.seoScore}%</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500 font-mono tabular-nums">
                    <span>Clicks: {item.monthlyClicks.toLocaleString()}</span>
                    <span>Avg Pos: #{item.avgPosition}</span>
                    <span>{item.bingIndexed ? 'Google+Bing' : 'Google Only'}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {activeSearchAudit && (
            <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Live Google SERP Preview (Mock Audit)
                </div>
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-1">
                  <div className="text-xs text-slate-600">{activeSearchAudit.url}</div>
                  <div className="text-base font-semibold text-blue-700 hover:underline">
                    {activeSearchAudit.title}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {activeSearchAudit.metaDescription}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-900">AI Search &amp; SEO Action Tips</div>
                {activeSearchAudit.aiSuggestions.map((tip, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-xs text-slate-800"
                  >
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // 3. MARKETING & SOCIAL
    if (activeModule === 'marketing') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {boState.socialSchedule.map((post) => (
            <div
              key={post.id}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="aspect-video w-full bg-slate-100 overflow-hidden">
                  <img
                    src={post.coverImage}
                    alt={post.headline}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="font-semibold uppercase text-[var(--gs-primary)]">
                      {post.platform} · {post.dayLabel}
                    </span>
                    <span
                      className={
                        post.status === 'simulated_published'
                          ? 'text-emerald-700 font-semibold'
                          : 'text-amber-700 font-semibold'
                      }
                    >
                      {post.status === 'simulated_published' ? 'Published (Sim)' : 'Scheduled'}
                    </span>
                  </div>
                  <h4 className="font-display text-sm font-bold text-slate-900">{post.headline}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{post.caption}</p>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {post.hashtags.join(' ')}
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-100 p-3">
                <button
                  type="button"
                  disabled={post.status === 'simulated_published'}
                  onClick={() => handleSimPublishSocial(post.id)}
                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:bg-emerald-700"
                >
                  {post.status === 'simulated_published'
                    ? 'Simulated Post Dispatched'
                    : `Simulate Publish to ${post.platform === 'facebook' ? 'Facebook' : 'TikTok'}`}
                </button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // 4. GOOGLE TRENDS APPROVAL QUEUE
    if (activeModule === 'google_trends') {
      return (
        <div className="space-y-4">
          {boState.trendQueue.map((bundle) => (
            <div
              key={bundle.id}
              className="rounded-xl border border-slate-200 bg-white p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center"
            >
              <div className="md:col-span-3 aspect-video rounded-lg overflow-hidden bg-slate-100">
                <img
                  src={bundle.coverImage}
                  alt={bundle.articleTitle}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="md:col-span-6 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                  <span className="font-semibold text-[var(--gs-primary)]">{bundle.region}</span>
                  <span>·</span>
                  <span className="text-amber-700 font-semibold">{bundle.trafficLabel}</span>
                  <span>·</span>
                  <span className="text-slate-600">
                    {bundle.wordCount}w · Quality {bundle.qualityScore}%
                  </span>
                </div>
                <h4 className="font-display text-sm font-bold text-slate-900">
                  {bundle.articleTitle}
                </h4>
                <p className="text-xs text-slate-600">
                  FB: {bundle.fbHeadline} | TikTok: {bundle.ttHook}
                </p>
              </div>
              <div className="md:col-span-3 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={bundle.status !== 'pending_approval'}
                  onClick={() => handleSimTrendAction(bundle.id, 'approved_simulated')}
                  className="rounded-lg bg-[var(--gs-primary)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                >
                  {bundle.status === 'approved_simulated'
                    ? 'Approved (Simulated)'
                    : 'Approve & Publish (Sim)'}
                </button>
                <button
                  type="button"
                  disabled={bundle.status !== 'pending_approval'}
                  onClick={() => handleSimTrendAction(bundle.id, 'rejected_simulated')}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {bundle.status === 'rejected_simulated' ? 'Rejected' : 'Reject Bundle'}
                </button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // 5. ARTICLES & QUALITY GATEKEEPER
    if (activeModule === 'articles') {
      const estimatedWords = Math.max(850, simArticleWordCount);
      return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h3 className="font-display text-sm font-bold text-slate-900">
              Simulated Article &amp; AdSense Quality Gatekeeper
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Simulated Headline
              </label>
              <input
                type="text"
                value={simArticleTitle}
                onChange={(e) => setSimArticleTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Simulated Word Depth ({estimatedWords} words)
              </label>
              <input
                type="range"
                min={500}
                max={2200}
                step={50}
                value={simArticleWordCount}
                onChange={(e) => setSimArticleWordCount(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                showSimToast(
                  `Simulated Gatekeeper cleared "${simArticleTitle}" (${estimatedWords} words).`
                )
              }
              className="rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
            >
              Simulate Gatekeeper Audit
            </button>
          </div>
          <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="text-xs font-semibold text-emerald-700">
              {simArticleWordCount >= 800 ? 'Gatekeeper Eligible' : 'Below 800-Word Floor'}
            </div>
            <div className="grid grid-cols-2 gap-3 text-center border-y border-slate-100 py-3">
              <div>
                <div className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                  {simArticleWordCount}
                </div>
                <div className="text-[11px] text-slate-500">Words</div>
              </div>
              <div>
                <div className="font-mono text-lg font-bold text-emerald-700 tabular-nums">
                  {simArticleWordCount >= 800 ? '96%' : '68%'}
                </div>
                <div className="text-[11px] text-slate-500">Quality Score</div>
              </div>
            </div>
            <p className="text-[11px] text-slate-600">
              Each new article receives an automatically distinct topic-matched editorial cover image.
            </p>
          </div>
        </div>
      );
    }

    // 6. CRM & PROSPECTING
    if (activeModule === 'crm' || activeModule === 'inbox' || activeModule === 'demo_users') {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6 space-y-2.5">
            {leads.map((lead) => {
              const selected = selectedLead?.id === lead.id;
              return (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                    selected
                      ? 'border-[var(--gs-primary)] bg-indigo-50/40'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-xs font-bold text-slate-900">
                      {lead.company_name}
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-700 tabular-nums">
                      ${lead.deal_value.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      {lead.contact_name} · {lead.role_title}
                    </span>
                    <span className="font-medium text-slate-700">{STAGE_LABEL[lead.stage]}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedLead && (
            <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-display text-sm font-bold text-slate-900">
                    {selectedLead.company_name}
                  </h4>
                  <p className="text-xs text-slate-600">
                    {selectedLead.contact_name} ({selectedLead.email}) · Fit {selectedLead.fit_score}%
                  </p>
                </div>
                <span className="rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                  {STAGE_LABEL[selectedLead.stage]}
                </span>
              </div>

              <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                {selectedLead.research_brief}
              </p>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleRunSimResearch(selectedLead.id)}
                  className="rounded-lg bg-[var(--gs-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                >
                  Simulate AI Research &amp; Proposal
                </button>
                <button
                  type="button"
                  onClick={() => handleAdvanceLeadStage(selectedLead.id, 'won')}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Mark Won (Sim)
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // 7. LIVE Q&A CHAT SIMULATOR
    if (activeModule === 'chat') {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900">
                Simulated Live Visitor Q&amp;A Thread
              </h3>
              <p className="text-xs text-slate-500">
                Messages posted here stay strictly in your browser tab memory.
              </p>
            </div>
          </div>

          <div className="space-y-2.5 max-h-64 overflow-y-auto">
            {boState.chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-lg p-3 text-xs ${
                  msg.sender === 'operator'
                    ? 'bg-indigo-50 border border-indigo-100 ml-6'
                    : 'bg-slate-50 border border-slate-200 mr-6'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 mb-1">
                  <span>{msg.author}</span>
                  <span className="font-mono text-slate-400">{msg.time}</span>
                </div>
                <p className="text-slate-800">{msg.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendSimChat} className="flex gap-2">
            <input
              type="text"
              value={chatReplyInput}
              onChange={(e) => setChatReplyInput(e.target.value)}
              placeholder="Write a simulated operator reply..."
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Send (Sim)</span>
            </button>
          </form>
        </div>
      );
    }

    // 8. ANALYTICS & TELEMETRY
    if (
      activeModule === 'analytics' ||
      activeModule === 'tag_manager' ||
      activeModule === 'cloudflare' ||
      activeModule === 'buymeacoffee'
    ) {
      const m = boState.analyticsMetrics;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] text-slate-500">GA4 Pageviews</div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                {m.pageviews.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] text-slate-500">Unique Visitors</div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                {m.uniqueVisitors.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] text-slate-500">Cloudflare 24h Req</div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                {m.cloudflareRequests24h.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] text-slate-500">GTM Events Logged</div>
              <div className="mt-1 font-mono text-xl font-bold text-emerald-700 tabular-nums">
                {m.gtmEventsLogged.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-600">
            Showing synthetic telemetry sample ({m.periodLabel}). Edge Cache Hit Ratio:{' '}
            <strong className="text-slate-900">{m.cloudflareCacheHit}</strong> · Inquiry Conversion
            Rate: <strong className="text-slate-900">{m.conversionRate}</strong>.
          </div>
        </div>
      );
    }

    // 9. CONTENT & APPEARANCE (SCOPED PREVIEW ONLY)
    if (
      activeModule === 'pages' ||
      activeModule === 'branding' ||
      activeModule === 'contact_registry'
    ) {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h3 className="font-display text-sm font-bold text-slate-900">
              Scoped Sandbox Page &amp; Branding Editor
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Simulated Hero Title
              </label>
              <input
                type="text"
                value={boState.homeHeroTitle}
                onChange={(e) =>
                  setBoState((prev) => ({ ...prev, homeHeroTitle: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Scoped Brand Color (Local Card Only)
              </label>
              <div className="flex flex-wrap gap-2">
                {['#4338CA', '#0F766E', '#1D4ED8', '#7C3AED', '#0F172A'].map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setBoState((prev) => ({ ...prev, brandColor: hex }))}
                    className={`h-8 w-8 rounded-lg border-2 ${
                      boState.brandColor === hex ? 'border-slate-900 scale-105' : 'border-white'
                    }`}
                    style={{ backgroundColor: hex }}
                    aria-label={`Select color ${hex}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-900">
                Simulated Sitewide Contact Registry
              </div>
              {boState.contactRegistry.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{row.fieldLabel}</div>
                    <div className="text-[11px] text-slate-500">{row.scopeTitle}</div>
                  </div>
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) =>
                      setBoState((prev) => ({
                        ...prev,
                        contactRegistry: prev.contactRegistry.map((c) =>
                          c.id === row.id ? { ...c, value: e.target.value } : c
                        )
                      }))
                    }
                    className="w-44 rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-800"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Live Scoped Preview Card (Zero Production Effect)
            </div>
            <div
              className="rounded-xl p-6 text-white space-y-3 transition-colors"
              style={{ backgroundColor: boState.brandColor }}
            >
              <div className="text-xs font-mono opacity-85">{boState.brandName}</div>
              <h4 className="font-display text-lg font-bold leading-snug">
                {boState.homeHeroTitle}
              </h4>
              <p className="text-xs opacity-90 leading-relaxed">{boState.homeHeroSubtitle}</p>
            </div>
          </div>
        </div>
      );
    }

    // 10. WORKFLOWS & NOTIFICATIONS
    if (activeModule === 'workflows' || activeModule === 'notifications') {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="font-display text-sm font-bold text-slate-900">
            Simulated Team Workflows &amp; Escalation Rules
          </h3>
          <div className="space-y-2">
            {workflowRows.map((wf) => (
              <label
                key={wf.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-xs cursor-pointer hover:bg-slate-50"
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={wf.done}
                    onChange={() =>
                      setWorkflowRows((prev) =>
                        prev.map((r) => (r.id === wf.id ? { ...r, done: !r.done } : r))
                      )
                    }
                  />
                  <span className={wf.done ? 'line-through text-slate-400' : 'text-slate-900 font-medium'}>
                    {wf.title}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">{wf.owner}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }

    // 11. PLATFORM, SECURITY & DEMO GUARD
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">
              {activeLabel} — Air-Gapped Sandbox View
            </h3>
            <p className="text-xs text-slate-600">
              Demonstrates operator console telemetry with synthetic data and strict isolation guards.
            </p>
          </div>
          <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
            Read-Only Isolation Verified
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="font-semibold text-slate-900">Database Writes Triggered</div>
            <div className="mt-1 font-mono text-lg font-bold text-emerald-700 tabular-nums">0</div>
            <p className="mt-1 text-[11px] text-slate-500">All edits stay inside browser memory.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="font-semibold text-slate-900">Backend Firewall Status</div>
            <div className="mt-1 font-mono text-lg font-bold text-slate-900">Armed</div>
            <p className="mt-1 text-[11px] text-slate-500">Server blocks demo-origin write calls.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="font-semibold text-slate-900">AES-256 Vault Isolation</div>
            <div className="mt-1 font-mono text-lg font-bold text-slate-900">Sealed</div>
            <p className="mt-1 text-[11px] text-slate-500">No production credentials loaded here.</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden shadow-xs">
      {/* Top Mandatory Isolation Notice Bar */}
      <div className="border-b border-amber-200 bg-amber-50 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-950">
          <Lock className="h-4 w-4 text-amber-700 shrink-0" />
          <span>
            Read-Only Client-Side Simulation — Click through all 6 Back Office categories with mock
            data. Changes stay in temporary browser memory and never affect production.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetSimulation}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100/60 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Simulation</span>
          </button>
          <button
            type="button"
            onClick={() => onCtaClick('Custom Enterprise Back Office OS')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] whitespace-nowrap shrink-0"
          >
            <span>Deploy For Your Company</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Mobile Navigation Header & Horizontal Sibling Switcher */}
      <div className="lg:hidden border-b border-slate-200 bg-white px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800"
          >
            <Menu className="h-4 w-4" />
            <span>All Categories ({categories.length})</span>
          </button>
          <span className="text-xs font-semibold text-[var(--gs-primary)] truncate">
            {activeLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {activeCategory.moduleIds.map((modId) => (
            <button
              key={modId}
              type="button"
              onClick={() => handleSelectModule(modId)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                activeModule === modId
                  ? 'bg-[var(--gs-primary)] text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {modId === 'agents' ? '8 Agents' : DEFAULT_MODULE_LABELS[modId]}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileDrawerOpen && (
        <div className="lg:hidden border-b border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-900">Demo Back Office Modules</span>
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="p-1 text-slate-500"
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {renderSidebarNavContent(true)}
        </div>
      )}

      {/* Desktop 2-Column Interactive Showcase */}
      <div className="flex min-h-[560px]">
        <aside
          className={`hidden lg:flex flex-col border-r border-slate-200 bg-white p-3 transition-all shrink-0 ${
            sidebarCollapsed ? 'w-16' : 'w-64'
          }`}
        >
          <div className="flex items-center justify-between gap-2 pb-3 mb-2 border-b border-slate-100">
            {!sidebarCollapsed && (
              <span className="font-display text-xs font-bold text-slate-900 truncate">
                Back Office Modules
              </span>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-3.5 w-3.5" />
              ) : (
                <PanelLeftClose className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pr-0.5">{renderSidebarNavContent(false)}</div>
        </aside>

        <main className="flex-1 min-w-0 p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <div className="text-[11px] font-medium text-slate-500">
                Demo Back Office / {activeCategory.name} /{' '}
                <span className="text-[var(--gs-primary)]">{activeLabel}</span>
              </div>
              <h3 className="font-display text-base font-bold text-slate-900">{activeLabel}</h3>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Mock Session Only</span>
            </div>
          </div>

          {toastMessage && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900">
              <span>{toastMessage}</span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                aria-label="Dismiss simulation toast"
                className="p-0.5 opacity-70 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {renderActiveModuleView()}
        </main>
      </div>
    </div>
  );
}
