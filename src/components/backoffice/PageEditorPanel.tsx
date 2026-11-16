import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  ImagePlus,
  Plus,
  RotateCcw,
  Save,
  Trash2
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  DEFAULT_PAGE_CONTENTS,
  STUDIO_IMAGE_LIBRARY,
  validatePageContentForAdSense
} from '../../shared/pageDefaults.ts';
import type { CustomContentBlock, PageContentConfig, PageKey } from '../../shared/types.ts';
import { ResilientImage } from '../ResilientImage.tsx';

interface PageEditorPanelProps {
  pages: PageContentConfig[];
  onSavePage: (pageKey: PageKey, config: PageContentConfig) => Promise<void>;
  onPreviewRoute: (path: string) => void;
}

const PAGE_LABELS: { key: PageKey; label: string; route: string }[] = [
  { key: 'home', label: 'Home Page', route: '/' },
  { key: 'services', label: 'Services Page', route: '/services' },
  { key: 'about', label: 'About GitStack', route: '/about' },
  { key: 'contact', label: 'Contact & Intake', route: '/contact' }
];

export function PageEditorPanel({
  pages,
  onSavePage,
  onPreviewRoute
}: PageEditorPanelProps) {
  const [activeKey, setActiveKey] = useState<PageKey>('home');
  const [drafts, setDrafts] = useState<Record<PageKey, PageContentConfig>>(() => {
    const map: Record<PageKey, PageContentConfig> = { ...DEFAULT_PAGE_CONTENTS };
    for (const p of pages) {
      map[p.page_key] = {
        ...DEFAULT_PAGE_CONTENTS[p.page_key],
        ...p,
        ...(p.page_key === 'contact'
          ? {
              contact_phone_label:
                p.contact_phone_label?.trim() ||
                DEFAULT_PAGE_CONTENTS.contact.contact_phone_label,
              contact_phone:
                p.contact_phone?.trim() || DEFAULT_PAGE_CONTENTS.contact.contact_phone,
              contact_sales_label:
                p.contact_sales_label?.trim() ||
                DEFAULT_PAGE_CONTENTS.contact.contact_sales_label,
              contact_sales_email:
                p.contact_sales_email?.trim() ||
                DEFAULT_PAGE_CONTENTS.contact.contact_sales_email,
              contact_editorial_label:
                p.contact_editorial_label?.trim() ||
                DEFAULT_PAGE_CONTENTS.contact.contact_editorial_label,
              contact_editorial_email:
                p.contact_editorial_email?.trim() ||
                DEFAULT_PAGE_CONTENTS.contact.contact_editorial_email,
              contact_privacy_label:
                p.contact_privacy_label?.trim() ||
                DEFAULT_PAGE_CONTENTS.contact.contact_privacy_label,
              contact_privacy_email:
                p.contact_privacy_email?.trim() ||
                DEFAULT_PAGE_CONTENTS.contact.contact_privacy_email
            }
          : {})
      };
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const current = drafts[activeKey] || DEFAULT_PAGE_CONTENTS[activeKey];
  const integrity = useMemo(() => validatePageContentForAdSense(current), [current]);

  const updateField = <K extends keyof PageContentConfig>(field: K, value: PageContentConfig[K]) => {
    setDrafts((prev) => ({
      ...prev,
      [activeKey]: {
        ...prev[activeKey],
        [field]: value
      }
    }));
  };

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    onResult: (dataUrl: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 900_000) {
      setStatusMsg({
        type: 'err',
        text: 'Please choose an image under 900 KB or select a studio asset URL to keep page load speed AdSense-optimal.'
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onResult(reader.result);
        setStatusMsg(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const addCustomBlock = () => {
    const nextBlock: CustomContentBlock = {
      id: `blk-${Math.random().toString(36).slice(2, 9)}`,
      heading: 'Enterprise AI Governance & SLA Commitment',
      body: 'Every GitStack architecture deployment includes documented runbooks, security compliance mapping, and measurable uptime benchmarks tailored to your engineering environment.',
      image_url: '',
      image_alt: '',
      cta_label: 'Book Technical Review',
      cta_href: '/contact',
      visible: true
    };
    updateField('custom_blocks', [...current.custom_blocks, nextBlock]);
  };

  const updateBlock = (idx: number, patch: Partial<CustomContentBlock>) => {
    const next = [...current.custom_blocks];
    next[idx] = { ...next[idx], ...patch };
    updateField('custom_blocks', next);
  };

  const removeBlock = (idx: number) => {
    updateField(
      'custom_blocks',
      current.custom_blocks.filter((_, i) => i !== idx)
    );
  };

  const handleSave = async () => {
    setStatusMsg(null);
    if (!integrity.valid) {
      setStatusMsg({
        type: 'err',
        text: integrity.issues[0] || 'Resolve AdSense content integrity checks before saving.'
      });
      return;
    }
    setSaving(true);
    try {
      await onSavePage(activeKey, current);
      setStatusMsg({
        type: 'ok',
        text: `${PAGE_LABELS.find((l) => l.key === activeKey)?.label} content saved. Public layout & AdSense score preserved.`
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save page changes.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    setDrafts((prev) => ({
      ...prev,
      [activeKey]: { ...DEFAULT_PAGE_CONTENTS[activeKey], custom_blocks: [] }
    }));
    setStatusMsg({
      type: 'ok',
      text: 'Restored original copy and images in editor. Click Save Changes to publish.'
    });
  };

  const activeMeta = PAGE_LABELS.find((l) => l.key === activeKey)!;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Public Page Content &amp; Media Customizer
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Edit headlines, descriptions, pictures, and append new sections for each public page
            without altering responsive design or Google AdSense policy compliance.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onPreviewRoute(activeMeta.route)}
          className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>View Live {activeMeta.label}</span>
        </button>
      </div>

      {/* Page Selector Tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-full sm:w-fit">
        {PAGE_LABELS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              setActiveKey(p.key);
              setStatusMsg(null);
            }}
            className={`min-h-[38px] flex-1 sm:flex-none rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeKey === p.key
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Main Structured Form (8 cols) */}
        <div className="space-y-6 lg:col-span-8 min-w-0">
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
            <h3 className="font-display text-sm font-bold text-slate-900 border-b border-slate-200 pb-3">
              Core Copy &amp; Hero Section ({activeMeta.route})
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Kicker / Category Line
                </label>
                <input
                  type="text"
                  value={current.hero_kicker}
                  onChange={(e) => updateField('hero_kicker', e.target.value)}
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Primary Button / CTA Label
                </label>
                <input
                  type="text"
                  value={current.hero_cta_label}
                  onChange={(e) => updateField('hero_cta_label', e.target.value)}
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Primary Headline (H1)
                </label>
                <input
                  type="text"
                  value={current.hero_title}
                  onChange={(e) => updateField('hero_title', e.target.value)}
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Overview / Subtitle Copy
                </label>
                <textarea
                  rows={3}
                  value={current.hero_subtitle}
                  onChange={(e) => updateField('hero_subtitle', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs leading-relaxed text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  {activeKey === 'contact'
                    ? 'Consultation Hours & Office Address Heading'
                    : 'Section Sub-Heading'}
                </label>
                <input
                  type="text"
                  value={current.intro_heading}
                  onChange={(e) => updateField('intro_heading', e.target.value)}
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  {activeKey === 'contact'
                    ? 'Office Address, Hours & Response SLA Copy'
                    : 'Section Supporting Copy'}
                </label>
                <textarea
                  rows={2}
                  value={current.intro_body}
                  onChange={(e) => updateField('intro_body', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
            </div>

            {activeKey === 'contact' && (
              <div className="border-t border-slate-200 pt-5 space-y-4">
                <div>
                  <h4 className="font-display text-xs font-bold text-slate-900">
                    Direct Contact Directory, Phone Number &amp; Email Channels
                  </h4>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Customize the clickable phone number, inquiry email channels, and labels shown
                    in the left column of the public /contact page.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Phone Number Heading Label
                    </label>
                    <input
                      type="text"
                      value={current.contact_phone_label ?? 'Direct Phone & Consultation Line'}
                      onChange={(e) => updateField('contact_phone_label', e.target.value)}
                      placeholder="Direct Phone & Consultation Line"
                      className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Contact Phone Number (Clickable tel: link)
                    </label>
                    <input
                      type="text"
                      value={current.contact_phone ?? '+1 (415) 890-4210'}
                      onChange={(e) => updateField('contact_phone', e.target.value)}
                      placeholder="+1 (415) 890-4210"
                      className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 font-mono px-3 py-2 text-xs text-slate-900 tabular-nums focus:border-[var(--gs-primary)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Channel 1 Heading (Project Inquiries)
                    </label>
                    <input
                      type="text"
                      value={current.contact_sales_label ?? 'New Project Inquiries'}
                      onChange={(e) => updateField('contact_sales_label', e.target.value)}
                      placeholder="New Project Inquiries"
                      className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Channel 1 Email Address
                    </label>
                    <input
                      type="email"
                      value={current.contact_sales_email ?? 'contact@gitstack.io'}
                      onChange={(e) => updateField('contact_sales_email', e.target.value)}
                      placeholder="contact@gitstack.io"
                      className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 font-mono px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Channel 2 Heading (Editorial &amp; Press)
                    </label>
                    <input
                      type="text"
                      value={current.contact_editorial_label ?? 'Editorial & Press'}
                      onChange={(e) => updateField('contact_editorial_label', e.target.value)}
                      placeholder="Editorial & Press"
                      className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Channel 2 Email Address
                    </label>
                    <input
                      type="email"
                      value={current.contact_editorial_email ?? 'editorial@gitstack.io'}
                      onChange={(e) => updateField('contact_editorial_email', e.target.value)}
                      placeholder="editorial@gitstack.io"
                      className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 font-mono px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Channel 3 Heading (Privacy &amp; Compliance)
                    </label>
                    <input
                      type="text"
                      value={current.contact_privacy_label ?? 'Privacy & Compliance'}
                      onChange={(e) => updateField('contact_privacy_label', e.target.value)}
                      placeholder="Privacy & Compliance"
                      className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Channel 3 Email Address
                    </label>
                    <input
                      type="email"
                      value={current.contact_privacy_email ?? 'privacy@gitstack.io'}
                      onChange={(e) => updateField('contact_privacy_email', e.target.value)}
                      placeholder="privacy@gitstack.io"
                      className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 font-mono px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Picture Customization */}
            <div className="border-t border-slate-200 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900">Primary Page Image</h4>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
                  <ImagePlus className="h-3.5 w-3.5" />
                  <span>Upload Image (&lt;900KB)</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, (url) => updateField('hero_image', url))}
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Studio Asset or Verified URL
                  </label>
                  <select
                    value={
                      STUDIO_IMAGE_LIBRARY.some((i) => i.url === current.hero_image)
                        ? current.hero_image
                        : '__custom__'
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== '__custom__') {
                        const preset = STUDIO_IMAGE_LIBRARY.find((i) => i.url === val);
                        updateField('hero_image', val);
                        if (preset && !current.hero_image_alt) {
                          updateField('hero_image_alt', preset.defaultAlt);
                        }
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="">No Hero Banner Image</option>
                    {STUDIO_IMAGE_LIBRARY.map((img) => (
                      <option key={img.url} value={img.url}>
                        {img.label}
                      </option>
                    ))}
                    <option value="__custom__">Custom Image URL / Upload</option>
                  </select>
                  <input
                    type="text"
                    value={current.hero_image}
                    onChange={(e) => updateField('hero_image', e.target.value)}
                    placeholder="Optional image URL (/src/assets/... or https://...)"
                    className="mt-2 w-full rounded-lg border border-slate-200 font-mono px-3 py-1.5 text-[11px] text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Image Alt Text (Required for SEO &amp; Accessibility)
                  </label>
                  <input
                    type="text"
                    value={current.hero_image_alt}
                    onChange={(e) => updateField('hero_image_alt', e.target.value)}
                    placeholder="Describe the image accurately..."
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                  />
                  {current.hero_image && (
                    <div className="mt-2 h-20 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      <ResilientImage
                        src={current.hero_image}
                        alt={current.hero_image_alt || 'Preview'}
                        className="h-full w-full object-cover"
                        fallbackTitle="Preview"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Add More Content & Picture Blocks */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Additional Content &amp; Picture Sections ({current.custom_blocks.length})
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Append structured content sections with text, images, and CTAs onto {activeMeta.label}.
                </p>
              </div>
              <button
                type="button"
                onClick={addCustomBlock}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Section</span>
              </button>
            </div>

            {current.custom_blocks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                No extra sections added to {activeMeta.label} yet. Click &ldquo;Add Section&rdquo;
                above to append custom copy or pictures.
              </div>
            ) : (
              <div className="space-y-4">
                {current.custom_blocks.map((block, idx) => (
                  <div
                    key={block.id}
                    className="rounded-lg border border-slate-200 bg-[var(--gs-canvas-bg)] p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        Added Section #{idx + 1}
                      </span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={block.visible}
                            onChange={(e) => updateBlock(idx, { visible: e.target.checked })}
                          />
                          <span>Visible</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeBlock(idx)}
                          className="text-slate-400 hover:text-red-700 p-1"
                          aria-label={`Remove section ${idx + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={block.heading}
                      onChange={(e) => updateBlock(idx, { heading: e.target.value })}
                      placeholder="Section Heading"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                    />
                    <textarea
                      rows={3}
                      value={block.body}
                      onChange={(e) => updateBlock(idx, { body: e.target.value })}
                      placeholder="Substantive body copy (30+ characters)..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                    />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-slate-700">
                            Picture URL (Optional)
                          </label>
                          <label className="cursor-pointer text-[11px] font-semibold text-[var(--gs-primary)] hover:underline">
                            Upload
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) =>
                                handleImageUpload(e, (url) => updateBlock(idx, { image_url: url }))
                              }
                            />
                          </label>
                        </div>
                        <input
                          type="text"
                          value={block.image_url}
                          onChange={(e) => updateBlock(idx, { image_url: e.target.value })}
                          placeholder="/src/assets/images/... or https://..."
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white font-mono px-3 py-1.5 text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700">
                          Picture Alt Text
                        </label>
                        <input
                          type="text"
                          value={block.image_alt}
                          onChange={(e) => updateBlock(idx, { image_alt: e.target.value })}
                          placeholder="Descriptive alt attribute..."
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700">
                          Button Label (Optional)
                        </label>
                        <input
                          type="text"
                          value={block.cta_label}
                          onChange={(e) => updateBlock(idx, { cta_label: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700">
                          Button Target Route
                        </label>
                        <input
                          type="text"
                          value={block.cta_href}
                          onChange={(e) => updateBlock(idx, { cta_href: e.target.value })}
                          placeholder="/contact or /services"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white font-mono px-3 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {statusMsg && (
            <div
              className={`rounded-lg border px-4 py-3 text-xs font-medium ${
                statusMsg.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {statusMsg.text}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset to Original Copy</span>
            </button>
            <button
              type="button"
              disabled={saving || !integrity.valid}
              onClick={handleSave}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? 'Saving...' : `Publish ${activeMeta.label} Changes`}</span>
            </button>
          </div>
        </div>

        {/* Right Sticky Integrity Shield (4 cols) */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 sticky top-24">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-900">
                AdSense &amp; Layout Integrity Shield
              </h3>
              {integrity.valid ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Protected</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#DC2626]">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Blocked</span>
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-200 py-4 text-xs">
              <div>
                <div className="text-slate-500">Page Copy Depth</div>
                <div className="mt-0.5 font-mono text-lg font-bold text-slate-900 tabular-nums">
                  {integrity.wordCount} words
                </div>
              </div>
              <div>
                <div className="text-slate-500">Added Sections</div>
                <div className="mt-0.5 font-mono text-lg font-bold text-slate-900 tabular-nums">
                  {current.custom_blocks.filter((b) => b.visible).length} active
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2.5 text-xs text-slate-600">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#16A34A]" />
                <span>Public CSS grid, typography, header &amp; footer remain locked intact.</span>
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#16A34A]" />
                <span>7 Legal &amp; Trust pages and AdSense slot spacing cannot be overwritten.</span>
              </p>
              {integrity.issues.map((issue, idx) => (
                <p key={idx} className="flex items-start gap-2 text-[#DC2626] font-medium">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{issue}</span>
                </p>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
