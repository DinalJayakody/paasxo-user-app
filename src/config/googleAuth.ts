// ─── Google OAuth Client IDs ──────────────────────────────────────────────────
//
// HOW TO GET THESE:
// 1. Go to https://console.cloud.google.com → APIs & Services → Credentials
// 2. Create "OAuth 2.0 Client IDs" for each platform:
//    • Web       → Application type: "Web application"
//                  Authorized redirect URIs: https://paasxo-sports.vercel.app
//                                            http://localhost:19006
//    • iOS       → Application type: "iOS"
//                  Bundle ID: com.paasxo.app
//    • Android   → Application type: "Android"
//                  Package name: com.paasxo.app
//                  SHA-1: run `cd android && ./gradlew signingReport`
// 3. Paste the generated client IDs below.

export const GOOGLE_CLIENT_IDS = {
  WEB:     'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  IOS:     'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
  ANDROID: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
} as const;

export const GOOGLE_CONFIGURED =
  !GOOGLE_CLIENT_IDS.WEB.startsWith('YOUR_');
