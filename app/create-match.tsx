import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  FlatList,
  Animated,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Search,
  MapPin,
  Calendar,
  Clock,
  Users,
  Trophy,
  FileText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Star,
  UserPlus,
  X,
  Check,
  Info,
  ShieldCheck,
  AlertCircle,
  ChevronDown,
} from 'lucide-react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../src/styles/colors';
import { futsalApi } from '../src/api/futsalApi';
import { socialMediaApi } from '../src/api/socialMediaApi';
import { bookingApi } from '../src/api/bookingApi';
import { invitationApi } from '../src/api/invitationApi';
import { PlayerSearchSheet, SearchedPlayer } from '../src/components/PlayerSearchSheet';
import { extractApiError } from '../src/utils/apiError';

// ─── Constants ────────────────────────────────────────────────────────────────

const SPORTS = [
  { id: 'FUTSAL',           label: 'Futsal',      emoji: '⚽', color: Colors.futsal,      grad: [Colors.futsal, Colors.futsalLight] as [string,string] },
  { id: 'CRICKET',          label: 'Cricket',     emoji: '🏏', color: Colors.cricket,     grad: [Colors.cricket, '#1A5FA0'] as [string,string] },
  { id: 'PICKLEBALL',       label: 'Pickleball',  emoji: '🏓', color: Colors.pickleball,  grad: [Colors.pickleball, '#2977C2'] as [string,string] },
  { id: 'PADDLEBALL',       label: 'Paddleball',  emoji: '🎾', color: Colors.paddleball,  grad: [Colors.paddleball, '#6D28D9'] as [string,string] },
  { id: 'TRAINER_GYM',      label: 'Trainer',     emoji: '💪', color: Colors.trainer,     grad: [Colors.trainer, '#C2410C'] as [string,string] },
  { id: 'WALKING_RUNNING',  label: 'Walk / Run',  emoji: '🏃', color: (Colors as any).walkRun ?? '#059669', grad: ['#059669', '#047857'] as [string,string] },
];

// ─── Animated Sport Tile ──────────────────────────────────────────────────────

function SportTile({ sport, selected, onPress }: { sport: typeof SPORTS[0]; selected: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, friction: 6 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={sportTileStyles.wrap}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {selected ? (
          <LinearGradient colors={sport.grad} style={sportTileStyles.tile}>
            <Text style={sportTileStyles.emoji}>{sport.emoji}</Text>
            <Text style={[sportTileStyles.label, { color: '#fff' }]}>{sport.label}</Text>
          </LinearGradient>
        ) : (
          <View style={[sportTileStyles.tile, sportTileStyles.tileIdle]}>
            <Text style={sportTileStyles.emoji}>{sport.emoji}</Text>
            <Text style={[sportTileStyles.label, { color: sport.color }]}>{sport.label}</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const sportTileStyles = StyleSheet.create({
  wrap: { width: '31%', margin: '1%' },
  tile: {
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8,
    alignItems: 'center', gap: 6,
  },
  tileIdle: {
    backgroundColor: Colors.white,
    borderWidth: 1.5, borderColor: Colors.neutral200,
  },
  emoji: { fontSize: 26 },
  label: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
});

// ─── Radial Sport Picker ──────────────────────────────────────────────────────

// 6 sports, 60° each (360/6), 2° gap on each side → 56° visible arc per segment.
const SP_SIZE = 300;
const SP_CX   = SP_SIZE / 2;
const SP_CY   = SP_SIZE / 2;
const SP_OUTER = 128;
const SP_INNER = 48;
const SP_LABEL_R = 90; // label placement radius

// Distribute sports evenly starting from the top (-90°)
const SPORT_SEGS = SPORTS.map((s, i) => {
  const center = -90 + i * 60;
  return { ...s, startDeg: center - 28, endDeg: center + 28, midDeg: center };
});

function sportArcPath(startDeg: number, endDeg: number): string {
  const r = (d: number) => (d * Math.PI) / 180;
  const px = (d: number, radius: number) => SP_CX + radius * Math.cos(r(d));
  const py = (d: number, radius: number) => SP_CY + radius * Math.sin(r(d));
  return [
    `M ${px(startDeg, SP_OUTER)} ${py(startDeg, SP_OUTER)}`,
    `A ${SP_OUTER} ${SP_OUTER} 0 0 1 ${px(endDeg, SP_OUTER)} ${py(endDeg, SP_OUTER)}`,
    `L ${px(endDeg, SP_INNER)} ${py(endDeg, SP_INNER)}`,
    `A ${SP_INNER} ${SP_INNER} 0 0 0 ${px(startDeg, SP_INNER)} ${py(startDeg, SP_INNER)}`,
    'Z',
  ].join(' ');
}

function RadialSportMenu({
  visible,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  // All animations use useNativeDriver: false so entrance+hover can mix on the same views
  const backdrop   = useRef(new Animated.Value(0)).current;
  const pieScale   = useRef(new Animated.Value(0)).current;
  const pieRotate  = useRef(new Animated.Value(0)).current;
  const itemAnims  = useRef(SPORT_SEGS.map(() => new Animated.Value(0))).current;
  const hoverAnims = useRef(SPORT_SEGS.map(() => new Animated.Value(0))).current;
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: false }),
        Animated.spring(pieScale, { toValue: 1, tension: 180, friction: 11, useNativeDriver: false }),
        Animated.timing(pieRotate, { toValue: 1, duration: 380, useNativeDriver: false }),
        ...itemAnims.map((a, i) =>
          Animated.spring(a, { toValue: 1, tension: 220, friction: 10, delay: 50 + i * 38, useNativeDriver: false })
        ),
      ]).start();
    } else {
      backdrop.setValue(0);
      pieScale.setValue(0);
      pieRotate.setValue(0);
      itemAnims.forEach((a) => a.setValue(0));
      hoverAnims.forEach((a) => a.setValue(0));
      setHoveredId(null);
    }
  }, [visible]);

  if (!visible) return null;

  const selectedSeg = SPORT_SEGS.find((s) => s.id === selectedId);
  const previewSeg  = hoveredId ? SPORT_SEGS.find((s) => s.id === hoveredId) : null;

  const onPressIn = (seg: typeof SPORT_SEGS[0], i: number) => {
    setHoveredId(seg.id);
    Animated.spring(hoverAnims[i], { toValue: 1, tension: 280, friction: 7, useNativeDriver: false }).start();
  };
  const onPressOut = (i: number) => {
    setHoveredId(null);
    Animated.spring(hoverAnims[i], { toValue: 0, tension: 280, friction: 7, useNativeDriver: false }).start();
  };

  const spin = pieRotate.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: 'rgba(6,6,22,0.9)',
            opacity: backdrop,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        {/* Backdrop tap to close */}
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />

        <Text style={spStyles.guideAbove}>Hold to preview  •  Tap to select</Text>

        <Animated.View
          style={{
            width: SP_SIZE,
            height: SP_SIZE,
            transform: [{ scale: pieScale }, { rotate: spin }],
          }}
        >
          {/* SVG donut — 6 segments */}
          <Svg width={SP_SIZE} height={SP_SIZE} style={StyleSheet.absoluteFillObject}>
            {SPORT_SEGS.map((seg, i) => {
              const isSel = seg.id === selectedId;
              const isHov = seg.id === hoveredId;
              const fill  = isHov ? seg.color
                : isSel  ? seg.color
                : seg.color + 'AA';
              return (
                <SvgPath
                  key={seg.id}
                  d={sportArcPath(seg.startDeg, seg.endDeg)}
                  fill={fill}
                  onPressIn={() => onPressIn(seg, i)}
                  onPressOut={() => onPressOut(i)}
                  onPress={() => { onSelect(seg.id); onClose(); }}
                />
              );
            })}
          </Svg>

          {/* Emoji + label overlays at each segment's midpoint */}
          {SPORT_SEGS.map((seg, i) => {
            const angle = (seg.midDeg * Math.PI) / 180;
            const lx = SP_CX + SP_LABEL_R * Math.cos(angle);
            const ly = SP_CY + SP_LABEL_R * Math.sin(angle);
            const isSel = seg.id === selectedId;
            const isHov = seg.id === hoveredId;

            const entranceScale = itemAnims[i].interpolate({
              inputRange: [0, 1], outputRange: [0.2, isSel ? 1.14 : 1],
            });
            const hoverScale = hoverAnims[i].interpolate({
              inputRange: [0, 1], outputRange: [1, 1.28],
            });
            const glowScale = hoverAnims[i].interpolate({
              inputRange: [0, 1], outputRange: [0.5, 1.6],
            });

            return (
              <Animated.View
                key={seg.id}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: lx - 36,
                  top: ly - 36,
                  width: 72,
                  height: 72,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: itemAnims[i],
                }}
              >
                {/* Hover glow ring */}
                <Animated.View
                  style={{
                    position: 'absolute',
                    width: 58,
                    height: 58,
                    borderRadius: 29,
                    backgroundColor: seg.color + '35',
                    transform: [{ scale: glowScale }],
                    opacity: hoverAnims[i],
                  }}
                />
                {/* Emoji + label, scales on entrance and on hover */}
                <Animated.View
                  style={{
                    alignItems: 'center',
                    transform: [{ scale: entranceScale }, { scale: hoverScale }],
                  }}
                >
                  <Text style={{ fontSize: isHov || isSel ? 26 : 20 }}>{seg.emoji}</Text>
                  <Text style={[spStyles.itemLabel, (isSel || isHov) && spStyles.itemLabelActive]}>
                    {seg.label}
                  </Text>
                </Animated.View>
              </Animated.View>
            );
          })}

          {/* Center circle — shows selected sport + close */}
          <TouchableOpacity
            onPress={onClose}
            style={[spStyles.centerBtn, { left: SP_CX - 40, top: SP_CY - 40 }]}
          >
            <Text style={{ fontSize: 24 }}>{selectedSeg?.emoji ?? '×'}</Text>
            <Text style={spStyles.centerLabel} numberOfLines={1}>
              {selectedSeg?.label ?? ''}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Preview label beneath pie */}
        <Text style={spStyles.guideBelow}>
          {previewSeg ? (
            <>
              {'Preview: '}
              <Text style={spStyles.guideBelowHighlight}>{previewSeg.label}</Text>
            </>
          ) : (
            <>
              {'Selected: '}
              <Text style={spStyles.guideBelowHighlight}>{selectedSeg?.label}</Text>
            </>
          )}
        </Text>
      </Animated.View>
    </Modal>
  );
}

const spStyles = StyleSheet.create({
  guideAbove: {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)',
    marginBottom: 26, letterSpacing: 0.5, textAlign: 'center', paddingHorizontal: 32,
  },
  guideBelow: {
    fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 26,
  },
  guideBelowHighlight: {
    fontWeight: '800', color: 'rgba(255,255,255,0.9)',
  },
  itemLabel: {
    fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.80)',
    marginTop: 3, textAlign: 'center',
  },
  itemLabelActive: {
    color: Colors.white, fontWeight: '900',
  },
  centerBtn: {
    position: 'absolute',
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 }, elevation: 12,
    gap: 2,
  },
  centerLabel: {
    fontSize: 9, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 0.3,
  },
});

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// ─── Full Calendar Modal ───────────────────────────────────────────────────────

function CalendarModal({
  visible,
  selectedDate,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const [viewDate, setViewDate] = useState(() => {
    const d = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = new Date();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const prevYear = () => setViewDate(new Date(year - 1, month, 1));
  const nextYear = () => setViewDate(new Date(year + 1, month, 1));

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const padded = (n: number) => String(n).padStart(2, '0');

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={calStyles.overlay}>
        <View style={calStyles.card}>
          {/* Year row */}
          <View style={calStyles.yearRow}>
            <Pressable onPress={prevYear} style={calStyles.yearBtn} hitSlop={10}>
              <Text style={calStyles.yearArrow}>‹</Text>
            </Pressable>
            <Text style={calStyles.yearText}>{year}</Text>
            <Pressable onPress={nextYear} style={calStyles.yearBtn} hitSlop={10}>
              <Text style={calStyles.yearArrow}>›</Text>
            </Pressable>
          </View>

          {/* Month row */}
          <View style={calStyles.monthRow}>
            <Pressable onPress={prevMonth} style={calStyles.monthBtn} hitSlop={10}>
              <ChevronLeft color={Colors.text} size={20} strokeWidth={2.5} />
            </Pressable>
            <Text style={calStyles.monthText}>{MONTH_NAMES[month]}</Text>
            <Pressable onPress={nextMonth} style={calStyles.monthBtn} hitSlop={10}>
              <ChevronRight color={Colors.text} size={20} strokeWidth={2.5} />
            </Pressable>
          </View>

          {/* Day headers */}
          <View style={calStyles.dayHeaderRow}>
            {DAY_LABELS.map((d) => (
              <Text key={d} style={calStyles.dayHeader}>{d}</Text>
            ))}
          </View>

          {/* Days grid */}
          <View style={calStyles.daysGrid}>
            {cells.map((day, i) => {
              if (!day) return <View key={i} style={calStyles.dayCell} />;
              const dateStr = `${year}-${padded(month + 1)}-${padded(day)}`;
              const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
              const isSelected = selectedDate === dateStr;
              return (
                <Pressable
                  key={i}
                  style={[
                    calStyles.dayCell,
                    isSelected && calStyles.dayCellSelected,
                    isToday && !isSelected && calStyles.dayCellToday,
                  ]}
                  onPress={() => { onSelect(dateStr); onClose(); }}
                >
                  <Text
                    style={[
                      calStyles.dayText,
                      isSelected && calStyles.dayTextSelected,
                      isToday && !isSelected && calStyles.dayTextToday,
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable style={calStyles.closeBtn} onPress={onClose}>
            <Text style={calStyles.closeBtnText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Animated Venue Item ──────────────────────────────────────────────────────

function VenueItem({ item, index, onSelect }: { item: any; index: number; onSelect: (v: any) => void }) {
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = index * 60;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, delay, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <Pressable style={venueStyles.item} onPress={() => onSelect(item)}>
        <LinearGradient colors={[Colors.primaryLight, Colors.primary + '20']} style={venueStyles.iconWrap}>
          <MapPin color={Colors.primary} size={20} strokeWidth={2} />
        </LinearGradient>
        <View style={venueStyles.info}>
          <Text style={venueStyles.name}>{item.name}</Text>
          <Text style={venueStyles.location}>{item.location || item.city || 'Location not listed'}</Text>
          {item.rating != null && (
            <View style={venueStyles.ratingRow}>
              <Star color={Colors.warning} size={11} fill={Colors.warning} />
              <Text style={venueStyles.ratingText}>{Number(item.rating).toFixed(1)}</Text>
            </View>
          )}
        </View>
        {item.pricePerSlot != null && (
          <View style={venueStyles.priceBadge}>
            <Text style={venueStyles.priceText}>£{item.pricePerSlot}</Text>
            <Text style={venueStyles.perSlot}>/slot</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Animated Player Item ─────────────────────────────────────────────────────


// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreateMatch() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [selectedSport, setSelectedSport] = useState('FUTSAL');
  const [eventTitle, setEventTitle] = useState('');
  const [selectedVenue, setSelectedVenue] = useState<any>(null);
  const [venueSearchVisible, setVenueSearchVisible] = useState(false);
  const [venueSearch, setVenueSearch] = useState('');
  const [venueOptions, setVenueOptions] = useState<any[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlotIds, setSelectedSlotIds] = useState<number[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [venuePrice, setVenuePrice] = useState<number | null>(null);
  const [pricePerSlot, setPricePerSlot] = useState('');
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [directPlayers, setDirectPlayers] = useState<SearchedPlayer[]>([]);
  const [requestedPlayers, setRequestedPlayers] = useState<SearchedPlayer[]>([]);
  const [showSportMenu, setShowSportMenu] = useState(false);
  const [maxCapacity, setMaxCapacity] = useState('10');
  const [minPlayers, setMinPlayers] = useState('6');
  const [description, setDescription] = useState('');
  const [rulesModalVisible, setRulesModalVisible] = useState(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);

  // Price breakdown — derived from slot price × count ÷ player counts
  const totalCost = parseFloat(pricePerSlot) * selectedSlotIds.length || 0;
  const maxP = parseInt(maxCapacity, 10) || 0;
  const minP = parseInt(minPlayers, 10) || 0;
  const perPlayer = maxP > 0 && totalCost > 0 ? totalCost / maxP : 0;
  const emptySlotsCost = maxP > 0 && minP > 0 && maxP > minP ? (maxP - minP) * perPlayer : 0;
  const minPlayersValid = minP > 0 && minP <= maxP;

  const filteredVenues = useMemo(
    () =>
      venueOptions.filter((v: any) =>
        (v.name || '').toLowerCase().includes(venueSearch.toLowerCase()) ||
        (v.location || v.city || '').toLowerCase().includes(venueSearch.toLowerCase())
      ),
    [venueOptions, venueSearch]
  );

  const fetchVenueOptions = async () => {
    setLoadingVenues(true);
    try {
      const data = await futsalApi.listVenues();
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.venues) ? data.venues : [];
      setVenueOptions(list);
    } catch {
      setVenueOptions([]);
    } finally {
      setLoadingVenues(false);
    }
  };

  useEffect(() => {
    if (venueSearchVisible) {
      const t = setTimeout(fetchVenueOptions, 300);
      return () => clearTimeout(t);
    }
  }, [venueSearchVisible]);

  const fetchSlots = async (venueId: number | string, date: string) => {
    setLoadingSlots(true);
    setSelectedSlotIds([]);
    try {
      const data = await futsalApi.getSlots(venueId, date);
      const receivedSlots = Array.isArray(data) ? data : Array.isArray(data?.slots) ? data.slots : Array.isArray(data?.data) ? data.data : [];
      setSlots(receivedSlots.map((slot: any) => ({
        ...slot,
        time: slot.time || (slot.startTime ? `${slot.startTime.slice(0, 5)} - ${slot.endTime?.slice(0, 5) ?? ''}` : ''),
        status: slot.status || (slot.available ? 'available' : 'booked') || 'booked',
      })));
      if (typeof data.pricePerSlot === 'number') { setVenuePrice(data.pricePerSlot); setPricePerSlot(data.pricePerSlot.toFixed(2)); }
      else if (typeof data.price === 'number') { setVenuePrice(data.price); setPricePerSlot(data.price.toFixed(2)); }
      else if (receivedSlots.length > 0 && typeof receivedSlots[0].price === 'number') { setVenuePrice(receivedSlots[0].price); setPricePerSlot(receivedSlots[0].price.toFixed(2)); }
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleVenueSelect = (venue: any) => {
    setSelectedVenue(venue);
    setVenueSearchVisible(false);
    setSelectedDate('');
    setSlots([]);
    setSelectedSlotIds([]);
    const p = venue.price ?? venue.pricePerSlot ?? null;
    setVenuePrice(p);
    setPricePerSlot(p != null ? Number(p).toFixed(2) : '');
  };

  const handleDateSelect = async (date: string) => {
    setSelectedDate(date);
    if (selectedVenue?.id) await fetchSlots(selectedVenue.id, date);
  };

  const handleSlotToggle = (slot: any) => {
    if (slot.status !== 'available') return;
    setSelectedSlotIds(prev =>
      prev.includes(slot.id) ? prev.filter(id => id !== slot.id) : [...prev, slot.id]
    );
  };


  const handleCreateEvent = async () => {
    if (!selectedVenue || !selectedDate || selectedSlotIds.length === 0) {
      alert('Please select venue, date, and at least one slot before continuing.');
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
        futsalId: selectedVenue.id,
        slotId: selectedSlotIds[0],
        slotIds: selectedSlotIds,
        title: eventTitle.trim() || undefined,
        maxPlayers: maxP,
        minPlayers: minP,
        players: directPlayers.length > 0
          ? directPlayers.map((p) => p.firebaseUid)
          : undefined,
      });
      const newId = result?.id ?? result?.data?.id ?? result?._id ?? result?.bookingId;

      // Send invitations after booking is created; collect any failures
      if (newId && requestedPlayers.length > 0) {
        const inviteResults = await Promise.allSettled(
          requestedPlayers.map((p) => invitationApi.invite(newId, p.firebaseUid))
        );
        const failed = inviteResults.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
        if (failed.length > 0) {
          const reasons = failed
            .map((r) => extractApiError(r.reason, undefined))
            .filter(Boolean);
          const uniqueReasons = [...new Set(reasons)];
          const sent = requestedPlayers.length - failed.length;
          const detail = uniqueReasons.length > 0
            ? uniqueReasons.join('\n')
            : `${sent} of ${requestedPlayers.length} invitations were sent successfully.`;
          alert(`Some invitations could not be sent:\n\n${detail}`);
        }
      }

      router.replace(`/checkout/${newId}` as any);
    } catch {
      alert('Something went wrong while saving the match. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentSport = SPORTS.find((s) => s.id === selectedSport) || SPORTS[0];

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return 'Select a date';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Gradient header */}
      <LinearGradient colors={[currentSport.color, currentSport.color + 'CC']} style={styles.headerGrad}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <ArrowLeft color={Colors.white} size={22} strokeWidth={2.5} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Create Match</Text>
          <Text style={styles.headerSub}>{currentSport.emoji} {currentSport.label}</Text>
        </View>
        <View style={{ width: 36 }} />
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Activity Selection — radial pie trigger */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Activity</Text>
          <Pressable
            style={[styles.sportTrigger, { borderColor: currentSport.color + '55' }]}
            onPress={() => setShowSportMenu(true)}
          >
            <LinearGradient colors={currentSport.grad} style={styles.sportTriggerIcon}>
              <Text style={{ fontSize: 22 }}>{currentSport.emoji}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.sportTriggerHint}>SELECTED ACTIVITY</Text>
              <Text style={[styles.sportTriggerLabel, { color: currentSport.color }]}>
                {currentSport.label}
              </Text>
            </View>
            <View style={[styles.sportTriggerChevron, { backgroundColor: currentSport.color + '18' }]}>
              <ChevronDown color={currentSport.color} size={16} strokeWidth={2.5} />
            </View>
          </Pressable>
          <Text style={styles.sportTriggerGuide}>
            Tap to open the activity wheel and choose your sport
          </Text>
        </View>

        {/* Event Title */}
        <View style={styles.section}>
          <Text style={styles.label}>Event Title</Text>
          <TextInput
            style={styles.input}
            placeholder={`e.g. ${currentSport.label} Night — ${new Date().toLocaleDateString(undefined, { weekday: 'long' })}`}
            placeholderTextColor={Colors.neutral400}
            value={eventTitle}
            onChangeText={setEventTitle}
          />
        </View>

        {/* Venue Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Venue / Arena</Text>
          <Pressable style={styles.selectRow} onPress={() => setVenueSearchVisible(true)}>
            <LinearGradient colors={[Colors.primaryLight, Colors.primary + '20']} style={styles.selectIconWrap}>
              <MapPin color={Colors.primary} size={18} strokeWidth={2} />
            </LinearGradient>
            <Text style={[styles.selectRowText, selectedVenue && styles.selectRowTextFilled]}>
              {selectedVenue ? selectedVenue.name : 'Search and pick a venue...'}
            </Text>
            <ChevronRight color={Colors.neutral400} size={16} strokeWidth={2} />
          </Pressable>
          {selectedVenue?.location && (
            <Text style={styles.venueSubtext}>{selectedVenue.location}</Text>
          )}
        </View>

        {/* Date Selection */}
        {selectedVenue && (
          <View style={styles.section}>
            <Text style={styles.label}>Date</Text>
            <Pressable style={styles.selectRow} onPress={() => setCalendarVisible(true)}>
              <LinearGradient colors={[Colors.primaryLight, Colors.primary + '20']} style={styles.selectIconWrap}>
                <Calendar color={Colors.primary} size={18} strokeWidth={2} />
              </LinearGradient>
              <Text style={[styles.selectRowText, selectedDate && styles.selectRowTextFilled]}>
                {formatDisplayDate(selectedDate)}
              </Text>
              <ChevronRight color={Colors.neutral400} size={16} strokeWidth={2} />
            </Pressable>
          </View>
        )}

        {/* Slot Selection */}
        {selectedDate && (
          <View style={styles.section}>
            <Text style={styles.label}>Available Time Slots</Text>
            {loadingSlots ? (
              <View style={styles.slotsLoading}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={styles.emptyText}>Loading slots...</Text>
              </View>
            ) : slots.length > 0 ? (
              <View style={styles.slotGrid}>
                {slots.map(slot => {
                  const isSelected = selectedSlotIds.includes(slot.id);
                  const isAvailable = slot.status === 'available';
                  return (
                    <Pressable
                      key={slot.id}
                      onPress={() => handleSlotToggle(slot)}
                      style={[
                        styles.slotButton,
                        !isAvailable && styles.slotButtonDisabled,
                        isSelected && [styles.slotButtonSelected, { borderColor: currentSport.color, backgroundColor: currentSport.color }],
                      ]}
                      disabled={!isAvailable}
                    >
                      <Clock
                        color={isAvailable ? (isSelected ? Colors.white : Colors.primary) : Colors.neutral400}
                        size={14} strokeWidth={2}
                      />
                      <Text style={[styles.slotText, !isAvailable && styles.slotTextDisabled, isSelected && styles.slotTextSelected]}>
                        {slot.time}
                      </Text>
                      {isSelected && <CheckCircle2 color={Colors.white} size={12} fill={Colors.white} />}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>No slots available for this date.</Text>
            )}

            {/* Selected session summary */}
            {selectedSlotIds.length > 0 && (() => {
              const sel = slots
                .filter(s => selectedSlotIds.includes(s.id))
                .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
              const start = sel[0]?.startTime?.slice(0, 5) ?? '';
              const end = sel[sel.length - 1]?.endTime?.slice(0, 5) ?? '';
              return (
                <View style={styles.sessionSummary}>
                  <Clock color={currentSport.color} size={14} strokeWidth={2} />
                  <Text style={[styles.sessionSummaryText, { color: currentSport.color }]}>
                    {start} – {end}
                  </Text>
                  <Text style={styles.sessionSummarySlots}>
                    ({selectedSlotIds.length} slot{selectedSlotIds.length > 1 ? 's' : ''})
                  </Text>
                </View>
              );
            })()}
          </View>
        )}

        {/* Price & Capacity — shown once at least one slot is selected */}
        {selectedSlotIds.length > 0 && (
          <>
            {/* Slot price */}
            <View style={styles.section}>
              <Text style={styles.label}>Total Slot Price (£)</Text>
              <View style={styles.inputWithIcon}>
                <Text style={styles.currencySymbol}>£</Text>
                <TextInput
                  style={[styles.input, { flex: 1, marginLeft: 8, borderWidth: 0 }]}
                  placeholder="0.00"
                  placeholderTextColor={Colors.neutral400}
                  keyboardType="decimal-pad"
                  value={pricePerSlot}
                  onChangeText={setPricePerSlot}
                />
              </View>
              <Text style={styles.fieldGuide}>
                Total venue cost for all selected slots. Each player pays an equal share when they join.
              </Text>
            </View>

            {/* Max & Min Players side by side */}
            <View style={styles.row}>
              <View style={[styles.section, { flex: 1, marginRight: 8 }]}>
                <View style={styles.labelRow}>
                  <Users color={Colors.primary} size={14} strokeWidth={2} />
                  <Text style={styles.label}>Max Players</Text>
                </View>
                <View style={styles.inputWithIcon}>
                  <TextInput
                    style={[styles.input, { flex: 1, borderWidth: 0 }]}
                    placeholder="10"
                    placeholderTextColor={Colors.neutral400}
                    keyboardType="number-pad"
                    value={maxCapacity}
                    onChangeText={setMaxCapacity}
                  />
                </View>
                <Text style={styles.fieldGuide}>
                  Cap on how many can join. Per-player price = Total ÷ Max.
                </Text>
              </View>

              <View style={[styles.section, { flex: 1, marginLeft: 8 }]}>
                <View style={styles.labelRow}>
                  <ShieldCheck color="#EA580C" size={14} strokeWidth={2} />
                  <Text style={[styles.label, { color: '#EA580C' }]}>Min Players</Text>
                </View>
                <View style={[styles.inputWithIcon, { borderColor: '#EA580C40' }]}>
                  <TextInput
                    style={[styles.input, { flex: 1, borderWidth: 0 }]}
                    placeholder="6"
                    placeholderTextColor={Colors.neutral400}
                    keyboardType="number-pad"
                    value={minPlayers}
                    onChangeText={setMinPlayers}
                  />
                </View>
                <Text style={styles.fieldGuide}>
                  Cancel before 48 h for a full refund if fewer than this join.
                </Text>
              </View>
            </View>

            {/* Price breakdown card */}
            {totalCost > 0 && maxP > 0 && (
              <View style={styles.priceBreakdownCard}>
                <View style={styles.priceBreakdownHeader}>
                  <Info color={Colors.primary} size={15} strokeWidth={2} />
                  <Text style={styles.priceBreakdownTitle}>Price Breakdown & Guarantee</Text>
                </View>

                <View style={styles.priceBreakdownRow}>
                  <Text style={styles.pbLabel}>Total slot cost</Text>
                  <Text style={styles.pbValue}>£{totalCost.toFixed(2)}</Text>
                </View>
                <View style={styles.priceBreakdownRow}>
                  <Text style={styles.pbLabel}>Per player (if {maxP} join)</Text>
                  <Text style={[styles.pbValue, { color: Colors.primary, fontWeight: '800' }]}>
                    £{perPlayer.toFixed(2)} / player
                  </Text>
                </View>
                {minPlayersValid && emptySlotsCost > 0 && (
                  <View style={styles.priceBreakdownRow}>
                    <Text style={styles.pbLabel}>
                      {'Your max guarantee\n'}
                      {`(if only ${minP} join → you cover ${maxP - minP} empty ${maxP - minP === 1 ? 'slot' : 'slots'})`}
                    </Text>
                    <Text style={[styles.pbValue, { color: '#EA580C' }]}>
                      £{emptySlotsCost.toFixed(2)}
                    </Text>
                  </View>
                )}

                <View style={styles.priceBreakdownDivider} />
                <View style={styles.pbInfoRow}>
                  <AlertCircle color="#EA580C" size={13} strokeWidth={2} />
                  <Text style={styles.pbInfoText}>
                    {'You pay £'}
                    {totalCost.toFixed(2)}
                    {' upfront — held securely in escrow. Players reimburse their share when they join. Funds release to the venue 48 h before the match.'}
                  </Text>
                </View>
                {minPlayersValid && (
                  <View style={[styles.pbInfoRow, { marginTop: 6 }]}>
                    <ShieldCheck color={Colors.success} size={13} strokeWidth={2} />
                    <Text style={styles.pbInfoText}>
                      {'Cancel for a full refund before 48 h of the match — if fewer than '}
                      {minP}
                      {' players have joined.'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Invite Players */}
            <View style={styles.section}>
              <View style={styles.playerHeader}>
                <Text style={styles.label}>Invite Players</Text>
                <Pressable style={styles.addPlayerChip} onPress={() => setShowInviteSheet(true)}>
                  <UserPlus color={Colors.primary} size={14} strokeWidth={2.5} />
                  <Text style={styles.addPlayerChipText}>Search</Text>
                </Pressable>
              </View>
              {(directPlayers.length > 0 || requestedPlayers.length > 0) ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedPlayersRow}>
                  {directPlayers.map((p) => (
                    <View key={p.firebaseUid} style={styles.playerChip}>
                      <Text style={styles.playerChipText}>{p.displayName.split(' ')[0]}</Text>
                      <Pressable onPress={() => setDirectPlayers((prev) => prev.filter((dp) => dp.firebaseUid !== p.firebaseUid))} hitSlop={6}>
                        <X color={Colors.primary} size={12} strokeWidth={3} />
                      </Pressable>
                    </View>
                  ))}
                  {requestedPlayers.map((p) => (
                    <View key={p.firebaseUid} style={[styles.playerChip, { borderColor: Colors.primary + '60', backgroundColor: Colors.primary + '18' }]}>
                      <Text style={styles.playerChipText}>{p.displayName.split(' ')[0]} ✉</Text>
                      <Pressable onPress={() => setRequestedPlayers((prev) => prev.filter((rp) => rp.firebaseUid !== p.firebaseUid))} hitSlop={6}>
                        <X color={Colors.primary} size={12} strokeWidth={3} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.emptyText}>No players added yet</Text>
              )}
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.descriptionInput]}
                placeholder="Meeting point, what to bring, special rules..."
                placeholderTextColor={Colors.neutral400}
                multiline
                numberOfLines={3}
                value={description}
                onChangeText={setDescription}
              />
              <Pressable onPress={() => setRulesModalVisible(true)} style={styles.rulesLink}>
                <FileText color={Colors.primary} size={16} strokeWidth={2} />
                <Text style={styles.rulesLinkText}>View Rules & Guidelines</Text>
              </Pressable>
            </View>

            {/* Rules acceptance */}
            <Pressable style={styles.rulesAcceptance} onPress={() => setRulesAccepted(!rulesAccepted)}>
              <View style={[styles.checkbox, rulesAccepted && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}>
                {rulesAccepted && <Check color={Colors.white} size={13} strokeWidth={3} />}
              </View>
              <Text style={styles.rulesText}>
                I accept Paasxo's Terms of Service and Community Guidelines
              </Text>
            </Pressable>

            {/* Create button */}
            <Pressable
              onPress={handleCreateEvent}
              style={[styles.createButton, { backgroundColor: currentSport.color }, (!rulesAccepted || submitting) && styles.createButtonDisabled]}
              disabled={!rulesAccepted || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Trophy color={Colors.white} size={20} strokeWidth={2.5} />
                  <Text style={styles.createButtonText}>Continue to Checkout</Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* ── Venue Search Modal ──────────────────────────────────────────────── */}
      <Modal visible={venueSearchVisible} transparent animationType="slide">
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.modalHeader}>
            <Pressable onPress={() => setVenueSearchVisible(false)} style={styles.modalBackBtn} hitSlop={10}>
              <ArrowLeft color={Colors.white} size={22} strokeWidth={2.5} />
            </Pressable>
            <View style={styles.modalHeaderText}>
              <Text style={styles.modalTitle}>Select Venue</Text>
              <Text style={styles.modalSubtitle}>{venueOptions.length} venues available</Text>
            </View>
          </LinearGradient>

          <View style={styles.searchBarWrap}>
            <View style={styles.searchBar}>
              <Search color={Colors.neutral400} size={18} strokeWidth={2} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or location..."
                placeholderTextColor={Colors.neutral400}
                value={venueSearch}
                onChangeText={setVenueSearch}
                autoFocus
              />
              {venueSearch.length > 0 && (
                <Pressable onPress={() => setVenueSearch('')} hitSlop={8}>
                  <X color={Colors.neutral400} size={16} strokeWidth={2} />
                </Pressable>
              )}
            </View>
          </View>

          {loadingVenues ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator color={Colors.primary} size="large" />
              <Text style={styles.modalLoadingText}>Finding venues...</Text>
            </View>
          ) : filteredVenues.length === 0 ? (
            <View style={styles.modalEmpty}>
              <MapPin color={Colors.neutral300} size={48} strokeWidth={1} />
              <Text style={styles.modalEmptyText}>No venues found</Text>
              <Text style={styles.modalEmptySubtext}>Try a different search term</Text>
            </View>
          ) : (
            <FlatList
              data={filteredVenues}
              keyExtractor={item => item.id?.toString() ?? Math.random().toString()}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item, index }) => (
                <VenueItem item={item} index={index} onSelect={handleVenueSelect} />
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* ── Invite Players Sheet ─────────────────────────────────────────────── */}
      <PlayerSearchSheet
        visible={showInviteSheet}
        onClose={() => setShowInviteSheet(false)}
        excludeUids={[
          ...directPlayers.map((p) => p.firebaseUid),
          ...requestedPlayers.map((p) => p.firebaseUid),
        ]}
        onDirectAdd={async (player) => {
          setDirectPlayers((prev) =>
            prev.some((p) => p.firebaseUid === player.firebaseUid) ? prev : [...prev, player]
          );
        }}
        onRequestToJoin={async (player) => {
          setRequestedPlayers((prev) =>
            prev.some((p) => p.firebaseUid === player.firebaseUid) ? prev : [...prev, player]
          );
        }}
        title="Invite Players"
      />

      {/* ── Full Calendar Modal ─────────────────────────────────────────────── */}
      <CalendarModal
        visible={calendarVisible}
        selectedDate={selectedDate}
        onSelect={handleDateSelect}
        onClose={() => setCalendarVisible(false)}
      />

      {/* ── Rules Modal ─────────────────────────────────────────────────────── */}
      <Modal visible={rulesModalVisible} transparent animationType="fade">
        <View style={styles.rulesOverlay}>
          <View style={styles.rulesContent}>
            <Pressable onPress={() => setRulesModalVisible(false)} style={styles.rulesClose}>
              <X color={Colors.text} size={18} strokeWidth={2.5} />
            </Pressable>
            <FileText color={Colors.primary} size={36} strokeWidth={1.5} />
            <Text style={styles.rulesTitle}>Rules & Guidelines</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
              <Text style={styles.rulesBody}>
                1. Respect all players and follow sportsmanship codes.{'\n\n'}
                2. Arrive 10 minutes before the scheduled time.{'\n\n'}
                3. Use appropriate sports equipment for the sport.{'\n\n'}
                4. Follow all venue-specific rules and restrictions.{'\n\n'}
                5. No aggressive behavior or foul language.{'\n\n'}
                6. Report any injuries or incidents immediately.{'\n\n'}
                7. Clean up after the game ends.{'\n\n'}
                By creating this event, you agree to these terms.
              </Text>
            </ScrollView>
            <Pressable
              onPress={() => { setRulesAccepted(true); setRulesModalVisible(false); }}
              style={[styles.rulesAcceptButton, { backgroundColor: currentSport.color }]}
            >
              <Text style={styles.rulesAcceptButtonText}>Accept & Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Radial sport picker */}
      <RadialSportMenu
        visible={showSportMenu}
        selectedId={selectedSport}
        onSelect={setSelectedSport}
        onClose={() => setShowSportMenu(false)}
      />
    </SafeAreaView>
  );
}

// ─── Calendar Styles ──────────────────────────────────────────────────────────

const calStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 6,
  },
  yearBtn: { padding: 6 },
  yearArrow: { fontSize: 22, fontWeight: '700', color: Colors.neutral600 },
  yearText: { fontSize: 16, fontWeight: '800', color: Colors.text, minWidth: 60, textAlign: 'center' },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  monthBtn: { padding: 6 },
  monthText: { fontSize: 20, fontWeight: '800', color: Colors.text },
  dayHeaderRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: Colors.neutral500,
    letterSpacing: 0.3,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 100,
  },
  dayCellSelected: { backgroundColor: Colors.primary },
  dayCellToday: { backgroundColor: Colors.primaryLight },
  dayText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  dayTextSelected: { color: Colors.white, fontWeight: '800' },
  dayTextToday: { color: Colors.primary, fontWeight: '800' },
  closeBtn: {
    backgroundColor: Colors.neutral100,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 14, fontWeight: '700', color: Colors.text },
});

// ─── Venue Item Styles ────────────────────────────────────────────────────────

const venueStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral100,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  location: { fontSize: 12, color: Colors.textSecondary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  ratingText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  priceBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  priceText: { fontSize: 13, fontWeight: '800', color: Colors.primaryDark },
  perSlot: { fontSize: 9, color: Colors.primary, fontWeight: '600' },
});

// ─── Player Item Styles ───────────────────────────────────────────────────────


// ─── Main Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 40 },

  headerGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 11, color: Colors.white + 'CC', marginTop: 2 },

  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 8 },

  sportGrid: { flexDirection: 'row', flexWrap: 'wrap' },

  // ── Sport trigger button (replaces tile grid)
  sportTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 2,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  sportTriggerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportTriggerHint: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  sportTriggerLabel: {
    fontSize: 16,
    fontWeight: '900',
  },
  sportTriggerChevron: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportTriggerGuide: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },

  input: {
    backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.neutral200,
  },
  selectRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.neutral200, gap: 10,
  },
  selectIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  selectRowText: { flex: 1, fontSize: 14, color: Colors.neutral400 },
  selectRowTextFilled: { color: Colors.text, fontWeight: '600' },
  venueSubtext: { fontSize: 11, color: Colors.textSecondary, marginTop: 6, paddingHorizontal: 4 },

  slotsLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotButton: {
    flex: 1, minWidth: '30%', paddingVertical: 12, paddingHorizontal: 8,
    backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.primary,
    alignItems: 'center', gap: 4,
  },
  slotButtonDisabled: { backgroundColor: Colors.neutral100, borderColor: Colors.neutral300, opacity: 0.5 },
  slotButtonSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  slotText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  slotTextDisabled: { color: Colors.neutral400 },
  slotTextSelected: { color: Colors.white },
  emptyText: { fontSize: 13, color: Colors.neutral400, paddingVertical: 8 },

  row: { flexDirection: 'row' },
  inputWithIcon: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.neutral200,
  },
  currencySymbol: { fontSize: 14, fontWeight: '700', color: Colors.text },

  playerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addPlayerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  addPlayerChipText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  selectedPlayersRow: { marginBottom: 8 },
  playerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginRight: 8,
  },
  playerChipText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  descriptionInput: { textAlignVertical: 'top', height: 88 },
  rulesLink: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  rulesLinkText: { fontSize: 13, fontWeight: '600', color: Colors.primary, textDecorationLine: 'underline' },

  rulesAcceptance: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderRadius: 14, padding: 14, marginBottom: 18, gap: 12,
    borderWidth: 1, borderColor: Colors.neutral200,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  rulesText: { flex: 1, fontSize: 12, fontWeight: '500', color: Colors.text },

  createButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, paddingVertical: 16, gap: 10, marginBottom: 20,
  },
  createButtonDisabled: { opacity: 0.5 },
  createButtonText: { fontSize: 16, fontWeight: '800', color: Colors.white },

  // Modal shared
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 18, gap: 14,
  },
  modalBackBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalHeaderText: { flex: 1 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  modalSubtitle: { fontSize: 12, color: Colors.white + 'CC', marginTop: 2 },
  searchBarWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.neutral200, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  modalLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  modalLoadingText: { fontSize: 14, color: Colors.textSecondary },
  modalEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  modalEmptyText: { fontSize: 16, fontWeight: '700', color: Colors.text },
  modalEmptySubtext: { fontSize: 13, color: Colors.textSecondary },

  selectedBarWrap: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.neutral100 },
  selectedBar: { paddingHorizontal: 16, gap: 8 },
  selectedTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  selectedTagText: { fontSize: 12, fontWeight: '700', color: Colors.white },

  rulesOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  rulesContent: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 20,
    width: '90%', maxHeight: '80%', alignItems: 'center',
  },
  rulesClose: {
    position: 'absolute', top: 14, right: 14, width: 32, height: 32,
    borderRadius: 16, backgroundColor: Colors.neutral100,
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  rulesTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginTop: 14, marginBottom: 14 },
  rulesBody: { fontSize: 13, color: Colors.neutral600, lineHeight: 21, marginBottom: 16 },
  rulesAcceptButton: {
    borderRadius: 12, paddingVertical: 13, paddingHorizontal: 24, width: '100%', alignItems: 'center',
  },
  rulesAcceptButtonText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  sessionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
  },
  sessionSummaryText: { fontSize: 13, fontWeight: '700' },
  sessionSummarySlots: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  totalPriceLabel: { fontSize: 11, color: Colors.primary, fontWeight: '700', marginTop: 4 },

  // ── Field guide text (below each input)
  fieldGuide: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 6,
    lineHeight: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },

  // ── Price breakdown card
  priceBreakdownCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  priceBreakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 14,
  },
  priceBreakdownTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  priceBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral100,
  },
  pbLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  pbValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: 12,
  },
  priceBreakdownDivider: {
    height: 1,
    backgroundColor: Colors.neutral100,
    marginVertical: 10,
  },
  pbInfoRow: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'flex-start',
  },
  pbInfoText: {
    fontSize: 11,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 16,
  },
});
