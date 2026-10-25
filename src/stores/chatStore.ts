import { useSyncExternalStore } from 'react';
import { chatApi, ChatMessage, Conversation, newClientId } from '../api/chatApi';
import { chatSocket } from '../lib/chatSocket';

/**
 * App-wide chat state, fed by the REST API and live socket events.
 * Immutable updates: each change replaces only the parts that changed, so
 * components selecting a slice re-render only when that slice changes.
 */
interface ChatState {
  me: string | null;
  conversations: Record<string, Conversation>;
  inbox: string[];               // conversation ids, newest first
  inboxLoaded: boolean;
  inboxHasMore: boolean;
  messages: Record<string, ChatMessage[]>; // ascending by time
  historyHasMore: Record<string, boolean>;
  typing: Record<string, number>;          // conversationId → expires at (ms)
  presence: Record<string, { online: boolean; lastSeenAt?: string | null }>;
  unreadTotal: number;
  active: string | null;                   // conversation open on screen
  connected: boolean;
}

let state: ChatState = {
  me: null, conversations: {}, inbox: [], inboxLoaded: false, inboxHasMore: true,
  messages: {}, historyHasMore: {}, typing: {}, presence: {}, unreadTotal: 0, active: null, connected: false,
};
const listeners = new Set<() => void>();
const set = (patch: Partial<ChatState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useChat<T>(selector: (s: ChatState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}
export const getChatState = () => state;

// ── helpers ────────────────────────────────────────────────────────────────

const ts = (iso?: string | null) => (iso ? Date.parse(iso) || 0 : 0);

function sortInbox(convs: Record<string, Conversation>, ids: string[]): string[] {
  return [...new Set(ids)].filter((id) => convs[id]).sort((a, b) => ts(convs[b].lastMessageAt) - ts(convs[a].lastMessageAt));
}

function upsertMessage(list: ChatMessage[] | undefined, m: ChatMessage): ChatMessage[] {
  const arr = list ? [...list] : [];
  const i = arr.findIndex((x) => x.id === m.id || (!!m.clientId && x.clientId === m.clientId));
  if (i >= 0) arr[i] = { ...m, localUri: arr[i].localUri };
  else arr.push(m);
  return arr.sort((a, b) => ts(a.createdAt) - ts(b.createdAt));
}

function previewOf(m: ChatMessage) {
  return { messageId: m.id, senderUid: m.senderUid, type: m.type, text: m.text ?? null, unsent: m.unsent, createdAt: m.createdAt };
}

function putConversation(c: Conversation) {
  const conversations = { ...state.conversations, [c.id]: c };
  set({ conversations, inbox: c.lastMessageAt ? sortInbox(conversations, [c.id, ...state.inbox]) : state.inbox });
}

// ── socket events ──────────────────────────────────────────────────────────

let wired = false;
function wireSocket() {
  if (wired) return;
  wired = true;
  chatSocket.subscribe((ev) => {
    switch (ev.type) {
      case 'connected':
        set({ connected: true });
        resync();
        break;
      case 'disconnected':
        set({ connected: false });
        break;
      case 'unread':
        set({ unreadTotal: Math.max(0, ev.count | 0) });
        break;
      case 'message':
        onIncomingMessage(ev.conversationId, ev.message);
        break;
      case 'message.updated': {
        const m: ChatMessage = ev.message;
        if (!m) break;
        const patch: Partial<ChatState> = {};
        if (state.messages[ev.conversationId]) {
          patch.messages = { ...state.messages, [ev.conversationId]: upsertMessage(state.messages[ev.conversationId], m) };
        }
        const c = state.conversations[ev.conversationId];
        if (c?.lastMessage?.messageId === m.id) {
          patch.conversations = { ...state.conversations, [c.id]: { ...c, lastMessage: previewOf(m) } };
        }
        set(patch);
        break;
      }
      case 'read': {
        const c = state.conversations[ev.conversationId];
        if (!c) break;
        if (ev.uid === state.me) {
          // Read on another of my devices.
          if (c.unreadCount > 0) {
            set({
              conversations: { ...state.conversations, [c.id]: { ...c, unreadCount: 0 } },
              unreadTotal: Math.max(0, state.unreadTotal - c.unreadCount),
            });
          }
        } else {
          set({ conversations: { ...state.conversations, [c.id]: { ...c, otherLastReadAt: ev.at } } });
        }
        break;
      }
      case 'typing':
        if (ev.uid === state.me) break;
        set({
          typing: ev.typing
            ? { ...state.typing, [ev.conversationId]: Date.now() + 6000 }
            : Object.fromEntries(Object.entries(state.typing).filter(([k]) => k !== ev.conversationId)),
        });
        break;
      case 'presence':
        set({ presence: { ...state.presence, [ev.uid]: { online: !!ev.online, lastSeenAt: ev.lastSeenAt } } });
        break;
      default:
        break;
    }
  });
}

function onIncomingMessage(conversationId: string, m: ChatMessage) {
  if (!m || !conversationId) return;
  const fromOther = m.senderUid !== state.me;
  const patch: Partial<ChatState> = {};
  if (state.messages[conversationId]) {
    patch.messages = { ...state.messages, [conversationId]: upsertMessage(state.messages[conversationId], m) };
  }
  // A message stops the sender's typing indicator.
  if (fromOther && state.typing[conversationId]) {
    patch.typing = Object.fromEntries(Object.entries(state.typing).filter(([k]) => k !== conversationId));
  }
  const c = state.conversations[conversationId];
  const viewing = state.active === conversationId;
  if (c) {
    const bump = fromOther && !viewing ? 1 : 0;
    const conversations = {
      ...state.conversations,
      [c.id]: { ...c, lastMessage: previewOf(m), lastMessageAt: m.createdAt, unreadCount: viewing ? 0 : c.unreadCount + bump },
    };
    patch.conversations = conversations;
    patch.inbox = sortInbox(conversations, [c.id, ...state.inbox]);
    if (bump) patch.unreadTotal = state.unreadTotal + 1;
  } else if (fromOther) {
    patch.unreadTotal = state.unreadTotal + (viewing ? 0 : 1);
    chatApi.get(conversationId).then(putConversation).catch(() => {});
  }
  set(patch);
  if (fromOther && viewing) scheduleMarkRead(conversationId);
}

/** After a reconnect: refresh the inbox head and the open chat's latest page. */
async function resync() {
  try {
    if (state.inboxLoaded) await loadInbox(true);
    const active = state.active;
    if (active) {
      const latest = await chatApi.history(active, null, 30);
      let merged = state.messages[active] ?? [];
      latest.forEach((m) => { merged = upsertMessage(merged, m); });
      set({ messages: { ...state.messages, [active]: merged } });
    }
  } catch { /* next reconnect retries */ }
}

// ── actions ────────────────────────────────────────────────────────────────

export function initChat(me: string) {
  wireSocket();
  if (state.me !== me) {
    state = { ...state, me, conversations: {}, inbox: [], inboxLoaded: false, inboxHasMore: true, messages: {}, historyHasMore: {}, unreadTotal: 0 };
    listeners.forEach((l) => l());
  }
}

export function resetChat() {
  set({ me: null, conversations: {}, inbox: [], inboxLoaded: false, inboxHasMore: true, messages: {}, historyHasMore: {}, typing: {}, presence: {}, unreadTotal: 0, active: null });
}

let inboxLoading = false;
export async function loadInbox(refresh = false) {
  if (inboxLoading) return;
  inboxLoading = true;
  try {
    const before = refresh ? null : state.conversations[state.inbox[state.inbox.length - 1]]?.lastMessageAt ?? null;
    const page = await chatApi.inbox(before, 20);
    const conversations = { ...state.conversations };
    page.forEach((c) => { conversations[c.id] = c; });
    const ids = refresh ? [...page.map((c) => c.id), ...state.inbox.filter((id) => !page.some((c) => c.id === id) && ts(conversations[id]?.lastMessageAt) < ts(page[page.length - 1]?.lastMessageAt))] : [...state.inbox, ...page.map((c) => c.id)];
    set({
      conversations,
      inbox: sortInbox(conversations, ids),
      inboxLoaded: true,
      inboxHasMore: page.length === 20,
    });
    if (refresh) chatApi.unreadCount().then((n) => set({ unreadTotal: n })).catch(() => {});
  } finally {
    inboxLoading = false;
  }
}

export async function openMatchConversation(bookingId: string | number): Promise<Conversation> {
  const c = await chatApi.openMatch(bookingId);
  const existing = state.conversations[c.id];
  putConversation({ ...existing, ...c });
  return c;
}

export async function openConversationWith(userUid: string): Promise<Conversation> {
  const c = await chatApi.open(userUid);
  const existing = state.conversations[c.id];
  putConversation({ ...existing, ...c });
  return c;
}

const historyLoading = new Set<string>();
export async function loadHistory(conversationId: string, older = false) {
  if (historyLoading.has(conversationId)) return;
  historyLoading.add(conversationId);
  try {
    const current = state.messages[conversationId] ?? [];
    const before = older ? current.find((m) => !m.pending)?.createdAt ?? null : null;
    const page = await chatApi.history(conversationId, before, 30);
    let merged = older ? current : current.filter((m) => m.pending || m.failed);
    page.forEach((m) => { merged = upsertMessage(merged, m); });
    set({
      messages: { ...state.messages, [conversationId]: merged },
      historyHasMore: { ...state.historyHasMore, [conversationId]: page.length === 30 },
    });
  } finally {
    historyLoading.delete(conversationId);
  }
}

export function setActiveConversation(id: string | null) {
  set({ active: id });
}

let readTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleMarkRead(conversationId: string) {
  if (readTimer) clearTimeout(readTimer);
  readTimer = setTimeout(() => { markRead(conversationId); }, 400);
}

export async function markRead(conversationId: string) {
  const c = state.conversations[conversationId];
  if (c && c.unreadCount > 0) {
    set({
      conversations: { ...state.conversations, [c.id]: { ...c, unreadCount: 0 } },
      unreadTotal: Math.max(0, state.unreadTotal - c.unreadCount),
    });
  }
  try { await chatApi.markRead(conversationId); } catch { /* best effort */ }
}

function addPending(conversationId: string, m: ChatMessage) {
  set({ messages: { ...state.messages, [conversationId]: upsertMessage(state.messages[conversationId], m) } });
}

function failPending(conversationId: string, clientId: string) {
  const list = state.messages[conversationId];
  if (!list) return;
  set({ messages: { ...state.messages, [conversationId]: list.map((m) => (m.clientId === clientId ? { ...m, pending: false, failed: true } : m)) } });
}

function optimistic(conversationId: string, partial: Partial<ChatMessage>): ChatMessage {
  return {
    id: `local-${partial.clientId}`,
    conversationId,
    senderUid: state.me ?? '',
    type: 'TEXT',
    reactions: {},
    unsent: false,
    createdAt: new Date().toISOString(),
    pending: true,
    ...partial,
  } as ChatMessage;
}

async function deliver(conversationId: string, pending: ChatMessage, request: () => Promise<ChatMessage>) {
  addPending(conversationId, pending);
  try {
    const saved = await request();
    onIncomingMessage(conversationId, saved);
  } catch {
    failPending(conversationId, pending.clientId!);
  }
}

export function sendText(conversationId: string, text: string, replyTo?: ChatMessage | null) {
  const clientId = newClientId();
  const pending = optimistic(conversationId, {
    clientId, type: 'TEXT', text,
    replyTo: replyTo ? { messageId: replyTo.id, senderUid: replyTo.senderUid, type: replyTo.type, text: replyTo.text } : null,
  });
  return deliver(conversationId, pending, () => chatApi.sendText(conversationId, { clientId, text, replyToId: replyTo?.id }));
}

export function sendImage(conversationId: string, image: { uri: string; width?: number; height?: number }, replyTo?: ChatMessage | null) {
  const clientId = newClientId();
  const pending = optimistic(conversationId, {
    clientId, type: 'IMAGE', localUri: image.uri, mediaWidth: image.width, mediaHeight: image.height,
    replyTo: replyTo ? { messageId: replyTo.id, senderUid: replyTo.senderUid, type: replyTo.type, text: replyTo.text } : null,
  });
  return deliver(conversationId, pending, () => chatApi.sendImage(conversationId, { clientId, uri: image.uri, width: image.width, height: image.height, replyToId: replyTo?.id }));
}

export function shareMatch(conversationId: string, match: { bookingId: number; title?: string | null; venueName?: string | null; sport?: string | null; startAt?: string | null }) {
  const clientId = newClientId();
  const pending = optimistic(conversationId, {
    clientId, type: 'MATCH',
    match: { bookingId: match.bookingId, title: match.title, venueName: match.venueName, sport: match.sport,
      date: match.startAt?.slice(0, 10) ?? null, startTime: match.startAt?.slice(11, 16) ?? null },
  });
  return deliver(conversationId, pending, () => chatApi.shareMatch(conversationId, { clientId, bookingId: match.bookingId }));
}

/** Re-sends a failed message with the SAME clientId — the server dedupes, so a send that actually landed never doubles. */
export function retry(conversationId: string, m: ChatMessage) {
  const pending = { ...m, pending: true, failed: false };
  const clientId = m.clientId!;
  if (m.type === 'IMAGE' && m.localUri) {
    return deliver(conversationId, pending, () => chatApi.sendImage(conversationId, { clientId, uri: m.localUri!, width: m.mediaWidth ?? undefined, height: m.mediaHeight ?? undefined, replyToId: m.replyTo?.messageId }));
  }
  if (m.type === 'MATCH' && m.match) {
    return deliver(conversationId, pending, () => chatApi.shareMatch(conversationId, { clientId, bookingId: m.match!.bookingId }));
  }
  return deliver(conversationId, pending, () => chatApi.sendText(conversationId, { clientId, text: m.text ?? '', replyToId: m.replyTo?.messageId }));
}

export function discardFailed(conversationId: string, m: ChatMessage) {
  const list = state.messages[conversationId];
  if (!list) return;
  set({ messages: { ...state.messages, [conversationId]: list.filter((x) => x !== m) } });
}

export async function react(conversationId: string, m: ChatMessage, emoji: string | null) {
  const me = state.me;
  if (!me || m.pending) return;
  const reactions = { ...m.reactions };
  if (emoji) reactions[me] = emoji; else delete reactions[me];
  set({ messages: { ...state.messages, [conversationId]: upsertMessage(state.messages[conversationId], { ...m, reactions }) } });
  try {
    const saved = await chatApi.react(m.id, emoji);
    set({ messages: { ...state.messages, [conversationId]: upsertMessage(state.messages[conversationId], saved) } });
  } catch {
    set({ messages: { ...state.messages, [conversationId]: upsertMessage(state.messages[conversationId], m) } });
    throw new Error('reaction failed');
  }
}

export async function unsend(conversationId: string, m: ChatMessage) {
  const saved = await chatApi.unsend(m.id);
  set({ messages: { ...state.messages, [conversationId]: upsertMessage(state.messages[conversationId], saved) } });
}

export async function setMuted(conversationId: string, muted: boolean) {
  const c = state.conversations[conversationId];
  if (c) set({ conversations: { ...state.conversations, [c.id]: { ...c, muted } } });
  try {
    await chatApi.setMuted(conversationId, muted);
  } catch (e) {
    if (c) set({ conversations: { ...state.conversations, [c.id]: { ...c, muted: !muted } } });
    throw e;
  }
}

export async function clearConversation(conversationId: string) {
  await chatApi.clear(conversationId);
  const c = state.conversations[conversationId];
  const { [conversationId]: _drop, ...messages } = state.messages;
  set({
    inbox: state.inbox.filter((id) => id !== conversationId),
    messages,
    unreadTotal: Math.max(0, state.unreadTotal - (c?.unreadCount ?? 0)),
    conversations: c ? { ...state.conversations, [c.id]: { ...c, unreadCount: 0 } } : state.conversations,
  });
}

/** Drops typing indicators that timed out (sender stopped without a "stop"). */
setInterval(() => {
  const now = Date.now();
  const live = Object.entries(state.typing).filter(([, exp]) => exp > now);
  if (live.length !== Object.keys(state.typing).length) set({ typing: Object.fromEntries(live) });
}, 2000);
