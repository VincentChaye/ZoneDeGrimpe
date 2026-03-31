import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';

export function NotificationsPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24">
      <h1 className="mb-6 font-heading text-2xl font-bold text-text-primary">
        {t('notif.title')}
      </h1>
      <div className="flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed border-border-subtle py-16 text-center">
        <Bell className="mb-3 h-10 w-10 text-text-secondary/30" />
        <p className="text-sm text-text-secondary">{t('notif.no_notifications')}</p>
      </div>
    </div>
  );
}
