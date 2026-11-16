import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Cloud,
  Eye,
  EyeOff,
  Github,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  PlugZap,
  RefreshCw,
  Search,
  Sparkles,
  Unplug
} from 'lucide-react';
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
  Ga4PropertyOption,
  IntegrationConfigMeta,
  IntegrationProviderId,
  IntegrationStatusItem
} from '../../shared/types.ts';

interface IntegrationsVaultPanelProps {
  onIntegrationsChanged?: () => void;
}

const PROVIDER_ICON: Record<IntegrationProviderId, React.ComponentType<{ className?: string }>> = {
  lark_smtp: Mail,
  google_analytics: BarChart3,
  apollo: Search,
  google_maps: MapPin,
  gemini: Sparkles,
  github: Github,
  cloudflare: Cloud
};

export function IntegrationsVaultPanel({ onIntegrationsChanged }: IntegrationsVaultPanelProps) {
  const [items, setItems] = useState<IntegrationStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Per-provider draft inputs (never initialized with real secrets)
  const [secretDrafts, setSecretDrafts] = useState<Record<string, string>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [larkMeta, setLarkMeta] = useState<IntegrationConfigMeta>({
    email: '',
    sender_name: 'GitStack Solutions',
    smtp_host: 'smtp.larksuite.com',
    smtp_port: 465,
    smtp_ssl: true,
    imap_host: 'imap.larksuite.com',
    imap_port: 993,
    imap_ssl: true
  });
  const [cloudflareMeta, setCloudflareMeta] = useState<IntegrationConfigMeta>({
    zone_id: '',
    zone_name: 'git-stack.org'
  });
  const [confirmDisconnectGa4, setConfirmDisconnectGa4] = useState(false);

  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [testingAll, setTestingAll] = useState(false);

  const loadIntegrations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listIntegrations();
      setItems(res.integrations);
      const lark = res.integrations.find((i) => i.provider === 'lark_smtp');
      if (lark) {
        setLarkMeta((prev) => ({
          email: lark.configMeta.email || prev.email || '',
          sender_name: lark.configMeta.sender_name || prev.sender_name || 'GitStack Solutions',
          smtp_host: lark.configMeta.smtp_host || 'smtp.larksuite.com',
          smtp_port: Number(lark.configMeta.smtp_port) || 465,
          smtp_ssl: lark.configMeta.smtp_ssl !== false,
          imap_host: lark.configMeta.imap_host || 'imap.larksuite.com',
          imap_port: Number(lark.configMeta.imap_port) || 993,
          imap_ssl: lark.configMeta.imap_ssl !== false
        }));
      }
      const cf = res.integrations.find((i) => i.provider === 'cloudflare');
      if (cf) {
        setCloudflareMeta((prev) => ({
          zone_id: cf.configMeta.zone_id || prev.zone_id || '',
          zone_name: cf.configMeta.zone_name || prev.zone_name || 'git-stack.org'
        }));
      }
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load integrations status.'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  const replaceItem = (updated: IntegrationStatusItem) => {
    setItems((prev) => prev.map((it) => (it.provider === updated.provider ? updated : it)));
    if (updated.provider === 'cloudflare') {
      setCloudflareMeta((prev) => ({
        zone_id: updated.configMeta.zone_id || prev.zone_id || '',
        zone_name: updated.configMeta.zone_name || prev.zone_name || 'git-stack.org'
      }));
    }
    onIntegrationsChanged?.();
  };

  const handleSaveConnect = async (
    provider: IntegrationProviderId,
    options?: { useEnvFallback?: boolean }
  ) => {
    setBusyProvider(`save:${provider}`);
    setNotice(null);
    try {
      const secret = (secretDrafts[provider] || '').trim();
      const res = await api.saveIntegration(provider, {
        ...(options?.useEnvFallback ? { useEnvFallback: true } : { secret }),
        ...(provider === 'lark_smtp' ? { configMeta: larkMeta } : {}),
        ...(provider === 'cloudflare' ? { configMeta: cloudflareMeta } : {})
      });
      replaceItem(res.integration);
      setSecretDrafts((prev) => ({ ...prev, [provider]: '' }));
      setShowSecret((prev) => ({ ...prev, [provider]: false }));
      setNotice({
        type: 'ok',
        text: `${res.integration.label} connected: ${res.testResult.message}`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : `Failed to verify and connect ${provider}.`
      });
    } finally {
      setBusyProvider(null);
    }
  };

  const handleTest = async (provider: IntegrationProviderId) => {
    setBusyProvider(`test:${provider}`);
    setNotice(null);
    try {
      const draftSecret = (secretDrafts[provider] || '').trim();
      const res = await api.testIntegration(provider, {
        ...(draftSecret ? { secret: draftSecret } : {}),
        ...(provider === 'lark_smtp' ? { configMeta: larkMeta } : {}),
        ...(provider === 'cloudflare' ? { configMeta: cloudflareMeta } : {})
      });
      replaceItem(res.integration);
      setNotice({
        type: res.testResult.ok ? 'ok' : 'err',
        text: `${res.integration.label}: ${res.testResult.message}`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : `Connection test failed for ${provider}.`
      });
    } finally {
      setBusyProvider(null);
    }
  };

  const handleDisconnect = async (provider: IntegrationProviderId, label: string) => {
    setBusyProvider(`disc:${provider}`);
    setNotice(null);
    try {
      const res = await api.disconnectIntegration(provider);
      replaceItem(res.integration);
      setSecretDrafts((prev) => ({ ...prev, [provider]: '' }));
      setNotice({
        type: 'ok',
        text: `${label} disconnected and vault secret wiped.`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : `Failed to disconnect ${label}.`
      });
    } finally {
      setBusyProvider(null);
    }
  };

  const handleTestAllActive = async () => {
    const active = items.filter((i) => i.connected);
    if (active.length === 0) return;
    setTestingAll(true);
    setNotice(null);
    let passed = 0;
    let failed = 0;
    for (const item of active) {
      try {
        const res = await api.testIntegration(item.provider);
        replaceItem(res.integration);
        if (res.testResult.ok) passed++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setTestingAll(false);
    setNotice({
      type: failed === 0 ? 'ok' : 'err',
      text: `Tested ${active.length} active integration${active.length === 1 ? '' : 's'}: ${passed} verified, ${failed} failed.`
    });
  };

  const handleConnectGoogleAnalyticsOAuth = async () => {
    setBusyProvider('oauth:google_analytics');
    setNotice(null);
    setConfirmDisconnectGa4(false);
    try {
      const oauthRes = await signInWithGoogleAnalyticsPopup();
      const firstProp = oauthRes.properties[0] || DEFAULT_GITSTACK_GA4_PROPERTIES[0];
      const summaryRes = await api.getAnalyticsSummary(30).catch(() => null);
      const liveReport = await fetchGa4LiveReport({
        accessToken: oauthRes.accessToken,
        propertyOption: firstProp,
        days: 30,
        firstPartySummary: summaryRes?.summary || null
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
      // Automatically bind the selected GA4 Measurement ID to public consent-gated analytics
      try {
        const currentSettings = await api.getAdSenseSettings();
        await api.saveAdSenseSettings({
          ...currentSettings.settings,
          ga4_measurement_id: firstProp.measurement_id,
          ga4_enabled: true,
          ga4_track_events: true
        });
      } catch {
        // Non-fatal
      }
      replaceItem(saved.integration);
      setNotice({
        type: 'ok',
        text: `Connected Google Analytics as ${oauthRes.email} · Selected ${firstProp.property_name} (${firstProp.measurement_id}).`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Google Analytics sign-in popup was cancelled or blocked.'
      });
    } finally {
      setBusyProvider(null);
    }
  };

  const handleSelectGa4Property = async (
    propertyId: string,
    gaItem: IntegrationStatusItem
  ) => {
    const propsList: Ga4PropertyOption[] =
      gaItem.configMeta.ga4_properties_list && gaItem.configMeta.ga4_properties_list.length > 0
        ? gaItem.configMeta.ga4_properties_list
        : DEFAULT_GITSTACK_GA4_PROPERTIES;
    const chosen = propsList.find((p) => p.property_id === propertyId);
    if (!chosen) return;

    setBusyProvider('prop:google_analytics');
    setNotice(null);
    try {
      const summaryRes = await api.getAnalyticsSummary(30).catch(() => null);
      const liveReport = await fetchGa4LiveReport({
        accessToken: getCachedGa4AccessToken(),
        propertyOption: chosen,
        days: 30,
        firstPartySummary: summaryRes?.summary || null
      });
      const nextMeta: IntegrationConfigMeta = {
        ...gaItem.configMeta,
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
      try {
        const currentSettings = await api.getAdSenseSettings();
        await api.saveAdSenseSettings({
          ...currentSettings.settings,
          ga4_measurement_id: chosen.measurement_id,
          ga4_enabled: true
        });
      } catch {
        // Non-fatal
      }
      replaceItem(saved.integration);
      setNotice({
        type: 'ok',
        text: `Switched active Google Analytics property to ${chosen.property_name} (${chosen.measurement_id}).`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to switch GA4 property.'
      });
    } finally {
      setBusyProvider(null);
    }
  };

  const handleSyncGa4Data = async (gaItem: IntegrationStatusItem) => {
    setBusyProvider('sync:google_analytics');
    setNotice(null);
    try {
      const propsList: Ga4PropertyOption[] =
        gaItem.configMeta.ga4_properties_list && gaItem.configMeta.ga4_properties_list.length > 0
          ? gaItem.configMeta.ga4_properties_list
          : DEFAULT_GITSTACK_GA4_PROPERTIES;
      const chosen =
        propsList.find((p) => p.property_id === gaItem.configMeta.ga4_property_id) ||
        propsList[0];
      const summaryRes = await api.getAnalyticsSummary(30).catch(() => null);
      const liveReport = await fetchGa4LiveReport({
        accessToken: getCachedGa4AccessToken(),
        propertyOption: chosen,
        days: 30,
        firstPartySummary: summaryRes?.summary || null
      });
      const nextMeta: IntegrationConfigMeta = {
        ...gaItem.configMeta,
        ga4_cached_report: liveReport
      };
      const saved = await api.saveIntegration('google_analytics', {
        secret: getCachedGa4AccessToken() || 'oauth_session',
        configMeta: nextMeta
      });
      replaceItem(saved.integration);
      setNotice({
        type: 'ok',
        text: `Synced Google Analytics data for ${chosen.property_name}: ${liveReport.screenPageViews} pageviews, ${liveReport.activeUsers} active users.`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to sync Google Analytics data.'
      });
    } finally {
      setBusyProvider(null);
    }
  };

  const handleDisconnectGa4Confirmed = async () => {
    setBusyProvider('disc:google_analytics');
    setNotice(null);
    setConfirmDisconnectGa4(false);
    try {
      await disconnectGoogleAnalyticsOAuth();
      const res = await api.disconnectIntegration('google_analytics');
      try {
        const currentSettings = await api.getAdSenseSettings();
        await api.saveAdSenseSettings({
          ...currentSettings.settings,
          ga4_enabled: false
        });
      } catch {
        // Non-fatal
      }
      replaceItem(res.integration);
      setNotice({
        type: 'ok',
        text: 'Google Analytics account disconnected and OAuth session cleared.'
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to disconnect Google Analytics.'
      });
    } finally {
      setBusyProvider(null);
    }
  };

  const activeCount = items.filter((i) => i.connected).length;
  const larkItem = items.find((i) => i.provider === 'lark_smtp');
  const ga4Item = items.find((i) => i.provider === 'google_analytics');
  const apiProviders = items.filter(
    (i) => i.provider !== 'lark_smtp' && i.provider !== 'google_analytics'
  );

  const renderStatusLabel = (item: IntegrationStatusItem) => {
    const isApolloTrial =
      item.provider === 'apollo' &&
      item.connected &&
      item.configMeta?.apollo_capability === 'trial_or_scoped';
    const isApolloFull =
      item.provider === 'apollo' &&
      item.connected &&
      item.configMeta?.apollo_capability === 'full_search';

    if (item.source === 'vault' && item.connected) {
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#16A34A]">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>Connected (Vault)</span>
          {isApolloTrial && (
            <span className="text-[#D97706] font-semibold">· Trial / Scoped Plan</span>
          )}
          {isApolloFull && (
            <span className="text-[#16A34A] font-semibold">· Full Paid Search</span>
          )}
        </span>
      );
    }
    if (item.source === 'env' && item.connected) {
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#16A34A]">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>Connected (Server Env)</span>
          {isApolloTrial && (
            <span className="text-[#D97706] font-semibold">· Trial / Scoped Plan</span>
          )}
          {isApolloFull && (
            <span className="text-[#16A34A] font-semibold">· Full Paid Search</span>
          )}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <Unplug className="h-3.5 w-3.5 shrink-0" />
        <span>Disconnected</span>
      </span>
    );
  };

  return (
    <section className="space-y-5">
      {/* Header Summary Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Lock className="h-4 w-4 text-[var(--gs-primary)] shrink-0" />
              <h2 className="font-display text-lg font-bold text-slate-900">
                API &amp; Mail Integrations Vault
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-600 max-w-2xl">
              Configure, verify, connect, or disconnect Lark Mail SMTP, Apollo.io, Google Maps,
              Gemini AI, GitHub, and Cloudflare tokens directly from the UI. Secrets are AES-256-GCM
              encrypted server-side in Supabase and never exposed back to the browser.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="border-r border-slate-200 pr-3 text-right">
              <div className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                {activeCount} / {items.length || 6}
              </div>
              <div className="text-[11px] font-medium text-slate-500">Active Connections</div>
            </div>
            <button
              type="button"
              disabled={testingAll || activeCount === 0}
              onClick={handleTestAllActive}
              className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
            >
              <PlugZap className="h-3.5 w-3.5" />
              <span>{testingAll ? 'Testing...' : 'Test All Active'}</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={loadIntegrations}
              className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {notice && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
              notice.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            {notice.type === 'ok' ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#16A34A]" />
            ) : (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#DC2626]" />
            )}
            <span>{notice.text}</span>
          </div>
        )}
      </div>

      {/* Integrations Cards Grid */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Featured Full-Width Card: Lark Mail SMTP SSL */}
        {larkItem && (
          <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-200 pb-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[var(--gs-primary)] shrink-0">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="font-display text-base font-bold text-slate-900">
                        {larkItem.label}
                      </h3>
                      {renderStatusLabel(larkItem)}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600">{larkItem.description}</p>
                  </div>
                </div>
              </div>

              {larkItem.maskedHint && (
                <div className="font-mono text-xs text-slate-600 tabular-nums shrink-0">
                  Auth Code: <span className="font-semibold text-slate-900">{larkItem.maskedHint}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Lark Email Address *
                </label>
                <input
                  type="email"
                  value={larkMeta.email || ''}
                  onChange={(e) => setLarkMeta((m) => ({ ...m, email: e.target.value }))}
                  placeholder="rolan@git-stack.org"
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Sender Display Name
                </label>
                <input
                  type="text"
                  value={larkMeta.sender_name || ''}
                  onChange={(e) => setLarkMeta((m) => ({ ...m, sender_name: e.target.value }))}
                  placeholder="GitStack Solutions"
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Third-Party Authorization Code *
                </label>
                <div className="relative mt-1">
                  <input
                    type={showSecret.lark_smtp ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={secretDrafts.lark_smtp || ''}
                    onChange={(e) =>
                      setSecretDrafts((prev) => ({ ...prev, lark_smtp: e.target.value }))
                    }
                    placeholder={
                      larkItem.connected
                        ? `Saved (${larkItem.maskedHint}) — paste new code to rotate`
                        : 'Paste Lark Mail Authorization Code'
                    }
                    className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-3 pr-10 py-2 font-mono text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label={showSecret.lark_smtp ? 'Hide authorization code' : 'Show authorization code'}
                    onClick={() =>
                      setShowSecret((prev) => ({ ...prev, lark_smtp: !prev.lark_smtp }))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  >
                    {showSecret.lark_smtp ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Sending Server (SMTP)
                </label>
                <input
                  type="text"
                  value={larkMeta.smtp_host || 'smtp.larksuite.com'}
                  onChange={(e) => setLarkMeta((m) => ({ ...m, smtp_host: e.target.value }))}
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  SMTP Port (SSL)
                </label>
                <input
                  type="number"
                  value={larkMeta.smtp_port ?? 465}
                  onChange={(e) =>
                    setLarkMeta((m) => ({ ...m, smtp_port: Number(e.target.value) || 465 }))
                  }
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 font-mono text-xs text-slate-900 tabular-nums focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Receiving Server (IMAP)
                </label>
                <input
                  type="text"
                  value={larkMeta.imap_host || 'imap.larksuite.com'}
                  onChange={(e) => setLarkMeta((m) => ({ ...m, imap_host: e.target.value }))}
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  IMAP Port (SSL)
                </label>
                <input
                  type="number"
                  value={larkMeta.imap_port ?? 993}
                  onChange={(e) =>
                    setLarkMeta((m) => ({ ...m, imap_port: Number(e.target.value) || 993 }))
                  }
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 font-mono text-xs text-slate-900 tabular-nums focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[11px] text-slate-500 min-w-0">
                {larkItem.lastTestMessage ? (
                  <span
                    className={
                      larkItem.lastTestStatus === 'ok'
                        ? 'text-[#16A34A] font-medium'
                        : larkItem.lastTestStatus === 'error'
                          ? 'text-[#DC2626] font-medium'
                          : 'text-slate-600'
                    }
                  >
                    {larkItem.lastTestMessage}
                    {larkItem.lastTestedAt && (
                      <span className="ml-2 font-mono text-slate-400 tabular-nums">
                        ({new Date(larkItem.lastTestedAt).toLocaleString()})
                      </span>
                    )}
                  </span>
                ) : (
                  <span>{larkItem.docsHint}</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={busyProvider !== null}
                  onClick={() => handleTest('lark_smtp')}
                  className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <PlugZap className="h-3.5 w-3.5" />
                  <span>{busyProvider === 'test:lark_smtp' ? 'Testing SMTP...' : 'Test SMTP'}</span>
                </button>

                <button
                  type="button"
                  disabled={busyProvider !== null}
                  onClick={() => handleSaveConnect('lark_smtp')}
                  className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>
                    {busyProvider === 'save:lark_smtp'
                      ? 'Verifying...'
                      : larkItem.connected
                        ? 'Update & Verify SMTP'
                        : 'Connect & Verify SMTP'}
                  </span>
                </button>

                {larkItem.connected && (
                  <button
                    type="button"
                    disabled={busyProvider !== null}
                    onClick={() => handleDisconnect('lark_smtp', larkItem.label)}
                    className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#DC2626] hover:bg-red-50 disabled:opacity-50"
                  >
                    <Unplug className="h-3.5 w-3.5" />
                    <span>{busyProvider === 'disc:lark_smtp' ? 'Disconnecting...' : 'Disconnect'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Featured Full-Width Card: Google Analytics 4 (One-Click OAuth Connect & Property Selector) */}
        {ga4Item && (
          <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-200 pb-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[var(--gs-primary)] shrink-0">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="font-display text-base font-bold text-slate-900">
                        {ga4Item.label}
                      </h3>
                      {renderStatusLabel(ga4Item)}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600">{ga4Item.description}</p>
                  </div>
                </div>
              </div>

              {ga4Item.connected && ga4Item.configMeta.ga4_account_email && (
                <div className="font-mono text-xs text-slate-600 tabular-nums shrink-0">
                  Google Account:{' '}
                  <span className="font-semibold text-slate-900">
                    {ga4Item.configMeta.ga4_account_email}
                  </span>
                </div>
              )}
            </div>

            {ga4Item.connected ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Connected GA4 Property &amp; Web Data Stream
                  </label>
                  <select
                    disabled={busyProvider !== null}
                    value={
                      ga4Item.configMeta.ga4_property_id ||
                      DEFAULT_GITSTACK_GA4_PROPERTIES[0].property_id
                    }
                    onChange={(e) => handleSelectGa4Property(e.target.value, ga4Item)}
                    className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                  >
                    {(ga4Item.configMeta.ga4_properties_list &&
                    ga4Item.configMeta.ga4_properties_list.length > 0
                      ? ga4Item.configMeta.ga4_properties_list
                      : DEFAULT_GITSTACK_GA4_PROPERTIES
                    ).map((prop) => (
                      <option key={prop.property_id} value={prop.property_id}>
                        {prop.property_name} — {prop.measurement_id} ({prop.property_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Active Measurement Tag
                  </label>
                  <div className="mt-1 min-h-[42px] flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900">
                    <span className="font-semibold text-[var(--gs-primary)]">
                      {ga4Item.configMeta.ga4_measurement_id || 'G-GS94820144'}
                    </span>
                    <span className="text-[11px] text-[#16A34A] font-semibold">Auto-Synced</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-900">
                    No Manual API Keys Required
                  </div>
                  <p className="text-xs text-slate-600">
                    Click the button to sign in with your existing Google Analytics account, choose
                    your GA4 property, and pull traffic data automatically.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={busyProvider !== null}
                  onClick={handleConnectGoogleAnalyticsOAuth}
                  className="min-h-[42px] inline-flex items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 disabled:opacity-50 shrink-0"
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
                    {busyProvider === 'oauth:google_analytics'
                      ? 'Connecting Google Account...'
                      : 'Connect with Google Analytics'}
                  </span>
                </button>
              </div>
            )}

            {confirmDisconnectGa4 && ga4Item.connected && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs font-medium text-red-900">
                  Disconnect Google Analytics account ({ga4Item.configMeta.ga4_account_email}) and
                  stop GA4 property sync?
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnectGa4(false)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectGa4Confirmed}
                    className="rounded-lg bg-[#DC2626] px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    Confirm Disconnect
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[11px] text-slate-500 min-w-0">
                {ga4Item.lastTestMessage ? (
                  <span
                    className={
                      ga4Item.lastTestStatus === 'ok'
                        ? 'text-[#16A34A] font-medium'
                        : ga4Item.lastTestStatus === 'error'
                          ? 'text-[#DC2626] font-medium'
                          : 'text-slate-600'
                    }
                  >
                    {ga4Item.lastTestMessage}
                    {ga4Item.lastTestedAt && (
                      <span className="ml-2 font-mono text-slate-400 tabular-nums">
                        ({new Date(ga4Item.lastTestedAt).toLocaleString()})
                      </span>
                    )}
                  </span>
                ) : (
                  <span>{ga4Item.docsHint}</span>
                )}
              </div>

              {ga4Item.connected && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busyProvider !== null}
                    onClick={() => handleSyncGa4Data(ga4Item)}
                    className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        busyProvider === 'sync:google_analytics' ? 'animate-spin' : ''
                      }`}
                    />
                    <span>
                      {busyProvider === 'sync:google_analytics'
                        ? 'Syncing GA4...'
                        : 'Sync GA4 Data Now'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={busyProvider !== null}
                    onClick={handleConnectGoogleAnalyticsOAuth}
                    className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <span>Switch Google Account</span>
                  </button>

                  <button
                    type="button"
                    disabled={busyProvider !== null}
                    onClick={() => setConfirmDisconnectGa4(true)}
                    className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#DC2626] hover:bg-red-50 disabled:opacity-50"
                  >
                    <Unplug className="h-3.5 w-3.5" />
                    <span>
                      {busyProvider === 'disc:google_analytics' ? 'Disconnecting...' : 'Disconnect'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* API Provider Cards: Apollo, Google Maps, Gemini, GitHub */}
        {apiProviders.map((item) => {
          const Icon = PROVIDER_ICON[item.provider];
          const draft = secretDrafts[item.provider] || '';
          const visible = Boolean(showSecret[item.provider]);

          return (
            <div
              key={item.provider}
              className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[var(--gs-primary)] shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-sm font-bold text-slate-900 truncate">
                        {item.label}
                      </h3>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        {renderStatusLabel(item)}
                        {item.maskedHint && (
                          <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                            · Key {item.maskedHint}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400 shrink-0">
                    {item.category}
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-slate-600">{item.description}</p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    API Key / Access Token
                  </label>
                  <div className="relative mt-1">
                    <input
                      type={visible ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={draft}
                      onChange={(e) =>
                        setSecretDrafts((prev) => ({ ...prev, [item.provider]: e.target.value }))
                      }
                      placeholder={
                        item.connected
                          ? `Active (${item.maskedHint}) — paste new key to override`
                          : 'Paste secret API key here...'
                      }
                      className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-3 pr-10 py-2 font-mono text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      aria-label={visible ? 'Hide key' : 'Show key'}
                      onClick={() =>
                        setShowSecret((prev) => ({ ...prev, [item.provider]: !prev[item.provider] }))
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                    >
                      {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">{item.docsHint}</p>
                </div>

                {item.provider === 'cloudflare' && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Domain / Zone Name
                      </label>
                      <input
                        type="text"
                        value={cloudflareMeta.zone_name || 'git-stack.org'}
                        onChange={(e) =>
                          setCloudflareMeta((prev) => ({ ...prev, zone_name: e.target.value }))
                        }
                        placeholder="git-stack.org"
                        className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Zone ID (Optional if domain given)
                      </label>
                      <input
                        type="text"
                        value={cloudflareMeta.zone_id || ''}
                        onChange={(e) =>
                          setCloudflareMeta((prev) => ({ ...prev, zone_id: e.target.value }))
                        }
                        placeholder="32-char Cloudflare Zone ID"
                        className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 border-t border-slate-200 pt-3.5">
                {item.lastTestMessage && (
                  <div
                    className={`text-[11px] leading-relaxed ${
                      item.provider === 'apollo' &&
                      item.configMeta?.apollo_capability === 'trial_or_scoped' &&
                      item.lastTestStatus === 'ok'
                        ? 'text-[#D97706] font-medium'
                        : item.lastTestStatus === 'ok'
                          ? 'text-[#16A34A] font-medium'
                          : item.lastTestStatus === 'error'
                            ? 'text-[#DC2626] font-medium'
                            : 'text-slate-500'
                    }`}
                  >
                    {item.lastTestMessage}
                    {item.lastTestedAt && (
                      <span className="ml-1.5 font-mono text-slate-400 tabular-nums">
                        · {new Date(item.lastTestedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busyProvider !== null || (!draft.trim() && !item.connected)}
                    onClick={() => handleSaveConnect(item.provider)}
                    className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>
                      {busyProvider === `save:${item.provider}`
                        ? 'Verifying...'
                        : item.connected
                          ? 'Update & Verify'
                          : 'Connect & Verify'}
                    </span>
                  </button>

                  {!item.connected && item.envFallbackAvailable && !draft.trim() && (
                    <button
                      type="button"
                      disabled={busyProvider !== null}
                      onClick={() => handleSaveConnect(item.provider, { useEnvFallback: true })}
                      className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Use Server Env</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={busyProvider !== null || (!draft.trim() && !item.connected)}
                    onClick={() => handleTest(item.provider)}
                    className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <PlugZap className="h-3.5 w-3.5" />
                    <span>
                      {busyProvider === `test:${item.provider}` ? 'Testing...' : 'Test Connection'}
                    </span>
                  </button>

                  {item.connected && (
                    <button
                      type="button"
                      disabled={busyProvider !== null}
                      onClick={() => handleDisconnect(item.provider, item.label)}
                      className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-[#DC2626] hover:bg-red-50 disabled:opacity-50"
                    >
                      <Unplug className="h-3.5 w-3.5" />
                      <span>
                        {busyProvider === `disc:${item.provider}` ? 'Disconnecting...' : 'Disconnect'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
