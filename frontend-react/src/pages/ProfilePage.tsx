import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  MapPin, Crown, Calendar, Loader2, ArrowLeft,
  UserPlus, UserCheck, Clock, UserMinus, Users, BookOpen, Star, Heart, Package, Edit2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import type { FriendshipCheck, UserMateriel } from '@/types';
import { GearCard } from '@/components/gear/GearCard';

interface RecentAscent {
  _id: string;
  spotId: string;
  spotName?: string;
  routeName?: string;
  grade?: string;
  style: string;
  date?: string;
  createdAt: string;
}

interface RecentReview {
  _id: string;
  spotId: string;
  spotName?: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

const STYLE_CLS: Record<string, string> = {
  onsight: 'bg-grade-easy/10 text-grade-easy border-grade-easy/20',
  flash: 'bg-grade-medium/10 text-grade-medium border-grade-medium/20',
  redpoint: 'bg-grade-hard/10 text-grade-hard border-grade-hard/20',
  repeat: 'bg-surface-2 text-text-secondary border-border-subtle',
};

interface PublicProfile {
  displayName: string;
  username?: string;
  avatarUrl?: string;
  level?: string;
  roles: string[];
  memberSince: string;
  stats: {
    spotsContributed: number;
    followersCount: number;
    friendsCount: number;
  };
}

const LEVEL_CLS: Record<string, string> = {
  debutant: 'bg-grade-easy/10 text-grade-easy border-grade-easy/20',
  intermediaire: 'bg-grade-medium/10 text-grade-medium border-grade-medium/20',
  avance: 'bg-grade-hard/10 text-grade-hard border-grade-hard/20',
};

export function ProfilePage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const userId = params.get('id');
  const { isAuthenticated, user: me } = useAuthStore();
  const isSelf = !!me && me._id === userId;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Social state
  const [friendship, setFriendship] = useState<FriendshipCheck>({ status: 'none' });
  const [following, setFollowing] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);

  // Activity sections
  const [recentAscents, setRecentAscents] = useState<RecentAscent[]>([]);
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const [publicGear, setPublicGear] = useState<UserMateriel[] | null>(null); // null = not accessible
  const [activeTab, setActiveTab] = useState<'activity' | 'spots' | 'reviews'>('activity');

  useEffect(() => {
    if (!userId) { setError(t('profile.id_missing')); setLoading(false); return; }
    Promise.all([
      apiFetch<PublicProfile>(`/api/users/${userId}/public`),
      apiFetch<{ items: RecentAscent[] }>(`/api/logbook/user/${userId}?limit=5`).catch(() => ({ items: [] })),
      apiFetch<{ items: RecentReview[] } | RecentReview[]>(`/api/reviews/user/${userId}?limit=5`).catch(() => ({ items: [] })),
      apiFetch<{ items: UserMateriel[] }>(`/api/user-materiel/user/${userId}`).catch(() => null),
    ])
      .then(([profileData, logData, reviewData, gearData]) => {
        setProfile(profileData);
        setRecentAscents(Array.isArray(logData) ? logData : logData.items ?? []);
        const rv = Array.isArray(reviewData) ? reviewData : (reviewData as { items?: RecentReview[] }).items ?? [];
        setRecentReviews(rv);
        setPublicGear(gearData?.items ?? null);
      })
      .catch(() => setError(t('profile.not_found')))
      .finally(() => setLoading(false));
  }, [userId, t]);

  useEffect(() => {
    if (!isAuthenticated || !userId || isSelf) return;
    apiFetch<FriendshipCheck>(`/api/friends/check/${userId}`, { auth: true })
      .then((data) => setFriendship(data ?? { status: 'none' }))
      .catch(() => {});
    apiFetch<{ following: boolean }>(`/api/follows/check/${userId}`, { auth: true })
      .then((data) => setFollowing(data?.following ?? false))
      .catch(() => {});
  }, [isAuthenticated, userId, isSelf]);

  async function handleFriendAction() {
    if (!userId) return;
    setSocialLoading(true);
    try {
      if (friendship.status === 'none') {
        await apiFetch(`/api/friends/request/${userId}`, { method: 'POST', auth: true });
        setFriendship({ status: 'pending_sent', friendshipId: '' });
        toast.success(t('friends.request_sent'));
      } else if (friendship.status === 'accepted') {
        await apiFetch(`/api/friends/${(friendship as { friendshipId: string }).friendshipId}`, { method: 'DELETE', auth: true });
        setFriendship({ status: 'none' });
      } else if (friendship.status === 'pending_received') {
        await apiFetch(`/api/friends/${(friendship as { friendshipId: string }).friendshipId}/accept`, { method: 'PATCH', auth: true });
        setFriendship({ status: 'accepted', friendshipId: (friendship as { friendshipId: string }).friendshipId });
        toast.success(t('friends.request_accepted'));
      }
    } catch {
      toast.error(t('common.error'));
    }
    setSocialLoading(false);
  }

  async function handleFollowToggle() {
    if (!userId) return;
    setSocialLoading(true);
    try {
      if (following) {
        await apiFetch(`/api/follows/${userId}`, { method: 'DELETE', auth: true });
        setFollowing(false);
      } else {
        await apiFetch(`/api/follows/${userId}`, { method: 'POST', auth: true });
        setFollowing(true);
      }
    } catch {
      toast.error(t('common.error'));
    }
    setSocialLoading(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-sage" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-text-secondary">{error || t('profile.not_found')}</p>
        <Link to="/" className="text-sm font-medium text-sage no-underline hover:text-sage-hover">
          <ArrowLeft className="mr-1 inline h-4 w-4" />
          {t('common.back')}
        </Link>
      </div>
    );
  }

  const isAdmin = profile.roles?.includes('admin');
  const initial = (profile.displayName || '?')[0].toUpperCase();

  return (
    <div className="md:pb-8">

      {/* ── Cover ── */}
      <div className="relative h-24 md:h-40" style={{ background: 'linear-gradient(135deg, #5D7052 0%, #4A5A41 50%, #C18845 100%)' }}>
        {/* Mountain silhouette */}
        <svg viewBox="0 0 1280 160" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-30">
          <path d="M 0 160 L 0 90 L 200 50 L 400 100 L 600 40 L 800 80 L 1000 50 L 1280 90 L 1280 160 Z" fill="rgba(0,0,0,0.4)" />
        </svg>
      </div>

      {/* ── Profile header ── */}
      <div className="px-4 md:px-12">
        <div className="mx-auto max-w-5xl">

          {/* Avatar row — overlaps cover */}
          <div className="relative z-10 flex items-start gap-4 md:gap-6" style={{ marginTop: -42 }}>

            {/* Avatar */}
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                className="h-[86px] w-[86px] shrink-0 rounded-full border-4 object-cover shadow-card md:h-[110px] md:w-[110px]"
                style={{ borderColor: 'var(--color-bg)' }}
              />
            ) : (
              <div
                className="flex h-[86px] w-[86px] shrink-0 items-center justify-center rounded-full border-4 font-heading text-3xl font-bold text-white shadow-card md:h-[110px] md:w-[110px] md:text-4xl"
                style={{ background: 'linear-gradient(135deg, #5D7052, #C18845)', borderColor: 'var(--color-bg)' }}
              >
                {initial}
              </div>
            )}

            {/* Name + actions — push down on desktop to clear cover */}
            <div className="flex flex-1 items-end justify-between" style={{ paddingTop: 48 }}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-xl font-bold leading-tight text-text-primary md:text-2xl">{profile.displayName}</h1>
                  {isAdmin && (
                    <span className="flex items-center gap-0.5 rounded-lg bg-sage/10 px-2 py-0.5 text-[11px] font-bold text-sage">
                      <Crown className="h-3 w-3" /> {t('admin.badge_admin')}
                    </span>
                  )}
                </div>
                {profile.username && (
                  <p className="text-sm text-text-secondary">@{profile.username}</p>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                {isSelf && (
                  <Link
                    to="/settings"
                    className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-border-subtle bg-surface px-3 py-2 text-xs font-semibold text-text-primary no-underline transition-colors hover:bg-surface-2"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t('profile.edit_profile')}</span>
                  </Link>
                )}
                {isAuthenticated && !isSelf && (
                  <>
                    <FollowButton following={following} loading={socialLoading} onClick={handleFollowToggle} t={t} />
                    <FriendButton status={friendship.status} loading={socialLoading} onClick={handleFriendAction} t={t} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-4 flex flex-wrap items-center gap-5 border-b border-border-subtle pb-4 text-sm md:gap-8">
            <div className="flex items-center gap-1">
              <span className="font-heading font-bold text-text-primary">{profile.stats.spotsContributed}</span>
              <span className="text-text-secondary">{t('profile.spots_contributed')}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-heading font-bold text-text-primary">{profile.stats.followersCount}</span>
              <span className="text-text-secondary">{t('profile.followers_count')}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-heading font-bold text-text-primary">{profile.stats.friendsCount}</span>
              <span className="text-text-secondary">{t('profile.friends_count')}</span>
            </div>
            {profile.level && (
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                LEVEL_CLS[profile.level] || 'bg-surface-2 text-text-secondary border-border-subtle',
              )}>
                {t(`level.${profile.level}`)}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
              <Calendar className="h-3 w-3" />
              {t('profile.member_since')} {new Date(profile.memberSince).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
          </div>

          {/* ── Desktop 2-col / Mobile single-col ── */}
          <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">

            {/* LEFT: info panel (desktop only) */}
            <aside className="hidden lg:flex lg:flex-col lg:gap-4">
              <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface p-4 shadow-soft">
                <h3 className="mb-2 font-heading text-sm font-bold text-text-primary">{t('profile.about')}</h3>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {t('profile.member_since')} {new Date(profile.memberSince).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </p>
                {profile.level && (
                  <div className="mt-3">
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold',
                      LEVEL_CLS[profile.level] || 'bg-surface-2 text-text-secondary border-border-subtle',
                    )}>
                      {t(`level.${profile.level}`)}
                    </span>
                  </div>
                )}
              </div>

              <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface p-4 shadow-soft">
                <h3 className="mb-3 font-heading text-sm font-bold text-text-primary">{t('profile.stats_title')}</h3>
                {[
                  { label: t('profile.spots_contributed'), value: profile.stats.spotsContributed, color: '#5D7052' },
                  { label: t('profile.followers_count'), value: profile.stats.followersCount, color: '#C18845' },
                  { label: t('profile.friends_count'), value: profile.stats.friendsCount, color: '#6A645A' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="mb-3 last:mb-0">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-text-primary">{label}</span>
                      <span className="font-semibold text-text-primary">{value}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / Math.max(1, profile.stats.spotsContributed + profile.stats.followersCount + profile.stats.friendsCount)) * 100)}%`, background: color }} />
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            {/* RIGHT: tabbed activity */}
            <div>
              {/* Tabs */}
              <div className="mb-4 flex gap-1 border-b border-border-subtle md:gap-0">
                {([
                  ['activity', t('profile.tab_activity'), BookOpen],
                  ['spots', t('profile.tab_spots'), MapPin],
                  ['reviews', t('profile.tab_reviews'), Star],
                ] as const).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={cn(
                      'flex cursor-pointer items-center gap-1.5 px-3 py-2.5 text-sm font-semibold transition-colors md:px-4',
                      activeTab === key
                        ? 'border-b-2 border-sage text-sage'
                        : 'border-b-2 border-transparent text-text-secondary hover:text-text-primary',
                    )}
                    style={{ marginBottom: -1 }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Activity tab */}
              {activeTab === 'activity' && (
                <div className="space-y-2">
                  {recentAscents.length === 0 && recentReviews.length === 0 ? (
                    <p className="rounded-[var(--radius-md)] border border-dashed border-border-subtle py-10 text-center text-sm text-text-secondary/60">
                      {t('profile.no_ascents')}
                    </p>
                  ) : (
                    <>
                      {recentAscents.map((a) => {
                        const date = new Date(a.date || a.createdAt);
                        return (
                          <div key={a._id} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border-subtle bg-surface px-4 py-3 shadow-soft">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-sage-muted text-sage">
                              <BookOpen className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-text-primary">
                                <span className="text-text-secondary font-normal">{t('profile.action_ascent')} </span>
                                {a.routeName || a.spotName || '—'}
                              </p>
                              <p className="text-xs text-text-secondary">{a.spotName} · {date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {a.grade && (
                                <span className="rounded-md border border-border-subtle bg-surface-2/60 px-2 py-0.5 text-xs font-bold text-text-primary" style={{ fontFamily: 'ui-monospace, monospace' }}>
                                  {a.grade}
                                </span>
                              )}
                              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', STYLE_CLS[a.style] || STYLE_CLS.repeat)}>
                                {t(`logbook.style.${a.style}`)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {recentReviews.map((r) => (
                        <Link
                          key={r._id}
                          to={`/map?spot=${r.spotId}`}
                          className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border-subtle bg-surface px-4 py-3 shadow-soft no-underline transition-shadow hover:shadow-card"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-amber-brand/10 text-amber-brand">
                            <Star className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-text-primary">
                              <span className="text-text-secondary font-normal">{t('profile.action_review')} </span>
                              {r.spotName || '—'}
                            </p>
                            {r.comment && <p className="truncate text-xs text-text-secondary/80">{r.comment}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={cn('h-3 w-3', i < r.rating ? 'fill-amber-brand text-amber-brand' : 'text-border-subtle')} />
                            ))}
                          </div>
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Spots tab */}
              {activeTab === 'spots' && (
                <p className="rounded-[var(--radius-md)] border border-dashed border-border-subtle py-10 text-center text-sm text-text-secondary/60">
                  {t('profile.no_spots')}
                </p>
              )}

              {/* Reviews tab */}
              {activeTab === 'reviews' && (
                <div className="space-y-2">
                  {recentReviews.length === 0 ? (
                    <p className="rounded-[var(--radius-md)] border border-dashed border-border-subtle py-10 text-center text-sm text-text-secondary/60">
                      {t('profile.no_reviews')}
                    </p>
                  ) : recentReviews.map((r) => (
                    <Link
                      key={r._id}
                      to={`/map?spot=${r.spotId}`}
                      className="block rounded-[var(--radius-md)] border border-border-subtle bg-surface px-4 py-3 shadow-soft no-underline transition-shadow hover:shadow-card"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-text-primary">{r.spotName || '—'}</p>
                        <div className="flex shrink-0 items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={cn('h-3 w-3', i < r.rating ? 'fill-amber-brand text-amber-brand' : 'text-border-subtle')} />
                          ))}
                        </div>
                      </div>
                      {r.comment && <p className="mt-1 line-clamp-2 text-xs text-text-secondary/80">{r.comment}</p>}
                    </Link>
                  ))}
                </div>
              )}

              {/* Public gear */}
              {activeTab === 'activity' && publicGear !== null && publicGear.length > 0 && (
                <section className="mt-4">
                  <h2 className="mb-3 flex items-center gap-2 font-heading text-sm font-bold text-text-primary">
                    <Package className="h-4 w-4 text-sage" />
                    {t('gear.public_profile_title')}
                  </h2>
                  <div className="space-y-2">
                    {publicGear.slice(0, 5).map((item) => (
                      <GearCard key={item._id} item={item} readonly />
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FollowButton({ following, loading, onClick, t }: {
  following: boolean; loading: boolean; onClick: () => void; t: (k: string) => string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      type="button"
      className={cn(
        'flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50',
        following
          ? 'border border-border-subtle bg-surface-2 text-text-secondary hover:bg-red-50 hover:text-red-500 hover:border-red-200'
          : 'bg-sage/10 text-sage hover:bg-sage/20',
      )}
    >
      <Users className="h-3.5 w-3.5" />
      {following ? t('profile.following') : t('profile.follow')}
    </button>
  );
}

function FriendButton({ status, loading, onClick, t }: {
  status: FriendshipCheck['status']; loading: boolean; onClick: () => void; t: (k: string) => string;
}) {
  const cfg: Record<string, { icon: typeof UserPlus; label: string; cls: string }> = {
    none: { icon: UserPlus, label: t('friends.add'), cls: 'bg-sage text-white hover:bg-sage-hover' },
    pending_sent: { icon: Clock, label: t('friends.pending_sent'), cls: 'border border-border-subtle bg-surface text-text-secondary cursor-default' },
    pending_received: { icon: UserCheck, label: t('friends.accept'), cls: 'bg-grade-easy/10 text-grade-easy hover:bg-grade-easy/20' },
    accepted: { icon: UserMinus, label: t('friends.already_friends'), cls: 'border border-border-subtle bg-surface-2 text-text-secondary hover:bg-red-50 hover:text-red-500 hover:border-red-200' },
  };
  const { icon: Icon, label, cls } = cfg[status] || cfg.none;
  return (
    <button
      onClick={onClick}
      disabled={loading || status === 'pending_sent'}
      type="button"
      className={cn('flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50', cls)}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
