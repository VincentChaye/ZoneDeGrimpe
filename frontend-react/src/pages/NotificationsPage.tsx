import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell, UserPlus, UserCheck, Star, CheckCircle, XCircle, Users, Loader2, CheckCheck, ImagePlus,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationsStore } from '@/stores/notifications.store';
import { cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/types';

function getNotifLink(notif: Notification): string | null {
  switch (notif.type) {
    case 'friend_request':
      return '/friends';
    case 'friend_accepted':
    case 'new_follower':
      return notif.fromUserId ? `/profile?id=${notif.fromUserId}` : null;
    case 'new_review':
    case 'spot_approved':
    case 'spot_rejected':
    case 'photo_approved':
    case 'photo_rejected':
      return '/my-spots';
    case 'photo_pending':
      return '/admin/spots';
    default:
      return null;
  }
}

const NOTIF_ICONS: Record<NotificationType, typeof Bell> = {
  friend_request: UserPlus,
  friend_accepted: UserCheck,
  new_review: Star,
  spot_approved: CheckCircle,
  spot_rejected: XCircle,
  new_follower: Users,
  photo_pending: ImagePlus,
  photo_approved: CheckCircle,
  photo_rejected: XCircle,
};

const NOTIF_COLORS: Record<NotificationType, string> = {
  friend_request: 'bg-sage-muted text-sage',
  friend_accepted: 'bg-green-100 text-green-600',
  new_review: 'bg-amber-brand/10 text-amber-brand',
  spot_approved: 'bg-green-100 text-green-600',
  spot_rejected: 'bg-red-100 text-red-500',
  new_follower: 'bg-blue-100 text-blue-600',
  photo_pending: 'bg-amber-brand/10 text-amber-brand',
  photo_approved: 'bg-green-100 text-green-600',
  photo_rejected: 'bg-red-100 text-red-500',
};

function useRelativeDate() {
  const { t } = useTranslation();
  return (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('time.just_now');
    if (mins < 60) return t('time.minutes_ago', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('time.hours_ago', { count: hours });
    const days = Math.floor(hours / 24);
    if (days === 1) return t('time.yesterday');
    if (days < 7) return t('time.days_ago', { count: days });
    const weeks = Math.floor(days / 7);
    return t('time.weeks_ago', { count: weeks });
  };
}

export function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const {
    notifications, loading, unreadCount,
    fetchNotifications, markRead, markAllRead,
  } = useNotificationsStore();
  const relativeDate = useRelativeDate();

  useEffect(() => {
    if (isAuthenticated) fetchNotifications();
  }, [isAuthenticated, fetchNotifications]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <Bell className="h-12 w-12 text-text-secondary/30" />
        <p className="text-sm text-text-secondary">{t('toast.login_required')}</p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-xl bg-sage px-5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-sage-hover"
        >
          {t('auth.login')}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">
            {t('notif.title')}
          </h1>
          {unreadCount > 0 && (
            <p className="mt-0.5 text-sm text-text-secondary">
              {unreadCount} {t('notif.unread')}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 rounded-xl border border-border-subtle px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-2"
            type="button"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {t('notif.mark_all_read')}
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-sage" />
        </div>
      )}

      {/* Empty state */}
      {!loading && notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle py-16 text-center">
          <Bell className="mb-3 h-10 w-10 text-text-secondary/20" />
          <p className="text-sm font-medium text-text-secondary">{t('notif.no_notifications')}</p>
        </div>
      )}

      {/* Notifications list */}
      {!loading && notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const Icon = NOTIF_ICONS[notif.type] || Bell;
            const colorCls = NOTIF_COLORS[notif.type] || 'bg-surface-2 text-text-secondary';

            return (
              <button
                key={notif._id}
                onClick={() => {
                  if (!notif.read) markRead(notif._id);
                  const link = getNotifLink(notif);
                  if (link) navigate(link);
                }}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all',
                  notif.read
                    ? 'border-border-subtle/50 bg-surface opacity-70'
                    : 'border-border-subtle bg-surface shadow-soft hover:shadow-card',
                )}
                type="button"
              >
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', colorCls)}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    'text-sm text-text-primary',
                    !notif.read && 'font-semibold',
                  )}>
                    {notif.message || t(`notif.${notif.type}`, {
                      user: notif.fromUsername || '',
                      spot: notif.data?.spotName || '',
                    })}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-secondary/60">
                    {relativeDate(notif.createdAt)}
                  </p>
                </div>
                {!notif.read && (
                  <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-sage" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
