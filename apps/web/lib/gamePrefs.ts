import type { Quality } from '../../../packages/shared/src';

export type QuickPlayMode = 'local' | 'bot';

export interface PublicPackageSummary {
  id: string;
  name: string;
  description: string;
  questionCount: number;
}

export interface GamePrefs {
  arena: 'hospital' | 'fantasy' | 'beach';
  packageId: string;
  questionCount: number;
  duration: number;
  playMode: QuickPlayMode;
  sound: boolean;
  music: boolean;
  volume: number;
  quality: Quality;
}

export interface QuickMatchSession {
  code: string;
  quickToken: string;
  mode: QuickPlayMode;
  title?: string;
  updatedAt: number;
}

export const DEFAULT_GAME_PREFS: GamePrefs = {
  arena: 'hospital',
  packageId: '',
  questionCount: 5,
  duration: 5,
  playMode: 'local',
  sound: true,
  music: true,
  volume: 0.45,
  quality: 'AUTO',
};

const PREFS_KEY = 'medical-tug:prefs:v1';
const LAST_QUICK_KEY = 'medical-tug:last-quick:v1';
const quickSessionKey = (code: string) => `medical-tug:quick:${code.toUpperCase()}`;

export function readGamePrefs(): GamePrefs {
  if (typeof window === 'undefined') return DEFAULT_GAME_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_GAME_PREFS;
    return { ...DEFAULT_GAME_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_GAME_PREFS;
  }
}

export function saveGamePrefs(patch: Partial<GamePrefs>): GamePrefs {
  const next = { ...readGamePrefs(), ...patch };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* Storage may be disabled in private contexts. */
    }
  }
  return next;
}

export function saveQuickSession(session: QuickMatchSession) {
  if (typeof window === 'undefined') return;
  try {
    const payload = JSON.stringify({
      ...session,
      code: session.code.toUpperCase(),
      updatedAt: Date.now(),
    });
    window.localStorage.setItem(quickSessionKey(session.code), payload);
    window.localStorage.setItem(LAST_QUICK_KEY, payload);
  } catch {
    /* Ignore storage errors cleanly. */
  }
}

export function readQuickSession(code: string): QuickMatchSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(quickSessionKey(code));
    return raw ? (JSON.parse(raw) as QuickMatchSession) : null;
  } catch {
    return null;
  }
}

export function readLastQuickSession(): QuickMatchSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_QUICK_KEY);
    return raw ? (JSON.parse(raw) as QuickMatchSession) : null;
  } catch {
    return null;
  }
}

export function clearLastQuickSession() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LAST_QUICK_KEY);
  } catch {
    /* Ignore storage errors. */
  }
}
