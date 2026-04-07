import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users, UserPlus, Search, Check, X, UserMinus, Clock, Loader2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useFriendsStore } from '@/stores/friends.store';
import { cn } from '@/lib/utils';
import type { FriendshipCheck } from '@/types';

interface UserSearchResult {
  _id: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
}

function Avatar({ name, url, size = 'md' }: { name: string; url?: string; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm';
  if (url) {
    return <img src={url} alt={name} className={cn(cls, 'rounded-full object-cover ring-1 ring-border-subtle/50')} />;
  }
  return (
    <div className={cn(cls, 'flex items-center justify-center rounded-full bg-sage-muted font-bold text-sage')}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

export function FriendsPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const {
    friends, requests, loading,
    fetchFriends, fetchRequests,
    acceptRequest, declineRequest, removeFriend, sendRequest,
  } = useFriendsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [friendshipStatuses, setFriendshipStatuses] = useState<Record<string, FriendshipCheck>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchFriends();
    fetchRequests();
  }, [isAuthenticated, fetchFriends, fetchRequests]);

  // Search users
  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await apiFetch<UserSearchResult[]>(`/api/users/search?q=${encodeURIComponent(q)}`, { auth: true });
      setSearchResults(results ?? []);
      // Check friendship status for each result
      const statuses: Record<string, FriendshipCheck> = {};
      await Promise.all(
        (results ?? []).map(async (u) => {
          try {
            const check = await apiFetch<FriendshipCheck>(`/api/friends/check/${u._id}`, { auth: true });
            statuses[u._id] = check ?? { status: 'none' };
          } catch {
            statuses[u._id] = { status: 'none' };
          }
        }),
      );
      setFriendshipStatuses(statuses);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Send friend request
  const handleSendRequest = async (userId: string) => {
    setActionLoading(userId);
    try {
      await sendRequest(userId);
      setFriendshipStatuses((s) => ({
        ...s,
        [userId]: { status: 'pending_sent', friendshipId: '' },
      }));
    } catch (err) {
      console.error('sendRequest error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Accept
  const handleAccept = async (friendshipId: string) => {
    setActionLoading(friendshipId);
    try {
      await acceptRequest(friendshipId);
    } catch (err) {
      console.error('acceptRequest error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Decline
  const handleDecline = async (friendshipId: string) => {
    setActionLoading(friendshipId);
    try {
      await declineRequest(friendshipId);
    } catch (err) {
      console.error('declineRequest error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Remove
  const handleRemove = async (friendshipId: string) => {
    setActionLoading(friendshipId);
    try {
      await removeFriend(friendshipId);
    } catch (err) {
      console.error('removeFriend error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <Users className="h-12 w-12 text-text-secondary/30" />
        <p className="text-sm text-text-secondary">{t('friends.login_prompt')}</p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-xl bg-sage px-5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-sage-hover"
        >
          {t('auth.login') }
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24 md:pb-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-text-primary">
          {t('friends.title') }
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {t('friends.subtitle') }
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-8">
        <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface px-4 shadow-soft transition-all focus-within:border-sage focus-within:shadow-card">
          <Search className="h-4 w-4 shrink-0 text-text-secondary/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t('friends.search_placeholder') }
            className="w-full bg-transparent py-3 text-sm text-text-primary outline-none placeholder:text-text-secondary/50"
          />
          {searching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sage" />}
          {searchQuery && !searching && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults([]); }}
              className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-text-secondary/10 text-text-secondary transition-colors hover:bg-text-secondary/20"
              type="button"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="mt-2 overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-card">
            {searchResults.map((user) => {
              const status = friendshipStatuses[user._id];
              const isLoading = actionLoading === user._id;
              return (
                <div
                  key={user._id}
                  className="flex items-center gap-3 border-b border-border-subtle/50 px-4 py-3 last:border-0"
                >
                  <Avatar name={user.displayName} url={user.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{user.displayName}</p>
                    {user.username && (
                      <p className="truncate text-xs text-text-secondary">@{user.username}</p>
                    )}
                  </div>
                  {/* Action button based on status */}
                  {status?.status === 'accepted' ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-sage">
                      <Check className="h-3.5 w-3.5" />
                      {t('friends.already_friends') }
                    </span>
                  ) : status?.status === 'pending_sent' ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-brand">
                      <Clock className="h-3.5 w-3.5" />
                      {t('friends.request_sent') }
                    </span>
                  ) : status?.status === 'pending_received' ? (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleAccept(status.friendshipId)}
                        disabled={isLoading}
                        className="flex h-8 cursor-pointer items-center gap-1 rounded-lg bg-sage px-3 text-xs font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50"
                        type="button"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDecline(status.friendshipId)}
                        disabled={isLoading}
                        className="flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-border-subtle px-3 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-50"
                        type="button"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSendRequest(user._id)}
                      disabled={isLoading}
                      className={cn(
                        'flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all',
                        'bg-sage text-white hover:bg-sage-hover disabled:opacity-50',
                        'active:scale-95',
                      )}
                      type="button"
                    >
                      {isLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="h-3.5 w-3.5" />
                          {t('friends.add') }
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
          <div className="mt-2 rounded-xl border border-border-subtle bg-surface px-4 py-6 text-center text-xs text-text-secondary/60">
            {t('friends.no_users_found') }
          </div>
        )}
      </div>

      {/* Pending requests */}
      {requests.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="font-heading text-lg font-bold text-text-primary">
              {t('friends.requests') }
            </h2>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sage px-1.5 text-[10px] font-bold text-white">
              {requests.length}
            </span>
          </div>
          <div className="space-y-2">
            {requests.map((req) => {
              const isLoading = actionLoading === req.friendshipId;
              return (
                <div
                  key={req.friendshipId}
                  className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface p-4 shadow-soft transition-shadow hover:shadow-card"
                >
                  <Avatar name={req.displayName} url={req.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">{req.displayName}</p>
                    {req.username && (
                      <p className="truncate text-xs text-text-secondary">@{req.username}</p>
                    )}
                    <p className="mt-0.5 text-[11px] text-text-secondary/60">
                      {new Date(req.requestedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(req.friendshipId)}
                      disabled={isLoading}
                      className={cn(
                        'flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-4 text-xs font-semibold',
                        'bg-sage text-white transition-all hover:bg-sage-hover disabled:opacity-50',
                        'active:scale-95',
                      )}
                      type="button"
                    >
                      {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      {t('friends.accept') }
                    </button>
                    <button
                      onClick={() => handleDecline(req.friendshipId)}
                      disabled={isLoading}
                      className={cn(
                        'flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-4 text-xs font-semibold',
                        'border border-border-subtle text-text-secondary transition-all hover:bg-surface-2 disabled:opacity-50',
                        'active:scale-95',
                      )}
                      type="button"
                    >
                      <X className="h-3.5 w-3.5" />
                      {t('friends.decline') }
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Friends list */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-heading text-lg font-bold text-text-primary">
            {t('friends.my_friends') }
          </h2>
          {friends.length > 0 && (
            <span className="text-xs font-medium text-text-secondary">({friends.length})</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-sage" />
          </div>
        ) : friends.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle py-12 text-center">
            <Users className="mb-3 h-10 w-10 text-text-secondary/20" />
            <p className="text-sm font-medium text-text-secondary">
              {t('friends.no_friends_yet') }
            </p>
            <p className="mt-1 text-xs text-text-secondary/60">
              {t('friends.search_to_add') }
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map((friend) => {
              const isLoading = actionLoading === friend.friendshipId;
              return (
                <div
                  key={friend.friendshipId}
                  className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface p-4 shadow-soft transition-shadow hover:shadow-card"
                >
                  <Avatar name={friend.displayName} url={friend.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/profile?id=${friend._id}`}
                      className="block truncate text-sm font-semibold text-text-primary no-underline hover:text-sage"
                    >
                      {friend.displayName}
                    </Link>
                    {friend.username && (
                      <p className="truncate text-xs text-text-secondary">@{friend.username}</p>
                    )}
                    <p className="mt-0.5 text-[11px] text-text-secondary/60">
                      {t('friends.since') } {new Date(friend.since).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(friend.friendshipId)}
                    disabled={isLoading}
                    className={cn(
                      'flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl',
                      'border border-border-subtle text-text-secondary/60',
                      'transition-all hover:border-grade-expert/30 hover:bg-grade-expert/5 hover:text-grade-expert',
                      'disabled:opacity-50 active:scale-95',
                    )}
                    type="button"
                    title={t('friends.remove') }
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
