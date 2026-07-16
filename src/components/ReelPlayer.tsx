import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Eye, Heart, X } from 'lucide-react-native';
import { ReelSummary } from '../types/api';
import { reelApi } from '../api/reelApi';
import { parseMediaUrl } from '../utils/postFormat';
import { Colors } from '../styles/colors';

let useVideoPlayer: any = null;
let VideoView: any = null;
let Audio: any = null;
if (Platform.OS !== 'web') {
  try {
    const vid = require('expo-video');
    useVideoPlayer = vid.useVideoPlayer;
    VideoView = vid.VideoView;
  } catch {}
  try {
    Audio = require('expo-av').Audio;
  } catch {}
}

const { width: W, height: H } = Dimensions.get('window');

const FILTER_OVERLAY: Record<string, string | null> = {
  NORMAL: null,
  WARM: 'rgba(255,120,50,0.20)',
  COOL: 'rgba(30,100,255,0.20)',
  ROSE: 'rgba(255,50,120,0.18)',
  FADE: 'rgba(255,255,255,0.28)',
  DRAMA: 'rgba(0,0,0,0.22)',
  GREEN: 'rgba(50,200,100,0.15)',
};

interface ReelPlayerProps {
  visible: boolean;
  reel: ReelSummary | null;
  onClose: () => void;
}

function LoopingVideo({ uri, muted }: { uri: string; muted: boolean }) {
  if (!useVideoPlayer || !VideoView) {
    return (
      <View style={[StyleSheet.absoluteFillObject, styles.videoFallback]}>
        <Text style={styles.videoFallbackText}>Video unavailable on this platform</Text>
      </View>
    );
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const player = useVideoPlayer({ uri }, (p: any) => {
    p.loop = true;
    p.muted = muted;
    p.play();
  });
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);
  return (
    <VideoView player={player} style={StyleSheet.absoluteFillObject} contentFit="cover" nativeControls={false} />
  );
}

export function ReelPlayer({ visible, reel, onClose }: ReelPlayerProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const heartScale = useRef(new Animated.Value(1)).current;
  const viewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!reel) return;
    setLiked(reel.likedByCurrentUser);
    setLikeCount(reel.likeCount);
  }, [reel?.id]);

  useEffect(() => {
    if (!visible || !reel) return;
    viewTimer.current = setTimeout(() => reelApi.recordView(reel.id).catch(() => {}), 1200);
    return () => {
      if (viewTimer.current) clearTimeout(viewTimer.current);
    };
  }, [visible, reel?.id]);

  // Background music — separate audio track played alongside the (usually
  // muted) video, not baked into the video pixels.
  const bgSoundRef = useRef<any>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (bgSoundRef.current) {
        await bgSoundRef.current.unloadAsync().catch(() => {});
        bgSoundRef.current = null;
      }
      if (Audio && visible && reel?.audioTrackUrl) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri: reel.audioTrackUrl },
            { shouldPlay: true, isLooping: true, volume: reel.audioVolume ?? 0.85 }
          );
          if (cancelled) await sound.unloadAsync().catch(() => {});
          else bgSoundRef.current = sound;
        } catch {
          // Non-fatal — the reel still plays, just without its background track.
        }
      }
    })();
    return () => { cancelled = true; };
  }, [reel?.id, visible]);

  useEffect(() => {
    return () => {
      bgSoundRef.current?.unloadAsync?.().catch(() => {});
    };
  }, []);

  if (!visible || !reel) return null;

  const mediaUri = parseMediaUrl(reel.mediaUrl);
  const filterOverlay = FILTER_OVERLAY[reel.filterName ?? 'NORMAL'] ?? null;

  const toggleLike = async () => {
    if (busy) return;
    setBusy(true);
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevCount + (prevLiked ? -1 : 1));
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.35, useNativeDriver: true, friction: 3 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, friction: 3 }),
    ]).start();
    try {
      const updated = await reelApi.toggleLikeReel(reel.id);
      setLiked(updated.likedByCurrentUser);
      setLikeCount(updated.likeCount);
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar hidden />
      <View style={styles.root}>
        {mediaUri ? (
          <LoopingVideo uri={mediaUri} muted={!!reel.audioTrackUrl} />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1a1a2e' }]} />
        )}

        {filterOverlay && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: filterOverlay }]} pointerEvents="none" />
        )}

        {!!reel.captionText && (
          <View
            style={[styles.stickerPos, { left: (reel.captionX ?? 0.5) * W, top: (reel.captionY ?? 0.4) * H }]}
            pointerEvents="none"
          >
            <Text style={[styles.stickerCaptionText, { color: reel.captionColor || '#fff' }]}>{reel.captionText}</Text>
          </View>
        )}
        {!!reel.emoji && (
          <View
            style={[styles.stickerPos, { left: (reel.emojiX ?? 0.5) * W, top: (reel.emojiY ?? 0.6) * H }]}
            pointerEvents="none"
          >
            <Text style={styles.stickerEmoji}>{reel.emoji}</Text>
          </View>
        )}

        <View style={styles.scrimBottom} pointerEvents="none" />

        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.iconBtn}>
            <X color="#fff" size={24} strokeWidth={2.5} />
          </Pressable>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.captionWrap}>
            <Text style={styles.authorName} numberOfLines={1}>{reel.authorDisplayName}</Text>
            {!!reel.caption && <Text style={styles.captionText} numberOfLines={2}>{reel.caption}</Text>}
          </View>
          <View style={styles.actionsCol}>
            <Pressable onPress={toggleLike} style={styles.actionBtn} hitSlop={10}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Heart color={liked ? Colors.liveRed : '#fff'} fill={liked ? Colors.liveRed : 'none'} size={30} strokeWidth={2.2} />
              </Animated.View>
              <Text style={styles.actionCount}>{likeCount}</Text>
            </Pressable>
            <View style={styles.actionBtn}>
              <Eye color="#fff" size={26} strokeWidth={2} />
              <Text style={styles.actionCount}>{reel.viewCount}</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  videoFallback: { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  videoFallbackText: { color: '#fff', fontSize: 13 },

  stickerPos: { position: 'absolute' },
  stickerCaptionText: {
    fontSize: 22, fontWeight: '800', textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  stickerEmoji: { fontSize: 44 },

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
