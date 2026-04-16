import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';
import { useGearStore } from '@/stores/gear.store';
import { cn } from '@/lib/utils';
import type { UserMateriel } from '@/types';

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
