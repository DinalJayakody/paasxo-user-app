import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Lock, Globe, Users, X } from 'lucide-react-native';
import { ThemeColors, Colors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { communityApi, Community } from '../api/communityApi';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { extractApiError } from '../utils/apiError';

type ShareType = 'MATCH' | 'TOURNAMENT' | 'SCORECARD' | 'REEL';

interface Props {
  visible: boolean;
  onClose: () => void;
  shareType: ShareType;
  referenceId: string;
  /** Shown in the sheet title, e.g. "Share Match" / "Share Reel". */
  label?: string;
}

// Reusable bottom sheet for sharing a match/tournament/scorecard/reel into
// one of the user's own communities — the single entry point every detail
// screen's share button routes "Share to Community" through, so the
// behaviour (membership-only list, caption, success/error handling) stays
// identical everywhere it's used.
export default function ShareToCommunityModal({ visible, onClose, shareType, referenceId, label }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(false);
  const [caption, setCaption] = useState('');
  const [sharingId, setSharingId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCaption('');
    setLoading(true);
    communityApi.getMine(0, 50)
      .then((res) => setCommunities(res.content))
      .catch(() => setCommunities([]))
      .finally(() => setLoading(false));
  }, [visible]);

  const handleShare = async (community: Community) => {
    if (sharingId) return;
    setSharingId(community.id);
    try {
      await communityApi.share(community.id, shareType, referenceId, caption.trim() || undefined);
      onClose();
      Alert.alert('Shared', `Shared to ${community.name}.`);
    } catch (e) {
      Alert.alert('Could not share', extractApiError(e, 'Please try again.'));
    } finally {
      setSharingId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{label || 'Share to Community'}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X color={colors.text} size={22} />
            </Pressable>
          </View>

          <TextInput
            style={styles.captionInput}
            placeholder="Add a caption (optional)"
            placeholderTextColor={colors.neutral400}
            value={caption}
            onChangeText={setCaption}
            maxLength={200}
          />

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : communities.length === 0 ? (
            <View style={styles.empty}>
              <Users color={colors.neutral300} size={32} strokeWidth={1.5} />
              <Text style={styles.emptyText}>Join or create a community to share here.</Text>
            </View>
          ) : (
            <FlatList
              data={communities}
              keyExtractor={(c) => c.id}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.row}
                  disabled={!!sharingId}
                  onPress={() => handleShare(item)}
                >
                  {item.avatarUrl ? (
                    <Image source={{ uri: resolveMediaUrl(item.avatarUrl) }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Users color={colors.primary} size={18} strokeWidth={1.8} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                      {item.isPrivate ? (
                        <Lock color={colors.textMuted} size={11} strokeWidth={2.2} />
                      ) : (
                        <Globe color={colors.textMuted} size={11} strokeWidth={2.2} />
                      )}
                    </View>
                    <Text style={styles.memberCount}>{item.memberCount} member{item.memberCount === 1 ? '' : 's'}</Text>
                  </View>
                  {sharingId === item.id && <ActivityIndicator color={colors.primary} size="small" />}
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  captionInput: {
    fontSize: 14, color: colors.text, backgroundColor: colors.inputBg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14,
  },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 30 },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 30 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.neutral200 },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  avatarPlaceholder: { backgroundColor: colors.primary + '14', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
  memberCount: { fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
});
