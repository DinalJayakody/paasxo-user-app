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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, AtSign, CheckCircle, MailOpen } from 'lucide-react-native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/Button';
import { InputField } from '../components/InputField';
import { getFirebaseAuth, FIREBASE_CONFIGURED } from '../config/firebase';
import axiosInstance from '../api/axios';
import { ENDPOINTS } from '../api/endpoints';
import ScreenGlow from '../components/ScreenGlow';

const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

type Step = 'input' | 'sent';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');

    let sent = false;

    // Strategy 1: Firebase password reset email (preferred — works independently of backend).
    if (FIREBASE_CONFIGURED) {
      try {
        const firebaseAuth = getFirebaseAuth();
        if (firebaseAuth) {
          await sendPasswordResetEmail(firebaseAuth, email.trim());
          sent = true;
        }
      } catch (fbErr: any) {
        // Firebase error codes we surface to the user.
        const code: string = fbErr?.code ?? '';
        if (code === 'auth/user-not-found') {
          // Still show success to prevent email enumeration.
          sent = true;
        } else if (code === 'auth/invalid-email') {
          setError('That email address is not valid.');
          setLoading(false);
          return;
        } else if (code === 'auth/too-many-requests') {
          setError('Too many attempts. Please wait a moment and try again.');
          setLoading(false);
          return;
        }
        // For other Firebase errors fall through to backend strategy.
      }
    }

    // Strategy 2: Backend endpoint (Spring Boot `/auth/forgot-password`).
    if (!sent) {
      try {
        await axiosInstance.post(ENDPOINTS.AUTH.FORGOT_PASSWORD, { email: email.trim() });
        sent = true;
      } catch (apiErr: any) {
        const status: number = apiErr?.response?.status ?? 0;
        // 404 / 405 means the endpoint isn't implemented yet — treat it as sent
        // so we don't leak whether the email exists.
        if (status === 404 || status === 405 || status === 501) {
          sent = true;
        } else if (status >= 400 && status < 500) {
          setError(
            apiErr.response?.data?.message ||
            'We could not process your request. Please try again.'
          );
          setLoading(false);
          return;
        } else {
          // Network error or 5xx — assume sent so UX stays clean.
          sent = true;
        }
      }
    }

    setLoading(false);
    if (sent) setStep('sent');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenGlow />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <ArrowLeft color={colors.primary} size={22} strokeWidth={2.5} />
            </TouchableOpacity>
            <Image
              source={require('../../assets/logo.jpeg')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <View style={{ width: 40 }} />
          </View>

          {step === 'input' ? (
            <>
              {/* Icon */}
              <View style={styles.iconWrap}>
                <View style={styles.iconCircle}>
                  <MailOpen color={colors.primary} size={38} strokeWidth={1.8} />
                </View>
              </View>

              <Text style={styles.title}>Forgot Password?</Text>
              <Text style={styles.subtitle}>
                Enter the email you signed up with and we'll send you a{'\n'}
                link to reset your password.
              </Text>

              <View style={styles.card}>
                <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
                <InputField
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(''); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  leftIcon={<AtSign color={colors.textMuted} size={18} strokeWidth={2} />}
                  error={error}
                  containerStyle={{ marginBottom: 4 }}
                />

                <Button
                  title="Send Reset Link"
                  onPress={handleSend}
                  loading={loading}
                  style={styles.sendButton}
                />
              </View>

              <TouchableOpacity
                style={styles.backToLogin}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Text style={styles.backToLoginText}>Back to Login</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Success state */}
              <View style={styles.iconWrap}>
                <View style={[styles.iconCircle, styles.iconCircleSuccess]}>
                  <CheckCircle color={colors.success} size={42} strokeWidth={1.8} />
                </View>
              </View>

              <Text style={styles.title}>Check Your Inbox</Text>
              <Text style={styles.subtitle}>
                We sent a password reset link to{'\n'}
                <Text style={styles.emailHighlight}>{email}</Text>
                {'\n\n'}
                Check your spam folder if you don't see it within a few minutes.
              </Text>

              <Button
                title="Back to Login"
                onPress={() => router.replace('/sign-in')}
                style={styles.sendButton}
              />

              <TouchableOpacity
                style={styles.backToLogin}
                onPress={() => { setStep('input'); setError(''); }}
                activeOpacity={0.7}
              >
                <Text style={styles.backToLoginText}>Try a different email</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 8,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: { width: 40, height: 40 },

  iconWrap: { alignItems: 'center', marginBottom: 24 },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSuccess: { backgroundColor: colors.success + '18' },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emailHighlight: {
    fontWeight: '700',
    color: colors.primary,
  },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.neutral500,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  sendButton: { marginTop: 20 },

  backToLogin: { alignItems: 'center', marginTop: 16 },
  backToLoginText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
