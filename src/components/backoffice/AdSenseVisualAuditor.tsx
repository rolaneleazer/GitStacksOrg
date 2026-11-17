import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  FileCheck2,
  Globe,
  ImageIcon,
  Info,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  X
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import type { AdSenseAuditResult, AuditCategory } from '../../server/adsenseAuditor.ts';

export function AdSenseVisualAuditor() {
  const [url, setUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<AdSenseAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedSnippetIdx, setCopiedSnippetIdx] = useState<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Support direct clipboard paste of screenshots (Ctrl+V) anywhere on the component
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onload = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRunAudit = async (presetUrl?: string) => {
    const targetUrl = presetUrl || url.trim();
    if (!targetUrl && !imagePreview) {
      setError('Please enter a live webpage URL or upload/paste a visual screenshot.');
      return;
    }

    setAuditing(true);
    setError(null);

    try {
      const res = await api.auditPageAdSense({
        url: targetUrl || undefined,
        imageBase64: imagePreview || undefined,
        mimeType: selectedFile?.type || 'image/png'
      });
      setAuditResult(res);

      // Expand all categories by default
      const initialExpanded: Record<string, boolean> = {};
      res.categories.forEach((c: AuditCategory) => {
        initialExpanded[c.name] = true;
      });
      setExpandedCategories(initialExpanded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit failed. Please try again.');
    } finally {
      setAuditing(false);
    }
  };

  const handleCopySnippet = (snippet: string, idx: number) => {
    navigator.clipboard.writeText(snippet);
    setCopiedSnippetIdx(idx);
    setTimeout(() => setCopiedSnippetIdx(null), 2500);
  };

  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 65) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getStatusBadge = (status: string) => {
    if (status === 'Ready to Apply' || status === 'PASS') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-3 w-3" />
          <span>{status}</span>
        </span>
      );
    }
    if (status === 'Needs Fixes' || status === 'WARNING') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
          <AlertTriangle className="h-3 w-3" />
          <span>{status}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
        <ShieldAlert className="h-3 w-3" />
        <span>{status}</span>
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* 1. HEADER SECTION */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Gemini 4 Hydrogen Multimodal Vision · 2026 Policy Standards</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Strict AdSense Policy Reviewer Model</span>
          </div>
        </div>

        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Google AdSense Compliance &amp; Visual Auditor
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
            Scan live webpage layouts or upload full-page screenshots to detect deceptive ad placements,
            thin content violations, missing legal clauses, and E-E-A-T signals before submitting to Google AdSense.
          </p>
        </div>

        {/* 2. DUAL INPUT CONTROLS */}
        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: URL Input */}
          <div className="lg:col-span-7 space-y-3">
            <label className="block text-xs font-semibold text-slate-800">
              Live Webpage URL to Inspect
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://git-stack.org/contact"
                  className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[var(--gs-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--gs-primary)]"
                />
              </div>

              <button
                type="button"
                onClick={() => handleRunAudit()}
                disabled={auditing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 transition-colors whitespace-nowrap shadow-xs"
              >
                {auditing ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                <span>{auditing ? 'Auditing...' : 'Run Full Audit'}</span>
              </button>
            </div>

            {/* URL Presets */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span className="text-[11px] font-medium text-slate-400">Quick Test:</span>
              {[
                { label: 'Homepage', path: 'https://git-stack.org/' },
                { label: 'Engineering Services', path: 'https://git-stack.org/services' },
                { label: 'Contact & Office Hours', path: 'https://git-stack.org/contact' },
                { label: 'Insights & Blog', path: 'https://git-stack.org/insights' },
                { label: 'Privacy Policy', path: 'https://git-stack.org/privacy-policy' }
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setUrl(preset.path);
                    handleRunAudit(preset.path);
                  }}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Screenshot Drag & Drop / Paste */}
          <div className="lg:col-span-5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-800">
                Visual Screenshot (or Paste via Ctrl+V)
              </label>
              {imagePreview && (
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setSelectedFile(null);
                  }}
                  className="text-[11px] font-medium text-red-600 hover:underline flex items-center gap-0.5"
                >
                  <X className="h-3 w-3" />
                  <span>Remove Image</span>
                </button>
              )}
            </div>

            {imagePreview ? (
              <div className="relative rounded-xl border border-indigo-200 bg-indigo-50/40 p-2.5 flex items-center gap-3">
                <img
                  src={imagePreview}
                  alt="Audit target screenshot"
                  className="h-16 w-24 object-cover rounded-lg border border-slate-200 shadow-2xs"
                />
                <div className="min-w-0 flex-1 text-xs">
                  <div className="font-semibold text-slate-900 truncate">
                    {selectedFile?.name || 'Clipboard Screenshot'}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Multimodal Vision ready for evaluation
                  </div>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/20 transition-all">
                <Upload className="h-5 w-5 text-slate-400 mb-1" />
                <span className="text-xs font-semibold text-slate-700">
                  Drop screenshot here or <span className="text-[var(--gs-primary)]">Browse</span>
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  Supports PNG, JPG, WebP · You can also press Ctrl+V to paste
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-700 font-semibold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* 3. AUDIT REPORT DASHBOARD */}
      {auditResult && (
        <div className="space-y-6">
          {/* Top Score Banner */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Radial Score Gauge */}
              <div className="lg:col-span-3 flex flex-col items-center justify-center text-center p-4 rounded-xl border border-slate-100 bg-slate-50">
                <div
                  className={`flex h-24 w-24 items-center justify-center rounded-full border-4 font-display text-3xl font-bold tabular-nums shadow-sm ${getScoreColor(
                    auditResult.overallScore
                  )}`}
                >
                  {auditResult.overallScore}%
                </div>
                <div className="mt-2 text-xs font-bold text-slate-900">
                  AdSense Readiness Score
                </div>
                <div className="mt-1">{getStatusBadge(auditResult.readinessStatus)}</div>
              </div>

              {/* Summary & Metrics */}
              <div className="lg:col-span-9 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="text-xs text-slate-500 font-mono">
                    Target: <strong className="text-slate-900">{auditResult.url}</strong> · Audited at{' '}
                    {new Date(auditResult.analyzedAt).toLocaleTimeString()}
                  </div>
                  {auditResult.hasVisualScreenshot && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                      <Eye className="h-3 w-3" />
                      <span>Visual Vision Verified</span>
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                  {auditResult.summary}
                </p>

                {/* DOM Tech Highlights */}
                {auditResult.htmlMetrics && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs pt-1">
                    <div className="rounded-lg border border-slate-200 p-2 text-center bg-white">
                      <div className="text-slate-400 text-[10px]">Word Count</div>
                      <div className="font-mono font-bold text-slate-900 tabular-nums">
                        {auditResult.htmlMetrics.wordCount} words
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-2 text-center bg-white">
                      <div className="text-slate-400 text-[10px]">HTTPS SSL</div>
                      <div className="font-semibold text-emerald-600">
                        {auditResult.htmlMetrics.hasHttps ? 'Secured (PASS)' : 'Insecure (FAIL)'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-2 text-center bg-white">
                      <div className="text-slate-400 text-[10px]">Legal Links</div>
                      <div className="font-semibold text-indigo-600">
                        {auditResult.htmlMetrics.hasPrivacyPolicy ? 'Privacy Linked' : 'No Privacy'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-2 text-center bg-white">
                      <div className="text-slate-400 text-[10px]">Ad Disclosure</div>
                      <div
                        className={`font-semibold ${
                          auditResult.htmlMetrics.hasAdDisclosure ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      >
                        {auditResult.htmlMetrics.hasAdDisclosure ? 'Verified' : 'SPA / Client'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-2 text-center bg-white">
                      <div className="text-slate-400 text-[10px]">Author Schema</div>
                      <div
                        className={`font-semibold ${
                          auditResult.htmlMetrics.hasAuthorSchema ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      >
                        {auditResult.htmlMetrics.hasAuthorSchema ? 'Person JSON-LD' : 'Missing'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-2 text-center bg-white">
                      <div className="text-slate-400 text-[10px]">Image Alt Tags</div>
                      <div className="font-mono font-bold text-slate-900 tabular-nums">
                        {auditResult.htmlMetrics.imagesWithAlt}/{auditResult.htmlMetrics.totalImages}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 6-Category Policy Checklist */}
          <div className="space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-[var(--gs-primary)]" />
              <span>Weighted Policy Review Categories (6 Rulesets)</span>
            </h3>

            <div className="space-y-3">
              {auditResult.categories.map((cat) => {
                const isExpanded = expandedCategories[cat.name] ?? true;
                return (
                  <div
                    key={cat.name}
                    className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs"
                  >
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat.name)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        )}
                        <div>
                          <div className="font-display text-xs sm:text-sm font-bold text-slate-900">
                            {cat.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Category Weight: {cat.weight}%
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="font-mono text-sm font-bold text-slate-900">
                            {cat.score}%
                          </span>
                        </div>
                        {getStatusBadge(cat.status)}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-3">
                        {cat.findings.map((f, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-slate-200 bg-white p-3 space-y-1 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-900">{f.rule}</span>
                              {getStatusBadge(f.status)}
                            </div>
                            <p className="text-slate-600 leading-relaxed">{f.detail}</p>
                            {f.visualEvidence && (
                              <div className="flex items-center gap-1.5 text-[11px] text-indigo-700 bg-indigo-50/70 p-1.5 rounded border border-indigo-100">
                                <Eye className="h-3 w-3 shrink-0" />
                                <span>Visual Review: {f.visualEvidence}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actionable Exact Fix Plan */}
          {auditResult.exactFixPlan.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-indigo-600" />
                  <span>Actionable Exact Fix Plan (Copy-Paste Ready)</span>
                </h3>
                <span className="text-xs text-slate-500">
                  {auditResult.exactFixPlan.length} Remediation Snippets Generated
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {auditResult.exactFixPlan.map((fix, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-1">
                          {fix.category}
                        </span>
                        <h4 className="font-display text-sm font-bold text-slate-900">
                          {fix.title}
                        </h4>
                        <p className="text-xs text-slate-600 mt-1">{fix.description}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopySnippet(fix.codeSnippet, idx)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>{copiedSnippetIdx === idx ? 'Copied!' : 'Copy Code'}</span>
                      </button>
                    </div>

                    <div className="relative rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-slate-200 overflow-x-auto leading-relaxed border border-slate-800">
                      <pre>{fix.codeSnippet}</pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
