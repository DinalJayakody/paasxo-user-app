import React, { useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

interface FullScreenImageViewerProps {
  visible: boolean;
  imageUri?: string | null;
  onClose: () => void;
}

const DOUBLE_TAP_MS = 280;
const ZOOMED_SCALE = 2.4;

// Full-bleed photo viewer used by both the owner's profile and a friend's
// profile - double tap to zoom in/out, single tap the backdrop or the X to
// dismiss. Kept dependency-free (no gesture-handler) since a double-tap
// toggle covers the "view my/their photo full screen" need without the
// complexity/risk of a full pinch-to-zoom pan responder.
//
// RN's Modal renders into its own native root (a separate window on iOS, a
// Dialog on Android), so it doesn't inherit insets from the app's top-level
// SafeAreaProvider the normal way - especially with statusBarTranslucent,
// where the modal's own window extends behind the status bar. Nesting a
// fresh SafeAreaProvider here forces a real re-measurement for this modal's
// own window instead of reusing the (wrong) outer app-window insets, which
// is what was pushing the close button up under the status bar/notch.
export function FullScreenImageViewer({ visible, imageUri, onClose }: FullScreenImageViewerProps) {
  const handleClose = () => onClose();

  if (!imageUri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
      <StatusBar barStyle="light-content" />
      <SafeAreaProvider>
        <ViewerContent imageUri={imageUri} onClose={handleClose} />
      </SafeAreaProvider>
    </Modal>
  );
}

function ViewerContent({ imageUri, onClose }: { imageUri: string; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [zoomed, setZoomed] = useState(false);
  const lastTapRef = useRef(0);

  const toggleZoom = () => {
    const now = Date.now();
    if (now - lastTapRef.current > DOUBLE_TAP_MS) {
      lastTapRef.current = now;
      return;
    }
    lastTapRef.current = 0;
    const next = !zoomed;
    setZoomed(next);
    Animated.spring(scaleAnim, {
      toValue: next ? ZOOMED_SCALE : 1,
      useNativeDriver: true,
      friction: 7,
    }).start();
  };

  const handleClose = () => {
    setZoomed(false);
    scaleAnim.setValue(1);
    onClose();
  };

  return (
    <View style={styles.backdrop}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 8, paddingRight: insets.right + 16 }]}>
        <Pressable onPress={handleClose} style={styles.closeButton} hitSlop={12}>
          <X color="#FFFFFF" size={22} strokeWidth={2.5} />
        </Pressable>
      </View>

      <Pressable style={styles.imageWrap} onPress={toggleZoom}>
        <Animated.Image
          source={{ uri: imageUri }}
          resizeMode="contain"
          style={[
            styles.image,
            { width, height: height * 0.85, transform: [{ scale: scaleAnim }] },
          ]}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  headerRow: {
    position: 'absolute', top: 0, right: 0, left: 0, zIndex: 2,
    flexDirection: 'row', justifyContent: 'flex-end',
  },
  closeButton: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  imageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: {},
});
