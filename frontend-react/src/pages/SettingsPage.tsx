import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  User, LogOut, Trash2, Shield, Pencil, Check, X,
  Sun, Moon, Globe, Eye, Loader2, Lock, Bell, Crown,
  EyeOff, BookOpen, Bookmark, Clock, ChevronRight,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import { SUPPORTED_LANGS } from '@/i18n/config';
import { cn } from '@/lib/utils';
import type { NotificationPreferences } from '@/types';

const LEVELS = ['debutant', 'intermediaire', 'avance'] as const;
const LOGBOOK_VISIBILITY = ['public', 'friends', 'private'] as const;

// ─── Reusable sub-components ───────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
  danger,
  open,
  onToggle,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={cn(
      'mb-3 rounded-[var(--radius-md)] border bg-surface shadow-soft overflow-hidden',
      danger ? 'border-red-200 dark:border-red-800/40' : 'border-border-subtle',
    )}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left transition-colors',
          'hover:bg-surface-2/60',
          open && 'border-b border-border-subtle',
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0', danger ? 'text-red-500 dark:text-red-400' : 'text-sage')} />
        <span className={cn(
          'flex-1 text-sm font-semibold',
          danger ? 'text-red-600 dark:text-red-400' : 'text-text-primary',
        )}>
          {title}
        </span>
        <ChevronRight className={cn(
          'h-4 w-4 shrink-0 text-text-secondary/50 transition-transform duration-200',
          open && 'rotate-90',
        )} />
      </button>
      {open && (
        <div className="px-5 py-4">
          {children}
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description && <p className="text-xs text-text-secondary">{description}</p>}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 cursor-pointer rounded-full overflow-hidden transition-colors duration-300 disabled:opacity-50',
          checked ? 'bg-sage' : 'bg-text-secondary/30',
        )}
      >
        <span className={cn(
          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300',
          checked ? 'translate-x-5' : 'translate-x-0',
        )} />
      </button>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, user, isAdmin, logout, updateUser } = useAuthStore();
  const { theme, toggle: toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  // ── Accordéon ──
  const [openSection, setOpenSection] = useState<string | null>(null);
  const toggle = (id: string) => setOpenSection((s) => (s === id ? null : id));

  // ── Section 1: Profil ──
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    username: '',
    bio: '',
    level: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // ── Section 5: Sécurité ──
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');

  // ── Section 7: Compte ──
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── Auto-save for toggles ──
  const [savingField, setSavingField] = useState<string | null>(null);

  // ── Auto-save patch — must be before any early return ──
  const autoPatch = useCallback(async (field: string, body: Record<string, unknown>) => {
    setSavingField(field);
    try {
      await apiFetch('/api/users/me', { method: 'PATCH', auth: true, body: JSON.stringify(body) });
    } catch {
      toast.error(t('common.error'));
    }
    setSavingField(null);
  }, [t]);

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <User className="mb-4 h-12 w-12 text-text-secondary/40" />
        <h2 className="font-heading text-xl font-bold text-text-primary">{t('settings.title')}</h2>
        <p className="mt-2 text-sm text-text-secondary">{t('settings.login_prompt')}</p>
        <Link
          to="/login?next=/settings"
          className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-sage px-5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-sage-hover"
        >
          {t('auth.login')}
        </Link>
      </div>
    );
  }

  const level = user.profile?.level;
  const bio = user.profile?.bio;
  const isPrivate = user.privacy?.isPrivate ?? false;
  const logbookVisibility = user.privacy?.logbookVisibility ?? 'public';
  const notifPrefs: NotificationPreferences = user.notificationPreferences ?? {};
  const quietMode = notifPrefs.quietMode ?? { enabled: false, startHour: 22, endHour: 7 };

  // ── Profile edit ──
  function startEditProfile() {
    setProfileForm({
      displayName: user!.displayName,
      username: user!.username || '',
      bio: bio || '',
      level: level || 'debutant',
    });
    setEditingProfile(true);
  }

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const data = await apiFetch<Record<string, unknown>>('/api/users/me', {
        method: 'PATCH',
        auth: true,
        body: JSON.stringify({
          displayName: profileForm.displayName.trim(),
          username: profileForm.username.trim().toLowerCase(),
          bio: profileForm.bio.trim() || null,
          level: profileForm.level,
        }),
      });
      updateUser({
        displayName: (data.displayName as string) || profileForm.displayName,
        username: (data.username as string) || profileForm.username,
        profile: {
          level: profileForm.level,
          bio: profileForm.bio.trim() || undefined,
        },
      });
      setEditingProfile(false);
      toast.success(t('settings.saved'));
    } catch {
      toast.error(t('common.error'));
    }
    setSavingProfile(false);
  }

  async function handleAvatarUpload(file: File) {
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const data = await apiFetch<Record<string, unknown>>('/api/users/me/avatar', {
        method: 'POST', auth: true, body: form,
      });
      updateUser({ avatarUrl: (data.avatarUrl as string | undefined) ?? undefined });
      toast.success(t('settings.saved'));
    } catch {
      toast.error(t('common.error'));
    }
    setUploadingAvatar(false);
  }

  async function handleAvatarDelete() {
    setUploadingAvatar(true);
    try {
      await apiFetch('/api/users/me/avatar', { method: 'DELETE', auth: true });
      updateUser({ avatarUrl: undefined });
      toast.success(t('settings.saved'));
    } catch {
      toast.error(t('common.error'));
    }
    setUploadingAvatar(false);
  }

  async function togglePrivate(v: boolean) {
    updateUser({ privacy: { ...user!.privacy, isPrivate: v } });
    await autoPatch('isPrivate', { isPrivate: v });
  }

  async function changeLogbookVisibility(v: string) {
    updateUser({ privacy: { ...user!.privacy, logbookVisibility: v as 'public' | 'friends' | 'private' } });
    await autoPatch('logbookVisibility', { logbookVisibility: v });
  }

  async function toggleNotif(key: keyof NotificationPreferences, value: boolean) {
    updateUser({
      notificationPreferences: { ...notifPrefs, [key]: value },
    });
    await autoPatch(`notif_${key}`, { notificationPreferences: { [key]: value } });
  }

  async function toggleQuietMode(v: boolean) {
    const updated = { ...quietMode, enabled: v };
    updateUser({ notificationPreferences: { ...notifPrefs, quietMode: updated } });
    await autoPatch('quietMode', { notificationPreferences: { quietMode: { enabled: v } } });
  }

  async function changeQuietHour(field: 'startHour' | 'endHour', v: number) {
    const updated = { ...quietMode, [field]: v };
    updateUser({ notificationPreferences: { ...notifPrefs, quietMode: updated } });
    await autoPatch(`quietMode_${field}`, { notificationPreferences: { quietMode: { [field]: v } } });
  }

  // ── Change password ──
  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    if (!pwForm.current) { setPwError(t('settings.pw_required')); return; }
    if (pwForm.next.length < 12) { setPwError(t('settings.pw_too_short')); return; }
    if (pwForm.next !== pwForm.confirm) { setPwError(t('settings.pw_mismatch')); return; }
    setPwSaving(true);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'PATCH',
        auth: true,
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      setPwForm({ current: '', next: '', confirm: '' });
      toast.success(t('settings.pw_changed'));
    } catch {
      setPwError(t('settings.pw_wrong_current'));
    }
    setPwSaving(false);
  }

  // ── Delete account ──
  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await apiFetch(`/api/users/${user!._id}`, { method: 'DELETE', auth: true });
      logout();
      navigate('/');
      toast.success(t('settings.account_deleted'));
    } catch {
      toast.error(t('common.error'));
    }
    setDeleting(false);
    setConfirmDelete(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 md:pb-8">
      <h1 className="mb-6 font-heading text-2xl font-bold text-text-primary">
        {t('settings.title')}
      </h1>

      {/* ── 1. Mon Profil ─────────────────────────────── */}
      <Section icon={User} title={t('settings.section_profile')} open={openSection === 'profile'} onToggle={() => toggle('profile')}>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-text-secondary">{t('settings.profile_public_info')}</span>
          {!editingProfile ? (
            <button
              onClick={startEditProfile}
              type="button"
              className="flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-sage transition-colors hover:bg-sage-muted"
            >
              <Pencil className="h-3 w-3" /> {t('settings.edit')}
            </button>
          ) : (
            <div className="flex gap-1.5">
              <button
                onClick={saveProfile}
                disabled={savingProfile}
                type="button"
                className="flex cursor-pointer items-center gap-1 rounded-lg bg-sage px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50"
              >
                {savingProfile ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                {t('settings.save')}
              </button>
              <button
                onClick={() => setEditingProfile(false)}
                type="button"
                className="flex cursor-pointer items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Avatar preview */}
        {/* Avatar — toujours visible, upload via Cloudinary */}
        <div className="mb-4 flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border-subtle bg-surface-2">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-sage">
                {(user.displayName || '?')[0].toUpperCase()}
              </div>
            )}
          </div>
          <label className={cn(
            'flex cursor-pointer items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2',
            uploadingAvatar && 'pointer-events-none opacity-50',
          )}>
            {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
            {t('settings.change_avatar')}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = ''; }}
              disabled={uploadingAvatar}
            />
          </label>
          {user.avatarUrl && (
            <button
              type="button"
              onClick={handleAvatarDelete}
              disabled={uploadingAvatar}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800/40 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('common.delete')}
            </button>
          )}
        </div>

        <div className="space-y-3">
          {editingProfile ? (
            <>
              <EditRow label={t('settings.name_label')} value={profileForm.displayName} onChange={(v) => setProfileForm((f) => ({ ...f, displayName: v }))} />
              <EditRow label={t('settings.username_label')} value={profileForm.username} onChange={(v) => setProfileForm((f) => ({ ...f, username: v.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} />
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">{t('settings.bio_label')}</label>
                <textarea
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value.slice(0, 160) }))}
                  rows={2}
                  placeholder={t('settings.bio_placeholder')}
                  className="w-full resize-none rounded-md border border-border-subtle bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-sage focus:ring-1 focus:ring-sage"
                />
                <p className="mt-0.5 text-right text-[10px] text-text-secondary/60">{profileForm.bio.length}/160</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">{t('settings.level_label')}</label>
                <select
                  value={profileForm.level}
                  onChange={(e) => setProfileForm((f) => ({ ...f, level: e.target.value }))}
                  className="h-9 w-full cursor-pointer rounded-md border border-border-subtle bg-bg px-3 text-sm text-text-primary outline-none focus:border-sage focus:ring-1 focus:ring-sage"
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>{t(`level.${l}`)}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <InfoRow label={t('settings.name_label')} value={user.displayName} />
              {user.username && <InfoRow label={t('settings.username_label')} value={`@${user.username}`} />}
              <InfoRow label={t('settings.email_label')} value={user.email} />
              {bio && <InfoRow label={t('settings.bio_label')} value={bio} />}
              {level && <InfoRow label={t('settings.level_label')} value={t(`level.${level}`)} />}
            </>
          )}
        </div>

        <Link
          to={`/profile?id=${user._id}`}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-sage no-underline hover:underline"
        >
          <Eye className="h-3 w-3" /> {t('settings.view_profile')}
        </Link>
      </Section>

      {/* ── 2. Confidentialité ────────────────────────── */}
      <Section icon={EyeOff} title={t('settings.section_privacy')} open={openSection === 'privacy'} onToggle={() => toggle('privacy')}>
        <div className="space-y-1 divide-y divide-border-subtle">
          <ToggleRow
            label={t('settings.privacy_private_account')}
            description={t('settings.privacy_private_account_desc')}
            checked={isPrivate}
            onChange={togglePrivate}
            disabled={savingField === 'isPrivate'}
          />
          <div className="flex items-center justify-between gap-4 pt-3">
            <div>
              <p className="text-sm font-medium text-text-primary flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-text-secondary" />
                {t('settings.privacy_logbook')}
              </p>
              <p className="text-xs text-text-secondary">{t('settings.privacy_logbook_desc')}</p>
            </div>
            <select
              value={logbookVisibility}
              onChange={(e) => changeLogbookVisibility(e.target.value)}
              disabled={!!savingField}
              className="h-8 cursor-pointer rounded-md border border-border-subtle bg-surface px-2.5 text-xs font-medium text-text-primary outline-none focus:border-sage focus:ring-1 focus:ring-sage disabled:opacity-50"
            >
              {LOGBOOK_VISIBILITY.map((v) => (
                <option key={v} value={v}>{t(`settings.visibility_${v}`)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-4 pt-3">
            <div>
              <p className="text-sm font-medium text-text-primary flex items-center gap-1.5">
                <Bookmark className="h-3.5 w-3.5 text-text-secondary" />
                {t('settings.privacy_spots')}
              </p>
              <p className="text-xs text-text-secondary">{t('settings.privacy_spots_desc')}</p>
            </div>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              {t('common.in_progress')}
            </span>
          </div>
        </div>
      </Section>

      {/* ── 3. Notifications ──────────────────────────── */}
      <Section icon={Bell} title={t('settings.section_notifications')} open={openSection === 'notifs'} onToggle={() => toggle('notifs')}>
        <div className="space-y-0 divide-y divide-border-subtle">
          {([
            ['friendRequest',  'settings.notif_friend_request'],
            ['friendAccepted', 'settings.notif_friend_accepted'],
            ['newFollower',    'settings.notif_new_follower'],
            ['spotApproved',   'settings.notif_spot_approved'],
            ['spotRejected',   'settings.notif_spot_rejected'],
            ['newReview',      'settings.notif_new_review'],
          ] as [keyof NotificationPreferences, string][]).map(([key, tKey]) => (
            <ToggleRow
              key={key}
              label={t(tKey)}
              checked={notifPrefs[key] !== false}
              onChange={(v) => toggleNotif(key, v)}
              disabled={savingField === `notif_${key}`}
            />
          ))}

          {/* Mode silencieux */}
          <div className="pt-3">
            <ToggleRow
              label={t('settings.notif_quiet_mode')}
              description={t('settings.notif_quiet_mode_desc')}
              checked={quietMode.enabled ?? false}
              onChange={toggleQuietMode}
              disabled={savingField === 'quietMode'}
            />
            {quietMode.enabled && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-2/60 px-4 py-3">
                <Clock className="h-4 w-4 shrink-0 text-text-secondary" />
                <div className="flex flex-1 items-center gap-2 text-sm">
                  <span className="text-text-secondary">{t('settings.notif_quiet_from')}</span>
                  <select
                    value={quietMode.startHour ?? 22}
                    onChange={(e) => changeQuietHour('startHour', parseInt(e.target.value, 10))}
                    className="h-8 cursor-pointer rounded-md border border-border-subtle bg-surface px-2 text-xs font-medium text-text-primary outline-none focus:border-sage"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}h</option>
                    ))}
                  </select>
                  <span className="text-text-secondary">{t('settings.notif_quiet_to')}</span>
                  <select
                    value={quietMode.endHour ?? 7}
                    onChange={(e) => changeQuietHour('endHour', parseInt(e.target.value, 10))}
                    className="h-8 cursor-pointer rounded-md border border-border-subtle bg-surface px-2 text-xs font-medium text-text-primary outline-none focus:border-sage"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}h</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ── 4. Apparence & Langue ─────────────────────── */}
      <Section icon={Sun} title={t('settings.preferences')} open={openSection === 'appearance'} onToggle={() => toggle('appearance')}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Globe className="h-4 w-4" /> {t('settings.language')}
            </div>
            <select
              value={i18n.language}
              onChange={(e) => { i18n.changeLanguage(e.target.value); localStorage.setItem('zdg_lang', e.target.value); }}
              className="h-8 cursor-pointer rounded-md border border-border-subtle bg-surface px-3 text-xs font-medium text-text-primary outline-none transition-colors hover:border-sage focus:border-sage focus:ring-1 focus:ring-sage"
            >
              {SUPPORTED_LANGS.map((l) => (
                <option key={l} value={l}>{l.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              {theme === 'light' ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4" />}
              {t('settings.theme')}
            </div>
            <button
              onClick={toggleTheme}
              type="button"
              className={cn(
                'relative h-6 w-11 cursor-pointer rounded-full overflow-hidden transition-colors duration-300',
                theme === 'light' ? 'bg-sage' : 'bg-text-secondary/30',
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-300',
                theme === 'light' ? 'translate-x-5' : 'translate-x-0',
              )} />
            </button>
          </div>
        </div>
      </Section>

      {/* ── 5. Sécurité ───────────────────────────────── */}
      <Section icon={Lock} title={t('settings.security')} open={openSection === 'security'} onToggle={() => toggle('security')}>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">{t('settings.pw_current')}</label>
            <input
              type="password"
              value={pwForm.current}
              onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
              className="w-full rounded-md border border-border-subtle bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-sage focus:ring-1 focus:ring-sage"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">{t('settings.pw_new')}</label>
              <input
                type="password"
                value={pwForm.next}
                onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
                className="w-full rounded-md border border-border-subtle bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-sage focus:ring-1 focus:ring-sage"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">{t('settings.pw_confirm')}</label>
              <input
                type="password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                className="w-full rounded-md border border-border-subtle bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-sage focus:ring-1 focus:ring-sage"
              />
            </div>
          </div>
          <p className="text-[11px] text-text-secondary/70">{t('settings.pw_hint')}</p>
          {pwError && <p className="text-xs text-red-500">{pwError}</p>}
          <button
            type="submit"
            disabled={pwSaving}
            className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] bg-sage px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50"
          >
            {pwSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {t('settings.pw_save')}
          </button>
        </form>
      </Section>

      {/* ── 6. Administration ─────────────────────────── */}
      {isAdmin && (
        <Section icon={Crown} title={t('settings.admin_section')} open={openSection === 'admin'} onToggle={() => toggle('admin')}>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/spots"
              className="rounded-[var(--radius-sm)] bg-sage px-4 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-sage-hover"
            >
              {t('settings.admin_spots')}
            </Link>
            <Link
              to="/admin/users"
              className="rounded-[var(--radius-sm)] border border-border-subtle px-4 py-2 text-sm font-semibold text-text-primary no-underline transition-colors hover:bg-surface-2"
            >
              {t('settings.admin_users')}
            </Link>
          </div>
        </Section>
      )}

      {/* ── 7. Compte ─────────────────────────────────── */}
      <Section icon={Shield} title={t('settings.account')} danger open={openSection === 'account'} onToggle={() => toggle('account')}>
        <div className="space-y-3">
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-border-subtle px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-2"
            type="button"
          >
            <LogOut className="h-4 w-4" />
            {t('auth.logout')}
          </button>

          <div className="border-t border-border-subtle pt-3">
            <p className="mb-3 text-xs text-text-secondary">{t('settings.delete_account_warning')}</p>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={cn(
                'inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50',
                confirmDelete
                  ? 'border-red-500 bg-red-600 text-white hover:bg-red-700'
                  : 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20',
              )}
              type="button"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {confirmDelete ? t('settings.confirm_delete') : t('settings.delete_account')}
            </button>
            {confirmDelete && (
              <button
                onClick={() => setConfirmDelete(false)}
                type="button"
                className="ml-2 text-xs text-text-secondary hover:underline cursor-pointer"
              >
                {t('common.cancel')}
              </button>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="truncate text-right text-sm font-medium text-text-primary">{value}</span>
    </div>
  );
}

function EditRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-sm text-text-secondary">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-48 rounded-md border border-border-subtle bg-bg px-2.5 py-1.5 text-right text-sm font-medium text-text-primary outline-none focus:border-sage focus:ring-1 focus:ring-sage"
      />
    </div>
  );
}
