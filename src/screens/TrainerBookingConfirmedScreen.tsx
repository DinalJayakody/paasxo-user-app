import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, Calendar, Clock, MapPin, Video, CalendarPlus, Receipt } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/Button';
import ScreenGlow from '../components/ScreenGlow';

interface Props {
  bookingId: string;
  sessionTitle: string;
  trainerDisplayName: string;
  slotDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm:ss"
  endTime: string;
  location: string;
  isOnline: boolean;
  pricePaid: string;
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
function toCalendarDate(dateIso: string, timeStr: string) {
  const date = new Date(`${dateIso}T${timeStr || '00:00:00'}`);
  return date.toISOString().replace(/[-:]|\.\d{3}/g, '');
}

export default function TrainerBookingConfirmedScreen({
  bookingId, sessionTitle, trainerDisplayName, slotDate, startTime, endTime, location, isOnline, pricePaid,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleAddToCalendar = () => {
    const start = toCalendarDate(slotDate, startTime);
    const end = toCalendarDate(slotDate, endTime || startTime);
    const url =
      `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encodeURIComponent(sessionTitle)}` +
      `&dates=${start}/${end}` +
      `&location=${encodeURIComponent(isOnline ? 'Online' : location)}`;
    Linking.openURL(url).catch(() => {});
  };

  const handleDone = () => {
    router.replace('/explore?category=TRAINERS' as any);
  };

  return (
    <SafeAreaView style={styles.flex1} edges={['top', 'bottom']}>
      <ScreenGlow />
      <View style={styles.content}>
        <LinearGradient colors={[colors.trainer, colors.primaryDark]} style={styles.iconCircle}>
          <CheckCircle2 color={colors.white} size={44} strokeWidth={2} />
        </LinearGradient>

        <Text style={styles.title}>You're In!</Text>
        <Text style={styles.subtitle}>
          Your spot for <Text style={styles.subtitleStrong}>{sessionTitle}</Text>
          {!!trainerDisplayName && <> with {trainerDisplayName}</>} is confirmed.
        </Text>

        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Calendar color={colors.trainer} size={18} strokeWidth={2} />
            <Text style={styles.infoText}>{dateLabel(slotDate)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Clock color={colors.trainer} size={18} strokeWidth={2} />
            <Text style={styles.infoText}>{timeLabel(startTime)} – {timeLabel(endTime)}</Text>
          </View>
          <View style={styles.infoRow}>
            {isOnline ? (
              <Video color={colors.trainer} size={18} strokeWidth={2} />
            ) : (
              <MapPin color={colors.trainer} size={18} strokeWidth={2} />
            )}
            <Text style={styles.infoText}>{isOnline ? 'Online session' : (location || 'In person')}</Text>
          </View>
          <View style={[styles.infoRow, styles.infoRowLast]}>
            <Receipt color={colors.trainer} size={18} strokeWidth={2} />
            <Text style={styles.infoText}>LKR {pricePaid} paid</Text>
          </View>
        </View>

        <Text style={styles.bookingRef}>Booking #{bookingId}</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: 20 + insets.bottom }]}>
        <TouchableOpacity style={styles.calendarBtn} onPress={handleAddToCalendar} activeOpacity={0.8}>
          <CalendarPlus color={colors.trainer} size={18} strokeWidth={2.2} />
          <Text style={styles.calendarBtnText}>Add to Calendar</Text>
        </TouchableOpacity>
        <Button title="Done" onPress={handleDone} style={styles.doneBtn} />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex1: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 28, paddingTop: 48 },
  iconCircle: {
    width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { fontSize: 26, fontWeight: '900', color: colors.text, marginBottom: 8 },
  subtitle: {
    fontSize: 14.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 28,
  },
  subtitleStrong: { fontWeight: '700', color: colors.text },
  card: {
    width: '100%', backgroundColor: colors.cardBg, borderRadius: 18, padding: 18, gap: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoRowLast: {},
  infoText: { fontSize: 14, fontWeight: '600', color: colors.text },
  bookingRef: { fontSize: 12, color: colors.textMuted, marginTop: 18 },
  footer: {
    paddingHorizontal: 28, paddingTop: 14, gap: 12,
    borderTopWidth: 1, borderTopColor: colors.neutral200, backgroundColor: colors.cardBg,
  },
  calendarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: colors.trainerLight, borderRadius: 14, paddingVertical: 14,
  },
  calendarBtnText: { fontSize: 14, fontWeight: '700', color: colors.trainer },
  doneBtn: { width: '100%' },
});
