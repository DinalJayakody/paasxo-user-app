import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

// Shared by ReelPlayer and PostVideoPlayer — a muted-by-default, looping,
// fullscreen-cover video surface. expo-video/expo-av are required at module
// scope via Platform.OS gating (no web target for either) rather than a
// static import, matching the rest of this codebase's native-only-module
// convention (see appleSignIn.ts).
let useVideoPlayer: any = null;
let VideoView: any = null;
if (Platform.OS !== 'web') {
  try {
    const vid = require('expo-video');
    useVideoPlayer = vid.useVideoPlayer;
    VideoView = vid.VideoView;
  } catch {}
}

export function LoopingVideo({ uri, muted }: { uri: string; muted: boolean }) {
  if (!useVideoPlayer || !VideoView) {
    return (
      <View style={[StyleSheet.absoluteFillObject, styles.fallback]}>
        <Text style={styles.fallbackText}>Video unavailable on this platform</Text>
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

const styles = StyleSheet.create({
  fallback: { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: '#fff', fontSize: 13 },
});
