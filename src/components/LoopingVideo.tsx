import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

// Shared by ReelPlayer and PostVideoPlayer — a muted-by-default, looping,
// fullscreen video surface (both pass contentFit="contain" so nothing is cropped). expo-video/expo-av are required at module
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

export function LoopingVideo({
  uri, muted, paused = false, contentFit = 'cover',
}: {
  uri: string;
  muted: boolean;
  /** Pager pages that aren't on screen stay loaded but don't play. */
  paused?: boolean;
  contentFit?: 'cover' | 'contain';
}) {
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
    if (!paused) p.play();
  });
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    try {
      if (paused) player.pause();
      else player.play();
    } catch { /* player released */ }
  }, [paused, player]);
  return (
    <VideoView player={player} style={StyleSheet.absoluteFillObject} contentFit={contentFit} nativeControls={false} />
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: '#fff', fontSize: 13 },
});
