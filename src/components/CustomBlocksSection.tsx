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
      <div className="mx-auto max-w-6xl px-6 py-14 space-y-10">
        {visibleBlocks.map((block, index) => {
          const hasImage = Boolean(block.image_url.trim());
          const handleAction = () => {
            const href = block.cta_href.trim();
            if (!href) return;
            if (href.startsWith('http://') || href.startsWith('https://')) {
              window.open(href, '_blank', 'noopener,noreferrer');
            } else {
              onNavigate(href);
            }
          };

          return (
            <div
              key={block.id || index}
              className="rounded-xl border border-slate-200 bg-[#FAFAFC] p-6 sm:p-8"
            >
              <div
                className={
                  hasImage
                    ? 'grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12'
                    : 'max-w-3xl'
                }
              >
                <div className={hasImage ? 'flex flex-col justify-center lg:col-span-7' : ''}>
                  <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
                    {block.heading}
                  </h2>
                  <p className="mt-3 text-sm leading-[1.75] text-slate-600 whitespace-pre-line">
                    {block.body}
                  </p>
                  {block.cta_label.trim() && block.cta_href.trim() && (
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={handleAction}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#1E40AF] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] transition-colors whitespace-nowrap shrink-0"
                      >
                        <span>{block.cta_label}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
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
