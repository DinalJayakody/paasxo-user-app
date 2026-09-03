import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Lock, RefreshCw, ShieldCheck, Users } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { bookingApi } from '../api/bookingApi';
import { invitationApi } from '../api/invitationApi';
import { paymentApi } from '../api/paymentApi';
import { MatchDetails, CheckoutInitiationResponse } from '../types/api';
import HeaderIconButton from '../components/HeaderIconButton';
import { parseMatchDetails } from '../utils/parseMatch';
import { extractApiError } from '../utils/apiError';
import { LoadingScreen } from '../components/LoadingScreen';
import { PayHereCheckoutWebView } from '../components/PayHereCheckoutWebView';
import ScreenGlow from '../components/ScreenGlow';

// How long to keep polling GET /payments/status after PayHere's checkout UI reports
// completion — same rationale as CheckoutScreen.tsx: onCompleted alone is never proof
// of payment, only the signed webhook landing server-side actually confirms it.
const STATUS_POLL_ATTEMPTS = 10;
const STATUS_POLL_INTERVAL_MS = 1500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface JoinCheckoutScreenProps {
  matchId: string;
  additionalPlayerIds?: string[];
  invitationId?: string;
}

export default function JoinCheckoutScreen({ matchId, additionalPlayerIds = [], invitationId }: JoinCheckoutScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentOrderId, setPaymentOrderId] = useState<number | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutInitiationResponse | null>(null);
  const [webViewVisible, setWebViewVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await bookingApi.getById(matchId);
      setMatch(parseMatchDetails(raw));
      // Invitation-based join: resolve the payment order created by accept() up front,
      // so Pay & Join can start checkout immediately rather than round-tripping first.
      if (invitationId) {
        const inv = await invitationApi.getById(invitationId);
        if (inv.paymentOrderId != null) setPaymentOrderId(inv.paymentOrderId);
      }
    } catch (err) {
      console.warn('Failed to load join checkout', err);
    } finally {
      setLoading(false);
    }
  }, [matchId, invitationId]);

  useEffect(() => { load(); }, [load]);

  // The WebView's onCompleted only means the checkout UI finished — the actual charge
  // is confirmed asynchronously via PayHere's signed webhook. Poll for a few seconds
  // waiting for that to land instead of trusting the UI callback directly.
  const handleCheckoutCompleted = async (orderId: number) => {
    setWebViewVisible(false);
    setSubmitting(true);
    try {
      for (let attempt = 0; attempt < STATUS_POLL_ATTEMPTS; attempt++) {
        const status = await paymentApi.getStatus('MATCH_JOIN', orderId);
        if (status.status === 'CHARGED' || status.status === 'CONFIRMED') {
          router.replace(`/join-match/${matchId}` as any);
          return;
        }
        if (status.status === 'FAILED' || status.status === 'EXPIRED') {
          Alert.alert('Payment Failed', 'Your payment could not be confirmed. Please try again.');
          return;
        }
        await sleep(STATUS_POLL_INTERVAL_MS);
      }
      Alert.alert(
        'Still Processing',
        "We're still confirming your payment. Check the match shortly — it'll update automatically once confirmed."
      );
    } catch (err) {
      Alert.alert('Payment Failed', extractApiError(err, 'Could not confirm your payment status.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckoutDismissed = () => setWebViewVisible(false);

  const handleCheckoutError = (message: string) => {
    setWebViewVisible(false);
    Alert.alert('Payment Failed', message || 'Something went wrong during payment. Please try again.');
  };

  const startCheckout = async (orderId: number) => {
    setPaymentOrderId(orderId);
    const initiation = await paymentApi.initiateCheckout('MATCH_JOIN', orderId);
    if (initiation.dummyMode) {
      // Backend has payment.dummy-mode on — PayHere bypassed, already CHARGED.
      await handleCheckoutCompleted(orderId);
      return;
    }
    setCheckoutData(initiation);
    setWebViewVisible(true);
  };

  const handlePayAndJoin = async () => {
    setSubmitting(true);
    try {
      if (invitationId) {
        if (paymentOrderId == null) {
          throw new Error('Payment could not be started — please go back and try again.');
        }
        await startCheckout(paymentOrderId);
      } else {
        // Direct join (organiser-initiated or self-join from explore) — server decides
        // free vs. paid, never the client.
        const res = await bookingApi.createJoinOrder(matchId, additionalPlayerIds);
        if (res.joined) {
          router.replace(`/join-match/${matchId}` as any);
          return;
        }
        if (res.paymentOrderId == null) {
          throw new Error('Payment could not be started — please try again.');
        }
        await startCheckout(res.paymentOrderId);
      }
    } catch (err) {
      Alert.alert('Join Failed', extractApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !match) {
    return <LoadingScreen message="Preparing your checkout…" />;
  }

  const sym = match.currencySymbol ?? 'LKR ';
  const totalPrice = match.totalPrice ?? match.pricePerSlot ?? 0;
  const maxSpots = match.maxSpots;

  const perPlayer = match.pricePerPlayer ??
    (totalPrice > 0 && maxSpots && maxSpots > 0
      ? Number((totalPrice / maxSpots).toFixed(2))
      : null);

  // If user is bringing additional players, they pay for all of them
  const playersJoining = 1 + additionalPlayerIds.length;
  const amountDue = perPlayer != null ? perPlayer * playersJoining : null;
  const serviceFee = amountDue != null
    ? Number(((amountDue * (match.serviceFeePercent ?? 0)) / 100).toFixed(2))
    : 0;
  const grandTotal = amountDue != null ? amountDue + serviceFee : null;

  return (
    <SafeAreaView style={styles.flex1} edges={['top']}>
      <ScreenGlow />
      {/* Floating glass-gradient header */}
      <View style={styles.topHeaderShadow}>
        <View style={styles.topHeader}>
          <LinearGradient
            colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.headerGlassStroke} pointerEvents="none" />

          <HeaderIconButton onPress={() => router.back()} style={styles.headerBack}>
            <ArrowLeft color={colors.white} size={20} strokeWidth={2.5} />
          </HeaderIconButton>
          <Text style={styles.headerTitle}>Join Checkout</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Summary chips */}
        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Users color={colors.primary} size={13} strokeWidth={2.5} />
            <Text style={styles.chipText}>
              {playersJoining === 1 ? 'You' : `You + ${additionalPlayerIds.length} player${additionalPlayerIds.length > 1 ? 's' : ''}`}
            </Text>
          </View>
          {perPlayer != null && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{sym}{Number(perPlayer).toFixed(2)} / player</Text>
            </View>
          )}
        </View>

        {/* Match summary */}
        <Text style={styles.sectionTitle}>Match Summary</Text>
        <View style={styles.card}>
          <Text style={styles.matchTitle}>{match.title}</Text>
          {match.venue?.name && (
            <Text style={styles.matchVenue}>{match.venue.name}</Text>
          )}
        </View>

        {/* Payment breakdown */}
        <Text style={styles.sectionTitle}>Payment Breakdown</Text>
        <View style={styles.card}>
          {perPlayer != null ? (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Player fee{playersJoining > 1 ? ` × ${playersJoining} players` : ''}
                </Text>
                <Text style={styles.summaryValue}>
                  {sym}{amountDue != null ? amountDue.toFixed(2) : '—'}
                </Text>
              </View>
              {playersJoining > 1 && (
                <View style={styles.summarySubRow}>
                  <Text style={styles.summarySubLabel}>
                    {sym}{Number(perPlayer).toFixed(2)} × {playersJoining}
                  </Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Service Fee ({match.serviceFeePercent ?? 0}%)</Text>
                <Text style={styles.summaryValue}>{sym}{serviceFee.toFixed(2)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total Due</Text>
                <Text style={styles.totalValue}>
                  {grandTotal != null ? `${sym}${grandTotal.toFixed(2)}` : 'TBD'}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.summaryLabel}>Free to join</Text>
          )}
        </View>

        {/* Payment method — the actual card/wallet choice happens on PayHere's own
            hosted checkout page next, not here, so this is informational only. */}
        <Text style={styles.sectionTitle}>Payment Method</Text>
        <View style={styles.paymentOption}>
          <View style={styles.paymentIconWrap}>
            <Lock color={colors.text} size={18} strokeWidth={2} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.paymentLabel}>Choose on the next screen</Text>
            <Text style={styles.paymentSubtitle}>
              Card, mobile wallet or bank — securely handled by PayHere. Paasxo never sees or stores your card number.
            </Text>
          </View>
        </View>

        {perPlayer != null && (
          <View style={styles.guideCard}>
            <View style={styles.guideHeader}>
              <RefreshCw color={colors.primary} size={16} strokeWidth={2.2} />
              <Text style={styles.guideTitle}>What happens to this payment</Text>
            </View>
            <Text style={styles.guideText}>
              You're paying your share to join this match. If the organizer or venue cancels the match for
              any reason, this amount is automatically refunded back to your original payment method — no
              action needed from you.
            </Text>
          </View>
        )}

        <View style={styles.secureRow}>
          <Lock color={colors.textMuted} size={13} strokeWidth={2} />
          <Text style={styles.secureText}>SECURE SSL ENCRYPTION</Text>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: (Platform.OS === 'ios' ? 24 : 16) + insets.bottom }]}>
        <Pressable style={styles.payButton} onPress={handlePayAndJoin} disabled={submitting}>
          {submitting
            ? <ActivityIndicator color={colors.white} />
            : <>
                <ShieldCheck color={colors.white} size={18} strokeWidth={2.2} />
                <Text style={styles.payButtonText}>
                  {grandTotal != null ? `Pay & Join  ${sym}${grandTotal.toFixed(2)}` : 'Join Match'}
                </Text>
              </>
          }
        </Pressable>
        <Text style={styles.legalText}>
          By confirming, you agree to the Paasxo Terms of Service and Privacy Policy.
        </Text>
      </View>

      <PayHereCheckoutWebView
        visible={webViewVisible}
        checkout={checkoutData}
        onCompleted={() => paymentOrderId != null && handleCheckoutCompleted(paymentOrderId)}
        onDismissed={handleCheckoutDismissed}
        onError={handleCheckoutError}
        onClose={handleCheckoutDismissed}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex1: { flex: 1, backgroundColor: colors.background },
  loadingScreen: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  topHeaderShadow: {
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 2,
    borderRadius: 26,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  topHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 26,
    overflow: 'hidden',
  },
  headerGlassStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  headerBack: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  headerSpacer: { width: 38 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.white },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.primary },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12, marginTop: 8 },
  card: { backgroundColor: colors.cardBg, borderRadius: 16, padding: 16, marginBottom: 8 },
  matchTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  matchVenue: { fontSize: 13, color: colors.textSecondary },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  summarySubRow: { paddingBottom: 6, paddingLeft: 2 },
  summarySubLabel: { fontSize: 12, color: colors.textMuted },
  summaryLabel: { fontSize: 14, color: colors.textSecondary, flex: 1, marginRight: 8 },
  summaryValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  divider: { height: 1, backgroundColor: colors.neutral200, marginVertical: 6 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: 20, fontWeight: '800', color: colors.primary },

  paymentOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.cardBg, borderRadius: 14,
    padding: 14, marginBottom: 12, borderWidth: 1.5, borderColor: 'transparent',
  },
  paymentIconWrap: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: colors.neutral100,
    alignItems: 'center', justifyContent: 'center',
  },
  paymentLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  paymentSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  guideCard: {
    backgroundColor: colors.primaryLight, borderRadius: 14,
    padding: 14, marginBottom: 12,
  },
  guideHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  guideTitle: { fontSize: 13, fontWeight: '700', color: colors.primary },
  guideText: { fontSize: 12.5, lineHeight: 18, color: colors.textSecondary },

  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24 },
  secureText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: colors.textMuted },

  bottomBar: {
    paddingHorizontal: 20, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    backgroundColor: colors.cardBg, borderTopWidth: 1, borderTopColor: colors.neutral200,
  },
  payButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16,
  },
  payButtonText: { fontSize: 16, fontWeight: '700', color: colors.white },
  legalText: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 16 },
});
