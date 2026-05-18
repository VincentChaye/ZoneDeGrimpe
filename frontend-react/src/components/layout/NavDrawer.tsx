import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  X, Home, MapPin, MessageSquare, Newspaper, User,
  BookOpen, Star, Users, Settings, Package, Bell, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

const NAV_SECTIONS = [
  {
    title: 'Principal',
    items: [
      { to: '/', icon: Home, label: 'Accueil' },
      { to: '/map', icon: MapPin, label: 'Carte' },
      { to: '/feed', icon: Newspaper, label: "Fil d'actu" },
      { to: '/messages', icon: MessageSquare, label: 'Messages' },
    ],
    requiresAuth: false,
  },
  {
    title: 'Personnel',
    items: [
      { to: '/me', icon: User, label: 'Mon profil' },
      { to: '/logbook', icon: BookOpen, label: 'Carnet de grimpe' },
      { to: '/my-spots', icon: Star, label: 'Mes spots' },
      { to: '/friends', icon: Users, label: 'Amis' },
      { to: '/gear', icon: Package, label: 'Matériel' },
      { to: '/notifications', icon: Bell, label: 'Notifications' },
      { to: '/settings', icon: Settings, label: 'Paramètres' },
    ],
    requiresAuth: true,
  },
] as const;

const ADMIN_ITEMS = [
  { to: '/admin/spots', label: 'Spots' },
  { to: '/admin/users', label: 'Utilisateurs' },
  { to: '/admin/gear', label: 'Matériel' },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NavDrawer({ open, onClose }: Props) {
  const location = useLocation();
  const { isAdmin, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 flex flex-col',
          'bg-surface border-r border-border-subtle',
          'transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Menu principal"
      >
        {/* Header */}
        <div className="flex items-center justify-between h-[var(--spacing-header)] px-4 border-b border-border-subtle flex-shrink-0">
          <span className="font-heading text-lg font-bold text-text-primary">Menu</span>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:bg-sage-muted hover:text-sage transition-colors"
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {NAV_SECTIONS.map(({ title, items, requiresAuth }) => {
            if (requiresAuth && !isAuthenticated) return null;
            return (
              <div key={title}>
                <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-secondary/60">
                  {title}
                </p>
                <div className="space-y-0.5">
                  {items.map(({ to, icon: Icon, label }) => {
                    const isActive = location.pathname === to;
                    return (
                      <Link
                        key={to}
                        to={to}
                        onClick={onClose}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium no-underline transition-colors',
                          isActive
                            ? 'bg-sage-muted text-sage'
                            : 'text-text-secondary hover:bg-sage-muted/50 hover:text-sage',
                        )}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <Icon
                          className="h-5 w-5 flex-shrink-0"
                          strokeWidth={isActive ? 2.25 : 1.75}
                        />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {isAdmin && (
            <div>
              <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-secondary/60">
                Admin
              </p>
              <div className="space-y-0.5">
                {ADMIN_ITEMS.map(({ to, label }) => {
                  const isActive = location.pathname === to;
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium no-underline transition-colors',
                        isActive
                          ? 'bg-sage-muted text-sage'
                          : 'text-text-secondary hover:bg-sage-muted/50 hover:text-sage',
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Shield
                        className="h-5 w-5 flex-shrink-0"
                        strokeWidth={isActive ? 2.25 : 1.75}
                      />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
