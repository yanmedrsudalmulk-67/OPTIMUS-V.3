import { CHARACTERS, type TeamCharacterSlot } from '../../../packages/shared/src';

export type Slots = [TeamCharacterSlot, TeamCharacterSlot, TeamCharacterSlot];

export interface PublicLeader {
  id: string;
  name: string;
  team: string;
  score: number;
  correctCount: number;
  power: number;
  matches: number;
  wins?: number;
  leadCharacterId?: string;
  characterNames?: string[];
  arena?: string;
  finishedAt?: string | null;
}

export interface RankedLeaderRow extends PublicLeader {
  rank: number;
  medal: 'gold' | 'silver' | 'bronze' | null;
  tier: number;
  avatarPath: string;
  memberSummary: string;
}

export interface FormattedRankingBoard {
  rows: RankedLeaderRow[];
  mvp: RankedLeaderRow | null;
}

const DEFAULT_HERO_NAME_SET = new Set(CHARACTERS.map((c) => c.name.trim().toLowerCase()));

export function getHeroAvatarPath(characterId?: string): string {
  if (characterId) {
    const found = CHARACTERS.find((c) => c.id === characterId);
    if (found) return found.thumbnailPath;
  }
  return CHARACTERS[0].thumbnailPath;
}

export function computeLeaderTier(score: number, power: number): number {
  const weighted = Math.max(0, score) + Math.max(0, power) * 2;
  return Math.min(10, Math.max(1, Math.floor(weighted / 100) + 1));
}

export function formatRankingEntries(entries: PublicLeader[]): FormattedRankingBoard {
  const uniqueMap = new Map<string, PublicLeader>();
  for (const entry of entries) {
    const key = entry.name.trim().toLowerCase() || entry.id;
    const prev = uniqueMap.get(key);
    if (!prev) {
      uniqueMap.set(key, entry);
      continue;
    }
    const isBetter =
      entry.score > prev.score ||
      (entry.score === prev.score && entry.correctCount > prev.correctCount) ||
      (entry.score === prev.score &&
        entry.correctCount === prev.correctCount &&
        entry.power > prev.power);
    if (isBetter) {
      uniqueMap.set(key, { ...entry, matches: prev.matches + entry.matches });
    } else {
      uniqueMap.set(key, { ...prev, matches: prev.matches + entry.matches });
    }
  }

  const sorted = [...uniqueMap.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    if (b.power !== a.power) return b.power - a.power;
    return a.name.localeCompare(b.name);
  });

  const rows: RankedLeaderRow[] = sorted.map((entry, idx) => {
    const rank = idx + 1;
    const medal: RankedLeaderRow['medal'] =
      rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : null;
    const cleanMembers = (entry.characterNames || [])
      .map((n) => n.trim())
      .filter(Boolean);

    return {
      ...entry,
      name: entry.name.trim() || `Tim #${rank}`,
      rank,
      medal,
      tier: computeLeaderTier(entry.score, entry.power),
      avatarPath: getHeroAvatarPath(entry.leadCharacterId),
      memberSummary: cleanMembers.join(' • '),
    };
  });

  return {
    rows,
    mvp: rows[0] ?? null,
  };
}

export function sanitizeTeamName(raw: string, fallback: string): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ').slice(0, 40);
  return cleaned || fallback;
}

export function sanitizeCharacterName(raw: string, fallback: string): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ').slice(0, 30);
  return cleaned || fallback;
}

export function isCustomCharacterName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  return !DEFAULT_HERO_NAME_SET.has(normalized);
}

export function updateSlotCharacterName(
  slots: Slots,
  slotIndex: number,
  nextName: string,
): Slots {
  const clamped = nextName.slice(0, 30);
  return slots.map((item) =>
    item.slot === slotIndex ? { ...item, name: clamped } : item,
  ) as Slots;
}

export function assignHeroPreservingCustomName(
  slots: Slots,
  slotIndex: number,
  nextHeroId: string,
): Slots {
  const def = CHARACTERS.find((c) => c.id === nextHeroId);
  if (!def) return slots;
  return slots.map((item) => {
    if (item.slot !== slotIndex) return item;
    const keepCustom = isCustomCharacterName(item.name);
    return {
      ...item,
      characterId: def.id,
      name: keepCustom ? item.name : def.name,
    };
  }) as Slots;
}

export function finalizeTeamSlots(slots: Slots): Slots {
  return slots.map((item) => {
    const def = CHARACTERS.find((c) => c.id === item.characterId) || CHARACTERS[0];
    return {
      ...item,
      name: sanitizeCharacterName(item.name, def.name),
    };
  }) as Slots;
}
