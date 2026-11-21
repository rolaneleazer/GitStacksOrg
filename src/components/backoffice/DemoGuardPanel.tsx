import {
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  Lock,
  Mail,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  XCircle
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import type { DemoGuardDashboardResponse } from '../../shared/types.ts';

interface DemoGuardPanelProps {
  onJumpToSettings?: () => void;
}

type GuardSubTab = 'alerts' | 'isolation' | 'admin_parity';

export function DemoGuardPanel({ onJumpToSettings }: DemoGuardPanelProps) {
  const [dashboard, setDashboard] = useState<DemoGuardDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<GuardSubTab>('alerts');
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [autoWatchEnabled, setAutoWatchEnabled] = useState(true);
  const [autoEmailEnabled, setAutoEmailEnabled] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState('gitstackitsolution@gmail.com');

  const syncSettingsFields = (data: DemoGuardDashboardResponse) => {
    setAutoWatchEnabled(data.autoWatchEnabled);
    setAutoEmailEnabled(data.autoEmailEnabled);
    setRecipientEmail(data.recipientEmail || 'gitstackitsolution@gmail.com');
  };

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDemoGuardDashboard();
      setDashboard(data);
      syncSettingsFields(data);
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load Demo Guard dashboard.'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleRunScan = async () => {
    setScanning(true);
    setNotice(null);
    try {
      const res = await api.runDemoGuardScan();
      setDashboard(res.dashboard);
      syncSettingsFields(res.dashboard);
      setNotice({
        type: res.driftDetected || res.isolationFailed || res.adminFailed ? 'err' : 'ok',
        text: res.message
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to run Demo Guard scan.'
      });
    } finally {
      setScanning(false);
    }
  };

  const handleSealBaseline = async () => {
    setSealing(true);
    setNotice(null);
    try {
      const res = await api.sealDemoGuardBaseline();
      setDashboard(res.dashboard);
      syncSettingsFields(res.dashboard);
      setNotice({ type: 'ok', text: res.message });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to seal Demo baseline.'
      });
    } finally {
      setSealing(false);
    }
  };

  const handleSendTestAlert = async () => {
    setTestingEmail(true);
    setNotice(null);
    try {
      const res = await api.sendDemoGuardTestAlert();
      setDashboard(res.dashboard);
      setNotice({
        type: res.delivered ? 'ok' : 'err',
        text: res.delivered
          ? `Real-time alert test email delivered to ${res.recipient}.`
          : `Test email logged for ${res.recipient} (${res.statusNote}). Verify Lark Mail SMTP in Settings if delivery failed.`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to send test alert email.'
      });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setNotice(null);
    try {
      const res = await api.updateDemoGuardSettings({
        autoWatchEnabled,
        autoEmailEnabled,
        recipientEmail: recipientEmail.trim()
      });
      setDashboard(res.dashboard);
      syncSettingsFields(res.dashboard);
      setNotice({ type: 'ok', text: 'Demo Guard alert configuration saved.' });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to save Demo Guard settings.'
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    setAcknowledgingId(alertId);
    try {
      const res = await api.ackDemoGuardAlert(alertId);
      setDashboard(res.dashboard);
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to acknowledge alert.'
      });
    } finally {
      setAcknowledgingId(null);
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-600">
        Loading Demo Guard &amp; Admin Parity Sentinel...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header & Primary Actions */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--gs-primary)]">
              <ShieldAlert className="h-4 w-4" />
              <span>Real-Time Demo Isolation Sentinel &amp; Authenticated Admin Parity Monitor</span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">
              Demo Guard &amp; Real-Time Alert Center
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Fingerprints all Live Demo (<span className="font-mono">/demo</span>) source files
              against a sealed SHA-256 baseline, enforces zero-leak isolation rules, verifies every
              authenticated Admin Back Office module returns HTTP 200, and triggers instant Lark
              Mail alerts on any drift or leak.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={scanning}
              onClick={handleRunScan}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
              <span>{scanning ? 'Scanning Demo & Admin...' : 'Run Full Guard & Parity Scan'}</span>
            </button>

            <button
              type="button"
              disabled={sealing}
              onClick={handleSealBaseline}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>{sealing ? 'Sealing...' : 'Approve & Seal Baseline'}</span>
            </button>

            <button
              type="button"
              disabled={testingEmail}
              onClick={handleSendTestAlert}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>{testingEmail ? 'Dispatching...' : 'Send Test Alert Email'}</span>
            </button>
          </div>
        </div>

        {notice && (
          <div
            className={`rounded-lg border px-4 py-3 text-xs font-medium ${
              notice.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            {notice.text}
          </div>
        )}
      </div>

      {/* KPI Strip */}
      {dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-medium text-slate-500">Demo Isolation Score</div>
            <div
              className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
                dashboard.demoScore === 100
                  ? 'text-emerald-700'
                  : dashboard.demoScore >= 80
                    ? 'text-amber-700'
                    : 'text-rose-700'
              }`}
            >
              {dashboard.demoScore}%
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Status: <strong className="capitalize text-slate-800">{dashboard.overallStatus}</strong>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-medium text-slate-500">Admin Module Parity</div>
            <div
              className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
                dashboard.adminParityScore === 100 ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {dashboard.adminParityScore}%
            </div>
            <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
              {dashboard.adminParityChecks.filter((c) => c.status === 'pass').length}/
              {dashboard.adminParityChecks.length} Admin endpoints passing
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-medium text-slate-500">Sealed Baseline Hash</div>
            <div className="mt-1 font-mono text-sm font-bold text-slate-900 truncate">
              {dashboard.baseline.overallHash}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 truncate">
              {dashboard.driftItems.filter((d) => d.status === 'matched').length}/
              {dashboard.driftItems.length} files unchanged
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-medium text-slate-500">Unacknowledged Alerts</div>
            <div
              className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
                dashboard.unacknowledgedCount > 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {dashboard.unacknowledgedCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 truncate">
              Last scan:{' '}
              {dashboard.lastScanAt
                ? new Date(dashboard.lastScanAt).toLocaleTimeString()
                : 'Pending'}
            </div>
          </div>
        </div>
      )}

      {/* Settings Form */}
      <form
        onSubmit={handleSaveSettings}
        className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-wrap items-end justify-between gap-4"
      >
        <div className="flex flex-wrap items-center gap-5 text-xs text-slate-800">
          <label className="inline-flex items-center gap-2 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={autoWatchEnabled}
              onChange={(e) => setAutoWatchEnabled(e.target.checked)}
            />
            <span>Background Auto-Watch Loop (5 min)</span>
          </label>

          <label className="inline-flex items-center gap-2 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={autoEmailEnabled}
              onChange={(e) => setAutoEmailEnabled(e.target.checked)}
            />
            <span>Instant Lark Mail Alert on Drift / Leak / Failure</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div>
            <label className="sr-only" htmlFor="demo-guard-recipient">
              Alert Recipient Email
            </label>
            <input
              id="demo-guard-recipient"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="gitstackitsolution@gmail.com"
              className="min-h-[36px] w-64 rounded-lg border border-slate-200 px-3 text-xs font-mono text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={savingSettings}
            className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{savingSettings ? 'Saving...' : 'Save Guard Config'}</span>
          </button>
          {onJumpToSettings && (
            <button
              type="button"
              onClick={onJumpToSettings}
              className="text-xs font-semibold text-[var(--gs-primary)] hover:underline px-2"
            >
              Lark SMTP Settings →
            </button>
          )}
        </div>
      </form>

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setSubTab('alerts')}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            subTab === 'alerts'
              ? 'bg-[var(--gs-primary)] text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          Alert Feed &amp; File Baseline ({dashboard?.alerts.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('isolation')}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            subTab === 'isolation'
              ? 'bg-[var(--gs-primary)] text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          Demo Isolation Firewall ({dashboard?.isolationChecks.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('admin_parity')}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            subTab === 'admin_parity'
              ? 'bg-[var(--gs-primary)] text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          Admin Module Parity Matrix ({dashboard?.adminParityChecks.length || 0})
        </button>
      </div>

      {/* TAB 1: ALERTS & FILE DRIFT */}
      {subTab === 'alerts' && dashboard && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Real-Time Alerts */}
          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-900">
                Real-Time Sentinel Alerts &amp; Email Dispatch Log
              </h3>
              <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                {dashboard.unacknowledgedCount} open
              </span>
            </div>
            {dashboard.alerts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No drift or leak events detected yet. Run a scan or click Send Test Alert Email to
                verify notification routing.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                {dashboard.alerts.map((al) => (
                  <div key={al.id} className="p-4 space-y-2 hover:bg-slate-50/50">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {al.severity === 'critical' ? (
                          <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                        ) : al.severity === 'warning' ? (
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-slate-900">{al.title}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">
                        {new Date(al.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{al.detail}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="font-mono">
                        Target: {al.affectedTarget} · Email:{' '}
                        {al.emailSent ? `Sent to ${al.emailRecipient}` : al.emailStatus}
                      </span>
                      {!al.acknowledged ? (
                        <button
                          type="button"
                          disabled={acknowledgingId === al.id}
                          onClick={() => handleAcknowledgeAlert(al.id)}
                          className="rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                          {acknowledgingId === al.id ? 'Updating...' : 'Acknowledge'}
                        </button>
                      ) : (
                        <span className="text-emerald-700 font-semibold">Acknowledged</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Watched File Hashes */}
          <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-3.5 flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-[var(--gs-primary)]" />
              <h3 className="font-display text-sm font-bold text-slate-900">
                Watched Demo Files ({dashboard.driftItems.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {dashboard.driftItems.map((item) => (
                <div key={item.file} className="p-3.5 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-slate-800 truncate">
                      {item.file}
                    </span>
                    <span
                      className={`font-semibold capitalize ${
                        item.status === 'matched' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 truncate">
                    Sealed: {item.expectedHash} · Live: {item.actualHash}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DEMO ISOLATION FIREWALL */}
      {subTab === 'isolation' && dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {dashboard.isolationChecks.map((chk) => (
            <div key={chk.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold text-xs text-slate-900">
                  {chk.status === 'pass' ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : chk.status === 'warning' ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  )}
                  <span>{chk.label}</span>
                </div>
                <span className="font-mono text-[11px] font-semibold text-slate-700">
                  {chk.metric}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{chk.detail}</p>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: ADMIN MODULE PARITY MATRIX */}
      {subTab === 'admin_parity' && dashboard && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h3 className="font-display text-sm font-bold text-slate-900">
              Authenticated Admin Back Office Endpoint Verification
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Verifies that every real Admin module endpoint remains operational when signed in as
              Back Office Admin.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">Module</th>
                  <th className="px-4 py-2.5">Admin Endpoint</th>
                  <th className="px-4 py-2.5">HTTP</th>
                  <th className="px-4 py-2.5">Latency</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dashboard.adminParityChecks.map((row) => (
                  <tr key={row.endpoint} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-semibold text-slate-900">{row.moduleLabel}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-600">{row.endpoint}</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-slate-800">
                      {row.httpStatus || '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-slate-600">
                      {row.durationMs}ms
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`font-semibold capitalize ${
                          row.status === 'pass'
                            ? 'text-emerald-700'
                            : row.status === 'warning'
                              ? 'text-amber-700'
                              : 'text-rose-700'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
