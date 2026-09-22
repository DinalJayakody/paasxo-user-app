import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { OAuthProvider, signInWithCredential, updateProfile } from 'firebase/auth';
import { getFirebaseAuth, FIREBASE_CONFIGURED } from '../config/firebase';

// Sign In with Apple only has a native implementation on iOS (Apple's
// AuthenticationServices framework) - no Android/web support here.
export const APPLE_SIGN_IN_AVAILABLE = Platform.OS === 'ios';

// Lazy/conditional require rather than a static import: this native module
// has no web build at all (not even a stub), so a static import breaks
// `expo export --platform web` outright — Metro's web bundler tries to
// resolve it regardless of whether performAppleSignIn ever actually runs on
// web (it never does, guarded by APPLE_SIGN_IN_AVAILABLE below). Same
// pattern CaptureFlow.tsx already uses for other native-only modules.
const appleAuth = Platform.OS === 'ios'
  ? require('@invertase/react-native-apple-authentication').appleAuth
  : null;

export interface AppleSignInResult {
  idToken: string;
  // Apple's one-time authorization code, forwarded to the backend so it can
  // exchange it server-side for a refresh token (see AppleAuthRestClient) -
  // stored only so a later account deletion can revoke Apple's grant, per
  // Apple's App Store requirement for apps using Sign in with Apple.
  authorizationCode: string | null;
}

// Runs Apple's native Sign In With Apple flow and exchanges the result for a
// Firebase ID token, mirroring the Google flow (expo-auth-session -> Firebase
// credential -> ID token) so the backend only ever has to verify one kind of
// token regardless of provider.
export async function performAppleSignIn(): Promise<AppleSignInResult> {
  if (!appleAuth) {
    throw new Error('Sign in with Apple is only available on iOS.');
  }
  if (!FIREBASE_CONFIGURED) {
    throw new Error('Firebase is not configured yet.');
  }
  const firebaseAuth = getFirebaseAuth()!;

  // Raw nonce handed to Firebase's credential; the native module SHA256-hashes
  // this before sending it to Apple, so Apple's identityToken embeds the hash
  // while Firebase re-hashes this raw value to confirm the two match - replay
  // protection, same purpose as the OAuth state/nonce already used for Google.
  const rawNonce = Crypto.randomUUID();

  const appleResponse = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
    nonce: rawNonce,
  });

  const { identityToken, fullName, authorizationCode } = appleResponse;
  if (!identityToken) {
    throw new Error('Apple sign-in did not return an identity token.');
  }

  const credential = new OAuthProvider('apple.com').credential({
    idToken: identityToken,
    rawNonce,
  });
  const result = await signInWithCredential(firebaseAuth, credential);

  // Apple only ever sends the user's name on the FIRST authorization for a
  // given Apple ID - persist it onto the Firebase profile now, before reading
  // the ID token, since it won't be sent again on subsequent logins.
  const displayName = [fullName?.givenName, fullName?.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (displayName) {
    await updateProfile(result.user, { displayName });
  }

  return {
    idToken: await result.user.getIdToken(),
    authorizationCode: authorizationCode ?? null,
  };
}
