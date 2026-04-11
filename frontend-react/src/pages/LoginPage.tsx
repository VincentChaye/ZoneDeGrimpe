import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Lock } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import type { AuthState } from '@/types';
import logo from '@/assets/ZoneDeGrimpeIcon.png';

const ERROR_MAP: Record<string, string> = {
  invalid_credentials: 'auth.invalid_credentials',
  missing_fields: 'auth.missing_fields',
  too_many_requests: 'auth.too_many_requests',
};

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const next = searchParams.get('next') || '/map';

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) navigate(next, { replace: true });
  }, [isAuthenticated, navigate, next]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!email.trim() || !password) {
      setError(t('auth.missing_fields'));
      return;
    }
    setLoading(true);

    try {
      const data = await apiFetch<AuthState>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      login(data);
      navigate(next);
    } catch (err) {
      if (err instanceof ApiError) {
        try {
          const body = JSON.parse(err.body);
          const key = ERROR_MAP[body.error];
          setError(key ? t(key) : t('auth.invalid_credentials'));
        } catch {
          setError(t('auth.invalid_credentials'));
        }
      } else {
        setError(t('common.error'));
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-[var(--radius-lg)] border border-border-subtle bg-surface p-6 shadow-card sm:p-8">
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

            {/* Forgot password */}
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs text-text-secondary hover:text-sage hover:underline"
              >
                {t('auth.forgot_link')}
              </Link>
            </div>

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
