import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  KeyRound,
  Link2,
  Mail,
  Monitor,
  RefreshCw,
  Search,
  Smartphone,
  Sparkles,
  XCircle
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.ts';
import type {
  SearchConsoleDashboardResponse,
  SearchConsoleUrlAudit
} from '../../shared/types.ts';
import { GrowthEmailModuleCard } from './GrowthEmailModuleCard.tsx';

type SearchConsoleSubTab = 'links' | 'serp_ai' | 'gsc_api' | 'email';

export function SearchConsolePanel() {
  const [subTab, setSubTab] = useState<SearchConsoleSubTab>('links');
  const [dashboard, setDashboard] = useState<SearchConsoleDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [analyzingPath, setAnalyzingPath] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>('/');
  const [serpDevice, setSerpDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'core_page' | 'article' | 'legal_page'>('all');
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Optional GSC API Vault Form
  const [gscSiteUrl, setGscSiteUrl] = useState('https://git-stack.org/');
  const [gscServiceJson, setGscServiceJson] = useState('');
  const [savingGsc, setSavingGsc] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getSearchConsoleDashboard();
      setDashboard(data);
      if (data.gscSiteUrl) setGscSiteUrl(data.gscSiteUrl);
      if (data.latestRun?.urls?.length) {
        setSelectedPath((prev) =>
          data.latestRun!.urls.some((u) => u.path === prev) ? prev : data.latestRun!.urls[0].path
        );
      }
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load Search Console dashboard.'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleScanAllLinks = async () => {
    setScanning(true);
    setNotice(null);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const res = await api.scanSearchConsoleLinks(origin);
      setDashboard(res.dashboard);
      if (res.run.urls.length && !res.run.urls.some((u) => u.path === selectedPath)) {
        setSelectedPath(res.run.urls[0].path);
      }
      setNotice({
        type: 'ok',
        text: `Audited ${res.run.totalLinks} website URLs (${res.run.searchableLinks} searchable across engines · avg SEO ${res.run.avgSeoScore}/100).`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to scan website links.'
      });
    } finally {
      setScanning(false);
    }
  };

  const handleAnalyzeUrlWithAi = async (targetPath: string) => {
    setAnalyzingPath(targetPath);
    setNotice(null);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const res = await api.analyzeSearchConsoleUrl(targetPath, origin);
      setDashboard((prev) => {
        if (!prev?.latestRun) return prev;
        return {
          ...prev,
          latestRun: {
            ...prev.latestRun,
            urls: prev.latestRun.urls.map((u) => (u.path === targetPath ? res.url : u))
          }
        };
      });
      setSelectedPath(targetPath);
      setSubTab('serp_ai');
      setNotice({
        type: 'ok',
        text: `AI SEO optimization report generated for ${targetPath}.`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to run AI SEO analysis.'
      });
    } finally {
      setAnalyzingPath(null);
    }
  };

  const handleSaveGscApi = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGsc(true);
    setNotice(null);
    try {
      const res = await api.saveIntegration('google_search_console', {
        secret: gscServiceJson.trim() || undefined,
        configMeta: {
          gsc_site_url: gscSiteUrl.trim()
        }
      });
      setGscServiceJson('');
      setNotice({
        type: res.testResult.ok ? 'ok' : 'err',
        text: res.testResult.message || 'Google Search Console API credentials saved.'
      });
      await loadDashboard();
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to save GSC API credentials.'
      });
    } finally {
      setSavingGsc(false);
    }
  };

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1800);
  };

  const urls = dashboard?.latestRun?.urls || [];
  const filteredUrls = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return urls.filter((u) => {
      if (typeFilter !== 'all' && u.pageType !== typeFilter) return false;
      if (!q) return true;
      return (
        u.path.toLowerCase().includes(q) ||
        u.title.toLowerCase().includes(q) ||
        u.primaryKeyword.toLowerCase().includes(q)
      );
    });
  }, [urls, searchQuery, typeFilter]);

  const selectedUrl: SearchConsoleUrlAudit | null = useMemo(
    () => urls.find((u) => u.path === selectedPath) || urls[0] || null,
    [urls, selectedPath]
  );

  if (loading && !dashboard) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500">
        Loading Google Search Console &amp; Multi-Engine URL Auditor...
      </div>
    );
  }

  const run = dashboard?.latestRun;

  return (
    <div className="space-y-6">
      {/* Header & Top Action Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-[var(--gs-primary)]">
              Google Search Console · Multi-Engine Indexability · AI SEO Optimizer
            </div>
            <h2 className="mt-1 font-display text-lg font-bold text-slate-900">
              Website Link Searchability, Live SERP Preview &amp; Ranking Analyzer
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 max-w-2xl">
              Test every public page and article link across Google, Bing/DuckDuckGo, Yahoo, and AI
              Search engines, preview exact Google search snippets, inspect search keywords, and run
              AI optimization checks to rank at the top.
            </p>
          </div>
          <button
            type="button"
            onClick={handleScanAllLinks}
            disabled={scanning}
            className="min-h-[42px] inline-flex items-center gap-2 rounded-lg bg-[var(--gs-primary)] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-4 w-4 shrink-0 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Testing All Website Links...' : 'Scan All Website Links'}</span>
          </button>
        </div>

        {/* KPI Strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="text-[11px] font-medium text-slate-500">Total Website Links</div>
            <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {run?.totalLinks ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Core, legal &amp; articles</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="text-[11px] font-medium text-slate-500">Searchable Links</div>
            <div className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums">
              {run ? `${run.searchableLinks}/${run.totalLinks}` : '—'}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">HTTP 200 · Indexable</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="text-[11px] font-medium text-slate-500">Average SEO Score</div>
            <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {run ? `${run.avgSeoScore}/100` : '—'}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {dashboard?.gscConnected ? 'Live GSC API synced' : 'Live SSR HTML audit'}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="text-[11px] font-medium text-slate-500">Optimization Flags</div>
            <div
              className={`mt-1 font-display text-2xl font-bold tabular-nums ${
                (run?.issueCount ?? 0) === 0 ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {run?.issueCount ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {run?.scannedAt ? `Scanned ${new Date(run.scannedAt).toLocaleTimeString()}` : 'Ready'}
            </div>
          </div>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-medium ${
            notice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {(
          [
            { id: 'links', label: `All Website Links (${urls.length})`, icon: Link2 },
            { id: 'serp_ai', label: 'SERP Preview & AI Analyzer', icon: Sparkles },
            { id: 'gsc_api', label: 'Optional GSC API', icon: KeyRound },
            { id: 'email', label: 'Email Module', icon: Mail }
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[var(--gs-primary)] text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ALL WEBSITE LINKS TABLE */}
      {subTab === 'links' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by URL path, title, or keyword..."
                className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'core_page', label: 'Core Pages' },
                  { id: 'article', label: 'Articles' },
                  { id: 'legal_page', label: 'Legal' }
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTypeFilter(opt.id)}
                  className={`min-h-[34px] rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                    typeFilter === opt.id
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="px-4 py-3">URL Path &amp; Title</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Searchability</th>
                  <th className="px-4 py-3">Primary Keyword</th>
                  <th className="px-4 py-3 text-right">Words</th>
                  <th className="px-4 py-3 text-right">SEO Score</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUrls.map((row) => {
                  const searchableCount = row.engineVerdicts.filter((e) => e.searchable).length;
                  return (
                    <tr key={row.path} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 max-w-[340px]">
                        <div className="font-mono text-[11px] font-semibold text-[var(--gs-primary)] truncate">
                          {row.path}
                        </div>
                        <div className="mt-0.5 text-xs font-medium text-slate-900 truncate">
                          {row.title || '(Missing title tag)'}
                        </div>
                        {row.issues.length > 0 && (
                          <div className="mt-0.5 text-[11px] text-amber-700 truncate">
                            {row.issues[0]}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-600 whitespace-nowrap">
                        {row.pageType === 'article'
                          ? 'Article'
                          : row.pageType === 'legal_page'
                            ? 'Legal'
                            : 'Core Page'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div
                          className={`inline-flex items-center gap-1 font-semibold ${
                            row.indexable ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {row.indexable ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="tabular-nums">
                            {searchableCount}/{row.engineVerdicts.length} engines
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          HTTP {row.httpStatus} · {row.robotsDirective}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-800 max-w-[180px] truncate">
                        {row.primaryKeyword || '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                        {row.wordCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">
                        <span
                          className={
                            row.seoScore >= 85
                              ? 'text-emerald-700'
                              : row.seoScore >= 70
                                ? 'text-amber-700'
                                : 'text-red-700'
                          }
                        >
                          {row.seoScore}/100
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPath(row.path);
                            setSubTab('serp_ai');
                          }}
                          className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                        >
                          <span>Inspect SERP &amp; AI</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SERP PREVIEW, KEYWORDS & AI SEO ANALYZER */}
      {subTab === 'serp_ai' && selectedUrl && (
        <div className="space-y-6">
          {/* URL Selector Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex-1 min-w-[240px]">
              <label className="block text-[11px] font-semibold text-slate-500">
                Inspecting Website URL
              </label>
              <select
                value={selectedUrl.path}
                onChange={(e) => setSelectedPath(e.target.value)}
                className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-xs font-medium text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
              >
                {urls.map((u) => (
                  <option key={u.path} value={u.path}>
                    {u.path} — {u.title.slice(0, 65)} ({u.seoScore}/100)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-4 sm:pt-0">
              <a
                href={selectedUrl.path}
                target="_blank"
                rel="noreferrer"
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span>Open Live Page</span>
              </a>
              <button
                type="button"
                onClick={() => handleAnalyzeUrlWithAi(selectedUrl.path)}
                disabled={analyzingPath === selectedUrl.path}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {analyzingPath === selectedUrl.path
                    ? 'AI Analyzing Page...'
                    : 'Run AI Top-Rank Analyzer'}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left 7 cols: Live Google SERP Preview + Multi-Engine Matrix + Keywords */}
            <div className="space-y-6 lg:col-span-7 min-w-0">
              {/* Authentic Google SERP Preview */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      How This Link Looks in Google Search
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Title {selectedUrl.titleLength} chars (ideal 35–65) · Meta Description{' '}
                      {selectedUrl.metaDescriptionLength} chars (ideal 115–165)
                    </p>
                  </div>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    <button
                      type="button"
                      onClick={() => setSerpDevice('desktop')}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                        serpDevice === 'desktop'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      <Monitor className="h-3 w-3" />
                      <span>Desktop</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSerpDevice('mobile')}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                        serpDevice === 'mobile'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      <Smartphone className="h-3 w-3" />
                      <span>Mobile</span>
                    </button>
                  </div>
                </div>

                {/* SERP Card */}
                <div
                  className={`mt-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 ${
                    serpDevice === 'mobile' ? 'max-w-[380px] mx-auto' : 'w-full'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-bold text-[var(--gs-primary)] shrink-0">
                      GS
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-900 truncate">GitStack</div>
                      <div className="text-[11px] text-slate-600 truncate">
                        {selectedUrl.canonicalUrl || selectedUrl.fullUrl}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-lg leading-snug font-normal text-[#1a0dab] hover:underline cursor-pointer break-words">
                    {selectedUrl.title || 'Untitled Page — GitStack'}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#4d5156] break-words">
                    {selectedUrl.metaDescription ||
                      'No meta description tag detected. Search engines will auto-generate a snippet from page body text.'}
                  </p>
                  {selectedUrl.schemaTypes.length > 0 && (
                    <div className="mt-2.5 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                      Structured Rich Data: {selectedUrl.schemaTypes.join(' · ')} ·{' '}
                      {selectedUrl.wordCount.toLocaleString()} words · {selectedUrl.internalLinksCount}{' '}
                      internal links
                    </div>
                  )}
                </div>
              </div>

              {/* Multi-Engine Searchability Matrix */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Searchability Across Google &amp; Other Search Engines
                </h3>
                <div className="mt-3 divide-y divide-slate-100">
                  {selectedUrl.engineVerdicts.map((ev) => (
                    <div
                      key={ev.engine}
                      className="py-3 flex flex-wrap items-start justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                          <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{ev.engine}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                          {ev.reason}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold whitespace-nowrap shrink-0 ${
                          ev.searchable ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {ev.statusLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Keywords Table */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5">
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Search Keywords Detected for This Page
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Primary Keyword: <strong className="text-slate-800">{selectedUrl.primaryKeyword}</strong>
                    </p>
                  </div>
                  {selectedUrl.gscMetrics && (
                    <div className="text-[11px] font-mono tabular-nums text-emerald-700 font-semibold">
                      GSC 28d: {selectedUrl.gscMetrics.clicks} clicks ·{' '}
                      {selectedUrl.gscMetrics.impressions} imp · Pos {selectedUrl.gscMetrics.avgPosition}
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                        <th className="px-4 py-2.5">Keyword / Query</th>
                        <th className="px-4 py-2.5">Source</th>
                        <th className="px-4 py-2.5 text-right">Count / Imp</th>
                        <th className="px-4 py-2.5 text-right">Density / Pos</th>
                        <th className="px-4 py-2.5">Placement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedUrl.keywords.map((kw, idx) => (
                        <tr key={`${kw.keyword}-${idx}`} className="hover:bg-slate-50/60">
                          <td className="px-4 py-2.5 font-medium text-slate-900">{kw.keyword}</td>
                          <td className="px-4 py-2.5 text-[11px] text-slate-500">
                            {kw.source === 'gsc_live' ? 'Live GSC' : 'On-Page'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                            {kw.source === 'gsc_live'
                              ? `${kw.impressions ?? 0} imp`
                              : `${kw.occurrences}x`}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                            {kw.source === 'gsc_live'
                              ? `Pos ${kw.position ?? '—'}`
                              : `${kw.densityPercent}%`}
                          </td>
                          <td className="px-4 py-2.5 text-[11px] text-slate-600">
                            {[
                              kw.inTitle ? 'Title' : null,
                              kw.inH1 ? 'H1' : null,
                              kw.inMeta ? 'Meta' : null
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Body copy'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right 5 cols: AI SEO Improvement Recommendations */}
            <div className="space-y-6 lg:col-span-5 min-w-0">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <div className="text-[11px] font-semibold text-[var(--gs-primary)]">
                      AI Ranking Advisor
                    </div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      How to Rank #1 on Search Engines
                    </h3>
                  </div>
                  {selectedUrl.aiAnalysis && (
                    <span className="text-[11px] font-semibold text-emerald-700">
                      {selectedUrl.aiAnalysis.estimatedImpact} Impact
                    </span>
                  )}
                </div>

                {selectedUrl.aiAnalysis ? (
                  <div className="mt-4 space-y-4 text-xs">
                    <p className="leading-relaxed text-slate-700">
                      {selectedUrl.aiAnalysis.summary}
                    </p>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-slate-500">
                            Recommended High-CTR Title
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy('ai-title', selectedUrl.aiAnalysis!.recommendedTitle)
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--gs-primary)]"
                          >
                            {copiedKey === 'ai-title' ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            <span>{copiedKey === 'ai-title' ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <div className="mt-1 font-medium text-slate-900">
                          {selectedUrl.aiAnalysis.recommendedTitle}
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-slate-500">
                            Recommended Meta Description
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                'ai-desc',
                                selectedUrl.aiAnalysis!.recommendedMetaDescription
                              )
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--gs-primary)]"
                          >
                            {copiedKey === 'ai-desc' ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            <span>{copiedKey === 'ai-desc' ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <div className="mt-1 text-slate-700 leading-relaxed">
                          {selectedUrl.aiAnalysis.recommendedMetaDescription}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Priority Keywords to Add
                      </div>
                      <div className="mt-1.5 text-xs font-medium text-slate-800 leading-relaxed">
                        {selectedUrl.aiAnalysis.priorityKeywordsToAdd.join(' · ')}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Content Improvements
                      </div>
                      <ol className="mt-1.5 list-decimal pl-4 space-y-1.5 text-slate-700 leading-relaxed">
                        {selectedUrl.aiAnalysis.contentImprovements.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ol>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Technical SEO Fixes
                      </div>
                      <ul className="mt-1.5 list-disc pl-4 space-y-1 text-slate-700 leading-relaxed">
                        {selectedUrl.aiAnalysis.technicalFixes.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Internal Link Targets
                      </div>
                      <ul className="mt-1.5 list-disc pl-4 space-y-1 text-slate-700 leading-relaxed">
                        {selectedUrl.aiAnalysis.internalLinkSuggestions.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                      Analyzed {new Date(selectedUrl.aiAnalysis.analyzedAt).toLocaleString()} ·{' '}
                      {selectedUrl.aiAnalysis.modelUsed}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <p className="text-xs leading-relaxed text-slate-600">
                      Click <strong>Run AI Top-Rank Analyzer</strong> above to generate tailored
                      title, meta description, semantic keyword, and content upgrades specifically for{' '}
                      <span className="font-mono text-slate-900">{selectedUrl.path}</span>.
                    </p>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-700">
                        Immediate Automated Audit Checklist
                      </div>
                      {selectedUrl.issues.length > 0 && (
                        <div className="space-y-1">
                          {selectedUrl.issues.map((issue, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-2 text-xs text-amber-800"
                            >
                              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              <span>{issue}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-700">
                        {selectedUrl.quickSuggestions.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OPTIONAL GOOGLE SEARCH CONSOLE API */}
      {subTab === 'gsc_api' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 max-w-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <div className="text-xs font-semibold text-[var(--gs-primary)]">
                Optional Live Search Analytics API
              </div>
              <h3 className="mt-1 font-display text-base font-bold text-slate-900">
                Connect Google Search Console Property
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Link your verified Google Search Console property using a GCP Service Account JSON
                (with <code>webmasters.readonly</code> access) to pull live 28-day clicks,
                impressions, CTR, and top ranking search queries directly into each URL row.
              </p>
            </div>
            <span
              className={`text-xs font-semibold whitespace-nowrap shrink-0 ${
                dashboard?.gscConnected ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              {dashboard?.gscConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>

          <form onSubmit={handleSaveGscApi} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Search Console Site URL or Domain Property
              </label>
              <input
                type="text"
                required
                value={gscSiteUrl}
                onChange={(e) => setGscSiteUrl(e.target.value)}
                placeholder="https://git-stack.org/ or sc-domain:git-stack.org"
                className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-mono text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                GCP Service Account JSON (Encrypted in Server Vault)
              </label>
              <textarea
                rows={6}
                value={gscServiceJson}
                onChange={(e) => setGscServiceJson(e.target.value)}
                placeholder='{"type":"service_account","client_email":"...","private_key":"-----BEGIN PRIVATE KEY-----..."}'
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs font-mono text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
              />
              {dashboard?.gscServiceAccountEmail && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Saved service account:{' '}
                  <span className="font-mono text-slate-700">
                    {dashboard.gscServiceAccountEmail}
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={savingGsc}
                className="min-h-[40px] inline-flex items-center gap-2 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <span>{savingGsc ? 'Verifying & Saving...' : 'Save & Test GSC Connection'}</span>
              </button>
              <p className="text-[11px] text-slate-500">
                Even without GSC API, live SSR URL auditing and AI SEO analysis work 100% automatically.
              </p>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: DEDICATED EMAIL MODULE */}
      {subTab === 'email' && dashboard && (
        <GrowthEmailModuleCard
          moduleKey="search_console"
          moduleTitle="Search Console & SEO"
          description="Email your complete link searchability audit, indexability flags, and top AI SEO opportunities via Lark Mail SMTP."
          config={dashboard.emailConfig}
          logs={dashboard.emailLogs}
          onSaveConfig={async (patch) => {
            const res = await api.saveSearchConsoleEmailConfig(patch);
            setDashboard((prev) => (prev ? { ...prev, emailConfig: res.emailConfig } : prev));
          }}
          onSendNow={async (recipient) => {
            const res = await api.sendSearchConsoleEmailReport(recipient);
            setDashboard(res.dashboard);
            return { delivered: res.delivered, message: res.message };
          }}
        />
      )}
    </div>
  );
}
