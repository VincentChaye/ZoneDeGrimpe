import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Sun, Moon, Menu, X } from 'lucide-react';
import { useThemeStore } from '@/stores/theme.store';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationsStore } from '@/stores/notifications.store';
import { cn } from '@/lib/utils';
import { SUPPORTED_LANGS } from '@/i18n/config';
import logo from '@/assets/ZoneDeGrimpeIcon.png';

const PUBLIC_LINKS = [
  { to: '/', key: 'nav.home' },
  { to: '/map', key: 'nav.map' },
];

const AUTH_LINKS = [
  { to: '/feed', key: 'nav.feed' },
  { to: '/messages', key: 'nav.messages' },
  { to: '/me', key: 'nav.profile' },
];

export function Header() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { theme, toggle } = useThemeStore();
  const { isAuthenticated } = useAuthStore();
  const { unreadCount, fetchUnreadCount } = useNotificationsStore();
  const [menuOpen, setMenuOpen] = useState(false);

  // Poll unread count every 30s when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchUnreadCount]);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex items-center justify-between',
        'h-[var(--spacing-header)] px-4',
        'bg-surface/95 backdrop-blur-md',
        'border-b border-border-subtle',
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
        {[...PUBLIC_LINKS, ...(isAuthenticated ? AUTH_LINKS : [])].map(({ to, key }) => (
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
        {/* Login / Register if not authenticated — desktop only (mobile menu handles it) */}
        {!isAuthenticated && (
          <>
            <Link
              to="/login"
              className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary no-underline transition-colors hover:bg-sage-muted hover:text-sage md:block"
            >
              {t('auth.login')}
            </Link>
            <Link
              to="/register"
              className="hidden rounded-[var(--radius-sm)] bg-sage px-3 py-1.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-sage-hover md:block"
            >
              {t('auth.register')}
            </Link>
          </>
        )}

        {/* Notifications bell */}
        {isAuthenticated && (
          <Link
            to="/notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-sage-muted hover:text-sage"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
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

        {/* Hamburger toggle — mobile only */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-sage-muted hover:text-sage md:hidden"
          aria-label={menuOpen ? t('nav.close_menu') : t('nav.open_menu')}
          type="button"
        >
          {menuOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="absolute left-0 right-0 top-full z-40 border-b border-border-subtle bg-surface/98 shadow-elevated backdrop-blur-md md:hidden">
          <nav className="flex flex-col px-4 py-3 gap-1" aria-label="Menu mobile">
            {[...PUBLIC_LINKS, ...(isAuthenticated ? AUTH_LINKS : [])].map(({ to, key }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  'rounded-xl px-4 py-3 text-sm font-medium transition-colors no-underline',
                  location.pathname === to
                    ? 'bg-sage-muted text-sage font-semibold'
                    : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
                )}
              >
                {t(key)}
              </Link>
            ))}
            {!isAuthenticated && (
              <div className="mt-2 flex flex-col gap-2 border-t border-border-subtle pt-3">
                <Link to="/login" className="rounded-xl border border-border-subtle px-4 py-3 text-center text-sm font-semibold text-text-primary no-underline transition-colors hover:bg-surface-2">
                  {t('auth.login')}
                </Link>
                <Link to="/register" className="rounded-xl bg-sage px-4 py-3 text-center text-sm font-semibold text-white no-underline transition-colors hover:bg-sage-hover">
                  {t('auth.register')}
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
