import { useEffect, useState, type FormEvent } from 'react';
import type {
  ChatThread,
  ClientInquiry,
  DirectoryUser,
  RoutingRule,
  TaskPriority,
  UserRole,
  UserWorkflowItem,
  WorkflowCategory,
  WorkflowStatus
} from '../../shared/types.ts';

interface UserWorkflowsPanelProps {
  currentUserId: string;
  currentUserRole: UserRole;
  directory: DirectoryUser[];
  workflows: UserWorkflowItem[];
  inquiries: ClientInquiry[];
  chatThreads: ChatThread[];
  routingRules: RoutingRule[];
  onCreateWorkflow: (payload: Partial<UserWorkflowItem>) => Promise<void>;
  onUpdateWorkflow: (id: string, patch: Partial<UserWorkflowItem>) => Promise<void>;
  onDeleteWorkflow: (id: string) => Promise<void>;
  onAssignInquiry: (inquiryId: string, assignedTo: string | null) => Promise<void>;
  onAssignThread: (threadId: string, assignedTo: string | null) => Promise<void>;
  onSaveRoutingRules: (rules: RoutingRule[]) => Promise<void>;
  onOpenChatThread: (threadId: string) => void;
}

const CATEGORY_LABELS: Record<WorkflowCategory, string> = {
  onboarding: 'Onboarding',
  daily_checklist: 'Daily Checklist',
  project_task: 'Project Task',
  follow_up: 'Client Follow-up'
};

export function UserWorkflowsPanel({
  currentUserId,
  currentUserRole,
  directory,
  workflows,
  inquiries,
  chatThreads,
  routingRules,
  onCreateWorkflow,
  onUpdateWorkflow,
  onDeleteWorkflow,
  onAssignInquiry,
  onAssignThread,
  onSaveRoutingRules,
  onOpenChatThread
}: UserWorkflowsPanelProps) {
  const isSuperAdmin = currentUserRole === 'super_admin';
  const [subTab, setSubTab] = useState<'queues' | 'routing'>('queues');
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUserId);
  const [statusFilter, setStatusFilter] = useState<'all' | WorkflowStatus>('all');

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<WorkflowCategory>('project_task');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const [draftRules, setDraftRules] = useState<RoutingRule[]>(routingRules);
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    setDraftRules(routingRules);
  }, [routingRules]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setSelectedUserId(currentUserId);
    }
  }, [isSuperAdmin, currentUserId]);

  const activeUsers = directory.filter((u) => u.status === 'active');
  const targetUser = directory.find((u) => u.user_id === selectedUserId);

  const userTasks = workflows.filter((w) => {
    if (w.user_id !== selectedUserId) return false;
    if (statusFilter !== 'all' && w.status !== statusFilter) return false;
    return true;
  });

  const userAllTasksCount = workflows.filter((w) => w.user_id === selectedUserId);
  const completedCount = userAllTasksCount.filter((w) => w.status === 'done').length;
  const openCount = userAllTasksCount.length - completedCount;

  const assignedInquiries = inquiries.filter((i) => i.assigned_to === selectedUserId);
  const assignedChats = chatThreads.filter((t) => t.assigned_to === selectedUserId);

  const handleAddWorkflow = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await onCreateWorkflow({
        user_id: selectedUserId,
        title: newTitle.trim(),
        category: newCategory,
        priority: newPriority,
        due_date: newDueDate || null,
        description: newDescription.trim(),
        status: 'todo'
      });
      setNewTitle('');
      setNewDescription('');
      setNewDueDate('');
    } finally {
      setCreating(false);
    }
  };

  const handleRuleChange = (
    ruleId: string,
    patch: Partial<Pick<RoutingRule, 'assignee_user_id' | 'enabled'>>
  ) => {
    setDraftRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)));
  };

  const handleSaveRules = async () => {
    setSavingRules(true);
    try {
      await onSaveRoutingRules(draftRules);
    } finally {
      setSavingRules(false);
    }
  };

  const canReassignQueues = isSuperAdmin || currentUserRole === 'support_agent';

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex w-full sm:w-fit flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5">
        <button
          type="button"
          onClick={() => setSubTab('queues')}
          className={`min-h-[44px] sm:min-h-[38px] rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            subTab === 'queues'
              ? 'bg-[var(--gs-primary)] text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          User Queues &amp; Tasks
        </button>
        <button
          type="button"
          onClick={() => setSubTab('routing')}
          className={`min-h-[44px] sm:min-h-[38px] rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            subTab === 'routing'
              ? 'bg-[var(--gs-primary)] text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          Auto-Routing Rules
        </button>
      </div>

      {subTab === 'queues' ? (
        <div className="space-y-6">
          {/* Operator Selector + Metrics */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {isSuperAdmin ? 'Team Workflow Workspace' : 'My Assigned Workflow Queue'}
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Manage per-user operational checklists, project deliverables, assigned client inquiries, and live Q&amp;A threads.
                </p>
              </div>
              {isSuperAdmin && (
                <div className="w-full sm:w-72">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Viewing Queue For
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
                  >
                    {directory.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.full_name || u.email} ({u.role.replace('_', ' ')})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <div className="text-xs font-semibold text-slate-500">Open Tasks</div>
                <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums">{openCount}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <div className="text-xs font-semibold text-slate-500">Completed Tasks</div>
                <div className="mt-1 text-xl font-bold text-emerald-700 tabular-nums">{completedCount}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <div className="text-xs font-semibold text-slate-500">Assigned Inquiries</div>
                <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums">
                  {assignedInquiries.length}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <div className="text-xs font-semibold text-slate-500">Assigned Q&amp;A Chats</div>
                <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums">
                  {assignedChats.length}
                </div>
              </div>
            </div>
          </div>

          {/* Add Task / Checklist Item */}
          <form onSubmit={handleAddWorkflow} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Assign New Task for {targetUser?.full_name || targetUser?.email || 'Selected User'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Task or checklist title..."
                className="sm:col-span-2 min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as WorkflowCategory)}
                className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-800"
              />
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional notes or acceptance criteria..."
                className="sm:col-span-2 min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="w-full sm:w-auto min-h-[44px] rounded-lg bg-[var(--gs-primary)] hover:bg-[var(--gs-primary-hover)] px-5 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60"
              >
                {creating ? 'Adding Task...' : 'Add Workflow Task'}
              </button>
            </div>
          </form>

          {/* Checklist & Task Queue */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-base font-bold text-slate-900">Tasks &amp; Checklists</h3>
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'todo', 'in_progress', 'done'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      statusFilter === st
                        ? 'bg-[var(--gs-primary)] text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {st === 'all'
                      ? 'All'
                      : st === 'todo'
                        ? 'To Do'
                        : st === 'in_progress'
                          ? 'In Progress'
                          : 'Done'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {userTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">
                        {CATEGORY_LABELS[task.category]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-semibold ${
                          task.priority === 'high'
                            ? 'text-rose-700'
                            : task.priority === 'medium'
                              ? 'text-amber-700'
                              : 'text-slate-600'
                        }`}
                      >
                        {task.priority.toUpperCase()}
                      </span>
                      {task.due_date && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">Due {task.due_date}</span>
                        </>
                      )}
                    </div>
                    <p
                      className={`mt-1 text-sm font-semibold ${
                        task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="mt-1 text-xs text-slate-600">{task.description}</p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    <select
                      aria-label={`Status for ${task.title}`}
                      value={task.status}
                      onChange={(e) =>
                        onUpdateWorkflow(task.id, { status: e.target.value as WorkflowStatus })
                      }
                      className="min-h-[44px] sm:min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => onDeleteWorkflow(task.id)}
                      className="min-h-[44px] sm:min-h-[38px] rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {userTasks.length === 0 && (
                <p className="text-sm text-slate-500 py-5 text-center">
                  No workflow tasks in this view yet. Add a task above to start tracking.
                </p>
              )}
            </div>
          </div>

          {/* Assigned Client Inquiries & Chat Threads */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-3">
              <h3 className="text-base font-bold text-slate-900">
                Assigned Client Inquiries ({assignedInquiries.length})
              </h3>
              {assignedInquiries.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">
                  No client inquiries are currently routed to this team member.
                </p>
              ) : (
                <div className="space-y-3">
                  {assignedInquiries.map((inq) => (
                    <div key={inq.id} className="rounded-lg border border-slate-200 p-3.5 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-slate-900">
                          {inq.full_name} · {inq.company}
                        </span>
                        <span className="font-mono text-slate-500">{inq.reference_code}</span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">{inq.project_brief}</p>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                        <span className="text-[11px] font-semibold text-[var(--gs-primary)]">
                          {inq.service_interest} · {inq.status.toUpperCase()}
                        </span>
                        {canReassignQueues && (
                          <select
                            aria-label={`Owner for inquiry ${inq.reference_code}`}
                            value={inq.assigned_to || ''}
                            onChange={(e) => onAssignInquiry(inq.id, e.target.value || null)}
                            className="min-h-[40px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800"
                          >
                            <option value="">Unassigned</option>
                            {activeUsers.map((u) => (
                              <option key={u.user_id} value={u.user_id}>
                                {u.full_name || u.email}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-3">
              <h3 className="text-base font-bold text-slate-900">
                Assigned Q&amp;A Chat Threads ({assignedChats.length})
              </h3>
              {assignedChats.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">
                  No chat threads are currently assigned to this team member.
                </p>
              ) : (
                <div className="space-y-3">
                  {assignedChats.map((thr) => (
                    <div key={thr.id} className="rounded-lg border border-slate-200 p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenChatThread(thr.id)}
                          className="text-left text-xs font-bold text-slate-900 hover:text-[var(--gs-primary)]"
                        >
                          {thr.subject}
                        </button>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase shrink-0">
                          {thr.status}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <span className="text-[11px] text-slate-500">{thr.requester_name}</span>
                        {canReassignQueues && (
                          <select
                            aria-label={`Owner for chat ${thr.subject}`}
                            value={thr.assigned_to || ''}
                            onChange={(e) => onAssignThread(thr.id, e.target.value || null)}
                            className="min-h-[40px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800"
                          >
                            <option value="">Unassigned</option>
                            {activeUsers.map((u) => (
                              <option key={u.user_id} value={u.user_id}>
                                {u.full_name || u.email}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Deterministic Auto-Routing Rules */
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Deterministic Lead &amp; Chat Auto-Routing</h2>
              <p className="mt-1 text-xs text-slate-600">
                Incoming client inquiries and comment Q&amp;A threads automatically assign to the designated active specialist without external AI latency.
              </p>
            </div>
            {isSuperAdmin && (
              <button
                type="button"
                disabled={savingRules}
                onClick={handleSaveRules}
                className="w-full sm:w-auto min-h-[44px] rounded-lg bg-[var(--gs-primary)] hover:bg-[var(--gs-primary-hover)] px-5 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                {savingRules ? 'Saving Rules...' : 'Save Routing Rules'}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {draftRules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase">
                    {rule.source_type === 'inquiry' ? 'Client Inquiry Service' : 'Q&A Chat Source'}
                  </div>
                  <div className="mt-0.5 text-sm font-bold text-slate-900">
                    {rule.match_key === 'default' ? 'Fallback Default Owner' : rule.match_key}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 min-h-[38px]">
                    <input
                      type="checkbox"
                      disabled={!isSuperAdmin}
                      checked={rule.enabled}
                      onChange={(e) => handleRuleChange(rule.id, { enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Active
                  </label>
                  <select
                    disabled={!isSuperAdmin}
                    value={rule.assignee_user_id || ''}
                    onChange={(e) =>
                      handleRuleChange(rule.id, { assignee_user_id: e.target.value || null })
                    }
                    className="w-full sm:w-64 min-h-[44px] sm:min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-60"
                  >
                    <option value="">Leave Unassigned</option>
                    {activeUsers.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.full_name || u.email} ({u.role.replace('_', ' ')})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
