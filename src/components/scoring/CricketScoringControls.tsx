import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Undo2 } from 'lucide-react-native';
import { ThemeColors } from '../../styles/colors';
import { useTheme } from '../../context/ThemeContext';
import { MatchScorecard, MatchScoreState, MatchTeamPlayer } from '../../types/api';
import { RecordEventPayload } from '../../api/matchScoreApi';
import { RosterPlayerSelectSheet } from './RosterPlayerSelectSheet';

interface CricketScoringControlsProps {
  score: MatchScoreState;
  scorecard: MatchScorecard | null;
  teamAName: string;
  teamBName: string;
  updating: boolean;
  onRecordEvent: (payload: RecordEventPayload) => Promise<any>;
  onUndoLastEvent: () => Promise<any>;
}

const RUN_OPTIONS = [0, 1, 2, 3, 4, 6];

export function CricketScoringControls({
  score, scorecard, teamAName, teamBName, updating, onRecordEvent, onUndoLastEvent,
}: CricketScoringControlsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [currentInnings, setCurrentInnings] = useState<1 | 2>(1);
  const [battingTeamChoice, setBattingTeamChoice] = useState<'A' | 'B'>('A');
  const [batsman, setBatsman] = useState<MatchTeamPlayer | null>(null);
  const [bowler, setBowler] = useState<MatchTeamPlayer | null>(null);
  const [picker, setPicker] = useState<'batsman' | 'bowler' | null>(null);

  const activeInnings = scorecard?.innings?.find((i) => i.inningsNumber === currentInnings) ?? null;
  // Once the first ball of an innings is recorded, the server's own record of
  // who's batting is authoritative — the pre-ball local toggle only matters
  // for picking who bats BEFORE that first ball exists anywhere.
  const battingTeam: 'A' | 'B' = (activeInnings?.battingTeamLabel as 'A' | 'B') ?? battingTeamChoice;
  const bowlingTeam: 'A' | 'B' = battingTeam === 'A' ? 'B' : 'A';
  const battingTeamName = battingTeam === 'A' ? teamAName : teamBName;
  const runs = activeInnings?.runs ?? 0;
  const wickets = activeInnings?.wickets ?? 0;
  const overs = activeInnings?.overs ?? 0;
  const ballsInOver = activeInnings?.ballsInOver ?? 0;
  const hasAnyBall = activeInnings != null;
  const eventsSoFar = scorecard?.events.length ?? 0;

  const battingRoster = battingTeam === 'A' ? (scorecard?.teamA ?? []) : (scorecard?.teamB ?? []);
  const bowlingRoster = bowlingTeam === 'A' ? (scorecard?.teamA ?? []) : (scorecard?.teamB ?? []);

  const recordBall = (opts: { runs: number; extraType?: string; isWicket?: boolean; wicketType?: string }) => {
    if (updating) return;
    onRecordEvent({
      teamLabel: battingTeam,
      eventType: 'BALL',
      playerId: batsman?.id ?? null,
      bowlerId: bowler?.id ?? null,
      inningsNumber: currentInnings,
      runs: opts.runs,
      extraType: opts.extraType,
      isWicket: opts.isWicket ?? false,
      wicketType: opts.wicketType,
    });
  };

  const startNextInnings = () => {
    if (updating || currentInnings === 2) return;
    setCurrentInnings(2);
    setBattingTeamChoice(battingTeam === 'A' ? 'B' : 'A');
    setBatsman(null);
    setBowler(null);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.inningsBadge}>
          <Text style={styles.inningsBadgeText}>INNINGS {currentInnings}</Text>
        </View>
        <Text style={styles.battingText}>{battingTeamName} batting</Text>
        <Pressable onPress={onUndoLastEvent} disabled={updating || eventsSoFar === 0} hitSlop={8} style={styles.undoBtn}>
          <Undo2 color={eventsSoFar === 0 ? colors.neutral300 : colors.neutral600} size={16} strokeWidth={2.2} />
        </Pressable>
      </View>

      {!hasAnyBall && (
        <View style={styles.battingChoiceRow}>
          <Text style={styles.battingChoiceLabel}>Who's batting?</Text>
          <View style={styles.battingChoicePills}>
            {(['A', 'B'] as const).map((t) => (
              <Pressable
                key={t}
                style={[styles.battingChoicePill, battingTeamChoice === t && styles.battingChoicePillActive]}
                onPress={() => setBattingTeamChoice(t)}
              >
                <Text style={[styles.battingChoicePillText, battingTeamChoice === t && styles.battingChoicePillTextActive]}>
                  {t === 'A' ? teamAName : teamBName}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.tallyCard}>
        <Text style={styles.tallyRuns}>{runs}<Text style={styles.tallyWickets}>/{wickets}</Text></Text>
        <Text style={styles.tallyOvers}>Overs {overs}.{ballsInOver}</Text>
      </View>

      <View style={styles.namesRow}>
        <Pressable style={styles.nameBtn} onPress={() => setPicker('batsman')} disabled={updating}>
          <Text style={styles.nameBtnLabel}>Batsman</Text>
          <Text style={styles.nameBtnValue} numberOfLines={1}>{batsman?.displayName ?? 'Select…'}</Text>
        </Pressable>
        <Pressable style={styles.nameBtn} onPress={() => setPicker('bowler')} disabled={updating}>
          <Text style={styles.nameBtnLabel}>Bowler</Text>
          <Text style={styles.nameBtnValue} numberOfLines={1}>{bowler?.displayName ?? 'Select…'}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>RUNS</Text>
      <View style={styles.runsGrid}>
        {RUN_OPTIONS.map((r) => (
          <Pressable
            key={r}
            style={[styles.runBtn, r === 4 && styles.runBtnFour, r === 6 && styles.runBtnSix]}
            onPress={() => recordBall({ runs: r })}
            disabled={updating}
          >
            <Text style={[styles.runBtnText, (r === 4 || r === 6) && styles.runBtnTextLight]}>{r}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.eventsRow}>
        <Pressable style={[styles.eventBtn, { backgroundColor: colors.liveRed }]} onPress={() => recordBall({ runs: 0, isWicket: true, wicketType: 'BOWLED' })} disabled={updating}>
          <Text style={styles.eventBtnText}>WICKET</Text>
        </Pressable>
        <Pressable style={[styles.eventBtn, { backgroundColor: colors.warning }]} onPress={() => recordBall({ runs: 0, extraType: 'WIDE' })} disabled={updating}>
          <Text style={styles.eventBtnText}>WIDE</Text>
        </Pressable>
        <Pressable style={[styles.eventBtn, { backgroundColor: colors.primaryAccent }]} onPress={() => recordBall({ runs: 0, extraType: 'NO_BALL' })} disabled={updating}>
          <Text style={styles.eventBtnText}>NO BALL</Text>
        </Pressable>
      </View>
      <View style={styles.eventsRow}>
        <Pressable style={[styles.eventBtn, styles.eventBtnOutline]} onPress={() => recordBall({ runs: 1, extraType: 'BYE' })} disabled={updating}>
          <Text style={styles.eventBtnOutlineText}>BYE</Text>
        </Pressable>
        <Pressable style={[styles.eventBtn, styles.eventBtnOutline]} onPress={() => recordBall({ runs: 1, extraType: 'LEG_BYE' })} disabled={updating}>
          <Text style={styles.eventBtnOutlineText}>LEG BYE</Text>
        </Pressable>
      </View>

      {currentInnings === 1 && (
        <Pressable style={styles.nextInningsBtn} onPress={startNextInnings} disabled={updating}>
          <Text style={styles.nextInningsText}>Start Innings 2</Text>
        </Pressable>
      )}

      <RosterPlayerSelectSheet
        visible={picker === 'batsman'}
        onClose={() => setPicker(null)}
        title={`${battingTeamName} batsman`}
        players={battingRoster}
        noneLabel="Clear selection"
        onSelect={setBatsman}
      />
      <RosterPlayerSelectSheet
        visible={picker === 'bowler'}
        onClose={() => setPicker(null)}
        title={`${bowlingTeam === 'A' ? teamAName : teamBName} bowler`}
        players={bowlingRoster}
        noneLabel="Clear selection"
        onSelect={setBowler}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: { gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inningsBadge: { backgroundColor: colors.cricket, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  inningsBadgeText: { color: colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  battingText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.neutral700 },
  undoBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.neutral100, alignItems: 'center', justifyContent: 'center' },

  battingChoiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  battingChoiceLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  battingChoicePills: { flexDirection: 'row', gap: 8, flex: 1 },
  battingChoicePill: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: colors.neutral100, borderWidth: 1.5, borderColor: 'transparent' },
  battingChoicePillActive: { backgroundColor: colors.cricketLight, borderColor: colors.cricket },
  battingChoicePillText: { fontSize: 12, fontWeight: '700', color: colors.neutral500 },
  battingChoicePillTextActive: { color: colors.cricket },

  tallyCard: {
    backgroundColor: colors.cricketLight, borderRadius: 18, paddingVertical: 18, alignItems: 'center', gap: 4,
  },
  tallyRuns: { fontSize: 40, fontWeight: '900', color: colors.cricket, fontVariant: ['tabular-nums'] },
  tallyWickets: { fontSize: 24, color: colors.cricket },
  tallyOvers: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },

  namesRow: { flexDirection: 'row', gap: 10 },
  nameBtn: {
    flex: 1, backgroundColor: colors.inputBg, borderRadius: 12, borderWidth: 1, borderColor: colors.inputBorder,
    paddingHorizontal: 12, paddingVertical: 9, gap: 2,
  },
  nameBtnLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  nameBtnValue: { fontSize: 13.5, fontWeight: '700', color: colors.text },

  sectionLabel: { fontSize: 10.5, fontWeight: '800', color: colors.neutral500, letterSpacing: 1.2 },
  runsGrid: { flexDirection: 'row', gap: 8 },
  runBtn: {
    flex: 1, aspectRatio: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.neutral100, borderWidth: 1.5, borderColor: colors.neutral200,
  },
  runBtnFour: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  runBtnSix: { backgroundColor: colors.cricket, borderColor: colors.cricket },
  runBtnText: { fontSize: 17, fontWeight: '900', color: colors.neutral800 },
  runBtnTextLight: { color: colors.white },

  eventsRow: { flexDirection: 'row', gap: 8 },
  eventBtn: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  eventBtnText: { color: colors.white, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.4 },
  eventBtnOutline: { backgroundColor: colors.neutral100, borderWidth: 1, borderColor: colors.neutral200 },
  eventBtnOutlineText: { color: colors.neutral700, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.4 },

  nextInningsBtn: {
    marginTop: 4, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 13, alignItems: 'center',
  },
  nextInningsText: { color: colors.white, fontSize: 13.5, fontWeight: '800' },
});
