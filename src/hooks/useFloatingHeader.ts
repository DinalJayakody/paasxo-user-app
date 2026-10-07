import { useCallback, useEffect, useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Instagram/Facebook-style header behavior: fully slides away as soon as the
 * user scrolls down, snaps fully back as soon as they scroll up — not a
 * value tracked 1:1 with scroll position (that leaves the header partially
 * visible unless the user scrolls exactly `hideDistance` worth), but a
 * direction-based snap animated with Animated.timing.
 *
 * Usage:
 *   const { translateY, onScroll } = useFloatingHeader(HEADER_HIDE_DISTANCE);
 *   <Animated.View style={{ transform: [{ translateY }] }}>
 *   <ScrollView onScroll={onScroll} scrollEventThrottle={16}>
 *
 * `hideDistance` must be the FULL distance the header needs to travel to be
 * completely off-screen — including any top safe-area inset it's anchored
 * below, not just its own rendered height — otherwise it stops short and a
 * sliver stays visible.
 *
 * `extraOnScroll` lets a screen keep its own onScroll logic (e.g.
 * infinite-scroll pagination) alongside the hide/show tracking here.
 *
 * `disabled` forces the header shown and ignores scroll direction entirely
 * — for screens where the header hosts its own interactive content (e.g. an
 * expanding search panel on Feed) that shouldn't be able to scroll away
 * while the user is using it.
 */

// Ignore scroll deltas smaller than this — momentum settling and small
// finger jitter shouldn't flip the header's direction back and forth.
const DIRECTION_THRESHOLD = 8;

export function useFloatingHeader(hideDistance: number, extraOnScroll?: (e: any) => void, disabled?: boolean) {
  const translateY = useRef(new Animated.Value(0)).current;
  const lastOffsetY = useRef(0);
  const direction = useRef<'up' | 'down'>('up');

  // Mirrors the ref-indirection pattern below for extraOnScroll: onScroll is
  // built once (useRef) so its identity is stable for the ScrollView prop,
  // but it must always read the CURRENT hideDistance, not the one captured
  // when the ref was created (hideDistance itself is derived from an
  // on-device measurement that settles a render or two after mount).
  const hideDistanceRef = useRef(hideDistance);
  useEffect(() => { hideDistanceRef.current = hideDistance; }, [hideDistance]);

  const extraOnScrollRef = useRef(extraOnScroll);
  useEffect(() => { extraOnScrollRef.current = extraOnScroll; }, [extraOnScroll]);

  const disabledRef = useRef(disabled);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);

  const show = useCallback(() => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const hide = useCallback(() => {
    Animated.timing(translateY, {
      toValue: -hideDistanceRef.current,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  // Snap back to shown as soon as `disabled` turns on (e.g. the moment
  // search opens), rather than waiting for the next scroll event.
  useEffect(() => {
    if (disabled) {
      direction.current = 'up';
      show();
    }
  }, [disabled, show]);

  const onScroll = useRef((e: any) => {
    const y: number = e?.nativeEvent?.contentOffset?.y ?? 0;
    const delta = y - lastOffsetY.current;
    lastOffsetY.current = y;

    if (disabledRef.current) {
      extraOnScrollRef.current?.(e);
      return;
    }

    // Always keep the header visible near the top of the list — matches
    // Instagram/Facebook, and avoids it staying hidden while iOS's elastic
    // overscroll bounces contentOffset.y around 0.
    if (y <= 0) {
      if (direction.current !== 'up') {
        direction.current = 'up';
        show();
      }
    } else if (delta > DIRECTION_THRESHOLD && direction.current !== 'down') {
      direction.current = 'down';
      hide();
    } else if (delta < -DIRECTION_THRESHOLD && direction.current !== 'up') {
      direction.current = 'up';
      show();
    }

    extraOnScrollRef.current?.(e);
  }).current;

  return { translateY, onScroll, show };
}
