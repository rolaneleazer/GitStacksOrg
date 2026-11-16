import crypto from 'node:crypto';
import type { WebsiteChatMessage, WebsiteChatSession } from '../shared/types.ts';
import { broadcastToAdmins, broadcastToVisitor, isAdminOnline } from './realtime.ts';
import {
  addInboxEmailLog,
  appendWebsiteChatMessage,
  getAgentReportSettings,
  listWebsiteChatMessages,
  listWebsiteChatSessions,
  upsertWebsiteChatSession
} from './repository.ts';
import { resolveIntegrationConfig, sendLarkSmtpMail } from './vault.ts';

const OFFLINE_ESCALATION_DELAY_MS = 2 * 60 * 1000; // 2 minutes
let lastWatcherRunIso: string | null = null;
let watcherTimerStarted = false;

export function getChatWatcherLastRunAt(): string | null {
  return lastWatcherRunIso;
}

export async function resolveAdminNotificationEmail(): Promise<string> {
  const reportSettings = await getAgentReportSettings().catch(() => null);
  if (reportSettings?.recipient_email?.includes('@')) {
    return reportSettings.recipient_email.trim();
  }
  const larkResolved = await resolveIntegrationConfig('lark_smtp').catch(() => null);
  if (larkResolved?.configMeta?.email?.includes('@')) {
    return larkResolved.configMeta.email.trim();
  }
  return (process.env.STUDIO_ADMIN_EMAIL || 'gitstackitsolution@gmail.com').trim();
}

export function isSessionUnanswered(session: WebsiteChatSession): boolean {
  if (session.status === 'resolved') return false;
  if (!session.last_visitor_msg_at) return false;
  const visitorMsgMs = new Date(session.last_visitor_msg_at).getTime();
  const adminReplyMs = session.last_admin_reply_at
    ? new Date(session.last_admin_reply_at).getTime()
    : 0;
  return visitorMsgMs > adminReplyMs;
}

export async function runOfflineChatInquiryCheck(options?: {
  forceManual?: boolean;
  triggeredBy?: string;
}): Promise<{
  checkedCount: number;
  unansweredCount: number;
  escalatedCount: number;
  escalatedSessions: string[];
  adminOnline: boolean;
  ranAt: string;
}> {
  const ranAt = new Date().toISOString();
  lastWatcherRunIso = ranAt;
  const adminOnlineNow = isAdminOnline();
  const sessions = await listWebsiteChatSessions();
  const unanswered = sessions.filter(isSessionUnanswered);

  const nowMs = Date.now();
  const escalatedSessions: string[] = [];

  for (const session of unanswered) {
    if (session.escalated_at) continue;
    const lastMsgMs = session.last_visitor_msg_at
      ? new Date(session.last_visitor_msg_at).getTime()
      : 0;
    const elapsedMs = nowMs - lastMsgMs;

    const shouldEscalate = options?.forceManual
      ? elapsedMs >= 0
      : !adminOnlineNow && elapsedMs >= OFFLINE_ESCALATION_DELAY_MS;

    if (!shouldEscalate) continue;

    const messages = await listWebsiteChatMessages(session.id);
    const adminEmail = await resolveAdminNotificationEmail();
    const transcript = messages
      .slice(-12)
      .map(
        (m) =>
          `[${new Date(m.created_at).toLocaleString('en-US', { timeZone: 'UTC' })} UTC] ${m.sender_name} (${m.sender_role}): ${m.body}`
      )
      .join('\n');

    const subject = `[GitStack Live Chat Alert] Unanswered visitor inquiry from ${session.visitor_name}`;
    const bodyText = [
      'GitStack Inquiry Watcher Alert — Unanswered Home Page Live Chat',
      '',
      `Visitor Name: ${session.visitor_name}`,
      `Visitor Email: ${session.visitor_email || 'Not provided yet'}`,
      `Page URL: ${session.page_path}`,
      `Status: Back Office offline > 2 minutes`,
      '',
      'Recent Chat Transcript:',
      transcript || '(No message content)',
      '',
      'Reply directly from Back Office (/obama -> Lark Mail & Lead Inbox -> Live Website Chat) or reply directly to the visitor email above.'
    ].join('\n');

    let mailStatus: 'sent' | 'failed' = 'sent';
    let providerMessageId = '';
    let errorDetail = '';

    try {
      const sent = await sendLarkSmtpMail({
        toEmail: adminEmail,
        toName: 'GitStack Admin',
        subject,
        bodyText
      });
      providerMessageId = sent.messageId;
    } catch (err) {
      mailStatus = 'failed';
      errorDetail = err instanceof Error ? err.message : 'Lark Mail SMTP not configured';
    }

    await addInboxEmailLog({
      id: `eml-${crypto.randomUUID().slice(0, 10)}`,
      recipient_email: adminEmail,
      subject,
      body: bodyText,
      channel: 'lark_smtp',
      category: 'chat_offline_alert',
      related_id: session.id,
      provider_message_id: providerMessageId,
      status: mailStatus,
      error_detail: errorDetail,
      sent_by: options?.triggeredBy || 'inquiry-watcher-agent',
      sent_at: ranAt
    }).catch(() => null);

    const updatedSession: WebsiteChatSession = {
      ...session,
      escalated_at: ranAt,
      updated_at: ranAt
    };
    await upsertWebsiteChatSession(updatedSession);

    const agentNotice: WebsiteChatMessage = {
      id: `wcm-${crypto.randomUUID().slice(0, 10)}`,
      session_id: session.id,
      sender_role: 'agent',
      sender_name: 'Mira (Inquiry Watcher)',
      body:
        mailStatus === 'sent'
          ? 'Our team is currently away from the live desk, so I forwarded your inquiry to their Lark Mail inbox. Feel free to drop your email address above so they can reply directly.'
          : 'Our team is currently away from the live desk. Your inquiry is queued in the Back Office Inbox—please leave your email address so we can follow up directly.',
      created_at: ranAt
    };
    await appendWebsiteChatMessage(agentNotice);

    broadcastToVisitor(session.visitor_token, 'chat:message', {
      session: updatedSession,
      message: agentNotice
    });
    broadcastToAdmins('chat:session_updated', {
      session: updatedSession,
      message: agentNotice
    });

    escalatedSessions.push(session.id);
  }

  return {
    checkedCount: sessions.length,
    unansweredCount: unanswered.length,
    escalatedCount: escalatedSessions.length,
    escalatedSessions,
    adminOnline: adminOnlineNow,
    ranAt
  };
}

export function startChatWatcherLoop(): void {
  if (watcherTimerStarted) return;
  watcherTimerStarted = true;
  setInterval(() => {
    runOfflineChatInquiryCheck().catch(() => null);
  }, 30_000);
}
