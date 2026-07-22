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
    baseUrlResolution = (async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), HOSTINGER_PROBE_TIMEOUT_MS);
        const response = await fetch(`${HOSTINGER_URL}/auth/health`, { signal: controller.signal });
        clearTimeout(timer);
        if (response.ok) return HOSTINGER_URL;
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
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
  } catch { /* ignore storage errors */ }
  delete axiosInstance.defaults.headers.common['Authorization'];
  DeviceEventEmitter.emit(AUTH_LOGOUT_EVENT);
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
      if (data.refreshToken) {
        await AsyncStorage.setItem('refreshToken', data.refreshToken);
      }

      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
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
