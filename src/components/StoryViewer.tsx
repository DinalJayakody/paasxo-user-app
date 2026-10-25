import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  Linking,
  Modal,
  PanResponder,
  Keyboard,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle, Download, Eye, Music2, PlusCircle, Repeat2, Send, Trash2, UserRound, VolumeX, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StoryItem, UserStoryGroup, storyApi } from '../api/storyApi';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { useAuth } from '../context/AuthContext';
import { openProfile } from '../utils/openProfile';
import { serverTimeMs } from '../utils/serverTime';
import { shareContent } from '../utils/shareContent';
import { contentEvents } from '../stores/contentEvents';
import { extractApiError } from '../utils/apiError';
import { TaggedPeopleModal } from './TaggedPeopleModal';
import { GradeLayers } from './story/grades';
import { StoryEffectLayer } from './story/effects';
import { StoryCaption, normaliseCaptionStyle } from './story/captionStyles';
import { LocationSticker } from './story/LocationSticker';
import { CenteredAt } from './story/CenteredAt';
import { useStoryFonts } from './story/storyFonts';
import { saveMediaToDevice } from '../utils/saveMedia';
import { SendStorySheet } from './story/SendStorySheet';

// expo-video (SDK 54+) – platform-safe import
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
const IMAGE_DURATION_MS = 5000;
const SWIPE_CLOSE_DY = 80;
const SWIPE_GROUP_DX = 60;

/** Paasxo's story accent — the brand blue running into a court-line cyan. */
export const STORY_GRADIENT = ['#22D3EE', '#3B8FD4', '#2977C2', '#1E3A8A'] as const;

function timeAgo(iso: string): string {
  const t = serverTimeMs(iso);
  if (!t) return 'Just now';
  const m = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ── VideoStory — isolated so useVideoPlayer is always called unconditionally ──
function VideoStory({
  uri, paused, muted, onReady, onEnd,
}: {
  uri: string;
  paused: boolean;
  muted: boolean;
  onReady: (durationMs: number | null) => void;
  onEnd: () => void;
}) {
  const player = useVideoPlayer({ uri }, (p: any) => {
    p.loop = false;
    p.muted = muted;
  });
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => { player.muted = muted; }, [muted, player]);

  useEffect(() => {
    const end = player.addListener('playToEnd', () => onEndRef.current());
    const status = player.addListener('statusChange', ({ status: st }: any) => {
      if (st === 'error') onReadyRef.current(null); // let the bar run so the viewer moves on
      if (st === 'readyToPlay') {
        const d = Number(player.duration);
        onReadyRef.current(Number.isFinite(d) && d > 0 ? d * 1000 : null);
      }
    });
    // Already loaded (cached) before the listener attached.
    if (player.status === 'readyToPlay') {
      const d = Number(player.duration);
      onReadyRef.current(Number.isFinite(d) && d > 0 ? d * 1000 : null);
    }
    return () => { end.remove(); status.remove(); };
  }, [player]);

  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);

  return <VideoView player={player} style={StyleSheet.absoluteFillObject} contentFit="cover" nativeControls={false} />;
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  groups: UserStoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
  /** Called (once, on close) when your stories changed here (deleted, or one added to yours). */
  onDeleted?: () => void;
}

// ── Main viewer ───────────────────────────────────────────────────────────────
export function StoryViewer({ visible, groups, initialGroupIndex, onClose, onDeleted }: Props) {
  const router = useRouter();
  const { user: me } = useAuth();

  const [groupIdx, setGroupIdx] = useState(initialGroupIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [holdPaused, setHoldPaused] = useState(false);
  const [busyPause, setBusyPause] = useState(false); // share sheet / dialogs
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaDurationMs, setMediaDurationMs] = useState<number | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [sheet, setSheet] = useState<null | { kind: 'tags' | 'viewers'; people: { firebaseUid: string; displayName: string; profileImageUrl?: string }[] }>(null);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const deletedAny = useRef(false);
  const fontsReady = useStoryFonts(visible);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const viewedIds = useRef(new Set<string>());
  const [replyText, setReplyText] = useState('');
  const [replyFocused, setReplyFocused] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [sendSheet, setSendSheet] = useState(false);
  const [resharing, setResharing] = useState(false);
  const [keyboardH, setKeyboardH] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardH(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardH(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // (Re)open at the tapped group — the viewer stays mounted between openings.
  useEffect(() => {
    if (!visible) return;
    setGroupIdx(initialGroupIndex);
    setStoryIdx(0);
    setHoldPaused(false);
    setBusyPause(false);
    setSheet(null);
  }, [visible, initialGroupIndex]);

  // Stories deleted from this viewer drop out immediately (and whole groups with them).
  const liveGroups = useMemo(
    () => groups
      .map((g) => (removed.size ? { ...g, stories: g.stories.filter((st) => !removed.has(st.id)) } : g))
      .filter((g) => g.stories.length > 0),
    [groups, removed],
  );
  const group: UserStoryGroup | undefined = liveGroups[groupIdx];
  const stories = group?.stories ?? [];
  const safeIdx = Math.min(storyIdx, Math.max(0, stories.length - 1));
  const story: StoryItem | undefined = stories[safeIdx];
  const isOwn = !!group && (group.isOwn || group.firebaseUid === me?.firebaseUid);
  // Typing a reply or picking friends holds the story still.
  const paused = holdPaused || busyPause || !!sheet || replyFocused || sendSheet;

  const close = useCallback(() => {
    if (deletedAny.current) {
      deletedAny.current = false;
      onDeleted?.();
    }
    onClose();
  }, [onClose, onDeleted]);

  // Nothing (left) to show → close.
  useEffect(() => {
    if (visible && groups.length > 0 && !group) close();
  }, [visible, group, groups.length, close]);

  // ── Navigation ──────────────────────────────────────────────────────────
  const next = useCallback(() => {
    if (safeIdx < stories.length - 1) setStoryIdx(safeIdx + 1);
    else if (groupIdx < liveGroups.length - 1) { setGroupIdx(groupIdx + 1); setStoryIdx(0); }
    else close();
  }, [safeIdx, stories.length, groupIdx, liveGroups.length, close]);

  const prev = useCallback(() => {
    if (safeIdx > 0) setStoryIdx(safeIdx - 1);
    else if (groupIdx > 0) {
      const target = groupIdx - 1;
      setGroupIdx(target);
      setStoryIdx(0);
    }
  }, [safeIdx, groupIdx]);

  const nextGroup = useCallback(() => {
    if (groupIdx < liveGroups.length - 1) { setGroupIdx(groupIdx + 1); setStoryIdx(0); } else close();
  }, [groupIdx, liveGroups.length, close]);
  const prevGroup = useCallback(() => {
    if (groupIdx > 0) { setGroupIdx(groupIdx - 1); setStoryIdx(0); }
  }, [groupIdx]);

  // Gesture/animation callbacks read the latest handlers through refs.
  const nav = useRef({ next, close, nextGroup, prevGroup });
  nav.current = { next, close, nextGroup, prevGroup };

  // A video can report its end twice (playToEnd + the progress bar running
  // out at the same moment) — advance only once per showing of a story.
  const advancedFor = useRef<string | null>(null);
  const finishStory = useCallback((id: string) => {
    if (advancedFor.current === id) return;
    advancedFor.current = id;
    nav.current.next();
  }, []);

  // Moving to another person always starts at their first story.
  useEffect(() => { setStoryIdx(0); setReplyText(''); }, [group?.firebaseUid]);

  // ── Progress ────────────────────────────────────────────────────────────
  const progress = useRef(new Animated.Value(0)).current;
  const progressAt = useRef(0);

  // New story: restart from zero and wait for its media.
  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    progressAt.current = 0;
    advancedFor.current = null;
    setMediaReady(false);
    setMediaDurationMs(null);
  }, [story?.id, progress]);

  const totalMs = story?.mediaType === 'VIDEO'
    ? (mediaDurationMs ?? Math.max(1, story?.durationSeconds ?? 15) * 1000)
    : IMAGE_DURATION_MS;

  useEffect(() => {
    if (!visible || !story || !mediaReady || paused) return;
    const from = progressAt.current;
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: Math.max(0, totalMs * (1 - from)),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (!finished) return;
      // Videos normally advance on playToEnd; the bar is the fallback for a
      // stalled player (with a little grace so a slow last frame isn't cut).
      if (story.mediaType === 'VIDEO') setTimeout(() => finishStory(story.id), 800);
      else finishStory(story.id);
    });
    return () => {
      anim.stop();
      progress.stopAnimation((v) => { progressAt.current = v; });
    };
  }, [visible, story, mediaReady, paused, totalMs, progress, finishStory]);

  // Count a view once the story is actually on screen (never for your own).
  useEffect(() => {
    if (!visible || !story || !mediaReady || isOwn || story.viewedByMe || viewedIds.current.has(story.id)) return;
    const t = setTimeout(() => {
      viewedIds.current.add(story.id);
      storyApi.markViewed(story.id);
    }, 600);
    return () => clearTimeout(t);
  }, [visible, story, mediaReady, isOwn]);

  // Warm the cache with the next photo so it opens instantly (images only —
  // videos stream on demand). One prefetch per story shown, nothing more.
  useEffect(() => {
    if (!visible || !group) return;
    const nextStory = stories[safeIdx + 1] ?? liveGroups[groupIdx + 1]?.stories[0];
    if (nextStory && nextStory.mediaType !== 'VIDEO') {
      const uri = resolveMediaUrl(nextStory.mediaUrl);
      if (uri) Image.prefetch(uri).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, story?.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Background music (separate track, not baked into the media) ─────────
  const bgSoundRef = useRef<any>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (bgSoundRef.current) {
        await bgSoundRef.current.unloadAsync().catch(() => {});
        bgSoundRef.current = null;
      }
      if (Audio && visible && story?.audioTrackUrl) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri: story.audioTrackUrl },
            { shouldPlay: false, isLooping: true, volume: story.audioVolume ?? 0.85 },
          );
          if (cancelled) { await sound.unloadAsync().catch(() => {}); return; }
          bgSoundRef.current = sound;
          if (!pausedRef.current) sound.playAsync().catch(() => {});
        } catch {
          // Non-fatal — the story still plays without its track.
        }
      }
    })();
    return () => { cancelled = true; };
  }, [story?.id, story?.audioTrackUrl, story?.audioVolume, visible]);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    if (!bgSoundRef.current) return;
    if (paused) bgSoundRef.current.pauseAsync().catch(() => {});
    else bgSoundRef.current.playAsync().catch(() => {});
  }, [paused]);

  useEffect(() => {
    if (visible) return;
    bgSoundRef.current?.unloadAsync?.().catch(() => {});
    bgSoundRef.current = null;
  }, [visible]);
  useEffect(() => () => { bgSoundRef.current?.unloadAsync?.().catch(() => {}); }, []);

  // ── Gestures: swipe down closes, swipe sideways jumps between people ────
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 16 || Math.abs(g.dx) > 16,
      onPanResponderRelease: (_, g) => {
        if (g.dy > SWIPE_CLOSE_DY && Math.abs(g.dy) > Math.abs(g.dx)) nav.current.close();
        else if (g.dx < -SWIPE_GROUP_DX && Math.abs(g.dx) > Math.abs(g.dy)) nav.current.nextGroup();
        else if (g.dx > SWIPE_GROUP_DX && Math.abs(g.dx) > Math.abs(g.dy)) nav.current.prevGroup();
      },
    }),
  ).current;

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!story) return;
    setBusyPause(true);
    await shareContent('story', story.id, group?.displayName);
    setBusyPause(false);
  };

  const handleDelete = () => {
    if (!story) return;
    const target = story;
    setBusyPause(true);
    Alert.alert('Delete this story?', 'It will be removed for everyone straight away.', [
      { text: 'Cancel', style: 'cancel', onPress: () => setBusyPause(false) },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await storyApi.deleteStory(target.id);
            contentEvents.markDeleted('story', target.id);
            deletedAny.current = true;
            setRemoved((prevSet) => new Set(prevSet).add(target.id));
          } catch (err) {
            Alert.alert('Could not delete', extractApiError(err, 'Please try again.'));
          } finally {
            setBusyPause(false);
          }
        },
      },
    ], { cancelable: true, onDismiss: () => setBusyPause(false) });
  };

  const openViewers = async () => {
    if (!story || loadingViewers) return;
    setLoadingViewers(true);
    setBusyPause(true);
    try {
      const people = await storyApi.getViewers(story.id);
      setSheet({ kind: 'viewers', people });
    } catch (err) {
      Alert.alert('Could not load viewers', extractApiError(err, 'Please try again.'));
    } finally {
      setLoadingViewers(false);
      setBusyPause(false);
    }
  };

  const handleSave = async () => {
    if (!story || saving) return;
    const uri = resolveMediaUrl(story.mediaUrl);
    if (!uri) return;
    setSaving(true);
    setBusyPause(true);
    const res = await saveMediaToDevice(uri, story.mediaType === 'VIDEO');
    setSaving(false);
    setBusyPause(false);
    if (res === 'saved') setToast(story.mediaType === 'VIDEO' ? 'Video saved to your gallery' : 'Photo saved to your gallery');
    else if (res === 'denied') Alert.alert('Allow Photos access', 'To save, allow Paasxo to add photos in your phone’s Settings.');
    else if (res === 'failed') setToast('Couldn’t save — check your connection');
  };

  const openLocation = () => {
    if (!story?.locationName) return;
    const q = story.locationLat != null && story.locationLng != null
      ? `${story.locationLat},${story.locationLng}`
      : story.locationName;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
      + (story.locationPlaceId ? `&query_place_id=${encodeURIComponent(story.locationPlaceId)}` : '');
    Linking.openURL(url).catch(() => {});
  };

  const goToProfile = (uid: string) => {
    setSheet(null);
    close();
    openProfile(router, uid, me?.firebaseUid);
  };

  const sendReply = async () => {
    const text = replyText.trim();
    if (!story || !text || sendingReply) return;
    setSendingReply(true);
    try {
      await storyApi.reply(story.id, text);
      setReplyText('');
      Keyboard.dismiss();
      setToast('Reply sent');
    } catch (err) {
      Alert.alert('Couldn’t send your reply', extractApiError(err, 'Please try again.'));
    } finally {
      setSendingReply(false);
    }
  };

  const handleReshare = async () => {
    if (!story || resharing) return;
    setResharing(true);
    setBusyPause(true);
    try {
      await storyApi.reshare(story.id);
      deletedAny.current = true; // same "stories changed" refresh on close
      setToast('Added to your story');
    } catch (err) {
      Alert.alert('Couldn’t add to your story', extractApiError(err, 'Please try again.'));
    } finally {
      setResharing(false);
      setBusyPause(false);
    }
  };

  if (!visible || !group || !story) return null;

  const isVideo = story.mediaType === 'VIDEO';
  const mediaUri = resolveMediaUrl(story.mediaUrl);
  const avatarUri = resolveMediaUrl(group.profileImageUrl);
  const tagged = story.taggedUsers ?? [];
  const chromeOpacity = holdPaused ? 0 : 1;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" statusBarTranslucent onRequestClose={close}>
      <StatusBar hidden />
      <View style={s.root} {...pan.panHandlers}>
        {/* ── Media + colour grade (blended in their own isolated group) ── */}
        <View style={s.mediaGroup} pointerEvents="none">
        {isVideo && mediaUri && useVideoPlayer && VideoView ? (
          <VideoStory
            key={story.id}
            uri={mediaUri}
            paused={paused || !mediaReady}
            muted={!!story.audioTrackUrl || !!story.soundOff}
            onReady={(ms) => { setMediaDurationMs(ms); setMediaReady(true); }}
            onEnd={() => finishStory(story.id)}
          />
        ) : mediaUri && !isVideo ? (
          <Image
            key={story.id}
            source={{ uri: mediaUri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            onLoad={() => setMediaReady(true)}
            onError={() => setMediaReady(true)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, s.mediaFallback]} onLayout={() => setMediaReady(true)}>
            <Text style={s.mediaFallbackText}>This story can’t be shown here</Text>
          </View>
        )}

          <GradeLayers gradeKey={story.filterName} />
        </View>

        {!mediaReady && (
          <View style={s.loading} pointerEvents="none">
            <ActivityIndicator color="#fff" />
          </View>
        )}

        {mediaReady && <StoryEffectLayer key={`fx-${story.id}`} effectKey={story.effect} fontsReady={fontsReady} />}

        {/* Caption / emoji — stored as normalised centre positions, drawn at view time. */}
        {!!story.captionText && (
          <CenteredAt x={story.captionX ?? 0.5} y={story.captionY ?? 0.4}>
            <StoryCaption
              text={story.captionText}
              color={story.captionColor || '#FFFFFF'}
              styleKey={normaliseCaptionStyle(story.captionStyle)}
              scale={story.captionScale ?? 1}
              fontsReady={fontsReady}
              maxWidth={W - 40}
            />
          </CenteredAt>
        )}
        {!!story.emoji && (
          <CenteredAt x={story.emojiX ?? 0.5} y={story.emojiY ?? 0.6}>
            <Text style={s.emoji} allowFontScaling={false}>{story.emoji}</Text>
          </CenteredAt>
        )}

        <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={s.scrimTop} pointerEvents="none" />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={s.scrimBottom} pointerEvents="none" />

        {/* ── Tap zones: left = back, right = next, hold = pause ──────── */}
        <Pressable
          style={s.tapLeft}
          onPress={prev}
          delayLongPress={220}
          onLongPress={() => setHoldPaused(true)}
          onPressOut={() => setHoldPaused(false)}
          accessibilityLabel="Previous story"
        />
        <Pressable
          style={s.tapRight}
          onPress={next}
          delayLongPress={220}
          onLongPress={() => setHoldPaused(true)}
          onPressOut={() => setHoldPaused(false)}
          accessibilityLabel="Next story"
        />

        {!!story.locationName && (
          <CenteredAt x={story.locationX ?? 0.5} y={story.locationY ?? 0.66} onPressable maxWidth={W - 60}>
            <Pressable
              onPress={openLocation}
              hitSlop={6}
              accessibilityRole="link"
              accessibilityLabel={`${story.locationName}, open in Maps`}
              style={{ opacity: chromeOpacity }}
            >
              <LocationSticker name={story.locationName} fontsReady={fontsReady} maxWidth={W - 60} />
            </Pressable>
          </CenteredAt>
        )}

        {/* ── Progress ──────────────────────────────────────────────── */}
        <View style={[s.progressRow, { opacity: chromeOpacity }]} pointerEvents="none">
          {stories.map((st, i) => (
            <View key={st.id} style={s.progressTrack}>
              {i < safeIdx ? (
                <View style={[s.progressFill, { width: '100%' }]} />
              ) : i === safeIdx ? (
                <Animated.View
                  style={[s.progressFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
                />
              ) : null}
            </View>
          ))}
        </View>

        {/* ── Header ────────────────────────────────────────────────── */}
        <View style={[s.header, { opacity: chromeOpacity }]} pointerEvents={holdPaused ? 'none' : 'box-none'}>
          <Pressable
            style={s.headerLeft}
            onPress={() => goToProfile(group.firebaseUid)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${group.displayName ?? 'user'}'s profile`}
          >
            <LinearGradient colors={STORY_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatarRing}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.avatarPh]}>
                  <Text style={s.avatarInitial}>{(group.displayName ?? '?')[0]?.toUpperCase()}</Text>
                </View>
              )}
            </LinearGradient>
            <View style={{ flexShrink: 1 }}>
              <View style={s.nameRow}>
                <Text style={s.authorName} numberOfLines={1}>{isOwn ? 'Your story' : group.displayName ?? 'Player'}</Text>
                <Text style={s.storyTime}>{timeAgo(story.createdAt)}</Text>
              </View>
              {!!story.resharedFromName && (
                <Pressable
                  style={s.musicRow}
                  onPress={() => story.resharedFromUid && goToProfile(story.resharedFromUid)}
                  hitSlop={6}
                  accessibilityRole="link"
                  accessibilityLabel={`Story by ${story.resharedFromName}`}
                >
                  <Repeat2 color="rgba(255,255,255,0.9)" size={11} strokeWidth={2.4} />
                  <Text style={s.musicText} numberOfLines={1}>{story.resharedFromName}’s story</Text>
                </Pressable>
              )}
              {!!story.audioTrackUrl && (
                <View style={s.musicRow}>
                  <Music2 color="rgba(255,255,255,0.85)" size={11} strokeWidth={2.4} />
                  <Text style={s.musicText}>Music</Text>
                </View>
              )}
              {isVideo && !!story.soundOff && !story.audioTrackUrl && (
                <View style={s.musicRow}>
                  <VolumeX color="rgba(255,255,255,0.85)" size={11} strokeWidth={2.4} />
                  <Text style={s.musicText}>No sound</Text>
                </View>
              )}
            </View>
          </Pressable>
          <Pressable onPress={close} style={s.iconBtn} hitSlop={10} accessibilityLabel="Close stories">
            <X color="#fff" size={24} strokeWidth={2.4} />
          </Pressable>
        </View>

        {/* ── Bottom: tags + actions ────────────────────────────────── */}
        <View
          style={[s.bottom, { opacity: chromeOpacity }, keyboardH > 0 && { bottom: keyboardH + 10 }]}
          pointerEvents={holdPaused ? 'none' : 'box-none'}
        >
          <View style={s.chipRow}>
            {tagged.length > 0 && (
              <Pressable
                style={s.tagPill}
                onPress={() => setSheet({ kind: 'tags', people: tagged })}
                accessibilityLabel="People tagged in this story"
              >
                <UserRound color="#fff" size={13} strokeWidth={2.4} />
                <Text style={s.tagPillText} numberOfLines={1}>
                  {tagged.length === 1 ? tagged[0].displayName : `${tagged[0].displayName} +${tagged.length - 1}`}
                </Text>
              </Pressable>
            )}
            {!isOwn && !!story.canReshare && (
              <Pressable style={s.addPill} onPress={handleReshare} disabled={resharing} accessibilityRole="button">
                {resharing ? <ActivityIndicator color="#fff" size="small" /> : <PlusCircle color="#fff" size={14} strokeWidth={2.4} />}
                <Text style={s.tagPillText}>Add to your story</Text>
              </Pressable>
            )}
          </View>

          <View style={s.actionRow}>
            {isOwn ? (
              <Pressable style={s.glassPill} onPress={openViewers} accessibilityLabel="See who viewed your story">
                {loadingViewers
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Eye color="#fff" size={16} strokeWidth={2.2} />}
                <Text style={s.glassPillText}>
                  {story.viewCount > 0 ? `Seen by ${story.viewCount}` : 'No views yet'}
                </Text>
              </Pressable>
            ) : story.canReply !== false ? (
              <View style={[s.replyBox, replyFocused && s.replyBoxFocused]}>
                <TextInput
                  value={replyText}
                  onChangeText={setReplyText}
                  onFocus={() => setReplyFocused(true)}
                  onBlur={() => setReplyFocused(false)}
                  placeholder={`Reply to ${group.displayName?.split(' ')[0] ?? 'story'}…`}
                  placeholderTextColor="rgba(255,255,255,0.7)"
                  style={s.replyInput}
                  keyboardAppearance="dark"
                  maxLength={1000}
                  returnKeyType="send"
                  onSubmitEditing={sendReply}
                  accessibilityLabel="Reply to this story"
                />
                {!!replyText.trim() && (
                  <Pressable onPress={sendReply} disabled={sendingReply} hitSlop={8} accessibilityLabel="Send reply">
                    {sendingReply ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.replySend}>Send</Text>}
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={[s.replyBox, { opacity: 0.7 }]}>
                <Text style={s.replyOff} numberOfLines={1}>Replies are turned off</Text>
              </View>
            )}
            {isOwn && <View style={{ flex: 1 }} />}
            {!replyFocused && (
              <Pressable style={s.roundBtn} onPress={() => setSendSheet(true)} accessibilityLabel="Send this story">
                <Send color="#fff" size={19} strokeWidth={2.2} />
              </Pressable>
            )}
            {isOwn && (
              <Pressable style={s.roundBtn} onPress={handleSave} disabled={saving} accessibilityLabel="Save story to your phone">
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Download color="#fff" size={19} strokeWidth={2.2} />}
              </Pressable>
            )}
            {isOwn && (
              <Pressable style={s.roundBtn} onPress={handleDelete} accessibilityLabel="Delete story">
                <Trash2 color="#FF8A8A" size={19} strokeWidth={2.2} />
              </Pressable>
            )}
          </View>
        </View>

        {sendSheet && (
          <SendStorySheet
            storyId={story.id}
            onClose={() => setSendSheet(false)}
            onShareLink={() => { setSendSheet(false); handleShare(); }}
            onSent={(n) => { setSendSheet(false); setToast(n > 1 ? `Sent to ${n} people` : 'Sent'); }}
          />
        )}
      </View>

      {!!toast && (
        <View style={s.toast} pointerEvents="none">
          <CheckCircle color="#22D3EE" size={16} strokeWidth={2.6} />
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}

      <TaggedPeopleModal
        visible={!!sheet}
        title={sheet?.kind === 'viewers' ? `Seen by ${sheet.people.length}` : 'Tagged in this story'}
        people={sheet?.people ?? []}
        onClose={() => setSheet(null)}
        onOpen={goToProfile}
      />
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const TOP = Platform.OS === 'ios' ? 54 : 30;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05070C' },
  mediaFallback: { backgroundColor: '#0B1626', alignItems: 'center', justifyContent: 'center' },
  mediaFallbackText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

  scrimTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 150 },
  scrimBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 170 },

  mediaGroup: { ...StyleSheet.absoluteFillObject, isolation: 'isolate', overflow: 'hidden' },
  emoji: { fontSize: 48 },
  toast: {
    position: 'absolute', alignSelf: 'center', top: H * 0.45,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(8,12,20,0.88)', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(34,211,238,0.5)',
  },
  toastText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },

  tapLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '35%' },
  tapRight: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '65%' },

  progressRow: { position: 'absolute', top: TOP, left: 10, right: 10, flexDirection: 'row', gap: 4 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },

  header: {
    position: 'absolute', top: TOP + 12, left: 12, right: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatarRing: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 35, height: 35, borderRadius: 17.5, borderWidth: 1.5, borderColor: '#05070C' },
  avatarPh: { backgroundColor: '#1E2A3B', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 15, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  authorName: { color: '#fff', fontSize: 14, fontWeight: '800', maxWidth: W * 0.45 },
  storyTime: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '600' },
  musicRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  musicText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  iconBtn: { padding: 6 },

  bottom: { position: 'absolute', left: 14, right: 14, bottom: Platform.OS === 'ios' ? 34 : 20, gap: 10 },
  tagPill: {
    alignSelf: 'flex-start', maxWidth: W * 0.7,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(41,119,194,0.55)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(107,182,255,0.55)',
    paddingHorizontal: 11, paddingVertical: 6,
  },
  tagPillText: { color: '#fff', fontSize: 12.5, fontWeight: '700', flexShrink: 1 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', paddingHorizontal: 11, paddingVertical: 6,
  },
  replyBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderRadius: 23,
    paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', backgroundColor: 'rgba(0,0,0,0.18)',
  },
  replyBoxFocused: { backgroundColor: 'rgba(0,0,0,0.55)', borderColor: '#fff' },
  replyInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 0 },
  replySend: { color: '#fff', fontSize: 15, fontWeight: '900' },
  replyOff: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  glassPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8, height: 46,
    paddingHorizontal: 16, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  glassPillText: { color: '#fff', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  roundBtn: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
});
