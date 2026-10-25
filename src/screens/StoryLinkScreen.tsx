import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, X } from 'lucide-react-native';
import { storyApi, UserStoryGroup } from '../api/storyApi';
import { StoryViewer } from '../components/StoryViewer';
import { PaasxoLogoLoader } from '../components/PaasxoLogoLoader';
import { useAuth } from '../context/AuthContext';
import { extractApiError } from '../utils/apiError';
import { goBack } from '../utils/navigation';

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * A single story by id — from a "tagged you in their story" notification/push
 * or a shared link. The server only returns live stories the viewer may see
 * (author, tagged people, followers / public accounts, never across a block).
 */
export default function StoryLinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const storyId = typeof id === 'string' && SAFE_ID.test(id) ? id : null;
  const router = useRouter();
  const { user } = useAuth();
  const [group, setGroup] = useState<UserStoryGroup | null>(null);
  const [error, setError] = useState<string | null>(storyId ? null : 'This story isn’t available.');

  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;
    storyApi.getStory(storyId)
      .then((story) => {
        if (cancelled) return;
        setGroup({
          firebaseUid: story.firebaseUid,
          displayName: story.authorDisplayName,
          profileImageUrl: story.authorProfileImageUrl,
          hasUnseen: !story.viewedByMe,
          isOwn: story.firebaseUid === user?.firebaseUid,
          stories: [story],
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError((err as any)?.response
          ? extractApiError(err, 'This story isn’t available.')
          : 'Couldn’t load this story. Check your connection and try again.');
      });
    return () => { cancelled = true; };
  }, [storyId, user?.firebaseUid]);

  const groups = useMemo(() => (group ? [group] : []), [group]);
  const close = () => goBack(router);

  if (group) {
    return (
      <View style={styles.root}>
        <StoryViewer visible groups={groups} initialGroupIndex={0} onClose={close} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <Pressable onPress={close} style={styles.closeBtn} hitSlop={10} accessibilityLabel="Close">
        <X color="#fff" size={24} strokeWidth={2.4} />
      </Pressable>
      <View style={styles.center}>
        {error ? (
          <>
            <Clock color="rgba(255,255,255,0.6)" size={40} strokeWidth={1.6} />
            <Text style={styles.title}>Story unavailable</Text>
            <Text style={styles.text}>{error.replace(/\.?$/, '.')} Stories disappear after 24 hours.</Text>
          </>
        ) : (
          <PaasxoLogoLoader size={44} elevated={false} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05070C' },
  closeBtn: { position: 'absolute', top: 56, right: 18, zIndex: 2, padding: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 36 },
  title: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 6 },
  text: { color: 'rgba(255,255,255,0.7)', fontSize: 13.5, textAlign: 'center', lineHeight: 20 },
});
