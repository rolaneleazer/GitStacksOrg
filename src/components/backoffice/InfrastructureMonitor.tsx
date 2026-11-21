import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  HardDrive,
  MemoryStick,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Copy,
  Check
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval.ts';
import { api } from '../../lib/api.ts';
import type {
  InfrastructureMetricsResponse,
  InfrastructureSamplePoint,
  QuotaShieldLoopId,
  QuotaShieldStatusResponse,
  UserRole
} from '../../shared/types.ts';

interface InfrastructureMonitorProps {
  currentUserRole: UserRole;
}

type PollMode = '120s' | '300s' | 'paused';

function formatTimeLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return iso;
  }
}

function buildPolylinePoints(
  values: number[],
  maxVal: number,
  width: number,
  height: number,
  padX: number,
  padY: number
): { points: string; coords: { x: number; y: number }[] } {
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const safeMax = Math.max(1, maxVal);

  const coords = values.map((val, idx) => {
    const x =
      values.length <= 1
        ? padX + usableW / 2
        : padX + (idx / (values.length - 1)) * usableW;
    const clamped = Math.max(0, Math.min(safeMax, val));
    const y = padY + usableH - (clamped / safeMax) * usableH;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  });

  return {
    points: coords.map((c) => `${c.x},${c.y}`).join(' '),
    coords
  };
}

function buildAreaPath(
  coords: { x: number; y: number }[],
  height: number,
  padY: number
): string {
  if (coords.length === 0) return '';
  const baseline = height - padY;
  const start = `M ${coords[0].x} ${baseline}`;
  const line = coords.map((c) => `L ${c.x} ${c.y}`).join(' ');
  const end = `L ${coords[coords.length - 1].x} ${baseline} Z`;
  return `${start} ${line} ${end}`;
}

export function InfrastructureMonitor({ currentUserRole }: InfrastructureMonitorProps) {
  const [data, setData] = useState<InfrastructureMetricsResponse | null>(null);
  const [samples, setSamples] = useState<InfrastructureSamplePoint[]>([]);
  const [pollMode, setPollMode] = useState<PollMode>('120s');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const [shield, setShield] = useState<QuotaShieldStatusResponse | null>(null);
  const [shieldBusy, setShieldBusy] = useState(false);
  const [shieldNotice, setShieldNotice] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const [showRss, setShowRss] = useState(true);
  const [showHeap, setShowHeap] = useState(true);
  const [showDb, setShowDb] = useState(true);

  const [restartModalOpen, setRestartModalOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartResult, setRestartResult] = useState<{
    success: boolean;
    message: string;
    connectionsTerminated: number;
    sampledAt: string;
  } | null>(null);
  const [restartError, setRestartError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  const fetchSample = useCallback(async (isInitial = false) => {
    if (!isInitial) setRefreshing(true);
    setError(null);
    try {
      const [res, shieldRes] = await Promise.all([
        api.getInfrastructureMetrics(),
        api.getQuotaShieldStatus().catch(() => null)
      ]);
      if (!mountedRef.current) return;
      setData(res);
      if (shieldRes) setShield(shieldRes);
      setSamples((prev) => {
        if (prev.length === 0 && res.history.length > 0) {
          return res.history.slice(-30);
        }
        const latest = res.history[res.history.length - 1] || {
          timestamp: res.sampledAt,
          cpuPercent: res.vercel.cpuPercent,
          eventLoopLagMs: res.vercel.eventLoopLagMs,
          rssMb: res.vercel.rssMb,
          heapUsedMb: res.vercel.heapUsedMb,
          dbSizeMb: res.supabase.databaseSizeMb,
          apiLatencyMs: 0
        };
        if (prev[prev.length - 1]?.timestamp === latest.timestamp) {
          return prev;
        }
        return [...prev, latest].slice(-30);
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error ? err.message : 'Unable to sample Vercel and Supabase telemetry.'
      );
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchSample(true);
    return () => {
      mountedRef.current = false;
    };
  }, [fetchSample]);

  useVisibilityInterval(
    () => {
      fetchSample(false);
    },
    pollMode === 'paused' ? null : pollMode === '120s' ? 120_000 : 300_000
  );

  const canManageShield = currentUserRole === 'super_admin' || currentUserRole === 'editor';

  const handleToggleLowQuotaMode = async () => {
    if (!shield || !canManageShield) return;
    setShieldBusy(true);
    setShieldNotice(null);
    try {
      const next = await api.updateQuotaShieldConfig({
        lowQuotaMode: !shield.lowQuotaMode
      });
      setShield(next);
      setShieldNotice(
        next.lowQuotaMode
          ? 'Low-Quota Shield enabled: non-essential background loops paused and cache TTLs extended 2.5x.'
          : 'Low-Quota Shield returned to standard throttled protection (5m–60m intervals).'
      );
    } catch (err) {
      setShieldNotice(err instanceof Error ? err.message : 'Unable to update Quota Shield.');
    } finally {
      setShieldBusy(false);
    }
  };

  const handleLoopToggle = async (loopId: QuotaShieldLoopId, enabled: boolean) => {
    if (!canManageShield) return;
    setShieldBusy(true);
    setShieldNotice(null);
    try {
      const next = await api.updateQuotaShieldConfig({
        loops: { [loopId]: { enabled } }
      });
      setShield(next);
    } catch (err) {
      setShieldNotice(err instanceof Error ? err.message : 'Failed to toggle background loop.');
    } finally {
      setShieldBusy(false);
    }
  };

  const handleLoopIntervalChange = async (loopId: QuotaShieldLoopId, intervalSeconds: number) => {
    if (!canManageShield) return;
    setShieldBusy(true);
    setShieldNotice(null);
    try {
      const next = await api.updateQuotaShieldConfig({
        loops: { [loopId]: { intervalSeconds } }
      });
      setShield(next);
    } catch (err) {
      setShieldNotice(err instanceof Error ? err.message : 'Failed to update loop interval.');
    } finally {
      setShieldBusy(false);
    }
  };

  const handleFlushCache = async () => {
    if (!canManageShield) return;
    setShieldBusy(true);
    setShieldNotice(null);
    try {
      const res = await api.flushQuotaShieldCache();
      setShield(res.status);
      setShieldNotice(`Purged ${res.clearedEntries} cached server entries. Fresh reads will re-populate cache.`);
    } catch (err) {
      setShieldNotice(err instanceof Error ? err.message : 'Failed to flush server cache.');
    } finally {
      setShieldBusy(false);
    }
  };

  const handleCopyAuditSql = async () => {
    if (!shield?.auditTriggerSql) return;
    try {
      await navigator.clipboard.writeText(shield.auditTriggerSql);
      setCopiedSql(true);
      window.setTimeout(() => setCopiedSql(false), 2500);
    } catch {
      setShieldNotice('Copy blocked by browser clipboard permissions. Select the SQL snippet manually.');
    }
  };

  const handleExportSnapshot = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify({ snapshot: data, samples }, null, 2)], {
      type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gitstack-infra-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmRestart = async () => {
    setRestarting(true);
    setRestartError(null);
    try {
      const res = await api.restartInfrastructureServices();
      setRestartResult({
        success: res.success,
        message: res.message,
        connectionsTerminated: res.connectionsTerminated,
        sampledAt: res.sampledAt
      });
      setRestartModalOpen(false);
      // Immediately resample metrics to reflect lowered connection count
      await fetchSample(false);
    } catch (err) {
      setRestartError(err instanceof Error ? err.message : 'Failed to restart connection pools.');
    } finally {
      setRestarting(false);
    }
  };

  const activeSample = useMemo(() => {
    if (samples.length === 0) return null;
    if (hoveredIdx !== null && samples[hoveredIdx]) return samples[hoveredIdx];
    return samples[samples.length - 1];
  }, [samples, hoveredIdx]);

  // SVG Geometry Constants
  const SVG_W = 640;
  const SVG_H = 210;
  const PAD_X = 16;
  const PAD_Y = 18;

  const cpuChart = useMemo(() => {
    const cpuVals = samples.map((s) => s.cpuPercent);
    const lagVals = samples.map((s) => Math.min(100, s.eventLoopLagMs));
    const cpuPoly = buildPolylinePoints(cpuVals, 100, SVG_W, SVG_H, PAD_X, PAD_Y);
    const lagPoly = buildPolylinePoints(lagVals, 100, SVG_W, SVG_H, PAD_X, PAD_Y);
    const cpuArea = buildAreaPath(cpuPoly.coords, SVG_H, PAD_Y);
    const warnY = PAD_Y + (SVG_H - PAD_Y * 2) * 0.25; // 75% mark
    return { cpuPoly, lagPoly, cpuArea, warnY };
  }, [samples]);

  const memChart = useMemo(() => {
    const maxCandidate = Math.max(
      100,
      ...(showRss ? samples.map((s) => s.rssMb) : [0]),
      ...(showHeap ? samples.map((s) => s.heapUsedMb) : [0]),
      ...(showDb ? samples.map((s) => s.dbSizeMb) : [0])
    );
    const scaleMax = Math.ceil(maxCandidate / 50) * 50;
    const rssPoly = buildPolylinePoints(
      samples.map((s) => s.rssMb),
      scaleMax,
      SVG_W,
      SVG_H,
      PAD_X,
      PAD_Y
    );
    const heapPoly = buildPolylinePoints(
      samples.map((s) => s.heapUsedMb),
      scaleMax,
      SVG_W,
      SVG_H,
      PAD_X,
      PAD_Y
    );
    const dbPoly = buildPolylinePoints(
      samples.map((s) => s.dbSizeMb),
      scaleMax,
      SVG_W,
      SVG_H,
      PAD_X,
      PAD_Y
    );
    const rssArea = buildAreaPath(rssPoly.coords, SVG_H, PAD_Y);
    return { scaleMax, rssPoly, heapPoly, dbPoly, rssArea };
  }, [samples, showRss, showHeap, showDb]);

  const handleChartPointerMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (samples.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * SVG_W;
    const usableW = SVG_W - PAD_X * 2;
    const norm = Math.max(0, Math.min(1, (relX - PAD_X) / usableW));
    const idx = Math.round(norm * Math.max(0, samples.length - 1));
    setHoveredIdx(idx);
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-32 rounded-xl border border-slate-200 bg-white p-5 animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-72 rounded-xl border border-slate-200 bg-white p-6 animate-pulse" />
          <div className="h-72 rounded-xl border border-slate-200 bg-white p-6 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Vercel &amp; Supabase Live Infrastructure Monitor
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              {pollMode !== 'paused' && (
                <span className="h-2 w-2 rounded-full bg-[#16A34A]" aria-hidden="true" />
              )}
              <span>{pollMode === 'paused' ? 'Polling Paused' : `Live Polling (${pollMode})`}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Runtime:{' '}
              <strong className="font-semibold text-slate-700">
                {data?.environment === 'vercel' ? 'Vercel Serverless' : 'Node Local Server'}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Region: {data?.region || 'local'} · {data?.nodeVersion || ''}
            </span>
            {data?.sampledAt && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Last sample {formatTimeLabel(data.sampledAt)}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Live polling interval"
            className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 w-full sm:w-auto"
          >
            {(['120s', '300s', 'paused'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPollMode(mode)}
                className={`min-h-[38px] flex-1 sm:flex-none inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  pollMode === mode
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode === 'paused' ? (
                  <Pause className="h-3 w-3" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                <span>{mode === 'paused' ? 'Pause' : mode === '120s' ? 'Live 2m' : 'Live 5m'}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => fetchSample(false)}
            disabled={refreshing}
            className="min-h-[42px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sample Now</span>
          </button>

          <button
            type="button"
            onClick={handleExportSnapshot}
            disabled={!data}
            className="min-h-[42px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export JSON</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRestartError(null);
              setRestartModalOpen(true);
            }}
            className="min-h-[42px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors whitespace-nowrap"
            title="Drop idle connections & reset Supabase connection pools"
          >
            <RotateCcw className="h-3.5 w-3.5 text-amber-700" />
            <span>Reset Pools &amp; Drop Connections</span>
          </button>
        </div>
      </div>

      {restartResult && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-900">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-slate-900">{restartResult.message}</p>
              <p className="text-emerald-700 mt-0.5">
                Supabase client connection pools reconstructed, server caches purged, and{' '}
                <strong className="font-bold">{restartResult.connectionsTerminated}</strong> idle database backend(s) terminated at {formatTimeLabel(restartResult.sampledAt)}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRestartResult(null)}
            className="rounded px-2 py-1 text-emerald-800 hover:bg-emerald-100 font-semibold whitespace-nowrap"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchSample(false)}
            className="min-h-[36px] rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 whitespace-nowrap"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4-Card KPI Summary Strip */}
      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Vercel Compute CPU</span>
              <Cpu className="h-4 w-4 text-[var(--gs-primary)]" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {data.vercel.cpuPercent}%
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${Math.min(100, data.vercel.cpuPercent)}%`,
                  backgroundColor:
                    data.vercel.cpuPercent >= 85
                      ? '#DC2626'
                      : data.vercel.cpuPercent >= 65
                        ? '#D97706'
                        : 'var(--gs-primary)'
                }}
              />
            </div>
            <p className="mt-2 font-mono text-[11px] text-slate-500 tabular-nums">
              Loop lag {data.vercel.eventLoopLagMs} ms · 1 vCPU Hobby
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Vercel Function RAM</span>
              <MemoryStick className="h-4 w-4 text-[var(--gs-primary)]" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {data.vercel.rssMb} MB
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${Math.min(100, data.vercel.ramUsedPercent)}%`,
                  backgroundColor:
                    data.vercel.ramUsedPercent >= 85
                      ? '#DC2626'
                      : data.vercel.ramUsedPercent >= 65
                        ? '#D97706'
                        : '#16A34A'
                }}
              />
            </div>
            <p className="mt-2 font-mono text-[11px] text-slate-500 tabular-nums">
              {data.vercel.ramUsedPercent}% of {data.vercel.ramLimitMb} MB cap · Heap{' '}
              {data.vercel.heapUsedMb} MB
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Supabase Storage</span>
              <HardDrive className="h-4 w-4 text-[var(--gs-primary)]" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {data.supabase.databaseSizeMb} MB
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${Math.min(100, data.supabase.storageUsedPercent)}%`,
                  backgroundColor:
                    data.supabase.storageUsedPercent >= 90
                      ? '#DC2626'
                      : data.supabase.storageUsedPercent >= 75
                        ? '#D97706'
                        : '#16A34A'
                }}
              />
            </div>
            <p className="mt-2 font-mono text-[11px] text-slate-500 tabular-nums">
              {data.supabase.storageUsedPercent}% of {data.supabase.storageLimitMb} MB Free ·{' '}
              {data.supabase.totalRowsEstimate.toLocaleString()} rows
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Postgres Health &amp; Cache</span>
              <Database className="h-4 w-4 text-[#16A34A]" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-[#16A34A] tabular-nums">
              {data.supabase.cacheHitRatioPercent}%
            </div>
            <p className="mt-2 font-mono text-[11px] text-slate-600 tabular-nums">
              Connections: {data.supabase.activeConnections}/{data.supabase.maxConnections}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Mode:{' '}
              {data.supabase.postgresDirectConnected
                ? 'Direct Postgres Stats'
                : 'REST Row-Size Estimate'}
            </p>
          </div>
        </div>
      )}

      {/* Free-Tier Quota Alerts Strip */}
      {data && data.alerts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.alerts.map((alert) => {
            const isCrit = alert.severity === 'critical';
            const isWarn = alert.severity === 'warning';
            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 rounded-xl border p-4 ${
                  isCrit
                    ? 'border-red-200 bg-red-50/70'
                    : isWarn
                      ? 'border-amber-200 bg-amber-50/70'
                      : 'border-slate-200 bg-white'
                }`}
              >
                {isCrit || isWarn ? (
                  <AlertTriangle
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      isCrit ? 'text-[#DC2626]' : 'text-[#D97706]'
                    }`}
                  />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-900">
                    <span>{alert.title}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        isCrit
                          ? 'text-[#DC2626]'
                          : isWarn
                            ? 'text-[#D97706]'
                            : 'text-[#16A34A]'
                      }
                    >
                      {isCrit ? 'Critical' : isWarn ? 'Warning' : 'Nominal'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">{alert.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Live Time-Series Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chart 1: CPU & Event Loop Lag */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900">
                Vercel Compute: CPU % &amp; Event-Loop Lag
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Hover chart to inspect historical samples ({samples.length} points buffered)
              </p>
            </div>
            {activeSample && (
              <div className="text-right font-mono text-xs tabular-nums">
                <div className="font-bold text-[var(--gs-primary)]">
                  CPU {activeSample.cpuPercent}% · Lag {activeSample.eventLoopLagMs} ms
                </div>
                <div className="text-[11px] text-slate-400">
                  {formatTimeLabel(activeSample.timestamp)}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              onMouseMove={handleChartPointerMove}
              onMouseLeave={() => setHoveredIdx(null)}
              role="img"
              aria-label="Live Vercel CPU and event-loop lag graph"
              className="h-52 w-full cursor-crosshair select-none"
            >
              {/* Horizontal gridlines */}
              {[0, 25, 50, 75, 100].map((pct) => {
                const y = PAD_Y + ((100 - pct) / 100) * (SVG_H - PAD_Y * 2);
                return (
                  <g key={pct}>
                    <line
                      x1={PAD_X}
                      x2={SVG_W - PAD_X}
                      y1={y}
                      y2={y}
                      stroke={pct === 75 ? '#F59E0B' : '#E2E8F0'}
                      strokeDasharray={pct === 75 ? '4 4' : undefined}
                      strokeWidth="1"
                    />
                    <text
                      x={PAD_X + 2}
                      y={y - 4}
                      fontSize="10"
                      fill="#94A3B8"
                      fontFamily="monospace"
                    >
                      {pct}%
                    </text>
                  </g>
                );
              })}

              {cpuChart.cpuArea && (
                <path
                  d={cpuChart.cpuArea}
                  fill="var(--gs-primary)"
                  fillOpacity="0.12"
                />
              )}
              {cpuChart.cpuPoly.points && (
                <polyline
                  fill="none"
                  stroke="var(--gs-primary)"
                  strokeWidth="2.25"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={cpuChart.cpuPoly.points}
                />
              )}
              {cpuChart.lagPoly.points && (
                <polyline
                  fill="none"
                  stroke="#D97706"
                  strokeWidth="1.75"
                  strokeDasharray="3 3"
                  strokeLinejoin="round"
                  points={cpuChart.lagPoly.points}
                />
              )}

              {hoveredIdx !== null && cpuChart.cpuPoly.coords[hoveredIdx] && (
                <g>
                  <line
                    x1={cpuChart.cpuPoly.coords[hoveredIdx].x}
                    x2={cpuChart.cpuPoly.coords[hoveredIdx].x}
                    y1={PAD_Y}
                    y2={SVG_H - PAD_Y}
                    stroke="#64748B"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <circle
                    cx={cpuChart.cpuPoly.coords[hoveredIdx].x}
                    cy={cpuChart.cpuPoly.coords[hoveredIdx].y}
                    r="4.5"
                    fill="var(--gs-primary)"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  <circle
                    cx={cpuChart.lagPoly.coords[hoveredIdx].x}
                    cy={cpuChart.lagPoly.coords[hoveredIdx].y}
                    r="3.5"
                    fill="#D97706"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                </g>
              )}
            </svg>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-xs"
                  style={{ backgroundColor: 'var(--gs-primary)' }}
                />
                <span>CPU % (1 vCPU)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#D97706]" />
                <span>Event Loop Lag (ms)</span>
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">75% Warning Threshold</span>
          </div>
        </div>

        {/* Chart 2: Vercel RAM & Supabase Storage Footprint */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900">
                Memory &amp; Storage Footprint (MB)
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Toggle series below or hover chart to inspect exact MB allocation
              </p>
            </div>
            {activeSample && (
              <div className="text-right font-mono text-xs tabular-nums">
                <div className="font-bold text-slate-900">
                  RSS {activeSample.rssMb} MB · DB {activeSample.dbSizeMb} MB
                </div>
                <div className="text-[11px] text-slate-400">
                  Heap {activeSample.heapUsedMb} MB · API {activeSample.apiLatencyMs} ms
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              onMouseMove={handleChartPointerMove}
              onMouseLeave={() => setHoveredIdx(null)}
              role="img"
              aria-label="Live Vercel RAM and Supabase Storage footprint graph"
              className="h-52 w-full cursor-crosshair select-none"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = PAD_Y + (1 - ratio) * (SVG_H - PAD_Y * 2);
                const labelVal = Math.round(memChart.scaleMax * ratio);
                return (
                  <g key={ratio}>
                    <line
                      x1={PAD_X}
                      x2={SVG_W - PAD_X}
                      y1={y}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeWidth="1"
                    />
                    <text
                      x={PAD_X + 2}
                      y={y - 4}
                      fontSize="10"
                      fill="#94A3B8"
                      fontFamily="monospace"
                    >
                      {labelVal} MB
                    </text>
                  </g>
                );
              })}

              {showRss && memChart.rssArea && (
                <path d={memChart.rssArea} fill="#0F172A" fillOpacity="0.06" />
              )}
              {showRss && memChart.rssPoly.points && (
                <polyline
                  fill="none"
                  stroke="#0F172A"
                  strokeWidth="2.25"
                  strokeLinejoin="round"
                  points={memChart.rssPoly.points}
                />
              )}
              {showHeap && memChart.heapPoly.points && (
                <polyline
                  fill="none"
                  stroke="var(--gs-primary)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  points={memChart.heapPoly.points}
                />
              )}
              {showDb && memChart.dbPoly.points && (
                <polyline
                  fill="none"
                  stroke="#16A34A"
                  strokeWidth="2.25"
                  strokeLinejoin="round"
                  points={memChart.dbPoly.points}
                />
              )}

              {hoveredIdx !== null && memChart.rssPoly.coords[hoveredIdx] && (
                <g>
                  <line
                    x1={memChart.rssPoly.coords[hoveredIdx].x}
                    x2={memChart.rssPoly.coords[hoveredIdx].x}
                    y1={PAD_Y}
                    y2={SVG_H - PAD_Y}
                    stroke="#64748B"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  {showRss && (
                    <circle
                      cx={memChart.rssPoly.coords[hoveredIdx].x}
                      cy={memChart.rssPoly.coords[hoveredIdx].y}
                      r="4"
                      fill="#0F172A"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                  )}
                  {showHeap && memChart.heapPoly.coords[hoveredIdx] && (
                    <circle
                      cx={memChart.heapPoly.coords[hoveredIdx].x}
                      cy={memChart.heapPoly.coords[hoveredIdx].y}
                      r="4"
                      fill="var(--gs-primary)"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                  )}
                  {showDb && memChart.dbPoly.coords[hoveredIdx] && (
                    <circle
                      cx={memChart.dbPoly.coords[hoveredIdx].x}
                      cy={memChart.dbPoly.coords[hoveredIdx].y}
                      r="4"
                      fill="#16A34A"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                  )}
                </g>
              )}
            </svg>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowRss((v) => !v)}
              className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
                showRss
                  ? 'border-slate-300 bg-slate-100 text-slate-900'
                  : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-xs bg-[#0F172A]" />
              <span>Vercel RSS RAM</span>
            </button>
            <button
              type="button"
              onClick={() => setShowHeap((v) => !v)}
              className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
                showHeap
                  ? 'border-[var(--gs-soft-border)] bg-[var(--gs-soft-bg)] text-slate-900'
                  : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-xs"
                style={{ backgroundColor: 'var(--gs-primary)' }}
              />
              <span>V8 Heap Used</span>
            </button>
            <button
              type="button"
              onClick={() => setShowDb((v) => !v)}
              className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
                showDb
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-xs bg-[#16A34A]" />
              <span>Supabase DB MB</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Deck: Supabase Table Breakdown + Vercel Hobby Guardrails */}
      {data && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Supabase Per-Table Storage Breakdown */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-7 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Supabase Table Storage Breakdown
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Per-table disk allocation against the 500 MB Supabase Free plan limit
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                {data.supabase.tables.length} Tables
              </span>
            </div>

            {data.supabase.tables.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                No Supabase table metrics available yet. Ensure Supabase credentials or
                SUPABASE_DB_URL are configured.
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[460px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2.5 pr-3 font-semibold">Table</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Rows</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Data MB</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Index MB</th>
                      <th className="py-2.5 pl-3 text-right font-semibold">Total MB</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.supabase.tables.map((t) => (
                      <tr key={t.tableName} className="hover:bg-slate-50/70">
                        <td className="py-2.5 pr-3 font-mono font-medium text-slate-800">
                          {t.tableName}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600 tabular-nums">
                          {t.rowEstimate.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600 tabular-nums">
                          {t.dataMb.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600 tabular-nums">
                          {t.indexMb.toFixed(2)}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {t.totalMb.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Vercel Hobby & Optional Cloud API Sync Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Vercel Free Plan &amp; Cloud Sync
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Hobby runtime ceilings and optional API token integration status
                </p>
              </div>
              <Server className="h-4 w-4 text-[var(--gs-primary)]" />
            </div>

            <dl className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Vercel Function Cap</dt>
                <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                  {data.vercel.ramLimitMb} MB · 1 vCPU · {data.vercel.functionMaxDurationSec}s
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Hobby Monthly Bandwidth</dt>
                <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                  {data.vercel.bandwidthLimitGb} GB Included
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Isolate Uptime / Cold Start</dt>
                <dd className="font-mono text-slate-800 tabular-nums">
                  {data.uptimeSeconds}s · {data.coldStart ? 'Cold Start' : 'Warm Isolate'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Vercel REST API</dt>
                <dd className="font-semibold text-slate-800">
                  {data.vercel.apiConfigured
                    ? data.vercel.latestDeploymentState || 'Connected'
                    : 'Runtime Metrics Only'}
                </dd>
              </div>
              {data.vercel.projectName && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">Vercel Project</dt>
                  <dd className="font-mono text-slate-800 truncate">{data.vercel.projectName}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Supabase Project Ref</dt>
                <dd className="font-mono text-slate-800">
                  {data.supabase.projectRef || 'Not linked'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Supabase Management API</dt>
                <dd className="font-semibold text-slate-800">
                  {data.supabase.apiConfigured
                    ? `${data.supabase.projectStatus || 'Active'} (${data.supabase.projectRegion || 'Region'})`
                    : data.supabase.postgresDirectConnected
                      ? 'Direct Postgres Active'
                      : 'REST Fallback'}
                </dd>
              </div>
            </dl>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 space-y-1.5">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
                <span>GitHub → Vercel Env Checklist</span>
              </div>
              <p className="leading-relaxed">
                {currentUserRole === 'super_admin'
                  ? 'In Vercel Project Settings → Environment Variables, set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, and SUPABASE_DB_URL. Add optional VERCEL_TOKEN + SUPABASE_ACCESS_TOKEN for cloud deployment metadata.'
                  : 'Vercel environment variables (Supabase keys and optional cloud tokens) are managed by a Super Admin in Vercel Project Settings.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Supabase Free Tier Quota Shield & Loop Governance */}
      {shield && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#16A34A] shrink-0" />
                <h3 className="font-display text-base font-bold text-slate-900">
                  Supabase Free Tier Quota Shield
                </h3>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className={shield.lowQuotaMode ? 'font-semibold text-[#D97706]' : 'font-semibold text-[#16A34A]'}>
                  {shield.lowQuotaMode ? 'Low-Quota Shield Active' : 'Throttled Protection Active'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Cache TTL {shield.cacheTtlMultiplier}x
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {shield.serverlessLoopsSuppressed
                    ? 'Serverless Auto-Loops Suppressed'
                    : `${shield.loops.filter((l) => l.effectiveActive).length}/${shield.loops.length} Loops Active`}
                </span>
              </div>
            </div>

            {canManageShield && (
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleFlushCache}
                  disabled={shieldBusy}
                  className="min-h-[40px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${shieldBusy ? 'animate-spin' : ''}`} />
                  <span>Flush Server Cache</span>
                </button>
                <button
                  type="button"
                  onClick={handleToggleLowQuotaMode}
                  disabled={shieldBusy}
                  className={`min-h-[40px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap ${
                    shield.lowQuotaMode
                      ? 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{shield.lowQuotaMode ? 'Disable Low-Quota Shield' : 'Enable Low-Quota Shield'}</span>
                </button>
              </div>
            )}
          </div>

          {shieldNotice && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
              {shieldNotice}
            </div>
          )}

          {/* Cache & Quota Mitigation Telemetry Strip */}
          <div className="grid grid-cols-1 gap-4 border-b border-slate-200 pb-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-xs text-slate-500">Server Cache Hit Rate</div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                {shield.cacheStats.hitRatePercent}%
              </div>
              <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                {shield.cacheStats.hits} hits · {shield.cacheStats.misses} misses · {shield.cacheStats.entries} keys
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Avoided DB Queries</div>
              <div className="mt-1 font-mono text-xl font-bold text-[#16A34A] tabular-nums">
                {shield.cacheStats.avoidedQueriesEstimate.toLocaleString()}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Served from Node TTL cache instead of Supabase
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Egress Optimization</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                CDN Headers + Slim Columns
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Public routes emit s-maxage=120–180s
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Client Tab Polling</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                Visibility-Paused (2m–5m)
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Background browser tabs make zero poll requests
              </div>
            </div>
          </div>

          {/* Per-Loop Schedule Governance Table */}
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Background Server Loop Governance
                </h4>
                <p className="text-xs text-slate-500">
                  Previously ran every 60s (1,440+ calls/day per loop). Throttled to 5m–60m with idle DB skipping.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-3 font-semibold">Background Loop</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">Interval</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Executed / Skipped</th>
                    <th className="py-2.5 px-3 font-semibold">Last Tick</th>
                    <th className="py-2.5 pl-3 text-right font-semibold">Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shield.loops.map((loop) => {
                    const statusText =
                      loop.lastOutcome === 'serverless_disabled'
                        ? 'Serverless Suppressed'
                        : !loop.effectiveActive
                          ? 'Paused'
                          : loop.lastOutcome === 'error'
                            ? 'Error'
                            : 'Throttled Active';
                    const statusColor =
                      loop.lastOutcome === 'error'
                        ? 'text-[#DC2626]'
                        : !loop.effectiveActive || loop.lastOutcome === 'serverless_disabled'
                          ? 'text-[#D97706]'
                          : 'text-[#16A34A]';

                    return (
                      <tr key={loop.id} className="hover:bg-slate-50/70">
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-slate-900">{loop.label}</div>
                          <div className="mt-0.5 text-[11px] text-slate-500 max-w-md">
                            {loop.description}
                          </div>
                        </td>
                        <td className={`py-3 px-3 font-medium whitespace-nowrap ${statusColor}`}>
                          {statusText}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <select
                            aria-label={`Interval for ${loop.label}`}
                            value={loop.intervalSeconds}
                            disabled={!canManageShield || shieldBusy}
                            onChange={(e) =>
                              handleLoopIntervalChange(loop.id, Number(e.target.value))
                            }
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 disabled:opacity-60"
                          >
                            <option value={300}>5 min</option>
                            <option value={900}>15 min</option>
                            <option value={1800}>30 min</option>
                            <option value={3600}>60 min</option>
                          </select>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                          {loop.runsCount} / {loop.skippedCount}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                          {loop.lastRunAt ? formatTimeLabel(loop.lastRunAt) : 'Waiting'}
                        </td>
                        <td className="py-3 pl-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            disabled={!canManageShield || shieldBusy}
                            onClick={() => handleLoopToggle(loop.id, !loop.enabled)}
                            className="min-h-[34px] rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                          >
                            {loop.enabled ? 'Pause' : 'Resume'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Trigger Cleanup SQL for Log Ingestion & Log Query Prevention */}
          <div className="border-t border-slate-200 pt-5 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Supabase Trigger &amp; Log Query Prevention SQL
                </h4>
                <p className="mt-0.5 text-xs text-slate-500">
                  Run once in Supabase SQL Editor to stop noisy telemetry tables from triggering data_audit_logs inserts and Realtime broadcasts. Also avoid leaving Supabase Dashboard Logs Explorer auto-refreshing (primary cause of Log Query spikes).
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyAuditSql}
                className="min-h-[38px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                {copiedSql ? (
                  <Check className="h-3.5 w-3.5 text-[#16A34A]" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copiedSql ? 'Copied Cleanup SQL' : 'Copy Cleanup SQL'}</span>
              </button>
            </div>
            <pre className="max-h-44 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3.5 font-mono text-[11px] leading-relaxed text-slate-700">
              {shield.auditTriggerSql}
            </pre>
          </div>
        </div>
      )}

      {/* Connection Reset & Backend Termination Confirmation Modal */}
      {restartModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="restart-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 id="restart-modal-title" className="font-display text-base font-bold text-slate-900">
                  Reset Connection Pools &amp; Terminate Idle Backends?
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Execute emergency connection reclamation to instantly recover database throughput when experiencing connection pool saturation or swap latency.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2.5 text-slate-700">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
                <span>Reclamation Operations Executed:</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                <li>
                  Executes <code className="font-mono font-semibold text-slate-800">pg_terminate_backend(pid)</code> on idle and hanging PostgreSQL client connections.
                </li>
                <li>
                  Clears Supabase singleton connection pools (<code className="font-mono text-slate-800">cachedDefaultClient</code> &amp; user client cache).
                </li>
                <li>
                  Flushes server-side response caches and client SWR inflight deduplication maps.
                </li>
                <li>
                  Current Database Load:{' '}
                  <strong className="font-mono font-bold text-slate-900">
                    {data?.supabase.activeConnections || 0} / {data?.supabase.maxConnections || 60} connections
                  </strong>{' '}
                  ({data?.supabase.storageUsedPercent || 0}% storage budget used).
                </li>
              </ul>
            </div>

            {restartError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {restartError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRestartModalOpen(false)}
                disabled={restarting}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestart}
                disabled={restarting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors disabled:opacity-60"
              >
                {restarting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>{restarting ? 'Resetting Pools...' : 'Confirm Reset & Drop Connections'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
