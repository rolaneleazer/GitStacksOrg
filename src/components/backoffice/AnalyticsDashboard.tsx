import { BarChart3, CheckCircle2, Save } from 'lucide-react';
import React, { useState } from 'react';
import type { AdSenseSettings, AnalyticsSummary } from '../../shared/types.ts';

interface AnalyticsDashboardProps {
  settings: AdSenseSettings;
  summary: AnalyticsSummary | null;
  days: 7 | 14 | 30;
  onChangeDays: (days: 7 | 14 | 30) => void;
  onSaveGa4Settings: (patch: {
    ga4_measurement_id: string;
    ga4_enabled: boolean;
    ga4_track_events: boolean;
  }) => Promise<void>;
}

export function AnalyticsDashboard({
  settings,
  summary,
  days,
  onChangeDays,
  onSaveGa4Settings
}: AnalyticsDashboardProps) {
  const [measurementId, setMeasurementId] = useState(settings.ga4_measurement_id || '');
  const [enabled, setEnabled] = useState(Boolean(settings.ga4_enabled));
  const [trackEvents, setTrackEvents] = useState(settings.ga4_track_events !== false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    try {
      await onSaveGa4Settings({
        ga4_measurement_id: measurementId.trim().toUpperCase(),
        ga4_enabled: enabled,
        ga4_track_events: trackEvents
      });
      setMsg({
        type: 'ok',
        text: 'Google Analytics (GA4) settings saved. Consent-gated tracking is synced.'
      });
    } catch (err) {
      setMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save Google Analytics settings.'
      });
    } finally {
      setSaving(false);
    }
  };

  const maxDailyViews = Math.max(
    1,
    ...(summary?.dailySeries.map((d) => d.pageviews) || [1])
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Google Analytics (GA4) &amp; Traffic Dashboard
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Configure consent-gated GA4 measurement script injection and monitor live first-party
            traffic, top pages, referrers, and lead conversion funnels.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 w-full sm:w-fit">
          {([7, 14, 30] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onChangeDays(d)}
              className={`min-h-[38px] flex-1 sm:flex-none rounded-md px-3 py-1 text-xs font-semibold tabular-nums ${
                days === d ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              {d} Days
            </button>
          ))}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Pageviews ({days}d)</div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {summary?.totalPageviews ?? 0}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Public routes excluding /obama</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Unique Sessions</div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {summary?.uniqueSessions ?? 0}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Deduplicated browser sessions</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Lead &amp; Newsletter Conversions</div>
          <div className="mt-2 font-mono text-2xl font-bold text-[var(--gs-primary)] tabular-nums">
            {(summary?.inquiryConversions ?? 0) + (summary?.newsletterConversions ?? 0)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
            {summary?.inquiryConversions ?? 0} inquiries · {summary?.newsletterConversions ?? 0}{' '}
            subscribers
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Session Conversion Rate</div>
          <div className="mt-2 font-mono text-2xl font-bold text-[#16A34A] tabular-nums">
            {summary?.conversionRatePercent ?? 0}%
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            GA4 Tag: {settings.ga4_enabled && settings.ga4_measurement_id ? settings.ga4_measurement_id : 'Inactive'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Daily Traffic Bar Chart + Top Pages (8 cols) */}
        <div className="space-y-6 lg:col-span-8 min-w-0">
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[var(--gs-primary)]" />
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Daily Pageviews &amp; Conversions ({days}-Day Window)
                </h3>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {summary?.commentSubmissions ?? 0} reader comments
              </span>
            </div>

            <div className="mt-6 flex items-end gap-1 sm:gap-1.5 h-44 border-b border-slate-200 pb-2 overflow-x-auto">
              {(summary?.dailySeries || []).map((pt) => {
                const heightPct = Math.max(6, Math.round((pt.pageviews / maxDailyViews) * 100));
                return (
                  <div
                    key={pt.date}
                    title={`${pt.date}: ${pt.pageviews} views, ${pt.conversions} conversions`}
                    className="flex-1 min-w-[8px] flex flex-col items-center justify-end h-full group"
                  >
                    <div className="text-[10px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 tabular-nums mb-1">
                      {pt.pageviews}
                    </div>
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full max-w-[28px] rounded-t bg-[var(--gs-primary)] opacity-85 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[11px] font-mono text-slate-500 tabular-nums">
              <span>{summary?.dailySeries[0]?.date || ''}</span>
              <span>{summary?.dailySeries[summary.dailySeries.length - 1]?.date || ''}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-display text-sm font-bold text-slate-900 border-b border-slate-200 pb-3">
                Top Performing Routes
              </h3>
              <div className="mt-3 divide-y divide-slate-200">
                {(summary?.topPages || []).length === 0 ? (
                  <p className="py-4 text-xs text-slate-500">No pageviews recorded in window.</p>
                ) : (
                  summary?.topPages.map((row) => (
                    <div key={row.path} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <span className="font-mono text-slate-800 truncate">{row.path}</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                        {row.views}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-display text-sm font-bold text-slate-900 border-b border-slate-200 pb-3">
                Traffic &amp; AI Search Referrers
              </h3>
              <div className="mt-3 divide-y divide-slate-200">
                {(summary?.topReferrers || []).length === 0 ? (
                  <p className="py-4 text-xs text-slate-500">No referrer records in window.</p>
                ) : (
                  summary?.topReferrers.map((row) => (
                    <div key={row.referrer} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-800 truncate">{row.referrer}</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                        {row.visits}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* GA4 Configuration Form (4 cols) */}
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 lg:col-span-4 h-fit min-w-0"
        >
          <div className="border-b border-slate-200 pb-3">
            <h3 className="font-display text-sm font-bold text-slate-900">
              Google Analytics 4 (GA4) Settings
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Loads gtag.js only on public pages after cookie consent.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              GA4 Measurement ID
            </label>
            <input
              type="text"
              value={measurementId}
              onChange={(e) => setMeasurementId(e.target.value)}
              placeholder="G-XXXXXXXXXX"
              className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 font-mono px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
            />
          </div>

          <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="mt-0.5 rounded border-slate-300"
            />
            <span>Enable GA4 script injection on consented public visits</span>
          </label>

          <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={trackEvents}
              onChange={(e) => setTrackEvents(e.target.checked)}
              className="mt-0.5 rounded border-slate-300"
            />
            <span>Log custom consultation &amp; newsletter conversion events</span>
          </label>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600 flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#16A34A]" />
            <span>
              GDPR &amp; AdSense compliant: analytics cookies remain blocked when visitors select
              Essential Only.
            </span>
          </div>

          {msg && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                msg.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {msg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving GA4 Settings...' : 'Save Google Analytics Settings'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
