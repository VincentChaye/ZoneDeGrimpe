import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Trash2, Loader2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_ICONS, CATEGORY_ICON_COLOR } from '@/components/gear/gearCategoryUI';
import type { GearCategory, OutingItem } from '@/types';

const CATEGORIES: GearCategory[] = [
  'rope', 'quickdraw', 'belay_auto', 'belay_tube',
  'harness', 'shoes', 'carabiner', 'machard', 'crashpad', 'quicklink',
];

type DraftItem =
  | { id?: string; kind: 'category'; category: GearCategory; quantityNeeded: number }
  | { id?: string; kind: 'custom'; label: string; quantityNeeded: number };

interface Props {
  conversationId: string;
  initialTitle?: string;
  initialItems?: OutingItem[];
  onSave: (title: string, items: DraftItem[]) => Promise<void>;
  onClose: () => void;
}

export function OutingEditModal({ conversationId: _conv, initialTitle = '', initialItems, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initialTitle || '');
  const [items, setItems] = useState<DraftItem[]>(
    initialItems?.map((i) =>
      i.kind === 'category'
        ? { id: i.id, kind: 'category', category: i.category, quantityNeeded: i.quantityNeeded }
        : { id: i.id, kind: 'custom', label: i.label, quantityNeeded: i.quantityNeeded }
    ) ?? []
  );
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [saving, setSaving] = useState(false);

  function addCategory(cat: GearCategory) {
    if (items.some((i) => i.kind === 'category' && i.category === cat)) {
      setShowCategoryPicker(false);
      return;
    }
    setItems((prev) => [...prev, { kind: 'category', category: cat, quantityNeeded: 1 }]);
    setShowCategoryPicker(false);
  }

  function addCustom() {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    setItems((prev) => [...prev, { kind: 'custom', label: trimmed, quantityNeeded: 1 }]);
    setCustomInput('');
  }

  function updateQty(idx: number, delta: number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, quantityNeeded: Math.max(1, item.quantityNeeded + delta) } : item
      )
    );
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (items.length === 0) return;
    setSaving(true);
    try {
      await onSave(title || t('outing.banner_title'), items);
      onClose();
    } catch {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm pb-[68px] sm:pb-0"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-surface shadow-card overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <h2 className="font-heading text-sm font-bold text-text-primary">
            {initialItems ? t('outing.edit_title') : t('outing.create_cta')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div className="px-4 pt-4 pb-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('outing.banner_title')}
              className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-sage"
            />
          </div>

          {/* Items list */}
          {items.length > 0 && (
            <div className="px-4 py-2">
              {items.map((item, idx) => {
                const label = item.kind === 'category' ? t(`gear.category.${item.category}`) : item.label;
                const Icon = item.kind === 'category' ? (CATEGORY_ICONS[item.category] ?? Package) : Package;
                const iconColor = item.kind === 'category' ? CATEGORY_ICON_COLOR[item.category] : 'text-text-secondary';
                return (
                  <div key={idx} className="flex items-center gap-2 py-2 border-b border-border-subtle/50 last:border-0">
                    <Icon className={cn('h-4 w-4 shrink-0', iconColor)} />
                    <span className="flex-1 truncate text-sm text-text-primary">{label}</span>
                    {/* Quantity stepper */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => updateQty(idx, -1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-border-subtle text-text-secondary hover:bg-surface-2 text-xs">−</button>
                      <span className="w-5 text-center text-xs font-bold text-text-primary">{item.quantityNeeded}</span>
                      <button type="button" onClick={() => updateQty(idx, 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-border-subtle text-text-secondary hover:bg-surface-2 text-xs">+</button>
                    </div>
                    <button type="button" onClick={() => removeItem(idx)}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-text-secondary/50 hover:text-red-500 transition-colors shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Category picker */}
          {showCategoryPicker && (
            <div className="px-4 pb-3">
              <div className="grid grid-cols-5 gap-2">
                {CATEGORIES.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat] ?? Package;
                  const color = CATEGORY_ICON_COLOR[cat];
                  const already = items.some((i) => i.kind === 'category' && i.category === cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => addCategory(cat)}
                      disabled={already}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-xl border p-2 text-[10px] font-medium transition-all',
                        already
                          ? 'border-sage/50 bg-sage/5 text-sage opacity-60 cursor-not-allowed'
                          : 'border-border-subtle bg-surface-2 text-text-secondary hover:border-sage hover:text-sage'
                      )}
                    >
                      <Icon className={cn('h-4 w-4', color)} />
                      <span className="leading-tight text-center">{t(`gear.category.${cat}`).slice(0, 8)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom item input */}
          <div className="px-4 pb-4 space-y-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCategoryPicker((v) => !v)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition-colors',
                  showCategoryPicker
                    ? 'border-sage bg-sage/5 text-sage'
                    : 'border-border-subtle bg-surface-2 text-text-secondary hover:border-sage hover:text-sage'
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('outing.add_category_item')}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
                placeholder={t('outing.custom_item_placeholder')}
                className="flex-1 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-sage"
              />
              <button
                type="button"
                onClick={addCustom}
                disabled={!customInput.trim()}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:border-sage hover:text-sage disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t('outing.add_custom_item')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border-subtle px-4 py-3">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-xl border border-border-subtle py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-2">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || items.length === 0}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-sage py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
