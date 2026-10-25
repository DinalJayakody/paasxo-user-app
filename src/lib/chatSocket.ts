import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENDPOINTS } from '../api/endpoints';
import { chatApi } from '../api/chatApi';

type Listener = (event: any) => void;

const PING_MS = 25_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * The one realtime chat connection for the app (wss://…/api/ws/chat).
 *
 *  - Connects while signed in AND the app is in the foreground (see
 *    useChatConnection); disconnecting in the background is deliberate — the
 *    server then knows you're away and sends a push instead.
 *  - Authenticates with its first frame (never a token in the URL).
 *  - Heartbeat every 25s; reconnects with capped, jittered backoff.
 *  - Emits {type:'connected'} after every (re)connect so the store can resync
 *    anything missed while offline.
 */
class ChatSocket {
  private ws: WebSocket | null = null;
  private enabled = false;
  private ready = false;
  private listeners = new Set<Listener>();
  private backoff = 1000;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private watch = new Set<string>();
  private authFailures = 0;

  get isReady() {
    return this.ready;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  start() {
    if (this.enabled) return;
    this.enabled = true;
    this.connect();
  }

  stop() {
    this.enabled = false;
    this.clearTimers();
    const ws = this.ws;
    this.ws = null;
    this.setReady(false);
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      ws.onerror = null;
      try { ws.close(1000, 'background'); } catch { /* ignore */ }
    }
  }

  /** Presence updates for these users (an open chat). */
  setWatch(uids: string[]) {
    this.watch = new Set(uids.filter(Boolean));
    this.send({ type: 'watch', uids: [...this.watch] });
  }

  typing(conversationId: string, typing: boolean) {
    this.send({ type: 'typing', conversationId, typing });
  }

  private send(obj: unknown) {
    if (this.ws && this.ready) {
      try { this.ws.send(JSON.stringify(obj)); } catch { /* reconnect will follow */ }
    }
  }

  private emit(event: any) {
    this.listeners.forEach((l) => {
      try { l(event); } catch { /* a listener bug must not break the socket */ }
    });
  }

  private setReady(r: boolean) {
    if (this.ready === r) return;
    this.ready = r;
    this.emit({ type: r ? 'connected' : 'disconnected' });
  }

  private clearTimers() {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
  }

  private scheduleReconnect() {
    if (!this.enabled || this.retryTimer) return;
    const base = this.authFailures >= 3 ? 60_000 : this.backoff;
    const delay = base + Math.random() * 800;
    this.backoff = Math.min(MAX_BACKOFF_MS, this.backoff * 2);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }

  private async connect() {
    if (!this.enabled || this.ws) return;
    try {
      // A cheap authenticated call first: resolves the API base URL and, if the
      // stored token has expired, lets the normal 401 → refresh flow renew it.
      const count = await chatApi.unreadCount();
      this.emit({ type: 'unread', count });
    } catch {
      this.scheduleReconnect();
      return;
    }
    if (!this.enabled || this.ws) return;
    const token = await AsyncStorage.getItem('accessToken').catch(() => null);
    if (!token) { this.scheduleReconnect(); return; }

    const url = `${ENDPOINTS.BASE_URL.replace(/\/+$/, '').replace(/^http/i, 'ws')}/ws/chat`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      try { ws.send(JSON.stringify({ type: 'auth', token })); } catch { /* close follows */ }
    };
    ws.onmessage = (e) => {
      let ev: any;
      try { ev = JSON.parse(String(e.data)); } catch { return; }
      if (!ev || typeof ev.type !== 'string') return;
      if (ev.type === 'ready') {
        this.backoff = 1000;
        this.authFailures = 0;
        this.setReady(true);
        if (this.watch.size) this.send({ type: 'watch', uids: [...this.watch] });
        this.clearTimers();
        this.pingTimer = setInterval(() => this.send({ type: 'ping' }), PING_MS);
        return;
      }
      if (ev.type === 'pong') return;
      this.emit(ev);
    };
    ws.onerror = () => { /* onclose follows */ };
    ws.onclose = (e) => {
      if (this.ws === ws) this.ws = null;
      this.clearTimers();
      this.setReady(false);
      if (e?.code === 4001) this.authFailures++;
      this.scheduleReconnect();
    };
  }
}

export const chatSocket = new ChatSocket();
