import {
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  FileSpreadsheet,
  Globe,
  KeyRound,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Upload
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import type {
  ApolloCandidate,
  ApolloStatusResponse,
  CrmLead,
  CsvImportLeadInput
} from '../../shared/types.ts';

interface MultiSourceImportPanelProps {
  onLeadsUpdated: (leads: CrmLead[], noticeText: string) => void;
  onError: (msg: string) => void;
  onOpenSettings?: () => void;
  onOpenMapsTab?: () => void;
}

const APOLLO_CSV_SAMPLE =
  'First Name,Last Name,Title,Company,Email,Website,Corporate Phone,City,Country,Industry\nElena,Vance,VP of Engineering,Nebula Cloud Systems,elena@nebulacloud.io,https://nebulacloud.io,+1-415-555-0192,San Francisco,United States,Cloud Infrastructure';

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

function parseCsvOrJsonToRows(raw: string): {
  rows: CsvImportLeadInput[];
  isApolloFormat: boolean;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { rows: [], isApolloFormat: false };
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<CsvImportLeadInput>[];
      if (!Array.isArray(parsed)) return { rows: [], isApolloFormat: false };
      return {
        isApolloFormat: false,
        rows: parsed
          .filter((r) => Boolean(r.company_name || (r as { company?: string }).company))
          .map((r) => ({
            company_name: String(r.company_name || (r as { company?: string }).company || '').trim(),
            contact_name: String(r.contact_name || (r as { name?: string }).name || '').trim(),
            role_title: String(r.role_title || (r as { title?: string }).title || '').trim(),
            email: String(r.email || '').trim(),
            website_url: String(r.website_url || (r as { website?: string }).website || '').trim(),
            phone: String(r.phone || '').trim(),
            location: String(r.location || '').trim()
          }))
      };
    } catch {
      return { rows: [], isApolloFormat: false };
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return { rows: [], isApolloFormat: false };

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  const colIdx = (aliases: string[]) => headers.findIndex((h) => aliases.includes(h));

  const idxCompany = colIdx([
    'company',
    'company_name',
    'company_name_for_emails',
    'organization',
    'account',
    'account_name'
  ]);
  const idxContact = colIdx(['contact', 'contact_name', 'name', 'full_name']);
  const idxFirstName = colIdx(['first_name', 'firstname']);
  const idxLastName = colIdx(['last_name', 'lastname']);
  const idxRole = colIdx(['role', 'role_title', 'title', 'job_title', 'person_title']);
  const idxEmail = colIdx(['email', 'work_email', 'email_address']);
  const idxWebsite = colIdx([
    'website',
    'company_website',
    'website_url',
    'domain',
    'company_domain',
    'url'
  ]);
  const idxPhone = colIdx([
    'phone',
    'corporate_phone',
    'work_direct_phone',
    'mobile_phone',
    'telephone',
    'mobile'
  ]);
  const idxLocation = colIdx(['location', 'address']);
  const idxCity = colIdx(['city', 'company_city']);
  const idxState = colIdx(['state', 'company_state']);
  const idxCountry = colIdx(['country', 'company_country']);
  const idxTech = colIdx(['technologies', 'tech_stack', 'industry']);

  const isApolloFormat =
    (idxFirstName >= 0 && idxLastName >= 0) ||
    headers.includes('company_name_for_emails') ||
    headers.includes('person_linkedin_url') ||
    headers.includes('corporate_phone') ||
    headers.includes('work_direct_phone');

  if (idxCompany === -1 && idxEmail === -1 && idxWebsite === -1) {
    return { rows: [], isApolloFormat };
  }

  const rows = lines
    .slice(1)
    .map((line) => {
      const cells = splitCsvLine(line);
      const company = (idxCompany >= 0 ? cells[idxCompany] : '') || '';
      const website = (idxWebsite >= 0 ? cells[idxWebsite] : '') || '';
      const email = (idxEmail >= 0 ? cells[idxEmail] : '') || '';
      const fallbackCompany =
        company ||
        (website ? website.replace(/^https?:\/\//, '').split('/')[0] : '') ||
        (email.includes('@') ? email.split('@')[1] : '');

      const combinedName =
        (idxContact >= 0 ? cells[idxContact] : '') ||
        [idxFirstName >= 0 ? cells[idxFirstName] : '', idxLastName >= 0 ? cells[idxLastName] : '']
          .filter(Boolean)
          .join(' ')
          .trim();

      const combinedLocation =
        (idxLocation >= 0 ? cells[idxLocation] : '') ||
        [
          idxCity >= 0 ? cells[idxCity] : '',
          idxState >= 0 ? cells[idxState] : '',
          idxCountry >= 0 ? cells[idxCountry] : ''
        ]
          .filter(Boolean)
          .join(', ');

      const rawTech = idxTech >= 0 ? cells[idxTech] || '' : '';
      const techStack = rawTech
        ? rawTech
            .split(/[,;|]/)
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 6)
        : [];

      return {
        company_name: fallbackCompany,
        contact_name: combinedName,
        role_title: idxRole >= 0 ? cells[idxRole] || '' : '',
        email,
        website_url: website,
        phone: idxPhone >= 0 ? cells[idxPhone] || '' : '',
        location: combinedLocation,
        ...(techStack.length > 0 ? { tech_stack: techStack } : {})
      };
    })
    .filter((r) => Boolean(r.company_name));

  return { rows, isApolloFormat };
}

export function MultiSourceImportPanel({
  onLeadsUpdated,
  onError,
  onOpenSettings,
  onOpenMapsTab
}: MultiSourceImportPanelProps) {
  const [activeConnector, setActiveConnector] = useState<'apollo' | 'datasets' | 'csv'>('apollo');

  // Apollo state
  const [apolloStatus, setApolloStatus] = useState<ApolloStatusResponse | null>(null);
  const [apolloTitles, setApolloTitles] = useState('CTO, VP Engineering, Head of AI');
  const [apolloKeywords, setApolloKeywords] = useState('cloud AI SaaS');
  const [apolloLocations, setApolloLocations] = useState('United States, Singapore');
  const [apolloDomains, setApolloDomains] = useState('');
  const [apolloSearching, setApolloSearching] = useState(false);
  const [apolloImporting, setApolloImporting] = useState(false);
  const [apolloCandidates, setApolloCandidates] = useState<ApolloCandidate[]>([]);
  const [apolloTotal, setApolloTotal] = useState(0);
  const [selectedApolloIds, setSelectedApolloIds] = useState<Set<string>>(new Set());
  const [apolloBlockedError, setApolloBlockedError] = useState<string | null>(null);

  // HN + YC Harvester state
  const [hnKeyword, setHnKeyword] = useState('AI');
  const [hnBusy, setHnBusy] = useState(false);
  const [ycKeyword, setYcKeyword] = useState('AI');
  const [ycBusy, setYcBusy] = useState(false);

  // CSV / JSON state
  const [csvSourceMode, setCsvSourceMode] = useState<'apollo' | 'csv_import'>('apollo');
  const [csvRaw, setCsvRaw] = useState(APOLLO_CSV_SAMPLE);
  const [csvFileName, setCsvFileName] = useState('apollo-contacts-export.csv');
  const [csvImporting, setCsvImporting] = useState(false);

  useEffect(() => {
    api
      .getApolloStatus()
      .then(setApolloStatus)
      .catch(() => {});
  }, []);

  const parsedCsv = parseCsvOrJsonToRows(csvRaw);
  const parsedCsvRows = parsedCsv.rows;

  const handleApolloSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setApolloSearching(true);
    setApolloBlockedError(null);
    try {
      const splitComma = (s: string) =>
        s
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
      const res = await api.searchApolloPeople({
        personTitles: splitComma(apolloTitles),
        qKeywords: apolloKeywords.trim(),
        personLocations: splitComma(apolloLocations),
        organizationDomains: splitComma(apolloDomains),
        perPage: 15
      });
      setApolloCandidates(res.candidates);
      setApolloTotal(res.totalEntries);
      setSelectedApolloIds(new Set(res.candidates.map((c) => c.id)));
      if (res.candidates.length === 0) {
        onError('Apollo.io search returned 0 people for those filters.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Apollo.io search failed.';
      if (/403|API_INACCESSIBLE|not included in your|Trial/i.test(msg)) {
        setApolloBlockedError(msg);
      }
      onError(msg);
    } finally {
      setApolloSearching(false);
    }
  };

  const handleApolloImport = async () => {
    const picked = apolloCandidates.filter((c) => selectedApolloIds.has(c.id));
    if (picked.length === 0) return;
    setApolloImporting(true);
    try {
      const res = await api.importApolloLeads(
        picked,
        `${apolloTitles || apolloKeywords || 'Apollo Search'}`
      );
      onLeadsUpdated(
        res.leads,
        `Apollo.io: +${res.insertedCount} new leads imported, ${res.mergedCount} merged (${res.mxVerifiedCount} MX verified).`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to enrich & import Apollo leads.');
    } finally {
      setApolloImporting(false);
    }
  };

  const handleSyncHn = async () => {
    setHnBusy(true);
    try {
      const res = await api.syncHackerNewsLeads(hnKeyword);
      onLeadsUpdated(
        res.leads,
        `${res.threadTitle}: +${res.insertedCount} new hiring leads imported, ${res.mergedCount} merged (${res.mxVerifiedCount} MX verified).`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Hacker News hiring sync failed.');
    } finally {
      setHnBusy(false);
    }
  };

  const handleSyncYc = async () => {
    setYcBusy(true);
    try {
      const res = await api.syncYCombinatorLeads(ycKeyword);
      onLeadsUpdated(
        res.leads,
        `${res.datasetLabel}: +${res.insertedCount} YC startups imported, ${res.mergedCount} merged (${res.mxVerifiedCount} MX verified).`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Y Combinator directory sync failed.');
    } finally {
      setYcBusy(false);
    }
  };

  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const text = await file.text();
    setCsvRaw(text);
    const detected = parseCsvOrJsonToRows(text);
    if (detected.isApolloFormat) {
      setCsvSourceMode('apollo');
    }
  };

  const handleOpenApolloCsvMapper = () => {
    setCsvSourceMode('apollo');
    if (!csvRaw.trim()) {
      setCsvRaw(APOLLO_CSV_SAMPLE);
      setCsvFileName('apollo-contacts-export.csv');
    }
    setActiveConnector('csv');
  };

  const handleImportCsv = async () => {
    if (parsedCsvRows.length === 0) {
      onError('No valid rows detected. Include a Company or company_name column header.');
      return;
    }
    setCsvImporting(true);
    try {
      const res = await api.importCsvLeads(parsedCsvRows, csvFileName, csvSourceMode);
      onLeadsUpdated(
        res.leads,
        `${csvSourceMode === 'apollo' ? 'Apollo.io CSV Export' : 'CSV/JSON Upload'} (${csvFileName}): +${res.insertedCount} new leads added, ${res.mergedCount} merged (${res.mxVerifiedCount} MX verified).`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'CSV bulk import failed.');
    } finally {
      setCsvImporting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Connector Switcher Header */}
      <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-sm font-bold text-slate-900">
            Authorized B2B Data Connectors &amp; Bulk Ingestion
          </h3>
          <p className="text-[11px] text-slate-600">
            Pull verified decision makers from Apollo.io, live startup hiring feeds, YC companies, or CSV lists.
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setActiveConnector('apollo')}
            className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              activeConnector === 'apollo'
                ? 'bg-[var(--gs-primary)] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Apollo.io API
          </button>
          <button
            type="button"
            onClick={() => setActiveConnector('datasets')}
            className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              activeConnector === 'datasets'
                ? 'bg-[var(--gs-primary)] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            HN Hiring &amp; YC Directory
          </button>
          <button
            type="button"
            onClick={() => setActiveConnector('csv')}
            className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              activeConnector === 'csv'
                ? 'bg-[var(--gs-primary)] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            CSV / JSON Import
          </button>
        </div>
      </div>

      {/* 1. APOLLO.IO SERVER-SIDE CONNECTOR */}
      {activeConnector === 'apollo' && (
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <KeyRound className="h-4 w-4 text-[var(--gs-primary)] shrink-0" />
              <span className="font-semibold text-slate-900">Apollo Integration Status:</span>
              {apolloStatus?.configured ? (
                apolloStatus.capabilityMode === 'trial_or_scoped' ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>
                      Connected (Vault) · Trial / Scoped Plan (API Search Gated — Use Apollo CSV Export)
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>
                      Apollo API Active{' '}
                      {apolloStatus.capabilityMode === 'full_search'
                        ? '· Full Paid Search Ready'
                        : '(Encrypted Vault / Server Proxy)'}
                    </span>
                  </span>
                )
              ) : (
                <span className="font-medium text-amber-800">
                  Not connected. Configure your <code className="font-mono text-[11px]">APOLLO_API_KEY</code> in
                  Settings &amp; Integrations to enable search &amp; enrichment.
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-slate-500">
                Preview search uses 0 credits · Enrich on import
              </span>
              {!apolloStatus?.configured && onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="rounded-lg bg-[var(--gs-primary)] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                >
                  Configure in Settings →
                </button>
              )}
            </div>
          </div>

          {(apolloBlockedError || apolloStatus?.capabilityMode === 'trial_or_scoped') && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                  <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
                  <span>
                    Why Apollo People Search Returns HTTP 403 on Professional (Trial) Plans
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-amber-900">
                  Your API key passes <code className="font-mono text-[11px]">auth/health</code>{' '}
                  authentication, but Apollo blocks{' '}
                  <code className="font-mono text-[11px]">mixed_people/api_search</code> and{' '}
                  <code className="font-mono text-[11px]">mixed_companies/search</code> during Free &amp;
                  Professional Trial periods until the subscription converts to an active paid billing
                  cycle and uses a <strong>Master API Key</strong> (Apollo → Settings → Integrations → API).
                </p>
                {apolloBlockedError && (
                  <p className="font-mono text-[11px] text-amber-800 break-words">
                    {apolloBlockedError}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleOpenApolloCsvMapper}
                  className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Import Apollo CSV Export</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveConnector('datasets')}
                  className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Database className="h-3.5 w-3.5" />
                  <span>Switch to HN / YC Feeds</span>
                </button>
                {onOpenMapsTab && (
                  <button
                    type="button"
                    onClick={onOpenMapsTab}
                    className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    <span>Open Google Maps Finder</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleApolloSearch} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700">
                Person Titles (comma-separated)
              </label>
              <input
                type="text"
                value={apolloTitles}
                onChange={(e) => setApolloTitles(e.target.value)}
                placeholder="CTO, VP Engineering, Founder"
                className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700">
                Keywords / Industry
              </label>
              <input
                type="text"
                value={apolloKeywords}
                onChange={(e) => setApolloKeywords(e.target.value)}
                placeholder="AI, Kubernetes, FinTech"
                className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700">
                Locations
              </label>
              <input
                type="text"
                value={apolloLocations}
                onChange={(e) => setApolloLocations(e.target.value)}
                placeholder="United States, United Kingdom"
                className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700">
                Target Domains (optional)
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={apolloDomains}
                  onChange={(e) => setApolloDomains(e.target.value)}
                  placeholder="stripe.com, linear.app"
                  className="min-h-[40px] flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={apolloSearching}
                  className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>{apolloSearching ? 'Querying...' : 'Search Apollo'}</span>
                </button>
              </div>
            </div>
          </form>

          {apolloCandidates.length > 0 && (
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-800">
                  Previewing {apolloCandidates.length} of{' '}
                  <span className="font-mono tabular-nums">{apolloTotal.toLocaleString()}</span> matching
                  Apollo profiles
                </div>
                <button
                  type="button"
                  disabled={apolloImporting || selectedApolloIds.size === 0}
                  onClick={handleApolloImport}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>
                    {apolloImporting
                      ? 'Enriching & Saving...'
                      : `Enrich & Import Selected (${selectedApolloIds.size})`}
                  </span>
                </button>
              </div>

              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 max-h-[320px] overflow-y-auto">
                {apolloCandidates.map((cand) => {
                  const checked = selectedApolloIds.has(cand.id);
                  return (
                    <label
                      key={cand.id}
                      className="flex items-start gap-3 px-3.5 py-2.5 text-xs hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedApolloIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(cand.id)) next.delete(cand.id);
                            else next.add(cand.id);
                            return next;
                          })
                        }
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-900">{cand.contact_name}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-700">{cand.role_title}</span>
                          <span className="text-slate-400">·</span>
                          <span className="font-semibold text-slate-900">{cand.company_name}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className="font-mono text-slate-700">
                            {cand.email || (cand.has_email ? 'Email available on enrich' : cand.company_domain)}
                          </span>
                          {cand.location && (
                            <>
                              <span>·</span>
                              <span>{cand.location}</span>
                            </>
                          )}
                          {cand.linkedin_url && (
                            <a
                              href={cand.linkedin_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-0.5 text-[var(--gs-primary)] hover:underline"
                            >
                              <span>LinkedIn</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. HACKER NEWS HIRING & Y COMBINATOR DIRECTORY */}
      {activeConnector === 'datasets' && (
        <div className="p-4 sm:p-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-amber-600" />
              <h4 className="font-display text-xs font-bold text-slate-900">
                Hacker News &ldquo;Who is Hiring?&rdquo; Live Feed
              </h4>
            </div>
            <p className="text-xs text-slate-600">
              Scans the latest monthly HN hiring thread via Algolia API, extracts engineering stack
              needs, scrapes public startup URLs, and verifies hiring emails via DNS MX.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={hnKeyword}
                onChange={(e) => setHnKeyword(e.target.value)}
                placeholder="Filter keyword (e.g. AI, Rust, Kubernetes)"
                className="min-h-[40px] flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
              />
              <button
                type="button"
                disabled={hnBusy}
                onClick={handleSyncHn}
                className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${hnBusy ? 'animate-spin' : ''}`} />
                <span>{hnBusy ? 'Syncing HN...' : 'Sync HN Hiring'}</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-orange-600" />
              <h4 className="font-display text-xs font-bold text-slate-900">
                Y Combinator Hiring Startups Directory
              </h4>
            </div>
            <p className="text-xs text-slate-600">
              Pulls funded YC companies actively scaling engineering teams, scrapes their homepage for
              contact emails &amp; technical signals, and populates CRM pipeline leads.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={ycKeyword}
                onChange={(e) => setYcKeyword(e.target.value)}
                placeholder="Filter industry/keyword (e.g. DevTools, B2B, AI)"
                className="min-h-[40px] flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
              />
              <button
                type="button"
                disabled={ycBusy}
                onClick={handleSyncYc}
                className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${ycBusy ? 'animate-spin' : ''}`} />
                <span>{ycBusy ? 'Syncing YC...' : 'Sync YC Startups'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. APOLLO CSV EXPORT & BULK CSV / JSON IMPORTER */}
      {activeConnector === 'csv' && (
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-teal-600" />
                <h4 className="font-display text-xs font-bold text-slate-900">
                  Apollo.io CSV Export &amp; Bulk Lead Mapper
                </h4>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-600">
                Upload CSVs exported from Apollo.io (auto-maps <code className="font-mono">First Name</code>,{' '}
                <code className="font-mono">Last Name</code>, <code className="font-mono">Title</code>,{' '}
                <code className="font-mono">Company</code>, <code className="font-mono">Email</code>,{' '}
                <code className="font-mono">Website</code>, <code className="font-mono">Corporate Phone</code>,{' '}
                <code className="font-mono">City / Country</code>) or any generic CSV / JSON list.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setCsvSourceMode('apollo')}
                  className={`min-h-[34px] rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    csvSourceMode === 'apollo'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Apollo.io CSV Export
                </button>
                <button
                  type="button"
                  onClick={() => setCsvSourceMode('csv_import')}
                  className={`min-h-[34px] rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    csvSourceMode === 'csv_import'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Standard CSV / JSON
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCsvSourceMode('apollo');
                  setCsvFileName('apollo-contacts-export.csv');
                  setCsvRaw(APOLLO_CSV_SAMPLE);
                }}
                className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Load Apollo Template
              </button>

              <label className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shrink-0">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload .CSV / .JSON</span>
                <input
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  onChange={handleCsvFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <textarea
            rows={5}
            value={csvRaw}
            onChange={(e) => {
              const nextVal = e.target.value;
              setCsvRaw(nextVal);
              const detected = parseCsvOrJsonToRows(nextVal);
              if (detected.isApolloFormat) setCsvSourceMode('apollo');
            }}
            placeholder="First Name,Last Name,Title,Company,Email,Website,Corporate Phone,City,Country"
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 font-mono text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
          />

          {parsedCsvRows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-[11px]">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Contact</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Company</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-slate-800">
                  {parsedCsvRows.slice(0, 4).map((r, i) => (
                    <tr key={`${r.company_name}-${i}`}>
                      <td className="px-3 py-2 font-medium">{r.contact_name || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.role_title || '—'}</td>
                      <td className="px-3 py-2 font-semibold">{r.company_name}</td>
                      <td className="px-3 py-2 font-mono">{r.email || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.location || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-600 font-mono tabular-nums">
              {parsedCsvRows.length} valid row{parsedCsvRows.length === 1 ? '' : 's'} detected ({csvFileName}) · Attribution:{' '}
              <strong className="text-slate-900">
                {csvSourceMode === 'apollo' ? 'Apollo.io' : 'CSV Bulk Import'}
              </strong>
            </span>
            <button
              type="button"
              disabled={csvImporting || parsedCsvRows.length === 0}
              onClick={handleImportCsv}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>
                {csvImporting
                  ? 'Validating MX & Importing...'
                  : `Import ${parsedCsvRows.length} Lead${parsedCsvRows.length === 1 ? '' : 's'} as ${
                      csvSourceMode === 'apollo' ? 'Apollo.io' : 'CSV'
                    }`}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
