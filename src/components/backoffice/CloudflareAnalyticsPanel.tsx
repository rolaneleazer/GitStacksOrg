import {
  AlertTriangle,
  Cloud,
  Globe,
  RefreshCw,
  Settings,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.ts';
import type {
  CloudflareAnalyticsResponse,
  CloudflareTimeSeriesPoint,
  CloudflareTopItem,
  CloudflareWindowPreset
} from '../../shared/types.ts';
import { CloudflareHistoryForecastView } from './CloudflareHistoryForecastView.tsx';

interface CloudflareAnalyticsPanelProps {
  onOpenSettings?: () => void;
}

const WINDOW_OPTIONS: { value: CloudflareWindowPreset; label: string }[] = [
  { value: '1h', label: 'Last 1 hour' },
  { value: '6h', label: 'Last 6 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' }
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

function DeltaIndicator({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) return null;
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold tabular-nums ${
        positive ? 'text-[#16A34A]' : 'text-[#DC2626]'
      }`}
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      <span>{Math.abs(value)}%</span>
    </span>
  );
}

function Sparkline({ values, color = '#2563EB' }: { values: number[]; color?: string }) {
  const width = 220;
  const height = 40;
  const pts = values.length > 1 ? values : [0, ...values, 0];
  const maxVal = Math.max(1, ...pts);
  const coords = pts.map((v, idx) => {
    const x = (idx / Math.max(1, pts.length - 1)) * width;
    const y = height - 4 - (v / maxVal) * (height - 8);
    return { x, y };
  });
  const linePath = coords
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-3 h-10 w-full overflow-visible"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={areaPath} fill="#EFF6FF" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function LineChartCard({
  title,
  metricLabel,
  metricValue,
  series,
  valueSelector,
  formatTick
}: {
  title: string;
  metricLabel: string;
  metricValue: string;
  series: CloudflareTimeSeriesPoint[];
  valueSelector: (pt: CloudflareTimeSeriesPoint) => number;
  formatTick: (val: number) => string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 560;
  const height = 190;
  const padLeft = 52;
  const padRight = 14;
  const padTop = 14;
  const padBottom = 26;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const vals = series.map(valueSelector);
  const maxVal = Math.max(4, ...vals);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(maxVal * r));

  const points = series.map((pt, idx) => {
    const x =
      series.length <= 1
        ? padLeft + plotW / 2
        : padLeft + (idx / (series.length - 1)) * plotW;
    const val = valueSelector(pt);
    const y = padTop + plotH - (val / maxVal) * plotH;
    return { x, y, pt, val };
  });

  const linePath =
    points.length > 0
      ? points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
      : '';
  const areaPath =
    points.length > 1
      ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${padTop + plotH} L${points[0].x.toFixed(1)},${padTop + plotH} Z`
      : '';

  const hovered = hoverIdx !== null && points[hoverIdx] ? points[hoverIdx] : null;
  const startLabel = series[0]?.label || '';
  const midLabel = series.length > 2 ? series[Math.floor(series.length / 2)]?.label : '';
  const endLabel = series.length > 1 ? series[series.length - 1]?.label : '';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-bold text-slate-900">{title}</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
            <span>{metricLabel}</span>
          </span>
          <span className="font-mono font-bold text-slate-900 tabular-nums">{metricValue}</span>
        </div>
      </div>

      <div className="relative">
        {series.length === 0 ? (
          <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
            No time-series datapoints recorded in this window
          </div>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 overflow-visible">
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
                    className="fill-slate-400 font-mono text-[9px]"
                  >
                    {formatTick(t)}
                  </text>
                </g>
              );
            })}

            {areaPath && <path d={areaPath} fill="#DBEAFE" fillOpacity="0.45" />}
            {linePath && <path d={linePath} fill="none" stroke="#2563EB" strokeWidth="1.75" />}

            {hovered && (
              <g>
                <line
                  x1={hovered.x}
                  y1={padTop}
                  x2={hovered.x}
                  y2={padTop + plotH}
                  stroke="#94A3B8"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <circle cx={hovered.x} cy={hovered.y} r="3.5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="1.5" />
              </g>
            )}

            {points.map((p, idx) => (
              <rect
                key={idx}
                x={p.x - Math.max(6, plotW / Math.max(1, points.length) / 2)}
                y={padTop}
                width={Math.max(12, plotW / Math.max(1, points.length))}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
              />
            ))}

            {startLabel && (
              <text x={padLeft} y={height - 6} textAnchor="start" className="fill-slate-400 font-mono text-[9px]">
                {startLabel}
              </text>
            )}
            {midLabel && (
              <text x={padLeft + plotW / 2} y={height - 6} textAnchor="middle" className="fill-slate-400 font-mono text-[9px]">
                {midLabel}
              </text>
            )}
            {endLabel && (
              <text x={width - padRight} y={height - 6} textAnchor="end" className="fill-slate-400 font-mono text-[9px]">
                {endLabel}
              </text>
            )}
          </svg>
        )}

        {hovered && (
          <div className="pointer-events-none absolute right-2 top-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] shadow-sm">
            <div className="font-mono text-slate-500">{hovered.pt.label}</div>
            <div className="font-mono font-bold text-slate-900 tabular-nums">
              {formatTick(hovered.val)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface StackedSeriesDef {
  key: string;
  label: string;
  color: string;
  total: number;
  getValue: (pt: CloudflareTimeSeriesPoint) => number;
}

function StackedBarChartCard({
  title,
  series,
  stacks
}: {
  title: string;
  series: CloudflareTimeSeriesPoint[];
  stacks: StackedSeriesDef[];
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 560;
  const height = 190;
  const padLeft = 44;
  const padRight = 14;
  const padTop = 14;
  const padBottom = 26;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const totalsPerBucket = series.map((pt) =>
    stacks.reduce((sum, s) => sum + s.getValue(pt), 0)
  );
  const maxVal = Math.max(4, ...totalsPerBucket);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(maxVal * r));

  const slotW = series.length > 0 ? plotW / series.length : plotW;
  const barW = Math.max(4, Math.min(28, slotW * 0.68));

  const startLabel = series[0]?.label || '';
  const midLabel = series.length > 2 ? series[Math.floor(series.length / 2)]?.label : '';
  const endLabel = series.length > 1 ? series[series.length - 1]?.label : '';
  const hoveredPt = hoverIdx !== null ? series[hoverIdx] : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-display text-sm font-bold text-slate-900">{title}</h3>
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          {stacks.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1 text-slate-600">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span>{s.label}</span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {formatCompactCount(s.total)}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="relative">
        {series.length === 0 ? (
          <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
            No distribution buckets recorded in this window
          </div>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 overflow-visible">
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
                    className="fill-slate-400 font-mono text-[9px]"
                  >
                    {formatCompactCount(t)}
                  </text>
                </g>
              );
            })}

            {series.map((pt, idx) => {
              const xCenter = padLeft + slotW * idx + slotW / 2;
              const x = xCenter - barW / 2;
              let cursorY = padTop + plotH;

              return (
                <g
                  key={pt.timestamp + idx}
                  onMouseEnter={() => setHoverIdx(idx)}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  {stacks.map((s) => {
                    const val = s.getValue(pt);
                    if (val <= 0) return null;
                    const segH = Math.max(1, (val / maxVal) * plotH);
                    cursorY -= segH;
                    return (
                      <rect
                        key={s.key}
                        x={x}
                        y={cursorY}
                        width={barW}
                        height={segH}
                        fill={s.color}
                        opacity={hoverIdx === null || hoverIdx === idx ? 1 : 0.65}
                      />
                    );
                  })}
                  <rect
                    x={padLeft + slotW * idx}
                    y={padTop}
                    width={slotW}
                    height={plotH}
                    fill="transparent"
                  />
                </g>
              );
            })}

            {startLabel && (
              <text x={padLeft} y={height - 6} textAnchor="start" className="fill-slate-400 font-mono text-[9px]">
                {startLabel}
              </text>
            )}
            {midLabel && (
              <text x={padLeft + plotW / 2} y={height - 6} textAnchor="middle" className="fill-slate-400 font-mono text-[9px]">
                {midLabel}
              </text>
            )}
            {endLabel && (
              <text x={width - padRight} y={height - 6} textAnchor="end" className="fill-slate-400 font-mono text-[9px]">
                {endLabel}
              </text>
            )}
          </svg>
        )}

        {hoveredPt && (
          <div className="pointer-events-none absolute right-2 top-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] shadow-sm space-y-0.5">
            <div className="font-mono font-semibold text-slate-800">{hoveredPt.label}</div>
            {stacks.map((s) => {
              const v = s.getValue(hoveredPt);
              if (v <= 0) return null;
              return (
                <div key={s.key} className="flex items-center justify-between gap-3 font-mono tabular-nums">
                  <span className="text-slate-600">{s.label}</span>
                  <span className="font-bold text-slate-900">{formatCompactCount(v)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TopBreakdownCard({ title, items }: { title: string; items: CloudflareTopItem[] }) {
  const maxCount = useMemo(
    () => Math.max(1, ...items.map((i) => i.count)),
    [items]
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h3 className="font-display text-sm font-bold text-slate-900">{title}</h3>
        <span className="font-mono text-[11px] text-slate-400 tabular-nums">
          {items.length} items
        </span>
      </div>

      {items.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-400">
          No telemetry items available for this dimension
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.slice(0, 10).map((item, idx) => {
            const pct = Math.max(2, Math.round((item.count / maxCount) * 100));
            return (
              <div
                key={`${item.label}-${idx}`}
                className="grid grid-cols-12 items-center gap-3 text-xs"
              >
                <div
                  className="col-span-6 sm:col-span-6 truncate font-mono text-[11px] text-slate-700"
                  title={item.label}
                >
                  {item.label}
                </div>
                <div className="col-span-4 sm:col-span-4">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#2563EB]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="col-span-2 text-right font-mono text-[11px] font-semibold text-slate-800 tabular-nums">
                  {formatCompactCount(item.count)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CloudflareAnalyticsPanel({ onOpenSettings }: CloudflareAnalyticsPanelProps) {
  const [cfSubTab, setCfSubTab] = useState<'live' | 'analysis'>('live');
  const [windowPreset, setWindowPreset] = useState<CloudflareWindowPreset>('24h');
  const [data, setData] = useState<CloudflareAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(120);

  const loadAnalytics = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const res = await api.getCloudflareAnalytics(windowPreset);
        setData(res);
        setSecondsUntilRefresh(120);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to retrieve Cloudflare telemetry.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [windowPreset]
  );

  useEffect(() => {
    loadAnalytics(false);
  }, [loadAnalytics]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          loadAnalytics(true);
          return 120;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [autoRefresh, loadAnalytics]);

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
        Connecting to Cloudflare GraphQL Edge Analytics for git-stack.org...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Sub-view Switcher: Live Traffic vs Analysis & Predictions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setCfSubTab('live')}
            className={`min-h-[40px] whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              cfSubTab === 'live'
                ? 'bg-[var(--gs-primary)] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Live Traffic
          </button>
          <button
            type="button"
            onClick={() => setCfSubTab('analysis')}
            className={`min-h-[40px] whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              cfSubTab === 'analysis'
                ? 'bg-[var(--gs-primary)] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Analysis &amp; Predictions
          </button>
        </div>
      </div>

      {cfSubTab === 'analysis' ? (
        <CloudflareHistoryForecastView onOpenSettings={onOpenSettings} />
      ) : (
        <>
          {/* Top Toolbar */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Cloud className="h-4 w-4 text-[#F38020] shrink-0" />
                <h2 className="font-display text-base font-bold text-slate-900">
                  {data?.zoneName || 'git-stack.org'} — Real-Time Edge &amp; Traffic Analytics
                </h2>
                {data?.planName && (
                  <span className="font-mono text-[11px] font-semibold text-slate-500">
                    · {data.planName}
                  </span>
                )}
              </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className="font-mono">
              Zone ID: {data?.zoneId || 'Unconfigured'}
            </span>
            {data?.fetchedAt && (
              <>
                <span>·</span>
                <span className="font-mono tabular-nums">
                  Last synced {new Date(data.fetchedAt).toLocaleTimeString()}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <select
            aria-label="Cloudflare analytics time window"
            value={windowPreset}
            onChange={(e) => setWindowPreset(e.target.value as CloudflareWindowPreset)}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-[var(--gs-primary)] focus:outline-none"
          >
            {WINDOW_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={`min-h-[40px] whitespace-nowrap rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
              autoRefresh
                ? 'border-[var(--gs-soft-border)] bg-[var(--gs-soft-bg)] text-[var(--gs-primary)]'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {autoRefresh ? `Auto-sync ${secondsUntilRefresh}s` : 'Auto-sync Off'}
          </button>

          <button
            type="button"
            disabled={refreshing}
            onClick={() => loadAnalytics(true)}
            className="min-h-[40px] whitespace-nowrap inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-900"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" />
          <span>{error}</span>
        </div>
      )}

      {data && !data.connected ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[#F38020]">
            <Globe className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-display text-base font-bold text-slate-900">
              Connect Cloudflare for {data.zoneName || 'git-stack.org'}
            </h3>
            <p className="mx-auto max-w-lg text-xs leading-relaxed text-slate-600">
              {data.notice ||
                'Add a Cloudflare API Token (with Zone:Read & Analytics:Read permissions) and your Zone ID in Settings & Integrations Vault to stream live edge requests, cache status, status codes, and geo traffic directly inside GitStack.'}
            </p>
          </div>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Configure Cloudflare in Integrations Vault</span>
            </button>
          )}
        </div>
      ) : (
        data && (
          <>
            {data.notice && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D97706]" />
                <span>{data.notice}</span>
              </div>
            )}

            {/* 5 Sparkline KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-medium text-slate-500">Total requests</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                    {formatCompactCount(data.summary.totalRequests)}
                  </span>
                  <DeltaIndicator value={data.summary.requestsDeltaPct} />
                </div>
                <Sparkline values={data.series.map((s) => s.requests)} />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-medium text-slate-500">Total data transfer</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                    {formatBytes(data.summary.totalBytes)}
                  </span>
                  <DeltaIndicator value={data.summary.bytesDeltaPct} />
                </div>
                <Sparkline values={data.series.map((s) => s.bytes)} />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-medium text-slate-500">Total visits</div>
                  <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                    {formatCompactCount(data.summary.totalVisits)}
                  </div>
                </div>
                {data.summary.totalVisits > 0 ? (
                  <Sparkline values={data.series.map((s) => s.visits)} />
                ) : (
                  <div className="mt-4 text-center text-[11px] text-slate-400">No data</div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-medium text-slate-500">Cache hit rate</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                    {data.summary.cacheHitRate}%
                  </span>
                  <DeltaIndicator value={data.summary.cacheHitRateDeltaPct} />
                </div>
                <Sparkline
                  values={data.series.map((s) =>
                    s.requests > 0 ? Math.round((s.cacheHit / s.requests) * 100) : 0
                  )}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-medium text-slate-500">5xx error rate</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                    {data.summary.error5xxRate}%
                  </span>
                  <DeltaIndicator value={data.summary.error5xxDeltaPct} />
                </div>
                <Sparkline
                  values={data.series.map((s) =>
                    s.requests > 0 ? Math.round((s.status5xx / s.requests) * 100) : 0
                  )}
                />
              </div>
            </div>

            {/* 2x2 Time-Series Charts */}
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <LineChartCard
                title="Requests over time"
                metricLabel="Requests"
                metricValue={formatCompactCount(data.summary.totalRequests)}
                series={data.series}
                valueSelector={(pt) => pt.requests}
                formatTick={formatCompactCount}
              />

              <LineChartCard
                title="Data transfer"
                metricLabel="Data transfer"
                metricValue={formatBytes(data.summary.totalBytes)}
                series={data.series}
                valueSelector={(pt) => pt.bytes}
                formatTick={formatBytes}
              />

              <StackedBarChartCard
                title="Requests by status code"
                series={data.series}
                stacks={[
                  {
                    key: 's1xx',
                    label: '1xx',
                    color: '#60A5FA',
                    total: data.summary.statusTotals.s1xx,
                    getValue: (p) => p.status1xx
                  },
                  {
                    key: 's2xx',
                    label: '2xx',
                    color: '#10B981',
                    total: data.summary.statusTotals.s2xx,
                    getValue: (p) => p.status2xx
                  },
                  {
                    key: 's3xx',
                    label: '3xx',
                    color: '#D97706',
                    total: data.summary.statusTotals.s3xx,
                    getValue: (p) => p.status3xx
                  },
                  {
                    key: 's4xx',
                    label: '4xx',
                    color: '#8B5CF6',
                    total: data.summary.statusTotals.s4xx,
                    getValue: (p) => p.status4xx
                  },
                  {
                    key: 's5xx',
                    label: '5xx',
                    color: '#06B6D4',
                    total: data.summary.statusTotals.s5xx,
                    getValue: (p) => p.status5xx
                  }
                ]}
              />

              <StackedBarChartCard
                title="Requests by cache status"
                series={data.series}
                stacks={[
                  {
                    key: 'dynamic',
                    label: 'Dynamic',
                    color: '#2563EB',
                    total: data.summary.cacheTotals.dynamic,
                    getValue: (p) => p.cacheDynamic
                  },
                  {
                    key: 'none',
                    label: 'None',
                    color: '#10B981',
                    total: data.summary.cacheTotals.none,
                    getValue: (p) => p.cacheNone
                  },
                  {
                    key: 'expired',
                    label: 'Expired',
                    color: '#D97706',
                    total: data.summary.cacheTotals.expired,
                    getValue: (p) => p.cacheExpired
                  },
                  {
                    key: 'miss',
                    label: 'Miss',
                    color: '#8B5CF6',
                    total: data.summary.cacheTotals.miss,
                    getValue: (p) => p.cacheMiss
                  },
                  {
                    key: 'hit',
                    label: 'Hit',
                    color: '#06B6D4',
                    total: data.summary.cacheTotals.hit,
                    getValue: (p) => p.cacheHit
                  }
                ]}
              />
            </div>

            {/* 11-Panel Top-N Horizontal Bar Breakdown Grid */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <TopBreakdownCard title="Top paths" items={data.breakdowns.topPaths} />
              <TopBreakdownCard title="Top countries" items={data.breakdowns.topCountries} />
              <TopBreakdownCard title="Top client IPs" items={data.breakdowns.topClientIps} />
              <TopBreakdownCard title="Top hosts" items={data.breakdowns.topHosts} />
              <TopBreakdownCard title="Top browsers" items={data.breakdowns.topBrowsers} />
              <TopBreakdownCard
                title="Top operating systems"
                items={data.breakdowns.topOperatingSystems}
              />
              <TopBreakdownCard title="Top device types" items={data.breakdowns.topDeviceTypes} />
              <TopBreakdownCard title="Top user agents" items={data.breakdowns.topUserAgents} />
              <TopBreakdownCard title="Top HTTP versions" items={data.breakdowns.topHttpVersions} />
              <TopBreakdownCard title="Top status codes" items={data.breakdowns.topStatusCodes} />
              <TopBreakdownCard title="Top data centers" items={data.breakdowns.topDataCenters} />
            </div>
          </>
        )
      )}
        </>
      )}
    </div>
  );
}
