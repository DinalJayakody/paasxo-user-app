import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';
import { ReelSummary } from '../types/api';

export interface CreateReelParams {
  mediaUri: string;
  mimeType: string;
  thumbnailUri?: string;
  caption?: string;
  durationSeconds?: number;
  filterName?: string;
  captionText?: string;
  captionColor?: string;
  captionX?: number;
  captionY?: number;
  emoji?: string;
  emojiX?: number;
  emojiY?: number;
  audioTrackId?: string;
  audioTrackUrl?: string;
  audioVolume?: number;
}

function normalizePage(data: any): { content: ReelSummary[]; hasMore: boolean } {
  if (Array.isArray(data)) return { content: data, hasMore: false };
  const content = Array.isArray(data?.content) ? data.content : [];
  return { content, hasMore: !!data?.hasMore };
}

export const reelApi = {
  createReel: async (params: CreateReelParams): Promise<ReelSummary> => {
    const formData = new FormData();
    formData.append('media', {
      uri: params.mediaUri,
      name: 'reel.mp4',
      type: params.mimeType,
    } as any);
    if (params.thumbnailUri) {
      formData.append('thumbnail', {
        uri: params.thumbnailUri,
        name: 'reel-thumb.jpg',
        type: 'image/jpeg',
      } as any);
    }
    const request = {
      caption: params.caption,
      durationSeconds: params.durationSeconds,
      filterName: params.filterName ?? 'NORMAL',
      captionText: params.captionText,
      captionColor: params.captionColor,
      captionX: params.captionX,
      captionY: params.captionY,
      emoji: params.emoji,
      emojiX: params.emojiX,
      emojiY: params.emojiY,
      audioTrackId: params.audioTrackId,
      audioTrackUrl: params.audioTrackUrl,
      audioVolume: params.audioVolume,
    };
    formData.append('request', JSON.stringify(request));
    // Real video uploads over Wi-Fi/cellular can take far longer than the
    // app's default 15s API timeout (which is fine for JSON calls but was
    // silently killing large uploads from physical devices — worked
    // "instantly" on emulator's loopback network, timed out on real Wi-Fi).
    // Reels carry the biggest payloads of any upload in the app (raw
    // pre-compression video, up to the low hundreds of MB) and are the most
    // likely to land on a slow/throttled mobile connection, so this gets
    // more headroom than the 180s used for posts/stories: 5 minutes covers
    // a full up-to-200MB reel even over a slow upload link, plus the
    // server's own compression + R2 upload time on top.
    const { data } = await axiosInstance.post(ENDPOINTS.REELS.CREATE, formData, {
      // No explicit Content-Type — see socialMediaApi.ts's createPost for why
      // setting a boundary-less "multipart/form-data" here breaks uploads.
      timeout: 300000,
    });
    return data;
  },

  getUserReels: async (userId: string, page: number = 0, size: number = 12) => {
    const res = await axiosInstance.get(ENDPOINTS.REELS.GET_USER_REELS(userId, page, size));
    return normalizePage(res.data);
  },

  toggleLikeReel: async (reelId: string): Promise<ReelSummary> => {
    const { data } = await axiosInstance.post(ENDPOINTS.REELS.LIKE(reelId));
    return data;
  },

  recordView: async (reelId: string): Promise<void> => {
    await axiosInstance.post(ENDPOINTS.REELS.VIEW(reelId)).catch(() => {});
  },
};
