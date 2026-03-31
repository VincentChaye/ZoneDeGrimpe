import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, User, AtSign } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import type { AuthState } from '@/types';
import logo from '@/assets/ZoneDeGrimpeIcon.png';

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    username: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiFetch<AuthState>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      login(data);
      navigate('/map');
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
          <div className="mb-6 text-center">
            <img src={logo} alt="" className="mx-auto mb-3 h-10 w-10" />
            <h2 className="font-heading text-xl font-bold text-text-primary">
              {t('auth.join_title')}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">{t('auth.join_subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <InputField
              icon={<User className="h-4 w-4" />}
              label={t('auth.display_name')}
              value={form.displayName}
              onChange={(v) => update('displayName', v)}
              autoComplete="name"
            />
            <InputField
              icon={<AtSign className="h-4 w-4" />}
              label={t('auth.username')}
              value={form.username}
              onChange={(v) => update('username', v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder={t('auth.username_placeholder')}
              autoComplete="username"
            />
            <InputField
              icon={<Mail className="h-4 w-4" />}
              label={t('auth.email')}
              value={form.email}
              onChange={(v) => update('email', v)}
              type="email"
              autoComplete="email"
              placeholder={t('auth.email_placeholder')}
            />
            <InputField
              icon={<Lock className="h-4 w-4" />}
              label={t('auth.password')}
              value={form.password}
              onChange={(v) => update('password', v)}
              type="password"
              autoComplete="new-password"
              placeholder={t('auth.password_placeholder')}
            />

            {error && (
              <p className="rounded-[var(--radius-sm)] bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex cursor-pointer items-center justify-center rounded-[var(--radius-sm)] bg-sage px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-sage-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t('common.loading') : t('auth.create_account')}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border-subtle" />
            <span className="text-xs text-text-secondary">{t('auth.or')}</span>
            <div className="h-px flex-1 bg-border-subtle" />
          </div>

          <p className="text-center text-sm text-text-secondary">
            {t('auth.already_member')}{' '}
            <Link to="/login" className="font-semibold text-sage hover:underline">
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function InputField({
  icon,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-text-primary">{label}</span>
      <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-border-subtle bg-bg px-3 py-2.5 focus-within:border-sage focus-within:ring-1 focus-within:ring-sage">
        <span className="shrink-0 text-text-secondary">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
        />
      </div>
    </label>
  );
}
