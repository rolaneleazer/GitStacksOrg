import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.ts';
import type {
  ChatAutoResponseSettings,
  ChatAutoResponseTemplate
} from '../../shared/types.ts';

interface DraftTemplateForm {
  id: string;
  question_label: string;
  answer_body: string;
  keywordsText: string;
  category: string;
  sort_order: number;
  is_active: boolean;
  show_as_quick_chip: boolean;
  escalate_prompt_enabled: boolean;
}

function toFormState(tpl: ChatAutoResponseTemplate): DraftTemplateForm {
  return {
    id: tpl.id,
    question_label: tpl.question_label,
    answer_body: tpl.answer_body,
    keywordsText: (tpl.keywords || []).join(', '),
    category: tpl.category || 'General',
    sort_order: tpl.sort_order ?? 0,
    is_active: tpl.is_active !== false,
    show_as_quick_chip: tpl.show_as_quick_chip !== false,
    escalate_prompt_enabled: tpl.escalate_prompt_enabled !== false
  };
}

export function ChatAutoResponsePanel() {
  const [templates, setTemplates] = useState<ChatAutoResponseTemplate[]>([]);
  const [settings, setSettings] = useState<ChatAutoResponseSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<DraftTemplateForm>({
    id: '',
    question_label: '',
    answer_body: '',
    keywordsText: '',
    category: 'General',
    sort_order: 10,
    is_active: true,
    show_as_quick_chip: true,
    escalate_prompt_enabled: true
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAdminChatAutoResponses();
      setTemplates(res.templates);
      setSettings(res.settings);
      setSelectedId((prev) => {
        const keep = prev && res.templates.some((t) => t.id === prev);
        const target = keep ? res.templates.find((t) => t.id === prev)! : res.templates[0];
        if (target) setForm(toFormState(target));
        return target?.id || null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Chat Auto-Response templates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return templates
      .filter((t) => {
        if (statusFilter === 'active' && !t.is_active) return false;
        if (statusFilter === 'draft' && t.is_active) return false;
        if (!q) return true;
        return (
          t.question_label.toLowerCase().includes(q) ||
          t.answer_body.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.keywords.some((k) => k.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [templates, searchQuery, statusFilter]);

  const handleSelectTemplate = (tpl: ChatAutoResponseTemplate) => {
    setSelectedId(tpl.id);
    setForm(toFormState(tpl));
    setNotice(null);
    setError(null);
  };

  const handleNewTemplate = () => {
    const maxOrder = templates.reduce((max, t) => Math.max(max, t.sort_order), 0);
    setSelectedId('new');
    setForm({
      id: '',
      question_label: '',
      answer_body: '',
      keywordsText: '',
      category: 'General',
      sort_order: maxOrder + 1,
      is_active: true,
      show_as_quick_chip: true,
      escalate_prompt_enabled: true
    });
    setNotice(null);
    setError(null);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.question_label.trim() || !form.answer_body.trim()) {
      setError('Both Question Chip Label and Nominated Auto-Response Answer are required.');
      return;
    }
    setSavingTemplate(true);
    setError(null);
    setNotice(null);
    try {
      const keywords = form.keywordsText
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
      const payload = {
        question_label: form.question_label.trim(),
        answer_body: form.answer_body.trim(),
        keywords,
        category: form.category.trim() || 'General',
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
        show_as_quick_chip: form.show_as_quick_chip,
        escalate_prompt_enabled: form.escalate_prompt_enabled
      };
      const res =
        form.id && selectedId !== 'new'
          ? await api.updateAdminChatAutoResponse(form.id, payload)
          : await api.createAdminChatAutoResponse(payload);
      setTemplates(res.templates);
      setSelectedId(res.template.id);
      setForm(toFormState(res.template));
      setNotice('Auto-Response template saved and public FAQ cache refreshed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save auto-response template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    setError(null);
    setNotice(null);
    try {
      const res = await api.deleteAdminChatAutoResponse(id);
      setTemplates(res.templates);
      if (selectedId === id) {
        const next = res.templates[0];
        if (next) {
          setSelectedId(next.id);
          setForm(toFormState(next));
        } else {
          handleNewTemplate();
        }
      }
      setNotice('Template deleted and cache updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template.');
    }
  };

  const handleMoveOrder = async (tpl: ChatAutoResponseTemplate, direction: -1 | 1) => {
    const sorted = [...templates].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((t) => t.id === tpl.id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const neighbor = sorted[swapIdx];
    try {
      await api.updateAdminChatAutoResponse(tpl.id, { sort_order: neighbor.sort_order });
      const res = await api.updateAdminChatAutoResponse(neighbor.id, { sort_order: tpl.sort_order });
      setTemplates(res.templates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reorder templates.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSavingSettings(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.saveAdminChatAutoResponseSettings(settings);
      setSettings(res.settings);
      setNotice('Pre-chat intake gate and widget auto-response rules updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save widget settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const activeChipsCount = templates.filter((t) => t.is_active && t.show_as_quick_chip).length;

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Chat Auto-Response &amp; Quick-Select FAQ Engine
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Configure the mandatory Pre-Chat Intake Gate (Name, Contact Number, Email) and manage cached FAQ answers visitors can click instantly with zero Supabase writes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleNewTemplate}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add FAQ Template</span>
          </button>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Total Templates</div>
          <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {templates.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {activeChipsCount} visible as clickable visitor chips
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Pre-Chat Intake Gate</div>
          <div className="mt-1 font-display text-xl font-bold text-slate-900">
            {settings?.require_intake_before_chat !== false ? 'Strict Gate On' : 'Optional'}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Zero API/DB calls until Name, Phone &amp; Email submitted
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Supabase Quota Mode</div>
          <div className="mt-1 font-display text-xl font-bold text-[#16A34A]">
            Cache-First FAQ
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            FAQ clicks resolve client-side (0 DB writes per click)
          </div>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#16A34A] shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      {/* Main Split Grid: Left Template Queue / Right Editor + Live Widget Preview */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Column: Template Queue */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4 lg:col-span-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-display text-sm font-bold text-slate-900">
              Nominated FAQ Templates
            </h3>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit">
              {(['all', 'active', 'draft'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize ${
                    statusFilter === tab ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions, keywords, or answers..."
              className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="divide-y divide-slate-200 border-t border-slate-200 max-h-[520px] overflow-y-auto">
            {loading ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Loading auto-response templates...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="py-10 text-center space-y-2.5">
                <p className="text-xs text-slate-500">No auto-response templates match your filter.</p>
                <button
                  type="button"
                  onClick={handleNewTemplate}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create First FAQ Template</span>
                </button>
              </div>
            ) : (
              filteredTemplates.map((tpl, idx) => {
                const isSelected = selectedId === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    className={`py-3 px-2.5 transition-colors ${
                      isSelected ? 'bg-[var(--gs-soft-bg)]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectTemplate(tpl)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="text-xs font-semibold text-slate-900">
                          {tpl.question_label}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 font-mono tabular-nums">
                          <span>{tpl.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className={tpl.is_active ? 'text-[#16A34A]' : 'text-amber-700'}>
                            {tpl.is_active ? 'Active' : 'Draft'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{tpl.show_as_quick_chip ? 'Quick Chip' : 'Keyword Only'}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-600 line-clamp-2">
                          {tpl.answer_body}
                        </p>
                      </button>

                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveOrder(tpl, -1)}
                          title="Move up"
                          className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === filteredTemplates.length - 1}
                          onClick={() => handleMoveOrder(tpl, 1)}
                          title="Move down"
                          className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Template Editor & Preview */}
        <div className="space-y-5 lg:col-span-7">
          <form
            onSubmit={handleSaveTemplate}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[var(--gs-primary)]" />
                <h3 className="font-display text-sm font-bold text-slate-900">
                  {selectedId === 'new' ? 'Create New FAQ Auto-Response' : 'Edit Nominated Answer'}
                </h3>
              </div>
              {form.id && selectedId !== 'new' && (
                <button
                  type="button"
                  onClick={() => handleDeleteTemplate(form.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quick-Select Question Label
                </label>
                <input
                  type="text"
                  required
                  value={form.question_label}
                  onChange={(e) => setForm((p) => ({ ...p, question_label: e.target.value }))}
                  placeholder="e.g. How do pricing & engagement models work?"
                  className="min-h-[40px] w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  placeholder="Services / Pricing"
                  className="min-h-[40px] w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nominated Automated Answer
              </label>
              <textarea
                rows={4}
                required
                value={form.answer_body}
                onChange={(e) => setForm((p) => ({ ...p, answer_body: e.target.value }))}
                placeholder="Write the exact answer sent when a visitor clicks this question chip or matches its keywords..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs leading-relaxed text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trigger Keywords (comma-separated for typed questions)
                </label>
                <input
                  type="text"
                  value={form.keywordsText}
                  onChange={(e) => setForm((p) => ({ ...p, keywordsText: e.target.value }))}
                  placeholder="pricing, cost, quote, retainer, budget"
                  className="min-h-[38px] w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) }))}
                  className="min-h-[38px] w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-1 text-xs text-slate-700">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                <span>Active</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.show_as_quick_chip}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, show_as_quick_chip: e.target.checked }))
                  }
                />
                <span>Show as Quick-Select Chip in Chat</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.escalate_prompt_enabled}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, escalate_prompt_enabled: e.target.checked }))
                  }
                />
                <span>Include &ldquo;Talk to Live Engineer&rdquo; Button</span>
              </label>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingTemplate}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{savingTemplate ? 'Saving Template...' : 'Save & Publish FAQ'}</span>
              </button>
            </div>
          </form>

          {/* Live Visitor Chat Preview */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Eye className="h-4 w-4 text-[var(--gs-primary)]" />
              <span>Visitor Chat Quick-Select Preview</span>
            </div>
            <div className="bg-slate-50/80 rounded-lg p-3.5 space-y-2.5 border border-slate-200">
              <div className="flex justify-end">
                <div className="rounded-xl bg-[var(--gs-primary)] px-3 py-2 text-xs text-white max-w-[85%]">
                  {form.question_label || 'Visitor question chip preview...'}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs text-slate-900 max-w-[88%] space-y-1.5">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
                    <Sparkles className="h-3 w-3 text-[var(--gs-primary)]" />
                    <span>GitStack Auto-Response · {form.category || 'General'}</span>
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {form.answer_body || 'Your automated response preview appears here.'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Global Intake Gate & Auto-Reply Settings */}
          {settings && (
            <form
              onSubmit={handleSaveSettings}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <div className="border-b border-slate-200 pb-3">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Pre-Chat Intake Gate &amp; Global Chat Behavior
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Controls the contact verification step shown before any session is written to Supabase.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Intake Form Headline
                  </label>
                  <input
                    type="text"
                    value={settings.intake_headline}
                    onChange={(e) =>
                      setSettings((s) => (s ? { ...s, intake_headline: e.target.value } : s))
                    }
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Human Escalation Button Label
                  </label>
                  <input
                    type="text"
                    value={settings.escalation_button_label}
                    onChange={(e) =>
                      setSettings((s) =>
                        s ? { ...s, escalation_button_label: e.target.value } : s
                      )
                    }
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Intake Form Subtitle
                </label>
                <input
                  type="text"
                  value={settings.intake_subheadline}
                  onChange={(e) =>
                    setSettings((s) => (s ? { ...s, intake_subheadline: e.target.value } : s))
                  }
                  className="min-h-[38px] w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Post-Verification Welcome Greeting
                </label>
                <textarea
                  rows={2}
                  value={settings.welcome_message_after_intake}
                  onChange={(e) =>
                    setSettings((s) =>
                      s ? { ...s, welcome_message_after_intake: e.target.value } : s
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="flex flex-wrap gap-5 text-xs text-slate-700">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.require_intake_before_chat}
                    onChange={(e) =>
                      setSettings((s) =>
                        s ? { ...s, require_intake_before_chat: e.target.checked } : s
                      )
                    }
                  />
                  <span>Require Full Name, Phone &amp; Email before API/DB writes</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.auto_reply_on_keyword_match}
                    onChange={(e) =>
                      setSettings((s) =>
                        s ? { ...s, auto_reply_on_keyword_match: e.target.checked } : s
                      )
                    }
                  />
                  <span>Auto-reply when typed message matches template keywords</span>
                </label>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{savingSettings ? 'Saving Settings...' : 'Save Global Chat Rules'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
