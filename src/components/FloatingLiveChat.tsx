import { Mail, MessageSquare, Send, UserCheck, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  getOrCreateFloatingChatToken,
  getRealtimeWsUrl
} from '../lib/api.ts';
import type { WebsiteChatMessage, WebsiteChatSession } from '../shared/types.ts';

interface FloatingLiveChatProps {
  currentRoute: string;
}

export function FloatingLiveChat({ currentRoute }: FloatingLiveChatProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [session, setSession] = useState<WebsiteChatSession | null>(null);
  const [messages, setMessages] = useState<WebsiteChatMessage[]>([]);
  const [adminOnline, setAdminOnline] = useState(false);
  const [draft, setDraft] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const listEndRef = useRef<HTMLDivElement | null>(null);
  const visitorTokenRef = useRef<string>('');

  const loadThread = useCallback(async () => {
    if (!visitorTokenRef.current) {
      visitorTokenRef.current = getOrCreateFloatingChatToken();
    }
    try {
      const res = await api.getPublicChatSession(visitorTokenRef.current, currentRoute || '/');
      setSession(res.session);
      setMessages((prev) => {
        if (!open && res.messages.length > prev.length && prev.length > 0) {
          const newAdminMsgs = res.messages
            .slice(prev.length)
            .filter((m) => m.sender_role !== 'visitor').length;
          if (newAdminMsgs > 0) setUnreadCount((u) => u + newAdminMsgs);
        }
        return res.messages;
      });
      setAdminOnline(res.adminOnline);
      setVisitorName((prev) =>
        prev || (res.session.visitor_name !== 'Website Visitor' ? res.session.visitor_name : '')
      );
      setVisitorEmail((prev) => prev || res.session.visitor_email || '');
    } catch {
      // keep existing UI state on transient error
    }
  }, [currentRoute, open]);

  // Initial load & real-time WebSocket subscription
  useEffect(() => {
    visitorTokenRef.current = getOrCreateFloatingChatToken();
    setLoading(true);
    loadThread().finally(() => setLoading(false));

    let ws: WebSocket | null = null;
    try {
      const wsUrl = getRealtimeWsUrl();
      if (wsUrl) {
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
              setMessages((prev) =>
                prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
              );
              if (payload.payload.session) {
                setSession(payload.payload.session);
              }
              if (!open && incoming.sender_role !== 'visitor') {
                setUnreadCount((u) => u + 1);
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

    return () => {
      if (ws && ws.readyState < 2) ws.close();
    };
  }, [loadThread, open]);

  // 60-second poll fallback while drawer is open (WebSocket provides instant delivery)
  useEffect(() => {
    if (!open) return;
    setUnreadCount(0);
    loadThread();
    const id = window.setInterval(loadThread, 60_000);
    return () => window.clearInterval(id);
  }, [open, loadThread]);

  useEffect(() => {
    if (open) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, open]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorTokenRef.current) return;
    setSavingProfile(true);
    setError(null);
    try {
      const res = await api.updatePublicChatProfile({
        visitor_token: visitorTokenRef.current,
        visitor_name: visitorName.trim() || 'Website Visitor',
        visitor_email: visitorEmail.trim(),
        page_path: currentRoute || '/'
      });
      setSession(res.session);
      setProfileOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save details.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draft.trim();
    if (!clean || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await api.sendPublicChatMessage({
        visitor_token: visitorTokenRef.current || getOrCreateFloatingChatToken(),
        visitor_name: visitorName.trim() || undefined,
        visitor_email: visitorEmail.trim() || undefined,
        page_path: currentRoute || '/',
        body: clean
      });
      setSession(res.session);
      setAdminOnline(res.adminOnline);
      setMessages((prev) =>
        prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]
      );
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send inquiry.');
    } finally {
      setSending(false);
    }
  };

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
          className="w-[calc(100vw-2rem)] sm:w-[376px] max-h-[75vh] sm:max-h-[540px] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-slate-900 px-4 py-3 text-white flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-display text-sm font-bold text-white truncate">
                GitStack Live Inquiry Desk
              </div>
              <div className="mt-0.5 text-[11px] text-slate-300 truncate">
                {adminOnline
                  ? 'Back Office Online · Real-time Reply'
                  : 'Away Mode · Escalates to Lark Mail after 2m'}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setProfileOpen((p) => !p)}
                title="Add your name and email for Lark Mail reply"
                className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>{visitorEmail ? 'Info' : 'Add Email'}</span>
              </button>
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

          {/* Optional Visitor Name & Email Capture */}
          {profileOpen && (
            <form
              onSubmit={handleSaveProfile}
              className="border-b border-slate-200 bg-slate-50 p-3 space-y-2"
            >
              <div className="text-[11px] font-semibold text-slate-700">
                Leave your name &amp; email so we can also reply via Lark Mail:
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="Your name"
                  className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-900"
                />
                <input
                  type="email"
                  value={visitorEmail}
                  onChange={(e) => setVisitorEmail(e.target.value)}
                  placeholder="work@company.com"
                  className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-900"
                />
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
                  {savingProfile ? 'Saving...' : 'Save Info'}
                </button>
              </div>
            </form>
          )}

          {/* Message Feed */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-slate-50/70 min-h-[220px]">
            {loading && messages.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Connecting to GitStack engineering desk...
              </div>
            ) : messages.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs leading-relaxed text-slate-600 space-y-2">
                <p className="font-semibold text-slate-900">
                  Ask our engineering team about AI integration, custom SaaS builds, or MLOps architecture.
                </p>
                <p className="text-[11px] text-slate-500">
                  If our Back Office operator is away for more than 2 minutes, our inquiry watcher automatically forwards your message to our Lark Mail inbox.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isVisitor = msg.sender_role === 'visitor';
                const isAgentNotice = msg.sender_role === 'agent';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isVisitor ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                        isVisitor
                          ? 'bg-[var(--gs-primary)] text-white'
                          : isAgentNotice
                            ? 'border border-amber-200 bg-amber-50 text-amber-900'
                            : 'border border-slate-200 bg-white text-slate-800'
                      }`}
                    >
                      {!isVisitor && (
                        <div className="mb-0.5 flex items-center gap-1 text-[10px] font-bold opacity-80">
                          {isAgentNotice && <Mail className="h-3 w-3 shrink-0" />}
                          <span>{msg.sender_name}</span>
                        </div>
                      )}
                      <div className="whitespace-pre-wrap break-words">{msg.body}</div>
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
              placeholder="Write your question..."
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
        </section>
      )}
    </div>
  );
}
