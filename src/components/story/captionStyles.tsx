import React from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { STORY_FONT } from './storyFonts';

export type CaptionStyleKey = 'CLASSIC' | 'STADIUM' | 'SCOREBOARD' | 'MARKER' | 'NEON' | 'BADGE';

/** Mirrors StoryService.CAPTION_STYLES on the server. */
export const CAPTION_STYLES: { key: CaptionStyleKey; label: string }[] = [
  { key: 'CLASSIC', label: 'Classic' },
  { key: 'STADIUM', label: 'Stadium' },
  { key: 'SCOREBOARD', label: 'Scoreboard' },
  { key: 'MARKER', label: 'Coach' },
  { key: 'NEON', label: 'Neon' },
  { key: 'BADGE', label: 'Badge' },
];

export const CAPTION_COLORS = [
  '#FFFFFF', '#0B0F14', '#2977C2', '#22D3EE', '#A3E635',
  '#FACC15', '#FB923C', '#EF4444', '#F472B6', '#A78BFA',
];

export const CAPTION_SCALES = [0.7, 0.85, 1, 1.2, 1.45, 1.75];

export function normaliseCaptionStyle(v?: string | null): CaptionStyleKey {
  return (CAPTION_STYLES.some((s) => s.key === v) ? v : 'CLASSIC') as CaptionStyleKey;
}

/** Black or white — whichever reads better on `hex`. */
export function contrastOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#0B0F14' : '#FFFFFF';
}

function darken(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (c: number) => Math.max(0, Math.round(c * (1 - amount))).toString(16).padStart(2, '0');
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

export interface CaptionLook {
  container: ViewStyle;
  text: TextStyle;
  /** Behind-the-text glow layer (Neon / Scoreboard). */
  glow?: TextStyle;
  gradient?: [string, string];
  uppercase: boolean;
}

/**
 * The single definition of how each caption style looks — used by the
 * composer's live editor (TextInput) and by the viewer (Text), so what you
 * type is exactly what people see.
 */
export function captionLook(style: CaptionStyleKey, color: string, scale: number, fontsReady: boolean): CaptionLook {
  const s = Math.max(0.6, Math.min(2.2, scale || 1));
  const font = (f: string) => (fontsReady ? { fontFamily: f } : { fontWeight: '900' as const });
  switch (style) {
    case 'STADIUM':
      // Broadcast lower-third: condensed caps on a slanted colour block.
      return {
        uppercase: true,
        container: {
          backgroundColor: color, paddingHorizontal: 14 * s, paddingVertical: 4 * s, borderRadius: 4,
          transform: [{ skewX: '-8deg' }],
        },
        text: { ...font(STORY_FONT.stadium), fontSize: 40 * s, letterSpacing: 1.5, color: contrastOn(color), textAlign: 'center' },
      };
    case 'SCOREBOARD':
      // LED scoreboard panel with glowing digits.
      return {
        uppercase: true,
        container: {
          backgroundColor: 'rgba(8,12,18,0.88)', paddingHorizontal: 14 * s, paddingVertical: 8 * s,
          borderRadius: 10, borderWidth: 1.5, borderColor: color + '99',
        },
        text: {
          ...font(STORY_FONT.scoreboard), fontSize: 20 * s, letterSpacing: 2.5, color, textAlign: 'center',
          textShadowColor: color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10,
        },
      };
    case 'MARKER':
      // Coach's whiteboard marker, slightly tilted.
      return {
        uppercase: false,
        container: { transform: [{ rotate: '-4deg' }] },
        text: {
          ...font(STORY_FONT.marker), fontSize: 32 * s, color, textAlign: 'center',
          textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 3,
        },
      };
    case 'NEON':
      return {
        uppercase: false,
        container: { paddingHorizontal: 6 },
        text: {
          ...font(STORY_FONT.neon), fontSize: 32 * s, color: '#FFFFFF', textAlign: 'center',
          textShadowColor: color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
        },
      };
    case 'BADGE':
      return {
        uppercase: false,
        gradient: [color, darken(color, 0.35)],
        container: { paddingHorizontal: 18 * s, paddingVertical: 9 * s, borderRadius: 999 },
        text: { fontSize: 20 * s, fontWeight: '900', color: contrastOn(color), textAlign: 'center' },
      };
    case 'CLASSIC':
    default:
      return {
        uppercase: false,
        container: {},
        text: {
          fontSize: 26 * s, fontWeight: '900', color, textAlign: 'center',
          textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5,
        },
      };
  }
}

/** A caption rendered in its chosen look (read-only). */
export function StoryCaption({
  text, color, styleKey, scale, fontsReady, maxWidth,
}: {
  text: string;
  color: string;
  styleKey: CaptionStyleKey;
  scale: number;
  fontsReady: boolean;
  maxWidth?: number;
}) {
  const look = captionLook(styleKey, color, scale, fontsReady);
  const shown = look.uppercase ? text.toUpperCase() : text;
  const body = (
    <View>
      {look.glow && <Text style={[look.glow, StyleSheet.absoluteFillObject]} allowFontScaling={false}>{shown}</Text>}
      <Text style={look.text} allowFontScaling={false}>{shown}</Text>
    </View>
  );
  if (look.gradient) {
    return (
      <LinearGradient colors={look.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[look.container, maxWidth ? { maxWidth } : null]}>
        {body}
      </LinearGradient>
    );
  }
  return <View style={[look.container, maxWidth ? { maxWidth } : null]}>{body}</View>;
}
