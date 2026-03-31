import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Sun, Moon } from 'lucide-react';
import { useThemeStore } from '@/stores/theme.store';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import { SUPPORTED_LANGS } from '@/i18n/config';
import logo from '@/assets/ZoneDeGrimpeIcon.png';

const NAV_LINKS = [
  { to: '/', key: 'nav.home' },
  { to: '/map', key: 'nav.map' },
  { to: '/my-spots', key: 'nav.my_spots' },
  { to: '/settings', key: 'nav.profile' },
];

export function Header() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { theme, toggle } = useThemeStore();
  const { isAuthenticated } = useAuthStore();

  const isCompact = location.pathname === '/map';

  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex items-center justify-between',
        'h-[var(--spacing-header)] px-4',
        'bg-surface/95 backdrop-blur-md',
        'border-b border-border-subtle',
        isCompact && 'absolute left-0 right-0',
      )}
    >
      {/* Brand */}
      <Link to="/" className="flex items-center gap-2 no-underline">
        <img src={logo} alt="ZoneDeGrimpe" className="h-8 w-8" />
        <span className="hidden font-heading text-lg font-bold text-text-primary sm:inline">
          ZoneDeGrimpe
        </span>
      </Link>

      {/* Desktop nav */}
      <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
        {NAV_LINKS.map(({ to, key }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-200',
              'hover:bg-sage-muted hover:text-sage no-underline',
              location.pathname === to
                ? 'bg-sage-muted text-sage font-semibold'
                : 'text-text-secondary',
            )}
          >
            {t(key)}
          </Link>
        ))}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications bell */}
        {isAuthenticated && (
          <Link
            to="/notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-sage-muted hover:text-sage"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
          </Link>
        )}

        {/* Language selector */}
        <select
          value={i18n.language}
          onChange={(e) => {
            i18n.changeLanguage(e.target.value);
            localStorage.setItem('zdg_lang', e.target.value);
          }}
          className="h-8 cursor-pointer rounded-md border border-border-subtle bg-surface px-2 text-xs font-medium text-text-secondary outline-none transition-colors hover:border-sage focus:border-sage focus:ring-1 focus:ring-sage"
          aria-label={t('lang.select')}
        >
          {SUPPORTED_LANGS.map((l) => (
            <option key={l} value={l}>
              {l.toUpperCase()}
            </option>
          ))}
        </select>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-sage-muted hover:text-sage"
          aria-label={t('theme.toggle')}
          type="button"
        >
          {theme === 'dark' ? (
            <Sun className="h-[18px] w-[18px]" />
          ) : (
            <Moon className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>
    </header>
  );
}
