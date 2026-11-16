import { Coffee, ExternalLink } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.ts';
import type { AdSenseSettings } from '../shared/types.ts';

export const DEFAULT_BMC_HANDLE = 'ronelmol';
export const DEFAULT_BMC_URL = `https://buymeacoffee.com/${DEFAULT_BMC_HANDLE}`;
export const DEFAULT_BMC_COLOR = '#FFDD00';
export const DEFAULT_BMC_TEXT = 'Buy me a coffee';

export function getBmcTargetUrl(settings?: AdSenseSettings | null): string {
  if (settings?.bmc_custom_url?.trim()) {
    return settings.bmc_custom_url.trim();
  }
  const rawHandle = settings?.bmc_handle?.trim() || DEFAULT_BMC_HANDLE;
  const cleanHandle = rawHandle.replace(/^@/, '');
  return `https://buymeacoffee.com/${cleanHandle}`;
}

export function getContrastTextColor(hexColor: string = DEFAULT_BMC_COLOR): string {
  const hex = hexColor.replace('#', '').trim();
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 145 ? '#0f172a' : '#ffffff';
  }
  return '#0f172a';
}

export function getFontClass(fontStyle?: string): string {
  if (fontStyle === 'Cookie') {
    return "font-['Cookie',cursive] text-[17px] tracking-wide font-normal";
  }
  if (fontStyle === 'Plus Jakarta Sans') {
    return "font-['Plus_Jakarta_Sans',sans-serif] font-bold text-xs";
  }
  return 'font-sans font-bold text-xs';
}

export interface BuyMeACoffeeWidgetProps {
  settings?: AdSenseSettings | null;
  yOffset?: number;
  position?: 'Right' | 'Left';
}

/**
 * BuyMeACoffeeWidget
 * Configurable floating widget that renders site-wide according to settings:
 * - bmc_enabled (master toggle)
 * - bmc_floating_enabled (placement toggle)
 * - bmc_floating_position (Right or Left)
 * - bmc_floating_y_offset (custom bottom margin in px)
 * - bmc_button_color, bmc_button_text, bmc_font_style, and custom URL
 * - Records click telemetry via /api/bmc/track-click
 */
export function BuyMeACoffeeWidget({
  settings,
  yOffset: propYOffset,
  position: propPosition
}: BuyMeACoffeeWidgetProps) {
  // Master on/off check
  if (settings && settings.bmc_enabled === false) {
    return null;
  }
  // Floating placement on/off check
  if (settings && settings.bmc_floating_enabled === false) {
    return null;
  }

  const effectivePosition = settings?.bmc_floating_position || propPosition || 'Right';
  const effectiveYOffset = settings?.bmc_floating_y_offset ?? propYOffset ?? 84;
  const buttonColor = settings?.bmc_button_color || DEFAULT_BMC_COLOR;
  const textColor = getContrastTextColor(buttonColor);
  const buttonText = settings?.bmc_button_text || DEFAULT_BMC_TEXT;
  const fontClass = getFontClass(settings?.bmc_font_style);
  const targetUrl = getBmcTargetUrl(settings);

  const handleClick = () => {
    api.trackBmcClick('floating').catch(() => {
      // ignore telemetry network errors silently
    });
  };

  return (
    <aside
      aria-label="Support via Buy Me a Coffee"
      className="fixed z-40 transition-all duration-300"
      style={{
        bottom: `${effectiveYOffset}px`,
        right: effectivePosition === 'Right' ? '18px' : 'auto',
        left: effectivePosition === 'Left' ? '18px' : 'auto'
      }}
    >
      <a
        href={targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="group flex items-center gap-2 rounded-full px-4 py-2.5 shadow-lg hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border border-black/10 focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          backgroundColor: buttonColor,
          color: textColor
        }}
        title={`Support on Buy me a coffee: ${buttonText}`}
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-slate-900 group-hover:rotate-12 transition-transform shadow-xs"
        >
          <Coffee className="h-3.5 w-3.5 text-amber-900" />
        </span>
        <span className={`${fontClass} leading-none tracking-tight`}>{buttonText}</span>
      </a>
    </aside>
  );
}

export interface BuyMeACoffeeButtonProps {
  settings?: AdSenseSettings | null;
  variant?: 'compact' | 'full' | 'icon-only';
  className?: string;
  onCustomClick?: () => void;
}

/**
 * BuyMeACoffeeButton
 * Reusable official brand button for Header and Footer with full customization
 * of appearance, text, color, typography, and click tracking.
 */
export function BuyMeACoffeeButton({
  settings,
  variant = 'compact',
  className = '',
  onCustomClick
}: BuyMeACoffeeButtonProps) {
  // Master on/off check
  if (settings && settings.bmc_enabled === false) {
    return null;
  }

  // Header placement toggle
  if (variant === 'compact' && settings && settings.bmc_header_enabled === false) {
    return null;
  }

  // Footer placement toggle
  if (variant === 'full' && settings && settings.bmc_footer_enabled === false) {
    return null;
  }

  const buttonColor = settings?.bmc_button_color || DEFAULT_BMC_COLOR;
  const textColor = getContrastTextColor(buttonColor);
  const buttonText = settings?.bmc_button_text || DEFAULT_BMC_TEXT;
  const fontClass = getFontClass(settings?.bmc_font_style);
  const targetUrl = getBmcTargetUrl(settings);
  const handle = settings?.bmc_handle?.replace(/^@/, '') || DEFAULT_BMC_HANDLE;
  const supportMessage =
    settings?.bmc_support_message?.trim() ||
    'Support independent open-source tools, technical research, and live sandbox maintenance.';

  const handleClick = (e: React.MouseEvent) => {
    const placement = variant === 'compact' ? 'header' : variant === 'full' ? 'footer' : 'other';
    api.trackBmcClick(placement).catch(() => {});
    if (onCustomClick) {
      onCustomClick();
    }
  };

  if (variant === 'compact') {
    return (
      <a
        href={targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 shadow-2xs hover:brightness-105 hover:shadow-xs transition-all whitespace-nowrap border border-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 shrink-0 ${className}`}
        style={{
          backgroundColor: buttonColor,
          color: textColor
        }}
        title={`Buy me a coffee @${handle}`}
      >
        <Coffee className="h-3.5 w-3.5 shrink-0 opacity-90" />
        <span className={fontClass}>{buttonText}</span>
      </a>
    );
  }

  if (variant === 'icon-only') {
    return (
      <a
        href={targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg shadow-2xs hover:brightness-105 transition-all border border-black/10 focus-visible:outline-2 ${className}`}
        style={{
          backgroundColor: buttonColor,
          color: textColor
        }}
        title={`Buy me a coffee @${handle}`}
        aria-label="Buy me a coffee"
      >
        <Coffee className="h-4 w-4" />
      </a>
    );
  }

  // 'full' variant for Footer and support callouts
  return (
    <div className={`space-y-2.5 ${className}`}>
      <a
        href={targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="group inline-flex items-center gap-2.5 rounded-xl px-4 py-2.5 shadow-sm hover:brightness-105 hover:shadow-md transition-all border border-black/10 focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          backgroundColor: buttonColor,
          color: textColor
        }}
        title={`Support ${handle} on Buy me a coffee`}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/10 text-current group-hover:scale-110 transition-transform">
          <Coffee className="h-4 w-4" />
        </div>
        <div className="flex flex-col text-left leading-tight">
          <span className={`${fontClass} tracking-tight`}>{buttonText}</span>
          <span className="text-[10px] font-medium opacity-80">Support @{handle}</span>
        </div>
        <ExternalLink className="ml-1.5 h-3.5 w-3.5 opacity-75" />
      </a>
      <p className="text-[11px] text-slate-500 leading-snug max-w-xs">{supportMessage}</p>
    </div>
  );
}
