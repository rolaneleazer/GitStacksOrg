import { Menu, X } from 'lucide-react';
import React, { useState } from 'react';

interface HeaderProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Header({ currentPath, onNavigate }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'Services', href: '/services' },
    { label: 'AI & ML', href: '/#ai-ml' },
    { label: 'Insights', href: '/insights' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' }
  ];

  const handleLinkClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    setMobileOpen(false);
    onNavigate(href);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-6">
        {/* Zone 1: Single text element Brand Wordmark */}
        <a
          href="/"
          onClick={(e) => handleLinkClick(e, '/')}
          className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1E40AF]"
        >
          GitStack
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
                    ? 'text-[#1E40AF] underline decoration-[#1E40AF] decoration-2 underline-offset-8'
                    : ''
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary CTA action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('/contact')}
            className="hidden sm:inline-flex items-center justify-center rounded-lg bg-[#1E40AF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E40AF]"
          >
            Book Consultation
          </button>
          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex md:hidden items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-3 text-sm font-medium text-slate-700">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleLinkClick(e, item.href)}
                className="py-1.5 hover:text-[#1E40AF]"
              >
                {item.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onNavigate('/contact');
              }}
              className="mt-2 w-full rounded-lg bg-[#1E40AF] px-4 py-2.5 text-center text-xs font-semibold text-white"
            >
              Book Consultation
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}

export function Footer({
  onNavigate,
  onOpenCookiePrefs
}: {
  onNavigate: (path: string) => void;
  onOpenCookiePrefs: () => void;
}) {
  const go = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <a
              href="/"
              onClick={(e) => go(e, '/')}
              className="font-display text-lg font-bold tracking-tight text-slate-900"
            >
              GitStack
            </a>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Enterprise software engineering, cloud infrastructure management, AI integration, and
              machine learning automation solutions.
            </p>
            <p className="mt-4 text-xs text-slate-500">
              contact@gitstack.io · San Francisco &amp; Global Remote
            </p>
          </div>

          <div>
            <h3 className="font-display text-xs font-semibold tracking-wide text-slate-900">
              Engineering Services
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a href="/#ai-ml" onClick={(e) => go(e, '/#ai-ml')} className="hover:text-[#1E40AF]">
                  AI Integration &amp; RAG
                </a>
              </li>
              <li>
                <a href="/services" onClick={(e) => go(e, '/services')} className="hover:text-[#1E40AF]">
                  ML Automation &amp; MLOps
                </a>
              </li>
              <li>
                <a href="/services" onClick={(e) => go(e, '/services')} className="hover:text-[#1E40AF]">
                  Custom Software Engineering
                </a>
              </li>
              <li>
                <a href="/services" onClick={(e) => go(e, '/services')} className="hover:text-[#1E40AF]">
                  Cloud Infrastructure Management
                </a>
              </li>
              <li>
                <a href="/services" onClick={(e) => go(e, '/services')} className="hover:text-[#1E40AF]">
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
                <a href="/insights" onClick={(e) => go(e, '/insights')} className="hover:text-[#1E40AF]">
                  Technical Insights Journal
                </a>
              </li>
              <li>
                <a href="/about" onClick={(e) => go(e, '/about')} className="hover:text-[#1E40AF]">
                  About GitStack
                </a>
              </li>
              <li>
                <a href="/editorial-policy" onClick={(e) => go(e, '/editorial-policy')} className="hover:text-[#1E40AF]">
                  Editorial &amp; AI Policy
                </a>
              </li>
              <li>
                <a href="/contact" onClick={(e) => go(e, '/contact')} className="hover:text-[#1E40AF]">
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
                <a href="/privacy-policy" onClick={(e) => go(e, '/privacy-policy')} className="hover:text-[#1E40AF]">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" onClick={(e) => go(e, '/terms')} className="hover:text-[#1E40AF]">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="/cookie-policy" onClick={(e) => go(e, '/cookie-policy')} className="hover:text-[#1E40AF]">
                  Cookie Policy
                </a>
              </li>
              <li>
                <a href="/disclaimer" onClick={(e) => go(e, '/disclaimer')} className="hover:text-[#1E40AF]">
                  Technical Disclaimer
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenCookiePrefs}
                  className="text-left hover:text-[#1E40AF]"
                >
                  Manage Cookie Consent
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-slate-200 pt-8 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} GitStack Technologies Inc. All rights reserved.</p>
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
