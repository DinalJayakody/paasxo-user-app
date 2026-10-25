import React from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ban } from 'lucide-react-native';
import { EFFECTS } from './effects';
import { SheetFrame, sheetColors } from './SheetFrame';

/** Pick an animated sports effect — it previews live behind the sheet. */
export function EffectsSheet({
  value, onChange, onClose,
}: { value: string | null; onChange: (key: string | null) => void; onClose: () => void }) {
  return (
    <SheetFrame title="Effects" onClose={onClose} heightRatio={0.46}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.grid}>
        <Pressable
          onPress={() => onChange(null)}
          style={[s.cell, !value && s.active]}
          accessibilityLabel="No effect"
          accessibilityState={{ selected: !value }}
        >
          <View style={s.iconWrap}><Ban color="#fff" size={24} strokeWidth={2.2} /></View>
          <Text style={s.label}>None</Text>
        </Pressable>
        {EFFECTS.map((fx) => {
          const active = value === fx.key;
          return (
            <Pressable
              key={fx.key}
              onPress={() => onChange(fx.key)}
              style={[s.cell, active && s.active]}
              accessibilityLabel={`${fx.label} effect`}
              accessibilityState={{ selected: active }}
            >
              <View style={s.iconWrap}><Text style={s.icon} allowFontScaling={false}>{fx.icon}</Text></View>
              <Text style={[s.label, active && { color: '#fff' }]} numberOfLines={1}>{fx.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </SheetFrame>
  );
}

// Four per row, filling the sheet (16px side padding, 10px gaps).
const CELL_W = Math.floor((Dimensions.get('window').width - 32 - 30) / 4);

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 20 },
  cell: {
    width: CELL_W, alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 18,
    backgroundColor: sheetColors.card, borderWidth: 1.5, borderColor: sheetColors.border,
  },
  active: { borderColor: sheetColors.accent, backgroundColor: 'rgba(34,211,238,0.16)' },
  iconWrap: { height: 34, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 30 },
  label: { color: sheetColors.muted, fontSize: 11.5, fontWeight: '800' },
});
