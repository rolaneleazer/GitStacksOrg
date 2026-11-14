import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NewsletterCard } from '../components/NewsletterCard.tsx';
import { ResilientImage } from '../components/ResilientImage.tsx';
import { applySeoMetadata } from '../lib/seo.ts';
import type { Article, ServiceCategory } from '../shared/types.ts';

interface InsightsPageProps {
  articles: Article[];
  loading: boolean;
  onNavigate: (path: string) => void;
}

const CATEGORIES: ('All' | ServiceCategory)[] = [
  'All',
  'AI Integration',
  'ML Automation',
  'Cloud Infrastructure',
  'Custom Software',
  'Technical Consulting'
];

export function InsightsPage({ articles, loading, onNavigate }: InsightsPageProps) {
  const [selectedCategory, setSelectedCategory] = useState<'All' | ServiceCategory>('All');
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('q') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    applySeoMetadata({
      title: 'Technical Insights Journal — AI, MLOps & Cloud Architecture | GitStack',
      description:
        'In-depth engineering blueprints, AI integration patterns, MLOps automation strategies, and cloud governance guides authored by GitStack principal architects.',
      path: '/insights',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'GitStack Technical Insights Journal',
        description:
          'Peer-reviewed engineering articles on AI integration, machine learning automation, custom software, and cloud infrastructure.'
      }
    });
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return articles.filter((a) => {
      const catMatch = selectedCategory === 'All' || a.category === selectedCategory;
      if (!catMatch) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.summary_tldr.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.author_name.toLowerCase().includes(q)
      );
    });
  }, [articles, selectedCategory, searchQuery]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-14 lg:py-20">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-wide text-[#1E40AF]">
          GitStack Engineering Publication
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-900">
          Technical Insights &amp; Architecture Blueprints
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          Long-form production guides authored by GitStack architects. Every article meets strict
          technical depth, source citation, and peer-review standards.
        </p>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="mt-10 flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#1E40AF] text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guides, topics, authors..."
            aria-label="Search technical articles"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1E40AF] focus:outline-none"
          />
        </div>
      </div>

      {/* Article Feed */}
      {loading ? (
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white p-6" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-12 rounded-xl border border-slate-200 bg-white p-10 text-center">
          <h2 className="font-display text-lg font-bold text-slate-900">
            No matching engineering guides found
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Try clearing your search query or switching to All categories.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('All');
              setSearchQuery('');
            }}
            className="mt-4 rounded-lg bg-[#1E40AF] px-4 py-2 text-xs font-semibold text-white"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
          {filtered.map((article) => (
            <article
              key={article.id}
              className="group overflow-hidden rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="aspect-[16/9] overflow-hidden border-b border-slate-200 bg-slate-100">
                  <ResilientImage
                    src={article.cover_image}
                    alt={article.cover_alt || article.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    fallbackTitle={article.category}
                  />
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-[#1E40AF]">{article.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{article.read_time_minutes} min read</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Updated{' '}
                      {new Date(article.updated_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <h2 className="mt-3 font-display text-xl font-bold leading-snug text-slate-900 group-hover:text-[#1E40AF] transition-colors">
                    <a
                      href={`/insights/${article.slug}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate(`/insights/${article.slug}`);
                      }}
                    >
                      {article.title}
                    </a>
                  </h2>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-600 line-clamp-3">
                    {article.summary_tldr}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 text-xs text-slate-500">
                <span>
                  {article.author_name} · {article.author_role}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate(`/insights/${article.slug}`)}
                  className="font-semibold text-[#1E40AF] hover:underline whitespace-nowrap shrink-0"
                >
                  Read full guide →
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-14">
        <NewsletterCard />
      </div>
    </div>
  );
}
