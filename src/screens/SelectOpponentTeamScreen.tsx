import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Search, Shield, Swords, MapPin, X } from 'lucide-react-native';
import { ThemeColors, Colors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import HeaderIconButton from '../components/HeaderIconButton';
import ScreenGlow from '../components/ScreenGlow';
import { teamApi } from '../api/teamApi';
import { teamMatchApi } from '../api/teamMatchApi';
import { Team } from '../types/api';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { extractApiError } from '../utils/apiError';
import { goBack } from '../utils/navigation';

interface Props {
  bookingId: string;
}

/**
 * Organizer picks who to challenge after paying for a Team Match Challenge
 * booking (see CheckoutScreen's post-payment branch). Defaults to teams near
 * the booking's venue (teamMatchApi.getNearbyTeams); typing a search query
 * switches to an unrestricted name search (teamApi.searchTeams) — per spec,
 * search isn't bounded by distance, only the initial list is.
 */
export default function SelectOpponentTeamScreen({ bookingId }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [nearbyTeams, setNearbyTeams] = useState<Team[]>([]);
  const [searchResults, setSearchResults] = useState<Team[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(true);
  const [searching, setSearching] = useState(false);
  const [challengingTeamId, setChallengingTeamId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    teamMatchApi.getNearbyTeams(bookingId)
      .then(setNearbyTeams)
      .catch(() => setNearbyTeams([]))
      .finally(() => setLoadingNearby(false));
  }, [bookingId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await teamApi.searchTeams(query.trim());
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const isSearching = query.trim().length > 0;
  const listData = isSearching ? searchResults : nearbyTeams;
  const loading = isSearching ? searching : loadingNearby;

  const handleChallenge = (team: Team) => {
    Alert.alert('Challenge this team?', `Send a match challenge to ${team.name}. They'll need to pay half the booking cost to accept.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Challenge', onPress: async () => {
          setChallengingTeamId(team.id);
          try {
            await teamMatchApi.sendChallenge(bookingId, team.id);
            Alert.alert('Challenge sent!', `Waiting for ${team.name} to accept.`, [
              { text: 'OK', onPress: () => router.replace(`/match/${bookingId}` as any) },
            ]);
          } catch (err) {
            Alert.alert('Could not send challenge', extractApiError(err, 'Please try again.'));
          } finally {
            setChallengingTeamId(null);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.flex1} edges={['top']}>
      <ScreenGlow />
      <View style={styles.header}>
        <LinearGradient
          colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}
        />
        <HeaderIconButton onPress={() => goBack(router)} style={styles.headerIconBtn} hitSlop={8}>
          <ArrowLeft color={colors.white} size={20} strokeWidth={2.2} />
        </HeaderIconButton>
        <Text style={styles.title}>Challenge a Team</Text>
        <View style={styles.headerIconBtn} />
      </View>

      <View style={styles.searchWrap}>
        <Search color={colors.neutral400} size={16} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search any team by name…"
          placeholderTextColor={colors.neutral400}
          value={query}
          onChangeText={setQuery}
        />
        {!!query && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <X color={colors.neutral400} size={15} strokeWidth={2} />
          </Pressable>
        )}
      </View>

      {!isSearching && (
        <View style={styles.sectionHeaderRow}>
          <MapPin color={colors.textMuted} size={13} strokeWidth={2.2} />
          <Text style={styles.sectionHeaderText}>Teams within 20km of your venue</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const uri = resolveMediaUrl(item.logoUrl) ?? null;
            const busy = challengingTeamId === item.id;
            return (
              <Pressable style={styles.row} onPress={() => handleChallenge(item)} disabled={!!challengingTeamId}>
                {uri ? (
                  <Image source={{ uri }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Shield color={colors.primary} size={20} strokeWidth={2} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.sub}>{item.members?.length ?? 0} {(item.members?.length ?? 0) === 1 ? 'player' : 'players'}</Text>
                </View>
                {busy ? <ActivityIndicator color={colors.primary} size="small" /> : <Swords color={colors.primary} size={18} strokeWidth={2.2} />}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Shield color={colors.neutral300} size={36} strokeWidth={1.5} />
              <Text style={styles.emptyText}>
                {isSearching ? 'No teams found with that name.' : 'No teams found near your venue yet — try searching by name instead.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex1: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60, paddingHorizontal: 32 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, overflow: 'hidden',
  },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.white },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.inputBg, borderRadius: 14,
    marginHorizontal: 16, marginTop: 14, paddingHorizontal: 14, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginTop: 16, marginBottom: 4 },
  sectionHeaderText: { fontSize: 11.5, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3 },

  listContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 40, flexGrow: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.cardBg, borderRadius: 16, padding: 12, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { backgroundColor: colors.primary + '14', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14.5, fontWeight: '800', color: colors.text },
  sub: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
});
