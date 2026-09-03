import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  AtSign,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential, signInWithRedirect } from 'firebase/auth';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/Button';
import { InputField } from '../components/InputField';
import AuthTabBar from '../components/AuthTabBar';
import { AuthContext, useAuth } from '../context/AuthContext';
import { GOOGLE_CLIENT_IDS, GOOGLE_CONFIGURED } from '../config/googleAuth';
import { getFirebaseAuth, FIREBASE_CONFIGURED } from '../config/firebase';
import { APPLE_SIGN_IN_AVAILABLE, performAppleSignIn } from '../utils/appleSignIn';
import ScreenGlow from '../components/ScreenGlow';

// Required by expo-auth-session on web to close the auth popup and
// return the result to the app. Must be called at module level.
WebBrowser.maybeCompleteAuthSession();

const isValidEmail = (val: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) || val.length === 0;

export default function SignInScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const auth = useContext(AuthContext);
  const { signInWithGoogle, signInWithApple } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});

  // ─── expo-auth-session Google hook (native only) ──────────────────────────
  // On web we use Firebase signInWithPopup instead (see handleGoogleLogin).
  // The hook must always be called unconditionally even if unused on web.
  const [, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    webClientId:     GOOGLE_CLIENT_IDS.WEB,
    iosClientId:     GOOGLE_CLIENT_IDS.IOS,
    androidClientId: GOOGLE_CLIENT_IDS.ANDROID,
  });

  // ─── Handle native Google OAuth response ─────────────────────────────────
  useEffect(() => {
    if (!googleResponse) return;

    if (googleResponse.type === 'success') {
      const { authentication } = googleResponse;
      (async () => {
        try {
          const firebaseAuth = getFirebaseAuth();
          if (firebaseAuth && FIREBASE_CONFIGURED) {
            // Exchange Google OAuth tokens for a Firebase credential, then get
            // a Firebase ID token that the backend can verify.
            const credential = GoogleAuthProvider.credential(
              authentication?.idToken ?? null,
              authentication?.accessToken ?? null
            );
            const result = await signInWithCredential(firebaseAuth, credential);
            const firebaseIdToken = await result.user.getIdToken();
            await signInWithGoogle(firebaseIdToken);
          } else {
            // Firebase not configured — send the raw Google id_token to backend.
            const googleIdToken = authentication?.idToken;
            if (!googleIdToken) throw new Error('No ID token in Google response');
            await signInWithGoogle(googleIdToken);
          }
          router.replace('/home');
        } catch (err: any) {
          setErrors({ general: err?.message ?? 'Google sign-in failed. Please try again.' });
        } finally {
          setGoogleLoading(false);
        }
      })();
    } else if (googleResponse.type === 'error' || googleResponse.type === 'dismiss') {
      setGoogleLoading(false);
      if (googleResponse.type === 'error') {
        setErrors({ general: 'Google sign-in was cancelled or failed.' });
      }
    }
  }, [googleResponse]);

  // ─── Google button handler ────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    if (!GOOGLE_CONFIGURED) {
      setErrors({ general: 'Google sign-in not yet configured. Fill in GOOGLE_CLIENT_IDS in src/config/googleAuth.ts.' });
      return;
    }

    setErrors({});
    setGoogleLoading(true);

    if (Platform.OS === 'web') {
      // Web: full-page redirect through Google, not a popup — signInWithPopup
      // is unreliable (Chrome's default Cross-Origin-Opener-Policy blocks the
      // popup/opener handshake it needs, so it silently closes with nothing
      // happening). The redirect navigates away and back; AuthContext picks
      // up the result via getRedirectResult() once the page reloads.
      try {
        if (!FIREBASE_CONFIGURED) throw new Error('Firebase config is not set up yet.');
        const firebaseAuth = getFirebaseAuth()!;
        const provider = new GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
        await signInWithRedirect(firebaseAuth, provider);
        // Page navigates away here — nothing after this line runs.
      } catch (err: any) {
        setErrors({ general: err?.message ?? 'Google sign-in failed. Please try again.' });
        setGoogleLoading(false);
      }
    } else {
      // Native: expo-auth-session handles the OAuth flow.
      // The response is handled in the useEffect above.
      await googlePromptAsync();
    }
  };

  // ─── Apple button handler (iOS only) ──────────────────────────────────────
  const handleAppleLogin = async () => {
    setErrors({});
    setAppleLoading(true);
    try {
      const firebaseIdToken = await performAppleSignIn();
      await signInWithApple(firebaseIdToken);
      router.replace('/home');
    } catch (err: any) {
      // User cancelling the native sheet is not an error worth surfacing.
      if (err?.code !== '1001') {
        setErrors({ general: err?.message ?? 'Apple sign-in failed. Please try again.' });
      }
    } finally {
      setAppleLoading(false);
    }
  };

  // ─── Email/password sign-in ───────────────────────────────────────────────
  const validate = () => {
    const errs: typeof errors = {};
    if (!email.trim()) errs.email = 'Email is required';
    else if (!isValidEmail(email)) errs.email = 'Enter a valid email address';
    if (!password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await auth.signIn({ email, password });
      router.replace('/home');
    } catch (err: any) {
      setErrors({
        general:
          err.response?.data?.message ||
          err.message ||
          'Login failed. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(16)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(24)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(heroFade, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.spring(heroSlide, { toValue: 0, friction: 8, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardFade, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.spring(cardSlide, { toValue: 0, friction: 8, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, { toValue: 1.05, duration: 1400, useNativeDriver: true }),
        Animated.timing(logoPulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenGlow />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <ArrowLeft color={colors.primary} size={22} strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={{ width: 40 }} />
          </View>

          {/* Colorful gradient hero with logo */}
          <Animated.View style={{ opacity: heroFade, transform: [{ translateY: heroSlide }] }}>
            <LinearGradient
              colors={[colors.primaryLight, colors.background]}
              style={styles.heroGradient}
            >
              <View style={styles.heroContainer}>
                <Animated.View style={[styles.heroLogoWrap, { transform: [{ scale: logoPulse }] }]}>
                  <Image
                    source={require('../../assets/logo.jpeg')}
                    style={styles.heroLogo}
                    resizeMode="contain"
                  />
                </Animated.View>
              </View>
            </LinearGradient>
          </Animated.View>

          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Enter your credentials to access your Paasxo{'\n'}dashboard
          </Text>

          {/* Social sign-in */}
          <View style={{ marginBottom: 16 }}>
            <Button
              title={googleLoading ? 'Signing in…' : 'Continue with Google'}
              variant="secondary"
              style={{ marginBottom: 10 }}
              icon={
                googleLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
                ) : (
                  <Image
                    source={{ uri: 'https://img.icons8.com/color/48/000000/google-logo.png' }}
                    style={styles.socialIcon}
                  />
                )
              }
              onPress={handleGoogleLogin}
              disabled={googleLoading}
            />

            {APPLE_SIGN_IN_AVAILABLE && (
              <Button
                title={appleLoading ? 'Signing in…' : 'Continue with Apple'}
                variant="secondary"
                icon={
                  appleLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
                  ) : (
                    <Image
                      source={{ uri: 'https://img.icons8.com/ios-filled/50/000000/mac-os.png' }}
                      style={styles.socialIcon}
                    />
                  )
                }
                onPress={handleAppleLogin}
                disabled={appleLoading}
              />
            )}
          </View>

          {/* Form card */}
          <Animated.View style={[styles.card, { opacity: cardFade, transform: [{ translateY: cardSlide }] }]}>
            <Text style={styles.fieldLabel}>ACCOUNT IDENTITY</Text>
            <InputField
              placeholder="Email or Username"
              value={email}
              onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: undefined })); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon={<AtSign color={colors.textMuted} size={18} strokeWidth={2} />}
              error={errors.email}
              containerStyle={styles.inputContainer}
            />

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>SECURITY KEY</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push('/forgot-password')}
              >
                <Text style={styles.forgotText}>FORGOT?</Text>
              </TouchableOpacity>
            </View>
            <InputField
              placeholder="••••••••"
              value={password}
              onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: undefined })); }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              leftIcon={<Lock color={colors.textMuted} size={18} strokeWidth={2} />}
              rightIcon={
                showPassword ? (
                  <EyeOff color={colors.textMuted} size={18} strokeWidth={2} />
                ) : (
                  <Eye color={colors.textMuted} size={18} strokeWidth={2} />
                )
              }
              onRightIconPress={() => setShowPassword((v) => !v)}
              error={errors.password}
              containerStyle={styles.inputContainer}
            />

            {errors.general ? (
              <Text style={styles.generalError}>{errors.general}</Text>
            ) : null}

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              style={styles.signInButton}
            />
          </Animated.View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account yet?</Text>
            <TouchableOpacity onPress={() => router.push('/sign-up')} activeOpacity={0.7}>
              <Text style={styles.footerLink}>Join the Paasxo Community</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AuthTabBar active="login" />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 8,
  },
  heroGradient: {
    borderRadius: 28,
    marginBottom: 20,
    overflow: 'hidden',
    paddingVertical: 16,
  },
  heroLogoWrap: {
    shadowColor: colors.neutral900, shadowOpacity: 0.1, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 4,
    borderRadius: 26, marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: { width: 40, height: 40 },
  heroContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLogo: {
    width: 110,
    height: 110,
    borderRadius: 22,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  socialIcon: { width: 20, height: 20, marginRight: 8 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.neutral500,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 16,
  },
  forgotText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
  },
  inputContainer: { marginBottom: 4 },
  generalError: {
    color: colors.error,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  signInButton: { marginTop: 20, marginBottom: 4 },
  footer: { alignItems: 'center', gap: 6, marginBottom: 16 },
  footerText: { fontSize: 14, color: colors.textSecondary },
  footerLink: { fontSize: 15, fontWeight: '700', color: colors.primary },
});
