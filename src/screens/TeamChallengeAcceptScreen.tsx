import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Lock, ShieldCheck, Swords } from 'lucide-react-native';
import { ThemeColors, Colors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import HeaderIconButton from '../components/HeaderIconButton';
import ScreenGlow from '../components/ScreenGlow';
import { PayHereCheckoutWebView } from '../components/PayHereCheckoutWebView';
import { teamMatchApi } from '../api/teamMatchApi';
import { paymentApi } from '../api/paymentApi';
import { CheckoutInitiationResponse } from '../types/api';
import { extractApiError } from '../utils/apiError';
import { goBack } from '../utils/navigation';

const STATUS_POLL_ATTEMPTS = 10;
const STATUS_POLL_INTERVAL_MS = 1500;
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

interface Props {
  challengeId: string;
  bookingId: string;
  organizerTeamName?: string;
  challengedTeamName?: string;
  initialAmountDue?: number;
}

/** The challenged team captain pays their half here to accept a Team Match
 *  Challenge — see TeamMatchService.createAcceptPaymentOrder/applyAcceptedChallenge
 *  on the backend. Mirrors JoinCheckoutScreen's WebView + status-poll pattern. */
export default function TeamChallengeAcceptScreen({
  challengeId, bookingId, organizerTeamName, challengedTeamName, initialAmountDue,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentOrderId, setPaymentOrderId] = useState<number | null>(null);
  const [amountDue, setAmountDue] = useState<number | undefined>(initialAmountDue);
  const [checkoutData, setCheckoutData] = useState<CheckoutInitiationResponse | null>(null);
  const [webViewVisible, setWebViewVisible] = useState(false);

  useEffect(() => {
    teamMatchApi.createAcceptOrder(challengeId)
      .then((order) => {
        setPaymentOrderId(order.paymentOrderId);
        setAmountDue(order.amountDue);
      })
      .catch((err) => Alert.alert('Could not prepare payment', extractApiError(err, 'Please try again.')))
      .finally(() => setLoading(false));
  }, [challengeId]);

  const handleCheckoutCompleted = async () => {
    if (paymentOrderId == null) return;
    setWebViewVisible(false);
    setSubmitting(true);
    try {
      for (let attempt = 0; attempt < STATUS_POLL_ATTEMPTS; attempt++) {
        const status = await paymentApi.getStatus('TEAM_CHALLENGE_ACCEPT', paymentOrderId);
        if (status.status === 'CHARGED' || status.status === 'CONFIRMED') {
          router.replace(`/match/${bookingId}` as any);
          return;
        }
        if (status.status === 'FAILED' || status.status === 'EXPIRED') {
          Alert.alert('Payment Failed', 'Your payment could not be confirmed. Please try again.');
          return;
        }
        await sleep(STATUS_POLL_INTERVAL_MS);
      }
      Alert.alert('Still Processing', "We're still confirming your payment — check the team shortly, it'll update automatically.");
    } catch (err) {
      Alert.alert('Payment Failed', extractApiError(err, 'Could not confirm your payment status.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = async () => {
    if (paymentOrderId == null) return;
    setSubmitting(true);
    try {
      const initiation = await paymentApi.initiateCheckout('TEAM_CHALLENGE_ACCEPT', paymentOrderId);
      if (initiation.dummyMode) {
        await handleCheckoutCompleted();
        return;
      }
      setCheckoutData(initiation);
      setWebViewVisible(true);
    } catch (err) {
      Alert.alert('Payment Failed', extractApiError(err, 'Could not start checkout. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.flex1} edges={['top']}>
      <ScreenGlow />
      <View style={styles.header}>
        <LinearGradient
          colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}
        />
        <HeaderIconButton onPress={() => goBack(router)} style={styles.headerIconBtn} hitSlop={8}>
          <ArrowLeft color={colors.white} size={20} strokeWidth={2.2} />
        </HeaderIconButton>
        <Text style={styles.title}>Accept Challenge</Text>
        <View style={styles.headerIconBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <View style={styles.content}>
          <View style={styles.vsCard}>
            <Swords color={colors.primary} size={28} strokeWidth={2} />
            <Text style={styles.vsText}>
              {organizerTeamName || 'Their team'} vs {challengedTeamName || 'Your team'}
            </Text>
            <Text style={styles.vsHint}>Pay half the booking cost to confirm this match.</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Your share</Text>
            <Text style={styles.summaryAmount}>LKR {(amountDue ?? 0).toFixed(2)}</Text>
          </View>

          <View style={styles.secureRow}>
            <ShieldCheck color={colors.success} size={14} strokeWidth={2} />
            <Text style={styles.secureText}>Secured by PayHere</Text>
          </View>

          <Pressable style={[styles.payBtn, (submitting || paymentOrderId == null) && styles.payBtnDisabled]} onPress={handlePay} disabled={submitting || paymentOrderId == null}>
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Lock color={Colors.white} size={16} strokeWidth={2.4} />
                <Text style={styles.payBtnText}>Pay & Accept</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      <PayHereCheckoutWebView
        visible={webViewVisible}
        checkout={checkoutData}
        onCompleted={handleCheckoutCompleted}
        onDismissed={() => setWebViewVisible(false)}
        onError={(message) => { setWebViewVisible(false); Alert.alert('Payment Failed', message || 'Something went wrong. Please try again.'); }}
        onClose={() => setWebViewVisible(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex1: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, overflow: 'hidden',
  },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.white },

  content: { flex: 1, padding: 20 },
  vsCard: {
    alignItems: 'center', gap: 8, backgroundColor: colors.cardBg, borderRadius: 20, padding: 24, marginBottom: 16,
    borderWidth: 1, borderColor: colors.neutral200,
  },
  vsText: { fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'center' },
  vsHint: { fontSize: 12.5, color: colors.textMuted, textAlign: 'center' },

  summaryCard: {
    backgroundColor: colors.primary + '0F', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: colors.primary + '22',
  },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  summaryAmount: { fontSize: 30, fontWeight: '900', color: colors.primary, marginTop: 6 },

  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 20 },
  secureText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },

  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16,
  },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
});
