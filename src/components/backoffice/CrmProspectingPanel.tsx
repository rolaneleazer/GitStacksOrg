import {
  ArrowRight,
  BarChart3,
  Bot,
  Briefcase,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  X
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api.ts';
import {
  connectGmailWithGoogle,
  getCachedGmailToken,
  initGmailAuth,
  sendGmailMessage
} from '../../lib/gmail.ts';
import type {
  ClientInquiry,
  CrmFollowUpStep,
  CrmLead,
  CrmLeadStage,
  CrmOutreachLog,
  DiscoveredProspectCandidate,
  EmailVerificationStatus,
  LarkConnectionStatus,
  LeadSourceType,
  OpenSourceSyncTrack,
  ServiceCategory,
  UserWorkflowItem
} from '../../shared/types.ts';
import { GoogleMapsProspectingTab } from './GoogleMapsProspectingTab.tsx';
import { MultiSourceImportPanel } from './MultiSourceImportPanel.tsx';
import { SourcesAttributionTab } from './SourcesAttributionTab.tsx';

interface CrmProspectingPanelProps {
  onDealWon?: (payload: {
    inquiry: ClientInquiry | null;
    workflowItem: UserWorkflowItem | null;
  }) => void;
  onOpenSettings?: () => void;
}

const PRIMARY_STAGES: { id: CrmLeadStage; label: string; hint: string }[] = [
  { id: 'discovered', label: 'Discovered', hint: 'Imported open-source & web leads' },
  { id: 'researched', label: 'Researched', hint: 'Brief & proposal drafted by Agent' },
  { id: 'proposed', label: 'Proposed', hint: 'Initial proposal dispatched' },
  { id: 'follow_up', label: 'Follow-Up', hint: 'Active 3-step follow-up cadence' },
  { id: 'won', label: 'Won', hint: 'Converted to Client & Onboarding' }
];

const ALL_STAGES: { id: CrmLeadStage; label: string }[] = [
  ...PRIMARY_STAGES.map((s) => ({ id: s.id, label: s.label })),
  { id: 'lost', label: 'Lost / Archived' }
];

const SERVICES: ServiceCategory[] = [
  'AI Integration',
  'ML Automation',
  'Cloud Infrastructure',
  'Custom Software',
  'Technical Consulting'
];

const EMAIL_STATUS_LABEL: Record<EmailVerificationStatus, { text: string; tone: string }> = {
  verified_mx: { text: 'MX Verified', tone: 'text-emerald-700' },
  public_found: { text: 'Public Found', tone: 'text-sky-700' },
  inferred: { text: 'Domain Inferred', tone: 'text-amber-700' },
  invalid: { text: 'Unverified', tone: 'text-slate-500' }
};

export function CrmProspectingPanel({ onDealWon, onOpenSettings }: CrmProspectingPanelProps) {
  const [subView, setSubView] = useState<
    'directory' | 'pipeline' | 'discover' | 'maps' | 'sources' | 'logs'
  >('directory');
  const [showLostColumn, setShowLostColumn] = useState(false);

  // CRM Data
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [logs, setLogs] = useState<CrmOutreachLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Trending Open-Source Repo Database Sync
  const [syncTrack, setSyncTrack] = useState<OpenSourceSyncTrack>('all');
  const [syncingDb, setSyncingDb] = useState(false);
  const [lastSyncInfo, setLastSyncInfo] = useState<{
    reposScanned: number;
    insertedCount: number;
    mergedCount: number;
    mxVerifiedCount: number;
    sourcesSynced: string[];
  } | null>(null);
  const autoSyncedRef = useRef(false);

  // Apollo-Style Directory Filters & Bulk Selection
  const [dirSearch, setDirSearch] = useState('');
  const [filterStage, setFilterStage] = useState<'all' | CrmLeadStage>('all');
  const [filterSource, setFilterSource] = useState<'all' | LeadSourceType>('all');
  const [filterEmailStatus, setFilterEmailStatus] = useState<'all' | EmailVerificationStatus>('all');
  const [filterService, setFilterService] = useState<'all' | ServiceCategory>('all');
  const [filterTech, setFilterTech] = useState<string>('all');
  const [filterMinFit, setFilterMinFit] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'updated_desc' | 'fit_desc' | 'value_desc' | 'company_asc'>(
    'fit_desc'
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStageTarget, setBulkStageTarget] = useState<CrmLeadStage>('researched');

  // Lark & Gmail Mail Channels
  const [larkStatus, setLarkStatus] = useState<LarkConnectionStatus | null>(null);
  const [larkBusy, setLarkBusy] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailBusy, setGmailBusy] = useState(false);

  // Open-Source Discovery
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'auto' | 'github' | 'website'>('auto');
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<DiscoveredProspectCandidate[]>([]);
  const [sourcesChecked, setSourcesChecked] = useState<string[]>([]);
  const [importingId, setImportingId] = useState<string | null>(null);

  // Manual Lead Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    contact_name: '',
    role_title: '',
    email: '',
    company_name: '',
    website_url: '',
    github_url: '',
    recommended_service: 'AI Integration' as ServiceCategory,
    deal_value: 30000
  });
  const [savingManual, setSavingManual] = useState(false);

  // Lead Dossier & Proposal Modal
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [draftEdit, setDraftEdit] = useState<CrmLead | null>(null);
  const [researchingId, setResearchingId] = useState<string | null>(null);
  const [savingLead, setSavingLead] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  // Approve & Send Confirmation Modal
  const [sendModal, setSendModal] = useState<{
    lead: CrmLead;
    channel: 'lark_mail' | 'gmail_api';
    recipient_email: string;
    subject: string;
    body: string;
    step_number?: number;
  } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleSyncOpenSource = useCallback(
    async (trackOverride?: OpenSourceSyncTrack, silentIfAuto = false) => {
      const targetTrack = trackOverride || syncTrack;
      setSyncingDb(true);
      if (!silentIfAuto) setNotice(null);
      try {
        const res = await api.syncOpenSourceLeads(targetTrack);
        setLeads(res.leads);
        setLastSyncInfo({
          reposScanned: res.reposScanned,
          insertedCount: res.insertedCount,
          mergedCount: res.mergedCount,
          mxVerifiedCount: res.mxVerifiedCount,
          sourcesSynced: res.sourcesSynced
        });
        setNotice({
          type: 'ok',
          text: `Synced ${res.reposScanned} open-source repos: ${res.insertedCount} new leads added, ${res.mergedCount} existing leads enriched (${res.mxVerifiedCount} MX verified).`
        });
      } catch (err) {
        if (!silentIfAuto) {
          setNotice({
            type: 'err',
            text: err instanceof Error ? err.message : 'Failed to sync open-source repositories.'
          });
        }
      } finally {
        setSyncingDb(false);
      }
    },
    [syncTrack]
  );

  const loadCrmData = useCallback(async () => {
    setLoading(true);
    try {
      const [crmRes, larkRes] = await Promise.all([
        api.listCrmLeads(),
        api.getLarkStatus().catch(() => null)
      ]);
      setLeads(crmRes.leads);
      setLogs(crmRes.logs);
      if (larkRes) setLarkStatus(larkRes);

      if (crmRes.leads.length === 0 && !autoSyncedRef.current) {
        autoSyncedRef.current = true;
        handleSyncOpenSource('all', true);
      }
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load CRM leads.'
      });
    } finally {
      setLoading(false);
    }
  }, [handleSyncOpenSource]);

  useEffect(() => {
    loadCrmData();
  }, [loadCrmData]);

  // Listen for Firebase Gmail OAuth state
  useEffect(() => {
    const unsub = initGmailAuth(
      (user) => setGmailEmail(user.email || 'Connected Gmail'),
      () => setGmailEmail(null)
    );
    return () => unsub();
  }, []);

  const handleDisconnectLark = async () => {
    setLarkBusy(true);
    try {
      await api.disconnectLark();
      const status = await api.getLarkStatus();
      setLarkStatus(status);
      setNotice({ type: 'ok', text: 'Lark Mail SMTP account disconnected.' });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to disconnect Lark Mail.'
      });
    } finally {
      setLarkBusy(false);
    }
  };

  const handleConnectGmail = async () => {
    setGmailBusy(true);
    setNotice(null);
    try {
      const { user } = await connectGmailWithGoogle();
      setGmailEmail(user.email || 'Connected Gmail');
      setNotice({ type: 'ok', text: `Gmail connected (${user.email || 'ready'}) for CRM outreach.` });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gmail sign-in failed.'
      });
    } finally {
      setGmailBusy(false);
    }
  };

  const handleDiscover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setNotice(null);
    try {
      const res = await api.discoverCrmLeads(searchQuery.trim(), searchMode);
      setCandidates(res.candidates);
      setSourcesChecked(res.sourcesChecked);
      if (res.candidates.length === 0) {
        setNotice({
          type: 'err',
          text: 'No public contacts matched that query. Try a company domain (e.g. supabase.com) or open-source repo keyword (e.g. langchain).'
        });
      }
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Open-source lead search failed.'
      });
    } finally {
      setSearching(false);
    }
  };

  const handleImportCandidate = async (candidate: DiscoveredProspectCandidate) => {
    setImportingId(candidate.id);
    setNotice(null);
    try {
      const res = await api.createCrmLead({
        contact_name: candidate.contact_name,
        role_title: candidate.role_title,
        email: candidate.email,
        email_status: candidate.email_status,
        company_name: candidate.company_name,
        company_domain: candidate.company_domain,
        website_url: candidate.website_url,
        github_url: candidate.github_url,
        source_type: candidate.source_type,
        source_urls: candidate.source_urls,
        tech_stack: candidate.tech_stack,
        research_brief: candidate.snippet,
        fit_score: candidate.fit_score,
        deal_value: candidate.fit_score >= 85 ? 45000 : 28000,
        stage: 'discovered'
      });
      setLeads((prev) => [res.lead, ...prev]);
      setNotice({
        type: 'ok',
        text: `Imported ${res.lead.contact_name} (${res.lead.company_name}) into Discovered stage.`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to import lead.'
      });
    } finally {
      setImportingId(null);
    }
  };

  const handleCreateManualLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingManual(true);
    setNotice(null);
    try {
      const cleanWebsite = manualForm.website_url.trim();
      let domain = '';
      if (cleanWebsite) {
        try {
          domain = new URL(cleanWebsite.startsWith('http') ? cleanWebsite : `https://${cleanWebsite}`).hostname.replace(/^www\./, '');
        } catch {
          domain = cleanWebsite.replace(/^https?:\/\//, '').split('/')[0];
        }
      }
      const res = await api.createCrmLead({
        ...manualForm,
        company_domain: domain,
        source_type: 'manual',
        stage: 'discovered'
      });
      setLeads((prev) => [res.lead, ...prev]);
      setShowAddModal(false);
      setManualForm({
        contact_name: '',
        role_title: '',
        email: '',
        company_name: '',
        website_url: '',
        github_url: '',
        recommended_service: 'AI Integration',
        deal_value: 30000
      });
      setNotice({ type: 'ok', text: `Added ${res.lead.company_name} to CRM Pipeline.` });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to add manual lead.'
      });
    } finally {
      setSavingManual(false);
    }
  };

  const openLeadDossier = (lead: CrmLead) => {
    setSelectedLead(lead);
    setDraftEdit(JSON.parse(JSON.stringify(lead)) as CrmLead);
  };

  const handleMoveStage = async (lead: CrmLead, nextStage: CrmLeadStage) => {
    try {
      const res = await api.updateCrmLead(lead.id, { stage: nextStage });
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? res.lead : l)));
      if (selectedLead?.id === lead.id) {
        setSelectedLead(res.lead);
        setDraftEdit(JSON.parse(JSON.stringify(res.lead)) as CrmLead);
      }
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to move lead stage.'
      });
    }
  };

  const handleRunAgentResearch = async (leadId: string) => {
    setResearchingId(leadId);
    setNotice(null);
    try {
      const res = await api.researchCrmLead(leadId);
      setLeads((prev) => prev.map((l) => (l.id === leadId ? res.lead : l)));
      if (selectedLead?.id === leadId) {
        setSelectedLead(res.lead);
        setDraftEdit(JSON.parse(JSON.stringify(res.lead)) as CrmLead);
      }
      setNotice({
        type: 'ok',
        text: `Agent completed research, personalized proposal, and 3-step follow-up sequence for ${res.lead.company_name}.`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Agent research failed.'
      });
    } finally {
      setResearchingId(null);
    }
  };

  const handleSaveDossier = async () => {
    if (!draftEdit) return;
    setSavingLead(true);
    setNotice(null);
    try {
      const res = await api.updateCrmLead(draftEdit.id, {
        contact_name: draftEdit.contact_name,
        role_title: draftEdit.role_title,
        email: draftEdit.email,
        company_name: draftEdit.company_name,
        website_url: draftEdit.website_url,
        github_url: draftEdit.github_url,
        recommended_service: draftEdit.recommended_service,
        deal_value: draftEdit.deal_value,
        fit_score: draftEdit.fit_score,
        stage: draftEdit.stage,
        research_brief: draftEdit.research_brief,
        proposal_subject: draftEdit.proposal_subject,
        proposal_body: draftEdit.proposal_body,
        follow_up_sequence: draftEdit.follow_up_sequence
      });
      setLeads((prev) => prev.map((l) => (l.id === res.lead.id ? res.lead : l)));
      setSelectedLead(res.lead);
      setDraftEdit(JSON.parse(JSON.stringify(res.lead)) as CrmLead);
      setNotice({ type: 'ok', text: `Saved updates for ${res.lead.company_name}.` });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save lead updates.'
      });
    } finally {
      setSavingLead(false);
    }
  };

  const handleDeleteLead = async (id: string) => {
    try {
      await api.deleteCrmLead(id);
      setLeads((prev) => prev.filter((l) => l.id !== id));
      if (selectedLead?.id === id) {
        setSelectedLead(null);
        setDraftEdit(null);
      }
      setNotice({ type: 'ok', text: 'Lead removed from CRM.' });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to delete lead.'
      });
    }
  };

  const openApproveToSend = (
    lead: CrmLead,
    subject: string,
    body: string,
    stepNumber?: number
  ) => {
    const preferredChannel: 'lark_mail' | 'gmail_api' =
      larkStatus?.connected ? 'lark_mail' : gmailEmail ? 'gmail_api' : 'lark_mail';
    setSendModal({
      lead,
      channel: preferredChannel,
      recipient_email: lead.email,
      subject,
      body,
      step_number: stepNumber
    });
  };

  const handleConfirmSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendModal) return;
    setSendingEmail(true);
    setNotice(null);

    try {
      let result: { lead: CrmLead; log: CrmOutreachLog };

      if (sendModal.channel === 'gmail_api') {
        let token = getCachedGmailToken();
        if (!token) {
          const authRes = await connectGmailWithGoogle();
          token = authRes.accessToken;
          setGmailEmail(authRes.user.email || 'Connected Gmail');
        }
        try {
          const gmailRes = await sendGmailMessage(token, {
            to: sendModal.recipient_email,
            subject: sendModal.subject,
            body: sendModal.body
          });
          result = await api.sendCrmProposal(sendModal.lead.id, {
            channel: 'gmail_api',
            recipient_email: sendModal.recipient_email,
            subject: sendModal.subject,
            body: sendModal.body,
            step_number: sendModal.step_number,
            provider_message_id: gmailRes.id
          });
        } catch (gmailErr) {
          const errMsg = gmailErr instanceof Error ? gmailErr.message : 'Gmail API dispatch failed';
          await api
            .sendCrmProposal(sendModal.lead.id, {
              channel: 'gmail_api',
              recipient_email: sendModal.recipient_email,
              subject: sendModal.subject,
              body: sendModal.body,
              step_number: sendModal.step_number,
              client_error: errMsg
            })
            .catch(() => {});
          throw new Error(errMsg);
        }
      } else {
        result = await api.sendCrmProposal(sendModal.lead.id, {
          channel: 'lark_mail',
          recipient_email: sendModal.recipient_email,
          subject: sendModal.subject,
          body: sendModal.body,
          step_number: sendModal.step_number
        });
      }

      setLeads((prev) => prev.map((l) => (l.id === result.lead.id ? result.lead : l)));
      setLogs((prev) => [result.log, ...prev]);
      if (selectedLead?.id === result.lead.id) {
        setSelectedLead(result.lead);
        setDraftEdit(JSON.parse(JSON.stringify(result.lead)) as CrmLead);
      }
      setSendModal(null);
      setNotice({
        type: 'ok',
        text: `Dispatched via ${
          result.log.channel === 'lark_mail' ? 'Lark Mail' : 'Gmail'
        } to ${result.log.recipient_email} (ID: ${result.log.provider_message_id}).`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to dispatch proposal email.'
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleConvertToWon = async (leadId: string) => {
    setConvertingId(leadId);
    setNotice(null);
    try {
      const res = await api.convertCrmLeadToWon(leadId);
      setLeads((prev) => prev.map((l) => (l.id === leadId ? res.lead : l)));
      if (selectedLead?.id === leadId) {
        setSelectedLead(res.lead);
        setDraftEdit(JSON.parse(JSON.stringify(res.lead)) as CrmLead);
      }
      onDealWon?.({ inquiry: res.inquiry, workflowItem: res.workflowItem });
      setNotice({
        type: 'ok',
        text: `Converted ${res.lead.company_name} to Won! Created Client Inquiry${
          res.inquiry ? ` (${res.inquiry.id})` : ''
        } & Kickoff Workflow task.`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to convert lead.'
      });
    } finally {
      setConvertingId(null);
    }
  };

  const kpis = useMemo(() => {
    const active = leads.filter((l) => l.stage !== 'lost');
    const totalValue = active.reduce((acc, l) => acc + (Number(l.deal_value) || 0), 0);
    const wonValue = leads
      .filter((l) => l.stage === 'won')
      .reduce((acc, l) => acc + (Number(l.deal_value) || 0), 0);
    const proposedCount = leads.filter(
      (l) => l.stage === 'proposed' || l.stage === 'follow_up' || l.stage === 'won'
    ).length;
    const wonCount = leads.filter((l) => l.stage === 'won').length;
    return {
      totalValue,
      wonValue,
      activeCount: active.length,
      proposedCount,
      wonCount
    };
  }, [leads]);

  const importedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) {
      if (l.email) set.add(l.email.toLowerCase());
      if (l.company_domain) set.add(l.company_domain.toLowerCase());
    }
    return set;
  }, [leads]);

  const visibleColumns = showLostColumn
    ? [...PRIMARY_STAGES, { id: 'lost' as CrmLeadStage, label: 'Lost', hint: 'Closed / Archived' }]
    : PRIMARY_STAGES;

  const availableTechTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of leads) {
      for (const t of l.tech_stack || []) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 24)
      .map(([tag, count]) => ({ tag, count }));
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const q = dirSearch.trim().toLowerCase();
    const rows = leads.filter((l) => {
      if (filterStage !== 'all' && l.stage !== filterStage) return false;
      if (filterSource !== 'all' && l.source_type !== filterSource) return false;
      if (filterEmailStatus !== 'all' && l.email_status !== filterEmailStatus) return false;
      if (filterService !== 'all' && l.recommended_service !== filterService) return false;
      if (filterMinFit > 0 && (l.fit_score || 0) < filterMinFit) return false;
      if (
        filterTech !== 'all' &&
        !(l.tech_stack || []).some((t) => t.toLowerCase() === filterTech.toLowerCase())
      ) {
        return false;
      }
      if (q) {
        const hay = [
          l.contact_name,
          l.role_title,
          l.company_name,
          l.company_domain,
          l.email,
          l.recommended_service,
          ...(l.tech_stack || [])
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...rows].sort((a, b) => {
      if (sortBy === 'fit_desc') return (b.fit_score || 0) - (a.fit_score || 0);
      if (sortBy === 'value_desc') return (b.deal_value || 0) - (a.deal_value || 0);
      if (sortBy === 'company_asc') return a.company_name.localeCompare(b.company_name);
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [
    leads,
    dirSearch,
    filterStage,
    filterSource,
    filterEmailStatus,
    filterService,
    filterTech,
    filterMinFit,
    sortBy
  ]);

  const hasActiveFilters =
    Boolean(dirSearch.trim()) ||
    filterStage !== 'all' ||
    filterSource !== 'all' ||
    filterEmailStatus !== 'all' ||
    filterService !== 'all' ||
    filterTech !== 'all' ||
    filterMinFit > 0;

  const resetAllFilters = () => {
    setDirSearch('');
    setFilterStage('all');
    setFilterSource('all');
    setFilterEmailStatus('all');
    setFilterService('all');
    setFilterTech('all');
    setFilterMinFit(0);
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    const filteredIds = filteredLeads.map((l) => l.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIds));
    }
  };

  const handleBulkAction = async (action: 'research' | 'move_stage' | 'delete') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy(true);
    setNotice(null);
    try {
      const res = await api.bulkCrmAction({
        action,
        leadIds: ids,
        ...(action === 'move_stage' ? { stage: bulkStageTarget } : {})
      });
      setLeads(res.leads);
      if (action === 'delete') setSelectedIds(new Set());
      setNotice({
        type: 'ok',
        text:
          action === 'research'
            ? `Agent researched and drafted proposals for ${res.processedCount} selected lead(s).`
            : action === 'move_stage'
              ? `Moved ${res.processedCount} lead(s) to ${
                  ALL_STAGES.find((s) => s.id === bulkStageTarget)?.label || bulkStageTarget
                }.`
              : `Removed ${res.processedCount} lead(s) from database.`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Bulk action failed.'
      });
    } finally {
      setBulkBusy(false);
    }
  };

  const handleExportLeadsCsv = (onlySelected = false) => {
    const targetRows =
      onlySelected && selectedIds.size > 0
        ? filteredLeads.filter((l) => selectedIds.has(l.id))
        : filteredLeads;
    const header =
      'Contact Name,Role,Company,Domain,Email,Email Status,Stage,Service Fit,Fit Score,Deal Value,Tech Stack,Website,GitHub\n';
    const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const body = targetRows
      .map((l) =>
        [
          esc(l.contact_name),
          esc(l.role_title),
          esc(l.company_name),
          esc(l.company_domain),
          esc(l.email),
          esc(l.email_status),
          esc(l.stage),
          esc(l.recommended_service),
          l.fit_score,
          l.deal_value,
          esc((l.tech_stack || []).join('; ')),
          esc(l.website_url),
          esc(l.github_url)
        ].join(',')
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gitstack-opensource-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-semibold text-slate-500">Active Pipeline Value</div>
          <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            ${kpis.totalValue.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
            {kpis.activeCount} active prospect{kpis.activeCount === 1 ? '' : 's'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-semibold text-slate-500">Proposals &amp; Sequences</div>
          <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {kpis.proposedCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
            {logs.filter((l) => l.status === 'sent').length} emails delivered
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-semibold text-slate-500">Won Client Revenue</div>
          <div className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            ${kpis.wonValue.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
            {kpis.wonCount} closed client{kpis.wonCount === 1 ? '' : 's'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-semibold text-slate-500">Outreach Channels</div>
          <div className="mt-1 text-sm font-bold text-slate-900 truncate">
            {larkStatus?.connected
              ? 'Lark Mail Ready'
              : gmailEmail
                ? 'Gmail Ready'
                : 'Connect Mail'}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">
            {larkStatus?.connected
              ? larkStatus.lark_email || larkStatus.lark_name
              : gmailEmail || 'Approve-to-send modal active'}
          </div>
        </div>
      </div>

      {/* Mail Channels Bar (Lark SMTP SSL + Gmail Fallback) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Mail className="h-4 w-4 text-[var(--gs-primary)] shrink-0" />
              <h2 className="font-display text-sm font-bold text-slate-900">
                Lark Mail SMTP SSL &amp; Gmail Outreach
              </h2>
              <span className="text-xs text-slate-400">·</span>
              {larkStatus?.connected ? (
                <span className="text-xs font-semibold text-emerald-700">
                  SMTP Connected ({larkStatus.lark_email || larkStatus.lark_name} ·{' '}
                  <span className="font-mono">
                    {larkStatus.smtp_host || 'smtp.larksuite.com'}:{larkStatus.smtp_port || 465}
                  </span>
                  )
                </span>
              ) : (
                <span className="text-xs font-medium text-amber-700">
                  Not Configured — Set Lark Email &amp; Authorization Code in Settings
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Every proposal and follow-up pauses at an Approve &amp; Send modal before dispatching
              via encrypted Lark SMTP SSL (port 465) or Gmail OAuth.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {larkStatus?.connected && (
              <button
                type="button"
                disabled={larkBusy}
                onClick={handleDisconnectLark}
                className="min-h-[42px] whitespace-nowrap shrink-0 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {larkBusy ? 'Disconnecting...' : 'Disconnect Lark'}
              </button>
            )}

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className={`min-h-[42px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold ${
                  larkStatus?.connected
                    ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    : 'bg-[var(--gs-primary)] text-white hover:bg-[var(--gs-primary-hover)]'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>
                  {larkStatus?.connected ? 'Manage Integrations' : 'Configure Lark SMTP'}
                </span>
              </button>
            )}

            <button
              type="button"
              disabled={gmailBusy}
              onClick={handleConnectGmail}
              className="min-h-[42px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>{gmailEmail ? `Gmail: ${gmailEmail}` : gmailBusy ? 'Connecting...' : 'Connect Gmail'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Open-Source Multi-Repo Database Sync Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Database className="h-4 w-4 text-[var(--gs-primary)] shrink-0" />
              <h2 className="font-display text-sm font-bold text-slate-900">
                Open-Source Repository Lead Database Sync
              </h2>
              <span className="text-xs text-slate-400">·</span>
              <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                {leads.length} loaded lead{leads.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Pull maintainers, company domains, and MX-verified contacts from trending AI, Cloud,
              and DevTools GitHub repositories directly into Supabase with automatic signal merging.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              aria-label="Trending open-source ecosystem track"
              value={syncTrack}
              onChange={(e) => setSyncTrack(e.target.value as OpenSourceSyncTrack)}
              className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-[var(--gs-primary)] focus:outline-none"
            >
              <option value="all">All Trending (AI + Cloud + DevTools)</option>
              <option value="ai">Trending AI &amp; LLM Repos</option>
              <option value="cloud">Trending Cloud &amp; Infra Repos</option>
              <option value="devtools">Trending DevTools &amp; SaaS Repos</option>
            </select>
            <button
              type="button"
              disabled={syncingDb}
              onClick={() => handleSyncOpenSource()}
              className="min-h-[42px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncingDb ? 'animate-spin' : ''}`} />
              <span>{syncingDb ? 'Syncing Repos...' : 'Sync Open-Source Leads'}</span>
            </button>
          </div>
        </div>

        {lastSyncInfo && (
          <div className="border-t border-slate-200 pt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
            <span className="font-semibold text-slate-800">Last Sync:</span>
            <span className="font-mono tabular-nums">{lastSyncInfo.reposScanned} repos scanned</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-emerald-700 font-semibold tabular-nums">
              +{lastSyncInfo.insertedCount} inserted
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{lastSyncInfo.mergedCount} merged</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{lastSyncInfo.mxVerifiedCount} MX verified</span>
            {lastSyncInfo.sourcesSynced.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{lastSyncInfo.sourcesSynced.join(', ')}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Inline Feedback Notice */}
      {notice && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
            notice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss CRM notification"
            className="p-1 opacity-70 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Sub-view Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setSubView('directory')}
            className={`min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              subView === 'directory'
                ? 'bg-[var(--gs-primary)] text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>
              Lead Database ({filteredLeads.length}
              {hasActiveFilters ? `/${leads.length}` : ''})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSubView('pipeline')}
            className={`min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              subView === 'pipeline'
                ? 'bg-[var(--gs-primary)] text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span>CRM Kanban ({leads.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubView('discover')}
            className={`min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              subView === 'discover'
                ? 'bg-[var(--gs-primary)] text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            <span>Apollo &amp; Data Connectors</span>
          </button>
          <button
            type="button"
            onClick={() => setSubView('maps')}
            className={`min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              subView === 'maps'
                ? 'bg-[var(--gs-primary)] text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>Map Finder</span>
          </button>
          <button
            type="button"
            onClick={() => setSubView('sources')}
            className={`min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              subView === 'sources'
                ? 'bg-[var(--gs-primary)] text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Sources &amp; Provenance</span>
          </button>
          <button
            type="button"
            onClick={() => setSubView('logs')}
            className={`min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              subView === 'logs'
                ? 'bg-[var(--gs-primary)] text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            <span>Outreach Logs ({logs.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {subView === 'pipeline' && (
            <button
              type="button"
              onClick={() => setShowLostColumn((p) => !p)}
              className="min-h-[40px] whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {showLostColumn ? 'Hide Lost Column' : 'Show Lost'}
            </button>
          )}
          <button
            type="button"
            onClick={() => handleExportLeadsCsv(false)}
            disabled={filteredLeads.length === 0}
            className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Prospect</span>
          </button>
          <button
            type="button"
            onClick={loadCrmData}
            disabled={loading}
            className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* VIEW 0: APOLLO-STYLE FILTERABLE LEAD DATABASE DIRECTORY */}
      {subView === 'directory' && (
        <div className="space-y-4">
          {/* Multi-Facet Filter Bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={dirSearch}
                  onChange={(e) => setDirSearch(e.target.value)}
                  placeholder="Filter leads by contact, role, company, email, domain, or tech stack..."
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3.5 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <select
                  aria-label="Sort lead directory"
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(
                      e.target.value as 'updated_desc' | 'fit_desc' | 'value_desc' | 'company_asc'
                    )
                  }
                  className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-[var(--gs-primary)] focus:outline-none"
                >
                  <option value="fit_desc">Sort: Highest Fit Score</option>
                  <option value="value_desc">Sort: Highest Deal Value</option>
                  <option value="updated_desc">Sort: Recently Synced</option>
                  <option value="company_asc">Sort: Company A–Z</option>
                </select>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="min-h-[42px] whitespace-nowrap shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              <select
                aria-label="Filter by CRM stage"
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value as 'all' | CrmLeadStage)}
                className="min-h-[38px] rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 text-xs text-slate-800 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
              >
                <option value="all">Stage: All</option>
                {ALL_STAGES.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by data source"
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value as 'all' | LeadSourceType)}
                className="min-h-[38px] rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 text-xs text-slate-800 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
              >
                <option value="all">Source: All</option>
                <option value="github">GitHub Repo</option>
                <option value="apollo">Apollo.io API</option>
                <option value="google_maps">Google Maps</option>
                <option value="hacker_news">Hacker News</option>
                <option value="ycombinator">Y Combinator</option>
                <option value="website">Company Website</option>
                <option value="gemini_search">Gemini Search</option>
                <option value="csv_import">CSV Import</option>
                <option value="manual">Manual Entry</option>
              </select>

              <select
                aria-label="Filter by email verification"
                value={filterEmailStatus}
                onChange={(e) =>
                  setFilterEmailStatus(e.target.value as 'all' | EmailVerificationStatus)
                }
                className="min-h-[38px] rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 text-xs text-slate-800 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
              >
                <option value="all">Email: All</option>
                <option value="verified_mx">MX Verified</option>
                <option value="public_found">Public Found</option>
                <option value="inferred">Domain Inferred</option>
                <option value="invalid">Unverified</option>
              </select>

              <select
                aria-label="Filter by recommended service"
                value={filterService}
                onChange={(e) => setFilterService(e.target.value as 'all' | ServiceCategory)}
                className="min-h-[38px] rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 text-xs text-slate-800 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
              >
                <option value="all">Service: All</option>
                {SERVICES.map((svc) => (
                  <option key={svc} value={svc}>
                    {svc}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by tech stack"
                value={filterTech}
                onChange={(e) => setFilterTech(e.target.value)}
                className="min-h-[38px] rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 text-xs text-slate-800 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
              >
                <option value="all">Stack: All ({availableTechTags.length})</option>
                {availableTechTags.map((item) => (
                  <option key={item.tag} value={item.tag}>
                    {item.tag} ({item.count})
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by minimum fit score"
                value={filterMinFit}
                onChange={(e) => setFilterMinFit(Number(e.target.value))}
                className="min-h-[38px] rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 text-xs text-slate-800 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
              >
                <option value={0}>Fit Score: Any</option>
                <option value={70}>Fit ≥ 70%</option>
                <option value={80}>Fit ≥ 80%</option>
                <option value={90}>Fit ≥ 90%</option>
              </select>
            </div>
          </div>

          {/* Bulk Selection Toolbar */}
          {selectedIds.size > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold text-slate-900 tabular-nums">
                {selectedIds.size} lead{selectedIds.size === 1 ? '' : 's'} selected
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => handleBulkAction('research')}
                  className="min-h-[38px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{bulkBusy ? 'Working...' : 'Bulk AI Research'}</span>
                </button>
                <div className="inline-flex items-center gap-1">
                  <select
                    aria-label="Bulk target CRM stage"
                    value={bulkStageTarget}
                    onChange={(e) => setBulkStageTarget(e.target.value as CrmLeadStage)}
                    className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800"
                  >
                    {ALL_STAGES.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => handleBulkAction('move_stage')}
                    className="min-h-[38px] whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Move Stage
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleExportLeadsCsv(true)}
                  className="min-h-[38px] whitespace-nowrap shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export Selected</span>
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => handleBulkAction('delete')}
                  className="min-h-[38px] whitespace-nowrap shrink-0 inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="min-h-[38px] px-2 text-xs font-medium text-slate-500 hover:text-slate-900"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* High-Density Apollo-Style Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {loading || (syncingDb && leads.length === 0) ? (
              <div className="divide-y divide-slate-100">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="px-4 py-3.5 flex items-center gap-4 animate-pulse">
                    <div className="h-4 w-4 rounded bg-slate-200" />
                    <div className="h-3.5 w-40 rounded bg-slate-200" />
                    <div className="h-3.5 w-32 rounded bg-slate-100" />
                    <div className="h-3.5 w-48 rounded bg-slate-100 flex-1" />
                    <div className="h-3.5 w-20 rounded bg-slate-200" />
                  </div>
                ))}
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="font-display text-sm font-bold text-slate-900">
                  {leads.length === 0
                    ? 'No leads loaded in your database yet'
                    : 'No leads match your active filters'}
                </div>
                <p className="mx-auto max-w-md text-xs text-slate-600">
                  {leads.length === 0
                    ? 'Sync trending AI, Cloud, and DevTools open-source repositories to populate your lead database right away.'
                    : 'Adjust your search terms or clear one of the active stage, verification, or tech stack filters.'}
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  {leads.length === 0 ? (
                    <button
                      type="button"
                      disabled={syncingDb}
                      onClick={() => handleSyncOpenSource('all')}
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${syncingDb ? 'animate-spin' : ''}`} />
                      <span>Sync Trending Repos Now</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="min-h-[40px] rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                    >
                      Reset All Filters
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-10 px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label="Select all filtered leads"
                          checked={
                            filteredLeads.length > 0 &&
                            filteredLeads.every((l) => selectedIds.has(l.id))
                          }
                          onChange={toggleSelectAllFiltered}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </th>
                      <th className="px-3 py-3">Contact &amp; Role</th>
                      <th className="px-3 py-3">Company &amp; Open Sources</th>
                      <th className="px-3 py-3">Email &amp; Status</th>
                      <th className="px-3 py-3">Stack &amp; Service Fit</th>
                      <th className="px-3 py-3 text-right">Fit / Value</th>
                      <th className="px-3 py-3">Stage</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredLeads.map((lead) => {
                      const emailMeta = EMAIL_STATUS_LABEL[lead.email_status];
                      const isChecked = selectedIds.has(lead.id);
                      return (
                        <tr
                          key={lead.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isChecked ? 'bg-slate-50' : ''
                          }`}
                        >
                          <td className="px-3 py-2.5 align-top">
                            <input
                              type="checkbox"
                              aria-label={`Select ${lead.company_name}`}
                              checked={isChecked}
                              onChange={() => toggleSelectRow(lead.id)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300"
                            />
                          </td>
                          <td className="px-3 py-2.5 align-top max-w-[210px]">
                            <button
                              type="button"
                              onClick={() => openLeadDossier(lead)}
                              className="font-semibold text-slate-900 hover:text-[var(--gs-primary)] text-left block truncate w-full"
                            >
                              {lead.contact_name}
                            </button>
                            <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                              {lead.role_title || 'Engineering Contact'}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 align-top max-w-[220px]">
                            <div className="font-semibold text-slate-900 truncate">
                              {lead.company_name}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                              <span className="capitalize">{lead.source_type.replace('_', ' ')}</span>
                              {lead.website_url && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <a
                                    href={lead.website_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-0.5 text-[var(--gs-primary)] hover:underline"
                                  >
                                    <span>Web</span>
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                </>
                              )}
                              {lead.github_url && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <a
                                    href={lead.github_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-0.5 text-[var(--gs-primary)] hover:underline"
                                  >
                                    <span>GitHub</span>
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 align-top max-w-[220px]">
                            <div className="font-mono text-[11px] text-slate-800 truncate">
                              {lead.email || '—'}
                            </div>
                            <div className={`mt-0.5 text-[11px] font-semibold ${emailMeta.tone}`}>
                              {emailMeta.text}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 align-top max-w-[220px]">
                            <div className="font-medium text-slate-800 truncate">
                              {lead.recommended_service}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                              {lead.tech_stack.length > 0
                                ? lead.tech_stack.slice(0, 4).join(' · ')
                                : 'General Cloud / Web'}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 align-top text-right whitespace-nowrap">
                            <div className="font-mono font-bold text-slate-900 tabular-nums">
                              {lead.fit_score}%
                            </div>
                            <div className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums">
                              ${lead.deal_value.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 align-top whitespace-nowrap">
                            <select
                              aria-label={`Stage for ${lead.company_name}`}
                              value={lead.stage}
                              onChange={(e) =>
                                handleMoveStage(lead, e.target.value as CrmLeadStage)
                              }
                              className="min-h-[34px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-800 focus:border-[var(--gs-primary)] focus:outline-none"
                            >
                              {ALL_STAGES.map((st) => (
                                <option key={st.id} value={st.id}>
                                  {st.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2.5 align-top text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {lead.proposal_body ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openApproveToSend(
                                      lead,
                                      lead.proposal_subject,
                                      lead.proposal_body
                                    )
                                  }
                                  className="min-h-[34px] whitespace-nowrap shrink-0 inline-flex items-center gap-1 rounded-lg bg-[var(--gs-primary)] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                                >
                                  <Send className="h-3 w-3" />
                                  <span>Send</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={researchingId === lead.id}
                                  onClick={() => handleRunAgentResearch(lead.id)}
                                  className="min-h-[34px] whitespace-nowrap shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-[var(--gs-primary)] hover:bg-slate-100 disabled:opacity-50"
                                >
                                  <Sparkles className="h-3 w-3" />
                                  <span>
                                    {researchingId === lead.id ? 'Drafting...' : 'AI Draft'}
                                  </span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openLeadDossier(lead)}
                                className="min-h-[34px] whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Dossier
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 1: KANBAN CRM PIPELINE */}
      {subView === 'pipeline' && (
        <div className="overflow-x-auto pb-2">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
              Loading CRM pipeline...
            </div>
          ) : leads.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-3">
              <div className="font-display text-base font-bold text-slate-900">
                Your CRM pipeline is ready for open-source leads
              </div>
              <p className="mx-auto max-w-lg text-xs text-slate-600">
                Use the Open-Source Lead Finder to discover GitHub maintainers, company domains, and
                MX-verified emails, or add a prospect manually so the Proposal Agent can research
                and draft tailored outreach.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSubView('discover')}
                  className="min-h-[42px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Open Lead Finder</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="min-h-[42px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Add Manual Prospect</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              className="grid gap-4 min-w-[980px]"
              style={{
                gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(210px, 1fr))`
              }}
            >
              {visibleColumns.map((col) => {
                const colLeads = leads.filter((l) => l.stage === col.id);
                const colValue = colLeads.reduce((acc, l) => acc + (Number(l.deal_value) || 0), 0);
                return (
                  <div
                    key={col.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex flex-col gap-3 min-h-[420px]"
                  >
                    <div className="border-b border-slate-200 pb-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-xs font-bold uppercase tracking-wider text-slate-900">
                          {col.label}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-600 tabular-nums">
                          {colLeads.length}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate">{col.hint}</span>
                        <span className="font-mono tabular-nums shrink-0">
                          ${colValue.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2.5 flex-1">
                      {colLeads.length === 0 ? (
                        <div className="py-8 text-center text-[11px] text-slate-400">
                          No leads in {col.label}
                        </div>
                      ) : (
                        colLeads.map((lead) => {
                          const emailMeta = EMAIL_STATUS_LABEL[lead.email_status];
                          return (
                            <div
                              key={lead.id}
                              className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5 hover:border-slate-300 transition-colors"
                            >
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => openLeadDossier(lead)}
                                  className="text-left font-display text-xs font-bold text-slate-900 hover:text-[var(--gs-primary)] block truncate w-full"
                                >
                                  {lead.company_name}
                                </button>
                                <div className="mt-0.5 text-[11px] text-slate-600 truncate">
                                  {lead.contact_name}
                                  {lead.role_title ? ` · ${lead.role_title}` : ''}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500">
                                <span className="font-mono font-semibold text-slate-800 tabular-nums">
                                  Fit {lead.fit_score}%
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  ${lead.deal_value.toLocaleString()}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className={`font-medium ${emailMeta.tone}`}>
                                  {emailMeta.text}
                                </span>
                              </div>

                              {lead.email && (
                                <div className="font-mono text-[11px] text-slate-600 truncate">
                                  {lead.email}
                                </div>
                              )}

                              {lead.tech_stack.length > 0 && (
                                <div className="text-[11px] text-slate-500 truncate">
                                  {lead.tech_stack.slice(0, 3).join(' · ')}
                                </div>
                              )}

                              <div className="border-t border-slate-100 pt-2 flex flex-wrap items-center justify-between gap-1.5">
                                {lead.stage === 'discovered' ? (
                                  <button
                                    type="button"
                                    disabled={researchingId === lead.id}
                                    onClick={() => handleRunAgentResearch(lead.id)}
                                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-[var(--gs-primary)] hover:bg-slate-100 disabled:opacity-50"
                                  >
                                    <Sparkles className="h-3 w-3" />
                                    <span>
                                      {researchingId === lead.id ? 'Researching...' : 'AI Research'}
                                    </span>
                                  </button>
                                ) : lead.stage === 'researched' && lead.proposal_body ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openApproveToSend(
                                        lead,
                                        lead.proposal_subject,
                                        lead.proposal_body
                                      )
                                    }
                                    className="inline-flex items-center gap-1 rounded bg-[var(--gs-primary)] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                                  >
                                    <Send className="h-3 w-3" />
                                    <span>Send Proposal</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openLeadDossier(lead)}
                                    className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    <span>Open Dossier</span>
                                  </button>
                                )}

                                <select
                                  aria-label={`Move ${lead.company_name} stage`}
                                  value={lead.stage}
                                  onChange={(e) =>
                                    handleMoveStage(lead, e.target.value as CrmLeadStage)
                                  }
                                  className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 focus:border-[var(--gs-primary)] focus:outline-none"
                                >
                                  {ALL_STAGES.map((st) => (
                                    <option key={st.id} value={st.id}>
                                      {st.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: MULTI-SOURCE CONNECTORS + OPEN-SOURCE LEAD FINDER */}
      {subView === 'discover' && (
        <div className="space-y-5">
          <MultiSourceImportPanel
            onLeadsUpdated={(updatedLeads, text) => {
              setLeads(updatedLeads);
              setNotice({ type: 'ok', text });
            }}
            onError={(msg) => setNotice({ type: 'err', text: msg })}
            onOpenSettings={onOpenSettings}
          />

          <form
            onSubmit={handleDiscover}
            className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4"
          >
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900">
                Custom Open-Source Repo &amp; Domain Scraper
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Search any company domain (e.g. <span className="font-mono">supabase.com</span>,{' '}
                <span className="font-mono">vercel.com</span>) or GitHub engineering topic (e.g.{' '}
                <span className="font-mono">langchain</span>, <span className="font-mono">kubernetes</span>)
                to extract public contacts, verify DNS MX records, and detect technical stacks.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter domain (e.g. posthog.com) or topic/repo (e.g. rag-pipeline)"
                  className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3.5 py-2 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                />
              </div>
              <select
                aria-label="Discovery data source mode"
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value as 'auto' | 'github' | 'website')}
                className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-[var(--gs-primary)] focus:outline-none"
              >
                <option value="auto">All Sources (GitHub + Web + Gemini)</option>
                <option value="github">GitHub Orgs &amp; Maintainers</option>
                <option value="website">Company Website &amp; MX Scrape</option>
              </select>
              <button
                type="submit"
                disabled={searching || !searchQuery.trim()}
                className="min-h-[44px] whitespace-nowrap shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-5 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
              >
                <Search className="h-3.5 w-3.5" />
                <span>{searching ? 'Scanning Open Sources...' : 'Discover Leads'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span>Quick queries:</span>
              {['supabase.com', 'vercel', 'langchain', 'posthog.com'].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setSearchQuery(sample)}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-slate-700 hover:bg-slate-100"
                >
                  {sample}
                </button>
              ))}
            </div>
          </form>

          {sourcesChecked.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-800">Sources Checked:</span>
              {sourcesChecked.map((src) => (
                <a
                  key={src}
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--gs-primary)] hover:underline"
                >
                  <span className="truncate max-w-[240px]">{src}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ))}
            </div>
          )}

          {candidates.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200">
              {candidates.map((cand) => {
                const emailMeta = EMAIL_STATUS_LABEL[cand.email_status];
                const alreadyImported =
                  (cand.email && importedKeys.has(cand.email.toLowerCase())) ||
                  (cand.company_domain && importedKeys.has(cand.company_domain.toLowerCase()));
                return (
                  <div
                    key={cand.id}
                    className="p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-bold text-slate-900">
                          {cand.contact_name}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-medium text-slate-700">
                          {cand.role_title}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-semibold text-slate-900">
                          {cand.company_name}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="font-mono text-slate-800">
                          {cand.email || 'No public email listed'}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className={`font-semibold ${emailMeta.tone}`}>{emailMeta.text}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono text-slate-600 tabular-nums">
                          Fit {cand.fit_score}%
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500 capitalize">
                          Source: {cand.source_type.replace('_', ' ')}
                        </span>
                      </div>

                      {cand.snippet && (
                        <p className="text-xs text-slate-600 line-clamp-2">{cand.snippet}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] text-slate-500">
                        {cand.tech_stack.length > 0 && (
                          <span>Stack: {cand.tech_stack.join(', ')}</span>
                        )}
                        {cand.website_url && (
                          <a
                            href={cand.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[var(--gs-primary)] hover:underline"
                          >
                            <Globe className="h-3 w-3" />
                            <span>Website</span>
                          </a>
                        )}
                        {cand.github_url && (
                          <a
                            href={cand.github_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[var(--gs-primary)] hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>GitHub</span>
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {alreadyImported ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 px-3 py-2">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>In Pipeline</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={importingId === cand.id}
                          onClick={() => handleImportCandidate(cand)}
                          className="min-h-[42px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>{importingId === cand.id ? 'Importing...' : 'Import to CRM'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2B: GOOGLE MAPS ESTABLISHMENT FINDER */}
      {subView === 'maps' && (
        <GoogleMapsProspectingTab
          existingDomains={importedKeys}
          onLeadsUpdated={(updatedLeads, text) => {
            setLeads(updatedLeads);
            setNotice({ type: 'ok', text });
          }}
          onOpenLead={(lead) => openLeadDossier(lead)}
          onError={(msg) => setNotice({ type: 'err', text: msg })}
          onOpenSettings={onOpenSettings}
        />
      )}

      {/* VIEW 2C: SOURCE ATTRIBUTION & PROVENANCE DASHBOARD */}
      {subView === 'sources' && (
        <SourcesAttributionTab
          leads={leads}
          onFilterBySource={(source) => {
            setFilterSource(source);
            setSubView('directory');
          }}
          onOpenLead={(lead) => openLeadDossier(lead)}
        />
      )}

      {/* VIEW 3: OUTREACH ACTIVITY LOGS */}
      {subView === 'logs' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900">
                Dispatched Proposals &amp; Follow-Up Audit Trail
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Verified provider message IDs recorded from Lark Mail and Gmail OAuth deliveries.
              </p>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {logs.length} total
            </span>
          </div>

          {logs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No proposals have been sent yet. Research a lead in the CRM Kanban and confirm an
              outreach send to record proof here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Recipient</th>
                    <th className="px-4 py-3">Subject &amp; Step</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Provider Message ID</th>
                    <th className="px-4 py-3">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono text-slate-800">{log.recipient_email}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 max-w-xs truncate">
                          {log.subject}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {log.step_label} · by {log.sent_by}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {log.channel === 'lark_mail' ? 'Lark Mail' : 'Gmail API'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-semibold ${
                            log.status === 'sent' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {log.status === 'sent' ? 'Sent' : 'Failed'}
                        </span>
                        {log.error_detail && (
                          <div className="text-[11px] text-red-600 max-w-[200px] truncate">
                            {log.error_detail}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600 max-w-[160px] truncate">
                        {log.provider_message_id || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                        {new Date(log.sent_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MANUAL PROSPECT MODAL */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Add Manual CRM Prospect"
        >
          <form
            onSubmit={handleCreateManualLead}
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display text-base font-bold text-slate-900">
                Add Prospect to CRM
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                aria-label="Close Add Prospect Modal"
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Contact Name *</label>
                <input
                  type="text"
                  required
                  value={manualForm.contact_name}
                  onChange={(e) => setManualForm((p) => ({ ...p, contact_name: e.target.value }))}
                  placeholder="Alex Rivera"
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Company Name *</label>
                <input
                  type="text"
                  required
                  value={manualForm.company_name}
                  onChange={(e) => setManualForm((p) => ({ ...p, company_name: e.target.value }))}
                  placeholder="Acme Cloud Inc."
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Work Email</label>
                <input
                  type="email"
                  value={manualForm.email}
                  onChange={(e) => setManualForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="alex@acme.io"
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Role / Title</label>
                <input
                  type="text"
                  value={manualForm.role_title}
                  onChange={(e) => setManualForm((p) => ({ ...p, role_title: e.target.value }))}
                  placeholder="VP of Engineering"
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Website URL</label>
                <input
                  type="text"
                  value={manualForm.website_url}
                  onChange={(e) => setManualForm((p) => ({ ...p, website_url: e.target.value }))}
                  placeholder="https://acme.io"
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">GitHub URL</label>
                <input
                  type="text"
                  value={manualForm.github_url}
                  onChange={(e) => setManualForm((p) => ({ ...p, github_url: e.target.value }))}
                  placeholder="https://github.com/acme"
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Service Fit</label>
                <select
                  value={manualForm.recommended_service}
                  onChange={(e) =>
                    setManualForm((p) => ({
                      ...p,
                      recommended_service: e.target.value as ServiceCategory
                    }))
                  }
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                >
                  {SERVICES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Est. Deal Value ($)</label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={manualForm.deal_value}
                  onChange={(e) =>
                    setManualForm((p) => ({ ...p, deal_value: Number(e.target.value) || 25000 }))
                  }
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="min-h-[42px] rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingManual}
                className="min-h-[42px] rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
              >
                {savingManual ? 'Saving...' : 'Save Prospect'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LEAD DOSSIER, AI RESEARCH & PROPOSAL EDITOR MODAL */}
      {selectedLead && draftEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Lead Dossier: ${selectedLead.company_name}`}
        >
          <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-[var(--gs-primary)]">Lead Dossier</span>
                  <span>·</span>
                  <span className={EMAIL_STATUS_LABEL[draftEdit.email_status].tone}>
                    {EMAIL_STATUS_LABEL[draftEdit.email_status].text}
                  </span>
                  <span>·</span>
                  <span className="font-mono tabular-nums">Fit {draftEdit.fit_score}%</span>
                </div>
                <h3 className="mt-0.5 font-display text-lg font-bold text-slate-900 truncate">
                  {draftEdit.company_name} — {draftEdit.contact_name}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={researchingId === draftEdit.id}
                  onClick={() => handleRunAgentResearch(draftEdit.id)}
                  className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span>
                    {researchingId === draftEdit.id
                      ? 'Agent Researching...'
                      : 'Run Agent Research & Draft Proposal'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLead(null);
                    setDraftEdit(null);
                  }}
                  aria-label="Close Lead Dossier"
                  className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Contact & Stage Grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={draftEdit.contact_name}
                    onChange={(e) =>
                      setDraftEdit((d) => (d ? { ...d, contact_name: e.target.value } : d))
                    }
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={draftEdit.email}
                    onChange={(e) =>
                      setDraftEdit((d) => (d ? { ...d, email: e.target.value } : d))
                    }
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Pipeline Stage
                  </label>
                  <select
                    value={draftEdit.stage}
                    onChange={(e) =>
                      setDraftEdit((d) =>
                        d ? { ...d, stage: e.target.value as CrmLeadStage } : d
                      )
                    }
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                  >
                    {ALL_STAGES.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Recommended Service
                  </label>
                  <select
                    value={draftEdit.recommended_service}
                    onChange={(e) =>
                      setDraftEdit((d) =>
                        d
                          ? { ...d, recommended_service: e.target.value as ServiceCategory }
                          : d
                      )
                    }
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                  >
                    {SERVICES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Deal Value ($)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={draftEdit.deal_value}
                    onChange={(e) =>
                      setDraftEdit((d) =>
                        d ? { ...d, deal_value: Number(e.target.value) || 0 } : d
                      )
                    }
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Website / Domain
                  </label>
                  <input
                    type="text"
                    value={draftEdit.website_url}
                    onChange={(e) =>
                      setDraftEdit((d) => (d ? { ...d, website_url: e.target.value } : d))
                    }
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Tech Stack & Source Links */}
              {(draftEdit.tech_stack.length > 0 || draftEdit.source_urls.length > 0) && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs space-y-1.5">
                  {draftEdit.tech_stack.length > 0 && (
                    <div>
                      <span className="font-semibold text-slate-700">Detected Stack: </span>
                      <span className="text-slate-600">{draftEdit.tech_stack.join(' · ')}</span>
                    </div>
                  )}
                  {draftEdit.source_urls.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-700">Open Sources:</span>
                      {draftEdit.source_urls.map((u) => (
                        <a
                          key={u}
                          href={u}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--gs-primary)] hover:underline"
                        >
                          <span className="truncate max-w-[220px]">{u}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Agent Research Brief */}
              <div>
                <label className="block text-xs font-bold text-slate-800">
                  Agent Research Brief
                </label>
                <textarea
                  rows={4}
                  value={draftEdit.research_brief}
                  onChange={(e) =>
                    setDraftEdit((d) => (d ? { ...d, research_brief: e.target.value } : d))
                  }
                  placeholder="Click 'Run Agent Research & Draft Proposal' above to synthesize open-source tech signals and pain points."
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs leading-relaxed text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>

              {/* Initial Proposal Draft */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Initial Personalized Proposal Email
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Review and refine before opening the Approve &amp; Send modal.
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!draftEdit.proposal_subject || !draftEdit.proposal_body}
                    onClick={() =>
                      openApproveToSend(
                        draftEdit,
                        draftEdit.proposal_subject,
                        draftEdit.proposal_body
                      )
                    }
                    className="min-h-[40px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Review &amp; Send Proposal</span>
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Subject</label>
                  <input
                    type="text"
                    value={draftEdit.proposal_subject}
                    onChange={(e) =>
                      setDraftEdit((d) => (d ? { ...d, proposal_subject: e.target.value } : d))
                    }
                    placeholder="Proposal subject line"
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Proposal Body
                  </label>
                  <textarea
                    rows={7}
                    value={draftEdit.proposal_body}
                    onChange={(e) =>
                      setDraftEdit((d) => (d ? { ...d, proposal_body: e.target.value } : d))
                    }
                    placeholder="Tailored executive proposal draft..."
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs leading-relaxed text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                  />
                </div>
              </div>

              {/* 3-Step Follow-Up Sequence */}
              {draftEdit.follow_up_sequence.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-900">
                    3-Step Follow-Up Cadence (Human-Approved Send)
                  </div>
                  <div className="space-y-3">
                    {draftEdit.follow_up_sequence.map((step: CrmFollowUpStep, idx: number) => (
                      <div
                        key={step.step_number}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-bold text-slate-800">
                            Step {step.step_number} · Day +{step.delay_days}
                            {step.sent_at && (
                              <span className="ml-2 font-normal text-emerald-700">
                                · Sent {new Date(step.sent_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              openApproveToSend(draftEdit, step.subject, step.body, step.step_number)
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-100"
                          >
                            <Send className="h-3 w-3" />
                            <span>
                              {step.sent_at ? 'Resend Follow-Up' : `Review & Send Step ${step.step_number}`}
                            </span>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={step.subject}
                          onChange={(e) =>
                            setDraftEdit((d) => {
                              if (!d) return d;
                              const next = [...d.follow_up_sequence];
                              next[idx] = { ...next[idx], subject: e.target.value };
                              return { ...d, follow_up_sequence: next };
                            })
                          }
                          className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                        />
                        <textarea
                          rows={3}
                          value={step.body}
                          onChange={(e) =>
                            setDraftEdit((d) => {
                              if (!d) return d;
                              const next = [...d.follow_up_sequence];
                              next[idx] = { ...next[idx], body: e.target.value };
                              return { ...d, follow_up_sequence: next };
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[var(--gs-primary)] focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3.5 bg-slate-50 rounded-b-xl">
              <button
                type="button"
                onClick={() => handleDeleteLead(draftEdit.id)}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Lead</span>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {draftEdit.stage !== 'won' && (
                  <button
                    type="button"
                    disabled={convertingId === draftEdit.id}
                    onClick={() => handleConvertToWon(draftEdit.id)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>
                      {convertingId === draftEdit.id
                        ? 'Converting...'
                        : 'Convert to Client (Won)'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={savingLead}
                  onClick={handleSaveDossier}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                >
                  <span>{savingLead ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* APPROVE-TO-SEND HUMAN-IN-THE-LOOP MODAL */}
      {sendModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Approve and Send Proposal Email"
        >
          <form
            onSubmit={handleConfirmSendEmail}
            className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--gs-primary)]">
                  Human Approval Required Before Send
                </div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  {sendModal.step_number
                    ? `Approve Follow-Up Step ${sendModal.step_number}`
                    : 'Approve & Dispatch Proposal'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSendModal(null)}
                aria-label="Cancel Email Send"
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Outbound Mail Channel
                </label>
                <select
                  value={sendModal.channel}
                  onChange={(e) =>
                    setSendModal((m) =>
                      m ? { ...m, channel: e.target.value as 'lark_mail' | 'gmail_api' } : m
                    )
                  }
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                >
                  <option value="lark_mail">
                    Lark Mail SMTP SSL{' '}
                    {larkStatus?.connected
                      ? `(${larkStatus.lark_email || 'Connected'})`
                      : '(Configure in Settings)'}
                  </option>
                  <option value="gmail_api">
                    Gmail OAuth ({gmailEmail || 'Sign in on Send'})
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Recipient Email *
                </label>
                <input
                  type="email"
                  required
                  value={sendModal.recipient_email}
                  onChange={(e) =>
                    setSendModal((m) => (m ? { ...m, recipient_email: e.target.value } : m))
                  }
                  placeholder="cto@company.com"
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                />
              </div>
            </div>

            {sendModal.channel === 'lark_mail' && !larkStatus?.connected && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
                <span>
                  Lark Mail SMTP SSL is not configured yet. Set your Lark email &amp; Authorization
                  Code in Settings &amp; Integrations, or switch channel to Gmail OAuth above.
                </span>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      setSendModal(null);
                      onOpenSettings();
                    }}
                    className="rounded-lg bg-amber-700 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-800"
                  >
                    Open Settings &amp; Integrations
                  </button>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700">Subject *</label>
              <input
                type="text"
                required
                value={sendModal.subject}
                onChange={(e) =>
                  setSendModal((m) => (m ? { ...m, subject: e.target.value } : m))
                }
                className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Email Body *</label>
              <textarea
                rows={9}
                required
                value={sendModal.body}
                onChange={(e) => setSendModal((m) => (m ? { ...m, body: e.target.value } : m))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs leading-relaxed text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
              <span className="text-[11px] text-slate-500">
                Sending advances stage automatically and logs provider delivery ID.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSendModal(null)}
                  className="min-h-[42px] rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    sendingEmail ||
                    (sendModal.channel === 'lark_mail' && !larkStatus?.connected)
                  }
                  className="min-h-[42px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-50"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span>{sendingEmail ? 'Dispatching...' : 'Confirm & Send Email'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
