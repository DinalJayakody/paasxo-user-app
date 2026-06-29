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

const CACHE_KEY = 'paasxo_subscription_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
        const cached = await AsyncStorage.getItem(CACHE_KEY);
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
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: result, ts: Date.now() }));
    } catch {
      setState((prev) => ({ ...prev, active: false, loading: false }));
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const startTrial = async (): Promise<boolean> => {
    try {
      const { data } = await axiosInstance.post('/subscriptions/trial');
      await fetchStatus(true);
      return data.active ?? true;
    } catch {
      return false;
    }
  };

  const activate = async (paymentReference: string): Promise<boolean> => {
    try {
      await axiosInstance.post('/subscriptions/activate', { paymentReference });
      await fetchStatus(true);
      return true;
    } catch {
      return false;
    }
  };

  return { ...state, refresh: () => fetchStatus(true), startTrial, activate };
}
