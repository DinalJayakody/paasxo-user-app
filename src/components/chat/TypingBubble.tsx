import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { ThemeColors } from '../../styles/colors';
import { ChatAvatar } from './ChatAvatar';

/** "…" bubble with three bouncing dots while the other person types. */
export function TypingBubble({ colors, avatar, name }: { colors: ThemeColors; avatar?: string | null; name: string }) {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((d, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 150),
      Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.delay((2 - i) * 150 + 200),
    ])));
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={s.row} accessibilityLabel={`${name} is typing`}>
      <View style={{ width: 34 }}><ChatAvatar uri={avatar} name={name} size={28} ringColor={colors.background} /></View>
      <View style={[s.bubble, { backgroundColor: colors.cardBg, borderColor: colors.neutral200 }]}>
        {dots.map((d, i) => (
          <Animated.View
            key={i}
            style={[s.dot, { backgroundColor: colors.textMuted, transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }]}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, marginTop: 8 },
  bubble: { flexDirection: 'row', gap: 5, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
});
