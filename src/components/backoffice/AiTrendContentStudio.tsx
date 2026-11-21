import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  ExternalLink,
  Flame,
  Image as ImageIcon,
  PenTool,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { api } from '../../lib/api.ts';
import type { GeneratedArticleDraft, TrendingTopicItem } from '../../server/trendScout.ts';
import { EDITORIAL_COVER_POOL, pickUniqueCoverForArticle } from '../../shared/editorialCovers.ts';
import {
  evaluateArticleQuality,
  extractFaqsFromMarkdown,
  normalizeSeoMetadata,
  slugify
} from '../../shared/qualityGate.ts';
import type { ArticleFAQ, ArticleReference, ServiceCategory } from '../../shared/types.ts';

interface AiTrendContentStudioProps {
  onPostPublished?: () => void;
  onNavigateToInsights?: () => void;
}

const DEFAULT_AUTHOR_BIO =
  'Principal Cloud Architect with 13+ years of experience in distributed backend architectures, cloud FinOps, and enterprise compliance.';

function mapDraftCategory(category?: string): ServiceCategory {
  const c = (category || '').toLowerCase();
  if (c.includes('ai') || c.includes('rag')) return 'AI Integration';
  if (c.includes('ml')) return 'ML Automation';
  if (c.includes('cloud') || c.includes('infra')) return 'Cloud Infrastructure';
  if (c.includes('consult')) return 'Technical Consulting';
  return 'Custom Software';
}

export function AiTrendContentStudio({
  onPostPublished,
  onNavigateToInsights
}: AiTrendContentStudioProps) {
  // Step 1: Trends state
  const [niche, setNiche] = useState('Enterprise Software Engineering & Cloud Infrastructure');
  const [country, setCountry] = useState('Philippines');
  const [keywords, setKeywords] = useState('cloud, MLOps, RAG, electronic invoicing, finops');
  const [discovering, setDiscovering] = useState(false);
  const [trends, setTrends] = useState<TrendingTopicItem[]>([]);
  const [trendSourceMode, setTrendSourceMode] = useState<'google_search' | 'gitstack_seo_library' | null>(null);
  const [excludedUsedCount, setExcludedUsedCount] = useState(0);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [trendNotice, setTrendNotice] = useState<string | null>(null);

  // Step 2 & 3: Draft & Editor state
  const [selectedTopic, setSelectedTopic] = useState<TrendingTopicItem | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState<
    'idle' | 'research' | 'writing' | 'policy_gate'
  >('idle');
  const [draft, setDraft] = useState<GeneratedArticleDraft | null>(null);

  // Split-screen editor form fields
  const [editTitle, setEditTitle] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editCategory, setEditCategory] = useState<ServiceCategory>('Custom Software');
  const [editAuthor, setEditAuthor] = useState('Rolan Molano');
  const [editAuthorRole, setEditAuthorRole] = useState(
    'Principal Cloud Architect · 13+ Years Distributed Systems Experience'
  );
  const [editAuthorBio, setEditAuthorBio] = useState(DEFAULT_AUTHOR_BIO);
  const [editSummary, setEditSummary] = useState('');
  const [editMetaTitle, setEditMetaTitle] = useState('');
  const [editMetaDescription, setEditMetaDescription] = useState('');
  const [editPrimaryKeyword, setEditPrimaryKeyword] = useState('enterprise architecture');
  const [editFaqs, setEditFaqs] = useState<ArticleFAQ[]>([]);
  const [editReferences, setEditReferences] = useState<ArticleReference[]>([]);
  const [editCoverImage, setEditCoverImage] = useState(EDITORIAL_COVER_POOL[0].url);
  const [editCoverAlt, setEditCoverAlt] = useState(EDITORIAL_COVER_POOL[0].altTemplate);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [editContent, setEditContent] = useState('');

  const [showGatekeeperDetails, setShowGatekeeperDetails] = useState(false);
  const [savingMode, setSavingMode] = useState<'draft' | 'published' | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [publishErrors, setPublishErrors] = useState<string[]>([]);

  // Live Quality Gatekeeper evaluation synced with backend rules
  const liveReport = useMemo(
    () =>
      evaluateArticleQuality({
        title: editTitle,
        summary_tldr: editSummary,
        content_markdown: editContent,
        author_name: editAuthor,
        author_role: editAuthorRole,
        author_bio: editAuthorBio,
        cover_image: editCoverImage,
        cover_alt: editCoverAlt || editTitle || 'GitStack architecture visual',
        meta_title: editMetaTitle || editTitle,
        meta_description: editMetaDescription,
        primary_keyword: editPrimaryKeyword,
        faqs: editFaqs,
        references: editReferences
      }),
    [
      editTitle,
      editSummary,
      editContent,
      editAuthor,
      editAuthorRole,
      editAuthorBio,
      editCoverImage,
      editCoverAlt,
      editMetaTitle,
      editMetaDescription,
      editPrimaryKeyword,
      editFaqs,
      editReferences
    ]
  );

  const requiredChecks = useMemo(
    () => liveReport.checks.filter((c) => c.requiredForPublish),
    [liveReport.checks]
  );
  const passedRequiredCount = useMemo(
    () => requiredChecks.filter((c) => c.passed).length,
    [requiredChecks]
  );

  // Discover Trends
  const handleDiscoverTrends = async () => {
    setDiscovering(true);
    setTrendError(null);
    setTrendNotice(null);
    try {
      const res = await api.discoverTrends({
        niche: niche.trim(),
        country: country.trim(),
        keywords: keywords.trim()
      });
      setTrends(res.topics);
      setTrendSourceMode(res.sourceMode);
      setExcludedUsedCount(res.excludedUsedCount || 0);
      if (res.notice) setTrendNotice(res.notice);
    } catch (err) {
      setTrendError(err instanceof Error ? err.message : 'Failed to discover trends.');
    } finally {
      setDiscovering(false);
    }
  };

  // Generate AdSense-Safe Draft via Multi-Agent pipeline
  const handleGenerateDraft = async (topicItem: TrendingTopicItem) => {
    setSelectedTopic(topicItem);
    setGenerating(true);
    setPublishSuccess(null);
    setPublishErrors([]);
    setTrendError(null);
    setTrendNotice(null);
    setGenerationStage('research');

    try {
      setTimeout(() => setGenerationStage('writing'), 1200);
      setTimeout(() => setGenerationStage('policy_gate'), 2800);

      const res = await api.generateAdSenseArticle({
        topic: topicItem.title,
        niche: niche.trim(),
        country,
        sources: topicItem.sources
      });

      const seo = normalizeSeoMetadata({
        title: res.title,
        summary: res.summary,
        metaTitle: res.metaTitle,
        metaDescription: res.metaDescription,
        primaryKeyword: res.primaryKeyword || keywords.split(',')[0]?.trim(),
        category: res.category
      });

      const extractedFaqs = extractFaqsFromMarkdown(res.content);
      const initialFaqs =
        Array.isArray(res.faqs) && res.faqs.length >= 2
          ? res.faqs
          : extractedFaqs.length >= 2
            ? extractedFaqs
            : [
                {
                  question: `How does ${res.title.split(':')[0].trim()} perform under production load?`,
                  answer:
                    'Using pooled PostgreSQL connections on port 6543, idempotent webhook consumers, and OpenTelemetry tracing maintains sub-250ms response times under peak bursts.'
                },
                {
                  question: 'What compliance and architectural safeguards are verified before launch?',
                  answer:
                    'Teams verify cryptographic payload validation, Role-Based Access Control (RBAC), automated audit logs, and CI schema contract tests prior to production rollout.'
                }
              ];

      const mergedRefs = [...(res.sources || []), ...(topicItem.sources || [])].filter(
        (r, i, arr) =>
          r?.title?.trim().length >= 4 &&
          /^https?:\/\/.+/.test(r?.url?.trim() || '') &&
          arr.findIndex((x) => x.url === r.url) === i
      );

      const initialRefs =
        mergedRefs.length >= 2
          ? mergedRefs
          : [
              ...mergedRefs,
              {
                title: 'GitStack Technical Architecture Insights',
                url: 'https://git-stack.org/insights'
              },
              {
                title: 'Google Search Central Helpful Content Standards',
                url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content'
              }
            ].slice(0, 3);

      const resolvedCategory = mapDraftCategory(res.category);
      const fallbackCover = pickUniqueCoverForArticle({
        title: res.title,
        category: resolvedCategory,
        keyword: seo.primary_keyword
      });
      setDraft(res);
      setEditTitle(res.title);
      setEditSlug(res.slug || slugify(res.title));
      setEditCategory(resolvedCategory);
      setEditAuthor(res.authorName || 'Rolan Molano');
      setEditAuthorRole('Principal Cloud Architect · 13+ Years Distributed Systems Experience');
      setEditAuthorBio(DEFAULT_AUTHOR_BIO);
      setEditSummary(seo.summary_tldr);
      setEditMetaTitle(seo.meta_title);
      setEditMetaDescription(seo.meta_description);
      setEditPrimaryKeyword(seo.primary_keyword);
      setEditFaqs(initialFaqs);
      setEditReferences(initialRefs);
      setEditCoverImage(res.coverImage || fallbackCover.url);
      setEditCoverAlt(res.coverAlt || fallbackCover.alt);
      setEditContent(res.content);
      setShowGatekeeperDetails(false);

      if (res.notice) setTrendNotice(res.notice);
    } catch (err) {
      setTrendError(err instanceof Error ? err.message : 'Article generation failed.');
    } finally {
      setGenerating(false);
      setGenerationStage('idle');
    }
  };

  // One-click SEO, FAQ & Citation Auto-Tune
  const handleAutoTune = () => {
    const seo = normalizeSeoMetadata({
      title: editTitle,
      summary: editSummary,
      metaTitle: editMetaTitle,
      metaDescription: editMetaDescription,
      primaryKeyword: editPrimaryKeyword,
      category: editCategory
    });

    setEditMetaTitle(seo.meta_title);
    setEditMetaDescription(seo.meta_description);
    setEditSummary(seo.summary_tldr);
    setEditPrimaryKeyword(seo.primary_keyword);
    if (!editSlug.trim() && editTitle.trim()) {
      setEditSlug(slugify(editTitle));
    }
    if (editAuthorBio.trim().length < 40) {
      setEditAuthorBio(DEFAULT_AUTHOR_BIO);
    }

    const validFaqs = editFaqs.filter(
      (f) => f.question.trim().length >= 12 && f.answer.trim().length >= 30
    );
    if (validFaqs.length < 2) {
      const fromMd = extractFaqsFromMarkdown(editContent);
      const nextFaqs = [
        ...validFaqs,
        ...fromMd.filter((m) => !validFaqs.some((v) => v.question === m.question))
      ];
      if (nextFaqs.length < 2) {
        nextFaqs.push(
          {
            question: `What architectural guardrails keep ${editTitle.split(':')[0].trim() || 'this deployment'} reliable in production?`,
            answer:
              'Teams rely on singleton transaction connection poolers, transactional outbox event delivery, strict schema validation, and real-time latency telemetry.'
          },
          {
            question: 'How does GitStack verify technical accuracy and compliance readiness?',
            answer:
              'Every guide pairs human engineering review from Principal Cloud Architect Rolan Molano with verifiable primary documentation and reproducible production code.'
          }
        );
      }
      setEditFaqs(nextFaqs.slice(0, 3));
    }

    const validRefs = editReferences.filter(
      (r) => r.title.trim().length >= 4 && /^https?:\/\/.+/.test(r.url.trim())
    );
    if (validRefs.length < 2) {
      const topicRefs = (selectedTopic?.sources || []).filter(
        (r) => r.title.trim().length >= 4 && /^https?:\/\/.+/.test(r.url.trim())
      );
      const fallbackRefs = [
        ...validRefs,
        ...topicRefs,
        { title: 'GitStack Technical Architecture Insights', url: 'https://git-stack.org/insights' },
        {
          title: 'Google Search Central Helpful Content Standards',
          url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content'
        }
      ].filter((r, idx, arr) => arr.findIndex((x) => x.url === r.url) === idx);
      setEditReferences(fallbackRefs.slice(0, 3));
    }

    setPublishErrors([]);
  };

  // Save as Draft OR Publish to Blog (/api/posts)
  const handleSavePost = async (targetStatus: 'draft' | 'published') => {
    if (!editTitle.trim() || !editContent.trim()) {
      setPublishErrors(['Headline and Markdown article body are required.']);
      return;
    }

    if (targetStatus === 'published' && !liveReport.publishEligible) {
      setPublishErrors(liveReport.blockingIssues);
      setShowGatekeeperDetails(true);
      return;
    }

    setSavingMode(targetStatus);
    setPublishSuccess(null);
    setPublishErrors([]);
    setTrendError(null);

    try {
      const cleanFaqs = editFaqs.filter(
        (f) => f.question.trim().length >= 12 && f.answer.trim().length >= 30
      );
      const cleanRefs = editReferences.filter(
        (r) => r.title.trim().length >= 4 && /^https?:\/\/.+/.test(r.url.trim())
      );

      await api.createPost({
        title: editTitle.trim(),
        slug: editSlug.trim() || slugify(editTitle),
        summary_tldr: editSummary.trim(),
        content_markdown: editContent,
        category: editCategory,
        author_name: editAuthor.trim() || 'Rolan Molano',
        author_role:
          editAuthorRole.trim() || 'Principal Cloud Architect · 13+ Years Distributed Systems Experience',
        author_bio: editAuthorBio.trim() || DEFAULT_AUTHOR_BIO,
        cover_image: editCoverImage,
        cover_alt: editCoverAlt.trim() || editTitle.trim(),
        meta_title: (editMetaTitle || editTitle).trim(),
        meta_description: editMetaDescription.trim(),
        primary_keyword: editPrimaryKeyword.trim() || 'enterprise architecture',
        faqs: cleanFaqs,
        references: cleanRefs,
        word_count: liveReport.wordCount,
        read_time_minutes: liveReport.readTimeMinutes,
        status: targetStatus
      });

      const submittedSlug = editSlug.trim() || slugify(editTitle);
      setTrends((prev) =>
        prev.filter(
          (t) =>
            t.id !== selectedTopic?.id &&
            slugify(t.title) !== submittedSlug &&
            t.title.trim().toLowerCase() !== editTitle.trim().toLowerCase()
        )
      );
      setExcludedUsedCount((prev) => prev + 1);

      setPublishSuccess(
        targetStatus === 'published'
          ? `Article "${editTitle.trim()}" passed all Quality Gatekeeper checks and is now live in GitStack Insights.`
          : `Draft "${editTitle.trim()}" saved to Managed Articles for further editing.`
      );
      if (onPostPublished) onPostPublished();
    } catch (err) {
      const errWithIssues = err as Error & { blockingIssues?: string[] };
      const issues =
        Array.isArray(errWithIssues?.blockingIssues) && errWithIssues.blockingIssues.length > 0
          ? errWithIssues.blockingIssues
          : [err instanceof Error ? err.message : 'Publishing failed.'];
      setPublishErrors(issues);
      setShowGatekeeperDetails(true);
    } finally {
      setSavingMode(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER BANNER */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2 font-medium text-teal-800">
            <Compass className="h-3.5 w-3.5" />
            <span>Google Search Grounding · 2026 Helpful Content Guardrail</span>
          </div>

          <div className="flex items-center gap-2 text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>9-Pillar E-E-A-T &amp; AdSense Gatekeeper Active</span>
          </div>
        </div>

        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            AI Trend Scout &amp; AdSense-Safe Content Studio
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
            Discover rising topics aligned with GitStack engineering services, generate 1,500–2,200
            word SEO pillar guides with field notes, structured FAQs, and primary citations, while
            automatically excluding already-published topics.
          </p>
        </div>

        {/* Search Controls */}
        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
          <div className="sm:col-span-5 space-y-1">
            <label className="block text-xs font-semibold text-slate-800">Website Niche</label>
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Enterprise Software Engineering & Cloud Infrastructure"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-3 space-y-1">
            <label className="block text-xs font-semibold text-slate-800">Target Region</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none bg-white"
            >
              <option value="Philippines">Philippines (BIR &amp; Local SMEs)</option>
              <option value="Global">Global / Worldwide</option>
              <option value="Southeast Asia">Southeast Asia</option>
              <option value="United States">United States &amp; North America</option>
            </select>
          </div>

          <div className="sm:col-span-4 flex gap-2">
            <button
              type="button"
              onClick={handleDiscoverTrends}
              disabled={discovering}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              {discovering ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <TrendingUp className="h-3.5 w-3.5" />
              )}
              <span>{discovering ? 'Scouting Trends...' : 'Scout 7-Day Trends'}</span>
            </button>
          </div>
        </div>

        {trendError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
            {trendError}
          </div>
        )}
        {trendNotice && !trendError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
            {trendNotice}
          </div>
        )}
      </div>

      {/* 2. TRENDING TOPIC CARDS (STEP 1) */}
      {trends.length > 0 && !draft && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-500" />
              <span>Rising High-Opportunity Topics ({trends.length})</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono">
              <span>
                {trendSourceMode === 'google_search'
                  ? 'Source: Live Google Search Grounding (7-Day)'
                  : 'Source: GitStack Business SEO Library'}
              </span>
              {excludedUsedCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums text-emerald-700 font-medium">
                    {excludedUsedCount} already-published {excludedUsedCount === 1 ? 'topic' : 'topics'} excluded
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trends.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between hover:border-slate-300 transition-colors space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500">
                    <span className="truncate">
                      {t.servicePillar ? `${t.servicePillar} · ${t.searchIntent}` : t.searchIntent}
                    </span>
                    <span
                      className={
                        t.opportunity === 'Breakout'
                          ? 'text-rose-700 font-semibold'
                          : t.opportunity === 'Surging'
                            ? 'text-amber-700 font-semibold'
                            : 'text-emerald-700 font-semibold'
                      }
                    >
                      {t.opportunity} Opportunity
                    </span>
                  </div>

                  <h4 className="font-display text-sm font-bold text-slate-900 leading-snug">
                    {t.title}
                  </h4>

                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {t.summary}
                  </p>

                  {t.sources && t.sources.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      <div className="text-[11px] font-medium text-slate-400">
                        Verified Sources
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {t.sources.map((s, idx) => (
                          <a
                            key={idx}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:underline max-w-[200px] truncate"
                          >
                            <span>{s.title}</span>
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleGenerateDraft(t)}
                  disabled={generating}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <PenTool className="h-3.5 w-3.5 text-teal-400" />
                  <span>Generate AdSense-Safe Draft</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MULTI-AGENT IN-FLIGHT PROGRESS MODAL */}
      {generating && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-6 sm:p-8 text-center space-y-4">
          <div className="flex justify-center">
            <RefreshCw className="h-7 w-7 text-[var(--gs-primary)] animate-spin" />
          </div>
          <h3 className="font-display text-base font-bold text-slate-900">
            Multi-Agent Editorial Engine Active
          </h3>
          <div className="max-w-md mx-auto grid grid-cols-3 gap-2 text-xs">
            <div
              className={`rounded-lg p-2.5 border transition-all ${
                generationStage === 'research'
                  ? 'bg-white border-indigo-300 font-bold text-indigo-700'
                  : 'bg-white/60 border-slate-200 text-slate-500'
              }`}
            >
              Agent 1: Research
            </div>
            <div
              className={`rounded-lg p-2.5 border transition-all ${
                generationStage === 'writing'
                  ? 'bg-white border-indigo-300 font-bold text-indigo-700'
                  : 'bg-white/60 border-slate-200 text-slate-500'
              }`}
            >
              Agent 2: Value Writer
            </div>
            <div
              className={`rounded-lg p-2.5 border transition-all ${
                generationStage === 'policy_gate'
                  ? 'bg-white border-indigo-300 font-bold text-indigo-700'
                  : 'bg-white/60 border-slate-200 text-slate-500'
              }`}
            >
              Agent 3: Policy Gate
            </div>
          </div>
          <p className="text-xs text-slate-600">
            Synthesizing 1,500–2,200 words with structured FAQs, verified references, and SEO bounds...
          </p>
        </div>
      )}

      {/* 3. SPLIT-SCREEN EDITORIAL STUDIO & LIVE GATEKEEPER */}
      {draft && (
        <div className="space-y-5">
          {/* Action & Telemetry Bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(null);
                    setPublishErrors([]);
                    setPublishSuccess(null);
                  }}
                  className="font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0"
                >
                  ← Back to Topic Trends
                </button>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 font-semibold ${
                    liveReport.publishEligible ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {liveReport.publishEligible ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5" />
                  )}
                  <span className="tabular-nums">
                    Gatekeeper: {passedRequiredCount}/{requiredChecks.length} Required Passed
                  </span>
                </span>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono tabular-nums text-slate-600">
                  {liveReport.wordCount} words
                </span>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono tabular-nums text-slate-600">
                  Quality {liveReport.qualityScore}% / GEO {liveReport.geoScore}%
                </span>
                <button
                  type="button"
                  onClick={() => setShowGatekeeperDetails((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-indigo-700 hover:underline font-medium whitespace-nowrap shrink-0"
                >
                  <span>{showGatekeeperDetails ? 'Hide Checks' : 'Inspect Checks'}</span>
                  {showGatekeeperDetails ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!liveReport.publishEligible && (
                  <button
                    type="button"
                    onClick={handleAutoTune}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Auto-Tune SEO &amp; Schema</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleSavePost('draft')}
                  disabled={savingMode !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{savingMode === 'draft' ? 'Saving Draft...' : 'Save Draft'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSavePost('published')}
                  disabled={savingMode !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                >
                  {savingMode === 'published' ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {savingMode === 'published' ? 'Publishing...' : 'Approve & Publish to Blog'}
                  </span>
                </button>
              </div>
            </div>

            {/* Live Gatekeeper Checklist Drawer */}
            {showGatekeeperDetails && (
              <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {liveReport.checks.map((chk) => (
                  <div
                    key={chk.id}
                    className={`rounded-lg border p-3 text-xs space-y-1 ${
                      chk.passed
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : chk.requiredForPublish
                          ? 'border-rose-200 bg-rose-50/50'
                          : 'border-amber-200 bg-amber-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 font-semibold">
                      <span className="text-slate-900 truncate">{chk.label}</span>
                      <span
                        className={`shrink-0 font-mono text-[11px] ${
                          chk.passed
                            ? 'text-emerald-700'
                            : chk.requiredForPublish
                              ? 'text-rose-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {chk.passed ? 'Pass' : chk.requiredForPublish ? 'Blocked' : 'Optional'}
                      </span>
                    </div>
                    <div className="font-mono tabular-nums text-[11px] text-slate-600">
                      Measured: {chk.measuredValue} · Target: {chk.targetValue}
                    </div>
                    {!chk.passed && (
                      <p className="text-[11px] text-slate-700 leading-snug">{chk.remediation}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actionable Blocking Issues Banner */}
          {publishErrors.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-2 text-xs text-rose-900">
              <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>
                    AdSense Quality Gatekeeper blocked publishing ({publishErrors.length} check
                    {publishErrors.length === 1 ? '' : 's'} remaining)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAutoTune}
                  className="rounded-md bg-rose-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-rose-800 whitespace-nowrap shrink-0"
                >
                  Auto-Fix SEO, FAQs &amp; Citations
                </button>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-rose-800">
                {publishErrors.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          {publishSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{publishSuccess}</span>
              </div>
              {onNavigateToInsights && (
                <button
                  type="button"
                  onClick={onNavigateToInsights}
                  className="rounded-lg bg-emerald-700 px-3.5 py-1.5 text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
                >
                  View in Journal →
                </button>
              )}
            </div>
          )}

          {/* Split-Screen Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Metadata, SEO, FAQs, References & Markdown Editor */}
            <div className="lg:col-span-6 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3.5">
                <h4 className="text-xs font-semibold text-slate-800">
                  Article Metadata &amp; E-E-A-T Attribution
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Headline (H1 Title)
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      URL Slug
                    </label>
                    <input
                      type="text"
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-mono text-slate-800 focus:border-[var(--gs-primary)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Category
                    </label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as ServiceCategory)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 bg-white"
                    >
                      <option value="Custom Software">Custom Software</option>
                      <option value="AI Integration">AI Integration &amp; RAG</option>
                      <option value="ML Automation">MLOps Automation</option>
                      <option value="Cloud Infrastructure">Cloud Infrastructure</option>
                      <option value="Technical Consulting">Technical Consulting</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Author Attribution
                    </label>
                    <input
                      type="text"
                      value={editAuthor}
                      onChange={(e) => setEditAuthor(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Author Role
                    </label>
                    <input
                      type="text"
                      value={editAuthorRole}
                      onChange={(e) => setEditAuthorRole(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800"
                    />
                  </div>
                </div>

                {/* Unique Cover Visual & AI Cover Generator */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
                      <span>Unique Article Cover Visual</span>
                    </span>
                    <button
                      type="button"
                      disabled={generatingCover || !editTitle.trim()}
                      onClick={async () => {
                        setGeneratingCover(true);
                        try {
                          const coverRes = await api.generateArticleCover({
                            title: editTitle,
                            category: editCategory,
                            primaryKeyword: editPrimaryKeyword,
                            slug: editSlug,
                            excludeUrls: [editCoverImage]
                          });
                          setEditCoverImage(coverRes.url);
                          setEditCoverAlt(coverRes.alt);
                        } catch {
                          const altPick = pickUniqueCoverForArticle({
                            title: editTitle,
                            category: editCategory,
                            keyword: editPrimaryKeyword,
                            excludeUrls: [editCoverImage]
                          });
                          setEditCoverImage(altPick.url);
                          setEditCoverAlt(altPick.alt);
                        } finally {
                          setGeneratingCover(false);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
                    >
                      <Sparkles className="h-3 w-3 text-[var(--gs-primary)]" />
                      <span>{generatingCover ? 'Generating Cover...' : 'Generate Unique AI Cover'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-4 aspect-video rounded-md overflow-hidden border border-slate-200 bg-slate-100">
                      <img
                        src={editCoverImage}
                        alt={editCoverAlt || editTitle}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="sm:col-span-8 space-y-2">
                      <select
                        value={editCoverImage}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditCoverImage(val);
                          const preset = EDITORIAL_COVER_POOL.find((p) => p.url === val);
                          if (preset) setEditCoverAlt(`${editTitle || preset.label} — ${preset.label}`);
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                      >
                        {!EDITORIAL_COVER_POOL.some((p) => p.url === editCoverImage) && (
                          <option value={editCoverImage}>AI-Generated Unique Cover</option>
                        )}
                        {EDITORIAL_COVER_POOL.map((p) => (
                          <option key={p.id} value={p.url}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editCoverAlt}
                        onChange={(e) => setEditCoverAlt(e.target.value)}
                        placeholder="Image alt description"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
                      />
                    </div>
                  </div>
                </div>

                {/* SEO Snippet Controls with Live Tabular Counters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">SEO Meta Title</label>
                      <span
                        className={`font-mono tabular-nums text-[11px] ${
                          editMetaTitle.trim().length >= 30 && editMetaTitle.trim().length <= 68
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {editMetaTitle.trim().length}/68c
                      </span>
                    </div>
                    <input
                      type="text"
                      value={editMetaTitle}
                      onChange={(e) => setEditMetaTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-[var(--gs-primary)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Primary Keyword
                    </label>
                    <input
                      type="text"
                      value={editPrimaryKeyword}
                      onChange={(e) => setEditPrimaryKeyword(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-[var(--gs-primary)] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Executive Summary / GEO TL;DR
                    </label>
                    <span
                      className={`font-mono tabular-nums text-[11px] ${
                        editSummary.trim().length >= 110 && editSummary.trim().length <= 340
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {editSummary.trim().length}/340c (min 110)
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-[var(--gs-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      SEO Meta Description
                    </label>
                    <span
                      className={`font-mono tabular-nums text-[11px] ${
                        editMetaDescription.trim().length >= 115 &&
                        editMetaDescription.trim().length <= 165
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {editMetaDescription.trim().length}/165c (min 115)
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={editMetaDescription}
                    onChange={(e) => setEditMetaDescription(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-[var(--gs-primary)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Structured FAQ & HTTPS Citations Editor */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-800">
                      Structured FAQs ({editFaqs.length} pairs · min 2)
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setEditFaqs((prev) => [...prev, { question: '', answer: '' }])
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline whitespace-nowrap shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add FAQ</span>
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {editFaqs.map((faq, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-200 p-2.5 space-y-1.5 bg-slate-50/40"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={faq.question}
                            placeholder="Question (min 12 chars)"
                            onChange={(e) =>
                              setEditFaqs((prev) =>
                                prev.map((f, i) =>
                                  i === idx ? { ...f, question: e.target.value } : f
                                )
                              )
                            }
                            className="flex-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setEditFaqs((prev) => prev.filter((_, i) => i !== idx))
                            }
                            aria-label="Remove FAQ"
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={faq.answer}
                          placeholder="Concise factual answer (min 30 chars)"
                          onChange={(e) =>
                            setEditFaqs((prev) =>
                              prev.map((f, i) =>
                                i === idx ? { ...f, answer: e.target.value } : f
                              )
                            )
                          }
                          className="w-full rounded border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-800">
                      Authoritative HTTPS Citations ({editReferences.length} URLs · min 2)
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setEditReferences((prev) => [...prev, { title: '', url: 'https://' }])
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline whitespace-nowrap shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Reference</span>
                    </button>
                  </div>
                  <div className="space-y-2">
                    {editReferences.map((ref, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          value={ref.title}
                          placeholder="Source Title"
                          onChange={(e) =>
                            setEditReferences((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, title: e.target.value } : r
                              )
                            )
                          }
                          className="col-span-5 rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800"
                        />
                        <input
                          type="url"
                          value={ref.url}
                          placeholder="https://..."
                          onChange={(e) =>
                            setEditReferences((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, url: e.target.value } : r))
                            )
                          }
                          className="col-span-6 rounded border border-slate-200 px-2.5 py-1.5 text-xs font-mono text-slate-700"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setEditReferences((prev) => prev.filter((_, i) => i !== idx))
                          }
                          aria-label="Remove Reference"
                          className="col-span-1 text-slate-400 hover:text-rose-600 flex justify-center"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Markdown Content Editor */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-slate-900">
                    Markdown Article Body &amp; Field Notes
                  </label>
                  <span className="font-mono tabular-nums text-[11px] text-slate-500">
                    {liveReport.wordCount} counted words (min 800) · {liveReport.h2Count} H2
                    sections
                  </span>
                </div>

                <textarea
                  rows={18}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-3 font-mono text-xs text-slate-900 leading-relaxed focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
            </div>

            {/* Right Column: Live Article Preview */}
            <div className="lg:col-span-6 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    Live Blog Preview &amp; E-E-A-T Verification
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${
                      liveReport.publishEligible ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {liveReport.publishEligible ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {liveReport.publishEligible
                        ? 'Gatekeeper Passed'
                        : 'Resolve Required Checks'}
                    </span>
                  </span>
                </div>

                <div className="prose prose-slate max-w-none text-xs leading-relaxed space-y-3">
                  <h1 className="font-display text-xl font-bold text-slate-900">{editTitle}</h1>
                  <p className="text-xs font-medium text-slate-600 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
                    {editSummary}
                  </p>

                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                      {editAuthor.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{editAuthor}</div>
                      <div className="text-[11px] text-slate-500">
                        {editAuthorRole} · Verified Author
                      </div>
                    </div>
                  </div>

                  <div className="whitespace-pre-wrap font-sans text-xs text-slate-800 leading-relaxed max-h-[640px] overflow-y-auto border border-slate-100 p-3.5 rounded-lg bg-slate-50/30">
                    {editContent}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
