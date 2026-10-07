import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { ArrowLeft, Search, X, Plus, Users, Lock, Globe, ChevronRight } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import HeaderIconButton from '../components/HeaderIconButton';
import ScreenGlow from '../components/ScreenGlow';
import { communityApi, Community } from '../api/communityApi';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { goBack } from '../utils/navigation';

type Tab = 'MINE' | 'DISCOVER';

export default function CommunitiesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('MINE');
  const [query, setQuery] = useState('');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (targetPage: number, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const q = query.trim();
      const result = q.length > 0
        ? await communityApi.search(q, targetPage)
        : tab === 'MINE'
          ? await communityApi.getMine(targetPage)
          : await communityApi.discover(targetPage);
      setCommunities((prev) => (append ? [...prev, ...result.content] : result.content));
      setPage(targetPage);
      setHasMore(result.hasMore);
    } catch {
      if (!append) setCommunities([]);
      setHasMore(false);
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
  }, [tab, query]);

  // Tab switch — immediate, no debounce needed.
  useEffect(() => {
    load(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Typed search — debounced, overrides the tab's own list while active.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(0, false), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const loadMore = () => {
    if (loading || loadingMore || !hasMore) return;
    load(page + 1, true);
  };

  const renderItem = ({ item }: { item: Community }) => (
    <Pressable style={styles.card} onPress={() => router.push(`/community/${item.id}` as any)}>
      {item.avatarUrl ? (
        <Image source={{ uri: resolveMediaUrl(item.avatarUrl) }} style={styles.cardAvatar} />
      ) : (
        <View style={[styles.cardAvatar, styles.cardAvatarPlaceholder]}>
          <Users color={colors.primary} size={22} strokeWidth={1.8} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          {item.isPrivate ? (
            <Lock color={colors.textMuted} size={12} strokeWidth={2.2} />
          ) : (
            <Globe color={colors.textMuted} size={12} strokeWidth={2.2} />
          )}
        </View>
        {!!item.description && <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>}
        <Text style={styles.cardMeta}>{item.memberCount} member{item.memberCount === 1 ? '' : 's'}</Text>
      </View>
      {item.isMember ? (
        <View style={styles.joinedPill}><Text style={styles.joinedPillText}>Joined</Text></View>
      ) : (
        <ChevronRight color={colors.neutral400} size={18} />
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenGlow />
      <View style={styles.topHeaderShadow}>
        <View style={styles.header}>
          <LinearGradient
            colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.headerGlassStroke} pointerEvents="none" />
          <HeaderIconButton onPress={() => goBack(router)} style={styles.headerIconBtn} hitSlop={8}>
            <ArrowLeft color={colors.white} size={20} strokeWidth={2.2} />
          </HeaderIconButton>
          <Text style={styles.title}>Communities</Text>
          <HeaderIconButton onPress={() => router.push('/create-community' as any)} style={styles.headerIconBtn} hitSlop={8}>
            <Plus color={colors.white} size={20} strokeWidth={2.4} />
          </HeaderIconButton>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Search color={colors.neutral400} size={16} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search communities…"
          placeholderTextColor={colors.neutral400}
        />
        {!!query && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <X color={colors.neutral400} size={15} strokeWidth={2} />
          </Pressable>
        )}
      </View>

      {!query && (
        <View style={styles.tabRow}>
          {(['MINE', 'DISCOVER'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
                {t === 'MINE' ? 'My Communities' : 'Discover'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={communities}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.center}>
              <Users color={colors.neutral300} size={40} strokeWidth={1.5} />
              <Text style={styles.emptyText}>
                {tab === 'MINE' && !query ? "You haven't joined any communities yet" : 'No communities found'}
              </Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topHeaderShadow: {
    marginHorizontal: 12, marginTop: 6, marginBottom: 2, borderRadius: 26,
    shadowColor: colors.primaryDark, shadowOpacity: 0.28, shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 26, overflow: 'hidden',
  },
  headerGlassStroke: { ...StyleSheet.absoluteFillObject, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
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

  tabRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 14 },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: 'center',
    backgroundColor: colors.cardBg, borderWidth: 1.5, borderColor: colors.neutral200,
  },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  tabBtnTextActive: { color: colors.white },

  listContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40, flexGrow: 1 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.cardBg, borderRadius: 18, padding: 12, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardAvatar: { width: 52, height: 52, borderRadius: 26 },
  cardAvatarPlaceholder: { backgroundColor: colors.primary + '14', alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 15, fontWeight: '800', color: colors.text, flexShrink: 1 },
  cardDesc: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  cardMeta: { fontSize: 11.5, color: colors.textMuted, marginTop: 3 },
  joinedPill: { backgroundColor: colors.primary + '18', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  joinedPillText: { fontSize: 11, fontWeight: '800', color: colors.primary },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 40 },
});
