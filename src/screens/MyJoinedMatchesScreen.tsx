import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Calendar, Clock, History, MapPin, Search, X } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { bookingApi } from '../api/bookingApi';
import { extractApiError } from '../utils/apiError';
import { PaasxoLogoLoader } from '../components/PaasxoLogoLoader';
import ScreenGlow from '../components/ScreenGlow';
import { goBack } from '../utils/navigation';

// Must match BookingService.CANCELLATION_REFUND_LEAD_HOURS on the backend — purely for
// client-side copy; isWithinCancellationWindow on each match (computed server-side) is
// always the real source of truth for whether leaving right now is refund-eligible.
const REFUND_LEAD_HOURS = 48;

interface JoinedMatch {
  id: number;
  title?: string;
  sport?: string;
  futsalName?: string;
  locationName?: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  pricePerPlayer?: number;
  status?: string;
  paymentStatus?: string;
  isWithinCancellationWindow?: boolean;
}

function timeLabel(t?: string) {
  return t?.slice(0, 5) ?? '';
}
function dateLabel(iso: string) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function isPast(slotDate: string, endTime?: string) {
  if (!slotDate) return false;
  const end = new Date(`${slotDate}T${endTime || '23:59:59'}`);
  return end.getTime() < Date.now();
}

export default function MyJoinedMatchesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [matches, setMatches] = useState<JoinedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [leavingId, setLeavingId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [showPast, setShowPast] = useState(false);

  const load = useCallback(async () => {
    try {
      const res: JoinedMatch[] = await bookingApi.getJoinedBookings();
      setMatches(res);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Past/cancelled matches are hidden from the default view (nothing to join or act
  // on there) but stay reachable: typing a search term, or toggling "show history",
  // brings them back so a user can still look up a past activity's details.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return matches
      .filter((m) => {
        const inactive = m.status === 'CANCELLED' || isPast(m.slotDate, m.endTime);
        if (inactive && !showPast && !q) return false;
        if (q) {
          const haystack = `${m.title ?? ''} ${m.futsalName ?? ''} ${m.locationName ?? ''} ${m.sport ?? ''}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.slotDate === b.slotDate
        ? a.startTime.localeCompare(b.startTime)
        : (a.slotDate < b.slotDate ? -1 : 1)));
  }, [matches, query, showPast]);

  const handleLeave = (m: JoinedMatch) => {
    const paid = m.paymentStatus !== 'NOT_APPLICABLE';
    const refundEligible = m.isWithinCancellationWindow !== false;
    const message = !paid
      ? 'This match was free to join — leaving just frees up your spot.'
      : refundEligible
      ? `You're leaving more than ${REFUND_LEAD_HOURS} hours before kickoff, so your payment will be refunded in full.`
      : `This match starts within ${REFUND_LEAD_HOURS} hours, so per policy your payment won't be refunded. You'll still be removed from the match.`;

    Alert.alert('Leave This Match?', message, [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Leave Match',
        style: 'destructive',
        onPress: async () => {
          setLeavingId(m.id);
          try {
            await bookingApi.leaveMatch(m.id);
            await load();
          } catch (err) {
            Alert.alert('Could Not Leave', extractApiError(err, 'Could not leave this match. Please try again.'));
          } finally {
            setLeavingId(null);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenGlow />
      <View style={styles.header}>
        <Pressable onPress={() => goBack(router)} style={styles.backBtn} hitSlop={10}>
          <ArrowLeft color={colors.primary} size={22} />
        </Pressable>
        <Text style={styles.title}>Joined Matches</Text>
        <Pressable onPress={() => setShowPast((v) => !v)} style={styles.historyBtn} hitSlop={10}>
          <History color={showPast ? colors.primary : colors.textMuted} size={20} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Search color={colors.textMuted} size={16} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by match, venue, or sport"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <X color={colors.textMuted} size={16} />
          </Pressable>
        )}
      </View>
      {showPast && <Text style={styles.historyHint}>Showing past & cancelled matches too</Text>}

      {loading ? (
        <View style={styles.centerWrap}>
          <PaasxoLogoLoader size={44} elevated={false} />
          <Text style={styles.loadingText}>Loading your matches…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerWrap}>
          <Text style={styles.emptyEmoji}>⚽</Text>
          <Text style={styles.emptyTitle}>{query ? 'No matches found' : 'No joined matches yet'}</Text>
          <Text style={styles.emptySubtitle}>
            {query ? 'Try a different search term.' : 'Matches you join as a player will show up here.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {filtered.map((m) => {
            const cancelled = m.status === 'CANCELLED';
            const past = isPast(m.slotDate, m.endTime);
            const canLeave = !cancelled && !past;
            const isLeaving = leavingId === m.id;
            return (
              <Pressable
                key={m.id}
                style={[styles.card, (cancelled || past) && styles.cardMuted]}
                onPress={() => router.push(`/match/${m.id}`)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{m.title || m.sport || 'Match'}</Text>
                  {cancelled ? (
                    <View style={[styles.badge, styles.badgeCancelled]}>
                      <Text style={styles.badgeTextCancelled}>Cancelled</Text>
                    </View>
                  ) : past ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Completed</Text>
                    </View>
                  ) : null}
                </View>
                {!!(m.futsalName || m.locationName) && (
                  <View style={styles.metaRow}>
                    <MapPin color={colors.primary} size={13} strokeWidth={2.2} />
                    <Text style={styles.metaText} numberOfLines={1}>{m.futsalName || m.locationName}</Text>
                  </View>
                )}
                <View style={styles.metaRow}>
                  <Calendar color={colors.primary} size={13} strokeWidth={2.2} />
                  <Text style={styles.metaText}>{dateLabel(m.slotDate)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Clock color={colors.primary} size={13} strokeWidth={2.2} />
                  <Text style={styles.metaText}>{timeLabel(m.startTime)} – {timeLabel(m.endTime)}</Text>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.priceText}>
                    {m.pricePerPlayer ? `LKR ${m.pricePerPlayer.toFixed(2)} paid` : 'Free'}
                  </Text>
                  {canLeave && (
                    <Pressable
                      style={styles.leaveBtn}
                      onPress={() => handleLeave(m)}
                      disabled={isLeaving}
                      hitSlop={6}
                    >
                      {isLeaving ? (
                        <ActivityIndicator size="small" color={colors.error} />
                      ) : (
                        <>
                          <X color={colors.error} size={13} strokeWidth={2.5} />
                          <Text style={styles.leaveBtnText}>Leave</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  historyBtn: { width: 40, alignItems: 'flex-end' },
  title: { fontSize: 18, fontWeight: '900', color: colors.neutral900 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 14, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.neutral200,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  historyHint: {
    fontSize: 11.5, color: colors.textMuted, fontWeight: '600',
    marginHorizontal: 16, marginBottom: 10,
  },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  loadingText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.neutral900 },
  emptySubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },

  listContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  card: {
    backgroundColor: colors.cardBg, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  cardMuted: { opacity: 0.6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
  badge: { backgroundColor: colors.neutral100, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10.5, fontWeight: '700', color: colors.neutral600, textTransform: 'uppercase' },
  badgeCancelled: { backgroundColor: colors.error + '1A' },
  badgeTextCancelled: { fontSize: 10.5, fontWeight: '700', color: colors.error, textTransform: 'uppercase' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText: { fontSize: 12.5, color: colors.textSecondary, fontWeight: '600' },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.neutral200,
  },
  priceText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  leaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 8 },
  leaveBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.error },
});
