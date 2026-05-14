import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import type { Outing, OutingItem, OutingClaim } from '@/types';

interface OutingStore {
  activeByConv: Record<string, Outing | null>;
  loading: Record<string, boolean>;

  ensureLoaded: (convId: string) => Promise<void>;
  createOuting: (payload: {
    conversationId: string;
    title?: string;
    scheduledAt?: string | null;
    location?: string | null;
    notes?: string | null;
    items: Omit<OutingItem, 'id' | 'claims'>[];
  }) => Promise<Outing>;
  updateOuting: (outingId: string, convId: string, patch: Partial<Pick<Outing, 'title' | 'scheduledAt' | 'location' | 'notes'>>) => Promise<void>;
  updateItems: (outingId: string, convId: string, items: Omit<OutingItem, 'claims'>[]) => Promise<void>;
  claim: (outingId: string, convId: string, itemId: string, quantity: number) => Promise<void>;
  unclaim: (outingId: string, convId: string, itemId: string, claimId: string) => Promise<void>;
  complete: (outingId: string, convId: string) => Promise<Outing | void>;
  deleteOuting: (outingId: string, convId: string) => Promise<void>;

  // Socket handlers
  _onOutingCreated: (data: { outing: Outing }) => void;
  _onOutingUpdated: (data: { outing: Outing }) => void;
  _onOutingClaimAdded: (data: { outingId: string; itemId: string; claim: OutingClaim }) => void;
  _onOutingClaimRemoved: (data: { outingId: string; itemId: string; claimId: string }) => void;
  _onOutingCompleted: (data: { outing: Outing }) => void;
  _onOutingDeleted: (data: { outingId: string; conversationId: string }) => void;
}

export const useOutingStore = create<OutingStore>((set, get) => ({
  activeByConv: {},
  loading: {},

  async ensureLoaded(convId) {
    if (get().loading[convId]) return;
    set((s) => ({ loading: { ...s.loading, [convId]: true } }));
    try {
      const list = await apiFetch<Outing[]>(`/api/outings?conversationId=${convId}&status=active&limit=1`, { auth: true });
      set((s) => ({
        activeByConv: { ...s.activeByConv, [convId]: list?.[0] ?? null },
        loading: { ...s.loading, [convId]: false },
      }));
    } catch {
      set((s) => ({ loading: { ...s.loading, [convId]: false } }));
    }
  },

  async createOuting(payload) {
    const outing = await apiFetch<Outing>('/api/outings', {
      method: 'POST', auth: true,
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
    set((s) => ({
      activeByConv: { ...s.activeByConv, [payload.conversationId]: outing },
    }));
    return outing;
  },

  async updateOuting(outingId, convId, patch) {
    const updated = await apiFetch<Outing>(`/api/outings/${outingId}`, {
      method: 'PATCH', auth: true,
      body: JSON.stringify(patch),
      headers: { 'Content-Type': 'application/json' },
    });
    set((s) => ({ activeByConv: { ...s.activeByConv, [convId]: updated } }));
  },

  async updateItems(outingId, convId, items) {
    const updated = await apiFetch<Outing>(`/api/outings/${outingId}/items`, {
      method: 'PUT', auth: true,
      body: JSON.stringify({ items }),
      headers: { 'Content-Type': 'application/json' },
    });
    set((s) => ({ activeByConv: { ...s.activeByConv, [convId]: updated } }));
  },

  async claim(outingId, convId, itemId, quantity) {
    const claim = await apiFetch<OutingClaim>(`/api/outings/${outingId}/items/${itemId}/claims`, {
      method: 'POST', auth: true,
      body: JSON.stringify({ quantity }),
      headers: { 'Content-Type': 'application/json' },
    });
    // Merge — skip if socket already added this claim (race condition guard)
    set((s) => {
      const outing = s.activeByConv[convId];
      if (!outing) return s;
      return {
        activeByConv: {
          ...s.activeByConv,
          [convId]: {
            ...outing,
            items: outing.items.map((item) =>
              item.id === itemId && !item.claims.some((c) => c.claimId === claim.claimId)
                ? { ...item, claims: [...item.claims, claim] }
                : item
            ),
          },
        },
      };
    });
  },

  async unclaim(outingId, convId, itemId, claimId) {
    await apiFetch(`/api/outings/${outingId}/items/${itemId}/claims/${claimId}`, {
      method: 'DELETE', auth: true,
    });
    set((s) => {
      const outing = s.activeByConv[convId];
      if (!outing) return s;
      return {
        activeByConv: {
          ...s.activeByConv,
          [convId]: {
            ...outing,
            items: outing.items.map((item) =>
              item.id === itemId
                ? { ...item, claims: item.claims.filter((c) => c.claimId !== claimId) }
                : item
            ),
          },
        },
      };
    });
  },

  async complete(outingId, convId) {
    const updated = await apiFetch<Outing>(`/api/outings/${outingId}/complete`, {
      method: 'POST', auth: true,
    });
    set((s) => ({ activeByConv: { ...s.activeByConv, [convId]: null } }));
    return updated;
  },

  async deleteOuting(outingId, convId) {
    await apiFetch(`/api/outings/${outingId}`, { method: 'DELETE', auth: true });
    set((s) => ({ activeByConv: { ...s.activeByConv, [convId]: null } }));
  },

  // ── Socket handlers ───────────────────────────────────────────────────────

  _onOutingCreated({ outing }) {
    const convId = outing.conversationId?.toString?.() ?? outing.conversationId;
    set((s) => ({ activeByConv: { ...s.activeByConv, [convId]: outing } }));
  },

  _onOutingUpdated({ outing }) {
    const convId = outing.conversationId?.toString?.() ?? outing.conversationId;
    set((s) => ({ activeByConv: { ...s.activeByConv, [convId]: outing } }));
  },

  _onOutingClaimAdded({ outingId, itemId, claim }) {
    set((s) => {
      const entry = Object.entries(s.activeByConv).find(([, o]) => o?._id === outingId);
      if (!entry) return s;
      const [convId, outing] = entry;
      if (!outing) return s;
      return {
        activeByConv: {
          ...s.activeByConv,
          [convId]: {
            ...outing,
            items: outing.items.map((item) =>
              item.id === itemId && !item.claims.some((c) => c.claimId === claim.claimId)
                ? { ...item, claims: [...item.claims, claim] }
                : item
            ),
          },
        },
      };
    });
  },

  _onOutingClaimRemoved({ outingId, itemId, claimId }) {
    set((s) => {
      const entry = Object.entries(s.activeByConv).find(([, o]) => o?._id === outingId);
      if (!entry) return s;
      const [convId, outing] = entry;
      if (!outing) return s;
      return {
        activeByConv: {
          ...s.activeByConv,
          [convId]: {
            ...outing,
            items: outing.items.map((item) =>
              item.id === itemId
                ? { ...item, claims: item.claims.filter((c) => c.claimId !== claimId) }
                : item
            ),
          },
        },
      };
    });
  },

  _onOutingCompleted({ outing }) {
    const convId = outing.conversationId?.toString?.() ?? outing.conversationId;
    set((s) => ({ activeByConv: { ...s.activeByConv, [convId]: null } }));
  },

  _onOutingDeleted({ conversationId }) {
    set((s) => ({ activeByConv: { ...s.activeByConv, [conversationId]: null } }));
  },
}));
