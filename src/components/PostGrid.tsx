import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, ViewToken } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, MessageCircle, Play, X } from 'lucide-react-native';
import { Colors, ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { PostSummary } from '../types/api';
import { parseMediaUrl } from '../utils/postFormat';
import { usePostInteraction } from '../stores/postInteractionStore';
import { PostCard } from './PostCard';

// Shared "grid of post thumbnails with a live like-count badge, tap -> detail"
// component - used identically by my Profile's Moments/Saved tabs and a
// friend's Profile gallery, so both get real likes/comments/saves instead of
// three separate hand-rolled implementations.

interface PostGridProps {
  posts: PostSummary[];
  selectedPostId: string | null;
  onSelectPost: (post: PostSummary) => void;
  onCloseDetail: () => void;
  // One-shot deep link (e.g. a "commented on your photo" notification) —
  // opens straight into the comment sheet for whichever post selectedPostId
  // names, instead of just the post itself.
  openComments?: boolean;
}

function GridTile({ post, onPress, styles }: { post: PostSummary; onPress: () => void; styles: ReturnType<typeof createStyles> }) {
  const interaction = usePostInteraction(post);
  const isVideo = post.mediaType === 'VIDEO';
  // A video's mediaUrl is the video FILE, not an image — the grid tile needs
  // the poster-frame thumbnail instead, same as ReelGrid's tiles.
  const imgUri = isVideo ? parseMediaUrl(post.thumbnailUrl) : parseMediaUrl(post.mediaUrl);

  return (
    <View style={styles.tileWrap}>
      <Pressable style={styles.tile} onPress={onPress}>
        {imgUri ? (
          <Image source={{ uri: imgUri }} style={styles.tileImage} />
        ) : (
          <View style={[styles.tileImage, styles.tilePlaceholder]}>
            <Text style={styles.tilePlaceholderText} numberOfLines={3}>{post.caption || 'Post'}</Text>
          </View>
        )}
        {isVideo && (
          <View style={styles.tilePlayBadge}>
            <Play color={Colors.white} size={18} strokeWidth={2.5} fill={Colors.white} />
          </View>
        )}
        <View style={styles.tileMeta}>
          <Heart color={Colors.white} size={11} strokeWidth={2} fill={Colors.white} />
          <Text style={styles.tileMetaText}>{interaction.likeCount}</Text>
          <MessageCircle color={Colors.white} size={11} strokeWidth={2} fill={Colors.white} />
          <Text style={styles.tileMetaText}>{interaction.commentCount}</Text>
        </View>
      </Pressable>
    </View>
  );
}

// Split out of PostGrid so useSafeAreaInsets() runs as a genuine descendant
// of the SafeAreaProvider nested below (a hook call needs to be inside the
// provider's own render tree to read its value — calling it directly in
// PostGrid, the component that also renders that provider, would still read
// the OUTER app-level provider instead). Insets are applied as explicit
// padding rather than via <SafeAreaView>, matching FullScreenImageViewer —
// the one component in this app already proven to position correctly inside
// a Modal on both iOS and Android — instead of trusting SafeAreaView's own
// automatic behavior in this same situation, which is what still left the
// close button under the status bar/notch after the first attempt at this.
function PostDetailModal({
  posts,
  selectedIndex,
  visible,
  activeIndex,
  screenWidth,
  openComments,
  selectedPostId,
  listRef,
  onViewableItemsChanged,
  onCloseDetail,
  styles,
  colors,
}: {
  posts: PostSummary[];
  selectedIndex: number;
  visible: boolean;
  activeIndex: number;
  screenWidth: number;
  openComments?: boolean;
  selectedPostId: string | null;
  listRef: React.RefObject<FlatList<PostSummary> | null>;
  onViewableItemsChanged: (info: { viewableItems: ViewToken[] }) => void;
  onCloseDetail: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.modalSafe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.modalHeader}>
        <Pressable onPress={onCloseDetail} style={styles.modalBackBtn} hitSlop={8}>
          <X color={colors.text} size={20} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.modalHeaderTitle}>
          {posts.length > 1 ? `${activeIndex + 1} of ${posts.length}` : 'Post'}
        </Text>
        <View style={{ width: 36 }} />
      </View>
      {visible && (
        <FlatList
          ref={listRef}
          data={posts}
          keyExtractor={(p) => p.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={selectedIndex}
          getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => listRef.current?.scrollToIndex({ index, animated: false }), 50);
          }}
          renderItem={({ item }) => (
            <View style={{ width: screenWidth }}>
              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                <PostCard post={item} autoOpenComments={!!openComments && item.id === selectedPostId} />
              </ScrollView>
            </View>
          )}
        />
      )}
    </View>
  );
}

export function PostGrid({ posts, selectedPostId, onSelectPost, onCloseDetail, openComments }: PostGridProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<PostSummary>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Index of the tapped tile in the *full* posts array — this is what makes
  // the viewer Instagram-style: swiping moves through every post, not just
  // a single one, seeded at whichever tile was tapped.
  const selectedIndex = selectedPostId ? posts.findIndex((p) => p.id === selectedPostId) : -1;
  const visible = selectedIndex >= 0;

  // FlatList's `initialScrollIndex` only applies on mount, but this list
  // stays mounted across opens (Modal just toggles `visible`) - re-seed the
  // active index (and jump the list, no animation) every time a new tile
  // is tapped while already viewing another one.
  useEffect(() => {
    if (visible) {
      setActiveIndex(selectedIndex);
      listRef.current?.scrollToIndex({ index: selectedIndex, animated: false });
    }
  }, [selectedPostId]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0]?.index;
    if (first != null) setActiveIndex(first);
  }).current;

  return (
    <>
      <View style={styles.grid}>
        {posts.map((post) => (
          <GridTile key={post.id} post={post} onPress={() => onSelectPost(post)} styles={styles} />
        ))}
      </View>

      {/* RN's Modal renders into its own native root (a separate window on
          iOS, a Dialog on Android) - it doesn't reliably inherit insets from
          the app's top-level SafeAreaProvider, which is what was pushing the
          close button up under the status bar/notch/camera cutout. `transparent`
          + `statusBarTranslucent` + a nested SafeAreaProvider is the exact
          combination FullScreenImageViewer uses — the one place in this app
          already confirmed to get this right on both platforms; an opaque
          (non-transparent) Modal was left measuring the wrong window and is
          what made the first attempt at this fix not actually work. The
          screen still reads as a solid opaque page since PostDetailModal's
          own root View paints a solid background — `transparent` only
          changes how the OS treats the Modal's window, not what's visible
          once our own content has painted over it. */}
      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCloseDetail}>
        <SafeAreaProvider>
          <PostDetailModal
            posts={posts}
            selectedIndex={selectedIndex}
            visible={visible}
            activeIndex={activeIndex}
            screenWidth={screenWidth}
            openComments={openComments}
            selectedPostId={selectedPostId}
            listRef={listRef}
            onViewableItemsChanged={onViewableItemsChanged}
            onCloseDetail={onCloseDetail}
            styles={styles}
            colors={colors}
          />
        </SafeAreaProvider>
      </Modal>
    </>
  );
}

const NUM_COLUMNS = 3;
const TILE_GAP = 3;

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  // Each tile occupies a fixed 1/3-width slot with its own padding as the
  // gutter, so tiles always pack left-to-right/top-to-bottom with a
  // consistent gap - unlike justifyContent:'space-between', an incomplete
  // last row just leaves trailing slots empty instead of stretching apart.
  tileWrap: {
    width: `${100 / NUM_COLUMNS}%`,
    padding: TILE_GAP,
  },
  tile: {
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.neutral100,
  },
  tileImage: { width: '100%', height: '100%' },
  tilePlaceholder: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  tilePlaceholderText: { fontSize: 11, color: colors.textSecondary, textAlign: 'center' },
  tilePlayBadge: {
    position: 'absolute', top: '50%', left: '50%',
    marginTop: -14, marginLeft: -14,
    opacity: 0.9,
  },
  tileMeta: {
    position: 'absolute', bottom: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  tileMetaText: { fontSize: 11, fontWeight: '700', color: colors.white },

  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  modalBackBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalHeaderTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  modalContent: { paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 },
});
