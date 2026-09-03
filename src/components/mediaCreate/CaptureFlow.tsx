import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  FlipHorizontal,
  Image as ImageIcon,
  Music,
  Pause,
  Play,
  RefreshCw,
  Smile,
  Type as TypeIcon,
  Video,
  X,
  Zap,
} from 'lucide-react-native';
import { ThemeColors } from '../../styles/colors';
import { useTheme } from '../../context/ThemeContext';
import { audioApi, AudioTrack } from '../../api/audioApi';

// Platform-safe camera / native-module imports
let CameraView: any = null;
let useCameraPermissions: any = null;
let useMicrophonePermissions: any = null;
let ImageManipulator: any = null;
let VideoThumbnails: any = null;
let useVideoPlayer: any = null;
let VideoView: any = null;
let Audio: any = null;

if (Platform.OS !== 'web') {
  try {
    const cam = require('expo-camera');
    CameraView = cam.CameraView;
    useCameraPermissions = cam.useCameraPermissions;
    useMicrophonePermissions = cam.useMicrophonePermissions;
  } catch {}
  try {
    ImageManipulator = require('expo-image-manipulator');
  } catch {}
  try {
    VideoThumbnails = require('expo-video-thumbnails');
  } catch {}
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

// ── Filter presets (shared between Stories and Reels) ──────────────────────
export const CAPTURE_FILTERS = [
  { name: 'NORMAL', label: 'Normal', overlay: null, labelColor: '#fff' },
  { name: 'WARM', label: 'Warm', overlay: 'rgba(255,120,50,0.22)', labelColor: '#FFAA55' },
  { name: 'COOL', label: 'Cool', overlay: 'rgba(30,100,255,0.22)', labelColor: '#6699FF' },
  { name: 'ROSE', label: 'Rose', overlay: 'rgba(255,50,120,0.20)', labelColor: '#FF5599' },
  { name: 'FADE', label: 'Fade', overlay: 'rgba(255,255,255,0.30)', labelColor: '#ccc' },
  { name: 'DRAMA', label: 'Drama', overlay: 'rgba(0,0,0,0.28)', labelColor: '#aaa' },
  { name: 'GREEN', label: 'Nature', overlay: 'rgba(50,200,100,0.18)', labelColor: '#66CC88' },
];

const EMOJIS = [
  '😀', '😂', '😍', '🥳', '🔥', '❤️', '👏', '🙌', '💪', '⚽',
  '🏏', '🏓', '🏆', '🎉', '😎', '🤩', '😅', '👍', '💯', '✨',
  '🥇', '⭐', '😭', '🤣', '👀', '🙏', '💥', '🚀', '🎯', '☀️',
];

const CAPTION_COLORS = ['#FFFFFF', '#111111', '#FF3B30', '#FFCC00', '#34C759', '#0A84FF'];

const EXTENSION_MIME: Record<string, string> = {
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
  heic: 'image/heic',
  heif: 'image/heif',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

/** Prefer the asset's own reported mimeType; fall back to its file extension; only then a generic default. */
function inferMimeType(asset: { mimeType?: string | null; uri: string }, isVideo: boolean): string {
  if (asset.mimeType) return asset.mimeType;
  const match = /\.([a-zA-Z0-9]+)(?:\?.*)?$/.exec(asset.uri);
  const ext = match?.[1]?.toLowerCase();
  if (ext && EXTENSION_MIME[ext]) return EXTENSION_MIME[ext];
  return isVideo ? 'video/mp4' : 'image/jpeg';
}

export interface CaptureFlowPayload {
  mediaUri: string;
  mimeType: string;
  mediaType: 'IMAGE' | 'VIDEO';
  durationSeconds: number;
  filterName: string;
  caption?: string;
  captionText?: string;
  captionColor?: string;
  captionX?: number;
  captionY?: number;
  emoji?: string;
  emojiX?: number;
  emojiY?: number;
  thumbnailUri?: string;
  isBoomerang?: boolean;
  audioTrackId?: string;
  audioTrackUrl?: string;
  audioVolume?: number;
}

interface CaptureFlowProps {
  maxVideoSeconds: number;
  allowPhoto: boolean;
  requireCaption?: boolean;
  captionPlaceholder?: string;
  submitLabel?: string;
  submittingLabel?: string;
  doneLabel?: string;
  accentColors?: [string, string, ...string[]];
  /** Story-only per product spec — a bounce forward/reverse loop, processed server-side. */
  allowBoomerang?: boolean;
  /** Background music picker — available to both Reels and Stories. */
  allowMusic?: boolean;
  onSubmit: (payload: CaptureFlowPayload) => Promise<void>;
}

type FlowMode = 'CAMERA' | 'PREVIEW';
type StickerKind = 'CAPTION' | 'EMOJI' | null;

function DraggableSticker({
  initialX,
  initialY,
  onPositionChange,
  children,
  styles,
}: {
  initialX: number;
  initialY: number;
  onPositionChange: (x: number, y: number) => void;
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  const pan = useRef(new Animated.ValueXY({ x: initialX * W, y: initialY * H })).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const x = Math.min(Math.max((pan.x as any)._value / W, 0), 1);
        const y = Math.min(Math.max((pan.y as any)._value / H, 0), 1);
        onPositionChange(x, y);
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[styles.stickerWrap, { transform: pan.getTranslateTransform() }]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Preview-mode media renderer. Videos previously always rendered through
 * <Image>, which can't decode a video URI — it just showed a blank/broken
 * frame. Photos still use <Image>; only actual video captures/picks use the
 * real video player, looped and muted so the picked/recorded audio doesn't
 * fight with a background-music preview.
 */
function PreviewMedia({ uri, mediaType, muted }: { uri: string; mediaType: 'IMAGE' | 'VIDEO'; muted: boolean }) {
  if (mediaType === 'IMAGE' || !useVideoPlayer || !VideoView) {
    return <Image source={{ uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />;
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const player = useVideoPlayer({ uri }, (p: any) => {
    p.loop = true;
    p.muted = muted;
    p.play();
  });
  useEffect(() => {
    if (player) player.muted = muted;
  }, [muted, player]);
  return <VideoView player={player} style={StyleSheet.absoluteFillObject} contentFit="cover" nativeControls={false} />;
}

export function CaptureFlow({
  maxVideoSeconds,
  allowPhoto,
  requireCaption = false,
  captionPlaceholder = 'Write a caption...',
  submitLabel = 'Share',
  submittingLabel = 'Uploading…',
  doneLabel = 'Shared!',
  accentColors,
  allowBoomerang = false,
  allowMusic = false,
  onSubmit,
}: CaptureFlowProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const resolvedAccentColors = accentColors ?? ['#E91E63', '#7B1FA2', colors.primaryDark];
  const router = useRouter();
  const cameraRef = useRef<any>(null);

  const [mode, setMode] = useState<FlowMode>('CAMERA');
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturedMime, setCapturedMime] = useState<string>('image/jpeg');
  const [capturedType, setCapturedType] = useState<'IMAGE' | 'VIDEO'>('IMAGE');
  const [capturedDuration, setCapturedDuration] = useState<number>(5);
  const [thumbnailUri, setThumbnailUri] = useState<string | undefined>(undefined);

  const [selectedFilter, setSelectedFilter] = useState(CAPTURE_FILTERS[0]);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);

  // Sticker editing
  const [activeSticker, setActiveSticker] = useState<StickerKind>(null);
  const [captionText, setCaptionText] = useState('');
  const [captionColor, setCaptionColor] = useState(CAPTION_COLORS[0]);
  const [captionPos, setCaptionPos] = useState({ x: 0.5, y: 0.4 });
  const [emoji, setEmoji] = useState<string | null>(null);
  const [emojiPos, setEmojiPos] = useState({ x: 0.5, y: 0.6 });
  const [draftText, setDraftText] = useState('');

  // Boomerang (stories) — bounce forward/reverse loop, processed server-side.
  const [isBoomerang, setIsBoomerang] = useState(false);

  // Background music
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [audioTracksLoading, setAudioTracksLoading] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<AudioTrack | null>(null);
  const [previewingTrackId, setPreviewingTrackId] = useState<string | null>(null);
  const soundRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync?.().catch(() => {});
    };
  }, []);

  const stopTrackPreview = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setPreviewingTrackId(null);
  }, []);

  const toggleTrackPreview = useCallback(async (track: AudioTrack) => {
    if (!Audio) return;
    if (previewingTrackId === track.id) {
      await stopTrackPreview();
      return;
    }
    await stopTrackPreview();
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: track.url }, { shouldPlay: true, isLooping: true });
      soundRef.current = sound;
      setPreviewingTrackId(track.id);
    } catch {
      // Non-fatal — user just won't hear a preview; picking the track still works.
    }
  }, [previewingTrackId, stopTrackPreview]);

  const openMusicPicker = useCallback(async () => {
    setShowMusicPicker(true);
    if (audioTracks.length === 0 && !audioTracksLoading) {
      setAudioTracksLoading(true);
      try {
        const tracks = await audioApi.getAudioTracks();
        setAudioTracks(tracks);
      } catch {
        // Non-fatal — music is an optional extra, picker just shows empty.
      } finally {
        setAudioTracksLoading(false);
      }
    }
  }, [audioTracks.length, audioTracksLoading]);

  const closeMusicPicker = useCallback(async () => {
    await stopTrackPreview();
    setShowMusicPicker(false);
  }, [stopTrackPreview]);

  const confirmTrackSelection = useCallback(async (track: AudioTrack | null) => {
    await stopTrackPreview();
    setSelectedTrack(track);
    setShowMusicPicker(false);
  }, [stopTrackPreview]);

  // Confirmed background track keeps looping for as long as the creator sits
  // on the preview screen, so they hear the actual mix before posting — a
  // separate sound instance from the picker's own audition playback above.
  const bgSoundRef = useRef<any>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (bgSoundRef.current) {
        await bgSoundRef.current.stopAsync().catch(() => {});
        await bgSoundRef.current.unloadAsync().catch(() => {});
        bgSoundRef.current = null;
      }
      if (Audio && selectedTrack && mode === 'PREVIEW' && !uploading && !uploadDone) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri: selectedTrack.url },
            { shouldPlay: true, isLooping: true, volume: 0.85 }
          );
          if (cancelled) {
            await sound.unloadAsync().catch(() => {});
          } else {
            bgSoundRef.current = sound;
          }
        } catch {
          // Non-fatal — posting still works without the live preview mix.
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedTrack, mode, uploading, uploadDone]);

  useEffect(() => {
    return () => {
      bgSoundRef.current?.unloadAsync?.().catch(() => {});
    };
  }, []);

  const camPerm = useCameraPermissions ? useCameraPermissions() : [{ granted: false }, async () => {}];
  const micPerm = useMicrophonePermissions ? useMicrophonePermissions() : [{ granted: false }, async () => {}];
  const [cameraPermission, requestCameraPermission] = camPerm;
  const [, requestMicPermission] = micPerm;

  const recordProgress = useRef(new Animated.Value(0)).current;
  const recordAnim = useRef<Animated.CompositeAnimation | null>(null);
  // Instagram-style pulsing red ring while recording.
  const ringPulse = useRef(new Animated.Value(1)).current;
  const ringPulseAnim = useRef<Animated.CompositeAnimation | null>(null);
  // Tap-vs-hold disambiguation for the capture button — a plain onLongPress
  // gesture recognizer gets cancelled by the smallest finger movement on a
  // real device (fine with a mouse click in an emulator, unreliable on
  // actual hardware), so press state is tracked manually instead.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingStartedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (recordTimer.current) clearInterval(recordTimer.current);
    };
  }, []);

  const generateThumbnail = async (uri: string) => {
    if (!VideoThumbnails) return;
    try {
      const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(uri, { time: 0 });
      setThumbnailUri(thumbUri);
    } catch {
      // Non-fatal - the reel just won't have a poster-frame thumbnail.
    }
  };

  // ── Camera actions ──────────────────────────────────────────────────────
  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.75, base64: false });
      let uri = photo.uri;
      if (ImageManipulator) {
        const result = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 720 } }],
          { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG }
        );
        uri = result.uri;
      }
      setCapturedUri(uri);
      setCapturedMime('image/jpeg');
      setCapturedType('IMAGE');
      setCapturedDuration(5);
      setThumbnailUri(undefined);
      setMode('PREVIEW');
    } catch {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current || isRecording) return;
    recordingStartedRef.current = true;
    setIsRecording(true);
    setRecordSeconds(0);
    recordProgress.setValue(0);

    recordAnim.current = Animated.timing(recordProgress, {
      toValue: 1,
      duration: maxVideoSeconds * 1000,
      useNativeDriver: false,
    });
    recordAnim.current.start(({ finished }) => {
      if (finished) stopRecording();
    });

    ringPulse.setValue(1);
    ringPulseAnim.current = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, { toValue: 1.12, duration: 500, useNativeDriver: true }),
        Animated.timing(ringPulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    ringPulseAnim.current.start();

    recordTimer.current = setInterval(() => {
      setRecordSeconds((s) => {
        if (s + 1 >= maxVideoSeconds) stopRecording();
        return s + 1;
      });
    }, 1000);

    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: maxVideoSeconds,
        quality: '720p',
      });
      const durationSec = Math.min(maxVideoSeconds, recordSeconds + 1);
      setCapturedUri(video.uri);
      setCapturedMime('video/mp4');
      setCapturedType('VIDEO');
      setCapturedDuration(durationSec);
      setMode('PREVIEW');
      generateThumbnail(video.uri);
    } catch {
      setIsRecording(false);
    } finally {
      recordingStartedRef.current = false;
    }
  };

  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    setIsRecording(false);
    if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
    if (recordAnim.current) recordAnim.current.stop();
    if (ringPulseAnim.current) { ringPulseAnim.current.stop(); ringPulseAnim.current = null; }
    ringPulse.setValue(1);
    cameraRef.current?.stopRecording?.();
  }, [isRecording]);

  // ── Capture button press handling (tap = photo, hold = video) ────────────
  const handleCapturePressIn = () => {
    if (isRecording) return;
    if (!allowPhoto) {
      // Reels have no photo mode — hold isn't even required, start immediately.
      startRecording();
      return;
    }
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      startRecording();
    }, 350);
  };

  const handleCapturePressOut = () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    if (holdTimer.current) {
      // Released before the hold threshold fired — treat as a tap (photo).
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      if (allowPhoto) takePicture();
    }
    // If holdTimer is already null here, startRecording() already fired (or
    // is in flight) from handleCapturePressIn — recordAsync's own await will
    // resolve once stopRecording (triggered above, next press) completes it.
  };

  // ── Gallery picker ────────────────────────────────────────────────────────
  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow media library access to pick photos/videos');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: allowPhoto ? ['images', 'videos'] : ['videos'],
        allowsEditing: false,
        quality: 0.8,
        videoMaxDuration: maxVideoSeconds,
        exif: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      let uri = asset.uri;
      const isVid = asset.type === 'video';
      if (!isVid && ImageManipulator) {
        const c = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 720 } }],
          { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG }
        );
        uri = c.uri;
      }
      setCapturedUri(uri);
      // Picked files aren't always mp4/jpeg (a .mov from an iPhone, a .heic
      // photo, etc.) — trust the asset's own reported mimeType first, since
      // mislabeling it here doesn't fail the upload but does break later
      // playback/decoding of whatever actually got uploaded.
      setCapturedMime(inferMimeType(asset, isVid));
      setCapturedType(isVid ? 'VIDEO' : 'IMAGE');
      setCapturedDuration(isVid && asset.duration ? Math.min(Math.ceil(asset.duration / 1000), maxVideoSeconds) : 5);
      setThumbnailUri(undefined);
      setMode('PREVIEW');
      if (isVid) generateThumbnail(uri);
    } catch {
      Alert.alert('Error', 'Failed to pick media');
    }
  };

  // ── Sticker helpers ───────────────────────────────────────────────────────
  const openTextEditor = () => {
    setDraftText(captionText);
    setActiveSticker('CAPTION');
  };
  const confirmCaptionText = () => {
    setCaptionText(draftText.trim());
    setActiveSticker(null);
  };
  const pickEmoji = (e: string) => {
    setEmoji(e);
    setActiveSticker(null);
  };
  const removeCaptionText = () => setCaptionText('');
  const removeEmoji = () => setEmoji(null);

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!capturedUri || uploading) return;
    if (requireCaption && !caption.trim()) {
      Alert.alert('Add a caption', 'Please describe your reel before posting.');
      return;
    }
    setUploading(true);
    await stopTrackPreview();
    try {
      await onSubmit({
        mediaUri: capturedUri,
        mimeType: capturedMime,
        mediaType: capturedType,
        durationSeconds: capturedDuration,
        filterName: selectedFilter.name,
        caption: caption.trim() || undefined,
        captionText: captionText || undefined,
        captionColor: captionText ? captionColor : undefined,
        captionX: captionText ? captionPos.x : undefined,
        captionY: captionText ? captionPos.y : undefined,
        emoji: emoji || undefined,
        emojiX: emoji ? emojiPos.x : undefined,
        emojiY: emoji ? emojiPos.y : undefined,
        thumbnailUri,
        isBoomerang: allowBoomerang && capturedType === 'VIDEO' ? isBoomerang : undefined,
        audioTrackId: selectedTrack?.id,
        audioTrackUrl: selectedTrack?.url,
        audioVolume: selectedTrack ? 0.85 : undefined,
      });
      setUploadDone(true);
      setTimeout(() => router.back(), 1200);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Please try again');
    } finally {
      setUploading(false);
    }
  };

  // ── Permission gates ──────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.webFallback}>
          <Camera color={colors.neutral500} size={48} strokeWidth={1.2} />
          <Text style={styles.webFallbackTitle}>Camera unavailable on web</Text>
          <Text style={styles.webFallbackSub}>Use the iOS or Android app to create this</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!CameraView) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!cameraPermission?.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.permWrap}>
          <Camera color={colors.primary} size={56} strokeWidth={1.2} />
          <Text style={styles.permTitle}>Camera Access Needed</Text>
          <Text style={styles.permSub}>We need camera permission to let you create this</Text>
          <TouchableOpacity
            style={styles.permBtn}
            onPress={async () => {
              await requestCameraPermission();
              await requestMicPermission();
            }}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.permBtnGrad}>
              <Text style={styles.permBtnText}>Allow Camera</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 14 }}>
            <Text style={[styles.permSub, { textDecorationLine: 'underline' }]}>Not now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Preview mode ──────────────────────────────────────────────────────────
  if (mode === 'PREVIEW' && capturedUri) {
    return (
      <View style={styles.previewContainer}>
        <StatusBar hidden />
        <PreviewMedia uri={capturedUri} mediaType={capturedType} muted={!!selectedTrack} />
        {selectedFilter.overlay && (
          <View
            style={[StyleSheet.absoluteFillObject, { backgroundColor: selectedFilter.overlay }]}
            pointerEvents="none"
          />
        )}
        <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={styles.previewTopGrad} pointerEvents="none" />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={styles.previewBottomGrad} pointerEvents="none" />

        {/* Draggable stickers */}
        {!!captionText && (
          <DraggableSticker
            initialX={captionPos.x}
            initialY={captionPos.y}
            onPositionChange={(x, y) => setCaptionPos({ x, y })}
            styles={styles}
          >
            <Pressable onLongPress={removeCaptionText}>
              <Text style={[styles.stickerCaptionText, { color: captionColor }]}>{captionText}</Text>
            </Pressable>
          </DraggableSticker>
        )}
        {!!emoji && (
          <DraggableSticker
            initialX={emojiPos.x}
            initialY={emojiPos.y}
            onPositionChange={(x, y) => setEmojiPos({ x, y })}
            styles={styles}
          >
            <Pressable onLongPress={removeEmoji}>
              <Text style={styles.stickerEmoji}>{emoji}</Text>
            </Pressable>
          </DraggableSticker>
        )}

        {/* Top row */}
        <SafeAreaView style={styles.previewTop} edges={['top']}>
          <TouchableOpacity style={styles.previewBackBtn} onPress={() => setMode('CAMERA')} activeOpacity={0.8}>
            <ArrowLeft color="#fff" size={22} strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.previewTopRight}>
            {capturedType === 'VIDEO' && (
              <View style={styles.videoBadge}>
                <Video color="#fff" size={12} strokeWidth={2.5} fill="#fff" />
                <Text style={styles.videoBadgeText}>{capturedDuration}s</Text>
              </View>
            )}
            {allowBoomerang && capturedType === 'VIDEO' && (
              <TouchableOpacity
                style={[styles.previewToolBtn, isBoomerang && styles.previewToolBtnActive]}
                onPress={() => setIsBoomerang((b) => !b)}
                activeOpacity={0.8}
              >
                <RefreshCw color={isBoomerang ? '#000' : '#fff'} size={18} strokeWidth={2.5} />
              </TouchableOpacity>
            )}
            {allowMusic && (
              <TouchableOpacity
                style={[styles.previewToolBtn, !!selectedTrack && styles.previewToolBtnActive]}
                onPress={openMusicPicker}
                activeOpacity={0.8}
              >
                <Music color={selectedTrack ? '#000' : '#fff'} size={18} strokeWidth={2.5} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.previewToolBtn} onPress={openTextEditor} activeOpacity={0.8}>
              <TypeIcon color="#fff" size={18} strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.previewToolBtn} onPress={() => setActiveSticker('EMOJI')} activeOpacity={0.8}>
              <Smile color="#fff" size={18} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {isBoomerang && (
          <View style={styles.boomerangBadge} pointerEvents="none">
            <RefreshCw color="#000" size={12} strokeWidth={2.5} />
            <Text style={styles.boomerangBadgeText}>Boomerang</Text>
          </View>
        )}

        {!!selectedTrack && (
          <TouchableOpacity style={styles.musicBadge} onPress={openMusicPicker} activeOpacity={0.85}>
            <Music color="#fff" size={12} strokeWidth={2.5} />
            <Text style={styles.musicBadgeText} numberOfLines={1}>{selectedTrack.title} · {selectedTrack.artist}</Text>
          </TouchableOpacity>
        )}

        {/* Filter row */}
        <View style={styles.filtersWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
            {CAPTURE_FILTERS.map((f) => {
              const active = selectedFilter.name === f.name;
              return (
                <TouchableOpacity key={f.name} style={styles.filterItem} onPress={() => setSelectedFilter(f)} activeOpacity={0.8}>
                  <View style={[styles.filterSwatch, { backgroundColor: f.overlay ?? '#555', borderColor: active ? '#fff' : 'rgba(255,255,255,0.3)' }]}>
                    {f.overlay === null && <Text style={{ color: '#fff', fontSize: 11 }}>✓</Text>}
                  </View>
                  <Text style={[styles.filterLabel, { color: active ? f.labelColor : 'rgba(255,255,255,0.55)' }]}>{f.label}</Text>
                  {active && <View style={styles.filterActiveDot} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Bottom: optional caption input + share */}
        <SafeAreaView style={styles.previewBottom} edges={['bottom']}>
          {requireCaption && (
            <TextInput
              style={styles.captionInput}
              placeholder={captionPlaceholder}
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={caption}
              onChangeText={setCaption}
              maxLength={280}
              multiline
            />
          )}
          <TouchableOpacity style={styles.shareBtn} onPress={handleSubmit} disabled={uploading || uploadDone} activeOpacity={0.88}>
            {uploadDone ? (
              <View style={styles.shareBtnInner}>
                <CheckCircle color="#fff" size={22} strokeWidth={2.5} />
                <Text style={styles.shareBtnText}>{doneLabel}</Text>
              </View>
            ) : uploading ? (
              <View style={styles.shareBtnInner}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.shareBtnText}>{submittingLabel}</Text>
              </View>
            ) : (
              <LinearGradient colors={resolvedAccentColors} style={styles.shareBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Zap color="#fff" size={18} strokeWidth={2.5} fill="#fff" />
                <Text style={styles.shareBtnText}>{submitLabel}</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </SafeAreaView>

        {/* Text-sticker editor */}
        {activeSticker === 'CAPTION' && (
          <View style={styles.editorOverlay}>
            <SafeAreaView style={styles.editorSafe} edges={['top', 'bottom']}>
              <View style={styles.editorHeader}>
                <TouchableOpacity onPress={() => setActiveSticker(null)}>
                  <X color="#fff" size={22} strokeWidth={2.5} />
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmCaptionText}>
                  <Text style={styles.editorDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.editorTextInput, { color: captionColor }]}
                placeholder="Type something..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={draftText}
                onChangeText={setDraftText}
                autoFocus
                multiline
                maxLength={60}
              />
              <View style={styles.colorRow}>
                {CAPTION_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorSwatch, { backgroundColor: c }, captionColor === c && styles.colorSwatchActive]}
                    onPress={() => setCaptionColor(c)}
                  />
                ))}
              </View>
            </SafeAreaView>
          </View>
        )}

        {/* Emoji sticker picker */}
        {activeSticker === 'EMOJI' && (
          <View style={styles.editorOverlay}>
            <SafeAreaView style={styles.editorSafe} edges={['top', 'bottom']}>
              <View style={styles.editorHeader}>
                <Text style={styles.editorTitle}>Add an emoji</Text>
                <TouchableOpacity onPress={() => setActiveSticker(null)}>
                  <X color="#fff" size={22} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
              <View style={styles.emojiGrid}>
                {EMOJIS.map((e) => (
                  <TouchableOpacity key={e} style={styles.emojiCell} onPress={() => pickEmoji(e)}>
                    <Text style={styles.emojiCellText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </SafeAreaView>
          </View>
        )}

        {/* Background-music picker */}
        {showMusicPicker && (
          <View style={styles.editorOverlay}>
            <SafeAreaView style={styles.editorSafe} edges={['top', 'bottom']}>
              <View style={styles.editorHeader}>
                <Text style={styles.editorTitle}>Add music</Text>
                <TouchableOpacity onPress={closeMusicPicker}>
                  <X color="#fff" size={22} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
              <View style={styles.trackListWrap}>
                {audioTracksLoading ? (
                  <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />
                ) : audioTracks.length === 0 ? (
                  <Text style={styles.trackEmptyText}>No tracks available right now.</Text>
                ) : (
                  <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
                    <TouchableOpacity style={styles.trackRow} onPress={() => confirmTrackSelection(null)} activeOpacity={0.8}>
                      <View style={styles.trackPlayBtn}>
                        <X color="#fff" size={16} strokeWidth={2.5} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.trackTitle}>No music</Text>
                        <Text style={styles.trackArtist}>Use your recorded audio only</Text>
                      </View>
                      {!selectedTrack && <CheckCircle color={colors.primaryAccent ?? '#fff'} size={20} strokeWidth={2.5} />}
                    </TouchableOpacity>
                    {audioTracks.map((track) => {
                      const isPreviewing = previewingTrackId === track.id;
                      const isSelected = selectedTrack?.id === track.id;
                      return (
                        <TouchableOpacity
                          key={track.id}
                          style={styles.trackRow}
                          onPress={() => confirmTrackSelection(track)}
                          activeOpacity={0.8}
                        >
                          <TouchableOpacity
                            style={[styles.trackPlayBtn, isPreviewing && styles.trackPlayBtnActive]}
                            onPress={() => toggleTrackPreview(track)}
                            hitSlop={8}
                          >
                            {isPreviewing ? (
                              <Pause color="#fff" size={16} strokeWidth={2.5} fill="#fff" />
                            ) : (
                              <Play color="#fff" size={16} strokeWidth={2.5} fill="#fff" />
                            )}
                          </TouchableOpacity>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                            <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                          </View>
                          {isSelected && <CheckCircle color={colors.primaryAccent ?? '#fff'} size={20} strokeWidth={2.5} />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            </SafeAreaView>
          </View>
        )}
      </View>
    );
  }

  // ── Camera mode ───────────────────────────────────────────────────────────
  return (
    <View style={styles.cameraContainer}>
      <StatusBar hidden />
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing={facing}
        mode={isRecording ? 'video' : 'picture'}
        videoQuality="720p"
        enableTorch={false}
      />

      <SafeAreaView style={styles.camTopBar} edges={['top']}>
        <TouchableOpacity style={styles.camIconBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <X color="#fff" size={24} strokeWidth={2.5} />
        </TouchableOpacity>
        {isRecording && (
          <View style={styles.recordInfo}>
            <View style={styles.recDot} />
            <Text style={styles.recTimer}>{recordSeconds}s / {maxVideoSeconds}s</Text>
            <Animated.View
              style={[
                styles.recProgressTrack,
                { width: recordProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]}
            />
          </View>
        )}
        <TouchableOpacity
          style={styles.camIconBtn}
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          activeOpacity={0.8}
        >
          <FlipHorizontal color="#fff" size={22} strokeWidth={2} />
        </TouchableOpacity>
      </SafeAreaView>

      <SafeAreaView style={styles.camBottomBar} edges={['bottom']}>
        <TouchableOpacity style={styles.sideBtn} onPress={pickFromGallery} activeOpacity={0.8}>
          <ImageIcon color="#fff" size={26} strokeWidth={1.8} />
          <Text style={styles.sideBtnLabel}>Gallery</Text>
        </TouchableOpacity>

        <View style={styles.captureWrap}>
          <Pressable onPressIn={handleCapturePressIn} onPressOut={handleCapturePressOut}>
            <Animated.View
              style={[
                styles.captureOuter,
                isRecording && styles.captureOuterRecording,
                { transform: [{ scale: ringPulse }] },
              ]}
            >
              <View style={[styles.captureInner, isRecording && styles.captureRecording]}>
                {isRecording && <View style={styles.captureStopSquare} />}
              </View>
            </Animated.View>
          </Pressable>
          <Text style={styles.captureHint}>
            {isRecording ? 'Tap to stop' : allowPhoto ? 'Tap photo · Hold video' : 'Hold to record'}
          </Text>
        </View>

        <View style={styles.sideBtn} />
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },

  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  camIconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  camBottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 28, paddingBottom: 24, paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sideBtn: { width: 60, alignItems: 'center', gap: 4 },
  sideBtnLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '600' },

  captureWrap: { alignItems: 'center', gap: 8 },
  captureOuter: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  captureOuterRecording: { borderColor: '#FF3B3B' },
  captureInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
  captureRecording: { backgroundColor: '#FF3B3B' },
  captureStopSquare: { width: 22, height: 22, borderRadius: 4, backgroundColor: '#fff' },
  captureHint: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500' },

  recordInfo: {
    flex: 1, marginHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 6, overflow: 'hidden',
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B3B' },
  recTimer: { color: '#fff', fontSize: 12, fontWeight: '700' },
  recProgressTrack: { height: 2, backgroundColor: '#FF3B3B', borderRadius: 1, position: 'absolute', bottom: 0, left: 0 },

  previewContainer: { flex: 1, backgroundColor: '#000' },
  previewTopGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  previewBottomGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 260 },
  previewTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 4,
  },
  previewBackBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  previewTopRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewToolBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  previewToolBtnActive: { backgroundColor: '#fff' },
  videoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  videoBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  boomerangBadge: {
    position: 'absolute', top: 64, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  boomerangBadgeText: { color: '#000', fontSize: 11, fontWeight: '800' },
  musicBadge: {
    position: 'absolute', top: 100, alignSelf: 'center', maxWidth: W - 80,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  musicBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  trackListWrap: { flex: 1, marginTop: 90, paddingHorizontal: 4 },
  trackEmptyText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginTop: 40 },
  trackRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  trackPlayBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  trackPlayBtnActive: { backgroundColor: colors.primary },
  trackTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  trackArtist: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },

  filtersWrap: { position: 'absolute', bottom: 100, left: 0, right: 0 },
  filtersScroll: { paddingHorizontal: 16, gap: 12 },
  filterItem: { alignItems: 'center', gap: 5, position: 'relative' },
  filterSwatch: { width: 46, height: 46, borderRadius: 23, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  filterLabel: { fontSize: 10, fontWeight: '700' },
  filterActiveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff', position: 'absolute', bottom: -2 },

  previewBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingBottom: 16, gap: 10 },
  captionInput: {
    color: '#fff', fontSize: 14, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 80,
  },
  shareBtn: { borderRadius: 28, overflow: 'hidden' },
  shareBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  shareBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16,
    backgroundColor: colors.success, borderRadius: 28,
  },
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  stickerWrap: { position: 'absolute' },
  stickerCaptionText: {
    fontSize: 22, fontWeight: '800', textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  stickerEmoji: { fontSize: 44 },

  editorOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)' },
  editorSafe: { flex: 1, paddingHorizontal: 20, justifyContent: 'center' },
  editorHeader: {
    position: 'absolute', top: Platform.OS === 'ios' ? 54 : 24, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  editorTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  editorDoneText: { color: colors.primaryAccent ?? '#fff', fontSize: 16, fontWeight: '800' },
  editorTextInput: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  colorRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 24 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchActive: { borderColor: '#fff' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 60 },
  emojiCell: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  emojiCellText: { fontSize: 30 },

  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  permTitle: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center' },
  permSub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20 },
  permBtn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  permBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  permBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  webFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  webFallbackTitle: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  webFallbackSub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  backBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  backBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
