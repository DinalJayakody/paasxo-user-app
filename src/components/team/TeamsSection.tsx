import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Shield } from 'lucide-react-native';
import { ThemeColors } from '../../styles/colors';
import { teamApi } from '../../api/teamApi';
import { Team } from '../../types/api';
import { resolveMediaUrl } from '../../utils/mediaUrl';

interface TeamsSectionProps {
  uid: string | undefined;
  colors: ThemeColors;
  // Only the viewer's own profile offers a "Create Team" card - a friend's
  // profile is read-only here (see ProfileScreen/FriendProfileScreen usage).
  showCreateButton?: boolean;
}

/**
 * Persistent, cross-tournament social Teams a profile's user belongs to
 * (captain or member) - shown on both the own Profile screen and a friend's
 * Profile screen, same shared-component pattern as other profile sections.
 * Self-contained (fetches its own data from the uid prop) so it drops into
 * either screen's Stats tab without extra plumbing there.
 */
export function TeamsSection({ uid, colors, showCreateButton }: TeamsSectionProps) {
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    teamApi.getTeamsForUser(uid)
      .then((data) => { if (!cancelled) setTeams(data); })
      .catch(() => { if (!cancelled) setTeams([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid]);

  if (loading) {
    return (
      <View style={styles.section}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (teams.length === 0 && !showCreateButton) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>TEAMS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {teams.map((team) => {
          const logoUri = resolveMediaUrl(team.logoUrl);
          return (
            <Pressable key={team.id} style={styles.card} onPress={() => router.push(`/team/${team.id}` as any)}>
              {logoUri ? (
                <Image source={{ uri: logoUri }} style={styles.logo} />
              ) : (
                <View style={styles.logoFallback}>
                  <Shield color={colors.primary} size={20} strokeWidth={2} />
                </View>
              )}
              <Text style={styles.cardName} numberOfLines={1}>{team.name}</Text>
              <Text style={styles.cardMeta}>
                {team.members.length} {team.members.length === 1 ? 'player' : 'players'}
              </Text>
            </Pressable>
          );
        })}
        {showCreateButton && (
          <Pressable style={styles.createCard} onPress={() => router.push('/create-team' as any)}>
            <Plus color={colors.primary} size={20} strokeWidth={2.5} />
            <Text style={styles.createText}>Create Team</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  section: { marginHorizontal: 16, marginBottom: 18 },
  title: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.8, marginBottom: 10 },
  row: { gap: 10, paddingRight: 4 },
  card: {
    width: 108, backgroundColor: colors.cardBg, borderRadius: 14, padding: 12,
    alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  logo: { width: 44, height: 44, borderRadius: 22, marginBottom: 8 },
  logoFallback: {
    width: 44, height: 44, borderRadius: 22, marginBottom: 8,
    backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center',
  },
  cardName: { fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' },
  cardMeta: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  createCard: {
    width: 108, backgroundColor: colors.cardBg, borderRadius: 14, padding: 12,
    alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: colors.primary + '40', borderStyle: 'dashed',
  },
  createText: { fontSize: 11, fontWeight: '700', color: colors.primary, textAlign: 'center' },
});
