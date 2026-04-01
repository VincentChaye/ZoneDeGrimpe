import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Shield, Check, X, Trash2, MapPin, Loader2, ChevronLeft, ChevronRight,
  Eye, FileEdit,
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

type Tab = 'pending' | 'edits';

export function AdminSpotsPage() {
  const { t } = useTranslation();
  const { isAdmin } = useAuthStore();

  const [tab, setTab] = useState<Tab>('pending');
  const [spots, setSpots] = useState<PendingSpot[]>([]);
  const [edits, setEdits] = useState<PendingEdit[]>([]);
  const [totalSpots, setTotalSpots] = useState(0);
  const [totalEdits, setTotalEdits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectType, setRejectType] = useState<'spot' | 'edit'>('spot');

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

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    Promise.all([loadPendingSpots(), loadPendingEdits()]).finally(() => setLoading(false));
  }, [isAdmin, loadPendingSpots, loadPendingEdits]);

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
    if (!confirm('Supprimer définitivement ce spot ?')) return;
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
        <p className="text-sm text-text-secondary">Accès réservé aux administrateurs</p>
        <Link to="/" className="text-sm font-medium text-sage no-underline hover:text-sage-hover">
          Retour à l'accueil
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
          <h1 className="font-heading text-2xl font-bold text-text-primary">Gestion des Spots</h1>
          <p className="text-sm text-text-secondary">Approuver, rejeter ou supprimer des spots et modifications</p>
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
          Spots en attente
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
          Modifications
          {totalEdits > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-brand px-1.5 text-[10px] font-bold text-white">
              {totalEdits}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-sage" />
        </div>
      ) : tab === 'pending' ? (
        /* Pending spots */
        spots.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle py-16 text-center">
            <Check className="mb-3 h-10 w-10 text-grade-easy/30" />
            <p className="text-sm font-medium text-text-secondary">Aucun spot en attente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {spots.map((spot) => {
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
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 font-medium">{spot.type}</span>
                        {spot.niveau_max && (
                          <span className="rounded bg-surface-2 px-1.5 py-0.5">{spot.niveau_min || '?'} → {spot.niveau_max}</span>
                        )}
                      </div>
                      {spot.description && (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-text-secondary/80">{spot.description}</p>
                      )}
                      <p className="mt-1.5 text-[11px] text-text-secondary/60">
                        Proposé par <span className="font-medium">{spot.submittedBy?.displayName || spot.createdBy?.displayName || '?'}</span>
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
                      Approuver
                    </button>
                    <button
                      onClick={() => { setRejectId(spot._id); setRejectType('spot'); }}
                      disabled={isLoading}
                      className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border-subtle px-3 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-50 active:scale-95"
                      type="button"
                    >
                      <X className="h-3.5 w-3.5" />
                      Rejeter
                    </button>
                    <button
                      onClick={() => deleteSpot(spot._id)}
                      disabled={isLoading}
                      className="ml-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary/40 transition-colors hover:bg-grade-expert/5 hover:text-grade-expert disabled:opacity-50 active:scale-95"
                      type="button"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Pending edits */
        edits.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle py-16 text-center">
            <Check className="mb-3 h-10 w-10 text-grade-easy/30" />
            <p className="text-sm font-medium text-text-secondary">Aucune modification en attente</p>
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
                        Par <span className="font-medium">{edit.proposedBy.displayName}</span>
                        {' '}&middot; {new Date(edit.createdAt).toLocaleDateString()}
                      </p>
                      {/* Diff */}
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
                      Appliquer
                    </button>
                    <button
                      onClick={() => { setRejectId(edit._id); setRejectType('edit'); }}
                      disabled={isLoading}
                      className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border-subtle px-3 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-50 active:scale-95"
                      type="button"
                    >
                      <X className="h-3.5 w-3.5" />
                      Rejeter
                    </button>
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
            <h3 className="mb-3 font-heading text-lg font-bold text-text-primary">Raison du rejet</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Optionnel : expliquez la raison..."
              className="w-full resize-none rounded-xl border border-border-subtle bg-surface-2 px-4 py-3 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-sage"
              rows={3}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setRejectId(null); setRejectReason(''); }}
                className="cursor-pointer rounded-lg border border-border-subtle px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-2"
                type="button"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (rejectType === 'spot') rejectSpot(rejectId, rejectReason);
                  else rejectEdit(rejectId, rejectReason);
                }}
                className="cursor-pointer rounded-lg bg-grade-expert px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-grade-expert/90"
                type="button"
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
