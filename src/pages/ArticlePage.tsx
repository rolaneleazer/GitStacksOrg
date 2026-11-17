import { ArrowLeft, BookOpen, ExternalLink, MessageSquare, User } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { type ConsentPreference, PolicySafeAdSlot } from '../components/AdSenseCompliance.tsx';
import { AuthorEeatCard } from '../components/AdSenseTrustSignals.tsx';
import { MarkdownRenderer, extractHeadings } from '../components/MarkdownRenderer.tsx';
import { NewsletterCard } from '../components/NewsletterCard.tsx';
import { ResilientImage } from '../components/ResilientImage.tsx';
import { api } from '../lib/api.ts';
import { applySeoMetadata } from '../lib/seo.ts';
import { buildArticleJsonLd } from '../shared/qualityGate.ts';
import type { AdSenseSettings, Article, ArticleComment } from '../shared/types.ts';

interface ArticlePageProps {
  slug: string;
  articles: Article[];
  adSenseSettings: AdSenseSettings | null;
  consent: ConsentPreference;
  onOpenCookiePrefs: () => void;
  onNavigate: (path: string) => void;
}

export function ArticlePage({
  slug,
  articles,
  adSenseSettings,
  consent,
  onOpenCookiePrefs,
  onNavigate
}: ArticlePageProps) {
  const [article, setArticle] = useState<Article | null>(
    () => articles.find((a) => a.slug === slug) || null
  );
  const [loading, setLoading] = useState(!article);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  // Comment form state
  const [commentName, setCommentName] = useState('');
  const [commentEmail, setCommentEmail] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSuccess, setCommentSuccess] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    const localMatch = articles.find((a) => a.slug === slug);
    if (localMatch) {
      setArticle(localMatch);
      setLoading(false);
    } else {
      setLoading(true);
      api
        .getPost(slug)
        .then((res) => setArticle(res.post))
        .catch(() => setArticle(null))
        .finally(() => setLoading(false));
    }
  }, [slug, articles]);

  useEffect(() => {
    if (!article) return;
    applySeoMetadata({
      title: article.meta_title || `${article.title} | GitStack`,
      description: article.meta_description || article.summary_tldr,
      path: `/insights/${article.slug}`,
      ogType: 'article',
      jsonLd: buildArticleJsonLd(article, window.location.origin)
    });

    setLoadingComments(true);
    api
      .listComments(article.id)
      .then((res) => setComments(res.comments))
      .catch(() => setComments([]))
      .finally(() => setLoadingComments(false));
  }, [article]);

  const headings = useMemo(
    () => (article ? extractHeadings(article.content_markdown) : []),
    [article]
  );

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!article) return;
    setCommentError(null);
    setCommentSuccess(null);

    if (commentName.trim().length < 2) {
      setCommentError('Please enter your name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(commentEmail.trim())) {
      setCommentError('Please enter a valid email address (not published publicly).');
      return;
    }
    if (commentBody.trim().length < 10) {
      setCommentError('Please write a constructive comment of at least 10 characters.');
      return;
    }

    setSubmittingComment(true);
    try {
      const res = await api.submitComment({
        post_id: article.id,
        author_name: commentName.trim(),
        author_email: commentEmail.trim(),
        body: commentBody.trim()
      });
      if (res.comment.status === 'approved') {
        setComments((prev) => [res.comment, ...prev]);
        setCommentSuccess('Your comment has been published to the discussion.');
      } else {
        setCommentSuccess('Your comment has been submitted for editorial review.');
      }
      setCommentName('');
      setCommentEmail('');
      setCommentBody('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Unable to post comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12 sm:py-16">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-6 h-12 w-full animate-pulse rounded bg-slate-200" />
        <div className="mt-8 h-72 w-full animate-pulse rounded-xl bg-slate-200" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14 sm:py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Technical Article Not Found
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          The requested engineering guide may have been moved or is still in editorial draft review.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/insights')}
          className="mt-6 min-h-[44px] rounded-lg bg-[var(--gs-primary)] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] transition-colors"
        >
          Return to Technical Insights
        </button>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
      <button
        type="button"
        onClick={() => onNavigate('/insights')}
        className="inline-flex min-h-[44px] sm:min-h-0 items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[var(--gs-primary)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Technical Insights</span>
      </button>

      {/* Article Header */}
      <header className="mt-5 sm:mt-6 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold text-[var(--gs-primary)]">{article.category}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{article.read_time_minutes} min read</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{article.word_count} words</span>
          <span aria-hidden="true">·</span>
          <span>
            Updated{' '}
            {new Date(article.updated_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}
          </span>
        </div>

        <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
          {article.title}
        </h1>

        <div className="mt-5 flex items-center gap-3 text-xs text-slate-600">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
            <User className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">{article.author_name}</div>
            <div>{article.author_role}</div>
          </div>
        </div>
      </header>

      {/* Cover Image */}
      <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 max-h-[460px]">
        <ResilientImage
          src={article.cover_image}
          alt={article.cover_alt || article.title}
          className="h-full w-full max-h-[460px] object-cover"
          fallbackTitle={article.title}
        />
      </div>

      {/* Main Content + Sticky Sidebar */}
      <div className="mt-8 sm:mt-10 grid grid-cols-1 gap-10 lg:gap-12 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          {/* Executive Summary / AI Answer Block */}
          <section
            aria-label="Executive Summary"
            className="mb-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--gs-primary)]">
              <BookOpen className="h-4 w-4" />
              <span>Executive Architecture Summary</span>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-700">{article.summary_tldr}</p>
          </section>

          <MarkdownRenderer
            markdown={article.content_markdown}
            midArticleSlot={
              <PolicySafeAdSlot
                settings={adSenseSettings}
                consent={consent}
                onOpenCookiePrefs={onOpenCookiePrefs}
              />
            }
          />

          {/* Structured FAQs for Readers & Answer Engines */}
          {article.faqs.length > 0 && (
            <section className="mt-12 border-t border-slate-200 pt-10">
              <h2 className="font-display text-2xl font-bold text-slate-900">
                Frequently Asked Questions
              </h2>
              <div className="mt-5 space-y-5">
                {article.faqs.map((faq) => (
                  <div key={faq.question} className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="font-display text-base font-bold text-slate-900">
                      {faq.question}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Authoritative Citations */}
          {article.references.length > 0 && (
            <section className="mt-10 border-t border-slate-200 pt-8">
              <h2 className="font-display text-lg font-bold text-slate-900">
                References &amp; Primary Sources
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {article.references.map((ref) => (
                  <li key={ref.url}>
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[var(--gs-primary)] hover:underline break-words"
                    >
                      <span>{ref.title}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* E-E-A-T Author Bio Box */}
          <section className="mt-10" aria-label="About the Author">
            <AuthorEeatCard
              name={article.author_name}
              role={article.author_role}
              bio={article.author_bio}
            />
          </section>

          {/* Newsletter Signup */}
          <div className="mt-10">
            <NewsletterCard defaultTopic={article.category} />
          </div>

          {/* Reader Comments Module */}
          <section id="comments" className="mt-12 border-t border-slate-200 pt-10">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[var(--gs-primary)]" />
              <h2 className="font-display text-2xl font-bold text-slate-900">
                Engineering Discussion ({comments.length})
              </h2>
            </div>

            <form
              onSubmit={handleCommentSubmit}
              className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
              noValidate
            >
              <h3 className="font-display text-sm font-bold text-slate-900">
                Contribute a Technical Comment
              </h3>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="cmt-name" className="block text-xs font-semibold text-slate-700">
                    Your Name
                  </label>
                  <input
                    id="cmt-name"
                    type="text"
                    required
                    value={commentName}
                    onChange={(e) => setCommentName(e.target.value)}
                    placeholder="Samira Patel"
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="cmt-email" className="block text-xs font-semibold text-slate-700">
                    Email (kept private)
                  </label>
                  <input
                    id="cmt-email"
                    type="email"
                    required
                    value={commentEmail}
                    onChange={(e) => setCommentEmail(e.target.value)}
                    placeholder="samira@company.com"
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label htmlFor="cmt-body" className="block text-xs font-semibold text-slate-700">
                  Comment
                </label>
                <textarea
                  id="cmt-body"
                  rows={3}
                  required
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Share production trade-offs, implementation questions, or benchmark observations..."
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                />
              </div>
              {commentError && (
                <p className="mt-3 text-xs font-medium text-red-700">{commentError}</p>
              )}
              {commentSuccess && (
                <p className="mt-3 text-xs font-medium text-[#16A34A]">{commentSuccess}</p>
              )}
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={submittingComment}
                  className="min-h-[44px] w-full sm:w-auto rounded-lg bg-[var(--gs-primary)] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 transition-colors"
                >
                  {submittingComment ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </form>

            <div className="mt-6 space-y-4">
              {loadingComments ? (
                <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
              ) : comments.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No comments yet. Be the first engineer to start the thread.
                </p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold text-slate-900">{c.author_name}</span>
                      <span>
                        {new Date(c.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <p className="mt-2.5 text-sm leading-relaxed text-slate-700">{c.body}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Sticky Table of Contents & Service CTA Sidebar */}
        <aside className="lg:col-span-4">
          <div className="sticky top-24 space-y-6">
            {headings.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="font-display text-xs font-semibold tracking-wide text-slate-900">
                  In This Guide
                </h2>
                <nav aria-label="Table of Contents" className="mt-3 space-y-2 text-xs">
                  {headings.map((h) => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      className={`block py-1 sm:py-0.5 leading-snug text-slate-600 hover:text-[var(--gs-primary)] ${
                        h.level === 3 ? 'pl-3' : 'font-medium'
                      }`}
                    >
                      {h.text}
                    </a>
                  ))}
                </nav>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-semibold text-[var(--gs-primary)]">
                Need Implementation Support?
              </div>
              <h3 className="mt-1.5 font-display text-base font-bold text-slate-900">
                Work With GitStack Principal Architects
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Ready to deploy {article.category.toLowerCase()} in production with security,
                observability, and clear ROI?
              </p>
              <button
                type="button"
                onClick={() => onNavigate('/contact')}
                className="mt-4 min-h-[44px] w-full rounded-lg bg-[var(--gs-primary)] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] transition-colors"
              >
                Book Architecture Review
              </button>
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}
