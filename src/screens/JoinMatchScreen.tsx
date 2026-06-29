import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  ChevronRight,
  Clock,
  MapPin,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import { PlayerSearchSheet } from '../components/PlayerSearchSheet';
import { invitationApi } from '../api/invitationApi';
import { Colors } from '../styles/colors';
import { bookingApi } from '../api/bookingApi';
import { socialMediaApi } from '../api/socialMediaApi';
import { MatchDetails } from '../types/api';
import { parseMatchDetails } from '../utils/parseMatch';
import { AuthContext } from '../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerProfile {
  firebaseUid: string;
  dbId: string;
  name: string;
  imageUri: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveImageUri(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('http') || url.startsWith('/')) return url;
  return `data:image/jpeg;base64,${url}`;
}

// ─── Sub-components (identical pattern to MatchDetailsScreen) ─────────────────

function PlayerAvatar({
  player,
  size = 44,
  index = 0,
  overlap = true,
}: {
  player: PlayerProfile;
  size?: number;
  index?: number;
  overlap?: boolean;
}) {
  return (
    <View
      style={[
        styles.avatarCircle,
        { width: size, height: size, borderRadius: size / 2 },
        overlap && index > 0 && { marginLeft: -(size * 0.28) },
      ]}
    >
      {player.imageUri ? (
        <Image source={{ uri: player.imageUri }} style={styles.avatarImage} />
      ) : (
        <Text style={[styles.avatarInitial, { fontSize: size * 0.36 }]}>
          {player.name.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

function AvatarRow({
  players,
  maxVisible = 5,
  onPress,
}: {
  players: PlayerProfile[];
  maxVisible?: number;
  onPress: () => void;
}) {
  const visible = players.slice(0, maxVisible);
  const extra = players.length - visible.length;

  if (players.length === 0) return null;

  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={styles.avatarRow}>
      {visible.map((p, i) => (
        <PlayerAvatar key={p.firebaseUid} player={p} index={i} />
      ))}
      {extra > 0 && (
        <View style={[styles.avatarCircle, styles.avatarExtra, { marginLeft: -12 }]}>
          <Text style={styles.avatarExtraText}>+{extra}</Text>
        </View>
      )}
      <ChevronRight color={Colors.primary} size={16} strokeWidth={2.5} style={{ marginLeft: 8 }} />
    </TouchableOpacity>
  );
}

function ParticipantsModal({
  visible,
  players,
  onClose,
  onPlayerPress,
}: {
  visible: boolean;
  players: PlayerProfile[];
  onClose: () => void;
  onPlayerPress: (p: PlayerProfile) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Participants ({players.length})</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X color={Colors.text} size={20} strokeWidth={2.5} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
            {players.length === 0 ? (
              <Text style={styles.modalEmpty}>No participants yet.</Text>
            ) : (
              players.map((player) => (
                <TouchableOpacity
                  key={player.firebaseUid}
                  style={styles.modalPlayerRow}
                  activeOpacity={0.72}
                  onPress={() => { onClose(); onPlayerPress(player); }}
                >
                  <View style={[styles.avatarCircle, { width: 52, height: 52, borderRadius: 26 }]}>
                    {player.imageUri ? (
                      <Image source={{ uri: player.imageUri }} style={styles.avatarImage} />
                    ) : (
                      <Text style={[styles.avatarInitial, { fontSize: 20 }]}>
                        {player.name.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.modalPlayerName}>{player.name}</Text>
                    <Text style={styles.modalPlayerSub}>Tap to view profile</Text>
                  </View>
                  <ChevronRight color={Colors.neutral400} size={18} strokeWidth={2} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

interface JoinMatchScreenProps {
  matchId: string;
}

export default function JoinMatchScreen({ matchId }: JoinMatchScreenProps) {
  const router = useRouter();
  const { user } = useContext(AuthContext);

  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerProfiles, setPlayerProfiles] = useState<PlayerProfile[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [showInviteSheet, setShowInviteSheet] = useState(false);

  const loadMatch = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await bookingApi.getById(matchId);
      setMatch(parseMatchDetails(raw));
    } catch (err) {
      console.warn('Failed to load match', err);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    loadMatch();
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } catch { /* silent */ }
    })();
  }, [loadMatch]);

  // Enrich participant profiles — same logic as MatchDetailsScreen
  useEffect(() => {
    const participants = match?.participants || [];
    if (participants.length === 0) { setPlayerProfiles([]); return; }

    const alreadyEnriched = participants.every(
      (p) => p.name && !p.name.startsWith('Player ')
    );

    if (alreadyEnriched) {
      setPlayerProfiles(participants.map((p) => ({
        firebaseUid: p.id,
        dbId: p.id,
        name: p.name,
        imageUri: resolveImageUri(p.avatarUrl),
      })));
      return;
    }

    const fetchProfiles = async () => {
      const uids = participants.map((p) => p.id).filter(Boolean);
      try {
        const raw = await socialMediaApi.getUsersByFirebaseUids(uids);
        const byUid: Record<string, any> = {};
        raw.forEach((u: any) => { byUid[u.firebaseUid ?? u.id ?? ''] = u; });
        setPlayerProfiles(participants.map((p) => {
          const u = byUid[p.id];
          return {
            firebaseUid: p.id,
            dbId: p.id,
            name: u?.displayName || u?.name || p.name,
            imageUri: resolveImageUri(u?.profileImageUrl ?? u?.avatarUrl ?? p.avatarUrl),
          };
        }));
      } catch {
        setPlayerProfiles(participants.map((p) => ({
          firebaseUid: p.id,
          dbId: p.id,
          name: p.name,
          imageUri: resolveImageUri(p.avatarUrl),
        })));
      }
    };
    fetchProfiles();
  }, [match]);


  const handlePlayerPress = (p: PlayerProfile) => {
    if (user?.firebaseUid && p.firebaseUid === user.firebaseUid) {
      router.push('/profile' as any);
      return;
    }
    if (p.dbId) router.push(`/friend-profile?user=${p.dbId}` as any);
  };

  if (loading || !match) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  const sym = match.currencySymbol ?? '£';
  const totalPrice = match.totalPrice ?? match.pricePerSlot ?? 0;
  const slotCount = match.slotCount ?? 1;
  const maxSpots = match.maxSpots;
  const joinedCount = playerProfiles.length || match.joinedPlayers || match.participants?.length || 0;
  const spotsLeft = maxSpots != null ? Math.max(0, maxSpots - joinedCount) : null;
  const isFull = spotsLeft != null && spotsLeft === 0;

  const alreadyJoined = !!user?.firebaseUid &&
    playerProfiles.some((p) => p.firebaseUid === user.firebaseUid);

  const perPlayer = match.pricePerPlayer ??
    (totalPrice > 0 && maxSpots && maxSpots > 0 ? totalPrice / maxSpots : null);

  const heroUri = match.images?.[0] ? resolveImageUri(match.images[0]) : null;
  const venueLatLng = (match.venue?.latitude != null && match.venue?.longitude != null)
    ? { latitude: Number(match.venue.latitude), longitude: Number(match.venue.longitude) }
    : null;
  const mapRegion = venueLatLng
    ? { ...venueLatLng, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : userCoords
    ? { latitude: userCoords.lat, longitude: userCoords.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : null;

  const startDate = match.startDate ? new Date(match.startDate) : null;
  const endDate = match.endDate ? new Date(match.endDate) : null;
  const dateLabel = startDate
    ? startDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : 'TBD';
  const timeLabel = startDate
    ? `${startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}${endDate ? ` – ${endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : ''}`
    : '';

  const handleJoinGame = () => {
    if (alreadyJoined || isFull) return;
    router.push(`/join-checkout/${matchId}` as any);
  };

  return (
    <SafeAreaView style={styles.flex1} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>

        {/* Hero */}
        <View style={styles.heroContainer}>
          {heroUri
            ? <Image source={{ uri: heroUri }} style={styles.heroImage} resizeMode="cover" />
            : <View style={[styles.heroImage, styles.heroPlaceholder]}>
                <Users color={Colors.textMuted} size={52} strokeWidth={1.5} />
              </View>
          }
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft color={Colors.white} size={22} strokeWidth={2.5} />
          </Pressable>
          {match.sportType && (
            <View style={styles.sportBadge}>
              <Text style={styles.sportBadgeText}>{match.sportType.replace(/_/g, ' ')}</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>

          <Text style={styles.title}>{match.title}</Text>

          {/* Spots pill */}
          {maxSpots != null && (
            <View style={[styles.spotsPill, isFull && styles.spotsPillFull]}>
              <Users color={isFull ? Colors.error : Colors.primary} size={14} strokeWidth={2} />
              <Text style={[styles.spotsText, isFull && styles.spotsTextFull]}>
                {joinedCount}/{maxSpots} Players{isFull ? '  ·  Full' : spotsLeft != null ? `  ·  ${spotsLeft} spots left` : ''}
              </Text>
            </View>
          )}

          {/* Date / Time / Venue */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}><Calendar color={Colors.primary} size={16} strokeWidth={2} /></View>
              <Text style={styles.infoText}>{dateLabel}</Text>
            </View>
            {timeLabel ? (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}><Clock color={Colors.primary} size={16} strokeWidth={2} /></View>
                <Text style={styles.infoText}>{timeLabel}{slotCount > 1 ? `  ·  ${slotCount} slots` : ''}</Text>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}><MapPin color={Colors.primary} size={16} strokeWidth={2} /></View>
              <Text style={styles.infoText}>
                {match.venue?.name ?? 'Venue TBD'}{match.venue?.city ? `\n${match.venue.city}` : ''}
              </Text>
            </View>
          </View>

          {/* Map */}
          {mapRegion && (
            <View style={styles.mapSection}>
              <Text style={styles.sectionTitle}>Location</Text>
              <View style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  initialRegion={mapRegion}
                  showsUserLocation={true}
                  showsMyLocationButton={false}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  {venueLatLng && (
                    <Marker coordinate={venueLatLng} title={match.venue?.name ?? 'Venue'} />
                  )}
                </MapView>
              </View>
            </View>
          )}

          {/* Pricing */}
          {totalPrice > 0 && (
            <>
              <Text style={styles.sectionTitle}>Pricing</Text>
              <View style={styles.pricingCard}>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>
                    Total Match Cost{slotCount > 1 ? ` (${slotCount} slots)` : ''}
                  </Text>
                  <Text style={styles.priceValue}>{sym}{Number(totalPrice).toFixed(2)}</Text>
                </View>
                {perPlayer != null && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Per Player</Text>
                    <Text style={[styles.priceValue, { color: Colors.primary }]}>
                      {sym}{Number(perPlayer).toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* Participants — clickable avatar row + modal */}
          <View style={styles.participantsHeader}>
            <Text style={styles.sectionTitle}>Participants</Text>
            {playerProfiles.length > 0 && (
              <Text style={styles.participantCount}>{joinedCount} joined</Text>
            )}
          </View>
          {playerProfiles.length > 0 ? (
            <View style={styles.participantsCard}>
              <AvatarRow
                players={playerProfiles}
                maxVisible={5}
                onPress={() => setShowModal(true)}
              />
            </View>
          ) : (
            <View style={styles.participantsCard}>
              <Text style={styles.emptyParticipants}>No participants yet</Text>
            </View>
          )}

          {/* Invite Players */}
          {!isFull && (
            <View style={styles.addPlayersSection}>
              <Text style={styles.sectionTitle}>Invite Players</Text>
              <Pressable style={styles.searchTrigger} onPress={() => setShowInviteSheet(true)}>
                <UserPlus color={Colors.primary} size={16} strokeWidth={2} />
                <Text style={styles.searchTriggerText}>Search &amp; invite friends</Text>
                <ChevronRight color={Colors.textMuted} size={14} strokeWidth={2} style={{ marginLeft: 'auto' as any }} />
              </Pressable>
              {spotsLeft != null && spotsLeft <= 3 && (
                <View style={styles.warningRow}>
                  <AlertCircle color={Colors.warning} size={14} strokeWidth={2} />
                  <Text style={styles.warningText}>Only {spotsLeft} spot(s) remaining!</Text>
                </View>
              )}
            </View>
          )}

          {alreadyJoined && (
            <View style={styles.joinedBanner}>
              <Text style={styles.joinedBannerText}>You have already joined this match</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {perPlayer != null && !alreadyJoined && !isFull && (
          <View style={styles.bottomPriceRow}>
            <Text style={styles.bottomPriceLabel}>Your cost</Text>
            <Text style={styles.bottomPrice}>{sym}{Number(perPlayer).toFixed(2)}</Text>
          </View>
        )}
        <Pressable
          style={[styles.joinBtn, (alreadyJoined || isFull) && styles.joinBtnDisabled]}
          disabled={alreadyJoined || isFull}
          onPress={handleJoinGame}
        >
          <Text style={styles.joinBtnText}>
            {alreadyJoined ? 'Already Joined' : isFull ? 'Match Full' : 'Join Game'}
          </Text>
        </Pressable>
      </View>

      {/* Participants modal */}
      <ParticipantsModal
        visible={showModal}
        players={playerProfiles}
        onClose={() => setShowModal(false)}
        onPlayerPress={handlePlayerPress}
      />

      {/* Invite sheet */}
      <PlayerSearchSheet
        visible={showInviteSheet}
        onClose={() => setShowInviteSheet(false)}
        excludeUids={[
          ...(match.participants ?? []).map((p) => p.id),
          user?.firebaseUid ?? '',
        ]}
        onRequestToJoin={async (player) => {
          await invitationApi.invite(matchId, player.firebaseUid);
        }}
        onDirectAdd={async (player) => {
          await invitationApi.directAdd(matchId, player.firebaseUid);
        }}
        title="Invite Players"
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex1: { flex: 1, backgroundColor: Colors.background },
  loadingScreen: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },

  // Hero
  heroContainer: { position: 'relative', height: 240 },
  heroImage: { width: '100%', height: 240 },
  heroPlaceholder: { backgroundColor: Colors.neutral200, alignItems: 'center', justifyContent: 'center' },
  backBtn: { position: 'absolute', top: 14, left: 16, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20, padding: 8 },
  sportBadge: { position: 'absolute', bottom: 14, right: 14, backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  sportBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.white, textTransform: 'uppercase' },

  content: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 10 },

  spotsPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primaryLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 16 },
  spotsPillFull: { backgroundColor: '#FFE5E5' },
  spotsText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  spotsTextFull: { color: Colors.error },

  infoCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, gap: 10, marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '500', paddingTop: 5 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 10 },

  mapSection: { marginBottom: 20 },
  mapContainer: { borderRadius: 14, overflow: 'hidden', height: 190 },
  map: { flex: 1 },

  pricingCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 20 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  priceLabel: { fontSize: 14, color: Colors.textSecondary },
  priceValue: { fontSize: 15, fontWeight: '700', color: Colors.text },

  // Participants
  participantsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  participantCount: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  participantsCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 20 },
  emptyParticipants: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingVertical: 8 },

  // Avatar row (same tokens as MatchDetailsScreen)
  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.white,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitial: { fontWeight: '700', color: Colors.white },
  avatarExtra: { backgroundColor: Colors.neutral200 },
  avatarExtraText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.neutral300, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  modalEmpty: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingVertical: 24 },
  modalPlayerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.neutral100 },
  modalPlayerName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  modalPlayerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  // Add players
  addPlayersSection: { marginBottom: 16 },
  searchTrigger: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white, borderRadius: 12, padding: 13, marginBottom: 8 },
  searchTriggerText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, borderWidth: 1.5, borderColor: Colors.primary },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  playerList: { backgroundColor: Colors.white, borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  playerOption: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.neutral100 },
  searchAvatarWrap: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  searchAvatarImg: { width: '100%', height: '100%' },
  searchAvatarFallback: { width: '100%', height: '100%', backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  searchAvatarInitial: { fontSize: 13, fontWeight: '700', color: Colors.white },
  playerName: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  playerChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primaryLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  warningText: { fontSize: 12, fontWeight: '600', color: Colors.warning },

  // Already joined
  joinedBanner: { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10 },
  joinedBannerText: { fontSize: 14, fontWeight: '700', color: '#2E7D32' },

  // Bottom bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.white, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 16, borderTopWidth: 1, borderTopColor: Colors.neutral200 },
  bottomPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bottomPriceLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  bottomPrice: { fontSize: 20, fontWeight: '800', color: Colors.text },
  joinBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  joinBtnDisabled: { backgroundColor: Colors.neutral300 },
  joinBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
