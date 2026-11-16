import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import type { UserProfile } from '../../shared/types.ts';

interface ProfilePanelProps {
  profile: UserProfile;
  onSaveProfile: (
    updates: Partial<
      Pick<UserProfile, 'full_name' | 'job_title' | 'bio' | 'avatar_url' | 'phone' | 'timezone'>
    >
  ) => Promise<void>;
  saving: boolean;
}

const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB source accepted; resized to <= 40 KB 256x256 avatar

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

function resizeAvatarImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read selected image file.'));
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      if (!src) {
        reject(new Error('Selected image appears empty.'));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported or corrupted image file.'));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        // Center-crop square cover fit
        const minSide = Math.min(img.width, img.height);
        const sx = Math.max(0, Math.round((img.width - minSide) / 2));
        const sy = Math.max(0, Math.round((img.height - minSide) / 2));
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

        const webpUrl = canvas.toDataURL('image/webp', 0.86);
        if (webpUrl.startsWith('data:image/webp') && webpUrl.length < 220_000) {
          resolve(webpUrl);
          return;
        }
        const jpegUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(jpegUrl);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export function ProfilePanel({ profile, onSaveProfile, saving }: ProfilePanelProps) {
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [jobTitle, setJobTitle] = useState(profile.job_title || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [timezone, setTimezone] = useState(profile.timezone || 'UTC');
  const [bio, setBio] = useState(profile.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processingUpload, setProcessingUpload] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  useEffect(() => {
    setFullName(profile.full_name || '');
    setJobTitle(profile.job_title || '');
    setPhone(profile.phone || '');
    setTimezone(profile.timezone || 'UTC');
    setBio(profile.bio || '');
    setAvatarUrl(profile.avatar_url || '');
    setAvatarImgFailed(false);
  }, [profile]);

  const timezoneOptions = useMemo(() => {
    const tz = (timezone || 'UTC').trim() || 'UTC';
    return Array.from(new Set([...COMMON_TIMEZONES, tz]));
  }, [timezone]);

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setSaveFeedback(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a PNG, JPG, or WebP profile picture.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      setUploadError('Source image must be under 10 MB.');
      e.target.value = '';
      return;
    }
    setProcessingUpload(true);
    try {
      const optimized = await resizeAvatarImage(file);
      setAvatarUrl(optimized);
      setAvatarImgFailed(false);
      setSaveFeedback({
        type: 'ok',
        text: 'Picture optimized (256×256). Click "Save My Profile" below to persist.'
      });
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Unable to optimize the selected profile picture.'
      );
    } finally {
      setProcessingUpload(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveFeedback(null);
    setUploadError(null);
    try {
      await onSaveProfile({
        full_name: fullName.trim() || profile.email.split('@')[0],
        job_title: jobTitle.trim(),
        phone: phone.trim(),
        timezone: timezone.trim() || 'UTC',
        bio: bio.trim(),
        avatar_url: avatarUrl.trim()
      });
      setSaveFeedback({
        type: 'ok',
        text: 'Your profile details and picture have been saved.'
      });
    } catch (err) {
      setSaveFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save your profile changes.'
      });
    }
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
        <h2 className="text-lg font-bold text-slate-900">My Profile &amp; Picture</h2>
        <p className="mt-1 text-sm text-slate-600">
          Update your display information, engineering role details, and avatar photo shown across
          the Back Office team workspace. Large images are automatically cropped and optimized.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-5 border-b border-slate-200 pb-6">
          {avatarUrl && !avatarImgFailed ? (
            <img
              src={avatarUrl}
              alt={fullName || profile.email}
              referrerPolicy="no-referrer"
              onError={() => setAvatarImgFailed(true)}
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
                {processingUpload ? 'Optimizing Picture...' : 'Upload Profile Picture'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={processingUpload}
                  onChange={handleAvatarUpload}
                  className="sr-only"
                />
              </label>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setAvatarUrl('');
                    setAvatarImgFailed(false);
                    setSaveFeedback(null);
                  }}
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
            <label htmlFor="profile-full-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Full Name
            </label>
            <input
              id="profile-full-name"
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
            <label htmlFor="profile-job-title" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Job Title / Role
            </label>
            <input
              id="profile-job-title"
              type="text"
              maxLength={80}
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Principal Architect"
              className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
            />
          </div>

          <div>
            <label htmlFor="profile-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Contact Phone
            </label>
            <input
              id="profile-phone"
              type="tel"
              maxLength={40}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 234-5678"
              className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
            />
          </div>

          <div>
            <label htmlFor="profile-timezone" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Preferred Timezone
            </label>
            <select
              id="profile-timezone"
              value={timezone || 'UTC'}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
            >
              {timezoneOptions.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="profile-avatar-url" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Avatar Image URL (Optional)
          </label>
          <input
            id="profile-avatar-url"
            type="text"
            value={avatarUrl}
            onChange={(e) => {
              setAvatarUrl(e.target.value);
              setAvatarImgFailed(false);
            }}
            placeholder="https://... or upload an image file above"
            className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
          />
        </div>

        <div className="mt-4">
          <label htmlFor="profile-bio" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Bio &amp; Responsibilities
          </label>
          <textarea
            id="profile-bio"
            rows={4}
            maxLength={600}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Describe your engineering focus, editorial beat, or support queue ownership..."
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--gs-primary)]"
          />
        </div>

        {saveFeedback && (
          <div
            role={saveFeedback.type === 'err' ? 'alert' : 'status'}
            className={`mt-5 flex items-start gap-2 rounded-lg border px-4 py-3 text-xs font-medium ${
              saveFeedback.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            {saveFeedback.type === 'ok' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" />
            )}
            <span>{saveFeedback.text}</span>
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row sm:justify-end">
          <button
            type="submit"
            disabled={saving || processingUpload}
            className="w-full sm:w-auto min-h-[44px] rounded-lg bg-[var(--gs-primary)] hover:bg-[var(--gs-primary-hover)] px-6 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving Profile...' : 'Save My Profile'}
          </button>
        </div>
      </div>
    </form>
  );
}

