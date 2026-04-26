import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import {
  Navigation, Compass, Zap, Bookmark, Share2, MapPin, Star,
  ChevronLeft, ChevronRight, Route as RouteIcon, Maximize2, X, ArrowRight,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { cn, getGradeLevel, ORIENT_DEG, SPOT_TYPES } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import type { Spot } from '@/types';

interface SpotSheetProps {
  spot: Spot;
  onClose: () => void;
}

const GRADE_CLS: Record<string, string> = {
  easy: 'bg-grade-easy/10 text-grade-easy border-grade-easy/20',
  medium: 'bg-grade-medium/10 text-grade-medium border-grade-medium/20',
  hard: 'bg-grade-hard/10 text-grade-hard border-grade-hard/20',
  expert: 'bg-grade-expert/10 text-grade-expert border-grade-expert/20',
  elite: 'bg-grade-elite/10 text-grade-elite border-grade-elite/20',
};

const TYPE_CLS: Record<string, { bg: string; gradient: string }> = {
  crag: { bg: 'bg-type-crag', gradient: 'from-type-crag/8 via-type-crag/3' },
  boulder: { bg: 'bg-type-boulder', gradient: 'from-type-boulder/8 via-type-boulder/3' },
  indoor: { bg: 'bg-type-indoor', gradient: 'from-type-indoor/8 via-type-indoor/3' },
  shop: { bg: 'bg-type-shop', gradient: 'from-type-shop/8 via-type-shop/3' },
};

export function SpotSheet({ spot, onClose }: SpotSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

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
  const [localPhotos, setLocalPhotos] = useState(spot.photos);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    setPhotoIdx(0);
    setLocalPhotos(spot.photos);
  }, [spot.id, spot.photos]);

  const hasPhotos = localPhotos.length > 0;
  const photoCount = localPhotos.length;
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
    if (!isAuthenticated) { toast.error(t('toast.login_required')); return; }
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
      url: `${window.location.origin}/ZoneDeGrimpe/spot/${spot.id}`,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(shareData.url); toast.success(t('share.copied')); }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        await navigator.clipboard.writeText(shareData.url).catch(() => {});
        toast.success(t('share.copied'));
      }
    }
  }, [spot, typeInfo.key, t]);

  const openFullView = () => {
    navigate(`/spot/${spot.id}`, { state: { spot } });
    onClose();
  };

  return (
    <>
    <Drawer.Root open onOpenChange={(open) => !open && onClose()} modal={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[1001] bg-black/25 backdrop-blur-[2px] md:hidden" />
        <Drawer.Content
          aria-describedby={undefined}
          className={cn(
            'fixed inset-x-0 bottom-0 z-[1002] outline-none',
            'md:absolute md:bottom-4 md:left-4 md:right-auto md:w-[380px]',
          )}
        >
          <div className={cn(
            'overflow-hidden rounded-t-2xl bg-surface shadow-elevated',
            'md:rounded-2xl',
            'ring-1 ring-border-subtle/50',
          )}>
            {/* Hero gradient (no photos) */}
            {!hasPhotos && (
              <div
                className="relative h-28 shrink-0 overflow-hidden md:rounded-t-2xl"
                style={{
                  background: ({
                    crag: 'linear-gradient(135deg, #5D7052 0%, #4A5A41 55%, #C18845 100%)',
                    boulder: 'linear-gradient(135deg, #C18845 0%, #8a5d2e 100%)',
                    indoor: 'linear-gradient(135deg, #4A90D9 0%, #2563eb 100%)',
                    shop: 'linear-gradient(135deg, #8B5CF6 0%, #6d28d9 100%)',
                  } as Record<string, string>)[spot.type] ?? 'linear-gradient(135deg, #5D7052 0%, #4A5A41 55%, #C18845 100%)',
                }}
              >
                <svg viewBox="0 0 400 112" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                  <path d="M 0 112 L 0 68 L 80 35 L 160 57 L 240 26 L 320 50 L 400 33 L 400 112 Z" fill="rgba(0,0,0,0.28)" />
                  <path d="M 0 112 L 0 88 L 60 63 L 130 77 L 200 52 L 280 70 L 360 60 L 400 70 L 400 112 Z" fill="rgba(0,0,0,0.18)" />
                </svg>
                <div className="absolute bottom-3 left-4 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
                    <MapPin className="h-3 w-3" />
                    {t(typeInfo.key)}
                  </span>
                </div>
              </div>
            )}

            {/* Drag handle (mobile, when no hero) */}
            {hasPhotos && (
              <div className="flex justify-center pt-3 pb-1 md:hidden">
                <Drawer.Handle className="h-1.5 w-12 rounded-full bg-text-secondary/20" />
              </div>
            )}

            {/* Photo carousel */}
            {hasPhotos && (
              <div className="relative overflow-hidden">
                <img
                  src={localPhotos[photoIdx].url}
                  alt={`Photo ${photoIdx + 1} de ${spot.name}`}
                  className="h-44 w-full cursor-zoom-in object-cover"
                  loading="lazy"
                  onClick={() => setLightboxOpen(true)}
                />
                <button
                  onClick={() => setLightboxOpen(true)}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                  type="button"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                {photoCount > 1 && (
                  <>
                    <button onClick={prevPhoto} className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60" type="button">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button onClick={nextPhoto} className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60" type="button">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                      {photoIdx + 1} / {photoCount}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Type banner */}
            <div className={cn('bg-gradient-to-b to-transparent px-5 pt-4 pb-3', hasPhotos ? typeCls.gradient : '')}>
              <div className="flex items-start gap-3.5">
                <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-soft', typeCls.bg)}>
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <Drawer.Title className="truncate font-heading text-lg font-bold leading-tight text-text-primary">
                    {spot.name}
                  </Drawer.Title>
                  <p className="mt-0.5 text-xs font-medium text-text-secondary">
                    {t(`spot.type.${spot.type}`) !== `spot.type.${spot.type}` ? t(`spot.type.${spot.type}`) : t(typeInfo.key)}
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
            <div className="flex flex-wrap gap-1.5 px-5 pb-3">
              {gradeText && (
                <span className={cn('inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold', GRADE_CLS[gradeLevel])}>
                  <Zap className="h-3 w-3" />
                  {gradeText}
                </span>
              )}
              {spot.orientation && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-text-secondary">
                  <Compass className="h-3 w-3" style={{ transform: `rotate(${ORIENT_DEG[spot.orientation] ?? 0}deg)` }} />
                  {orientLabel}
                </span>
              )}
              {spot.info_complementaires?.rock && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-text-secondary">
                  {spot.info_complementaires.rock}
                </span>
              )}
              {spot.hauteur && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-text-secondary">
                  {spot.hauteur}m
                </span>
              )}
              {spot.reviewCount != null && spot.reviewCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-text-secondary">
                  <RouteIcon className="h-3 w-3" />
                  {t('review.count', { count: spot.reviewCount })}
                </span>
              )}
            </div>

            {/* Description (truncated) */}
            {spot.description && (
              <p className="line-clamp-2 px-5 pb-3 text-sm leading-relaxed text-text-secondary">
                {spot.description}
              </p>
            )}

            {/* Action bar */}
            <div className="flex gap-2 border-t border-border-subtle px-5 py-4">
              {/* Voir spot — primary CTA */}
              <button
                type="button"
                onClick={openFullView}
                className={cn(
                  'inline-flex flex-1 cursor-pointer items-center justify-center gap-2',
                  'rounded-xl bg-sage px-4 py-3 text-sm font-semibold text-white',
                  'shadow-soft transition-all hover:bg-sage-hover hover:shadow-card active:scale-[0.98]',
                )}
              >
                {t('spot.view_full')}
                <ArrowRight className="h-4 w-4" />
              </button>

              {/* Directions */}
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl',
                  'border border-border-subtle text-text-secondary no-underline',
                  'transition-all hover:border-sage/30 hover:bg-sage-muted hover:text-sage active:scale-95',
                )}
                title={t('spot.directions')}
              >
                <Navigation className="h-4 w-4" />
              </a>

              {/* Bookmark */}
              <button
                onClick={toggleBookmark}
                disabled={bookmarkLoading}
                className={cn(
                  'flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border transition-all active:scale-95',
                  bookmarked ? 'border-sage bg-sage-muted text-sage' : 'border-border-subtle text-text-secondary hover:border-sage/30 hover:bg-sage-muted hover:text-sage',
                  bookmarkLoading && 'opacity-50',
                )}
                type="button"
                title={t('spot.bookmark')}
              >
                <Bookmark className={cn('h-4 w-4', bookmarked && 'fill-sage')} />
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-border-subtle text-text-secondary transition-all hover:border-sage/30 hover:bg-sage-muted hover:text-sage active:scale-95"
                type="button"
                title={t('spot.share')}
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
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
          src={localPhotos[photoIdx]?.url}
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
