import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Layers,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingCart,
  Store,
  TrendingUp,
  Zap
} from 'lucide-react';
import React, { useState } from 'react';
import {
  INITIAL_INVENTORY_LOGS,
  INITIAL_INVENTORY_SKUS,
  type InventoryActivityLog,
  type InventorySkuItem
} from '../../shared/demoSaaSSampleData.ts';

interface InventorySyncDemoProps {
  onCtaClick: (serviceTitle: string) => void;
}

export function InventorySyncDemo({ onCtaClick }: InventorySyncDemoProps) {
  const [skus, setSkus] = useState<InventorySkuItem[]>(INITIAL_INVENTORY_SKUS);
  const [logs, setLogs] = useState<InventoryActivityLog[]>(INITIAL_INVENTORY_LOGS);
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'catalog' | 'orders'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_stock' | 'low_stock' | 'critical'>('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedSkuId, setSelectedSkuId] = useState<string>('sku-001');
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // New SKU form state
  const [newSkuCode, setNewSkuCode] = useState('OFF-DSK-09');
  const [newSkuName, setNewSkuName] = useState('Minimalist Felt Desk Pad (Charcoal)');
  const [newSkuCategory, setNewSkuCategory] = useState('Computer Accessories');
  const [newSkuWarehouse, setNewSkuWarehouse] = useState(30);
  const [newSkuReorder, setNewSkuReorder] = useState(10);
  const [newSkuPrice, setNewSkuPrice] = useState(890);

  const handleResetDemo = () => {
    setSkus(INITIAL_INVENTORY_SKUS);
    setLogs(INITIAL_INVENTORY_LOGS);
    setSearchQuery('');
    setFilterStatus('all');
    setSelectedSkuId('sku-001');
    setFeedbackNotice('Inventory state & omnichannel order feeds reset to factory defaults.');
    setTimeout(() => setFeedbackNotice(null), 3000);
  };

  const showNotice = (msg: string) => {
    setFeedbackNotice(msg);
    setTimeout(() => setFeedbackNotice(null), 3500);
  };

  const getSkuStatus = (sku: InventorySkuItem): 'in_stock' | 'low_stock' | 'critical' => {
    if (sku.warehouseStock <= 5) return 'critical';
    if (sku.warehouseStock <= sku.reorderPoint) return 'low_stock';
    return 'in_stock';
  };

  // Simulation 1: Shopee Order (-3 units)
  const handleSimulateShopeeOrder = () => {
    const target = skus.find((s) => s.id === selectedSkuId) || skus[0];
    const newStock = Math.max(0, target.warehouseStock - 3);
    const updatedSkus = skus.map((s) =>
      s.id === target.id
        ? {
            ...s,
            warehouseStock: newStock,
            channelAllocation: {
              ...s.channelAllocation,
              shopee: Math.max(0, s.channelAllocation.shopee - 3)
            },
            updatedAt: 'Just now'
          }
        : s
    );
    setSkus(updatedSkus);

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newLog: InventoryActivityLog = {
      id: `log-${Date.now()}`,
      timestamp: timeStr,
      channel: 'Shopee',
      action: `Shopee Order #SHP-${Math.floor(1000 + Math.random() * 9000)} (-3 units of ${target.sku})`,
      sku: target.sku,
      quantityChange: -3,
      newWarehouseStock: newStock,
      type: newStock <= target.reorderPoint ? 'alert' : 'sale'
    };
    setLogs([newLog, ...logs]);
    showNotice(`Shopee order simulated: -3 units deducted from ${target.name}.`);
  };

  // Simulation 2: TikTok Flash Sale (-8 units)
  const handleSimulateTikTokSale = () => {
    // Pick the tumbler or canvas tote for dramatic low-stock impact
    const target = skus.find((s) => s.id === 'sku-002') || skus[1];
    const newStock = Math.max(0, target.warehouseStock - 8);
    const updatedSkus = skus.map((s) =>
      s.id === target.id
        ? {
            ...s,
            warehouseStock: newStock,
            channelAllocation: {
              ...s.channelAllocation,
              tiktokShop: Math.max(0, s.channelAllocation.tiktokShop - 5)
            },
            updatedAt: 'Just now'
          }
        : s
    );
    setSkus(updatedSkus);

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newLog: InventoryActivityLog = {
      id: `log-${Date.now()}`,
      timestamp: timeStr,
      channel: 'TikTok Shop',
      action: `TikTok Flash Sale Live #TT-${Math.floor(1000 + Math.random() * 9000)} (-8 units of ${target.sku})`,
      sku: target.sku,
      quantityChange: -8,
      newWarehouseStock: newStock,
      type: 'alert'
    };
    setLogs([newLog, ...logs]);
    showNotice(`TikTok Flash Sale simulated! ${target.name} dropped to ${newStock} units (Low Stock alert triggered).`);
  };

  // Simulation 3: Warehouse Restock (+20 units)
  const handleSimulateRestock = () => {
    const lowItem = skus.find((s) => s.warehouseStock <= s.reorderPoint) || skus[0];
    const newStock = lowItem.warehouseStock + 20;
    const updatedSkus = skus.map((s) =>
      s.id === lowItem.id
        ? {
            ...s,
            warehouseStock: newStock,
            channelAllocation: {
              physicalStore: s.channelAllocation.physicalStore + 5,
              shopee: s.channelAllocation.shopee + 5,
              lazada: s.channelAllocation.lazada + 5,
              tiktokShop: s.channelAllocation.tiktokShop + 5
            },
            updatedAt: 'Just now'
          }
        : s
    );
    setSkus(updatedSkus);

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newLog: InventoryActivityLog = {
      id: `log-${Date.now()}`,
      timestamp: timeStr,
      channel: 'Main Warehouse',
      action: `Restock PO #WH-${Math.floor(100 + Math.random() * 900)} (+20 units into ${lowItem.sku})`,
      sku: lowItem.sku,
      quantityChange: +20,
      newWarehouseStock: newStock,
      type: 'restock'
    };
    setLogs([newLog, ...logs]);
    showNotice(`Warehouse restock received: +20 units added to ${lowItem.name}.`);
  };

  const handleAddCustomSku = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkuName.trim()) return;
    const newId = `sku-${Date.now().toString().slice(-4)}`;
    const newItem: InventorySkuItem = {
      id: newId,
      sku: newSkuCode.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      name: newSkuName.trim(),
      category: newSkuCategory,
      warehouseStock: Number(newSkuWarehouse) || 20,
      channelAllocation: {
        physicalStore: Math.floor((Number(newSkuWarehouse) || 20) * 0.2),
        shopee: Math.floor((Number(newSkuWarehouse) || 20) * 0.3),
        lazada: Math.floor((Number(newSkuWarehouse) || 20) * 0.3),
        tiktokShop: Math.floor((Number(newSkuWarehouse) || 20) * 0.2)
      },
      reorderPoint: Number(newSkuReorder) || 10,
      unitCostPhp: Math.round((Number(newSkuPrice) || 500) * 0.45),
      sellingPricePhp: Number(newSkuPrice) || 890,
      updatedAt: 'Just now'
    };
    setSkus([newItem, ...skus]);
    setAddModalOpen(false);
    showNotice(`Product SKU ${newItem.sku} added to catalog.`);
  };

  // KPIs
  const totalActiveSkus = skus.length;
  const lowStockCount = skus.filter((s) => s.warehouseStock <= s.reorderPoint).length;
  const criticalCount = skus.filter((s) => s.warehouseStock <= 5).length;
  const totalWarehouseUnits = skus.reduce((acc, s) => acc + s.warehouseStock, 0);
  const simulatedTodayGmvPhp = 168450 + (logs.filter((l) => l.type === 'sale').length * 2490);

  // Filtered SKUs
  const filteredSkus = skus.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase());
    const status = getSkuStatus(s);
    const matchesStatus = filterStatus === 'all' || status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* 1. SLIM DEMO TOP BANNER */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-4 sm:px-6 py-2.5 text-xs text-white">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          <span className="font-semibold tracking-wide">Interactive Sandbox Demo (Sample Data)</span>
          <span className="hidden sm:inline text-slate-400">· Omnichannel SME Inventory Sync</span>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetDemo}
            className="inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700 hover:text-white"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Demo</span>
          </button>
          <button
            type="button"
            onClick={() => onCtaClick('Gitstack Inventory Sync')}
            className="inline-flex items-center gap-1.5 rounded bg-[var(--gs-primary)] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
          >
            <span>Get This for Your Business</span>
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {feedbackNotice && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{feedbackNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            className="text-xs text-emerald-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. SUB-NAVIGATION TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-1">
          {[
            { id: 'dashboard', label: 'Dashboard & Live Sync', icon: TrendingUp },
            { id: 'catalog', label: `Product Catalog (${totalActiveSkus})`, icon: Package },
            { id: 'orders', label: `Order Feed (${logs.length})`, icon: ShoppingCart }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id as typeof activeSubTab)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Selected target SKU for simulation */}
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-medium hidden sm:inline">Active Target SKU:</span>
          <select
            aria-label="Target SKU for order simulation"
            value={selectedSkuId}
            onChange={(e) => setSelectedSkuId(e.target.value)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-mono font-medium text-slate-800"
          >
            {skus.map((s) => (
              <option key={s.id} value={s.id}>
                {s.sku} — {s.name.slice(0, 24)} ({s.warehouseStock} in stock)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. TOP KPI SUMMARY CARDS */}
      <div className="p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Total Active SKUs
            </div>
            <div className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
              {totalActiveSkus}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              <span className="font-mono font-semibold text-slate-700">{totalWarehouseUnits}</span> units across warehouse
            </div>
          </div>

          <div
            className={`rounded-xl border p-4 transition-colors ${
              lowStockCount > 0
                ? 'border-amber-300 bg-amber-50/70'
                : 'border-slate-200 bg-slate-50/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
                Low Stock Alerts
              </span>
              {lowStockCount > 0 && (
                <span className="h-2 w-2 rounded-full bg-amber-500" />
              )}
            </div>
            <div className="mt-1 font-display text-2xl sm:text-3xl font-bold text-amber-900 tabular-nums">
              {lowStockCount}
            </div>
            <div className="mt-1 text-xs text-amber-800">
              {criticalCount > 0 ? `${criticalCount} critically low (<=5 units)` : 'Below reorder threshold'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Synced Channels
            </div>
            <div className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
              4 / 4 Live
            </div>
            <div className="mt-1 flex flex-wrap gap-1 text-[10px] font-mono text-slate-600">
              <span>Shopee</span> · <span>Lazada</span> · <span>TikTok</span> · <span>Physical POS</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Today's GMV (PHP)
            </div>
            <div className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#16A34A] tabular-nums">
              ₱{simulatedTodayGmvPhp.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Omnichannel auto-reconciled
            </div>
          </div>
        </div>

        {/* 4. PROMINENT SIMULATION ACTION BAR */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Zap className="h-4 w-4 text-[var(--gs-primary)]" />
                <span>Simulate Real-Time Omnichannel Order Events</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">
                Click any simulation button to test instant stock deduction across channels, automatic low-stock triggering, and webhook activity logging.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSimulateShopeeOrder}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-orange-900 hover:bg-orange-50 shadow-sm"
              >
                <ArrowDownRight className="h-3.5 w-3.5 text-orange-600" />
                <span>Simulate Shopee Order (-3 units)</span>
              </button>

              <button
                type="button"
                onClick={handleSimulateTikTokSale}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-pink-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-pink-900 hover:bg-pink-50 shadow-sm"
              >
                <Zap className="h-3.5 w-3.5 text-pink-600" />
                <span>Simulate TikTok Flash Sale (-8 units)</span>
              </button>

              <button
                type="button"
                onClick={handleSimulateRestock}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 shadow-sm"
              >
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                <span>Restock Warehouse (+20 units)</span>
              </button>
            </div>
          </div>
        </div>

        {/* 5. MAIN CONTENT VIEWPORTS */}

        {/* VIEW A: DASHBOARD & LIVE SYNC SPLIT VIEW */}
        {activeSubTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Inventory Highlights & Low Stock Spotlight */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Real-Time Stock Health &amp; Channel Allocation
                </h3>
                <span className="text-xs text-slate-500">
                  Showing top {Math.min(5, skus.length)} active SKUs
                </span>
              </div>

              <div className="space-y-3">
                {skus.slice(0, 5).map((item) => {
                  const status = getSkuStatus(item);
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedSkuId(item.id)}
                      className={`cursor-pointer rounded-xl border p-4 transition-all ${
                        selectedSkuId === item.id
                          ? 'border-[var(--gs-primary)] bg-indigo-50/30 ring-1 ring-[var(--gs-primary)]'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[var(--gs-primary)]">
                              {item.sku}
                            </span>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs text-slate-500">{item.category}</span>
                          </div>
                          <h4 className="mt-1 font-display text-sm font-bold text-slate-900">
                            {item.name}
                          </h4>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-display text-lg font-bold text-slate-900 tabular-nums">
                            {item.warehouseStock}{' '}
                            <span className="text-xs font-normal text-slate-500">units</span>
                          </div>
                          <span
                            className={`inline-block rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                              status === 'in_stock'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : status === 'low_stock'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {status === 'in_stock'
                              ? 'In Stock'
                              : status === 'low_stock'
                                ? 'Low Stock'
                                : 'Critical Alert'}
                          </span>
                        </div>
                      </div>

                      {/* Channel Allocation Bar */}
                      <div className="mt-3 border-t border-slate-100 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                        <div className="flex items-center gap-3 text-[11px]">
                          <span>
                            Physical:{' '}
                            <strong className="font-mono text-slate-800">
                              {item.channelAllocation.physicalStore}
                            </strong>
                          </span>
                          <span>
                            Shopee:{' '}
                            <strong className="font-mono text-orange-700">
                              {item.channelAllocation.shopee}
                            </strong>
                          </span>
                          <span>
                            Lazada:{' '}
                            <strong className="font-mono text-blue-700">
                              {item.channelAllocation.lazada}
                            </strong>
                          </span>
                          <span>
                            TikTok:{' '}
                            <strong className="font-mono text-pink-700">
                              {item.channelAllocation.tiktokShop}
                            </strong>
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500">
                          Reorder Point: {item.reorderPoint}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('catalog')}
                  className="text-xs font-semibold text-[var(--gs-primary)] hover:underline inline-flex items-center gap-1"
                >
                  <span>View All {skus.length} SKUs in Full Catalog</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Right: Live Sync Activity Log Panel */}
            <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[var(--gs-primary)]" />
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Live Sync Activity Log
                    </h3>
                  </div>
                  <span className="font-mono text-xs text-slate-500">{logs.length} events</span>
                </div>

                <div className="mt-4 space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-800">{log.channel}</span>
                        <span className="font-mono text-slate-500">{log.timestamp}</span>
                      </div>
                      <p className="mt-1 text-slate-700 font-medium">{log.action}</p>
                      <div className="mt-1 flex items-center justify-between font-mono text-[10.5px] text-slate-500">
                        <span>SKU: {log.sku}</span>
                        <span
                          className={`font-bold ${
                            log.quantityChange > 0 ? 'text-emerald-700' : 'text-slate-800'
                          }`}
                        >
                          {log.quantityChange > 0 ? `+${log.quantityChange}` : log.quantityChange}{' '}
                          units (Remaining: {log.newWarehouseStock})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Webhook latency: &lt;140ms</span>
                <span className="text-emerald-700 font-medium">Automatic Retry Queue: 0 Pending</span>
              </div>
            </div>
          </div>
        )}

        {/* VIEW B: PRODUCT CATALOG (FULL 8-SKU TABLE) */}
        {activeSubTab === 'catalog' && (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search SKU code, product name, or category..."
                    className="min-h-[38px] w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:outline-none"
                  />
                </div>

                <select
                  aria-label="Filter SKU status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                  className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  <option value="all">All Statuses ({skus.length})</option>
                  <option value="in_stock">In Stock</option>
                  <option value="low_stock">Low Stock Alerts</option>
                  <option value="critical">Critical (≤5 units)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Add Sample Product</span>
              </button>
            </div>

            {/* Product Table */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">SKU &amp; Product Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Main Warehouse</th>
                      <th className="py-3 px-4">Channel Allocation</th>
                      <th className="py-3 px-4 text-right">Reorder Point</th>
                      <th className="py-3 px-4 text-right">Retail Price</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {filteredSkus.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                          No products match your search query. Click "Reset Demo" to restore defaults.
                        </td>
                      </tr>
                    ) : (
                      filteredSkus.map((item) => {
                        const status = getSkuStatus(item);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70">
                            <td className="py-3.5 px-4 max-w-[240px]">
                              <div className="font-mono text-xs font-bold text-[var(--gs-primary)]">
                                {item.sku}
                              </div>
                              <div className="mt-0.5 font-semibold text-slate-900 truncate">
                                {item.name}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                              {item.category}
                            </td>
                            <td className="py-3.5 px-4 text-right font-display text-sm font-bold text-slate-900 tabular-nums">
                              {item.warehouseStock}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                              <span title="Physical Store">Store: {item.channelAllocation.physicalStore}</span> ·{' '}
                              <span title="Shopee" className="text-orange-700">SHP: {item.channelAllocation.shopee}</span> ·{' '}
                              <span title="Lazada" className="text-blue-700">LZD: {item.channelAllocation.lazada}</span> ·{' '}
                              <span title="TikTok Shop" className="text-pink-700">TT: {item.channelAllocation.tiktokShop}</span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-700 tabular-nums">
                              {item.reorderPoint}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                              ₱{item.sellingPricePhp.toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span
                                className={`inline-block rounded px-2.5 py-0.5 font-mono text-[10.5px] font-bold uppercase ${
                                  status === 'in_stock'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : status === 'low_stock'
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                                }`}
                              >
                                {status === 'in_stock'
                                  ? 'In Stock'
                                  : status === 'low_stock'
                                    ? 'Low Stock'
                                    : 'Critical'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW C: FULL ORDER FEED */}
        {activeSubTab === 'orders' && (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Omnichannel Order Feed &amp; Stock Sync History
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Shows live webhooks arriving from Shopee, Lazada, TikTok Shop, and Warehouse restock points.
                </p>
              </div>
              <span className="font-mono text-xs text-slate-500">{logs.length} logged events</span>
            </div>

            <div className="divide-y divide-slate-200">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/70"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        log.type === 'restock'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : log.type === 'alert'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-indigo-50 text-[var(--gs-primary)] border border-indigo-200'
                      }`}
                    >
                      {log.type === 'restock' ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ShoppingCart className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-xs">{log.action}</span>
                        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.2 font-mono text-[10px] text-slate-600">
                          {log.channel}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500 font-mono">
                        Target SKU: {log.sku} · Recorded at {log.timestamp}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`font-mono text-xs font-bold ${
                        log.quantityChange > 0 ? 'text-[#16A34A]' : 'text-slate-900'
                      }`}
                    >
                      {log.quantityChange > 0 ? `+${log.quantityChange}` : log.quantityChange} units
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      New Warehouse Balance: {log.newWarehouseStock}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 6. MODAL: ADD SAMPLE PRODUCT */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display text-sm font-bold text-slate-900">
                + Add Sample Product to Catalog (In-Memory)
              </h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomSku} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">SKU Code</label>
                <input
                  type="text"
                  required
                  value={newSkuCode}
                  onChange={(e) => setNewSkuCode(e.target.value)}
                  className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 px-3 font-mono text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Product Title</label>
                <input
                  type="text"
                  required
                  value={newSkuName}
                  onChange={(e) => setNewSkuName(e.target.value)}
                  className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Category</label>
                <select
                  value={newSkuCategory}
                  onChange={(e) => setNewSkuCategory(e.target.value)}
                  className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-900"
                >
                  <option value="Computer Accessories">Computer Accessories</option>
                  <option value="Consumer Electronics">Consumer Electronics</option>
                  <option value="Lifestyle & Home">Lifestyle &amp; Home</option>
                  <option value="Apparel & Bags">Apparel &amp; Bags</option>
                  <option value="Kitchen & Dining">Kitchen &amp; Dining</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700">Stock Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={newSkuWarehouse}
                    onChange={(e) => setNewSkuWarehouse(Number(e.target.value) || 1)}
                    className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 px-3 font-mono text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Reorder Alert</label>
                  <input
                    type="number"
                    min={1}
                    value={newSkuReorder}
                    onChange={(e) => setNewSkuReorder(Number(e.target.value) || 1)}
                    className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 px-3 font-mono text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Price (₱)</label>
                  <input
                    type="number"
                    min={1}
                    value={newSkuPrice}
                    onChange={(e) => setNewSkuPrice(Number(e.target.value) || 1)}
                    className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 px-3 font-mono text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="min-h-[36px] rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[36px] rounded-lg bg-[var(--gs-primary)] px-4 py-1.5 font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                >
                  Add Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
