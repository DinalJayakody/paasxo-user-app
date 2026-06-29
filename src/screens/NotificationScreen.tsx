import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  BellOff,
  Check,
  CheckCheck,
  ChevronRight,
  CircleCheckBig,
  CircleX,
  CreditCard,
  MapPin,
  Trophy,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { notificationApi, NotificationResponse } from '../api/notificationApi';
import { invitationApi } from '../api/invitationApi';
import { Colors } from '../styles/colors';
import { AuthContext } from '../context/AuthContext';
import { extractApiError } from '../utils/apiError';

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
  const size = 20;
  const sw = 2;
  switch (type) {
    case 'INVITATION_RECEIVED':   return <UserPlus color={Colors.primary} size={size} strokeWidth={sw} />;
    case 'INVITATION_ACCEPTED':   return <UserCheck color={Colors.success} size={size} strokeWidth={sw} />;
    case 'INVITATION_DECLINED':   return <UserMinus color={Colors.error} size={size} strokeWidth={sw} />;
    case 'PAYMENT_REQUIRED':      return <CreditCard color='#F59E0B' size={size} strokeWidth={sw} />;
    case 'PAYMENT_SUCCESSFUL':    return <Check color={Colors.success} size={size} strokeWidth={sw} />;
    case 'PLAYER_JOINED':         return <Trophy color={Colors.primary} size={size} strokeWidth={sw} />;
    case 'PLAYER_ADDED_DIRECTLY': return <UserCheck color={Colors.primary} size={size} strokeWidth={sw} />;
    case 'BOOKING_CONFIRMED':     return <CircleCheckBig color={Colors.success} size={size} strokeWidth={sw} />;
    case 'BOOKING_REJECTED':      return <CircleX color={Colors.error} size={size} strokeWidth={sw} />;
    default:                      return <Users color={Colors.textMuted} size={size} strokeWidth={sw} />;
  }
}

interface NotificationCardProps {
  notification: NotificationResponse;
  onAccept: (n: NotificationResponse) => void;
  onDecline: (n: NotificationResponse) => void;
  onPayNow: (n: NotificationResponse) => void;
  onPress: (n: NotificationResponse) => void;
  isActionInProgress: boolean;
}

function NotificationCard({
  notification: n,
  onAccept,
  onDecline,
  onPayNow,
  onPress,
  isActionInProgress,
}: NotificationCardProps) {
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
                <MapPin color={Colors.textMuted} size={11} strokeWidth={2} />
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
              <Text style={styles.snapText}>£{snap.entryFeePerPlayer}/player</Text>
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
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <>
                    <Check color={Colors.white} size={14} strokeWidth={2.5} />
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
            <CreditCard color={Colors.white} size={14} strokeWidth={2.5} />
            <Text style={styles.payTxt}>Pay Now</Text>
          </Pressable>
        )}

        <Text style={styles.timeAgo}>{timeAgo(n.createdAt)}</Text>
      </View>
      {!n.read && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

export default function NotificationScreen() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await notificationApi.getAll();
      setNotifications(data);
    } catch {
      // silently fail on background refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
    if (n.bookingId && n.invitationStatus === 'JOIN_COMPLETED') {
      router.push(`/match/${n.bookingId}` as any);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <Pressable style={styles.markAllBtn} onPress={handleMarkAllRead}>
            <CheckCheck color={Colors.primary} size={16} strokeWidth={2} />
            <Text style={styles.markAllTxt}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {notifications.length === 0 && (
          <View style={styles.emptyWrap}>
            <BellOff color={Colors.textMuted} size={48} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyBody}>
              When players invite you or join your matches, you'll see it here.
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
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  screenTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markAllTxt: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.primary + '12',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  cardRead: {
    backgroundColor: Colors.white,
  },
  cardLeft: {
    paddingTop: 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  cardBodyText: {
    fontSize: 13,
    color: Colors.textMuted,
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
    color: Colors.textMuted,
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
    backgroundColor: Colors.success,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 80,
  },
  acceptTxt: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  declineBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.error,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  declineTxt: {
    color: Colors.error,
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
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  timeAgo: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.primary,
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
    color: Colors.text,
  },
  emptyBody: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
