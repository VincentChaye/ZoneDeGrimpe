import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity, Star, MapPin, BookOpen, Loader2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

interface FeedItem {
  type: 'review' | 'logbook' | 'spot';
  userId: string;
  username?: string;
  displayName?: string;
  data: Record<string, unknown>;
  createdAt: string;
}

function relativeDate(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return 'hier';
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)}j`;
  if (diff < 2592000) return `il y a ${Math.floor(diff / 604800)} sem.`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="text-amber-brand text-xs">
      {'★'.repeat(full)}
      {half && '½'}
      {'☆'.repeat(empty)}
    </span>
  );
}

const TYPE_ICON = {
  review: Star,
  logbook: BookOpen,
  spot: MapPin,
} as const;

const TYPE_CLS = {
  review: 'bg-amber-brand/10 text-amber-brand',
  logbook: 'bg-sage-muted text-sage',
  spot: 'bg-type-crag/10 text-type-crag',
} as const;

export function FeedPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    apiFetch<FeedItem[]>('/api/follows/feed', { auth: true })
      .then((data) => setItems(data ?? []))
      .catch((err) => console.error('[feed]', err))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <Activity className="h-12 w-12 text-text-secondary/30" />
        <p className="text-sm text-text-secondary">{t('auth.login_required') || 'Connectez-vous pour voir le fil'}</p>
        <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-sage px-5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-sage-hover">
          {t('auth.login') || 'Se connecter'}
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-sage" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-text-primary">
          {t('feed.title') || "Fil d'activité"}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {t('feed.subtitle') || "L'activité récente de vos amis et abonnements"}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle py-16 text-center">
          <Activity className="mb-3 h-10 w-10 text-text-secondary/20" />
          <p className="text-sm font-medium text-text-secondary">Aucune activité récente</p>
          <p className="mt-1 text-xs text-text-secondary/60">
            Suivez d'autres grimpeurs pour voir leur activité ici
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => {
            const Icon = TYPE_ICON[item.type] || Activity;
            const iconCls = TYPE_CLS[item.type] || TYPE_CLS.spot;
            const d = item.data;

            return (
              <div
                key={`${item.type}-${item.userId}-${i}`}
                className="rounded-xl border border-border-subtle bg-surface p-4 shadow-soft transition-shadow hover:shadow-card"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconCls)}>
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary">
                      <Link
                        to={`/profile?id=${item.userId}`}
                        className="font-semibold text-sage no-underline hover:text-sage-hover"
                      >
                        @{item.username || item.displayName || 'utilisateur'}
                      </Link>
                      {item.type === 'review' && (
                        <>
                          {' '}a laissé un avis sur{' '}
                          <Link
                            to={`/map?spot=${d.spotId}`}
                            className="font-semibold text-text-primary no-underline hover:text-sage"
                          >
                            {String(d.spotName || 'un spot')}
                          </Link>
                        </>
                      )}
                      {item.type === 'logbook' && (
                        <>
                          {' '}a grimpé{' '}
                          {d.routeName && <span className="font-medium">{String(d.routeName)}</span>}
                          {d.grade && (
                            <span className="ml-1 rounded bg-surface-2 px-1.5 py-0.5 text-xs font-bold">
                              {String(d.grade)}
                            </span>
                          )}
                          {d.style && (
                            <span className="ml-1 text-xs text-text-secondary">({String(d.style)})</span>
                          )}
                        </>
                      )}
                      {item.type === 'spot' && (
                        <>
                          {' '}a proposé{' '}
                          <Link
                            to={`/map?spot=${d.spotId}`}
                            className="font-semibold text-text-primary no-underline hover:text-sage"
                          >
                            {String(d.spotName || 'un spot')}
                          </Link>
                        </>
                      )}
                    </p>

                    {/* Rating for reviews */}
                    {item.type === 'review' && typeof d.rating === 'number' && (
                      <div className="mt-1">
                        <StarRating rating={d.rating} />
                      </div>
                    )}

                    {/* Timestamp */}
                    <p className="mt-1 text-[11px] text-text-secondary/60">
                      {relativeDate(item.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
