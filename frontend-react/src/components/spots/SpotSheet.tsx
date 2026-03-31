import { useTranslation } from 'react-i18next';
import { X, Navigation, Compass, Zap, Bookmark, Share2, MapPin } from 'lucide-react';
import { cn, getGradeLevel, ORIENT_DEG, SPOT_TYPES } from '@/lib/utils';
import type { Spot } from '@/types';

interface SpotSheetProps {
  spot: Spot;
  onClose: () => void;
}

const GRADE_COLORS: Record<string, string> = {
  easy: 'bg-grade-easy/10 text-grade-easy',
  medium: 'bg-grade-medium/10 text-grade-medium',
  hard: 'bg-grade-hard/10 text-grade-hard',
  expert: 'bg-grade-expert/10 text-grade-expert',
  elite: 'bg-grade-elite/10 text-grade-elite',
};

export function SpotSheet({ spot, onClose }: SpotSheetProps) {
  const { t } = useTranslation();

  const typeInfo = SPOT_TYPES[spot.type] || SPOT_TYPES.crag;
  const gradeLevel = getGradeLevel(spot.niveau_max);
  const hasGrade = spot.niveau_min || spot.niveau_max;
  const gradeText = hasGrade
    ? `${spot.niveau_min || '?'}  \u2192  ${spot.niveau_max || '?'}`
    : null;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;

  const orientLabel =
    spot.orientation && t(`orient.${spot.orientation}`) !== `orient.${spot.orientation}`
      ? t(`orient.${spot.orientation}`)
      : spot.orientation;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1002] md:absolute md:bottom-4 md:left-4 md:right-auto md:w-96">
      {/* Backdrop on mobile */}
      <div
        className="fixed inset-0 bg-black/20 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className={cn(
          'relative max-h-[75vh] overflow-y-auto rounded-t-[var(--radius-lg)] bg-surface shadow-elevated',
          'md:rounded-[var(--radius-lg)] md:max-h-[70vh]',
          'animate-[slideUp_0.3s_ease-out]',
        )}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center py-2 md:hidden">
          <div className="h-1 w-10 rounded-full bg-border-subtle" />
        </div>

        {/* Header banner */}
        <div
          className={cn(
            'flex items-center gap-3 px-5 py-4',
            'bg-gradient-to-r',
            spot.type === 'crag' && 'from-type-crag/10 to-transparent',
            spot.type === 'boulder' && 'from-type-boulder/10 to-transparent',
            spot.type === 'indoor' && 'from-type-indoor/10 to-transparent',
            spot.type === 'shop' && 'from-type-shop/10 to-transparent',
          )}
        >
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white',
              spot.type === 'crag' && 'bg-type-crag',
              spot.type === 'boulder' && 'bg-type-boulder',
              spot.type === 'indoor' && 'bg-type-indoor',
              spot.type === 'shop' && 'bg-type-shop',
            )}
          >
            <MapPin className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-heading text-lg font-bold text-text-primary">
              {spot.name}
            </h2>
            <p className="text-xs font-medium text-text-secondary">
              {t(`spot.type.${spot.type}`) !== `spot.type.${spot.type}`
                ? t(`spot.type.${spot.type}`)
                : typeInfo.label}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-black/5"
            type="button"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-2 px-5 py-3">
          {gradeText && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold',
                GRADE_COLORS[gradeLevel],
              )}
            >
              <Zap className="h-3 w-3" />
              {gradeText}
            </span>
          )}
          {spot.orientation && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-secondary">
              <Compass
                className="h-3 w-3"
                style={{ transform: `rotate(${ORIENT_DEG[spot.orientation] ?? 0}deg)` }}
              />
              {orientLabel}
            </span>
          )}
          {spot.info_complementaires?.rock && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-secondary">
              {spot.info_complementaires.rock}
            </span>
          )}
          {spot.hauteur && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-secondary">
              {spot.hauteur} m
            </span>
          )}
        </div>

        {/* Photos carousel placeholder */}
        {spot.photos.length > 0 && (
          <div className="mx-5 mb-3 overflow-hidden rounded-[var(--radius-sm)]">
            <img
              src={spot.photos[0].url}
              alt={`Photo de ${spot.name}`}
              className="h-40 w-full object-cover"
            />
            {spot.photos.length > 1 && (
              <div className="flex gap-1 p-1">
                {spot.photos.slice(0, 5).map((p, i) => (
                  <img
                    key={i}
                    src={p.url}
                    alt=""
                    className="h-10 w-10 rounded object-cover opacity-70 transition-opacity hover:opacity-100"
                  />
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
            <p className="text-xs font-semibold text-text-primary">{t('spot.access')}</p>
            <p className="mt-0.5 text-sm text-text-secondary">{spot.acces}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 border-t border-border-subtle px-5 py-4">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-sage px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-sage-hover no-underline"
          >
            <Navigation className="h-4 w-4" />
            {t('spot.directions')}
          </a>
          <button
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border border-border-subtle text-text-secondary transition-colors hover:bg-surface-2 hover:text-sage"
            type="button"
            title={t('spot.bookmark')}
          >
            <Bookmark className="h-4 w-4" />
          </button>
          <button
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border border-border-subtle text-text-secondary transition-colors hover:bg-surface-2 hover:text-sage"
            type="button"
            title={t('spot.share')}
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>

        {/* Contributor info */}
        {(spot.createdBy || spot.submittedBy) && (
          <div className="border-t border-border-subtle px-5 py-3 text-xs text-text-secondary">
            {t('spot.proposed_by')}{' '}
            <span className="font-medium text-text-primary">
              {spot.createdBy?.displayName || spot.submittedBy?.displayName}
            </span>
            {spot.createdAt && (
              <> &middot; {new Date(spot.createdAt).toLocaleDateString()}</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
