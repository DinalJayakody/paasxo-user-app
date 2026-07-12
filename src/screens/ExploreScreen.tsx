import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  Image,
  FlatList,
  Dimensions,
  Animated,
  Modal,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Search,
  MapPin,
  Calendar,
  Users,
  Trophy,
  ChevronRight,
  X,
  Star,
  Map as MapIcon,
  Plus,
  RotateCcw,
  Navigation,
  DollarSign,
  Zap,
  Clock,
  ChevronLeft,
  Check,
  Minus,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../styles/colors';
import { BottomNavbar } from '../components/BottomNavbar';
import { futsalApi } from '../api/futsalApi';
import { bookingApi } from '../api/bookingApi';
import { tournamentApi } from '../api/tournamentApi';
import axiosInstance from '../api/axios';
import { useSubscription } from '../hooks/useSubscription';

// ─── Platform-safe maps ──────────────────────────────────────────────────────
let MapViewComponent: any = null;
let MarkerComponent: any = null;
let CircleComponent: any = null;
if (Platform.OS !== 'web') {
  try {
    const RNMaps = require('react-native-maps');
    MapViewComponent = RNMaps.default;
    MarkerComponent = RNMaps.Marker;
    CircleComponent = RNMaps.Circle;
  } catch {}
}

const { width: W } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────
type Category = 'VENUES' | 'TRAINERS' | 'GAMES' | 'EVENTS';
type ExploreStep = 'SEARCH' | 'RESULTS' | 'MAP';
type SportFilter = 'ALL' | 'FUTSAL' | 'CRICKET' | 'PICKLEBALL';
type DateQuick = 'TODAY' | 'TOMORROW' | 'WEEKEND' | 'CUSTOM' | null;

interface VenueResult {
  id: string; name: string; location: string;
  pricePerSlot: number | null; imageBase64?: string; imageUrl?: string;
  latitude: number; longitude: number; distance?: number;
}
interface GameResult {
  id: string; title: string; sport: string;
  slotDate: string; startTime: string; endTime: string;
  locationName: string; joinedPlayersCount: number; maxSpots: number;
  spotsLeft: number; totalPrice: number | null; pricePerPlayer: number | null;
  latitude: number; longitude: number; distance?: number;
}
interface TrainerResult {
  id: string; name: string; location: string;
  specialty?: string; pricePerSession: number | null;
  imageBase64?: string; imageUrl?: string; rating?: number;
  latitude: number; longitude: number; distance?: number;
}
interface EventResult {
  id: string; name: string; sport: string;
  futsalName: string; startDate?: string;
  teamCount?: number; maxTeams?: number; status?: string;
  latitude: number; longitude: number; distance?: number;
}
type AnyResult = VenueResult | GameResult | TrainerResult | EventResult;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SPORTS: { id: SportFilter; label: string; emoji: string }[] = [
  { id: 'ALL', label: 'All', emoji: '🏆' },
  { id: 'FUTSAL', label: 'Futsal', emoji: '⚽' },
  { id: 'CRICKET', label: 'Cricket', emoji: '🏏' },
  { id: 'PICKLEBALL', label: 'Pickleball', emoji: '🏓' },
];

const RADIUS_PRESETS = [5, 10, 20, 50];
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function nextWeekend(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun,6=Sat
  const daysToSat = day === 6 ? 7 : (6 - day + 7) % 7 || 7;
  return addDays(now, daysToSat);
}

function resolveImage(v: any): string | undefined {
  if (v.imageBase64) return `data:image/jpeg;base64,${v.imageBase64}`;
  if (v.imageUrl?.startsWith('http')) return v.imageUrl;
  if (v.image?.startsWith('http')) return v.image;
  return undefined;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Radial category menu ─────────────────────────────────────────────────────
const PIE_SIZE = 278;
const PIE_CX = PIE_SIZE / 2;
const PIE_CY = PIE_SIZE / 2;
const PIE_OUTER = 120;
const PIE_INNER = 44;
const PIE_ITEM_R = 83;

const CATS: { id: Category; label: string; emoji: string; color: string; startDeg: number; endDeg: number; midDeg: number }[] = [
  { id: 'VENUES',   label: 'Venues',   emoji: '🏟️', color: '#2977C2', startDeg: -86, endDeg: -4,  midDeg: -45  },
  { id: 'TRAINERS', label: 'Trainers', emoji: '💪', color: '#EA580C', startDeg: 4,   endDeg: 86,  midDeg: 45   },
  { id: 'GAMES',    label: 'Games',    emoji: '⚽', color: '#059669', startDeg: 94,  endDeg: 176, midDeg: 135  },
  { id: 'EVENTS',   label: 'Events',   emoji: '🏆', color: '#7C3AED', startDeg: 184, endDeg: 266, midDeg: 225  },
];

function piePath(s: number, e: number): string {
  const rad = (d: number) => (d * Math.PI) / 180;
  const px = (d: number, r: number) => PIE_CX + r * Math.cos(rad(d));
  const py = (d: number, r: number) => PIE_CY + r * Math.sin(rad(d));
  return [
    `M ${px(s, PIE_OUTER)} ${py(s, PIE_OUTER)}`,
    `A ${PIE_OUTER} ${PIE_OUTER} 0 0 1 ${px(e, PIE_OUTER)} ${py(e, PIE_OUTER)}`,
    `L ${px(e, PIE_INNER)} ${py(e, PIE_INNER)}`,
    `A ${PIE_INNER} ${PIE_INNER} 0 0 0 ${px(s, PIE_INNER)} ${py(s, PIE_INNER)}`,
    'Z',
  ].join(' ');
}

function RadialCategoryMenu({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: Category;
  onSelect: (c: Category) => void;
  onClose: () => void;
}) {
  const backdrop  = useRef(new Animated.Value(0)).current;
  const pieScale  = useRef(new Animated.Value(0)).current;
  const pieRotate = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef(CATS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdrop,  { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(pieScale,  { toValue: 1, tension: 180, friction: 11, useNativeDriver: true }),
        Animated.timing(pieRotate, { toValue: 1, duration: 380, useNativeDriver: true }),
        ...itemAnims.map((a, i) =>
          Animated.spring(a, { toValue: 1, tension: 220, friction: 10, delay: 80 + i * 55, useNativeDriver: true })
        ),
      ]).start();
    } else {
      backdrop.setValue(0);
      pieScale.setValue(0);
      pieRotate.setValue(0);
      itemAnims.forEach((a) => a.setValue(0));
    }
  }, [visible]);

  if (!visible) return null;

  const selectedCat = CATS.find((c) => c.id === selected);

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: 'rgba(10,10,30,0.82)', opacity: backdrop, alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />

        <Text style={pieStyles.guideAbove}>Tap a segment to explore</Text>

        <Animated.View
          style={{
            width: PIE_SIZE,
            height: PIE_SIZE,
            transform: [
              { scale: pieScale },
              {
                rotate: pieRotate.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['-25deg', '0deg'],
                }),
              },
            ],
          }}
        >
          {/* SVG donut segments */}
          <Svg width={PIE_SIZE} height={PIE_SIZE} style={StyleSheet.absoluteFillObject}>
            {CATS.map((cat) => {
              const isSel = selected === cat.id;
              return (
                <Path
                  key={cat.id}
                  d={piePath(cat.startDeg, cat.endDeg)}
                  fill={isSel ? cat.color : cat.color + 'AA'}
                  onPress={() => { onSelect(cat.id); onClose(); }}
                />
              );
            })}
          </Svg>

          {/* Item labels at mid-angle of each segment */}
          {CATS.map((cat, i) => {
            const rad = (cat.midDeg * Math.PI) / 180;
            const ix = PIE_CX + PIE_ITEM_R * Math.cos(rad);
            const iy = PIE_CY + PIE_ITEM_R * Math.sin(rad);
            const isSel = selected === cat.id;
            return (
              <Animated.View
                key={cat.id}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: ix - 34,
                  top: iy - 34,
                  width: 68,
                  height: 68,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: itemAnims[i],
                  transform: [
                    {
                      scale: itemAnims[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, isSel ? 1.12 : 1],
                      }),
                    },
                  ],
                }}
              >
                <Text style={{ fontSize: isSel ? 26 : 21 }}>{cat.emoji}</Text>
                <Text
                  style={[
                    pieStyles.itemLabel,
                    isSel && { color: Colors.white, fontWeight: '900' },
                  ]}
                >
                  {cat.label}
                </Text>
              </Animated.View>
            );
          })}

          {/* Center circle — close button + current emoji */}
          <TouchableOpacity
            onPress={onClose}
            style={[pieStyles.centerBtn, { left: PIE_CX - 36, top: PIE_CY - 36 }]}
          >
            <Text style={{ fontSize: 18 }}>{selectedCat?.emoji ?? '×'}</Text>
            <X color={Colors.neutral600} size={13} strokeWidth={2.5} />
          </TouchableOpacity>
        </Animated.View>

        <Text style={pieStyles.guideBelow}>
          Currently: <Text style={{ fontWeight: '800', color: Colors.white }}>{selectedCat?.label}</Text>
        </Text>
      </Animated.View>
    </Modal>
  );
}

const pieStyles = StyleSheet.create({
  guideAbove: {
    fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.65)',
    marginBottom: 28, letterSpacing: 0.4,
  },
  guideBelow: {
    fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 24,
  },
  itemLabel: {
    fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.85)',
    marginTop: 3, textAlign: 'center',
  },
  centerBtn: {
    position: 'absolute',
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 }, elevation: 10,
    gap: 1,
  },
});

// ─── Calendar picker modal ────────────────────────────────────────────────────
function CalendarModal({
  visible,
  onClose,
  onSelect,
  selectedDate,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (d: Date) => void;
  selectedDate: Date | null;
}) {
  const today = new Date();
  const [viewDate, setViewDate] = useState<Date>(() => {
    const d = selectedDate ?? today;
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    if (visible) {
      const d = selectedDate ?? today;
      setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [visible]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayJS = new Date(year, month, 1).getDay(); // 0=Sun
  const startOffset = (firstDayJS + 6) % 7; // Mon=0

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const isPast = (day: number) => {
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return d < t;
  };
  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === day
    );
  };
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={calStyles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <View style={calStyles.sheet}>
          <View style={calStyles.handle} />
          <Text style={calStyles.title}>Pick a Date</Text>

          {/* Month nav */}
          <View style={calStyles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={calStyles.navBtn} activeOpacity={0.7}>
              <ChevronLeft color={Colors.primary} size={20} strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={calStyles.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity onPress={nextMonth} style={calStyles.navBtn} activeOpacity={0.7}>
              <ChevronRight color={Colors.primary} size={20} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {/* Day-of-week header */}
          <View style={calStyles.weekRow}>
            {DAY_LABELS.map((d) => (
              <Text key={d} style={calStyles.weekLabel}>{d}</Text>
            ))}
          </View>

          {/* Date grid */}
          <View style={calStyles.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`empty-${i}`} style={calStyles.cell} />;
              const past = isPast(day);
              const sel = isSelected(day);
              const tod = isToday(day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    calStyles.cell,
                    sel && calStyles.cellSelected,
                    tod && !sel && calStyles.cellToday,
                    past && calStyles.cellPast,
                  ]}
                  onPress={() => {
                    if (!past) {
                      onSelect(new Date(year, month, day));
                      onClose();
                    }
                  }}
                  activeOpacity={past ? 1 : 0.7}
                >
                  <Text
                    style={[
                      calStyles.cellText,
                      sel && calStyles.cellTextSelected,
                      tod && !sel && calStyles.cellTextToday,
                      past && calStyles.cellTextPast,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ExploreScreen() {
  const router = useRouter();
  const { active: isPro } = useSubscription();

  // Navigation
  const [step, setStep] = useState<ExploreStep>('SEARCH');
  const [category, setCategory] = useState<Category>('VENUES');
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [sportFilter, setSportFilter] = useState<SportFilter>('ALL');
  const [dateQuick, setDateQuick] = useState<DateQuick>(null);
  const [customDate, setCustomDate] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [radiusKm, setRadiusKm] = useState(20);
  const [freeOnly, setFreeOnly] = useState(false);

  // Location
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  // Results
  const [results, setResults] = useState<AnyResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Map bottom sheet
  const [selectedItem, setSelectedItem] = useState<AnyResult | null>(null);
  const sheetAnim = useRef(new Animated.Value(300)).current;

  // Get user location on mount
  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(
          ({ coords }) => {
            setUserLat(coords.latitude);
            setUserLng(coords.longitude);
          }
        );
      }
    });
  }, []);

  const openSheet = (item: AnyResult) => {
    setSelectedItem(item);
    Animated.spring(sheetAnim, { toValue: 0, friction: 8, useNativeDriver: true }).start();
  };
  const closeSheet = () => {
    Animated.timing(sheetAnim, { toValue: 300, duration: 220, useNativeDriver: true }).start(() =>
      setSelectedItem(null)
    );
  };

  // ─── Compute filter date ──────────────────────────────────────────────────
  const getFilterDate = (): string | undefined => {
    if (dateQuick === 'TODAY') return toYMD(new Date());
    if (dateQuick === 'TOMORROW') return toYMD(addDays(new Date(), 1));
    if (dateQuick === 'WEEKEND') return toYMD(nextWeekend());
    if (dateQuick === 'CUSTOM' && customDate) return toYMD(customDate);
    return undefined;
  };

  // ─── Fetch results from backend ───────────────────────────────────────────
  const mapDist = useCallback(
    (lat2: number | null, lng2: number | null): number | undefined =>
      userLat != null && userLng != null && lat2 != null && lng2 != null
        ? Math.round(haversineKm(userLat, userLng, lat2, lng2) * 10) / 10
        : undefined,
    [userLat, userLng]
  );

  const fetchResults = useCallback(
    async (cat: Category) => {
      setLoading(true);
      try {
        const filterDate = getFilterDate();
        const q = searchText.trim() || undefined;
        const lat2 = userLat ?? undefined;
        const lng2 = userLng ?? undefined;

        if (cat === 'VENUES') {
          const raw = await futsalApi.filterVenues({ query: q, lat: lat2, lng: lng2, radiusKm, freeOnly: freeOnly || undefined });
          setResults(raw.map((v: any): VenueResult => ({
            id: String(v.id ?? v._id),
            name: v.name ?? 'Venue',
            location: v.location ?? v.locationName ?? '',
            pricePerSlot: v.pricePerSlot != null ? Number(v.pricePerSlot) : null,
            imageBase64: v.imageBase64, imageUrl: v.imageUrl,
            latitude: v.latitude ?? 51.5074, longitude: v.longitude ?? -0.1278,
            distance: mapDist(v.latitude, v.longitude),
          })));

        } else if (cat === 'TRAINERS') {
          const raw = await futsalApi.filterVenues({ query: q, lat: lat2, lng: lng2, radiusKm, sport: 'TRAINER_GYM' });
          setResults(raw.map((v: any): TrainerResult => ({
            id: String(v.id ?? v._id),
            name: v.name ?? 'Trainer',
            location: v.location ?? v.locationName ?? '',
            specialty: v.specialty ?? v.description ?? v.sportType,
            pricePerSession: v.pricePerSlot != null ? Number(v.pricePerSlot) : null,
            imageBase64: v.imageBase64, imageUrl: v.imageUrl,
            rating: v.rating,
            latitude: v.latitude ?? 51.5074, longitude: v.longitude ?? -0.1278,
            distance: mapDist(v.latitude, v.longitude),
          })));

        } else if (cat === 'GAMES') {
          const raw = await bookingApi.filterBookings({
            query: q, lat: lat2, lng: lng2, radiusKm,
            sport: sportFilter !== 'ALL' ? sportFilter : undefined,
            date: filterDate, freeOnly: freeOnly || undefined,
          });
          // Defensive: never show a match still awaiting vendor approval as joinable,
          // even though the backend already excludes it — mirrors HomeScreen's filtering.
          const liveOnly = raw.filter((b: any) => {
            const s = b.status ?? b.vendorStatus;
            return s !== 'PENDING_VENDOR' && s !== 'PENDING';
          });
          setResults(liveOnly.map((b: any): GameResult => ({
            id: String(b.id ?? b._id),
            title: b.title ?? 'Match',
            sport: b.sport ?? 'FUTSAL',
            slotDate: b.slotDate ?? '', startTime: b.startTime ?? '', endTime: b.endTime ?? '',
            locationName: b.futsalName ?? b.locationName ?? b.location ?? '',
            joinedPlayersCount: b.joinedPlayersCount ?? 0,
            maxSpots: b.maxSpots ?? 0, spotsLeft: b.spotsLeft ?? 0,
            totalPrice: b.totalPrice != null ? Number(b.totalPrice) : null,
            pricePerPlayer: b.pricePerPlayer != null ? Number(b.pricePerPlayer) : null,
            latitude: b.latitude ?? 51.5074, longitude: b.longitude ?? -0.1278,
            distance: mapDist(b.latitude, b.longitude),
          })));

        } else {
          // EVENTS — try global /tournaments first, fall back to per-venue fetch
          let rawEvents: any[] = [];
          try {
            const { data } = await axiosInstance.get('/tournaments', { params: { lat: lat2, lng: lng2, query: q } });
            rawEvents = Array.isArray(data) ? data : (data?.content ?? []);
          } catch {
            // Backend doesn't expose a global /tournaments list yet — aggregate from venues
            const venues = await futsalApi.listVenues();
            const chunks = await Promise.all(
              venues.slice(0, 8).map(async (v: any) => {
                try {
                  const ts = await tournamentApi.listForFutsal(v.id ?? v._id);
                  return ts.map((t: any) => ({ ...t, latitude: v.latitude, longitude: v.longitude, futsalName: v.name }));
                } catch { return []; }
              })
            );
            rawEvents = chunks.flat();
          }
          setResults(rawEvents.map((t: any): EventResult => ({
            id: String(t.id ?? t._id),
            name: t.name ?? t.title ?? 'Tournament',
            sport: t.sport ?? 'FUTSAL',
            futsalName: t.futsalName ?? t.venueName ?? '',
            startDate: t.startDate ?? t.scheduledDate,
            teamCount: t.teamCount ?? (t.teams?.length ?? 0),
            maxTeams: t.maxTeams,
            status: t.status,
            latitude: t.latitude ?? 51.5074, longitude: t.longitude ?? -0.1278,
            distance: mapDist(t.latitude, t.longitude),
          })));
        }
      } catch (err) {
        console.warn('ExploreScreen fetchResults error', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [searchText, sportFilter, dateQuick, customDate, radiusKm, freeOnly, userLat, userLng, mapDist]
  );

  const handleShowResults = () => {
    setStep('RESULTS');
    fetchResults(category);
  };

  const handleSwitchCategory = (cat: Category) => {
    setCategory(cat);
    fetchResults(cat);
  };

  // ─── Map region for radius preview ────────────────────────────────────────
  const lat = userLat ?? 51.5074;
  const lng = userLng ?? -0.1278;
  const radiusDeg = radiusKm / 111;
  const radiusMapRegion = {
    latitude: lat,
    longitude: lng,
    latitudeDelta: radiusDeg * 2.6,
    longitudeDelta: radiusDeg * 2.6,
  };

  // ─── Map region for results ────────────────────────────────────────────────
  const getResultsMapRegion = useCallback(() => {
    if (results.length === 0) return { latitude: lat, longitude: lng, latitudeDelta: 0.05, longitudeDelta: 0.05 };
    const lats = results.map((r: any) => r.latitude ?? lat);
    const lngs = results.map((r: any) => r.longitude ?? lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.8, 0.03),
      longitudeDelta: Math.max((maxLng - minLng) * 1.8, 0.03),
    };
  }, [results, lat, lng]);

  // ─── Card renderers ──────────────────────────────────────────────────────
  const renderVenueCard = (venue: VenueResult) => {
    const imageUri = resolveImage(venue);
    const priceLabel = venue.pricePerSlot != null ? `LKR ${venue.pricePerSlot.toFixed(2)}/slot` : 'Free';
    return (
      <TouchableOpacity
        key={venue.id}
        style={styles.resultCard}
        activeOpacity={0.88}
        onPress={() => openSheet(venue)}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={[Colors.primary + '40', Colors.primaryDark + '25']}
            style={[styles.cardImage, styles.cardImagePlaceholder]}
          >
            <MapPin color={Colors.primary} size={32} strokeWidth={1.5} />
            <Text style={styles.cardImagePlaceholderText}>{venue.name}</Text>
          </LinearGradient>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardName}>{venue.name}</Text>
          <Text style={styles.cardLocation} numberOfLines={1}>{venue.location}</Text>
          <View style={styles.cardMetaRow}>
            {venue.distance != null && (
              <View style={styles.metaItem}>
                <Navigation color={Colors.textMuted} size={12} strokeWidth={2} />
                <Text style={styles.metaText}>{venue.distance} km away</Text>
              </View>
            )}
            <Text style={styles.priceLabel}>{priceLabel}</Text>
          </View>
          <TouchableOpacity
            style={styles.cardCta}
            activeOpacity={0.88}
            onPress={() => router.push(`/create-match` as any)}
          >
            <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.cardCtaGrad}>
              <Text style={styles.cardCtaText}>Book Now</Text>
              <ChevronRight color={Colors.white} size={14} strokeWidth={2.5} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderGameCard = (game: GameResult) => {
    const sportEmoji = game.sport === 'CRICKET' ? '🏏' : game.sport === 'PICKLEBALL' ? '🏓' : '⚽';
    const filled = game.maxSpots > 0 ? Math.min((game.joinedPlayersCount / game.maxSpots) * 100, 100) : 0;
    const dateLabel = game.slotDate
      ? new Date(game.slotDate + 'T00:00:00').toLocaleDateString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric',
        })
      : 'TBD';
    const timeLabel = game.startTime
      ? game.startTime.slice(0, 5) + (game.endTime ? ` – ${game.endTime.slice(0, 5)}` : '')
      : '';
    const feeLabel =
      game.pricePerPlayer != null
        ? `LKR ${game.pricePerPlayer.toFixed(2)}/player`
        : game.totalPrice != null
        ? `LKR ${game.totalPrice.toFixed(2)} total`
        : 'Free';
    return (
      <TouchableOpacity
        key={game.id}
        style={styles.resultCard}
        activeOpacity={0.88}
        onPress={() => router.push(`/match/${game.id}` as any)}
      >
        <View style={styles.gameCardHeader}>
          <View style={styles.sportBadge}>
            <Text style={styles.sportEmoji}>{sportEmoji}</Text>
            <Text style={styles.sportBadgeText}>{game.sport}</Text>
          </View>
          <View style={[styles.feeBadge, game.totalPrice == null && styles.feeBadgeFree]}>
            <Text style={[styles.feeText, game.totalPrice == null && styles.feeFreeText]}>
              {feeLabel}
            </Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardName}>{game.title}</Text>
          <View style={styles.cardMetaRow}>
            <View style={styles.metaItem}>
              <Calendar color={Colors.textMuted} size={12} strokeWidth={2} />
              <Text style={styles.metaText}>{dateLabel}</Text>
            </View>
            {!!timeLabel && (
              <View style={styles.metaItem}>
                <Clock color={Colors.textMuted} size={12} strokeWidth={2} />
                <Text style={styles.metaText}>{timeLabel}</Text>
              </View>
            )}
          </View>
          <View style={styles.metaItem}>
            <MapPin color={Colors.textMuted} size={12} strokeWidth={2} />
            <Text style={styles.metaText} numberOfLines={1}>{game.locationName}</Text>
          </View>
          {game.distance != null && (
            <View style={[styles.metaItem, { marginTop: 4 }]}>
              <Navigation color={Colors.textMuted} size={12} strokeWidth={2} />
              <Text style={styles.metaText}>{game.distance} km away</Text>
            </View>
          )}
          <View style={styles.fillWrap}>
            <View style={styles.fillTrack}>
              <View style={[styles.fillBar, { width: `${filled}%` as any }]} />
            </View>
            <Text style={styles.fillLabel}>
              {game.joinedPlayersCount}/{game.maxSpots} players · {game.spotsLeft} spots left
            </Text>
          </View>
          <TouchableOpacity
            style={styles.cardCta}
            activeOpacity={0.88}
            onPress={() => router.push(`/join-match/${game.id}` as any)}
          >
            <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.cardCtaGrad}>
              <Text style={styles.cardCtaText}>Join Game</Text>
              <ChevronRight color={Colors.white} size={14} strokeWidth={2.5} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTrainerCard = (trainer: TrainerResult) => {
    const imageUri = resolveImage(trainer);
    const priceLabel = trainer.pricePerSession != null ? `LKR ${trainer.pricePerSession.toFixed(2)}/session` : 'Free';
    return (
      <TouchableOpacity key={trainer.id} style={styles.resultCard} activeOpacity={0.88} onPress={() => openSheet(trainer)}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <LinearGradient colors={['#EA580C40', '#C2410C25']} style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <Text style={{ fontSize: 40 }}>💪</Text>
            <Text style={[styles.cardImagePlaceholderText, { color: '#EA580C' }]}>{trainer.name}</Text>
          </LinearGradient>
        )}
        <View style={styles.cardBody}>
          <View style={[styles.trainerBadge]}>
            <Text style={styles.trainerBadgeText}>TRAINER</Text>
          </View>
          <Text style={styles.cardName}>{trainer.name}</Text>
          {!!trainer.specialty && <Text style={styles.cardLocation}>{trainer.specialty}</Text>}
          <Text style={[styles.cardLocation]} numberOfLines={1}>{trainer.location}</Text>
          <View style={styles.cardMetaRow}>
            {trainer.distance != null && (
              <View style={styles.metaItem}>
                <Navigation color={Colors.textMuted} size={12} strokeWidth={2} />
                <Text style={styles.metaText}>{trainer.distance} km away</Text>
              </View>
            )}
            {trainer.rating != null && (
              <View style={styles.metaItem}>
                <Star color="#F59E0B" size={12} fill="#F59E0B" />
                <Text style={styles.metaText}>{trainer.rating.toFixed(1)}</Text>
              </View>
            )}
            <Text style={[styles.priceLabel, { color: '#EA580C' }]}>{priceLabel}</Text>
          </View>
          <TouchableOpacity style={styles.cardCta} activeOpacity={0.88} onPress={() => router.push('/explore' as any)}>
            <LinearGradient colors={['#EA580C', '#C2410C']} style={styles.cardCtaGrad}>
              <Text style={styles.cardCtaText}>Book Session</Text>
              <ChevronRight color={Colors.white} size={14} strokeWidth={2.5} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEventCard = (event: EventResult) => {
    const sportEmoji = event.sport === 'CRICKET' ? '🏏' : event.sport === 'PICKLEBALL' ? '🏓' : '⚽';
    const statusColor = event.status === 'ACTIVE' ? Colors.success : event.status === 'UPCOMING' ? '#7C3AED' : Colors.neutral400;
    const statusLabel = event.status ?? 'OPEN';
    const dateLabel = event.startDate
      ? new Date(event.startDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
      : 'TBD';
    return (
      <TouchableOpacity
        key={event.id}
        style={styles.resultCard}
        activeOpacity={0.88}
        onPress={() => router.push(`/tournament/${event.id}` as any)}
      >
        <LinearGradient colors={['#7C3AED20', '#6D28D920']} style={styles.eventCardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 22 }}>{sportEmoji}</Text>
            <View>
              <Text style={styles.eventCardTitle}>{event.name}</Text>
              {!!event.futsalName && <Text style={styles.eventCardVenue}>{event.futsalName}</Text>}
            </View>
          </View>
          <View style={[styles.eventStatusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor + '55' }]}>
            <Text style={[styles.eventStatusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </LinearGradient>
        <View style={styles.cardBody}>
          <View style={styles.cardMetaRow}>
            <View style={styles.metaItem}>
              <Calendar color={Colors.textMuted} size={12} strokeWidth={2} />
              <Text style={styles.metaText}>{dateLabel}</Text>
            </View>
            {event.distance != null && (
              <View style={styles.metaItem}>
                <Navigation color={Colors.textMuted} size={12} strokeWidth={2} />
                <Text style={styles.metaText}>{event.distance} km away</Text>
              </View>
            )}
          </View>
          {(event.teamCount != null || event.maxTeams != null) && (
            <View style={styles.metaItem}>
              <Users color={Colors.textMuted} size={12} strokeWidth={2} />
              <Text style={styles.metaText}>
                {event.teamCount ?? 0}{event.maxTeams ? ` / ${event.maxTeams}` : ''} teams
              </Text>
            </View>
          )}
          <TouchableOpacity style={styles.cardCta} activeOpacity={0.88} onPress={() => router.push(`/tournament/${event.id}` as any)}>
            <LinearGradient colors={['#7C3AED', '#6D28D9']} style={styles.cardCtaGrad}>
              <Trophy color={Colors.white} size={14} strokeWidth={2.5} />
              <Text style={styles.cardCtaText}>View Tournament</Text>
              <ChevronRight color={Colors.white} size={14} strokeWidth={2.5} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: AnyResult }) => {
    if (category === 'VENUES')   return renderVenueCard(item as VenueResult);
    if (category === 'TRAINERS') return renderTrainerCard(item as TrainerResult);
    if (category === 'EVENTS')   return renderEventCard(item as EventResult);
    return renderGameCard(item as GameResult);
  };

  // ─── SEARCH / DISCOVER step ───────────────────────────────────────────────
  const renderSearchStep = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.searchScroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Hero */}
      <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.hero}>
        <View style={styles.heroBrandRow}>
          <Image source={require('../../assets/logo.jpeg')} style={styles.heroLogo} resizeMode="contain" />
          {isPro && (
            <View style={styles.proBadge}>
              <Zap color="#1A1A2E" size={8} strokeWidth={2.5} fill="#1A1A2E" />
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          )}
        </View>
        <Text style={styles.heroTitle}>Discover</Text>
        <Text style={styles.heroSub}>Find venues & matches near you</Text>
        <View style={styles.searchBar}>
          <Search color={Colors.neutral400} size={17} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder={category === 'VENUES' ? 'Search venue name…' : category === 'TRAINERS' ? 'Search trainer name…' : category === 'EVENTS' ? 'Search tournament…' : 'Search match title…'}
            placeholderTextColor={Colors.neutral400}
            returnKeyType="search"
            onSubmitEditing={handleShowResults}
          />
          {!!searchText && (
            <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color={Colors.neutral400} size={15} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <View style={styles.pad}>
        {/* Category — single button that opens radial pie menu */}
        <Text style={styles.sectionTitle}>What are you looking for?</Text>
        {(() => {
          const cat = CATS.find((c) => c.id === category)!;
          return (
            <TouchableOpacity
              style={[styles.catTrigger, { borderColor: cat.color }]}
              onPress={() => setShowCategoryMenu(true)}
              activeOpacity={0.82}
            >
              <View style={[styles.catTriggerIcon, { backgroundColor: cat.color + '22' }]}>
                <Text style={{ fontSize: 22 }}>{cat.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.catTriggerHint}>Searching for</Text>
                <Text style={[styles.catTriggerLabel, { color: cat.color }]}>{cat.label}</Text>
              </View>
              <View style={[styles.catTriggerBadge, { backgroundColor: cat.color }]}>
                <Text style={styles.catTriggerBadgeText}>Change ⊙</Text>
              </View>
            </TouchableOpacity>
          );
        })()}

        <RadialCategoryMenu
          visible={showCategoryMenu}
          selected={category}
          onSelect={(c) => setCategory(c)}
          onClose={() => setShowCategoryMenu(false)}
        />

        {/* Sport filter — only for Games */}
        {category === 'GAMES' && (
          <>
            <Text style={styles.sectionTitle}>Sport</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {SPORTS.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.chip, sportFilter === s.id && styles.chipActive]}
                  onPress={() => setSportFilter(s.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.chipEmoji}>{s.emoji}</Text>
                  <Text style={[styles.chipText, sportFilter === s.id && styles.chipTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* When? */}
        <Text style={styles.sectionTitle}>When?</Text>
        <View style={styles.dateGrid}>
          {(['TODAY', 'TOMORROW', 'WEEKEND'] as DateQuick[]).map((d) => {
            const label = d === 'TODAY' ? 'Today' : d === 'TOMORROW' ? 'Tomorrow' : 'This Weekend';
            const active = dateQuick === d;
            return (
              <TouchableOpacity
                key={d!}
                style={[styles.dateChip, active && styles.dateChipActive]}
                onPress={() => {
                  setDateQuick(active ? null : d);
                  setCustomDate(null);
                }}
                activeOpacity={0.8}
              >
                <Calendar color={active ? Colors.white : Colors.neutral500} size={12} strokeWidth={2} />
                <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {/* Calendar picker button */}
        <TouchableOpacity
          style={[styles.calendarBtn, dateQuick === 'CUSTOM' && styles.calendarBtnActive]}
          onPress={() => setShowCalendar(true)}
          activeOpacity={0.8}
        >
          <Calendar
            color={dateQuick === 'CUSTOM' ? Colors.white : Colors.primary}
            size={14}
            strokeWidth={2}
          />
          <Text style={[styles.calendarBtnText, dateQuick === 'CUSTOM' && styles.calendarBtnTextActive]}>
            {dateQuick === 'CUSTOM' && customDate
              ? customDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
              : 'Pick a specific date'}
          </Text>
          {dateQuick === 'CUSTOM' && (
            <TouchableOpacity
              onPress={() => { setDateQuick(null); setCustomDate(null); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X color={Colors.white} size={13} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Radius */}
        <Text style={styles.sectionTitle}>Search Radius</Text>
        {/* Preset buttons */}
        <View style={styles.radiusPresets}>
          {RADIUS_PRESETS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.radiusPreset, radiusKm === r && styles.radiusPresetActive]}
              onPress={() => setRadiusKm(r)}
              activeOpacity={0.8}
            >
              <Text style={[styles.radiusPresetText, radiusKm === r && styles.radiusPresetTextActive]}>
                {r} km
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Fine-tune */}
        <View style={styles.radiusTune}>
          <TouchableOpacity
            style={styles.tuneBtn}
            onPress={() => setRadiusKm((v) => Math.max(1, v - 1))}
            activeOpacity={0.8}
          >
            <Minus color={Colors.primary} size={16} strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.tuneValue}>
            <Text style={styles.tuneKm}>{radiusKm}</Text>
            <Text style={styles.tuneUnit}>km</Text>
          </View>
          <TouchableOpacity
            style={styles.tuneBtn}
            onPress={() => setRadiusKm((v) => Math.min(200, v + 1))}
            activeOpacity={0.8}
          >
            <Text style={styles.tunePlusText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Radius map */}
        {Platform.OS !== 'web' && MapViewComponent ? (
          <View style={styles.radiusMapWrap}>
            <MapViewComponent
              style={StyleSheet.absoluteFillObject}
              region={radiusMapRegion}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
              pointerEvents="none"
            >
              <MarkerComponent coordinate={{ latitude: lat, longitude: lng }} />
              {CircleComponent && (
                <CircleComponent
                  center={{ latitude: lat, longitude: lng }}
                  radius={radiusKm * 1000}
                  fillColor="rgba(64,124,240,0.12)"
                  strokeColor="rgba(64,124,240,0.55)"
                  strokeWidth={2}
                />
              )}
            </MapViewComponent>
            <View style={styles.radiusMapBadge}>
              <MapPin color={Colors.primary} size={10} strokeWidth={2.5} />
              <Text style={styles.radiusMapBadgeText}>{radiusKm} km radius</Text>
            </View>
          </View>
        ) : (
          <View style={styles.radiusMapFallback}>
            <MapIcon color={Colors.neutral400} size={28} strokeWidth={1.5} />
            <Text style={styles.radiusMapFallbackText}>{radiusKm} km radius · map on device</Text>
          </View>
        )}

        {/* Free only */}
        <TouchableOpacity
          style={styles.freeToggleRow}
          onPress={() => setFreeOnly((v) => !v)}
          activeOpacity={0.8}
        >
          <View style={styles.freeToggleLeft}>
            <DollarSign color={freeOnly ? Colors.success : Colors.textMuted} size={16} strokeWidth={2} />
            <View>
              <Text style={styles.freeToggleLabel}>Free only</Text>
              <Text style={styles.freeToggleSub}>Show only matches / venues with no cost</Text>
            </View>
          </View>
          <View style={[styles.toggle, freeOnly && styles.toggleOn]}>
            <View style={[styles.toggleThumb, freeOnly && styles.toggleThumbOn]} />
          </View>
        </TouchableOpacity>

        {/* Pro banner */}
        {!isPro && (
          <TouchableOpacity
            style={styles.proBanner}
            onPress={() => router.push('/subscription' as any)}
            activeOpacity={0.88}
          >
            <LinearGradient colors={['#1E293B', '#0F172A']} style={styles.proBannerGrad}>
              <Zap color={Colors.warning} size={20} strokeWidth={2.5} fill={Colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.proBannerTitle}>Unlock Pro Access</Text>
                <Text style={styles.proBannerSub}>Priority results, unlimited invites & more</Text>
              </View>
              <ChevronRight color={Colors.neutral400} size={16} strokeWidth={2} />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Show Results */}
        <TouchableOpacity style={styles.showBtn} onPress={handleShowResults} activeOpacity={0.88}>
          <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.showBtnGrad}>
            <Search color={Colors.white} size={17} strokeWidth={2.5} />
            <Text style={styles.showBtnText}>Show Results</Text>
            <ChevronRight color={Colors.white} size={17} strokeWidth={2.5} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        selectedDate={customDate}
        onSelect={(d) => {
          setCustomDate(d);
          setDateQuick('CUSTOM');
        }}
      />
    </ScrollView>
  );

  // ─── RESULTS step ─────────────────────────────────────────────────────────
  const renderResultsStep = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.resultsBar}>
        <TouchableOpacity style={styles.resultsBackBtn} onPress={() => setStep('SEARCH')} activeOpacity={0.8}>
          <X color={Colors.text} size={20} strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.resultsCount}>
            {loading ? 'Searching…' : `${results.length} ${CATS.find(c => c.id === category)?.label ?? ''} found`}
          </Text>
          <Text style={styles.resultsSubtitle}>
            {userLat != null ? `Within ${radiusKm} km of you` : 'All locations'}
            {getFilterDate() ? ` · ${getFilterDate()}` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.mapToggleBtn} onPress={() => setStep('MAP')} activeOpacity={0.85}>
          <MapIcon color={Colors.white} size={14} strokeWidth={2.5} />
          <Text style={styles.mapToggleBtnText}>Map</Text>
        </TouchableOpacity>
      </View>

      {/* Category switcher — 4 scrollable chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catSwitchScroll}
        contentContainerStyle={styles.catSwitchRow}
      >
        {CATS.map((cat) => {
          const active = category === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catSwitchChip, active && { backgroundColor: cat.color, borderColor: cat.color }]}
              onPress={() => handleSwitchCategory(cat.id)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13 }}>{cat.emoji}</Text>
              <Text style={[styles.catSwitchText, active && styles.catSwitchTextActive]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>
            Finding {CATS.find(c => c.id === category)?.label ?? ''} near you…
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item: any) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>No {category === 'VENUES' ? 'venues' : 'games'} found</Text>
              <Text style={styles.emptySub}>Try a wider radius or fewer filters</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => setStep('SEARCH')}
                activeOpacity={0.85}
              >
                <Text style={styles.emptyBtnText}>Adjust Filters</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );

  // ─── MAP step ─────────────────────────────────────────────────────────────
  const renderMapStep = () => {
    if (Platform.OS === 'web' || !MapViewComponent) {
      return (
        <LinearGradient colors={[Colors.neutral800, Colors.neutral900]} style={{ flex: 1 }}>
          <SafeAreaView style={styles.mapWebHeader} edges={['top']}>
            <TouchableOpacity style={styles.mapBackBtn} onPress={() => setStep('RESULTS')} activeOpacity={0.8}>
              <X color={Colors.white} size={20} strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={styles.mapWebTitle}>Map View</Text>
          </SafeAreaView>
          <View style={styles.mapWebBody}>
            <MapIcon color={Colors.neutral500} size={56} strokeWidth={1.2} />
            <Text style={styles.mapWebMsg}>Map view available on iOS & Android</Text>
            <Text style={styles.mapWebSub}>{results.length} results in your area</Text>
            <TouchableOpacity style={styles.mapWebListBtn} onPress={() => setStep('RESULTS')} activeOpacity={0.88}>
              <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.mapWebListGrad}>
                <Text style={styles.mapWebListText}>View as List</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <MapViewComponent
          style={StyleSheet.absoluteFillObject}
          initialRegion={getResultsMapRegion()}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {results.map((item: any) =>
            item.latitude && item.longitude ? (
              <MarkerComponent
                key={item.id}
                coordinate={{ latitude: item.latitude, longitude: item.longitude }}
                pinColor={Colors.primary}
                onPress={() => openSheet(item)}
                title={'name' in item ? (item as VenueResult).name : (item as GameResult).title}
              />
            ) : null
          )}
        </MapViewComponent>

        <SafeAreaView style={styles.mapOverlay} edges={['top']}>
          <View style={styles.mapTopRow}>
            <TouchableOpacity style={styles.mapTopBtn} onPress={() => setStep('RESULTS')} activeOpacity={0.85}>
              <X color={Colors.text} size={18} strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={styles.mapTopCenter}>
              <Text style={styles.mapTopCount}>{results.length} {category === 'VENUES' ? 'venues' : 'games'}</Text>
            </View>
            <TouchableOpacity style={styles.mapNewSearch} onPress={() => setStep('SEARCH')} activeOpacity={0.85}>
              <Search color={Colors.primary} size={13} strokeWidth={2} />
              <Text style={styles.mapNewSearchText}>New Search</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <View style={styles.mapFABs}>
          <TouchableOpacity style={styles.mapFAB} onPress={() => router.push('/create-match' as any)} activeOpacity={0.88}>
            <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.mapFABGrad}>
              <Plus color={Colors.white} size={13} strokeWidth={2.5} />
              <Text style={styles.mapFABText}>Create Game</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapFABIcon} onPress={() => setStep('SEARCH')} activeOpacity={0.85}>
            <RotateCcw color={Colors.text} size={16} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {selectedItem && (
          <>
            <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeSheet} activeOpacity={1} />
            <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: sheetAnim }] }]}>
              <View style={styles.sheetHandle} />
              <TouchableOpacity style={styles.sheetClose} onPress={closeSheet} activeOpacity={0.8}>
                <X color={Colors.neutral500} size={16} strokeWidth={2} />
              </TouchableOpacity>
              <Text style={styles.sheetName}>
                {'name' in selectedItem
                  ? (selectedItem as VenueResult).name
                  : (selectedItem as GameResult).title}
              </Text>
              {'location' in selectedItem && (
                <Text style={styles.sheetSub}>{(selectedItem as VenueResult).location}</Text>
              )}
              {'locationName' in selectedItem && (
                <Text style={styles.sheetSub}>{(selectedItem as GameResult).locationName}</Text>
              )}
              {'pricePerSlot' in selectedItem && (selectedItem as VenueResult).pricePerSlot != null && (
                <Text style={styles.sheetPrice}>
                  LKR {(selectedItem as VenueResult).pricePerSlot!.toFixed(2)}/slot
                </Text>
              )}
              <TouchableOpacity
                style={styles.sheetCta}
                activeOpacity={0.88}
                onPress={() => {
                  closeSheet();
                  if ('name' in selectedItem) {
                    router.push('/create-match' as any);
                  } else {
                    router.push(`/match/${selectedItem.id}` as any);
                  }
                }}
              >
                <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.sheetCtaGrad}>
                  <Text style={styles.sheetCtaText}>
                    {'name' in selectedItem ? 'Book Now' : 'View Game'}
                  </Text>
                  <ChevronRight color={Colors.white} size={16} strokeWidth={2.5} />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {step === 'SEARCH' && renderSearchStep()}
      {step === 'RESULTS' && renderResultsStep()}
      {step === 'MAP' && renderMapStep()}
      {step !== 'MAP' && <BottomNavbar activeTab="EXPLORE" showCreateButton={false} />}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },

  // ── Hero
  hero: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroBrandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14 },
  heroLogo: { width: 38, height: 38, borderRadius: 10 },
  proBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.warning, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  proBadgeText: { fontSize: 8, fontWeight: '900', color: '#1A1A2E', letterSpacing: 0.6 },
  heroTitle: { fontSize: 30, fontWeight: '900', color: Colors.white, letterSpacing: -0.4 },
  heroSub: { fontSize: 13, color: Colors.white + 'CC', marginBottom: 16, marginTop: 2 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },

  // ── Scroll
  searchScroll: { paddingBottom: 110 },
  pad: { paddingHorizontal: 18, paddingTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 12, marginTop: 4 },

  // ── Category
  categoryRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  categoryCard: { flex: 1, alignItems: 'center', gap: 8, padding: 16, backgroundColor: Colors.white, borderRadius: 18, borderWidth: 1.5, borderColor: Colors.neutral200, position: 'relative', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  categoryCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  categoryEmoji: { fontSize: 28 },
  categoryLabel: { fontSize: 13, fontWeight: '700', color: Colors.text },
  categoryLabelActive: { color: Colors.primary, fontWeight: '800' },
  categoryDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },

  // ── Sport chips
  chipRow: { marginBottom: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: Colors.white, borderRadius: 40, borderWidth: 1, borderColor: Colors.neutral200, marginRight: 8 },
  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipEmoji: { fontSize: 13 },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary, fontWeight: '700' },

  // ── Date
  dateGrid: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'nowrap' },
  dateChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.neutral200 },
  dateChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dateChipText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  dateChipTextActive: { color: Colors.white },

  calendarBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: Colors.primaryLight, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary + '50', marginBottom: 20 },
  calendarBtnActive: { backgroundColor: Colors.primary },
  calendarBtnText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.primary },
  calendarBtnTextActive: { color: Colors.white },

  // ── Radius
  radiusPresets: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  radiusPreset: { flex: 1, paddingVertical: 9, borderRadius: 12, backgroundColor: Colors.neutral100, borderWidth: 1, borderColor: Colors.neutral200, alignItems: 'center' },
  radiusPresetActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  radiusPresetText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  radiusPresetTextActive: { color: Colors.white },

  radiusTune: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 14 },
  tuneBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primary + '40' },
  tuneValue: { alignItems: 'center' },
  tuneKm: { fontSize: 28, fontWeight: '900', color: Colors.text, lineHeight: 32 },
  tuneUnit: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  tunePlusText: { fontSize: 22, fontWeight: '700', color: Colors.primary, lineHeight: 24 },

  radiusMapWrap: { height: 200, borderRadius: 16, overflow: 'hidden', marginBottom: 16, position: 'relative' },
  radiusMapBadge: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  radiusMapBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  radiusMapFallback: { height: 80, borderRadius: 16, backgroundColor: Colors.neutral100, alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16, borderWidth: 1, borderColor: Colors.neutral200, flexDirection: 'row' },
  radiusMapFallbackText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },

  // ── Free toggle
  freeToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.neutral200 },
  freeToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  freeToggleLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  freeToggleSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: Colors.neutral200, padding: 2, justifyContent: 'center' },
  toggleOn: { backgroundColor: Colors.success },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.white, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },

  // ── Pro banner
  proBanner: { borderRadius: 14, overflow: 'hidden', marginBottom: 14 },
  proBannerGrad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  proBannerTitle: { fontSize: 13, fontWeight: '800', color: Colors.white, marginBottom: 2 },
  proBannerSub: { fontSize: 11, color: Colors.neutral400 },

  // ── Show Results
  showBtn: { marginTop: 6, borderRadius: 16, overflow: 'hidden' },
  showBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  showBtnText: { fontSize: 16, fontWeight: '800', color: Colors.white },

  // ── Results bar
  resultsBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.neutral200 },
  resultsBackBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.neutral100, alignItems: 'center', justifyContent: 'center' },
  resultsCount: { fontSize: 15, fontWeight: '800', color: Colors.text },
  resultsSubtitle: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  mapToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  mapToggleBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },

  // ── Category switcher (results)
  catSwitchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  catSwitchChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: Colors.neutral100, borderRadius: 20 },
  catSwitchChipActive: { backgroundColor: Colors.primary },
  catSwitchText: { fontSize: 13, fontWeight: '600', color: Colors.neutral500 },
  catSwitchTextActive: { color: Colors.white, fontWeight: '700' },

  // ── Loading / empty
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: Colors.textSecondary },
  resultsList: { padding: 16, paddingBottom: 100, gap: 14 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  emptyBtn: { marginTop: 4, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: Colors.primary, borderRadius: 14 },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  // ── Result cards shared
  resultCard: { backgroundColor: Colors.white, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardImage: { width: '100%', height: 140 },
  cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  cardImagePlaceholderText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  cardBody: { padding: 14, gap: 8 },
  cardName: { fontSize: 16, fontWeight: '800', color: Colors.text },
  cardLocation: { fontSize: 12, color: Colors.textSecondary },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  priceLabel: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark },
  cardCta: { marginTop: 4, borderRadius: 12, overflow: 'hidden' },
  cardCtaGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  cardCtaText: { fontSize: 14, fontWeight: '800', color: Colors.white },

  // ── Game card extras
  gameCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingBottom: 4 },
  sportBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  sportEmoji: { fontSize: 13 },
  sportBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.primary },
  feeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: Colors.primaryLight },
  feeBadgeFree: { backgroundColor: Colors.success + '20' },
  feeText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  feeFreeText: { color: Colors.success },
  fillWrap: { gap: 4 },
  fillTrack: { height: 5, backgroundColor: Colors.neutral100, borderRadius: 3, overflow: 'hidden' },
  fillBar: { height: 5, backgroundColor: Colors.primary, borderRadius: 3 },
  fillLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },

  // ── Map web fallback
  mapWebHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  mapBackBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.white + '20', alignItems: 'center', justifyContent: 'center' },
  mapWebTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  mapWebBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  mapWebMsg: { fontSize: 18, fontWeight: '800', color: Colors.white, textAlign: 'center' },
  mapWebSub: { fontSize: 14, color: Colors.neutral400, textAlign: 'center' },
  mapWebListBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8, width: 200 },
  mapWebListGrad: { paddingVertical: 14, alignItems: 'center' },
  mapWebListText: { fontSize: 15, fontWeight: '800', color: Colors.white },

  // ── Map overlay
  mapOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  mapTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, marginTop: 8 },
  mapTopBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  mapTopCenter: { flex: 1, backgroundColor: Colors.white, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  mapTopCount: { fontSize: 14, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  mapNewSearch: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.white, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  mapNewSearchText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  mapFABs: { position: 'absolute', bottom: 30, right: 16, alignItems: 'flex-end', gap: 10 },
  mapFAB: { borderRadius: 14, overflow: 'hidden', shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  mapFABGrad: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 11 },
  mapFABText: { fontSize: 13, fontWeight: '800', color: Colors.white },
  mapFABIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },

  // ── Bottom sheet
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 14, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: -6 }, elevation: 12 },
  sheetHandle: { width: 40, height: 4, backgroundColor: Colors.neutral300, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetClose: { position: 'absolute', top: 14, right: 16, width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.neutral100, alignItems: 'center', justifyContent: 'center' },
  sheetName: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 4, paddingRight: 44 },
  sheetSub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  sheetPrice: { fontSize: 16, fontWeight: '800', color: Colors.primary, marginBottom: 12 },
  sheetCta: { marginTop: 8, borderRadius: 14, overflow: 'hidden' },
  sheetCtaGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  sheetCtaText: { fontSize: 15, fontWeight: '800', color: Colors.white },

  // ── Category trigger button (replaces old tile row)
  catTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 18,
    borderWidth: 2, padding: 12, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  catTriggerIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  catTriggerHint: { fontSize: 10, fontWeight: '600', color: Colors.textMuted, letterSpacing: 0.3 },
  catTriggerLabel: { fontSize: 16, fontWeight: '900', marginTop: 1 },
  catTriggerBadge: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20,
  },
  catTriggerBadgeText: { fontSize: 11, fontWeight: '800', color: Colors.white },

  // ── Category switcher scroll in results bar
  catSwitchScroll: { backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.neutral100 },

  // ── Trainer card extras
  trainerBadge: {
    alignSelf: 'flex-start', backgroundColor: '#EA580C22',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4,
  },
  trainerBadgeText: { fontSize: 9, fontWeight: '900', color: '#EA580C', letterSpacing: 0.8 },

  // ── Event card extras
  eventCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, paddingBottom: 10,
  },
  eventCardTitle: { fontSize: 15, fontWeight: '800', color: Colors.text },
  eventCardVenue: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  eventStatusBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  eventStatusText: { fontSize: 10, fontWeight: '800' },
});

// ─── Calendar styles ──────────────────────────────────────────────────────────
const calStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24, paddingTop: 12 },
  handle: { width: 40, height: 4, backgroundColor: Colors.neutral300, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 20 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: Colors.text },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 20, marginVertical: 2 },
  cellSelected: { backgroundColor: Colors.primary },
  cellToday: { backgroundColor: Colors.primaryLight },
  cellPast: { opacity: 0.3 },
  cellText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  cellTextSelected: { color: Colors.white, fontWeight: '800' },
  cellTextToday: { color: Colors.primary, fontWeight: '800' },
  cellTextPast: { color: Colors.textMuted },
});
