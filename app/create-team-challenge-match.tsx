import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft, Search, MapPin, Calendar, Clock, Swords, ChevronRight, X, Shield, Users,
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

function nextDays(count: number): { ymd: string; label: string; dow: string }[] {
  const out = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    out.push({
      ymd: d.toISOString().split('T')[0],
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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    teamApi.getMyTeams()
      .then((teams) => {
        const captained = teams.filter((t) => t.captainFirebaseUid === user?.firebaseUid);
        setMyCaptainedTeams(captained);
        if (captained.length === 1) setOrganizerTeamId(captained[0].id);
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

  const canSubmit = !!organizerTeamId && !!selectedVenue && !!selectedDate && selectedSlotIds.length > 0 && !submitting;

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
      });
      const bookingId = booking?.id ?? booking?.data?.id;
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
        <HeaderIconButton onPress={() => goBack(router)} style={styles.headerIconBtn} hitSlop={8}>
          <ArrowLeft color={colors.white} size={20} strokeWidth={2.2} />
        </HeaderIconButton>
        <Text style={styles.title}>Challenge a Team</Text>
        <View style={styles.headerIconBtn} />
        <LinearGradient
          colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}
        />
      </View>

      {loadingTeams ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : myCaptainedTeams.length === 0 ? (
        <View style={styles.center}>
          <Swords color={colors.neutral300} size={44} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>You need a team first</Text>
          <Text style={styles.emptyText}>Create a team and you'll be its captain — only captains can book a Team Match Challenge.</Text>
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
                After payment, you'll choose which team to challenge — they'll pay half (LKR {(totalCost / 2).toFixed(2)}) to accept.
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
