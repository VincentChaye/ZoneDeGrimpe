import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import type { Notification } from '@/types';

interface NotificationsStore {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;

  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export const useNotificationsStore = create<NotificationsStore>((set) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const data = await apiFetch<Notification[]>('/api/notifications?limit=50', { auth: true });
      set({ notifications: data ?? [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const data = await apiFetch<{ count: number }>('/api/notifications/unread-count', { auth: true });
      set({ unreadCount: data?.count ?? 0 });
    } catch { /* silent */ }
  },

  markRead: async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH', auth: true });
      set((s) => ({
        notifications: s.notifications.map((n) => n._id === id ? { ...n, read: true } : n),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    } catch { /* silent */ }
  },

  markAllRead: async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'PATCH', auth: true });
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch { /* silent */ }
  },
}));
