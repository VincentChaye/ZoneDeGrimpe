import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Minus, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useOutingStore } from '@/stores/outing.store';
import { CATEGORY_ICONS, CATEGORY_ICON_COLOR } from '@/components/gear/gearCategoryUI';
import type { OutingItem } from '@/types';

interface Props {
  item: OutingItem;
  outingId: string;
  convId: string;
  myUid: string;
}

export function ItemRow({ item, outingId, convId, myUid }: Props) {
  const { t } = useTranslation();
  const { claim, unclaim } = useOutingStore();
  const [loading, setLoading] = useState(false);

  const label = item.kind === 'category' ? t(`gear.category.${item.category}`) : item.label;
  const Icon = item.kind === 'category' ? (CATEGORY_ICONS[item.category] ?? Package) : Package;
  const iconColor = item.kind === 'category' ? CATEGORY_ICON_COLOR[item.category] : 'text-text-secondary';

  const totalBrought = item.claims.reduce((acc, c) => acc + c.quantity, 0);
  const myClaim = item.claims.find((c) => c.uid === myUid) ?? null;

  // Claimers summary: "Alice (4), Bob (2)"
  const claimerNames = item.claims
    .map((c) => `${c.displayName.split(' ')[0]} (${c.quantity})`)
    .join(', ');

  async function handleAdd() {
    setLoading(true);
    try {
      await claim(outingId, convId, item.id, 1);
    } catch {
      toast.error('Impossible de réserver cet item');
    }
    setLoading(false);
  }

  async function handleIncrement() {
    if (!myClaim) { await handleAdd(); return; }
    setLoading(true);
    try {
      await unclaim(outingId, convId, item.id, myClaim.claimId);
      await claim(outingId, convId, item.id, myClaim.quantity + 1);
    } catch {
      toast.error('Impossible de modifier la quantité');
    }
    setLoading(false);
  }

  async function handleDecrement() {
    if (!myClaim) return;
    setLoading(true);
    try {
      await unclaim(outingId, convId, item.id, myClaim.claimId);
      if (myClaim.quantity > 1) {
        await claim(outingId, convId, item.id, myClaim.quantity - 1);
      }
    } catch {
      toast.error('Impossible de modifier la quantité');
    }
    setLoading(false);
  }

  const isOver = totalBrought >= item.quantityNeeded;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border-subtle/50 last:border-0">
      {/* Icon */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2">
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>

      {/* Label + progress */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">{label}</p>
        <p className={cn('text-[11px]', isOver ? 'text-sage font-medium' : 'text-text-secondary')}>
          {isOver
            ? t('outing.item.over', { brought: totalBrought, needed: item.quantityNeeded })
            : t('outing.item.progress', { brought: totalBrought, needed: item.quantityNeeded })}
          {claimerNames && (
            <span className="ml-1 opacity-70">· {claimerNames}</span>
          )}
        </p>
      </div>

      {/* Claim stepper */}
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-sage shrink-0" />
      ) : myClaim ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleDecrement}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-border-subtle text-text-secondary transition-colors hover:bg-surface-2"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="w-5 text-center text-xs font-bold text-text-primary">{myClaim.quantity}</span>
          <button
            type="button"
            onClick={handleIncrement}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-border-subtle text-text-secondary transition-colors hover:bg-surface-2"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleAdd}
          className="shrink-0 rounded-lg border border-border-subtle bg-surface px-2 py-0.5 text-[11px] font-semibold text-text-secondary transition-colors hover:border-sage hover:text-sage"
        >
          {t('outing.item.you_bring')}
        </button>
      )}
    </div>
  );
}
