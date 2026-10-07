import React, { useState, useEffect } from 'react';
import { Alert, View, Text, Image, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, MessageCircle, Share2, Bookmark, Camera, Sparkles, MoreHorizontal, Flag, UserX, Trophy, ChevronRight, Play, Swords, Radio, Film } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { PostSummary, MatchScorecard } from '../types/api';
import { parseMediaUrl, formatTimeAgo } from '../utils/postFormat';
import { resolveAvatarUri } from '../utils/mediaUrl';
import { socialMediaApi } from '../api/socialMediaApi';
import { matchScoreApi } from '../api/matchScoreApi';
import { usePostInteraction, postInteractionStore } from '../stores/postInteractionStore';
import { CommentSheet } from './CommentSheet';
import { LikesModal } from './LikesModal';
import { ActionMenuSheet } from './ActionMenuSheet';
import { ReportSheet } from './ReportSheet';
import { PostVideoPlayer } from './PostVideoPlayer';

interface PostCardProps {
  post: PostSummary;
  onShare?: () => void;
  // One-shot: opens the comment sheet as soon as this card mounts, for the
  // "X commented on your photo" notification deep link — landing on the
  // post without its comments already open still leaves the user to find
  // and tap the comment button themselves.
  autoOpenComments?: boolean;
}

// A post's image used to be forced into a fixed 220px-tall box with RN's
// default resizeMode:'cover', which crops anything that isn't exactly that
// box's aspect ratio — a tall portrait photo could lose its top/bottom, a
// wide landscape its sides. Sizing the box to the image's own aspect ratio
// (learned from onLoad, no extra network fetch beyond the image itself)
// shows it in full instead, clamped so an extreme photo (a receipt-shaped
// sliver, a panorama) can't blow out the feed's layout.
const MIN_IMAGE_ASPECT_RATIO = 0.66; // tallest allowed — 2:3 portrait
const MAX_IMAGE_ASPECT_RATIO = 1.91; // widest allowed — landscape cap

export const PostCard: React.FC<PostCardProps> = ({ post, onShare, autoOpenComments }) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const interaction = usePostInteraction(post);
  const [likeBusy, setLikeBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(!!autoOpenComments);
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [videoPlayerVisible, setVideoPlayerVisible] = useState(false);
  // Square until the real image loads and reports its natural size.
  const [imageAspectRatio, setImageAspectRatio] = useState(1);
  const handleImageLoad = (e: { nativeEvent: { source?: { width: number; height: number } } }) => {
    const size = e.nativeEvent.source;
    if (!size?.width || !size.height) return;
    const ratio = size.width / size.height;
    setImageAspectRatio(Math.min(Math.max(ratio, MIN_IMAGE_ASPECT_RATIO), MAX_IMAGE_ASPECT_RATIO));
  };

  const avatarUri = resolveAvatarUri(post.authorProfileImageUrl, post.authorDisplayName);
  const imageUri = parseMediaUrl(post.mediaUrl);
  const videoThumbUri = parseMediaUrl(post.thumbnailUrl);
  const isProfileUpdate = post.postType === 'PROFILE_PICTURE_UPDATE';
  const isTournamentAnnouncement = post.postType === 'TOURNAMENT_CREATED';
  // The four "share X into a community" pointer types (see communityApi.ts)
  // — each just carries post.referenceId, re-fetched/navigated-to live
  // rather than anything baked into the post itself.
  const isMatchShare = post.postType === 'COMMUNITY_MATCH_SHARE';
  const isTournamentShare = post.postType === 'COMMUNITY_TOURNAMENT_SHARE';
  const isScorecardShare = post.postType === 'COMMUNITY_SCORECARD_SHARE';
  const isReelShare = post.postType === 'COMMUNITY_REEL_SHARE';
  const isVideo = post.mediaType === 'VIDEO';
  const isOwnPost = !!user?.firebaseUid && user.firebaseUid === post.authorId;

  const handleBlockAuthor = () => {
    Alert.alert(
      `Block ${post.authorDisplayName || 'this user'}?`,
      "You won't see their posts, comments, or profile anymore, and they won't see yours.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await socialMediaApi.blockUser(post.authorId);
              Alert.alert('Blocked', `You won't see ${post.authorDisplayName || 'this user'}'s posts anymore.`);
            } catch {
              Alert.alert('Something went wrong', 'Could not block this user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleToggleLike = async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    // Optimistic flip, reconciled with the authoritative response below.
    postInteractionStore.applyLike(post.id, {
      likeCount: interaction.likeCount + (interaction.likedByCurrentUser ? -1 : 1),
      likedByCurrentUser: !interaction.likedByCurrentUser,
    });
    try {
      const updated = await socialMediaApi.toggleLikePost(post.id);
      postInteractionStore.applyLike(post.id, {
        likeCount: updated.likeCount,
        likedByCurrentUser: updated.likedByCurrentUser,
      });
    } catch {
      // Roll back on failure.
      postInteractionStore.applyLike(post.id, {
        likeCount: interaction.likeCount,
        likedByCurrentUser: interaction.likedByCurrentUser,
      });
    } finally {
      setLikeBusy(false);
    }
  };

  const handleToggleSave = async () => {
    if (saveBusy) return;
    setSaveBusy(true);
    postInteractionStore.applySave(post.id, { savedByCurrentUser: !interaction.savedByCurrentUser });
    try {
      const updated = await socialMediaApi.toggleSavePost(post.id);
      postInteractionStore.applySave(post.id, { savedByCurrentUser: updated.savedByCurrentUser });
    } catch {
      postInteractionStore.applySave(post.id, { savedByCurrentUser: interaction.savedByCurrentUser });
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <View style={styles.postCard}>
      {/* HEADER */}
      <View style={styles.postHeader}>
        <View style={styles.postUser}>
          <Image source={{ uri: avatarUri }} style={styles.postAvatar} />
          <View style={styles.postMeta}>
            <Text style={styles.postName}>{post.authorDisplayName || 'Unknown User'}</Text>
            <Text style={styles.postSubtitle}>
              {post.sport} • {formatTimeAgo(post.createdAt)}
            </Text>
          </View>
        </View>

        <View style={styles.headerIcons}>
          <Pressable style={styles.iconButtonSmall} onPress={onShare}>
            <Share2 color={colors.neutral600} size={18} strokeWidth={2.5} />
          </Pressable>
          <Pressable style={styles.iconButtonSmall} onPress={() => setMenuVisible(true)} hitSlop={6}>
            <MoreHorizontal color={colors.neutral600} size={18} strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>

      {/* CAPTION */}
      {!isProfileUpdate && !!post.caption && <Text style={styles.postText}>{post.caption}</Text>}

      {/* IMAGE */}
      {isProfileUpdate ? (
        <LinearGradient
          colors={[colors.primaryLight, colors.background]}
          style={styles.profileUpdateGradient}
        >
          <View style={styles.profileUpdateRing}>
            <Image source={{ uri: imageUri || avatarUri }} style={styles.profileUpdateAvatar} />
            <View style={styles.profileUpdateCameraBadge}>
              <Camera color={colors.white} size={13} strokeWidth={2.5} />
            </View>
          </View>
          <View style={styles.profileUpdatePill}>
            <Sparkles color={colors.primary} size={12} strokeWidth={2.5} />
            <Text style={styles.profileUpdatePillText}>New Profile Photo</Text>
          </View>
        </LinearGradient>
      ) : isTournamentAnnouncement || isTournamentShare ? (
        <Pressable
          style={styles.tournamentCard}
          onPress={() => post.referenceId && router.push(`/tournament/${post.referenceId}` as any)}
        >
          <View style={styles.tournamentIconWrap}>
            <Trophy color={colors.white} size={20} strokeWidth={2.5} />
          </View>
          <Text style={styles.tournamentCardText}>View Tournament</Text>
          <ChevronRight color={colors.primary} size={18} strokeWidth={2.5} />
        </Pressable>
      ) : isMatchShare ? (
        <Pressable
          style={styles.tournamentCard}
          onPress={() => post.referenceId && router.push(`/match/${post.referenceId}` as any)}
        >
          <View style={styles.tournamentIconWrap}>
            <Swords color={colors.white} size={20} strokeWidth={2.5} />
          </View>
          <Text style={styles.tournamentCardText}>View Match</Text>
          <ChevronRight color={colors.primary} size={18} strokeWidth={2.5} />
        </Pressable>
      ) : isScorecardShare ? (
        <CommunityScorecardPreview
          bookingId={post.referenceId}
          colors={colors}
          styles={styles}
          onPress={() => post.referenceId && router.push(`/match/${post.referenceId}` as any)}
        />
      ) : isReelShare ? (
        <Pressable
          style={styles.tournamentCard}
          onPress={() => post.referenceId && router.push(`/reel/${post.referenceId}` as any)}
        >
          <View style={styles.tournamentIconWrap}>
            <Film color={colors.white} size={20} strokeWidth={2.5} />
          </View>
          <Text style={styles.tournamentCardText}>View Reel</Text>
          <ChevronRight color={colors.primary} size={18} strokeWidth={2.5} />
        </Pressable>
      ) : isVideo ? (
        (videoThumbUri || imageUri) && (
          <Pressable onPress={() => setVideoPlayerVisible(true)} style={{ marginTop: 10 }}>
            <Image
              source={{ uri: videoThumbUri || imageUri! }}
              style={[styles.postImage, { marginTop: 0, aspectRatio: imageAspectRatio }]}
              onLoad={handleImageLoad}
            />
            <View style={styles.videoPlayBadge}>
              <Play color={colors.white} size={22} strokeWidth={2.5} fill={colors.white} />
            </View>
          </Pressable>
        )
      ) : (
        imageUri && (
          <Image
            source={{ uri: imageUri }}
            style={[styles.postImage, { aspectRatio: imageAspectRatio }]}
            onLoad={handleImageLoad}
          />
        )
      )}

      {/* ACTIONS */}
      <View style={styles.postActions}>
        <View style={styles.postActionsLeft}>
          <View style={styles.postStats}>
            <Pressable onPress={handleToggleLike} disabled={likeBusy} hitSlop={8}>
              <Heart
                color={interaction.likedByCurrentUser ? colors.liveRed : colors.neutral600}
                fill={interaction.likedByCurrentUser ? colors.liveRed : 'none'}
                size={18}
                strokeWidth={2.5}
              />
            </Pressable>
            {/* Separate from the heart above — tapping the heart likes/unlikes,
                tapping the count opens who liked it (a no-op with nothing to
                show when the count is 0, so it's not worth a wasted API call). */}
            <Pressable
              onPress={() => interaction.likeCount > 0 && setLikesModalVisible(true)}
              hitSlop={8}
              disabled={interaction.likeCount === 0}
            >
              <Text style={[styles.postStatText, interaction.likedByCurrentUser && { color: colors.liveRed }]}>
                {interaction.likeCount}
              </Text>
            </Pressable>
          </View>

          <Pressable style={styles.postStats} onPress={() => setCommentsVisible(true)} hitSlop={8}>
            <MessageCircle color={colors.neutral600} size={18} strokeWidth={2.5} />
            <Text style={styles.postStatText}>{interaction.commentCount}</Text>
          </Pressable>
        </View>

        <Pressable style={styles.saveAction} onPress={handleToggleSave} disabled={saveBusy} hitSlop={8}>
          <Bookmark
            color={interaction.savedByCurrentUser ? colors.primary : colors.neutral600}
            fill={interaction.savedByCurrentUser ? colors.primary : 'none'}
            size={18}
            strokeWidth={2.5}
          />
        </Pressable>
      </View>

      <CommentSheet postId={post.id} visible={commentsVisible} onClose={() => setCommentsVisible(false)} />
      <LikesModal postId={post.id} visible={likesModalVisible} onClose={() => setLikesModalVisible(false)} />
      {isVideo && (
        <PostVideoPlayer visible={videoPlayerVisible} post={post} onClose={() => setVideoPlayerVisible(false)} />
      )}

      {!isOwnPost && (
        <>
          <ActionMenuSheet
            visible={menuVisible}
            onClose={() => setMenuVisible(false)}
            actions={[
              {
                key: 'report',
                label: 'Report Post',
                icon: <Flag color={colors.error} size={18} strokeWidth={2.2} />,
                destructive: true,
                onPress: () => setReportVisible(true),
              },
              {
                key: 'block',
                label: `Block ${post.authorDisplayName || 'user'}`,
                icon: <UserX color={colors.error} size={18} strokeWidth={2.2} />,
                destructive: true,
                onPress: handleBlockAuthor,
              },
            ]}
          />
          <ReportSheet
            visible={reportVisible}
            onClose={() => setReportVisible(false)}
            targetType="POST"
            targetId={post.id}
          />
        </>
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  postCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },

  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  postUser: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  postAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
  },

  postMeta: {},

  postName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },

  postSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  iconButtonSmall: {
    padding: 6,
  },

  postImage: {
    width: '100%',
    borderRadius: 14,
    marginTop: 10,
    backgroundColor: colors.neutral100,
  },
  videoPlayBadge: {
    position: 'absolute', top: '50%', left: '50%',
    marginTop: -22, marginLeft: -22,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },

  tournamentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 10, padding: 12, borderRadius: 14,
    backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary + '30',
  },
  tournamentIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  tournamentCardText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.primary },

  profileUpdateGradient: {
    marginTop: 10,
    borderRadius: 18,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  profileUpdateRing: {
    width: 148,
    height: 148,
    borderRadius: 74,
    padding: 5,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  profileUpdateAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 68,
  },
  profileUpdateCameraBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.cardBg,
  },
  profileUpdatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.cardBg,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  profileUpdatePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.2,
  },

  postText: {
    marginTop: 10,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },

  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    alignItems: 'center',
  },

  postActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },

  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  postStatText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },

  saveAction: {
    padding: 4,
  },
});

/**
 * A COMMUNITY_SCORECARD_SHARE's preview — a one-shot snapshot of the match's
 * current score, fetched once on mount (NOT polled) so a feed full of these
 * doesn't turn into N concurrent 4-second polling loops (useLiveMatchScore,
 * built for a single dedicated match screen, is the wrong tool here).
 * Tapping through to the match's own live scoreboard is what actually shows
 * a continuously-updating score.
 */
function CommunityScorecardPreview({
  bookingId, colors, styles, onPress,
}: {
  bookingId?: string;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
}) {
  const [scorecard, setScorecard] = useState<MatchScorecard | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!bookingId) { setLoaded(true); return; }
    let cancelled = false;
    matchScoreApi.getScorecard(bookingId).then((sc) => {
      if (!cancelled) { setScorecard(sc); setLoaded(true); }
    }).catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [bookingId]);

  return (
    <Pressable style={scorecardStyles.card} onPress={onPress}>
      <View style={styles.tournamentIconWrap}>
        <Radio color={colors.white} size={18} strokeWidth={2.5} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.tournamentCardText, { fontSize: 11, opacity: 0.8 }]}>LIVE SCORECARD</Text>
        {!loaded ? (
          <ActivityIndicator color={colors.primary} size="small" style={{ alignSelf: 'flex-start', marginTop: 2 }} />
        ) : scorecard ? (
          <Text style={scorecardStyles.score} numberOfLines={1}>
            {scorecard.teamAName} {scorecard.teamAScore} · {scorecard.teamBName} {scorecard.teamBScore}
          </Text>
        ) : (
          <Text style={styles.tournamentCardText}>View Scorecard</Text>
        )}
      </View>
      <ChevronRight color={colors.primary} size={18} strokeWidth={2.5} />
    </Pressable>
  );
}

const scorecardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 10, padding: 12, borderRadius: 14,
    backgroundColor: 'rgba(220,38,38,0.08)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.25)',
  },
  score: { fontSize: 14, fontWeight: '800' },
});
