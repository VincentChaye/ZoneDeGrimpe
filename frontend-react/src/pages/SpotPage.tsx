import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Navigation, Compass, Zap, Bookmark, Share2, MapPin, Star,
  ArrowUpRight, ChevronLeft, ChevronRight, Route as RouteIcon,
  Plus, X, Pencil, Trash2, BookOpen, Loader2, Maximize2, Clock,
  ImagePlus, ArrowLeft, Check, Wind,
  Sun, CloudSun, Cloud, CloudRain, CloudSnow, CloudLightning,
} from 'lucide-react';
import { apiFetch, getCachedSpots } from '@/lib/api';
import { cn, getGradeLevel, ORIENT_DEG, SPOT_TYPES } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import type { Spot, ClimbingRoute, ClimbingStyle } from '@/types';

const EditSpotWizard = lazy(() =>
  import('@/components/spots/EditSpotWizard').then((m) => ({ default: m.EditSpotWizard })),
);

/* ---------- Grade helpers ---------- */

const GRADE_BADGE_CLS: Record<string, string> = {
  easy: 'bg-amber-400 text-white',
  medium: 'bg-grade-easy text-white',
  hard: 'bg-grade-hard text-white',
  expert: 'bg-grade-expert text-white',
  elite: 'bg-gray-900 text-white',
};

const GRADE_BANDS = ['3', '4', '5', '6', '7', '8+'] as const;
type GradeBand = typeof GRADE_BANDS[number];

const BAND_COLOR: Record<GradeBand, string> = {
  '3': 'bg-amber-400',
  '4': 'bg-grade-easy',
  '5': 'bg-green-500',
  '6': 'bg-grade-hard',
  '7': 'bg-grade-expert',
  '8+': 'bg-gray-900',
};

function getGradeBand(grade: string): GradeBand | '' {
  if (!grade) return '';
  const g = grade.toLowerCase().trim();
  if (g.startsWith('3')) return '3';
  if (g.startsWith('4')) return '4';
  if (g.startsWith('5')) return '5';
  if (g.startsWith('6')) return '6';
  if (g.startsWith('7')) return '7';
  if (/^[89]/.test(g)) return '8+';
  return '';
}

/* ---------- Weather helpers ---------- */

interface WeatherData { temp: number; windKmh: number; code: number; }

function wmoKey(code: number): string {
  if (code === 0) return 'weather.clear';
  if (code <= 3) return 'weather.partly_cloudy';
  if (code <= 48) return 'weather.foggy';
  if (code <= 67) return 'weather.rain';
  if (code <= 77) return 'weather.snow';
  if (code <= 82) return 'weather.showers';
  return 'weather.storm';
}

function WmoIcon({ code, className }: { code: number; className?: string }) {
  const cls = cn('shrink-0', className);
  if (code === 0) return <Sun className={cls} />;
  if (code <= 3) return <CloudSun className={cls} />;
  if (code <= 48) return <Cloud className={cls} />;
  if (code <= 77) return <CloudRain className={cls} />;
  if (code <= 77) return <CloudSnow className={cls} />;
  return <CloudLightning className={cls} />;
}

function wmoIconColor(code: number): string {
  if (code === 0) return 'text-amber-400';
  if (code <= 3) return 'text-amber-300';
  if (code <= 48) return 'text-gray-400';
  if (code <= 67) return 'text-blue-400';
  if (code <= 77) return 'text-sky-300';
  if (code <= 82) return 'text-blue-400';
  return 'text-purple-400';
}

/* ---------- Display constants ---------- */

const GRADE_CLS: Record<string, string> = {
  easy: 'bg-grade-easy/10 text-grade-easy border-grade-easy/20',
  medium: 'bg-grade-medium/10 text-grade-medium border-grade-medium/20',
  hard: 'bg-grade-hard/10 text-grade-hard border-grade-hard/20',
  expert: 'bg-grade-expert/10 text-grade-expert border-grade-expert/20',
  elite: 'bg-grade-elite/10 text-grade-elite border-grade-elite/20',
};

const TYPE_GRADIENT: Record<string, string> = {
  crag: 'linear-gradient(135deg, #5D7052 0%, #4A5A41 55%, #C18845 100%)',
  boulder: 'linear-gradient(135deg, #C18845 0%, #8a5d2e 100%)',
  indoor: 'linear-gradient(135deg, #4A90D9 0%, #2563eb 100%)',
  shop: 'linear-gradient(135deg, #8B5CF6 0%, #6d28d9 100%)',
};

const TYPE_BG: Record<string, string> = {
  crag: 'bg-type-crag', boulder: 'bg-type-boulder', indoor: 'bg-type-indoor', shop: 'bg-type-shop',
};

const STYLE_KEYS: Record<ClimbingStyle, string> = {
  sport: 'style.sport', trad: 'style.trad', boulder: 'style.boulder', multi: 'style.multi', other: 'style.other',
};

/* ========== SpotPage ========== */

export function SpotPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated, isAdmin, user } = useAuthStore();
  const meId = user?._id;

  const [spot, setSpot] = useState<Spot | null>((location.state as { spot?: Spot } | null)?.spot ?? null);
  const [spotLoading, setSpotLoading] = useState(!spot);
  const [spotError, setSpotError] = useState(false);

  /* ---------- Load spot ---------- */
  useEffect(() => {
    if (spot) return;
    if (!id) { setSpotError(true); return; }
    const cached = getCachedSpots<Spot[]>();
    if (cached) {
      const found = cached.find((s) => s.id === id);
      if (found) { setSpot(found); setSpotLoading(false); return; }
    }
    setSpotLoading(true);
    apiFetch<Record<string, unknown>>(`/api/spots/${id}`)
      .then((data) => {
        if (!data) { setSpotError(true); return; }
        const p = data as Record<string, unknown>;
        const loc = p.location as { coordinates?: number[] } | undefined;
        const lng = loc?.coordinates?.[0] ?? (p.lng as number);
        const lat = loc?.coordinates?.[1] ?? (p.lat as number);
        setSpot({
          id: String(p._id ?? p.id ?? id),
          name: (p.name ?? 'Sans nom') as string,
          type: (p.type ?? 'crag') as Spot['type'],
          soustype: (p.soustype ?? null) as string | null,
          lat, lng,
          orientation: (p.orientation ?? null) as Spot['orientation'],
          niveau_min: (p.niveau_min ?? null) as string | null,
          niveau_max: (p.niveau_max ?? null) as string | null,
          id_voix: (Array.isArray(p.id_voix) ? p.id_voix : []) as string[],
          url: (p.url ?? null) as string | null,
          description: (p.description ?? null) as string | null,
          info_complementaires: (p.info_complementaires ?? null) as Spot['info_complementaires'],
          acces: (p.acces ?? null) as string | null,
          equipement: (p.equipement ?? null) as Spot['equipement'],
          hauteur: (p.hauteur ?? null) as number | null,
          photos: (p.photos ?? []) as Spot['photos'],
          createdBy: (p.createdBy ?? null) as Spot['createdBy'],
          submittedBy: (p.submittedBy ?? null) as Spot['submittedBy'],
          updatedBy: (p.updatedBy ?? null) as Spot['updatedBy'],
          createdAt: (p.createdAt ?? null) as string | null,
          updatedAt: (p.updatedAt ?? null) as string | null,
          status: (p.status ?? null) as Spot['status'],
          avgRating: p.avgRating as number | undefined,
          reviewCount: p.reviewCount as number | undefined,
        });
      })
      .catch(() => setSpotError(true))
      .finally(() => setSpotLoading(false));
  }, [id, spot]);

  /* ---------- Weather (Open-Meteo) ---------- */
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  useEffect(() => {
    if (!spot) return;
    setWeatherLoading(true);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lng}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto&forecast_days=1`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        const c = d?.current;
        if (c) setWeather({ temp: Math.round(c.temperature_2m), windKmh: Math.round(c.wind_speed_10m), code: c.weather_code });
      })
      .catch(() => {})
      .finally(() => setWeatherLoading(false));
  }, [spot?.lat, spot?.lng]);

  /* ---------- Photo carousel ---------- */
  const [photoIdx, setPhotoIdx] = useState(0);
  const [localPhotos, setLocalPhotos] = useState<Spot['photos']>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (spot) { setLocalPhotos(spot.photos); setPhotoIdx(0); }
  }, [spot?.id]);

  const hasPhotos = localPhotos.length > 0;
  const photoCount = localPhotos.length;
  const prevPhoto = () => setPhotoIdx((i) => (i - 1 + photoCount) % photoCount);
  const nextPhoto = () => setPhotoIdx((i) => (i + 1) % photoCount);

  const handleUploadPhoto = async (file: File) => {
    if (!spot) return;
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append('photo', file);
      const result = await apiFetch<{ ok: boolean; photo: import('@/types').SpotPhoto }>(
        `/api/spots/${spot.id}/photos`, { method: 'POST', auth: true, body: form }
      );
      setLocalPhotos((prev) => [...prev, result.photo]);
      setPhotoIdx(localPhotos.length);
      toast.success(result.photo.status === 'pending' ? t('toast.photo_pending') : t('toast.photos_added', { count: 1 }));
    } catch { toast.error(t('common.error')); }
    finally { setUploadingPhoto(false); }
  };

  const handleDeletePhoto = async (photoId: string, idx: number) => {
    if (!spot) return;
    try {
      await apiFetch(`/api/spots/${spot.id}/photos/${photoId}`, { method: 'DELETE', auth: true });
      setLocalPhotos((prev) => prev.filter((p) => p._id !== photoId));
      setPhotoIdx((i) => Math.max(0, i >= idx ? i - 1 : i));
      toast.success(t('toast.photo_deleted'));
    } catch { toast.error(t('common.error')); }
  };

  /* ---------- Bookmark ---------- */
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !spot) return;
    apiFetch<{ bookmarked: boolean }>(`/api/bookmarks/check/${spot.id}`, { auth: true })
      .then((r) => setBookmarked(r.bookmarked)).catch(() => {});
  }, [spot?.id, isAuthenticated]);

  const toggleBookmark = useCallback(async () => {
    if (!spot) return;
    if (!isAuthenticated) { toast.error(t('toast.login_required')); return; }
    setBookmarkLoading(true);
    try {
      if (bookmarked) {
        await apiFetch(`/api/bookmarks/${spot.id}`, { method: 'DELETE', auth: true });
        setBookmarked(false); toast.success(t('toast.spot_removed'));
      } else {
        await apiFetch(`/api/bookmarks/${spot.id}`, { method: 'POST', auth: true });
        setBookmarked(true); toast.success(t('toast.spot_saved'));
      }
    } catch { toast.error(t('common.error')); }
    finally { setBookmarkLoading(false); }
  }, [bookmarked, spot?.id, isAuthenticated, t]);

  /* ---------- Share ---------- */
  const handleShare = useCallback(async () => {
    if (!spot) return;
    const typeInfo = SPOT_TYPES[spot.type] || SPOT_TYPES.crag;
    const shareData = { title: spot.name, text: `${spot.name} — ${t(typeInfo.key)}`, url: `${window.location.origin}/ZoneDeGrimpe/spot/${spot.id}` };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(shareData.url); toast.success(t('share.copied')); }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') { await navigator.clipboard.writeText(shareData.url).catch(() => {}); toast.success(t('share.copied')); }
    }
  }, [spot, t]);

  /* ---------- Climbing routes ---------- */
  const [routes, setRoutes] = useState<ClimbingRoute[]>([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [newRoute, setNewRoute] = useState({ name: '', grade: '', style: 'sport' as ClimbingStyle });
  const [newRouteImage, setNewRouteImage] = useState<File | null>(null);
  const [addingRoute, setAddingRoute] = useState(false);
  const [loggedRouteIds, setLoggedRouteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!spot) return;
    setRoutesLoading(true);
    apiFetch<ClimbingRoute[]>(`/api/climbing-routes/spot/${spot.id}`)
      .then((r) => setRoutes(Array.isArray(r) ? r : []))
      .catch(() => setRoutes([]))
      .finally(() => setRoutesLoading(false));
  }, [spot?.id]);

  useEffect(() => {
    if (!isAuthenticated || !spot) return;
    apiFetch<{ items: { routeId?: string }[] }>(`/api/logbook?spotId=${spot.id}&limit=100`, { auth: true })
      .then((res) => {
        const ids = new Set((res.items ?? []).map((e) => e.routeId).filter((x): x is string => Boolean(x)));
        setLoggedRouteIds(ids);
      }).catch(() => {});
  }, [spot?.id, isAuthenticated]);

  const handleAddRoute = async () => {
    if (!spot || !newRoute.name.trim()) return;
    setAddingRoute(true);
    try {
      const res = await apiFetch<{ route: ClimbingRoute }>('/api/climbing-routes', {
        method: 'POST', auth: true,
        body: JSON.stringify({ spotId: spot.id, name: newRoute.name, grade: newRoute.grade || undefined, style: newRoute.style }),
      });
      if (newRouteImage && res.route._id) {
        const form = new FormData();
        form.append('image', newRouteImage);
        await apiFetch(`/api/climbing-routes/${res.route._id}/image`, { method: 'POST', auth: true, body: form }).catch(() => {});
      }
      setRoutes((prev) => [...prev, res.route]);
      toast.success(res.route.status === 'pending' ? t('toast.route_pending') : t('toast.route_added'));
      setNewRoute({ name: '', grade: '', style: 'sport' }); setNewRouteImage(null); setShowAddRoute(false);
    } catch { toast.error(t('common.error')); }
    finally { setAddingRoute(false); }
  };

  const handleDeleteRoute = async (routeId: string) => {
    try {
      await apiFetch(`/api/climbing-routes/${routeId}`, { method: 'DELETE', auth: true });
      setRoutes((prev) => prev.filter((r) => r._id !== routeId));
      toast.success(t('toast.route_deleted'));
    } catch { toast.error(t('common.error')); }
  };

  const handleCocher = async (routeId: string, grade: string) => {
    if (!spot || !isAuthenticated) { toast.error(t('toast.login_required')); return; }
    if (loggedRouteIds.has(routeId)) return;
    try {
      const payload: Record<string, unknown> = { spotId: spot.id, routeId, style: 'redpoint', date: new Date().toISOString().slice(0, 10) };
      if (grade) payload.grade = grade;
      await apiFetch('/api/logbook', { method: 'POST', auth: true, body: JSON.stringify(payload) });
      setLoggedRouteIds((prev) => new Set([...prev, routeId]));
      toast.success(t('toast.log_saved'));
    } catch { toast.error(t('common.error')); }
  };

  /* ---------- Reviews ---------- */
  interface Review { _id: string; userId: string; username: string; rating: number; comment?: string; createdAt: string; }
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!spot) return;
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
  }, [spot?.id, meId]);

  const submitReview = async () => {
    if (!spot || !reviewRating) return;
    setSubmittingReview(true);
    try {
      if (myReview) {
        await apiFetch(`/api/reviews/${myReview._id}`, { method: 'PATCH', auth: true, body: JSON.stringify({ rating: reviewRating, comment: reviewComment || undefined }) });
        const updated: Review = { ...myReview, rating: reviewRating, comment: reviewComment || undefined };
        setReviews((prev) => prev.map((rv) => rv._id === myReview._id ? updated : rv));
        setMyReview(updated);
      } else {
        const created = await apiFetch<Review>('/api/reviews', { method: 'POST', auth: true, body: JSON.stringify({ spotId: spot.id, rating: reviewRating, comment: reviewComment || undefined }) });
        setReviews((prev) => [created, ...prev]); setMyReview(created);
      }
      setShowReviewForm(false); toast.success(t('toast.review_saved'));
    } catch { toast.error(t('common.error')); }
    finally { setSubmittingReview(false); }
  };

  const deleteReview = async (reviewId: string) => {
    if (!confirm(t('review.confirm_delete'))) return;
    try {
      await apiFetch(`/api/reviews/${reviewId}`, { method: 'DELETE', auth: true });
      setReviews((prev) => prev.filter((rv) => rv._id !== reviewId));
      setMyReview(null); setReviewRating(0); setReviewComment('');
      toast.success(t('toast.review_deleted'));
    } catch { toast.error(t('common.error')); }
  };

  /* ---------- Logger grimpe ---------- */
  const [showLogger, setShowLogger] = useState(false);
  const [logRouteId, setLogRouteId] = useState('');
  const [logStyle, setLogStyle] = useState('redpoint');
  const [logGrade, setLogGrade] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logComment, setLogComment] = useState('');
  const [logging, setLogging] = useState(false);
  const LOG_STYLES = ['onsight', 'flash', 'redpoint', 'repeat'] as const;

  useEffect(() => { if (spot) setLogGrade(spot.niveau_max ?? ''); }, [spot?.niveau_max]);

  const handleLogRouteChange = (routeId: string) => {
    setLogRouteId(routeId);
    const route = routes.find((r) => r._id === routeId);
    if (route?.grade) setLogGrade(route.grade);
  };

  const submitLog = async () => {
    if (!spot) return;
    if (logRouteId && loggedRouteIds.has(logRouteId)) { toast.error(t('logbook.route_already_logged')); return; }
    setLogging(true);
    try {
      const payload: Record<string, unknown> = { spotId: spot.id, style: logStyle, date: logDate };
      if (logRouteId) payload.routeId = logRouteId;
      if (logComment.trim()) payload.notes = logComment.trim();
      await apiFetch('/api/logbook', { method: 'POST', auth: true, body: JSON.stringify(payload) });
      toast.success(t('toast.log_saved'));
      if (logRouteId) setLoggedRouteIds((prev) => new Set([...prev, logRouteId]));
      setShowLogger(false);
    } catch { toast.error(t('common.error')); }
    finally { setLogging(false); }
  };

  /* ---------- Delete spot ---------- */
  const handleDeleteSpot = async () => {
    if (!spot || !confirm(t('spot.delete_confirm', { name: spot.name }))) return;
    try {
      await apiFetch(`/api/spots/${spot.id}`, { method: 'DELETE', auth: true });
      toast.success(t('toast.spot_deleted')); navigate('/map');
    } catch { toast.error(t('common.error')); }
  };

  const [editSpot, setEditSpot] = useState<Spot | null>(null);

  /* ---------- Cotation data ---------- */
  const gradeCounts = routes.reduce<Record<string, number>>((acc, r) => {
    const band = r.grade ? getGradeBand(r.grade) : '';
    if (band) acc[band] = (acc[band] ?? 0) + 1;
    return acc;
  }, {});
  const maxBandCount = Math.max(...Object.values(gradeCounts), 1);

  /* ---------- Loading / error ---------- */
  if (spotLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-sage" /></div>;
  }
  if (spotError || !spot) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <MapPin className="h-12 w-12 text-text-secondary/30" />
        <p className="text-sm text-text-secondary">{t('common.error')}</p>
        <button onClick={() => navigate('/map')} className="text-sm font-semibold text-sage hover:underline" type="button">{t('nav.map')}</button>
      </div>
    );
  }

  const typeInfo = SPOT_TYPES[spot.type] || SPOT_TYPES.crag;
  const gradeLevel = getGradeLevel(spot.niveau_max);
  const hasGrade = spot.niveau_min || spot.niveau_max;
  const gradeText = hasGrade ? `${spot.niveau_min || '?'}  →  ${spot.niveau_max || '?'}` : null;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;
  const orientLabel = spot.orientation && t(`orient.${spot.orientation}`) !== `orient.${spot.orientation}` ? t(`orient.${spot.orientation}`) : spot.orientation;
  const spotTypeLabel = t(`spot.type.${spot.type}`) !== `spot.type.${spot.type}` ? t(`spot.type.${spot.type}`) : t(typeInfo.key);

  return (
    <>
    <div className="mx-auto max-w-5xl px-4 py-6">

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        type="button"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('nav.map')}
      </button>

      {/* Hero */}
      <div className="relative mb-4 overflow-hidden rounded-2xl">
        {hasPhotos ? (
          <>
            <img
              src={localPhotos[photoIdx].url}
              alt={`Photo ${photoIdx + 1} de ${spot.name}`}
              className="h-56 w-full cursor-zoom-in object-cover sm:h-72 lg:h-80"
              loading="lazy"
              onClick={() => setLightboxOpen(true)}
            />
            {localPhotos[photoIdx].status === 'pending' && (
              <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-amber-500/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                <Clock className="h-3 w-3" /> {t('common.pending')}
              </span>
            )}
            <button onClick={() => setLightboxOpen(true)} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60" type="button">
              <Maximize2 className="h-4 w-4" />
            </button>
            {isAuthenticated && localPhotos[photoIdx]._id && (isAdmin || localPhotos[photoIdx].uploadedBy?.uid === meId) && (
              <button onClick={() => handleDeletePhoto(localPhotos[photoIdx]._id!, photoIdx)} className="absolute left-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-full bg-red-600/80 text-white backdrop-blur-sm hover:bg-red-700" type="button">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            {photoCount > 1 && (
              <>
                <button onClick={prevPhoto} className="absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60" type="button"><ChevronLeft className="h-5 w-5" /></button>
                <button onClick={nextPhoto} className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60" type="button"><ChevronRight className="h-5 w-5" /></button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">{photoIdx + 1} / {photoCount}</div>
              </>
            )}
          </>
        ) : (
          <div className="relative h-44 sm:h-56 lg:h-64" style={{ background: TYPE_GRADIENT[spot.type] ?? TYPE_GRADIENT.crag }}>
            <svg viewBox="0 0 600 192" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <path d="M 0 192 L 0 117 L 120 60 L 240 97 L 360 45 L 480 87 L 600 57 L 600 192 Z" fill="rgba(0,0,0,0.28)" />
              <path d="M 0 192 L 0 150 L 90 108 L 195 132 L 300 90 L 420 120 L 540 102 L 600 120 L 600 192 Z" fill="rgba(0,0,0,0.18)" />
            </svg>
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {photoCount > 1 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto scrollbar-none">
          {localPhotos.map((p, i) => (
            <button key={p._id ?? i} onClick={() => setPhotoIdx(i)} className={cn('relative h-12 w-12 shrink-0 rounded-lg overflow-hidden transition-all', i === photoIdx ? 'ring-2 ring-sage opacity-100' : 'opacity-50 hover:opacity-80')} type="button">
              <img src={p.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {/* Add photo */}
      {isAuthenticated && (
        <label className={cn('mb-5 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border-subtle bg-surface px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-2', uploadingPhoto && 'pointer-events-none opacity-50')}>
          {uploadingPhoto ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <ImagePlus className="h-4 w-4 shrink-0" />}
          <span>{t('spot.add_photos')}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadPhoto(f); e.target.value = ''; }} disabled={uploadingPhoto} />
        </label>
      )}

      {/* ── 2-column layout on desktop ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_288px]">

        {/* ── Left column ── */}
        <div>
          {/* Spot header */}
          <div className="mb-4">
            <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-secondary/60">
              <span>{spotTypeLabel}</span>
              {spot.info_complementaires?.rock && <><span>·</span><span>{spot.info_complementaires.rock}</span></>}
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-heading text-2xl font-bold leading-tight text-text-primary sm:text-3xl">{spot.name}</h1>
                {(spot.orientation || spot.hauteur) && (
                  <p className="mt-1 text-sm text-text-secondary">
                    {orientLabel && <span>Orientation {orientLabel}</span>}
                    {orientLabel && spot.hauteur && <span> · </span>}
                    {spot.hauteur && <span>{spot.hauteur} voies</span>}
                  </p>
                )}
              </div>
              {spot.avgRating != null && spot.avgRating > 0 && (
                <div className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-brand/10 px-2.5 py-1.5">
                  <Star className="h-4 w-4 fill-amber-brand text-amber-brand" />
                  <span className="text-sm font-bold text-amber-brand">{spot.avgRating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Stats chips */}
          <div className="mb-5 flex flex-wrap gap-1.5">
            {gradeText && (
              <span className={cn('inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold', GRADE_CLS[gradeLevel])}>
                <Zap className="h-3 w-3" />{gradeText}
              </span>
            )}
            {spot.orientation && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-text-secondary">
                <Compass className="h-3 w-3" style={{ transform: `rotate(${ORIENT_DEG[spot.orientation] ?? 0}deg)` }} />{orientLabel}
              </span>
            )}
            {routes.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-text-secondary">
                <RouteIcon className="h-3 w-3" />{routes.length} {t('spot.routes')}
              </span>
            )}
            {spot.reviewCount != null && spot.reviewCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-text-secondary">
                {t('review.count', { count: spot.reviewCount })}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="mb-6 flex gap-2">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-sage px-4 py-3 text-sm font-semibold text-white no-underline shadow-soft transition-all hover:bg-sage-hover hover:shadow-card active:scale-[0.98]"
            >
              <Navigation className="h-4 w-4" />
              {t('spot.directions')}
            </a>
            <button onClick={toggleBookmark} disabled={bookmarkLoading} className={cn('flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border transition-all active:scale-95', bookmarked ? 'border-sage bg-sage-muted text-sage' : 'border-border-subtle text-text-secondary hover:border-sage/30 hover:bg-sage-muted hover:text-sage', bookmarkLoading && 'opacity-50')} type="button" title={t('spot.bookmark')}>
              <Bookmark className={cn('h-4 w-4', bookmarked && 'fill-sage')} />
            </button>
            <button onClick={handleShare} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-border-subtle text-text-secondary transition-all hover:border-sage/30 hover:bg-sage-muted hover:text-sage active:scale-95" type="button" title={t('spot.share')}>
              <Share2 className="h-4 w-4" />
            </button>
            {isAuthenticated && spot.type !== 'shop' && (
              <button onClick={() => setShowLogger((v) => !v)} className={cn('flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border transition-all active:scale-95', showLogger ? 'border-sage bg-sage-muted text-sage' : 'border-border-subtle text-text-secondary hover:border-sage/30 hover:bg-sage-muted hover:text-sage')} type="button" title={t('logbook.log_climb')}>
                <BookOpen className="h-4 w-4" />
              </button>
            )}
            {isAuthenticated && (
              <button onClick={() => setEditSpot(spot)} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-border-subtle text-text-secondary transition-all hover:border-sage/30 hover:bg-sage-muted hover:text-sage active:scale-95" type="button" title={t('spot.edit')}>
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {isAdmin && (
              <button onClick={handleDeleteSpot} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-red-200 text-red-400 transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-500 active:scale-95" type="button" title={t('spot.delete_spot')}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Log form */}
          {showLogger && (
            <div className="mb-6 rounded-2xl border border-border-subtle bg-surface-2/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary/70">{t('logbook.log_climb')}</h3>
                <button onClick={() => setShowLogger(false)} className="cursor-pointer rounded-lg p-1 text-text-secondary hover:bg-surface-2" type="button"><X className="h-3.5 w-3.5" /></button>
              </div>
              <div className="space-y-2">
                {routes.length > 0 && (
                  <select value={logRouteId} onChange={(e) => handleLogRouteChange(e.target.value)} className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-sage">
                    <option value="">{t('logbook.select_route')}</option>
                    {routes.map((r) => {
                      const done = loggedRouteIds.has(r._id);
                      return <option key={r._id} value={r._id} disabled={done}>{done ? '✓ ' : ''}{r.name}{r.grade ? ` — ${r.grade}` : ''}{done ? ` (${t('logbook.already_logged')})` : ''}</option>;
                    })}
                  </select>
                )}
                <div className="flex gap-2">
                  {LOG_STYLES.map((s) => (
                    <button key={s} type="button" onClick={() => setLogStyle(s)} className={cn('flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all', logStyle === s ? 'bg-sage text-white' : 'border border-border-subtle bg-surface text-text-secondary hover:bg-surface-2')}>
                      {t(`logbook.style.${s}`)}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={logGrade} onChange={(e) => setLogGrade(e.target.value)} placeholder={t('logbook.form_grade')} className="w-1/2 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-sage" />
                  <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="w-1/2 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-sage" />
                </div>
                <textarea value={logComment} onChange={(e) => setLogComment(e.target.value)} placeholder={t('logbook.form_comment_placeholder')} rows={2} className="w-full resize-none rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none placeholder:text-text-secondary/50 focus:border-sage" />
                <button onClick={submitLog} disabled={logging} className="flex w-full items-center justify-center gap-2 rounded-lg bg-sage py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50" type="button">
                  {logging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
                  {t('logbook.save_entry')}
                </button>
              </div>
            </div>
          )}

          {/* Description */}
          {spot.description && <p className="mb-5 text-sm leading-relaxed text-text-secondary">{spot.description}</p>}

          {/* Access */}
          {spot.acces && (
            <div className="mb-5 rounded-2xl border border-border-subtle bg-surface-2/30 p-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-secondary/70">{t('spot.access')}</p>
              <p className="text-sm leading-relaxed text-text-secondary">{spot.acces}</p>
            </div>
          )}

          {/* Climbing routes */}
          {spot.type !== 'shop' && (
            <div className="mb-5 overflow-hidden rounded-2xl border border-border-subtle bg-surface">
              <div className="flex items-center justify-between px-4 py-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary/70">
                  {t('spot.climbing_routes')}
                  {routes.length > 0 && <span className="ml-1.5 text-text-primary">({routes.length})</span>}
                </h3>
                {isAuthenticated && !showAddRoute && (
                  <button onClick={() => setShowAddRoute(true)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-sage transition-colors hover:bg-sage-muted" type="button">
                    <Plus className="h-3 w-3" />{t('spot.add_route')}
                  </button>
                )}
              </div>

              {routesLoading ? (
                <p className="px-4 pb-4 text-center text-xs text-text-secondary/50">{t('common.loading')}...</p>
              ) : routes.length === 0 && !showAddRoute ? (
                <p className="px-4 pb-4 text-xs text-text-secondary/50">{t('spot.routes_empty')}</p>
              ) : (
                <div className="divide-y divide-border-subtle/50">
                  {routes.map((r) => {
                    const band = r.grade ? getGradeBand(r.grade) : '';
                    const badgeCls = band ? GRADE_BADGE_CLS[getGradeLevel(r.grade) || 'easy'] : 'bg-surface-2 text-text-secondary';
                    const done = loggedRouteIds.has(r._id);
                    return (
                      <div key={r._id} className={cn('flex items-center gap-3 px-4 py-3', r.status === 'pending' && 'bg-amber-50/50 dark:bg-amber-900/10')}>
                        {/* Grade badge */}
                        <span className={cn('flex w-14 shrink-0 items-center justify-center rounded-lg px-2 py-1.5 text-center text-xs font-bold', badgeCls)}>
                          {r.grade || '—'}
                        </span>
                        {/* Route info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-text-primary">{r.name}</span>
                            {r.status === 'pending' && (
                              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-brand/10 text-amber-brand shrink-0">
                                <Clock className="h-2.5 w-2.5" />{t('admin.status_pending')}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-secondary">
                            {r.style && <span>{t(STYLE_KEYS[r.style])}</span>}
                            {r.height && <span>{r.height}m</span>}
                            {r.bolts != null && <span>{r.bolts} pts</span>}
                          </div>
                        </div>
                        {/* Cocher / logged */}
                        {isAuthenticated && spot.type !== 'shop' && (
                          <button
                            onClick={() => handleCocher(r._id, r.grade ?? '')}
                            disabled={done}
                            className={cn(
                              'shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                              done
                                ? 'cursor-default bg-sage/10 text-sage'
                                : 'cursor-pointer border border-border-subtle text-text-secondary hover:border-sage/40 hover:bg-sage-muted hover:text-sage',
                            )}
                            type="button"
                          >
                            {done ? <Check className="h-3.5 w-3.5" /> : t('spot.check_off')}
                          </button>
                        )}
                        {/* Delete (admin / author) */}
                        {isAuthenticated && (isAdmin || r.createdBy?.uid === meId) && (
                          <button onClick={() => handleDeleteRoute(r._id)} className="shrink-0 rounded p-1 text-text-secondary/40 transition-colors hover:bg-red-50 hover:text-red-500" type="button" title={t('common.delete')}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add route form */}
              {showAddRoute && (
                <div className="border-t border-border-subtle px-4 py-3 space-y-2">
                  <input type="text" value={newRoute.name} onChange={(e) => setNewRoute((s) => ({ ...s, name: e.target.value }))} placeholder={t('spot.route_name_placeholder')} className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-sage" />
                  <div className="flex gap-2">
                    <input type="text" value={newRoute.grade} onChange={(e) => setNewRoute((s) => ({ ...s, grade: e.target.value }))} placeholder={t('spot.route_grade_placeholder')} className="w-1/2 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-sage" />
                    <select value={newRoute.style} onChange={(e) => setNewRoute((s) => ({ ...s, style: e.target.value as ClimbingStyle }))} className="w-1/2 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-sage">
                      {Object.entries(STYLE_KEYS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
                    </select>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border-subtle bg-surface px-3 py-2 text-sm text-text-secondary hover:bg-surface-2">
                    <ImagePlus className="h-4 w-4 shrink-0" />
                    {newRouteImage ? <span className="truncate text-text-primary">{newRouteImage.name}</span> : <span>{t('spot.route_image_optional')}</span>}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setNewRouteImage(e.target.files?.[0] ?? null)} />
                  </label>
                  {!isAdmin && <p className="flex items-center gap-1 text-[11px] text-amber-brand"><Clock className="h-3 w-3 shrink-0" />{t('spot.route_pending_notice')}</p>}
                  <div className="flex gap-2">
                    <button onClick={handleAddRoute} disabled={addingRoute || !newRoute.name.trim()} className="flex-1 rounded-lg bg-sage px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50" type="button">
                      {addingRoute ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t('common.add')}
                    </button>
                    <button onClick={() => { setShowAddRoute(false); setNewRouteImage(null); }} className="rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-surface-2" type="button"><X className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reviews */}
          {spot.type !== 'shop' && (
            <div className="mb-5 overflow-hidden rounded-2xl border border-border-subtle bg-surface">
              <div className="flex items-center justify-between px-4 py-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary/70">
                  {t('review.title')}
                  {reviews.length > 0 && <span className="ml-1.5 text-text-primary">({reviews.length})</span>}
                </h3>
                {isAuthenticated && !showReviewForm && (
                  <button onClick={() => setShowReviewForm(true)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-sage transition-colors hover:bg-sage-muted" type="button">
                    <Star className="h-3 w-3" />{myReview ? t('review.edit') : t('review.add')}
                  </button>
                )}
              </div>

              {showReviewForm && (
                <div className="border-t border-border-subtle px-4 py-3 space-y-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => setReviewRating(n)} className="cursor-pointer transition-transform hover:scale-110">
                        <Star className={cn('h-6 w-6', n <= reviewRating ? 'fill-amber-brand text-amber-brand' : 'text-text-secondary/30')} />
                      </button>
                    ))}
                  </div>
                  <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder={t('review.comment_placeholder')} rows={2} className="w-full resize-none rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none placeholder:text-text-secondary/50 focus:border-sage" />
                  <div className="flex gap-2">
                    <button onClick={submitReview} disabled={submittingReview || !reviewRating} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sage py-2 text-sm font-semibold text-white hover:bg-sage-hover disabled:opacity-50" type="button">
                      {submittingReview && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t('common.save')}
                    </button>
                    <button onClick={() => setShowReviewForm(false)} className="rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-surface-2" type="button"><X className="h-4 w-4" /></button>
                  </div>
                </div>
              )}

              {reviewsLoading ? (
                <p className="px-4 pb-4 text-center text-xs text-text-secondary/50">{t('common.loading')}...</p>
              ) : reviews.length === 0 ? (
                <p className="px-4 pb-4 text-xs text-text-secondary/50">{t('review.no_reviews')}</p>
              ) : (
                <div className="divide-y divide-border-subtle/50">
                  {reviews.map((rv) => (
                    <div key={rv._id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-text-primary">{rv.username}</span>
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={cn('h-3 w-3', n <= rv.rating ? 'fill-amber-brand text-amber-brand' : 'text-text-secondary/20')} />)}
                            </div>
                          </div>
                          {rv.comment && <p className="mt-1 text-xs leading-relaxed text-text-secondary">{rv.comment}</p>}
                        </div>
                        {meId === rv.userId && (
                          <button onClick={() => deleteReview(rv._id)} className="shrink-0 rounded p-1 text-text-secondary/40 hover:bg-red-50 hover:text-red-500" type="button">
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

          {/* External link */}
          {spot.url && (
            <div className="mb-4">
              <a href={spot.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-sage no-underline hover:text-sage-hover">
                <ArrowUpRight className="h-3.5 w-3.5" />{t('spot.website')}
              </a>
            </div>
          )}

          {/* Contributor footer */}
          {(spot.createdBy || spot.submittedBy) && (
            <div className="border-t border-border-subtle pt-4 text-xs text-text-secondary">
              {t('spot.proposed_by')}{' '}
              <button onClick={() => { const uid = spot.createdBy?.uid || spot.submittedBy?.uid; if (uid) navigate(`/profile?id=${uid}`); }} className="font-semibold text-sage hover:text-sage-hover hover:underline" type="button">
                {spot.createdBy?.displayName || spot.submittedBy?.displayName}
              </button>
              {spot.createdAt && <> &middot; {new Date(spot.createdAt).toLocaleDateString()}</>}
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-4">

          {/* Weather widget */}
          <div className="rounded-2xl border border-border-subtle bg-surface p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary/70">{t('spot.weather')}</h3>
            {weatherLoading ? (
              <div className="mt-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-text-secondary/40" /></div>
            ) : weather ? (
              <div className="mt-3 flex items-center gap-3">
                <WmoIcon code={weather.code} className={cn('h-10 w-10', wmoIconColor(weather.code))} />
                <div>
                  <p className="text-2xl font-bold text-text-primary">{weather.temp}°C</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-secondary">
                    <span>{t(wmoKey(weather.code))}</span>
                    <span>·</span>
                    <Wind className="h-3 w-3" />
                    <span>{t('weather.wind', { speed: weather.windKmh })}</span>
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs italic text-text-secondary/50">{t('spot.weather_soon')}</p>
            )}
          </div>

          {/* Cotation chart */}
          {!routesLoading && routes.length > 0 && (
            <div className="rounded-2xl border border-border-subtle bg-surface p-4">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-secondary/70">{t('spot.cotation')}</h3>
              <div className="flex items-end justify-around gap-1">
                {GRADE_BANDS.map((band) => {
                  const count = gradeCounts[band] ?? 0;
                  const heightPx = count > 0 ? Math.max(8, Math.round((count / maxBandCount) * 80)) : 0;
                  return (
                    <div key={band} className="flex flex-col items-center gap-1.5">
                      <span className="text-[10px] font-bold text-text-secondary/60">{count > 0 ? count : ''}</span>
                      <div
                        className={cn('w-9 rounded-t-md transition-all', count > 0 ? BAND_COLOR[band] : 'bg-border-subtle/30')}
                        style={{ height: `${count > 0 ? heightPx : 8}px` }}
                      />
                      <span className="text-[10px] font-medium text-text-secondary">{band}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Edit wizard */}
    {editSpot && (
      <Suspense fallback={null}>
        <EditSpotWizard spot={editSpot} onClose={() => setEditSpot(null)} onSuccess={() => setEditSpot(null)} />
      </Suspense>
    )}

    {/* Lightbox */}
    {lightboxOpen && hasPhotos && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-sm" onClick={() => setLightboxOpen(false)}>
        <button onClick={() => setLightboxOpen(false)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" type="button"><X className="h-5 w-5" /></button>
        <img src={localPhotos[photoIdx]?.url} alt="" className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
        {photoCount > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); prevPhoto(); }} className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" type="button"><ChevronLeft className="h-6 w-6" /></button>
            <button onClick={(e) => { e.stopPropagation(); nextPhoto(); }} className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" type="button"><ChevronRight className="h-6 w-6" /></button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-white backdrop-blur-sm">{photoIdx + 1} / {photoCount}</div>
          </>
        )}
      </div>
    )}
    </>
  );
}
