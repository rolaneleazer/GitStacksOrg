import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileCheck2,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Network,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.ts';
import type {
  ArtexDashboardResponse,
  ArtexFinding,
  ArtexFindingStatus,
  ArtexReportStage,
  ArtexSavedReportSnapshot,
  ArtexSeverity,
  ArtexTrafficRole,
  UserRole
} from '../../shared/types.ts';

interface ArtexReportPanelProps {
  currentUserRole: UserRole;
}

type ArtexSubTab = 'report' | 'findings' | 'traffic' | 'snapshots';

const SEVERITY_STYLE: Record<ArtexSeverity, string> = {
  critical: 'border-red-300 bg-red-50 text-red-800',
  high: 'border-orange-300 bg-orange-50 text-orange-800',
  medium: 'border-amber-300 bg-amber-50 text-amber-800',
  low: 'border-blue-200 bg-blue-50 text-blue-800',
  info: 'border-slate-200 bg-slate-50 text-slate-700'
};

const VERIFICATION_STYLE: Record<string, string> = {
  verified: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  unverified: 'border-amber-300 bg-amber-50 text-amber-800',
  blocked: 'border-red-300 bg-red-50 text-red-800',
  not_assessed: 'border-slate-200 bg-slate-50 text-slate-700',
  false_positive: 'border-slate-200 bg-slate-100 text-slate-600'
};

function renderMarkdownBlocks(markdown: string): React.ReactNode {
  const lines = markdown.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let keyCounter = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      nodes.push(
        <pre
          key={`code-${keyCounter++}`}
          className="my-2 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-100"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    if (line.startsWith('# ')) {
      nodes.push(
        <h1 key={`h1-${keyCounter++}`} className="mt-2 mb-3 text-xl font-bold text-slate-900">
          {line.slice(2)}
        </h1>
      );
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      nodes.push(
        <h2
          key={`h2-${keyCounter++}`}
          className="mt-5 mb-2 border-b border-slate-200 pb-1 text-base font-bold text-slate-900"
        >
          {line.slice(3)}
        </h2>
      );
      i += 1;
      continue;
    }
    if (line.startsWith('### ')) {
      nodes.push(
        <h3 key={`h3-${keyCounter++}`} className="mt-4 mb-1.5 text-sm font-bold text-slate-900">
          {line.slice(4)}
        </h3>
      );
      i += 1;
      continue;
    }
    if (line.startsWith('> ')) {
      nodes.push(
        <div
          key={`bq-${keyCounter++}`}
          className="my-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900"
        >
          {line.slice(2).replace(/\*\*/g, '')}
        </div>
      );
      i += 1;
      continue;
    }
    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i += 1;
      }
      nodes.push(
        <ul key={`ul-${keyCounter++}`} className="my-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
          {items.map((item, idx) => (
            <li key={idx}>{item.replace(/\*\*/g, '')}</li>
          ))}
        </ul>
      );
      continue;
    }
    if (line.trim() === '---') {
      nodes.push(<hr key={`hr-${keyCounter++}`} className="my-4 border-slate-200" />);
      i += 1;
      continue;
    }
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    nodes.push(
      <p key={`p-${keyCounter++}`} className="my-1.5 text-xs leading-relaxed text-slate-700">
        {line.replace(/\*\*/g, '')}
      </p>
    );
    i += 1;
  }

  return nodes;
}

export function ArtexReportPanel({ currentUserRole }: ArtexReportPanelProps) {
  const canManage = currentUserRole === 'super_admin' || currentUserRole === 'editor';

  const [dashboard, setDashboard] = useState<ArtexDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<ArtexSubTab>('report');
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Report studio state
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [reportMarkdown, setReportMarkdown] = useState<string>('');
  const [loadingReport, setLoadingReport] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [syncingLive, setSyncingLive] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);

  // New task form
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskGoal, setNewTaskGoal] = useState('');
  const [newTaskScope, setNewTaskScope] = useState('https://www.git-stack.org');
  const [newTaskCoverage, setNewTaskCoverage] = useState(true);
  const [creatingTask, setCreatingTask] = useState(false);

  // Findings filters & bulk state
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reportStageFilter, setReportStageFilter] = useState<string>('all');
  const [verificationFilter, setVerificationFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [expandedFindingId, setExpandedFindingId] = useState<number | null>(null);
  const [exportFormat, setExportFormat] = useState<'md-single' | 'md-zip' | 'csv' | 'json'>('md-single');
  const [exportScope, setExportScope] = useState<'filtered' | 'selected' | 'all'>('filtered');
  const [exportingBatch, setExportingBatch] = useState(false);

  // Add finding drawer state
  const [showAddFinding, setShowAddFinding] = useState(false);
  const [findingName, setFindingName] = useState('');
  const [findingClass, setFindingClass] = useState('OWASP-A01:2021 / CWE-284');
  const [findingSeverity, setFindingSeverity] = useState<ArtexSeverity>('medium');
  const [findingPoe, setFindingPoe] = useState<0 | 1 | 2 | 3 | 4>(3);
  const [findingSummary, setFindingSummary] = useState('');
  const [findingPoc, setFindingPoc] = useState('');
  const [findingQuote, setFindingQuote] = useState('');
  const [findingDetailed, setFindingDetailed] = useState('');
  const [findingTrafficMethod, setFindingTrafficMethod] = useState('GET');
  const [findingTrafficUrl, setFindingTrafficUrl] = useState('');
  const [findingTrafficStatus, setFindingTrafficStatus] = useState('200');
  const [findingTrafficRespBody, setFindingTrafficRespBody] = useState('');
  const [creatingFinding, setCreatingFinding] = useState(false);

  // Per-finding inline actions
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [editingReportId, setEditingReportId] = useState<number | null>(null);
  const [editingReportDraft, setEditingReportDraft] = useState('');
  const [savingFindingId, setSavingFindingId] = useState<number | null>(null);

  // Bind traffic form inside expanded finding
  const [bindUrl, setBindUrl] = useState('');
  const [bindMethod, setBindMethod] = useState('GET');
  const [bindStatus, setBindStatus] = useState('200');
  const [bindRole, setBindRole] = useState<ArtexTrafficRole>('proof');
  const [bindNote, setBindNote] = useState('');
  const [bindRespBody, setBindRespBody] = useState('');
  const [bindingTraffic, setBindingTraffic] = useState(false);

  // Traffic explorer & snapshot preview
  const [selectedTrafficKey, setSelectedTrafficKey] = useState<string>('');
  const [activeSnapshot, setActiveSnapshot] = useState<ArtexSavedReportSnapshot | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getArtexDashboard();
      setDashboard(data);
      setSelectedTaskId((prev) => {
        if (prev && data.tasks.some((t) => t.id === prev)) return prev;
        return data.tasks[0]?.id || '';
      });
      setActiveSnapshot((prev) => prev || data.savedReports[0] || null);
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load ARTEX report module.'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTaskReport = useCallback(async (taskId: string, saveSnapshot = false) => {
    if (!taskId) return;
    setLoadingReport(true);
    try {
      const res = await api.generateArtexReport(taskId, saveSnapshot);
      setReportMarkdown(res.markdown);
      if (res.dashboard) {
        setDashboard(res.dashboard);
      }
      if (res.snapshot) {
        setActiveSnapshot(res.snapshot);
        setNotice({ type: 'ok', text: `Saved report snapshot for "${res.task.title}".` });
      }
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to generate ARTEX Markdown report.'
      });
    } finally {
      setLoadingReport(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (selectedTaskId) {
      loadTaskReport(selectedTaskId, false);
    }
  }, [selectedTaskId, loadTaskReport]);

  const activeTask = useMemo(
    () => dashboard?.tasks.find((t) => t.id === selectedTaskId) || dashboard?.tasks[0] || null,
    [dashboard, selectedTaskId]
  );

  const filteredFindings = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.findings.filter((f) => {
      if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
      if (statusFilter !== 'all' && f.status !== statusFilter) return false;
      if (reportStageFilter !== 'all' && f.reportState !== reportStageFilter) return false;
      if (verificationFilter !== 'all' && f.verificationStatus !== verificationFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hit =
          f.name.toLowerCase().includes(q) ||
          f.vulnclass.toLowerCase().includes(q) ||
          f.summary.toLowerCase().includes(q) ||
          f.taskDescription.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [
    dashboard,
    severityFilter,
    statusFilter,
    reportStageFilter,
    verificationFilter,
    searchQuery
  ]);

  const allTrafficRows = useMemo(() => {
    if (!dashboard) return [];
    const rows: Array<{
      key: string;
      finding: ArtexFinding;
      binding: ArtexFinding['trafficBindings'][number];
    }> = [];
    for (const f of dashboard.findings) {
      for (const b of f.trafficBindings) {
        rows.push({ key: `${f.id}-${b.id}`, finding: f, binding: b });
      }
    }
    return rows;
  }, [dashboard]);

  const activeTrafficRow = useMemo(() => {
    if (allTrafficRows.length === 0) return null;
    return allTrafficRows.find((r) => r.key === selectedTrafficKey) || allTrafficRows[0];
  }, [allTrafficRows, selectedTrafficKey]);

  const handleCopyMarkdown = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 1600);
    } catch {
      setNotice({ type: 'err', text: 'Clipboard write blocked by browser permissions.' });
    }
  };

  const handleDownloadTaskReport = async (format: 'md' | 'html' | 'pdf') => {
    if (!activeTask) return;
    setDownloadingFormat(format);
    setNotice(null);
    try {
      await api.downloadArtexTaskReport(activeTask.id, format);
      setNotice({ type: 'ok', text: `Downloaded ${format.toUpperCase()} penetration test report.` });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : `Failed to download ${format.toUpperCase()} report.`
      });
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleSyncLive = async () => {
    setSyncingLive(true);
    setNotice(null);
    try {
      const res = await api.syncArtexLive();
      setDashboard(res.dashboard);
      setNotice({ type: 'ok', text: res.message });
      if (selectedTaskId) {
        loadTaskReport(selectedTaskId, false);
      }
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to sync live platform findings.'
      });
    } finally {
      setSyncingLive(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setCreatingTask(true);
    setNotice(null);
    try {
      const res = await api.createArtexTask({
        title: newTaskTitle.trim(),
        goal: newTaskGoal.trim() || 'Penetration test and proof-of-execution validation',
        targetScope: newTaskScope.trim() || 'https://www.git-stack.org',
        coverageEnabled: newTaskCoverage
      });
      setDashboard(res.dashboard);
      setSelectedTaskId(res.task.id);
      setNewTaskTitle('');
      setNewTaskGoal('');
      setShowNewTask(false);
      setNotice({ type: 'ok', text: `Created ARTEX assessment "${res.task.title}".` });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to create ARTEX task.'
      });
    } finally {
      setCreatingTask(false);
    }
  };

  const handleCreateFinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!findingName.trim() || !findingSummary.trim() || !activeTask) return;
    setCreatingFinding(true);
    setNotice(null);
    try {
      const res = await api.createArtexFinding({
        taskId: activeTask.id,
        name: findingName.trim(),
        vulnclass: findingClass.trim(),
        severity: findingSeverity,
        poeLevel: findingPoe,
        summary: findingSummary.trim(),
        evidencePoc: findingPoc.trim(),
        evidenceQuote: findingQuote.trim(),
        detailedReport: findingDetailed.trim(),
        traffic: findingTrafficUrl.trim()
          ? {
              role: 'proof',
              method: findingTrafficMethod,
              url: findingTrafficUrl.trim(),
              status: Number(findingTrafficStatus) || 200,
              respBody: findingTrafficRespBody
            }
          : undefined
      });
      setDashboard(res.dashboard);
      setFindingName('');
      setFindingSummary('');
      setFindingPoc('');
      setFindingQuote('');
      setFindingDetailed('');
      setFindingTrafficUrl('');
      setFindingTrafficRespBody('');
      setShowAddFinding(false);
      setNotice({
        type: 'ok',
        text: `Recorded ARTEX finding #${res.finding.id} (${res.finding.verificationStatus}).`
      });
      loadTaskReport(activeTask.id, false);
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to create finding.'
      });
    } finally {
      setCreatingFinding(false);
    }
  };

  const handleUpdateFindingField = async (
    id: number,
    patch: Partial<{
      status: ArtexFindingStatus;
      reportState: ArtexReportStage;
      detailedReport: string;
    }>
  ) => {
    setSavingFindingId(id);
    setNotice(null);
    try {
      const res = await api.updateArtexFinding(id, patch);
      setDashboard(res.dashboard);
      if (patch.detailedReport !== undefined) {
        setEditingReportId(null);
      }
      setNotice({ type: 'ok', text: `Updated finding #${id}.` });
      if (activeTask) loadTaskReport(activeTask.id, false);
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update finding.'
      });
    } finally {
      setSavingFindingId(null);
    }
  };

  const handleVerifyReceipt = async (id: number) => {
    setVerifyingId(id);
    setNotice(null);
    try {
      const res = await api.verifyArtexFindingReceipt(id);
      setDashboard(res.dashboard);
      setNotice({
        type: res.result.verified ? 'ok' : 'err',
        text: `Finding #${id}: ${res.result.note}`
      });
      if (activeTask) loadTaskReport(activeTask.id, false);
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to run S1 receipt verification.'
      });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleBindTraffic = async (findingId: number, e: React.FormEvent) => {
    e.preventDefault();
    if (!bindUrl.trim()) return;
    setBindingTraffic(true);
    setNotice(null);
    try {
      const res = await api.bindArtexTraffic(findingId, {
        role: bindRole,
        method: bindMethod,
        url: bindUrl.trim(),
        status: Number(bindStatus) || 200,
        note: bindNote.trim(),
        respBody: bindRespBody
      });
      setDashboard(res.dashboard);
      setBindUrl('');
      setBindNote('');
      setBindRespBody('');
      setNotice({
        type: 'ok',
        text: `Bound new HTTP evidence to finding #${findingId} (evidence v${res.finding.evidenceVersion}).`
      });
      if (activeTask) loadTaskReport(activeTask.id, false);
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to bind traffic evidence.'
      });
    } finally {
      setBindingTraffic(false);
    }
  };

  const handleBulkUpdate = async (
    patch: { status?: ArtexFindingStatus; reportState?: ArtexReportStage }
  ) => {
    if (selectedIds.length === 0) return;
    setNotice(null);
    try {
      const res = await api.bulkUpdateArtexFindings({ ids: selectedIds, ...patch });
      setDashboard(res.dashboard);
      setNotice({ type: 'ok', text: `Bulk updated ${res.updated} finding(s).` });
      if (activeTask) loadTaskReport(activeTask.id, false);
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Bulk update failed.'
      });
    }
  };

  const handleBatchExport = async () => {
    if (exportScope === 'selected' && selectedIds.length === 0) {
      setNotice({ type: 'err', text: 'Select at least one finding row before exporting Selected.' });
      return;
    }
    setExportingBatch(true);
    setNotice(null);
    try {
      await api.exportArtexFindings({
        format: exportFormat,
        scope: exportScope,
        ids: selectedIds,
        filters: {
          severity: severityFilter,
          status: statusFilter,
          reportState: reportStageFilter,
          verificationStatus: verificationFilter,
          q: searchQuery
        }
      });
      setNotice({
        type: 'ok',
        text: `Exported ${exportScope} findings as ${exportFormat.toUpperCase()}.`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Batch export failed.'
      });
    } finally {
      setExportingBatch(false);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    const filteredIds = filteredFindings.map((f) => f.id);
    const allSelected =
      filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">
              ARTEX Penetration Test &amp; Evidence Report Engine
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-600">
            Proof-of-Execution (PoE) verification, S1 HTTP receipt binding, coverage gap ledgers,
            stale-report detection, and multi-format evidence packages.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={handleSyncLive}
              disabled={syncingLive}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncingLive ? 'animate-spin' : ''}`} />
              {syncingLive ? 'Syncing Telemetry...' : 'Sync Live GitStack Audit'}
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => setShowNewTask((v) => !v)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              New Assessment
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-xs font-medium ${
            notice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-4 text-xs font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Summary Strip */}
      {dashboard && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Assessments
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              {dashboard.stats.totalTasks}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Total Findings
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              {dashboard.stats.totalFindings}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              S1 Verified (PoE L3+)
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">
              {dashboard.stats.verifiedFindings}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Bound HTTP Receipts
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-indigo-700">
              {dashboard.stats.boundTrafficCount}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Stale Reports
            </div>
            <div
              className={`mt-1 text-2xl font-bold tabular-nums ${
                dashboard.stats.staleReports > 0 ? 'text-amber-700' : 'text-slate-900'
              }`}
            >
              {dashboard.stats.staleReports}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Critical / High
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              {dashboard.stats.bySeverity.critical + dashboard.stats.bySeverity.high}
            </div>
          </div>
        </div>
      )}

      {/* New Assessment Drawer */}
      {showNewTask && canManage && (
        <form
          onSubmit={handleCreateTask}
          className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Create ARTEX Assessment Task</h3>
            <button
              type="button"
              onClick={() => setShowNewTask(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Task Title</label>
              <input
                type="text"
                required
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="e.g., Q4 API Authorization & Tenant Isolation Audit"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Target Scope</label>
              <input
                type="text"
                value={newTaskScope}
                onChange={(e) => setNewTaskScope(e.target.value)}
                placeholder="https://www.git-stack.org (/api/admin/*)"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700">Assessment Goal</label>
            <input
              type="text"
              value={newTaskGoal}
              onChange={(e) => setNewTaskGoal(e.target.value)}
              placeholder="Verify access control, PoE evidence, and coverage completeness"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={newTaskCoverage}
                onChange={(e) => setNewTaskCoverage(e.target.checked)}
                className="rounded border-slate-300"
              />
              Enable ARTEX Asset Coverage &amp; Gap Ledger
            </label>
            <button
              type="submit"
              disabled={creatingTask}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {creatingTask ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {(
          [
            { id: 'report', label: 'Report Studio', icon: FileText },
            {
              id: 'findings',
              label: `Findings & Export (${dashboard?.findings.length ?? 0})`,
              icon: ShieldCheck
            },
            {
              id: 'traffic',
              label: `HTTP Traffic Receipts (${allTrafficRows.length})`,
              icon: Network
            },
            {
              id: 'snapshots',
              label: `Saved Snapshots (${dashboard?.savedReports.length ?? 0})`,
              icon: History
            }
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                active
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: REPORT STUDIO */}
      {subTab === 'report' && dashboard && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="min-w-0 flex-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Active Assessment Engagement
                  </label>
                  <select
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="mt-1 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
                  >
                    {dashboard.tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyMarkdown(reportMarkdown)}
                    disabled={!reportMarkdown}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {copiedReport ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedReport ? 'Copied' : 'Copy MD'}
                  </button>
                  <button
                    type="button"
                    onClick={() => activeTask && loadTaskReport(activeTask.id, true)}
                    disabled={loadingReport || !activeTask}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Save Snapshot
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadTaskReport('md')}
                    disabled={downloadingFormat !== null}
                    className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    .MD
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadTaskReport('html')}
                    disabled={downloadingFormat !== null}
                    className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <FileCode2 className="h-3.5 w-3.5" />
                    .HTML
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadTaskReport('pdf')}
                    disabled={downloadingFormat !== null}
                    className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {downloadingFormat === 'pdf' ? 'Rendering...' : 'Download PDF'}
                  </button>
                </div>
              </div>

              <div className="mt-4 max-h-[640px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                {loadingReport ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    Rendering ARTEX Markdown report...
                  </div>
                ) : reportMarkdown ? (
                  <div>{renderMarkdownBlocks(reportMarkdown)}</div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-500">
                    No report generated for this engagement yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Rail: Asset Counts & Coverage Ledger */}
          <div className="space-y-4">
            {activeTask && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Asset Scope Inventory</h3>
                <p className="text-xs text-slate-600">{activeTask.targetScope}</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(activeTask.assetCounts || {}).map(([assetType, count]) => (
                    <div
                      key={assetType}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    >
                      <span className="capitalize text-slate-600">{assetType}</span>
                      <span className="font-mono font-bold tabular-nums text-slate-900">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTask && activeTask.coverageEnabled && activeTask.coverage && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Coverage Ledger</h3>
                  <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                    {activeTask.coverage.completenessState}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{activeTask.coverage.completenessCaveat}</p>
                <div className="space-y-1.5">
                  {activeTask.coverage.entries.map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-mono font-semibold text-slate-800">
                          {entry.surface}
                        </div>
                        <div className="truncate text-[11px] text-slate-500">{entry.riskArea}</div>
                      </div>
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                          entry.outcome === 'tested_clean'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : entry.outcome === 'finding_confirmed'
                              ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                              : 'border-amber-200 bg-amber-50 text-amber-800'
                        }`}
                      >
                        {entry.outcome}
                      </span>
                    </div>
                  ))}
                </div>
                {activeTask.coverage.gaps.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="text-xs font-bold text-amber-900">
                      Open Coverage Gaps ({activeTask.coverage.gaps.length})
                    </div>
                    <ul className="mt-1 space-y-1 font-mono text-[11px] text-amber-800">
                      {activeTask.coverage.gaps.map((gap, idx) => (
                        <li key={idx}>• {gap}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FINDINGS & EVIDENCE MATRIX */}
      {subTab === 'findings' && dashboard && (
        <div className="space-y-4">
          {/* Filter + Export Bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative min-w-[200px] flex-1 max-w-xs">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search findings, CWE, summary..."
                    className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                >
                  <option value="all">Severity: All</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="info">Info</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                >
                  <option value="all">Status: All</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="fixed">Fixed</option>
                  <option value="false_positive">False Positive</option>
                </select>
                <select
                  value={reportStageFilter}
                  onChange={(e) => setReportStageFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                >
                  <option value="all">Stage: All</option>
                  <option value="none">None</option>
                  <option value="submitted">Submitted</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="duplicate">Duplicate</option>
                </select>
                <select
                  value={verificationFilter}
                  onChange={(e) => setVerificationFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                >
                  <option value="all">Verification: All</option>
                  <option value="verified">Verified</option>
                  <option value="unverified">Unverified</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>

              {canManage && (
                <button
                  type="button"
                  onClick={() => setShowAddFinding((v) => !v)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Record Finding
                </button>
              )}
            </div>

            {/* Batch Export & Bulk Operations */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 tabular-nums">
                  {selectedIds.length} selected
                </span>
                {canManage && selectedIds.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleBulkUpdate({ status: 'confirmed' })}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Mark Confirmed
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkUpdate({ status: 'fixed' })}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Mark Fixed
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkUpdate({ reportState: 'submitted' })}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Stage: Submitted
                    </button>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={exportScope}
                  onChange={(e) =>
                    setExportScope(e.target.value as 'filtered' | 'selected' | 'all')
                  }
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                >
                  <option value="filtered">Scope: Current Filter ({filteredFindings.length})</option>
                  <option value="selected">Scope: Selected ({selectedIds.length})</option>
                  <option value="all">Scope: All ({dashboard.findings.length})</option>
                </select>
                <select
                  value={exportFormat}
                  onChange={(e) =>
                    setExportFormat(
                      e.target.value as 'md-single' | 'md-zip' | 'csv' | 'json'
                    )
                  }
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                >
                  <option value="md-single">Combined Markdown (.md)</option>
                  <option value="md-zip">Evidence Package (.zip)</option>
                  <option value="csv">Formula-Safe CSV (.csv)</option>
                  <option value="json">Structured JSON (.json)</option>
                </select>
                <button
                  type="button"
                  onClick={handleBatchExport}
                  disabled={exportingBatch}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  {exportingBatch ? 'Exporting...' : 'Export Findings'}
                </button>
              </div>
            </div>
          </div>

          {/* Add Finding Form */}
          {showAddFinding && canManage && (
            <form
              onSubmit={handleCreateFinding}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Record New ARTEX Finding</h3>
                <button
                  type="button"
                  onClick={() => setShowAddFinding(false)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">Title</label>
                  <input
                    type="text"
                    required
                    value={findingName}
                    onChange={(e) => setFindingName(e.target.value)}
                    placeholder="e.g., Broken Object Level Authorization on /api/orders"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">CWE / Class</label>
                  <input
                    type="text"
                    value={findingClass}
                    onChange={(e) => setFindingClass(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Severity</label>
                    <select
                      value={findingSeverity}
                      onChange={(e) => setFindingSeverity(e.target.value as ArtexSeverity)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                      <option value="info">Info</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">PoE Level</label>
                    <select
                      value={findingPoe}
                      onChange={(e) => setFindingPoe(Number(e.target.value) as 0 | 1 | 2 | 3 | 4)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    >
                      <option value={0}>L0</option>
                      <option value={1}>L1</option>
                      <option value={2}>L2</option>
                      <option value={3}>L3</option>
                      <option value={4}>L4</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Summary</label>
                <textarea
                  rows={2}
                  required
                  value={findingSummary}
                  onChange={(e) => setFindingSummary(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    PoC / Reproduction Snippet
                  </label>
                  <textarea
                    rows={2}
                    value={findingPoc}
                    onChange={(e) => setFindingPoc(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    S1 Receipt Verbatim Quote (min 8 chars)
                  </label>
                  <input
                    type="text"
                    value={findingQuote}
                    onChange={(e) => setFindingQuote(e.target.value)}
                    placeholder="Exact string expected inside bound HTTP response"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs"
                  />
                  <label className="mt-2 block text-xs font-semibold text-slate-700">
                    Detailed Report Markdown
                  </label>
                  <input
                    type="text"
                    value={findingDetailed}
                    onChange={(e) => setFindingDetailed(e.target.value)}
                    placeholder="## Overview\n..."
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Initial Proof Method
                  </label>
                  <select
                    value={findingTrafficMethod}
                    onChange={(e) => setFindingTrafficMethod(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Initial Proof URL (optional)
                  </label>
                  <input
                    type="text"
                    value={findingTrafficUrl}
                    onChange={(e) => setFindingTrafficUrl(e.target.value)}
                    placeholder="/api/example"
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">
                    HTTP Status
                  </label>
                  <input
                    type="number"
                    value={findingTrafficStatus}
                    onChange={(e) => setFindingTrafficStatus(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Captured Response Body (checked by S1 receipt verifier)
                  </label>
                  <input
                    type="text"
                    value={findingTrafficRespBody}
                    onChange={(e) => setFindingTrafficRespBody(e.target.value)}
                    placeholder='{"status":"confirmed","token":"redacted"}'
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={creatingFinding}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {creatingFinding ? 'Saving...' : 'Save Finding'}
                </button>
              </div>
            </form>
          )}

          {/* Findings Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="w-8 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={
                        filteredFindings.length > 0 &&
                        filteredFindings.every((f) => selectedIds.includes(f.id))
                      }
                      onChange={toggleSelectAllFiltered}
                    />
                  </th>
                  <th className="px-3 py-2.5">Finding</th>
                  <th className="px-3 py-2.5">Severity</th>
                  <th className="px-3 py-2.5">PoE / S1 Check</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Report Stage</th>
                  <th className="px-3 py-2.5 text-right">Receipts</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredFindings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-xs text-slate-500">
                      No findings match the current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredFindings.map((f) => {
                    const expanded = expandedFindingId === f.id;
                    return (
                      <React.Fragment key={f.id}>
                        <tr className="hover:bg-slate-50/80">
                          <td className="px-3 py-2.5 align-top">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(f.id)}
                              onChange={() => toggleSelection(f.id)}
                            />
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <button
                              type="button"
                              onClick={() => setExpandedFindingId(expanded ? null : f.id)}
                              className="flex items-start gap-1.5 text-left font-semibold text-slate-900 hover:text-indigo-700"
                            >
                              {expanded ? (
                                <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                              ) : (
                                <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                              )}
                              <span>
                                #{f.id} {f.name}
                              </span>
                            </button>
                            <div className="mt-0.5 pl-5 font-mono text-[11px] text-slate-500">
                              {f.vulnclass}
                              {f.reportStale && (
                                <span className="ml-2 inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-amber-800">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  Stale report
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <span
                              className={`inline-block rounded border px-2 py-0.5 text-[11px] font-semibold uppercase ${SEVERITY_STYLE[f.severity]}`}
                            >
                              {f.severity}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold tabular-nums text-slate-800">
                                L{f.poeLevel}
                              </span>
                              <span
                                className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${
                                  VERIFICATION_STYLE[f.verificationStatus] ||
                                  VERIFICATION_STYLE.not_assessed
                                }`}
                              >
                                {f.verificationStatus}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            {canManage ? (
                              <select
                                value={f.status}
                                disabled={savingFindingId === f.id}
                                onChange={(e) =>
                                  handleUpdateFindingField(f.id, {
                                    status: e.target.value as ArtexFindingStatus
                                  })
                                }
                                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium"
                              >
                                <option value="pending">pending</option>
                                <option value="confirmed">confirmed</option>
                                <option value="fixed">fixed</option>
                                <option value="false_positive">false_positive</option>
                              </select>
                            ) : (
                              <span>{f.status}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            {canManage ? (
                              <select
                                value={f.reportState}
                                disabled={savingFindingId === f.id}
                                onChange={(e) =>
                                  handleUpdateFindingField(f.id, {
                                    reportState: e.target.value as ArtexReportStage
                                  })
                                }
                                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium"
                              >
                                <option value="none">none</option>
                                <option value="submitted">submitted</option>
                                <option value="accepted">accepted</option>
                                <option value="rejected">rejected</option>
                                <option value="duplicate">duplicate</option>
                              </select>
                            ) : (
                              <span>{f.reportState}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums align-top text-slate-700">
                            {f.trafficBindings.length}
                          </td>
                          <td className="px-3 py-2.5 text-right align-top">
                            <button
                              type="button"
                              onClick={() => handleVerifyReceipt(f.id)}
                              disabled={verifyingId === f.id}
                              className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              {verifyingId === f.id ? 'Checking...' : 'Verify S1'}
                            </button>
                          </td>
                        </tr>

                        {expanded && (
                          <tr className="bg-slate-50/70">
                            <td colSpan={8} className="p-4">
                              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <div className="space-y-3">
                                  <div>
                                    <div className="text-[11px] font-bold uppercase text-slate-500">
                                      Summary &amp; Proof Quality
                                    </div>
                                    <p className="mt-1 text-xs text-slate-800">{f.summary}</p>
                                    {f.verificationNote && (
                                      <p className="mt-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
                                        <strong>Verification note:</strong> {f.verificationNote}
                                      </p>
                                    )}
                                    {f.confidenceRationale && (
                                      <p className="mt-1.5 text-xs text-slate-700">
                                        <strong>Confidence rationale:</strong>{' '}
                                        {f.confidenceRationale}
                                      </p>
                                    )}
                                    {f.counterevidence && (
                                      <p className="mt-1 text-xs text-slate-700">
                                        <strong>Counterevidence:</strong> {f.counterevidence}
                                      </p>
                                    )}
                                  </div>

                                  <div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] font-bold uppercase text-slate-500">
                                        Detailed Report (evidence v{f.evidenceVersion} / report v
                                        {f.reportEvidenceVersion})
                                      </span>
                                      {canManage && editingReportId !== f.id && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingReportId(f.id);
                                            setEditingReportDraft(f.detailedReport);
                                          }}
                                          className="text-xs font-semibold text-indigo-600 hover:underline"
                                        >
                                          {f.reportStale ? 'Update Stale Report' : 'Edit Report'}
                                        </button>
                                      )}
                                    </div>
                                    {f.reportStale && (
                                      <div className="mt-1 rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900">
                                        The evidence has changed; the detailed report needs updating.
                                      </div>
                                    )}
                                    {editingReportId === f.id ? (
                                      <div className="mt-2 space-y-2">
                                        <textarea
                                          rows={5}
                                          value={editingReportDraft}
                                          onChange={(e) => setEditingReportDraft(e.target.value)}
                                          className="w-full rounded-lg border border-slate-200 bg-white p-2.5 font-mono text-xs"
                                        />
                                        <div className="flex justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setEditingReportId(null)}
                                            className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleUpdateFindingField(f.id, {
                                                detailedReport: editingReportDraft
                                              })
                                            }
                                            className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white"
                                          >
                                            Save &amp; Sync Version
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <pre className="mt-1.5 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-2.5 font-mono text-[11px] text-slate-800">
                                        {f.detailedReport || 'No detailed report written yet.'}
                                      </pre>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <div className="text-[11px] font-bold uppercase text-slate-500">
                                    Bound HTTP Traffic Exchanges ({f.trafficBindings.length})
                                  </div>
                                  {f.trafficBindings.map((b) => (
                                    <div
                                      key={b.id}
                                      className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs"
                                    >
                                      <div className="flex items-center justify-between font-mono text-[11px]">
                                        <span className="font-bold text-slate-900">
                                          #{b.id} [{b.role}] {b.method} {b.url}
                                        </span>
                                        <span className="rounded border border-slate-200 px-1.5 py-0.5 tabular-nums">
                                          HTTP {b.status}
                                        </span>
                                      </div>
                                      {b.note && (
                                        <div className="mt-1 text-[11px] text-slate-600">
                                          {b.note}
                                        </div>
                                      )}
                                      <pre className="mt-1.5 max-h-24 overflow-auto rounded bg-slate-950 p-2 font-mono text-[11px] text-slate-100">
                                        {b.respBody || b.respHead}
                                      </pre>
                                    </div>
                                  ))}

                                  {canManage && (
                                    <form
                                      onSubmit={(e) => handleBindTraffic(f.id, e)}
                                      className="rounded-lg border border-slate-200 bg-white p-3 space-y-2"
                                    >
                                      <div className="text-[11px] font-bold text-slate-700">
                                        Bind Additional HTTP Receipt
                                      </div>
                                      <div className="grid grid-cols-4 gap-2">
                                        <select
                                          value={bindRole}
                                          onChange={(e) =>
                                            setBindRole(e.target.value as ArtexTrafficRole)
                                          }
                                          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                                        >
                                          <option value="proof">proof</option>
                                          <option value="verification">verification</option>
                                          <option value="reproduction">reproduction</option>
                                          <option value="context">context</option>
                                        </select>
                                        <select
                                          value={bindMethod}
                                          onChange={(e) => setBindMethod(e.target.value)}
                                          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                                        >
                                          <option value="GET">GET</option>
                                          <option value="POST">POST</option>
                                          <option value="PATCH">PATCH</option>
                                          <option value="DELETE">DELETE</option>
                                        </select>
                                        <input
                                          type="number"
                                          value={bindStatus}
                                          onChange={(e) => setBindStatus(e.target.value)}
                                          className="rounded border border-slate-200 px-2 py-1 text-xs"
                                          placeholder="200"
                                        />
                                        <input
                                          type="text"
                                          required
                                          value={bindUrl}
                                          onChange={(e) => setBindUrl(e.target.value)}
                                          placeholder="/api/endpoint"
                                          className="rounded border border-slate-200 px-2 py-1 text-xs"
                                        />
                                      </div>
                                      <input
                                        type="text"
                                        value={bindNote}
                                        onChange={(e) => setBindNote(e.target.value)}
                                        placeholder="Receipt note"
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                                      />
                                      <textarea
                                        rows={2}
                                        value={bindRespBody}
                                        onChange={(e) => setBindRespBody(e.target.value)}
                                        placeholder="Captured response body"
                                        className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs"
                                      />
                                      <div className="flex justify-end">
                                        <button
                                          type="submit"
                                          disabled={bindingTraffic}
                                          className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                                        >
                                          {bindingTraffic ? 'Binding...' : 'Attach Traffic'}
                                        </button>
                                      </div>
                                    </form>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TRAFFIC RECEIPTS EXPLORER */}
      {subTab === 'traffic' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-800">
              Captured HTTP Exchanges ({allTrafficRows.length})
            </div>
            <div className="max-h-[540px] divide-y divide-slate-200 overflow-y-auto">
              {allTrafficRows.map((row) => {
                const isSelected = activeTrafficRow?.key === row.key;
                return (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => setSelectedTrafficKey(row.key)}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 font-mono text-xs">
                      <span className="font-bold text-slate-900">
                        #{row.binding.id} {row.binding.method}
                      </span>
                      <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] tabular-nums">
                        {row.binding.status}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-slate-600">
                      {row.binding.url}
                    </div>
                    <div className="mt-1 truncate text-[11px] text-slate-500">
                      Finding #{row.finding.id}: {row.finding.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
            {activeTrafficRow ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <div className="font-mono text-sm font-bold text-slate-900">
                      Evidence #{activeTrafficRow.binding.id} · {activeTrafficRow.binding.role}
                    </div>
                    <div className="text-xs text-slate-600">
                      Bound to Finding #{activeTrafficRow.finding.id} — {activeTrafficRow.finding.name}
                    </div>
                  </div>
                  <span className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-slate-800">
                    HTTP {activeTrafficRow.binding.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-1.5 text-xs font-bold uppercase text-slate-500">
                      Request (.http)
                    </div>
                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-100">
                      {`${activeTrafficRow.binding.reqHead}\n\n${activeTrafficRow.binding.reqBody || '(empty body)'}`}
                    </pre>
                  </div>
                  <div>
                    <div className="mb-1.5 text-xs font-bold uppercase text-slate-500">
                      Response (.http)
                    </div>
                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-emerald-100">
                      {`${activeTrafficRow.binding.respHead}\n\n${activeTrafficRow.binding.respBody || '(empty body)'}`}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500">
                No bound traffic receipts recorded yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SAVED REPORT SNAPSHOTS */}
      {subTab === 'snapshots' && dashboard && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-800">
              Archived Report Snapshots ({dashboard.savedReports.length})
            </div>
            <div className="max-h-[540px] divide-y divide-slate-200 overflow-y-auto">
              {dashboard.savedReports.map((snap) => {
                const isSelected = activeSnapshot?.id === snap.id;
                return (
                  <button
                    key={snap.id}
                    type="button"
                    onClick={() => setActiveSnapshot(snap)}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">{snap.taskTitle}</div>
                    <div className="mt-1 font-mono text-[11px] tabular-nums text-slate-500">
                      {new Date(snap.generatedAt).toLocaleString()} · {snap.totalFindings} findings ·{' '}
                      {snap.verifiedCount} verified
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
            {activeSnapshot ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{activeSnapshot.taskTitle}</h3>
                    <div className="text-xs font-mono text-slate-500">
                      Snapshot {activeSnapshot.id} ·{' '}
                      {new Date(activeSnapshot.generatedAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyMarkdown(activeSnapshot.markdown)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy Snapshot MD
                  </button>
                </div>
                <div className="max-h-[540px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                  {renderMarkdownBlocks(activeSnapshot.markdown)}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500">
                Save a report snapshot from Report Studio to view archived revisions here.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
