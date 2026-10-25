import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Calendar, Clock, Lock, MapPin, ShieldCheck, Swords } from 'lucide-react-native';
import { ThemeColors, Colors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import HeaderIconButton from '../components/HeaderIconButton';
import ScreenGlow from '../components/ScreenGlow';
import { PayHereCheckoutWebView } from '../components/PayHereCheckoutWebView';
import { PaasxoRefreshControl } from '../components/PaasxoRefreshControl';
import { PaasxoRefreshLogo } from '../components/PaasxoRefreshLogo';
import { bookingApi } from '../api/bookingApi';
import { teamMatchApi } from '../api/teamMatchApi';
import { paymentApi } from '../api/paymentApi';
import { CheckoutInitiationResponse } from '../types/api';
import { extractApiError } from '../utils/apiError';
import { goBack } from '../utils/navigation';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { teamMatchSportLabel } from '../constants/teamMatchSports';

const STATUS_POLL_ATTEMPTS = 10;
const STATUS_POLL_INTERVAL_MS = 1500;
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
const money = (n?: number | null) => `LKR ${Number(n ?? 0).toFixed(2)}`;

interface Props {
  challengeId: string;
  bookingId: string;
  organizerTeamName?: string;
  challengedTeamName?: string;
  initialAmountDue?: number;
}

/**
 * The challenged team's captain accepts a direct Team Match Challenge by paying
 * their half (see TeamMatchService.createAcceptPaymentOrder/applyAcceptedChallenge
 * on the backend). The payment order is only created when they tap Pay, and the
 * server re-checks everything (still pending, venue confirmed, not taken) both
 * then and when the payment lands — a payment that can't be applied is refunded
 * in full automatically.
 */
export default function TeamChallengeAcceptScreen({
  challengeId, bookingId, organizerTeamName, challengedTeamName, initialAmountDue,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentOrderId, setPaymentOrderId] = useState<number | null>(null);
  const [amountDue, setAmountDue] = useState<number | undefined>(initialAmountDue);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutInitiationResponse | null>(null);
  const [webViewVisible, setWebViewVisible] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const loadBooking = useCallback(async () => {
    try {
      const b = await bookingApi.getById(bookingId);
      if (mountedRef.current) setBooking(b);
    } catch {
      // Summary is informative only — paying still validates everything server-side.
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { loadBooking(); }, [loadBooking]);
  const { refreshing, onRefresh } = usePullToRefresh(loadBooking);

  const venueConfirmed = booking ? booking.status === 'ACTIVE_MATCH' : true;
  const unavailable: string | null = !booking ? null
    : booking.status === 'CANCELLED' ? 'This match has been cancelled.'
    : booking.opponentTeamId ? 'This match already has its opponent confirmed.'
    : null;
  const total = booking?.totalPrice != null ? Number(booking.totalPrice) : amountDue != null ? amountDue * 2 : null;
  const half = amountDue ?? (total != null ? total / 2 : null);

  const handleCheckoutCompleted = async (orderId: number) => {
    setWebViewVisible(false);
    setSubmitting(true);
    try {
      for (let attempt = 0; attempt < STATUS_POLL_ATTEMPTS; attempt++) {
        const status = await paymentApi.getStatus('TEAM_CHALLENGE_ACCEPT', orderId);
        if (['CHARGED', 'CONFIRMED', 'REFUND_REQUESTED', 'REFUNDED'].includes(status.status)) {
          // Only the booking says whether the challenge was actually applied, or the
          // payment was refunded because the match changed in the meantime.
          const latest = await bookingApi.getById(bookingId).catch(() => null);
          if (latest?.opponentTeamId) {
            Alert.alert('Match confirmed!', `${challengedTeamName || 'Your team'} vs ${organizerTeamName || 'their team'} is on. See you on the pitch.`, [
              { text: 'View Match', onPress: () => router.replace(`/match/${bookingId}` as any) },
            ]);
          } else if (status.status === 'REFUND_REQUESTED' || status.status === 'REFUNDED' || latest?.status === 'CANCELLED') {
            Alert.alert('Challenge no longer available',
              'The match changed before your payment went through, so your payment is being refunded in full.',
              [{ text: 'OK', onPress: () => router.replace('/team-matches?tab=challenges' as any) }]);
          } else {
            Alert.alert('Payment received', "We're confirming the match — it'll update in a moment.", [
              { text: 'View Match', onPress: () => router.replace(`/match/${bookingId}` as any) },
            ]);
          }
          return;
        }
        if (status.status === 'FAILED' || status.status === 'EXPIRED') {
          Alert.alert('Payment Failed', 'Your payment could not be confirmed. Please try again.');
          return;
        }
        await sleep(STATUS_POLL_INTERVAL_MS);
      }
      Alert.alert('Still Processing', "We're still confirming your payment — check the match shortly, it'll update automatically.");
    } catch (err) {
      Alert.alert('Payment Failed', extractApiError(err, 'Could not confirm your payment status.'));
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const handlePay = async () => {
    setSubmitting(true);
    setOrderError(null);
    try {
      // Created on demand (and reused server-side on retry) — validates the
      // challenge is still pending and the venue has confirmed the booking.
      let orderId = paymentOrderId;
      if (orderId == null) {
        const order = await teamMatchApi.createAcceptOrder(challengeId);
        orderId = order.paymentOrderId;
        setPaymentOrderId(orderId);
        setAmountDue(order.amountDue);
      }
      const initiation = await paymentApi.initiateCheckout('TEAM_CHALLENGE_ACCEPT', orderId);
      if (initiation.dummyMode) {
        await handleCheckoutCompleted(orderId);
        return;
      }
      setCheckoutData(initiation);
      setWebViewVisible(true);
    } catch (err) {
      setOrderError(extractApiError(err, 'Could not start checkout. Please try again.'));
    } finally {
      if (mountedRef.current) setSubmitting(false);
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
        <HeaderIconButton onPress={() => goBack(router, '/team-matches?tab=challenges')} style={styles.headerIconBtn} hitSlop={8}>
          <ArrowLeft color={colors.white} size={20} strokeWidth={2.2} />
        </HeaderIconButton>
        <Text style={styles.title}>Accept Challenge</Text>
        <View style={styles.headerIconBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <View style={styles.flex1}>
          <PaasxoRefreshLogo refreshing={refreshing} />
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={<PaasxoRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <View style={styles.vsCard}>
              {!!booking?.sport && <Text style={styles.vsSport}>{teamMatchSportLabel(booking.sport).toUpperCase()}</Text>}
              <View style={styles.vsRow}>
                <Text style={styles.vsTeam} numberOfLines={2}>{organizerTeamName || 'Their team'}</Text>
                <Swords color={colors.primary} size={22} strokeWidth={2.2} />
                <Text style={styles.vsTeam} numberOfLines={2}>{challengedTeamName || 'Your team'}</Text>
              </View>
              {!!booking?.futsalName && (
                <View style={styles.infoRow}>
                  <MapPin color={colors.textMuted} size={13} strokeWidth={2.2} />
                  <Text style={styles.infoText} numberOfLines={1}>{booking.futsalName}</Text>
                </View>
              )}
              {!!booking?.slotDate && (
                <View style={styles.infoRow}>
                  <Calendar color={colors.textMuted} size={13} strokeWidth={2.2} />
                  <Text style={styles.infoText}>
                    {booking.slotDate} · {String(booking.startTime || '').slice(0, 5)} – {String(booking.endTime || '').slice(0, 5)}
                  </Text>
                </View>
              )}
              <Pressable onPress={() => router.push(`/match/${bookingId}` as any)} hitSlop={6}>
                <Text style={styles.link}>View match & both teams' players</Text>
              </Pressable>
            </View>

            {unavailable ? (
              <View style={[styles.notice, { backgroundColor: colors.error + '12', borderColor: colors.error + '40' }]}>
                <Text style={[styles.noticeText, { color: colors.error }]}>{unavailable}</Text>
              </View>
            ) : !venueConfirmed ? (
              <View style={[styles.notice, { backgroundColor: colors.warning + '12', borderColor: colors.warning + '40' }]}>
                <Clock color={colors.warning} size={15} strokeWidth={2.2} />
                <Text style={styles.noticeText}>
                  The venue hasn't confirmed this booking yet. You can accept as soon as it does — nothing is charged until then. Pull down to check again.
                </Text>
              </View>
            ) : null}

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Booking total</Text>
                <Text style={styles.summaryValue}>{total != null ? money(total) : '—'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Paid upfront by {organizerTeamName || 'their team'}</Text>
                <Text style={styles.summaryValue}>{total != null ? money(total) : '—'}</Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                <Text style={styles.summaryTotalLabel}>Your team pays (half)</Text>
                <Text style={styles.summaryTotal}>{half != null ? money(half) : '—'}</Text>
              </View>
              <Text style={styles.summaryHint}>
                Your half goes to the team that booked — they're refunded the same amount automatically, so both teams pay
                equally. If the match is cancelled, you're refunded in full. Once accepted, your team's place can't be withdrawn.
              </Text>
            </View>

            {!!orderError && <Text style={styles.errorText}>{orderError}</Text>}

            <View style={styles.secureRow}>
              <ShieldCheck color={colors.success} size={14} strokeWidth={2} />
              <Text style={styles.secureText}>Secured by PayHere</Text>
            </View>

            <Pressable
              style={[styles.payBtn, (submitting || !!unavailable || !venueConfirmed) && styles.payBtnDisabled]}
              onPress={handlePay}
              disabled={submitting || !!unavailable || !venueConfirmed}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Lock color={Colors.white} size={16} strokeWidth={2.4} />
                  <Text style={styles.payBtnText}>{half != null ? `Pay ${money(half)} & Accept` : 'Pay & Accept'}</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      )}

      <PayHereCheckoutWebView
        visible={webViewVisible}
        checkout={checkoutData}
        onCompleted={() => { if (paymentOrderId != null) handleCheckoutCompleted(paymentOrderId); }}
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

  content: { padding: 16, paddingBottom: 48 },
  vsCard: {
    alignItems: 'center', gap: 8, backgroundColor: colors.cardBg, borderRadius: 20, padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: colors.neutral200,
  },
  vsSport: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, color: colors.primary },
  vsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  vsTeam: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text, textAlign: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 12.5, color: colors.textSecondary, fontWeight: '600', flexShrink: 1 },
  link: { fontSize: 13, fontWeight: '800', color: colors.primary, marginTop: 6 },

  notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 14 },
  noticeText: { flex: 1, fontSize: 12.5, color: colors.textSecondary, lineHeight: 18, fontWeight: '600' },

  summaryCard: {
    backgroundColor: colors.primary + '0F', borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: colors.primary + '22',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  summaryLabel: { flex: 1, fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  summaryValue: { fontSize: 13, color: colors.text, fontWeight: '700' },
  summaryTotalRow: { marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.primary + '22' },
  summaryTotalLabel: { fontSize: 14, color: colors.text, fontWeight: '800' },
  summaryTotal: { fontSize: 17, color: colors.primary, fontWeight: '900' },
  summaryHint: { fontSize: 11.5, color: colors.textMuted, marginTop: 8, lineHeight: 16 },
  errorText: { fontSize: 12.5, color: colors.error, fontWeight: '700', marginBottom: 12, lineHeight: 18 },

  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14 },
  secureText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16,
  },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
});
