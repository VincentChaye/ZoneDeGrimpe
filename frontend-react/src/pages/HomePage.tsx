import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Users, Map, Shield, UserPlus, ArrowRight, Mountain } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import logo from '@/assets/ZoneDeGrimpeIcon.png';

export function HomePage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const [spotCount, setSpotCount] = useState<number | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<{ count: number }>('/api/spots/count')
      .then(({ count }) => setSpotCount(count))
      .catch(() => {});
    apiFetch<{ count: number }>('/api/users/count')
      .then(({ count }) => setUserCount(count))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-full">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-16 sm:py-24">
        {/* Decorative shapes */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-sage/5 blur-3xl" />
          <div className="absolute -right-16 top-1/3 h-64 w-64 rounded-full bg-gold/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-amber-brand/5 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-4 py-1.5 text-sm font-medium text-text-secondary shadow-soft">
            <Mountain className="h-4 w-4 text-sage" />
            {t('hero.badge')}
          </div>

          <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
            {t('hero.title_1')}{' '}
            <span className="bg-gradient-to-r from-sage to-amber-brand bg-clip-text text-transparent">
              {t('hero.title_2')}
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg">
            {t('hero.subtitle')}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/map"
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-sage px-6 py-3 text-sm font-semibold text-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:bg-sage-hover hover:shadow-elevated no-underline"
            >
              <MapPin className="h-4 w-4" />
              {t('hero.cta_map')}
            </Link>
            {!isAuthenticated && (
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-border-subtle bg-surface px-6 py-3 text-sm font-semibold text-text-primary shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card no-underline"
              >
                {t('hero.cta_register')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>

        {/* Floating logo */}
        <div className="mt-12 flex justify-center">
          <img
            src={logo}
            alt=""
            className="h-20 w-20 animate-[float_6s_ease-in-out_infinite] opacity-40"
            aria-hidden="true"
          />
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border-subtle bg-surface/50 py-10">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 px-4 sm:gap-16">
          <StatItem
            icon={<MapPin className="h-6 w-6" />}
            value={spotCount !== null ? spotCount.toLocaleString('fr-FR') : '--'}
            label={t('stats.spots')}
          />
          <StatItem
            icon={<Users className="h-6 w-6" />}
            value={userCount !== null ? userCount.toLocaleString('fr-FR') : '--'}
            label={t('stats.climbers')}
            iconClass="text-amber-brand"
          />
          <StatItem
            icon={<Map className="h-6 w-6" />}
            value={t('stats.france')}
            label={t('stats.coverage')}
            iconClass="text-stone-brand"
          />
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="mb-10 text-center font-heading text-2xl font-bold text-text-primary">
          {t('features.title')}
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Map className="h-7 w-7" />}
            title={t('features.map_title')}
            description={t('features.map_desc')}
          />
          <FeatureCard
            icon={<Shield className="h-7 w-7" />}
            title={t('features.details_title')}
            description={t('features.details_desc')}
            iconClass="text-amber-brand bg-amber-brand/10"
          />
          <FeatureCard
            icon={<UserPlus className="h-7 w-7" />}
            title={t('features.community_title')}
            description={t('features.community_desc')}
            iconClass="text-stone-brand bg-stone-brand/10"
          />
        </div>
      </section>

      {/* Announcement */}
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border-subtle bg-surface p-4 shadow-soft">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage-muted text-sage">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {t('announcement.title')}
            </p>
            <p className="mt-0.5 text-sm text-text-secondary">
              {t('announcement.text')}
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-subtle bg-surface/50 py-6 text-center text-sm text-text-secondary">
        <div className="flex items-center justify-center gap-2">
          <img src={logo} alt="" className="h-5 w-5" />
          <span>ZoneDeGrimpe</span>
        </div>
        <p className="mt-1">
          &copy; {new Date().getFullYear()} ZoneDeGrimpe &mdash; {t('footer.rights')}
        </p>
      </footer>
    </div>
  );
}

/* --- Sub-components --- */

function StatItem({
  icon,
  value,
  label,
  iconClass = 'text-sage',
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  iconClass?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div className={`${iconClass}`}>{icon}</div>
      <div className="font-heading text-2xl font-bold text-text-primary">{value}</div>
      <div className="text-sm text-text-secondary">{label}</div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  iconClass = 'text-sage bg-sage-muted',
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  iconClass?: string;
}) {
  return (
    <article className="group cursor-default rounded-[var(--radius-md)] border border-border-subtle bg-surface p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-card">
      <div
        className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-sm)] ${iconClass}`}
      >
        {icon}
      </div>
      <h3 className="mb-2 font-heading text-lg font-semibold text-text-primary">{title}</h3>
      <p className="text-sm leading-relaxed text-text-secondary">{description}</p>
    </article>
  );
}
