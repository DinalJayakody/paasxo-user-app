import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin } from 'lucide-react-native';
import { STORY_FONT } from './storyFonts';

/** The story location sticker — a Paasxo-blue match ticket with a pin. */
export function LocationSticker({ name, fontsReady, maxWidth }: { name: string; fontsReady: boolean; maxWidth?: number }) {
  return (
    <LinearGradient
      colors={['#22D3EE', '#2977C2', '#1E3A8A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.pill, maxWidth ? { maxWidth } : null]}
    >
      <View style={s.pinWrap}>
        <MapPin color="#2977C2" size={14} strokeWidth={2.8} fill="#fff" />
      </View>
      <Text
        style={[s.text, fontsReady ? { fontFamily: STORY_FONT.stadium, fontSize: 22, letterSpacing: 1 } : null]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {fontsReady ? name.toUpperCase() : name}
      </Text>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingLeft: 6, paddingRight: 14, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.75)',
  },
  pinWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontSize: 15, fontWeight: '900', flexShrink: 1 },
});
