import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';

const { height: H } = Dimensions.get('window');

/**
 * Dark, high-contrast bottom sheet used inside the story composer (stickers,
 * location, effects). Solid panel over a dim backdrop — readable on any photo.
 */
export function SheetFrame({
  title, onClose, children, heightRatio = 0.62, bottomInset = 0,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  heightRatio?: number;
  bottomInset?: number;
}) {
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(slide, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [slide]);
  return (
    <View style={s.root}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <Animated.View
        style={[
          s.sheet,
          { height: H * heightRatio, paddingBottom: bottomInset + (Platform.OS === 'ios' ? 28 : 16) },
          { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [H * heightRatio, 0] }) }] },
        ]}
      >
        <View style={s.handle} />
        <View style={s.header}>
          <Text style={s.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={s.close} accessibilityLabel="Close">
            <X color="#fff" size={18} strokeWidth={2.6} />
          </Pressable>
        </View>
        {children}
      </Animated.View>
    </View>
  );
}

export const sheetColors = {
  bg: '#0E1624',
  card: '#172238',
  border: 'rgba(255,255,255,0.10)',
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.62)',
  accent: '#22D3EE',
  blue: '#2977C2',
};

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 60, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: sheetColors.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: 1, borderColor: sheetColors.border, paddingHorizontal: 16,
  },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  title: { color: sheetColors.text, fontSize: 17, fontWeight: '900' },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
});
