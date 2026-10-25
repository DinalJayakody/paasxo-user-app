import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Keyboard,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ArrowLeft, Calendar, ChevronDown, ChevronUp, Clock, Globe, Inbox, MapPin, Plus, Search, Shield, Swords, Users, UserCircle, X,
} from 'lucide-react-native';
import { ThemeColors, Colors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import HeaderIconButton from '../components/HeaderIconButton';
import ScreenGlow from '../components/ScreenGlow';
import { PaasxoRefreshControl } from '../components/PaasxoRefreshControl';
import { teamMatchApi } from '../api/teamMatchApi';
import { OpenTeamMatch, TeamMatchChallenge } from '../types/api';
import { confirmDeclineChallenge, openAcceptChallenge } from '../utils/teamChallengeActions';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { goBack } from '../utils/navigation';
import { TEAM_MATCH_SPORTS, teamMatchSportLabel } from '../constants/teamMatchSports';

const RADIUS_OPTIONS = [5, 10, 20, 50, 100];
// Fetched once at the widest radius; the sport/radius chips then filter on-device,
// so changing a filter never costs another request.
const FETCH_RADIUS_KM = Math.max(...RADIUS_OPTIONS);
const GUIDE_COLLAPSED_KEY = 'teamMatches.guideCollapsed';

const GUIDE_STEPS = [
  { title: 'Pick a match', text: 'Every match here is a real venue booking another team has already paid for in full.' },
  { title: 'Choose your team', text: 'Join with a team you captain. You create teams and add players from your Profile.' },
  { title: 'Pay your half', text: 'Your team pays half the booking. The same amount goes back to the team that booked, so both teams pay equally.' },
];
const SPORT_FILTERS = [{ id: 'ALL', label: 'All' }, ...TEAM_MATCH_SPORTS];

function formatDate(ymd: string): string {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

const hhmm = (t?: string) => (t ? t.slice(0, 5) : '');
const money = (n: number) => `LKR ${Number(n ?? 0).toFixed(2)}`;

const SEARCH_MIN_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 350;

/** Renders `text`, emphasising every case-insensitive occurrence of `query`. */
function Highlight({ text, query, style, highlightStyle, numberOfLines }: {
  text: string; query: string; style: any; highlightStyle: any; numberOfLines?: number;
}) {
  const q = query.trim();
  if (q.length < SEARCH_MIN_CHARS || !text) return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  let idx = lower.indexOf(needle, from);
  while (idx !== -1) {
    if (idx > from) parts.push(text.slice(from, idx));
    parts.push(<Text key={idx} style={highlightStyle}>{text.slice(idx, idx + needle.length)}</Text>);
    from = idx + needle.length;
    idx = lower.indexOf(needle, from);
  }
  if (from < text.length) parts.push(text.slice(from));
  return <Text style={style} numberOfLines={numberOfLines}>{parts}</Text>;
}

/** One open match. Memoized: typing in the search box or toggling a chip only
 *  re-renders cards whose data actually changed. */
const OpenMatchCard = memo(function OpenMatchCard({ item, query, styles, colors, onOpen, onTakeOn }: {
  item: OpenTeamMatch;
  query: string;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  onOpen: (m: OpenTeamMatch) => void;
  onTakeOn: (m: OpenTeamMatch) => void;
}) {
  const logo = resolveMediaUrl(item.organizerTeamLogoUrl) ?? null;
  const venueLine = `${item.venueName ?? ''}${item.locationName && item.locationName !== item.venueName ? ` · ${item.locationName}` : ''}`;
  return (
    <Pressable style={styles.card} onPress={() => onOpen(item)}>
      <View style={styles.cardTop}>
        {logo ? (
          <Image source={{ uri: logo }} style={styles.logo} />
        ) : (
          <View style={[styles.logo, styles.logoFallback]}>
            <Shield color={colors.primary} size={22} strokeWidth={2} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Highlight text={item.organizerTeamName} query={query} style={styles.teamName} highlightStyle={styles.hl} numberOfLines={1} />
          <View style={styles.metaRow}>
            <Users color={colors.textMuted} size={12} strokeWidth={2.2} />
            <Text style={styles.metaText}>
              {item.organizerTeamMemberCount} {item.organizerTeamMemberCount === 1 ? 'player' : 'players'}
            </Text>
            {item.isMine && (
              <View style={styles.minePill}><Text style={styles.minePillText}>Your team</Text></View>
            )}
          </View>
        </View>
        <View style={styles.sportBadge}>
          <Text style={styles.sportBadgeText}>{teamMatchSportLabel(item.sport).toUpperCase()}</Text>
        </View>
      </View>

      {!!item.title && (
        <Highlight text={item.title} query={query} style={styles.title} highlightStyle={styles.hl} numberOfLines={1} />
      )}

      <View style={styles.infoRow}>
        <MapPin color={colors.primary} size={14} strokeWidth={2.2} />
        <Highlight text={venueLine} query={query} style={styles.infoText} highlightStyle={styles.hl} numberOfLines={1} />
        {item.distanceKm != null && <Text style={styles.distance}>{item.distanceKm} km</Text>}
      </View>
      <View style={styles.infoRow}>
        <Calendar color={colors.primary} size={14} strokeWidth={2.2} />
        <Text style={styles.infoText}>{formatDate(item.slotDate)}</Text>
        <Clock color={colors.primary} size={14} strokeWidth={2.2} style={{ marginLeft: 10 }} />
        <Text style={styles.infoText}>{hhmm(item.startTime)}{item.endTime ? ` – ${hhmm(item.endTime)}` : ''}</Text>
      </View>

      <View style={styles.cardFooter}>
        <View style={{ flex: 1 }}>
          <Text style={styles.priceLabel}>{item.isMine ? 'Opponent pays (half)' : 'Your team pays (half)'}</Text>
          <Text style={styles.price}>{money(item.amountDue)}</Text>
          <Text style={styles.priceSub}>
            {item.isMine ? 'refunded to you when a team joins' : `of ${money(item.totalPrice)} total`}
          </Text>
        </View>
        {item.isMine ? (
          <Pressable style={[styles.cta, styles.ctaMuted]} onPress={() => onOpen(item)}>
            <Text style={styles.ctaMutedText}>Manage</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.cta} onPress={() => onTakeOn(item)}>
            <Swords color={Colors.white} size={15} strokeWidth={2.4} />
            <Text style={styles.ctaText}>Take it on</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
});

/**
 * Explore -> "Team vs Team": open Team Match Challenges near the user. Each is a
 * venue slot a team has already booked and paid for in full; any captain of a
 * same-sport team can claim the opponent spot by paying half (see
 * TeamMatchJoinScreen and TeamMatchService.getOpenChallenges on the backend).
 */
export default function TeamMatchesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; q?: string }>();

  // OPEN: open matches to take on. CHALLENGES: challenges sent to teams you captain.
  const [view, setView] = useState<'OPEN' | 'CHALLENGES'>(params.tab === 'challenges' ? 'CHALLENGES' : 'OPEN');
  const [challenges, setChallenges] = useState<TeamMatchChallenge[]>([]);
  const [challengesLoaded, setChallengesLoaded] = useState(false);

  const loadChallenges = useCallback(async () => {
    try {
      setChallenges(await teamMatchApi.getMyPendingChallenges());
    } catch {
      // keep whatever was shown; the tab shows its own empty/error copy
    } finally {
      setChallengesLoaded(true);
    }
  }, []);

  // On every return to this screen — e.g. after paying for (or declining) a
  // challenge, the request must disappear without a manual refresh.
  useFocusEffect(useCallback(() => { loadChallenges(); }, [loadChallenges]));

  const [sport, setSport] = useState('ALL');
  const [radiusKm, setRadiusKm] = useState(20);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationResolved, setLocationResolved] = useState(false);
  const [allMatches, setAllMatches] = useState<OpenTeamMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guideCollapsed, setGuideCollapsed] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(GUIDE_COLLAPSED_KEY).then((v) => setGuideCollapsed(v === '1')).catch(() => {});
  }, []);
  const setGuide = useCallback((collapsed: boolean) => {
    setGuideCollapsed(collapsed);
    AsyncStorage.setItem(GUIDE_COLLAPSED_KEY, collapsed ? '1' : '0').catch(() => {});
  }, []);
  const toggleGuide = () => setGuide(!guideCollapsed);

  // Device position, or null if permission is off/unavailable (then the list
  // simply isn't distance-bound).
  const readCoords = useCallback(async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    readCoords().then((c) => {
      if (cancelled) return;
      setCoords(c);
      setLocationResolved(true);
    });
    return () => { cancelled = true; };
  }, [readCoords]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await teamMatchApi.getOpenChallenges({
        lat: coords?.lat,
        lng: coords?.lng,
        radiusKm: coords ? FETCH_RADIUS_KM : undefined,
      });
      setAllMatches(data);
    } catch {
      setError('Could not load team matches. Pull down to try again.');
    }
  }, [coords]);

  // Distance is always measured from the match's venue. Your own team's listings
  // are kept apart and shown at any distance; everyone else's obey the km range.
  const inRange = useCallback((m: OpenTeamMatch) =>
    !coords || m.distanceKm == null || m.distanceKm <= radiusKm, [coords, radiusKm]);
  const sportMatches = useCallback((m: OpenTeamMatch, id: string) =>
    id === 'ALL' || (m.sport || '').toUpperCase() === id, []);

  const { mine, matches, beyond } = useMemo(() => {
    const ofSport = allMatches.filter((m) => sportMatches(m, sport));
    const others = ofSport.filter((m) => !m.isMine);
    return {
      mine: ofSport.filter((m) => m.isMine),
      matches: others.filter(inRange),
      beyond: others.filter((m) => !inRange(m)),
    };
  }, [allMatches, sport, inRange, sportMatches]);

  // Per-sport counts for the chips (other teams' matches within the current range).
  const sportCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of SPORT_FILTERS) {
      counts[f.id] = allMatches.filter((m) => !m.isMine && inRange(m) && sportMatches(m, f.id)).length;
    }
    return counts;
  }, [allMatches, inRange, sportMatches]);

  // Smallest range option that would reveal the nearest out-of-range match.
  const widerRadius = useMemo(() => {
    if (beyond.length === 0) return null;
    const nearest = Math.min(...beyond.map((m) => m.distanceKm ?? Infinity));
    return RADIUS_OPTIONS.find((r) => r >= nearest) ?? null;
  }, [beyond]);

  useEffect(() => {
    if (!locationResolved) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load, locationResolved]);

  // Pull-to-refresh = a fresh first visit: re-read the position (you may have
  // moved), then one request. If the position changed, updating coords triggers
  // that single load via the effect above; otherwise load directly.
  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const challengesTask = loadChallenges();
      if (isSearching) await runSearch(trimmedSearch);
      const fresh = await readCoords();
      const moved = (fresh?.lat !== coords?.lat) || (fresh?.lng !== coords?.lng);
      if (moved) {
        setCoords(fresh);
        await new Promise((r) => setTimeout(r, 0));
      } else {
        await load();
      }
      await challengesTask;
    } finally {
      setRefreshing(false);
    }
  };

  const renderChallengeCard = ({ item }: { item: TeamMatchChallenge }) => {
    const logo = resolveMediaUrl(item.organizerTeamLogoUrl) ?? null;
    const waitingForVenue = item.venueConfirmed === false;
    return (
      <Pressable style={styles.card} onPress={() => router.push(`/match/${item.bookingId}` as any)}>
        <View style={styles.cardTop}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Shield color={colors.primary} size={22} strokeWidth={2} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.teamName} numberOfLines={1}>{item.organizerTeamName ?? 'A team'}</Text>
            <Text style={styles.metaText} numberOfLines={1}>challenged {item.challengedTeamName ?? 'your team'}</Text>
          </View>
          {!!item.sport && (
            <View style={styles.sportBadge}>
              <Text style={styles.sportBadgeText}>{teamMatchSportLabel(item.sport).toUpperCase()}</Text>
            </View>
          )}
        </View>

        {!!item.venueName && (
          <View style={styles.infoRow}>
            <MapPin color={colors.primary} size={14} strokeWidth={2.2} />
            <Text style={styles.infoText} numberOfLines={1}>
              {item.venueName}{item.locationName && item.locationName !== item.venueName ? ` · ${item.locationName}` : ''}
            </Text>
          </View>
        )}
        {!!item.slotDate && (
          <View style={styles.infoRow}>
            <Calendar color={colors.primary} size={14} strokeWidth={2.2} />
            <Text style={styles.infoText}>{formatDate(item.slotDate)}</Text>
            <Clock color={colors.primary} size={14} strokeWidth={2.2} style={{ marginLeft: 10 }} />
            <Text style={styles.infoText}>{hhmm(item.startTime)}{item.endTime ? ` – ${hhmm(item.endTime)}` : ''}</Text>
          </View>
        )}
        {waitingForVenue && (
          <View style={[styles.statusPill, { backgroundColor: colors.warning + '1A' }]}>
            <Clock color={colors.warning} size={12} strokeWidth={2.4} />
            <Text style={[styles.statusPillText, { color: colors.warning }]}>Waiting for venue confirmation</Text>
          </View>
        )}

        <View style={styles.cardFooter}>
          <View style={{ flex: 1 }}>
            <Text style={styles.priceLabel}>Your team pays (half)</Text>
            <Text style={styles.price}>{money(item.amountDue)}</Text>
            <Text style={styles.priceSub}>of {money(item.totalPrice)} total</Text>
          </View>
          <Pressable
            style={styles.declineIconBtn}
            hitSlop={6}
            onPress={() => confirmDeclineChallenge(item, () => setChallenges((cur) => cur.filter((c) => c.id !== item.id)))}
          >
            <X color={colors.error} size={18} strokeWidth={2.4} />
          </Pressable>
          <Pressable
            style={[styles.cta, waitingForVenue && { opacity: 0.5 }]}
            onPress={() => openAcceptChallenge(router, item)}
          >
            <Swords color={Colors.white} size={15} strokeWidth={2.4} />
            <Text style={styles.ctaText}>Accept</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  // ── Search: every open match (venue, match name, team name), any distance ──
  // ?q= pre-fills the search (deep links / shared searches).
  const [searchText, setSearchText] = useState(typeof params.q === 'string' ? params.q.slice(0, 60) : '');
  const [searchQuery, setSearchQuery] = useState('');     // debounced, what was actually searched
  const [searchResults, setSearchResults] = useState<OpenTeamMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRequestId = useRef(0);
  // A new ?q= link while the screen is already open replaces the search.
  useEffect(() => {
    if (typeof params.q === 'string') { setSearchText(params.q.slice(0, 60)); setView('OPEN'); }
  }, [params.q]);
  const trimmedSearch = searchText.trim();
  const isSearching = trimmedSearch.length >= SEARCH_MIN_CHARS;
  // Search mode starts the moment the search box is focused (or holds any text):
  // the guide, range chips and nearby sections give way to search content only.
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const searchMode = searchFocused || trimmedSearch.length > 0;
  const exitSearch = useCallback(() => {
    setSearchText('');
    searchInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const id = ++searchRequestId.current;
    setSearching(true);
    setSearchError(null);
    try {
      const data = await teamMatchApi.getOpenChallenges({ q, lat: coords?.lat, lng: coords?.lng });
      if (id !== searchRequestId.current) return; // a newer keystroke superseded this one
      setSearchResults(data);
      setSearchQuery(q);
      // Once someone has searched, they know how it works — keep the guide
      // minimized from now on (they can still expand it).
      setGuideCollapsed((wasCollapsed) => {
        if (!wasCollapsed) AsyncStorage.setItem(GUIDE_COLLAPSED_KEY, '1').catch(() => {});
        return true;
      });
    } catch {
      if (id === searchRequestId.current) setSearchError('Search failed. Check your connection and try again.');
    } finally {
      if (id === searchRequestId.current) setSearching(false);
    }
  }, [coords]);

  // Debounced: one request per pause in typing, never per keystroke.
  useEffect(() => {
    if (!isSearching) {
      searchRequestId.current++; // drop anything in flight
      setSearching(false);
      setSearchResults([]);
      setSearchQuery('');
      setSearchError(null);
      return;
    }
    const t = setTimeout(() => runSearch(trimmedSearch), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [trimmedSearch, isSearching, runSearch]);

  const searchMatches = useMemo(
    () => searchResults.filter((m) => sportMatches(m, sport)),
    [searchResults, sport, sportMatches],
  );

  const openMatch = useCallback((m: OpenTeamMatch) => router.push(`/match/${m.bookingId}` as any), [router]);
  const takeOn = useCallback((m: OpenTeamMatch) => router.push({
    pathname: `/team-match-join/${m.bookingId}` as any,
    params: { amountDue: String(m.amountDue), organizerTeamName: m.organizerTeamName },
  }), [router]);
  const cardQuery = isSearching ? searchQuery : '';
  const renderCard = useCallback(({ item }: { item: OpenTeamMatch }) => (
    <OpenMatchCard item={item} query={cardQuery} styles={styles} colors={colors} onOpen={openMatch} onTakeOn={takeOn} />
  ), [cardQuery, styles, colors, openMatch, takeOn]);
  const keyOf = useCallback((m: OpenTeamMatch) => String(m.bookingId), []);

  return (
    <SafeAreaView style={styles.flex1} edges={['top']}>
      <ScreenGlow />
      <View style={styles.header}>
        <LinearGradient
          colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}
        />
        <HeaderIconButton onPress={() => goBack(router, '/explore')} style={styles.headerIconBtn} hitSlop={8}>
          <ArrowLeft color={colors.white} size={20} strokeWidth={2.2} />
        </HeaderIconButton>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Team vs Team</Text>
          <Text style={styles.headerSub}>Teams nearby looking for a match</Text>
        </View>
        <HeaderIconButton
          onPress={() => router.push('/create-team-challenge-match?mode=open' as any)}
          style={styles.headerIconBtn}
          hitSlop={8}
        >
          <Plus color={colors.white} size={20} strokeWidth={2.4} />
        </HeaderIconButton>
      </View>

      <View style={styles.segment}>
        {([
          { id: 'OPEN', label: 'Open matches', Icon: Globe, count: 0 },
          { id: 'CHALLENGES', label: 'Challenges', Icon: Inbox, count: challenges.length },
        ] as const).map(({ id, label, Icon, count }) => {
          const active = view === id;
          return (
            <Pressable key={id} style={[styles.segmentBtn, active && styles.segmentBtnActive]} onPress={() => setView(id)}>
              <Icon color={active ? Colors.white : colors.textSecondary} size={14} strokeWidth={2.3} />
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
              {count > 0 && (
                <View style={[styles.segmentBadge, active && styles.segmentBadgeActive]}>
                  <Text style={[styles.segmentBadgeText, active && { color: colors.primary }]}>{count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {view === 'OPEN' && (
        <View style={styles.searchRow}>
        <View style={[styles.searchWrap, searchFocused && styles.searchWrapFocused]}>
          <Search color={searchFocused ? colors.primary : colors.textMuted} size={17} strokeWidth={2.2} />
          <TextInput
            ref={searchInputRef}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search venue, match or team name"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            maxLength={60}
            onSubmitEditing={() => { if (isSearching) runSearch(trimmedSearch); }}
            accessibilityLabel="Search open team matches"
          />
          {searching ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : searchText.length > 0 ? (
            <Pressable onPress={() => setSearchText('')} hitSlop={10} accessibilityLabel="Clear search text">
              <X color={colors.textMuted} size={17} strokeWidth={2.2} />
            </Pressable>
          ) : null}
        </View>
        {searchMode && (
          <Pressable onPress={exitSearch} hitSlop={8} accessibilityLabel="Cancel search">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        )}
        </View>
      )}

      {view === 'CHALLENGES' ? (
        <FlatList
          data={challenges}
          keyExtractor={(c) => c.id}
          renderItem={renderChallengeCard}
          contentContainerStyle={styles.listContent}
          refreshControl={<PaasxoRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            challenges.length > 0 ? (
              <Text style={styles.sectionHint}>
                Teams that challenged a team you captain. Open one to see the match and both teams' players, then accept by
                paying your half — or decline.
              </Text>
            ) : null
          }
          ListEmptyComponent={
            !challengesLoaded ? (
              <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
            ) : (
              <View style={styles.center}>
                <Inbox color={colors.neutral300} size={44} strokeWidth={1.5} />
                <Text style={styles.emptyTitle}>No challenges right now</Text>
                <Text style={styles.emptyText}>
                  When another team challenges a team you captain, it shows up here — and you'll get a notification.
                </Text>
              </View>
            )
          }
        />
      ) : (
      <FlatList
        data={searchMode ? (isSearching ? searchMatches : []) : matches}
        keyExtractor={keyOf}
        renderItem={renderCard}
        contentContainerStyle={styles.listContent}
        refreshControl={<PaasxoRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        ListHeaderComponent={searchMode ? (!isSearching ? null : (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}
              keyboardShouldPersistTaps="handled">
              {SPORT_FILTERS.map((s) => (
                <Pressable key={s.id} style={[styles.chip, sport === s.id && styles.chipActive]} onPress={() => setSport(s.id)}>
                  <Text style={[styles.chipText, sport === s.id && styles.chipTextActive]}>{s.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {!!searchQuery && !searchError && (
              <Text style={styles.sectionLabel}>
                {`${searchMatches.length} RESULT${searchMatches.length === 1 ? '' : 'S'} FOR "${searchQuery.toUpperCase()}" · ALL AREAS`}
              </Text>
            )}
            {searchResults.length >= 50 && (
              <Text style={styles.sectionHint}>Showing the 50 nearest — type more to narrow it down.</Text>
            )}
          </View>
        )) : (
          <View>
            <View style={styles.guide}>
              <Pressable style={styles.guideHeader} onPress={toggleGuide} hitSlop={6}>
                <Swords color={colors.primary} size={16} strokeWidth={2.2} />
                <Text style={styles.guideTitle}>How Team vs Team works</Text>
                {guideCollapsed
                  ? <ChevronDown color={colors.textMuted} size={18} strokeWidth={2.2} />
                  : <ChevronUp color={colors.textMuted} size={18} strokeWidth={2.2} />}
              </Pressable>
              {!guideCollapsed && (
                <>
                  {GUIDE_STEPS.map((step, i) => (
                    <View key={step.title} style={styles.guideStep}>
                      <View style={styles.guideNum}><Text style={styles.guideNumText}>{i + 1}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.guideStepTitle}>{step.title}</Text>
                        <Text style={styles.guideStepText}>{step.text}</Text>
                      </View>
                    </View>
                  ))}
                  <Text style={styles.guideFoot}>
                    Only 2 teams per match, Futsal, Cricket, Pickleball and Paddleball. Want to host? Tap + to book a
                    slot for your team and let another team take it on.
                  </Text>
                  <Pressable style={styles.guideLink} onPress={() => router.push('/profile' as any)} hitSlop={6}>
                    <UserCircle color={colors.primary} size={14} strokeWidth={2.2} />
                    <Text style={styles.guideLinkText}>Manage my teams in Profile</Text>
                  </Pressable>
                </>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {SPORT_FILTERS.map((s) => (
                <Pressable
                  key={s.id}
                  style={[styles.chip, sport === s.id && styles.chipActive]}
                  onPress={() => setSport(s.id)}
                >
                  <Text style={[styles.chipText, sport === s.id && styles.chipTextActive]}>{s.label}</Text>
                  {!loading && sportCounts[s.id] > 0 && (
                    <View style={[styles.chipCount, sport === s.id && styles.chipCountActive]}>
                      <Text style={[styles.chipCountText, sport === s.id && styles.chipCountTextActive]}>
                        {sportCounts[s.id]}
                      </Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>

            {coords ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {RADIUS_OPTIONS.map((r) => (
                  <Pressable
                    key={r}
                    style={[styles.chip, styles.chipSmall, radiusKm === r && styles.chipActive]}
                    onPress={() => setRadiusKm(r)}
                  >
                    <MapPin color={radiusKm === r ? Colors.white : colors.textSecondary} size={12} strokeWidth={2.2} />
                    <Text style={[styles.chipText, radiusKm === r && styles.chipTextActive]}>{r} km</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : locationResolved ? (
              <Text style={styles.locationHint}>Location is off — showing team matches in every area.</Text>
            ) : null}

            {mine.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>YOUR TEAM'S OPEN MATCHES</Text>
                <Text style={styles.sectionHint}>Waiting for another team to take them on. Shown at any distance.</Text>
                {mine.map((item) => <View key={`mine-${item.bookingId}`}>{renderCard({ item })}</View>)}
              </>
            )}

            {!loading && !error && (mine.length > 0 || matches.length > 0) && (
              <Text style={[styles.sectionLabel, mine.length > 0 && { marginTop: 8 }]}>
                {coords ? `TEAMS TO TAKE ON · WITHIN ${radiusKm} KM` : 'TEAMS TO TAKE ON'}
              </Text>
            )}
          </View>
        )}
        ListEmptyComponent={searchMode && !isSearching ? (
          <View style={styles.searchPrompt}>
            <Search color={colors.primary} size={34} strokeWidth={1.8} />
            <Text style={styles.emptyTitle}>Search all open team matches</Text>
            <Text style={styles.emptyText}>
              Type a venue, an area, a match name or a team name — at least {SEARCH_MIN_CHARS} characters. Search covers every
              area, not just your range.
            </Text>
          </View>
        ) : searchMode ? (
          searching && !searchQuery ? (
            <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <View style={styles.center}>
              <Search color={colors.neutral300} size={42} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>{searchError ? 'Search failed' : 'No matches found'}</Text>
              <Text style={styles.emptyText}>
                {searchError ?? (sport !== 'ALL' && searchResults.length > 0
                  ? `No ${teamMatchSportLabel(sport)} matches for "${searchQuery}" — try All sports.`
                  : `Nothing matches "${searchQuery || trimmedSearch}". Try a venue, an area, a match name or a team name.`)}
              </Text>
              {!searchError && sport !== 'ALL' && searchResults.length > 0 && (
                <Pressable style={styles.secondaryBtn} onPress={() => setSport('ALL')}>
                  <Text style={styles.secondaryBtnText}>Show all sports</Text>
                </Pressable>
              )}
            </View>
          )
        ) : loading ? (
            <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <View style={styles.center}>
              <Swords color={colors.neutral300} size={44} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>
                {error ? 'Something went wrong'
                  : sport === 'ALL' ? 'No open team matches nearby'
                  : `No ${teamMatchSportLabel(sport)} team matches nearby`}
              </Text>
              <Text style={styles.emptyText}>
                {error ?? (coords
                  ? `Nothing within ${radiusKm} km of you yet. Post your own and let a team come to you.`
                  : 'Be the first — book a slot for your team and let another team take it on.')}
              </Text>
              {!error && widerRadius != null && (
                <Pressable style={styles.secondaryBtn} onPress={() => setRadiusKm(widerRadius)}>
                  <MapPin color={colors.primary} size={15} strokeWidth={2.2} />
                  <Text style={styles.secondaryBtnText}>
                    {`Show ${beyond.filter((m) => (m.distanceKm ?? Infinity) <= widerRadius).length} within ${widerRadius} km`}
                  </Text>
                </Pressable>
              )}
              {!error && (
                <Pressable
                  style={styles.primaryBtn}
                  onPress={() => router.push('/create-team-challenge-match?mode=open' as any)}
                >
                  <Plus color={Colors.white} size={16} strokeWidth={2.4} />
                  <Text style={styles.primaryBtnText}>Post an Open Challenge</Text>
                </Pressable>
              )}
            </View>
          )
        }
      />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex1: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, overflow: 'hidden',
  },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.white },
  headerSub: { fontSize: 11.5, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: '600' },

  listContent: { padding: 16, paddingBottom: 48, flexGrow: 1 },
  guide: {
    backgroundColor: colors.primary + '0F', borderRadius: 16, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: colors.primary + '22',
  },
  guideHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  guideTitle: { flex: 1, fontSize: 13.5, fontWeight: '800', color: colors.text },
  guideStep: { flexDirection: 'row', gap: 10, marginTop: 12 },
  guideNum: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  guideNumText: { color: Colors.white, fontSize: 11.5, fontWeight: '900' },
  guideStepTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  guideStepText: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: 1 },
  guideFoot: { fontSize: 11.5, color: colors.textMuted, lineHeight: 16, marginTop: 12 },
  guideLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  guideLinkText: { fontSize: 12.5, fontWeight: '800', color: colors.primary },

  chipRow: { gap: 8, paddingBottom: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14,
    backgroundColor: colors.cardBg, borderWidth: 1.5, borderColor: colors.neutral200,
  },
  chipSmall: { paddingHorizontal: 12, paddingVertical: 7 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12.5, fontWeight: '700', color: colors.textSecondary },
  chipTextActive: { color: Colors.white },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, height: 46, borderRadius: 14,
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.neutral200,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: colors.text, paddingVertical: 0 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 10 },
  searchWrapFocused: { borderColor: colors.primary, backgroundColor: colors.cardBg },
  cancelText: { fontSize: 14.5, fontWeight: '700', color: colors.primary },
  searchPrompt: { alignItems: 'center', gap: 10, paddingTop: 40, paddingHorizontal: 24 },
  hl: { color: colors.primary, fontWeight: '900' },
  minePill: { marginLeft: 6, backgroundColor: colors.primary + '1A', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  minePillText: { fontSize: 10, fontWeight: '800', color: colors.primary },
  segment: {
    flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12, padding: 4,
    borderRadius: 16, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.neutral200,
  },
  segmentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
  },
  segmentBtnActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  segmentTextActive: { color: Colors.white },
  segmentBadge: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.error,
  },
  segmentBadgeActive: { backgroundColor: Colors.white },
  segmentBadgeText: { fontSize: 11, fontWeight: '900', color: Colors.white },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, marginTop: 4,
  },
  statusPillText: { fontSize: 11.5, fontWeight: '800' },
  declineIconBtn: {
    width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.error + '55',
  },
  chipCount: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '1F',
  },
  chipCountActive: { backgroundColor: 'rgba(255,255,255,0.28)' },
  chipCountText: { fontSize: 10.5, fontWeight: '900', color: colors.primary },
  chipCountTextActive: { color: Colors.white },
  sectionLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, color: colors.neutral500, marginTop: 4, marginBottom: 6 },
  sectionHint: { fontSize: 11.5, color: colors.textMuted, marginBottom: 10, marginTop: -2 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6,
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10,
  },
  secondaryBtnText: { color: colors.primary, fontSize: 13.5, fontWeight: '800' },
  locationHint: { fontSize: 11.5, color: colors.textMuted, fontWeight: '600', marginBottom: 10 },

  card: {
    backgroundColor: colors.cardBg, borderRadius: 18, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  logo: { width: 48, height: 48, borderRadius: 24 },
  logoFallback: { backgroundColor: colors.primary + '14', alignItems: 'center', justifyContent: 'center' },
  teamName: { fontSize: 15.5, fontWeight: '800', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metaText: { fontSize: 11.5, color: colors.textMuted, fontWeight: '600' },
  sportBadge: { backgroundColor: colors.primary + '14', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  sportBadgeText: { fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.6 },
  title: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  infoText: { fontSize: 12.5, color: colors.textSecondary, fontWeight: '600', flexShrink: 1 },
  distance: { marginLeft: 'auto', fontSize: 11.5, fontWeight: '800', color: colors.primary },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.neutral200,
  },
  priceLabel: { fontSize: 10.5, fontWeight: '800', color: colors.neutral500, letterSpacing: 0.6, textTransform: 'uppercase' },
  price: { fontSize: 17, fontWeight: '900', color: colors.primary, marginTop: 2 },
  priceSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11,
  },
  ctaText: { color: Colors.white, fontSize: 13.5, fontWeight: '800' },
  ctaMuted: { backgroundColor: colors.neutral100 },
  ctaMutedText: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 50, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 4, textAlign: 'center' },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  primaryBtnText: { color: Colors.white, fontSize: 14, fontWeight: '800' },
});
