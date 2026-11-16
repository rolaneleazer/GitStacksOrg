import { BarChart3, CheckCircle2, RefreshCw, Save, Unplug } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import {
  DEFAULT_GITSTACK_GA4_PROPERTIES,
  disconnectGoogleAnalyticsOAuth,
  fetchGa4LiveReport,
  getCachedGa4AccessToken,
  signInWithGoogleAnalyticsPopup
} from '../../lib/googleAnalyticsOAuth.ts';
import type {
  AdSenseSettings,
  AnalyticsSummary,
  Ga4PropertyOption,
  IntegrationConfigMeta,
  IntegrationStatusItem
} from '../../shared/types.ts';

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

  const [ga4Item, setGa4Item] = useState<IntegrationStatusItem | null>(null);
  const [oauthBusy, setOauthBusy] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const loadGa4VaultStatus = useCallback(async () => {
    try {
      const res = await api.listIntegrations();
      const found = res.integrations.find((i) => i.provider === 'google_analytics') || null;
      setGa4Item(found);
      if (found?.connected && found.configMeta.ga4_measurement_id) {
        setMeasurementId(found.configMeta.ga4_measurement_id);
        setEnabled(true);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    loadGa4VaultStatus();
  }, [loadGa4VaultStatus]);

  const handleConnectGoogleAccount = async () => {
    setOauthBusy('connect');
    setMsg(null);
    setConfirmDisconnect(false);
    try {
      const oauthRes = await signInWithGoogleAnalyticsPopup();
      const firstProp = oauthRes.properties[0] || DEFAULT_GITSTACK_GA4_PROPERTIES[0];
      const liveReport = await fetchGa4LiveReport({
        accessToken: oauthRes.accessToken,
        propertyOption: firstProp,
        days,
        firstPartySummary: summary
      });
      const configMeta: IntegrationConfigMeta = {
        ga4_account_email: oauthRes.email,
        ga4_account_name: oauthRes.displayName,
        ga4_property_id: firstProp.property_id,
        ga4_property_name: firstProp.property_name,
        ga4_measurement_id: firstProp.measurement_id,
        ga4_stream_uri: firstProp.stream_uri,
        ga4_properties_list: oauthRes.properties,
        ga4_cached_report: liveReport
      };
      const saved = await api.saveIntegration('google_analytics', {
        secret: oauthRes.accessToken,
        configMeta
      });
      setGa4Item(saved.integration);
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
            : 'Google Analytics sign-in popup was cancelled or blocked.'
      });
    } finally {
      setOauthBusy(null);
    }
  };

  const handleSelectProperty = async (propertyId: string) => {
    if (!ga4Item) return;
    const propsList: Ga4PropertyOption[] =
      ga4Item.configMeta.ga4_properties_list && ga4Item.configMeta.ga4_properties_list.length > 0
        ? ga4Item.configMeta.ga4_properties_list
        : DEFAULT_GITSTACK_GA4_PROPERTIES;
    const chosen = propsList.find((p) => p.property_id === propertyId);
    if (!chosen) return;

    setOauthBusy('property');
    setMsg(null);
    try {
      const liveReport = await fetchGa4LiveReport({
        accessToken: getCachedGa4AccessToken(),
        propertyOption: chosen,
        days,
        firstPartySummary: summary
      });
      const nextMeta: IntegrationConfigMeta = {
        ...ga4Item.configMeta,
        ga4_property_id: chosen.property_id,
        ga4_property_name: chosen.property_name,
        ga4_measurement_id: chosen.measurement_id,
        ga4_stream_uri: chosen.stream_uri,
        ga4_properties_list: propsList,
        ga4_cached_report: liveReport
      };
      const saved = await api.saveIntegration('google_analytics', {
        secret: getCachedGa4AccessToken() || 'oauth_session',
        configMeta: nextMeta
      });
      setGa4Item(saved.integration);
      setMeasurementId(chosen.measurement_id);
      setEnabled(true);
      await onSaveGa4Settings({
        ga4_measurement_id: chosen.measurement_id,
        ga4_enabled: true,
        ga4_track_events: trackEvents
      });
      setMsg({
        type: 'ok',
        text: `Switched GA4 Property to ${chosen.property_name} (${chosen.measurement_id}).`
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
    if (!ga4Item) return;
    setOauthBusy('sync');
    setMsg(null);
    try {
      const propsList: Ga4PropertyOption[] =
        ga4Item.configMeta.ga4_properties_list && ga4Item.configMeta.ga4_properties_list.length > 0
          ? ga4Item.configMeta.ga4_properties_list
          : DEFAULT_GITSTACK_GA4_PROPERTIES;
      const chosen =
        propsList.find((p) => p.property_id === ga4Item.configMeta.ga4_property_id) ||
        propsList[0];
      const liveReport = await fetchGa4LiveReport({
        accessToken: getCachedGa4AccessToken(),
        propertyOption: chosen,
        days,
        firstPartySummary: summary
      });
      const nextMeta: IntegrationConfigMeta = {
        ...ga4Item.configMeta,
        ga4_cached_report: liveReport
      };
      const saved = await api.saveIntegration('google_analytics', {
        secret: getCachedGa4AccessToken() || 'oauth_session',
        configMeta: nextMeta
      });
      setGa4Item(saved.integration);
      setMsg({
        type: 'ok',
        text: `Synced Google Analytics data from ${chosen.property_name}.`
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
      setEnabled(false);
      await onSaveGa4Settings({
        ga4_measurement_id: measurementId,
        ga4_enabled: false,
        ga4_track_events: trackEvents
      });
      setMsg({
        type: 'ok',
        text: 'Disconnected Google Analytics account.'
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

  const cachedGa4 = ga4Item?.connected ? ga4Item.configMeta.ga4_cached_report : null;
  const activeDailySeries =
    cachedGa4 && cachedGa4.dailySeries.length > 0
      ? cachedGa4.dailySeries
      : summary?.dailySeries || [];
  const activeTopPages =
    cachedGa4 && cachedGa4.topPages.length > 0 ? cachedGa4.topPages : summary?.topPages || [];
  const activeTopReferrers =
    cachedGa4 && cachedGa4.topReferrers.length > 0
      ? cachedGa4.topReferrers
      : summary?.topReferrers || [];

  const displayPageviews = cachedGa4 ? cachedGa4.screenPageViews : summary?.totalPageviews ?? 0;
  const displaySessions = cachedGa4 ? cachedGa4.totalSessions : summary?.uniqueSessions ?? 0;

  const maxDailyViews = Math.max(1, ...(activeDailySeries.map((d) => d.pageviews) || [1]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Google Analytics (GA4) &amp; Traffic Dashboard
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Connect your Google Analytics 4 account in one click, select your property, and monitor
            live traffic, top pages, referrers, and lead conversion funnels.
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
            {displayPageviews}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {ga4Item?.connected
              ? `Synced: ${ga4Item.configMeta.ga4_property_name || 'GA4 Property'}`
              : 'Public routes excluding /obama'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Unique Sessions</div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {displaySessions}
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
            GA4 Tag:{' '}
            {settings.ga4_enabled && settings.ga4_measurement_id
              ? settings.ga4_measurement_id
              : 'Inactive'}
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
              {activeDailySeries.map((pt) => {
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
              <span>{activeDailySeries[0]?.date || ''}</span>
              <span>{activeDailySeries[activeDailySeries.length - 1]?.date || ''}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-display text-sm font-bold text-slate-900 border-b border-slate-200 pb-3">
                Top Performing Routes
              </h3>
              <div className="mt-3 divide-y divide-slate-200">
                {activeTopPages.length === 0 ? (
                  <p className="py-4 text-xs text-slate-500">No pageviews recorded in window.</p>
                ) : (
                  activeTopPages.map((row) => (
                    <div
                      key={row.path}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
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
                {activeTopReferrers.length === 0 ? (
                  <p className="py-4 text-xs text-slate-500">No referrer records in window.</p>
                ) : (
                  activeTopReferrers.map((row) => (
                    <div
                      key={row.referrer}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
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

        {/* One-Click GA4 Account Connection + Settings Column (4 cols) */}
        <div className="space-y-5 lg:col-span-4 min-w-0">
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  One-Click Google Account Connection
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Connect your Google Analytics account directly without manual keys.
                </p>
              </div>
              {ga4Item?.connected ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A] shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Connected</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 shrink-0">
                  <Unplug className="h-3.5 w-3.5" />
                  <span>Disconnected</span>
                </span>
              )}
            </div>

            {ga4Item?.connected ? (
              <div className="space-y-3.5">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-xs text-emerald-950">
                  <div className="font-semibold">Connected Google Account</div>
                  <div className="mt-0.5 font-mono text-[11px] text-emerald-800 truncate">
                    {ga4Item.configMeta.ga4_account_email}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Select GA4 Property
                  </label>
                  <select
                    disabled={oauthBusy !== null}
                    value={
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
                        {prop.property_name} ({prop.measurement_id})
                      </option>
                    ))}
                  </select>
                </div>

                {confirmDisconnect ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2.5">
                    <p className="text-xs font-medium text-red-900">
                      Disconnect {ga4Item.configMeta.ga4_account_email} from Google Analytics?
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDisconnect(false)}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleDisconnectConfirmed}
                        className="flex-1 rounded-lg bg-[#DC2626] px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                      >
                        Confirm Disconnect
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={oauthBusy !== null}
                      onClick={handleSyncGa4Report}
                      className="min-h-[40px] w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${oauthBusy === 'sync' ? 'animate-spin' : ''}`}
                      />
                      <span>
                        {oauthBusy === 'sync' ? 'Syncing GA4 Data...' : 'Sync GA4 Data Now'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={oauthBusy !== null}
                      onClick={() => setConfirmDisconnect(true)}
                      className="min-h-[40px] w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#DC2626] hover:bg-red-50 disabled:opacity-50"
                    >
                      <Unplug className="h-3.5 w-3.5" />
                      <span>Disconnect Google Account</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs leading-relaxed text-slate-600">
                  Sign in with Google to auto-discover your GA4 properties, link your Measurement
                  ID, and pull traffic data without pasting keys.
                </p>
                <button
                  type="button"
                  disabled={oauthBusy !== null}
                  onClick={handleConnectGoogleAccount}
                  className="min-h-[44px] w-full inline-flex items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 disabled:opacity-50"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>
                    {oauthBusy === 'connect'
                      ? 'Connecting Google Account...'
                      : 'Connect with Google Analytics'}
                  </span>
                </button>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSave}
            className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 h-fit"
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
              <span>{saving ? 'Saving GA4 Settings...' : 'Save Tag Preferences'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
