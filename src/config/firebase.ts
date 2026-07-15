// ─── Firebase Configuration ───────────────────────────────────────────────────
//
// HOW TO GET THIS:
// 1. Go to https://console.firebase.google.com
// 2. Open your project → Project Settings (gear icon) → Your apps → Web app
// 3. Copy the firebaseConfig object and paste the values below.
//
// Enable Google Sign-In:
//   Firebase Console → Authentication → Sign-in method → Google → Enable
//
// The same Firebase project must be what your Spring Boot backend
// initialises with Firebase Admin SDK.

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  // apiKey + projectId pulled from the backend's application.yml (firebase.api-key /
  // firebase.project-id) — same Firebase project the Admin SDK verifies tokens against.
  apiKey:            'AIzaSyBPw64jTzdD2SYrUje39tC5TGp8qiwzRhI',
  authDomain:        'paasxo-a3769.firebaseapp.com',
  projectId:         'paasxo-a3769',
  storageBucket:     'paasxo-a3769.appspot.com',
  // Still need these two — Firebase Console → Project Settings → General →
  // Your apps → (any) Web app → SDK setup and configuration.
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId:             'YOUR_APP_ID',
};

export const FIREBASE_CONFIGURED = !firebaseConfig.apiKey.startsWith('YOUR_');

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!FIREBASE_CONFIGURED) return null;
  if (!_app) {
    _app = getApps().length === 0
      ? initializeApp(firebaseConfig)
      : getApps()[0];
  }
  return _app;
}

export function getFirebaseAuth(): Auth | null {
  if (!FIREBASE_CONFIGURED) return null;
  if (!_auth) {
    const app = getFirebaseApp();
    if (!app) return null;
    _auth = getAuth(app);
  }
  return _auth;
}
