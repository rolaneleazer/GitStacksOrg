import {
  ArrowUpRight,
  CheckCircle2,
  Code,
  Copy,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Plus,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Zap
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  INITIAL_RECENT_INVOICES,
  INVOICE_SCENARIO_PRESETS,
  type EInvoiceRecord,
  type InvoiceLineItem
} from '../../shared/demoSaaSSampleData.ts';

interface EInvoicePortalDemoProps {
  onCtaClick: (serviceTitle: string) => void;
}

export function EInvoicePortalDemo({ onCtaClick }: EInvoicePortalDemoProps) {
  // Scenario Preset
  const [selectedScenario, setSelectedScenario] = useState<
    'Retail POS Sale' | 'B2B Service Retainer' | 'E-Commerce Order'
  >('Retail POS Sale');

  // Client Details
  const [clientName, setClientName] = useState(
    INVOICE_SCENARIO_PRESETS['Retail POS Sale'].clientName
  );
  const [clientTin, setClientTin] = useState(
    INVOICE_SCENARIO_PRESETS['Retail POS Sale'].clientTin
  );
  const [clientAddress, setClientAddress] = useState(
    INVOICE_SCENARIO_PRESETS['Retail POS Sale'].clientAddress
  );

  // Line Items
  const [items, setItems] = useState<InvoiceLineItem[]>(
    INVOICE_SCENARIO_PRESETS['Retail POS Sale'].items
  );

  // Right-hand tab: 'customer_invoice' vs 'bir_json'
  const [previewTab, setPreviewTab] = useState<'customer_invoice' | 'bir_json'>('customer_invoice');

  // Mini-ledger of generated & past invoices
  const [invoices, setInvoices] = useState<EInvoiceRecord[]>(INITIAL_RECENT_INVOICES);
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);

  // Feedback banner
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Switch scenario preset
  const handleSelectScenario = (
    scenario: 'Retail POS Sale' | 'B2B Service Retainer' | 'E-Commerce Order'
  ) => {
    setSelectedScenario(scenario);
    const preset = INVOICE_SCENARIO_PRESETS[scenario];
    setClientName(preset.clientName);
    setClientTin(preset.clientTin);
    setClientAddress(preset.clientAddress);
    setItems(preset.items.map((i) => ({ ...i })));
    setFeedbackNotice(`Loaded scenario preset: "${scenario}".`);
    setTimeout(() => setFeedbackNotice(null), 3000);
  };

  // Reset sandbox
  const handleResetSandbox = () => {
    setSelectedScenario('Retail POS Sale');
    const preset = INVOICE_SCENARIO_PRESETS['Retail POS Sale'];
    setClientName(preset.clientName);
    setClientTin(preset.clientTin);
    setClientAddress(preset.clientAddress);
    setItems(preset.items.map((i) => ({ ...i })));
    setInvoices(INITIAL_RECENT_INVOICES);
    setSelectedLedgerId(null);
    setPreviewTab('customer_invoice');
    setFeedbackNotice('E-Invoice sandbox reset to sample state.');
    setTimeout(() => setFeedbackNotice(null), 3000);
  };

  // Line item modifications
  const handleUpdateItem = (
    index: number,
    field: keyof InvoiceLineItem,
    value: string | number
  ) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    setItems(next);
  };

  const handleAddItem = () => {
    const newItem: InvoiceLineItem = {
      id: `item-${Date.now()}`,
      description: 'Standard Professional SLA Support Hour',
      quantity: 1,
      unitPricePhp: 2500
    };
    setItems([...items, newItem]);
  };

  const handleDeleteItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Financial Calculations (12% VAT in Philippines)
  // Total Gross = sum(qty * unitPrice)
  // In PH VAT: Gross Total = VATable Sales + 12% VAT -> VATable = Gross / 1.12, VAT = Gross - VATable
  const totals = useMemo(() => {
    const grossTotal = items.reduce(
      (acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.unitPricePhp) || 0),
      0
    );
    const vatableSales = grossTotal / 1.12;
    const vatAmount = grossTotal - vatableSales;
    return {
      grossTotal,
      vatableSales,
      vatAmount
    };
  }, [items]);

  // Generate E-Invoice Handler
  const handleGenerateInvoice = () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invNumber = `INV-2026-${randomSuffix}`;
    const newRecord: EInvoiceRecord = {
      id: `inv-${Date.now()}`,
      invoiceNumber: invNumber,
      clientName: clientName.trim() || 'Metro Retail Trading Corp.',
      clientTin: clientTin.trim() || '009-482-110-000',
      clientAddress: clientAddress.trim() || 'Makati City, Metro Manila',
      businessScenario: selectedScenario,
      invoiceDate: new Date().toISOString().split('T')[0],
      items: items.map((i) => ({ ...i })),
      vatableSalesPhp: totals.vatableSales,
      vatAmountPhp: totals.vatAmount,
      totalAmountDuePhp: totals.grossTotal,
      status: 'Validated',
      jwsSignature: `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXUyJ9.eyJuYmYiOi...${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      birSubmissionUuid: `BIR-EIS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomSuffix}`
    };

    setInvoices([newRecord, ...invoices]);
    setSelectedLedgerId(newRecord.id);
    setFeedbackNotice(
      `E-Invoice ${invNumber} generated and signed with BIR JWS signature!`
    );
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  // Structured BIR EIS JSON generation for active invoice
  const birJsonPayload = useMemo(() => {
    return {
      schemaVersion: '1.4.0',
      transmissionStandard: 'BIR-EIS-RR-09-2021',
      issuer: {
        tin: '007-891-234-000',
        registeredName: 'GITSTACK TECHNOLOGIES INC.',
        branchCode: '0000',
        rdoCode: '047',
        vatRegistered: true,
        address: '548 Market Street, Suite 42010, Bonifacio Global City, Taguig 1634'
      },
      buyer: {
        tin: clientTin,
        registeredName: clientName,
        address: clientAddress,
        buyerType: 'CORPORATE_REGISTERED'
      },
      invoiceDetails: {
        documentType: 'VAT_SALES_INVOICE',
        invoiceNumber: selectedLedgerId
          ? invoices.find((i) => i.id === selectedLedgerId)?.invoiceNumber || 'INV-2026-PREVIEW'
          : 'INV-2026-LIVE',
        issueDate: new Date().toISOString(),
        currency: 'PHP',
        exchangeRate: 1.0
      },
      lineItems: items.map((item, idx) => ({
        lineNumber: idx + 1,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPricePhp,
        grossAmount: item.quantity * item.unitPricePhp,
        vatType: 'VATABLE',
        taxRate: 0.12,
        vatableAmount: Number(((item.quantity * item.unitPricePhp) / 1.12).toFixed(2)),
        vatAmount: Number(
          ((item.quantity * item.unitPricePhp) - (item.quantity * item.unitPricePhp) / 1.12).toFixed(2)
        )
      })),
      taxSummary: {
        vatableSalesPhp: Number(totals.vatableSales.toFixed(2)),
        vatAmount12PercentPhp: Number(totals.vatAmount.toFixed(2)),
        vatExemptSalesPhp: 0.0,
        zeroRatedSalesPhp: 0.0,
        totalInvoiceAmountPhp: Number(totals.grossTotal.toFixed(2))
      },
      digitalSignature: {
        algorithm: 'RSASSA-PKCS1-v1_5',
        hashAlgorithm: 'SHA-256',
        jwsHeader: { alg: 'RS256', typ: 'JWS', x5t: 'bir-cert-2026' },
        jwsToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXUyJ9...7X8qM29',
        digestHashSha256: '9a31b4e022f641219cd8e41109a9094feec8e1c6b65313904',
        validationStatus: 'CERTIFIED_COMPLIANT'
      }
    };
  }, [clientName, clientTin, clientAddress, items, totals, selectedLedgerId, invoices]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* 1. SLIM TOP DEMO BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-4 sm:px-6 py-2.5 text-xs text-white">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
          <span className="font-semibold tracking-wide">
            Interactive Product Demo — Sample Data Only
          </span>
          <span className="hidden sm:inline text-slate-400">
            · BIR EIS Electronic Invoicing &amp; Digital Signatures
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
            onClick={() => onCtaClick('Gitstack E-Invoice')}
            className="inline-flex items-center gap-1.5 rounded bg-[var(--gs-primary)] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
          >
            <span>Request Custom Setup</span>
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {feedbackNotice && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-xs font-semibold text-blue-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            <span>{feedbackNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            className="text-xs text-blue-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. SPLIT WORKSPACE: BUILDER (LEFT) VS LIVE PREVIEW (RIGHT) */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* Scenario Switcher Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <span className="text-xs font-bold text-slate-900">Preset Scenario:</span>
            <span className="ml-2 text-xs text-slate-500">
              Load typical SME transaction structures
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['Retail POS Sale', 'B2B Service Retainer', 'E-Commerce Order'] as const).map(
              (scenario) => (
                <button
                  key={scenario}
                  type="button"
                  onClick={() => handleSelectScenario(scenario)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                    selectedScenario === scenario
                      ? 'bg-blue-900 text-white shadow-sm'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {scenario}
                </button>
              )
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT PANEL: INTERACTIVE INVOICE BUILDER */}
          <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Interactive Invoice Builder
                </h3>
                <p className="text-xs text-slate-500">
                  Edit buyer data &amp; line items to see live VAT calculations
                </p>
              </div>
              <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-700 border border-blue-200">
                BIR RR 8-2022
              </span>
            </div>

            {/* Client Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700">Buyer Business Name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="mt-1 min-h-[36px] w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Buyer TIN (9 or 12 digits)</label>
                <input
                  type="text"
                  value={clientTin}
                  onChange={(e) => setClientTin(e.target.value)}
                  className="mt-1 min-h-[36px] w-full rounded-lg border border-slate-200 px-3 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Registered Address</label>
                <input
                  type="text"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  className="mt-1 min-h-[36px] w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800">
                  Billable Items &amp; Services ({items.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleUpdateItem(idx, 'description', e.target.value)}
                        placeholder="Description of item or service..."
                        className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-900"
                      />
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Delete item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Qty:</span>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateItem(idx, 'quantity', Number(e.target.value) || 1)
                          }
                          className="w-16 rounded border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs text-slate-900"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Price (₱):</span>
                        <input
                          type="number"
                          min={0}
                          value={item.unitPricePhp}
                          onChange={(e) =>
                            handleUpdateItem(idx, 'unitPricePhp', Number(e.target.value) || 0)
                          }
                          className="w-24 rounded border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs text-slate-900"
                        />
                      </div>

                      <div className="font-mono font-bold text-slate-900 text-right shrink-0">
                        ₱{(item.quantity * item.unitPricePhp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Calculation Breakdown */}
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>VATable Sales (Net of 12%):</span>
                <span className="font-mono font-semibold tabular-nums text-slate-900">
                  ₱{totals.vatableSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Value-Added Tax (12%):</span>
                <span className="font-mono font-semibold tabular-nums text-slate-900">
                  ₱{totals.vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-blue-200 pt-1.5 text-sm font-bold text-slate-900">
                <span>Total Amount Due:</span>
                <span className="font-mono text-blue-900 tabular-nums">
                  ₱{totals.grossTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={handleGenerateInvoice}
              className="w-full min-h-[44px] rounded-lg bg-blue-900 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <FileCheck className="h-4 w-4" />
              <span>Generate Compliant E-Invoice &amp; BIR Signature</span>
            </button>
          </div>

          {/* RIGHT PANEL: LIVE SPLIT PREVIEW */}
          <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col min-h-[580px]">
            {/* Tab switch */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewTab('customer_invoice')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    previewTab === 'customer_invoice'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 text-blue-700" />
                  <span>Customer Tax Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('bir_json')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    previewTab === 'bir_json'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Code className="h-3.5 w-3.5 text-emerald-700" />
                  <span>BIR EIS JSON &amp; JWS</span>
                </button>
              </div>

              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Schema Validated</span>
              </span>
            </div>

            {/* TAB CONTENT A: PRINTABLE CUSTOMER TAX INVOICE */}
            {previewTab === 'customer_invoice' && (
              <div className="p-5 sm:p-6 space-y-5 bg-white text-slate-800 text-xs flex-1 flex flex-col justify-between">
                <div>
                  {/* Tax Invoice Header */}
                  <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                    <div>
                      <div className="font-display text-base font-bold text-slate-900">
                        GITSTACK TECHNOLOGIES INC.
                      </div>
                      <div className="text-[11px] text-slate-500">
                        VAT Reg TIN: 007-891-234-000-0000 · RDO: 047
                      </div>
                      <div className="text-[11px] text-slate-500">
                        548 Market Street, Suite 42010, Bonifacio Global City, Taguig 1634
                      </div>
                      <div className="mt-1 font-mono text-[10.5px] text-blue-700 font-semibold">
                        BIR CAS Permit No: CAS-2026-0091-BGC
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="inline-block rounded bg-blue-100 text-blue-900 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider">
                        Official Sales Invoice
                      </span>
                      <div className="mt-1 font-mono text-sm font-bold text-slate-900">
                        INV-2026-{invoices[0]?.invoiceNumber.split('-')[2] || '0881'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Date: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  {/* Customer Metadata */}
                  <div className="grid grid-cols-2 gap-4 py-3 border-b border-slate-100 text-[11.5px]">
                    <div>
                      <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                        Billed To
                      </div>
                      <div className="font-bold text-slate-900 mt-0.5">{clientName}</div>
                      <div className="text-slate-600 mt-0.5">{clientAddress}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                        Buyer TIN
                      </div>
                      <div className="font-mono font-bold text-slate-900 mt-0.5">{clientTin}</div>
                      <div className="text-[10.5px] text-slate-500 mt-0.5">
                        Terms: Net 30 Days · Currency: PHP
                      </div>
                    </div>
                  </div>

                  {/* Itemized Table */}
                  <div className="mt-4">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10.5px] font-semibold uppercase text-slate-500">
                          <th className="py-2">Item Description</th>
                          <th className="py-2 text-center">Qty</th>
                          <th className="py-2 text-right">Unit Price</th>
                          <th className="py-2 text-right">Amount (PHP)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11.5px]">
                        {items.map((i) => (
                          <tr key={i.id}>
                            <td className="py-2 font-medium text-slate-800">{i.description}</td>
                            <td className="py-2 text-center font-mono">{i.quantity}</td>
                            <td className="py-2 text-right font-mono">
                              ₱{i.unitPricePhp.toLocaleString()}
                            </td>
                            <td className="py-2 text-right font-mono font-bold text-slate-900">
                              ₱{(i.quantity * i.unitPricePhp).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* VAT Breakdown Summary */}
                  <div className="mt-4 border-t border-slate-200 pt-3 flex justify-end">
                    <div className="w-64 space-y-1 text-[11.5px]">
                      <div className="flex justify-between text-slate-600">
                        <span>VATable Sales:</span>
                        <span className="font-mono font-semibold text-slate-900">
                          ₱{totals.vatableSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>VAT (12%):</span>
                        <span className="font-mono font-semibold text-slate-900">
                          ₱{totals.vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>VAT-Exempt / Zero-Rated:</span>
                        <span className="font-mono font-semibold text-slate-900">₱0.00</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-bold text-slate-900">
                        <span>Total Due:</span>
                        <span className="font-mono text-blue-900">
                          ₱{totals.grossTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer with QR Code Placeholder and Official Disclaimer */}
                <div className="mt-5 border-t border-slate-200 pt-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 rounded border border-slate-300 bg-slate-50 p-1 flex flex-col items-center justify-center shrink-0">
                      <QrCode className="h-10 w-10 text-slate-800" />
                      <span className="text-[7.5px] font-mono text-slate-500">BIR EIS SCAN</span>
                    </div>
                    <div className="text-[10px] text-slate-500 leading-snug">
                      <p className="font-semibold text-slate-700">
                        BIR Electronic Invoicing System (EIS) Compliant
                      </p>
                      <p>JWS Hash: SHA256:{invoices[0]?.jwsSignature.slice(-12) || '8K3vM9xL2p5w'}</p>
                      <p>
                        "This document serves as an Official Electronic Sales Invoice pursuant to RR
                        8-2022 / RR 9-2021."
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackNotice('Simulated PDF invoice export prepared.');
                      setTimeout(() => setFeedbackNotice(null), 3000);
                    }}
                    className="min-h-[34px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT B: BIR EIS JSON & JWS SIGNATURE */}
            {previewTab === 'bir_json' && (
              <div className="p-4 bg-slate-950 text-slate-200 font-mono text-xs flex-1 flex flex-col justify-between overflow-x-auto">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <Code className="h-4 w-4 text-emerald-400" />
                      <span className="text-white font-semibold">bir_eis_payload.json</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400">● Validated Standard v1.4</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(JSON.stringify(birJsonPayload, null, 2));
                          setFeedbackNotice('BIR EIS JSON payload copied to clipboard.');
                          setTimeout(() => setFeedbackNotice(null), 3000);
                        }}
                        className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 hover:text-white flex items-center gap-1"
                      >
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </button>
                    </div>
                  </div>

                  <pre className="mt-3 text-[11px] leading-relaxed text-slate-300 max-h-[420px] overflow-y-auto">
                    {JSON.stringify(birJsonPayload, null, 2)}
                  </pre>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Signer: BIR-RSA-2048-HARDWARE-TOKEN</span>
                  <span className="text-emerald-400 font-bold">DIGITAL SIGNATURE VALID</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. BOTTOM MINI-LEDGER (5 RECENT SAMPLE INVOICES) */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 bg-slate-50/80">
            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-700">
                Recent E-Invoice Transmissions (Live Mini-Ledger)
              </h4>
              <p className="text-[11px] text-slate-500">
                Updates dynamically when you click "Generate Compliant E-Invoice". Click any record to inspect.
              </p>
            </div>
            <span className="font-mono text-xs text-slate-600 font-semibold">
              {invoices.length} Registered Invoices
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Client Name</th>
                  <th className="py-2.5 px-4">Scenario</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4 text-right">Amount (PHP)</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4">BIR Transmission UUID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => {
                      setSelectedLedgerId(inv.id);
                      setClientName(inv.clientName);
                      setClientTin(inv.clientTin);
                      setClientAddress(inv.clientAddress);
                      setItems(inv.items);
                      setFeedbackNotice(`Loaded invoice ${inv.invoiceNumber} into preview.`);
                      setTimeout(() => setFeedbackNotice(null), 3000);
                    }}
                    className={`cursor-pointer transition-colors ${
                      selectedLedgerId === inv.id ? 'bg-blue-50/80 font-medium' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-blue-900">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{inv.clientName}</td>
                    <td className="py-3 px-4 text-slate-600">{inv.businessScenario}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{inv.invoiceDate}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                      ₱{inv.totalAmountDuePhp.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                          inv.status === 'Validated'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : inv.status === 'Transmitted'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {inv.birSubmissionUuid}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
