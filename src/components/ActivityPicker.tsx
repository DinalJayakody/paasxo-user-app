import React, { useMemo } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../styles/colors';
import { OTHER_SPORT_ID, profileActivityOptions } from '../constants/sports';

interface Props {
  selected: string[];
  onToggle: (id: string) => void;
  otherText: string;
  onOtherTextChange: (text: string) => void;
  accountType?: 'USER' | 'VENDOR';
  otherError?: string;
}

/**
 * Profile-activity chips + an "Other" chip that reveals a free-text field
 * ("e.g. Swimming, Yoga"). Shared by sign-up, the social-sign-in profile
 * popup and Edit Profile so all three behave and look the same.
 */
export function ActivityPicker({ selected, onToggle, otherText, onOtherTextChange, accountType = 'USER', otherError }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const options = useMemo(() => profileActivityOptions(accountType), [accountType]);
  const otherOn = selected.includes(OTHER_SPORT_ID);

  return (
    <View>
      <View style={s.grid}>
        {options.map((sport) => {
          const Icon = sport.icon;
          const active = selected.includes(sport.id);
          return (
            <TouchableOpacity
              key={sport.id}
              style={[s.tag, active && s.tagActive]}
              onPress={() => onToggle(sport.id)}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              accessibilityLabel={sport.label}
            >
              <Icon color={active ? colors.primary : colors.textSecondary} size={14} strokeWidth={2} />
              <Text style={[s.tagText, active && s.tagTextActive]}>{sport.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {otherOn && (
        <View style={s.otherWrap}>
          <TextInput
            value={otherText}
            onChangeText={(t) => onOtherTextChange(t.slice(0, 100))}
            placeholder="Your activities, e.g. Swimming, Yoga"
            placeholderTextColor={colors.textMuted}
            style={[s.otherInput, otherError ? { borderColor: colors.error } : null]}
            maxLength={100}
            autoCapitalize="words"
            returnKeyType="done"
            accessibilityLabel="Other activities"
          />
          <Text style={[s.hint, otherError ? { color: colors.error } : null]}>
            {otherError || 'Separate with commas — up to 3.'}
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1.5, borderColor: colors.neutral200, backgroundColor: colors.tagBg,
  },
  tagActive: { borderColor: colors.primary, backgroundColor: colors.tagBgSelected },
  tagText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tagTextActive: { color: colors.primary, fontWeight: '700' },
  otherWrap: { marginTop: 12 },
  otherInput: {
    borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    color: colors.text, backgroundColor: colors.inputBg,
  },
  hint: { marginTop: 6, fontSize: 12, color: colors.textMuted },
});
