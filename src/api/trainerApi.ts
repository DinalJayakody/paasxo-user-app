import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';
import type { TrainerPlan, TrainerPlanOrderResponse, TrainerPlanPurchase } from '../types/api';

// Normalizes the backend's PagedResponse<T> ({content, page, hasMore}) shape,
// falling back gracefully if an older/unpaginated endpoint returns a raw array.
// Mirrors futsalApi.ts / bookingApi.ts's normalizePage() convention.
function normalizePage(data: any): { content: any[]; hasMore: boolean } {
  if (Array.isArray(data)) return { content: data, hasMore: false };
  const content = Array.isArray(data?.content) ? data.content : [];
  return { content, hasMore: !!data?.hasMore };
}

export const trainerApi = {
  filterTrainers: async (params: {
    query?: string;
    category?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    freeOnly?: boolean;
    page?: number;
    size?: number;
  }): Promise<{ content: any[]; hasMore: boolean }> => {
    const { data } = await axiosInstance.get(ENDPOINTS.TRAINER.FILTER, { params });
    return normalizePage(data);
  },

  getById: async (trainerId: string | number) => {
    const { data } = await axiosInstance.get(ENDPOINTS.TRAINER.DETAIL(trainerId));
    return data;
  },

  getSessionsForTrainer: async (trainerFirebaseUid: string) => {
    const { data } = await axiosInstance.get(ENDPOINTS.TRAINER.SESSIONS_FOR_TRAINER(trainerFirebaseUid));
    return data;
  },

  getSessionById: async (sessionId: string | number) => {
    const { data } = await axiosInstance.get(ENDPOINTS.TRAINER.SESSION_DETAIL(sessionId));
    return data;
  },

  getSlots: async (sessionId: string | number, from?: string, to?: string) => {
    const { data } = await axiosInstance.get(ENDPOINTS.TRAINER.SESSION_SLOTS(sessionId), {
      params: { from, to },
    });
    return data;
  },

  // POST /trainers/slots/{slotId}/join-order — server decides free vs. paid
  // (JoinOrderResponse.joined), never the client. Paid sessions return
  // paymentOrderId for paymentApi.initiateCheckout('TRAINER_BOOKING', paymentOrderId).
  createJoinOrder: async (slotId: string | number): Promise<TrainerJoinOrderResponse> => {
    const { data } = await axiosInstance.post(ENDPOINTS.TRAINER.JOIN_ORDER(slotId));
    return data;
  },

  getMyBookings: async () => {
    const { data } = await axiosInstance.get(ENDPOINTS.TRAINER.MY_BOOKINGS);
    return data;
  },

  cancelBooking: async (bookingId: string | number) => {
    const { data } = await axiosInstance.patch(ENDPOINTS.TRAINER.CANCEL_BOOKING(bookingId));
    return data;
  },
  // ─── Plans & memberships (T4/T5/T6) ─────────────────────────────────────
  getPlansForTrainer: async (trainerFirebaseUid: string): Promise<TrainerPlan[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.TRAINER.PLANS_FOR_TRAINER(trainerFirebaseUid));
    return Array.isArray(data) ? data : [];
  },

  getPlan: async (planId: string | number): Promise<TrainerPlan> => {
    const { data } = await axiosInstance.get(ENDPOINTS.TRAINER.PLAN(planId));
    return data;
  },

  /** Free plans are granted immediately; paid ones return a paymentOrderId for PAYMENTS.INITIATE('TRAINER_PLAN', …). */
  orderPlan: async (planId: string | number): Promise<TrainerPlanOrderResponse> => {
    const { data } = await axiosInstance.post(ENDPOINTS.TRAINER.PLAN_ORDER(planId));
    return data;
  },

  getMyPlanPurchases: async (): Promise<TrainerPlanPurchase[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.TRAINER.MY_PLAN_PURCHASES);
    return Array.isArray(data) ? data : [];
  },

  cancelPlanPurchase: async (purchaseId: string | number): Promise<TrainerPlanPurchase> => {
    const { data } = await axiosInstance.post(ENDPOINTS.TRAINER.CANCEL_PLAN_PURCHASE(purchaseId));
    return data;
  },

  /** Tell the trainer your goals / allergies / injuries for your personal plan. */
  updatePlanClientNote: async (purchaseId: string | number, note: string): Promise<TrainerPlanPurchase> => {
    const { data } = await axiosInstance.put(ENDPOINTS.TRAINER.PLAN_CLIENT_NOTE(purchaseId), { note });
    return data;
  },
};

export interface TrainerJoinOrderResponse {
  joined: boolean;
  paymentOrderId?: number;
  amountDue?: number;
  message: string;
}
