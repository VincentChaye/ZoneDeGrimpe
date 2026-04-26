import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Shield, Search, Loader2, UserCog, Crown, Ban, Trash2, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

interface AdminUser {
  _id: string;
  displayName: string;
  email: string;
  username?: string;
  roles: string[];
  status?: string;
  security?: { createdAt?: string };
}

export function AdminUsersPage() {
  const { t } = useTranslation();
  const { isAdmin, user: currentUser } = useAuthStore();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const limit = 20;

  const loadUsers = useCallback(async (s: string, p: number) => {
    setLoading(true);
    try {
      const q = s ? `&search=${encodeURIComponent(s)}` : '';
      const data = await apiFetch<{ items: AdminUser[]; total: number }>(
        `/api/users?limit=${limit}&skip=${p * limit}${q}`,
        { auth: true },
      );
      setUsers(data?.items ?? []);
      setTotal(data?.total ?? 0);
    } catch (err) {
      console.error('loadUsers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadUsers(search, page);
  }, [isAdmin, search, page, loadUsers]);

  const toggleAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
    setActionLoading(userId);
    try {
      const newRoles = isCurrentlyAdmin ? ['user'] : ['admin'];
      await apiFetch(`/api/users/${userId}`, {
        method: 'PATCH', auth: true,
        body: JSON.stringify({ roles: newRoles }),
      });
      setUsers((prev) => prev.map((u) => u._id === userId ? { ...u, roles: newRoles } : u));
    } catch (err) {
      console.error('toggleAdmin:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleBan = async (userId: string, isBanned: boolean) => {
    setActionLoading(userId);
    try {
      const newStatus = isBanned ? 'active' : 'banned';
      await apiFetch(`/api/users/${userId}`, {
        method: 'PATCH', auth: true,
        body: JSON.stringify({ status: newStatus }),
      });
      setUsers((prev) => prev.map((u) => u._id === userId ? { ...u, status: newStatus } : u));
    } catch (err) {
      console.error('toggleBan:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const deleteUser = async (userId: string, name: string) => {
    if (!confirm(t('admin.delete_user_confirm', { name }))) return;
    setActionLoading(userId);
    try {
      await apiFetch(`/api/users/${userId}`, { method: 'DELETE', auth: true });
      setUsers((prev) => prev.filter((u) => u._id !== userId));
      setTotal((n) => n - 1);
    } catch (err) {
      console.error('deleteUser:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <Shield className="h-12 w-12 text-text-secondary/30" />
        <p className="text-sm text-text-secondary">{t('admin.access_denied')}</p>
        <Link to="/" className="text-sm font-medium text-sage no-underline hover:text-sage-hover">
          {t('admin.back_home')}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:pb-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage text-white">
          <UserCog className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">{t('admin.users_title')}</h1>
          <p className="text-sm text-text-secondary">{t('admin.users_count', { count: total })}</p>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-2 rounded-xl border border-border-subtle bg-surface px-4 shadow-soft transition-all focus-within:border-sage focus-within:shadow-card">
        <Search className="h-4 w-4 shrink-0 text-text-secondary/60" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder={t('admin.search_users')}
          className="w-full bg-transparent py-3 text-sm text-text-primary outline-none placeholder:text-text-secondary/50"
        />
        {search && (
          <button
            onClick={() => { setSearch(''); setPage(0); }}
            className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-text-secondary/10 text-text-secondary transition-colors hover:bg-text-secondary/20"
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-sage" />
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle py-16 text-center">
          <UserCog className="mb-3 h-10 w-10 text-text-secondary/20" />
          <p className="text-sm font-medium text-text-secondary">{t('admin.no_users')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const isUserAdmin = u.roles?.includes('admin');
            const isBanned = u.status === 'banned';
            const isSelf = u._id === currentUser?._id;
            const isLoading = actionLoading === u._id;

            return (
              <div
                key={u._id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border border-border-subtle bg-surface p-4 shadow-soft transition-shadow hover:shadow-card',
                  isBanned && 'opacity-60',
                )}
              >
                <div className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                  isUserAdmin ? 'bg-sage text-white' : 'bg-sage-muted text-sage',
                )}>
                  {(u.displayName || '?')[0].toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link to={`/profile?id=${u._id}`} className="truncate text-sm font-semibold text-text-primary no-underline hover:text-sage">
                      {u.displayName}
                    </Link>
                    {isUserAdmin && (
                      <span className="flex items-center gap-0.5 rounded bg-sage/10 px-1.5 py-0.5 text-[10px] font-bold text-sage">
                        <Crown className="h-2.5 w-2.5" /> {t('admin.badge_admin')}
                      </span>
                    )}
                    {isBanned && (
                      <span className="flex items-center gap-0.5 rounded bg-grade-expert/10 px-1.5 py-0.5 text-[10px] font-bold text-grade-expert">
                        <Ban className="h-2.5 w-2.5" /> {t('admin.badge_banned')}
                      </span>
                    )}
                    {isSelf && (
                      <span className="rounded bg-amber-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-brand">{t('admin.badge_you')}</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-text-secondary">{u.email}</p>
                  {u.security?.createdAt && (
                    <p className="text-[11px] text-text-secondary/50">
                      {t('admin.registered_on')} {new Date(u.security.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {!isSelf && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => toggleAdmin(u._id, isUserAdmin)}
                      disabled={isLoading}
                      className={cn(
                        'flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-all disabled:opacity-50 active:scale-95',
                        isUserAdmin
                          ? 'border border-border-subtle text-text-secondary hover:bg-surface-2'
                          : 'bg-sage/10 text-sage hover:bg-sage/20',
                      )}
                      type="button"
                      title={isUserAdmin ? t('admin.remove_admin') : t('admin.promote_admin')}
                    >
                      <Crown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => toggleBan(u._id, isBanned)}
                      disabled={isLoading}
                      className={cn(
                        'flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-all disabled:opacity-50 active:scale-95',
                        isBanned
                          ? 'bg-grade-easy/10 text-grade-easy hover:bg-grade-easy/20'
                          : 'border border-border-subtle text-text-secondary hover:bg-grade-expert/5 hover:text-grade-expert',
                      )}
                      type="button"
                      title={isBanned ? t('admin.unban') : t('admin.ban')}
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteUser(u._id, u.displayName)}
                      disabled={isLoading}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary/40 transition-colors hover:bg-grade-expert/5 hover:text-grade-expert disabled:opacity-50 active:scale-95"
                      type="button"
                      title={t('common.delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border-subtle text-text-secondary transition-colors hover:bg-surface-2 disabled:cursor-default disabled:opacity-30"
            type="button"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-text-secondary">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border-subtle text-text-secondary transition-colors hover:bg-surface-2 disabled:cursor-default disabled:opacity-30"
            type="button"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
