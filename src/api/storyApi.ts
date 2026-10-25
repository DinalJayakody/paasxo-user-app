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
  taggedUsers?: { firebaseUid: string; displayName: string; profileImageUrl?: string }[];
  captionStyle?: string;
  captionScale?: number;
  locationName?: string;
  locationPlaceId?: string;
  locationLat?: number;
  locationLng?: number;
  locationX?: number;
  locationY?: number;
  effect?: string;
  /** Video posted with its sound off. */
  soundOff?: boolean;
  /** You may reply to this story (it's not yours and the author allows replies). */
  canReply?: boolean;
  /** You're tagged and may add this story to yours. */
  canReshare?: boolean;
  resharedFromStoryId?: string | null;
  resharedFromUid?: string | null;
  resharedFromName?: string | null;
  viewCount: number;
  viewedByMe: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface StorySettings {
  repliesEnabled: boolean;
  allowReshare: boolean;
  hiddenFromUids: string[];
  hiddenFrom: { firebaseUid: string; displayName: string; profileImageUrl?: string }[];
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
    taggedUserIds?: string[];
    captionStyle?: string;
    captionScale?: number;
    locationName?: string;
    locationPlaceId?: string;
    locationLat?: number;
    locationLng?: number;
    locationX?: number;
    locationY?: number;
    effect?: string;
    soundOff?: boolean;
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
    if (params.taggedUserIds?.length) formData.append('taggedUserIds', params.taggedUserIds.join(','));
    if (params.captionText && params.captionStyle) formData.append('captionStyle', params.captionStyle);
    if (params.captionText && params.captionScale != null) formData.append('captionScale', String(params.captionScale));
    if (params.locationName) {
      formData.append('locationName', params.locationName);
      if (params.locationPlaceId) formData.append('locationPlaceId', params.locationPlaceId);
      if (params.locationLat != null && params.locationLng != null) {
        formData.append('locationLat', String(params.locationLat));
        formData.append('locationLng', String(params.locationLng));
      }
      if (params.locationX != null) formData.append('locationX', String(params.locationX));
      if (params.locationY != null) formData.append('locationY', String(params.locationY));
    }
    if (params.effect) formData.append('effect', params.effect);
    if (params.soundOff && params.mediaType === 'VIDEO') formData.append('soundOff', 'true');
    // Boomerang processing (server-side ffmpeg) adds real time on top of the
    // upload itself, on top of the same real-network timeout issue reels had.
    // Video stories can be just as large as reels (see reelApi.ts's
    // createReel for why 300s), so match it here rather than the 180s used
    // for image-only uploads.
    const { data } = await axiosInstance.post(ENDPOINTS.STORIES.CREATE, formData, {
      // No explicit Content-Type — see socialMediaApi.ts's createPost for why
      // setting a boundary-less "multipart/form-data" here breaks uploads.
      timeout: params.mediaType === 'VIDEO' ? 300000 : 180000,
    });
    return data;
  },

  getFeedStories: async (): Promise<UserStoryGroup[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.STORIES.FEED);
    return Array.isArray(data) ? data : [];
  },

  // One live story (shared link / tag notification) — privacy-checked server-side.
  getStory: async (storyId: string): Promise<StoryItem> => {
    const { data } = await axiosInstance.get(`/stories/${encodeURIComponent(storyId)}`);
    return data;
  },

  // Who has seen your own story.
  getViewers: async (storyId: string): Promise<{ firebaseUid: string; displayName: string; profileImageUrl?: string }[]> => {
    const { data } = await axiosInstance.get(`/stories/${encodeURIComponent(storyId)}/viewers`);
    return Array.isArray(data) ? data : [];
  },

  getMyStories: async (): Promise<StoryItem[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.STORIES.MY);
    return Array.isArray(data) ? data : [];
  },

  markViewed: async (storyId: string): Promise<void> => {
    await axiosInstance.post(ENDPOINTS.STORIES.VIEW(storyId)).catch(() => {});
  },

  getSettings: async (): Promise<StorySettings> => {
    const { data } = await axiosInstance.get('/stories/settings');
    return data;
  },

  updateSettings: async (patch: { repliesEnabled?: boolean; allowReshare?: boolean; hiddenFromUids?: string[] }): Promise<StorySettings> => {
    const { data } = await axiosInstance.put('/stories/settings', patch);
    return data;
  },

  /** Reply to someone's story — it lands in your chat with them. */
  reply: async (storyId: string, text: string): Promise<void> => {
    await axiosInstance.post(`/stories/${encodeURIComponent(storyId)}/reply`, { text });
  },

  /** Add a story you're tagged in to your own story. */
  reshare: async (storyId: string): Promise<StoryItem> => {
    const { data } = await axiosInstance.post(`/stories/${encodeURIComponent(storyId)}/reshare`);
    return data;
  },

  deleteStory: async (storyId: string): Promise<void> => {
    await axiosInstance.delete(ENDPOINTS.STORIES.DELETE(storyId));
  },
};
