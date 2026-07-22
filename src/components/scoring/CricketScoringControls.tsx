import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Undo2 } from 'lucide-react-native';
import { Colors } from '../../styles/colors';
import { MatchScoreState } from '../../types/api';

interface Innings {
  battingTeam: 'A' | 'B';
  runs: number;
  wickets: number;
  overs: number;
  balls: number; // 0-5, balls into the current over
  batsman: string;
  bowler: string;
}

interface CricketScoringControlsProps {
  score: MatchScoreState;
  teamAName: string;
  teamBName: string;
  updating: boolean;
  onUpdateState: (payload: { teamAScore?: number; teamBScore?: number; state?: Record<string, any> }) => Promise<any>;
}

const RUN_OPTIONS = [0, 1, 2, 3, 4, 6];

function legalDelivery(innings: Innings, patch: Partial<Innings>): Innings {
  let { balls, overs } = innings;
  balls += 1;
  if (balls === 6) { overs += 1; balls = 0; }
  return { ...innings, ...patch, balls, overs };
}

function teamScoresFrom(innings: Innings[]): { teamAScore: number; teamBScore: number } {
  const a = innings.find((i) => i.battingTeam === 'A');
  const b = innings.find((i) => i.battingTeam === 'B');
  return { teamAScore: a?.runs ?? 0, teamBScore: b?.runs ?? 0 };
}

export function CricketScoringControls({ score, teamAName, teamBName, updating, onUpdateState }: CricketScoringControlsProps) {
  const currentInnings: number = score.state?.currentInnings ?? 1;
  const inningsList: Innings[] = Array.isArray(score.state?.innings) ? score.state.innings : [];
  const active: Innings = inningsList[currentInnings - 1] || {
    battingTeam: 'A', runs: 0, wickets: 0, overs: 0, balls: 0, batsman: '', bowler: '',
  };
  const historyRef = useRef<{ currentInnings: number; innings: Innings[] }[]>([]);
  const [batsman, setBatsman] = useState(active.batsman || '');
  const [bowler, setBowler] = useState(active.bowler || '');

  const commit = (nextInnings: Innings, nextCurrentInnings = currentInnings) => {
    historyRef.current.push({ currentInnings, innings: inningsList });
    const list = [...inningsList];
    list[nextCurrentInnings - 1] = nextInnings;
    const { teamAScore, teamBScore } = teamScoresFrom(list);
    onUpdateState({
      teamAScore,
      teamBScore,
      state: { ...score.state, currentInnings: nextCurrentInnings, innings: list },
    });
  };

  const recordRuns = (runs: number) => {
    if (updating) return;
    commit(legalDelivery(active, { runs: active.runs + runs, batsman, bowler }));
  };

  const recordWicket = () => {
    if (updating) return;
    commit(legalDelivery(active, { wickets: Math.min(10, active.wickets + 1), batsman, bowler }));
  };

  const recordExtra = (kind: 'wide' | 'noball') => {
    if (updating) return;
    commit({ ...active, runs: active.runs + 1, batsman, bowler });
  };

  const undo = () => {
    const prev = historyRef.current.pop();
    if (!prev || updating) return;
    const { teamAScore, teamBScore } = teamScoresFrom(prev.innings);
    onUpdateState({
      teamAScore,
      teamBScore,
      state: { ...score.state, currentInnings: prev.currentInnings, innings: prev.innings },
    });
  };

  const startNextInnings = () => {
    if (updating || currentInnings >= 2) return;
    const otherTeam: 'A' | 'B' = active.battingTeam === 'A' ? 'B' : 'A';
    historyRef.current.push({ currentInnings, innings: inningsList });
    const list = [...inningsList];
    list[1] = { battingTeam: otherTeam, runs: 0, wickets: 0, overs: 0, balls: 0, batsman: '', bowler: '' };
    setBatsman('');
    setBowler('');
    const { teamAScore, teamBScore } = teamScoresFrom(list);
    onUpdateState({ teamAScore, teamBScore, state: { ...score.state, currentInnings: 2, innings: list } });
  };

  const battingName = active.battingTeam === 'A' ? teamAName : teamBName;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.inningsBadge}>
          <Text style={styles.inningsBadgeText}>INNINGS {currentInnings}</Text>
        </View>
        <Text style={styles.battingText}>{battingName} batting</Text>
        <Pressable onPress={undo} disabled={updating || historyRef.current.length === 0} hitSlop={8} style={styles.undoBtn}>
          <Undo2 color={historyRef.current.length === 0 ? Colors.neutral300 : Colors.neutral600} size={16} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={styles.tallyCard}>
        <Text style={styles.tallyRuns}>{active.runs}<Text style={styles.tallyWickets}>/{active.wickets}</Text></Text>
        <Text style={styles.tallyOvers}>Overs {active.overs}.{active.balls}</Text>
      </View>

      <View style={styles.namesRow}>
        <TextInput
          style={styles.nameInput}
          placeholder="Batsman"
          placeholderTextColor={Colors.textMuted}
          value={batsman}
          onChangeText={setBatsman}
        />
        <TextInput
          style={styles.nameInput}
          placeholder="Bowler"
          placeholderTextColor={Colors.textMuted}
          value={bowler}
          onChangeText={setBowler}
        />
      </View>

      <Text style={styles.sectionLabel}>RUNS</Text>
      <View style={styles.runsGrid}>
        {RUN_OPTIONS.map((r) => (
          <Pressable
            key={r}
            style={[styles.runBtn, r === 4 && styles.runBtnFour, r === 6 && styles.runBtnSix]}
            onPress={() => recordRuns(r)}
            disabled={updating}
          >
            <Text style={[styles.runBtnText, (r === 4 || r === 6) && styles.runBtnTextLight]}>{r}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.eventsRow}>
        <Pressable style={[styles.eventBtn, { backgroundColor: Colors.liveRed }]} onPress={recordWicket} disabled={updating}>
          <Text style={styles.eventBtnText}>WICKET</Text>
        </Pressable>
        <Pressable style={[styles.eventBtn, { backgroundColor: Colors.warning }]} onPress={() => recordExtra('wide')} disabled={updating}>
          <Text style={styles.eventBtnText}>WIDE</Text>
        </Pressable>
        <Pressable style={[styles.eventBtn, { backgroundColor: Colors.primaryAccent }]} onPress={() => recordExtra('noball')} disabled={updating}>
          <Text style={styles.eventBtnText}>NO BALL</Text>
        </Pressable>
      </View>

      {currentInnings === 1 && (
        <Pressable style={styles.nextInningsBtn} onPress={startNextInnings} disabled={updating}>
          <Text style={styles.nextInningsText}>Start Innings 2</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inningsBadge: { backgroundColor: Colors.cricket, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  inningsBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  battingText: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.neutral700 },
  undoBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.neutral100, alignItems: 'center', justifyContent: 'center' },

  tallyCard: {
    backgroundColor: Colors.cricketLight, borderRadius: 18, paddingVertical: 18, alignItems: 'center', gap: 4,
  },
  tallyRuns: { fontSize: 40, fontWeight: '900', color: Colors.cricket, fontVariant: ['tabular-nums'] },
  tallyWickets: { fontSize: 24, color: Colors.cricket },
  tallyOvers: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark },

  namesRow: { flexDirection: 'row', gap: 10 },
  nameInput: {
    flex: 1, backgroundColor: Colors.inputBg, borderRadius: 12, borderWidth: 1, borderColor: Colors.inputBorder,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: Colors.text,
  },

  sectionLabel: { fontSize: 10.5, fontWeight: '800', color: Colors.neutral500, letterSpacing: 1.2 },
  runsGrid: { flexDirection: 'row', gap: 8 },
  runBtn: {
    flex: 1, aspectRatio: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.neutral100, borderWidth: 1.5, borderColor: Colors.neutral200,
  },
  runBtnFour: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  runBtnSix: { backgroundColor: Colors.cricket, borderColor: Colors.cricket },
  runBtnText: { fontSize: 17, fontWeight: '900', color: Colors.neutral800 },
  runBtnTextLight: { color: Colors.white },

  eventsRow: { flexDirection: 'row', gap: 8 },
  eventBtn: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  eventBtnText: { color: Colors.white, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.4 },

  nextInningsBtn: {
    marginTop: 4, backgroundColor: Colors.neutral900, borderRadius: 14, paddingVertical: 13, alignItems: 'center',
  },
  nextInningsText: { color: Colors.white, fontSize: 13.5, fontWeight: '800' },
});
