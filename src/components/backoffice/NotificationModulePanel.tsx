import {
  Bell,
  CheckCircle2,
  ExternalLink,
  Inbox,
  Mail,
  MessageSquare,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  XCircle
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import type {
  AdminNotificationSettings,
  InboxEmailLog,
  LiveChatNotifyMode,
  UserRole
} from '../../shared/types.ts';

interface NotificationModulePanelProps {
  currentUserRole: UserRole;
  onOpenSettings?: () => void;
  onOpenInbox?: () => void;
}

const ALERT_CATEGORY_LABEL: Record<string, string> = {
  chat_instant_alert: 'Instant Chat Alert',
  chat_offline_alert: 'Offline Chat Watcher',
  contact_alert: 'Contact Inquiry Alert',
  demo_signup_alert: 'Live Demo Alert',
  test_notification: 'Test Notification',
  inquiry_reply: 'Inquiry Reply',
  direct_compose: 'Direct Dispatch',
  chat_reply: 'Chat Lark Reply'
};

export function NotificationModulePanel({
  currentUserRole,
  onOpenSettings,
  onOpenInbox
}: NotificationModulePanelProps) {
  const canEdit = currentUserRole === 'super_admin' || currentUserRole === 'editor';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [settings, setSettings] = useState<AdminNotificationSettings>({
    id: 'default',
    enabled: true,
    recipient_email: '',
    admin_login_url: 'https://git-stack.org/obama',
    notify_on_live_chat: true,
    live_chat_mode: 'instant',
    offline_delay_minutes: 2,
    chat_cooldown_minutes: 1,
    notify_on_inquiry: true,
    notify_on_demo_signup: true,
    updated_by: 'system',
    updated_at: new Date().toISOString()
  });
  const [resolvedRecipient, setResolvedRecipient] = useState('');
  const [larkConnected, setLarkConnected] = useState(false);
  const [larkSenderEmail, setLarkSenderEmail] = useState('');
  const [adminOnline, setAdminOnline] = useState(true);
  const [logs, setLogs] = useState<InboxEmailLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<InboxEmailLog | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminNotifications();
      setSettings(res.settings);
      setResolvedRecipient(res.resolvedRecipientEmail);
      setLarkConnected(res.larkConnected);
      setLarkSenderEmail(res.larkSenderEmail);
      setAdminOnline(res.adminOnline);
      setLogs(res.logs);
      setSelectedLog((prev) =>
        prev ? res.logs.find((l) => l.id === prev.id) || res.logs[0] || null : res.logs[0] || null
      );
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load notification settings.'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canEdit || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await api.saveAdminNotifications(settings);
      setSettings(res.settings);
      setResolvedRecipient(res.resolvedRecipientEmail);
      setLarkConnected(res.larkConnected);
      setLarkSenderEmail(res.larkSenderEmail);
      setNotice({
        type: 'ok',
        text: `Notification rules saved. Alerts route to ${res.resolvedRecipientEmail} via Lark Mail.`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save notification rules.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (testing) return;
    setTesting(true);
    setNotice(null);
    try {
      const res = await api.sendTestAdminNotification({
        recipient_email: settings.recipient_email.trim() || undefined,
        admin_login_url: settings.admin_login_url.trim() || undefined
      });
      await loadNotifications();
      setSelectedLog(res.log);
      setNotice({
        type: res.delivered ? 'ok' : 'err',
        text: res.message
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to send test email to Lark Mail.'
      });
      await loadNotifications();
    } finally {
      setTesting(false);
    }
  };

  const effectiveTarget = settings.recipient_email.trim() || resolvedRecipient || larkSenderEmail;
  const sentCount = logs.filter((l) => l.status === 'sent').length;
  const failedCount = logs.filter((l) => l.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-[var(--gs-primary)] shrink-0" />
            <h2 className="font-display text-base font-bold text-slate-900">
              Lark Mail Inquiry &amp; Live Chat Notification Engine
            </h2>
          </div>
          <p className="text-xs text-slate-600">
            Receive instant Lark Mail alerts whenever a visitor starts a Live Chat, submits a Contact Form inquiry, or signs up for a Live Demo—including a one-click link to sign in to Back Office.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadNotifications}
            disabled={loading}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleSendTest}
            disabled={testing}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-[var(--gs-primary)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--gs-primary)] hover:bg-[var(--gs-soft-bg)] disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{testing ? 'Sending Test...' : 'Send Test to Lark Mail'}</span>
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? 'Saving...' : 'Save Rules'}</span>
            </button>
          )}
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
          {!larkConnected && onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Open Lark SMTP Vault
            </button>
          )}
        </div>
      )}

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-medium text-slate-500">Lark Mail SMTP Channel</div>
          <div className="mt-1.5 flex items-center gap-2 text-sm font-bold text-slate-900">
            {larkConnected ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-[#16A34A] shrink-0" />
                <span className="truncate">Connected</span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="truncate">Needs Vault Setup</span>
              </>
            )}
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-500 truncate">
            {larkSenderEmail || 'Configure in Settings & Integrations'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-medium text-slate-500">Alert Destination Email</div>
          <div className="mt-1.5 font-mono text-xs font-bold text-slate-900 truncate">
            {effectiveTarget || 'Not configured'}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {settings.recipient_email ? 'Custom Lark Recipient' : 'Auto-routed to Connected Lark'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-medium text-slate-500">Alert Delivery Mode</div>
          <div className="mt-1.5 text-sm font-bold text-slate-900">
            {!settings.enabled
              ? 'Paused'
              : settings.live_chat_mode === 'instant'
                ? 'Instant on New Chat'
                : `Offline (${settings.offline_delay_minutes}m Delay)`}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Operator status: {adminOnline ? 'Online in Back Office' : 'Offline (Watcher Active)'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-medium text-slate-500">Dispatched Alerts Log</div>
          <div className="mt-1.5 font-mono text-lg font-bold text-slate-900 tabular-nums">
            {sentCount} <span className="text-xs font-medium text-slate-500">sent</span>
            {failedCount > 0 && (
              <span className="ml-2 text-xs font-semibold text-[#DC2626]">
                · {failedCount} failed
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            Recent automatic &amp; test dispatches
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <form onSubmit={handleSave} className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Destination & Master Switch */}
        <div className="space-y-5 lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Lark Mail Routing &amp; Admin Link
                </h3>
                <p className="text-[11px] text-slate-500">
                  Choose where alerts arrive and which login link appears inside each email.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={settings.enabled}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, enabled: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-[var(--gs-primary)]"
                />
                <span>{settings.enabled ? 'Enabled' : 'Paused'}</span>
              </label>
            </div>

            {!larkConnected && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950 space-y-2">
                <div className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0" />
                  <span>Lark Mail SMTP Authorization Needed</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900">
                  Connect your Lark Mail email and SMTP Authorization Code under Settings &amp; Integrations so emails deliver directly to your Lark inbox.
                </p>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Connect Lark Mail SMTP</span>
                  </button>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="notif-recipient"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Lark Mail Recipient Email
                </label>
                {larkSenderEmail &&
                  settings.recipient_email.trim().toLowerCase() !== larkSenderEmail &&
                  canEdit && (
                    <button
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({ ...prev, recipient_email: larkSenderEmail }))
                      }
                      className="text-[11px] font-semibold text-[var(--gs-primary)] hover:underline"
                    >
                      Use {larkSenderEmail}
                    </button>
                  )}
              </div>
              <input
                id="notif-recipient"
                type="email"
                disabled={!canEdit}
                value={settings.recipient_email}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, recipient_email: e.target.value }))
                }
                placeholder={larkSenderEmail || resolvedRecipient || 'you@your-lark-domain.com'}
                className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none disabled:bg-slate-50"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Leave blank to auto-send to your connected Lark Mail account (
                <span className="font-mono text-slate-700">
                  {larkSenderEmail || resolvedRecipient || 'fallback email'}
                </span>
                ).
              </p>
            </div>

            <div>
              <label
                htmlFor="notif-login-url"
                className="block text-xs font-semibold text-slate-700"
              >
                Backend Admin Login URL
              </label>
              <input
                id="notif-login-url"
                type="url"
                disabled={!canEdit}
                value={settings.admin_login_url}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, admin_login_url: e.target.value }))
                }
                placeholder="https://git-stack.org/obama"
                className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none disabled:bg-slate-50"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Appended at the bottom of every Lark Mail alert so you can sign in and reply immediately.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Trigger Rules */}
        <div className="space-y-4 lg:col-span-7">
          {/* Trigger 1: Live Website Chat Box */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[var(--gs-primary)] shrink-0">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Floating Home Page Live Chat Alerts
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Notify your Lark Mail when a visitor sends a message in the Home Page chat widget.
                  </p>
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={settings.notify_on_live_chat}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, notify_on_live_chat: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>{settings.notify_on_live_chat ? 'Active' : 'Muted'}</span>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
              <div>
                <label
                  htmlFor="notif-chat-mode"
                  className="block text-[11px] font-semibold text-slate-600"
                >
                  Trigger Timing
                </label>
                <select
                  id="notif-chat-mode"
                  disabled={!canEdit || !settings.notify_on_live_chat}
                  value={settings.live_chat_mode}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      live_chat_mode: e.target.value as LiveChatNotifyMode
                    }))
                  }
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 disabled:bg-slate-50"
                >
                  <option value="instant">Instant on Every New Chat</option>
                  <option value="offline_only">Offline Delay Only</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="notif-cooldown"
                  className="block text-[11px] font-semibold text-slate-600"
                >
                  Per-Chat Cooldown
                </label>
                <select
                  id="notif-cooldown"
                  disabled={
                    !canEdit ||
                    !settings.notify_on_live_chat ||
                    settings.live_chat_mode !== 'instant'
                  }
                  value={settings.chat_cooldown_minutes}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      chat_cooldown_minutes: Number(e.target.value)
                    }))
                  }
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 disabled:bg-slate-50"
                >
                  <option value={0}>Every message (0 min)</option>
                  <option value={1}>1 minute cooldown</option>
                  <option value={2}>2 minutes cooldown</option>
                  <option value={5}>5 minutes cooldown</option>
                  <option value={15}>15 minutes cooldown</option>
                  <option value={60}>60 minutes cooldown</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="notif-offline-delay"
                  className="block text-[11px] font-semibold text-slate-600"
                >
                  Offline Watcher Delay
                </label>
                <select
                  id="notif-offline-delay"
                  disabled={!canEdit || !settings.notify_on_live_chat}
                  value={settings.offline_delay_minutes}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      offline_delay_minutes: Number(e.target.value)
                    }))
                  }
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 disabled:bg-slate-50"
                >
                  <option value={1}>1 minute</option>
                  <option value={2}>2 minutes</option>
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                </select>
              </div>
            </div>
          </div>

          {/* Trigger 2 & 3 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[var(--gs-primary)] shrink-0">
                    <Inbox className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Contact Form Inquiries
                    </h3>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      Send immediate Lark Mail alert with client scope and `/obama` link on every consultation brief.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  aria-label="Notify on Contact Form Inquiries"
                  disabled={!canEdit}
                  checked={settings.notify_on_inquiry}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, notify_on_inquiry: e.target.checked }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[var(--gs-primary)] shrink-0">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Live Demo Signups
                    </h3>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      Alert Lark Mail whenever a visitor registers for a 24-hour Live Demo sandbox evaluation.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  aria-label="Notify on Live Demo Signups"
                  disabled={!canEdit}
                  checked={settings.notify_on_demo_signup}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      notify_on_demo_signup: e.target.checked
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Delivery Proof Log */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-[var(--gs-primary)]" />
              <h3 className="font-display text-sm font-bold text-slate-900">
                Lark Mail Notification Delivery Proof ({logs.length})
              </h3>
            </div>
            {onOpenInbox && (
              <button
                type="button"
                onClick={onOpenInbox}
                className="text-xs font-semibold text-[var(--gs-primary)] hover:underline"
              >
                Open Live Chat Inbox →
              </button>
            )}
          </div>

          {logs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No inquiry or live chat alert dispatches recorded yet. Click{' '}
              <strong>Send Test to Lark Mail</strong> above to verify delivery right now.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 max-h-[420px] overflow-y-auto">
              {logs.map((log) => {
                const active = selectedLog?.id === log.id;
                return (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => setSelectedLog(log)}
                    className={`w-full px-5 py-3.5 text-left transition-colors ${
                      active ? 'bg-[var(--gs-soft-bg)]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900 truncate">
                        {ALERT_CATEGORY_LABEL[log.category] || log.category} → {log.recipient_email}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold shrink-0 ${
                          log.status === 'sent' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                        }`}
                      >
                        {log.status === 'sent' ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        <span>{log.status === 'sent' ? 'Sent' : 'Failed'}</span>
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-800 truncate">{log.subject}</div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="truncate">
                        {log.error_detail ? log.error_detail : `By ${log.sent_by}`}
                      </span>
                      <span className="font-mono tabular-nums shrink-0">
                        {new Date(log.sent_at).toLocaleString()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Payload Inspector */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 flex flex-col justify-between min-h-[280px]">
          {selectedLog ? (
            <div className="space-y-3">
              <div className="border-b border-slate-200 pb-3">
                <div className="font-mono text-[11px] text-slate-500">
                  {ALERT_CATEGORY_LABEL[selectedLog.category] || selectedLog.category} ·{' '}
                  {new Date(selectedLog.sent_at).toLocaleString()}
                </div>
                <h4 className="mt-1 font-display text-sm font-bold text-slate-900">
                  {selectedLog.subject}
                </h4>
                <div className="mt-1 font-mono text-[11px] text-slate-600 break-all">
                  To: {selectedLog.recipient_email}
                </div>
                {selectedLog.provider_message_id && (
                  <div className="mt-0.5 font-mono text-[11px] text-slate-500 break-all">
                    SMTP ID: {selectedLog.provider_message_id}
                  </div>
                )}
              </div>

              {selectedLog.error_detail && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                  {selectedLog.error_detail}
                </div>
              )}

              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-700 max-h-[280px] overflow-y-auto">
                {selectedLog.body}
              </pre>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">
              Select a notification event to inspect the exact Lark Mail alert content.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
