import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Eye, Image as ImageIcon, X } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';

interface AvatarActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onViewPhoto: () => void;
  onChooseLibrary: () => void;
  onTakePhoto: () => void;
}

// Bottom sheet shown when the profile owner taps their own avatar - offers
// viewing the current photo full-screen or replacing it. Not shown on a
// friend's profile, where tapping the avatar goes straight to the viewer.
//
// Deliberately NOT wrapped in RN's <Modal>: presenting a native picker
// (image library / camera) immediately after dismissing a <Modal> is a
// well-known iOS race - the OS can silently refuse to show the picker while
// the previous modal's dismiss transition is still in flight, which was
// breaking "Choose from Library"/"Take a Photo" outright. Rendering this as
// a plain in-tree animated overlay instead means there's no competing
// native presentation to race against, so the picker can be launched the
// instant the option is tapped.
export function AvatarActionSheet({
  visible,
  onClose,
  onViewPhoto,
  onChooseLibrary,
  onTakePhoto,
}: AvatarActionSheetProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [mounted, setMounted] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(300)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(sheetTranslateY, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(sheetTranslateY, { toValue: 300, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  const options = [
    { key: 'view', icon: Eye, label: 'View Photo', onPress: onViewPhoto },
    { key: 'library', icon: ImageIcon, label: 'Choose from Library', onPress: onChooseLibrary },
    { key: 'camera', icon: Camera, label: 'Take a Photo', onPress: onTakePhoto },
  ];

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Animated.View style={[styles.backdropFill, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 8), transform: [{ translateY: sheetTranslateY }] },
        ]}
      >
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>Profile Photo</Text>
          <Pressable onPress={onClose} style={styles.closeIcon} hitSlop={10}>
            <X color={colors.neutral500} size={18} strokeWidth={2.5} />
          </Pressable>
        </View>

        {options.map((opt) => {
          const Icon = opt.icon;
          return (
            <Pressable
              key={opt.key}
              style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}
              onPress={opt.onPress}
            >
              <View style={styles.optionIconWrap}>
                <Icon color={colors.primary} size={19} strokeWidth={2.2} />
              </View>
              <Text style={styles.optionLabel}>{opt.label}</Text>
            </Pressable>
          );
        })}

        <Pressable style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.neutral200,
    alignSelf: 'center', marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.neutral900 },
  closeIcon: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.neutral100,
  },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderRadius: 16, paddingHorizontal: 8,
  },
  optionRowPressed: { backgroundColor: colors.neutral100 },
  optionIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  optionLabel: { fontSize: 15, fontWeight: '600', color: colors.neutral900 },
  cancelButton: {
    marginTop: 8, paddingVertical: 14, borderRadius: 16,
    alignItems: 'center', backgroundColor: colors.neutral100,
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: colors.neutral700 },
});
