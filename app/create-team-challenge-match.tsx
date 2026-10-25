import { OpponentPickerSheet } from '@/src/components/team/OpponentPickerSheet';
import { resolveMediaUrl } from '@/src/utils/mediaUrl';
import * as Location from 'expo-location';
import { clearChallengeOpponent, rememberChallengeOpponent } from '@/src/utils/pendingTeamChallenge';
import { localYMD } from '@/src/utils/localDate';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft, Search, MapPin, Calendar, Clock, Swords, ChevronRight, X, Shield, Users, Globe, Target,
} from 'lucide-react-native';
import { ThemeColors, Colors } from '@/src/styles/colors';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { InputField } from '@/src/components/InputField';
import HeaderIconButton from '@/src/components/HeaderIconButton';
import ScreenGlow from '@/src/components/ScreenGlow';
import { futsalApi } from '@/src/api/futsalApi';
import { teamApi } from '@/src/api/teamApi';
import { teamMatchApi } from '@/src/api/teamMatchApi';
import { Team } from '@/src/types/api';
import { extractApiError } from '@/src/utils/apiError';
import { goBack } from '@/src/utils/navigation';
import { isTeamMatchSport, teamMatchSportLabel } from '@/src/constants/teamMatchSports';

type OpponentMode = 'DIRECT' | 'OPEN';

function nextDays(count: number): { ymd: string; label: string; dow: string }[] {
  const out = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    out.push({
      ymd: localYMD(d),
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : String(d.getDate()),
      dow: d.toLocaleDateString(undefined, { weekday: 'short' }),
    });
  }
  return out;
}
const DATE_OPTIONS = nextDays(14);

export default function CreateTeamChallengeMatchScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ mode?: string; teamId?: string; opponentTeamId?: string; opponentName?: string }>();
  // DIRECT: pick one team to challenge after paying. OPEN: list it in
  // Explore -> Team vs Team for any nearby same-sport team to take on.
  const [opponentMode, setOpponentMode] = useState<OpponentMode>(params.mode === 'open' ? 'OPEN' : 'DIRECT');
  const [ineligibleTeamCount, setIneligibleTeamCount] = useState(0);

  const [loadingTeams, setLoadingTeams] = useState(true);
  const [myCaptainedTeams, setMyCaptainedTeams] = useState<Team[]>([]);
  const [organizerTeamId, setOrganizerTeamId] = useState<string | null>(null);

  const [venueModalVisible, setVenueModalVisible] = useState(false);
  const [venueSearch, setVenueSearch] = useState('');
  const [venueOptions, setVenueOptions] = useState<any[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<any>(null);

  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlotIds, setSelectedSlotIds] = useState<number[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [pricePerSlot, setPricePerSlot] = useState<number | null>(null);

  const [title, setTitle] = useState('');
  // Chosen BEFORE paying, so the challenge goes out automatically afterwards.
  const [opponent, setOpponent] = useState<Team | null>(null);
  const [opponentPickerVisible, setOpponentPickerVisible] = useState(false);
  const [near, setNear] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    // Best effort, never prompts: only used to sort suggestions by distance.
    Location.getForegroundPermissionsAsync()
      .then((p) => (p.granted ? Location.getLastKnownPositionAsync() : null))
      .then((pos) => { if (pos) setNear({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!params.opponentTeamId) return;
    teamApi.getTeam(String(params.opponentTeamId)).then(setOpponent).catch(() => {});
  }, [params.opponentTeamId]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    teamApi.getMyTeams()
      .then((teams) => {
        const allCaptained = teams.filter((t) => t.captainFirebaseUid === user?.firebaseUid);
        // Team matches only exist for Futsal/Cricket/Pickleball/Paddleball (enforced server-side too).
        const captained = allCaptained.filter((t) => isTeamMatchSport(t.sport));
        setIneligibleTeamCount(allCaptained.length - captained.length);
        setMyCaptainedTeams(captained);
        // Opened from a team page: that team (if I captain it) organises.
        const preferred = params.teamId && captained.find((t) => t.id === params.teamId);
        if (preferred) setOrganizerTeamId(preferred.id);
        else if (captained.length === 1) setOrganizerTeamId(captained[0].id);
      })
      .catch(() => setMyCaptainedTeams([]))
      .finally(() => setLoadingTeams(false));
  }, [user?.firebaseUid]);

  useEffect(() => {
    if (!venueModalVisible) return;
    setLoadingVenues(true);
    futsalApi.listVenues()
      .then((data: any) => {
        const list = Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : [];
        setVenueOptions(list);
      })
      .catch(() => setVenueOptions([]))
      .finally(() => setLoadingVenues(false));
  }, [venueModalVisible]);

  const filteredVenues = useMemo(
    () => venueOptions.filter((v: any) =>
      (v.name || '').toLowerCase().includes(venueSearch.toLowerCase()) ||
      (v.location || v.city || '').toLowerCase().includes(venueSearch.toLowerCase())
    ),
    [venueOptions, venueSearch]
  );

  const handleSelectVenue = (venue: any) => {
    setSelectedVenue(venue);
    setVenueModalVisible(false);
    setSelectedDate('');
    setSlots([]);
    setSelectedSlotIds([]);
    const p = venue.price ?? venue.pricePerSlot ?? null;
    setPricePerSlot(p != null ? Number(p) : null);
  };

  const handleSelectDate = async (ymd: string) => {
    setSelectedDate(ymd);
    setSelectedSlotIds([]);
    if (!selectedVenue?.id) return;
    setLoadingSlots(true);
    try {
      const data: any = await futsalApi.getSlots(selectedVenue.id, ymd);
      const raw = Array.isArray(data) ? data : Array.isArray(data?.slots) ? data.slots : [];
      setSlots(raw.map((slot: any) => ({
        ...slot,
        time: slot.time || (slot.startTime ? `${slot.startTime.slice(0, 5)} - ${slot.endTime?.slice(0, 5) ?? ''}` : ''),
        status: slot.status ? String(slot.status).toLowerCase() : (slot.available ? 'available' : 'booked'),
      })));
      if (typeof data?.pricePerSlot === 'number') setPricePerSlot(data.pricePerSlot);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const toggleSlot = (slot: any) => {
    if (slot.status !== 'available') return;
    setSelectedSlotIds((prev) => (prev.includes(slot.id) ? prev.filter((id) => id !== slot.id) : [...prev, slot.id]));
  };

  const totalCost = (pricePerSlot ?? 0) * selectedSlotIds.length;
  const organizerTeam = myCaptainedTeams.find((t) => t.id === organizerTeamId) || null;

  // An opponent of a different sport can't be challenged — drop it if the organising team changes.
  useEffect(() => {
    if (opponent && organizerTeam && opponent.sport !== organizerTeam.sport) setOpponent(null);
  }, [organizerTeam, opponent]);

  const canSubmit = !!organizerTeamId && !!selectedVenue && !!selectedDate && selectedSlotIds.length > 0
    && (opponentMode === 'OPEN' || !!opponent) && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !organizerTeamId || !selectedVenue) return;
    setSubmitting(true);
    try {
      const booking = await teamMatchApi.createTeamMatchBooking({
        organizerTeamId,
        futsalId: selectedVenue.id,
        slotId: selectedSlotIds[0],
        slotIds: selectedSlotIds,
        title: title.trim() || `${organizerTeam?.name ?? 'Team'} Match Challenge`,
        sport: organizerTeam?.sport,
        date: selectedDate,
        openChallenge: opponentMode === 'OPEN',
      });
      const bookingId = booking?.id ?? booking?.data?.id;
      // Challenge started from an opponent's team page: carry that opponent
      // across payment so it's one tap to send the challenge afterwards.
      if (opponentMode === 'DIRECT' && opponent) {
        await rememberChallengeOpponent(opponent.id, opponent.name);
      } else {
        await clearChallengeOpponent();
      }
      router.replace(`/checkout/${bookingId}` as any);
    } catch (err) {
      Alert.alert('Could not create match', extractApiError(err, 'Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.flex1} edges={['top']}>
      <ScreenGlow />
      <View style={styles.header}>
        {/* Gradient first — it was drawn over the back button and title. */}
        <LinearGradient
          colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}
        />
        <HeaderIconButton onPress={() => goBack(router)} style={styles.headerIconBtn} hitSlop={8} accessibilityLabel="Back">
          <ArrowLeft color={colors.white} size={20} strokeWidth={2.2} />
        </HeaderIconButton>
        <Text style={styles.title}>{opponentMode === 'OPEN' ? 'Post an Open Challenge' : 'Challenge a Team'}</Text>
        <View style={styles.headerIconBtn} />
      </View>

      {loadingTeams ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : myCaptainedTeams.length === 0 ? (
        <View style={styles.center}>
          <Swords color={colors.neutral300} size={44} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>You need a team first</Text>
          <Text style={styles.emptyText}>
            {ineligibleTeamCount > 0
              ? "Team matches are for Futsal, Cricket, Pickleball and Paddleball teams. Create one of those from your Profile — you'll be its captain."
              : "Create a team and you'll be its captain — only captains can book a Team Match Challenge."}
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/create-team' as any)}>
            <Text style={styles.primaryBtnText}>Create a Team</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {myCaptainedTeams.length > 1 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PLAYING AS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {myCaptainedTeams.map((t) => (
                  <Pressable
                    key={t.id}
                    style={[styles.teamChip, organizerTeamId === t.id && styles.teamChipActive]}
                    onPress={() => setOrganizerTeamId(t.id)}
                  >
                    <Text style={[styles.teamChipText, organizerTeamId === t.id && styles.teamChipTextActive]}>{t.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>FIND AN OPPONENT</Text>
            <View style={styles.modeRow}>
              {([
                { id: 'DIRECT', Icon: Target, title: 'Challenge a team', sub: 'Pick the team now — they get the challenge when you pay' },
                { id: 'OPEN', Icon: Globe, title: 'Open challenge', sub: 'Any nearby team can take it on' },
              ] as const).map(({ id, Icon, title, sub }) => {
                const active = opponentMode === id;
                return (
                  <Pressable
                    key={id}
                    style={[styles.modeCard, active && styles.modeCardActive]}
                    onPress={() => setOpponentMode(id)}
                  >
                    <Icon color={active ? colors.primary : colors.textMuted} size={18} strokeWidth={2.2} />
                    <Text style={[styles.modeTitle, active && styles.modeTitleActive]}>{title}</Text>
                    <Text style={styles.modeSub}>{sub}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {opponentMode === 'DIRECT' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>OPPONENT</Text>
              <Pressable style={styles.venueCard} onPress={() => setOpponentPickerVisible(true)} accessibilityRole="button">
                {opponent ? (
                  <>
                    {resolveMediaUrl(opponent.logoUrl) ? (
                      <Image source={{ uri: resolveMediaUrl(opponent.logoUrl)! }} style={styles.opponentLogo} />
                    ) : (
                      <View style={styles.venueIconWrap}><Shield color={colors.primary} size={18} strokeWidth={2} /></View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.venueName} numberOfLines={1}>{opponent.name}</Text>
                      <Text style={styles.venueLocation} numberOfLines={1}>{opponent.members?.length ?? 0} players · tap to change</Text>
                    </View>
                    <ChevronRight color={colors.neutral400} size={18} />
                  </>
                ) : (
                  <>
                    <View style={styles.venueIconWrap}><Users color={colors.primary} size={18} strokeWidth={2} /></View>
                    <Text style={styles.venuePlaceholder}>Choose a team to challenge</Text>
                    <ChevronRight color={colors.neutral400} size={18} />
                  </>
                )}
              </Pressable>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>VENUE</Text>
            <Pressable style={styles.venueCard} onPress={() => setVenueModalVisible(true)}>
              {selectedVenue ? (
                <>
                  <View style={styles.venueIconWrap}><MapPin color={colors.primary} size={18} strokeWidth={2} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.venueName} numberOfLines={1}>{selectedVenue.name}</Text>
                    <Text style={styles.venueLocation} numberOfLines={1}>{selectedVenue.location || selectedVenue.city}</Text>
                  </View>
                  <ChevronRight color={colors.neutral400} size={18} />
                </>
              ) : (
                <>
                  <View style={styles.venueIconWrap}><Search color={colors.primary} size={18} strokeWidth={2} /></View>
                  <Text style={styles.venuePlaceholder}>Select a venue</Text>
                  <ChevronRight color={colors.neutral400} size={18} />
                </>
              )}
            </Pressable>
          </View>

          {selectedVenue && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>DATE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {DATE_OPTIONS.map((d) => (
                  <Pressable
                    key={d.ymd}
                    style={[styles.dateChip, selectedDate === d.ymd && styles.dateChipActive]}
                    onPress={() => handleSelectDate(d.ymd)}
                  >
                    <Text style={[styles.dateChipDow, selectedDate === d.ymd && styles.dateChipTextActive]}>{d.dow}</Text>
                    <Text style={[styles.dateChipLabel, selectedDate === d.ymd && styles.dateChipTextActive]}>{d.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {selectedDate && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>TIME SLOT</Text>
              {loadingSlots ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
              ) : slots.length === 0 ? (
                <Text style={styles.emptyText}>No slots available this day.</Text>
              ) : (
                <View style={styles.slotGrid}>
                  {slots.map((slot) => {
                    const selected = selectedSlotIds.includes(slot.id);
                    const disabled = slot.status !== 'available';
                    return (
                      <Pressable
                        key={slot.id}
                        style={[styles.slotChip, selected && styles.slotChipActive, disabled && styles.slotChipDisabled]}
                        onPress={() => toggleSlot(slot)}
                        disabled={disabled}
                      >
                        <Clock color={selected ? Colors.white : disabled ? colors.neutral400 : colors.textSecondary} size={12} strokeWidth={2.2} />
                        <Text style={[styles.slotChipText, selected && styles.slotChipTextActive, disabled && styles.slotChipTextDisabled]}>
                          {slot.time}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {selectedSlotIds.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>MATCH TITLE (OPTIONAL)</Text>
              <InputField placeholder={`${organizerTeam?.name ?? 'Team'} Match Challenge`} value={title} onChangeText={setTitle} maxLength={60} />
            </View>
          )}

          {selectedSlotIds.length > 0 && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Slots</Text>
                <Text style={styles.summaryValue}>{selectedSlotIds.length}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>You pay now (full)</Text>
                <Text style={styles.summaryTotal}>LKR {totalCost.toFixed(2)}</Text>
              </View>
              <Text style={styles.summaryHint}>
                {opponentMode === 'OPEN'
                  ? `Once the venue confirms, your match is listed in Explore › Team vs Team for nearby ${teamMatchSportLabel(organizerTeam?.sport)} teams. The first team to pay half (LKR ${(totalCost / 2).toFixed(2)}) takes it on, and that half is refunded to you automatically. If no team joins, you keep your booking — cancel more than 48h before kickoff for a full refund.`
                  : `Once you pay, ${opponent?.name ?? 'the team you picked'} gets your challenge. They pay half (LKR ${(totalCost / 2).toFixed(2)}) to accept, and that half is refunded to you automatically.`}
              </Text>
            </View>
          )}

          <Pressable
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Shield color={Colors.white} size={16} strokeWidth={2.4} />
                <Text style={styles.submitBtnText}>Continue to Payment</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      )}

      <OpponentPickerSheet
        visible={opponentPickerVisible}
        onClose={() => setOpponentPickerVisible(false)}
        onPick={setOpponent}
        sport={organizerTeam?.sport}
        myTeamIds={myCaptainedTeams.map((t) => t.id)}
        myUid={user?.firebaseUid}
        near={near}
      />

      <Modal visible={venueModalVisible} animationType="slide" transparent onRequestClose={() => setVenueModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Venue</Text>
              <Pressable onPress={() => setVenueModalVisible(false)}><X color={colors.text} size={22} /></Pressable>
            </View>
            <View style={styles.searchWrap}>
              <Search color={colors.neutral400} size={16} strokeWidth={2} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search venues…"
                placeholderTextColor={colors.neutral400}
                value={venueSearch}
                onChangeText={setVenueSearch}
              />
            </View>
            {loadingVenues ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
            ) : (
              <FlatList
                data={filteredVenues}
                keyExtractor={(item) => String(item.id)}
                style={{ maxHeight: 420 }}
                renderItem={({ item }) => (
                  <Pressable style={styles.venueRow} onPress={() => handleSelectVenue(item)}>
                    <View style={styles.venueIconWrap}><MapPin color={colors.primary} size={16} strokeWidth={2} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.venueName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.venueLocation} numberOfLines={1}>{item.location || item.city}</Text>
                    </View>
                  </Pressable>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No venues found.</Text>}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex1: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, overflow: 'hidden',
  },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.white },

  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 4 },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 13, marginTop: 8 },
  primaryBtnText: { color: Colors.white, fontSize: 14, fontWeight: '800' },

  scroll: { padding: 16, paddingBottom: 60 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, color: colors.neutral500, marginBottom: 10 },

  modeRow: { flexDirection: 'row', gap: 10 },
  modeCard: {
    flex: 1, gap: 4, padding: 12, borderRadius: 14,
    backgroundColor: colors.cardBg, borderWidth: 1.5, borderColor: colors.neutral200,
  },
  modeCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + '0A' },
  modeTitle: { fontSize: 13.5, fontWeight: '800', color: colors.textSecondary, marginTop: 2 },
  modeTitleActive: { color: colors.primary },
  modeSub: { fontSize: 11.5, color: colors.textMuted, lineHeight: 15 },

  teamChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, marginRight: 8,
    backgroundColor: colors.cardBg, borderWidth: 1.5, borderColor: colors.neutral200,
  },
  teamChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  teamChipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  teamChipTextActive: { color: Colors.white },

  venueCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.cardBg, borderRadius: 16, padding: 14,
    borderWidth: 1.5, borderColor: colors.neutral200,
  },
  opponentLogo: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.neutral100 },
  venueIconWrap: {
    width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary + '14',
  },
  venueName: { fontSize: 14.5, fontWeight: '800', color: colors.text },
  venueLocation: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  venuePlaceholder: { flex: 1, fontSize: 14, color: colors.neutral400, fontWeight: '600' },

  dateChip: {
    alignItems: 'center', justifyContent: 'center', gap: 2,
    width: 56, paddingVertical: 10, borderRadius: 14, marginRight: 8,
    backgroundColor: colors.cardBg, borderWidth: 1.5, borderColor: colors.neutral200,
  },
  dateChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dateChipDow: { fontSize: 10.5, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  dateChipLabel: { fontSize: 13.5, fontWeight: '800', color: colors.text },
  dateChipTextActive: { color: Colors.white },

  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12,
    backgroundColor: colors.cardBg, borderWidth: 1.5, borderColor: colors.neutral200,
  },
  slotChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotChipDisabled: { backgroundColor: colors.neutral100, borderColor: colors.neutral100 },
  slotChipText: { fontSize: 12.5, fontWeight: '700', color: colors.textSecondary },
  slotChipTextActive: { color: Colors.white },
  slotChipTextDisabled: { color: colors.neutral400, textDecorationLine: 'line-through' },

  summaryCard: {
    backgroundColor: colors.primary + '0F', borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: colors.primary + '22',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  summaryValue: { fontSize: 13, color: colors.text, fontWeight: '700' },
  summaryTotal: { fontSize: 16, color: colors.primary, fontWeight: '900' },
  summaryHint: { fontSize: 11.5, color: colors.textMuted, marginTop: 8, lineHeight: 16 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: Colors.white, fontSize: 15, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 32, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.inputBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.neutral200 },
});
