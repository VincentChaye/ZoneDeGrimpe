import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import logo from '@/assets/ZoneDeGrimpeIcon.png';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('auth.invalid_email'));
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setSent(true);
    } catch {
      setError(t('common.error'));
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-[calc(100vh-var(--spacing-header)-var(--spacing-tabbar))] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-[var(--radius-lg)] border border-border-subtle bg-surface p-8 shadow-card">
          {/* Logo */}
          <div className="mb-6 text-center">
            <img src={logo} alt="" className="mx-auto mb-3 h-10 w-10" />
            <h2 className="font-heading text-xl font-bold text-text-primary">
              {t('auth.forgot_title')}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">{t('auth.forgot_subtitle')}</p>
          </div>

          {sent ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-grade-easy" />
              <p className="text-sm text-text-secondary">{t('auth.forgot_sent', { email })}</p>
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
                {t('auth.forgot_send')}
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
