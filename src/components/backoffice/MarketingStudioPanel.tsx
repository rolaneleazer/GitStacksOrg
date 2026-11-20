import {
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Heart,
  KeyRound,
  Mail,
  Megaphone,
  MessageCircle,
  Music2,
  RefreshCw,
  Send,
  Share2,
  Sparkles,
  ThumbsUp
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.ts';
import type {
  MarketingDashboardResponse,
  MarketingScheduleItem
} from '../../shared/types.ts';
import { GrowthEmailModuleCard } from './GrowthEmailModuleCard.tsx';

type MarketingSubTab = 'schedule' | 'visual_proof' | 'accounts' | 'email';

function channelLabel(ch: MarketingScheduleItem['channel']): string {
  if (ch === 'facebook_page') return 'Facebook Page';
  if (ch === 'tiktok') return 'TikTok';
  return 'Website Organic';
}

export function MarketingStudioPanel() {
  const [subTab, setSubTab] = useState<MarketingSubTab>('schedule');
  const [dashboard, setDashboard] = useState<MarketingDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Free Organic Plan Generator inputs
  const [focusPillar, setFocusPillar] = useState('AI Integration, RAG & Cloud Automation');
  const [targetAudience, setTargetAudience] = useState(
    'SME Founders, CTOs, and Operations Leaders'
  );
  const [region, setRegion] = useState('Philippines & Global Remote');

  // Vault token forms
  const [fbPageId, setFbPageId] = useState('');
  const [fbPageName, setFbPageName] = useState('');
  const [fbAccessToken, setFbAccessToken] = useState('');
  const [savingFb, setSavingFb] = useState(false);

  const [ttHandle, setTtHandle] = useState('@gitstack');
  const [ttAccessToken, setTtAccessToken] = useState('');
  const [savingTt, setSavingTt] = useState(false);

  // Editable form state for currently selected schedule item
  const [editHeadline, setEditHeadline] = useState('');
  const [editHook, setEditHook] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editVideoScript, setEditVideoScript] = useState('');
  const [editCtaUrl, setEditCtaUrl] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getMarketingDashboard();
      setDashboard(data);
      if (data.accounts.facebook.accountId) setFbPageId(data.accounts.facebook.accountId);
      if (data.accounts.facebook.accountLabel && data.accounts.facebook.connected) {
        setFbPageName(data.accounts.facebook.accountLabel);
      }
      if (data.accounts.tiktok.accountLabel && data.accounts.tiktok.connected) {
        setTtHandle(data.accounts.tiktok.accountLabel);
      }
      if (data.schedule.length) {
        setSelectedItemId((prev) =>
          data.schedule.some((s) => s.id === prev) ? prev : data.schedule[0].id
        );
      }
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load Marketing Studio.'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Listen for OAuth popup completion messages from /api/oauth/facebook/callback and /api/oauth/tiktok/callback
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        type?: string;
        provider?: string;
        ok?: boolean;
        message?: string;
      } | null;
      if (!data || data.type !== 'SOCIAL_OAUTH_RESULT') return;
      setNotice({
        type: data.ok ? 'ok' : 'err',
        text: data.message || `${data.provider} OAuth flow finished.`
      });
      loadDashboard();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [loadDashboard]);

  const schedule = dashboard?.schedule || [];
  const selectedItem = useMemo(
    () => schedule.find((s) => s.id === selectedItemId) || schedule[0] || null,
    [schedule, selectedItemId]
  );

  useEffect(() => {
    if (!selectedItem) return;
    setEditHeadline(selectedItem.headline);
    setEditHook(selectedItem.hook);
    setEditCaption(selectedItem.caption);
    setEditVideoScript(selectedItem.videoScript);
    setEditCtaUrl(selectedItem.ctaUrl);
  }, [selectedItem]);

  const handleGeneratePlan = async () => {
    setGenerating(true);
    setNotice(null);
    try {
      const res = await api.generateMarketingPlan({
        focusPillar,
        targetAudience,
        region
      });
      setDashboard(res.dashboard);
      if (res.schedule.length) setSelectedItemId(res.schedule[0].id);
      setNotice({
        type: 'ok',
        text: `Generated a fresh 7-day free organic marketing schedule (${res.schedule.length} daily Facebook Page & TikTok campaigns).`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to generate 7-day marketing plan.'
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveItemEdits = async (newStatus?: MarketingScheduleItem['status']) => {
    if (!selectedItem) return;
    setSavingEdit(true);
    setNotice(null);
    try {
      const res = await api.updateMarketingScheduleItem(selectedItem.id, {
        headline: editHeadline,
        hook: editHook,
        caption: editCaption,
        videoScript: editVideoScript,
        ctaUrl: editCtaUrl,
        ...(newStatus ? { status: newStatus } : {})
      });
      setDashboard((prev) =>
        prev
          ? {
              ...prev,
              schedule: prev.schedule.map((s) => (s.id === res.item.id ? res.item : s))
            }
          : prev
      );
      setNotice({
        type: 'ok',
        text: newStatus === 'approved' ? 'Post approved for publishing.' : 'Post changes saved.'
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to save schedule item.'
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePublishItem = async (id: string) => {
    setPublishingId(id);
    setNotice(null);
    try {
      const res = await api.publishMarketingItem(id);
      setDashboard(res.dashboard);
      setNotice({
        type: 'ok',
        text: res.liveApiDelivered
          ? `Published live! ${res.proof.responseNote}`
          : res.proof.responseNote
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to publish post.'
      });
    } finally {
      setPublishingId(null);
    }
  };

  const handleStartOAuthPopup = async (provider: 'facebook' | 'tiktok') => {
    setNotice(null);
    try {
      const res =
        provider === 'facebook' ? await api.getFacebookOAuthUrl() : await api.getTikTokOAuthUrl();
      const popup = window.open(
        res.url,
        `gitstack_${provider}_oauth`,
        'width=620,height=720,scrollbars=yes'
      );
      if (!popup) {
        setNotice({
          type: 'err',
          text: 'Popup blocked by browser. Allow popups for this site or paste your Page/TikTok access token directly into the Vault form below.'
        });
      }
    } catch (err) {
      setNotice({
        type: 'err',
        text:
          err instanceof Error
            ? err.message
            : `OAuth app credentials are not configured yet. Use the direct Vault token form below.`
      });
    }
  };

  const handleSaveFacebookVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFb(true);
    setNotice(null);
    try {
      const res = await api.saveIntegration('facebook_page', {
        secret: fbAccessToken.trim() || undefined,
        configMeta: {
          fb_page_id: fbPageId.trim(),
          fb_page_name: fbPageName.trim() || undefined
        }
      });
      setFbAccessToken('');
      setNotice({
        type: res.testResult.ok ? 'ok' : 'err',
        text: res.testResult.message || 'Facebook Page credentials saved in Vault.'
      });
      await loadDashboard();
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to save Facebook Page credentials.'
      });
    } finally {
      setSavingFb(false);
    }
  };

  const handleSaveTikTokVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTt(true);
    setNotice(null);
    try {
      const res = await api.saveIntegration('tiktok', {
        secret: ttAccessToken.trim() || undefined,
        configMeta: {
          tiktok_handle: ttHandle.trim()
        }
      });
      setTtAccessToken('');
      setNotice({
        type: res.testResult.ok ? 'ok' : 'err',
        text: res.testResult.message || 'TikTok credentials saved in Vault.'
      });
      await loadDashboard();
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to save TikTok credentials.'
      });
    } finally {
      setSavingTt(false);
    }
  };

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1800);
  };

  if (loading && !dashboard) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500">
        Loading Organic Marketing &amp; Social Media Studio...
      </div>
    );
  }

  const fbAccount = dashboard?.accounts.facebook;
  const ttAccount = dashboard?.accounts.tiktok;
  const approvedOrPublished = schedule.filter(
    (s) => s.status === 'approved' || s.status === 'published'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header & KPI Strip */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-[var(--gs-primary)]">
              Free Organic Growth Agent · Facebook Page &amp; TikTok Direct Publishing
            </div>
            <h2 className="mt-1 font-display text-lg font-bold text-slate-900">
              AI Organic Marketing Studio &amp; Daily Content Schedule
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 max-w-2xl">
              Generate zero-ad-spend daily campaigns driving traffic to GitStack&apos;s app,{' '}
              <code>/demo</code> signup, and <code>/contact</code> consultation booking, inspect
              actual visual Facebook &amp; TikTok post mockups, and publish directly.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGeneratePlan}
            disabled={generating}
            className="min-h-[42px] inline-flex items-center gap-2 rounded-lg bg-[var(--gs-primary)] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Sparkles className={`h-4 w-4 shrink-0 ${generating ? 'animate-spin' : ''}`} />
            <span>{generating ? 'Drafting 7-Day Plan...' : 'Generate 7-Day Free Plan'}</span>
          </button>
        </div>

        {/* Plan Generator Controls */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500">
              Service Focus Pillar
            </label>
            <input
              type="text"
              value={focusPillar}
              onChange={(e) => setFocusPillar(e.target.value)}
              className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500">
              Target Audience
            </label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500">Target Region</label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* KPI Row */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="text-[11px] font-medium text-slate-500">Scheduled Daily Posts</div>
            <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {schedule.length}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Free organic calendar</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="text-[11px] font-medium text-slate-500">Approved / Published</div>
            <div className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums">
              {approvedOrPublished}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {dashboard?.proofs.length ?? 0} delivery proofs logged
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="text-[11px] font-medium text-slate-500">Facebook Page</div>
            <div
              className={`mt-1 text-sm font-bold truncate ${
                fbAccount?.connected ? 'text-emerald-700' : 'text-slate-700'
              }`}
            >
              {fbAccount?.connected ? fbAccount.accountLabel : 'Not Connected'}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {fbAccount?.connected ? 'Direct Graph API publish' : 'Connect in Accounts tab'}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="text-[11px] font-medium text-slate-500">TikTok Account</div>
            <div
              className={`mt-1 text-sm font-bold truncate ${
                ttAccount?.connected ? 'text-emerald-700' : 'text-slate-700'
              }`}
            >
              {ttAccount?.connected ? ttAccount.accountLabel : 'Not Connected'}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {ttAccount?.connected ? 'Direct Content Posting API' : 'Connect in Accounts tab'}
            </div>
          </div>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-medium ${
            notice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {(
          [
            { id: 'schedule', label: `7-Day Schedule Plan (${schedule.length})`, icon: Calendar },
            {
              id: 'visual_proof',
              label: `Visual Preview & Proof (${dashboard?.proofs.length ?? 0})`,
              icon: Eye
            },
            { id: 'accounts', label: 'FB & TikTok Accounts', icon: KeyRound },
            { id: 'email', label: 'Email Module', icon: Mail }
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[var(--gs-primary)] text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: 7-DAY DAILY CONTENT SCHEDULE */}
      {subTab === 'schedule' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Schedule List */}
          <div className="lg:col-span-7 space-y-2.5 min-w-0">
            {schedule.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                    isSelected
                      ? 'border-[var(--gs-primary)] bg-[var(--gs-soft-bg)]/50'
                      : 'border-slate-200 bg-white hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold text-slate-500">
                      <span className="font-mono text-[var(--gs-primary)]">{item.dayLabel}</span> ·{' '}
                      {item.scheduledDate} {item.scheduledTime} ·{' '}
                      <span className="text-slate-800">{channelLabel(item.channel)}</span> ·{' '}
                      {item.contentFormat}
                    </div>
                    <span
                      className={`text-[11px] font-semibold capitalize ${
                        item.status === 'published'
                          ? 'text-emerald-700'
                          : item.status === 'approved'
                            ? 'text-[var(--gs-primary)]'
                            : item.status === 'failed'
                              ? 'text-red-700'
                              : 'text-amber-700'
                      }`}
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-1.5 font-display text-sm font-bold text-slate-900">
                    {item.headline}
                  </div>
                  <p className="mt-1 text-xs text-slate-600 line-clamp-2">{item.caption}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span>
                      Pillar: <strong className="text-slate-700">{item.servicePillar}</strong> · CTA:{' '}
                      <span className="font-mono">{item.ctaUrl}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItemId(item.id);
                          setSubTab('visual_proof');
                        }}
                        className="font-semibold text-slate-700 hover:text-[var(--gs-primary)]"
                      >
                        Visual Preview
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePublishItem(item.id);
                        }}
                        disabled={publishingId === item.id}
                        className="rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
                      >
                        {publishingId === item.id ? 'Publishing...' : 'Publish Now'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Day Editor */}
          <div className="lg:col-span-5 min-w-0">
            {selectedItem && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 lg:sticky lg:top-24">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <div className="text-[11px] font-semibold text-[var(--gs-primary)]">
                      {selectedItem.dayLabel} · {channelLabel(selectedItem.channel)}
                    </div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Edit &amp; Approve Daily Post
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubTab('visual_proof')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--gs-primary)] whitespace-nowrap shrink-0"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>See Screenshot Preview</span>
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">Headline</label>
                  <input
                    type="text"
                    value={editHeadline}
                    onChange={(e) => setEditHeadline(e.target.value)}
                    className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Opening Hook (First 3 Seconds)
                  </label>
                  <input
                    type="text"
                    value={editHook}
                    onChange={(e) => setEditHook(e.target.value)}
                    className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Post Caption (Facebook / TikTok)
                  </label>
                  <textarea
                    rows={5}
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Short Video / Reel Script
                  </label>
                  <textarea
                    rows={3}
                    value={editVideoScript}
                    onChange={(e) => setEditVideoScript(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Conversion Link (App / Signup / Contact)
                  </label>
                  <input
                    type="text"
                    value={editCtaUrl}
                    onChange={(e) => setEditCtaUrl(e.target.value)}
                    className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-xs font-mono text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSaveItemEdits()}
                    disabled={savingEdit}
                    className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    Save Edits
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveItemEdits('approved')}
                    disabled={savingEdit}
                    className="min-h-[38px] rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    Approve Post
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePublishItem(selectedItem.id)}
                    disabled={publishingId === selectedItem.id}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>
                      {publishingId === selectedItem.id ? 'Publishing...' : 'Publish Live'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: VISUAL PREVIEW ("SCREENSHOT & ACTUAL") + LIVE PROOF LOG */}
      {subTab === 'visual_proof' && selectedItem && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex-1 min-w-[240px]">
              <label className="block text-[11px] font-semibold text-slate-500">
                Select Campaign Post to Preview Visually
              </label>
              <select
                value={selectedItem.id}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-xs font-medium text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
              >
                {schedule.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.dayLabel} ({channelLabel(s.channel)}) — {s.headline}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    'caption',
                    `${selectedItem.caption}\n\n${selectedItem.hashtags.join(' ')}\n${selectedItem.ctaUrl}`
                  )
                }
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                {copiedKey === 'caption' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-700" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copiedKey === 'caption' ? 'Copied Copy' : 'Copy Post Text'}</span>
              </button>
              <button
                type="button"
                onClick={() => handlePublishItem(selectedItem.id)}
                disabled={publishingId === selectedItem.id}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
                <span>
                  {publishingId === selectedItem.id ? 'Publishing...' : 'Publish This Campaign'}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Actual Facebook Page Post Preview */}
            <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <div className="text-[11px] font-semibold text-[#1877F2]">
                    Facebook Page Feed Mockup
                  </div>
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Actual Visual Post Preview
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500">Organic Link + Photo Card</span>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="p-3.5 flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--gs-primary)] text-xs font-bold text-white shrink-0">
                    GS
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {fbAccount?.connected ? fbAccount.accountLabel : 'GitStack Engineering'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {selectedItem.scheduledDate} · {selectedItem.scheduledTime} · Public
                    </div>
                  </div>
                </div>

                <div className="px-3.5 pb-3 text-xs leading-relaxed text-slate-800 whitespace-pre-line">
                  {selectedItem.caption}
                  <div className="mt-2 text-[#1877F2] font-medium">
                    {selectedItem.hashtags.join(' ')}
                  </div>
                </div>

                <div className="aspect-[16/9] w-full bg-slate-100 overflow-hidden">
                  <img
                    src={selectedItem.coverImage}
                    alt={selectedItem.coverAlt}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 bg-slate-50 px-3.5 py-3 border-t border-slate-200">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">
                      GIT-STACK.ORG
                    </div>
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {selectedItem.headline}
                    </div>
                  </div>
                  <a
                    href={selectedItem.ctaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-800 whitespace-nowrap shrink-0"
                  >
                    {selectedItem.ctaLabel}
                  </a>
                </div>

                <div className="grid grid-cols-3 border-t border-slate-200 text-center text-[11px] font-semibold text-slate-500">
                  <div className="py-2 inline-flex items-center justify-center gap-1">
                    <ThumbsUp className="h-3.5 w-3.5" />
                    <span>Like</span>
                  </div>
                  <div className="py-2 inline-flex items-center justify-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>Comment</span>
                  </div>
                  <div className="py-2 inline-flex items-center justify-center gap-1">
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Share</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actual TikTok 9:16 Vertical Preview + Spoken Script */}
            <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <div className="text-[11px] font-semibold text-slate-900">
                    TikTok 9:16 Vertical Preview
                  </div>
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Short-Form Video Frame &amp; Script
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('script', selectedItem.videoScript)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--gs-primary)]"
                >
                  {copiedKey === 'script' ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedKey === 'script' ? 'Script Copied' : 'Copy Script'}</span>
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-12 items-start">
                {/* 9:16 Phone Preview */}
                <div className="sm:col-span-6">
                  <div className="relative mx-auto w-full max-w-[230px] aspect-[9/16] rounded-2xl border border-slate-900 bg-slate-950 overflow-hidden text-white">
                    <img
                      src={selectedItem.coverImage}
                      alt={selectedItem.coverAlt}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover opacity-75"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/40" />

                    {/* Top hook overlay */}
                    <div className="absolute top-4 left-3 right-3 rounded-lg bg-black/65 px-2.5 py-2 text-[11px] font-bold leading-snug text-white">
                      {selectedItem.hook}
                    </div>

                    {/* Right action rail */}
                    <div className="absolute right-2.5 bottom-20 flex flex-col items-center gap-3 text-[10px]">
                      <div className="flex flex-col items-center">
                        <Heart className="h-5 w-5" />
                        <span>1.4K</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <MessageCircle className="h-5 w-5" />
                        <span>84</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <Share2 className="h-5 w-5" />
                        <span>Share</span>
                      </div>
                    </div>

                    {/* Bottom metadata */}
                    <div className="absolute bottom-3 left-3 right-11 space-y-1.5">
                      <div className="text-xs font-bold">
                        {ttAccount?.connected ? ttAccount.accountLabel : '@gitstack'}
                      </div>
                      <p className="text-[10px] leading-snug text-white/90 line-clamp-3">
                        {selectedItem.caption}
                      </p>
                      <div className="text-[10px] text-sky-300 truncate">
                        {selectedItem.hashtags.join(' ')}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-white/75 truncate">
                        <Music2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">Original Sound · GitStack Tech</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timed Voiceover Script */}
                <div className="sm:col-span-6 space-y-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
                    <div className="text-[11px] font-semibold text-slate-700">
                      Timed Spoken Script (30s–45s)
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-700 whitespace-pre-line">
                      {selectedItem.videoScript}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-xs">
                    <div className="text-[11px] font-semibold text-slate-700">
                      Bio / Pinned Comment Link
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-[var(--gs-primary)] break-all">
                      {selectedItem.ctaUrl}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Proof Receipts Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h3 className="font-display text-sm font-bold text-slate-900">
                Actual Campaign Proof &amp; Publishing Receipts ({dashboard?.proofs.length ?? 0})
              </h3>
              <span className="text-[11px] text-slate-500">
                Verifiable delivery receipts from Facebook Graph API, TikTok API, or organic export
              </span>
            </div>
            {!dashboard?.proofs.length ? (
              <div className="px-5 py-8 text-center text-xs text-slate-500">
                No campaigns published yet. Click <strong>Publish Now</strong> on any scheduled post
                to record live API proof or an organic publish receipt.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                      <th className="px-4 py-2.5">Channel</th>
                      <th className="px-4 py-2.5">Campaign</th>
                      <th className="px-4 py-2.5">Delivery Mode</th>
                      <th className="px-4 py-2.5">Proof / Permalink</th>
                      <th className="px-4 py-2.5">Published At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dashboard.proofs.map((proof) => (
                      <tr key={proof.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-semibold text-slate-800 whitespace-nowrap">
                          {channelLabel(proof.channel)}
                        </td>
                        <td className="px-4 py-2.5 max-w-[280px]">
                          <div className="font-medium text-slate-900 truncate">{proof.headline}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {proof.responseNote}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              proof.mode === 'live_api' ? 'text-emerald-700' : 'text-[var(--gs-primary)]'
                            }`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              {proof.mode === 'live_api' ? 'Live Social API' : 'Organic Ready'}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px]">
                          {proof.remotePostUrl ? (
                            <a
                              href={proof.remotePostUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[var(--gs-primary)] hover:underline"
                            >
                              <span>{proof.remotePostId || 'Open Post'}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-slate-500">{proof.remotePostId || '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] tabular-nums text-slate-500 whitespace-nowrap">
                          {new Date(proof.publishedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: FACEBOOK PAGE & TIKTOK ACCOUNT CONNECTIONS (OAUTH + VAULT) */}
      {subTab === 'accounts' && fbAccount && ttAccount && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Facebook Page Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
              <div>
                <div className="text-[11px] font-semibold text-[#1877F2]">Meta Graph API v20.0</div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Facebook Page Publishing
                </h3>
                <p className="mt-0.5 text-xs text-slate-600">
                  Connect via OAuth popup or paste your Page ID &amp; Page Access Token into the
                  encrypted server Vault.
                </p>
              </div>
              <span
                className={`text-xs font-semibold whitespace-nowrap shrink-0 ${
                  fbAccount.connected ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                {fbAccount.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">Option 1: OAuth Connect</span>
                <button
                  type="button"
                  onClick={() => handleStartOAuthPopup('facebook')}
                  className="min-h-[34px] rounded-lg bg-[#1877F2] px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-95 whitespace-nowrap shrink-0"
                >
                  Connect Facebook via OAuth
                </button>
              </div>
              <div className="text-[11px] text-slate-600 space-y-1">
                <div>Add these exact OAuth Redirect URIs in your Meta Developer App:</div>
                <div className="flex items-center justify-between gap-2 font-mono text-[10px] bg-white border border-slate-200 rounded px-2 py-1">
                  <span className="truncate">{fbAccount.callbackUrls.development}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('fb-dev', fbAccount.callbackUrls.development)}
                    className="text-[var(--gs-primary)] font-semibold shrink-0"
                  >
                    {copiedKey === 'fb-dev' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 font-mono text-[10px] bg-white border border-slate-200 rounded px-2 py-1">
                  <span className="truncate">{fbAccount.callbackUrls.shared}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('fb-shared', fbAccount.callbackUrls.shared)}
                    className="text-[var(--gs-primary)] font-semibold shrink-0"
                  >
                    {copiedKey === 'fb-shared' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveFacebookVault} className="space-y-3">
              <div className="text-xs font-semibold text-slate-800">
                Option 2: Direct Encrypted Vault Token
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Facebook Page ID
                  </label>
                  <input
                    type="text"
                    required
                    value={fbPageId}
                    onChange={(e) => setFbPageId(e.target.value)}
                    placeholder="e.g. 109283746512345"
                    className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-xs font-mono text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Page Display Name (optional)
                  </label>
                  <input
                    type="text"
                    value={fbPageName}
                    onChange={(e) => setFbPageName(e.target.value)}
                    placeholder="GitStack Engineering"
                    className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">
                  Page Access Token (pages_manage_posts)
                </label>
                <input
                  type="password"
                  value={fbAccessToken}
                  onChange={(e) => setFbAccessToken(e.target.value)}
                  placeholder="EAA..."
                  className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-xs font-mono text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={savingFb}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <span>{savingFb ? 'Testing & Saving...' : 'Save & Test Facebook Page'}</span>
              </button>
              {fbAccount.lastTestMessage && (
                <div className="text-[11px] text-slate-600">{fbAccount.lastTestMessage}</div>
              )}
            </form>
          </div>

          {/* TikTok Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
              <div>
                <div className="text-[11px] font-semibold text-slate-900">
                  TikTok Content Posting API v2
                </div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  TikTok Account Publishing
                </h3>
                <p className="mt-0.5 text-xs text-slate-600">
                  Connect your TikTok creator/business account via OAuth popup or save your TikTok
                  OAuth access token in the encrypted server Vault.
                </p>
              </div>
              <span
                className={`text-xs font-semibold whitespace-nowrap shrink-0 ${
                  ttAccount.connected ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                {ttAccount.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">Option 1: OAuth Connect</span>
                <button
                  type="button"
                  onClick={() => handleStartOAuthPopup('tiktok')}
                  className="min-h-[34px] rounded-lg bg-slate-950 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  Connect TikTok via OAuth
                </button>
              </div>
              <div className="text-[11px] text-slate-600 space-y-1">
                <div>Add these exact Redirect URIs in your TikTok Developer Portal:</div>
                <div className="flex items-center justify-between gap-2 font-mono text-[10px] bg-white border border-slate-200 rounded px-2 py-1">
                  <span className="truncate">{ttAccount.callbackUrls.development}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('tt-dev', ttAccount.callbackUrls.development)}
                    className="text-[var(--gs-primary)] font-semibold shrink-0"
                  >
                    {copiedKey === 'tt-dev' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 font-mono text-[10px] bg-white border border-slate-200 rounded px-2 py-1">
                  <span className="truncate">{ttAccount.callbackUrls.shared}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('tt-shared', ttAccount.callbackUrls.shared)}
                    className="text-[var(--gs-primary)] font-semibold shrink-0"
                  >
                    {copiedKey === 'tt-shared' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveTikTokVault} className="space-y-3">
              <div className="text-xs font-semibold text-slate-800">
                Option 2: Direct Encrypted Vault Token
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">
                  TikTok Handle
                </label>
                <input
                  type="text"
                  required
                  value={ttHandle}
                  onChange={(e) => setTtHandle(e.target.value)}
                  placeholder="@gitstack"
                  className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700">
                  TikTok OAuth Access Token (video.publish)
                </label>
                <input
                  type="password"
                  value={ttAccessToken}
                  onChange={(e) => setTtAccessToken(e.target.value)}
                  placeholder="act...."
                  className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-xs font-mono text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={savingTt}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <span>{savingTt ? 'Testing & Saving...' : 'Save & Test TikTok Account'}</span>
              </button>
              {ttAccount.lastTestMessage && (
                <div className="text-[11px] text-slate-600">{ttAccount.lastTestMessage}</div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: DEDICATED EMAIL MODULE */}
      {subTab === 'email' && dashboard && (
        <GrowthEmailModuleCard
          moduleKey="marketing"
          moduleTitle="Marketing & Social Studio"
          description="Email your 7-day organic social content calendar, Facebook Page & TikTok connection status, and published campaign proof logs via Lark Mail SMTP."
          config={dashboard.emailConfig}
          logs={dashboard.emailLogs}
          onSaveConfig={async (patch) => {
            const res = await api.saveMarketingEmailConfig(patch);
            setDashboard((prev) => (prev ? { ...prev, emailConfig: res.emailConfig } : prev));
          }}
          onSendNow={async (recipient) => {
            const res = await api.sendMarketingEmailReport(recipient);
            setDashboard(res.dashboard);
            return { delivered: res.delivered, message: res.message };
          }}
        />
      )}
    </div>
  );
}
