import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  Image,
  useWindowDimensions,
  ViewToken,
} from 'react-native';
import { Bookmark, Heart, MessageCircle, Play, X } from 'lucide-react-native';
import { videoQueue } from '../stores/videoQueue';
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
 * Fullscreen, Reels-style vertical pager for video Posts: opens on `post`
 * and swipes up/down through the other video posts already loaded in the
 * feed (see videoQueue). Only the visible page plays; its neighbours stay
 * mounted (paused) so the next swipe starts instantly; anything further is
 * unmounted to keep memory flat. Tap the video to pause/resume.
 */
export function PostVideoPlayer({ visible, post, onClose }: PostVideoPlayerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { height } = useWindowDimensions();
  const [{ items, index: startIndex }, setQueue] = useState<{ items: PostSummary[]; index: number }>({ items: [], index: 0 });
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!visible || !post) return;
    const q = videoQueue.around(post);
    setQueue(q);
    setActive(q.index);
  }, [visible, post]);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.index != null) setActive(first.index);
  }).current;

  if (!visible || !post || items.length === 0) return null;

  return (
    <Modal visible={visible} transparent={false} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar hidden />
      <View style={styles.root}>
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          decelerationRate="fast"
          renderItem={({ item, index }) => (
            <VideoPage
              post={item}
              height={height}
              active={index === active}
              mounted={Math.abs(index - active) <= 1}
              styles={styles}
              colors={colors}
            />
          )}
        />
        <View style={styles.header} pointerEvents="box-none">
          {items.length > 1 && (
            <Text style={styles.counter}>{active + 1} / {items.length}</Text>
          )}
          <Pressable onPress={onClose} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Close">
            <X color="#fff" size={24} strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function VideoPage({
  post, height, active, mounted, styles, colors,
}: {
  post: PostSummary; height: number; active: boolean; mounted: boolean;
  styles: ReturnType<typeof createStyles>; colors: ThemeColors;
}) {
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const heartScale = useRef(new Animated.Value(1)).current;
  const interaction = usePostInteraction(post);
  const mediaUri = parseMediaUrl(post.mediaUrl);
  const thumbUri = parseMediaUrl(post.thumbnailUrl);

  // Coming back to a page always resumes it.
  useEffect(() => { if (!active) setUserPaused(false); }, [active]);

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

  const paused = !active || userPaused;

  return (
    <View style={{ height, backgroundColor: '#000' }}>
      {mounted && mediaUri ? (
        <LoopingVideo uri={mediaUri} muted={false} paused={paused} contentFit="contain" />
      ) : thumbUri ? (
        <Image source={{ uri: thumbUri }} style={StyleSheet.absoluteFillObject} resizeMode="contain" />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1a1a2e' }]} />
      )}

      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={() => setUserPaused((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={userPaused ? 'Play video' : 'Pause video'}
      >
        {active && userPaused && (
          <View style={styles.pausedBadge}>
            <Play color="#fff" size={34} fill="#fff" />
          </View>
        )}
      </Pressable>

      <View style={styles.scrimBottom} pointerEvents="none" />

      <View style={styles.bottomRow} pointerEvents="box-none">
        <View style={styles.captionWrap}>
          <Text style={styles.authorName} numberOfLines={1}>{post.authorDisplayName}</Text>
          {!!post.caption && <Text style={styles.captionText} numberOfLines={3}>{post.caption}</Text>}
        </View>
        <View style={styles.actionsCol}>
          <View style={styles.actionBtn}>
            <Pressable onPress={toggleLike} hitSlop={10} accessibilityLabel={interaction.likedByCurrentUser ? 'Unlike' : 'Like'}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Heart
                  color={interaction.likedByCurrentUser ? colors.liveRed : '#fff'}
                  fill={interaction.likedByCurrentUser ? colors.liveRed : 'none'}
                  size={30}
                  strokeWidth={2.2}
                />
              </Animated.View>
            </Pressable>
            <Pressable
              onPress={() => interaction.likeCount > 0 && setLikesModalVisible(true)}
              hitSlop={10}
              disabled={interaction.likeCount === 0}
            >
              <Text style={styles.actionCount}>{interaction.likeCount}</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => setCommentsVisible(true)} style={styles.actionBtn} hitSlop={10} accessibilityLabel="Comments">
            <MessageCircle color="#fff" size={28} strokeWidth={2.2} />
            <Text style={styles.actionCount}>{interaction.commentCount}</Text>
          </Pressable>
          <Pressable onPress={toggleSave} style={styles.actionBtn} hitSlop={10} accessibilityLabel={interaction.savedByCurrentUser ? 'Unsave' : 'Save'}>
            <Bookmark
              color="#fff"
              fill={interaction.savedByCurrentUser ? '#fff' : 'none'}
              size={26}
              strokeWidth={2.2}
            />
          </Pressable>
        </View>
      </View>

      {commentsVisible && <CommentSheet postId={post.id} visible={commentsVisible} onClose={() => setCommentsVisible(false)} />}
      {likesModalVisible && <LikesModal postId={post.id} visible={likesModalVisible} onClose={() => setLikesModalVisible(false)} />}
    </View>
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
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8,
  },
  counter: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '800' },
  pausedBadge: {
    position: 'absolute', alignSelf: 'center', top: '45%',
    width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
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
