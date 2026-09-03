import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, ChevronDown, ChevronUp, Paperclip, X, Send, Check } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { supportApi, SupportArea } from '../api/supportApi';
import { extractApiError } from '../utils/apiError';
import HeaderIconButton from '../components/HeaderIconButton';
import ScreenGlow from '../components/ScreenGlow';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How do I cancel a booking and get a refund?',
    a: 'Open the match from "My Bookings" and tap "Cancel Booking". Bookings longer than 1 hour must be cancelled more than 48 hours before the match start time for a full refund; bookings of 1 hour or less can be cancelled any time before kickoff.',
  },
  {
    q: 'When do I get charged when I join a match?',
    a: 'You pay your share immediately when you join a paid match. If you organized the match, you\'re charged the full venue cost upfront, and refunded for every slot a paying player fills once the match settles, 48 hours before kickoff.',
  },
  {
    q: 'How do I become a vendor and list my venue?',
    a: 'Sign up with a vendor account from the sign-up screen, then add your venue details, business registration, and availability from the Vendor app.',
  },
  {
    q: 'Why was my booking rejected?',
    a: 'The venue can decline a booking request — you\'ll see the reason (if given) on the match details screen, and any payment is refunded in full automatically.',
  },
];

const AREA_OPTIONS: { value: SupportArea; label: string }[] = [
  { value: 'IT', label: 'IT / App Issue' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'CUSTOMER_SERVICE', label: 'Customer Service' },
  { value: 'VENDOR_ISSUES', label: 'Vendor Issues' },
  { value: 'OTHER', label: 'Other' },
];

export default function HelpCenterScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const [subject, setSubject] = useState('');
  const [area, setArea] = useState<SupportArea | null>(null);
  const [areaPickerVisible, setAreaPickerVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<{ uri: string; mimeType?: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const pickAttachment = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo library access to attach a screenshot.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setAttachments((prev) => [...prev, { uri: result.assets[0].uri, mimeType: result.assets[0].mimeType }]);
    }
  };

  const canSubmit = subject.trim().length > 0 && !!area && description.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !area) return;
    setSubmitting(true);
    try {
      await supportApi.submitTicket({
        subject: subject.trim(),
        area,
        description: description.trim(),
        attachments: attachments.map((a) => ({ uri: a.uri, mimeType: a.mimeType })),
      });
      setSubmitted(true);
      setSubject('');
      setArea(null);
      setDescription('');
      setAttachments([]);
    } catch (err) {
      Alert.alert('Could not submit ticket', extractApiError(err, 'Please try again in a moment.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenGlow />
      {/* Floating glass-gradient header */}
      <View style={styles.topHeaderShadow}>
        <View style={styles.header}>
          <LinearGradient
            colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.headerGlassStroke} pointerEvents="none" />

          <HeaderIconButton onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color={colors.white} size={20} />
          </HeaderIconButton>
          <Text style={styles.title}>Help Center</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* FAQs */}
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.faqList}>
            {FAQS.map((faq, i) => {
              const open = openFaqIndex === i;
              return (
                <Pressable
                  key={faq.q}
                  style={styles.faqItem}
                  onPress={() => setOpenFaqIndex(open ? null : i)}
                >
                  <View style={styles.faqQuestionRow}>
                    <Text style={styles.faqQuestion}>{faq.q}</Text>
                    {open ? (
                      <ChevronUp color={colors.neutral500} size={16} strokeWidth={2} />
                    ) : (
                      <ChevronDown color={colors.neutral500} size={16} strokeWidth={2} />
                    )}
                  </View>
                  {open && <Text style={styles.faqAnswer}>{faq.a}</Text>}
                </Pressable>
              );
            })}
          </View>

          {/* Ticket form */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Submit a Ticket</Text>
          <Text style={styles.sectionSubtitle}>
            Can't find an answer above? Tell us what's going on and we'll get back to you.
          </Text>

          {submitted && (
            <View style={styles.successBanner}>
              <Check color={colors.success} size={16} strokeWidth={2.5} />
              <Text style={styles.successBannerText}>Ticket submitted — we'll be in touch soon.</Text>
            </View>
          )}

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Subject</Text>
            <TextInput
              style={styles.input}
              placeholder="Briefly describe the issue"
              placeholderTextColor={colors.neutral400}
              value={subject}
              onChangeText={setSubject}
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Area</Text>
            <Pressable style={styles.selectInput} onPress={() => setAreaPickerVisible(true)}>
              <Text style={[styles.selectInputText, !area && { color: colors.neutral400 }]}>
                {area ? AREA_OPTIONS.find((o) => o.value === area)?.label : 'Select an area'}
              </Text>
              <ChevronDown color={colors.neutral400} size={16} strokeWidth={2} />
            </Pressable>
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What happened? Include any details that might help us."
              placeholderTextColor={colors.neutral400}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Attachments (optional)</Text>
            <View style={styles.attachmentsRow}>
              {attachments.map((att, i) => (
                <View key={att.uri} style={styles.attachmentThumbWrap}>
                  <Image source={{ uri: att.uri }} style={styles.attachmentThumb} />
                  <Pressable
                    style={styles.attachmentRemove}
                    onPress={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <X color={colors.white} size={10} strokeWidth={3} />
                  </Pressable>
                </View>
              ))}
              <Pressable style={styles.attachmentAddBtn} onPress={pickAttachment}>
                <Paperclip color={colors.primary} size={18} strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          <Pressable
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Send color={colors.white} size={16} strokeWidth={2} />
                <Text style={styles.submitBtnText}>Submit Ticket</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Area picker */}
      <Modal visible={areaPickerVisible} transparent animationType="fade" onRequestClose={() => setAreaPickerVisible(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setAreaPickerVisible(false)}>
          <View style={styles.pickerCard}>
            {AREA_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={styles.pickerOption}
                onPress={() => { setArea(opt.value); setAreaPickerVisible(false); }}
              >
                <Text style={[styles.pickerOptionText, area === opt.value && { color: colors.primary, fontWeight: '800' }]}>
                  {opt.label}
                </Text>
                {area === opt.value && <Check color={colors.primary} size={16} strokeWidth={2.5} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topHeaderShadow: {
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 2,
    borderRadius: 26,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 26,
    overflow: 'hidden',
  },
  headerGlassStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  headerSpacer: { width: 38 },
  title: { fontSize: 18, fontWeight: '900', color: colors.white },
  content: { padding: 16, paddingBottom: 60 },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.neutral900, marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: colors.textSecondary, marginBottom: 14 },

  faqList: { gap: 8 },
  faqItem: { backgroundColor: colors.cardBg, borderRadius: 14, padding: 14 },
  faqQuestionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  faqQuestion: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.neutral900 },
  faqAnswer: { fontSize: 12, color: colors.textSecondary, marginTop: 10, lineHeight: 18 },

  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.success + '18', borderRadius: 12, padding: 12, marginBottom: 14,
  },
  successBannerText: { fontSize: 13, fontWeight: '700', color: colors.success },

  formField: { marginBottom: 14 },
  formLabel: { fontSize: 12, fontWeight: '700', color: colors.neutral700, marginBottom: 6 },
  input: {
    backgroundColor: colors.inputBg, borderRadius: 12, borderWidth: 1, borderColor: colors.neutral200,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.neutral900,
  },
  textArea: { minHeight: 100 },
  selectInput: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.inputBg, borderRadius: 12, borderWidth: 1, borderColor: colors.neutral200,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  selectInputText: { fontSize: 14, color: colors.neutral900, fontWeight: '600' },

  attachmentsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  attachmentThumbWrap: { position: 'relative' },
  attachmentThumb: { width: 56, height: 56, borderRadius: 10 },
  attachmentRemove: {
    position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center',
  },
  attachmentAddBtn: {
    width: 56, height: 56, borderRadius: 10, borderWidth: 1.5, borderColor: colors.primary,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight,
  },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: colors.neutral300 },
  submitBtnText: { fontSize: 14, fontWeight: '800', color: colors.white },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  pickerCard: { backgroundColor: colors.cardBg, borderRadius: 16, padding: 8 },
  pickerOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 14,
  },
  pickerOptionText: { fontSize: 14, color: colors.neutral900, fontWeight: '600' },
});
