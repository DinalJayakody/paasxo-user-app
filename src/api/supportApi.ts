import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';

export type SupportArea = 'IT' | 'PAYMENT' | 'CUSTOMER_SERVICE' | 'VENDOR_ISSUES' | 'OTHER';
export type SupportTicketStatus = 'OPEN' | 'RESOLVED';

export interface SupportTicketAttachment {
  uri: string;
  name?: string;
  mimeType?: string;
}

export interface SubmitTicketPayload {
  subject: string;
  area: SupportArea;
  description: string;
  attachments?: SupportTicketAttachment[];
}

export interface SupportTicketResponse {
  id: number;
  subject: string;
  area: SupportArea;
  description: string;
  attachmentUrls: string[];
  status: SupportTicketStatus;
  createdAt: string;
}

export const supportApi = {
  submitTicket: async (payload: SubmitTicketPayload): Promise<SupportTicketResponse> => {
    const formData = new FormData();
    formData.append(
      'request',
      JSON.stringify({ subject: payload.subject, area: payload.area, description: payload.description })
    );
    (payload.attachments ?? []).forEach((att, i) => {
      formData.append('attachments', {
        uri: att.uri,
        name: att.name || `attachment-${i}.jpg`,
        type: att.mimeType || 'image/jpeg',
      } as any);
    });

    const { data } = await axiosInstance.post(ENDPOINTS.SUPPORT.CREATE_TICKET, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return data;
  },

  getMyTickets: async (): Promise<SupportTicketResponse[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.SUPPORT.MY_TICKETS);
    return Array.isArray(data) ? data : [];
  },
};
