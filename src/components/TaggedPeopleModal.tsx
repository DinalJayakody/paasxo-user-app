import React, { useMemo } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, X } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { resolveAvatarUri } from '../utils/mediaUrl';

interface Person { firebaseUid: string; displayName: string; profileImageUrl?: string }

/** "Tagged in this post/story" list — tap a person to open their profile. */
export function TaggedPeopleModal({ visible, people, onClose, onOpen, title = 'Tagged' }: {
  visible: boolean;
  people: Person[];
  onClose: () => void;
  onOpen: (firebaseUid: string) => void;
  title?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title} · {people.length}</Text>
            <Pressable onPress={onClose} hitSlop={10}><X color={colors.text} size={20} /></Pressable>
          </View>
          <FlatList
            data={people}
            keyExtractor={(p) => p.firebaseUid}
            renderItem={({ item }) => (
              <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]} onPress={() => onOpen(item.firebaseUid)}>
                <Image source={{ uri: resolveAvatarUri(item.profileImageUrl, item.displayName) }} style={styles.avatar} />
                <Text style={styles.name} numberOfLines={1}>{item.displayName}</Text>
                <ChevronRight color={colors.neutral400} size={16} />
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingBottom: 28, maxHeight: '70%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.neutral300, marginTop: 8, marginBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.neutral100 },
  name: { flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.text },
});
