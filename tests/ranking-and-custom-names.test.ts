import { describe, expect, it } from 'vitest';
import { defaultTeamCharacters } from '../packages/shared/src';
import {
  assignHeroPreservingCustomName,
  computeLeaderTier,
  finalizeTeamSlots,
  formatRankingEntries,
  getHeroAvatarPath,
  isCustomCharacterName,
  sanitizeTeamName,
  updateSlotCharacterName,
  type PublicLeader,
} from '../apps/web/lib/ranking';

describe('ranking board formatting & custom team/character name helpers', () => {
  it('sorts leaders by score, then correctCount, then power and assigns medals and MVP', () => {
    const input: PublicLeader[] = [
      {
        id: 't2',
        name: 'Rajawali IGD',
        team: 'B',
        score: 300,
        correctCount: 3,
        power: 35,
        matches: 1,
        leadCharacterId: 'doctor-f',
        characterNames: ['Dr. Rini', 'Apt. Bagas', 'Analis Tono'],
      },
      {
        id: 't1',
        name: 'Garuda Medis',
        team: 'A',
        score: 500,
        correctCount: 5,
        power: 60,
        matches: 2,
        leadCharacterId: 'surgeon',
        characterNames: ['Dr. Budi', 'Ners Cinta', 'Bidan Dewi'],
      },
      {
        id: 't3',
        name: 'Elang Farmasi',
        team: 'A',
        score: 300,
        correctCount: 2,
        power: 40,
        matches: 1,
        leadCharacterId: 'pharmacist',
      },
      {
        id: 't4',
        name: 'Nusantara Care',
        team: 'B',
        score: 120,
        correctCount: 1,
        power: 15,
        matches: 1,
      },
    ];

    const board = formatRankingEntries(input);
    expect(board.mvp?.name).toBe('Garuda Medis');
    expect(board.rows.map((r) => [r.rank, r.name, r.medal])).toEqual([
      [1, 'Garuda Medis', 'gold'],
      [2, 'Rajawali IGD', 'silver'],
      [3, 'Elang Farmasi', 'bronze'],
      [4, 'Nusantara Care', null],
    ]);
    expect(board.rows[0].avatarPath).toBe('/heroes/surgeon.webp');
    expect(board.rows[0].memberSummary).toBe('Dr. Budi • Ners Cinta • Bidan Dewi');
    expect(board.rows[0].tier).toBe(computeLeaderTier(500, 60));
    expect(board.rows[3].avatarPath).toBe(getHeroAvatarPath(undefined));
  });

  it('returns null mvp and empty rows when no entries exist', () => {
    const board = formatRankingEntries([]);
    expect(board.rows).toEqual([]);
    expect(board.mvp).toBeNull();
  });

  it('updates character name in place and clamps to 30 characters', () => {
    const slots = defaultTeamCharacters('A');
    const updated = updateSlotCharacterName(slots, 1, 'Suster Kartika Sangat Panjang Sekali');
    expect(updated[1].name.length).toBe(30);
    expect(updated[0].name).toBe(slots[0].name);
    expect(updated[2].name).toBe(slots[2].name);
  });

  it('preserves user custom character name when switching hero skin, while updating default hero names', () => {
    const slots = defaultTeamCharacters('A');
    // Slot 0 still has default hero name ("Dr. Arga") -> switching hero updates name to new hero default
    const swappedDefault = assignHeroPreservingCustomName(slots, 0, 'surgeon');
    expect(swappedDefault[0].characterId).toBe('surgeon');
    expect(swappedDefault[0].name).toBe('Dr. Farah');
    expect(isCustomCharacterName(swappedDefault[0].name)).toBe(false);

    // User renames Slot 0 to custom name ("dr. Hendra") -> switching hero keeps "dr. Hendra"
    const renamed = updateSlotCharacterName(swappedDefault, 0, 'dr. Hendra');
    expect(isCustomCharacterName(renamed[0].name)).toBe(true);
    const swappedCustom = assignHeroPreservingCustomName(renamed, 0, 'ambulance');
    expect(swappedCustom[0].characterId).toBe('ambulance');
    expect(swappedCustom[0].name).toBe('dr. Hendra');
  });

  it('finalizes empty slot names back to hero defaults and sanitizes team names', () => {
    const slots = updateSlotCharacterName(defaultTeamCharacters('B'), 2, '   ');
    const finalized = finalizeTeamSlots(slots);
    expect(finalized[2].name).toBe('Analis Raka');

    expect(sanitizeTeamName('  Garuda   Medis  ', 'Tim 1')).toBe('Garuda Medis');
    expect(sanitizeTeamName('   ', 'Tim 1')).toBe('Tim 1');
  });

  it('collapses duplicate team names into one ranked row keeping the highest score', () => {
    const board = formatRankingEntries([
      { id: '1', name: 'TIM BIRU', team: 'B', score: 300, correctCount: 3, power: 30, matches: 1 },
      { id: '2', name: 'TIM BIRU', team: 'B', score: 400, correctCount: 4, power: 40, matches: 1 },
      { id: '3', name: 'GARUDA MEDIS', team: 'A', score: 250, correctCount: 2, power: 25, matches: 1 },
    ]);
    expect(board.rows).toHaveLength(2);
    expect(board.rows[0].name).toBe('TIM BIRU');
    expect(board.rows[0].score).toBe(400);
    expect(board.rows[0].matches).toBe(2);
    expect(board.rows[1].name).toBe('GARUDA MEDIS');
  });
});
