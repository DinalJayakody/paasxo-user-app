import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  MapPin,
  Calendar as CalendarIcon,
  Clock,
  Users,
  FileText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  X,
  Check,
  Info,
  Globe,
  Lock,
  Search,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { Colors, ThemeColors } from '../src/styles/colors';
import { useTheme } from '@/src/context/ThemeContext';
import { bookingApi } from '../src/api/bookingApi';
import { invitationApi } from '../src/api/invitationApi';
import { placeApi, PlaceSuggestion } from '../src/api/placeApi';
import { PlayerSearchSheet, SearchedPlayer } from '../src/components/PlayerSearchSheet';
import { extractApiError } from '../src/utils/apiError';
import { getTermsOfServiceUrl } from '../src/constants/legal';
import ScreenGlow from '../src/components/ScreenGlow';
import { goBack } from '../src/utils/navigation';

// Mirrors the backend's default PlatformProperties.publicSpaceMatchFee (LKR) —
// shown before the booking exists; the actual charge is always computed
// server-side (BookingService.createPublicSpaceBooking).
const PUBLIC_SPACE_FEE_DISPLAY = 300;

const DEFAULT_REGION = { latitude: 6.9271, longitude: 79.8612, latitudeDelta: 0.05, longitudeDelta: 0.05 };

const SPORTS = [
  { id: 'FUTSAL', label: 'Futsal', emoji: '⚽', color: Colors.futsal },
  { id: 'CRICKET', label: 'Cricket', emoji: '🏏', color: Colors.cricket },
  { id: 'PICKLEBALL', label: 'Pickleball', emoji: '🏓', color: Colors.pickleball },
  { id: 'PADDLEBALL', label: 'Paddleball', emoji: '🎾', color: Colors.paddleball },
];

// 06:00–22:00 in 30-minute increments.
const START_TIME_OPTIONS = Array.from({ length: 33 }, (_, i) => {
  const totalMinutes = 6 * 60 + i * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});
const DURATION_OPTIONS = [
  { label: '1 hr', minutes: 60 },
  { label: '1.5 hr', minutes: 90 },
  { label: '2 hr', minutes: 120 },
  { label: '3 hr', minutes: 180 },
];

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_FORMATTER = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function isSameMonth(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }
function toIsoDate(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

function CalendarModal({ visible, onClose, selectedDate, onSelect, colors }: {
  visible: boolean; onClose: () => void; selectedDate: string;
  onSelect: (iso: string) => void; colors: ThemeColors;
}) {
  const styles = useMemo(() => createCalendarStyles(colors), [colors]);
  const today = useMemo(() => new Date(new Date().toDateString()), []);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selectedDate ? new Date(selectedDate + 'T00:00:00') : today));

  const days = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = Array(startWeekday).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
    return cells;
  }, [viewMonth]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} hitSlop={8}>
              <ChevronLeft color={colors.text} size={20} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTH_FORMATTER.format(viewMonth)}</Text>
            <TouchableOpacity onPress={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} hitSlop={8}>
              <ChevronRight color={colors.text} size={20} />
            </TouchableOpacity>
          </View>
          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map((w, i) => <Text key={i} style={styles.weekLabel}>{w}</Text>)}
          </View>
          <View style={styles.grid}>
            {days.map((d, i) => {
              if (!d) return <View key={i} style={styles.cell} />;
              const iso = toIsoDate(d);
              const isPast = d < today;
              const isSelected = iso === selectedDate;
              return (
                <TouchableOpacity
                  key={i} style={styles.cell} disabled={isPast}
                  onPress={() => { onSelect(iso); onClose(); }}
                >
                  <View style={[styles.dayCircle, isSelected && { backgroundColor: colors.primary }]}>
                    <Text style={[styles.dayText, isPast && { color: colors.neutral300 }, isSelected && { color: colors.white, fontWeight: '800' }]}>
                      {d.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function CreatePublicMatch() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedSport, setSelectedSport] = useState('FUTSAL');
  const [eventTitle, setEventTitle] = useState('');
  const [description, setDescription] = useState('');

  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationName, setLocationName] = useState('');
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const mapRef = useRef<MapView>(null);

  // Search-by-name (e.g. "Shalika Ground") — the primary, recommended way to
  // pick a location; tap-to-drop-a-pin on the map below stays available too,
  // for a place too new/obscure to show up in search. Debounced so typing
  // doesn't fire a backend request per keystroke (results are also cached
  // server-side — see PlaceSearchService).
  const [locationQuery, setLocationQuery] = useState('');
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const query = locationQuery.trim();
    if (query.length < 3) {
      setPlaceSuggestions([]);
      setSearchingPlaces(false);
      return;
    }
    setSearchingPlaces(true);
    searchDebounceRef.current = setTimeout(async () => {
      const results = await placeApi.search(query);
      setPlaceSuggestions(results);
      setSearchingPlaces(false);
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [locationQuery]);

  const handleSelectSuggestion = (suggestion: PlaceSuggestion) => {
    const coordinate = { latitude: suggestion.latitude, longitude: suggestion.longitude };
    setPin(coordinate);
    setLocationName(suggestion.name || suggestion.displayName);
    setPlaceSuggestions([]);
    setLocationQuery('');
    mapRef.current?.animateToRegion({ ...coordinate, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 400);
  };

  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);

  const [maxCapacity, setMaxCapacity] = useState('10');
  const [minPlayers, setMinPlayers] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const [showPlayerSearch, setShowPlayerSearch] = useState(false);
  const [directPlayers, setDirectPlayers] = useState<SearchedPlayer[]>([]);
  const [requestedPlayers, setRequestedPlayers] = useState<SearchedPlayer[]>([]);

  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentSport = SPORTS.find((s) => s.id === selectedSport) || SPORTS[0];
  const endTime = startTime ? addMinutes(startTime, durationMinutes) : '';

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return 'Select a date';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };
  const timeLabel = (t: string) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  };

  const handlePickOnMap = async (event: any) => {
    const coordinate = event.nativeEvent.coordinate;
    setPin(coordinate);
    setResolvingAddress(true);
    try {
      const results = await Location.reverseGeocodeAsync(coordinate);
      const r = results?.[0];
      if (r) {
        const parts = [r.name, r.street, r.city, r.region].filter(Boolean);
        setLocationName(parts.slice(0, 2).join(', ') || parts.join(', ') || 'Selected Location');
      }
    } catch {
      // Reverse geocoding is best-effort only — the organizer can always type/edit
      // the name directly, so a failed lookup here is never a blocking error.
    } finally {
      setResolvingAddress(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!pin || !locationName.trim()) {
      alert('Please pick a public space location before continuing.');
      return;
    }
    if (!selectedDate || !startTime) {
      alert('Please select a date and start time before continuing.');
      return;
    }
    if (!rulesAccepted) {
      alert('Please accept the rules and guidelines');
      return;
    }
    setSubmitting(true);
    try {
      const maxP = maxCapacity ? parseInt(maxCapacity, 10) : undefined;
      const minP = minPlayers ? parseInt(minPlayers, 10) : undefined;
      const result = await bookingApi.createBooking({
        isPublicSpaceMatch: true,
        publicSpaceName: locationName.trim(),
        publicSpaceLatitude: pin.latitude,
        publicSpaceLongitude: pin.longitude,
        date: selectedDate,
        startTime,
        endTime,
        title: eventTitle.trim() || undefined,
        description: description.trim() || undefined,
        sport: selectedSport,
        maxPlayers: maxP,
        minPlayers: minP,
        isPublic,
        players: directPlayers.length > 0 ? directPlayers.map((p) => p.firebaseUid) : undefined,
      });
      const newId = result?.id ?? result?.data?.id ?? result?._id ?? result?.bookingId;

      if (newId && requestedPlayers.length > 0) {
        const inviteResults = await Promise.allSettled(
          requestedPlayers.map((p) => invitationApi.invite(newId, p.firebaseUid))
        );
        const failed = inviteResults.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
        if (failed.length > 0) {
          const reasons = [...new Set(failed.map((r) => extractApiError(r.reason, undefined)).filter(Boolean))];
          const sent = requestedPlayers.length - failed.length;
          alert(`Some invitations could not be sent:\n\n${reasons.length > 0 ? reasons.join('\n') : `${sent} of ${requestedPlayers.length} invitations were sent successfully.`}`);
        }
      }

      router.replace(`/checkout/${newId}` as any);
    } catch (err) {
      alert(extractApiError(err, 'Something went wrong while saving the match. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.safeArea}>
      <ScreenGlow />
      <LinearGradient
        colors={[currentSport.color, currentSport.color + 'CC']}
        style={[styles.headerGrad, { paddingTop: insets.top + 12 }]}
      >
        <Pressable onPress={() => goBack(router)} style={styles.backBtn} hitSlop={8}>
          <ArrowLeft color={colors.white} size={22} strokeWidth={2.5} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Create Public Match</Text>
          <Text style={styles.headerSub}>{currentSport.emoji} {currentSport.label} · Free public space</Text>
        </View>
        <View style={{ width: 36 }} />
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          <View style={styles.infoBanner}>
            <Info color={colors.primary} size={16} strokeWidth={2.2} />
            <Text style={styles.infoBannerText}>
              Organize a match at any public space — a park, beach, or open court. PAASXO charges a flat LKR {PUBLIC_SPACE_FEE_DISPLAY} fee to create it, split evenly across everyone who joins.
            </Text>
          </View>

          {/* Sport */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sport</Text>
            <View style={styles.sportRow}>
              {SPORTS.map((s) => {
                const active = s.id === selectedSport;
                return (
                  <Pressable
                    key={s.id}
                    style={[styles.sportChip, active && { backgroundColor: s.color, borderColor: s.color }]}
                    onPress={() => setSelectedSport(s.id)}
                  >
                    <Text style={styles.sportChipEmoji}>{s.emoji}</Text>
                    <Text style={[styles.sportChipText, active && { color: colors.white }]}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sunday Evening Futsal"
              placeholderTextColor={colors.neutral400}
              value={eventTitle}
              onChangeText={setEventTitle}
              maxLength={80}
            />
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Public Space Location</Text>
            <Pressable style={styles.selectRow} onPress={() => setLocationModalVisible(true)}>
              <View style={[styles.selectIconWrap, { backgroundColor: currentSport.color + '22' }]}>
                <MapPin color={currentSport.color} size={18} strokeWidth={2.2} />
              </View>
              <Text style={[styles.selectRowText, pin && styles.selectRowTextFilled]} numberOfLines={1}>
                {pin ? locationName || 'Selected location' : 'Search for a place or pick on the map'}
              </Text>
              <ChevronRight color={colors.neutral400} size={18} />
            </Pressable>
            {pin && (
              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                placeholder="Location name (editable)"
                placeholderTextColor={colors.neutral400}
                value={locationName}
                onChangeText={setLocationName}
              />
            )}
          </View>

          {/* Date */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date</Text>
            <Pressable style={styles.selectRow} onPress={() => setShowCalendar(true)}>
              <View style={[styles.selectIconWrap, { backgroundColor: currentSport.color + '22' }]}>
                <CalendarIcon color={currentSport.color} size={18} strokeWidth={2.2} />
              </View>
              <Text style={[styles.selectRowText, !!selectedDate && styles.selectRowTextFilled]}>
                {formatDisplayDate(selectedDate)}
              </Text>
              <ChevronRight color={colors.neutral400} size={18} />
            </Pressable>
          </View>

          {/* Start time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Start Time</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
              {START_TIME_OPTIONS.map((t) => {
                const active = t === startTime;
                return (
                  <Pressable
                    key={t}
                    style={[styles.timeChip, active && { backgroundColor: currentSport.color, borderColor: currentSport.color }]}
                    onPress={() => setStartTime(t)}
                  >
                    <Text style={[styles.timeChipText, active && { color: colors.white }]}>{timeLabel(t)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Duration */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Duration</Text>
            <View style={styles.sportRow}>
              {DURATION_OPTIONS.map((d) => {
                const active = d.minutes === durationMinutes;
                return (
                  <Pressable
                    key={d.minutes}
                    style={[styles.durationChip, active && { backgroundColor: currentSport.color, borderColor: currentSport.color }]}
                    onPress={() => setDurationMinutes(d.minutes)}
                  >
                    <Clock color={active ? colors.white : colors.textMuted} size={13} strokeWidth={2.2} />
                    <Text style={[styles.sportChipText, active && { color: colors.white }]}>{d.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {!!startTime && (
              <Text style={styles.venueSubtext}>{timeLabel(startTime)} – {timeLabel(endTime)}</Text>
            )}
          </View>

          {/* Capacity */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Players</Text>
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Max Players</Text>
                <View style={styles.inputWithIcon}>
                  <Users color={colors.textMuted} size={16} strokeWidth={2} />
                  <TextInput
                    style={[styles.input, { flex: 1, borderWidth: 0, backgroundColor: 'transparent' }]}
                    value={maxCapacity} onChangeText={setMaxCapacity} keyboardType="number-pad" maxLength={3}
                  />
                </View>
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.label}>Min Players (optional)</Text>
                <View style={styles.inputWithIcon}>
                  <Users color={colors.textMuted} size={16} strokeWidth={2} />
                  <TextInput
                    style={[styles.input, { flex: 1, borderWidth: 0, backgroundColor: 'transparent' }]}
                    value={minPlayers} onChangeText={setMinPlayers} keyboardType="number-pad" maxLength={3}
                    placeholder="—" placeholderTextColor={colors.neutral400}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Visibility */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Visibility</Text>
            <View style={styles.row}>
              <Pressable style={[styles.visBtn, isPublic && { borderColor: currentSport.color, backgroundColor: currentSport.color + '14' }]} onPress={() => setIsPublic(true)}>
                <Globe color={isPublic ? currentSport.color : colors.textMuted} size={16} strokeWidth={2.2} />
                <Text style={[styles.visBtnText, isPublic && { color: currentSport.color }]}>Public</Text>
              </Pressable>
              <Pressable style={[styles.visBtn, !isPublic && { borderColor: currentSport.color, backgroundColor: currentSport.color + '14' }]} onPress={() => setIsPublic(false)}>
                <Lock color={!isPublic ? currentSport.color : colors.textMuted} size={16} strokeWidth={2.2} />
                <Text style={[styles.visBtnText, !isPublic && { color: currentSport.color }]}>Invitees Only</Text>
              </Pressable>
            </View>
          </View>

          {/* Invite players */}
          <View style={styles.section}>
            <View style={styles.playerHeader}>
              <Text style={styles.sectionTitle}>Invite Players</Text>
              <Pressable style={styles.addPlayerChip} onPress={() => setShowPlayerSearch(true)}>
                <UserPlus color={colors.primary} size={14} strokeWidth={2.4} />
                <Text style={styles.addPlayerChipText}>Add</Text>
              </Pressable>
            </View>
            {(directPlayers.length > 0 || requestedPlayers.length > 0) && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedPlayersRow}>
                {directPlayers.map((p) => (
                  <View key={p.firebaseUid} style={styles.playerChip}>
                    <Text style={styles.playerChipText} numberOfLines={1}>{p.displayName}</Text>
                    <Pressable onPress={() => setDirectPlayers((prev) => prev.filter((x) => x.firebaseUid !== p.firebaseUid))} hitSlop={6}>
                      <X color={colors.primary} size={13} strokeWidth={2.4} />
                    </Pressable>
                  </View>
                ))}
                {requestedPlayers.map((p) => (
                  <View key={p.firebaseUid} style={[styles.playerChip, { opacity: 0.75 }]}>
                    <Text style={styles.playerChipText} numberOfLines={1}>{p.displayName} (invited)</Text>
                    <Pressable onPress={() => setRequestedPlayers((prev) => prev.filter((x) => x.firebaseUid !== p.firebaseUid))} hitSlop={6}>
                      <X color={colors.primary} size={13} strokeWidth={2.4} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.descriptionInput]}
              placeholder="Anything players should know..."
              placeholderTextColor={colors.neutral400}
              value={description} onChangeText={setDescription}
              multiline
            />
          </View>

          {/* Fee */}
          <View style={styles.feeCard}>
            <FileText color={colors.primary} size={18} strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Text style={styles.feeCardTitle}>LKR {PUBLIC_SPACE_FEE_DISPLAY} — PAASXO Public Match Fee</Text>
              <Text style={styles.feeCardSub}>
                Split evenly between every player who joins (LKR {Math.round(PUBLIC_SPACE_FEE_DISPLAY / (parseInt(maxCapacity || '1', 10) || 1))}/player at {maxCapacity || '1'} max players). Paid securely via PayHere, refundable up to 48 hours before kickoff.
              </Text>
            </View>
          </View>

          {/* Rules */}
          <Pressable style={styles.rulesAcceptance} onPress={() => setRulesAccepted((v) => !v)}>
            <View style={[styles.checkbox, rulesAccepted && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              {rulesAccepted && <Check color={colors.white} size={14} strokeWidth={3} />}
            </View>
            <Text style={styles.rulesText}>
              I agree to the{' '}
              <Text style={styles.rulesTextLink} onPress={() => Linking.openURL(getTermsOfServiceUrl())}>Terms &amp; Guidelines</Text>
              {' '}for organizing a public match.
            </Text>
          </Pressable>

          <Pressable style={styles.createButton} onPress={handleCreateEvent} disabled={submitting}>
            <LinearGradient colors={[currentSport.color, currentSport.color + 'CC']} style={StyleSheet.absoluteFillObject} />
            {submitting ? <ActivityIndicator color={colors.white} /> : (
              <>
                <CheckCircle2 color={colors.white} size={18} strokeWidth={2.4} />
                <Text style={styles.createButtonText}>Create Public Match</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Location picker */}
      <Modal visible={locationModalVisible} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Find a Location</Text>
            <TouchableOpacity onPress={() => setLocationModalVisible(false)}>
              <X color={colors.text} size={24} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBarWrap}>
            <Search color={colors.neutral400} size={18} />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Search by name, e.g. Shalika Ground"
              placeholderTextColor={colors.neutral400}
              value={locationQuery}
              onChangeText={setLocationQuery}
              returnKeyType="search"
            />
            {searchingPlaces && <ActivityIndicator color={colors.primary} size="small" />}
          </View>

          {placeSuggestions.length > 0 && (
            <ScrollView style={styles.suggestionsList} keyboardShouldPersistTaps="handled">
              {placeSuggestions.map((s, idx) => (
                <Pressable
                  key={`${s.latitude}-${s.longitude}-${idx}`}
                  style={styles.suggestionRow}
                  onPress={() => handleSelectSuggestion(s)}
                >
                  <MapPin color={currentSport.color} size={16} strokeWidth={2.2} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionName} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.suggestionAddress} numberOfLines={1}>{s.displayName}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Text style={styles.orDivider}>— or tap the map to drop a pin —</Text>

          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            onPress={handlePickOnMap}
            initialRegion={pin ? { ...pin, latitudeDelta: 0.01, longitudeDelta: 0.01 } : DEFAULT_REGION}
          >
            {pin && <Marker coordinate={pin} />}
          </MapView>
          <View style={[styles.mapFooter, { paddingBottom: insets.bottom + 14 }]}>
            {resolvingAddress ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.mapFooterText} numberOfLines={2}>
                {pin ? (locationName || 'Pin dropped — edit the name below') : 'Tap anywhere on the map to mark the space'}
              </Text>
            )}
            <Pressable
              style={[styles.mapConfirmBtn, !pin && { opacity: 0.5 }]}
              disabled={!pin}
              onPress={() => setLocationModalVisible(false)}
            >
              <Text style={styles.mapConfirmBtnText}>Confirm Location</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        colors={colors}
      />

      <PlayerSearchSheet
        visible={showPlayerSearch}
        onClose={() => setShowPlayerSearch(false)}
        excludeUids={[...directPlayers.map((p) => p.firebaseUid), ...requestedPlayers.map((p) => p.firebaseUid)]}
        onDirectAdd={(p) => setDirectPlayers((prev) => [...prev, p])}
        onRequestToJoin={(p) => setRequestedPlayers((prev) => [...prev, p])}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 40 },

  headerGrad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.white },
  headerSub: { fontSize: 11, color: colors.white + 'CC', marginTop: 2 },

  infoBanner: {
    flexDirection: 'row', gap: 10, backgroundColor: colors.primaryLight, borderRadius: 14,
    padding: 14, marginBottom: 20, alignItems: 'flex-start',
  },
  infoBannerText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 17 },

  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 },

  sportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sportChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: colors.cardBg, borderRadius: 14, borderWidth: 1.5, borderColor: colors.neutral200,
  },
  sportChipEmoji: { fontSize: 16 },
  sportChipText: { fontSize: 13, fontWeight: '700', color: colors.text },

  durationChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: colors.cardBg, borderRadius: 14, borderWidth: 1.5, borderColor: colors.neutral200,
  },

  input: {
    backgroundColor: colors.inputBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.neutral200,
  },
  selectRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.neutral200, gap: 10,
  },
  selectIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  selectRowText: { flex: 1, fontSize: 14, color: colors.neutral400 },
  selectRowTextFilled: { color: colors.text, fontWeight: '600' },
  venueSubtext: { fontSize: 11, color: colors.textSecondary, marginTop: 8, paddingHorizontal: 2 },

  timeScroll: { marginBottom: 2 },
  timeChip: {
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.cardBg, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.neutral200, marginRight: 8,
  },
  timeChipText: { fontSize: 12.5, fontWeight: '700', color: colors.text },

  row: { flexDirection: 'row' },
  inputWithIcon: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.neutral200, gap: 8,
  },

  visBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: colors.neutral200,
    backgroundColor: colors.cardBg, marginRight: 10,
  },
  visBtnText: { fontSize: 13, fontWeight: '700', color: colors.text },

  playerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addPlayerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primaryLight,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  addPlayerChipText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  selectedPlayersRow: { marginBottom: 8 },
  playerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryLight,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginRight: 8,
  },
  playerChipText: { fontSize: 13, fontWeight: '600', color: colors.primary, maxWidth: 140 },

  descriptionInput: { textAlignVertical: 'top', height: 88 },

  feeCard: {
    flexDirection: 'row', gap: 10, backgroundColor: colors.cardBg, borderRadius: 14,
    padding: 14, marginBottom: 18, borderWidth: 1, borderColor: colors.neutral200, alignItems: 'flex-start',
  },
  feeCardTitle: { fontSize: 13.5, fontWeight: '800', color: colors.text },
  feeCardSub: { fontSize: 11.5, color: colors.textSecondary, marginTop: 4, lineHeight: 16 },

  rulesAcceptance: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardBg,
    borderRadius: 14, padding: 14, marginBottom: 18, gap: 12,
    borderWidth: 1, borderColor: colors.neutral200,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  rulesText: { flex: 1, fontSize: 12, fontWeight: '500', color: colors.text },
  rulesTextLink: { color: colors.primary, fontWeight: '700', textDecorationLine: 'underline' },

  createButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, paddingVertical: 16, gap: 10, marginBottom: 20, overflow: 'hidden',
  },
  createButtonText: { color: colors.white, fontSize: 15, fontWeight: '800' },

  // Location modal
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.neutral200,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  searchBarWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.neutral200,
  },
  searchBarInput: { flex: 1, fontSize: 15, color: colors.text },
  suggestionsList: { maxHeight: 220, marginHorizontal: 16, marginTop: 8 },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.neutral200,
  },
  suggestionName: { fontSize: 14, fontWeight: '700', color: colors.text },
  suggestionAddress: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  orDivider: { textAlign: 'center', fontSize: 12, color: colors.neutral400, marginVertical: 10 },
  mapFooter: {
    backgroundColor: colors.cardBg, paddingHorizontal: 16, paddingTop: 14, gap: 12,
    borderTopWidth: 1, borderTopColor: colors.neutral200,
  },
  mapFooterText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  mapConfirmBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  mapConfirmBtnText: { color: colors.white, fontSize: 14, fontWeight: '800' },
});

const createCalendarStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 28 },
  handle: { width: 40, height: 4, backgroundColor: colors.neutral200, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  monthLabel: { fontSize: 15, fontWeight: '800', color: colors.text },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 13, fontWeight: '600', color: colors.text },
});
