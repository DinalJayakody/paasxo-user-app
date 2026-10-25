import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import {
  CalendarClock, ChevronRight, ClipboardList, Flame, Lock, MapPin, RefreshCw, Trophy,
} from 'lucide-react-native';
import { ThemeColors } from '../../styles/colors';
import { MatchHistoryItem, PlayerStats, SportStats, statsApi } from '../../api/statsApi';

// ── Sport presentation ─────────────────────────────────────────────────────

const SPORT_META: Record<string, { label: string; emoji: string; colorKey: keyof ThemeColors }> = {
  FUTSAL: { label: 'Futsal', emoji: '⚽', colorKey: 'futsal' },
  CRICKET: { label: 'Cricket', emoji: '🏏', colorKey: 'cricket' },
  PICKLEBALL: { label: 'Pickleball', emoji: '🏓', colorKey: 'pickleball' },
  PADDLEBALL: { label: 'Paddleball', emoji: '🎾', colorKey: 'paddleball' },
};

function sportMeta(sport: string, colors: ThemeColors) {
  const m = SPORT_META[sport];
  const label = m?.label ?? sport.charAt(0) + sport.slice(1).toLowerCase().replace(/_/g, ' ');
  const color = (m && (colors[m.colorKey] as string)) || colors.primary;
  return { label, emoji: m?.emoji ?? '🏅', color };
}

// Server times are the venue's local wall clock without a zone — parse the
// parts directly so the device's timezone never shifts the date.
function parseLocal(iso: string | null): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function timeLabel(d: Date) {
  const h = d.getHours();
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${((h + 11) % 12) + 1}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}

const dash = (v: number | null | undefined, digits = 0) =>
  v == null || Number.isNaN(v) ? '—' : digits > 0 ? v.toFixed(digits) : String(v);

// ── Small building blocks ──────────────────────────────────────────────────

function WinRing({ pct, size = 86, stroke = 8, color, track, label }: {
  pct: number | null; size?: number; stroke?: number; color: string; track: string; label: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {pct != null && p > 0 && (
          <Circle
            cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
            strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - p / 100)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>{pct == null ? '—' : `${p}%`}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 }}>{label}</Text>
    </View>
  );
}

const Tile = memo(function Tile({ value, label, sub, accent, styles }: {
  value: string; label: string; sub?: string; accent?: string; styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileValue, accent ? { color: accent } : null]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
      {!!sub && <Text style={styles.tileSub} numberOfLines={1}>{sub}</Text>}
    </View>
  );
});

function resultColor(r: string | null | undefined, colors: ThemeColors) {
  return r === 'W' || r === 'WIN' ? colors.success : r === 'L' || r === 'LOSS' ? colors.error : colors.warning;
}

// ── Match row ──────────────────────────────────────────────────────────────

const STATUS_COPY: Record<string, string> = {
  UPCOMING: 'Upcoming', PENDING: 'Awaiting venue', LIVE: 'Live', PLAYED: 'Played',
  CANCELLED: 'Cancelled', EXPIRED: 'Not confirmed', COMPLETED: 'Final',
};

const MatchRow = memo(function MatchRow({ item, colors, styles, onOpen, onScorecard }: {
  item: MatchHistoryItem; colors: ThemeColors; styles: ReturnType<typeof createStyles>;
  onOpen: (id: number) => void; onScorecard: (id: number) => void;
}) {
  const d = parseLocal(item.startAt);
  const chip = item.result
    ? { text: item.result === 'WIN' ? 'Won' : item.result === 'LOSS' ? 'Lost' : 'Draw', color: resultColor(item.result, colors) }
    : item.status === 'LIVE' ? { text: 'Live', color: colors.error }
    : item.status === 'UPCOMING' ? { text: 'Upcoming', color: colors.primary }
    : item.status === 'PENDING' ? { text: STATUS_COPY.PENDING, color: colors.warning }
    : { text: STATUS_COPY[item.status] ?? item.status, color: colors.textMuted };
  const faded = item.status === 'CANCELLED' || item.status === 'EXPIRED';

  return (
    <Pressable
      onPress={() => onOpen(item.bookingId)}
      style={({ pressed }) => [styles.matchRow, pressed && { opacity: 0.75 }, faded && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.title ?? 'Match'}, ${chip.text}${item.scoreLabel ? `, ${item.scoreLabel}` : ''}`}
    >
      <View style={[styles.dateBlock, { borderColor: chip.color + '55' }]}>
        <Text style={styles.dateDay}>{d ? d.getDate() : '—'}</Text>
        <Text style={styles.dateMonth}>{d ? MONTHS[d.getMonth()] : ''}</Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.matchTopLine}>
          <View style={[styles.chip, { backgroundColor: chip.color + '1F' }]}>
            {item.status === 'LIVE' && <View style={[styles.liveDot, { backgroundColor: chip.color }]} />}
            <Text style={[styles.chipText, { color: chip.color }]}>{chip.text}</Text>
          </View>
          {item.organizer && <Text style={styles.hostTag}>Host</Text>}
        </View>
        <Text style={styles.matchTitle} numberOfLines={1}>{item.title || 'Match'}</Text>
        {!!item.scoreLabel && (
          <Text style={styles.teamsLine} numberOfLines={1}>
            {item.myTeamName ?? 'Team A'} vs {item.opponentName ?? 'Team B'}
          </Text>
        )}
        <View style={styles.metaLine}>
          <MapPin color={colors.textMuted} size={11} strokeWidth={2.4} />
          <Text style={styles.metaText} numberOfLines={1}>
            {item.venueName ?? 'Venue'}{d ? ` · ${timeLabel(d)}` : ''}
          </Text>
        </View>
        {!!item.contribution && (
          <Text style={styles.contribution} numberOfLines={1}>You: {item.contribution}</Text>
        )}
      </View>

      <View style={styles.matchRight}>
        {!!item.scoreLabel && (
          <Text style={[styles.scoreText, item.result ? { color: chip.color } : null]} numberOfLines={1}>
            {item.scoreLabel.replace(/ (games|runs)$/, '')}
          </Text>
        )}
        {item.hasScorecard ? (
          <Pressable
            onPress={() => onScorecard(item.bookingId)}
            hitSlop={8}
            style={({ pressed }) => [styles.scorecardBtn, pressed && { opacity: 0.6 }]}
            accessibilityLabel="Open scorecard"
          >
            <ClipboardList color={colors.primary} size={13} strokeWidth={2.4} />
            <Text style={styles.scorecardText}>Scorecard</Text>
          </Pressable>
        ) : (
          <ChevronRight color={colors.textMuted} size={18} />
        )}
      </View>
    </Pressable>
  );
});

// ── Main section ───────────────────────────────────────────────────────────

// Stats per profile for the current visit: switching tabs reuses them; a new
// visit or pull-to-refresh (new refreshKey) always fetches fresh numbers.
const statsCache = new Map<string, { refreshKey: number; stats: PlayerStats }>();

interface HistoryState { items: MatchHistoryItem[]; page: number; hasMore: boolean; loading: boolean; error: boolean }
const PAGE_SIZE = 10;

/**
 * Profile → Stats: real match statistics computed server-side from the
 * matches this player played and the scoring events credited to them.
 * Loads once per visit (and on pull-to-refresh via refreshKey); match history
 * pages load per sport, on demand, and are kept while switching sports.
 */
export function PlayerStatsSection({ userId, isOwn, refreshKey, colors, displayName }: {
  userId: string;
  isOwn: boolean;
  refreshKey: number;
  colors: ThemeColors;
  displayName?: string;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const cached = statsCache.get(userId);
  const warm = cached && cached.refreshKey === refreshKey ? cached.stats : null;
  const [stats, setStats] = useState<PlayerStats | null>(warm);
  const [state, setState] = useState<'loading' | 'ready' | 'private' | 'error'>(warm ? 'ready' : 'loading');
  const [sport, setSport] = useState<string | null>(warm?.sports[0]?.sport ?? null);
  const [history, setHistory] = useState<Record<string, HistoryState>>({});
  const reqId = useRef(0);
  const historyRef = useRef(history);
  historyRef.current = history;

  const load = useCallback(async (force = false) => {
    const hit = statsCache.get(userId);
    if (!force && hit && hit.refreshKey === refreshKey) return;
    const id = ++reqId.current;
    setState((s) => (s === 'ready' ? s : 'loading'));
    try {
      const data = await statsApi.getStats(userId);
      if (id !== reqId.current) return;
      if (statsCache.size > 30) statsCache.delete(statsCache.keys().next().value as string);
      statsCache.set(userId, { refreshKey, stats: data });
      setStats(data);
      setHistory({});
      setSport((cur) => (cur && data.sports.some((s) => s.sport === cur) ? cur : data.sports[0]?.sport ?? null));
      setState('ready');
    } catch (err: any) {
      if (id !== reqId.current) return;
      setState(err?.response?.status === 403 ? 'private' : 'error');
    }
  }, [userId, refreshKey]);

  useEffect(() => { load(); }, [load]);

  const loadHistory = useCallback(async (forSport: string, page: number) => {
    const cur = historyRef.current[forSport];
    if (cur?.loading) return;
    setHistory((h) => ({ ...h, [forSport]: { items: page === 0 ? [] : h[forSport]?.items ?? [], page, hasMore: false, loading: true, error: false } }));
    try {
      const res = await statsApi.getMatches(userId, forSport, page, PAGE_SIZE);
      setHistory((h) => {
        const prev = page === 0 ? [] : h[forSport]?.items ?? [];
        const seen = new Set(prev.map((m) => m.bookingId));
        return { ...h, [forSport]: { items: [...prev, ...res.content.filter((m) => !seen.has(m.bookingId))], page, hasMore: res.hasMore, loading: false, error: false } };
      });
    } catch {
      setHistory((h) => ({ ...h, [forSport]: { ...(h[forSport] ?? { items: [], page: 0, hasMore: false }), loading: false, error: true } }));
    }
  }, [userId]);

  useEffect(() => {
    if (state === 'ready' && sport && !historyRef.current[sport]) loadHistory(sport, 0);
  }, [state, sport, loadHistory]);

  const openMatch = useCallback((id: number) => router.push(`/match/${id}` as any), [router]);
  const openScorecard = useCallback((id: number) => router.push(`/match/${id}/scorecard` as any), [router]);

  // ── States ──
  if (state === 'loading' && !stats) {
    return (
      <View style={styles.centerCard}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.centerText}>Crunching the numbers…</Text>
      </View>
    );
  }
  if (state === 'private') {
    return (
      <View style={styles.centerCard}>
        <Lock color={colors.textMuted} size={28} strokeWidth={2} />
        <Text style={styles.centerTitle}>Stats are private</Text>
        <Text style={styles.centerText}>Follow {displayName?.split(' ')[0] || 'this player'} to see their match stats.</Text>
      </View>
    );
  }
  if (state === 'error' && !stats) {
    return (
      <View style={styles.centerCard}>
        <Text style={styles.centerTitle}>Couldn’t load stats</Text>
        <Pressable onPress={() => load(true)} style={styles.retryBtn}>
          <RefreshCw color="#fff" size={14} strokeWidth={2.6} />
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  if (!stats || stats.sports.length === 0) {
    return (
      <View style={styles.centerCard}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.primary + '1A' }]}>
          <Trophy color={colors.primary} size={28} strokeWidth={2} />
        </View>
        <Text style={styles.centerTitle}>{isOwn ? 'Your stats start with your first match' : 'No matches yet'}</Text>
        <Text style={styles.centerText}>
          {isOwn
            ? 'Join or create a match — goals, runs, wickets and results are tracked here automatically when the match is scored.'
            : `${displayName?.split(' ')[0] || 'This player'} hasn’t played a match on Paasxo yet.`}
        </Text>
        {isOwn && (
          <Pressable onPress={() => router.push('/home' as any)} style={styles.retryBtn}>
            <Text style={styles.retryText}>Find a match</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const selected = stats.sports.find((s) => s.sport === sport) ?? stats.sports[0];
  const meta = sportMeta(selected.sport, colors);
  const hist = history[selected.sport];

  return (
    <View style={styles.wrap}>
      {/* ── Overview ── */}
      <LinearGradient colors={[colors.primary, colors.primaryDark ?? colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroEyebrow}>ALL SPORTS</Text>
          <Text style={styles.heroBig}>{stats.matchesPlayed}</Text>
          <Text style={styles.heroLabel}>Matches played</Text>
          <View style={styles.heroRecord}>
            <RecordPill label="W" value={stats.wins} />
            <RecordPill label="D" value={stats.draws} />
            <RecordPill label="L" value={stats.losses} />
          </View>
          {stats.upcoming > 0 && (
            <View style={styles.heroUpcoming}>
              <CalendarClock color="#fff" size={12} strokeWidth={2.4} />
              <Text style={styles.heroUpcomingText}>{stats.upcoming} upcoming</Text>
            </View>
          )}
        </View>
        <WinRing pct={stats.winRate} color="#FFFFFF" track="rgba(255,255,255,0.25)" label="WIN RATE" />
      </LinearGradient>

      {/* ── Sport picker ── */}
      {stats.sports.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sportRow}>
          {stats.sports.map((s) => {
            const m = sportMeta(s.sport, colors);
            const active = s.sport === selected.sport;
            return (
              <Pressable
                key={s.sport}
                onPress={() => setSport(s.sport)}
                style={[styles.sportChip, active && { backgroundColor: m.color, borderColor: m.color }]}
                accessibilityState={{ selected: active }}
              >
                <Text style={styles.sportChipEmoji}>{m.emoji}</Text>
                <Text style={[styles.sportChipText, active && { color: '#fff' }]}>{m.label}</Text>
                <View style={[styles.sportChipCount, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                  <Text style={[styles.sportChipCountText, active && { color: '#fff' }]}>{s.matchesPlayed}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* ── Sport card ── */}
      <SportCard s={selected} meta={meta} colors={colors} styles={styles} />

      {/* ── Matches ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{meta.label} matches</Text>
        {!isOwn && <Text style={styles.sectionHint}>Public matches</Text>}
      </View>
      <View style={styles.card}>
        {(!hist || (hist.loading && hist.items.length === 0)) ? (
          <ActivityIndicator color={colors.primary} style={{ paddingVertical: 24 }} />
        ) : hist.items.length === 0 ? (
          <Text style={styles.emptyList}>{hist.error ? 'Couldn’t load matches.' : 'No matches to show yet.'}</Text>
        ) : (
          hist.items.map((m, i) => (
            <View key={m.bookingId}>
              {i > 0 && <View style={styles.divider} />}
              <MatchRow item={m} colors={colors} styles={styles} onOpen={openMatch} onScorecard={openScorecard} />
            </View>
          ))
        )}
        {hist && (hist.hasMore || hist.error) && (
          <Pressable
            onPress={() => loadHistory(selected.sport, hist.error && hist.items.length === 0 ? 0 : hist.page + (hist.error ? 0 : 1))}
            disabled={hist.loading}
            style={({ pressed }) => [styles.moreBtn, pressed && { opacity: 0.7 }]}
          >
            {hist.loading ? <ActivityIndicator color={colors.primary} size="small" /> : (
              <Text style={styles.moreText}>{hist.error ? 'Retry' : 'Show more matches'}</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

function RecordPill({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 }}>
      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '800' }}>{label}</Text>
    </View>
  );
}

// ── Per-sport card ─────────────────────────────────────────────────────────

function SportCard({ s, meta, colors, styles }: {
  s: SportStats; meta: { label: string; emoji: string; color: string }; colors: ThemeColors; styles: ReturnType<typeof createStyles>;
}) {
  const last = parseLocal(s.lastPlayedAt);
  const total = s.wins + s.draws + s.losses;
  const formOldestFirst = [...(s.form ?? [])].reverse();

  return (
    <View style={styles.card}>
      <View style={styles.sportHeader}>
        <View style={[styles.sportBadge, { backgroundColor: meta.color + '1F' }]}>
          <Text style={{ fontSize: 20 }}>{meta.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sportTitle, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
          <Text style={styles.sportSub}>
            {s.matchesPlayed} played{last ? ` · last ${last.getDate()} ${MONTHS[last.getMonth()]}` : ''}
            {s.live > 0 ? ` · ${s.live} live` : ''}
          </Text>
        </View>
        {!!s.currentStreak && (
          <View style={[styles.streak, { backgroundColor: resultColor(s.currentStreak[0], colors) + '1F' }]}>
            {s.currentStreak.startsWith('W') && <Flame color={colors.success} size={12} strokeWidth={2.6} />}
            <Text style={[styles.streakText, { color: resultColor(s.currentStreak[0], colors) }]}>{s.currentStreak}</Text>
          </View>
        )}
      </View>

      {/* Record + form */}
      <View style={styles.recordRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.recordNums}>
            <Text style={styles.recordBig}>{s.wins}<Text style={styles.recordUnit}> W</Text></Text>
            <Text style={styles.recordBig}>{s.draws}<Text style={styles.recordUnit}> D</Text></Text>
            <Text style={styles.recordBig}>{s.losses}<Text style={styles.recordUnit}> L</Text></Text>
          </View>
          <View style={styles.recordBar}>
            {total === 0 ? <View style={[styles.recordSeg, { flex: 1, backgroundColor: colors.neutral200 }]} /> : (
              <>
                {s.wins > 0 && <View style={[styles.recordSeg, { flex: s.wins, backgroundColor: colors.success }]} />}
                {s.draws > 0 && <View style={[styles.recordSeg, { flex: s.draws, backgroundColor: colors.warning }]} />}
                {s.losses > 0 && <View style={[styles.recordSeg, { flex: s.losses, backgroundColor: colors.error }]} />}
              </>
            )}
          </View>
          <Text style={styles.recordHint}>
            {total === 0
              ? 'Results appear once a match you’re rostered in is scored to the end.'
              : `${s.winRate ?? 0}% win rate · best run ${s.bestWinStreak} win${s.bestWinStreak === 1 ? '' : 's'}`}
          </Text>
        </View>
        {formOldestFirst.length > 0 && (
          <View style={styles.formCol}>
            <Text style={styles.formLabel}>FORM</Text>
            <View style={styles.formDots}>
              {formOldestFirst.map((r, i) => (
                <View key={i} style={[styles.formDot, { backgroundColor: resultColor(r, colors) }]}>
                  <Text style={styles.formDotText}>{r}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Sport-specific numbers */}
      {s.cricket ? (
        <>
          <Text style={styles.groupTitle}>Batting</Text>
          <View style={styles.grid}>
            <Tile styles={styles} value={dash(s.cricket.runs)} label="Runs" accent={meta.color} />
            <Tile styles={styles} value={dash(s.cricket.innings)} label="Innings" sub={s.cricket.notOuts ? `${s.cricket.notOuts} not out` : undefined} />
            <Tile styles={styles} value={s.cricket.innings ? `${s.cricket.highestScore}${s.cricket.highestNotOut ? '*' : ''}` : '—'} label="Highest" />
            <Tile styles={styles} value={dash(s.cricket.battingAverage, 2)} label="Average" />
            <Tile styles={styles} value={dash(s.cricket.strikeRate, 1)} label="Strike rate" />
            <Tile styles={styles} value={`${s.cricket.fifties}/${s.cricket.hundreds}`} label="50s / 100s" />
            <Tile styles={styles} value={`${s.cricket.fours}/${s.cricket.sixes}`} label="4s / 6s" />
            <Tile styles={styles} value={dash(s.cricket.ballsFaced)} label="Balls faced" />
            <Tile styles={styles} value={dash(s.cricket.ducks)} label="Ducks" />
          </View>
          <Text style={styles.groupTitle}>Bowling</Text>
          <View style={styles.grid}>
            <Tile styles={styles} value={dash(s.cricket.wickets)} label="Wickets" accent={meta.color} />
            <Tile styles={styles} value={s.cricket.ballsBowled ? s.cricket.overs : '—'} label="Overs" />
            <Tile styles={styles} value={s.cricket.bestBowling ?? '—'} label="Best" />
            <Tile styles={styles} value={dash(s.cricket.economy, 2)} label="Economy" />
            <Tile styles={styles} value={dash(s.cricket.bowlingAverage, 2)} label="Average" />
            <Tile styles={styles} value={dash(s.cricket.threeWicketHauls)} label="3+ wkts" />
          </View>
        </>
      ) : s.racket ? (
        <View style={styles.grid}>
          <Tile styles={styles} value={`${s.racket.gamesWon}–${s.racket.gamesLost}`} label="Games W–L" accent={meta.color} />
          <Tile styles={styles} value={s.racket.gameWinRate == null ? '—' : `${s.racket.gameWinRate}%`} label="Game win %" />
          <Tile styles={styles} value={dash(s.racket.pointsWon)} label="Points scored" />
          <Tile styles={styles} value={dash(s.matchesPlayed)} label="Matches" />
          <Tile styles={styles} value={dash(s.upcoming)} label="Upcoming" />
          <Tile styles={styles} value={dash(s.organized)} label="Hosted" />
        </View>
      ) : s.futsal ? (
        <View style={styles.grid}>
          <Tile styles={styles} value={dash(s.futsal.goals)} label="Goals" accent={meta.color} />
          <Tile styles={styles} value={dash(s.futsal.assists)} label="Assists" />
          <Tile styles={styles} value={dash(s.futsal.goalsPerMatch, 2)} label="Goals / match" />
          <Tile styles={styles} value={dash(s.futsal.cleanSheets)} label="Clean sheets" />
          <Tile styles={styles} value={dash(s.futsal.hatTricks)} label="Hat-tricks" />
          <Tile styles={styles} value={dash(s.futsal.saves)} label="Saves" />
          <Tile styles={styles} value={`${s.futsal.teamGoalsFor}–${s.futsal.teamGoalsAgainst}`} label="Team goals" sub="for – against" />
          <Tile styles={styles} value={dash(s.futsal.bestMatchGoals)} label="Best match" sub="goals" />
          <Tile styles={styles} value={`${s.futsal.yellowCards}/${s.futsal.redCards}`} label="Cards" sub="yellow / red" />
        </View>
      ) : null}

      <View style={styles.footerRow}>
        <FooterStat label="Upcoming" value={s.upcoming} styles={styles} />
        <FooterStat label="Hosted" value={s.organized} styles={styles} />
        <FooterStat label="Cancelled" value={s.cancelled} styles={styles} />
      </View>
    </View>
  );
}

function FooterStat({ label, value, styles }: { label: string; value: number; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.footerStat}>
      <Text style={styles.footerValue}>{value}</Text>
      <Text style={styles.footerLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 4, gap: 14 },
  centerCard: {
    marginHorizontal: 16, marginTop: 8, padding: 24, borderRadius: 20, alignItems: 'center', gap: 8,
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.neutral200,
  },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  centerTitle: { fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'center' },
  centerText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  retryBtn: {
    marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9,
  },
  retryText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },

  hero: { borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroEyebrow: { color: 'rgba(255,255,255,0.75)', fontSize: 10.5, fontWeight: '900', letterSpacing: 1.2 },
  heroBig: { color: '#fff', fontSize: 40, fontWeight: '900', lineHeight: 46, marginTop: 2 },
  heroLabel: { color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '700' },
  heroRecord: { flexDirection: 'row', gap: 6, marginTop: 10 },
  heroUpcoming: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  heroUpcomingText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  sportRow: { gap: 8, paddingRight: 4 },
  sportChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, paddingRight: 6, height: 36, borderRadius: 18,
    backgroundColor: colors.cardBg, borderWidth: 1.5, borderColor: colors.neutral200,
  },
  sportChipEmoji: { fontSize: 15 },
  sportChipText: { fontSize: 13, fontWeight: '800', color: colors.text },
  sportChipCount: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.neutral100 },
  sportChipCountText: { fontSize: 11.5, fontWeight: '900', color: colors.textSecondary },

  card: { backgroundColor: colors.cardBg, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.neutral200 },
  sportHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sportBadge: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  sportTitle: { fontSize: 15, fontWeight: '900', letterSpacing: 0.8 },
  sportSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  streakText: { fontSize: 12.5, fontWeight: '900' },

  recordRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginTop: 16 },
  recordNums: { flexDirection: 'row', gap: 16 },
  recordBig: { fontSize: 22, fontWeight: '900', color: colors.text },
  recordUnit: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  recordBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 8, gap: 2 },
  recordSeg: { height: 8 },
  recordHint: { fontSize: 11.5, color: colors.textSecondary, marginTop: 7, lineHeight: 16 },
  formCol: { alignItems: 'flex-end', gap: 6 },
  formLabel: { fontSize: 10, fontWeight: '900', color: colors.textMuted, letterSpacing: 1 },
  formDots: { flexDirection: 'row', gap: 4 },
  formDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  formDotText: { color: '#fff', fontSize: 10.5, fontWeight: '900' },

  groupTitle: { fontSize: 12, fontWeight: '900', color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginTop: 18, marginBottom: -4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tile: {
    flexBasis: '31%', flexGrow: 1, minHeight: 72, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8,
    backgroundColor: colors.neutral100, alignItems: 'center', justifyContent: 'center',
  },
  tileValue: { fontSize: 19, fontWeight: '900', color: colors.text },
  tileLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginTop: 3 },
  tileSub: { fontSize: 9.5, color: colors.textMuted, marginTop: 1 },

  footerRow: { flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.neutral200 },
  footerStat: { flex: 1, alignItems: 'center' },
  footerValue: { fontSize: 15, fontWeight: '900', color: colors.text },
  footerLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: -4 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  sectionHint: { fontSize: 11.5, color: colors.textMuted, fontWeight: '700' },
  emptyList: { textAlign: 'center', color: colors.textSecondary, fontSize: 13, paddingVertical: 18 },
  divider: { height: 1, backgroundColor: colors.neutral200, marginVertical: 2 },

  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  dateBlock: { width: 46, height: 52, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.neutral100 },
  dateDay: { fontSize: 18, fontWeight: '900', color: colors.text, lineHeight: 21 },
  dateMonth: { fontSize: 10.5, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' },
  matchTopLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  chipText: { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.3 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  hostTag: { fontSize: 10, fontWeight: '900', color: colors.primary, letterSpacing: 0.3 },
  matchTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 4 },
  teamsLine: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: 1 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: 11.5, color: colors.textMuted, flexShrink: 1 },
  contribution: { fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 3 },
  matchRight: { alignItems: 'flex-end', gap: 6, maxWidth: 96 },
  scoreText: { fontSize: 17, fontWeight: '900', color: colors.text },
  scorecardBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.primary + '14',
  },
  scorecardText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  moreBtn: { marginTop: 8, alignItems: 'center', justifyContent: 'center', height: 40, borderRadius: 12, backgroundColor: colors.neutral100 },
  moreText: { fontSize: 13, fontWeight: '800', color: colors.primary },
});
