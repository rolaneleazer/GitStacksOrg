import {
  Check,
  ExternalLink,
  Mail,
  Phone,
  RefreshCw,
  Replace,
  Search,
  User
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.ts';
import type {
  ContactEntityKind,
  ContactRegistryEntry,
  ContactRegistryScope,
  ContactScanSummary,
  WorkspaceModuleId
} from '../../shared/types.ts';

interface ContactRegistryPanelProps {
  onJumpToSection: (tab: WorkspaceModuleId) => void;
  onContentMutated?: () => void;
}

const SCOPE_LABELS: Record<ContactRegistryScope, string> = {
  page: 'Page',
  article: 'Article',
  module: 'Module'
};

const KIND_LABELS: Record<ContactEntityKind, string> = {
  email: 'Email',
  phone: 'Phone',
  name: 'Name'
};

export function ContactRegistryPanel({
  onJumpToSection,
  onContentMutated
}: ContactRegistryPanelProps) {
  const [summary, setSummary] = useState<ContactScanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [scopeFilter, setScopeFilter] = useState<'all' | ContactRegistryScope>('all');
  const [kindFilter, setKindFilter] = useState<'all' | ContactEntityKind>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Inline edited drafts keyed by entry.id
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [savingEntryId, setSavingEntryId] = useState<string | null>(null);
  const [recentlySavedId, setRecentlySavedId] = useState<string | null>(null);

  // Bulk find & replace state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFind, setBulkFind] = useState('');
  const [bulkReplace, setBulkReplace] = useState('');
  const [bulkKind, setBulkKind] = useState<'all' | ContactEntityKind>('email');
  const [bulkScope, setBulkScope] = useState<'all' | ContactRegistryScope>('all');
  const [runningBulk, setRunningBulk] = useState(false);

  const runScan = useCallback(async (isManualRescan = false) => {
    if (isManualRescan) {
      setScanning(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await api.getContactRegistry();
      setSummary(data);
      setDraftValues((prev) => {
        const next: Record<string, string> = {};
        for (const entry of data.entries) {
          next[entry.id] = prev[entry.id] !== undefined && isManualRescan ? entry.value : entry.value;
        }
        return next;
      });
      if (isManualRescan) {
        setNotice(
          `Rescanned ${data.pagesScanned} pages, ${data.articlesScanned} articles, and ${data.modulesScanned} module configs.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to scan pages, articles, and modules.');
    } finally {
      setLoading(false);
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    runScan(false);
  }, [runScan]);

  const filteredEntries = useMemo(() => {
    if (!summary) return [];
    const q = searchQuery.trim().toLowerCase();
    return summary.entries.filter((entry) => {
      if (scopeFilter !== 'all' && entry.scope !== scopeFilter) return false;
      if (kindFilter !== 'all' && entry.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        entry.value.toLowerCase().includes(q) ||
        entry.scopeTitle.toLowerCase().includes(q) ||
        entry.fieldLabel.toLowerCase().includes(q) ||
        entry.routeOrTab.toLowerCase().includes(q) ||
        entry.contextSnippet.toLowerCase().includes(q)
      );
    });
  }, [summary, scopeFilter, kindFilter, searchQuery]);

  const handleSaveEntry = async (entry: ContactRegistryEntry) => {
    const draft = (draftValues[entry.id] ?? entry.value).trim();
    if (!draft) {
      setError('Replacement value cannot be empty.');
      return;
    }
    if (draft === entry.value) return;

    setSavingEntryId(entry.id);
    setError(null);
    setNotice(null);
    try {
      const res = await api.updateContactRegistryEntry({
        scope: entry.scope,
        scopeId: entry.scopeId,
        fieldPath: entry.fieldPath,
        oldValue: entry.value,
        newValue: draft,
        kind: entry.kind
      });
      setSummary(res.summary);
      const resetDrafts: Record<string, string> = {};
      for (const item of res.summary.entries) {
        resetDrafts[item.id] = item.value;
      }
      setDraftValues(resetDrafts);
      setNotice(res.detail || `Saved "${draft}" on ${entry.scopeTitle}.`);
      setRecentlySavedId(entry.id);
      setTimeout(() => setRecentlySavedId((cur) => (cur === entry.id ? null : cur)), 2500);
      if (onContentMutated) onContentMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save update.');
    } finally {
      setSavingEntryId(null);
    }
  };

  const handleBulkReplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkFind.trim() || !bulkReplace.trim()) {
      setError('Enter both a value to find and a replacement value.');
      return;
    }
    setRunningBulk(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.bulkReplaceContactRegistry({
        oldValue: bulkFind.trim(),
        newValue: bulkReplace.trim(),
        scopes: bulkScope === 'all' ? undefined : [bulkScope],
        kind: bulkKind === 'all' ? undefined : bulkKind
      });
      setSummary(res.summary);
      const resetDrafts: Record<string, string> = {};
      for (const item of res.summary.entries) {
        resetDrafts[item.id] = item.value;
      }
      setDraftValues(resetDrafts);
      setNotice(
        res.updatedCount > 0
          ? `Replaced across ${res.updatedCount} location${res.updatedCount === 1 ? '' : 's'}: ${res.updatedItems.slice(0, 4).join(', ')}${res.updatedItems.length > 4 ? '…' : ''}`
          : 'No matching editable records needed replacement.'
      );
      setBulkFind('');
      setBulkReplace('');
      if (res.updatedCount > 0 && onContentMutated) {
        onContentMutated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk replace failed.');
    } finally {
      setRunningBulk(false);
    }
  };

  const renderKindIcon = (kind: ContactEntityKind) => {
    if (kind === 'email') return <Mail className="h-3.5 w-3.5 text-[var(--gs-primary)] shrink-0" />;
    if (kind === 'phone') return <Phone className="h-3.5 w-3.5 text-emerald-700 shrink-0" />;
    return <User className="h-3.5 w-3.5 text-slate-700 shrink-0" />;
  };

  return (
    <div className="space-y-5">
      {/* Header & Top Action Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-900">
              Sitewide Email, Phone &amp; Name Registry
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Live scanner auditing every CMS page, rendered public route, published/draft article, and Back Office module for emails, phone numbers, and contact/author names so you can edit or jump to any source anytime.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setBulkOpen((prev) => !prev)}
              className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                bulkOpen
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Replace className="h-3.5 w-3.5" />
              <span>Find &amp; Replace</span>
            </button>
            <button
              type="button"
              disabled={scanning || loading}
              onClick={() => runScan(true)}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
              <span>{scanning ? 'Scanning…' : 'Rescan Pages & Articles'}</span>
            </button>
          </div>
        </div>

        {/* 4 Concise Summary Metrics */}
        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="text-[11px] font-medium text-slate-500">Total Detected Entries</div>
            <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {summary ? summary.totalEntries : '—'}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
              {summary
                ? `${summary.pagesScanned} pages · ${summary.articlesScanned} articles · ${summary.modulesScanned} modules`
                : 'Scanning sources…'}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
              <span>Emails Found</span>
              <Mail className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {summary ? summary.emailsCount : '—'}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
              {summary ? `${summary.uniqueEmails.length} unique addresses` : '—'}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
              <span>Phone Numbers</span>
              <Phone className="h-3.5 w-3.5 text-emerald-700" />
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {summary ? summary.phonesCount : '—'}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
              {summary ? `${summary.uniquePhones.length} unique numbers` : '—'}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
              <span>Names &amp; Authors</span>
              <User className="h-3.5 w-3.5 text-slate-700" />
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {summary ? summary.namesCount : '—'}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
              {summary ? `${summary.uniqueNames.length} unique people` : '—'}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          {notice}
        </div>
      )}

      {/* Optional Find & Replace Panel */}
      {bulkOpen && (
        <form
          onSubmit={handleBulkReplace}
          className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900">
                Batch Find &amp; Replace Across Pages, Articles &amp; Modules
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Click any detected email, phone, or name in the directory below to pre-fill Find Value.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold text-slate-700">Type</label>
              <select
                value={bulkKind}
                onChange={(e) => setBulkKind(e.target.value as 'all' | ContactEntityKind)}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900"
              >
                <option value="all">All Types</option>
                <option value="email">Email Address</option>
                <option value="phone">Phone Number</option>
                <option value="name">Name / Author</option>
              </select>
            </div>

            <div className="min-w-0">
              <label className="block text-[11px] font-semibold text-slate-700">Scope</label>
              <select
                value={bulkScope}
                onChange={(e) => setBulkScope(e.target.value as 'all' | ContactRegistryScope)}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900"
              >
                <option value="all">Pages + Articles + Modules</option>
                <option value="page">Pages Only</option>
                <option value="article">Articles Only</option>
                <option value="module">Modules Only</option>
              </select>
            </div>

            <div className="min-w-0">
              <label className="block text-[11px] font-semibold text-slate-700">Find Exact Value</label>
              <input
                type="text"
                value={bulkFind}
                onChange={(e) => setBulkFind(e.target.value)}
                placeholder="contact@git-stack.org"
                className="mt-1 min-h-[42px] w-full min-w-0 rounded-lg border border-slate-200 px-3 font-mono text-xs text-slate-900"
              />
            </div>

            <div className="min-w-0">
              <label className="block text-[11px] font-semibold text-slate-700">Replace With</label>
              <input
                type="text"
                value={bulkReplace}
                onChange={(e) => setBulkReplace(e.target.value)}
                placeholder="new@git-stack.org"
                className="mt-1 min-h-[42px] w-full min-w-0 rounded-lg border border-slate-200 px-3 font-mono text-xs text-slate-900"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={runningBulk}
                className="min-h-[42px] w-full rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
              >
                {runningBulk ? 'Replacing…' : 'Apply Replace All'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Unique Values Directory */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Mail className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
                <span>Unique Emails ({summary.uniqueEmails.length})</span>
              </div>
              <span className="text-[11px] text-slate-400">Click to filter</span>
            </div>
            <div className="mt-2.5 max-h-44 overflow-y-auto divide-y divide-slate-100">
              {summary.uniqueEmails.map((item) => (
                <div
                  key={item.value}
                  className="flex items-center justify-between gap-2 py-2 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setKindFilter('email');
                      setSearchQuery(item.value);
                      if (bulkOpen) {
                        setBulkKind('email');
                        setBulkFind(item.value);
                      }
                    }}
                    className="min-w-0 truncate font-mono text-slate-800 hover:text-[var(--gs-primary)] text-left"
                  >
                    {item.value}
                  </button>
                  <span className="shrink-0 font-mono text-[11px] text-slate-500 tabular-nums">
                    {item.count}×
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Phone className="h-3.5 w-3.5 text-emerald-700" />
                <span>Unique Phone Numbers ({summary.uniquePhones.length})</span>
              </div>
              <span className="text-[11px] text-slate-400">Click to filter</span>
            </div>
            <div className="mt-2.5 max-h-44 overflow-y-auto divide-y divide-slate-100">
              {summary.uniquePhones.length === 0 ? (
                <p className="py-3 text-xs text-slate-500">No phone numbers detected yet.</p>
              ) : (
                summary.uniquePhones.map((item) => (
                  <div
                    key={item.value}
                    className="flex items-center justify-between gap-2 py-2 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setKindFilter('phone');
                        setSearchQuery(item.value);
                        if (bulkOpen) {
                          setBulkKind('phone');
                          setBulkFind(item.value);
                        }
                      }}
                      className="min-w-0 truncate font-mono text-slate-800 hover:text-[var(--gs-primary)] text-left tabular-nums"
                    >
                      {item.value}
                    </button>
                    <span className="shrink-0 font-mono text-[11px] text-slate-500 tabular-nums">
                      {item.count}×
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <User className="h-3.5 w-3.5 text-slate-700" />
                <span>Unique Names &amp; Authors ({summary.uniqueNames.length})</span>
              </div>
              <span className="text-[11px] text-slate-400">Click to filter</span>
            </div>
            <div className="mt-2.5 max-h-44 overflow-y-auto divide-y divide-slate-100">
              {summary.uniqueNames.map((item) => (
                <div
                  key={item.value}
                  className="flex items-center justify-between gap-2 py-2 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setKindFilter('name');
                      setSearchQuery(item.value);
                      if (bulkOpen) {
                        setBulkKind('name');
                        setBulkFind(item.value);
                      }
                    }}
                    className="min-w-0 truncate font-medium text-slate-800 hover:text-[var(--gs-primary)] text-left"
                  >
                    {item.value}
                  </button>
                  <span className="shrink-0 font-mono text-[11px] text-slate-500 tabular-nums">
                    {item.count}×
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar & Editable Inventory */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {(['all', 'page', 'article', 'module'] as const).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setScopeFilter(sc)}
                  className={`min-h-[34px] rounded-md px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                    scopeFilter === sc
                      ? 'bg-white text-slate-900 border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sc === 'all' ? 'All Scopes' : `${SCOPE_LABELS[sc]}s`}
                </button>
              ))}
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {(['all', 'email', 'phone', 'name'] as const).map((kd) => (
                <button
                  key={kd}
                  type="button"
                  onClick={() => setKindFilter(kd)}
                  className={`min-h-[34px] rounded-md px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                    kindFilter === kd
                      ? 'bg-white text-slate-900 border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {kd === 'all' ? 'All Types' : `${KIND_LABELS[kd]}s`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-80">
            <div className="relative flex-1 min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search page, article, email, phone, name…"
                className="min-h-[38px] w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-3 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
              />
            </div>
            {(searchQuery || scopeFilter !== 'all' || kindFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setScopeFilter('all');
                  setKindFilter('all');
                }}
                className="min-h-[38px] rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="tabular-nums">
            Showing {filteredEntries.length} of {summary?.totalEntries ?? 0} detected records
          </span>
          {summary?.scannedAt && (
            <span>Last scan: {new Date(summary.scannedAt).toLocaleTimeString()}</span>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Scanning all pages, articles, and modules for emails, phone numbers, and names…
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
            No matching contacts, emails, phone numbers, or names match the current filters.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2.5">Source &amp; Location</th>
                    <th className="px-3.5 py-2.5">Field &amp; Context</th>
                    <th className="px-3.5 py-2.5 min-w-[270px]">Detected Value (Editable)</th>
                    <th className="px-3.5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredEntries.map((entry) => {
                    const draft = draftValues[entry.id] ?? entry.value;
                    const dirty = draft.trim() !== entry.value;
                    const saving = savingEntryId === entry.id;
                    const saved = recentlySavedId === entry.id;
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/70 align-top">
                        <td className="px-3.5 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                              {SCOPE_LABELS[entry.scope]}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                              {renderKindIcon(entry.kind)}
                              <span>{KIND_LABELS[entry.kind]}</span>
                            </span>
                          </div>
                          <div className="mt-1.5 font-semibold text-slate-900 max-w-xs">
                            {entry.scopeTitle}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-slate-500 truncate max-w-xs">
                            {entry.routeOrTab}
                          </div>
                        </td>

                        <td className="px-3.5 py-3 max-w-sm">
                          <div className="font-semibold text-slate-800">{entry.fieldLabel}</div>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 break-words">
                            {entry.contextSnippet}
                          </p>
                          {entry.editHint && (
                            <p className="mt-1 text-[10px] text-slate-400">{entry.editHint}</p>
                          )}
                        </td>

                        <td className="px-3.5 py-3">
                          {entry.editable ? (
                            <input
                              type={entry.kind === 'email' ? 'email' : 'text'}
                              value={draft}
                              onChange={(e) =>
                                setDraftValues((prev) => ({
                                  ...prev,
                                  [entry.id]: e.target.value
                                }))
                              }
                              className={`min-h-[38px] w-full min-w-0 rounded-lg border px-2.5 py-1.5 text-xs ${
                                entry.kind === 'name' ? 'font-medium' : 'font-mono tabular-nums'
                              } ${
                                dirty
                                  ? 'border-[var(--gs-primary)] bg-blue-50/30 text-slate-900'
                                  : 'border-slate-200 bg-white text-slate-900'
                              } focus:border-[var(--gs-primary)] focus:outline-none`}
                            />
                          ) : (
                            <div
                              className={`rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700 ${
                                entry.kind === 'name' ? 'font-medium' : 'font-mono tabular-nums'
                              }`}
                            >
                              {entry.value}
                            </div>
                          )}
                        </td>

                        <td className="px-3.5 py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {entry.editable && (
                              <button
                                type="button"
                                disabled={!dirty || saving}
                                onClick={() => handleSaveEntry(entry)}
                                className={`min-h-[36px] inline-flex items-center gap-1 rounded-lg px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                                  saved
                                    ? 'bg-emerald-600 text-white'
                                    : dirty
                                      ? 'bg-[var(--gs-primary)] text-white hover:bg-[var(--gs-primary-hover)]'
                                      : 'border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                {saved ? (
                                  <>
                                    <Check className="h-3.5 w-3.5" />
                                    <span>Saved</span>
                                  </>
                                ) : (
                                  <span>{saving ? 'Saving…' : 'Save'}</span>
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onJumpToSection(entry.jumpTab)}
                              className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Open Source</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards (iPhone 15 friendly) */}
            <div className="md:hidden space-y-3">
              {filteredEntries.map((entry) => {
                const draft = draftValues[entry.id] ?? entry.value;
                const dirty = draft.trim() !== entry.value;
                const saving = savingEntryId === entry.id;
                const saved = recentlySavedId === entry.id;
                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                          {SCOPE_LABELS[entry.scope]}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                          {renderKindIcon(entry.kind)}
                          <span>{KIND_LABELS[entry.kind]}</span>
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 truncate max-w-[140px]">
                        {entry.routeOrTab}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-slate-900">{entry.scopeTitle}</div>
                      <div className="text-[11px] font-medium text-slate-600">
                        {entry.fieldLabel}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 break-words">
                        {entry.contextSnippet}
                      </p>
                    </div>

                    {entry.editable ? (
                      <input
                        type={entry.kind === 'email' ? 'email' : 'text'}
                        value={draft}
                        onChange={(e) =>
                          setDraftValues((prev) => ({
                            ...prev,
                            [entry.id]: e.target.value
                          }))
                        }
                        className={`min-h-[42px] w-full min-w-0 rounded-lg border px-3 py-2 text-xs ${
                          entry.kind === 'name' ? 'font-medium' : 'font-mono tabular-nums'
                        } border-slate-200 bg-white text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none`}
                      />
                    ) : (
                      <div
                        className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 break-all ${
                          entry.kind === 'name' ? 'font-medium' : 'font-mono tabular-nums'
                        }`}
                      >
                        {entry.value}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      {entry.editable && (
                        <button
                          type="button"
                          disabled={!dirty || saving}
                          onClick={() => handleSaveEntry(entry)}
                          className={`min-h-[40px] flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-3 text-xs font-semibold transition-colors ${
                            saved
                              ? 'bg-emerald-600 text-white'
                              : dirty
                                ? 'bg-[var(--gs-primary)] text-white'
                                : 'border border-slate-200 bg-slate-50 text-slate-400'
                          }`}
                        >
                          <span>{saved ? 'Saved' : saving ? 'Saving…' : 'Save Change'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onJumpToSection(entry.jumpTab)}
                        className="min-h-[40px] inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Open</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
