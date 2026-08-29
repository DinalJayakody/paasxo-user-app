import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Settings,
  Activity,
  Target,
  Star,
  Trophy,
  Share2,
  TrendingUp,
  Zap,
  Award,
  Shield,
  Users,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomNavbar, useBottomNavBarHeight } from '../components/BottomNavbar';
import { Colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { socialMediaApi } from '../api/socialMediaApi';
import { userApi } from '../api/userApi';
import { resolveAvatarUri } from '../utils/mediaUrl';
import { PostGrid } from '../components/PostGrid';
import { ReelGrid } from '../components/ReelGrid';
import { PostSummary, ReelSummary } from '../types/api';
import { reelApi } from '../api/reelApi';
import { FullScreenImageViewer } from '../components/FullScreenImageViewer';
import { AvatarActionSheet } from '../components/AvatarActionSheet';
import { LoadingScreen } from '../components/LoadingScreen';
import { PaasxoLogoLoader } from '../components/PaasxoLogoLoader';
import { PaasxoRefreshControl } from '../components/PaasxoRefreshControl';
import { PaasxoRefreshLogo } from '../components/PaasxoRefreshLogo';

const SPORT_STATS: Record<string, { icon: any; value: string; label: string; color: string }[]> = {
  CRICKET: [
    { icon: Activity, value: '87', label: 'Matches', color: Colors.cricket },
    { icon: TrendingUp, value: '1,240', label: 'Runs', color: Colors.primaryDark },
    { icon: Target, value: '6', label: 'Wickets', color: Colors.success },
    { icon: Zap, value: '138.4', label: 'Strike Rate', color: Colors.primaryAccent },
    { icon: Star, value: '12', label: 'Half-Centuries', color: Colors.warning },
    { icon: Award, value: '3', label: 'Centuries', color: Colors.liveRed },
    { icon: Shield, value: '42.6', label: 'Avg. Score', color: Colors.cricket },
    { icon: Trophy, value: '5', label: 'MVP Awards', color: Colors.primaryDark },
  ],
  FUTSAL: [
    { icon: Activity, value: '64', label: 'Matches', color: Colors.futsal },
    { icon: Target, value: '42', label: 'Goals', color: Colors.liveRed },
    { icon: Users, value: '28', label: 'Assists', color: Colors.success },
    { icon: Zap, value: '0.65', label: 'Goals/Match', color: Colors.primaryAccent },
    { icon: Shield, value: '18', label: 'Clean Sheets', color: Colors.primaryDark },
    { icon: Star, value: '8', label: 'Hat-tricks', color: Colors.warning },
    { icon: Award, value: '4', label: 'MVP Awards', color: Colors.futsal },
    { icon: Trophy, value: '2', label: 'Trophies', color: Colors.primaryDark },
  ],
  PICKLEBALL: [
    { icon: Activity, value: '53', label: 'Matches', color: Colors.pickleball },
    { icon: TrendingUp, value: '34', label: 'Wins', color: Colors.success },
    { icon: Target, value: '64%', label: 'Win Rate', color: Colors.primaryAccent },
    { icon: Zap, value: '87%', label: 'Serve Acc.', color: Colors.pickleball },
    { icon: Shield, value: '19', label: 'Sets Won', color: Colors.primaryDark },
    { icon: Star, value: '6', label: 'Perfect Games', color: Colors.warning },
    { icon: Award, value: '3', label: 'Tournaments', color: Colors.pickleball },
    { icon: Trophy, value: '1', label: 'Title', color: Colors.primaryDark },
  ],
};

const PROFILE_TABS = ['Moments', 'Saved', 'Stats', 'Reels', 'Tagged'] as const;
type ProfileTab = (typeof PROFILE_TABS)[number];

const AnimatedPressable = ({
  onPress,
  children,
  style,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: any;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const animate = (toValue: number) => {
    Animated.spring(scaleAnim, { toValue, useNativeDriver: true, friction: 12, tension: 160 }).start();
  };
  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable onPressIn={() => animate(0.96)} onPressOut={() => animate(1)} onPress={onPress}>
        {children}
      </Pressable>
    </Animated.View>
  );
};

const StatCard = ({ icon: Icon, value, label, color, index }: any) => {
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = index * 80;
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
    ]).start();
  }, [index]);

  return (
    <Animated.View style={[styles.statCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={[styles.statCardIcon, { backgroundColor: color + '18' }]}>
        <Icon color={color} size={18} strokeWidth={2.5} />
      </View>
      <Text style={[styles.statCardValue, { color }]}>{value}</Text>
      <Text style={styles.statCardLabel}>{label}</Text>
    </Animated.View>
  );
};

export default function ProfileScreen() {
  const navBarHeight = useBottomNavBarHeight();
  const router = useRouter();
  const { openPostId, openReelId, tab } = useLocalSearchParams<{ openPostId?: string; openReelId?: string; tab?: string }>();
  const { user, loading: authLoading, updateUser } = useAuth();
  const { active: isPro } = useSubscription();
  const [selectedTab, setSelectedTab] = useState<ProfileTab>('Moments');
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Avatar viewing / changing
  const [avatarSheetVisible, setAvatarSheetVisible] = useState(false);
  const [avatarViewerVisible, setAvatarViewerVisible] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Posts
  const [userPosts, setUserPosts] = useState<PostSummary[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // Saved tab - lazily loaded the first time it's opened (same pattern as
  // Friends' Suggested tab).
  const [savedPosts, setSavedPosts] = useState<PostSummary[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [selectedSavedPostId, setSelectedSavedPostId] = useState<string | null>(null);

  // Reels tab - lazily loaded the first time it's opened (same pattern as Saved).
  const [userReels, setUserReels] = useState<ReelSummary[]>([]);
  const [reelsLoading, setReelsLoading] = useState(false);
  const [reelsLoaded, setReelsLoaded] = useState(false);

  const userId = user?.firebaseUid;

  // Deep link from a notification requesting a specific starting tab
  // (e.g. "liked your reel" -> Reels tab).
  useEffect(() => {
    if (tab && (PROFILE_TABS as readonly string[]).includes(tab)) {
      setSelectedTab(tab as ProfileTab);
    }
  }, [tab]);

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

  const fetchProfile = React.useCallback(async () => {
    if (!userId) { if (!authLoading) setLoading(false); return; }
    try {
      setLoading(true);
      const res = await socialMediaApi.getUserProfile(userId as string);
      setProfileData(res);
    } catch {
      setProfileData({ followersCount: 0, followingCount: 0 });
    } finally {
      setLoading(false);
    }
  }, [userId, authLoading]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const fetchPosts = React.useCallback(async () => {
    if (!userId) return;
    setPostsLoading(true);
    try {
      const res = await socialMediaApi.getUserPosts(userId, 0, 30);
      setUserPosts(res.content);
    } catch {
      setUserPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Deep link from a "liked/commented your post" notification - open that
  // exact post once its data has loaded. Only ever consumed once so closing
  // the detail view afterwards doesn't reopen it.
  const openedFromLinkRef = useRef(false);
  useEffect(() => {
    if (!openPostId || openedFromLinkRef.current || userPosts.length === 0) return;
    if (userPosts.some((p) => p.id === openPostId)) {
      openedFromLinkRef.current = true;
      setSelectedTab('Moments');
      setSelectedPostId(openPostId);
    }
  }, [openPostId, userPosts]);

  const fetchSaved = React.useCallback(async () => {
    setSavedLoading(true);
    try {
      const res = await socialMediaApi.getSavedPosts();
      setSavedPosts(res.content);
    } catch {
      setSavedPosts([]);
    } finally {
      setSavedLoading(false);
      setSavedLoaded(true);
    }
  }, []);

  // Saved tab is fetched lazily, the first time it's opened.
  useEffect(() => {
    if (selectedTab !== 'Saved' || savedLoaded) return;
    fetchSaved();
  }, [selectedTab, savedLoaded, fetchSaved]);

  const fetchReels = React.useCallback(async () => {
    if (!userId) return;
    setReelsLoading(true);
    try {
      const res = await reelApi.getUserReels(userId);
      setUserReels(res.content);
    } catch {
      setUserReels([]);
    } finally {
      setReelsLoading(false);
      setReelsLoaded(true);
    }
  }, [userId]);

  // Reels tab is fetched lazily, the first time it's opened.
  useEffect(() => {
    if (selectedTab !== 'Reels' || reelsLoaded || !userId) return;
    fetchReels();
  }, [selectedTab, reelsLoaded, userId, fetchReels]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const tasks = [fetchProfile(), fetchPosts()];
      if (selectedTab === 'Saved') tasks.push(fetchSaved());
      if (selectedTab === 'Reels') tasks.push(fetchReels());
      await Promise.all(tasks);
    } finally {
      setRefreshing(false);
    }
  }, [fetchProfile, fetchPosts, fetchSaved, fetchReels, selectedTab]);

  const sport = useMemo(() => {
    const s = Array.isArray(user?.sport) ? user?.sport[0] : user?.sport;
    return (s || 'FUTSAL').toUpperCase();
  }, [user]);

  const statCards = useMemo(() => SPORT_STATS[sport] || SPORT_STATS['FUTSAL'], [sport]);

  const sportEmoji = { CRICKET: '🏏', FUTSAL: '⚽', PICKLEBALL: '🏓' }[sport] || '🏅';
  const sportColor = { CRICKET: Colors.cricket, FUTSAL: Colors.futsal, PICKLEBALL: Colors.pickleball }[sport] || Colors.primary;

  const profileImageUri = useMemo(() => {
    // Backend may return the image under several different field names.
    const u = user as any;
    const raw =
      u?.profileImageUrl ??
      u?.profileImage ??
      u?.avatarUrl ??
      u?.avatar ??
      u?.photoURL ??   // Firebase default field name
      u?.photo ??
      null;
    return resolveAvatarUri(raw, user?.displayName);
  }, [user]);

  const applyNewAvatar = async (asset: ImagePicker.ImagePickerAsset) => {
    setAvatarUploading(true);
    try {
      const updated = await userApi.uploadAvatar({
        uri: asset.uri,
        name: asset.fileName || 'avatar.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
      await updateUser(updated);
    } catch {
      Alert.alert('Upload failed', 'Could not update your profile picture. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleChooseFromLibrary = () => {
    setAvatarSheetVisible(false);
    (async () => {
      try {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission needed', 'Allow photo library access to change your profile picture.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
        if (!result.canceled && result.assets[0]) {
          applyNewAvatar(result.assets[0]);
        }
      } catch (err: any) {
        Alert.alert('Could not open photo library', err?.message || 'Please try again.');
      }
    })();
  };

  const handleTakePhoto = () => {
    setAvatarSheetVisible(false);
    (async () => {
      try {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission needed', 'Allow camera access to take a new profile picture.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
        if (!result.canceled && result.assets[0]) {
          applyNewAvatar(result.assets[0]);
        }
      } catch (err: any) {
        Alert.alert('Could not open camera', err?.message || 'Please try again.');
      }
    })();
  };

  const handleViewPhoto = () => {
    setAvatarSheetVisible(false);
    setAvatarViewerVisible(true);
  };

  const displayName = user?.displayName || 'Sports Player';
  const sportsText = Array.isArray(user?.sport) ? user.sport.join(' • ').toUpperCase() : (user?.sport || 'SPORT PLAYER').toUpperCase();
  const skillLevel = user?.skillLevel ? ` • ${String(user.skillLevel).toUpperCase()}` : '';
  const bioText = user?.bio || `Passionate ${sport.toLowerCase()} player striving for excellence in every match. Let's play!`;

  if (loading) {
    return <LoadingScreen message="Loading your profile…" />;
  }

  // ── Tab content renderers ────────────────────────────────────────────────

  const renderStatsTab = () => (
    <View>
      <View style={styles.statsSportBadge}>
        <Text style={styles.statsSportEmoji}>{sportEmoji}</Text>
        <Text style={[styles.statsSportLabel, { color: sportColor }]}>{sport} STATISTICS</Text>
      </View>
      <View style={styles.statsGrid}>
        {statCards.map((card, index) => (
          <StatCard key={card.label} {...card} index={index} />
        ))}
      </View>

      <View style={styles.recentMatchesSection}>
        <Text style={styles.recentMatchesTitle}>Recent Matches</Text>
        {[
          { opponent: 'Thunder Squad', result: 'WIN', score: '3-1', date: 'Jun 14' },
          { opponent: 'Blue Eagles FC', result: 'DRAW', score: '2-2', date: 'Jun 10' },
          { opponent: 'City Warriors', result: 'WIN', score: '5-0', date: 'Jun 6' },
        ].map((match, i) => (
          <View key={i} style={styles.recentMatchRow}>
            <View style={styles.recentMatchLeft}>
              <View style={[styles.resultBadge, { backgroundColor: match.result === 'WIN' ? Colors.success + '20' : match.result === 'DRAW' ? Colors.warning + '20' : Colors.error + '20' }]}>
                <Text style={[styles.resultBadgeText, { color: match.result === 'WIN' ? Colors.success : match.result === 'DRAW' ? Colors.warning : Colors.error }]}>{match.result}</Text>
              </View>
              <Text style={styles.recentMatchOpponent}>vs {match.opponent}</Text>
            </View>
            <View style={styles.recentMatchRight}>
              <Text style={styles.recentMatchScore}>{match.score}</Text>
              <Text style={styles.recentMatchDate}>{match.date}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderMomentsTab = () => {
    if (postsLoading) {
      return (
        <View style={styles.emptyTabContent}>
          <PaasxoLogoLoader size={44} elevated={false} />
          <Text style={styles.emptyTabSubtitle}>Loading your moments...</Text>
        </View>
      );
    }
    if (userPosts.length === 0) {
      return (
        <View style={styles.emptyTabContent}>
          <Text style={styles.emptyTabEmoji}>📸</Text>
          <Text style={styles.emptyTabTitle}>No moments yet</Text>
          <Text style={styles.emptyTabSubtitle}>Create your first post to fill your profile!</Text>
        </View>
      );
    }
    return (
      <PostGrid
        posts={userPosts}
        selectedPostId={selectedPostId}
        onSelectPost={(post) => setSelectedPostId(post.id)}
        onCloseDetail={() => setSelectedPostId(null)}
      />
    );
  };

  const renderSavedTab = () => {
    if (savedLoading) {
      return (
        <View style={styles.emptyTabContent}>
          <PaasxoLogoLoader size={44} elevated={false} />
          <Text style={styles.emptyTabSubtitle}>Loading saved posts...</Text>
        </View>
      );
    }
    if (savedPosts.length === 0) {
      return (
        <View style={styles.emptyTabContent}>
          <Text style={styles.emptyTabEmoji}>🔖</Text>
          <Text style={styles.emptyTabTitle}>No saved posts yet</Text>
          <Text style={styles.emptyTabSubtitle}>Tap the bookmark icon on a post to save it here.</Text>
        </View>
      );
    }
    return (
      <PostGrid
        posts={savedPosts}
        selectedPostId={selectedSavedPostId}
        onSelectPost={(post) => setSelectedSavedPostId(post.id)}
        onCloseDetail={() => setSelectedSavedPostId(null)}
      />
    );
  };

  const renderReelsTab = () => {
    if (reelsLoading) {
      return (
        <View style={styles.emptyTabContent}>
          <PaasxoLogoLoader size={44} elevated={false} />
          <Text style={styles.emptyTabSubtitle}>Loading your reels...</Text>
        </View>
      );
    }
    if (userReels.length === 0) {
      return (
        <View style={styles.emptyTabContent}>
          <Text style={styles.emptyTabEmoji}>🎬</Text>
          <Text style={styles.emptyTabTitle}>No reels yet</Text>
          <Text style={styles.emptyTabSubtitle}>Tap the + button to record your first reel!</Text>
        </View>
      );
    }
    return <ReelGrid reels={userReels} autoOpenReelId={openReelId} />;
  };

  const renderEmptyTab = (label: string) => (
    <View style={styles.emptyTabContent}>
      <Text style={styles.emptyTabEmoji}>🎬</Text>
      <Text style={styles.emptyTabTitle}>No {label} yet</Text>
      <Text style={styles.emptyTabSubtitle}>Play matches and capture moments to fill your profile!</Text>
    </View>
  );


  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <>
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
          <AnimatedPressable onPress={() => router.push('/settings')} style={styles.topIconButton}>
            <Settings color={Colors.neutral900} size={18} strokeWidth={2} />
          </AnimatedPressable>
        </Animated.View>

        {/* Hero gradient banner */}
        <LinearGradient
          colors={[sportColor + '28', Colors.background]}
          style={styles.heroBanner}
        >
          {/* Avatar */}
          <Pressable onPress={() => setAvatarSheetVisible(true)} disabled={avatarUploading}>
            <Animated.View style={[styles.avatarContainer, { transform: [{ scale: avatarScale }] }]}>
              <Image source={{ uri: profileImageUri }} style={styles.avatar} />
              {avatarUploading && (
                <View style={styles.avatarUploadingOverlay}>
                  <ActivityIndicator color={Colors.white} size="small" />
                </View>
              )}
              <View style={[styles.sportBadgeOnAvatar, { backgroundColor: sportColor }]}>
                <Text style={styles.sportBadgeEmoji}>{sportEmoji}</Text>
              </View>
              {isPro && (
                <View style={styles.proAvatarBadge}>
                  <Zap color={Colors.white} size={12} strokeWidth={2.5} fill={Colors.white} />
                </View>
              )}
            </Animated.View>
          </Pressable>

          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileRole}>{sportsText}{skillLevel}</Text>
          <Text style={styles.profileBio}>{bioText}</Text>

          {/* Social stats — accurate from API + loaded posts */}
          <View style={styles.socialStatsRow}>
            {[
              { value: postsLoading ? '…' : String(userPosts.length), label: 'POSTS' },
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
            <AnimatedPressable onPress={() => router.push('/edit-profile')} style={[styles.editButton, styles.buttonShadow]}>
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </AnimatedPressable>
            <AnimatedPressable onPress={() => {}} style={[styles.shareButton, styles.buttonShadow]}>
              <Share2 color={Colors.white} size={16} strokeWidth={2} />
              <Text style={styles.shareButtonText}>Share</Text>
            </AnimatedPressable>
          </View>
        </LinearGradient>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {PROFILE_TABS.map((tab) => {
            const active = tab === selectedTab;
            return (
              <Pressable key={tab} onPress={() => setSelectedTab(tab)} style={styles.tabItem}>
                <Text style={[styles.tabText, active && { color: sportColor }]}>{tab}</Text>
                {active && <View style={[styles.tabUnderline, { backgroundColor: sportColor }]} />}
              </Pressable>
            );
          })}
        </View>

        {/* Tab content */}
        {selectedTab === 'Moments' && renderMomentsTab()}
        {selectedTab === 'Saved' && renderSavedTab()}
        {selectedTab === 'Stats' && renderStatsTab()}
        {selectedTab === 'Reels' && renderReelsTab()}
        {selectedTab === 'Tagged' && renderEmptyTab('Tags')}
      </ScrollView>

      <BottomNavbar activeTab="PROFILE" showCreateButton={false} />
    </SafeAreaView>

    {/* Rendered outside the SafeAreaView so its own inset handling isn't
        double-applied on top of the screen's already-inset safe area. */}
    <AvatarActionSheet
      visible={avatarSheetVisible}
      onClose={() => setAvatarSheetVisible(false)}
      onViewPhoto={handleViewPhoto}
      onChooseLibrary={handleChooseFromLibrary}
      onTakePhoto={handleTakePhoto}
    />
    <FullScreenImageViewer
      visible={avatarViewerVisible}
      imageUri={profileImageUri}
      onClose={() => setAvatarViewerVisible(false)}
    />
    </>
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
  avatarUploadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 56, backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
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
  editButton: {
    flex: 1, height: 46, borderRadius: 23, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.neutral200,
  },
  editButtonText: { color: Colors.neutral900, fontSize: 14, fontWeight: '700' },
  shareButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingHorizontal: 20, height: 46, borderRadius: 23, backgroundColor: Colors.primary,
  },
  shareButtonText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
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

  // Stats tab
  statsSportBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 16, backgroundColor: Colors.white,
    borderRadius: 12, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  statsSportEmoji: { fontSize: 22 },
  statsSportLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, marginBottom: 20 },
  statCard: {
    width: '47%', backgroundColor: Colors.white, borderRadius: 18,
    padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  statCardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statCardValue: { fontSize: 20, fontWeight: '900', marginBottom: 4 },
  statCardLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },

  recentMatchesSection: { marginHorizontal: 16, marginBottom: 16 },
  recentMatchesTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 12 },
  recentMatchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  recentMatchLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  resultBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  resultBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  recentMatchOpponent: { fontSize: 13, fontWeight: '600', color: Colors.text, flex: 1 },
  recentMatchRight: { alignItems: 'flex-end' },
  recentMatchScore: { fontSize: 15, fontWeight: '800', color: Colors.primary },
  recentMatchDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  // Empty tabs
  emptyTabContent: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32, gap: 8 },
  emptyTabEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTabTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  emptyTabSubtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  pressed: { opacity: 0.88 },
  proAvatarBadge: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: Colors.white,
  },
});
