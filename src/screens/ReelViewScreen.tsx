import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { reelApi } from '../api/reelApi';
import { ReelSummary } from '../types/api';
import { ReelPlayer } from '../components/ReelPlayer';
import { useTheme } from '../context/ThemeContext';
import { goBack } from '../utils/navigation';

/**
 * Thin route wrapper around ReelPlayer (normally opened in-place from
 * ReelGrid, which already has the full ReelSummary on hand) — this is the
 * one path that needs to resolve a reel by id alone, reached from a reel
 * shared into a Community's feed (see PostCard's isReelShare branch).
 */
export default function ReelViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [reel, setReel] = useState<ReelSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    reelApi.getById(id).then((r) => { setReel(r); setLoading(false); });
  }, [id]);

  const handleClose = () => goBack(router);

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!reel) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textMuted, fontSize: 15 }}>This reel isn't available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <ReelPlayer visible reel={reel} onClose={handleClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
