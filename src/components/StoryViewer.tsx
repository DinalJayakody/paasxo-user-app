import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Eye, Trash2, X } from 'lucide-react-native';
import { StoryItem, UserStoryGroup, storyApi } from '../api/storyApi';
import { resolveMediaUrl } from '../utils/mediaUrl';

// expo-video (SDK 54+) – platform-safe import
let useVideoPlayer: any = null;
let VideoView: any = null;
if (Platform.OS !== 'web') {
  try {
    const vid = require('expo-video');
    useVideoPlayer = vid.useVideoPlayer;
    VideoView = vid.VideoView;
  } catch {}
}

const { width: W, height: H } = Dimensions.get('window');
const IMAGE_DURATION_MS = 5000;

const FILTER_OVERLAY: Record<string, string | null> = {
  NORMAL: null,
  WARM: 'rgba(255,120,50,0.20)',
  COOL: 'rgba(30,100,255,0.20)',
  ROSE: 'rgba(255,50,120,0.18)',
  FADE: 'rgba(255,255,255,0.28)',
  DRAMA: 'rgba(0,0,0,0.22)',
  GREEN: 'rgba(50,200,100,0.15)',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── VideoStory — isolated component so useVideoPlayer hook is always called ──
function VideoStory({
  uri,
  paused,
  onReady,
  onEnd,
}: {
  uri: string;
  paused: boolean;
  onReady: () => void;
  onEnd: () => void;
}) {
  if (!useVideoPlayer || !VideoView) {
    // Fallback: placeholder on web / missing package
    return (
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: '#fff', fontSize: 13 }}>Video unavailable on this platform</Text>
      </View>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const player = useVideoPlayer({ uri }, (p: any) => {
    p.loop = false;
    p.muted = false;
    if (!paused) p.play();
  });

  useEffect(() => {
    const sub = player.addListener('playToEnd', onEnd);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }: any) => {
      if (status === 'readyToPlay') onReady();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFillObject}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  groups: UserStoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
  onDeleted?: () => void;
}

// ── Main viewer ───────────────────────────────────────────────────────────────
export function StoryViewer({ visible, groups, initialGroupIndex, onClose, onDeleted }: Props) {
  const [groupIdx, setGroupIdx] = useState(initialGroupIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [showViewCount, setShowViewCount] = useState(false);

  const progressAnims = useRef<Animated.Value[]>([]);
  const runningAnim = useRef<Animated.CompositeAnimation | null>(null);
  const viewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const group: UserStoryGroup | undefined = groups[groupIdx];
  const story: StoryItem | undefined = group?.stories[storyIdx];

  // Reset when group changes
  useEffect(() => {
    if (!visible || !group) return;
    setStoryIdx(0);
    setVideoReady(false);
    progressAnims.current = group.stories.map(() => new Animated.Value(0));
  }, [groupIdx, visible]);

  // Reset video-ready flag when story changes
  useEffect(() => {
    setVideoReady(false);
    setShowViewCount(false);
  }, [storyIdx]);

  // Advance to next story / next group
  const advance = useCallback(() => {
    if (!group) return;
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx((i) => i + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((g) => g + 1);
    } else {
      onClose();
    }
  }, [storyIdx, groupIdx, group, groups, onClose]);

  // Go back one story / one group
  const goBack = useCallback(() => {
    if (storyIdx > 0) {
      progressAnims.current[storyIdx]?.setValue(0);
      setStoryIdx((i) => i - 1);
    } else if (groupIdx > 0) {
      setGroupIdx((g) => g - 1);
    }
  }, [storyIdx, groupIdx]);

  // Start the progress bar for the current story
  const startProgress = useCallback(() => {
    const anim = progressAnims.current[storyIdx];
    if (!anim || paused) return;

    const isVideo = story?.mediaType === 'VIDEO';
    const duration = isVideo
      ? (story?.durationSeconds ?? 15) * 1000
      : IMAGE_DURATION_MS;

    runningAnim.current?.stop();
    anim.setValue(0);
    runningAnim.current = Animated.timing(anim, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    });
    runningAnim.current.start(({ finished }) => {
      if (finished) advance();
    });

    // Mark viewed
    if (story && !story.viewedByMe) {
      viewTimer.current = setTimeout(() => storyApi.markViewed(story.id).catch(() => {}), 500);
    }
  }, [story, storyIdx, paused, advance]);

  // Fire progress when story is ready
  useEffect(() => {
    if (!visible || !story) return;
    if (story.mediaType === 'VIDEO' ? videoReady : true) {
      startProgress();
    }
    return () => {
      runningAnim.current?.stop();
      if (viewTimer.current) clearTimeout(viewTimer.current);
    };
  }, [storyIdx, videoReady, visible, paused]);

  // Pause / resume
  useEffect(() => {
    if (paused) {
      runningAnim.current?.stop();
    } else if (story && (story.mediaType !== 'VIDEO' || videoReady)) {
      startProgress();
    }
  }, [paused]);

  // Clean up when modal closes
  useEffect(() => {
    if (!visible) {
      runningAnim.current?.stop();
      if (viewTimer.current) clearTimeout(viewTimer.current);
    }
  }, [visible]);

  // Swipe-down to close
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 16 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 60) onClose();
      },
    })
  ).current;

  const handleDelete = async () => {
    if (!story) return;
    await storyApi.deleteStory(story.id).catch(() => {});
    onDeleted?.();
    advance();
  };

  if (!visible || !group || !story) return null;

  const filterOverlay = FILTER_OVERLAY[story.filterName ?? 'NORMAL'] ?? null;
  const isVideo = story.mediaType === 'VIDEO';
  const mediaUri = resolveMediaUrl(story.mediaUrl);

  const avatarUri = resolveMediaUrl(group.profileImageUrl);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar hidden />
      <View style={s.root} {...pan.panHandlers}>

        {/* ── Media ─────────────────────────────────────────────────── */}
        {isVideo && mediaUri ? (
          <VideoStory
            uri={mediaUri}
            paused={paused}
            onReady={() => setVideoReady(true)}
            onEnd={advance}
          />
        ) : mediaUri ? (
          <Image
            source={{ uri: mediaUri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1a1a2e' }]} />
        )}

        {/* Filter overlay */}
        {filterOverlay && (
          <View
            style={[StyleSheet.absoluteFillObject, { backgroundColor: filterOverlay }]}
            pointerEvents="none"
          />
        )}

        {/* Scrim gradients */}
        <View style={s.scrimTop} pointerEvents="none" />
        <View style={s.scrimBottom} pointerEvents="none" />

        {/* ── Tap zones ─────────────────────────────────────────────── */}
        <Pressable
          style={s.tapLeft}
          onPress={goBack}
          onLongPress={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
        />
        <Pressable
          style={s.tapRight}
          onPress={advance}
          onLongPress={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
        />

        {/* ── Progress bars ──────────────────────────────────────────── */}
        <View style={s.progressRow}>
          {group.stories.map((_, i) => {
            const anim = progressAnims.current[i];
            const done = i < storyIdx;
            return (
              <View key={i} style={s.progressTrack}>
                <Animated.View
                  style={[
                    s.progressFill,
                    {
                      width:
                        done ? '100%'
                        : i === storyIdx && anim
                          ? anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                          : '0%',
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>

        {/* ── Header ────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarPh]}>
                <Text style={s.avatarInitial}>{(group.displayName ?? '?')[0]?.toUpperCase()}</Text>
              </View>
            )}
            <View>
              <Text style={s.authorName} numberOfLines={1}>
                {group.isOwn ? 'Your Story' : group.displayName ?? 'User'}
              </Text>
              <Text style={s.storyTime}>{timeAgo(story.createdAt)}</Text>
            </View>
          </View>
          <View style={s.headerRight}>
            {group.isOwn && (
              <TouchableOpacity onPress={() => setShowViewCount((v) => !v)} style={s.iconBtn} activeOpacity={0.75}>
                <Eye color="#fff" size={18} strokeWidth={2} />
              </TouchableOpacity>
            )}
            {group.isOwn && (
              <TouchableOpacity onPress={handleDelete} style={s.iconBtn} activeOpacity={0.75}>
                <Trash2 color="rgba(255,80,80,0.9)" size={16} strokeWidth={2} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={s.iconBtn} activeOpacity={0.75}>
              <X color="#fff" size={22} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>

        {/* View count bubble */}
        {showViewCount && group.isOwn && (
          <View style={s.viewBubble}>
            <Eye color="#fff" size={13} strokeWidth={2} />
            <Text style={s.viewBubbleText}>{story.viewCount} views</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  scrimTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 140,
    backgroundColor: 'rgba(0,0,0,0.44)',
  },
  scrimBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 90,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },

  tapLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '40%' },
  tapRight: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '60%' },

  progressRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    left: 12, right: 12,
    flexDirection: 'row', gap: 4,
  },
  progressTrack: {
    flex: 1, height: 2.5, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },

  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 70 : 50,
    left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#fff' },
  avatarPh: { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 16, fontWeight: '700' },
  authorName: { color: '#fff', fontSize: 14, fontWeight: '700', maxWidth: 160 },
  storyTime: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 },
  iconBtn: { padding: 7 },

  viewBubble: {
    position: 'absolute', bottom: 30, left: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.58)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  viewBubbleText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
