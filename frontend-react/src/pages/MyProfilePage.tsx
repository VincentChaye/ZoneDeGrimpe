import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Bookmark, BookOpen, Package, Crown, Settings, Pencil, Loader2, X, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { apiFetch } from '@/lib/api';
import { MySpotsPage } from './MySpotsPage';
import { LogbookPage } from './LogbookPage';
import { GearPage } from './GearPage';
import { cn } from '@/lib/utils';

type Tab = 'spots' | 'logbook' | 'gear';

const TABS: { id: Tab; icon: typeof Users; labelKey: string }[] = [
  { id: 'logbook', icon: BookOpen, labelKey: 'nav.logbook'      },
  { id: 'gear',    icon: Package,  labelKey: 'profile.tab_gear' },
  { id: 'spots',   icon: Bookmark, labelKey: 'nav.my_spots'     },
];

type SocialUser = { _id: string; displayName?: string; username?: string; avatarUrl?: string };

export function MyProfilePage() {
  const { t } = useTranslation();
  const { user, isAuthenticated, updateUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('logbook');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [followersCount, setFollowersCount] = useState(0);
  const [friendsCount, setFriendsCount] = useState(0);
  const [socialModal, setSocialModal] = useState<{ type: 'followers' | 'friends'; list: SocialUser[] } | null>(null);
  const [socialModalLoading, setSocialModalLoading] = useState(false);
  const [socialSearch, setSocialSearch] = useState('');

  useEffect(() => {
    if (!user?._id) return;
    apiFetch<{ stats: { followersCount: number; friendsCount: number } }>(`/api/users/${user._id}/public`)
      .then((data) => {
        setFollowersCount(data?.stats?.followersCount ?? 0);
        setFriendsCount(data?.stats?.friendsCount ?? 0);
      })
      .catch(() => {});
  }, [user?._id]);

  const openSocialModal = useCallback(async (type: 'followers' | 'friends') => {
    if (!user?._id) return;
    setSocialModalLoading(true);
    setSocialModal({ type, list: [] });
    try {
      const endpoint = type === 'followers'
        ? `/api/follows/followers/${user._id}`
        : `/api/friends/user/${user._id}`;
      const list = await apiFetch<SocialUser[]>(endpoint, { auth: true });
      setSocialModal({ type, list: Array.isArray(list) ? list : [] });
      setSocialSearch('');
    } catch {
      toast.error(t('common.error'));
      setSocialModal(null);
    } finally {
      setSocialModalLoading(false);
    }
  }, [user?._id, t]);

  async function handleAvatarUpload(file: File) {
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const data = await apiFetch<Record<string, unknown>>('/api/users/me/avatar', { method: 'POST', auth: true, body: form });
      if (data?.avatarUrl) updateUser({ avatarUrl: data.avatarUrl as string });
      toast.success(t('settings.saved'));
    } catch (err) {
      console.error('[avatar upload]', err);
      toast.error(t('common.error'));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleCoverUpload(file: File) {
    setUploadingCover(true);
    try {
      const form = new FormData();
      form.append('cover', file);
      const data = await apiFetch<Record<string, unknown>>('/api/users/me/cover', { method: 'POST', auth: true, body: form });
      if (data?.coverUrl) updateUser({ coverUrl: data.coverUrl as string });
      toast.success(t('settings.saved'));
    } catch (err: unknown) {
      const body = (err as { body?: string })?.body;
      console.error('[cover upload]', err, body ? JSON.parse(body) : '');
      toast.error(t('common.error'));
    } finally {
      setUploadingCover(false);
    }
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-text-secondary">{t('auth.login_required')}</p>
        <Link
          to="/login"
          className="rounded-[var(--radius-md)] bg-sage px-4 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-sage-hover"
        >
          {t('auth.login')}
        </Link>
      </div>
    );
  }

  const initial = (user.displayName || '?')[0].toUpperCase();
  const isAdmin = user.roles?.includes('admin');

  return (
    <div>

      {/* ── Cover ── */}
      <div
        className="relative h-24 md:h-40"
        style={user.coverUrl
          ? undefined
          : { background: 'linear-gradient(135deg, #5D7052 0%, #4A5A41 50%, #C18845 100%)' }}
      >
        {user.coverUrl ? (
          <img src={user.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <svg viewBox="0 0 1280 160" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-30">
            <path d="M 0 160 L 0 90 L 200 50 L 400 100 L 600 40 L 800 80 L 1000 50 L 1280 90 L 1280 160 Z" fill="rgba(0,0,0,0.4)" />
          </svg>
        )}

        {/* Crayon bannière — haut gauche */}
        <button
          type="button"
          onClick={() => coverInputRef.current?.click()}
          disabled={uploadingCover}
          className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
          aria-label="Modifier la bannière"
        >
          {uploadingCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
        </button>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); e.target.value = ''; }}
        />

        {/* Roue paramètres — haut droite */}
        <Link
          to="/settings"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm no-underline transition-colors hover:bg-black/70"
          aria-label={t('settings.title')}
        >
          <Settings className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ── Profile header ── */}
      <div className="px-4 md:px-12">
        <div className="mx-auto max-w-4xl">

          {/* Avatar row — overlaps cover */}
          <div className="relative z-10 flex items-start justify-between gap-4" style={{ marginTop: -42 }}>

            {/* Avatar */}
            <div className="relative shrink-0">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="h-[86px] w-[86px] rounded-full border-4 object-cover shadow-card md:h-[110px] md:w-[110px]"
                  style={{ borderColor: 'var(--color-bg)' }}
                />
              ) : (
                <div
                  className="flex h-[86px] w-[86px] items-center justify-center rounded-full border-4 font-heading text-3xl font-bold text-white shadow-card md:h-[110px] md:w-[110px] md:text-4xl"
                  style={{ background: 'linear-gradient(135deg, #5D7052, #C18845)', borderColor: 'var(--color-bg)' }}
                >
                  {initial}
                </div>
              )}

              {/* Crayon avatar */}
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80 md:h-7 md:w-7"
                aria-label="Modifier l'avatar"
              >
                {uploadingAvatar ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3" />}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = ''; }}
              />
            </div>

            {/* Name + settings + stats */}
            <div className="flex flex-1 items-start justify-between" style={{ paddingTop: 48 }}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-xl font-bold leading-tight text-text-primary md:text-2xl">
                    {user.displayName}
                  </h1>
                  {isAdmin && (
                    <span className="flex items-center gap-0.5 rounded-lg bg-sage/10 px-2 py-0.5 text-[11px] font-bold text-sage">
                      <Crown className="h-3 w-3" /> Admin
                    </span>
                  )}
                </div>
                {user.username && (
                  <p className="text-sm text-text-secondary">@{user.username}</p>
                )}
                {user.profile?.level && (
                  <span className="mt-1 inline-block rounded-lg border border-border-subtle bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                    {t(`level.${user.profile.level}`)}
                  </span>
                )}
              </div>

              {/* Stats followers / amis */}
              <div className="flex gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => openSocialModal('followers')}
                  className="cursor-pointer text-right transition-opacity hover:opacity-70"
                >
                  <p className="font-heading font-bold text-text-primary">{followersCount}</p>
                  <p className="text-xs text-text-secondary">{t('profile.followers_count')}</p>
                </button>
                <div className="w-px self-stretch bg-border-subtle" />
                <button
                  type="button"
                  onClick={() => openSocialModal('friends')}
                  className="cursor-pointer text-right transition-opacity hover:opacity-70"
                >
                  <p className="font-heading font-bold text-text-primary">{friendsCount}</p>
                  <p className="text-xs text-text-secondary">{t('profile.friends_count')}</p>
                </button>
              </div>
            </div>
          </div>

          {/* ── Tab bar ── */}
          <div className="mt-5 flex border-b border-border-subtle">
            {TABS.map(({ id, icon: Icon, labelKey }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex flex-1 cursor-pointer flex-col items-center gap-1.5 px-2 py-3 text-xs font-medium transition-colors',
                  'border-b-2 -mb-px',
                  activeTab === id
                    ? 'border-sage text-sage'
                    : 'border-transparent text-text-secondary hover:text-text-primary',
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={activeTab === id ? 2.25 : 1.75} />
                <span>{t(labelKey)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div>
        {activeTab === 'spots'   && <MySpotsPage />}
        {activeTab === 'logbook' && <LogbookPage />}
        {activeTab === 'gear'    && <GearPage />}
      </div>

      {/* Social list modal */}
      {socialModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setSocialModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-surface shadow-card overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <h2 className="font-heading text-sm font-bold text-text-primary">
                {socialModal.type === 'followers' ? t('profile.followers_count') : t('profile.friends_count')}
              </h2>
              <button
                type="button"
                onClick={() => setSocialModal(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-3 py-2 border-b border-border-subtle">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 h-3.5 w-3.5 text-text-secondary/50 pointer-events-none" />
                <input
                  type="text"
                  value={socialSearch}
                  onChange={(e) => setSocialSearch(e.target.value)}
                  placeholder={t('common.search')}
                  className="w-full rounded-lg border border-border-subtle bg-surface-2 py-1.5 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-sage"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {socialModalLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-sage" />
                </div>
              ) : (() => {
                const q = socialSearch.toLowerCase().trim();
                const filtered = q
                  ? socialModal.list.filter(u =>
                      (u.displayName || '').toLowerCase().includes(q) ||
                      (u.username || '').toLowerCase().includes(q)
                    )
                  : socialModal.list;
                return filtered.length === 0 ? (
                  <p className="py-10 text-center text-sm text-text-secondary/60">
                    {t('common.empty')}
                  </p>
                ) : filtered.map((u) => (
                  <Link
                    key={u._id}
                    to={`/profile?id=${u._id}`}
                    onClick={() => setSocialModal(null)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors no-underline"
                  >
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt={u.displayName} className="h-9 w-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-white text-sm"
                        style={{ background: 'linear-gradient(135deg, #5D7052, #C18845)' }}
                      >
                        {(u.displayName || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">{u.displayName || u.username || '—'}</p>
                      {u.username && <p className="truncate text-xs text-text-secondary">@{u.username}</p>}
                    </div>
                  </Link>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
