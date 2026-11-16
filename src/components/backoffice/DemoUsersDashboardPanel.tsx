import {
  Activity,
  ArrowUpRight,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.ts';
import type { DemoUsersSummaryStats, PublicDemoUser } from '../../shared/types.ts';

interface DemoUsersDashboardPanelProps {
  onOpenCrm?: () => void;
}

type DemoEngagementFilter = 'all' | 'active_7d' | 'high_engagement' | 'converted';

const EMPTY_SUMMARY: DemoUsersSummaryStats = {
  totalUsers: 0,
  activeLast7Days: 0,
  totalActions: 0,
  totalLogins: 0,
  totalConversions: 0,
  linkedCrmLeads: 0
};

export function DemoUsersDashboardPanel({ onOpenCrm }: DemoUsersDashboardPanelProps) {
  const [users, setUsers] = useState<PublicDemoUser[]>([]);
  const [summary, setSummary] = useState<DemoUsersSummaryStats>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<DemoEngagementFilter>('all');
  const [selectedUser, setSelectedUser] = useState<PublicDemoUser | null>(null);

  const loadDemoUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAdminDemoUsers();
      setUsers(data.users || []);
      setSummary(data.summary || EMPTY_SUMMARY);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Live Demo accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDemoUsers();
  }, [loadDemoUsers]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return users.filter((u) => {
      if (filterMode === 'active_7d') {
        if (new Date(u.last_active_at || u.created_at).getTime() < sevenDaysAgo) return false;
      } else if (filterMode === 'high_engagement') {
        if (u.actions_count < 3 && (u.explored_modules?.length || 0) < 2) return false;
      } else if (filterMode === 'converted') {
        if (u.sandbox_conversions < 1) return false;
      }

      if (!q) return true;
      return (
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.company.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        (u.last_action_label || '').toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery, filterMode]);

  return (
    <div className="space-y-6">
      {/* Header Strip */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--gs-primary)]">
            <Users className="h-4 w-4" />
            <span>Isolated Live Demo Accounts &amp; Engagement Telemetry</span>
          </div>
          <h2 className="mt-1 font-display text-base font-bold text-slate-900">
            Visitor Demo Sign-Ups &amp; CRM Lead Sync
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Every visitor who creates a Demo account is automatically added to your CRM Pipeline
            (Source: Live Demo Signups), alerted via Lark Mail, and tracked here separately from
            Back Office Admin RBAC accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadDemoUsers}
            disabled={loading}
            className="min-h-[40px] whitespace-nowrap inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh Stats'}</span>
          </button>
          {onOpenCrm && (
            <button
              type="button"
              onClick={onOpenCrm}
              className="min-h-[40px] whitespace-nowrap inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
            >
              <Briefcase className="h-3.5 w-3.5" />
              <span>Open CRM Pipeline</span>
            </button>
          )}
        </div>
      </div>

      {/* 4-Card Summary KPI Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-medium text-slate-500">Total Demo Accounts</div>
          <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {summary.totalUsers}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
            {summary.linkedCrmLeads} synced to CRM leads
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-medium text-slate-500">Active Last 7 Days</div>
          <div className="mt-1 font-mono text-2xl font-bold text-[#16A34A] tabular-nums">
            {summary.activeLast7Days}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
            {summary.totalLogins} total logins
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-medium text-slate-500">Sandbox Actions Tracked</div>
          <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {summary.totalActions}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            AI research, CRM edits &amp; map scans
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-medium text-slate-500">Inquiry Conversions</div>
          <div className="mt-1 font-mono text-2xl font-bold text-[var(--gs-primary)] tabular-nums">
            {summary.totalConversions}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Demo users who requested builds
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Search & Engagement Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by full name, email, company, phone, or last action..."
            className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-[var(--gs-primary)] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            aria-label="Filter demo accounts"
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as DemoEngagementFilter)}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-[var(--gs-primary)] focus:outline-none"
          >
            <option value="all">All Demo Accounts ({users.length})</option>
            <option value="active_7d">Active Last 7 Days</option>
            <option value="high_engagement">High Engagement (3+ Actions)</option>
            <option value="converted">Converted to Inquiry</option>
          </select>
        </div>
      </div>

      {/* Demo Users Data Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading && users.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Loading Demo user accounts and engagement telemetry...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="font-display text-sm font-bold text-slate-900">
              No Demo Accounts Match Your Filter
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              When visitors sign up on the public Live Demo page, their contact profile, CRM lead
              link, and sandbox activity appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Visitor &amp; Company</th>
                  <th className="px-4 py-3">Contact &amp; Phone</th>
                  <th className="px-4 py-3">Logins &amp; Actions</th>
                  <th className="px-4 py-3">Modules Explored</th>
                  <th className="px-4 py-3">Last Active &amp; CRM Sync</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3.5 align-top">
                      <button
                        type="button"
                        onClick={() => setSelectedUser(u)}
                        className="text-left font-bold text-slate-900 hover:text-[var(--gs-primary)]"
                      >
                        {u.full_name}
                      </button>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                        <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>{u.company}</span>
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                        Joined {new Date(u.created_at).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 align-top">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-800">
                        <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>{u.email}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
                        <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>{u.phone || '—'}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 align-top font-mono tabular-nums">
                      <div className="font-bold text-slate-900">
                        {u.login_count} logins · {u.actions_count} actions
                      </div>
                      <div className="mt-0.5 font-sans text-[11px] text-slate-500">
                        {u.sandbox_conversions > 0 ? (
                          <span className="font-semibold text-[#16A34A]">
                            {u.sandbox_conversions} real inquiry submitted
                          </span>
                        ) : (
                          <span>Evaluating sandbox</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 align-top max-w-[240px]">
                      <div className="text-[11px] leading-relaxed text-slate-700">
                        {(u.explored_modules || []).length > 0
                          ? (u.explored_modules || []).join(' · ')
                          : 'CRM Pipeline'}
                      </div>
                      {u.last_action_label && (
                        <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                          Last: {u.last_action_label}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 align-top">
                      <div className="font-mono text-[11px] text-slate-700 tabular-nums">
                        {new Date(u.last_active_at || u.created_at).toLocaleString()}
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium">
                        {u.crm_lead_id ? (
                          <span className="inline-flex items-center gap-1 text-[#16A34A]">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>In CRM Pipeline</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">Pending CRM link</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 align-top text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedUser(u)}
                          className="min-h-[36px] whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Inspect
                        </button>
                        {onOpenCrm && (
                          <button
                            type="button"
                            onClick={onOpenCrm}
                            className="min-h-[36px] whitespace-nowrap inline-flex items-center gap-1 rounded-lg bg-[var(--gs-primary)] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                          >
                            <span>Contact</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspect Demo User Detail Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Demo Visitor Telemetry Dossier"
        >
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--gs-primary)]">
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>Live Demo Lead Dossier</span>
                </div>
                <h3 className="mt-1 font-display text-lg font-bold text-slate-900">
                  {selectedUser.full_name}
                </h3>
                <div className="text-xs text-slate-600">{selectedUser.company}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                aria-label="Close demo user dossier"
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold text-slate-500">Corporate Email</div>
                <div className="mt-1 font-mono text-slate-900 break-all">
                  {selectedUser.email}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold text-slate-500">Phone Number</div>
                <div className="mt-1 font-mono text-slate-900">{selectedUser.phone || '—'}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold text-slate-500">Engagement Metrics</div>
                <div className="mt-1 font-mono text-slate-900 tabular-nums">
                  {selectedUser.login_count} logins · {selectedUser.actions_count} sandbox actions ·{' '}
                  {selectedUser.sandbox_conversions} inquiries
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold text-slate-500">Linked CRM Record</div>
                <div className="mt-1 font-mono text-[11px] text-slate-900 truncate">
                  {selectedUser.crm_lead_id || 'Pending sync'}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Sparkles className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
                <span>
                  Explored Sandbox Modules ({(selectedUser.explored_modules || []).length})
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 leading-relaxed">
                {(selectedUser.explored_modules || []).length > 0
                  ? (selectedUser.explored_modules || []).join(' · ')
                  : 'No modules recorded yet.'}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-[11px] text-slate-600 border-t border-slate-200 pt-3">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-slate-400" />
                <span>Last Action: {selectedUser.last_action_label || 'Account Registered'}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:justify-end font-mono tabular-nums">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  {new Date(selectedUser.last_active_at || selectedUser.created_at).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="min-h-[40px] rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              {onOpenCrm && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(null);
                    onOpenCrm();
                  }}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--gs-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--gs-primary-hover)]"
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>Open in CRM &amp; Outreach via Lark Mail</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
