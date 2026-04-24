import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Send, ArrowLeft, MessageSquare, Plus, Search, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useMessagesStore } from '@/stores/messages.store';
import { apiFetch } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import type { Conversation, Message } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function Avatar({ name, src, size = 10 }: { name: string; src?: string | null; size?: number }) {
  const initial = (name || '?')[0].toUpperCase();
  const cls = `h-${size} w-${size} rounded-2xl object-cover`;
  if (src) return <img src={src} alt={name} className={cls} />;
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-2xl bg-sage text-white font-semibold shrink-0 text-sm',
        `h-${size} w-${size}`
      )}
    >
      {initial}
    </div>
  );
}

// ─── ConversationList ─────────────────────────────────────────────────────────

interface ConversationListProps {
  myUid: string;
  conversations: Conversation[];
  activeId: string | null;
  onlineUsers: Set<string>;
  onSelect: (conv: Conversation) => void;
  onNew: () => void;
}

function ConversationList({ myUid, conversations, activeId, onlineUsers, onSelect, onNew }: ConversationListProps) {
  const { t } = useTranslation();

  const getOther = (conv: Conversation) =>
    conv.participantInfo.find((p) => p.uid !== myUid) ?? conv.participantInfo[0];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h2 className="font-heading text-base font-bold text-text-primary">{t('nav.messages')}</h2>
        <button
          onClick={onNew}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-sage/10 text-sage hover:bg-sage/20 transition-colors"
          aria-label={t('messages.new')}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sage/10">
              <MessageSquare className="h-7 w-7 text-sage" />
            </div>
            <p className="text-sm text-text-secondary">{t('messages.empty')}</p>
            <button
              onClick={onNew}
              className="rounded-xl bg-sage px-4 py-2 text-sm font-semibold text-white hover:bg-sage-hover transition-colors"
            >
              {t('messages.start_first')}
            </button>
          </div>
        ) : (
          conversations.map((conv) => {
            const other = getOther(conv);
            const unread = conv.unread?.[myUid] ?? 0;
            const isOnline = onlineUsers.has(other.uid);
            const isActive = conv._id === activeId;

            return (
              <button
                key={conv._id}
                onClick={() => onSelect(conv)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2',
                  isActive && 'bg-surface-2'
                )}
              >
                <div className="relative shrink-0">
                  <Avatar name={other.displayName} src={other.avatarUrl} size={10} />
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface bg-green-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('truncate text-sm', unread > 0 ? 'font-semibold text-text-primary' : 'font-medium text-text-primary')}>
                      {other.displayName}
                    </span>
                    {conv.lastMessage && (
                      <span className="shrink-0 text-[10px] text-text-secondary">
                        {formatTime(conv.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={cn('truncate text-xs', unread > 0 ? 'font-medium text-text-primary' : 'text-text-secondary')}>
                      {conv.lastMessage
                        ? (conv.lastMessage.senderUid === myUid ? `${t('messages.you')}: ` : '') + conv.lastMessage.content
                        : t('messages.no_messages')}
                    </p>
                    {unread > 0 && (
                      <span className="shrink-0 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-sage px-1 text-[10px] font-bold text-white">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── ChatView ────────────────────────────────────────────────────────────────

interface ChatViewProps {
  myUid: string;
  conversation: Conversation;
  messages: Message[];
  hasMore: boolean;
  typing: boolean;
  isOnline: boolean;
  onBack: () => void;
  onLoadMore: () => void;
}

function ChatView({ myUid, conversation, messages, hasMore, typing, isOnline, onBack, onLoadMore }: ChatViewProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { sendMessage } = useMessagesStore();

  const other = conversation.participantInfo.find((p) => p.uid !== myUid) ?? conversation.participantInfo[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage(conversation._id, trimmed);
    setInput('');
    inputRef.current?.focus();
  }, [input, conversation._id, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
      getSocket().emit('typing', { convId: conversation._id, isTyping: true });
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      setIsTyping(false);
      getSocket().emit('typing', { convId: conversation._id, isTyping: false });
    }, 2000);
  };

  // Group messages by date
  const grouped: { date: string; msgs: Message[] }[] = [];
  for (const msg of messages) {
    const date = new Date(msg.createdAt).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
    const last = grouped[grouped.length - 1];
    if (last?.date === date) last.msgs.push(msg);
    else grouped.push({ date, msgs: [msg] });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
        <button
          onClick={onBack}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-2 transition-colors md:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Link
          to={`/profile?id=${other.uid}`}
          className="flex items-center gap-3 min-w-0 flex-1 no-underline group"
        >
          <div className="relative shrink-0">
            <Avatar name={other.displayName} src={other.avatarUrl} size={9} />
            {isOnline && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface bg-green-500" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary group-hover:text-sage transition-colors">{other.displayName}</p>
            <p className="text-[10px] text-text-secondary">
              {isOnline ? t('messages.online') : t('messages.offline')}
            </p>
          </div>
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {hasMore && (
          <button
            onClick={onLoadMore}
            className="mx-auto flex rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-2 transition-colors"
          >
            {t('messages.load_more')}
          </button>
        )}

        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            <div className="flex items-center gap-2 py-2">
              <div className="flex-1 h-px bg-stone-100 dark:bg-zinc-700" />
              <span className="text-[10px] text-text-secondary">{date}</span>
              <div className="flex-1 h-px bg-stone-100 dark:bg-zinc-700" />
            </div>
            {msgs.map((msg, i) => {
              const isMine = msg.senderUid === myUid;
              const prevMsg = i > 0 ? msgs[i - 1] : null;
              const showAvatar = !isMine && prevMsg?.senderUid !== msg.senderUid;

              return (
                <div
                  key={msg._id}
                  className={cn(
                    'flex items-end gap-2 mb-1',
                    isMine ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  {!isMine && (
                    <div className="w-6 shrink-0">
                      {showAvatar && <Avatar name={other.displayName} src={other.avatarUrl} size={6} />}
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[70%] rounded-2xl px-3 py-2 text-sm',
                      isMine
                        ? 'rounded-br-sm bg-sage text-white'
                        : 'rounded-bl-sm bg-stone-100 dark:bg-zinc-700 text-text-primary'
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className={cn('mt-0.5 text-right text-[10px]', isMine ? 'text-white/60' : 'text-text-secondary')}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {typing && (
          <div className="flex items-end gap-2">
            <div className="w-6 shrink-0">
              <Avatar name={other.displayName} src={other.avatarUrl} size={6} />
            </div>
            <div className="rounded-2xl rounded-bl-sm bg-stone-100 dark:bg-zinc-700 px-3 py-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-text-secondary animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={t('messages.type_message')}
            maxLength={2000}
            className="flex-1 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-sage focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage text-white transition-colors hover:bg-sage-hover disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── NewConversationModal ─────────────────────────────────────────────────────

interface NewConversationModalProps {
  onClose: () => void;
  onSelect: (uid: string) => void;
}

interface UserSearchResult {
  _id: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
}

function NewConversationModal({ onClose, onSelect }: NewConversationModalProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiFetch<UserSearchResult[]>(
          `/api/users/search?q=${encodeURIComponent(query.trim())}`,
          { auth: true }
        );
        setResults(data ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <>
      {/* Mobile: full-screen overlay so the keyboard doesn't bury the search bar */}
      <div className="fixed inset-0 z-50 flex flex-col bg-surface sm:hidden">
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h3 className="font-heading text-sm font-bold text-text-primary">{t('messages.new')}</h3>
        </div>
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 overflow-hidden rounded-xl border border-border-subtle bg-surface-2 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-text-secondary" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('messages.search_user')}
              className="min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto pb-4">
          {loading && <p className="px-4 py-3 text-xs text-text-secondary">{t('common.loading')}</p>}
          {!loading && query && results.length === 0 && (
            <p className="px-4 py-3 text-xs text-text-secondary">{t('messages.no_users_found')}</p>
          )}
          {results.map((u) => (
            <button
              key={u._id}
              onClick={() => onSelect(u._id)}
              className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors"
            >
              <Avatar name={u.displayName} src={u.avatarUrl} size={8} />
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-medium text-text-primary">{u.displayName}</p>
                {u.username && <p className="truncate text-xs text-text-secondary">@{u.username}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: centered modal */}
      <div className="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 sm:flex" onClick={onClose}>
        <div
          className="w-full max-w-sm rounded-2xl bg-surface shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <h3 className="font-heading text-sm font-bold text-text-primary">{t('messages.new')}</h3>
            <button onClick={onClose} className="text-xs text-text-secondary hover:text-text-primary">{t('common.cancel')}</button>
          </div>
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2">
              <Search className="h-4 w-4 text-text-secondary shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('messages.search_user')}
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto pb-4">
            {loading && <p className="px-4 py-3 text-xs text-text-secondary">{t('common.loading')}</p>}
            {!loading && query && results.length === 0 && (
              <p className="px-4 py-3 text-xs text-text-secondary">{t('messages.no_users_found')}</p>
            )}
            {results.map((u) => (
              <button
                key={u._id}
                onClick={() => onSelect(u._id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors"
              >
                <Avatar name={u.displayName} src={u.avatarUrl} size={8} />
                <div className="text-left">
                  <p className="text-sm font-medium text-text-primary">{u.displayName}</p>
                  {u.username && <p className="text-xs text-text-secondary">@{u.username}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── MessagesPage ─────────────────────────────────────────────────────────────

export function MessagesPage() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const {
    conversations, activeConversationId, messages, hasMore,
    onlineUsers, typing, openConversation, loadMoreMessages,
    startConversationWith, setActiveConversation,
  } = useMessagesStore();

  const [showNewModal, setShowNewModal] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [creatingConv, setCreatingConv] = useState(false);

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-text-secondary">{t('toast.login_required')}</p>
        <Link
          to="/login"
          className="rounded-xl bg-sage px-4 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-sage-hover"
        >
          {t('auth.login')}
        </Link>
      </div>
    );
  }

  const myUid = user._id;

  const activeConv = conversations.find((c) => c._id === activeConversationId) ?? null;
  const activeMessages = activeConversationId ? (messages[activeConversationId] ?? []) : [];
  const activeHasMore = activeConversationId ? (hasMore[activeConversationId] ?? false) : false;

  const otherTyping = activeConversationId
    ? typing.some((t) => t.conversationId === activeConversationId && t.uid !== myUid)
    : false;

  const otherUid = activeConv?.participants.find((p) => p !== myUid);
  const otherIsOnline = otherUid ? onlineUsers.has(otherUid) : false;

  async function handleSelectConversation(conv: Conversation) {
    await openConversation(conv._id);
    setMobileShowChat(true);
  }

  async function handleNewConversation(participantUid: string) {
    setShowNewModal(false);
    setCreatingConv(true);
    setMobileShowChat(true);
    try {
      const conv = await startConversationWith(participantUid);
      await openConversation(conv._id);
    } catch {
      setMobileShowChat(false);
    } finally {
      setCreatingConv(false);
    }
  }

  function handleBack() {
    setMobileShowChat(false);
    setCreatingConv(false);
    setActiveConversation(null);
  }

  return (
    <div
      className="flex md:h-[calc(100dvh-var(--spacing-header))]"
      style={{ height: 'calc(100dvh - var(--spacing-header) - var(--spacing-tabbar) - env(safe-area-inset-bottom))' }}
    >
      {showNewModal && (
        <NewConversationModal
          onClose={() => setShowNewModal(false)}
          onSelect={handleNewConversation}
        />
      )}

      {/* ── Mobile: list OR chat ── */}
      <div className="flex w-full md:hidden">
        {!mobileShowChat ? (
          <div className="w-full">
            <ConversationList
              myUid={myUid}
              conversations={conversations}
              activeId={activeConversationId}
              onlineUsers={onlineUsers}
              onSelect={handleSelectConversation}
              onNew={() => setShowNewModal(true)}
            />
          </div>
        ) : activeConv ? (
          <div className="w-full">
            <ChatView
              myUid={myUid}
              conversation={activeConv}
              messages={activeMessages}
              hasMore={activeHasMore}
              typing={otherTyping}
              isOnline={otherIsOnline}
              onBack={handleBack}
              onLoadMore={() => loadMoreMessages(activeConv._id)}
            />
          </div>
        ) : creatingConv ? (
          <div className="flex h-full w-full flex-col">
            <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
              <button
                onClick={handleBack}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-2 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="h-4 w-32 rounded-lg bg-surface-2 animate-pulse" />
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center px-6">
              <Loader2 className="h-8 w-8 animate-spin text-sage" />
              <p className="text-sm text-text-secondary">{t('messages.opening')}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Desktop: 2-column ── */}
      <div className="hidden md:flex w-full">
        <div className="w-80 shrink-0 border-r border-border-subtle">
          <ConversationList
            myUid={myUid}
            conversations={conversations}
            activeId={activeConversationId}
            onlineUsers={onlineUsers}
            onSelect={handleSelectConversation}
            onNew={() => setShowNewModal(true)}
          />
        </div>
        <div className="flex-1">
          {activeConv ? (
            <ChatView
              myUid={myUid}
              conversation={activeConv}
              messages={activeMessages}
              hasMore={activeHasMore}
              typing={otherTyping}
              isOnline={otherIsOnline}
              onBack={handleBack}
              onLoadMore={() => loadMoreMessages(activeConv._id)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sage/10">
                <MessageSquare className="h-8 w-8 text-sage" />
              </div>
              <p className="text-sm text-text-secondary">{t('messages.select_conversation')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
