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
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
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
import { FollowListModal } from '../components/FollowListModal';
import ScreenGlow from '../components/ScreenGlow';

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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
  const [followModalTab, setFollowModalTab] = useState<'Followers' | 'Following' | null>(null);

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
  const sportColor = { CRICKET: colors.cricket, FUTSAL: colors.futsal, PICKLEBALL: colors.pickleball }[sport] || colors.primary;

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
          <Lock color={colors.neutral400} size={36} strokeWidth={1.8} />
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
      <ScreenGlow />
      <PaasxoRefreshLogo refreshing={refreshing} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: navBarHeight + 38 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<PaasxoRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <Animated.View style={[styles.profileCardHeader, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
          <AnimatedPressable onPress={() => router.back()} style={styles.topIconButton}>
            <ArrowLeft color={colors.neutral900} size={18} strokeWidth={2} />
          </AnimatedPressable>
          <AnimatedPressable onPress={() => {}} style={styles.topIconButton}>
            <MoreVertical color={colors.neutral900} size={18} strokeWidth={2} />
          </AnimatedPressable>
        </Animated.View>

        {/* Hero gradient banner */}
        <LinearGradient colors={[sportColor + '28', colors.background]} style={styles.heroBanner}>
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
              { value: postsLoading ? '…' : String(posts.length), label: 'POSTS', onPress: undefined },
              { value: String(profileData?.followersCount ?? 0), label: 'FOLLOWERS', onPress: () => setFollowModalTab('Followers') },
              { value: String(profileData?.followingCount ?? 0), label: 'FOLLOWING', onPress: () => setFollowModalTab('Following') },
            ].map((s, i) => (
              <Pressable key={i} style={styles.socialStatItem} onPress={s.onPress} disabled={!s.onPress}>
                <Text style={styles.socialStatValue}>{s.value}</Text>
                <Text style={styles.socialStatLabel}>{s.label}</Text>
              </Pressable>
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
              <MessageCircle color={colors.white} size={16} strokeWidth={2} />
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
      {!!userId && (
        <FollowListModal
          visible={followModalTab !== null}
          onClose={() => setFollowModalTab(null)}
          uid={userId}
          initialTab={followModalTab ?? 'Followers'}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, gap: 12 },
  loadingText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  content: { paddingBottom: 120 },

  profileCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  topIconButton: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.neutral200,
    shadowColor: colors.neutral900, shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },

  heroBanner: {
    marginHorizontal: 16, borderRadius: 24, paddingTop: 20, paddingBottom: 24,
    paddingHorizontal: 20, alignItems: 'center', marginBottom: 4,
    borderWidth: 1, borderColor: colors.neutral200 + '60',
  },

  avatarContainer: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 4, borderColor: colors.white, backgroundColor: colors.neutral100,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14, overflow: 'visible',
    shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  avatar: { width: 112, height: 112, borderRadius: 56 },
  sportBadgeOnAvatar: {
    position: 'absolute', bottom: -2, right: -2,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.white,
  },
  sportBadgeEmoji: { fontSize: 14 },

  profileName: { fontSize: 24, fontWeight: '900', color: colors.neutral900, marginBottom: 6, textAlign: 'center' },
  profileRole: { fontSize: 11, fontWeight: '800', color: colors.neutral500, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12, textAlign: 'center' },
  profileBio: { fontSize: 13, lineHeight: 20, textAlign: 'center', color: colors.textSecondary, marginBottom: 18, paddingHorizontal: 8 },

  socialStatsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 20, paddingHorizontal: 8 },
  socialStatItem: { flex: 1, alignItems: 'center' },
  socialStatValue: { fontSize: 20, fontWeight: '800', color: colors.primary, marginBottom: 4 },
  socialStatLabel: { fontSize: 10, fontWeight: '700', color: colors.neutral500, letterSpacing: 1.1, textTransform: 'uppercase' },

  buttonsRow: { flexDirection: 'row', width: '100%', gap: 12 },
  followButton: {
    flex: 1, height: 46, borderRadius: 23, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  followButtonActive: { backgroundColor: colors.cardBg, borderWidth: 1.5, borderColor: colors.neutral200 },
  followButtonText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  followButtonTextActive: { color: colors.neutral900 },
  messageButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingHorizontal: 20, height: 46, borderRadius: 23, backgroundColor: colors.neutral900,
  },
  messageButtonText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  buttonShadow: { shadowColor: colors.neutral900, shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },

  tabRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 16, backgroundColor: colors.cardBg,
    borderRadius: 16, padding: 4,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.neutral400 },
  tabUnderline: { marginTop: 4, width: 20, height: 3, borderRadius: 2 },

  statsSportBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 16, backgroundColor: colors.cardBg,
    borderRadius: 12, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  statsSportEmoji: { fontSize: 22 },
  statsSportLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },

  emptyTabContent: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32, gap: 8 },
  emptyTabEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTabTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptyTabSubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
