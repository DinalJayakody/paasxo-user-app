import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ActivityIndicator,
  Linking,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CircleCheckBig, Clock, MapPin, CalendarPlus, ArrowRight, Trophy, ShieldCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../styles/colors';
import { bookingApi } from '../api/bookingApi';
import { MatchDetails } from '../types/api';
import { parseMatchDetails } from '../utils/parseMatch';

interface BookingStatusScreenProps {
  matchId: string;
  forcePending?: boolean;
}

function addToCalendar(match: MatchDetails) {
  const toCalendarDate = (value?: string) => {
    const date = value ? new Date(value) : new Date();
    return date.toISOString().replace(/[-:]|\.\d{3}/g, '');
  };
  const start = toCalendarDate(match.startDate);
  const end = match.endDate ? toCalendarDate(match.endDate) : toCalendarDate(match.startDate);
  const url =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(match.title)}` +
    `&dates=${start}/${end}` +
    `&location=${encodeURIComponent(match.venue.name)}`;
  Linking.openURL(url).catch(() => {});
}

// Floating confetti particle
function ConfettiDot({ color, delay, startX }: { color: string; delay: number; startX: number }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -120, duration: 1600, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: (Math.random() - 0.5) * 80, duration: 1600, useNativeDriver: true }),
          Animated.timing(rotate, { toValue: 3, duration: 1600, useNativeDriver: true }),
        ]),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(translateY, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(rotate, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const rotation = rotate.interpolate({ inputRange: [0, 3], outputRange: ['0deg', '1080deg'] });

  return (
    <Animated.View
      style={[
        confettiStyles.dot,
        {
          backgroundColor: color,
          left: startX,
          opacity,
          transform: [{ translateY }, { translateX }, { rotate: rotation }],
        },
      ]}
    />
  );
}

const CONFETTI_COLORS = [Colors.primary, Colors.warning, Colors.success, '#F472B6', '#A78BFA', Colors.cricket];
const CONFETTI = Array.from({ length: 12 }, (_, i) => ({
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  delay: i * 150,
  startX: 20 + (i % 6) * 50,
}));

export default function BookingStatusScreen({ matchId, forcePending = false }: BookingStatusScreenProps) {
  const router = useRouter();
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Animations
  const circleScale = useRef(new Animated.Value(0)).current;
  const circleOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(40)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const loadMatch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bookingApi.getById(matchId);
      setMatch(parseMatchDetails(data));
    } catch {
      // show success screen even if match data fails
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => { loadMatch(); }, [loadMatch]);

  useEffect(() => {
    if (loading) return;
    // Staggered entrance
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(circleScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        Animated.timing(circleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(contentSlide, { toValue: 0, friction: 8, useNativeDriver: true }),
        Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, [loading]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={forcePending ? '#EA580C' : Colors.primary} />
        <Text style={styles.loadingText}>
          {forcePending ? 'Sending your request...' : 'Loading booking details...'}
        </Text>
      </SafeAreaView>
    );
  }

  const timeLabel = match?.startDate
    ? new Date(match.startDate).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
    : 'Time TBD';

  const dateLabel = match?.startDate
    ? new Date(match.startDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    : '';

  // forcePending: freshly created match — always pending until vendor explicitly accepts
  const isPendingVendor =
    forcePending ||
    match?.vendorStatus === 'PENDING_VENDOR' ||
    match?.status === 'PENDING_VENDOR' ||
    match?.status === 'PENDING';

  const gradColors: [string, string] = isPendingVendor
    ? ['#EA580C', '#C2410C']
    : [Colors.primary, Colors.primaryDark];

  return (
    <SafeAreaView style={styles.flex1} edges={['top', 'bottom']}>
      {/* Confetti only shown for confirmed bookings */}
      {!isPendingVendor && (
        <View style={confettiStyles.container} pointerEvents="none">
          {CONFETTI.map((c, i) => (
            <ConfettiDot key={i} color={c.color} delay={c.delay} startX={c.startX} />
          ))}
        </View>
      )}

      <LinearGradient colors={gradColors} style={styles.topGrad}>
        <Animated.View
          style={[
            styles.checkCircleWrap,
            { opacity: circleOpacity, transform: [{ scale: circleScale }] },
          ]}
        >
          <LinearGradient colors={['#ffffff30', '#ffffff10']} style={styles.checkCircleRing}>
            <View style={styles.checkCircle}>
              {isPendingVendor
                ? <Clock color="#EA580C" size={52} strokeWidth={2} />
                : <CircleCheckBig color={Colors.primary} size={52} strokeWidth={2} />
              }
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View style={{ opacity: circleOpacity, alignItems: 'center' }}>
          <Text style={styles.confirmedTitle}>
            {isPendingVendor ? 'Request Sent!' : 'Booking Confirmed!'}
          </Text>
          <Text style={styles.confirmedSubtitle}>
            {isPendingVendor
              ? `Waiting for ${match?.venue.name ?? 'the venue'} to accept`
              : match ? `at ${match.venue.name}` : 'Your slot has been reserved'}
          </Text>
        </Animated.View>
      </LinearGradient>

      <Animated.View
        style={[
          styles.sheet,
          { opacity: contentOpacity, transform: [{ translateY: contentSlide }] },
        ]}
      >
        {/* Booking ID badge */}
        <View style={[styles.bookingIdBadge, isPendingVendor && { backgroundColor: '#EA580C15' }]}>
          <Text style={[styles.bookingIdLabel, isPendingVendor && { color: '#EA580C' }]}>
            {isPendingVendor ? 'PENDING VENUE APPROVAL' : 'BOOKING ID'}
          </Text>
          <Text style={[styles.bookingIdText, isPendingVendor && { color: '#C2410C' }]}>
            #{matchId}
          </Text>
        </View>

        {/* Pending vendor explanation card */}
        {isPendingVendor && (
          <View style={styles.pendingInfoCard}>
            <View style={styles.pendingInfoRow}>
              <View style={[styles.pendingStep, { backgroundColor: '#EA580C20' }]}>
                <Clock color="#EA580C" size={16} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingStepTitle}>Awaiting venue confirmation</Text>
                <Text style={styles.pendingStepText}>
                  The venue has received your booking request. They'll accept or decline it shortly.
                </Text>
              </View>
            </View>
            <View style={styles.pendingInfoRow}>
              <View style={[styles.pendingStep, { backgroundColor: Colors.primaryLight }]}>
                <ShieldCheck color={Colors.primary} size={16} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingStepTitle}>Your payment is safe</Text>
                <Text style={styles.pendingStepText}>
                  Your payment is held securely in escrow. If the venue declines, you'll receive a full refund automatically.
                </Text>
              </View>
            </View>
            <View style={styles.pendingInfoRow}>
              <View style={[styles.pendingStep, { backgroundColor: '#DCFCE7' }]}>
                <Trophy color={Colors.success} size={16} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingStepTitle}>Once accepted → match goes live</Text>
                <Text style={styles.pendingStepText}>
                  Your match will become visible to nearby players and your booking status will update to Active.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Match details card */}
        {match && (
          <View style={styles.detailsCard}>
            <View style={styles.detailsRow}>
              <View style={styles.detailIconWrap}>
                <Trophy color={Colors.primary} size={18} strokeWidth={2} />
              </View>
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>SPORT</Text>
                <Text style={styles.detailValue}>{match.sportType}</Text>
              </View>
            </View>

            {match.startDate && (
              <View style={styles.detailsRow}>
                <View style={styles.detailIconWrap}>
                  <Clock color={Colors.primary} size={18} strokeWidth={2} />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={styles.detailLabel}>DATE & TIME</Text>
                  <Text style={styles.detailValue}>{dateLabel}</Text>
                  <Text style={styles.detailSubValue}>{timeLabel}</Text>
                </View>
              </View>
            )}

            <View style={[styles.detailsRow, { borderBottomWidth: 0, marginBottom: 0 }]}>
              <View style={styles.detailIconWrap}>
                <MapPin color={Colors.primary} size={18} strokeWidth={2} />
              </View>
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>VENUE</Text>
                <Text style={styles.detailValue}>{match.venue.name}</Text>
                {match.venue.address && (
                  <Text style={styles.detailSubValue}>{match.venue.address}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Total amount */}
        {match?.totalPrice != null && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Paid</Text>
            <Text style={styles.totalAmount}>
              {match.currencySymbol}{match.totalPrice.toFixed(2)}
            </Text>
          </View>
        )}

        {/* Add to Calendar — only for confirmed bookings */}
        {match && !isPendingVendor && (
          <Pressable style={styles.calendarBtn} onPress={() => addToCalendar(match)}>
            <CalendarPlus color={Colors.primary} size={18} strokeWidth={2} />
            <Text style={styles.calendarBtnText}>Add to Calendar</Text>
          </Pressable>
        )}

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.replace(`/match/${matchId}` as any)}
        >
          <LinearGradient
            colors={isPendingVendor ? ['#EA580C', '#C2410C'] : [Colors.primary, Colors.primaryDark]}
            style={styles.primaryButtonGrad}
          >
            <Text style={styles.primaryButtonText}>
              {isPendingVendor ? 'Track My Request' : 'View Match Details'}
            </Text>
            <ArrowRight color={Colors.white} size={18} strokeWidth={2.5} />
          </LinearGradient>
        </Pressable>

        <Pressable
          style={styles.homeBtn}
          onPress={() => router.replace('/home' as any)}
        >
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const confettiStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    pointerEvents: 'none',
  },
  dot: {
    position: 'absolute',
    bottom: 240,
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});

const styles = StyleSheet.create({
  flex1: { flex: 1, backgroundColor: Colors.background },
  loadingScreen: {
    flex: 1, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  loadingText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },

  topGrad: {
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 24,
    gap: 14,
  },
  checkCircleWrap: { marginBottom: 4 },
  checkCircleRing: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  confirmedTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.white,
    textAlign: 'center',
  },
  confirmedSubtitle: {
    fontSize: 14,
    color: Colors.white + 'CC',
    textAlign: 'center',
  },

  sheet: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: Platform.OS === 'ios' ? 16 : 24,
  },

  bookingIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  bookingIdLabel: { fontSize: 10, fontWeight: '800', color: Colors.primary, letterSpacing: 0.5 },
  bookingIdText: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark },

  detailsCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral100,
  },
  detailIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailInfo: { flex: 1 },
  detailLabel: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 0.5, marginBottom: 3 },
  detailValue: { fontSize: 14, fontWeight: '700', color: Colors.text },
  detailSubValue: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  totalLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  totalAmount: { fontSize: 22, fontWeight: '900', color: Colors.primary },

  calendarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  calendarBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },

  primaryButton: { borderRadius: 16, overflow: 'hidden', marginBottom: 10 },
  primaryButtonGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  primaryButtonText: { fontSize: 15, fontWeight: '800', color: Colors.white },

  homeBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  homeBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },

  // ── Pending vendor explanation card
  pendingInfoCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  pendingInfoRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  pendingStep: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pendingStepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  pendingStepText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
});
