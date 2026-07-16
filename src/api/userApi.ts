import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';
import { UserProfile } from '../types/api';

export const userApi = {
  getProfile: async (): Promise<UserProfile> => {
    const { data } = await axiosInstance.get(ENDPOINTS.USER.PROFILE);
    return data;
  },

  updateProfile: async (payload: Partial<UserProfile>) => {
    const { data } = await axiosInstance.put(ENDPOINTS.USER.PROFILE, payload);
    return data;
  },

  uploadAvatar: async (formData: FormData) => {
    // When uploading file, ensure axiosInstance has proper headers for multipart/form-data
    const { data } = await axiosInstance.post(ENDPOINTS.USER.UPLOAD_AVATAR, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  // Small dedicated JSON endpoints, kept separate from updateProfile (which is
  // multipart-only on the backend for the avatar upload flow).
  updatePrivacy: async (isPrivate: boolean) => {
    const { data } = await axiosInstance.patch(ENDPOINTS.SOCIAL.UPDATE_PRIVACY, { isPrivate });
    return data;
  },

  updateLocation: async (latitude: number, longitude: number) => {
    const { data } = await axiosInstance.patch(ENDPOINTS.SOCIAL.UPDATE_LOCATION, { latitude, longitude });
    return data;
  },
};

/*
  Notes:
  - For file upload on React Native, use `FormData()` and append the file with proper `uri`, `name`, and `type`.
  - Example:
    const fd = new FormData();
    fd.append('avatar', { uri: localUri, name: 'avatar.jpg', type: 'image/jpeg' } as any);
    await userApi.uploadAvatar(fd);
*/
