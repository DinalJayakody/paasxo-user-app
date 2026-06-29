import { CreatePostPayload } from '../types/api';
import axiosInstance from './axios';
import endpoints, { ENDPOINTS } from './endpoints';

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
      }
    );

    return response.data;
  },

  searchUsers: async (query: string) => {
    const response = await axiosInstance.get(
      ENDPOINTS.SOCIAL.SEARCH_USERS(query)
    );
    return response.data;
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

getPosts: async (page: number, size: number = 10) => {
    const res = await axiosInstance.get(
      `${endpoints.SOCIAL.FEED}?page=${page}&size=${size}`
    );

    return res.data;
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

getUserPosts: async (userId: string) => {
  const response = await axiosInstance.get(
    ENDPOINTS.SOCIAL.GET_USER_POSTS(userId)
  );
  const data = response.data;
  return Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : [];
},

likePost: async (postId: string | number) => {
  const response = await axiosInstance.post(
    ENDPOINTS.SOCIAL.LIKE_POST(postId)
  );
  return response.data;
},

unlikePost: async (postId: string | number) => {
  const response = await axiosInstance.post(
    ENDPOINTS.SOCIAL.UNLIKE_POST(postId)
  );
  return response.data;
},

getComments: async (postId: string | number) => {
  const response = await axiosInstance.get(
    ENDPOINTS.SOCIAL.GET_COMMENTS(postId)
  );
  const data = response.data;
  return Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : [];
},

addComment: async (postId: string | number, text: string) => {
  const response = await axiosInstance.post(
    ENDPOINTS.SOCIAL.ADD_COMMENT(postId),
    { text }
  );
  return response.data;
},

getFollowers: async (userId: string) => {
  const response = await axiosInstance.get(ENDPOINTS.SOCIAL.GET_FOLLOWERS(userId));
  const data = response.data;
  return Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : [];
},

getFollowing: async (userId: string) => {
  const response = await axiosInstance.get(ENDPOINTS.SOCIAL.GET_FOLLOWING(userId));
  const data = response.data;
  return Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : [];
},

};