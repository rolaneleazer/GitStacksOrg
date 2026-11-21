import {
  Activity,
  AlertTriangle,
  Bot,
  Bug,
  CheckCircle2,
  Code2,
  Download,
  ExternalLink,
  FileText,
  Filter,
  FolderGit2,
  Mail,
  Play,
  RefreshCw,
  Save,
  Search,
  Send,
  Sparkles,
  XCircle
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval.ts';
import { api, getRealtimeWsUrl, getStoredToken } from '../../lib/api.ts';
import type {
  ProductQaDashboardResponse,
  ProductQaLog,
  ProductQaReport,
  ProductQaSettings,
  QaLogStatus,
  UserRole
} from '../../shared/types.ts';

interface ProductQaPanelProps {
  currentUserRole: UserRole;
  onOpenSettings?: () => void;
}

type QaSubTab = 'features' | 'logs' | 'breakdown' | 'reports';

export function ProductQaPanel({ currentUserRole, onOpenSettings }: ProductQaPanelProps) {
  const canEditSettings = currentUserRole === 'super_admin' || currentUserRole === 'editor';

  const [subTab, setSubTab] = useState<QaSubTab>('features');
  const [data, setData] = useState<ProductQaDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [analyzingLogId, setAnalyzingLogId] = useState<string | null>(null);
  const [acceptingBaselineId, setAcceptingBaselineId] = useState<string | null>(null);
  const [sendingReport, setSendingReport] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | QaLogStatus>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');

  // Selected items
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Settings draft
  const [settingsForm, setSettingsForm] = useState<ProductQaSettings>({
    id: 'default',
    agent_enabled: true,
    realtime_alert_on_critical: false,
    eod_enabled: true,
    eod_hour_utc: 15,
    recipient_email: '',
    last_eod_sent_date: '',
    last_scan_at: null,
    updated_at: new Date().toISOString()
  });

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getQaDashboard();
      setData(res);
      setSettingsForm(res.settings);
      setSelectedLogId((prev) => prev || res.logs[0]?.id || null);
      setSelectedReportId((prev) => prev || res.reports[0]?.id || null);
    } catch (err) {
      if (!silent) {
        setNotice({
          type: 'err',
          text: err instanceof Error ? err.message : 'Unable to load Product QA dashboard.'
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  // Real-time WebSocket stream + 3-minute visibility-aware fallback polling
  useVisibilityInterval(() => {
    loadDashboard(true);
  }, 180_000);

  useEffect(() => {
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
              payload?: { log?: ProductQaLog; report?: ProductQaReport };
            };
            if (msg.type === 'qa:log_created' || msg.type === 'qa:report_sent') {
              loadDashboard(true);
            }
          } catch {
            // ignore malformed frame
          }
        };
      }
    } catch {
      // polling handles fallback
    }

    return () => {
      if (ws && ws.readyState < 2) ws.close();
    };
  }, [loadDashboard]);

  const allModules = useMemo(() => {
    const set = new Set<string>();
    for (const l of data?.logs || []) {
      if (l.module_name) set.add(l.module_name);
    }
    return Array.from(set).sort();
  }, [data?.logs]);

  const filteredLogs = useMemo(() => {
    const list = data?.logs || [];
    const q = searchQuery.trim().toLowerCase();
    return list.filter((l) => {
      if (levelFilter !== 'all' && l.level !== levelFilter) return false;
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (moduleFilter !== 'all' && l.module_name !== moduleFilter) return false;
      if (!q) return true;
      return (
        l.module_name.toLowerCase().includes(q) ||
        l.page_path.toLowerCase().includes(q) ||
        l.code_location.toLowerCase().includes(q) ||
        l.message.toLowerCase().includes(q) ||
        l.error_name.toLowerCase().includes(q)
      );
    });
  }, [data?.logs, levelFilter, statusFilter, moduleFilter, searchQuery]);

  const activeLog = useMemo(
    () =>
      filteredLogs.find((l) => l.id === selectedLogId) ||
      filteredLogs[0] ||
      (data?.logs || []).find((l) => l.id === selectedLogId) ||
      null,
    [filteredLogs, data?.logs, selectedLogId]
  );

  const activeReport = useMemo(
    () =>
      (data?.reports || []).find((r) => r.id === selectedReportId) ||
      data?.reports?.[0] ||
      null,
    [data?.reports, selectedReportId]
  );

  const handleRunLiveScan = async () => {
    if (scanning) return;
    setScanning(true);
    setNotice(null);
    try {
      const res = await api.runQaScan();
      setData(res.dashboard);
      setNotice({
        type: 'ok',
        text: `Live QA Agent scan complete (${res.analyzedCount} new log(s) diagnosed).`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Live QA scan failed.'
      });
    } finally {
      setScanning(false);
    }
  };

  const handleSimulate = async (preset: 'demo_sandbox' | 'cloudflare_edge' | 'live_chat') => {
    if (simulating) return;
    setSimulating(preset);
    setNotice(null);
    try {
      const res = await api.simulateQaEvent(preset);
      setData(res.dashboard);
      setSelectedLogId(res.log.id);
      setSubTab('logs');
      setNotice({
        type: 'ok',
        text: `Captured & diagnosed ${res.log.error_name} in module "${res.log.module_name}" (${res.log.page_path} · ${res.log.code_location}).`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to simulate QA event.'
      });
    } finally {
      setSimulating(null);
    }
  };

  const handleReanalyzeLog = async (logId: string) => {
    setAnalyzingLogId(logId);
    setNotice(null);
    try {
      const res = await api.analyzeQaLog(logId);
      setData((prev) =>
        prev
          ? {
              ...prev,
              logs: prev.logs.map((l) => (l.id === logId ? res.log : l))
            }
          : prev
      );
      setNotice({
        type: 'ok',
        text: 'Updated AI root-cause diagnosis and code fix recommendation.'
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to analyze log.'
      });
    } finally {
      setAnalyzingLogId(null);
    }
  };

  const handleStatusChange = async (logId: string, status: QaLogStatus) => {
    try {
      const res = await api.updateQaLogStatus(logId, status);
      setData((prev) =>
        prev
          ? {
              ...prev,
              logs: prev.logs.map((l) => (l.id === logId ? res.log : l))
            }
          : prev
      );
      loadDashboard(true);
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update log status.'
      });
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canEditSettings || savingSettings) return;
    setSavingSettings(true);
    setNotice(null);
    try {
      const res = await api.saveQaSettings(settingsForm);
      setSettingsForm(res.settings);
      await loadDashboard(true);
      setNotice({
        type: 'ok',
        text: 'Live QA Agent & End-of-Day PDF schedule saved.'
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to save QA settings.'
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendEodReportNow = async () => {
    if (sendingReport) return;
    setSendingReport(true);
    setNotice(null);
    try {
      const res = await api.sendQaEodReport({
        recipient_email: settingsForm.recipient_email.trim() || undefined
      });
      await loadDashboard(true);
      setSelectedReportId(res.report.id);
      setSubTab('reports');
      setNotice({
        type: res.delivered ? 'ok' : 'err',
        text: res.message
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to generate EOD PDF report.'
      });
    } finally {
      setSendingReport(false);
    }
  };

  const handleAcceptFeatureBaseline = async (featureId: string) => {
    if (!canEditSettings || acceptingBaselineId) return;
    setAcceptingBaselineId(featureId);
    setNotice(null);
    try {
      const res = await api.acceptQaFeatureBaseline(featureId);
      setData((prev) =>
        prev
          ? {
              ...prev,
              featureChecks: res.featureChecks,
              settings: res.settings
            }
          : prev
      );
      setNotice({
        type: 'ok',
        text:
          featureId === 'all'
            ? 'Accepted all 16 system module configurations as the new planned baseline.'
            : 'Accepted current module state as the new planned baseline specification.'
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update feature baseline.'
      });
    } finally {
      setAcceptingBaselineId(null);
    }
  };

  const summary = data?.summary || {
    healthScore: 100,
    totalLogs24h: 0,
    openErrorsCount: 0,
    openWarnsCount: 0,
    resolvedCount: 0,
    topFailingModule: 'None (Clean)',
    topFailingPage: '/',
    topCodeHotspot: 'None detected'
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-[var(--gs-primary)] shrink-0" />
            <h2 className="font-display text-base font-bold text-slate-900">
              Product QA Telemetry, Root-Cause Agent &amp; EOD PDF Reporter
            </h2>
          </div>
          <p className="text-xs text-slate-600">
            Captures product errors in real time, pinpoints which module, page route, and code file/line failed, and dispatches an End-of-Day executive PDF report to your Lark Mail.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadDashboard(false)}
            disabled={loading}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleRunLiveScan}
            disabled={scanning}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Bot className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
            <span>{scanning ? 'Scanning Logs...' : 'Run Live QA Agent Scan'}</span>
          </button>
          <button
            type="button"
            onClick={handleSendEodReportNow}
            disabled={sendingReport}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
            <span>
              {sendingReport ? 'Generating PDF & Sending...' : 'Send EOD PDF Report Now'}
            </span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
            notice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <span>{notice.text}</span>
          {!data?.larkConnected && onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Connect Lark Mail SMTP
            </button>
          )}
        </div>
      )}

      {/* 4 KPI Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-medium text-slate-500">Product Health Score</div>
          <div
            className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${
              summary.healthScore >= 90
                ? 'text-[#16A34A]'
                : summary.healthScore >= 70
                  ? 'text-[#D97706]'
                  : 'text-[#DC2626]'
            }`}
          >
            {summary.healthScore}%
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Live QA Agent: {settingsForm.agent_enabled ? 'Monitoring Active' : 'Paused'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-medium text-slate-500">Open Errors &amp; Warnings</div>
          <div className="mt-1.5 font-mono text-xl font-bold text-slate-900 tabular-nums">
            <span className={summary.openErrorsCount > 0 ? 'text-[#DC2626]' : 'text-slate-900'}>
              {summary.openErrorsCount} err
            </span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className={summary.openWarnsCount > 0 ? 'text-[#D97706]' : 'text-slate-600'}>
              {summary.openWarnsCount} warn
            </span>
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
            {summary.totalLogs24h} events in last 24h · {summary.resolvedCount} resolved
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-medium text-slate-500">Top Affected Module &amp; Page</div>
          <div className="mt-1.5 text-sm font-bold text-slate-900 truncate">
            {summary.topFailingModule}
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-500 truncate">
            Route: {summary.topFailingPage}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-medium text-slate-500">Primary Code Hotspot</div>
          <div className="mt-1.5 font-mono text-xs font-bold text-slate-900 truncate">
            {summary.topCodeHotspot}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">
            EOD PDF target: {data?.resolvedRecipientEmail || 'Connected Lark Mail'}
          </div>
        </div>
      </div>

      {/* Sub-navigation + Quick Test Simulation Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-full lg:w-fit">
          <button
            type="button"
            onClick={() => setSubTab('features')}
            className={`min-h-[38px] flex-1 lg:flex-none rounded-md px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
              subTab === 'features' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            System Features &amp; Spec Drift ({data?.featureChecks?.length || 16})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('logs')}
            className={`min-h-[38px] flex-1 lg:flex-none rounded-md px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
              subTab === 'logs' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Live Error Stream &amp; Code Inspector ({data?.logs.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('breakdown')}
            className={`min-h-[38px] flex-1 lg:flex-none rounded-md px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
              subTab === 'breakdown' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Module, Page &amp; Code Hotspots ({data?.moduleBreakdown.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('reports')}
            className={`min-h-[38px] flex-1 lg:flex-none rounded-md px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
              subTab === 'reports' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            End-of-Day PDF Reports &amp; Schedule ({data?.reports.length || 0})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500">Test Live QA Agent:</span>
          <button
            type="button"
            disabled={Boolean(simulating)}
            onClick={() => handleSimulate('demo_sandbox')}
            className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            <Play className="h-3 w-3 text-[#DC2626]" />
            <span>
              {simulating === 'demo_sandbox' ? 'Capturing...' : 'Simulate Demo Page Error'}
            </span>
          </button>
          <button
            type="button"
            disabled={Boolean(simulating)}
            onClick={() => handleSimulate('cloudflare_edge')}
            className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            <Play className="h-3 w-3 text-[#D97706]" />
            <span>
              {simulating === 'cloudflare_edge' ? 'Capturing...' : 'Simulate Cloudflare 503'}
            </span>
          </button>
          <button
            type="button"
            disabled={Boolean(simulating)}
            onClick={() => handleSimulate('live_chat')}
            className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            <Play className="h-3 w-3 text-[var(--gs-primary)]" />
            <span>{simulating === 'live_chat' ? 'Capturing...' : 'Simulate Chat Timeout'}</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 0: SYSTEM FEATURES DAILY VERIFICATION & PLANNED SPEC DRIFT */}
      {subTab === 'features' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  All System Features — Daily Functional Verification &amp; Planned Specification Drift
                </h3>
                <p className="text-xs text-slate-600">
                  Every system module is tested daily against its planned architecture blueprint. If a module is edited or customized, its live fingerprint diverges from the baseline so you can immediately distinguish <strong>IDENTICAL</strong> modules from <strong>MODIFIED / MAJOR UPDATES</strong>. Included in your daily EOD PDF report.
                </p>
              </div>
              {canEditSettings && (
                <button
                  type="button"
                  disabled={Boolean(acceptingBaselineId)}
                  onClick={() => handleAcceptFeatureBaseline('all')}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
                  <span>
                    {acceptingBaselineId === 'all'
                      ? 'Updating Baselines...'
                      : 'Accept All Current States as Baseline'}
                  </span>
                </button>
              )}
            </div>

            {/* Feature Drift Summary Strip */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium text-slate-500">
                    Daily Functional Feature Tests
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-slate-700">
                    Verified live &amp; included in EOD PDF
                  </div>
                </div>
                <span className="font-mono text-lg font-bold text-[#16A34A] tabular-nums">
                  {(data?.featureChecks || []).filter((f) => f.test_status === 'passing').length}/
                  {(data?.featureChecks || []).length || 16} Passing
                </span>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium text-slate-500">
                    Identical to Planned Blueprint
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-slate-700">
                    Baseline Hash == Live Hash
                  </div>
                </div>
                <span className="font-mono text-lg font-bold text-[var(--gs-primary)] tabular-nums">
                  {(data?.featureChecks || []).filter((f) => f.drift_status === 'identical').length}{' '}
                  Identical
                </span>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium text-slate-500">
                    Edited / Major Module Updates
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-slate-700">
                    Detected since initial baseline
                  </div>
                </div>
                <span className="font-mono text-lg font-bold text-purple-700 tabular-nums">
                  {
                    (data?.featureChecks || []).filter((f) => f.drift_status !== 'identical')
                      .length
                  }{' '}
                  Updated
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 pr-3">System Feature &amp; Module</th>
                    <th className="py-2.5 px-3">Daily Test</th>
                    <th className="py-2.5 px-3">Spec vs Planned</th>
                    <th className="py-2.5 px-3">Fingerprint (Base → Live)</th>
                    <th className="py-2.5 px-3">Verification &amp; Change Summary</th>
                    <th className="py-2.5 pl-3 text-right">Baseline Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {(data?.featureChecks || []).map((feat) => {
                    const isIdentical = feat.drift_status === 'identical';
                    const isMajor = feat.drift_status === 'major_update';
                    return (
                      <tr key={feat.id} className="hover:bg-slate-50/80 align-top">
                        <td className="py-3.5 pr-3 max-w-[260px]">
                          <div className="font-semibold text-slate-900">{feat.feature_name}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                            <span>{feat.module_name}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-[var(--gs-primary)]">
                              {feat.route_or_endpoint}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                            Plan: {feat.planned_spec}
                          </div>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase ${
                              feat.test_status === 'passing'
                                ? 'text-[#16A34A]'
                                : feat.test_status === 'degraded'
                                  ? 'text-[#D97706]'
                                  : 'text-[#DC2626]'
                            }`}
                          >
                            {feat.test_status === 'passing' ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5" />
                            )}
                            <span>{feat.test_status}</span>
                          </span>
                          <div className="mt-1 text-[11px] text-slate-500 max-w-[170px] whitespace-normal">
                            {feat.test_detail}
                          </div>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block rounded px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase ${
                              isIdentical
                                ? 'bg-blue-50 text-[var(--gs-primary)] border border-blue-200'
                                : isMajor
                                  ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {isIdentical
                              ? 'IDENTICAL TO PLAN'
                              : isMajor
                                ? 'MAJOR UPDATE'
                                : 'MODIFIED'}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          <div>Base: {feat.baseline_fingerprint}</div>
                          <div
                            className={
                              isIdentical
                                ? 'text-slate-500'
                                : 'font-bold text-purple-700'
                            }
                          >
                            Live: {feat.current_fingerprint}
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-slate-700 max-w-[290px] leading-relaxed">
                          {feat.change_summary}
                        </td>

                        <td className="py-3.5 pl-3 text-right whitespace-nowrap">
                          {!isIdentical && canEditSettings ? (
                            <button
                              type="button"
                              disabled={acceptingBaselineId === feat.id}
                              onClick={() => handleAcceptFeatureBaseline(feat.id)}
                              className="min-h-[34px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
                            >
                              {acceptingBaselineId === feat.id
                                ? 'Saving...'
                                : 'Accept as Baseline'}
                            </button>
                          ) : (
                            <span className="font-mono text-[11px] text-slate-400">
                              Baseline Synced
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 1: LIVE LOGS & CODE INSPECTOR */}
      {subTab === 'logs' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search error message, module, page route (/demo), or code file (src/pages/...)..."
                className="min-h-[40px] w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                aria-label="Filter by module"
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
              >
                <option value="all">All Modules</option>
                {allModules.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by severity"
                value={levelFilter}
                onChange={(e) =>
                  setLevelFilter(e.target.value as 'all' | 'error' | 'warn' | 'info')
                }
                className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
              >
                <option value="all">All Levels</option>
                <option value="error">Errors Only</option>
                <option value="warn">Warnings Only</option>
                <option value="info">Info Only</option>
              </select>

              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | QaLogStatus)}
                className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
                <option value="ignored">Ignored</option>
              </select>
            </div>
          </div>

          {/* Master-Detail Log Stream & Root-Cause Inspector */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 lg:col-span-5 max-h-[580px] overflow-y-auto">
              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <div className="text-xs font-semibold text-slate-800">
                    No product logs match your current filter.
                  </div>
                  <p className="text-xs text-slate-500">
                    Real-time frontend runtime exceptions and backend 5xx errors appear here automatically, or click one of the Simulate buttons above to test the Live QA Agent.
                  </p>
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const active = activeLog?.id === log.id;
                  return (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => setSelectedLogId(log.id)}
                      className={`w-full p-4 text-left transition-colors ${
                        active ? 'bg-[var(--gs-soft-bg)]' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-900 truncate">
                          {log.module_name}
                        </span>
                        <span
                          className={`font-mono text-[10.5px] font-bold uppercase shrink-0 ${
                            log.status === 'resolved'
                              ? 'text-[#16A34A]'
                              : log.level === 'error'
                                ? 'text-[#DC2626]'
                                : 'text-[#D97706]'
                          }`}
                        >
                          {log.status === 'resolved' ? 'RESOLVED' : log.level.toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-800 line-clamp-2">
                        {log.error_name}: {log.message}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-slate-500">
                        <span className="text-[var(--gs-primary)]">{log.page_path}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate max-w-[200px]">
                          {log.code_location || log.source}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Right Pane: Code & AI Root Cause Inspector */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-7 space-y-5">
              {activeLog ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span
                          className={`font-mono font-bold uppercase ${
                            activeLog.level === 'error'
                              ? 'text-[#DC2626]'
                              : activeLog.level === 'warn'
                                ? 'text-[#D97706]'
                                : 'text-slate-700'
                          }`}
                        >
                          {activeLog.level}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Source: {activeLog.source}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {new Date(activeLog.created_at).toLocaleString()}
                        </span>
                      </div>
                      <h3 className="font-display text-base font-bold text-slate-900 break-words">
                        {activeLog.error_name}: {activeLog.message}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <select
                        aria-label="Update QA issue status"
                        value={activeLog.status}
                        onChange={(e) =>
                          handleStatusChange(activeLog.id, e.target.value as QaLogStatus)
                        }
                        className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                      >
                        <option value="open">Open</option>
                        <option value="investigating">Investigating</option>
                        <option value="resolved">Resolved</option>
                        <option value="ignored">Ignored</option>
                      </select>

                      <button
                        type="button"
                        disabled={analyzingLogId === activeLog.id}
                        onClick={() => handleReanalyzeLog(activeLog.id)}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-[var(--gs-primary)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--gs-primary)] hover:bg-[var(--gs-soft-bg)] disabled:opacity-60 whitespace-nowrap"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>
                          {analyzingLogId === activeLog.id
                            ? 'Diagnosing...'
                            : 'Re-Analyze with AI'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Attribution Grid: Module, Page, Code Location */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                      <div className="text-[11px] font-medium text-slate-500">
                        Originating Module
                      </div>
                      <div className="mt-1 text-xs font-bold text-slate-900">
                        {activeLog.module_name}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                      <div className="text-[11px] font-medium text-slate-500">
                        Affected Page / Route
                      </div>
                      <div className="mt-1 font-mono text-xs font-bold text-[var(--gs-primary)] break-all">
                        {activeLog.page_path}
                        {activeLog.request_path
                          ? ` (${activeLog.request_method || 'API'} ${activeLog.request_path})`
                          : ''}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                      <div className="text-[11px] font-medium text-slate-500">
                        Exact Part of Code
                      </div>
                      <div className="mt-1 font-mono text-xs font-bold text-slate-900 break-all">
                        {activeLog.code_location || 'Runtime / Unmapped frame'}
                      </div>
                    </div>
                  </div>

                  {/* Live QA Agent Diagnosis & Code Fix */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Bot className="h-4 w-4 text-[var(--gs-primary)]" />
                      <span>Live QA Agent Root-Cause Analysis &amp; Recommended Fix</span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-500">
                        Why It Happened (Root Cause):
                      </div>
                      <p className="text-xs leading-relaxed text-slate-800">
                        {activeLog.ai_root_cause ||
                          'Click Re-Analyze with AI to generate root-cause attribution.'}
                      </p>
                    </div>
                    <div className="space-y-1 border-t border-slate-200 pt-2.5">
                      <div className="text-[11px] font-semibold text-[#16A34A]">
                        Suggested Engineering Fix:
                      </div>
                      <p className="text-xs leading-relaxed font-medium text-slate-900">
                        {activeLog.ai_fix_suggestion ||
                          'Add input validation and structured error boundary around the failing component.'}
                      </p>
                    </div>
                  </div>

                  {/* Raw Stack Trace */}
                  {activeLog.stack_trace && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span>Captured Call Stack / Trace</span>
                        <span className="font-mono text-[11px] text-slate-400">
                          Fingerprint: {activeLog.fingerprint}
                        </span>
                      </div>
                      <pre className="rounded-lg border border-slate-200 bg-slate-900 p-3.5 font-mono text-[11px] leading-relaxed text-slate-100 overflow-x-auto max-h-[200px]">
                        {activeLog.stack_trace}
                      </pre>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full min-h-[340px] items-center justify-center text-xs text-slate-500">
                  Select a product log entry on the left to inspect its module, page route, exact code line, and AI fix recommendation.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: MODULE, PAGE & CODE HOTSPOTS */}
      {subTab === 'breakdown' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Module Breakdown */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 lg:col-span-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <FolderGit2 className="h-4 w-4 text-[var(--gs-primary)]" />
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Errors by Product Module
                </h3>
              </div>
              <span className="text-xs text-slate-500">Click module to filter logs</span>
            </div>

            {(data?.moduleBreakdown || []).length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                No module errors recorded.
              </p>
            ) : (
              <div className="divide-y divide-slate-200">
                {(data?.moduleBreakdown || []).map((mod) => {
                  const maxTotal = Math.max(
                    1,
                    ...(data?.moduleBreakdown || []).map((m) => m.total_count)
                  );
                  const pct = Math.max(6, Math.round((mod.total_count / maxTotal) * 100));
                  return (
                    <button
                      key={mod.module_name}
                      type="button"
                      onClick={() => {
                        setModuleFilter(mod.module_name);
                        setSubTab('logs');
                      }}
                      className="w-full py-3.5 text-left hover:bg-slate-50 transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-900">{mod.module_name}</span>
                        <span className="font-mono tabular-nums text-slate-700">
                          <strong className="text-[#DC2626]">{mod.error_count} err</strong> ·{' '}
                          <span className="text-[#D97706]">{mod.warn_count} warn</span> ·{' '}
                          {mod.total_count} total
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            mod.error_count > 0 ? 'bg-[#DC2626]' : 'bg-[#D97706]'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 truncate">
                        Code: {mod.top_code_location}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Page Route Breakdown */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 lg:col-span-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[var(--gs-primary)]" />
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Errors by Page &amp; Route
                </h3>
              </div>
              <span className="text-xs text-slate-500">Exact URL route attribution</span>
            </div>

            {(data?.pageBreakdown || []).length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                No page errors recorded.
              </p>
            ) : (
              <div className="divide-y divide-slate-200">
                {(data?.pageBreakdown || []).map((pg) => (
                  <div key={pg.page_path} className="py-3 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono font-bold text-[var(--gs-primary)]">
                        {pg.page_path}
                      </span>
                      <span className="font-mono tabular-nums text-slate-700">
                        {pg.error_count} errors · {pg.total_count} events
                      </span>
                    </div>
                    <div className="text-xs text-slate-700">
                      Primary Module: <strong>{pg.top_module}</strong>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{pg.top_error}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Code Hotspots Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 lg:col-span-12">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-[var(--gs-primary)]" />
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Exact Code Location Hotspots (File, Line &amp; Function)
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Extracted from stack traces &amp; route handlers
              </span>
            </div>

            {(data?.codeHotspots || []).length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                No specific code hotspots recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                      <th className="py-2.5 pr-4">Code File : Line (Function)</th>
                      <th className="py-2.5 px-4">Module</th>
                      <th className="py-2.5 px-4">Latest Error Message</th>
                      <th className="py-2.5 pl-4 text-right">Occurrences</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {(data?.codeHotspots || []).map((hs) => (
                      <tr key={hs.code_location} className="hover:bg-slate-50">
                        <td className="py-3 pr-4 font-mono font-semibold text-slate-900">
                          {hs.code_location}
                        </td>
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                          {hs.module_name}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-md truncate">
                          {hs.latest_message}
                        </td>
                        <td className="py-3 pl-4 text-right font-mono font-bold text-[#DC2626] tabular-nums">
                          {hs.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: EOD PDF REPORTS & SCHEDULER */}
      {subTab === 'reports' && (
        <div className="space-y-6">
          {/* EOD Schedule Configuration Card */}
          <form
            onSubmit={handleSaveSettings}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Automated End-of-Day QA PDF Email Schedule
                </h3>
                <p className="text-xs text-slate-600">
                  The Live QA Agent compiles a daily executive summary and attaches a formatted PDF report to your Lark Mail.
                </p>
              </div>
              {canEditSettings && (
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{savingSettings ? 'Saving...' : 'Save QA Schedule'}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label
                  htmlFor="qa-recipient"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Report Recipient Email
                </label>
                <input
                  id="qa-recipient"
                  type="email"
                  disabled={!canEditSettings}
                  value={settingsForm.recipient_email}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({ ...prev, recipient_email: e.target.value }))
                  }
                  placeholder={data?.resolvedRecipientEmail || 'rolan@git-stack.org'}
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs text-slate-900"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Defaults to{' '}
                  <span className="font-mono text-slate-700">
                    {data?.resolvedRecipientEmail || 'Lark Mail'}
                  </span>
                </p>
              </div>

              <div>
                <label
                  htmlFor="qa-eod-hour"
                  className="block text-xs font-semibold text-slate-700"
                >
                  End-of-Day Dispatch Time (UTC)
                </label>
                <select
                  id="qa-eod-hour"
                  disabled={!canEditSettings}
                  value={settingsForm.eod_hour_utc}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      eod_hour_utc: Number(e.target.value)
                    }))
                  }
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <option key={hour} value={hour}>
                      {String(hour).padStart(2, '0')}:00 UTC
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Last EOD sent: {settingsForm.last_eod_sent_date || 'Not yet today'}
                </p>
              </div>

              <div className="flex flex-col justify-center space-y-2 pt-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditSettings}
                    checked={settingsForm.agent_enabled}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        agent_enabled: e.target.checked
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>Live Real-Time QA Agent Enabled</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditSettings}
                    checked={settingsForm.eod_enabled}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        eod_enabled: e.target.checked
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>Auto-Send Daily EOD PDF Report</span>
                </label>
              </div>

              <div className="flex flex-col justify-center space-y-2 pt-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditSettings}
                    checked={settingsForm.realtime_alert_on_critical}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        realtime_alert_on_critical: e.target.checked
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>Instant Lark Email on Critical Errors</span>
                </label>
                <span className="text-[11px] text-slate-500">
                  10-minute per-fingerprint cooldown
                </span>
              </div>
            </div>
          </form>

          {/* Generated PDF Reports Archive & Visual PDF Preview */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 lg:col-span-5 max-h-[560px] overflow-y-auto">
              <div className="px-4 py-3 flex items-center justify-between bg-slate-50/70">
                <span className="text-xs font-bold text-slate-900">
                  Dispatched &amp; Generated PDF Reports ({data?.reports.length || 0})
                </span>
              </div>

              {(data?.reports || []).length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <FileText className="mx-auto h-6 w-6 text-slate-400" />
                  <div className="text-xs font-semibold text-slate-800">
                    No EOD QA PDF reports generated yet.
                  </div>
                  <p className="text-xs text-slate-500">
                    Click <strong>Send EOD PDF Report Now</strong> in the top-right to generate your first executive PDF summary and send it to Lark Mail.
                  </p>
                </div>
              ) : (
                (data?.reports || []).map((rep) => {
                  const active = activeReport?.id === rep.id;
                  return (
                    <button
                      key={rep.id}
                      type="button"
                      onClick={() => setSelectedReportId(rep.id)}
                      className={`w-full p-4 text-left transition-colors ${
                        active ? 'bg-[var(--gs-soft-bg)]' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono font-bold text-slate-900">
                          {rep.report_date} · Health {rep.health_score}%
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            rep.status === 'sent'
                              ? 'text-[#16A34A]'
                              : rep.status === 'failed'
                                ? 'text-[#DC2626]'
                                : 'text-slate-700'
                          }`}
                        >
                          {rep.status === 'sent' ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : rep.status === 'failed' ? (
                            <XCircle className="h-3.5 w-3.5" />
                          ) : (
                            <FileText className="h-3.5 w-3.5" />
                          )}
                          <span>
                            {rep.status === 'sent'
                              ? 'Sent to Lark'
                              : rep.status === 'failed'
                                ? 'SMTP Failed (PDF Ready)'
                                : 'Generated'}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-800 truncate">
                        {rep.pdf_filename}
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                        {rep.error_count} errors · {rep.warn_count} warnings · To:{' '}
                        {rep.recipient_email}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Executive Report Preview + PDF Download */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-7 space-y-5">
              {activeReport ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-slate-500">
                        {activeReport.pdf_filename} ·{' '}
                        {new Date(activeReport.created_at).toLocaleString()}
                      </div>
                      <h3 className="mt-1 font-display text-base font-bold text-slate-900">
                        {activeReport.subject}
                      </h3>
                      <div className="mt-1 font-mono text-xs text-slate-600">
                        Recipient: {activeReport.recipient_email}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <a
                        href={api.getQaReportPdfUrl(activeReport.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Open PDF</span>
                      </a>
                      <a
                        href={api.getQaReportPdfUrl(activeReport.id)}
                        download={activeReport.pdf_filename}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] whitespace-nowrap"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download PDF Report</span>
                      </a>
                    </div>
                  </div>

                  {activeReport.error_detail && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <strong>Lark SMTP Note:</strong> {activeReport.error_detail}. Your PDF report was still generated and can be downloaded above.
                    </div>
                  )}

                  {/* Styled Visual Document Preview matching the PDF layout */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-900 text-white p-5 border-b-4 border-[#2563EB] flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="font-mono text-[10px] font-bold tracking-wider text-blue-300">
                          GITSTACK PRODUCT QA &amp; TELEMETRY AGENT · PDF PREVIEW
                        </div>
                        <div className="mt-1 font-display text-base font-bold">
                          End-of-Day Product Health &amp; Error Report ({activeReport.report_date})
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-800 px-3.5 py-2 text-center">
                        <div className="text-[10px] font-semibold text-slate-400">HEALTH</div>
                        <div
                          className={`font-mono text-lg font-bold tabular-nums ${
                            activeReport.health_score >= 90
                              ? 'text-emerald-400'
                              : activeReport.health_score >= 70
                                ? 'text-amber-400'
                                : 'text-red-400'
                          }`}
                        >
                          {activeReport.health_score}%
                        </div>
                      </div>
                    </div>

                    <div className="p-5 bg-white space-y-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="text-[10px] font-bold text-slate-500">TOTAL LOGS</div>
                          <div className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                            {activeReport.total_logs}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="text-[10px] font-bold text-slate-500">ERRORS</div>
                          <div className="mt-1 font-mono text-base font-bold text-[#DC2626] tabular-nums">
                            {activeReport.error_count}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="text-[10px] font-bold text-slate-500">WARNINGS</div>
                          <div className="mt-1 font-mono text-base font-bold text-[#D97706] tabular-nums">
                            {activeReport.warn_count}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="text-[10px] font-bold text-slate-500">TOP MODULE</div>
                          <div className="mt-1 text-xs font-bold text-[var(--gs-primary)] truncate">
                            {activeReport.top_module}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-slate-900">Executive Summary</div>
                        <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                          {activeReport.executive_summary}
                        </p>
                      </div>

                      {Array.isArray(activeReport.feature_checks) &&
                        activeReport.feature_checks.length > 0 && (
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              Daily System Feature Verification &amp; Spec Drift (
                              {
                                activeReport.feature_checks.filter(
                                  (f) => f.test_status === 'passing'
                                ).length
                              }
                              /{activeReport.feature_checks.length} Passing ·{' '}
                              {
                                activeReport.feature_checks.filter(
                                  (f) => f.drift_status === 'identical'
                                ).length
                              }{' '}
                              Identical)
                            </div>
                            <div className="mt-1.5 max-h-[180px] overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-200 text-[11px]">
                              {activeReport.feature_checks.map((fc) => (
                                <div
                                  key={fc.id}
                                  className="px-3 py-2 flex items-center justify-between gap-2 bg-slate-50/50"
                                >
                                  <span className="font-medium text-slate-800 truncate">
                                    {fc.feature_name}
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0 font-mono">
                                    <span className="text-[#16A34A] font-bold uppercase">
                                      {fc.test_status}
                                    </span>
                                    <span
                                      className={`font-bold uppercase ${
                                        fc.drift_status === 'identical'
                                          ? 'text-[var(--gs-primary)]'
                                          : 'text-purple-700'
                                      }`}
                                    >
                                      {fc.drift_status === 'identical'
                                        ? 'IDENTICAL'
                                        : fc.drift_status.toUpperCase()}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      {activeReport.recommended_actions.length > 0 && (
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            Recommended Engineering Next Steps
                          </div>
                          <ol className="mt-1.5 list-decimal pl-5 space-y-1 text-xs text-slate-700">
                            {activeReport.recommended_actions.map((act, idx) => (
                              <li key={idx}>{act}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full min-h-[300px] items-center justify-center text-xs text-slate-500">
                  Select an EOD report on the left or click Send EOD PDF Report Now.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
