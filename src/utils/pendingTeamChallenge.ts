import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Team-detail "Challenge" → create match → pay → challenge, as one flow:
 * the opponent picked at the start is remembered across the payment step
 * (which can leave the app for the gateway) and offered as the ready-made
 * choice on the opponent screen afterwards.
 */
const KEY = 'paasxo:pendingTeamChallengeOpponent';
const TTL_MS = 2 * 60 * 60 * 1000;

export interface PendingOpponent { teamId: string; teamName: string; savedAt: number }

export async function rememberChallengeOpponent(teamId: string, teamName: string) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ teamId, teamName, savedAt: Date.now() }));
  } catch { /* best effort */ }
}

export async function takeChallengeOpponent(): Promise<PendingOpponent | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(KEY);
    const p = JSON.parse(raw) as PendingOpponent;
    return p?.teamId && Date.now() - p.savedAt < TTL_MS ? p : null;
  } catch {
    return null;
  }
}

export async function clearChallengeOpponent() {
  try { await AsyncStorage.removeItem(KEY); } catch { /* ignore */ }
}
