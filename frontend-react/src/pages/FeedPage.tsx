import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity, Star, MapPin, BookOpen, Loader2, Users,
  Heart, MessageCircle, Share2, TrendingUp,
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

function useRelativeDate() {
  const { t } = useTranslation();
  return (dateStr: string): string => {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.floor((now - then) / 1000);

    if (diff < 60) return t('time.just_now');
    if (diff < 3600) return t('time.minutes_ago', { count: Math.floor(diff / 60) });
    if (diff < 86400) return t('time.hours_ago', { count: Math.floor(diff / 3600) });
    if (diff < 172800) return t('time.yesterday');
    if (diff < 604800) return t('time.days_ago', { count: Math.floor(diff / 86400) });
    if (diff < 2592000) return t('time.weeks_ago', { count: Math.floor(diff / 604800) });
    return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };
}

const AVATAR_COLORS = ['#5D7052', '#C18845', '#4A90D9', '#8B5CF6', '#dc2626', '#16a34a'];
function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || '?';
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="text-amber-brand text-sm">
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
  review:  'bg-amber-brand/10 text-amber-brand',
  logbook: 'bg-sage-muted text-sage',
  spot:    'bg-blue-50 text-blue-500 dark:bg-blue-900/20',
} as const;

const GRADE_COLORS: [number, string][] = [
  [5.0,  '#eab308'],
  [6.33, '#16a34a'],
  [7.0,  '#2563eb'],
  [7.66, '#dc2626'],
  [8.0,  '#1a1a1a'],
];
function gradeColor(grade: string): string {
  const m = grade.match(/^(\d+)([abc+]?)$/i);
  if (!m) return '#6A645A';
  const n = parseInt(m[1]) + (['a','','+',' '].indexOf(m[2].toLowerCase()) >= 0 ? 0 : m[2] === 'b' ? 0.33 : 0.66);
  for (const [max, col] of GRADE_COLORS) if (n <= max) return col;
  return '#7c3aed';
}

/* ── FeedCard ────────────────────────────────────────────── */
function FeedCard({ item, relDate }: { item: FeedItem; relDate: (s: string) => string }) {
  const { t } = useTranslation();
  const d = item.data as { spotId?: string; spotName?: string; routeName?: string; grade?: string; style?: string; rating?: number; comment?: string; spotType?: string };
  const name = item.displayName || item.username || '?';
  const username = item.username || item.displayName || '?';
  const Icon = TYPE_ICON[item.type] || Activity;
  const iconCls = TYPE_CLS[item.type] || TYPE_CLS.spot;
  const color = avatarColor(name);

  return (
    <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface p-4 shadow-soft transition-shadow hover:shadow-card">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <Link to={`/profile?id=${item.userId}`} className="shrink-0 no-underline">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full font-heading text-sm font-bold text-white"
            style={{ background: color }}
          >
            {initials(name)}
          </div>
        </Link>

        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-text-primary">
            <Link to={`/profile?id=${item.userId}`} className="font-semibold text-text-primary no-underline hover:text-sage">
              {name}
            </Link>
            <span className="text-text-secondary">
              {item.type === 'review'  && ` ${t('feed.reviewed')} `}
              {item.type === 'logbook' && ` ${t('feed.climbed')} `}
              {item.type === 'spot'    && ` ${t('feed.proposed')} `}
            </span>
            {item.type === 'review' && (
              <Link to={`/map?spot=${d.spotId}`} className="font-semibold text-text-primary no-underline hover:text-sage">
                {String(d.spotName || t('feed.a_spot'))}
              </Link>
            )}
            {item.type === 'logbook' && d.routeName && (
              <span className="font-semibold">{String(d.routeName)}</span>
            )}
            {item.type === 'spot' && (
              <Link to={`/map?spot=${d.spotId}`} className="font-semibold text-text-primary no-underline hover:text-sage">
                {String(d.spotName || t('feed.a_spot'))}
              </Link>
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-text-secondary/60">
            @{username} · {relDate(item.createdAt)}
          </p>
        </div>

        {/* Type badge */}
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconCls)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Content block */}
      {item.type === 'logbook' && (d.grade || d.style) && (
        <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-sm)] bg-surface-2 px-3 py-2">
          {d.grade && (
            <span
              className="rounded px-2 py-0.5 font-mono text-xs font-bold text-white"
              style={{ background: gradeColor(String(d.grade)) }}
            >
              {String(d.grade)}
            </span>
          )}
          {d.style && (
            <span className="text-xs font-semibold uppercase tracking-wide text-sage">
              {t(`logbook.style.${d.style}`)}
            </span>
          )}
          {d.spotName && (
            <span className="ml-auto flex min-w-0 items-center gap-1 text-xs text-text-secondary">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{String(d.spotName)}</span>
            </span>
          )}
        </div>
      )}

      {item.type === 'review' && (
        <div className="mt-3">
          {typeof d.rating === 'number' && <StarRating rating={d.rating} />}
          {d.comment && (
            <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-text-primary">
              {String(d.comment)}
            </p>
          )}
        </div>
      )}

      {item.type === 'spot' && d.spotType && (
        <div className="mt-2 text-xs text-text-secondary">
          {String(d.spotType)} {d.spotName ? `· ${String(d.spotName)}` : ''}
        </div>
      )}

      {/* Engagement bar */}
      <div className="mt-3 flex items-center gap-4 border-t border-border-subtle pt-3 text-xs text-text-secondary">
        <button type="button" className="flex items-center gap-1 transition-colors hover:text-red-500">
          <Heart className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="flex items-center gap-1 transition-colors hover:text-sage">
          <MessageCircle className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="ml-auto flex items-center gap-1 transition-colors hover:text-sage">
          <Share2 className="h-3.5 w-3.5" />
          <span>{t('feed.share')}</span>
        </button>
      </div>
    </div>
  );
}

/* ── FeedPage ─────────────────────────────────────────────── */
export function FeedPage() {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuthStore();
  const relativeDate = useRelativeDate();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'review' | 'logbook' | 'spot'>('all');
  const [displayCount, setDisplayCount] = useState(20);

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
        <p className="text-sm text-text-secondary">{t('feed.login_prompt')}</p>
        <Link to="/login" className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-sage px-5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-sage-hover">
          {t('auth.login')}
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

  const filtered = filter === 'all' ? items : items.filter((i) => i.type === filter);
  const myName = user?.displayName || user?.username || 'Moi';
  const myColor = avatarColor(myName);

  const filterTabs: { key: 'all' | 'logbook' | 'review' | 'spot'; label: string; icon?: typeof BookOpen }[] = [
    { key: 'all',     label: t('feed.filter_all') },
    { key: 'logbook', label: t('feed.filter_logbook'), icon: BookOpen },
    { key: 'review',  label: t('feed.filter_reviews'), icon: Star },
    { key: 'spot',    label: t('feed.filter_spots'),   icon: MapPin },
  ];

  return (
    <div className="flex min-h-full">
      {/* ── Desktop left rail ── */}
      <aside className="hidden w-56 shrink-0 border-r border-border-subtle bg-surface px-4 py-5 xl:block">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-text-secondary/60">
          {t('feed.circles')}
        </h3>
        <nav className="flex flex-col gap-1">
          {filterTabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                'rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                filter === key
                  ? 'bg-sage-muted font-semibold text-sage'
                  : 'text-text-secondary hover:bg-surface-2',
              )}
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main feed ── */}
      <main className="min-w-0 flex-1 px-4 py-5 md:pb-6">
        <div className="mx-auto max-w-[580px]">
          {/* Page title (mobile only) */}
          <div className="mb-4 xl:hidden">
            <h1 className="font-heading text-2xl font-bold text-text-primary">{t('feed.title')}</h1>
            <p className="mt-0.5 text-sm text-text-secondary">{t('feed.subtitle')}</p>
          </div>

          {/* Composer */}
          <div className="mb-4 flex gap-3 rounded-[var(--radius-md)] border border-border-subtle bg-surface p-4 shadow-soft">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-heading text-sm font-bold text-white"
              style={{ background: myColor }}
            >
              {initials(myName)}
            </div>
            <div className="flex-1">
              <div className="rounded-[var(--radius-sm)] border border-border-subtle bg-bg px-3 py-2 text-sm text-text-secondary/60">
                {t('feed.composer_placeholder', { name: user?.displayName?.split(' ')[0] || '' })}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFilter('logbook')}
                  className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2 px-3 py-1 text-[11px] font-semibold text-sage transition-colors hover:bg-sage-muted"
                >
                  <BookOpen className="h-3 w-3" />{t('nav.logbook')}
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('review')}
                  className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2 px-3 py-1 text-[11px] font-semibold text-amber-brand transition-colors hover:bg-amber-brand/10"
                >
                  <Star className="h-3 w-3" />{t('feed.filter_reviews')}
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('spot')}
                  className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2 px-3 py-1 text-[11px] font-semibold text-text-secondary transition-colors hover:bg-surface-2"
                >
                  <MapPin className="h-3 w-3" />{t('nav.map')}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile filter chips */}
          {items.length > 0 && (
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none xl:hidden">
              {filterTabs.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
                    filter === key
                      ? 'bg-sage text-white shadow-soft'
                      : 'border border-border-subtle bg-surface text-text-secondary hover:bg-surface-2',
                  )}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Feed content */}
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border-subtle py-16 text-center">
              <Activity className="mb-3 h-10 w-10 text-text-secondary/20" />
              <p className="text-sm font-medium text-text-secondary">{t('feed.no_activity')}</p>
              <p className="mt-1 text-xs text-text-secondary/60">{t('feed.no_activity_help')}</p>
              <Link
                to="/friends"
                className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-sage px-4 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-sage-hover"
              >
                <Users className="h-4 w-4" />
                {t('feed.find_climbers')}
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.slice(0, displayCount).map((item, i) => (
                <FeedCard key={`${item.type}-${item.userId}-${i}`} item={item} relDate={relativeDate} />
              ))}
              {filtered.length > displayCount && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setDisplayCount((c) => c + 20)}
                    className="cursor-pointer rounded-[var(--radius-md)] border border-border-subtle bg-surface px-5 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-2"
                  >
                    {t('common.load_more')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── Desktop right rail ── */}
      <aside className="hidden w-64 shrink-0 border-l border-border-subtle bg-surface px-4 py-5 xl:block">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-text-secondary/60">
          {t('feed.trending')}
        </h3>
        <div className="mb-5 flex flex-col gap-3">
          {[
            { name: 'Fontainebleau', sub: '+34 ce mois' },
            { name: 'Calanques',    sub: '+22 ce mois' },
            { name: 'Ceüse',        sub: '+18 ce mois' },
          ].map(({ name, sub }) => (
            <div key={name} className="flex items-center gap-3">
              <div className="h-2 w-2 shrink-0 rounded-full bg-sage" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-text-primary">{name}</p>
                <p className="text-[11px] text-text-secondary">{sub}</p>
              </div>
              <TrendingUp className="h-3.5 w-3.5 text-text-secondary/50" />
            </div>
          ))}
        </div>

        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-text-secondary/60">
          {t('feed.suggestions')}
        </h3>
        <Link
          to="/friends"
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-sage/30 bg-sage-muted px-3 py-2 text-xs font-semibold text-sage no-underline transition-colors hover:bg-sage hover:text-white"
        >
          <Users className="h-3.5 w-3.5" />
          {t('feed.find_climbers')}
        </Link>
      </aside>
    </div>
  );
}
