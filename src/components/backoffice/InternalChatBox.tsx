import { Archive, CheckCircle2, MessageSquare, Plus, Search, Send } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type {
  ChatMessage,
  ChatThread,
  ChatThreadStatus,
  DirectoryUser
} from '../../shared/types.ts';

interface InternalChatBoxProps {
  threads: ChatThread[];
  teamUsers?: DirectoryUser[];
  onAssignThread?: (threadId: string, assignedTo: string | null) => Promise<void>;
  onLoadMessages: (threadId: string) => Promise<ChatMessage[]>;
  onCreateThread: (payload: {
    subject: string;
    requester_name?: string;
    requester_email?: string;
    initial_body: string;
  }) => Promise<ChatThread>;
  onSendReply: (threadId: string, body: string, markAnswered?: boolean) => Promise<ChatMessage>;
  onUpdateStatus: (threadId: string, status: ChatThreadStatus) => Promise<void>;
}

const SOURCE_LABELS = {
  inquiry: 'Client Inquiry',
  comment: 'Reader Question',
  internal: 'Internal Q&A'
};

export function InternalChatBox({
  threads,
  teamUsers = [],
  onAssignThread,
  onLoadMessages,
  onCreateThread,
  onSendReply,
  onUpdateStatus
}: InternalChatBoxProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | ChatThreadStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(threads[0]?.id || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // New historical/internal question form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newRequester, setNewRequester] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [creating, setCreating] = useState(false);

  const filteredThreads = threads.filter((t) => {
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      t.subject.toLowerCase().includes(q) ||
      t.requester_name.toLowerCase().includes(q) ||
      t.requester_email.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const activeThread =
    threads.find((t) => t.id === selectedId) || filteredThreads[0] || null;

  useEffect(() => {
    if (!activeThread) {
      setMessages([]);
      return;
    }
    setLoadingMsgs(true);
    onLoadMessages(activeThread.id)
      .then((list) => setMessages(list))
      .finally(() => setLoadingMsgs(false));
  }, [activeThread, onLoadMessages]);

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || !replyText.trim()) return;
    setSending(true);
    try {
      const saved = await onSendReply(activeThread.id, replyText.trim(), true);
      setMessages((prev) => [...prev, saved]);
      setReplyText('');
    } finally {
      setSending(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newQuestion.trim()) return;
    setCreating(true);
    try {
      const created = await onCreateThread({
        subject: newSubject.trim(),
        requester_name: newRequester.trim() || 'Client / Team',
        initial_body: newQuestion.trim()
      });
      setSelectedId(created.id);
      setNewSubject('');
      setNewRequester('');
      setNewQuestion('');
      setShowNewForm(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Internal Back Office Chat Box &amp; Historical Q&amp;A Log
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Review every historical client inquiry question, reader comment, and internal thread—and
            post live operator answers directly inside your private workspace.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewForm((p) => !p)}
          className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Log Question Thread</span>
        </button>
      </div>

      {showNewForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
        >
          <h3 className="font-display text-sm font-bold text-slate-900">
            Log New Question or Client Thread
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              required
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Topic or question summary..."
              className="min-h-[42px] rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
            />
            <input
              type="text"
              value={newRequester}
              onChange={(e) => setNewRequester(e.target.value)}
              placeholder="Asked by (Name / Client)"
              className="min-h-[42px] rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
            />
          </div>
          <textarea
            rows={3}
            required
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Paste historical question or open team question..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
          />
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="min-h-[42px] rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="min-h-[42px] rounded-lg bg-[var(--gs-primary)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
            >
              {creating ? 'Creating...' : 'Create Thread'}
            </button>
          </div>
        </form>
      )}

      {/* Master-Detail Chat Workspace */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left Thread List (5 cols) */}
        <div className="rounded-xl border border-slate-200 bg-white flex flex-col lg:col-span-5 min-w-0">
          <div className="p-4 border-b border-slate-200 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search historical questions..."
                className="min-h-[40px] w-full rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(['all', 'open', 'answered', 'archived'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`min-h-[36px] flex-1 rounded-md py-1 text-[11px] font-semibold capitalize ${
                    statusFilter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-200 max-h-[460px] overflow-y-auto">
            {filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No historical or active threads match this filter.
              </div>
            ) : (
              filteredThreads.map((thr) => {
                const selected = activeThread?.id === thr.id;
                const owner = teamUsers.find((u) => u.user_id === thr.assigned_to);
                return (
                  <button
                    key={thr.id}
                    type="button"
                    onClick={() => setSelectedId(thr.id)}
                    className={`w-full p-4 text-left transition-colors ${
                      selected ? 'bg-[var(--gs-soft-bg)]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="truncate">
                        {SOURCE_LABELS[thr.source_type]} · {thr.requester_name}
                      </span>
                      <span
                        className={`font-semibold capitalize shrink-0 ${
                          thr.status === 'open'
                            ? 'text-[#D97706]'
                            : thr.status === 'answered'
                              ? 'text-[#16A34A]'
                              : 'text-slate-400'
                        }`}
                      >
                        {thr.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-900 line-clamp-2">
                      {thr.subject}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[10px] text-slate-400 tabular-nums">
                      <span>Updated {new Date(thr.last_message_at).toLocaleDateString()}</span>
                      {owner && <span className="text-slate-500 truncate">Owner: {owner.full_name}</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Live Chat & Answer Feed (7 cols) */}
        <div className="rounded-xl border border-slate-200 bg-white flex flex-col justify-between lg:col-span-7 min-h-[460px] sm:min-h-[520px] min-w-0">
          {activeThread ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-4 sm:p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{SOURCE_LABELS[activeThread.source_type]}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeThread.requester_name}</span>
                    {activeThread.requester_email && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono break-all">{activeThread.requester_email}</span>
                      </>
                    )}
                  </div>
                  <h3 className="mt-1 font-display text-base font-bold text-slate-900">
                    {activeThread.subject}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {teamUsers.length > 0 && onAssignThread && (
                    <select
                      aria-label="Assign chat thread owner"
                      value={activeThread.assigned_to || ''}
                      onChange={(e) =>
                        onAssignThread(activeThread.id, e.target.value ? e.target.value : null)
                      }
                      className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                    >
                      <option value="">Unassigned</option>
                      {teamUsers.map((u) => (
                        <option key={u.user_id} value={u.user_id}>
                          Owner: {u.full_name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateStatus(
                        activeThread.id,
                        activeThread.status === 'answered' ? 'open' : 'answered'
                      )
                    }
                    className="min-h-[38px] inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" />
                    <span>
                      {activeThread.status === 'answered' ? 'Reopen' : 'Mark Answered'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(activeThread.id, 'archived')}
                    className="min-h-[38px] inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span>Archive</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 p-4 sm:p-5 space-y-4 max-h-[340px] overflow-y-auto bg-[var(--gs-canvas-bg)]">
                {loadingMsgs ? (
                  <p className="text-xs text-slate-500">Loading thread history...</p>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-slate-500">No messages in this thread yet.</p>
                ) : (
                  messages.map((m) => {
                    const isAdmin = m.sender_role === 'admin';
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                      >
                        <div className="mb-1 text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700">{m.sender_name}</span>
                          {' · '}
                          <span className="font-mono tabular-nums">
                            {new Date(m.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div
                          className={`max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed whitespace-pre-line ${
                            isAdmin
                              ? 'bg-[var(--gs-primary)] text-white'
                              : 'border border-slate-200 bg-white text-slate-800'
                          }`}
                        >
                          {m.body}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form
                onSubmit={handleReplySubmit}
                className="border-t border-slate-200 p-4 flex flex-col sm:flex-row sm:items-end gap-3 bg-white rounded-b-xl"
              >
                <textarea
                  rows={2}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a live answer or internal engineering note..."
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !replyText.trim()}
                  className="min-h-[44px] sm:min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{sending ? 'Posting...' : 'Answer Live'}</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-10 text-center text-xs text-slate-500">
              <MessageSquare className="h-7 w-7 text-slate-300 mb-2" />
              <p>Select a historical question thread to view context and answer live.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
