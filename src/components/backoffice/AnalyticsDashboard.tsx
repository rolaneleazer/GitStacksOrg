import {
  Activity,
  BarChart3,
  CheckCircle2,
  Compass,
  Copy,
  FileText,
  Globe2,
  KeyRound,
  Link2,
  RefreshCw,
  Save,
  ShieldCheck,
  TrendingUp,
  Unplug,
  Upload
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval.ts';
import { api } from '../../lib/api.ts';
import {
  DEFAULT_GITSTACK_GA4_PROPERTIES,
  disconnectGoogleAnalyticsOAuth,
  getCachedGa4AccessToken,
  signInWithGoogleAnalyticsPopup
} from '../../lib/googleAnalyticsOAuth.ts';
import { resolveDateRangeBounds } from '../../shared/dateRanges.ts';
import type {
  AdSenseSettings,
  AnalyticsSummary,
  Ga4LiveReportSummary,
  Ga4PropertyOption,
  IntegrationConfigMeta,
  IntegrationStatusItem,
  RealtimeActiveVisitorSummary
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
import { VisitorJourneysPanel } from './VisitorJourneysPanel.tsx';

interface AnalyticsDashboardProps {
  settings: AdSenseSettings;
  summary: AnalyticsSummary | null;
  range: DateRangeSelection;
  onChangeRange: (next: DateRangeSelection) => void;
  onRefreshSummary: () => Promise<void>;
  onSaveGa4Settings: (patch: {
    ga4_measurement_id: string;
    ga4_enabled: boolean;
    ga4_track_events: boolean;
  }) => Promise<void>;
}

type AnalyticsSubTab =
  | 'realtime'
  | 'overview'
  | 'demographics'
  | 'pages'
  | 'journeys'
  | 'retention'
  | 'connect';

export function AnalyticsDashboard({
  settings,
  summary,
  range,
  onChangeRange,
  onRefreshSummary,
  onSaveGa4Settings
}: AnalyticsDashboardProps) {
  const [subTab, setSubTab] = useState<AnalyticsSubTab>(
    range.preset === 'realtime' ? 'realtime' : 'overview'
  );
  const [measurementId, setMeasurementId] = useState(settings.ga4_measurement_id || '');
  const [enabled, setEnabled] = useState(Boolean(settings.ga4_enabled));
  const [trackEvents, setTrackEvents] = useState(settings.ga4_track_events !== false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [testingVisit, setTestingVisit] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Realtime polling state
  const [realtimeData, setRealtimeData] = useState<RealtimeActiveVisitorSummary | null>(
    summary?.realtime || null
  );
  const [ga4Realtime, setGa4Realtime] = useState<RealtimeActiveVisitorSummary | null>(null);
  const [autoPoll, setAutoPoll] = useState(true);

  // GA4 Vault + Service Account + OAuth state
  const [ga4Item, setGa4Item] = useState<IntegrationStatusItem | null>(null);
  const [liveReport, setLiveReport] = useState<Ga4LiveReportSummary | null>(null);
  const [oauthBusy, setOauthBusy] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [servicePropertyId, setServicePropertyId] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);

  const rangeMeta = useMemo(
    () => resolveDateRangeBounds(range.preset, range.startDate, range.endDate),
    [range.endDate, range.preset, range.startDate]
  );

  const loadGa4VaultStatus = useCallback(async () => {
    try {
      const res = await api.listIntegrations();
      const found = res.integrations.find((i) => i.provider === 'google_analytics') || null;
      setGa4Item(found);
      if (found?.connected) {
        if (found.configMeta.ga4_measurement_id) {
          setMeasurementId(found.configMeta.ga4_measurement_id);
          setEnabled(true);
        }
        if (found.configMeta.ga4_property_id) {
          setServicePropertyId(found.configMeta.ga4_property_id);
        }
        if (found.configMeta.ga4_cached_report) {
          setLiveReport(found.configMeta.ga4_cached_report);
        }
      }
    } catch {
      // Integration list is super_admin gated for raw vault config; editor uses /api/admin/analytics/sync
    }
  }, []);

  const loadRealtime = useCallback(async () => {
    try {
      const res = await api.getRealtimeAnalytics();
      setRealtimeData(res.realtime);
      setGa4Realtime(res.ga4Realtime);
    } catch {
      // Ignore transient poll errors
    }
  }, []);

  useEffect(() => {
    loadGa4VaultStatus();
    loadRealtime();
  }, [loadGa4VaultStatus, loadRealtime]);

  useEffect(() => {
    if (summary?.realtime) {
      setRealtimeData((prev) => prev || summary.realtime || null);
    }
  }, [summary?.realtime]);

  const shouldPollRealtime =
    autoPoll && (subTab === 'realtime' || range.preset === 'realtime');
  useVisibilityInterval(
    loadRealtime,
    shouldPollRealtime ? 60_000 : null
  );

  const handleRangeChange = (next: DateRangeSelection) => {
    onChangeRange(next);
    if (next.preset === 'realtime') {
      setSubTab('realtime');
      loadRealtime();
    } else if (subTab === 'realtime') {
      setSubTab('overview');
    }
    if (ga4Item?.connected) {
      api
        .syncGa4ReportServer({
          preset: next.preset,
          startDate: next.startDate,
          endDate: next.endDate,
          accessToken: getCachedGa4AccessToken() || undefined
        })
        .then((res) => {
          if (res.report) setLiveReport(res.report);
          if (res.integration) setGa4Item(res.integration);
        })
        .catch(() => {});
    }
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.all([onRefreshSummary(), loadRealtime()]);
      if (ga4Item?.connected) {
        const synced = await api.syncGa4ReportServer({
          preset: range.preset,
          startDate: range.startDate,
          endDate: range.endDate,
          accessToken: getCachedGa4AccessToken() || undefined
        });
        if (synced.report) setLiveReport(synced.report);
        if (synced.integration) setGa4Item(synced.integration);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleSendLiveTestVisit = async () => {
    setTestingVisit(true);
    setMsg(null);
    try {
      api.trackAnalyticsEvent('pageview', '/?test_visit=1', {
        source: 'backoffice_live_verification'
      });
      await api.sendPublicPresence('/?test_visit=1', 6);
      await new Promise((r) => setTimeout(r, 250));
      await Promise.all([loadRealtime(), onRefreshSummary()]);
      setSubTab('realtime');
      setMsg({
        type: 'ok',
        text: 'Live test visit dispatched to /?test_visit=1. Verify your session row and edge geolocation in Realtime below.'
      });
    } catch (err) {
      setMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to send live test visit ping.'
      });
    } finally {
      setTestingVisit(false);
    }
  };

  const handleServiceAccountFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setServiceAccountJson(text);
      const parsed = JSON.parse(text) as { client_email?: string; project_id?: string };
      setMsg({
        type: 'ok',
        text: `Loaded key file for ${parsed.client_email || parsed.project_id || file.name}. Click "Connect Service Account & Sync GA4" to verify.`
      });
    } catch {
      setMsg({
        type: 'err',
        text: 'Selected file is not valid JSON. Upload the Google Cloud Service Account .json key.'
      });
    }
  };

  const handleConnectServiceAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setOauthBusy('service_account');
    setMsg(null);
    setConfirmDisconnect(false);
    try {
      const res = await api.connectGa4ServiceAccount({
        serviceAccountJson: serviceAccountJson.trim() || undefined,
        propertyId: servicePropertyId.trim() || undefined,
        measurementId: measurementId.trim().toUpperCase() || undefined
      });
      setGa4Item(res.integration);
      if (res.report) setLiveReport(res.report);
      if (res.integration.configMeta.ga4_property_id) {
        setServicePropertyId(res.integration.configMeta.ga4_property_id);
      }
      if (res.integration.configMeta.ga4_measurement_id) {
        const nextMid = res.integration.configMeta.ga4_measurement_id;
        setMeasurementId(nextMid);
        setEnabled(true);
        await onSaveGa4Settings({
          ga4_measurement_id: nextMid,
          ga4_enabled: true,
          ga4_track_events: trackEvents
        });
      }
      setServiceAccountJson('');
      setMsg({
        type: res.reportNote ? 'err' : 'ok',
        text:
          res.reportNote ||
          `Connected via Google Service Account (${res.integration.configMeta.ga4_service_account_email}). ${res.testResult.message}`
      });
    } catch (err) {
      setMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Service Account verification failed.'
      });
    } finally {
      setOauthBusy(null);
    }
  };

  const handleConnectGoogleAccount = async () => {
    setOauthBusy('connect');
    setMsg(null);
    setConfirmDisconnect(false);
    try {
      const oauthRes = await signInWithGoogleAnalyticsPopup();
      const firstProp = oauthRes.properties[0] || DEFAULT_GITSTACK_GA4_PROPERTIES[0];
      const syncRes = await api.syncGa4ReportServer({
        preset: range.preset,
        startDate: range.startDate,
        endDate: range.endDate,
        propertyId: firstProp.property_id,
        accessToken: oauthRes.accessToken
      });
      const configMeta: IntegrationConfigMeta = {
        ga4_auth_mode: 'oauth',
        ga4_account_email: oauthRes.email,
        ga4_account_name: oauthRes.displayName,
        ga4_property_id: firstProp.property_id,
        ga4_property_name: firstProp.property_name,
        ga4_measurement_id: firstProp.measurement_id,
        ga4_stream_uri: firstProp.stream_uri,
        ga4_properties_list: oauthRes.properties,
        ga4_cached_report: syncRes.report
      };
      const saved = await api.saveIntegration('google_analytics', {
        secret: oauthRes.accessToken,
        configMeta
      });
      setGa4Item(saved.integration);
      if (syncRes.report) setLiveReport(syncRes.report);
      setMeasurementId(firstProp.measurement_id);
      setEnabled(true);
      await onSaveGa4Settings({
        ga4_measurement_id: firstProp.measurement_id,
        ga4_enabled: true,
        ga4_track_events: trackEvents
      });
      setMsg({
        type: 'ok',
        text: `Connected Google Analytics (${oauthRes.email}) · Active Property: ${firstProp.property_name} (${firstProp.measurement_id}).`
      });
    } catch (err) {
      setMsg({
        type: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Google Analytics popup sign-in was blocked. Use Service Account Vault Sync above for production domains.'
      });
    } finally {
      setOauthBusy(null);
    }
  };

  const handleSelectProperty = async (propertyId: string) => {
    if (!ga4Item) return;
    setOauthBusy('property');
    setMsg(null);
    try {
      const syncRes = await api.syncGa4ReportServer({
        preset: range.preset,
        startDate: range.startDate,
        endDate: range.endDate,
        propertyId,
        accessToken: getCachedGa4AccessToken() || undefined
      });
      if (syncRes.integration) setGa4Item(syncRes.integration);
      if (syncRes.report) setLiveReport(syncRes.report);
      setServicePropertyId(propertyId);
      const propsList: Ga4PropertyOption[] =
        syncRes.integration?.configMeta.ga4_properties_list ||
        ga4Item.configMeta.ga4_properties_list ||
        DEFAULT_GITSTACK_GA4_PROPERTIES;
      const chosen = propsList.find((p) => p.property_id === propertyId);
      if (chosen?.measurement_id) {
        setMeasurementId(chosen.measurement_id);
        setEnabled(true);
        await onSaveGa4Settings({
          ga4_measurement_id: chosen.measurement_id,
          ga4_enabled: true,
          ga4_track_events: trackEvents
        });
      }
      setMsg({
        type: syncRes.note ? 'err' : 'ok',
        text:
          syncRes.note ||
          `Switched & synced GA4 Property: ${chosen?.property_name || propertyId}.`
      });
    } catch (err) {
      setMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to switch GA4 property.'
      });
    } finally {
      setOauthBusy(null);
    }
  };

  const handleSyncGa4Report = async () => {
    setOauthBusy('sync');
    setMsg(null);
    try {
      const syncRes = await api.syncGa4ReportServer({
        preset: range.preset,
        startDate: range.startDate,
        endDate: range.endDate,
        propertyId: servicePropertyId || ga4Item?.configMeta.ga4_property_id,
        accessToken: getCachedGa4AccessToken() || undefined
      });
      if (syncRes.integration) setGa4Item(syncRes.integration);
      if (syncRes.report) setLiveReport(syncRes.report);
      await onRefreshSummary();
      setMsg({
        type: 'ok',
        text:
          syncRes.note ||
          `Synced Google Analytics Data API (${rangeMeta.label}) from ${syncRes.report?.property_name || 'GA4'}.`
      });
    } catch (err) {
      setMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to sync GA4 report.'
      });
    } finally {
      setOauthBusy(null);
    }
  };

  const handleDisconnectConfirmed = async () => {
    setOauthBusy('disconnect');
    setMsg(null);
    setConfirmDisconnect(false);
    try {
      await disconnectGoogleAnalyticsOAuth();
      const res = await api.disconnectIntegration('google_analytics');
      setGa4Item(res.integration);
      setLiveReport(null);
      setEnabled(false);
      await onSaveGa4Settings({
        ga4_measurement_id: measurementId,
        ga4_enabled: false,
        ga4_track_events: trackEvents
      });
      setMsg({
        type: 'ok',
        text: 'Disconnected Google Analytics credentials from Vault. First-party tracking stays active.'
      });
    } catch (err) {
      setMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to disconnect Google Analytics.'
      });
    } finally {
      setOauthBusy(null);
    }
  };

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

  const handleCopyServiceEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  // Merge GA4 Live Report (if connected) seamlessly with First-Party Telemetry
  const activeReport = ga4Item?.connected ? liveReport || ga4Item.configMeta.ga4_cached_report : null;
  const activeDailySeries =
    activeReport && activeReport.dailySeries.length > 0
      ? activeReport.dailySeries
      : summary?.dailySeries || [];
  const activeTopPages =
    activeReport && activeReport.topPages.length > 0
      ? activeReport.topPages
      : summary?.topPages || [];
  const activeTopReferrers =
    activeReport && activeReport.topReferrers.length > 0
      ? activeReport.topReferrers
      : summary?.topReferrers || [];
  const activeCountries =
    activeReport?.countries && activeReport.countries.length > 0
      ? activeReport.countries
      : summary?.countries || [];
  const activeCities =
    activeReport?.cities && activeReport.cities.length > 0
      ? activeReport.cities
      : summary?.cities || [];
  const activeChannels =
    activeReport?.channels && activeReport.channels.length > 0
      ? activeReport.channels
      : summary?.channels || [];
  const activeLandingPages = useMemo(() => {
    const firstPartyByPath = new Map(
      (summary?.landingPages || []).map((lp) => [lp.landingPage.split('?')[0], lp])
    );
    if (activeReport?.landingPages && activeReport.landingPages.length > 0) {
      return activeReport.landingPages.map((lp) => {
        const fp = firstPartyByPath.get(lp.landingPage.split('?')[0]);
        return {
          ...lp,
          topReferrerDomain: lp.topReferrerDomain || fp?.topReferrerDomain,
          topTriggerLabel: lp.topTriggerLabel || fp?.topTriggerLabel,
          topInterest: lp.topInterest || fp?.topInterest
        };
      });
    }
    return summary?.landingPages || [];
  }, [activeReport, summary?.landingPages]);

  const activeReferrerDetails = useMemo(() => {
    const fp = summary?.referrerDetails || [];
    const ga = activeReport?.referrerDetails || [];
    if (ga.length === 0) return fp;
    if (fp.length === 0) return ga;
    const seen = new Set(fp.map((r) => `${r.referrerUrl || r.referrerHost}|${r.triggerLabel}`));
    const merged = [...fp];
    for (const item of ga) {
      const k = `${item.referrerUrl || item.referrerHost}|${item.triggerLabel}`;
      if (!seen.has(k)) merged.push(item);
    }
    return merged;
  }, [activeReport?.referrerDetails, summary?.referrerDetails]);

  const activeBehavioralInterests = summary?.interestSegments || [];
  const activeGa4Interests = activeReport?.ga4InterestSegments || [];
  const activeVisitorJourneys = summary?.visitorJourneys || [];
  const activePageTitles =
    activeReport?.pageTitles && activeReport.pageTitles.length > 0
      ? activeReport.pageTitles
      : summary?.pageTitles || [];
  const activeEventCounts =
    activeReport?.eventCounts && activeReport.eventCounts.length > 0
      ? activeReport.eventCounts
      : summary?.eventCounts || [];
  const activeDevices =
    activeReport?.devices && activeReport.devices.length > 0
      ? activeReport.devices
      : summary?.devices || [];

  const displayActiveUsers =
    activeReport?.activeUsers ?? summary?.activeUsers ?? summary?.uniqueSessions ?? 0;
  const displayNewUsers = activeReport?.newUsers ?? summary?.newUsers ?? 0;
  const displayReturningUsers = activeReport?.returningUsers ?? summary?.returningUsers ?? 0;
  const displayPageviews = activeReport
    ? activeReport.screenPageViews
    : summary?.totalPageviews ?? 0;
  const displaySessions = activeReport
    ? activeReport.totalSessions
    : summary?.uniqueSessions ?? 0;
  const displayQualifiedLeads =
    summary?.qualifiedLeads ??
    (summary?.inquiryConversions ?? 0) + (summary?.newsletterConversions ?? 0);
  const displayAvgEngagement =
    activeReport?.avgEngagementSeconds ?? summary?.avgEngagementSeconds ?? 0;

  const maxDailyViews = Math.max(1, ...activeDailySeries.map((d) => d.pageviews));
  const cohortSeries = useMemo(
    () =>
      activeDailySeries.map((pt) => ({
        label: pt.label || pt.date,
        activeUsers: pt.activeUsers ?? pt.pageviews,
        newUsers: pt.newUsers ?? 0
      })),
    [activeDailySeries]
  );

  const serviceEmail = ga4Item?.configMeta.ga4_service_account_email || '';
  const liveRightNow = realtimeData?.activeUsers5m ?? 0;

  return (
    <div className="space-y-6">
      {/* Header + Date Presets + Sub-tabs */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-[var(--gs-primary)]">Google Analytics 4</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-700">{rangeMeta.label}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-emerald-700 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {liveRightNow} active now
              </span>
              {ga4Item?.connected && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-slate-700">
                    {ga4Item.configMeta.ga4_auth_mode === 'service_account'
                      ? 'Service Account Vault Sync'
                      : 'GA4 OAuth Connected'}
                  </span>
                </>
              )}
            </div>
            <h2 className="mt-1 font-display text-lg font-bold text-slate-900">
              Google Analytics (GA4) &amp; Live Audience Intelligence
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Monitor Realtime visitors (30m), Geo country &amp; city demographics, acquisition channels,
              landing pages, event counts, and 6-week retention cohorts.
            </p>
          </div>
        </div>

        <AnalyticsDateFilterBar
          value={range}
          onChange={handleRangeChange}
          onRefresh={handleRefreshAll}
          onSendLiveTestVisit={handleSendLiveTestVisit}
          refreshing={refreshing}
          testingVisit={testingVisit}
        />

        {/* Sub-navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
          {(
            [
              { id: 'realtime', label: `Realtime (${liveRightNow})`, icon: Activity },
              { id: 'overview', label: 'Overview & Acquisition', icon: BarChart3 },
              { id: 'demographics', label: 'Demographics (Geo & City)', icon: Globe2 },
              { id: 'pages', label: 'Landing Pages & Events', icon: FileText },
              { id: 'journeys', label: 'Visitor Journeys & Interests', icon: Compass },
              { id: 'retention', label: 'Retention & Cohorts', icon: TrendingUp },
              { id: 'connect', label: 'Connect & Tag Config', icon: Link2 }
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

      {msg && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-medium ${
            msg.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* SUB-TAB 1: REALTIME (30m) */}
      {subTab === 'realtime' && (
        <RealtimeMonitorView
          realtime={realtimeData}
          ga4Realtime={ga4Realtime}
          autoPollEnabled={autoPoll}
          onToggleAutoPoll={() => setAutoPoll((v) => !v)}
          onSendLiveTestVisit={handleSendLiveTestVisit}
          testingVisit={testingVisit}
        />
      )}

      {/* SUB-TAB 2: OVERVIEW & ACQUISITION */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {/* 5 KPI Cards (Active, New/Returning, Leads/Key Events, Sessions, Avg Engagement) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Active Users
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {displayActiveUsers.toLocaleString()}
              </div>
              <p className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                {displayPageviews.toLocaleString()} pageviews
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                New / Returning Users
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {displayNewUsers.toLocaleString()}{' '}
                <span className="text-base font-normal text-slate-400">
                  / {displayReturningUsers.toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">First-visit vs returning cohort</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Qualified Leads &amp; Key Events
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-[var(--gs-primary)] tabular-nums">
                {displayQualifiedLeads.toLocaleString()}
              </div>
              <p className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                {summary?.inquiryConversions ?? 0} inquiries · {summary?.newsletterConversions ?? 0}{' '}
                subscribers
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Sessions &amp; Key Rate
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
                {displaySessions.toLocaleString()}{' '}
                <span className="text-sm font-semibold text-emerald-600">
                  ({summary?.conversionRatePercent ?? 0}%)
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {ga4Item?.connected
                  ? `Synced: ${ga4Item.configMeta.ga4_property_name || 'GA4'}`
                  : 'Public routes (excl. /obama)'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Avg Engagement Time
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {formatDurationSeconds(displayAvgEngagement)}
              </div>
              <p className="mt-1 font-mono text-[11px] text-slate-500 truncate">
                Tag: {settings.ga4_enabled && settings.ga4_measurement_id ? settings.ga4_measurement_id : 'Inactive'}
              </p>
            </div>
          </div>

          {/* Trend Bar Chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Traffic &amp; Conversions Trend ({rangeMeta.label})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Bucketed by {summary?.bucketMode || rangeMeta.bucketMode} · Hover bars for counts
                </p>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {summary?.commentSubmissions ?? 0} reader comments
              </span>
            </div>

            <div className="mt-5 flex items-end gap-1 sm:gap-1.5 h-44 border-b border-slate-200 pb-2 overflow-x-auto">
              {activeDailySeries.length === 0 ? (
                <div className="w-full py-12 text-center text-xs text-slate-500">
                  No traffic points in selected range yet.
                </div>
              ) : (
                activeDailySeries.map((pt) => {
                  const heightPct = Math.max(6, Math.round((pt.pageviews / maxDailyViews) * 100));
                  return (
                    <div
                      key={pt.date}
                      title={`${pt.label || pt.date}: ${pt.pageviews} views, ${pt.conversions} conversions`}
                      className="flex-1 min-w-[10px] flex flex-col items-center justify-end h-full group"
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
                })
              )}
            </div>
            <div className="mt-2 flex justify-between text-[11px] font-mono text-slate-500 tabular-nums">
              <span>{activeDailySeries[0]?.label || activeDailySeries[0]?.date || ''}</span>
              <span>
                {activeDailySeries[activeDailySeries.length - 1]?.label ||
                  activeDailySeries[activeDailySeries.length - 1]?.date ||
                  ''}
              </span>
            </div>
          </div>

          {/* Primary Channel Groups + Platform/Device Breakdown */}
          <ChannelAndPlatformCards
            channels={activeChannels}
            devices={activeDevices}
            newUsers={displayNewUsers}
            returningUsers={displayReturningUsers}
          />

          {/* Top Routes & Top Referrers */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-display text-sm font-bold text-slate-900 border-b border-slate-200 pb-3">
                Top Performing Routes
              </h3>
              <div className="mt-2 divide-y divide-slate-200">
                {activeTopPages.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    No pageviews recorded in window.
                  </p>
                ) : (
                  activeTopPages.map((row) => (
                    <div
                      key={row.path}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="font-mono text-slate-800 truncate">{row.path}</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                        {row.views.toLocaleString()}
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
              <div className="mt-2 divide-y divide-slate-200">
                {activeTopReferrers.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    No referrer records in window.
                  </p>
                ) : (
                  activeTopReferrers.map((row) => (
                    <div
                      key={row.referrer}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-slate-800 truncate">{row.referrer}</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                        {row.visits.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: DEMOGRAPHICS (GEO WORLD MAP + CITIES) */}
      {subTab === 'demographics' && (
        <GeoWorldMap
          countries={activeCountries}
          cities={activeCities}
          title={`Active Users by Country & City (${rangeMeta.label})`}
        />
      )}

      {/* SUB-TAB 4: LANDING PAGES, PAGE TITLES & EVENTS */}
      {subTab === 'pages' && (
        <LandingPagesAndEventsView
          landingPages={activeLandingPages}
          pageTitles={activePageTitles}
          eventCounts={activeEventCounts}
        />
      )}

      {/* SUB-TAB 5: VISITOR JOURNEYS, PRE-LANDING REFERRALS & INTERESTS */}
      {subTab === 'journeys' && (
        <VisitorJourneysPanel
          referrerDetails={activeReferrerDetails}
          behavioralInterests={activeBehavioralInterests}
          ga4Interests={activeGa4Interests}
          visitorJourneys={activeVisitorJourneys}
          rangeLabel={rangeMeta.label}
          ga4Connected={Boolean(ga4Item?.connected)}
        />
      )}

      {/* SUB-TAB 6: RETENTION & COHORTS */}
      {subTab === 'retention' && (
        <RetentionCohortsView cohorts={summary?.cohorts || []} series={cohortSeries} />
      )}

      {/* SUB-TAB 6: PRODUCTION CONNECTION & TAG CONFIGURATION */}
      {subTab === 'connect' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column (7 cols): Production Service Account Vault + OAuth Fallback */}
          <div className="lg:col-span-7 space-y-6">
            <form
              onSubmit={handleConnectServiceAccount}
              className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[var(--gs-primary)]" />
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Production GA4 Connection (Service Account Vault)
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Authenticates server-side via RS256 JWT. Eliminates{' '}
                    <code className="font-mono">auth/unauthorized-domain</code> popup errors on{' '}
                    <code className="font-mono">git-stack.org</code> and any custom domain.
                  </p>
                </div>
                {ga4Item?.connected ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Connected</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 shrink-0">
                    <Unplug className="h-3.5 w-3.5" />
                    <span>Not Configured</span>
                  </span>
                )}
              </div>

              {ga4Item?.connected && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-950 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {ga4Item.configMeta.ga4_auth_mode === 'service_account'
                        ? 'Active Server-Side Service Account'
                        : 'Connected Google OAuth Account'}
                    </span>
                    <span className="font-mono text-[11px] text-emerald-800">
                      {ga4Item.configMeta.ga4_property_name || ga4Item.configMeta.ga4_property_id}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <code className="font-mono text-[11px] text-emerald-900 break-all">
                      {serviceEmail || ga4Item.configMeta.ga4_account_email}
                    </code>
                    {serviceEmail && (
                      <button
                        type="button"
                        onClick={() => handleCopyServiceEmail(serviceEmail)}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-50"
                      >
                        <Copy className="h-3 w-3" />
                        <span>{copiedEmail ? 'Copied Email' : 'Copy Viewer Email'}</span>
                      </button>
                    )}
                  </div>
                  {serviceEmail && (
                    <p className="text-[11px] text-emerald-800">
                      In Google Analytics → Admin → Property Access Management, add this email with{' '}
                      <strong>Viewer</strong> role so server-side GA4 reports sync automatically.
                    </p>
                  )}
                </div>
              )}

              {ga4Item?.connected && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Select Discovered GA4 Property
                    </label>
                    <select
                      disabled={oauthBusy !== null}
                      value={
                        servicePropertyId ||
                        ga4Item.configMeta.ga4_property_id ||
                        DEFAULT_GITSTACK_GA4_PROPERTIES[0].property_id
                      }
                      onChange={(e) => handleSelectProperty(e.target.value)}
                      className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                    >
                      {(ga4Item.configMeta.ga4_properties_list &&
                      ga4Item.configMeta.ga4_properties_list.length > 0
                        ? ga4Item.configMeta.ga4_properties_list
                        : DEFAULT_GITSTACK_GA4_PROPERTIES
                      ).map((prop) => (
                        <option key={prop.property_id} value={prop.property_id}>
                          {prop.property_name} ({prop.measurement_id || prop.property_id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      disabled={oauthBusy !== null}
                      onClick={handleSyncGa4Report}
                      className="min-h-[40px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${oauthBusy === 'sync' ? 'animate-spin' : ''}`}
                      />
                      <span>{oauthBusy === 'sync' ? 'Syncing...' : 'Sync GA4 Data Now'}</span>
                    </button>

                    {!confirmDisconnect ? (
                      <button
                        type="button"
                        disabled={oauthBusy !== null}
                        onClick={() => setConfirmDisconnect(true)}
                        className="min-h-[40px] inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Unplug className="h-3.5 w-3.5" />
                        <span>Disconnect</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={oauthBusy !== null}
                        onClick={handleDisconnectConfirmed}
                        className="min-h-[40px] rounded-lg bg-[#DC2626] px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                      >
                        Confirm
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    GA4 Numeric Property ID
                  </label>
                  <input
                    type="text"
                    value={servicePropertyId}
                    onChange={(e) => setServicePropertyId(e.target.value)}
                    placeholder="e.g. properties/456789012 or 456789012"
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 font-mono px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Upload GCP Service Account Key (.json)
                  </label>
                  <label className="mt-1 min-h-[40px] w-full inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100">
                    <Upload className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
                    <span>Choose .json Key File</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleServiceAccountFileUpload}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Service Account JSON Key (Encrypted in AES-256-GCM Vault)
                </label>
                <textarea
                  rows={4}
                  value={serviceAccountJson}
                  onChange={(e) => setServiceAccountJson(e.target.value)}
                  placeholder={
                    ga4Item?.connected
                      ? 'Encrypted key already stored in Vault. Leave blank to update Property ID only, or paste a new JSON key to rotate credentials.'
                      : '{"type":"service_account","project_id":"...","client_email":"...","private_key":"-----BEGIN PRIVATE KEY-----..."}'
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 font-mono p-3 text-[11px] text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={oauthBusy !== null}
                className="min-h-[42px] w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>
                  {oauthBusy === 'service_account'
                    ? 'Verifying RS256 JWT & Syncing GA4...'
                    : ga4Item?.connected
                      ? 'Update Vault Property / Rotate Key & Sync'
                      : 'Connect Service Account & Sync GA4'}
                </span>
              </button>

              <div className="border-t border-slate-200 pt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[11px] text-slate-500">
                  Optional Browser OAuth (requires domain listed in Firebase Authorized Domains):
                </span>
                <button
                  type="button"
                  disabled={oauthBusy !== null}
                  onClick={handleConnectGoogleAccount}
                  className="whitespace-nowrap shrink-0 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  <span>
                    {oauthBusy === 'connect' ? 'Opening Popup...' : 'Browser OAuth Sign-In'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Column (5 cols): Consent-Gated Tag Preferences */}
          <form
            onSubmit={handleSave}
            className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 h-fit"
          >
            <div className="border-b border-slate-200 pb-3">
              <h3 className="font-display text-sm font-bold text-slate-900">
                Consent-Gated Tag Preferences
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Loads gtag.js only on public pages after cookie consent.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Active GA4 Measurement ID
              </label>
              <input
                type="text"
                value={measurementId}
                onChange={(e) => setMeasurementId(e.target.value)}
                placeholder="G-YHSJK21CJR"
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
                First-party edge telemetry (Realtime 30m, Geo Country/City, Channels &amp; Cohorts)
                stays active automatically even before Google Data API sync.
              </span>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? 'Saving GA4 Settings...' : 'Save Tag Preferences'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
