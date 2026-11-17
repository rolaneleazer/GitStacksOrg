import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Copy,
  ExternalLink,
  Layers,
  MousePointerClick,
  Palette,
  RefreshCw,
  Save,
  Sliders,
  Sparkles,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import type { AdSenseSettings, BmcAnalyticsData } from '../../shared/types.ts';
import {
  BuyMeACoffeeButton,
  DEFAULT_BMC_COLOR,
  DEFAULT_BMC_HANDLE,
  DEFAULT_BMC_TEXT,
  DEFAULT_BMC_URL,
  getBmcTargetUrl,
  getContrastTextColor,
  getFontClass
} from '../BuyMeACoffee.tsx';

interface BuyMeACoffeeHubPanelProps {
  settings: AdSenseSettings;
  onSave: (patch: Partial<AdSenseSettings>) => Promise<boolean | void>;
  saving?: boolean;
}

const COLOR_PRESETS = [
  { name: 'BMC Classic Yellow', hex: '#FFDD00' },
  { name: 'Electric Blue', hex: '#5F7FFF' },
  { name: 'Vibrant Coral', hex: '#FF5E5B' },
  { name: 'Mint Emerald', hex: '#10B981' },
  { name: 'Royal Violet', hex: '#8B5CF6' },
  { name: 'Obsidian Slate', hex: '#0F172A' }
];

export function BuyMeACoffeeHubPanel({
  settings,
  onSave,
  saving = false
}: BuyMeACoffeeHubPanelProps) {
  // Local form state initialized from settings
  const [formData, setFormData] = useState<Partial<AdSenseSettings>>({
    bmc_enabled: settings.bmc_enabled ?? true,
    bmc_handle: settings.bmc_handle || DEFAULT_BMC_HANDLE,
    bmc_custom_url: settings.bmc_custom_url || DEFAULT_BMC_URL,
    bmc_button_text: settings.bmc_button_text || DEFAULT_BMC_TEXT,
    bmc_button_color: settings.bmc_button_color || DEFAULT_BMC_COLOR,
    bmc_font_style: settings.bmc_font_style || 'Cookie',
    bmc_header_enabled: settings.bmc_header_enabled ?? true,
    bmc_footer_enabled: settings.bmc_footer_enabled ?? true,
    bmc_floating_enabled: settings.bmc_floating_enabled ?? true,
    bmc_floating_position: settings.bmc_floating_position || 'Right',
    bmc_floating_y_offset: settings.bmc_floating_y_offset ?? 84,
    bmc_support_message:
      settings.bmc_support_message ||
      'Support independent open-source tools, technical research, and live sandbox maintenance.'
  });

  const [analytics, setAnalytics] = useState<BmcAnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [simulatingClick, setSimulatingClick] = useState<string | null>(null);

  // Sync when prop updates
  useEffect(() => {
    setFormData({
      bmc_enabled: settings.bmc_enabled ?? true,
      bmc_handle: settings.bmc_handle || DEFAULT_BMC_HANDLE,
      bmc_custom_url: settings.bmc_custom_url || DEFAULT_BMC_URL,
      bmc_button_text: settings.bmc_button_text || DEFAULT_BMC_TEXT,
      bmc_button_color: settings.bmc_button_color || DEFAULT_BMC_COLOR,
      bmc_font_style: settings.bmc_font_style || 'Cookie',
      bmc_header_enabled: settings.bmc_header_enabled ?? true,
      bmc_footer_enabled: settings.bmc_footer_enabled ?? true,
      bmc_floating_enabled: settings.bmc_floating_enabled ?? true,
      bmc_floating_position: settings.bmc_floating_position || 'Right',
      bmc_floating_y_offset: settings.bmc_floating_y_offset ?? 84,
      bmc_support_message:
        settings.bmc_support_message ||
        'Support independent open-source tools, technical research, and live sandbox maintenance.'
    });
  }, [settings]);

  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const data = await api.getBmcAnalytics();
      setAnalytics(data);
    } catch {
      // fallback if network fails
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const handleChange = <K extends keyof AdSenseSettings>(key: K, value: AdSenseSettings[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const result = await onSave(formData);
      if (result === false) {
        setSaveError('Failed to save configuration. Super Admin access is required.');
        return;
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save Buy Me a Coffee settings.');
    }
  };

  const currentTargetUrl = getBmcTargetUrl(formData as AdSenseSettings);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentTargetUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleSimulateClick = async (placement: 'header' | 'footer' | 'floating') => {
    setSimulatingClick(placement);
    try {
      const res = await api.trackBmcClick(placement);
      if (res.analytics) {
        setAnalytics(res.analytics);
      } else {
        await loadAnalytics();
      }
    } catch {
      // ignore
    } finally {
      setSimulatingClick(null);
    }
  };

  const activePlacementCount = [
    formData.bmc_header_enabled,
    formData.bmc_footer_enabled,
    formData.bmc_floating_enabled
  ].filter(Boolean).length;

  const previewSettings = {
    ...settings,
    ...formData
  } as AdSenseSettings;

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner & Status */}
      <div className="flex flex-col gap-4 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/80 via-yellow-50/40 to-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 shadow-md">
            <Coffee className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Buy Me a Coffee Hub &amp; Live Controller
              </h2>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  formData.bmc_enabled
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    formData.bmc_enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                {formData.bmc_enabled
                  ? `Active (${activePlacementCount} Placements)`
                  : 'Paused Site-Wide'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Customize placement toggles (Header, Footer, Floating widget), appearance colors,
              typography, target URL, and monitor live supporter referral telemetry.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={handleCopyUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedUrl ? 'Copied URL!' : 'Copy Link'}</span>
          </button>
          <a
            href={currentTargetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-2xs hover:bg-amber-300 transition-colors"
          >
            <Coffee className="h-3.5 w-3.5" />
            <span>Open Page</span>
            <ExternalLink className="h-3 w-3 opacity-70" />
          </a>
        </div>
      </div>

      {/* Supporter Clicks Analytics Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900">Live Supporter Click Telemetry</h3>
            <span className="text-xs text-slate-500">Real-time interaction breakdown</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAnalytics}
              disabled={loadingAnalytics}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingAnalytics ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Total Clicks</span>
              <MousePointerClick className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {analytics ? analytics.totalClicks : '—'}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">All placements combined</div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Header Clicks</span>
              <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                Navbar
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-sky-700">
              {analytics ? analytics.headerClicks : '—'}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Top desktop &amp; mobile</span>
              <button
                type="button"
                onClick={() => handleSimulateClick('header')}
                disabled={simulatingClick === 'header'}
                className="text-[10px] text-sky-600 hover:underline disabled:opacity-50"
              >
                + Test click
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Footer Clicks</span>
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                Footer
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-amber-700">
              {analytics ? analytics.footerClicks : '—'}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Bottom support card</span>
              <button
                type="button"
                onClick={() => handleSimulateClick('footer')}
                disabled={simulatingClick === 'footer'}
                className="text-[10px] text-amber-700 hover:underline disabled:opacity-50"
              >
                + Test click
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Floating Clicks</span>
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                Floating
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-700">
              {analytics ? analytics.floatingClicks : '—'}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Corner widget launcher</span>
              <button
                type="button"
                onClick={() => handleSimulateClick('floating')}
                disabled={simulatingClick === 'floating'}
                className="text-[10px] text-emerald-700 hover:underline disabled:opacity-50"
              >
                + Test click
              </button>
            </div>
          </div>
        </div>

        {/* Last clicked info */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>
              Last Supporter Click:{' '}
              <strong className="text-slate-700 font-medium">
                {analytics?.lastClickedAt
                  ? new Date(analytics.lastClickedAt).toLocaleString()
                  : 'No clicks recorded yet'}
              </strong>
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Click events persist in database and telemetry logs
          </span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Placement On/Off Configuration */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <Layers className="h-5 w-5 text-slate-700" />
            <h3 className="font-semibold text-slate-900">Placement Controls &amp; Visibility</h3>
          </div>

          <div className="mt-5 space-y-4">
            {/* Master Toggle */}
            <div className="flex items-center justify-between rounded-xl border-2 border-amber-200/80 bg-amber-50/30 p-4">
              <div>
                <span className="font-semibold text-slate-900">Master Integration Switch</span>
                <p className="text-xs text-slate-600 mt-0.5">
                  Globally enable or disable Buy Me a Coffee everywhere across the application.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={formData.bmc_enabled}
                onClick={() => handleChange('bmc_enabled', !formData.bmc_enabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  formData.bmc_enabled ? 'bg-amber-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    formData.bmc_enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Placement 1: Header */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors">
              <div>
                <span className="font-semibold text-slate-900">Header Navigation Bar</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Displays a compact button in the primary desktop header and inside the mobile
                  drawer.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={formData.bmc_header_enabled}
                disabled={!formData.bmc_enabled}
                onClick={() => handleChange('bmc_header_enabled', !formData.bmc_header_enabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-40 ${
                  formData.bmc_header_enabled && formData.bmc_enabled
                    ? 'bg-sky-600'
                    : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    formData.bmc_header_enabled && formData.bmc_enabled
                      ? 'translate-x-5'
                      : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Placement 2: Footer */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors">
              <div>
                <span className="font-semibold text-slate-900">Footer Brand Section</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Displays the rich supporter badge and custom support text in the site-wide footer.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={formData.bmc_footer_enabled}
                disabled={!formData.bmc_enabled}
                onClick={() => handleChange('bmc_footer_enabled', !formData.bmc_footer_enabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-40 ${
                  formData.bmc_footer_enabled && formData.bmc_enabled
                    ? 'bg-amber-600'
                    : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    formData.bmc_footer_enabled && formData.bmc_enabled
                      ? 'translate-x-5'
                      : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Placement 3: Floating Widget */}
            <div className="rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-900">Floating Site-Wide Widget</span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pins a floating button to the screen corner on all public pages.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.bmc_floating_enabled}
                  disabled={!formData.bmc_enabled}
                  onClick={() => handleChange('bmc_floating_enabled', !formData.bmc_floating_enabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-40 ${
                    formData.bmc_floating_enabled && formData.bmc_enabled
                      ? 'bg-emerald-600'
                      : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      formData.bmc_floating_enabled && formData.bmc_enabled
                        ? 'translate-x-5'
                        : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {formData.bmc_floating_enabled && formData.bmc_enabled && (
                <div className="pt-3 border-t border-slate-100 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Floating Screen Corner</label>
                    <div className="mt-1.5 flex gap-2">
                      {(['Right', 'Left'] as const).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => handleChange('bmc_floating_position', pos)}
                          className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                            formData.bmc_floating_position === pos
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          Bottom {pos}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <label htmlFor="bmc_y_offset_slider">Vertical Bottom Offset</label>
                      <span className="font-mono text-emerald-700">{formData.bmc_floating_y_offset}px</span>
                    </div>
                    <input
                      id="bmc_y_offset_slider"
                      type="range"
                      min={20}
                      max={180}
                      step={4}
                      value={formData.bmc_floating_y_offset ?? 84}
                      onChange={(e) => handleChange('bmc_floating_y_offset', Number(e.target.value))}
                      className="mt-2 w-full accent-emerald-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>20px (Flush)</span>
                      <span>84px (Default above chat)</span>
                      <span>180px (High)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Identity, URL, and Copy */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <Sliders className="h-5 w-5 text-slate-700" />
            <h3 className="font-semibold text-slate-900">Profile URL &amp; Copy Text</h3>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="bmc_handle_input" className="block text-xs font-semibold text-slate-700">
                Buy Me a Coffee Handle / Slug
              </label>
              <div className="mt-1.5 flex rounded-lg border border-slate-200 shadow-2xs focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                <span className="inline-flex items-center rounded-l-lg border-r border-slate-200 bg-slate-50 px-3 text-xs text-slate-500 font-mono">
                  @
                </span>
                <input
                  id="bmc_handle_input"
                  type="text"
                  value={formData.bmc_handle || ''}
                  onChange={(e) => {
                    const handle = e.target.value.replace(/^@/, '');
                    handleChange('bmc_handle', handle);
                    handleChange('bmc_custom_url', `https://buymeacoffee.com/${handle}`);
                  }}
                  placeholder="ronelmol"
                  className="block w-full rounded-r-lg px-3 py-2 text-xs text-slate-900 focus:outline-hidden"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Default: <code>ronelmol</code>
              </p>
            </div>

            <div>
              <label htmlFor="bmc_url_input" className="block text-xs font-semibold text-slate-700">
                Custom Destination URL (Overrides handle)
              </label>
              <div className="mt-1.5">
                <input
                  id="bmc_url_input"
                  type="url"
                  value={formData.bmc_custom_url || ''}
                  onChange={(e) => handleChange('bmc_custom_url', e.target.value)}
                  placeholder="https://buymeacoffee.com/ronelmol"
                  className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Full valid URL starting with <code>https://buymeacoffee.com/...</code>
              </p>
            </div>

            <div>
              <label htmlFor="bmc_btn_text_input" className="block text-xs font-semibold text-slate-700">
                Button Label Text
              </label>
              <input
                id="bmc_btn_text_input"
                type="text"
                value={formData.bmc_button_text || ''}
                onChange={(e) => handleChange('bmc_button_text', e.target.value)}
                placeholder="Buy me a coffee"
                className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Appears on Header, Footer, and Floating button
              </p>
            </div>

            <div>
              <label htmlFor="bmc_font_style_select" className="block text-xs font-semibold text-slate-700">
                Typography Font Style
              </label>
              <select
                id="bmc_font_style_select"
                value={formData.bmc_font_style || 'Cookie'}
                onChange={(e) =>
                  handleChange(
                    'bmc_font_style',
                    e.target.value as 'Cookie' | 'Inter' | 'Plus Jakarta Sans'
                  )
                }
                className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="Cookie">Cookie (Official BMC Script Font)</option>
                <option value="Plus Jakarta Sans">Plus Jakarta Sans (Modern Bold)</option>
                <option value="Inter">Inter (System UI Sans)</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Controls the font used for the button label
              </p>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="bmc_support_message_input" className="block text-xs font-semibold text-slate-700">
                Footer Support Callout Paragraph
              </label>
              <textarea
                id="bmc_support_message_input"
                rows={2}
                value={formData.bmc_support_message || ''}
                onChange={(e) => handleChange('bmc_support_message', e.target.value)}
                placeholder="Support independent open-source tools, technical research, and live sandbox maintenance."
                className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Visual Look & Color Theme */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <Palette className="h-5 w-5 text-slate-700" />
            <h3 className="font-semibold text-slate-900">Brand Color &amp; Appearance</h3>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Preset Color Palettes
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-6">
                {COLOR_PRESETS.map((preset) => {
                  const isSelected =
                    (formData.bmc_button_color || DEFAULT_BMC_COLOR).toLowerCase() ===
                    preset.hex.toLowerCase();
                  return (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => handleChange('bmc_button_color', preset.hex)}
                      className={`flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className="h-5 w-5 shrink-0 rounded-md shadow-2xs border border-black/10"
                        style={{ backgroundColor: preset.hex }}
                      />
                      <span className="truncate text-[11px] font-medium text-slate-800">
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <label htmlFor="bmc_color_picker" className="text-xs font-semibold text-slate-700">
                Custom Hex Color:
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="bmc_color_picker"
                  type="color"
                  value={formData.bmc_button_color || DEFAULT_BMC_COLOR}
                  onChange={(e) => handleChange('bmc_button_color', e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded-md border border-slate-200 bg-transparent p-0"
                />
                <input
                  type="text"
                  value={formData.bmc_button_color || DEFAULT_BMC_COLOR}
                  onChange={(e) => handleChange('bmc_button_color', e.target.value)}
                  className="w-24 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-mono text-slate-900 uppercase"
                />
              </div>
              <span className="text-xs text-slate-500">
                Contrast is calculated automatically (
                {getContrastTextColor(formData.bmc_button_color || DEFAULT_BMC_COLOR) === '#ffffff'
                  ? 'White text'
                  : 'Dark text'}
                )
              </span>
            </div>
          </div>
        </div>

        {/* Live Interactive Visual Preview Stage */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold text-slate-900">Real-Time Interactive Visual Preview</h3>
            </div>
            <span className="text-xs text-slate-500">Updates live as you edit controls</span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Header Preview */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 border-b border-slate-100 pb-2">
                <span>1. Header Preview ({formData.bmc_header_enabled ? 'Active' : 'Disabled'})</span>
                <span className="text-[11px] text-slate-400">Desktop Navbar</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-100/80 px-4 py-3 border border-slate-200/60">
                <span className="font-bold text-slate-900 text-sm">GitStack</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 hidden sm:inline">Services</span>
                  <span className="text-xs text-slate-500 hidden sm:inline">Demo</span>
                  <BuyMeACoffeeButton
                    settings={previewSettings}
                    variant="compact"
                    onCustomClick={() => handleSimulateClick('header')}
                  />
                </div>
              </div>
              {!formData.bmc_header_enabled && (
                <p className="text-[11px] text-amber-700 bg-amber-50 rounded-md p-2">
                  Header placement is currently switched OFF.
                </p>
              )}
            </div>

            {/* Floating Widget Preview */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 border-b border-slate-100 pb-2">
                <span>
                  2. Floating Launcher ({formData.bmc_floating_enabled ? 'Active' : 'Disabled'})
                </span>
                <span className="text-[11px] text-slate-400">
                  Corner: {formData.bmc_floating_position || 'Right'}
                </span>
              </div>
              <div className="relative h-24 rounded-lg bg-slate-100/80 border border-dashed border-slate-300 p-3 flex items-end justify-end overflow-hidden">
                <div
                  className={`flex items-center gap-2 rounded-full px-3.5 py-2 shadow-lg border border-black/10 cursor-pointer ${
                    formData.bmc_floating_position === 'Left' ? 'mr-auto' : 'ml-auto'
                  }`}
                  style={{
                    backgroundColor: formData.bmc_button_color || DEFAULT_BMC_COLOR,
                    color: getContrastTextColor(formData.bmc_button_color || DEFAULT_BMC_COLOR)
                  }}
                  onClick={() => handleSimulateClick('floating')}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-slate-900">
                    <Coffee className="h-3 w-3 text-amber-900" />
                  </span>
                  <span className={`${getFontClass(formData.bmc_font_style)} leading-none`}>
                    {formData.bmc_button_text || DEFAULT_BMC_TEXT}
                  </span>
                </div>
              </div>
              {!formData.bmc_floating_enabled && (
                <p className="text-[11px] text-amber-700 bg-amber-50 rounded-md p-2">
                  Floating widget is currently switched OFF.
                </p>
              )}
            </div>

            {/* Footer Card Preview */}
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 border-b border-slate-100 pb-2">
                <span>3. Footer Card Preview ({formData.bmc_footer_enabled ? 'Active' : 'Disabled'})</span>
                <span className="text-[11px] text-slate-400">Site-wide Footer Callout</span>
              </div>
              <div className="rounded-lg bg-slate-50 p-4 border border-slate-200/60 max-w-sm">
                <BuyMeACoffeeButton
                  settings={previewSettings}
                  variant="full"
                  onCustomClick={() => handleSimulateClick('footer')}
                />
              </div>
              {!formData.bmc_footer_enabled && (
                <p className="text-[11px] text-amber-700 bg-amber-50 rounded-md p-2">
                  Footer placement is currently switched OFF.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Supporter Clicks Log Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Recent Supporter Clicks History</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit trail of incoming referral events across all placements
              </p>
            </div>
            <span className="text-xs font-medium text-slate-500">
              {analytics?.history.length || 0} events tracked
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Event ID</th>
                  <th className="py-2.5 px-3">Placement</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics?.history && analytics.history.length > 0 ? (
                  analytics.history.slice(0, 8).map((evt) => (
                    <tr key={evt.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-mono text-slate-600">{evt.id}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            evt.placement === 'header'
                              ? 'bg-sky-100 text-sky-800'
                              : evt.placement === 'footer'
                                ? 'bg-amber-100 text-amber-800'
                                : evt.placement === 'floating'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {evt.placement}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {new Date(evt.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <CheckCircle2 className="h-3 w-3" />
                          Redirected
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      No clicks logged yet. Click any button or use "+ Test click" to test tracking.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Save Bar */}
        <div className="sticky bottom-4 z-20 flex items-center justify-between rounded-xl border border-slate-200 bg-white/95 backdrop-blur-md px-6 py-4 shadow-lg">
          <div className="flex items-center gap-2">
            {saveError ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {saveError}
              </span>
            ) : saveSuccess ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Settings saved &amp; synced across live application!
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                Changes apply immediately to Header, Footer, and Floating widgets.
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--gs-primary)] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[var(--gs-primary-hover)] transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
