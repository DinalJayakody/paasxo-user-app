import { AreaSearchSheet } from '../components/AreaSearchSheet';
import { DatePickerSheet } from '../components/DatePickerSheet';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  Landmark,
  Dumbbell,
  Goal,
  Target,
  Volleyball,
  LayoutGrid,
  Swords,
  type LucideIcon,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import Svg, { Path } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { WhistleIcon } from '../components/icons/WhistleIcon';
import { notificationApi } from '../api/notificationApi';
import { BottomNavbar, useBottomNavBarHeight } from '../components/BottomNavbar';
import { futsalApi } from '../api/futsalApi';
import { bookingApi } from '../api/bookingApi';
import { tournamentApi } from '../api/tournamentApi';
import { trainerApi } from '../api/trainerApi';
import { LoadingScreen } from '../components/LoadingScreen';
import { PaasxoRefreshControl } from '../components/PaasxoRefreshControl';
import { PaasxoRefreshLogo } from '../components/PaasxoRefreshLogo';
import HeaderIconButton from '../components/HeaderIconButton';
import { useSubscription } from '../hooks/useSubscription';
import { resolveMediaUrl } from '../utils/mediaUrl';
import ScreenGlow from '../components/ScreenGlow';

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

// Default map center when a result or the user's own location has no
// coordinates yet — Colombo, since that's this app's home city.
const DEFAULT_LAT = 6.9271;
const DEFAULT_LNG = 79.8612;

// ─── Types ────────────────────────────────────────────────────────────────────
type Category = 'VENUES' | 'TRAINERS' | 'GAMES' | 'EVENTS';
type ExploreStep = 'SEARCH' | 'RESULTS' | 'MAP';
type SportFilter = 'ALL' | 'FUTSAL' | 'CRICKET' | 'PICKLEBALL' | 'PADDLEBALL';
type DateQuick = 'TODAY' | 'TOMORROW' | 'WEEKEND' | 'CUSTOM' | null;

interface VenueResult {
  id: string; name: string; location: string;
  pricePerSlot: number | null; imageBase64?: string; imageUrl?: string;
  latitude: number | null; longitude: number | null; distance?: number;
}
interface GameResult {
  id: string; title: string; sport: string;
  slotDate: string; startTime: string; endTime: string;
  locationName: string; joinedPlayersCount: number; maxSpots: number;
  spotsLeft: number; totalPrice: number | null; pricePerPlayer: number | null;
  latitude: number | null; longitude: number | null; distance?: number;
  isPublicMatch?: boolean; publicMatchJoinFee?: number | null;
}
interface TrainerResult {
  id: string; name: string; location: string;
  specialty?: string; pricePerSession: number | null;
  imageBase64?: string; imageUrl?: string; rating?: number;
  latitude: number | null; longitude: number | null; distance?: number;
}
const CATEGORY_LABELS: Record<string, string> = {
  GYM: 'Gym', BODYBUILDING: 'Bodybuilding', CALISTHENICS: 'Calisthenics', ZUMBA: 'Zumba', DANCING: 'Dancing', YOGA: 'Yoga',
  CROSSFIT: 'CrossFit', MARTIAL_ARTS: 'Martial Arts', PILATES: 'Pilates', OTHER: 'Training',
};
interface EventResult {
  id: string; name: string; sport: string;
  futsalName: string; startDate?: string;
  teamCount?: number; maxTeams?: number; status?: string;
  latitude: number | null; longitude: number | null; distance?: number;
}
type AnyResult = VenueResult | GameResult | TrainerResult | EventResult;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SPORTS: { id: SportFilter; label: string; Icon: LucideIcon }[] = [
  { id: 'ALL', label: 'All', Icon: LayoutGrid },
  { id: 'FUTSAL', label: 'Futsal', Icon: Goal },
  { id: 'CRICKET', label: 'Cricket', Icon: Target },
  { id: 'PICKLEBALL', label: 'Pickleball', Icon: Volleyball },
  { id: 'PADDLEBALL', label: 'Paddleball', Icon: Volleyball },
];

// Trainer specialties offered as filter chips (values = backend TrainerCategory).
const TRAINER_FILTERS: { id: string; label: string }[] = [
  { id: 'GYM', label: 'Gym' },
  { id: 'CALISTHENICS', label: 'Calisthenics' },
  { id: 'BODYBUILDING', label: 'Bodybuilding' },
  { id: 'ZUMBA', label: 'Zumba' },
  { id: 'YOGA', label: 'Yoga' },
  { id: 'DANCING', label: 'Dancing' },
  { id: 'CROSSFIT', label: 'CrossFit' },
  { id: 'MARTIAL_ARTS', label: 'Martial Arts' },
  { id: 'PILATES', label: 'Pilates' },
];

// Same sport->icon mapping used for result-card badges (games/events).
function sportIconFor(sport?: string): LucideIcon {
  if (sport === 'CRICKET') return Target;
  if (sport === 'PICKLEBALL') return Volleyball;
  return Goal;
}

const RADIUS_PRESETS = [5, 10, 20, 50];
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// Local calendar date — toISOString() is UTC, which in Sri Lanka (UTC+5:30)
// turned "Today" into yesterday's date before 5:30am.
function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** This weekend's next day: today if it's already Saturday/Sunday, else the coming Saturday. */
function nextWeekend(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun,6=Sat
  if (day === 6 || day === 0) return now;
  return addDays(now, 6 - day);
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

const CATS: { id: Category; label: string; Icon: LucideIcon; color: string; startDeg: number; endDeg: number; midDeg: number }[] = [
  { id: 'VENUES',   label: 'Venues',   Icon: Landmark, color: '#2977C2', startDeg: -86, endDeg: -4,  midDeg: -45  },
  { id: 'TRAINERS', label: 'Trainers', Icon: Dumbbell, color: Colors.trainer, startDeg: 4,   endDeg: 86,  midDeg: 45   },
  { id: 'GAMES',    label: 'Games',    Icon: Goal,     color: '#059669', startDeg: 94,  endDeg: 176, midDeg: 135  },
  { id: 'EVENTS',   label: 'Events',   Icon: Trophy,   color: '#7C3AED', startDeg: 184, endDeg: 266, midDeg: 225  },
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
  const { colors } = useTheme();
  const pieStyles = React.useMemo(() => createPieStyles(colors), [colors]);
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
                <cat.Icon color={colors.white} size={isSel ? 26 : 21} strokeWidth={2.2} />
                <Text
                  style={[
                    pieStyles.itemLabel,
                    isSel && { color: colors.white, fontWeight: '900' },
                  ]}
                >
                  {cat.label}
                </Text>
              </Animated.View>
            );
          })}

          {/* Center circle — close button + current category icon */}
          <TouchableOpacity
            onPress={onClose}
            style={[pieStyles.centerBtn, { left: PIE_CX - 36, top: PIE_CY - 36 }]}
          >
            {selectedCat && <selectedCat.Icon color={selectedCat.color} size={18} strokeWidth={2.2} />}
            <X color={colors.neutral600} size={13} strokeWidth={2.5} />
          </TouchableOpacity>
        </Animated.View>

        <Text style={pieStyles.guideBelow}>
          Currently: <Text style={{ fontWeight: '800', color: colors.white }}>{selectedCat?.label}</Text>
        </Text>
      </Animated.View>
    </Modal>
  );
}

const createPieStyles = (colors: ThemeColors) => StyleSheet.create({
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
    backgroundColor: colors.cardBg,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 }, elevation: 10,
    gap: 1,
  },
});


// ─── Main component ───────────────────────────────────────────────────────────
const VALID_CATEGORIES: Category[] = ['VENUES', 'TRAINERS', 'GAMES', 'EVENTS'];

export default function ExploreScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const navBarHeight = useBottomNavBarHeight();
  const router = useRouter();
  const { active: isPro } = useSubscription();
  // Lets other screens deep-link straight into a category, e.g.
  // router.replace('/explore?category=TRAINERS') from the trainer booking flow.
  const params = useLocalSearchParams<{ category?: string; q?: string }>();

  // Navigation
  const [step, setStep] = useState<ExploreStep>('SEARCH');
  const [category, setCategory] = useState<Category>(() => {
    const requested = params.category?.toUpperCase();
    return (VALID_CATEGORIES as string[]).includes(requested ?? '') ? (requested as Category) : 'VENUES';
  });
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  const [unreadGeneral, setUnreadGeneral] = useState(0);
  useFocusEffect(
    useCallback(() => {
      notificationApi.getUnreadCount('GENERAL').then(setUnreadGeneral).catch(() => {});
    }, [])
  );

  // Filters
  // Text search lives on the Explore tab's own search bar; whatever was typed
  // there arrives as ?q= and is applied here as a removable chip.
  const [searchText, setSearchText] = useState(() => (typeof params.q === 'string' ? params.q.slice(0, 80) : ''));
  // Live-as-you-type dropdown, shown directly under the search bar instead of
  // requiring a "Show Results" tap + full-screen navigation for every search —
  // that full RESULTS step (with its date/radius/sport filters) still exists
  // for a complete browse, reached via "See all results" at the bottom of
  // this dropdown, or the keyboard's search key. A separate, deliberately
  // lightweight fetch (not fetchResults below) so this never touches the
  // RESULTS step's own results/page/hasMore state.
  const [dropdownResults, setDropdownResults] = useState<{ id: string; title: string; subtitle: string; raw: any }[]>([]);
  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sportFilter, setSportFilter] = useState<SportFilter>('ALL');
  const [dateQuick, setDateQuick] = useState<DateQuick>(null);
  const [customDate, setCustomDate] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [radiusKm, setRadiusKm] = useState(20);
  const [freeOnly, setFreeOnly] = useState(false);
  // Trainer specialty filter (TrainerCategory) — null = all trainers.
  const [trainerCategory, setTrainerCategory] = useState<string | null>(null);
  // Search-area centre: null = "my location". Set by dragging the radius map
  // (or "Search this area" on the results map).
  const [centerLat, setCenterLat] = useState<number | null>(null);
  const [centerLng, setCenterLng] = useState<number | null>(null);
  const [centerLabel, setCenterLabel] = useState<string | null>(null);
  const radiusMapRef = useRef<any>(null);
  const [areaSearchVisible, setAreaSearchVisible] = useState(false);
  const programmaticMoveRef = useRef(false);
  const resultsMapRef = useRef<any>(null);
  const [mapMovedTo, setMapMovedTo] = useState<{ latitude: number; longitude: number } | null>(null);

  // Location
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  // Results — paginated 10 at a time, loaded further via infinite scroll
  const PAGE_SIZE = 10;
  const [results, setResults] = useState<AnyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

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

  // targetPage/append let one function serve both "new search" (page 0, replace)
  // and "scrolled to the bottom" (page N, append) — the only difference is
  // whether the mapped page of results replaces or extends the current list.
  const fetchResults = useCallback(
    async (cat: Category, targetPage: number = 0, append: boolean = false, silent: boolean = false) => {
      if (append) setLoadingMore(true); else if (!silent) setLoading(true);
      try {
        const filterDate = getFilterDate();
        const q = searchText.trim() || undefined;
        const lat2 = (centerLat ?? userLat) ?? undefined;
        const lng2 = (centerLng ?? userLng) ?? undefined;
        const pageParams = { page: targetPage, size: PAGE_SIZE };
        let more = false;

        if (cat === 'VENUES') {
          const { content, hasMore: m } = await futsalApi.filterVenues({
            query: q, lat: lat2, lng: lng2, radiusKm, freeOnly: freeOnly || undefined,
            sport: sportFilter !== 'ALL' ? sportFilter : undefined, ...pageParams,
          });
          more = m;
          const mapped = content.map((v: any): VenueResult => ({
            id: String(v.id ?? v._id),
            name: v.name ?? 'Venue',
            location: v.location ?? v.locationName ?? '',
            pricePerSlot: v.pricePerSlot != null ? Number(v.pricePerSlot) : null,
            imageBase64: v.imageBase64, imageUrl: v.imageUrl,
            latitude: v.latitude ?? null, longitude: v.longitude ?? null,
            distance: mapDist(v.latitude, v.longitude),
          }));
          setResults((prev) => (append ? [...prev, ...mapped] : mapped));

        } else if (cat === 'TRAINERS') {
          const { content, hasMore: m } = await trainerApi.filterTrainers({
            query: q, category: trainerCategory ?? undefined,
            lat: lat2, lng: lng2, radiusKm, freeOnly: freeOnly || undefined, ...pageParams,
          });
          more = m;
          const mapped = content.map((t: any): TrainerResult => ({
            id: String(t.id),
            name: t.trainerDisplayName ?? 'Trainer',
            location: t.location ?? '',
            specialty: Array.isArray(t.categories) && t.categories.length
              ? t.categories.map((c: string) => CATEGORY_LABELS[c] ?? c).join(' · ')
              : undefined,
            pricePerSession: t.hourlyRate != null ? Number(t.hourlyRate) : null,
            imageUrl: resolveMediaUrl(t.profileImageUrl),
            rating: t.rating,
            latitude: t.latitude ?? null, longitude: t.longitude ?? null,
            distance: mapDist(t.latitude, t.longitude),
          }));
          setResults((prev) => (append ? [...prev, ...mapped] : mapped));

        } else if (cat === 'GAMES') {
          const { content, hasMore: m } = await bookingApi.filterBookings({
            query: q, lat: lat2, lng: lng2, radiusKm,
            sport: sportFilter !== 'ALL' ? sportFilter : undefined,
            date: filterDate, freeOnly: freeOnly || undefined, ...pageParams,
          });
          more = m;
          // Defensive: never show a match still awaiting vendor approval as joinable,
          // even though the backend already excludes it — mirrors HomeScreen's filtering.
          const liveOnly = content.filter((b: any) => {
            const s = b.status ?? b.vendorStatus;
            return s !== 'PENDING_VENDOR' && s !== 'PENDING';
          });
          const mapped = liveOnly.map((b: any): GameResult => ({
            id: String(b.id ?? b._id),
            title: b.title ?? 'Match',
            sport: b.sport ?? 'FUTSAL',
            slotDate: b.slotDate ?? '', startTime: b.startTime ?? '', endTime: b.endTime ?? '',
            locationName: b.futsalName ?? b.locationName ?? b.location ?? '',
            joinedPlayersCount: b.joinedPlayersCount ?? 0,
            maxSpots: b.maxSpots ?? 0, spotsLeft: b.spotsLeft ?? 0,
            totalPrice: b.totalPrice != null ? Number(b.totalPrice) : null,
            pricePerPlayer: b.pricePerPlayer != null ? Number(b.pricePerPlayer) : null,
            latitude: b.latitude ?? null, longitude: b.longitude ?? null,
            distance: mapDist(b.latitude, b.longitude),
            isPublicMatch: b.isPublicMatch ?? false,
            publicMatchJoinFee: b.publicMatchJoinFee != null ? Number(b.publicMatchJoinFee) : null,
          }));
          setResults((prev) => (append ? [...prev, ...mapped] : mapped));

        } else {
          // EVENTS — global cross-venue tournament search (text/date/radius), paginated.
          const { content, hasMore: m } = await tournamentApi.filterTournaments({
            query: q, lat: lat2, lng: lng2, radiusKm, date: filterDate, ...pageParams,
          });
          more = m;
          const mapped = content.map((t: any): EventResult => ({
            id: String(t.id ?? t._id),
            name: t.name ?? t.title ?? 'Tournament',
            sport: t.sport ?? 'FUTSAL',
            futsalName: t.futsalName ?? t.venueName ?? '',
            startDate: t.startDate ?? t.scheduledDate,
            teamCount: t.teamCount ?? (t.teams?.length ?? 0),
            maxTeams: t.maxTeams,
            status: t.status,
            latitude: t.latitude ?? null, longitude: t.longitude ?? null,
            distance: mapDist(t.latitude, t.longitude),
          }));
          setResults((prev) => (append ? [...prev, ...mapped] : mapped));
        }

        setPage(targetPage);
        setHasMore(more);
      } catch (err) {
        console.warn('ExploreScreen fetchResults error', err);
        if (!append) setResults([]);
        setHasMore(false);
      } finally {
        if (append) setLoadingMore(false); else if (!silent) setLoading(false);
      }
    },
    [searchText, sportFilter, dateQuick, customDate, radiusKm, freeOnly, userLat, userLng, centerLat, centerLng, trainerCategory, mapDist]
  );

  // Location resolves asynchronously (permission prompt + GPS/network fix), so a
  // "Show Results" tap can easily beat it — that fetch then runs with lat/lng
  // undefined, silently skipping radius filtering for every card and marker
  // already on screen. Once the fix lands, re-run the active search so the list
  // and map (both driven by the same `results` state) pick up real distances
  // instead of staying stuck on that unfiltered snapshot until the user manually
  // re-searches.
  const locationReadyRef = useRef(false);
  useEffect(() => {
    if (userLat == null || userLng == null || locationReadyRef.current) return;
    locationReadyRef.current = true;
    if (step !== 'SEARCH') fetchResults(category, 0, false, true);
  }, [userLat, userLng, step, category, fetchResults]);

  const handleShowResults = () => {
    setDropdownOpen(false);
    setStep('RESULTS');
    fetchResults(category, 0, false);
  };

  // Filters changed while results/map are showing → refresh them in place.
  const filtersKey = `${radiusKm}|${centerLat}|${centerLng}|${trainerCategory}|${sportFilter}`;
  const firstFiltersRun = useRef(true);
  useEffect(() => {
    if (firstFiltersRun.current) { firstFiltersRun.current = false; return; }
    if (step === 'SEARCH') return;
    const t = setTimeout(() => fetchResults(category, 0, false, true), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  // Search centre helpers
  const searchLatVal = centerLat ?? userLat ?? DEFAULT_LAT;
  const searchLngVal = centerLng ?? userLng ?? DEFAULT_LNG;
  const usingCustomCenter = centerLat != null && centerLng != null;
  const regionFor = (la: number, ln: number, km: number) => ({
    latitude: la, longitude: ln, latitudeDelta: (km / 111) * 2.6, longitudeDelta: (km / 111) * 2.6,
  });
  const setSearchCenter = useCallback((la: number | null, ln: number | null, label?: string) => {
    setCenterLat(la);
    setCenterLng(ln);
    setCenterLabel(label ?? null);
    if (la == null || ln == null || label) return;
    // One reverse-geocode per finished drag (on-device geocoder, no API cost).
    Location.reverseGeocodeAsync({ latitude: la, longitude: ln })
      .then(([p]) => {
        if (!p) return;
        const label = [p.district || p.name || p.street, p.city || p.subregion].filter(Boolean).join(', ');
        if (label) setCenterLabel(label);
      })
      .catch(() => {});
  }, []);
  // Our own camera moves are flagged so onRegionChangeComplete doesn't treat
  // them as the user picking a new area; the flag self-clears in case the
  // camera was already there and no change event fires.
  const moveRadiusMap = (region: ReturnType<typeof regionFor>, ms: number) => {
    if (!radiusMapRef.current) return;
    programmaticMoveRef.current = true;
    radiusMapRef.current.animateToRegion(region, ms);
    setTimeout(() => { programmaticMoveRef.current = false; }, ms + 500);
  };
  const resetToMyLocation = () => {
    setSearchCenter(null, null);
    moveRadiusMap(regionFor(userLat ?? DEFAULT_LAT, userLng ?? DEFAULT_LNG, radiusKm), 350);
  };
  // Keep the radius preview framed on the circle as the radius changes.
  useEffect(() => {
    moveRadiusMap(regionFor(searchLatVal, searchLngVal, radiusKm), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusKm, userLat, userLng]);

  const handleSelectDropdownResult = (item: { raw: any }) => {
    setDropdownOpen(false);
    if (category === 'VENUES') {
      // openSheet renders a bottom sheet expecting a fully-mapped VenueResult
      // (resolved image/distance included) — the raw API row alone isn't
      // enough, same mapping fetchResults applies for the full RESULTS step.
      const v = item.raw;
      openSheet({
        id: String(v.id ?? v._id),
        name: v.name ?? 'Venue',
        location: v.location ?? v.locationName ?? '',
        pricePerSlot: v.pricePerSlot != null ? Number(v.pricePerSlot) : null,
        imageBase64: v.imageBase64, imageUrl: v.imageUrl,
        latitude: v.latitude ?? null, longitude: v.longitude ?? null,
        distance: mapDist(v.latitude, v.longitude),
      });
    }
    else if (category === 'TRAINERS') router.push(`/trainer/${item.raw.id}` as any);
    else if (category === 'GAMES') router.push(`/match/${item.raw.id ?? item.raw._id}` as any);
    else router.push(`/tournament/${item.raw.id ?? item.raw._id}` as any);
  };

  const handleSwitchCategory = (cat: Category) => {
    setCategory(cat);
    fetchResults(cat, 0, false);
  };

  const loadMoreResults = () => {
    if (loading || loadingMore || !hasMore) return;
    fetchResults(category, page + 1, true);
  };

  const onRefreshResults = async () => {
    setRefreshing(true);
    try {
      await fetchResults(category, 0, false, true);
    } finally {
      setRefreshing(false);
    }
  };

  // ─── Map region for radius preview ────────────────────────────────────────
  const lat = userLat ?? DEFAULT_LAT;
  const lng = userLng ?? DEFAULT_LNG;
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
            colors={[colors.primary + '40', colors.primaryDark + '25']}
            style={[styles.cardImage, styles.cardImagePlaceholder]}
          >
            <MapPin color={colors.primary} size={32} strokeWidth={1.5} />
            <Text style={styles.cardImagePlaceholderText}>{venue.name}</Text>
          </LinearGradient>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardName}>{venue.name}</Text>
          <Text style={styles.cardLocation} numberOfLines={1}>{venue.location}</Text>
          <View style={styles.cardMetaRow}>
            {venue.distance != null && (
              <View style={styles.metaItem}>
                <Navigation color={colors.textMuted} size={12} strokeWidth={2} />
                <Text style={styles.metaText}>{venue.distance} km away</Text>
              </View>
            )}
            <Text style={styles.priceLabel}>{priceLabel}</Text>
          </View>
          <TouchableOpacity
            style={styles.cardCta}
            activeOpacity={0.88}
            onPress={() => router.push({ pathname: '/create-match', params: { venueId: String(venue.id) } } as any)}
          >
            <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.cardCtaGrad}>
              <Text style={styles.cardCtaText}>Book Now</Text>
              <ChevronRight color={colors.white} size={14} strokeWidth={2.5} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderGameCard = (game: GameResult) => {
    const GameSportIcon = sportIconFor(game.sport);
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
        // A Public Match always carries a flat platform join fee even at $0
        // venue cost — never truly "Free" (see CreateBookingPayload.isPublicMatch).
        : game.isPublicMatch && game.publicMatchJoinFee != null
        ? `LKR ${game.publicMatchJoinFee.toFixed(2)} to join`
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
            <GameSportIcon color={colors.text} size={13} strokeWidth={2.2} />
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
              <Calendar color={colors.textMuted} size={12} strokeWidth={2} />
              <Text style={styles.metaText}>{dateLabel}</Text>
            </View>
            {!!timeLabel && (
              <View style={styles.metaItem}>
                <Clock color={colors.textMuted} size={12} strokeWidth={2} />
                <Text style={styles.metaText}>{timeLabel}</Text>
              </View>
            )}
          </View>
          <View style={styles.metaItem}>
            <MapPin color={colors.textMuted} size={12} strokeWidth={2} />
            <Text style={styles.metaText} numberOfLines={1}>{game.locationName}</Text>
          </View>
          {game.distance != null && (
            <View style={[styles.metaItem, { marginTop: 4 }]}>
              <Navigation color={colors.textMuted} size={12} strokeWidth={2} />
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
            <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.cardCtaGrad}>
              <Text style={styles.cardCtaText}>Join Game</Text>
              <ChevronRight color={colors.white} size={14} strokeWidth={2.5} />
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
          <LinearGradient colors={[`${Colors.trainer}40`, `${colors.primaryDark}25`]} style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <Dumbbell color={Colors.trainer} size={32} strokeWidth={1.5} />
            <Text style={[styles.cardImagePlaceholderText, { color: Colors.trainer }]}>{trainer.name}</Text>
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
                <Navigation color={colors.textMuted} size={12} strokeWidth={2} />
                <Text style={styles.metaText}>{trainer.distance} km away</Text>
              </View>
            )}
            {trainer.rating != null && (
              <View style={styles.metaItem}>
                <Star color="#F59E0B" size={12} fill="#F59E0B" />
                <Text style={styles.metaText}>{trainer.rating.toFixed(1)}</Text>
              </View>
            )}
            <Text style={[styles.priceLabel, { color: Colors.trainer }]}>{priceLabel}</Text>
          </View>
          <TouchableOpacity style={styles.cardCta} activeOpacity={0.88} onPress={() => router.push(`/trainer/${trainer.id}` as any)}>
            <LinearGradient colors={[Colors.trainer, colors.primaryDark]} style={styles.cardCtaGrad}>
              <Text style={styles.cardCtaText}>View Trainer</Text>
              <ChevronRight color={colors.white} size={14} strokeWidth={2.5} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEventCard = (event: EventResult) => {
    const EventSportIcon = sportIconFor(event.sport);
    const statusColor = event.status === 'ACTIVE' ? colors.success : event.status === 'UPCOMING' ? '#7C3AED' : colors.neutral400;
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
            <View style={styles.eventSportIconWrap}>
              <EventSportIcon color="#7C3AED" size={18} strokeWidth={2.2} />
            </View>
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
              <Calendar color={colors.textMuted} size={12} strokeWidth={2} />
              <Text style={styles.metaText}>{dateLabel}</Text>
            </View>
            {event.distance != null && (
              <View style={styles.metaItem}>
                <Navigation color={colors.textMuted} size={12} strokeWidth={2} />
                <Text style={styles.metaText}>{event.distance} km away</Text>
              </View>
            )}
          </View>
          {(event.teamCount != null || event.maxTeams != null) && (
            <View style={styles.metaItem}>
              <Users color={colors.textMuted} size={12} strokeWidth={2} />
              <Text style={styles.metaText}>
                {event.teamCount ?? 0}{event.maxTeams ? ` / ${event.maxTeams}` : ''} teams
              </Text>
            </View>
          )}
          <TouchableOpacity style={styles.cardCta} activeOpacity={0.88} onPress={() => router.push(`/tournament/${event.id}` as any)}>
            <LinearGradient colors={['#7C3AED', '#6D28D9']} style={styles.cardCtaGrad}>
              <Trophy color={colors.white} size={14} strokeWidth={2.5} />
              <Text style={styles.cardCtaText}>View Tournament</Text>
              <ChevronRight color={colors.white} size={14} strokeWidth={2.5} />
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
      contentContainerStyle={[styles.searchScroll, { paddingBottom: navBarHeight + 28 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Floating glass-gradient header */}
      <View style={styles.heroShadow}>
      <View style={styles.hero}>
        <LinearGradient
          colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroGlassStroke} pointerEvents="none" />

        <View style={styles.heroBrandRow}>
          <Image source={require('../../assets/logo-mark.png')} style={styles.heroLogo} resizeMode="contain" accessibilityLabel="Paasxo" />
        </View>
        <Text style={styles.heroTitle}>Discover</Text>
        <Text style={styles.heroSub}>Filter venues, games, trainers & tournaments near you</Text>
        {!!searchText.trim() && (
          <View style={styles.queryChip}>
            <Search color={colors.white} size={13} strokeWidth={2.4} />
            <Text style={styles.queryChipText} numberOfLines={1}>“{searchText.trim()}”</Text>
            <TouchableOpacity onPress={() => setSearchText('')} hitSlop={10} accessibilityLabel="Clear search text">
              <X color={colors.white} size={14} strokeWidth={2.6} />
            </TouchableOpacity>
          </View>
        )}
      </View>
      </View>

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
                <cat.Icon color={cat.color} size={22} strokeWidth={2.2} />
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

        {/* Team vs Team — open Team Match Challenges nearby, a separate flow from
            individual Games (team captains only; see TeamMatchesScreen). */}
        <TouchableOpacity
          style={styles.teamMatchEntry}
          onPress={() => router.push('/team-matches' as any)}
          activeOpacity={0.85}
        >
          <View style={styles.teamMatchEntryIcon}>
            <Swords color={colors.primary} size={20} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.teamMatchEntryTitle}>Team vs Team</Text>
            <Text style={styles.teamMatchEntrySub}>Take on nearby teams · split the cost 50/50</Text>
          </View>
          <ChevronRight color={colors.neutral400} size={18} strokeWidth={2} />
        </TouchableOpacity>

        <RadialCategoryMenu
          visible={showCategoryMenu}
          selected={category}
          onSelect={(c) => setCategory(c)}
          onClose={() => setShowCategoryMenu(false)}
        />

        {/* Sport sub-category — Venues and Games */}
        {(category === 'GAMES' || category === 'VENUES') && (
          <>
            <Text style={styles.sectionTitle}>{category === 'VENUES' ? 'Venue type' : 'Sport'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {SPORTS.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.chip, sportFilter === s.id && styles.chipActive]}
                  onPress={() => setSportFilter(s.id)}
                  activeOpacity={0.8}
                >
                  <s.Icon color={sportFilter === s.id ? colors.primary : colors.textSecondary} size={14} strokeWidth={2.2} />
                  <Text style={[styles.chipText, sportFilter === s.id && styles.chipTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Trainer specialty — only for Trainers */}
        {category === 'TRAINERS' && (
          <>
            <Text style={styles.sectionTitle}>Training type</Text>
            <View style={styles.trainerCatRow}>
              {[{ id: null as string | null, label: 'All' }, ...TRAINER_FILTERS].map((t) => {
                const active = trainerCategory === t.id;
                return (
                  <TouchableOpacity
                    key={t.id ?? 'ALL'}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setTrainerCategory(t.id)}
                    activeOpacity={0.8}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    {t.id === null && <LayoutGrid color={active ? colors.primary : colors.textSecondary} size={14} strokeWidth={2.2} />}
                    {t.id !== null && <Dumbbell color={active ? colors.primary : colors.textSecondary} size={14} strokeWidth={2.2} />}
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* When? — dates only exist for games and tournaments */}
        {(category === 'GAMES' || category === 'EVENTS') && (<>
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
                <Calendar color={active ? colors.white : colors.neutral500} size={12} strokeWidth={2} />
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
            color={dateQuick === 'CUSTOM' ? colors.white : colors.primary}
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
              <X color={colors.white} size={13} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
        </>)}

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
            <Minus color={colors.primary} size={16} strokeWidth={2.5} />
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

        {/* Where to search — type a place, or drag the map below */}
        <TouchableOpacity style={styles.areaField} onPress={() => setAreaSearchVisible(true)} activeOpacity={0.85} accessibilityRole="search">
          <Search color={colors.primary} size={16} strokeWidth={2.4} />
          <Text style={styles.areaFieldText} numberOfLines={1}>
            {usingCustomCenter ? (centerLabel ?? 'Selected area') : 'Near my location — tap to search a place'}
          </Text>
          {usingCustomCenter && (
            <TouchableOpacity onPress={resetToMyLocation} hitSlop={10} accessibilityLabel="Use my location">
              <X color={colors.textMuted} size={16} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Radius map — drag to move the search area */}
        {Platform.OS !== 'web' && MapViewComponent ? (
          <>
            <View style={styles.radiusMapWrap}>
              <MapViewComponent
                ref={radiusMapRef}
                style={StyleSheet.absoluteFillObject}
                initialRegion={regionFor(searchLatVal, searchLngVal, radiusKm)}
                pitchEnabled={false}
                rotateEnabled={false}
                showsUserLocation={userLat != null}
                onRegionChangeComplete={(r: any) => {
                  // Only a drag/zoom by the user moves the search area —
                  // our own re-framing (radius change, "use my location") must not.
                  if (programmaticMoveRef.current) { programmaticMoveRef.current = false; return; }
                  const moved = haversineKm(r.latitude, r.longitude, searchLatVal, searchLngVal);
                  if (moved > Math.max(0.05, radiusKm * 0.02)) setSearchCenter(r.latitude, r.longitude);
                }}
              >
                {CircleComponent && (
                  <CircleComponent
                    center={{ latitude: searchLatVal, longitude: searchLngVal }}
                    radius={radiusKm * 1000}
                    fillColor="rgba(64,124,240,0.12)"
                    strokeColor="rgba(64,124,240,0.55)"
                    strokeWidth={2}
                  />
                )}
              </MapViewComponent>
              <View style={styles.centerPin} pointerEvents="none">
                <MapPin color={colors.primary} size={28} strokeWidth={2.4} fill={colors.white} />
              </View>
              <View style={styles.radiusMapBadge} pointerEvents="none">
                <MapPin color={colors.primary} size={10} strokeWidth={2.5} />
                <Text style={styles.radiusMapBadgeText} numberOfLines={1}>
                  {radiusKm} km · {usingCustomCenter ? (centerLabel ?? 'Selected area') : 'Your location'}
                </Text>
              </View>
            </View>
            <View style={styles.radiusHintRow}>
              <Text style={styles.radiusHint}>Drag or zoom the map to search a different area.</Text>
              {usingCustomCenter && (
                <TouchableOpacity style={styles.myLocBtn} onPress={resetToMyLocation} activeOpacity={0.8} accessibilityRole="button">
                  <Navigation color={colors.primary} size={12} strokeWidth={2.6} />
                  <Text style={styles.myLocBtnText}>Use my location</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          <View style={styles.radiusMapFallback}>
            <MapIcon color={colors.neutral400} size={28} strokeWidth={1.5} />
            <Text style={styles.radiusMapFallbackText}>{radiusKm} km radius · map on device</Text>
          </View>
        )}

        {/* Free only — tournaments have no free/paid distinction here */}
        {category !== 'EVENTS' && (
        <TouchableOpacity
          style={styles.freeToggleRow}
          onPress={() => setFreeOnly((v) => !v)}
          activeOpacity={0.8}
        >
          <View style={styles.freeToggleLeft}>
            <DollarSign color={freeOnly ? colors.success : colors.textMuted} size={16} strokeWidth={2} />
            <View>
              <Text style={styles.freeToggleLabel}>Free only</Text>
              <Text style={styles.freeToggleSub}>
                {category === 'TRAINERS' ? 'Only trainers offering free sessions' : category === 'VENUES' ? 'Only venues with free slots' : 'Only games with no join fee'}
              </Text>
            </View>
          </View>
          <View style={[styles.toggle, freeOnly && styles.toggleOn]}>
            <View style={[styles.toggleThumb, freeOnly && styles.toggleThumbOn]} />
          </View>
        </TouchableOpacity>
        )}

        {/* Pro banner */}
        {!isPro && (
          <TouchableOpacity
            style={styles.proBanner}
            onPress={() => router.push('/subscription' as any)}
            activeOpacity={0.88}
          >
            <LinearGradient colors={['#1E293B', '#0F172A']} style={styles.proBannerGrad}>
              <Zap color={colors.warning} size={20} strokeWidth={2.5} fill={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.proBannerTitle}>Unlock Pro Access</Text>
                <Text style={styles.proBannerSub}>Priority results, unlimited invites & more</Text>
              </View>
              <ChevronRight color={colors.neutral400} size={16} strokeWidth={2} />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Show Results */}
        <TouchableOpacity style={styles.showBtn} onPress={handleShowResults} activeOpacity={0.88}>
          <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.showBtnGrad}>
            <Search color={colors.white} size={17} strokeWidth={2.5} />
            <Text style={styles.showBtnText}>Show Results</Text>
            <ChevronRight color={colors.white} size={17} strokeWidth={2.5} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <DatePickerSheet
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
          <X color={colors.text} size={20} strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.resultsCount}>
            {loading
              ? 'Searching…'
              : `${results.length}${hasMore ? '+' : ''} ${CATS.find(c => c.id === category)?.label ?? ''} found`}
          </Text>
          <Text style={styles.resultsSubtitle}>
            {userLat != null ? `Within ${radiusKm} km of you` : 'All locations'}
            {getFilterDate() ? ` · ${getFilterDate()}` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.mapToggleBtn} onPress={() => setStep('MAP')} activeOpacity={0.85}>
          <MapIcon color={colors.white} size={14} strokeWidth={2.5} />
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
              <cat.Icon color={active ? colors.white : cat.color} size={14} strokeWidth={2.2} />
              <Text numberOfLines={1} style={[styles.catSwitchText, active && styles.catSwitchTextActive]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Sub-categories for the chosen main category */}
      {(category === 'VENUES' || category === 'GAMES' || category === 'TRAINERS') && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.subCatScroll}
          contentContainerStyle={styles.catSwitchRow}
        >
          {category === 'TRAINERS'
            ? [{ id: null as string | null, label: 'All' }, ...TRAINER_FILTERS].map((t) => {
                const active = trainerCategory === t.id;
                return (
                  <TouchableOpacity
                    key={t.id ?? 'ALL'}
                    style={[styles.subCatChip, active && styles.subCatChipActive]}
                    onPress={() => setTrainerCategory(t.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.subCatText, active && styles.subCatTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })
            : SPORTS.map((sp) => {
                const active = sportFilter === sp.id;
                return (
                  <TouchableOpacity
                    key={sp.id}
                    style={[styles.subCatChip, active && styles.subCatChipActive]}
                    onPress={() => setSportFilter(sp.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.subCatText, active && styles.subCatTextActive]}>{sp.label}</Text>
                  </TouchableOpacity>
                );
              })}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <LoadingScreen
            inline
            message={`Finding ${CATS.find(c => c.id === category)?.label ?? ''} near you…`}
          />
        </View>
      ) : (
        <View style={styles.refreshableArea}>
        <PaasxoRefreshLogo refreshing={refreshing} />
        <FlatList
          style={{ flex: 1 }}
          data={results}
          keyExtractor={(item: any) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.resultsList, { paddingBottom: navBarHeight + 18 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<PaasxoRefreshControl refreshing={refreshing} onRefresh={onRefreshResults} />}
          onEndReached={loadMoreResults}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Search color={colors.neutral400} size={30} strokeWidth={1.8} />
              </View>
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
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadMoreFooter}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadMoreText}>Loading more…</Text>
              </View>
            ) : null
          }
        />
        </View>
      )}
    </View>
  );

  // ─── MAP step ─────────────────────────────────────────────────────────────
  const renderMapStep = () => {
    if (Platform.OS === 'web' || !MapViewComponent) {
      // Fixed dark gradient (not theme-reactive) — the text/icons on this
      // web map-fallback screen are fixed white, so the backdrop must stay
      // dark in both themes rather than flipping to near-white the way
      // colors.neutral800/900 (text-oriented tokens) do in dark mode.
      return (
        <LinearGradient colors={['#1E293B', '#0F172A']} style={{ flex: 1 }}>
          <SafeAreaView style={styles.mapWebHeader} edges={['top']}>
            <TouchableOpacity style={styles.mapBackBtn} onPress={() => setStep('RESULTS')} activeOpacity={0.8}>
              <X color={colors.white} size={20} strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={styles.mapWebTitle}>Map View</Text>
          </SafeAreaView>
          <View style={styles.mapWebBody}>
            <MapIcon color={colors.neutral500} size={56} strokeWidth={1.2} />
            <Text style={styles.mapWebMsg}>Map view available on iOS & Android</Text>
            <Text style={styles.mapWebSub}>{results.length} results in your area</Text>
            <TouchableOpacity style={styles.mapWebListBtn} onPress={() => setStep('RESULTS')} activeOpacity={0.88}>
              <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.mapWebListGrad}>
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
          ref={resultsMapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={regionFor(searchLatVal, searchLngVal, radiusKm)}
          showsUserLocation
          showsMyLocationButton={false}
          onRegionChangeComplete={(r: any) => {
            // Offer "Search this area" once the user has panned away from the current area.
            const away = haversineKm(r.latitude, r.longitude, searchLatVal, searchLngVal);
            setMapMovedTo(away > Math.max(0.3, radiusKm * 0.25) ? { latitude: r.latitude, longitude: r.longitude } : null);
          }}
        >
          {CircleComponent && (
            <CircleComponent
              center={{ latitude: searchLatVal, longitude: searchLngVal }}
              radius={radiusKm * 1000}
              fillColor="rgba(64,124,240,0.08)"
              strokeColor="rgba(64,124,240,0.5)"
              strokeWidth={2}
            />
          )}
          {results.map((item: any) =>
            item.latitude != null && item.longitude != null ? (
              <MarkerComponent
                key={item.id}
                coordinate={{ latitude: item.latitude, longitude: item.longitude }}
                pinColor={category === 'TRAINERS' ? Colors.trainer : category === 'EVENTS' ? '#F59E0B' : colors.primary}
                onPress={() => openSheet(item)}
                title={'name' in item ? (item as VenueResult).name : (item as GameResult).title}
              />
            ) : null
          )}
        </MapViewComponent>

        {mapMovedTo && (
          <TouchableOpacity
            style={[styles.searchAreaBtn, { top: 120 }]}
            onPress={() => { setSearchCenter(mapMovedTo.latitude, mapMovedTo.longitude); setMapMovedTo(null); }}
            activeOpacity={0.88}
            accessibilityRole="button"
          >
            <RotateCcw color={colors.white} size={14} strokeWidth={2.6} />
            <Text style={styles.searchAreaBtnText}>Search this area</Text>
          </TouchableOpacity>
        )}

        {/* Radius control on the map itself */}
        <View style={[styles.mapRadiusBar, { bottom: 34 }]}>
          {RADIUS_PRESETS.map((r) => {
            const active = radiusKm === r;
            return (
              <TouchableOpacity
                key={r}
                style={[styles.mapRadiusChip, active && { backgroundColor: colors.primary }]}
                onPress={() => {
                  setRadiusKm(r);
                  resultsMapRef.current?.animateToRegion(regionFor(searchLatVal, searchLngVal, r), 300);
                }}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${r} kilometre radius`}
              >
                <Text style={[styles.mapRadiusChipText, active && { color: colors.white }]}>{r} km</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <SafeAreaView style={styles.mapOverlay} edges={['top']}>
          <View style={styles.mapTopRow}>
            <TouchableOpacity style={styles.mapTopBtn} onPress={() => setStep('RESULTS')} activeOpacity={0.85}>
              <X color={colors.text} size={18} strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={styles.mapTopCenter}>
              <Text style={styles.mapTopCount}>
                {results.length}{hasMore ? '+' : ''} {category === 'VENUES' ? 'venues' : category === 'TRAINERS' ? 'trainers' : category === 'EVENTS' ? 'tournaments' : 'games'} · {radiusKm} km
              </Text>
            </View>
            <TouchableOpacity style={styles.mapNewSearch} onPress={() => setAreaSearchVisible(true)} activeOpacity={0.85} accessibilityRole="search">
              <Search color={colors.primary} size={13} strokeWidth={2} />
              <Text style={styles.mapNewSearchText}>Search area</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <View style={styles.mapFABs}>
          <TouchableOpacity style={styles.mapFAB} onPress={() => router.push('/create-match' as any)} activeOpacity={0.88}>
            <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.mapFABGrad}>
              <Plus color={colors.white} size={13} strokeWidth={2.5} />
              <Text style={styles.mapFABText}>Create Game</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapFABIcon} onPress={() => setStep('SEARCH')} activeOpacity={0.85}>
            <RotateCcw color={colors.text} size={16} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {selectedItem && (
          <>
            <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeSheet} activeOpacity={1} />
            <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: sheetAnim }] }]}>
              <View style={styles.sheetHandle} />
              <TouchableOpacity style={styles.sheetClose} onPress={closeSheet} activeOpacity={0.8}>
                <X color={colors.neutral500} size={16} strokeWidth={2} />
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
                  if (category === 'TRAINERS') router.push(`/trainer/${selectedItem.id}` as any);
                  else if (category === 'EVENTS') router.push(`/tournament/${selectedItem.id}` as any);
                  else if (category === 'VENUES') router.push(`/venue/${selectedItem.id}` as any);
                  else router.push(`/match/${selectedItem.id}` as any);
                }}
              >
                <LinearGradient
                  colors={'pricePerSession' in selectedItem ? [Colors.trainer, colors.primaryDark] : [colors.primary, colors.primaryDark]}
                  style={styles.sheetCtaGrad}
                >
                  <Text style={styles.sheetCtaText}>
                    {category === 'TRAINERS' ? 'View Trainer' : category === 'EVENTS' ? 'View Tournament' : category === 'VENUES' ? 'View Venue' : 'View Game'}
                  </Text>
                  <ChevronRight color={colors.white} size={16} strokeWidth={2.5} />
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
      <ScreenGlow />
      {step === 'SEARCH' && renderSearchStep()}
      {step === 'RESULTS' && renderResultsStep()}
      {step === 'MAP' && renderMapStep()}
      {step !== 'MAP' && <BottomNavbar activeTab="EXPLORE" showCreateButton={false} />}
      <AreaSearchSheet
        visible={areaSearchVisible}
        onClose={() => setAreaSearchVisible(false)}
        near={userLat != null && userLng != null ? { latitude: userLat, longitude: userLng } : null}
        onUseMyLocation={resetToMyLocation}
        onPick={(a) => {
          setSearchCenter(a.latitude, a.longitude, a.label.split(',')[0]);
          moveRadiusMap(regionFor(a.latitude, a.longitude, radiusKm), 350);
          resultsMapRef.current?.animateToRegion(regionFor(a.latitude, a.longitude, radiusKm), 350);
          setMapMovedTo(null);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  teamMatchEntry: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.cardBg, borderRadius: 16, padding: 14, marginTop: 12,
    borderWidth: 1.5, borderColor: colors.primary + '33',
  },
  teamMatchEntryIcon: {
    width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary + '14',
  },
  teamMatchEntryTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  teamMatchEntrySub: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
  safeArea: { flex: 1, backgroundColor: colors.background },

  // ── Hero
  heroShadow: {
    marginHorizontal: 12,
    marginTop: 6,
    borderRadius: 28,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  hero: {
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 28,
    borderRadius: 28,
    overflow: 'hidden',
  },
  heroGlassStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  exploreBell: {
    position: 'absolute', top: 20, right: 20, zIndex: 2,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  exploreBellBadge: {
    position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  exploreBellBadgeText: { fontSize: 9, fontWeight: '800', color: colors.white },
  heroBrandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14 },
  heroLogo: { width: 76, height: 76 },
  proBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.warning, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  proBadgeText: { fontSize: 8, fontWeight: '900', color: '#1A1A2E', letterSpacing: 0.6 },
  heroTitle: { fontSize: 30, fontWeight: '900', color: colors.white, letterSpacing: -0.4 },
  heroSub: { fontSize: 13, color: colors.white + 'CC', marginBottom: 4, marginTop: 2 },
  areaField: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.cardBg,
    borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary + '40',
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10,
  },
  areaFieldText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  subCatScroll: { flexGrow: 0, marginTop: -2, marginBottom: 6 },
  subCatChip: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 16,
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.neutral200,
  },
  subCatChipActive: { backgroundColor: colors.primary + '18', borderColor: colors.primary },
  subCatText: { fontSize: 12.5, fontWeight: '700', color: colors.textSecondary },
  subCatTextActive: { color: colors.primary, fontWeight: '800' },
  queryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%',
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, marginTop: 10,
  },
  queryChipText: { color: colors.white, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  trainerCatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  radiusHintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 8 },
  radiusHint: { flex: 1, fontSize: 12, color: colors.textMuted },
  myLocBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.primary + '14' },
  myLocBtnText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  centerPin: { position: 'absolute', left: '50%', top: '50%', marginLeft: -14, marginTop: -28 },
  mapRadiusBar: {
    position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.cardBg, borderRadius: 18, padding: 6,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
  },
  mapRadiusChip: { flex: 1, paddingVertical: 8, borderRadius: 13, alignItems: 'center' },
  mapRadiusChipText: { fontSize: 12.5, fontWeight: '800', color: colors.textSecondary },
  searchAreaBtn: {
    position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  searchAreaBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '900' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.inputBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  searchDropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
    backgroundColor: colors.cardBg, borderRadius: 14, paddingVertical: 4,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 10, maxHeight: 320, overflow: 'hidden',
  },
  searchDropdownLoading: { paddingVertical: 20, alignItems: 'center' },
  searchDropdownEmpty: { padding: 16, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  searchDropdownRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: colors.neutral200,
  },
  searchDropdownTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  searchDropdownSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  searchDropdownSeeAll: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 12,
  },
  searchDropdownSeeAllText: { fontSize: 13, fontWeight: '800', color: colors.primary },

  // ── Scroll
  searchScroll: { paddingBottom: 110 },
  pad: { paddingHorizontal: 18, paddingTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 12, marginTop: 4 },

  // ── Category
  categoryRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  categoryCard: { flex: 1, alignItems: 'center', gap: 8, padding: 16, backgroundColor: colors.cardBg, borderRadius: 18, borderWidth: 1.5, borderColor: colors.neutral200, position: 'relative', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  categoryCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  categoryEmoji: { fontSize: 28 },
  categoryLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  categoryLabelActive: { color: colors.primary, fontWeight: '800' },
  categoryDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },

  // ── Sport chips
  chipRow: { marginBottom: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.cardBg, borderRadius: 40, borderWidth: 1, borderColor: colors.neutral200, marginRight: 8 },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipEmoji: { fontSize: 13 },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.primary, fontWeight: '700' },

  // ── Date
  dateGrid: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'nowrap' },
  dateChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.neutral200 },
  dateChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dateChipText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  dateChipTextActive: { color: colors.white },

  calendarBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.primaryLight, borderRadius: 12, borderWidth: 1, borderColor: colors.primary + '50', marginBottom: 20 },
  calendarBtnActive: { backgroundColor: colors.primary },
  calendarBtnText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.primary },
  calendarBtnTextActive: { color: colors.white },

  // ── Radius
  radiusPresets: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  radiusPreset: { flex: 1, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.neutral100, borderWidth: 1, borderColor: colors.neutral200, alignItems: 'center' },
  radiusPresetActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  radiusPresetText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  radiusPresetTextActive: { color: colors.white },

  radiusTune: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 14 },
  tuneBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary + '40' },
  tuneValue: { alignItems: 'center' },
  tuneKm: { fontSize: 28, fontWeight: '900', color: colors.text, lineHeight: 32 },
  tuneUnit: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  tunePlusText: { fontSize: 22, fontWeight: '700', color: colors.primary, lineHeight: 24 },

  radiusMapWrap: { height: 200, borderRadius: 16, overflow: 'hidden', marginBottom: 16, position: 'relative' },
  radiusMapBadge: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  radiusMapBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  radiusMapFallback: { height: 80, borderRadius: 16, backgroundColor: colors.neutral100, alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16, borderWidth: 1, borderColor: colors.neutral200, flexDirection: 'row' },
  radiusMapFallbackText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },

  // ── Free toggle
  freeToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.cardBg, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.neutral200 },
  freeToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  freeToggleLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  freeToggleSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: colors.neutral200, padding: 2, justifyContent: 'center' },
  toggleOn: { backgroundColor: colors.success },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },

  // ── Pro banner
  proBanner: { borderRadius: 14, overflow: 'hidden', marginBottom: 14 },
  proBannerGrad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  proBannerTitle: { fontSize: 13, fontWeight: '800', color: colors.white, marginBottom: 2 },
  proBannerSub: { fontSize: 11, color: colors.neutral400 },

  // ── Show Results
  showBtn: { marginTop: 6, borderRadius: 16, overflow: 'hidden' },
  showBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  showBtnText: { fontSize: 16, fontWeight: '800', color: colors.white },

  // ── Results bar
  resultsBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.cardBg, borderBottomWidth: 1, borderBottomColor: colors.neutral200 },
  resultsBackBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.neutral100, alignItems: 'center', justifyContent: 'center' },
  resultsCount: { fontSize: 15, fontWeight: '800', color: colors.text },
  resultsSubtitle: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  mapToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  mapToggleBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  // ── Category switcher (results)
  catSwitchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  catSwitchChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 14, height: 36, backgroundColor: colors.neutral100,
    borderRadius: 18, borderWidth: 1.5, borderColor: 'transparent',
  },
  catSwitchText: { fontSize: 12.5, fontWeight: '700', color: colors.neutral600 },
  catSwitchTextActive: { color: colors.white, fontWeight: '800' },

  // ── Loading / empty
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  refreshableArea: { flex: 1, position: 'relative' },
  loadingText: { fontSize: 14, color: colors.textSecondary },
  resultsList: { padding: 16, paddingBottom: 100, gap: 14 },
  loadMoreFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 20 },
  loadMoreText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.neutral100,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  emptySub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  emptyBtn: { marginTop: 4, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 14 },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },

  // ── Result cards shared
  resultCard: { backgroundColor: colors.cardBg, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardImage: { width: '100%', height: 140 },
  cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  cardImagePlaceholderText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  cardBody: { padding: 14, gap: 8 },
  cardName: { fontSize: 16, fontWeight: '800', color: colors.text },
  cardLocation: { fontSize: 12, color: colors.textSecondary },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: colors.textSecondary },
  priceLabel: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },
  cardCta: { marginTop: 4, borderRadius: 12, overflow: 'hidden' },
  cardCtaGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  cardCtaText: { fontSize: 14, fontWeight: '800', color: colors.white },

  // ── Game card extras
  gameCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingBottom: 4 },
  sportBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  sportBadgeText: { fontSize: 10, fontWeight: '800', color: colors.primary },
  feeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: colors.primaryLight },
  feeBadgeFree: { backgroundColor: colors.success + '20' },
  feeText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  feeFreeText: { color: colors.success },
  fillWrap: { gap: 4 },
  fillTrack: { height: 5, backgroundColor: colors.neutral100, borderRadius: 3, overflow: 'hidden' },
  fillBar: { height: 5, backgroundColor: colors.primary, borderRadius: 3 },
  fillLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },

  // ── Map web fallback
  mapWebHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  mapBackBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.white + '20', alignItems: 'center', justifyContent: 'center' },
  mapWebTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  mapWebBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  mapWebMsg: { fontSize: 18, fontWeight: '800', color: colors.white, textAlign: 'center' },
  mapWebSub: { fontSize: 14, color: colors.neutral400, textAlign: 'center' },
  mapWebListBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8, width: 200 },
  mapWebListGrad: { paddingVertical: 14, alignItems: 'center' },
  mapWebListText: { fontSize: 15, fontWeight: '800', color: colors.white },

  // ── Map overlay
  mapOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  mapTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, marginTop: 8 },
  mapTopBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.cardBg, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  mapTopCenter: { flex: 1, backgroundColor: colors.cardBg, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  mapTopCount: { fontSize: 14, fontWeight: '800', color: colors.text, textAlign: 'center' },
  mapNewSearch: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.cardBg, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  mapNewSearchText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  mapFABs: { position: 'absolute', bottom: 100, right: 16, alignItems: 'flex-end', gap: 10 },
  mapFAB: { borderRadius: 14, overflow: 'hidden', shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  mapFABGrad: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 11 },
  mapFABText: { fontSize: 13, fontWeight: '800', color: colors.white },
  mapFABIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.cardBg, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },

  // ── Bottom sheet
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.cardBg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 14, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: -6 }, elevation: 12 },
  sheetHandle: { width: 40, height: 4, backgroundColor: colors.neutral300, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetClose: { position: 'absolute', top: 14, right: 16, width: 32, height: 32, borderRadius: 10, backgroundColor: colors.neutral100, alignItems: 'center', justifyContent: 'center' },
  sheetName: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4, paddingRight: 44 },
  sheetSub: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  sheetPrice: { fontSize: 16, fontWeight: '800', color: colors.primary, marginBottom: 12 },
  sheetCta: { marginTop: 8, borderRadius: 14, overflow: 'hidden' },
  sheetCtaGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  sheetCtaText: { fontSize: 15, fontWeight: '800', color: colors.white },

  // ── Category trigger button (replaces old tile row)
  catTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.cardBg, borderRadius: 18,
    borderWidth: 2, padding: 12, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  catTriggerIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  catTriggerHint: { fontSize: 10, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.3 },
  catTriggerLabel: { fontSize: 16, fontWeight: '900', marginTop: 1 },
  catTriggerBadge: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20,
  },
  catTriggerBadgeText: { fontSize: 11, fontWeight: '800', color: colors.white },

  // ── Category switcher scroll in results bar
  catSwitchScroll: {
    backgroundColor: colors.cardBg, borderBottomWidth: 1, borderBottomColor: colors.neutral100,
    flexGrow: 0, flexShrink: 0,
  },

  // ── Trainer card extras
  trainerBadge: {
    alignSelf: 'flex-start', backgroundColor: `${Colors.trainer}22`,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4,
  },
  trainerBadgeText: { fontSize: 9, fontWeight: '900', color: Colors.trainer, letterSpacing: 0.8 },

  // ── Event card extras
  eventCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, paddingBottom: 10,
  },
  eventCardTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  eventCardVenue: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  eventSportIconWrap: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: '#7C3AED1c',
    alignItems: 'center', justifyContent: 'center',
  },
  eventStatusBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  eventStatusText: { fontSize: 10, fontWeight: '800' },
});

// ─── Calendar styles ──────────────────────────────────────────────────────────
