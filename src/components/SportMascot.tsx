import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { Colors } from '../styles/colors';

type Sport = 'FUTSAL' | 'CRICKET' | 'PICKLEBALL' | 'GENERAL';
type MascotMood = 'idle' | 'excited' | 'thinking' | 'celebrating' | 'waving';

const MASCOT_CONFIG: Record<Sport, { emoji: string; color: string; lightColor: string; name: string }> = {
  FUTSAL: { emoji: '⚽', color: Colors.futsal, lightColor: Colors.futsalLight, name: 'Footy' },
  CRICKET: { emoji: '🏏', color: Colors.cricket, lightColor: Colors.cricketLight, name: 'Crick' },
  PICKLEBALL: { emoji: '🏓', color: Colors.pickleball, lightColor: Colors.pickleballLight, name: 'Pickle' },
  GENERAL: { emoji: '🏅', color: Colors.primary, lightColor: Colors.primaryLight, name: 'Paasxo' },
};

const MOOD_EMOJI: Record<MascotMood, string> = {
  idle: '😊',
  excited: '🤩',
  thinking: '🤔',
  celebrating: '🎉',
  waving: '👋',
};

interface SportMascotProps {
  sport?: Sport;
  mood?: MascotMood;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  onPress?: () => void;
  autoAnimate?: boolean;
}

export function SportMascot({
  sport = 'GENERAL',
  mood = 'idle',
  message,
  size = 'md',
  onPress,
  autoAnimate = true,
}: SportMascotProps) {
  const config = MASCOT_CONFIG[sport];
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const bubbleSlide = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (!autoAnimate) return;

    // Bounce animation
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.spring(bounceAnim, { toValue: -8, friction: 4, tension: 80, useNativeDriver: true }),
        Animated.spring(bounceAnim, { toValue: 0, friction: 4, tension: 80, useNativeDriver: true }),
      ])
    );

    // Wave arm animation
    const wave = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: -1, duration: 400, useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.delay(1500),
      ])
    );

    bounce.start();
    if (mood === 'waving' || mood === 'excited') wave.start();

    return () => {
      bounce.stop();
      wave.stop();
    };
  }, [mood, autoAnimate]);

  useEffect(() => {
    if (!message) return;
    Animated.parallel([
      Animated.timing(bubbleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(bubbleSlide, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [message]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.25, duration: 100, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onPress?.();
  };

  const sizeMap = { sm: 48, md: 72, lg: 96 };
  const emojiSize = { sm: 22, md: 36, lg: 52 };
  const badgeSize = { sm: 18, md: 24, lg: 32 };
  const avatarSize = sizeMap[size];

  return (
    <View style={styles.wrapper}>
      {/* Speech bubble */}
      {message && (
        <Animated.View
          style={[
            styles.speechBubble,
            { borderColor: config.color + '50', opacity: bubbleOpacity, transform: [{ translateY: bubbleSlide }] },
          ]}
        >
          <Text style={styles.speechText}>{message}</Text>
          <View style={[styles.bubbleTail, { borderTopColor: Colors.white }]} />
        </Animated.View>
      )}

      {/* Mascot avatar */}
      <Pressable onPress={handlePress}>
        <Animated.View
          style={[
            styles.avatarContainer,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              backgroundColor: config.lightColor,
              borderColor: config.color + '50',
              transform: [
                { translateY: bounceAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          <Text style={{ fontSize: emojiSize[size] }}>{config.emoji}</Text>

          {/* Mood badge */}
          <Animated.View
            style={[
              styles.moodBadge,
              {
                width: badgeSize[size],
                height: badgeSize[size],
                borderRadius: badgeSize[size] / 2,
                transform: [
                  { rotate: waveAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-20deg', '20deg'] }) },
                ],
              },
            ]}
          >
            <Text style={{ fontSize: badgeSize[size] * 0.55 }}>{MOOD_EMOJI[mood]}</Text>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

// Inline guide tip with mascot
interface MascotTipProps {
  sport?: Sport;
  message: string;
  title?: string;
  mood?: MascotMood;
}

export function MascotTip({ sport = 'GENERAL', message, title, mood = 'waving' }: MascotTipProps) {
  const config = MASCOT_CONFIG[sport];
  const slideAnim = useRef(new Animated.Value(20)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.tipContainer,
        { borderLeftColor: config.color, opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <SportMascot sport={sport} mood={mood} size="sm" autoAnimate />
      <View style={styles.tipTextBlock}>
        {title && <Text style={[styles.tipTitle, { color: config.color }]}>{title}</Text>}
        <Text style={styles.tipMessage}>{message}</Text>
      </View>
    </Animated.View>
  );
}

// Celebration mascot (shown on score / match complete)
interface CelebrationMascotProps {
  sport?: Sport;
  winnerName?: string;
  visible: boolean;
}

export function CelebrationMascot({ sport = 'GENERAL', winnerName, visible }: CelebrationMascotProps) {
  const config = MASCOT_CONFIG[sport];
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) { scaleAnim.setValue(0); return; }
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.2, friction: 4, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: -1, duration: 300, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.delay(600),
      ])
    ).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.celebrationContainer,
        {
          transform: [
            { scale: scaleAnim },
            { rotate: rotateAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-15deg', '15deg'] }) },
          ],
        },
      ]}
    >
      <Text style={styles.celebrationEmoji}>{config.emoji}</Text>
      <Text style={styles.celebrationText}>🎉</Text>
      {winnerName && (
        <Text style={[styles.celebrationWinner, { color: config.color }]}>{winnerName} wins!</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },

  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  moodBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  speechBubble: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 12,
    maxWidth: 220,
    marginBottom: 10,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    alignItems: 'center',
  },
  speechText: {
    fontSize: 13,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 19,
    fontWeight: '500',
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },

  // Mascot tip strip
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 8,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  tipTextBlock: { flex: 1 },
  tipTitle: { fontSize: 13, fontWeight: '800', marginBottom: 3 },
  tipMessage: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },

  // Celebration
  celebrationContainer: { alignItems: 'center', gap: 4 },
  celebrationEmoji: { fontSize: 64 },
  celebrationText: { fontSize: 36, marginTop: -12 },
  celebrationWinner: { fontSize: 18, fontWeight: '900', marginTop: 6 },
});
