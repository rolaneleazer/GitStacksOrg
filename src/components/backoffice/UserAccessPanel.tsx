import { useState, type FormEvent } from 'react';
import type { UserProfile, UserRole, UserStatus } from '../../shared/types.ts';

interface UserAccessPanelProps {
  currentUserId: string;
  users: UserProfile[];
  onCreateUser: (payload: {
    email: string;
    password: string;
    full_name: string;
    role: UserRole;
    job_title?: string;
  }) => Promise<void>;
  onUpdateUser: (
    userId: string,
    payload: {
      role?: UserRole;
      status?: UserStatus;
      password?: string;
    }
  ) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
}

function generateStrongPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
  let out = 'Gs';
  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  editor: 'Editor',
  support_agent: 'Support Agent'
};

export function UserAccessPanel({
  currentUserId,
  users,
  onCreateUser,
  onUpdateUser,
  onDeleteUser
}: UserAccessPanelProps) {
  const [search, setSearch] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('editor');
  const [jobTitle, setJobTitle] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeSuperAdmins = users.filter((u) => u.role === 'super_admin' && u.status === 'active').length;

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      u.full_name.toLowerCase().includes(q) ||
      u.job_title.toLowerCase().includes(q)
    );
  });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await onCreateUser({
        email: email.trim(),
        password: password.trim(),
        full_name: fullName.trim() || email.split('@')[0],
        role,
        job_title: jobTitle.trim()
      });
      setEmail('');
      setFullName('');
      setJobTitle('');
      setPassword('');
      setRole('editor');
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (userId: string, nextRole: UserRole) => {
    setBusyUserId(userId);
    try {
      await onUpdateUser(userId, { role: nextRole });
    } finally {
      setBusyUserId(null);
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    setBusyUserId(user.user_id);
    try {
      await onUpdateUser(user.user_id, {
        status: user.status === 'active' ? 'suspended' : 'active'
      });
    } finally {
      setBusyUserId(null);
    }
  };

  const handleSaveResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetUserId || resetPassword.trim().length < 8) return;
    setBusyUserId(resetUserId);
    try {
      await onUpdateUser(resetUserId, { password: resetPassword.trim() });
      setResetUserId(null);
      setResetPassword('');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDelete = async (userId: string) => {
    setBusyUserId(userId);
    try {
      await onDeleteUser(userId);
      setConfirmDeleteId(null);
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="text-xs font-semibold text-slate-500">Total Team</div>
          <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{users.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="text-xs font-semibold text-slate-500">Super Admins</div>
          <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {users.filter((u) => u.role === 'super_admin').length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="text-xs font-semibold text-slate-500">Editors</div>
          <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {users.filter((u) => u.role === 'editor').length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="text-xs font-semibold text-slate-500">Support Agents</div>
          <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {users.filter((u) => u.role === 'support_agent').length}
          </div>
        </div>
      </div>

      {/* Role Permissions Reference */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h3 className="text-sm font-bold text-slate-900">Role Access Boundaries</h3>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <div className="font-bold text-slate-900">Super Admin</div>
            <p className="mt-1 leading-relaxed">
              Full platform access: User Access, Branding &amp; Theme, AdSense &amp; Supabase automation, Auto-Routing Rules, and all team workflows.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <div className="font-bold text-slate-900">Editor</div>
            <p className="mt-1 leading-relaxed">
              Content &amp; growth operations: Overview &amp; 7 Agents, Page Content Editor, Articles &amp; Quality Gate, Google Analytics, own workflow queue, and My Profile.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <div className="font-bold text-slate-900">Support Agent</div>
            <p className="mt-1 leading-relaxed">
              Client operations: Lark Mail &amp; Lead Inbox, Live Q&amp;A Chat Box, inquiry/thread ownership, own workflow queue, and My Profile.
            </p>
          </div>
        </div>
      </div>

      {/* Direct Supabase Auth User Provisioning */}
      <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Create Team User (Direct Supabase Auth)</h3>
          <p className="mt-1 text-xs text-slate-600">
            Provision an immediately active team account in Supabase Authentication and assign their Back Office role.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@gitstack.io"
              className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alex Rivera"
              className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Role *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
            >
              <option value="editor">Editor</option>
              <option value="support_agent">Support Agent</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Cloud Solutions Lead"
              className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Initial Password (min 8 chars) *
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter temporary password"
                className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
              />
              <button
                type="button"
                onClick={() => setPassword(generateStrongPassword())}
                className="min-h-[44px] rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
              >
                Generate Password
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={creating}
            className="w-full sm:w-auto min-h-[44px] rounded-lg bg-[var(--gs-primary)] hover:bg-[var(--gs-primary-hover)] px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
          >
            {creating ? 'Creating User...' : 'Create Team Account'}
          </button>
        </div>
      </form>

      {/* Team Directory & Access Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">Team Directory & Permissions</h3>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or title..."
            className="w-full sm:w-72 min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
          />
        </div>

        <div className="space-y-3">
          {filteredUsers.map((u) => {
            const isSelf = u.user_id === currentUserId;
            const isLastAdmin =
              u.role === 'super_admin' && u.status === 'active' && activeSuperAdmins <= 1;
            const isBusy = busyUserId === u.user_id;

            const initials = (u.full_name || u.email)
              .split(/\s+/)
              .slice(0, 2)
              .map((s) => s[0]?.toUpperCase() || '')
              .join('');

            return (
              <div
                key={u.user_id}
                className="rounded-xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  {u.avatar_url ? (
                    <img
                      src={u.avatar_url}
                      alt={u.full_name || u.email}
                      referrerPolicy="no-referrer"
                      className="h-11 w-11 rounded-full border border-slate-200 object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-full text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: 'var(--gs-primary)' }}
                    >
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 truncate">
                        {u.full_name || u.email.split('@')[0]}
                      </span>
                      {isSelf && (
                        <span className="text-[11px] font-semibold text-[var(--gs-primary)]">
                          (You)
                        </span>
                      )}
                      <span className="text-xs text-slate-400">·</span>
                      <span
                        className={`text-xs font-semibold ${
                          u.status === 'active' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {u.status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 truncate">
                      {u.email}
                      {u.job_title ? ` · ${u.job_title}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap items-stretch sm:items-center gap-2">
                  <select
                    aria-label={`Role for ${u.email}`}
                    disabled={isBusy || isLastAdmin}
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.user_id, e.target.value as UserRole)}
                    className="min-h-[44px] sm:min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-60"
                  >
                    {(['super_admin', 'editor', 'support_agent'] as const).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={isBusy || isSelf || isLastAdmin}
                    onClick={() => handleToggleStatus(u)}
                    className="min-h-[44px] sm:min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                  >
                    {u.status === 'active' ? 'Suspend' : 'Activate'}
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      setResetUserId(resetUserId === u.user_id ? null : u.user_id);
                      setResetPassword('');
                    }}
                    className="min-h-[44px] sm:min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Reset Password
                  </button>

                  {confirmDeleteId === u.user_id ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDelete(u.user_id)}
                        className="min-h-[44px] sm:min-h-[38px] rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 whitespace-nowrap"
                      >
                        Confirm Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-[44px] sm:min-h-[38px] rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy || isSelf || isLastAdmin}
                      onClick={() => setConfirmDeleteId(u.user_id)}
                      className="min-h-[44px] sm:min-h-[38px] rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-40 whitespace-nowrap"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filteredUsers.length === 0 && (
            <p className="text-sm text-slate-500 py-6 text-center">No team members match your search.</p>
          )}
        </div>

        {resetUserId && (
          <form
            onSubmit={handleSaveResetPassword}
            className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row gap-3 sm:items-center"
          >
            <div className="flex-1">
              <div className="text-xs font-semibold text-slate-800 mb-1">
                Set New Password for {users.find((x) => x.user_id === resetUserId)?.email}
              </div>
              <input
                type="text"
                required
                minLength={8}
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="New password (8+ characters)"
                className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busyUserId === resetUserId}
                className="min-h-[44px] rounded-lg bg-[var(--gs-primary)] hover:bg-[var(--gs-primary-hover)] px-4 py-2 text-xs font-semibold text-white whitespace-nowrap"
              >
                Update Password
              </button>
              <button
                type="button"
                onClick={() => setResetUserId(null)}
                className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
