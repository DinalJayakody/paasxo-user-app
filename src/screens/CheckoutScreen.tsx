import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Lock, ShieldCheck, Clock, Users, RefreshCw } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { bookingApi } from '../api/bookingApi';
import { paymentApi } from '../api/paymentApi';
import { MatchDetails, CheckoutInitiationResponse } from '../types/api';
import { parseMatchDetails } from '../utils/parseMatch';
import { LoadingScreen } from '../components/LoadingScreen';
import { PayHereCheckoutWebView } from '../components/PayHereCheckoutWebView';
import HeaderIconButton from '../components/HeaderIconButton';
import { extractApiError } from '../utils/apiError';
import ScreenGlow from '../components/ScreenGlow';

// How long to keep polling GET /payments/status after PayHere's checkout UI
// reports completion, waiting for the signed webhook to land server-side and
// flip the transaction to CHARGED. The UI callback alone is never proof of
// payment — see PayHereCheckoutWebView's onCompleted doc comment.
const STATUS_POLL_ATTEMPTS = 10;
const STATUS_POLL_INTERVAL_MS = 1500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CheckoutScreenProps {
  matchId: string;
}

export default function CheckoutScreen({ matchId }: CheckoutScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutData, setCheckoutData] = useState<CheckoutInitiationResponse | null>(null);
  const [webViewVisible, setWebViewVisible] = useState(false);

  const loadMatch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bookingApi.getById(matchId);
      setMatch(parseMatchDetails(data));
    } catch (err) {
      console.warn('Failed to load checkout summary', err);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => { loadMatch(); }, [loadMatch]);

  const handlePayAndConfirm = async () => {
    setSubmitting(true);
    try {
      const initiation = await paymentApi.initiateCheckout('BOOKING', matchId);
      if (initiation.dummyMode) {
        // Backend has payment.dummy-mode on — PayHere bypassed, the
        // transaction is already CHARGED. No WebView to show; just confirm
        // via the same status poll a real payment would use.
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

  // The WebView's onCompleted only means the checkout UI finished — the
  // actual charge is confirmed asynchronously via PayHere's signed webhook.
  // Poll our own backend for a few seconds waiting for that to land instead
  // of trusting the UI callback directly.
  const handleCheckoutCompleted = async () => {
    setWebViewVisible(false);
    setSubmitting(true);
    try {
      for (let attempt = 0; attempt < STATUS_POLL_ATTEMPTS; attempt++) {
        const status = await paymentApi.getStatus('BOOKING', matchId);
        if (status.status === 'CHARGED' || status.status === 'CONFIRMED') {
          // Always pass pending=true — newly created matches require vendor approval before going active
          router.push(`/booking-status/${matchId}?pending=true` as any);
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
        "We're still confirming your payment. Check your booking status shortly — it'll update automatically once confirmed."
      );
    } catch (err) {
      Alert.alert('Payment Failed', extractApiError(err, 'Could not confirm your payment status.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckoutDismissed = () => {
    setWebViewVisible(false);
  };

  const handleCheckoutError = (message: string) => {
    setWebViewVisible(false);
    Alert.alert('Payment Failed', message || 'Something went wrong during payment. Please try again.');
  };

  if (loading || !match) {
    return <LoadingScreen message="Preparing your checkout…" />;
  }

  const sym = match.currencySymbol ?? 'LKR ';
  const pricePerSlot = match.pricePerSlot ?? 0;
  const slotCount = match.slotCount ?? 1;
  const priceKnown = match.totalPrice != null || match.pricePerSlot != null;

  // Total booking fee: server computes pricePerSlot × slotCount; fall back to local calc
  const totalBookingFee = match.totalPrice ?? pricePerSlot * slotCount;
  const serviceFee = Number(
    ((totalBookingFee * (match.serviceFeePercent ?? 0)) / 100).toFixed(2)
  );
  const grandTotal = totalBookingFee + serviceFee;

  // Per-player price from server (totalPrice / maxPlayers); or compute locally
  const pricePerPlayer =
    match.pricePerPlayer ??
    (match.maxSpots && match.maxSpots > 0
      ? Number((totalBookingFee / match.maxSpots).toFixed(2))
      : null);

  const slotLabel =
    slotCount > 1
      ? `Match Fee (${slotCount} slots × ${sym}${pricePerSlot.toFixed(2)})`
      : 'Match Fee';

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
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Session summary chips */}
        {priceKnown && (
          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Clock color={colors.primary} size={13} strokeWidth={2.5} />
              <Text style={styles.chipText}>
                {slotCount} {slotCount === 1 ? 'slot' : 'slots'}
              </Text>
            </View>
            {match.maxSpots != null && (
              <View style={styles.chip}>
                <Users color={colors.primary} size={13} strokeWidth={2.5} />
                <Text style={styles.chipText}>Max {match.maxSpots} players</Text>
              </View>
            )}
            {pricePerPlayer != null && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {sym}{Number(pricePerPlayer).toFixed(2)} / player
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Booking summary */}
        <Text style={styles.sectionTitle}>Booking Summary</Text>
        <View style={styles.card}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{slotLabel}</Text>
            <Text style={styles.summaryValue}>
              {priceKnown ? `${sym}${totalBookingFee.toFixed(2)}` : 'Not available yet'}
            </Text>
          </View>

          {priceKnown && slotCount > 1 && (
            <View style={styles.summarySubRow}>
              <Text style={styles.summarySubLabel}>
                {sym}{pricePerSlot.toFixed(2)} × {slotCount} slots
              </Text>
            </View>
          )}

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Service Fee ({match.serviceFeePercent ?? 0}%)
            </Text>
            <Text style={styles.summaryValue}>
              {priceKnown ? `${sym}${serviceFee.toFixed(2)}` : '—'}
            </Text>
          </View>

          {pricePerPlayer != null && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Per Player</Text>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>
                {sym}{Number(pricePerPlayer).toFixed(2)}
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {priceKnown ? `${sym}${grandTotal.toFixed(2)}` : 'TBD'}
            </Text>
          </View>
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

        {/* How this payment works — the organizer fronts the full amount now; as
            other players pay their own share to join, that amount is automatically
            refunded back here, so the organizer never ends up paying for a spot
            someone else already paid for. */}
        <View style={styles.guideCard}>
          <View style={styles.guideHeader}>
            <RefreshCw color={colors.primary} size={16} strokeWidth={2.2} />
            <Text style={styles.guideTitle}>How this payment works</Text>
          </View>
          <Text style={styles.guideText}>
            You're paying the full venue cost now to lock in this booking. As other players join and pay
            their own share, that amount is automatically refunded back to your original payment method —
            you'll never end up paying for a spot someone else filled. This is settled automatically 48
            hours before kickoff. If you cancel before then, everything you paid is refunded in full.
          </Text>
        </View>

        <View style={styles.secureRow}>
          <Lock color={colors.textMuted} size={14} strokeWidth={2} />
          <Text style={styles.secureText}>SECURE SSL ENCRYPTION</Text>
        </View>
      </ScrollView>

      {/* Pay button */}
      <View style={[styles.bottomBar, { paddingBottom: (Platform.OS === 'ios' ? 24 : 16) + insets.bottom }]}>
        <Pressable style={styles.payButton} onPress={handlePayAndConfirm} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <ShieldCheck color={colors.white} size={18} strokeWidth={2.2} />
              <Text style={styles.payButtonText}>
                {priceKnown
                  ? `Pay & Confirm ${sym}${grandTotal.toFixed(2)}`
                  : 'Confirm Booking'}
              </Text>
            </>
          )}
        </Pressable>
        <Text style={styles.legalText}>
          By confirming, you agree to the Paasxo Terms of Service and Privacy Policy.
        </Text>
      </View>

      <PayHereCheckoutWebView
        visible={webViewVisible}
        checkout={checkoutData}
        onCompleted={handleCheckoutCompleted}
        onDismissed={handleCheckoutDismissed}
        onError={handleCheckoutError}
        onClose={handleCheckoutDismissed}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex1: { flex: 1 },
  loadingScreen: {
    flex: 1, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
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
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
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

  scrollContent: {
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24,
  },

  // Session chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.primary },

  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: colors.text,
    marginBottom: 12, marginTop: 8,
  },

  card: {
    backgroundColor: colors.cardBg, borderRadius: 16,
    padding: 16, marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
  },
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
    padding: 14, marginBottom: 12,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  paymentIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: colors.neutral100,
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

  secureRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, marginTop: 24,
  },
  secureText: {
    fontSize: 11, fontWeight: '700',
    letterSpacing: 0.6, color: colors.textMuted,
  },

  bottomBar: {
    paddingHorizontal: 20, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1, borderTopColor: colors.neutral200,
  },
  payButton: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10,
    backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16,
  },
  payButtonText: { fontSize: 16, fontWeight: '700', color: colors.white },
  legalText: {
    fontSize: 11, color: colors.textMuted,
    textAlign: 'center', marginTop: 10, lineHeight: 16,
  },
});
