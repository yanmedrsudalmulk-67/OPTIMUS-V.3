import type { Team } from '../../shared/src/index';

export interface RoundInput {
  ropePosition: number;
  teamAPower: number;
  teamBPower: number;
  pullMultiplier: number;
  winThreshold: number;
}

export interface RoundCalculation {
  ropeBefore: number;
  ropeAfter: number;
  winner: Team | null;
}

export interface AwardInput {
  correct: boolean;
  points: number;
  baseCorrectPower: number;
  responseTimeMs: number;
  durationMs: number;
  /** Consecutive correct answers before this answer. */
  streak: number;
  speedBonus: boolean;
  comboBonus: boolean;
}

export interface Award {
  points: number;
  power: number;
}

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  return value;
}

function nonnegative(value: number, name: string): number {
  finite(value, name);
  if (value < 0) throw new RangeError(`${name} must be nonnegative`);
  return value;
}

/** Negative rope coordinates favor Team A; positive coordinates favor Team B. */
export function calculateRound(input: RoundInput): RoundCalculation {
  const { ropePosition, teamAPower, teamBPower, pullMultiplier, winThreshold } = input;
  finite(ropePosition, 'ropePosition');
  nonnegative(teamAPower, 'teamAPower');
  nonnegative(teamBPower, 'teamBPower');
  nonnegative(pullMultiplier, 'pullMultiplier');
  finite(winThreshold, 'winThreshold');
  if (winThreshold <= 0) throw new RangeError('winThreshold must be positive');
  if (Math.abs(ropePosition) > winThreshold)
    throw new RangeError('ropePosition is outside the arena');

  const ropeDelta = (teamBPower - teamAPower) * pullMultiplier;
  finite(ropeDelta, 'ropeDelta');
  const rawPosition = ropePosition + ropeDelta;
  finite(rawPosition, 'newRopePosition');
  const ropeAfter = Math.max(-winThreshold, Math.min(winThreshold, rawPosition));
  return {
    ropeBefore: ropePosition,
    ropeAfter: Object.is(ropeAfter, -0) ? 0 : ropeAfter,
    winner: ropeAfter <= -winThreshold ? 'A' : ropeAfter >= winThreshold ? 'B' : null,
  };
}

/**
 * Deterministic optional bonuses affect pull power only. A quick response adds
 * 0–5 power; the third consecutive correct answer and later answers add 5.
 * In standard mode both bonuses are off, so each correct answer is worth the
 * configured question points and exactly baseCorrectPower (normally 10).
 */
export function calculateAward(input: AwardInput): Award {
  nonnegative(input.points, 'points');
  nonnegative(input.baseCorrectPower, 'baseCorrectPower');
  nonnegative(input.responseTimeMs, 'responseTimeMs');
  finite(input.durationMs, 'durationMs');
  if (input.durationMs <= 0) throw new RangeError('durationMs must be positive');
  nonnegative(input.streak, 'streak');
  if (!Number.isInteger(input.streak)) throw new RangeError('streak must be an integer');
  if (!input.correct || input.responseTimeMs > input.durationMs) return { points: 0, power: 0 };

  const speed = input.speedBonus
    ? Math.floor(5 * Math.max(0, 1 - input.responseTimeMs / input.durationMs))
    : 0;
  const combo = input.comboBonus && input.streak >= 2 ? 5 : 0;
  const power = input.baseCorrectPower + speed + combo;
  finite(power, 'awardedPower');
  return { points: input.points, power };
}

export function winnerAtEnd(ropePosition: number): Team | 'DRAW' {
  finite(ropePosition, 'ropePosition');
  return ropePosition < 0 ? 'A' : ropePosition > 0 ? 'B' : 'DRAW';
}
