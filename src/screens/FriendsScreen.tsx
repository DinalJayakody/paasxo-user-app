import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  Pressable,
  ScrollView,
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
  Plus,
  Search,
  UserPlus,
  X,
  MapPin,
  Users,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../styles/colors';
import { BottomNavbar } from '../components/BottomNavbar';
import { socialMediaApi } from '../api/socialMediaApi';
import { useAuth } from '../context/AuthContext';

// ─── Demo data (replaces with real API results) ──────────────

const DEMO_REQUESTS = [
  { id: '1', name: 'Marcus Chen', sport: 'FUTSAL', location: 'MUMBAI', avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=400', firebaseUid: 'uid1' },
  { id: '2', name: 'Sarah Jenkins', sport: 'CRICKET', location: 'BANGALORE', avatar: 'https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&cs=tinysrgb&w=400', firebaseUid: 'uid2' },
];

const DEMO_NEARBY = [
  { id: 'n1', name: 'Ravi Patel', sport: 'CRICKET', distance: '0.4 km', avatar: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=400', firebaseUid: 'nuid1', skill: 'INTERMEDIATE' },
  { id: 'n2', name: 'Aisha Nwosu', sport: 'FUTSAL', distance: '0.8 km', avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=400', firebaseUid: 'nuid2', skill: 'ADVANCED' },
  { id: 'n3', name: 'Liam Torres', sport: 'PICKLEBALL', distance: '1.2 km', avatar: 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=400', firebaseUid: 'nuid3', skill: 'BEGINNER' },
  { id: 'n4', name: 'Yuna Kim', sport: 'FUTSAL', distance: '1.9 km', avatar: 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=400', firebaseUid: 'nuid4', skill: 'INTERMEDIATE' },
  { id: 'n5', name: 'Omar Siddiqui', sport: 'CRICKET', distance: '2.3 km', avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=400', firebaseUid: 'nuid5', skill: 'ADVANCED' },
];

const SEGMENT_ITEMS = ['Followers', 'Following', 'Requests', 'Nearby'] as const;
type Segment = typeof SEGMENT_ITEMS[number];

const SKILL_COLOR: Record<string, string> = {
  BEGINNER: Colors.success,
  INTERMEDIATE: Colors.warning,
  ADVANCED: Colors.liveRed,
};

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

// ─── Main screen ─────────────────────────────────────────────

export default function FriendsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Segment>('Followers');
  const [searchValue, setSearchValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [requests, setRequests] = useState(DEMO_REQUESTS);
  const [nearby] = useState(DEMO_NEARBY);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const { user } = useAuth();
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load followers / following from API
  useEffect(() => {
    const uid = user?.firebaseUid ?? 'me';
    loadFollowers(uid);
    loadFollowing(uid);
  }, [user]);

  const loadFollowers = async (uid: string) => {
    setLoadingFollowers(true);
    try {
      const data = await socialMediaApi.getFollowers(uid);
      setFollowers(Array.isArray(data) ? data : []);
    } catch {
      setFollowers([]);
    } finally {
      setLoadingFollowers(false);
    }
  };

  const loadFollowing = async (uid: string) => {
    setLoadingFollowing(true);
    try {
      const data = await socialMediaApi.getFollowing(uid);
      setFollowing(Array.isArray(data) ? data : []);
    } catch {
      setFollowing([]);
    } finally {
      setLoadingFollowing(false);
    }
  };

  // Search debounce
  useEffect(() => {
    clearTimeout(searchDebounce.current);
    if (searchValue.trim().length < 2) { setSearchResults([]); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await socialMediaApi.searchUsers(searchValue.trim());
        const arr = Array.isArray(res) ? res : Array.isArray((res as any)?.data) ? (res as any).data : [];
        setSearchResults(arr);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 380);
    return () => clearTimeout(searchDebounce.current);
  }, [searchValue]);

  const handleAccept = (id: string) => setRequests((prev) => prev.filter((r) => r.id !== id));
  const handleDecline = (id: string) => setRequests((prev) => prev.filter((r) => r.id !== id));

  const handleUnfollow = async (uid: string) => {
    try {
      await socialMediaApi.unfollowUser(uid);
      setFollowing((prev) => prev.filter((u: any) => (u.firebaseUid ?? u.id) !== uid));
    } catch {}
  };

  const handleFollow = async (uid: string) => {
    try {
      await socialMediaApi.followUser(uid);
    } catch {}
  };

  const goToProfile = (uid: string) => router.push(`/friend-profile?user=${uid}` as any);
  const goToChat = (uid: string, name?: string) => router.push(`/chat/${uid}?name=${encodeURIComponent(name ?? '')}` as any);

  // ─── Sub-renderers ───────────────────────────────────────────

  const renderUserRow = (user: any, actions: React.ReactNode) => {
    const uid = user.firebaseUid ?? user.id ?? user._id;
    const name = user.displayName ?? user.name ?? 'Unknown';
    const avatar = user.profileImageUrl ?? user.avatar;
    const sport = user.sport ?? '';
    const location = user.location ?? '';

    return (
      <TouchableOpacity
        key={uid}
        style={styles.userCard}
        activeOpacity={0.88}
        onPress={() => goToProfile(uid)}
      >
        <Image
          source={avatar
            ? { uri: avatar.startsWith('http') ? avatar : `data:image/jpeg;base64,${avatar}` }
            : { uri: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=400' }}
          style={styles.userAvatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{name}</Text>
          <Text style={styles.userMeta}>
            {[sport, location].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={styles.userActions}>
          <TouchableOpacity style={styles.msgIconBtn} onPress={() => goToChat(uid, name)} activeOpacity={0.8}>
            <MessageCircle color={Colors.primary} size={18} strokeWidth={2} />
          </TouchableOpacity>
          {actions}
        </View>
      </TouchableOpacity>
    );
  };

  const renderFollowersTab = () => {
    const list = searchValue.trim().length > 0 ? searchResults : followers;
    const loading = searchValue.trim().length > 0 ? searchLoading : loadingFollowers;
    return (
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.loadingWrap}><ActivityIndicator color={Colors.primary} /></View>
        ) : list.length === 0 ? (
          renderEmptyState('👥', 'No followers yet', 'Share your profile to grow your network')
        ) : (
          <FlatList
            data={list}
            keyExtractor={(u: any) => u.firebaseUid ?? u.id ?? Math.random().toString()}
            renderItem={({ item }) =>
              renderUserRow(item, (
                <ScalePressable onPress={() => handleFollow(item.firebaseUid ?? item.id)} style={styles.followBtn}>
                  <Text style={styles.followBtnText}>Follow</Text>
                </ScalePressable>
              ))
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  };

  const renderFollowingTab = () => {
    const list = searchValue.trim().length > 0 ? searchResults : following;
    const loading = searchValue.trim().length > 0 ? searchLoading : loadingFollowing;
    return (
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.loadingWrap}><ActivityIndicator color={Colors.primary} /></View>
        ) : list.length === 0 ? (
          renderEmptyState('🔍', 'Not following anyone yet', 'Discover players in Explore')
        ) : (
          <FlatList
            data={list}
            keyExtractor={(u: any) => u.firebaseUid ?? u.id ?? Math.random().toString()}
            renderItem={({ item }) =>
              renderUserRow(item, (
                <ScalePressable onPress={() => handleUnfollow(item.firebaseUid ?? item.id)} style={[styles.followBtn, styles.followingBtn]}>
                  <Text style={[styles.followBtnText, styles.followingBtnText]}>Following</Text>
                </ScalePressable>
              ))
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  };

  const renderRequestsTab = () => {
    if (requests.length === 0) {
      return renderEmptyState('✅', 'No pending requests', 'You\'re all caught up!');
    }
    return (
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {requests.map((req) => (
          <View key={req.id} style={styles.requestCard}>
            <TouchableOpacity onPress={() => goToProfile(req.firebaseUid)} activeOpacity={0.85}>
              <Image source={{ uri: req.avatar }} style={styles.requestAvatar} />
            </TouchableOpacity>
            <View style={styles.requestInfo}>
              <Text style={styles.userName}>{req.name}</Text>
              <Text style={styles.userMeta}>{req.sport} · {req.location}</Text>
            </View>
            <View style={styles.requestBtns}>
              <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(req.id)} activeOpacity={0.8}>
                <X color={Colors.neutral500} size={15} strokeWidth={2.5} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(req.id)} activeOpacity={0.85}>
                <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.acceptBtnGrad}>
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderNearbyTab = () => (
    <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
      {/* Info banner */}
      <View style={styles.nearbyBanner}>
        <MapPin color={Colors.primary} size={16} strokeWidth={2} />
        <Text style={styles.nearbyBannerText}>Players within 5 km of your location</Text>
      </View>

      {nearby.map((player) => (
        <TouchableOpacity
          key={player.id}
          style={styles.userCard}
          activeOpacity={0.88}
          onPress={() => goToProfile(player.firebaseUid)}
        >
          <View style={styles.nearbyAvatarWrap}>
            <Image source={{ uri: player.avatar }} style={styles.userAvatar} />
            <View style={[styles.nearbyDistanceBadge]}>
              <Text style={styles.nearbyDistanceText}>{player.distance}</Text>
            </View>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{player.name}</Text>
            <View style={styles.nearbyMeta}>
              <Text style={styles.userMeta}>{player.sport}</Text>
              <View style={[styles.skillBadge, { backgroundColor: SKILL_COLOR[player.skill] + '20' }]}>
                <Text style={[styles.skillText, { color: SKILL_COLOR[player.skill] }]}>{player.skill}</Text>
              </View>
            </View>
          </View>
          <View style={styles.userActions}>
            <TouchableOpacity style={styles.msgIconBtn} onPress={() => goToChat(player.firebaseUid, player.name)} activeOpacity={0.8}>
              <MessageCircle color={Colors.primary} size={18} strokeWidth={2} />
            </TouchableOpacity>
            <ScalePressable onPress={() => handleFollow(player.firebaseUid)} style={styles.followBtn}>
              <Text style={styles.followBtnText}>Follow</Text>
            </ScalePressable>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderEmptyState = (emoji: string, title: string, sub: string) => (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
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
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8}>
            <Bell color={Colors.neutral700} size={20} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/create-match' as any)} activeOpacity={0.8}>
            <UserPlus color={Colors.neutral700} size={20} strokeWidth={2} />
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
          <TouchableOpacity onPress={() => { setSearchValue(''); setSearchResults([]); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X color={Colors.neutral400} size={15} strokeWidth={2} />
          </TouchableOpacity>
        )}
        {searchLoading && <ActivityIndicator size="small" color={Colors.primary} />}
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
            {seg === 'Requests' && requests.length > 0 && (
              <View style={styles.requestBadge}>
                <Text style={styles.requestBadgeText}>{requests.length}</Text>
              </View>
            )}
            {seg === 'Nearby' && (
              <View style={styles.nearbyBadgeDot} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'Followers' && renderFollowersTab()}
        {activeTab === 'Following' && renderFollowingTab()}
        {activeTab === 'Requests' && renderRequestsTab()}
        {activeTab === 'Nearby' && renderNearbyTab()}
      </View>

      {/* Create Team FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/create-match' as any)}
        activeOpacity={0.88}
      >
        <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.fabGrad}>
          <Plus color={Colors.white} size={22} strokeWidth={2.5} />
        </LinearGradient>
      </TouchableOpacity>

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
  nearbyBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },

  // Lists
  listContent: { paddingHorizontal: 18, paddingBottom: 120, gap: 12, paddingTop: 4 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },

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
  },
  followBtnText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  followingBtn: { backgroundColor: Colors.neutral100, borderColor: Colors.neutral200 },
  followingBtnText: { color: Colors.neutral600 },

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

  // Nearby
  nearbyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primaryLight, borderRadius: 14, padding: 12, marginBottom: 4,
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
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },

  // FAB
  fab: {
    position: 'absolute', right: 20, bottom: 88,
    borderRadius: 18, overflow: 'hidden',
    shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  fabGrad: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
});
