import type { Article, ArticleFAQ, ArticleReference, QualityCheckItem, QualityGateReport } from './types.ts';

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'untitled-article';
}

export function countWords(markdown: string): number {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/[#>*_\[\]()\-|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return 0;
  return plain.split(' ').filter(Boolean).length;
}

export function computeReadingTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 215));
}

function countOccurrences(haystack: string, needle: string): number {
  const cleanNeedle = needle.trim().toLowerCase();
  if (!cleanNeedle || cleanNeedle.length < 2) return 0;
  const escaped = cleanNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
  const matches = haystack.match(regex);
  return matches ? matches.length : 0;
}

function detectDuplicateParagraphs(markdown: string): number {
  const paragraphs = markdown
    .split(/\n{2,}/)
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 80 && !p.startsWith('```') && !p.startsWith('|'));
  const seen = new Set<string>();
  let duplicates = 0;
  for (const p of paragraphs) {
    if (seen.has(p)) duplicates += 1;
    seen.add(p);
  }
  return duplicates;
}

export interface ArticleDraftInput {
  title: string;
  summary_tldr: string;
  content_markdown: string;
  author_name: string;
  author_role: string;
  author_bio: string;
  cover_image: string;
  cover_alt: string;
  meta_title: string;
  meta_description: string;
  primary_keyword: string;
  faqs: ArticleFAQ[];
  references: ArticleReference[];
}

export function evaluateArticleQuality(input: ArticleDraftInput): QualityGateReport {
  const wordCount = countWords(input.content_markdown || '');
  const readTimeMinutes = computeReadingTime(wordCount);

  const h2Matches = (input.content_markdown || '').match(/^##\s+.+$/gm) || [];
  const h2Count = h2Matches.length;

  const paragraphs = (input.content_markdown || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !p.startsWith('#') && !p.startsWith('```') && !p.startsWith('|'));
  const longestParagraphWords = paragraphs.reduce((max, p) => Math.max(max, countWords(p)), 0);

  const keyword = (input.primary_keyword || '').trim();
  const keywordHits = keyword ? countOccurrences(input.content_markdown || '', keyword) : 0;
  const keywordWords = keyword ? keyword.split(/\s+/).length : 1;
  const keywordDensityPercent =
    wordCount > 0 && keyword ? Number((((keywordHits * keywordWords) / wordCount) * 100).toFixed(2)) : 0;

  const duplicateParagraphs = detectDuplicateParagraphs(input.content_markdown || '');

  const validFaqs = (input.faqs || []).filter(
    (f) => f.question.trim().length >= 12 && f.answer.trim().length >= 30
  );
  const validRefs = (input.references || []).filter(
    (r) => r.title.trim().length >= 4 && /^https?:\/\/.+/.test(r.url.trim())
  );

  const metaTitleLen = (input.meta_title || input.title || '').trim().length;
  const metaDescLen = (input.meta_description || '').trim().length;
  const tldrLen = (input.summary_tldr || '').trim().length;

  const checks: QualityCheckItem[] = [
    {
      id: 'word-depth',
      pillar: 'AdSense Policy',
      label: 'Substantive Long-Form Depth (No Thin Content)',
      passed: wordCount >= 800,
      requiredForPublish: true,
      measuredValue: `${wordCount} words`,
      targetValue: '800+ words (1,000+ optimal)',
      remediation: 'Expand technical analysis, architecture trade-offs, or implementation steps to at least 800 words.'
    },
    {
      id: 'heading-structure',
      pillar: 'AdSense Policy',
      label: 'Structured Section Hierarchy (H2 Sections)',
      passed: h2Count >= 3 && longestParagraphWords <= 180,
      requiredForPublish: true,
      measuredValue: `${h2Count} H2 headings · max ${longestParagraphWords}w/para`,
      targetValue: '3+ H2 headings · <=180 words per paragraph',
      remediation: 'Break long walls of text into scannable ## H2 sections with concise paragraphs.'
    },
    {
      id: 'originality-density',
      pillar: 'AdSense Policy',
      label: 'Originality & Anti-Keyword-Stuffing Guard',
      passed: duplicateParagraphs === 0 && keywordDensityPercent <= 3.5,
      requiredForPublish: true,
      measuredValue: `${duplicateParagraphs} duplicates · ${keywordDensityPercent}% density`,
      targetValue: '0 duplicate paragraphs · <=3.5% keyword density',
      remediation: 'Remove repeated boilerplate blocks and keep primary keyword usage natural under 3.5%.'
    },
    {
      id: 'eeat-author',
      pillar: 'E-E-A-T Trust',
      label: 'Verified Author Credentials & Bio (E-E-A-T)',
      passed:
        input.author_name.trim().length >= 3 &&
        input.author_role.trim().length >= 4 &&
        input.author_bio.trim().length >= 40,
      requiredForPublish: true,
      measuredValue: `${input.author_bio.trim().length} bio chars`,
      targetValue: 'Name, role, and 40+ char credentials bio',
      remediation: 'Provide the engineering author name, role, and a bio describing real-world domain experience.'
    },
    {
      id: 'citations',
      pillar: 'E-E-A-T Trust',
      label: 'Authoritative Primary Source Citations',
      passed: validRefs.length >= 2,
      requiredForPublish: true,
      measuredValue: `${validRefs.length} verified URLs`,
      targetValue: '2+ HTTPS citations',
      remediation: 'Add at least two verifiable HTTPS documentation, research, or standards references.'
    },
    {
      id: 'geo-tldr',
      pillar: 'AI Search (GEO)',
      label: 'Direct-Answer Executive Summary (LLM Citation Block)',
      passed: tldrLen >= 110 && tldrLen <= 340,
      requiredForPublish: true,
      measuredValue: `${tldrLen} chars`,
      targetValue: '110–340 chars',
      remediation: 'Write a concise 2-sentence factual TL;DR answer block so ChatGPT, Gemini, and Perplexity cite GitStack accurately.'
    },
    {
      id: 'geo-faqs',
      pillar: 'AI Search (GEO)',
      label: 'Structured FAQ Schema Pairs (FAQPage JSON-LD)',
      passed: validFaqs.length >= 2,
      requiredForPublish: true,
      measuredValue: `${validFaqs.length} FAQ pairs`,
      targetValue: '2+ complete Q&A pairs',
      remediation: 'Include at least 2 domain-specific Q&A pairs for Answer Engine Optimization and rich snippets.'
    },
    {
      id: 'seo-meta',
      pillar: 'On-Page SEO',
      label: 'Search Snippet Meta Title & Description',
      passed: metaTitleLen >= 30 && metaTitleLen <= 68 && metaDescLen >= 115 && metaDescLen <= 165,
      requiredForPublish: true,
      measuredValue: `Title ${metaTitleLen}c · Desc ${metaDescLen}c`,
      targetValue: 'Title 30–68c · Desc 115–165c',
      remediation: 'Tune Meta Title (30–68 chars) and Meta Description (115–165 chars) to prevent search truncation.'
    },
    {
      id: 'media-alt',
      pillar: 'On-Page SEO',
      label: 'Cover Media & Descriptive Alt Attribution',
      passed: input.cover_image.trim().length > 0 && input.cover_alt.trim().length >= 15,
      requiredForPublish: false,
      measuredValue: input.cover_alt.trim().length >= 15 ? 'Alt verified' : 'Missing alt text',
      targetValue: 'Image + 15+ char alt text',
      remediation: 'Select a cover image and describe the visual clearly for accessibility and image search.'
    }
  ];

  const blockingIssues = checks
    .filter((c) => c.requiredForPublish && !c.passed)
    .map((c) => `${c.label}: ${c.remediation}`);

  const totalPassed = checks.filter((c) => c.passed).length;
  const qualityScore = Math.round((totalPassed / checks.length) * 100);

  const geoChecks = checks.filter(
    (c) => c.pillar === 'AI Search (GEO)' || c.id === 'citations' || c.id === 'heading-structure'
  );
  const geoPassed = geoChecks.filter((c) => c.passed).length;
  const geoScore = Math.round((geoPassed / geoChecks.length) * 100);

  return {
    wordCount,
    readTimeMinutes,
    h2Count,
    keywordDensityPercent,
    qualityScore,
    geoScore,
    publishEligible: blockingIssues.length === 0,
    blockingIssues,
    checks
  };
}

export function buildArticleJsonLd(article: Article, origin: string) {
  const canonical = `${origin}/insights/${article.slug}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        '@id': `${canonical}#article`,
        headline: article.title,
        description: article.meta_description || article.summary_tldr,
        abstract: article.summary_tldr,
        articleSection: article.category,
        wordCount: article.word_count,
        datePublished: article.published_at || article.created_at,
        dateModified: article.updated_at,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': canonical
        },
        author: {
          '@type': 'Person',
          name: article.author_name,
          jobTitle: article.author_role,
          description: article.author_bio,
          worksFor: {
            '@type': 'Organization',
            name: 'GitStack',
            url: origin
          }
        },
        publisher: {
          '@type': 'Organization',
          name: 'GitStack',
          url: origin
        },
        citation: article.references.map((r) => r.url)
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: origin },
          { '@type': 'ListItem', position: 2, name: 'Insights', item: `${origin}/insights` },
          { '@type': 'ListItem', position: 3, name: article.title, item: canonical }
        ]
      },
      ...(article.faqs.length > 0
        ? [
            {
              '@type': 'FAQPage',
              mainEntity: article.faqs.map((faq) => ({
                '@type': 'Question',
                name: faq.question,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: faq.answer
                }
              }))
            }
          ]
        : [])
    ]
  };
}
