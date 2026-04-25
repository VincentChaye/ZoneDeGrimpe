import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, MapPin, TrendingUp, Loader2, Flame, Trash2, Pencil, X, Activity, Check,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { cn, parseGradeToNumber, gradeColor } from '@/lib/utils';

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

interface EditForm {
  style: string;
  date: string;
  notes: string;
}

const STYLE_CLS: Record<string, string> = {
  onsight: 'bg-grade-easy/10 text-grade-easy border-grade-easy/20',
  flash: 'bg-grade-medium/10 text-grade-medium border-grade-medium/20',
  redpoint: 'bg-grade-hard/10 text-grade-hard border-grade-hard/20',
  repeat: 'bg-surface-2 text-text-secondary border-border-subtle',
};

const STYLES = ['onsight', 'flash', 'redpoint', 'repeat'] as const;
type Period = 'all' | 'month' | '3months' | 'year';

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
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stats, setStats] = useState<LogbookStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Edit form
  const [editEntry, setEditEntry] = useState<LogbookEntry | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ style: 'redpoint', date: '', notes: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Filters
  const [filterStyle, setFilterStyle] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<Period>('all');
  const [mobileTab, setMobileTab] = useState<'recent' | 'pyramid'>('recent');

  const LIMIT = 50;

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    Promise.all([
      apiFetch<{ items: LogbookEntry[]; total: number }>(`/api/logbook?limit=${LIMIT}`, { auth: true }),
      apiFetch<LogbookStats>('/api/logbook/stats', { auth: true }),
    ])
      .then(([rawEntries, rawStats]) => {
        const list = Array.isArray(rawEntries) ? rawEntries : rawEntries?.items ?? [];
        const tot = Array.isArray(rawEntries) ? list.length : rawEntries?.total ?? list.length;
        setEntries(list.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()));
        setTotal(tot);
        setStats(rawStats);
      })
      .catch((err) => console.error('[logbook]', err))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await apiFetch<{ items: LogbookEntry[]; total: number }>(
        `/api/logbook?limit=${LIMIT}&skip=${entries.length}`, { auth: true },
      );
      const newItems = Array.isArray(data) ? data : data?.items ?? [];
      const tot = Array.isArray(data) ? entries.length + newItems.length : data?.total ?? 0;
      setEntries((prev) => [...prev, ...newItems].sort(
        (a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime(),
      ));
      setTotal(tot);
    } catch (err) {
      console.error('[logbook] loadMore:', err);
    }
    setLoadingMore(false);
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
        method: 'PATCH', auth: true,
        body: JSON.stringify({ style: editForm.style, date: editForm.date, notes: editForm.notes || null }),
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

  // Sorted hardest → easiest for pyramid display (top = hardest)
  const gradePyramid = stats?.gradePyramid ? sortGrades(stats.gradePyramid).reverse() : [];
  const pyramidMax = gradePyramid.length > 0 ? Math.max(...gradePyramid.map((g) => g.count)) : 0;

  // Derived stats
  const maxGrade = stats?.gradePyramid && stats.gradePyramid.length > 0
    ? sortGrades(stats.gradePyramid).at(-1)?.grade ?? '—'
    : '—';
  const currentYear = new Date().getFullYear();
  const daysThisYear = (stats?.monthly ?? [])
    .filter((m) => m.year === currentYear)
    .reduce((sum, m) => sum + m.count, 0);

  const PERIODS: Period[] = ['all', 'month', '3months', 'year'];
  const filteredEntries = filterByPeriod(entries, filterPeriod).filter((e) => !filterStyle || e.style === filterStyle);

  return (
    <div className="px-4 py-6 pb-24 md:pb-8">
      <div className="mx-auto max-w-5xl">

        {/* ── Header ── */}
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">{t('logbook.title')}</p>
            <h1 className="font-heading text-3xl font-bold leading-tight text-text-primary">{t('logbook.subtitle')}</h1>
          </div>
        </div>

        {/* ── Stats grid — 4 cards ── */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: <Check className="h-[18px] w-[18px]" />, value: stats.total, label: t('logbook.ascents'), color: 'text-sage' },
              { icon: <Flame className="h-[18px] w-[18px]" />, value: maxGrade, label: t('logbook.max_grade'), color: 'text-amber-brand' },
              { icon: <MapPin className="h-[18px] w-[18px]" />, value: stats.uniqueSpots, label: t('logbook.unique_spots'), color: 'text-stone-brand' },
              { icon: <Activity className="h-[18px] w-[18px]" />, value: daysThisYear, label: t('logbook.this_year'), color: 'text-sage' },
            ].map(({ icon, value, label, color }) => (
              <div key={label} className="rounded-[var(--radius-md)] border border-border-subtle bg-surface p-4 shadow-soft">
                <div className={cn('mb-1.5', color)}>{icon}</div>
                <div className="font-heading text-2xl font-bold leading-none text-text-primary">{value}</div>
                <div className="mt-1 text-xs text-text-secondary">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Mobile tabs ── */}
        <div className="mb-4 flex gap-2 lg:hidden">
          {(['recent', 'pyramid'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMobileTab(tab)}
              className={cn(
                'rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
                mobileTab === tab
                  ? 'bg-sage text-white'
                  : 'border border-border-subtle bg-surface text-text-secondary',
              )}
            >
              {tab === 'recent' ? t('logbook.timeline') : t('logbook.grade_pyramid')}
            </button>
          ))}
        </div>

        {/* ── Desktop 2-col / Mobile single-col ── */}
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">

          {/* ── LEFT: Entry list ── */}
          <section className={cn(mobileTab !== 'recent' && 'hidden lg:block')}>
            {/* Filters */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1.5">
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
              <div className="ml-auto flex flex-wrap gap-1.5">
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
            </div>

            {filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border-subtle py-12 text-center">
                <BookOpen className="mb-3 h-10 w-10 text-text-secondary/20" />
                <p className="text-sm font-medium text-text-secondary">{t('logbook.no_entries')}</p>
                <p className="mt-1 text-xs text-text-secondary/60">{t('logbook.start_logging')}</p>
              </div>
            ) : (
              <>
                {/* Desktop table-like list */}
                <div className="hidden overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-surface shadow-soft lg:block">
                  {filteredEntries.map((entry, i) => {
                    const date = new Date(entry.date || entry.createdAt);
                    const gc = entry.grade ? gradeColor(entry.grade) : '#6A645A';
                    return (
                      <div
                        key={entry._id}
                        className={cn(
                          'grid items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2',
                          'grid-cols-[44px_1fr_100px_80px_60px]',
                          i > 0 && 'border-t border-border-subtle',
                        )}
                      >
                        {/* Grade badge */}
                        <span
                          className="rounded-md px-2 py-1 text-center text-xs font-bold text-white"
                          style={{ fontFamily: 'ui-monospace, monospace', background: gc }}
                        >
                          {entry.grade || '—'}
                        </span>
                        {/* Name + spot */}
                        <div className="min-w-0">
                          <Link
                            to={`/map?spot=${entry.spotId}`}
                            className="block truncate text-sm font-semibold text-text-primary no-underline hover:text-sage"
                          >
                            {entry.routeName || entry.spotName || t('logbook.unknown_spot')}
                          </Link>
                          {entry.routeName && (
                            <p className="truncate text-xs text-text-secondary">{entry.spotName}</p>
                          )}
                        </div>
                        {/* Style pill */}
                        <span className={cn(
                          'rounded-full px-2.5 py-0.5 text-center text-[10px] font-bold uppercase tracking-wide',
                          STYLE_CLS[entry.style] || STYLE_CLS.repeat,
                        )}>
                          {t(`logbook.style.${entry.style}`)}
                        </span>
                        {/* Date */}
                        <span className="text-xs text-text-secondary">
                          {date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                        </span>
                        {/* Actions */}
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEdit(entry)}
                            type="button"
                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-text-secondary/30 transition-colors hover:bg-surface-2 hover:text-text-secondary"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => deleteEntry(entry._id)}
                            disabled={deleting === entry._id}
                            type="button"
                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-text-secondary/30 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-900/20"
                          >
                            {deleting === entry._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile card list */}
                <div className="space-y-2 lg:hidden">
                  {filteredEntries.map((entry) => {
                    const date = new Date(entry.date || entry.createdAt);
                    const gc = entry.grade ? gradeColor(entry.grade) : '#6A645A';
                    return (
                      <div key={entry._id} className="rounded-[var(--radius-md)] border border-border-subtle bg-surface p-3 shadow-soft">
                        <div className="flex items-center gap-3">
                          <span
                            className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-bold text-white"
                            style={{ fontFamily: 'ui-monospace, monospace', background: gc, minWidth: 38, textAlign: 'center' }}
                          >
                            {entry.grade || '—'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <Link
                              to={`/map?spot=${entry.spotId}`}
                              className="block truncate text-sm font-semibold text-text-primary no-underline hover:text-sage"
                            >
                              {entry.routeName || entry.spotName || t('logbook.unknown_spot')}
                            </Link>
                            <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                              <span>{entry.spotName}</span>
                              <span>·</span>
                              <span>{date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                            </div>
                          </div>
                          <span className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                            STYLE_CLS[entry.style] || STYLE_CLS.repeat,
                          )}>
                            {t(`logbook.style.${entry.style}`)}
                          </span>
                          <div className="flex shrink-0 gap-1">
                            <button onClick={() => openEdit(entry)} type="button" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary/30 hover:bg-surface-2 hover:text-text-secondary">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => deleteEntry(entry._id)} disabled={deleting === entry._id} type="button" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary/30 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-900/20">
                              {deleting === entry._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                        {entry.notes && (
                          <p className="mt-1.5 text-xs leading-relaxed text-text-secondary/80">{entry.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Load more */}
            {entries.length < total && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-border-subtle bg-surface px-5 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-50"
                >
                  {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t('logbook.load_more')} ({entries.length}/{total})
                </button>
              </div>
            )}
          </section>

          {/* ── RIGHT: Pyramid ── */}
          {gradePyramid.length > 0 && (
            <aside className={cn(mobileTab !== 'pyramid' && 'hidden lg:block')}>
              <h2 className="mb-3 font-heading text-base font-bold text-text-primary">{t('logbook.grade_pyramid')}</h2>
              <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface p-4 shadow-soft">
                <div className="space-y-1.5">
                  {gradePyramid.map(({ grade, count }) => {
                    const pct = pyramidMax > 0 ? (count / pyramidMax) * 100 : 0;
                    const color = gradeColor(grade);
                    return (
                      <div key={grade} className="flex items-center gap-2.5">
                        <span className="w-8 text-right text-xs font-bold text-text-primary" style={{ fontFamily: 'ui-monospace, monospace' }}>
                          {grade}
                        </span>
                        <div className="h-4 flex-1 overflow-hidden rounded bg-surface-2">
                          <div
                            className="h-full rounded transition-all duration-700 ease-out"
                            style={{ width: `${Math.max(4, pct)}%`, background: color, opacity: 0.9 }}
                          />
                        </div>
                        <span className="w-6 text-right text-xs text-text-secondary">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editEntry && (
        <div
          className="fixed inset-0 z-[2000] flex flex-col bg-surface sm:flex-none sm:items-center sm:justify-center sm:bg-black/30 sm:backdrop-blur-sm"
          onClick={() => setEditEntry(null)}
        >
          <div
            className="flex h-full flex-col sm:block sm:h-auto sm:w-full sm:max-w-md sm:rounded-2xl sm:bg-surface sm:p-6 sm:shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile header with back button */}
            <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 sm:hidden">
              <button type="button" onClick={() => setEditEntry(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-2">
                <X className="h-4 w-4" />
              </button>
              <h3 className="font-heading text-sm font-bold text-text-primary">{t('logbook.edit_entry')}</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-0">
              {/* Desktop title row */}
              <div className="mb-4 hidden items-center justify-between sm:flex">
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
        </div>
      )}
    </div>
  );
}
