import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeStore {
  theme: Theme;
  toggle: () => void;
  set: (theme: Theme) => void;
  hydrate: () => void;
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: 'light',

  hydrate: () => {
    const saved = (localStorage.getItem('zdg_theme_pref') as Theme) || 'light';
    applyTheme(saved);
    set({ theme: saved });
  },

  toggle: () => {
    set((s) => {
      const next: Theme = s.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('zdg_theme_pref', next);
      applyTheme(next);
      return { theme: next };
    });
  },

  set: (theme: Theme) => {
    localStorage.setItem('zdg_theme_pref', theme);
    applyTheme(theme);
    set({ theme });
  },
}));
