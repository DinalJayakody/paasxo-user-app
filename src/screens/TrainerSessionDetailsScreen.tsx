import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker } from 'react-native-maps';
import {
  ArrowLeft, ArrowRight, Calendar, CalendarDays, ClipboardList, Clock, Lock, MapPin, Navigation, Users, Video, Zap,
} from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { trainerApi } from '../api/trainerApi';
import { TrainerBooking, TrainerSession, TrainerSessionSlot } from '../types/api';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { extractApiError } from '../utils/apiError';
import { useSubscription } from '../hooks/useSubscription';
import { AvailabilityCalendarModal } from '../components/AvailabilityCalendarModal';
import { SessionGuidelines } from '../components/SessionGuidelines';
import { LoadingScreen } from '../components/LoadingScreen';
import { PaasxoRefreshControl } from '../components/PaasxoRefreshControl';
import { PaasxoRefreshLogo } from '../components/PaasxoRefreshLogo';
import ScreenGlow from '../components/ScreenGlow';

const CATEGORY_LABELS: Record<string, string> = {
  GYM: 'Gym', CALISTHENICS: 'Calisthenics', DANCING: 'Dancing', YOGA: 'Yoga',
  CROSSFIT: 'CrossFit', MARTIAL_ARTS: 'Martial Arts', PILATES: 'Pilates', OTHER: 'Training',
};

function timeLabel(t: string) {
  return t.slice(0, 5);
}
function dateLabel(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysIso(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Opens turn-by-turn navigation (not just a pin search) so a member can tap
// straight into "Start" driving/walking directions from Google Maps.
function openDirections(session: TrainerSession) {
  const { latitude, longitude, location } = session;
  const url =
    latitude != null && longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location || '')}&travelmode=driving`;
  Linking.openURL(url).catch(() => {});
}

interface Props {
  sessionId: string;
}

export default function TrainerSessionDetailsScreen({ sessionId }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { active: isPro, loading: subLoading, refresh: refreshSubscription } = useSubscription();

  const [session, setSession] = useState<TrainerSession | null>(null);
  const [slots, setSlots] = useState<TrainerSessionSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      const s: TrainerSession = await trainerApi.getSessionById(sessionId);
      setSession(s);
      const from = todayIso();
      const to = addDaysIso(from, 45);
      const slotList: TrainerSessionSlot[] = await trainerApi.getSlots(sessionId, from, to);
      setSlots(slotList.filter((sl) => sl.status !== 'CANCELLED'));
    } catch (err) {
      console.warn('Failed to load trainer session', err);
      setError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [sessionId]);

  // Covers the initial load and every re-focus in one place: subscription
  // status is cached for a few minutes elsewhere in the app, but this screen
  // gates a paid action, so it always re-checks on focus (e.g. right after
  // returning from the upgrade flow). Slots are re-fetched too, so spots-left
  // reflects a booking just made on the checkout screen.
  useFocusEffect(
    useCallback(() => {
      refreshSubscription();
      load();
    }, [refreshSubscription, load])
  );

  if (error) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ScreenGlow />
        <Text style={styles.errorText}>Couldn't load this session.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => load()} activeOpacity={0.85}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleContinue = async () => {
    if (joining || !session) return;
    if (!selectedSlotId) {
      Alert.alert('Pick a Date', 'Select a date above before joining this session.');
      return;
    }
    if (selectedSlot?.status === 'FULL') {
      Alert.alert('Session Full', 'This date is fully booked — pick another date above.');
      return;
    }
    if (!isPro) {
      Alert.alert(
        'PAASXO Plus Required',
        'Joining a trainer session is a Plus member perk. Upgrade to book this session.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/subscription' as any) },
        ],
      );
      return;
    }
    const slot = slots.find((s) => s.id === selectedSlotId);
    if (!slot) return;
    // No real payment gateway for trainer sessions yet — join directly, same
    // dummy-checkout convention used by BOOKING/MATCH_JOIN when
    // payment.dummy-mode is on: the booking is created immediately rather
    // than routing through a checkout screen first.
    setJoining(true);
    try {
      const booking: TrainerBooking = await trainerApi.joinSlot(slot.id);
      router.push({
        pathname: '/trainer-booking-confirmed/[bookingId]',
        params: {
          bookingId: String(booking.id),
          sessionTitle: booking.sessionTitle ?? session.title,
          trainerDisplayName: booking.trainerDisplayName ?? session.trainerDisplayName ?? '',
          slotDate: booking.slotDate ?? slot.slotDate,
          startTime: booking.startTime ?? slot.startTime,
          endTime: booking.endTime ?? slot.endTime,
          location: session.location ?? '',
          isOnline: session.isOnline ? '1' : '0',
          pricePaid: String(booking.pricePaid ?? session.price),
        },
      } as any);
    } catch (err) {
      Alert.alert('Could Not Join', extractApiError(err, 'Could not join this session. Please try again.'));
    } finally {
      setJoining(false);
    }
  };

  if (loading || !session) {
    return <LoadingScreen message="Loading session…" />;
  }

  const selectedSlot = slots.find((s) => s.id === selectedSlotId) ?? null;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.flex1} edges={['top']}>
      <ScreenGlow />
      <PaasxoRefreshLogo refreshing={refreshing} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
        refreshControl={<PaasxoRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.hero}>
          {session.imageUrl ? (
            <Image source={{ uri: resolveMediaUrl(session.imageUrl) }} style={styles.heroImage} />
          ) : (
            <LinearGradient colors={[colors.trainer, colors.primaryDark]} style={styles.heroImage} />
          )}
          <View style={styles.heroScrim} />
          <TouchableOpacity style={styles.backFab} onPress={() => router.back()} hitSlop={10}>
            <ArrowLeft color={colors.text} size={20} strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.heroOverlay}>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText}>{CATEGORY_LABELS[session.category] ?? session.category}</Text>
            </View>
            <Text style={styles.heroTitle}>{session.title}</Text>
            {!!session.trainerDisplayName && <Text style={styles.heroSubtitle}>with {session.trainerDisplayName}</Text>}
          </View>
        </View>

        <View style={styles.factRow}>
          <View style={styles.factChip}>
            <Clock color={colors.trainer} size={14} strokeWidth={2} />
            <Text style={styles.factChipText}>{timeLabel(session.startTime)} · {session.durationMinutes}min</Text>
          </View>
          <View style={styles.factChip}>
            <Users color={colors.trainer} size={14} strokeWidth={2} />
            <Text style={styles.factChipText}>{session.capacity} spots</Text>
          </View>
          <View style={styles.factChip}>
            {session.isOnline ? <Video color={colors.trainer} size={14} strokeWidth={2} /> : <MapPin color={colors.trainer} size={14} strokeWidth={2} />}
            <Text style={styles.factChipText}>{session.isOnline ? 'Online' : (session.location || 'In person')}</Text>
          </View>
        </View>

        {!!session.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About This Session</Text>
            <Text style={styles.bodyText}>{session.description}</Text>
          </View>
        )}

        {!!session.planDetails && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What to Bring / Plan</Text>
            <View style={styles.planBox}>
              <Text style={styles.bodyText}>{session.planDetails}</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRowBetween}>
            <View style={styles.sectionHeaderRow}>
              <Calendar color={colors.text} size={16} strokeWidth={2.2} />
              <Text style={styles.sectionTitle}>Pick a Date</Text>
            </View>
            {slots.length > 0 && (
              <TouchableOpacity
                style={styles.calendarIconBtn}
                onPress={() => setCalendarVisible(true)}
                hitSlop={8}
                activeOpacity={0.75}
              >
                <CalendarDays color={colors.trainer} size={16} strokeWidth={2.2} />
                <Text style={styles.calendarIconBtnText}>Calendar</Text>
              </TouchableOpacity>
            )}
          </View>
          {slots.length === 0 ? (
            <Text style={styles.emptyText}>No upcoming dates available yet — check back soon.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {slots.map((slot) => {
                const isSelected = slot.id === selectedSlotId;
                const isFull = slot.status === 'FULL';
                return (
                  <Pressable
                    key={slot.id}
                    disabled={isFull}
                    onPress={() => setSelectedSlotId(slot.id)}
                    style={[
                      styles.dateCard,
                      isSelected && styles.dateCardSelected,
                      isFull && styles.dateCardDisabled,
                    ]}
                  >
                    <Text style={[styles.dateCardDay, isSelected && styles.dateCardTextSelected]}>{dateLabel(slot.slotDate)}</Text>
                    <Text style={[styles.dateCardTime, isSelected && styles.dateCardTextSelected]}>{timeLabel(slot.startTime)}</Text>
                    <Text style={[styles.dateCardSpots, isSelected && styles.dateCardTextSelected]}>
                      {isFull ? 'Full' : `${slot.spotsLeft} left`}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            {session.isOnline ? <Video color={colors.text} size={16} strokeWidth={2.2} /> : <MapPin color={colors.text} size={16} strokeWidth={2.2} />}
            <Text style={styles.sectionTitle}>Location</Text>
          </View>
          {session.isOnline ? (
            <View style={styles.onlineNotice}>
              <Video color={colors.trainer} size={18} strokeWidth={2} />
              <Text style={styles.onlineNoticeText}>
                This is an online session — the meeting link will be shared with you after you join.
              </Text>
            </View>
          ) : (
            <>
              {session.latitude != null && session.longitude != null && (
                <Pressable
                  onPress={() => openDirections(session)}
                  style={styles.mapWrap}
                  accessibilityRole="button"
                  accessibilityLabel="Open directions in Google Maps"
                >
                  <MapView
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                    initialRegion={{
                      latitude: session.latitude,
                      longitude: session.longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }}
                  >
                    <Marker coordinate={{ latitude: session.latitude, longitude: session.longitude }} />
                  </MapView>
                  <View style={styles.mapOverlayBadge}>
                    <Navigation color={colors.white} size={13} strokeWidth={2.4} />
                    <Text style={styles.mapOverlayBadgeText}>Tap to navigate</Text>
                  </View>
                </Pressable>
              )}
              <View style={styles.locationRow}>
                <Text style={styles.locationText}>{session.location || 'Location shared after booking'}</Text>
                <TouchableOpacity style={styles.directionsBtn} onPress={() => openDirections(session)} activeOpacity={0.8}>
                  <Navigation color={colors.trainer} size={14} strokeWidth={2.4} />
                  <Text style={styles.directionsBtnText}>Directions</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <ClipboardList color={colors.text} size={16} strokeWidth={2.2} />
            <Text style={styles.sectionTitle}>Session Guidelines</Text>
          </View>
          <View style={styles.guidelinesCard}>
            <SessionGuidelines category={session.category} variant="compact" />
          </View>
        </View>

        {!isPro && !subLoading && (
          <View style={styles.section}>
            <View style={styles.upsellCard}>
              <Zap color="#F59E0B" size={18} strokeWidth={2.5} fill="#F59E0B" />
              <Text style={styles.upsellText}>
                Joining trainer sessions is a PAASXO Plus perk — upgrade to book.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <AvailabilityCalendarModal
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        slots={slots}
        selectedSlotId={selectedSlotId}
        onSelectSlot={setSelectedSlotId}
      />

      <View style={[styles.bottomBar, { paddingBottom: 28 + insets.bottom }]}>
        <View style={styles.flex1}>
          <Text style={styles.priceLabel}>Price</Text>
          <Text style={styles.priceValue}>LKR {session.price}</Text>
        </View>
        <TouchableOpacity
          style={[styles.joinButton, joining && styles.joinButtonDisabled]}
          onPress={handleContinue}
          disabled={joining}
        >
          {joining ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              {isPro ? <ArrowRight color={colors.white} size={18} strokeWidth={2.4} /> : <Lock color={colors.white} size={18} strokeWidth={2.2} />}
              <Text style={styles.joinButtonText}>{isPro ? 'Join Session' : 'Unlock & Join'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex1: { flex: 1, backgroundColor: colors.background },
  loadingScreen: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  errorText: { fontSize: 14.5, color: colors.textSecondary, textAlign: 'center' },
  retryButton: { backgroundColor: colors.trainer, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryButtonText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  hero: { height: 210 },
  heroImage: { width: '100%', height: '100%' },
  heroScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 110, backgroundColor: 'rgba(20,10,0,0.45)' },
  backFab: {
    position: 'absolute', top: 12, left: 16, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center',
  },
  heroOverlay: { position: 'absolute', bottom: 14, left: 20, right: 20 },
  categoryPill: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 6,
  },
  categoryPillText: { color: colors.white, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: colors.white },
  heroSubtitle: { fontSize: 13, color: '#FFE8D9', marginTop: 2 },
  factRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginTop: 16 },
  factChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.trainerLight,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
  },
  factChipText: { fontSize: 12.5, fontWeight: '700', color: colors.primaryDark },
  section: { paddingHorizontal: 20, marginTop: 22 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  sectionHeaderRowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  bodyText: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  planBox: { backgroundColor: colors.cardBg, borderRadius: 14, padding: 14 },
  emptyText: { fontSize: 13.5, color: colors.textMuted },
  calendarIconBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.trainerLight,
    borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6, marginBottom: 8,
  },
  calendarIconBtnText: { fontSize: 12, fontWeight: '700', color: colors.trainer },
  onlineNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.trainerLight,
    borderRadius: 14, padding: 14,
  },
  onlineNoticeText: { flex: 1, fontSize: 12.5, color: colors.primaryDark, fontWeight: '600', lineHeight: 18 },
  mapWrap: {
    height: 150, borderRadius: 16, overflow: 'hidden', marginBottom: 10, backgroundColor: colors.neutral200,
  },
  mapOverlayBadge: {
    position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(20,20,20,0.72)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
  },
  mapOverlayBadgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  locationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  locationText: { flex: 1, fontSize: 13.5, color: colors.textSecondary, lineHeight: 19 },
  directionsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.trainerLight,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
  },
  directionsBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.trainer },
  guidelinesCard: {
    backgroundColor: colors.cardBg, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.neutral200,
  },
  dateCard: {
    width: 88, backgroundColor: colors.cardBg, borderRadius: 14, padding: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.neutral200, gap: 2,
  },
  dateCardSelected: { backgroundColor: colors.trainer, borderColor: colors.trainer },
  dateCardDisabled: { opacity: 0.45 },
  dateCardDay: { fontSize: 12.5, fontWeight: '800', color: colors.text },
  dateCardTime: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  dateCardSpots: { fontSize: 10.5, fontWeight: '700', color: colors.trainer, marginTop: 4 },
  dateCardTextSelected: { color: colors.white },
  upsellCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFBEB',
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FDE68A',
  },
  upsellText: { flex: 1, fontSize: 12.5, color: '#92400E', fontWeight: '600', lineHeight: 18 },
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28,
    backgroundColor: colors.cardBg, borderTopWidth: 1, borderTopColor: colors.neutral200,
  },
  priceLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  priceValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  joinButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.trainer,
    borderRadius: 14, paddingHorizontal: 22, paddingVertical: 14,
  },
  joinButtonDisabled: { opacity: 0.5 },
  joinButtonText: { color: colors.white, fontSize: 14.5, fontWeight: '700' },
});
