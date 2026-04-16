import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import type { MaterielSpec, UserMateriel, GearCategory } from '@/types';

interface GearStore {
  items: UserMateriel[];
  catalog: MaterielSpec[];
  loading: boolean;
  error: string | null;

  fetchMyGear: (category?: GearCategory) => Promise<void>;
  fetchCatalog: (category?: GearCategory, q?: string) => Promise<void>;
  addGear: (data: Record<string, unknown>) => Promise<UserMateriel>;
  updateGear: (id: string, data: Record<string, unknown>) => Promise<UserMateriel>;
  deleteGear: (id: string) => Promise<void>;
}

export const useGearStore = create<GearStore>((set, get) => ({
  items: [],
  catalog: [],
  loading: false,
  error: null,

  fetchMyGear: async (category?: GearCategory) => {
    set({ loading: true, error: null });
    try {
      const params = category ? `?category=${category}` : '';
      const data = await apiFetch<{ items: UserMateriel[] }>(`/api/user-materiel/me${params}`, { auth: true });
      set({ items: data?.items ?? [], loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchCatalog: async (category?: GearCategory, q?: string) => {
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (q) params.set('q', q);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const data = await apiFetch<{ items: MaterielSpec[] }>(`/api/materiel-specs${qs}`);
      set({ catalog: data?.items ?? [] });
    } catch (err) {
      console.error('[gear] fetchCatalog:', err);
    }
  },

  addGear: async (data: Record<string, unknown>) => {
    const item = await apiFetch<UserMateriel>('/api/user-materiel', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(data),
    });
    set((s) => ({ items: [item, ...s.items] }));
    return item;
  },

  updateGear: async (id: string, data: Record<string, unknown>) => {
    const updated = await apiFetch<UserMateriel>(`/api/user-materiel/${id}`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify(data),
    });
    set((s) => ({ items: s.items.map((i) => (i._id === id ? updated : i)) }));
    return updated;
  },

  deleteGear: async (id: string) => {
    await apiFetch(`/api/user-materiel/${id}`, { method: 'DELETE', auth: true });
    set((s) => ({ items: s.items.filter((i) => i._id !== id) }));
  },
}));
