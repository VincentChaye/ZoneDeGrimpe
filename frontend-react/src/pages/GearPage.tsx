import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Package, Plus, Settings, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useGearStore } from '@/stores/gear.store';
import { GearCard } from '@/components/gear/GearCard';
import { AddGearWizard } from '@/components/gear/AddGearWizard';
import { EditGearModal } from '@/components/gear/EditGearModal';
import { cn } from '@/lib/utils';
import type { GearCategory, UserMateriel } from '@/types';

const CATEGORIES: GearCategory[] = [
  'rope', 'harness', 'quickdraw', 'helmet', 'shoes',
  'nuts', 'cams', 'belay', 'sling', 'bag', 'other',
];

export function GearPage() {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuthStore();
  const { items, loading, fetchMyGear, deleteGear } = useGearStore();

  const [activeCategory, setActiveCategory] = useState<GearCategory | 'all'>('all');
  const [showWizard, setShowWizard] = useState(false);
  const [editItem, setEditItem] = useState<UserMateriel | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) fetchMyGear();
  }, [isAuthenticated, fetchMyGear]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <Package className="mb-4 h-12 w-12 text-text-secondary/40" />
        <p className="text-sm text-text-secondary">{t('auth.login_required')}</p>
        <Link
          to="/login"
          className="mt-4 rounded-xl bg-sage px-4 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-sage-hover"
        >
          {t('auth.login')}
        </Link>
      </div>
    );
  }

  const gearVisibility = user?.privacy?.gearVisibility ?? 'private';

  const filtered = activeCategory === 'all'
    ? items
    : items.filter((i) => i.category === activeCategory);

  async function handleDelete(item: UserMateriel) {
    if (!confirm(t('gear.delete_confirm'))) return;
    setDeletingId(item._id);
    try {
      await deleteGear(item._id);
    } catch { /* silent */ }
    setDeletingId(null);
  }

  // Category counts
  const counts: Partial<Record<GearCategory, number>> = {};
  for (const item of items) {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-bold text-text-primary">{t('gear.title')}</h1>
        <div className="flex items-center gap-2">
          {/* Visibility badge */}
          <Link
            to="/settings"
            className="flex items-center gap-1 rounded-full border border-border-subtle bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-text-secondary no-underline transition-colors hover:border-sage hover:text-sage"
          >
            <Settings className="h-3 w-3" />
            {t(`settings.visibility_${gearVisibility}`)}
          </Link>
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-1.5 rounded-xl bg-sage px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sage-hover"
          >
            <Plus className="h-4 w-4" />
            {t('gear.add')}
          </button>
        </div>
      </div>

      {/* Category filter tabs */}
      {items.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={cn(
              'shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
              activeCategory === 'all'
                ? 'bg-sage text-white shadow-soft'
                : 'border border-border-subtle bg-surface text-text-secondary hover:bg-surface-2',
            )}
          >
            {t('gear.all_categories')} ({items.length})
          </button>
          {CATEGORIES.filter((c) => counts[c]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              className={cn(
                'shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
                activeCategory === c
                  ? 'bg-sage text-white shadow-soft'
                  : 'border border-border-subtle bg-surface text-text-secondary hover:bg-surface-2',
              )}
            >
              {t(`gear.category.${c}`)} ({counts[c]})
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-sage" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle py-16 text-center">
          <Package className="mb-3 h-10 w-10 text-text-secondary/30" />
          <p className="text-sm font-medium text-text-secondary">
            {activeCategory === 'all' ? t('gear.empty') : t('gear.empty_category')}
          </p>
          {activeCategory === 'all' && (
            <button
              type="button"
              onClick={() => setShowWizard(true)}
              className="mt-4 flex items-center gap-1.5 rounded-xl bg-sage/10 px-4 py-2 text-sm font-semibold text-sage transition-colors hover:bg-sage/20"
            >
              <Plus className="h-4 w-4" />
              {t('gear.add')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div key={item._id} className={cn(deletingId === item._id && 'opacity-50 pointer-events-none')}>
              <GearCard
                item={item}
                onEdit={setEditItem}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showWizard && (
        <AddGearWizard
          onClose={() => setShowWizard(false)}
          onSuccess={() => fetchMyGear()}
        />
      )}
      {editItem && (
        <EditGearModal
          item={editItem}
          onClose={() => setEditItem(null)}
        />
      )}
    </div>
  );
}
