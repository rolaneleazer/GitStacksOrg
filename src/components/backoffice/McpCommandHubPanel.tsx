import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Cpu,
  FileDiff,
  KeyRound,
  Play,
  RefreshCw,
  RotateCw,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  XCircle
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.ts';
import type {
  McpChatHistoryTurn,
  McpCodeProposal,
  McpDashboardResponse,
  McpToolDescriptor,
  McpToolTrace
} from '../../shared/types.ts';

type HubSubTab = 'chat' | 'connect' | 'approvals' | 'catalog';

interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  traces?: McpToolTrace[];
  createdProposalIds?: string[];
  modelUsed?: string;
  thinkingLevel?: string;
  createdAt: string;
}

const STARTER_PROMPTS = [
  'Check all 8 agents, Quota Shield status, and unanswered CRM inquiries.',
  'List recent live chat sessions and verify active Auto-Response FAQ templates.',
  'Inspect our Search Console metrics and published Insights articles quality.',
  'Read src/server/mcpService.ts header and list confined files in src/components/backoffice.'
];

function buildDefaultArgsForTool(tool: McpToolDescriptor): string {
  const sample: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(tool.parameters)) {
    if (!def.required) continue;
    if (key === 'filePath') sample[key] = 'package.json';
    else if (key === 'query') sample[key] = 'handleMcpJsonRpc';
    else if (key === 'pageKey') sample[key] = 'services';
    else if (def.enumValues && def.enumValues.length > 0) sample[key] = def.enumValues[0];
    else if (def.type === 'number') sample[key] = 10;
    else if (def.type === 'boolean') sample[key] = false;
    else if (def.type === 'object') sample[key] = {};
    else if (def.type === 'array') sample[key] = [];
    else sample[key] = '';
  }
  return JSON.stringify(sample, null, 2);
}

export function McpCommandHubPanel() {
  const [subTab, setSubTab] = useState<HubSubTab>('chat');
  const [dashboard, setDashboard] = useState<McpDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Chat state
  const [thinkingMode, setThinkingMode] = useState<'fast' | 'deep'>('fast');
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Gemini & MCP Command Hub ready. Issue natural-language operations across CMS, CRM, Live Chat, 8 Agents, Quota Shield, or ask me to inspect source files and stage reviewable code diffs.',
      createdAt: new Date().toISOString()
    }
  ]);
  const [expandedTraceIds, setExpandedTraceIds] = useState<Record<string, boolean>>({});

  // Custom Connect & Token state
  const [tokenLabel, setTokenLabel] = useState('Gemini Custom Connect');
  const [creatingToken, setCreatingToken] = useState(false);
  const [revealedToken, setRevealedToken] = useState<{ label: string; rawToken: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [handshakeResult, setHandshakeResult] = useState<{
    ok: boolean;
    durationMs: number;
    toolCount: number;
    serverName?: string;
  } | null>(null);
  const [testingHandshake, setTestingHandshake] = useState(false);

  // Proposal filter & busy state
  const [proposalFilter, setProposalFilter] = useState<'pending' | 'resolved'>('pending');
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);

  // Catalog & Runner state
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [selectedTool, setSelectedTool] = useState<McpToolDescriptor | null>(null);
  const [toolArgsText, setToolArgsText] = useState('{}');
  const [toolRunning, setToolRunning] = useState(false);
  const [toolRunOutput, setToolRunOutput] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.git-stack.org';

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getMcpDashboard();
      setDashboard(res);
      if (!selectedTool && res.tools.length > 0) {
        setSelectedTool(res.tools[0]);
        setToolArgsText(buildDefaultArgsForTool(res.tools[0]));
      }
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load MCP Command Hub.'
      });
    } finally {
      setLoading(false);
    }
  }, [selectedTool]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const pendingProposals = useMemo(
    () => (dashboard?.proposals || []).filter((p) => p.status === 'pending'),
    [dashboard?.proposals]
  );

  const resolvedProposals = useMemo(
    () => (dashboard?.proposals || []).filter((p) => p.status !== 'pending'),
    [dashboard?.proposals]
  );

  const filteredTools = useMemo(() => {
    const tools = dashboard?.tools || [];
    if (categoryFilter === 'All') return tools;
    return tools.filter((t) => t.category === categoryFilter);
  }, [dashboard?.tools, categoryFilter]);

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      setNotice({ type: 'err', text: 'Clipboard write failed in browser.' });
    }
  };

  const handleSendChat = async (promptOverride?: string) => {
    const text = (promptOverride ?? chatInput).trim();
    if (!text || chatSending) return;

    const userMsg: ChatMessageItem = {
      id: `usr_${Date.now()}`,
      role: 'user',
      text,
      createdAt: new Date().toISOString()
    };

    const historyPayload: McpChatHistoryTurn[] = messages
      .filter((m) => m.id !== 'welcome')
      .slice(-10)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    if (!promptOverride) setChatInput('');
    setChatSending(true);
    setNotice(null);

    try {
      const res = await api.sendGeminiMcpChat({
        message: text,
        history: historyPayload,
        thinkingMode
      });
      const assistantMsg: ChatMessageItem = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        text: res.reply,
        traces: res.traces,
        createdProposalIds: res.createdProposalIds,
        modelUsed: res.modelUsed,
        thinkingLevel: res.thinkingLevel,
        createdAt: new Date().toISOString()
      };
      setMessages((prev) => [...prev, assistantMsg]);
      await loadDashboard();
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gemini Command Chat request failed.'
      });
    } finally {
      setChatSending(false);
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingToken) return;
    setCreatingToken(true);
    setNotice(null);
    try {
      const res = await api.createMcpToken(tokenLabel.trim() || 'Gemini Custom Connect');
      setRevealedToken({ label: res.token.label, rawToken: res.rawToken });
      setNotice({
        type: 'ok',
        text: `Generated rotating MCP token "${res.token.label}". Copy it now — it will not be displayed again.`
      });
      await loadDashboard();
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to create MCP token.'
      });
    } finally {
      setCreatingToken(false);
    }
  };

  const handleRotateToken = async (id: string) => {
    setNotice(null);
    try {
      const res = await api.rotateMcpToken(id);
      setRevealedToken({ label: res.token.label, rawToken: res.rawToken });
      setNotice({
        type: 'ok',
        text: `Token rotated cleanly. Previous secret is immediately revoked.`
      });
      await loadDashboard();
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to rotate MCP token.'
      });
    }
  };

  const handleRevokeToken = async (id: string) => {
    setNotice(null);
    try {
      await api.revokeMcpToken(id);
      setNotice({ type: 'ok', text: 'MCP token revoked immediately.' });
      await loadDashboard();
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to revoke MCP token.'
      });
    }
  };

  const handleTestHandshake = async () => {
    setTestingHandshake(true);
    setNotice(null);
    try {
      const res = await api.testMcpHandshake();
      const serverInfo = (res.initializeResult as { serverInfo?: { name?: string } } | null)?.serverInfo;
      setHandshakeResult({
        ok: res.ok,
        durationMs: res.durationMs,
        toolCount: res.toolCount,
        serverName: serverInfo?.name
      });
      await loadDashboard();
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'MCP handshake failed.'
      });
    } finally {
      setTestingHandshake(false);
    }
  };

  const handleResolveProposal = async (proposal: McpCodeProposal, action: 'approve' | 'reject') => {
    setBusyProposalId(proposal.id);
    setNotice(null);
    try {
      if (action === 'approve') {
        await api.approveMcpCodeProposal(proposal.id);
        setNotice({
          type: 'ok',
          text: `Approved & applied patch to ${proposal.filePath}.`
        });
      } else {
        await api.rejectMcpCodeProposal(proposal.id);
        setNotice({
          type: 'ok',
          text: `Rejected staged patch for ${proposal.filePath}.`
        });
      }
      await loadDashboard();
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : `Failed to ${action} staged proposal.`
      });
    } finally {
      setBusyProposalId(null);
    }
  };

  const handleRunCatalogTool = async () => {
    if (!selectedTool || toolRunning) return;
    setToolRunning(true);
    setToolRunOutput(null);
    try {
      const parsedArgs = toolArgsText.trim() ? JSON.parse(toolArgsText) : {};
      const res = await api.runMcpTool(selectedTool.name, parsedArgs);
      setToolRunOutput(JSON.stringify(res, null, 2));
      await loadDashboard();
    } catch (err) {
      setToolRunOutput(
        JSON.stringify(
          { ok: false, error: err instanceof Error ? err.message : 'Invalid JSON or execution error.' },
          null,
          2
        )
      );
    } finally {
      setToolRunning(false);
    }
  };

  const mcpHttpUrl = `${origin}/api/mcp`;
  const mcpSseUrl = `${origin}/api/mcp/sse`;
  const customConnectSnippet = JSON.stringify(
    {
      mcpServers: {
        gitstack: {
          transport: 'http',
          url: mcpHttpUrl,
          sseUrl: mcpSseUrl,
          headers: {
            Authorization: `Bearer ${revealedToken?.rawToken || '<YOUR_ROTATING_MCP_TOKEN>'}`
          }
        }
      }
    },
    null,
    2
  );

  const curlHandshakeSnippet = `curl -sS -X POST "${mcpHttpUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${revealedToken?.rawToken || '<YOUR_ROTATING_MCP_TOKEN>'}" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`;

  return (
    <div className="space-y-5">
      {/* Header Bar & Metrics */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--gs-primary)]">
              <Cpu className="h-4 w-4" />
              <span>Super Admin MCP &amp; Gemini Control Plane</span>
            </div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Gemini &amp; MCP Command Hub
            </h2>
            <p className="text-xs text-slate-600 max-w-3xl">
              Control every Back Office module (CMS, SEO, CRM, Live Chat, 8 Agents, Quota Shield, QA &amp; Security)
              and inspect full source code via Gemini Command Chat or external MCP Custom Connect clients. Code
              modifications stage into the diff queue and never touch disk without your approval.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="min-h-[40px] inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh State</span>
          </button>
        </div>

        {/* Summary Strip */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-200 pt-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5">
            <div className="text-[11px] font-medium text-slate-500">Registered MCP Tools</div>
            <div className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-900">
              {dashboard?.tools.length ?? 25}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5">
            <div className="text-[11px] font-medium text-slate-500">Active Rotating Tokens</div>
            <div className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-900">
              {(dashboard?.tokens || []).filter((t) => !t.revokedAt).length}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5">
            <div className="text-[11px] font-medium text-slate-500">Pending Diff Approvals</div>
            <div
              className={`mt-0.5 font-mono text-base font-bold tabular-nums ${
                pendingProposals.length > 0 ? 'text-amber-700' : 'text-slate-900'
              }`}
            >
              {pendingProposals.length}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5">
            <div className="text-[11px] font-medium text-slate-500">Server Gemini Runtime</div>
            <div
              className={`mt-0.5 font-mono text-xs font-bold ${
                dashboard?.geminiConfigured ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {dashboard?.geminiConfigured ? 'READY · gemini-4-hydrogen' : 'ENV KEY NEEDED'}
            </div>
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
            notice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-semibold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sub-Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setSubTab('chat')}
          className={`min-h-[40px] inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            subTab === 'chat'
              ? 'bg-[var(--gs-primary)] text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Gemini Command Chat</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('connect')}
          className={`min-h-[40px] inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            subTab === 'connect'
              ? 'bg-[var(--gs-primary)] text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <KeyRound className="h-3.5 w-3.5" />
          <span>Custom Connect &amp; Tokens</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('approvals')}
          className={`min-h-[40px] inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            subTab === 'approvals'
              ? 'bg-[var(--gs-primary)] text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <FileDiff className="h-3.5 w-3.5" />
          <span>Edit Approval Queue</span>
          <span
            className={`font-mono text-[11px] tabular-nums px-1.5 py-0.5 rounded ${
              subTab === 'approvals'
                ? 'bg-white/20 text-white'
                : pendingProposals.length > 0
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            {pendingProposals.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('catalog')}
          className={`min-h-[40px] inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            subTab === 'catalog'
              ? 'bg-[var(--gs-primary)] text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Terminal className="h-3.5 w-3.5" />
          <span>Tool Catalog &amp; Audit Log</span>
        </button>
      </div>

      {/* SUB-TAB 1: IN-APP GEMINI COMMAND CHAT */}
      {subTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* Chat Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Bot className="h-4 w-4 text-[var(--gs-primary)]" />
                <span>Live MCP Tool-Calling Session</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setThinkingMode('fast')}
                  className={`min-h-[32px] rounded-md px-2.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    thinkingMode === 'fast'
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Fast Ops (Medium)
                </button>
                <button
                  type="button"
                  onClick={() => setThinkingMode('deep')}
                  className={`min-h-[32px] rounded-md px-2.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    thinkingMode === 'deep'
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Deep Code (XHigh)
                </button>
              </div>
            </div>

            {dashboard && !dashboard.geminiConfigured && (
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Server-side <code className="font-mono">GEMINI_API_KEY</code> is not configured in this runtime.
                  External MCP Custom Connect endpoints still work independently.
                </span>
              </div>
            )}

            {/* Transcript */}
            <div className="flex-1 max-h-[540px] min-h-[360px] overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[92%] rounded-xl border px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'border-[var(--gs-primary)] bg-[var(--gs-primary)] text-white'
                        : 'border-slate-200 bg-slate-50/70 text-slate-800'
                    }`}
                  >
                    {msg.text}

                    {/* Inline Tool Execution Traces */}
                    {msg.traces && msg.traces.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Executed MCP Tools ({msg.traces.length})
                        </div>
                        {msg.traces.map((trace) => {
                          const isOpen = Boolean(expandedTraceIds[trace.id]);
                          return (
                            <div
                              key={trace.id}
                              className="rounded-lg border border-slate-200 bg-white overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedTraceIds((prev) => ({
                                    ...prev,
                                    [trace.id]: !prev[trace.id]
                                  }))
                                }
                                className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-slate-50"
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  {isOpen ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  )}
                                  <span className="font-mono text-[11px] font-semibold text-slate-900 truncate">
                                    {trace.toolName}
                                  </span>
                                </span>
                                <span className="flex items-center gap-2 shrink-0 font-mono text-[10px] tabular-nums">
                                  <span
                                    className={
                                      trace.status === 'ok'
                                        ? 'text-emerald-700 font-semibold'
                                        : 'text-red-700 font-semibold'
                                    }
                                  >
                                    {trace.status.toUpperCase()}
                                  </span>
                                  <span className="text-slate-400">{trace.durationMs}ms</span>
                                </span>
                              </button>
                              {isOpen && (
                                <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700 space-y-1.5 overflow-x-auto">
                                  <div>
                                    <span className="text-slate-400">args: </span>
                                    <span>{JSON.stringify(trace.args)}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">result: </span>
                                    <span>{trace.resultPreview}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Staged Code Proposal Shortcut */}
                    {msg.createdProposalIds && msg.createdProposalIds.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-amber-800">
                          {msg.createdProposalIds.length} staged source edit(s) waiting for review
                        </span>
                        <button
                          type="button"
                          onClick={() => setSubTab('approvals')}
                          className="rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 whitespace-nowrap"
                        >
                          Review Diff Queue
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chatSending && (
                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[var(--gs-primary)]" />
                  <span>Gemini is executing MCP tools &amp; reasoning...</span>
                </div>
              )}
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendChat();
              }}
              className="border-t border-slate-200 bg-white p-3 flex items-end gap-2"
            >
              <textarea
                rows={2}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendChat();
                  }
                }}
                placeholder="Ask Gemini to inspect codebase, audit SEO/CRM/Agents, update settings, or propose a code patch..."
                className="flex-1 min-w-0 resize-none rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={chatSending || !chatInput.trim()}
                className="min-h-[42px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50 whitespace-nowrap"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Run Command</span>
              </button>
            </form>
          </div>

          {/* Right Sidebar: Starters & Security Guardrails */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="text-xs font-bold text-slate-900">Quick Command Prompts</div>
              <div className="space-y-2">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={chatSending}
                    onClick={() => void handleSendChat(prompt)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-left text-xs text-slate-700 hover:border-[var(--gs-primary)] hover:bg-white transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Source &amp; Mutation Safeguards</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-slate-600 leading-relaxed">
                <li>
                  • Source reads and searches are confined strictly inside the repository directory.
                </li>
                <li>
                  • Environment files (<code className="font-mono">.env*</code>), private keys, and credentials are
                  blocked automatically.
                </li>
                <li>
                  • Source edits created via <code className="font-mono">code_propose_edit</code> wait in the Approval
                  Queue until you click Approve &amp; Apply.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CUSTOM CONNECT & ROTATING TOKENS */}
      {subTab === 'connect' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 space-y-4">
            {/* Generate Token Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Rotating MCP API Tokens (Super Admin Scope)
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Generate dedicated Bearer tokens for external Gemini Custom Connect or MCP CLI clients. Secrets are
                  displayed once at creation and stored strictly as SHA-256 hashes.
                </p>
              </div>

              <form onSubmit={handleCreateToken} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={tokenLabel}
                  onChange={(e) => setTokenLabel(e.target.value)}
                  maxLength={60}
                  placeholder="Integration label (e.g. Gemini Custom Connect)"
                  className="min-h-[40px] flex-1 min-w-[200px] rounded-lg border border-slate-200 bg-slate-50/70 px-3 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={creatingToken}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 whitespace-nowrap"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>{creatingToken ? 'Generating...' : 'Generate Rotating Token'}</span>
                </button>
              </form>

              {revealedToken && (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-900">
                      One-Time Token Revealed ({revealedToken.label}) — Copy Now
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopy('raw-token', revealedToken.rawToken)}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100 whitespace-nowrap"
                    >
                      {copiedKey === 'raw-token' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === 'raw-token' ? 'Copied' : 'Copy Token'}</span>
                    </button>
                  </div>
                  <div className="rounded border border-emerald-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 break-all select-all">
                    {revealedToken.rawToken}
                  </div>
                </div>
              )}

              {/* Token List */}
              <div className="space-y-2 pt-1">
                {(dashboard?.tokens || []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500">
                    No rotating MCP tokens generated yet. Create one above to connect external Gemini or MCP clients.
                  </div>
                ) : (
                  (dashboard?.tokens || []).map((t) => {
                    const isRevoked = Boolean(t.revokedAt);
                    return (
                      <div
                        key={t.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-3"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 truncate">{t.label}</span>
                            <span
                              className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isRevoked
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {isRevoked ? 'REVOKED' : 'ACTIVE'}
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {t.tokenPrefix} · Created {new Date(t.createdAt).toLocaleDateString()}
                            {t.lastUsedAt ? ` · Last used ${new Date(t.lastUsedAt).toLocaleTimeString()}` : ''}
                          </div>
                        </div>

                        {!isRevoked && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleRotateToken(t.id)}
                              className="min-h-[34px] inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                            >
                              <RotateCw className="h-3 w-3" />
                              <span>Rotate</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRevokeToken(t.id)}
                              className="min-h-[34px] inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 whitespace-nowrap"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Revoke</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Custom Connect Payloads & Live Handshake Test */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Custom Connect Endpoints
                </h3>
                <button
                  type="button"
                  onClick={() => void handleTestHandshake()}
                  disabled={testingHandshake}
                  className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap"
                >
                  <Play className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
                  <span>{testingHandshake ? 'Testing...' : 'Test MCP Handshake'}</span>
                </button>
              </div>

              {handshakeResult && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 font-mono">
                  OK · {handshakeResult.serverName || 'gitstack-command-mcp'} · {handshakeResult.toolCount} tools ·{' '}
                  {handshakeResult.durationMs}ms
                </div>
              )}

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase text-slate-500">HTTP JSON-RPC Endpoint</div>
                    <div className="font-mono text-[11px] text-slate-900 truncate">{mcpHttpUrl}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopy('http-url', mcpHttpUrl)}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shrink-0"
                  >
                    {copiedKey === 'http-url' ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase text-slate-500">SSE Stream Endpoint</div>
                    <div className="font-mono text-[11px] text-slate-900 truncate">{mcpSseUrl}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopy('sse-url', mcpSseUrl)}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shrink-0"
                  >
                    {copiedKey === 'sse-url' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">MCP Client JSON Config</span>
                  <button
                    type="button"
                    onClick={() => void handleCopy('json-cfg', customConnectSnippet)}
                    className="text-[11px] font-semibold text-[var(--gs-primary)] hover:underline"
                  >
                    {copiedKey === 'json-cfg' ? 'Copied JSON' : 'Copy JSON'}
                  </button>
                </div>
                <pre className="rounded-lg border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] text-slate-100 overflow-x-auto">
                  {customConnectSnippet}
                </pre>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">Quick cURL Test</span>
                  <button
                    type="button"
                    onClick={() => void handleCopy('curl-cmd', curlHandshakeSnippet)}
                    className="text-[11px] font-semibold text-[var(--gs-primary)] hover:underline"
                  >
                    {copiedKey === 'curl-cmd' ? 'Copied cURL' : 'Copy cURL'}
                  </button>
                </div>
                <pre className="rounded-lg border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] text-slate-100 overflow-x-auto">
                  {curlHandshakeSnippet}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: EDIT APPROVAL QUEUE */}
      {subTab === 'approvals' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900">
                Staged Source Code Change Proposals
              </h3>
              <p className="text-xs text-slate-600">
                Review line-by-line diffs staged by Gemini Chat or external MCP clients before committing changes to
                disk.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setProposalFilter('pending')}
                className={`min-h-[34px] rounded-lg px-3 text-xs font-semibold whitespace-nowrap ${
                  proposalFilter === 'pending'
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Pending ({pendingProposals.length})
              </button>
              <button
                type="button"
                onClick={() => setProposalFilter('resolved')}
                className={`min-h-[34px] rounded-lg px-3 text-xs font-semibold whitespace-nowrap ${
                  proposalFilter === 'resolved'
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Resolved ({resolvedProposals.length})
              </button>
            </div>
          </div>

          {(proposalFilter === 'pending' ? pendingProposals : resolvedProposals).length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 py-10 text-center text-xs text-slate-500">
              {proposalFilter === 'pending'
                ? 'No pending source edits awaiting review. Ask Gemini or an MCP client to propose a patch.'
                : 'No resolved code proposals yet.'}
            </div>
          ) : (
            <div className="space-y-4">
              {(proposalFilter === 'pending' ? pendingProposals : resolvedProposals).map((p) => {
                const isBusy = busyProposalId === p.id;
                return (
                  <div key={p.id} className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Code2 className="h-4 w-4 text-[var(--gs-primary)] shrink-0" />
                          <span className="font-mono text-xs font-bold text-slate-900">{p.filePath}</span>
                          <span
                            className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                              p.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : p.status === 'applied'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-800">{p.summary}</div>
                        <div className="text-[11px] text-slate-500">
                          {p.rationale} · Requested via <span className="font-mono">{p.source}</span> by{' '}
                          <span className="font-mono">{p.requestedBy}</span>
                        </div>
                      </div>

                      {p.status === 'pending' && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleResolveProposal(p, 'approve')}
                            className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{isBusy ? 'Applying...' : 'Approve & Apply'}</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleResolveProposal(p, 'reject')}
                            className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="overflow-x-auto bg-white p-3 font-mono text-[11px] leading-relaxed">
                      {p.diffPreview.split('\n').map((line, i) => {
                        const cls = line.startsWith('+ ')
                          ? 'bg-emerald-50 text-emerald-900'
                          : line.startsWith('- ')
                            ? 'bg-red-50 text-red-900'
                            : line.startsWith('@@')
                              ? 'bg-slate-100 text-slate-600 font-bold'
                              : 'text-slate-600';
                        return (
                          <div key={i} className={`px-2 py-0.5 whitespace-pre ${cls}`}>
                            {line}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: TOOL CATALOG & AUDIT LOG */}
      {subTab === 'catalog' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Filterable Tool List */}
            <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Unified MCP Tool Registry ({filteredTools.length})
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  {['All', 'Source Code', 'CMS & SEO', 'CRM & Inbox', 'Agents & Workflows', 'Infra & Security'].map(
                    (cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoryFilter(cat)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                          categoryFilter === cat
                            ? 'bg-slate-900 text-white'
                            : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {cat}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                {filteredTools.map((t) => {
                  const selected = selectedTool?.name === t.name;
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => {
                        setSelectedTool(t);
                        setToolArgsText(buildDefaultArgsForTool(t));
                        setToolRunOutput(null);
                      }}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selected
                          ? 'border-[var(--gs-primary)] bg-blue-50/40'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">{t.name}</span>
                        <span
                          className={`font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            t.accessLevel === 'read'
                              ? 'bg-slate-100 text-slate-700'
                              : t.accessLevel === 'staged_edit'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {t.accessLevel}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-600">{t.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Live Tool Runner */}
            <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Interactive Tool Runner
                </h3>
                {selectedTool && (
                  <span className="font-mono text-[11px] font-semibold text-[var(--gs-primary)]">
                    {selectedTool.name}
                  </span>
                )}
              </div>

              {selectedTool ? (
                <>
                  <div className="text-[11px] text-slate-600">{selectedTool.description}</div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      JSON Arguments
                    </label>
                    <textarea
                      rows={5}
                      value={toolArgsText}
                      onChange={(e) => setToolArgsText(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 font-mono text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={toolRunning}
                    onClick={() => void handleRunCatalogTool()}
                    className="min-h-[38px] w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>{toolRunning ? 'Executing...' : `Execute ${selectedTool.name}`}</span>
                  </button>

                  {toolRunOutput && (
                    <pre className="max-h-[240px] overflow-auto rounded-lg border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] text-slate-100">
                      {toolRunOutput}
                    </pre>
                  )}
                </>
              ) : (
                <div className="text-xs text-slate-500">Select a tool from the catalog to test it live.</div>
              )}
            </div>
          </div>

          {/* Audit Trail Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-900">
                MCP &amp; Gemini Execution Audit Log ({dashboard?.auditLogs.length ?? 0})
              </h3>
              <span className="text-[11px] text-slate-500">Latest 80 calls persisted on server</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Timestamp</th>
                    <th className="px-4 py-2.5">Actor</th>
                    <th className="px-4 py-2.5">Transport</th>
                    <th className="px-4 py-2.5">Tool</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Time</th>
                    <th className="px-4 py-2.5">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(dashboard?.auditLogs || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                        No MCP tool calls logged yet.
                      </td>
                    </tr>
                  ) : (
                    (dashboard?.auditLogs || []).map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                          {log.actor}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {log.transport}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-slate-900 whitespace-nowrap">
                          {log.toolName}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span
                            className={`font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              log.status === 'ok'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.status === 'blocked'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] tabular-nums text-slate-500 whitespace-nowrap">
                          {log.durationMs}ms
                        </td>
                        <td className="px-4 py-2.5 text-[11px] text-slate-600 max-w-md truncate">
                          {log.summary}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
