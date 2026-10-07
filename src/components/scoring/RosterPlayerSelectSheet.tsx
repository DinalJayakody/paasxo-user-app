import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { User, X } from 'lucide-react-native';
import { ThemeColors } from '../../styles/colors';
import { useTheme } from '../../context/ThemeContext';
import { MatchTeamPlayer } from '../../types/api';

interface RosterPlayerSelectSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  players: MatchTeamPlayer[];
  onSelect: (player: MatchTeamPlayer | null) => void;
  /** Shown as a fallback action — e.g. "Unspecified scorer" / "No specific player". */
  noneLabel?: string;
}

/** Quick picker for "who did this" at the moment of logging a score event —
 *  selects from the match's ALREADY-ASSIGNED roster (see AddTeamPlayerSheet
 *  for building that roster in the first place), not a fresh search. */
export function RosterPlayerSelectSheet({
  visible,
  onClose,
  title,
  players,
  onSelect,
  noneLabel = 'No specific player',
}: RosterPlayerSelectSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <X color={colors.text} size={20} strokeWidth={2.5} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
            {players.length === 0 ? (
              <Text style={styles.emptyText}>
                No players on this team's roster yet — add them from "Manage Teams" first.
              </Text>
            ) : (
              players.map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.playerRow}
                  onPress={() => { onSelect(p); onClose(); }}
                >
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitial}>{(p.displayName[0] ?? '?').toUpperCase()}</Text>
                  </View>
                  <Text style={styles.playerName} numberOfLines={1}>{p.displayName}</Text>
                  {!p.playerFirebaseUid && <Text style={styles.customBadge}>Custom</Text>}
                </Pressable>
              ))
            )}

            <Pressable
              style={styles.noneRow}
              onPress={() => { onSelect(null); onClose(); }}
            >
              <View style={styles.avatarFallbackMuted}>
                <User color={colors.textMuted} size={16} strokeWidth={2} />
              </View>
              <Text style={styles.noneLabel}>{noneLabel}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '70%', paddingHorizontal: 20, paddingBottom: 28,
  },
  handle: { width: 40, height: 4, backgroundColor: colors.neutral200, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text },
  closeBtn: { padding: 4 },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: 16, lineHeight: 19 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  avatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '22', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 14, fontWeight: '700', color: colors.primary },
  playerName: { flex: 1, fontSize: 14.5, fontWeight: '600', color: colors.text },
  customBadge: { fontSize: 10.5, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  noneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
    marginTop: 4, borderTopWidth: 1, borderTopColor: colors.neutral200,
  },
  avatarFallbackMuted: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.neutral100, alignItems: 'center', justifyContent: 'center' },
  noneLabel: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
});
