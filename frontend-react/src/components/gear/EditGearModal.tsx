import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';
import { useGearStore } from '@/stores/gear.store';
import { cn } from '@/lib/utils';
import type { UserMateriel, GearCategory } from '@/types';

interface EditGearModalProps {
  item: UserMateriel;
  onClose: () => void;
}

export function EditGearModal({ item, onClose }: EditGearModalProps) {
  const { t } = useTranslation();
  const { updateGear } = useGearStore();

  const [form, setForm] = useState({
    customName: item.customName ?? '',
    brand: item.brand ?? '',
    model: item.model ?? '',
    purchaseDate: item.purchaseDate ? item.purchaseDate.slice(0, 10) : '',
    firstUseDate: item.firstUseDate ? item.firstUseDate.slice(0, 10) : '',
    notes: item.notes ?? '',
  });
  const [specs, setSpecs] = useState<Record<string, unknown>>(item.specs ?? {});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateGear(item._id, {
        customName: form.customName.trim() || undefined,
        brand: form.brand.trim() || undefined,
        model: form.model.trim() || undefined,
        purchaseDate: form.purchaseDate || undefined,
        firstUseDate: form.firstUseDate || undefined,
        notes: form.notes.trim() || undefined,
        specs: Object.values(specs).some((v) => v !== undefined && v !== '') ? specs : undefined,
      });
      toast.success(t('common.saved') ?? 'Enregistré');
      onClose();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage';
  const selectCls = `${inputCls} cursor-pointer`;
  const labelCls = 'mb-1.5 block text-xs font-semibold text-text-secondary';

  function renderCategorySpecs() {
    switch (item.category as GearCategory) {
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
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl bg-surface shadow-elevated sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border-subtle px-5 py-4">
          <h2 className="flex-1 font-heading text-base font-bold text-text-primary">
            {t('gear.edit_title')}
          </h2>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-5 py-4">
            {/* Name (for custom items) */}
            {!item.specId && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('gear.name_label')}</label>
                <input type="text" value={form.customName}
                  onChange={(e) => setForm((f) => ({ ...f, customName: e.target.value }))}
                  className={inputCls} />
              </div>
            )}

            {/* Brand / Model */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('gear.brand_label')}</label>
                <input type="text" value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  className={inputCls} />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('gear.model_label')}</label>
                <input type="text" value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  className={inputCls} />
              </div>
            </div>

            {/* Category-specific specs */}
            {renderCategorySpecs()}

            {/* EPI dates */}
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

            {/* Notes */}
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
            <button type="submit" disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sage px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('common.save') ?? 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
