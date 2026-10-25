import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Calendar, Check, Lock, MapPin, Shield, ShieldCheck, Swords, UserCircle } from 'lucide-react-native';
import { ThemeColors, Colors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import HeaderIconButton from '../components/HeaderIconButton';
import ScreenGlow from '../components/ScreenGlow';
import { PayHereCheckoutWebView } from '../components/PayHereCheckoutWebView';
import { bookingApi } from '../api/bookingApi';
import { teamApi } from '../api/teamApi';
import { teamMatchApi } from '../api/teamMatchApi';
import { paymentApi } from '../api/paymentApi';
import { CheckoutInitiationResponse, OpenJoinOrder, Team } from '../types/api';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { extractApiError } from '../utils/apiError';
import { goBack } from '../utils/navigation';
import { teamMatchSportLabel } from '../constants/teamMatchSports';
import { PaasxoRefreshControl } from '../components/PaasxoRefreshControl';
import { PaasxoRefreshLogo } from '../components/PaasxoRefreshLogo';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

const STATUS_POLL_ATTEMPTS = 10;
const STATUS_POLL_INTERVAL_MS = 1500;
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
const money = (n?: number | null) => `LKR ${Number(n ?? 0).toFixed(2)}`;

interface Props {
  bookingId: string;
  // Half of the booking's charged total, as shown on the listing card — only a
  // preview; the authoritative amount comes back from createJoinOrder.
  initialAmountDue?: number;
  // Passed from the Team vs Team list so this screen doesn't refetch it.
  initialOrganizerTeamName?: string;
}

/**
 * A captain takes on an open Team Match Challenge with one of the teams they
 * captain (teams are created and managed from the Profile screen). Picking a
 * team asks the backend to validate it (sport, no shared players, spot still
 * free) and returns the exact half-price payment order; paying runs it through
 * PayHere exactly like TeamChallengeAcceptScreen. The team is only placed in
 * the match once the payment is confirmed server-side — if another team's
 * payment lands first, this one is refunded in full automatically.
 */
export default function TeamMatchJoinScreen({ bookingId, initialAmountDue, initialOrganizerTeamName }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();

  const [booking, setBooking] = useState<any>(null);
  const [organizerTeamName, setOrganizerTeamName] = useState<string | null>(initialOrganizerTeamName ?? null);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [order, setOrder] = useState<OpenJoinOrder | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [checkoutData, setCheckoutData] = useState<CheckoutInitiationResponse | null>(null);
  const [webViewVisible, setWebViewVisible] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // The match (still open? price?) and the captain's own teams — on open and
  // on pull-to-refresh (e.g. after creating a team in Profile and coming back).
  const load = useCallback(async () => {
    try {
      const [b, teams] = await Promise.all([bookingApi.getById(bookingId), teamApi.getMyTeams()]);
      if (!mountedRef.current) return;
      setBooking(b);
      setLoadError(null);
      const captained = teams.filter((t) => t.captainFirebaseUid === user?.firebaseUid);
      setMyTeams(captained);
      // Drop a selection that's no longer one of my teams (e.g. deleted meanwhile).
      setSelectedTeamId((cur) => (cur && captained.some((t) => t.id === cur) ? cur : null));
      if (b?.organizerTeamId && !initialOrganizerTeamName) {
        teamApi.getTeam(b.organizerTeamId).then((t) => mountedRef.current && setOrganizerTeamName(t.name)).catch(() => {});
      }
    } catch (err) {
      if (mountedRef.current) setLoadError(extractApiError(err, 'Could not load this match.'));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [bookingId, user?.firebaseUid, initialOrganizerTeamName]);

  useEffect(() => { load(); }, [load]);
  const { refreshing, onRefresh } = usePullToRefresh(load);
  const refreshControl = <PaasxoRefreshControl refreshing={refreshing} onRefresh={onRefresh} />;

  const matchSport = (booking?.sport || '').toUpperCase();
  const unavailableReason: string | null = !booking ? null
    : booking.status === 'CANCELLED' ? 'This match has been cancelled.'
    : booking.opponentTeamId ? 'Another team has already taken this match.'
    : !booking.openTeamChallenge ? "This match isn't open for teams to join."
    : null;

  // Client-side pre-check only, for clear guidance — the backend re-validates all of it.
  const teamIneligibility = (team: Team): string | null => {
    if (team.id === booking?.organizerTeamId) return 'Organizing team';
    if ((team.sport || '').toUpperCase() !== matchSport) return `${teamMatchSportLabel(team.sport)} team`;
    return null;
  };

  // Picking a team is local only; the server-side order (and every eligibility
  // re-check) happens once, when the captain actually taps Pay.
  const handleSelectTeam = (team: Team) => {
    if (teamIneligibility(team) || preparing || submitting) return;
    if (team.id !== selectedTeamId) setOrder(null);
    setSelectedTeamId(team.id);
    setOrderError(null);
  };

  const handleCheckoutCompleted = async () => {
    if (!order) return;
    setWebViewVisible(false);
    setSubmitting(true);
    try {
      for (let attempt = 0; attempt < STATUS_POLL_ATTEMPTS; attempt++) {
        const status = await paymentApi.getStatus('TEAM_CHALLENGE_ACCEPT', order.paymentOrderId);
        if (status.status === 'CHARGED' || status.status === 'CONFIRMED'
          || status.status === 'REFUND_REQUESTED' || status.status === 'REFUNDED') {
          // Charged — but only the booking itself says whether this team actually got
          // the spot, or another team's payment landed first (then this one is refunded).
          const latest = await bookingApi.getById(bookingId).catch(() => null);
          if (latest?.opponentTeamId === selectedTeamId) {
            Alert.alert("You're in!", 'Your team is confirmed for this match. See you on the pitch.', [
              { text: 'View Match', onPress: () => router.replace(`/match/${bookingId}` as any) },
            ]);
          } else if (latest?.opponentTeamId || latest?.status === 'CANCELLED'
            || status.status === 'REFUND_REQUESTED' || status.status === 'REFUNDED') {
            Alert.alert(
              'Spot already taken',
              'Another team claimed this match just before your payment went through. Your payment is being refunded in full.',
              [{ text: 'OK', onPress: () => router.replace('/team-matches' as any) }],
            );
          } else {
            Alert.alert('Payment received', "We're confirming your spot — it'll show on the match in a moment.", [
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
      setSubmitting(false);
    }
  };

  const handlePay = async () => {
    if (!selectedTeamId) return;
    let activeOrder = order;
    if (!activeOrder) {
      setPreparing(true);
      setOrderError(null);
      try {
        // Idempotent server-side: retrying with the same team reuses the same order.
        activeOrder = await teamMatchApi.createJoinOrder(bookingId, selectedTeamId);
        setOrder(activeOrder);
      } catch (err) {
        setOrderError(extractApiError(err, 'This team cannot join this match.'));
        return;
      } finally {
        setPreparing(false);
      }
    }
    setSubmitting(true);
    try {
      const initiation = await paymentApi.initiateCheckout('TEAM_CHALLENGE_ACCEPT', activeOrder.paymentOrderId);
      if (initiation.dummyMode) {
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

  const amountDue = order?.amountDue ?? initialAmountDue
    ?? (booking?.totalPrice != null ? Number(booking.totalPrice) / 2 : null);
  const totalPrice = order?.totalPrice ?? (amountDue != null ? amountDue * 2 : null);
  const selectedTeam = myTeams.find((t) => t.id === selectedTeamId) || null;

  const renderBody = () => {
    if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
    if (loadError || !booking) {
      return (
        <ScrollView contentContainerStyle={[styles.center, { flexGrow: 1 }]} refreshControl={refreshControl}>
          <Text style={styles.emptyText}>{loadError ?? 'Match not found.'}</Text>
          <Text style={styles.emptyText}>Pull down to try again.</Text>
        </ScrollView>
      );
    }
    if (unavailableReason) {
      return (
        <ScrollView contentContainerStyle={[styles.center, { flexGrow: 1 }]} refreshControl={refreshControl}>
          <Swords color={colors.neutral300} size={44} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>Not available</Text>
          <Text style={styles.emptyText}>{unavailableReason}</Text>
          <Pressable style={styles.secondaryBtn} onPress={() => router.replace('/team-matches' as any)}>
            <Text style={styles.secondaryBtnText}>Browse other team matches</Text>
          </Pressable>
        </ScrollView>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
        <View style={styles.vsCard}>
          <Text style={styles.vsSport}>{teamMatchSportLabel(booking.sport).toUpperCase()}</Text>
          <View style={styles.vsRow}>
            <Text style={styles.vsTeam} numberOfLines={2}>{organizerTeamName ?? 'Organizing team'}</Text>
            <Swords color={colors.primary} size={22} strokeWidth={2.2} />
            <Text style={[styles.vsTeam, !selectedTeam && styles.vsTeamPlaceholder]} numberOfLines={2}>
              {selectedTeam?.name ?? 'Your team'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MapPin color={colors.textMuted} size={13} strokeWidth={2.2} />
            <Text style={styles.infoText} numberOfLines={1}>{booking.futsalName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Calendar color={colors.textMuted} size={13} strokeWidth={2.2} />
            <Text style={styles.infoText}>
              {booking.slotDate} · {String(booking.startTime || '').slice(0, 5)} – {String(booking.endTime || '').slice(0, 5)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>PLAY AS</Text>
        {myTeams.length === 0 ? (
          <View style={styles.noTeamCard}>
            <Shield color={colors.neutral400} size={28} strokeWidth={1.6} />
            <Text style={styles.noTeamTitle}>You don't captain a team yet</Text>
            <Text style={styles.emptyText}>
              Only team captains can take on a team match. Create your {teamMatchSportLabel(booking.sport)} team from your Profile, add your players, then come back.
            </Text>
            <Pressable style={styles.secondaryBtn} onPress={() => router.push('/profile' as any)}>
              <UserCircle color={colors.primary} size={16} strokeWidth={2.2} />
              <Text style={styles.secondaryBtnText}>Go to Profile</Text>
            </Pressable>
          </View>
        ) : (
          myTeams.map((team) => {
            const reason = teamIneligibility(team);
            const selected = selectedTeamId === team.id;
            const logo = resolveMediaUrl(team.logoUrl) ?? null;
            return (
              <Pressable
                key={team.id}
                style={[styles.teamRow, selected && styles.teamRowActive, !!reason && styles.teamRowDisabled]}
                onPress={() => handleSelectTeam(team)}
                disabled={!!reason || preparing || submitting}
              >
                {logo ? (
                  <Image source={{ uri: logo }} style={styles.teamLogo} />
                ) : (
                  <View style={[styles.teamLogo, styles.teamLogoFallback]}>
                    <Shield color={colors.primary} size={18} strokeWidth={2} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamName} numberOfLines={1}>{team.name}</Text>
                  <Text style={styles.teamSub}>
                    {reason ?? `${team.members?.length ?? 0} ${(team.members?.length ?? 0) === 1 ? 'player' : 'players'}`}
                  </Text>
                </View>
                {selected ? (
                  <View style={styles.checkCircle}><Check color={Colors.white} size={14} strokeWidth={3} /></View>
                ) : null}
              </Pressable>
            );
          })
        )}

        {!!orderError && <Text style={styles.errorText}>{orderError}</Text>}

        {myTeams.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Booking total</Text>
              <Text style={styles.summaryValue}>{totalPrice != null ? money(totalPrice) : '—'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Paid upfront by {organizerTeamName ?? 'the organizing team'}</Text>
              <Text style={styles.summaryValue}>{totalPrice != null ? money(totalPrice) : '—'}</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotalRow]}>
              <Text style={styles.summaryTotalLabel}>Your team pays (half)</Text>
              <Text style={styles.summaryTotal}>{amountDue != null ? money(amountDue) : '—'}</Text>
            </View>
            <Text style={styles.summaryHint}>
              Your half goes to the team that booked this match — they're refunded the same amount automatically, so both teams pay equally.
              If the match is cancelled, or another team claims it just before your payment goes through, you're refunded in full.
              Once confirmed, your team's place can't be withdrawn.
            </Text>
          </View>
        )}

        {myTeams.length > 0 && (
          <>
            <View style={styles.secureRow}>
              <ShieldCheck color={colors.success} size={14} strokeWidth={2} />
              <Text style={styles.secureText}>Secured by PayHere</Text>
            </View>
            <Pressable
              style={[styles.payBtn, (!selectedTeamId || submitting || preparing) && styles.payBtnDisabled]}
              onPress={handlePay}
              disabled={!selectedTeamId || submitting || preparing}
            >
              {submitting || preparing ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Lock color={Colors.white} size={16} strokeWidth={2.4} />
                  <Text style={styles.payBtnText}>
                    {selectedTeamId
                      ? `Pay ${amountDue != null ? money(amountDue) : 'half'} & Join`
                      : 'Pick a team to continue'}
                  </Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.flex1} edges={['top']}>
      <ScreenGlow />
      <View style={styles.header}>
        <LinearGradient
          colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}
        />
        <HeaderIconButton onPress={() => goBack(router, '/team-matches')} style={styles.headerIconBtn} hitSlop={8}>
          <ArrowLeft color={colors.white} size={20} strokeWidth={2.2} />
        </HeaderIconButton>
        <Text style={styles.title}>Take On This Match</Text>
        <View style={styles.headerIconBtn} />
      </View>

      <View style={{ flex: 1 }}>
        <PaasxoRefreshLogo refreshing={refreshing} />
        {renderBody()}
      </View>

      <PayHereCheckoutWebView
        visible={webViewVisible}
        checkout={checkoutData}
        onCompleted={handleCheckoutCompleted}
        onDismissed={() => setWebViewVisible(false)}
        onError={(message) => { setWebViewVisible(false); Alert.alert('Payment Failed', message || 'Something went wrong. Please try again.'); }}
        onClose={() => setWebViewVisible(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex1: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, overflow: 'hidden',
  },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.white },
  scroll: { padding: 16, paddingBottom: 48 },

  vsCard: {
    backgroundColor: colors.cardBg, borderRadius: 20, padding: 18, marginBottom: 20, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.neutral200,
  },
  vsSport: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, color: colors.primary },
  vsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  vsTeam: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text, textAlign: 'center' },
  vsTeamPlaceholder: { color: colors.textMuted },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 12.5, color: colors.textSecondary, fontWeight: '600', flexShrink: 1 },

  sectionLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, color: colors.neutral500, marginBottom: 10 },
  teamRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.cardBg, borderRadius: 16, padding: 12, marginBottom: 10,
    borderWidth: 1.5, borderColor: colors.neutral200,
  },
  teamRowActive: { borderColor: colors.primary, backgroundColor: colors.primary + '0A' },
  teamRowDisabled: { opacity: 0.5 },
  teamLogo: { width: 42, height: 42, borderRadius: 21 },
  teamLogoFallback: { backgroundColor: colors.primary + '14', alignItems: 'center', justifyContent: 'center' },
  teamName: { fontSize: 14.5, fontWeight: '800', color: colors.text },
  teamSub: { fontSize: 11.5, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  errorText: { fontSize: 12.5, color: colors.error, fontWeight: '700', marginBottom: 12, lineHeight: 18 },

  noTeamCard: {
    alignItems: 'center', gap: 8, backgroundColor: colors.cardBg, borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: colors.neutral200,
  },
  noTeamTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6,
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10,
  },
  secondaryBtnText: { color: colors.primary, fontSize: 13.5, fontWeight: '800' },

  summaryCard: {
    backgroundColor: colors.primary + '0F', borderRadius: 16, padding: 16, marginTop: 6, marginBottom: 16,
    borderWidth: 1, borderColor: colors.primary + '22',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  summaryLabel: { flex: 1, fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  summaryValue: { fontSize: 13, color: colors.text, fontWeight: '700' },
  summaryTotalRow: { marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.primary + '22' },
  summaryTotalLabel: { fontSize: 14, color: colors.text, fontWeight: '800' },
  summaryTotal: { fontSize: 17, color: colors.primary, fontWeight: '900' },
  summaryHint: { fontSize: 11.5, color: colors.textMuted, marginTop: 8, lineHeight: 16 },

  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14 },
  secureText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16,
  },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
});
