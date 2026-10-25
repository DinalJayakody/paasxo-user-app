import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as Location from 'expo-location';
import { MapPin, Search, Trash2 } from 'lucide-react-native';
import { placeApi, StoryPlace } from '../../api/placeApi';
import { SheetFrame, sheetColors } from './SheetFrame';

const DEBOUNCE_MS = 400;

/**
 * Search a place for the story's location sticker — anywhere in the world:
 * Paasxo venues first, then Google (or OpenStreetMap) places, nearest first. One request per pause in typing,
 * stale responses ignored; your location is used only if you've already
 * allowed it (no new permission prompt here).
 */
export function LocationSheet({
  current, onPick, onRemove, onClose,
}: {
  current: string | null;
  onPick: (place: StoryPlace) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StoryPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyboard, setKeyboard] = useState(0);
  const coords = useRef<{ latitude: number; longitude: number } | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) return;
        const last = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 });
        if (last) coords.current = { latitude: last.coords.latitude, longitude: last.coords.longitude };
      } catch {
        // optional — search just isn't biased to your area
      }
    })();
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboard(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { reqId.current++; setResults([]); setLoading(false); return; }
    const t = setTimeout(async () => {
      const id = ++reqId.current;
      setLoading(true);
      const found = await placeApi.storySearch(q, coords.current);
      if (id !== reqId.current) return;
      setResults(found);
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <SheetFrame title="Add location" onClose={onClose} heightRatio={0.8} bottomInset={keyboard}>
      <View style={s.searchWrap}>
        <Search color={sheetColors.muted} size={17} strokeWidth={2.4} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search any place in the world"
          placeholderTextColor={sheetColors.muted}
          style={s.input}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          keyboardAppearance="dark"
          maxLength={80}
        />
        {loading && <ActivityIndicator color={sheetColors.accent} size="small" />}
      </View>

      {!!current && (
        <Pressable style={s.removeRow} onPress={onRemove}>
          <Trash2 color="#FF8A8A" size={16} strokeWidth={2.4} />
          <Text style={s.removeText} numberOfLines={1}>Remove “{current}”</Text>
        </Pressable>
      )}

      <FlatList
        data={results}
        keyExtractor={(p, i) => `${p.source}-${p.placeId ?? p.name}-${i}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 12 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <MapPin color="rgba(255,255,255,0.35)" size={30} strokeWidth={1.8} />
            <Text style={s.emptyText}>
              {query.trim().length < 2 ? 'Search a venue, city, beach, stadium — anywhere' : loading ? 'Searching…' : 'No places found — try another name.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [s.row, pressed && { backgroundColor: '#1D2B44' }]} onPress={() => onPick(item)}>
            <View style={[s.pin, item.source === 'PAASXO' && s.pinPaasxo]}>
              <MapPin color="#fff" size={16} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>{item.name}</Text>
              {!!item.address && <Text style={s.address} numberOfLines={1}>{item.address}</Text>}
            </View>
            {item.source === 'PAASXO' && (
              <View style={s.badge}><Text style={s.badgeText}>On Paasxo</Text></View>
            )}
          </Pressable>
        )}
      />
    </SheetFrame>
  );
}

const s = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, borderRadius: 14,
    backgroundColor: sheetColors.card, borderWidth: 1, borderColor: sheetColors.border, paddingHorizontal: 14,
  },
  input: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 0 },
  removeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  removeText: { color: '#FF8A8A', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 6, borderRadius: 12 },
  pin: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#24324A', alignItems: 'center', justifyContent: 'center' },
  pinPaasxo: { backgroundColor: sheetColors.blue },
  name: { color: '#fff', fontSize: 15, fontWeight: '800' },
  address: { color: sheetColors.muted, fontSize: 12.5, marginTop: 2 },
  badge: { backgroundColor: 'rgba(34,211,238,0.18)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: sheetColors.accent, fontSize: 10.5, fontWeight: '900' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 34 },
  emptyText: { color: sheetColors.muted, fontSize: 13.5, textAlign: 'center' },
});
