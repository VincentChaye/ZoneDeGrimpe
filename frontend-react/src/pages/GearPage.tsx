import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Package, Plus, Settings, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useGearStore } from '@/stores/gear.store';
import { GearCard } from '@/components/gear/GearCard';
import { AddGearWizard } from '@/components/gear/AddGearWizard';
import { EditGearModal } from '@/components/gear/EditGearModal';
import { cn } from '@/lib/utils';
import type { GearCategory, UserMateriel } from '@/types';

const CATEGORIES: GearCategory[] = [
  'rope', 'quickdraw', 'belay_auto', 'belay_tube',
  'harness', 'shoes', 'carabiner', 'machard', 'crashpad', 'quicklink',
];

export function GearPage() {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuthStore();
  const { items, loading, fetchMyGear, deleteGear } = useGearStore();

  const [activeCategory, setActiveCategory] = useState<GearCategory | 'all'>('all');
  const [showWizard, setShowWizard] = useState(false);
  const [editItem, setEditItem] = useState<UserMateriel | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const VISIBILITY_LABELS: Record<string, string> = {
    public: 'settings.visibility_public',
    friends: 'settings.visibility_friends',
    private: 'settings.visibility_private',
  };
  const gearVisibility = user?.privacy?.gearVisibility ?? 'private';
  const visibilityKey = VISIBILITY_LABELS[gearVisibility] ?? 'settings.visibility_private';

  const filtered = activeCategory === 'all'
    ? items
    : items.filter((i) => i.category === activeCategory);

  async function handleDelete(item: UserMateriel) {
    if (!confirm(t('gear.delete_confirm'))) return;
    setDeletingId(item._id);
    setDeleteError(null);
    try {
      await deleteGear(item._id);
    } catch {
      setDeleteError(t('gear.delete_error'));
    }
    setDeletingId(null);
  }

  // Category counts
  const counts: Partial<Record<GearCategory, number>> = {};
  for (const item of items) {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }

  // EPI alerts
  const retireItems = items.filter((i) => i.epiStatus === 'retire');
  const watchItems  = items.filter((i) => i.epiStatus === 'watch');
  const alertCount  = retireItems.length + watchItems.length;

  return (
    <div className="px-4 py-6 md:pb-8">
      <div className="mx-auto max-w-5xl">

        {/* ── Header ── */}
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">{t('gear.title')}</p>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold leading-tight text-text-primary">{t('gear.my_equipment')}</h1>
            {items.length > 0 && (
              <p className="mt-1 text-sm text-text-secondary">
                {t('gear.epi_tracking')} · {items.length} {t('gear.items_count')}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/settings"
              className="flex items-center gap-1 rounded-full border border-border-subtle bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-text-secondary no-underline transition-colors hover:border-sage hover:text-sage"
            >
              <Settings className="h-3 w-3" />
              {t(visibilityKey)}
            </Link>
            <button
              type="button"
              onClick={() => setShowWizard(true)}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-sage px-4 py-2 text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:bg-sage-hover hover:shadow-card"
            >
              <Plus className="h-4 w-4" />
              {t('gear.add')}
            </button>
          </div>
        </div>

        {/* ── EPI alert banner ── */}
        {alertCount > 0 && (
          <div className={cn(
            'mb-4 flex items-start gap-3 rounded-[var(--radius-md)] border p-4',
            retireItems.length > 0
              ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20'
              : 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20',
          )}>
            <div className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)]',
              retireItems.length > 0
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
            )}>
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-primary">
                {retireItems.length > 0
                  ? t('gear.alert_retire', { count: retireItems.length })
                  : t('gear.alert_watch', { count: watchItems.length })}
              </p>
              <p className="mt-0.5 text-xs text-text-secondary">
                {retireItems.length > 0
                  ? retireItems.map((i) => i.customName || [i.brand, i.model].filter(Boolean).join(' ')).join(', ')
                  : watchItems.map((i) => i.customName || [i.brand, i.model].filter(Boolean).join(' ')).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* ── EPI all-ok banner ── */}
        {!loading && items.length > 0 && alertCount === 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{t('gear.all_ok')}</p>
          </div>
        )}

        {/* ── Category filter chips ── */}
        {items.length > 0 && (
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={cn(
                'shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
                activeCategory === 'all'
                  ? 'bg-sage text-white shadow-soft'
                  : 'border border-border-subtle bg-surface text-text-secondary hover:bg-surface-2',
              )}
            >
              {t('gear.all_categories')} <span className="ml-1 opacity-70">{items.length}</span>
            </button>
            {CATEGORIES.filter((c) => counts[c]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCategory(c)}
                className={cn(
                  'shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
                  activeCategory === c
                    ? 'bg-sage text-white shadow-soft'
                    : 'border border-border-subtle bg-surface text-text-secondary hover:bg-surface-2',
                )}
              >
                {t(`gear.category.${c}`)} <span className="ml-1 opacity-70">{counts[c]}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-sage" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border-subtle py-16 text-center">
            <Package className="mb-3 h-10 w-10 text-text-secondary/30" />
            <p className="text-sm font-medium text-text-secondary">
              {activeCategory === 'all' ? t('gear.empty') : t('gear.empty_category')}
            </p>
            {activeCategory === 'all' && (
              <button
                type="button"
                onClick={() => setShowWizard(true)}
                className="mt-4 flex items-center gap-1.5 rounded-[var(--radius-md)] bg-sage/10 px-4 py-2 text-sm font-semibold text-sage transition-colors hover:bg-sage/20"
              >
                <Plus className="h-4 w-4" />
                {t('gear.add')}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((item) => (
              <div key={item._id} className={cn(deletingId === item._id && 'pointer-events-none opacity-50')}>
                <GearCard
                  item={item}
                  onEdit={setEditItem}
                  onDelete={handleDelete}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete error toast */}
      {deleteError && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-elevated md:bottom-8">
          {deleteError}
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
