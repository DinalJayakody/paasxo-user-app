import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';
import { LoginPayload, RegisterPayload, AuthResponse } from '../types/api';

export const authApi = {
    login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const { data } = await axiosInstance.post(ENDPOINTS.AUTH.LOGIN, payload);
    return data;
  },

  register: async (payload: RegisterPayload): Promise<AuthResponse> => {

const formData = new FormData();

// Build the JSON request part (all non-file fields)
const request = {
  email: payload.email,
  password: payload.password,
  displayName: payload.displayName,
  phoneNumber: payload.phoneNumber,
  sports: payload.sports,
  referralCode: payload.referralCode,
};

console.log('Register payload:', request, 'Avatar URI:', payload.profileImage);

// 🔥 2. Append request as JSON blob (IMPORTANT)
formData.append(
  "request",
  JSON.stringify(request)
);

// 🔥 3. Append file separately
if (payload.profileImage) {
formData.append("profileImage", {
    uri: payload.profileImage.uri,
    name: payload.profileImage.name || "profile.jpg",
    type: payload.profileImage.type || "image/jpeg",
  } as any);
}
  // formData.append("profileImage", {
  //   uri: payload.profileImage,
  //   // name: "profile.jpg",
  //   // type: "image/jpeg",
  // } as any);

// }

    const { data } = await axiosInstance.post(ENDPOINTS.AUTH.REGISTER, formData);
    return data;
  },

  // Placeholder for refresh token call
  refreshToken: async (refreshToken: string) => {
    const { data } = await axiosInstance.post(ENDPOINTS.AUTH.REFRESH, { refreshToken });
    return data;
  },
};

/*
  Guide:
  - Add new auth-related endpoints to `endpoints.ts` and call them here.
  - Keep functions small and focused (single responsibility).
  - Handle errors where these functions are called (screens, contexts) using try/catch.
*/
