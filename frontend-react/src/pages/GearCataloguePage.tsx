import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Loader2, Search, Shield, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { GearCategory, MaterielSpec } from '@/types';

const CATEGORIES: GearCategory[] = [
  'rope', 'quickdraw', 'belay_auto', 'belay_tube',
  'harness', 'shoes', 'carabiner', 'machard', 'crashpad', 'quicklink',
];

const PLACEHOLDER = 'https://placehold.co/80x80/e5e7eb/9ca3af?text=📦';

export function GearCataloguePage() {
  const { t } = useTranslation();

  const [items, setItems] = useState<MaterielSpec[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeCategory, setActiveCategory] = useState<GearCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LIMIT = 30;

  const buildParams = useCallback(
    (skip = 0, q = debouncedQ, cat = activeCategory) => {
      const p = new URLSearchParams({ limit: String(LIMIT), skip: String(skip) });
      if (cat !== 'all') p.set('category', cat);
      if (q.trim()) p.set('q', q.trim());
      return p.toString();
    },
    [debouncedQ, activeCategory],
  );

  async function fetchItems(skip = 0, q = debouncedQ, cat = activeCategory, append = false) {
    if (skip === 0) setLoading(true); else setLoadingMore(true);
    try {
      const data = await apiFetch<{ items: MaterielSpec[]; total: number }>(
        `/api/materiel-specs?${buildParams(skip, q, cat)}`,
      );
      setTotal(data.total);
      setItems((prev) => append ? [...prev, ...data.items] : data.items);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(search), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // Refetch on category or debounced query change
  useEffect(() => {
    fetchItems(0, debouncedQ, activeCategory, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, activeCategory]);

  const hasMore = items.length < total;

  return (
    <div className="px-4 py-6 md:pb-8">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <Link
            to="/gear"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-2 text-text-secondary no-underline transition-colors hover:border-sage hover:text-sage"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
              {t('gear.title')}
            </p>
            <h1 className="font-heading text-2xl font-bold leading-tight text-text-primary sm:text-3xl">
              {t('gear.catalogue')}
            </h1>
            {!loading && (
              <p className="mt-0.5 text-xs text-text-secondary">
                {total} {total === 1 ? 'référence' : 'références'}
              </p>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une marque, un modèle..."
            className="w-full rounded-[var(--radius-md)] border border-border-subtle bg-surface-2 py-2.5 pl-9 pr-9 text-sm text-text-primary placeholder-text-secondary/50 outline-none transition focus:border-sage focus:ring-1 focus:ring-sage/30"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary/50 hover:text-text-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category chips */}
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
            {t('gear.all_categories')}
          </button>
          {CATEGORIES.map((c) => (
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
              {t(`gear.category.${c}`)}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-sage" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border-subtle py-20 text-center">
            <BookOpen className="mb-3 h-10 w-10 text-text-secondary/30" />
            <p className="text-sm font-medium text-text-secondary">
              {debouncedQ ? `Aucun résultat pour "${debouncedQ}"` : 'Catalogue vide'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((spec) => (
                <SpecCard key={spec._id} spec={spec} t={t} />
              ))}
            </div>

            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => fetchItems(items.length, debouncedQ, activeCategory, true)}
                  className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border-subtle bg-surface-2 px-5 py-2.5 text-sm font-semibold text-text-secondary transition-all hover:border-sage hover:text-sage disabled:opacity-50"
                >
                  {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Voir plus ({total - items.length} restants)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SpecCard({ spec, t }: { spec: MaterielSpec; t: (k: string) => string }) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="flex gap-3 rounded-[var(--radius-md)] border border-border-subtle bg-surface p-3 transition-all hover:border-sage/40 hover:shadow-soft">
      {/* Image */}
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-surface-2">
        <img
          src={imgErr || !spec.imageUrl ? PLACEHOLDER : spec.imageUrl}
          alt={`${spec.brand} ${spec.model}`}
          onError={() => setImgErr(true)}
          className="h-full w-full object-contain"
        />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-sage">
          {t(`gear.category.${spec.category}`)}
        </p>
        <p className="truncate text-sm font-semibold text-text-primary">{spec.brand}</p>
        <p className="truncate text-xs text-text-secondary">{spec.model}</p>
        {spec.description && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-text-secondary/70">
            {spec.description}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {spec.epiTracked && (
            <span className="flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              <Shield className="h-2.5 w-2.5" />
              {t('gear.epi_tracking')}
            </span>
          )}
          {spec.uiaaLifetimeYears != null && (
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
              {t('admin.gear.lifetime_label').replace(' (années)', '')} : {spec.uiaaLifetimeYears} ans
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
