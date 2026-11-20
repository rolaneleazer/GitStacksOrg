import { CheckCircle2, Clock, Mail, Send, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type {
  GrowthModuleEmailConfig,
  GrowthModuleEmailLog,
  GrowthModuleKey
} from '../../shared/types.ts';

interface GrowthEmailModuleCardProps {
  moduleKey: GrowthModuleKey;
  moduleTitle: string;
  description: string;
  config: GrowthModuleEmailConfig;
  logs: GrowthModuleEmailLog[];
  onSaveConfig: (patch: Partial<GrowthModuleEmailConfig>) => Promise<void>;
  onSendNow: (recipientEmail?: string) => Promise<{ delivered: boolean; message: string }>;
}

export function GrowthEmailModuleCard({
  moduleTitle,
  description,
  config,
  logs,
  onSaveConfig,
  onSendNow
}: GrowthEmailModuleCardProps) {
  const [recipientEmail, setRecipientEmail] = useState(config.recipient_email || '');
  const [frequency, setFrequency] = useState<GrowthModuleEmailConfig['frequency']>(
    config.frequency || 'daily'
  );
  const [sendHourUtc, setSendHourUtc] = useState<number>(config.send_hour_utc ?? 8);
  const [enabled, setEnabled] = useState<boolean>(config.enabled);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setRecipientEmail(config.recipient_email || '');
    setFrequency(config.frequency || 'daily');
    setSendHourUtc(config.send_hour_utc ?? 8);
    setEnabled(config.enabled);
  }, [config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      await onSaveConfig({
        enabled,
        recipient_email: recipientEmail.trim(),
        frequency,
        send_hour_utc: Number(sendHourUtc)
      });
      setNotice({ type: 'ok', text: `${moduleTitle} email schedule saved.` });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to save email configuration.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = async () => {
    setSending(true);
    setNotice(null);
    try {
      const res = await onSendNow(recipientEmail.trim() || undefined);
      setNotice({
        type: res.delivered ? 'ok' : 'err',
        text: res.message
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to dispatch Lark Mail report.'
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--gs-primary)]">
              <Mail className="h-4 w-4 shrink-0" />
              <span>Lark Mail Report Dispatch · {moduleTitle}</span>
            </div>
            <h3 className="mt-1 font-display text-base font-bold text-slate-900">
              Dedicated Email Module
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{description}</p>
          </div>
          <button
            type="button"
            onClick={handleSendNow}
            disabled={sending}
            className="min-h-[40px] inline-flex items-center gap-2 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Send className="h-3.5 w-3.5 shrink-0" />
            <span>{sending ? 'Sending via Lark Mail...' : 'Send Report Now'}</span>
          </button>
        </div>

        {notice && (
          <div
            className={`mt-4 rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
              notice.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {notice.text}
          </div>
        )}

        <form onSubmit={handleSave} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-12">
          <div className="sm:col-span-5">
            <label className="block text-xs font-semibold text-slate-700">
              Recipient Email (Lark Mail SMTP)
            </label>
            <input
              type="email"
              required
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="gitstackitsolution@gmail.com"
              className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-700">Cadence</label>
            <select
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as GrowthModuleEmailConfig['frequency'])
              }
              className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
            >
              <option value="daily">Daily Briefing</option>
              <option value="weekly">Weekly Summary</option>
              <option value="manual">Manual Dispatch Only</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700">Send Hour (UTC)</label>
            <input
              type="number"
              min={0}
              max={23}
              value={sendHourUtc}
              onChange={(e) => setSendHourUtc(Number(e.target.value))}
              className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-mono tabular-nums text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2 flex items-end">
            <label className="min-h-[40px] w-full inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[var(--gs-primary)]"
              />
              <span>Enabled</span>
            </label>
          </div>

          <div className="sm:col-span-12 flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>
                Last sent:{' '}
                <span className="font-mono text-slate-700">
                  {config.last_sent_at
                    ? new Date(config.last_sent_at).toLocaleString()
                    : 'Not dispatched yet'}
                </span>
              </span>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <span>{saving ? 'Saving...' : 'Save Email Schedule'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Delivery Proof Log */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h4 className="font-display text-sm font-bold text-slate-900">
            Email Delivery Log ({logs.length})
          </h4>
          <span className="text-[11px] text-slate-500">SMTP delivery proof records</span>
        </div>

        {logs.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-slate-500">
            No email reports dispatched for this module yet. Click <strong>Send Report Now</strong>{' '}
            above to deliver a live snapshot to your inbox.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Recipient</th>
                  <th className="px-4 py-2.5">Subject</th>
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-4 py-2.5">Delivery Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.slice(0, 15).map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {entry.status === 'sent' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span>Sent</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                          <XCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>Failed</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-700">
                      {entry.recipient_email}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900 max-w-[320px] truncate">
                      {entry.subject}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] tabular-nums text-slate-500 whitespace-nowrap">
                      {new Date(entry.sent_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-slate-600 max-w-[260px] truncate">
                      {entry.status === 'sent'
                        ? entry.provider_message_id || 'Accepted by Lark SMTP'
                        : entry.error_detail || 'SMTP not configured in Vault'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
