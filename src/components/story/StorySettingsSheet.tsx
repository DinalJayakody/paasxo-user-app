import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { ChevronRight, EyeOff, MessageCircle, Repeat2 } from 'lucide-react-native';
import { StorySettings, storyApi } from '../../api/storyApi';
import { extractApiError } from '../../utils/apiError';
import { TagPeopleSheet, TaggedPerson } from '../TagPeopleSheet';
import { SheetFrame, sheetColors } from './SheetFrame';

const MAX_HIDDEN = 500; // mirrors StoryService.MAX_HIDDEN_FROM

/**
 * Story settings (sheet row: settings button top-right of the story camera):
 *  - Hide story from — people who won't see any of your stories.
 *  - Allow replies — viewers can reply; replies arrive in your messages.
 *  - Allow re-sharing — people you tag can add your story to theirs.
 * Each change is saved straight away.
 */
export function StorySettingsSheet({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<StorySettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [hidePicker, setHidePicker] = useState(false);
  // Edited locally while the picker is open; saved once when it closes.
  const [draftHidden, setDraftHidden] = useState<TaggedPerson[] | null>(null);

  useEffect(() => {
    storyApi.getSettings()
      .then(setSettings)
      .catch(() => setError('Couldn’t load your story settings. Check your connection and try again.'));
  }, []);

  const save = async (key: string, patch: Parameters<typeof storyApi.updateSettings>[0], optimistic: Partial<StorySettings>) => {
    if (!settings) return;
    const before = settings;
    setSettings({ ...settings, ...optimistic });
    setSaving(key);
    setError(null);
    try {
      setSettings(await storyApi.updateSettings(patch));
    } catch (e) {
      setSettings(before);
      setError(extractApiError(e, 'Couldn’t save — please try again.'));
    } finally {
      setSaving(null);
    }
  };

  const hidden: TaggedPerson[] = settings?.hiddenFrom ?? [];

  return (
    <SheetFrame title="Story settings" onClose={onClose} heightRatio={0.62}>
      {!settings ? (
        <View style={s.center}>
          {error ? <Text style={s.error}>{error}</Text> : <ActivityIndicator color={sheetColors.accent} />}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
          <Pressable style={s.row} onPress={() => { setDraftHidden(hidden); setHidePicker(true); }} accessibilityRole="button">
            <View style={s.icon}><EyeOff color="#fff" size={18} strokeWidth={2.2} /></View>
            <View style={s.textCol}>
              <Text style={s.title}>Hide story from</Text>
              <Text style={s.sub} numberOfLines={1}>
                {hidden.length === 0 ? 'Everyone who follows you can see your stories'
                  : hidden.length === 1 ? hidden[0].displayName
                  : `${hidden.length} people`}
              </Text>
            </View>
            {saving === 'hidden' ? <ActivityIndicator color="#fff" size="small" /> : <ChevronRight color={sheetColors.muted} size={18} />}
          </Pressable>

          <View style={s.row}>
            <View style={s.icon}><MessageCircle color="#fff" size={18} strokeWidth={2.2} /></View>
            <View style={s.textCol}>
              <Text style={s.title}>Allow replies</Text>
              <Text style={s.sub}>Replies to your story arrive in your messages</Text>
            </View>
            <Switch
              value={settings.repliesEnabled}
              disabled={saving === 'replies'}
              onValueChange={(v) => save('replies', { repliesEnabled: v }, { repliesEnabled: v })}
              trackColor={{ true: sheetColors.blue, false: '#3A475E' }}
            />
          </View>

          <View style={s.row}>
            <View style={s.icon}><Repeat2 color="#fff" size={18} strokeWidth={2.2} /></View>
            <View style={s.textCol}>
              <Text style={s.title}>Allow sharing to stories</Text>
              <Text style={s.sub}>People you tag can add your story to theirs, credited to you</Text>
            </View>
            <Switch
              value={settings.allowReshare}
              disabled={saving === 'reshare'}
              onValueChange={(v) => save('reshare', { allowReshare: v }, { allowReshare: v })}
              trackColor={{ true: sheetColors.blue, false: '#3A475E' }}
            />
          </View>

          {!!error && <Text style={[s.error, { marginTop: 10 }]}>{error}</Text>}
        </ScrollView>
      )}

      <TagPeopleSheet
        visible={hidePicker}
        selected={draftHidden ?? hidden}
        title="Hide story from"
        max={MAX_HIDDEN}
        limitHint={`You can hide your story from up to ${MAX_HIDDEN} people.`}
        searchHint="Search for people who shouldn’t see your stories."
        onChange={setDraftHidden}
        onClose={() => {
          setHidePicker(false);
          const people = draftHidden;
          setDraftHidden(null);
          if (!people) return;
          const same = people.length === hidden.length && people.every((p) => hidden.some((h) => h.firebaseUid === p.firebaseUid));
          if (!same) {
            save('hidden', { hiddenFromUids: people.map((p) => p.firebaseUid) },
              { hiddenFrom: people, hiddenFromUids: people.map((p) => p.firebaseUid) });
          }
        }}
      />
    </SheetFrame>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#24324A', alignItems: 'center', justifyContent: 'center' },
  textCol: { flex: 1 },
  title: { color: '#fff', fontSize: 15, fontWeight: '800' },
  sub: { color: sheetColors.muted, fontSize: 12.5, marginTop: 2 },
  error: { color: '#FF8A8A', fontSize: 13.5, textAlign: 'center' },
});
