import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { WifiOff } from 'lucide-react-native';
import { Colors } from '../styles/colors';
import { PaasxoLogoLoader } from './PaasxoLogoLoader';

const DEFAULT_MESSAGES = [
  'Warming up the pitch…',
  'Setting the scoreboard…',
  'Lacing up…',
  'Finding your next match…',
  'Getting everything ready…',
];

const SLOW_CONNECTION_MS = 7000;
// Most loads resolve well under this — showing the branded loader for those
// would just be a flash the user barely registers as "loading" before it's
// gone again. Waiting this long before showing anything makes a fast load
// feel like a normal, instant screen change instead of a loading blip, and
// only actually-slow loads get the full treatment.
const SHOW_DELAY_MS = 2000;

interface LoadingScreenProps {
  /** Overrides the cycling default copy with a fixed, context-specific message. */
  message?: string;
  /** Swap in a different rotation of messages for a specific screen. */
  messages?: string[];
  /** Renders inline (transparent, fills parent) instead of as its own full,
   *  gradient-backed screen — for use inside a screen that already has its
   *  own background/header and just needs the loading body replaced. */
  inline?: boolean;
}

/**
 * Drop-in replacement for the old `<ActivityIndicator size="large" />`
 * loading screens used across the app. Cycles some on-brand copy so a
 * multi-second wait doesn't feel dead, and — since a slow load is
 * indistinguishable from a stuck one to the person staring at it — surfaces
 * a "this is taking a while" connection hint once it actually has.
 */
export function LoadingScreen({ message, messages, inline = false }: LoadingScreenProps) {
  const pool = messages && messages.length > 0 ? messages : DEFAULT_MESSAGES;
  const [messageIndex, setMessageIndex] = useState(0);
  const [showSlowNotice, setShowSlowNotice] = useState(false);
  const [visible, setVisible] = useState(false);
  const textFade = useRef(new Animated.Value(1)).current;
  const noticeFade = useRef(new Animated.Value(0)).current;
  const bodyFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
      Animated.timing(bodyFade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
    }, SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [bodyFade]);

  useEffect(() => {
    if (message) return; // fixed message — no rotation
    const interval = setInterval(() => {
      Animated.timing(textFade, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        setMessageIndex((i) => (i + 1) % pool.length);
        Animated.timing(textFade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      });
    }, 2400);
    return () => clearInterval(interval);
    // pool is derived from props each render; only the identity of `message` should restart the cycle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSlowNotice(true);
      Animated.timing(noticeFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, SLOW_CONNECTION_MS);
    return () => clearTimeout(timer);
  }, [noticeFade]);

  // Inline mode sits on the host screen's own (typically light) background,
  // so it needs dark-on-light text — the white/translucent styling below is
  // only legible against the gradient the full-screen variant paints itself.
  const messageColor = inline ? Colors.textSecondary : Colors.white;
  const noticeIconColor = inline ? Colors.textMuted : 'rgba(255,255,255,0.85)';
  const noticeBg = inline ? Colors.neutral100 : 'rgba(0,0,0,0.18)';
  const noticeTextColor = inline ? Colors.textSecondary : 'rgba(255,255,255,0.9)';

  const body = (
    <Animated.View style={[styles.center, { opacity: bodyFade }]}>
      <PaasxoLogoLoader size={72} elevated={!inline} />
      <Animated.Text style={[styles.message, { color: messageColor, opacity: message ? 1 : textFade }]}>
        {message ?? pool[messageIndex]}
      </Animated.Text>
      {showSlowNotice && (
        <Animated.View style={[styles.slowNotice, { backgroundColor: noticeBg, opacity: noticeFade }]}>
          <WifiOff color={noticeIconColor} size={14} strokeWidth={2} />
          <Text style={[styles.slowNoticeText, { color: noticeTextColor }]}>
            This is taking longer than usual — check your connection.
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );

  // Under the SHOW_DELAY_MS threshold: a plain, neutral placeholder — same
  // footprint as the real thing, nothing branded on it yet, so a fast load
  // just reads as an ordinary screen change rather than a loading flash.
  if (!visible) {
    return <View style={[styles.flex1, !inline && { backgroundColor: Colors.background }]} />;
  }

  if (inline) {
    return <View style={styles.inlineWrap}>{body}</View>;
  }

  return (
    <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.flex1}>
      <SafeAreaView style={styles.flex1}>{body}</SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  inlineWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 18 },
  message: {
    fontSize: 14.5, fontWeight: '600', textAlign: 'center',
  },
  slowNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: 6, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
  },
  slowNoticeText: { fontSize: 11.5, fontWeight: '600', flexShrink: 1 },
});
