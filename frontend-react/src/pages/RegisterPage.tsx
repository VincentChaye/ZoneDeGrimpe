import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, User, AtSign, Check, X, Loader2 as SpinIcon, Eye, EyeOff } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import type { AuthState } from '@/types';
import logo from '@/assets/ZoneDeGrimpeIcon.png';

const ERROR_MAP: Record<string, string> = {
  email_taken: 'auth.email_taken',
  username_taken: 'auth.username_taken',
  invalid_password: 'auth.invalid_password',
  missing_fields: 'auth.missing_fields',
  username_required: 'auth.username_required',
  username_invalid_format: 'auth.username_invalid_format',
  invalid_email: 'auth.invalid_email',
  too_many_requests: 'auth.too_many_requests',
};

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();

  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', displayName: '', username: '', level: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) navigate('/map', { replace: true });
  }, [isAuthenticated, navigate]);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === 'username') {
      const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (cleaned.length < 3) { setUsernameStatus('idle'); return; }
      setUsernameStatus('checking');
      debounceRef.current = setTimeout(async () => {
        try {
          const data = await apiFetch<{ available: boolean }>(`/api/users/check-username/${cleaned}`);
          setUsernameStatus(data?.available ? 'available' : 'taken');
        } catch {
          setUsernameStatus('idle');
        }
      }, 500);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!form.displayName.trim()) { setError(t('auth.missing_fields')); return; }
    if (form.username.length < 3) { setError(t('auth.username_invalid_format')); return; }
    if (usernameStatus === 'taken') { setError(t('auth.username_taken')); return; }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError(t('auth.invalid_email')); return; }
    if (form.password.length < 8) { setError(t('auth.invalid_password')); return; }
    if (form.password !== form.confirmPassword) { setError(t('auth.password_mismatch')); return; }

    setLoading(true);

    const payload: Record<string, string> = {
      email: form.email,
      password: form.password,
      displayName: form.displayName,
      username: form.username,
    };
    if (form.level) payload.level = form.level;

    try {
      const data = await apiFetch<AuthState>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      login(data);
      navigate('/map');
    } catch (err) {
      if (err instanceof ApiError) {
        try {
          const body = JSON.parse(err.body);
          const key = ERROR_MAP[body.error];
          setError(key ? t(key) : body.detail || t('common.error'));
        } catch {
          setError(t('common.error'));
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
    <div className="flex min-h-full items-start justify-center px-4 py-6 sm:items-center sm:py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-[var(--radius-lg)] border border-border-subtle bg-surface p-5 shadow-card sm:p-8">
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
              onChange={(v) => update('username', v)}
              placeholder={t('auth.username_placeholder')}
              autoComplete="username"
              suffix={
                form.username.length >= 3 ? (
                  usernameStatus === 'checking' ? <SpinIcon className="h-3.5 w-3.5 animate-spin text-text-secondary" /> :
                  usernameStatus === 'available' ? <Check className="h-3.5 w-3.5 text-grade-easy" /> :
                  usernameStatus === 'taken' ? <X className="h-3.5 w-3.5 text-red-500" /> : null
                ) : null
              }
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
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={t('auth.password_placeholder')}
              suffix={
                <button type="button" onClick={() => setShowPassword(v => !v)} className="text-text-secondary hover:text-text-primary">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            <InputField
              icon={<Lock className="h-4 w-4" />}
              label={t('auth.confirm_password')}
              value={form.confirmPassword}
              onChange={(v) => update('confirmPassword', v)}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={t('auth.confirm_password_placeholder')}
            />

            {/* Niveau de grimpe */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">{t('auth.level_label')}</span>
              <select
                value={form.level}
                onChange={(e) => update('level', e.target.value)}
                className="w-full rounded-[var(--radius-sm)] border border-border-subtle bg-bg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-sage focus:ring-1 focus:ring-sage"
              >
                <option value="">{t('auth.level_optional')}</option>
                <option value="debutant">{t('level.debutant')}</option>
                <option value="intermediaire">{t('level.intermediaire')}</option>
                <option value="avance">{t('level.avance')}</option>
              </select>
            </label>

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
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  suffix?: React.ReactNode;
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
        {suffix && <span className="shrink-0">{suffix}</span>}
      </div>
    </label>
  );
}
