import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, Flag, X } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { socialMediaApi } from '../api/socialMediaApi';
import { REPORT_REASONS, ReportReason, ReportTargetType } from '../types/api';

interface ReportSheetProps {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
}

// Required by App Store Review Guideline 1.2 (User Generated Content) - lets
// people flag a post, comment, or account for review. See
// com.pasxo.controller.ModerationController on the backend.
export function ReportSheet({ visible, onClose, targetType, targetId }: ReportSheetProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const reset = () => {
    setReason(null);
    setDetails('');
    setSubmitting(false);
    setSubmitted(false);
    setError(undefined);
  };

  const handleClose = () => {
    onClose();
    // Wait for the close animation before wiping state, so the sheet doesn't
    // visibly flash back to the reason list while it's sliding away.
    setTimeout(reset, 300);
  };

  const handleSubmit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    setError(undefined);
    try {
      await socialMediaApi.reportContent({ targetType, targetId, reason, details: details.trim() || undefined });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not submit your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const targetLabel = targetType === 'POST' ? 'post' : targetType === 'COMMENT' ? 'comment' : 'account';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <KeyboardAvoidingView
          style={styles.sheet}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.handle} />

          {submitted ? (
            <View style={styles.doneState}>
              <View style={styles.doneIcon}>
                <Check color={colors.white} size={26} strokeWidth={3} />
              </View>
              <Text style={styles.doneTitle}>Report submitted</Text>
              <Text style={styles.doneSubtitle}>Thanks for helping keep Paasxo safe — our team will take a look.</Text>
              <Pressable style={styles.doneBtn} onPress={handleClose}>
                <Text style={styles.doneBtnText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <Flag color={colors.error} size={18} strokeWidth={2.5} />
                  <Text style={styles.headerTitle}>Report {targetLabel}</Text>
                </View>
                <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
                  <X color={colors.text} size={20} strokeWidth={2.5} />
                </Pressable>
              </View>
              <Text style={styles.subtitle}>Why are you reporting this {targetLabel}?</Text>

              <View style={styles.reasonList}>
                {REPORT_REASONS.map((r) => {
                  const active = reason === r.value;
                  return (
                    <Pressable
                      key={r.value}
                      style={[styles.reasonRow, active && styles.reasonRowActive]}
                      onPress={() => setReason(r.value)}
                    >
                      <Text style={[styles.reasonText, active && styles.reasonTextActive]}>{r.label}</Text>
                      <View style={[styles.radio, active && styles.radioActive]}>
                        {active && <View style={styles.radioDot} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                style={styles.detailsInput}
                placeholder="Add details (optional)"
                placeholderTextColor={colors.textMuted}
                value={details}
                onChangeText={setDetails}
                multiline
                maxLength={500}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable
                style={[styles.submitBtn, (!reason || submitting) && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={!reason || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Report</Text>
                )}
              </Pressable>
            </>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  handle: {
    width: 40, height: 4, backgroundColor: colors.neutral200, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  closeBtn: { padding: 4 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 6, marginBottom: 16 },

  reasonList: { gap: 4, marginBottom: 14 },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12,
    borderWidth: 1, borderColor: colors.neutral200,
  },
  reasonRowActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  reasonText: { fontSize: 14, fontWeight: '600', color: colors.text },
  reasonTextActive: { color: colors.primary },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.neutral300,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },

  detailsInput: {
    minHeight: 60, maxHeight: 100, backgroundColor: colors.neutral100, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text,
    textAlignVertical: 'top', marginBottom: 12,
  },
  errorText: { color: colors.error, fontSize: 13, marginBottom: 10, textAlign: 'center' },

  submitBtn: {
    height: 50, borderRadius: 25, backgroundColor: colors.error,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },

  doneState: { alignItems: 'center', paddingVertical: 20, paddingBottom: 12, gap: 6 },
  doneIcon: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  doneTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  doneSubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 20, lineHeight: 19 },
  doneBtn: {
    marginTop: 16, height: 46, paddingHorizontal: 32, borderRadius: 23,
    backgroundColor: colors.neutral900, alignItems: 'center', justifyContent: 'center',
  },
  doneBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
});
