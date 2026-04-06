import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import {
  Navigation, Compass, Zap, Bookmark, Share2, MapPin, Star,
  ArrowUpRight, ChevronLeft, ChevronRight, Route as RouteIcon,
  Plus, X, Pencil, Trash2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { cn, getGradeLevel, ORIENT_DEG, SPOT_TYPES } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import type { Spot, ClimbingRoute, ClimbingStyle } from '@/types';

interface SpotSheetProps {
  spot: Spot;
  onClose: () => void;
  onEdit?: (spot: Spot) => void;
}

const GRADE_CLS: Record<string, string> = {
  easy: 'bg-grade-easy/10 text-grade-easy border-grade-easy/20',
  medium: 'bg-grade-medium/10 text-grade-medium border-grade-medium/20',
  hard: 'bg-grade-hard/10 text-grade-hard border-grade-hard/20',
  expert: 'bg-grade-expert/10 text-grade-expert border-grade-expert/20',
  elite: 'bg-grade-elite/10 text-grade-elite border-grade-elite/20',
};

const TYPE_CLS: Record<string, { bg: string; gradient: string; ring: string }> = {
  crag: { bg: 'bg-type-crag', gradient: 'from-type-crag/8 via-type-crag/3', ring: 'ring-type-crag/20' },
  boulder: { bg: 'bg-type-boulder', gradient: 'from-type-boulder/8 via-type-boulder/3', ring: 'ring-type-boulder/20' },
  indoor: { bg: 'bg-type-indoor', gradient: 'from-type-indoor/8 via-type-indoor/3', ring: 'ring-type-indoor/20' },
  shop: { bg: 'bg-type-shop', gradient: 'from-type-shop/8 via-type-shop/3', ring: 'ring-type-shop/20' },
};

const STYLE_LABELS: Record<ClimbingStyle, string> = {
  sport: 'Sport', trad: 'Trad', boulder: 'Bloc', multi: 'Grande voie', other: 'Autre',
};

export function SpotSheet({ spot, onClose, onEdit }: SpotSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuthStore();

  const typeInfo = SPOT_TYPES[spot.type] || SPOT_TYPES.crag;
  const typeCls = TYPE_CLS[spot.type] || TYPE_CLS.crag;
  const gradeLevel = getGradeLevel(spot.niveau_max);
  const hasGrade = spot.niveau_min || spot.niveau_max;
  const gradeText = hasGrade ? `${spot.niveau_min || '?'}  →  ${spot.niveau_max || '?'}` : null;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;

  const orientLabel =
    spot.orientation && t(`orient.${spot.orientation}`) !== `orient.${spot.orientation}`
      ? t(`orient.${spot.orientation}`)
      : spot.orientation;

  /* ---------- Photo carousel ---------- */
  const [photoIdx, setPhotoIdx] = useState(0);
  const hasPhotos = spot.photos.length > 0;
  const photoCount = spot.photos.length;

  const prevPhoto = () => setPhotoIdx((i) => (i - 1 + photoCount) % photoCount);
  const nextPhoto = () => setPhotoIdx((i) => (i + 1) % photoCount);

  /* ---------- Bookmark ---------- */
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    apiFetch<{ bookmarked: boolean }>(`/api/bookmarks/check/${spot.id}`, { auth: true })
      .then((r) => setBookmarked(r.bookmarked))
      .catch(() => {});
  }, [spot.id, isAuthenticated]);

  const toggleBookmark = useCallback(async () => {
    if (!isAuthenticated) {
      toast.error(t('auth.login_required') || 'Connectez-vous pour sauvegarder');
      return;
    }
    setBookmarkLoading(true);
    try {
      if (bookmarked) {
        await apiFetch(`/api/bookmarks/${spot.id}`, { method: 'DELETE', auth: true });
        setBookmarked(false);
        toast.success(t('bookmark.removed') || 'Retiré des favoris');
      } else {
        await apiFetch(`/api/bookmarks/${spot.id}`, { method: 'POST', auth: true });
        setBookmarked(true);
        toast.success(t('bookmark.added') || 'Ajouté aux favoris');
      }
    } catch {
      toast.error(t('common.error') || 'Erreur');
    } finally {
      setBookmarkLoading(false);
    }
  }, [bookmarked, spot.id, isAuthenticated, t]);

  /* ---------- Share ---------- */
  const handleShare = useCallback(async () => {
    const shareData = {
      title: spot.name,
      text: `${spot.name} — ${typeInfo.label}`,
      url: `${window.location.origin}${window.location.pathname}#spot=${spot.id}`,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        toast.success(t('share.copied') || 'Lien copié !');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        await navigator.clipboard.writeText(shareData.url).catch(() => {});
        toast.success(t('share.copied') || 'Lien copié !');
      }
    }
  }, [spot, typeInfo.label, t]);

  /* ---------- Climbing routes ---------- */
  const [routes, setRoutes] = useState<ClimbingRoute[]>([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [newRoute, setNewRoute] = useState({ name: '', grade: '', style: 'sport' as ClimbingStyle });
  const [addingRoute, setAddingRoute] = useState(false);

  useEffect(() => {
    setRoutesLoading(true);
    apiFetch<ClimbingRoute[]>(`/api/climbing-routes/spot/${spot.id}`)
      .then((r) => setRoutes(Array.isArray(r) ? r : []))
      .catch(() => setRoutes([]))
      .finally(() => setRoutesLoading(false));
  }, [spot.id]);

  const handleAddRoute = async () => {
    if (!newRoute.name.trim()) return;
    setAddingRoute(true);
    try {
      const res = await apiFetch<{ route: ClimbingRoute }>('/api/climbing-routes', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ spotId: spot.id, name: newRoute.name, grade: newRoute.grade || undefined, style: newRoute.style }),
      });
      setRoutes((prev) => [...prev, res.route]);
      setNewRoute({ name: '', grade: '', style: 'sport' });
      setShowAddRoute(false);
      toast.success(t('route.added') || 'Voie ajoutée');
    } catch {
      toast.error(t('common.error') || 'Erreur');
    } finally {
      setAddingRoute(false);
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    try {
      await apiFetch(`/api/climbing-routes/${routeId}`, { method: 'DELETE', auth: true });
      setRoutes((prev) => prev.filter((r) => r._id !== routeId));
      toast.success(t('route.deleted') || 'Voie supprimée');
    } catch {
      toast.error(t('common.error') || 'Erreur');
    }
  };

  /* ---------- Delete spot (admin) ---------- */
  const handleDeleteSpot = async () => {
    if (!confirm(t('spot.confirm_delete') || 'Supprimer ce spot ?')) return;
    try {
      await apiFetch(`/api/spots/${spot.id}`, { method: 'DELETE', auth: true });
      toast.success(t('spot.deleted') || 'Spot supprimé');
      onClose();
    } catch {
      toast.error(t('common.error') || 'Erreur');
    }
  };

  /* ---------- Reset photo index on spot change ---------- */
  useEffect(() => { setPhotoIdx(0); }, [spot.id]);

  return (
    <Drawer.Root open onOpenChange={(open) => !open && onClose()} modal={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[1001] bg-black/25 backdrop-blur-[2px] md:hidden" />
        <Drawer.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-[1002] outline-none',
            'md:absolute md:bottom-4 md:left-4 md:right-auto md:w-[400px]',
          )}
        >
          <div
            className={cn(
              'max-h-[80vh] overflow-y-auto rounded-t-2xl bg-surface shadow-elevated',
              'md:rounded-2xl md:max-h-[70vh]',
              'ring-1 ring-border-subtle/50',
            )}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <Drawer.Handle className="h-1.5 w-12 rounded-full bg-text-secondary/20" />
            </div>

            {/* Type banner with gradient */}
            <div className={cn('bg-gradient-to-b to-transparent px-5 pt-4 pb-3', typeCls.gradient)}>
              <div className="flex items-start gap-3.5">
                <div className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-soft',
                  typeCls.bg,
                )}>
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <Drawer.Title className="truncate font-heading text-lg font-bold leading-tight text-text-primary">
                    {spot.name}
                  </Drawer.Title>
                  <p className="mt-0.5 text-xs font-medium text-text-secondary">
                    {t(`spot.type.${spot.type}`) !== `spot.type.${spot.type}`
                      ? t(`spot.type.${spot.type}`)
                      : typeInfo.label}
                  </p>
                </div>
                {spot.avgRating != null && spot.avgRating > 0 && (
                  <div className="flex items-center gap-1 rounded-lg bg-amber-brand/10 px-2 py-1">
                    <Star className="h-3.5 w-3.5 fill-amber-brand text-amber-brand" />
                    <span className="text-xs font-bold text-amber-brand">{spot.avgRating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats chips */}
            <div className="flex flex-wrap gap-1.5 px-5 py-2.5">
              {gradeText && (
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold',
                  GRADE_CLS[gradeLevel],
                )}>
                  <Zap className="h-3 w-3" />
                  {gradeText}
                </span>
              )}
              {spot.orientation && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-text-secondary">
                  <Compass
                    className="h-3 w-3"
                    style={{ transform: `rotate(${ORIENT_DEG[spot.orientation] ?? 0}deg)` }}
                  />
                  {orientLabel}
                </span>
              )}
              {spot.info_complementaires?.rock && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-text-secondary">
                  {spot.info_complementaires.rock}
                </span>
              )}
              {spot.equipement && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-text-secondary">
                  {spot.equipement}
                </span>
              )}
              {spot.hauteur && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-text-secondary">
                  {spot.hauteur}m
                </span>
              )}
              {routes.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-text-secondary">
                  <RouteIcon className="h-3 w-3" />
                  {routes.length} {t('spot.routes') || 'voies'}
                </span>
              )}
              {spot.reviewCount != null && spot.reviewCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-text-secondary">
                  {spot.reviewCount} {t('spot.reviews') || 'avis'}
                </span>
              )}
            </div>

            {/* Photo carousel */}
            {hasPhotos && (
              <div className="relative px-5 pb-3">
                <div className="relative overflow-hidden rounded-xl ring-1 ring-border-subtle/50">
                  <img
                    src={spot.photos[photoIdx].url}
                    alt={`Photo ${photoIdx + 1} de ${spot.name}`}
                    className="h-44 w-full object-cover transition-opacity duration-200"
                    loading="lazy"
                  />
                  {photoCount > 1 && (
                    <>
                      <button
                        onClick={prevPhoto}
                        className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                        type="button"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={nextPhoto}
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                        type="button"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                        {photoIdx + 1} / {photoCount}
                      </div>
                    </>
                  )}
                </div>
                {/* Thumbnail strip */}
                {photoCount > 1 && (
                  <div className="mt-1.5 flex gap-1 overflow-x-auto scrollbar-none">
                    {spot.photos.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => setPhotoIdx(i)}
                        className={cn(
                          'h-10 w-10 shrink-0 rounded-lg object-cover transition-all',
                          i === photoIdx ? 'ring-2 ring-sage opacity-100' : 'opacity-50 hover:opacity-80',
                        )}
                        type="button"
                      >
                        <img src={p.url} alt="" className="h-full w-full rounded-lg object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {spot.description && (
              <p className="px-5 pb-3 text-sm leading-relaxed text-text-secondary">
                {spot.description}
              </p>
            )}

            {/* Access info */}
            {spot.acces && (
              <div className="px-5 pb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary/70">
                  {t('spot.access')}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-text-secondary">{spot.acces}</p>
              </div>
            )}

            {/* Climbing routes section */}
            {spot.type !== 'shop' && (
              <div className="border-t border-border-subtle px-5 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary/70">
                    {t('spot.climbing_routes') || 'Voies'}
                    {routes.length > 0 && <span className="ml-1.5 text-text-primary">({routes.length})</span>}
                  </h3>
                  {isAuthenticated && !showAddRoute && (
                    <button
                      onClick={() => setShowAddRoute(true)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-sage transition-colors hover:bg-sage-muted"
                      type="button"
                    >
                      <Plus className="h-3 w-3" />
                      {t('route.add') || 'Ajouter'}
                    </button>
                  )}
                </div>

                {routesLoading ? (
                  <div className="py-3 text-center text-xs text-text-secondary/50">
                    {t('common.loading')}...
                  </div>
                ) : routes.length === 0 && !showAddRoute ? (
                  <p className="py-2 text-xs text-text-secondary/50">
                    {t('route.none') || 'Aucune voie enregistrée'}
                  </p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {routes.map((r) => (
                      <div
                        key={r._id}
                        className="flex items-center gap-2 rounded-lg bg-surface-2/40 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium text-text-primary">{r.name}</span>
                          <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                            {r.grade && <span className="font-bold">{r.grade}</span>}
                            {r.style && <span>{STYLE_LABELS[r.style] || r.style}</span>}
                            {r.height && <span>{r.height}m</span>}
                            {r.bolts != null && <span>{r.bolts} pts</span>}
                          </div>
                        </div>
                        {isAuthenticated && (isAdmin || r.createdBy?.uid === useAuthStore.getState().user?._id) && (
                          <button
                            onClick={() => handleDeleteRoute(r._id)}
                            className="shrink-0 rounded p-1 text-text-secondary/40 transition-colors hover:bg-red-50 hover:text-red-500"
                            type="button"
                            title={t('common.delete') || 'Supprimer'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add route form */}
                {showAddRoute && (
                  <div className="mt-2 space-y-2 rounded-xl border border-border-subtle bg-surface-2/30 p-3">
                    <input
                      type="text"
                      value={newRoute.name}
                      onChange={(e) => setNewRoute((s) => ({ ...s, name: e.target.value }))}
                      placeholder={t('route.name_placeholder') || 'Nom de la voie'}
                      className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-sage"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newRoute.grade}
                        onChange={(e) => setNewRoute((s) => ({ ...s, grade: e.target.value }))}
                        placeholder={t('route.grade_placeholder') || 'Cotation (ex: 6a+)'}
                        className="w-1/2 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-sage"
                      />
                      <select
                        value={newRoute.style}
                        onChange={(e) => setNewRoute((s) => ({ ...s, style: e.target.value as ClimbingStyle }))}
                        className="w-1/2 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-sage"
                      >
                        {Object.entries(STYLE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddRoute}
                        disabled={addingRoute || !newRoute.name.trim()}
                        className="flex-1 rounded-lg bg-sage px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50"
                        type="button"
                      >
                        {addingRoute ? '...' : t('common.add') || 'Ajouter'}
                      </button>
                      <button
                        onClick={() => setShowAddRoute(false)}
                        className="rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-2"
                        type="button"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 border-t border-border-subtle px-5 py-4">
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex flex-1 cursor-pointer items-center justify-center gap-2',
                  'rounded-xl px-4 py-3 text-sm font-semibold text-white no-underline',
                  'shadow-soft transition-all duration-200',
                  'bg-sage hover:bg-sage-hover hover:shadow-card',
                  'active:scale-[0.98]',
                )}
              >
                <Navigation className="h-4 w-4" />
                {t('spot.directions')}
              </a>
              <button
                onClick={toggleBookmark}
                disabled={bookmarkLoading}
                className={cn(
                  'flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl',
                  'border transition-all duration-200 active:scale-95',
                  bookmarked
                    ? 'border-sage bg-sage-muted text-sage'
                    : 'border-border-subtle text-text-secondary hover:border-sage/30 hover:bg-sage-muted hover:text-sage',
                  bookmarkLoading && 'opacity-50',
                )}
                type="button"
                title={t('spot.bookmark')}
              >
                <Bookmark className={cn('h-4 w-4', bookmarked && 'fill-sage')} />
              </button>
              <button
                onClick={handleShare}
                className={cn(
                  'flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl',
                  'border border-border-subtle text-text-secondary',
                  'transition-all duration-200 hover:border-sage/30 hover:bg-sage-muted hover:text-sage',
                  'active:scale-95',
                )}
                type="button"
                title={t('spot.share')}
              >
                <Share2 className="h-4 w-4" />
              </button>
              {isAuthenticated && (
                <button
                  onClick={() => onEdit?.(spot)}
                  className={cn(
                    'flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl',
                    'border border-border-subtle text-text-secondary',
                    'transition-all duration-200 hover:border-sage/30 hover:bg-sage-muted hover:text-sage',
                    'active:scale-95',
                  )}
                  type="button"
                  title={t('spot.edit') || 'Modifier'}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={handleDeleteSpot}
                  className={cn(
                    'flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl',
                    'border border-red-200 text-red-400',
                    'transition-all duration-200 hover:border-red-300 hover:bg-red-50 hover:text-red-500',
                    'active:scale-95',
                  )}
                  type="button"
                  title={t('spot.delete') || 'Supprimer'}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* External link */}
            {spot.url && (
              <div className="border-t border-border-subtle px-5 py-3">
                <a
                  href={spot.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-sage no-underline transition-colors hover:text-sage-hover"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  {t('spot.website') || 'Site web'}
                </a>
              </div>
            )}

            {/* Contributor footer — clickable profile link */}
            {(spot.createdBy || spot.submittedBy) && (
              <div className="border-t border-border-subtle px-5 py-3 text-xs text-text-secondary">
                {t('spot.proposed_by')}{' '}
                <button
                  onClick={() => {
                    const uid = spot.createdBy?.uid || spot.submittedBy?.uid;
                    if (uid) navigate(`/profile?id=${uid}`);
                  }}
                  className="font-semibold text-sage transition-colors hover:text-sage-hover hover:underline"
                  type="button"
                >
                  {spot.createdBy?.displayName || spot.submittedBy?.displayName}
                </button>
                {spot.createdAt && (
                  <> &middot; {new Date(spot.createdAt).toLocaleDateString()}</>
                )}
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
