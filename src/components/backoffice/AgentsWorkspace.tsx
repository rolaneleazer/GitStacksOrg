import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  Coffee,
  ExternalLink,
  Eye,
  Mail,
  MailCheck,
  MessageSquare,
  Palette,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  Users
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getRealtimeWsUrl, getStoredToken } from '../../lib/api.ts';
import {
  AGENT_COLLABORATION_MAP,
  DEFAULT_AGENT_OFFICE_PROFILES,
  DEFAULT_AGENT_REPORT_SETTINGS,
  SEED_AGENT_CONVERSATIONS
} from '../../shared/agentOfficeDefaults.ts';
import type {
  AgentAvatarIcon,
  AgentConversationEntry,
  AgentEmailReport,
  AgentId,
  AgentOfficeProfile,
  AgentReport,
  AgentReportSettings,
  AgentSnapshotItem,
  AgentTask,
  OfficeLiveHudSummary,
  TaskPriority
} from '../../shared/types.ts';
import { AgentReportsPanel } from './AgentReportsPanel.tsx';
import { VirtualOfficeMap } from './VirtualOfficeMap.tsx';

interface AgentsWorkspaceProps {
  agents: AgentReport[];
  tasks: AgentTask[];
  loading: boolean;
  onRefresh: () => void;
  onJumpToSection: (section: string) => void;
  onCreateTask: (payload: {
    agent_id: AgentId;
    title: string;
    priority: TaskPriority;
    notes?: string;
  }) => Promise<void>;
  onToggleTask: (task: AgentTask) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
}

const STATUS_LABEL: Record<'healthy' | 'attention' | 'critical', { text: string; cls: string }> = {
  healthy: { text: 'Nominal', cls: 'text-emerald-600' },
  attention: { text: 'Attention Needed', cls: 'text-amber-600' },
  critical: { text: 'Action Required', cls: 'text-red-600' }
};

const WORK_BADGE: Record<'working' | 'walking' | 'idle', { text: string; cls: string }> = {
  working: { text: 'WORKING', cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' },
  walking: { text: 'WALKING', cls: 'bg-amber-500/15 text-amber-700 border-amber-500/30' },
  idle: { text: 'LOUNGE', cls: 'bg-slate-100 text-slate-600 border-slate-300' }
};

const AVATAR_ICON_OPTIONS: { value: AgentAvatarIcon; label: string }[] = [
  { value: 'crown', label: 'Crown' },
  { value: 'megaphone', label: 'Megaphone' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'shield', label: 'Shield' },
  { value: 'check', label: 'Verified Check' },
  { value: 'badge', label: 'AdSense Badge' },
  { value: 'trending', label: 'Growth Chart' },
  { value: 'bot', label: 'Ops Bot' },
  { value: 'cpu', label: 'Core CPU' }
];

const ACCENT_SWATCHES = ['#2563EB', '#10B981', '#0891B2', '#7C3AED', '#D97706', '#DC2626', '#0F172A'];

export function AgentsWorkspace({
  agents,
  tasks,
  loading,
  onRefresh,
  onJumpToSection,
  onCreateTask,
  onToggleTask,
  onDeleteTask
}: AgentsWorkspaceProps) {
  const [workspaceView, setWorkspaceView] = useState<'office' | 'reports'>('office');
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId>('cybersecurity');
  const [inspectorTab, setInspectorTab] = useState<'status' | 'conversation' | 'collab' | 'roadmap'>(
    'status'
  );
  const [ruleFilter, setRuleFilter] = useState<'all' | 'attention'>('all');

  // Virtual Office state
  const [profiles, setProfiles] = useState<AgentOfficeProfile[]>(DEFAULT_AGENT_OFFICE_PROFILES);
  const [conversations, setConversations] = useState<AgentConversationEntry[]>(
    SEED_AGENT_CONVERSATIONS
  );
  const [shiftIntervalSec, setShiftIntervalSec] = useState<12 | 25 | 0>(12);
  const [continuousWalk, setContinuousWalk] = useState(true);
  const [walkTick, setWalkTick] = useState(0);
  const [speechTick, setSpeechTick] = useState(0);
  const [shiftBusy, setShiftBusy] = useState(false);

  // Live Site Operations HUD & Website Visitors
  const [hud, setHud] = useState<OfficeLiveHudSummary | null>(null);
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null);
  const [scanningInquiries, setScanningInquiries] = useState(false);
  const [watcherNotice, setWatcherNotice] = useState<string | null>(null);

  // Customize form state
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState<AgentOfficeProfile | null>(null);
  const [savingCustom, setSavingCustom] = useState(false);

  // Conversation composer
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [feedOpen, setFeedOpen] = useState(true);

  // Task composer
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [savingTask, setSavingTask] = useState(false);

  // Daily Email Reports & Proof Log state
  const [reportSettings, setReportSettings] = useState<AgentReportSettings>(
    DEFAULT_AGENT_REPORT_SETTINGS
  );
  const [emailReports, setEmailReports] = useState<AgentEmailReport[]>([]);
  const [reportPreview, setReportPreview] = useState<{
    subject: string;
    bodyText: string;
    overallScore: number;
    snapshots: AgentSnapshotItem[];
  } | null>(null);
  const [loadingReports, setLoadingReports] = useState(false);

  const loadOfficeData = useCallback(async () => {
    try {
      const [officeRes, hudRes] = await Promise.all([
        api.getAgentsOffice(),
        api.getOfficeHud().catch(() => null)
      ]);
      if (officeRes.profiles.length > 0) setProfiles(officeRes.profiles);
      setConversations(officeRes.conversations);
      if (hudRes?.hud) setHud(hudRes.hud);
    } catch {
      // keep default fallbacks if offline
    }
  }, []);

  const loadReportsData = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await api.getDailyAgentReports();
      setReportSettings(res.settings);
      setEmailReports(res.reports);
      setReportPreview(res.preview);
    } catch {
      // ignore on background refresh
    } finally {
      setLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    loadOfficeData();
    loadReportsData();
  }, [loadOfficeData, loadReportsData]);

  // Continuous 1-second walking patrol across all 7 agents & live visitors
  useEffect(() => {
    if (!continuousWalk) return;
    const walkTimer = window.setInterval(() => {
      setWalkTick((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(walkTimer);
  }, [continuousWalk]);

  // Real-time WebSocket stream + 12s fallback HUD polling for live website visitors & chat alerts
  useEffect(() => {
    const refreshHud = () => {
      api
        .getOfficeHud()
        .then((res) => setHud(res.hud))
        .catch(() => {});
    };

    const pollId = window.setInterval(refreshHud, 12_000);
    let ws: WebSocket | null = null;
    try {
      const wsUrl = getRealtimeWsUrl();
      const token = getStoredToken();
      if (wsUrl && token) {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          ws?.send(JSON.stringify({ type: 'admin:join', token }));
        };
        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(String(evt.data || '{}')) as {
              type?: string;
              payload?: { visitors?: OfficeLiveHudSummary['visitors'] };
            };
            if (msg.type === 'presence:update' && msg.payload?.visitors) {
              setHud((prev) =>
                prev
                  ? {
                      ...prev,
                      activeVisitorsCount: msg.payload!.visitors!.length,
                      visitors: msg.payload!.visitors!
                    }
                  : prev
              );
            } else if (
              msg.type === 'chat:message' ||
              msg.type === 'chat:session_updated' ||
              msg.type === 'chat:escalated'
            ) {
              refreshHud();
            }
          } catch {
            // ignore malformed WS frames
          }
        };
      }
    } catch {
      // polling covers fallback
    }

    return () => {
      window.clearInterval(pollId);
      if (ws && ws.readyState < 2) ws.close();
    };
  }, []);

  // Animated Auto-Shift Cycle
  useEffect(() => {
    if (shiftIntervalSec === 0) return;
    const timer = window.setInterval(() => {
      setSpeechTick((t) => t + 1);
      setProfiles((prev) => {
        if (prev.length === 0) return prev;
        const idx = Math.floor(Math.random() * prev.length);
        const target = prev[idx];
        const nextStatus = target.work_status === 'idle' ? 'walking' : target.work_status;
        if (nextStatus === 'walking' && target.work_status === 'idle') {
          window.setTimeout(() => {
            setProfiles((cur) =>
              cur.map((p) => (p.agent_id === target.agent_id ? { ...p, work_status: 'working' } : p))
            );
          }, 1300);
        }
        return prev.map((p, i) => (i === idx ? { ...p, work_status: nextStatus } : p));
      });
    }, shiftIntervalSec * 1000);
    return () => window.clearInterval(timer);
  }, [shiftIntervalSec]);

  const activeAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];
  const activeProfile =
    profiles.find((p) => p.agent_id === (activeAgent?.id || selectedAgentId)) ||
    DEFAULT_AGENT_OFFICE_PROFILES[0];

  useEffect(() => {
    if (customizeOpen && activeProfile) {
      setCustomDraft({ ...activeProfile });
    }
  }, [customizeOpen, activeProfile]);

  const agentTasks = tasks.filter((t) => t.agent_id === (activeAgent?.id || selectedAgentId));
  const agentConversations = useMemo(
    () =>
      conversations.filter(
        (c) => c.agent_id === selectedAgentId || c.peer_agent_id === selectedAgentId
      ),
    [conversations, selectedAgentId]
  );

  const visibleChecks = (activeAgent?.checks || []).filter((c) =>
    ruleFilter === 'attention' ? c.status !== 'pass' : true
  );

  const activeWorkersCount = profiles.filter((p) => p.work_status !== 'idle').length;
  const primaryJumpCheck =
    activeAgent?.checks.find((c) => c.targetTab && c.status !== 'pass') ||
    activeAgent?.checks.find((c) => c.targetTab);

  const handleBulkShift = async (action: 'all_hands' | 'lounge') => {
    setShiftBusy(true);
    try {
      if (action === 'all_hands') {
        setProfiles((prev) => prev.map((p) => ({ ...p, work_status: 'walking' })));
      }
      const res = await api.triggerOfficeShift(action);
      if (action === 'all_hands') {
        window.setTimeout(() => {
          setProfiles(res.profiles);
        }, 700);
      } else {
        setProfiles(res.profiles);
      }
      setConversations((prev) => [res.entry, ...prev]);
    } finally {
      setShiftBusy(false);
    }
  };

  const handleAgentDeskToggle = async (agentId: AgentId, target: 'working' | 'idle') => {
    if (target === 'working') {
      setProfiles((prev) =>
        prev.map((p) => (p.agent_id === agentId ? { ...p, work_status: 'walking' } : p))
      );
      window.setTimeout(async () => {
        const res = await api.updateAgentOfficeProfile(agentId, { work_status: 'working' });
        setProfiles((prev) => prev.map((p) => (p.agent_id === agentId ? res.profile : p)));
      }, 650);
    } else {
      const res = await api.updateAgentOfficeProfile(agentId, { work_status: 'idle' });
      setProfiles((prev) => prev.map((p) => (p.agent_id === agentId ? res.profile : p)));
    }
  };

  const handleSaveCustomProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDraft) return;
    setSavingCustom(true);
    try {
      const res = await api.updateAgentOfficeProfile(customDraft.agent_id, customDraft);
      setProfiles((prev) => prev.map((p) => (p.agent_id === res.profile.agent_id ? res.profile : p)));
      setCustomizeOpen(false);
    } finally {
      setSavingCustom(false);
    }
  };

  const handleSendConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setSendingChat(true);
    try {
      const res = await api.sendAgentConversation({
        agent_id: selectedAgentId,
        message: chatInput.trim(),
        sender_type: 'operator'
      });
      setConversations((prev) => [...res.entries, ...prev]);
      setChatInput('');
    } finally {
      setSendingChat(false);
    }
  };

  const handleSendHandoff = async (peerId: AgentId) => {
    const peerProf = profiles.find((p) => p.agent_id === peerId);
    setSendingChat(true);
    try {
      const res = await api.sendAgentConversation({
        agent_id: selectedAgentId,
        peer_agent_id: peerId,
        sender_type: 'handoff',
        message: `Synchronizing live audit telemetry with ${peerProf?.display_name || peerId}.`
      });
      setConversations((prev) => [...res.entries, ...prev]);
      setInspectorTab('conversation');
    } finally {
      setSendingChat(false);
    }
  };

  const handleScanUnansweredInquiries = async () => {
    setScanningInquiries(true);
    setWatcherNotice(null);
    try {
      const res = await api.checkUnansweredChatInquiries();
      if (res.escalatedCount > 0) {
        setWatcherNotice(
          `Mira (Inquiry Watcher) escalated ${res.escalatedCount} unanswered inquiry(ies) to Lark Mail.`
        );
      } else if (res.skippedReason) {
        setWatcherNotice(res.skippedReason);
      } else {
        setWatcherNotice(
          `Checked ${res.checkedCount} open chat thread(s): all inquiries already answered or escalated.`
        );
      }
      const hudRes = await api.getOfficeHud().catch(() => null);
      if (hudRes?.hud) setHud(hudRes.hud);
    } catch (err) {
      setWatcherNotice(
        err instanceof Error ? err.message : 'Unable to run inquiry watcher check.'
      );
    } finally {
      setScanningInquiries(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !activeAgent) return;
    setSavingTask(true);
    try {
      await onCreateTask({
        agent_id: activeAgent.id,
        title: newTaskTitle.trim(),
        priority: newTaskPriority
      });
      setNewTaskTitle('');
    } finally {
      setSavingTask(false);
    }
  };

  if (loading && agents.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl border border-slate-200 bg-white animate-pulse" />
        <div className="h-80 rounded-xl border border-slate-200 bg-white animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Sub-View Bar: Virtual Office HQ vs Daily Email Reports */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 w-full sm:w-fit">
          <button
            type="button"
            onClick={() => setWorkspaceView('office')}
            className={`min-h-[40px] flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              workspaceView === 'office'
                ? 'bg-[var(--gs-primary)] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bot className="h-4 w-4" />
            <span>Virtual Office HQ (7 Agents)</span>
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceView('reports')}
            className={`min-h-[40px] flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              workspaceView === 'reports'
                ? 'bg-[var(--gs-primary)] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MailCheck className="h-4 w-4" />
            <span>Daily Email Reports &amp; Proof Log</span>
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                workspaceView === 'reports' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {emailReports.length}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onRefresh();
            loadOfficeData();
            loadReportsData();
          }}
          className="inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Run Live Audit</span>
        </button>
      </div>

      {workspaceView === 'reports' ? (
        <AgentReportsPanel
          settings={reportSettings}
          reports={emailReports}
          preview={reportPreview}
          profiles={profiles}
          loading={loadingReports}
          onRefresh={loadReportsData}
          onSaveSettings={async (payload) => {
            const res = await api.saveDailyReportSettings(payload);
            setReportSettings(res.settings);
          }}
          onDispatchServerReport={async () => {
            const res = await api.dispatchServerAgentReport();
            setEmailReports((prev) => [res.report, ...prev]);
            return res;
          }}
        />
      ) : (
        <div className="space-y-6">
          {/* Dark Command Header + Live Site Operations HUD */}
          <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-4 sm:p-5 text-white shadow-xs space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <h2 className="font-display text-base sm:text-lg font-bold text-white">
                    GitStack Agent Virtual Office HQ (Live Operations)
                  </h2>
                  <span className="font-mono text-[11px] font-bold text-emerald-400">
                    · {continuousWalk ? '1s LIVE PATROL' : 'PATROL PAUSED'}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-amber-300">
                    · {activeWorkersCount}/{profiles.length} AGENTS ACTIVE
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Watch your 7 customizable operational agents walk continuously every second alongside live website visitors entering from git-stack.org.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setContinuousWalk((v) => !v)}
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    continuousWalk
                      ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-200'
                      : 'border-slate-700 bg-slate-900 text-slate-300'
                  }`}
                >
                  {continuousWalk ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  <span>{continuousWalk ? '1s Walk On' : '1s Walk Paused'}</span>
                </button>

                {/* Shift Cadence Controls */}
                <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-0.5">
                  <button
                    type="button"
                    onClick={() => setShiftIntervalSec(12)}
                    className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${
                      shiftIntervalSec === 12
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    12s Shift
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftIntervalSec(25)}
                    className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${
                      shiftIntervalSec === 25
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    25s
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftIntervalSec(0)}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${
                      shiftIntervalSec === 0
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Hold
                  </button>
                </div>

                <button
                  type="button"
                  disabled={shiftBusy}
                  onClick={() => handleBulkShift('all_hands')}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>All-Hands</span>
                </button>

                <button
                  type="button"
                  disabled={shiftBusy}
                  onClick={() => handleBulkShift('lounge')}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Coffee className="h-3.5 w-3.5" />
                  <span>Lounge</span>
                </button>
              </div>
            </div>

            {/* Live Site Operations HUD Strip */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 border-t border-slate-800 pt-3.5">
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-sky-300">
                    <Eye className="h-3.5 w-3.5 shrink-0" />
                    <span>Live Website Visitors</span>
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold text-white tabular-nums">
                    {hud?.activeVisitorsCount ?? 0} online
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {hud?.visitors && hud.visitors.length > 0
                      ? hud.visitors.slice(0, 2).map((v) => v.current_path).join(' · ')
                      : 'Awaiting public route visit'}
                  </div>
                </div>
                {hud?.visitors && hud.visitors.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedVisitorId(hud.visitors[0].session_id)}
                    className="rounded border border-sky-500/40 px-2 py-1 text-[10px] font-semibold text-sky-300 hover:bg-sky-900/50 whitespace-nowrap shrink-0"
                  >
                    Inspect
                  </button>
                )}
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-300">
                    <Cloud className="h-3.5 w-3.5 shrink-0" />
                    <span>Cloudflare Edge (24h)</span>
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold text-white tabular-nums">
                    {hud?.cloudflare24hRequests !== null && hud?.cloudflare24hRequests !== undefined
                      ? `${hud.cloudflare24hRequests.toLocaleString()} reqs`
                      : 'Vault Standby'}
                  </div>
                  <div className="font-mono text-[11px] text-slate-400 tabular-nums">
                    {hud?.cloudflareCacheRate !== null && hud?.cloudflareCacheRate !== undefined
                      ? `Cache ${hud.cloudflareCacheRate}% · 5xx ${hud.cloudflare5xxRate ?? 0}%`
                      : 'Connect Cloudflare Vault'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onJumpToSection('cloudflare')}
                  className="rounded border border-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-200 hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  Open
                </button>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-300">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span>Home Chat &amp; Lark Watcher</span>
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold text-white tabular-nums">
                    {hud?.unansweredChatsCount ?? 0} unanswered
                  </div>
                  <div className="font-mono text-[11px] text-slate-400 tabular-nums">
                    {hud?.openChatsCount ?? 0} open · {hud?.larkSmtpConnected ? 'Lark SMTP Ready' : 'SMTP Unconfigured'}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={scanningInquiries}
                    onClick={handleScanUnansweredInquiries}
                    className="rounded border border-emerald-500/40 px-2 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-950/60 disabled:opacity-50 whitespace-nowrap"
                  >
                    {scanningInquiries ? 'Scanning...' : 'Scan Chats'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onJumpToSection('inbox')}
                    className="rounded border border-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-200 hover:bg-slate-800 whitespace-nowrap"
                  >
                    Inbox
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-violet-300">
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    <span>Active 24h Demo Passes</span>
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold text-white tabular-nums">
                    {hud?.activeDemoUsersCount ?? 0} active
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {hud?.adminOnline ? 'Back Office Operator Online' : 'Offline Fallback Armed'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onJumpToSection('demo_users')}
                  className="rounded border border-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-200 hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  Leads
                </button>
              </div>
            </div>

            {watcherNotice && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-xs text-emerald-200">
                {watcherNotice}
              </div>
            )}
          </div>

          {/* Main 2-Col Map + Selected Agent Inspector */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Animated Isometric Floor Map (7 cols) */}
            <div className="lg:col-span-7 space-y-4 min-w-0">
              <VirtualOfficeMap
                profiles={profiles}
                reports={agents}
                selectedAgentId={selectedAgentId}
                onSelectAgent={(id) => {
                  setSelectedAgentId(id);
                  setCustomizeOpen(false);
                }}
                speechTick={speechTick}
                walkTick={walkTick}
                continuousWalk={continuousWalk}
                visitors={hud?.visitors || []}
                selectedVisitorId={selectedVisitorId}
                onSelectVisitor={setSelectedVisitorId}
              />

              {/* 7-Agent Interactive Roster Grid */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Users className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
                    <span>Agent Roster ({agents.length} Agents)</span>
                  </div>
                  <span className="text-[11px] text-slate-500">Click an agent to inspect or customize</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                  {profiles.map((prof) => {
                    const rep = agents.find((a) => a.id === prof.agent_id);
                    const isSelected = prof.agent_id === selectedAgentId;
                    const wb = WORK_BADGE[prof.work_status];
                    const st = rep ? STATUS_LABEL[rep.status] : STATUS_LABEL.healthy;
                    return (
                      <button
                        key={prof.agent_id}
                        type="button"
                        onClick={() => {
                          setSelectedAgentId(prof.agent_id);
                          setCustomizeOpen(false);
                        }}
                        className={`rounded-xl border p-3 text-left transition-colors ${
                          isSelected
                            ? 'border-[var(--gs-primary)] bg-[var(--gs-soft-bg)]'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: prof.accent_color }}
                            />
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {prof.display_name}
                            </span>
                          </span>
                          <span
                            className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold shrink-0 ${wb.cls}`}
                          >
                            {wb.text}
                          </span>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between gap-2">
                          <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                            {rep ? `${rep.score}%` : '—'}
                          </span>
                          <span className={`text-[11px] font-semibold ${st.cls}`}>{st.text}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500 truncate">{prof.desk_label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Selected Agent Inspector & Customizer (5 cols) */}
            {activeAgent && (
              <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between space-y-4 min-w-0">
                <div className="space-y-4">
                  {/* Inspector Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold text-xs shrink-0"
                        style={{ backgroundColor: activeProfile.accent_color }}
                      >
                        {activeProfile.display_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-sm font-bold text-slate-900 truncate">
                            {activeProfile.display_name}
                          </h3>
                          <span
                            className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                              WORK_BADGE[activeProfile.work_status].cls
                            }`}
                          >
                            {WORK_BADGE[activeProfile.work_status].text}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 truncate">
                          {activeProfile.custom_role}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCustomizeOpen((p) => !p)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
                          customizeOpen
                            ? 'border-amber-400 bg-amber-50 text-amber-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Palette className="h-3.5 w-3.5" />
                        <span>Customize</span>
                      </button>
                      {primaryJumpCheck?.targetTab && (
                        <button
                          type="button"
                          onClick={() => onJumpToSection(primaryJumpCheck.targetTab!)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[var(--gs-primary)] hover:bg-[var(--gs-soft-bg)]"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Open {primaryJumpCheck.targetTab}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Agent Customizer Panel */}
                  {customizeOpen && customDraft && (
                    <form
                      onSubmit={handleSaveCustomProfile}
                      className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-3"
                    >
                      <div className="text-xs font-bold text-slate-900">
                        Customize Agent Identity, Icon &amp; Desk Coordinates
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">
                            Display Name
                          </label>
                          <input
                            type="text"
                            value={customDraft.display_name}
                            onChange={(e) =>
                              setCustomDraft({ ...customDraft, display_name: e.target.value })
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">
                            Avatar Glyph
                          </label>
                          <select
                            value={customDraft.avatar_icon}
                            onChange={(e) =>
                              setCustomDraft({
                                ...customDraft,
                                avatar_icon: e.target.value as AgentAvatarIcon
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                          >
                            {AVATAR_ICON_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700">
                          Role Description
                        </label>
                        <input
                          type="text"
                          value={customDraft.custom_role}
                          onChange={(e) =>
                            setCustomDraft({ ...customDraft, custom_role: e.target.value })
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700">
                          Current Desk Mission
                        </label>
                        <input
                          type="text"
                          value={customDraft.current_mission}
                          onChange={(e) =>
                            setCustomDraft({ ...customDraft, current_mission: e.target.value })
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">
                            Station Label
                          </label>
                          <input
                            type="text"
                            value={customDraft.desk_label}
                            onChange={(e) =>
                              setCustomDraft({ ...customDraft, desk_label: e.target.value })
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">
                            Desk X ({customDraft.desk_x})
                          </label>
                          <input
                            type="range"
                            min="4.4"
                            max="11.2"
                            step="0.1"
                            value={customDraft.desk_x}
                            onChange={(e) =>
                              setCustomDraft({ ...customDraft, desk_x: Number(e.target.value) })
                            }
                            className="mt-2 w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">
                            Desk Y ({customDraft.desk_y})
                          </label>
                          <input
                            type="range"
                            min="0.9"
                            max="6.6"
                            step="0.1"
                            value={customDraft.desk_y}
                            onChange={(e) =>
                              setCustomDraft({ ...customDraft, desk_y: Number(e.target.value) })
                            }
                            className="mt-2 w-full"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5">
                          {ACCENT_SWATCHES.map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              onClick={() => setCustomDraft({ ...customDraft, accent_color: hex })}
                              className={`h-5 w-5 rounded-full border-2 ${
                                customDraft.accent_color === hex ? 'border-slate-900 scale-110' : 'border-white'
                              }`}
                              style={{ backgroundColor: hex }}
                              aria-label={`Select accent ${hex}`}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setCustomizeOpen(false)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={savingCustom}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                          >
                            {savingCustom ? 'Saving...' : 'Save Agent'}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  {/* 4 Inspector Tabs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1">
                    {(
                      [
                        { id: 'status', label: 'Task & Status' },
                        { id: 'conversation', label: `Chat (${agentConversations.length})` },
                        { id: 'collab', label: 'Collaboration' },
                        { id: 'roadmap', label: 'Roadmap' }
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setInspectorTab(tab.id)}
                        className={`rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                          inspectorTab === tab.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* TAB 1: Task & Status */}
                  {inspectorTab === 'status' && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-950 p-3.5 text-white">
                        <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          <span>Current Ongoing Mission</span>
                          <span className="text-amber-300">
                            {activeProfile.work_status === 'working'
                              ? 'AT DESK'
                              : activeProfile.work_status === 'walking'
                                ? 'EN ROUTE TO DESK'
                                : 'IN LOUNGE'}
                          </span>
                        </div>
                        <div className="mt-1 text-xs font-bold text-white">
                          {activeProfile.current_mission}
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-slate-400">
                          Station: {activeProfile.desk_label} (x={activeProfile.desk_x}, y={activeProfile.desk_y})
                        </div>
                      </div>

                      {/* Dispatch / Lounge Controls */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleAgentDeskToggle(activeAgent.id, 'working')}
                          className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                        >
                          <Play className="h-3.5 w-3.5" />
                          <span>Dispatch {activeProfile.display_name.split(' ')[0]} to Desk</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAgentDeskToggle(activeAgent.id, 'idle')}
                          className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Coffee className="h-3.5 w-3.5" />
                          <span>Lounge</span>
                        </button>
                      </div>

                      {/* Deterministic Checks List */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-bold text-slate-900">
                            Deterministic Audit Checks ({activeAgent.score}%)
                          </span>
                          <div className="inline-flex rounded-md bg-slate-100 p-0.5 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setRuleFilter('all')}
                              className={`rounded px-2 py-0.5 font-medium ${
                                ruleFilter === 'all' ? 'bg-white text-slate-900' : 'text-slate-600'
                              }`}
                            >
                              All ({activeAgent.checks.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setRuleFilter('attention')}
                              className={`rounded px-2 py-0.5 font-medium ${
                                ruleFilter === 'attention' ? 'bg-white text-slate-900' : 'text-slate-600'
                              }`}
                            >
                              Flagged
                            </button>
                          </div>
                        </div>

                        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 px-3">
                          {visibleChecks.length === 0 ? (
                            <p className="py-5 text-center text-xs text-slate-500">
                              All diagnostic checks are passing.
                            </p>
                          ) : (
                            visibleChecks.map((check) => (
                              <div key={check.id} className="py-2.5 flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2 min-w-0">
                                  {check.status === 'pass' ? (
                                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                  ) : check.status === 'warning' ? (
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                                  ) : (
                                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                                  )}
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-slate-900">
                                      {check.label}{' '}
                                      <span className="font-mono font-normal text-slate-500">
                                        ({check.metric})
                                      </span>
                                    </div>
                                    <p className="mt-0.5 text-[11px] text-slate-600">{check.detail}</p>
                                  </div>
                                </div>
                                {check.targetTab && check.actionLabel && (
                                  <button
                                    type="button"
                                    onClick={() => onJumpToSection(check.targetTab!)}
                                    className="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-[var(--gs-primary)] hover:bg-[var(--gs-soft-bg)] shrink-0"
                                  >
                                    {check.actionLabel}
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Persisted Action Checklist */}
                      <div className="border-t border-slate-200 pt-3">
                        <div className="text-xs font-bold text-slate-900 mb-2">
                          Action Checklist ({agentTasks.filter((t) => !t.completed).length} open)
                        </div>
                        <form onSubmit={handleAddTask} className="flex gap-2">
                          <input
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder={`Add ${activeProfile.display_name.split(' ')[0]} task...`}
                            className="min-h-[38px] flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                          />
                          <select
                            value={newTaskPriority}
                            onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                            className="min-h-[38px] rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
                          >
                            <option value="high">High</option>
                            <option value="medium">Med</option>
                            <option value="low">Low</option>
                          </select>
                          <button
                            type="submit"
                            disabled={savingTask || !newTaskTitle.trim()}
                            className="inline-flex min-h-[38px] items-center gap-1 rounded-lg bg-[var(--gs-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </form>

                        <div className="mt-2.5 max-h-40 overflow-y-auto divide-y divide-slate-100">
                          {agentTasks.map((task) => (
                            <div key={task.id} className="py-2 flex items-start justify-between gap-2">
                              <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={task.completed}
                                  onChange={() => onToggleTask(task)}
                                  className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300"
                                />
                                <span
                                  className={`text-xs ${
                                    task.completed ? 'line-through text-slate-400' : 'text-slate-800'
                                  }`}
                                >
                                  {task.title}
                                </span>
                              </label>
                              <button
                                type="button"
                                onClick={() => onDeleteTask(task.id)}
                                aria-label={`Delete task ${task.title}`}
                                className="text-slate-400 hover:text-red-700 p-0.5 shrink-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: Agent Conversation Stream */}
                  {inspectorTab === 'conversation' && (
                    <div className="space-y-3">
                      <div className="max-h-80 overflow-y-auto space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        {agentConversations.length === 0 ? (
                          <p className="py-8 text-center text-xs text-slate-500">
                            No recorded conversation entries for {activeProfile.display_name} yet.
                          </p>
                        ) : (
                          agentConversations.map((entry) => (
                            <div
                              key={entry.id}
                              className={`rounded-lg border p-2.5 text-xs ${
                                entry.sender_type === 'operator'
                                  ? 'border-blue-200 bg-blue-50/70'
                                  : entry.sender_type === 'handoff'
                                    ? 'border-violet-200 bg-violet-50/70'
                                    : 'border-slate-200 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 text-[10px] font-semibold">
                                <span className="text-slate-900">
                                  {entry.sender_name}
                                  {entry.peer_agent_id && ` → ${entry.peer_agent_id}`}
                                </span>
                                <span className="font-mono text-slate-400">
                                  {new Date(entry.created_at).toLocaleTimeString()}
                                </span>
                              </div>
                              <p className="mt-1 text-slate-700 leading-relaxed">{entry.message}</p>
                            </div>
                          ))
                        )}
                      </div>

                      <form onSubmit={handleSendConversation} className="flex gap-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder={`Ask ${activeProfile.display_name.split(' ')[0]} about status or tasks...`}
                          className="min-h-[40px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={sendingChat || !chatInput.trim()}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Send</span>
                        </button>
                      </form>
                    </div>
                  )}

                  {/* TAB 3: Inter-Agent Collaboration */}
                  {inspectorTab === 'collab' && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500">
                        Trigger a deterministic peer handoff to synchronize status and surface cross-module dependencies.
                      </p>
                      <div className="space-y-2.5">
                        {(AGENT_COLLABORATION_MAP[selectedAgentId] || []).map((peerId) => {
                          const peerProf = profiles.find((p) => p.agent_id === peerId);
                          const peerRep = agents.find((a) => a.id === peerId);
                          return (
                            <div
                              key={peerId}
                              className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="h-2.5 w-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: peerProf?.accent_color || '#2563EB' }}
                                  />
                                  <span className="text-xs font-bold text-slate-900 truncate">
                                    {peerProf?.display_name || peerId}
                                  </span>
                                  <span className="font-mono text-[11px] text-slate-500">
                                    {peerRep ? `${peerRep.score}%` : '—'}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                                  {peerProf?.custom_role}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={sendingChat}
                                onClick={() => handleSendHandoff(peerId)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-[var(--gs-primary)] hover:bg-[var(--gs-soft-bg)] shrink-0 disabled:opacity-50"
                              >
                                Send Handoff
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: Plan & Roadmap */}
                  {inspectorTab === 'roadmap' && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                        <div className="font-bold text-slate-900">
                          {activeProfile.display_name} Stabilization Roadmap
                        </div>
                        <p className="mt-1 text-slate-600">{activeAgent.summary}</p>
                      </div>

                      <div className="space-y-2">
                        {activeAgent.checks
                          .filter((c) => c.status !== 'pass')
                          .map((c, idx) => (
                            <div
                              key={c.id}
                              className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs"
                            >
                              <div className="font-semibold text-amber-900">
                                Milestone {idx + 1}: Resolve {c.label}
                              </div>
                              <p className="mt-0.5 text-amber-800">{c.detail}</p>
                            </div>
                          ))}
                        {activeAgent.checks.every((c) => c.status === 'pass') && (
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                            All {activeAgent.checks.length} operational guardrails are currently passing at {activeAgent.score}%. Focus on completing open checklist tasks.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Collapsible Live Agent Telemetry & Automation Feed */}
          <div className="rounded-xl border border-slate-800 bg-[#0B1120] text-slate-100">
            <button
              type="button"
              onClick={() => setFeedOpen((p) => !p)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-xs font-bold tracking-wider uppercase text-slate-300 hover:text-white"
            >
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                <span>Live Agent Telemetry &amp; Conversation Feed ({conversations.length})</span>
              </span>
              {feedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {feedOpen && (
              <div className="border-t border-slate-800 max-h-60 overflow-y-auto divide-y divide-slate-800/70 px-4">
                {conversations.slice(0, 20).map((entry) => (
                  <div key={entry.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white">{entry.sender_name}</span>
                          {entry.peer_agent_id && (
                            <span className="rounded bg-violet-500/20 px-1.5 py-0.5 font-mono text-[10px] text-violet-300">
                              handoff → {entry.peer_agent_id}
                            </span>
                          )}
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                              entry.finding_status === 'nominal'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : entry.finding_status === 'attention'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : entry.finding_status === 'critical'
                                    ? 'bg-red-500/20 text-red-300'
                                    : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {entry.finding_status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-slate-300">{entry.message}</p>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500 whitespace-nowrap shrink-0">
                      {new Date(entry.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
