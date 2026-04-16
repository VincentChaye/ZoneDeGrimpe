import { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Search, Package, Pencil, X, Loader2, ChevronLeft } from 'lucide-react';
import { useGearStore } from '@/stores/gear.store';
import { cn } from '@/lib/utils';
import type { GearCategory, MaterielSpec } from '@/types';

const CATEGORIES: GearCategory[] = [
  'rope', 'harness', 'quickdraw', 'helmet', 'shoes',
  'nuts', 'cams', 'belay', 'sling', 'bag', 'other',
];

interface AddGearWizardProps {
  onClose: () => void;
  onSuccess?: () => void;
}

type Source = 'catalog' | 'custom' | null;

export function AddGearWizard({ onClose, onSuccess }: AddGearWizardProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const { fetchCatalog, catalog, addGear } = useGearStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [source, setSource] = useState<Source>(null);

  // Step 2 — catalog branch
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogCategory, setCatalogCategory] = useState<GearCategory | ''>('');
  const [selectedSpec, setSelectedSpec] = useState<MaterielSpec | null>(null);

  // Step 2 — custom branch
  const [form, setForm] = useState({
    category: '' as GearCategory | '',
    customName: '',
    brand: '',
    model: '',
    purchaseDate: '',
    firstUseDate: '',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { dialogRef.current?.showModal(); }, []);

  // Fetch catalog on search change
  useEffect(() => {
    if (source !== 'catalog') return;
    fetchCatalog(catalogCategory || undefined, catalogQuery || undefined);
  }, [source, catalogQuery, catalogCategory, fetchCatalog]);

  function chooseSource(s: Source) {
    setSource(s);
    setStep(2);
    if (s === 'catalog') fetchCatalog();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (source === 'catalog') {
        if (!selectedSpec) { toast.error(t('gear.search_catalog')); return; }
        await addGear({
          specId: selectedSpec._id,
          purchaseDate: form.purchaseDate || undefined,
          firstUseDate: form.firstUseDate || undefined,
          notes: form.notes || undefined,
        });
      } else {
        if (!form.category) { toast.error(t('gear.select_category')); return; }
        const name = form.customName.trim() || form.brand.trim() + ' ' + form.model.trim();
        if (!name.trim()) { toast.error(t('gear.name_label')); return; }
        await addGear({
          category: form.category,
          customName: form.customName.trim() || undefined,
          brand: form.brand.trim() || undefined,
          model: form.model.trim() || undefined,
          purchaseDate: form.purchaseDate || undefined,
          firstUseDate: form.firstUseDate || undefined,
          notes: form.notes || undefined,
        });
      }
      toast.success(t('gear.add'));
      onSuccess?.();
      onClose();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = 'w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage';
  const selectCls = `${inputCls} cursor-pointer`;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-[2000] m-0 h-full w-full max-h-full max-w-full bg-transparent p-0 backdrop:bg-black/40"
    >
      <div className="flex h-full items-end justify-center md:items-center" onClick={onClose}>
        <div
          className="w-full max-w-lg rounded-t-2xl bg-surface shadow-elevated md:rounded-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: 'min(90dvh, 600px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border-subtle px-5 py-4">
            {step === 2 && (
              <button type="button" onClick={() => { setStep(1); setSource(null); setSelectedSpec(null); }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2">
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <h2 className="flex-1 font-heading text-base font-bold text-text-primary">
              {step === 1 ? t('gear.add_step1_title') : t('gear.add_step2_title')}
            </h2>
            <button type="button" onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Step 1 — Choose source */}
          {step === 1 && (
            <div className="flex flex-col gap-3 p-5">
              <button
                type="button"
                onClick={() => chooseSource('catalog')}
                className="flex items-start gap-4 rounded-xl border-2 border-border-subtle bg-surface-2 p-4 text-left transition-colors hover:border-sage hover:bg-sage/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage/10 text-sage">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{t('gear.from_catalog')}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">{t('gear.from_catalog_desc')}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => chooseSource('custom')}
                className="flex items-start gap-4 rounded-xl border-2 border-border-subtle bg-surface-2 p-4 text-left transition-colors hover:border-sage hover:bg-sage/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage/10 text-sage">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{t('gear.custom')}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">{t('gear.custom_desc')}</p>
                </div>
              </button>
            </div>
          )}

          {/* Step 2 — Details */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

                {/* Catalog branch */}
                {source === 'catalog' && (
                  <>
                    <div className="flex gap-2">
                      <select
                        value={catalogCategory}
                        onChange={(e) => setCatalogCategory(e.target.value as GearCategory | '')}
                        className={cn(selectCls, 'w-auto flex-shrink-0')}
                      >
                        <option value="">{t('gear.all_categories')}</option>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{t(`gear.category.${c}`)}</option>
                        ))}
                      </select>
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary/50" />
                        <input
                          type="text"
                          value={catalogQuery}
                          onChange={(e) => setCatalogQuery(e.target.value)}
                          placeholder={t('gear.search_catalog')}
                          className={cn(inputCls, 'pl-8')}
                        />
                      </div>
                    </div>
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-border-subtle">
                      {catalog.length === 0 ? (
                        <p className="p-4 text-center text-xs text-text-secondary">{t('gear.no_catalog_results')}</p>
                      ) : (
                        catalog.map((spec) => (
                          <button
                            key={spec._id}
                            type="button"
                            onClick={() => setSelectedSpec(spec)}
                            className={cn(
                              'flex w-full items-center gap-3 border-b border-border-subtle px-4 py-3 text-left text-sm transition-colors last:border-0',
                              selectedSpec?._id === spec._id
                                ? 'bg-sage/10 font-semibold text-sage'
                                : 'text-text-primary hover:bg-surface-2',
                            )}
                          >
                            <Package className="h-4 w-4 shrink-0 text-text-secondary" />
                            <span className="flex-1 truncate">{spec.brand} {spec.model}</span>
                            <span className="text-[10px] text-text-secondary">{t(`gear.category.${spec.category}`)}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}

                {/* Custom branch */}
                {source === 'custom' && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('gear.category_label')} *</label>
                      <select
                        required
                        value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as GearCategory }))}
                        className={selectCls}
                      >
                        <option value="">{t('gear.select_category')}</option>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{t(`gear.category.${c}`)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('gear.name_label')}</label>
                      <input type="text" value={form.customName}
                        onChange={(e) => setForm((f) => ({ ...f, customName: e.target.value }))}
                        placeholder="Ex: Petzl Corax 2" className={inputCls} />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('gear.brand_label')}</label>
                        <input type="text" value={form.brand}
                          onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                          placeholder="Petzl" className={inputCls} />
                      </div>
                      <div className="flex-1">
                        <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('gear.model_label')}</label>
                        <input type="text" value={form.model}
                          onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                          placeholder="Corax 2" className={inputCls} />
                      </div>
                    </div>
                  </>
                )}

                {/* Common fields (both branches) */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('gear.purchase_date')}</label>
                    <input type="date" value={form.purchaseDate}
                      onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('gear.first_use')}</label>
                    <input type="date" value={form.firstUseDate}
                      onChange={(e) => setForm((f) => ({ ...f, firstUseDate: e.target.value }))}
                      className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('gear.notes')}</label>
                  <textarea rows={2} value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder={t('gear.notes_placeholder')}
                    className={cn(inputCls, 'resize-none')} />
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 border-t border-border-subtle px-5 py-4">
                <button type="button" onClick={onClose}
                  className="flex-1 rounded-xl border border-border-subtle bg-surface px-4 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-2">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sage px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('gear.add')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </dialog>
  );
}
