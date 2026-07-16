import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  MessageCircle,
  Search,
  X,
  MapPin,
  Users,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../styles/colors';
import { BottomNavbar } from '../components/BottomNavbar';
import { socialMediaApi } from '../api/socialMediaApi';
import { userApi } from '../api/userApi';
import { useAuth } from '../context/AuthContext';
import { UserCard, FollowRelationship } from '../types/api';
import {
  NoFollowersIllustration,
  NoFollowingIllustration,
  AllCaughtUpIllustration,
  NoSuggestionsIllustration,
} from '../components/illustrations/FriendsIllustrations';

const PAGE_SIZE = 10;

const SEGMENT_ITEMS = ['Followers', 'Following', 'Requests', 'Suggested'] as const;
type Segment = typeof SEGMENT_ITEMS[number];

const SKILL_COLOR: Record<string, string> = {
  BEGINNER: Colors.success,
  INTERMEDIATE: Colors.warning,
  PRO: Colors.liveRed,
};

const DEFAULT_AVATAR = {
  uri: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=400',
};

function avatarSource(url?: string) {
  if (!url) return DEFAULT_AVATAR;
  return { uri: url.startsWith('http') ? url : `data:image/jpeg;base64,${url}` };
}

// ─── Animated press wrapper ──────────────────────────────────

function ScalePressable({ onPress, style, children, ...rest }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, friction: 12, tension: 140 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPressIn={() => animate(0.96)}
        onPressOut={() => animate(1)}
        onPress={onPress}
        android_ripple={{ color: Colors.neutral200 }}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ─── Generic 10-at-a-time paginated list, shared by every tab ─

interface PaginatedList<T> {
  data: T[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  reload: () => void;
  loadMore: () => void;
  reset: () => void;
  updateItem: (id: string, patch: Partial<T>) => void;
  removeItem: (id: string) => void;
  momentumRef: React.MutableRefObject<boolean>;
}

function usePaginatedList<T>(
  fetchPage: (page: number) => Promise<{ content: T[]; hasMore: boolean }>,
  keyExtractor: (item: T) => string
): PaginatedList<T> {
  const [data, setData] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const momentumRef = useRef(false);

  const reload = useCallback(() => {
    setLoading(true);
    fetchPage(0)
      .then((res) => {
        setData(res.content);
        setHasMore(res.hasMore);
        setPage(0);
      })
      .catch(() => {
        setData([]);
        setHasMore(false);
      })
      .finally(() => setLoading(false));
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    fetchPage(nextPage)
      .then((res) => {
        setData((prev) => {
          const map = new Map(prev.map((item) => [keyExtractor(item), item]));
          res.content.forEach((item) => map.set(keyExtractor(item), item));
          return Array.from(map.values());
        });
        setHasMore(res.hasMore);
        setPage(nextPage);
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false));
  }, [fetchPage, hasMore, loadingMore, page, keyExtractor]);

  const reset = useCallback(() => {
    setData([]);
    setHasMore(true);
    setPage(0);
    setLoading(false);
    setLoadingMore(false);
  }, []);

  const updateItem = useCallback(
    (id: string, patch: Partial<T>) => {
      setData((prev) => prev.map((item) => (keyExtractor(item) === id ? { ...item, ...patch } : item)));
    },
    [keyExtractor]
  );

  const removeItem = useCallback(
    (id: string) => {
      setData((prev) => prev.filter((item) => keyExtractor(item) !== id));
    },
    [keyExtractor]
  );

  return { data, loading, loadingMore, hasMore, reload, loadMore, reset, updateItem, removeItem, momentumRef };
}

const cardKey = (u: UserCard) => u.firebaseUid;

// ─── Main screen ─────────────────────────────────────────────

export default function FriendsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const myUid = user?.firebaseUid ?? 'me';

  const [activeTab, setActiveTab] = useState<Segment>('Followers');
  const [searchValue, setSearchValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [actionLoadingUids, setActionLoadingUids] = useState<Set<string>>(new Set());

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const locationRequestedRef = useRef(false);

  const isSearching = searchValue.trim().length >= 2;

  const fetchFollowersPage = useCallback(
    (page: number) => socialMediaApi.getFollowers(myUid, page, PAGE_SIZE),
    [myUid]
  );
  const followersList = usePaginatedList<UserCard>(fetchFollowersPage, cardKey);

  const fetchFollowingPage = useCallback(
    (page: number) => socialMediaApi.getFollowing(myUid, page, PAGE_SIZE),
    [myUid]
  );
  const followingList = usePaginatedList<UserCard>(fetchFollowingPage, cardKey);

  const fetchRequestsPage = useCallback((page: number) => socialMediaApi.getFollowRequests(page, PAGE_SIZE), []);
  const requestsList = usePaginatedList<UserCard>(fetchRequestsPage, cardKey);

  const fetchSuggestedPage = useCallback((page: number) => socialMediaApi.getSuggestedUsers(page, PAGE_SIZE), []);
  const suggestedList = usePaginatedList<UserCard>(fetchSuggestedPage, cardKey);

  const fetchSearchPage = useCallback(
    (page: number) => socialMediaApi.searchUsers(searchValue.trim(), page, PAGE_SIZE),
    [searchValue]
  );
  const searchList = usePaginatedList<UserCard>(fetchSearchPage, cardKey);

  // Initial load — Followers/Following/Requests are cheap and give the
  // Requests-tab badge a real count as soon as the screen opens.
  useEffect(() => {
    followersList.reload();
    followingList.reload();
    requestsList.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUid]);

  // Suggested is lazy — it's the only tab that opportunistically asks for
  // location permission, so we defer that prompt until the user actually
  // opens the tab rather than firing it the moment Friends is opened.
  useEffect(() => {
    if (activeTab !== 'Suggested') return;
    if (suggestedList.data.length === 0 && !suggestedList.loading) {
      suggestedList.reload();
    }
    if (!locationRequestedRef.current) {
      locationRequestedRef.current = true;
      (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') return;
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          await userApi.updateLocation(pos.coords.latitude, pos.coords.longitude);
          suggestedList.reload();
        } catch {
          // Silent — Suggested still works without location, just without distance sorting.
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Search debounce — resets to page 0 on every new query.
  useEffect(() => {
    clearTimeout(searchDebounce.current);
    if (!isSearching) {
      searchList.reset();
      return;
    }
    searchDebounce.current = setTimeout(() => {
      searchList.reload();
    }, 380);
    return () => clearTimeout(searchDebounce.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  const setActionLoading = (uid: string, loading: boolean) => {
    setActionLoadingUids((prev) => {
      const next = new Set(prev);
      if (loading) next.add(uid);
      else next.delete(uid);
      return next;
    });
  };

  const handleFollowPress = async (item: UserCard) => {
    const uid = item.firebaseUid;
    if (actionLoadingUids.has(uid)) return;
    const allLists = [followersList, followingList, suggestedList, searchList];
    setActionLoading(uid, true);
    try {
      if (item.relationshipStatus === 'NONE') {
        const res = await socialMediaApi.followUser(uid);
        const status: FollowRelationship = res?.status === 'PENDING' ? 'PENDING' : 'ACCEPTED';
        allLists.forEach((list) => list.updateItem(uid, { relationshipStatus: status }));
      } else {
        await socialMediaApi.unfollowUser(uid);
        allLists.forEach((list) => list.updateItem(uid, { relationshipStatus: 'NONE' }));
      }
    } catch {
      // Leave state as-is on failure so the user can retry.
    } finally {
      setActionLoading(uid, false);
    }
  };

  const handleAcceptRequest = async (item: UserCard) => {
    const uid = item.firebaseUid;
    if (actionLoadingUids.has(uid)) return;
    setActionLoading(uid, true);
    try {
      await socialMediaApi.acceptFollowRequest(uid);
      requestsList.removeItem(uid);
      followersList.updateItem(uid, { relationshipStatus: 'ACCEPTED' });
    } catch {
      // Leave the request in place on failure.
    } finally {
      setActionLoading(uid, false);
    }
  };

  const handleRejectRequest = async (item: UserCard) => {
    const uid = item.firebaseUid;
    if (actionLoadingUids.has(uid)) return;
    setActionLoading(uid, true);
    try {
      await socialMediaApi.rejectFollowRequest(uid);
      requestsList.removeItem(uid);
    } catch {
      // Leave the request in place on failure.
    } finally {
      setActionLoading(uid, false);
    }
  };

  const goToProfile = (uid: string) => router.push(`/friend-profile?user=${uid}` as any);
  const goToChat = (uid: string, name?: string) => router.push(`/chat/${uid}?name=${encodeURIComponent(name ?? '')}` as any);

  // ─── Sub-renderers ───────────────────────────────────────────

  const renderActionButton = (item: UserCard) => {
    const uid = item.firebaseUid;
    if (item.relationshipStatus === 'SELF') return null;
    if (actionLoadingUids.has(uid)) {
      return (
        <View style={[styles.followBtn, styles.followBtnLoading]}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      );
    }
    if (item.relationshipStatus === 'ACCEPTED') {
      return (
        <ScalePressable onPress={() => handleFollowPress(item)} style={[styles.followBtn, styles.followingBtn]}>
          <Text style={[styles.followBtnText, styles.followingBtnText]}>Following</Text>
        </ScalePressable>
      );
    }
    if (item.relationshipStatus === 'PENDING') {
      return (
        <ScalePressable onPress={() => handleFollowPress(item)} style={[styles.followBtn, styles.requestedBtn]}>
          <Text style={[styles.followBtnText, styles.requestedBtnText]}>Requested</Text>
        </ScalePressable>
      );
    }
    return (
      <ScalePressable onPress={() => handleFollowPress(item)} style={styles.followBtn}>
        <Text style={styles.followBtnText}>Follow</Text>
      </ScalePressable>
    );
  };

  const renderUserRow = (item: UserCard) => {
    const uid = item.firebaseUid;
    const sport = item.sports?.[0] ?? '';
    return (
      <TouchableOpacity key={uid} style={styles.userCard} activeOpacity={0.88} onPress={() => goToProfile(uid)}>
        <Image source={avatarSource(item.profileImageUrl)} style={styles.userAvatar} />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.displayName}</Text>
          <Text style={styles.userMeta}>{[sport, item.skillLevel].filter(Boolean).join(' · ')}</Text>
        </View>
        <View style={styles.userActions}>
          <TouchableOpacity style={styles.msgIconBtn} onPress={() => goToChat(uid, item.displayName)} activeOpacity={0.8}>
            <MessageCircle color={Colors.primary} size={18} strokeWidth={2} />
          </TouchableOpacity>
          {renderActionButton(item)}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSuggestedRow = (item: UserCard) => {
    const uid = item.firebaseUid;
    const skillColor = item.skillLevel ? SKILL_COLOR[item.skillLevel] ?? Colors.primary : Colors.primary;
    return (
      <TouchableOpacity key={uid} style={styles.userCard} activeOpacity={0.88} onPress={() => goToProfile(uid)}>
        <View style={styles.nearbyAvatarWrap}>
          <Image source={avatarSource(item.profileImageUrl)} style={styles.userAvatar} />
          {typeof item.distanceKm === 'number' && (
            <View style={styles.nearbyDistanceBadge}>
              <Text style={styles.nearbyDistanceText}>
                {item.distanceKm < 1 ? `${Math.round(item.distanceKm * 1000)}m` : `${item.distanceKm.toFixed(1)}km`}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.displayName}</Text>
          <View style={styles.nearbyMeta}>
            <Text style={styles.userMeta}>{item.sports?.[0] ?? ''}</Text>
            {!!item.skillLevel && (
              <View style={[styles.skillBadge, { backgroundColor: skillColor + '20' }]}>
                <Text style={[styles.skillText, { color: skillColor }]}>{item.skillLevel}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.userActions}>
          <TouchableOpacity style={styles.msgIconBtn} onPress={() => goToChat(uid, item.displayName)} activeOpacity={0.8}>
            <MessageCircle color={Colors.primary} size={18} strokeWidth={2} />
          </TouchableOpacity>
          {renderActionButton(item)}
        </View>
      </TouchableOpacity>
    );
  };

  const renderRequestRow = (item: UserCard) => {
    const uid = item.firebaseUid;
    const isLoading = actionLoadingUids.has(uid);
    return (
      <View key={uid} style={styles.requestCard}>
        <TouchableOpacity onPress={() => goToProfile(uid)} activeOpacity={0.85}>
          <Image source={avatarSource(item.profileImageUrl)} style={styles.requestAvatar} />
        </TouchableOpacity>
        <View style={styles.requestInfo}>
          <Text style={styles.userName}>{item.displayName}</Text>
          <Text style={styles.userMeta}>{[item.sports?.[0], item.skillLevel].filter(Boolean).join(' · ')}</Text>
        </View>
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <View style={styles.requestBtns}>
            <TouchableOpacity style={styles.declineBtn} onPress={() => handleRejectRequest(item)} activeOpacity={0.8}>
              <X color={Colors.neutral500} size={15} strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptRequest(item)} activeOpacity={0.85}>
              <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.acceptBtnGrad}>
                <Text style={styles.acceptBtnText}>Accept</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = (illustration: React.ReactNode, title: string, sub: string) => (
    <View style={styles.emptyWrap}>
      {illustration}
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );

  const renderPaginatedTab = (
    list: PaginatedList<UserCard>,
    renderRow: (item: UserCard) => React.ReactElement,
    emptyIllustration: React.ReactNode,
    emptyTitle: string,
    emptySub: string
  ) => {
    if (list.loading && list.data.length === 0) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      );
    }
    if (list.data.length === 0) {
      return renderEmptyState(emptyIllustration, emptyTitle, emptySub);
    }
    return (
      <FlatList
        data={list.data}
        keyExtractor={cardKey}
        renderItem={({ item }) => renderRow(item)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (!list.momentumRef.current) {
            list.momentumRef.current = true;
            list.loadMore();
          }
        }}
        onMomentumScrollBegin={() => {
          list.momentumRef.current = false;
        }}
        ListFooterComponent={
          list.loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : null
        }
      />
    );
  };

  const renderFollowersTab = () =>
    isSearching
      ? renderPaginatedTab(
          searchList,
          renderUserRow,
          <NoFollowingIllustration />,
          'No results',
          `No players found for "${searchValue.trim()}"`
        )
      : renderPaginatedTab(
          followersList,
          renderUserRow,
          <NoFollowersIllustration />,
          'No followers yet',
          'Share your profile to grow your network'
        );

  const renderFollowingTab = () =>
    isSearching
      ? renderPaginatedTab(
          searchList,
          renderUserRow,
          <NoFollowingIllustration />,
          'No results',
          `No players found for "${searchValue.trim()}"`
        )
      : renderPaginatedTab(
          followingList,
          renderUserRow,
          <NoFollowingIllustration />,
          'Not following anyone yet',
          'Discover players in Suggested'
        );

  const renderRequestsTab = () =>
    renderPaginatedTab(requestsList, renderRequestRow, <AllCaughtUpIllustration />, 'No pending requests', "You're all caught up!");

  const renderSuggestedTab = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.nearbyBanner}>
        <MapPin color={Colors.primary} size={16} strokeWidth={2} />
        <Text style={styles.nearbyBannerText}>People who share your sports, ranked by fit and distance</Text>
      </View>
      {renderPaginatedTab(
        suggestedList,
        renderSuggestedRow,
        <NoSuggestionsIllustration />,
        'No suggestions yet',
        'Follow a few players or add your sports in your profile'
      )}
    </View>
  );

  // ─── Root render ─────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Users color={Colors.primary} size={22} strokeWidth={2.5} />
          <Text style={styles.headerTitle}>Friends</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications' as any)} activeOpacity={0.8}>
            <Bell color={Colors.neutral700} size={20} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, isFocused && styles.searchWrapFocused]}>
        <Search color={Colors.neutral500} size={17} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          value={searchValue}
          onChangeText={setSearchValue}
          placeholder="Search players or clubs..."
          placeholderTextColor={Colors.neutral500}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          returnKeyType="search"
        />
        {!!searchValue && (
          <TouchableOpacity onPress={() => setSearchValue('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X color={Colors.neutral400} size={15} strokeWidth={2} />
          </TouchableOpacity>
        )}
        {isSearching && searchList.loading && <ActivityIndicator size="small" color={Colors.primary} />}
      </View>

      {/* Segment bar */}
      <View style={styles.segmentBar}>
        {SEGMENT_ITEMS.map((seg) => (
          <TouchableOpacity
            key={seg}
            style={[styles.segmentItem, activeTab === seg && styles.segmentItemActive]}
            onPress={() => setActiveTab(seg)}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, activeTab === seg && styles.segmentTextActive]}>{seg}</Text>
            {seg === 'Requests' && requestsList.data.length > 0 && (
              <View style={styles.requestBadge}>
                <Text style={styles.requestBadgeText}>{requestsList.data.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'Followers' && renderFollowersTab()}
        {activeTab === 'Following' && renderFollowingTab()}
        {activeTab === 'Requests' && renderRequestsTab()}
        {activeTab === 'Suggested' && renderSuggestedTab()}
      </View>

      <BottomNavbar activeTab="FRIENDS" showCreateButton={false} />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: Colors.text },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.neutral200,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 18, marginBottom: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1.5, borderColor: Colors.neutral200,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  searchWrapFocused: { borderColor: Colors.primary, shadowColor: Colors.primary, shadowOpacity: 0.15 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.text, padding: 0 },

  // Segment bar
  segmentBar: {
    flexDirection: 'row', marginHorizontal: 18, marginBottom: 16,
    backgroundColor: Colors.white, borderRadius: 16, padding: 4,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  segmentItem: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4,
  },
  segmentItemActive: { backgroundColor: Colors.primary },
  segmentText: { fontSize: 12, fontWeight: '700', color: Colors.neutral500 },
  segmentTextActive: { color: Colors.white },
  requestBadge: {
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.liveRed, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  requestBadgeText: { fontSize: 9, fontWeight: '900', color: Colors.white },

  // Lists
  listContent: { paddingHorizontal: 18, paddingBottom: 120, gap: 12, paddingTop: 4 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  footerLoading: { paddingVertical: 16, alignItems: 'center' },

  // User card
  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 18, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  userAvatar: { width: 52, height: 52, borderRadius: 16 },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 3 },
  userMeta: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  userActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  msgIconBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  followBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.white,
    minWidth: 76, alignItems: 'center', justifyContent: 'center',
  },
  followBtnLoading: { borderColor: Colors.neutral200 },
  followBtnText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  followingBtn: { backgroundColor: Colors.neutral100, borderColor: Colors.neutral200 },
  followingBtnText: { color: Colors.neutral600 },
  requestedBtn: { backgroundColor: Colors.primaryLight, borderColor: Colors.primaryLight },
  requestedBtnText: { color: Colors.primary },

  // Request card
  requestCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 18, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  requestAvatar: { width: 52, height: 52, borderRadius: 16 },
  requestInfo: { flex: 1 },
  requestBtns: { flexDirection: 'row', gap: 8 },
  declineBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: Colors.neutral100, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.neutral200,
  },
  acceptBtn: { borderRadius: 12, overflow: 'hidden' },
  acceptBtnGrad: { paddingHorizontal: 16, paddingVertical: 10 },
  acceptBtnText: { fontSize: 13, fontWeight: '800', color: Colors.white },

  // Suggested
  nearbyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primaryLight, borderRadius: 14, padding: 12,
    marginHorizontal: 18, marginBottom: 4,
  },
  nearbyBannerText: { fontSize: 13, fontWeight: '600', color: Colors.primary, flex: 1 },
  nearbyAvatarWrap: { position: 'relative' },
  nearbyDistanceBadge: {
    position: 'absolute', bottom: -4, right: -4,
    backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 1.5, borderColor: Colors.white,
  },
  nearbyDistanceText: { fontSize: 8, fontWeight: '800', color: Colors.white },
  nearbyMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  skillBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  skillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingTop: 44, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
});
