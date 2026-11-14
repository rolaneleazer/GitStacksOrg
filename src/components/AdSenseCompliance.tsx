import { ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AdSenseSettings } from '../shared/types.ts';

export type ConsentPreference = 'all' | 'essential' | null;

const CONSENT_STORAGE_KEY = 'gitstack_cookie_consent_v1';

export function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentPreference>(() => {
    try {
      const saved = window.localStorage.getItem(CONSENT_STORAGE_KEY);
      if (saved === 'all' || saved === 'essential') return saved;
      return null;
    } catch {
      return null;
    }
  });
  const [modalOpen, setModalOpen] = useState(false);

  const saveConsent = (value: 'all' | 'essential') => {
    setConsent(value);
    setModalOpen(false);
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
    } catch {
      // ignore
    }
  };

  return {
    consent,
    modalOpen,
    openPreferences: () => setModalOpen(true),
    closePreferences: () => setModalOpen(false),
    acceptAll: () => saveConsent('all'),
    acceptEssentialOnly: () => saveConsent('essential')
  };
}

export function AdSenseScriptLoader({
  settings,
  consent
}: {
  settings: AdSenseSettings | null;
  consent: ConsentPreference;
}) {
  useEffect(() => {
    if (!settings) return;
    const pub = settings.adsense_publisher_id.trim();
    if (!pub || !/^(ca-)?pub-\d{10,20}$/.test(pub)) return;
    if (!settings.auto_ads_enabled && !settings.ad_slots_enabled) return;
    if (consent !== 'all') return;

    const caPub = pub.startsWith('ca-') ? pub : `ca-${pub}`;
    const existing = document.getElementById('gitstack-adsense-script');
    if (existing) return;

    const script = document.createElement('script');
    script.id = 'gitstack-adsense-script';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(caPub)}`;
    document.head.appendChild(script);
  }, [settings, consent]);

  return null;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function GoogleAnalyticsLoader({
  settings,
  consent,
  route
}: {
  settings: AdSenseSettings | null;
  consent: ConsentPreference;
  route: string;
}) {
  useEffect(() => {
    if (!settings || route.startsWith('/obama') || route.startsWith('/studio')) return;
    const gaId = (settings.ga4_measurement_id || '').trim().toUpperCase();
    if (!settings.ga4_enabled || !/^G-[A-Z0-9]{4,16}$/.test(gaId)) return;
    if (consent !== 'all') return;

    if (!document.getElementById('gitstack-ga4-script')) {
      const script = document.createElement('script');
      script.id = 'gitstack-ga4-script';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag(...args: unknown[]) {
        window.dataLayer?.push(args);
      };
      window.gtag('js', new Date());
    }

    if (window.gtag) {
      window.gtag('config', gaId, { page_path: route });
    }
  }, [settings, consent, route]);

  return null;
}

export function PolicySafeAdSlot({
  settings,
  consent,
  slotLabel = 'In-Article Engineering Sponsor Placement',
  onOpenCookiePrefs
}: {
  settings: AdSenseSettings | null;
  consent: ConsentPreference;
  slotLabel?: string;
  onOpenCookiePrefs: () => void;
}) {
  if (!settings || !settings.ad_slots_enabled) {
    return null;
  }

  const pub = settings.adsense_publisher_id.trim();
  const hasPubId = /^(ca-)?pub-\d{10,20}$/.test(pub);

  if (!hasPubId) {
    return null;
  }

  if (consent !== 'all') {
    return (
      <aside
        aria-label="Advertisement Consent Notice"
        className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-4 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3"
      >
        <span>
          Advertising slots are suppressed under Essential-Only privacy preferences.
        </span>
        <button
          type="button"
          onClick={onOpenCookiePrefs}
          className="font-medium text-[#1E40AF] hover:underline whitespace-nowrap shrink-0"
        >
          Manage Cookie Preferences
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Advertisement"
      className="rounded-lg border border-slate-200 bg-white p-4 min-h-[120px] flex flex-col justify-between"
    >
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>Advertisement</span>
        <span className="font-mono">{pub.startsWith('ca-') ? pub : `ca-${pub}`}</span>
      </div>
      <div className="my-3 flex items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50 py-5 px-4 text-center">
        <p className="text-xs text-slate-500">
          {slotLabel} · Reserved fixed-height container preventing Cumulative Layout Shift (CLS)
        </p>
      </div>
    </aside>
  );
}

export function CookieConsentBanner({
  consent,
  modalOpen,
  onAcceptAll,
  onAcceptEssential,
  onCloseModal,
  onNavigate
}: {
  consent: ConsentPreference;
  modalOpen: boolean;
  onAcceptAll: () => void;
  onAcceptEssential: () => void;
  onCloseModal: () => void;
  onNavigate: (path: string) => void;
}) {
  if (consent && !modalOpen) return null;

  return (
    <div
      role="region"
      aria-label="Cookie and Privacy Consent"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white/95 backdrop-blur-sm px-5 py-3.5 shadow-lg"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1E40AF]" />
          <div className="text-xs leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-900">Privacy &amp; AdSense Transparency:</span>{' '}
            GitStack uses essential cookies for site security and, with your consent, advertising
            cookies to support free technical guides.{' '}
            <button
              type="button"
              onClick={() => onNavigate('/cookie-policy')}
              className="font-medium text-[#1E40AF] underline underline-offset-2 hover:text-blue-800"
            >
              Cookie Policy
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {modalOpen && (
            <button
              type="button"
              onClick={onCloseModal}
              aria-label="Close cookie preferences"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onAcceptEssential}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            Essential Only
          </button>
          <button
            type="button"
            onClick={onAcceptAll}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E40AF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] transition-colors whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Accept All</span>
          </button>
        </div>
      </div>
    </div>
  );
}
