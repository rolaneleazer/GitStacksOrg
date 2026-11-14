import { Check, Copy } from 'lucide-react';
import React, { useState } from 'react';
import { slugify } from '../shared/qualityGate.ts';

export interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

export function extractHeadings(markdown: string): TocHeading[] {
  const lines = markdown.split('\n');
  const result: TocHeading[] = [];
  let inCode = false;
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      result.push({ id: slugify(h2[1]), text: h2[1].trim(), level: 2 });
      continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      result.push({ id: slugify(h3[1]), text: h3[1].trim(), level: 3 });
    }
  }
  return result;
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.875em] text-slate-900 border border-slate-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        const safeHref = /^https?:\/\/|^\/|^#/.test(href) ? href : '#';
        parts.push(
          <a
            key={match.index}
            href={safeHref}
            target={safeHref.startsWith('http') ? '_blank' : undefined}
            rel={safeHref.startsWith('http') ? 'noopener noreferrer' : undefined}
            className="text-[#1E40AF] underline decoration-[#1E40AF]/30 underline-offset-4 hover:decoration-[#1E40AF]"
          >
            {label}
          </a>
        );
      } else {
        parts.push(token);
      }
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="my-6 overflow-hidden rounded-lg border border-slate-200 bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2 text-xs text-slate-400">
        <span className="font-mono">{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

interface MarkdownRendererProps {
  markdown: string;
  midArticleSlot?: React.ReactNode;
}

export function MarkdownRenderer({ markdown, midArticleSlot }: MarkdownRendererProps) {
  const lines = markdown.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let h2RenderedCount = 0;
  let slotInserted = false;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(<CodeBlock key={`code-${i}`} language={lang} code={codeLines.join('\n')} />);
      continue;
    }

    // Headings
    const h2Match = trimmed.match(/^##\s+(.+)$/);
    if (h2Match) {
      h2RenderedCount += 1;
      if (midArticleSlot && !slotInserted && h2RenderedCount === 3) {
        slotInserted = true;
        blocks.push(
          <div key="mid-article-ad-slot" className="my-8">
            {midArticleSlot}
          </div>
        );
      }
      const id = slugify(h2Match[1]);
      blocks.push(
        <h2
          key={`h2-${i}`}
          id={id}
          className="mt-10 mb-4 scroll-mt-24 font-display text-2xl font-bold tracking-tight text-slate-900"
        >
          {h2Match[1]}
        </h2>
      );
      i += 1;
      continue;
    }

    const h3Match = trimmed.match(/^###\s+(.+)$/);
    if (h3Match) {
      const id = slugify(h3Match[1]);
      blocks.push(
        <h3
          key={`h3-${i}`}
          id={id}
          className="mt-7 mb-3 scroll-mt-24 font-display text-lg font-semibold text-slate-900"
        >
          {h3Match[1]}
        </h3>
      );
      i += 1;
      continue;
    }

    // Markdown table
    if (trimmed.startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i += 1;
      }
      const rows = tableLines
        .filter((row) => !/^\|[\s:-]+\|$/.test(row.replace(/\|[\s:-]+/g, '|---')))
        .map((row) =>
          row
            .split('|')
            .slice(1, -1)
            .map((cell) => cell.trim())
        );

      // Filter out separator row cleanly
      const cleanRows = rows.filter(
        (cells) => !cells.every((c) => /^:?-+:?$/.test(c))
      );

      if (cleanRows.length > 0) {
        const [header, ...bodyRows] = cleanRows;
        blocks.push(
          <div key={`table-${i}`} className="my-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {header.map((cell, idx) => (
                    <th key={idx} className="px-4 py-3 font-semibold text-slate-900">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50/70">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-4 py-3 text-slate-700 tabular-nums">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-5 space-y-2.5 pl-5 list-disc text-[16px] leading-[1.7] text-slate-700">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="my-5 space-y-2.5 pl-5 list-decimal text-[16px] leading-[1.7] text-slate-700">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph
    const paraLines: string[] = [trimmed];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('|') &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push(
      <p key={`p-${i}`} className="my-4 text-[16px] leading-[1.75] text-slate-700">
        {renderInline(paraLines.join(' '))}
      </p>
    );
  }

  return <div className="max-w-[68ch]">{blocks}</div>;
}
