import React from 'react';

export const DEFAULT_PRINCIPAL_AUTHOR = {
  name: 'Ronel Molina',
  role: 'Principal Cloud Architect · 13+ Years Distributed Systems Experience',
  bio: 'Specializing in high-throughput cloud infrastructure, MLOps automation, and enterprise compliance.'
};

export function buildPrincipalAuthorJsonLd(origin: string) {
  return {
    '@type': 'Person',
    '@id': `${origin}/#author-ronel-molina`,
    name: DEFAULT_PRINCIPAL_AUTHOR.name,
    jobTitle: 'Principal Cloud Architect',
    description: `${DEFAULT_PRINCIPAL_AUTHOR.role}. ${DEFAULT_PRINCIPAL_AUTHOR.bio}`,
    worksFor: {
      '@type': 'Organization',
      name: 'GitStack',
      url: origin
    },
    knowsAbout: [
      'High-Throughput Cloud Infrastructure',
      'Distributed Systems Architecture',
      'MLOps Automation',
      'Enterprise Security & Compliance'
    ]
  };
}

interface LegalAdvertisingDisclosureProps {
  compact?: boolean;
  onOpenCookiePrefs?: () => void;
  onNavigate?: (path: string) => void;
  className?: string;
}

export function LegalAdvertisingDisclosure({
  compact = false,
  onOpenCookiePrefs,
  onNavigate,
  className = ''
}: LegalAdvertisingDisclosureProps) {
  if (compact) {
    return (
      <section
        aria-label="Third-Party Advertising and Cookies Disclosure"
        className={`legal-disclosure rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs leading-relaxed text-slate-600 ${className}`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-xs font-bold text-slate-900">
              Third-Party Advertising &amp; Cookies
            </h3>
            <p className="mt-1">
              We use Google AdSense and third-party advertising partners to serve ads when you visit
              our website. These companies may use cookies, web beacons, and similar tracking
              technologies to collect information about your visits to provide personalized
              advertisements. Opt out via{' '}
              <a
                href="https://www.aboutads.info/choices/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[var(--gs-primary)] underline"
              >
                www.aboutads.info
              </a>{' '}
              or{' '}
              <a
                href="https://myadcenter.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[var(--gs-primary)] underline"
              >
                Google Ad Center
              </a>
              .
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onNavigate && (
              <a
                href="/privacy-policy"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/privacy-policy');
                }}
                className="font-semibold text-slate-700 hover:text-[var(--gs-primary)] whitespace-nowrap"
              >
                Privacy Policy
              </a>
            )}
            {onOpenCookiePrefs && (
              <button
                type="button"
                onClick={onOpenCookiePrefs}
                className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap"
              >
                Cookie Preferences
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`legal-disclosure rounded-xl border border-slate-200 bg-slate-50/80 p-5 sm:p-6 space-y-3 text-sm leading-relaxed text-slate-700 ${className}`}
    >
      <h3 className="font-display text-base font-bold text-slate-900">
        Third-Party Advertising &amp; Cookies
      </h3>
      <p>
        We use Google AdSense and third-party advertising partners to serve ads when you visit our
        website. These companies may use cookies, web beacons, and similar tracking technologies to
        collect information about your visits to provide personalized advertisements.
      </p>
      <p>
        You may opt out of personalized advertising by visiting{' '}
        <a
          href="https://www.aboutads.info/choices/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--gs-primary)] underline"
        >
          www.aboutads.info
        </a>{' '}
        or{' '}
        <a
          href="https://myadcenter.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--gs-primary)] underline"
        >
          Google Ad Center
        </a>
        .
      </p>
      {onOpenCookiePrefs && (
        <div className="pt-1">
          <button
            type="button"
            onClick={onOpenCookiePrefs}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors"
          >
            Manage Cookie Consent Settings
          </button>
        </div>
      )}
    </section>
  );
}

interface AuthorEeatCardProps {
  name?: string;
  role?: string;
  bio?: string;
  prefix?: string;
  className?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export function AuthorEeatCard({
  name = DEFAULT_PRINCIPAL_AUTHOR.name,
  role = DEFAULT_PRINCIPAL_AUTHOR.role,
  bio = DEFAULT_PRINCIPAL_AUTHOR.bio,
  prefix = 'Written by',
  className = '',
  onAction,
  actionLabel
}: AuthorEeatCardProps) {
  return (
    <div
      className={`author-card border border-slate-200 rounded-xl p-4 sm:p-5 bg-slate-50 ${className}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-display font-bold text-slate-900 text-sm sm:text-base">
            {prefix ? `${prefix} ${name}` : name}
          </div>
          <div className="mt-0.5 text-xs font-medium text-slate-600">{role}</div>
          <p className="text-xs leading-relaxed text-slate-500 mt-1.5 max-w-3xl">{bio}</p>
        </div>
        {onAction && actionLabel && (
          <button
            type="button"
            onClick={onAction}
            className="mt-1 sm:mt-0 inline-flex min-h-[36px] items-center text-xs font-semibold text-[var(--gs-primary)] hover:underline whitespace-nowrap shrink-0"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
