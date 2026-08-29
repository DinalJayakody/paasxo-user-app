import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';
import { CheckoutInitiationResponse, PaymentOrderType, PaymentStatusResponse } from '../types/api';

export const paymentApi = {
  // POST /payments/checkout/initiate — starts (or resumes a non-terminal attempt for)
  // checkout on an order. Returns everything the PayHere JS SDK needs; merchant_secret
  // never leaves the backend.
  initiateCheckout: async (orderType: PaymentOrderType, orderId: string | number): Promise<CheckoutInitiationResponse> => {
    const { data } = await axiosInstance.post(ENDPOINTS.PAYMENTS.INITIATE, { orderType, orderId });
    return data;
  },

  // GET /payments/status/{orderType}/{orderId} — polled after the PayHere checkout UI
  // reports completion, since only the signed server-to-server webhook (not the UI
  // callback) can actually confirm a charge went through.
  getStatus: async (orderType: PaymentOrderType, orderId: string | number): Promise<PaymentStatusResponse> => {
    const { data } = await axiosInstance.get(ENDPOINTS.PAYMENTS.STATUS(orderType, orderId));
    return data;
  },
};

export default paymentApi;
