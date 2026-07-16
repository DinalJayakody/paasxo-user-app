import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image as ImageIcon, Send, X } from 'lucide-react-native';
import { Colors } from '../styles/colors';
import { socialMediaApi } from '../api/socialMediaApi';
import { useAuth } from '../context/AuthContext';
import { CommentItem } from '../types/api';
import { parseMediaUrl, formatTimeAgo } from '../utils/postFormat';
import { postInteractionStore } from '../stores/postInteractionStore';
import { GifPickerSheet } from './GifPickerSheet';

interface CommentSheetProps {
  postId: string;
  visible: boolean;
  onClose: () => void;
}

export function CommentSheet({ postId, visible, onClose }: CommentSheetProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [gifPickerVisible, setGifPickerVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    socialMediaApi.getComments(postId)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [visible, postId]);

  const submit = async (payload: { content?: string; gifUrl?: string }) => {
    setSubmitting(true);
    try {
      const saved = await socialMediaApi.addComment(postId, payload);
      const newComment: CommentItem = saved ?? {
        id: `local-${Date.now()}`,
        postId,
        firebaseUid: user?.firebaseUid ?? '',
        displayName: user?.displayName ?? 'You',
        profileImageUrl: typeof user?.profileImageUrl === 'string' ? user.profileImageUrl : undefined,
        createdAt: new Date().toISOString(),
        ...payload,
      };
      setComments((prev) => [newComment, ...prev]);
      postInteractionStore.incrementComments(postId);
      setText('');
    } catch {
      // Leave the input text in place so the user can retry.
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendText = () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    submit({ content: trimmed });
  };

  const handleSelectGif = (gifUrl: string) => {
    if (submitting) return;
    submit({ gifUrl });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          style={styles.sheet}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>Comments</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X color={Colors.text} size={20} strokeWidth={2.5} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={comments}
              style={styles.commentsList}
              keyExtractor={(c) => String(c.id)}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.emptyText}>No comments yet. Be the first!</Text>}
              renderItem={({ item }) => {
                const avatarUri = parseMediaUrl(item.profileImageUrl);
                return (
                  <View style={styles.commentRow}>
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text style={styles.avatarInitial}>{(item.displayName || 'U')[0].toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.commentBody}>
                      <Text style={styles.commentAuthor}>{item.displayName}</Text>
                      {item.gifUrl ? (
                        <Image source={{ uri: item.gifUrl }} style={styles.commentGif} resizeMode="cover" />
                      ) : (
                        <Text style={styles.commentText}>{item.content}</Text>
                      )}
                      <Text style={styles.commentTime}>{formatTimeAgo(item.createdAt)}</Text>
                    </View>
                  </View>
                );
              }}
            />
          )}

          <View style={styles.inputRow}>
            <Pressable style={styles.gifBtn} onPress={() => setGifPickerVisible(true)} disabled={submitting}>
              <ImageIcon color={Colors.primary} size={20} strokeWidth={2} />
            </Pressable>
            <TextInput
              style={styles.input}
              placeholder="Add a comment..."
              placeholderTextColor={Colors.textMuted}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={180}
            />
            <Pressable
              style={[styles.sendBtn, (!text.trim() || submitting) && styles.sendBtnDisabled]}
              onPress={handleSendText}
              disabled={!text.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Send color={Colors.white} size={16} strokeWidth={2.5} />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>

      <GifPickerSheet
        visible={gifPickerVisible}
        onClose={() => setGifPickerVisible(false)}
        onSelect={handleSelectGif}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '75%',
    paddingHorizontal: 20,
  },
  handle: {
    width: 40, height: 4, backgroundColor: Colors.neutral200, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: Colors.text },
  closeBtn: { padding: 4 },
  commentsList: { flex: 1 },
  list: { paddingBottom: 12, flexGrow: 1 },
  emptyText: { textAlign: 'center', color: Colors.textMuted, fontSize: 13, marginTop: 24 },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  avatarFallback: { backgroundColor: Colors.primary + '22', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  commentBody: { flex: 1 },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  commentText: { fontSize: 13, color: Colors.text, lineHeight: 18 },
  commentGif: { width: 140, height: 140, borderRadius: 10, marginTop: 2, backgroundColor: Colors.neutral100 },
  commentTime: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.neutral100,
  },
  gifBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    flex: 1, maxHeight: 90, backgroundColor: Colors.neutral100, borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, color: Colors.text,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
