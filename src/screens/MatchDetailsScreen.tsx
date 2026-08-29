import React, { useContext, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Share,
  Linking,
  Platform,
  Alert,
  Modal,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import {
  ArrowLeft,
  Share2,
  Calendar,
  Clock,
  MapPin,
  Star,
  MessageCircle,
  Car,
  ShowerHead,
  Droplets,
  Wifi,
  Users,
  CircleX,
  Goal,
  ChevronRight,
  Lock,
  UserPlus,
  X,
  ShieldCheck,
  AlertCircle,
  Navigation,
} from 'lucide-react-native';
import { PlayerSearchSheet } from '../components/PlayerSearchSheet';
import { invitationApi } from '../api/invitationApi';
import { extractApiError } from '../utils/apiError';
import { Colors } from '../styles/colors';
import { Button } from '../components/Button';
import { bookingApi } from '../api/bookingApi';
import { socialMediaApi } from '../api/socialMediaApi';
import { AuthContext } from '../context/AuthContext';
import { MatchDetails } from '../types/api';
import { parseMatchDetails } from '../utils/parseMatch';
import { useSubscription } from '../hooks/useSubscription';
import { resolveMediaUrl, resolveAvatarUri } from '../utils/mediaUrl';
import { useLiveMatchScore } from '../hooks/useLiveMatchScore';
import { LiveScoreboard } from '../components/scoring/LiveScoreboard';
import { LoadingScreen } from '../components/LoadingScreen';
import { PaasxoRefreshControl } from '../components/PaasxoRefreshControl';
import { PaasxoRefreshLogo } from '../components/PaasxoRefreshLogo';

const SCOREABLE_SPORTS = new Set(['FUTSAL', 'CRICKET', 'PICKLEBALL', 'PADDLEBALL']);

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerProfile {
  firebaseUid: string;
  dbId: string;
  name: string;
  imageUri: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AMENITY_ICONS: Record<string, any> = {
  parking: Car,
  showers: ShowerHead,
  water: Droplets,
  wifi: Wifi,
};

function resolveImageUri(url?: string | null): string | null {
  return resolveMediaUrl(url) ?? null;
}

function formatDateLabel(value?: string) {
  if (!value) return 'Date TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  return isToday
    ? 'Today'
    : date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTimeRange(start?: string, end?: string) {
  const fmt = (value?: string) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  };
  const s = fmt(start);
  const e = fmt(end);
  return e ? `${s} - ${e}` : s;
}

// Opens Google Maps directions (not just a pin search) via the free web deep
// link — no API key, no paid Maps Platform usage — so tapping the venue map
// goes straight into turn-by-turn "Start" driving directions. Same URL
// scheme used for trainer sessions, kept consistent everywhere a location is
// shown, for pending and approved matches alike.
function openInGoogleMaps(match: MatchDetails) {
  const { latitude, longitude, name, address } = match.venue;
  const url =
    latitude != null && longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address || name)}&travelmode=driving`;
  Linking.openURL(url).catch(() => {});
}

function addToCalendar(match: MatchDetails) {
  const toCalendarDate = (v?: string) => {
    const d = v ? new Date(v) : new Date();
    return d.toISOString().replace(/[-:]|\.\d{3}/g, '');
  };
  const url =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(match.title)}` +
    `&dates=${toCalendarDate(match.startDate)}/${toCalendarDate(match.endDate || match.startDate)}` +
    `&location=${encodeURIComponent(match.venue.name)}` +
    `&details=${encodeURIComponent(match.description || 'Match booked via Paasxo')}`;
  Linking.openURL(url).catch(() => {});
}

function shareMatch(match: MatchDetails) {
  Share.share({ message: `Join me for ${match.title} at ${match.venue.name}!` }).catch(() => {});
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Default map center when a venue has no coordinates yet — Colombo, since
// that's this app's home city (was previously London, left over from the
// starter template).
const DEFAULT_VENUE_LAT = 6.9271;
const DEFAULT_VENUE_LNG = 79.8612;

function MapPreview({ match, height = 130 }: { match: MatchDetails; height?: number }) {
  const latitude = match.venue.latitude ?? DEFAULT_VENUE_LAT;
  const longitude = match.venue.longitude ?? DEFAULT_VENUE_LNG;
  return (
    <Pressable onPress={() => openInGoogleMaps(match)} style={[styles.mapWrap, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        initialRegion={{ latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        <Marker coordinate={{ latitude, longitude }} />
      </MapView>
      <View style={styles.mapNavBadge}>
        <Navigation color={Colors.white} size={13} strokeWidth={2.4} />
        <Text style={styles.mapNavBadgeText}>Tap to navigate</Text>
      </View>
    </Pressable>
  );
}

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
          {/* Handle */}
          <View style={styles.modalHandle} />
          {/* Header */}
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

// ─── Root screen ──────────────────────────────────────────────────────────────

interface MatchDetailsScreenProps {
  matchId: string;
}

export default function MatchDetailsScreen({ matchId }: MatchDetailsScreenProps) {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const { active: isPro } = useSubscription();

  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playerProfiles, setPlayerProfiles] = useState<PlayerProfile[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Smooths the jump from the loading spinner to the full Owner/Joiner view —
  // without this the content just pops in the instant the fetch resolves,
  // which if that lands mid-way through the screen's push transition reads
  // as a jarring "combined with the previous screen" glitch rather than a
  // clean slide-in. Only fires once, on first load — not on every refetch
  // triggered by onChanged (e.g. after inviting a player), which should just
  // update in place.
  const contentFade = React.useRef(new Animated.Value(0)).current;
  const hasAnimatedIn = React.useRef(false);

  const loadMatch = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await bookingApi.getById(matchId);
      setMatch(parseMatchDetails(data));
    } catch (err) {
      console.warn('Failed to load match details', err);
      setError('Unable to load match details right now.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => { loadMatch(); }, [loadMatch]);

  useEffect(() => {
    if (loading || hasAnimatedIn.current) return;
    hasAnimatedIn.current = true;
    Animated.timing(contentFade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [loading, contentFade]);

  // Build player profiles from participants.
  // The booking API now returns enriched objects (displayName + profileImageUrl),
  // so skip the extra network call when real names are already present.
  // Fall back to getUsersByFirebaseUids only when names are still placeholders.
  useEffect(() => {
    const participants = match?.participants || [];
    if (participants.length === 0) {
      setPlayerProfiles([]);
      return;
    }

    const alreadyEnriched = participants.every(
      (p) => p.name && !p.name.startsWith('Player ')
    );

    if (alreadyEnriched) {
      // Data from API already has real names — use directly, no extra call needed
      setPlayerProfiles(
        participants.map((p) => ({
          firebaseUid: p.id,
          dbId: p.id, // firebaseUid is the profile lookup key on this backend
          name: p.name,
          imageUri: resolveImageUri(p.avatarUrl),
        }))
      );
      return;
    }

    // Legacy fallback: UIDs only, fetch real profiles from the API
    const fetchProfiles = async () => {
      const uids = participants.map((p) => p.id).filter(Boolean);
      try {
        const raw = await socialMediaApi.getUsersByFirebaseUids(uids);
        const byUid: Record<string, any> = {};
        raw.forEach((u: any) => { byUid[u.firebaseUid ?? u.id ?? ''] = u; });
        setPlayerProfiles(
          participants.map((p) => {
            const u = byUid[p.id];
            return {
              firebaseUid: p.id,
              dbId: p.id,
              name: u?.displayName || u?.name || p.name,
              imageUri: resolveImageUri(u?.profileImageUrl ?? u?.avatarUrl ?? p.avatarUrl),
            };
          })
        );
      } catch {
        setPlayerProfiles(
          participants.map((p) => ({
            firebaseUid: p.id,
            dbId: p.id,
            name: p.name,
            imageUri: resolveImageUri(p.avatarUrl),
          }))
        );
      }
    };
    fetchProfiles();
  }, [match]);

  if (loading) {
    return <LoadingScreen message="Loading match details…" />;
  }

  if (error || !match) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <Text style={styles.errorText}>{error || 'Match not found.'}</Text>
        <Button title="Go back" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </SafeAreaView>
    );
  }

  // isOwner: compare Firebase UID against the booking creator's UID stored by the backend
  const isOwner = !!user?.firebaseUid && !!match.creatorId && user.firebaseUid === match.creatorId;
  // hasJoined: participant IDs are Firebase UIDs from booking_players table
  const hasJoined =
    !!user?.firebaseUid && (match.participants || []).some((p) => p.id === user.firebaseUid);

  const handlePlayerPress = (p: PlayerProfile) => {
    // Current user → own profile tab; anyone else → friend profile
    if (user?.firebaseUid && p.firebaseUid === user.firebaseUid) {
      router.push('/profile' as any);
      return;
    }
    if (p.dbId) router.push(`/friend-profile?user=${p.dbId}` as any);
  };

  return (
    <>
      <Animated.View style={{ flex: 1, opacity: contentFade }}>
        {isOwner ? (
          <OwnerView
            match={match}
            matchId={matchId}
            router={router}
            onChanged={loadMatch}
            playerProfiles={playerProfiles}
            onViewPlayers={() => setShowModal(true)}
            isPro={isPro}
          />
        ) : (
          <JoinerView
            match={match}
            matchId={matchId}
            hasJoined={hasJoined}
            router={router}
            onChanged={loadMatch}
            playerProfiles={playerProfiles}
            onViewPlayers={() => setShowModal(true)}
          />
        )}
      </Animated.View>
      <ParticipantsModal
        visible={showModal}
        players={playerProfiles}
        onClose={() => setShowModal(false)}
        onPlayerPress={handlePlayerPress}
      />
    </>
  );
}

// ─── JoinerView ───────────────────────────────────────────────────────────────

function JoinerView({
  match,
  matchId,
  hasJoined,
  router,
  onChanged,
  playerProfiles,
  onViewPlayers,
}: {
  match: MatchDetails;
  matchId: string;
  hasJoined: boolean;
  router: ReturnType<typeof useRouter>;
  onChanged: () => void;
  playerProfiles: PlayerProfile[];
  onViewPlayers: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const { score, displaySeconds } = useLiveMatchScore(matchId);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await onChanged();
    } finally {
      setRefreshing(false);
    }
  };

  const joinedCount = playerProfiles.length || match.participants?.length || 0;
  const spotsLeftKnown = match.spotsLeft != null;
  const totalSpots = match.maxSpots ?? (spotsLeftKnown ? joinedCount + match.spotsLeft! : undefined);
  const isFull = spotsLeftKnown
    ? match.spotsLeft! <= 0
    : match.maxSpots != null && joinedCount >= match.maxSpots;
  const isCancelled = match.status === 'CANCELLED';
  const spotLabel = totalSpots != null ? `${joinedCount}/${totalSpots} joined` : `${joinedCount} joined`;
  const amenities = (match.venue.amenities || []).map((key) => key.toLowerCase());

  return (
    <View style={styles.flex1}>
      <PaasxoRefreshLogo refreshing={refreshing} />
      <ScrollView
        style={styles.flex1}
        showsVerticalScrollIndicator={false}
        refreshControl={<PaasxoRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.heroWrap}>
          {match.images && match.images.length > 0 ? (
            <Image source={{ uri: match.images[0] }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]} />
          )}
          <SafeAreaView style={styles.heroOverlay} edges={['top']}>
            <Pressable style={styles.circleBtn} onPress={() => router.back()}>
              <ArrowLeft color={Colors.white} size={20} strokeWidth={2.5} />
            </Pressable>
            <Pressable style={styles.circleBtn} onPress={() => shareMatch(match)}>
              <Share2 color={Colors.white} size={18} strokeWidth={2.5} />
            </Pressable>
          </SafeAreaView>
        </View>

        <View style={styles.sheet}>
          <View style={styles.tagRow}>
            <View style={styles.tagPrimary}>
              <Text style={styles.tagPrimaryText}>{match.sportType.toUpperCase()}</Text>
            </View>
            <View style={styles.tagSecondary}>
              <Text style={styles.tagSecondaryText}>{(match.level || 'MIXED').toUpperCase()}</Text>
            </View>
          </View>

          <Text style={styles.title}>{match.title}</Text>

          {score && SCOREABLE_SPORTS.has((match.sportType || '').toUpperCase()) && (
            <View style={styles.scoreboardWrap}>
              <LiveScoreboard score={score} displaySeconds={displaySeconds} />
            </View>
          )}

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Calendar color={Colors.primary} size={18} strokeWidth={2} />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.infoPrimary}>
                {formatDateLabel(match.startDate)}, {formatTimeRange(match.startDate, match.endDate)}
              </Text>
              <Pressable onPress={() => addToCalendar(match)}>
                <Text style={styles.infoLink}>Add to calendar</Text>
              </Pressable>
            </View>
          </View>

          {/* Price info row — total cost + per-player split */}
          {(match.totalPrice != null || match.pricePerSlot != null) && (() => {
            const sym = match.currencySymbol ?? 'LKR ';
            const total = match.totalPrice ?? match.pricePerSlot ?? 0;
            const slotCount = match.slotCount ?? 1;
            const perPlayer =
              match.pricePerPlayer ??
              (match.maxSpots && match.maxSpots > 0 ? total / match.maxSpots : null);
            return (
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Clock color={Colors.primary} size={18} strokeWidth={2} />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.infoPrimary}>
                    {`${sym}${Number(total).toFixed(2)}`}
                    {slotCount > 1 ? `  ·  ${slotCount} slots` : ''}
                  </Text>
                  {perPlayer != null && (
                    <Text style={styles.infoSecondary}>
                      {`${sym}${Number(perPlayer).toFixed(2)} per player`}
                    </Text>
                  )}
                </View>
              </View>
            );
          })()}

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <MapPin color={Colors.primary} size={18} strokeWidth={2} />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.infoPrimary}>{match.venue.name}</Text>
              <Text style={styles.infoSecondary}>
                {[match.venue.postcode, match.venue.country].filter(Boolean).join(', ') ||
                  'Location details unavailable'}
              </Text>
            </View>
          </View>

          {match.organizer && (
            <>
              <Text style={styles.sectionLabel}>ORGANIZER</Text>
              <View style={styles.organizerRow}>
                <View style={styles.organizerAvatar}>
                  <Image
                    source={{ uri: resolveAvatarUri(match.organizer.avatarUrl, match.organizer.name) }}
                    style={styles.avatarImage}
                  />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.organizerName}>{match.organizer.name}</Text>
                  {match.organizer.rating != null && (
                    <View style={styles.organizerRatingRow}>
                      <Star color={Colors.warning} size={13} fill={Colors.warning} />
                      <Text style={styles.organizerRatingText}>
                        {match.organizer.rating.toFixed(1)} ({match.organizer.matchesPlayed ?? 0} matches)
                      </Text>
                    </View>
                  )}
                </View>
                <Pressable style={styles.messageBtn}>
                  <MessageCircle color={Colors.primary} size={14} strokeWidth={2.5} />
                  <Text style={styles.messageBtnText}>Message</Text>
                </Pressable>
              </View>
            </>
          )}

          <Text style={styles.sectionLabel}>VENUE & FACILITIES</Text>
          <MapPreview match={match} />
          {amenities.length > 0 ? (
            <View style={styles.amenityRow}>
              {amenities.map((key) => {
                const Icon = AMENITY_ICONS[key] || Wifi;
                return (
                  <View key={key} style={styles.amenityItem}>
                    <Icon color={Colors.textSecondary} size={20} strokeWidth={1.8} />
                    <Text style={styles.amenityLabel}>
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.placeholderText}>Amenities aren't listed for this venue yet.</Text>
          )}

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>PARTICIPANTS</Text>
            <Text style={styles.sectionLinkText}>{spotLabel}</Text>
          </View>

          {playerProfiles.length > 0 ? (
            <View style={styles.participantsBlock}>
              <AvatarRow players={playerProfiles} onPress={onViewPlayers} />
              <Text style={styles.participantsSummary}>
                {playerProfiles
                  .slice(0, 2)
                  .map((p) => p.name.split(' ')[0])
                  .join(', ')}
                {playerProfiles.length > 2 ? ` and ${playerProfiles.length - 2} others` : ''} joined
              </Text>
            </View>
          ) : (
            <Text style={styles.placeholderText}>No participants yet.</Text>
          )}

          {/* Joined players can invite others as long as the match isn't full or cancelled */}
          {hasJoined && !isFull && !isCancelled && (
            <Pressable style={styles.invitePlayersBtn} onPress={() => setShowInviteSheet(true)}>
              <UserPlus color={Colors.primary} size={16} strokeWidth={2} />
              <Text style={styles.invitePlayersTxt}>Invite Players</Text>
            </Pressable>
          )}

          <Text style={styles.sectionLabel}>MATCH RULES</Text>
          <View style={styles.rulesList}>
            {(match.rules || []).map((rule, index) => (
              <Text key={index} style={styles.ruleText}>{rule}</Text>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: (Platform.OS === 'ios' ? 24 : 16) + insets.bottom }]}>
        <View>
          <Text style={styles.bottomBarLabel}>TOTAL PRICE</Text>
          <Text style={styles.bottomBarPrice}>
            {match.totalPrice != null
              ? `${match.currencySymbol ?? 'LKR '}${match.totalPrice.toFixed(2)}`
              : match.pricePerSlot != null
              ? `${match.currencySymbol ?? 'LKR '}${match.pricePerSlot.toFixed(2)}`
              : 'TBD'}
          </Text>
          {(() => {
            const total = match.totalPrice ?? match.pricePerSlot;
            const perPlayer =
              match.pricePerPlayer ??
              (total != null && match.maxSpots && match.maxSpots > 0
                ? total / match.maxSpots
                : null);
            return perPlayer != null ? (
              <Text style={styles.bottomBarPerPlayer}>
                {`${match.currencySymbol ?? 'LKR '}${Number(perPlayer).toFixed(2)} / player`}
              </Text>
            ) : null;
          })()}
        </View>
        <Pressable
          style={[styles.joinButton, (hasJoined || isFull) && styles.joinButtonDisabled]}
          disabled={hasJoined || isFull}
          onPress={() => router.push(`/checkout/${matchId}` as any)}
        >
          <Text style={styles.joinButtonText}>
            {hasJoined ? 'Already Joined' : isFull ? 'Match Full' : 'Join Match'}
          </Text>
        </Pressable>
      </View>

      <PlayerSearchSheet
        visible={showInviteSheet}
        onClose={() => setShowInviteSheet(false)}
        excludeUids={(match.participants ?? []).map((p) => p.id)}
        onRequestToJoin={async (player) => {
          await invitationApi.invite(matchId, player.firebaseUid);
        }}
        onDirectAdd={async (player) => {
          await invitationApi.directAdd(matchId, player.firebaseUid);
          onChanged();
        }}
        title="Invite Players"
      />
    </View>
  );
}

// ─── OwnerView ────────────────────────────────────────────────────────────────

function OwnerView({
  match,
  matchId,
  router,
  onChanged,
  playerProfiles,
  onViewPlayers,
  isPro,
}: {
  match: MatchDetails;
  matchId: string;
  router: ReturnType<typeof useRouter>;
  onChanged: () => void;
  playerProfiles: PlayerProfile[];
  onViewPlayers: () => void;
  isPro: boolean;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const { score, displaySeconds } = useLiveMatchScore(matchId);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await onChanged();
    } finally {
      setRefreshing(false);
    }
  };
  const capacityKnown = match.maxSpots != null;
  const totalSpots = match.maxSpots ?? 0;
  const joinedCount = playerProfiles.length || match.participants?.length || 0;
  const isFull = capacityKnown && joinedCount >= totalSpots;
  const progress = capacityKnown && totalSpots > 0 ? Math.min(joinedCount / totalSpots, 1) : 0;
  const amenities = (match.venue.amenities || []).map((key) => key.toLowerCase());
  const isCancelled = match.status === 'CANCELLED';
  const isPendingVendor =
    match.vendorStatus === 'PENDING_VENDOR' ||
    match.status === 'PENDING_VENDOR' ||
    match.status === 'PENDING';

  const handleCancel = () => {
    Alert.alert('Cancel booking?', 'This will free up the slot for other players.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await bookingApi.cancelBooking(matchId);
            onChanged();
          } catch (err) {
            Alert.alert('Could not cancel booking', extractApiError(err));
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.flex1} edges={['top']}>
      <View style={styles.plainHeader}>
        <Pressable onPress={() => router.back()}>
          <ArrowLeft color={Colors.text} size={22} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.plainHeaderTitle}>Match Control Center</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.refreshableArea}>
      <PaasxoRefreshLogo refreshing={refreshing} />
      <ScrollView
        contentContainerStyle={styles.ownerScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<PaasxoRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        {/* Vendor approval banner */}
        {isPendingVendor && (
          <View style={styles.vendorBanner}>
            <View style={styles.vendorBannerIcon}>
              <Clock color="#EA580C" size={20} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vendorBannerTitle}>Waiting for Venue Approval</Text>
              <Text style={styles.vendorBannerText}>
                The venue has received your request. Only you can see this booking right now. Once the venue accepts, it will go live and other players can join.
              </Text>
            </View>
          </View>
        )}

        {/* Vendor rejection banner */}
        {isCancelled && match.rejectionReason && (
          <View style={[styles.vendorBanner, { backgroundColor: Colors.error + '12', borderColor: Colors.error + '30' }]}>
            <View style={[styles.vendorBannerIcon, { backgroundColor: Colors.error + '20' }]}>
              <CircleX color={Colors.error} size={20} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.vendorBannerTitle, { color: Colors.error }]}>Request Declined by Venue</Text>
              <Text style={styles.vendorBannerText}>{match.rejectionReason}</Text>
            </View>
          </View>
        )}

        <Text style={styles.ownerSportLabel}>{match.sportType.toUpperCase()}</Text>
        <Text style={styles.ownerTitle}>{match.title}</Text>
        <View style={styles.ownerLocationRow}>
          <MapPin color={Colors.textSecondary} size={14} strokeWidth={2} />
          <Text style={styles.ownerLocationText}>{match.venue.name}</Text>
        </View>

        <MapPreview match={match} height={140} />

        {score && SCOREABLE_SPORTS.has((match.sportType || '').toUpperCase()) && (
          <View style={styles.scoreboardWrap}>
            <LiveScoreboard score={score} displaySeconds={displaySeconds} />
          </View>
        )}

        {/* Players progress card */}
        {capacityKnown && (
          <View style={styles.card}>
            <View style={styles.playersRow}>
              <View style={styles.playersLabelRow}>
                <Users color={Colors.text} size={16} strokeWidth={2} />
                <Text style={styles.playersLabel}>
                  {joinedCount}/{totalSpots} Players
                </Text>
              </View>
              {isFull && (
                <View style={styles.fullBadge}>
                  <Text style={styles.fullBadgeText}>FULL</Text>
                </View>
              )}
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
            </View>
          </View>
        )}

        {/* Match info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Match Information</Text>
          <View style={styles.matchInfoRow}>
            <View style={styles.matchInfoLabelRow}>
              <Calendar color={Colors.textSecondary} size={16} strokeWidth={2} />
              <Text style={styles.matchInfoLabel}>Date & Time</Text>
            </View>
            <Text style={styles.matchInfoValue}>
              {formatDateLabel(match.startDate)} • {formatTimeRange(match.startDate, match.endDate)}
            </Text>
          </View>
          {(() => {
            const sym = match.currencySymbol ?? 'LKR ';
            const total = match.totalPrice ?? match.pricePerSlot;
            const slotCount = match.slotCount ?? 1;
            const perPlayer =
              match.pricePerPlayer ??
              (total != null && match.maxSpots && match.maxSpots > 0
                ? total / match.maxSpots
                : null);
            return (
              <>
                <View style={styles.matchInfoRow}>
                  <View style={styles.matchInfoLabelRow}>
                    <Clock color={Colors.textSecondary} size={16} strokeWidth={2} />
                    <Text style={styles.matchInfoLabel}>
                      {slotCount > 1 ? `Total Cost (${slotCount} slots)` : 'Total Cost'}
                    </Text>
                  </View>
                  <Text style={[styles.matchInfoValue, { color: Colors.primary }]}>
                    {total != null ? `${sym}${Number(total).toFixed(2)}` : 'Not set'}
                  </Text>
                </View>
                {perPlayer != null && (
                  <View style={styles.matchInfoRow}>
                    <View style={styles.matchInfoLabelRow}>
                      <Users color={Colors.textSecondary} size={16} strokeWidth={2} />
                      <Text style={styles.matchInfoLabel}>Per Player</Text>
                    </View>
                    <Text style={styles.matchInfoValue}>
                      {`${sym}${Number(perPlayer).toFixed(2)}`}
                    </Text>
                  </View>
                )}
              </>
            );
          })()}
          {match.minPlayers != null && (
            <View style={styles.matchInfoRow}>
              <View style={styles.matchInfoLabelRow}>
                <ShieldCheck color="#EA580C" size={16} strokeWidth={2} />
                <Text style={[styles.matchInfoLabel, { color: '#EA580C' }]}>Min Players</Text>
              </View>
              <Text style={styles.matchInfoValue}>{match.minPlayers}</Text>
            </View>
          )}
          <View style={styles.matchInfoRow}>
            <View style={styles.matchInfoLabelRow}>
              <Users color={Colors.textSecondary} size={16} strokeWidth={2} />
              <Text style={styles.matchInfoLabel}>Organizer</Text>
            </View>
            <Text style={styles.matchInfoValue}>{match.organizer?.name || 'You'}</Text>
          </View>
        </View>

        {/* Cancellation policy card */}
        {match.minPlayers != null && (
          <View style={styles.cancelPolicyCard}>
            <View style={styles.cancelPolicyHeader}>
              <AlertCircle color="#EA580C" size={14} strokeWidth={2} />
              <Text style={styles.cancelPolicyTitle}>Cancellation & Guarantee Policy</Text>
            </View>
            <Text style={styles.cancelPolicyText}>
              {'• If fewer than '}
              <Text style={{ fontWeight: '700' }}>{match.minPlayers} players</Text>
              {' join, you may cancel before 48 h of the match start for a full refund.\n'}
              {'• If ≥ '}
              <Text style={{ fontWeight: '700' }}>{match.minPlayers} players</Text>
              {' join but the match isn\'t full, you cover the cost of empty spots.\n'}
              {'• All payments are held in escrow and released to the venue 48 h before kick-off.'}
            </Text>
          </View>
        )}

        {/* Venue amenities */}
        <Text style={styles.cardTitleLoose}>Venue Amenities</Text>
        {amenities.length > 0 ? (
          <View style={styles.amenityGrid}>
            {amenities.map((key) => {
              const Icon = AMENITY_ICONS[key] || Wifi;
              return (
                <View key={key} style={styles.amenityCard}>
                  <Icon color={Colors.primary} size={20} strokeWidth={1.8} />
                  <Text style={styles.amenityCardLabel}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.placeholderText}>Amenities aren't listed for this venue yet.</Text>
        )}

        {/* Participants */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.cardTitleLoose}>Participants</Text>
          {playerProfiles.length > 0 && (
            <Pressable onPress={onViewPlayers}>
              <Text style={styles.sectionLinkText}>View All</Text>
            </Pressable>
          )}
        </View>
        {playerProfiles.length > 0 ? (
          <View style={styles.participantsBlock}>
            <AvatarRow players={playerProfiles} onPress={onViewPlayers} />
            <Text style={styles.participantsSummary}>
              {playerProfiles
                .slice(0, 2)
                .map((p) => p.name.split(' ')[0])
                .join(', ')}
              {playerProfiles.length > 2 ? ` and ${playerProfiles.length - 2} others` : ''} joined
            </Text>
          </View>
        ) : (
          <Text style={styles.placeholderText}>No participants invited yet.</Text>
        )}

        {/* Invite Players */}
        {!isFull && match.status !== 'CANCELLED' && (
          <Pressable style={styles.invitePlayersBtn} onPress={() => setShowInviteSheet(true)}>
            <UserPlus color={Colors.primary} size={16} strokeWidth={2} />
            <Text style={styles.invitePlayersTxt}>Invite Players</Text>
          </Pressable>
        )}

        {/* Scoring — organizer + Pro subscribers only, and only once the venue
            has approved the match (also enforced server-side) */}
        {SCOREABLE_SPORTS.has((match.sportType || '').toUpperCase()) && (
          <Pressable
            style={[styles.scoringButton, (!isPro || isPendingVendor) && styles.scoringButtonLocked]}
            onPress={() => {
              if (isPendingVendor) {
                Alert.alert(
                  'Awaiting Venue Approval',
                  'Scoring unlocks once the venue accepts this match. You\'ll be able to start scoring as soon as it\'s confirmed.'
                );
                return;
              }
              if (!isPro) {
                Alert.alert(
                  'Pro Feature',
                  'Match scoring is available for Pro subscribers only. Upgrade to unlock live scoring, stats tracking, and more.',
                  [
                    { text: 'Not now', style: 'cancel' },
                    { text: 'Upgrade to Pro', onPress: () => router.push('/subscription' as any) },
                  ]
                );
                return;
              }
              router.push(`/match/${matchId}/scoring` as any);
            }}
          >
            {isPendingVendor
              ? <Clock color={Colors.white} size={18} strokeWidth={2.2} />
              : isPro
              ? <Goal color={Colors.white} size={18} strokeWidth={2.2} />
              : <Lock color={Colors.white} size={18} strokeWidth={2.2} />
            }
            <Text style={styles.scoringButtonText}>
              {isPendingVendor
                ? 'Score Match  ·  Pending Approval'
                : !isPro
                ? 'Score Match  ·  Pro'
                : score?.status === 'LIVE' || score?.status === 'PAUSED'
                ? 'Manage Live Score'
                : score?.status === 'COMPLETED'
                ? 'View Final Score'
                : 'Start Scoring'}
            </Text>
          </Pressable>
        )}

        {!isCancelled && (
          <Pressable style={styles.manageButton} onPress={handleCancel} disabled={cancelling}>
            <CircleX color={Colors.error} size={18} strokeWidth={2} />
            <Text style={[styles.manageButtonText, { color: Colors.error }]}>
              {cancelling ? 'Cancelling...' : 'Cancel Booking'}
            </Text>
          </Pressable>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerCaps}>— PAASXO SPORTS ECOSYSTEM —</Text>
          <Text style={styles.footerText}>Booking ID: #{matchId}</Text>
        </View>
      </ScrollView>
      </View>

      <PlayerSearchSheet
        visible={showInviteSheet}
        onClose={() => setShowInviteSheet(false)}
        excludeUids={(match.participants ?? []).map((p) => p.id)}
        onRequestToJoin={async (player) => {
          await invitationApi.invite(matchId, player.firebaseUid);
        }}
        onDirectAdd={async (player) => {
          await invitationApi.directAdd(matchId, player.firebaseUid);
          onChanged();
        }}
        title="Invite Players"
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  refreshableArea: { flex: 1, position: 'relative' },
  scoreboardWrap: { marginTop: 14, marginBottom: 4 },
  loadingScreen: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // ─── Hero (JoinerView) ──────────────────────────────────────────────────────
  heroWrap: { height: 320, backgroundColor: Colors.neutral800 },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: { backgroundColor: Colors.neutral800 },
  heroOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  circleBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 32,
  },

  // ─── Tags ───────────────────────────────────────────────────────────────────
  tagRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tagPrimary: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  tagPrimaryText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  tagSecondary: {
    backgroundColor: Colors.neutral200,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  tagSecondaryText: { fontSize: 11, fontWeight: '700', color: Colors.neutral600 },

  // ─── Info rows ──────────────────────────────────────────────────────────────
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 18 },
  infoRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  infoIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  infoPrimary: { fontSize: 15, fontWeight: '700', color: Colors.text },
  infoSecondary: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  infoLink: { fontSize: 13, color: Colors.primary, marginTop: 2 },

  // ─── Section labels ─────────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 12, fontWeight: '800', letterSpacing: 0.6,
    color: Colors.text, marginBottom: 12, marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  sectionLinkText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  // ─── Organizer ──────────────────────────────────────────────────────────────
  organizerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  organizerAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  organizerName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  organizerRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  organizerRatingText: { fontSize: 12, color: Colors.textSecondary },
  messageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryLight, paddingHorizontal: 14,
    paddingVertical: 9, borderRadius: 20,
  },
  messageBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  // ─── Map ────────────────────────────────────────────────────────────────────
  mapWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 16, backgroundColor: Colors.neutral200 },
  mapNavBadge: {
    position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(20,20,20,0.72)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
  },
  mapNavBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '700' },

  // ─── Amenities ──────────────────────────────────────────────────────────────
  amenityRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  amenityItem: { alignItems: 'center', gap: 6, flex: 1 },
  amenityLabel: { fontSize: 11, color: Colors.textSecondary },

  // ─── Avatars ────────────────────────────────────────────────────────────────
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    borderWidth: 2.5, borderColor: Colors.background,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  avatarExtra: { backgroundColor: Colors.neutral300 },
  avatarExtraText: { fontSize: 11, fontWeight: '700', color: Colors.text },

  // ─── Participants ────────────────────────────────────────────────────────────
  participantsBlock: { marginBottom: 20 },
  participantsSummary: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },

  // ─── Rules ──────────────────────────────────────────────────────────────────
  rulesList: { gap: 10 },
  ruleText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  placeholderText: { fontSize: 12, color: Colors.textMuted, marginBottom: 20, lineHeight: 18 },

  // ─── Bottom bar (JoinerView) ─────────────────────────────────────────────────
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.neutral200,
  },
  bottomBarLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  bottomBarPrice: { fontSize: 22, fontWeight: '800', color: Colors.text },
  bottomBarPerPlayer: { fontSize: 11, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  joinButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32, paddingVertical: 16, borderRadius: 28,
  },
  joinButtonDisabled: { opacity: 0.5 },
  joinButtonText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  // ─── Owner header ────────────────────────────────────────────────────────────
  plainHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  plainHeaderTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  ownerScrollContent: { paddingHorizontal: 16, paddingBottom: 32 },

  // ─── Owner text ──────────────────────────────────────────────────────────────
  ownerSportLabel: { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 0.5, marginBottom: 4 },
  ownerTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  ownerLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  ownerLocationText: { fontSize: 13, color: Colors.textSecondary },

  // ─── Cards ───────────────────────────────────────────────────────────────────
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  cardTitleLoose: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 12 },

  // ─── Players progress ────────────────────────────────────────────────────────
  playersRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  playersLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playersLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  fullBadge: { backgroundColor: '#E7F8EE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  fullBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.success },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.neutral200, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary },

  // ─── Match info rows ─────────────────────────────────────────────────────────
  matchInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  matchInfoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  matchInfoLabel: { fontSize: 13, color: Colors.textSecondary },
  matchInfoValue: { fontSize: 13, fontWeight: '700', color: Colors.text },

  // ─── Amenity grid ────────────────────────────────────────────────────────────
  amenityGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  amenityCard: { flex: 1, backgroundColor: Colors.white, borderRadius: 12, paddingVertical: 14, alignItems: 'center', gap: 6 },
  amenityCardLabel: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },

  // ─── Scoring / manage buttons ────────────────────────────────────────────────
  scoringButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: Colors.primary,
    borderRadius: 14, paddingVertical: 15, marginBottom: 12,
  },
  scoringButtonLocked: { backgroundColor: Colors.neutral400 },
  scoringButtonText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  invitePlayersBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 14, marginBottom: 12,
    borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.primaryLight,
  },
  invitePlayersTxt: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  manageButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: Colors.white,
    borderRadius: 14, paddingVertical: 15, marginBottom: 20,
    borderWidth: 1, borderColor: Colors.neutral200,
  },
  manageButtonText: { fontSize: 15, fontWeight: '700', color: Colors.text },

  // ─── Footer ──────────────────────────────────────────────────────────────────
  footer: { alignItems: 'center', marginTop: 8 },
  footerCaps: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1 },
  footerText: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },

  // ─── Participants modal ───────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.neutral300,
    alignSelf: 'center', marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  modalEmpty: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingVertical: 24 },
  modalPlayerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.neutral200,
  },
  modalPlayerName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  modalPlayerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  // ── Vendor approval banner (OwnerView)
  vendorBanner: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  vendorBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EA580C20',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  vendorBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C2410C',
    marginBottom: 3,
  },
  vendorBannerText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },

  // ── Cancellation policy card (OwnerView)
  cancelPolicyCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: 14,
    marginBottom: 12,
  },
  cancelPolicyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cancelPolicyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#C2410C',
    letterSpacing: 0.2,
  },
  cancelPolicyText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
});
