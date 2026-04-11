/* ============================================
   ZoneDeGrimpe - Core TypeScript Types
   ============================================ */

export type SpotType = 'crag' | 'boulder' | 'indoor' | 'shop';
export type SpotStatus = 'approved' | 'pending' | 'rejected';
export type Orientation = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SO' | 'O' | 'NO';
export type Equipment = 'spit' | 'piton' | 'mixte' | 'non_equipe';
export type ClimbingStyle = 'sport' | 'trad' | 'boulder' | 'multi' | 'other';
export type LogbookStyle = 'onsight' | 'flash' | 'redpoint' | 'repeat';
export type FriendshipStatus = 'pending' | 'accepted' | 'declined';
export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'new_review'
  | 'spot_approved'
  | 'spot_rejected'
  | 'new_follower';

export interface UserRef {
  uid: string;
  displayName: string;
}

export interface Spot {
  id: string;
  name: string;
  type: SpotType;
  soustype: string | null;
  lat: number;
  lng: number;
  orientation: Orientation | null;
  niveau_min: string | null;
  niveau_max: string | null;
  id_voix: string[];
  url: string | null;
  description: string | null;
  info_complementaires: { rock?: string; [key: string]: unknown } | null;
  acces: string | null;
  equipement: Equipment | null;
  hauteur: number | null;
  photos: SpotPhoto[];
  createdBy: UserRef | null;
  submittedBy: UserRef | null;
  updatedBy: UserRef | null;
  createdAt: string | null;
  updatedAt: string | null;
  status: SpotStatus | null;
  avgRating?: number;
  reviewCount?: number;
}

export interface SpotPhoto {
  url: string;
  publicId?: string;
  uploadedBy?: UserRef;
  uploadedAt?: string;
}

export interface ClimbingRoute {
  _id: string;
  spotId: string;
  name: string;
  grade: string;
  style: ClimbingStyle;
  height?: number;
  bolts?: number;
  description?: string;
  createdBy: UserRef;
  createdAt: string;
}

export interface Review {
  _id: string;
  spotId: string;
  userId: string;
  username: string;
  displayName: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LogbookEntry {
  _id: string;
  routeId?: string;
  spotId: string;
  spotName?: string;
  routeName?: string;
  grade?: string;
  style: LogbookStyle;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface LogbookStats {
  total: number;
  uniqueSpots: number;
  gradePyramid: Record<string, number>;
  monthly: Array<{ month: string; count: number }>;
  styles: Record<string, number>;
}

export interface UserProfile {
  _id: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  level?: string;
  roles: string[];
  memberSince: string;
  stats: {
    spotsContributed: number;
    spotsApproved: number;
  };
}

export interface NotificationPreferences {
  friendRequest?: boolean;
  friendAccepted?: boolean;
  newFollower?: boolean;
  spotApproved?: boolean;
  spotRejected?: boolean;
  newReview?: boolean;
  quietMode?: {
    enabled?: boolean;
    startHour?: number;
    endHour?: number;
  };
}

export interface AuthUser {
  _id: string;
  email: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  phone?: string;
  roles: string[];
  preferences?: { lang?: string };
  profile?: {
    level?: string;
    bio?: string;
  };
  privacy?: {
    isPrivate?: boolean;
    logbookVisibility?: 'public' | 'friends' | 'private';
  };
  notificationPreferences?: NotificationPreferences;
}

export interface AuthState {
  token: string;
  user: AuthUser;
}

export interface Notification {
  _id: string;
  type: NotificationType;
  userId: string;
  fromUserId?: string;
  fromUsername?: string;
  message?: string;
  data?: Record<string, string> | null;
  read: boolean;
  createdAt: string;
}

/** Raw friendship document (rarely used directly) */
export interface Friendship {
  _id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: string;
  updatedAt?: string;
}

/** GET /api/friends — accepted friend */
export interface Friend {
  friendshipId: string;
  _id: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  since: string;
}

/** GET /api/friends/requests — incoming pending request */
export interface FriendRequest {
  friendshipId: string;
  _id: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  requestedAt: string;
}

/** GET /api/friends/check/:userId */
export type FriendshipCheck =
  | { status: 'none' }
  | { status: 'accepted'; friendshipId: string }
  | { status: 'pending_sent'; friendshipId: string }
  | { status: 'pending_received'; friendshipId: string };

// ---- Messaging ----

export interface ParticipantInfo {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface LastMessage {
  content: string;
  senderUid: string;
  createdAt: string;
}

export interface Conversation {
  _id: string;
  participants: string[];
  participantInfo: ParticipantInfo[];
  lastMessage: LastMessage | null;
  unread: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderUid: string;
  content: string;
  status: 'sent' | 'delivered' | 'read';
  createdAt: string;
}

export interface FeedItem {
  type: 'review' | 'logbook' | 'spot';
  userId: string;
  username?: string;
  displayName: string;
  avatarUrl?: string;
  data: Record<string, unknown>;
  createdAt: string;
}
