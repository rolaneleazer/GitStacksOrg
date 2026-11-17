import {
  Activity,
  Calendar,
  ExternalLink,
  FlaskConical,
  Globe2,
  MonitorSmartphone,
  RefreshCw,
  Search
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { ANALYTICS_DATE_PRESETS } from '../../shared/dateRanges.ts';
import type {
  AnalyticsChannelItem,
  AnalyticsCohortRow,
  AnalyticsDatePreset,
  AnalyticsDevicePlatformItem,
  AnalyticsEventCountItem,
  AnalyticsLandingPageItem,
  AnalyticsPageTitleItem,
  RealtimeActiveVisitorSummary
} from '../../shared/types.ts';

export interface DateRangeSelection {
  preset: AnalyticsDatePreset;
  startDate: string;
  endDate: string;
}

interface AnalyticsDateFilterBarProps {
  value: DateRangeSelection;
  onChange: (next: DateRangeSelection) => void;
  onRefresh: () => void;
  onSendLiveTestVisit: () => void;
  refreshing?: boolean;
  testingVisit?: boolean;
  refreshLabel?: string;
}

export function AnalyticsDateFilterBar({
  value,
  onChange,
  onRefresh,
  onSendLiveTestVisit,
  refreshing = false,
  testingVisit = false,
  refreshLabel = 'Refresh'
}: AnalyticsDateFilterBarProps) {
  const [draftStart, setDraftStart] = useState(
    value.startDate || new Date(Date.now() - 13 * 86400_000).toISOString().slice(0, 10)
  );
  const [draftEnd, setDraftEnd] = useState(
    value.endDate || new Date().toISOString().slice(0, 10)
  );

  const selectPreset = (preset: AnalyticsDatePreset) => {
    if (preset === 'custom') {
      onChange({
        preset: 'custom',
        startDate: draftStart,
        endDate: draftEnd
      });
      return;
    }
    onChange({
      preset,
      startDate: value.startDate,
      endDate: value.endDate
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {ANALYTICS_DATE_PRESETS.map((p) => {
            const active = value.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPreset(p.id)}
                className={`whitespace-nowrap shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? p.id === 'realtime'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.id === 'realtime' && (
                  <span
                    className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                      active ? 'bg-white animate-pulse' : 'bg-emerald-500'
                    }`}
                  />
                )}
                {p.shortLabel}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onSendLiveTestVisit}
            disabled={testingVisit}
            className="whitespace-nowrap shrink-0 min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <FlaskConical className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
            <span>{testingVisit ? 'Sending Ping...' : 'Test Live Visit'}</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="whitespace-nowrap shrink-0 min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshLabel}</span>
          </button>
        </div>
      </div>

      {value.preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <span className="font-semibold text-slate-700">Custom Range:</span>
          <input
            type="date"
            value={draftStart}
            onChange={(e) => setDraftStart(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs text-slate-900"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={draftEnd}
            onChange={(e) => setDraftEnd(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs text-slate-900"
          />
          <button
            type="button"
            onClick={() =>
              onChange({
                preset: 'custom',
                startDate: draftStart,
                endDate: draftEnd
              })
            }
            className="whitespace-nowrap shrink-0 rounded-md bg-[var(--gs-primary)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
          >
            Apply Range
          </button>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const sec = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export function formatDurationSeconds(sec: number): string {
  const s = Math.max(0, Math.round(sec || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

export function RealtimeMonitorView({
  realtime,
  ga4Realtime,
  autoPollEnabled,
  onToggleAutoPoll,
  onSendLiveTestVisit,
  testingVisit
}: {
  realtime?: RealtimeActiveVisitorSummary | null;
  ga4Realtime?: RealtimeActiveVisitorSummary | null;
  autoPollEnabled: boolean;
  onToggleAutoPoll: () => void;
  onSendLiveTestVisit: () => void;
  testingVisit: boolean;
}) {
  const perMin = realtime?.perMinute || [];
  const maxMinUsers = Math.max(
    1,
    ...perMin.map((m) => Math.max(m.activeUsers, m.events))
  );

  return (
    <div className="space-y-6">
      {/* Live Status Banner + Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>LIVE REALTIME STREAM · LAST 30 MINUTES</span>
            {realtime?.sampledAt && (
              <span className="font-mono text-[11px] font-normal text-slate-500 tabular-nums">
                · Updated {formatTimeAgo(realtime.sampledAt)}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Open your public site in another tab or click <strong>Test Live Visit</strong> to verify
            real-time route tracking, Edge IP city/country resolution, and conversion events.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Visit Live Site</span>
          </a>
          <button
            type="button"
            onClick={onSendLiveTestVisit}
            disabled={testingVisit}
            className="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <FlaskConical className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
            <span>{testingVisit ? 'Testing...' : 'Send Live Test Ping'}</span>
          </button>
          <button
            type="button"
            onClick={onToggleAutoPoll}
            className={`whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border ${
              autoPollEnabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>{autoPollEnabled ? 'Live Polling: ON (8s)' : 'Live Polling: PAUSED'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Active Users (Last 30 Min)
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {(realtime?.activeUsers30m ?? 0).toLocaleString()}
          </div>
          <p className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
            {ga4Realtime
              ? `GA4 Property Live: ${ga4Realtime.activeUsers30m}`
              : 'Deduplicated 30m visitors'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Active Right Now (5 Min)
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {(realtime?.activeUsers5m ?? 0).toLocaleString()}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Current live presence heartbeats</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Events (Last 30 Min)
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {(realtime?.events30m ?? 0).toLocaleString()}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Pageviews &amp; tracked actions</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Key Events (Last 30 Min)
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-[var(--gs-primary)] tabular-nums">
            {(realtime?.conversions30m ?? 0).toLocaleString()}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Inquiries, signups &amp; conversions</p>
        </div>
      </div>

      {/* Per-Minute Bar Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">
              Active Users &amp; Events Per Minute (Last 30 Minutes)
            </h3>
            <p className="text-[11px] text-slate-500">
              Rolling 1-minute buckets from -29m to Now
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[var(--gs-primary)]" />
              Active Users
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" />
              Events
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-end gap-1 h-36 border-b border-slate-200 pb-2 overflow-x-auto">
          {perMin.map((m) => {
            const uH = m.activeUsers > 0 ? Math.max(8, Math.round((m.activeUsers / maxMinUsers) * 116)) : 3;
            const eH = m.events > 0 ? Math.max(6, Math.round((m.events / maxMinUsers) * 116)) : 0;
            return (
              <div
                key={m.minuteLabel}
                title={`${m.minuteLabel}: ${m.activeUsers} users, ${m.events} events`}
                className="flex-1 min-w-[10px] flex flex-col items-center justify-end h-full group"
              >
                <div className="w-full flex items-end justify-center gap-0.5">
                  <div
                    className="w-2 rounded-t bg-[var(--gs-primary)] opacity-90 group-hover:opacity-100"
                    style={{ height: `${uH}px` }}
                  />
                  {eH > 0 && (
                    <div
                      className="w-1.5 rounded-t bg-emerald-500 opacity-80"
                      style={{ height: `${eH}px` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] text-slate-500 tabular-nums">
          <span>30 minutes ago</span>
          <span>15 minutes ago</span>
          <span>Now</span>
        </div>
      </div>

      {/* Live Geo, Active Pages & Channels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-display text-sm font-bold text-slate-900 border-b border-slate-200 pb-2.5">
            Live Active Pages
          </h3>
          <div className="mt-2 divide-y divide-slate-200">
            {(realtime?.activePages || []).length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">No active pages in last 30m.</p>
            ) : (
              realtime!.activePages.map((pg) => (
                <div key={pg.path} className="py-2 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-mono font-medium text-slate-900 truncate">{pg.path}</div>
                    <div className="text-[11px] text-slate-500 truncate">{pg.title}</div>
                  </div>
                  <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                    {pg.activeUsers}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-display text-sm font-bold text-slate-900 border-b border-slate-200 pb-2.5">
            Live Countries &amp; Cities
          </h3>
          <div className="mt-2 divide-y divide-slate-200">
            {(realtime?.activeCities || []).length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">No active locations yet.</p>
            ) : (
              realtime!.activeCities.map((ct) => (
                <div
                  key={`${ct.city}-${ct.country}`}
                  className="py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <span className="text-slate-800 truncate">
                    <span className="font-medium">{ct.city}</span>
                    {ct.country ? <span className="text-slate-400"> · {ct.country}</span> : null}
                  </span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                    {ct.activeUsers}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-display text-sm font-bold text-slate-900 border-b border-slate-200 pb-2.5">
            Live Acquisition Channels
          </h3>
          <div className="mt-2 divide-y divide-slate-200">
            {(realtime?.activeChannels || []).length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">No channel activity yet.</p>
            ) : (
              realtime!.activeChannels.map((ch) => (
                <div key={ch.channel} className="py-2 flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-800">{ch.channel}</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                    {ch.activeUsers}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Live Visitor Feed Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">
              Recent Live Visitors (Verification Feed)
            </h3>
            <p className="text-[11px] text-slate-500">
              Real-time visitor sessions with route, edge location, channel, and device
            </p>
          </div>
          <span className="font-mono text-[11px] text-slate-500 tabular-nums">
            {(realtime?.recentVisitors || []).length} recent
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Session</th>
                <th className="py-2.5 px-4 font-semibold">Route</th>
                <th className="py-2.5 px-4 font-semibold">Location</th>
                <th className="py-2.5 px-4 font-semibold">Channel</th>
                <th className="py-2.5 px-4 font-semibold">Device</th>
                <th className="py-2.5 px-4 font-semibold text-right">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(realtime?.recentVisitors || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No active visitors detected in the last 30 minutes. Open the public site or click{' '}
                    <strong>Send Live Test Ping</strong> to test live tracking.
                  </td>
                </tr>
              ) : (
                realtime!.recentVisitors.map((v) => (
                  <tr key={v.session_id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                      {v.session_id}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-900 max-w-[200px] truncate">
                      {v.current_path}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                      {v.city || 'Localhost'}
                      {v.country ? <span className="text-slate-400"> · {v.country}</span> : null}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                      {v.channel_group || 'Direct'}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600 capitalize whitespace-nowrap">
                      {v.device_type}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 text-right tabular-nums whitespace-nowrap">
                      {formatTimeAgo(v.last_seen_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ChannelAndPlatformCards({
  channels,
  devices,
  newUsers,
  returningUsers
}: {
  channels: AnalyticsChannelItem[];
  devices: AnalyticsDevicePlatformItem[];
  newUsers: number;
  returningUsers: number;
}) {
  const maxChanUsers = Math.max(1, ...channels.map((c) => Math.max(c.newUsers, c.activeUsers)));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* New Users by Primary Channel Group */}
      <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">
              New Users by First User Primary Channel Group
            </h3>
            <p className="text-[11px] text-slate-500">
              Acquisition attribution across Direct, Search, AI Assistants, Referral &amp; Social
            </p>
          </div>
          <Globe2 className="h-4 w-4 text-slate-400" />
        </div>

        <div className="mt-4 space-y-3">
          {channels.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">
              No channel attribution events in selected date range.
            </p>
          ) : (
            channels.map((ch) => {
              const barPct = Math.max(4, Math.round((ch.activeUsers / maxChanUsers) * 100));
              return (
                <div key={ch.channel} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">{ch.channel}</span>
                    <span className="font-mono text-slate-900 tabular-nums">
                      <strong>{ch.newUsers.toLocaleString()}</strong> new{' '}
                      <span className="text-slate-400">
                        · {ch.activeUsers.toLocaleString()} active · {ch.sessions.toLocaleString()} sessions
                      </span>
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-xs bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-[var(--gs-primary)]"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Platform / Device & Audience Split */}
      <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">
              Platform &amp; Device Breakdown
            </h3>
            <p className="text-[11px] text-slate-500">Audience share by device class &amp; loyalty</p>
          </div>
          <MonitorSmartphone className="h-4 w-4 text-slate-400" />
        </div>

        <div className="space-y-3">
          {devices.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">No device metrics yet.</p>
          ) : (
            devices.map((d) => (
              <div key={d.device} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800">
                    {d.platform} · {d.device}
                  </span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {d.percent}% ({d.users.toLocaleString()})
                  </span>
                </div>
                <div className="h-2 w-full rounded-xs bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-[#3B82F6]"
                    style={{ width: `${Math.max(4, d.percent)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-slate-200 pt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Audience Loyalty (New vs Returning)
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] text-slate-500">New Users</div>
              <div className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                {newUsers.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] text-slate-500">Returning Users</div>
              <div className="font-mono text-lg font-bold text-[var(--gs-primary)] tabular-nums">
                {returningUsers.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPagesAndEventsView({
  landingPages,
  pageTitles,
  eventCounts
}: {
  landingPages: AnalyticsLandingPageItem[];
  pageTitles: AnalyticsPageTitleItem[];
  eventCounts: AnalyticsEventCountItem[];
}) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'sessions' | 'activeUsers' | 'keyEvents'>('sessions');

  const filteredLanding = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...landingPages]
      .filter((lp) => !q || lp.landingPage.toLowerCase().includes(q))
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [landingPages, search, sortBy]);

  const totals = useMemo(() => {
    const sessions = filteredLanding.reduce((s, r) => s + r.sessions, 0);
    const activeUsers = filteredLanding.reduce((s, r) => s + r.activeUsers, 0);
    const newUsers = filteredLanding.reduce((s, r) => s + r.newUsers, 0);
    const keyEvents = filteredLanding.reduce((s, r) => s + r.keyEvents, 0);
    const avgEng =
      filteredLanding.length > 0
        ? Math.round(
            filteredLanding.reduce((s, r) => s + r.avgEngagementSeconds, 0) /
              filteredLanding.length
          )
        : 0;
    const rate = sessions > 0 ? Number(((keyEvents / sessions) * 100).toFixed(1)) : 0;
    return { sessions, activeUsers, newUsers, keyEvents, avgEng, rate };
  }, [filteredLanding]);

  return (
    <div className="space-y-6">
      {/* Landing Pages Explorer */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">
              Landing Pages Performance
            </h3>
            <p className="text-[11px] text-slate-500">
              Entry routes ranked by sessions, engagement duration, and key conversion rate
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search landing page..."
                className="rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'sessions' | 'activeUsers' | 'keyEvents')
              }
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
            >
              <option value="sessions">Sort: Sessions</option>
              <option value="activeUsers">Sort: Active Users</option>
              <option value="keyEvents">Sort: Key Events</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Landing Page</th>
                <th className="py-2.5 px-4 font-semibold text-right">Sessions</th>
                <th className="py-2.5 px-4 font-semibold text-right">Active Users</th>
                <th className="py-2.5 px-4 font-semibold text-right">New Users</th>
                <th className="py-2.5 px-4 font-semibold text-right">Avg Engagement</th>
                <th className="py-2.5 px-4 font-semibold text-right">Key Events</th>
                <th className="py-2.5 px-4 font-semibold text-right">Key Event Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLanding.length > 0 && (
                <tr className="bg-slate-50/70 font-semibold text-slate-900">
                  <td className="py-2.5 px-4">Total ({filteredLanding.length} routes)</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {totals.sessions.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {totals.activeUsers.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {totals.newUsers.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {formatDurationSeconds(totals.avgEng)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {totals.keyEvents.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {totals.rate}%
                  </td>
                </tr>
              )}
              {filteredLanding.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No landing page records match the current date filter.
                  </td>
                </tr>
              ) : (
                filteredLanding.map((lp) => (
                  <tr key={lp.landingPage} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-slate-900 max-w-[260px] truncate">
                      {lp.landingPage}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-800 tabular-nums">
                      {lp.sessions.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-800 tabular-nums">
                      {lp.activeUsers.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-800 tabular-nums">
                      {lp.newUsers.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-700 tabular-nums">
                      {formatDurationSeconds(lp.avgEngagementSeconds)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-700 tabular-nums">
                      {lp.keyEvents.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-700 tabular-nums">
                      {lp.keyEventRatePercent}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Views by Page Title & Event Count by Event Name */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="font-display text-sm font-bold text-slate-900">
              Views by Page Title &amp; Screen Path
            </h3>
            <span className="font-mono text-[11px] text-slate-500 tabular-nums">
              {pageTitles.length} pages
            </span>
          </div>
          <div className="mt-2 divide-y divide-slate-200">
            {pageTitles.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">No page views recorded.</p>
            ) : (
              pageTitles.map((pt) => (
                <div
                  key={`${pt.title}-${pt.path}`}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{pt.title}</div>
                    <div className="font-mono text-[11px] text-slate-500 truncate">{pt.path}</div>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="font-bold text-slate-900">{pt.views.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-500">{pt.activeUsers} users</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="font-display text-sm font-bold text-slate-900">
              Event Count by Event Name
            </h3>
            <span className="font-mono text-[11px] text-slate-500 tabular-nums">
              {eventCounts.length} events
            </span>
          </div>
          <div className="mt-2 divide-y divide-slate-200">
            {eventCounts.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">No events recorded.</p>
            ) : (
              eventCounts.map((ev) => (
                <div
                  key={ev.eventName}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-mono font-semibold text-slate-900 truncate">
                      {ev.eventName}
                    </div>
                    {ev.conversions > 0 && (
                      <div className="font-mono text-[11px] text-emerald-700">
                        {ev.conversions.toLocaleString()} key events
                      </div>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                    {ev.count.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RetentionCohortsView({
  cohorts,
  series
}: {
  cohorts: AnalyticsCohortRow[];
  series: Array<{ label: string; activeUsers: number; newUsers: number }>;
}) {
  const maxU = Math.max(1, ...series.map((s) => Math.max(s.activeUsers, s.newUsers)));

  const getCellStyle = (pct: number | undefined) => {
    if (pct === undefined) return 'bg-slate-50 text-slate-300';
    if (pct >= 75) return 'bg-[#1D4ED8] text-white font-semibold';
    if (pct >= 40) return 'bg-[#3B82F6] text-white font-semibold';
    if (pct >= 15) return 'bg-[#93C5FD] text-slate-900 font-semibold';
    if (pct > 0) return 'bg-[#DBEAFE] text-slate-800';
    return 'bg-slate-100 text-slate-400';
  };

  return (
    <div className="space-y-6">
      {/* Active vs New Users Trend */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">
              Active Users vs. New Users
            </h3>
            <p className="text-[11px] text-slate-500">
              Comparison of returning vs newly acquired visitors across selected time buckets
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[var(--gs-primary)]" />
              Active Users
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-sky-400" />
              New Users
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-end gap-1.5 h-40 border-b border-slate-200 pb-2 overflow-x-auto">
          {series.length === 0 ? (
            <div className="w-full py-12 text-center text-xs text-slate-500">
              No retention trend buckets in selected range.
            </div>
          ) : (
            series.map((s) => {
              const aH = s.activeUsers > 0 ? Math.max(6, Math.round((s.activeUsers / maxU) * 124)) : 2;
              const nH = s.newUsers > 0 ? Math.max(6, Math.round((s.newUsers / maxU) * 124)) : 0;
              return (
                <div
                  key={s.label}
                  title={`${s.label}: ${s.activeUsers} active, ${s.newUsers} new`}
                  className="flex-1 min-w-[14px] flex flex-col items-center justify-end h-full"
                >
                  <div className="w-full flex items-end justify-center gap-0.5">
                    <div
                      className="w-2 rounded-t bg-[var(--gs-primary)]"
                      style={{ height: `${aH}px` }}
                    />
                    {nH > 0 && (
                      <div
                        className="w-2 rounded-t bg-sky-400"
                        style={{ height: `${nH}px` }}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {series.length > 0 && (
          <div className="mt-2 flex justify-between font-mono text-[10px] text-slate-500 tabular-nums">
            <span>{series[0]?.label}</span>
            <span>{series[series.length - 1]?.label}</span>
          </div>
        )}
      </div>

      {/* Weekly Cohort Matrix */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">
              User Activity by Cohort (6-Week Retention Matrix)
            </h3>
            <p className="text-[11px] text-slate-500">
              Weekly cohort retention based on persistent visitor identity
            </p>
          </div>
          <span className="font-mono text-[11px] text-slate-500 tabular-nums">Week 0 – Week 5</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Cohort Week</th>
                <th className="py-2.5 px-4 font-semibold text-right">Users</th>
                <th className="py-2.5 px-3 font-semibold text-center">Week 0</th>
                <th className="py-2.5 px-3 font-semibold text-center">Week 1</th>
                <th className="py-2.5 px-3 font-semibold text-center">Week 2</th>
                <th className="py-2.5 px-3 font-semibold text-center">Week 3</th>
                <th className="py-2.5 px-3 font-semibold text-center">Week 4</th>
                <th className="py-2.5 px-3 font-semibold text-center">Week 5</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {cohorts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Cohort matrix populates automatically as multi-week visitor history accrues.
                  </td>
                </tr>
              ) : (
                cohorts.map((row) => (
                  <tr key={row.cohortLabel}>
                    <td className="py-2.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                      {row.cohortLabel}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {row.cohortSize.toLocaleString()}
                    </td>
                    {[0, 1, 2, 3, 4, 5].map((wk) => {
                      const val = row.retentionByWeek[wk];
                      return (
                        <td key={wk} className="p-1.5 text-center">
                          <div
                            className={`rounded-md py-1.5 px-2 font-mono text-[11px] tabular-nums ${getCellStyle(
                              val
                            )}`}
                          >
                            {val !== undefined ? `${val}%` : '—'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
