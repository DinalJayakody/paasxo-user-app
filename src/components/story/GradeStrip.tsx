import React, { memo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GRADES, GradeLayers } from './grades';

/**
 * Colour-grade picker with live thumbnails of YOUR photo/video frame in each
 * look (falls back to a colour swatch until a video thumbnail exists).
 */
export const GradeStrip = memo(function GradeStrip({
  thumbUri, value, onChange,
}: { thumbUri?: string | null; value: string; onChange: (key: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
      {GRADES.map((g) => {
        const active = g.key === value;
        return (
          <Pressable
            key={g.key}
            onPress={() => onChange(g.key)}
            style={s.item}
            accessibilityLabel={`${g.label} colour`}
            accessibilityState={{ selected: active }}
          >
            <View style={[s.thumb, active && s.thumbActive]}>
              {thumbUri ? (
                <Image source={{ uri: thumbUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#3A4558' }]} />
              )}
              <GradeLayers gradeKey={g.key} />
              {!thumbUri && <View style={[s.swatchDot, { backgroundColor: g.swatch }]} />}
            </View>
            <Text style={[s.label, active && s.labelActive]} numberOfLines={1}>{g.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

const s = StyleSheet.create({
  row: { paddingHorizontal: 14, gap: 10 },
  item: { alignItems: 'center', gap: 5, width: 60 },
  thumb: {
    width: 54, height: 72, borderRadius: 12, overflow: 'hidden', isolation: 'isolate',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
  },
  thumbActive: { borderColor: '#22D3EE', borderWidth: 2.5 },
  swatchDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#fff' },
  label: { color: 'rgba(255,255,255,0.7)', fontSize: 10.5, fontWeight: '800' },
  labelActive: { color: '#fff' },
});
