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
  
  1. Google Sign-In Flow:
     - Frontend gets idToken from Google SDK
     - Sends idToken to backend /api/auth/social/google
     - Backend validates token with Google using credentials
     - Backend creates/updates user and returns JWT tokens
     
  2. Apple Sign-In Flow:
     - Similar to Google but Apple ID tokens are JWTs themselves
     - Apple returns user data (email, name) ONLY on first sign-in
     - Must save this info because Apple won't send it again
     - Tokens are time-limited; refresh required
     
  3. Backend Validation (Spring Boot example):
     
     @PostMapping("/api/auth/social/google")
     public ResponseEntity<?> googleSignIn(@RequestBody GoogleTokenRequest req) {
       // Verify idToken with Google
       GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(...)
         .setAudience(Collections.singletonList(GOOGLE_CLIENT_ID))
         .build();
       
       IdToken idToken = verifier.verify(req.getIdToken());
       String email = (String) idToken.getPayload().get("email");
       
       // Find or create user in database
       User user = userRepository.findByEmail(email)
         .orElseGet(() -> userRepository.save(new User(email)));
       
       // Generate JWT tokens
       String accessToken = jwtProvider.generateAccessToken(user.getId());
       String refreshToken = jwtProvider.generateRefreshToken(user.getId());
       
       return ResponseEntity.ok(new AuthResponse(accessToken, refreshToken, user));
     }
*/
