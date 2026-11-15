import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type { UserProfile } from '../../shared/types.ts';

interface ProfilePanelProps {
  profile: UserProfile;
  onSaveProfile: (
    updates: Partial<Pick<UserProfile, 'full_name' | 'job_title' | 'bio' | 'avatar_url' | 'phone' | 'timezone'>>
  ) => Promise<void>;
  saving: boolean;
}

const MAX_AVATAR_BYTES = 900 * 1024;

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Manila',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney'
];

export function ProfilePanel({ profile, onSaveProfile, saving }: ProfilePanelProps) {
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [jobTitle, setJobTitle] = useState(profile.job_title || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [timezone, setTimezone] = useState(profile.timezone || 'UTC');
  const [bio, setBio] = useState(profile.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(profile.full_name || '');
    setJobTitle(profile.job_title || '');
    setPhone(profile.phone || '');
    setTimezone(profile.timezone || 'UTC');
    setBio(profile.bio || '');
    setAvatarUrl(profile.avatar_url || '');
  }, [profile]);

  const handleAvatarUpload = (e: ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a PNG, JPG, or WebP profile picture.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setUploadError('Profile image must be under 900 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSaveProfile({
      full_name: fullName.trim() || profile.email.split('@')[0],
      job_title: jobTitle.trim(),
      phone: phone.trim(),
      timezone: timezone.trim() || 'UTC',
      bio: bio.trim(),
      avatar_url: avatarUrl.trim()
    });
  };

  const initials = (fullName || profile.email || 'GS')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const roleLabel =
    profile.role === 'super_admin'
      ? 'Super Admin'
      : profile.role === 'editor'
        ? 'Editor'
        : 'Support Agent';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">My Profile & Picture</h2>
        <p className="mt-1 text-sm text-slate-600">
          Update your display information, engineering role details, and avatar photo shown across the Back Office team workspace.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-5 border-b border-slate-200 pb-6">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName || profile.email}
              referrerPolicy="no-referrer"
              className="h-20 w-20 rounded-full border border-slate-200 object-cover shrink-0"
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-xl font-bold text-white shrink-0"
              style={{ backgroundColor: 'var(--gs-primary)' }}
            >
              {initials}
            </div>
          )}

          <div className="flex-1 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">{profile.email}</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[var(--gs-primary)]">{roleLabel}</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap">
                Upload Profile Picture
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarUpload}
                  className="sr-only"
                />
              </label>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="min-h-[44px] rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 whitespace-nowrap"
                >
                  Remove Picture
                </button>
              )}
            </div>
            {uploadError && <p className="text-xs font-medium text-rose-700">{uploadError}</p>}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
            <input
              type="text"
              required
              maxLength={80}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Job Title / Role</label>
            <input
              type="text"
              maxLength={80}
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Principal Architect"
              className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Contact Phone</label>
            <input
              type="tel"
              maxLength={40}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 234-5678"
              className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Preferred Timezone</label>
            <select
              value={COMMON_TIMEZONES.includes(timezone) ? timezone : 'UTC'}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Avatar Image URL (Optional)</label>
          <input
            type="text"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://... or upload an image file above"
            className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
          />
        </div>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bio & Responsibilities</label>
          <textarea
            rows={4}
            maxLength={600}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Describe your engineering focus, editorial beat, or support queue ownership..."
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
          />
        </div>

        <div className="mt-6 flex flex-col sm:flex-row sm:justify-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto min-h-[44px] rounded-lg bg-[var(--gs-primary)] hover:bg-[var(--gs-primary-hover)] px-6 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving Profile...' : 'Save My Profile'}
          </button>
        </div>
      </div>
    </form>
  );
}
