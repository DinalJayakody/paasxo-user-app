import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker } from 'react-native-maps';
import { ArrowLeft, Clock, MapPin, Navigation, Wallet } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../styles/colors';
import { futsalApi } from '../api/futsalApi';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { extractApiError } from '../utils/apiError';
import { goBack } from '../utils/navigation';
import { Promotion, discountedPrice, promotionBlurb, todayIso } from '../utils/promotion';
import { MediaGallery, SpecialityChips, GalleryItem } from '../components/MediaGallery';

interface VenueDetail {
  id: number;
  name: string;
  location?: string;
  description?: string;
  imageUrl?: string;
  imageBase64?: string;
  pricePerSlot?: number | null;
  openTime?: string;
  closeTime?: string;
  slotDurationMinutes?: number;
  sports?: string[];
  latitude?: number;
  longitude?: number;
  active?: boolean;
  specialities?: string[];
  media?: GalleryItem[];
  promotion?: Promotion | null;
}

const SPORT_LABEL: Record<string, string> = {
  FUTSAL: 'Futsal', CRICKET: 'Cricket', PICKLEBALL: 'Pickleball', PADDLEBALL: 'Paddleball',
};

function hhmm(t?: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * A venue's public page: photos & videos of the premises, specialities,
 * hours, price and location, with "Book a slot" into the match flow.
 */
export default function VenueDetailsScreen({ venueId }: { venueId: string }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [venue, setVenue] = useState<VenueDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setVenue(await futsalApi.getById(venueId));
    } catch (e) {
      setError(extractApiError(e, 'Could not load this venue.'));
    }
  }, [venueId]);

  useEffect(() => { load(); }, [load]);

  if (!venue) {
    return (
      <View style={[s.root, s.center]}>
        {error ? (
          <>
            <Text style={s.errorText}>{error}</Text>
            <Pressable onPress={load} style={s.retry}><Text style={s.retryText}>Try again</Text></Pressable>
            <Pressable onPress={() => goBack(router)} style={{ marginTop: 12 }}><Text style={s.link}>Go back</Text></Pressable>
          </>
        ) : <ActivityIndicator color={colors.primary} />}
      </View>
    );
  }

  const hero = resolveMediaUrl(venue.imageUrl) || (venue.imageBase64 ? `data:image/jpeg;base64,${venue.imageBase64}` : undefined);
  const hasCoords = venue.latitude != null && venue.longitude != null;
  const bookable = venue.active !== false;

  const openDirections = () => {
    if (!hasCoords) return;
    const q = `${venue.latitude},${venue.longitude}`;
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${q}&q=${encodeURIComponent(venue.name)}`
      : `geo:${q}?q=${q}(${encodeURIComponent(venue.name)})`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`));
  };

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={s.heroWrap}>
          {hero ? (
            <Image source={{ uri: hero }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient colors={[colors.primary, colors.primaryDark]} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.65)']} style={StyleSheet.absoluteFill} />
          <Pressable onPress={() => goBack(router)} style={[s.back, { top: insets.top + 8 }]} hitSlop={8}
            accessibilityRole="button" accessibilityLabel="Back">
            <ArrowLeft color="#fff" size={20} strokeWidth={2.5} />
          </Pressable>
          <View style={s.heroText}>
            <Text style={s.name}>{venue.name}</Text>
            {!!venue.location && (
              <View style={s.row}>
                <MapPin color="#E2E8F0" size={14} />
                <Text style={s.heroLoc} numberOfLines={2}>{venue.location}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={s.body}>
          <View style={s.facts}>
            <Fact s={s} icon={<Wallet color={colors.primary} size={16} />} label="Price"
              value={venue.pricePerSlot != null
                ? `LKR ${Number(discountedPrice(Number(venue.pricePerSlot), venue.promotion, todayIso())).toLocaleString()}`
                : 'Free'}
              sub={venue.slotDurationMinutes ? `per ${venue.slotDurationMinutes} min` : undefined} />
            <Fact s={s} icon={<Clock color={colors.primary} size={16} />} label="Open"
              value={venue.openTime ? hhmm(venue.openTime) : '—'} sub={venue.closeTime ? `to ${hhmm(venue.closeTime)}` : undefined} />
          </View>

          {!!venue.promotion && (
            <View style={s.deal}>
              <View style={s.dealBadge}><Text style={s.dealBadgeText}>{venue.promotion.discountPercent}% OFF</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.dealTitle} numberOfLines={1}>{venue.promotion.label || 'Special offer'}</Text>
                <Text style={s.dealSub}>{promotionBlurb(venue.promotion)} — applied automatically when you book</Text>
              </View>
            </View>
          )}

          {!!venue.sports?.length && (
            <View style={s.sportRow}>
              {venue.sports.map((sp) => (
                <View key={sp} style={s.sportChip}><Text style={s.sportText}>{SPORT_LABEL[sp] ?? sp}</Text></View>
              ))}
            </View>
          )}

          {!!venue.description && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>About</Text>
              <Text style={s.desc}>{venue.description}</Text>
            </View>
          )}

          {!!venue.specialities?.length && (
            <View style={s.section}><SpecialityChips items={venue.specialities} /></View>
          )}

          {!!venue.media?.length && (
            <View style={s.section}><MediaGallery items={venue.media} /></View>
          )}

          {hasCoords && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Location</Text>
              <View style={s.mapWrap}>
                <MapView
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                  initialRegion={{ latitude: venue.latitude!, longitude: venue.longitude!, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                >
                  <Marker coordinate={{ latitude: venue.latitude!, longitude: venue.longitude! }} />
                </MapView>
              </View>
              <Pressable onPress={openDirections} style={s.directions} accessibilityRole="button">
                <Navigation color={colors.primary} size={16} />
                <Text style={s.link}>Get directions</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          disabled={!bookable}
          onPress={() => router.push({ pathname: '/create-match', params: { venueId: String(venue.id) } } as any)}
          style={({ pressed }) => [s.bookBtn, (!bookable || pressed) && { opacity: bookable ? 0.88 : 0.5 }]}
          accessibilityRole="button"
        >
          <Text style={s.bookText}>{bookable ? 'Book a slot' : 'Not taking bookings'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Fact({ s, icon, label, value, sub }: {
  s: ReturnType<typeof createStyles>; icon: React.ReactNode; label: string; value: string; sub?: string;
}) {
  return (
    <View style={s.fact}>
      <View style={s.factIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={s.factLabel}>{label}</Text>
        <Text style={s.factValue} numberOfLines={1}>{value}</Text>
        {!!sub && <Text style={s.factSub}>{sub}</Text>}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: colors.textSecondary, textAlign: 'center', fontSize: 15 },
  retry: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary },
  retryText: { color: '#fff', fontWeight: '800' },
  heroWrap: { height: 290, justifyContent: 'flex-end', backgroundColor: colors.primaryDark },
  back: {
    position: 'absolute', left: 16, width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  heroText: { padding: 20 },
  name: { fontSize: 28, fontWeight: '900', color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  heroLoc: { color: '#E2E8F0', fontSize: 14, fontWeight: '600', flex: 1 },
  body: { padding: 20, gap: 4 },
  facts: { flexDirection: 'row', gap: 12 },
  fact: {
    flex: 1, flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16,
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.divider,
  },
  factIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primary + '1A', alignItems: 'center', justifyContent: 'center' },
  factLabel: { fontSize: 11.5, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  factValue: { fontSize: 15.5, fontWeight: '800', color: colors.text, marginTop: 2 },
  factSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  deal: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 14, borderRadius: 16,
    backgroundColor: colors.success + '18', borderWidth: 1, borderColor: colors.success + '40',
  },
  dealBadge: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.success },
  dealBadgeText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  dealTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  dealSub: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  sportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  sportChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.divider },
  sportText: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  section: { marginTop: 22 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 8 },
  desc: { fontSize: 14.5, lineHeight: 21, color: colors.textSecondary },
  mapWrap: { height: 160, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.inputBg },
  directions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start' },
  link: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: colors.cardBg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider,
  },
  bookBtn: { height: 54, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  bookText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
