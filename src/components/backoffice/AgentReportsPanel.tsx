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
import {
  connectGmailWithGoogle,
  disconnectGmail,
  getCachedGmailToken,
  initGmailAuth,
  sendGmailMessage
} from '../../lib/gmail.ts';
import type {
  AgentEmailReport,
  AgentId,
  AgentOfficeProfile,
  AgentReportSettings,
  AgentSnapshotItem
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
  onLogGmailReport: (payload: {
    recipient_email: string;
    subject: string;
    body_text: string;
    provider_message_id: string;
    provider_thread_id?: string;
    status: 'sent' | 'failed' | 'skipped_unconfigured';
    overall_score: number;
    agent_snapshots: AgentSnapshotItem[];
    error_detail?: string;
  }) => Promise<AgentEmailReport>;
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
  onLogGmailReport,
  onDispatchServerReport
}: AgentReportsPanelProps) {
  const [recipientEmail, setRecipientEmail] = useState(settings.recipient_email);
  const [enabled, setEnabled] = useState(settings.enabled);
  const [sendHourUtc, setSendHourUtc] = useState(settings.send_hour_utc);
  const [preferredChannel, setPreferredChannel] = useState<'gmail' | 'resend'>(
    settings.preferred_channel
  );
  const [includeAgents, setIncludeAgents] = useState<AgentId[]>(settings.include_agents);
  const [savingSettings, setSavingSettings] = useState(false);

  // Gmail OAuth state (kept strictly in-memory via gmail.ts)
  const [gmailUserEmail, setGmailUserEmail] = useState<string | null>(null);
  const [gmailToken, setGmailToken] = useState<string | null>(() => getCachedGmailToken());
  const [connectingGmail, setConnectingGmail] = useState(false);

  // Confirmation modal & dispatch feedback
  const [confirmGmailModalOpen, setConfirmGmailModalOpen] = useState(false);
  const [sendingGmail, setSendingGmail] = useState(false);
  const [sendingCron, setSendingCron] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Proof Certificate inspector modal
  const [selectedProof, setSelectedProof] = useState<AgentEmailReport | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setRecipientEmail(settings.recipient_email);
    setEnabled(settings.enabled);
    setSendHourUtc(settings.send_hour_utc);
    setPreferredChannel(settings.preferred_channel);
    setIncludeAgents(settings.include_agents);
  }, [settings]);

  useEffect(() => {
    const unsub = initGmailAuth(
      (user, token) => {
        setGmailUserEmail(user.email || 'Google Workspace Account');
        setGmailToken(token);
      },
      () => {
        setGmailUserEmail(null);
        setGmailToken(null);
      }
    );
    return () => unsub();
  }, []);

  const handleConnectGmail = async () => {
    setConnectingGmail(true);
    setFeedback(null);
    try {
      const { user, accessToken } = await connectGmailWithGoogle();
      setGmailUserEmail(user.email || 'Connected Google Account');
      setGmailToken(accessToken);
      setFeedback({
        type: 'ok',
        text: `Gmail connected as ${user.email || 'Google user'}. Ready to send verified agent reports.`
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to connect Gmail account.'
      });
    } finally {
      setConnectingGmail(false);
    }
  };

  const handleDisconnectGmail = async () => {
    await disconnectGmail();
    setGmailUserEmail(null);
    setGmailToken(null);
  };

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
        preferred_channel: preferredChannel,
        include_agents: includeAgents
      });
      setFeedback({ type: 'ok', text: 'Daily agent report schedule and recipient saved.' });
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

  const handleConfirmSendViaGmail = async () => {
    if (!gmailToken || !preview) return;
    setSendingGmail(true);
    setFeedback(null);
    try {
      const result = await sendGmailMessage(gmailToken, {
        to: recipientEmail.trim(),
        subject: preview.subject,
        body: preview.bodyText
      });

      const logged = await onLogGmailReport({
        recipient_email: recipientEmail.trim(),
        subject: preview.subject,
        body_text: preview.bodyText,
        provider_message_id: result.id,
        provider_thread_id: result.threadId || '',
        status: 'sent',
        overall_score: preview.overallScore,
        agent_snapshots: preview.snapshots
      });

      setConfirmGmailModalOpen(false);
      setSelectedProof(logged);
      setFeedback({
        type: 'ok',
        text: `Report delivered to ${recipientEmail.trim()} (Gmail Message ID: ${result.id}). Proof Certificate recorded.`
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Gmail send failed.';
      await onLogGmailReport({
        recipient_email: recipientEmail.trim(),
        subject: preview.subject,
        body_text: preview.bodyText,
        provider_message_id: '',
        provider_thread_id: '',
        status: 'failed',
        overall_score: preview.overallScore,
        agent_snapshots: preview.snapshots,
        error_detail: errMsg
      }).catch(() => {});
      setConfirmGmailModalOpen(false);
      setFeedback({ type: 'err', text: errMsg });
    } finally {
      setSendingGmail(false);
    }
  };

  const handleTriggerCronDispatch = async () => {
    setSendingCron(true);
    setFeedback(null);
    try {
      const res = await onDispatchServerReport();
      setSelectedProof(res.report);
      if (res.deliveredViaServer) {
        setFeedback({
          type: 'ok',
          text: `Server report delivered to ${res.report.recipient_email} (Resend ID: ${res.report.provider_message_id}).`
        });
      } else {
        setFeedback({
          type: 'err',
          text: res.report.error_detail || 'Server cron logged as skipped_unconfigured.'
        });
      }
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Server dispatch failed.'
      });
    } finally {
      setSendingCron(false);
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
                Vercel Cron runs daily at 08:00 UTC or send on-demand via Gmail with cryptographic proof.
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
              <label htmlFor="report-channel" className="block text-xs font-semibold text-slate-700">
                Primary Channel
              </label>
              <select
                id="report-channel"
                value={preferredChannel}
                onChange={(e) => setPreferredChannel(e.target.value as 'gmail' | 'resend')}
                className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-900"
              >
                <option value="gmail">Gmail OAuth (Verified ID)</option>
                <option value="resend">Vercel Cron + Resend API</option>
              </select>
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
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
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

        {/* Right: Gmail / Cron Dispatch + Live Digest Preview (7 cols) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-7 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Live Daily Digest Preview &amp; Dispatch
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Sends the full deterministic audit across your selected agents and logs immutable proof.
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs">
                  <span className="font-semibold text-slate-800">Gmail Sender: </span>
                  {gmailToken ? (
                    <span className="text-emerald-700 font-medium">
                      Connected ({gmailUserEmail || 'Google Account'})
                    </span>
                  ) : (
                    <span className="text-slate-500">Not connected in this session</span>
                  )}
                </div>
                {gmailToken && (
                  <button
                    type="button"
                    onClick={handleDisconnectGmail}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline"
                  >
                    Disconnect Gmail
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {!gmailToken ? (
                  <button
                    type="button"
                    onClick={handleConnectGmail}
                    disabled={connectingGmail}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                  >
                    <Mail className="h-4 w-4" />
                    <span>{connectingGmail ? 'Connecting...' : 'Connect Google Gmail to Send'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmGmailModalOpen(true)}
                    disabled={!preview}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Daily Report via Gmail Now</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleTriggerCronDispatch}
                  disabled={sendingCron}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4 text-slate-600" />
                  <span>{sendingCron ? 'Dispatching...' : 'Run Cron Dispatch Now'}</span>
                </button>
              </div>
            </div>

            {/* Live Preview Box */}
            {preview && (
              <div className="rounded-xl border border-slate-200 bg-slate-950 p-4 text-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-2.5 text-xs">
                  <span className="font-semibold text-sky-300 truncate">{preview.subject}</span>
                  <span className="font-mono text-[11px] rounded bg-slate-800 px-2 py-0.5 text-emerald-400">
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
              Every outbound daily report stores the provider Message ID, exact timestamp, agent snapshot scores, and a SHA-256 verification digest.
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
                <th className="py-2.5 pr-3">Provider Message ID</th>
                <th className="py-2.5 pr-3">Score</th>
                <th className="py-2.5 pr-3">SHA-256 Proof</th>
                <th className="py-2.5 text-right">Certificate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-500">
                    No email reports dispatched yet. Connect Gmail above or run Cron Dispatch to generate your first verifiable delivery proof.
                  </td>
                </tr>
              ) : (
                reports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pr-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                      {new Date(rep.sent_at).toLocaleString()}
                    </td>
                    <td className="py-3 pr-3 font-medium text-slate-900">{rep.recipient_email}</td>
                    <td className="py-3 pr-3 text-[11px] text-slate-600">
                      <span className="font-mono">{rep.channel}</span>
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

      {/* Mandatory Send Confirmation Modal (Workspace Integration Rule) */}
      {confirmGmailModalOpen && preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-gmail-title"
        >
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h4 id="confirm-gmail-title" className="font-display text-base font-bold text-slate-900">
                  Confirm Outbound Daily Agent Report
                </h4>
                <p className="mt-0.5 text-xs text-slate-500">
                  Review recipient and full email body before authorizing Gmail API delivery.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmGmailModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-semibold text-slate-600">From Account</span>
                <span className="font-mono text-slate-900">{gmailUserEmail || 'Connected Gmail'}</span>
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
                onClick={() => setConfirmGmailModalOpen(false)}
                className="min-h-[40px] rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSendViaGmail}
                disabled={sendingGmail}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{sendingGmail ? 'Sending via Gmail...' : 'Confirm & Send Email'}</span>
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
                <div className="mt-0.5 font-mono text-[11px] text-slate-600">
                  Score: {selectedProof.overall_score}%
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-700">Provider Message ID</span>
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

              {selectedProof.provider_thread_id && (
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700">Gmail Thread ID</span>
                  <span className="font-mono text-slate-900">{selectedProof.provider_thread_id}</span>
                </div>
              )}

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
                      <span className="font-mono font-bold text-slate-900 shrink-0">{snap.score}%</span>
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
