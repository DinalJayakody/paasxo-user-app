import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';

export interface ActionMenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  destructive?: boolean;
  onPress: () => void;
}

interface ActionMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  actions: ActionMenuItem[];
}

// Generic bottom-sheet action list - same visual language as CommentSheet/
// GifPickerSheet (backdrop + handle + slide-up sheet) so every sheet in the
// app reads as one system. Used for the "..." menu on posts, comments, and
// profiles (Report / Block) - see PostCard, CommentSheet, FriendProfileScreen.
export function ActionMenuSheet({ visible, onClose, actions }: ActionMenuSheetProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const handlePress = (action: ActionMenuItem) => {
    onClose();
    // Let the sheet's close animation start before the action's own UI
    // (an Alert, another sheet) tries to present on top of it.
    setTimeout(action.onPress, 250);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          {actions.map((action) => (
            <Pressable
              key={action.key}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => handlePress(action)}
            >
              <View style={styles.icon}>{action.icon}</View>
              <Text style={[styles.label, action.destructive && styles.labelDestructive]}>
                {action.label}
              </Text>
            </Pressable>
          ))}
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 12,
    paddingBottom: 28,
  },
  handle: {
    width: 40, height: 4, backgroundColor: colors.neutral200, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 12, paddingVertical: 15, borderRadius: 14,
  },
  rowPressed: { backgroundColor: colors.neutral100 },
  icon: { width: 22, alignItems: 'center' },
  label: { fontSize: 15, fontWeight: '600', color: colors.text },
  labelDestructive: { color: colors.error },
  cancelBtn: {
    marginTop: 8, paddingVertical: 15, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: colors.neutral100,
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
});
