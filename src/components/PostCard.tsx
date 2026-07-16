import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react-native';
import { Colors } from '../styles/colors';
import { PostSummary } from '../types/api';
import { parseMediaUrl, formatTimeAgo } from '../utils/postFormat';
import { socialMediaApi } from '../api/socialMediaApi';
import { usePostInteraction, postInteractionStore } from '../stores/postInteractionStore';
import { CommentSheet } from './CommentSheet';

interface PostCardProps {
  post: PostSummary;
  onShare?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onShare }) => {
  const interaction = usePostInteraction(post);
  const [likeBusy, setLikeBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);

  const avatarUri = parseMediaUrl(post.authorProfileImageUrl);
  const imageUri = parseMediaUrl(post.mediaUrl);

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
          <Share2 color={Colors.neutral600} size={18} strokeWidth={2.5} />
        </Pressable>
      </View>

      {/* CAPTION */}
      {!!post.caption && <Text style={styles.postText}>{post.caption}</Text>}

      {/* IMAGE */}
      {imageUri && <Image source={{ uri: imageUri }} style={styles.postImage} />}

      {/* ACTIONS */}
      <View style={styles.postActions}>
        <View style={styles.postActionsLeft}>
          <Pressable style={styles.postStats} onPress={handleToggleLike} disabled={likeBusy} hitSlop={8}>
            <Heart
              color={interaction.likedByCurrentUser ? Colors.liveRed : Colors.neutral600}
              fill={interaction.likedByCurrentUser ? Colors.liveRed : 'none'}
              size={18}
              strokeWidth={2.5}
            />
            <Text style={[styles.postStatText, interaction.likedByCurrentUser && { color: Colors.liveRed }]}>
              {interaction.likeCount}
            </Text>
          </Pressable>

          <Pressable style={styles.postStats} onPress={() => setCommentsVisible(true)} hitSlop={8}>
            <MessageCircle color={Colors.neutral600} size={18} strokeWidth={2.5} />
            <Text style={styles.postStatText}>{interaction.commentCount}</Text>
          </Pressable>
        </View>

        <Pressable style={styles.saveAction} onPress={handleToggleSave} disabled={saveBusy} hitSlop={8}>
          <Bookmark
            color={interaction.savedByCurrentUser ? Colors.primary : Colors.neutral600}
            fill={interaction.savedByCurrentUser ? Colors.primary : 'none'}
            size={18}
            strokeWidth={2.5}
          />
        </Pressable>
      </View>

      <CommentSheet postId={post.id} visible={commentsVisible} onClose={() => setCommentsVisible(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  postCard: {
    backgroundColor: '#fff',
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
    color: '#111827',
  },

  postSubtitle: {
    fontSize: 12,
    color: '#6b7280',
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

  postText: {
    marginTop: 10,
    fontSize: 13,
    color: '#374151',
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
