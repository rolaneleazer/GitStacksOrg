import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Database,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.ts';
import type {
  CloudflareDailyForecastPoint,
  CloudflareHistoryAnalysisResponse,
  CloudflareHistoryRange
} from '../../shared/types.ts';

interface CloudflareHistoryForecastViewProps {
  onOpenSettings?: () => void;
}

const RANGE_OPTIONS: { value: CloudflareHistoryRange; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '14d', label: 'Last 14 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All stored snapshots' }
];

function formatCompactCount(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}k`;
  return String(Math.round(n));
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1000 && idx < units.length - 1) {
    val /= 1000;
    idx++;
  }
  return `${val >= 100 ? val.toFixed(0) : val.toFixed(2)} ${units[idx]}`;
}

export function CloudflareHistoryForecastView({
  onOpenSettings
}: CloudflareHistoryForecastViewProps) {
  const [range, setRange] = useState<CloudflareHistoryRange>('14d');
  const [data, setData] = useState<CloudflareHistoryAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [forecasting, setForecasting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await api.getCloudflareHistory(range);
      setData(res);
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load Cloudflare historical analysis.'
      });
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSyncHistory = async () => {
    setSyncing(true);
    setNotice(null);
    try {
      const res = await api.syncCloudflareHistory(range);
      setData(res.analysis);
      if (res.syncResult.error) {
        setNotice({ type: 'err', text: res.syncResult.error });
      } else {
        setNotice({
          type: 'ok',
          text: `Synced ${res.syncResult.syncedHours} Cloudflare buckets (${res.syncResult.totalSnapshots} snapshots stored in database).`
        });
      }
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Cloudflare snapshot sync failed.'
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleGenerateForecast = async () => {
    setForecasting(true);
    setNotice(null);
    try {
      const res = await api.generateCloudflareForecast(range);
      setData(res.analysis);
      setNotice({
        type: 'ok',
        text: res.forecast.usedGemini
          ? `Generated 7-day Gemini AI traffic forecast (${res.forecast.modelUsed}).`
          : res.forecast.fallbackNotice || 'Generated 7-day statistical forecast.'
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to generate traffic forecast.'
      });
    } finally {
      setForecasting(false);
    }
  };

  const activeForecast: CloudflareDailyForecastPoint[] = useMemo(() => {
    if (!data) return [];
    if (data.aiForecast?.dailyForecast && data.aiForecast.dailyForecast.length > 0) {
      return data.aiForecast.dailyForecast;
    }
    return data.statisticalBaselineForecast;
  }, [data]);

  const combinedChartPoints = useMemo(() => {
    const history = (data?.dailyHistory || []).map((pt) => ({
      key: pt.date,
      label: pt.label,
      kind: 'actual' as const,
      requests: pt.requests,
      low: pt.requests,
      high: pt.requests,
      rationale: `Actual · 5xx ${pt.error5xxRate}% · Cache ${pt.cacheHitRate}%`
    }));
    const forecast = activeForecast.map((pt) => ({
      key: `f-${pt.date}`,
      label: pt.label,
      kind: 'forecast' as const,
      requests: pt.predictedRequests,
      low: pt.lowRequests,
      high: pt.highRequests,
      rationale: pt.rationale
    }));
    return [...history, ...forecast];
  }, [data?.dailyHistory, activeForecast]);

  const maxHourly = useMemo(
    () => Math.max(1, ...(data?.hourlyDistribution.map((h) => h.avgRequests) || [1])),
    [data?.hourlyDistribution]
  );

  const maxWeekday = useMemo(
    () => Math.max(1, ...(data?.weekdayDistribution.map((w) => w.avgRequests) || [1])),
    [data?.weekdayDistribution]
  );

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
        Loading stored Cloudflare traffic snapshots and predictive model...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Control Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[var(--gs-primary)] shrink-0" />
            <h3 className="font-display text-base font-bold text-slate-900">
              {data?.zoneName || 'git-stack.org'} — Historical Edge Analysis &amp; 7-Day AI Forecast
            </h3>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-mono tabular-nums">
            <span>{data?.snapshotCount || 0} stored hourly snapshots</span>
            {data?.coverageStart && data?.coverageEnd && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Coverage {new Date(data.coverageStart).toLocaleDateString()} –{' '}
                  {new Date(data.coverageEnd).toLocaleDateString()}
                </span>
              </>
            )}
            {data?.aiForecast?.generatedAt && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Forecast updated {new Date(data.aiForecast.generatedAt).toLocaleTimeString()}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <select
            aria-label="Historical Cloudflare analysis range"
            value={range}
            onChange={(e) => setRange(e.target.value as CloudflareHistoryRange)}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-[var(--gs-primary)] focus:outline-none"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={syncing}
            onClick={handleSyncHistory}
            className="min-h-[40px] whitespace-nowrap inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <Database className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing Snapshots...' : 'Sync History'}</span>
          </button>

          <button
            type="button"
            disabled={forecasting}
            onClick={handleGenerateForecast}
            className="min-h-[40px] whitespace-nowrap inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
          >
            <Sparkles className={`h-3.5 w-3.5 ${forecasting ? 'animate-spin' : ''}`} />
            <span>{forecasting ? 'Analyzing with Gemini...' : 'Generate AI Forecast'}</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          role={notice.type === 'err' ? 'alert' : 'status'}
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-xs font-medium ${
            notice.type === 'err'
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          {notice.type === 'err' ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {data && !data.connected && data.snapshotCount === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-3">
          <p className="text-xs text-slate-600">
            Connect Cloudflare in Settings &amp; Integrations Vault and click Sync History to store
            hourly snapshots for historical pattern analysis and AI forecasting.
          </p>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
            >
              Configure Cloudflare Vault
            </button>
          )}
        </div>
      ) : (
        data && (
          <>
            {/* Summary KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-medium text-slate-500">Stored Requests</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                    {formatCompactCount(data.summary.totalRequests)}
                  </span>
                  {data.summary.requestTrendPct !== null && (
                    <span
                      className={`inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold tabular-nums ${
                        data.summary.requestTrendPct >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                      }`}
                    >
                      {data.summary.requestTrendPct >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(data.summary.requestTrendPct)}%
                    </span>
                  )}
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                  Avg {formatCompactCount(data.summary.avgDailyRequests)} / day
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-medium text-slate-500">Total Bandwidth</div>
                <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                  {formatBytes(data.summary.totalBytes)}
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                  Cache Hit {data.summary.avgCacheHitRate}%
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-medium text-slate-500">Peak Day &amp; Hour</div>
                <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                  {formatCompactCount(data.summary.peakDayRequests)}
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                  {data.summary.peakDayLabel} · Peak {String(data.summary.peakHourUtc).padStart(2, '0')}:00 UTC
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-medium text-slate-500">Avg 5xx Error Rate</div>
                <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                  {data.summary.avgError5xxRate}%
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                  {data.anomalies.length} anomalies flagged
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-medium text-slate-500">Predicted Next 7 Days</div>
                <div className="mt-1 font-mono text-xl font-bold text-[var(--gs-primary)] tabular-nums">
                  {formatCompactCount(
                    data.aiForecast?.expectedRequests7d ??
                      activeForecast.reduce((s, d) => s + d.predictedRequests, 0)
                  )}
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                  {data.aiForecast
                    ? `${data.aiForecast.confidencePct}% confidence · ${data.aiForecast.trendDirection.toUpperCase()}`
                    : 'Baseline statistical model'}
                </div>
              </div>
            </div>

            {/* Dual-Series SVG Chart: Historical Actuals + 7-Day Forecast Confidence Band */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="font-display text-sm font-bold text-slate-900">
                    Historical Daily Traffic &amp; 7-Day Predicted Trajectory
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Solid line shows recorded Cloudflare daily requests; dashed line and shaded cone show 7-day projected volume.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                    <span className="h-2 w-4 rounded-xs bg-[#2563EB]" />
                    Actual History
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                    <span className="h-0.5 w-4 border-t-2 border-dashed border-[#10B981]" />
                    7-Day Forecast
                  </span>
                </div>
              </div>

              {combinedChartPoints.length === 0 ? (
                <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
                  Click Sync History above to populate historical Cloudflare snapshots.
                </div>
              ) : (
                (() => {
                  const width = 920;
                  const height = 240;
                  const padLeft = 56;
                  const padRight = 18;
                  const padTop = 18;
                  const padBottom = 30;
                  const plotW = width - padLeft - padRight;
                  const plotH = height - padTop - padBottom;
                  const maxVal = Math.max(
                    10,
                    ...combinedChartPoints.map((p) => Math.max(p.requests, p.high))
                  );
                  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(maxVal * r));

                  const coords = combinedChartPoints.map((pt, idx) => {
                    const x =
                      combinedChartPoints.length <= 1
                        ? padLeft + plotW / 2
                        : padLeft + (idx / (combinedChartPoints.length - 1)) * plotW;
                    const y = padTop + plotH - (pt.requests / maxVal) * plotH;
                    const yLow = padTop + plotH - (pt.low / maxVal) * plotH;
                    const yHigh = padTop + plotH - (pt.high / maxVal) * plotH;
                    return { ...pt, x, y, yLow, yHigh };
                  });

                  const actualPts = coords.filter((c) => c.kind === 'actual');
                  const forecastPts = coords.filter((c) => c.kind === 'forecast');
                  const bridgeStart = actualPts[actualPts.length - 1];
                  const forecastChain = bridgeStart ? [bridgeStart, ...forecastPts] : forecastPts;

                  const actualPath = actualPts
                    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                    .join(' ');
                  const forecastPath = forecastChain
                    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                    .join(' ');

                  const confidencePolygon =
                    forecastChain.length > 1
                      ? [
                          ...forecastChain.map((p) => `${p.x.toFixed(1)},${p.yHigh.toFixed(1)}`),
                          ...forecastChain
                            .slice()
                            .reverse()
                            .map((p) => `${p.x.toFixed(1)},${p.yLow.toFixed(1)}`)
                        ].join(' ')
                      : '';

                  const hovered = hoverIdx !== null && coords[hoverIdx] ? coords[hoverIdx] : null;
                  const labelStep = Math.max(1, Math.floor(coords.length / 7));

                  return (
                    <div className="relative">
                      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56 overflow-visible">
                        {ticks.map((t, i) => {
                          const y = padTop + plotH - (t / maxVal) * plotH;
                          return (
                            <g key={i}>
                              <line
                                x1={padLeft}
                                y1={y}
                                x2={width - padRight}
                                y2={y}
                                stroke="#E2E8F0"
                                strokeDasharray="3 3"
                              />
                              <text
                                x={padLeft - 8}
                                y={y + 3}
                                textAnchor="end"
                                className="fill-slate-400 font-mono text-[10px]"
                              >
                                {formatCompactCount(t)}
                              </text>
                            </g>
                          );
                        })}

                        {bridgeStart && forecastPts.length > 0 && (
                          <line
                            x1={bridgeStart.x}
                            y1={padTop}
                            x2={bridgeStart.x}
                            y2={padTop + plotH}
                            stroke="#CBD5E1"
                            strokeDasharray="4 4"
                          />
                        )}

                        {confidencePolygon && (
                          <polygon points={confidencePolygon} fill="#10B981" fillOpacity="0.14" />
                        )}

                        {actualPath && (
                          <path d={actualPath} fill="none" stroke="#2563EB" strokeWidth="2.2" />
                        )}

                        {forecastPath && (
                          <path
                            d={forecastPath}
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="2.2"
                            strokeDasharray="5 4"
                          />
                        )}

                        {coords.map((c, idx) => (
                          <g key={c.key}>
                            <circle
                              cx={c.x}
                              cy={c.y}
                              r={hoverIdx === idx ? 4.5 : 2.5}
                              fill={c.kind === 'actual' ? '#2563EB' : '#10B981'}
                              stroke="#FFFFFF"
                              strokeWidth="1.2"
                            />
                            <rect
                              x={c.x - Math.max(8, plotW / Math.max(1, coords.length) / 2)}
                              y={padTop}
                              width={Math.max(16, plotW / Math.max(1, coords.length))}
                              height={plotH}
                              fill="transparent"
                              onMouseEnter={() => setHoverIdx(idx)}
                              onMouseLeave={() => setHoverIdx(null)}
                            />
                            {(idx % labelStep === 0 || idx === coords.length - 1) && (
                              <text
                                x={c.x}
                                y={height - 8}
                                textAnchor="middle"
                                className="fill-slate-400 font-mono text-[9.5]"
                              >
                                {c.label}
                              </text>
                            )}
                          </g>
                        ))}
                      </svg>

                      {hovered && (
                        <div className="pointer-events-none absolute right-2 top-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] shadow-sm space-y-0.5 max-w-xs">
                          <div className="font-mono font-bold text-slate-900">
                            {hovered.label} · {hovered.kind === 'actual' ? 'Recorded' : 'Forecast'}
                          </div>
                          <div className="font-mono text-[12px] font-bold text-[var(--gs-primary)] tabular-nums">
                            {formatCompactCount(hovered.requests)} reqs
                            {hovered.kind === 'forecast' &&
                              ` (${formatCompactCount(hovered.low)}–${formatCompactCount(hovered.high)})`}
                          </div>
                          <div className="text-[10.5px] text-slate-500">{hovered.rationale}</div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>

            {/* Hourly & Weekday Distribution Patterns */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[var(--gs-primary)]" />
                    <h4 className="font-display text-sm font-bold text-slate-900">
                      Hourly Traffic Pattern (24h UTC Avg)
                    </h4>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    Peak {String(data.summary.peakHourUtc).padStart(2, '0')}:00 UTC
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-1.5 items-end pt-2 h-32">
                  {data.hourlyDistribution.map((h) => {
                    const pct = Math.max(6, Math.round((h.avgRequests / maxHourly) * 100));
                    const isPeak = h.hourUtc === data.summary.peakHourUtc;
                    return (
                      <div
                        key={h.hourUtc}
                        className="flex flex-col items-center justify-end h-full gap-1"
                        title={`${h.label}: avg ${h.avgRequests} requests`}
                      >
                        <div
                          className={`w-full rounded-t-xs transition-all ${
                            isPeak ? 'bg-[#F38020]' : 'bg-[#2563EB]/80'
                          }`}
                          style={{ height: `${pct}%` }}
                        />
                        <span className="font-mono text-[8.5px] text-slate-400">
                          {h.hourUtc % 3 === 0 ? String(h.hourUtc).padStart(2, '0') : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="font-display text-sm font-bold text-slate-900">
                    Weekday Traffic Distribution
                  </h4>
                  <span className="font-mono text-[11px] text-slate-500">Avg requests / day</span>
                </div>
                <div className="space-y-2.5">
                  {data.weekdayDistribution.map((w) => {
                    const pct = Math.max(4, Math.round((w.avgRequests / maxWeekday) * 100));
                    return (
                      <div key={w.weekday} className="grid grid-cols-12 items-center gap-3 text-xs">
                        <span className="col-span-2 font-mono font-semibold text-slate-700">
                          {w.weekday}
                        </span>
                        <div className="col-span-8 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#10B981]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="col-span-2 text-right font-mono text-[11px] font-semibold text-slate-900 tabular-nums">
                          {formatCompactCount(w.avgRequests)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Gemini AI Forecast Narrative & Detected Anomalies */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 lg:col-span-7">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[var(--gs-primary)]" />
                    <h4 className="font-display text-sm font-bold text-slate-900">
                      Predictive Intelligence &amp; Edge Recommendations
                    </h4>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500">
                    {data.aiForecast
                      ? `${data.aiForecast.modelUsed} · ${data.aiForecast.confidencePct}% conf.`
                      : 'Statistical Baseline Ready'}
                  </span>
                </div>

                {data.aiForecast ? (
                  <div className="space-y-4 text-xs">
                    <p className="leading-relaxed text-slate-700">{data.aiForecast.executiveSummary}</p>

                    {data.aiForecast.trafficDrivers.length > 0 && (
                      <div>
                        <div className="font-semibold text-slate-900 mb-1.5">Primary Traffic Drivers</div>
                        <ul className="space-y-1 text-slate-600 list-disc pl-4">
                          {data.aiForecast.trafficDrivers.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {data.aiForecast.recommendations.length > 0 && (
                      <div>
                        <div className="font-semibold text-slate-900 mb-1.5">
                          Recommended Cloudflare WAF &amp; Cache Rules
                        </div>
                        <ul className="space-y-1.5 text-slate-700">
                          {data.aiForecast.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#16A34A]" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center space-y-3">
                    <p className="text-xs text-slate-600">
                      Click Generate AI Forecast to run Gemini predictive analysis over your stored Cloudflare snapshots.
                    </p>
                    <button
                      type="button"
                      disabled={forecasting}
                      onClick={handleGenerateForecast}
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Run Gemini AI Forecast</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 lg:col-span-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-[#D97706]" />
                    <h4 className="font-display text-sm font-bold text-slate-900">
                      Detected Traffic Anomalies
                    </h4>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    {(data.aiForecast?.anomalies.length || data.anomalies.length)} events
                  </span>
                </div>

                {(data.aiForecast?.anomalies.length ? data.aiForecast.anomalies : data.anomalies)
                  .length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No abnormal request spikes or 5xx error bursts detected in this window.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto">
                    {(data.aiForecast?.anomalies.length ? data.aiForecast.anomalies : data.anomalies).map(
                      (anom, idx) => (
                        <div
                          key={`${anom.bucketLabel}-${idx}`}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-900">{anom.title}</span>
                            <span
                              className={`font-mono text-[10px] font-bold uppercase ${
                                anom.severity === 'critical'
                                  ? 'text-[#DC2626]'
                                  : anom.severity === 'warning'
                                    ? 'text-[#D97706]'
                                    : 'text-[#2563EB]'
                              }`}
                            >
                              {anom.severity}
                            </span>
                          </div>
                          <div className="font-mono text-[10.5px] text-slate-500">{anom.bucketLabel}</div>
                          <p className="text-[11.5px] text-slate-600">{anom.detail}</p>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
