import {
  CheckCircle2,
  Download,
  Inbox,
  Mail,
  RefreshCw,
  Search,
  Send,
  X
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import {
  connectGmailWithGoogle,
  disconnectGmail,
  getCachedGmailToken,
  initGmailAuth,
  listGmailMessages,
  sendGmailMessage,
  type GmailHeaderSummary
} from '../../lib/gmail.ts';
import type {
  ArticleComment,
  ClientInquiry,
  CommentStatus,
  DirectoryUser,
  InquiryStatus,
  NewsletterSubscriber
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
}

type InboxSubTab = 'gmail' | 'inquiries' | 'community';

export function InboxWorkspace({
  inquiries,
  comments,
  subscribers,
  teamUsers = [],
  onAssignInquiry,
  onUpdateInquiryStatus,
  onUpdateCommentStatus,
  onExportSubscribersCsv
}: InboxWorkspaceProps) {
  const [subTab, setSubTab] = useState<InboxSubTab>('gmail');

  // Gmail OAuth state (in-memory token only)
  const [gmailUserEmail, setGmailUserEmail] = useState<string | null>(null);
  const [gmailToken, setGmailToken] = useState<string | null>(() => getCachedGmailToken());
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [gmailMessages, setGmailMessages] = useState<GmailHeaderSummary[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<GmailHeaderSummary | null>(null);

  // Compose / Reply state + Mandatory Send Confirmation Modal
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeThreadId, setComposeThreadId] = useState<string | undefined>(undefined);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const loadInbox = useCallback(async (token: string, q = '') => {
    setLoadingMessages(true);
    setGmailError(null);
    try {
      const items = await listGmailMessages(token, q, 15);
      setGmailMessages(items);
      if (items.length > 0 && !selectedEmail) {
        setSelectedEmail(items[0]);
      }
    } catch (err) {
      setGmailError(err instanceof Error ? err.message : 'Unable to read Gmail messages.');
      if ((err instanceof Error ? err.message : '').toLowerCase().includes('expired')) {
        setGmailToken(null);
      }
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedEmail]);

  useEffect(() => {
    const unsub = initGmailAuth(
      (user, token) => {
        setGmailUserEmail(user.email || null);
        setGmailToken(token);
      },
      () => {
        setGmailToken(null);
        setGmailUserEmail(null);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (gmailToken) {
      loadInbox(gmailToken, '');
    }
  }, [gmailToken, loadInbox]);

  const handleConnectGoogle = async () => {
    setConnectingGmail(true);
    setGmailError(null);
    try {
      const res = await connectGmailWithGoogle();
      setGmailUserEmail(res.user.email || 'Connected Gmail Account');
      setGmailToken(res.accessToken);
    } catch (err) {
      setGmailError(err instanceof Error ? err.message : 'Google sign-in was cancelled or failed.');
    } finally {
      setConnectingGmail(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    await disconnectGmail();
    setGmailToken(null);
    setGmailUserEmail(null);
    setGmailMessages([]);
    setSelectedEmail(null);
  };

  const openComposeForInquiry = (inq: ClientInquiry) => {
    setSubTab('gmail');
    setComposeOpen(true);
    setComposeTo(inq.work_email);
    setComposeSubject(`Re: GitStack Architecture Consultation (${inq.reference_code})`);
    setComposeBody(
      `Hi ${inq.full_name},\n\nThank you for contacting GitStack regarding ${inq.service_interest} for ${inq.company}.\n\nWe reviewed your brief (${inq.reference_code}) and would like to schedule a technical discovery call with our principal engineering lead.\n\nBest regards,\nGitStack Engineering Team`
    );
    setComposeThreadId(undefined);
    setSendSuccess(null);
  };

  const openReplyToGmail = (msg: GmailHeaderSummary) => {
    const match = msg.from.match(/<([^>]+)>/);
    const replyAddr = match ? match[1] : msg.from;
    setComposeOpen(true);
    setComposeTo(replyAddr);
    setComposeSubject(msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`);
    setComposeBody('');
    setComposeThreadId(msg.threadId);
    setSendSuccess(null);
  };

  const handleRequestSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) return;
    setConfirmSendOpen(true);
  };

  const handleConfirmedSend = async () => {
    if (!gmailToken) {
      setGmailError('Please connect Gmail with Google first before sending emails.');
      setConfirmSendOpen(false);
      return;
    }
    setSendingEmail(true);
    setGmailError(null);
    try {
      await sendGmailMessage(gmailToken, {
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
        threadId: composeThreadId
      });
      setConfirmSendOpen(false);
      setComposeOpen(false);
      setSendSuccess(`Email sent to ${composeTo} via Gmail.`);
      await loadInbox(gmailToken, searchQuery);
    } catch (err) {
      setConfirmSendOpen(false);
      setGmailError(err instanceof Error ? err.message : 'Failed to send email via Gmail.');
    } finally {
      setSendingEmail(false);
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
            Read and reply to Gmail messages, triage client project inquiries, and moderate reader
            comments and newsletter signups.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-full sm:w-fit">
          <button
            type="button"
            onClick={() => setSubTab('gmail')}
            className={`min-h-[38px] flex-1 sm:flex-none rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
              subTab === 'gmail' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Gmail Inbox ({gmailMessages.length})
          </button>
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
            onClick={() => setSubTab('community')}
            className={`min-h-[38px] flex-1 sm:flex-none rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
              subTab === 'community' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Comments &amp; Newsletter
          </button>
        </div>
      </div>

      {/* TAB 1: GMAIL OAUTH INBOX */}
      {subTab === 'gmail' && (
        <div className="space-y-4">
          {!gmailToken ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8 text-center max-w-xl mx-auto">
              <Mail className="mx-auto h-8 w-8 text-[var(--gs-primary)]" />
              <h3 className="mt-3 font-display text-base font-bold text-slate-900">
                Connect Your Gmail Account to Read &amp; Send Client Emails
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Authorize Gmail access directly in your browser. Access tokens remain strictly in
                memory and every outgoing email requires your explicit confirmation before sending.
              </p>

              {gmailError && (
                <p className="mt-3 text-xs font-medium text-red-700">{gmailError}</p>
              )}

              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  disabled={connectingGmail}
                  onClick={handleConnectGoogle}
                  className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-800 shadow-xs hover:bg-slate-50 disabled:opacity-60"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    className="h-4 w-4 shrink-0"
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>{connectingGmail ? 'Connecting...' : 'Sign in with Google'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Connected Gmail Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 sm:px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-2 text-xs min-w-0">
                  <CheckCircle2 className="h-4 w-4 text-[#16A34A] shrink-0" />
                  <span className="font-semibold text-slate-900">Gmail Connected</span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="font-mono text-slate-600 truncate">{gmailUserEmail}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      loadInbox(gmailToken, searchQuery);
                    }}
                    className="flex items-center gap-1.5 w-full sm:w-auto"
                  >
                    <div className="relative flex-1 sm:flex-none">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search Gmail..."
                        className="min-h-[40px] w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="min-h-[40px] rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Search
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={() => loadInbox(gmailToken, searchQuery)}
                    className="min-h-[40px] inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingMessages ? 'animate-spin' : ''}`} />
                    <span>Sync</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setComposeOpen(true);
                      setComposeTo('');
                      setComposeSubject('');
                      setComposeBody('');
                      setComposeThreadId(undefined);
                    }}
                    className="min-h-[40px] inline-flex items-center gap-1 rounded-lg bg-[var(--gs-primary)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Compose</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    className="min-h-[40px] rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Disconnect
                  </button>
                </div>
              </div>

              {gmailError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800">
                  {gmailError}
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
                      Compose Gmail Message
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
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                    />
                    <input
                      type="text"
                      required
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      placeholder="Subject"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
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
                      <span>Review &amp; Send Email</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Master-Detail Email Grid */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 lg:col-span-5 max-h-[520px] overflow-y-auto">
                  {loadingMessages && gmailMessages.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      Loading Gmail messages...
                    </div>
                  ) : gmailMessages.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No Gmail messages matched this filter.
                    </div>
                  ) : (
                    gmailMessages.map((msg) => {
                      const active = selectedEmail?.id === msg.id;
                      return (
                        <button
                          key={msg.id}
                          type="button"
                          onClick={() => setSelectedEmail(msg)}
                          className={`w-full p-4 text-left transition-colors ${
                            active ? 'bg-[var(--gs-soft-bg)]' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span
                              className={`truncate ${
                                msg.unread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
                              }`}
                            >
                              {msg.from}
                            </span>
                            {msg.unread && (
                              <span className="text-[11px] font-semibold text-[var(--gs-primary)] shrink-0">
                                Unread
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs font-semibold text-slate-900 truncate">
                            {msg.subject}
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                            {msg.snippet}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-7 min-h-[360px]">
                  {selectedEmail ? (
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                        <div className="min-w-0">
                          <h3 className="font-display text-base font-bold text-slate-900">
                            {selectedEmail.subject}
                          </h3>
                          <div className="mt-1 text-xs text-slate-500 break-all">
                            From: <span className="text-slate-800">{selectedEmail.from}</span>
                            {selectedEmail.date && ` · ${selectedEmail.date}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openReplyToGmail(selectedEmail)}
                          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-[var(--gs-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--gs-primary)] hover:bg-[var(--gs-soft-bg)] whitespace-nowrap shrink-0"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Reply</span>
                        </button>
                      </div>
                      <pre className="mt-4 whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-700 max-h-[400px] overflow-y-auto">
                        {selectedEmail.bodyText}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500">
                      Select an email thread on the left to read its full message.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SUPABASE CLIENT INQUIRIES */}
      {subTab === 'inquiries' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-[var(--gs-primary)]" />
              <h3 className="font-display text-sm font-bold text-slate-900">
                Client Project Inquiries ({inquiries.length})
              </h3>
            </div>
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
                        <span>Reply via Gmail</span>
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

      {/* MANDATORY CONFIRMATION DIALOG BEFORE SENDING GMAIL */}
      {confirmSendOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Send Email"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900">
              Confirm Sending Email via Gmail
            </h3>
            <p className="text-xs text-slate-600">
              You are about to send this email from{' '}
              <span className="font-mono font-semibold text-slate-900">{gmailUserEmail}</span>:
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
                {sendingEmail ? 'Sending...' : 'Confirm & Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
