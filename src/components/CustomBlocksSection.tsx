import { ArrowRight } from 'lucide-react';
import { ResilientImage } from './ResilientImage.tsx';
import type { CustomContentBlock } from '../shared/types.ts';

interface CustomBlocksSectionProps {
  blocks: CustomContentBlock[];
  onNavigate: (path: string) => void;
}

export function CustomBlocksSection({ blocks, onNavigate }: CustomBlocksSectionProps) {
  const visibleBlocks = (blocks || []).filter((b) => b.visible && (b.heading.trim() || b.body.trim()));
  if (visibleBlocks.length === 0) return null;

  return (
    <section className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-14 space-y-8 sm:space-y-10">
        {visibleBlocks.map((block, index) => {
          const hasImage = Boolean(block.image_url.trim());
          const href = block.cta_href.trim();
          const isExternal = href.startsWith('http://') || href.startsWith('https://');

          return (
            <div
              key={block.id || index}
              className="rounded-xl border border-slate-200 bg-[var(--gs-canvas-bg)] p-5 sm:p-8"
            >
              <div
                className={
                  hasImage
                    ? 'grid grid-cols-1 items-stretch gap-6 sm:gap-8 lg:grid-cols-12'
                    : 'max-w-3xl'
                }
              >
                <div className={hasImage ? 'flex flex-col justify-center lg:col-span-7' : ''}>
                  <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    {block.heading}
                  </h2>
                  <p className="mt-3 text-sm leading-[1.75] text-slate-600 whitespace-pre-line">
                    {block.body}
                  </p>
                  {block.cta_label.trim() && href && (
                    <div className="mt-5">
                      {isExternal ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex w-full sm:w-auto min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[var(--gs-primary)] hover:bg-[var(--gs-primary-hover)] px-4 py-2.5 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                        >
                          <span>{block.cta_label}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onNavigate(href)}
                          className="inline-flex w-full sm:w-auto min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[var(--gs-primary)] hover:bg-[var(--gs-primary-hover)] px-4 py-2.5 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                        >
                          <span>{block.cta_label}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {hasImage && (
                  <div className="lg:col-span-5">
                    <div className="h-full min-h-[200px] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      <ResilientImage
                        src={block.image_url}
                        alt={block.image_alt || block.heading}
                        className="h-full w-full object-cover"
                        fallbackTitle={block.heading}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
