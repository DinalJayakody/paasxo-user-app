import React, { useState, useEffect, useContext, useRef } from 'react';
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
} from 'lucide-react-native';
import { notificationApi } from '../api/notificationApi';
import * as Location from 'expo-location';
import { Colors } from '../styles/colors';
import { Button } from '../components/Button';
import { BottomNavbar } from '../components/BottomNavbar';
import { TournamentFeedCard, TournamentFeedItem } from '../components/TournamentFeedCard';
import { bookingApi } from '../api/bookingApi';
import { tournamentApi } from '../api/tournamentApi';
import { tournamentStorage } from '../utils/tournamentStorage';
import { buildTournamentUI } from '../utils/parseTournament';
import { AuthContext } from '../context/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { activityStorage, StoredActivity } from '../api/activityApi';

interface MatchCard {
  id: string;
  title: string;
  sportType?: string;
  images?: string[];
  locationName?: string;
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

type MainTab = 'MATCHES' | 'TOURNAMENTS' | 'TRAINER_SESSIONS' | 'WALKING_RUNNING';
type MatchView = 'NEARBY' | 'MY_BOOKINGS' | 'JOINED';

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

const SPORT_MASCOTS = [
  { sport: 'FUTSAL',           label: 'Futsal',    bg: Colors.futsalLight,      color: Colors.futsal },
  { sport: 'CRICKET',          label: 'Cricket',   bg: Colors.cricketLight,     color: Colors.cricket },
  { sport: 'PICKLEBALL',       label: 'Pickleball',bg: Colors.pickleballLight,  color: Colors.pickleball },
  { sport: 'PADDLEBALL',       label: 'Paddleball',bg: Colors.paddleballLight,  color: Colors.paddleball },
  { sport: 'TRAINER_GYM',      label: 'Trainer',   bg: Colors.trainerLight,     color: Colors.trainer },
  { sport: 'WALKING_RUNNING',  label: 'Walk/Run',  bg: Colors.walkRunLight,     color: Colors.walkRun },
];

export default function HomeScreen() {
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
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const { active: isPro } = useSubscription();

  const headerScale = useRef(new Animated.Value(0.97)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const tabIndicator = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(headerScale, { toValue: 1, friction: 8, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    notificationApi.getUnreadCount()
      .then(setUnreadNotifications)
      .catch(() => {});
  }, []);

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
    const idx = tab === 'MATCHES' ? 0 : tab === 'TOURNAMENTS' ? 1 : tab === 'TRAINER_SESSIONS' ? 2 : 3;
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
        sportType: item.sportType || item.type || item.category || 'MATCH',
        images: Array.isArray(item.images) && item.images.length > 0
          ? item.images
          : item.image
          ? [item.image]
          : item.imageBase64
          ? [`data:image/jpeg;base64,${item.imageBase64}`]
          : [],
        locationName: item.locationName || item.location || item.venue?.name || item.futsalName || 'Unknown location',
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

  useEffect(() => {
    const loadNearbyAndMine = async () => {
      setLoadingMatches(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        let nearbyRaw: any[];
        if (status === 'granted') {
          const coords = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          nearbyRaw = await bookingApi.getNearbyBookings(coords.coords.latitude, coords.coords.longitude, 20);
        } else {
          nearbyRaw = await bookingApi.getAllBookings();
        }
        setMatches(parseMatches(nearbyRaw));
        const myRaw = await bookingApi.getMyBookings();
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
    };
    loadNearbyAndMine();
  }, []);

  // Lazy-load joined matches when the user first switches to that view
  useEffect(() => {
    if (matchView !== 'JOINED' || joinedLoaded || loadingJoined) return;
    const load = async () => {
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
    };
    load();
  }, [matchView]);

  useEffect(() => {
    const loadTournaments = async () => {
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
            const teamsUI = teamRecords.map((tr: any) => ({ ...tr, players: [], color: Colors.primary, emoji: '⚽' }));
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
    };
    loadTournaments();
  }, [user]);

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
            <View style={[styles.sportTag, { backgroundColor: Colors.primaryLight }]}>
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
          <LinearGradient colors={[Colors.primary + '30', Colors.primaryDark + '20']} style={styles.matchImagePlaceholder}>
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
            <MapPin color={Colors.primary} size={13} strokeWidth={2} />
            <Text style={[styles.matchMetaText, { color: Colors.primary }]}>{item.locationName}</Text>
          </TouchableOpacity>
          <View style={styles.matchMetaRow}>
            <View style={styles.matchMeta}>
              <Calendar color={Colors.textMuted} size={13} strokeWidth={2} />
              <Text style={styles.matchMetaText}>{formatDateTime(item.startDate)}</Text>
            </View>
            <View style={styles.matchMeta}>
              <Users color={Colors.textMuted} size={13} strokeWidth={2} />
              <Text style={styles.matchMetaText}>{spotsLabel}</Text>
            </View>
          </View>
          {item.minPlayers != null && (
            <View style={styles.matchMeta}>
              <Navigation color={Colors.textMuted} size={13} strokeWidth={2} />
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

  // NEARBY / JOINED feeds hide pending-vendor bookings — only confirmed active matches are public.
  // MY_BOOKINGS shows everything (organizer needs to see pending status too).
  const activeMatchSource = matchView === 'NEARBY'
    ? matches.filter((m) => m.status !== 'PENDING_VENDOR' && m.status !== 'PENDING')
    : matchView === 'MY_BOOKINGS'
    ? myMatches
    : joinedMatches.filter((m) => m.status !== 'PENDING_VENDOR' && m.status !== 'PENDING');

  const filteredMatches = activeMatchSource.filter((m) => {
    const textMatch = !searchText ||
      m.title?.toLowerCase().includes(searchText.toLowerCase()) ||
      m.locationName?.toLowerCase().includes(searchText.toLowerCase());
    const sportMatch = selectedSportFilters.length === 0 ||
      selectedSportFilters.some((s) => m.sportType?.toUpperCase() === s);
    return textMatch && sportMatch;
  });

  const filteredTournaments = selectedSportFilters.length === 0
    ? tournaments
    : tournaments.filter((t) => selectedSportFilters.includes(t.sport?.toUpperCase() ?? ''));

  const tabIndicatorLeft = tabIndicator.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: ['0%', '25%', '50%', '75%'],
  });

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
      {/* Blue header */}
      <Animated.View style={[styles.topHeader, { opacity: headerOpacity, transform: [{ scale: headerScale }] }]}>
        {logoError ? (
          <View style={[styles.logoImage, styles.logoFallback]}>
            <Text style={styles.logoFallbackText}>P.</Text>
          </View>
        ) : (
          <Image
            source={require('../../assets/logo.jpeg')}
            style={styles.logoImage}
            resizeMode="contain"
            onError={() => setLogoError(true)}
          />
        )}
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerGreeting}>{greeting}, {firstName}</Text>
          <Text style={styles.headerSubtitle}>Ready to play today?</Text>
        </View>
        <TouchableOpacity
          style={styles.notificationBell}
          onPress={() => router.push('/notifications' as any)}
        >
          <Bell color={Colors.white} size={20} strokeWidth={2} />
          {unreadNotifications > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.streakBadge}>
          <Zap color={Colors.warning} size={14} strokeWidth={2.5} fill={Colors.warning} />
          <Text style={styles.streakText}>3</Text>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Search + Filter */}
        <View style={styles.searchContainer}>
          <Search color={Colors.textMuted} size={18} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Find games, venues, coaches..."
            placeholderTextColor={Colors.textMuted}
            value={searchText}
            onChangeText={setSearchText}
          />
          <TouchableOpacity
            onPress={() => router.push('/explore')}
            activeOpacity={0.8}
            style={styles.searchFilterBtn}
          >
            <Filter color={Colors.primary} size={18} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Sport filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sportRow}>
          {SPORT_MASCOTS.map((s) => {
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
                  <SportIcon sport={s.sport} size={26} color={active ? Colors.white : s.color} />
                </View>
                <Text style={[styles.sportMascotLabel, { color: active ? Colors.white : s.color }]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Tab Bar ─────────────────────────────────────────────── */}
        <View style={styles.tabBarWrap}>
          <View style={styles.tabBar}>
            <Animated.View style={[styles.tabIndicator, styles.tabIndicator4, { left: tabIndicatorLeft }]} />
            <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('MATCHES')} activeOpacity={0.8}>
              <Trophy color={activeTab === 'MATCHES' ? Colors.primary : Colors.neutral400} size={13} strokeWidth={2.5} />
              <Text style={[styles.tabLabel, activeTab === 'MATCHES' && styles.tabLabelActive]}>Matches</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('TOURNAMENTS')} activeOpacity={0.8}>
              <Activity color={activeTab === 'TOURNAMENTS' ? Colors.primary : Colors.neutral400} size={13} strokeWidth={2.5} />
              <Text style={[styles.tabLabel, activeTab === 'TOURNAMENTS' && styles.tabLabelActive]}>Tournaments</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('TRAINER_SESSIONS')} activeOpacity={0.8}>
              <Dumbbell color={activeTab === 'TRAINER_SESSIONS' ? Colors.trainer : Colors.neutral400} size={13} strokeWidth={2.5} />
              <Text style={[styles.tabLabel, activeTab === 'TRAINER_SESSIONS' && styles.tabLabelTrainer]}>Trainer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('WALKING_RUNNING')} activeOpacity={0.8}>
              <PersonStanding color={activeTab === 'WALKING_RUNNING' ? Colors.walkRun : Colors.neutral400} size={13} strokeWidth={2.5} />
              <Text style={[styles.tabLabel, activeTab === 'WALKING_RUNNING' && styles.tabLabelWalk]}>Walk/Run</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── MATCHES TAB ─────────────────────────────────────────── */}
        {activeTab === 'MATCHES' && (
          <>
            {/* Pro banner */}
            {!isPro && (
              <LinearGradient colors={[Colors.neutral800, Colors.neutral900]} style={styles.proBanner}>
                <View style={styles.proBannerContent}>
                  <Zap color={Colors.warning} size={22} strokeWidth={2.5} fill={Colors.warning} />
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
                  color={matchView === 'NEARBY' ? Colors.white : Colors.textMuted}
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
                  color={matchView === 'MY_BOOKINGS' ? Colors.white : Colors.textMuted}
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
                  color={matchView === 'JOINED' ? Colors.white : Colors.textMuted}
                  strokeWidth={2}
                />
                <Text style={[styles.segmentText, matchView === 'JOINED' && styles.segmentTextActive]}>
                  Joined
                </Text>
              </TouchableOpacity>
            </View>

            {/* Match cards */}
            {isLoadingMatchView ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : filteredMatches.length > 0 ? (
              filteredMatches.map((match) => renderMatchCard(match))
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Trophy color={Colors.neutral400} size={36} strokeWidth={1.5} />
                </View>
                <Text style={styles.emptyStateTitle}>
                  {matchView === 'JOINED' ? 'No joined matches' : 'No active bookings'}
                </Text>
                <Text style={styles.emptyStateText}>
                  {searchText
                    ? 'No matches found for your search.'
                    : matchView === 'JOINED'
                    ? 'Accept an invitation or join a nearby match to see it here.'
                    : matchView === 'MY_BOOKINGS'
                    ? 'Create a match to get started!'
                    : 'No matches nearby. Try creating one!'}
                </Text>
                {matchView !== 'JOINED' && (
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() => router.push('/create-match' as any)}
                    activeOpacity={0.85}
                  >
                    <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.emptyActionGrad}>
                      <Text style={styles.emptyActionText}>Create a Match</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}

        {/* ── TOURNAMENTS TAB ─────────────────────────────────────── */}
        {activeTab === 'TOURNAMENTS' && (
          <>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Tournaments Near You</Text>
                <Text style={styles.sectionSubtitle}>Discover and join open tournaments</Text>
              </View>
              <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/tournaments' as any)}>
                <Text style={styles.seeAllText}>All →</Text>
              </TouchableOpacity>
            </View>

            {loadingTournaments ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Finding tournaments...</Text>
              </View>
            ) : filteredTournaments.length > 0 ? (
              filteredTournaments.map((t) => (
                <TournamentFeedCard
                  key={t.id}
                  tournament={t}
                  onPress={() => router.push(`/tournament/${t.id}` as any)}
                />
              ))
            ) : (
              <TouchableOpacity
                style={styles.createTournamentPrompt}
                activeOpacity={0.88}
                onPress={() => router.push('/create-tournament' as any)}
              >
                <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.createTournamentGrad}>
                  <Trophy color={Colors.white} size={28} strokeWidth={2} />
                  <View>
                    <Text style={styles.createTournamentTitle}>Host a Tournament</Text>
                    <Text style={styles.createTournamentSubtitle}>Create your own and invite teams</Text>
                  </View>
                  <ChevronRight color={Colors.white} size={20} strokeWidth={2.5} />
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
                <Text style={styles.sectionTitle}>Trainer Sessions</Text>
                <Text style={styles.sectionSubtitle}>Book 1-on-1 or group training</Text>
              </View>
              <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/explore' as any)}>
                <Text style={styles.seeAllText}>Find →</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.createTournamentPrompt}
              activeOpacity={0.88}
              onPress={() => router.push('/explore' as any)}
            >
              <LinearGradient colors={[Colors.trainer, '#C2410C']} style={styles.createTournamentGrad}>
                <Dumbbell color={Colors.white} size={28} strokeWidth={2} />
                <View>
                  <Text style={styles.createTournamentTitle}>Find a Trainer</Text>
                  <Text style={styles.createTournamentSubtitle}>Personal &amp; group sessions available</Text>
                </View>
                <ChevronRight color={Colors.white} size={20} strokeWidth={2.5} />
              </LinearGradient>
            </TouchableOpacity>
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
                const color = ACT_COLOR[act.type] ?? Colors.walkRun;
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
                    <ChevronRight color={Colors.neutral400} size={16} style={{ marginRight: 12, alignSelf: 'center' }} />
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      <BottomNavbar activeTab="EXPLORE" showCreateButton={false} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },

  topHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: Colors.primary,
    gap: 12,
  },
  logoImage: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.white },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  logoFallbackText: { fontSize: 18, fontWeight: '900', color: Colors.primary },
  headerTextContainer: { flex: 1 },
  headerGreeting: { fontSize: 18, fontWeight: '800', color: Colors.white },
  headerSubtitle: { fontSize: 12, color: Colors.white + 'CC', marginTop: 2 },
  notificationBell: {
    position: 'relative',
    padding: 6,
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.white,
  },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.white + '20', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20,
  },
  streakText: { fontSize: 14, fontWeight: '800', color: Colors.white },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 14 },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11,
    marginBottom: 14, borderWidth: 1, borderColor: Colors.neutral200,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: Colors.text },
  searchFilterBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.primaryLight,
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
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 4,
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '50%',
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
  },
  tabIndicator4: { width: '25%' },
  tabLabelTrainer: { color: Colors.trainer },
  tabLabelWalk: { color: Colors.walkRun },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    zIndex: 1,
  },
  tabLabel: { fontSize: 13, fontWeight: '700', color: Colors.neutral400 },
  tabLabelActive: { color: Colors.primary },

  proBanner: {
    borderRadius: 18, padding: 16, marginBottom: 22, gap: 12,
  },
  proBannerContent: { flexDirection: 'row', gap: 12 },
  proBannerText: { flex: 1, gap: 4 },
  proBannerLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: Colors.warning, textTransform: 'uppercase' },
  proBannerTitle: { fontSize: 16, fontWeight: '800', color: Colors.white },
  proBannerDesc: { fontSize: 12, color: Colors.neutral300, lineHeight: 17 },
  upgradeBtn: { width: '100%' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: 12, marginTop: 4,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  sectionSubtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 2, fontWeight: '500' },
  seeAllText: { fontSize: 13, fontWeight: '600', color: Colors.primary, marginTop: 4 },

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
    backgroundColor: Colors.neutral100,
    borderWidth: 1,
    borderColor: Colors.neutral200,
  },
  segmentPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  segmentTextActive: {
    color: Colors.white,
  },

  createTournamentPrompt: { borderRadius: 18, overflow: 'hidden', marginBottom: 14 },
  createTournamentGrad: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  createTournamentTitle: { fontSize: 15, fontWeight: '800', color: Colors.white },
  createTournamentSubtitle: { fontSize: 12, color: Colors.white + 'CC', marginTop: 2 },

  matchCard: {
    backgroundColor: Colors.white, borderRadius: 18, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3, overflow: 'hidden',
  },
  matchCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingBottom: 10, gap: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  sportTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  sportTagText: { fontSize: 10, fontWeight: '800', color: Colors.primary, letterSpacing: 0.6 },
  matchPrice: { fontSize: 14, fontWeight: '700', color: Colors.primaryDark },
  matchPriceLabel: { fontSize: 10, color: Colors.textMuted, marginTop: -2 },
  matchImage: { width: '100%', height: 140 },
  matchImagePlaceholder: {
    width: '100%', height: 120, alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16,
  },
  matchImagePlaceholderEmoji: { fontSize: 36 },
  matchImagePlaceholderText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  matchDetails: { padding: 14, gap: 8 },
  matchTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  matchMetaRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  matchMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  matchMetaText: { fontSize: 12, color: Colors.textMuted },
  joinBtn: { height: 42, marginTop: 4 },

  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  loadingText: { fontSize: 13, color: Colors.textMuted },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.neutral100,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptyStateText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19 },
  emptyActionBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  emptyActionGrad: { paddingHorizontal: 28, paddingVertical: 14 },
  emptyActionText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  // Walk/Run/Cycling tab
  activityHero: {
    borderRadius: 20, padding: 20, marginBottom: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  activityHeroLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  activityHeroEmoji: { fontSize: 40 },
  activityHeroTitle: { fontSize: 20, fontWeight: '900', color: Colors.white },
  activityHeroSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontWeight: '600' },
  activityHeroRight: {},
  activityStartCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },

  activityTypeRow: {
    flexDirection: 'row', gap: 10, marginBottom: 20,
  },
  activityTypeChip: {
    flex: 1, backgroundColor: Colors.white,
    borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
    borderWidth: 1.5, borderColor: Colors.neutral200,
  },
  activityTypeChipLabel: { fontSize: 13, fontWeight: '800', color: Colors.neutral700 },

  activityEmptyBox: {
    backgroundColor: Colors.white, borderRadius: 18,
    padding: 24, alignItems: 'center', marginBottom: 16,
    borderWidth: 1.5, borderColor: Colors.neutral200,
  },
  activityEmptyTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  activityEmptyBody: {
    fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19,
  },

  recentActCard: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: Colors.white, borderRadius: 16,
    marginBottom: 10, overflow: 'hidden',
    borderWidth: 1.5, borderColor: Colors.neutral200,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  recentActBar: { width: 5 },
  recentActType: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  recentActTitle: { fontSize: 14, fontWeight: '800', color: Colors.text },
  recentActDate: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  recentActStat: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
});
