import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  Heart,
  MessageCircle,
  Send,
  X,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomNavbar } from '../components/BottomNavbar';
import { Colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { socialMediaApi } from '../api/socialMediaApi';
import { ENDPOINTS } from '../api/endpoints';

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

const PROFILE_TABS = ['Moments', 'Stats', 'Videos', 'Tagged'] as const;
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

const parseMediaUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('file') || url.startsWith('data:')) return url;
  return `data:image/jpeg;base64,${url}`;
};

const formatTimeAgo = (dateString?: string) => {
  if (!dateString) return '';
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { active: isPro } = useSubscription();
  const [selectedTab, setSelectedTab] = useState<ProfileTab>('Moments');
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Posts
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  // Post detail modal
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string | number>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  const userId = user?.firebaseUid;

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

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await socialMediaApi.getUserProfile(userId as string);
        setProfileData(res);
      } catch {
        setProfileData({ followersCount: 0, followingCount: 0 });
      } finally {
        setLoading(false);
      }
    };
    if (userId) fetchProfile();
    else if (!authLoading) setLoading(false);
  }, [userId, authLoading]);

  useEffect(() => {
    const fetchPosts = async () => {
      if (!userId) return;
      setPostsLoading(true);
      try {
        const data = await socialMediaApi.getUserPosts(userId);
        setUserPosts(data);
        // seed like counts from API data
        const counts: Record<string, number> = {};
        data.forEach((p: any) => { counts[String(p.id)] = p.likes ?? p.likesCount ?? 0; });
        setLikeCounts(counts);
      } catch {
        setUserPosts([]);
      } finally {
        setPostsLoading(false);
      }
    };
    fetchPosts();
  }, [userId]);

  const openPost = useCallback(async (post: any) => {
    setSelectedPost(post);
    setComments([]);
    setCommentsLoading(true);
    try {
      const data = await socialMediaApi.getComments(post.id);
      setComments(data);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  const closePost = useCallback(() => {
    setSelectedPost(null);
    setCommentText('');
    setComments([]);
  }, []);

  const toggleLike = useCallback(async (postId: string | number) => {
    const key = String(postId);
    const isLiked = likedPosts.has(postId);
    setLikedPosts((prev) => {
      const next = new Set(prev);
      isLiked ? next.delete(postId) : next.add(postId);
      return next;
    });
    setLikeCounts((prev) => ({
      ...prev,
      [key]: Math.max(0, (prev[key] ?? 0) + (isLiked ? -1 : 1)),
    }));
    try {
      if (isLiked) {
        await socialMediaApi.unlikePost(postId);
      } else {
        await socialMediaApi.likePost(postId);
      }
    } catch { /* optimistic UI — ignore errors */ }
  }, [likedPosts]);

  const submitComment = useCallback(async () => {
    if (!commentText.trim() || !selectedPost) return;
    setSubmittingComment(true);
    const text = commentText.trim();
    setCommentText('');
    try {
      const newComment = await socialMediaApi.addComment(selectedPost.id, text);
      setComments((prev) => [
        ...(newComment
          ? [newComment]
          : [{ id: Date.now(), text, authorDisplayName: user?.displayName || 'You', createdAt: new Date().toISOString() }]
        ),
        ...prev,
      ]);
    } catch {
      // add optimistic comment even on error
      setComments((prev) => [
        { id: Date.now(), text, authorDisplayName: user?.displayName || 'You', createdAt: new Date().toISOString() },
        ...prev,
      ]);
    } finally {
      setSubmittingComment(false);
    }
  }, [commentText, selectedPost, user]);

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

    const fallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.displayName || 'P')}&backgroundColor=2977c2&textColor=ffffff`;

    if (!raw) return fallback;

    // Object shape { uri: string } (from ImagePicker or EditProfile)
    if (typeof raw === 'object' && 'uri' in raw) return (raw as { uri: string }).uri || fallback;

    if (typeof raw !== 'string') return fallback;

    // Already an absolute URL or data URI
    if (raw.startsWith('http') || raw.startsWith('data:') || raw.startsWith('file:')) return raw;

    // Relative path from backend (e.g. "/media/profiles/abc.jpg")
    // Prepend the backend host by stripping the "/api" suffix from BASE_URL.
    if (raw.startsWith('/')) {
      const backendHost = ENDPOINTS.BASE_URL.replace(/\/api\/?$/, '');
      return `${backendHost}${raw}`;
    }

    // Assume raw base64 string
    return `data:image/jpeg;base64,${raw}`;
  }, [user]);

  const displayName = user?.displayName || 'Sports Player';
  const sportsText = Array.isArray(user?.sport) ? user.sport.join(' • ').toUpperCase() : (user?.sport || 'SPORT PLAYER').toUpperCase();
  const skillLevel = user?.skillLevel ? ` • ${String(user.skillLevel).toUpperCase()}` : '';
  const bioText = user?.bio || `Passionate ${sport.toLowerCase()} player striving for excellence in every match. Let's play!`;

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
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
          <ActivityIndicator size="large" color={Colors.primary} />
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
      <View style={styles.galleryGrid}>
        {userPosts.map((post, index) => {
          const imgUri = parseMediaUrl(post.mediaUrl);
          return (
            <Pressable key={post.id ?? index} style={styles.galleryItem} onPress={() => openPost(post)}>
              {imgUri ? (
                <Image source={{ uri: imgUri }} style={styles.galleryImage} />
              ) : (
                <View style={[styles.galleryImage, styles.galleryPlaceholder]}>
                  <Text style={styles.galleryPlaceholderText} numberOfLines={3}>{post.caption || 'Post'}</Text>
                </View>
              )}
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.45)']} style={styles.galleryOverlay} />
              <View style={styles.galleryMeta}>
                <Heart color={Colors.white} size={11} strokeWidth={2} fill={Colors.white} />
                <Text style={styles.galleryMetaText}>{likeCounts[String(post.id)] ?? post.likes ?? 0}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  };

  const renderEmptyTab = (label: string) => (
    <View style={styles.emptyTabContent}>
      <Text style={styles.emptyTabEmoji}>🎬</Text>
      <Text style={styles.emptyTabTitle}>No {label} yet</Text>
      <Text style={styles.emptyTabSubtitle}>Play matches and capture moments to fill your profile!</Text>
    </View>
  );

  // ── Post detail modal ────────────────────────────────────────────────────

  const renderPostModal = () => {
    if (!selectedPost) return null;
    const postImgUri = parseMediaUrl(selectedPost.mediaUrl);
    const authorAvatarUri = parseMediaUrl(selectedPost.authorProfileImageUrl);
    const isLiked = likedPosts.has(selectedPost.id);
    const likeCount = likeCounts[String(selectedPost.id)] ?? selectedPost.likes ?? 0;

    return (
      <Modal
        visible={!!selectedPost}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePost}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <Pressable onPress={closePost} style={styles.modalBackBtn}>
              <X color={Colors.text} size={20} strokeWidth={2.5} />
            </Pressable>
            <Text style={styles.modalHeaderTitle}>Post</Text>
            <View style={{ width: 36 }} />
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <FlatList
              data={comments}
              keyExtractor={(c, i) => String(c.id ?? i)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalContent}
              ListHeaderComponent={
                <>
                  {/* Author row */}
                  <View style={styles.modalAuthorRow}>
                    {authorAvatarUri ? (
                      <Image source={{ uri: authorAvatarUri }} style={styles.modalAvatar} />
                    ) : (
                      <View style={[styles.modalAvatar, styles.modalAvatarFallback]}>
                        <Text style={styles.modalAvatarInitial}>
                          {(selectedPost.authorDisplayName || 'U')[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalAuthorName}>{selectedPost.authorDisplayName || 'Unknown'}</Text>
                      <Text style={styles.modalPostTime}>{formatTimeAgo(selectedPost.createdAt)}</Text>
                    </View>
                  </View>

                  {/* Caption */}
                  {!!selectedPost.caption && (
                    <Text style={styles.modalCaption}>{selectedPost.caption}</Text>
                  )}

                  {/* Image */}
                  {postImgUri && (
                    <Image
                      source={{ uri: postImgUri }}
                      style={styles.modalPostImage}
                      resizeMode="cover"
                    />
                  )}

                  {/* Like / comment actions */}
                  <View style={styles.modalActions}>
                    <Pressable style={styles.modalActionBtn} onPress={() => toggleLike(selectedPost.id)}>
                      <Heart
                        color={isLiked ? Colors.liveRed : Colors.textSecondary}
                        size={22}
                        strokeWidth={2}
                        fill={isLiked ? Colors.liveRed : 'none'}
                      />
                      <Text style={[styles.modalActionText, isLiked && { color: Colors.liveRed }]}>{likeCount}</Text>
                    </Pressable>
                    <View style={styles.modalActionBtn}>
                      <MessageCircle color={Colors.textSecondary} size={22} strokeWidth={2} />
                      <Text style={styles.modalActionText}>{comments.length}</Text>
                    </View>
                  </View>

                  <View style={styles.modalDivider} />
                  <Text style={styles.modalCommentsTitle}>Comments</Text>

                  {commentsLoading && (
                    <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 12 }} />
                  )}
                </>
              }
              renderItem={({ item }) => (
                <View style={styles.commentRow}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarInitial}>
                      {(item.authorDisplayName || item.userName || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.commentBubble}>
                    <Text style={styles.commentAuthor}>{item.authorDisplayName || item.userName || 'User'}</Text>
                    <Text style={styles.commentText}>{item.text || item.content || item.comment}</Text>
                    <Text style={styles.commentTime}>{formatTimeAgo(item.createdAt)}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                !commentsLoading ? (
                  <Text style={styles.noCommentsText}>No comments yet. Be the first!</Text>
                ) : null
              }
            />

            {/* Comment input */}
            <View style={styles.commentInputWrap}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor={Colors.textMuted}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={300}
              />
              <Pressable
                style={[styles.commentSendBtn, !commentText.trim() && styles.commentSendBtnDisabled]}
                onPress={submitComment}
                disabled={!commentText.trim() || submittingComment}
              >
                {submittingComment ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Send color={Colors.white} size={16} strokeWidth={2.5} />
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    );
  };

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      {renderPostModal()}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
          <Animated.View style={[styles.avatarContainer, { transform: [{ scale: avatarScale }] }]}>
            <Image source={{ uri: profileImageUri }} style={styles.avatar} />
            <View style={[styles.sportBadgeOnAvatar, { backgroundColor: sportColor }]}>
              <Text style={styles.sportBadgeEmoji}>{sportEmoji}</Text>
            </View>
            {isPro && (
              <View style={styles.proAvatarBadge}>
                <Zap color={Colors.white} size={12} strokeWidth={2.5} fill={Colors.white} />
              </View>
            )}
          </Animated.View>

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
        {selectedTab === 'Stats' && renderStatsTab()}
        {selectedTab === 'Videos' && renderEmptyTab('Videos')}
        {selectedTab === 'Tagged' && renderEmptyTab('Tags')}
      </ScrollView>

      <BottomNavbar activeTab="PROFILE" showCreateButton={false} />
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

  // Moments / gallery
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 6, marginBottom: 16 },
  galleryItem: { width: '32%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden' },
  galleryImage: { width: '100%', height: '100%', backgroundColor: Colors.neutral200 },
  galleryPlaceholder: { backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', padding: 6 },
  galleryPlaceholderText: { fontSize: 10, color: Colors.primary, textAlign: 'center', fontWeight: '600' },
  galleryOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%' },
  galleryMeta: { position: 'absolute', bottom: 6, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3 },
  galleryMetaText: { fontSize: 10, color: Colors.white, fontWeight: '700' },

  // Empty tabs
  emptyTabContent: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32, gap: 8 },
  emptyTabEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTabTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  emptyTabSubtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Post detail modal
  modalSafe: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.neutral200,
    backgroundColor: Colors.white,
  },
  modalBackBtn: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.neutral100,
  },
  modalHeaderTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },

  modalContent: { paddingBottom: 16 },

  modalAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  modalAvatar: { width: 44, height: 44, borderRadius: 22 },
  modalAvatarFallback: { backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  modalAvatarInitial: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  modalAuthorName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  modalPostTime: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  modalCaption: { fontSize: 14, color: Colors.text, lineHeight: 20, paddingHorizontal: 16, marginBottom: 12 },
  modalPostImage: { width: '100%', aspectRatio: 1, backgroundColor: Colors.neutral100 },

  modalActions: {
    flexDirection: 'row', gap: 20, paddingHorizontal: 16, paddingVertical: 14,
  },
  modalActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  modalActionText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },

  modalDivider: { height: 1, backgroundColor: Colors.neutral100, marginHorizontal: 16, marginBottom: 12 },
  modalCommentsTitle: { fontSize: 14, fontWeight: '800', color: Colors.text, paddingHorizontal: 16, marginBottom: 8 },

  commentRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  commentAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  commentAvatarInitial: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  commentBubble: { flex: 1, backgroundColor: Colors.neutral100, borderRadius: 12, padding: 10 },
  commentAuthor: { fontSize: 12, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  commentText: { fontSize: 13, color: Colors.text, lineHeight: 18 },
  commentTime: { fontSize: 10, color: Colors.textMuted, marginTop: 4 },

  noCommentsText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingVertical: 20 },

  commentInputWrap: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.neutral200,
    backgroundColor: Colors.white,
  },
  commentInput: {
    flex: 1, backgroundColor: Colors.neutral100, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
    color: Colors.text, maxHeight: 100,
  },
  commentSendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  commentSendBtnDisabled: { backgroundColor: Colors.neutral300 },

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
