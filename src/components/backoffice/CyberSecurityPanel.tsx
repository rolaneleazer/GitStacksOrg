import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Lock,
  Mail,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import type {
  CyberDomainCheck,
  CyberFindingStatus,
  CyberSecurityDashboardResponse,
  CyberSecurityFinding,
  CyberSecurityReport,
  CyberSecuritySettings,
  CyberSeverity,
  UserRole
} from '../../shared/types.ts';

interface CyberSecurityPanelProps {
  currentUserRole: UserRole;
  onOpenSettings?: () => void;
}

const SEVERITY_BADGE: Record<CyberSeverity, string> = {
  critical: 'border-red-300 bg-red-50 text-red-800',
  high: 'border-orange-300 bg-orange-50 text-orange-800',
  medium: 'border-amber-300 bg-amber-50 text-amber-800',
  low: 'border-blue-200 bg-blue-50 text-blue-800',
  info: 'border-slate-200 bg-slate-50 text-slate-700'
};

export function CyberSecurityPanel({
  currentUserRole,
  onOpenSettings
}: CyberSecurityPanelProps) {
  const [dashboard, setDashboard] = useState<CyberSecurityDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [updatingFindingId, setUpdatingFindingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'domains' | 'findings' | 'reports' | 'schedule'
  >('domains');
  const [selectedReport, setSelectedReport] = useState<CyberSecurityReport | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<CyberSecuritySettings | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const canManage = currentUserRole === 'super_admin' || currentUserRole === 'editor';

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getCyberSecurityDashboard();
      setDashboard(res);
      setSettingsDraft(res.settings);
      setSelectedReport((prev) => {
        if (prev) {
          const match = res.reports.find((r) => r.id === prev.id);
          if (match) return match;
        }
        return res.reports[0] || null;
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load Cybersecurity & AI Sentinel.'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleRunLiveScan = async () => {
    setScanning(true);
    setNotice(null);
    try {
      const res = await api.runCyberSecurityScan();
      setDashboard(res.dashboard);
      setSettingsDraft(res.dashboard.settings);
      setNotice({ type: 'ok', text: res.message });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Live Aegis security scan failed.'
      });
    } finally {
      setScanning(false);
    }
  };

  const handleSendDailyReport = async () => {
    setSendingReport(true);
    setNotice(null);
    try {
      const res = await api.sendCyberSecurityReport({
        recipient_email: settingsDraft?.recipient_email || undefined
      });
      setDashboard(res.dashboard);
      setSelectedReport(res.report);
      setSettingsDraft(res.dashboard.settings);
      setNotice({ type: 'ok', text: res.message });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to dispatch Daily Cybersecurity Report.'
      });
    } finally {
      setSendingReport(false);
    }
  };

  const handleUpdateFindingStatus = async (findingId: string, status: CyberFindingStatus) => {
    setUpdatingFindingId(findingId);
    setNotice(null);
    try {
      const res = await api.updateCyberFindingStatus(findingId, status);
      setDashboard(res.dashboard);
      setNotice({
        type: 'ok',
        text: `Finding "${res.finding.title}" updated to ${status.toUpperCase()}.`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update finding status.'
      });
    } finally {
      setUpdatingFindingId(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsDraft) return;
    setSavingSettings(true);
    setNotice(null);
    try {
      const res = await api.saveCyberSecuritySettings(settingsDraft);
      setSettingsDraft(res.settings);
      setDashboard((prev) => (prev ? { ...prev, settings: res.settings } : prev));
      setNotice({
        type: 'ok',
        text: 'Aegis AI Sentinel and daily Cybersecurity report settings saved.'
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save security settings.'
      });
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
        Loading Cybersecurity &amp; Live AI Sentinel (Aegis)...
      </div>
    );
  }

  const domains = dashboard?.domainChecks || [];
  const findings = dashboard?.findings || [];
  const reports = dashboard?.reports || [];
  const posture = dashboard?.posture;
  const threatIntel = dashboard?.aiThreatIntel || [];

  const renderDomainCard = (domain: CyberDomainCheck) => {
    const isProtected = domain.status === 'protected';
    const isWarning = domain.status === 'warning';
    return (
      <div
        key={domain.domain_id}
        className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between gap-3"
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {isProtected ? (
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : isWarning ? (
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
              )}
              <h4 className="font-display text-sm font-bold text-slate-900">
                {domain.domain_name}
              </h4>
            </div>
            <span
              className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                isProtected
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : isWarning
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {domain.status} · {domain.score}%
            </span>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-slate-600">{domain.summary}</p>
        </div>

        <div className="border-t border-slate-100 pt-2.5">
          <div className="text-[10px] font-semibold text-slate-500 mb-1.5">
            Verified Security Controls
          </div>
          <div className="flex flex-wrap gap-1.5">
            {domain.controls_verified.map((ctrl) => (
              <span
                key={ctrl}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-700"
              >
                {ctrl}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Agent Aegis Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--gs-primary)]">
              <Shield className="h-4 w-4" />
              <span>Cybersecurity Posture &amp; Live AI CyberSec Agent (Aegis)</span>
            </div>
            <h2 className="mt-1 font-display text-lg sm:text-xl font-bold text-slate-900">
              Continuous 8-Domain Defense Audit, Up-to-Date Threat Advisories &amp; Daily PDF Report
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 max-w-3xl">
              Live AI Agent <strong>Aegis</strong> continuously audits Cloudflare Edge/WAF,
              Supabase PostgreSQL RLS across 36 tables, AES-256-GCM Vault encryption, JWT/RBAC
              access, HTTP security headers, XSS/SQLi guards, and active OWASP/CVE advisories—and
              emails a daily executive PDF report to Lark Mail.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleRunLiveScan}
              disabled={scanning || sendingReport}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
              <span>{scanning ? 'Running Aegis Audit...' : 'Run Live Aegis Security Audit'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendDailyReport}
              disabled={sendingReport || scanning}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>
                {sendingReport
                  ? 'Generating & Sending PDF...'
                  : 'Send Daily CyberSec PDF Report Now'}
              </span>
            </button>
          </div>
        </div>

        {notice && (
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-xs font-medium ${
              notice.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {notice.text}
          </div>
        )}

        {/* KPI Cards */}
        {posture && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="text-[11px] font-medium text-slate-500">Security Posture</div>
              <div className="mt-1 font-display text-2xl font-bold text-[#16A34A] tabular-nums">
                {posture.grade} ({posture.score}%)
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">8-Domain Composite</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="text-[11px] font-medium text-slate-500">Protected Domains</div>
              <div className="mt-1 font-display text-2xl font-bold text-[#16A34A] tabular-nums">
                {posture.protectedDomainsCount}/{posture.totalDomainsCount}
              </div>
              <div className="mt-0.5 text-[11px] text-emerald-700 font-medium">
                WAF · RLS · AES-256
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="text-[11px] font-medium text-slate-500">Open Critical / High</div>
              <div
                className={`mt-1 font-display text-2xl font-bold tabular-nums ${
                  posture.criticalCount + posture.highCount > 0
                    ? 'text-red-600'
                    : 'text-[#16A34A]'
                }`}
              >
                {posture.criticalCount} / {posture.highCount}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">Zero Unmitigated Breaches</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="text-[11px] font-medium text-slate-500">Open Medium / Low</div>
              <div className="mt-1 font-display text-2xl font-bold text-amber-600 tabular-nums">
                {posture.mediumCount} / {posture.lowCount}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">Active Hardening Queue</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="text-[11px] font-medium text-slate-500">Mitigated Controls</div>
              <div className="mt-1 font-display text-2xl font-bold text-[var(--gs-primary)] tabular-nums">
                {findings.filter((f) => f.status === 'mitigated').length}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">Verified in Production</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="text-[11px] font-medium text-slate-500">Live Sentinel Agent</div>
              <div className="mt-1 flex items-center gap-1.5 font-display text-sm font-bold text-slate-900">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="truncate">Aegis Sentinel</span>
              </div>
              <div className="mt-1 text-[10px] font-mono text-slate-500">
                Daily {String(settingsDraft?.daily_hour_utc ?? 15).padStart(2, '0')}:00 UTC
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            {
              id: 'domains',
              label: `8-Domain Defense Matrix (${domains.length})`,
              icon: ShieldCheck
            },
            {
              id: 'findings',
              label: `Up-to-Date Findings & Advisories (${findings.length})`,
              icon: AlertTriangle
            },
            {
              id: 'reports',
              label: `Daily CyberSec PDF Reports (${reports.length})`,
              icon: FileText
            },
            {
              id: 'schedule',
              label: 'Aegis Agent & Daily Report Schedule',
              icon: Clock
            }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`min-h-[38px] inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[var(--gs-primary)] text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="text-xs font-semibold text-[var(--gs-primary)] hover:underline"
          >
            Manage Encrypted Integration Vault →
          </button>
        )}
      </div>

      {/* TAB 1: 8-DOMAIN DEFENSE MATRIX & AI THREAT INTEL */}
      {activeTab === 'domains' && (
        <div className="space-y-4">
          {threatIntel.length > 0 && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Bot className="h-4 w-4 text-[var(--gs-primary)]" />
                <span>
                  Aegis Live Threat Intelligence Feed (OWASP API/LLM Top 10 · CISA KEV · Supply-Chain
                  Watch)
                </span>
              </div>
              <div className="mt-2.5 grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {threatIntel.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-indigo-100 bg-white px-3 py-2 text-xs text-slate-700 flex items-start gap-2"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-[var(--gs-primary)] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {domains.map(renderDomainCard)}
          </div>
        </div>
      )}

      {/* TAB 2: FINDINGS & AI REMEDIATION */}
      {activeTab === 'findings' && (
        <div className="space-y-4">
          {findings.map((finding: CyberSecurityFinding) => (
            <div
              key={finding.id}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                        SEVERITY_BADGE[finding.severity]
                      }`}
                    >
                      {finding.severity}
                    </span>
                    <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                      {finding.domain}
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-[var(--gs-primary)]">
                      {finding.cve_or_rule}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      Module: {finding.affected_module}
                    </span>
                  </div>
                  <h4 className="mt-1.5 font-display text-sm font-bold text-slate-900">
                    {finding.title}
                  </h4>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    aria-label={`Status for ${finding.title}`}
                    value={finding.status}
                    disabled={!canManage || updatingFindingId === finding.id}
                    onChange={(e) =>
                      handleUpdateFindingStatus(
                        finding.id,
                        e.target.value as CyberFindingStatus
                      )
                    }
                    className="min-h-[36px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="open">Open</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="mitigated">Mitigated</option>
                    <option value="accepted">Risk Accepted</option>
                  </select>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-slate-600">{finding.description}</p>

              <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--gs-primary)]">
                  Aegis AI CyberSec Remediation &amp; Guardrail
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-700">
                  {finding.ai_remediation}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: DAILY CYBERSECURITY PDF REPORTS */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3.5 flex items-center justify-between">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-700">
                Daily Security Briefings
              </h3>
              <span className="font-mono text-xs text-slate-500">{reports.length}</span>
            </div>
            <div className="divide-y divide-slate-200 max-h-[540px] overflow-y-auto">
              {reports.map((rep) => {
                const selected = selectedReport?.id === rep.id;
                return (
                  <button
                    key={rep.id}
                    type="button"
                    onClick={() => setSelectedReport(rep)}
                    className={`w-full text-left p-4 transition-colors ${
                      selected ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {rep.report_date}
                      </span>
                      <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
                        Grade {rep.grade} ({rep.posture_score}%)
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-600 line-clamp-2">
                      {rep.executive_summary}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{rep.recipient_email || 'Local Archive'}</span>
                      <span>{rep.status === 'sent' ? 'Emailed + PDF' : 'Generated'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2">
            {selectedReport ? (
              <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--gs-primary)]">
                      Daily Cybersecurity Executive Briefing · {selectedReport.report_date}
                    </div>
                    <h3 className="mt-1 font-display text-base font-bold text-slate-900">
                      Posture Grade {selectedReport.grade} ({selectedReport.posture_score}
                      /100) — Sentinel Agent Aegis
                    </h3>
                  </div>

                  <a
                    href={api.getCyberSecurityReportPdfUrl(selectedReport.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Executive PDF Report</span>
                  </a>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-900">Executive Summary</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700">
                    {selectedReport.executive_summary}
                  </p>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-900 mb-2">
                    Up-to-Date Threat Intelligence &amp; Advisory Watch
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {selectedReport.ai_threat_intel.map((th, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2"
                      >
                        • {th}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-900 mb-2">
                    8-Domain Snapshot ({selectedReport.domain_checks.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedReport.domain_checks.map((d) => (
                      <div
                        key={d.domain_id}
                        className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{d.domain_name}</div>
                          <div className="text-[11px] text-slate-500 line-clamp-1">{d.summary}</div>
                        </div>
                        <span className="font-mono font-bold text-[#16A34A]">{d.score}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                Select a daily report or click “Send Daily CyberSec PDF Report Now” to generate one.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SCHEDULE & SENTINEL CONFIGURATION */}
      {activeTab === 'schedule' && settingsDraft && (
        <form
          onSubmit={handleSaveSettings}
          className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 max-w-3xl"
        >
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">
              Aegis Live Sentinel &amp; Daily Cybersecurity Report Schedule
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Configure continuous real-time threat auditing and automated daily PDF email dispatch
              via Lark Mail.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={settingsDraft.sentinel_enabled}
                onChange={(e) =>
                  setSettingsDraft({ ...settingsDraft, sentinel_enabled: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-[var(--gs-primary)]"
              />
              <span>Enable Live AI CyberSec Sentinel (Aegis)</span>
            </label>

            <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={settingsDraft.daily_report_enabled}
                onChange={(e) =>
                  setSettingsDraft({ ...settingsDraft, daily_report_enabled: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-[var(--gs-primary)]"
              />
              <span>Send Automated Daily CyberSec PDF Report</span>
            </label>

            <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 text-xs font-semibold text-slate-800 sm:col-span-2">
              <input
                type="checkbox"
                checked={settingsDraft.realtime_critical_alert}
                onChange={(e) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    realtime_critical_alert: e.target.checked
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-[var(--gs-primary)]"
              />
              <span>
                Dispatch Instant Lark Mail Alert on Critical Security Findings
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Daily Report Dispatch Hour (UTC, 0–23)
              </label>
              <input
                type="number"
                min={0}
                max={23}
                value={settingsDraft.daily_hour_utc}
                onChange={(e) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    daily_hour_utc: Math.max(0, Math.min(23, Number(e.target.value) || 0))
                  })
                }
                className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Daily CyberSec Report Recipient (Lark Mail)
              </label>
              <input
                type="email"
                value={settingsDraft.recipient_email}
                onChange={(e) =>
                  setSettingsDraft({ ...settingsDraft, recipient_email: e.target.value })
                }
                placeholder={dashboard?.resolvedRecipientEmail || 'admin@git-stack.org'}
                className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Lock className="h-3.5 w-3.5 text-emerald-600" />
              <span>
                Last daily report:{' '}
                <strong className="font-mono text-slate-700">
                  {settingsDraft.last_report_date || 'Ready'}
                </strong>
              </span>
            </div>
            <button
              type="submit"
              disabled={savingSettings || !canManage}
              className="min-h-[40px] rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
            >
              {savingSettings ? 'Saving...' : 'Save Cybersecurity Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
