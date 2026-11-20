import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'node:crypto';
import type {
  GrowthModuleEmailLog,
  MarketingChannel,
  MarketingDashboardResponse,
  MarketingPublishProof,
  MarketingScheduleItem,
  SocialAccountConnection
} from '../shared/types.ts';
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
import { addInboxEmailLog, listPosts } from './repository.ts';
import {
  resolveIntegrationConfig,
  resolveIntegrationSecret,
  saveAndVerifyIntegration,
  sendLarkSmtpMail
} from './vault.ts';

const VERIFIED_COVER_ASSETS = [
  {
    url: '/src/assets/images/hero_gitstack_architecture_1794645171609.jpg',
    alt: 'GitStack enterprise software architecture and engineering command view'
  },
  {
    url: '/src/assets/images/ai_ml_pipeline_visual_1794645170877.jpg',
    alt: 'Isometric enterprise AI integration and MLOps automation pipeline diagram'
  },
  {
    url: '/src/assets/images/cloud_infra_architecture_1794645172181.jpg',
    alt: 'Cloud infrastructure FinOps engineering workspace and architecture monitoring'
  },
  {
    url: '/src/assets/images/insight_cover_ai_agents_1794645171607.jpg',
    alt: 'Optical glass prisms visualizing multi-agent AI retrieval architecture'
  }
];

function resolveCallbackUrls(provider: 'facebook' | 'tiktok', originHint?: string) {
  const rawBase = (process.env.APP_URL || originHint || 'https://git-stack.org').replace(/\/+$/, '');
  const devBase = rawBase.includes('ais-pre-') ? rawBase.replace('ais-pre-', 'ais-dev-') : rawBase;
  const sharedBase = (
    process.env.SHARED_APP_URL ||
    (rawBase.includes('ais-dev-') ? rawBase.replace('ais-dev-', 'ais-pre-') : rawBase)
  ).replace(/\/+$/, '');
  return {
    development: `${devBase}/api/oauth/${provider}/callback`,
    shared: `${sharedBase}/api/oauth/${provider}/callback`
  };
}

export async function getSocialConnectionsStatus(
  userToken?: string,
  originHint?: string
): Promise<{ facebook: SocialAccountConnection; tiktok: SocialAccountConnection }> {
  const [fb, tt] = await Promise.all([
    resolveIntegrationConfig('facebook_page', userToken).catch(() => null),
    resolveIntegrationConfig('tiktok', userToken).catch(() => null)
  ]);

  const fbConnected = Boolean(fb?.secret && (fb?.configMeta?.fb_page_id || fb?.configMeta?.fb_page_name));
  const ttConnected = Boolean(tt?.secret);

  return {
    facebook: {
      provider: 'facebook_page',
      connected: fbConnected,
      source: fb?.source || 'disconnected',
      accountLabel: fb?.configMeta?.fb_page_name || fb?.configMeta?.fb_page_id || 'Not connected',
      accountId: fb?.configMeta?.fb_page_id || '',
      profileUrl: fb?.configMeta?.fb_page_url || (fb?.configMeta?.fb_page_id ? `https://facebook.com/${fb.configMeta.fb_page_id}` : ''),
      oauthConfigured: Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
      callbackUrls: resolveCallbackUrls('facebook', originHint),
      lastTestedAt: fb?.row?.last_tested_at || null,
      lastTestStatus: fb?.row?.last_test_status || 'untested',
      lastTestMessage: fb?.row?.last_test_message || ''
    },
    tiktok: {
      provider: 'tiktok',
      connected: ttConnected,
      source: tt?.source || 'disconnected',
      accountLabel: tt?.configMeta?.tiktok_display_name || tt?.configMeta?.tiktok_handle || (ttConnected ? 'TikTok Connected' : 'Not connected'),
      accountId: tt?.configMeta?.tiktok_open_id || '',
      profileUrl: tt?.configMeta?.tiktok_handle
        ? `https://www.tiktok.com/${tt.configMeta.tiktok_handle.startsWith('@') ? tt.configMeta.tiktok_handle : `@${tt.configMeta.tiktok_handle}`}`
        : '',
      oauthConfigured: Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET),
      callbackUrls: resolveCallbackUrls('tiktok', originHint),
      lastTestedAt: tt?.row?.last_tested_at || null,
      lastTestStatus: tt?.row?.last_test_status || 'untested',
      lastTestMessage: tt?.row?.last_test_message || ''
    }
  };
}

function buildDefault7DayOrganicPlan(
  origin: string,
  topArticleUrl: string,
  topArticleTitle: string
): MarketingScheduleItem[] {
  const base = origin.replace(/\/+$/, '');
  const now = new Date();
  const dayNames = ['Day 1 · Mon', 'Day 2 · Tue', 'Day 3 · Wed', 'Day 4 · Thu', 'Day 5 · Fri', 'Day 6 · Sat', 'Day 7 · Sun'];

  const templates: Array<Omit<MarketingScheduleItem, 'id' | 'scheduledDate' | 'updatedAt'>> = [
    {
      dayNumber: 1,
      dayLabel: dayNames[0],
      scheduledTime: '09:00',
      channel: 'facebook_page',
      contentFormat: 'Problem-Solution Authority Post',
      servicePillar: 'AI Integration & RAG',
      headline: 'Stop Shipping Fragile Chatbots — Deploy Production RAG Under 350ms',
      hook: 'Most enterprise AI pilots fail in week 3 because of hallucinated answers and leaked permissions.',
      caption: `Most enterprise AI pilots stall in production because of slow vector lookups and broken access controls.\n\nAt GitStack, we build hybrid RAG architectures with PostgreSQL pgvector, strict pre-retrieval RBAC, and sub-350ms latency.\n\nTest our live interactive AI sandbox free today — or book a 1-on-1 architecture review with our principal engineers.\n\nTry the Live Demo: ${base}/demo\nBook a Free Consultation: ${base}/contact`,
      videoScript: '',
      hashtags: ['#GitStack', '#EnterpriseAI', '#RAGArchitecture', '#SoftwareEngineering', '#TechPH'],
      ctaLabel: 'Try Live Demo Free',
      ctaUrl: `${base}/demo`,
      coverImage: VERIFIED_COVER_ASSETS[3].url,
      coverAlt: VERIFIED_COVER_ASSETS[3].alt,
      status: 'pending_approval'
    },
    {
      dayNumber: 2,
      dayLabel: dayNames[1],
      scheduledTime: '18:30',
      channel: 'tiktok',
      contentFormat: '45s Vertical Demo Screen-Walkthrough',
      servicePillar: 'Cloud Infrastructure & FinOps',
      headline: 'How We Cut Serverless PostgreSQL & Vercel Bills by 42% Without Downtime',
      hook: 'If your cloud database throws 504 timeouts every Monday morning, watch this 40-second fix.',
      caption: `Why your serverless app crashes under traffic bursts (and how port 6543 Transaction Pooling + singleton clients cut compute bills by 42%). Full free guide + live sandbox link in bio -> ${base}/demo`,
      videoScript: `[0-5s HOOK] Screen-record live latency monitor: "Your serverless app isn't slow — your database connections are choking."\n[5-20s PROBLEM] Show unpooled serverless lambdas opening 120 raw Postgres slots and hitting 504 errors.\n[20-35s SOLUTION] Show GitStack's singleton pooler + transactional outbox cutting p95 latency under 220ms and saving 42% monthly cloud spend.\n[35-45s CTA] "Try our live architecture demo free at git-stack.org/demo or tap the link in bio to book a cloud audit."`,
      hashtags: ['#CloudFinOps', '#WebDev', '#PostgreSQL', '#Vercel', '#GitStack'],
      ctaLabel: 'Open Interactive Sandbox',
      ctaUrl: `${base}/demo`,
      coverImage: VERIFIED_COVER_ASSETS[2].url,
      coverAlt: VERIFIED_COVER_ASSETS[2].alt,
      status: 'pending_approval'
    },
    {
      dayNumber: 3,
      dayLabel: dayNames[2],
      scheduledTime: '11:00',
      channel: 'facebook_page',
      contentFormat: 'Deep Pillar Article Distribution',
      servicePillar: 'Custom Software Engineering',
      headline: `New Engineering Guide: ${topArticleTitle}`,
      hook: 'We just published our complete 2026 production blueprint with runnable TypeScript patterns.',
      caption: `New on GitStack Technical Insights:\n"${topArticleTitle}"\n\nInside this deep engineering guide:\n• Real production failure modes & benchmarks\n• Step-by-step TypeScript architecture code\n• Compliance & FinOps checklists you can apply immediately\n\nRead the full free guide: ${topArticleUrl}\nNeed help implementing this for your company? Talk to us: ${base}/contact`,
      videoScript: '',
      hashtags: ['#SystemDesign', '#CustomSoftware', '#TypeScript', '#CloudArchitecture', '#GitStack'],
      ctaLabel: 'Read Full Guide',
      ctaUrl: topArticleUrl,
      coverImage: VERIFIED_COVER_ASSETS[0].url,
      coverAlt: VERIFIED_COVER_ASSETS[0].alt,
      status: 'pending_approval'
    },
    {
      dayNumber: 4,
      dayLabel: dayNames[3],
      scheduledTime: '19:00',
      channel: 'tiktok',
      contentFormat: '35s Founder Tech Tip Video',
      servicePillar: 'MLOps Automation',
      headline: '3 Signs Your Machine Learning Model Is Silently Losing You Money',
      hook: 'Your ML endpoint returns HTTP 200 OK... while accuracy quietly drops 18% every month.',
      caption: `Models don't crash loudly — they drift silently. Here's how our MLOps team catches drift early with automated PSI telemetry & shadow canaries. Free architecture checklist at ${base}/services`,
      videoScript: `[0-4s HOOK] "HTTP 200 doesn't mean your AI model is working."\n[4-16s SIGN 1-2] Explain feature skew and silent data drift after seasonal customer shifts.\n[16-28s SOLUTION] Show GitStack's automated PSI drift alerts + 24-hour shadow deployment gate.\n[28-35s CTA] "Need production MLOps without hiring a 10-person team? Visit git-stack.org/contact."`,
      hashtags: ['#MLOps', '#MachineLearning', '#AIEngineering', '#SaaSFounders', '#GitStack'],
      ctaLabel: 'View MLOps Services',
      ctaUrl: `${base}/services`,
      coverImage: VERIFIED_COVER_ASSETS[1].url,
      coverAlt: VERIFIED_COVER_ASSETS[1].alt,
      status: 'pending_approval'
    },
    {
      dayNumber: 5,
      dayLabel: dayNames[4],
      scheduledTime: '10:30',
      channel: 'facebook_page',
      contentFormat: 'Interactive Live App Showcase',
      servicePillar: 'AI Integration & RAG',
      headline: 'Test Before You Hire: Try the GitStack Interactive Customer Sandbox Free',
      hook: 'Don’t trust agency slide decks — test live AI workflows, CRM automation, and cloud telemetry yourself.',
      caption: `Tired of agencies pitching slide decks without showing real production code?\n\nWe opened the GitStack Interactive Sandbox so CTOs, founders, and ops leaders can test live AI workflows, RAG pipelines, and real-time analytics directly in the browser — 100% free.\n\nCreate your free sandbox account now: ${base}/demo\nOr schedule a 30-min engineering discovery call: ${base}/contact`,
      videoScript: '',
      hashtags: ['#LiveDemo', '#B2BSaaS', '#AIAutomation', '#SoftwareAgency', '#GitStack'],
      ctaLabel: 'Sign Up for Free Demo',
      ctaUrl: `${base}/demo`,
      coverImage: VERIFIED_COVER_ASSETS[0].url,
      coverAlt: VERIFIED_COVER_ASSETS[0].alt,
      status: 'pending_approval'
    },
    {
      dayNumber: 6,
      dayLabel: dayNames[5],
      scheduledTime: '17:00',
      channel: 'tiktok',
      contentFormat: '40s Myth-Busting Short',
      servicePillar: 'Technical Consulting',
      headline: 'Why 80% of Custom Software Projects Go Over Budget (And Our Fix)',
      hook: 'Want to save 6 months of wasted engineering budget? Do this one step before writing code.',
      caption: `Before spending $50k+ on custom software or AI integration, run a 1-week Principal Architecture & FinOps Blueprint. See how GitStack de-risks builds -> ${base}/contact`,
      videoScript: `[0-5s HOOK] "Stop hiring dev shops that start coding on Day 1 with zero architecture spec."\n[5-20s BREAKDOWN] Show 3 hidden budget killers: unpooled DBs, missing audit logs, and unverified third-party APIs.\n[20-34s GITSTACK METHOD] Show GitStack's 5-pillar architecture checklist & live interactive prototype workflow.\n[34-40s CTA] "Book a Principal Architect review at git-stack.org/contact."`,
      hashtags: ['#StartupCTO', '#TechConsulting', '#SoftwareArchitecture', '#BuildInPublic', '#GitStack'],
      ctaLabel: 'Book Architecture Review',
      ctaUrl: `${base}/contact`,
      coverImage: VERIFIED_COVER_ASSETS[2].url,
      coverAlt: VERIFIED_COVER_ASSETS[2].alt,
      status: 'pending_approval'
    },
    {
      dayNumber: 7,
      dayLabel: dayNames[6],
      scheduledTime: '14:00',
      channel: 'website_organic',
      contentFormat: 'Weekly Organic Community & Newsletter Roundup',
      servicePillar: 'Technical Consulting',
      headline: 'Weekly Engineering Digest: Free Templates, Live Sandbox & Q&A',
      hook: 'Recap our highest-value architecture blueprints and invite founders into next week’s discovery slots.',
      caption: `Weekly GitStack Engineering Dispatch:\n1. Explore our latest deep-dive technical guides (${base}/insights)\n2. Test live AI & cloud workflows in our free sandbox (${base}/demo)\n3. Reserve one of next week's Principal Architecture consultation slots (${base}/contact)\n\nBuilt for teams shipping reliable AI, cloud, and custom software at predictable unit cost.`,
      videoScript: '',
      hashtags: ['#WeeklyDigest', '#EngineeringLeadership', '#FreeTools', '#GitStack'],
      ctaLabel: 'Book Next Week Slot',
      ctaUrl: `${base}/contact`,
      coverImage: VERIFIED_COVER_ASSETS[3].url,
      coverAlt: VERIFIED_COVER_ASSETS[3].alt,
      status: 'pending_approval'
    }
  ];

  return templates.map((t, idx) => {
    const dt = new Date(now.getTime() + idx * 24 * 3600 * 1000);
    return {
      ...t,
      id: `mkt-day-${idx + 1}-${crypto.randomUUID().slice(0, 6)}`,
      scheduledDate: dt.toISOString().slice(0, 10),
      updatedAt: now.toISOString()
    };
  });
}

export async function getMarketingDashboard(options: {
  baseOrigin?: string;
  userToken?: string;
}): Promise<MarketingDashboardResponse> {
  let store = await readGrowthStore();
  const baseOrigin = (options.baseOrigin || 'https://git-stack.org').replace(/\/+$/, '');

  if (store.marketingSchedule.length === 0) {
    const posts = await listPosts(false, options.userToken, false).catch(() => []);
    const firstPost = posts[0];
    const initialPlan = buildDefault7DayOrganicPlan(
      baseOrigin,
      firstPost ? `${baseOrigin}/insights/${firstPost.slug}` : `${baseOrigin}/insights`,
      firstPost?.title || 'Cloud FinOps & Production Architecture Blueprint'
    );
    store = await updateGrowthStore((s) => {
      s.marketingSchedule = initialPlan;
      s.marketingLastGeneratedAt = new Date().toISOString();
    });
  }

  const [accounts, emailConfig, emailLogs] = await Promise.all([
    getSocialConnectionsStatus(options.userToken, baseOrigin),
    getGrowthModuleEmailConfig('marketing'),
    listGrowthModuleEmailLogs('marketing')
  ]);

  return {
    accounts,
    schedule: store.marketingSchedule,
    proofs: store.marketingProofs,
    emailConfig,
    emailLogs,
    lastGeneratedAt: store.marketingLastGeneratedAt
  };
}

export async function generateDailyMarketingPlan(options: {
  focusPillar?: string;
  targetAudience?: string;
  region?: string;
  baseOrigin?: string;
  userToken?: string;
}): Promise<MarketingScheduleItem[]> {
  const baseOrigin = (options.baseOrigin || 'https://git-stack.org').replace(/\/+$/, '');
  const focusPillar = options.focusPillar?.trim() || 'All GitStack Services (AI, MLOps, Custom Software, Cloud FinOps)';
  const targetAudience = options.targetAudience?.trim() || 'SME Founders, CTOs, and Engineering Leaders';
  const region = options.region?.trim() || 'Philippines & Global';

  const posts = await listPosts(false, options.userToken, false).catch(() => []);
  const topPost = posts[0];
  const fallback = buildDefault7DayOrganicPlan(
    baseOrigin,
    topPost ? `${baseOrigin}/insights/${topPost.slug}` : `${baseOrigin}/insights`,
    topPost?.title || 'Enterprise Cloud & AI Architecture Blueprint'
  );

  let generatedItems = fallback;
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
        contents: `You are an Organic B2B Growth Marketer for GitStack (${baseOrigin}), offering AI Integration & RAG, MLOps Automation, Custom Software Development, Cloud Infrastructure & FinOps, and Technical Consulting.

Build a concrete 7-day ZERO-AD-SPEND organic marketing schedule tailored for:
- Focus Pillar: ${focusPillar}
- Target Audience: ${targetAudience}
- Region: ${region}
- Recent Website Articles: ${JSON.stringify(posts.slice(0, 4).map((p) => ({ title: p.title, url: `${baseOrigin}/insights/${p.slug}` })))}
- Core Conversion URLs: ${baseOrigin}/demo (free live sandbox signup), ${baseOrigin}/contact (book consultation), ${baseOrigin}/services

Include a balanced mix of "facebook_page" (3 days), "tiktok" (3 days with spoken 30-45s videoScript), and "website_organic" (1 day). Every post must drive real clicks to GitStack's app, demo signup, or contact page.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                dayNumber: { type: Type.INTEGER },
                scheduledTime: { type: Type.STRING },
                channel: { type: Type.STRING },
                contentFormat: { type: Type.STRING },
                servicePillar: { type: Type.STRING },
                headline: { type: Type.STRING },
                hook: { type: Type.STRING },
                caption: { type: Type.STRING },
                videoScript: { type: Type.STRING },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                ctaLabel: { type: Type.STRING },
                ctaUrl: { type: Type.STRING }
              }
            }
          }
        }
      });

      const parsed = JSON.parse((res.text ?? '[]').trim()) as Array<Partial<MarketingScheduleItem>>;
      if (Array.isArray(parsed) && parsed.length >= 5) {
        const now = new Date();
        const dayLabels = ['Day 1 · Mon', 'Day 2 · Tue', 'Day 3 · Wed', 'Day 4 · Thu', 'Day 5 · Fri', 'Day 6 · Sat', 'Day 7 · Sun'];
        generatedItems = parsed.slice(0, 7).map((item, idx) => {
          const dt = new Date(now.getTime() + idx * 24 * 3600 * 1000);
          const ch: MarketingChannel =
            item.channel === 'facebook_page' || item.channel === 'tiktok' || item.channel === 'website_organic'
              ? item.channel
              : idx % 2 === 0
                ? 'facebook_page'
                : 'tiktok';
          const asset = VERIFIED_COVER_ASSETS[idx % VERIFIED_COVER_ASSETS.length];
          return {
            id: `mkt-day-${idx + 1}-${crypto.randomUUID().slice(0, 6)}`,
            dayNumber: idx + 1,
            dayLabel: dayLabels[idx] || `Day ${idx + 1}`,
            scheduledDate: dt.toISOString().slice(0, 10),
            scheduledTime: item.scheduledTime || (ch === 'tiktok' ? '18:30' : '10:00'),
            channel: ch,
            contentFormat: item.contentFormat || (ch === 'tiktok' ? '45s Vertical Demo Script' : 'Organic Authority Post'),
            servicePillar: item.servicePillar || focusPillar,
            headline: item.headline || fallback[idx % fallback.length].headline,
            hook: item.hook || fallback[idx % fallback.length].hook,
            caption: item.caption || fallback[idx % fallback.length].caption,
            videoScript: item.videoScript || '',
            hashtags:
              Array.isArray(item.hashtags) && item.hashtags.length > 0
                ? item.hashtags.slice(0, 6)
                : ['#GitStack', '#AI', '#SoftwareEngineering'],
            ctaLabel: item.ctaLabel || 'Try Live Demo Free',
            ctaUrl:
              item.ctaUrl && /^https?:\/\//i.test(item.ctaUrl)
                ? item.ctaUrl
                : `${baseOrigin}/demo`,
            coverImage: asset.url,
            coverAlt: asset.alt,
            status: 'pending_approval',
            updatedAt: now.toISOString()
          };
        });
      }
    } catch (err) {
      markGeminiQuotaCooldownIfNeeded(err);
    }
  }

  await updateGrowthStore((s) => {
    s.marketingSchedule = generatedItems;
    s.marketingLastGeneratedAt = new Date().toISOString();
  });

  return generatedItems;
}

export async function updateMarketingScheduleItem(
  itemId: string,
  patch: Partial<MarketingScheduleItem>
): Promise<MarketingScheduleItem> {
  let updated: MarketingScheduleItem | null = null;
  await updateGrowthStore((s) => {
    s.marketingSchedule = s.marketingSchedule.map((item) => {
      if (item.id !== itemId) return item;
      updated = {
        ...item,
        ...patch,
        id: item.id,
        updatedAt: new Date().toISOString()
      };
      return updated;
    });
  });
  if (!updated) throw new Error('Scheduled marketing item not found.');
  return updated;
}

export async function appendScheduleItems(items: MarketingScheduleItem[]): Promise<void> {
  await updateGrowthStore((s) => {
    s.marketingSchedule = [...items, ...s.marketingSchedule].slice(0, 30);
  });
}

export async function publishMarketingItemToSocial(options: {
  itemId: string;
  userToken?: string;
}): Promise<{ item: MarketingScheduleItem; proof: MarketingPublishProof; liveApiDelivered: boolean }> {
  const store = await readGrowthStore();
  const target = store.marketingSchedule.find((m) => m.id === options.itemId);
  if (!target) {
    throw new Error('Marketing schedule item not found.');
  }

  const fullCaption = `${target.caption.trim()}\n\n${target.hashtags.join(' ')}`.trim();
  const nowIso = new Date().toISOString();

  if (target.channel === 'facebook_page') {
    const fb = await resolveIntegrationConfig('facebook_page', options.userToken);
    const pageId = (fb.configMeta?.fb_page_id || '').trim();
    if (!fb.secret || !pageId) {
      throw new Error(
        'Facebook Page is not connected yet. Connect your Facebook Page ID & Page Access Token in the "FB & TikTok Accounts" tab (or via OAuth) to publish directly.'
      );
    }

    const params = new URLSearchParams({
      message: fullCaption,
      link: target.ctaUrl,
      access_token: fb.secret
    });

    const fbRes = await fetch(
      `https://graph.facebook.com/v20.0/${encodeURIComponent(pageId)}/feed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      }
    );
    const fbJson = (await fbRes.json().catch(() => ({}))) as {
      id?: string;
      error?: { message?: string };
    };

    if (!fbRes.ok || fbJson.error || !fbJson.id) {
      const errMsg =
        fbJson.error?.message ||
        `Meta Graph API rejected post (HTTP ${fbRes.status}). Verify pages_manage_posts permission.`;
      const failedProof: MarketingPublishProof = {
        id: `prf-${crypto.randomUUID().slice(0, 10)}`,
        scheduleItemId: target.id,
        channel: 'facebook_page',
        headline: target.headline,
        captionPreview: fullCaption.slice(0, 260),
        ctaUrl: target.ctaUrl,
        coverImage: target.coverImage,
        status: 'failed',
        mode: 'live_api',
        remotePostId: '',
        remotePostUrl: '',
        responseNote: errMsg,
        publishedAt: nowIso
      };
      const updatedItem = await updateMarketingScheduleItem(target.id, {
        status: 'failed',
        deliveryMessage: errMsg
      });
      await updateGrowthStore((s) => {
        s.marketingProofs = [failedProof, ...s.marketingProofs].slice(0, 80);
      });
      throw new Error(errMsg);
    }

    const remotePostUrl = `https://www.facebook.com/${fbJson.id.replace('_', '/posts/')}`;
    const proof: MarketingPublishProof = {
      id: `prf-${crypto.randomUUID().slice(0, 10)}`,
      scheduleItemId: target.id,
      channel: 'facebook_page',
      headline: target.headline,
      captionPreview: fullCaption.slice(0, 260),
      ctaUrl: target.ctaUrl,
      coverImage: target.coverImage,
      status: 'published',
      mode: 'live_api',
      remotePostId: fbJson.id,
      remotePostUrl,
      responseNote: `Published live to Facebook Page (${fb.configMeta?.fb_page_name || pageId}) via Meta Graph API v20.0.`,
      publishedAt: nowIso
    };

    const updatedItem = await updateMarketingScheduleItem(target.id, {
      status: 'published',
      remotePostId: fbJson.id,
      remotePostUrl,
      publishedAt: nowIso,
      deliveryMessage: proof.responseNote
    });
    await updateGrowthStore((s) => {
      s.marketingProofs = [proof, ...s.marketingProofs].slice(0, 80);
    });
    return { item: updatedItem, proof, liveApiDelivered: true };
  }

  if (target.channel === 'tiktok') {
    const tt = await resolveIntegrationConfig('tiktok', options.userToken);
    if (!tt.secret) {
      throw new Error(
        'TikTok account is not connected yet. Connect your TikTok Access Token in the "FB & TikTok Accounts" tab (or via TikTok OAuth) before publishing.'
      );
    }

    // Use TikTok Photo Post Content Posting API (supports direct image/text marketing posts via HTTPS photo_images)
    const imageUrl = target.coverImage.startsWith('http')
      ? target.coverImage
      : `https://git-stack.org${target.coverImage.startsWith('/') ? target.coverImage : `/${target.coverImage}`}`;

    const ttRes = await fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tt.secret}`,
        'Content-Type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify({
        media_type: 'PHOTO',
        post_mode: 'DIRECT_POST',
        post_info: {
          title: target.headline.slice(0, 90),
          description: `${fullCaption} ${target.ctaUrl}`.slice(0, 2200),
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_comment: false
        },
        source_info: {
          source: 'PULL_FROM_URL',
          photo_cover_index: 0,
          photo_images: [imageUrl]
        }
      })
    });

    const ttJson = (await ttRes.json().catch(() => ({}))) as {
      data?: { publish_id?: string };
      error?: { code?: string; message?: string };
    };

    if (!ttRes.ok || (ttJson.error?.code && ttJson.error.code !== 'ok')) {
      const errMsg =
        ttJson.error?.message ||
        `TikTok Content Posting API returned HTTP ${ttRes.status}. Ensure video.publish scope and verified domain URL are approved in TikTok Developer Portal.`;
      const failedProof: MarketingPublishProof = {
        id: `prf-${crypto.randomUUID().slice(0, 10)}`,
        scheduleItemId: target.id,
        channel: 'tiktok',
        headline: target.headline,
        captionPreview: fullCaption.slice(0, 260),
        ctaUrl: target.ctaUrl,
        coverImage: target.coverImage,
        status: 'failed',
        mode: 'live_api',
        remotePostId: '',
        remotePostUrl: '',
        responseNote: errMsg,
        publishedAt: nowIso
      };
      await updateMarketingScheduleItem(target.id, {
        status: 'failed',
        deliveryMessage: errMsg
      });
      await updateGrowthStore((s) => {
        s.marketingProofs = [failedProof, ...s.marketingProofs].slice(0, 80);
      });
      throw new Error(errMsg);
    }

    const publishId = ttJson.data?.publish_id || `tt-${crypto.randomUUID().slice(0, 8)}`;
    const profileHandle = tt.configMeta?.tiktok_handle || '@gitstack';
    const remotePostUrl = `https://www.tiktok.com/${profileHandle.startsWith('@') ? profileHandle : `@${profileHandle}`}`;
    const proof: MarketingPublishProof = {
      id: `prf-${crypto.randomUUID().slice(0, 10)}`,
      scheduleItemId: target.id,
      channel: 'tiktok',
      headline: target.headline,
      captionPreview: fullCaption.slice(0, 260),
      ctaUrl: target.ctaUrl,
      coverImage: target.coverImage,
      status: 'published',
      mode: 'live_api',
      remotePostId: publishId,
      remotePostUrl,
      responseNote: `Submitted directly to TikTok Content Posting API (publish_id: ${publishId}).`,
      publishedAt: nowIso
    };
    const updatedItem = await updateMarketingScheduleItem(target.id, {
      status: 'published',
      remotePostId: publishId,
      remotePostUrl,
      publishedAt: nowIso,
      deliveryMessage: proof.responseNote
    });
    await updateGrowthStore((s) => {
      s.marketingProofs = [proof, ...s.marketingProofs].slice(0, 80);
    });
    return { item: updatedItem, proof, liveApiDelivered: true };
  }

  // Organic website/community campaign approval & proof log
  const proof: MarketingPublishProof = {
    id: `prf-${crypto.randomUUID().slice(0, 10)}`,
    scheduleItemId: target.id,
    channel: 'website_organic',
    headline: target.headline,
    captionPreview: fullCaption.slice(0, 260),
    ctaUrl: target.ctaUrl,
    coverImage: target.coverImage,
    status: 'published',
    mode: 'organic_ready',
    remotePostId: `org-${crypto.randomUUID().slice(0, 8)}`,
    remotePostUrl: target.ctaUrl,
    responseNote: 'Approved and logged for organic newsletter & community distribution.',
    publishedAt: nowIso
  };
  const updatedItem = await updateMarketingScheduleItem(target.id, {
    status: 'published',
    remotePostId: proof.remotePostId,
    remotePostUrl: proof.remotePostUrl,
    publishedAt: nowIso,
    deliveryMessage: proof.responseNote
  });
  await updateGrowthStore((s) => {
    s.marketingProofs = [proof, ...s.marketingProofs].slice(0, 80);
  });
  return { item: updatedItem, proof, liveApiDelivered: false };
}

export function buildFacebookOAuthUrl(originHint?: string): { url: string; redirectUri: string } {
  const appId = (process.env.FACEBOOK_APP_ID || '').trim();
  if (!appId) {
    throw new Error(
      'FACEBOOK_APP_ID is not set in server environment variables. You can still connect immediately by pasting your Page ID and Page Access Token in the Vault form below.'
    );
  }
  const { development } = resolveCallbackUrls('facebook', originHint);
  const redirectUri = process.env.APP_URL
    ? `${process.env.APP_URL.replace(/\/+$/, '')}/api/oauth/facebook/callback`
    : development;
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'pages_show_list,pages_read_engagement,pages_manage_posts'
  });
  return {
    url: `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`,
    redirectUri
  };
}

export async function exchangeFacebookOAuthCode(code: string, originHint?: string) {
  const appId = (process.env.FACEBOOK_APP_ID || '').trim();
  const appSecret = (process.env.FACEBOOK_APP_SECRET || '').trim();
  if (!appId || !appSecret) {
    throw new Error('FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be set to finish Meta OAuth.');
  }
  const redirectUri = process.env.APP_URL
    ? `${process.env.APP_URL.replace(/\/+$/, '')}/api/oauth/facebook/callback`
    : resolveCallbackUrls('facebook', originHint).development;

  const tokenRes = await fetch(
    `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`
  );
  const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error?.message || 'Meta OAuth token exchange failed.');
  }

  // Fetch first managed Page + Page Access Token
  const pagesRes = await fetch(
    `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token,link&access_token=${encodeURIComponent(tokenJson.access_token)}`
  );
  const pagesJson = (await pagesRes.json().catch(() => ({}))) as {
    data?: Array<{ id: string; name: string; access_token: string; link?: string }>;
  };
  const firstPage = pagesJson.data?.[0];
  const finalToken = firstPage?.access_token || tokenJson.access_token;

  await saveAndVerifyIntegration(
    'facebook_page',
    {
      secret: finalToken,
      skipVerify: true,
      configMeta: {
        fb_page_id: firstPage?.id || 'me',
        fb_page_name: firstPage?.name || 'Connected Facebook Page',
        fb_page_url: firstPage?.link || '',
        fb_app_id: appId
      }
    },
    'oauth-facebook'
  );
  return { pageName: firstPage?.name || 'Connected Facebook Page', pageId: firstPage?.id || 'me' };
}

export function buildTikTokOAuthUrl(originHint?: string): { url: string; redirectUri: string } {
  const clientKey = (process.env.TIKTOK_CLIENT_KEY || '').trim();
  if (!clientKey) {
    throw new Error(
      'TIKTOK_CLIENT_KEY is not set in server environment variables. You can still connect immediately by pasting your TikTok Access Token in the Vault form below.'
    );
  }
  const redirectUri = process.env.APP_URL
    ? `${process.env.APP_URL.replace(/\/+$/, '')}/api/oauth/tiktok/callback`
    : resolveCallbackUrls('tiktok', originHint).development;
  const params = new URLSearchParams({
    client_key: clientKey,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'user.info.basic,video.publish,video.upload',
    state: crypto.randomBytes(12).toString('hex')
  });
  return {
    url: `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`,
    redirectUri
  };
}

export async function exchangeTikTokOAuthCode(code: string, originHint?: string) {
  const clientKey = (process.env.TIKTOK_CLIENT_KEY || '').trim();
  const clientSecret = (process.env.TIKTOK_CLIENT_SECRET || '').trim();
  if (!clientKey || !clientSecret) {
    throw new Error('TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET must be set to finish TikTok OAuth.');
  }
  const redirectUri = process.env.APP_URL
    ? `${process.env.APP_URL.replace(/\/+$/, '')}/api/oauth/tiktok/callback`
    : resolveCallbackUrls('tiktok', originHint).development;

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri
  });
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    open_id?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || 'TikTok OAuth token exchange failed.');
  }

  await saveAndVerifyIntegration(
    'tiktok',
    {
      secret: json.access_token,
      skipVerify: true,
      configMeta: {
        tiktok_open_id: json.open_id || '',
        tiktok_display_name: 'Connected TikTok Account',
        tiktok_client_key: clientKey
      }
    },
    'oauth-tiktok'
  );
  return { openId: json.open_id || '' };
}

export async function sendMarketingEmailReport(options: {
  recipientEmail?: string;
  baseOrigin?: string;
  userToken?: string;
}): Promise<{ delivered: boolean; log: GrowthModuleEmailLog; message: string }> {
  const dashboard = await getMarketingDashboard(options);
  const recipient = (options.recipientEmail || dashboard.emailConfig.recipient_email || '').trim().toLowerCase();
  if (!recipient || !recipient.includes('@')) {
    throw new Error('Please configure a valid recipient email address for Marketing reports.');
  }

  const publishedCount = dashboard.proofs.filter((p) => p.status === 'published').length;
  const subject = `[GitStack Organic Marketing] 7-Day Content Schedule (${dashboard.schedule.length} Posts · ${publishedCount} Published)`;
  const planLines = dashboard.schedule
    .slice(0, 7)
    .map(
      (item) =>
        `${item.dayLabel} (${item.scheduledDate} ${item.scheduledTime}) [${item.channel.toUpperCase()}] (${item.status.toUpperCase()})\n  Headline: ${item.headline}\n  Format: ${item.contentFormat} | CTA: ${item.ctaUrl}`
    )
    .join('\n\n');

  const bodyText = [
    'GitStack Free Organic Marketing & Social Schedule Report',
    `Facebook Page: ${dashboard.accounts.facebook.connected ? `Connected (${dashboard.accounts.facebook.accountLabel})` : 'Not Connected'}`,
    `TikTok: ${dashboard.accounts.tiktok.connected ? `Connected (${dashboard.accounts.tiktok.accountLabel})` : 'Not Connected'}`,
    `Published Campaign Proofs: ${publishedCount}`,
    '',
    'Daily Organic Content Posting Plan:',
    planLines || '(No posts scheduled yet)',
    '',
    'Open Back Office -> Marketing & Social to preview Facebook/TikTok cards and approve posts:',
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
        toName: 'GitStack Marketing Lead',
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
    id: `mkt-eml-${crypto.randomUUID().slice(0, 10)}`,
    module: 'marketing',
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
      sent_by: 'marketing-module',
      sent_at: nowIso
    },
    options.userToken
  ).catch(() => null);

  return {
    delivered: status === 'sent',
    log,
    message:
      status === 'sent'
        ? `Marketing 7-day plan & proof report emailed to ${recipient} via Lark Mail.`
        : `Report logged, but Lark Mail SMTP returned: ${errorDetail}`
  };
}
