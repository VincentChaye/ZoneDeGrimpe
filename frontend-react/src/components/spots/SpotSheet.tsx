import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import {
  Navigation, Compass, Zap, Bookmark, Share2, MapPin, Star,
  ArrowUpRight, ChevronLeft, ChevronRight, Route as RouteIcon,
  Plus, X, Pencil, Trash2, BookOpen, Loader2, Maximize2, Clock, ImagePlus,
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

const STYLE_KEYS: Record<ClimbingStyle, string> = {
  sport: 'style.sport', trad: 'style.trad', boulder: 'style.boulder', multi: 'style.multi', other: 'style.other',
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
      toast.error(t('toast.login_required'));
      return;
    }
    setBookmarkLoading(true);
    try {
      if (bookmarked) {
        await apiFetch(`/api/bookmarks/${spot.id}`, { method: 'DELETE', auth: true });
        setBookmarked(false);
        toast.success(t('toast.spot_removed'));
      } else {
        await apiFetch(`/api/bookmarks/${spot.id}`, { method: 'POST', auth: true });
        setBookmarked(true);
        toast.success(t('toast.spot_saved'));
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setBookmarkLoading(false);
    }
  }, [bookmarked, spot.id, isAuthenticated, t]);

  /* ---------- Share ---------- */
  const handleShare = useCallback(async () => {
    const shareData = {
      title: spot.name,
      text: `${spot.name} — ${t(typeInfo.key)}`,
      url: `${window.location.origin}${window.location.pathname}#spot=${spot.id}`,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        toast.success(t('share.copied'));
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        await navigator.clipboard.writeText(shareData.url).catch(() => {});
        toast.success(t('share.copied'));
      }
    }
  }, [spot, typeInfo.key, t]);

  /* ---------- Climbing routes ---------- */
  const [routes, setRoutes] = useState<ClimbingRoute[]>([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [newRoute, setNewRoute] = useState({ name: '', grade: '', style: 'sport' as ClimbingStyle });
  const [newRouteImage, setNewRouteImage] = useState<File | null>(null);
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
      // Upload image si sélectionnée
      if (newRouteImage && res.route._id) {
        const form = new FormData();
        form.append('image', newRouteImage);
        await apiFetch(`/api/climbing-routes/${res.route._id}/image`, {
          method: 'POST',
          auth: true,
          body: form,
        }).catch(() => {});
      }
      // Afficher voie pending seulement à l'auteur/admin
      if (res.route.status === 'pending') {
        setRoutes((prev) => [...prev, res.route]);
        toast.success(t('toast.route_pending'));
      } else {
        setRoutes((prev) => [...prev, res.route]);
        toast.success(t('toast.route_added'));
      }
      setNewRoute({ name: '', grade: '', style: 'sport' });
      setNewRouteImage(null);
      setShowAddRoute(false);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setAddingRoute(false);
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    try {
      await apiFetch(`/api/climbing-routes/${routeId}`, { method: 'DELETE', auth: true });
      setRoutes((prev) => prev.filter((r) => r._id !== routeId));
      toast.success(t('toast.route_deleted'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  /* ---------- Reviews ---------- */
  // Backend stores "username" (display label), not "displayName"
  interface Review { _id: string; userId: string; username: string; rating: number; comment?: string; createdAt: string; }
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const meId = useAuthStore.getState().user?._id;

  useEffect(() => {
    setReviewsLoading(true);
    apiFetch<{ items: Review[]; total: number } | Review[]>(`/api/reviews/spot/${spot.id}`)
      .then((r) => {
        const list: Review[] = Array.isArray(r) ? r : ((r as { items?: Review[] }).items ?? []);
        setReviews(list);
        const mine = meId ? list.find((rv) => rv.userId === meId) ?? null : null;
        setMyReview(mine);
        if (mine) { setReviewRating(mine.rating); setReviewComment(mine.comment ?? ''); }
      })
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false));
  }, [spot.id, meId]);

  const submitReview = async () => {
    if (!reviewRating) return;
    setSubmittingReview(true);
    try {
      if (myReview) {
        await apiFetch(`/api/reviews/${myReview._id}`, {
          method: 'PATCH', auth: true,
          body: JSON.stringify({ rating: reviewRating, comment: reviewComment || undefined }),
        });
        const updated: Review = { ...myReview, rating: reviewRating, comment: reviewComment || undefined };
        setReviews((prev) => prev.map((rv) => rv._id === myReview._id ? updated : rv));
        setMyReview(updated);
      } else {
        const created = await apiFetch<Review>('/api/reviews', {
          method: 'POST', auth: true,
          body: JSON.stringify({ spotId: spot.id, rating: reviewRating, comment: reviewComment || undefined }),
        });
        setReviews((prev) => [created, ...prev]);
        setMyReview(created);
      }
      setShowReviewForm(false);
      toast.success(t('toast.review_saved'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSubmittingReview(false);
    }
  };

  const deleteReview = async (reviewId: string) => {
    if (!confirm(t('review.confirm_delete'))) return;
    try {
      await apiFetch(`/api/reviews/${reviewId}`, { method: 'DELETE', auth: true });
      setReviews((prev) => prev.filter((rv) => rv._id !== reviewId));
      setMyReview(null);
      setReviewRating(0);
      setReviewComment('');
      toast.success(t('toast.review_deleted'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  /* ---------- Logger une grimpe ---------- */
  const [showLogger, setShowLogger] = useState(false);
  const [logRouteId, setLogRouteId] = useState('');
  const [logStyle, setLogStyle] = useState('redpoint');
  const [logGrade, setLogGrade] = useState(spot.niveau_max ?? '');
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logComment, setLogComment] = useState('');
  const [logging, setLogging] = useState(false);
  const [loggedRouteIds, setLoggedRouteIds] = useState<Set<string>>(new Set());
  const LOG_STYLES = ['onsight', 'flash', 'redpoint', 'repeat'] as const;

  // Fetch already-logged routes for this spot (auth only)
  useEffect(() => {
    if (!isAuthenticated || !spot.id) return;
    apiFetch<{ items: { routeId?: string }[] }>(`/api/logbook?spotId=${spot.id}&limit=100`, { auth: true })
      .then((res) => {
        const ids = new Set(
          (res.items ?? []).map((e) => e.routeId).filter((id): id is string => Boolean(id))
        );
        setLoggedRouteIds(ids);
      })
      .catch(() => {});
  }, [spot.id, isAuthenticated]);

  const handleLogRouteChange = (routeId: string) => {
    setLogRouteId(routeId);
    const route = routes.find((r) => r._id === routeId);
    if (route?.grade) setLogGrade(route.grade);
  };

  const submitLog = async () => {
    if (logRouteId && loggedRouteIds.has(logRouteId)) {
      toast.error(t('logbook.route_already_logged'));
      return;
    }
    setLogging(true);
    try {
      const payload: Record<string, unknown> = { spotId: spot.id, style: logStyle, date: logDate };
      if (logRouteId) payload.routeId = logRouteId;
      if (logComment.trim()) payload.notes = logComment.trim();
      await apiFetch('/api/logbook', { method: 'POST', auth: true, body: JSON.stringify(payload) });
      toast.success(t('toast.log_saved'));
      if (logRouteId) setLoggedRouteIds((prev) => new Set([...prev, logRouteId]));
      setShowLogger(false);
      setLogRouteId('');
      setLogGrade(spot.niveau_max ?? '');
      setLogComment('');
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLogging(false);
    }
  };

  /* ---------- Delete spot (admin) ---------- */
  const handleDeleteSpot = async () => {
    if (!confirm(t('spot.delete_confirm', { name: spot.name }))) return;
    try {
      await apiFetch(`/api/spots/${spot.id}`, { method: 'DELETE', auth: true });
      toast.success(t('toast.spot_deleted'));
      onClose();
    } catch {
      toast.error(t('common.error'));
    }
  };

  /* ---------- Lightbox ---------- */
  const [lightboxOpen, setLightboxOpen] = useState(false);

  /* ---------- Reset photo index on spot change ---------- */
  useEffect(() => { setPhotoIdx(0); }, [spot.id]);

  return (
    <>
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
                      : t(typeInfo.key)}
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
                  {routes.length} {t('spot.routes')}
                </span>
              )}
              {spot.reviewCount != null && spot.reviewCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-text-secondary">
                  {t('review.count', { count: spot.reviewCount })}
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
                    className="h-44 w-full cursor-zoom-in object-cover transition-opacity duration-200"
                    loading="lazy"
                    onClick={() => setLightboxOpen(true)}
                  />
                  <button
                    onClick={() => setLightboxOpen(true)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                    type="button"
                    title={t('spot.photos_fullscreen')}
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
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
                    {t('spot.climbing_routes')}
                    {routes.length > 0 && <span className="ml-1.5 text-text-primary">({routes.length})</span>}
                  </h3>
                  {isAuthenticated && !showAddRoute && (
                    <button
                      onClick={() => setShowAddRoute(true)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-sage transition-colors hover:bg-sage-muted"
                      type="button"
                    >
                      <Plus className="h-3 w-3" />
                      {t('spot.add_route')}
                    </button>
                  )}
                </div>

                {routesLoading ? (
                  <div className="py-3 text-center text-xs text-text-secondary/50">
                    {t('common.loading')}...
                  </div>
                ) : routes.length === 0 && !showAddRoute ? (
                  <p className="py-2 text-xs text-text-secondary/50">
                    {t('spot.routes_empty')}
                  </p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {routes.map((r) => (
                      <div
                        key={r._id}
                        className={cn(
                          'rounded-lg bg-surface-2/40 overflow-hidden',
                          r.status === 'pending' && 'border border-amber-brand/30',
                        )}
                      >
                        {r.imageUrl && (
                          <img
                            src={r.imageUrl}
                            alt={r.name}
                            className="h-28 w-full object-cover"
                            loading="lazy"
                          />
                        )}
                        <div className="flex items-center gap-2 px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-text-primary">{r.name}</span>
                              {r.status === 'pending' && (
                                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-brand/10 text-amber-brand">
                                  <Clock className="h-2.5 w-2.5" />
                                  {t('admin.status_pending')}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                              {r.grade && <span className="font-bold">{r.grade}</span>}
                              {r.style && <span>{t(STYLE_KEYS[r.style])}</span>}
                              {r.height && <span>{r.height}m</span>}
                              {r.bolts != null && <span>{r.bolts} pts</span>}
                            </div>
                          </div>
                          {isAuthenticated && (isAdmin || r.createdBy?.uid === useAuthStore.getState().user?._id) && (
                            <button
                              onClick={() => handleDeleteRoute(r._id)}
                              className="shrink-0 rounded p-1 text-text-secondary/40 transition-colors hover:bg-red-50 hover:text-red-500"
                              type="button"
                              title={t('common.delete')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
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
                      placeholder={t('spot.route_name_placeholder')}
                      className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-sage"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newRoute.grade}
                        onChange={(e) => setNewRoute((s) => ({ ...s, grade: e.target.value }))}
                        placeholder={t('spot.route_grade_placeholder')}
                        className="w-1/2 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-sage"
                      />
                      <select
                        value={newRoute.style}
                        onChange={(e) => setNewRoute((s) => ({ ...s, style: e.target.value as ClimbingStyle }))}
                        className="w-1/2 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-sage"
                      >
                        {Object.entries(STYLE_KEYS).map(([k, v]) => (
                          <option key={k} value={k}>{t(v)}</option>
                        ))}
                      </select>
                    </div>
                    {/* Image upload */}
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border-subtle bg-surface px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-2">
                      <ImagePlus className="h-4 w-4 shrink-0" />
                      {newRouteImage
                        ? <span className="truncate text-text-primary">{newRouteImage.name}</span>
                        : <span>{t('spot.route_image_optional')}</span>
                      }
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => setNewRouteImage(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    {!isAdmin && (
                      <p className="flex items-center gap-1 text-[11px] text-amber-brand">
                        <Clock className="h-3 w-3 shrink-0" />
                        {t('spot.route_pending_notice')}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddRoute}
                        disabled={addingRoute || !newRoute.name.trim()}
                        className="flex-1 rounded-lg bg-sage px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50"
                        type="button"
                      >
                        {addingRoute ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t('common.add')}
                      </button>
                      <button
                        onClick={() => { setShowAddRoute(false); setNewRouteImage(null); }}
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

            {/* Reviews section */}
            {spot.type !== 'shop' && (
              <div className="border-t border-border-subtle px-5 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary/70">
                    {t('review.title')}
                    {reviews.length > 0 && <span className="ml-1.5 text-text-primary">({reviews.length})</span>}
                  </h3>
                  {isAuthenticated && !showReviewForm && (
                    <button
                      onClick={() => setShowReviewForm(true)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-sage transition-colors hover:bg-sage-muted"
                      type="button"
                    >
                      <Star className="h-3 w-3" />
                      {myReview ? t('review.edit') : t('review.add')}
                    </button>
                  )}
                </div>

                {/* Review form */}
                {showReviewForm && (
                  <div className="mt-2 space-y-2 rounded-xl border border-border-subtle bg-surface-2/30 p-3">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setReviewRating(n)}
                          className="cursor-pointer transition-transform hover:scale-110"
                        >
                          <Star className={cn('h-6 w-6', n <= reviewRating ? 'fill-amber-brand text-amber-brand' : 'text-text-secondary/30')} />
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder={t('review.comment_placeholder')}
                      rows={2}
                      className="w-full resize-none rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none placeholder:text-text-secondary/50 focus:border-sage"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={submitReview}
                        disabled={submittingReview || !reviewRating}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sage py-2 text-sm font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50"
                        type="button"
                      >
                        {submittingReview && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {t('common.save')}
                      </button>
                      <button
                        onClick={() => setShowReviewForm(false)}
                        className="rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-2"
                        type="button"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {reviewsLoading ? (
                  <div className="py-3 text-center text-xs text-text-secondary/50">{t('common.loading')}...</div>
                ) : reviews.length === 0 ? (
                  <p className="py-2 text-xs text-text-secondary/50">{t('review.no_reviews')}</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {reviews.map((rv) => (
                      <div key={rv._id} className="rounded-lg bg-surface-2/40 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-text-primary">{rv.username}</span>
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <Star key={n} className={cn('h-3 w-3', n <= rv.rating ? 'fill-amber-brand text-amber-brand' : 'text-text-secondary/20')} />
                                ))}
                              </div>
                            </div>
                            {rv.comment && <p className="mt-1 text-xs leading-relaxed text-text-secondary">{rv.comment}</p>}
                          </div>
                          {meId === rv.userId && (
                            <button
                              onClick={() => deleteReview(rv._id)}
                              className="shrink-0 rounded p-1 text-text-secondary/40 transition-colors hover:bg-red-50 hover:text-red-500"
                              type="button"
                              title={t('common.delete')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Logger une grimpe modal */}
            {showLogger && (
              <div className="border-t border-border-subtle px-5 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary/70">{t('logbook.log_climb')}</h3>
                  <button onClick={() => setShowLogger(false)} className="cursor-pointer rounded-lg p-1 text-text-secondary hover:bg-surface-2" type="button">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  {routes.length > 0 && (
                    <>
                      <select
                        value={logRouteId}
                        onChange={(e) => handleLogRouteChange(e.target.value)}
                        className={cn(
                          'w-full rounded-lg border bg-surface px-3 py-2 text-sm outline-none focus:border-sage',
                          logRouteId && loggedRouteIds.has(logRouteId)
                            ? 'border-red-400 text-red-500'
                            : 'border-border-subtle',
                        )}
                      >
                        <option value="">{t('logbook.select_route')}</option>
                        {routes.map((r) => {
                          const done = loggedRouteIds.has(r._id);
                          return (
                            <option key={r._id} value={r._id} disabled={done}>
                              {done ? '✓ ' : ''}{r.name}{r.grade ? ` — ${r.grade}` : ''}{done ? ` (${t('logbook.already_logged')})` : ''}
                            </option>
                          );
                        })}
                      </select>
                      {logRouteId && loggedRouteIds.has(logRouteId) && (
                        <p className="text-xs text-red-500">{t('logbook.route_already_logged')}</p>
                      )}
                    </>
                  )}
                  <div className="flex gap-2">
                    {LOG_STYLES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setLogStyle(s)}
                        className={cn(
                          'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all',
                          logStyle === s ? 'bg-sage text-white' : 'border border-border-subtle bg-surface text-text-secondary hover:bg-surface-2',
                        )}
                      >
                        {t(`logbook.style.${s}`)}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={logGrade}
                      onChange={(e) => setLogGrade(e.target.value)}
                      placeholder={t('logbook.form_grade')}
                      className="w-1/2 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-sage"
                    />
                    <input
                      type="date"
                      value={logDate}
                      onChange={(e) => setLogDate(e.target.value)}
                      className="w-1/2 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-sage"
                    />
                  </div>
                  <textarea
                    value={logComment}
                    onChange={(e) => setLogComment(e.target.value)}
                    placeholder={t('logbook.form_comment_placeholder')}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none placeholder:text-text-secondary/50 focus:border-sage"
                  />
                  <button
                    onClick={submitLog}
                    disabled={logging}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-sage py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50"
                    type="button"
                  >
                    {logging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
                    {t('logbook.save_entry')}
                  </button>
                </div>
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
              {isAuthenticated && spot.type !== 'shop' && (
                <button
                  onClick={() => setShowLogger((v) => !v)}
                  className={cn(
                    'flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl',
                    'border transition-all duration-200 active:scale-95',
                    showLogger
                      ? 'border-sage bg-sage-muted text-sage'
                      : 'border-border-subtle text-text-secondary hover:border-sage/30 hover:bg-sage-muted hover:text-sage',
                  )}
                  type="button"
                  title={t('logbook.log_climb')}
                >
                  <BookOpen className="h-4 w-4" />
                </button>
              )}
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
                  title={t('spot.edit')}
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
                  title={t('spot.delete_spot')}
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
                  {t('spot.website')}
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

    {/* Lightbox */}
    {lightboxOpen && hasPhotos && (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-sm"
        onClick={() => setLightboxOpen(false)}
      >
        <button
          onClick={() => setLightboxOpen(false)}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          type="button"
        >
          <X className="h-5 w-5" />
        </button>

        <img
          src={spot.photos[photoIdx].url}
          alt={`Photo ${photoIdx + 1} de ${spot.name}`}
          className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />

        {photoCount > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              type="button"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              type="button"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-white backdrop-blur-sm">
              {photoIdx + 1} / {photoCount}
            </div>
          </>
        )}
      </div>
    )}
    </>
  );
}
