import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { Colors } from '../styles/colors';
import { giphyApi, GifResult } from '../api/giphyApi';

interface GifPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (gifUrl: string) => void;
}

const COLUMNS = 3;

export function GifPickerSheet({ visible, onClose, onSelect }: GifPickerSheetProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setGifs([]);
      return;
    }
    // Show trending as soon as the sheet opens, before the user types anything.
    setLoading(true);
    giphyApi.getTrendingGifs().then(setGifs).catch(() => setGifs([])).finally(() => setLoading(false));
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setLoading(true);
      giphyApi.getTrendingGifs().then(setGifs).catch(() => setGifs([])).finally(() => setLoading(false));
      return;
    }

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      giphyApi.searchGifs(query.trim()).then(setGifs).catch(() => setGifs([])).finally(() => setLoading(false));
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, visible]);

  const handleSelect = (gif: GifResult) => {
    onSelect(gif.url);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>Send a GIF</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X color={Colors.text} size={20} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Search color={Colors.textMuted} size={15} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search GIPHY..."
              placeholderTextColor={Colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            {loading && <ActivityIndicator size="small" color={Colors.primary} />}
          </View>

          <FlatList
            data={gifs}
            key={COLUMNS}
            numColumns={COLUMNS}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.grid}
            ListEmptyComponent={
              !loading ? <Text style={styles.emptyText}>No GIFs found</Text> : null
            }
            renderItem={({ item }) => (
              <Pressable style={styles.gifTile} onPress={() => handleSelect(item)}>
                <Image source={{ uri: item.previewUrl }} style={styles.gifImage} resizeMode="cover" />
              </Pressable>
            )}
          />

          <Text style={styles.attribution}>Powered by GIPHY</Text>
        </View>
      </View>
    </Modal>
  );
}

const TILE_SIZE = 110;

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '75%',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  handle: {
    width: 40, height: 4, backgroundColor: Colors.neutral200, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: Colors.text },
  closeBtn: { padding: 4 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.neutral100, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  emptyText: { textAlign: 'center', color: Colors.textMuted, fontSize: 13, marginTop: 24 },
  grid: { paddingBottom: 12, gap: 6 },
  gifTile: {
    width: TILE_SIZE, height: TILE_SIZE, margin: 3,
    borderRadius: 10, overflow: 'hidden', backgroundColor: Colors.neutral100,
  },
  gifImage: { width: '100%', height: '100%' },
  attribution: { textAlign: 'center', fontSize: 10, color: Colors.textMuted, paddingVertical: 4 },
});
