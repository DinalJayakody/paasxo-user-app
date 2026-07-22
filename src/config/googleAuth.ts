// ─── Google OAuth Client IDs ──────────────────────────────────────────────────
//
// WEB + IOS pulled from google-services.json (project paasxo-a3769):
//   - WEB is the client_type:3 entry under the top-level "oauth_client" array
//     (Firebase's auto-created "Web client").
//   - IOS is the client_type:2 entry under services.appinvite_service
//     .other_platform_oauth_client, matched by ios_info.bundle_id.
//
// ANDROID is still a placeholder: google-services.json has no client_type:1
// entry yet, which means no SHA-1 fingerprint has been added to the Android
// app in Firebase Console (Project Settings → your Android app →
// Add fingerprint). expo-auth-session uses androidClientId verbatim with no
// fallback to WEB, so leaving this unset means the Android button will fail
// until a real Android-type client ID is generated - Web/iOS work today.
export const GOOGLE_CLIENT_IDS = {
  WEB:     '135107198325-5tnmhagcsu2frmbl5fduk0qtvr9lb0et.apps.googleusercontent.com',
  IOS:     '135107198325-co0uscvalek3rq7jfulnai1j8gffm4sb.apps.googleusercontent.com',
  ANDROID: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
} as const;

export const GOOGLE_CONFIGURED =
  !GOOGLE_CLIENT_IDS.WEB.startsWith('YOUR_');
