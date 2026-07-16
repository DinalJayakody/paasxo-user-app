import { CreatePostPayload } from '../types/api';
import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';

export const socialMediaApi = {
  createPost: async (payload: CreatePostPayload) => {
    const formData = new FormData();

    const requestPayload = {
        caption: payload.caption,
  sport: payload.sport,
        visibility: payload.visibility,
        locationName: payload.locationName,
        latitude: payload.latitude,
        longitude: payload.longitude,
        taggedUsers: payload.taggedUsers,
    };

    formData.append('request', JSON.stringify(requestPayload));


    formData.append('media', {
      uri: payload.media.uri,
      name: payload.media.fileName || 'post.jpg',
      type: payload.media.mimeType || 'image/jpeg',
    } as any);

    const response = await axiosInstance.post(
      ENDPOINTS.SOCIAL.CREATE_POST,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        // Default 15s API timeout is fine for JSON calls but too short for a
        // real video/image upload over Wi-Fi from a physical device.
        timeout: 180000,
      }
    );

    return response.data;
  },

  searchUsers: async (query: string, page: number = 0, size: number = 10) => {
    const response = await axiosInstance.get(
      ENDPOINTS.SOCIAL.SEARCH_USERS(query, page, size)
    );
    return normalizePage(response.data);
  },

  getUsersByFirebaseUids: async (uids: string[]) => {
    if (uids.length === 0) return [];
    const response = await axiosInstance.post(
      ENDPOINTS.SOCIAL.USERS_BY_FIREBASE_UIDS,
      { uids }
    );
    const data = response.data;
    return Array.isArray(data) ? data
      : Array.isArray(data?.data) ? data.data
      : [];
  },

getPosts: async (page: number = 0, size: number = 10) => {
    const res = await axiosInstance.get(ENDPOINTS.SOCIAL.FEED(page, size));
    return normalizePage(res.data);
  },

  getUserProfile: async (userId: string) => {
  const response = await axiosInstance.get(
    ENDPOINTS.SOCIAL.GET_USER_PROFILE(userId)
  );

  return response.data;
},

followUser: async (userId: string) => {
  const response = await axiosInstance.post(
    ENDPOINTS.SOCIAL.FOLLOW(userId)
  );
  return response.data;
},

unfollowUser: async (userId: string) => {
  const response = await axiosInstance.post(
    ENDPOINTS.SOCIAL.UNFOLLOW(userId)
  );
  return response.data;
},

getUserPosts: async (userId: string, page: number = 0, size: number = 10) => {
  const response = await axiosInstance.get(ENDPOINTS.SOCIAL.GET_USER_POSTS(userId, page, size));
  return normalizePage(response.data);
},

// The backend only has one toggle endpoint (POST .../like) - it flips like/unlike
// server-side based on current membership, there is no separate /unlike route.
toggleLikePost: async (postId: string | number) => {
  const response = await axiosInstance.post(ENDPOINTS.SOCIAL.LIKE_POST(postId));
  return response.data;
},

toggleSavePost: async (postId: string | number) => {
  const response = await axiosInstance.post(ENDPOINTS.SOCIAL.SAVE_POST(postId));
  return response.data;
},

getSavedPosts: async (page: number = 0, size: number = 10) => {
  const response = await axiosInstance.get(ENDPOINTS.SOCIAL.GET_SAVED_POSTS(page, size));
  return normalizePage(response.data);
},

getComments: async (postId: string | number) => {
  const response = await axiosInstance.get(
    ENDPOINTS.SOCIAL.GET_COMMENTS(postId)
  );
  const data = response.data;
  return Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : [];
},

addComment: async (postId: string | number, payload: { content?: string; gifUrl?: string }) => {
  const response = await axiosInstance.post(
    ENDPOINTS.SOCIAL.ADD_COMMENT(postId),
    payload
  );
  return response.data;
},

getFollowers: async (userId: string, page: number = 0, size: number = 10) => {
  const response = await axiosInstance.get(ENDPOINTS.SOCIAL.GET_FOLLOWERS(userId, page, size));
  return normalizePage(response.data);
},

getFollowing: async (userId: string, page: number = 0, size: number = 10) => {
  const response = await axiosInstance.get(ENDPOINTS.SOCIAL.GET_FOLLOWING(userId, page, size));
  return normalizePage(response.data);
},

getSuggestedUsers: async (page: number = 0, size: number = 10) => {
  const response = await axiosInstance.get(ENDPOINTS.SOCIAL.GET_SUGGESTED(page, size));
  return normalizePage(response.data);
},

getFollowRequests: async (page: number = 0, size: number = 10) => {
  const response = await axiosInstance.get(ENDPOINTS.SOCIAL.GET_REQUESTS(page, size));
  return normalizePage(response.data);
},

acceptFollowRequest: async (requesterUid: string) => {
  const response = await axiosInstance.post(ENDPOINTS.SOCIAL.ACCEPT_REQUEST(requesterUid));
  return response.data;
},

rejectFollowRequest: async (requesterUid: string) => {
  const response = await axiosInstance.post(ENDPOINTS.SOCIAL.REJECT_REQUEST(requesterUid));
  return response.data;
},

};

// Normalizes the backend's PagedResponse<T> ({content, page, hasMore}) shape,
// tolerating a bare array in case a caller hits an older/unpaginated build.
function normalizePage(data: any): { content: any[]; hasMore: boolean } {
  if (Array.isArray(data)) return { content: data, hasMore: false };
  const content = Array.isArray(data?.content) ? data.content : [];
  return { content, hasMore: !!data?.hasMore };
}