import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../api/axios';

export type SubscriptionPlan = 'NONE' | 'TRIAL' | 'PAID';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'NONE';

export interface SubscriptionState {
  active: boolean;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  endDate?: string;
  loading: boolean;
}

export const SUBSCRIPTION_CACHE_KEY = 'paasxo_subscription_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Call on sign-out so the next account on this device doesn't briefly see a
// stale subscription state cached from the previous account.
export async function clearSubscriptionCache() {
  await AsyncStorage.removeItem(SUBSCRIPTION_CACHE_KEY);
}

export function useSubscription() {
  const [state, setState] = useState<SubscriptionState>({
    active: false,
    plan: 'NONE',
    status: 'NONE',
    loading: true,
  });

  const fetchStatus = useCallback(async (force = false) => {
    try {
      // Return cached result unless forced
      if (!force) {
        const cached = await AsyncStorage.getItem(SUBSCRIPTION_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.ts < CACHE_TTL_MS) {
            setState({ ...parsed.data, loading: false });
            return;
          }
        }
      }

      const { data } = await axiosInstance.get('/subscriptions/status');
      const result: SubscriptionState = {
        active: data.active ?? false,
        plan: (data.plan as SubscriptionPlan) ?? 'NONE',
        status: (data.status as SubscriptionStatus) ?? 'NONE',
        endDate: data.endDate,
        loading: false,
      };
      setState(result);
      await AsyncStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify({ data: result, ts: Date.now() }));
    } catch {
      setState((prev) => ({ ...prev, active: false, loading: false }));
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Both let the request error propagate (instead of swallowing it into a
  // boolean) so the caller can show the *real* reason via extractApiError —
  // e.g. an expired token, a network failure, or a genuine "already active"
  // rejection all need different messages, and guessing one generic message
  // for every failure actively misleads users about their own account state.
  const startTrial = async (): Promise<void> => {
    try {
      await axiosInstance.post('/subscriptions/trial');
    } finally {
      // Re-sync with the server whether this succeeded or failed — e.g. a
      // "trial already active" rejection means the account really IS active,
      // and the UI must reflect that instead of being stuck on a stale
      // cached `active: false` for up to CACHE_TTL_MS.
      await fetchStatus(true);
    }
  };

  const activate = async (paymentReference: string): Promise<void> => {
    try {
      await axiosInstance.post('/subscriptions/activate', { paymentReference });
    } finally {
      await fetchStatus(true);
    }
  };

  // Memoized so callers can safely use it as a useCallback/useEffect/
  // useFocusEffect dependency — an inline `() => fetchStatus(true)` here
  // would get a new identity every render, and any screen that re-runs an
  // effect when `refresh` changes (e.g. useFocusEffect on session details)
  // would re-trigger that effect every render, causing an infinite render loop.
  const refresh = useCallback(() => fetchStatus(true), [fetchStatus]);

  return { ...state, refresh, startTrial, activate };
}
