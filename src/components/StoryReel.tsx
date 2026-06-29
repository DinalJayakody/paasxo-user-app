import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Video } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { UserStoryGroup, storyApi } from '../api/storyApi';
import { StoryViewer } from './StoryViewer';
import { Colors } from '../styles/colors';
import { resolveMediaUrl } from '../utils/mediaUrl';

export function StoryReel() {
  const router = useRouter();
  const [groups, setGroups] = useState<UserStoryGroup[]>([]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerGroupIndex, setViewerGroupIndex] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadStories();
    return () => { mountedRef.current = false; };
  }, []);

  const loadStories = async () => {
    try {
      const data = await storyApi.getFeedStories();
      if (mountedRef.current) setGroups(data);
    } catch (err) {
      console.warn('[StoryReel] Failed to load stories:', err);
    }
  };

  const openStory = useCallback((index: number) => {
    setViewerGroupIndex(index);
    setViewerVisible(true);
  }, []);

  const handleAddStory = () => {
    router.push('/story-create' as any);
  };

  // Render "Your Story" add button
  const renderAddButton = () => (
    <TouchableOpacity style={styles.itemWrap} onPress={handleAddStory} activeOpacity={0.8}>
      <View style={styles.addRing}>
        <LinearGradient
          colors={[Colors.primary, Colors.primaryDark]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.addAvatarInner}>
          <Plus color={Colors.white} size={26} strokeWidth={2.5} />
        </View>
      </View>
      <Text style={styles.label} numberOfLines={1}>Your Story</Text>
    </TouchableOpacity>
  );

  const renderGroup = ({ item, index }: { item: UserStoryGroup; index: number }) => {
    const hasUnseen = item.hasUnseen;
    const topStory = item.stories[0];
    const isVideo = topStory?.mediaType === 'VIDEO';

    const avatarUri = resolveMediaUrl(item.profileImageUrl);

    return (
      <TouchableOpacity
        style={styles.itemWrap}
        onPress={() => openStory(index)}
        activeOpacity={0.85}
      >
        {/* Gradient ring for unseen, grey for seen */}
        <View style={[styles.ringWrap, !hasUnseen && styles.ringWrapSeen]}>
          {hasUnseen && (
            <LinearGradient
              colors={['#F9A825', '#E91E63', '#7B1FA2', Colors.primary]}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
            />
          )}
          {/* Avatar bubble */}
          <View style={styles.avatarBubble}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>
                  {(item.displayName ?? '?')[0]?.toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>
        {/* Video indicator */}
        {isVideo && (
          <View style={styles.videoIndicator}>
            <Video color={Colors.white} size={9} strokeWidth={2.5} fill={Colors.white} />
          </View>
        )}
        <Text style={[styles.label, !hasUnseen && styles.labelSeen]} numberOfLines={1}>
          {item.isOwn ? 'You' : item.displayName?.split(' ')[0] ?? 'User'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <FlatList
        horizontal
        data={groups}
        keyExtractor={(item) => item.firebaseUid}
        renderItem={renderGroup}
        ListHeaderComponent={renderAddButton}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={5}
      />
      <StoryViewer
        visible={viewerVisible}
        groups={groups}
        initialGroupIndex={viewerGroupIndex}
        onClose={() => {
          setViewerVisible(false);
          loadStories(); // refresh unseen state
        }}
        onDeleted={loadStories}
      />
    </>
  );
}

const BUBBLE = 66;
const RING_SIZE = BUBBLE + 6; // 3px border each side

const styles = StyleSheet.create({
  list: { paddingHorizontal: 12, paddingVertical: 10, gap: 0 },

  itemWrap: {
    alignItems: 'center',
    marginRight: 12,
    width: RING_SIZE + 2,
    position: 'relative',
  },

  // ── Add button ─────────────────────────────────────────────────────────────
  addRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAvatarInner: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },

  // ── Story ring ─────────────────────────────────────────────────────────────
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ringWrapSeen: { backgroundColor: Colors.neutral300 },
  avatarBubble: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: {
    backgroundColor: Colors.neutral200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 22, fontWeight: '800', color: Colors.text },

  // Video badge
  videoIndicator: {
    position: 'absolute',
    bottom: 22,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.white,
  },

  label: {
    marginTop: 5,
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text,
    maxWidth: RING_SIZE + 4,
    textAlign: 'center',
  },
  labelSeen: { color: Colors.textMuted },
});
