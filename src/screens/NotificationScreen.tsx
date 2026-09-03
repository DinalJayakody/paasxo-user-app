import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BellOff,
  Bell,
  Calendar,
  Check,
  CheckCheck,
  ChevronRight,
  CircleCheckBig,
  CircleX,
  Clock,
  CreditCard,
  Dumbbell,
  Heart,
  MapPin,
  MessageCircle,
  Sparkles,
  Trophy,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { notificationApi, NotificationCategory, NotificationResponse } from '../api/notificationApi';
import { invitationApi } from '../api/invitationApi';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { extractApiError } from '../utils/apiError';
import { LoadingScreen } from '../components/LoadingScreen';
import { PaasxoRefreshControl } from '../components/PaasxoRefreshControl';
import { PaasxoRefreshLogo } from '../components/PaasxoRefreshLogo';
import ScreenGlow from '../components/ScreenGlow';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function NotificationIcon({ type }: { type: string }) {
  const { colors } = useTheme();
  const size = 20;
  const sw = 2;
  switch (type) {
    case 'INVITATION_RECEIVED':   return <UserPlus color={colors.primary} size={size} strokeWidth={sw} />;
    case 'INVITATION_ACCEPTED':   return <UserCheck color={colors.success} size={size} strokeWidth={sw} />;
    case 'INVITATION_DECLINED':   return <UserMinus color={colors.error} size={size} strokeWidth={sw} />;
    case 'PAYMENT_REQUIRED':      return <CreditCard color='#F59E0B' size={size} strokeWidth={sw} />;
    case 'PAYMENT_SUCCESSFUL':    return <Check color={colors.success} size={size} strokeWidth={sw} />;
    case 'PLAYER_JOINED':         return <Trophy color={colors.primary} size={size} strokeWidth={sw} />;
    case 'PLAYER_ADDED_DIRECTLY': return <UserCheck color={colors.primary} size={size} strokeWidth={sw} />;
    case 'BOOKING_CONFIRMED':     return <CircleCheckBig color={colors.success} size={size} strokeWidth={sw} />;
    case 'BOOKING_REJECTED':      return <CircleX color={colors.error} size={size} strokeWidth={sw} />;
    case 'MATCH_CANCELLED_NOTIFY': return <CircleX color={colors.error} size={size} strokeWidth={sw} />;
    case 'FOLLOW_REQUEST_RECEIVED': return <UserPlus color={colors.primary} size={size} strokeWidth={sw} />;
    case 'FOLLOW_REQUEST_ACCEPTED': return <UserCheck color={colors.success} size={size} strokeWidth={sw} />;
    case 'NEW_FOLLOWER':          return <UserPlus color={colors.success} size={size} strokeWidth={sw} />;
    case 'POST_LIKED':            return <Heart color="#EF4444" size={size} strokeWidth={sw} />;
    case 'POST_COMMENTED':        return <MessageCircle color={colors.primary} size={size} strokeWidth={sw} />;
    case 'REEL_LIKED':            return <Heart color="#EF4444" size={size} strokeWidth={sw} />;
    case 'TOURNAMENT_PLAYER_ADDED': return <Trophy color={colors.primary} size={size} strokeWidth={sw} />;
    case 'WALK_RUN_INVITE_RECEIVED': return <UserPlus color={colors.primary} size={size} strokeWidth={sw} />;
    case 'WALK_RUN_INVITE_ACCEPTED': return <UserCheck color={colors.success} size={size} strokeWidth={sw} />;
    case 'WALK_RUN_INVITE_DECLINED': return <UserMinus color={colors.error} size={size} strokeWidth={sw} />;
    case 'TRAINER_NEW_SESSION':   return <Dumbbell color={colors.trainer} size={size} strokeWidth={sw} />;
    case 'NEARBY_SUGGESTION':     return <Sparkles color="#F59E0B" size={size} strokeWidth={sw} />;
    case 'SESSION_REMINDER':      return <Clock color={colors.trainer} size={size} strokeWidth={sw} />;
    case 'MATCH_REMINDER':        return <Clock color={colors.primary} size={size} strokeWidth={sw} />;
    case 'TOURNAMENT_REMINDER':   return <Calendar color={colors.primary} size={size} strokeWidth={sw} />;
    case 'VENUE_CLOSED':          return <MapPin color="#F59E0B" size={size} strokeWidth={sw} />;
    case 'BOOKING_PENDING_VENDOR_APPROVAL': return <Clock color="#F59E0B" size={size} strokeWidth={sw} />;
    default:                      return <Bell color={colors.textMuted} size={size} strokeWidth={sw} />;
  }
}

interface NotificationCardProps {
  notification: NotificationResponse;
  onAccept: (n: NotificationResponse) => void;
  onDecline: (n: NotificationResponse) => void;
  onPayNow: (n: NotificationResponse) => void;
  onPress: (n: NotificationResponse) => void;
  isActionInProgress: boolean;
  styles: ReturnType<typeof createStyles>;
}

function NotificationCard({
  notification: n,
  onAccept,
  onDecline,
  onPayNow,
  onPress,
  isActionInProgress,
  styles,
}: NotificationCardProps) {
  const { colors } = useTheme();
  const snap = n.matchSnapshot ?? {};
  const isInviteReceived = n.type === 'INVITATION_RECEIVED';
  const isPaymentRequired = n.type === 'PAYMENT_REQUIRED';
  const invStatus = n.invitationStatus;

  const showAcceptDecline = isInviteReceived && invStatus === 'REQUEST_SENT';
  const showPayNow = (isPaymentRequired || invStatus === 'ACCEPTED_AWAITING_PAYMENT') && n.invitationId;

  return (
    <Pressable style={[styles.card, n.read && styles.cardRead]} onPress={() => onPress(n)}>
      <View style={styles.cardLeft}>
        <View style={[styles.iconWrap, n.read && { opacity: 0.5 }]}>
          <NotificationIcon type={n.type} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, n.read && { fontWeight: '500' }]} numberOfLines={2}>
          {n.title}
        </Text>
        <Text style={styles.cardBodyText} numberOfLines={2}>{n.body}</Text>

        {/* Match snapshot mini-details */}
        {(snap.venueName || snap.slotDate) && (
          <View style={styles.snapRow}>
            {snap.venueName && (
              <View style={styles.snapItem}>
                <MapPin color={colors.textMuted} size={11} strokeWidth={2} />
                <Text style={styles.snapText} numberOfLines={1}>{snap.venueName}</Text>
              </View>
            )}
            {snap.slotDate && (
              <Text style={styles.snapText}>{snap.slotDate}  {snap.startTime?.slice(0, 5) ?? ''}</Text>
            )}
            {snap.currentPlayers != null && snap.maxPlayers != null && (
              <Text style={styles.snapText}>{snap.currentPlayers}/{snap.maxPlayers} players</Text>
            )}
            {snap.entryFeePerPlayer && (
              <Text style={styles.snapText}>LKR {snap.entryFeePerPlayer}/player</Text>
            )}
          </View>
        )}

        {/* Accept / Decline */}
        {showAcceptDecline && (
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.acceptBtn, isActionInProgress && styles.btnDisabled]}
              onPress={() => onAccept(n)}
              disabled={isActionInProgress}
            >
              {isActionInProgress
                ? <ActivityIndicator size="small" color={colors.white} />
                : <>
                    <Check color={colors.white} size={14} strokeWidth={2.5} />
                    <Text style={styles.acceptTxt}>Accept</Text>
                  </>
              }
            </Pressable>
            <Pressable
              style={[styles.declineBtn, isActionInProgress && styles.btnDisabled]}
              onPress={() => onDecline(n)}
              disabled={isActionInProgress}
            >
              <Text style={[styles.declineTxt, isActionInProgress && { opacity: 0.4 }]}>Decline</Text>
            </Pressable>
          </View>
        )}

        {/* Pay Now */}
        {showPayNow && (
          <Pressable style={styles.payBtn} onPress={() => onPayNow(n)}>
            <CreditCard color={colors.white} size={14} strokeWidth={2.5} />
            <Text style={styles.payTxt}>Pay Now</Text>
          </Pressable>
        )}

        <Text style={styles.timeAgo}>{timeAgo(n.createdAt)}</Text>
      </View>
      {!n.read && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

interface NotificationScreenProps {
  /** SOCIAL = Feed's bell (likes, comments, follows). GENERAL = Explore's bell
   *  (everything about matches, bookings, tournaments, trainers, venues). */
  category?: NotificationCategory;
}

const CATEGORY_COPY: Record<NotificationCategory, { title: string; emptyTitle: string; emptyBody: string }> = {
  SOCIAL: {
    title: 'Social',
    emptyTitle: 'No activity yet',
    emptyBody: 'Likes, comments, and new followers will show up here.',
  },
  GENERAL: {
    title: 'Activity',
    emptyTitle: 'No updates yet',
    emptyBody: 'Match invites and booking updates will show up here.',
  },
};

// Per the client's request, the GENERAL bell (Home/Explore) is scoped strictly to
// match and booking activity — tournament/walk-run/trainer/discovery notifications
// are still tagged GENERAL server-side, but filtered out of this list client-side
// so they don't dilute the "match and booking only" feed.
const MATCH_AND_BOOKING_TYPES = new Set<string>([
  'INVITATION_RECEIVED',
  'INVITATION_ACCEPTED',
  'INVITATION_DECLINED',
  'INVITATION_EXPIRED',
  'PAYMENT_REQUIRED',
  'PAYMENT_SUCCESSFUL',
  'PLAYER_JOINED',
  'PLAYER_ADDED_DIRECTLY',
  'MATCH_CANCELLED_NOTIFY',
  'BOOKING_PENDING_VENDOR_APPROVAL',
  'BOOKING_CONFIRMED',
  'BOOKING_REJECTED',
  'MATCH_REMINDER',
  'VENUE_CLOSED',
]);

export default function NotificationScreen({ category }: NotificationScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const copy = category ? CATEGORY_COPY[category] : null;

  const load = useCallback(async () => {
    try {
      const data = await notificationApi.getAll(category);
      setNotifications(
        category === 'GENERAL' ? data.filter((n) => MATCH_AND_BOOKING_TYPES.has(n.type)) : data
      );
    } catch {
      // silently fail on background refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (n: NotificationResponse) => {
    if (n.read) return;
    try {
      const updated = await notificationApi.markRead(n.id);
      setNotifications((prev) => prev.map((item) => item.id === n.id ? updated : item));
    } catch { /* ignore */ }
  };

  const handleAccept = async (n: NotificationResponse) => {
    if (!n.invitationId || actionInProgress) return;
    setActionInProgress(n.invitationId);
    try {
      const res = await invitationApi.accept(n.invitationId);
      await markRead(n);
      await load();
      if (res.requiresPayment) {
        router.push(`/join-checkout/${res.bookingId}?invitationId=${n.invitationId}` as any);
      } else {
        Alert.alert('Joined!', res.message || 'You have joined the match.');
      }
    } catch (err) {
      Alert.alert('Could Not Accept', extractApiError(err));
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDecline = async (n: NotificationResponse) => {
    if (!n.invitationId || actionInProgress) return;
    Alert.alert('Decline Invitation', 'Are you sure you want to decline this invitation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setActionInProgress(n.invitationId!);
          try {
            await invitationApi.decline(n.invitationId!);
            await markRead(n);
            await load();
          } catch (err) {
            Alert.alert('Could Not Decline', extractApiError(err));
          } finally {
            setActionInProgress(null);
          }
        },
      },
    ]);
  };

  const handlePayNow = (n: NotificationResponse) => {
    if (!n.invitationId) return;
    const bookingId = n.bookingId ?? n.matchSnapshot?.bookingId;
    router.push(`/join-checkout/${bookingId}?invitationId=${n.invitationId}` as any);
  };

  const handlePress = async (n: NotificationResponse) => {
    await markRead(n);
    const snap = n.matchSnapshot ?? {};

    if (n.bookingId && n.invitationStatus === 'JOIN_COMPLETED') {
      router.push(`/match/${n.bookingId}` as any);
    } else if (
      n.bookingId &&
      (n.type === 'BOOKING_CONFIRMED' || n.type === 'BOOKING_REJECTED' || n.type === 'MATCH_CANCELLED_NOTIFY' ||
        n.type === 'MATCH_REMINDER' || n.type === 'VENUE_CLOSED' || n.type === 'BOOKING_PENDING_VENDOR_APPROVAL')
    ) {
      // MatchDetailsScreen already branches on PENDING_VENDOR/ACTIVE_MATCH/CANCELLED,
      // so it's the right landing page for every one of these booking-lifecycle events.
      router.push(`/match/${n.bookingId}` as any);
    } else if (
      (n.type === 'FOLLOW_REQUEST_RECEIVED' || n.type === 'FOLLOW_REQUEST_ACCEPTED' || n.type === 'NEW_FOLLOWER')
      && snap.firebaseUid
    ) {
      router.push(`/friend-profile?user=${snap.firebaseUid}` as any);
    } else if ((n.type === 'POST_LIKED' || n.type === 'POST_COMMENTED') && snap.postId) {
      // These notifications are always about the recipient's own post, so the
      // right landing spot is that exact post in the recipient's own profile.
      router.push(`/profile?openPostId=${snap.postId}` as any);
    } else if (n.type === 'REEL_LIKED' && snap.reelId) {
      router.push(`/profile?openReelId=${snap.reelId}&tab=Reels` as any);
    } else if ((n.type === 'TOURNAMENT_PLAYER_ADDED' || n.type === 'TOURNAMENT_REMINDER') && snap.tournamentId) {
      router.push(`/tournament/${snap.tournamentId}` as any);
    } else if (n.type === 'TRAINER_NEW_SESSION' && snap.sessionId) {
      router.push(`/trainer-session/${snap.sessionId}` as any);
    } else if (n.type === 'SESSION_REMINDER' && snap.sessionId) {
      router.push(`/trainer-session/${snap.sessionId}` as any);
    } else if (n.type === 'NEARBY_SUGGESTION' && snap.venueId) {
      router.push('/explore?category=VENUES' as any);
    }
    // WALK_RUN_INVITE_* has no dedicated viewer screen yet - falls through to mark-read only.
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* ignore */ }
  };

  if (loading) {
    return <LoadingScreen message="Loading notifications…" />;
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenGlow />
      {/* Floating glass-gradient header */}
      <View style={styles.topHeaderShadow}>
        <View style={styles.topBar}>
          <LinearGradient
            colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.headerGlassStroke} pointerEvents="none" />

          <Text style={styles.screenTitle}>{copy ? copy.title : 'Notifications'}</Text>
          {unreadCount > 0 && (
            <Pressable style={styles.markAllBtn} onPress={handleMarkAllRead}>
              <CheckCheck color={colors.white} size={16} strokeWidth={2} />
              <Text style={styles.markAllTxt}>Mark all read</Text>
            </Pressable>
          )}
        </View>
      </View>

      <PaasxoRefreshLogo refreshing={refreshing} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <PaasxoRefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {notifications.length === 0 && (
          <View style={styles.emptyWrap}>
            <BellOff color={colors.textMuted} size={48} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>{copy ? copy.emptyTitle : 'No notifications yet'}</Text>
            <Text style={styles.emptyBody}>
              {copy ? copy.emptyBody : 'When players invite you or join your matches, you\'ll see it here.'}
            </Text>
          </View>
        )}
        {notifications.map((n) => (
          <NotificationCard
            key={n.id}
            notification={n}
            onAccept={handleAccept}
            onDecline={handleDecline}
            onPayNow={handlePayNow}
            onPress={handlePress}
            isActionInProgress={actionInProgress === n.invitationId}
            styles={styles}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 26,
    overflow: 'hidden',
  },
  headerGlassStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  screenTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markAllTxt: {
    fontSize: 13,
    color: colors.white,
    fontWeight: '600',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.primary + '12',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  cardRead: {
    backgroundColor: colors.cardBg,
  },
  cardLeft: {
    paddingTop: 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  cardBodyText: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 6,
    lineHeight: 18,
  },
  snapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  snapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  snapText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.success,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 80,
  },
  acceptTxt: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  declineBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  declineTxt: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  payTxt: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  timeAgo: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
