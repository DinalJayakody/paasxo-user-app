import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Calendar, Clock, Receipt, X } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { trainerApi } from '../api/trainerApi';
import { extractApiError } from '../utils/apiError';
import ScreenGlow from '../components/ScreenGlow';
import { goBack } from '../utils/navigation';

// Must match TrainerBookingService.REFUND_LEAD_HOURS on the backend — purely
// for client-side copy; the server is always the real source of truth for
// whether cancelling right now is refund-eligible.
const REFUND_LEAD_HOURS = 24;

interface Props {
  bookingId: string;
  sessionTitle: string;
  trainerDisplayName: string;
  slotDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm:ss"
  endTime: string;
  pricePaid: string;
  status: string;
}

function timeLabel(t: string) {
  return t?.slice(0, 5) ?? '';
}
function dateLabel(iso: string) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}
function isPast(slotDate: string, endTime: string) {
  if (!slotDate) return false;
  return new Date(`${slotDate}T${endTime || '23:59:59'}`).getTime() < Date.now();
}
function isWithinRefundWindow(slotDate: string, startTime: string) {
  if (!slotDate || !startTime) return false;
  const hoursUntil = (new Date(`${slotDate}T${startTime}`).getTime() - Date.now()) / 3_600_000;
  return hoursUntil >= REFUND_LEAD_HOURS;
}

// Read-only detail view for a session the user has already joined — unlike
// TrainerSessionDetailsScreen (the trainer's own session page, which lets a
// NEW user join) this never shows a Join/Continue CTA, and unlike
// TrainerBookingConfirmedScreen (the celebratory "You're In!" page shown
// right after paying) this is the page you land on when browsing an
// EXISTING booking from "My Joined Sessions" — plain details + Cancel.
export default function TrainerBookingDetailScreen({
  bookingId, sessionTitle, trainerDisplayName, slotDate, startTime, endTime, pricePaid, status,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);

  const cancelled = currentStatus === 'CANCELLED';
  const past = isPast(slotDate, endTime);
  const canCancel = !cancelled && !past;
  const price = Number(pricePaid) || 0;

  const handleCancel = () => {
    const refundEligible = isWithinRefundWindow(slotDate, startTime);
    const paid = price > 0;
    const message = !paid
      ? 'This session is free — cancelling just releases your spot.'
      : refundEligible
      ? `You're cancelling at least ${REFUND_LEAD_HOURS} hours before the session, so you'll get a full refund.`
      : `This is within ${REFUND_LEAD_HOURS} hours of the session, so your payment won't be refunded.`;

    Alert.alert('Cancel This Session?', message, [
      { text: 'Keep My Spot', style: 'cancel' },
      {
        text: 'Cancel Session',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await trainerApi.cancelBooking(bookingId);
            setCurrentStatus('CANCELLED');
          } catch (err) {
            Alert.alert('Could Not Cancel', extractApiError(err, 'Could not cancel this session. Please try again.'));
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenGlow />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack(router)} style={styles.backBtn} hitSlop={10}>
          <ArrowLeft color={colors.trainer} size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>Session Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.sessionTitle} numberOfLines={2}>{sessionTitle}</Text>
          {cancelled ? (
            <View style={[styles.badge, styles.badgeCancelled]}>
              <Text style={styles.badgeTextCancelled}>Cancelled</Text>
            </View>
          ) : past ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Completed</Text>
            </View>
          ) : (
            <View style={[styles.badge, styles.badgeConfirmed]}>
              <Text style={styles.badgeTextConfirmed}>Confirmed</Text>
            </View>
          )}
        </View>
        {!!trainerDisplayName && <Text style={styles.trainerName}>with {trainerDisplayName}</Text>}

        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Calendar color={colors.trainer} size={18} strokeWidth={2} />
            <Text style={styles.infoText}>{dateLabel(slotDate)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Clock color={colors.trainer} size={18} strokeWidth={2} />
            <Text style={styles.infoText}>{timeLabel(startTime)} – {timeLabel(endTime)}</Text>
          </View>
          <View style={[styles.infoRow, styles.infoRowLast]}>
            <Receipt color={colors.trainer} size={18} strokeWidth={2} />
            <Text style={styles.infoText}>{price > 0 ? `LKR ${price.toFixed(2)} paid` : 'Free session'}</Text>
          </View>
        </View>

        <Text style={styles.bookingRef}>Booking #{bookingId}</Text>
      </View>

      {canCancel && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={cancelling} activeOpacity={0.85}>
            {cancelling ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <>
                <X color={colors.error} size={16} strokeWidth={2.5} />
                <Text style={styles.cancelBtnText}>Cancel Session</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: '900', color: colors.text },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  sessionTitle: { flex: 1, fontSize: 22, fontWeight: '900', color: colors.text },
  trainerName: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 20 },
  badge: { backgroundColor: colors.neutral100, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.neutral600, textTransform: 'uppercase' },
  badgeConfirmed: { backgroundColor: colors.trainerLight },
  badgeTextConfirmed: { fontSize: 11, fontWeight: '700', color: colors.trainer, textTransform: 'uppercase' },
  badgeCancelled: { backgroundColor: colors.error + '1A' },
  badgeTextCancelled: { fontSize: 11, fontWeight: '700', color: colors.error, textTransform: 'uppercase' },
  card: {
    backgroundColor: colors.cardBg, borderRadius: 18, padding: 18, gap: 14, marginTop: 8,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoRowLast: {},
  infoText: { fontSize: 14.5, fontWeight: '600', color: colors.text },
  bookingRef: { fontSize: 12, color: colors.textMuted, marginTop: 16 },
  footer: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24, borderTopWidth: 1, borderTopColor: colors.neutral200 },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: colors.error + '55', borderRadius: 14, paddingVertical: 14,
  },
  cancelBtnText: { fontSize: 14.5, fontWeight: '700', color: colors.error },
});
