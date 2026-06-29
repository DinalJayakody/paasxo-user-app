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
    const { data } = await axiosInstance.post(ENDPOINTS.STORIES.CREATE, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
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
