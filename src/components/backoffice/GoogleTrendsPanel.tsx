import {
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Mail,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  XCircle
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.ts';
import type {
  GoogleTrendsDashboardResponse,
  TrendApprovalBundle
} from '../../shared/types.ts';
import { GrowthEmailModuleCard } from './GrowthEmailModuleCard.tsx';

type TrendsSubTab = 'monitor' | 'approval' | 'published' | 'email';

interface GoogleTrendsPanelProps {
  onArticlePublished?: () => void;
  onOpenMarketing?: () => void;
}

function sourceModeLabel(
  mode: GoogleTrendsDashboardResponse['feedSourceMode']
): string {
  if (mode === 'google_trends_rss') return 'Google Trends Live RSS';
  if (mode === 'google_search_grounding') return 'Google Search Grounding';
  return 'GitStack Trend Radar';
}

export function GoogleTrendsPanel({
  onArticlePublished,
  onOpenMarketing
}: GoogleTrendsPanelProps) {
  const [subTab, setSubTab] = useState<TrendsSubTab>('monitor');
  const [region, setRegion] = useState('PH');
  const [dashboard, setDashboard] = useState<GoogleTrendsDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [generatingTrendId, setGeneratingTrendId] = useState<string | null>(null);
  const [reviewingAction, setReviewingAction] = useState<string | null>(null);
  const [selectedBundleId, setSelectedBundleId] = useState<string>('');
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Editable Approval Review fields
  const [editTitle, setEditTitle] = useState('');
  const [editMarkdown, setEditMarkdown] = useState('');
  const [editFbCaption, setEditFbCaption] = useState('');
  const [editTtCaption, setEditTtCaption] = useState('');
  const [reviewNote, setReviewNote] = useState('');

  const loadDashboard = useCallback(async (targetRegion?: string) => {
    setLoading(true);
    try {
      const data = await api.getGoogleTrendsDashboard(targetRegion);
      setDashboard(data);
      if (data.region) setRegion(data.region);
      if (data.approvalQueue.length) {
        setSelectedBundleId((prev) =>
          data.approvalQueue.some((b) => b.id === prev) ? prev : data.approvalQueue[0].id
        );
      }
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load Google Trends monitor.'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const approvalQueue = dashboard?.approvalQueue || [];
  const selectedBundle: TrendApprovalBundle | null = useMemo(
    () => approvalQueue.find((b) => b.id === selectedBundleId) || approvalQueue[0] || null,
    [approvalQueue, selectedBundleId]
  );

  useEffect(() => {
    if (!selectedBundle) return;
    setEditTitle(selectedBundle.articleDraft.title);
    setEditMarkdown(selectedBundle.articleDraft.content_markdown);
    setEditFbCaption(selectedBundle.facebookPost.caption);
    setEditTtCaption(selectedBundle.tiktokPost.caption);
    setReviewNote(selectedBundle.reviewNote || '');
  }, [selectedBundle]);

  const handleScanTrends = async (nextRegion = region) => {
    setScanning(true);
    setNotice(null);
    try {
      const data = await api.scanGoogleTrends(nextRegion);
      setDashboard(data);
      setNotice({
        type: 'ok',
        text: `Monitored ${data.trends.length} live rising trends for ${data.region} via ${sourceModeLabel(data.feedSourceMode)}.`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to scan Google Trends.'
      });
    } finally {
      setScanning(false);
    }
  };

  const handleGenerateBundle = async (trendId: string, trendTitle: string) => {
    setGeneratingTrendId(trendId);
    setNotice(null);
    try {
      const res = await api.generateTrendBundle({
        trendId,
        trendTitle,
        region
      });
      setDashboard(res.dashboard);
      setSelectedBundleId(res.bundle.id);
      setSubTab('approval');
      setNotice({
        type: 'ok',
        text: `Drafted ${res.bundle.articleDraft.word_count.toLocaleString()}-word article + Facebook & TikTok promo bundle. Review & approve below before publishing.`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to generate trend conversion bundle.'
      });
    } finally {
      setGeneratingTrendId(null);
    }
  };

  const handleReviewAction = async (
    action: 'publish_article' | 'queue_social' | 'publish_social_now' | 'reject'
  ) => {
    if (!selectedBundle) return;
    setReviewingAction(action);
    setNotice(null);
    try {
      const res = await api.reviewTrendBundle(selectedBundle.id, {
        action,
        reviewNote: reviewNote.trim() || undefined,
        articleTitle: editTitle,
        articleMarkdown: editMarkdown,
        facebookCaption: editFbCaption,
        tiktokCaption: editTtCaption
      });
      setDashboard(res.dashboard);
      setNotice({ type: 'ok', text: res.message });
      if (action === 'publish_article') {
        onArticlePublished?.();
      }
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Action failed.'
      });
    } finally {
      setReviewingAction(null);
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500">
        Loading Google Trends Monitor &amp; Mandatory Approval Queue...
      </div>
    );
  }

  const pendingCount = dashboard?.stats.pendingApprovalCount ?? 0;
  const publishedBundles = approvalQueue.filter(
    (b) => b.publishedArticleSlug || (b.queuedMarketingIds && b.queuedMarketingIds.length > 0)
  );

  return (
    <div className="space-y-6">
      {/* Header & Region Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-[var(--gs-primary)]">
              Google Trends Live Radar · Mandatory Human Approval Gate · Dual Article + Social Agent
            </div>
            <h2 className="mt-1 font-display text-lg font-bold text-slate-900">
              Google Trends Monitor &amp; Approval Queue
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 max-w-2xl">
              Track rising Google Trends topics, auto-draft 1,500+ word AdSense-safe articles and
              Facebook/TikTok posts linking to your GitStack app, <code>/demo</code> signup, and{' '}
              <code>/contact</code> consultation — with mandatory approval before anything publishes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="min-h-[42px] rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-xs font-semibold text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
            >
              <option value="PH">Philippines (PH)</option>
              <option value="US">United States (US)</option>
              <option value="SG">Singapore (SG)</option>
              <option value="GLOBAL">Global Remote</option>
            </select>
            <button
              type="button"
              onClick={() => handleScanTrends(region)}
              disabled={scanning}
              className="min-h-[42px] inline-flex items-center gap-2 rounded-lg bg-[var(--gs-primary)] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-4 w-4 shrink-0 ${scanning ? 'animate-spin' : ''}`} />
              <span>{scanning ? 'Scanning Trends...' : 'Scan Google Trends Now'}</span>
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="text-[11px] font-medium text-slate-500">Monitored Trends</div>
            <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {dashboard?.stats.monitoredCount ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500 truncate">
              {dashboard ? sourceModeLabel(dashboard.feedSourceMode) : 'Ready'}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="text-[11px] font-medium text-slate-500">Pending Your Approval</div>
            <div
              className={`mt-1 font-display text-2xl font-bold tabular-nums ${
                pendingCount > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {pendingCount}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Blocked until approved</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="text-[11px] font-medium text-slate-500">Published Campaigns</div>
            <div className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums">
              {dashboard?.stats.publishedBundlesCount ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Site articles &amp; social</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="text-[11px] font-medium text-slate-500">Duplicate Protection</div>
            <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {dashboard?.stats.alreadyCoveredCount ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Already-covered flagged</div>
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
            {
              id: 'monitor',
              label: `Live Trends Monitor (${dashboard?.trends.length ?? 0})`,
              icon: TrendingUp
            },
            {
              id: 'approval',
              label: `Approval Queue (${pendingCount} pending)`,
              icon: ClipboardCheck
            },
            {
              id: 'published',
              label: `Published Campaigns (${publishedBundles.length})`,
              icon: CheckCircle2
            },
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

      {/* TAB 1: LIVE GOOGLE TRENDS MONITOR */}
      {subTab === 'monitor' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(dashboard?.trends || []).map((trend) => (
            <div
              key={trend.id}
              className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold text-[var(--gs-primary)]">
                    {trend.servicePillar} · {trend.region}
                  </span>
                  <span
                    className={`font-semibold ${
                      trend.alreadyCovered ? 'text-slate-500' : 'text-emerald-700'
                    }`}
                  >
                    {trend.alreadyCovered ? 'Already Covered' : trend.trafficLabel}
                  </span>
                </div>
                <h3 className="mt-1.5 font-display text-base font-bold text-slate-900">
                  {trend.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  {trend.whyItConverts}
                </p>

                {trend.relatedQueries.length > 0 && (
                  <div className="mt-3 text-[11px] text-slate-500">
                    Related searches:{' '}
                    <span className="text-slate-700">
                      {trend.relatedQueries.slice(0, 4).join(' · ')}
                    </span>
                  </div>
                )}

                {trend.sources.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
                    {trend.sources.slice(0, 2).map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-[var(--gs-primary)] hover:underline"
                      >
                        <span className="truncate max-w-[200px]">{src.title}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={trend.alreadyCovered || generatingTrendId === trend.id}
                onClick={() => handleGenerateBundle(trend.id, trend.title)}
                className="min-h-[40px] w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {trend.alreadyCovered
                    ? 'Already Covered on Site (Blocked from Repost)'
                    : generatingTrendId === trend.id
                      ? 'Drafting Article + FB & TikTok Bundle...'
                      : 'Generate Article + Social Approval Bundle'}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: MANDATORY APPROVAL QUEUE */}
      {subTab === 'approval' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-amber-700" />
            <div>
              <strong>Mandatory Human Approval Gate Active:</strong> Trend-generated website
              articles and Facebook/TikTok posts remain paused in this queue until you review the
              copy, verify your GitStack <code>/demo</code> &amp; <code>/contact</code> links, and
              explicitly click an Approve button below.
            </div>
          </div>

          {approvalQueue.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500">
              No trend bundles waiting in the Approval Queue yet. Go to{' '}
              <strong>Live Trends Monitor</strong> and generate a dual Article + Social bundle from
              any rising trend.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Queue List */}
              <div className="lg:col-span-4 space-y-2.5 min-w-0">
                {approvalQueue.map((bundle) => {
                  const active = selectedBundle?.id === bundle.id;
                  return (
                    <button
                      key={bundle.id}
                      type="button"
                      onClick={() => setSelectedBundleId(bundle.id)}
                      className={`w-full text-left rounded-xl border p-4 transition-colors ${
                        active
                          ? 'border-[var(--gs-primary)] bg-[var(--gs-soft-bg)]/50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-mono text-slate-500">{bundle.region}</span>
                        <span
                          className={`font-semibold capitalize ${
                            bundle.status === 'published'
                              ? 'text-emerald-700'
                              : bundle.status === 'rejected'
                                ? 'text-red-700'
                                : bundle.status === 'approved'
                                  ? 'text-[var(--gs-primary)]'
                                  : 'text-amber-700'
                          }`}
                        >
                          {bundle.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="mt-1 font-display text-sm font-bold text-slate-900 line-clamp-2">
                        {bundle.trendTitle}
                      </div>
                      <div className="mt-1.5 text-[11px] text-slate-500 tabular-nums">
                        {bundle.articleDraft.word_count.toLocaleString()} words · AdSense{' '}
                        {bundle.articleDraft.quality_score}% · GEO {bundle.articleDraft.geo_score}%
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Inspection & Approval Workspace */}
              <div className="lg:col-span-8 min-w-0">
                {selectedBundle && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                      <div>
                        <div className="text-[11px] font-semibold text-[var(--gs-primary)]">
                          Trend Conversion Bundle · {selectedBundle.region} ·{' '}
                          {selectedBundle.status.replace('_', ' ').toUpperCase()}
                        </div>
                        <h3 className="mt-1 font-display text-base font-bold text-slate-900">
                          {selectedBundle.trendTitle}
                        </h3>
                        <div className="mt-1 text-[11px] text-slate-600">
                          Wired CTAs:{' '}
                          <span className="font-mono text-slate-800">
                            {selectedBundle.ctaLinks.signupDemoUrl}
                          </span>{' '}
                          ·{' '}
                          <span className="font-mono text-slate-800">
                            {selectedBundle.ctaLinks.contactServiceUrl}
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-[11px] font-mono tabular-nums text-slate-600">
                        <div>{selectedBundle.articleDraft.word_count.toLocaleString()} words</div>
                        <div className="text-emerald-700 font-semibold">
                          AdSense {selectedBundle.articleDraft.quality_score}% · GEO{' '}
                          {selectedBundle.articleDraft.geo_score}%
                        </div>
                      </div>
                    </div>

                    {/* Website Article Draft */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                          <FileText className="h-4 w-4 text-[var(--gs-primary)]" />
                          <span>1. Website Pillar Article Draft (Editable Before Publish)</span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {selectedBundle.articleDraft.faqs.length} FAQs ·{' '}
                          {selectedBundle.articleDraft.references.length} verified sources
                        </span>
                      </div>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-xs font-semibold text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                      />
                      <textarea
                        rows={8}
                        value={editMarkdown}
                        onChange={(e) => setEditMarkdown(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs font-mono text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                      />
                    </div>

                    {/* Social Media Posts (FB + TikTok) */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-[#1877F2]">
                          2. Facebook Page Promotional Post
                        </div>
                        <textarea
                          rows={5}
                          value={editFbCaption}
                          onChange={(e) => setEditFbCaption(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                        />
                        <div className="text-[11px] text-slate-500 truncate">
                          {selectedBundle.facebookPost.hashtags.join(' ')}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-bold text-slate-900">
                          3. TikTok Short Caption &amp; Hook
                        </div>
                        <textarea
                          rows={5}
                          value={editTtCaption}
                          onChange={(e) => setEditTtCaption(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                        />
                        <div className="text-[11px] text-slate-500 truncate">
                          Hook: {selectedBundle.tiktokPost.hook}
                        </div>
                      </div>
                    </div>

                    {/* Review Note */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600">
                        Operator Approval Note (optional)
                      </label>
                      <input
                        type="text"
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="e.g. Approved for PH SME lead generation campaign"
                        className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                      />
                    </div>

                    {/* Explicit Approval Action Bar */}
                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
                      <button
                        type="button"
                        disabled={Boolean(reviewingAction) || Boolean(selectedBundle.publishedArticleSlug)}
                        onClick={() => handleReviewAction('publish_article')}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {selectedBundle.publishedArticleSlug
                            ? 'Article Published'
                            : reviewingAction === 'publish_article'
                              ? 'Publishing Article...'
                              : 'Approve & Publish Website Article'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(reviewingAction)}
                        onClick={() => handleReviewAction('queue_social')}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        <CalendarPlus className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {reviewingAction === 'queue_social'
                            ? 'Queuing...'
                            : 'Approve & Queue to Marketing Plan'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(reviewingAction)}
                        onClick={() => handleReviewAction('publish_social_now')}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        <Send className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {reviewingAction === 'publish_social_now'
                            ? 'Publishing...'
                            : 'Approve & Publish Social Now'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(reviewingAction)}
                        onClick={() => handleReviewAction('reject')}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        <XCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PUBLISHED CAMPAIGNS */}
      {subTab === 'published' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h3 className="font-display text-sm font-bold text-slate-900">
              Approved &amp; Published Trend Campaigns ({publishedBundles.length})
            </h3>
            {onOpenMarketing && (
              <button
                type="button"
                onClick={onOpenMarketing}
                className="text-xs font-semibold text-[var(--gs-primary)] hover:underline"
              >
                Open Marketing Schedule
              </button>
            )}
          </div>
          {publishedBundles.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-slate-500">
              No trend bundles have been approved and published yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {publishedBundles.map((b) => (
                <div
                  key={b.id}
                  className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/60"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900">{b.trendTitle}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {b.publishedArticleSlug ? `Website Article: /insights/${b.publishedArticleSlug}` : 'Article not published'} ·{' '}
                      {b.queuedMarketingIds?.length
                        ? `${b.queuedMarketingIds.length} social post(s) dispatched/queued`
                        : 'Social pending'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {b.publishedArticleSlug && (
                      <a
                        href={`/insights/${b.publishedArticleSlug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[var(--gs-primary)] hover:underline"
                      >
                        <span>View Live Article</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DEDICATED EMAIL MODULE */}
      {subTab === 'email' && dashboard && (
        <GrowthEmailModuleCard
          moduleKey="google_trends"
          moduleTitle="Google Trends Monitor"
          description="Receive rising Google Trends opportunities, pending approval queue alerts, and published trend campaign summaries via Lark Mail SMTP."
          config={dashboard.emailConfig}
          logs={dashboard.emailLogs}
          onSaveConfig={async (patch) => {
            const res = await api.saveGoogleTrendsEmailConfig(patch);
            setDashboard((prev) => (prev ? { ...prev, emailConfig: res.emailConfig } : prev));
          }}
          onSendNow={async (recipient) => {
            const res = await api.sendGoogleTrendsEmailReport(recipient);
            setDashboard(res.dashboard);
            return { delivered: res.delivered, message: res.message };
          }}
        />
      )}
    </div>
  );
}
