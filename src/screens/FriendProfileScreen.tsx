import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MoreVertical, Share2, MessageCircle, Lock } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomNavbar, useBottomNavBarHeight } from '../components/BottomNavbar';
import { Colors } from '../styles/colors';
import { socialMediaApi } from '../api/socialMediaApi';
import { reelApi } from '../api/reelApi';
import { resolveAvatarUri } from '../utils/mediaUrl';
import { PostGrid } from '../components/PostGrid';
import { ReelGrid } from '../components/ReelGrid';
import { PostSummary, ReelSummary } from '../types/api';
import { FullScreenImageViewer } from '../components/FullScreenImageViewer';
import { LoadingScreen } from '../components/LoadingScreen';
import { PaasxoLogoLoader } from '../components/PaasxoLogoLoader';
import { PaasxoRefreshControl } from '../components/PaasxoRefreshControl';
import { PaasxoRefreshLogo } from '../components/PaasxoRefreshLogo';

const FRIEND_TABS = ['Moments', 'Stats', 'Reels', 'Tagged'] as const;
type FriendTab = (typeof FRIEND_TABS)[number];

const AnimatedPressable = ({
  onPress,
  children,
  style,
  disabled,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: any;
  disabled?: boolean;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const animate = (toValue: number) => {
    Animated.spring(scaleAnim, { toValue, useNativeDriver: true, friction: 12, tension: 160 }).start();
  };
  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable
        onPressIn={() => animate(0.96)}
        onPressOut={() => animate(1)}
        onPress={onPress}
        disabled={disabled}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

// Same visual language as ProfileScreen (own profile) - hero gradient banner,
// avatar treatment, stat row, tab row - so the two screens read as one
// consistent design. Differs only where the context genuinely differs:
// Follow/Message instead of Edit/Share, and no avatar-change options.
export default function FriendProfileScreen() {
  const navBarHeight = useBottomNavBarHeight();
  const router = useRouter();
  const { user } = useLocalSearchParams();
  const userId = Array.isArray(user) ? user[0] : user;

  const [selectedTab, setSelectedTab] = useState<FriendTab>('Moments');
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [relationshipStatus, setRelationshipStatus] = useState<'NONE' | 'PENDING' | 'ACCEPTED'>('NONE');
  const [actionLoading, setActionLoading] = useState(false);

  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const [reels, setReels] = useState<ReelSummary[]>([]);
  const [reelsLoading, setReelsLoading] = useState(false);
  const [reelsLoaded, setReelsLoaded] = useState(false);

  const [avatarViewerVisible, setAvatarViewerVisible] = useState(false);

  const headerSlide = useRef(new Animated.Value(-20)).current;
  const headerFade = useRef(new Animated.Value(0)).current;
  const avatarScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(avatarScale, { toValue: 1, friction: 6, useNativeDriver: true }),
      Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(headerSlide, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchPosts = React.useCallback(async () => {
    if (!userId) return;
    setPostsLoading(true);
    try {
      const res = await socialMediaApi.getUserPosts(userId as string, 0, 30);
      setPosts(res.content);
    } catch {
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const fetchProfile = React.useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const res = await socialMediaApi.getUserProfile(userId as string);
      setProfileData(res);
      // Jackson strips the "is"/"has" prefix from boolean getters, so these
      // come back as `following`/`private`/`hasPendingRequestFromMe` on the
      // wire even though the DTO fields are isFollowing/isPrivate/etc.
      setRelationshipStatus(res.following ? 'ACCEPTED' : res.hasPendingRequestFromMe ? 'PENDING' : 'NONE');
    } catch (err) {
      console.log('PROFILE ERROR:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const fetchReels = React.useCallback(async () => {
    if (!userId) return;
    setReelsLoading(true);
    try {
      const res = await reelApi.getUserReels(userId as string);
      setReels(res.content);
    } catch {
      setReels([]);
    } finally {
      setReelsLoading(false);
      setReelsLoaded(true);
    }
  }, [userId]);

  // Reels tab is fetched lazily, the first time it's opened - same pattern as ProfileScreen.
  useEffect(() => {
    if (selectedTab !== 'Reels' || reelsLoaded || !userId) return;
    fetchReels();
  }, [selectedTab, reelsLoaded, userId, fetchReels]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const tasks = [fetchProfile(), fetchPosts()];
      if (selectedTab === 'Reels') tasks.push(fetchReels());
      await Promise.all(tasks);
    } finally {
      setRefreshing(false);
    }
  }, [fetchProfile, fetchPosts, fetchReels, selectedTab]);

  const handleFollowToggle = async () => {
    try {
      setActionLoading(true);
      if (relationshipStatus === 'NONE') {
        const res = await socialMediaApi.followUser(userId as string);
        setRelationshipStatus(res?.status === 'PENDING' ? 'PENDING' : 'ACCEPTED');
      } else {
        // Also cancels a still-pending request.
        await socialMediaApi.unfollowUser(userId as string);
        setRelationshipStatus('NONE');
      }
    } catch (err) {
      console.log('FOLLOW ERROR:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const profile = profileData?.profile;

  const sport = useMemo<string>(() => {
    const s = Array.isArray(profile?.sports) ? profile.sports[0] : profile?.sport;
    return (s || 'FUTSAL').toString().toUpperCase();
  }, [profile]);

  const sportEmoji = { CRICKET: '🏏', FUTSAL: '⚽', PICKLEBALL: '🏓' }[sport] || '🏅';
  const sportColor = { CRICKET: Colors.cricket, FUTSAL: Colors.futsal, PICKLEBALL: Colors.pickleball }[sport] || Colors.primary;

  const profileImageUri = useMemo(
    () => resolveAvatarUri(profile?.profileImageUrl, profile?.displayName),
    [profile]
  );

  const displayName = profile?.displayName || 'Sports Player';
  const sportsText = Array.isArray(profile?.sports) ? profile.sports.join(' • ').toUpperCase() : sport;
  const skillLevel = profile?.skillLevel ? ` • ${String(profile.skillLevel).toUpperCase()}` : '';
  const bioText = profile?.bio || `Passionate ${sport.toLowerCase()} player striving for excellence in every match.`;
  const isPrivateAndLocked = !!profileData?.isRestricted;

  if (loading || !profileData) {
    return <LoadingScreen message="Loading profile…" />;
  }

  const renderMomentsTab = () => {
    if (isPrivateAndLocked) {
      return (
        <View style={styles.emptyTabContent}>
          <Lock color={Colors.neutral400} size={36} strokeWidth={1.8} />
          <Text style={styles.emptyTabTitle}>This account is private</Text>
          <Text style={styles.emptyTabSubtitle}>Follow {displayName.split(' ')[0]} to see their moments.</Text>
        </View>
      );
    }
    if (postsLoading) {
      return (
        <View style={styles.emptyTabContent}>
          <PaasxoLogoLoader size={44} elevated={false} />
          <Text style={styles.emptyTabSubtitle}>Loading moments...</Text>
        </View>
      );
    }
    if (posts.length === 0) {
      return (
        <View style={styles.emptyTabContent}>
          <Text style={styles.emptyTabEmoji}>📸</Text>
          <Text style={styles.emptyTabTitle}>No moments yet</Text>
        </View>
      );
    }
    return (
      <PostGrid
        posts={posts}
        selectedPostId={selectedPostId}
        onSelectPost={(post) => setSelectedPostId(post.id)}
        onCloseDetail={() => setSelectedPostId(null)}
      />
    );
  };

  const renderReelsTab = () => {
    if (reelsLoading) {
      return (
        <View style={styles.emptyTabContent}>
          <PaasxoLogoLoader size={44} elevated={false} />
          <Text style={styles.emptyTabSubtitle}>Loading reels...</Text>
        </View>
      );
    }
    if (reels.length === 0) {
      return (
        <View style={styles.emptyTabContent}>
          <Text style={styles.emptyTabEmoji}>🎬</Text>
          <Text style={styles.emptyTabTitle}>No reels yet</Text>
        </View>
      );
    }
    return <ReelGrid reels={reels} />;
  };

  const renderStatsTab = () => (
    <View style={styles.statsSportBadge}>
      <Text style={styles.statsSportEmoji}>{sportEmoji}</Text>
      <Text style={[styles.statsSportLabel, { color: sportColor }]}>{sport} STATISTICS</Text>
    </View>
  );

  const renderEmptyTab = (label: string) => (
    <View style={styles.emptyTabContent}>
      <Text style={styles.emptyTabEmoji}>🏷️</Text>
      <Text style={styles.emptyTabTitle}>No {label} yet</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <PaasxoRefreshLogo refreshing={refreshing} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: navBarHeight + 38 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<PaasxoRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <Animated.View style={[styles.profileCardHeader, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
          <AnimatedPressable onPress={() => router.back()} style={styles.topIconButton}>
            <ArrowLeft color={Colors.neutral900} size={18} strokeWidth={2} />
          </AnimatedPressable>
          <AnimatedPressable onPress={() => {}} style={styles.topIconButton}>
            <MoreVertical color={Colors.neutral900} size={18} strokeWidth={2} />
          </AnimatedPressable>
        </Animated.View>

        {/* Hero gradient banner */}
        <LinearGradient colors={[sportColor + '28', Colors.background]} style={styles.heroBanner}>
          <Pressable onPress={() => setAvatarViewerVisible(true)}>
            <Animated.View style={[styles.avatarContainer, { transform: [{ scale: avatarScale }] }]}>
              <Image source={{ uri: profileImageUri }} style={styles.avatar} />
              <View style={[styles.sportBadgeOnAvatar, { backgroundColor: sportColor }]}>
                <Text style={styles.sportBadgeEmoji}>{sportEmoji}</Text>
              </View>
            </Animated.View>
          </Pressable>

          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileRole}>{sportsText}{skillLevel}</Text>
          <Text style={styles.profileBio}>{bioText}</Text>

          <View style={styles.socialStatsRow}>
            {[
              { value: postsLoading ? '…' : String(posts.length), label: 'POSTS' },
              { value: String(profileData?.followersCount ?? 0), label: 'FOLLOWERS' },
              { value: String(profileData?.followingCount ?? 0), label: 'FOLLOWING' },
            ].map((s, i) => (
              <View key={i} style={styles.socialStatItem}>
                <Text style={styles.socialStatValue}>{s.value}</Text>
                <Text style={styles.socialStatLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.buttonsRow}>
            <AnimatedPressable
              onPress={handleFollowToggle}
              disabled={actionLoading}
              style={[
                styles.followButton,
                styles.buttonShadow,
                relationshipStatus !== 'NONE' && styles.followButtonActive,
              ]}
            >
              <Text style={[styles.followButtonText, relationshipStatus !== 'NONE' && styles.followButtonTextActive]}>
                {actionLoading
                  ? 'Loading...'
                  : relationshipStatus === 'ACCEPTED'
                    ? 'Following'
                    : relationshipStatus === 'PENDING'
                      ? 'Requested'
                      : 'Follow'}
              </Text>
            </AnimatedPressable>
            <AnimatedPressable onPress={() => {}} style={[styles.messageButton, styles.buttonShadow]}>
              <MessageCircle color={Colors.white} size={16} strokeWidth={2} />
              <Text style={styles.messageButtonText}>Message</Text>
            </AnimatedPressable>
          </View>
        </LinearGradient>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {FRIEND_TABS.map((tab) => {
            const active = tab === selectedTab;
            return (
              <Pressable key={tab} onPress={() => setSelectedTab(tab)} style={styles.tabItem}>
                <Text style={[styles.tabText, active && { color: sportColor }]}>{tab}</Text>
                {active && <View style={[styles.tabUnderline, { backgroundColor: sportColor }]} />}
              </Pressable>
            );
          })}
        </View>

        {selectedTab === 'Moments' && renderMomentsTab()}
        {selectedTab === 'Stats' && renderStatsTab()}
        {selectedTab === 'Reels' && renderReelsTab()}
        {selectedTab === 'Tagged' && renderEmptyTab('tags')}
      </ScrollView>

      <BottomNavbar activeTab="FRIENDS" showCreateButton={false} />

      <FullScreenImageViewer
        visible={avatarViewerVisible}
        imageUri={profileImageUri}
        onClose={() => setAvatarViewerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, gap: 12 },
  loadingText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  content: { paddingBottom: 120 },

  profileCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  topIconButton: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.neutral200,
    shadowColor: Colors.neutral900, shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },

  heroBanner: {
    marginHorizontal: 16, borderRadius: 24, paddingTop: 20, paddingBottom: 24,
    paddingHorizontal: 20, alignItems: 'center', marginBottom: 4,
    borderWidth: 1, borderColor: Colors.neutral200 + '60',
  },

  avatarContainer: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 4, borderColor: Colors.white, backgroundColor: Colors.neutral100,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14, overflow: 'visible',
    shadowColor: Colors.primary, shadowOpacity: 0.25, shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  avatar: { width: 112, height: 112, borderRadius: 56 },
  sportBadgeOnAvatar: {
    position: 'absolute', bottom: -2, right: -2,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  sportBadgeEmoji: { fontSize: 14 },

  profileName: { fontSize: 24, fontWeight: '900', color: Colors.neutral900, marginBottom: 6, textAlign: 'center' },
  profileRole: { fontSize: 11, fontWeight: '800', color: Colors.neutral500, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12, textAlign: 'center' },
  profileBio: { fontSize: 13, lineHeight: 20, textAlign: 'center', color: Colors.textSecondary, marginBottom: 18, paddingHorizontal: 8 },

  socialStatsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 20, paddingHorizontal: 8 },
  socialStatItem: { flex: 1, alignItems: 'center' },
  socialStatValue: { fontSize: 20, fontWeight: '800', color: Colors.primary, marginBottom: 4 },
  socialStatLabel: { fontSize: 10, fontWeight: '700', color: Colors.neutral500, letterSpacing: 1.1, textTransform: 'uppercase' },

  buttonsRow: { flexDirection: 'row', width: '100%', gap: 12 },
  followButton: {
    flex: 1, height: 46, borderRadius: 23, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  followButtonActive: { backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.neutral200 },
  followButtonText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  followButtonTextActive: { color: Colors.neutral900 },
  messageButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingHorizontal: 20, height: 46, borderRadius: 23, backgroundColor: Colors.neutral900,
  },
  messageButtonText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  buttonShadow: { shadowColor: Colors.neutral900, shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },

  tabRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 16, backgroundColor: Colors.white,
    borderRadius: 16, padding: 4,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  tabText: { fontSize: 13, fontWeight: '700', color: Colors.neutral400 },
  tabUnderline: { marginTop: 4, width: 20, height: 3, borderRadius: 2 },

  statsSportBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 16, backgroundColor: Colors.white,
    borderRadius: 12, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  statsSportEmoji: { fontSize: 22 },
  statsSportLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },

  emptyTabContent: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32, gap: 8 },
  emptyTabEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTabTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  emptyTabSubtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
