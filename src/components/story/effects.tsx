import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';
import { STORY_FONT } from './storyFonts';

type Motion = 'fall' | 'rise' | 'bounce' | 'float' | 'twinkle' | 'confetti';

export interface EffectDef {
  key: string;
  label: string;
  /** Picker icon. */
  icon: string;
  glyphs: string[];
  motion: Motion;
  count: number;
  size: [number, number];
  durationMs: [number, number];
  spin?: number; // full turns per fall
  banner?: string; // big animated headline (e.g. GOAL!)
}

/**
 * Animated sports overlays played over a story. Keys are stored on the story
 * (effect) — never rename one; unknown keys simply render nothing.
 */
export const EFFECTS: EffectDef[] = [
  { key: 'GOAL', label: 'Goal!', icon: '🥅', glyphs: ['⚽'], motion: 'fall', count: 9, size: [24, 34], durationMs: [3800, 5600], spin: 1.5, banner: 'GOAL!' },
  { key: 'FOOTBALL', label: 'Football', icon: '⚽', glyphs: ['⚽'], motion: 'fall', count: 14, size: [22, 40], durationMs: [3800, 6400], spin: 1.5 },
  { key: 'CRICKET', label: 'Cricket', icon: '🏏', glyphs: ['🏏', '🔴'], motion: 'fall', count: 13, size: [20, 36], durationMs: [4000, 6600], spin: 1 },
  { key: 'BASKETBALL', label: 'Hoops', icon: '🏀', glyphs: ['🏀'], motion: 'bounce', count: 7, size: [30, 44], durationMs: [3000, 4200] },
  { key: 'TENNIS', label: 'Tennis', icon: '🎾', glyphs: ['🎾'], motion: 'bounce', count: 9, size: [22, 32], durationMs: [2600, 3800] },
  { key: 'BADMINTON', label: 'Badminton', icon: '🏸', glyphs: ['🏸'], motion: 'float', count: 11, size: [24, 38], durationMs: [5200, 8000] },
  { key: 'PADDLE', label: 'Paddle', icon: '🏓', glyphs: ['🏓'], motion: 'fall', count: 12, size: [22, 36], durationMs: [4000, 6400], spin: 1.2 },
  { key: 'VOLLEYBALL', label: 'Volleyball', icon: '🏐', glyphs: ['🏐'], motion: 'bounce', count: 8, size: [28, 40], durationMs: [3000, 4200] },
  { key: 'RUGBY', label: 'Rugby', icon: '🏉', glyphs: ['🏉'], motion: 'fall', count: 11, size: [24, 38], durationMs: [3800, 6000], spin: 2 },
  { key: 'RUN', label: 'Run', icon: '👟', glyphs: ['👟', '⚡'], motion: 'rise', count: 12, size: [20, 34], durationMs: [3600, 6000] },
  { key: 'GYM', label: 'Gym', icon: '💪', glyphs: ['💪', '🏋️'], motion: 'rise', count: 11, size: [22, 36], durationMs: [3800, 6200] },
  { key: 'SWIM', label: 'Swim', icon: '💧', glyphs: ['💧', '⚪'], motion: 'rise', count: 16, size: [14, 34], durationMs: [4200, 7200] },
  { key: 'CYCLING', label: 'Ride', icon: '🚴', glyphs: ['🚴', '💨'], motion: 'float', count: 9, size: [22, 34], durationMs: [5200, 7600] },
  { key: 'CHAMPIONS', label: 'Champions', icon: '🏆', glyphs: ['🏆', '🥇', '⭐'], motion: 'fall', count: 14, size: [20, 36], durationMs: [4200, 6800], spin: 0.4 },
  { key: 'CONFETTI', label: 'Confetti', icon: '🎉', glyphs: [], motion: 'confetti', count: 26, size: [7, 11], durationMs: [3400, 6000] },
  { key: 'ON_FIRE', label: 'On Fire', icon: '🔥', glyphs: ['🔥'], motion: 'rise', count: 13, size: [20, 38], durationMs: [3200, 5200] },
  { key: 'FLASHES', label: 'Stadium', icon: '📸', glyphs: [], motion: 'twinkle', count: 16, size: [10, 22], durationMs: [900, 1700] },
];

const BY_KEY = new Map(EFFECTS.map((e) => [e.key, e]));
const CONFETTI_COLORS = ['#22D3EE', '#2977C2', '#FACC15', '#F472B6', '#A3E635', '#FB923C', '#FFFFFF'];

/** Small seeded PRNG so the same effect lays out the same way in the composer and the viewer. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

interface ParticleSpec {
  x: number; size: number; duration: number; delay: number; glyph: string; sway: number; spin: number; color: string; y: number;
}

const Particle = memo(function Particle({ spec, motion, W, H }: { spec: ParticleSpec; motion: Motion; W: number; H: number }) {
  const p = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(spec.delay),
      Animated.loop(Animated.timing(p, {
        toValue: 1, duration: spec.duration, easing: Easing.linear, useNativeDriver: true,
      })),
    ]);
    anim.start();
    return () => anim.stop();
  }, [p, spec.delay, spec.duration]);

  const sway = spec.sway;
  let transform: any[];
  let opacity: any = 1;

  switch (motion) {
    case 'rise':
      transform = [
        { translateX: p.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, sway, 0, -sway, 0] }) },
        { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [H + 40, -60] }) },
        { scale: p.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.4, 1, 1.1] }) },
      ];
      opacity = p.interpolate({ inputRange: [0, 0.08, 0.8, 1], outputRange: [0, 1, 0.9, 0] });
      break;
    case 'bounce': {
      const floor = H * 0.8;
      transform = [
        { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, sway * 3] }) },
        {
          translateY: p.interpolate({
            inputRange: [0, 0.3, 0.45, 0.6, 0.7, 0.8, 0.86, 0.92, 1],
            outputRange: [-70, floor, floor - H * 0.3, floor, floor - H * 0.13, floor, floor - H * 0.05, floor, floor],
          }),
        },
        { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${sway > 0 ? 540 : -540}deg`] }) },
      ];
      opacity = p.interpolate({ inputRange: [0, 0.9, 1], outputRange: [1, 1, 0] });
      break;
    }
    case 'float':
      transform = [
        { translateX: p.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, sway * 2, 0, -sway * 2, 0] }) },
        { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [-70, H + 70] }) },
        { rotate: p.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['-20deg', '20deg', '-20deg', '20deg', '-20deg'] }) },
      ];
      break;
    case 'twinkle':
      transform = [
        { translateX: 0 },
        { translateY: spec.y },
        { scale: p.interpolate({ inputRange: [0, 0.15, 0.4, 1], outputRange: [0.2, 1.4, 0.3, 0.2] }) },
      ];
      opacity = p.interpolate({ inputRange: [0, 0.12, 0.4, 1], outputRange: [0, 1, 0, 0] });
      break;
    case 'confetti':
      transform = [
        { translateX: p.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, sway, 0, -sway, 0] }) },
        { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [-30, H + 30] }) },
        { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${spec.spin * 360}deg`] }) },
        { scaleX: p.interpolate({ inputRange: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1], outputRange: [1, -1, 1, -1, 1, -1, 1, -1, 1] }) },
      ];
      break;
    case 'fall':
    default:
      transform = [
        { translateX: p.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, sway, 0, -sway, 0] }) },
        { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [-70, H + 70] }) },
        { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${spec.spin * 360}deg`] }) },
      ];
  }

  if (motion === 'confetti') {
    return (
      <Animated.View
        style={[s.particle, { left: spec.x, width: spec.size, height: spec.size * 1.6, backgroundColor: spec.color, borderRadius: 2, opacity, transform }]}
      />
    );
  }
  if (motion === 'twinkle') {
    return (
      <Animated.View style={[s.particle, { left: spec.x, top: 0, opacity, transform }]}>
        <View style={[s.flashHalo, { width: spec.size * 3, height: spec.size * 3, borderRadius: spec.size * 1.5, marginLeft: -spec.size, marginTop: -spec.size }]} />
        <View style={[s.flashCore, { width: spec.size, height: spec.size, borderRadius: spec.size / 2, position: 'absolute' }]} />
      </Animated.View>
    );
  }
  return (
    <Animated.Text allowFontScaling={false} style={[s.particle, { left: spec.x, fontSize: spec.size, opacity, transform }]}>
      {spec.glyph}
    </Animated.Text>
  );
});

function GoalBanner({ text, fontsReady }: { text: string; fontsReady: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(2.2)), useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(v, { toValue: 2, duration: 350, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.delay(700),
    ]));
    anim.start();
    return () => anim.stop();
  }, [v]);
  return (
    <View style={s.bannerWrap} pointerEvents="none">
      <Animated.Text
        allowFontScaling={false}
        style={[
          s.banner,
          fontsReady ? { fontFamily: STORY_FONT.stadium } : { fontWeight: '900' },
          {
            opacity: v.interpolate({ inputRange: [0, 0.2, 1, 1.6, 2], outputRange: [0, 1, 1, 0.6, 0] }),
            transform: [
              { scale: v.interpolate({ inputRange: [0, 1, 2], outputRange: [0.3, 1, 1.6] }) },
              { rotate: '-6deg' },
            ],
          },
        ]}
      >
        {text}
      </Animated.Text>
    </View>
  );
}

/**
 * Plays an effect over the story. Lightweight by design: ≤ 26 particles, all
 * animated on the native thread (no JS work per frame), stopped on unmount.
 */
export const StoryEffectLayer = memo(function StoryEffectLayer({
  effectKey, fontsReady, width, height,
}: { effectKey?: string | null; fontsReady: boolean; width?: number; height?: number }) {
  const def = effectKey ? BY_KEY.get(effectKey) : undefined;
  const { width: winW, height: winH } = Dimensions.get('window');
  const W = width ?? winW;
  const H = height ?? winH;

  const specs = useMemo<ParticleSpec[]>(() => {
    if (!def) return [];
    const rnd = mulberry32(hash(def.key));
    return Array.from({ length: def.count }, (_, i) => {
      const size = def.size[0] + rnd() * (def.size[1] - def.size[0]);
      const duration = def.durationMs[0] + rnd() * (def.durationMs[1] - def.durationMs[0]);
      return {
        x: rnd() * (W - size),
        y: H * (0.05 + rnd() * 0.55),
        size,
        duration,
        // Spread first appearances over one cycle so they don't all start together.
        delay: def.motion === 'twinkle' ? rnd() * 2400 : (i / def.count) * duration * 0.9,
        glyph: def.glyphs.length ? def.glyphs[Math.floor(rnd() * def.glyphs.length)] : '',
        sway: (8 + rnd() * 26) * (rnd() > 0.5 ? 1 : -1),
        spin: (def.spin ?? 2) * (0.6 + rnd() * 0.8) * (rnd() > 0.5 ? 1 : -1),
        color: CONFETTI_COLORS[Math.floor(rnd() * CONFETTI_COLORS.length)],
      };
    });
  }, [def, W, H]);

  if (!def) return null;
  return (
    <View style={[StyleSheet.absoluteFill, s.clip]} pointerEvents="none">
      {specs.map((spec, i) => (
        <Particle key={i} spec={spec} motion={def.motion} W={W} H={H} />
      ))}
      {def.banner && <GoalBanner text={def.banner} fontsReady={fontsReady} />}
    </View>
  );
});

const s = StyleSheet.create({
  clip: { overflow: 'hidden' },
  particle: { position: 'absolute', top: 0 },
  flashHalo: { backgroundColor: 'rgba(255,255,255,0.28)' },
  flashCore: { backgroundColor: '#FFFFFF' },
  bannerWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  banner: {
    fontSize: 104, color: '#FFFFFF', letterSpacing: 2,
    textShadowColor: '#2977C2', textShadowOffset: { width: 4, height: 4 }, textShadowRadius: 0,
  },
});
