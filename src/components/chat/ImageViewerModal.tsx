import React from 'react';
import { Image, Modal, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { Download, X } from 'lucide-react-native';

/** Full-screen photo, with save-to-gallery. */
export function ImageViewerModal({ uri, onClose, onSave }: { uri: string | null; onClose: () => void; onSave: (uri: string) => void }) {
  if (!uri) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar hidden />
      <View style={s.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Image source={{ uri }} style={s.image} resizeMode="contain" />
        <View style={s.bar}>
          <Pressable onPress={() => onSave(uri)} hitSlop={10} style={s.btn} accessibilityLabel="Save photo"><Download color="#fff" size={22} /></Pressable>
          <Pressable onPress={onClose} hitSlop={10} style={s.btn} accessibilityLabel="Close"><X color="#fff" size={24} /></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  image: { width: '100%', height: '80%' },
  bar: { position: 'absolute', top: 54, right: 16, flexDirection: 'row', gap: 10 },
  btn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
