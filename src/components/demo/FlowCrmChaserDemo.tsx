import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  ExternalLink,
  Kanban,
  Mail,
  MessageSquare,
  MoveLeft,
  MoveRight,
  Phone,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  TrendingUp,
  User,
  Zap
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  INITIAL_FLOW_CRM_DEALS,
  type FlowCrmDeal,
  type FlowCrmStage
} from '../../shared/demoSaaSSampleData.ts';

interface FlowCrmChaserDemoProps {
  onCtaClick: (serviceTitle: string) => void;
}

const STAGE_CONFIG: { id: FlowCrmStage; label: string; color: string; badge: string }[] = [
  { id: 'new_inquiry', label: 'New Inquiry', color: 'border-slate-300', badge: 'bg-slate-100 text-slate-700' },
  { id: 'quote_sent', label: 'Quote Sent', color: 'border-blue-300', badge: 'bg-blue-50 text-blue-800' },
  { id: 'in_progress', label: 'In Progress', color: 'border-indigo-300', badge: 'bg-indigo-50 text-indigo-800' },
  { id: 'overdue_invoice', label: 'Overdue Invoice', color: 'border-rose-300', badge: 'bg-rose-50 text-rose-800' }
];

export function FlowCrmChaserDemo({ onCtaClick }: FlowCrmChaserDemoProps) {
  const [deals, setDeals] = useState<FlowCrmDeal[]>(INITIAL_FLOW_CRM_DEALS);
  const [collectedAmountPhp, setCollectedAmountPhp] = useState<number>(315000);
  const [activeReminderDeal, setActiveReminderDeal] = useState<FlowCrmDeal | null>(null);
  const [activePaymentPortalDeal, setActivePaymentPortalDeal] = useState<FlowCrmDeal | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'gcash' | 'maya' | 'bdo'>('gcash');
  const [addDealModalOpen, setAddDealModalOpen] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // New Deal Form State
  const [newClientName, setNewClientName] = useState('Bea Alonzo');
  const [newCompanyName, setNewCompanyName] = useState('Bright Horizon Media');
  const [newProjectTitle, setNewProjectTitle] = useState('Cloud ERP Architecture & API Modernization');
  const [newDealAmount, setNewDealAmount] = useState(78000);
  const [newDealStage, setNewDealStage] = useState<FlowCrmStage>('quote_sent');

  const handleResetSandbox = () => {
    setDeals(INITIAL_FLOW_CRM_DEALS);
    setCollectedAmountPhp(315000);
    setActiveReminderDeal(null);
    setActivePaymentPortalDeal(null);
    setFeedbackNotice('FlowCRM sandbox reset to initial state.');
    setTimeout(() => setFeedbackNotice(null), 3000);
  };

  const showNotice = (msg: string) => {
    setFeedbackNotice(msg);
    setTimeout(() => setFeedbackNotice(null), 3500);
  };

  // Move deal between stages
  const handleMoveStage = (dealId: string, direction: 'prev' | 'next') => {
    const stages: FlowCrmStage[] = ['new_inquiry', 'quote_sent', 'in_progress', 'overdue_invoice'];
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id !== dealId) return d;
        const currentIdx = stages.indexOf(d.stage);
        const targetIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
        if (targetIdx < 0 || targetIdx >= stages.length) return d;

        const nextStage = stages[targetIdx];
        const updated: FlowCrmDeal = {
          ...d,
          stage: nextStage
        };
        // Auto-assign invoice number if entering overdue or in-progress
        if (nextStage === 'overdue_invoice' && !updated.invoiceNumber) {
          updated.invoiceNumber = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
          updated.invoiceDueDate = 'Overdue (7 days)';
          updated.clientPaymentStatus = 'unpaid';
        }
        return updated;
      })
    );
    showNotice(`Deal updated in pipeline.`);
  };

  // Add custom sample deal
  const handleAddSampleDeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;
    const newDeal: FlowCrmDeal = {
      id: `deal-${Date.now()}`,
      clientName: newClientName.trim(),
      companyName: newCompanyName.trim() || 'Independent Client',
      projectTitle: newProjectTitle.trim() || 'Custom Software Retainer',
      stage: newDealStage,
      amountPhp: Number(newDealAmount) || 50000,
      daysElapsed: 1,
      contactEmail: `${newClientName.toLowerCase().replace(/\s+/g, '')}@example.com`,
      contactMobile: '+63 917 889 0012',
      invoiceNumber: newDealStage === 'overdue_invoice' ? `INV-2026-${Math.floor(1000 + Math.random() * 9000)}` : undefined,
      invoiceDueDate: newDealStage === 'overdue_invoice' ? '5 Days Overdue' : undefined,
      clientPaymentStatus: newDealStage === 'overdue_invoice' ? 'unpaid' : undefined
    };

    setDeals([newDeal, ...deals]);
    setAddDealModalOpen(false);
    showNotice(`New deal for ${newDeal.clientName} added to ${newDeal.stage.replace('_', ' ')}.`);
  };

  // Send Reminder Dispatch Handler
  const handleSendReminderDispatch = () => {
    if (!activeReminderDeal) return;
    setDeals((prev) =>
      prev.map((d) =>
        d.id === activeReminderDeal.id
          ? {
              ...d,
              lastReminderSentAt: 'Just now'
            }
          : d
      )
    );
    showNotice(`Automated Email & Viber reminders dispatched to ${activeReminderDeal.clientName}!`);
    setActiveReminderDeal(null);
  };

  // Simulate Payment Handler (Triggered from Client Portal Modal)
  const handleSimulatePayment = (deal: FlowCrmDeal) => {
    setDeals((prev) =>
      prev.map((d) =>
        d.id === deal.id
          ? {
              ...d,
              clientPaymentStatus: 'paid',
              stage: 'in_progress', // moved out of overdue into healthy in-progress or closed
              lastReminderSentAt: undefined
            }
          : d
      )
    );
    setCollectedAmountPhp((prev) => prev + deal.amountPhp);
    showNotice(`₱${deal.amountPhp.toLocaleString()} paid via ${selectedPaymentMethod.toUpperCase()}! Overdue balance settled.`);
    setActivePaymentPortalDeal(null);
  };

  // Top KPIs
  const kpis = useMemo(() => {
    const activePipeline = deals.reduce((acc, d) => acc + d.amountPhp, 0);
    const overdueTotal = deals
      .filter((d) => d.stage === 'overdue_invoice' && d.clientPaymentStatus !== 'paid')
      .reduce((acc, d) => acc + d.amountPhp, 0);
    const overdueCount = deals.filter(
      (d) => d.stage === 'overdue_invoice' && d.clientPaymentStatus !== 'paid'
    ).length;

    return {
      activePipeline,
      overdueTotal,
      overdueCount,
      collectedTotal: collectedAmountPhp,
      avgDaysToPay: 14
    };
  }, [deals, collectedAmountPhp]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* 1. SLIM DEMO TOP BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-4 sm:px-6 py-2.5 text-xs text-white">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-violet-400" />
          <span className="font-semibold tracking-wide">
            Interactive Product Demo — Sample Data Only
          </span>
          <span className="hidden sm:inline text-slate-400">
            · SME Client Pipeline, Digital Quotes &amp; Automated Invoice Chaser
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetSandbox}
            className="inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700 hover:text-white"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Sandbox</span>
          </button>
          <button
            type="button"
            onClick={() => onCtaClick('Gitstack FlowCRM')}
            className="inline-flex items-center gap-1.5 rounded bg-[var(--gs-primary)] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
          >
            <span>Request Custom Setup</span>
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {feedbackNotice && (
        <div className="bg-violet-50 border-b border-violet-200 px-4 py-2 text-xs font-semibold text-violet-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-violet-600" />
            <span>{feedbackNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            className="text-xs text-violet-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. TOP KPI SUMMARY CARDS */}
      <div className="p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Active Pipeline Value
            </div>
            <div className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
              ₱{kpis.activePipeline.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              <span className="font-mono font-semibold text-slate-700">{deals.length}</span> deals in active pipeline
            </div>
          </div>

          <div
            className={`rounded-xl border p-4 transition-colors ${
              kpis.overdueTotal > 0 ? 'border-rose-300 bg-rose-50/70' : 'border-slate-200 bg-slate-50/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider">
                Overdue Receivables
              </span>
              {kpis.overdueTotal > 0 && <span className="h-2 w-2 rounded-full bg-rose-500" />}
            </div>
            <div className="mt-1 font-display text-2xl sm:text-3xl font-bold text-rose-900 tabular-nums">
              ₱{kpis.overdueTotal.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-rose-800">
              {kpis.overdueCount} overdue invoices pending chase
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Collected This Month
            </div>
            <div className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#16A34A] tabular-nums">
              ₱{kpis.collectedTotal.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Settled via GCash, Maya &amp; Bank Wire
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Average Days to Pay
            </div>
            <div className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
              {kpis.avgDaysToPay} Days
            </div>
            <div className="mt-1 text-xs text-emerald-700 font-medium">
              ↓ 62% faster with auto-chaser
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Kanban className="h-4 w-4 text-[var(--gs-primary)]" />
            <h3 className="font-display text-sm font-bold text-slate-900">
              Client Deal Pipeline &amp; Collections
            </h3>
            <span className="text-xs text-slate-500">
              (Use arrow buttons on cards to advance stages or test auto-chase)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setAddDealModalOpen(true)}
            className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Add Sample Deal</span>
          </button>
        </div>

        {/* 3. 4-COLUMN KANBAN BOARD */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {STAGE_CONFIG.map((col) => {
            const columnDeals = deals.filter((d) => d.stage === col.id);
            const columnTotal = columnDeals.reduce((sum, d) => sum + d.amountPhp, 0);

            return (
              <div
                key={col.id}
                className={`rounded-xl border ${col.color} bg-slate-50/50 p-3.5 flex flex-col min-h-[460px]`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-xs font-bold text-slate-900">
                        {col.label}
                      </span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-mono font-bold text-slate-700 border border-slate-200">
                        {columnDeals.length}
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                      ₱{columnTotal.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Deal Cards */}
                <div className="mt-3 space-y-3 flex-1 overflow-y-auto">
                  {columnDeals.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                      No deals currently in this stage.
                    </div>
                  ) : (
                    columnDeals.map((deal) => (
                      <div
                        key={deal.id}
                        className={`rounded-xl border p-3.5 bg-white shadow-2xs space-y-2.5 transition-all ${
                          deal.stage === 'overdue_invoice'
                            ? 'border-rose-200 hover:border-rose-300 ring-1 ring-rose-100'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Client & Project Title */}
                        <div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-900">{deal.clientName}</span>
                            <span className="font-mono text-[10.5px] text-slate-400">
                              {deal.daysElapsed}d ago
                            </span>
                          </div>
                          <div className="text-[11px] font-medium text-slate-600 truncate">
                            {deal.companyName}
                          </div>
                          <p className="mt-1 text-xs text-slate-700 leading-snug line-clamp-2">
                            {deal.projectTitle}
                          </p>
                        </div>

                        {/* Amount & Invoice Meta */}
                        <div className="border-t border-slate-100 pt-2 flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-slate-900">
                            ₱{deal.amountPhp.toLocaleString()}
                          </span>

                          {deal.invoiceNumber ? (
                            <span className="font-mono text-[10.5px] text-slate-500">
                              {deal.invoiceNumber}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">Draft</span>
                          )}
                        </div>

                        {/* Overdue Badge / Chaser status */}
                        {deal.stage === 'overdue_invoice' && (
                          <div className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-[11px] space-y-1">
                            <div className="flex items-center justify-between text-rose-800 font-semibold">
                              <span>Due: {deal.invoiceDueDate}</span>
                              <span className="text-rose-600">Unpaid</span>
                            </div>
                            {deal.lastReminderSentAt && (
                              <div className="text-[10px] text-rose-700">
                                Last reminded: {deal.lastReminderSentAt}
                              </div>
                            )}

                            {/* Actions for Overdue Deal */}
                            <div className="pt-1 flex flex-col gap-1.5">
                              <button
                                type="button"
                                onClick={() => setActiveReminderDeal(deal)}
                                className="w-full rounded bg-rose-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-rose-700 flex items-center justify-center gap-1 shadow-2xs"
                              >
                                <Mail className="h-3 w-3" />
                                <span>Send Automated Reminder</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setActivePaymentPortalDeal(deal)}
                                className="w-full rounded border border-rose-300 bg-white px-2 py-1 text-[11px] font-semibold text-rose-900 hover:bg-rose-50 flex items-center justify-center gap-1"
                              >
                                <CreditCard className="h-3 w-3" />
                                <span>Preview Client Payment Portal</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Stage Progression Buttons */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                          <button
                            type="button"
                            disabled={deal.stage === 'new_inquiry'}
                            onClick={() => handleMoveStage(deal.id, 'prev')}
                            className="inline-flex items-center gap-0.5 text-slate-500 hover:text-slate-800 disabled:opacity-20 disabled:cursor-not-allowed"
                            title="Move to previous stage"
                          >
                            <MoveLeft className="h-3 w-3" />
                            <span>Back</span>
                          </button>

                          <button
                            type="button"
                            disabled={deal.stage === 'overdue_invoice'}
                            onClick={() => handleMoveStage(deal.id, 'next')}
                            className="inline-flex items-center gap-0.5 font-semibold text-[var(--gs-primary)] hover:underline disabled:opacity-20 disabled:cursor-not-allowed"
                            title="Advance to next stage"
                          >
                            <span>Advance</span>
                            <MoveRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. MODAL / DRAWER: AUTOMATED PAYMENT CHASER PREVIEW */}
      {activeReminderDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-rose-600" />
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Automated Invoice Chaser Template
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Target: {activeReminderDeal.clientName} ({activeReminderDeal.companyName}) · {activeReminderDeal.invoiceNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveReminderDeal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Email Preview */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 border-b border-slate-200 pb-1.5">
                <span>Subject: Friendly reminder: Outstanding balance for {activeReminderDeal.invoiceNumber}</span>
                <span className="text-blue-700">Email Channel</span>
              </div>
              <p className="text-slate-700 leading-relaxed">
                Dear {activeReminderDeal.clientName},<br /><br />
                We hope you are doing well. This is a gentle follow-up regarding invoice{' '}
                <strong>{activeReminderDeal.invoiceNumber}</strong> for "
                {activeReminderDeal.projectTitle}", with a remaining balance of{' '}
                <strong className="text-slate-900">₱{activeReminderDeal.amountPhp.toLocaleString()}</strong>.
                <br /><br />
                You can settle directly online with 1-click via GCash, Maya, or Bank Transfer using our secure client portal:
                <br />
                <span className="font-mono text-blue-700 underline">https://pay.gitstack.io/portal/{activeReminderDeal.id}</span>
                <br /><br />
                Thank you for your partnership!
              </p>
            </div>

            {/* SMS / Viber Preview */}
            <div className="rounded-lg border border-violet-200 bg-violet-50/70 p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px] font-semibold text-violet-900">
                <span>Viber &amp; SMS Instant Alert</span>
                <span className="font-mono text-violet-700">{activeReminderDeal.contactMobile}</span>
              </div>
              <p className="text-slate-700 font-mono text-[11px]">
                "Hi {(activeReminderDeal.clientName || 'Client').split(' ')[0]}! Quick reminder from GitStack: Invoice {activeReminderDeal.invoiceNumber} (₱{(activeReminderDeal.amountPhp ?? 0).toLocaleString()}) is currently overdue. Pay in 10s via GCash/Maya here: https://pay.gitstack.io/{activeReminderDeal.id}"
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveReminderDeal(null)}
                className="min-h-[36px] rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendReminderDispatch}
                className="min-h-[36px] rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-700 flex items-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Dispatch Email &amp; Viber Chaser Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: ONE-CLICK CLIENT PAYMENT PORTAL PREVIEW */}
      {activePaymentPortalDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Client-Facing Checkout View
                </span>
                <h3 className="font-display text-base font-bold text-slate-900 mt-1">
                  Secure Client Payment Portal
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActivePaymentPortalDeal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Bill Summary */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>Billed To:</span>
                <span className="font-bold text-slate-900">{activePaymentPortalDeal.clientName}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Invoice Number:</span>
                <span className="font-mono font-semibold text-slate-900">{activePaymentPortalDeal.invoiceNumber}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Project:</span>
                <span className="font-medium text-slate-800">{activePaymentPortalDeal.projectTitle}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
                <span>Amount Due:</span>
                <span className="font-mono text-emerald-800">
                  ₱{activePaymentPortalDeal.amountPhp.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Select Philippine Payment Channel:
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'gcash', label: 'GCash QR', sub: 'Instant Sync' },
                  { id: 'maya', label: 'Maya Checkout', sub: 'Wallet/Card' },
                  { id: 'bdo', label: 'Online Bank Wire', sub: 'BDO / BPI' }
                ].map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setSelectedPaymentMethod(pm.id as typeof selectedPaymentMethod)}
                    className={`rounded-lg p-3 text-center border transition-all ${
                      selectedPaymentMethod === pm.id
                        ? 'border-[var(--gs-primary)] bg-indigo-50/50 ring-1 ring-[var(--gs-primary)]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">{pm.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{pm.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Simulate Payment Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleSimulatePayment(activePaymentPortalDeal)}
                className="w-full min-h-[44px] rounded-lg bg-[#16A34A] px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Simulate Client Payment (₱{activePaymentPortalDeal.amountPhp.toLocaleString()} via {selectedPaymentMethod.toUpperCase()})</span>
              </button>
              <p className="mt-1.5 text-center text-[10.5px] text-slate-500">
                Clicking immediately marks the overdue deal as settled, adds to collected revenue, and removes chaser alert.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: ADD SAMPLE DEAL */}
      {addDealModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display text-sm font-bold text-slate-900">
                + Add Sample Deal to Pipeline
              </h3>
              <button
                type="button"
                onClick={() => setAddDealModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSampleDeal} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Client Contact Person</label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="mt-1 min-h-[36px] w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Company Name</label>
                <input
                  type="text"
                  required
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="mt-1 min-h-[36px] w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Project / Service Scope</label>
                <input
                  type="text"
                  required
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  className="mt-1 min-h-[36px] w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">Amount (₱)</label>
                  <input
                    type="number"
                    min={1000}
                    value={newDealAmount}
                    onChange={(e) => setNewDealAmount(Number(e.target.value) || 1000)}
                    className="mt-1 min-h-[36px] w-full rounded-lg border border-slate-200 px-3 font-mono text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700">Pipeline Stage</label>
                  <select
                    value={newDealStage}
                    onChange={(e) => setNewDealStage(e.target.value as FlowCrmStage)}
                    className="mt-1 min-h-[36px] w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-900"
                  >
                    <option value="new_inquiry">New Inquiry</option>
                    <option value="quote_sent">Quote Sent</option>
                    <option value="in_progress">In Progress</option>
                    <option value="overdue_invoice">Overdue Invoice</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddDealModalOpen(false)}
                  className="min-h-[36px] rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[36px] rounded-lg bg-[var(--gs-primary)] px-4 py-1.5 font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                >
                  Add Deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
