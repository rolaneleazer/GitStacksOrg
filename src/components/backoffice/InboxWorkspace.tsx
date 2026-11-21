import {
  Bell,
  CheckCircle2,
  Download,
  Inbox,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UserPlus,
  X,
  XCircle
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getRealtimeWsUrl, getStoredToken } from '../../lib/api.ts';
import type {
  ArticleComment,
  ClientInquiry,
  CommentStatus,
  DirectoryUser,
  InboxEmailLog,
  InquiryStatus,
  NewsletterSubscriber,
  WebsiteChatMessage,
  WebsiteChatSession,
  WebsiteChatStatus
} from '../../shared/types.ts';

interface InboxWorkspaceProps {
  inquiries: ClientInquiry[];
  comments: ArticleComment[];
  subscribers: NewsletterSubscriber[];
  teamUsers?: DirectoryUser[];
  onAssignInquiry?: (id: string, assignedTo: string | null) => Promise<void>;
  onUpdateInquiryStatus: (id: string, status: InquiryStatus) => Promise<void>;
  onUpdateCommentStatus: (id: string, status: CommentStatus) => Promise<void>;
  onExportSubscribersCsv: () => void;
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
}

type InboxSubTab = 'inquiries' | 'live_chat' | 'lark' | 'community';

const CATEGORY_LABELS: Record<InboxEmailLog['category'], string> = {
  inquiry_reply: 'Inquiry Reply',
  direct_compose: 'Direct Dispatch',
  contact_alert: 'Contact Form Alert',
  demo_signup_alert: 'Demo Signup Alert',
  chat_offline_alert: 'Offline Chat Alert',
  chat_instant_alert: 'Instant Live Chat Alert',
  chat_reply: 'Live Chat Lark Reply',
  test_notification: 'Test Notification',
  qa_eod_report: 'QA End-of-Day PDF Report',
  qa_critical_alert: 'QA Critical Error Alert',
  ai_seo_daily_report: 'AI & SEO Daily Visibility Report',
  cybersec_daily_report: 'Cybersecurity Daily PDF Report',
  cybersec_alert: 'Cybersecurity Threat Alert',
  demo_guard_alert: 'Demo Guard Isolation Alert'
};

export function InboxWorkspace({
  inquiries,
  comments,
  subscribers,
  teamUsers = [],
  onAssignInquiry,
  onUpdateInquiryStatus,
  onUpdateCommentStatus,
  onExportSubscribersCsv,
  onOpenSettings,
  onOpenNotifications
}: InboxWorkspaceProps) {
  const [subTab, setSubTab] = useState<InboxSubTab>('inquiries');

  // Lark Mail SMTP SSL state
  const [larkInfo, setLarkInfo] = useState<{
    connected: boolean;
    email: string;
    senderName: string;
    smtpHost: string;
    smtpPort: number;
  }>({
    connected: false,
    email: '',
    senderName: 'GitStack Solutions',
    smtpHost: 'smtp.larksuite.com',
    smtpPort: 465
  });
  const [emailLogs, setEmailLogs] = useState<InboxEmailLog[]>([]);
  const [loadingLark, setLoadingLark] = useState(false);
  const [larkError, setLarkError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<InboxEmailLog | null>(null);

  // Compose / Reply state + Confirmation Modal
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeToName, setComposeToName] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeCategory, setComposeCategory] = useState<'inquiry_reply' | 'direct_compose'>(
    'direct_compose'
  );
  const [composeRelatedId, setComposeRelatedId] = useState<string | undefined>(undefined);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  // Live Website Chat state
  const [chatSessions, setChatSessions] = useState<WebsiteChatSession[]>([]);
  const [unansweredChatCount, setUnansweredChatCount] = useState(0);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<WebsiteChatMessage[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [chatReplyText, setChatReplyText] = useState('');
  const [alsoSendLarkEmail, setAlsoSendLarkEmail] = useState(true);
  const [sendingChatReply, setSendingChatReply] = useState(false);
  const [chatNotice, setChatNotice] = useState<string | null>(null);
  const [checkingWatcher, setCheckingWatcher] = useState(false);

  const loadLarkLogs = useCallback(async () => {
    setLoadingLark(true);
    setLarkError(null);
    try {
      const res = await api.getInboxLarkEmails();
      setLarkInfo(res.lark);
      setEmailLogs(res.logs);
      setSelectedLog((prev) => {
        if (prev) {
          return res.logs.find((l) => l.id === prev.id) || res.logs[0] || null;
        }
        return res.logs[0] || null;
      });
    } catch (err) {
      setLarkError(err instanceof Error ? err.message : 'Unable to load Lark Mail dispatch log.');
    } finally {
      setLoadingLark(false);
    }
  }, []);

  const loadChatSessions = useCallback(async (silent = false) => {
    if (!silent) setLoadingChats(true);
    try {
      const res = await api.listAdminChatSessions();
      setChatSessions(res.sessions);
      setUnansweredChatCount(res.unansweredCount);
      setSelectedChatId((prev) => prev || res.sessions[0]?.id || null);
    } catch {
      // keep existing state on transient error
    } finally {
      if (!silent) setLoadingChats(false);
    }
  }, []);

  const loadSelectedChatThread = useCallback(async (sessionId: string) => {
    try {
      const res = await api.getAdminChatThread(sessionId);
      setChatMessages(res.messages);
    } catch {
      // ignore transient error
    }
  }, []);

  useEffect(() => {
    loadLarkLogs();
    loadChatSessions();
  }, [loadLarkLogs, loadChatSessions]);

  useEffect(() => {
    if (selectedChatId) {
      loadSelectedChatThread(selectedChatId);
    } else {
      setChatMessages([]);
    }
  }, [selectedChatId, loadSelectedChatThread]);

  // Real-time WS + 3m visibility-aware fallback poll for Live Website Chat
  useEffect(() => {
    const pollId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadChatSessions(true);
      if (subTab === 'live_chat' && selectedChatId) {
        loadSelectedChatThread(selectedChatId);
      }
    }, 180_000);

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
              payload?: { session?: WebsiteChatSession; message?: WebsiteChatMessage };
            };
            if (
              msg.type === 'chat:message' ||
              msg.type === 'chat:session_updated' ||
              msg.type === 'chat:escalated'
            ) {
              loadChatSessions(true);
              if (
                msg.payload?.message &&
                msg.payload.session?.id === selectedChatId
              ) {
                const incoming = msg.payload.message;
                setChatMessages((prev) =>
                  prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
                );
              }
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
      window.clearInterval(pollId);
      if (ws && ws.readyState < 2) ws.close();
    };
  }, [loadChatSessions, loadSelectedChatThread, selectedChatId, subTab]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return emailLogs;
    return emailLogs.filter(
      (l) =>
        l.recipient_email.toLowerCase().includes(q) ||
        l.subject.toLowerCase().includes(q) ||
        l.body.toLowerCase().includes(q) ||
        CATEGORY_LABELS[l.category].toLowerCase().includes(q)
    );
  }, [emailLogs, searchQuery]);

  const openComposeForInquiry = (inq: ClientInquiry) => {
    setSubTab('lark');
    setComposeOpen(true);
    setComposeTo(inq.work_email);
    setComposeToName(inq.full_name);
    setComposeCategory('inquiry_reply');
    setComposeRelatedId(inq.id);
    setComposeSubject(`Re: GitStack Architecture Consultation (${inq.reference_code})`);
    setComposeBody(
      `Hi ${inq.full_name},\n\nThank you for contacting GitStack regarding ${inq.service_interest} for ${inq.company}.\n\nWe reviewed your brief (${inq.reference_code}) and would like to schedule a technical discovery call with our principal engineering lead.\n\nBest regards,\nGitStack Engineering Team`
    );
    setSendSuccess(null);
    setLarkError(null);
  };

  const handleRequestSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) return;
    setConfirmSendOpen(true);
  };

  const handleConfirmedSend = async () => {
    setSendingEmail(true);
    setLarkError(null);
    try {
      const res = await api.sendInboxLarkEmail({
        toEmail: composeTo.trim(),
        toName: composeToName.trim() || undefined,
        subject: composeSubject.trim(),
        bodyText: composeBody.trim(),
        category: composeCategory,
        relatedId: composeRelatedId
      });
      setConfirmSendOpen(false);
      setComposeOpen(false);
      setSendSuccess(
        `Email sent to ${res.log.recipient_email} via Lark Mail SMTP (ID: ${res.log.provider_message_id}).`
      );
      await loadLarkLogs();
      setSelectedLog(res.log);
    } catch (err) {
      setConfirmSendOpen(false);
      setLarkError(err instanceof Error ? err.message : 'Failed to send email via Lark Mail SMTP.');
      await loadLarkLogs();
    } finally {
      setSendingEmail(false);
    }
  };

  const activeChatSession = useMemo(
    () => chatSessions.find((s) => s.id === selectedChatId) || null,
    [chatSessions, selectedChatId]
  );

  const handleSendChatReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChatSession || !chatReplyText.trim() || sendingChatReply) return;
    setSendingChatReply(true);
    setChatNotice(null);
    try {
      const canEmail = Boolean(activeChatSession.visitor_email?.includes('@'));
      const res = await api.replyAdminChatSession(
        activeChatSession.id,
        chatReplyText.trim(),
        alsoSendLarkEmail && canEmail
      );
      setChatMessages((prev) =>
        prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]
      );
      setChatSessions((prev) =>
        prev.map((s) => (s.id === res.session.id ? { ...res.session, unread_for_admin: false } : s))
      );
      setChatReplyText('');
      if (res.emailNotice) {
        setChatNotice(res.emailNotice);
        loadLarkLogs();
      } else {
        setChatNotice('Reply delivered live to visitor.');
      }
      loadChatSessions(true);
    } catch (err) {
      setChatNotice(err instanceof Error ? err.message : 'Failed to send chat reply.');
    } finally {
      setSendingChatReply(false);
    }
  };

  const handleChatStatusChange = async (status: WebsiteChatStatus) => {
    if (!activeChatSession) return;
    try {
      const res = await api.updateAdminChatStatus(activeChatSession.id, status);
      setChatSessions((prev) =>
        prev.map((s) => (s.id === res.session.id ? { ...s, ...res.session } : s))
      );
      loadChatSessions(true);
    } catch (err) {
      setChatNotice(err instanceof Error ? err.message : 'Unable to update chat status.');
    }
  };

  const handleConvertChatToLead = async () => {
    if (!activeChatSession) return;
    try {
      const res = await api.convertAdminChatToLead(activeChatSession.id);
      setChatSessions((prev) =>
        prev.map((s) => (s.id === res.session.id ? { ...s, ...res.session } : s))
      );
      setChatNotice(`Saved "${res.lead.contact_name}" to CRM & Prospecting (${res.lead.id}).`);
    } catch (err) {
      setChatNotice(err instanceof Error ? err.message : 'Failed to convert chat to CRM lead.');
    }
  };

  const handleManualWatcherScan = async () => {
    setCheckingWatcher(true);
    setChatNotice(null);
    try {
      const res = await api.checkUnansweredChatInquiries();
      if (res.escalatedCount > 0) {
        setChatNotice(
          `Escalated ${res.escalatedCount} unanswered inquiry(ies) to Lark Mail.`
        );
        loadLarkLogs();
      } else if (res.skippedReason) {
        setChatNotice(res.skippedReason);
      } else {
        setChatNotice(`Scanned ${res.checkedCount} thread(s); no pending alerts needed.`);
      }
      await loadChatSessions(true);
      if (selectedChatId) await loadSelectedChatThread(selectedChatId);
    } catch (err) {
      setChatNotice(err instanceof Error ? err.message : 'Inquiry scan failed.');
    } finally {
      setCheckingWatcher(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Unified Communications &amp; Lead Inbox
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Reply live to Home Page chat visitors, triage consultation briefs, and manage automatic Lark Mail SMTP alerts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-full sm:w-fit">
          <button
            type="button"
            onClick={() => setSubTab('inquiries')}
            className={`min-h-[38px] flex-1 sm:flex-none rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
              subTab === 'inquiries' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Client Inquiries ({inquiries.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('live_chat')}
            className={`min-h-[38px] flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
              subTab === 'live_chat' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Live Website Chat ({chatSessions.length})</span>
            {unansweredChatCount > 0 && (
              <span className="font-mono text-[10px] font-bold text-[#DC2626]">
                · {unansweredChatCount} new
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('lark')}
            className={`min-h-[38px] flex-1 sm:flex-none rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
              subTab === 'lark' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Lark Mail Dispatch ({emailLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('community')}
            className={`min-h-[38px] flex-1 sm:flex-none rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
              subTab === 'community' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Comments &amp; Newsletter
          </button>
        </div>
      </div>

      {/* TAB 1: CLIENT INQUIRIES */}
      {subTab === 'inquiries' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-[var(--gs-primary)]" />
              <h3 className="font-display text-sm font-bold text-slate-900">
                Client Project Inquiries ({inquiries.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Lark Mail alerts active for every new Contact submission
            </span>
          </div>
          <div className="divide-y divide-slate-200">
            {inquiries.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">No inquiries recorded yet.</p>
            ) : (
              inquiries.map((inq) => (
                <div key={inq.id} className="py-4 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-900">
                        {inq.full_name} · {inq.company}
                      </div>
                      <div className="text-xs text-slate-500 font-mono tabular-nums break-words">
                        {inq.reference_code} · {inq.work_email} · {inq.service_interest} ·{' '}
                        {inq.budget_range} · {inq.timeline}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {teamUsers.length > 0 && onAssignInquiry && (
                        <select
                          aria-label={`Assign inquiry ${inq.reference_code}`}
                          value={inq.assigned_to || ''}
                          onChange={(e) =>
                            onAssignInquiry(inq.id, e.target.value ? e.target.value : null)
                          }
                          className="min-h-[38px] rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                        >
                          <option value="">Unassigned</option>
                          {teamUsers.map((u) => (
                            <option key={u.user_id} value={u.user_id}>
                              Owner: {u.full_name}
                            </option>
                          ))}
                        </select>
                      )}
                      <select
                        value={inq.status}
                        onChange={(e) =>
                          onUpdateInquiryStatus(inq.id, e.target.value as InquiryStatus)
                        }
                        className="min-h-[38px] rounded border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        <option value="new">New</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="scheduled">Scheduled</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => openComposeForInquiry(inq)}
                        className="min-h-[38px] inline-flex items-center gap-1 rounded border border-[var(--gs-primary)] px-2.5 py-1.5 text-xs font-semibold text-[var(--gs-primary)] hover:bg-[var(--gs-soft-bg)] whitespace-nowrap shrink-0"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        <span>Reply via Lark Mail</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600">{inq.project_brief}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 1B: LIVE WEBSITE FLOATING CHAT INBOX */}
      {subTab === 'live_chat' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 sm:px-5 py-3.5">
            <div className="space-y-0.5 min-w-0">
              <div className="text-xs font-bold text-slate-900">
                Floating Home Page Chat &amp; 2-Minute Offline Lark Watcher
              </div>
              <div className="text-[11px] text-slate-500">
                Reply live here while logged in. If Back Office goes offline for over 2 minutes, Mira (Inquiry Watcher) emails the unanswered transcript to Lark Mail.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => loadChatSessions(false)}
                className="min-h-[38px] inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingChats ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                disabled={checkingWatcher}
                onClick={handleManualWatcherScan}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 whitespace-nowrap"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>{checkingWatcher ? 'Scanning...' : 'Check Unanswered Inquiries Now'}</span>
              </button>
              {onOpenNotifications && (
                <button
                  type="button"
                  onClick={onOpenNotifications}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Bell className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
                  <span>Notification Rules</span>
                </button>
              )}
            </div>
          </div>

          {chatNotice && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900">
              {chatNotice}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Visitor Session List */}
            <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 lg:col-span-5 max-h-[540px] overflow-y-auto">
              {chatSessions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No floating Home Page chat conversations yet. Open the Home Page and send a test inquiry in the bottom-right Live Chat box.
                </div>
              ) : (
                chatSessions.map((sess) => {
                  const active = selectedChatId === sess.id;
                  return (
                    <button
                      key={sess.id}
                      type="button"
                      onClick={() => setSelectedChatId(sess.id)}
                      className={`w-full p-4 text-left transition-colors ${
                        active ? 'bg-[var(--gs-soft-bg)]' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-900 truncate">
                          {sess.visitor_name || 'Website Visitor'}
                        </span>
                        <span
                          className={`font-mono text-[10.5px] font-bold uppercase shrink-0 ${
                            sess.unread_for_admin
                              ? 'text-[#DC2626]'
                              : sess.status === 'resolved'
                                ? 'text-[#16A34A]'
                                : 'text-[#2563EB]'
                          }`}
                        >
                          {sess.unread_for_admin ? 'Unanswered' : sess.status}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] font-mono text-slate-500 truncate">
                        {sess.visitor_email || 'No email provided'} · {sess.page_path}
                      </div>
                      {sess.last_message_preview && (
                        <div className="mt-1 text-xs text-slate-700 line-clamp-2">
                          {sess.last_message_preview}
                        </div>
                      )}
                      {sess.escalated_at && (
                        <div className="mt-1 font-mono text-[10px] text-amber-700">
                          Escalated to Lark Mail · {new Date(sess.escalated_at).toLocaleTimeString()}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Thread Conversation & Reply Composer */}
            <div className="rounded-xl border border-slate-200 bg-white flex flex-col justify-between lg:col-span-7 min-h-[460px] max-h-[540px]">
              {activeChatSession ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
                    <div className="min-w-0">
                      <h3 className="font-display text-sm font-bold text-slate-900 truncate">
                        {activeChatSession.visitor_name}
                      </h3>
                      <div className="font-mono text-[11px] text-slate-500 truncate">
                        {activeChatSession.visitor_email || 'Anonymous Visitor'} · Path:{' '}
                        {activeChatSession.page_path}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label="Website chat status"
                        value={activeChatSession.status}
                        onChange={(e) =>
                          handleChatStatusChange(e.target.value as WebsiteChatStatus)
                        }
                        className="min-h-[36px] rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700"
                      >
                        <option value="open">Open</option>
                        <option value="replied">Replied</option>
                        <option value="resolved">Resolved</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleConvertChatToLead}
                        className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>
                          {activeChatSession.converted_lead_id ? 'Update CRM Lead' : 'Convert to CRM Lead'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/70">
                    {chatMessages.map((msg) => {
                      const isAdmin = msg.sender_role === 'admin';
                      const isAgent = msg.sender_role === 'agent';
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                              isAdmin
                                ? 'bg-[var(--gs-primary)] text-white'
                                : isAgent
                                  ? 'border border-amber-200 bg-amber-50 text-amber-900'
                                  : 'border border-slate-200 bg-white text-slate-800'
                            }`}
                          >
                            <div className="mb-0.5 text-[10px] font-bold opacity-80">
                              {msg.sender_name}
                            </div>
                            <div className="whitespace-pre-wrap break-words">{msg.body}</div>
                          </div>
                          <span className="mt-0.5 font-mono text-[10px] text-slate-400 tabular-nums">
                            {new Date(msg.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <form
                    onSubmit={handleSendChatReply}
                    className="border-t border-slate-200 bg-white p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={
                            alsoSendLarkEmail &&
                            Boolean(activeChatSession.visitor_email?.includes('@'))
                          }
                          disabled={!activeChatSession.visitor_email?.includes('@')}
                          onChange={(e) => setAlsoSendLarkEmail(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-slate-300"
                        />
                        <span>
                          {activeChatSession.visitor_email?.includes('@')
                            ? `Also email reply to ${activeChatSession.visitor_email} via Lark Mail`
                            : 'Visitor has not provided an email address'}
                        </span>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={chatReplyText}
                        onChange={(e) => setChatReplyText(e.target.value)}
                        placeholder="Type live reply to visitor..."
                        className="min-h-[40px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={sendingChatReply || !chatReplyText.trim()}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50 whitespace-nowrap"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>{sendingChatReply ? 'Sending...' : 'Reply Live'}</span>
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex h-full items-center justify-center p-8 text-xs text-slate-500">
                  Select a Home Page visitor conversation on the left to inspect and reply live.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LARK MAIL SMTP DISPATCH & AUDIT LOG */}
      {subTab === 'lark' && (
        <div className="space-y-4">
          {/* Lark SMTP Status Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 sm:px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-2 text-xs min-w-0">
              {larkInfo.connected ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-[#16A34A] shrink-0" />
                  <span className="font-semibold text-slate-900">Lark Mail SMTP Connected</span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="font-mono text-slate-700 truncate">{larkInfo.email}</span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="font-mono text-slate-500">
                    {larkInfo.smtpHost}:{larkInfo.smtpPort}
                  </span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="font-semibold text-amber-800">
                    Lark Mail SMTP not connected — configure Authorization Code in Settings
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter sent mail..."
                  className="min-h-[40px] w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={loadLarkLogs}
                className="min-h-[40px] inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingLark ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setComposeOpen(true);
                  setComposeTo('');
                  setComposeToName('');
                  setComposeSubject('');
                  setComposeBody('');
                  setComposeCategory('direct_compose');
                  setComposeRelatedId(undefined);
                }}
                className="min-h-[40px] inline-flex items-center gap-1 rounded-lg bg-[var(--gs-primary)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Compose Lark Email</span>
              </button>
              {!larkInfo.connected && onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="min-h-[40px] rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                >
                  Connect Lark SMTP
                </button>
              )}
            </div>
          </div>

          {larkError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800">
              {larkError}
            </div>
          )}
          {sendSuccess && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800">
              {sendSuccess}
            </div>
          )}

          {/* Compose Drawer */}
          {composeOpen && (
            <form
              onSubmit={handleRequestSend}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Compose Outbound Lark Mail
                </h3>
                <button
                  type="button"
                  onClick={() => setComposeOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="email"
                  required
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="Recipient email (client@company.com)"
                  className="min-h-[40px] rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                />
                <input
                  type="text"
                  required
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Subject"
                  className="min-h-[40px] rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <textarea
                rows={5}
                required
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Write your reply..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs leading-relaxed text-slate-900"
              />
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setComposeOpen(false)}
                  className="min-h-[42px] rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Review &amp; Send via Lark Mail</span>
                </button>
              </div>
            </form>
          )}

          {/* Master-Detail Dispatch Log */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 lg:col-span-5 max-h-[520px] overflow-y-auto">
              {loadingLark && filteredLogs.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Loading Lark Mail dispatch history...
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No outbound Lark Mail dispatches or alerts recorded yet.
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const active = selectedLog?.id === log.id;
                  return (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => setSelectedLog(log)}
                      className={`w-full p-4 text-left transition-colors ${
                        active ? 'bg-[var(--gs-soft-bg)]' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-900 truncate">
                          {log.recipient_email}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold shrink-0 ${
                            log.status === 'sent' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {log.status === 'sent' ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          <span>{log.status === 'sent' ? 'Sent' : 'Failed'}</span>
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-800 truncate">
                        {log.subject}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{CATEGORY_LABELS[log.category]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {new Date(log.sent_at).toLocaleString()}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-7 min-h-[360px]">
              {selectedLog ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-slate-500">
                        {CATEGORY_LABELS[selectedLog.category]} · Lark Mail SMTP SSL
                      </div>
                      <h3 className="mt-1 font-display text-base font-bold text-slate-900">
                        {selectedLog.subject}
                      </h3>
                      <div className="mt-1 text-xs text-slate-500 break-all font-mono tabular-nums">
                        To: {selectedLog.recipient_email} · Sent by {selectedLog.sent_by} ·{' '}
                        {new Date(selectedLog.sent_at).toLocaleString()}
                      </div>
                      {selectedLog.provider_message_id && (
                        <div className="mt-1 text-[11px] font-mono text-slate-500">
                          SMTP Message ID: {selectedLog.provider_message_id}
                        </div>
                      )}
                    </div>
                  </div>
                  {selectedLog.error_detail && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      {selectedLog.error_detail}
                    </div>
                  )}
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-700 max-h-[380px] overflow-y-auto">
                    {selectedLog.body}
                  </pre>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-500">
                  Select a Lark Mail log entry on the left or compose a new email.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: READER COMMENTS & NEWSLETTER */}
      {subTab === 'community' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-7">
            <h3 className="font-display text-sm font-bold text-slate-900 border-b border-slate-200 pb-3">
              Reader Comments Moderation ({comments.length})
            </h3>
            <div className="divide-y divide-slate-200">
              {comments.map((c) => (
                <div key={c.id} className="py-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-900">
                      {c.author_name} ({c.author_email})
                    </span>
                    <select
                      value={c.status}
                      onChange={(e) =>
                        onUpdateCommentStatus(c.id, e.target.value as CommentStatus)
                      }
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                    >
                      <option value="approved">Approved</option>
                      <option value="pending">Pending</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600">{c.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display text-sm font-bold text-slate-900">
                Newsletter Subscribers ({subscribers.length})
              </h3>
              <button
                type="button"
                onClick={onExportSubscribersCsv}
                className="min-h-[36px] inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3 w-3" />
                <span>CSV</span>
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {subscribers.map((s) => (
                <div key={s.id} className="py-3 text-xs">
                  <div className="font-medium text-slate-900">{s.email}</div>
                  <div className="text-slate-500">
                    {s.name || 'Subscriber'} · {s.interest_topic}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG BEFORE SENDING LARK MAIL */}
      {confirmSendOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Send Lark Email"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900">
              Confirm Sending Email via Lark Mail SMTP SSL
            </h3>
            <p className="text-xs text-slate-600">
              Sending from{' '}
              <span className="font-mono font-semibold text-slate-900">
                {larkInfo.email || 'Configured Lark Mail Vault'}
              </span>{' '}
              ({larkInfo.smtpHost}:{larkInfo.smtpPort}):
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
              <div>
                <span className="font-semibold text-slate-700">To:</span> {composeTo}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Subject:</span> {composeSubject}
              </div>
              <p className="mt-2 border-t border-slate-200 pt-2 text-slate-600 line-clamp-4 whitespace-pre-line">
                {composeBody}
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSendOpen(false)}
                className="min-h-[42px] rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingEmail}
                onClick={handleConfirmedSend}
                className="min-h-[42px] rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
              >
                {sendingEmail ? 'Sending via Lark...' : 'Confirm & Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
