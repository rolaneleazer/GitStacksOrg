import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_PRINCIPAL_AUTHOR } from '../shared/authorDefaults.ts';
import type {
  Article,
  ContactEntityKind,
  ContactRegistryEntry,
  ContactRegistryScope,
  ContactScanSummary,
  GrowthModuleKey,
  PageContentConfig,
  PageKey,
  WorkspaceModuleId
} from '../shared/types.ts';
import { buildPublicRouteMainHtml, PUBLIC_SSR_PATHS } from './ssrRenderer.ts';
import {
  getGrowthModuleEmailConfig,
  saveGrowthModuleEmailConfig
} from './growthStore.ts';
import {
  getAdSenseSettings,
  getAdminNotificationSettings,
  getAgentReportSettings,
  getAiSearchVisibilitySettings,
  getCyberSecuritySettings,
  getPostBySlug,
  getProductQaSettings,
  listIntegrationSecretStatuses,
  listPageContents,
  listPosts,
  listUserProfiles,
  saveAdminNotificationSettings,
  saveAgentReportSettings,
  saveAiSearchVisibilitySettings,
  saveCyberSecuritySettings,
  saveProductQaSettings,
  updateTeamUser,
  upsertPageContent,
  upsertPost
} from './repository.ts';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\b\d{2,4})[\s.-]\d{3,4}[\s.-]\d{3,4}\b/g;

// Attribution patterns in copy (e.g. "Written by Rolan Molano", "**Elena Vance, Principal AI Systems Architect:**", "Contact Jane Doe")
const PERSON_ATTRIBUTION_REGEX =
  /(?:\*\*\s*([A-Z][a-z]{1,18}(?:\s+[A-Z][a-z]{1,18}){1,2})\s*,\s*(?:Principal|Head|Director|VP|Lead|Senior|Chief|Founder|Architect|Engineer)[^*\n]*\*\*)|(?:(?:Written by|Authored by|Author:|Contact:|Reviewed by)\s+([A-Z][a-z]{1,18}(?:\s+[A-Z][a-z]{1,18}){1,2}))/g;

const PAGE_LABELS: Record<PageKey, { title: string; route: string }> = {
  home: { title: 'Home Page', route: '/' },
  services: { title: 'Services Page', route: '/services' },
  about: { title: 'About Page', route: '/about' },
  contact: { title: 'Contact & Consultation Page', route: '/contact' }
};

function normalizeWhitespace(input: string): string {
  return String(input || '').replace(/\s+/g, ' ').trim();
}

function stripHtmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSnippet(text: string, matchValue: string): string {
  const clean = normalizeWhitespace(text);
  if (!clean) return matchValue;
  const idx = clean.toLowerCase().indexOf(matchValue.toLowerCase());
  if (idx === -1) return clean.slice(0, 140);
  const start = Math.max(0, idx - 48);
  const end = Math.min(clean.length, idx + matchValue.length + 64);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < clean.length ? '…' : '';
  return `${prefix}${clean.slice(start, end)}${suffix}`;
}

function extractEmails(text: string): string[] {
  if (!text) return [];
  const matches = text.match(EMAIL_REGEX) || [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    const clean = m.trim();
    const key = clean.toLowerCase();
    if (!seen.has(key) && !key.endsWith('.png') && !key.endsWith('.jpg') && !key.endsWith('.svg')) {
      seen.add(key);
      out.push(clean);
    }
  }
  return out;
}

function extractPhones(text: string): string[] {
  if (!text) return [];
  const matches = text.match(PHONE_REGEX) || [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const clean = raw.trim();
    const digits = clean.replace(/\D/g, '');
    // Reject dates (e.g. 2026-11-14), short codes, or purely numeric IDs without phone structure
    if (digits.length < 9 || digits.length > 15) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) continue;
    if (!/[+\s().]/.test(clean) && !clean.includes('-')) continue;
    if (seen.has(digits)) continue;
    seen.add(digits);
    out.push(clean);
  }
  return out;
}

function escapeRegExp(val: string): string {
  return val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const NON_PERSON_WORDS = new Set([
  'gitstack',
  'principal',
  'head',
  'director',
  'chief',
  'lead',
  'senior',
  'founder',
  'architect',
  'engineer',
  'solutions',
  'technologies',
  'systems',
  'cloud',
  'technical',
  'editorial',
  'privacy',
  'compliance',
  'support',
  'admin',
  'team'
]);

function normalizeCapturedPersonName(raw: string): string | null {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  while (words.length > 0 && NON_PERSON_WORDS.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  if (words.length < 2 || words.length > 3) return null;
  if (words.some((w) => NON_PERSON_WORDS.has(w.toLowerCase()))) return null;
  return words.join(' ');
}

function extractNamesFromText(text: string, knownNames: string[]): string[] {
  if (!text) return [];
  const found = new Set<string>();

  for (const candidate of knownNames) {
    const clean = candidate.trim();
    if (clean.length < 4 || !clean.includes(' ')) continue;
    const regex = new RegExp(`\\b${escapeRegExp(clean)}\\b`, 'g');
    if (regex.test(text)) {
      found.add(clean);
    }
  }

  let m: RegExpExecArray | null;
  PERSON_ATTRIBUTION_REGEX.lastIndex = 0;
  while ((m = PERSON_ATTRIBUTION_REGEX.exec(text)) !== null) {
    const cleaned = normalizeCapturedPersonName(m[1] || m[2] || '');
    if (cleaned && cleaned.length >= 4) {
      found.add(cleaned);
    }
  }

  return Array.from(found);
}

function replaceAllOccurrences(haystack: string, oldVal: string, newVal: string, caseInsensitive = false): string {
  if (!haystack || !oldVal) return haystack;
  const flags = caseInsensitive ? 'gi' : 'g';
  const rx = new RegExp(escapeRegExp(oldVal), flags);
  return haystack.replace(rx, newVal);
}

async function readIndexHtmlSafely(): Promise<string> {
  try {
    return await fs.readFile(path.resolve(process.cwd(), 'index.html'), 'utf8');
  } catch {
    return '';
  }
}

export async function scanAllContactsAndIdentities(
  userToken?: string,
  baseOrigin = 'https://git-stack.org'
): Promise<ContactScanSummary> {
  const [
    pages,
    posts,
    adSenseSettings,
    agentReportSettings,
    notifSettings,
    qaSettings,
    aiVisSettings,
    cyberSettings,
    scEmailConfig,
    mktEmailConfig,
    gtEmailConfig,
    userProfiles,
    integrations,
    indexHtml
  ] = await Promise.all([
    listPageContents(userToken).catch(() => [] as PageContentConfig[]),
    listPosts(true, userToken, true).catch(() => [] as Article[]),
    getAdSenseSettings(userToken).catch(() => null),
    getAgentReportSettings(userToken).catch(() => null),
    getAdminNotificationSettings(userToken).catch(() => null),
    getProductQaSettings(userToken).catch(() => null),
    getAiSearchVisibilitySettings(userToken).catch(() => null),
    getCyberSecuritySettings(userToken).catch(() => null),
    getGrowthModuleEmailConfig('search_console').catch(() => null),
    getGrowthModuleEmailConfig('marketing').catch(() => null),
    getGrowthModuleEmailConfig('google_trends').catch(() => null),
    listUserProfiles(userToken).catch(() => []),
    listIntegrationSecretStatuses(userToken).catch(() => []),
    readIndexHtmlSafely()
  ]);

  // Dynamically collect all known person names from articles + team users + leadership roster
  const knownNamesSet = new Set<string>([
    DEFAULT_PRINCIPAL_AUTHOR.name,
    'Rolan Molano',
    'Elena Vance',
    'Marcus Chen',
    'David Morales',
    'Sofia Alverez'
  ]);
  for (const post of posts) {
    if (post.author_name?.trim()) knownNamesSet.add(post.author_name.trim());
  }
  for (const profile of userProfiles) {
    if (profile.full_name?.trim()) knownNamesSet.add(profile.full_name.trim());
  }
  const knownNames = Array.from(knownNamesSet);

  const entries: ContactRegistryEntry[] = [];
  const dedup = new Set<string>();

  const pushEntry = (entry: Omit<ContactRegistryEntry, 'id'>) => {
    const valKey = entry.kind === 'email' ? entry.value.toLowerCase() : entry.value.trim();
    const key = `${entry.scope}|${entry.scopeId}|${entry.fieldPath}|${entry.kind}|${valKey}`;
    if (dedup.has(key) || !entry.value.trim()) return;
    dedup.add(key);
    entries.push({
      id: `cr-${entries.length + 1}-${Buffer.from(key).toString('base64url').slice(0, 14)}`,
      ...entry
    });
  };

  // 1. SCAN EVERY CMS PAGE (home, services, about, contact + any custom blocks / future pages)
  const scanPageTextField = (
    page: PageContentConfig,
    fieldPath: string,
    fieldLabel: string,
    text: string | undefined,
    explicitKind?: ContactEntityKind
  ) => {
    if (!text || !text.trim()) return;
    const meta = PAGE_LABELS[page.page_key] || {
      title: `${page.page_key} Page`,
      route: `/${page.page_key}`
    };

    if (explicitKind === 'email') {
      pushEntry({
        scope: 'page',
        scopeId: page.page_key,
        scopeTitle: meta.title,
        routeOrTab: meta.route,
        jumpTab: 'pages',
        fieldPath,
        fieldLabel,
        kind: 'email',
        value: text.trim(),
        contextSnippet: `${fieldLabel}: ${text.trim()}`,
        editable: true,
        updatedAt: page.updated_at || new Date().toISOString()
      });
      return;
    }

    if (explicitKind === 'phone') {
      pushEntry({
        scope: 'page',
        scopeId: page.page_key,
        scopeTitle: meta.title,
        routeOrTab: meta.route,
        jumpTab: 'pages',
        fieldPath,
        fieldLabel,
        kind: 'phone',
        value: text.trim(),
        contextSnippet: `${fieldLabel}: ${text.trim()}`,
        editable: true,
        updatedAt: page.updated_at || new Date().toISOString()
      });
      return;
    }

    for (const email of extractEmails(text)) {
      pushEntry({
        scope: 'page',
        scopeId: page.page_key,
        scopeTitle: meta.title,
        routeOrTab: meta.route,
        jumpTab: 'pages',
        fieldPath,
        fieldLabel,
        kind: 'email',
        value: email,
        contextSnippet: buildSnippet(text, email),
        editable: true,
        updatedAt: page.updated_at || new Date().toISOString()
      });
    }
    for (const phone of extractPhones(text)) {
      pushEntry({
        scope: 'page',
        scopeId: page.page_key,
        scopeTitle: meta.title,
        routeOrTab: meta.route,
        jumpTab: 'pages',
        fieldPath,
        fieldLabel,
        kind: 'phone',
        value: phone,
        contextSnippet: buildSnippet(text, phone),
        editable: true,
        updatedAt: page.updated_at || new Date().toISOString()
      });
    }
    for (const name of extractNamesFromText(text, knownNames)) {
      pushEntry({
        scope: 'page',
        scopeId: page.page_key,
        scopeTitle: meta.title,
        routeOrTab: meta.route,
        jumpTab: 'pages',
        fieldPath,
        fieldLabel,
        kind: 'name',
        value: name,
        contextSnippet: buildSnippet(text, name),
        editable: true,
        updatedAt: page.updated_at || new Date().toISOString()
      });
    }
  };

  for (const page of pages) {
    scanPageTextField(page, 'hero_kicker', 'Hero Kicker', page.hero_kicker);
    scanPageTextField(page, 'hero_title', 'Hero Title', page.hero_title);
    scanPageTextField(page, 'hero_subtitle', 'Hero Subtitle / Overview', page.hero_subtitle);
    scanPageTextField(page, 'intro_heading', 'Section Heading', page.intro_heading);
    scanPageTextField(page, 'intro_body', 'Section Body / Office Address', page.intro_body);

    if (page.contact_phone) {
      scanPageTextField(page, 'contact_phone', page.contact_phone_label || 'Direct Phone', page.contact_phone, 'phone');
    }
    if (page.contact_sales_email) {
      scanPageTextField(page, 'contact_sales_email', page.contact_sales_label || 'Channel 1 Email (Sales)', page.contact_sales_email, 'email');
    }
    if (page.contact_editorial_email) {
      scanPageTextField(page, 'contact_editorial_email', page.contact_editorial_label || 'Channel 2 Email (Editorial)', page.contact_editorial_email, 'email');
    }
    if (page.contact_privacy_email) {
      scanPageTextField(page, 'contact_privacy_email', page.contact_privacy_label || 'Channel 3 Email (Privacy)', page.contact_privacy_email, 'email');
    }

    if (Array.isArray(page.custom_blocks)) {
      page.custom_blocks.forEach((blk, idx) => {
        const prefix = `custom_blocks[${idx}]`;
        const blkTitle = blk.heading?.trim() || `Custom Block #${idx + 1}`;
        scanPageTextField(page, `${prefix}.heading`, `${blkTitle} Heading`, blk.heading);
        scanPageTextField(page, `${prefix}.body`, `${blkTitle} Body Copy`, blk.body);
      });
    }
  }

  // Also add Global Footer & Privacy Policy derived surface entries (backed by contact page fields!)
  const contactPage = pages.find((p) => p.page_key === 'contact');
  if (contactPage) {
    const footerEmail = contactPage.contact_sales_email?.trim() || 'contact@git-stack.org';
    const privacyEmail = contactPage.contact_privacy_email?.trim() || 'privacy@git-stack.org';
    const footerPhone = contactPage.contact_phone?.trim();

    pushEntry({
      scope: 'page',
      scopeId: 'contact',
      scopeTitle: 'Sitewide Footer & /llms-full.txt (Synced with Contact Channel 1)',
      routeOrTab: '/ (Footer)',
      jumpTab: 'pages',
      fieldPath: 'contact_sales_email',
      fieldLabel: 'Footer & LLMs Contact Email',
      kind: 'email',
      value: footerEmail,
      contextSnippet: `Rendered in sitewide Footer, /contact, and /llms-full.txt`,
      editable: true,
      editHint: 'Updates Channel 1 Email sitewide across Contact, Footer & SSR.',
      updatedAt: contactPage.updated_at || new Date().toISOString()
    });
    if (footerPhone) {
      pushEntry({
        scope: 'page',
        scopeId: 'contact',
        scopeTitle: 'Sitewide Footer & Consultation Line',
        routeOrTab: '/ (Footer)',
        jumpTab: 'pages',
        fieldPath: 'contact_phone',
        fieldLabel: 'Footer & Contact Phone',
        kind: 'phone',
        value: footerPhone,
        contextSnippet: `Rendered in Footer & /contact`,
        editable: true,
        editHint: 'Updates Direct Phone across Footer, Contact & SSR.',
        updatedAt: contactPage.updated_at || new Date().toISOString()
      });
    }
    pushEntry({
      scope: 'page',
      scopeId: 'contact',
      scopeTitle: 'Privacy Policy Page (/privacy-policy)',
      routeOrTab: '/privacy-policy',
      jumpTab: 'pages',
      fieldPath: 'contact_privacy_email',
      fieldLabel: 'GDPR / CCPA Privacy Request Email',
      kind: 'email',
      value: privacyEmail,
      contextSnippet: `Rendered on /privacy-policy & /contact`,
      editable: true,
      editHint: 'Updates Privacy Email across Privacy Policy, Contact & SSR.',
      updatedAt: contactPage.updated_at || new Date().toISOString()
    });
  }

  // Scan static index.html (Schema.org JSON-LD & fallback crawler HTML)
  if (indexHtml) {
    const nowIso = new Date().toISOString();
    for (const email of extractEmails(indexHtml)) {
      pushEntry({
        scope: 'page',
        scopeId: 'index_html',
        scopeTitle: 'index.html (Organization Schema & Crawler Shell)',
        routeOrTab: '/ (index.html)',
        jumpTab: 'ai_visibility',
        fieldPath: 'index_html_text',
        fieldLabel: 'Schema.org JSON-LD Email',
        kind: 'email',
        value: email,
        contextSnippet: buildSnippet(indexHtml, email),
        editable: false,
        editHint: 'Static build shell HTML metadata.',
        updatedAt: nowIso
      });
    }
    for (const phone of extractPhones(indexHtml)) {
      pushEntry({
        scope: 'page',
        scopeId: 'index_html',
        scopeTitle: 'index.html (Organization Schema & Crawler Shell)',
        routeOrTab: '/ (index.html)',
        jumpTab: 'ai_visibility',
        fieldPath: 'index_html_text',
        fieldLabel: 'Schema.org JSON-LD Telephone',
        kind: 'phone',
        value: phone,
        contextSnippet: buildSnippet(indexHtml, phone),
        editable: false,
        editHint: 'Static build shell HTML metadata.',
        updatedAt: nowIso
      });
    }
    for (const name of extractNamesFromText(indexHtml, knownNames)) {
      pushEntry({
        scope: 'page',
        scopeId: 'index_html',
        scopeTitle: 'index.html (Organization Schema & Author Card)',
        routeOrTab: '/ (index.html)',
        jumpTab: 'ai_visibility',
        fieldPath: 'index_html_text',
        fieldLabel: 'Founder / Principal Author Name',
        kind: 'name',
        value: name,
        contextSnippet: buildSnippet(indexHtml, name),
        editable: false,
        editHint: 'Static build shell HTML metadata.',
        updatedAt: nowIso
      });
    }
  }

  // 1B. SCAN ALL LIVE PUBLIC SSR PAGE ROUTES (catches newly added routes, Legal/Policy pages, About leadership, Demo, etc.)
  const ssrRoutesToScan = Array.from(PUBLIC_SSR_PATHS).filter((r) => r !== '/insights');
  const contactKnownEmails = new Set(
    [
      contactPage?.contact_sales_email,
      contactPage?.contact_editorial_email,
      contactPage?.contact_privacy_email
    ]
      .filter(Boolean)
      .map((v) => String(v).trim().toLowerCase())
  );
  const contactKnownPhone = contactPage?.contact_phone?.trim() || '';

  const ssrHtmlResults = ssrRoutesToScan.map((routePath) => ({
    routePath,
    html: buildPublicRouteMainHtml(routePath, baseOrigin, {
      pagesList: pages,
      postsList: posts,
      settings: (adSenseSettings || {
        adsense_publisher_id: '',
        ads_txt_content: '',
        auto_ads_enabled: false,
        ad_slots_enabled: false,
        editorial_review_note: '',
        updated_at: new Date().toISOString()
      })
    })
  }));

  for (const { routePath, html } of ssrHtmlResults) {
    if (!html) continue;
    const mainMatch = html.match(/<main[\s\S]*?<\/main>/i);
    const mainText = stripHtmlToPlainText(mainMatch ? mainMatch[0] : html);
    if (!mainText) continue;
    const nowIso = new Date().toISOString();
    const jumpTab: WorkspaceModuleId =
      routePath === '/' || routePath === '/services' || routePath === '/about' || routePath === '/contact'
        ? 'pages'
        : 'ai_visibility';

    for (const email of extractEmails(mainText)) {
      if (routePath === '/contact' && contactKnownEmails.has(email.toLowerCase())) continue;
      if (
        routePath === '/privacy-policy' &&
        email.toLowerCase() === (contactPage?.contact_privacy_email?.trim().toLowerCase() || '')
      ) {
        continue;
      }
      pushEntry({
        scope: 'page',
        scopeId: `route:${routePath}`,
        scopeTitle: `Rendered Route (${routePath})`,
        routeOrTab: routePath,
        jumpTab,
        fieldPath: 'rendered_html_main',
        fieldLabel: 'Rendered Page Email',
        kind: 'email',
        value: email,
        contextSnippet: buildSnippet(mainText, email),
        editable: false,
        editHint: 'Detected in live route HTML template.',
        updatedAt: nowIso
      });
    }

    for (const phone of extractPhones(mainText)) {
      if (routePath === '/contact' && contactKnownPhone && phone === contactKnownPhone) continue;
      pushEntry({
        scope: 'page',
        scopeId: `route:${routePath}`,
        scopeTitle: `Rendered Route (${routePath})`,
        routeOrTab: routePath,
        jumpTab,
        fieldPath: 'rendered_html_main',
        fieldLabel: 'Rendered Page Phone',
        kind: 'phone',
        value: phone,
        contextSnippet: buildSnippet(mainText, phone),
        editable: false,
        editHint: 'Detected in live route HTML template.',
        updatedAt: nowIso
      });
    }

    for (const name of extractNamesFromText(mainText, knownNames)) {
      pushEntry({
        scope: 'page',
        scopeId: `route:${routePath}`,
        scopeTitle: `Rendered Route (${routePath})`,
        routeOrTab: routePath,
        jumpTab,
        fieldPath: 'rendered_html_main',
        fieldLabel: 'Detected Contact / Leadership / Author Name',
        kind: 'name',
        value: name,
        contextSnippet: buildSnippet(mainText, name),
        editable: false,
        editHint: 'Detected in rendered page content.',
        updatedAt: nowIso
      });
    }
  }

  // 2. SCAN EVERY ARTICLE / POST (Author metadata + full markdown/TLDR/FAQs)
  for (const post of posts) {
    const route = `/insights/${post.slug}`;
    const updatedAt = post.updated_at || post.created_at || new Date().toISOString();

    if (post.author_name?.trim()) {
      pushEntry({
        scope: 'article',
        scopeId: post.slug,
        scopeTitle: post.title,
        routeOrTab: route,
        jumpTab: 'articles',
        fieldPath: 'author_name',
        fieldLabel: 'Author Name',
        kind: 'name',
        value: post.author_name.trim(),
        contextSnippet: `${post.author_name.trim()} · ${post.author_role || post.status}`,
        editable: true,
        updatedAt
      });
    }

    const articleFields: Array<{ path: string; label: string; text: string }> = [
      { path: 'author_role', label: 'Author Role', text: post.author_role || '' },
      { path: 'author_bio', label: 'Author Bio', text: post.author_bio || '' },
      { path: 'summary_tldr', label: 'Executive Summary (TL;DR)', text: post.summary_tldr || '' },
      { path: 'meta_description', label: 'Meta Description', text: post.meta_description || '' },
      { path: 'content_markdown', label: 'Article Body Markdown', text: post.content_markdown || '' },
      {
        path: 'faqs',
        label: 'Article FAQs',
        text: Array.isArray(post.faqs)
          ? post.faqs.map((f) => `${f.question} ${f.answer}`).join('\n')
          : ''
      }
    ];

    for (const f of articleFields) {
      if (!f.text) continue;
      for (const email of extractEmails(f.text)) {
        pushEntry({
          scope: 'article',
          scopeId: post.slug,
          scopeTitle: post.title,
          routeOrTab: route,
          jumpTab: 'articles',
          fieldPath: f.path,
          fieldLabel: f.label,
          kind: 'email',
          value: email,
          contextSnippet: buildSnippet(f.text, email),
          editable: true,
          updatedAt
        });
      }
      for (const phone of extractPhones(f.text)) {
        pushEntry({
          scope: 'article',
          scopeId: post.slug,
          scopeTitle: post.title,
          routeOrTab: route,
          jumpTab: 'articles',
          fieldPath: f.path,
          fieldLabel: f.label,
          kind: 'phone',
          value: phone,
          contextSnippet: buildSnippet(f.text, phone),
          editable: true,
          updatedAt
        });
      }
      for (const name of extractNamesFromText(f.text, knownNames)) {
        pushEntry({
          scope: 'article',
          scopeId: post.slug,
          scopeTitle: post.title,
          routeOrTab: route,
          jumpTab: 'articles',
          fieldPath: f.path,
          fieldLabel: f.label,
          kind: 'name',
          value: name,
          contextSnippet: buildSnippet(f.text, name),
          editable: true,
          updatedAt
        });
      }
    }
  }

  // 3. SCAN BACK OFFICE MODULES & TEAM PROFILES
  let modulesScanned = 0;

  const moduleEmailTargets: Array<{
    scopeId: string;
    scopeTitle: string;
    jumpTab: WorkspaceModuleId;
    fieldLabel: string;
    email?: string;
    updatedAt?: string;
  }> = [
    {
      scopeId: 'growth:search_console',
      scopeTitle: 'Search Console & SEO',
      jumpTab: 'search_console',
      fieldLabel: 'Audit Report Recipient Email',
      email: scEmailConfig?.recipient_email,
      updatedAt: scEmailConfig?.updated_at
    },
    {
      scopeId: 'growth:marketing',
      scopeTitle: 'Marketing & Social Studio',
      jumpTab: 'marketing',
      fieldLabel: 'Campaign Digest Recipient Email',
      email: mktEmailConfig?.recipient_email,
      updatedAt: mktEmailConfig?.updated_at
    },
    {
      scopeId: 'growth:google_trends',
      scopeTitle: 'Google Trends Agent',
      jumpTab: 'google_trends',
      fieldLabel: 'Trend Alert Recipient Email',
      email: gtEmailConfig?.recipient_email,
      updatedAt: gtEmailConfig?.updated_at
    },
    {
      scopeId: 'module:agent_reports',
      scopeTitle: 'Overview & 7 Agents',
      jumpTab: 'agents',
      fieldLabel: 'Daily 7-Agent Brief Recipient Email',
      email: agentReportSettings?.recipient_email,
      updatedAt: agentReportSettings?.updated_at
    },
    {
      scopeId: 'module:notifications',
      scopeTitle: 'Notifications & Alerts',
      jumpTab: 'notifications',
      fieldLabel: 'Lead & Live Chat Alert Recipient Email',
      email: notifSettings?.recipient_email,
      updatedAt: notifSettings?.updated_at
    },
    {
      scopeId: 'module:qa',
      scopeTitle: 'Product QA & Logs',
      jumpTab: 'qa',
      fieldLabel: 'EOD QA Report Recipient Email',
      email: qaSettings?.recipient_email,
      updatedAt: qaSettings?.updated_at
    },
    {
      scopeId: 'module:ai_visibility',
      scopeTitle: 'AI & Search Visibility',
      jumpTab: 'ai_visibility',
      fieldLabel: 'AI Visibility Report Recipient Email',
      email: aiVisSettings?.recipient_email,
      updatedAt: aiVisSettings?.updated_at
    },
    {
      scopeId: 'module:cybersecurity',
      scopeTitle: 'Cybersecurity & AI Sentinel',
      jumpTab: 'cybersecurity',
      fieldLabel: 'CyberSec Daily Report Recipient Email',
      email: cyberSettings?.recipient_email,
      updatedAt: cyberSettings?.updated_at
    }
  ];

  for (const mod of moduleEmailTargets) {
    modulesScanned += 1;
    if (mod.email?.trim()) {
      pushEntry({
        scope: 'module',
        scopeId: mod.scopeId,
        scopeTitle: mod.scopeTitle,
        routeOrTab: `/obama (${mod.jumpTab})`,
        jumpTab: mod.jumpTab,
        fieldPath: 'recipient_email',
        fieldLabel: mod.fieldLabel,
        kind: 'email',
        value: mod.email.trim(),
        contextSnippet: `${mod.fieldLabel}: ${mod.email.trim()}`,
        editable: true,
        updatedAt: mod.updatedAt || new Date().toISOString()
      });
    }
  }

  // Lark Mail SMTP Sender Identity from Vault
  const larkStatus = integrations.find((i) => i.provider === 'lark_smtp');
  if (larkStatus) {
    modulesScanned += 1;
    if (larkStatus.configMeta?.email) {
      pushEntry({
        scope: 'module',
        scopeId: 'vault:lark_smtp',
        scopeTitle: 'Settings & Integrations (Lark SMTP Vault)',
        routeOrTab: '/obama (adsense)',
        jumpTab: 'adsense',
        fieldPath: 'config_meta.email',
        fieldLabel: 'Outbound SMTP Sender Email',
        kind: 'email',
        value: larkStatus.configMeta.email,
        contextSnippet: `${larkStatus.configured ? 'Configured' : 'Saved'} in Vault: ${larkStatus.configMeta.email}`,
        editable: false,
        editHint: 'Manage SMTP credentials securely inside Settings & Integrations Vault.',
        updatedAt: new Date().toISOString()
      });
    }
    if (larkStatus.configMeta?.sender_name) {
      pushEntry({
        scope: 'module',
        scopeId: 'vault:lark_smtp',
        scopeTitle: 'Settings & Integrations (Lark SMTP Vault)',
        routeOrTab: '/obama (adsense)',
        jumpTab: 'adsense',
        fieldPath: 'config_meta.sender_name',
        fieldLabel: 'Outbound SMTP Sender Name',
        kind: 'name',
        value: larkStatus.configMeta.sender_name,
        contextSnippet: `SMTP Display Name: ${larkStatus.configMeta.sender_name}`,
        editable: false,
        editHint: 'Manage SMTP sender name securely inside Settings & Integrations Vault.',
        updatedAt: new Date().toISOString()
      });
    }
  }

  // AdSense / Branding editorial review note if it contains contact data
  if (adSenseSettings?.editorial_review_note) {
    modulesScanned += 1;
    for (const email of extractEmails(adSenseSettings.editorial_review_note)) {
      pushEntry({
        scope: 'module',
        scopeId: 'module:adsense',
        scopeTitle: 'Settings & Integrations (AdSense Review)',
        routeOrTab: '/obama (adsense)',
        jumpTab: 'adsense',
        fieldPath: 'editorial_review_note',
        fieldLabel: 'Editorial Review Note Email',
        kind: 'email',
        value: email,
        contextSnippet: buildSnippet(adSenseSettings.editorial_review_note, email),
        editable: false,
        editHint: 'Edit in Settings & Integrations.',
        updatedAt: adSenseSettings.updated_at || new Date().toISOString()
      });
    }
  }

  // Team User Profiles
  for (const user of userProfiles) {
    modulesScanned += 1;
    const updatedAt = user.updated_at || user.created_at || new Date().toISOString();
    if (user.email?.trim()) {
      pushEntry({
        scope: 'module',
        scopeId: `user:${user.user_id}`,
        scopeTitle: `Team Member (${user.full_name || user.email})`,
        routeOrTab: '/obama (users)',
        jumpTab: 'users',
        fieldPath: 'email',
        fieldLabel: `Auth Login Email (${user.role})`,
        kind: 'email',
        value: user.email.trim(),
        contextSnippet: `${user.full_name || 'Operator'} · ${user.role} · ${user.status}`,
        editable: false,
        editHint: 'Auth emails are managed inside User Access / Supabase Auth.',
        updatedAt
      });
    }
    if (user.full_name?.trim()) {
      pushEntry({
        scope: 'module',
        scopeId: `user:${user.user_id}`,
        scopeTitle: `Team Member (${user.email})`,
        routeOrTab: '/obama (users)',
        jumpTab: 'users',
        fieldPath: 'full_name',
        fieldLabel: `Team Display Name (${user.role})`,
        kind: 'name',
        value: user.full_name.trim(),
        contextSnippet: `${user.job_title || user.role} · ${user.email}`,
        editable: true,
        updatedAt
      });
    }
    if (user.phone?.trim()) {
      pushEntry({
        scope: 'module',
        scopeId: `user:${user.user_id}`,
        scopeTitle: `Team Member (${user.full_name || user.email})`,
        routeOrTab: '/obama (users)',
        jumpTab: 'users',
        fieldPath: 'phone',
        fieldLabel: 'Profile Phone',
        kind: 'phone',
        value: user.phone.trim(),
        contextSnippet: `${user.full_name || user.email} · ${user.phone.trim()}`,
        editable: false,
        editHint: 'Update personal phone inside My Profile.',
        updatedAt
      });
    }
  }

  const buildUniqueList = (kind: ContactEntityKind) => {
    const map = new Map<string, { value: string; count: number; scopes: Set<ContactRegistryScope> }>();
    for (const e of entries) {
      if (e.kind !== kind) continue;
      const key = kind === 'email' ? e.value.toLowerCase() : e.value.trim();
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.scopes.add(e.scope);
      } else {
        map.set(key, { value: e.value, count: 1, scopes: new Set([e.scope]) });
      }
    }
    return Array.from(map.values())
      .map((item) => ({
        value: item.value,
        count: item.count,
        scopes: Array.from(item.scopes)
      }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  };

  return {
    scannedAt: new Date().toISOString(),
    totalEntries: entries.length,
    emailsCount: entries.filter((e) => e.kind === 'email').length,
    phonesCount: entries.filter((e) => e.kind === 'phone').length,
    namesCount: entries.filter((e) => e.kind === 'name').length,
    pagesScanned: pages.length + ssrRoutesToScan.length + (indexHtml ? 1 : 0),
    articlesScanned: posts.length,
    modulesScanned,
    uniqueEmails: buildUniqueList('email'),
    uniquePhones: buildUniqueList('phone'),
    uniqueNames: buildUniqueList('name'),
    entries
  };
}

export async function updateContactRegistryEntry(
  input: {
    scope: ContactRegistryScope;
    scopeId: string;
    fieldPath: string;
    oldValue: string;
    newValue: string;
    kind: ContactEntityKind;
  },
  actorUserId: string,
  userToken?: string
): Promise<{ updated: boolean; detail: string; summary: ContactScanSummary }> {
  const newVal = input.newValue.trim();
  const oldVal = input.oldValue.trim();
  if (!newVal) {
    throw new Error('New value cannot be empty.');
  }
  if (input.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newVal)) {
    throw new Error(`Invalid email format: "${newVal}".`);
  }

  let detail = '';

  if (input.scope === 'page') {
    const pages = await listPageContents(userToken);
    const page = pages.find((p) => p.page_key === input.scopeId);
    if (!page) {
      throw new Error(`Page "${input.scopeId}" is static or not found in CMS.`);
    }

    const updatedPage: PageContentConfig = {
      ...page,
      custom_blocks: Array.isArray(page.custom_blocks)
        ? page.custom_blocks.map((b) => ({ ...b }))
        : [],
      updated_at: new Date().toISOString()
    };

    const directPageFields = new Set([
      'contact_phone',
      'contact_sales_email',
      'contact_editorial_email',
      'contact_privacy_email'
    ]);

    if (directPageFields.has(input.fieldPath)) {
      (updatedPage as unknown as Record<string, unknown>)[input.fieldPath] = newVal;
    } else if (input.fieldPath.startsWith('custom_blocks[')) {
      const m = input.fieldPath.match(/^custom_blocks\[(\d+)\]\.(heading|body)$/);
      if (!m) throw new Error(`Unsupported page block path "${input.fieldPath}".`);
      const idx = Number(m[1]);
      const prop = m[2] as 'heading' | 'body';
      if (!updatedPage.custom_blocks[idx]) {
        throw new Error(`Custom block #${idx + 1} no longer exists.`);
      }
      updatedPage.custom_blocks[idx][prop] = replaceAllOccurrences(
        updatedPage.custom_blocks[idx][prop],
        oldVal,
        newVal,
        input.kind === 'email'
      );
    } else if (
      input.fieldPath === 'hero_kicker' ||
      input.fieldPath === 'hero_title' ||
      input.fieldPath === 'hero_subtitle' ||
      input.fieldPath === 'intro_heading' ||
      input.fieldPath === 'intro_body'
    ) {
      const curText = updatedPage[input.fieldPath] || '';
      updatedPage[input.fieldPath] =
        curText.trim() === oldVal
          ? newVal
          : replaceAllOccurrences(curText, oldVal, newVal, input.kind === 'email');
    } else {
      throw new Error(`Field "${input.fieldPath}" on page "${input.scopeId}" is not editable.`);
    }

    await upsertPageContent(updatedPage, userToken);
    detail = `Updated ${input.fieldPath} on ${page.page_key} page.`;
  } else if (input.scope === 'article') {
    const existing = await getPostBySlug(input.scopeId, true, userToken);
    if (!existing) {
      throw new Error(`Article "${input.scopeId}" not found.`);
    }
    const updatedArticle: Article = {
      ...existing,
      faqs: Array.isArray(existing.faqs) ? existing.faqs.map((f) => ({ ...f })) : [],
      references: Array.isArray(existing.references) ? existing.references.map((r) => ({ ...r })) : [],
      updated_at: new Date().toISOString()
    };

    if (input.fieldPath === 'author_name') {
      updatedArticle.author_name = newVal;
    } else if (
      input.fieldPath === 'author_role' ||
      input.fieldPath === 'author_bio' ||
      input.fieldPath === 'summary_tldr' ||
      input.fieldPath === 'meta_description' ||
      input.fieldPath === 'content_markdown'
    ) {
      const curText = updatedArticle[input.fieldPath] || '';
      updatedArticle[input.fieldPath] =
        curText.trim() === oldVal
          ? newVal
          : replaceAllOccurrences(curText, oldVal, newVal, input.kind === 'email');
    } else if (input.fieldPath === 'faqs') {
      updatedArticle.faqs = updatedArticle.faqs.map((f) => ({
        question: replaceAllOccurrences(f.question, oldVal, newVal, input.kind === 'email'),
        answer: replaceAllOccurrences(f.answer, oldVal, newVal, input.kind === 'email')
      }));
    } else {
      throw new Error(`Field "${input.fieldPath}" on article "${existing.title}" is not editable.`);
    }

    await upsertPost(updatedArticle, userToken);
    detail = `Updated ${input.fieldPath} on article "${existing.title}".`;
  } else if (input.scope === 'module') {
    if (input.scopeId.startsWith('growth:')) {
      const mod = input.scopeId.slice('growth:'.length) as GrowthModuleKey;
      await saveGrowthModuleEmailConfig(mod, { recipient_email: newVal });
      detail = `Updated recipient email for ${mod}.`;
    } else if (input.scopeId === 'module:agent_reports') {
      const cur = await getAgentReportSettings(userToken);
      await saveAgentReportSettings(
        { ...cur, recipient_email: newVal, updated_at: new Date().toISOString() },
        userToken
      );
      detail = 'Updated Daily 7-Agent Report recipient email.';
    } else if (input.scopeId === 'module:notifications') {
      const cur = await getAdminNotificationSettings(userToken);
      await saveAdminNotificationSettings({ ...cur, recipient_email: newVal }, userToken);
      detail = 'Updated Notifications & Live Chat alert recipient email.';
    } else if (input.scopeId === 'module:qa') {
      await saveProductQaSettings({ recipient_email: newVal }, userToken);
      detail = 'Updated Product QA EOD report recipient email.';
    } else if (input.scopeId === 'module:ai_visibility') {
      await saveAiSearchVisibilitySettings({ recipient_email: newVal }, userToken);
      detail = 'Updated AI & Search Visibility recipient email.';
    } else if (input.scopeId === 'module:cybersecurity') {
      await saveCyberSecuritySettings({ recipient_email: newVal }, userToken);
      detail = 'Updated Cybersecurity Sentinel recipient email.';
    } else if (input.scopeId.startsWith('user:')) {
      const targetUserId = input.scopeId.slice('user:'.length);
      if (input.fieldPath !== 'full_name') {
        throw new Error('Only team member display names can be renamed directly here.');
      }
      await updateTeamUser(targetUserId, actorUserId, { full_name: newVal }, userToken);
      detail = `Updated team user display name to "${newVal}".`;
    } else {
      throw new Error(`Module "${input.scopeId}" is read-only from the registry.`);
    }
  }

  const summary = await scanAllContactsAndIdentities(userToken);
  return { updated: true, detail, summary };
}

export async function bulkReplaceContactValue(
  input: {
    oldValue: string;
    newValue: string;
    scopes?: ContactRegistryScope[];
    kind?: ContactEntityKind;
  },
  actorUserId: string,
  userToken?: string
): Promise<{ updatedCount: number; updatedItems: string[]; summary: ContactScanSummary }> {
  const oldVal = input.oldValue.trim();
  const newVal = input.newValue.trim();
  if (!oldVal || !newVal) {
    throw new Error('Both "Find value" and "Replace with" are required.');
  }
  if (oldVal === newVal) {
    throw new Error('Replacement value must differ from existing value.');
  }
  if (input.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newVal)) {
    throw new Error(`Invalid replacement email address: "${newVal}".`);
  }

  const initial = await scanAllContactsAndIdentities(userToken);
  const scopeSet = input.scopes && input.scopes.length > 0 ? new Set(input.scopes) : null;

  const targets = initial.entries.filter((e) => {
    if (!e.editable) return false;
    if (scopeSet && !scopeSet.has(e.scope)) return false;
    if (input.kind && e.kind !== input.kind) return false;
    if (e.kind === 'email') return e.value.toLowerCase() === oldVal.toLowerCase();
    return e.value === oldVal;
  });

  const updatedItems: string[] = [];
  const handledOps = new Set<string>();

  for (const t of targets) {
    const opKey = `${t.scope}|${t.scopeId}|${t.fieldPath}`;
    if (handledOps.has(opKey)) continue;
    handledOps.add(opKey);
    const res = await updateContactRegistryEntry(
      {
        scope: t.scope,
        scopeId: t.scopeId,
        fieldPath: t.fieldPath,
        oldValue: t.value,
        newValue: newVal,
        kind: t.kind
      },
      actorUserId,
      userToken
    );
    if (res.updated) {
      updatedItems.push(`${t.scopeTitle} (${t.fieldLabel})`);
    }
  }

  const summary = await scanAllContactsAndIdentities(userToken);
  return {
    updatedCount: updatedItems.length,
    updatedItems,
    summary
  };
}
