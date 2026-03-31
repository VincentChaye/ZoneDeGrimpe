import { create } from 'zustand';
import type { AuthState, AuthUser } from '@/types';

interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;

  /** Initialize from localStorage on app load */
  hydrate: () => void;

  /** Set auth after login/register */
  login: (state: AuthState) => void;

  /** Clear auth */
  logout: () => void;

  /** Update user fields (e.g. after profile edit) */
  updateUser: (partial: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isAdmin: false,

  hydrate: () => {
    try {
      const raw = localStorage.getItem('auth');
      if (!raw) return;
      const parsed: AuthState = JSON.parse(raw);
      if (parsed?.token && parsed?.user) {
        set({
          token: parsed.token,
          user: parsed.user,
          isAuthenticated: true,
          isAdmin: parsed.user.roles?.includes('admin') ?? false,
        });
      }
    } catch {
      localStorage.removeItem('auth');
    }
  },

  login: (state: AuthState) => {
    localStorage.setItem('auth', JSON.stringify(state));
    set({
      token: state.token,
      user: state.user,
      isAuthenticated: true,
      isAdmin: state.user.roles?.includes('admin') ?? false,
    });
  },

  logout: () => {
    localStorage.removeItem('auth');
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isAdmin: false,
    });
  },

  updateUser: (partial) => {
    set((s) => {
      if (!s.user || !s.token) return s;
      const updated = { ...s.user, ...partial };
      localStorage.setItem('auth', JSON.stringify({ token: s.token, user: updated }));
      return {
        user: updated,
        isAdmin: updated.roles?.includes('admin') ?? false,
      };
    });
  },
}));
