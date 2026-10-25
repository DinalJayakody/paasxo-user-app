import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SheetFrame, sheetColors } from './SheetFrame';

const SECTIONS: { title: string; items: string[] }[] = [
  { title: 'Game on', items: ['⚽', '🏏', '🏸', '🏀', '🏐', '🎾', '🏓', '🏉', '🏑', '🥊', '⛳', '🥅', '🏊', '🚴', '🏃', '🏋️', '🤸', '🧗', '🎯', '👟'] },
  { title: 'Winning', items: ['🏆', '🥇', '🥈', '🥉', '🏅', '👑', '💯', '⭐', '🌟', '✨', '🎉', '🎊'] },
  { title: 'Hype', items: ['🔥', '💪', '⚡', '🚀', '💥', '🙌', '👏', '👊', '🤝', '📣', '😤', '🤙', '💙'] },
  { title: 'Feels', items: ['😀', '😂', '🤣', '😍', '🥳', '😎', '🤩', '😅', '😭', '🥵', '🥶', '😴', '🤯', '👀', '🙏', '❤️'] },
];

/** Big, high-contrast sticker picker (replaces the old faint emoji overlay). */
export function StickerSheet({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  return (
    <SheetFrame title="Stickers" onClose={onClose} heightRatio={0.6}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        {SECTIONS.map((sec) => (
          <View key={sec.title} style={s.section}>
            <Text style={s.sectionTitle}>{sec.title}</Text>
            <View style={s.grid}>
              {sec.items.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => onPick(e)}
                  style={({ pressed }) => [s.cell, pressed && s.cellPressed]}
                  accessibilityLabel={`Add ${e}`}
                >
                  <Text style={s.emoji} allowFontScaling={false}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SheetFrame>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 14 },
  sectionTitle: { color: sheetColors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: sheetColors.card, borderWidth: 1, borderColor: sheetColors.border,
  },
  cellPressed: { backgroundColor: '#22354F', transform: [{ scale: 0.94 }] },
  emoji: { fontSize: 32 },
});
