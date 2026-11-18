import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Database,
  History,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  X
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, getRealtimeWsUrl, getStoredToken } from '../../lib/api.ts';
import { getOrCreateBrowserSupabaseClient } from '../../lib/supabaseBrowser.ts';
import { subscribeSafeRealtimeChannel } from '../../lib/supabaseRealtime.ts';
import type {
  DataAuditLogEntry,
  DataAuditOperation,
  DataAuditSource,
  DataDomainGroup,
  DataExplorerStatus,
  DataTableColumnDescriptor,
  DataTableDescriptor
} from '../../shared/types.ts';

const DOMAIN_ORDER: DataDomainGroup[] = [
  'CRM & Leads',
  'Content & SEO',
  'Communications',
  'Analytics & Telemetry',
  'Operations & Settings',
  'Security & Audit'
];

function formatCellPreview(val: unknown, col: DataTableColumnDescriptor): string {
  if (col.masked) {
    return val ? '••••••••' : '—';
  }
  if (val === null || val === undefined || val === '') {
    return '—';
  }
  if (col.dataType === 'boolean') {
    return val ? 'true' : 'false';
  }
  if (col.dataType === 'json') {
    try {
      const str = typeof val === 'string' ? val : JSON.stringify(val);
      return str.length > 64 ? `${str.slice(0, 61)}...` : str;
    } catch {
      return String(val);
    }
  }
  if (col.dataType === 'timestamp') {
    try {
      const d = new Date(String(val));
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString().replace('T', ' ').slice(0, 19);
      }
    } catch {
      // fall through
    }
  }
  const s = String(val);
  return s.length > 72 ? `${s.slice(0, 69)}...` : s;
}

function formatJsonPretty(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    try {
      return JSON.stringify(JSON.parse(val), null, 2);
    } catch {
      return val;
    }
  }
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}

function formatAuditTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return iso;
  }
}

export function DataExplorerPanel() {
  const [tables, setTables] = useState<DataTableDescriptor[]>([]);
  const [status, setStatus] = useState<DataExplorerStatus | null>(null);
  const [selectedTableName, setSelectedTableName] = useState<string>('crm_leads');
  const [tableSearch, setTableSearch] = useState('');

  const [activeView, setActiveView] = useState<'data' | 'logs'>('data');

  // Table rows state
  const [activeTable, setActiveTable] = useState<DataTableDescriptor | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 40;
  const [rowSearch, setRowSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingRows, setLoadingRows] = useState(true);

  // Inline click-to-edit state
  const [editingCell, setEditingCell] = useState<{
    pk: string;
    column: string;
    draftValue: string;
    originalValue: unknown;
  } | null>(null);
  const [savingCellKey, setSavingCellKey] = useState<string | null>(null);
  const [flashCellKey, setFlashCellKey] = useState<string | null>(null);

  // Longtext / JSON drawer editor state
  const [drawerCell, setDrawerCell] = useState<{
    pk: string;
    col: DataTableColumnDescriptor;
    draft: string;
  } | null>(null);

  // Add Row modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addFormValues, setAddFormValues] = useState<Record<string, unknown>>({});
  const [insertingRow, setInsertingRow] = useState(false);

  // Delete confirmation inline state
  const [confirmDeletePk, setConfirmDeletePk] = useState<string | null>(null);
  const [deletingPk, setDeletingPk] = useState<string | null>(null);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<DataAuditLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditCounts, setAuditCounts] = useState({
    all: 0,
    app_studio: 0,
    supabase_dashboard: 0,
    api_backend: 0
  });
  const [auditSourceFilter, setAuditSourceFilter] = useState<'all' | DataAuditSource>('all');
  const [auditOpFilter, setAuditOpFilter] = useState<'all' | DataAuditOperation>('all');
  const [auditTableFilter, setAuditTableFilter] = useState<string>('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Realtime connection status
  const [realtimeConfig, setRealtimeConfig] = useState<{
    supabaseConfigured: boolean;
    supabaseUrl: string | null;
    supabasePublicKey: string | null;
  } | null>(null);
  const [supabaseRealtimeState, setSupabaseRealtimeState] = useState<
    'connecting' | 'live' | 'ws_fallback'
  >('connecting');
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [settingUpTriggers, setSettingUpTriggers] = useState(false);

  const flashTimerRef = useRef<number | null>(null);

  const triggerFlash = useCallback((cellKey: string) => {
    setFlashCellKey(cellKey);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => {
      setFlashCellKey(null);
    }, 1500);
  }, []);

  const loadTablesOverview = useCallback(async () => {
    setLoadingTables(true);
    try {
      const res = await api.listDataTables();
      setTables(res.tables);
      setStatus(res.status);
      setSelectedTableName((prev) => {
        if (res.tables.some((t) => t.tableName === prev)) return prev;
        return res.tables[0]?.tableName || prev;
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load database tables.'
      });
    } finally {
      setLoadingTables(false);
    }
  }, []);

  const loadRows = useCallback(async () => {
    if (!selectedTableName) return;
    setLoadingRows(true);
    try {
      const res = await api.getDataTableRows(selectedTableName, {
        limit,
        offset,
        search: rowSearch,
        sortColumn,
        sortDir
      });
      setActiveTable(res.table);
      setRows(res.rows);
      setTotalRows(res.totalCount);
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to fetch table rows.'
      });
    } finally {
      setLoadingRows(false);
    }
  }, [offset, rowSearch, selectedTableName, sortColumn, sortDir]);

  const loadAuditLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await api.listDataAuditLogs({
        table: auditTableFilter,
        source: auditSourceFilter,
        operation: auditOpFilter,
        search: auditSearch,
        limit: 80
      });
      setAuditLogs(res.logs);
      setAuditTotal(res.totalCount);
      setAuditCounts(res.countsBySource);
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load data audit logs.'
      });
    } finally {
      setLoadingLogs(false);
    }
  }, [auditOpFilter, auditSearch, auditSourceFilter, auditTableFilter]);

  // Initial load: tables + realtime config + audit counts
  useEffect(() => {
    loadTablesOverview();
    loadAuditLogs();
    api
      .getDataRealtimeConfig()
      .then((cfg) => {
        setRealtimeConfig(cfg);
        if (!cfg.supabaseConfigured) {
          setSupabaseRealtimeState('ws_fallback');
        }
      })
      .catch(() => {
        setSupabaseRealtimeState('ws_fallback');
      });
  }, [loadAuditLogs, loadTablesOverview]);

  // Load rows whenever active table or pagination/sort/search changes
  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // Reload audit logs when filters change
  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  // Subscribe to Supabase Realtime postgres_changes on active table + data_audit_logs
  useEffect(() => {
    if (!realtimeConfig?.supabaseConfigured || !selectedTableName) {
      return;
    }
    const token = getStoredToken();
    const client = getOrCreateBrowserSupabaseClient(
      realtimeConfig.supabaseUrl,
      realtimeConfig.supabasePublicKey,
      token
    );
    if (!client) {
      setSupabaseRealtimeState('ws_fallback');
      return;
    }

    setSupabaseRealtimeState('live');
    const cleanupTable = subscribeSafeRealtimeChannel(
      client,
      `data-explorer-table-${selectedTableName}`,
      (channel) => {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: selectedTableName },
          () => {
            setSupabaseRealtimeState('live');
            void loadRows();
            void loadTablesOverview();
          }
        );
      }
    );

    const cleanupAudit = subscribeSafeRealtimeChannel(
      client,
      'data-explorer-audit-logs',
      (channel) => {
        channel.on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'data_audit_logs' },
          (payload) => {
            const incoming = payload.new as DataAuditLogEntry | undefined;
            if (!incoming?.id) return;
            setAuditLogs((prev) => {
              if (prev.some((l) => l.id === incoming.id)) return prev;
              return [incoming, ...prev].slice(0, 80);
            });
            setAuditCounts((prev) => ({
              ...prev,
              all: prev.all + 1,
              [incoming.source]: (prev[incoming.source] || 0) + 1
            }));
          }
        );
      }
    );

    return () => {
      cleanupTable();
      cleanupAudit();
    };
  }, [loadRows, loadTablesOverview, realtimeConfig, selectedTableName]);

  // Redundant Express /ws live sync channel for instant multi-tab & local-json sync
  useEffect(() => {
    const wsUrl = getRealtimeWsUrl();
    const token = getStoredToken();
    if (!wsUrl || !token) return;

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: 'admin:join', token }));
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(String(evt.data)) as {
            type?: string;
            payload?: {
              tableName?: string;
              operation?: DataAuditOperation;
              recordPk?: string;
              row?: Record<string, unknown>;
              auditLog?: DataAuditLogEntry;
            };
          };
          if (msg.type === 'data:sync' && msg.payload) {
            const { tableName, operation, recordPk, row, auditLog } = msg.payload;
            if (tableName === selectedTableName) {
              const pkCol = activeTable?.primaryKey || 'id';
              if (operation === 'INSERT' && row) {
                setRows((prev) => {
                  const pk = String(row[pkCol] ?? '');
                  if (prev.some((r) => String(r[pkCol] ?? '') === pk)) return prev;
                  return [row, ...prev];
                });
                setTotalRows((c) => c + 1);
              } else if (operation === 'UPDATE' && row) {
                setRows((prev) =>
                  prev.map((r) =>
                    String(r[pkCol] ?? '') === String(row[pkCol] ?? '') ? row : r
                  )
                );
              } else if (operation === 'DELETE' && recordPk) {
                setRows((prev) =>
                  prev.filter((r) => String(r[pkCol] ?? '') !== String(recordPk))
                );
              }
            }
            if (auditLog?.id) {
              setAuditLogs((prev) => {
                if (prev.some((l) => l.id === auditLog.id)) return prev;
                return [auditLog, ...prev].slice(0, 80);
              });
              setAuditCounts((prev) => ({
                ...prev,
                all: prev.all + 1,
                [auditLog.source]: (prev[auditLog.source] || 0) + 1
              }));
            }
          }
        } catch {
          // ignore malformed messages
        }
      };
    } catch {
      // ignore ws errors
    }

    return () => {
      if (ws && ws.readyState < 2) ws.close();
    };
  }, [activeTable?.primaryKey, selectedTableName]);

  const handleSelectTable = (tableName: string) => {
    setSelectedTableName(tableName);
    setOffset(0);
    setRowSearch('');
    setSortColumn(undefined);
    setSortDir('desc');
    setEditingCell(null);
    setDrawerCell(null);
    setConfirmDeletePk(null);
    setNotice(null);
  };

  const handleSortToggle = (colName: string) => {
    if (sortColumn === colName) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(colName);
      setSortDir('asc');
    }
    setOffset(0);
  };

  const commitCellUpdate = async (
    pk: string,
    col: DataTableColumnDescriptor,
    nextValue: unknown,
    previousValue: unknown
  ) => {
    if (!activeTable) return;
    // Skip unnecessary round-trip when unchanged
    const prevStr =
      typeof previousValue === 'object' && previousValue !== null
        ? JSON.stringify(previousValue)
        : String(previousValue ?? '');
    const nextStr =
      typeof nextValue === 'object' && nextValue !== null
        ? JSON.stringify(nextValue)
        : String(nextValue ?? '');
    if (prevStr === nextStr && col.dataType !== 'boolean') {
      setEditingCell(null);
      return;
    }

    const cellKey = `${pk}::${col.name}`;
    setSavingCellKey(cellKey);
    setNotice(null);
    setEditingCell(null);

    const pkCol = activeTable.primaryKey;
    const prevSnapshot = rows;

    // Optimistic update
    setRows((prev) =>
      prev.map((r) => (String(r[pkCol] ?? '') === pk ? { ...r, [col.name]: nextValue } : r))
    );

    try {
      const res = await api.updateDataTableCell(activeTable.tableName, {
        primaryKeyValue: pk,
        column: col.name,
        value: nextValue
      });
      setRows((prev) =>
        prev.map((r) => (String(r[pkCol] ?? '') === pk ? res.row : r))
      );
      if (res.auditLog?.id) {
        setAuditLogs((prev) => {
          if (prev.some((l) => l.id === res.auditLog.id)) return prev;
          return [res.auditLog, ...prev].slice(0, 80);
        });
      }
      triggerFlash(cellKey);
      setNotice({
        type: 'ok',
        text: `Saved ${activeTable.tableName}.${col.name} (${pk}) and synced Realtime.`
      });
    } catch (err) {
      // Rollback optimistic change on failure
      setRows(prevSnapshot);
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : `Failed updating ${col.name}.`
      });
    } finally {
      setSavingCellKey(null);
    }
  };

  const handleCellClick = (row: Record<string, unknown>, col: DataTableColumnDescriptor) => {
    if (!activeTable || activeTable.readOnlyTable || col.readOnly || col.masked || col.isPrimaryKey) {
      return;
    }
    const pk = String(row[activeTable.primaryKey] ?? '');
    if (!pk) return;

    const currentVal = row[col.name];

    if (col.dataType === 'boolean') {
      void commitCellUpdate(pk, col, !Boolean(currentVal), Boolean(currentVal));
      return;
    }

    if (col.dataType === 'longtext' || col.dataType === 'json') {
      setDrawerCell({
        pk,
        col,
        draft:
          col.dataType === 'json'
            ? formatJsonPretty(currentVal)
            : String(currentVal ?? '')
      });
      return;
    }

    setEditingCell({
      pk,
      column: col.name,
      draftValue: currentVal === null || currentVal === undefined ? '' : String(currentVal),
      originalValue: currentVal
    });
  };

  const openAddRowModal = () => {
    if (!activeTable) return;
    const defaults: Record<string, unknown> = {};
    for (const col of activeTable.columns) {
      if (col.masked || col.name === 'created_at' || col.name === 'updated_at' || col.name === 'detected_at' || col.name === 'sent_at') {
        continue;
      }
      if (col.defaultValue !== undefined) {
        defaults[col.name] =
          col.dataType === 'json' ? JSON.stringify(col.defaultValue, null, 2) : col.defaultValue;
      } else if (col.dataType === 'boolean') {
        defaults[col.name] = false;
      } else if (col.dataType === 'number') {
        defaults[col.name] = 0;
      } else if (col.dataType === 'enum' && col.enumValues?.length) {
        defaults[col.name] = col.enumValues[0];
      } else if (col.dataType === 'json') {
        defaults[col.name] = '[]';
      } else {
        defaults[col.name] = '';
      }
    }
    setAddFormValues(defaults);
    setAddModalOpen(true);
  };

  const handleInsertRowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTable) return;
    setInsertingRow(true);
    setNotice(null);
    try {
      const res = await api.insertDataTableRow(activeTable.tableName, addFormValues);
      const pkCol = activeTable.primaryKey;
      const newPk = String(res.row[pkCol] ?? '');
      setRows((prev) => {
        if (prev.some((r) => String(r[pkCol] ?? '') === newPk)) return prev;
        return [res.row, ...prev];
      });
      setTotalRows((c) => c + 1);
      setTables((prev) =>
        prev.map((t) =>
          t.tableName === activeTable.tableName ? { ...t, rowCount: t.rowCount + 1 } : t
        )
      );
      if (res.auditLog?.id) {
        setAuditLogs((prev) => {
          if (prev.some((l) => l.id === res.auditLog.id)) return prev;
          return [res.auditLog, ...prev].slice(0, 80);
        });
      }
      setAddModalOpen(false);
      setNotice({
        type: 'ok',
        text: `Inserted row (${newPk}) into ${activeTable.tableName} and broadcast via Supabase Realtime.`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed inserting new row.'
      });
    } finally {
      setInsertingRow(false);
    }
  };

  const handleDeleteRow = async (pk: string) => {
    if (!activeTable) return;
    setDeletingPk(pk);
    setNotice(null);
    try {
      const res = await api.deleteDataTableRow(activeTable.tableName, pk);
      const pkCol = activeTable.primaryKey;
      setRows((prev) => prev.filter((r) => String(r[pkCol] ?? '') !== pk));
      setTotalRows((c) => Math.max(0, c - 1));
      setTables((prev) =>
        prev.map((t) =>
          t.tableName === activeTable.tableName
            ? { ...t, rowCount: Math.max(0, t.rowCount - 1) }
            : t
        )
      );
      if (res.auditLog?.id) {
        setAuditLogs((prev) => {
          if (prev.some((l) => l.id === res.auditLog.id)) return prev;
          return [res.auditLog, ...prev].slice(0, 80);
        });
      }
      setConfirmDeletePk(null);
      setNotice({
        type: 'ok',
        text: `Deleted record "${pk}" from ${activeTable.tableName}.`
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed deleting row.'
      });
    } finally {
      setDeletingPk(null);
    }
  };

  const handleSetupTriggers = async () => {
    setSettingUpTriggers(true);
    setNotice(null);
    try {
      const res = await api.setupDataAuditTriggers();
      setNotice({
        type: res.triggersReady ? 'ok' : 'err',
        text: res.message
      });
      await loadTablesOverview();
      await loadAuditLogs();
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to run trigger migration.'
      });
    } finally {
      setSettingUpTriggers(false);
    }
  };

  const groupedTables = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    const filtered = tables.filter(
      (t) =>
        !q ||
        t.tableName.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q) ||
        t.domainGroup.toLowerCase().includes(q)
    );
    const map = new Map<DataDomainGroup, DataTableDescriptor[]>();
    for (const group of DOMAIN_ORDER) map.set(group, []);
    for (const t of filtered) {
      const list = map.get(t.domainGroup) || [];
      list.push(t);
      map.set(t.domainGroup, list);
    }
    return Array.from(map.entries()).filter(([, items]) => items.length > 0);
  }, [tableSearch, tables]);

  const totalPages = Math.max(1, Math.ceil(totalRows / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">
              {activeTable?.domainGroup || 'Database'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-600">
              public.{activeTable?.tableName || selectedTableName}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-700">
              {totalRows.toLocaleString()} rows
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
              <span
                className={`h-2 w-2 rounded-full ${
                  supabaseRealtimeState === 'live' ? 'bg-emerald-600' : 'bg-amber-500'
                }`}
              />
              <span>
                {supabaseRealtimeState === 'live'
                  ? 'Supabase Realtime Live'
                  : 'WebSocket Live Sync'}
              </span>
            </span>
          </div>
          <h2 className="mt-0.5 font-display text-lg font-bold text-slate-900 truncate">
            {activeView === 'data'
              ? activeTable?.label || 'Live Supabase Data Explorer'
              : 'Database Change & Audit Logs'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveView('data')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                activeView === 'data'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              <span>Table Data</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveView('logs');
                void loadAuditLogs();
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                activeView === 'logs'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Audit Logs</span>
              <span className="font-mono tabular-nums text-[11px] text-slate-500">
                ({auditCounts.all})
              </span>
            </button>
          </div>

          {activeView === 'data' && activeTable && !activeTable.readOnlyTable && (
            <button
              type="button"
              onClick={openAddRowModal}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Row</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              void loadTablesOverview();
              if (activeView === 'data') {
                void loadRows();
              } else {
                void loadAuditLogs();
              }
            }}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingRows || loadingLogs ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Trigger Setup Notice (only if Supabase configured without audit triggers active yet) */}
      {status?.supabaseConfigured && !status.triggersReady && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-700 shrink-0" />
            <div className="text-xs text-amber-950">
              <div className="font-semibold">
                Supabase Audit Triggers &amp; Realtime Publication Need Sync
              </div>
              <p className="mt-0.5 text-amber-800">
                To capture edits made directly in the Supabase Dashboard and stream row inserts in
                real time, apply the updated schema triggers in Supabase.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSetupTriggers}
              disabled={settingUpTriggers}
              className="min-h-[36px] rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60 whitespace-nowrap"
            >
              {settingUpTriggers ? 'Installing Triggers...' : 'Install Triggers & Realtime'}
            </button>
          </div>
        </div>
      )}

      {/* Action feedback notice */}
      {notice && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs font-medium ${
            notice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
            className="text-current/70 hover:text-current"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main 2-Pane Layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left Table Directory Rail */}
        <aside className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-3 space-y-3 h-fit lg:max-h-[780px] lg:overflow-y-auto">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder={`Search ${tables.length} tables...`}
              aria-label="Filter database tables"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
            />
          </div>

          {loadingTables && tables.length === 0 ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="h-9 rounded-lg bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {groupedTables.map(([groupName, groupItems]) => (
                <div key={groupName} className="space-y-1">
                  <div className="px-2 text-[11px] font-semibold text-slate-400">
                    {groupName}
                  </div>
                  <div className="space-y-0.5">
                    {groupItems.map((tbl) => {
                      const active = selectedTableName === tbl.tableName && activeView === 'data';
                      return (
                        <button
                          key={tbl.tableName}
                          type="button"
                          onClick={() => {
                            setActiveView('data');
                            handleSelectTable(tbl.tableName);
                          }}
                          className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                            active
                              ? 'bg-[var(--gs-primary)] text-white'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">{tbl.label}</div>
                            <div
                              className={`font-mono text-[11px] truncate ${
                                active ? 'text-white/80' : 'text-slate-400'
                              }`}
                            >
                              {tbl.tableName}
                            </div>
                          </div>
                          <span
                            className={`font-mono text-[11px] tabular-nums shrink-0 ${
                              active ? 'text-white/90' : 'text-slate-500'
                            }`}
                          >
                            {tbl.rowCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Right Primary Viewport */}
        <div className="lg:col-span-9 min-w-0 rounded-xl border border-slate-200 bg-white overflow-hidden">
          {activeView === 'data' ? (
            <div className="flex flex-col">
              {/* Grid Search & Metadata Bar */}
              <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 max-w-sm">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={rowSearch}
                    onChange={(e) => {
                      setRowSearch(e.target.value);
                      setOffset(0);
                    }}
                    placeholder={`Search rows in ${selectedTableName}...`}
                    aria-label="Search table rows"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>Click any unlocked cell to edit</span>
                  <span aria-hidden="true">·</span>
                  <span>Enter or blur saves immediately</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-slate-600">
                    <Lock className="h-3 w-3" />
                    <span>Secrets masked</span>
                  </span>
                </div>
              </div>

              {/* Spreadsheet Grid */}
              {loadingRows ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 10 }).map((_, idx) => (
                    <div key={idx} className="h-[40px] rounded bg-slate-100 animate-pulse" />
                  ))}
                </div>
              ) : !activeTable || rows.length === 0 ? (
                <div className="px-6 py-16 text-center space-y-3">
                  <Database className="mx-auto h-8 w-8 text-slate-300" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      No rows found in public.{selectedTableName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {rowSearch
                        ? 'Try clearing your search filter or add a new record.'
                        : 'Add your first record here and it will sync immediately via Supabase Realtime.'}
                    </p>
                  </div>
                  {activeTable && !activeTable.readOnlyTable && (
                    <button
                      type="button"
                      onClick={openAddRowModal}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add First Row</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                      <tr>
                        {activeTable.columns.map((col) => {
                          const isSorted = sortColumn === col.name;
                          return (
                            <th
                              key={col.name}
                              className="h-[40px] px-3 py-2 font-semibold text-slate-700 whitespace-nowrap border-r border-slate-200/70 last:border-r-0"
                            >
                              <button
                                type="button"
                                onClick={() => handleSortToggle(col.name)}
                                className="inline-flex items-center gap-1.5 hover:text-slate-950"
                              >
                                {(col.masked || col.isPrimaryKey) && (
                                  <Lock className="h-3 w-3 text-slate-400 shrink-0" />
                                )}
                                <span className="font-mono text-[11px]">{col.name}</span>
                                <span className="text-[10px] font-normal text-slate-400">
                                  {col.dataType}
                                </span>
                                {isSorted ? (
                                  sortDir === 'asc' ? (
                                    <ArrowUp className="h-3 w-3 text-[var(--gs-primary)]" />
                                  ) : (
                                    <ArrowDown className="h-3 w-3 text-[var(--gs-primary)]" />
                                  )
                                ) : (
                                  <ArrowUpDown className="h-3 w-3 text-slate-300" />
                                )}
                              </button>
                            </th>
                          );
                        })}
                        {!activeTable.readOnlyTable && (
                          <th className="h-[40px] px-3 py-2 text-right font-semibold text-slate-600 whitespace-nowrap">
                            Action
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {rows.map((row) => {
                        const pkVal = String(row[activeTable.primaryKey] ?? '');
                        return (
                          <tr
                            key={pkVal || JSON.stringify(row)}
                            className="h-[40px] hover:bg-slate-50/90 transition-colors"
                          >
                            {activeTable.columns.map((col) => {
                              const cellKey = `${pkVal}::${col.name}`;
                              const isEditing =
                                editingCell?.pk === pkVal && editingCell?.column === col.name;
                              const isSaving = savingCellKey === cellKey;
                              const isFlashing = flashCellKey === cellKey;
                              const isLocked =
                                Boolean(activeTable.readOnlyTable) ||
                                col.readOnly ||
                                col.masked ||
                                col.isPrimaryKey;
                              const rawVal = row[col.name];

                              return (
                                <td
                                  key={col.name}
                                  onClick={() => {
                                    if (!isEditing && !isLocked) {
                                      handleCellClick(row, col);
                                    }
                                  }}
                                  title={
                                    col.masked
                                      ? 'Protected secret column (masked)'
                                      : isLocked
                                        ? 'Read-only column'
                                        : 'Click to edit'
                                  }
                                  className={`h-[40px] max-w-[260px] px-3 py-1.5 border-r border-slate-100 whitespace-nowrap truncate transition-colors ${
                                    col.dataType === 'number' ? 'text-right font-mono tabular-nums' : ''
                                  } ${col.dataType === 'timestamp' || col.isPrimaryKey ? 'font-mono tabular-nums text-[11px]' : ''} ${
                                    isLocked
                                      ? 'text-slate-500 bg-slate-50/40'
                                      : 'cursor-pointer text-slate-900 hover:bg-blue-50/40'
                                  } ${isFlashing ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-500' : ''} ${
                                    isSaving ? 'opacity-60' : ''
                                  }`}
                                >
                                  {isEditing && col.dataType === 'enum' && col.enumValues ? (
                                    <select
                                      autoFocus
                                      value={editingCell.draftValue}
                                      onChange={(e) => {
                                        const nextVal = e.target.value;
                                        void commitCellUpdate(
                                          pkVal,
                                          col,
                                          nextVal,
                                          editingCell.originalValue
                                        );
                                      }}
                                      onBlur={() => setEditingCell(null)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Escape') setEditingCell(null);
                                      }}
                                      className="h-7 w-full rounded border border-[var(--gs-primary)] bg-white px-1.5 text-xs text-slate-900 focus:outline-none"
                                    >
                                      {col.enumValues.map((opt) => (
                                        <option key={opt} value={opt}>
                                          {opt}
                                        </option>
                                      ))}
                                    </select>
                                  ) : isEditing ? (
                                    <input
                                      autoFocus
                                      type={col.dataType === 'number' ? 'number' : 'text'}
                                      value={editingCell.draftValue}
                                      onChange={(e) =>
                                        setEditingCell((prev) =>
                                          prev ? { ...prev, draftValue: e.target.value } : null
                                        )
                                      }
                                      onBlur={() => {
                                        void commitCellUpdate(
                                          pkVal,
                                          col,
                                          editingCell.draftValue,
                                          editingCell.originalValue
                                        );
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          void commitCellUpdate(
                                            pkVal,
                                            col,
                                            editingCell.draftValue,
                                            editingCell.originalValue
                                          );
                                        } else if (e.key === 'Escape') {
                                          e.preventDefault();
                                          setEditingCell(null);
                                        }
                                      }}
                                      className="h-7 w-full min-w-[110px] rounded border border-[var(--gs-primary)] bg-white px-2 text-xs text-slate-900 focus:outline-none"
                                    />
                                  ) : col.dataType === 'boolean' ? (
                                    <span
                                      className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold ${
                                        rawVal ? 'text-emerald-700' : 'text-slate-500'
                                      }`}
                                    >
                                      {rawVal ? 'true' : 'false'}
                                    </span>
                                  ) : (
                                    <span>{formatCellPreview(rawVal, col)}</span>
                                  )}
                                </td>
                              );
                            })}
                            {!activeTable.readOnlyTable && (
                              <td className="h-[40px] px-3 py-1.5 text-right whitespace-nowrap">
                                {confirmDeletePk === pkVal ? (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={deletingPk === pkVal}
                                      onClick={() => void handleDeleteRow(pkVal)}
                                      className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                    >
                                      {deletingPk === pkVal ? '...' : 'Confirm'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeletePk(null)}
                                      className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    aria-label={`Delete row ${pkVal}`}
                                    onClick={() => setConfirmDeletePk(pkVal)}
                                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-600">
                <div className="font-mono tabular-nums">
                  {totalRows === 0
                    ? '0 rows'
                    : `Showing ${offset + 1}–${Math.min(offset + rows.length, totalRows)} of ${totalRows}`}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={offset === 0}
                    onClick={() => setOffset((p) => Math.max(0, p - limit))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="font-mono tabular-nums text-[11px]">
                    Page {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={offset + limit >= totalRows}
                    onClick={() => setOffset((p) => p + limit)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* View B: Unified Change & Audit Logs */
            <div className="flex flex-col">
              <div className="flex flex-col gap-3 border-b border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
                    {(
                      [
                        { id: 'all', label: `All (${auditCounts.all})` },
                        { id: 'app_studio', label: `App Studio (${auditCounts.app_studio})` },
                        {
                          id: 'supabase_dashboard',
                          label: `Supabase Dashboard (${auditCounts.supabase_dashboard})`
                        },
                        { id: 'api_backend', label: `API (${auditCounts.api_backend})` }
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAuditSourceFilter(opt.id)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                          auditSourceFilter === opt.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Filter logs by operation"
                      value={auditOpFilter}
                      onChange={(e) =>
                        setAuditOpFilter(e.target.value as 'all' | DataAuditOperation)
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                    >
                      <option value="all">All Operations</option>
                      <option value="INSERT">INSERT</option>
                      <option value="UPDATE">UPDATE</option>
                      <option value="DELETE">DELETE</option>
                    </select>

                    <select
                      aria-label="Filter logs by table"
                      value={auditTableFilter}
                      onChange={(e) => setAuditTableFilter(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                    >
                      <option value="all">All Tables</option>
                      {tables.map((t) => (
                        <option key={t.tableName} value={t.tableName}>
                          {t.tableName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="relative max-w-md">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Filter by table, record ID, actor email..."
                    aria-label="Search audit logs"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {loadingLogs && auditLogs.length === 0 ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="h-14 rounded-lg bg-slate-100 animate-pulse" />
                  ))}
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="px-6 py-16 text-center space-y-2">
                  <History className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-800">
                    No database edit logs recorded yet
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Edit any cell or insert a row here in GitStack Studio, or update a record directly
                    in the Supabase Dashboard to see live before/after audit entries appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 max-h-[640px] overflow-y-auto">
                  {auditLogs.map((log) => {
                    const expanded = expandedAuditId === log.id;
                    return (
                      <div key={log.id} className="px-4 py-3 hover:bg-slate-50/70">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span
                                className={`font-mono font-bold ${
                                  log.operation === 'DELETE'
                                    ? 'text-red-700'
                                    : log.operation === 'INSERT'
                                      ? 'text-emerald-700'
                                      : 'text-[var(--gs-primary)]'
                                }`}
                              >
                                {log.operation}
                              </span>
                              <span aria-hidden="true" className="text-slate-300">
                                ·
                              </span>
                              <span className="font-mono font-semibold text-slate-900">
                                public.{log.table_name}
                              </span>
                              {log.record_pk && (
                                <>
                                  <span aria-hidden="true" className="text-slate-300">
                                    ·
                                  </span>
                                  <span className="font-mono text-[11px] text-slate-600">
                                    {log.record_pk}
                                  </span>
                                </>
                              )}
                              <span aria-hidden="true" className="text-slate-300">
                                ·
                              </span>
                              <span
                                className={`font-semibold ${
                                  log.source === 'supabase_dashboard'
                                    ? 'text-amber-700'
                                    : log.source === 'app_studio'
                                      ? 'text-slate-800'
                                      : 'text-slate-600'
                                }`}
                              >
                                {log.source === 'supabase_dashboard'
                                  ? 'Supabase Dashboard'
                                  : log.source === 'app_studio'
                                    ? 'App Studio'
                                    : 'API Backend'}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                              <span>Actor: {log.actor_email || 'system'}</span>
                              {Array.isArray(log.changed_columns) && log.changed_columns.length > 0 && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono text-slate-600">
                                    Columns: {log.changed_columns.join(', ')}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono text-[11px] tabular-nums text-slate-500">
                              {formatAuditTimestamp(log.created_at)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setExpandedAuditId(expanded ? null : log.id)}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              {expanded ? 'Hide Diff' : 'Inspect Diff'}
                            </button>
                          </div>
                        </div>

                        {expanded && (
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 border-t border-slate-200 pt-3">
                            <div>
                              <div className="mb-1 text-[11px] font-semibold text-slate-500">
                                Before Data
                              </div>
                              <pre className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] text-slate-700">
                                {log.before_data ? formatJsonPretty(log.before_data) : 'null (new row)'}
                              </pre>
                            </div>
                            <div>
                              <div className="mb-1 text-[11px] font-semibold text-slate-500">
                                After Data
                              </div>
                              <pre className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] text-slate-900">
                                {log.after_data ? formatJsonPretty(log.after_data) : 'null (deleted row)'}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-500 font-mono tabular-nums">
                Showing {auditLogs.length} of {auditTotal} audit entries
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Longtext / JSONB Drawer Editor */}
      {drawerCell && activeTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40">
          <div className="flex h-full w-full max-w-xl flex-col bg-white border-l border-slate-200 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="font-mono text-xs text-slate-500">
                  public.{activeTable.tableName} · {drawerCell.pk}
                </div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Edit {drawerCell.col.name} ({drawerCell.col.dataType})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDrawerCell(null)}
                aria-label="Close cell editor"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <textarea
                value={drawerCell.draft}
                onChange={(e) =>
                  setDrawerCell((prev) => (prev ? { ...prev, draft: e.target.value } : null))
                }
                rows={18}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setDrawerCell(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = drawerCell;
                  setDrawerCell(null);
                  const pkCol = activeTable.primaryKey;
                  const existingRow = rows.find((r) => String(r[pkCol] ?? '') === target.pk);
                  void commitCellUpdate(
                    target.pk,
                    target.col,
                    target.draft,
                    existingRow?.[target.col.name]
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Save &amp; Sync</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Row Modal */}
      {addModalOpen && activeTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="font-mono text-xs text-slate-500">
                  public.{activeTable.tableName}
                </div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Add Row to {activeTable.label}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                aria-label="Close add row modal"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleInsertRowSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {activeTable.columns
                  .filter(
                    (c) =>
                      !c.masked &&
                      c.name !== 'created_at' &&
                      c.name !== 'updated_at' &&
                      c.name !== 'detected_at' &&
                      c.name !== 'sent_at'
                  )
                  .map((col) => {
                    const val = addFormValues[col.name];
                    return (
                      <div key={col.name} className="space-y-1">
                        <label className="flex items-center justify-between text-xs font-semibold text-slate-700">
                          <span className="font-mono">
                            {col.name}
                            {col.isPrimaryKey ? ' (Primary Key — leave blank to auto-generate)' : ''}
                          </span>
                          <span className="font-normal text-slate-400">{col.dataType}</span>
                        </label>

                        {col.dataType === 'boolean' ? (
                          <button
                            type="button"
                            onClick={() =>
                              setAddFormValues((prev) => ({
                                ...prev,
                                [col.name]: !Boolean(prev[col.name])
                              }))
                            }
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono font-semibold text-slate-800"
                          >
                            <span>{val ? 'true' : 'false'}</span>
                          </button>
                        ) : col.dataType === 'enum' && col.enumValues ? (
                          <select
                            value={String(val ?? col.enumValues[0])}
                            onChange={(e) =>
                              setAddFormValues((prev) => ({ ...prev, [col.name]: e.target.value }))
                            }
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                          >
                            {col.enumValues.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : col.dataType === 'longtext' || col.dataType === 'json' ? (
                          <textarea
                            rows={3}
                            value={String(val ?? '')}
                            onChange={(e) =>
                              setAddFormValues((prev) => ({ ...prev, [col.name]: e.target.value }))
                            }
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                          />
                        ) : (
                          <input
                            type={col.dataType === 'number' ? 'number' : 'text'}
                            value={val === null || val === undefined ? '' : String(val)}
                            onChange={(e) =>
                              setAddFormValues((prev) => ({ ...prev, [col.name]: e.target.value }))
                            }
                            placeholder={
                              col.isPrimaryKey ? 'Auto-generated if blank' : `Enter ${col.name}`
                            }
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
                          />
                        )}
                      </div>
                    );
                  })}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={insertingRow}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)] disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{insertingRow ? 'Inserting & Syncing...' : 'Insert Row (Realtime)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
