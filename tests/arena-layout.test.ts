import { describe, expect, it } from 'vitest';
import type { RoomState } from '../packages/shared/src';
import {
  formatVictorySummary,
  getArenaLayoutConfig,
  getQuestionCountdownState,
  getRopeFloorRestTarget,
  imageYToNdcY,
  QUICK_QUESTION_DURATION_SEC,
} from '../apps/web/lib/arenaLayout';

function makeMockState(overrides: Partial<RoomState> = {}): RoomState {
  return {
    code: 'TEST01',
    title: 'Test Match',
    phase: 'FINISHED',
    paused: false,
    teamAName: 'TIM HIJAU',
    teamBName: 'TIM BIRU',
    teamAPower: 40,
    teamBPower: 10,
    ropePosition: -40,
    winner: 'A',
    questionIndex: 4,
    questionCount: 5,
    phaseEndsAt: null,
    remainingMs: null,
    players: [],
    teams: {
      A: {
        team: 'A',
        name: 'TIM HIJAU',
        connected: true,
        ready: true,
        power: 40,
        score: 400,
        correctCount: 4,
        answered: true,
        lastCorrect: true,
        characters: [],
      },
      B: {
        team: 'B',
        name: 'TIM BIRU',
        connected: true,
        ready: true,
        power: 10,
        score: 100,
        correctCount: 1,
        answered: true,
        lastCorrect: false,
        characters: [],
      },
    },
    settings: {
      arena: 'beach',
      quality: 'AUTO',
      questionCount: 5,
      questionDurationSec: 20,
      winThreshold: 100,
      cameraMotion: true,
      particles: true,
    },
    ...overrides,
  } as RoomState;
}

describe('arenaLayout helpers', () => {
  it('centers Arena Pantai hero feet higher into the glowing circular court and enlarges contestants', () => {
    const beach = getArenaLayoutConfig('beach');
    const hospital = getArenaLayoutConfig('hospital');
    const fantasy = getArenaLayoutConfig('fantasy');

    expect(beach.courtFeetImgFrac).toBeLessThan(hospital.courtFeetImgFrac);
    expect(beach.courtFeetImgFrac).toBeGreaterThan(0.7);
    expect(beach.courtFeetImgFrac).toBeLessThan(0.77);

    expect(beach.contestantScale).toBeGreaterThan(1.1);
    expect(hospital.contestantScale).toBeGreaterThan(1.1);
    expect(fantasy.contestantScale).toBeGreaterThan(1.1);
  });

  it('uses unclipped grounded crowd mode for Arena Pantai and barricade mode for Hospital', () => {
    const beach = getArenaLayoutConfig('beach');
    const hospital = getArenaLayoutConfig('hospital');
    const fantasy = getArenaLayoutConfig('fantasy');

    expect(beach.crowd.enabled).toBe(true);
    expect(beach.crowd.mode).toBe('grounded');
    expect(hospital.crowd.enabled).toBe(true);
    expect(hospital.crowd.mode).toBe('barricade');
    expect(fantasy.crowd.enabled).toBe(false);
  });

  it('maps normalized backdrop Y coordinates cleanly into NDC Y', () => {
    // When containerAspect <= imgAspect, scale = 1 so screenFrac === imgFrac
    expect(imageYToNdcY(0.5, 1.5, 1672 / 941, 0.72)).toBeCloseTo(0, 5);
    expect(imageYToNdcY(0.75, 1.5, 1672 / 941, 0.72)).toBeCloseTo(-0.5, 5);
    // Wider container zooms vertically around objPosY = 0.72
    expect(imageYToNdcY(0.72, 2.3, 1672 / 941, 0.72)).toBeCloseTo(1 - 2 * 0.72, 5);
  });

  it('formats Victory banner summary as concise 4 - 1 round readout for Team A or Team B win', () => {
    const summaryA = formatVictorySummary(makeMockState({ winner: 'A' }));
    expect(summaryA.headline).toBe('VICTORY');
    expect(summaryA.subtitle).toBe('TIM HIJAU MENANG');
    expect(summaryA.winnerSide).toBe('A');
    expect(summaryA.leftValue).toBe(4);
    expect(summaryA.rightValue).toBe(1);

    const stateB = makeMockState({ winner: 'B' });
    stateB.teams.A.correctCount = 1;
    stateB.teams.B.correctCount = 3;
    const summaryB = formatVictorySummary(stateB);
    expect(summaryB.headline).toBe('VICTORY');
    expect(summaryB.subtitle).toBe('TIM BIRU MENANG');
    expect(summaryB.winnerSide).toBe('B');
    expect(summaryB.leftValue).toBe(1);
    expect(summaryB.rightValue).toBe(3);
  });

  it('falls back to team scores when correctCount is tied but one team won on score', () => {
    const tiedCorrect = makeMockState({ winner: 'A' });
    tiedCorrect.teams.A.correctCount = 2;
    tiedCorrect.teams.B.correctCount = 2;
    tiedCorrect.teams.A.score = 260;
    tiedCorrect.teams.B.score = 210;

    const summary = formatVictorySummary(tiedCorrect);
    expect(summary.leftValue).toBe(260);
    expect(summary.rightValue).toBe(210);
  });

  it('formats DRAW state cleanly', () => {
    const drawState = makeMockState({ winner: 'DRAW' });
    drawState.teams.A.correctCount = 2;
    drawState.teams.B.correctCount = 2;
    const summary = formatVictorySummary(drawState);
    expect(summary.headline).toBe('SERI!');
    expect(summary.subtitle).toBe('PERTANDINGAN SERI');
    expect(summary.winnerSide).toBe('DRAW');
    expect(summary.leftValue).toBe(2);
    expect(summary.rightValue).toBe(2);
  });

  it('computes 5-second question countdown visibility, progress, and urgency', () => {
    expect(QUICK_QUESTION_DURATION_SEC).toBe(5);

    const start = getQuestionCountdownState('QUESTION_ACTIVE', 5);
    expect(start.visible).toBe(true);
    expect(start.seconds).toBe(5);
    expect(start.progress).toBeCloseTo(1, 5);
    expect(start.urgent).toBe(false);

    const urgent = getQuestionCountdownState('QUESTION_ACTIVE', 2);
    expect(urgent.visible).toBe(true);
    expect(urgent.seconds).toBe(2);
    expect(urgent.progress).toBeCloseTo(0.4, 5);
    expect(urgent.urgent).toBe(true);

    const hidden = getQuestionCountdownState('PULL_ANIMATION', 3);
    expect(hidden.visible).toBe(false);
    expect(hidden.urgent).toBe(false);

    const finished = getQuestionCountdownState('FINISHED', 0);
    expect(finished.visible).toBe(false);
  });

  it('drops all 17 rope control points onto the floor surface (never floating) on Victory', () => {
    for (let i = 0; i < 17; i += 1) {
      const target = getRopeFloorRestTarget(i);
      expect(target.y).toBeCloseTo(0.058, 3);
      expect(target.y).toBeLessThan(0.1);
      expect(target.z).toBeGreaterThanOrEqual(0.55);
      expect(target.z).toBeLessThanOrEqual(0.8);
    }
  });
});
