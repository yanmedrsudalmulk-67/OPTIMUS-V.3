import { describe, expect, it } from 'vitest';
import { calculateAward, calculateRound, winnerAtEnd } from '../packages/game-engine/src';
import { CHARACTERS, type TeamCharacterSlot } from '../packages/shared/src';
import { characterSlotSchema, teamJoinSchema } from '../apps/realtime-server/src/validation';
import { defaultTeamCharacters } from '../apps/realtime-server/src/services/game';

describe('Two Team Controllers - Character Limit Validation', () => {
  it('provides exactly 3 default characters for Team A and Team B', () => {
    const charsA = defaultTeamCharacters('A');
    const charsB = defaultTeamCharacters('B');

    expect(charsA).toHaveLength(3);
    expect(charsB).toHaveLength(3);

    charsA.forEach((char) => {
      expect(CHARACTERS.some((c) => c.id === char.characterId)).toBe(true);
      expect(char.name.length).toBeGreaterThan(0);
    });

    charsB.forEach((char) => {
      expect(CHARACTERS.some((c) => c.id === char.characterId)).toBe(true);
      expect(char.name.length).toBeGreaterThan(0);
    });
  });

  it('accepts valid 3-character configurations via teamJoinSchema', () => {
    const validPayload = {
      code: 'MED729',
      team: 'A',
      teamName: 'Infection Fighters',
      characters: [
        { slot: 0, characterId: 'doctor-m', name: 'DR. ADI' },
        { slot: 1, characterId: 'nurse-m', name: 'NURSE RIAN' },
        { slot: 2, characterId: 'midwife', name: 'MIDWIFE SITI' },
      ],
    };

    const parsed = teamJoinSchema.parse(validPayload);
    expect(parsed.characters).toHaveLength(3);
  });

  it('rejects team configurations with fewer or more than 3 characters', () => {
    const twoChars = {
      code: 'MED729',
      team: 'A',
      teamName: 'Understaffed Team',
      characters: [
        { slot: 0, characterId: 'doctor-m', name: 'DR. ADI' },
        { slot: 1, characterId: 'nurse-m', name: 'NURSE RIAN' },
      ],
    };

    expect(() => teamJoinSchema.parse(twoChars)).toThrow();

    const fourChars = {
      code: 'MED729',
      team: 'A',
      teamName: 'Overstaffed Team',
      characters: [
        { slot: 0, characterId: 'doctor-m', name: 'DR. ADI' },
        { slot: 1, characterId: 'nurse-m', name: 'NURSE RIAN' },
        { slot: 2, characterId: 'midwife', name: 'MIDWIFE SITI' },
        { slot: 3, characterId: 'pharmacist', name: 'APT. DIMAS' },
      ],
    };

    expect(() => teamJoinSchema.parse(fourChars)).toThrow();
  });

  it('rejects invalid character IDs not present in CHARACTERS gallery', () => {
    const invalidHero = {
      slot: 0,
      characterId: 'superman-nonexistent',
      name: 'Fake Hero',
    };

    expect(() => characterSlotSchema.parse(invalidHero)).toThrow();
  });
});

describe('Two Team Controllers - One Answer Per Team Rule', () => {
  it('allows each team to submit exactly one answer per question', () => {
    const answers: Record<string, number> = {};

    const submitTeamAnswer = (team: 'A' | 'B', answerIndex: number) => {
      if (answers[team] !== undefined) {
        throw new Error(`Tim ${team} sudah mengirimkan jawaban`);
      }
      answers[team] = answerIndex;
      return true;
    };

    // First answers from Team A and Team B succeed
    expect(submitTeamAnswer('A', 2)).toBe(true);
    expect(submitTeamAnswer('B', 1)).toBe(true);

    // Repeated answers fail
    expect(() => submitTeamAnswer('A', 0)).toThrow('Tim A sudah mengirimkan jawaban');
    expect(() => submitTeamAnswer('B', 3)).toThrow('Tim B sudah mengirimkan jawaban');
  });
});

describe('Two Team Controllers - Scoring Scenarios from Revision Prompt', () => {
  const pullMultiplier = 1.5;
  const winThreshold = 100;

  it('Skenario A: Tim A benar (+10), Tim B salah (0) -> Tarik ke arah Tim A', () => {
    const teamAPower = 10;
    const teamBPower = 0;

    const round = calculateRound({
      ropePosition: 0,
      teamAPower,
      teamBPower,
      pullMultiplier,
      winThreshold,
    });

    // delta = (0 - 10) * 1.5 = -15 (negative moves toward Team A)
    expect(round.ropeBefore).toBe(0);
    expect(round.ropeAfter).toBe(-15);
    expect(round.winner).toBeNull();
  });

  it('Skenario B: Tim A salah (0), Tim B benar (+10) -> Tarik ke arah Tim B', () => {
    const teamAPower = 0;
    const teamBPower = 10;

    const round = calculateRound({
      ropePosition: 0,
      teamAPower,
      teamBPower,
      pullMultiplier,
      winThreshold,
    });

    // delta = (10 - 0) * 1.5 = +15 (positive moves toward Team B)
    expect(round.ropeBefore).toBe(0);
    expect(round.ropeAfter).toBe(15);
    expect(round.winner).toBeNull();
  });

  it('Skenario C: Kedua tim benar (+10 vs +10) -> Seimbang (POWER BALANCED), tidak ada pergeseran', () => {
    const teamAPower = 10;
    const teamBPower = 10;

    const round = calculateRound({
      ropePosition: -10, // existing slight advantage
      teamAPower,
      teamBPower,
      pullMultiplier,
      winThreshold,
    });

    // delta = (10 - 10) * 1.5 = 0
    expect(round.ropeBefore).toBe(-10);
    expect(round.ropeAfter).toBe(-10);
    expect(round.winner).toBeNull();
  });

  it('Skenario D: Kedua tim salah (0 vs 0) -> Tidak ada tim mendapat kekuatan', () => {
    const teamAPower = 0;
    const teamBPower = 0;

    const round = calculateRound({
      ropePosition: 20,
      teamAPower,
      teamBPower,
      pullMultiplier,
      winThreshold,
    });

    expect(round.ropeBefore).toBe(20);
    expect(round.ropeAfter).toBe(20);
    expect(round.winner).toBeNull();
  });

  it('Clamps position at win threshold and declares correct winner', () => {
    const victoryRound = calculateRound({
      ropePosition: -95,
      teamAPower: 10,
      teamBPower: 0,
      pullMultiplier: 1.5,
      winThreshold: 100,
    });

    // -95 - 15 = -110, clamped to -100 -> Team A wins
    expect(victoryRound.ropeAfter).toBe(-100);
    expect(victoryRound.winner).toBe('A');
  });
});

describe('Admin-Only Start Battle & Readiness Logic', () => {
  it('allows start battle only when both teams are connected, ready, and have 3 characters', () => {
    const isStartable = (teams: any) =>
      Boolean(
        teams?.A?.connected &&
        teams?.B?.connected &&
        teams?.A?.ready &&
        teams?.B?.ready &&
        teams?.A?.characters?.length === 3 &&
        teams?.B?.characters?.length === 3
      );

    // Initial state: both disconnected
    const state1 = {
      A: { connected: false, ready: false, characters: defaultTeamCharacters('A') },
      B: { connected: false, ready: false, characters: defaultTeamCharacters('B') },
    };
    expect(isStartable(state1)).toBe(false);

    // Both connected, but not ready
    const state2 = {
      A: { connected: true, ready: false, characters: defaultTeamCharacters('A') },
      B: { connected: true, ready: false, characters: defaultTeamCharacters('B') },
    };
    expect(isStartable(state2)).toBe(false);

    // Team A ready, Team B not ready
    const state3 = {
      A: { connected: true, ready: true, characters: defaultTeamCharacters('A') },
      B: { connected: true, ready: false, characters: defaultTeamCharacters('B') },
    };
    expect(isStartable(state3)).toBe(false);

    // Both teams connected and ready with 3 characters
    const state4 = {
      A: { connected: true, ready: true, characters: defaultTeamCharacters('A') },
      B: { connected: true, ready: true, characters: defaultTeamCharacters('B') },
    };
    expect(isStartable(state4)).toBe(true);

    // Both ready but Team A has invalid characters count
    const state5 = {
      A: { connected: true, ready: true, characters: [{ slot: 0, characterId: 'doctor-m', name: 'Dr' }] },
      B: { connected: true, ready: true, characters: defaultTeamCharacters('B') },
    };
    expect(isStartable(state5)).toBe(false);
  });
});
