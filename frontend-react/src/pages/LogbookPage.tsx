import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, MapPin, TrendingUp, Loader2, Zap, Trash2, Pencil,
  BarChart2, Search, X, ChevronRight,
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

interface SpotResult {
  id: string;
  name: string;
  type?: string;
  niveau_min?: string;
  niveau_max?: string;
}

interface ClimbingRoute {
  _id: string;
  name: string;
  grade?: string;
  style?: string;
}

interface LogForm {
  routeId: string;
  style: string;
  date: string;
  notes: string;
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

const EMPTY_LOG: LogForm = {
  routeId: '',
  style: 'redpoint',
  date: new Date().toISOString().slice(0, 10),
  notes: '',
};

export function LogbookPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();

  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [stats, setStats] = useState<LogbookStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Log form
  const [selectedSpot, setSelectedSpot] = useState<SpotResult | null>(null);
  const [spotRoutes, setSpotRoutes] = useState<ClimbingRoute[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [logForm, setLogForm] = useState<LogForm>(EMPTY_LOG);
  const [logSaving, setLogSaving] = useState(false);
  const [logError, setLogError] = useState('');

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
      apiFetch<{ items: LogbookEntry[] } | LogbookEntry[]>('/api/logbook?limit=200', { auth: true }),
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

  // Click outside → close dropdown
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search
  function handleSearchChange(q: string) {
    setSearchQuery(q);
    // If user edits the query while a spot is selected, close the form
    if (selectedSpot && q !== selectedSpot.name) {
      setSelectedSpot(null);
      setSpotRoutes([]);
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await apiFetch<{ features: { properties: SpotResult }[] } | SpotResult[]>(
          `/api/spots?name=${encodeURIComponent(q.trim())}&format=flat&limit=8`
        );
        // format=flat returns array of flat objects
        const results = Array.isArray(data) ? data : [];
        setSearchResults(results);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }

  async function selectSpot(spot: SpotResult) {
    setSelectedSpot(spot);
    setSearchQuery(spot.name);
    setShowDropdown(false);
    setLogForm(EMPTY_LOG);
    setLogError('');
    setSpotRoutes([]);
    setRoutesLoading(true);
    const spotId = spot.id;
    try {
      const fetched = await apiFetch<ClimbingRoute[]>(`/api/climbing-routes/spot/${spotId}`);
      setSpotRoutes(Array.isArray(fetched) ? fetched : []);
    } catch {
      setSpotRoutes([]);
    } finally {
      setRoutesLoading(false);
    }
  }

  function closeLogForm() {
    setSelectedSpot(null);
    setSpotRoutes([]);
    setSearchQuery('');
    setLogForm(EMPTY_LOG);
    setLogError('');
  }

  async function submitLog() {
    if (!selectedSpot) return;
    setLogSaving(true);
    setLogError('');
    try {
      const payload: Record<string, string | null> = {
        spotId: selectedSpot.id,
        style: logForm.style,
        date: logForm.date,
      };
      if (logForm.routeId) payload.routeId = logForm.routeId;
      if (logForm.notes.trim()) payload.notes = logForm.notes.trim();

      const newEntry = await apiFetch<LogbookEntry>('/api/logbook', {
        method: 'POST', auth: true,
        body: JSON.stringify(payload),
      });
      setEntries((prev) => [newEntry, ...prev]);
      setStats((s) => s ? { ...s, total: s.total + 1 } : s);
      closeLogForm();
    } catch (err) {
      console.error('[logbook] add:', err);
      setLogError(t('common.error'));
    } finally {
      setLogSaving(false);
    }
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

  const gradePyramid = stats?.gradePyramid ? sortGrades(stats.gradePyramid) : [];
  const maxGradeCount = gradePyramid.length > 0 ? Math.max(...gradePyramid.map((g) => g.count)) : 0;
  const monthly = stats?.monthly ?? [];
  const maxMonthCount = monthly.length > 0 ? Math.max(...monthly.map((m) => m.count)) : 0;

  const PERIODS: Period[] = ['all', 'month', '3months', 'year'];
  const filteredEntries = filterByPeriod(entries, filterPeriod).filter((e) => !filterStyle || e.style === filterStyle);

  // Loggged route IDs for selected spot (by routeId stored as spotId+routeName key was wrong — use actual entry routeId)
  const loggedRouteIdsForSpot = selectedSpot
    ? new Set(entries.filter((e) => e.spotId === selectedSpot.id).map((e) => e.routeName).filter(Boolean))
    : new Set<string>();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24 md:pb-6">
      {/* Header + Search */}
      <div className="mb-6">
        <div className="mb-4">
          <h1 className="font-heading text-2xl font-bold text-text-primary">{t('logbook.title')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('logbook.subtitle')}</p>
        </div>

        {/* Search bar */}
        <div ref={searchRef} className="relative">
          <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 shadow-soft focus-within:border-sage focus-within:ring-1 focus-within:ring-sage/30">
            {searchLoading
              ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-text-secondary/50" />
              : <Search className="h-4 w-4 shrink-0 text-text-secondary/50" />
            }
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              placeholder={t('logbook.search_spot')}
              className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSearchResults([]); setShowDropdown(false); setSelectedSpot(null); }}
                className="shrink-0 cursor-pointer text-text-secondary/40 hover:text-text-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-elevated">
              {searchResults.map((spot) => (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() => selectSpot(spot)}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-sage" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">{spot.name}</p>
                    {(spot.niveau_min || spot.niveau_max) && (
                      <p className="text-xs text-text-secondary">
                        {spot.niveau_min}{spot.niveau_max && spot.niveau_max !== spot.niveau_min ? ` – ${spot.niveau_max}` : ''}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary/30" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Inline log form — shown when a spot is selected */}
        {selectedSpot && (
          <div className="mt-3 rounded-xl border border-sage/30 bg-sage/5 p-4 shadow-soft">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-text-primary">{selectedSpot.name}</p>
                {(selectedSpot.niveau_min || selectedSpot.niveau_max) && (
                  <p className="text-xs text-text-secondary">
                    {selectedSpot.niveau_min}{selectedSpot.niveau_max && selectedSpot.niveau_max !== selectedSpot.niveau_min ? ` – ${selectedSpot.niveau_max}` : ''}
                  </p>
                )}
              </div>
              <button type="button" onClick={closeLogForm} className="cursor-pointer rounded-lg p-1 text-text-secondary/40 hover:bg-surface-2 hover:text-text-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Route selector */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-secondary">{t('logbook.form_route')}</label>
                {routesLoading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-2.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-text-secondary/50" />
                    <span className="text-xs text-text-secondary/60">{t('common.loading')}</span>
                  </div>
                ) : (
                  <select
                    value={logForm.routeId}
                    onChange={(e) => setLogForm((f) => ({ ...f, routeId: e.target.value }))}
                    className="w-full cursor-pointer rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm text-text-primary outline-none focus:border-sage"
                  >
                    <option value="">{t('logbook.no_specific_route')}</option>
                    {spotRoutes.map((route) => {
                      const alreadyLogged = loggedRouteIdsForSpot.has(route.name);
                      return (
                        <option key={route._id} value={route._id} disabled={alreadyLogged}>
                          {alreadyLogged ? `✓ ${route.name}` : route.name}
                          {route.grade ? ` (${route.grade})` : ''}
                          {alreadyLogged ? ` — ${t('logbook.already_logged')}` : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-text-secondary">{t('logbook.form_style')}</label>
                  <select
                    value={logForm.style}
                    onChange={(e) => setLogForm((f) => ({ ...f, style: e.target.value }))}
                    className="w-full cursor-pointer rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm text-text-primary outline-none focus:border-sage"
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
                    value={logForm.date}
                    onChange={(e) => setLogForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm text-text-primary outline-none focus:border-sage"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-text-secondary">{t('logbook.form_comment')}</label>
                <textarea
                  value={logForm.notes}
                  onChange={(e) => setLogForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder={t('logbook.form_comment_placeholder')}
                  className="w-full resize-none rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-sage"
                />
              </div>

              {logError && <p className="text-xs font-medium text-red-500">{logError}</p>}
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={submitLog}
                disabled={logSaving}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-sage px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50"
              >
                {logSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('logbook.save_entry')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
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

      {/* Timeline */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-lg font-bold text-text-primary">{t('logbook.timeline')}</h2>
          <div className="ml-auto flex flex-wrap gap-1.5">
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

      {/* Edit modal */}
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
