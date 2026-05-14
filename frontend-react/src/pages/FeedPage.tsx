import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity, MapPin, BookOpen, Loader2,
  Heart, MessageCircle, Share2, TrendingUp,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

interface FeedItem {
  id: string;
  type: 'logbook' | 'spot';
  userId: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: string;
  imageUrl: string | null;
  spot: { id: string; name: string; type?: string };
  route?: { id?: string; name?: string } | null;
  grade?: string;
  style?: string;
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

const GRADE_COLORS: [number, string][] = [
  [5.0,  '#eab308'],
  [6.33, '#16a34a'],
  [7.0,  '#2563eb'],
  [7.66, '#dc2626'],
  [8.0,  '#1a1a1a'],
];
function gradeColor(grade?: string): string {
  if (!grade) return '#5D7052';
  const m = grade.match(/^(\d+)([abc+]?)$/i);
  if (!m) return '#6A645A';
  const n = parseInt(m[1]) + (['a', '', '+', ' '].indexOf(m[2].toLowerCase()) >= 0 ? 0 : m[2] === 'b' ? 0.33 : 0.66);
  for (const [max, col] of GRADE_COLORS) if (n <= max) return col;
  return '#7c3aed';
}

const SPOT_TYPE_ICON: Record<string, string> = {
  crag: '🧗', boulder: '🪨', indoor: '🏛️', shop: '🏪',
};

/* ── FeedCard ────────────────────────────────────────────── */
function FeedCard({ item, relDate }: { item: FeedItem; relDate: (s: string) => string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const name = item.displayName || item.username || '?';
  const color = avatarColor(name);
  const gradientColor = gradeColor(item.grade);

  return (
    <div
      onClick={() => item.spot.id && navigate(`/spot/${item.spot.id}`)}
      className="block cursor-pointer overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-surface shadow-soft transition-shadow hover:shadow-card"
    >
      {/* Photo / fallback */}
      <div className="relative aspect-video w-full overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.spot.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${gradientColor}33, ${gradientColor}88)` }}
          >
            {item.type === 'logbook'
              ? <BookOpen className="h-12 w-12 opacity-40 text-white" />
              : <MapPin className="h-12 w-12 opacity-40 text-white" />
            }
          </div>
        )}

        {/* Grade pill overlay */}
        {item.grade && (
          <span
            className="absolute right-2 top-2 rounded px-2 py-0.5 font-mono text-xs font-bold text-white shadow"
            style={{ background: gradientColor }}
          >
            {item.grade}
          </span>
        )}

        {/* Spot type badge */}
        {item.type === 'spot' && item.spot.type && (
          <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
            {SPOT_TYPE_ICON[item.spot.type] ?? '📍'} {item.spot.type}
          </span>
        )}
      </div>

      {/* Header: avatar + user info */}
      <div className="flex items-start gap-3 px-3 pt-3">
        <button
          type="button"
          className="shrink-0"
          onClick={(e) => { e.stopPropagation(); navigate(`/profile?id=${item.userId}`); }}
        >
          {item.avatarUrl ? (
            <img src={item.avatarUrl} alt={name} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full font-heading text-sm font-bold text-white"
              style={{ background: color }}
            >
              {initials(name)}
            </div>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-text-primary">
            <button
              type="button"
              className="font-semibold text-text-primary hover:text-sage"
              onClick={(e) => { e.stopPropagation(); navigate(`/profile?id=${item.userId}`); }}
            >
              {name}
            </button>
            <span className="text-text-secondary">
              {item.type === 'logbook' ? ` ${t('feed.climbed')} ` : ` ${t('feed.proposed')} `}
            </span>
            <span className="font-semibold text-text-primary">
              {item.type === 'logbook' && item.route?.name
                ? item.route.name
                : item.spot.name || t('feed.a_spot')}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-text-secondary/60">
            {item.username ? `@${item.username} · ` : ''}{relDate(item.createdAt)}
          </p>
        </div>
      </div>

      {/* Info bar */}
      <div className="mt-2 flex flex-wrap items-center gap-2 px-3 pb-1">
        {item.style && (
          <span className="rounded-full bg-sage-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sage">
            {t(`logbook.style.${item.style}`)}
          </span>
        )}
        {item.spot.name && item.type === 'logbook' && (
          <span className="flex min-w-0 items-center gap-1 text-xs text-text-secondary">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.spot.name}</span>
          </span>
        )}
      </div>

      {/* Engagement bar */}
      <div className="flex items-center gap-4 border-t border-border-subtle px-3 py-2.5 text-xs text-text-secondary">
        <button type="button" className="flex items-center gap-1 transition-colors hover:text-red-500" onClick={(e) => e.stopPropagation()}>
          <Heart className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="flex items-center gap-1 transition-colors hover:text-sage" onClick={(e) => e.stopPropagation()}>
          <MessageCircle className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="ml-auto flex items-center gap-1 transition-colors hover:text-sage" onClick={(e) => e.stopPropagation()}>
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
  const { isAuthenticated } = useAuthStore();
  const relativeDate = useRelativeDate();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'logbook' | 'spot'>('all');

  const fetchFeed = useCallback(async (cursor?: string) => {
    const url = cursor ? `/api/feed/global?cursor=${cursor}` : '/api/feed/global';
    const data = await apiFetch<{ items: FeedItem[]; nextCursor: string | null }>(url);
    return data;
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchFeed()
      .then((data) => {
        setItems(data?.items ?? []);
        setNextCursor(data?.nextCursor ?? null);
      })
      .catch((err) => console.error('[feed]', err))
      .finally(() => setLoading(false));
  }, [fetchFeed]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchFeed(nextCursor);
      setItems((prev) => [...prev, ...(data?.items ?? [])]);
      setNextCursor(data?.nextCursor ?? null);
    } catch (err) {
      console.error('[feed/more]', err);
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-sage" />
      </div>
    );
  }

  const filterTabs: { key: 'all' | 'logbook' | 'spot'; label: string; icon?: typeof BookOpen }[] = [
    { key: 'all',     label: t('feed.filter_all') },
    { key: 'logbook', label: t('feed.filter_logbook'), icon: BookOpen },
    { key: 'spot',    label: t('feed.filter_spots'),   icon: MapPin },
  ];

  const filtered = filter === 'all' ? items : items.filter((i) => i.type === filter);

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
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border-subtle py-16 text-center">
              <Activity className="mb-3 h-10 w-10 text-text-secondary/20" />
              <p className="text-sm font-medium text-text-secondary">{t('feed.no_activity')}</p>
              <p className="mt-1 text-xs text-text-secondary/60">{t('feed.no_activity_help')}</p>
              {!isAuthenticated && (
                <Link
                  to="/login"
                  className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-sage px-4 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-sage-hover"
                >
                  {t('auth.login')}
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => (
                <FeedCard key={item.id} item={item} relDate={relativeDate} />
              ))}
              {nextCursor && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="cursor-pointer rounded-[var(--radius-md)] border border-border-subtle bg-surface px-5 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-50"
                  >
                    {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.load_more')}
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
                <p className="text-xs text-text-secondary">{sub}</p>
              </div>
              <TrendingUp className="h-3.5 w-3.5 text-sage" />
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
