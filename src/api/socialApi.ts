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
   * Exchange a Firebase ID token (minted from Apple's native Sign In with
   * Apple credential - see src/utils/appleSignIn.ts) for app JWT tokens
   * @param idToken - Firebase ID token, same shape as loginWithGoogle
   * @returns AuthResponse with accessToken, refreshToken, and user profile
   */
  loginWithApple: async (idToken: string): Promise<AuthResponse> => {
    const { data } = await axiosInstance.post(
      ENDPOINTS.AUTH.APPLE_LOGIN,
      { idToken }
    );
    return data;
  },
};

/*
  Implementation Notes:

  Both Google and Apple sign-in follow the same shape (see SignInScreen.tsx /
  SignUpScreen.tsx and src/utils/appleSignIn.ts):
    - The screen runs the provider's native/OAuth flow, exchanges the result
      for a Firebase credential, and gets a Firebase ID token via
      result.user.getIdToken().
    - That Firebase ID token is the `idToken` sent here to
      com.pasxo.controller.AuthController#loginWithGoogle / #loginWithApple
      (POST /auth/login-google / POST /auth/login-apple).
    - Backend verifies it with FirebaseAuth.verifyIdToken, then finds-or-creates
      the Mongo user (com.pasxo.service.AuthService#loginWithGoogle / #loginWithApple).
    - First-time social users are created with profileCompleted=false (no
      sports/referralCode yet) — AuthContext shows CompleteProfileModal
      until authApi.completeProfile is called.

  Apple only ever sends the user's full name on the FIRST authorization for a
  given Apple ID, and never inside the identity token itself - appleSignIn.ts
  pushes it onto the Firebase profile's displayName client-side before minting
  the ID token, so the backend sees it the same way it sees a Google displayName.

  Apple Sign In only has a native flow on iOS (see APPLE_SIGN_IN_AVAILABLE in
  src/utils/appleSignIn.ts) - the button is hidden on Android/web.
*/
