import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MapPin, Navigation, Search, X } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../styles/colors';
import { placeApi } from '../api/placeApi';

export interface PickedArea { latitude: number; longitude: number; label: string }

/**
 * "Search a town, area or venue" for moving a search radius. Uses the
 * server's cached place search (Paasxo venues + OSM/Google), keeping only
 * results with coordinates, falling back to the free OSM search. No direct
 * calls to paid APIs from the device.
 */
export function AreaSearchSheet({
  visible, onClose, onPick, onUseMyLocation, near,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (a: PickedArea) => void;
  onUseMyLocation?: () => void;
  near?: { latitude: number; longitude: number } | null;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PickedArea[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const reqId = useRef(0);

  useEffect(() => { if (!visible) { setQ(''); setResults([]); setSearched(false); } }, [visible]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setSearched(false); return; }
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const story = await placeApi.storySearch(term, near ?? null);
        let list: PickedArea[] = story
          .filter((p) => typeof p.latitude === 'number' && typeof p.longitude === 'number')
          .map((p) => ({ latitude: p.latitude as number, longitude: p.longitude as number, label: p.address ? `${p.name}, ${p.address}` : p.name }));
        if (list.length === 0) {
          const osm = await placeApi.search(term);
          list = osm.map((p) => ({ latitude: p.latitude, longitude: p.longitude, label: p.displayName || p.name }));
        }
        if (id === reqId.current) { setResults(list.slice(0, 12)); setSearched(true); }
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [q, near]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.wrap} pointerEvents="box-none">
        <View style={s.sheet}>
          <View style={s.head}>
            <Text style={s.title}>Search an area</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close"><X color={colors.text} size={20} /></Pressable>
          </View>
          <View style={s.inputRow}>
            <Search color={colors.textMuted} size={17} />
            <TextInput
              value={q}
              onChangeText={setQ}
              autoFocus
              placeholder="Town, area or venue — e.g. Nugegoda"
              placeholderTextColor={colors.textMuted}
              style={s.input}
              returnKeyType="search"
              autoCorrect={false}
            />
            {loading ? <ActivityIndicator size="small" color={colors.primary} /> : !!q && (
              <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Clear"><X color={colors.textMuted} size={16} /></Pressable>
            )}
          </View>
          {onUseMyLocation && (
            <Pressable style={s.row} onPress={() => { onUseMyLocation(); onClose(); }} accessibilityRole="button">
              <View style={[s.rowIcon, { backgroundColor: colors.primary + '18' }]}><Navigation color={colors.primary} size={16} /></View>
              <Text style={[s.rowText, { color: colors.primary, fontWeight: '800' }]}>Use my current location</Text>
            </Pressable>
          )}
          <FlatList
            data={results}
            keyExtractor={(r, i) => `${r.latitude},${r.longitude},${i}`}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 340 }}
            renderItem={({ item }) => (
              <Pressable style={s.row} onPress={() => { onPick(item); onClose(); }} accessibilityRole="button">
                <View style={s.rowIcon}><MapPin color={colors.textSecondary} size={16} /></View>
                <Text style={s.rowText} numberOfLines={2}>{item.label}</Text>
              </Pressable>
            )}
            ListEmptyComponent={searched && !loading ? <Text style={s.empty}>No places found. Try another name.</Text> : null}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,6,23,0.5)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.cardBg, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 30, minHeight: 360 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '900', color: colors.text },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.inputBg,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 8,
  },
  input: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  rowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.neutral100, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, fontSize: 14, color: colors.text },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 18 },
});
