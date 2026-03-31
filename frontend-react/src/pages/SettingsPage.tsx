import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { User, LogOut, Trash2, Shield } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export function SettingsPage() {
  const { t } = useTranslation();
  const { isAuthenticated, user, isAdmin, logout } = useAuthStore();
  const navigate = useNavigate();

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <User className="mb-4 h-12 w-12 text-text-secondary/40" />
        <h2 className="font-heading text-xl font-bold text-text-primary">{t('settings.title')}</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Connecte-toi pour acceder a tes parametres.
        </p>
        <Link
          to="/login?next=/settings"
          className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-sage px-5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-sage-hover"
        >
          {t('auth.login')}
        </Link>
      </div>
    );
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24">
      <h1 className="mb-6 font-heading text-2xl font-bold text-text-primary">
        {t('settings.title')}
      </h1>

      {/* Profile card */}
      <div className="mb-4 rounded-[var(--radius-md)] border border-border-subtle bg-surface p-5 shadow-soft">
        <h3 className="mb-4 text-sm font-semibold text-text-primary">Informations personnelles</h3>
        <div className="space-y-3">
          <InfoRow label="Nom" value={user.displayName} />
          {user.username && <InfoRow label="@username" value={user.username} />}
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Role" value={user.roles?.join(', ') || 'user'} />
          {user.level && <InfoRow label="Niveau" value={user.level} />}
        </div>
      </div>

      {/* Admin links */}
      {isAdmin && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-border-subtle bg-surface p-5 shadow-soft">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Shield className="h-4 w-4 text-sage" />
            Administration
          </h3>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/spots"
              className="rounded-[var(--radius-sm)] bg-sage px-4 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-sage-hover"
            >
              Gestion des Spots
            </Link>
            <Link
              to="/admin/users"
              className="rounded-[var(--radius-sm)] border border-border-subtle px-4 py-2 text-sm font-semibold text-text-primary no-underline transition-colors hover:bg-surface-2"
            >
              Gestion des Utilisateurs
            </Link>
          </div>
        </div>
      )}

      {/* Account actions */}
      <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface p-5 shadow-soft">
        <h3 className="mb-3 text-sm font-semibold text-text-primary">Compte</h3>
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
            className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer le compte
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
