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
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT_ID.firebaseapp.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT_ID.appspot.com',
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
