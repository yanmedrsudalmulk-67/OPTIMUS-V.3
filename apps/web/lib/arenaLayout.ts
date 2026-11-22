import type { RoomState } from '../../../packages/shared/src';

export type ArenaThemeId = 'hospital' | 'fantasy' | 'beach';
export type CrowdPlacementMode = 'grounded' | 'barricade';

export interface ArenaLayoutConfig {
  imgAspect: number;
  objPosY: number;
  courtFeetImgFrac: number;
  contestantScale: number;
  nameAnchorY: number;
  cameraBaseZ: number;
  cameraFitAspect: number;
  cameraY: number;
  crowd: {
    enabled: boolean;
    mode: CrowdPlacementMode;
    anchorImgFrac: number;
    crowdZ: number;
    scaleBase: number;
    spanRatio: number;
  };
}

export interface VictorySummary {
  headline: string;
  subtitle: string;
  winnerSide: 'A' | 'B' | 'DRAW';
  leftValue: number;
  rightValue: number;
  leftTeamName: string;
  rightTeamName: string;
}

/**
 * Converts a normalized vertical coordinate on a `object-fit: cover` backdrop image
 * (`0` = top edge, `1` = bottom edge) into WebGL NDC Y (`+1` = top, `-1` = bottom).
 */
export function imageYToNdcY(
  imgFrac: number,
  containerAspect: number,
  imgAspect = 2.0,
  objPosY = 0.72,
): number {
  const safeContainer = Math.max(0.1, containerAspect);
  const safeImg = Math.max(0.1, imgAspect);
  const scale = safeContainer > safeImg ? safeContainer / safeImg : 1;
  const screenFrac = imgFrac * scale - objPosY * (scale - 1);
  return 1 - 2 * screenFrac;
}

/**
 * Single source of truth for per-arena 2D-backdrop to 3D-camera alignment,
 * hero scale, and spectator crowd grounding.
 */
export function getArenaLayoutConfig(theme: ArenaThemeId): ArenaLayoutConfig {
  if (theme === 'beach') {
    return {
      imgAspect: 1672 / 941,
      objPosY: 0.72,
      // Center heroes squarely inside the glowing circular neon court on Arena Pantai
      courtFeetImgFrac: 0.745,
      contestantScale: 1.16,
      nameAnchorY: 2.62,
      cameraBaseZ: 12.4,
      cameraFitAspect: 1.88,
      cameraY: 2.62,
      crowd: {
        enabled: true,
        // Full-body grounded on the sandy beach behind the court rim (zero mid-body clipping)
        mode: 'grounded',
        anchorImgFrac: 0.545,
        crowdZ: -5.6,
        scaleBase: 1.02,
        spanRatio: 0.34,
      },
    };
  }

  if (theme === 'fantasy') {
    return {
      imgAspect: 1672 / 941,
      objPosY: 0.72,
      courtFeetImgFrac: 0.79,
      contestantScale: 1.15,
      nameAnchorY: 2.62,
      cameraBaseZ: 12.4,
      cameraFitAspect: 1.88,
      cameraY: 2.62,
      crowd: {
        enabled: false,
        mode: 'grounded',
        anchorImgFrac: 0.56,
        crowdZ: -5.5,
        scaleBase: 1.0,
        spanRatio: 0.35,
      },
    };
  }

  return {
    imgAspect: 2.0,
    objPosY: 0.72,
    courtFeetImgFrac: 0.812,
    contestantScale: 1.15,
    nameAnchorY: 2.62,
    cameraBaseZ: 12.4,
    cameraFitAspect: 1.88,
    cameraY: 2.62,
    crowd: {
      enabled: true,
      mode: 'barricade',
      anchorImgFrac: 0.626,
      crowdZ: -5.1,
      scaleBase: 1.06,
      spanRatio: 0.37,
    },
  };
}

/**
 * Formats concise esports-style victory headline, winning team ribbon text,
 * and score pair (`4 - 1`) without contradicting `state.winner`.
 */
export function formatVictorySummary(state: RoomState): VictorySummary {
  const winnerSide: 'A' | 'B' | 'DRAW' =
    state.winner === 'A' ? 'A' : state.winner === 'B' ? 'B' : 'DRAW';

  const headline = winnerSide === 'DRAW' ? 'SERI!' : 'VICTORY';
  const winnerName = winnerSide === 'A' ? state.teamAName : state.teamBName;
  const subtitle =
    winnerSide === 'DRAW' ? 'PERTANDINGAN SERI' : `${winnerName.toUpperCase()} MENANG`;

  const correctA = state.teams.A.correctCount;
  const correctB = state.teams.B.correctCount;
  const scoreA = state.teams.A.score;
  const scoreB = state.teams.B.score;

  // Prefer round-win count (e.g. "4 - 1") when it agrees with winner, otherwise fall back to score
  const correctMatchesWinner =
    (winnerSide === 'DRAW' && correctA === correctB) ||
    (winnerSide === 'A' && correctA > correctB) ||
    (winnerSide === 'B' && correctB > correctA);

  const scoreMatchesWinner =
    (winnerSide === 'DRAW' && scoreA === scoreB) ||
    (winnerSide === 'A' && scoreA > scoreB) ||
    (winnerSide === 'B' && scoreB > scoreA);

  const useCorrect = correctMatchesWinner || !scoreMatchesWinner;

  return {
    headline,
    subtitle,
    winnerSide,
    leftValue: useCorrect ? correctA : scoreA,
    rightValue: useCorrect ? correctB : scoreB,
    leftTeamName: state.teamAName,
    rightTeamName: state.teamBName,
  };
}

export const QUICK_QUESTION_DURATION_SEC = 5;

export interface QuestionCountdownState {
  visible: boolean;
  seconds: number;
  progress: number;
  urgent: boolean;
}

/**
 * Pure helper for the top-center 5-second question countdown clock shown between
 * Tim Hijau and Tim Biru cards whenever a question is active.
 */
export function getQuestionCountdownState(
  phase: string | undefined,
  seconds: number,
  totalSeconds = QUICK_QUESTION_DURATION_SEC,
): QuestionCountdownState {
  const safeTotal = Math.max(1, totalSeconds);
  const clampedSec = Math.max(0, Math.min(safeTotal, Math.ceil(seconds)));
  const visible = phase === 'QUESTION_ACTIVE';
  return {
    visible,
    seconds: clampedSec,
    progress: Math.max(0, Math.min(1, clampedSec / safeTotal)),
    urgent: visible && clampedSec <= 2,
  };
}

/**
 * Natural relaxed floor-resting target (Y & Z) for each of the 17 rope spline
 * control points when the match ends (`phase === 'FINISHED'`).
 */
export function getRopeFloorRestTarget(index: number): { y: number; z: number } {
  // Subtle organic S-wave along the arena floor so dropped hemp rope looks slack, not rigid
  const floorZOffsets = [
    0.72, 0.64, 0.58, 0.63, 0.68, 0.64, 0.59, 0.68, 0.76, 0.68, 0.59, 0.64, 0.68, 0.63, 0.58, 0.64,
    0.72,
  ];
  const clampedIdx = Math.max(0, Math.min(floorZOffsets.length - 1, index));
  // Radius is 0.056m -> center at y=0.058 rests flush on top of floor y=0 without sinking
  return {
    y: 0.058,
    z: floorZOffsets[clampedIdx],
  };
}

