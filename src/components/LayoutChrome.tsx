import { Menu, X } from 'lucide-react';
import React, { useState } from 'react';
import { DEFAULT_BRANDING, resolveThemeTokens } from '../shared/themePresets.ts';
import type { AdSenseSettings } from '../shared/types.ts';
import { BuyMeACoffeeButton } from './BuyMeACoffee.tsx';

interface HeaderProps {
  currentPath: string;
  settings?: AdSenseSettings | null;
  onNavigate: (path: string) => void;
}

export function Header({ currentPath, settings, onNavigate }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const brandName = settings?.brand_name?.trim() || DEFAULT_BRANDING.brand_name;
  const brandLogoUrl = settings?.brand_logo_url?.trim() || '';
  const brandLogoAlt = settings?.brand_logo_alt?.trim() || brandName;
  const ctaLabel = settings?.header_cta_label?.trim() || DEFAULT_BRANDING.header_cta_label;
  const ctaHref = settings?.header_cta_href?.trim() || DEFAULT_BRANDING.header_cta_href;
  const themeTokens = resolveThemeTokens(settings);

  const navItems = [
    { label: 'Services', href: '/services' },
    { label: 'Live Demo', href: '/demo' },
    { label: 'Insights', href: '/insights' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' }
  ];

  const handleLinkClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    setMobileOpen(false);
    onNavigate(href);
  };

  const isExternalCta = /^https?:\/\//i.test(ctaHref);

  return (
    <header
      className="sticky top-0 z-40 border-b border-slate-200 backdrop-blur-sm transition-colors"
      style={{ backgroundColor: themeTokens.headerBg }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6">
        {/* Zone 1: Brand Logo & Wordmark */}
        <a
          href="/"
          onClick={(e) => handleLinkClick(e, '/')}
          className="inline-flex items-center gap-2.5 font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gs-primary)]"
        >
          {brandLogoUrl && (
            <img
              src={brandLogoUrl}
              alt={brandLogoAlt}
              referrerPolicy="no-referrer"
              className="h-8 w-auto max-w-[130px] object-contain shrink-0"
            />
          )}
          <span>{brandName}</span>
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          {navItems.map((item) => {
            const active =
              currentPath === item.href ||
              (item.href === '/insights' && currentPath.startsWith('/insights'));
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleLinkClick(e, item.href)}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-slate-900 ${
                  active
                    ? 'text-[var(--gs-primary)] underline decoration-[var(--gs-primary)] decoration-2 underline-offset-8'
                    : ''
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary CTA action + BMC Button + Mobile Menu Toggle */}
        <div className="flex items-center gap-2.5 shrink-0">
          <BuyMeACoffeeButton settings={settings} variant="compact" className="hidden lg:inline-flex" />
          {isExternalCta ? (
            <a
              href={ctaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center justify-center rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gs-primary)]"
            >
              {ctaLabel}
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate(ctaHref)}
              className="hidden sm:inline-flex items-center justify-center rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gs-primary)]"
            >
              {ctaLabel}
            </button>
          )}
          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex md:hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 sm:px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            {navItems.map((item) => {
              const active =
                currentPath === item.href ||
                (item.href === '/insights' && currentPath.startsWith('/insights'));
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleLinkClick(e, item.href)}
                  className={`min-h-[44px] flex items-center rounded-lg px-3 transition-colors hover:bg-slate-50 hover:text-[var(--gs-primary)] ${
                    active ? 'bg-[var(--gs-soft-bg)] text-[var(--gs-primary)] font-semibold' : ''
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
            <div className="mt-2 flex flex-col gap-2">
              <BuyMeACoffeeButton settings={settings} variant="compact" className="w-full justify-center min-h-[40px]" />
              {isExternalCta ? (
                <a
                  href={ctaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[var(--gs-primary)] hover:bg-[var(--gs-primary-hover)] px-4 py-2.5 text-center text-xs font-semibold text-white"
                >
                  {ctaLabel}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    onNavigate(ctaHref);
                  }}
                  className="min-h-[44px] w-full rounded-lg bg-[var(--gs-primary)] hover:bg-[var(--gs-primary-hover)] px-4 py-2.5 text-center text-xs font-semibold text-white"
                >
                  {ctaLabel}
                </button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export function Footer({
  settings,
  onNavigate,
  onOpenCookiePrefs
}: {
  settings?: AdSenseSettings | null;
  onNavigate: (path: string) => void;
  onOpenCookiePrefs: () => void;
}) {
  const brandName = settings?.brand_name?.trim() || DEFAULT_BRANDING.brand_name;
  const brandLogoUrl = settings?.brand_logo_url?.trim() || '';
  const brandLogoAlt = settings?.brand_logo_alt?.trim() || brandName;

  const go = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <a
              href="/"
              onClick={(e) => go(e, '/')}
              className="inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight text-slate-900"
            >
              {brandLogoUrl && (
                <img
                  src={brandLogoUrl}
                  alt={brandLogoAlt}
                  referrerPolicy="no-referrer"
                  className="h-7 w-auto max-w-[120px] object-contain"
                />
              )}
              <span>{brandName}</span>
            </a>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Enterprise software engineering, cloud infrastructure management, AI integration, and
              machine learning automation solutions.
            </p>
            <p className="mt-4 text-xs text-slate-500">
              contact@gitstack.io · San Francisco &amp; Global Remote
            </p>
            <div className="mt-5 pt-4 border-t border-slate-100">
              <BuyMeACoffeeButton settings={settings} variant="full" />
            </div>
          </div>

          <div>
            <h3 className="font-display text-xs font-semibold tracking-wide text-slate-900">
              Engineering Services
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a href="/#ai-ml" onClick={(e) => go(e, '/#ai-ml')} className="hover:text-[var(--gs-primary)]">
                  AI Integration &amp; RAG
                </a>
              </li>
              <li>
                <a href="/services" onClick={(e) => go(e, '/services')} className="hover:text-[var(--gs-primary)]">
                  ML Automation &amp; MLOps
                </a>
              </li>
              <li>
                <a href="/services" onClick={(e) => go(e, '/services')} className="hover:text-[var(--gs-primary)]">
                  Custom Software Engineering
                </a>
              </li>
              <li>
                <a href="/services" onClick={(e) => go(e, '/services')} className="hover:text-[var(--gs-primary)]">
                  Cloud Infrastructure Management
                </a>
              </li>
              <li>
                <a href="/services" onClick={(e) => go(e, '/services')} className="hover:text-[var(--gs-primary)]">
                  Technical Consulting
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-xs font-semibold tracking-wide text-slate-900">
              Company &amp; Discovery
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a href="/demo" onClick={(e) => go(e, '/demo')} className="hover:text-[var(--gs-primary)] font-medium text-slate-900">
                  Interactive Customer Demo
                </a>
              </li>
              <li>
                <a href="/insights" onClick={(e) => go(e, '/insights')} className="hover:text-[var(--gs-primary)]">
                  Technical Insights Journal
                </a>
              </li>
              <li>
                <a href="/about" onClick={(e) => go(e, '/about')} className="hover:text-[var(--gs-primary)]">
                  About {brandName}
                </a>
              </li>
              <li>
                <a href="/editorial-policy" onClick={(e) => go(e, '/editorial-policy')} className="hover:text-[var(--gs-primary)]">
                  Editorial &amp; AI Policy
                </a>
              </li>
              <li>
                <a href="/contact" onClick={(e) => go(e, '/contact')} className="hover:text-[var(--gs-primary)]">
                  Contact &amp; Consultation
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-xs font-semibold tracking-wide text-slate-900">
              Legal, Trust &amp; Crawlers
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a href="/privacy-policy" onClick={(e) => go(e, '/privacy-policy')} className="hover:text-[var(--gs-primary)]">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" onClick={(e) => go(e, '/terms')} className="hover:text-[var(--gs-primary)]">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="/cookie-policy" onClick={(e) => go(e, '/cookie-policy')} className="hover:text-[var(--gs-primary)]">
                  Cookie Policy
                </a>
              </li>
              <li>
                <a href="/disclaimer" onClick={(e) => go(e, '/disclaimer')} className="hover:text-[var(--gs-primary)]">
                  Technical Disclaimer
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenCookiePrefs}
                  className="text-left hover:text-[var(--gs-primary)] min-h-[36px]"
                >
                  Manage Cookie Consent
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 sm:mt-12 flex flex-col items-start justify-between gap-4 border-t border-slate-200 pt-8 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} {brandName} Technologies Inc. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <a href="/llms.txt" target="_blank" rel="noopener noreferrer" className="hover:text-slate-800">
              llms.txt
            </a>
            <span aria-hidden="true">·</span>
            <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="hover:text-slate-800">
              sitemap.xml
            </a>
            <span aria-hidden="true">·</span>
            <a href="/robots.txt" target="_blank" rel="noopener noreferrer" className="hover:text-slate-800">
              robots.txt
            </a>
            <span aria-hidden="true">·</span>
            <a href="/ads.txt" target="_blank" rel="noopener noreferrer" className="hover:text-slate-800">
              ads.txt
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
