import {
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCode2,
  Globe,
  Mail,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Zap
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import type {
  AiSearchPlatformResult,
  AiSearchVisibilityDashboardResponse,
  AiSearchVisibilityRun,
  AiSearchVisibilitySettings,
  UserRole
} from '../../shared/types.ts';

interface AiSearchVisibilityPanelProps {
  currentUserRole: UserRole;
  onPagesBoosted?: () => void;
}

export function AiSearchVisibilityPanel({
  currentUserRole,
  onPagesBoosted
}: AiSearchVisibilityPanelProps) {
  const [dashboard, setDashboard] = useState<AiSearchVisibilityDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningTest, setRunningTest] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'platforms' | 'queries' | 'compliance' | 'history' | 'schedule'
  >('platforms');
  const [selectedRun, setSelectedRun] = useState<AiSearchVisibilityRun | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<AiSearchVisibilitySettings | null>(null);

  const canManage = currentUserRole === 'super_admin' || currentUserRole === 'editor';

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAiVisibilityDashboard();
      setDashboard(res);
      setSettingsDraft(res.settings);
      setSelectedRun((prev) => {
        if (prev) {
          const found = res.history.find((r) => r.id === prev.id);
          if (found) return found;
        }
        return res.latestRun;
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load AI & SEO Visibility dashboard.'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleRunTestNow = async (sendEmail = false) => {
    if (sendEmail) {
      setSendingEmail(true);
    } else {
      setRunningTest(true);
    }
    setNotice(null);
    try {
      const res = await api.runAiVisibilityTest({
        send_email: sendEmail,
        recipient_email: settingsDraft?.recipient_email || undefined
      });
      setDashboard(res.dashboard);
      setSelectedRun(res.run);
      setSettingsDraft(res.dashboard.settings);
      setNotice({
        type: 'ok',
        text: res.message
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Daily AI & Search visibility test failed.'
      });
    } finally {
      setRunningTest(false);
      setSendingEmail(false);
    }
  };

  const handleApplyContentBooster = async () => {
    setBoosting(true);
    setNotice(null);
    try {
      const res = await api.applyAiSeoBooster();
      setDashboard(res.dashboard);
      setSelectedRun(res.run);
      setSettingsDraft(res.dashboard.settings);
      if (onPagesBoosted) {
        onPagesBoosted();
      }
      setNotice({
        type: 'ok',
        text: res.message
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to apply AI & SEO content booster.'
      });
    } finally {
      setBoosting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsDraft) return;
    setSavingSettings(true);
    setNotice(null);
    try {
      const res = await api.saveAiVisibilitySettings(settingsDraft);
      setSettingsDraft(res.settings);
      setDashboard((prev) => (prev ? { ...prev, settings: res.settings } : prev));
      setNotice({
        type: 'ok',
        text: 'Daily AI & Search Engine visibility schedule and domain settings saved.'
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save visibility settings.'
      });
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
        Loading AI &amp; Search Engine Visibility (GEO / SEO) engine...
      </div>
    );
  }

  const run = selectedRun || dashboard?.latestRun;
  const platforms = run?.platforms || [];
  const queries = run?.query_rankings || [];
  const checks = dashboard?.seoComplianceChecklist || [];
  const history = dashboard?.history || [];

  const renderPlatformCard = (platform: AiSearchPlatformResult) => {
    const isAi = platform.category === 'ai_engine';
    return (
      <div
        key={platform.platform_id}
        className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between gap-3"
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    platform.searchable ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {isAi ? 'AI Answer Engine' : 'Search Index'}
                </span>
              </div>
              <h4 className="mt-1 font-display text-sm font-bold text-slate-900">
                {platform.platform_name}
              </h4>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm font-bold text-[#16A34A] tabular-nums">
                {platform.visibility_score}%
              </div>
              <div className="text-[10px] font-semibold text-[var(--gs-primary)]">
                {platform.citation_rank}
              </div>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
            <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
              {platform.searchable ? 'SEARCHABLE & CITED' : 'INDEX PENDING'}
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              Crawler: {platform.crawler_agent}
            </span>
          </div>

          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Verified AI / Search Citation Output
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-700">
              {platform.sample_ai_answer}
            </p>
            <div className="mt-1.5 text-[11px] text-slate-500">{platform.status_note}</div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-2.5">
          <div className="text-[10px] font-semibold text-slate-500 mb-1.5">
            Active Indexing &amp; Grounding Signals
          </div>
          <div className="flex flex-wrap gap-1.5">
            {platform.indexed_signals.map((sig) => (
              <span
                key={sig}
                className="rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] text-slate-600"
              >
                {sig}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--gs-primary)]">
              <Sparkles className="h-4 w-4" />
              <span>AI Platform &amp; Search Engine Visibility (GEO + SEO Command Center)</span>
            </div>
            <h2 className="mt-1 font-display text-lg sm:text-xl font-bold text-slate-900">
              Daily Searchability Verification &amp; #1 Service Citation Optimizer
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 max-w-3xl">
              Continuously verifies whether <strong>git-stack.org</strong> is searchable and cited
              across ChatGPT Search, Google AI Overviews / Gemini, Perplexity AI, Claude Web Search,
              Microsoft Copilot, Google Organic, and Bing/DuckDuckGo—and optimizes your public pages,{' '}
              <code className="font-mono text-[11px]">/llms.txt</code>,{' '}
              <code className="font-mono text-[11px]">/llms-full.txt</code>, and{' '}
              <code className="font-mono text-[11px]">Schema.org</code> to rank #1 for all 5
              consulting services.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => handleRunTestNow(false)}
              disabled={runningTest || sendingEmail || boosting}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${runningTest ? 'animate-spin' : ''}`} />
              <span>
                {runningTest ? 'Testing All 7 Platforms...' : 'Run Daily AI & Search Test Now'}
              </span>
            </button>

            {canManage && (
              <button
                type="button"
                onClick={handleApplyContentBooster}
                disabled={boosting || runningTest}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>
                  {boosting
                    ? 'Boosting Site Content & Schema...'
                    : 'Apply AI & SEO Top-Ranking Booster'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleRunTestNow(true)}
              disabled={sendingEmail || runningTest}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 px-3.5 py-2 text-xs font-semibold text-[var(--gs-primary)] hover:bg-indigo-100/70 disabled:opacity-60"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>{sendingEmail ? 'Dispatching...' : 'Email Daily Report to Lark'}</span>
            </button>
          </div>
        </div>

        {notice && (
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-xs font-medium ${
              notice.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {notice.text}
          </div>
        )}

        {/* KPI Strip */}
        {run && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="text-[11px] font-medium text-slate-500">Overall Visibility Score</div>
              <div className="mt-1 font-display text-2xl font-bold text-[#16A34A] tabular-nums">
                {run.overall_score}%
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                Run Date: <span className="font-mono">{run.run_date}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="text-[11px] font-medium text-slate-500">AI Answer Citation Score</div>
              <div className="mt-1 font-display text-2xl font-bold text-[var(--gs-primary)] tabular-nums">
                {run.ai_citation_score}%
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                ChatGPT · Gemini · Perplexity · Claude
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="text-[11px] font-medium text-slate-500">SEO Search Engine Score</div>
              <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                {run.seo_authority_score}%
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                Google Organic · Bing · DuckDuckGo
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="text-[11px] font-medium text-slate-500">Searchable Platforms</div>
              <div className="mt-1 font-display text-2xl font-bold text-[#16A34A] tabular-nums">
                {run.searchable_platforms_count}/{run.total_platforms_count}
              </div>
              <div className="mt-0.5 text-[11px] text-emerald-700 font-medium">
                100% Crawlable &amp; Indexed
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="text-[11px] font-medium text-slate-500">#1 Cited Service Queries</div>
              <div className="mt-1 font-display text-2xl font-bold text-[var(--gs-primary)] tabular-nums">
                {run.top_ranked_services_count}/{queries.length}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                All 5 Consulting Services
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'platforms', label: `AI & Search Platforms (${platforms.length})`, icon: Bot },
            { id: 'queries', label: `Service Query Rankings (${queries.length})`, icon: TrendingUp },
            {
              id: 'compliance',
              label: `GEO / SEO Crawl Endpoints (${checks.length})`,
              icon: FileCode2
            },
            {
              id: 'history',
              label: `Daily Test History (${history.length})`,
              icon: Clock
            },
            { id: 'schedule', label: 'Daily Test & Alert Schedule', icon: Search }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`min-h-[38px] inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[var(--gs-primary)] text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <a
            href="/llms-full.txt"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[var(--gs-primary)] hover:underline"
          >
            <span>/llms-full.txt</span>
            <ExternalLink className="h-3 w-3" />
          </a>
          <span>·</span>
          <a
            href="/robots.txt"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[var(--gs-primary)] hover:underline"
          >
            <span>/robots.txt</span>
            <ExternalLink className="h-3 w-3" />
          </a>
          <span>·</span>
          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[var(--gs-primary)] hover:underline"
          >
            <span>/sitemap.xml</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* TAB 1: AI & SEARCH PLATFORMS */}
      {activeTab === 'platforms' && run && (
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-900">
                Executive AI &amp; Search Summary ({run.run_date})
              </div>
              <p className="mt-0.5 text-xs text-slate-700">{run.summary}</p>
            </div>
            <span className="shrink-0 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-mono text-xs font-bold text-emerald-800">
              {run.searchable_platforms_count}/{run.total_platforms_count} PLATFORMS SEARCHABLE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {platforms.map(renderPlatformCard)}
          </div>
        </div>
      )}

      {/* TAB 2: SERVICE QUERY RANKINGS */}
      {activeTab === 'queries' && run && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900">
                Commercial Consulting Queries &amp; AI Citation Rank
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Tracks how ChatGPT, Gemini, Perplexity, and Google rank GitStack when enterprise
                buyers search for your 5 consulting services.
              </p>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={handleApplyContentBooster}
                disabled={boosting}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Boost Entity Density on Public Pages</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Target Buyer Search Query</th>
                  <th className="py-3 px-4">Service Line</th>
                  <th className="py-3 px-4">AI Citation Status</th>
                  <th className="py-3 px-4">Organic SEO Rank</th>
                  <th className="py-3 px-4">Target Route</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {queries.map((q) => (
                  <tr key={q.query} className="hover:bg-slate-50/70 align-top">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div>“{q.query}”</div>
                      <div className="mt-1 text-[11px] font-normal text-slate-500">
                        {q.citation_snippet}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                      {q.service_pillar}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px] font-bold ${
                          q.ai_rank_status === 'Top 1 Cited'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-indigo-200 bg-indigo-50 text-[var(--gs-primary)]'
                        }`}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{q.ai_rank_status}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[#16A34A] whitespace-nowrap">
                      {q.seo_rank_status}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[var(--gs-primary)] whitespace-nowrap">
                      <a href={q.target_route} className="hover:underline">
                        {q.target_route}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: GEO / SEO CRAWL ENDPOINTS & CONTENT OPTIMIZATIONS */}
      {activeTab === 'compliance' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-display text-sm font-bold text-slate-900">
              Technical AI &amp; Search Engine Crawlability Audit
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Live verification of machine-readable discovery endpoints required by OpenAI,
              Google, Perplexity, Anthropic, and Bing crawlers.
            </p>

            <div className="mt-4 space-y-3">
              {checks.map((chk) => {
                const passed = chk.status === 'compliant';
                return (
                  <div
                    key={chk.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2
                          className={`h-4 w-4 shrink-0 ${
                            passed ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        />
                        <span className="text-xs font-bold text-slate-900">{chk.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 pl-6">{chk.detail}</p>
                      <div className="mt-1 pl-6 font-mono text-[11px] text-[var(--gs-primary)]">
                        {chk.endpoint_or_tag}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${
                        passed
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      {passed ? 'COMPLIANT' : 'ACTION'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900">
                Active Website Content &amp; Schema Adjustments Applied
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Optimizations active on <strong>git-stack.org</strong> so AI engines and search
                crawlers rank your consulting services at the top.
              </p>

              <ul className="mt-4 space-y-2.5 text-xs text-slate-700">
                {(run?.content_recommendations || []).map((rec, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-3"
                  >
                    <Globe className="h-4 w-4 text-[var(--gs-primary)] shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {canManage && (
              <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                <div className="text-xs font-bold text-slate-900">
                  Want to refresh public page copy with high-citation AI entity definitions?
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Clicking below updates your Home and Services page configurations with structured
                  SLA metrics (&lt;350ms RAG latency, 99.98% uptime, 38% FinOps reduction) and
                  verified JSON-LD OfferCatalog signals.
                </p>
                <button
                  type="button"
                  onClick={handleApplyContentBooster}
                  disabled={boosting}
                  className="mt-3 min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>
                    {boosting
                      ? 'Applying Content Booster...'
                      : 'Apply AI & SEO Top-Ranking Content Booster'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: DAILY TEST HISTORY */}
      {activeTab === 'history' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="font-display text-sm font-bold text-slate-900">
              Daily AI &amp; Search Visibility Verification Log
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Select any historical run to inspect platform-by-platform searchability and query
              citations.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Run Date</th>
                  <th className="py-3 px-4">Overall Score</th>
                  <th className="py-3 px-4">AI Citation Score</th>
                  <th className="py-3 px-4">SEO Score</th>
                  <th className="py-3 px-4">Searchable Platforms</th>
                  <th className="py-3 px-4">Trigger</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {history.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {r.run_date}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-[#16A34A]">
                      {r.overall_score}%
                    </td>
                    <td className="py-3 px-4 font-mono text-[var(--gs-primary)] font-semibold">
                      {r.ai_citation_score}%
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-800">
                      {r.seo_authority_score}%
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {r.searchable_platforms_count}/{r.total_platforms_count}
                    </td>
                    <td className="py-3 px-4">
                      {r.trigger_type === 'content_boost' ? (
                        <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                          BOOSTED
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] text-slate-500">
                          {r.trigger_type}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRun(r);
                          setActiveTab('platforms');
                        }}
                        className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Inspect Run
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SCHEDULE & SETTINGS */}
      {activeTab === 'schedule' && settingsDraft && (
        <form
          onSubmit={handleSaveSettings}
          className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 max-w-3xl"
        >
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">
              Daily Automated AI &amp; Search Test Schedule
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Configure when the daily AI &amp; Search Engine searchability test executes and where
              the Lark Mail summary report is delivered.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={settingsDraft.daily_test_enabled}
                onChange={(e) =>
                  setSettingsDraft({ ...settingsDraft, daily_test_enabled: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-[var(--gs-primary)]"
              />
              <span>Run Automated Daily Searchability Test</span>
            </label>

            <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={settingsDraft.auto_optimize_llms_txt}
                onChange={(e) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    auto_optimize_llms_txt: e.target.checked
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-[var(--gs-primary)]"
              />
              <span>Auto-Sync JSON-LD &amp; /llms-full.txt on Content Edits</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Daily Test Execution Hour (UTC, 0–23)
              </label>
              <input
                type="number"
                min={0}
                max={23}
                value={settingsDraft.daily_hour_utc}
                onChange={(e) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    daily_hour_utc: Math.max(0, Math.min(23, Number(e.target.value) || 0))
                  })
                }
                className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Daily Report Recipient Email (Lark Mail)
              </label>
              <input
                type="email"
                value={settingsDraft.recipient_email}
                onChange={(e) =>
                  setSettingsDraft({ ...settingsDraft, recipient_email: e.target.value })
                }
                placeholder={dashboard?.resolvedRecipientEmail || 'admin@gitstack.io'}
                className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Target Production Domain
            </label>
            <input
              type="text"
              value={settingsDraft.target_domain}
              onChange={(e) =>
                setSettingsDraft({ ...settingsDraft, target_domain: e.target.value })
              }
              className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-slate-500">
              Last automated run date:{' '}
              <span className="font-mono font-semibold text-slate-700">
                {settingsDraft.last_run_date || 'Ready'}
              </span>
            </div>
            <button
              type="submit"
              disabled={savingSettings || !canManage}
              className="min-h-[40px] rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
            >
              {savingSettings ? 'Saving...' : 'Save Visibility Schedule'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
