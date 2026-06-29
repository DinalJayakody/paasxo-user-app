import React, { createContext, useEffect, useState, useCallback, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { authApi } from '../api/authApi';
import { socialApi } from '../api/socialApi';
import { AUTH_LOGOUT_EVENT } from '../api/axios';
import { AuthResponse, LoginPayload, RegisterPayload, UserProfile } from '../types/api';
import axiosInstance from '../api/axios';

type AuthContextShape = {
  user: UserProfile | null;
  loading: boolean;
  signIn: (payload: LoginPayload) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<void>;
  signOut: () => Promise<void>;
  // signInWithGoogle receives the Firebase ID token obtained by the screen-level
  // OAuth flow (expo-auth-session + Firebase SignInWithCredential).
  signInWithGoogle: (firebaseIdToken: string) => Promise<void>;
  // completeSocialSignIn is the lower-level helper kept for Apple and future providers.
  completeSocialSignIn: (provider: 'google' | 'apple', token: string, appleUser?: any) => Promise<void>;
};

export const AuthContext = createContext<AuthContextShape>({} as AuthContextShape);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // ─── Token persistence helpers ──────────────────────────────────────────────

  const persistTokens = async (tokens: AuthResponse) => {
    if (tokens.idToken) {
      await AsyncStorage.setItem('accessToken', tokens.idToken);
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
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
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
        authResponse = await socialApi.loginWithApple(token, appleUser);
      }
      await persistTokens(authResponse);
      if (authResponse.user) setUser(authResponse.user);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signUp, signOut, signInWithGoogle, completeSocialSignIn }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
