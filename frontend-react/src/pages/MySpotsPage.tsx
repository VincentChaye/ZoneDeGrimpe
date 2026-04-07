import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Bookmark, MapPin, Loader2, Trash2, Clock, CheckCircle2, XCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import type { SpotType } from '@/types';

interface BookmarkedSpot {
  _id: string;
  name: string;
  type: SpotType;
  niveau_min?: string | null;
  niveau_max?: string | null;
  orientation?: string | null;
  bookmarkedAt: string;
}

interface SubmittedSpot {
  _id: string;
  name: string;
  type: SpotType;
  status: string;
  niveau_min?: string | null;
  niveau_max?: string | null;
  createdAt?: string;
}

type Tab = 'bookmarks' | 'submissions';

const STATUS_CFG: Record<string, { icon: typeof CheckCircle2; cls: string; key: string }> = {
  approved: { icon: CheckCircle2, cls: 'text-grade-easy bg-grade-easy/10', key: 'myspots.status_approved' },
  pending: { icon: Clock, cls: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20', key: 'myspots.status_pending' },
  rejected: { icon: XCircle, cls: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20', key: 'myspots.status_rejected' },
};

export function MySpotsPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();

  const [tab, setTab] = useState<Tab>('bookmarks');
  const [bookmarks, setBookmarks] = useState<BookmarkedSpot[]>([]);
  const [submissions, setSubmissions] = useState<SubmittedSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');

  const loadBookmarks = useCallback(async () => {
    try {
      const data = await apiFetch<BookmarkedSpot[]>('/api/bookmarks', { auth: true });
      setBookmarks(data ?? []);
    } catch { /* silent */ }
  }, []);

  const loadSubmissions = useCallback(async () => {
    try {
      const data = await apiFetch<SubmittedSpot[]>('/api/spots/my-submissions', { auth: true });
      setSubmissions(data ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    Promise.all([loadBookmarks(), loadSubmissions()]).finally(() => setLoading(false));
  }, [isAuthenticated, loadBookmarks, loadSubmissions]);

  async function removeBookmark(spotId: string) {
    setRemoving(spotId);
    try {
      await apiFetch(`/api/bookmarks/${spotId}`, { method: 'DELETE', auth: true });
      setBookmarks((prev) => prev.filter((s) => s._id !== spotId));
    } catch { /* silent */ }
    setRemoving(null);
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <Bookmark className="mb-4 h-12 w-12 text-text-secondary/40" />
        <h2 className="font-heading text-xl font-bold text-text-primary">{t('nav.my_spots')}</h2>
        <p className="mt-2 text-sm text-text-secondary">{t('myspots.login_prompt')}</p>
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
      <div className="mb-6 text-center">
        <h1 className="font-heading text-2xl font-bold text-text-primary">{t('nav.my_spots')}</h1>
        <p className="mt-1 text-sm text-text-secondary">{t('myspots.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        <TabBtn
          active={tab === 'bookmarks'}
          onClick={() => setTab('bookmarks')}
          count={bookmarks.length}
          label={t('myspots.tab_bookmarks')}
        />
        <TabBtn
          active={tab === 'submissions'}
          onClick={() => setTab('submissions')}
          count={submissions.length}
          label={t('myspots.tab_submissions')}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-sage" />
        </div>
      ) : tab === 'bookmarks' ? (
        bookmarks.length === 0 ? (
          <EmptyState icon={<Bookmark className="h-10 w-10" />} message={t('myspots.no_bookmarks')} />
        ) : (() => {
          const filtered = bookmarks
            .filter((s) => !filterType || s.type === filterType)
            .sort((a, b) => sortBy === 'name'
              ? a.name.localeCompare(b.name)
              : new Date(b.bookmarkedAt).getTime() - new Date(a.bookmarkedAt).getTime()
            );
          return (
            <>
              {/* Filter + sort bar */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {(['', 'crag', 'boulder', 'indoor', 'shop'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFilterType(type)}
                    className={cn(
                      'cursor-pointer rounded-xl px-3 py-1 text-xs font-semibold transition-all',
                      filterType === type
                        ? 'bg-sage text-white'
                        : 'border border-border-subtle bg-surface text-text-secondary hover:bg-surface-2',
                    )}
                  >
                    {type ? t(`spot.type.${type}`) : t('myspots.filter_all')}
                  </button>
                ))}
                <div className="ml-auto">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'date' | 'name')}
                    className="h-7 cursor-pointer rounded-lg border border-border-subtle bg-surface px-2 text-xs font-medium text-text-secondary outline-none focus:border-sage"
                  >
                    <option value="date">{t('myspots.sort_date')}</option>
                    <option value="name">{t('myspots.sort_name')}</option>
                  </select>
                </div>
              </div>
              {filtered.length === 0 ? (
                <EmptyState icon={<Bookmark className="h-10 w-10" />} message={t('myspots.no_results')} />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filtered.map((spot) => (
                    <SpotCard key={spot._id} spot={spot} t={t}>
                      <button
                        onClick={() => removeBookmark(spot._id)}
                        disabled={removing === spot._id}
                        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-subtle text-text-secondary transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-900/20"
                        title={t('myspots.remove_bookmark')}
                        type="button"
                      >
                        {removing === spot._id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </SpotCard>
                  ))}
                </div>
              )}
            </>
          );
        })()
      ) : submissions.length === 0 ? (
        <EmptyState icon={<MapPin className="h-10 w-10" />} message={t('myspots.no_submissions')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {submissions.map((spot) => {
            const cfg = STATUS_CFG[spot.status] || STATUS_CFG.pending;
            const Icon = cfg.icon;
            return (
              <SpotCard key={spot._id} spot={spot} t={t}>
                <span className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold', cfg.cls)}>
                  <Icon className="h-3 w-3" />
                  {t(cfg.key)}
                </span>
              </SpotCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---- Sub-components ---- */

function TabBtn({ active, onClick, count, label }: {
  active: boolean; onClick: () => void; count: number; label: string;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all',
        active
          ? 'bg-sage text-white shadow-soft'
          : 'border border-border-subtle bg-surface text-text-secondary hover:bg-surface-2',
      )}
    >
      {label}
      <span className={cn(
        'flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold',
        active ? 'bg-white/20 text-white' : 'bg-surface-2 text-text-secondary',
      )}>
        {count}
      </span>
    </button>
  );
}

const TYPE_BG: Record<string, string> = {
  crag: 'bg-type-crag',
  boulder: 'bg-type-boulder',
  indoor: 'bg-type-indoor',
  shop: 'bg-type-shop',
};

function SpotCard({ spot, t, children }: {
  spot: { _id: string; name: string; type: SpotType; niveau_min?: string | null; niveau_max?: string | null };
  t: (k: string) => string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface p-4 shadow-soft transition-shadow hover:shadow-card">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white', TYPE_BG[spot.type] || 'bg-type-crag')}>
        <MapPin className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <Link
          to={`/map?spot=${spot._id}`}
          className="block truncate text-sm font-semibold text-text-primary no-underline hover:text-sage"
        >
          {spot.name}
        </Link>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-text-secondary">
          <span>{t(`spot.type.${spot.type}`)}</span>
          {spot.niveau_min && (
            <>
              <span className="text-border-subtle">·</span>
              <span>{spot.niveau_min}{spot.niveau_max && spot.niveau_max !== spot.niveau_min ? ` → ${spot.niveau_max}` : ''}</span>
            </>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle py-16 text-center">
      <span className="mb-3 text-text-secondary/30">{icon}</span>
      <p className="text-sm font-medium text-text-secondary">{message}</p>
    </div>
  );
}
