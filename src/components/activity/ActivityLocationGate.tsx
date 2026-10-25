import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { BatteryCharging, Lock, MapPin, Navigation, Settings2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors } from '../../styles/colors';

type GateMode = 'ask' | 'blocked';

/**
 * "Before you start" location gate for Walk/Run/Cycling. Shown before the
 * tracker opens (sheet row: "notification before the activity … and it
 * should have the allow-while-using-the-app option"):
 *
 *  - Already granted → goes straight to the tracker.
 *  - Never asked → explains why, then the system prompt, which offers
 *    "Allow While Using App" / "Allow Once" / "Don't Allow". While Using is
 *    enough: a session the user starts keeps recording with the phone locked
 *    (iOS shows the blue location pill; Android a tracking notification).
 *  - Previously denied → explains how to turn it on in Settings.
 */
export function useActivityLocationGate() {
  const router = useRouter();
  const [mode, setMode] = useState<GateMode | null>(null);
  const [busy, setBusy] = useState(false);
  const target = useRef<string>('/activity-tracker');

  const open = useCallback((path: string) => {
    router.push(path as any);
  }, [router]);

  const launch = useCallback(async (path = '/activity-tracker') => {
    target.current = path;
    try {
      const current = await Location.getForegroundPermissionsAsync();
      if (current.granted) { open(path); return; }
      setMode(current.canAskAgain === false ? 'blocked' : 'ask');
    } catch {
      open(path); // the tracker has its own permission handling as a fallback
    }
  }, [open]);

  const allow = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      if (res.granted) {
        setMode(null);
        open(target.current);
      } else {
        setMode(res.canAskAgain === false ? 'blocked' : 'ask');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, open]);

  const close = useCallback(() => setMode(null), []);

  const openSettings = useCallback(() => {
    setMode(null);
    Linking.openSettings().catch(() => {});
  }, []);

  const gate = (
    <LocationGateSheet mode={mode} busy={busy} onAllow={allow} onClose={close} onOpenSettings={openSettings} />
  );

  return { launch, gate };
}

function LocationGateSheet({
  mode, busy, onAllow, onClose, onOpenSettings,
}: { mode: GateMode | null; busy: boolean; onAllow: () => void; onClose: () => void; onOpenSettings: () => void }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const blocked = mode === 'blocked';
  const allowLabel = Platform.OS === 'ios' ? '“Allow While Using App”' : '“While using the app”';

  return (
    <Modal visible={mode != null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={s.sheetWrap} pointerEvents="box-none">
        <View style={s.sheet} accessibilityViewIsModal>
          <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.badge}>
            <Navigation color="#fff" size={30} strokeWidth={2.4} />
          </LinearGradient>
          <Text style={s.title}>{blocked ? 'Turn on location' : 'Location for your activity'}</Text>
          <Text style={s.body}>
            {blocked
              ? `Location is off for Paasxo, so we can't measure your distance or draw your route. Open Settings → Location and choose ${Platform.OS === 'ios' ? '“While Using the App”' : '“Allow only while using the app”'}.`
              : `Paasxo uses GPS to measure your distance, pace and route. On the next screen choose ${allowLabel} — that's all an activity needs.`}
          </Text>

          {!blocked && (
            <View style={s.points}>
              <Point icon={<MapPin color={colors.walkRun} size={16} strokeWidth={2.4} />} text="Accurate distance, pace & route map" s={s} />
              <Point icon={<Lock color={colors.walkRun} size={16} strokeWidth={2.4} />} text="Keeps recording when your phone is locked — only during an activity you start" s={s} />
              <Point icon={<BatteryCharging color={colors.walkRun} size={16} strokeWidth={2.4} />} text="GPS switches off the moment you finish" s={s} />
            </View>
          )}

          <Pressable
            onPress={blocked ? onOpenSettings : onAllow}
            disabled={busy}
            style={({ pressed }) => [s.primary, (pressed || busy) && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            {blocked && <Settings2 color="#fff" size={18} strokeWidth={2.4} />}
            <Text style={s.primaryText}>{blocked ? 'Open Settings' : busy ? 'Waiting…' : 'Continue'}</Text>
          </Pressable>
          <Pressable onPress={onClose} style={s.secondary} accessibilityRole="button" hitSlop={8}>
            <Text style={s.secondaryText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Point({ icon, text, s }: { icon: React.ReactNode; text: string; s: ReturnType<typeof createStyles> }) {
  return (
    <View style={s.point}>
      <View style={s.pointIcon}>{icon}</View>
      <Text style={s.pointText}>{text}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,6,23,0.55)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.cardBg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 34, alignItems: 'center',
  },
  badge: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 21, fontWeight: '900', color: colors.text, textAlign: 'center' },
  body: { marginTop: 8, fontSize: 14.5, lineHeight: 21, color: colors.textSecondary, textAlign: 'center' },
  points: { alignSelf: 'stretch', marginTop: 18, gap: 12 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointIcon: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: colors.walkRun + '1F',
    alignItems: 'center', justifyContent: 'center',
  },
  pointText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: colors.text, fontWeight: '600' },
  primary: {
    marginTop: 24, alignSelf: 'stretch', height: 54, borderRadius: 16, backgroundColor: colors.walkRun,
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  secondary: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 20 },
  secondaryText: { color: colors.textSecondary, fontSize: 14.5, fontWeight: '700' },
});
