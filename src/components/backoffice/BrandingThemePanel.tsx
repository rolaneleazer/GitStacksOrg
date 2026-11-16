import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  applyFaviconToDocument,
  applyThemeToDocument,
  buildDefaultMonogramFavicon,
  DEFAULT_BRANDING,
  normalizeHexColor,
  resolveThemeTokens,
  THEME_PRESETS
} from '../../shared/themePresets.ts';
import type { AdSenseSettings, HeaderSurface, ThemePresetId } from '../../shared/types.ts';

interface BrandingThemePanelProps {
  settings: AdSenseSettings;
  onSave: (patch: Partial<AdSenseSettings>) => Promise<void>;
  saving: boolean;
}

const MAX_LOGO_BYTES = 900 * 1024;
const MAX_RAW_FAVICON_BYTES = 250 * 1024;

function resizeFaviconToPng(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read favicon image file.'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        reject(new Error('Invalid image file.'));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported or corrupted favicon image.'));
      img.onload = () => {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.clearRect(0, 0, size, size);
        const scale = Math.min(size / img.width, size / img.height);
        const drawW = Math.round(img.width * scale);
        const drawH = Math.round(img.height * scale);
        const dx = Math.round((size - drawW) / 2);
        const dy = Math.round((size - drawH) / 2);
        ctx.drawImage(img, dx, dy, drawW, drawH);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function BrandingThemePanel({ settings, onSave, saving }: BrandingThemePanelProps) {
  const [brandName, setBrandName] = useState(settings.brand_name || DEFAULT_BRANDING.brand_name);
  const [brandLogoUrl, setBrandLogoUrl] = useState(settings.brand_logo_url || '');
  const [brandLogoAlt, setBrandLogoAlt] = useState(
    settings.brand_logo_alt || DEFAULT_BRANDING.brand_logo_alt
  );
  const [faviconUrl, setFaviconUrl] = useState(settings.favicon_url || '');
  const [themePreset, setThemePreset] = useState<ThemePresetId>(
    settings.theme_preset || DEFAULT_BRANDING.theme_preset
  );
  const [primaryColor, setPrimaryColor] = useState(
    settings.primary_color || DEFAULT_BRANDING.primary_color
  );
  const [headerSurface, setHeaderSurface] = useState<HeaderSurface>(
    settings.header_surface === 'tinted' ? 'tinted' : 'white'
  );
  const [headerCtaLabel, setHeaderCtaLabel] = useState(
    settings.header_cta_label || DEFAULT_BRANDING.header_cta_label
  );
  const [headerCtaHref, setHeaderCtaHref] = useState(
    settings.header_cta_href || DEFAULT_BRANDING.header_cta_href
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [faviconError, setFaviconError] = useState<string | null>(null);

  const previewSettings: Partial<AdSenseSettings> = {
    brand_name: brandName,
    brand_logo_url: brandLogoUrl,
    brand_logo_alt: brandLogoAlt,
    favicon_url: faviconUrl,
    theme_preset: themePreset,
    primary_color: primaryColor,
    header_surface: headerSurface,
    header_cta_label: headerCtaLabel,
    header_cta_href: headerCtaHref
  };

  const resolved = resolveThemeTokens(previewSettings);
  const activeFaviconPreview =
    faviconUrl.trim() ||
    buildDefaultMonogramFavicon(brandName || DEFAULT_BRANDING.brand_name, resolved.primaryColor);

  const previewLive = (next: Partial<AdSenseSettings>) => {
    applyThemeToDocument({ ...previewSettings, ...next });
  };

  const handleSelectPreset = (presetId: Exclude<ThemePresetId, 'custom'>) => {
    const def = THEME_PRESETS.find((p) => p.id === presetId);
    setThemePreset(presetId);
    if (def) {
      setPrimaryColor(def.primaryColor);
      previewLive({ theme_preset: presetId, primary_color: def.primaryColor });
    }
  };

  const handleCustomHexChange = (hex: string) => {
    setThemePreset('custom');
    setPrimaryColor(hex);
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex.trim())) {
      previewLive({ theme_preset: 'custom', primary_color: normalizeHexColor(hex) });
    }
  };

  const handleLogoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file (PNG, SVG, JPG, or WebP).');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setUploadError('Logo file must be under 900 KB for fast page loads.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBrandLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFaviconFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    setFaviconError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const isIco =
      file.type === 'image/x-icon' ||
      file.type === 'image/vnd.microsoft.icon' ||
      file.name.toLowerCase().endsWith('.ico');
    const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');

    if (!file.type.startsWith('image/') && !isIco) {
      setFaviconError('Please select a PNG, SVG, ICO, JPG, or WebP icon file.');
      return;
    }

    try {
      let nextUrl = '';
      if (isSvg || isIco) {
        if (file.size > MAX_RAW_FAVICON_BYTES) {
          setFaviconError('SVG/ICO favicon files must be under 250 KB.');
          return;
        }
        nextUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Failed to read favicon file.'));
          reader.onload = () =>
            resolve(typeof reader.result === 'string' ? reader.result : '');
          reader.readAsDataURL(file);
        });
      } else {
        if (file.size > 5 * 1024 * 1024) {
          setFaviconError('Source image must be under 5 MB.');
          return;
        }
        nextUrl = await resizeFaviconToPng(file);
      }
      setFaviconUrl(nextUrl);
      applyFaviconToDocument(nextUrl, brandName, resolved.primaryColor);
    } catch (err) {
      setFaviconError(err instanceof Error ? err.message : 'Unable to process favicon file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleResetDefaults = () => {
    setBrandName(DEFAULT_BRANDING.brand_name);
    setBrandLogoUrl('');
    setBrandLogoAlt(DEFAULT_BRANDING.brand_logo_alt);
    setFaviconUrl('');
    setFaviconError(null);
    setThemePreset(DEFAULT_BRANDING.theme_preset);
    setPrimaryColor(DEFAULT_BRANDING.primary_color);
    setHeaderSurface(DEFAULT_BRANDING.header_surface);
    setHeaderCtaLabel(DEFAULT_BRANDING.header_cta_label);
    setHeaderCtaHref(DEFAULT_BRANDING.header_cta_href);
    applyThemeToDocument(DEFAULT_BRANDING);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const safeColor = normalizeHexColor(primaryColor, DEFAULT_BRANDING.primary_color);
    await onSave({
      brand_name: brandName.trim() || DEFAULT_BRANDING.brand_name,
      brand_logo_url: brandLogoUrl.trim(),
      brand_logo_alt: brandLogoAlt.trim() || DEFAULT_BRANDING.brand_logo_alt,
      favicon_url: faviconUrl.trim(),
      theme_preset: themePreset,
      primary_color: safeColor,
      header_surface: headerSurface,
      header_cta_label: headerCtaLabel.trim() || DEFAULT_BRANDING.header_cta_label,
      header_cta_href: headerCtaHref.trim() || DEFAULT_BRANDING.header_cta_href
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Header, Logo & Theme Customizer</h2>
            <p className="mt-1 text-sm text-slate-600">
              Update the sitewide navigation bar, brand logo, and accent color tokens across all public pages and Back Office controls.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="min-h-[44px] sm:min-h-[38px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            Reset Defaults
          </button>
        </div>

        {/* Live 3-Zone Header Preview */}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Live Public Top Bar Preview (3-Zone Layout)</span>
            <span className="tabular-nums">
              Button Contrast: {resolved.contrastRatio}:1 ({resolved.passesAA ? 'WCAG AA Pass' : 'Low Contrast Warning'})
            </span>
          </div>
          <div
            className="rounded-xl border border-slate-200 px-4 sm:px-6 py-3.5 transition-colors"
            style={{ backgroundColor: resolved.headerBg }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                {brandLogoUrl ? (
                  <img
                    src={brandLogoUrl}
                    alt={brandLogoAlt || brandName}
                    referrerPolicy="no-referrer"
                    className="h-8 w-auto max-w-[140px] object-contain shrink-0"
                  />
                ) : (
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white shrink-0"
                    style={{ backgroundColor: resolved.primaryColor }}
                  >
                    {(brandName || 'G').slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="text-base font-bold tracking-tight text-slate-900 truncate">
                  {brandName || 'GitStack'}
                </span>
              </div>

              <div className="hidden md:flex items-center gap-5 text-xs font-medium text-slate-600">
                <span style={{ color: resolved.primaryColor }} className="font-semibold">
                  Home
                </span>
                <span>Services</span>
                <span>Insights</span>
                <span>About</span>
                <span>Contact</span>
              </div>

              <span
                className="inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0"
                style={{ backgroundColor: resolved.primaryColor }}
              >
                {headerCtaLabel || 'Book Consultation'}
              </span>
            </div>
          </div>

          {/* Live Browser Tab Preview */}
          <div className="mt-4">
            <div className="mb-1.5 text-xs font-semibold text-slate-500">
              Live Browser Tab &amp; Bookmark Favicon Preview
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 pt-2.5">
              <div className="inline-flex max-w-[280px] items-center gap-2 rounded-t-lg border border-b-0 border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800">
                <img
                  src={activeFaviconPreview}
                  alt="Browser tab favicon preview"
                  className="h-4 w-4 shrink-0 rounded-[3px] object-contain"
                />
                <span className="truncate">
                  {brandName || 'GitStack'} — Enterprise AI &amp; Cloud Systems
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Header & Logo Configuration */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
        <h3 className="text-base font-bold text-slate-900">1. Brand Logo & Header Controls</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Brand Wordmark</label>
            <input
              type="text"
              maxLength={40}
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="GitStack"
              className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Header Surface Tone</label>
            <div className="grid grid-cols-2 gap-2">
              {(['white', 'tinted'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setHeaderSurface(mode);
                    previewLive({ header_surface: mode });
                  }}
                  className={`min-h-[44px] rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    headerSurface === mode
                      ? 'border-[var(--gs-primary)] bg-[var(--gs-soft-bg)] text-[var(--gs-primary)]'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {mode === 'white' ? 'Pure White' : 'Soft Theme Tint'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Header CTA Button Label</label>
            <input
              type="text"
              maxLength={32}
              value={headerCtaLabel}
              onChange={(e) => setHeaderCtaLabel(e.target.value)}
              placeholder="Book Consultation"
              className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Header CTA Target Route</label>
            <input
              type="text"
              value={headerCtaHref}
              onChange={(e) => setHeaderCtaHref(e.target.value)}
              placeholder="/contact"
              className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
            />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-700">
            Custom Logo Upload (&lt; 900 KB) or Image URL
          </label>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0">
              Upload Logo File
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoFileChange}
                className="sr-only"
              />
            </label>
            <input
              type="text"
              value={brandLogoUrl}
              onChange={(e) => setBrandLogoUrl(e.target.value)}
              placeholder="Or paste https://... logo URL (leave blank for monogram mark)"
              className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
            />
            {brandLogoUrl && (
              <button
                type="button"
                onClick={() => setBrandLogoUrl('')}
                className="min-h-[44px] rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 whitespace-nowrap shrink-0"
              >
                Remove Logo
              </button>
            )}
          </div>
          {uploadError && <p className="text-xs font-medium text-rose-700">{uploadError}</p>}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Logo Alt Text</label>
            <input
              type="text"
              maxLength={80}
              value={brandLogoAlt}
              onChange={(e) => setBrandLogoAlt(e.target.value)}
              placeholder="GitStack logo"
              className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
            />
          </div>
        </div>

        {/* Dedicated Browser Tab Favicon Uploader */}
        <div className="border-t border-slate-200 pt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Browser Tab Favicon (PNG, SVG, ICO, or WebP — auto-sized to 128×128)
              </label>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Appears in browser tabs, bookmarks, and iOS home screen shortcuts across all pages. Leave blank to use an auto-generated monogram icon matching your theme accent.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
              <img
                src={activeFaviconPreview}
                alt="Active favicon icon"
                className="h-6 w-6 rounded object-contain"
              />
              <span className="font-mono text-[11px] text-slate-600">
                {faviconUrl ? 'Custom' : 'Auto Monogram'}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0">
              Upload Favicon
              <input
                type="file"
                accept="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,image/webp,image/jpeg,.ico"
                onChange={handleFaviconFileChange}
                className="sr-only"
              />
            </label>
            <input
              type="text"
              value={faviconUrl}
              onChange={(e) => {
                setFaviconUrl(e.target.value);
                applyFaviconToDocument(e.target.value, brandName, resolved.primaryColor);
              }}
              placeholder="Or paste https://... favicon URL (blank = auto monogram)"
              className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
            />
            {faviconUrl && (
              <button
                type="button"
                onClick={() => {
                  setFaviconUrl('');
                  setFaviconError(null);
                  applyFaviconToDocument('', brandName, resolved.primaryColor);
                }}
                className="min-h-[44px] rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 whitespace-nowrap shrink-0"
              >
                Reset Favicon
              </button>
            )}
          </div>
          {faviconError && <p className="text-xs font-medium text-rose-700">{faviconError}</p>}
        </div>
      </div>

      {/* Curated Presets + Custom Accent Picker */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
        <div>
          <h3 className="text-base font-bold text-slate-900">2. Sitewide Color Presets & Custom Accent</h3>
          <p className="mt-1 text-xs text-slate-600">
            Select a curated editorial preset or fine-tune a custom brand accent hex color. Contrast ratio is checked automatically to keep buttons and AdSense typography legible.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {THEME_PRESETS.map((preset) => {
            const active = themePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
                className={`text-left rounded-xl border p-4 transition-colors min-h-[84px] ${
                  active
                    ? 'border-[var(--gs-primary)] bg-[var(--gs-soft-bg)]'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900">{preset.name}</span>
                  <span
                    className="h-5 w-5 rounded-md border border-black/10 shrink-0"
                    style={{ backgroundColor: preset.primaryColor }}
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{preset.description}</p>
              </button>
            );
          })}
        </div>

        <div className="border-t border-slate-200 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-700" htmlFor="custom-accent-color">
                Custom Accent Color
              </label>
              <input
                id="custom-accent-color"
                type="color"
                value={normalizeHexColor(primaryColor)}
                onChange={(e) => handleCustomHexChange(e.target.value)}
                className="h-11 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
              />
            </div>
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => handleCustomHexChange(e.target.value)}
              placeholder="#1E40AF"
              className="w-full sm:w-40 min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 font-mono text-sm text-slate-900"
            />
            <div
              className={`text-xs font-medium px-3 py-2 rounded-lg border ${
                resolved.passesAA
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              {resolved.passesAA
                ? `Contrast ${resolved.contrastRatio}:1 — Meets WCAG AA (4.5:1+)`
                : `Contrast ${resolved.contrastRatio}:1 — Choose a darker shade for crisp white button text`}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto min-h-[44px] rounded-lg bg-[var(--gs-primary)] hover:bg-[var(--gs-primary-hover)] px-6 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
        >
          {saving ? 'Saving Brand & Theme...' : 'Save Branding & Theme Sitewide'}
        </button>
      </div>
    </form>
  );
}
