import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { ENDPOINTS } from './endpoints';

export const AUTH_LOGOUT_EVENT = 'AUTH_LOGOUT';

const axiosInstance = axios.create({
  baseURL: ENDPOINTS.BASE_URL,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
  },
});

// ─── Request interceptor: attach JWT ─────────────────────────────────────────
axiosInstance.interceptors.request.use(
  async (config) => {
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
