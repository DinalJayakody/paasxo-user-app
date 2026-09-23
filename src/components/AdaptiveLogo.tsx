import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * The Paasxo logo mark, transparent-background, in whichever of the two
 * pre-rendered color variants reads clearly against the current theme —
 * doc section 2.2: "If the logo is not sufficiently visible: blue for
 * light mode, white for dark mode." Both PNGs share the exact same alpha
 * channel (see logo-mark-blue.png's generation — a direct recolor of
 * logo-mark.png, not a separate asset), so they're pixel-for-pixel
 * interchangeable at any size.
 *
 * Only for screens with a plain/adaptive background (sign-in, sign-up).
 * The colored gradient headers elsewhere (Home/Feed/Explore) intentionally
 * keep using logo-mark.png directly — white is correct there regardless of
 * system theme, since the header itself is always the same colored
 * gradient, not the adaptive system background this component is for.
 */
export function AdaptiveLogo({ style }: { style?: StyleProp<ImageStyle> }) {
  const { resolvedTheme } = useTheme();
  const source = resolvedTheme === 'dark'
    ? require('../../assets/logo-mark.png')
    : require('../../assets/logo-mark-blue.png');
  return <Image source={source} style={style} resizeMode="contain" />;
}
