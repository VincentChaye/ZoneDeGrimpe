import { useTranslation } from 'react-i18next';
import { Drawer } from 'vaul';
import { Navigation, Compass, Zap, Bookmark, Share2, MapPin, Star, ArrowUpRight } from 'lucide-react';
import { cn, getGradeLevel, ORIENT_DEG, SPOT_TYPES } from '@/lib/utils';
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

const TYPE_CLS: Record<string, { bg: string; gradient: string; ring: string }> = {
  crag: { bg: 'bg-type-crag', gradient: 'from-type-crag/8 via-type-crag/3', ring: 'ring-type-crag/20' },
  boulder: { bg: 'bg-type-boulder', gradient: 'from-type-boulder/8 via-type-boulder/3', ring: 'ring-type-boulder/20' },
  indoor: { bg: 'bg-type-indoor', gradient: 'from-type-indoor/8 via-type-indoor/3', ring: 'ring-type-indoor/20' },
  shop: { bg: 'bg-type-shop', gradient: 'from-type-shop/8 via-type-shop/3', ring: 'ring-type-shop/20' },
};

export function SpotSheet({ spot, onClose }: SpotSheetProps) {
  const { t } = useTranslation();

  const typeInfo = SPOT_TYPES[spot.type] || SPOT_TYPES.crag;
  const typeCls = TYPE_CLS[spot.type] || TYPE_CLS.crag;
  const gradeLevel = getGradeLevel(spot.niveau_max);
  const hasGrade = spot.niveau_min || spot.niveau_max;
  const gradeText = hasGrade
    ? `${spot.niveau_min || '?'}  →  ${spot.niveau_max || '?'}`
    : null;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;

  const orientLabel =
    spot.orientation && t(`orient.${spot.orientation}`) !== `orient.${spot.orientation}`
      ? t(`orient.${spot.orientation}`)
      : spot.orientation;

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
                {/* Type icon */}
                <div className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-soft',
                  typeCls.bg,
                )}>
                  <MapPin className="h-5 w-5" />
                </div>

                {/* Title & type */}
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

                {/* Rating badge */}
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
              {spot.hauteur && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-text-secondary">
                  {spot.hauteur}m
                </span>
              )}
              {spot.reviewCount != null && spot.reviewCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-text-secondary">
                  {spot.reviewCount} {t('spot.reviews') || 'avis'}
                </span>
              )}
            </div>

            {/* Photos */}
            {spot.photos.length > 0 && (
              <div className="px-5 pb-3">
                <div className="overflow-hidden rounded-xl ring-1 ring-border-subtle/50">
                  <img
                    src={spot.photos[0].url}
                    alt={`Photo de ${spot.name}`}
                    className="h-44 w-full object-cover"
                    loading="lazy"
                  />
                  {spot.photos.length > 1 && (
                    <div className="flex gap-1 bg-surface-2/40 p-1.5">
                      {spot.photos.slice(1, 5).map((p, i) => (
                        <img
                          key={i}
                          src={p.url}
                          alt=""
                          className="h-12 w-12 rounded-lg object-cover opacity-70 transition-opacity hover:opacity-100"
                          loading="lazy"
                        />
                      ))}
                      {spot.photos.length > 5 && (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-2 text-xs font-bold text-text-secondary">
                          +{spot.photos.length - 5}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
                className={cn(
                  'flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl',
                  'border border-border-subtle text-text-secondary',
                  'transition-all duration-200 hover:border-sage/30 hover:bg-sage-muted hover:text-sage',
                  'active:scale-95',
                )}
                type="button"
                title={t('spot.bookmark')}
              >
                <Bookmark className="h-4 w-4" />
              </button>
              <button
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

            {/* Contributor footer */}
            {(spot.createdBy || spot.submittedBy) && (
              <div className="border-t border-border-subtle px-5 py-3 text-xs text-text-secondary">
                {t('spot.proposed_by')}{' '}
                <span className="font-semibold text-text-primary">
                  {spot.createdBy?.displayName || spot.submittedBy?.displayName}
                </span>
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
