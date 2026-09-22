import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Instagram/Twitter-style header behavior: hides as the user scrolls down,
 * reappears as soon as they scroll up (not gated behind a distance
 * threshold — it tracks the scroll gesture 1:1 via Animated.diffClamp, the
 * standard RN technique for this exact effect). Runs entirely on the native
 * thread (useNativeDriver), so it stays smooth even while JS is busy
 * loading content.
 *
 * Usage:
 *   const { translateY, onScroll } = useFloatingHeader(HEADER_HEIGHT);
 *   <Animated.View style={[styles.header, { transform: [{ translateY }] }]}>
 *   <ScrollView onScroll={onScroll} scrollEventThrottle={16}>
 *
 * `extraOnScroll` lets a screen keep its own onScroll logic (e.g.
 * infinite-scroll pagination) without fighting over the ScrollView's single
 * onScroll prop — it's threaded through Animated.event's own `listener`
 * option rather than composed by the caller, so both fire off the same
 * native scroll events.
 */
export function useFloatingHeader(headerHeight: number, extraOnScroll?: (e: any) => void) {
  const scrollY = useRef(new Animated.Value(0)).current;

  // Accumulates scroll delta clamped to [0, headerHeight] regardless of how
  // far past that the actual content scrolls — this is what makes the
  // header retreat/return in exact lockstep with the gesture instead of a
  // fixed-duration slide animation that would drift out of sync with fast
  // flicks.
  const clampedScroll = useRef(Animated.diffClamp(scrollY, 0, headerHeight)).current;

  const translateY = clampedScroll.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [0, -headerHeight],
    extrapolate: 'clamp',
  });

  // Animated.event's own listener closes over whatever function it was
  // built with at creation time — since that object is only ever built
  // once (below), a mutable ref indirection keeps it calling the CURRENT
  // extraOnScroll on every scroll event rather than a stale one captured
  // from the first render (extraOnScroll is typically a useCallback whose
  // identity changes as its own dependencies change).
  const extraOnScrollRef = useRef(extraOnScroll);
  useEffect(() => { extraOnScrollRef.current = extraOnScroll; }, [extraOnScroll]);

  const onScroll = useRef(
    Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: true, listener: (e: any) => extraOnScrollRef.current?.(e) }
    )
  ).current;

  return { translateY, onScroll };
}
