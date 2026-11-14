import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2
} from 'lucide-react';
import React, { useState } from 'react';
import type { AgentId, AgentReport, AgentTask, TaskPriority } from '../../shared/types.ts';

interface AgentsWorkspaceProps {
  agents: AgentReport[];
  tasks: AgentTask[];
  loading: boolean;
  onRefresh: () => void;
  onJumpToSection: (section: string) => void;
  onCreateTask: (payload: {
    agent_id: AgentId;
    title: string;
    priority: TaskPriority;
    notes?: string;
  }) => Promise<void>;
  onToggleTask: (task: AgentTask) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
}

const STATUS_LABEL: Record<'healthy' | 'attention' | 'critical', { text: string; cls: string }> = {
  healthy: { text: 'Nominal', cls: 'text-[#16A34A]' },
  attention: { text: 'Attention Needed', cls: 'text-[#D97706]' },
  critical: { text: 'Action Required', cls: 'text-[#DC2626]' }
};

export function AgentsWorkspace({
  agents,
  tasks,
  loading,
  onRefresh,
  onJumpToSection,
  onCreateTask,
  onToggleTask,
  onDeleteTask
}: AgentsWorkspaceProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId>('ceo');
  const [ruleFilter, setRuleFilter] = useState<'all' | 'attention'>('all');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [savingTask, setSavingTask] = useState(false);

  const activeAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];
  const agentTasks = tasks.filter((t) => t.agent_id === (activeAgent?.id || selectedAgentId));

  const visibleChecks = (activeAgent?.checks || []).filter((c) =>
    ruleFilter === 'attention' ? c.status !== 'pass' : true
  );

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !activeAgent) return;
    setSavingTask(true);
    try {
      await onCreateTask({
        agent_id: activeAgent.id,
        title: newTaskTitle.trim(),
        priority: newTaskPriority
      });
      setNewTaskTitle('');
    } finally {
      setSavingTask(false);
    }
  };

  if (loading && agents.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl border border-slate-200 bg-white animate-pulse" />
        <div className="h-72 rounded-xl border border-slate-200 bg-white animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            7 Ready Operational Agents (Deterministic Site Auditors)
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Rule-based verification across marketing, executive KPIs, booking SLA, cybersecurity,
            QA, Google AdSense policy, and traffic growth.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Run Live Audit</span>
        </button>
      </div>

      {/* 7-Agent Selector Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {agents.map((agent) => {
          const isSelected = activeAgent?.id === agent.id;
          const st = STATUS_LABEL[agent.status];
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => setSelectedAgentId(agent.id)}
              className={`rounded-xl border p-3.5 text-left transition-colors ${
                isSelected
                  ? 'border-[#1E40AF] bg-blue-50/40'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 truncate">{agent.name}</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                  {agent.score}%
                </span>
                <span className={`text-[11px] font-semibold ${st.cls}`}>{st.text}</span>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500 line-clamp-2">{agent.role}</p>
            </button>
          );
        })}
      </div>

      {/* Selected Agent Workspace */}
      {activeAgent && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Deterministic Rule Checks (7 cols) */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-[#1E40AF]">{activeAgent.name}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeAgent.role}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  {activeAgent.summary}
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setRuleFilter('all')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    ruleFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  All Rules ({activeAgent.checks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRuleFilter('attention')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    ruleFilter === 'attention'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Needs Attention
                </button>
              </div>
            </div>

            <div className="mt-4 divide-y divide-slate-200">
              {visibleChecks.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  All diagnostic checks for {activeAgent.name} are passing.
                </div>
              ) : (
                visibleChecks.map((check) => (
                  <div key={check.id} className="py-3.5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-2.5">
                      {check.status === 'pass' ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" />
                      ) : check.status === 'warning' ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D97706]" />
                      ) : (
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" />
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-900">
                          <span>{check.label}</span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="font-mono font-normal text-slate-600 tabular-nums">
                            {check.metric}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                          {check.detail}
                        </p>
                      </div>
                    </div>
                    {check.targetTab && check.actionLabel && (
                      <button
                        type="button"
                        onClick={() => onJumpToSection(check.targetTab!)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#1E40AF] hover:bg-blue-50 whitespace-nowrap shrink-0"
                      >
                        {check.actionLabel}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Persisted Agent Action Checklist (5 cols) */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 flex flex-col justify-between">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900">
                {activeAgent.name} Action Checklist ({agentTasks.filter((t) => !t.completed).length}{' '}
                open)
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Track operator tasks saved directly to your workspace database.
              </p>

              <form onSubmit={handleAddTask} className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder={`Add ${activeAgent.name} action item...`}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#1E40AF] focus:outline-none"
                />
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                  className="rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-700"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <button
                  type="submit"
                  disabled={savingTask || !newTaskTitle.trim()}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#1E40AF] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </form>

              <div className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
                {agentTasks.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    No tasks logged for {activeAgent.name} yet.
                  </p>
                ) : (
                  agentTasks.map((task) => (
                    <div key={task.id} className="py-3 flex items-start justify-between gap-3">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => onToggleTask(task)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1E40AF]"
                        />
                        <div>
                          <span
                            className={`text-xs font-medium ${
                              task.completed ? 'line-through text-slate-400' : 'text-slate-900'
                            }`}
                          >
                            {task.title}
                          </span>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            Priority: <span className="capitalize">{task.priority}</span>
                            {task.notes && ` · ${task.notes}`}
                          </div>
                        </div>
                      </label>
                      <button
                        type="button"
                        onClick={() => onDeleteTask(task.id)}
                        aria-label={`Delete task ${task.title}`}
                        className="text-slate-400 hover:text-red-700 p-1 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
