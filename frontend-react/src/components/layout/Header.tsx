import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Menu } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationsStore } from '@/stores/notifications.store';
import { NavDrawer } from './NavDrawer';
import logo from '@/assets/ZoneDeGrimpeIcon.png';

export function Header() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const { unreadCount, fetchUnreadCount } = useNotificationsStore();

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchUnreadCount]);

  return (
    <>
      <header className="sticky top-0 z-50 flex items-center justify-between h-[var(--spacing-header)] px-4 bg-surface/95 backdrop-blur-md border-b border-border-subtle">
        {/* Left: hamburger (desktop only) + brand */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDrawerOpen(true)}
            className="hidden md:flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:bg-sage-muted hover:text-sage transition-colors"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="flex items-center gap-2 no-underline">
            <img src={logo} alt="ZoneDeGrimpe" className="h-8 w-8" />
            <span className="hidden font-heading text-lg font-bold text-text-primary sm:inline">
              ZoneDeGrimpe
            </span>
          </Link>
        </div>

        {/* Right: notifications bell */}
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
      </header>

      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
