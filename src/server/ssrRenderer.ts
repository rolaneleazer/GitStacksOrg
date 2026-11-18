import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_PRINCIPAL_AUTHOR, buildPrincipalAuthorJsonLd } from '../shared/authorDefaults.ts';
import { DEFAULT_PAGE_CONTENTS } from '../shared/pageDefaults.ts';
import { buildArticleJsonLd } from '../shared/qualityGate.ts';
import { DEFAULT_ADSENSE_SETTINGS, SEED_ARTICLES } from '../shared/seedData.ts';
import type { AdSenseSettings, Article, PageContentConfig, PageKey } from '../shared/types.ts';
import { getAdSenseSettings, listPageContents, listPosts } from './repository.ts';

type HtmlTransformer = (url: string, html: string) => Promise<string>;
let devHtmlTransformer: HtmlTransformer | null = null;
let cachedDistHtml: string | null = null;

export function setSsrDevHtmlTransformer(fn: HtmlTransformer) {
  devHtmlTransformer = fn;
}

export const PUBLIC_SSR_PATHS = new Set([
  '/',
  '/services',
  '/insights',
  '/about',
  '/contact',
  '/privacy-policy',
  '/terms',
  '/cookie-policy',
  '/disclaimer',
  '/editorial-policy',
  '/demo'
]);

export function isPublicSsrPath(reqPath: string): boolean {
  const clean = reqPath.split('?')[0].replace(/\/+$/, '') || '/';
  if (PUBLIC_SSR_PATHS.has(clean)) return true;
  if (clean.startsWith('/insights/') && clean.length > '/insights/'.length) return true;
  return false;
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function markdownToBasicHtml(md: string): string {
  const lines = String(md || '').split('\n');
  const out: string[] = [];
  let inList = false;
  let inCode = false;

  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith('```')) {
      closeList();
      if (!inCode) {
        inCode = true;
        out.push('<pre><code>');
      } else {
        inCode = false;
        out.push('</code></pre>');
      }
      continue;
    }
    if (inCode) {
      out.push(`${escapeHtml(line)}\n`);
      continue;
    }
    if (!line.trim()) {
      closeList();
      continue;
    }
    if (line.startsWith('### ')) {
      closeList();
      out.push(`<h3>${escapeHtml(line.slice(4).trim())}</h3>`);
    } else if (line.startsWith('## ')) {
      closeList();
      out.push(`<h2>${escapeHtml(line.slice(3).trim())}</h2>`);
    } else if (line.startsWith('# ')) {
      closeList();
      out.push(`<h2>${escapeHtml(line.slice(2).trim())}</h2>`);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) {
        inList = true;
        out.push('<ul>');
      }
      out.push(`<li>${escapeHtml(line.slice(2).trim())}</li>`);
    } else if (line.startsWith('|')) {
      closeList();
      out.push(`<p>${escapeHtml(line.replace(/\|/g, ' ').trim())}</p>`);
    } else {
      closeList();
      const formatted = escapeHtml(line).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      out.push(`<p>${formatted}</p>`);
    }
  }
  closeList();
  if (inCode) out.push('</code></pre>');
  return out.join('\n');
}

async function loadBaseHtmlTemplate(origin: string): Promise<string | null> {
  if (devHtmlTransformer) {
    try {
      return await fs.readFile(path.resolve(process.cwd(), 'index.html'), 'utf8');
    } catch {
      return null;
    }
  }

  if (cachedDistHtml) return cachedDistHtml;

  const candidates = [
    path.resolve(process.cwd(), 'dist', '_spa.html'),
    path.resolve(process.cwd(), 'dist', 'index.html'),
    path.resolve(process.cwd(), 'index.html')
  ];
  for (const filePath of candidates) {
    try {
      const html = await fs.readFile(filePath, 'utf8');
      if (html && html.includes('<div id="root">')) {
        if (filePath.includes(`${path.sep}dist${path.sep}`)) {
          cachedDistHtml = html;
        }
        return html;
      }
    } catch {
      // try next path
    }
  }

  // Fallback for serverless environments where static dist/_spa.html is hosted on CDN
  for (const assetPath of ['/_spa.html', '/index.html']) {
    try {
      const res = await fetch(`${origin}${assetPath}`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const html = await res.text();
        if (html.includes('<div id="root">')) {
          cachedDistHtml = html;
          return html;
        }
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function renderNavAndHeaderHtml(brandName: string): string {
  return `
<header style="border-bottom:1px solid #e2e8f0;background:#ffffff;padding:16px 24px;">
  <div style="max-width:1152px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:24px;">
    <a href="/" style="font-weight:700;font-size:18px;color:#0f172a;text-decoration:none;">${escapeHtml(brandName)}</a>
    <nav aria-label="Primary Navigation" style="display:flex;gap:24px;font-size:14px;">
      <a href="/services">Services</a>
      <a href="/demo">Live Demo</a>
      <a href="/insights">Insights</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
    </nav>
    <a href="/contact" style="font-size:13px;font-weight:600;color:#1e40af;">Book Consultation</a>
  </div>
</header>`;
}

function renderAuthorCardHtml(): string {
  return `
<div class="author-card border border-slate-200 rounded-xl p-4 bg-slate-50" style="margin-top:24px;border:1px solid #e2e8f0;border-radius:12px;padding:16px;background:#f8fafc;">
  <div class="font-bold text-slate-900">Written by ${escapeHtml(DEFAULT_PRINCIPAL_AUTHOR.name)}</div>
  <div class="text-xs text-slate-600">${escapeHtml(DEFAULT_PRINCIPAL_AUTHOR.role)}</div>
  <p class="text-xs text-slate-500 mt-1">${escapeHtml(DEFAULT_PRINCIPAL_AUTHOR.bio)}</p>
</div>`;
}

function renderLegalDisclosureHtml(): string {
  return `
<section class="legal-disclosure" style="margin-top:20px;border:1px solid #e2e8f0;border-radius:12px;padding:16px;background:#f8fafc;">
  <h3>Third-Party Advertising &amp; Cookies</h3>
  <p>We use Google AdSense and third-party advertising partners to serve ads when you visit our website. These companies may use cookies, web beacons, and similar tracking technologies to collect information about your visits to provide personalized advertisements.</p>
  <p>You may opt out of personalized advertising by visiting <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer">www.aboutads.info</a> or <a href="https://myadcenter.google.com/" target="_blank" rel="noopener noreferrer">Google Ad Center</a>.</p>
</section>`;
}

function renderFooterHtml(brandName: string): string {
  return `
<footer style="border-top:1px solid #e2e8f0;background:#ffffff;padding:40px 24px;margin-top:48px;color:#475569;font-size:14px;">
  <div style="max-width:1152px;margin:0 auto;">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:24px;">
      <div>
        <strong>${escapeHtml(brandName)}</strong>
        <p>Enterprise software engineering, cloud infrastructure management, AI integration, and machine learning automation solutions.</p>
        <p>contact@gitstack.io · 548 Market Street, Suite 42010, San Francisco, CA 94104</p>
      </div>
      <div>
        <h3>Engineering Services</h3>
        <ul>
          <li><a href="/services">AI Integration &amp; RAG</a></li>
          <li><a href="/services">ML Automation &amp; MLOps</a></li>
          <li><a href="/services">Custom Software Engineering</a></li>
          <li><a href="/services">Cloud Infrastructure Management</a></li>
          <li><a href="/services">Technical Consulting</a></li>
        </ul>
      </div>
      <div>
        <h3>Company &amp; Discovery</h3>
        <ul>
          <li><a href="/demo">Interactive Customer Demo</a></li>
          <li><a href="/insights">Technical Insights Journal</a></li>
          <li><a href="/about">About ${escapeHtml(brandName)}</a></li>
          <li><a href="/editorial-policy">Editorial &amp; AI Policy</a></li>
          <li><a href="/contact">Contact &amp; Consultation</a></li>
        </ul>
      </div>
      <div>
        <h3>Legal &amp; Trust</h3>
        <ul>
          <li><a href="/privacy-policy">Privacy Policy</a></li>
          <li><a href="/terms">Terms of Service</a></li>
          <li><a href="/cookie-policy">Cookie Policy</a></li>
          <li><a href="/disclaimer">Technical Disclaimer</a></li>
        </ul>
      </div>
    </div>
    ${renderLegalDisclosureHtml()}
    <div style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px;font-size:12px;">
      <p>© ${new Date().getFullYear()} ${escapeHtml(brandName)} Technologies Inc. All rights reserved.</p>
      <p><a href="/llms.txt">llms.txt</a> · <a href="/sitemap.xml">sitemap.xml</a> · <a href="/robots.txt">robots.txt</a> · <a href="/ads.txt">ads.txt</a></p>
    </div>
  </div>
</footer>`;
}

function buildRouteContent(
  cleanPath: string,
  origin: string,
  pagesMap: Record<PageKey, PageContentConfig>,
  posts: Article[],
  settings: AdSenseSettings
): {
  title: string;
  description: string;
  ogType: 'website' | 'article';
  jsonLd?: Record<string, unknown>;
  mainHtml: string;
} {
  const brand = settings.brand_name?.trim() || DEFAULT_ADSENSE_SETTINGS.brand_name || 'GitStack';

  if (cleanPath.startsWith('/insights/')) {
    const slug = cleanPath.slice('/insights/'.length);
    const article = posts.find((p) => p.slug === slug);
    if (article) {
      const faqsHtml = article.faqs.length
        ? `<section><h2>Frequently Asked Questions</h2>${article.faqs
            .map((f) => `<h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p>`)
            .join('')}</section>`
        : '';
      const refsHtml = article.references.length
        ? `<section><h2>References &amp; Primary Sources</h2><ul>${article.references
            .map(
              (r) =>
                `<li><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.title)}</a></li>`
            )
            .join('')}</ul></section>`
        : '';
      return {
        title: article.meta_title || `${article.title} | ${brand}`,
        description: article.meta_description || article.summary_tldr,
        ogType: 'article',
        jsonLd: buildArticleJsonLd(article, origin),
        mainHtml: `
<main style="max-width:960px;margin:0 auto;padding:40px 24px;">
  <article>
    <p>${escapeHtml(article.category)} · ${article.read_time_minutes} min read · ${article.word_count} words</p>
    <h1>${escapeHtml(article.title)}</h1>
    <p>By ${escapeHtml(article.author_name)} — ${escapeHtml(article.author_role)}</p>
    <img src="${escapeHtml(article.cover_image)}" alt="${escapeHtml(article.cover_alt || article.title)}" style="max-width:100%;height:auto;border-radius:12px;" />
    <section><h2>Executive Architecture Summary</h2><p>${escapeHtml(article.summary_tldr)}</p></section>
    ${markdownToBasicHtml(article.content_markdown)}
    ${faqsHtml}
    ${refsHtml}
    <div class="author-card border border-slate-200 rounded-xl p-4 bg-slate-50">
      <div class="font-bold text-slate-900">Written by ${escapeHtml(article.author_name)}</div>
      <div class="text-xs text-slate-600">${escapeHtml(article.author_role)}</div>
      <p class="text-xs text-slate-500 mt-1">${escapeHtml(article.author_bio)}</p>
    </div>
  </article>
</main>`
      };
    }
  }

  if (cleanPath === '/services') {
    const cms = pagesMap.services;
    return {
      title: `Enterprise AI, MLOps, Custom Software & Cloud Services | ${brand}`,
      description: cms.hero_subtitle,
      ogType: 'website',
      mainHtml: `
<main style="max-width:1152px;margin:0 auto;padding:40px 24px;">
  <p>${escapeHtml(cms.hero_kicker)}</p>
  <h1>${escapeHtml(cms.hero_title)}</h1>
  <p>${escapeHtml(cms.hero_subtitle)}</p>
  <section>
    <h2>Core Enterprise Engineering Capabilities</h2>
    <h3>01. AI Integration &amp; Enterprise RAG Architecture</h3>
    <p>Production Retrieval-Augmented Generation pipelines combining hybrid lexical-vector indexing, cross-encoder reranking, zero-trust RBAC pre-retrieval filtering, and automated groundedness evaluation to eliminate hallucinations across enterprise knowledge bases.</p>
    <h3>02. Machine Learning Automation &amp; MLOps Pipelines</h3>
    <p>Automated feature stores, event-driven retraining DAGs, Population Stability Index (PSI) drift monitors, shadow traffic mirroring, and zero-downtime Kubernetes canary promotions.</p>
    <h3>03. Custom Distributed Software Development</h3>
    <p>High-throughput TypeScript, React, Node.js, Go, and Python microservices, Strangler Fig legacy monolith modernization, transactional outbox messaging, and WCAG AA executive platforms.</p>
    <h3>04. Multi-Region Cloud Infrastructure Management &amp; FinOps</h3>
    <p>Modular Terraform stacks, remote state locking, Open Policy Agent (OPA) policy-as-code gates in CI, Kubernetes multi-region cluster orchestration, and automated cloud cost optimization.</p>
    <h3>05. Principal Technical &amp; Security Consulting</h3>
    <p>Architecture audits, SOC2/ISO-27001 readiness engineering, AI due diligence, and fractional principal systems engineering leadership.</p>
  </section>
  ${renderAuthorCardHtml()}
</main>`
    };
  }

  if (cleanPath === '/insights') {
    return {
      title: `Technical Insights Journal — AI, MLOps & Cloud Architecture | ${brand}`,
      description:
        'In-depth engineering blueprints, AI integration patterns, MLOps automation strategies, and cloud governance guides authored by GitStack principal architects.',
      ogType: 'website',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: `${brand} Technical Insights Journal`,
        url: `${origin}/insights`
      },
      mainHtml: `
<main style="max-width:1152px;margin:0 auto;padding:40px 24px;">
  <p>${escapeHtml(brand)} Engineering Publication</p>
  <h1>Technical Insights &amp; Architecture Blueprints</h1>
  <p>Long-form production guides authored by ${escapeHtml(brand)} principal architects. Every article meets strict technical depth, source citation, and peer-review standards.</p>
  ${posts
    .map(
      (p) => `
    <article style="margin-top:24px;padding:20px;border:1px solid #e2e8f0;border-radius:12px;">
      <img src="${escapeHtml(p.cover_image)}" alt="${escapeHtml(p.cover_alt || p.title)}" style="max-width:480px;height:auto;border-radius:8px;" />
      <p>${escapeHtml(p.category)} · ${p.read_time_minutes} min read · ${p.word_count} words</p>
      <h2><a href="/insights/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a></h2>
      <p>${escapeHtml(p.summary_tldr)}</p>
      <p>By ${escapeHtml(p.author_name)} · ${escapeHtml(p.author_role)}</p>
    </article>`
    )
    .join('\n')}
  ${renderAuthorCardHtml()}
</main>`
    };
  }

  if (cleanPath === '/about') {
    const cms = pagesMap.about;
    return {
      title: `About ${brand} — Engineering Leadership & Mission`,
      description:
        'Learn about GitStack Technologies Inc., our engineering team, technical credentials, and commitment to transparent AI, MLOps, cloud, and software delivery.',
      ogType: 'website',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: `About ${brand} — Engineering Leadership & Mission`,
        url: `${origin}/about`,
        mainEntity: buildPrincipalAuthorJsonLd(origin)
      },
      mainHtml: `
<main style="max-width:960px;margin:0 auto;padding:40px 24px;">
  <p>${escapeHtml(cms.hero_kicker)}</p>
  <h1>${escapeHtml(cms.hero_title)}</h1>
  <p>${escapeHtml(cms.hero_subtitle)}</p>
  <h2>${escapeHtml(cms.intro_heading)}</h2>
  <p>${escapeHtml(cms.intro_body)}</p>
  <h2>Leadership &amp; Technical Standards</h2>
  ${renderAuthorCardHtml()}
  <ul>
    <li><strong>Elena Vance, Principal AI Systems Architect:</strong> Leads Retrieval-Augmented Generation, RBAC knowledge retrieval, and LLM groundedness evaluation frameworks.</li>
    <li><strong>Marcus Chen, Head of Machine Learning Engineering:</strong> Directs automated MLOps pipelines, statistical drift monitoring, and Kubernetes inference scaling.</li>
    <li><strong>David Morales, Director of Cloud Engineering:</strong> Oversees Terraform governance, Open Policy Agent security compliance, and FinOps optimization.</li>
    <li><strong>Sofia Alverez, VP of Software Engineering:</strong> Guides TypeScript distributed platforms, Strangler Fig legacy modernizations, and accessibility compliance.</li>
  </ul>
</main>`
    };
  }

  if (cleanPath === '/contact') {
    const cms = pagesMap.contact;
    return {
      title: `Contact ${brand} — Schedule a Technical Consultation`,
      description:
        'Reach GitStack for custom software engineering, cloud infrastructure management, AI integration, and ML automation consulting.',
      ogType: 'website',
      mainHtml: `
<main style="max-width:960px;margin:0 auto;padding:40px 24px;">
  <p>${escapeHtml(cms.hero_kicker)}</p>
  <h1>${escapeHtml(cms.hero_title)}</h1>
  <p>${escapeHtml(cms.hero_subtitle)}</p>
  <section>
    <h2>Direct Contact &amp; Office Hours</h2>
    <p><strong>Direct Phone:</strong> ${escapeHtml(cms.contact_phone || '+1 (415) 890-4210')}</p>
    <p><strong>New Project Inquiries:</strong> ${escapeHtml(cms.contact_sales_email || 'contact@gitstack.io')}</p>
    <p><strong>Editorial &amp; Press:</strong> ${escapeHtml(cms.contact_editorial_email || 'editorial@gitstack.io')}</p>
    <p><strong>Privacy &amp; Compliance:</strong> ${escapeHtml(cms.contact_privacy_email || 'privacy@gitstack.io')}</p>
    <p>${escapeHtml(cms.intro_body)}</p>
  </section>
</main>`
    };
  }

  if (cleanPath === '/privacy-policy') {
    return {
      title: `Privacy Policy | ${brand}`,
      description:
        'GitStack Privacy Policy covering data collection, project inquiries, newsletter subscriptions, Google AdSense cookies, and GDPR/CCPA rights.',
      ogType: 'website',
      mainHtml: `
<main style="max-width:960px;margin:0 auto;padding:40px 24px;">
  <p>Legal Compliance</p>
  <h1>Privacy Policy</h1>
  <p>GitStack Technologies Inc. respects your privacy and is committed to protecting personal information collected through our website, consultation forms, newsletter dispatches, and comment sections.</p>
  <h2>1. Information We Collect</h2>
  <p>We collect information you voluntarily provide when submitting a consultation inquiry, subscribing to our technical newsletter, or posting a comment on an engineering guide.</p>
  <h2>2. Google AdSense &amp; Third-Party Advertising Cookies</h2>
  ${renderLegalDisclosureHtml()}
  <p>You may also manage preferences directly in <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">Google Ads Settings</a> or choose Essential Only in our Cookie Consent banner at any time.</p>
  <h2>3. Data Storage, Security &amp; Retention</h2>
  <p>Submitted inquiries, comments, and newsletter preferences are stored securely in encrypted PostgreSQL infrastructure. We never sell or rent your email address or project brief to third parties.</p>
  <h2>4. Your Rights (GDPR &amp; CCPA)</h2>
  <p>You may request access, correction, export, or deletion of your personal data at any time by emailing privacy@gitstack.io.</p>
</main>`
    };
  }

  if (cleanPath === '/cookie-policy') {
    return {
      title: `Cookie Policy | ${brand}`,
      description:
        'How GitStack uses essential security cookies and optional Google AdSense advertising cookies.',
      ogType: 'website',
      mainHtml: `
<main style="max-width:960px;margin:0 auto;padding:40px 24px;">
  <p>Privacy Transparency</p>
  <h1>Cookie Policy</h1>
  <p>GitStack uses minimal browser storage and cookies to preserve security preferences and, where explicitly consented, enable advertising supported by Google AdSense.</p>
  <h2>1. Essential Cookies &amp; Local Storage</h2>
  <p>Required to remember your privacy consent choice and protect authenticated editorial sessions.</p>
  <h2>2. Advertising Cookies (Consent-Gated)</h2>
  <p>Advertising scripts and ad slots are suppressed by default until you explicitly accept advertising cookies in our consent banner.</p>
  ${renderLegalDisclosureHtml()}
</main>`
    };
  }

  if (cleanPath === '/terms') {
    return {
      title: `Terms of Service | ${brand}`,
      description:
        'Terms governing use of the GitStack website, technical documentation, comments, and consulting inquiry channels.',
      ogType: 'website',
      mainHtml: `
<main style="max-width:960px;margin:0 auto;padding:40px 24px;">
  <p>Legal Compliance</p>
  <h1>Terms of Service</h1>
  <p>By accessing or using the GitStack website and Technical Insights Journal, you agree to be bound by these Terms of Service and all applicable laws and regulations.</p>
  <h2>1. Intellectual Property</h2>
  <p>All original articles, architectural diagrams, branding, and custom editorial materials published on GitStack remain the intellectual property of GitStack Technologies Inc.</p>
  <h2>2. Acceptable Use &amp; Comments</h2>
  <p>Users submitting comments must refrain from spam, automated scraping, defamatory remarks, or malicious URLs.</p>
  <h2>3. Consulting Engagements</h2>
  <p>Submitting a consultation request through this website does not create a binding client engagement until a formal Master Services Agreement and Statement of Work are executed.</p>
</main>`
    };
  }

  if (cleanPath === '/disclaimer') {
    return {
      title: `Technical & Professional Disclaimer | ${brand}`,
      description:
        'Disclaimer regarding technical architecture articles, code examples, and compliance guidance published on GitStack.',
      ogType: 'website',
      mainHtml: `
<main style="max-width:960px;margin:0 auto;padding:40px 24px;">
  <p>Legal Compliance</p>
  <h1>Technical &amp; Professional Disclaimer</h1>
  <p>The engineering blueprints, code patterns, cloud governance examples, and AI/ML integration guides published on GitStack are provided for informational and architectural education purposes.</p>
  <p>Every enterprise production environment carries distinct security, regulatory, and load requirements. Teams should validate configurations in staging environments or engage a qualified principal engineer before production rollout.</p>
</main>`
    };
  }

  if (cleanPath === '/editorial-policy') {
    return {
      title: `Editorial Policy & E-E-A-T Quality Standards | ${brand}`,
      description:
        'How GitStack ensures technical accuracy, original research, author accountability, and Google AdSense high-value content compliance.',
      ogType: 'website',
      mainHtml: `
<main style="max-width:960px;margin:0 auto;padding:40px 24px;">
  <p>Trust &amp; Quality Governance</p>
  <h1>Editorial Policy &amp; Technical Verification</h1>
  <p>GitStack publishes original, production-tested engineering guides for software architects, MLOps practitioners, and technology executives. Every article passes strict 8-pillar E-E-A-T and 800+ word technical depth criteria prior to publication.</p>
  ${renderAuthorCardHtml()}
</main>`
    };
  }

  if (cleanPath === '/demo') {
    return {
      title: `Live Enterprise Architecture & MLOps Simulator | ${brand}`,
      description:
        'Interactive sandbox demonstrating enterprise RAG retrieval, MLOps drift detection, and GitStack deployment metrics.',
      ogType: 'website',
      mainHtml: `
<main style="max-width:1152px;margin:0 auto;padding:40px 24px;">
  <p>Interactive Sandbox</p>
  <h1>Live Enterprise AI &amp; MLOps Architecture Simulator</h1>
  <p>Explore how GitStack orchestrates hybrid lexical-vector RAG retrieval, RBAC security filtering, automated MLOps canary rollouts, and multi-region Terraform compliance gates.</p>
  ${renderAuthorCardHtml()}
</main>`
    };
  }

  // Default: Home (/)
  const homeCms = pagesMap.home;
  const heroImg = homeCms.hero_image || '/src/assets/images/hero_gitstack_architecture_1794645171609.jpg';
  const heroAlt =
    homeCms.hero_image_alt ||
    'GitStack engineers collaborating on AI systems architecture in a sunlit glass engineering studio';
  const secondaryImg =
    homeCms.secondary_image || '/src/assets/images/ai_ml_pipeline_visual_1794645170877.jpg';
  const secondaryAlt =
    homeCms.secondary_image_alt ||
    'Modular AI integration and machine learning automation pipeline architecture diagram';

  return {
    title: `${brand} — AI Integration, ML Automation & Cloud Engineering`,
    description:
      'GitStack delivers AI integration, machine learning automation, custom software engineering, cloud infrastructure management, and technical consulting for enterprise teams.',
    ogType: 'website',
    mainHtml: `
<main style="max-width:1152px;margin:0 auto;padding:40px 24px;">
  <section>
    <p>${escapeHtml(homeCms.hero_kicker)}</p>
    <h1>${escapeHtml(homeCms.hero_title)}</h1>
    <p>${escapeHtml(homeCms.hero_subtitle)}</p>
    <p><a href="/contact">${escapeHtml(homeCms.hero_cta_label || 'Schedule Discovery Call')}</a> · <a href="/services">Explore Services</a></p>
    <img src="${escapeHtml(heroImg)}" alt="${escapeHtml(heroAlt)}" style="max-width:100%;height:auto;border-radius:12px;margin-top:16px;" />
  </section>

  <section style="margin-top:40px;">
    <h2>${escapeHtml(homeCms.intro_heading)}</h2>
    <p>${escapeHtml(homeCms.intro_body)}</p>
    <img src="${escapeHtml(secondaryImg)}" alt="${escapeHtml(secondaryAlt)}" style="max-width:100%;height:auto;border-radius:12px;margin-top:16px;" />
    <ul>
      <li><strong>01. AI Integration &amp; Agentic Systems:</strong> Production Retrieval-Augmented Generation (RAG), private enterprise copilots, hybrid search, and groundedness guardrails delivering 96.4% citation faithfulness at under 350ms retrieval latency.</li>
      <li><strong>02. Machine Learning Automation (MLOps):</strong> Event-driven drift detection (PSI/KS), unified offline-online feature stores, shadow traffic mirroring, and zero-downtime Kubernetes canary promotions cutting retraining lead time from six weeks to four hours.</li>
      <li><strong>03. Custom Software Development:</strong> Event-driven TypeScript, Node.js, React, Go, and Python platforms, Strangler Fig legacy monolith decomposition, and transactional outbox messaging.</li>
      <li><strong>04. Cloud Infrastructure Management:</strong> Multi-region Terraform governance, Open Policy Agent (OPA) policy-as-code checks in CI, and automated FinOps optimization reducing cloud spend by up to 34%.</li>
      <li><strong>05. Technical Consulting:</strong> Principal architecture audits, SOC2/ISO-27001 readiness engineering, and AI feasibility roadmaps.</li>
    </ul>
  </section>

  <section style="margin-top:40px;">
    <h2>Peer-Reviewed Architecture Guides</h2>
    ${posts
      .slice(0, 4)
      .map(
        (p) => `
      <article style="margin-top:16px;padding:16px;border:1px solid #e2e8f0;border-radius:12px;">
        <h3><a href="/insights/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a></h3>
        <p>${escapeHtml(p.summary_tldr)}</p>
        <p>By ${escapeHtml(p.author_name)} · ${escapeHtml(p.author_role)} · ${p.word_count} words</p>
      </article>`
      )
      .join('\n')}
    ${renderAuthorCardHtml()}
  </section>
</main>`
  };
}

export async function renderPublicRouteHtml(reqPath: string, origin: string): Promise<string | null> {
  const cleanPath = reqPath.split('?')[0].replace(/\/+$/, '') || '/';
  const template = await loadBaseHtmlTemplate(origin);
  if (!template) return null;

  const [pagesList, postsList, settings] = await Promise.all([
    listPageContents().catch(() => Object.values(DEFAULT_PAGE_CONTENTS)),
    listPosts(false).catch(() => SEED_ARTICLES),
    getAdSenseSettings().catch(() => DEFAULT_ADSENSE_SETTINGS)
  ]);

  const pagesMap: Record<PageKey, PageContentConfig> = { ...DEFAULT_PAGE_CONTENTS };
  for (const page of pagesList) {
    pagesMap[page.page_key] = page;
  }
  const posts = postsList.length > 0 ? postsList : SEED_ARTICLES;

  const route = buildRouteContent(cleanPath, origin, pagesMap, posts, settings);
  const brandName = settings.brand_name?.trim() || DEFAULT_ADSENSE_SETTINGS.brand_name || 'GitStack';
  const canonicalUrl = `${origin}${cleanPath === '/' ? '' : cleanPath}`;

  const ssrBodyHtml = `<div id="root">${renderNavAndHeaderHtml(brandName)}${route.mainHtml}${renderFooterHtml(brandName)}</div>`;

  let html = template;

  // Replace root mount node (whether empty or containing fallback HTML)
  html = html.replace(/<div id="root">[\s\S]*?<\/div>\s*(?=<script type="module")/i, `${ssrBodyHtml}\n    `);
  if (!html.includes(route.mainHtml.slice(0, 60))) {
    html = html.replace('<div id="root"></div>', ssrBodyHtml);
  }

  // Update document head metadata for crawlers
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(route.title)}</title>`);
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/>/i,
    `<meta name="description" content="${escapeHtml(route.description)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/i,
    `<meta property="og:title" content="${escapeHtml(route.title)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/i,
    `<meta property="og:description" content="${escapeHtml(route.description)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:type"\s+content="[^"]*"\s*\/>/i,
    `<meta property="og:type" content="${route.ogType}" />`
  );
  html = html.replace(
    '</head>',
    `  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />\n    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />\n  </head>`
  );

  if (route.jsonLd) {
    html = html.replace(
      /<script id="dynamic-jsonld" type="application\/ld\+json">[\s\S]*?<\/script>/i,
      `<script id="dynamic-jsonld" type="application/ld+json">${JSON.stringify(route.jsonLd)}</script>`
    );
  }

  if (devHtmlTransformer) {
    html = await devHtmlTransformer(cleanPath, html);
  }

  return html;
}
