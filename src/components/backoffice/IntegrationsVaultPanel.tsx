import {
  AlertTriangle,
  CheckCircle2,
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
import type {
  IntegrationConfigMeta,
  IntegrationProviderId,
  IntegrationStatusItem
} from '../../shared/types.ts';

interface IntegrationsVaultPanelProps {
  onIntegrationsChanged?: () => void;
}

const PROVIDER_ICON: Record<IntegrationProviderId, React.ComponentType<{ className?: string }>> = {
  lark_smtp: Mail,
  apollo: Search,
  google_maps: MapPin,
  gemini: Sparkles,
  github: Github
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
        ...(provider === 'lark_smtp' ? { configMeta: larkMeta } : {})
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
        ...(provider === 'lark_smtp' ? { configMeta: larkMeta } : {})
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

  const activeCount = items.filter((i) => i.connected).length;
  const larkItem = items.find((i) => i.provider === 'lark_smtp');
  const apiProviders = items.filter((i) => i.provider !== 'lark_smtp');

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
              Gemini AI, and GitHub tokens directly from the UI. Secrets are AES-256-GCM encrypted
              server-side in Supabase and never exposed back to the browser.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="border-r border-slate-200 pr-3 text-right">
              <div className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                {activeCount} / {items.length || 5}
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
