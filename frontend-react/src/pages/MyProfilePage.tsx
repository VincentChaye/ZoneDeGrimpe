import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Bookmark, BookOpen, Package, Crown, Settings } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { FriendsPage } from './FriendsPage';
import { MySpotsPage } from './MySpotsPage';
import { LogbookPage } from './LogbookPage';
import { GearPage } from './GearPage';
import { cn } from '@/lib/utils';

type Tab = 'friends' | 'spots' | 'logbook' | 'gear';

const TABS: { id: Tab; icon: typeof Users; labelKey: string }[] = [
  { id: 'friends', icon: Users, labelKey: 'nav.friends' },
  { id: 'spots', icon: Bookmark, labelKey: 'nav.my_spots' },
  { id: 'logbook', icon: BookOpen, labelKey: 'nav.logbook' },
  { id: 'gear', icon: Package, labelKey: 'profile.tab_gear' },
];

export function MyProfilePage() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('friends');

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-text-secondary">{t('auth.login_required')}</p>
        <Link
          to="/login"
          className="rounded-xl bg-sage px-4 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-sage-hover"
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
      {/* Profile header */}
      <div className="border-b border-border-subtle bg-surface">
        <div className="mx-auto max-w-lg px-4 pt-6 pb-0">
          {/* Top row: avatar + settings */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="h-16 w-16 rounded-2xl border-2 border-border-subtle object-cover shadow-soft"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sage text-xl font-bold text-white shadow-soft">
                  {initial}
                </div>
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-heading text-lg font-bold text-text-primary leading-tight">
                    {user.displayName}
                  </h1>
                  {isAdmin && (
                    <span className="flex items-center gap-0.5 rounded-lg bg-sage/10 px-1.5 py-0.5 text-[10px] font-bold text-sage">
                      <Crown className="h-2.5 w-2.5" /> Admin
                    </span>
                  )}
                </div>
                {user.username && (
                  <p className="text-xs text-text-secondary mt-0.5">@{user.username}</p>
                )}
                {user.profile?.level && (
                  <span className="inline-block mt-1 rounded-lg bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-text-secondary border border-border-subtle">
                    {t(`level.${user.profile?.level}`)}
                  </span>
                )}
              </div>
            </div>

            <Link
              to="/settings"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-2 text-text-secondary no-underline transition-colors hover:bg-sage-muted hover:text-sage"
              aria-label={t('nav.profile')}
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>

          {/* Inner tab bar */}
          <div className="flex gap-0 border-b border-border-subtle -mx-4">
            {TABS.map(({ id, icon: Icon, labelKey }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex flex-1 cursor-pointer flex-col items-center gap-1 px-2 py-3 transition-colors',
                  'border-b-2 -mb-px text-xs font-medium',
                  activeTab === id
                    ? 'border-sage text-sage'
                    : 'border-transparent text-text-secondary hover:text-text-primary',
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={activeTab === id ? 2.25 : 1.75} />
                <span className="text-[9px] leading-none">{t(labelKey)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'friends' && <FriendsPage />}
        {activeTab === 'spots' && <MySpotsPage />}
        {activeTab === 'logbook' && <LogbookPage />}
        {activeTab === 'gear' && <GearPage />}
      </div>
    </div>
  );
}

