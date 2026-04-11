import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Shield, Check, X, Trash2, MapPin, Loader2, FileEdit, Route as RouteIcon,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface PendingSpot {
  _id: string;
  name: string;
  type: string;
  niveau_min?: string | null;
  niveau_max?: string | null;
  description?: string | null;
  status: string;
  submittedBy?: { uid: string; displayName: string } | null;
  createdBy?: { uid: string; displayName: string } | null;
  createdAt?: string;
}

interface PendingEdit {
  _id: string;
  spotId: string;
  spotName: string;
  changes: Record<string, unknown>;
  previousValues: Record<string, unknown>;
  proposedBy: { uid: string; displayName: string };
  createdAt: string;
}

interface PendingRoute {
  _id: string;
  spotId: string;
  name: string;
  grade?: string;
  style?: string;
  imageUrl?: string;
  createdBy: { uid: string; displayName: string };
  createdAt: string;
}

type Tab = 'pending' | 'edits' | 'routes';

export function AdminSpotsPage() {
  const { t } = useTranslation();
  const { isAdmin } = useAuthStore();

  const [tab, setTab] = useState<Tab>('pending');
  const [spots, setSpots] = useState<PendingSpot[]>([]);
  const [edits, setEdits] = useState<PendingEdit[]>([]);
  const [pendingRoutes, setPendingRoutes] = useState<PendingRoute[]>([]);
  const [totalSpots, setTotalSpots] = useState(0);
  const [totalEdits, setTotalEdits] = useState(0);
  const [totalRoutes, setTotalRoutes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectType, setRejectType] = useState<'spot' | 'edit' | 'route'>('spot');
  const [filterType, setFilterType] = useState('');

  const loadPendingSpots = useCallback(async () => {
    try {
      const data = await apiFetch<{ items: PendingSpot[]; total: number }>('/api/spots/pending?limit=50', { auth: true });
      setSpots(data?.items ?? []);
      setTotalSpots(data?.total ?? 0);
    } catch (err) {
      console.error('loadPendingSpots:', err);
    }
  }, []);

  const loadPendingEdits = useCallback(async () => {
    try {
      const data = await apiFetch<{ items: PendingEdit[]; total: number }>('/api/spot-edits/pending?limit=50', { auth: true });
      setEdits(data?.items ?? []);
      setTotalEdits(data?.total ?? 0);
    } catch (err) {
      console.error('loadPendingEdits:', err);
    }
  }, []);

  const loadPendingRoutes = useCallback(async () => {
    try {
      const data = await apiFetch<{ items: PendingRoute[]; total: number }>('/api/climbing-routes/pending?limit=50', { auth: true });
      setPendingRoutes(data?.items ?? []);
      setTotalRoutes(data?.total ?? 0);
    } catch (err) {
      console.error('loadPendingRoutes:', err);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    Promise.all([loadPendingSpots(), loadPendingEdits(), loadPendingRoutes()]).finally(() => setLoading(false));
  }, [isAdmin, loadPendingSpots, loadPendingEdits, loadPendingRoutes]);

  const approveSpot = async (id: string) => {
    setActionLoading(id);
    try {
      await apiFetch(`/api/spots/${id}/approve`, { method: 'PATCH', auth: true });
      setSpots((s) => s.filter((sp) => sp._id !== id));
      setTotalSpots((n) => n - 1);
    } catch (err) {
      console.error('approveSpot:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const rejectSpot = async (id: string, reason: string) => {
    setActionLoading(id);
    try {
      await apiFetch(`/api/spots/${id}/reject`, {
        method: 'PATCH', auth: true,
        body: JSON.stringify({ reason: reason || undefined }),
      });
      setSpots((s) => s.filter((sp) => sp._id !== id));
      setTotalSpots((n) => n - 1);
    } catch (err) {
      console.error('rejectSpot:', err);
    } finally {
      setActionLoading(null);
      setRejectId(null);
      setRejectReason('');
    }
  };

  const deleteSpot = async (id: string) => {
    if (!confirm(t('admin.delete_spot_confirm'))) return;
    setActionLoading(id);
    try {
      await apiFetch(`/api/spots/${id}`, { method: 'DELETE', auth: true });
      setSpots((s) => s.filter((sp) => sp._id !== id));
      setTotalSpots((n) => n - 1);
    } catch (err) {
      console.error('deleteSpot:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const approveEdit = async (editId: string) => {
    setActionLoading(editId);
    try {
      await apiFetch(`/api/spot-edits/${editId}/approve`, { method: 'PATCH', auth: true });
      setEdits((e) => e.filter((ed) => ed._id !== editId));
      setTotalEdits((n) => n - 1);
    } catch (err) {
      console.error('approveEdit:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const approveRoute = async (routeId: string) => {
    setActionLoading(routeId);
    try {
      await apiFetch(`/api/climbing-routes/${routeId}/approve`, { method: 'PATCH', auth: true });
      setPendingRoutes((r) => r.filter((rt) => rt._id !== routeId));
      setTotalRoutes((n) => n - 1);
    } catch (err) {
      console.error('approveRoute:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const rejectRoute = async (routeId: string, reason: string) => {
    setActionLoading(routeId);
    try {
      await apiFetch(`/api/climbing-routes/${routeId}/reject`, {
        method: 'PATCH', auth: true,
        body: JSON.stringify({ reason: reason || undefined }),
      });
      setPendingRoutes((r) => r.filter((rt) => rt._id !== routeId));
      setTotalRoutes((n) => n - 1);
    } catch (err) {
      console.error('rejectRoute:', err);
    } finally {
      setActionLoading(null);
      setRejectId(null);
      setRejectReason('');
    }
  };

  const rejectEdit = async (editId: string, reason: string) => {
    setActionLoading(editId);
    try {
      await apiFetch(`/api/spot-edits/${editId}/reject`, {
        method: 'PATCH', auth: true,
        body: JSON.stringify({ reason: reason || undefined }),
      });
      setEdits((e) => e.filter((ed) => ed._id !== editId));
      setTotalEdits((n) => n - 1);
    } catch (err) {
      console.error('rejectEdit:', err);
    } finally {
      setActionLoading(null);
      setRejectId(null);
      setRejectReason('');
    }
  };

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
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage text-white">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">{t('admin.spots_title')}</h1>
          <p className="text-sm text-text-secondary">{t('admin.spots_subtitle')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-surface-2 p-1">
        <button
          onClick={() => setTab('pending')}
          className={cn(
            'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all',
            tab === 'pending'
              ? 'bg-surface text-text-primary shadow-soft'
              : 'text-text-secondary hover:text-text-primary',
          )}
          type="button"
        >
          <MapPin className="h-4 w-4" />
          {t('admin.tab_pending')}
          {totalSpots > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sage px-1.5 text-[10px] font-bold text-white">
              {totalSpots}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('edits')}
          className={cn(
            'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all',
            tab === 'edits'
              ? 'bg-surface text-text-primary shadow-soft'
              : 'text-text-secondary hover:text-text-primary',
          )}
          type="button"
        >
          <FileEdit className="h-4 w-4" />
          {t('admin.tab_edits')}
          {totalEdits > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-brand px-1.5 text-[10px] font-bold text-white">
              {totalEdits}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('routes')}
          className={cn(
            'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all',
            tab === 'routes'
              ? 'bg-surface text-text-primary shadow-soft'
              : 'text-text-secondary hover:text-text-primary',
          )}
          type="button"
        >
          <RouteIcon className="h-4 w-4" />
          {t('admin.tab_routes')}
          {totalRoutes > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-grade-hard px-1.5 text-[10px] font-bold text-white">
              {totalRoutes}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-sage" />
        </div>
      ) : tab === 'pending' ? (
        spots.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle py-16 text-center">
            <Check className="mb-3 h-10 w-10 text-grade-easy/30" />
            <p className="text-sm font-medium text-text-secondary">{t('admin.no_pending_spots')}</p>
          </div>
        ) : (
          <>
            {/* Type filter */}
            <div className="mb-4 flex flex-wrap gap-2">
              {(['', 'crag', 'boulder', 'indoor', 'shop'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilterType(type)}
                  className={cn(
                    'cursor-pointer rounded-xl px-3 py-1 text-xs font-semibold transition-all',
                    filterType === type
                      ? 'bg-sage text-white'
                      : 'border border-border-subtle bg-surface text-text-secondary hover:bg-surface-2',
                  )}
                >
                  {type ? t(`spot.type.${type}`) : t('myspots.filter_all')}
                </button>
              ))}
            </div>
          <div className="space-y-3">
            {spots.filter((s) => !filterType || s.type === filterType).map((spot) => {
              const isLoading = actionLoading === spot._id;
              return (
                <div
                  key={spot._id}
                  className="rounded-xl border border-border-subtle bg-surface p-4 shadow-soft transition-shadow hover:shadow-card"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sage-muted text-sage">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-text-primary">{spot.name}</h3>
                      <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs text-text-secondary">
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 font-medium">{t(`spot.type.${spot.type}`)}</span>
                        {spot.niveau_max && (
                          <span className="rounded bg-surface-2 px-1.5 py-0.5">{spot.niveau_min || '?'} → {spot.niveau_max}</span>
                        )}
                      </div>
                      {spot.description && (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-text-secondary/80">{spot.description}</p>
                      )}
                      <p className="mt-1.5 text-[11px] text-text-secondary/60">
                        {t('admin.proposed_by')}{' '}
                        {(spot.submittedBy || spot.createdBy) ? (
                          <Link
                            to={`/profile?id=${(spot.submittedBy || spot.createdBy)!.uid}`}
                            className="font-medium text-sage no-underline hover:underline"
                          >
                            {(spot.submittedBy || spot.createdBy)!.displayName}
                          </Link>
                        ) : <span className="font-medium">?</span>}
                        {spot.createdAt && <> &middot; {new Date(spot.createdAt).toLocaleDateString()}</>}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2 border-t border-border-subtle/50 pt-3">
                    <button
                      onClick={() => approveSpot(spot._id)}
                      disabled={isLoading}
                      className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-sage px-3 text-xs font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50 active:scale-95"
                      type="button"
                    >
                      {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      {t('admin.approve')}
                    </button>
                    <button
                      onClick={() => { setRejectId(spot._id); setRejectType('spot'); }}
                      disabled={isLoading}
                      className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border-subtle px-3 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-50 active:scale-95"
                      type="button"
                    >
                      <X className="h-3.5 w-3.5" />
                      {t('admin.reject')}
                    </button>
                    <button
                      onClick={() => deleteSpot(spot._id)}
                      disabled={isLoading}
                      className="ml-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary/40 transition-colors hover:bg-grade-expert/5 hover:text-grade-expert disabled:opacity-50 active:scale-95"
                      type="button"
                      title={t('common.delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )
      ) : (
        edits.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle py-16 text-center">
            <Check className="mb-3 h-10 w-10 text-grade-easy/30" />
            <p className="text-sm font-medium text-text-secondary">{t('admin.no_pending_edits')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {edits.map((edit) => {
              const isLoading = actionLoading === edit._id;
              const changedKeys = Object.keys(edit.changes);
              return (
                <div
                  key={edit._id}
                  className="rounded-xl border border-border-subtle bg-surface p-4 shadow-soft transition-shadow hover:shadow-card"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-brand/10 text-amber-brand">
                      <FileEdit className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-text-primary">{edit.spotName}</h3>
                      <p className="mt-0.5 text-[11px] text-text-secondary/60">
                        {t('admin.by_user')} <span className="font-medium">{edit.proposedBy.displayName}</span>
                        {' '}&middot; {new Date(edit.createdAt).toLocaleDateString()}
                      </p>
                      <div className="mt-2 space-y-1">
                        {changedKeys.map((key) => (
                          <div key={key} className="flex gap-2 text-xs">
                            <span className="shrink-0 font-medium text-text-secondary">{key}:</span>
                            <span className="text-grade-expert line-through">{String(edit.previousValues[key] ?? '—')}</span>
                            <span className="text-grade-easy font-medium">{String(edit.changes[key] ?? '—')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2 border-t border-border-subtle/50 pt-3">
                    <button
                      onClick={() => approveEdit(edit._id)}
                      disabled={isLoading}
                      className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-sage px-3 text-xs font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50 active:scale-95"
                      type="button"
                    >
                      {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      {t('admin.apply')}
                    </button>
                    <button
                      onClick={() => { setRejectId(edit._id); setRejectType('edit'); }}
                      disabled={isLoading}
                      className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border-subtle px-3 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-50 active:scale-95"
                      type="button"
                    >
                      <X className="h-3.5 w-3.5" />
                      {t('admin.reject')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Tab routes */}
      {!loading && tab === 'routes' && (
        pendingRoutes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle py-16 text-center">
            <Check className="mb-3 h-10 w-10 text-grade-easy/30" />
            <p className="text-sm font-medium text-text-secondary">{t('admin.no_pending_routes')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRoutes.map((route) => {
              const isLoading = actionLoading === route._id;
              return (
                <div
                  key={route._id}
                  className="rounded-xl border border-border-subtle bg-surface shadow-soft transition-shadow hover:shadow-card overflow-hidden"
                >
                  {route.imageUrl && (
                    <img src={route.imageUrl} alt={route.name} className="h-40 w-full object-cover" loading="lazy" />
                  )}
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-grade-hard/10 text-grade-hard">
                        <RouteIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-text-primary">{route.name}</h3>
                        <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs text-text-secondary">
                          {route.grade && <span className="rounded bg-surface-2 px-1.5 py-0.5 font-bold">{route.grade}</span>}
                          {route.style && <span className="rounded bg-surface-2 px-1.5 py-0.5">{t(`style.${route.style}`)}</span>}
                        </div>
                        <p className="mt-1.5 text-[11px] text-text-secondary/60">
                          {t('admin.proposed_by')}{' '}
                          <Link
                            to={`/profile?id=${route.createdBy.uid}`}
                            className="font-medium text-sage no-underline hover:underline"
                          >
                            {route.createdBy.displayName}
                          </Link>
                          {' '}&middot; {new Date(route.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2 border-t border-border-subtle/50 pt-3">
                      <button
                        onClick={() => approveRoute(route._id)}
                        disabled={isLoading}
                        className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-sage px-3 text-xs font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50 active:scale-95"
                        type="button"
                      >
                        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        {t('admin.approve')}
                      </button>
                      <button
                        onClick={() => { setRejectId(route._id); setRejectType('route'); }}
                        disabled={isLoading}
                        className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border-subtle px-3 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-50 active:scale-95"
                        type="button"
                      >
                        <X className="h-3.5 w-3.5" />
                        {t('admin.reject')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setRejectId(null)}>
          <div
            className="mx-4 w-full max-w-md rounded-2xl bg-surface p-6 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 font-heading text-lg font-bold text-text-primary">{t('admin.reject_title')}</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('admin.reject_placeholder')}
              className="w-full resize-none rounded-xl border border-border-subtle bg-surface-2 px-4 py-3 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-sage"
              rows={3}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setRejectId(null); setRejectReason(''); }}
                className="cursor-pointer rounded-lg border border-border-subtle px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-2"
                type="button"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  if (rejectType === 'spot') rejectSpot(rejectId, rejectReason);
                  else if (rejectType === 'route') rejectRoute(rejectId, rejectReason);
                  else rejectEdit(rejectId, rejectReason);
                }}
                className="cursor-pointer rounded-lg bg-grade-expert px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-grade-expert/90"
                type="button"
              >
                {t('admin.confirm_reject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
