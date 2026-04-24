import { useTranslation } from 'react-i18next';
import {
  Cable, Shield, Footprints, Anchor, Package,
  Lock, RotateCw, Square, Link, Link2, Circle,
  Pencil, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserMateriel, GearCategory } from '@/types';

const CATEGORY_ICONS: Record<GearCategory, typeof Package> = {
  rope:       Cable,
  quickdraw:  Link,
  belay_auto: Anchor,
  belay_tube: Circle,
  harness:    Shield,
  shoes:      Footprints,
  carabiner:  Lock,
  machard:    RotateCw,
  crashpad:   Square,
  quicklink:  Link2,
};

const EPI_BADGE: Record<string, { label: string; cls: string }> = {
  ok:     { label: 'gear.epi.ok',     cls: 'bg-grade-easy/10 text-grade-easy border-grade-easy/30' },
  watch:  { label: 'gear.epi.watch',  cls: 'bg-amber-50 text-amber-600 border-amber-300 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700' },
  retire: { label: 'gear.epi.retire', cls: 'bg-red-50 text-red-600 border-red-300 dark:bg-red-900/20 dark:text-red-400 dark:border-red-700' },
};

interface GearCardProps {
  item: UserMateriel;
  onEdit?: (item: UserMateriel) => void;
  onDelete?: (item: UserMateriel) => void;
  readonly?: boolean;
}

function formatSpecs(category: GearCategory, specs: Record<string, unknown> | undefined, t: (k: string) => string): string | null {
  if (!specs) return null;
  switch (category) {
    case 'rope': {
      const parts: string[] = [];
      if (specs.length_m) parts.push(`${specs.length_m}m`);
      if (specs.diameter_mm) parts.push(`∅${specs.diameter_mm}mm`);
      return parts.join(' · ') || null;
    }
    case 'harness':
      return specs.size ? `${t('gear.specs.size')} ${specs.size}` : null;
    case 'shoes':
      return specs.shoeSize ? String(specs.shoeSize) : null;
    case 'carabiner': {
      const parts: string[] = [];
      if (specs.carabinerType) parts.push(t(`gear.specs.carabiner_type.${specs.carabinerType}`));
      if (specs.carabinerShape) parts.push(specs.carabinerShape === 'oval' ? t('gear.specs.carabiner_shape.oval') : String(specs.carabinerShape));
      return parts.join(' · ') || null;
    }
    case 'machard':
      return specs.cordLength_cm ? `${specs.cordLength_cm}cm` : null;
    case 'crashpad':
      return specs.dimensions ? `${specs.dimensions} cm` : null;
    default:
      return null;
  }
}

export function GearCard({ item, onEdit, onDelete, readonly = false }: GearCardProps) {
  const { t } = useTranslation();

  const Icon = CATEGORY_ICONS[item.category] ?? Package;
  const displayName = item.customName || [item.brand, item.model].filter(Boolean).join(' ') || t(`gear.category.${item.category}`);
  const epi = item.epiStatus ? EPI_BADGE[item.epiStatus] : null;
  const specsLine = formatSpecs(item.category, item.specs, t);

  function formatDate(iso?: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString();
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface p-4 shadow-soft transition-shadow hover:shadow-card">
      {/* Icon or photo */}
      {item.photoUrl ? (
        <img
          src={item.photoUrl}
          alt={displayName}
          className="h-11 w-11 shrink-0 rounded-xl object-cover border border-border-subtle"
        />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sage/10 text-sage">
          <Icon className="h-5 w-5" />
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-text-primary">{displayName}</p>
            {(item.quantity ?? 1) > 1 && (
              <span className="shrink-0 rounded-full bg-sage/10 px-1.5 py-0.5 text-[10px] font-bold text-sage">
                ×{item.quantity}
              </span>
            )}
          </div>
          {epi && (
            <span className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
              epi.cls,
            )}>
              {t(epi.label)}
            </span>
          )}
        </div>

        <p className="mt-0.5 text-xs text-text-secondary">{t(`gear.category.${item.category}`)}</p>
        {specsLine && (
          <p className="mt-0.5 text-[11px] font-medium text-text-secondary/80">{specsLine}</p>
        )}

        {(item.purchaseDate || item.firstUseDate) && (
          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-text-secondary">
            {item.purchaseDate && (
              <span>{t('gear.purchase_date')} : {formatDate(item.purchaseDate)}</span>
            )}
            {item.firstUseDate && item.firstUseDate !== item.purchaseDate && (
              <span>· {t('gear.first_use')} : {formatDate(item.firstUseDate)}</span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {!readonly && (
        <div className="flex shrink-0 items-center gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-2 hover:text-sage"
              aria-label={t('gear.edit_title')}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(item)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
              aria-label={t('gear.delete_confirm')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
