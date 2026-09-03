import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { Button } from './Button';
import { InputField } from './InputField';
import { SPORTS } from '../constants/sports';

interface CompleteProfileModalProps {
  visible: boolean;
  displayName?: string;
  onSubmit: (sports: string[], referralCode?: string) => Promise<void>;
  onSignOut: () => void;
}

// Shown once, right after a first-time Google sign-in. The OAuth flow only
// gives us name/email/photo from Google, so this collects the same activity
// + referral code fields the normal registration form collects up front.
export const CompleteProfileModal: React.FC<CompleteProfileModalProps> = ({
  visible,
  displayName,
  onSubmit,
  onSignOut,
}) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const toggleSport = (id: string) => {
    setError(undefined);
    setSelectedSports((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (selectedSports.length === 0) {
      setError('Select at least one activity to continue');
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      await onSubmit(selectedSports, referralCode.trim() || undefined);
      // Reset local state for the next time the modal is shown (e.g. a
      // different account signs in on the same device).
      setSelectedSports([]);
      setReferralCode('');
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        'Could not save your profile. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => {}}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Almost there{displayName ? `, ${displayName.split(' ')[0]}` : ''}!</Text>
            <Text style={styles.subtitle}>
              You signed in with Google — just pick what you play so we can{'\n'}personalize your Paasxo experience.
            </Text>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>SELECT YOUR ACTIVITY</Text>
              <View style={styles.sportsGrid}>
                {SPORTS.map((sport) => {
                  const Icon = sport.icon;
                  const active = selectedSports.includes(sport.id);
                  return (
                    <TouchableOpacity
                      key={sport.id}
                      style={[styles.sportTag, active && styles.sportTagActive]}
                      onPress={() => toggleSport(sport.id)}
                      activeOpacity={0.8}
                    >
                      <Icon
                        color={active ? colors.primary : colors.textSecondary}
                        size={14}
                        strokeWidth={2}
                      />
                      <Text style={[styles.sportTagText, active && styles.sportTagTextActive]}>
                        {sport.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>REFERRAL CODE (OPTIONAL)</Text>
              <InputField
                placeholder="EX: PAASXO_2024"
                value={referralCode}
                onChangeText={setReferralCode}
                autoCapitalize="characters"
              />
            </View>

            {error ? <Text style={styles.generalError}>{error}</Text> : null}

            <Button
              title="Complete Setup"
              onPress={handleSubmit}
              loading={loading}
              style={styles.submitButton}
            />

            <TouchableOpacity
              onPress={onSignOut}
              disabled={loading}
              activeOpacity={0.7}
              style={styles.signOutBtn}
            >
              <Text style={styles.signOutText}>Sign out instead</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.neutral500,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sportTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.neutral200,
    backgroundColor: colors.tagBg,
  },
  sportTagActive: {
    borderColor: colors.primary,
    backgroundColor: colors.tagBgSelected,
  },
  sportTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sportTagTextActive: {
    color: colors.primary,
  },
  generalError: {
    color: colors.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  submitButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  signOutBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
