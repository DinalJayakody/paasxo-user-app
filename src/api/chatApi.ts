import axiosInstance from './axios';

export type ChatMessageType = 'TEXT' | 'IMAGE' | 'MATCH' | 'STORY_REPLY' | 'STORY';

export interface ChatUser {
  firebaseUid: string;
  displayName: string;
  profileImageUrl?: string | null;
}

export interface ChatPreview {
  messageId: string;
  senderUid: string;
  type: ChatMessageType;
  text?: string | null;
  unsent?: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  otherUser: ChatUser;
  lastMessage?: ChatPreview | null;
  lastMessageAt?: string | null;
  unreadCount: number;
  muted: boolean;
  online: boolean;
  lastSeenAt?: string | null;
  otherLastReadAt?: string | null;
  canSend: boolean;
  /** Match group chat: the match it belongs to (absent for one-to-one chats). */
  matchBookingId?: number | null;
  /** Match group chat: everyone in it. */
  members?: ChatUser[] | null;
}

export interface MatchCard {
  bookingId: number;
  title?: string | null;
  sport?: string | null;
  venueName?: string | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  status?: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderUid: string;
  type: ChatMessageType;
  text?: string | null;
  mediaUrl?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  match?: MatchCard | null;
  /** STORY_REPLY / STORY: the story it refers to (opened live when tapped). */
  story?: StoryCard | null;
  replyTo?: { messageId: string; senderUid: string; type: ChatMessageType; text?: string | null } | null;
  reactions: Record<string, string>;
  clientId?: string | null;
  unsent: boolean;
  createdAt: string;
  // client-only
  pending?: boolean;
  failed?: boolean;
  localUri?: string;
}

export interface StoryCard {
  storyId: string;
  ownerUid: string;
  ownerName?: string | null;
  mediaType?: 'IMAGE' | 'VIDEO' | string | null;
  mediaUrl?: string | null;
  expiresAt?: string | null;
}

export interface ChatContact {
  user: ChatUser;
  reason: 'FOLLOW' | 'MATCH';
  online: boolean;
}

const enc = encodeURIComponent;

export const chatApi = {
  inbox: async (before?: string | null, limit = 20): Promise<Conversation[]> => {
    const { data } = await axiosInstance.get('/chat/conversations', { params: { before: before ?? undefined, limit } });
    return Array.isArray(data) ? data : [];
  },
  open: async (userUid: string): Promise<Conversation> => {
    const { data } = await axiosInstance.post('/chat/conversations', { userUid });
    return data;
  },
  /** The match's group chat (organiser + joined players only). */
  openMatch: async (bookingId: string | number): Promise<Conversation> => {
    const { data } = await axiosInstance.post(`/chat/matches/${bookingId}`);
    return data;
  },
  get: async (id: string): Promise<Conversation> => {
    const { data } = await axiosInstance.get(`/chat/conversations/${enc(id)}`);
    return data;
  },
  history: async (id: string, before?: string | null, limit = 30): Promise<ChatMessage[]> => {
    const { data } = await axiosInstance.get(`/chat/conversations/${enc(id)}/messages`, { params: { before: before ?? undefined, limit } });
    return Array.isArray(data) ? data : [];
  },
  /** Send a story you can see to this conversation. */
  sendStory: async (id: string, body: { clientId: string; storyId: string; text?: string }): Promise<ChatMessage> => {
    const { data } = await axiosInstance.post(`/chat/conversations/${enc(id)}/messages`, { type: 'STORY', ...body });
    return data;
  },
  sendText: async (id: string, body: { clientId: string; text: string; replyToId?: string | null }): Promise<ChatMessage> => {
    const { data } = await axiosInstance.post(`/chat/conversations/${enc(id)}/messages`, { type: 'TEXT', ...body });
    return data;
  },
  shareMatch: async (id: string, body: { clientId: string; bookingId: number; text?: string; replyToId?: string | null }): Promise<ChatMessage> => {
    const { data } = await axiosInstance.post(`/chat/conversations/${enc(id)}/messages`, { type: 'MATCH', ...body });
    return data;
  },
  sendImage: async (id: string, p: { clientId: string; uri: string; width?: number; height?: number; replyToId?: string | null }): Promise<ChatMessage> => {
    const form = new FormData();
    form.append('file', { uri: p.uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
    form.append('clientId', p.clientId);
    if (p.replyToId) form.append('replyToId', p.replyToId);
    if (p.width) form.append('width', String(Math.round(p.width)));
    if (p.height) form.append('height', String(Math.round(p.height)));
    const { data } = await axiosInstance.post(`/chat/conversations/${enc(id)}/images`, form, { timeout: 120000 });
    return data;
  },
  markRead: async (id: string): Promise<void> => {
    await axiosInstance.post(`/chat/conversations/${enc(id)}/read`);
  },
  setMuted: async (id: string, muted: boolean): Promise<void> => {
    await axiosInstance.put(`/chat/conversations/${enc(id)}/mute`, { muted });
  },
  clear: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/chat/conversations/${enc(id)}`);
  },
  react: async (messageId: string, emoji: string | null): Promise<ChatMessage> => {
    const { data } = await axiosInstance.put(`/chat/messages/${enc(messageId)}/reaction`, { emoji });
    return data;
  },
  unsend: async (messageId: string): Promise<ChatMessage> => {
    const { data } = await axiosInstance.delete(`/chat/messages/${enc(messageId)}`);
    return data;
  },
  contacts: async (q?: string): Promise<ChatContact[]> => {
    const { data } = await axiosInstance.get('/chat/contacts', { params: { q: q || undefined } });
    return Array.isArray(data) ? data : [];
  },
  unreadCount: async (): Promise<number> => {
    const { data } = await axiosInstance.get('/chat/unread-count');
    return typeof data?.count === 'number' ? data.count : 0;
  },
  canMessage: async (uid: string): Promise<boolean> => {
    const { data } = await axiosInstance.get(`/chat/can-message/${enc(uid)}`);
    return !!data?.allowed;
  },
};

/** Random id for idempotent sends (retries never duplicate). */
export function newClientId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
