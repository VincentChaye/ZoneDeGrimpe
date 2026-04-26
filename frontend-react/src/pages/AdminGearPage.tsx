import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Package, X, Check } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import type { MaterielSpec, GearCategory } from '@/types';

const CATEGORIES: GearCategory[] = [
  'rope', 'quickdraw', 'belay_auto', 'belay_tube',
  'harness', 'shoes', 'carabiner', 'machard', 'crashpad', 'quicklink',
];

const EMPTY_FORM = {
  category: '' as GearCategory | '',
  brand: '',
  model: '',
  description: '',
  imageUrl: '',
  uiaaLifetimeYears: '',
  epiTracked: true,
};

export function AdminGearPage() {
  const { t } = useTranslation();
  const { isAdmin } = useAuthStore();

  const [specs, setSpecs] = useState<MaterielSpec[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<GearCategory | ''>('');

  const [showForm, setShowForm] = useState(false);
  const [editingSpec, setEditingSpec] = useState<MaterielSpec | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = filterCategory ? `?category=${filterCategory}` : '';
      const data = await apiFetch<{ items: MaterielSpec[]; total: number }>(`/api/materiel-specs${params}`);
      setSpecs(data?.items ?? []);
      setTotal(data?.total ?? 0);
    } catch { /* silent */ }
    setLoading(false);
  }

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, filterCategory]);

  function openCreate() {
    setEditingSpec(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(spec: MaterielSpec) {
    setEditingSpec(spec);
    setForm({
      category: spec.category,
      brand: spec.brand,
      model: spec.model,
      description: spec.description ?? '',
      imageUrl: spec.imageUrl ?? '',
      uiaaLifetimeYears: spec.uiaaLifetimeYears != null ? String(spec.uiaaLifetimeYears) : '',
      epiTracked: spec.epiTracked,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category || !form.brand || !form.model) {
      toast.error(t('common.error'));
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        category: form.category,
        brand: form.brand.trim(),
        model: form.model.trim(),
        description: form.description.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        uiaaLifetimeYears: form.uiaaLifetimeYears ? parseInt(form.uiaaLifetimeYears) : null,
        epiTracked: form.epiTracked,
      };
      if (editingSpec) {
        await apiFetch(`/api/materiel-specs/${editingSpec._id}`, { method: 'PATCH', auth: true, body: JSON.stringify(body) });
        toast.success(t('admin.gear.edit'));
      } else {
        await apiFetch('/api/materiel-specs', { method: 'POST', auth: true, body: JSON.stringify(body) });
        toast.success(t('admin.gear.add'));
      }
      setShowForm(false);
      load();
    } catch {
      toast.error(t('common.error'));
    }
    setSaving(false);
  }

  async function handleDelete(spec: MaterielSpec) {
    if (!confirm(t('admin.gear.delete_confirm'))) return;
    try {
      await apiFetch(`/api/materiel-specs/${spec._id}`, { method: 'DELETE', auth: true });
      toast.success(t('admin.gear.delete'));
      load();
    } catch (err: unknown) {
      const body = (err as { body?: { count?: number } })?.body;
      if (body?.count != null) {
        toast.error(t('admin.gear.delete_in_use', { count: body.count }));
      } else {
        toast.error(t('common.error'));
      }
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <p className="text-sm text-text-secondary">{t('auth.login_required')}</p>
        <Link to="/" className="mt-4 text-sage text-sm no-underline hover:underline">{t('nav.home')}</Link>
      </div>
    );
  }

  const inputCls = 'w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm text-text-primary focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage';

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-bold text-text-primary">{t('admin.gear.title')}</h1>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-xl bg-sage px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sage-hover"
        >
          <Plus className="h-4 w-4" /> {t('admin.gear.add')}
        </button>
      </div>

      {/* Category filter */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => setFilterCategory('')}
          className={cn('shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
            filterCategory === '' ? 'bg-sage text-white' : 'border border-border-subtle bg-surface text-text-secondary hover:bg-surface-2')}>
          {t('gear.all_categories')} ({total})
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => setFilterCategory(c)}
            className={cn('shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
              filterCategory === c ? 'bg-sage text-white' : 'border border-border-subtle bg-surface text-text-secondary hover:bg-surface-2')}>
            {t(`gear.category.${c}`)}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-sage" /></div>
      ) : specs.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border-subtle py-16 text-center">
          <Package className="mb-3 h-10 w-10 text-text-secondary/30" />
          <p className="text-sm text-text-secondary">{t('gear.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {specs.map((spec) => (
            <div key={spec._id} className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface p-4 shadow-soft">
              {spec.imageUrl ? (
                <img src={spec.imageUrl} alt={spec.model} className="h-10 w-10 shrink-0 rounded-xl object-cover border border-border-subtle" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage/10 text-sage">
                  <Package className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-primary">{spec.brand} {spec.model}</p>
                <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-text-secondary">
                  <span className="rounded-full bg-surface-2 px-2 py-0.5">{t(`gear.category.${spec.category}`)}</span>
                  {spec.uiaaLifetimeYears && <span>{spec.uiaaLifetimeYears} ans</span>}
                  {!spec.epiTracked && <span className="text-text-secondary/50">non-EPI</span>}
                </div>
                {spec.description && <p className="mt-1 text-xs text-text-secondary line-clamp-1">{spec.description}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => openEdit(spec)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2 hover:text-sage">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => handleDelete(spec)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg rounded-t-2xl bg-surface shadow-elevated sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-border-subtle px-5 py-4">
              <h2 className="flex-1 font-heading text-base font-bold text-text-primary">
                {editingSpec ? t('admin.gear.edit') : t('admin.gear.add')}
              </h2>
              <button type="button" onClick={() => setShowForm(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('gear.category_label')} *</label>
                  <select required value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as GearCategory }))}
                    className={cn(inputCls, 'cursor-pointer')}>
                    <option value="">{t('gear.select_category')}</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{t(`gear.category.${c}`)}</option>)}
                  </select>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('gear.brand_label')} *</label>
                    <input required type="text" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('gear.model_label')} *</label>
                    <input required type="text" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('admin.gear.description')}</label>
                  <textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className={cn(inputCls, 'resize-none')} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('admin.gear.image_url')}</label>
                  <input type="url" value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} className={inputCls} />
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{t('admin.gear.lifetime_label')}</label>
                    <input type="number" min="1" max="100" value={form.uiaaLifetimeYears}
                      onChange={(e) => setForm((f) => ({ ...f, uiaaLifetimeYears: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input type="checkbox" id="epiTracked" checked={form.epiTracked}
                      onChange={(e) => setForm((f) => ({ ...f, epiTracked: e.target.checked }))}
                      className="h-4 w-4 cursor-pointer rounded accent-sage" />
                    <label htmlFor="epiTracked" className="cursor-pointer text-xs font-semibold text-text-secondary">
                      {t('admin.gear.epi_tracked')}
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 border-t border-border-subtle px-5 py-4">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 rounded-xl border border-border-subtle bg-surface px-4 py-2.5 text-sm font-semibold text-text-secondary hover:bg-surface-2">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sage px-4 py-2.5 text-sm font-semibold text-white hover:bg-sage-hover disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
