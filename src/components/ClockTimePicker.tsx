import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../styles/colors';

const DIAL = 264;
const R = DIAL / 2;
const NUM_R = R - 30;     // radius the numbers sit on
const STEP = 5;           // minute granularity

type Mode = 'hour' | 'minute';

export interface ClockTimePickerProps {
  visible: boolean;
  /** Current value "HH:mm" (24h) or '' for none. */
  value: string;
  /** Earliest selectable time in minutes after midnight (inclusive). */
  minMinutes?: number;
  /** Latest selectable time in minutes after midnight (inclusive). */
  maxMinutes?: number;
  accent?: string;
  title?: string;
  onCancel: () => void;
  onConfirm: (hhmm: string) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toHHmm = (total: number) => `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;

function parse(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(value || '');
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Analog clock-face time picker (sheet row 36: "start time should be like a
 * clock"). Tap or drag around the dial to set the hour, it flips to minutes
 * automatically, AM/PM toggles beside the readout. Times outside
 * [minMinutes, maxMinutes] are dimmed and can't be chosen, so the screen
 * never receives a start time in the past or one that runs past midnight.
 */
export default function ClockTimePicker({
  visible, value, minMinutes = 0, maxMinutes = 24 * 60 - STEP, accent, title = 'Start time', onCancel, onConfirm,
}: ClockTimePickerProps) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const tint = accent || colors.primary;

  const lo = Math.ceil(Math.max(0, minMinutes) / STEP) * STEP;
  const hi = Math.floor(Math.min(24 * 60 - STEP, maxMinutes) / STEP) * STEP;
  const hasRange = lo <= hi;

  const clamp = (t: number) => Math.min(hi, Math.max(lo, t));
  const initial = () => {
    const parsed = parse(value);
    if (parsed != null) return clamp(Math.round(parsed / STEP) * STEP);
    return clamp(Math.max(lo, 18 * 60));
  };

  const [total, setTotal] = useState<number>(initial);
  const [mode, setMode] = useState<Mode>('hour');

  useEffect(() => {
    if (visible) { setTotal(initial()); setMode('hour'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const hour24 = Math.floor(total / 60);
  const minute = total % 60;
  const pm = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const hourAllowed = (h24: number) => h24 * 60 + 55 >= lo && h24 * 60 <= hi;
  const allowed = (t: number) => t >= lo && t <= hi;

  // Refs so the PanResponder (created once) always sees fresh state.
  const live = useRef({ total, mode, pm });
  live.current = { total, mode, pm };
  const lastTick = useRef<number | null>(null);

  const pick = (x: number, y: number, release: boolean) => {
    const dx = x - R;
    const dy = y - R;
    if (Math.hypot(dx, dy) < 18) return; // dead zone at the centre
    let angle = Math.atan2(dx, -dy);
    if (angle < 0) angle += Math.PI * 2;
    const { total: cur, mode: m, pm: isPm } = live.current;

    let next = cur;
    if (m === 'hour') {
      const idx = Math.round(angle / (Math.PI / 6)) % 12; // 0 = 12 o'clock
      const h24 = idx + (isPm ? 12 : 0);
      if (!hourAllowed(h24)) return;
      next = clamp(h24 * 60 + (cur % 60));
    } else {
      const mm = (Math.round(angle / ((Math.PI * 2) / (60 / STEP))) % (60 / STEP)) * STEP;
      const cand = Math.floor(cur / 60) * 60 + mm;
      if (!allowed(cand)) return;
      next = cand;
    }
    if (next !== lastTick.current) {
      lastTick.current = next;
      Haptics.selectionAsync().catch(() => {});
    }
    setTotal(next);
    if (release && m === 'hour') setMode('minute');
  };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => pick(e.nativeEvent.locationX, e.nativeEvent.locationY, false),
    onPanResponderMove: (e) => pick(e.nativeEvent.locationX, e.nativeEvent.locationY, false),
    onPanResponderRelease: (e) => pick(e.nativeEvent.locationX, e.nativeEvent.locationY, true),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lo, hi]);

  const setPeriod = (wantPm: boolean) => {
    if (wantPm === pm) return;
    const cand = total + (wantPm ? 12 * 60 : -12 * 60);
    if (cand >= lo - 55 && cand <= hi) setTotal(clamp(cand));
  };
  const amPossible = lo < 12 * 60;
  const pmPossible = hi >= 12 * 60;

  const handIndex = mode === 'hour' ? hour24 % 12 : minute / STEP;
  const handAngle = (handIndex / 12) * Math.PI * 2;
  const knobX = R + NUM_R * Math.sin(handAngle);
  const knobY = R - NUM_R * Math.cos(handAngle);

  const labels = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const x = R + NUM_R * Math.sin(a);
    const y = R - NUM_R * Math.cos(a);
    let text: string;
    let enabled: boolean;
    let selected: boolean;
    if (mode === 'hour') {
      const h24 = i + (pm ? 12 : 0);
      text = String(i === 0 ? 12 : i);
      enabled = hourAllowed(h24);
      selected = hour24 % 12 === i;
    } else {
      const mm = i * STEP;
      text = pad(mm);
      enabled = allowed(hour24 * 60 + mm);
      selected = minute === mm;
    }
    return { i, x, y, text, enabled, selected };
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onCancel} accessibilityLabel="Close time picker" />
      <View style={s.wrap} pointerEvents="box-none">
        <View style={[s.sheet, { paddingBottom: 20 + insets.bottom }]} accessibilityViewIsModal>
          <View style={s.grabber} />
          <Text style={s.title}>{title}</Text>

          {!hasRange ? (
            <Text style={s.empty}>No start times are left for this day. Pick a later date.</Text>
          ) : (
            <>
              <View style={s.readoutRow}>
                <Pressable onPress={() => setMode('hour')} accessibilityRole="button" accessibilityLabel="Edit hour">
                  <Text style={[s.digits, mode === 'hour' ? { color: tint } : null]}>{pad(hour12)}</Text>
                </Pressable>
                <Text style={s.colon}>:</Text>
                <Pressable onPress={() => setMode('minute')} accessibilityRole="button" accessibilityLabel="Edit minutes">
                  <Text style={[s.digits, mode === 'minute' ? { color: tint } : null]}>{pad(minute)}</Text>
                </Pressable>
                <View style={s.period}>
                  {(['AM', 'PM'] as const).map((p) => {
                    const isPm = p === 'PM';
                    const active = pm === isPm;
                    const possible = isPm ? pmPossible : amPossible;
                    return (
                      <Pressable
                        key={p}
                        disabled={!possible}
                        onPress={() => setPeriod(isPm)}
                        style={[s.periodBtn, active && { backgroundColor: tint }]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active, disabled: !possible }}
                      >
                        <Text style={[s.periodText, active && { color: '#fff' }, !possible && { opacity: 0.35 }]}>{p}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <Text style={s.hint}>{mode === 'hour' ? 'Tap or drag to choose the hour' : 'Now choose the minutes'}</Text>

              <View style={s.dial} {...responder.panHandlers}>
                <Svg width={DIAL} height={DIAL} pointerEvents="none">
                  <Circle cx={R} cy={R} r={R} fill={colors.inputBg} />
                  <Line x1={R} y1={R} x2={knobX} y2={knobY} stroke={tint} strokeWidth={2.5} strokeLinecap="round" />
                  <Circle cx={R} cy={R} r={5} fill={tint} />
                  <Circle cx={knobX} cy={knobY} r={20} fill={tint} />
                </Svg>
                {labels.map((l) => (
                  <View key={l.i} pointerEvents="none" style={[s.numWrap, { left: l.x - 20, top: l.y - 20 }]}>
                    <Text
                      style={[
                        s.num,
                        !l.enabled && s.numDisabled,
                        l.selected && { color: '#fff', fontWeight: '900' },
                      ]}
                    >
                      {l.text}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={s.actions}>
            <Pressable onPress={onCancel} style={[s.btn, s.btnGhost]} accessibilityRole="button">
              <Text style={s.btnGhostText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!hasRange || !allowed(total)}
              onPress={() => onConfirm(toHHmm(total))}
              style={[s.btn, { backgroundColor: tint }, (!hasRange || !allowed(total)) && { opacity: 0.5 }]}
              accessibilityRole="button"
            >
              <Text style={s.btnText}>Set time</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,6,23,0.55)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.cardBg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 10, alignItems: 'center',
  },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.neutral300, marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  empty: { marginVertical: 40, fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  readoutRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  digits: { fontSize: 48, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'], paddingHorizontal: 4 },
  colon: { fontSize: 44, fontWeight: '800', color: colors.textMuted, marginHorizontal: 2, marginTop: -4 },
  period: { marginLeft: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.inputBorder, overflow: 'hidden' },
  periodBtn: { paddingHorizontal: 12, paddingVertical: 7, alignItems: 'center' },
  periodText: { fontSize: 13, fontWeight: '800', color: colors.text },
  hint: { marginTop: 4, marginBottom: 14, fontSize: 12.5, color: colors.textMuted, fontWeight: '600' },
  dial: { width: DIAL, height: DIAL },
  numWrap: { position: 'absolute', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 15, fontWeight: '700', color: colors.text },
  numDisabled: { opacity: 0.25 },
  actions: { flexDirection: 'row', gap: 12, alignSelf: 'stretch', marginTop: 22 },
  btn: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 15.5, fontWeight: '900' },
  btnGhost: { backgroundColor: colors.inputBg },
  btnGhostText: { color: colors.text, fontSize: 15.5, fontWeight: '800' },
});
