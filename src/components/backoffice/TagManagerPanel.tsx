import {
  Activity,
  Check,
  Code2,
  Copy,
  Download,
  FileText,
  Filter,
  FolderGit2,
  Globe2,
  Layers,
  Link2,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  Tags,
  TrendingUp,
  Unplug
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval.ts';
import { api } from '../../lib/api.ts';
import {
  clearGtmOAuthToken,
  fetchGtmWorkspaceSnapshot,
  getCachedGtmAccessToken,
  signInWithGoogleTagManagerPopup
} from '../../lib/googleTagManagerOAuth.ts';
import {
  DEFAULT_GTM_CONTAINER_ID,
  getGtmSnippetString,
  getRecentClientDataLayerEvents
} from '../../lib/tagManager.ts';
import { resolveDateRangeBounds } from '../../shared/dateRanges.ts';
import type {
  AdSenseSettings,
  AnalyticsEventCountItem,
  GtmContainerOption,
  GtmDashboardResponse,
  GtmEventCategory,
  GtmEventLog,
  GtmSettingsConfig,
  GtmWorkspaceSnapshot,
  IntegrationStatusItem
} from '../../shared/types.ts';
import {
  AnalyticsDateFilterBar,
  ChannelAndPlatformCards,
  type DateRangeSelection,
  formatDurationSeconds,
  LandingPagesAndEventsView,
  RealtimeMonitorView,
  RetentionCohortsView
} from './AnalyticsSharedSections.tsx';
import { GeoWorldMap } from './GeoWorldMap.tsx';

interface TagManagerPanelProps {
  settings: AdSenseSettings;
  onSettingsUpdated: (next: AdSenseSettings) => void;
}

type GtmSubTab =
  | 'realtime'
  | 'overview'
  | 'demographics'
  | 'pages'
  | 'retention'
  | 'stream'
  | 'oauth'
  | 'config';
type GtmInspectTab = 'tags' | 'triggers' | 'variables';

const CATEGORY_OPTIONS: Array<{ value: 'all' | GtmEventCategory; label: string }> = [
  { value: 'all', label: 'All Categories' },
  { value: 'conversion', label: 'Conversions' },
  { value: 'pageview', label: 'Page Views' },
  { value: 'lifecycle', label: 'Container Lifecycle' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'custom', label: 'Custom Events' }
];

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'No events yet';
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

function formatShortTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().slice(5, 10)} ${d.toISOString().slice(11, 19)}`;
}

export function TagManagerPanel({ settings, onSettingsUpdated }: TagManagerPanelProps) {
  const [subTab, setSubTab] = useState<GtmSubTab>('overview');
  const [range, setRange] = useState<DateRangeSelection>(() => {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10);
    return { preset: '7d', startDate: start, endDate: end };
  });
  const [dashboard, setDashboard] = useState<GtmDashboardResponse | null>(null);
  const [realtimeSnapshot, setRealtimeSnapshot] = useState<GtmDashboardResponse['realtime'] | null>(
    null
  );
  const [autoPoll, setAutoPoll] = useState(true);
  const [gtmIntegration, setGtmIntegration] = useState<IntegrationStatusItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [testingPing, setTestingPing] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Stream filters & inspector
  const [streamQuery, setStreamQuery] = useState('');
  const [streamCategory, setStreamCategory] = useState<'all' | GtmEventCategory>('all');
  const [selectedEvent, setSelectedEvent] = useState<GtmEventLog | null>(null);

  // OAuth container inspection sub-tabs
  const [inspectTab, setInspectTab] = useState<GtmInspectTab>('tags');
  const [inspectQuery, setInspectQuery] = useState('');
  const [selectedContainerId, setSelectedContainerId] = useState('');

  // Config form state
  const [configDraft, setConfigDraft] = useState<GtmSettingsConfig>({
    gtm_enabled: settings.gtm_enabled !== undefined ? Boolean(settings.gtm_enabled) : true,
    gtm_container_id: (settings.gtm_container_id || DEFAULT_GTM_CONTAINER_ID).trim().toUpperCase(),
    gtm_track_datalayer:
      settings.gtm_track_datalayer !== undefined ? Boolean(settings.gtm_track_datalayer) : true,
    gtm_track_conversions:
      settings.gtm_track_conversions !== undefined ? Boolean(settings.gtm_track_conversions) : true,
    gtm_respect_consent: Boolean(settings.gtm_respect_consent),
    gtm_exclude_admin:
      settings.gtm_exclude_admin !== undefined ? Boolean(settings.gtm_exclude_admin) : true
  });
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const rangeMeta = useMemo(
    () => resolveDateRangeBounds(range.preset, range.startDate, range.endDate),
    [range.endDate, range.preset, range.startDate]
  );

  const loadData = useCallback(
    async (targetRange: DateRangeSelection, silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const [dashRes, intRes] = await Promise.all([
          api.getGtmDashboard({
            preset: targetRange.preset,
            startDate: targetRange.startDate,
            endDate: targetRange.endDate
          }),
          api.listIntegrations().catch(() => ({ integrations: [] as IntegrationStatusItem[] }))
        ]);
        setDashboard(dashRes);
        if (dashRes.realtime) setRealtimeSnapshot(dashRes.realtime);
        setConfigDraft(dashRes.settings);
        const found = intRes.integrations.find((i) => i.provider === 'google_tag_manager') || null;
        setGtmIntegration(found);
        if (found?.configMeta?.gtm_container_id) {
          setSelectedContainerId(found.configMeta.gtm_container_id);
        }
        if (dashRes.recentEvents.length > 0) {
          setSelectedEvent((prev) => prev || dashRes.recentEvents[0]);
        }
      } catch (err) {
        setNotice({
          type: 'err',
          text: err instanceof Error ? err.message : 'Unable to load Tag Manager telemetry.'
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  const pollRealtimeGtm = useCallback(async () => {
    try {
      const rtDash = await api.getGtmDashboard({ preset: 'realtime' });
      if (rtDash.realtime) setRealtimeSnapshot(rtDash.realtime);
      if (range.preset === 'realtime') {
        setDashboard(rtDash);
      }
    } catch {
      // ignore transient poll failures
    }
  }, [range.preset]);

  useEffect(() => {
    loadData(range);
  }, [loadData, range]);

  const shouldPollRealtime =
    autoPoll && (subTab === 'realtime' || range.preset === 'realtime');
  useVisibilityInterval(
    pollRealtimeGtm,
    shouldPollRealtime ? 60_000 : null
  );

  const handleRangeChange = (next: DateRangeSelection) => {
    setRange(next);
    if (next.preset === 'realtime') {
      setSubTab('realtime');
    } else if (subTab === 'realtime') {
      setSubTab('overview');
    }
  };

  const handleSendLiveTestVisit = async () => {
    setTestingPing(true);
    setNotice(null);
    try {
      await api.sendPublicPresence('/?test_visit=1', 6);
      const res = await api.sendGtmTestEvent({
        event_name: 'gtm_live_visit_test',
        event_category: 'pageview',
        is_conversion: false,
        preset: range.preset,
        startDate: range.startDate,
        endDate: range.endDate
      });
      setDashboard(res.dashboard);
      if (res.dashboard.realtime) setRealtimeSnapshot(res.dashboard.realtime);
      setSelectedEvent(res.event);
      setNotice({
        type: 'ok',
        text: `Live test ping dispatched for ${configDraft.gtm_container_id}. Verified in Realtime & dataLayer stream.`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to send live test ping.'
      });
    } finally {
      setTestingPing(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setNotice(null);
    try {
      const normalizedId = configDraft.gtm_container_id.trim().toUpperCase();
      const res = await api.saveGtmSettings({
        ...configDraft,
        gtm_container_id: normalizedId
      });
      setConfigDraft(res.gtmSettings);
      onSettingsUpdated(res.settings);
      setDashboard((prev) => (prev ? { ...prev, settings: res.gtmSettings } : prev));
      setNotice({
        type: 'ok',
        text: `Saved Tag Manager settings (${res.gtmSettings.gtm_container_id}).`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save GTM configuration.'
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleConnectGtmOAuth = async () => {
    setOauthBusy(true);
    setNotice(null);
    try {
      const oauthRes = await signInWithGoogleTagManagerPopup(configDraft.gtm_container_id);
      const chosen = oauthRes.selectedContainer;
      const saved = await api.saveIntegration('google_tag_manager', {
        secret: oauthRes.accessToken,
        configMeta: {
          gtm_account_email: oauthRes.email,
          gtm_account_name: oauthRes.displayName,
          gtm_account_id: chosen?.accountId || '',
          gtm_container_id: chosen?.containerId || '',
          gtm_container_public_id: chosen?.publicId || configDraft.gtm_container_id,
          gtm_container_name: chosen?.name || 'GitStack GTM Container',
          gtm_workspace_id: chosen?.workspaceId || '',
          gtm_workspace_name: chosen?.workspaceName || '',
          gtm_containers_list: oauthRes.containers,
          gtm_snapshot: oauthRes.snapshot
        }
      });
      setGtmIntegration(saved.integration);
      if (chosen?.containerId) setSelectedContainerId(chosen.containerId);
      setNotice({
        type: 'ok',
        text: chosen
          ? `Connected ${oauthRes.email} · Synced ${chosen.name} (${chosen.publicId}) with ${oauthRes.snapshot?.tags.length || 0} tags.`
          : `Authenticated ${oauthRes.email}. ${oauthRes.apiNote || 'No GTM containers found.'}`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Google Tag Manager OAuth was cancelled or blocked.'
      });
    } finally {
      setOauthBusy(false);
    }
  };

  const handleSwitchOAuthContainer = async (containerId: string) => {
    const containers = gtmIntegration?.configMeta?.gtm_containers_list || [];
    const chosen = containers.find((c) => c.containerId === containerId);
    if (!chosen || !gtmIntegration) return;
    setSelectedContainerId(containerId);
    const token = getCachedGtmAccessToken();
    if (!token) {
      setNotice({
        type: 'err',
        text: 'OAuth session token expired. Click "Reconnect / Sync GTM OAuth" to refresh live workspace inspection.'
      });
      return;
    }
    setOauthBusy(true);
    setNotice(null);
    try {
      const snapshot = await fetchGtmWorkspaceSnapshot(token, chosen);
      const saved = await api.saveIntegration('google_tag_manager', {
        secret: token,
        configMeta: {
          ...gtmIntegration.configMeta,
          gtm_account_id: chosen.accountId,
          gtm_container_id: chosen.containerId,
          gtm_container_public_id: chosen.publicId,
          gtm_container_name: chosen.name,
          gtm_workspace_id: chosen.workspaceId,
          gtm_workspace_name: chosen.workspaceName,
          gtm_snapshot: snapshot
        }
      });
      setGtmIntegration(saved.integration);
      setNotice({
        type: 'ok',
        text: `Synced ${chosen.name} (${chosen.publicId}): ${snapshot.tags.length} tags, ${snapshot.triggers.length} triggers, ${snapshot.variables.length} variables.`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to sync selected GTM container.'
      });
    } finally {
      setOauthBusy(false);
    }
  };

  const handleDisconnectGtmOAuth = async () => {
    setOauthBusy(true);
    setNotice(null);
    try {
      clearGtmOAuthToken();
      const res = await api.disconnectIntegration('google_tag_manager');
      setGtmIntegration(res.integration);
      setNotice({
        type: 'ok',
        text: 'Google Tag Manager OAuth disconnected. First-party telemetry remains active.'
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to disconnect GTM OAuth.'
      });
    } finally {
      setOauthBusy(false);
    }
  };

  const filteredStream = useMemo(() => {
    const q = streamQuery.trim().toLowerCase();
    const list = dashboard?.recentEvents || [];
    return list.filter((evt) => {
      if (streamCategory !== 'all' && evt.event_category !== streamCategory) return false;
      if (!q) return true;
      return (
        evt.event_name.toLowerCase().includes(q) ||
        evt.page_path.toLowerCase().includes(q) ||
        evt.session_id.toLowerCase().includes(q)
      );
    });
  }, [dashboard?.recentEvents, streamCategory, streamQuery]);

  const handleExportStreamCsv = () => {
    const rows = filteredStream;
    const header = [
      'created_at',
      'container_id',
      'event_name',
      'category',
      'is_conversion',
      'page_path',
      'session_id'
    ];
    const csvLines = [
      header.join(','),
      ...rows.map((r) =>
        [
          r.created_at,
          r.container_id,
          r.event_name,
          r.event_category,
          r.is_conversion ? 'true' : 'false',
          r.page_path,
          r.session_id
        ]
          .map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`)
          .join(',')
      )
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gtm-datalayer-${configDraft.gtm_container_id}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(getGtmSnippetString(configDraft.gtm_container_id));
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const snapshot: GtmWorkspaceSnapshot | null = gtmIntegration?.configMeta?.gtm_snapshot || null;
  const oauthContainers: GtmContainerOption[] =
    gtmIntegration?.configMeta?.gtm_containers_list || [];

  const filteredSnapshotItems = useMemo(() => {
    const q = inspectQuery.trim().toLowerCase();
    if (!snapshot) return { tags: [], triggers: [], variables: [] };
    return {
      tags: snapshot.tags.filter(
        (t) => !q || t.name.toLowerCase().includes(q) || t.type.toLowerCase().includes(q)
      ),
      triggers: snapshot.triggers.filter(
        (t) => !q || t.name.toLowerCase().includes(q) || t.type.toLowerCase().includes(q)
      ),
      variables: snapshot.variables.filter(
        (v) => !q || v.name.toLowerCase().includes(q) || v.type.toLowerCase().includes(q)
      )
    };
  }, [inspectQuery, snapshot]);

  const maxBucketEvents = useMemo(() => {
    const vals = (dashboard?.series || []).map((b) => b.events);
    return Math.max(1, ...vals);
  }, [dashboard?.series]);

  const gtmEventCounts: AnalyticsEventCountItem[] = useMemo(
    () =>
      (dashboard?.topEvents || []).map((e) => ({
        eventName: e.event_name,
        count: e.count,
        conversions: e.conversions
      })),
    [dashboard?.topEvents]
  );

  const retentionSeries = useMemo(
    () =>
      (dashboard?.series || []).map((b) => ({
        label: b.label,
        activeUsers: b.activeUsers ?? b.events,
        newUsers: b.newUsers ?? 0
      })),
    [dashboard?.series]
  );

  const clientLocalCount =
    typeof window !== 'undefined' ? getRecentClientDataLayerEvents().length : 0;
  const browserDataLayerLen =
    typeof window !== 'undefined' && Array.isArray(window.dataLayer)
      ? window.dataLayer.length
      : 0;
  const liveActiveRightNow = (realtimeSnapshot || dashboard?.realtime)?.activeUsers5m ?? 0;

  return (
    <div className="space-y-6">
      {/* Header Control Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-[var(--gs-primary)]">Google Tag Manager</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-semibold text-slate-800">
                {configDraft.gtm_container_id}
              </span>
              <span aria-hidden="true">·</span>
              <span
                className={`font-semibold ${
                  configDraft.gtm_enabled ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {configDraft.gtm_enabled ? 'Container Active' : 'Container Paused'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-600">{rangeMeta.label}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-emerald-700 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {liveActiveRightNow} live
              </span>
              {gtmIntegration?.connected && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-600">
                    OAuth: {gtmIntegration.configMeta.gtm_account_email}
                  </span>
                </>
              )}
            </div>
            <h2 className="mt-1 font-display text-lg font-bold text-slate-900">
              Tag Manager &amp; dataLayer Telemetry Hub
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Real-time <code className="font-mono text-slate-800">window.dataLayer</code> &amp;{' '}
              <code className="font-mono text-slate-800">gtag()</code> ingestion, Edge Geo demographics,
              landing pages, retention cohorts, and GTM API v2 workspace inspection.
            </p>
          </div>
        </div>

        <AnalyticsDateFilterBar
          value={range}
          onChange={handleRangeChange}
          onRefresh={() => loadData(range, true)}
          onSendLiveTestVisit={handleSendLiveTestVisit}
          refreshing={refreshing}
          testingVisit={testingPing}
        />

        {/* Sub-navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
          {(
            [
              { id: 'realtime', label: `Realtime (${liveActiveRightNow})`, icon: Activity },
              { id: 'overview', label: 'Overview & Acquisition', icon: Tags },
              { id: 'demographics', label: 'Demographics', icon: Globe2 },
              { id: 'pages', label: 'Landing Pages & Pages', icon: FileText },
              { id: 'retention', label: 'Retention & Cohorts', icon: TrendingUp },
              { id: 'stream', label: 'Live dataLayer Stream', icon: Layers },
              { id: 'oauth', label: 'Container & OAuth Sync', icon: Link2 },
              { id: 'config', label: 'Configuration & Snippet', icon: Sliders }
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={`whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[var(--gs-primary)] text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-medium ${
            notice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {notice.text}
        </div>
      )}

      {loading && !dashboard ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500">
          Loading Google Tag Manager container telemetry...
        </div>
      ) : (
        <>
          {/* SUB-TAB: REALTIME 30m */}
          {subTab === 'realtime' && (
            <RealtimeMonitorView
              realtime={realtimeSnapshot || dashboard?.realtime || null}
              autoPollEnabled={autoPoll}
              onToggleAutoPoll={() => setAutoPoll((v) => !v)}
              onSendLiveTestVisit={handleSendLiveTestVisit}
              testingVisit={testingPing}
            />
          )}

          {/* SUB-TAB: OVERVIEW & ACQUISITION */}
          {subTab === 'overview' && dashboard && (
            <div className="space-y-6">
              {/* 5 KPI Summary Strip */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Total dataLayer Events
                  </div>
                  <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {dashboard.summary.totalEvents.toLocaleString()}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
                    {dashboard.summary.uniqueEventNames} names ·{' '}
                    {formatRelativeTime(dashboard.summary.lastEventAt)}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Active / New Users
                  </div>
                  <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {(
                      dashboard.summary.activeUsers ?? dashboard.summary.uniqueSessions
                    ).toLocaleString()}{' '}
                    <span className="text-base font-normal text-slate-400">
                      / {(dashboard.summary.newUsers ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
                    {dashboard.summary.returningUsers ?? 0} returning
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Tracked Conversions
                  </div>
                  <div className="mt-2 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
                    {dashboard.summary.conversionEvents.toLocaleString()}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
                    {dashboard.summary.conversionRatePercent}% session conversion rate
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Virtual Page Views
                  </div>
                  <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {dashboard.summary.pageViews.toLocaleString()}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
                    Avg dwell: {formatDurationSeconds(dashboard.summary.avgEngagementSeconds ?? 0)}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Unique Visitor Sessions
                  </div>
                  <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {dashboard.summary.uniqueSessions.toLocaleString()}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
                    Buffer: {clientLocalCount} · dataLayer: {browserDataLayerLen}
                  </div>
                </div>
              </div>

              {/* Event Volume & Conversion Bar Series */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      dataLayer Event Volume &amp; Conversions ({rangeMeta.label})
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Bucketed by {dashboard.bucketMode || rangeMeta.bucketMode} across public site
                      visits and funnel actions
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-xs bg-[var(--gs-primary)]" />
                      All Events
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
                      Conversions
                    </span>
                  </div>
                </div>

                {dashboard.series.length === 0 || dashboard.summary.totalEvents === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-500">
                    No GTM telemetry events recorded in this window yet. Browse public pages or
                    click <strong>Test Live Visit</strong> to populate live metrics.
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <div className="min-w-[540px] flex items-end gap-1.5 h-44 pt-4">
                      {dashboard.series.map((bucket) => {
                        const evtH = Math.max(
                          4,
                          Math.round((bucket.events / maxBucketEvents) * 130)
                        );
                        const convH =
                          bucket.conversions > 0
                            ? Math.max(4, Math.round((bucket.conversions / maxBucketEvents) * 130))
                            : 0;
                        return (
                          <div
                            key={bucket.label}
                            title={`${bucket.label}: ${bucket.events} events (${bucket.conversions} conversions)`}
                            className="flex-1 flex flex-col items-center justify-end gap-1 group"
                          >
                            <div className="w-full flex items-end justify-center gap-0.5 h-[136px]">
                              <div
                                className="w-2.5 rounded-t bg-[var(--gs-primary)]/85 group-hover:bg-[var(--gs-primary)] transition-all"
                                style={{ height: `${bucket.events > 0 ? evtH : 2}px` }}
                              />
                              {convH > 0 && (
                                <div
                                  className="w-2 rounded-t bg-emerald-600"
                                  style={{ height: `${convH}px` }}
                                />
                              )}
                            </div>
                            <span className="font-mono text-[10px] text-slate-500 tabular-nums truncate max-w-full">
                              {bucket.label.length > 7 ? bucket.label.slice(5) : bucket.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Channel & Platform Cards */}
              <ChannelAndPlatformCards
                channels={dashboard.channels || []}
                devices={dashboard.devices || []}
                newUsers={dashboard.summary.newUsers ?? 0}
                returningUsers={dashboard.summary.returningUsers ?? 0}
              />

              {/* Top Events + Top Pages Tables */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Top Fired dataLayer Events
                    </h3>
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {dashboard.topEvents.length} distinct
                    </span>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {dashboard.topEvents.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No events captured yet.
                      </div>
                    ) : (
                      dashboard.topEvents.map((ev) => (
                        <div
                          key={ev.event_name}
                          className="flex items-center justify-between px-5 py-2.5 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-mono font-semibold text-slate-900 truncate">
                              {ev.event_name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {ev.category}
                              {ev.conversions > 0 && (
                                <>
                                  {' · '}
                                  <span className="font-mono text-emerald-700">
                                    {ev.conversions} conversions
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className="font-mono font-bold text-slate-900 tabular-nums">
                            {ev.count.toLocaleString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Top Pages by Tag Fires
                    </h3>
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {dashboard.topPages.length} routes
                    </span>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {dashboard.topPages.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No routes captured yet.
                      </div>
                    ) : (
                      dashboard.topPages.map((pg) => (
                        <div
                          key={pg.page_path}
                          className="flex items-center justify-between px-5 py-2.5 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-mono font-medium text-slate-900 truncate">
                              {pg.page_path}
                            </div>
                            {pg.conversions > 0 && (
                              <div className="text-[11px] font-mono text-emerald-700 tabular-nums">
                                {pg.conversions} conversion triggers
                              </div>
                            )}
                          </div>
                          <span className="font-mono font-bold text-slate-900 tabular-nums">
                            {pg.events.toLocaleString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB: DEMOGRAPHICS */}
          {subTab === 'demographics' && dashboard && (
            <GeoWorldMap
              countries={dashboard.countries || []}
              cities={dashboard.cities || []}
              title={`Tag Manager Visitor Countries & Cities (${rangeMeta.label})`}
            />
          )}

          {/* SUB-TAB: LANDING PAGES & PAGES */}
          {subTab === 'pages' && dashboard && (
            <LandingPagesAndEventsView
              landingPages={dashboard.landingPages || []}
              pageTitles={dashboard.pageTitles || []}
              eventCounts={gtmEventCounts}
            />
          )}

          {/* SUB-TAB: RETENTION & COHORTS */}
          {subTab === 'retention' && dashboard && (
            <RetentionCohortsView
              cohorts={dashboard.cohorts || []}
              series={retentionSeries}
            />
          )}

          {/* SUB-TAB: LIVE DATALAYER STREAM */}
          {subTab === 'stream' && dashboard && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[220px]">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={streamQuery}
                        onChange={(e) => setStreamQuery(e.target.value)}
                        placeholder="Filter by event name, path, or session..."
                        className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                      />
                    </div>
                    <div className="inline-flex items-center gap-1.5">
                      <Filter className="h-3.5 w-3.5 text-slate-400" />
                      <select
                        value={streamCategory}
                        onChange={(e) =>
                          setStreamCategory(e.target.value as 'all' | GtmEventCategory)
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-[var(--gs-primary)] focus:outline-none"
                      >
                        {CATEGORY_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportStreamCsv}
                    disabled={filteredStream.length === 0}
                    className="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export CSV ({filteredStream.length})</span>
                  </button>
                </div>

                <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Timestamp (UTC)</th>
                        <th className="py-2.5 px-4 font-semibold">Event</th>
                        <th className="py-2.5 px-4 font-semibold">Category</th>
                        <th className="py-2.5 px-4 font-semibold">Page Path</th>
                        <th className="py-2.5 px-4 font-semibold">Session</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredStream.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-slate-500">
                            No matching dataLayer pushes found.
                          </td>
                        </tr>
                      ) : (
                        filteredStream.map((evt) => {
                          const isSelected = selectedEvent?.id === evt.id;
                          return (
                            <tr
                              key={evt.id}
                              onClick={() => setSelectedEvent(evt)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                                {formatShortTimestamp(evt.created_at)}
                              </td>
                              <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                                {evt.event_name}
                              </td>
                              <td className="py-2.5 px-4">
                                <span
                                  className={`font-mono text-[11px] font-semibold ${
                                    evt.is_conversion
                                      ? 'text-emerald-700'
                                      : evt.event_category === 'pageview'
                                        ? 'text-blue-700'
                                        : 'text-slate-600'
                                  }`}
                                >
                                  {evt.is_conversion ? 'conversion' : evt.event_category}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-mono text-slate-700 max-w-[180px] truncate">
                                {evt.page_path}
                              </td>
                              <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                {evt.session_id || '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payload Inspector */}
              <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
                <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    dataLayer Payload Inspector
                  </h3>
                  {selectedEvent && (
                    <span className="font-mono text-[11px] text-slate-500">
                      {selectedEvent.container_id}
                    </span>
                  )}
                </div>
                {selectedEvent ? (
                  <div className="p-4 space-y-3 text-xs">
                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                      <div className="flex justify-between px-3 py-2">
                        <span className="text-slate-500">Event Name</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {selectedEvent.event_name}
                        </span>
                      </div>
                      <div className="flex justify-between px-3 py-2">
                        <span className="text-slate-500">Route</span>
                        <span className="font-mono text-slate-800">{selectedEvent.page_path}</span>
                      </div>
                      <div className="flex justify-between px-3 py-2">
                        <span className="text-slate-500">Conversion</span>
                        <span
                          className={`font-mono font-semibold ${
                            selectedEvent.is_conversion ? 'text-emerald-700' : 'text-slate-600'
                          }`}
                        >
                          {selectedEvent.is_conversion ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div className="flex justify-between px-3 py-2">
                        <span className="text-slate-500">Timestamp</span>
                        <span className="font-mono text-[11px] text-slate-700 tabular-nums">
                          {selectedEvent.created_at}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Captured JSON Object
                      </div>
                      <pre className="rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-emerald-300 overflow-x-auto max-h-[300px]">
                        {JSON.stringify(selectedEvent.payload || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Select any row in the dataLayer stream to inspect its JSON payload.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB: CONTAINER & OAUTH SYNC */}
          {subTab === 'oauth' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Tags className="h-4 w-4 text-[var(--gs-primary)]" />
                      <span>Google Tag Manager API v2 (OAuth Sync)</span>
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">
                      Sign in with Google (<code className="font-mono">tagmanager.readonly</code>)
                      to fetch live Containers, Workspaces, Tags, Triggers, and Variables from your
                      GTM account. First-party telemetry and Geo demographics remain active without
                      OAuth.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleConnectGtmOAuth}
                      disabled={oauthBusy}
                      className="whitespace-nowrap shrink-0 min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>
                        {oauthBusy
                          ? 'Connecting...'
                          : gtmIntegration?.connected
                            ? 'Reconnect / Sync GTM OAuth'
                            : 'Connect GTM OAuth'}
                      </span>
                    </button>
                    {gtmIntegration?.connected && (
                      <button
                        type="button"
                        onClick={handleDisconnectGtmOAuth}
                        disabled={oauthBusy}
                        className="whitespace-nowrap shrink-0 min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Unplug className="h-3.5 w-3.5" />
                        <span>Disconnect</span>
                      </button>
                    )}
                  </div>
                </div>

                {gtmIntegration?.connected && (
                  <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Connected Google Account
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-900">
                        {gtmIntegration.configMeta.gtm_account_email}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {gtmIntegration.configMeta.gtm_account_name}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Discovered GTM Container
                      </label>
                      {oauthContainers.length > 0 ? (
                        <select
                          value={selectedContainerId}
                          onChange={(e) => handleSwitchOAuthContainer(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                        >
                          {oauthContainers.map((c) => (
                            <option key={c.containerId} value={c.containerId}>
                              {c.name} ({c.publicId}) · {c.workspaceName}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="mt-1 text-xs text-slate-600 font-mono">
                          {gtmIntegration.configMeta.gtm_container_public_id ||
                            configDraft.gtm_container_id}{' '}
                          (Active script injection)
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Last Workspace Sync
                      </div>
                      <div className="mt-1 font-mono text-xs text-slate-900 tabular-nums">
                        {snapshot?.syncedAt
                          ? formatShortTimestamp(snapshot.syncedAt)
                          : 'Pending container access'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {snapshot
                          ? `${snapshot.tags.length} Tags · ${snapshot.triggers.length} Triggers · ${snapshot.variables.length} Variables`
                          : 'Zero API containers returned for this account'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {snapshot ? (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {(
                        [
                          { id: 'tags', label: `Tags (${snapshot.tags.length})` },
                          { id: 'triggers', label: `Triggers (${snapshot.triggers.length})` },
                          { id: 'variables', label: `Variables (${snapshot.variables.length})` }
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setInspectTab(tab.id)}
                          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-mono font-semibold ${
                            inspectTab === tab.id
                              ? 'bg-[var(--gs-primary)] text-white'
                              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative min-w-[220px]">
                      <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={inspectQuery}
                        onChange={(e) => setInspectQuery(e.target.value)}
                        placeholder="Search workspace items..."
                        className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-900"
                      />
                    </div>
                  </div>

                  {snapshot.note && (
                    <div className="border-b border-slate-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
                      {snapshot.note}
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="py-2.5 px-4 font-semibold">ID</th>
                          <th className="py-2.5 px-4 font-semibold">Name</th>
                          <th className="py-2.5 px-4 font-semibold">Type</th>
                          <th className="py-2.5 px-4 font-semibold">
                            {inspectTab === 'tags' ? 'State / Firing Triggers' : 'Scope'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {inspectTab === 'tags' &&
                          (filteredSnapshotItems.tags.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-500">
                                No tags found in this workspace.
                              </td>
                            </tr>
                          ) : (
                            filteredSnapshotItems.tags.map((t) => (
                              <tr key={t.tagId} className="hover:bg-slate-50">
                                <td className="py-2.5 px-4 font-mono text-slate-500">{t.tagId}</td>
                                <td className="py-2.5 px-4 font-semibold text-slate-900">{t.name}</td>
                                <td className="py-2.5 px-4 font-mono text-slate-600">{t.type}</td>
                                <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600">
                                  {t.paused ? 'Paused' : 'Active'} · Triggers:{' '}
                                  {t.firingTriggerId.join(', ') || 'None'}
                                </td>
                              </tr>
                            ))
                          ))}

                        {inspectTab === 'triggers' &&
                          (filteredSnapshotItems.triggers.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-500">
                                No triggers found in this workspace.
                              </td>
                            </tr>
                          ) : (
                            filteredSnapshotItems.triggers.map((tr) => (
                              <tr key={tr.triggerId} className="hover:bg-slate-50">
                                <td className="py-2.5 px-4 font-mono text-slate-500">
                                  {tr.triggerId}
                                </td>
                                <td className="py-2.5 px-4 font-semibold text-slate-900">
                                  {tr.name}
                                </td>
                                <td className="py-2.5 px-4 font-mono text-slate-600">{tr.type}</td>
                                <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                                  Workspace {snapshot.workspaceName}
                                </td>
                              </tr>
                            ))
                          ))}

                        {inspectTab === 'variables' &&
                          (filteredSnapshotItems.variables.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-500">
                                No user-defined variables found in this workspace.
                              </td>
                            </tr>
                          ) : (
                            filteredSnapshotItems.variables.map((v) => (
                              <tr key={v.variableId} className="hover:bg-slate-50">
                                <td className="py-2.5 px-4 font-mono text-slate-500">
                                  {v.variableId}
                                </td>
                                <td className="py-2.5 px-4 font-semibold text-slate-900">
                                  {v.name}
                                </td>
                                <td className="py-2.5 px-4 font-mono text-slate-600">{v.type}</td>
                                <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                                  Workspace {snapshot.workspaceName}
                                </td>
                              </tr>
                            ))
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                  <FolderGit2 className="h-8 w-8 text-slate-300 mx-auto" />
                  <h4 className="mt-3 font-display text-sm font-bold text-slate-900">
                    Connect Your Google Tag Manager Account
                  </h4>
                  <p className="mt-1 max-w-md mx-auto text-xs text-slate-600">
                    Your GTM container script (
                    <code className="font-mono">{configDraft.gtm_container_id}</code>) is already
                    active and streaming first-party <code className="font-mono">dataLayer</code>{' '}
                    events. Connect OAuth above whenever you want to inspect published GTM Tags,
                    Triggers, and Variables.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB: CONFIGURATION & SNIPPET */}
          {subTab === 'config' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <form
                onSubmit={handleSaveConfig}
                className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 space-y-5"
              >
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Container Injection &amp; Telemetry Controls
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Changes synchronize sitewide to <code className="font-mono">site_settings</code>{' '}
                    immediately.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="gtm-container-id-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    GTM Container ID
                  </label>
                  <input
                    id="gtm-container-id-input"
                    type="text"
                    required
                    value={configDraft.gtm_container_id}
                    onChange={(e) =>
                      setConfigDraft((prev) => ({
                        ...prev,
                        gtm_container_id: e.target.value.toUpperCase()
                      }))
                    }
                    placeholder="GTM-MFP3W7MS"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                  />
                </div>

                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                  <label className="flex items-center justify-between gap-4 p-3.5 cursor-pointer">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        Enable Google Tag Manager Script Injection
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Injects{' '}
                        <code className="font-mono">gtm.js?id={configDraft.gtm_container_id}</code>{' '}
                        and <code className="font-mono">window.dataLayer</code> +{' '}
                        <code className="font-mono">gtag(&apos;js&apos;, new Date())</code>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={configDraft.gtm_enabled}
                      onChange={(e) =>
                        setConfigDraft((prev) => ({ ...prev, gtm_enabled: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-[var(--gs-primary)]"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-4 p-3.5 cursor-pointer">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        Capture Live dataLayer Events
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Records all <code className="font-mono">dataLayer.push()</code> &amp;{' '}
                        <code className="font-mono">gtag()</code> dispatches to the Telemetry Hub
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={configDraft.gtm_track_datalayer}
                      onChange={(e) =>
                        setConfigDraft((prev) => ({
                          ...prev,
                          gtm_track_datalayer: e.target.checked
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-[var(--gs-primary)]"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-4 p-3.5 cursor-pointer">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        Track Funnel Conversion Attribution
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Flags inquiry submissions, newsletter signups, demo signups &amp; Buy Me a
                        Coffee clicks
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={configDraft.gtm_track_conversions}
                      onChange={(e) =>
                        setConfigDraft((prev) => ({
                          ...prev,
                          gtm_track_conversions: e.target.checked
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-[var(--gs-primary)]"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-4 p-3.5 cursor-pointer">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        Gate Tag Manager Behind Cookie Consent Banner
                      </div>
                      <div className="text-[11px] text-slate-500">
                        When unchecked, GTM initializes immediately on first page load.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={configDraft.gtm_respect_consent}
                      onChange={(e) =>
                        setConfigDraft((prev) => ({
                          ...prev,
                          gtm_respect_consent: e.target.checked
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-[var(--gs-primary)]"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-4 p-3.5 cursor-pointer">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        Exclude Back Office Routes (<code className="font-mono">/obama</code>,{' '}
                        <code className="font-mono">/studio</code>)
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Prevents internal Back Office operator browsing from skewing public traffic
                        metrics.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={configDraft.gtm_exclude_admin}
                      onChange={(e) =>
                        setConfigDraft((prev) => ({
                          ...prev,
                          gtm_exclude_admin: e.target.checked
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-[var(--gs-primary)]"
                    />
                  </label>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="min-h-[40px] rounded-lg bg-[var(--gs-primary)] px-5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                  >
                    {savingConfig ? 'Saving Settings...' : 'Save Tag Manager Configuration'}
                  </button>
                </div>
              </form>

              <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-[var(--gs-primary)]" />
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Injected GTM &amp; gtag Snippet
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySnippet}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {copiedSnippet ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-700" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="rounded-lg border border-slate-200 bg-slate-950 p-3.5 font-mono text-[11px] leading-relaxed text-sky-300 overflow-x-auto">
                  {getGtmSnippetString(configDraft.gtm_container_id)}
                </pre>

                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 text-xs">
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-slate-600">Configured Container</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {configDraft.gtm_container_id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-slate-600">Current Session dataLayer Queue</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {browserDataLayerLen} entries
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-slate-600">Public Injection Policy</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {configDraft.gtm_enabled
                        ? configDraft.gtm_respect_consent
                          ? 'Consent-Gated'
                          : 'Always Active'
                        : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
