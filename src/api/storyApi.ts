import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';

export interface StoryItem {
  id: string;
  firebaseUid: string;
  authorDisplayName: string;
  authorProfileImageUrl: string;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
  durationSeconds: number;
  filterName: string;
  captionText?: string;
  captionColor?: string;
  captionX?: number;
  captionY?: number;
  emoji?: string;
  emojiX?: number;
  emojiY?: number;
  isBoomerang?: boolean;
  audioTrackUrl?: string;
  audioVolume?: number;
  viewCount: number;
  viewedByMe: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface UserStoryGroup {
  firebaseUid: string;
  displayName: string;
  profileImageUrl: string;
  hasUnseen: boolean;
  isOwn: boolean;
  stories: StoryItem[];
}

export const storyApi = {
  createStory: async (params: {
    mediaUri: string;
    mediaType: 'IMAGE' | 'VIDEO';
    mimeType: string;
    durationSeconds?: number;
    filterName?: string;
    captionText?: string;
    captionColor?: string;
    captionX?: number;
    captionY?: number;
    emoji?: string;
    emojiX?: number;
    emojiY?: number;
    isBoomerang?: boolean;
    audioTrackId?: string;
    audioTrackUrl?: string;
    audioVolume?: number;
  }): Promise<StoryItem> => {
    const formData = new FormData();
    formData.append('media', {
      uri: params.mediaUri,
      name: params.mediaType === 'VIDEO' ? 'story.mp4' : 'story.jpg',
      type: params.mimeType,
    } as any);
    formData.append('mediaType', params.mediaType);
    formData.append('filterName', params.filterName ?? 'NORMAL');
    if (params.durationSeconds != null) {
      formData.append('durationSeconds', String(params.durationSeconds));
    }
    if (params.captionText) formData.append('captionText', params.captionText);
    if (params.captionColor) formData.append('captionColor', params.captionColor);
    if (params.captionX != null) formData.append('captionX', String(params.captionX));
    if (params.captionY != null) formData.append('captionY', String(params.captionY));
    if (params.emoji) formData.append('emoji', params.emoji);
    if (params.emojiX != null) formData.append('emojiX', String(params.emojiX));
    if (params.emojiY != null) formData.append('emojiY', String(params.emojiY));
    if (params.isBoomerang) formData.append('isBoomerang', 'true');
    if (params.audioTrackId) formData.append('audioTrackId', params.audioTrackId);
    if (params.audioTrackUrl) formData.append('audioTrackUrl', params.audioTrackUrl);
    if (params.audioVolume != null) formData.append('audioVolume', String(params.audioVolume));
    // Boomerang processing (server-side ffmpeg) adds real time on top of the
    // upload itself, on top of the same real-network timeout issue reels had.
    const { data } = await axiosInstance.post(ENDPOINTS.STORIES.CREATE, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
    });
    return data;
  },

  getFeedStories: async (): Promise<UserStoryGroup[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.STORIES.FEED);
    return Array.isArray(data) ? data : [];
  },

  getMyStories: async (): Promise<StoryItem[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.STORIES.MY);
    return Array.isArray(data) ? data : [];
  },

  markViewed: async (storyId: string): Promise<void> => {
    await axiosInstance.post(ENDPOINTS.STORIES.VIEW(storyId)).catch(() => {});
  },

  deleteStory: async (storyId: string): Promise<void> => {
    await axiosInstance.delete(ENDPOINTS.STORIES.DELETE(storyId));
  },
};
