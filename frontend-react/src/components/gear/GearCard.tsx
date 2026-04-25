import { useTranslation } from 'react-i18next';
import {
  Cable, Shield, Footprints, Anchor, Package,
  Lock, RotateCw, Square, Link, Link2, Circle,
  Pencil, Trash2, AlertTriangle, XCircle, CheckCircle,
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

const CATEGORY_BG: Record<GearCategory, string> = {
  rope:       'from-blue-50 to-blue-100 dark:from-blue-950/40 dark:to-blue-900/30',
  quickdraw:  'from-orange-50 to-orange-100 dark:from-orange-950/40 dark:to-orange-900/30',
  belay_auto: 'from-purple-50 to-purple-100 dark:from-purple-950/40 dark:to-purple-900/30',
  belay_tube: 'from-cyan-50 to-cyan-100 dark:from-cyan-950/40 dark:to-cyan-900/30',
  harness:    'from-rose-50 to-rose-100 dark:from-rose-950/40 dark:to-rose-900/30',
  shoes:      'from-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/30',
  carabiner:  'from-slate-50 to-slate-100 dark:from-slate-950/40 dark:to-slate-900/30',
  machard:    'from-green-50 to-green-100 dark:from-green-950/40 dark:to-green-900/30',
  crashpad:   'from-teal-50 to-teal-100 dark:from-teal-950/40 dark:to-teal-900/30',
  quicklink:  'from-indigo-50 to-indigo-100 dark:from-indigo-950/40 dark:to-indigo-900/30',
};

const CATEGORY_ICON_COLOR: Record<GearCategory, string> = {
  rope:       'text-blue-400',
  quickdraw:  'text-orange-400',
  belay_auto: 'text-purple-400',
  belay_tube: 'text-cyan-400',
  harness:    'text-rose-400',
  shoes:      'text-amber-400',
  carabiner:  'text-slate-400',
  machard:    'text-green-400',
  crashpad:   'text-teal-400',
  quicklink:  'text-indigo-400',
};

const EPI_CONFIG = {
  ok:     { label: 'gear.epi.ok',     Icon: CheckCircle,  cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',  bar: 'bg-emerald-500' },
  watch:  { label: 'gear.epi.watch',  Icon: AlertTriangle, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',      bar: 'bg-amber-500'   },
  retire: { label: 'gear.epi.retire', Icon: XCircle,      cls: 'bg-red-500/10 text-red-600 dark:text-red-400',            bar: 'bg-red-500'     },
};

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

interface GearCardProps {
  item: UserMateriel;
  onEdit?: (item: UserMateriel) => void;
  onDelete?: (item: UserMateriel) => void;
  readonly?: boolean;
}

export function GearCard({ item, onEdit, onDelete, readonly = false }: GearCardProps) {
  const { t } = useTranslation();

  const Icon = CATEGORY_ICONS[item.category] ?? Package;
  const bgGradient = CATEGORY_BG[item.category] ?? 'from-gray-50 to-gray-100';
  const iconColor = CATEGORY_ICON_COLOR[item.category] ?? 'text-gray-400';

  const brand = item.brand || '';
  const model = item.model || item.customName || t(`gear.category.${item.category}`);
  const displayName = item.customName || [item.brand, item.model].filter(Boolean).join(' ') || t(`gear.category.${item.category}`);

  const imageUrl = item.photoUrl || item.specImageUrl;
  const epi = item.epiStatus ? EPI_CONFIG[item.epiStatus] : null;
  const specsLine = formatSpecs(item.category, item.specs, t);

  function formatDate(iso?: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card">
      {/* EPI alert bar (top) */}
      {epi && item.epiStatus !== 'ok' && (
        <div className={cn('h-1 w-full shrink-0', epi.bar)} />
      )}

      {/* Product image area */}
      <div className={cn(
        'relative flex aspect-square w-full items-center justify-center bg-gradient-to-br',
        bgGradient,
      )}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={displayName}
            className="h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <Icon className={cn('h-16 w-16 opacity-30', iconColor)} />
        )}

        {/* Quantity badge */}
        {(item.quantity ?? 1) > 1 && (
          <span className="absolute right-2 top-2 rounded-full bg-sage px-2 py-0.5 text-[11px] font-bold text-white shadow">
            ×{item.quantity}
          </span>
        )}

        {/* EPI badge */}
        {epi && (
          <span className={cn(
            'absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
            epi.cls,
          )}>
            <epi.Icon className="h-3 w-3" />
            {t(epi.label)}
          </span>
        )}

        {/* Action overlay (shown on hover, desktop) */}
        {!readonly && (
          <div className="absolute inset-0 flex items-end justify-end gap-1.5 bg-gradient-to-t from-black/30 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
            {onEdit && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/90 text-gray-700 shadow backdrop-blur transition-colors hover:bg-white hover:text-sage"
                aria-label={t('gear.edit_title')}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/90 text-gray-700 shadow backdrop-blur transition-colors hover:bg-white hover:text-red-500"
                aria-label={t('gear.delete_confirm')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Product info */}
      <div className="flex flex-1 flex-col p-3">
        {brand && (
          <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-text-secondary/60">
            {brand}
          </p>
        )}
        <p className="mt-0.5 line-clamp-2 text-sm font-bold leading-tight text-text-primary">
          {model}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
            {t(`gear.category.${item.category}`)}
          </span>
          {specsLine && (
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-sage">
              {specsLine}
            </span>
          )}
        </div>

        {item.purchaseDate && (
          <p className="mt-1.5 text-[10px] text-text-secondary/60">
            {t('gear.purchase_date')} {formatDate(item.purchaseDate)}
          </p>
        )}

        {/* Mobile actions (always visible on mobile, hidden on desktop where hover works) */}
        {!readonly && (
          <div className="mt-2 flex items-center gap-1 md:hidden">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border-subtle py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-sage hover:text-sage"
              >
                <Pencil className="h-3 w-3" />
                {t('gear.edit_title')}
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(item)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-subtle text-text-secondary transition-colors hover:border-red-300 hover:text-red-500"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
