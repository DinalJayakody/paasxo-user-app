import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, MessageCircle, Share2, Bookmark, Camera, Sparkles } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { PostSummary } from '../types/api';
import { parseMediaUrl, formatTimeAgo } from '../utils/postFormat';
import { resolveAvatarUri } from '../utils/mediaUrl';
import { socialMediaApi } from '../api/socialMediaApi';
import { usePostInteraction, postInteractionStore } from '../stores/postInteractionStore';
import { CommentSheet } from './CommentSheet';

interface PostCardProps {
  post: PostSummary;
  onShare?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onShare }) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const interaction = usePostInteraction(post);
  const [likeBusy, setLikeBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);

  const avatarUri = resolveAvatarUri(post.authorProfileImageUrl, post.authorDisplayName);
  const imageUri = parseMediaUrl(post.mediaUrl);
  const isProfileUpdate = post.postType === 'PROFILE_PICTURE_UPDATE';

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

        <Pressable style={styles.iconButtonSmall} onPress={onShare}>
          <Share2 color={colors.neutral600} size={18} strokeWidth={2.5} />
        </Pressable>
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
      ) : (
        imageUri && <Image source={{ uri: imageUri }} style={styles.postImage} />
      )}

      {/* ACTIONS */}
      <View style={styles.postActions}>
        <View style={styles.postActionsLeft}>
          <Pressable style={styles.postStats} onPress={handleToggleLike} disabled={likeBusy} hitSlop={8}>
            <Heart
              color={interaction.likedByCurrentUser ? colors.liveRed : colors.neutral600}
              fill={interaction.likedByCurrentUser ? colors.liveRed : 'none'}
              size={18}
              strokeWidth={2.5}
            />
            <Text style={[styles.postStatText, interaction.likedByCurrentUser && { color: colors.liveRed }]}>
              {interaction.likeCount}
            </Text>
          </Pressable>

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

  iconButtonSmall: {
    padding: 6,
  },

  postImage: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    marginTop: 10,
  },

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
