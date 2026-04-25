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
  { id: 'friends', icon: Users,    labelKey: 'nav.friends'    },
  { id: 'spots',   icon: Bookmark, labelKey: 'nav.my_spots'   },
  { id: 'logbook', icon: BookOpen, labelKey: 'nav.logbook'    },
  { id: 'gear',    icon: Package,  labelKey: 'profile.tab_gear' },
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
    <div className="pb-24 md:pb-8">

      {/* ── Cover ── */}
      <div
        className="relative h-24 md:h-40"
        style={{ background: 'linear-gradient(135deg, #5D7052 0%, #4A5A41 50%, #C18845 100%)' }}
      >
        <svg viewBox="0 0 1280 160" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-30">
          <path d="M 0 160 L 0 90 L 200 50 L 400 100 L 600 40 L 800 80 L 1000 50 L 1280 90 L 1280 160 Z" fill="rgba(0,0,0,0.4)" />
        </svg>
      </div>

      {/* ── Profile header ── */}
      <div className="px-4 md:px-12">
        <div className="mx-auto max-w-4xl">

          {/* Avatar row — overlaps cover */}
          <div className="relative z-10 flex items-start gap-4" style={{ marginTop: -42 }}>

            {/* Avatar */}
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
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

            {/* Name + settings */}
            <div className="flex flex-1 items-end justify-between" style={{ paddingTop: 48 }}>
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

              <Link
                to="/settings"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface text-text-secondary no-underline transition-colors hover:bg-sage-muted hover:text-sage"
                aria-label={t('settings.title')}
              >
                <Settings className="h-4 w-4" />
              </Link>
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
        {activeTab === 'friends' && <FriendsPage />}
        {activeTab === 'spots'   && <MySpotsPage />}
        {activeTab === 'logbook' && <LogbookPage />}
        {activeTab === 'gear'    && <GearPage />}
      </div>
    </div>
  );
}
