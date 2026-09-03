import React, { createContext, useEffect, useState, useCallback, useContext, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus, DeviceEventEmitter, Platform } from 'react-native';
import { getRedirectResult } from 'firebase/auth';
import { authApi } from '../api/authApi';
import { socialApi } from '../api/socialApi';
import { AUTH_LOGOUT_EVENT } from '../api/axios';
import { AuthResponse, LoginPayload, RegisterPayload, UserProfile } from '../types/api';
import axiosInstance, { refreshTokenIfNeeded } from '../api/axios';
import { CompleteProfileModal } from '../components/CompleteProfileModal';
import { getFirebaseAuth, FIREBASE_CONFIGURED } from '../config/firebase';
import { clearSubscriptionCache } from '../hooks/useSubscription';

type AuthContextShape = {
  user: UserProfile | null;
  loading: boolean;
  // True only for a first-time Google sign-in that hasn't picked an
  // activity yet. Drives the CompleteProfileModal rendered below.
  needsProfileCompletion: boolean;
  signIn: (payload: LoginPayload) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<void>;
  signOut: () => Promise<void>;
  // signInWithGoogle receives the Firebase ID token obtained by the screen-level
  // OAuth flow (expo-auth-session + Firebase SignInWithCredential).
  signInWithGoogle: (firebaseIdToken: string) => Promise<void>;
  // signInWithApple mirrors signInWithGoogle: the screen runs Apple's native
  // Sign In with Apple flow (see src/utils/appleSignIn.ts), turns it into a
  // Firebase ID token, and passes it here.
  signInWithApple: (firebaseIdToken: string) => Promise<void>;
  // completeSocialSignIn is the lower-level helper kept for future providers.
  completeSocialSignIn: (provider: 'google' | 'apple', token: string, appleUser?: any) => Promise<void>;
  // Saves the activity + referral code collected by CompleteProfileModal.
  completeProfile: (sports: string[], referralCode?: string) => Promise<void>;
  // Applies a fresh profile object (e.g. the response from an avatar upload
  // or an Edit Profile save) to both in-memory state and cached storage,
  // without a full network refetch.
  updateUser: (profile: UserProfile) => Promise<void>;
};

export const AuthContext = createContext<AuthContextShape>({} as AuthContextShape);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // ─── Token persistence helpers ──────────────────────────────────────────────

  const persistTokens = async (tokens: AuthResponse) => {
    if (tokens.idToken) {
      await AsyncStorage.setItem('accessToken', tokens.idToken);
      await AsyncStorage.setItem('tokenIssuedAt', String(Date.now()));
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${tokens.idToken}`;
    }
    if (tokens.refreshToken) {
      await AsyncStorage.setItem('refreshToken', tokens.refreshToken);
    }
    if (tokens.user) {
      await AsyncStorage.setItem('user', JSON.stringify(tokens.user));
    }
  };

  // ─── Bootstrap: restore session from storage ────────────────────────────────

  const loadFromStorage = useCallback(async () => {
    setLoading(true);
    try {
      const storedToken = await AsyncStorage.getItem('accessToken');
      if (!storedToken) return;

      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;

      // Try to refresh the profile from server; fall back to cached user.
      try {
        const { data } = await axiosInstance.get('/auth/profile');
        setUser(data);
        await AsyncStorage.setItem('user', JSON.stringify(data));
      } catch {
        // Server unreachable or 401 (refresh interceptor will handle 401).
        // Fall back to cached user so the app still works offline.
        const cached = await AsyncStorage.getItem('user');
        if (cached) setUser(JSON.parse(cached));
      }
    } catch {
      // Storage unreadable — remain logged out.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Listen for the global logout event emitted by the axios refresh interceptor.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(AUTH_LOGOUT_EVENT, () => {
      setUser(null);
      setLoading(false);
    });
    return () => sub.remove();
  }, []);

  // Proactively refresh the access token whenever the app returns to the
  // foreground, so a token that would have expired while backgrounded is
  // already fresh before any screen makes a request — this is what actually
  // keeps "leave the app logged in and running in the background" true; the
  // reactive 401-then-refresh path in axios.ts only covers requests made
  // *after* expiry, not the transition back into the app.
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        refreshTokenIfNeeded();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // ─── Auth actions ────────────────────────────────────────────────────────────

  const signIn = async (payload: LoginPayload): Promise<void> => {
    try {
      const response = await authApi.login(payload);
      await persistTokens(response);
      setUser(response.user ?? null);
    } catch (error) {
      throw error;
    }
  };

  const signUp = async (payload: RegisterPayload): Promise<void> => {
    setLoading(true);
    try {
      const data: AuthResponse = await authApi.register(payload);
      await persistTokens(data);
      if (data.user) setUser(data.user);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user', 'tokenIssuedAt']);
      await clearSubscriptionCache();
    } catch { /* ignore */ }
    delete axiosInstance.defaults.headers.common['Authorization'];
    setUser(null);
  };

  // ─── Google Sign-In ──────────────────────────────────────────────────────────
  // The screen (SignInScreen) obtains the Firebase ID token via:
  //   expo-auth-session → Google OAuth → GoogleAuthProvider.credential → signInWithCredential
  //   → result.user.getIdToken()
  // and passes it here. We send it straight to the backend.

  const signInWithGoogle = async (firebaseIdToken: string): Promise<void> => {
    try {
      setLoading(true);
      const response = await socialApi.loginWithGoogle(firebaseIdToken);
      await persistTokens(response);
      setUser(response.user ?? null);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ─── Apple Sign-In ───────────────────────────────────────────────────────────
  // iOS only. The screen (SignInScreen/SignUpScreen) obtains the Firebase ID
  // token via src/utils/appleSignIn.ts (Apple native flow → Firebase credential
  // → result.user.getIdToken()) and passes it here, mirroring signInWithGoogle.

  const signInWithApple = async (firebaseIdToken: string): Promise<void> => {
    try {
      setLoading(true);
      const response = await socialApi.loginWithApple(firebaseIdToken);
      await persistTokens(response);
      setUser(response.user ?? null);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ─── Web: complete a signInWithRedirect() Google sign-in ─────────────────────
  // signInWithPopup is unreliable across browsers (Chrome's default
  // Cross-Origin-Opener-Policy blocks the popup/opener communication it needs,
  // so the popup silently closes without the promise ever resolving). The web
  // screens use signInWithRedirect instead, which navigates the whole tab away
  // and back - so completion has to happen here, once, after the page reloads.
  useEffect(() => {
    if (Platform.OS !== 'web' || !FIREBASE_CONFIGURED) return;
    const auth = getFirebaseAuth();
    if (!auth) return;

    getRedirectResult(auth)
      .then(async (result) => {
        if (!result?.user) return;
        const firebaseIdToken = await result.user.getIdToken();
        await signInWithGoogle(firebaseIdToken);
      })
      .catch((err) => {
        console.warn('Google redirect sign-in failed:', err?.message ?? err);
      });
    // Intentionally run once on mount only - getRedirectResult reads a
    // one-time pending result left by the just-completed browser redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Generic social sign-in (Apple / future providers) ───────────────────────

  const completeSocialSignIn = async (
    provider: 'google' | 'apple',
    token: string,
    appleUser?: any
  ): Promise<void> => {
    setLoading(true);
    try {
      let authResponse: AuthResponse;
      if (provider === 'google') {
        authResponse = await socialApi.loginWithGoogle(token);
      } else {
        authResponse = await socialApi.loginWithApple(token);
      }
      await persistTokens(authResponse);
      if (authResponse.user) setUser(authResponse.user);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ─── Complete profile (post-Google-signup popup) ─────────────────────────

  const completeProfile = async (sports: string[], referralCode?: string): Promise<void> => {
    const updated = await authApi.completeProfile({ sports, referralCode });
    setUser(updated);
    await AsyncStorage.setItem('user', JSON.stringify(updated));
  };

  const updateUser = async (profile: UserProfile): Promise<void> => {
    setUser(profile);
    await AsyncStorage.setItem('user', JSON.stringify(profile));
  };

  const needsProfileCompletion = !!user && user.profileCompleted === false;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        needsProfileCompletion,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        signInWithApple,
        completeSocialSignIn,
        completeProfile,
        updateUser,
      }}
    >
      {children}
      <CompleteProfileModal
        visible={needsProfileCompletion}
        displayName={user?.displayName}
        onSubmit={completeProfile}
        onSignOut={signOut}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
