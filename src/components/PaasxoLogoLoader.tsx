import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';

interface Props {
  size?: number;
  /** Ring + shadow are nice on a full screen but too heavy for a small
   *  pull-to-refresh badge — set false there. */
  elevated?: boolean;
}

/**
 * The one animated "brand mark" used everywhere the app shows a loading
 * state — pull-to-refresh, full-screen loaders, anywhere an ActivityIndicator
 * used to be. Spinning the logo itself reads badly (a lettermark tumbling
 * end over end looks broken, not "loading"), so instead: the mark stays
 * upright and breathes gently, while a ring — the universally understood
 * "in progress" shape — spins around it.
 */
export function PaasxoLogoLoader({ size = 56, elevated = true }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    spinLoop.start();
    pulseLoop.start();
    return () => {
      spinLoop.stop();
      pulseLoop.stop();
    };
  }, [spin, pulse]);

  const rotation = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });
  const ringSize = size + 20;
  const logoSize = size * 0.62;

  return (
    <View style={[styles.wrap, { width: ringSize, height: ringSize }]}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            transform: [{ rotate: rotation }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{ scale }],
          },
          elevated && styles.badgeElevated,
        ]}
      >
        <Image
          source={require('../../assets/logo.jpeg')}
          style={{ width: logoSize, height: logoSize, borderRadius: logoSize * 0.22 }}
          resizeMode="cover"
        />
      </Animated.View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: colors.primary + '25',
    borderTopColor: colors.primary,
    borderRightColor: colors.primary,
  },
  badge: {
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeElevated: {
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
