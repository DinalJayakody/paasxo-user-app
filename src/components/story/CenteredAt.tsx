import React, { useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

/**
 * Places children with their CENTRE at a normalised (0-1) point of the
 * screen — the anchor the story/reel composer saves — measured on layout so
 * it stays exact for any text length, font or device size.
 */
export function CenteredAt({
  x, y, children, maxWidth, onPressable = false,
}: { x: number; y: number; children: React.ReactNode; maxWidth?: number; onPressable?: boolean }) {
  const { width: W, height: H } = Dimensions.get('window');
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const cx = Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0.5;
  const cy = Number.isFinite(y) ? Math.min(1, Math.max(0, y)) : 0.5;
  return (
    <View
      pointerEvents={onPressable ? 'box-none' : 'none'}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (!size || Math.abs(size.w - width) > 0.5 || Math.abs(size.h - height) > 0.5) setSize({ w: width, h: height });
      }}
      style={[
        s.wrap,
        { maxWidth: maxWidth ?? W - 32, left: cx * W - (size?.w ?? 0) / 2, top: cy * H - (size?.h ?? 0) / 2, opacity: size ? 1 : 0 },
      ]}
    >
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', alignItems: 'center' },
});
