import {
  ChevronDown,
  ChevronRight,
  Compass,
  ExternalLink,
  Globe2,
  Link2,
  Mail,
  MapPin,
  Monitor,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import type {
  AnalyticsInterestSegmentItem,
  AnalyticsReferrerDetailItem,
  AnalyticsVisitorJourneyItem
} from '../../shared/types.ts';
import { formatDurationSeconds } from './AnalyticsSharedSections.tsx';

function safeExternalHref(raw?: string): string | null {
  const clean = (raw || '').trim();
  if (!clean) return null;
  try {
    const parsed = new URL(clean);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function formatShortTimestamp(iso: string): string {
  const ms = Date.parse(iso);
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getIdentitySourceLabel(
  source: 'live_chat' | 'inquiry' | 'newsletter' | 'demo_user'
): string {
  switch (source) {
    case 'live_chat':
      return 'Live Website Chat';
    case 'inquiry':
      return 'Consultation Form';
    case 'demo_user':
      return 'Demo Account';
    case 'newsletter':
      return 'Newsletter';
  }
}

function getTriggerBadgeClass(triggerType: string): string {
  switch (triggerType) {
    case 'AI Citation':
      return 'border-indigo-200 bg-indigo-50 text-indigo-700';
    case 'Search Engine':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'Social Post':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    case 'Paid Click ID':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'Email Campaign':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'External Link':
      return 'border-slate-300 bg-slate-100 text-slate-800';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

interface VisitorJourneysPanelProps {
  referrerDetails: AnalyticsReferrerDetailItem[];
  behavioralInterests: AnalyticsInterestSegmentItem[];
  ga4Interests: AnalyticsInterestSegmentItem[];
  visitorJourneys: AnalyticsVisitorJourneyItem[];
  rangeLabel: string;
  ga4Connected: boolean;
}

export function VisitorJourneysPanel({
  referrerDetails,
  behavioralInterests,
  ga4Interests,
  visitorJourneys,
  rangeLabel,
  ga4Connected
}: VisitorJourneysPanelProps) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'identified' | 'external'>('all');
  const [expandedVisitorId, setExpandedVisitorId] = useState<string | null>(null);

  const externalReferrerDomains = useMemo(() => {
    const hosts = new Set<string>();
    for (const r of referrerDetails) {
      if (r.referrerHost && r.referrerHost.toLowerCase() !== 'direct') {
        hosts.add(r.referrerHost.toLowerCase());
      }
    }
    return hosts.size;
  }, [referrerDetails]);

  const attributedTriggerSessions = useMemo(
    () =>
      referrerDetails
        .filter((r) => r.triggerType !== 'Direct')
        .reduce((sum, r) => sum + r.sessions, 0),
    [referrerDetails]
  );

  const identifiedCount = useMemo(
    () => visitorJourneys.filter((v) => Boolean(v.identity)).length,
    [visitorJourneys]
  );

  const combinedInterests = useMemo(() => {
    if (ga4Interests.length === 0) return behavioralInterests;
    const seen = new Set(behavioralInterests.map((b) => b.interest.toLowerCase()));
    const merged = [...behavioralInterests];
    for (const g of ga4Interests) {
      if (!seen.has(g.interest.toLowerCase())) {
        merged.push(g);
      }
    }
    return merged;
  }, [behavioralInterests, ga4Interests]);

  const topPersonaSummary = useMemo(() => {
    if (visitorJourneys.length === 0) return { label: '—', count: 0 };
    const counts = new Map<string, number>();
    for (const v of visitorJourneys) {
      counts.set(v.primaryPersona, (counts.get(v.primaryPersona) || 0) + 1);
    }
    let best = '—';
    let bestCount = 0;
    for (const [k, c] of counts.entries()) {
      if (c > bestCount) {
        best = k;
        bestCount = c;
      }
    }
    return { label: best, count: bestCount };
  }, [visitorJourneys]);

  const filteredJourneys = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visitorJourneys.filter((v) => {
      if (filterMode === 'identified' && !v.identity) return false;
      if (
        filterMode === 'external' &&
        (!v.referrerHost || v.referrerHost.toLowerCase() === 'direct') &&
        !v.utmSource &&
        !v.clickIdType
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        v.visitorId,
        v.referrerHost,
        v.referrerUrl,
        v.triggerLabel,
        v.utmSummary || '',
        v.landingPage,
        v.visitedPaths.join(' '),
        v.primaryPersona,
        v.interests.join(' '),
        v.city,
        v.country,
        v.browser || '',
        v.os || '',
        v.networkHint || '',
        v.identity?.fullName || '',
        v.identity?.email || '',
        v.identity?.company || ''
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [visitorJourneys, filterMode, search]);

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>External Referring Sites</span>
            <Link2 className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {externalReferrerDomains.toLocaleString()}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Unique upstream domains ({rangeLabel})
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Attributed Trigger Sessions</span>
            <Compass className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-[var(--gs-primary)] tabular-nums">
            {attributedTriggerSessions.toLocaleString()}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Search, AI citations, social, UTMs &amp; click IDs
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Top Visitor Persona</span>
            <Sparkles className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="mt-2 text-base font-bold text-slate-900 truncate">
            {topPersonaSummary.label}
          </div>
          <p className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
            {topPersonaSummary.count} visitors · {combinedInterests.length} active topics
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Identity-Stitched Profiles</span>
            <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {identifiedCount.toLocaleString()}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Linked via Chat, Contact, Newsletter or Demo
          </p>
        </div>
      </div>

      {/* Privacy & Attribution Boundary Callout */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-[var(--gs-primary)] shrink-0 mt-0.5" />
          <p>
            <strong className="font-semibold text-slate-900">Pre-Landing &amp; Identity Stitching:</strong>{' '}
            External referring URLs, UTM triggers, Geo/Network, Browser/OS, and page interests capture automatically on arrival. Personal names, emails, and phones appear whenever a visitor submits Live Chat, Consultation, Newsletter, or Demo registration.
          </p>
        </div>
      </div>

      {/* 6 / 6 Split: Pre-Landing Websites & Triggers vs Visitor Interests & GA4 Signals */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Pre-Landing Websites, Full URLs & Trigger Tags */}
        <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900">
                Pre-Landing Websites &amp; Entry Triggers
              </h3>
              <p className="text-[11px] text-slate-500">
                Exact referring URLs, upstream domains, and UTM/click triggers before landing
              </p>
            </div>
            <span className="font-mono text-[11px] text-slate-500 tabular-nums">
              {referrerDetails.length} sources
            </span>
          </div>

          <div className="mt-3 divide-y divide-slate-200 max-h-[380px] overflow-y-auto pr-1">
            {referrerDetails.length === 0 ? (
              <p className="py-10 text-center text-xs text-slate-500">
                No pre-landing referral records in this date range yet.
              </p>
            ) : (
              referrerDetails.map((ref, idx) => {
                const safeHref = safeExternalHref(ref.referrerUrl);
                return (
                  <div
                    key={`${ref.referrerHost}-${ref.triggerLabel}-${idx}`}
                    className="py-3 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${getTriggerBadgeClass(
                            ref.triggerType
                          )}`}
                        >
                          {ref.triggerLabel}
                        </span>
                        <span className="font-semibold text-slate-900 truncate">
                          {ref.referrerHost || 'Direct'}
                        </span>
                      </div>
                      {safeHref ? (
                        <a
                          href={safeHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--gs-primary)] hover:underline max-w-full truncate"
                          title={safeHref}
                        >
                          <span className="truncate max-w-[300px]">{safeHref}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        <div className="font-mono text-[11px] text-slate-400">
                          {ref.triggerType === 'Direct'
                            ? 'Direct entry / browser bookmark'
                            : 'Referrer header hidden by browser privacy policy'}
                        </div>
                      )}
                      {(ref.utmSource || ref.utmMedium || ref.utmCampaign || ref.clickIdType) && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5 font-mono text-[10px] text-slate-600">
                          {ref.utmSource && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">
                              src={ref.utmSource}
                            </span>
                          )}
                          {ref.utmMedium && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">
                              med={ref.utmMedium}
                            </span>
                          )}
                          {ref.utmCampaign && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">
                              cmp={ref.utmCampaign}
                            </span>
                          )}
                          {ref.clickIdType && (
                            <span className="rounded bg-amber-50 text-amber-800 px-1.5 py-0.5">
                              {ref.clickIdType}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-right font-mono tabular-nums shrink-0">
                      <div className="font-bold text-slate-900">
                        {ref.sessions.toLocaleString()} sess
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {ref.activeUsers.toLocaleString()} users
                        {ref.conversions > 0 && (
                          <span className="text-emerald-700 font-semibold">
                            {' '}
                            · {ref.conversions} conv
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Visitor Interests & GA4 Signals Segments */}
        <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900">
                Visitor Interests &amp; GA4 Audience Segments
              </h3>
              <p className="text-[11px] text-slate-500">
                On-site topic affinity combined with GA4 Google Signals segments
              </p>
            </div>
            <span className="font-mono text-[11px] text-slate-500 tabular-nums">
              {ga4Interests.length > 0 ? 'Behavioral + GA4 Signals' : 'First-Party Behavioral'}
            </span>
          </div>

          <div className="mt-3 space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {combinedInterests.length === 0 ? (
              <p className="py-10 text-center text-xs text-slate-500">
                Interest clusters appear automatically as visitors explore pages.
              </p>
            ) : (
              combinedInterests.map((seg) => (
                <div
                  key={`${seg.source}-${seg.interest}`}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="font-semibold text-slate-900 truncate">
                        {seg.interest}
                      </span>
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                          seg.source === 'ga4_signals'
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        {seg.source === 'ga4_signals' ? 'GA4 Signals' : seg.category}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] font-bold text-slate-900 tabular-nums shrink-0">
                      {seg.users.toLocaleString()} users ({seg.sharePercent}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        seg.source === 'ga4_signals' ? 'bg-indigo-600' : 'bg-[var(--gs-primary)]'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(4, seg.sharePercent))}%` }}
                    />
                  </div>
                </div>
              ))
            )}

            {ga4Connected && ga4Interests.length === 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                GA4 is connected. To also stream Google Signals{' '}
                <code className="font-mono">brandingInterest</code> segments, enable Google Signals
                in GA4 Admin &rarr; Data Collection.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visitor Journeys & Stitched Profiles Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--gs-primary)]" />
              <span>Visitor Journeys, Interests &amp; Stitched Profiles</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Click any visitor row to inspect full referring URL, click path history, network/device profile, and verified lead info
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {(
                [
                  { id: 'all', label: `All (${visitorJourneys.length})` },
                  { id: 'identified', label: `Identified (${identifiedCount})` },
                  { id: 'external', label: 'External Referrers' }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id)}
                  className={`whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    filterMode === tab.id
                      ? 'bg-[var(--gs-primary)] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search origin, interest, city, name..."
                className="rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none w-56"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Visitor / Identity</th>
                <th className="py-2.5 px-4 font-semibold">Pre-Landing Origin &amp; Trigger</th>
                <th className="py-2.5 px-4 font-semibold">Persona &amp; Interests</th>
                <th className="py-2.5 px-4 font-semibold">Location &amp; Device</th>
                <th className="py-2.5 px-4 font-semibold text-right">Engagement &amp; Trail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredJourneys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    No visitor journeys match the current filter.
                  </td>
                </tr>
              ) : (
                filteredJourneys.map((v) => {
                  const isExpanded = expandedVisitorId === v.visitorId;
                  const safeHref = safeExternalHref(v.referrerUrl);
                  return (
                    <React.Fragment key={v.visitorId}>
                      <tr
                        onClick={() =>
                          setExpandedVisitorId((prev) =>
                            prev === v.visitorId ? null : v.visitorId
                          )
                        }
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-3 px-4 align-top">
                          <div className="flex items-start gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                            )}
                            <div className="min-w-0">
                              {v.identity ? (
                                <>
                                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                    <span>{v.identity.fullName}</span>
                                    <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                      {getIdentitySourceLabel(v.identity.source)}
                                    </span>
                                  </div>
                                  <div className="font-mono text-[11px] text-slate-600 truncate">
                                    {v.identity.email}
                                  </div>
                                  {v.identity.company && (
                                    <div className="text-[11px] text-slate-500">
                                      {v.identity.company}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  <div className="font-mono font-semibold text-slate-800">
                                    {v.visitorId.slice(0, 16)}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    Anonymous Visitor · {formatShortTimestamp(v.lastSeenAt)}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 align-top max-w-[260px]">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${getTriggerBadgeClass(
                                  v.triggerType
                                )}`}
                              >
                                {v.triggerLabel}
                              </span>
                              <span className="font-medium text-slate-800 truncate">
                                {v.referrerHost || 'Direct'}
                              </span>
                            </div>
                            {safeHref && (
                              <div className="font-mono text-[10px] text-slate-500 truncate">
                                {safeHref}
                              </div>
                            )}
                            {v.utmSummary && (
                              <div className="font-mono text-[10px] text-[var(--gs-primary)] truncate">
                                {v.utmSummary}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 align-top">
                          <div className="font-semibold text-slate-900">{v.primaryPersona}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {v.interests.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-700"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="py-3 px-4 align-top">
                          <div className="flex items-center gap-1 text-slate-800 font-medium">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>
                              {v.city}, {v.country}
                            </span>
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                            {v.browser || 'Browser'} · {v.os || 'OS'} ({v.device})
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right align-top font-mono tabular-nums">
                          <div className="font-bold text-slate-900">
                            {v.pageviews} views · {formatDurationSeconds(v.engagementSeconds)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Entry: {v.landingPage}
                            {v.conversions > 0 && (
                              <span className="text-emerald-700 font-semibold">
                                {' '}
                                · {v.conversions} conv
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={5} className="px-6 py-4">
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 text-xs">
                              {/* Journey & Entry Details */}
                              <div className="lg:col-span-7 space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                                <div className="font-display text-xs font-bold uppercase tracking-wider text-slate-500">
                                  Pre-Landing Referrer &amp; Route Trail
                                </div>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                                  <div>
                                    <span className="text-slate-500">Full Referring URL:</span>{' '}
                                    {safeHref ? (
                                      <a
                                        href={safeHref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="font-mono text-[var(--gs-primary)] hover:underline inline-flex items-center gap-1 break-all"
                                      >
                                        <span>{safeHref}</span>
                                        <ExternalLink className="h-3 w-3 shrink-0" />
                                      </a>
                                    ) : (
                                      <span className="font-mono text-slate-800">
                                        {v.referrerHost && v.referrerHost !== 'Direct'
                                          ? v.referrerHost
                                          : 'Direct / No External Referrer'}
                                      </span>
                                    )}
                                  </div>
                                  <div>
                                    <span className="text-slate-500">Initial Entry Route:</span>{' '}
                                    <span className="font-mono text-slate-900">{v.entryUrl}</span>
                                  </div>
                                  {v.utmSummary && (
                                    <div className="sm:col-span-2">
                                      <span className="text-slate-500">Campaign / UTMs:</span>{' '}
                                      <span className="font-mono text-slate-900">
                                        {v.utmSummary}
                                      </span>
                                    </div>
                                  )}
                                  {v.clickIdType && (
                                    <div className="sm:col-span-2">
                                      <span className="text-slate-500">Paid Click ID:</span>{' '}
                                      <span className="font-mono text-amber-800">
                                        {v.clickIdType}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="pt-2 border-t border-slate-200">
                                  <div className="text-[11px] font-semibold text-slate-500 mb-1.5">
                                    Chronological Pages Viewed ({v.visitedPaths.length})
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {v.visitedPaths.map((p, i) => (
                                      <React.Fragment key={`${v.visitorId}-${p}-${i}`}>
                                        <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-800">
                                          {p}
                                        </span>
                                        {i < v.visitedPaths.length - 1 && (
                                          <span className="text-slate-400">&rarr;</span>
                                        )}
                                      </React.Fragment>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Network / Device + Stitched Contact Profile */}
                              <div className="lg:col-span-5 space-y-3">
                                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
                                  <div className="font-display text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <Monitor className="h-3.5 w-3.5" />
                                    <span>Network, Geo &amp; Device Fingerprint</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                    <div className="text-slate-500">Location:</div>
                                    <div className="font-medium text-slate-900">
                                      {v.city}, {v.country}
                                    </div>
                                    <div className="text-slate-500">Network / Edge:</div>
                                    <div className="font-mono text-slate-800 truncate">
                                      {v.networkHint || 'Public Edge Network'}
                                    </div>
                                    <div className="text-slate-500">Browser / OS:</div>
                                    <div className="font-mono text-slate-800">
                                      {v.browser || 'Unknown'} / {v.os || 'Unknown'}
                                    </div>
                                    <div className="text-slate-500">Timezone / Lang:</div>
                                    <div className="font-mono text-slate-800">
                                      {v.timezone || 'UTC'} ({v.language || 'en'})
                                    </div>
                                    <div className="text-slate-500">First / Last Seen:</div>
                                    <div className="font-mono text-slate-800">
                                      {formatShortTimestamp(v.firstSeenAt)} &rarr;{' '}
                                      {formatShortTimestamp(v.lastSeenAt)}
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
                                  <div className="font-display text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <Globe2 className="h-3.5 w-3.5" />
                                    <span>Verified Identity Profile</span>
                                  </div>
                                  {v.identity ? (
                                    <div className="space-y-1.5 text-xs">
                                      <div className="font-semibold text-slate-900">
                                        {v.identity.fullName}
                                        {v.identity.company ? ` — ${v.identity.company}` : ''}
                                      </div>
                                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-700">
                                        <Mail className="h-3 w-3 text-slate-400" />
                                        <span>{v.identity.email}</span>
                                      </div>
                                      {v.identity.phone && (
                                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-700">
                                          <Phone className="h-3 w-3 text-slate-400" />
                                          <span>{v.identity.phone}</span>
                                        </div>
                                      )}
                                      {v.identity.serviceInterest && (
                                        <div className="text-[11px] text-slate-600">
                                          Topic / Service Interest:{' '}
                                          <span className="font-semibold text-slate-900">
                                            {v.identity.serviceInterest}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-[11px] text-slate-500">
                                      Anonymous browsing session. Personal contact details automatically stitch here if this visitor opens Live Chat, submits a Consultation Inquiry, subscribes, or registers for Live Demo.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
