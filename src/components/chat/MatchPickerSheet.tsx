import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarClock, X } from 'lucide-react-native';
import { statsApi, MatchHistoryItem } from '../../api/statsApi';
import { ThemeColors } from '../../styles/colors';
import { sportEmoji } from './chatFormat';

const SHAREABLE = new Set(['UPCOMING', 'LIVE', 'PENDING', 'COMPLETED', 'PLAYED']);

/** Pick one of your matches to share in the chat (upcoming first). */
export function MatchPickerSheet({ visible, me, colors, onPick, onClose }: {
  visible: boolean; me: string | null; colors: ThemeColors;
  onPick: (m: MatchHistoryItem) => void; onClose: () => void;
}) {
  const [items, setItems] = useState<MatchHistoryItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!visible || !me || items) return;
    statsApi.getMatches(me, null, 0, 30)
      .then((p) => {
        const list = p.content.filter((m) => SHAREABLE.has(m.status));
        const upcoming = list.filter((m) => m.status === 'UPCOMING' || m.status === 'LIVE' || m.status === 'PENDING').reverse();
        setItems([...upcoming, ...list.filter((m) => !upcoming.includes(m))]);
      })
      .catch(() => setError(true));
  }, [visible, me, items]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.sheet, { backgroundColor: colors.cardBg }]}>
        <View style={s.header}>
          <Text style={[s.title, { color: colors.text }]}>Share a match</Text>
          <Pressable onPress={onClose} hitSlop={10}><X color={colors.text} size={20} /></Pressable>
        </View>
        {!items ? (
          <View style={s.center}>
            {error ? <Text style={{ color: colors.textSecondary }}>Couldn’t load your matches.</Text> : <ActivityIndicator color={colors.primary} />}
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(m) => String(m.bookingId)}
            ListEmptyComponent={<Text style={[s.empty, { color: colors.textSecondary }]}>No matches to share yet.</Text>}
            renderItem={({ item }) => (
              <Pressable onPress={() => onPick(item)} style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.neutral100 }]}>
                <View style={[s.icon, { backgroundColor: colors.primary + '1A' }]}><Text style={{ fontSize: 18 }}>{sportEmoji(item.sport)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{item.title || 'Match'}</Text>
                  <View style={s.meta}>
                    <CalendarClock color={colors.textMuted} size={12} />
                    <Text style={[s.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.venueName ?? 'Venue'}{item.startAt ? ` · ${item.startAt.slice(0, 10)}` : ''}
                    </Text>
                  </View>
                </View>
                <Text style={[s.status, { color: item.status === 'UPCOMING' || item.status === 'LIVE' ? colors.primary : colors.textMuted }]}>
                  {item.status === 'UPCOMING' ? 'Upcoming' : item.status === 'LIVE' ? 'Live' : item.status === 'PENDING' ? 'Pending' : 'Played'}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '70%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 34 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 },
  title: { fontSize: 17, fontWeight: '900' },
  center: { padding: 40, alignItems: 'center' },
  empty: { textAlign: 'center', padding: 30 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 11 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '800' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: 12, flexShrink: 1 },
  status: { fontSize: 11.5, fontWeight: '900' },
});
