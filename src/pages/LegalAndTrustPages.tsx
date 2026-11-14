import { useEffect } from 'react';
import { CustomBlocksSection } from '../components/CustomBlocksSection.tsx';
import { InquiryForm } from '../components/InquiryForm.tsx';
import { ResilientImage } from '../components/ResilientImage.tsx';
import { applySeoMetadata } from '../lib/seo.ts';
import { DEFAULT_PAGE_CONTENTS } from '../shared/pageDefaults.ts';
import type { PageContentConfig } from '../shared/types.ts';

function LegalShell({
  kicker,
  title,
  updatedDate,
  children
}: {
  kicker: string;
  title: string;
  updatedDate: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14 lg:py-20">
      <p className="text-xs font-semibold tracking-wide text-[#1E40AF]">{kicker}</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-xs text-slate-500">Effective Date: {updatedDate}</p>
      <div className="mt-10 space-y-6 border-t border-slate-200 pt-8 text-sm leading-[1.8] text-slate-700">
        {children}
      </div>
    </div>
  );
}

export function AboutPage({
  pageContent,
  onNavigate
}: {
  pageContent?: PageContentConfig;
  onNavigate: (path: string) => void;
}) {
  const cms = pageContent || DEFAULT_PAGE_CONTENTS.about;

  useEffect(() => {
    applySeoMetadata({
      title: 'About GitStack — Engineering Leadership & Mission',
      description:
        'Learn about GitStack Technologies Inc., our engineering team, technical credentials, and commitment to transparent AI, MLOps, cloud, and software delivery.',
      path: '/about'
    });
  }, []);

  return (
    <div>
      <LegalShell kicker={cms.hero_kicker} title={cms.hero_title} updatedDate="November 14, 2026">
        {cms.hero_image && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 aspect-[16/7]">
            <ResilientImage
              src={cms.hero_image}
              alt={cms.hero_image_alt || 'GitStack Engineering Team'}
              className="h-full w-full object-cover"
              fallbackTitle="GitStack Engineering"
            />
          </div>
        )}
        <p>{cms.hero_subtitle}</p>
        <h2 className="font-display text-xl font-bold text-slate-900 pt-2">
          {cms.intro_heading}
        </h2>
        <p>{cms.intro_body}</p>
        <h2 className="font-display text-xl font-bold text-slate-900 pt-2">
          Leadership &amp; Technical Standards
        </h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Elena Vance, Principal AI Systems Architect:</strong> Leads Retrieval-Augmented
            Generation, RBAC knowledge retrieval, and LLM groundedness evaluation frameworks.
          </li>
          <li>
            <strong>Marcus Chen, Head of Machine Learning Engineering:</strong> Directs automated
            MLOps pipelines, statistical drift monitoring, and Kubernetes inference scaling.
          </li>
          <li>
            <strong>David Morales, Director of Cloud Engineering:</strong> Oversees Terraform
            governance, Open Policy Agent security compliance, and FinOps optimization.
          </li>
          <li>
            <strong>Sofia Alverez, VP of Software Engineering:</strong> Guides TypeScript distributed
            platforms, Strangler Fig legacy modernizations, and accessibility compliance.
          </li>
        </ul>
        <div className="pt-4 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => onNavigate('/contact')}
            className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-xs font-semibold text-white"
          >
            {cms.hero_cta_label || 'Contact Our Engineering Team'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/editorial-policy')}
            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Read Editorial Standards
          </button>
        </div>
      </LegalShell>
      <CustomBlocksSection blocks={cms.custom_blocks} onNavigate={onNavigate} />
    </div>
  );
}

export function ContactPage({
  pageContent,
  onNavigate
}: {
  pageContent?: PageContentConfig;
  onNavigate?: (path: string) => void;
}) {
  const cms = pageContent || DEFAULT_PAGE_CONTENTS.contact;

  useEffect(() => {
    applySeoMetadata({
      title: 'Contact GitStack — Schedule a Technical Consultation',
      description:
        'Reach GitStack for custom software engineering, cloud infrastructure management, AI integration, and ML automation consulting.',
      path: '/contact'
    });
  }, []);

  return (
    <div>
      <div className="mx-auto max-w-5xl px-6 py-14 lg:py-20">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="text-xs font-semibold tracking-wide text-[#1E40AF]">{cms.hero_kicker}</p>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900">
              {cms.hero_title}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">{cms.hero_subtitle}</p>

            {cms.hero_image && (
              <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 aspect-[16/9]">
                <ResilientImage
                  src={cms.hero_image}
                  alt={cms.hero_image_alt || 'GitStack Consulting Desk'}
                  className="h-full w-full object-cover"
                  fallbackTitle="GitStack Contact"
                />
              </div>
            )}

            <div className="mt-8 space-y-5 border-t border-slate-200 pt-6 text-sm text-slate-700">
              <div>
                <div className="text-xs font-semibold text-slate-900">New Project Inquiries</div>
                <p className="mt-1 font-mono text-xs text-slate-600">contact@gitstack.io</p>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900">Editorial &amp; Press</div>
                <p className="mt-1 font-mono text-xs text-slate-600">editorial@gitstack.io</p>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900">Privacy &amp; Compliance</div>
                <p className="mt-1 font-mono text-xs text-slate-600">privacy@gitstack.io</p>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  {cms.intro_heading || 'Business Hours & Address'}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {cms.intro_body}
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <InquiryForm compact />
          </div>
        </div>
      </div>
      {onNavigate && <CustomBlocksSection blocks={cms.custom_blocks} onNavigate={onNavigate} />}
    </div>
  );
}

export function EditorialPolicyPage() {
  useEffect(() => {
    applySeoMetadata({
      title: 'Editorial Policy & E-E-A-T Quality Standards | GitStack',
      description:
        'How GitStack ensures technical accuracy, original research, author accountability, and Google AdSense high-value content compliance.',
      path: '/editorial-policy'
    });
  }, []);

  return (
    <LegalShell kicker="Trust & Quality Governance" title="Editorial Policy & Technical Verification" updatedDate="November 14, 2026">
      <p>
        GitStack publishes original, production-tested engineering guides for software architects,
        MLOps practitioners, and technology executives. Our publication enforces strict Experience,
        Expertise, Authoritativeness, and Trustworthiness (E-E-A-T) criteria before any article
        appears on the site.
      </p>
      <h2 className="font-display text-xl font-bold text-slate-900 pt-2">
        1. Mandatory Pre-Publication Depth &amp; Anti-Thin-Content Standards
      </h2>
      <p>
        We prohibit shallow summaries, spun content, and generic filler. Every published guide must
        contain substantive architectural depth (minimum 800+ words), concrete code or table
        illustrations, clear trade-off analysis, and verifiable primary technical references.
      </p>
      <h2 className="font-display text-xl font-bold text-slate-900 pt-2">
        2. Human Author Accountability &amp; Peer Review
      </h2>
      <p>
        Every guide carries the name, role, and biographical credentials of a practicing GitStack
        engineer or architect. Code examples, infrastructure policies, and benchmark thresholds are
        reviewed against production standards prior to publication and stamped with explicit update
        timestamps.
      </p>
      <h2 className="font-display text-xl font-bold text-slate-900 pt-2">
        3. Transparency &amp; Advertising Separation
      </h2>
      <p>
        Editorial content is strictly independent of advertising. Where Google AdSense placements
        appear inside long-form guides, they are clearly labeled as advertisements, placed only
        within substantive content, and never disguise sponsored messages as engineering advice.
      </p>
    </LegalShell>
  );
}

export function PrivacyPolicyPage() {
  useEffect(() => {
    applySeoMetadata({
      title: 'Privacy Policy | GitStack',
      description:
        'GitStack Privacy Policy covering data collection, project inquiries, newsletter subscriptions, Google AdSense cookies, and GDPR/CCPA rights.',
      path: '/privacy-policy'
    });
  }, []);

  return (
    <LegalShell kicker="Legal Compliance" title="Privacy Policy" updatedDate="November 14, 2026">
      <p>
        GitStack Technologies Inc. (&ldquo;GitStack,&rdquo; &ldquo;we,&rdquo; or &ldquo;us&rdquo;)
        respects your privacy and is committed to protecting personal information collected through
        our website, consultation forms, newsletter dispatches, and comment sections.
      </p>
      <h2 className="font-display text-xl font-bold text-slate-900 pt-2">1. Information We Collect</h2>
      <p>
        We collect information you voluntarily provide when submitting a consultation inquiry (name,
        company, work email, project brief), subscribing to our technical newsletter (email,
        optional name, topic interest), or posting a comment on an engineering guide (display name,
        private email, comment text).
      </p>
      <h2 className="font-display text-xl font-bold text-slate-900 pt-2">
        2. Google AdSense &amp; Third-Party Advertising Cookies
      </h2>
      <p>
        When Google AdSense is active on GitStack and you provide consent via our Cookie Consent
        banner, third-party vendors, including Google, use cookies to serve ads based on a
        user&rsquo;s prior visits to this website or other websites. Google&rsquo;s use of
        advertising cookies enables it and its partners to serve ads based on your visit to
        GitStack and/or other sites on the Internet.
      </p>
      <p>
        Users may opt out of personalized advertising by visiting{' '}
        <a
          href="https://www.google.com/settings/ads"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#1E40AF] underline"
        >
          Google Ads Settings
        </a>{' '}
        or by choosing &ldquo;Essential Only&rdquo; in our Cookie Consent banner at any time.
      </p>
      <h2 className="font-display text-xl font-bold text-slate-900 pt-2">
        3. Data Storage, Security &amp; Retention
      </h2>
      <p>
        Submitted inquiries, comments, and newsletter preferences are stored securely in encrypted
        PostgreSQL infrastructure. We never sell or rent your email address or project brief to
        third parties.
      </p>
      <h2 className="font-display text-xl font-bold text-slate-900 pt-2">4. Your Rights (GDPR &amp; CCPA)</h2>
      <p>
        You may request access, correction, export, or deletion of your personal data at any time by
        emailing <span className="font-mono">privacy@gitstack.io</span>.
      </p>
    </LegalShell>
  );
}

export function TermsPage() {
  useEffect(() => {
    applySeoMetadata({
      title: 'Terms of Service | GitStack',
      description: 'Terms governing use of the GitStack website, technical documentation, comments, and consulting inquiry channels.',
      path: '/terms'
    });
  }, []);

  return (
    <LegalShell kicker="Legal Compliance" title="Terms of Service" updatedDate="November 14, 2026">
      <p>
        By accessing or using the GitStack website and Technical Insights Journal, you agree to be
        bound by these Terms of Service and all applicable laws and regulations.
      </p>
      <h2 className="font-display text-xl font-bold text-slate-900 pt-2">1. Intellectual Property</h2>
      <p>
        All original articles, architectural diagrams, branding, and custom editorial materials
        published on GitStack remain the intellectual property of GitStack Technologies Inc. Code
        snippets shared in Technical Insights articles may be referenced for educational and
        internal evaluation purposes unless otherwise noted.
      </p>
      <h2 className="font-display text-xl font-bold text-slate-900 pt-2">2. Acceptable Use &amp; Comments</h2>
      <p>
        Users submitting comments must refrain from spam, automated scraping, defamatory remarks, or
        malicious URLs. GitStack reserves the right to moderate or remove comments that violate
        editorial quality standards.
      </p>
      <h2 className="font-display text-xl font-bold text-slate-900 pt-2">3. Consulting Engagements</h2>
      <p>
        Submitting a consultation request through this website does not create a binding client
        engagement or service-level obligation until a formal Master Services Agreement (MSA) and
        Statement of Work (SOW) are executed by both parties.
      </p>
    </LegalShell>
  );
}

export function CookiePolicyPage({ onOpenCookiePrefs }: { onOpenCookiePrefs: () => void }) {
  useEffect(() => {
    applySeoMetadata({
      title: 'Cookie Policy | GitStack',
      description: 'How GitStack uses essential security cookies and optional Google AdSense advertising cookies.',
      path: '/cookie-policy'
    });
  }, []);

  return (
    <LegalShell kicker="Privacy Transparency" title="Cookie Policy" updatedDate="November 14, 2026">
      <p>
        GitStack uses minimal browser storage and cookies to preserve security preferences and, where
        explicitly consented, enable advertising supported by Google AdSense.
      </p>
      <h2 className="font-display text-xl font-bold text-slate-900 pt-2">1. Essential Cookies &amp; Local Storage</h2>
      <p>
        Required to remember your privacy consent choice and protect authenticated editorial
        sessions. These cannot be disabled while using authenticated Studio tools.
      </p>
      <h2 className="font-display text-xl font-bold text-slate-900 pt-2">2. Advertising Cookies (Consent-Gated)</h2>
      <p>
        Advertising scripts and ad slots are suppressed by default until you click &ldquo;Accept
        All&rdquo; in our consent banner. If you previously accepted and wish to withdraw consent,
        update your preference below.
      </p>
      <div className="pt-2">
        <button
          type="button"
          onClick={onOpenCookiePrefs}
          className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-xs font-semibold text-white"
        >
          Update Cookie Preferences
        </button>
      </div>
    </LegalShell>
  );
}

export function DisclaimerPage() {
  useEffect(() => {
    applySeoMetadata({
      title: 'Technical & Professional Disclaimer | GitStack',
      description: 'Disclaimer regarding technical architecture articles, code examples, and compliance guidance published on GitStack.',
      path: '/disclaimer'
    });
  }, []);

  return (
    <LegalShell kicker="Legal Compliance" title="Technical &amp; Professional Disclaimer" updatedDate="November 14, 2026">
      <p>
        The engineering blueprints, code patterns, cloud governance examples, and AI/ML integration
        guides published on GitStack are provided for informational and architectural education
        purposes.
      </p>
      <p>
        Every enterprise production environment carries distinct security, regulatory, and load
        requirements. Before applying architectural configurations or policy rules to live
        infrastructure, teams should validate them in staging environments or engage a qualified
        principal engineer.
      </p>
      <p>
        External reference links provided in our articles point to independent technical
        organizations and standards bodies. GitStack is not responsible for the availability or
        content of external third-party documentation.
      </p>
    </LegalShell>
  );
}
