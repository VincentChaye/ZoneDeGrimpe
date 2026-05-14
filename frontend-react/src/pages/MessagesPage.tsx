import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Send, ArrowLeft, MessageSquare, Plus, Search, Loader2,
  Settings, Users, UserPlus, UserMinus, Crown, Shield, LogOut, Trash2, Check, X, ChevronRight,
  MapPin, Image, Video, Play,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useMessagesStore } from '@/stores/messages.store';
import { useOutingStore } from '@/stores/outing.store';
import { apiFetch } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Conversation, Message, MessageAttachment, SharedObject, Spot } from '@/types';
import { OutingBanner, OutingCreateCTA } from '@/components/messages/OutingBanner';
import { OutingEditModal } from '@/components/messages/OutingEditModal';

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

function getConvDisplay(conv: Conversation, myUid: string) {
  if (conv.type === 'group') {
    return {
      name: conv.groupName ?? 'Groupe',
      avatarUrl: conv.groupAvatarUrl ?? null,
      isGroup: true,
      subtitle: null,
    };
  }
  const other = conv.participantInfo.find((p) => p.uid !== myUid) ?? conv.participantInfo[0];
  return {
    name: other?.displayName ?? '?',
    avatarUrl: other?.avatarUrl ?? null,
    isGroup: false,
    subtitle: null,
    otherUid: other?.uid,
  };
}

// ─── Avatar components ────────────────────────────────────────────────────────

function Avatar({ name, src, size = 10 }: { name: string; src?: string | null; size?: number }) {
  const initial = (name || '?')[0].toUpperCase();
  const cls = `h-${size} w-${size} rounded-2xl object-cover`;
  if (src) return <img src={src} alt={name} className={cls} />;
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-2xl bg-sage text-white font-semibold shrink-0',
        size <= 6 ? 'text-[10px]' : size <= 8 ? 'text-xs' : 'text-sm',
        `h-${size} w-${size}`
      )}
    >
      {initial}
    </div>
  );
}

function GroupAvatar({ name, members, src, size = 10 }: {
  name: string;
  members: Array<{ avatarUrl?: string | null; displayName: string }>;
  src?: string | null;
  size?: number;
}) {
  if (src) {
    return <img src={src} alt={name} className={`h-${size} w-${size} rounded-2xl object-cover`} />;
  }
  // Show stacked mini-avatars of first 2 members, or initials
  const shown = members.slice(0, 2);
  if (shown.length < 2) {
    return <Avatar name={name} size={size} />;
  }
  const mini = Math.max(size - 3, 5);
  return (
    <div className={`relative h-${size} w-${size} shrink-0`}>
      <div className={`absolute bottom-0 left-0 h-${mini} w-${mini} rounded-xl ring-2 ring-surface overflow-hidden`}>
        <Avatar name={shown[1].displayName} src={shown[1].avatarUrl} size={mini} />
      </div>
      <div className={`absolute top-0 right-0 h-${mini} w-${mini} rounded-xl ring-2 ring-surface overflow-hidden`}>
        <Avatar name={shown[0].displayName} src={shown[0].avatarUrl} size={mini} />
      </div>
    </div>
  );
}

// ─── SpotTypeLabel ────────────────────────────────────────────────────────────

function spotTypeIcon(type: string | null | undefined) {
  switch (type) {
    case 'crag': return '⛰️';
    case 'boulder': return '🪨';
    case 'indoor': return '🏛️';
    case 'shop': return '🏪';
    default: return '📍';
  }
}

// ─── SharedObjectCard ─────────────────────────────────────────────────────────

function SharedObjectCard({ obj, isMine }: { obj: SharedObject; isMine: boolean }) {
  const { t } = useTranslation();
  if (obj.type === 'spot') {
    return (
      <Link
        to={`/spot/${obj.id}`}
        className={cn(
          'mt-1 flex items-center gap-2 rounded-xl border p-2.5 transition-colors no-underline',
          isMine
            ? 'border-white/20 bg-white/10 hover:bg-white/20'
            : 'border-border-subtle bg-surface hover:bg-surface-2'
        )}
      >
        <div className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg',
          isMine ? 'bg-white/15' : 'bg-sage/10'
        )}>
          {spotTypeIcon(obj.spotType)}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-xs font-semibold', isMine ? 'text-white' : 'text-text-primary')}>
            {obj.name}
          </p>
          {obj.subtitle && (
            <p className={cn('truncate text-[10px]', isMine ? 'text-white/60' : 'text-text-secondary')}>
              {obj.subtitle}
            </p>
          )}
          <p className={cn('text-[10px] mt-0.5', isMine ? 'text-white/50' : 'text-sage')}>
            {t('messages.share_view_spot')}
          </p>
        </div>
        <ChevronRight className={cn('h-3.5 w-3.5 shrink-0', isMine ? 'text-white/50' : 'text-text-secondary')} />
      </Link>
    );
  }
  if (obj.type === 'route') {
    return (
      <div className={cn(
        'mt-1 flex items-center gap-2 rounded-xl border p-2.5',
        isMine ? 'border-white/20 bg-white/10' : 'border-border-subtle bg-surface'
      )}>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg', isMine ? 'bg-white/15' : 'bg-sage/10')}>
          🧗
        </div>
        <div className="min-w-0">
          <p className={cn('truncate text-xs font-semibold', isMine ? 'text-white' : 'text-text-primary')}>{obj.name}</p>
          {obj.grade && (
            <p className={cn('text-[10px]', isMine ? 'text-white/60' : 'text-text-secondary')}>{obj.grade}</p>
          )}
        </div>
      </div>
    );
  }
  return null;
}

// ─── AttachmentBubble ─────────────────────────────────────────────────────────

function AttachmentBubble({ att, isMine }: { att: MessageAttachment; isMine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (att.type === 'image') {
    return (
      <a href={att.url} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img
          src={att.url}
          alt=""
          className="max-w-[220px] rounded-xl object-cover cursor-zoom-in"
          style={{ maxHeight: 220 }}
        />
      </a>
    );
  }

  if (att.type === 'video') {
    return (
      <div className="mt-1 relative rounded-xl overflow-hidden" style={{ maxWidth: 220 }}>
        <video
          ref={videoRef}
          src={att.url}
          controls={playing}
          className="w-full rounded-xl"
          style={{ maxHeight: 180 }}
          onEnded={() => setPlaying(false)}
        />
        {!playing && (
          <button
            onClick={() => { setPlaying(true); videoRef.current?.play(); }}
            className={cn(
              'absolute inset-0 flex items-center justify-center rounded-xl',
              isMine ? 'bg-black/20' : 'bg-black/10'
            )}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow">
              <Play className="h-4 w-4 text-stone-800 ml-0.5" />
            </div>
          </button>
        )}
      </div>
    );
  }

  return null;
}

// ─── SpotSearchModal ──────────────────────────────────────────────────────────

interface SpotSearchModalProps {
  onClose: () => void;
  onSelect: (spot: SharedObject) => void;
}

function SpotSearchModal({ onClose, onSelect }: SpotSearchModalProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiFetch<Spot[]>(
          `/api/spots?name=${encodeURIComponent(query.trim())}&format=flat&limit=10`
        );
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const content = (
    <>
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-text-secondary" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('messages.share_search_spot')}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-4 px-4 space-y-1">
        {loading && <p className="py-2 text-xs text-text-secondary">{t('common.loading')}</p>}
        {!loading && query && results.length === 0 && (
          <p className="py-2 text-xs text-text-secondary">{t('messages.share_no_spots')}</p>
        )}
        {results.map((spot) => {
          const subtitleParts: string[] = [];
          if (spot.niveau_min || spot.niveau_max) {
            subtitleParts.push(`${spot.niveau_min ?? '?'} → ${spot.niveau_max ?? '?'}`);
          }
          return (
            <button
              key={spot.id}
              onClick={() => onSelect({
                type: 'spot',
                id: spot.id,
                name: spot.name,
                subtitle: subtitleParts.join(' · ') || null,
                imageUrl: spot.photos?.[0]?.url ?? null,
                spotType: spot.type,
              })}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface-2 transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sage/10 text-base">
                {spotTypeIcon(spot.type)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{spot.name}</p>
                {subtitleParts.length > 0 && (
                  <p className="truncate text-xs text-text-secondary">{subtitleParts.join(' · ')}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile */}
      <div className="fixed inset-0 z-[60] flex flex-col bg-surface sm:hidden">
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
          <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-2 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h3 className="font-heading text-sm font-bold text-text-primary">{t('messages.share_spot_title')}</h3>
        </div>
        {content}
      </div>
      {/* Desktop */}
      <div className="fixed inset-0 z-[60] hidden items-center justify-center bg-black/40 sm:flex" onClick={onClose}>
        <div className="w-full max-w-sm rounded-2xl bg-surface shadow-xl flex flex-col max-h-[70vh]" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3 shrink-0">
            <h3 className="font-heading text-sm font-bold text-text-primary">{t('messages.share_spot_title')}</h3>
            <button onClick={onClose} className="text-xs text-text-secondary hover:text-text-primary">{t('common.cancel')}</button>
          </div>
          {content}
        </div>
      </div>
    </>
  );
}

// ─── UserSearchResult ─────────────────────────────────────────────────────────

interface UserSearchResult {
  _id: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
}

function useUserSearch() {
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

  return { query, setQuery, results, loading };
}

// ─── ConversationList ─────────────────────────────────────────────────────────

interface ConversationListProps {
  myUid: string;
  conversations: Conversation[];
  activeId: string | null;
  onlineUsers: Set<string>;
  onSelect: (conv: Conversation) => void;
  onNew: () => void;
  onNewGroup: () => void;
}

function ConversationList({ myUid, conversations, activeId, onlineUsers, onSelect, onNew, onNewGroup }: ConversationListProps) {
  const { t } = useTranslation();
  const [showNewMenu, setShowNewMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowNewMenu(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h2 className="font-heading text-base font-bold text-text-primary">{t('nav.messages')}</h2>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowNewMenu((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-sage/10 text-sage hover:bg-sage/20 transition-colors"
            aria-label={t('messages.new')}
          >
            <Plus className="h-4 w-4" />
          </button>
          {showNewMenu && (
            <div className="absolute right-0 top-9 z-30 min-w-[160px] rounded-xl border border-border-subtle bg-surface shadow-lg">
              <button
                onClick={() => { setShowNewMenu(false); onNew(); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-2 transition-colors rounded-t-xl"
              >
                <MessageSquare className="h-4 w-4 text-sage shrink-0" />
                {t('messages.new')}
              </button>
              <button
                onClick={() => { setShowNewMenu(false); onNewGroup(); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-2 transition-colors rounded-b-xl"
              >
                <Users className="h-4 w-4 text-sage shrink-0" />
                {t('messages.new_group')}
              </button>
            </div>
          )}
        </div>
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
            const display = getConvDisplay(conv, myUid);
            const unread = conv.unread?.[myUid] ?? 0;
            const isActive = conv._id === activeId;
            const isOnline = !display.isGroup && display.otherUid
              ? onlineUsers.has(display.otherUid)
              : false;

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
                  {display.isGroup ? (
                    <GroupAvatar
                      name={display.name}
                      members={conv.participantInfo.filter((p) => p.uid !== myUid)}
                      src={display.avatarUrl}
                      size={10}
                    />
                  ) : (
                    <Avatar name={display.name} src={display.avatarUrl} size={10} />
                  )}
                  {isOnline && !display.isGroup && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface bg-green-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('truncate text-sm', unread > 0 ? 'font-semibold text-text-primary' : 'font-medium text-text-primary')}>
                      {display.name}
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
                        : display.isGroup
                          ? t('messages.members_count', { count: conv.participants.length })
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
  typingUids: string[];
  isOnline: boolean;
  onBack: () => void;
  onLoadMore: () => void;
  onOpenSettings: () => void;
}

function ChatView({ myUid, conversation, messages, hasMore, typingUids, isOnline, onBack, onLoadMore, onOpenSettings }: ChatViewProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [pendingShared, setPendingShared] = useState<SharedObject | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showSpotModal, setShowSpotModal] = useState(false);
  const [showOutingCreate, setShowOutingCreate] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { sendMessage, uploadMedia } = useMessagesStore();
  const { activeByConv, ensureLoaded, createOuting } = useOutingStore();

  useEffect(() => { ensureLoaded(conversation._id); }, [conversation._id, ensureLoaded]);

  const activeOuting = activeByConv[conversation._id] ?? null;
  const canEditOuting = !!(activeOuting && (
    activeOuting.createdBy === myUid ||
    conversation.type !== 'group' ||
    (conversation.admins?.includes(myUid) ?? false)
  ));

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const isGroup = conversation.type === 'group';
  const display = getConvDisplay(conversation, myUid);

  const typingNames = typingUids.map((uid) => {
    const info = conversation.participantInfo.find((p) => p.uid === uid);
    return info?.displayName ?? uid;
  });

  function getTypingText() {
    if (typingNames.length === 0) return null;
    if (typingNames.length === 1) return t('messages.is_typing_one', { name: typingNames[0] });
    if (typingNames.length === 2) return t('messages.is_typing_two', { name1: typingNames[0], name2: typingNames[1] });
    return t('messages.is_typing_many');
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed && pendingAttachments.length === 0 && !pendingShared) return;
    sendMessage(conversation._id, trimmed, pendingAttachments.length > 0 ? pendingAttachments : undefined, pendingShared ?? undefined);
    setInput('');
    setPendingAttachments([]);
    setPendingShared(null);
    inputRef.current?.focus();
  }, [input, pendingAttachments, pendingShared, conversation._id, sendMessage]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = '';
    setUploading(true);
    try {
      const uploaded = await Promise.all(files.slice(0, 5).map((f) => uploadMedia(f)));
      setPendingAttachments((prev) => [...prev, ...uploaded].slice(0, 5));
    } catch {
      toast.error(t('messages.upload_error'));
    } finally {
      setUploading(false);
    }
  }, [uploadMedia, t]);

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

  const grouped: { date: string; msgs: Message[] }[] = [];
  for (const msg of messages) {
    const date = new Date(msg.createdAt).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
    const last = grouped[grouped.length - 1];
    if (last?.date === date) last.msgs.push(msg);
    else grouped.push({ date, msgs: [msg] });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
        <button
          onClick={onBack}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-2 transition-colors md:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {isGroup ? (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <GroupAvatar
              name={display.name}
              members={conversation.participantInfo.filter((p) => p.uid !== myUid)}
              src={display.avatarUrl}
              size={9}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">{display.name}</p>
              <p className="text-[10px] text-text-secondary">
                {t('messages.members_count', { count: conversation.participants.length })}
              </p>
            </div>
          </div>
        ) : (
          <Link
            to={`/profile?id=${conversation.participantInfo.find((p) => p.uid !== myUid)?.uid}`}
            className="flex items-center gap-3 min-w-0 flex-1 no-underline group"
          >
            <div className="relative shrink-0">
              <Avatar name={display.name} src={display.avatarUrl} size={9} />
              {isOnline && (
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface bg-green-500" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary group-hover:text-sage transition-colors">{display.name}</p>
              <p className="text-[10px] text-text-secondary">
                {isOnline ? t('messages.online') : t('messages.offline')}
              </p>
            </div>
          </Link>
        )}

        {isGroup && (
          <button
            onClick={onOpenSettings}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-2 transition-colors"
            aria-label={t('messages.group_settings')}
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Outing banner */}
      {activeOuting ? (
        <OutingBanner
          outing={activeOuting}
          convId={conversation._id}
          myUid={myUid}
          canEdit={canEditOuting}
        />
      ) : (
        <OutingCreateCTA
          convId={conversation._id}
          onCreate={() => setShowOutingCreate(true)}
        />
      )}

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
              <div className="flex-1 h-px bg-border-subtle" />
              <span className="text-[10px] text-text-secondary">{date}</span>
              <div className="flex-1 h-px bg-border-subtle" />
            </div>
            {msgs.map((msg, i) => {
              // System messages (outing events)
              if (msg.systemEvent) {
                const key = msg.systemEvent.type === 'outing_created' ? 'outing.system.created' : 'outing.system.completed';
                const actor = conversation.participantInfo.find((p) => p.uid === msg.systemEvent!.actorUid)?.displayName ?? msg.systemEvent.actorUid;
                return (
                  <div key={msg._id} className="flex items-center gap-2 py-1">
                    <div className="flex-1 h-px bg-border-subtle/50" />
                    <span className="shrink-0 rounded-full bg-surface-2 px-3 py-0.5 text-[10px] text-text-secondary">
                      {t(key, { actor })}
                    </span>
                    <div className="flex-1 h-px bg-border-subtle/50" />
                  </div>
                );
              }

              const isMine = msg.senderUid === myUid;
              const prevMsg = i > 0 ? msgs[i - 1] : null;
              const senderInfo = conversation.participantInfo.find((p) => p.uid === msg.senderUid);
              const showSenderInfo = !isMine && isGroup && prevMsg?.senderUid !== msg.senderUid;
              const showAvatar = !isMine && prevMsg?.senderUid !== msg.senderUid;

              return (
                <div
                  key={msg._id}
                  className={cn('flex items-end gap-2 mb-1', isMine ? 'flex-row-reverse' : 'flex-row')}
                >
                  {!isMine && (
                    <div className="w-6 shrink-0">
                      {showAvatar && (
                        <Avatar
                          name={senderInfo?.displayName ?? '?'}
                          src={senderInfo?.avatarUrl}
                          size={6}
                        />
                      )}
                    </div>
                  )}
                  <div className={cn('flex flex-col max-w-[70%]', isMine ? 'items-end' : 'items-start')}>
                    {showSenderInfo && (
                      <span className="mb-0.5 ml-1 text-[10px] font-medium text-text-secondary">
                        {senderInfo?.displayName}
                      </span>
                    )}
                    <div
                      className={cn(
                        'rounded-2xl px-3 py-2 text-sm',
                        isMine
                          ? 'rounded-br-sm bg-sage text-white'
                          : 'rounded-bl-sm bg-surface-2 dark:bg-zinc-700 text-text-primary'
                      )}
                    >
                      {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                      {msg.attachments?.map((att, idx) => (
                        <AttachmentBubble key={idx} att={att} isMine={isMine} />
                      ))}
                      {msg.sharedObject && (
                        <SharedObjectCard obj={msg.sharedObject} isMine={isMine} />
                      )}
                      <p className={cn('mt-0.5 text-right text-[10px]', isMine ? 'text-white/60' : 'text-text-secondary')}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {typingNames.length > 0 && (
          <div className="flex items-end gap-2">
            <div className="w-6 shrink-0">
              <Avatar
                name={conversation.participantInfo.find((p) => p.uid === typingUids[0])?.displayName ?? '?'}
                src={conversation.participantInfo.find((p) => p.uid === typingUids[0])?.avatarUrl}
                size={6}
              />
            </div>
            <div className="rounded-2xl rounded-bl-sm bg-surface-2 dark:bg-zinc-700 px-3 py-2">
              {isGroup ? (
                <p className="text-[10px] text-text-secondary">{getTypingText()}</p>
              ) : (
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-text-secondary animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Spot modal */}
      {showSpotModal && (
        <SpotSearchModal
          onClose={() => setShowSpotModal(false)}
          onSelect={(spot) => { setPendingShared(spot); setShowSpotModal(false); }}
        />
      )}

      {/* Input */}
      <div className="border-t border-border-subtle px-4 py-3 space-y-2">
        {/* Pending attachments preview */}
        {(pendingAttachments.length > 0 || pendingShared) && (
          <div className="flex flex-wrap gap-2">
            {pendingAttachments.map((att, idx) => (
              <div key={idx} className="relative">
                {att.type === 'image' ? (
                  <img src={att.url} alt="" className="h-16 w-16 rounded-xl object-cover border border-border-subtle" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-2 border border-border-subtle">
                    <Video className="h-6 w-6 text-text-secondary" />
                  </div>
                )}
                <button
                  onClick={() => setPendingAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-stone-700 text-white shadow"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {pendingShared && (
              <div className="relative flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 pr-8 max-w-[220px]">
                <span className="text-base">{spotTypeIcon(pendingShared.spotType)}</span>
                <p className="truncate text-xs font-medium text-text-primary">{pendingShared.name}</p>
                <button
                  onClick={() => setPendingShared(null)}
                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-stone-700 text-white shadow"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Attach button */}
          <div className="relative" ref={attachMenuRef}>
            <button
              onClick={() => setShowAttachMenu((v) => !v)}
              disabled={uploading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-text-secondary hover:border hover:border-sage/30 hover:text-sage transition-colors disabled:opacity-40"
              aria-label={t('messages.attach')}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </button>
            {showAttachMenu && (
              <div className="absolute bottom-12 left-0 z-20 min-w-[180px] rounded-xl border border-border-subtle bg-surface shadow-lg">
                <button
                  onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-2 transition-colors rounded-t-xl"
                >
                  <Image className="h-4 w-4 text-sage shrink-0" />
                  {t('messages.attach_media')}
                </button>
                <button
                  onClick={() => { setShowAttachMenu(false); setShowSpotModal(true); }}
                  disabled={!!pendingShared}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-2 transition-colors rounded-b-xl disabled:opacity-40"
                >
                  <MapPin className="h-4 w-4 text-sage shrink-0" />
                  {t('messages.share_spot')}
                </button>
              </div>
            )}
          </div>

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
            disabled={!input.trim() && pendingAttachments.length === 0 && !pendingShared}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage text-white transition-colors hover:bg-sage-hover disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Create outing modal */}
      {showOutingCreate && (
        <OutingEditModal
          conversationId={conversation._id}
          onSave={async (title, items) => {
            await createOuting({ conversationId: conversation._id, title, items: items as Parameters<typeof createOuting>[0]['items'] });
          }}
          onClose={() => setShowOutingCreate(false)}
        />
      )}
    </div>
  );
}

// ─── GroupSettingsPanel ───────────────────────────────────────────────────────

interface GroupSettingsPanelProps {
  myUid: string;
  conversation: Conversation;
  onClose: () => void;
  onLeaveOrDelete: () => void;
}

function GroupSettingsPanel({ myUid, conversation, onClose, onLeaveOrDelete }: GroupSettingsPanelProps) {
  const { t } = useTranslation();
  const { updateGroup, addGroupMembers, removeGroupMember, promoteAdmin, deleteGroup } = useMessagesStore();

  const isAdmin = conversation.admins?.includes(myUid) ?? false;
  const isCreator = conversation.createdBy === myUid;

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(conversation.groupName ?? '');
  const [addingMembers, setAddingMembers] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<UserSearchResult[]>([]);
  const [loadingAction, setLoadingAction] = useState(false);

  const { query: searchQ, setQuery: setSearchQ, results: searchResults, loading: searchLoading } = useUserSearch();

  // Update local state when conv changes (e.g. after socket group_updated)
  useEffect(() => {
    setNameInput(conversation.groupName ?? '');
  }, [conversation.groupName]);

  async function handleSaveName() {
    if (!nameInput.trim() || nameInput.trim() === conversation.groupName) {
      setEditingName(false);
      return;
    }
    setLoadingAction(true);
    try {
      await updateGroup(conversation._id, { name: nameInput.trim() });
      setEditingName(false);
    } catch {
      toast.error('Erreur lors du renommage');
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleAddMembers() {
    if (selectedToAdd.length === 0) return;
    setLoadingAction(true);
    try {
      await addGroupMembers(conversation._id, selectedToAdd.map((u) => u._id));
      setAddingMembers(false);
      setSelectedToAdd([]);
      setSearchQ('');
    } catch {
      toast.error('Erreur lors de l\'ajout');
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleRemove(uid: string) {
    setLoadingAction(true);
    try {
      await removeGroupMember(conversation._id, uid);
      if (uid === myUid) onLeaveOrDelete();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(msg.includes('cannot_remove_creator') ? 'Impossible de retirer le créateur' : 'Erreur');
    } finally {
      setLoadingAction(false);
    }
  }

  async function handlePromote(uid: string, promote: boolean) {
    setLoadingAction(true);
    try {
      await promoteAdmin(conversation._id, uid, promote);
    } catch {
      toast.error('Erreur');
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('messages.group_delete_confirm'))) return;
    setLoadingAction(true);
    try {
      await deleteGroup(conversation._id);
      onLeaveOrDelete();
    } catch {
      toast.error('Erreur lors de la suppression');
    } finally {
      setLoadingAction(false);
    }
  }

  const existingUids = new Set(conversation.participants);
  const filteredSearch = searchResults.filter((u) => !existingUids.has(u._id) && u._id !== myUid);

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
        <button
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-2 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="font-heading text-sm font-bold text-text-primary">{t('messages.group_settings')}</h2>
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        {/* Group identity */}
        <div className="flex flex-col items-center gap-3 py-6 px-4">
          <GroupAvatar
            name={conversation.groupName ?? 'Groupe'}
            members={conversation.participantInfo.filter((p) => p.uid !== myUid)}
            src={conversation.groupAvatarUrl}
            size={16}
          />
          {editingName ? (
            <div className="flex items-center gap-2 w-full max-w-xs">
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                maxLength={50}
                className="flex-1 rounded-xl border border-border-subtle bg-surface-2 px-3 py-1.5 text-sm text-text-primary focus:border-sage focus:outline-none"
              />
              <button onClick={handleSaveName} disabled={loadingAction} className="flex h-7 w-7 items-center justify-center rounded-xl bg-sage text-white disabled:opacity-40">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => { setEditingName(false); setNameInput(conversation.groupName ?? ''); }} className="flex h-7 w-7 items-center justify-center rounded-xl bg-surface-2 text-text-secondary">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-text-primary">{conversation.groupName}</h3>
              {isAdmin && (
                <button onClick={() => setEditingName(true)} className="text-[10px] text-sage hover:underline">
                  Modifier
                </button>
              )}
            </div>
          )}
          <p className="text-xs text-text-secondary">{t('messages.members_count', { count: conversation.participants.length })}</p>
        </div>

        {/* Members section */}
        <div className="border-t border-border-subtle pt-4 px-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">{t('messages.group_members')}</h4>
            {isAdmin && (
              <button
                onClick={() => setAddingMembers((v) => !v)}
                className="flex items-center gap-1 rounded-xl bg-sage/10 px-2.5 py-1 text-xs font-medium text-sage hover:bg-sage/20 transition-colors"
              >
                <UserPlus className="h-3 w-3" />
                {t('messages.group_add_members')}
              </button>
            )}
          </div>

          {/* Add members search */}
          {addingMembers && isAdmin && (
            <div className="mb-3 rounded-xl border border-border-subtle bg-surface-2 p-3">
              <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-2 mb-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
                <input
                  autoFocus
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder={t('messages.search_user')}
                  className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
                />
              </div>
              {searchLoading && <p className="text-xs text-text-secondary px-1">{t('common.loading')}</p>}
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filteredSearch.map((u) => {
                  const isSelected = selectedToAdd.some((s) => s._id === u._id);
                  return (
                    <button
                      key={u._id}
                      onClick={() => setSelectedToAdd((prev) =>
                        isSelected ? prev.filter((s) => s._id !== u._id) : [...prev, u]
                      )}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors',
                        isSelected ? 'bg-sage/10' : 'hover:bg-surface'
                      )}
                    >
                      <Avatar name={u.displayName} src={u.avatarUrl} size={7} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-text-primary">{u.displayName}</p>
                        {u.username && <p className="truncate text-[10px] text-text-secondary">@{u.username}</p>}
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-sage" />}
                    </button>
                  );
                })}
              </div>
              {selectedToAdd.length > 0 && (
                <button
                  onClick={handleAddMembers}
                  disabled={loadingAction}
                  className="mt-2 w-full rounded-xl bg-sage py-1.5 text-sm font-semibold text-white hover:bg-sage-hover disabled:opacity-40 transition-colors"
                >
                  {loadingAction ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `Ajouter ${selectedToAdd.length} membre${selectedToAdd.length > 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          )}

          {/* Members list */}
          <div className="space-y-1">
            {conversation.participantInfo.map((member) => {
              const isMe = member.uid === myUid;
              const isMemberAdmin = conversation.admins?.includes(member.uid) ?? false;
              const isMemberCreator = conversation.createdBy === member.uid;

              return (
                <div key={member.uid} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2 transition-colors">
                  <Avatar name={member.displayName} src={member.avatarUrl} size={8} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-text-primary">{member.displayName}{isMe && ' (moi)'}</p>
                      {isMemberCreator && (
                        <span className="flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                          <Crown className="h-2.5 w-2.5" />
                          {t('messages.group_creator')}
                        </span>
                      )}
                      {isMemberAdmin && !isMemberCreator && (
                        <span className="flex items-center gap-0.5 rounded-full bg-sage/10 px-1.5 py-0.5 text-[9px] font-bold text-sage">
                          <Shield className="h-2.5 w-2.5" />
                          {t('messages.group_admin')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions (admin only, not on self — except leave) */}
                  {!isMe && isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handlePromote(member.uid, !isMemberAdmin)}
                        disabled={loadingAction || isMemberCreator}
                        title={isMemberAdmin ? t('messages.group_demote') : t('messages.group_promote')}
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-xl transition-colors disabled:opacity-30',
                          isMemberAdmin ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-surface-2 text-text-secondary hover:bg-sage/10 hover:text-sage'
                        )}
                      >
                        <Shield className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemove(member.uid)}
                        disabled={loadingAction || isMemberCreator}
                        title={t('messages.group_remove_member')}
                        className="flex h-7 w-7 items-center justify-center rounded-xl bg-surface-2 text-text-secondary hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors disabled:opacity-30"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Danger zone */}
        <div className="border-t border-border-subtle mt-4 pt-4 px-4 space-y-2">
          {!isCreator && (
            <button
              onClick={() => {
                if (window.confirm(t('messages.group_leave_confirm'))) handleRemove(myUid);
              }}
              disabled={loadingAction}
              className="flex w-full items-center gap-2 rounded-xl border border-red-200 dark:border-red-800 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
            >
              <LogOut className="h-4 w-4" />
              {t('messages.group_leave')}
            </button>
          )}
          {isCreator && (
            <button
              onClick={handleDelete}
              disabled={loadingAction}
              className="flex w-full items-center gap-2 rounded-xl border border-red-200 dark:border-red-800 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
              {t('messages.group_delete')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── NewConversationModal ─────────────────────────────────────────────────────

interface NewConversationModalProps {
  onClose: () => void;
  onSelect: (uid: string) => void;
  onOpenGroup: () => void;
}

function NewConversationModal({ onClose, onSelect, onOpenGroup }: NewConversationModalProps) {
  const { t } = useTranslation();
  const { query, setQuery, results, loading } = useUserSearch();

  const SearchContent = () => (
    <>
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
      <button
        onClick={() => { onClose(); onOpenGroup(); }}
        className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors border-b border-border-subtle"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-sage/10">
          <Users className="h-4 w-4 text-sage" />
        </div>
        <span className="text-sm font-medium text-sage">{t('messages.create_group')}</span>
        <ChevronRight className="h-4 w-4 text-text-secondary ml-auto" />
      </button>
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
    </>
  );

  return (
    <>
      {/* Mobile */}
      <div className="fixed inset-0 z-50 flex flex-col bg-surface sm:hidden">
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
          <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-2 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h3 className="font-heading text-sm font-bold text-text-primary">{t('messages.new')}</h3>
        </div>
        <SearchContent />
      </div>

      {/* Desktop */}
      <div className="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 sm:flex" onClick={onClose}>
        <div className="w-full max-w-sm rounded-2xl bg-surface shadow-xl flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <h3 className="font-heading text-sm font-bold text-text-primary">{t('messages.new')}</h3>
            <button onClick={onClose} className="text-xs text-text-secondary hover:text-text-primary">{t('common.cancel')}</button>
          </div>
          <SearchContent />
        </div>
      </div>
    </>
  );
}

// ─── NewGroupModal ────────────────────────────────────────────────────────────

interface NewGroupModalProps {
  onClose: () => void;
  onCreate: (name: string, uids: string[]) => Promise<void>;
}

function NewGroupModal({ onClose, onCreate }: NewGroupModalProps) {
  const { t } = useTranslation();
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { query, setQuery, results, loading: searchLoading } = useUserSearch();

  async function handleCreate() {
    if (!groupName.trim() || selected.length < 1) return;
    setLoading(true);
    try {
      await onCreate(groupName.trim(), selected.map((u) => u._id));
    } finally {
      setLoading(false);
    }
  }

  const canCreate = groupName.trim().length > 0 && selected.length >= 1;

  const content = (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 pt-3 pb-2 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">{t('messages.group_name_label')}</label>
          <input
            autoFocus
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={t('messages.group_name_placeholder')}
            maxLength={50}
            className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-sage focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">{t('messages.group_select_members')}</label>
          <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-text-secondary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('messages.search_user')}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <span key={u._id} className="flex items-center gap-1 rounded-full bg-sage/10 px-2.5 py-1 text-xs font-medium text-sage">
              {u.displayName}
              <button onClick={() => setSelected((prev) => prev.filter((s) => s._id !== u._id))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search results */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        {searchLoading && <p className="py-2 text-xs text-text-secondary">{t('common.loading')}</p>}
        {!searchLoading && query && results.length === 0 && (
          <p className="py-2 text-xs text-text-secondary">{t('messages.no_users_found')}</p>
        )}
        {results.filter((u) => !selected.find((s) => s._id === u._id)).map((u) => (
          <button
            key={u._id}
            onClick={() => setSelected((prev) => [...prev, u])}
            className="flex w-full items-center gap-3 py-2 hover:bg-surface-2 rounded-xl px-2 transition-colors"
          >
            <Avatar name={u.displayName} src={u.avatarUrl} size={8} />
            <div className="text-left">
              <p className="text-sm font-medium text-text-primary">{u.displayName}</p>
              {u.username && <p className="text-xs text-text-secondary">@{u.username}</p>}
            </div>
          </button>
        ))}
      </div>

      {/* Error hint */}
      {!canCreate && groupName.trim().length > 0 && selected.length === 0 && (
        <p className="px-4 pb-2 text-xs text-amber-500">{t('messages.group_min_members')}</p>
      )}

      <div className="px-4 pb-4 border-t border-border-subtle pt-3">
        <button
          onClick={handleCreate}
          disabled={!canCreate || loading}
          className="w-full rounded-xl bg-sage py-2.5 text-sm font-semibold text-white hover:bg-sage-hover disabled:opacity-40 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : t('messages.create_group')}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile */}
      <div className="fixed inset-0 z-50 flex flex-col bg-surface sm:hidden">
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
          <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-2 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h3 className="font-heading text-sm font-bold text-text-primary">{t('messages.new_group')}</h3>
        </div>
        {content}
      </div>

      {/* Desktop */}
      <div className="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 sm:flex" onClick={onClose}>
        <div className="w-full max-w-sm rounded-2xl bg-surface shadow-xl flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3 shrink-0">
            <h3 className="font-heading text-sm font-bold text-text-primary">{t('messages.new_group')}</h3>
            <button onClick={onClose} className="text-xs text-text-secondary hover:text-text-primary">{t('common.cancel')}</button>
          </div>
          {content}
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
    startConversationWith, setActiveConversation, createGroup,
  } = useMessagesStore();

  const [showNewModal, setShowNewModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
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

  const typingUids = activeConversationId
    ? typing
        .filter((t) => t.conversationId === activeConversationId && t.uid !== myUid)
        .map((t) => t.uid)
    : [];

  const otherUid = activeConv?.type !== 'group'
    ? activeConv?.participants.find((p) => p !== myUid)
    : undefined;
  const otherIsOnline = otherUid ? onlineUsers.has(otherUid) : false;

  async function handleSelectConversation(conv: Conversation) {
    setShowGroupSettings(false);
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

  async function handleCreateGroup(name: string, uids: string[]) {
    setShowNewGroupModal(false);
    setCreatingConv(true);
    setMobileShowChat(true);
    try {
      const conv = await createGroup(name, uids);
      await openConversation(conv._id);
    } catch (err) {
      console.error('[createGroup]', err);
      setMobileShowChat(false);
      const detail = err instanceof Error ? err.message : String(err);
      toast.error(`Erreur : ${detail}`);
    } finally {
      setCreatingConv(false);
    }
  }

  function handleBack() {
    setMobileShowChat(false);
    setShowGroupSettings(false);
    setCreatingConv(false);
    setActiveConversation(null);
  }

  function handleLeaveOrDelete() {
    setShowGroupSettings(false);
    setMobileShowChat(false);
    setActiveConversation(null);
  }

  const chatOrSettingsView = () => {
    if (!activeConv) return null;
    if (showGroupSettings && activeConv.type === 'group') {
      return (
        <GroupSettingsPanel
          myUid={myUid}
          conversation={activeConv}
          onClose={() => setShowGroupSettings(false)}
          onLeaveOrDelete={handleLeaveOrDelete}
        />
      );
    }
    return (
      <ChatView
        myUid={myUid}
        conversation={activeConv}
        messages={activeMessages}
        hasMore={activeHasMore}
        typingUids={typingUids}
        isOnline={otherIsOnline}
        onBack={handleBack}
        onLoadMore={() => loadMoreMessages(activeConv._id)}
        onOpenSettings={() => setShowGroupSettings(true)}
      />
    );
  };

  return (
    <div
      className="flex md:!h-[calc(100dvh-var(--spacing-header))]"
      style={{ height: 'calc(100dvh - var(--spacing-header) - var(--spacing-tabbar) - env(safe-area-inset-bottom))' }}
    >
      {showNewModal && (
        <NewConversationModal
          onClose={() => setShowNewModal(false)}
          onSelect={handleNewConversation}
          onOpenGroup={() => setShowNewGroupModal(true)}
        />
      )}

      {showNewGroupModal && (
        <NewGroupModal
          onClose={() => setShowNewGroupModal(false)}
          onCreate={handleCreateGroup}
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
              onNewGroup={() => setShowNewGroupModal(true)}
            />
          </div>
        ) : activeConv ? (
          <div className="w-full">{chatOrSettingsView()}</div>
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
            onNewGroup={() => setShowNewGroupModal(true)}
          />
        </div>
        <div className="flex-1">
          {activeConv ? (
            chatOrSettingsView()
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
