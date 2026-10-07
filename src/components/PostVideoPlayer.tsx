import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { Bookmark, Heart, MessageCircle, X } from 'lucide-react-native';
import { PostSummary } from '../types/api';
import { socialMediaApi } from '../api/socialMediaApi';
import { parseMediaUrl } from '../utils/postFormat';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { usePostInteraction, postInteractionStore } from '../stores/postInteractionStore';
import { LoopingVideo } from './LoopingVideo';
import { CommentSheet } from './CommentSheet';
import { LikesModal } from './LikesModal';

interface PostVideoPlayerProps {
  visible: boolean;
  post: PostSummary | null;
  onClose: () => void;
}

/**
 * Fullscreen, Reels-style player for a video Post (post.mediaType ===
 * 'VIDEO') — same fullscreen-vertical visual language as ReelPlayer
 * (LoopingVideo, dark scrim, bottom caption + right-side action column), but
 * wired to Post's own like/comment API rather than Reel's, since the two are
 * deliberately separate content types/backends (see PostCard's grid vs
 * ReelGrid). usePostInteraction keeps like state in sync with however this
 * same post is rendered elsewhere (the feed list, a grid tile, etc).
 */
export function PostVideoPlayer({ visible, post, onClose }: PostVideoPlayerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const heartScale = useRef(new Animated.Value(1)).current;

  // usePostInteraction must be called unconditionally (Rules of Hooks) even
  // before `post` is known - a sentinel id keeps that idle call from
  // touching any real post's state in the shared store.
  const interaction = usePostInteraction(
    post ?? { id: '__none__', likeCount: 0, likedByCurrentUser: false, commentCount: 0, savedByCurrentUser: false } as PostSummary
  );

  if (!visible || !post) return null;

  const mediaUri = parseMediaUrl(post.mediaUrl);

  const toggleLike = async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    postInteractionStore.applyLike(post.id, {
      likeCount: interaction.likeCount + (interaction.likedByCurrentUser ? -1 : 1),
      likedByCurrentUser: !interaction.likedByCurrentUser,
    });
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.35, useNativeDriver: true, friction: 3 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, friction: 3 }),
    ]).start();
    try {
      const updated = await socialMediaApi.toggleLikePost(post.id);
      postInteractionStore.applyLike(post.id, {
        likeCount: updated.likeCount,
        likedByCurrentUser: updated.likedByCurrentUser,
      });
    } catch {
      postInteractionStore.applyLike(post.id, {
        likeCount: interaction.likeCount,
        likedByCurrentUser: interaction.likedByCurrentUser,
      });
    } finally {
      setLikeBusy(false);
    }
  };

  const toggleSave = async () => {
    postInteractionStore.applySave(post.id, { savedByCurrentUser: !interaction.savedByCurrentUser });
    try {
      const updated = await socialMediaApi.toggleSavePost(post.id);
      postInteractionStore.applySave(post.id, { savedByCurrentUser: updated.savedByCurrentUser });
    } catch {
      postInteractionStore.applySave(post.id, { savedByCurrentUser: interaction.savedByCurrentUser });
    }
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar hidden />
      <View style={styles.root}>
        {mediaUri ? (
          <LoopingVideo uri={mediaUri} muted={false} />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1a1a2e' }]} />
        )}

        <View style={styles.scrimBottom} pointerEvents="none" />

        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.iconBtn}>
            <X color="#fff" size={24} strokeWidth={2.5} />
          </Pressable>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.captionWrap}>
            <Text style={styles.authorName} numberOfLines={1}>{post.authorDisplayName}</Text>
            {!!post.caption && <Text style={styles.captionText} numberOfLines={2}>{post.caption}</Text>}
          </View>
          <View style={styles.actionsCol}>
            <View style={styles.actionBtn}>
              <Pressable onPress={toggleLike} hitSlop={10}>
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <Heart
                    color={interaction.likedByCurrentUser ? colors.liveRed : '#fff'}
                    fill={interaction.likedByCurrentUser ? colors.liveRed : 'none'}
                    size={30}
                    strokeWidth={2.2}
                  />
                </Animated.View>
              </Pressable>
              {/* Separate from the heart above — tapping the heart likes/unlikes,
                  tapping the count opens who liked it. */}
              <Pressable
                onPress={() => interaction.likeCount > 0 && setLikesModalVisible(true)}
                hitSlop={10}
                disabled={interaction.likeCount === 0}
              >
                <Text style={styles.actionCount}>{interaction.likeCount}</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setCommentsVisible(true)} style={styles.actionBtn} hitSlop={10}>
              <MessageCircle color="#fff" size={28} strokeWidth={2.2} />
              <Text style={styles.actionCount}>{interaction.commentCount}</Text>
            </Pressable>
            <Pressable onPress={toggleSave} style={styles.actionBtn} hitSlop={10}>
              <Bookmark
                color="#fff"
                fill={interaction.savedByCurrentUser ? '#fff' : 'none'}
                size={26}
                strokeWidth={2.2}
              />
            </Pressable>
          </View>
        </View>

        <CommentSheet postId={post.id} visible={commentsVisible} onClose={() => setCommentsVisible(false)} />
        <LikesModal postId={post.id} visible={likesModalVisible} onClose={() => setLikesModalVisible(false)} />
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  scrimBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 200,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

  header: {
    position: 'absolute', top: Platform.OS === 'ios' ? 54 : 24, left: 12, right: 12,
    flexDirection: 'row', justifyContent: 'flex-end',
  },
  iconBtn: { padding: 8 },

  bottomRow: {
    position: 'absolute', bottom: Platform.OS === 'ios' ? 40 : 24, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  captionWrap: { flex: 1, marginRight: 16 },
  authorName: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 4 },
  captionText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18 },
  actionsCol: { alignItems: 'center', gap: 18 },
  actionBtn: { alignItems: 'center', gap: 4 },
  actionCount: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
