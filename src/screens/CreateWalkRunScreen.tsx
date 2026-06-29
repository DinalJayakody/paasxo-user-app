import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, MapPin, Calendar, Clock, UserPlus, ChevronRight } from 'lucide-react-native';
import { Colors } from '../styles/colors';
import axiosInstance from '../api/axios';

const WALK_RUN_GREEN = '#059669';

export default function CreateWalkRunScreen() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [partnerSearch, setPartnerSearch] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [partnerResults, setPartnerResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const searchPartner = async (query: string) => {
    setPartnerSearch(query);
    if (query.length < 2) { setPartnerResults([]); return; }
    try {
      setSearching(true);
      const { data } = await axiosInstance.get('/auth/search', { params: { query } });
      setPartnerResults(data?.results ?? data ?? []);
    } catch {
      setPartnerResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { Alert.alert('Required', 'Please enter a title for your walk/run.'); return; }
    if (!startLocation.trim()) { Alert.alert('Required', 'Please enter a start location.'); return; }
    if (!scheduledDate.trim()) { Alert.alert('Required', 'Please enter a date (YYYY-MM-DD).'); return; }
    if (!scheduledTime.trim()) { Alert.alert('Required', 'Please enter a time (HH:mm).'); return; }

    try {
      setSubmitting(true);
      await axiosInstance.post('/walk-runs', {
        title,
        description,
        startLocationName: startLocation,
        endLocationName: endLocation,
        scheduledDate,
        scheduledTime,
        partnerId: selectedPartnerId,
      });
      Alert.alert('Created!', 'Your walk/run has been scheduled.' + (selectedPartnerId ? ' An invite has been sent to your partner.' : ''), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Failed to create walk/run. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={[WALK_RUN_GREEN, '#047857']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <ArrowLeft color={Colors.white} size={22} strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Schedule Walk / Run</Text>
          <Text style={styles.headerSub}>🏃 Pick a route &amp; invite a partner</Text>
        </View>
        <View style={{ width: 36 }} />
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Morning run through the park"
            placeholderTextColor={Colors.neutral400}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Any notes about the route or pace..."
            placeholderTextColor={Colors.neutral400}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Start Location */}
        <View style={styles.section}>
          <Text style={styles.label}>Start Location *</Text>
          <View style={styles.iconInput}>
            <MapPin color={WALK_RUN_GREEN} size={18} strokeWidth={2} />
            <TextInput
              style={styles.iconInputText}
              placeholder="e.g. Hyde Park, London"
              placeholderTextColor={Colors.neutral400}
              value={startLocation}
              onChangeText={setStartLocation}
            />
          </View>
        </View>

        {/* End Location */}
        <View style={styles.section}>
          <Text style={styles.label}>End Location</Text>
          <View style={styles.iconInput}>
            <MapPin color={Colors.neutral400} size={18} strokeWidth={2} />
            <TextInput
              style={styles.iconInputText}
              placeholder="e.g. Buckingham Palace (optional)"
              placeholderTextColor={Colors.neutral400}
              value={endLocation}
              onChangeText={setEndLocation}
            />
          </View>
        </View>

        {/* Date & Time */}
        <View style={styles.row}>
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.label}>Date *</Text>
            <View style={styles.iconInput}>
              <Calendar color={WALK_RUN_GREEN} size={16} strokeWidth={2} />
              <TextInput
                style={styles.iconInputText}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.neutral400}
                value={scheduledDate}
                onChangeText={setScheduledDate}
              />
            </View>
          </View>
          <View style={{ width: 12 }} />
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.label}>Time *</Text>
            <View style={styles.iconInput}>
              <Clock color={WALK_RUN_GREEN} size={16} strokeWidth={2} />
              <TextInput
                style={styles.iconInputText}
                placeholder="HH:mm"
                placeholderTextColor={Colors.neutral400}
                value={scheduledTime}
                onChangeText={setScheduledTime}
              />
            </View>
          </View>
        </View>

        {/* Partner Search */}
        <View style={styles.section}>
          <Text style={styles.label}>Invite a Partner</Text>
          <View style={styles.iconInput}>
            <UserPlus color={Colors.primary} size={18} strokeWidth={2} />
            <TextInput
              style={styles.iconInputText}
              placeholder="Search by name or username..."
              placeholderTextColor={Colors.neutral400}
              value={partnerSearch}
              onChangeText={searchPartner}
            />
            {searching && <ActivityIndicator size="small" color={Colors.primary} />}
          </View>

          {selectedPartnerId && (
            <View style={styles.partnerSelected}>
              <Text style={styles.partnerSelectedText}>Partner invited ✓</Text>
              <TouchableOpacity onPress={() => { setSelectedPartnerId(null); setPartnerSearch(''); }}>
                <Text style={styles.partnerClear}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}

          {partnerResults.length > 0 && !selectedPartnerId && (
            <View style={styles.searchResults}>
              {partnerResults.slice(0, 5).map((u: any) => (
                <TouchableOpacity
                  key={u.id ?? u._id}
                  style={styles.searchResultRow}
                  onPress={() => {
                    setSelectedPartnerId(u.id ?? u._id);
                    setPartnerSearch(u.displayName ?? u.username ?? 'Partner');
                    setPartnerResults([]);
                  }}
                >
                  <Text style={styles.searchResultName}>{u.displayName ?? u.username}</Text>
                  <Text style={styles.searchResultSub}>{u.email ?? ''}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
          <LinearGradient colors={[WALK_RUN_GREEN, '#047857']} style={styles.submitBtn}>
            {submitting
              ? <ActivityIndicator color={Colors.white} />
              : <>
                  <Text style={styles.submitText}>Schedule Walk / Run</Text>
                  <ChevronRight color={Colors.white} size={20} strokeWidth={2.5} />
                </>
            }
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingTop: 12, paddingBottom: 20,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  scroll: { padding: 20 },
  section: { marginBottom: 16 },
  row: { flexDirection: 'row', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.neutral700, marginBottom: 8 },
  input: {
    backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1.5,
    borderColor: Colors.neutral200, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: Colors.neutral900,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  iconInput: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1.5,
    borderColor: Colors.neutral200, paddingHorizontal: 14, paddingVertical: 12,
  },
  iconInputText: { flex: 1, fontSize: 14, color: Colors.neutral900 },
  searchResults: {
    marginTop: 8, backgroundColor: Colors.white, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.neutral200, overflow: 'hidden',
  },
  searchResultRow: {
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.neutral100,
  },
  searchResultName: { fontSize: 14, fontWeight: '700', color: Colors.neutral900 },
  searchResultSub: { fontSize: 12, color: Colors.neutral500, marginTop: 2 },
  partnerSelected: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 8, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#D1FAE5', borderRadius: 12,
  },
  partnerSelectedText: { fontSize: 13, fontWeight: '700', color: WALK_RUN_GREEN },
  partnerClear: { fontSize: 12, color: Colors.error, fontWeight: '700' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 16, paddingVertical: 16,
  },
  submitText: { fontSize: 16, fontWeight: '800', color: Colors.white },
});
