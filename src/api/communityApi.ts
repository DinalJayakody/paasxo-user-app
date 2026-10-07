import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';
import { PostSummary } from '../types/api';

export interface Community {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  sport?: string;
  creatorFirebaseUid: string;
  memberCount: number;
  isPrivate: boolean;
  // All three are caller-relative, computed fresh by the backend per request.
  isMember: boolean;
  isAdmin: boolean;
  hasPendingRequest: boolean;
  createdAt: string;
}

export interface CommunityJoinRequestItem {
  id: string;
  communityId: string;
  requesterFirebaseUid: string;
  requesterDisplayName: string;
  requesterProfileImageUrl?: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: string;
}

export interface CreateCommunityPayload {
  name: string;
  description?: string;
  sport?: string;
  isPrivate?: boolean;
  avatar?: { uri: string; fileName?: string; mimeType?: string };
  cover?: { uri: string; fileName?: string; mimeType?: string };
}

// Tolerates a bare array, same defensive normalization socialMediaApi.ts's
// own normalizePage applies, in case a caller ever hits an older/
// unpaginated build.
function normalizePage<T>(data: any): { content: T[]; hasMore: boolean } {
  if (Array.isArray(data)) return { content: data, hasMore: false };
  const content = Array.isArray(data?.content) ? data.content : [];
  return { content, hasMore: !!data?.hasMore };
}

export const communityApi = {
  create: async (payload: CreateCommunityPayload): Promise<Community> => {
    const formData = new FormData();
    formData.append('request', JSON.stringify({
      name: payload.name,
      description: payload.description,
      sport: payload.sport,
      isPrivate: payload.isPrivate ?? false,
    }));
    if (payload.avatar) {
      formData.append('avatar', {
        uri: payload.avatar.uri, name: payload.avatar.fileName || 'avatar.jpg', type: payload.avatar.mimeType || 'image/jpeg',
      } as any);
    }
    if (payload.cover) {
      formData.append('cover', {
        uri: payload.cover.uri, name: payload.cover.fileName || 'cover.jpg', type: payload.cover.mimeType || 'image/jpeg',
      } as any);
    }
    const { data } = await axiosInstance.post(ENDPOINTS.COMMUNITIES.CREATE, formData);
    return data;
  },

  search: async (query: string, page = 0, size = 20): Promise<{ content: Community[]; hasMore: boolean }> => {
    const { data } = await axiosInstance.get(ENDPOINTS.COMMUNITIES.SEARCH, { params: { q: query, page, size } });
    return normalizePage<Community>(data);
  },

  discover: async (page = 0, size = 20): Promise<{ content: Community[]; hasMore: boolean }> => {
    const { data } = await axiosInstance.get(ENDPOINTS.COMMUNITIES.DISCOVER, { params: { page, size } });
    return normalizePage<Community>(data);
  },

  getMine: async (page = 0, size = 20): Promise<{ content: Community[]; hasMore: boolean }> => {
    const { data } = await axiosInstance.get(ENDPOINTS.COMMUNITIES.MINE, { params: { page, size } });
    return normalizePage<Community>(data);
  },

  getById: async (id: string): Promise<Community> => {
    const { data } = await axiosInstance.get(ENDPOINTS.COMMUNITIES.GET_BY_ID(id));
    return data;
  },

  join: async (id: string): Promise<Community> => {
    const { data } = await axiosInstance.post(ENDPOINTS.COMMUNITIES.JOIN(id));
    return data;
  },

  leave: async (id: string): Promise<void> => {
    await axiosInstance.post(ENDPOINTS.COMMUNITIES.LEAVE(id));
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(ENDPOINTS.COMMUNITIES.DELETE(id));
  },

  getPendingRequests: async (id: string): Promise<CommunityJoinRequestItem[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.COMMUNITIES.PENDING_REQUESTS(id));
    return Array.isArray(data) ? data : [];
  },

  approveRequest: async (id: string, requestId: string): Promise<void> => {
    await axiosInstance.post(ENDPOINTS.COMMUNITIES.APPROVE_REQUEST(id, requestId));
  },

  declineRequest: async (id: string, requestId: string): Promise<void> => {
    await axiosInstance.post(ENDPOINTS.COMMUNITIES.DECLINE_REQUEST(id, requestId));
  },

  getFeed: async (id: string, page = 0, size = 20): Promise<{ content: PostSummary[]; hasMore: boolean }> => {
    const { data } = await axiosInstance.get(ENDPOINTS.COMMUNITIES.FEED(id), { params: { page, size } });
    return normalizePage<PostSummary>(data);
  },

  createPost: async (id: string, payload: {
    caption?: string;
    media?: { uri: string; fileName?: string; mimeType?: string };
    thumbnail?: { uri: string; fileName?: string; mimeType?: string };
    mediaType?: 'IMAGE' | 'VIDEO';
  }): Promise<PostSummary> => {
    const formData = new FormData();
    formData.append('request', JSON.stringify({ caption: payload.caption, mediaType: payload.mediaType }));
    if (payload.media) {
      formData.append('media', {
        uri: payload.media.uri, name: payload.media.fileName || 'post.jpg', type: payload.media.mimeType || 'image/jpeg',
      } as any);
    }
    if (payload.thumbnail) {
      formData.append('thumbnail', {
        uri: payload.thumbnail.uri, name: payload.thumbnail.fileName || 'thumb.jpg', type: payload.thumbnail.mimeType || 'image/jpeg',
      } as any);
    }
    const { data } = await axiosInstance.post(ENDPOINTS.COMMUNITIES.CREATE_POST(id), formData);
    return data;
  },

  /** Shares an existing match/tournament/scorecard/reel into a community's
   *  feed — see ShareToCommunityRequest on the backend. shareType is one of
   *  'MATCH' | 'TOURNAMENT' | 'SCORECARD' | 'REEL'. */
  share: async (id: string, shareType: string, referenceId: string, caption?: string): Promise<PostSummary> => {
    const { data } = await axiosInstance.post(ENDPOINTS.COMMUNITIES.SHARE(id), { shareType, referenceId, caption });
    return data;
  },

  deletePost: async (id: string, postId: string): Promise<void> => {
    await axiosInstance.delete(ENDPOINTS.COMMUNITIES.DELETE_POST(id, postId));
  },
};
