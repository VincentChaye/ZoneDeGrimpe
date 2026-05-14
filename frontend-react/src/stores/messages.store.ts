// frontend-react/src/stores/messages.store.ts
import { create } from 'zustand';
import type { Conversation, Message, MessageAttachment, SharedObject } from '@/types';
import { apiFetch } from '@/lib/api';
import { getSocket } from '@/lib/socket';

interface TypingInfo {
  uid: string;
  conversationId: string;
}

interface MessagesStore {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  hasMore: Record<string, boolean>;
  onlineUsers: Set<string>;
  typing: TypingInfo[];
  unreadTotal: number;

  // Actions
  loadConversations: () => Promise<void>;
  openConversation: (convId: string) => Promise<void>;
  loadMoreMessages: (convId: string) => Promise<void>;
  startConversationWith: (participantUid: string) => Promise<Conversation>;
  sendMessage: (convId: string, content: string, attachments?: MessageAttachment[], sharedObject?: SharedObject) => Promise<void>;
  uploadMedia: (file: File) => Promise<MessageAttachment>;
  setActiveConversation: (id: string | null) => void;

  // Group actions
  createGroup: (name: string, participantUids: string[]) => Promise<Conversation>;
  updateGroup: (convId: string, patch: { name?: string; groupAvatarUrl?: string | null }) => Promise<Conversation>;
  addGroupMembers: (convId: string, uids: string[]) => Promise<Conversation>;
  removeGroupMember: (convId: string, uid: string) => Promise<void>;
  promoteAdmin: (convId: string, uid: string, promote: boolean) => Promise<Conversation>;
  deleteGroup: (convId: string) => Promise<void>;

  // Socket event handlers
  _onNewMessage: (msg: Message) => void;
  _onConversationUpdated: (partial: Partial<Conversation> & { _id: string }) => void;
  _onUserStatus: (info: { uid: string; online: boolean }) => void;
  _onTyping: (info: { convId: string; uid: string; isTyping: boolean }) => void;
  _onGroupUpdated: (conv: Conversation) => void;
  _onConversationAdded: (conv: Conversation) => void;
  _onConversationRemoved: (info: { convId: string }) => void;
}

export const useMessagesStore = create<MessagesStore>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  hasMore: {},
  onlineUsers: new Set(),
  typing: [],
  unreadTotal: 0,

  loadConversations: async () => {
    try {
      const convs = await apiFetch<Conversation[]>('/api/messages/conversations', { auth: true });
      const myUid = getUserUid();
      const total = convs.reduce((sum, c) => sum + (myUid ? (c.unread?.[myUid] ?? 0) : 0), 0);
      set({ conversations: convs, unreadTotal: total });
    } catch { /* silent */ }
  },

  openConversation: async (convId: string) => {
    set({ activeConversationId: convId });
    getSocket().emit('join', convId);
    getSocket().emit('read', convId);
    apiFetch(`/api/messages/conversations/${convId}/read`, { method: 'PATCH', auth: true }).catch(() => {});
    const myUid = getUserUid() ?? '';
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c._id === convId ? { ...c, unread: { ...c.unread, [myUid]: 0 } } : c
      ),
      unreadTotal: Math.max(
        0,
        s.unreadTotal - (s.conversations.find((c) => c._id === convId)?.unread?.[myUid] ?? 0)
      ),
    }));
    if (!get().messages[convId]) {
      await loadMessages(convId, set, get);
    }
  },

  loadMoreMessages: async (convId: string) => {
    const msgs = get().messages[convId];
    if (!msgs?.length) return;
    const cursor = msgs[0]._id;
    const older = await apiFetch<Message[]>(
      `/api/messages/conversations/${convId}/messages?before=${cursor}&limit=30`,
      { auth: true }
    );
    set((s) => ({
      messages: { ...s.messages, [convId]: [...older, ...(s.messages[convId] ?? [])] },
      hasMore: { ...s.hasMore, [convId]: older.length === 30 },
    }));
  },

  startConversationWith: async (participantUid: string) => {
    const conv = await apiFetch<Conversation>('/api/messages/conversations', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ participantUid }),
    });
    set((s) => {
      const exists = s.conversations.find((c) => c._id === conv._id);
      return exists ? s : { conversations: [conv, ...s.conversations] };
    });
    return conv;
  },

  sendMessage: async (convId: string, content: string, attachments?: MessageAttachment[], sharedObject?: SharedObject) => {
    const trimmed = content.trim();
    if (!trimmed && (!attachments?.length) && !sharedObject) return;
    getSocket().emit('message', {
      convId,
      content: trimmed,
      ...(attachments?.length && { attachments }),
      ...(sharedObject && { sharedObject }),
    });
  },

  uploadMedia: async (file: File): Promise<MessageAttachment> => {
    const form = new FormData();
    form.append('file', file);
    return apiFetch<MessageAttachment>('/api/messages/upload', {
      method: 'POST',
      auth: true,
      body: form,
    });
  },

  setActiveConversation: (id) => {
    const prev = get().activeConversationId;
    if (prev && prev !== id) getSocket().emit('leave', prev);
    set({ activeConversationId: id });
  },

  // ── Group actions ─────────────────────────────────────────────────────────────

  createGroup: async (name, participantUids) => {
    const conv = await apiFetch<Conversation>('/api/messages/groups', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ name, participantUids }),
    });
    set((s) => ({ conversations: [conv, ...s.conversations] }));
    return conv;
  },

  updateGroup: async (convId, patch) => {
    const updated = await apiFetch<Conversation>(`/api/messages/groups/${convId}`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify({ name: patch.name, groupAvatarUrl: patch.groupAvatarUrl }),
    });
    set((s) => ({
      conversations: s.conversations.map((c) => (c._id === convId ? updated : c)),
    }));
    return updated;
  },

  addGroupMembers: async (convId, uids) => {
    const updated = await apiFetch<Conversation>(`/api/messages/groups/${convId}/members`, {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ uids }),
    });
    set((s) => ({
      conversations: s.conversations.map((c) => (c._id === convId ? updated : c)),
    }));
    return updated;
  },

  removeGroupMember: async (convId, uid) => {
    await apiFetch(`/api/messages/groups/${convId}/members/${uid}`, {
      method: 'DELETE',
      auth: true,
    });
    // If self-leave: remove conversation from list
    const myUid = getUserUid();
    if (uid === myUid) {
      const prev = get().activeConversationId;
      if (prev === convId) {
        getSocket().emit('leave', convId);
        set({ activeConversationId: null });
      }
      set((s) => ({ conversations: s.conversations.filter((c) => c._id !== convId) }));
    }
  },

  promoteAdmin: async (convId, uid, promote) => {
    const updated = await apiFetch<Conversation>(`/api/messages/groups/${convId}/admins/${uid}`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify({ promote }),
    });
    set((s) => ({
      conversations: s.conversations.map((c) => (c._id === convId ? updated : c)),
    }));
    return updated;
  },

  deleteGroup: async (convId) => {
    await apiFetch(`/api/messages/groups/${convId}`, { method: 'DELETE', auth: true });
    const prev = get().activeConversationId;
    if (prev === convId) {
      getSocket().emit('leave', convId);
      set({ activeConversationId: null });
    }
    set((s) => ({ conversations: s.conversations.filter((c) => c._id !== convId) }));
  },

  // ── Socket handlers ───────────────────────────────────────────────────────────

  _onNewMessage: (msg) => {
    const convId = String(msg.conversationId);
    set((s) => {
      const existing = s.messages[convId] ?? [];
      if (existing.some((m) => m._id === msg._id)) return s;
      // Build a meaningful preview for conversations list
      const previewContent =
        msg.content ||
        (msg.attachments?.length
          ? msg.attachments[0].type === 'video' ? '🎥 Vidéo' : '📷 Photo'
          : null) ||
        (msg.sharedObject?.type === 'spot' ? '📍 Spot partagé' : null) ||
        (msg.sharedObject?.type === 'route' ? '🧗 Voie partagée' : null) ||
        '';
      return {
        messages: { ...s.messages, [convId]: [...existing, msg] },
        conversations: s.conversations.map((c) =>
          c._id === convId
            ? { ...c, lastMessage: { content: previewContent, senderUid: msg.senderUid, createdAt: msg.createdAt }, updatedAt: msg.createdAt }
            : c
        ),
      };
    });
  },

  _onConversationUpdated: (partial) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c._id === partial._id ? { ...c, ...partial } : c
      ),
    }));
  },

  _onUserStatus: ({ uid, online }) => {
    set((s) => {
      const next = new Set(s.onlineUsers);
      online ? next.add(uid) : next.delete(uid);
      return { onlineUsers: next };
    });
  },

  _onTyping: ({ convId, uid, isTyping }) => {
    set((s) => {
      const filtered = s.typing.filter((t) => !(t.uid === uid && t.conversationId === convId));
      return { typing: isTyping ? [...filtered, { uid, conversationId: convId }] : filtered };
    });
    if (isTyping) {
      setTimeout(() => {
        set((s) => ({
          typing: s.typing.filter((t) => !(t.uid === uid && t.conversationId === convId)),
        }));
      }, 3000);
    }
  },

  _onGroupUpdated: (conv) => {
    set((s) => ({
      conversations: s.conversations.map((c) => (c._id === conv._id ? conv : c)),
    }));
  },

  _onConversationAdded: (conv) => {
    set((s) => {
      const exists = s.conversations.find((c) => c._id === conv._id);
      if (exists) return s;
      return { conversations: [conv, ...s.conversations] };
    });
  },

  _onConversationRemoved: ({ convId }) => {
    const prev = get().activeConversationId;
    if (prev === convId) {
      getSocket().emit('leave', convId);
      set({ activeConversationId: null });
    }
    set((s) => ({ conversations: s.conversations.filter((c) => c._id !== convId) }));
  },
}));

function getUserUid(): string | null {
  try {
    const auth = JSON.parse(localStorage.getItem('auth') || 'null');
    return auth?.user?._id ?? null;
  } catch {
    return null;
  }
}

async function loadMessages(
  convId: string,
  set: (fn: (s: MessagesStore) => Partial<MessagesStore>) => void,
  _get: () => MessagesStore
) {
  try {
    const msgs = await apiFetch<Message[]>(
      `/api/messages/conversations/${convId}/messages?limit=30`,
      { auth: true }
    );
    set((s) => ({
      messages: { ...s.messages, [convId]: msgs },
      hasMore: { ...s.hasMore, [convId]: msgs.length === 30 },
    }));
  } catch { /* silent */ }
}
