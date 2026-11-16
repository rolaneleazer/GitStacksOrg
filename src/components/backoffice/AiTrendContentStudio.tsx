import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  Copy,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Flame,
  Globe,
  Layers,
  PenTool,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck
} from 'lucide-react';
import React, { useState } from 'react';
import { api } from '../../lib/api.ts';
import type { GeneratedArticleDraft, TrendingTopicItem } from '../../server/trendScout.ts';
import type { ServiceCategory } from '../../shared/types.ts';

interface AiTrendContentStudioProps {
  onPostPublished?: () => void;
  onNavigateToInsights?: () => void;
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
  const [trendError, setTrendError] = useState<string | null>(null);

  // Step 2 & 3: Draft & Editor state
  const [selectedTopic, setSelectedTopic] = useState<TrendingTopicItem | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState<'idle' | 'research' | 'writing' | 'policy_gate'>('idle');
  const [draft, setDraft] = useState<GeneratedArticleDraft | null>(null);

  // Split-screen editor form fields
  const [editTitle, setEditTitle] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editCategory, setEditCategory] = useState<ServiceCategory>('Custom Software');
  const [editAuthor, setEditAuthor] = useState('Ronel Molina');
  const [editAuthorRole, setEditAuthorRole] = useState('Principal Cloud Architect');
  const [editSummary, setEditSummary] = useState('');
  const [editContent, setEditContent] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);

  // Discover Trends
  const handleDiscoverTrends = async () => {
    setDiscovering(true);
    setTrendError(null);
    try {
      const res = await api.discoverTrends({
        niche: niche.trim(),
        country: country.trim(),
        keywords: keywords.trim()
      });
      setTrends(res.topics);
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

      setDraft(res);
      setEditTitle(res.title);
      setEditSlug(res.slug);
      setEditSummary(res.summary);
      setEditContent(res.content);
      setEditCategory('Custom Software');
    } catch (err) {
      setTrendError(err instanceof Error ? err.message : 'Article generation failed.');
    } finally {
      setGenerating(false);
      setGenerationStage('idle');
    }
  };

  // Publish to Blog (/api/posts)
  const handlePublishToBlog = async () => {
    if (!editTitle.trim() || !editContent.trim()) return;

    setPublishing(true);
    setPublishSuccess(null);

    try {
      await api.createPost({
        title: editTitle.trim(),
        slug: editSlug.trim() || editTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        summary_tldr: editSummary.trim(),
        content_markdown: editContent,
        category: editCategory,
        author_name: editAuthor,
        author_role: editAuthorRole,
        author_bio:
          'Principal Cloud Architect with 13+ years of experience in distributed backend architectures, cloud FinOps, and enterprise compliance.',
        cover_image:
          'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80',
        cover_alt: editTitle,
        meta_title: `${editTitle} | GitStack Insights`,
        meta_description: editSummary.slice(0, 155),
        primary_keyword: keywords.split(',')[0]?.trim() || 'software architecture',
        word_count: editContent.split(/\s+/).filter(Boolean).length,
        read_time_minutes: Math.ceil(editContent.split(/\s+/).filter(Boolean).length / 220),
        status: 'published'
      });

      setPublishSuccess(`Article "${editTitle}" published successfully to the GitStack Insights journal!`);
      if (onPostPublished) onPostPublished();
    } catch (err) {
      setTrendError(err instanceof Error ? err.message : 'Publishing failed.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. TOP HEADER BANNER */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
            <Compass className="h-3.5 w-3.5" />
            <span>Google Search Grounding · 2026 Scaled Content Guardrail</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Anti-Spam &amp; Mandatory Human Value Assurance</span>
          </div>
        </div>

        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            AI Trend Scout &amp; AdSense-Safe Content Studio
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
            Search verified 7-day rising trends, draft 1,000–1,400 word technical engineering guides,
            incorporate structured human-experience placeholders, and publish directly to your live blog.
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
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 transition-colors shadow-xs"
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
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
            {trendError}
          </div>
        )}
      </div>

      {/* 2. TRENDING TOPIC CARDS (STEP 1) */}
      {trends.length > 0 && !draft && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-500" />
              <span>Rising 7-Day High-Opportunity Topics ({trends.length})</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Grounding: Google Search (7-Day Recency)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trends.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between hover:shadow-md transition-shadow space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      {t.searchIntent}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        t.opportunity === 'Breakout'
                          ? 'bg-rose-100 text-rose-800'
                          : t.opportunity === 'Surging'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      <span>{t.opportunity} Opportunity</span>
                    </span>
                  </div>

                  <h4 className="font-display text-sm font-bold text-slate-900 leading-snug">
                    {t.title}
                  </h4>

                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {t.summary}
                  </p>

                  {/* Sources pill strip */}
                  {t.sources && t.sources.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      <div className="text-[10px] font-semibold text-slate-400">Verified Sources:</div>
                      <div className="flex flex-wrap gap-1">
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
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-2xs"
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
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-6 sm:p-8 text-center space-y-4">
          <div className="flex justify-center">
            <RefreshCw className="h-8 w-8 text-[var(--gs-primary)] animate-spin" />
          </div>
          <h3 className="font-display text-base font-bold text-slate-900">
            Multi-Agent Editorial Engine Active
          </h3>
          <div className="max-w-md mx-auto grid grid-cols-3 gap-2 text-xs">
            <div
              className={`rounded-lg p-2.5 border transition-all ${
                generationStage === 'research'
                  ? 'bg-white border-indigo-300 font-bold text-indigo-700 shadow-xs'
                  : 'bg-white/60 border-slate-200 text-slate-500'
              }`}
            >
              Agent 1: Research
            </div>
            <div
              className={`rounded-lg p-2.5 border transition-all ${
                generationStage === 'writing'
                  ? 'bg-white border-indigo-300 font-bold text-indigo-700 shadow-xs'
                  : 'bg-white/60 border-slate-200 text-slate-500'
              }`}
            >
              Agent 2: Value Writer
            </div>
            <div
              className={`rounded-lg p-2.5 border transition-all ${
                generationStage === 'policy_gate'
                  ? 'bg-white border-indigo-300 font-bold text-indigo-700 shadow-xs'
                  : 'bg-white/60 border-slate-200 text-slate-500'
              }`}
            >
              Agent 3: Policy Gate
            </div>
          </div>
          <p className="text-xs text-slate-600">
            Synthesizing 1,000–1,400 words with highlighted human experience callouts...
          </p>
        </div>
      )}

      {/* 3. SPLIT-SCREEN EDITORIAL STUDIO & ONE-CLICK PUBLISHER */}
      {draft && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                ← Back to Topic Trends
              </button>
              <span className="text-slate-300">|</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{draft.policyBadge}</span>
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Word Count: {editContent.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePublishToBlog}
                disabled={publishing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--gs-primary-hover)] transition-all shadow-sm"
              >
                {publishing ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>{publishing ? 'Publishing...' : 'Approve & Publish to Blog'}</span>
              </button>
            </div>
          </div>

          {publishSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>{publishSuccess}</span>
              </div>
              {onNavigateToInsights && (
                <button
                  type="button"
                  onClick={onNavigateToInsights}
                  className="rounded bg-emerald-700 px-3 py-1 text-white hover:bg-emerald-800"
                >
                  View in Journal →
                </button>
              )}
            </div>
          )}

          {/* Split-Screen Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Markdown Editor */}
            <div className="lg:col-span-6 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3.5 shadow-xs">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500">
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

                <div className="grid grid-cols-2 gap-3">
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

                <div className="grid grid-cols-2 gap-3">
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
                      Author Title
                    </label>
                    <input
                      type="text"
                      value={editAuthorRole}
                      onChange={(e) => setEditAuthorRole(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Meta Description &amp; TL;DR
                  </label>
                  <textarea
                    rows={2}
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-[var(--gs-primary)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Markdown Content Editor */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-900">
                    Markdown Content &amp; Human Commentary Blocks
                  </label>
                  <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">
                    Tip: Fill in the [ADD YOUR PERSONAL EXPERIENCE] boxes
                  </span>
                </div>

                <textarea
                  rows={20}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-3 font-mono text-xs text-slate-900 leading-relaxed focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
            </div>

            {/* Right Column: Live Article Preview */}
            <div className="lg:col-span-6 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Live Blog Preview &amp; E-E-A-T Verification
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>AdSense Safe Preview</span>
                  </span>
                </div>

                {/* Simulated Article Body */}
                <div className="prose prose-slate max-w-none text-xs leading-relaxed space-y-3">
                  <h1 className="font-display text-xl font-bold text-slate-900">{editTitle}</h1>
                  <p className="text-xs font-medium text-slate-600 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
                    {editSummary}
                  </p>

                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                      {editAuthor.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{editAuthor}</div>
                      <div className="text-[11px] text-slate-500">{editAuthorRole} · Verified Author</div>
                    </div>
                  </div>

                  <div className="whitespace-pre-wrap font-sans text-xs text-slate-800 leading-relaxed max-h-[500px] overflow-y-auto border border-slate-100 p-3 rounded-lg bg-slate-50/30">
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
