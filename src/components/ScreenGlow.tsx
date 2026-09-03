import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

/** Full-bleed ambient backdrop dropped behind every screen's content: a
 *  smooth top-to-bottom brand-blue tint (monotonic — it never dips back to
 *  100%-opacity flat background mid-screen, which previously read as a hard
 *  seam between a "blue section" and a "white section") plus a soft radial
 *  glow near the top for a "glassy/glowing" feel when cards float over it.
 *  Pure SVG (react-native-svg, already a project dependency) — a single
 *  native view, no images/blur layers, so it's cheap to mount on every
 *  screen. Render as the FIRST child of a screen's root container, sized to
 *  that container's FULL bounds (not just the visible/scrollable area) with
 *  `position: 'absolute'` fill; leave that container's own `backgroundColor:
 *  colors.background` in place as the base underneath. */
export default function ScreenGlow() {
  const { colors } = useTheme();

  return (
    <Svg style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Defs>
        <LinearGradient id="screenWash" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.22} />
          <Stop offset="55%" stopColor={colors.primary} stopOpacity={0.1} />
          <Stop offset="100%" stopColor={colors.primary} stopOpacity={0.07} />
        </LinearGradient>
        <RadialGradient id="screenGlow" cx="50%" cy="0%" rx="85%" ry="46%">
          <Stop offset="0%" stopColor={colors.primaryAccent} stopOpacity={0.28} />
          <Stop offset="100%" stopColor={colors.primaryAccent} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#screenWash)" />
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#screenGlow)" />
    </Svg>
  );
}
