import { describe, expect, it } from 'vitest';
import { calculateAward, calculateRound, winnerAtEnd } from '../packages/game-engine/src';

const round = {
  ropePosition: 0,
  teamAPower: 30,
  teamBPower: 20,
  pullMultiplier: 1.5,
  winThreshold: 100,
};
const award = {
  correct: true,
  points: 100,
  baseCorrectPower: 10,
  responseTimeMs: 5_000,
  durationMs: 20_000,
  streak: 0,
  speedBonus: false,
  comboBonus: false,
};

describe('authoritative round calculation', () => {
  it('moves toward Team A for the specified 30 versus 20 example', () => {
    expect(calculateRound(round)).toEqual({ ropeBefore: 0, ropeAfter: -15, winner: null });
  });

  it('moves toward Team B with the same magnitude when powers reverse', () => {
    expect(calculateRound({ ...round, teamAPower: 20, teamBPower: 30 }).ropeAfter).toBe(15);
  });

  it('preserves the existing coordinate on a tied round', () => {
    expect(calculateRound({ ...round, ropePosition: -45, teamAPower: 20 })).toEqual({
      ropeBefore: -45,
      ropeAfter: -45,
      winner: null,
    });
  });

  it('clamps an overshoot at Team A victory threshold', () => {
    expect(calculateRound({ ...round, ropePosition: -90 })).toEqual({
      ropeBefore: -90,
      ropeAfter: -100,
      winner: 'A',
    });
  });

  it('clamps an overshoot at Team B victory threshold', () => {
    expect(calculateRound({ ...round, ropePosition: 90, teamAPower: 0, teamBPower: 30 })).toEqual({
      ropeBefore: 90,
      ropeAfter: 100,
      winner: 'B',
    });
  });

  it('uses the configured threshold and multiplier', () => {
    expect(calculateRound({ ...round, winThreshold: 12, pullMultiplier: 2 }).winner).toBe('A');
  });

  it.each([
    { teamAPower: Number.NaN },
    { teamBPower: Infinity },
    { ropePosition: -Infinity },
    { pullMultiplier: Number.NaN },
    { winThreshold: 0 },
    { winThreshold: -1 },
    { teamAPower: -1 },
    { teamBPower: -1 },
    { pullMultiplier: -1 },
    { ropePosition: 101 },
    { teamAPower: Number.MAX_VALUE, teamBPower: 0, pullMultiplier: Number.MAX_VALUE },
  ])('rejects invalid authoritative inputs %o', (invalid) => {
    expect(() => calculateRound({ ...round, ...invalid })).toThrow(RangeError);
  });
});

describe('individual answer awards', () => {
  it('awards configured points and exactly 10 power with bonuses disabled', () => {
    expect(calculateAward(award)).toEqual({ points: 100, power: 10 });
    expect(calculateAward({ ...award, responseTimeMs: 0, streak: 9 })).toEqual({
      points: 100,
      power: 10,
    });
  });

  it('awards no points or power to an incorrect or late answer', () => {
    expect(calculateAward({ ...award, correct: false })).toEqual({ points: 0, power: 0 });
    expect(calculateAward({ ...award, responseTimeMs: 20_001 })).toEqual({ points: 0, power: 0 });
  });

  it('has a deterministic speed bonus that decreases with response time', () => {
    expect(calculateAward({ ...award, speedBonus: true, responseTimeMs: 0 }).power).toBe(15);
    expect(calculateAward({ ...award, speedBonus: true }).power).toBe(13);
    expect(calculateAward({ ...award, speedBonus: true, responseTimeMs: 20_000 }).power).toBe(10);
  });

  it('begins the combo bonus at the third consecutive correct answer', () => {
    expect(calculateAward({ ...award, comboBonus: true, streak: 1 }).power).toBe(10);
    expect(calculateAward({ ...award, comboBonus: true, streak: 2 }).power).toBe(15);
    expect(calculateAward({ ...award, comboBonus: true, streak: 20 }).power).toBe(15);
  });

  it('combines bonuses without changing individual question points', () => {
    expect(calculateAward({ ...award, comboBonus: true, speedBonus: true, streak: 2 })).toEqual({
      points: 100,
      power: 18,
    });
  });

  it.each([
    { points: -1 },
    { points: Number.NaN },
    { baseCorrectPower: Infinity },
    { durationMs: 0 },
    { durationMs: -1 },
    { responseTimeMs: -1 },
    { responseTimeMs: Number.NaN },
    { streak: -1 },
    { streak: 1.5 },
  ])('rejects invalid scoring inputs %o', (invalid) => {
    expect(() => calculateAward({ ...award, ...invalid })).toThrow(RangeError);
  });
});

describe('end-of-package winner', () => {
  it('resolves either leading team or a draw without requiring extra questions', () => {
    expect(winnerAtEnd(-15)).toBe('A');
    expect(winnerAtEnd(15)).toBe('B');
    expect(winnerAtEnd(0)).toBe('DRAW');
  });

  it('rejects a corrupt coordinate rather than silently declaring a draw', () => {
    expect(() => winnerAtEnd(Number.NaN)).toThrow(RangeError);
  });
});
