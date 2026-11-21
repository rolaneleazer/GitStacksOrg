import crypto from 'node:crypto';
import type {
  AdminNotificationSettings,
  InboxEmailLog,
  WebsiteChatMessage,
  WebsiteChatSession
} from '../shared/types.ts';
import {
  addInboxEmailLog,
  getAdminNotificationSettings,
  getAgentReportSettings
} from './repository.ts';
import { resolveIntegrationConfig, sendLarkSmtpMail } from './vault.ts';

// Track per-chat-session last instant notification timestamp to prevent rapid multi-message email floods
const lastChatAlertSentMs = new Map<string, number>();

function isValidEmailAddress(value: string | undefined | null): boolean {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()));
}

export async function resolveLarkAlertTarget(settingsOverride?: AdminNotificationSettings): Promise<{
  recipientEmail: string;
  larkConnected: boolean;
  larkSenderEmail: string;
  settings: AdminNotificationSettings;
}> {
  const [settings, larkResolved, reportCfg] = await Promise.all([
    settingsOverride ? Promise.resolve(settingsOverride) : getAdminNotificationSettings(),
    resolveIntegrationConfig('lark_smtp').catch(() => null),
    getAgentReportSettings().catch(() => null)
  ]);

  const larkConnected = Boolean(larkResolved?.secret && larkResolved?.configMeta?.email);
  const larkSenderEmail = (larkResolved?.configMeta?.email || '').trim().toLowerCase();

  // Priority: 1. Explicit Notification Module Recipient -> 2. Connected Lark Mail Address -> 3. Daily Report Email -> 4. Env Fallback
  let recipientEmail = '';
  if (isValidEmailAddress(settings.recipient_email)) {
    recipientEmail = settings.recipient_email.trim().toLowerCase();
  } else if (isValidEmailAddress(larkSenderEmail)) {
    recipientEmail = larkSenderEmail;
  } else if (isValidEmailAddress(reportCfg?.recipient_email)) {
    recipientEmail = reportCfg!.recipient_email.trim().toLowerCase();
  } else {
    recipientEmail = (process.env.STUDIO_ADMIN_EMAIL || 'gitstackitsolution@gmail.com')
      .trim()
      .toLowerCase();
  }

  return {
    recipientEmail,
    larkConnected,
    larkSenderEmail,
    settings
  };
}

export function buildBackendLoginLink(settings: AdminNotificationSettings, originUrl?: string): string {
  const configured = (settings.admin_login_url || '').trim();
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured;
  }
  if (originUrl && /^https?:\/\//i.test(originUrl)) {
    return `${originUrl.replace(/\/$/, '')}/obama`;
  }
  return 'https://git-stack.org/obama';
}

export async function dispatchAdminLarkAlert(params: {
  category:
    | 'contact_alert'
    | 'demo_signup_alert'
    | 'chat_offline_alert'
    | 'chat_instant_alert'
    | 'test_notification';
  relatedId?: string | null;
  subject: string;
  bodyText: string;
  sentBy?: string;
  overrideRecipientEmail?: string;
  overrideLoginUrl?: string;
  bypassEnabledCheck?: boolean;
  userToken?: string;
}): Promise<{ log: InboxEmailLog; delivered: boolean }> {
  const nowIso = new Date().toISOString();
  const resolved = await resolveLarkAlertTarget();
  const settings = resolved.settings;

  const recipientEmail = isValidEmailAddress(params.overrideRecipientEmail)
    ? params.overrideRecipientEmail!.trim().toLowerCase()
    : resolved.recipientEmail;

  const loginLink = buildBackendLoginLink(
    params.overrideLoginUrl
      ? { ...settings, admin_login_url: params.overrideLoginUrl }
      : settings
  );

  const fullBody = [
    params.bodyText.trim(),
    '',
    '------------------------------------------------------------',
    `Login to GitStack Backend Admin to reply:`,
    loginLink
  ].join('\n');

  if (!params.bypassEnabledCheck && !settings.enabled) {
    const skippedLog: InboxEmailLog = {
      id: `eml-${crypto.randomUUID().slice(0, 10)}`,
      recipient_email: recipientEmail,
      subject: params.subject,
      body: fullBody,
      channel: 'lark_smtp',
      category: params.category,
      related_id: params.relatedId || null,
      provider_message_id: '',
      status: 'failed',
      error_detail: 'Skipped: Master Email Notifications are paused in Notifications & Alerts.',
      sent_by: params.sentBy || 'notification-module',
      sent_at: nowIso
    };
    return { log: skippedLog, delivered: false };
  }

  let status: 'sent' | 'failed' = 'sent';
  let providerMessageId = '';
  let errorDetail = '';

  try {
    const sent = await sendLarkSmtpMail(
      {
        toEmail: recipientEmail,
        toName: 'GitStack Admin',
        subject: params.subject,
        bodyText: fullBody
      },
      params.userToken
    );
    providerMessageId = sent.messageId;
  } catch (err) {
    status = 'failed';
    errorDetail = err instanceof Error ? err.message : 'Lark Mail SMTP dispatch failed';
  }

  const logEntry = await addInboxEmailLog(
    {
      id: `eml-${crypto.randomUUID().slice(0, 10)}`,
      recipient_email: recipientEmail,
      subject: params.subject,
      body: fullBody,
      channel: 'lark_smtp',
      category: params.category,
      related_id: params.relatedId || null,
      provider_message_id: providerMessageId,
      status,
      error_detail: errorDetail,
      sent_by: params.sentBy || 'notification-module',
      sent_at: nowIso
    },
    params.userToken
  ).catch((e) => ({
    id: `eml-${crypto.randomUUID().slice(0, 10)}`,
    recipient_email: recipientEmail,
    subject: params.subject,
    body: fullBody,
    channel: 'lark_smtp' as const,
    category: params.category,
    related_id: params.relatedId || null,
    provider_message_id: providerMessageId,
    status: 'failed' as const,
    error_detail: errorDetail || (e instanceof Error ? e.message : 'Log write failed'),
    sent_by: params.sentBy || 'notification-module',
    sent_at: nowIso
  }));

  return { log: logEntry, delivered: status === 'sent' };
}

export async function dispatchLiveChatLarkNotification(params: {
  session: WebsiteChatSession;
  message: WebsiteChatMessage;
  originUrl?: string;
}): Promise<{ dispatched: boolean; reason?: string; log?: InboxEmailLog }> {
  const settings = await getAdminNotificationSettings();
  if (!settings.enabled || !settings.notify_on_live_chat) {
    return { dispatched: false, reason: 'Live chat notifications are disabled.' };
  }
  if (settings.live_chat_mode !== 'instant') {
    return { dispatched: false, reason: 'Configured for offline-only escalation.' };
  }

  const cooldownMs = Math.max(0, settings.chat_cooldown_minutes) * 60 * 1000;
  const lastSent = lastChatAlertSentMs.get(params.session.id) || 0;
  if (cooldownMs > 0 && Date.now() - lastSent < cooldownMs) {
    return { dispatched: false, reason: 'Within per-session cooldown window.' };
  }

  lastChatAlertSentMs.set(params.session.id, Date.now());
  const loginUrl = buildBackendLoginLink(settings, params.originUrl);

  const res = await dispatchAdminLarkAlert({
    category: 'chat_instant_alert',
    relatedId: params.session.id,
    subject: `[GitStack Live Chat] New inquiry from ${params.session.visitor_name} (${params.session.page_path})`,
    bodyText: [
      'A website visitor just sent a Live Chat inquiry on GitStack:',
      '',
      `Visitor Name: ${params.session.visitor_name}`,
      `Contact Number: ${params.session.visitor_phone || 'Not provided'}`,
      `Visitor Email: ${params.session.visitor_email || 'Not provided yet'}`,
      `Active Page: ${params.session.page_path}`,
      `Received At: ${new Date(params.message.created_at).toLocaleString('en-US', { timeZone: 'UTC' })} UTC`,
      '',
      'Message:',
      params.message.body
    ].join('\n'),
    sentBy: 'live-chat-notifier',
    overrideLoginUrl: loginUrl
  });

  return {
    dispatched: res.delivered,
    log: res.log,
    reason: res.delivered ? undefined : res.log.error_detail
  };
}

export function clearChatAlertCooldown(sessionId: string): void {
  lastChatAlertSentMs.delete(sessionId);
}
