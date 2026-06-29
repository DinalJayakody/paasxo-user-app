import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
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
  Loader,
  Video,
  X,
  Zap,
} from 'lucide-react-native';
import { Colors } from '../styles/colors';
import { storyApi } from '../api/storyApi';

// Platform-safe camera import
let CameraView: any = null;
let useCameraPermissions: any = null;
let useMicrophonePermissions: any = null;
let ImageManipulator: any = null;

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
}

const { width: W, height: H } = Dimensions.get('window');

// ── Filter presets ─────────────────────────────────────────────────────────────
const FILTERS = [
  { name: 'NORMAL', label: 'Normal', overlay: null, labelColor: '#fff' },
  { name: 'WARM', label: 'Warm', overlay: 'rgba(255,120,50,0.22)', labelColor: '#FFAA55' },
  { name: 'COOL', label: 'Cool', overlay: 'rgba(30,100,255,0.22)', labelColor: '#6699FF' },
  { name: 'ROSE', label: 'Rose', overlay: 'rgba(255,50,120,0.20)', labelColor: '#FF5599' },
  { name: 'FADE', label: 'Fade', overlay: 'rgba(255,255,255,0.30)', labelColor: '#ccc' },
  { name: 'DRAMA', label: 'Drama', overlay: 'rgba(0,0,0,0.28)', labelColor: '#aaa' },
  { name: 'GREEN', label: 'Nature', overlay: 'rgba(50,200,100,0.18)', labelColor: '#66CC88' },
];

type StoryMode = 'CAMERA' | 'PREVIEW';

export default function StoryCreateScreen() {
  const router = useRouter();
  const cameraRef = useRef<any>(null);

  const [mode, setMode] = useState<StoryMode>('CAMERA');
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturedMime, setCapturedMime] = useState<string>('image/jpeg');
  const [capturedType, setCapturedType] = useState<'IMAGE' | 'VIDEO'>('IMAGE');
  const [capturedDuration, setCapturedDuration] = useState<number>(5);

  const [selectedFilter, setSelectedFilter] = useState(FILTERS[0]);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);

  // Permissions
  const camPerm = useCameraPermissions ? useCameraPermissions() : [{ granted: false }, async () => {}];
  const micPerm = useMicrophonePermissions ? useMicrophonePermissions() : [{ granted: false }, async () => {}];
  const [cameraPermission, requestCameraPermission] = camPerm;
  const [micPermission, requestMicPermission] = micPerm;

  // Record progress bar
  const recordProgress = useRef(new Animated.Value(0)).current;
  const recordAnim = useRef<Animated.CompositeAnimation | null>(null);
  const MAX_VIDEO_SECONDS = 30;

  useEffect(() => {
    return () => {
      if (recordTimer.current) clearInterval(recordTimer.current);
    };
  }, []);

  // ── Camera actions ──────────────────────────────────────────────────────────
  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.75, base64: false });
      let uri = photo.uri;
      // Compress
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
      setMode('PREVIEW');
    } catch (e) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current || isRecording) return;
    setIsRecording(true);
    setRecordSeconds(0);
    recordProgress.setValue(0);

    recordAnim.current = Animated.timing(recordProgress, {
      toValue: 1,
      duration: MAX_VIDEO_SECONDS * 1000,
      useNativeDriver: false,
    });
    recordAnim.current.start(({ finished }) => {
      if (finished) stopRecording();
    });

    recordTimer.current = setInterval(() => {
      setRecordSeconds((s) => {
        if (s + 1 >= MAX_VIDEO_SECONDS) stopRecording();
        return s + 1;
      });
    }, 1000);

    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: MAX_VIDEO_SECONDS,
        quality: '720p',
      });
      const durationSec = Math.min(MAX_VIDEO_SECONDS, recordSeconds + 1);
      setCapturedUri(video.uri);
      setCapturedMime('video/mp4');
      setCapturedType('VIDEO');
      setCapturedDuration(durationSec);
      setMode('PREVIEW');
    } catch {
      setIsRecording(false);
    }
  };

  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    setIsRecording(false);
    if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
    if (recordAnim.current) recordAnim.current.stop();
    cameraRef.current?.stopRecording?.();
  }, [isRecording]);

  // ── Gallery picker ──────────────────────────────────────────────────────────
  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow media library access to pick photos/videos');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.8,
        videoMaxDuration: MAX_VIDEO_SECONDS,
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
      setCapturedMime(isVid ? 'video/mp4' : 'image/jpeg');
      setCapturedType(isVid ? 'VIDEO' : 'IMAGE');
      setCapturedDuration(isVid && asset.duration ? Math.min(Math.ceil(asset.duration / 1000), MAX_VIDEO_SECONDS) : 5);
      setMode('PREVIEW');
    } catch {
      Alert.alert('Error', 'Failed to pick media');
    }
  };

  // ── Upload ──────────────────────────────────────────────────────────────────
  const uploadStory = async () => {
    if (!capturedUri || uploading) return;
    setUploading(true);
    try {
      await storyApi.createStory({
        mediaUri: capturedUri,
        mediaType: capturedType,
        mimeType: capturedMime,
        durationSeconds: capturedDuration,
        filterName: selectedFilter.name,
      });
      setUploadDone(true);
      setTimeout(() => router.back(), 1200);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Please try again');
    } finally {
      setUploading(false);
    }
  };

  // ── Permission gates ────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.webFallback}>
          <Camera color={Colors.neutral500} size={48} strokeWidth={1.2} />
          <Text style={styles.webFallbackTitle}>Camera unavailable on web</Text>
          <Text style={styles.webFallbackSub}>Use the iOS or Android app to create stories</Text>
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
        <ActivityIndicator color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!cameraPermission?.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.permWrap}>
          <Camera color={Colors.primary} size={56} strokeWidth={1.2} />
          <Text style={styles.permTitle}>Camera Access Needed</Text>
          <Text style={styles.permSub}>We need camera permission to let you create stories</Text>
          <TouchableOpacity
            style={styles.permBtn}
            onPress={async () => {
              await requestCameraPermission();
              await requestMicPermission();
            }}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.permBtnGrad}>
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

  // ── Preview mode ────────────────────────────────────────────────────────────
  if (mode === 'PREVIEW' && capturedUri) {
    return (
      <View style={styles.previewContainer}>
        <StatusBar hidden />
        {/* Media */}
        <Image source={{ uri: capturedUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        {/* Filter overlay */}
        {selectedFilter.overlay && (
          <View
            style={[StyleSheet.absoluteFillObject, { backgroundColor: selectedFilter.overlay }]}
            pointerEvents="none"
          />
        )}
        {/* Dark gradient top */}
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'transparent']}
          style={styles.previewTopGrad}
          pointerEvents="none"
        />
        {/* Dark gradient bottom */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.65)']}
          style={styles.previewBottomGrad}
          pointerEvents="none"
        />

        {/* Top row */}
        <SafeAreaView style={styles.previewTop} edges={['top']}>
          <TouchableOpacity
            style={styles.previewBackBtn}
            onPress={() => setMode('CAMERA')}
            activeOpacity={0.8}
          >
            <ArrowLeft color="#fff" size={22} strokeWidth={2.5} />
          </TouchableOpacity>
          {capturedType === 'VIDEO' && (
            <View style={styles.videoBadge}>
              <Video color="#fff" size={12} strokeWidth={2.5} fill="#fff" />
              <Text style={styles.videoBadgeText}>{capturedDuration}s</Text>
            </View>
          )}
        </SafeAreaView>

        {/* Filter row */}
        <View style={styles.filtersWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
            {FILTERS.map((f) => {
              const active = selectedFilter.name === f.name;
              return (
                <TouchableOpacity
                  key={f.name}
                  style={styles.filterItem}
                  onPress={() => setSelectedFilter(f)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.filterSwatch, { backgroundColor: f.overlay ?? '#555', borderColor: active ? '#fff' : 'rgba(255,255,255,0.3)' }]}>
                    {f.overlay === null && <Text style={{ color: '#fff', fontSize: 11 }}>✓</Text>}
                  </View>
                  <Text style={[styles.filterLabel, { color: active ? f.labelColor : 'rgba(255,255,255,0.55)' }]}>
                    {f.label}
                  </Text>
                  {active && <View style={styles.filterActiveDot} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Share button */}
        <SafeAreaView style={styles.previewBottom} edges={['bottom']}>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={uploadStory}
            disabled={uploading || uploadDone}
            activeOpacity={0.88}
          >
            {uploadDone ? (
              <View style={styles.shareBtnInner}>
                <CheckCircle color="#fff" size={22} strokeWidth={2.5} />
                <Text style={styles.shareBtnText}>Shared!</Text>
              </View>
            ) : uploading ? (
              <View style={styles.shareBtnInner}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.shareBtnText}>Uploading…</Text>
              </View>
            ) : (
              <LinearGradient
                colors={['#E91E63', '#7B1FA2', Colors.primaryDark]}
                style={styles.shareBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Zap color="#fff" size={18} strokeWidth={2.5} fill="#fff" />
                <Text style={styles.shareBtnText}>Share Story</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // ── Camera mode ─────────────────────────────────────────────────────────────
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

      {/* Top controls */}
      <SafeAreaView style={styles.camTopBar} edges={['top']}>
        <TouchableOpacity style={styles.camIconBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <X color="#fff" size={24} strokeWidth={2.5} />
        </TouchableOpacity>
        {/* Recording timer */}
        {isRecording && (
          <View style={styles.recordInfo}>
            <View style={styles.recDot} />
            <Text style={styles.recTimer}>{recordSeconds}s / {MAX_VIDEO_SECONDS}s</Text>
            <Animated.View
              style={[
                styles.recProgressTrack,
                {
                  width: recordProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
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

      {/* Bottom controls */}
      <SafeAreaView style={styles.camBottomBar} edges={['bottom']}>
        {/* Gallery picker */}
        <TouchableOpacity style={styles.sideBtn} onPress={pickFromGallery} activeOpacity={0.8}>
          <ImageIcon color="#fff" size={26} strokeWidth={1.8} />
          <Text style={styles.sideBtnLabel}>Gallery</Text>
        </TouchableOpacity>

        {/* Capture / record */}
        <View style={styles.captureWrap}>
          <TouchableOpacity
            onPress={isRecording ? stopRecording : takePicture}
            onLongPress={!isRecording ? startRecording : undefined}
            delayLongPress={400}
            style={styles.captureOuter}
            activeOpacity={0.9}
          >
            <View style={[styles.captureInner, isRecording && styles.captureRecording]}>
              {isRecording && (
                <View style={styles.captureStopSquare} />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.captureHint}>
            {isRecording ? 'Tap to stop' : 'Tap photo · Hold video'}
          </Text>
        </View>

        {/* Spacer to balance layout */}
        <View style={styles.sideBtn} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },

  // ── Camera ───────────────────────────────────────────────────────────────────
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

  // Capture button
  captureWrap: { alignItems: 'center', gap: 8 },
  captureOuter: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  captureInner: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff',
  },
  captureRecording: { backgroundColor: '#FF3B3B' },
  captureStopSquare: {
    width: 22, height: 22, borderRadius: 4, backgroundColor: '#fff',
  },
  captureHint: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500' },

  // Recording info
  recordInfo: {
    flex: 1, marginHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 6, overflow: 'hidden',
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B3B' },
  recTimer: { color: '#fff', fontSize: 12, fontWeight: '700' },
  recProgressTrack: {
    height: 2, backgroundColor: '#FF3B3B', borderRadius: 1,
    position: 'absolute', bottom: 0, left: 0,
  },

  // ── Preview ──────────────────────────────────────────────────────────────────
  previewContainer: { flex: 1, backgroundColor: '#000' },
  previewTopGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  previewBottomGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 220 },
  previewTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 4,
  },
  previewBackBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  videoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  videoBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Filters
  filtersWrap: { position: 'absolute', bottom: 100, left: 0, right: 0 },
  filtersScroll: { paddingHorizontal: 16, gap: 12 },
  filterItem: { alignItems: 'center', gap: 5, position: 'relative' },
  filterSwatch: {
    width: 46, height: 46, borderRadius: 23, borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
  },
  filterLabel: { fontSize: 10, fontWeight: '700' },
  filterActiveDot: {
    width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff',
    position: 'absolute', bottom: -2,
  },

  // Share button
  previewBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24, paddingBottom: 16,
  },
  shareBtn: { borderRadius: 28, overflow: 'hidden' },
  shareBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
  },
  shareBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
    backgroundColor: Colors.success, borderRadius: 28,
  },
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  // ── Permission & fallbacks ───────────────────────────────────────────────────
  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  permTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  permSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  permBtn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  permBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  permBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  webFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  webFallbackTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  webFallbackSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  backBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  backBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
