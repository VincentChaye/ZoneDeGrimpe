// frontend-react/src/stores/messages.store.ts
import { create } from 'zustand';
import type { Conversation, Message } from '@/types';
import { apiFetch } from '@/lib/api';
import { getSocket } from '@/lib/socket';

interface TypingInfo {
  uid: string;
  conversationId: string;
}

interface MessagesStore {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>; // conversationId → messages[]
  hasMore: Record<string, boolean>;    // conversationId → bool
  onlineUsers: Set<string>;
  typing: TypingInfo[];
  unreadTotal: number;

  // Actions
  loadConversations: () => Promise<void>;
  openConversation: (convId: string) => Promise<void>;
  loadMoreMessages: (convId: string) => Promise<void>;
  startConversationWith: (participantUid: string) => Promise<Conversation>;
  sendMessage: (convId: string, content: string) => Promise<void>;
  setActiveConversation: (id: string | null) => void;

  // Socket event handlers
  _onNewMessage: (msg: Message) => void;
  _onConversationUpdated: (partial: Partial<Conversation> & { _id: string }) => void;
  _onUserStatus: (info: { uid: string; online: boolean }) => void;
  _onTyping: (info: { convId: string; uid: string; isTyping: boolean }) => void;
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
      const total = convs.reduce((sum, c) => {
        const myUid = getUserUid();
        return sum + (myUid ? (c.unread?.[myUid] ?? 0) : 0);
      }, 0);
      set({ conversations: convs, unreadTotal: total });
    } catch { /* silent */ }
  },

  openConversation: async (convId: string) => {
    set({ activeConversationId: convId });
    // Join socket room
    getSocket().emit('join', convId);
    // Mark as read
    getSocket().emit('read', convId);
    apiFetch(`/api/messages/conversations/${convId}/read`, { method: 'PATCH', auth: true }).catch(() => {});
    // Reset unread in store
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c._id === convId ? { ...c, unread: { ...c.unread, [getUserUid() ?? '']: 0 } } : c
      ),
      unreadTotal: Math.max(0, s.unreadTotal - (s.conversations.find((c) => c._id === convId)?.unread?.[getUserUid() ?? ''] ?? 0)),
    }));
    // Load messages if not already loaded
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
      return exists
        ? s
        : { conversations: [conv, ...s.conversations] };
    });
    return conv;
  },

  sendMessage: async (convId: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    // Optimistic: emit via socket (server will broadcast back)
    getSocket().emit('message', { convId, content: trimmed });
  },

  setActiveConversation: (id) => {
    const prev = get().activeConversationId;
    if (prev && prev !== id) getSocket().emit('leave', prev);
    set({ activeConversationId: id });
  },

  _onNewMessage: (msg) => {
    const convId = String(msg.conversationId);
    set((s) => {
      const existing = s.messages[convId] ?? [];
      // Avoid duplicate
      if (existing.some((m) => m._id === msg._id)) return s;
      return {
        messages: { ...s.messages, [convId]: [...existing, msg] },
        conversations: s.conversations.map((c) =>
          c._id === convId
            ? { ...c, lastMessage: { content: msg.content, senderUid: msg.senderUid, createdAt: msg.createdAt }, updatedAt: msg.createdAt }
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
}));

// Helpers
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
