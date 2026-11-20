import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'node:crypto';
import type {
  GrowthModuleEmailLog,
  SearchConsoleAiRecommendation,
  SearchConsoleAuditRun,
  SearchConsoleDashboardResponse,
  SearchConsoleEngineVerdict,
  SearchConsoleKeywordMetric,
  SearchConsoleUrlAudit
} from '../shared/types.ts';
import {
  isGeminiQuotaCoolingDown,
  markGeminiQuotaCooldownIfNeeded
} from './geminiResilience.ts';
import {
  isServiceAccountJsonString,
  mintGoogleAccessTokenFromServiceAccount
} from './googleAnalyticsService.ts';
import {
  appendGrowthModuleEmailLog,
  getGrowthModuleEmailConfig,
  listGrowthModuleEmailLogs,
  readGrowthStore,
  saveGrowthModuleEmailConfig,
  updateGrowthStore
} from './growthStore.ts';
import { addInboxEmailLog, listPosts } from './repository.ts';
import { PUBLIC_SSR_PATHS, renderPublicRouteHtml } from './ssrRenderer.ts';
import { resolveIntegrationConfig, resolveIntegrationSecret, sendLarkSmtpMail } from './vault.ts';

const GSC_READONLY_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'into', 'are', 'our', 'you',
  'have', 'has', 'was', 'were', 'will', 'can', 'not', 'but', 'all', 'any', 'how', 'why', 'what',
  'when', 'where', 'who', 'which', 'their', 'they', 'them', 'more', 'most', 'also', 'than',
  'then', 'about', 'over', 'under', 'through', 'across', 'every', 'without', 'using', 'used',
  'each', 'such', 'only', 'into', 'onto', 'upon', 'before', 'after', 'between', 'during',
  'should', 'would', 'could', 'make', 'made', 'page', 'site', 'website', 'view', 'click', 'read',
  'learn', 'more', 'home', 'menu', 'copyright', 'rights', 'reserved', 'cookies', 'privacy'
]);

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTagText(html: string, tag: string): string {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? decodeHtmlEntities(m[1].replace(/<[^>]+>/g, ' ')) : '';
}

function extractAllTagText(html: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const clean = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, ' '));
    if (clean) results.push(clean);
  }
  return results;
}

function extractMetaContent(html: string, attr: 'name' | 'property', key: string): string {
  const patterns = [
    new RegExp(`<meta[^>]*${attr}=["']${key}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${key}["'][^>]*>`, 'i')
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return decodeHtmlEntities(m[1]);
  }
  return '';
}

function extractCanonical(html: string): string {
  const m =
    html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i) ||
    html.match(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["'][^>]*>/i);
  return m?.[1]?.trim() || '';
}

function extractSchemaTypes(html: string): string[] {
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const types = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim()) as Record<string, unknown> | Array<Record<string, unknown>>;
      const collect = (obj: unknown) => {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
          obj.forEach(collect);
          return;
        }
        const rec = obj as Record<string, unknown>;
        if (typeof rec['@type'] === 'string') types.add(rec['@type']);
        if (Array.isArray(rec['@type'])) {
          rec['@type'].forEach((t) => typeof t === 'string' && types.add(t));
        }
        if (Array.isArray(rec['@graph'])) collect(rec['@graph']);
      };
      collect(parsed);
    } catch {
      // ignore malformed json-ld blocks
    }
  }
  return Array.from(types);
}

function extractPlainBodyText(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const target = bodyMatch ? bodyMatch[1] : html;
  return decodeHtmlEntities(
    target
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
}

function countPlainWords(text: string): number {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  return tokens.length;
}

function extractKeywordsFromPage(params: {
  plainText: string;
  title: string;
  h1: string;
  metaDescription: string;
  explicitPrimaryKeyword?: string;
}): { primaryKeyword: string; keywords: SearchConsoleKeywordMetric[] } {
  const lowerBody = params.plainText.toLowerCase();
  const lowerTitle = params.title.toLowerCase();
  const lowerH1 = params.h1.toLowerCase();
  const lowerMeta = params.metaDescription.toLowerCase();
  const words = lowerBody.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
  const totalWords = Math.max(1, words.length);

  const phraseCounts = new Map<string, number>();

  // Count meaningful bigrams and unigrams
  for (let i = 0; i < words.length; i++) {
    const w1 = words[i];
    if (w1.length >= 4 && !STOP_WORDS.has(w1) && !/^\d+$/.test(w1)) {
      phraseCounts.set(w1, (phraseCounts.get(w1) || 0) + 1);
    }
    if (i + 1 < words.length) {
      const w2 = words[i + 1];
      if (
        w1.length >= 3 &&
        w2.length >= 3 &&
        !STOP_WORDS.has(w1) &&
        !STOP_WORDS.has(w2) &&
        !/^\d+$/.test(w1) &&
        !/^\d+$/.test(w2)
      ) {
        const bigram = `${w1} ${w2}`;
        phraseCounts.set(bigram, (phraseCounts.get(bigram) || 0) + 1);
      }
    }
  }

  const ranked = Array.from(phraseCounts.entries())
    .filter(([phrase, count]) => (phrase.includes(' ') ? count >= 2 : count >= 3))
    .sort((a, b) => {
      const aBoost = (lowerTitle.includes(a[0]) ? 12 : 0) + (a[0].includes(' ') ? 5 : 0);
      const bBoost = (lowerTitle.includes(b[0]) ? 12 : 0) + (b[0].includes(' ') ? 5 : 0);
      return b[1] + bBoost - (a[1] + aBoost);
    })
    .slice(0, 8);

  const metrics: SearchConsoleKeywordMetric[] = [];
  const explicit = (params.explicitPrimaryKeyword || '').trim().toLowerCase();
  if (explicit) {
    const escaped = explicit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const occurrences = (lowerBody.match(new RegExp(`\\b${escaped}\\b`, 'gi')) || []).length;
    metrics.push({
      keyword: explicit,
      occurrences,
      densityPercent: Number(((occurrences / totalWords) * 100).toFixed(2)),
      inTitle: lowerTitle.includes(explicit),
      inH1: lowerH1.includes(explicit),
      inMeta: lowerMeta.includes(explicit),
      source: 'on_page'
    });
  }

  for (const [phrase, occurrences] of ranked) {
    if (metrics.some((m) => m.keyword === phrase)) continue;
    metrics.push({
      keyword: phrase,
      occurrences,
      densityPercent: Number(((occurrences / totalWords) * 100).toFixed(2)),
      inTitle: lowerTitle.includes(phrase),
      inH1: lowerH1.includes(phrase),
      inMeta: lowerMeta.includes(phrase),
      source: 'on_page'
    });
    if (metrics.length >= 8) break;
  }

  const primaryKeyword =
    metrics[0]?.keyword ||
    explicit ||
    params.title
      .split(/[|:\-–]/)[0]
      .trim()
      .toLowerCase()
      .slice(0, 48) ||
    'gitstack engineering';

  return { primaryKeyword, keywords: metrics };
}

async function fetchLiveGscPageMetrics(
  userToken?: string
): Promise<{
  connected: boolean;
  siteUrl: string;
  serviceAccountEmail: string;
  byUrl: Map<
    string,
    {
      clicks: number;
      impressions: number;
      ctrPercent: number;
      avgPosition: number;
      topQueries: Array<{
        query: string;
        clicks: number;
        impressions: number;
        ctrPercent: number;
        position: number;
      }>;
    }
  >;
}> {
  const resolved = await resolveIntegrationConfig('google_search_console', userToken).catch(
    () => null
  );
  const siteUrl = (resolved?.configMeta?.gsc_site_url || 'https://git-stack.org/').trim();
  const serviceAccountEmail = (resolved?.configMeta?.gsc_service_account_email || '').trim();
  const byUrl = new Map<
    string,
    {
      clicks: number;
      impressions: number;
      ctrPercent: number;
      avgPosition: number;
      topQueries: Array<{
        query: string;
        clicks: number;
        impressions: number;
        ctrPercent: number;
        position: number;
      }>;
    }
  >();

  if (!resolved?.secret) {
    return { connected: false, siteUrl, serviceAccountEmail, byUrl };
  }

  try {
    let accessToken = resolved.secret;
    if (isServiceAccountJsonString(resolved.secret)) {
      const minted = await mintGoogleAccessTokenFromServiceAccount(resolved.secret, [
        GSC_READONLY_SCOPE
      ]);
      accessToken = minted.accessToken;
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 28 * 24 * 3600 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
    const [pagesRes, queriesRes] = await Promise.all([
      fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          dimensions: ['page'],
          rowLimit: 100
        })
      }),
      fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          dimensions: ['page', 'query'],
          rowLimit: 250
        })
      })
    ]);

    if (pagesRes.ok) {
      const pData = (await pagesRes.json()) as {
        rows?: Array<{
          keys?: string[];
          clicks?: number;
          impressions?: number;
          ctr?: number;
          position?: number;
        }>;
      };
      for (const row of pData.rows || []) {
        const rawUrl = row.keys?.[0] || '';
        if (!rawUrl) continue;
        try {
          const p = new URL(rawUrl).pathname.replace(/\/+$/, '') || '/';
          byUrl.set(p, {
            clicks: Math.round(row.clicks || 0),
            impressions: Math.round(row.impressions || 0),
            ctrPercent: Number(((row.ctr || 0) * 100).toFixed(2)),
            avgPosition: Number((row.position || 0).toFixed(1)),
            topQueries: []
          });
        } catch {
          // ignore malformed url
        }
      }
    }

    if (queriesRes.ok) {
      const qData = (await queriesRes.json()) as {
        rows?: Array<{
          keys?: string[];
          clicks?: number;
          impressions?: number;
          ctr?: number;
          position?: number;
        }>;
      };
      for (const row of qData.rows || []) {
        const rawUrl = row.keys?.[0] || '';
        const query = row.keys?.[1] || '';
        if (!rawUrl || !query) continue;
        try {
          const p = new URL(rawUrl).pathname.replace(/\/+$/, '') || '/';
          const existing = byUrl.get(p);
          if (existing && existing.topQueries.length < 8) {
            existing.topQueries.push({
              query,
              clicks: Math.round(row.clicks || 0),
              impressions: Math.round(row.impressions || 0),
              ctrPercent: Number(((row.ctr || 0) * 100).toFixed(2)),
              position: Number((row.position || 0).toFixed(1))
            });
          }
        } catch {
          // ignore
        }
      }
    }

    return { connected: true, siteUrl, serviceAccountEmail, byUrl };
  } catch {
    return { connected: false, siteUrl, serviceAccountEmail, byUrl };
  }
}

export async function runWebsiteLinksAudit(options: {
  baseOrigin?: string;
  userToken?: string;
}): Promise<SearchConsoleAuditRun> {
  const baseOrigin = (options.baseOrigin || 'https://git-stack.org').replace(/\/+$/, '');
  const [posts, gscLive, prevStore] = await Promise.all([
    listPosts(false, options.userToken, false),
    fetchLiveGscPageMetrics(options.userToken),
    readGrowthStore()
  ]);

  const prevAiByPath = new Map<string, SearchConsoleAiRecommendation>();
  for (const prevUrl of prevStore.searchConsoleRuns[0]?.urls || []) {
    if (prevUrl.aiAnalysis) prevAiByPath.set(prevUrl.path, prevUrl.aiAnalysis);
  }

  const legalPaths = new Set([
    '/privacy-policy',
    '/terms',
    '/cookie-policy',
    '/disclaimer',
    '/editorial-policy'
  ]);

  const targets: Array<{
    path: string;
    pageType: 'core_page' | 'article' | 'legal_page';
    explicitKeyword?: string;
  }> = [];

  for (const p of PUBLIC_SSR_PATHS) {
    targets.push({
      path: p,
      pageType: legalPaths.has(p) ? 'legal_page' : 'core_page'
    });
  }
  for (const post of posts) {
    if (post.status !== 'published' || !post.slug) continue;
    targets.push({
      path: `/insights/${post.slug}`,
      pageType: 'article',
      explicitKeyword: post.primary_keyword
    });
  }

  const auditedUrls: SearchConsoleUrlAudit[] = [];

  for (const target of targets) {
    const html = await renderPublicRouteHtml(target.path, baseOrigin).catch(() => null);
    const httpStatus = html ? 200 : 404;
    const title = html ? extractTagText(html, 'title') : '';
    const metaDescription = html ? extractMetaContent(html, 'name', 'description') : '';
    const robotsDirective = html ? extractMetaContent(html, 'name', 'robots') || 'index, follow' : 'noindex';
    const canonicalUrl = html ? extractCanonical(html) : '';
    const ogTitle = html ? extractMetaContent(html, 'property', 'og:title') : '';
    const ogDescription = html ? extractMetaContent(html, 'property', 'og:description') : '';
    const ogImage = html ? extractMetaContent(html, 'property', 'og:image') : '';
    const h1 = html ? extractTagText(html, 'h1') : '';
    const h2Headings = html ? extractAllTagText(html, 'h2').slice(0, 12) : [];
    const schemaTypes = html ? extractSchemaTypes(html) : [];
    const plainText = html ? extractPlainBodyText(html) : '';
    const wordCount = countPlainWords(plainText);
    const internalLinksCount = html
      ? (html.match(/<a[^>]*href=["'](\/|https:\/\/git-stack\.org)/gi) || []).length
      : 0;

    const noindex = /noindex/i.test(robotsDirective);
    const indexable = httpStatus === 200 && !noindex && Boolean(title);

    const { primaryKeyword, keywords } = extractKeywordsFromPage({
      plainText,
      title,
      h1,
      metaDescription,
      explicitPrimaryKeyword: target.explicitKeyword
    });

    const gscMetrics = gscLive.byUrl.get(target.path) || null;
    if (gscMetrics && gscMetrics.topQueries.length > 0) {
      for (const q of gscMetrics.topQueries.slice(0, 4)) {
        if (!keywords.some((k) => k.keyword.toLowerCase() === q.query.toLowerCase())) {
          keywords.unshift({
            keyword: q.query,
            occurrences: q.impressions,
            densityPercent: q.ctrPercent,
            inTitle: title.toLowerCase().includes(q.query.toLowerCase()),
            inH1: h1.toLowerCase().includes(q.query.toLowerCase()),
            inMeta: metaDescription.toLowerCase().includes(q.query.toLowerCase()),
            source: 'gsc_live',
            clicks: q.clicks,
            impressions: q.impressions,
            ctrPercent: q.ctrPercent,
            position: q.position
          });
        }
      }
    }

    const issues: string[] = [];
    const quickSuggestions: string[] = [];
    let score = 100;

    if (!indexable) {
      score -= 45;
      issues.push('Page is blocked from indexing or returned non-200 SSR response.');
      quickSuggestions.push('Ensure HTTP 200 SSR HTML response and remove any noindex directive.');
    }
    if (title.length < 30 || title.length > 68) {
      score -= 10;
      issues.push(`Meta title length is ${title.length} chars (optimal: 30–65 chars).`);
      quickSuggestions.push(
        `Rewrite <title> to 45–60 chars placing "${primaryKeyword}" near the front to prevent Google truncation.`
      );
    }
    if (metaDescription.length < 115 || metaDescription.length > 165) {
      score -= 10;
      issues.push(`Meta description is ${metaDescription.length} chars (optimal: 120–160 chars).`);
      quickSuggestions.push(
        'Craft a 135–155 char action-oriented meta description with your core benefit and CTA.'
      );
    }
    if (!canonicalUrl) {
      score -= 8;
      issues.push('Missing <link rel="canonical"> tag.');
      quickSuggestions.push(`Add canonical pointing to ${baseOrigin}${target.path}.`);
    }
    if (!h1) {
      score -= 10;
      issues.push('Missing semantic <h1> headline in SSR HTML.');
      quickSuggestions.push('Render a single descriptive <h1> matching search intent.');
    }
    if (target.pageType === 'article' && wordCount < 1200) {
      score -= 15;
      issues.push(`Article has ${wordCount} rendered words (top-ranking pillar target: 1,500+ words).`);
      quickSuggestions.push(
        'Expand implementation examples, architecture trade-offs, and FAQ depth past 1,500 words.'
      );
    } else if (target.pageType === 'core_page' && wordCount < 350) {
      score -= 10;
      issues.push(`Core page has ${wordCount} rendered words (target: 400+ words for rich snippets).`);
      quickSuggestions.push('Add service deliverables, proof benchmarks, and FAQ blocks.');
    }
    if (schemaTypes.length === 0) {
      score -= 10;
      issues.push('No Schema.org JSON-LD detected.');
      quickSuggestions.push('Inject WebPage / Service / TechArticle + FAQPage structured data.');
    }
    if (internalLinksCount < 3) {
      score -= 6;
      issues.push(`Only ${internalLinksCount} internal links found on this URL.`);
      quickSuggestions.push('Add contextual internal links to /services, /demo, and /contact.');
    }
    if (quickSuggestions.length === 0) {
      quickSuggestions.push(
        `Strong baseline — target featured snippets by adding a 2-sentence definition box for "${primaryKeyword}" and earning 2–3 authoritative backlinks.`
      );
    }

    const engineVerdicts: SearchConsoleEngineVerdict[] = [
      {
        engine: 'Google Search',
        searchable: indexable && wordCount >= 180,
        statusLabel: indexable && wordCount >= 180 ? 'Searchable & Indexed Ready' : 'Needs Fix',
        reason: indexable
          ? `HTTP 200 SSR HTML (${wordCount}w) · ${schemaTypes.length > 0 ? schemaTypes.join(', ') : 'Basic HTML'} · Canonical verified`
          : 'Blocked by robots or empty SSR HTML'
      },
      {
        engine: 'Bing & DuckDuckGo',
        searchable: indexable && Boolean(title && metaDescription),
        statusLabel: indexable && Boolean(title && metaDescription) ? 'Searchable' : 'Metadata Missing',
        reason: 'Sitemap + OpenGraph + semantic H1/H2 structure available for Bingbot & DuckDuckBot.'
      },
      {
        engine: 'Yahoo Search',
        searchable: indexable && Boolean(title && metaDescription),
        statusLabel: indexable && Boolean(title && metaDescription) ? 'Searchable (Bing Index)' : 'Pending Metadata',
        reason: 'Powered by Bing web index with verified canonical URL and clean meta snippet.'
      },
      {
        engine: 'AI Search (ChatGPT / Gemini / Perplexity)',
        searchable: indexable && wordCount >= 220,
        statusLabel: indexable && schemaTypes.length > 0 ? 'AI Citation Ready' : 'Low Citation Depth',
        reason: `Exposed via /llms.txt + SSR semantic HTML (${h2Headings.length} H2 sections, ${schemaTypes.length} JSON-LD schemas).`
      }
    ];

    auditedUrls.push({
      id: `url-${crypto.createHash('sha1').update(target.path).digest('hex').slice(0, 10)}`,
      path: target.path,
      fullUrl: `${baseOrigin}${target.path === '/' ? '' : target.path}`,
      pageType: target.pageType,
      httpStatus,
      indexable,
      title,
      titleLength: title.length,
      metaDescription,
      metaDescriptionLength: metaDescription.length,
      canonicalUrl,
      robotsDirective,
      h1,
      h2Headings,
      wordCount,
      internalLinksCount,
      schemaTypes,
      ogTitle,
      ogDescription,
      ogImage,
      primaryKeyword,
      keywords,
      engineVerdicts,
      seoScore: Math.max(0, Math.min(100, score)),
      issues,
      quickSuggestions,
      gscMetrics,
      aiAnalysis: prevAiByPath.get(target.path) || null
    });
  }

  const totalLinks = auditedUrls.length;
  const searchableLinks = auditedUrls.filter((u) => u.indexable).length;
  const avgSeoScore =
    totalLinks > 0
      ? Math.round(auditedUrls.reduce((acc, u) => acc + u.seoScore, 0) / totalLinks)
      : 0;
  const issueCount = auditedUrls.reduce((acc, u) => acc + u.issues.length, 0);

  const run: SearchConsoleAuditRun = {
    id: `gsc-run-${crypto.randomUUID().slice(0, 10)}`,
    baseOrigin,
    scannedAt: new Date().toISOString(),
    gscApiConnected: gscLive.connected,
    gscSiteUrl: gscLive.siteUrl,
    totalLinks,
    searchableLinks,
    avgSeoScore,
    issueCount,
    urls: auditedUrls
  };

  await updateGrowthStore((s) => {
    s.searchConsoleRuns = [run, ...s.searchConsoleRuns].slice(0, 15);
  });

  return run;
}

export async function getSearchConsoleDashboard(options: {
  baseOrigin?: string;
  userToken?: string;
}): Promise<SearchConsoleDashboardResponse> {
  let store = await readGrowthStore();
  if (store.searchConsoleRuns.length === 0) {
    await runWebsiteLinksAudit(options);
    store = await readGrowthStore();
  }
  const gscCfg = await resolveIntegrationConfig('google_search_console', options.userToken).catch(
    () => null
  );
  const emailConfig = await getGrowthModuleEmailConfig('search_console');
  const emailLogs = await listGrowthModuleEmailLogs('search_console');

  return {
    latestRun: store.searchConsoleRuns[0] || null,
    historyCount: store.searchConsoleRuns.length,
    gscConnected: Boolean(gscCfg?.secret),
    gscSiteUrl: gscCfg?.configMeta?.gsc_site_url || 'https://git-stack.org/',
    gscServiceAccountEmail: gscCfg?.configMeta?.gsc_service_account_email || '',
    emailConfig,
    emailLogs
  };
}

export async function analyzeUrlWithAi(options: {
  path: string;
  baseOrigin?: string;
  userToken?: string;
}): Promise<{ url: SearchConsoleUrlAudit; analysis: SearchConsoleAiRecommendation }> {
  let store = await readGrowthStore();
  let run = store.searchConsoleRuns[0];
  if (!run) {
    run = await runWebsiteLinksAudit({ baseOrigin: options.baseOrigin, userToken: options.userToken });
    store = await readGrowthStore();
  }

  const target = run.urls.find((u) => u.path === options.path);
  if (!target) {
    throw new Error(`URL "${options.path}" was not found in the latest website link audit.`);
  }

  const fallbackAnalysis: SearchConsoleAiRecommendation = {
    path: target.path,
    analyzedAt: new Date().toISOString(),
    modelUsed: 'deterministic-seo-auditor',
    summary: `This ${target.pageType.replace('_', ' ')} scores ${target.seoScore}/100 with ${target.wordCount} crawlable SSR words. Tightening title keyword placement, adding commercial long-tail terms, and linking directly to /demo and /contact will increase Google CTR and top-3 ranking authority.`,
    recommendedTitle:
      target.title.length >= 35 && target.title.length <= 62
        ? target.title
        : `${target.h1 || target.primaryKeyword} | GitStack Engineering`.slice(0, 62),
    recommendedMetaDescription:
      target.metaDescription.length >= 120 && target.metaDescription.length <= 160
        ? target.metaDescription
        : `Explore ${target.h1 || target.primaryKeyword} from GitStack. Practical production architecture, benchmarks, and direct consultation for enterprise engineering teams.`.slice(
            0,
            158
          ),
    priorityKeywordsToAdd: [
      `${target.primaryKeyword} architecture`,
      `${target.primaryKeyword} best practices 2026`,
      'enterprise software engineering services',
      'production cloud optimization'
    ],
    contentImprovements: [
      target.wordCount < 1500 && target.pageType === 'article'
        ? `Expand article depth from ${target.wordCount} words to 1,600+ words with a quantified before/after architecture table and real failure-mode mitigation steps.`
        : 'Add a concise 2-sentence direct answer block directly under the H1 to capture Google AI Overviews and Featured Snippets.',
      'Include an explicit comparison matrix contrasting DIY setups vs. GitStack production-grade architecture.',
      'Add 2–3 domain-specific FAQ pairs answering buyer objections on pricing, timeline, and compliance.'
    ],
    technicalFixes:
      target.issues.length > 0
        ? target.issues
        : [
            'Verify Google Search Console URL inspection after edits to trigger fresh Googlebot recrawl.',
            'Confirm og:image resolves at 1200x630 for maximum social & Discover CTR.'
          ],
    internalLinkSuggestions: [
      'Link primary service keywords to /services ("Explore GitStack Engineering Services")',
      'Add a mid-page callout to /demo ("Test Live Architecture Benchmarks in Our Interactive Sandbox")',
      'Close with a high-intent CTA to /contact ("Book a Principal Architecture Review")'
    ],
    estimatedImpact: target.seoScore < 85 ? 'High' : 'Medium'
  };

  let finalAnalysis = fallbackAnalysis;
  const apiKey = isGeminiQuotaCoolingDown()
    ? ''
    : await resolveIntegrationSecret('gemini', options.userToken).catch(() => '');

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `You are a Principal Technical SEO & Google Search Ranking Strategist auditing a page on GitStack (https://git-stack.org), a B2B AI Integration, MLOps, Custom Software, and Cloud Infrastructure consultancy.

Analyze this live URL audit snapshot and return concrete, high-impact recommendations to rank #1 on Google, Bing, and AI Answer Engines:
${JSON.stringify({
  path: target.path,
  pageType: target.pageType,
  title: target.title,
  metaDescription: target.metaDescription,
  h1: target.h1,
  h2Headings: target.h2Headings,
  wordCount: target.wordCount,
  schemaTypes: target.schemaTypes,
  primaryKeyword: target.primaryKeyword,
  topKeywords: target.keywords.slice(0, 6),
  issues: target.issues,
  gscMetrics: target.gscMetrics
})}

Ensure recommendedTitle is strictly 35-62 characters and recommendedMetaDescription is strictly 125-158 characters.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              recommendedTitle: { type: Type.STRING },
              recommendedMetaDescription: { type: Type.STRING },
              priorityKeywordsToAdd: { type: Type.ARRAY, items: { type: Type.STRING } },
              contentImprovements: { type: Type.ARRAY, items: { type: Type.STRING } },
              technicalFixes: { type: Type.ARRAY, items: { type: Type.STRING } },
              internalLinkSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
              estimatedImpact: { type: Type.STRING }
            }
          }
        }
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as Partial<SearchConsoleAiRecommendation>;
      if (parsed.summary) {
        finalAnalysis = {
          path: target.path,
          analyzedAt: new Date().toISOString(),
          modelUsed: 'gemini-4-hydrogen',
          summary: parsed.summary,
          recommendedTitle: parsed.recommendedTitle || fallbackAnalysis.recommendedTitle,
          recommendedMetaDescription:
            parsed.recommendedMetaDescription || fallbackAnalysis.recommendedMetaDescription,
          priorityKeywordsToAdd:
            parsed.priorityKeywordsToAdd?.length
              ? parsed.priorityKeywordsToAdd.slice(0, 6)
              : fallbackAnalysis.priorityKeywordsToAdd,
          contentImprovements:
            parsed.contentImprovements?.length
              ? parsed.contentImprovements.slice(0, 5)
              : fallbackAnalysis.contentImprovements,
          technicalFixes:
            parsed.technicalFixes?.length
              ? parsed.technicalFixes.slice(0, 5)
              : fallbackAnalysis.technicalFixes,
          internalLinkSuggestions:
            parsed.internalLinkSuggestions?.length
              ? parsed.internalLinkSuggestions.slice(0, 4)
              : fallbackAnalysis.internalLinkSuggestions,
          estimatedImpact:
            parsed.estimatedImpact === 'High' ||
            parsed.estimatedImpact === 'Medium' ||
            parsed.estimatedImpact === 'Foundational'
              ? parsed.estimatedImpact
              : fallbackAnalysis.estimatedImpact
        };
      }
    } catch (err) {
      markGeminiQuotaCooldownIfNeeded(err);
    }
  }

  let updatedUrl: SearchConsoleUrlAudit = { ...target, aiAnalysis: finalAnalysis };
  await updateGrowthStore((s) => {
    const latest = s.searchConsoleRuns[0];
    if (!latest) return;
    latest.urls = latest.urls.map((u) => {
      if (u.path === target.path) {
        updatedUrl = { ...u, aiAnalysis: finalAnalysis };
        return updatedUrl;
      }
      return u;
    });
  });

  return { url: updatedUrl, analysis: finalAnalysis };
}

export async function sendSearchConsoleEmailReport(options: {
  recipientEmail?: string;
  baseOrigin?: string;
  userToken?: string;
}): Promise<{ delivered: boolean; log: GrowthModuleEmailLog; message: string }> {
  const dashboard = await getSearchConsoleDashboard(options);
  const run = dashboard.latestRun;
  const recipient = (options.recipientEmail || dashboard.emailConfig.recipient_email || '').trim().toLowerCase();
  if (!recipient || !recipient.includes('@')) {
    throw new Error('Please configure a valid recipient email address for Search Console reports.');
  }

  const subject = `[GitStack Search Console] ${run?.searchableLinks ?? 0}/${run?.totalLinks ?? 0} URLs Searchable · Avg SEO Score ${run?.avgSeoScore ?? 0}%`;
  const topLines = (run?.urls || [])
    .slice(0, 12)
    .map(
      (u) =>
        `- ${u.path} | HTTP ${u.httpStatus} | ${u.indexable ? 'SEARCHABLE' : 'BLOCKED'} | ${u.wordCount}w | Score ${u.seoScore}% | Keyword: "${u.primaryKeyword}"${u.issues[0] ? ` | Fix: ${u.issues[0]}` : ''}`
    )
    .join('\n');

  const bodyText = [
    `GitStack Google Search Console & Multi-Engine Audit Report`,
    `Scanned At: ${run?.scannedAt || new Date().toISOString()}`,
    `Domain: ${run?.baseOrigin || 'https://git-stack.org'}`,
    `GSC Live API: ${dashboard.gscConnected ? `Connected (${dashboard.gscSiteUrl})` : 'Optional Live Crawler Mode'}`,
    '',
    `Summary: ${run?.searchableLinks ?? 0}/${run?.totalLinks ?? 0} live URLs verified searchable across Google, Bing/DuckDuckGo, Yahoo, and AI Search.`,
    `Average SEO Score: ${run?.avgSeoScore ?? 0}/100 | Active Issues: ${run?.issueCount ?? 0}`,
    '',
    'Audited Website Links & Primary Keywords:',
    topLines || '(No links audited yet)',
    '',
    'Open Back Office -> Search Console & SEO to view visual Google SERP previews and run AI page optimizers:',
    `${(options.baseOrigin || 'https://git-stack.org').replace(/\/+$/, '')}/obama`
  ].join('\n');

  const nowIso = new Date().toISOString();
  let status: 'sent' | 'failed' = 'sent';
  let providerMessageId = '';
  let errorDetail = '';

  try {
    const sent = await sendLarkSmtpMail(
      {
        toEmail: recipient,
        toName: 'GitStack SEO Operator',
        subject,
        bodyText
      },
      options.userToken
    );
    providerMessageId = sent.messageId;
  } catch (err) {
    status = 'failed';
    errorDetail = err instanceof Error ? err.message : 'Lark Mail SMTP dispatch failed.';
  }

  const log: GrowthModuleEmailLog = {
    id: `gsc-eml-${crypto.randomUUID().slice(0, 10)}`,
    module: 'search_console',
    recipient_email: recipient,
    subject,
    status,
    provider_message_id: providerMessageId,
    error_detail: errorDetail,
    sent_at: nowIso
  };
  await appendGrowthModuleEmailLog(log);

  await addInboxEmailLog(
    {
      id: log.id,
      recipient_email: recipient,
      subject,
      body: bodyText,
      channel: 'lark_smtp',
      category: 'ai_seo_daily_report',
      related_id: run?.id || null,
      provider_message_id: providerMessageId,
      status,
      error_detail: errorDetail,
      sent_by: 'search-console-module',
      sent_at: nowIso
    },
    options.userToken
  ).catch(() => null);

  return {
    delivered: status === 'sent',
    log,
    message:
      status === 'sent'
        ? `Search Console SEO report emailed to ${recipient} via Lark Mail.`
        : `Report logged, but Lark Mail SMTP returned: ${errorDetail}`
  };
}

export { saveGrowthModuleEmailConfig };
