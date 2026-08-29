import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { PaasxoLogoLoader } from './PaasxoLogoLoader';

interface Props {
  refreshing: boolean;
  /** Distance from the top of the scroll container — tune per-screen if
   *  there's a custom header the badge should sit below. */
  top?: number;
}

/**
 * The branded "Paasxo logo is now spinning" moment of pull-to-refresh.
 * Render as a sibling positioned above the ScrollView/FlatList (which needs
 * `refreshControl={<PaasxoRefreshControl .../>}`), inside a `position:
 * 'relative'` container. Fades and pops in the instant `refreshing` goes
 * true, fades out when the fetch completes — see PaasxoRefreshControl for
 * why this exists as a separate overlay rather than a customized
 * RefreshControl.
 */
export function PaasxoRefreshLogo({ refreshing, top = 8 }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: refreshing ? 1 : 0, duration: refreshing ? 200 : 260, useNativeDriver: true }),
      Animated.spring(scale, { toValue: refreshing ? 1 : 0.7, friction: 6, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [refreshing, opacity, scale]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        { top, opacity, transform: [{ scale }] },
      ]}
    >
      <PaasxoLogoLoader size={34} elevated />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
});
