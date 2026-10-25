import { useEffect, useState } from 'react';
import * as Font from 'expo-font';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { Orbitron_800ExtraBold } from '@expo-google-fonts/orbitron';
import { PermanentMarker_400Regular } from '@expo-google-fonts/permanent-marker';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';

/** Font families the story caption looks use (bundled with the app — no network). */
export const STORY_FONT = {
  stadium: 'BebasNeue_400Regular',
  scoreboard: 'Orbitron_800ExtraBold',
  marker: 'PermanentMarker_400Regular',
  neon: 'Pacifico_400Regular',
} as const;

const FONT_MAP = {
  BebasNeue_400Regular,
  Orbitron_800ExtraBold,
  PermanentMarker_400Regular,
  Pacifico_400Regular,
};
let loadPromise: Promise<void> | null = null;
let settled = false;

/**
 * Loads the story fonts the first time they're needed (a story opened or the
 * composer shown) — never at app start-up. Returns true once usable, or once
 * loading failed, in which case captions fall back to the system font rather
 * than referencing a family that isn't registered. Shared across components.
 */
export function useStoryFonts(enabled = true): boolean {
  const [ready, setReady] = useState(settled);
  useEffect(() => {
    if (!enabled || ready) return;
    let alive = true;
    if (!loadPromise) {
      loadPromise = Font.loadAsync(FONT_MAP).catch(() => {}).then(() => { settled = true; });
    }
    loadPromise.then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [enabled, ready]);
  return ready;
}
