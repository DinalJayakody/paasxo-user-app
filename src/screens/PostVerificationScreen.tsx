import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  SafeAreaView,
  Easing,
  Platform,
} from 'react-native';
import { X, ArrowRight, CircleCheck as CheckCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../styles/colors';
import { Button } from '../components/Button';

const SPORT_CHARS = [
  { emoji: '⚽', left: '8%',  delay: 0,    duration: 2600 },
  { emoji: '🏏', left: '22%', delay: 400,  duration: 3000 },
  { emoji: '🏓', left: '38%', delay: 200,  duration: 2800 },
  { emoji: '🎾', left: '55%', delay: 700,  duration: 2400 },
  { emoji: '💪', left: '70%', delay: 300,  duration: 3200 },
  { emoji: '🏆', left: '84%', delay: 600,  duration: 2700 },
];

function FloatingChar({ emoji, left, delay, duration }: { emoji: string; left: string; delay: number; duration: number }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity,    { toValue: 1,    duration: 300,    useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -110, duration,         useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        ]),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(800),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  // Use Animated.View + plain Text — Animated.Text suppresses emoji rendering
  // on some Android devices (variation-selector emoji show as boxes/question marks).
  return (
    <Animated.View
      style={[
        styles.floatCharWrap,
        { left: left as any, opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.floatChar}>{emoji}</Text>
    </Animated.View>
  );
}

export default function PostVerificationScreen() {
  const router = useRouter();

  const logoScale   = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ width: 44 }} />
        <TouchableOpacity
          onPress={() => router.push('/home')}
          activeOpacity={0.7}
          style={styles.closeBtn}
        >
          <X color={Colors.primary} size={28} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* Floating sport emojis behind logo */}
      <View style={styles.floatStage} pointerEvents="none">
        {SPORT_CHARS.map((c) => (
          <FloatingChar key={c.emoji} {...c} />
        ))}
      </View>

      {/* Centered logo */}
      <Animated.View
        style={[
          styles.logoWrap,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <View style={styles.logoBg}>
          <Image
            source={require('../../assets/logo.jpeg')}
            style={styles.logoImg}
            resizeMode="contain"
          />
        </View>
        <View style={styles.glowRing} />
      </Animated.View>

      {/* Text + CTA */}
      <Animated.View style={[styles.content, { opacity: textOpacity }]}>
        <View style={styles.verifiedRow}>
          <CheckCircle color={Colors.success} size={20} strokeWidth={2} />
          <Text style={styles.verifiedText}>Account Verified!</Text>
        </View>

        <Text style={styles.mainTitle}>Welcome to the{'\n'}Community!</Text>

        <Text style={styles.subtitle}>
          Whether you play, train, or compete — Paasxo is your home.{'\n'}
          Find games, book sessions, and connect with others.
        </Text>

        <Button
          title="Get Started"
          onPress={() => router.push('/home')}
          style={styles.ctaButton}
          icon={<ArrowRight color={Colors.white} size={20} strokeWidth={2.5} />}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  floatStage: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 80,
    height: 200,
  },
  floatCharWrap: {
    position: 'absolute',
    bottom: 0,
  },
  floatChar: {
    fontSize: Platform.OS === 'web' ? 28 : 32,
  },

  logoWrap: {
    alignSelf: 'center',
    marginTop: 40,
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBg: {
    width: 140,
    height: 140,
    borderRadius: 36,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
    overflow: 'hidden',
  },
  logoImg: {
    width: 140,
    height: 140,
    borderRadius: 36,
  },
  glowRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: Colors.primary + '50',
  },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.success + '18',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 20,
  },
  verifiedText: {
    color: Colors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  mainTitle: {
    fontSize: 38,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 46,
    letterSpacing: -0.8,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  ctaButton: {
    width: '100%',
  },
});
