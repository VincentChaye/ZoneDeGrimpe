import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  MapPin, CheckCircle2, Crown, Calendar, Loader2, ArrowLeft,
  UserPlus, UserCheck, Clock, UserMinus, Users,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import type { FriendshipCheck } from '@/types';

interface PublicProfile {
  displayName: string;
  username?: string;
  avatarUrl?: string;
  level?: string;
  roles: string[];
  memberSince: string;
  stats: {
    spotsContributed: number;
    spotsApproved: number;
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

  useEffect(() => {
    if (!userId) { setError(t('profile.id_missing')); setLoading(false); return; }
    apiFetch<PublicProfile>(`/api/users/${userId}/public`)
      .then((data) => setProfile(data))
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
    <div className="mx-auto max-w-lg px-4 py-8 pb-24 md:pb-8">
      <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-card">
        <div className="relative h-28 bg-gradient-to-br from-sage/20 via-amber-brand/10 to-sage/5">
          <div className="absolute -bottom-10 left-5">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                className="h-20 w-20 rounded-2xl border-4 border-surface object-cover shadow-card"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-surface bg-sage text-2xl font-bold text-white shadow-card">
                {initial}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pt-14 pb-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-xl font-bold text-text-primary">{profile.displayName}</h1>
                {isAdmin && (
                  <span className="flex items-center gap-0.5 rounded-lg bg-sage/10 px-2 py-0.5 text-[11px] font-bold text-sage">
                    <Crown className="h-3 w-3" /> {t('admin.badge_admin')}
                  </span>
                )}
              </div>
              {profile.username && (
                <p className="mt-0.5 text-sm text-text-secondary">@{profile.username}</p>
              )}
            </div>

            {/* Social buttons — only for others when logged in */}
            {isAuthenticated && !isSelf && (
              <div className="flex shrink-0 gap-2">
                <FollowButton following={following} loading={socialLoading} onClick={handleFollowToggle} t={t} />
                <FriendButton status={friendship.status} loading={socialLoading} onClick={handleFriendAction} t={t} />
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {profile.level && (
              <span className={cn(
                'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold',
                LEVEL_CLS[profile.level] || 'bg-surface-2 text-text-secondary border-border-subtle',
              )}>
                {t(`level.${profile.level}`)}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-text-secondary">
              <Calendar className="h-3 w-3" />
              {t('profile.member_since')} {new Date(profile.memberSince).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px border-t border-border-subtle bg-border-subtle">
          <div className="flex flex-col items-center gap-1 bg-surface px-4 py-5">
            <div className="flex items-center gap-1.5 text-sage">
              <MapPin className="h-4 w-4" />
              <span className="font-heading text-2xl font-bold">{profile.stats.spotsContributed}</span>
            </div>
            <span className="text-xs font-medium text-text-secondary">{t('profile.spots_contributed')}</span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-surface px-4 py-5">
            <div className="flex items-center gap-1.5 text-grade-easy">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-heading text-2xl font-bold">{profile.stats.spotsApproved}</span>
            </div>
            <span className="text-xs font-medium text-text-secondary">{t('profile.spots_approved')}</span>
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
