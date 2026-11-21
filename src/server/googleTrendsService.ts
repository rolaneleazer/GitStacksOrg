import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'node:crypto';
import { pickDistinctSocialCover } from '../shared/editorialCovers.ts';
import { evaluateArticleQuality, slugify } from '../shared/qualityGate.ts';
import type {
  GoogleTrendMonitorItem,
  GoogleTrendsDashboardResponse,
  GrowthModuleEmailLog,
  MarketingScheduleItem,
  ServiceCategory,
  TrendApprovalBundle
} from '../shared/types.ts';
import { generateArticleCoverImage } from './coverImageService.ts';
import {
  isGeminiQuotaCoolingDown,
  markGeminiQuotaCooldownIfNeeded
} from './geminiResilience.ts';
import {
  appendGrowthModuleEmailLog,
  getGrowthModuleEmailConfig,
  listGrowthModuleEmailLogs,
  readGrowthStore,
  updateGrowthStore
} from './growthStore.ts';
import { appendScheduleItems, publishMarketingItemToSocial } from './marketingService.ts';
import { addInboxEmailLog, listPosts, upsertPost } from './repository.ts';
import { discoverTrendingTopics, generateAdSenseSafeArticle } from './trendScout.ts';
import { resolveIntegrationSecret, sendLarkSmtpMail } from './vault.ts';

const REGION_GEO_MAP: Record<string, { geo: string; label: string }> = {
  PH: { geo: 'PH', label: 'Philippines' },
  US: { geo: 'US', label: 'United States' },
  SG: { geo: 'SG', label: 'Southeast Asia (Singapore)' },
  GLOBAL: { geo: 'US', label: 'Global' }
};

function decodeXml(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function mapCategory(raw: string): ServiceCategory {
  const c = (raw || '').toLowerCase();
  if (c.includes('ai') || c.includes('rag')) return 'AI Integration';
  if (c.includes('ml')) return 'ML Automation';
  if (c.includes('cloud') || c.includes('finops') || c.includes('infra')) return 'Cloud Infrastructure';
  if (c.includes('consult')) return 'Technical Consulting';
  return 'Custom Software';
}

function parseGoogleTrendsRss(xml: string, regionCode: string): GoogleTrendMonitorItem[] {
  const items: GoogleTrendMonitorItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
    const trafficMatch = block.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/i);
    const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const newsUrlMatch = block.match(/<ht:news_item_url>([\s\S]*?)<\/ht:news_item_url>/i);
    const newsTitleMatch = block.match(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/i);

    const rawTitle = titleMatch ? decodeXml(titleMatch[1]) : '';
    if (!rawTitle) continue;
    const trafficLabel = trafficMatch ? `${decodeXml(trafficMatch[1])} searches` : 'Trending Now';
    const newsUrl = newsUrlMatch ? decodeXml(newsUrlMatch[1]) : 'https://trends.google.com/trending';
    const newsTitle = newsTitleMatch ? decodeXml(newsTitleMatch[1]) : `Google Trends (${regionCode})`;

    items.push({
      id: `gt-rss-${crypto.createHash('sha1').update(`${regionCode}:${rawTitle}`).digest('hex').slice(0, 10)}`,
      title: rawTitle,
      region: regionCode,
      trafficLabel,
      sourceType: 'google_trends_rss',
      servicePillar: 'AI & Custom Software Opportunity',
      whyItConverts: `Rising ${regionCode} Google Trend (${trafficLabel}) — angle into an enterprise software, automation, or cloud workflow guide that directs readers to GitStack's free Live Demo (/demo) and Consultation (/contact).`,
      relatedQueries: [rawTitle, `${rawTitle} software automation`, `${rawTitle} enterprise guide`],
      sources: [
        { title: newsTitle, url: /^https?:\/\//i.test(newsUrl) ? newsUrl : 'https://trends.google.com/trending' },
        { title: 'GitStack Technical Services', url: 'https://git-stack.org/services' }
      ],
      publishedAt: pubDateMatch ? new Date(decodeXml(pubDateMatch[1])).toISOString() : new Date().toISOString(),
      alreadyCovered: false
    });
    if (items.length >= 10) break;
  }
  return items;
}

export async function scanGoogleTrendsMonitor(options: {
  region?: string;
  userToken?: string;
}): Promise<GoogleTrendsDashboardResponse> {
  const regionCode = (options.region || 'PH').toUpperCase();
  const regionMeta = REGION_GEO_MAP[regionCode] || REGION_GEO_MAP.PH;

  const existingPosts = await listPosts(true, options.userToken, false).catch(() => []);
  const existingSlugs = existingPosts.map((p) => p.slug);
  const existingTitles = existingPosts.map((p) => p.title);
  const existingLowerSet = new Set(existingTitles.map((t) => t.toLowerCase()));
  const existingSlugSet = new Set(existingSlugs.map((s) => s.toLowerCase()));

  let monitored: GoogleTrendMonitorItem[] = [];
  let feedSourceMode: GoogleTrendsDashboardResponse['feedSourceMode'] = 'google_trends_rss';
  let notice: string | undefined;

  // 1. Live Google Trends RSS feed (real-time trending topics by region)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const rssRes = await fetch(
      `https://trends.google.com/trending/rss?geo=${encodeURIComponent(regionMeta.geo)}`,
      {
        headers: { 'User-Agent': 'GitStack-Trends-Monitor/1.0' },
        signal: controller.signal
      }
    );
    clearTimeout(timer);
    if (rssRes.ok) {
      const xml = await rssRes.text();
      const rssItems = parseGoogleTrendsRss(xml, regionCode);
      if (rssItems.length > 0) {
        monitored = rssItems.slice(0, 6);
        feedSourceMode = 'google_trends_rss';
      }
    }
  } catch {
    // Fallback to Search Grounding + GitStack B2B Trend Radar below
  }

  // 2. Pair with high-intent GitStack B2B Trends (Google Search Grounding / Business SEO Library)
  const b2bTrends = await discoverTrendingTopics(
    {
      niche: 'Enterprise Software Engineering, AI Automation & Cloud Infrastructure',
      country: regionMeta.label,
      keywords: 'AI agents, cloud finops, compliance automation, custom software, MLOps',
      existingSlugs,
      existingTitles
    },
    options.userToken
  );

  const b2bConverted: GoogleTrendMonitorItem[] = b2bTrends.topics.map((t) => ({
    id: `gt-b2b-${t.id}`,
    title: t.title,
    region: regionCode,
    trafficLabel: `${t.opportunity} Demand · ${t.searchIntent}`,
    sourceType: b2bTrends.sourceMode === 'google_search' ? 'google_search_grounding' : 'gitstack_trend_radar',
    servicePillar: t.servicePillar || 'Enterprise Software Engineering',
    whyItConverts: t.summary,
    relatedQueries: t.keyAngles || [],
    sources: t.sources,
    publishedAt: new Date().toISOString(),
    alreadyCovered:
      existingSlugSet.has(slugify(t.title)) || existingLowerSet.has(t.title.toLowerCase())
  }));

  if (monitored.length === 0) {
    monitored = b2bConverted;
    feedSourceMode =
      b2bTrends.sourceMode === 'google_search' ? 'google_search_grounding' : 'gitstack_trend_radar';
    notice =
      b2bTrends.notice ||
      'Live Google Trends RSS was unreachable from this runtime — showing high-intent rising B2B trends aligned to GitStack services.';
  } else {
    // Combine top 4 real-time Google Trends RSS + top 4 high-converting B2B trends
    const rssChecked = monitored.slice(0, 4).map((m) => ({
      ...m,
      alreadyCovered:
        existingSlugSet.has(slugify(m.title)) || existingLowerSet.has(m.title.toLowerCase())
    }));
    monitored = [...b2bConverted.slice(0, 4), ...rssChecked];
  }

  await updateGrowthStore((s) => {
    s.trendsRegion = regionCode;
    s.trendsLastScannedAt = new Date().toISOString();
    s.trendsFeedSourceMode = feedSourceMode;
    s.trendsNotice = notice;
    s.monitoredTrends = monitored;
  });

  return getGoogleTrendsDashboard({ region: regionCode, userToken: options.userToken });
}

export async function getGoogleTrendsDashboard(options: {
  region?: string;
  userToken?: string;
}): Promise<GoogleTrendsDashboardResponse> {
  let store = await readGrowthStore();
  if (store.monitoredTrends.length === 0) {
    return scanGoogleTrendsMonitor(options);
  }
  const [emailConfig, emailLogs] = await Promise.all([
    getGrowthModuleEmailConfig('google_trends'),
    listGrowthModuleEmailLogs('google_trends')
  ]);

  return {
    region: store.trendsRegion,
    lastScannedAt: store.trendsLastScannedAt,
    feedSourceMode: store.trendsFeedSourceMode,
    notice: store.trendsNotice,
    trends: store.monitoredTrends,
    approvalQueue: store.trendApprovalQueue,
    stats: {
      monitoredCount: store.monitoredTrends.length,
      pendingApprovalCount: store.trendApprovalQueue.filter(
        (b) => b.status === 'pending_approval'
      ).length,
      publishedBundlesCount: store.trendApprovalQueue.filter((b) => b.status === 'published')
        .length,
      alreadyCoveredCount: store.monitoredTrends.filter((t) => t.alreadyCovered).length
    },
    emailConfig,
    emailLogs
  };
}

export async function generateTrendConversionBundle(options: {
  trendId?: string;
  trendTitle: string;
  region?: string;
  baseOrigin?: string;
  userToken?: string;
}): Promise<TrendApprovalBundle> {
  const baseOrigin = (options.baseOrigin || 'https://git-stack.org').replace(/\/+$/, '');
  const regionCode = (options.region || 'PH').toUpperCase();
  const regionLabel = REGION_GEO_MAP[regionCode]?.label || 'Philippines';

  const store = await readGrowthStore();
  const matchedTrend = store.monitoredTrends.find(
    (t) => t.id === options.trendId || t.title.toLowerCase() === options.trendTitle.toLowerCase()
  );

  const seoAngleTitle =
    options.trendTitle.length > 32
      ? options.trendTitle
      : `${options.trendTitle}: Enterprise Automation, Cloud Architecture & Business Growth Guide (2026)`;

  // 1. Generate deep 1,500–2,200 word SEO pillar article with GitStack app/demo/contact conversion links
  const article = await generateAdSenseSafeArticle(
    {
      topic: seoAngleTitle,
      niche: 'Enterprise Software Engineering, AI Automation & Cloud Infrastructure',
      country: regionLabel,
      sources: matchedTrend?.sources
    },
    options.userToken
  );

  // Append explicit app signup & service conversion callout if not already prominent
  const ctaBlock = `\n\n## Turn This Trend Into Production ROI With GitStack\n\nReady to apply **${options.trendTitle}** inside your own product or internal operations? Explore live AI and cloud workflows in our [Free Interactive App Sandbox](${baseOrigin}/demo), review our [Custom Software & AI Services](${baseOrigin}/services), or [Contact GitStack Principal Engineers](${baseOrigin}/contact) for a tailored technical roadmap.\n`;
  const finalMarkdown = article.content.includes('/demo')
    ? article.content
    : `${article.content}${ctaBlock}`;

  const mappedCategory = mapCategory(article.category);
  const articleCover = article.coverImage
    ? { url: article.coverImage, alt: article.coverAlt || article.title }
    : await generateArticleCoverImage({
        title: article.title,
        category: mappedCategory,
        primaryKeyword: article.primaryKeyword,
        slug: article.slug,
        userToken: options.userToken
      });
  const fbCover = pickDistinctSocialCover('facebook', options.trendTitle, [articleCover.url]);
  const ttCover = pickDistinctSocialCover('tiktok', options.trendTitle, [articleCover.url, fbCover]);

  const qualityReport = evaluateArticleQuality({
    title: article.title,
    summary_tldr: article.summary,
    content_markdown: finalMarkdown,
    author_name: article.authorName || 'Rolan Molano',
    author_role: 'Principal Cloud Architect · 13+ Years Distributed Systems Experience',
    author_bio:
      'Principal Cloud Architect with 13+ years of experience in distributed backend architectures, cloud FinOps, and enterprise compliance.',
    cover_image: articleCover.url,
    cover_alt: articleCover.alt || article.title,
    meta_title: article.metaTitle,
    meta_description: article.metaDescription,
    primary_keyword: article.primaryKeyword,
    faqs: article.faqs,
    references: article.sources
  });

  // 2. Generate paired Facebook Page & TikTok promotional posts (using Gemini if available, deterministic fallback otherwise)
  let fbHeadline = `Trending Now: ${article.title}`;
  let fbCaption = `Everyone in ${regionLabel} is searching "${options.trendTitle}" right now — here is what it means for engineering teams and growing businesses.\n\nWe broke down the complete architecture, cost numbers, and step-by-step playbook on GitStack Insights.\n\nTry our live interactive app free: ${baseOrigin}/demo\nNeed custom software or AI automation? Contact our team: ${baseOrigin}/contact`;
  let fbHashtags = ['#GoogleTrends', '#GitStack', '#AIAutomation', '#SoftwareEngineering', '#TechNews'];

  let ttHook = `Everyone is searching "${options.trendTitle}" today — here is how smart businesses are turning it into real revenue.`;
  let ttScript = `[0-4s HOOK] Show Google Trends chart: "${ttHook}"\n[4-18s INSIGHT] Break down the top engineering & automation opportunity behind ${options.trendTitle}.\n[18-32s LIVE APP] Show GitStack's live sandbox at git-stack.org/demo solving this workflow in seconds.\n[32-40s CTA] "Try our app free or message us at git-stack.org/contact to build yours."`;
  let ttCaption = `How to turn "${options.trendTitle}" into a scalable software & AI advantage. Try the live app free -> ${baseOrigin}/demo`;
  let ttHashtags = ['#TrendingNow', '#TechTok', '#GitStack', '#AIForBusiness', '#BuildWithAI'];

  const apiKey = isGeminiQuotaCoolingDown()
    ? ''
    : await resolveIntegrationSecret('gemini', options.userToken).catch(() => '');

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      const res = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Turn this trending topic into high-converting organic Facebook Page and TikTok promotional posts for GitStack (${baseOrigin}) that drive signups to ${baseOrigin}/demo and inquiries to ${baseOrigin}/contact.
Trend: ${options.trendTitle}
Region: ${regionLabel}
Article Title: ${article.title}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fbHeadline: { type: Type.STRING },
              fbCaption: { type: Type.STRING },
              fbHashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
              ttHook: { type: Type.STRING },
              ttScript: { type: Type.STRING },
              ttCaption: { type: Type.STRING },
              ttHashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      });
      const parsed = JSON.parse((res.text ?? '{}').trim()) as Record<string, unknown>;
      if (typeof parsed.fbHeadline === 'string' && parsed.fbHeadline) fbHeadline = parsed.fbHeadline;
      if (typeof parsed.fbCaption === 'string' && parsed.fbCaption) fbCaption = parsed.fbCaption;
      if (Array.isArray(parsed.fbHashtags) && parsed.fbHashtags.length > 0) {
        fbHashtags = parsed.fbHashtags.map(String).slice(0, 6);
      }
      if (typeof parsed.ttHook === 'string' && parsed.ttHook) ttHook = parsed.ttHook;
      if (typeof parsed.ttScript === 'string' && parsed.ttScript) ttScript = parsed.ttScript;
      if (typeof parsed.ttCaption === 'string' && parsed.ttCaption) ttCaption = parsed.ttCaption;
      if (Array.isArray(parsed.ttHashtags) && parsed.ttHashtags.length > 0) {
        ttHashtags = parsed.ttHashtags.map(String).slice(0, 6);
      }
    } catch (err) {
      markGeminiQuotaCooldownIfNeeded(err);
    }
  }

  const bundle: TrendApprovalBundle = {
    id: `trb-${crypto.randomUUID().slice(0, 10)}`,
    trendId: matchedTrend?.id || `custom-${Date.now()}`,
    trendTitle: options.trendTitle,
    region: regionCode,
    status: 'pending_approval',
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    ctaLinks: {
      appUrl: baseOrigin,
      signupDemoUrl: `${baseOrigin}/demo`,
      contactServiceUrl: `${baseOrigin}/contact`
    },
    articleDraft: {
      title: article.title,
      slug: article.slug,
      summary_tldr: article.summary,
      content_markdown: finalMarkdown,
      category: mapCategory(article.category),
      meta_title: article.metaTitle,
      meta_description: article.metaDescription,
      primary_keyword: article.primaryKeyword,
      word_count: qualityReport.wordCount,
      quality_score: qualityReport.qualityScore,
      geo_score: qualityReport.geoScore,
      publish_eligible: qualityReport.publishEligible,
      cover_image: articleCover.url,
      faqs: article.faqs,
      references: article.sources
    },
    facebookPost: {
      headline: fbHeadline,
      caption: fbCaption,
      hashtags: fbHashtags,
      ctaUrl: `${baseOrigin}/demo`,
      coverImage: fbCover
    },
    tiktokPost: {
      hook: ttHook,
      videoScript: ttScript,
      caption: ttCaption,
      hashtags: ttHashtags,
      ctaUrl: `${baseOrigin}/demo`,
      coverImage: ttCover
    },
    publishedArticleSlug: null,
    queuedMarketingIds: [],
    socialPublishNotes: []
  };

  await updateGrowthStore((s) => {
    s.trendApprovalQueue = [bundle, ...s.trendApprovalQueue].slice(0, 60);
  });

  return bundle;
}

export async function reviewTrendApprovalBundle(options: {
  bundleId: string;
  action: 'publish_article' | 'queue_social' | 'publish_social_now' | 'reject';
  reviewNote?: string;
  articleTitle?: string;
  articleMarkdown?: string;
  facebookCaption?: string;
  tiktokCaption?: string;
  userToken?: string;
}): Promise<{ bundle: TrendApprovalBundle; message: string }> {
  const store = await readGrowthStore();
  const target = store.trendApprovalQueue.find((b) => b.id === options.bundleId);
  if (!target) {
    throw new Error('Trend approval bundle not found.');
  }

  const nowIso = new Date().toISOString();
  const editedTitle = (options.articleTitle || target.articleDraft.title).trim();
  const editedMarkdown = (options.articleMarkdown || target.articleDraft.content_markdown).trim();
  const editedFbCaption = (options.facebookCaption || target.facebookPost.caption).trim();
  const editedTtCaption = (options.tiktokCaption || target.tiktokPost.caption).trim();

  if (options.action === 'reject') {
    let rejectedBundle: TrendApprovalBundle = {
      ...target,
      status: 'rejected',
      reviewedAt: nowIso,
      reviewNote: options.reviewNote || 'Rejected by operator before publishing.'
    };
    await updateGrowthStore((s) => {
      s.trendApprovalQueue = s.trendApprovalQueue.map((b) =>
        b.id === target.id ? rejectedBundle : b
      );
    });
    return { bundle: rejectedBundle, message: 'Trend bundle rejected and removed from active publishing.' };
  }

  if (options.action === 'publish_article') {
    const cleanSlug = slugify(editedTitle) || target.articleDraft.slug;
    const existingPosts = await listPosts(true, options.userToken, false);
    const duplicate = existingPosts.find(
      (p) => p.slug === cleanSlug || p.title.trim().toLowerCase() === editedTitle.toLowerCase()
    );
    if (duplicate) {
      throw new Error(
        `Duplicate topic blocked: "${duplicate.title}" (/insights/${duplicate.slug}) already exists in your blog.`
      );
    }

    const resolvedPublishCover =
      target.articleDraft.cover_image ||
      (
        await generateArticleCoverImage({
          title: editedTitle,
          category: target.articleDraft.category,
          primaryKeyword: target.articleDraft.primary_keyword,
          slug: cleanSlug,
          userToken: options.userToken
        })
      ).url;

    const report = evaluateArticleQuality({
      title: editedTitle,
      summary_tldr: target.articleDraft.summary_tldr,
      content_markdown: editedMarkdown,
      author_name: 'Rolan Molano',
      author_role: 'Principal Cloud Architect · 13+ Years Distributed Systems Experience',
      author_bio:
        'Principal Cloud Architect with 13+ years of experience in distributed backend architectures, cloud FinOps, and enterprise compliance.',
      cover_image: resolvedPublishCover,
      cover_alt: editedTitle,
      meta_title: target.articleDraft.meta_title,
      meta_description: target.articleDraft.meta_description,
      primary_keyword: target.articleDraft.primary_keyword,
      faqs: target.articleDraft.faqs,
      references: target.articleDraft.references
    });

    if (!report.publishEligible) {
      throw new Error(
        `AdSense Quality Gatekeeper blocked publishing: ${report.blockingIssues.join(' ')}`
      );
    }

    const created = await upsertPost(
      {
        id: crypto.randomUUID(),
        title: editedTitle,
        slug: cleanSlug,
        summary_tldr: target.articleDraft.summary_tldr,
        content_markdown: editedMarkdown,
        category: target.articleDraft.category,
        author_name: 'Rolan Molano',
        author_role: 'Principal Cloud Architect · 13+ Years Distributed Systems Experience',
        author_bio:
          'Principal Cloud Architect with 13+ years of experience in distributed backend architectures, cloud FinOps, and enterprise compliance.',
        cover_image: resolvedPublishCover,
        cover_alt: editedTitle,
        meta_title: target.articleDraft.meta_title,
        meta_description: target.articleDraft.meta_description,
        primary_keyword: target.articleDraft.primary_keyword,
        faqs: target.articleDraft.faqs,
        references: target.articleDraft.references,
        word_count: report.wordCount,
        read_time_minutes: report.readTimeMinutes,
        quality_score: report.qualityScore,
        geo_score: report.geoScore,
        status: 'published',
        published_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso
      },
      options.userToken
    );

    const updatedBundle: TrendApprovalBundle = {
      ...target,
      status: 'published',
      reviewedAt: nowIso,
      publishedArticleSlug: created.slug,
      articleDraft: {
        ...target.articleDraft,
        title: editedTitle,
        slug: created.slug,
        content_markdown: editedMarkdown,
        word_count: report.wordCount,
        quality_score: report.qualityScore,
        geo_score: report.geoScore
      }
    };

    await updateGrowthStore((s) => {
      s.trendApprovalQueue = s.trendApprovalQueue.map((b) =>
        b.id === target.id ? updatedBundle : b
      );
      s.monitoredTrends = s.monitoredTrends.map((t) =>
        t.id === target.trendId || t.title.toLowerCase() === target.trendTitle.toLowerCase()
          ? { ...t, alreadyCovered: true }
          : t
      );
    });

    return {
      bundle: updatedBundle,
      message: `Approved & published live article "/insights/${created.slug}" (${report.wordCount} words, ${report.qualityScore}% Quality).`
    };
  }

  // queue_social or publish_social_now
  const articleCta = target.publishedArticleSlug
    ? `${target.ctaLinks.appUrl}/insights/${target.publishedArticleSlug}`
    : target.ctaLinks.signupDemoUrl;
  const today = nowIso.slice(0, 10);

  const fbItem: MarketingScheduleItem = {
    id: `mkt-tr-fb-${crypto.randomUUID().slice(0, 6)}`,
    dayNumber: 0,
    dayLabel: 'Trend Promo · FB',
    scheduledDate: today,
    scheduledTime: 'Now',
    channel: 'facebook_page',
    contentFormat: 'Google Trend Lead-Gen Post',
    servicePillar: target.articleDraft.category,
    headline: target.facebookPost.headline,
    hook: target.trendTitle,
    caption: editedFbCaption,
    videoScript: '',
    hashtags: target.facebookPost.hashtags,
    ctaLabel: 'Try GitStack Live Demo',
    ctaUrl: articleCta,
    coverImage: target.facebookPost.coverImage,
    coverAlt: target.facebookPost.headline,
    status: 'approved',
    sourceTrendTitle: target.trendTitle,
    updatedAt: nowIso
  };

  const ttItem: MarketingScheduleItem = {
    id: `mkt-tr-tt-${crypto.randomUUID().slice(0, 6)}`,
    dayNumber: 0,
    dayLabel: 'Trend Promo · TikTok',
    scheduledDate: today,
    scheduledTime: 'Now',
    channel: 'tiktok',
    contentFormat: 'Google Trend Short-Form Video',
    servicePillar: target.articleDraft.category,
    headline: target.trendTitle,
    hook: target.tiktokPost.hook,
    caption: editedTtCaption,
    videoScript: target.tiktokPost.videoScript,
    hashtags: target.tiktokPost.hashtags,
    ctaLabel: 'Sign Up Free Demo',
    ctaUrl: target.ctaLinks.signupDemoUrl,
    coverImage: target.tiktokPost.coverImage,
    coverAlt: target.trendTitle,
    status: 'approved',
    sourceTrendTitle: target.trendTitle,
    updatedAt: nowIso
  };

  await appendScheduleItems([fbItem, ttItem]);

  const publishNotes: string[] = [];
  if (options.action === 'publish_social_now') {
    for (const item of [fbItem, ttItem]) {
      try {
        const res = await publishMarketingItemToSocial({
          itemId: item.id,
          userToken: options.userToken
        });
        publishNotes.push(`${item.channel}: ${res.proof.responseNote}`);
      } catch (err) {
        publishNotes.push(
          `${item.channel}: Queued in Marketing Studio (${err instanceof Error ? err.message : 'connect account to auto-post'})`
        );
      }
    }
  } else {
    publishNotes.push(
      'Approved and added both Facebook Page & TikTok promotional posts to the Marketing & Social Studio schedule.'
    );
  }

  const updatedBundle: TrendApprovalBundle = {
    ...target,
    status: target.publishedArticleSlug ? 'published' : 'approved',
    reviewedAt: nowIso,
    facebookPost: { ...target.facebookPost, caption: editedFbCaption },
    tiktokPost: { ...target.tiktokPost, caption: editedTtCaption },
    queuedMarketingIds: [...(target.queuedMarketingIds || []), fbItem.id, ttItem.id],
    socialPublishNotes: [...(target.socialPublishNotes || []), ...publishNotes]
  };

  await updateGrowthStore((s) => {
    s.trendApprovalQueue = s.trendApprovalQueue.map((b) =>
      b.id === target.id ? updatedBundle : b
    );
  });

  return {
    bundle: updatedBundle,
    message: publishNotes.join(' · ')
  };
}

export async function sendGoogleTrendsEmailReport(options: {
  recipientEmail?: string;
  baseOrigin?: string;
  userToken?: string;
}): Promise<{ delivered: boolean; log: GrowthModuleEmailLog; message: string }> {
  const dashboard = await getGoogleTrendsDashboard(options);
  const recipient = (options.recipientEmail || dashboard.emailConfig.recipient_email || '').trim().toLowerCase();
  if (!recipient || !recipient.includes('@')) {
    throw new Error('Please configure a valid recipient email address for Google Trends alerts.');
  }

  const pending = dashboard.approvalQueue.filter((b) => b.status === 'pending_approval');
  const subject = `[GitStack Google Trends Monitor] ${dashboard.stats.monitoredCount} Rising Trends · ${pending.length} Awaiting Your Approval`;

  const trendLines = dashboard.trends
    .slice(0, 8)
    .map(
      (t) =>
        `- ${t.title} (${t.trafficLabel} | ${t.servicePillar})${t.alreadyCovered ? ' [ALREADY COVERED]' : ''}`
    )
    .join('\n');

  const queueLines =
    pending.length > 0
      ? pending
          .map(
            (b) =>
              `- PENDING APPROVAL: "${b.articleDraft.title}" (${b.articleDraft.word_count}w Article + Facebook & TikTok Posts -> ${b.ctaLinks.signupDemoUrl})`
          )
          .join('\n')
      : 'No drafts currently waiting for approval.';

  const bodyText = [
    `GitStack Google Trends Monitor & Approval Queue Digest (${dashboard.region})`,
    `Last Scanned: ${dashboard.lastScannedAt || new Date().toISOString()}`,
    `Source Mode: ${dashboard.feedSourceMode}`,
    '',
    'Top Monitored Google Trends:',
    trendLines,
    '',
    'Items Waiting for Your Approval Before Publishing:',
    queueLines,
    '',
    'Open Back Office -> Google Trends Agent to review, edit, and approve posts:',
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
        toName: 'GitStack Growth Admin',
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
    id: `trd-eml-${crypto.randomUUID().slice(0, 10)}`,
    module: 'google_trends',
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
      related_id: null,
      provider_message_id: providerMessageId,
      status,
      error_detail: errorDetail,
      sent_by: 'google-trends-module',
      sent_at: nowIso
    },
    options.userToken
  ).catch(() => null);

  return {
    delivered: status === 'sent',
    log,
    message:
      status === 'sent'
        ? `Google Trends & Approval Queue digest emailed to ${recipient} via Lark Mail.`
        : `Report logged, but Lark Mail SMTP returned: ${errorDetail}`
  };
}
