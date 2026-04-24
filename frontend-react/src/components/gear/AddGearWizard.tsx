import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Package, X, Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useGearStore } from '@/stores/gear.store';
import { cn } from '@/lib/utils';
import type { GearCategory, MaterielSpec } from '@/types';

const CATEGORIES: GearCategory[] = [
  'rope', 'quickdraw', 'belay_auto', 'belay_tube',
  'harness', 'shoes', 'carabiner', 'machard', 'crashpad', 'quicklink',
];

const STEP_KEYS = ['gear.add_step1_title', 'gear.add_step2_title', 'gear.step_details'];

interface AddGearWizardProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddGearWizard({ onClose, onSuccess }: AddGearWizardProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { fetchCatalog, catalog, addGear } = useGearStore();

  const [step, setStep] = useState(0); // 0=category, 1=identification, 2=details
  const [form, setForm] = useState({
    category: '' as GearCategory | '',
    customName: '',
    brand: '',
    model: '',
    quantity: 1,
    purchaseDate: '',
    firstUseDate: '',
    notes: '',
  });
  const [specId, setSpecId] = useState<string | null>(null);
  const [specs, setSpecs] = useState<Record<string, unknown>>({});
  const [showDropdown, setShowDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { dialogRef.current?.showModal(); }, []);

  // Fetch full category catalog once when entering step 1
  useEffect(() => {
    if (step !== 1 || !form.category) return;
    fetchCatalog(form.category as GearCategory);
  }, [step, form.category, fetchCatalog]);

  // Local filtering of catalog based on typed text
  const suggestions = useMemo<MaterielSpec[]>(() => {
    const q = form.customName.toLowerCase().trim();
    const filtered = q
      ? catalog.filter((s) => `${s.brand} ${s.model}`.toLowerCase().includes(q))
      : catalog;
    return filtered.slice(0, 7);
  }, [catalog, form.customName]);

  function selectCategory(cat: GearCategory) {
    setForm((f) => ({ ...f, category: cat }));
    setSpecId(null);
    setSpecs({});
    setStep(1);
  }

  // Parse diameter from rope model name (e.g. "Volta 9.2 mm" → 9.2)
  function parseRopeSpecs(model: string): Record<string, unknown> {
    const match = model.match(/(\d+\.?\d*)\s*mm/i);
    return match ? { diameter_mm: parseFloat(match[1]) } : {};
  }

  const selectSpec = useCallback((spec: MaterielSpec) => {
    const name = `${spec.brand} ${spec.model}`.trim();
    const autoSpecs = spec.category === 'rope' ? parseRopeSpecs(spec.model) : {};
    setSpecId(spec._id);
    setForm((f) => ({ ...f, customName: name, brand: spec.brand || '', model: spec.model || '' }));
    setSpecs(autoSpecs);
    setShowDropdown(false);
    // Focus next relevant field after selection
    setTimeout(() => nameRef.current?.blur(), 0);
  }, []);

  function goNext() {
    if (step === 1 && !form.customName.trim()) {
      toast.error(t('gear.name_required'));
      return;
    }
    setShowDropdown(false);
    setStep((s) => (s + 1) as 0 | 1 | 2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        category: form.category,
        customName: form.customName.trim() || undefined,
        brand: form.brand.trim() || undefined,
        model: form.model.trim() || undefined,
        quantity: form.quantity > 1 ? form.quantity : undefined,
        specs: Object.values(specs).some((v) => v !== undefined && v !== '') ? specs : undefined,
        purchaseDate: form.purchaseDate || undefined,
        firstUseDate: form.firstUseDate || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (specId) payload.specId = specId;
      await addGear(payload);
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
  const labelCls = 'mb-1.5 block text-xs font-semibold text-text-secondary';
  const progress = ((step + 1) / STEP_KEYS.length) * 100;

  function renderCategorySpecs() {
    switch (form.category) {
      case 'rope':
        return (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelCls}>{t('gear.specs.length_m')}</label>
              <input type="number" min={1} max={300} step={1}
                value={(specs.length_m as number | '') ?? ''}
                onChange={(e) => setSpecs((s) => ({ ...s, length_m: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="70" className={inputCls} />
            </div>
            <div className="flex-1">
              <label className={labelCls}>{t('gear.specs.diameter_mm')}</label>
              <input type="number" min={6} max={15} step={0.1}
                value={(specs.diameter_mm as number | '') ?? ''}
                onChange={(e) => setSpecs((s) => ({ ...s, diameter_mm: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="9.5" className={inputCls} />
            </div>
          </div>
        );
      case 'harness':
        return (
          <div>
            <label className={labelCls}>{t('gear.specs.size')}</label>
            <select value={(specs.size as string) ?? ''}
              onChange={(e) => setSpecs((s) => ({ ...s, size: e.target.value || undefined }))}
              className={selectCls}>
              <option value="">—</option>
              {['XS', 'S', 'M', 'L', 'XL'].map((sz) => <option key={sz} value={sz}>{sz}</option>)}
            </select>
          </div>
        );
      case 'shoes':
        return (
          <div>
            <label className={labelCls}>{t('gear.specs.shoe_size')}</label>
            <input type="number" min={30} max={50} step={0.5}
              value={(specs.shoeSize as number | '') ?? ''}
              onChange={(e) => setSpecs((s) => ({ ...s, shoeSize: e.target.value ? Number(e.target.value) : undefined }))}
              placeholder="42" className={cn(inputCls, 'w-24')} />
          </div>
        );
      case 'carabiner':
        return (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelCls}>{t('gear.specs.carabiner_type')}</label>
              <select value={(specs.carabinerType as string) ?? ''}
                onChange={(e) => setSpecs((s) => ({ ...s, carabinerType: e.target.value || undefined }))}
                className={selectCls}>
                <option value="">—</option>
                <option value="screwlock">{t('gear.specs.carabiner_type.screwlock')}</option>
                <option value="auto">{t('gear.specs.carabiner_type.auto')}</option>
                <option value="wire">{t('gear.specs.carabiner_type.wire')}</option>
              </select>
            </div>
            <div className="flex-1">
              <label className={labelCls}>{t('gear.specs.carabiner_shape')}</label>
              <select value={(specs.carabinerShape as string) ?? ''}
                onChange={(e) => setSpecs((s) => ({ ...s, carabinerShape: e.target.value || undefined }))}
                className={selectCls}>
                <option value="">—</option>
                <option value="D">D</option>
                <option value="HMS">HMS</option>
                <option value="oval">{t('gear.specs.carabiner_shape.oval')}</option>
              </select>
            </div>
          </div>
        );
      case 'machard':
        return (
          <div>
            <label className={labelCls}>{t('gear.specs.cord_length_cm')}</label>
            <input type="number" min={10} max={200} step={1}
              value={(specs.cordLength_cm as number | '') ?? ''}
              onChange={(e) => setSpecs((s) => ({ ...s, cordLength_cm: e.target.value ? Number(e.target.value) : undefined }))}
              placeholder="60" className={cn(inputCls, 'w-24')} />
          </div>
        );
      case 'crashpad':
        return (
          <div>
            <label className={labelCls}>{t('gear.specs.dimensions')}</label>
            <input type="text"
              value={(specs.dimensions as string) ?? ''}
              onChange={(e) => setSpecs((s) => ({ ...s, dimensions: e.target.value || undefined }))}
              placeholder="120×100×12" className={inputCls} />
          </div>
        );
      default:
        return null;
    }
  }

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
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 0 | 1 | 2)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-base font-bold text-text-primary">{t('gear.add')}</h2>
              <p className="text-xs text-text-secondary">
                {t(STEP_KEYS[step])} · {step + 1}/{STEP_KEYS.length}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-border-subtle">
            <div className="h-full bg-sage transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>

          {/* Step 0 — Category */}
          {step === 0 && (
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => selectCategory(cat)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-colors',
                      form.category === cat
                        ? 'border-sage bg-sage/5 text-sage'
                        : 'border-border-subtle text-text-primary hover:border-sage/50 hover:bg-surface-2',
                    )}
                  >
                    <Package className="h-5 w-5" />
                    <span className="text-xs font-medium leading-tight">{t(`gear.category.${cat}`)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1 — Identification */}
          {step === 1 && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">

                {/* Name + autocomplete dropdown */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text-secondary">
                    {t('gear.name_label')} *
                  </label>
                  <div className="relative">
                    <input
                      ref={nameRef}
                      type="text"
                      value={form.customName}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, customName: e.target.value, brand: '', model: '' }));
                        setSpecId(null);
                        setSpecs({});
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                      placeholder={t('gear.name_placeholder') ?? 'Ex: Petzl Corax 2'}
                      className={inputCls}
                      autoFocus
                    />

                    {/* Checkmark when a catalog entry is selected */}
                    {specId && (
                      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                        <Check className="h-4 w-4 text-sage" />
                      </div>
                    )}

                    {/* Autocomplete dropdown */}
                    {showDropdown && suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-elevated">
                        {suggestions.map((spec) => (
                          <button
                            key={spec._id}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); selectSpec(spec); }}
                            className={cn(
                              'flex w-full items-center gap-3 border-b border-border-subtle px-4 py-2.5 text-left text-sm transition-colors last:border-0',
                              specId === spec._id
                                ? 'bg-sage/10 font-semibold text-sage'
                                : 'text-text-primary hover:bg-surface-2',
                            )}
                          >
                            {spec.imageUrl ? (
                              <img src={spec.imageUrl} alt="" className="h-7 w-7 shrink-0 rounded-lg object-cover" />
                            ) : (
                              <Package className="h-4 w-4 shrink-0 text-text-secondary" />
                            )}
                            <span className="flex-1 truncate">
                              <span className="font-medium">{spec.brand}</span>
                              {' '}
                              <span className="text-text-secondary">{spec.model}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('gear.quantity')}</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: Math.max(1, Math.min(99, parseInt(e.target.value) || 1)) }))}
                    className={cn(inputCls, 'w-24')}
                  />
                </div>

                {/* Category-specific specs */}
                {renderCategorySpecs()}

              </div>

              <div className="border-t border-border-subtle px-5 py-4">
                <button
                  type="button"
                  onClick={goNext}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-sage px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sage-hover"
                >
                  {t('common.next')}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Dates & Notes */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {/* Mini recap */}
                <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5">
                  <Package className="h-4 w-4 shrink-0 text-sage" />
                  <span className="flex-1 truncate text-sm font-medium text-text-primary">
                    {form.customName || `${form.brand} ${form.model}`.trim() || t(`gear.category.${form.category}`)}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-text-secondary">
                    {t(`gear.category.${form.category}`)}
                  </span>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('gear.purchase_date')}</label>
                    <input
                      type="date"
                      value={form.purchaseDate}
                      onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('gear.first_use')}</label>
                    <input
                      type="date"
                      value={form.firstUseDate}
                      onChange={(e) => setForm((f) => ({ ...f, firstUseDate: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('gear.notes')}</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder={t('gear.notes_placeholder')}
                    className={cn(inputCls, 'resize-none')}
                  />
                </div>
              </div>

              <div className="flex gap-3 border-t border-border-subtle px-5 py-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-border-subtle bg-surface px-4 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-2"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sage px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50"
                >
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
