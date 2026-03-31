import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Bookmark, MapPin } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export function MySpotsPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <Bookmark className="mb-4 h-12 w-12 text-text-secondary/40" />
        <h2 className="font-heading text-xl font-bold text-text-primary">{t('nav.my_spots')}</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Connecte-toi pour sauvegarder tes spots favoris.
        </p>
        <Link
          to="/login?next=/my-spots"
          className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-sage px-5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-sage-hover"
        >
          {t('auth.login')}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-24">
      <div className="mb-8 text-center">
        <h1 className="font-heading text-2xl font-bold text-text-primary">{t('nav.my_spots')}</h1>
        <p className="mt-1 text-sm text-text-secondary">Tes spots sauvegardes et proposes</p>
      </div>

      {/* Placeholder - will be fully implemented */}
      <div className="flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed border-border-subtle py-16 text-center">
        <MapPin className="mb-3 h-10 w-10 text-text-secondary/30" />
        <p className="text-sm font-medium text-text-secondary">
          Page en cours de migration vers React
        </p>
        <p className="mt-1 text-xs text-text-secondary/60">
          Bookmarks, propositions et historique arrivent bientot.
        </p>
      </div>
    </div>
  );
}
