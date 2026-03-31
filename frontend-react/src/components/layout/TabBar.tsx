import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, MapPin, Bookmark, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/', key: 'nav.home', icon: Home },
  { to: '/map', key: 'nav.map', icon: MapPin },
  { to: '/my-spots', key: 'nav.my_spots', icon: Bookmark },
  { to: '/settings', key: 'nav.profile', icon: User },
] as const;

export function TabBar() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 md:hidden',
        'flex h-[var(--spacing-tabbar)] items-stretch',
        'bg-surface/95 backdrop-blur-md',
        'border-t border-border-subtle',
        'safe-area-pb',
      )}
      aria-label="Navigation mobile"
    >
      {TABS.map(({ to, key, icon: Icon }) => {
        const isActive = location.pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 no-underline transition-colors duration-200',
              isActive
                ? 'text-sage'
                : 'text-text-secondary hover:text-sage',
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon
              className={cn(
                'h-5 w-5 transition-all duration-200',
                isActive && 'scale-110',
              )}
              strokeWidth={isActive ? 2.25 : 1.75}
            />
            <span className="text-[10px] font-medium leading-tight">
              {t(key)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
