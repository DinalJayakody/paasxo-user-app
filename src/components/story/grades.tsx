import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Blend = NonNullable<ViewStyle['mixBlendMode']>;

/** One layer of a grade: a flat colour or a gradient, composited with a blend mode. */
interface Layer {
  blend?: Blend;
  color?: string;
  gradient?: { colors: [string, string, ...string[]]; start?: { x: number; y: number }; end?: { x: number; y: number } };
  opacity?: number;
}

export interface Grade {
  key: string;
  label: string;
  /** Swatch tint for the picker when no thumbnail is available. */
  swatch: string;
  layers: Layer[];
}

const VIGNETTE: Layer = {
  blend: 'multiply',
  gradient: { colors: ['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.6)'] },
};

/**
 * Paasxo "grades" — sports-themed colour looks built from real blend modes
 * (multiply / screen / soft-light / colour / saturation), composited over the
 * photo or video at view time. The media file itself is never altered, so
 * quality is untouched and a grade costs no extra upload or storage.
 * Keys are stored on the story (filterName) — never rename one.
 */
export const GRADES: Grade[] = [
  { key: 'NORMAL', label: 'Original', swatch: '#6B7280', layers: [] },
  {
    key: 'MATCHDAY', label: 'Matchday', swatch: '#F97316',
    layers: [
      { blend: 'soft-light', color: '#FF6A00', opacity: 0.75 },
      { blend: 'overlay', gradient: { colors: ['#FFFFFF', '#000000'] }, opacity: 0.3 },
      VIGNETTE,
    ],
  },
  {
    key: 'FLOODLIGHTS', label: 'Floodlights', swatch: '#1E3A8A',
    layers: [
      { blend: 'multiply', color: '#2B4C9B', opacity: 0.55 },
      { blend: 'screen', gradient: { colors: ['rgba(220,235,255,0.65)', 'rgba(220,235,255,0)'], end: { x: 0.5, y: 0.55 } } },
      VIGNETTE,
    ],
  },
  {
    key: 'GOLDEN_HOUR', label: 'Golden Hour', swatch: '#F59E0B',
    layers: [
      { blend: 'soft-light', color: '#FFB347', opacity: 0.7 },
      { blend: 'screen', gradient: { colors: ['rgba(255,196,92,0.45)', 'rgba(255,196,92,0)'], end: { x: 0.6, y: 0.6 } } },
    ],
  },
  {
    key: 'TEAM_BLUE', label: 'Team Blue', swatch: '#2977C2',
    layers: [
      { blend: 'saturation', color: '#808080' },
      { blend: 'color', color: '#2977C2', opacity: 0.85 },
      { blend: 'screen', color: '#22D3EE', opacity: 0.12 },
    ],
  },
  {
    key: 'TURF', label: 'Turf', swatch: '#16A34A',
    layers: [
      { blend: 'soft-light', color: '#22C55E', opacity: 0.5 },
      { blend: 'soft-light', color: '#000000', opacity: 0.2 },
      VIGNETTE,
    ],
  },
  {
    key: 'ICE_BATH', label: 'Ice Bath', swatch: '#22D3EE',
    layers: [
      { blend: 'saturation', color: '#808080', opacity: 0.35 },
      { blend: 'soft-light', color: '#22D3EE', opacity: 0.6 },
      { blend: 'screen', color: '#0EA5E9', opacity: 0.1 },
    ],
  },
  {
    key: 'CLASSIC_MATCH', label: 'Classic Match', swatch: '#9CA3AF',
    layers: [
      { blend: 'saturation', color: '#808080' },
      { blend: 'soft-light', gradient: { colors: ['#FFFFFF', '#000000'] }, opacity: 0.45 },
      VIGNETTE,
    ],
  },
  {
    key: 'TROPHY', label: 'Trophy', swatch: '#B8860B',
    layers: [
      { blend: 'saturation', color: '#808080' },
      { blend: 'color', color: '#C9A15B', opacity: 0.75 },
      VIGNETTE,
    ],
  },
  {
    key: 'NIGHT_GAME', label: 'Night Game', swatch: '#A855F7',
    layers: [
      { blend: 'multiply', color: '#2E1B5B', opacity: 0.45 },
      { blend: 'screen', gradient: { colors: ['#C026D3', 'rgba(0,0,0,0)', '#06B6D4'], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }, opacity: 0.55 },
      VIGNETTE,
    ],
  },
];

// Stories posted before grades existed used flat tinted overlays.
const LEGACY_OVERLAY: Record<string, string> = {
  WARM: 'rgba(255,120,50,0.20)',
  COOL: 'rgba(30,100,255,0.20)',
  ROSE: 'rgba(255,50,120,0.18)',
  FADE: 'rgba(255,255,255,0.28)',
  DRAMA: 'rgba(0,0,0,0.22)',
  GREEN: 'rgba(50,200,100,0.15)',
};

const BY_KEY = new Map(GRADES.map((g) => [g.key, g]));

// Blend modes need Android 10+ (API 29). Below that a blend layer would draw
// as a plain opaque/tinted sheet over the photo, so grades are skipped there.
export const GRADES_SUPPORTED = Platform.OS !== 'android' || (typeof Platform.Version === 'number' && Platform.Version >= 29);

/** The grade's layers, stacked over whatever sits beneath in the same (isolated) parent. */
export function GradeLayers({ gradeKey }: { gradeKey?: string | null }) {
  if (!gradeKey || gradeKey === 'NORMAL') return null;
  const legacy = LEGACY_OVERLAY[gradeKey];
  if (legacy) return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: legacy }]} />;
  const grade = BY_KEY.get(gradeKey);
  if (!grade || !GRADES_SUPPORTED) return null;
  return (
    <>
      {grade.layers.map((l, i) => {
        const base: ViewStyle = { ...StyleSheet.absoluteFillObject, mixBlendMode: l.blend, opacity: l.opacity ?? 1 };
        return l.gradient ? (
          <LinearGradient
            key={i}
            pointerEvents="none"
            colors={l.gradient.colors}
            start={l.gradient.start ?? { x: 0.5, y: 0 }}
            end={l.gradient.end ?? { x: 0.5, y: 1 }}
            style={base}
          />
        ) : (
          <View key={i} pointerEvents="none" style={[base, { backgroundColor: l.color }]} />
        );
      })}
    </>
  );
}
