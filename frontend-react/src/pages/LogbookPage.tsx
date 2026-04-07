import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, MapPin, TrendingUp, Loader2, Zap, Trash2, Plus, X, Pencil, BarChart2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { cn, parseGradeToNumber } from '@/lib/utils';

interface LogbookEntry {
  _id: string;
  spotId: string;
  spotName?: string;
  routeName?: string;
  grade?: string;
  style: string;
  date?: string;
  notes?: string;
  createdAt: string;
}

interface LogbookStats {
  total: number;
  uniqueSpots: number;
  gradePyramid: { grade: string; count: number }[];
  monthly: { year: number; month: number; count: number }[];
  styles: Record<string, number>;
}

const STYLE_CLS: Record<string, string> = {
  onsight: 'bg-grade-easy/10 text-grade-easy border-grade-easy/20',
  flash: 'bg-grade-medium/10 text-grade-medium border-grade-medium/20',
  redpoint: 'bg-grade-hard/10 text-grade-hard border-grade-hard/20',
  repeat: 'bg-surface-2 text-text-secondary border-border-subtle',
};

const STYLES = ['onsight', 'flash', 'redpoint', 'repeat'] as const;
type Period = 'all' | 'month' | '3months' | 'year';

interface AddForm {
  spotName: string;
  routeName: string;
  grade: string;
  style: string;
  date: string;
  comment: string;
}

interface EditForm {
  style: string;
  date: string;
  notes: string;
}

const EMPTY_FORM: AddForm = {
  spotName: '',
  routeName: '',
  grade: '',
  style: 'redpoint',
  date: new Date().toISOString().slice(0, 10),
  comment: '',
};

function sortGrades(items: { grade: string; count: number }[]) {
  return [...items].sort((a, b) => parseGradeToNumber(a.grade) - parseGradeToNumber(b.grade));
}

function filterByPeriod(entries: LogbookEntry[], period: Period): LogbookEntry[] {
  if (period === 'all') return entries;
  const now = new Date();
  const cutoff = new Date(now);
  if (period === 'month') cutoff.setMonth(now.getMonth() - 1);
  else if (period === '3months') cutoff.setMonth(now.getMonth() - 3);
  else if (period === 'year') cutoff.setFullYear(now.getFullYear() - 1);
  return entries.filter((e) => new Date(e.date || e.createdAt) >= cutoff);
}

export function LogbookPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();

  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [stats, setStats] = useState<LogbookStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Edit form
  const [editEntry, setEditEntry] = useState<LogbookEntry | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ style: 'redpoint', date: '', notes: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Filters
  const [filterStyle, setFilterStyle] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<Period>('all');

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }

    Promise.all([
      apiFetch<{ items: LogbookEntry[]; total: number }>('/api/logbook?limit=200', { auth: true }),
      apiFetch<LogbookStats>('/api/logbook/stats', { auth: true }),
    ])
      .then(([rawEntries, rawStats]) => {
        const list = Array.isArray(rawEntries) ? rawEntries : (rawEntries as { items: LogbookEntry[] })?.items ?? [];
        setEntries(list.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()));
        setStats(rawStats);
      })
      .catch((err) => console.error('[logbook]', err))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  async function deleteEntry(id: string) {
    if (!confirm(t('logbook.confirm_delete'))) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/logbook/${id}`, { method: 'DELETE', auth: true });
      setEntries((prev) => prev.filter((e) => e._id !== id));
      setStats((s) => s ? { ...s, total: Math.max(0, s.total - 1) } : s);
    } catch (err) {
      console.error('[logbook] delete:', err);
    }
    setDeleting(null);
  }

  function openEdit(entry: LogbookEntry) {
    setEditEntry(entry);
    setEditForm({
      style: entry.style,
      date: entry.date ? entry.date.slice(0, 10) : entry.createdAt.slice(0, 10),
      notes: entry.notes || '',
    });
  }

  async function saveEdit() {
    if (!editEntry) return;
    setEditSaving(true);
    try {
      await apiFetch(`/api/logbook/${editEntry._id}`, {
        method: 'PATCH',
        auth: true,
        body: JSON.stringify({
          style: editForm.style,
          date: editForm.date,
          notes: editForm.notes || null,
        }),
      });
      setEntries((prev) => prev.map((e) =>
        e._id === editEntry._id
          ? { ...e, style: editForm.style, date: editForm.date, notes: editForm.notes || undefined }
          : e
      ));
      setEditEntry(null);
    } catch (err) {
      console.error('[logbook] edit:', err);
    }
    setEditSaving(false);
  }

  async function addEntry() {
    if (!form.spotName.trim()) { setFormError(t('logbook.form_spot_required')); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload: Record<string, string> = {
        spotName: form.spotName.trim(),
        style: form.style,
        date: form.date,
      };
      if (form.routeName.trim()) payload.routeName = form.routeName.trim();
      if (form.grade.trim()) payload.grade = form.grade.trim();
      if (form.comment.trim()) payload.notes = form.comment.trim();
      const newEntry = await apiFetch<LogbookEntry>('/api/logbook', {
        method: 'POST', auth: true,
        body: JSON.stringify(payload),
      });
      setEntries((prev) => [newEntry, ...prev]);
      setStats((s) => s ? { ...s, total: s.total + 1 } : s);
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      console.error('[logbook] add:', err);
      setFormError(t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <BookOpen className="h-12 w-12 text-text-secondary/30" />
        <p className="text-sm text-text-secondary">{t('logbook.login_prompt')}</p>
        <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-sage px-5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-sage-hover">
          {t('auth.login')}
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-sage" />
      </div>
    );
  }

  const gradePyramid = stats?.gradePyramid ? sortGrades(stats.gradePyramid) : [];
  const maxGradeCount = gradePyramid.length > 0 ? Math.max(...gradePyramid.map((g) => g.count)) : 0;

  const monthly = stats?.monthly ?? [];
  const maxMonthCount = monthly.length > 0 ? Math.max(...monthly.map((m) => m.count)) : 0;

  const PERIODS: Period[] = ['all', 'month', '3months', 'year'];
  const filteredEntries = filterByPeriod(entries, filterPeriod).filter((e) => !filterStyle || e.style === filterStyle);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24 md:pb-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">
            {t('logbook.title')}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {t('logbook.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(true); setFormError(''); }}
          className="flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-sage px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:bg-sage-hover hover:shadow-card"
        >
          <Plus className="h-4 w-4" />
          {t('logbook.add_entry')}
        </button>
      </div>

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border-subtle bg-surface p-4 shadow-soft">
            <div className="flex items-center gap-2 text-sage">
              <TrendingUp className="h-5 w-5" />
              <span className="font-heading text-2xl font-bold">{stats.total}</span>
            </div>
            <p className="mt-1 text-xs font-medium text-text-secondary">{t('logbook.ascents')}</p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-surface p-4 shadow-soft">
            <div className="flex items-center gap-2 text-amber-brand">
              <MapPin className="h-5 w-5" />
              <span className="font-heading text-2xl font-bold">{stats.uniqueSpots}</span>
            </div>
            <p className="mt-1 text-xs font-medium text-text-secondary">{t('logbook.unique_spots')}</p>
          </div>
        </div>
      )}

      {gradePyramid.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold text-text-primary">
            <Zap className="h-4 w-4 text-sage" />
            {t('logbook.grade_pyramid')}
          </h2>
          <div className="space-y-1.5 rounded-xl border border-border-subtle bg-surface p-4 shadow-soft">
            {gradePyramid.map(({ grade, count }) => (
              <div key={grade} className="flex items-center gap-3">
                <span className="w-10 text-right text-xs font-bold text-text-primary">{grade}</span>
                <div className="flex-1">
                  <div
                    className="h-5 rounded bg-sage/20 transition-all duration-500"
                    style={{ width: `${Math.max(4, (count / maxGradeCount) * 100)}%` }}
                  >
                    <div className="h-full rounded bg-sage" style={{ width: '100%' }} />
                  </div>
                </div>
                <span className="w-8 text-xs font-medium text-text-secondary">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {monthly.length > 1 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold text-text-primary">
            <BarChart2 className="h-4 w-4 text-sage" />
            {t('logbook.monthly_chart')}
          </h2>
          <div className="rounded-xl border border-border-subtle bg-surface p-4 shadow-soft">
            <div className="flex items-end gap-1" style={{ height: 80 }}>
              {monthly.map((m) => {
                const pct = maxMonthCount > 0 ? (m.count / maxMonthCount) * 100 : 0;
                const label = new Date(m.year, m.month - 1).toLocaleDateString(undefined, { month: 'short' });
                return (
                  <div key={`${m.year}-${m.month}`} className="group relative flex flex-1 flex-col items-center gap-1">
                    <div className="absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-text-primary px-1.5 py-0.5 text-[10px] text-surface group-hover:block">
                      {m.count}
                    </div>
                    <div
                      className="w-full rounded-t bg-sage/60 transition-all duration-300 group-hover:bg-sage"
                      style={{ height: `${Math.max(4, pct)}%` }}
                    />
                    <span className="text-[9px] text-text-secondary/60">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-lg font-bold text-text-primary">
            {t('logbook.timeline')}
          </h2>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {/* Period filters */}
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setFilterPeriod(p)}
                className={cn(
                  'cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
                  filterPeriod === p
                    ? 'bg-amber-brand text-white'
                    : 'border border-border-subtle bg-surface text-text-secondary hover:bg-surface-2',
                )}
              >
                {t(`logbook.period.${p}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Style filters */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(['', ...STYLES] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStyle(s)}
              className={cn(
                'cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
                filterStyle === s
                  ? 'bg-sage text-white'
                  : 'border border-border-subtle bg-surface text-text-secondary hover:bg-surface-2',
              )}
            >
              {s ? t(`logbook.style.${s}`) : t('myspots.filter_all')}
            </button>
          ))}
        </div>

        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle py-12 text-center">
            <BookOpen className="mb-3 h-10 w-10 text-text-secondary/20" />
            <p className="text-sm font-medium text-text-secondary">{t('logbook.no_entries')}</p>
            <p className="mt-1 text-xs text-text-secondary/60">{t('logbook.start_logging')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEntries.map((entry) => {
              const date = new Date(entry.date || entry.createdAt);
              return (
                <div
                  key={entry._id}
                  className="rounded-xl border border-border-subtle bg-surface p-4 shadow-soft transition-shadow hover:shadow-card"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sage-muted text-sage">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/map?spot=${entry.spotId}`}
                        className="truncate text-sm font-semibold text-text-primary no-underline hover:text-sage"
                      >
                        {entry.spotName || t('logbook.unknown_spot')}
                      </Link>
                      {entry.routeName && (
                        <p className="text-xs text-text-secondary">{entry.routeName}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {entry.grade && (
                          <span className="rounded-lg border border-border-subtle bg-surface-2/60 px-2 py-0.5 text-xs font-bold text-text-primary">
                            {entry.grade}
                          </span>
                        )}
                        <span className={cn(
                          'rounded-lg border px-2 py-0.5 text-xs font-semibold',
                          STYLE_CLS[entry.style] || STYLE_CLS.repeat,
                        )}>
                          {t(`logbook.style.${entry.style}`)}
                        </span>
                        <span className="text-[11px] text-text-secondary/60">
                          {date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {entry.notes && (
                        <p className="mt-1.5 text-xs leading-relaxed text-text-secondary/80">{entry.notes}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => openEdit(entry)}
                        type="button"
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary/30 transition-colors hover:bg-surface-2 hover:text-text-secondary"
                        title={t('logbook.edit_entry')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteEntry(entry._id)}
                        disabled={deleting === entry._id}
                        type="button"
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary/30 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-900/20"
                        title={t('logbook.delete_entry')}
                      >
                        {deleting === entry._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Add entry modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center"
          onClick={() => setShowForm(false)}
        >
          <div
            className="mx-0 w-full max-w-md rounded-t-2xl bg-surface p-6 shadow-elevated sm:mx-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-text-primary">{t('logbook.add_entry')}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="cursor-pointer rounded-lg p-1.5 text-text-secondary hover:bg-surface-2">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-secondary">{t('logbook.form_spot')} *</label>
                <input
                  type="text"
                  value={form.spotName}
                  onChange={(e) => setForm((f) => ({ ...f, spotName: e.target.value }))}
                  placeholder={t('logbook.form_spot_placeholder')}
                  className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-sage"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-text-secondary">{t('logbook.form_route')}</label>
                  <input
                    type="text"
                    value={form.routeName}
                    onChange={(e) => setForm((f) => ({ ...f, routeName: e.target.value }))}
                    placeholder={t('logbook.form_route_placeholder')}
                    className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-sage"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-text-secondary">{t('logbook.form_grade')}</label>
                  <input
                    type="text"
                    value={form.grade}
                    onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                    placeholder="6a, 7b+..."
                    className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-sage"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-text-secondary">{t('logbook.form_style')}</label>
                  <select
                    value={form.style}
                    onChange={(e) => setForm((f) => ({ ...f, style: e.target.value }))}
                    className="w-full cursor-pointer rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-sage"
                  >
                    {STYLES.map((s) => (
                      <option key={s} value={s}>{t(`logbook.style.${s}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-text-secondary">{t('logbook.form_date')}</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-sage"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-secondary">{t('logbook.form_comment')}</label>
                <textarea
                  value={form.comment}
                  onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                  rows={2}
                  placeholder={t('logbook.form_comment_placeholder')}
                  className="w-full resize-none rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-sage"
                />
              </div>
              {formError && <p className="text-xs font-medium text-red-500">{formError}</p>}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="cursor-pointer rounded-xl border border-border-subtle px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-2"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={addEntry}
                disabled={saving}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-sage px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {t('logbook.save_entry')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit entry modal */}
      {editEntry && (
        <div
          className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center"
          onClick={() => setEditEntry(null)}
        >
          <div
            className="mx-0 w-full max-w-md rounded-t-2xl bg-surface p-6 shadow-elevated sm:mx-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-text-primary">{t('logbook.edit_entry')}</h3>
              <button type="button" onClick={() => setEditEntry(null)} className="cursor-pointer rounded-lg p-1.5 text-text-secondary hover:bg-surface-2">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-sm text-text-secondary">
              {editEntry.spotName}{editEntry.routeName ? ` — ${editEntry.routeName}` : ''}
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-text-secondary">{t('logbook.form_style')}</label>
                  <select
                    value={editForm.style}
                    onChange={(e) => setEditForm((f) => ({ ...f, style: e.target.value }))}
                    className="w-full cursor-pointer rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-sage"
                  >
                    {STYLES.map((s) => (
                      <option key={s} value={s}>{t(`logbook.style.${s}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-text-secondary">{t('logbook.form_date')}</label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-sage"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-secondary">{t('logbook.form_comment')}</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder={t('logbook.form_comment_placeholder')}
                  className="w-full resize-none rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-sage"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditEntry(null)}
                className="cursor-pointer rounded-xl border border-border-subtle px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-2"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={editSaving}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-sage px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50"
              >
                {editSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
                {t('logbook.save_entry')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
