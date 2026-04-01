import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import type { Friend, FriendRequest, FriendshipCheck } from '@/types';

interface FriendsStore {
  friends: Friend[];
  requests: FriendRequest[];
  loading: boolean;
  error: string | null;

  fetchFriends: () => Promise<void>;
  fetchRequests: () => Promise<void>;
  sendRequest: (userId: string) => Promise<void>;
  acceptRequest: (friendshipId: string) => Promise<void>;
  declineRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  checkFriendship: (userId: string) => Promise<FriendshipCheck>;
}

export const useFriendsStore = create<FriendsStore>((set, get) => ({
  friends: [],
  requests: [],
  loading: false,
  error: null,

  fetchFriends: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<Friend[]>('/api/friends', { auth: true });
      set({ friends: data ?? [], loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchRequests: async () => {
    try {
      const data = await apiFetch<FriendRequest[]>('/api/friends/requests', { auth: true });
      set({ requests: data ?? [] });
    } catch (err) {
      console.error('[friends] fetchRequests:', err);
    }
  },

  sendRequest: async (userId: string) => {
    await apiFetch(`/api/friends/request/${userId}`, { method: 'POST', auth: true });
  },

  acceptRequest: async (friendshipId: string) => {
    await apiFetch(`/api/friends/${friendshipId}/accept`, { method: 'PATCH', auth: true });
    // Refresh both lists
    get().fetchRequests();
    get().fetchFriends();
  },

  declineRequest: async (friendshipId: string) => {
    await apiFetch(`/api/friends/${friendshipId}/decline`, { method: 'PATCH', auth: true });
    set((s) => ({ requests: s.requests.filter((r) => r.friendshipId !== friendshipId) }));
  },

  removeFriend: async (friendshipId: string) => {
    await apiFetch(`/api/friends/${friendshipId}`, { method: 'DELETE', auth: true });
    set((s) => ({ friends: s.friends.filter((f) => f.friendshipId !== friendshipId) }));
  },

  checkFriendship: async (userId: string) => {
    const data = await apiFetch<FriendshipCheck>(`/api/friends/check/${userId}`, { auth: true });
    return data ?? { status: 'none' as const };
  },
}));
