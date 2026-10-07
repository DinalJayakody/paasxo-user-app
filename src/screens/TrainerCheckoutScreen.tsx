import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft, Calendar, Check, Clock, Lock, MapPin, ShieldCheck, Video,
} from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { trainerApi } from '../api/trainerApi';
import { paymentApi } from '../api/paymentApi';
import { TrainerBooking, TrainerCategory, CheckoutInitiationResponse } from '../types/api';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { extractApiError } from '../utils/apiError';
import { SessionGuidelines } from '../components/SessionGuidelines';
import { PayHereCheckoutWebView } from '../components/PayHereCheckoutWebView';
import ScreenGlow from '../components/ScreenGlow';
import { goBack } from '../utils/navigation';

// Same rationale as JoinCheckoutScreen: onCompleted from the WebView only means
// the checkout UI finished, never proof of payment — poll for the signed
// webhook to actually land before treating the session as booked.
const STATUS_POLL_ATTEMPTS = 10;
const STATUS_POLL_INTERVAL_MS = 1500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timeLabel(t: string) {
  return t?.slice(0, 5) ?? '';
}
function dateLabel(iso: string) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export interface TrainerCheckoutProps {
  slotId: string;
  sessionId: string;
  sessionTitle: string;
  trainerDisplayName: string;
  category: string;
  imageUrl: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  location: string;
  isOnline: boolean;
  price: string;
}

export default function TrainerCheckoutScreen(props: TrainerCheckoutProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    slotId, sessionTitle, trainerDisplayName, category, imageUrl,
    slotDate, startTime, endTime, location, isOnline, price,
  } = props;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // The TrainerJoinOrder id — paymentApi.getStatus is keyed by (orderType,
  // orderId), i.e. this, NOT checkoutData.transactionId (a different
  // PaymentTransaction id entirely). Tracked separately so the WebView's
  // onCompleted callback (which only knows about checkoutData) can still
  // poll the right order.
  const [paymentOrderId, setPaymentOrderId] = useState<number | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutInitiationResponse | null>(null);
  const [webViewVisible, setWebViewVisible] = useState(false);

  const amount = Number(price) || 0;

  // Best-effort: the booking itself is created asynchronously (by the PayHere
  // webhook, after this poll already sees CHARGED), so there's a narrow race
  // where it hasn't landed yet on the very first lookup. Falls back to the
  // session's own page — still shows the new booking once it does land —
  // rather than retry-looping for a nicer confirmation screen that isn't
  // worth the extra complexity.
  const navigateToConfirmation = async () => {
    try {
      const bookings: TrainerBooking[] = await trainerApi.getMyBookings();
      const match = bookings.find((b) => String(b.slotId) === String(slotId));
      if (match) {
        router.replace({
          pathname: '/trainer-booking-confirmed/[bookingId]',
          params: {
            bookingId: String(match.id),
            sessionTitle: match.sessionTitle ?? sessionTitle,
            trainerDisplayName: match.trainerDisplayName ?? trainerDisplayName,
            slotDate: match.slotDate ?? slotDate,
            startTime: match.startTime ?? startTime,
            endTime: match.endTime ?? endTime,
            location,
            isOnline: isOnline ? '1' : '0',
            pricePaid: String(match.pricePaid ?? amount),
          },
        } as any);
        return;
      }
    } catch {
      // fall through to the session-page fallback below
    }
    router.replace(`/trainer-session/${props.sessionId}` as any);
  };

  const handleCheckoutCompleted = async (orderId: number) => {
    setWebViewVisible(false);
    setSubmitting(true);
    try {
      for (let attempt = 0; attempt < STATUS_POLL_ATTEMPTS; attempt++) {
        const status = await paymentApi.getStatus('TRAINER_BOOKING', orderId);
        if (status.status === 'CHARGED' || status.status === 'CONFIRMED') {
          await navigateToConfirmation();
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
        "We're still confirming your payment. Check \"My Bookings\" shortly — it'll update automatically once confirmed."
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

  const handlePayAndJoin = async () => {
    if (!agreed) {
      Alert.alert('One More Thing', "Please confirm you've read the session guidelines before paying.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await trainerApi.createJoinOrder(slotId);
      if (res.joined) {
        // Free session — the backend already created the booking directly.
        await navigateToConfirmation();
        return;
      }
      if (res.paymentOrderId == null) {
        throw new Error('Payment could not be started — please try again.');
      }
      setPaymentOrderId(res.paymentOrderId);
      const initiation = await paymentApi.initiateCheckout('TRAINER_BOOKING', res.paymentOrderId);
      if (initiation.dummyMode) {
        // Backend has payment.dummy-mode on — PayHere bypassed, already CHARGED.
        await handleCheckoutCompleted(res.paymentOrderId);
        return;
      }
      setCheckoutData(initiation);
      setWebViewVisible(true);
    } catch (err) {
      Alert.alert('Join Failed', extractApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.flex1} edges={['top']}>
      <ScreenGlow />
      <View style={styles.header}>
        <Pressable onPress={() => goBack(router)} hitSlop={10}>
          <ArrowLeft color={colors.text} size={22} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Session summary */}
        <View style={styles.summaryCard}>
          {imageUrl ? (
            <Image source={{ uri: resolveMediaUrl(imageUrl) }} style={styles.summaryImage} />
          ) : (
            <LinearGradient colors={[colors.trainer, colors.primaryDark]} style={styles.summaryImage} />
          )}
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryTitle} numberOfLines={2}>{sessionTitle}</Text>
            {!!trainerDisplayName && <Text style={styles.summaryTrainer}>with {trainerDisplayName}</Text>}
            <View style={styles.summaryMetaRow}>
              <Calendar color={colors.trainer} size={12.5} strokeWidth={2.2} />
              <Text style={styles.summaryMetaText}>{dateLabel(slotDate)}</Text>
            </View>
            <View style={styles.summaryMetaRow}>
              <Clock color={colors.trainer} size={12.5} strokeWidth={2.2} />
              <Text style={styles.summaryMetaText}>{timeLabel(startTime)} – {timeLabel(endTime)}</Text>
            </View>
            <View style={styles.summaryMetaRow}>
              {isOnline ? <Video color={colors.trainer} size={12.5} strokeWidth={2.2} /> : <MapPin color={colors.trainer} size={12.5} strokeWidth={2.2} />}
              <Text style={styles.summaryMetaText} numberOfLines={1}>{isOnline ? 'Online session' : (location || 'In person')}</Text>
            </View>
          </View>
        </View>

        {/* Payment breakdown */}
        <Text style={styles.sectionTitle}>Payment Breakdown</Text>
        <View style={styles.card}>
          {amount > 0 ? (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Session fee</Text>
                <Text style={styles.summaryValue}>LKR {amount.toFixed(2)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total Due</Text>
                <Text style={styles.totalValue}>LKR {amount.toFixed(2)}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.summaryLabel}>Free to join</Text>
          )}
        </View>

        {/* Payment method — the actual card/wallet choice happens on PayHere's own
            hosted checkout page next, not here, so this is informational only. */}
        {amount > 0 && (
          <>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={styles.paymentOption}>
              <View style={styles.paymentIconWrap}>
                <Lock color={colors.text} size={18} strokeWidth={2} />
              </View>
              <View style={styles.paymentOptionBody}>
                <Text style={styles.paymentLabel}>Choose on the next screen</Text>
                <Text style={styles.paymentSubtitle}>
                  Card, mobile wallet or bank — securely handled by PayHere. Paasxo never sees or stores your card number.
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Session guidelines + required acknowledgment */}
        <Text style={styles.sectionTitle}>Before You Join</Text>
        <View style={styles.card}>
          <SessionGuidelines category={category as TrainerCategory} variant="full" />
        </View>

        <Pressable style={styles.agreeRow} onPress={() => setAgreed((v) => !v)} hitSlop={4}>
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed && <Check color={colors.white} size={13} strokeWidth={3} />}
          </View>
          <Text style={styles.agreeText}>
            I've read the session guidelines and confirm I'm fit to participate, or I'll inform the trainer of any
            health conditions or injuries beforehand.
          </Text>
        </Pressable>

        <View style={styles.secureRow}>
          <Lock color={colors.textMuted} size={13} strokeWidth={2} />
          <Text style={styles.secureText}>SECURE SSL ENCRYPTION</Text>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: (Platform.OS === 'ios' ? 24 : 16) + insets.bottom }]}>
        <Pressable
          style={[styles.payButton, (!agreed || submitting) && styles.payButtonDisabled]}
          onPress={handlePayAndJoin}
          disabled={!agreed || submitting}
        >
          {submitting
            ? <ActivityIndicator color={colors.white} />
            : <>
                <ShieldCheck color={colors.white} size={18} strokeWidth={2.2} />
                <Text style={styles.payButtonText}>
                  {amount > 0 ? `Pay & Join  LKR ${amount.toFixed(2)}` : 'Join Session'}
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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },

  summaryCard: {
    flexDirection: 'row', gap: 12, backgroundColor: colors.cardBg, borderRadius: 16, padding: 12, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  summaryImage: { width: 72, height: 72, borderRadius: 12 },
  summaryInfo: { flex: 1, gap: 3, justifyContent: 'center' },
  summaryTitle: { fontSize: 14.5, fontWeight: '800', color: colors.text },
  summaryTrainer: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  summaryMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryMetaText: { fontSize: 11.5, color: colors.textSecondary, fontWeight: '600' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12, marginTop: 8 },
  card: { backgroundColor: colors.cardBg, borderRadius: 16, padding: 16, marginBottom: 8 },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  summaryLabel: { fontSize: 14, color: colors.textSecondary, flex: 1, marginRight: 8 },
  summaryValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  divider: { height: 1, backgroundColor: colors.neutral200, marginVertical: 6 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: 20, fontWeight: '800', color: colors.trainer },

  paymentOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.cardBg, borderRadius: 14,
    padding: 14, marginBottom: 12, borderWidth: 1.5, borderColor: 'transparent',
  },
  paymentIconWrap: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: colors.neutral100,
    alignItems: 'center', justifyContent: 'center',
  },
  paymentOptionBody: { flex: 1 },
  paymentLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  paymentSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16, paddingRight: 4 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.neutral300,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.trainer, borderColor: colors.trainer },
  agreeText: { flex: 1, fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },

  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24 },
  secureText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: colors.textMuted },

  bottomBar: {
    paddingHorizontal: 20, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    backgroundColor: colors.cardBg, borderTopWidth: 1, borderTopColor: colors.neutral200,
  },
  payButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: colors.trainer, borderRadius: 16, paddingVertical: 16,
  },
  payButtonDisabled: { opacity: 0.5 },
  payButtonText: { fontSize: 16, fontWeight: '700', color: colors.white },
  legalText: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 16 },
});
