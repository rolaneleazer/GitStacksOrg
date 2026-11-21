import {
  CheckCircle2,
  Headphones,
  Mail,
  MessageSquare,
  Phone,
  Send,
  Sparkles,
  User,
  UserCheck,
  X
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  getOrCreateFloatingChatToken,
  getRealtimeWsUrl
} from '../lib/api.ts';
import type {
  ChatAutoResponseSettings,
  ChatAutoResponseTemplate,
  WebsiteChatMessage,
  WebsiteChatSession
} from '../shared/types.ts';

interface FloatingLiveChatProps {
  currentRoute: string;
}

interface VerifiedVisitorCache {
  visitor_token: string;
  visitor_name: string;
  visitor_phone: string;
  visitor_email: string;
}

const VERIFIED_STORAGE_KEY = 'gitstack_live_chat_verified_v1';

function readVerifiedCache(): VerifiedVisitorCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(VERIFIED_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VerifiedVisitorCache>;
    if (
      parsed.visitor_token &&
      parsed.visitor_name &&
      parsed.visitor_phone &&
      parsed.visitor_email
    ) {
      return {
        visitor_token: parsed.visitor_token,
        visitor_name: parsed.visitor_name,
        visitor_phone: parsed.visitor_phone,
        visitor_email: parsed.visitor_email
      };
    }
    return null;
  } catch {
    return null;
  }
}

function writeVerifiedCache(data: VerifiedVisitorCache): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VERIFIED_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage quota errors
  }
}

export function FloatingLiveChat({ currentRoute }: FloatingLiveChatProps) {
  const initialCache = useMemo(() => readVerifiedCache(), []);

  const [open, setOpen] = useState(false);
  const [verified, setVerified] = useState<boolean>(Boolean(initialCache));
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [session, setSession] = useState<WebsiteChatSession | null>(null);
  const [serverMessages, setServerMessages] = useState<WebsiteChatMessage[]>([]);
  const [localFaqMessages, setLocalFaqMessages] = useState<
    Array<WebsiteChatMessage & { escalatePrompt?: boolean; templateCategory?: string }>
  >([]);
  const [autoResponses, setAutoResponses] = useState<ChatAutoResponseTemplate[]>([]);
  const [chatSettings, setChatSettings] = useState<ChatAutoResponseSettings | null>(null);
  const [adminOnline, setAdminOnline] = useState(false);
  const [draft, setDraft] = useState('');

  // Pre-Chat Intake & Contact Info fields
  const [visitorName, setVisitorName] = useState(initialCache?.visitor_name || '');
  const [visitorPhone, setVisitorPhone] = useState(initialCache?.visitor_phone || '');
  const [visitorEmail, setVisitorEmail] = useState(initialCache?.visitor_email || '');

  const [profileOpen, setProfileOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const listEndRef = useRef<HTMLDivElement | null>(null);
  const visitorTokenRef = useRef<string>(initialCache?.visitor_token || '');
  const hasSyncedOpenRef = useRef(false);

  const combinedMessages = useMemo(() => {
    const merged = [...serverMessages, ...localFaqMessages];
    return merged.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [serverMessages, localFaqMessages]);

  const loadVerifiedSession = useCallback(async () => {
    const cached = readVerifiedCache();
    if (!cached?.visitor_token) return;
    visitorTokenRef.current = cached.visitor_token;
    try {
      const res = await api.getPublicChatSession(cached.visitor_token, currentRoute || '/');
      if (res.autoResponses) setAutoResponses(res.autoResponses);
      if (res.chatSettings) setChatSettings(res.chatSettings);
      setAdminOnline(res.adminOnline);

      if (!res.session) {
        // Legacy or purged session: re-prompt intake with pre-filled values before DB write
        setSession(null);
        setServerMessages([]);
        setVerified(false);
        return;
      }

      setSession(res.session);
      setServerMessages(res.messages);
      setVisitorName(res.session.visitor_name || cached.visitor_name);
      setVisitorPhone(res.session.visitor_phone || cached.visitor_phone);
      setVisitorEmail(res.session.visitor_email || cached.visitor_email);
    } catch {
      // keep existing UI state on transient error
    }
  }, [currentRoute]);

  // Only connect WebSocket & sync when drawer is OPEN AND visitor is VERIFIED.
  // Zero API calls and zero WebSockets run during normal page browsing!
  useEffect(() => {
    if (!open || !verified) return;

    setUnreadCount(0);
    if (!hasSyncedOpenRef.current) {
      hasSyncedOpenRef.current = true;
      setLoading(true);
      loadVerifiedSession().finally(() => setLoading(false));
    }

    let ws: WebSocket | null = null;
    try {
      const wsUrl = getRealtimeWsUrl();
      if (wsUrl && visitorTokenRef.current) {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          ws?.send(
            JSON.stringify({
              type: 'chat:join',
              visitor_token: visitorTokenRef.current
            })
          );
        };
        ws.onmessage = (evt) => {
          try {
            const payload = JSON.parse(String(evt.data || '{}')) as {
              type?: string;
              payload?: {
                session?: WebsiteChatSession;
                message?: WebsiteChatMessage;
              };
            };
            if (payload.type === 'chat:message' && payload.payload?.message) {
              const incoming = payload.payload.message;
              setServerMessages((prev) =>
                prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
              );
              if (payload.payload.session) {
                setSession(payload.payload.session);
              }
            }
          } catch {
            // ignore malformed WS frame
          }
        };
      }
    } catch {
      // polling fallback handles offline WS
    }

    const pollId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadVerifiedSession();
    }, 60_000);

    return () => {
      window.clearInterval(pollId);
      if (ws && ws.readyState < 2) ws.close();
    };
  }, [open, verified, loadVerifiedSession]);

  useEffect(() => {
    if (open) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [combinedMessages.length, open, verified]);

  const validateIntakeInputs = (): string | null => {
    const cleanName = visitorName.trim();
    const digits = visitorPhone.replace(/\D/g, '');
    const cleanEmail = visitorEmail.trim();
    if (cleanName.length < 2 || cleanName.toLowerCase() === 'website visitor') {
      return 'Please enter your Full Name.';
    }
    if (digits.length < 7) {
      return 'Please enter a valid Contact Number (at least 7 digits).';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return 'Please enter a valid Email Address.';
    }
    return null;
  };

  const handleStartVerifiedChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErr = validateIntakeInputs();
    if (validationErr) {
      setError(validationErr);
      return;
    }

    setStarting(true);
    setError(null);
    try {
      const token = visitorTokenRef.current || getOrCreateFloatingChatToken();
      visitorTokenRef.current = token;

      const res = await api.startPublicChatSession({
        visitor_token: token,
        visitor_name: visitorName.trim(),
        visitor_phone: visitorPhone.trim(),
        visitor_email: visitorEmail.trim().toLowerCase(),
        page_path: currentRoute || '/'
      });

      writeVerifiedCache({
        visitor_token: res.session.visitor_token,
        visitor_name: res.session.visitor_name,
        visitor_phone: res.session.visitor_phone,
        visitor_email: res.session.visitor_email
      });

      setSession(res.session);
      setServerMessages(res.messages);
      setAutoResponses(res.autoResponses || []);
      setChatSettings(res.chatSettings || null);
      setAdminOnline(res.adminOnline);
      setVerified(true);
      hasSyncedOpenRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start verified chat.');
    } finally {
      setStarting(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorTokenRef.current) return;
    const validationErr = validateIntakeInputs();
    if (validationErr) {
      setError(validationErr);
      return;
    }
    setSavingProfile(true);
    setError(null);
    try {
      const res = await api.updatePublicChatProfile({
        visitor_token: visitorTokenRef.current,
        visitor_name: visitorName.trim(),
        visitor_phone: visitorPhone.trim(),
        visitor_email: visitorEmail.trim().toLowerCase(),
        page_path: currentRoute || '/'
      });
      writeVerifiedCache({
        visitor_token: res.session.visitor_token,
        visitor_name: res.session.visitor_name,
        visitor_phone: res.session.visitor_phone,
        visitor_email: res.session.visitor_email
      });
      setSession(res.session);
      setProfileOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update details.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Selecting a preset FAQ question resolves INSTANTLY from cached templates with ZERO DB writes
  const handleSelectFaqChip = (tpl: ChatAutoResponseTemplate) => {
    const baseMs = Date.now();
    const visitorQuestionMsg: WebsiteChatMessage = {
      id: `local-q-${baseMs}-${Math.random().toString(36).slice(2, 6)}`,
      session_id: session?.id || 'local',
      sender_role: 'visitor',
      sender_name: visitorName.trim() || 'You',
      body: tpl.question_label,
      created_at: new Date(baseMs).toISOString()
    };
    const autoAnswerMsg: WebsiteChatMessage & {
      escalatePrompt?: boolean;
      templateCategory?: string;
    } = {
      id: `local-a-${baseMs + 20}-${Math.random().toString(36).slice(2, 6)}`,
      session_id: session?.id || 'local',
      sender_role: 'agent',
      sender_name: `GitStack Auto-Response · ${tpl.category}`,
      body: tpl.answer_body,
      created_at: new Date(baseMs + 20).toISOString(),
      escalatePrompt: tpl.escalate_prompt_enabled,
      templateCategory: tpl.category
    };
    setLocalFaqMessages((prev) => [...prev, visitorQuestionMsg, autoAnswerMsg]);
  };

  const sendLiveMessage = async (text: string, requestHuman = false) => {
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await api.sendPublicChatMessage({
        visitor_token: visitorTokenRef.current,
        visitor_name: visitorName.trim(),
        visitor_phone: visitorPhone.trim(),
        visitor_email: visitorEmail.trim().toLowerCase(),
        page_path: currentRoute || '/',
        body: clean,
        request_human: requestHuman
      });
      setSession(res.session);
      setAdminOnline(res.adminOnline);
      setServerMessages((prev) => {
        const next = prev.some((m) => m.id === res.message.id) ? [...prev] : [...prev, res.message];
        if (res.autoReplyMessage && !next.some((m) => m.id === res.autoReplyMessage!.id)) {
          next.push(res.autoReplyMessage);
        }
        return next;
      });
      if (!requestHuman) setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send inquiry.');
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendLiveMessage(draft, false);
  };

  const quickChips = useMemo(
    () => autoResponses.filter((t) => t.is_active && t.show_as_quick_chip),
    [autoResponses]
  );

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setUnreadCount(0);
          }}
          aria-label="Open live engineering chat"
          className="h-12 inline-flex items-center gap-2.5 rounded-full bg-[var(--gs-primary)] px-4 sm:px-5 text-xs font-semibold text-white shadow-lg hover:bg-[var(--gs-primary-hover)] transition-colors whitespace-nowrap"
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span>Live Chat</span>
          {unreadCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 font-mono text-[11px] font-bold text-[var(--gs-primary)] tabular-nums">
              {unreadCount}
            </span>
          )}
        </button>
      ) : (
        <section
          aria-label="Live GitStack Engineering Chat"
          className="w-[calc(100vw-2rem)] sm:w-[392px] max-h-[80vh] sm:max-h-[580px] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-slate-900 px-4 py-3 text-white flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-display text-sm font-bold text-white truncate">
                GitStack Live Inquiry Desk
              </div>
              <div className="mt-0.5 text-[11px] text-slate-300 truncate">
                {!verified
                  ? 'Quick intake required before connecting'
                  : adminOnline
                    ? 'Back Office Online · Real-time Reply'
                    : 'Auto-Response Active · Live Desk & Lark Backup'}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {verified && (
                <button
                  type="button"
                  onClick={() => setProfileOpen((p) => !p)}
                  title="Edit your name, contact number, and email"
                  className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700 whitespace-nowrap"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>Contact</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Minimize live chat"
                className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* GATE 1: MANDATORY CONTACT INTAKE BEFORE ANY API WRITE OR SESSION CREATION */}
          {!verified ? (
            <form
              onSubmit={handleStartVerifiedChat}
              className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-50/70"
            >
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1">
                <div className="text-xs font-bold text-slate-900">
                  {chatSettings?.intake_headline || 'Verify your contact details to start'}
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  {chatSettings?.intake_subheadline ||
                    'Please enter your Full Name, Contact Number, and Email Address first to unlock instant FAQ answers and live engineering support.'}
                </p>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Full Name <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <User className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                      placeholder="e.g. Rolan Molano"
                      className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Contact Number <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      required
                      value={visitorPhone}
                      onChange={(e) => setVisitorPhone(e.target.value)}
                      placeholder="e.g. +63 917 555 0142"
                      className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs font-mono text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={visitorEmail}
                      onChange={(e) => setVisitorEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-800">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={starting}
                className="min-h-[42px] w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{starting ? 'Connecting...' : 'Start Chat & View Quick Answers'}</span>
              </button>
            </form>
          ) : (
            <>
              {/* Verified Contact Update Panel */}
              {profileOpen && (
                <form
                  onSubmit={handleSaveProfile}
                  className="border-b border-slate-200 bg-slate-50 p-3 space-y-2"
                >
                  <div className="text-[11px] font-semibold text-slate-700">
                    Update your verified contact details:
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      type="text"
                      required
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                      placeholder="Full Name"
                      className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-900"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="tel"
                        required
                        value={visitorPhone}
                        onChange={(e) => setVisitorPhone(e.target.value)}
                        placeholder="Contact Number"
                        className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-mono text-slate-900"
                      />
                      <input
                        type="email"
                        required
                        value={visitorEmail}
                        onChange={(e) => setVisitorEmail(e.target.value)}
                        placeholder="Email Address"
                        className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-900"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setProfileOpen(false)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="rounded-lg bg-[var(--gs-primary)] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
                    >
                      {savingProfile ? 'Saving...' : 'Save Contact'}
                    </button>
                  </div>
                </form>
              )}

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-slate-50/70 min-h-[210px]">
                <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-900">
                    Hi {visitorName.split(' ')[0] || 'there'} · Verified ({visitorPhone})
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {chatSettings?.welcome_message_after_intake ||
                      'Select any quick question below for an instant answer, or type a message to connect directly with our engineering desk.'}
                  </p>
                </div>

                {loading && combinedMessages.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    Loading conversation...
                  </div>
                ) : (
                  combinedMessages.map((msg) => {
                    const isVisitor = msg.sender_role === 'visitor';
                    const isAgentNotice = msg.sender_role === 'agent';
                    const escalatePrompt =
                      'escalatePrompt' in msg ? Boolean(msg.escalatePrompt) : false;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isVisitor ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                            isVisitor
                              ? 'bg-[var(--gs-primary)] text-white'
                              : isAgentNotice
                                ? 'border border-indigo-200 bg-indigo-50/70 text-slate-900'
                                : 'border border-slate-200 bg-white text-slate-800'
                          }`}
                        >
                          {!isVisitor && (
                            <div className="mb-0.5 flex items-center gap-1 text-[10px] font-bold text-slate-700">
                              {isAgentNotice && <Sparkles className="h-3 w-3 text-[var(--gs-primary)] shrink-0" />}
                              <span>{msg.sender_name}</span>
                            </div>
                          )}
                          <div className="whitespace-pre-wrap break-words">{msg.body}</div>
                          {escalatePrompt && (
                            <button
                              type="button"
                              disabled={sending}
                              onClick={() =>
                                sendLiveMessage(
                                  `Please connect me with a live engineer regarding: "${msg.sender_name}"`,
                                  true
                                )
                              }
                              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                            >
                              <Headphones className="h-3 w-3 text-[var(--gs-primary)]" />
                              <span>
                                {chatSettings?.escalation_button_label || 'Talk to Live Engineer'}
                              </span>
                            </button>
                          )}
                        </div>
                        <span className="mt-0.5 font-mono text-[9.5px] text-slate-400 tabular-nums">
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    );
                  })
                )}
                {session?.escalated_at && (
                  <div className="text-center font-mono text-[10px] text-amber-700">
                    Forwarded to Lark Mail at {new Date(session.escalated_at).toLocaleTimeString()}
                  </div>
                )}
                <div ref={listEndRef} />
              </div>

              {/* Instant Quick-Select FAQ Chips (Zero DB writes per click) */}
              {quickChips.length > 0 && (
                <div className="border-t border-slate-200 bg-white px-3 py-2">
                  <div className="mb-1.5 flex items-center justify-between text-[10.5px] font-semibold text-slate-500">
                    <span>Quick Questions (Instant Answer)</span>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() =>
                        sendLiveMessage('Hello, I would like to speak with a live engineer.', true)
                      }
                      className="text-[var(--gs-primary)] hover:underline whitespace-nowrap"
                    >
                      {chatSettings?.escalation_button_label || 'Talk to Live Engineer'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                    {quickChips.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleSelectFaqChip(tpl)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-left text-[11px] font-medium text-slate-700 hover:border-[var(--gs-primary)] hover:bg-[var(--gs-soft-bg)] hover:text-[var(--gs-primary)] transition-colors"
                      >
                        {tpl.question_label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="border-t border-red-200 bg-red-50 px-3 py-1.5 text-[11px] text-red-800">
                  {error}
                </div>
              )}

              {/* Composer */}
              <form onSubmit={handleSend} className="border-t border-slate-200 bg-white p-2.5 flex gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a custom question for our team..."
                  className="min-h-[40px] flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  aria-label="Send chat message"
                  className="min-h-[40px] inline-flex items-center justify-center rounded-lg bg-[var(--gs-primary)] px-3.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </>
          )}
        </section>
      )}
    </div>
  );
}
