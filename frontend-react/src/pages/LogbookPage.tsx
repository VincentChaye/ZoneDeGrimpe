import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, MapPin, TrendingUp, Loader2, Zap,
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
  comment?: string;
  createdAt: string;
}

interface LogbookStats {
  totalAscents: number;
  uniqueSpots: number;
  gradeDistribution: Record<string, number>;
}

const STYLE_LABELS: Record<string, string> = {
  onsight: 'A vue',
  flash: 'Flash',
  redpoint: 'Enchaîné',
  repeat: 'Répét',
};

const STYLE_CLS: Record<string, string> = {
  onsight: 'bg-grade-easy/10 text-grade-easy border-grade-easy/20',
  flash: 'bg-grade-medium/10 text-grade-medium border-grade-medium/20',
  redpoint: 'bg-grade-hard/10 text-grade-hard border-grade-hard/20',
  repeat: 'bg-surface-2 text-text-secondary border-border-subtle',
};

function sortGrades(grades: [string, number][]): [string, number][] {
  return [...grades].sort((a, b) => parseGradeToNumber(a[0]) - parseGradeToNumber(b[0]));
}

export function LogbookPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();

  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [stats, setStats] = useState<LogbookStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }

    Promise.all([
      apiFetch<LogbookEntry[] | { items: LogbookEntry[] }>('/api/logbook?limit=100', { auth: true }),
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

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <BookOpen className="h-12 w-12 text-text-secondary/30" />
        <p className="text-sm text-text-secondary">{t('auth.login_required') || 'Connectez-vous pour voir votre carnet'}</p>
        <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-sage px-5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-sage-hover">
          {t('auth.login') || 'Se connecter'}
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

  const gradeEntries = stats?.gradeDistribution ? sortGrades(Object.entries(stats.gradeDistribution)) : [];
  const maxGradeCount = gradeEntries.length > 0 ? Math.max(...gradeEntries.map(([, c]) => c)) : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-text-primary">
          {t('logbook.title') || 'Carnet de grimpe'}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {t('logbook.subtitle') || 'Tes ascensions et ta progression'}
        </p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border-subtle bg-surface p-4 shadow-soft">
            <div className="flex items-center gap-2 text-sage">
              <TrendingUp className="h-5 w-5" />
              <span className="font-heading text-2xl font-bold">{stats.totalAscents}</span>
            </div>
            <p className="mt-1 text-xs font-medium text-text-secondary">Ascensions</p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-surface p-4 shadow-soft">
            <div className="flex items-center gap-2 text-amber-brand">
              <MapPin className="h-5 w-5" />
              <span className="font-heading text-2xl font-bold">{stats.uniqueSpots}</span>
            </div>
            <p className="mt-1 text-xs font-medium text-text-secondary">Spots différents</p>
          </div>
        </div>
      )}

      {/* Grade pyramid */}
      {gradeEntries.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold text-text-primary">
            <Zap className="h-4 w-4 text-sage" />
            Pyramide des cotations
          </h2>
          <div className="space-y-1.5 rounded-xl border border-border-subtle bg-surface p-4 shadow-soft">
            {gradeEntries.map(([grade, count]) => (
              <div key={grade} className="flex items-center gap-3">
                <span className="w-10 text-right text-xs font-bold text-text-primary">{grade}</span>
                <div className="flex-1">
                  <div
                    className="h-5 rounded bg-sage/20 transition-all duration-500"
                    style={{ width: `${Math.max(4, (count / maxGradeCount) * 100)}%` }}
                  >
                    <div
                      className="h-full rounded bg-sage"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
                <span className="w-8 text-xs font-medium text-text-secondary">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Timeline */}
      <section>
        <h2 className="mb-3 font-heading text-lg font-bold text-text-primary">
          {t('logbook.timeline') || 'Historique'}
        </h2>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle py-12 text-center">
            <BookOpen className="mb-3 h-10 w-10 text-text-secondary/20" />
            <p className="text-sm font-medium text-text-secondary">Aucune ascension enregistrée</p>
            <p className="mt-1 text-xs text-text-secondary/60">Commencez à logger vos grimpes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => {
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
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/map?spot=${entry.spotId}`}
                          className="truncate text-sm font-semibold text-text-primary no-underline hover:text-sage"
                        >
                          {entry.spotName || 'Spot inconnu'}
                        </Link>
                      </div>
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
                          {STYLE_LABELS[entry.style] || entry.style}
                        </span>
                        <span className="text-[11px] text-text-secondary/60">
                          {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {entry.comment && (
                        <p className="mt-1.5 text-xs leading-relaxed text-text-secondary/80">{entry.comment}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
