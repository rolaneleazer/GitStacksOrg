import {
  CheckCircle2,
  Clock,
  Copy,
  FileCheck2,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
  XCircle
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import type {
  AgentEmailReport,
  AgentId,
  AgentOfficeProfile,
  AgentReportSettings,
  AgentSnapshotItem,
  LarkConnectionStatus
} from '../../shared/types.ts';

interface AgentReportsPanelProps {
  settings: AgentReportSettings;
  reports: AgentEmailReport[];
  preview: {
    subject: string;
    bodyText: string;
    overallScore: number;
    snapshots: AgentSnapshotItem[];
  } | null;
  profiles: AgentOfficeProfile[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onSaveSettings: (payload: Partial<AgentReportSettings>) => Promise<void>;
  onDispatchServerReport: () => Promise<{ report: AgentEmailReport; deliveredViaServer: boolean }>;
}

const ALL_AGENTS: AgentId[] = [
  'ceo',
  'marketing',
  'booking',
  'cybersecurity',
  'qa',
  'adsense',
  'traffic'
];

export function AgentReportsPanel({
  settings,
  reports,
  preview,
  profiles,
  loading,
  onRefresh,
  onSaveSettings,
  onDispatchServerReport
}: AgentReportsPanelProps) {
  const [recipientEmail, setRecipientEmail] = useState(settings.recipient_email);
  const [enabled, setEnabled] = useState(settings.enabled);
  const [sendHourUtc, setSendHourUtc] = useState(settings.send_hour_utc);
  const [includeAgents, setIncludeAgents] = useState<AgentId[]>(settings.include_agents);
  const [savingSettings, setSavingSettings] = useState(false);

  const [larkStatus, setLarkStatus] = useState<LarkConnectionStatus | null>(null);
  const [confirmSendModalOpen, setConfirmSendModalOpen] = useState(false);
  const [sendingLark, setSendingLark] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Proof Certificate inspector modal
  const [selectedProof, setSelectedProof] = useState<AgentEmailReport | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setRecipientEmail(settings.recipient_email);
    setEnabled(settings.enabled);
    setSendHourUtc(settings.send_hour_utc);
    setIncludeAgents(settings.include_agents);
  }, [settings]);

  useEffect(() => {
    api
      .getLarkStatus()
      .then((status) => setLarkStatus(status))
      .catch(() => {});
  }, []);

  const toggleAgent = (id: AgentId) => {
    setIncludeAgents((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((x) => x !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setFeedback(null);
    try {
      await onSaveSettings({
        recipient_email: recipientEmail.trim(),
        enabled,
        send_hour_utc: sendHourUtc,
        preferred_channel: 'lark_smtp',
        include_agents: includeAgents
      });
      setFeedback({ type: 'ok', text: 'Daily AI agent report schedule and Lark Mail recipient saved.' });
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save report settings.'
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleConfirmSendViaLark = async () => {
    setSendingLark(true);
    setFeedback(null);
    try {
      const res = await onDispatchServerReport();
      setConfirmSendModalOpen(false);
      setSelectedProof(res.report);
      if (res.deliveredViaServer) {
        setFeedback({
          type: 'ok',
          text: `Daily AI agent digest delivered via Lark Mail SMTP to ${res.report.recipient_email} (Message ID: ${res.report.provider_message_id}).`
        });
      } else {
        setFeedback({
          type: 'err',
          text:
            res.report.error_detail ||
            'Lark Mail SMTP is not configured. Connect Lark Mail in Settings -> Integrations Vault.'
        });
      }
    } catch (err) {
      setConfirmSendModalOpen(false);
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Lark Mail dispatch failed.'
      });
    } finally {
      setSendingLark(false);
    }
  };

  const handleCopy = (label: string, value: string) => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopiedId(label);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss notification"
            className="p-0.5 opacity-70 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Top Row: Configuration + Dispatch + Preview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Daily Schedule & Recipient Settings (5 cols) */}
        <form
          onSubmit={handleSaveSettings}
          className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-5 space-y-4"
        >
          <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900">
                Daily Agent Email Report Schedule
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Automated schedule and on-demand digests dispatch exclusively via Lark Mail SMTP SSL
                with SHA-256 verification proof.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[var(--gs-primary)]"
              />
              <span>Enabled</span>
            </label>
          </div>

          <div>
            <label htmlFor="report-recipient" className="block text-xs font-semibold text-slate-700">
              Recipient Email
            </label>
            <input
              id="report-recipient"
              type="email"
              required
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="report-hour" className="block text-xs font-semibold text-slate-700">
                Daily Target Hour (UTC)
              </label>
              <select
                id="report-hour"
                value={sendHourUtc}
                onChange={(e) => setSendHourUtc(Number(e.target.value))}
                className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-900"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00 UTC
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-700">Mail Transport</span>
              <div className="mt-1.5 min-h-[42px] flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800">
                Lark Mail SMTP SSL (465)
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-700 mb-2">
              Included Operational Agents ({includeAgents.length}/7)
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_AGENTS.map((id) => {
                const prof = profiles.find((p) => p.agent_id === id);
                const checked = includeAgents.includes(id);
                return (
                  <label
                    key={id}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs cursor-pointer ${
                      checked
                        ? 'border-[var(--gs-primary)] bg-[var(--gs-soft-bg)] text-slate-900 font-medium'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAgent(id)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-[var(--gs-primary)]"
                    />
                    <span className="truncate">{prof?.display_name || id}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <span className="text-[11px] text-slate-500 flex items-center gap-1 tabular-nums">
              <Clock className="h-3.5 w-3.5" />
              Last sent:{' '}
              {settings.last_sent_at
                ? new Date(settings.last_sent_at).toLocaleString()
                : 'Never sent yet'}
            </span>
            <button
              type="submit"
              disabled={savingSettings}
              className="min-h-[40px] rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {savingSettings ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>
        </form>

        {/* Right: Lark Mail Dispatch + Live Digest Preview (7 cols) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-7 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Live Daily Digest Preview &amp; Lark Mail Dispatch
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Sends the full deterministic audit via Lark Mail SMTP SSL and records immutable
                  SHA-256 proof.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRefresh()}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Digest</span>
              </button>
            </div>

            {/* Dispatch Action Bar */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-semibold text-slate-800">Lark Mail Sender: </span>
                  {larkStatus?.connected ? (
                    <span className="text-emerald-700 font-medium font-mono">
                      Connected ({larkStatus.lark_email} · {larkStatus.smtp_host || 'smtp.larksuite.com'}:
                      {larkStatus.smtp_port || 465})
                    </span>
                  ) : (
                    <span className="text-amber-700 font-medium">
                      Not configured — connect Lark Mail in Settings -&gt; Integrations Vault
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmSendModalOpen(true)}
                  disabled={!preview || sendingLark}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send Daily Report via Lark Mail Now</span>
                </button>
              </div>
            </div>

            {/* Live Preview Box */}
            {preview && (
              <div className="rounded-xl border border-slate-200 bg-slate-950 p-4 text-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-2.5 text-xs">
                  <span className="font-semibold text-sky-300 truncate">{preview.subject}</span>
                  <span className="font-mono text-[11px] rounded bg-slate-800 px-2 py-0.5 text-emerald-400 tabular-nums">
                    Fleet Score: {preview.overallScore}%
                  </span>
                </div>
                <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-300">
                  {preview.bodyText}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Verifiable Delivery Proof Log Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">
              Email Delivery Proof Log ({reports.length} Recorded Dispatches)
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Every outbound daily report stores the Lark SMTP Message ID, exact timestamp, agent
              snapshot scores, and a SHA-256 verification digest.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pr-3">Sent At</th>
                <th className="py-2.5 pr-3">Recipient</th>
                <th className="py-2.5 pr-3">Channel</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-3">SMTP Message ID</th>
                <th className="py-2.5 pr-3">Score</th>
                <th className="py-2.5 pr-3">SHA-256 Proof</th>
                <th className="py-2.5 text-right">Certificate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-500">
                    No email reports dispatched yet. Send a digest via Lark Mail above to record
                    your first verifiable delivery proof.
                  </td>
                </tr>
              ) : (
                reports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pr-3 font-mono text-[11px] text-slate-700 whitespace-nowrap tabular-nums">
                      {new Date(rep.sent_at).toLocaleString()}
                    </td>
                    <td className="py-3 pr-3 font-medium text-slate-900">{rep.recipient_email}</td>
                    <td className="py-3 pr-3 text-[11px] text-slate-600">
                      <span className="font-mono">
                        {rep.channel === 'lark_smtp' || rep.channel === 'cron_dispatch'
                          ? 'Lark SMTP SSL'
                          : rep.channel}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        {rep.trigger_type === 'daily_cron' ? 'Scheduled Cron' : 'Manual Trigger'}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      {rep.status === 'sent' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Sent
                        </span>
                      ) : rep.status === 'failed' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                          <XCircle className="h-3.5 w-3.5" /> Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                          <Clock className="h-3.5 w-3.5" /> Unconfigured
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3 font-mono text-[11px] text-slate-700">
                      {rep.provider_message_id || '—'}
                    </td>
                    <td className="py-3 pr-3 font-mono font-bold text-slate-900 tabular-nums">
                      {rep.overall_score}%
                    </td>
                    <td className="py-3 pr-3 font-mono text-[11px] text-slate-500">
                      {rep.proof_hash.slice(0, 14)}…
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedProof(rep)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[var(--gs-primary)] hover:bg-[var(--gs-soft-bg)]"
                      >
                        <FileCheck2 className="h-3.5 w-3.5" />
                        <span>Inspect Proof</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmSendModalOpen && preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-lark-report-title"
        >
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h4
                  id="confirm-lark-report-title"
                  className="font-display text-base font-bold text-slate-900"
                >
                  Confirm Outbound Daily Agent Report
                </h4>
                <p className="mt-0.5 text-xs text-slate-500">
                  Review recipient and digest body before dispatching via Lark Mail SMTP SSL.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmSendModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-semibold text-slate-600">From Account</span>
                <span className="font-mono text-slate-900">
                  {larkStatus?.lark_email || 'Vault Lark Mail SMTP'}
                </span>
              </div>
              <div className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-semibold text-slate-600">To Recipient</span>
                <span className="font-mono text-slate-900">{recipientEmail.trim()}</span>
              </div>
              <div className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-semibold text-slate-600">Subject</span>
                <span className="font-medium text-slate-900 text-right">{preview.subject}</span>
              </div>
            </div>

            <pre className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-950 p-3.5 whitespace-pre-wrap font-mono text-[11px] text-slate-200">
              {preview.bodyText}
            </pre>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSendModalOpen(false)}
                className="min-h-[40px] rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSendViaLark}
                disabled={sendingLark}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{sendingLark ? 'Sending via Lark Mail...' : 'Confirm & Send Email'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Certificate Inspector Modal */}
      {selectedProof && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="proof-cert-title"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                  Verifiable Delivery Certificate
                </div>
                <h4 id="proof-cert-title" className="font-display text-base font-bold text-slate-900">
                  {selectedProof.subject}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProof(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] text-slate-500">Recipient &amp; Timestamp</div>
                <div className="mt-1 font-semibold text-slate-900">{selectedProof.recipient_email}</div>
                <div className="mt-0.5 font-mono text-[11px] text-slate-600">
                  {new Date(selectedProof.sent_at).toISOString()}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] text-slate-500">Delivery Status &amp; Channel</div>
                <div className="mt-1 font-semibold text-slate-900 uppercase">
                  {selectedProof.status} · {selectedProof.channel}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-slate-600 tabular-nums">
                  Score: {selectedProof.overall_score}%
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-700">SMTP Message ID</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-900">
                    {selectedProof.provider_message_id || 'None'}
                  </span>
                  {selectedProof.provider_message_id && (
                    <button
                      type="button"
                      onClick={() => handleCopy('msg', selectedProof.provider_message_id)}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                    >
                      <Copy className="h-3 w-3" />
                      {copiedId === 'msg' ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-700">SHA-256 Proof Digest</span>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] text-slate-900 truncate max-w-[260px]">
                    {selectedProof.proof_hash}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('hash', selectedProof.proof_hash)}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 shrink-0"
                  >
                    <Copy className="h-3 w-3" />
                    {copiedId === 'hash' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {selectedProof.error_detail && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
                  {selectedProof.error_detail}
                </div>
              )}
            </div>

            {selectedProof.agent_snapshots.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-800 mb-2">
                  Agent Snapshot Included in This Email
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedProof.agent_snapshots.map((snap) => (
                    <div
                      key={snap.agent_id}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{snap.display_name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{snap.top_finding}</div>
                      </div>
                      <span className="font-mono font-bold text-slate-900 shrink-0 tabular-nums">
                        {snap.score}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold text-slate-800 mb-1.5">
                Verbatim Email Body Delivered
              </div>
              <pre className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-950 p-3.5 whitespace-pre-wrap font-mono text-[11px] text-slate-200">
                {selectedProof.body_text}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
