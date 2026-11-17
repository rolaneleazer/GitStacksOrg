import type { AdSenseSettings, HeaderSurface, ThemePresetId } from './types.ts';

export interface ThemePresetDefinition {
  id: Exclude<ThemePresetId, 'custom'>;
  name: string;
  description: string;
  primaryColor: string;
  hoverColor: string;
  softBg: string;
  softBorder: string;
  canvasBg: string;
  headerTintedBg: string;
}

export const THEME_PRESETS: ThemePresetDefinition[] = [
  {
    id: 'cobalt',
    name: 'Cobalt Editorial',
    description: 'High-contrast enterprise cobalt on cool crisp paper.',
    primaryColor: '#1E40AF',
    hoverColor: '#1D4ED8',
    softBg: '#EFF6FF',
    softBorder: '#BFDBFE',
    canvasBg: '#FAFAFC',
    headerTintedBg: '#F4F7FF'
  },
  {
    id: 'emerald',
    name: 'Emerald Systems',
    description: 'Deep forest emerald suited for infrastructure and FinOps.',
    primaryColor: '#047857',
    hoverColor: '#065F46',
    softBg: '#ECFDF5',
    softBorder: '#A7F3D0',
    canvasBg: '#F9FBFA',
    headerTintedBg: '#F0FDF7'
  },
  {
    id: 'indigo',
    name: 'Indigo Enterprise',
    description: 'Rich indigo accent for AI architecture and R&D publications.',
    primaryColor: '#4338CA',
    hoverColor: '#3730A3',
    softBg: '#EEF2FF',
    softBorder: '#C7D2FE',
    canvasBg: '#FAFAFC',
    headerTintedBg: '#F5F6FF'
  },
  {
    id: 'slate',
    name: 'Slate Monochrome',
    description: 'Architectural charcoal ink for minimal editorial focus.',
    primaryColor: '#0F172A',
    hoverColor: '#1E293B',
    softBg: '#F1F5F9',
    softBorder: '#CBD5E1',
    canvasBg: '#FAFAFB',
    headerTintedBg: '#F8FAFC'
  },
  {
    id: 'amber',
    name: 'Amber Technical',
    description: 'Dark bronze-amber calibrated for WCAG AA legibility on white.',
    primaryColor: '#B45309',
    hoverColor: '#92400E',
    softBg: '#FFFBEB',
    softBorder: '#FDE68A',
    canvasBg: '#FCFBFA',
    headerTintedBg: '#FEF9EE'
  }
];

export const DEFAULT_BRANDING = {
  brand_name: 'GitStack',
  brand_logo_url: '',
  brand_logo_alt: 'GitStack logo',
  favicon_url: '',
  theme_preset: 'cobalt' as ThemePresetId,
  primary_color: '#1E40AF',
  header_surface: 'white' as HeaderSurface,
  header_cta_label: 'Book Consultation',
  header_cta_href: '/contact'
};

export function normalizeHexColor(value: string | undefined, fallback = '#1E40AF'): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  const shortMatch = trimmed.match(/^#([0-9a-f]{3})$/i);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const fullMatch = trimmed.match(/^#([0-9a-f]{6})$/i);
  if (fullMatch) {
    return `#${fullMatch[1].toUpperCase()}`;
  }
  return fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = normalizeHexColor(hex).slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function mixWithWhite(hex: string, weightWhite: number): string {
  const { r, g, b } = hexToRgb(hex);
  const w = Math.max(0, Math.min(1, weightWhite));
  return rgbToHex(
    r * (1 - w) + 255 * w,
    g * (1 - w) + 255 * w,
    b * (1 - w) + 255 * w
  );
}

export function darkenHexColor(hex: string, factor = 0.16): string {
  const { r, g, b } = hexToRgb(hex);
  const scale = Math.max(0, 1 - factor);
  return rgbToHex(r * scale, g * scale, b * scale);
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function getContrastRatioAgainstWhite(hex: string): number {
  const lum = relativeLuminance(normalizeHexColor(hex));
  return Number(((1.0 + 0.05) / (lum + 0.05)).toFixed(2));
}

export interface ResolvedThemeTokens {
  primaryColor: string;
  hoverColor: string;
  softBg: string;
  softBorder: string;
  canvasBg: string;
  headerBg: string;
  contrastRatio: number;
  passesAA: boolean;
}

export function resolveThemeTokens(
  settings?: Partial<AdSenseSettings> | null
): ResolvedThemeTokens {
  const presetId = settings?.theme_preset || 'cobalt';
  const preset = THEME_PRESETS.find((p) => p.id === presetId);
  const headerSurface: HeaderSurface = settings?.header_surface === 'tinted' ? 'tinted' : 'white';

  const primaryColor =
    presetId !== 'custom' && preset
      ? preset.primaryColor
      : normalizeHexColor(settings?.primary_color, DEFAULT_BRANDING.primary_color);

  const hoverColor =
    presetId !== 'custom' && preset
      ? preset.hoverColor
      : darkenHexColor(primaryColor, 0.16);

  const softBg =
    presetId !== 'custom' && preset ? preset.softBg : mixWithWhite(primaryColor, 0.92);

  const softBorder =
    presetId !== 'custom' && preset ? preset.softBorder : mixWithWhite(primaryColor, 0.72);

  const canvasBg = presetId !== 'custom' && preset ? preset.canvasBg : '#FAFAFC';

  const headerBg =
    headerSurface === 'tinted'
      ? presetId !== 'custom' && preset
        ? preset.headerTintedBg
        : mixWithWhite(primaryColor, 0.95)
      : 'rgba(255, 255, 255, 0.95)';

  const contrastRatio = getContrastRatioAgainstWhite(primaryColor);

  return {
    primaryColor,
    hoverColor,
    softBg,
    softBorder,
    canvasBg,
    headerBg,
    contrastRatio,
    passesAA: contrastRatio >= 4.5
  };
}

export function buildDefaultMonogramFavicon(brandName = 'GitStack', color = '#1E40AF'): string {
  const initial = ((brandName || 'G').trim().slice(0, 1) || 'G').toUpperCase();
  const safeColor = normalizeHexColor(color, '#1E40AF');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${safeColor}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#FFFFFF" font-family="Plus Jakarta Sans,system-ui,sans-serif" font-size="34" font-weight="700">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function resolveFaviconMimeType(href: string): string {
  const lower = href.toLowerCase();
  if (lower.startsWith('data:image/png') || lower.endsWith('.png')) return 'image/png';
  if (lower.startsWith('data:image/svg+xml') || lower.endsWith('.svg')) return 'image/svg+xml';
  if (
    lower.startsWith('data:image/x-icon') ||
    lower.startsWith('data:image/vnd.microsoft.icon') ||
    lower.endsWith('.ico')
  ) {
    return 'image/x-icon';
  }
  if (lower.startsWith('data:image/webp') || lower.endsWith('.webp')) return 'image/webp';
  if (lower.startsWith('data:image/jpeg') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  return '';
}

export function applyFaviconToDocument(
  faviconUrl?: string,
  brandName?: string,
  primaryColor?: string
): void {
  if (typeof document === 'undefined') return;
  const href =
    (faviconUrl || '').trim() ||
    buildDefaultMonogramFavicon(brandName || DEFAULT_BRANDING.brand_name, primaryColor || DEFAULT_BRANDING.primary_color);
  const mimeType = resolveFaviconMimeType(href);

  let iconEl = document.querySelector<HTMLLinkElement>('link#site-favicon') || document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!iconEl) {
    iconEl = document.createElement('link');
    iconEl.id = 'site-favicon';
    iconEl.rel = 'icon';
    document.head.appendChild(iconEl);
  }
  if (mimeType) {
    iconEl.type = mimeType;
  } else {
    iconEl.removeAttribute('type');
  }
  iconEl.href = href;

  let appleEl = document.querySelector<HTMLLinkElement>('link#site-apple-icon');
  if (!appleEl) {
    appleEl = document.createElement('link');
    appleEl.id = 'site-apple-icon';
    appleEl.rel = 'apple-touch-icon';
    document.head.appendChild(appleEl);
  }
  appleEl.href = href;
}

export function applyThemeToDocument(settings?: Partial<AdSenseSettings> | null): void {
  if (typeof document === 'undefined') return;
  const tokens = resolveThemeTokens(settings);
  const root = document.documentElement;
  root.style.setProperty('--gs-primary', tokens.primaryColor);
  root.style.setProperty('--gs-primary-hover', tokens.hoverColor);
  root.style.setProperty('--gs-soft-bg', tokens.softBg);
  root.style.setProperty('--gs-soft-border', tokens.softBorder);
  root.style.setProperty('--gs-canvas-bg', tokens.canvasBg);
  root.style.setProperty('--gs-header-bg', tokens.headerBg);
  applyFaviconToDocument(settings?.favicon_url, settings?.brand_name, tokens.primaryColor);
}
