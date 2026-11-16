import {
  Activity,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.ts';
import type {
  CrmLead,
  CrmSourcesAnalyticsResponse,
  LeadSourceType
} from '../../shared/types.ts';

interface SourcesAttributionTabProps {
  leads: CrmLead[];
  onFilterBySource: (source: LeadSourceType) => void;
  onOpenLead: (lead: CrmLead) => void;
}

const SOURCE_ACCENTS: Record<LeadSourceType, string> = {
  github: 'bg-slate-800',
  apollo: 'bg-indigo-600',
  google_maps: 'bg-emerald-600',
  hacker_news: 'bg-amber-600',
  ycombinator: 'bg-orange-600',
  website: 'bg-sky-600',
  gemini_search: 'bg-violet-600',
  csv_import: 'bg-teal-600',
  demo_signup: 'bg-blue-600',
  manual: 'bg-slate-500'
};

export function SourcesAttributionTab({
  leads,
  onFilterBySource,
  onOpenLead
}: SourcesAttributionTabProps) {
  const [analytics, setAnalytics] = useState<CrmSourcesAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditSource, setAuditSource] = useState<'all' | LeadSourceType>('all');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCrmSourcesAnalytics();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load source attribution analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics, leads.length]);

  const maxSourceCount = useMemo(() => {
    if (!analytics) return 1;
    return Math.max(1, ...analytics.bySource.map((b) => b.leadCount));
  }, [analytics]);

  const filteredAuditLeads = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return leads
      .filter((l) => {
        if (auditSource !== 'all' && l.source_type !== auditSource) return false;
        if (q) {
          const hay = [
            l.company_name,
            l.contact_name,
            l.email,
            l.source_type,
            l.source_detail || '',
            ...(l.source_urls || [])
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .slice(0, 60);
  }, [leads, auditSearch, auditSource]);

  return (
    <div className="space-y-5">
      {/* Header & Refresh */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[var(--gs-primary)]" />
            <h3 className="font-display text-sm font-bold text-slate-900">
              Source Attribution &amp; Provenance Audit Dashboard
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Track exact acquisition channels, DNS MX email verification yields, pipeline dollar value,
            and verifiable URL provenance for every prospect in your CRM.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAnalytics}
          disabled={loading}
          className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Attribution</span>
        </button>
      </div>

      {/* Compliance Guardrail Banner */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-start gap-2.5 text-xs text-slate-700">
        <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-900">Authorized Public &amp; Opt-In B2B Sources Only:</span>{' '}
          Breached credential dumps and leaked databases are strictly excluded. Every lead below carries
          a verifiable API or public URL provenance trail with DNS MX deliverability validation.
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      {/* Totals KPI Strip */}
      {analytics && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-semibold text-slate-500">Total Attributed Leads</div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {analytics.totals.totalLeads}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
                Across {analytics.totals.activeSourcesCount} active source channel
                {analytics.totals.activeSourcesCount === 1 ? '' : 's'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-semibold text-slate-500">MX-Verified Email Yield</div>
              <div className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
                {analytics.totals.verifiedMxPercent}%
              </div>
              <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
                {analytics.totals.verifiedMxCount} / {analytics.totals.totalLeads} leads MX verified
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-semibold text-slate-500">Attributed Pipeline</div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                ${analytics.totals.totalPipelineValue.toLocaleString()}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
                {analytics.totals.wonDeals} won client conversion
                {analytics.totals.wonDeals === 1 ? '' : 's'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-semibold text-slate-500">Logged Sync Runs</div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {analytics.totals.totalSyncRuns}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Audited ingestion batches
              </div>
            </div>
          </div>

          {/* Channel Breakdown Chart + Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3.5 flex items-center justify-between">
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-800">
                Lead Volume, Verification Yield &amp; Value by Source
              </h4>
              <span className="text-[11px] text-slate-500">
                Click any source row to filter in Lead Database
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Data Source</th>
                    <th className="px-4 py-2.5 w-48">Volume Share</th>
                    <th className="px-4 py-2.5 text-right">Leads</th>
                    <th className="px-4 py-2.5 text-right">MX Verified</th>
                    <th className="px-4 py-2.5 text-right">Avg Fit</th>
                    <th className="px-4 py-2.5 text-right">Pipeline Value</th>
                    <th className="px-4 py-2.5 text-right">Sent / Won</th>
                    <th className="px-4 py-2.5 text-right">Filter</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {analytics.bySource.map((row) => {
                    const barWidth =
                      row.leadCount > 0 ? Math.max(6, Math.round((row.leadCount / maxSourceCount) * 100)) : 0;
                    return (
                      <tr key={row.source_type} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2.5 w-2.5 rounded-sm shrink-0 ${
                                SOURCE_ACCENTS[row.source_type]
                              }`}
                            />
                            <span className="font-semibold text-slate-900">{row.label}</span>
                          </div>
                          {row.lastSyncedAt && (
                            <div className="mt-0.5 pl-4 font-mono text-[10px] text-slate-400">
                              Last activity: {new Date(row.lastSyncedAt).toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full ${SOURCE_ACCENTS[row.source_type]} transition-all`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {row.leadCount}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          <span className={row.mxRatePercent >= 60 ? 'text-emerald-700 font-semibold' : 'text-slate-700'}>
                            {row.verifiedMxCount} ({row.mxRatePercent}%)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
                          {row.leadCount > 0 ? `${row.avgFitScore}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          ${row.totalDealValue.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600 tabular-nums">
                          {row.outreachSentCount} / {row.wonCount}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={row.leadCount === 0}
                            onClick={() => onFilterBySource(row.source_type)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                          >
                            <Filter className="h-3 w-3" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Batch Ingestion Sync History */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[var(--gs-primary)]" />
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-800">
                  Recent Connector Sync Batches
                </h4>
              </div>
              <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                {analytics.syncRuns.length} run{analytics.syncRuns.length === 1 ? '' : 's'}
              </span>
            </div>

            {analytics.syncRuns.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No connector batch sync runs recorded yet. Sync Trending Repos, Apollo, HN, YC, CSV,
                or Google Maps places to populate ingestion telemetry.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5">Source</th>
                      <th className="px-4 py-2.5">Query / Batch Label</th>
                      <th className="px-4 py-2.5 text-right">Fetched</th>
                      <th className="px-4 py-2.5 text-right">Inserted</th>
                      <th className="px-4 py-2.5 text-right">Merged</th>
                      <th className="px-4 py-2.5 text-right">MX Valid</th>
                      <th className="px-4 py-2.5">Operator</th>
                      <th className="px-4 py-2.5 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {analytics.syncRuns.map((run) => (
                      <tr key={run.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 font-semibold text-slate-800 capitalize whitespace-nowrap">
                          {run.source_type.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 max-w-[240px] truncate">
                          {run.query_label}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                          {run.fetched_count}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-emerald-700">
                          +{run.inserted_count}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">
                          {run.merged_count}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                          {run.mx_verified_count}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 truncate max-w-[160px]">
                          {run.triggered_by || 'system'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                          {new Date(run.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Per-Lead Provenance Audit Log */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-800">
              Per-Lead Provenance Audit Log
            </h4>
            <p className="text-[11px] text-slate-500">
              Verify exactly which dataset, API, or public web URL produced each contact record.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search company, email, URL..."
                className="min-h-[36px] rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-1 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
              />
            </div>
            <select
              aria-label="Filter provenance log by source"
              value={auditSource}
              onChange={(e) => setAuditSource(e.target.value as 'all' | LeadSourceType)}
              className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-[var(--gs-primary)] focus:outline-none"
            >
              <option value="all">All Sources</option>
              <option value="github">GitHub Repo</option>
              <option value="apollo">Apollo.io</option>
              <option value="google_maps">Google Maps</option>
              <option value="hacker_news">Hacker News</option>
              <option value="ycombinator">Y Combinator</option>
              <option value="website">Company Website</option>
              <option value="gemini_search">Gemini Search</option>
              <option value="demo_signup">Live Demo Signups</option>
              <option value="csv_import">CSV Import</option>
              <option value="manual">Manual Entry</option>
            </select>
          </div>
        </div>

        {filteredAuditLeads.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No lead provenance records match your filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Company &amp; Contact</th>
                  <th className="px-4 py-2.5">Origin Channel</th>
                  <th className="px-4 py-2.5">Origin Email &amp; MX</th>
                  <th className="px-4 py-2.5">Source Proof URLs</th>
                  <th className="px-4 py-2.5 text-right">Ingested</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAuditLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-2.5 max-w-[200px]">
                      <button
                        type="button"
                        onClick={() => onOpenLead(lead)}
                        className="font-semibold text-slate-900 hover:text-[var(--gs-primary)] truncate block text-left w-full"
                      >
                        {lead.company_name}
                      </button>
                      <div className="text-[11px] text-slate-500 truncate">{lead.contact_name}</div>
                    </td>
                    <td className="px-4 py-2.5 max-w-[180px]">
                      <div className="font-semibold text-slate-800 capitalize">
                        {lead.source_type.replace('_', ' ')}
                      </div>
                      {lead.source_detail && (
                        <div className="text-[11px] text-slate-500 truncate">{lead.source_detail}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 max-w-[200px]">
                      <div className="font-mono text-[11px] text-slate-800 truncate">
                        {lead.email || '—'}
                      </div>
                      <div className="mt-0.5 inline-flex items-center gap-1 text-[11px]">
                        {lead.email_status === 'verified_mx' && (
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        )}
                        <span
                          className={
                            lead.email_status === 'verified_mx'
                              ? 'text-emerald-700 font-semibold'
                              : 'text-slate-500'
                          }
                        >
                          {lead.email_status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 max-w-[260px]">
                      <div className="flex flex-wrap gap-1.5">
                        {(lead.source_urls || []).slice(0, 2).map((u) => (
                          <a
                            key={u}
                            href={u}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-[var(--gs-primary)] hover:underline max-w-[220px]"
                          >
                            <span className="truncate">{u.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                          </a>
                        ))}
                        {(!lead.source_urls || lead.source_urls.length === 0) && (
                          <span className="text-[11px] text-slate-400">No external URL</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
