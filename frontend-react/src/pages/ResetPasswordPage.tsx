import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, ArrowLeft, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import logo from '@/assets/ZoneDeGrimpeIcon.png';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError(t('settings.pw_too_short')); return; }
    if (password !== confirm) { setError(t('settings.pw_mismatch')); return; }

    setLoading(true);
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password }),
      });
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      if (err instanceof ApiError) {
        try {
          const body = JSON.parse(err.body);
          if (body.error === 'invalid_or_expired_token') {
            setError(t('auth.reset_token_invalid'));
          } else {
            setError(t('common.error'));
          }
        } catch {
          setError(t('common.error'));
        }
      } else {
        setError(t('common.error'));
      }
    }
    setLoading(false);
  }

  if (!token) {
    return (
      <div className="flex min-h-[calc(100vh-var(--spacing-header)-var(--spacing-tabbar))] items-center justify-center px-4 py-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <p className="text-sm text-text-secondary">{t('auth.reset_token_invalid')}</p>
          <Link to="/forgot-password" className="text-sm font-semibold text-sage hover:underline">
            {t('auth.request_new_link')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-var(--spacing-header)-var(--spacing-tabbar))] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-[var(--radius-lg)] border border-border-subtle bg-surface p-8 shadow-card">
          <div className="mb-6 text-center">
            <img src={logo} alt="" className="mx-auto mb-3 h-10 w-10" />
            <h2 className="font-heading text-xl font-bold text-text-primary">
              {t('auth.reset_title')}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">{t('auth.reset_subtitle')}</p>
          </div>

          {done ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-grade-easy" />
              <p className="text-sm text-text-secondary">{t('auth.reset_done')}</p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-sage hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('auth.back_to_login')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text-primary">{t('settings.pw_new')}</span>
                <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-border-subtle bg-bg px-3 py-2.5 focus-within:border-sage focus-within:ring-1 focus-within:ring-sage">
                  <Lock className="h-4 w-4 shrink-0 text-text-secondary" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="8 caractères minimum"
                    className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
                  />
                </div>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text-primary">{t('settings.pw_confirm')}</span>
                <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-border-subtle bg-bg px-3 py-2.5 focus-within:border-sage focus-within:ring-1 focus-within:ring-sage">
                  <Lock className="h-4 w-4 shrink-0 text-text-secondary" />
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder={t('settings.pw_confirm')}
                    className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
                  />
                </div>
              </label>

              {error && (
                <p className="rounded-[var(--radius-sm)] bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-sage px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-sage-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('auth.reset_submit')}
              </button>

              <Link
                to="/login"
                className="flex items-center justify-center gap-2 text-sm text-text-secondary hover:text-text-primary"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('auth.back_to_login')}
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
