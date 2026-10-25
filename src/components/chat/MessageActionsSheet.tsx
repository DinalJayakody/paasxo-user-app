import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Copy, Reply, RotateCcw, Trash2, Undo2 } from 'lucide-react-native';
import { ChatMessage } from '../../api/chatApi';
import { ThemeColors } from '../../styles/colors';

export const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👍'];

/** Long-press menu: quick reactions on top, actions below. */
export function MessageActionsSheet({
  message, mine, myReaction, colors, onClose, onReact, onReply, onCopy, onUnsend, onRetry, onDiscard,
}: {
  message: ChatMessage | null;
  mine: boolean;
  myReaction: string | null;
  colors: ThemeColors;
  onClose: () => void;
  onReact: (emoji: string | null) => void;
  onReply: () => void;
  onCopy: () => void;
  onUnsend: () => void;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  if (!message) return null;
  const failed = !!message.failed;
  const canReact = !failed && !message.pending && !message.unsent;
  const actions: { key: string; label: string; icon: React.ReactNode; onPress: () => void; danger?: boolean }[] = [];
  if (failed) {
    actions.push({ key: 'retry', label: 'Try again', icon: <RotateCcw color={colors.text} size={18} />, onPress: onRetry });
    actions.push({ key: 'discard', label: 'Delete', icon: <Trash2 color={colors.error} size={18} />, onPress: onDiscard, danger: true });
  } else if (!message.unsent) {
    actions.push({ key: 'reply', label: 'Reply', icon: <Reply color={colors.text} size={18} />, onPress: onReply });
    if (message.type === 'TEXT' && message.text) {
      actions.push({ key: 'copy', label: 'Copy', icon: <Copy color={colors.text} size={18} />, onPress: onCopy });
    }
    if (mine) actions.push({ key: 'unsend', label: 'Unsend', icon: <Undo2 color={colors.error} size={18} />, onPress: onUnsend, danger: true });
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <View style={s.wrap}>
          {canReact && (
            <View style={[s.reactions, { backgroundColor: colors.cardBg }]}>
              {QUICK_REACTIONS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => onReact(myReaction === e ? null : e)}
                  style={({ pressed }) => [s.reaction, myReaction === e && { backgroundColor: colors.primary + '26' }, pressed && { transform: [{ scale: 1.25 }] }]}
                  accessibilityLabel={myReaction === e ? `Remove ${e}` : `React ${e}`}
                >
                  <Text style={s.reactionEmoji}>{e}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {actions.length > 0 && (
            <View style={[s.actions, { backgroundColor: colors.cardBg }]}>
              {actions.map((a, i) => (
                <Pressable
                  key={a.key}
                  onPress={a.onPress}
                  style={({ pressed }) => [s.action, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.neutral200 }, pressed && { backgroundColor: colors.neutral100 }]}
                >
                  <Text style={[s.actionText, { color: a.danger ? colors.error : colors.text }]}>{a.label}</Text>
                  {a.icon}
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 28 },
  wrap: { gap: 10 },
  reactions: {
    flexDirection: 'row', alignSelf: 'center', borderRadius: 30, paddingHorizontal: 8, paddingVertical: 6, gap: 2,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  reaction: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  reactionEmoji: { fontSize: 28 },
  actions: { borderRadius: 18, overflow: 'hidden' },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 15 },
  actionText: { fontSize: 15.5, fontWeight: '700' },
});
