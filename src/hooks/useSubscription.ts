import { useCallback, useEffect, useSyncExternalStore } from 'react';
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

/**
 * Module-scope shared store (React's useSyncExternalStore pattern) instead
 * of each useSubscription() call keeping its own local useState. Every
 * consumer reads the SAME snapshot and re-renders together the instant any
 * one of them calls refresh()/verifyPurchase()/startTrial() — no consumer
 * has to remember to re-sync itself.
 *
 * This is what the "Upgrade to Pro" CTA staying visible after a real
 * purchase traced back to: Home/Explore/Feed/Profile stay mounted forever
 * (bottom-tab screens), and match-detail/scoreboard screens aren't
 * remounted when popped back to — each held its own useState from a
 * mount-once fetch, so only the SubscriptionScreen instance that actually
 * called verifyPurchase() ever learned the account became Pro. A shared
 * store fixes every call site at once instead of adding a
 * refresh-on-focus effect to each of the ~8 screens individually, and
 * actually issues FEWER network calls than before (see ensureInitialFetch).
 */
let sharedState: SubscriptionState = {
  active: false,
  plan: 'NONE',
  status: 'NONE',
  loading: true,
};
const listeners = new Set<() => void>();

function setSharedState(next: SubscriptionState) {
  sharedState = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): SubscriptionState {
  return sharedState;
}

// Call on sign-out so the next account on this device doesn't briefly see a
// stale subscription state cached from the previous account. Resets the
// in-memory shared store too (not just AsyncStorage) — otherwise a
// still-mounted consumer, or a second account signing in within the same
// app session, would keep seeing the previous account's Pro status until
// the next fetch happens to overwrite it.
export async function clearSubscriptionCache() {
  await AsyncStorage.removeItem(SUBSCRIPTION_CACHE_KEY);
  initialFetchStarted = false;
  setSharedState({ active: false, plan: 'NONE', status: 'NONE', loading: true });
}

let inFlightFetch: Promise<void> | null = null;

async function fetchStatus(force = false): Promise<void> {
  // Dedupe concurrent callers (e.g. several screens mounting at once on cold
  // start) into a single cache-read/network request instead of one per caller.
  if (inFlightFetch) return inFlightFetch;

  inFlightFetch = (async () => {
    try {
      if (!force) {
        const cached = await AsyncStorage.getItem(SUBSCRIPTION_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.ts < CACHE_TTL_MS) {
            setSharedState({ ...parsed.data, loading: false });
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
      setSharedState(result);
      await AsyncStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify({ data: result, ts: Date.now() }));
    } catch {
      setSharedState({ ...sharedState, active: false, loading: false });
    } finally {
      inFlightFetch = null;
    }
  })();

  return inFlightFetch;
}

// Fires the very first time ANY useSubscription() instance mounts app-wide,
// not once per screen — every screen used to run its own mount-time fetch,
// which this shared store makes both unnecessary (everyone already reads
// the same snapshot) and wasteful (redundant cache reads/network calls).
// Later mounts just read whatever's already in the shared store.
let initialFetchStarted = false;
function ensureInitialFetch() {
  if (initialFetchStarted) return;
  initialFetchStarted = true;
  fetchStatus();
}

export function useSubscription() {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    ensureInitialFetch();
  }, []);

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

  // Grants Pro access only after the backend independently verifies the
  // purchase with Apple/Google's servers - see SubscriptionVerificationService
  // on the backend. Replaces the old activate(paymentReference) call, which
  // accepted any client-supplied string as "proof of payment."
  const verifyPurchase = async (payload: {
    platform: 'APPLE' | 'GOOGLE';
    productId: string;
    transactionId?: string;
    purchaseToken?: string;
  }): Promise<void> => {
    try {
      await axiosInstance.post('/subscriptions/verify-purchase', payload);
    } finally {
      await fetchStatus(true);
    }
  };

  // Memoized so callers can safely use it as a useCallback/useEffect/
  // useFocusEffect dependency — an inline `() => fetchStatus(true)` here
  // would get a new identity every render, and any screen that re-runs an
  // effect when `refresh` changes (e.g. useFocusEffect on session details)
  // would re-trigger that effect every render, causing an infinite render loop.
  const refresh = useCallback(() => fetchStatus(true), []);

  return { ...state, refresh, startTrial, verifyPurchase };
}
