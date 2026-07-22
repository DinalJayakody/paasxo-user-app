import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';
import { UserProfile } from '../types/api';

export interface ProfileImageAsset {
  uri: string;
  name?: string;
  type?: string;
}

export interface UpdateProfilePayload {
  displayName?: string;
  phoneNumber?: string;
  bio?: string;
  sports?: string[];
  skillLevel?: string;
  locationAccess?: boolean;
  profileImage?: ProfileImageAsset;
}

export const userApi = {
  getProfile: async (): Promise<UserProfile> => {
    const { data } = await axiosInstance.get(ENDPOINTS.USER.PROFILE);
    return data;
  },

  // PUT /auth/profile is multipart on the backend (UpdateProfileRequest bound
  // via @ModelAttribute + an optional profileImage file part) - every field
  // is sent as a plain form field, never as a JSON body.
  updateProfile: async (payload: UpdateProfilePayload): Promise<UserProfile> => {
    const formData = new FormData();
    if (payload.displayName !== undefined) formData.append('displayName', payload.displayName);
    if (payload.phoneNumber !== undefined) formData.append('phoneNumber', payload.phoneNumber);
    if (payload.bio !== undefined) formData.append('bio', payload.bio);
    if (payload.skillLevel !== undefined) formData.append('skillLevel', payload.skillLevel);
    if (payload.locationAccess !== undefined) formData.append('locationAccess', String(payload.locationAccess));
    payload.sports?.forEach((sport) => formData.append('sports', sport));
    if (payload.profileImage) {
      formData.append('profileImage', {
        uri: payload.profileImage.uri,
        name: payload.profileImage.name || 'avatar.jpg',
        type: payload.profileImage.type || 'image/jpeg',
      } as any);
    }

    const { data } = await axiosInstance.put(ENDPOINTS.USER.UPDATE_PROFILE, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  // Thin convenience wrapper around updateProfile for the avatar-only flow
  // (tap avatar -> pick from gallery/camera) so callers don't need to know
  // the endpoint is shared with the full edit-profile form.
  uploadAvatar: async (image: ProfileImageAsset): Promise<UserProfile> => {
    return userApi.updateProfile({ profileImage: image });
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
