import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, MapPin, MessageSquare, Newspaper, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/', key: 'nav.home', icon: Home },
  { to: '/map', key: 'nav.map', icon: MapPin },
  { to: '/messages', key: 'nav.messages', icon: MessageSquare },
  { to: '/feed', key: 'nav.feed', icon: Newspaper },
  { to: '/me', key: 'nav.profile', icon: User },
] as const;

export function TabBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const activeIndex = TABS.findIndex(({ to }) => location.pathname === to);

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 md:hidden',
        'flex flex-col bg-surface/95 backdrop-blur-md border-t border-border-subtle',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigation mobile"
    >
      {/* Sliding active indicator */}
      {activeIndex >= 0 && (
        <div
          className="absolute top-0 h-0.5 bg-sage transition-all duration-300 ease-out"
          style={{
            width: `${100 / TABS.length}%`,
            left: `${(activeIndex * 100) / TABS.length}%`,
          }}
        />
      )}

      <div className="flex h-[var(--spacing-tabbar)] w-full items-stretch">
      {TABS.map(({ to, key, icon: Icon }) => {
        const isActive = location.pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 no-underline',
              'transition-colors duration-200',
              isActive
                ? 'text-sage'
                : 'text-text-secondary hover:text-sage active:text-sage',
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <div className={cn(
              'relative flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200',
              isActive && 'bg-sage-muted',
            )}>
              <Icon
                className={cn(
                  'h-5 w-5 transition-all duration-200',
                  isActive && 'scale-105',
                )}
                strokeWidth={isActive ? 2.25 : 1.75}
              />
            </div>
            <span className={cn(
              'text-[10px] leading-tight transition-all duration-200',
              isActive ? 'font-semibold' : 'font-medium',
            )}>
              {t(key)}
            </span>
          </Link>
        );
      })}
      </div>
    </nav>
  );
}
