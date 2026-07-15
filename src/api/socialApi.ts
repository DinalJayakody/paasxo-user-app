import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';
import { AuthResponse } from '../types/api';

/**
 * Social Authentication API
 * Handles Google and Apple sign-in by exchanging social provider tokens
 * with backend JWT tokens
 */

export const socialApi = {
  /**
   * Exchange Google ID token for app JWT tokens
   * @param idToken - Token received from Google Sign-In SDK
   * @returns AuthResponse with accessToken, refreshToken, and user profile
   */
  loginWithGoogle: async (idToken: string): Promise<AuthResponse> => {
    const { data } = await axiosInstance.post(
      ENDPOINTS.AUTH.GOOGLE_LOGIN,
      { idToken }
    );
    return data;
  },

  /**
   * Exchange Apple ID token for app JWT tokens
   * @param identityToken - Token received from Apple Sign-In SDK
   * @param user - Apple user data (name, email) from first sign-in only
   * @returns AuthResponse with accessToken, refreshToken, and user profile
   */
  loginWithApple: async (
    identityToken: string,
    user?: { email?: string; fullName?: { givenName?: string; familyName?: string } }
  ): Promise<AuthResponse> => {
    const { data } = await axiosInstance.post(
      ENDPOINTS.AUTH.APPLE_LOGIN,
      { identityToken, user }
    );
    return data;
  },
};

/*
  Implementation Notes:

  1. Google Sign-In Flow (see SignInScreen.tsx / SignUpScreen.tsx):
     - Screen runs expo-auth-session's Google OAuth flow, exchanges the
       result for a Firebase credential, and gets a Firebase ID token via
       result.user.getIdToken().
     - That Firebase ID token is the `idToken` sent here to
       com.pasxo.controller.AuthController#loginWithGoogle (POST /auth/login-google).
     - Backend verifies it with FirebaseAuth.verifyIdToken, then finds-or-creates
       the Mongo user (com.pasxo.service.AuthService#loginWithGoogle).
     - First-time Google users are created with profileCompleted=false (no
       sports/referralCode yet) — AuthContext shows CompleteProfileModal
       until authApi.completeProfile is called.

  2. Apple Sign-In Flow:
     - Similar to Google but Apple ID tokens are JWTs themselves.
     - Apple returns user data (email, name) ONLY on first sign-in.
     - Must save this info because Apple won't send it again.
     - Tokens are time-limited; refresh required.
     - NOT yet implemented on the backend (no /auth/social/apple endpoint) -
       loginWithApple below will 404 until that's added.
*/
