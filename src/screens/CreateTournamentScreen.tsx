import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  FlatList,
  Modal,
  Animated,
  ActivityIndicator,
  Alert,
  Switch,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Trophy,
  MapPin,
  Calendar,
  Clock,
  Plus,
  Search,
  Users,
  Swords,
  Sparkles,
  CheckCircle2,
  PartyPopper,
  Camera,
  FileText,
  ChevronRight,
  Info,
  Shield,
  X,
} from 'lucide-react-native';
import { Colors, ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { SubscriptionGate } from '../components/SubscriptionGate';
import HeaderIconButton from '../components/HeaderIconButton';
import { futsalApi } from '../api/futsalApi';
import { tournamentApi } from '../api/tournamentApi';
import { socialMediaApi } from '../api/socialMediaApi';
import { tournamentStorage } from '../utils/tournamentStorage';
import { teamFlair } from '../utils/parseTournament';
import { TournamentTeamUI } from '../types/api';
import { AuthContext } from '../context/AuthContext';
import ScreenGlow from '../components/ScreenGlow';

const STEPS = ['Sport', 'Basics', 'Rules', 'Teams', 'Players', 'Matches', 'Review'];

const SPORTS = [
  { id: 'FUTSAL', label: 'Futsal', emoji: '⚽', color: Colors.futsal, desc: 'Indoor / outdoor 5-a-side football' },
  { id: 'CRICKET', label: 'Cricket', emoji: '🏏', color: Colors.cricket, desc: 'T20 · ODI · Test format matches' },
  { id: 'PICKLEBALL', label: 'Pickleball', emoji: '🏓', color: Colors.pickleball, desc: 'Paddle sport · Singles & Doubles' },
];

const DEFAULT_RULES: Record<string, string[]> = {
  FUTSAL: [
    'All players must arrive 15 minutes before kick-off.',
    'Respect the referee\'s decisions at all times.',
    'No slide tackles allowed – this is a no-contact sport.',
    'Teams must have a minimum of 4 players to start a match.',
    'Yellow card = 5-minute sin-bin. Red card = ejection.',
    'Fair play is mandatory. Abusive language will not be tolerated.',
    'No booking will be confirmed without the organiser\'s approval.',
  ],
  CRICKET: [
    'Players must arrive at least 20 minutes before the match.',
    'Toss must be conducted 5 minutes before scheduled start.',
    'A minimum of 7 players per team is required to play.',
    'DRS (Decision Review System) will not be available.',
    'All umpire decisions are final and must be respected.',
    'Follow ICC Spirit of Cricket guidelines throughout.',
    'Match can be shortened due to weather at organiser\'s discretion.',
  ],
  PICKLEBALL: [
    'Players must arrive 10 minutes before their scheduled match.',
    'Standard USA Pickleball rules apply throughout the tournament.',
    'Best-of-3 games to 11 points, win by 2.',
    'Rally scoring is used for all matches.',
    'Line calls are the responsibility of the receiving side.',
    'Unsportsmanlike conduct will result in immediate disqualification.',
    'Warm-up time: 5 minutes per match maximum.',
  ],
};

const GUIDE_TIPS: Record<number, { emoji: string; title: string; body: string }> = {
  0: { emoji: '🏅', title: 'Choose your sport', body: 'Select the sport for your tournament. This sets the scoring rules and player positions.' },
  1: { emoji: '📋', title: 'Set the basics', body: 'Give your tournament a name, pick a venue, and choose dates. You can set a cover image and expected team count.' },
  2: { emoji: '📜', title: 'Rules & Fair Play', body: 'We\'ve pre-filled sport-specific rules. Edit them or add custom rules. Players must accept these before joining.' },
  3: { emoji: '👥', title: 'Add or open to teams', body: 'Add teams now, or set the expected count and let teams join later by discovering the tournament in the app.' },
  4: { emoji: '🔍', title: 'Recruit players', body: 'Search registered players and assign them to teams. They\'ll see the tournament in their profile.' },
  5: { emoji: '⚔️', title: 'Schedule fixtures', body: 'Auto-generate a round-robin schedule or hand-pick matchups. You can always add more later.' },
  6: { emoji: '🚀', title: 'Ready to launch!', body: 'Review everything and publish. Other users will discover your tournament in the home feed.' },
};

export default function CreateTournamentScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = React.useContext(AuthContext);
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const trophyBounce = useRef(new Animated.Value(0)).current;
  const mascotBounce = useRef(new Animated.Value(0)).current;

  // Step 0: sport
  const [selectedSport, setSelectedSport] = useState<string>('');

  // Step 1: basics
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [expectedTeamsCount, setExpectedTeamsCount] = useState<number>(8);
  const [isOpenTournament, setIsOpenTournament] = useState(false);
  const [venueModalVisible, setVenueModalVisible] = useState(false);
  const [venues, setVenues] = useState<any[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlotIds, setSelectedSlotIds] = useState<number[]>([]);
  const [creatingTournament, setCreatingTournament] = useState(false);

  // Created tournament
  const [tournamentId, setTournamentId] = useState<number | null>(null);

  // Step 2: rules
  const [rules, setRules] = useState<string[]>([]);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [newRule, setNewRule] = useState('');

  // Step 3: teams
  const [teams, setTeams] = useState<TournamentTeamUI[]>([]);
  const [teamNameInput, setTeamNameInput] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);

  // Step 4: players
  const [activeTeamId, setActiveTeamId] = useState<number | null>(null);
  const [playerSearch, setPlayerSearch] = useState('');
  const [playerResults, setPlayerResults] = useState<any[]>([]);
  const [searchingPlayers, setSearchingPlayers] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);

  // Step 5: matches
  const [matches, setMatches] = useState<any[]>([]);
  const [matchTeamA, setMatchTeamA] = useState<number | null>(null);
  const [matchTeamB, setMatchTeamB] = useState<number | null>(null);
  const [matchSlotId, setMatchSlotId] = useState<number | null>(null);
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [generatingRoundRobin, setGeneratingRoundRobin] = useState(false);

  // Mascot bounce loop
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(mascotBounce, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(mascotBounce, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    const tLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(trophyBounce, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(trophyBounce, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    tLoop.start();
    return () => { loop.stop(); tLoop.stop(); };
  }, []);

  // Pre-fill rules when sport changes
  useEffect(() => {
    if (selectedSport) setRules(DEFAULT_RULES[selectedSport] || []);
  }, [selectedSport]);

  const animateStep = (next: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep(next);
  };

  const pickCoverImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload a cover image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverImage(result.assets[0].uri);
    }
  };

  const openVenueModal = async () => {
    setVenueModalVisible(true);
    setLoadingVenues(true);
    try {
      const data = await futsalApi.listVenues();
      setVenues(Array.isArray(data) ? data : []);
    } catch (err) {
      setVenues([]);
    } finally {
      setLoadingVenues(false);
    }
  };

  const handleVenueSelect = (venue: any) => {
    setSelectedVenue(venue);
    setVenueModalVisible(false);
    setSelectedDate('');
    setSlots([]);
    setSelectedSlotIds([]);
  };

  const handleDateSelect = async (date: string) => {
    setSelectedDate(date);
    setSelectedSlotIds([]);
    if (!selectedVenue) return;
    setLoadingSlots(true);
    try {
      const data = await futsalApi.getSlots(selectedVenue.id, date);
      const list = Array.isArray(data) ? data : Array.isArray((data as any)?.data) ? (data as any).data : [];
      setSlots(list.map((slot: any) => ({
        ...slot,
        time: slot.startTime ? `${slot.startTime.slice(0, 5)} - ${slot.endTime?.slice(0, 5) ?? ''}` : '',
      })));
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const toggleSlot = (slot: any) => {
    if (!slot.available) return;
    setSelectedSlotIds((prev) =>
      prev.includes(slot.id) ? prev.filter((id) => id !== slot.id) : [...prev, slot.id]
    );
  };

  const handleCreateTournament = async () => {
    if (!name.trim()) { Alert.alert('Name required', 'Give your tournament a name to continue.'); return; }
    if (!selectedVenue || !selectedDate) { Alert.alert('Venue & date required', 'Pick a venue and date to continue.'); return; }
    setCreatingTournament(true);
    try {
      const created = await tournamentApi.createTournament(selectedVenue.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        date: selectedDate,
        slotIds: selectedSlotIds.length > 0 ? selectedSlotIds : undefined,
      });
      const id = created?.id ?? created?._id;
      setTournamentId(id);
      await tournamentStorage.track({ id, futsalId: selectedVenue.id, name: name.trim(), role: 'owner' });
      animateStep(2); // go to rules
    } catch (err) {
      Alert.alert('Could not create tournament', 'Please check your venue/date and try again.');
    } finally {
      setCreatingTournament(false);
    }
  };

  const handleAddTeam = async () => {
    if (!tournamentId || !teamNameInput.trim()) return;
    setAddingTeam(true);
    try {
      const created = await tournamentApi.createTeam(tournamentId, { name: teamNameInput.trim() });
      const teamRecord = { id: created.id, name: created.name, playerCount: created.playerCount ?? 0 };
      setTeams((prev) => [...prev, { ...teamRecord, players: [], ...teamFlair(teamRecord) }]);
      setTeamNameInput('');
    } catch (err: any) {
      Alert.alert('Could not add team', 'Please try again.');
    } finally {
      setAddingTeam(false);
    }
  };

  useEffect(() => {
    if (teams.length > 0 && activeTeamId == null) setActiveTeamId(teams[0].id);
  }, [teams, activeTeamId]);

  useEffect(() => {
    const delay = setTimeout(() => {
      if (!playerSearch.trim()) { setPlayerResults([]); return; }
      setSearchingPlayers(true);
      socialMediaApi.searchUsers(playerSearch.trim())
        .then((data) => setPlayerResults(Array.isArray(data) ? data : []))
        .catch(() => setPlayerResults([]))
        .finally(() => setSearchingPlayers(false));
    }, 300);
    return () => clearTimeout(delay);
  }, [playerSearch]);

  const handleAddPlayer = async (player: any) => {
    if (!tournamentId || !activeTeamId) return;
    setAddingPlayer(true);
    try {
      const created = await tournamentApi.addPlayer(tournamentId, activeTeamId, { playerFirebaseUid: player.firebaseUid });
      setTeams((prev) =>
        prev.map((t) =>
          t.id === activeTeamId
            ? {
                ...t,
                playerCount: t.playerCount + 1,
                players: [...t.players, { id: created.id, playerFirebaseUid: created.playerFirebaseUid, playerDisplayName: created.playerDisplayName, playerEmail: created.playerEmail }],
              }
            : t
        )
      );
      setPlayerSearch('');
      setPlayerResults([]);
    } catch (err: any) {
      Alert.alert('Could not add player', err?.response?.data?.message || 'They may already be on this team.');
    } finally {
      setAddingPlayer(false);
    }
  };

  const teamPairs = useMemo(() => {
    const pairs: [TournamentTeamUI, TournamentTeamUI][] = [];
    for (let i = 0; i < teams.length; i++)
      for (let j = i + 1; j < teams.length; j++)
        pairs.push([teams[i], teams[j]]);
    return pairs;
  }, [teams]);

  const handleAddMatch = async () => {
    if (!tournamentId || matchTeamA == null || matchTeamB == null) return;
    if (matchTeamA === matchTeamB) { Alert.alert('Pick two different teams', 'A match needs two distinct teams.'); return; }
    setCreatingMatch(true);
    try {
      const created = await tournamentApi.createMatch(tournamentId, { teamAId: matchTeamA, teamBId: matchTeamB, slotId: matchSlotId ?? undefined });
      setMatches((prev) => [...prev, created]);
      setMatchTeamA(null); setMatchTeamB(null); setMatchSlotId(null);
    } catch {
      Alert.alert('Could not schedule match', 'Please try again.');
    } finally {
      setCreatingMatch(false);
    }
  };

  const handleGenerateRoundRobin = async () => {
    if (!tournamentId || teamPairs.length === 0) return;
    setGeneratingRoundRobin(true);
    try {
      const created: any[] = [];
      for (const [teamA, teamB] of teamPairs) {
        const match = await tournamentApi.createMatch(tournamentId, { teamAId: teamA.id, teamBId: teamB.id });
        created.push(match);
      }
      setMatches((prev) => [...prev, ...created]);
    } catch {
      Alert.alert('Could not generate all fixtures', 'Some matches may not have been created.');
    } finally {
      setGeneratingRoundRobin(false);
    }
  };

  const addCustomRule = () => {
    if (!newRule.trim()) return;
    setRules((prev) => [...prev, newRule.trim()]);
    setNewRule('');
  };

  const removeRule = (index: number) => setRules((prev) => prev.filter((_, i) => i !== index));

  const currentSport = SPORTS.find((s) => s.id === selectedSport);
  const tip = GUIDE_TIPS[step];

  // ─── Step renderers ───

  const renderSportStep = () => (
    <View>
      <Text style={styles.stepHint}>Select the sport format for your tournament.</Text>
      {SPORTS.map((sport) => {
        const selected = selectedSport === sport.id;
        return (
          <Pressable
            key={sport.id}
            onPress={() => setSelectedSport(sport.id)}
            style={[styles.sportCard, selected && { borderColor: sport.color, backgroundColor: sport.color + '12' }]}
          >
            <Text style={styles.sportCardEmoji}>{sport.emoji}</Text>
            <View style={styles.sportCardInfo}>
              <Text style={[styles.sportCardLabel, selected && { color: sport.color }]}>{sport.label}</Text>
              <Text style={styles.sportCardDesc}>{sport.desc}</Text>
            </View>
            {selected && <CheckCircle2 color={sport.color} size={22} strokeWidth={2.5} />}
          </Pressable>
        );
      })}
      <Pressable
        style={[styles.primaryButton, !selectedSport && styles.primaryButtonDisabled]}
        onPress={() => selectedSport && animateStep(1)}
        disabled={!selectedSport}
      >
        <ChevronRight color={colors.white} size={18} strokeWidth={2.5} />
        <Text style={styles.primaryButtonText}>Continue</Text>
      </Pressable>
    </View>
  );

  const renderBasicsStep = () => (
    <View>
      <Text style={styles.stepHint}>Name your tournament and set the key details.</Text>

      {/* Cover image */}
      <Text style={styles.label}>Cover Image</Text>
      <Pressable style={styles.coverImagePicker} onPress={pickCoverImage}>
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={styles.coverImagePreview} resizeMode="cover" />
        ) : (
          <View style={styles.coverImagePlaceholder}>
            <Camera color={colors.primary} size={28} strokeWidth={2} />
            <Text style={styles.coverImageHint}>Tap to add a cover image (16:9)</Text>
          </View>
        )}
      </Pressable>

      <Text style={styles.label}>Tournament Name *</Text>
      <TextInput
        style={styles.input}
        placeholder={`e.g. ${currentSport?.label || 'Summer'} Championship 2025`}
        placeholderTextColor={colors.neutral400}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Tell players what this tournament is about..."
        placeholderTextColor={colors.neutral400}
        multiline
        numberOfLines={3}
        value={description}
        onChangeText={setDescription}
      />

      {/* Expected teams / open tournament */}
      <View style={styles.openTournamentRow}>
        <View style={styles.openTournamentInfo}>
          <Text style={styles.label} >Open Registration</Text>
          <Text style={styles.openTournamentDesc}>Let any user join with their team</Text>
        </View>
        <Switch
          value={isOpenTournament}
          onValueChange={setIsOpenTournament}
          trackColor={{ false: colors.neutral300, true: colors.primary + '80' }}
          thumbColor={isOpenTournament ? colors.primary : colors.white}
        />
      </View>

      <Text style={styles.label}>Expected Teams</Text>
      <View style={styles.teamsCountRow}>
        {[4, 6, 8, 12, 16, 24, 32].map((n) => (
          <Pressable
            key={n}
            onPress={() => setExpectedTeamsCount(n)}
            style={[styles.teamsCountChip, expectedTeamsCount === n && styles.teamsCountChipSelected]}
          >
            <Text style={[styles.teamsCountChipText, expectedTeamsCount === n && styles.teamsCountChipTextSelected]}>
              {n}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Venue *</Text>
      <Pressable style={styles.selectorButton} onPress={openVenueModal}>
        <MapPin color={colors.primary} size={20} strokeWidth={2} />
        <Text style={styles.selectorButtonText}>{selectedVenue ? selectedVenue.name : 'Choose a venue...'}</Text>
        <ChevronRight color={colors.neutral400} size={16} strokeWidth={2} />
      </Pressable>

      {selectedVenue && (
        <>
          <Text style={styles.label}>Date *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScrollRow}>
            {Array.from({ length: 21 }).map((_, i) => {
              const date = new Date();
              date.setDate(date.getDate() + i);
              const dateStr = date.toISOString().split('T')[0];
              const isSelected = selectedDate === dateStr;
              return (
                <Pressable
                  key={i}
                  onPress={() => handleDateSelect(dateStr)}
                  style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                >
                  <Text style={[styles.dateChipDay, isSelected && styles.dateChipTextSelected]}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dateChipDate, isSelected && styles.dateChipTextSelected]}>
                    {date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      {selectedDate && (
        <>
          <Text style={styles.label}>Reserve Time Slots (optional)</Text>
          {loadingSlots ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
          ) : slots.length > 0 ? (
            <View style={styles.slotGrid}>
              {slots.map((slot) => {
                const isSelected = selectedSlotIds.includes(slot.id);
                return (
                  <Pressable
                    key={slot.id}
                    onPress={() => toggleSlot(slot)}
                    disabled={!slot.available}
                    style={[styles.slotChip, !slot.available && styles.slotChipDisabled, isSelected && styles.slotChipSelected]}
                  >
                    <Clock color={!slot.available ? colors.neutral400 : isSelected ? colors.white : colors.primary} size={14} strokeWidth={2} />
                    <Text style={[styles.slotChipText, !slot.available && styles.slotChipTextDisabled, isSelected && styles.slotChipTextSelected]}>
                      {slot.time}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyHint}>No slots available for this date.</Text>
          )}
        </>
      )}

      <Pressable
        style={[styles.primaryButton, creatingTournament && styles.primaryButtonDisabled]}
        onPress={handleCreateTournament}
        disabled={creatingTournament}
      >
        {creatingTournament ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <Trophy color={colors.white} size={18} strokeWidth={2.5} />
            <Text style={styles.primaryButtonText}>Create & Continue</Text>
          </>
        )}
      </Pressable>
    </View>
  );

  const renderRulesStep = () => (
    <View>
      <Text style={styles.stepHint}>
        These rules will be shown to all players before they join. Players must accept them.
      </Text>

      <View style={styles.rulesListCard}>
        {rules.map((rule, index) => (
          <View key={index} style={styles.ruleRow}>
            <View style={styles.ruleNumberBadge}>
              <Text style={styles.ruleNumber}>{index + 1}</Text>
            </View>
            <Text style={styles.ruleText}>{rule}</Text>
            <Pressable onPress={() => removeRule(index)} style={styles.ruleRemoveBtn}>
              <X color={colors.neutral400} size={14} strokeWidth={2.5} />
            </Pressable>
          </View>
        ))}
      </View>

      <Text style={styles.label}>Add Custom Rule</Text>
      <View style={styles.addRuleRow}>
        <TextInput
          style={[styles.input, styles.addRuleInput]}
          placeholder="Type a rule..."
          placeholderTextColor={colors.neutral400}
          value={newRule}
          onChangeText={setNewRule}
          onSubmitEditing={addCustomRule}
        />
        <Pressable style={styles.addIconButton} onPress={addCustomRule}>
          <Plus color={colors.white} size={20} strokeWidth={2.5} />
        </Pressable>
      </View>

      {/* Acceptance toggle */}
      <View style={styles.acceptanceCard}>
        <Shield color={colors.primary} size={22} strokeWidth={2} />
        <View style={styles.acceptanceInfo}>
          <Text style={styles.acceptanceTitle}>I accept these rules</Text>
          <Text style={styles.acceptanceSubtitle}>
            As organiser, you confirm these rules are fair and will be enforced.
          </Text>
        </View>
        <Switch
          value={rulesAccepted}
          onValueChange={setRulesAccepted}
          trackColor={{ false: colors.neutral300, true: colors.primary + '80' }}
          thumbColor={rulesAccepted ? colors.primary : colors.white}
        />
      </View>

      <Pressable
        style={[styles.primaryButton, !rulesAccepted && styles.primaryButtonDisabled]}
        onPress={() => rulesAccepted && animateStep(3)}
        disabled={!rulesAccepted}
      >
        <Users color={colors.white} size={18} strokeWidth={2.5} />
        <Text style={styles.primaryButtonText}>Next: Add Teams</Text>
      </Pressable>
    </View>
  );

  const renderTeamsStep = () => (
    <View>
      <Text style={styles.stepHint}>
        Add competing teams now, or skip — players can join later when they discover this tournament.
      </Text>

      <View style={styles.openStatusCard}>
        <Text style={styles.openStatusLabel}>
          {isOpenTournament ? '🔓 Open Tournament' : '🔒 Invite-only Tournament'}
        </Text>
        <Text style={styles.openStatusDesc}>
          {isOpenTournament
            ? `Up to ${expectedTeamsCount} teams can join via the discover feed.`
            : `Only teams you add here can participate.`}
        </Text>
      </View>

      <View style={styles.addTeamRow}>
        <TextInput
          style={[styles.input, styles.addTeamInput]}
          placeholder="Team name (e.g. Thunder FC)"
          placeholderTextColor={colors.neutral400}
          value={teamNameInput}
          onChangeText={setTeamNameInput}
          onSubmitEditing={handleAddTeam}
        />
        <Pressable style={[styles.addIconButton, addingTeam && styles.primaryButtonDisabled]} onPress={handleAddTeam} disabled={addingTeam}>
          {addingTeam ? <ActivityIndicator color={colors.white} size="small" /> : <Plus color={colors.white} size={20} strokeWidth={2.5} />}
        </Pressable>
      </View>

      <View style={styles.teamGrid}>
        {teams.map((team) => (
          <View key={team.id} style={[styles.teamCard, { borderColor: team.color }]}>
            <Text style={styles.teamCardEmoji}>{team.emoji}</Text>
            <Text style={styles.teamCardName}>{team.name}</Text>
            <Text style={styles.teamCardMeta}>{team.playerCount} players</Text>
          </View>
        ))}
      </View>

      {teams.length === 0 && (
        <Text style={styles.emptyHint}>No teams yet. Add some or let players join by discovery.</Text>
      )}

      <Pressable
        style={styles.primaryButton}
        onPress={() => animateStep(4)}
      >
        <Users color={colors.white} size={18} strokeWidth={2.5} />
        <Text style={styles.primaryButtonText}>{teams.length >= 2 ? 'Next: Add Players' : 'Skip — add players later'}</Text>
      </Pressable>
    </View>
  );

  const renderPlayersStep = () => (
    <View>
      <Text style={styles.stepHint}>Search app users by name and add them to a team.</Text>

      {teams.length > 0 ? (
        <>
          <Text style={styles.label}>Select Team</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {teams.map((team) => (
              <Pressable
                key={team.id}
                onPress={() => setActiveTeamId(team.id)}
                style={[styles.teamChip, activeTeamId === team.id && { backgroundColor: team.color, borderColor: team.color }]}
              >
                <Text style={styles.teamChipEmoji}>{team.emoji}</Text>
                <Text style={[styles.teamChipText, activeTeamId === team.id && styles.teamChipTextActive]}>{team.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.searchBar}>
            <Search color={colors.neutral400} size={18} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search players by name..."
              placeholderTextColor={colors.neutral400}
              value={playerSearch}
              onChangeText={setPlayerSearch}
            />
            {searchingPlayers && <ActivityIndicator color={colors.primary} size="small" />}
          </View>

          {playerResults.map((player) => (
            <Pressable
              key={player.id}
              style={styles.playerResultRow}
              onPress={() => handleAddPlayer(player)}
              disabled={addingPlayer}
            >
              <View style={styles.playerAvatar}>
                <Text style={styles.playerAvatarText}>{(player.displayName || '?').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.playerResultName}>{player.displayName}</Text>
                <Text style={styles.playerResultEmail}>{player.email}</Text>
              </View>
              <View style={styles.addPlayerBtn}>
                <Plus color={colors.white} size={16} strokeWidth={2.5} />
              </View>
            </Pressable>
          ))}

          <Text style={styles.label}>Current Roster</Text>
          {teams.map((team) => (
            <View key={team.id} style={styles.rosterTeamBlock}>
              <View style={[styles.rosterTeamHeader, { borderLeftColor: team.color }]}>
                <Text style={styles.rosterTeamTitle}>{team.emoji} {team.name}</Text>
                <Text style={styles.rosterTeamCount}>{team.players.length} players</Text>
              </View>
              {team.players.length === 0 ? (
                <Text style={styles.rosterEmpty}>No players added yet</Text>
              ) : (
                team.players.map((p) => (
                  <Text key={p.id} style={styles.rosterPlayerName}>• {p.playerDisplayName || p.playerFirebaseUid}</Text>
                ))
              )}
            </View>
          ))}
        </>
      ) : (
        <View style={styles.noTeamsHint}>
          <Text style={styles.noTeamsEmoji}>👥</Text>
          <Text style={styles.noTeamsText}>Add teams first, then recruit players to each team.</Text>
          <Pressable style={styles.secondaryButton} onPress={() => animateStep(3)}>
            <Text style={styles.secondaryButtonText}>← Go back to Teams</Text>
          </Pressable>
        </View>
      )}

      <Pressable style={styles.primaryButton} onPress={() => animateStep(5)}>
        <Swords color={colors.white} size={18} strokeWidth={2.5} />
        <Text style={styles.primaryButtonText}>Next: Schedule Matches</Text>
      </Pressable>
    </View>
  );

  const renderMatchesStep = () => (
    <View>
      <Text style={styles.stepHint}>Schedule fixtures between teams.</Text>

      {teamPairs.length > 0 && (
        <Pressable
          style={[styles.highlightButton, generatingRoundRobin && styles.primaryButtonDisabled]}
          onPress={handleGenerateRoundRobin}
          disabled={generatingRoundRobin}
        >
          <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.highlightButtonGrad}>
            {generatingRoundRobin ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Sparkles color={colors.white} size={18} strokeWidth={2.5} />
                <Text style={styles.highlightButtonText}>Auto Round-Robin ({teamPairs.length} matches)</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      )}

      <Text style={styles.label}>Or pick a matchup manually</Text>
      <Text style={styles.subLabel}>Team A</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        {teams.map((team) => (
          <Pressable
            key={team.id}
            onPress={() => setMatchTeamA(team.id)}
            style={[styles.teamChip, matchTeamA === team.id && { backgroundColor: team.color, borderColor: team.color }]}
          >
            <Text style={styles.teamChipEmoji}>{team.emoji}</Text>
            <Text style={[styles.teamChipText, matchTeamA === team.id && styles.teamChipTextActive]}>{team.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.vsText}>VS</Text>
      <Text style={styles.subLabel}>Team B</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        {teams.filter((t) => t.id !== matchTeamA).map((team) => (
          <Pressable
            key={team.id}
            onPress={() => setMatchTeamB(team.id)}
            style={[styles.teamChip, matchTeamB === team.id && { backgroundColor: team.color, borderColor: team.color }]}
          >
            <Text style={styles.teamChipEmoji}>{team.emoji}</Text>
            <Text style={[styles.teamChipText, matchTeamB === team.id && styles.teamChipTextActive]}>{team.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        style={[styles.primaryButton, creatingMatch && styles.primaryButtonDisabled]}
        onPress={handleAddMatch}
        disabled={creatingMatch || matchTeamA == null || matchTeamB == null}
      >
        {creatingMatch ? <ActivityIndicator color={colors.white} /> : <Plus color={colors.white} size={18} strokeWidth={2.5} />}
        <Text style={styles.primaryButtonText}>Add Match</Text>
      </Pressable>

      {matches.length > 0 && (
        <>
          <Text style={styles.label}>Fixtures ({matches.length})</Text>
          {matches.map((m, i) => {
            const teamA = teams.find((t) => t.id === m.teamAId);
            const teamB = teams.find((t) => t.id === m.teamBId);
            return (
              <View key={m.id ?? i} style={styles.fixtureRow}>
                <View style={styles.fixtureTeam}>
                  <Text style={styles.fixtureEmoji}>{teamA?.emoji}</Text>
                  <Text style={styles.fixtureName} numberOfLines={1}>{teamA?.name || 'Team A'}</Text>
                </View>
                <View style={styles.fixtureBadge}><Text style={styles.fixtureBadgeText}>VS</Text></View>
                <View style={[styles.fixtureTeam, { alignItems: 'flex-end' }]}>
                  <Text style={styles.fixtureEmoji}>{teamB?.emoji}</Text>
                  <Text style={styles.fixtureName} numberOfLines={1}>{teamB?.name || 'Team B'}</Text>
                </View>
              </View>
            );
          })}
        </>
      )}

      <Pressable
        style={[styles.primaryButton, { marginTop: 12 }]}
        onPress={() => animateStep(6)}
      >
        <CheckCircle2 color={colors.white} size={18} strokeWidth={2.5} />
        <Text style={styles.primaryButtonText}>Review & Launch</Text>
      </Pressable>
    </View>
  );

  const renderReviewStep = () => (
    <View style={{ alignItems: 'center' }}>
      {coverImage ? (
        <Image source={{ uri: coverImage }} style={styles.reviewCoverImage} />
      ) : (
        <Animated.Text
          style={[styles.reviewTrophy, { transform: [{ translateY: trophyBounce.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }] }]}
        >
          {currentSport?.emoji || '🏆'}
        </Animated.Text>
      )}

      <View style={[styles.sportPill, { backgroundColor: (currentSport?.color || colors.primary) + '20' }]}>
        <Text style={[styles.sportPillText, { color: currentSport?.color || colors.primary }]}>
          {currentSport?.label?.toUpperCase() || 'SPORT'} TOURNAMENT
        </Text>
      </View>

      <Text style={styles.reviewTitle}>{name}</Text>
      <Text style={styles.reviewSubtitle}>{selectedVenue?.name} • {selectedDate}</Text>

      <View style={styles.reviewStatsRow}>
        {[
          { value: String(expectedTeamsCount), label: 'Expected\nTeams' },
          { value: String(teams.length), label: 'Registered\nTeams' },
          { value: String(matches.length), label: 'Fixtures\nScheduled' },
        ].map((s) => (
          <View key={s.label} style={styles.reviewStatCard}>
            <Text style={styles.reviewStatValue}>{s.value}</Text>
            <Text style={styles.reviewStatLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.openStatusCard, { width: '100%', marginBottom: 24 }]}>
        <Text style={styles.openStatusLabel}>{isOpenTournament ? '🔓 Open to all players' : '🔒 Invite-only'}</Text>
        <Text style={styles.openStatusDesc}>{rules.length} rules set • Players must accept rules to join</Text>
      </View>

      <Pressable style={styles.finishButton} onPress={() => router.replace(`/tournament/${tournamentId}` as any)}>
        <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.finishButtonGradient}>
          <PartyPopper color={colors.white} size={20} strokeWidth={2.5} />
          <Text style={styles.finishButtonText}>Launch Tournament 🚀</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 0: return renderSportStep();
      case 1: return renderBasicsStep();
      case 2: return renderRulesStep();
      case 3: return renderTeamsStep();
      case 4: return renderPlayersStep();
      case 5: return renderMatchesStep();
      case 6: return renderReviewStep();
      default: return null;
    }
  };

  return (
    <SubscriptionGate feature="creating tournaments">
    <SafeAreaView style={styles.safeArea} edges={['top']}>
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

          <HeaderIconButton onPress={() => (step === 0 ? router.back() : animateStep(step - 1))} style={styles.backBtn}>
            <ArrowLeft color={colors.white} size={20} strokeWidth={2.5} />
          </HeaderIconButton>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Create Tournament</Text>
            <Text style={styles.headerSubtitle}>{STEPS[step]}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerStep}>{step + 1}/{STEPS.length}</Text>
          </View>
        </View>
      </View>

      {/* Step progress */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
      </View>

      {/* Guide tip card */}
      {tip && (
        <View style={styles.tipCard}>
          <Text style={styles.tipEmoji}>{tip.emoji}</Text>
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>{tip.title}</Text>
            <Text style={styles.tipBody}>{tip.body}</Text>
          </View>
          <Info color={colors.primary} size={16} strokeWidth={2} />
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim }}>{renderStep()}</Animated.View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Venue modal — statusBarTranslucent is required on Android: without it, RN's
          Modal presents in its own native window that doesn't extend under the status
          bar, so the back button at the top of the modal ends up drawn underneath it.
          paddingTop is applied directly from insets.top rather than left to the nested
          SafeAreaView's own top edge, since that inset isn't reliably picked up for
          content presented inside a Modal. */}
      <Modal visible={venueModalVisible} transparent animationType="slide" statusBarTranslucent>
        <SafeAreaView style={styles.venueModal} edges={['bottom']}>
          <View style={[styles.venueModalHeader, { paddingTop: insets.top + 14 }]}>
            <Pressable onPress={() => setVenueModalVisible(false)}>
              <ArrowLeft color={colors.text} size={22} strokeWidth={2.5} />
            </Pressable>
            <Text style={styles.venueModalTitle}>Select Venue</Text>
            <View style={{ width: 22 }} />
          </View>
          {loadingVenues ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
          ) : venues.length === 0 ? (
            <View style={styles.emptyVenue}>
              <Text style={styles.emptyVenueEmoji}>🏟️</Text>
              <Text style={styles.emptyVenueText}>No venues available. Please try again later.</Text>
            </View>
          ) : (
            <FlatList
              data={venues}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable style={styles.venueRow} onPress={() => handleVenueSelect(item)}>
                  <View style={styles.venueIconBox}>
                    <MapPin color={colors.white} size={16} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.venueRowName}>{item.name}</Text>
                    <Text style={styles.venueRowLocation}>{item.location || item.address || 'Location TBD'}</Text>
                  </View>
                  <ChevronRight color={colors.neutral300} size={16} strokeWidth={2} />
                </Pressable>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
    </SubscriptionGate>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex1: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },

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
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.white },
  headerSubtitle: { fontSize: 11, color: colors.white + 'CC', fontWeight: '500', marginTop: 2 },
  headerRight: { width: 38, alignItems: 'flex-end' },
  headerStep: { fontSize: 12, color: colors.white + 'CC', fontWeight: '700' },

  progressBar: { height: 3, backgroundColor: colors.neutral200 },
  progressFill: { height: 3, backgroundColor: colors.primary, borderRadius: 2 },

  tipCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: colors.primaryLight, marginHorizontal: 16, marginTop: 12,
    borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.primary + '30',
  },
  tipEmoji: { fontSize: 20, marginTop: 1 },
  tipContent: { flex: 1 },
  tipTitle: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 2 },
  tipBody: { fontSize: 12, color: colors.primaryDark, lineHeight: 17 },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 12 },

  stepHint: { fontSize: 13, color: colors.textSecondary, marginBottom: 16, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8, marginTop: 16 },
  subLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },

  input: {
    backgroundColor: colors.inputBg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: colors.text,
    borderWidth: 1, borderColor: colors.neutral200,
  },
  textArea: { height: 80, textAlignVertical: 'top' },

  // Sport step
  sportCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.cardBg, borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 2, borderColor: colors.neutral200,
  },
  sportCardEmoji: { fontSize: 32 },
  sportCardInfo: { flex: 1 },
  sportCardLabel: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 2 },
  sportCardDesc: { fontSize: 12, color: colors.textSecondary },

  // Cover image
  coverImagePicker: {
    width: '100%', height: 160, borderRadius: 16, overflow: 'hidden',
    backgroundColor: colors.cardBg, borderWidth: 2, borderColor: colors.neutral200,
    borderStyle: 'dashed',
  },
  coverImagePreview: { width: '100%', height: '100%' },
  coverImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  coverImageHint: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },

  // Open tournament
  openTournamentRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.cardBg, borderRadius: 14, padding: 14, marginTop: 16,
    borderWidth: 1, borderColor: colors.neutral200,
  },
  openTournamentInfo: { flex: 1 },
  openTournamentDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  // Teams count
  teamsCountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  teamsCountChip: {
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20,
    backgroundColor: colors.cardBg, borderWidth: 1.5, borderColor: colors.neutral200,
  },
  teamsCountChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  teamsCountChipText: { fontSize: 14, fontWeight: '700', color: colors.text },
  teamsCountChipTextSelected: { color: colors.white },

  selectorButton: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.inputBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: colors.neutral200,
  },
  selectorButtonText: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.text },

  dateScrollRow: { marginBottom: 8 },
  dateChip: {
    width: 58, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.cardBg, alignItems: 'center',
    borderWidth: 1, borderColor: colors.neutral200, gap: 2, marginRight: 8,
  },
  dateChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dateChipDay: { fontSize: 10, fontWeight: '600', color: colors.neutral500 },
  dateChipDate: { fontSize: 15, fontWeight: '700', color: colors.text },
  dateChipTextSelected: { color: colors.white },

  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16,
    backgroundColor: colors.cardBg, borderWidth: 1.5, borderColor: colors.primary,
  },
  slotChipDisabled: { borderColor: colors.neutral300, backgroundColor: colors.neutral100 },
  slotChipSelected: { backgroundColor: colors.primary },
  slotChipText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  slotChipTextDisabled: { color: colors.neutral400 },
  slotChipTextSelected: { color: colors.white },

  // Rules step
  rulesListCard: {
    backgroundColor: colors.cardBg, borderRadius: 16, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: colors.neutral200,
  },
  ruleRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.neutral100,
  },
  ruleNumberBadge: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  ruleNumber: { fontSize: 10, fontWeight: '800', color: colors.white },
  ruleText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 },
  ruleRemoveBtn: { padding: 4, marginTop: 1 },

  addRuleRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  addRuleInput: { flex: 1 },

  acceptanceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.primaryLight, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.primary + '30', marginBottom: 8,
  },
  acceptanceInfo: { flex: 1 },
  acceptanceTitle: { fontSize: 14, fontWeight: '700', color: colors.primary },
  acceptanceSubtitle: { fontSize: 12, color: colors.primaryDark, marginTop: 2 },

  // Open status card
  openStatusCard: {
    backgroundColor: colors.primaryLight, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.primary + '25', marginBottom: 8,
  },
  openStatusLabel: { fontSize: 14, fontWeight: '700', color: colors.primary, marginBottom: 4 },
  openStatusDesc: { fontSize: 12, color: colors.primaryDark },

  // Teams step
  addTeamRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  addTeamInput: { flex: 1 },
  addIconButton: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  teamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  teamCard: {
    width: '47%', backgroundColor: colors.cardBg, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', borderWidth: 2, gap: 4,
  },
  teamCardEmoji: { fontSize: 28 },
  teamCardName: { fontSize: 13, fontWeight: '700', color: colors.text },
  teamCardMeta: { fontSize: 11, color: colors.textSecondary },

  teamChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16,
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.neutral200, marginRight: 8,
  },
  teamChipEmoji: { fontSize: 14 },
  teamChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  teamChipTextActive: { color: colors.white },

  // Players step
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.inputBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.neutral200, marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  playerResultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.cardBg, borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: colors.neutral100,
  },
  playerAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  playerAvatarText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  playerResultName: { fontSize: 13, fontWeight: '600', color: colors.text },
  playerResultEmail: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  addPlayerBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  rosterTeamBlock: { backgroundColor: colors.cardBg, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.neutral100 },
  rosterTeamHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, borderLeftWidth: 3, paddingLeft: 8 },
  rosterTeamTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  rosterTeamCount: { fontSize: 12, color: colors.textSecondary },
  rosterEmpty: { fontSize: 12, color: colors.neutral400, fontStyle: 'italic' },
  rosterPlayerName: { fontSize: 12, color: colors.textSecondary, marginLeft: 4, marginVertical: 2 },
  noTeamsHint: { alignItems: 'center', paddingVertical: 28 },
  noTeamsEmoji: { fontSize: 40, marginBottom: 12 },
  noTeamsText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 16 },

  // Matches step
  highlightButton: { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  highlightButtonGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 15,
  },
  highlightButtonText: { fontSize: 15, fontWeight: '700', color: colors.white },

  vsText: { textAlign: 'center', fontSize: 14, fontWeight: '900', color: colors.neutral400, marginVertical: 8 },

  fixtureRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.cardBg, borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: colors.neutral100,
  },
  fixtureTeam: { flex: 1, alignItems: 'flex-start' },
  fixtureEmoji: { fontSize: 20, marginBottom: 4 },
  fixtureName: { fontSize: 13, fontWeight: '600', color: colors.text },
  fixtureBadge: {
    paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.neutral100,
    borderRadius: 8, marginHorizontal: 8,
  },
  fixtureBadgeText: { fontSize: 11, fontWeight: '800', color: colors.neutral500 },

  // Review step
  reviewCoverImage: { width: '100%', height: 160, borderRadius: 18, marginBottom: 16 },
  reviewTrophy: { fontSize: 72, marginBottom: 12, marginTop: 12 },
  sportPill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginBottom: 10 },
  sportPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  reviewTitle: { fontSize: 24, fontWeight: '900', color: colors.text, textAlign: 'center', marginBottom: 6 },
  reviewSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 20, textAlign: 'center' },
  reviewStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 20, width: '100%' },
  reviewStatCard: {
    flex: 1, backgroundColor: colors.cardBg, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.neutral200,
  },
  reviewStatValue: { fontSize: 22, fontWeight: '900', color: colors.primary },
  reviewStatLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },

  finishButton: { width: '100%', borderRadius: 18, overflow: 'hidden', marginTop: 8 },
  finishButtonGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 18,
  },
  finishButtonText: { fontSize: 17, fontWeight: '900', color: colors.white },

  // Shared buttons
  primaryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 15, marginTop: 20,
  },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonText: { fontSize: 15, fontWeight: '700', color: colors.white },
  secondaryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: colors.cardBg, borderRadius: 14, paddingVertical: 12,
    borderWidth: 1.5, borderColor: colors.primary,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '700', color: colors.primary },

  emptyHint: { fontSize: 13, color: colors.neutral400, marginTop: 8, textAlign: 'center' },

  // Venue modal
  venueModal: { flex: 1, backgroundColor: colors.background },
  venueModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.neutral200,
  },
  venueModalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  venueRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.neutral100,
  },
  venueIconBox: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  venueRowName: { fontSize: 14, fontWeight: '600', color: colors.text },
  venueRowLocation: { fontSize: 12, color: colors.neutral500, marginTop: 2 },
  emptyVenue: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyVenueEmoji: { fontSize: 40, marginBottom: 12 },
  emptyVenueText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
});
