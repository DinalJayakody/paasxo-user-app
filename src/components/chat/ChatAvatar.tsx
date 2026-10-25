import React, { memo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { resolveMediaUrl } from '../../utils/mediaUrl';

function initials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const s = (parts[0]?.[0] ?? 'P') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
  return s.toUpperCase();
}

/**
 * Round avatar with an optional green "online" dot. With no photo (or one that
 * fails to load) it draws Paasxo-blue initials — the shared SVG fallback URL
 * can't be rendered by React Native's Image.
 */
export const ChatAvatar = memo(function ChatAvatar({
  uri, name, size = 44, online = false, ringColor,
}: { uri?: string | null; name?: string | null; size?: number; online?: boolean; ringColor: string }) {
  const [failed, setFailed] = useState(false);
  const src = uri ? resolveMediaUrl(uri) : undefined;
  const dot = Math.max(10, Math.round(size * 0.28));
  return (
    <View style={{ width: size, height: size }}>
      {src && !failed ? (
        <Image
          source={{ uri: src }}
          onError={() => setFailed(true)}
          style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#1E293B' }}
        />
      ) : (
        <LinearGradient
          colors={['#22D3EE', '#2977C2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: size * 0.38 }} allowFontScaling={false}>{initials(name)}</Text>
        </LinearGradient>
      )}
      {online && (
        <View
          style={[s.dot, { width: dot, height: dot, borderRadius: dot / 2, borderColor: ringColor }]}
          accessibilityLabel="Online"
        />
      )}
    </View>
  );
});

const s = StyleSheet.create({
  dot: { position: 'absolute', right: -1, bottom: -1, backgroundColor: '#22C55E', borderWidth: 2.5 },
});
