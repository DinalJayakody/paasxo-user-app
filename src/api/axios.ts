import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter, Platform } from 'react-native';
import { ENDPOINTS, HOSTINGER_URL, HOSTINGER_PROBE_TIMEOUT_MS, LOCAL_FALLBACK_URL } from './endpoints';

export const AUTH_LOGOUT_EVENT = 'AUTH_LOGOUT';

const axiosInstance = axios.create({
  baseURL: ENDPOINTS.BASE_URL,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
  },
});

// ─── Resolve Hostinger vs. local backend, once per app launch ────────────────
// Tries the Hostinger VPS first; if it doesn't answer within
// HOSTINGER_PROBE_TIMEOUT_MS (e.g. not deployed yet, or unreachable), every
// request just keeps using the local URL that was already the default.
// Memoized so only the very first request pays the probe's latency - every
// request after that reuses the same resolved promise.
let baseUrlResolution: Promise<string> | null = null;

async function resolvePreferredBaseUrl(): Promise<string> {
  if (Platform.OS === 'web') return ENDPOINTS.BASE_URL; // web keeps its own tunnel/local logic, untouched

  if (!baseUrlResolution) {
    const hostingerUrl = HOSTINGER_URL;
    baseUrlResolution = (async () => {
      if (!hostingerUrl) return LOCAL_FALLBACK_URL; // probe disabled — see endpoints.ts
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), HOSTINGER_PROBE_TIMEOUT_MS);
        const response = await fetch(`${hostingerUrl}/auth/health`, { signal: controller.signal });
        clearTimeout(timer);
        if (response.ok) return hostingerUrl;
      } catch {
        // Not deployed yet / unreachable / timed out — fall back to local below.
      }
      return LOCAL_FALLBACK_URL;
    })();

    baseUrlResolution.then((resolved) => {
      ENDPOINTS.BASE_URL = resolved;
      axiosInstance.defaults.baseURL = resolved;
    });
  }
  return baseUrlResolution;
}

// ─── Request interceptor: attach JWT ─────────────────────────────────────────
axiosInstance.interceptors.request.use(
  async (config) => {
    config.baseURL = await resolvePreferredBaseUrl();
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
        if (config.data) {
          config.headers['Content-Type'] =
            config.data instanceof FormData
              ? 'multipart/form-data'
              : 'application/json';
        }
      }
    } catch {
      // proceed without token
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Refresh-token queue ──────────────────────────────────────────────────────
// When a 401 arrives while a refresh is already in-flight, we queue every
// subsequent request and replay them all once the new token arrives.

let isRefreshing = false;
type QueueEntry = { resolve: (token: string) => void; reject: (err: unknown) => void };
let waitingQueue: QueueEntry[] = [];

const drainQueue = (error: unknown, newToken: string | null = null) => {
  waitingQueue.forEach((entry) => {
    if (error) entry.reject(error);
    else entry.resolve(newToken!);
  });
  waitingQueue = [];
};

const clearAuthAndLogout = async () => {
  try {
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user', 'tokenIssuedAt']);
  } catch { /* ignore storage errors */ }
  delete axiosInstance.defaults.headers.common['Authorization'];
  DeviceEventEmitter.emit(AUTH_LOGOUT_EVENT);
};

// Firebase ID tokens are fixed at a 1-hour lifetime, set server-side — not
// configurable here. Refreshing at 45 minutes leaves a safety margin so a
// proactive refresh always lands before the token would actually expire.
const PROACTIVE_REFRESH_AFTER_MS = 45 * 60 * 1000;

/** Shared by the reactive 401 path and the proactive foreground check below —
 *  performs the actual refresh call, persists the new tokens, and updates the
 *  default Authorization header. Callers handle the isRefreshing/waitingQueue
 *  dedupe themselves (see the response interceptor and refreshTokenIfNeeded). */
const performRefresh = async (): Promise<string> => {
  const storedRefresh = await AsyncStorage.getItem('refreshToken');
  if (!storedRefresh) throw new Error('no_refresh_token');

  // Use plain axios (not axiosInstance) to avoid re-entering this interceptor.
  const { data } = await axios.post(
    `${ENDPOINTS.BASE_URL}${ENDPOINTS.AUTH.REFRESH}`,
    { refreshToken: storedRefresh },
    { headers: { 'Content-Type': 'application/json' } }
  );

  const newAccessToken: string = data.idToken ?? data.accessToken;
  if (!newAccessToken) throw new Error('empty_token_in_refresh_response');

  await AsyncStorage.setItem('accessToken', newAccessToken);
  await AsyncStorage.setItem('tokenIssuedAt', String(Date.now()));
  if (data.refreshToken) {
    await AsyncStorage.setItem('refreshToken', data.refreshToken);
  }

  axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
  return newAccessToken;
};

/**
 * Proactively refreshes the access token if it's near/past its known expiry —
 * called on app foreground (see AuthContext's AppState listener) so a token
 * that would have expired while backgrounded is already fresh before any
 * screen makes a request, instead of waiting for a reactive 401.
 * No-op if there's no session, or a refresh (reactive or proactive) is
 * already in flight — that in-flight refresh covers this check too.
 */
export const refreshTokenIfNeeded = async (): Promise<void> => {
  if (isRefreshing) return;
  try {
    const [storedToken, issuedAtRaw] = await Promise.all([
      AsyncStorage.getItem('accessToken'),
      AsyncStorage.getItem('tokenIssuedAt'),
    ]);
    if (!storedToken) return; // not logged in — nothing to refresh

    const issuedAt = issuedAtRaw ? Number(issuedAtRaw) : 0;
    const isStale = !issuedAt || Date.now() - issuedAt >= PROACTIVE_REFRESH_AFTER_MS;
    if (!isStale) return;

    isRefreshing = true;
    const newToken = await performRefresh();
    drainQueue(null, newToken);
  } catch (err) {
    // Swallow — if the refresh token itself is dead, the next real request
    // will 401 and the reactive path below will handle logging the user out.
  } finally {
    isRefreshing = false;
  }
};

// ─── Response interceptor: 401 → refresh → retry ─────────────────────────────
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only intercept 401s that are not already retried and not from the refresh call itself.
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes(ENDPOINTS.AUTH.REFRESH)
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request until the in-flight refresh completes.
      return new Promise<string>((resolve, reject) => {
        waitingQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axiosInstance(originalRequest);
        })
        .catch(Promise.reject.bind(Promise));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const newAccessToken = await performRefresh();
      drainQueue(null, newAccessToken);

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      drainQueue(refreshError, null);
      await clearAuthAndLogout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default axiosInstance;
