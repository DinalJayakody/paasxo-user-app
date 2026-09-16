import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  useWindowDimensions,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  UserPlus,
  Trophy,
  Check,
} from 'lucide-react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential, signInWithRedirect } from 'firebase/auth';
import { AppleButton } from '@invertase/react-native-apple-authentication';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/Button';
import { InputField } from '../components/InputField';
import AuthTabBar from '../components/AuthTabBar';
import { useContext, useRef, useEffect } from 'react';
import { AuthContext, useAuth } from '../context/AuthContext';
import { RegisterPayload } from '../types/api';
import { SPORTS } from '../constants/sports';
import { GOOGLE_CLIENT_IDS, GOOGLE_CONFIGURED } from '../config/googleAuth';
import { getFirebaseAuth, FIREBASE_CONFIGURED } from '../config/firebase';
import { APPLE_SIGN_IN_AVAILABLE, performAppleSignIn } from '../utils/appleSignIn';
import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '../constants/legal';
import ScreenGlow from '../components/ScreenGlow';
import { goBack } from '../utils/navigation';

// Required by expo-auth-session on web to close the auth popup and return
// the result to the app. Harmless to call from multiple screens/modules.
WebBrowser.maybeCompleteAuthSession();

// --- Validation helpers ---
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isValidPhone = (v: string) => /^\+?[\d\s\-()]{7,}$/.test(v);

export default function SignUpScreen() {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  // Auth context (used for signUp/google/apple placeholders)
  const auth = useContext(AuthContext);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  useWindowDimensions(); // keeps layout reactive on dimension changes

  // subtle pulse animation for avatar
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  // gentle pulse for the hero trophy badge
  const badgePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(badgePulse, { toValue: 1.08, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(badgePulse, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, [badgePulse]);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedSports, setSelectedSports] = useState<string[]>(['FUTSAL']);
  const [referralCode, setReferralCode] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [socialError, setSocialError] = useState<string | undefined>();
  const [appleLoading, setAppleLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { signInWithGoogle, signInWithApple } = useAuth();

  // ─── expo-auth-session Google hook (native only) ──────────────────────────
  // On web we use Firebase signInWithPopup instead (see handleGoogleLogin).
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
            const credential = GoogleAuthProvider.credential(
              authentication?.idToken ?? null,
              authentication?.accessToken ?? null
            );
            const result = await signInWithCredential(firebaseAuth, credential);
            const firebaseIdToken = await result.user.getIdToken();
            await signInWithGoogle(firebaseIdToken);
          } else {
            const googleIdToken = authentication?.idToken;
            if (!googleIdToken) throw new Error('No ID token in Google response');
            await signInWithGoogle(googleIdToken);
          }
          // New Google accounts are marked profileCompleted=false by the
          // backend — AuthProvider shows CompleteProfileModal automatically,
          // so it's safe to head straight to /home either way.
          router.replace('/home');
        } catch (err: any) {
          setSocialError(err?.message ?? 'Google sign-in failed. Please try again.');
        } finally {
          setGoogleLoading(false);
        }
      })();
    } else if (googleResponse.type === 'error' || googleResponse.type === 'dismiss') {
      setGoogleLoading(false);
      if (googleResponse.type === 'error') {
        setSocialError('Google sign-in was cancelled or failed.');
      }
    }
  }, [googleResponse]);

  const toggleSport = (id: string) => {
    setSelectedSports((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Full name is required';
    if (!email.trim()) errs.email = 'Email is required';
    else if (!isValidEmail(email)) errs.email = 'Enter a valid email';
    if (!phone.trim()) errs.phone = 'Phone number is required';
    else if (!isValidPhone(phone)) errs.phone = 'Enter a valid phone number';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (!confirmPassword) errs.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (selectedSports.length === 0) errs.sports = 'Select at least one sport';
    if (!termsAccepted) errs.terms = 'Please accept the Terms of Service and Privacy Policy to continue';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /**
   * handleRegister — called when user presses "Finish Setup"
   * 
   * Flow:
   * 1) Validate form data
   * 2) Call auth.signUp with complete registration payload
   * 3) On success: tokens are persisted and user is set in AuthContext
   * 4) Navigate to main app
   */
  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);

const payload: RegisterPayload = {
  email,
  password,
  displayName: fullName,
  phoneNumber: phone,
  sports: selectedSports,
  referralCode: referralCode || undefined,
  profileImage: avatarUri
    ? {
        uri: avatarUri,
        name: "profile.jpg",
        type: "image/jpeg",
      }
    : undefined,
};


    try {
      // Call signUp via AuthContext which uses authApi.register
await auth.signUp(payload);
      
      // After successful registration and login, navigate to main app
      router.push('/post-verification'); // optional welcome screen after registration
    } catch (err: any) {
      setErrors({ general: err.message ?? 'Registration failed. Try again.' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Google button handler ────────────────────────────────────────────────
  // Same OAuth flow as SignInScreen. The backend creates a new account
  // automatically for first-time Google sign-ins (see AuthService#loginWithGoogle)
  // and flags it profileCompleted=false so the app prompts for activity +
  // referral code right after landing on /home.
  const handleGoogleLogin = async () => {
    if (!GOOGLE_CONFIGURED) {
      setSocialError('Google sign-in not yet configured. Fill in GOOGLE_CLIENT_IDS in src/config/googleAuth.ts.');
      return;
    }

    setSocialError(undefined);
    setGoogleLoading(true);

    if (Platform.OS === 'web') {
      // Full-page redirect, not a popup — signInWithPopup is unreliable
      // (Chrome's default Cross-Origin-Opener-Policy blocks the popup/opener
      // handshake, so it silently closes with nothing happening). AuthContext
      // picks up the result via getRedirectResult() once the page reloads.
      try {
        if (!FIREBASE_CONFIGURED) throw new Error('Firebase config is not set up yet.');
        const firebaseAuth = getFirebaseAuth()!;
        const provider = new GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
        await signInWithRedirect(firebaseAuth, provider);
        // Page navigates away here — nothing after this line runs.
      } catch (err: any) {
        setSocialError(err?.message ?? 'Google sign-in failed. Please try again.');
        setGoogleLoading(false);
      }
    } else {
      // Native: expo-auth-session handles the OAuth flow.
      // The response is handled in the useEffect above.
      await googlePromptAsync();
    }
  };

  // ─── Apple button handler (iOS only) ──────────────────────────────────────
  // Same account-creation semantics as Google: the backend creates a new
  // profileCompleted=false account for a first-time Apple sign-in.
  const handleAppleLogin = async () => {
    // AppleButton (Apple's native ASAuthorizationAppleIDButton) has no built-in
    // disabled prop, so guard re-entrancy here instead.
    if (appleLoading) return;
    setSocialError(undefined);
    setAppleLoading(true);
    try {
      const { idToken, authorizationCode } = await performAppleSignIn();
      await signInWithApple(idToken, authorizationCode);
      // Same as the Google branch above: new Apple accounts are marked
      // profileCompleted=false, so AuthProvider shows CompleteProfileModal
      // automatically - safe to head straight to /home either way.
      router.replace('/home');
    } catch (err: any) {
      // User cancelling the native sheet is not an error worth surfacing.
      if (err?.code !== '1001') {
        setSocialError(err?.message ?? 'Apple sign-in failed. Please try again.');
      }
    } finally {
      setAppleLoading(false);
    }
  };

  /* Avatar picker guide (Expo)
     - Install: `expo install expo-image-picker`
     - Request permission then call `launchImageLibraryAsync`.
     - After selecting, upload via `userApi.uploadAvatar` using FormData.
  */
  const pickAvatar = async () => {
  const ImagePicker = require('expo-image-picker');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  console.log("Picker result:", result);

  if (!result.canceled && result.assets?.length > 0) {
    const uri = result.assets[0].uri;
    console.log("Setting avatar URI:", uri);
    setAvatarUri(uri);
  }
};

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
            <TouchableOpacity onPress={() => goBack(router)} style={styles.backBtn} activeOpacity={0.7}>
              <ArrowLeft color={colors.primary} size={22} strokeWidth={2.5} />
            </TouchableOpacity>
            <Image source={require('../../assets/logo.jpeg')} style={{width:40, height:40}} resizeMode="contain" />
            <View style={{ width: 40 }} />
          </View>

          {/* Colorful gradient hero band */}
          <LinearGradient colors={[colors.primaryLight, colors.background]} style={styles.heroGradient}>
            <Animated.View style={[styles.heroBadge, { transform: [{ scale: badgePulse }] }]}>
              <Trophy color={colors.primary} size={30} strokeWidth={2} />
            </Animated.View>
          </LinearGradient>

          {/* Hero text */}
          <Text style={styles.title}>Join the{'\n'}Movement.</Text>
          <Text style={styles.subtitle}>
            Create your profile and start your athletic{'\n'}journey.
          </Text>

          {/* Social login buttons + Avatar + Full name */}
          <View style={[styles.card, { alignItems: 'center' }]}> 
            <Text style={styles.sectionLabel}>SIGN UP</Text>

            <View style={styles.socialColumn}>
              <Button
                title={googleLoading ? 'Signing in…' : 'Continue with Google'}
                onPress={handleGoogleLogin}
                variant="secondary"
                style={styles.socialButton}
                textStyle={styles.socialButtonText}
                disabled={googleLoading}
                icon={
                  googleLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
                  ) : (
                    <Image source={{ uri: 'https://img.icons8.com/color/48/000000/google-logo.png' }} style={styles.socialIcon} />
                  )
                }
              />
              {socialError ? (
                <Text style={styles.socialError}>{socialError}</Text>
              ) : null}

              {APPLE_SIGN_IN_AVAILABLE && (
                appleLoading ? (
                  <View style={[styles.appleButtonLoading, styles.socialButtonSecond]}>
                    <ActivityIndicator size="small" color={colors.text} />
                  </View>
                ) : (
                  // Apple's native Sign In with Apple button (ASAuthorizationAppleIDButton) —
                  // App Store review guideline 4.8 requires this exact control, not a
                  // custom-styled lookalike, when other third-party sign-in options are offered.
                  <AppleButton
                    buttonStyle={resolvedTheme === 'dark' ? AppleButton.Style.WHITE : AppleButton.Style.BLACK}
                    buttonType={AppleButton.Type.SIGN_UP}
                    style={[styles.appleButton, styles.socialButtonSecond]}
                    cornerRadius={23}
                    onPress={handleAppleLogin}
                  />
                )
              )}
            </View>

            <Text style={styles.socialConsentText}>
              By continuing with Google or Apple, you agree to Paasxo's{' '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL(getTermsOfServiceUrl())}>
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL(getPrivacyPolicyUrl())}>
                Privacy Policy
              </Text>.
            </Text>
          </View>

          {/* Credentials card */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>CREDENTIALS</Text>

            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <TouchableOpacity onPress={pickAvatar} activeOpacity={0.9}>
                <Animated.View style={[styles.avatarOuter, { transform: [{ scale: pulse }] }]}>
                  <View style={styles.avatarRing}>
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <UserPlus color={colors.neutral400} size={34} />
                      </View>
                    )}
                  </View>
                  <View style={styles.plusBadge}>
                    <Text style={{ color: colors.white, fontWeight: '800' }}>+</Text>
                  </View>
                </Animated.View>
              </TouchableOpacity>
            </View>

            <InputField
              placeholder="Full Name"
              value={fullName}
              onChangeText={(t) => { setFullName(t); setErrors((e) => ({ ...e, fullName: '' })); }}
              error={errors.fullName}
              containerStyle={styles.inputContainer}
            />
            <InputField
              placeholder="Email Address"
              value={email}
              onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: '' })); }}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
              containerStyle={styles.inputContainer}
            />
            <InputField
              placeholder="Phone Number"
              value={phone}
              onChangeText={(t) => { setPhone(t); setErrors((e) => ({ ...e, phone: '' })); }}
              keyboardType="phone-pad"
              error={errors.phone}
              containerStyle={styles.inputContainer}
            />
            <InputField
              placeholder="Password"
              value={password}
              onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: '' })); }}
              secureTextEntry
              autoCapitalize="none"
              error={errors.password}
              containerStyle={styles.inputContainer}
            />
            <InputField
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setErrors((e) => ({ ...e, confirmPassword: '' })); }}
              secureTextEntry
              autoCapitalize="none"
              error={errors.confirmPassword}
              containerStyle={styles.inputContainer}
            />
          </View>

          {/* Activity card */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>SELECT YOUR ACTIVITY</Text>
            {errors.sports ? (
              <Text style={styles.fieldError}>{errors.sports}</Text>
            ) : null}
            <View style={styles.sportsGrid}>
              {SPORTS.map((sport) => {
                const Icon = sport.icon;
                const active = selectedSports.includes(sport.id);
                return (
                  <TouchableOpacity
                    key={sport.id}
                    style={[styles.sportTag, active && styles.sportTagActive]}
                    onPress={() => toggleSport(sport.id)}
                    activeOpacity={0.8}
                  >
                    <Icon
                      color={active ? colors.primary : colors.textSecondary}
                      size={14}
                      strokeWidth={2}
                    />
                    <Text
                      style={[styles.sportTagText, active && styles.sportTagTextActive]}
                    >
                      {sport.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Referral card */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>REFERRAL CODE (OPTIONAL)</Text>
            <InputField
              placeholder="EX: PAASXO_2024"
              value={referralCode}
              onChangeText={setReferralCode}
              autoCapitalize="characters"
              containerStyle={styles.inputContainer}
            />
          </View>

          {/* Motivational banner - solid gradient, no network image dependency */}
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.motivationBanner}
          >
            <Text style={styles.motivationText}>Unleash Your Potential 🏆</Text>
            <Text style={styles.motivationSubtext}>Every champion started with a single sign-up.</Text>
          </LinearGradient>

          {/* Terms acceptance - required before an account can be created */}
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => { setTermsAccepted((v) => !v); setErrors((e) => ({ ...e, terms: '' })); }}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, termsAccepted && styles.checkboxActive]}>
              {termsAccepted && <Check color={colors.white} size={13} strokeWidth={3} />}
            </View>
            <Text style={styles.termsText}>
              I agree to Paasxo's{' '}
              <Text
                style={styles.termsLink}
                onPress={(e) => { e.stopPropagation(); Linking.openURL(getTermsOfServiceUrl()); }}
              >
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text
                style={styles.termsLink}
                onPress={(e) => { e.stopPropagation(); Linking.openURL(getPrivacyPolicyUrl()); }}
              >
                Privacy Policy
              </Text>
            </Text>
          </TouchableOpacity>
          {errors.terms ? <Text style={styles.fieldError}>{errors.terms}</Text> : null}

          {/* General error */}
          {errors.general ? (
            <Text style={styles.generalError}>{errors.general}</Text>
          ) : null}

          {/* CTA */}
          <Button
            title="Finish Setup"
            onPress={handleRegister}
            loading={loading}
            style={styles.finishButton}
          />

          {/* Sign in link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/sign-in')} activeOpacity={0.7}>
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AuthTabBar active="register" />
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
    marginBottom: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroBadge: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.cardBg,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.neutral900, shadowOpacity: 0.1, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 4,
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
  brandName: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primaryDark,
    letterSpacing: 2,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 44,
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  socialColumn: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  socialButton: {
    width: '100%',
    height: 46,
  },
  socialButtonSecond: {
    width: '100%',
    marginTop: 8,
  },
  socialIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  appleButton: { width: '100%', height: 46 },
  // Apple's native Sign In with Apple button doesn't expose a font-size
  // control on iOS (Apple locks this down by design) - its text scales with
  // the button's own height, so both buttons are sized down together here
  // and Google's text is matched to Apple's resulting native size.
  socialButtonText: { fontSize: 16 },
  appleButtonLoading: {
    width: '100%',
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.neutral100,
    borderWidth: 1,
    borderColor: colors.neutral200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOuter: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: colors.neutral900,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.neutral500,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  inputContainer: {
    marginBottom: 8,
  },
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sportTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.neutral200,
    backgroundColor: colors.tagBg,
  },
  sportTagActive: {
    borderColor: colors.primary,
    backgroundColor: colors.tagBgSelected,
  },
  sportTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sportTagTextActive: {
    color: colors.primary,
  },
  skillRow: {
    flexDirection: 'row',
    backgroundColor: colors.neutral100,
    borderRadius: 12,
    padding: 4,
    marginBottom: 10,
  },
  skillTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  skillTabActive: {
    backgroundColor: colors.cardBg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  skillTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral400,
  },
  skillTabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  skillDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationLeft: {
    gap: 2,
  },
  locationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  motivationBanner: {
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
    marginBottom: 20,
    marginTop: 8,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  motivationText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  motivationSubtext: {
    color: colors.white,
    opacity: 0.85,
    fontSize: 13,
    fontWeight: '500',
  },
  fieldError: {
    color: colors.error,
    fontSize: 12,
    marginBottom: 6,
  },
  generalError: {
    color: colors.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  socialConsentText: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 8,
  },
  socialError: {
    color: colors.error,
    fontSize: 12,
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 8,
  },
  finishButton: {
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  footerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
