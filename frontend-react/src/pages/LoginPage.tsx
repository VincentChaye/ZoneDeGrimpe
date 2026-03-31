import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Lock } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import type { AuthState } from '@/types';
import logo from '@/assets/ZoneDeGrimpeIcon.png';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const next = searchParams.get('next') || '/map';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiFetch<AuthState>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      login(data);
      navigate(next);
    } catch (err) {
      setError(t('common.error'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-var(--spacing-header)-var(--spacing-tabbar))] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-[var(--radius-lg)] border border-border-subtle bg-surface p-8 shadow-card">
          {/* Logo */}
          <div className="mb-6 text-center">
            <img src={logo} alt="" className="mx-auto mb-3 h-10 w-10" />
            <h2 className="font-heading text-xl font-bold text-text-primary">
              {t('auth.login_title')}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">{t('auth.login_subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">{t('auth.email')}</span>
              <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-border-subtle bg-bg px-3 py-2.5 focus-within:border-sage focus-within:ring-1 focus-within:ring-sage">
                <Mail className="h-4 w-4 shrink-0 text-text-secondary" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder={t('auth.email_placeholder')}
                  className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
                />
              </div>
            </label>

            {/* Password */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">{t('auth.password')}</span>
              <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-border-subtle bg-bg px-3 py-2.5 focus-within:border-sage focus-within:ring-1 focus-within:ring-sage">
                <Lock className="h-4 w-4 shrink-0 text-text-secondary" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder={t('auth.password_placeholder')}
                  className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
                />
              </div>
            </label>

            {/* Error */}
            {error && (
              <p className="rounded-[var(--radius-sm)] bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex cursor-pointer items-center justify-center rounded-[var(--radius-sm)] bg-sage px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-sage-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t('common.loading') : t('auth.login')}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border-subtle" />
            <span className="text-xs text-text-secondary">{t('auth.or')}</span>
            <div className="h-px flex-1 bg-border-subtle" />
          </div>

          <p className="text-center text-sm text-text-secondary">
            {t('auth.not_member')}{' '}
            <Link to="/register" className="font-semibold text-sage hover:underline">
              {t('auth.create_account')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
