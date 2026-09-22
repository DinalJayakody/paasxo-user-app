import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Search,
  Bell,
  Zap,
  Trophy,
  Calendar,
  Users,
  MapPin,
  ChevronRight,
  Clock,
  Activity,
  Filter,
  Dumbbell,
  Navigation,
  BookOpen,
  PersonStanding,
  UserCheck,
  Landmark,
} from 'lucide-react-native';
import { notificationApi } from '../api/notificationApi';
import * as Location from 'expo-location';
import { Colors, ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/Button';
import { BottomNavbar, useBottomNavBarHeight } from '../components/BottomNavbar';
import HeaderIconButton from '../components/HeaderIconButton';
import ScreenGlow from '../components/ScreenGlow';
import { PaasxoLogoLoader } from '../components/PaasxoLogoLoader';
import { PaasxoRefreshControl } from '../components/PaasxoRefreshControl';
import { PaasxoRefreshLogo } from '../components/PaasxoRefreshLogo';
import { useFloatingHeader } from '../hooks/useFloatingHeader';
import { TournamentFeedCard, TournamentFeedItem } from '../components/TournamentFeedCard';
import { bookingApi } from '../api/bookingApi';
import { tournamentApi } from '../api/tournamentApi';
import { trainerApi } from '../api/trainerApi';
import { futsalApi } from '../api/futsalApi';
import { tournamentStorage } from '../utils/tournamentStorage';
import { buildTournamentUI } from '../utils/parseTournament';
import { AuthContext } from '../context/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { activityStorage, StoredActivity } from '../api/activityApi';
import { resolveMediaUrl } from '../utils/mediaUrl';

const TRAINER_CATEGORY_LABELS: Record<string, string> = {
  GYM: 'Gym', CALISTHENICS: 'Calisthenics', DANCING: 'Dancing', YOGA: 'Yoga',
  CROSSFIT: 'CrossFit', MARTIAL_ARTS: 'Martial Arts', PILATES: 'Pilates', OTHER: 'Training',
};

interface TrainerCard {
  id: string;
  name: string;
  specialty?: string;
  location?: string;
  hourlyRate: number | null;
  imageUri?: string;
}

interface MatchCard {
  id: string;
  title: string;
  sportType?: string;
  images?: string[];
  venueName?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  startDate?: string;
  endDate?: string;
  price?: string;
  pricePerPlayer?: string;
  spotsLeft?: number;
  maxSpots?: number;
  minPlayers?: number;
  level?: string;
  joinedPlayers?: number;
  isOwn?: boolean;
  userId?: string;
  playerIds?: string[];
  status?: string;
}

// Same Haversine formula used by ExploreScreen and the backend's GeoUtils —
// kept in sync so "X km away" always matches what the nearby filter itself used.
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

type MainTab = 'MATCHES' | 'VENUES' | 'TOURNAMENTS' | 'TRAINER_SESSIONS' | 'WALKING_RUNNING';
type MatchView = 'NEARBY' | 'MY_BOOKINGS' | 'JOINED';

interface VenueCard {
  id: string;
  name: string;
  location: string;
  pricePerSlot: number | null;
  imageUri?: string;
  latitude?: number;
  longitude?: number;
}

function SportIcon({ sport, size = 28, color }: { sport: string; size?: number; color?: string }) {
  if (sport === 'FUTSAL') {
    return (
      <Image
        source={require('../../assets/futsal.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }
  if (sport === 'PICKLEBALL') {
    return (
      <Image
        source={require('../../assets/pickleball.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }
  if (sport === 'PADDLEBALL') return <Activity color={color ?? Colors.paddleball} size={size} strokeWidth={2} />;
  if (sport === 'TRAINER_GYM') return <Dumbbell color={color ?? Colors.trainer} size={size} strokeWidth={2} />;
  if (sport === 'WALKING_RUNNING') return <PersonStanding color={color ?? Colors.walkRun} size={size} strokeWidth={2} />;
  return <Activity color={color ?? Colors.cricket} size={size} strokeWidth={2} />;
}

// Module-scope helper — can't call useTheme() here, so `colors` is threaded
// in as a parameter from the component at render time. Uses the theme-aware
// palette so the tiles' tint flips to the dark-navy variants in dark mode
// instead of always resolving to the light-only static Colors.
const getSportMascots = (colors: ThemeColors) => [
  { sport: 'FUTSAL',           label: 'Futsal',    bg: colors.futsalLight,      color: colors.futsal },
  { sport: 'CRICKET',          label: 'Cricket',   bg: colors.cricketLight,     color: colors.cricket },
  { sport: 'PICKLEBALL',       label: 'Pickleball',bg: colors.pickleballLight,  color: colors.pickleball },
  { sport: 'PADDLEBALL',       label: 'Paddleball',bg: colors.paddleballLight,  color: colors.paddleball },
  { sport: 'TRAINER_GYM',      label: 'Trainer',   bg: colors.trainerLight,     color: colors.trainer },
  { sport: 'WALKING_RUNNING',  label: 'Walk/Run',  bg: colors.walkRunLight,     color: colors.walkRun },
];

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const sportMascots = useMemo(() => getSportMascots(colors), [colors]);
  const navBarHeight = useBottomNavBarHeight();
  const [searchText, setSearchText] = useState('');
  const [matches, setMatches] = useState<MatchCard[]>([]);
  const [myMatches, setMyMatches] = useState<MatchCard[]>([]);
  const [joinedMatches, setJoinedMatches] = useState<MatchCard[]>([]);
  const [matchView, setMatchView] = useState<MatchView>('NEARBY');
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingJoined, setLoadingJoined] = useState(false);
  const [joinedLoaded, setJoinedLoaded] = useState(false);
  const [tournaments, setTournaments] = useState<TournamentFeedItem[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [activeTab, setActiveTab] = useState<MainTab>('MATCHES');
  const [selectedSportFilters, setSelectedSportFilters] = useState<string[]>([]);
  const [logoError, setLogoError] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [recentActivities, setRecentActivities] = useState<StoredActivity[]>([]);
  const [nearbyTrainers, setNearbyTrainers] = useState<TrainerCard[]>([]);
  // Kept from the same GPS read loadNearbyAndMine already does for the /bookings/nearby
  // call — reused here purely for the "X km away" display, so showing distance never
  // costs an extra location request or API call.
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [loadingTrainers, setLoadingTrainers] = useState(false);
  const [loadingMoreTrainers, setLoadingMoreTrainers] = useState(false);
  const [trainersHasMore, setTrainersHasMore] = useState(false);
  const [venues, setVenues] = useState<VenueCard[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [loadingMoreVenues, setLoadingMoreVenues] = useState(false);
  const [venuesHasMore, setVenuesHasMore] = useState(false);
  // null = no active text search -> show the tracked "Tournaments Near You" list;
  // non-null = results of a live tournamentApi.filterTournaments search.
  const [tournamentResults, setTournamentResults] = useState<TournamentFeedItem[] | null>(null);
  const [loadingTournamentSearch, setLoadingTournamentSearch] = useState(false);
  const [loadingMoreTournaments, setLoadingMoreTournaments] = useState(false);
  const [tournamentSearchHasMore, setTournamentSearchHasMore] = useState(false);
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const { active: isPro } = useSubscription();

  const headerScale = useRef(new Animated.Value(0.97)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const tabIndicator = useRef(new Animated.Value(0)).current;

  // Refs mirror userLat/userLng so the search-tab loaders below can read the
  // latest GPS fix without listing it as a useCallback dependency — keeps
  // their identity stable (no re-fetch storms when location resolves mid-search)
  // while still using real coordinates once available. Page counters live in
  // refs too (not state) so "load more" always reads the true next page
  // instead of a value captured in a stale closure.
  const userLatRef = useRef<number | null>(null);
  const userLngRef = useRef<number | null>(null);
  useEffect(() => { userLatRef.current = userLat; }, [userLat]);
  useEffect(() => { userLngRef.current = userLng; }, [userLng]);
  const venuesPageRef = useRef(0);
  const trainersPageRef = useRef(0);
  const tournamentSearchPageRef = useRef(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    Animated.spring(headerScale, { toValue: 1, friction: 8, useNativeDriver: true }).start();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      notificationApi.getUnreadCount('GENERAL')
        .then(setUnreadNotifications)
        .catch(() => {});
    }, [])
  );

  useEffect(() => {
    const compute = () => {
      const h = new Date().getHours();
      if (h < 5)  return setGreeting('Good night');
      if (h < 12) return setGreeting('Good morning');
      if (h < 16) return setGreeting('Good afternoon');
      if (h < 21) return setGreeting('Good evening');
      return setGreeting('Good night');
    };
    compute();
    const timer = setInterval(compute, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    activityStorage.getAll().then((all) => setRecentActivities(all.slice(0, 3))).catch(() => {});
  }, []);

  const switchTab = (tab: MainTab) => {
    setActiveTab(tab);
    const idx = tab === 'MATCHES' ? 0 : tab === 'VENUES' ? 1 : tab === 'TOURNAMENTS' ? 2 : tab === 'TRAINER_SESSIONS' ? 3 : 4;
    Animated.spring(tabIndicator, { toValue: idx, friction: 8, useNativeDriver: false }).start();
  };

  const toggleSportFilter = (sport: string) => {
    setSelectedSportFilters((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
    );
  };

  const firstName = user?.displayName?.trim().split(' ')[0] || user?.email?.split('@')[0] || 'Player';

  const formatDateTime = (value?: string | number) => {
    if (!value) return 'TBD';
    let parsed: Date;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      parsed = new Date(y, m - 1, d);
    } else {
      parsed = new Date(value);
    }
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const parseMatches = (data: any[]): MatchCard[] =>
    data.map((item, index) => {
      const combinedStart = item.startDate || item.start ||
        (item.slotDate
          ? (item.startTime ? `${item.slotDate}T${item.startTime}` : item.slotDate)
          : undefined) ||
        item.createdAt;
      const totalBookingPrice: number | null =
        item.totalPrice != null ? Number(item.totalPrice)
        : item.price != null ? Number(item.price)
        : null;
      const maxP = item.maxSpots ?? item.totalSpots ?? item.maxPlayers;
      const perPlayer =
        totalBookingPrice != null && maxP && maxP > 0
          ? `LKR ${(totalBookingPrice / maxP).toFixed(2)}`
          : undefined;
      return {
        id: String(item.id ?? item._id ?? item.bookingId ?? index),
        title: item.title || item.matchTitle || item.name
          || (item.futsalName ? `Match at ${item.futsalName}` : null)
          || (item.venueName ? `Match at ${item.venueName}` : null)
          || 'Match',
        // Backend's BookingResponse field is `sport` — sportType/type/category never
        // exist on it, so the sport-filter chips (Futsal/Cricket/Pickleball) previously
        // always fell back to the literal 'MATCH' here and matched nothing once a chip
        // was selected, silently hiding every nearby result.
        sportType: item.sport || item.sportType || item.type || item.category || 'MATCH',
        images: Array.isArray(item.images) && item.images.length > 0
          ? item.images
          : item.imageUrl
          ? [item.imageUrl]
          : item.image
          ? [item.image]
          : item.imageBase64
          ? [`data:image/jpeg;base64,${item.imageBase64}`] // legacy fallback
          : [],
        venueName: item.futsalName || item.venue?.name || undefined,
        locationName: item.locationName || item.location || item.venue?.name || item.futsalName || 'Unknown location',
        latitude: item.latitude != null ? Number(item.latitude) : undefined,
        longitude: item.longitude != null ? Number(item.longitude) : undefined,
        startDate: combinedStart,
        endDate: item.endDate || item.end ||
          (item.slotDate && item.endTime ? `${item.slotDate}T${item.endTime}` : undefined),
        price: totalBookingPrice == null ? 'Free' : `LKR ${totalBookingPrice.toFixed(2)}`,
        pricePerPlayer: perPlayer,
        spotsLeft: item.spotsLeft ?? item.availableSpots ?? 0,
        maxSpots: maxP,
        joinedPlayers: item.joinedPlayersCount ?? item.joinedPlayers
          ?? (Array.isArray(item.players) ? item.players.length : undefined),
        minPlayers: item.minPlayers ?? item.minSpots ?? undefined,
        level: item.level || item.skillLevel || '',
        isOwn: !!user && item.userId === user.firebaseUid,
        userId: item.userId,
        status: item.status ?? item.vendorStatus ?? undefined,
        playerIds: Array.isArray(item.playerIds)
          ? item.playerIds
          : Array.isArray(item.players)
          ? item.players.map((p: any) => p.firebaseUid ?? p.firebase_uid ?? String(p.id))
          : [],
      };
    });

  const loadNearbyAndMine = React.useCallback(async () => {
    setLoadingMatches(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let coords: { latitude: number; longitude: number } | null = null;
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setUserLat(coords.latitude);
        setUserLng(coords.longitude);
      }
      // Nearby feed and "my bookings" are independent reads — run them together
      // instead of sequentially so one call's latency doesn't block the other.
      const [nearbyRaw, myRaw] = await Promise.all([
        coords
          ? bookingApi.getNearbyBookings(coords.latitude, coords.longitude, 20)
          : bookingApi.getAllBookings(),
        bookingApi.getMyBookings(),
      ]);
      setMatches(parseMatches(nearbyRaw));
      setMyMatches(parseMatches(myRaw));
    } catch {
      try {
        const myRaw = await bookingApi.getMyBookings();
        setMatches(parseMatches(myRaw));
        setMyMatches(parseMatches(myRaw));
      } catch { /* show empty */ }
    } finally {
      setLoadingMatches(false);
    }
  }, []);

  // useFocusEffect (not a plain mount-once useEffect) — Home stays mounted in the
  // bottom-tab navigator while the user creates a match (create-match -> checkout
  // -> booking-status -> match details), so a mount-once fetch would keep showing
  // the Nearby list exactly as it was BEFORE that match existed, forever, until
  // a manual pull-to-refresh. Refetching on every return to this tab is what makes
  // a freshly-created (and already-accepted) match actually show up without that.
  useFocusEffect(
    React.useCallback(() => {
      loadNearbyAndMine();
    }, [loadNearbyAndMine])
  );

  const loadJoinedMatches = React.useCallback(async () => {
    setLoadingJoined(true);
    try {
      const raw = await bookingApi.getJoinedBookings();
      setJoinedMatches(parseMatches(raw));
      setJoinedLoaded(true);
    } catch {
      setJoinedMatches([]);
      setJoinedLoaded(true);
    } finally {
      setLoadingJoined(false);
    }
  }, []);

  // Lazy-load joined matches when the user first switches to that view
  useEffect(() => {
    if (matchView !== 'JOINED' || joinedLoaded || loadingJoined) return;
    loadJoinedMatches();
  }, [matchView, joinedLoaded, loadingJoined, loadJoinedMatches]);

  const mapTrainerContent = (content: any[]): TrainerCard[] =>
    content.map((t: any) => ({
      id: String(t.id),
      name: t.trainerDisplayName ?? 'Trainer',
      specialty: Array.isArray(t.categories) && t.categories.length
        ? t.categories.map((c: string) => TRAINER_CATEGORY_LABELS[c] ?? c).join(' · ')
        : undefined,
      location: t.location,
      hourlyRate: t.hourlyRate != null ? Number(t.hourlyRate) : null,
      imageUri: resolveMediaUrl(t.profileImageUrl),
    }));

  // reset=true starts a fresh search from page 0 (replacing results) — used on
  // tab switch and on every debounced keystroke. reset=false appends the next
  // page (used by the "load more" infinite-scroll handler below).
  const loadNearbyTrainers = React.useCallback(async (query: string, reset: boolean) => {
    if (reset) setLoadingTrainers(true); else setLoadingMoreTrainers(true);
    try {
      let lat = userLatRef.current ?? undefined;
      let lng = userLngRef.current ?? undefined;
      if (lat == null) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const coords = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = coords.coords.latitude;
          lng = coords.coords.longitude;
          setUserLat(lat);
          setUserLng(lng);
        }
      }
      const pageToLoad = reset ? 0 : trainersPageRef.current + 1;
      const { content, hasMore } = await trainerApi.filterTrainers({
        query: query.trim() || undefined, lat, lng, radiusKm: 50, page: pageToLoad, size: PAGE_SIZE,
      });
      const mapped = mapTrainerContent(content);
      trainersPageRef.current = pageToLoad;
      setTrainersHasMore(hasMore);
      setNearbyTrainers((prev) => (reset ? mapped : [...prev, ...mapped]));
    } catch (err) {
      if (__DEV__) console.warn('[HomeScreen] loadNearbyTrainers failed', err);
      if (reset) setNearbyTrainers([]);
    } finally {
      if (reset) setLoadingTrainers(false); else setLoadingMoreTrainers(false);
    }
  }, []);

  const mapVenueContent = (content: any[]): VenueCard[] =>
    content.map((v: any) => ({
      id: String(v.id ?? v._id),
      name: v.name ?? 'Venue',
      location: v.location ?? v.locationName ?? '',
      pricePerSlot: v.pricePerSlot != null ? Number(v.pricePerSlot) : null,
      imageUri: resolveMediaUrl(v.imageUrl) || (v.imageBase64 ? `data:image/jpeg;base64,${v.imageBase64}` : undefined),
      latitude: v.latitude != null ? Number(v.latitude) : undefined,
      longitude: v.longitude != null ? Number(v.longitude) : undefined,
    }));

  const loadVenues = React.useCallback(async (query: string, reset: boolean) => {
    if (reset) setLoadingVenues(true); else setLoadingMoreVenues(true);
    try {
      const pageToLoad = reset ? 0 : venuesPageRef.current + 1;
      const { content, hasMore } = await futsalApi.filterVenues({
        query: query.trim() || undefined,
        lat: userLatRef.current ?? undefined,
        lng: userLngRef.current ?? undefined,
        radiusKm: 50,
        page: pageToLoad,
        size: PAGE_SIZE,
      });
      const mapped = mapVenueContent(content);
      venuesPageRef.current = pageToLoad;
      setVenuesHasMore(hasMore);
      setVenues((prev) => (reset ? mapped : [...prev, ...mapped]));
    } catch (err) {
      if (__DEV__) console.warn('[HomeScreen] loadVenues failed', err);
      if (reset) setVenues([]);
    } finally {
      if (reset) setLoadingVenues(false); else setLoadingMoreVenues(false);
    }
  }, []);

  const mapTournamentContent = (content: any[]): TournamentFeedItem[] =>
    content.map((t: any) => ({
      id: String(t.id ?? t._id),
      name: t.name ?? t.title ?? 'Tournament',
      sport: t.sport ?? 'FUTSAL',
      date: t.startDate ?? t.scheduledDate ?? t.date ?? '',
      venueName: t.futsalName ?? t.venueName ?? undefined,
      teamsCount: t.teamCount ?? (Array.isArray(t.teams) ? t.teams.length : 0),
      expectedTeams: t.maxTeams ?? 8,
      lifecycle: t.status === 'ACTIVE' ? 'LIVE' : t.status === 'COMPLETED' ? 'COMPLETED' : 'UPCOMING',
      isOwner: !!user && t.createdBy === user.firebaseUid,
    }));

  const loadTournamentSearch = React.useCallback(async (query: string, reset: boolean) => {
    if (reset) setLoadingTournamentSearch(true); else setLoadingMoreTournaments(true);
    try {
      const pageToLoad = reset ? 0 : tournamentSearchPageRef.current + 1;
      const { content, hasMore } = await tournamentApi.filterTournaments({
        query: query.trim() || undefined,
        lat: userLatRef.current ?? undefined,
        lng: userLngRef.current ?? undefined,
        radiusKm: 50,
        page: pageToLoad,
        size: PAGE_SIZE,
      });
      const mapped = mapTournamentContent(content);
      tournamentSearchPageRef.current = pageToLoad;
      setTournamentSearchHasMore(hasMore);
      setTournamentResults((prev) => (reset || !prev ? mapped : [...prev, ...mapped]));
    } catch (err) {
      if (__DEV__) console.warn('[HomeScreen] loadTournamentSearch failed', err);
      if (reset) setTournamentResults([]);
    } finally {
      if (reset) setLoadingTournamentSearch(false); else setLoadingMoreTournaments(false);
    }
  }, [user]);

  // Drives the tab-reactive search bar: switching to Venues/Tournaments/Trainer
  // fires an immediate fetch (empty query -> "near you"), and typing re-fetches
  // debounced. Matches keeps its existing client-side filter; Walk/Run has no
  // search. loadVenues/loadNearbyTrainers/loadTournamentSearch have a stable
  // ([]/[user]) identity, so this effect only re-runs on an actual tab or text
  // change — never as a side effect of the GPS fix arriving mid-search.
  useEffect(() => {
    if (activeTab === 'VENUES') {
      const delay = searchText ? 350 : 0;
      const t = setTimeout(() => loadVenues(searchText, true), delay);
      return () => clearTimeout(t);
    }
    if (activeTab === 'TOURNAMENTS') {
      if (!searchText.trim()) { setTournamentResults(null); return; }
      const t = setTimeout(() => loadTournamentSearch(searchText, true), 350);
      return () => clearTimeout(t);
    }
    if (activeTab === 'TRAINER_SESSIONS') {
      const delay = searchText ? 350 : 0;
      const t = setTimeout(() => loadNearbyTrainers(searchText, true), delay);
      return () => clearTimeout(t);
    }
  }, [activeTab, searchText, loadVenues, loadTournamentSearch, loadNearbyTrainers]);

  // Infinite scroll: called from the main ScrollView's onScroll handler when
  // the user nears the bottom while an active, has-more search tab is open.
  const loadMoreForActiveTab = React.useCallback(() => {
    if (activeTab === 'VENUES' && venuesHasMore && !loadingVenues && !loadingMoreVenues) {
      loadVenues(searchText, false);
    } else if (activeTab === 'TOURNAMENTS' && searchText.trim().length > 0
      && tournamentSearchHasMore && !loadingTournamentSearch && !loadingMoreTournaments) {
      loadTournamentSearch(searchText, false);
    } else if (activeTab === 'TRAINER_SESSIONS' && trainersHasMore && !loadingTrainers && !loadingMoreTrainers) {
      loadNearbyTrainers(searchText, false);
    }
  }, [
    activeTab, searchText,
    venuesHasMore, loadingVenues, loadingMoreVenues, loadVenues,
    tournamentSearchHasMore, loadingTournamentSearch, loadingMoreTournaments, loadTournamentSearch,
    trainersHasMore, loadingTrainers, loadingMoreTrainers, loadNearbyTrainers,
  ]);

  const onMainScroll = React.useCallback((e: any) => {
    const layoutMeasurement = e?.nativeEvent?.layoutMeasurement;
    const contentOffset = e?.nativeEvent?.contentOffset;
    const contentSize = e?.nativeEvent?.contentSize;
    if (!layoutMeasurement || !contentOffset || !contentSize) return;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 400) {
      loadMoreForActiveTab();
    }
  }, [loadMoreForActiveTab]);

  // Doc section 1.4: header hides on scroll down, reappears on scroll up.
  // onMainScroll (infinite-scroll pagination, above) still fires via this
  // hook's listener option — see useFloatingHeader's doc comment for why
  // that's threaded through rather than composed by hand here.
  const HEADER_HEIGHT = 84;
  const { translateY: headerTranslateY, onScroll: onFloatingScroll } = useFloatingHeader(HEADER_HEIGHT, onMainScroll);

  const loadTournaments = React.useCallback(async () => {
    setLoadingTournaments(true);
    try {
        const tracked = await tournamentStorage.getTracked();
        const items: TournamentFeedItem[] = [];
        for (const t of tracked.slice(0, 10)) {
          try {
            const [record, teamRecords, matchRecords] = await Promise.all([
              tournamentApi.getTournament(String(t.id)),
              tournamentApi.listTeams(String(t.id)),
              tournamentApi.listMatches(String(t.id)),
            ]);
            const overrides = await tournamentStorage.getMatchOverrides(String(t.id));
            const teamsUI = teamRecords.map((tr: any) => ({ ...tr, players: [], color: colors.primary, emoji: '⚽' }));
            const teamMap = new Map(teamsUI.map((tm: any) => [tm.id, tm]));
            const matchesUI = matchRecords.map((m: any) => ({
              ...m,
              derivedStatus: overrides[String(m.id)]?.status || m.status || 'SCHEDULED',
              teamAScore: overrides[String(m.id)]?.teamAScore ?? m.teamAScore ?? 0,
              teamBScore: overrides[String(m.id)]?.teamBScore ?? m.teamBScore ?? 0,
              teamA: teamMap.get(m.teamAId),
              teamB: teamMap.get(m.teamBId),
            }));
            const isOwner = !!user && record.createdBy === user.firebaseUid;
            const ui = buildTournamentUI({ tournament: record, teams: teamsUI, matches: matchesUI, isOwner });
            items.push({
              id: record.id,
              name: record.name,
              sport: 'FUTSAL',
              date: record.date,
              venueName: t.futsalId ? `Venue #${t.futsalId}` : undefined,
              teamsCount: teamsUI.length,
              expectedTeams: 8,
              lifecycle: ui.lifecycle,
              isOwner,
            });
          } catch { /* skip failed */ }
        }
      setTournaments(items);
    } catch {
      setTournaments([]);
    } finally {
      setLoadingTournaments(false);
    }
  }, [user]);

  useEffect(() => { loadTournaments(); }, [loadTournaments]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const tasks: Promise<any>[] = [loadNearbyAndMine(), loadTournaments()];
      if (matchView === 'JOINED') tasks.push(loadJoinedMatches());
      if (activeTab === 'TRAINER_SESSIONS') tasks.push(loadNearbyTrainers(searchText, true));
      if (activeTab === 'VENUES') tasks.push(loadVenues(searchText, true));
      if (activeTab === 'TOURNAMENTS' && searchText.trim()) tasks.push(loadTournamentSearch(searchText, true));
      await Promise.all(tasks);
    } finally {
      setRefreshing(false);
    }
  }, [loadNearbyAndMine, loadTournaments, loadJoinedMatches, loadNearbyTrainers, loadVenues, loadTournamentSearch, matchView, activeTab, searchText]);

  const renderMatchCard = (item: MatchCard) => {
    const spotsLabel = (() => {
      if (item.joinedPlayers != null && item.maxSpots != null)
        return `${item.joinedPlayers} / ${item.maxSpots} Players`;
      if (item.joinedPlayers != null)
        return `${item.joinedPlayers} Players joined`;
      if (item.maxSpots != null)
        return `${item.spotsLeft ?? 0} / ${item.maxSpots} spots`;
      return `${item.spotsLeft ?? 0} spots left`;
    })();

    const sportEmoji = item.sportType?.toLowerCase().includes('cricket') ? '🏏'
      : item.sportType?.toLowerCase().includes('pickle') ? '🏓' : '⚽';

    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.88}
        onPress={() => router.push(`/match/${item.id}`)}
        style={styles.matchCard}
      >
        <View style={styles.matchCardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <View style={[styles.sportTag, { backgroundColor: colors.primaryLight }]}>
              <Text style={styles.sportTagText}>{item.sportType?.toUpperCase()}</Text>
            </View>
            {/* Vendor status badge — shown in My Bookings */}
            {item.isOwn && (() => {
              const s = item.status ?? '';
              const isPending = s === 'PENDING_VENDOR' || s === 'PENDING';
              const isActive = s === 'ACTIVE_MATCH' || s === 'CONFIRMED';
              const isCancelled = s === 'CANCELLED';
              if (isPending) return (
                <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
                  <Text style={[styles.statusBadgeText, { color: '#92400E' }]}>⏳ Pending Venue</Text>
                </View>
              );
              if (isActive) return (
                <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}>
                  <Text style={[styles.statusBadgeText, { color: '#166534' }]}>✓ Active Match</Text>
                </View>
              );
              if (isCancelled) return (
                <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
                  <Text style={[styles.statusBadgeText, { color: '#991B1B' }]}>Cancelled</Text>
                </View>
              );
              return null;
            })()}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {item.pricePerPlayer ? (
              <>
                <Text style={styles.matchPrice}>{item.pricePerPlayer}</Text>
                <Text style={styles.matchPriceLabel}>per player</Text>
              </>
            ) : (
              <Text style={styles.matchPrice}>{item.price || 'Free'}</Text>
            )}
          </View>
        </View>

        {item.images && item.images.length > 0 ? (
          <Image source={{ uri: item.images[0] }} style={styles.matchImage} resizeMode="cover" />
        ) : (
          <LinearGradient colors={[colors.primary + '30', colors.primaryDark + '20']} style={styles.matchImagePlaceholder}>
            <Text style={styles.matchImagePlaceholderEmoji}>{sportEmoji}</Text>
            <Text style={styles.matchImagePlaceholderText}>{item.title}</Text>
          </LinearGradient>
        )}

        <View style={styles.matchDetails}>
          <Text style={styles.matchTitle}>{item.title}</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {/* could open maps */ }}
            style={styles.matchMeta}
          >
            <MapPin color={colors.primary} size={13} strokeWidth={2} />
            <Text style={[styles.matchMetaText, { color: colors.primary }]} numberOfLines={1}>
              {item.venueName ? `${item.venueName} · ${item.locationName}` : item.locationName}
            </Text>
          </TouchableOpacity>
          <View style={styles.matchMetaRow}>
            <View style={styles.matchMeta}>
              <Calendar color={colors.textMuted} size={13} strokeWidth={2} />
              <Text style={styles.matchMetaText}>{formatDateTime(item.startDate)}</Text>
            </View>
            <View style={styles.matchMeta}>
              <Users color={colors.textMuted} size={13} strokeWidth={2} />
              <Text style={styles.matchMetaText}>{spotsLabel}</Text>
            </View>
            {item.distanceKm != null && (
              <View style={styles.matchMeta}>
                <Navigation color={colors.textMuted} size={13} strokeWidth={2} />
                <Text style={styles.matchMetaText}>
                  {item.distanceKm < 1
                    ? `${Math.round(item.distanceKm * 1000)} m away`
                    : `${item.distanceKm.toFixed(1)} km away`}
                </Text>
              </View>
            )}
          </View>
          {item.minPlayers != null && (
            <View style={styles.matchMeta}>
              <Navigation color={colors.textMuted} size={13} strokeWidth={2} />
              <Text style={styles.matchMetaText}>Min {item.minPlayers} players to confirm</Text>
            </View>
          )}
          {(() => {
            const isJoined = !item.isOwn && !!user?.firebaseUid &&
              (item.playerIds ?? []).includes(user.firebaseUid);
            return (
              <Button
                title={item.isOwn ? 'View details' : isJoined ? 'Already Joined' : 'Join Game'}
                disabled={isJoined}
                onPress={() => {
                  if (isJoined) return;
                  router.push((item.isOwn ? `/match/${item.id}` : `/join-match/${item.id}`) as any);
                }}
                style={styles.joinBtn}
              />
            );
          })()}
        </View>
      </TouchableOpacity>
    );
  };

  const renderVenueCard = (venue: VenueCard) => {
    const priceLabel = venue.pricePerSlot != null ? `LKR ${venue.pricePerSlot.toFixed(2)}/slot` : 'Contact for pricing';
    const distanceKm = userLat != null && userLng != null && venue.latitude != null && venue.longitude != null
      ? haversineKm(userLat, userLng, venue.latitude, venue.longitude)
      : undefined;
    return (
      <TouchableOpacity
        key={venue.id}
        activeOpacity={0.88}
        onPress={() => router.push('/create-match' as any)}
        style={styles.matchCard}
      >
        <View style={styles.matchCardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <View style={[styles.sportTag, { backgroundColor: colors.primaryLight }]}>
              <Text style={styles.sportTagText}>VENUE</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.matchPrice}>{priceLabel}</Text>
          </View>
        </View>

        {venue.imageUri ? (
          <Image source={{ uri: venue.imageUri }} style={styles.matchImage} resizeMode="cover" />
        ) : (
          <LinearGradient colors={[colors.primary + '30', colors.primaryDark + '20']} style={styles.matchImagePlaceholder}>
            <Text style={styles.matchImagePlaceholderEmoji}>📍</Text>
            <Text style={styles.matchImagePlaceholderText}>{venue.name}</Text>
          </LinearGradient>
        )}

        <View style={styles.matchDetails}>
          <Text style={styles.matchTitle}>{venue.name}</Text>
          <View style={styles.matchMeta}>
            <MapPin color={colors.primary} size={13} strokeWidth={2} />
            <Text style={[styles.matchMetaText, { color: colors.primary }]} numberOfLines={1}>{venue.location}</Text>
          </View>
          {distanceKm != null && (
            <View style={styles.matchMetaRow}>
              <View style={styles.matchMeta}>
                <Navigation color={colors.textMuted} size={13} strokeWidth={2} />
                <Text style={styles.matchMetaText}>
                  {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m away` : `${distanceKm.toFixed(1)} km away`}
                </Text>
              </View>
            </View>
          )}
          <Button title="Book Now" onPress={() => router.push('/create-match' as any)} style={styles.joinBtn} />
        </View>
      </TouchableOpacity>
    );
  };

  // NEARBY / JOINED feeds hide pending-vendor bookings — only confirmed active matches are public.
  // MY_BOOKINGS shows everything (organizer needs to see pending status too). Nearby also
  // excludes matches the current user organized themselves — those already live under My
  // Bookings, and the point of Nearby is finding OTHER people's matches to join.
  const activeMatchSource = matchView === 'NEARBY'
    ? matches.filter((m) =>
        m.status !== 'PENDING_VENDOR' && m.status !== 'PENDING' &&
        (!user?.firebaseUid || m.userId !== user.firebaseUid)
      )
    : matchView === 'MY_BOOKINGS'
    ? myMatches
    : joinedMatches.filter((m) => m.status !== 'PENDING_VENDOR' && m.status !== 'PENDING');

  // Search matches by match title, venue name, and address/area — same text query
  // against all three fields so "CR7", "Wattala", and "Friday Futsal" all work.
  const filteredMatches = activeMatchSource
    .filter((m) => {
      const q = searchText.trim().toLowerCase();
      const textMatch = !q ||
        m.title?.toLowerCase().includes(q) ||
        m.venueName?.toLowerCase().includes(q) ||
        m.locationName?.toLowerCase().includes(q);
      const sportMatch = selectedSportFilters.length === 0 ||
        selectedSportFilters.some((s) => m.sportType?.toUpperCase() === s);
      return textMatch && sportMatch;
    })
    .map((m) => ({
      ...m,
      distanceKm:
        userLat != null && userLng != null && m.latitude != null && m.longitude != null
          ? haversineKm(userLat, userLng, m.latitude, m.longitude)
          : undefined,
    }))
    // Closest-first only makes sense for the location-driven Nearby feed — My
    // Bookings/Joined stay in the order the backend returns (most-recent-first).
    .sort((a, b) => {
      if (matchView !== 'NEARBY') return 0;
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });

  // Surfaced as a hint in the Nearby empty/list state: a booking the user just created
  // is intentionally invisible here until its venue accepts it (see BookingStatus) —
  // without this, a freshly-created match reads as "nearby is broken" instead of
  // "awaiting venue approval".
  const pendingOwnCount = myMatches.filter(
    (m) => m.status === 'PENDING_VENDOR' || m.status === 'PENDING'
  ).length;

  // A non-empty search on the Tournaments tab switches from the tracked
  // "near you" list to live server search results (tournamentResults).
  const isSearchingTournaments = activeTab === 'TOURNAMENTS' && searchText.trim().length > 0;
  const tournamentsToShow = tournamentResults ?? tournaments;
  const filteredTournaments = selectedSportFilters.length === 0
    ? tournamentsToShow
    : tournamentsToShow.filter((t) => selectedSportFilters.includes(t.sport?.toUpperCase() ?? ''));

  const tabIndicatorLeft = tabIndicator.interpolate({
    inputRange: [0, 1, 2, 3, 4],
    outputRange: ['0%', '20%', '40%', '60%', '80%'],
  });

  const searchPlaceholder =
    activeTab === 'VENUES' ? 'Search venues by name or location...'
    : activeTab === 'TOURNAMENTS' ? 'Search tournaments...'
    : activeTab === 'TRAINER_SESSIONS' ? 'Search trainers...'
    : 'Search matches by title, venue...';

  const matchViewTitle =
    matchView === 'NEARBY' ? 'Nearby Matches'
    : matchView === 'MY_BOOKINGS' ? 'My Bookings'
    : 'My Joined Matches';

  const matchViewSubtitle =
    matchView === 'NEARBY' ? 'Within 20 km of you'
    : matchView === 'MY_BOOKINGS' ? 'Matches you organised'
    : 'Matches you joined as a player';

  const isLoadingMatchView =
    loadingMatches || (matchView === 'JOINED' && loadingJoined);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenGlow />
      {/* Floating glass-gradient header — absolutely positioned so it overlays
          the scroll content (which reserves HEADER_HEIGHT of top padding,
          see scrollContent below) rather than pushing it down; hiding it on
          scroll-down then reveals more content instead of leaving a gap. */}
      <Animated.View
        style={[
          styles.topHeaderShadow,
          { opacity: headerOpacity, transform: [{ scale: headerScale }, { translateY: headerTranslateY }] },
        ]}
      >
        <View style={styles.topHeader}>
          <LinearGradient
            colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.headerGlassStroke} pointerEvents="none" />

          {logoError ? (
            <View style={[styles.logoImage, styles.logoFallback]}>
              <Text style={styles.logoFallbackText}>P.</Text>
            </View>
          ) : (
            <Image
              source={require('../../assets/logo-mark.png')}
              style={styles.logoImage}
              resizeMode="contain"
              onError={() => setLogoError(true)}
            />
          )}
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerGreeting}>{greeting}, {firstName}</Text>
            <Text style={styles.headerSubtitle}>Ready to play today?</Text>
          </View>
          <HeaderIconButton
            onPress={() => router.push('/notifications?category=GENERAL' as any)}
            style={styles.notificationBell}
          >
            <Bell color={colors.white} size={19} strokeWidth={2} />
            {unreadNotifications > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </Text>
              </View>
            )}
          </HeaderIconButton>
        </View>
      </Animated.View>

      <View style={styles.refreshableArea}>
      <PaasxoRefreshLogo refreshing={refreshing} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: HEADER_HEIGHT, paddingBottom: navBarHeight + 18 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<PaasxoRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onScroll={onFloatingScroll}
        scrollEventThrottle={16}
      >
        {/* Search + Filter — hidden on Walk/Run, which has no searchable feed */}
        {activeTab !== 'WALKING_RUNNING' && (
          <View style={styles.searchContainer}>
            <Search color={colors.textMuted} size={18} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={searchText}
              onChangeText={setSearchText}
            />
            <TouchableOpacity
              onPress={() => router.push('/explore')}
              activeOpacity={0.8}
              style={styles.searchFilterBtn}
            >
              <Filter color={colors.primary} size={18} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        )}

        {/* Sport filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sportRow}>
          {sportMascots.map((s) => {
            const active = selectedSportFilters.includes(s.sport);
            return (
              <TouchableOpacity
                key={s.sport}
                style={[
                  styles.sportMascot,
                  { backgroundColor: active ? s.color : s.bg },
                  active && styles.sportMascotActive,
                ]}
                onPress={() => toggleSportFilter(s.sport)}
                activeOpacity={0.8}
              >
                <View style={styles.sportIconWrap}>
                  <SportIcon sport={s.sport} size={26} color={active ? colors.white : s.color} />
                </View>
                <Text style={[styles.sportMascotLabel, { color: active ? colors.white : s.color }]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Tab Bar ─────────────────────────────────────────────── */}
        <View style={styles.tabBarWrap}>
          <View style={styles.tabBar}>
            <Animated.View style={[styles.tabIndicator, styles.tabIndicator5, { left: tabIndicatorLeft }]} />
            <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('MATCHES')} activeOpacity={0.8}>
              <Trophy color={activeTab === 'MATCHES' ? colors.primary : colors.neutral400} size={16} strokeWidth={2.5} />
              <Text numberOfLines={1} style={[styles.tabLabel, activeTab === 'MATCHES' && styles.tabLabelActive]}>Matches</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('VENUES')} activeOpacity={0.8}>
              <Landmark color={activeTab === 'VENUES' ? colors.primary : colors.neutral400} size={16} strokeWidth={2.5} />
              <Text numberOfLines={1} style={[styles.tabLabel, activeTab === 'VENUES' && styles.tabLabelActive]}>Venues</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('TOURNAMENTS')} activeOpacity={0.8}>
              <Activity color={activeTab === 'TOURNAMENTS' ? colors.primary : colors.neutral400} size={16} strokeWidth={2.5} />
              <Text numberOfLines={1} style={[styles.tabLabel, activeTab === 'TOURNAMENTS' && styles.tabLabelActive]}>Tournaments</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('TRAINER_SESSIONS')} activeOpacity={0.8}>
              <Dumbbell color={activeTab === 'TRAINER_SESSIONS' ? colors.trainer : colors.neutral400} size={16} strokeWidth={2.5} />
              <Text numberOfLines={1} style={[styles.tabLabel, activeTab === 'TRAINER_SESSIONS' && styles.tabLabelTrainer]}>Trainer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('WALKING_RUNNING')} activeOpacity={0.8}>
              <PersonStanding color={activeTab === 'WALKING_RUNNING' ? colors.walkRun : colors.neutral400} size={16} strokeWidth={2.5} />
              <Text numberOfLines={1} style={[styles.tabLabel, activeTab === 'WALKING_RUNNING' && styles.tabLabelWalk]}>Walk/Run</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── MATCHES TAB ─────────────────────────────────────────── */}
        {activeTab === 'MATCHES' && (
          <>
            {/* Pro banner */}
            {/* Fixed dark gradient (not theme-reactive) — this is a permanent
                "premium/dark" promo card whose text (proBannerTitle) is fixed
                white, so the backdrop must stay dark in both themes rather
                than flipping to near-white the way colors.neutral800/900
                (text-oriented tokens) do in dark mode. */}
            {!isPro && (
              <LinearGradient colors={['#1E293B', '#0F172A']} style={styles.proBanner}>
                <View style={styles.proBannerContent}>
                  <Zap color={colors.warning} size={22} strokeWidth={2.5} fill={colors.warning} />
                  <View style={styles.proBannerText}>
                    <Text style={styles.proBannerLabel}>PRO MEMBER EXCLUSIVE</Text>
                    <Text style={styles.proBannerTitle}>Unlock Your Full Potential</Text>
                    <Text style={styles.proBannerDesc}>
                      Access Pro trainers, create unlimited matches, save 15% on all bookings.
                    </Text>
                  </View>
                </View>
                <Button title="Upgrade to Pro" onPress={() => router.push('/subscription' as any)} variant="secondary" style={styles.upgradeBtn} />
              </LinearGradient>
            )}

            {/* Section title */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{matchViewTitle}</Text>
                <Text style={styles.sectionSubtitle}>{matchViewSubtitle}</Text>
              </View>
            </View>

            {/* 3-way segment control: Nearby | My Bookings | Joined */}
            <View style={styles.matchSegment}>
              <TouchableOpacity
                style={[styles.segmentPill, matchView === 'NEARBY' && styles.segmentPillActive]}
                onPress={() => setMatchView('NEARBY')}
                activeOpacity={0.75}
              >
                <MapPin
                  size={11}
                  color={matchView === 'NEARBY' ? colors.white : colors.textMuted}
                  strokeWidth={2}
                />
                <Text style={[styles.segmentText, matchView === 'NEARBY' && styles.segmentTextActive]}>
                  Nearby
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentPill, matchView === 'MY_BOOKINGS' && styles.segmentPillActive]}
                onPress={() => setMatchView('MY_BOOKINGS')}
                activeOpacity={0.75}
              >
                <BookOpen
                  size={11}
                  color={matchView === 'MY_BOOKINGS' ? colors.white : colors.textMuted}
                  strokeWidth={2}
                />
                <Text style={[styles.segmentText, matchView === 'MY_BOOKINGS' && styles.segmentTextActive]}>
                  My Bookings
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentPill, matchView === 'JOINED' && styles.segmentPillActive]}
                onPress={() => setMatchView('JOINED')}
                activeOpacity={0.75}
              >
                <UserCheck
                  size={11}
                  color={matchView === 'JOINED' ? colors.white : colors.textMuted}
                  strokeWidth={2}
                />
                <Text style={[styles.segmentText, matchView === 'JOINED' && styles.segmentTextActive]}>
                  Joined
                </Text>
              </TouchableOpacity>
            </View>

            {/* Pending-approval hint — a freshly-created match is intentionally hidden from
                Nearby (and from every other player) until its venue accepts the request, so
                without this callout an organizer reasonably reads that as "nearby is broken"
                instead of "awaiting venue approval". Only relevant in the Nearby view since
                My Bookings already shows the ⏳ Pending Venue badge on the card itself. */}
            {matchView === 'NEARBY' && pendingOwnCount > 0 && (
              <TouchableOpacity
                style={styles.pendingHint}
                activeOpacity={0.85}
                onPress={() => setMatchView('MY_BOOKINGS')}
              >
                <Clock color={colors.warning} size={15} strokeWidth={2.2} />
                <Text style={styles.pendingHintText}>
                  {pendingOwnCount === 1
                    ? 'You have 1 match awaiting venue approval — it\'ll appear here once accepted.'
                    : `You have ${pendingOwnCount} matches awaiting venue approval — they'll appear here once accepted.`}
                </Text>
                <ChevronRight color={colors.warning} size={15} strokeWidth={2.2} />
              </TouchableOpacity>
            )}

            {/* Match cards */}
            {isLoadingMatchView ? (
              <View style={styles.loadingContainer}>
                <PaasxoLogoLoader size={40} elevated={false} />
              </View>
            ) : filteredMatches.length > 0 ? (
              filteredMatches.map((match) => renderMatchCard(match))
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Trophy color={colors.neutral400} size={36} strokeWidth={1.5} />
                </View>
                <Text style={styles.emptyStateTitle}>
                  {matchView === 'JOINED' ? 'No joined matches'
                    : matchView === 'NEARBY' ? 'No public matches nearby'
                    : 'No active bookings'}
                </Text>
                <Text style={styles.emptyStateText}>
                  {searchText
                    ? 'No matches found for your search.'
                    : matchView === 'JOINED'
                    ? 'Accept an invitation or join a nearby match to see it here.'
                    : matchView === 'MY_BOOKINGS'
                    ? 'Create a match to get started!'
                    : userLat == null
                    ? 'Enable location access so we can find matches near you.'
                    : 'No public matches within 20 km of you right now. Be the first to create one!'}
                </Text>
                {matchView !== 'JOINED' && (
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() => router.push('/create-match' as any)}
                    activeOpacity={0.85}
                  >
                    <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.emptyActionGrad}>
                      <Text style={styles.emptyActionText}>Create a Match</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}

        {/* ── VENUES TAB ──────────────────────────────────────────── */}
        {activeTab === 'VENUES' && (
          <>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{searchText.trim() ? 'Search Results' : 'Venues Near You'}</Text>
                <Text style={styles.sectionSubtitle}>
                  {searchText.trim() ? `Venues matching "${searchText.trim()}"` : 'Book futsal, cricket & more'}
                </Text>
              </View>
            </View>

            {loadingVenues ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Finding venues...</Text>
              </View>
            ) : venues.length > 0 ? (
              <>
                {venues.map((v) => renderVenueCard(v))}
                {loadingMoreVenues && (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <MapPin color={colors.neutral400} size={36} strokeWidth={1.5} />
                </View>
                <Text style={styles.emptyStateTitle}>No venues found</Text>
                <Text style={styles.emptyStateText}>
                  {searchText.trim() ? 'Try a different venue name or location.' : 'No venues available near you right now.'}
                </Text>
              </View>
            )}
          </>
        )}

        {/* ── TOURNAMENTS TAB ─────────────────────────────────────── */}
        {activeTab === 'TOURNAMENTS' && (
          <>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{isSearchingTournaments ? 'Search Results' : 'Tournaments Near You'}</Text>
                <Text style={styles.sectionSubtitle}>
                  {isSearchingTournaments ? `Tournaments matching "${searchText.trim()}"` : 'Discover and join open tournaments'}
                </Text>
              </View>
              <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/tournaments' as any)}>
                <Text style={styles.seeAllText}>All →</Text>
              </TouchableOpacity>
            </View>

            {(isSearchingTournaments ? loadingTournamentSearch : loadingTournaments) ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Finding tournaments...</Text>
              </View>
            ) : filteredTournaments.length > 0 ? (
              <>
                {filteredTournaments.map((t) => (
                  <TournamentFeedCard
                    key={t.id}
                    tournament={t}
                    onPress={() => router.push(`/tournament/${t.id}` as any)}
                  />
                ))}
                {isSearchingTournaments && loadingMoreTournaments && (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
                )}
              </>
            ) : isSearchingTournaments ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Trophy color={colors.neutral400} size={36} strokeWidth={1.5} />
                </View>
                <Text style={styles.emptyStateTitle}>No tournaments found</Text>
                <Text style={styles.emptyStateText}>Try a different tournament or venue name.</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.createTournamentPrompt}
                activeOpacity={0.88}
                onPress={() => router.push('/create-tournament' as any)}
              >
                <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.createTournamentGrad}>
                  <Trophy color={colors.white} size={28} strokeWidth={2} />
                  <View>
                    <Text style={styles.createTournamentTitle}>Host a Tournament</Text>
                    <Text style={styles.createTournamentSubtitle}>Create your own and invite teams</Text>
                  </View>
                  <ChevronRight color={colors.white} size={20} strokeWidth={2.5} />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── TRAINER SESSIONS TAB ────────────────────────────────── */}
        {activeTab === 'TRAINER_SESSIONS' && (
          <>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{searchText.trim() ? 'Search Results' : 'Trainer Sessions'}</Text>
                <Text style={styles.sectionSubtitle}>
                  {searchText.trim() ? `Trainers matching "${searchText.trim()}"` : 'Book 1-on-1 or group training'}
                </Text>
              </View>
              <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/explore' as any)}>
                <Text style={styles.seeAllText}>See all →</Text>
              </TouchableOpacity>
            </View>

            {loadingTrainers ? (
              <ActivityIndicator color={colors.trainer} style={{ marginTop: 24 }} />
            ) : nearbyTrainers.length === 0 && searchText.trim() ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Dumbbell color={colors.neutral400} size={36} strokeWidth={1.5} />
                </View>
                <Text style={styles.emptyStateTitle}>No trainers found</Text>
                <Text style={styles.emptyStateText}>Try a different trainer name or specialty.</Text>
              </View>
            ) : nearbyTrainers.length === 0 ? (
              <TouchableOpacity
                style={styles.createTournamentPrompt}
                activeOpacity={0.88}
                onPress={() => router.push('/explore' as any)}
              >
                <LinearGradient colors={[colors.trainer, colors.primaryDark]} style={styles.createTournamentGrad}>
                  <Dumbbell color={colors.white} size={28} strokeWidth={2} />
                  <View>
                    <Text style={styles.createTournamentTitle}>Find a Trainer</Text>
                    <Text style={styles.createTournamentSubtitle}>Personal &amp; group sessions available</Text>
                  </View>
                  <ChevronRight color={colors.white} size={20} strokeWidth={2.5} />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <>
                {nearbyTrainers.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.trainerCard}
                    activeOpacity={0.88}
                    onPress={() => router.push(`/trainer/${t.id}` as any)}
                  >
                    {t.imageUri ? (
                      <Image source={{ uri: t.imageUri }} style={styles.trainerCardImage} />
                    ) : (
                      <LinearGradient colors={[colors.trainerLight, colors.trainerLight]} style={styles.trainerCardImage}>
                        <Dumbbell color={colors.trainer} size={22} strokeWidth={2} />
                      </LinearGradient>
                    )}
                    <View style={styles.trainerCardBody}>
                      <Text style={styles.trainerCardName} numberOfLines={1}>{t.name}</Text>
                      {!!t.specialty && <Text style={styles.trainerCardSpecialty} numberOfLines={1}>{t.specialty}</Text>}
                      {!!t.location && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <MapPin color={colors.textMuted} size={11} strokeWidth={2} />
                          <Text style={styles.trainerCardMeta} numberOfLines={1}>{t.location}</Text>
                        </View>
                      )}
                    </View>
                    {t.hourlyRate != null && (
                      <Text style={styles.trainerCardPrice}>LKR {t.hourlyRate}</Text>
                    )}
                    <ChevronRight color={colors.trainer} size={16} strokeWidth={2.5} />
                  </TouchableOpacity>
                ))}
                {loadingMoreTrainers && (
                  <ActivityIndicator color={colors.trainer} style={{ marginVertical: 16 }} />
                )}
              </>
            )}
          </>
        )}

        {/* ── WALK / RUN / CYCLING TAB ────────────────────────────── */}
        {activeTab === 'WALKING_RUNNING' && (
          <>
            {/* Start activity hero card */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => router.push('/activity-tracker' as any)}
            >
              <LinearGradient
                colors={['#059669', '#047857', '#065F46']}
                style={styles.activityHero}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                <View style={styles.activityHeroLeft}>
                  <Text style={styles.activityHeroEmoji}>🏃</Text>
                  <View>
                    <Text style={styles.activityHeroTitle}>Start Activity</Text>
                    <Text style={styles.activityHeroSub}>Walk · Run · Cycling</Text>
                  </View>
                </View>
                <View style={styles.activityHeroRight}>
                  <View style={styles.activityStartCircle}>
                    <ChevronRight color="#059669" size={20} strokeWidth={3} />
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Activity type quick picks */}
            <View style={styles.activityTypeRow}>
              {([['🚶', 'Walk'], ['🏃', 'Run'], ['🚴', 'Cycle']] as [string, string][]).map(([emoji, label]) => (
                <TouchableOpacity
                  key={label}
                  style={styles.activityTypeChip}
                  activeOpacity={0.8}
                  onPress={() => router.push('/activity-tracker' as any)}
                >
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                  <Text style={styles.activityTypeChipLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Recent activities */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Recent Activities</Text>
                <Text style={styles.sectionSubtitle}>Your latest tracked sessions</Text>
              </View>
              <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/activity-history' as any)}>
                <Text style={styles.seeAllText}>All →</Text>
              </TouchableOpacity>
            </View>

            {recentActivities.length === 0 ? (
              <View style={styles.activityEmptyBox}>
                <Text style={{ fontSize: 40, marginBottom: 10 }}>👟</Text>
                <Text style={styles.activityEmptyTitle}>No activities yet</Text>
                <Text style={styles.activityEmptyBody}>
                  Tap "Start Activity" above to record your first walk, run, or cycling session. Your GPS route, distance, speed and more will be saved automatically!
                </Text>
              </View>
            ) : (
              recentActivities.map((act) => {
                const ACT_EMOJI: Record<string, string> = { WALK: '🚶', RUN: '🏃', CYCLING: '🚴' };
                const ACT_COLOR: Record<string, string> = { WALK: '#059669', RUN: '#DC2626', CYCLING: '#2563EB' };
                const dist = act.distanceMeters < 1000
                  ? `${Math.round(act.distanceMeters)} m`
                  : `${(act.distanceMeters / 1000).toFixed(2)} km`;
                const mins = Math.floor(act.durationSeconds / 60);
                const color = ACT_COLOR[act.type] ?? colors.walkRun;
                return (
                  <TouchableOpacity
                    key={act.localId}
                    style={styles.recentActCard}
                    activeOpacity={0.88}
                    onPress={() => router.push(`/activity/${act.localId}` as any)}
                  >
                    <View style={[styles.recentActBar, { backgroundColor: color }]} />
                    <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 16 }}>{ACT_EMOJI[act.type]}</Text>
                          <Text style={[styles.recentActType, { color }]}>{act.type}</Text>
                        </View>
                        <Text style={styles.recentActDate}>
                          {new Date(act.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                      <Text style={styles.recentActTitle}>{act.title}</Text>
                      <View style={{ flexDirection: 'row', gap: 14, marginTop: 4 }}>
                        <Text style={styles.recentActStat}>{dist}</Text>
                        <Text style={styles.recentActStat}>{mins} min</Text>
                        <Text style={styles.recentActStat}>{act.avgSpeedKmh.toFixed(1)} km/h</Text>
                      </View>
                    </View>
                    <ChevronRight color={colors.neutral400} size={16} style={{ marginRight: 12, alignSelf: 'center' }} />
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </ScrollView>
      </View>

      <BottomNavbar activeTab="EXPLORE" showCreateButton={false} />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },

  topHeaderShadow: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 20,
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
  topHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 26,
    overflow: 'hidden',
    gap: 12,
  },
  headerGlassStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  logoImage: { width: 44, height: 44 },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  logoFallbackText: { fontSize: 18, fontWeight: '900', color: colors.white },
  headerTextContainer: { flex: 1 },
  headerGreeting: { fontSize: 18, fontWeight: '800', color: colors.white },
  headerSubtitle: { fontSize: 12, color: colors.white + 'CC', marginTop: 2 },
  notificationBell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.white,
  },
  scroll: { flex: 1 },
  refreshableArea: { flex: 1, position: 'relative' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 14 },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.inputBg, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11,
    marginBottom: 14, borderWidth: 1, borderColor: colors.neutral200,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: colors.text },
  searchFilterBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 6,
  },

  sportRow: { marginBottom: 16 },
  sportMascot: {
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
    width: 76, height: 76, borderRadius: 18, gap: 4,
  },
  sportMascotActive: {
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  sportIconWrap: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  sportMascotLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  // Tab bar
  tabBarWrap: { marginBottom: 20 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    padding: 5,
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  tabIndicator: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    width: '50%',
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
  },
  tabIndicator5: { width: '20%' },
  tabLabelTrainer: { color: colors.trainer },
  tabLabelWalk: { color: colors.walkRun },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 11,
    paddingHorizontal: 2,
    borderRadius: 14,
    zIndex: 1,
  },
  tabLabel: { fontSize: 10.5, fontWeight: '700', color: colors.neutral400, letterSpacing: 0.1 },
  tabLabelActive: { color: colors.primary },

  proBanner: {
    borderRadius: 18, padding: 16, marginBottom: 22, gap: 12,
  },
  proBannerContent: { flexDirection: 'row', gap: 12 },
  proBannerText: { flex: 1, gap: 4 },
  proBannerLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: colors.warning, textTransform: 'uppercase' },
  proBannerTitle: { fontSize: 16, fontWeight: '800', color: colors.white },
  proBannerDesc: { fontSize: 12, color: '#CBD5E1', lineHeight: 17 },
  upgradeBtn: { width: '100%' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: 12, marginTop: 4,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  sectionSubtitle: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: '500' },
  seeAllText: { fontSize: 13, fontWeight: '600', color: colors.primary, marginTop: 4 },

  // 3-way segment control
  matchSegment: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  segmentPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 22,
    backgroundColor: colors.neutral100,
    borderWidth: 1,
    borderColor: colors.neutral200,
  },
  segmentPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.white,
  },

  pendingHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warning + '1A',
    borderWidth: 1,
    borderColor: colors.warning + '40',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  pendingHintText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    color: colors.text,
  },

  createTournamentPrompt: { borderRadius: 18, overflow: 'hidden', marginBottom: 14 },
  createTournamentGrad: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  createTournamentTitle: { fontSize: 15, fontWeight: '800', color: colors.white },
  createTournamentSubtitle: { fontSize: 12, color: colors.white + 'CC', marginTop: 2 },

  matchCard: {
    backgroundColor: colors.cardBg, borderRadius: 18, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3, overflow: 'hidden',
  },
  trainerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.cardBg,
    borderRadius: 16, padding: 10, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  trainerCardImage: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  trainerCardBody: { flex: 1 },
  trainerCardName: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  trainerCardSpecialty: { fontSize: 12, color: colors.trainer, fontWeight: '600', marginTop: 1 },
  trainerCardMeta: { fontSize: 11.5, color: colors.textMuted },
  trainerCardPrice: { fontSize: 13, fontWeight: '800', color: colors.trainer, marginRight: 2 },
  matchCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingBottom: 10, gap: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  sportTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  sportTagText: { fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.6 },
  matchPrice: { fontSize: 14, fontWeight: '700', color: colors.primaryDark },
  matchPriceLabel: { fontSize: 10, color: colors.textMuted, marginTop: -2 },
  matchImage: { width: '100%', height: 140 },
  matchImagePlaceholder: {
    width: '100%', height: 120, alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16,
  },
  matchImagePlaceholderEmoji: { fontSize: 36 },
  matchImagePlaceholderText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  matchDetails: { padding: 14, gap: 8 },
  matchTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  matchMetaRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  matchMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  matchMetaText: { fontSize: 12, color: colors.textMuted },
  joinBtn: { height: 42, marginTop: 4 },

  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  loadingText: { fontSize: 13, color: colors.textMuted },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.neutral100,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyStateText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
  emptyActionBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  emptyActionGrad: { paddingHorizontal: 28, paddingVertical: 14 },
  emptyActionText: { fontSize: 14, fontWeight: '700', color: colors.white },

  // Walk/Run/Cycling tab
  activityHero: {
    borderRadius: 20, padding: 20, marginBottom: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  activityHeroLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  activityHeroEmoji: { fontSize: 40 },
  activityHeroTitle: { fontSize: 20, fontWeight: '900', color: colors.white },
  activityHeroSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontWeight: '600' },
  activityHeroRight: {},
  activityStartCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.cardBg,
    alignItems: 'center', justifyContent: 'center',
  },

  activityTypeRow: {
    flexDirection: 'row', gap: 10, marginBottom: 20,
  },
  activityTypeChip: {
    flex: 1, backgroundColor: colors.cardBg,
    borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
    borderWidth: 1.5, borderColor: colors.neutral200,
  },
  activityTypeChipLabel: { fontSize: 13, fontWeight: '800', color: colors.neutral700 },

  activityEmptyBox: {
    backgroundColor: colors.cardBg, borderRadius: 18,
    padding: 24, alignItems: 'center', marginBottom: 16,
    borderWidth: 1.5, borderColor: colors.neutral200,
  },
  activityEmptyTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 8 },
  activityEmptyBody: {
    fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19,
  },

  recentActCard: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: colors.cardBg, borderRadius: 16,
    marginBottom: 10, overflow: 'hidden',
    borderWidth: 1.5, borderColor: colors.neutral200,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  recentActBar: { width: 5 },
  recentActType: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  recentActTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  recentActDate: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  recentActStat: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
});
