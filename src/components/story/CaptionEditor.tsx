import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Minus, Plus } from 'lucide-react-native';
import {
  CAPTION_COLORS, CAPTION_SCALES, CAPTION_STYLES, CaptionStyleKey, captionLook, contrastOn,
} from './captionStyles';

const { width: W } = Dimensions.get('window');
export const MAX_CAPTION_CHARS = 80;

export interface CaptionValue {
  text: string;
  color: string;
  style: CaptionStyleKey;
  scale: number;
}

/**
 * Full-screen caption editor over the dimmed story. You type straight into
 * the caption in its final look (font, colour, size), so there are no
 * surprises after posting. Style chips and colours sit just above the
 * keyboard.
 */
export function CaptionEditor({
  initial, fontsReady, onDone, onCancel, allowStyles = true,
}: {
  initial: CaptionValue;
  fontsReady: boolean;
  /** false (reels): classic look only — no style chips or size control. */
  allowStyles?: boolean;
  onDone: (value: CaptionValue) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial.text);
  const [color, setColor] = useState(initial.color);
  const [style, setStyle] = useState<CaptionStyleKey>(initial.style);
  const [scaleIdx, setScaleIdx] = useState(() => {
    const i = CAPTION_SCALES.findIndex((v) => Math.abs(v - initial.scale) < 0.01);
    return i >= 0 ? i : CAPTION_SCALES.indexOf(1);
  });
  const [keyboard, setKeyboard] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboard(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const scale = CAPTION_SCALES[scaleIdx];
  const look = captionLook(style, color, scale, fontsReady);
  const finish = () => onDone({ text: text.trim(), color, style, scale });

  const inputBody = (
    <TextInput
      ref={inputRef}
      value={text}
      onChangeText={(t) => setText(t.replace(/\n{2,}/g, '\n'))}
      autoFocus
      multiline
      maxLength={MAX_CAPTION_CHARS}
      placeholder={look.uppercase ? 'TYPE SOMETHING' : 'Type something…'}
      placeholderTextColor={look.gradient || style === 'STADIUM' ? contrastOn(color) + '88' : 'rgba(255,255,255,0.55)'}
      autoCapitalize={look.uppercase ? 'characters' : 'sentences'}
      selectionColor={style === 'STADIUM' || look.gradient ? contrastOn(color) : color === '#0B0F14' ? '#fff' : color}
      keyboardAppearance="dark"
      allowFontScaling={false}
      style={[look.text, s.input]}
    />
  );

  return (
    <View style={s.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={finish} accessibilityLabel="Done editing" />

      {/* Top bar */}
      <View style={s.topBar}>
        <Pressable onPress={onCancel} hitSlop={10} style={s.topBtn}>
          <Text style={s.cancel}>Cancel</Text>
        </Pressable>
        {allowStyles ? <View style={s.sizeGroup}>
          <Pressable
            onPress={() => setScaleIdx((i) => Math.max(0, i - 1))}
            disabled={scaleIdx === 0}
            style={[s.sizeBtn, scaleIdx === 0 && s.disabled]}
            accessibilityLabel="Smaller text"
          >
            <Minus color="#fff" size={16} strokeWidth={2.6} />
          </Pressable>
          <Text style={s.sizeLabel}>Aa</Text>
          <Pressable
            onPress={() => setScaleIdx((i) => Math.min(CAPTION_SCALES.length - 1, i + 1))}
            disabled={scaleIdx === CAPTION_SCALES.length - 1}
            style={[s.sizeBtn, scaleIdx === CAPTION_SCALES.length - 1 && s.disabled]}
            accessibilityLabel="Bigger text"
          >
            <Plus color="#fff" size={16} strokeWidth={2.6} />
          </Pressable>
        </View> : <View />}
        <Pressable onPress={finish} hitSlop={10} accessibilityLabel="Done">
          <LinearGradient colors={['#22D3EE', '#2977C2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.doneBtn}>
            <Check color="#fff" size={16} strokeWidth={3} />
            <Text style={s.doneText}>Done</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* Live caption */}
      <View style={[s.center, { bottom: keyboard + 130 }]} pointerEvents="box-none">
        {look.gradient ? (
          <LinearGradient colors={look.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[look.container, s.inputWrap]}>
            {inputBody}
          </LinearGradient>
        ) : (
          <View style={[look.container, s.inputWrap]}>{inputBody}</View>
        )}
        <Text style={s.counter}>{text.length}/{MAX_CAPTION_CHARS}</Text>
      </View>

      {/* Styles + colours, riding on top of the keyboard */}
      <View style={[s.controls, { bottom: keyboard > 0 ? keyboard : 24 }]}>
        {allowStyles && <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={s.row}>
          {CAPTION_STYLES.map((opt) => {
            const active = opt.key === style;
            const chipLook = captionLook(opt.key, opt.key === 'SCOREBOARD' ? '#22D3EE' : opt.key === 'CLASSIC' ? '#FFFFFF' : '#2977C2', 0.62, fontsReady);
            return (
              <Pressable
                key={opt.key}
                onPress={() => setStyle(opt.key)}
                style={[s.styleChip, active && s.styleChipActive]}
                accessibilityLabel={`${opt.label} style`}
                accessibilityState={{ selected: active }}
              >
                <View style={s.chipPreview}>
                  {chipLook.gradient ? (
                    <LinearGradient colors={chipLook.gradient} style={chipLook.container}>
                      <Text style={chipLook.text} allowFontScaling={false}>Aa</Text>
                    </LinearGradient>
                  ) : (
                    <View style={chipLook.container}>
                      <Text style={[chipLook.text, { fontSize: Math.min(22, (chipLook.text.fontSize as number) ?? 18) }]} allowFontScaling={false}>
                        {chipLook.uppercase ? 'AA' : 'Aa'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[s.styleLabel, active && { color: '#fff' }]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={[s.row, allowStyles && { paddingTop: 10 }]}>
          {CAPTION_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[s.colorDot, { backgroundColor: c }, c === color && s.colorDotActive]}
              accessibilityLabel={`Colour ${c}`}
              hitSlop={4}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,7,14,0.62)', zIndex: 50 },
  topBar: {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : 28, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  topBtn: { paddingVertical: 8, paddingRight: 8 },
  cancel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sizeGroup: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 4,
  },
  sizeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  sizeLabel: { color: '#fff', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.35 },
  doneBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  doneText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  center: { position: 'absolute', top: 120, left: 16, right: 16, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { maxWidth: W - 40 },
  input: { minWidth: 60, paddingVertical: 0, paddingHorizontal: 0, margin: 0 },
  counter: { marginTop: 10, color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700' },
  controls: { position: 'absolute', left: 0, right: 0, paddingBottom: 10, backgroundColor: 'rgba(3,7,14,0.55)', paddingTop: 10 },
  row: { paddingHorizontal: 14, gap: 10, alignItems: 'center' },
  styleChip: {
    alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.06)', minWidth: 74,
  },
  styleChipActive: { borderColor: '#22D3EE', backgroundColor: 'rgba(34,211,238,0.16)' },
  chipPreview: { height: 34, alignItems: 'center', justifyContent: 'center' },
  styleLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800' },
  colorDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  colorDotActive: { borderColor: '#fff', borderWidth: 3, transform: [{ scale: 1.15 }] },
});
