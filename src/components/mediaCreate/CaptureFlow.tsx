import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Animated,
  Dimensions,
  Easing,
  Image,
  Keyboard,
  LayoutAnimation,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  Download,
  MapPin,
  Sparkles,
  Trash2,
  FlipHorizontal,
  Image as ImageIcon,
  Music,
  Pause,
  Play,
  RefreshCw,
  Smile,
  Type as TypeIcon,
  UserPlus,
  Video,
  Volume2,
  VolumeX,
  X,
  Zap,
  ZapOff,
  Settings2,
  MicOff,
} from 'lucide-react-native';
import { ThemeColors } from '../../styles/colors';
import { useTheme } from '../../context/ThemeContext';
import { audioApi, AudioTrack } from '../../api/audioApi';
import { goBack } from '../../utils/navigation';
import { prepareImageForUpload, prepareStoryImage } from '../../utils/mediaCompression';
import { saveMediaToDevice } from '../../utils/saveMedia';
import { useStoryFonts } from '../story/storyFonts';
import { StoryCaption, CaptionStyleKey } from '../story/captionStyles';
import { CaptionEditor, CaptionValue } from '../story/CaptionEditor';
import { StickerSheet } from '../story/StickerSheet';
import { LocationSheet } from '../story/LocationSheet';
import { EffectsSheet } from '../story/EffectsSheet';
import { GradeStrip } from '../story/GradeStrip';
import { GradeLayers, GRADES_SUPPORTED } from '../story/grades';
import { StoryEffectLayer } from '../story/effects';
import { LocationSticker } from '../story/LocationSticker';
import type { StoryPlace } from '../../api/placeApi';
import Svg, { Circle } from 'react-native-svg';
import { TagPeopleSheet, TaggedPerson } from '../TagPeopleSheet';
import { StorySettingsSheet } from '../story/StorySettingsSheet';

const MIC_PROMPT_OFF_KEY = 'paasxo.capture.micPromptOff';
/** Boomerang captures are short bursts (the server bounces the first few seconds). */
const BOOMERANG_CAPTURE_SECONDS = 3;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Platform-safe camera / native-module imports
let CameraView: any = null;
let useCameraPermissions: any = null;
let useMicrophonePermissions: any = null;
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
  /** Firebase uids of tagged people (only when allowTags). */
  taggedUserIds?: string[];
  // Story-only decorations (storyMode).
  captionStyle?: string;
  captionScale?: number;
  locationName?: string;
  locationPlaceId?: string;
  locationLat?: number;
  locationLng?: number;
  locationX?: number;
  locationY?: number;
  effect?: string;
  /** Video posted with its sound turned off. */
  soundOff?: boolean;
}

interface CaptureFlowProps {
  maxVideoSeconds: number;
  allowPhoto: boolean;
  /** Shows the caption text box at all. Independent of requireCaption below. */
  allowCaption?: boolean;
  /** Only meaningful when allowCaption is true — blocks submit until non-empty. */
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
  /** "Tag people" — search Paasxo players and tag them (stories). */
  allowTags?: boolean;
  /** Stories: caption styles, colour grades, location, effects, save-to-device, full-screen photo crop. */
  storyMode?: boolean;
  onSubmit: (payload: CaptureFlowPayload) => Promise<void>;
}

type FlowMode = 'CAMERA' | 'PREVIEW';
type StickerKind = 'CAPTION' | 'EMOJI' | null;

// Below this many px of finger movement, a touch is a tap (edit) not a drag.
const STICKER_DRAG_THRESHOLD = 6;
// Drop a sticker on the bin at the bottom centre to remove it.
const TRASH_Y = 0.86;
const TRASH_HALF_W = 0.14;
const inTrash = (x: number, y: number) => y >= TRASH_Y && Math.abs(x - 0.5) <= TRASH_HALF_W;

// Recording progress ring drawn just outside the 80px capture button.
const RING_SIZE = 92;
const RING_R = 43;
const RING_C = 2 * Math.PI * RING_R;

function DraggableSticker({
  initialX,
  initialY,
  onPositionChange,
  onRemove,
  onTap,
  onDragChange,
  children,
  styles,
}: {
  initialX: number;
  initialY: number;
  onPositionChange: (x: number, y: number) => void;
  onRemove: () => void;
  onTap?: () => void;
  /** dragging / hovering over the bin — drives the bin UI in the parent. */
  onDragChange?: (dragging: boolean, overTrash: boolean) => void;
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  // `pan` is the sticker's CENTRE (stored normalised) — viewers draw it centred
  // on the same point, so what you place is what people see.
  const pan = useRef(new Animated.ValueXY({ x: initialX * W, y: initialY * H })).current;
  const scale = useRef(new Animated.Value(1)).current;
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  // One responder handles drag AND tap (a nested Pressable would steal the
  // touch and the sticker could never be dragged). Callbacks via refs so the
  // responder created once always calls the latest ones.
  const cb = useRef({ onPositionChange, onRemove, onTap, onDragChange });
  cb.current = { onPositionChange, onRemove, onTap, onDragChange };
  const moved = useRef(false);
  const overTrash = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        moved.current = false;
        overTrash.current = false;
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (evt, g) => {
        if (!moved.current && (Math.abs(g.dx) > STICKER_DRAG_THRESHOLD || Math.abs(g.dy) > STICKER_DRAG_THRESHOLD)) {
          moved.current = true;
          cb.current.onDragChange?.(true, false);
        }
        if (!moved.current) return;
        pan.setValue({ x: g.dx, y: g.dy });
        const over = inTrash(g.moveX / W, g.moveY / H);
        if (over !== overTrash.current) {
          overTrash.current = over;
          cb.current.onDragChange?.(true, over);
          Animated.spring(scale, { toValue: over ? 0.55 : 1, useNativeDriver: false, speed: 30 }).start();
        }
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        if (!moved.current) {
          cb.current.onTap?.();
          return;
        }
        cb.current.onDragChange?.(false, false);
        if (overTrash.current) {
          cb.current.onRemove();
          return;
        }
        const x = Math.min(Math.max((pan.x as any)._value / W, 0.02), 0.98);
        const y = Math.min(Math.max((pan.y as any)._value / H, 0.04), 0.96);
        pan.setValue({ x: x * W, y: y * H });
        cb.current.onPositionChange(x, y);
      },
      onPanResponderTerminate: () => {
        pan.flattenOffset();
        if (moved.current) cb.current.onDragChange?.(false, false);
        scale.setValue(1);
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (!size || Math.abs(size.w - width) > 0.5 || Math.abs(size.h - height) > 0.5) setSize({ w: width, h: height });
      }}
      style={[
        styles.stickerWrap,
        {
          left: -(size?.w ?? 0) / 2, top: -(size?.h ?? 0) / 2, opacity: size ? 1 : 0,
          transform: [...pan.getTranslateTransform(), { scale }],
        },
      ]}
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
  return <LoopingPreviewVideo uri={uri} muted={muted} />;
}

/** The recorded/picked clip, replaying on a loop until you post or retake. */
function LoopingPreviewVideo({ uri, muted }: { uri: string; muted: boolean }) {
  const player = useVideoPlayer({ uri }, (p: any) => {
    p.loop = true;
    p.muted = muted;
    p.play();
  });
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);
  return <VideoView player={player} style={StyleSheet.absoluteFillObject} contentFit="cover" nativeControls={false} />;
}

export function CaptureFlow({
  maxVideoSeconds,
  allowPhoto,
  allowCaption = false,
  requireCaption = false,
  captionPlaceholder = 'Write a caption...',
  submitLabel = 'Share',
  submittingLabel = 'Uploading…',
  doneLabel = 'Shared!',
  accentColors,
  allowBoomerang = false,
  allowMusic = false,
  allowTags = false,
  storyMode = false,
  onSubmit,
}: CaptureFlowProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  // Paasxo brand blues by default (court-line cyan → brand blue → deep navy).
  const resolvedAccentColors = accentColors ?? ['#22D3EE', '#2977C2', '#1E3A8A'];
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

  // The caption input + share button sit in an absolutely-positioned bottom
  // bar (not a scroll view), so without this the keyboard just covers them
  // once the caption field is focused, with no way to reach "Post" — this
  // lifts that bar by the keyboard's own height whenever it's open.
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardOffset(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardOffset(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Sticker editing
  const [activeSticker, setActiveSticker] = useState<StickerKind>(null);
  const [captionText, setCaptionText] = useState('');
  const [captionColor, setCaptionColor] = useState('#FFFFFF');
  const [captionPos, setCaptionPos] = useState({ x: 0.5, y: 0.4 });
  const [emoji, setEmoji] = useState<string | null>(null);
  const [emojiPos, setEmojiPos] = useState({ x: 0.5, y: 0.6 });
  const [captionStyle, setCaptionStyle] = useState<CaptionStyleKey>('CLASSIC');
  const [captionScale, setCaptionScale] = useState(1);
  const fontsReady = useStoryFonts();

  // Story decorations
  const [gradeKey, setGradeKey] = useState('NORMAL');
  const [effect, setEffect] = useState<string | null>(null);
  const [place, setPlace] = useState<StoryPlace | null>(null);
  const [placePos, setPlacePos] = useState({ x: 0.5, y: 0.66 });
  const [sheet, setSheet] = useState<null | 'LOCATION' | 'EFFECTS'>(null);
  const [drag, setDrag] = useState<{ dragging: boolean; overTrash: boolean }>({ dragging: false, overTrash: false });
  const onDragChange = useCallback((dragging: boolean, overTrash: boolean) => setDrag({ dragging, overTrash }), []);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // Tagged people (stories).
  const [taggedPeople, setTaggedPeople] = useState<TaggedPerson[]>([]);
  const [tagSheetVisible, setTagSheetVisible] = useState(false);

  // Boomerang (stories) — bounce forward/reverse loop, processed server-side.
  const [isBoomerang, setIsBoomerang] = useState(false);
  // Boomerang chosen on the camera before capturing (tap = a short bounce).
  const [boomerangMode, setBoomerangMode] = useState(false);
  // Flashlight (torch) for the back camera — on before a photo or recording.
  const [flashOn, setFlashOn] = useState(false);
  // Video sound on/off for the post.
  const [soundOff, setSoundOff] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Microphone off: ask once per session what to do (settings / no sound),
  // unless "don't show again" was chosen.
  const [micSheet, setMicSheet] = useState(false);
  const [micDontShow, setMicDontShow] = useState(false);
  const micPromptOff = useRef(false);
  const recordWithoutSound = useRef(false);
  useEffect(() => {
    AsyncStorage.getItem(MIC_PROMPT_OFF_KEY).then((v) => { micPromptOff.current = v === '1'; }).catch(() => {});
  }, []);

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
  const micPerm = useMicrophonePermissions ? useMicrophonePermissions() : [{ granted: false }, async () => ({ granted: false }), async () => ({ granted: false })];
  const [cameraPermission, requestCameraPermission] = camPerm;
  const [micPermission, requestMicPermission, getMicPermission] = micPerm;
  const micGranted = !!micPermission?.granted;
  // Back from Settings with the microphone switched on → record with sound again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') getMicPermission?.().catch?.(() => {});
    });
    return () => sub.remove();
  }, [getMicPermission]);
  const recordLimitSeconds = boomerangMode ? Math.min(BOOMERANG_CAPTURE_SECONDS, maxVideoSeconds) : maxVideoSeconds;

  // expo-camera: on iOS one 'video'-mode session can take photos AND record,
  // so it stays in video mode (instant hold-to-record). On Android picture
  // and video are separate camera bindings — it sits in picture mode and only
  // switches for a recording, waiting for the camera to re-bind first.
  const canStayInVideoMode = Platform.OS === 'ios' || !allowPhoto;
  const [cameraMode, setCameraMode] = useState<'picture' | 'video'>(canStayInVideoMode ? 'video' : 'picture');
  const cameraReadyWaiter = useRef<(() => void) | null>(null);
  const handleCameraReady = useCallback(() => {
    cameraReadyWaiter.current?.();
  }, []);
  const waitForCameraReady = (timeoutMs: number) => new Promise<void>((resolve) => {
    const t = setTimeout(() => { cameraReadyWaiter.current = null; resolve(); }, timeoutMs);
    cameraReadyWaiter.current = () => { clearTimeout(t); cameraReadyWaiter.current = null; resolve(); };
  });

  const recordProgress = useRef(new Animated.Value(0)).current;
  const recordAnim = useRef<Animated.CompositeAnimation | null>(null);
  // Instagram-style pulsing ring while recording.
  const ringPulse = useRef(new Animated.Value(1)).current;
  const ringPulseAnim = useRef<Animated.CompositeAnimation | null>(null);
  // Tap-vs-hold disambiguation for the capture button — a plain onLongPress
  // gesture recognizer gets cancelled by the smallest finger movement on a
  // real device, so press state is tracked manually instead.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs, not state: the press handlers, the max-length timer and the
  // in-flight recordAsync all need the live values, never a stale render's.
  const recordingBusy = useRef(false);   // a hold is being handled (setup → recording → saved)
  const recorderActive = useRef(false);  // recordAsync is running and can be stopped
  const stopRequested = useRef(false);   // finger lifted (or limit hit)
  const recordStartedAt = useRef(0);
  const takingPhoto = useRef(false);
  const unmounted = useRef(false);

  useEffect(() => {
    return () => {
      unmounted.current = true;
      if (recordTimer.current) clearInterval(recordTimer.current);
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (recorderActive.current) cameraRef.current?.stopRecording?.();
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
    if (!cameraRef.current || takingPhoto.current || recordingBusy.current) return;
    takingPhoto.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, base64: false, shutterSound: false });
      if (!photo?.uri) throw new Error('No photo');
      const prepared = storyMode
        ? await prepareStoryImage(photo.uri, photo.width, photo.height, W / H)
        : await prepareImageForUpload(photo.uri, photo.width, photo.height);
      if (unmounted.current) return;
      setCapturedUri(prepared.uri);
      setCapturedMime('image/jpeg');
      setCapturedType('IMAGE');
      setCapturedDuration(5);
      setThumbnailUri(undefined);
      setMode('PREVIEW');
    } catch {
      Alert.alert('Couldn’t take the photo', 'Please try again.');
    } finally {
      takingPhoto.current = false;
    }
  };

  const stopRecordingUi = () => {
    if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
    recordAnim.current?.stop();
    if (ringPulseAnim.current) { ringPulseAnim.current.stop(); ringPulseAnim.current = null; }
    ringPulse.setValue(1);
    recordProgress.setValue(0);
    setIsRecording(false);
  };

  /** Finger lifted / time limit reached. Safe to call at any point of a hold. */
  const stopRecording = useCallback(() => {
    stopRequested.current = true;
    if (recorderActive.current) {
      cameraRef.current?.stopRecording?.();
      // A stop that lands before the native recorder has actually started is
      // ignored by the camera — repeat it once so a quick release still ends.
      setTimeout(() => { if (recorderActive.current) cameraRef.current?.stopRecording?.(); }, 500);
    }
    // Otherwise startRecording is still setting up and will see stopRequested.
  }, []);

  const startRecording = async () => {
    if (!cameraRef.current || recordingBusy.current || takingPhoto.current) return;
    recordingBusy.current = true;
    stopRequested.current = false;
    let switchedMode = false;
    try {
      // Microphone: the system asks the first time you hold (that dialog takes
      // the touch, so the hold ends there). If it's off, we ask what to do —
      // Settings, or record without sound — instead of a dead-end warning.
      // The choice holds for the session; "don't show again" silences it.
      // (A boomerang is silent anyway — never ask about the microphone for one.)
      if (!micGranted && !recordWithoutSound.current && !boomerangMode) {
        if (micPermission?.canAskAgain !== false) {
          const res: any = await requestMicPermission();
          if (res?.granted) return; // next hold records with sound
          if (res?.canAskAgain !== false) return; // dismissed — ask again next time
        }
        if (!micPromptOff.current) {
          setMicDontShow(false);
          setMicSheet(true);
          return;
        }
        recordWithoutSound.current = true;
      }
      if (stopRequested.current && !boomerangMode) return;

      if (cameraMode !== 'video') {
        const ready = waitForCameraReady(1500);
        setCameraMode('video');
        switchedMode = true;
        await ready;
        if (stopRequested.current || unmounted.current) return;
      }

      setIsRecording(true);
      setRecordSeconds(0);
      recordProgress.setValue(0);
      recordAnim.current = Animated.timing(recordProgress, {
        toValue: 1,
        duration: recordLimitSeconds * 1000,
        easing: Easing.linear,
        useNativeDriver: false,
      });
      recordAnim.current.start(({ finished }) => { if (finished) stopRecording(); });
      ringPulse.setValue(1);
      ringPulseAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(ringPulse, { toValue: 1.1, duration: 500, useNativeDriver: true }),
          Animated.timing(ringPulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      );
      ringPulseAnim.current.start();
      recordStartedAt.current = Date.now();
      recordTimer.current = setInterval(() => {
        setRecordSeconds(Math.min(recordLimitSeconds, Math.floor((Date.now() - recordStartedAt.current) / 1000)));
      }, 250);

      recorderActive.current = true;
      // H.264 at a bounded bitrate: the server can then store the clip as-is
      // (lossless remux) instead of re-encoding it.
      const recording = cameraRef.current.recordAsync(
        Platform.OS === 'ios' ? { maxDuration: recordLimitSeconds, codec: 'avc1' } : { maxDuration: recordLimitSeconds },
      );
      // Released in the instant between setup and the recorder starting
      // (a boomerang always runs its full short burst).
      if (stopRequested.current && !boomerangMode) stopRecording();
      const video = await recording;
      recorderActive.current = false;
      const elapsedMs = Date.now() - recordStartedAt.current;
      if (unmounted.current) return;
      if (!video?.uri) throw new Error('No video');
      if (elapsedMs < 400 && !boomerangMode) {
        // A stray touch, not a clip — Instagram treats this as nothing too.
        return;
      }
      setCapturedUri(video.uri);
      setCapturedMime(/\.mov$/i.test(video.uri) ? 'video/quicktime' : 'video/mp4');
      setCapturedType('VIDEO');
      setCapturedDuration(Math.max(1, Math.min(recordLimitSeconds, Math.round(elapsedMs / 1000))));
      setThumbnailUri(undefined);
      setIsBoomerang(boomerangMode);
      setSoundOff(false);
      setMode('PREVIEW');
      generateThumbnail(video.uri);
    } catch {
      if (!unmounted.current && !stopRequested.current) {
        Alert.alert('Recording stopped', 'The video couldn’t be recorded. Please try again.');
      }
    } finally {
      recorderActive.current = false;
      recordingBusy.current = false;
      if (!unmounted.current) {
        stopRecordingUi();
        if (switchedMode) setCameraMode('picture');
      }
    }
  };

  // ── Capture button (tap = photo, hold = video, release = stop) ───────────
  const handleCapturePressIn = () => {
    if (recordingBusy.current) return;
    if (boomerangMode) {
      // Tap (or hold) captures a short burst that stops by itself.
      startRecording();
      return;
    }
    if (!allowPhoto) {
      // Reels have no photo mode — recording starts on touch.
      startRecording();
      return;
    }
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      startRecording();
    }, 300);
  };

  const handleCapturePressOut = () => {
    if (holdTimer.current) {
      // Released before the hold threshold — a tap: take a photo.
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      takePicture();
      return;
    }
    if (recordingBusy.current && !boomerangMode) stopRecording();
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
        // On-device 1080p H.264 conversion (iOS) — keeps uploads small and
        // the server's ffmpeg to a quick remux.
        videoExportPreset: ImagePicker.VideoExportPreset.H264_1920x1080,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      let uri = asset.uri;
      const isVid = asset.type === 'video';
      if (isVid && asset.duration && asset.duration / 1000 > maxVideoSeconds + 1) {
        Alert.alert('Video too long', `Pick a video up to ${maxVideoSeconds} seconds long.`);
        return;
      }
      if (!isVid) {
        const prepared = storyMode
          ? await prepareStoryImage(uri, asset.width, asset.height, W / H)
          : await prepareImageForUpload(uri, asset.width, asset.height);
        uri = prepared.uri;
      }
      setCapturedUri(uri);
      // Picked video files aren't always mp4 (a .mov from an iPhone, etc.) —
      // trust the asset's own reported mimeType first, since mislabeling it
      // here doesn't fail the upload but does break later playback/decoding
      // of whatever actually got uploaded. Images always go through
      // prepareImageForUpload above, which re-encodes to JPEG regardless of
      // the source format (a .heic original included), so the declared type
      // must match that rather than the original asset's mimeType.
      setCapturedMime(isVid ? inferMimeType(asset, isVid) : 'image/jpeg');
      setCapturedType(isVid ? 'VIDEO' : 'IMAGE');
      setCapturedDuration(isVid && asset.duration ? Math.min(Math.ceil(asset.duration / 1000), maxVideoSeconds) : 5);
      setThumbnailUri(undefined);
      setSoundOff(false);
      setIsBoomerang(false);
      setMode('PREVIEW');
      if (isVid) generateThumbnail(uri);
    } catch {
      Alert.alert('Error', 'Failed to pick media');
    }
  };

  // ── Sticker helpers ───────────────────────────────────────────────────────
  const openTextEditor = () => setActiveSticker('CAPTION');
  const confirmCaption = (v: CaptionValue) => {
    setCaptionText(v.text);
    setCaptionColor(v.color);
    setCaptionStyle(v.style);
    setCaptionScale(v.scale);
    setActiveSticker(null);
  };
  const pickPlace = (p: StoryPlace) => {
    setPlace(p);
    setSheet(null);
  };
  const handleSave = async () => {
    if (!capturedUri || saving) return;
    setSaving(true);
    const res = await saveMediaToDevice(capturedUri, capturedType === 'VIDEO');
    setSaving(false);
    if (res === 'saved') showToast(capturedType === 'VIDEO' ? 'Video saved to your gallery' : 'Photo saved to your gallery');
    else if (res === 'denied') Alert.alert('Allow Photos access', 'To save, allow Paasxo to add photos in your phone’s Settings.');
    else if (res === 'failed') showToast('Couldn’t save — please try again');
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
    if (allowCaption && requireCaption && !caption.trim()) {
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
        filterName: storyMode ? gradeKey : selectedFilter.name,
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
        soundOff: capturedType === 'VIDEO' && !isBoomerang ? soundOff : undefined,
        audioTrackId: selectedTrack?.id,
        audioTrackUrl: selectedTrack?.url,
        audioVolume: selectedTrack ? 0.85 : undefined,
        taggedUserIds: allowTags && taggedPeople.length ? taggedPeople.map((p) => p.firebaseUid) : undefined,
        ...(storyMode ? {
          captionStyle: captionText ? captionStyle : undefined,
          captionScale: captionText ? captionScale : undefined,
          locationName: place?.name,
          locationPlaceId: place?.placeId ?? undefined,
          locationLat: place?.latitude ?? undefined,
          locationLng: place?.longitude ?? undefined,
          locationX: place ? placePos.x : undefined,
          locationY: place ? placePos.y : undefined,
          effect: effect ?? undefined,
        } : {}),
      });
      setUploadDone(true);
      setTimeout(() => goBack(router), 1200);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.response?.data?.message ?? e?.message ?? 'Please try again');
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
          <TouchableOpacity style={styles.backBtn} onPress={() => goBack(router)} activeOpacity={0.8}>
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
          <TouchableOpacity onPress={() => goBack(router)} style={{ marginTop: 14 }}>
            <Text style={[styles.permSub, { textDecorationLine: 'underline' }]}>Not now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Preview mode ──────────────────────────────────────────────────────────
  if (mode === 'PREVIEW' && capturedUri) {
    const busy = uploading || uploadDone;
    const previewThumb = capturedType === 'IMAGE' ? capturedUri : thumbnailUri;
    const tools: { key: string; label: string; icon: React.ReactNode; onPress: () => void; active?: boolean; show: boolean }[] = [
      { key: 'text', label: 'Text', icon: <TypeIcon color="#fff" size={20} strokeWidth={2.4} />, onPress: openTextEditor, active: !!captionText, show: true },
      { key: 'sticker', label: 'Stickers', icon: <Smile color="#fff" size={20} strokeWidth={2.4} />, onPress: () => setActiveSticker('EMOJI'), active: !!emoji, show: true },
      { key: 'place', label: 'Location', icon: <MapPin color="#fff" size={20} strokeWidth={2.4} />, onPress: () => setSheet('LOCATION'), active: !!place, show: storyMode },
      { key: 'fx', label: 'Effects', icon: <Sparkles color="#fff" size={20} strokeWidth={2.4} />, onPress: () => setSheet('EFFECTS'), active: !!effect, show: storyMode },
      { key: 'music', label: 'Music', icon: <Music color="#fff" size={20} strokeWidth={2.4} />, onPress: openMusicPicker, active: !!selectedTrack, show: allowMusic },
      { key: 'tag', label: 'Tag', icon: <UserPlus color="#fff" size={20} strokeWidth={2.4} />, onPress: () => setTagSheetVisible(true), active: taggedPeople.length > 0, show: allowTags },
      {
        key: 'sound', label: soundOff ? 'Sound off' : 'Sound on',
        icon: soundOff ? <VolumeX color="#fff" size={20} strokeWidth={2.4} /> : <Volume2 color="#fff" size={20} strokeWidth={2.4} />,
        onPress: () => setSoundOff((v) => !v), active: soundOff, show: capturedType === 'VIDEO' && !isBoomerang,
      },
      { key: 'boomerang', label: 'Boomerang', icon: <RefreshCw color="#fff" size={20} strokeWidth={2.4} />, onPress: () => setIsBoomerang((b) => !b), active: isBoomerang, show: allowBoomerang && capturedType === 'VIDEO' },
      {
        key: 'save', label: 'Save',
        icon: saving ? <ActivityIndicator color="#fff" size="small" /> : <Download color="#fff" size={20} strokeWidth={2.4} />,
        onPress: handleSave, show: storyMode,
      },
    ];

    return (
      <View style={styles.previewContainer}>
        <StatusBar hidden />
        {/* Media + colour grade, blended in their own isolated group. */}
        <View style={styles.mediaGroup}>
          <PreviewMedia uri={capturedUri} mediaType={capturedType} muted={!!selectedTrack || soundOff || isBoomerang} />
          {storyMode ? (
            <GradeLayers gradeKey={gradeKey} />
          ) : selectedFilter.overlay ? (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: selectedFilter.overlay }]} pointerEvents="none" />
          ) : null}
        </View>
        {storyMode && <StoryEffectLayer effectKey={effect} fontsReady={fontsReady} />}
        <LinearGradient colors={['rgba(0,0,0,0.5)', 'transparent']} style={styles.previewTopGrad} pointerEvents="none" />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.previewBottomGrad} pointerEvents="none" />

        {/* Stickers: drag to move, tap to edit, drop on the bin to remove. */}
        {!!captionText && (
          <DraggableSticker
            initialX={captionPos.x}
            initialY={captionPos.y}
            onPositionChange={(x, y) => setCaptionPos({ x, y })}
            onRemove={removeCaptionText}
            onTap={openTextEditor}
            onDragChange={onDragChange}
            styles={styles}
          >
            {storyMode ? (
              <StoryCaption text={captionText} color={captionColor} styleKey={captionStyle} scale={captionScale} fontsReady={fontsReady} maxWidth={W - 40} />
            ) : (
              <Text style={[styles.stickerCaptionText, { color: captionColor }]}>{captionText}</Text>
            )}
          </DraggableSticker>
        )}
        {!!emoji && (
          <DraggableSticker
            initialX={emojiPos.x}
            initialY={emojiPos.y}
            onPositionChange={(x, y) => setEmojiPos({ x, y })}
            onRemove={removeEmoji}
            onTap={() => setActiveSticker('EMOJI')}
            onDragChange={onDragChange}
            styles={styles}
          >
            <Text style={styles.stickerEmoji} allowFontScaling={false}>{emoji}</Text>
          </DraggableSticker>
        )}
        {storyMode && !!place && (
          <DraggableSticker
            key={place.name}
            initialX={placePos.x}
            initialY={placePos.y}
            onPositionChange={(x, y) => setPlacePos({ x, y })}
            onRemove={() => setPlace(null)}
            onTap={() => setSheet('LOCATION')}
            onDragChange={onDragChange}
            styles={styles}
          >
            <LocationSticker name={place.name} fontsReady={fontsReady} maxWidth={W - 60} />
          </DraggableSticker>
        )}

        {/* Bin — shown while dragging a sticker. */}
        {drag.dragging && (
          <View style={styles.trashWrap} pointerEvents="none">
            <View style={[styles.trash, drag.overTrash && styles.trashActive]}>
              <Trash2 color="#fff" size={drag.overTrash ? 26 : 22} strokeWidth={2.4} />
            </View>
            <Text style={styles.trashText}>{drag.overTrash ? 'Release to remove' : 'Drag here to remove'}</Text>
          </View>
        )}

        {/* Top-left: back + badges */}
        {!drag.dragging && (
          <SafeAreaView style={styles.previewTop} edges={['top']} pointerEvents="box-none">
            <TouchableOpacity style={styles.previewBackBtn} onPress={() => setMode('CAMERA')} activeOpacity={0.8} disabled={busy} accessibilityLabel="Retake">
              <ArrowLeft color="#fff" size={22} strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={styles.badgeRow}>
              {capturedType === 'VIDEO' && (
                <View style={styles.videoBadge}>
                  <Video color="#fff" size={12} strokeWidth={2.5} fill="#fff" />
                  <Text style={styles.videoBadgeText}>{capturedDuration}s</Text>
                </View>
              )}
              {isBoomerang && (
                <View style={[styles.videoBadge, { backgroundColor: '#fff' }]}>
                  <RefreshCw color="#000" size={12} strokeWidth={2.5} />
                  <Text style={[styles.videoBadgeText, { color: '#000' }]}>Boomerang</Text>
                </View>
              )}
            </View>
          </SafeAreaView>
        )}

        {/* Right: tool rail */}
        {!drag.dragging && (
          <SafeAreaView style={styles.toolRail} edges={['top']} pointerEvents="box-none">
            {tools.filter((t) => t.show).map((t) => (
              <TouchableOpacity
                key={t.key}
                style={styles.toolItem}
                onPress={t.onPress}
                activeOpacity={0.8}
                disabled={busy}
                accessibilityLabel={t.label}
              >
                <View style={[styles.toolBtn, t.active && styles.toolBtnActive]}>{t.icon}</View>
                <Text style={styles.toolLabel}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </SafeAreaView>
        )}

        {!!selectedTrack && !drag.dragging && (
          <TouchableOpacity style={styles.musicBadge} onPress={openMusicPicker} activeOpacity={0.85}>
            <Music color="#fff" size={12} strokeWidth={2.5} />
            <Text style={styles.musicBadgeText} numberOfLines={1}>{selectedTrack.title} · {selectedTrack.artist}</Text>
          </TouchableOpacity>
        )}

        {/* Bottom: tags, colour grades, caption, share */}
        {!drag.dragging && (
          <SafeAreaView style={[styles.previewBottom, { bottom: keyboardOffset }]} edges={['bottom']} pointerEvents="box-none">
            {allowTags && taggedPeople.length > 0 && (
              <TouchableOpacity style={styles.tagSummary} onPress={() => setTagSheetVisible(true)} activeOpacity={0.85}>
                <UserPlus color="#fff" size={13} strokeWidth={2.5} />
                <Text style={styles.tagSummaryText} numberOfLines={1}>
                  {taggedPeople.length === 1
                    ? `With ${taggedPeople[0].displayName}`
                    : `With ${taggedPeople[0].displayName} +${taggedPeople.length - 1}`}
                </Text>
              </TouchableOpacity>
            )}
            {keyboardOffset === 0 && (
              storyMode ? (GRADES_SUPPORTED &&
                <View style={styles.gradeWrap}>
                  <GradeStrip thumbUri={previewThumb} value={gradeKey} onChange={setGradeKey} />
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll} style={styles.gradeWrap}>
                  {CAPTURE_FILTERS.map((f) => {
                    const active = selectedFilter.name === f.name;
                    return (
                      <TouchableOpacity key={f.name} style={styles.filterItem} onPress={() => setSelectedFilter(f)} activeOpacity={0.8}>
                        <View style={[styles.filterSwatch, { backgroundColor: f.overlay ?? '#555', borderColor: active ? '#fff' : 'rgba(255,255,255,0.3)' }]}>
                          {f.overlay === null && <Text style={{ color: '#fff', fontSize: 11 }}>✓</Text>}
                        </View>
                        <Text style={[styles.filterLabel, { color: active ? f.labelColor : 'rgba(255,255,255,0.55)' }]}>{f.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )
            )}
            <View style={styles.bottomInner}>
              {allowCaption && (
                <TextInput
                  style={styles.captionInput}
                  placeholder={captionPlaceholder}
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={caption}
                  onChangeText={setCaption}
                  maxLength={280}
                  multiline
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              )}
              <TouchableOpacity style={styles.shareBtn} onPress={handleSubmit} disabled={busy} activeOpacity={0.88}>
                {uploadDone ? (
                  <View style={styles.shareBtnInner}>
                    <CheckCircle color="#fff" size={22} strokeWidth={2.5} />
                    <Text style={styles.shareBtnText}>{doneLabel}</Text>
                  </View>
                ) : uploading ? (
                  <View style={[styles.shareBtnInner, { backgroundColor: 'rgba(41,119,194,0.9)' }]}>
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
            </View>
          </SafeAreaView>
        )}

        {!!toast && (
          <View style={styles.toast} pointerEvents="none">
            <CheckCircle color="#22D3EE" size={16} strokeWidth={2.6} />
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}

        {/* ── Editors & sheets ── */}
        {activeSticker === 'CAPTION' && (
          <CaptionEditor
            initial={{ text: captionText, color: captionColor, style: storyMode ? captionStyle : 'CLASSIC', scale: storyMode ? captionScale : 1 }}
            fontsReady={fontsReady}
            allowStyles={storyMode}
            onDone={confirmCaption}
            onCancel={() => setActiveSticker(null)}
          />
        )}
        {activeSticker === 'EMOJI' && (
          <StickerSheet onPick={pickEmoji} onClose={() => setActiveSticker(null)} />
        )}
        {storyMode && sheet === 'LOCATION' && (
          <LocationSheet
            current={place?.name ?? null}
            onPick={pickPlace}
            onRemove={() => { setPlace(null); setSheet(null); }}
            onClose={() => setSheet(null)}
          />
        )}
        {storyMode && sheet === 'EFFECTS' && (
          <EffectsSheet value={effect} onChange={setEffect} onClose={() => setSheet(null)} />
        )}
        {allowTags && (
          <TagPeopleSheet
            visible={tagSheetVisible}
            selected={taggedPeople}
            onChange={setTaggedPeople}
            onClose={() => setTagSheetVisible(false)}
            title="Tag people in your story"
          />
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
        mode={cameraMode}
        mute={!micGranted}
        videoQuality="1080p"
        videoBitrate={5_000_000}
        enableTorch={flashOn && facing === 'back'}
        onCameraReady={handleCameraReady}
      />

      <SafeAreaView style={styles.camTopBar} edges={['top']}>
        <TouchableOpacity style={styles.camIconBtn} onPress={() => goBack(router)} activeOpacity={0.8}>
          <X color="#fff" size={24} strokeWidth={2.5} />
        </TouchableOpacity>
        {isRecording && (
          <View style={styles.recordInfo}>
            <View style={styles.recDot} />
            <Text style={styles.recTimer}>{recordSeconds}s / {recordLimitSeconds}s</Text>
            <Animated.View
              style={[
                styles.recProgressTrack,
                { width: recordProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]}
            />
          </View>
        )}
        <View style={styles.camTopRight}>
          {facing === 'back' && !isRecording && (
            <TouchableOpacity
              style={[styles.camIconBtn, flashOn && styles.camIconBtnOn]}
              onPress={() => setFlashOn((v) => !v)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={flashOn ? 'Turn flashlight off' : 'Turn flashlight on'}
            >
              {flashOn ? <Zap color="#000" size={20} strokeWidth={2.4} fill="#000" /> : <ZapOff color="#fff" size={20} strokeWidth={2.2} />}
            </TouchableOpacity>
          )}
          {storyMode && !isRecording && (
            <TouchableOpacity
              style={styles.camIconBtn}
              onPress={() => setSettingsOpen(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Story settings"
            >
              <Settings2 color="#fff" size={21} strokeWidth={2.2} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.camIconBtn}
            onPress={() => { setFacing((f) => (f === 'back' ? 'front' : 'back')); }}
            activeOpacity={0.8}
            accessibilityLabel="Flip camera"
          >
            <FlipHorizontal color="#fff" size={22} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.camBottomBar} edges={['bottom']}>
        <TouchableOpacity style={styles.sideBtn} onPress={pickFromGallery} activeOpacity={0.8}>
          <ImageIcon color="#fff" size={26} strokeWidth={1.8} />
          <Text style={styles.sideBtnLabel}>Gallery</Text>
        </TouchableOpacity>

        <View style={styles.captureWrap}>
          <Pressable
            onPressIn={handleCapturePressIn}
            onPressOut={handleCapturePressOut}
            // Keep the hold alive if the finger drifts while recording.
            pressRetentionOffset={{ top: H, bottom: 200, left: W, right: W }}
            accessibilityRole="button"
            accessibilityLabel={allowPhoto ? 'Capture. Tap for a photo, hold to record a video' : 'Hold to record'}
          >
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
              {isRecording && (
                <Svg width={RING_SIZE} height={RING_SIZE} style={styles.captureRing} pointerEvents="none">
                  <AnimatedCircle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_R}
                    stroke={resolvedAccentColors[0]}
                    strokeWidth={5}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${RING_C} ${RING_C}`}
                    strokeDashoffset={recordProgress.interpolate({ inputRange: [0, 1], outputRange: [RING_C, 0] })}
                    transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                  />
                </Svg>
              )}
            </Animated.View>
          </Pressable>
          <Text style={styles.captureHint}>
            {boomerangMode
              ? (isRecording ? 'Capturing boomerang…' : 'Tap for a Boomerang')
              : isRecording ? 'Release to stop' : allowPhoto ? 'Tap for photo · Hold for video' : 'Hold to record'}
          </Text>
        </View>

        {allowBoomerang ? (
          <TouchableOpacity
            style={styles.sideBtn}
            onPress={() => setBoomerangMode((v) => !v)}
            disabled={isRecording}
            activeOpacity={0.8}
            accessibilityRole="switch"
            accessibilityState={{ checked: boomerangMode }}
            accessibilityLabel="Boomerang"
          >
            <View style={[styles.boomBtn, boomerangMode && styles.boomBtnOn]}>
              <RefreshCw color={boomerangMode ? '#000' : '#fff'} size={22} strokeWidth={2.2} />
            </View>
            <Text style={styles.sideBtnLabel}>Boomerang</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.sideBtn} />
        )}
      </SafeAreaView>

      {settingsOpen && <StorySettingsSheet onClose={() => setSettingsOpen(false)} />}

      {micSheet && (
        <View style={styles.micOverlay}>
          <View style={styles.micCard}>
            <View style={styles.micIcon}><MicOff color="#fff" size={26} strokeWidth={2.2} /></View>
            <Text style={styles.micTitle}>Microphone is off</Text>
            <Text style={styles.micBody}>Paasxo can’t record sound. Turn the microphone on in Settings, or record this video without sound.</Text>
            <TouchableOpacity
              style={styles.micPrimary}
              onPress={() => {
                if (micDontShow) { micPromptOff.current = true; AsyncStorage.setItem(MIC_PROMPT_OFF_KEY, '1').catch(() => {}); }
                setMicSheet(false);
                Linking.openSettings().catch(() => {});
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.micPrimaryText}>Open Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.micSecondary}
              onPress={() => {
                if (micDontShow) { micPromptOff.current = true; AsyncStorage.setItem(MIC_PROMPT_OFF_KEY, '1').catch(() => {}); }
                recordWithoutSound.current = true;
                setMicSheet(false);
                showToast(boomerangMode ? 'Tap the button to record' : 'Hold the button to record without sound');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.micSecondaryText}>Record without sound</Text>
            </TouchableOpacity>
            <Pressable
              style={styles.micCheckRow}
              onPress={() => setMicDontShow((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: micDontShow }}
            >
              <View style={[styles.micCheck, micDontShow && styles.micCheckOn]}>
                {micDontShow && <CheckCircle color="#fff" size={14} strokeWidth={3} />}
              </View>
              <Text style={styles.micCheckText}>Don’t show this again</Text>
            </Pressable>
          </View>
        </View>
      )}

      {!!toast && (
        <View style={styles.toast} pointerEvents="none">
          <CheckCircle color="#22D3EE" size={16} strokeWidth={2.6} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },

  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camTopRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  camIconBtnOn: { backgroundColor: '#FDE68A' },
  boomBtn: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
  },
  boomBtnOn: { backgroundColor: '#fff', borderColor: '#fff' },
  micOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  micCard: { width: '100%', maxWidth: 360, backgroundColor: '#0F1A2C', borderRadius: 24, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  micIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#2977C2', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  micTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  micBody: { color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8, marginBottom: 18 },
  micPrimary: { alignSelf: 'stretch', height: 50, borderRadius: 14, backgroundColor: '#2977C2', alignItems: 'center', justifyContent: 'center' },
  micPrimaryText: { color: '#fff', fontSize: 15.5, fontWeight: '900' },
  micSecondary: { alignSelf: 'stretch', height: 50, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  micSecondaryText: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
  micCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, paddingVertical: 4 },
  micCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  micCheckOn: { backgroundColor: '#2977C2', borderColor: '#2977C2' },
  micCheckText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
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
  captureRing: { position: 'absolute', top: -10, left: -10 },
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
  mediaGroup: { ...StyleSheet.absoluteFillObject, isolation: 'isolate', overflow: 'hidden' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 10 },
  toolRail: { position: 'absolute', top: 0, right: 10, alignItems: 'center', gap: 8, paddingTop: 6 },
  toolItem: { alignItems: 'center', gap: 3 },
  toolBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(8,12,20,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  toolBtnActive: { backgroundColor: 'rgba(41,119,194,0.85)', borderColor: '#22D3EE' },
  toolLabel: {
    color: '#fff', fontSize: 9.5, fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  trashWrap: { position: 'absolute', left: 0, right: 0, bottom: H * (1 - 0.93), alignItems: 'center', gap: 6 },
  trash: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)',
  },
  trashActive: { backgroundColor: '#EF4444', borderColor: '#fff', transform: [{ scale: 1.15 }] },
  trashText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  gradeWrap: { marginBottom: 12 },
  bottomInner: { paddingHorizontal: 20, gap: 10 },
  toast: {
    position: 'absolute', alignSelf: 'center', top: H * 0.45,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(8,12,20,0.88)', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(34,211,238,0.5)',
  },
  toastText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
  previewTopGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  previewBottomGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 260 },
  previewTop: {
    position: 'absolute', top: 0, left: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 6,
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
  tagSummary: {
    alignSelf: 'flex-start', marginLeft: 16, marginBottom: 10, maxWidth: W - 32,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(41,119,194,0.6)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(107,182,255,0.55)',
    paddingHorizontal: 11, paddingVertical: 6,
  },
  tagSummaryText: { color: '#fff', fontSize: 12, fontWeight: '700', flexShrink: 1 },

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

  previewBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 16 },
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

  stickerWrap: { position: 'absolute', maxWidth: W - 32, alignItems: 'center' },
  stickerCaptionText: {
    fontSize: 24, fontWeight: '800', textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  stickerEmoji: { fontSize: 48 },

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
