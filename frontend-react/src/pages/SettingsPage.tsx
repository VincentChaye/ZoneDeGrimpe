import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  User, LogOut, Trash2, Shield, Pencil, Check, X, Sun, Moon, Globe, Eye, Loader2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import { SUPPORTED_LANGS } from '@/i18n/config';
import { cn } from '@/lib/utils';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, user, isAdmin, logout, updateUser } = useAuthStore();
  const { theme, toggle: toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ displayName: '', username: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  function startEdit() {
    setForm({ displayName: user!.displayName, username: user!.username || '' });
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const data = await apiFetch<Record<string, unknown>>('/api/users/me', {
        method: 'PATCH',
        auth: true,
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          username: form.username.trim().toLowerCase(),
        }),
      });
      updateUser({
        displayName: (data.displayName as string) || form.displayName,
        username: (data.username as string) || form.username,
      });
      setEditing(false);
      toast.success(t('settings.saved'));
    } catch {
      toast.error(t('common.error'));
    }
    setSaving(false);
  }

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

  function handleLogout() {
    logout();
    navigate('/');
  }

  function changeLang(lang: string) {
    i18n.changeLanguage(lang);
    localStorage.setItem('zdg_lang', lang);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24">
      <h1 className="mb-6 font-heading text-2xl font-bold text-text-primary">
        {t('settings.title')}
      </h1>

      {/* Personal info */}
      <div className="mb-4 rounded-[var(--radius-md)] border border-border-subtle bg-surface p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">{t('settings.personal_info')}</h3>
          {!editing ? (
            <button
              onClick={startEdit}
              type="button"
              className="flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-sage transition-colors hover:bg-sage-muted"
            >
              <Pencil className="h-3 w-3" /> {t('settings.edit')}
            </button>
          ) : (
            <div className="flex gap-1.5">
              <button
                onClick={saveEdit}
                disabled={saving}
                type="button"
                className="flex cursor-pointer items-center gap-1 rounded-lg bg-sage px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                {t('settings.save')}
              </button>
              <button
                onClick={() => setEditing(false)}
                type="button"
                className="flex cursor-pointer items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {editing ? (
            <>
              <EditRow label={t('settings.name_label')} value={form.displayName} onChange={(v) => setForm((f) => ({ ...f, displayName: v }))} />
              <EditRow label={t('settings.username_label')} value={form.username} onChange={(v) => setForm((f) => ({ ...f, username: v.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} />
            </>
          ) : (
            <>
              <InfoRow label={t('settings.name_label')} value={user.displayName} />
              {user.username && <InfoRow label={t('settings.username_label')} value={`@${user.username}`} />}
            </>
          )}
          <InfoRow label={t('settings.email_label')} value={user.email} />
          <InfoRow label={t('settings.role_label')} value={user.roles?.join(', ') || 'user'} />
          {user.level && <InfoRow label={t('settings.level_label')} value={t(`level.${user.level}`)} />}
        </div>

        {/* View profile link */}
        <Link
          to={`/profile?id=${user._id}`}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-sage no-underline hover:underline"
        >
          <Eye className="h-3 w-3" /> {t('settings.view_profile')}
        </Link>
      </div>

      {/* Preferences */}
      <div className="mb-4 rounded-[var(--radius-md)] border border-border-subtle bg-surface p-5 shadow-soft">
        <h3 className="mb-4 text-sm font-semibold text-text-primary">{t('settings.preferences')}</h3>
        <div className="space-y-4">
          {/* Language */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Globe className="h-4 w-4" /> {t('settings.language')}
            </div>
            <select
              value={i18n.language}
              onChange={(e) => changeLang(e.target.value)}
              className="h-8 cursor-pointer rounded-md border border-border-subtle bg-surface px-3 text-xs font-medium text-text-primary outline-none transition-colors hover:border-sage focus:border-sage focus:ring-1 focus:ring-sage"
            >
              {SUPPORTED_LANGS.map((l) => (
                <option key={l} value={l}>{l.toUpperCase()}</option>
              ))}
            </select>
          </div>
          {/* Theme */}
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
      </div>

      {/* Admin section */}
      {isAdmin && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-border-subtle bg-surface p-5 shadow-soft">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Shield className="h-4 w-4 text-sage" />
            {t('settings.admin_section')}
          </h3>
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
        </div>
      )}

      {/* Account actions */}
      <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface p-5 shadow-soft">
        <h3 className="mb-3 text-sm font-semibold text-text-primary">{t('settings.account')}</h3>
        <div className="flex gap-3">
          <button
            onClick={handleLogout}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-border-subtle px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-2"
            type="button"
          >
            <LogOut className="h-4 w-4" />
            {t('auth.logout')}
          </button>
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
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text-primary">{value}</span>
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
