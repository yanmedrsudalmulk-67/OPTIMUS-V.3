import * as THREE from 'three';
import type { Team } from '../../../../../packages/shared/src';
import type { CharacterMotion } from '../Character';
import { ANKLE_HEIGHT } from './geometries';

const _vDir = new THREE.Vector3();
const _vPole = new THREE.Vector3();
const _vPerp = new THREE.Vector3();
const _vU1 = new THREE.Vector3();
const _vU2 = new THREE.Vector3();
const _vX = new THREE.Vector3();
const _vY1 = new THREE.Vector3();
const _vZ1 = new THREE.Vector3();
const _vY2 = new THREE.Vector3();
const _vZ2 = new THREE.Vector3();
const _m1 = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _qInv = new THREE.Quaternion();

/**
 * Analytical Two-Bone IK Solver with soft extension cushion and zero parasitic twist.
 * Assumes bones extend along local `-Y` (`(0, -L1, 0)` and `(0, -L2, 0)`).
 */
export function solveTwoBoneIK(
  shoulderLocal: THREE.Vector3,
  targetLocal: THREE.Vector3,
  poleLocal: THREE.Vector3,
  L1: number,
  L2: number,
  upperBone: THREE.Object3D,
  lowerBone: THREE.Object3D,
  isArm: boolean,
): void {
  _vDir.copy(targetLocal).sub(shoulderLocal);
  const rawDist = _vDir.length();
  const maxReach = (L1 + L2) * 0.997;
  const minReach = Math.abs(L1 - L2) + 0.035;

  // Soft-IK compression only in the final 1.5% of extension so standing legs stay upright & natural
  let d = Math.max(minReach, rawDist);
  const softStart = (L1 + L2) * 0.985;
  if (d > softStart) {
    const excess = d - softStart;
    const span = maxReach - softStart;
    d = softStart + span * (1 - Math.exp(-excess / Math.max(0.001, span)));
  }
  d = Math.min(maxReach, d);

  if (rawDist < 1e-5) {
    _vDir.set(0, -1, 0);
  } else {
    _vDir.divideScalar(rawDist);
  }

  // Orthogonalize pole direction against _vDir
  _vPole.copy(poleLocal).sub(shoulderLocal);
  const proj = _vPole.dot(_vDir);
  _vPerp.copy(_vPole).addScaledVector(_vDir, -proj);
  if (_vPerp.lengthSq() < 1e-6) {
    _vPerp.set(0, 0, isArm ? -1 : 1);
    _vPerp.addScaledVector(_vDir, -_vPerp.dot(_vDir));
  }
  _vPerp.normalize();

  // Law of cosines for interior shoulder/hip angle alpha
  const cosAlpha = THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
  const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

  // Upper bone unit vector from origin to mid-joint
  _vU1.copy(_vDir).multiplyScalar(cosAlpha).addScaledVector(_vPerp, sinAlpha).normalize();

  // Lower bone unit vector from mid-joint to clamped target
  _vU2
    .copy(_vDir)
    .multiplyScalar(d)
    .addScaledVector(_vU1, -L1)
    .normalize();

  // Hinge plane normal X
  if (isArm) {
    _vX.crossVectors(_vPerp, _vY1.copy(_vDir).negate()).normalize();
  } else {
    _vX.crossVectors(_vY1.copy(_vDir).negate(), _vPerp).normalize();
  }

  // Orthonormal basis for upperBone (bone extends along -Y, so +Y = -_vU1)
  _vY1.copy(_vU1).negate();
  _vZ1.crossVectors(_vX, _vY1).normalize();
  _m1.makeBasis(_vX, _vY1, _vZ1);
  _q1.setFromRotationMatrix(_m1);

  // Orthonormal basis for lowerBone in parent space
  _vY2.copy(_vU2).negate();
  _vZ2.crossVectors(_vX, _vY2).normalize();
  _m2.makeBasis(_vX, _vY2, _vZ2);
  _q2.setFromRotationMatrix(_m2);

  upperBone.quaternion.copy(_q1);
  _qInv.copy(_q1).invert();
  lowerBone.quaternion.copy(_qInv).multiply(_q2);
}

export type MouthMood = 'gentle' | 'smile' | 'effort' | 'cheer' | 'pout';

export interface EvaluatedPose {
  jumpY: number;
  squashY: number;
  squashXZ: number;

  pelvisPos: [number, number, number];
  pelvisRot: [number, number, number];

  chestRot: [number, number, number];
  chestBreath: number;

  headRot: [number, number, number];

  handLTarget: [number, number, number];
  handRTarget: [number, number, number];
  elbowLPole: [number, number, number];
  elbowRPole: [number, number, number];
  handLRot: [number, number, number];
  handRRot: [number, number, number];
  fingerCurlL: number;
  fingerCurlR: number;

  footLTarget: [number, number, number];
  footRTarget: [number, number, number];
  kneeLPole: [number, number, number];
  kneeRPole: [number, number, number];
  footLRot: [number, number, number];
  footRRot: [number, number, number];

  blink: number;
  eyeGazeX: number;
  eyeGazeY: number;
  browLiftL: number;
  browLiftR: number;
  browTiltL: number;
  browTiltR: number;
  mouthMood: MouthMood;
  sweatVisible: boolean;
  sweatProgress: number;

  hairBounceX: number;
  hairBounceZ: number;
  accessorySwingX: number;
  accessorySwingZ: number;
}

function easeInOutSine(u: number): number {
  return -(Math.cos(Math.PI * u) - 1) / 2;
}

/** Smooth plateau wave for natural human head glances with zero derivative singularities. */
function curiousLookWave(t: number, speed: number, phaseOffset: number): number {
  const s = Math.sin(t * speed + phaseOffset);
  const c = Math.sin(t * speed * 0.47 + phaseOffset * 1.7);
  const raw = s * 0.72 + c * 0.28;
  return raw * (1.3 - 0.3 * raw * raw);
}

/**
 * Evaluates a rich, fluid, 12-Principles-of-Animation target pose for any motion state.
 */
export function evaluateCharacterPose(
  t: number,
  motion: CharacterMotion,
  team: Team,
  holdRope: boolean,
  seed: number,
  characterId?: string,
): EvaluatedPose {
  const ankleY = ANKLE_HEIGHT; // 0.175

  // Organic asymmetric breathing (inhale fuller, soft relaxed exhale)
  const breathPhase = t * 2.05 + seed * 1.3;
  const breath = 0.5 * Math.sin(breathPhase - 0.24 * Math.cos(breathPhase));

  // Natural blinking with occasional double-blink
  const blinkCycle = (t + seed * 1.91 + 0.9) % 4.4;
  let blink = 1;
  if (blinkCycle < 0.14) {
    blink = 1 - Math.sin((blinkCycle / 0.14) * Math.PI) * 0.94;
  } else if (seed % 2 === 1 && blinkCycle > 0.23 && blinkCycle < 0.36) {
    const u = (blinkCycle - 0.23) / 0.13;
    blink = 1 - Math.sin(u * Math.PI) * 0.92;
  }

  // Saccadic eye gaze leading head curiosity by ~160ms
  const lookLead = t + 0.16;
  const gazeX = curiousLookWave(lookLead, 0.78, seed * 2.1) * 0.015;
  const gazeY = curiousLookWave(lookLead, 0.58, seed * 3.4 + 1.2) * 0.008;

  // Natural contrapposto weight shift + phase-delayed spine S-curve + relaxed breathing & arm poise
  const sway = Math.sin(t * 1.15 + seed * 1.7) * 0.72 + Math.sin(t * 0.55 + seed) * 0.28;
  const swayDelayed =
    Math.sin(t * 1.15 - 0.58 + seed * 1.7) * 0.72 + Math.sin(t * 0.55 - 0.32 + seed) * 0.28;
  const armPendulum = Math.sin(t * 1.15 - 1.05 + seed * 1.7);
  const poiseCycle = Math.sin(t * 0.62 + seed * 1.35) * 0.5 + 0.5;

  // Note on browTilt sign convention (Capsule/Tube aligned horizontally):
  // Positive browTiltL (+0.08) and negative browTiltR (-0.08) lift the INNER brow tips (/ \),
  // giving the sweet, curious, innocent expression; negative browTiltL (-0.22) and positive browTiltR (+0.22)
  // angle the brows inward (\ /) for the heroic determined Start-Game expression!
  const pose: EvaluatedPose = {
    jumpY: 0,
    squashY: 1,
    squashXZ: 1,

    // Natural relaxed contrapposto weight shift onto left leg (zero stiff military posture!)
    pelvisPos: [
      -0.032 + sway * 0.038,
      0.802 - Math.abs(sway) * 0.01 + breath * 0.008,
      0.01,
    ],
    pelvisRot: [0.025, -0.145 + sway * 0.055, 0.058 - sway * 0.044],

    chestRot: [
      0.022 + breath * 0.026,
      0.165 - swayDelayed * 0.062, // Natural 3/4 counter-turn against hips
      -0.058 + swayDelayed * 0.048, // Organic S-curve counter-balance
    ],
    chestBreath: breath,

    headRot: [
      curiousLookWave(t, 0.58, seed * 3.4 + 1.2) * 0.045 - breath * 0.016,
      -0.03 + curiousLookWave(t, 0.78, seed * 2.1) * 0.13,
      0.042 - swayDelayed * 0.035 + curiousLookWave(t, 0.7, seed + 0.6) * 0.05,
    ],

    // Relaxed asymmetric standing arms: right hand casually bent forward-inward with soft elbow poise,
    // left arm (smartwatch side) hanging slightly lower & looser with gentle breathing sway
    handLTarget: [
      -0.415 - Math.max(0, -sway) * 0.014 - breath * 0.008,
      0.832 + breath * 0.014 + armPendulum * 0.014 + poiseCycle * 0.02,
      0.138 + armPendulum * 0.038 + poiseCycle * 0.03,
    ],
    handRTarget: [
      0.468 + Math.max(0, sway) * 0.014 + breath * 0.008,
      0.742 + breath * 0.012 - armPendulum * 0.014,
      0.026 - armPendulum * 0.032,
    ],
    elbowLPole: [-0.84, 1.04, -0.34],
    elbowRPole: [0.8, 1.01, -0.44],
    handLRot: [-0.2, 0.24, 0.16],
    handRRot: [0.08, -0.16, -0.1],
    fingerCurlL: 0.48 + Math.sin(t * 1.4 + seed) * 0.05,
    fingerCurlR: 0.28 + Math.sin(t * 1.4 + 1.1 + seed) * 0.04,

    // Natural staggered planted stance (left foot rooted slightly back, right foot stepped casually forward & out)
    footLTarget: [-0.2, ankleY, -0.044],
    footRTarget: [0.208, ankleY, 0.072],
    kneeLPole: [-0.23, 0.48, 0.58],
    kneeRPole: [0.25, 0.48, 0.76],
    footLRot: [0, -0.17, 0],
    footRRot: [0, 0.28, 0],

    blink,
    eyeGazeX: gazeX,
    eyeGazeY: gazeY,
    browLiftL: 0.006 + Math.max(0, curiousLookWave(t, 0.68, seed)) * 0.012,
    browLiftR: 0.006 + Math.max(0, curiousLookWave(t, 0.68, seed + 0.5)) * 0.012,
    browTiltL: 0.18,
    browTiltR: -0.18,
    mouthMood: 'gentle',
    sweatVisible: false,
    sweatProgress: 0,

    hairBounceX: -breath * 0.018,
    hairBounceZ: -swayDelayed * 0.026,
    accessorySwingX: breath * 0.024,
    accessorySwingZ: swayDelayed * 0.032,
  };

  // Diagonal two-hand rope alignment when holding the arena rope (rope at world Y=1.05, Z=0.50;
  // character at Z=0.05 rotated facing = +1.05 for Team A or -1.05 for Team B).
  const setRopeHands = (yOffset = 0, pullBackZ = 0) => {
    if (team === 'A') {
      pose.handLTarget = [-0.21, 1.05 + yOffset, 0.43 + pullBackZ];
      pose.handRTarget = [0.05, 1.05 + yOffset, 0.58 + pullBackZ];
    } else {
      pose.handLTarget = [-0.05, 1.05 + yOffset, 0.58 + pullBackZ];
      pose.handRTarget = [0.21, 1.05 + yOffset, 0.43 + pullBackZ];
    }
    pose.elbowLPole = [-0.66, 0.96 + yOffset, 0.08];
    pose.elbowRPole = [0.66, 0.96 + yOffset, 0.08];
    pose.handLRot = [-0.55, 0.35, 0.45];
    pose.handRRot = [-0.55, -0.35, -0.45];
    pose.fingerCurlL = 1.35;
    pose.fingerCurlR = 1.35;
  };

  // 1. IDLE (Standing Heroic Signature Pose in Gallery/Preview OR Waiting on Rope in Arena)
  if (motion === 'idle') {
    if (holdRope) {
      // Gameplay arena: two teams facing each other holding rope
      // Grounded, firm stance: feet planted, pelvis stable, chest leaning forward into rope
      pose.pelvisPos = [0, 0.795, 0.14];
      pose.pelvisRot = [0, 0, 0];
      pose.chestRot = [-0.03, team === 'A' ? 0.12 : -0.12, 0];
      // Head stays completely steady & still ("diam saja") facing opponent/rope center!
      pose.headRot = [0, 0, 0];
      // Hair and accessories calm and steady
      pose.hairBounceX = 0;
      pose.hairBounceZ = 0;
      pose.accessorySwingX = 0;
      pose.accessorySwingZ = 0;

      pose.footLTarget = [-0.2, ankleY, 0.24];
      pose.footRTarget = [0.2, ankleY, -0.02];
      setRopeHands(0, 0);
      return pose;
    }

    // Hero-specific Start-Game signature gallery idle poses!
    if (characterId) {
      const heroBob = Math.sin(t * 1.45 + seed * 1.2) * 0.014;
      const microSway = Math.sin(t * 0.95 + seed) * 0.018;

      switch (characterId) {
        case 'doctor-m': {
          // Dr. Arga: Bold hero fist raised on viewer's RIGHT (+X), fist planted on hip on viewer's LEFT (-X)
          pose.pelvisPos = [-0.02 + microSway, 0.805 + breath * 0.008, 0.01];
          pose.pelvisRot = [0.02, -0.1, 0.03];
          pose.chestRot = [-0.03 + breath * 0.02, 0.14 - microSway * 0.6, -0.03];
          pose.headRot = [-0.03 - breath * 0.012, -0.05 + microSway * 1.1, 0.025];
          pose.handLTarget = [-0.43, 0.93 + breath * 0.01, 0.09];
          pose.elbowLPole = [-0.9, 1.08, -0.18];
          pose.handLRot = [0.08, 0.28, 0.36];
          pose.fingerCurlL = 1.12;
          pose.handRTarget = [0.57, 1.54 + heroBob + breath * 0.014, 0.15];
          pose.elbowRPole = [0.9, 1.04, -0.05];
          pose.handRRot = [-0.25, -0.22, -0.24];
          pose.fingerCurlR = 1.38;
          pose.browLiftL = -0.022;
          pose.browLiftR = -0.022;
          pose.browTiltL = -0.26;
          pose.browTiltR = 0.26;
          pose.mouthMood = 'smile';
          break;
        }
        case 'doctor-f': {
          // Dr. Maya: Mirror heroic pose matching Start Game artwork!
          // Confident raised fist on viewer's LEFT (-X), poised hand on hip on viewer's RIGHT (+X)
          pose.pelvisPos = [0.022 - microSway, 0.806 + breath * 0.008, 0.01];
          pose.pelvisRot = [0.02, 0.12, -0.035];
          pose.chestRot = [-0.035 + breath * 0.02, -0.15 + microSway * 0.6, 0.035];
          pose.headRot = [-0.035 - breath * 0.012, 0.07 - microSway * 1.1, -0.03];
          pose.handLTarget = [-0.57, 1.55 + heroBob + breath * 0.014, 0.15];
          pose.elbowLPole = [-0.9, 1.05, -0.05];
          pose.handLRot = [-0.24, 0.22, 0.24];
          pose.fingerCurlL = 1.38;
          pose.handRTarget = [0.43, 0.93 + breath * 0.01, 0.09];
          pose.elbowRPole = [0.9, 1.08, -0.18];
          pose.handRRot = [0.08, -0.28, -0.36];
          pose.fingerCurlR = 0.96;
          pose.footLTarget = [-0.205, ankleY, 0.068];
          pose.footRTarget = [0.2, ankleY, -0.044];
          pose.footLRot = [0, -0.24, 0];
          pose.footRRot = [0, 0.16, 0];
          pose.browLiftL = -0.018;
          pose.browLiftR = -0.018;
          pose.browTiltL = -0.24;
          pose.browTiltR = 0.24;
          pose.mouthMood = 'smile';
          break;
        }
        case 'nurse-m': {
          // Ners Bima: Cheerful thumbs-up raised on viewer's LEFT (-X), cradling clipboard on viewer's RIGHT (+X)
          pose.pelvisPos = [-0.018 + microSway, 0.804 + breath * 0.008, 0.01];
          pose.pelvisRot = [0.02, -0.1, 0.03];
          pose.chestRot = [-0.015 + breath * 0.02, 0.12 - microSway * 0.5, -0.03];
          pose.headRot = [-0.02 - breath * 0.012, -0.04 + microSway * 1.0, 0.03];
          pose.handLTarget = [-0.52, 1.4 + heroBob + breath * 0.012, 0.22];
          pose.elbowLPole = [-0.84, 1.02, -0.1];
          pose.handLRot = [-0.28, 0.35, 1.28];
          pose.fingerCurlL = 1.35;
          pose.handRTarget = [0.35, 0.96 + breath * 0.01, 0.24];
          pose.elbowRPole = [0.82, 1.04, -0.22];
          pose.handRRot = [-0.35, -0.35, -0.15];
          pose.fingerCurlR = 0.72;
          pose.browLiftL = 0.014;
          pose.browLiftR = 0.014;
          pose.browTiltL = -0.12;
          pose.browTiltR = 0.12;
          pose.mouthMood = 'smile';
          break;
        }
        case 'nurse-f': {
          // Ners Alya: Holding dark medical clipboard cleanly on front-right (+X) while keeping center emerald lanyard ID card & placket visible!
          pose.pelvisPos = [-0.02 + microSway, 0.804 + breath * 0.008, 0.01];
          pose.pelvisRot = [0.02, -0.14, 0.035];
          pose.chestRot = [-0.015 + breath * 0.02, 0.17 - microSway * 0.5, -0.03];
          pose.headRot = [-0.03 - breath * 0.012, -0.06 + microSway * 1.0, 0.04];
          pose.handLTarget = [-0.41, 0.91 + breath * 0.01, 0.14];
          pose.elbowLPole = [-0.82, 1.03, -0.2];
          pose.handLRot = [-0.14, 0.24, 0.18];
          pose.fingerCurlL = 0.42;
          pose.handRTarget = [0.37, 1.04 + heroBob * 0.7 + breath * 0.01, 0.28];
          pose.elbowRPole = [0.84, 1.0, -0.12];
          pose.handRRot = [-0.45, -0.28, -0.12];
          pose.fingerCurlR = 0.85;
          pose.browLiftL = -0.022;
          pose.browLiftR = -0.022;
          pose.browTiltL = -0.28;
          pose.browTiltR = 0.28;
          pose.mouthMood = 'smile';
          break;
        }
        case 'midwife': {
          // Bidan Sari: Warm reassuring hand placed over heart/chest (+X), poised left hand at hip (-X)
          pose.pelvisPos = [0.015 - microSway, 0.805 + breath * 0.008, 0.01];
          pose.pelvisRot = [0.02, 0.11, -0.03];
          pose.chestRot = [-0.01 + breath * 0.02, -0.12 + microSway * 0.5, 0.03];
          pose.headRot = [-0.02 - breath * 0.012, 0.05 - microSway * 0.9, -0.035];
          pose.handLTarget = [-0.43, 0.89 + breath * 0.01, 0.12];
          pose.elbowLPole = [-0.82, 1.05, -0.3];
          pose.handLRot = [-0.12, 0.2, 0.14];
          pose.fingerCurlL = 0.34;
          pose.handRTarget = [0.16, 1.13 + heroBob * 0.5 + breath * 0.012, 0.35];
          pose.elbowRPole = [0.78, 1.02, -0.06];
          pose.handRRot = [-0.5, -0.58, -0.28];
          pose.fingerCurlR = 0.22;
          pose.browLiftL = 0.008;
          pose.browLiftR = 0.008;
          pose.browTiltL = -0.12;
          pose.browTiltR = 0.12;
          pose.mouthMood = 'smile';
          break;
        }
        case 'pharmacist': {
          // Apt. Dimas: Holding up amber medicine pill bottle on viewer's LEFT (-X), poised hand on RIGHT (+X)
          pose.pelvisPos = [0.018 - microSway, 0.805 + breath * 0.008, 0.01];
          pose.pelvisRot = [0.02, 0.1, -0.028];
          pose.chestRot = [-0.015 + breath * 0.02, -0.1 + microSway * 0.5, 0.025];
          pose.headRot = [-0.02 - breath * 0.01, 0.04 - microSway * 0.9, 0.025];
          pose.handLTarget = [-0.47, 1.18 + heroBob * 0.8 + breath * 0.012, 0.3];
          pose.elbowLPole = [-0.84, 0.94, -0.08];
          pose.handLRot = [-0.26, 0.18, 0.1];
          pose.fingerCurlL = 1.18;
          pose.handRTarget = [0.44, 0.84 + breath * 0.01, 0.08];
          pose.elbowRPole = [0.78, 1.02, -0.34];
          pose.handRRot = [0.06, -0.18, -0.1];
          pose.fingerCurlR = 0.36;
          pose.browLiftL = 0.012;
          pose.browLiftR = 0.012;
          pose.browTiltL = 0.06;
          pose.browTiltR = -0.06;
          pose.mouthMood = 'smile';
          break;
        }
        case 'analyst': {
          // Analis Raka: Holding up glowing cyan test tube on viewer's RIGHT (+X), confident hip poise on LEFT (-X)
          pose.pelvisPos = [-0.018 + microSway, 0.805 + breath * 0.008, 0.01];
          pose.pelvisRot = [0.02, -0.11, 0.03];
          pose.chestRot = [-0.02 + breath * 0.02, 0.12 - microSway * 0.5, -0.028];
          pose.headRot = [-0.025 - breath * 0.012, 0.05 + microSway * 0.9, -0.02];
          pose.handLTarget = [-0.43, 0.92 + breath * 0.01, 0.1];
          pose.elbowLPole = [-0.86, 1.06, -0.22];
          pose.handLRot = [0.06, 0.26, 0.3];
          pose.fingerCurlL = 0.65;
          pose.handRTarget = [0.49, 1.24 + heroBob * 0.8 + breath * 0.012, 0.28];
          pose.elbowRPole = [0.86, 0.98, -0.08];
          pose.handRRot = [-0.24, -0.2, -0.1];
          pose.fingerCurlR = 1.15;
          pose.browLiftL = 0.01;
          pose.browLiftR = 0.01;
          pose.browTiltL = -0.1;
          pose.browTiltR = 0.1;
          pose.mouthMood = 'smile';
          break;
        }
        case 'ambulance': {
          // Medik Juno: Holding red-and-white First-Aid kit on LEFT (-X) & pointing heroically forward-up on RIGHT (+X)
          pose.pelvisPos = [-0.02 + microSway, 0.804 + breath * 0.008, 0.015];
          pose.pelvisRot = [0.025, -0.13, 0.03];
          pose.chestRot = [-0.03 + breath * 0.02, 0.14 - microSway * 0.5, -0.03];
          pose.headRot = [-0.03 - breath * 0.012, -0.05 + microSway * 0.9, 0.02];
          pose.handLTarget = [-0.46, 0.82 + breath * 0.01, 0.1];
          pose.elbowLPole = [-0.76, 1.02, -0.28];
          pose.handLRot = [0.08, 0.15, 0.05];
          pose.fingerCurlL = 1.28;
          pose.handRTarget = [0.48, 1.34 + heroBob * 0.9 + breath * 0.012, 0.34];
          pose.elbowRPole = [0.84, 1.04, -0.1];
          pose.handRRot = [-0.72, -0.18, -0.12];
          pose.fingerCurlR = 0.55;
          pose.browLiftL = -0.018;
          pose.browLiftR = -0.018;
          pose.browTiltL = -0.22;
          pose.browTiltR = 0.22;
          pose.mouthMood = 'smile';
          break;
        }
        case 'surgeon': {
          // Dr. Farah: Pulling on / adjusting sterile surgical glove cuff cleanly at chest height
          pose.pelvisPos = [0.015 - microSway, 0.805 + breath * 0.008, 0.01];
          pose.pelvisRot = [0.02, 0.09, -0.025];
          pose.chestRot = [-0.015 + breath * 0.02, -0.1 + microSway * 0.4, 0.025];
          pose.headRot = [0.02 - breath * 0.01, 0.06 - microSway * 0.8, -0.02];
          pose.handRTarget = [0.22, 1.32 + heroBob * 0.6 + breath * 0.01, 0.31];
          pose.elbowRPole = [0.76, 1.04, -0.04];
          pose.handRRot = [-0.18, -0.35, -0.12];
          pose.fingerCurlR = 0.16;
          pose.handLTarget = [0.02, 1.12 + heroBob * 0.5 + breath * 0.01, 0.34];
          pose.elbowLPole = [-0.62, 1.0, 0.06];
          pose.handLRot = [-0.36, 0.5, 0.25];
          pose.fingerCurlL = 0.82;
          pose.browLiftL = 0.008;
          pose.browLiftR = 0.008;
          pose.browTiltL = -0.12;
          pose.browTiltR = 0.12;
          pose.mouthMood = 'smile';
          break;
        }
        case 'radiographer': {
          // Rad. Danu: Holding up glowing blue chest X-ray film on viewer's RIGHT (+X), confident hip poise on LEFT (-X)
          pose.pelvisPos = [-0.018 + microSway, 0.805 + breath * 0.008, 0.01];
          pose.pelvisRot = [0.02, -0.11, 0.03];
          pose.chestRot = [-0.02 + breath * 0.02, 0.12 - microSway * 0.5, -0.028];
          pose.headRot = [-0.025 - breath * 0.012, 0.04 + microSway * 0.9, -0.02];
          pose.handLTarget = [-0.43, 0.92 + breath * 0.01, 0.09];
          pose.elbowLPole = [-0.86, 1.06, -0.2];
          pose.handLRot = [0.06, 0.26, 0.32];
          pose.fingerCurlL = 0.72;
          pose.handRTarget = [0.51, 1.24 + heroBob * 0.8 + breath * 0.012, 0.26];
          pose.elbowRPole = [0.86, 0.98, -0.08];
          pose.handRRot = [-0.22, -0.16, -0.08];
          pose.fingerCurlR = 1.05;
          pose.browLiftL = -0.012;
          pose.browLiftR = -0.012;
          pose.browTiltL = -0.18;
          pose.browTiltR = 0.18;
          pose.mouthMood = 'smile';
          break;
        }
        default:
          break;
      }
    }
    return pose;
  }

  // 2. READY (Selected Hero in Picker OR Pre-Battle Coiled Stance on Rope)
  if (motion === 'ready') {
    if (holdRope) {
      const coil = Math.sin(t * 3.5 + seed) * 0.5 + 0.5;
      pose.pelvisPos = [0, 0.76 - coil * 0.015, 0.15];
      pose.pelvisRot = [-0.04, team === 'A' ? -0.06 : 0.06, 0];
      pose.chestRot = [-0.1 - coil * 0.02, team === 'A' ? 0.14 : -0.14, 0];
      // Steady focused head counter-balancing chest lean so head doesn't pitch or wobble
      pose.headRot = [0.08, team === 'A' ? -0.08 : 0.08, 0];
      pose.hairBounceX = 0;
      pose.hairBounceZ = 0;
      pose.accessorySwingX = 0;
      pose.accessorySwingZ = 0;
      pose.footLTarget = [-0.21, ankleY, 0.28];
      pose.footRTarget = [0.21, ankleY, -0.06];
      pose.browTiltL = -0.12;
      pose.browTiltR = 0.12;
      pose.mouthMood = 'smile';
      setRopeHands(-coil * 0.01, 0);
      return pose;
    }

    // Lively friendly bounce in Team Picker
    const groove = Math.sin(t * 2.3 + seed);
    const bounce = Math.abs(Math.sin(t * 2.3 + seed));
    pose.pelvisPos = [groove * 0.03, 0.815 - (1 - bounce) * 0.016, 0.01];
    pose.pelvisRot = [0.01, groove * 0.048, -groove * 0.042];
    pose.chestRot = [-0.02 + breath * 0.022, -groove * 0.052, groove * 0.048];
    pose.headRot = [
      -0.015 + Math.sin(t * 1.15) * 0.03,
      curiousLookWave(t, 0.85, seed) * 0.11,
      -groove * 0.04 + 0.025,
    ];
    const armBeat = Math.sin(t * 2.3 - 0.65 + seed);
    pose.handLTarget = [-0.468, 0.775 + armBeat * 0.018, 0.045 - armBeat * 0.028];
    pose.handRTarget = [0.468, 0.775 - armBeat * 0.018, 0.045 + armBeat * 0.028];
    pose.elbowLPole = [-0.74, 1.06, -0.44];
    pose.elbowRPole = [0.74, 1.06, -0.44];
    pose.fingerCurlL = 0.22;
    pose.fingerCurlR = 0.22;
    pose.browLiftL = 0.016;
    pose.browLiftR = 0.016;
    pose.browTiltL = 0.06;
    pose.browTiltR = -0.06;
    pose.mouthMood = 'smile';
    pose.hairBounceX = -bounce * 0.03;
    pose.hairBounceZ = -groove * 0.03;
    pose.accessorySwingZ = groove * 0.04;
    return pose;
  }

  // 3. PULLING (Powerful Coordinated "HEAVE — HOLD — RECOVER" Tug-of-War Stroke!)
  if (motion === 'pulling') {
    const cycle = (t * 0.92 + (seed % 3) * 0.09) % 1;
    let heave = 0;
    if (cycle < 0.44) {
      heave = easeInOutSine(cycle / 0.44);
    } else if (cycle < 0.7) {
      heave = 1.0;
    } else {
      heave = 1.0 - easeInOutSine((cycle - 0.7) / 0.3);
    }

    pose.squashY = 1 + heave * 0.02;
    pose.squashXZ = 1 / Math.sqrt(pose.squashY);

    pose.pelvisPos = [
      0,
      0.74 - (1 - heave) * 0.035,
      0.16 - heave * 0.12,
    ];
    pose.pelvisRot = [-0.13 - heave * 0.09, (team === 'A' ? -0.1 : 0.1) * (0.8 + heave * 0.3), 0];
    pose.chestRot = [
      -0.17 - heave * 0.18,
      team === 'A' ? 0.16 : -0.16,
      0,
    ];
    // Smooth, steady head orientation following the heave lean back (NO high-frequency strain tremor!)
    pose.headRot = [
      -0.08 - heave * 0.1,
      team === 'A' ? -0.12 : 0.12,
      0,
    ];

    pose.footLTarget = [-0.22, ankleY, 0.32];
    pose.footRTarget = [0.22, ankleY, -0.06];
    pose.footLRot = [-0.07 * heave, -0.14, 0];
    pose.footRRot = [0.04 * heave, 0.16, 0];
    pose.kneeLPole = [-0.26, 0.48, 0.82];
    pose.kneeRPole = [0.26, 0.44, 0.62];

    setRopeHands(-0.015 * heave, -0.02 * heave);
    // Determined focused brows (\ /)
    pose.browTiltL = -0.18;
    pose.browTiltR = 0.18;
    pose.browLiftL = -0.01;
    pose.browLiftR = -0.01;
    pose.mouthMood = heave > 0.35 ? 'effort' : 'smile';
    pose.hairBounceX = heave * 0.03;
    pose.accessorySwingX = -heave * 0.03;
    return pose;
  }

  // 4. STRUGGLING / SLIDING (Resisting Opponent's Pull with Scrambling Braced Feet!)
  if (motion === 'struggling' || motion === 'sliding') {
    const sliding = motion === 'sliding';
    const scramble = t * (sliding ? 9.5 : 7.0) + seed * 2.1;
    const stepL = Math.max(0, Math.sin(scramble)) * (sliding ? 0.06 : 0.032);
    const stepR = Math.max(0, Math.sin(scramble + Math.PI)) * (sliding ? 0.06 : 0.032);

    pose.pelvisPos = [
      0,
      0.73 + (stepL + stepR) * 0.25,
      sliding ? 0.23 : 0.18,
    ];
    pose.pelvisRot = [0.07, 0, 0];
    pose.chestRot = [
      (sliding ? 0.18 : 0.12) + Math.sin(scramble) * 0.02,
      team === 'A' ? 0.14 : -0.14,
      0,
    ];
    // Steady braced head orientation (NO random sine wave wobble or tremor!)
    pose.headRot = [
      -0.08,
      team === 'A' ? -0.1 : 0.1,
      0,
    ];

    pose.footLTarget = [-0.21, ankleY + stepL, 0.28 + Math.cos(scramble) * 0.045];
    pose.footRTarget = [0.21, ankleY + stepR, -0.02 + Math.cos(scramble + Math.PI) * 0.045];
    setRopeHands(0.01, 0.02);

    // Worried/strained eyebrows (/ \) & sweat drop
    pose.browTiltL = 0.22;
    pose.browTiltR = -0.22;
    pose.browLiftL = 0.014;
    pose.browLiftR = 0.014;
    pose.mouthMood = 'effort';
    pose.sweatVisible = true;
    pose.sweatProgress = (t * 1.35 + seed * 0.3) % 1;
    pose.hairBounceX = 0;
    pose.hairBounceZ = 0;
    return pose;
  }

  // 5. VICTORY (Joyous Bouncy Squash-and-Stretch Hop + Dual Cheering Arm Wave!)
  if (motion === 'victory') {
    const hopCycle = (t * 1.6 + seed * 0.23) % 1;
    let jumpY = 0;
    let squash = 1;

    if (hopCycle < 0.18) {
      const u = Math.sin((hopCycle / 0.18) * Math.PI);
      squash = 1 - 0.07 * u;
    } else if (hopCycle < 0.72) {
      const u = (hopCycle - 0.18) / 0.54;
      const parabola = 4 * u * (1 - u);
      jumpY = parabola * 0.24;
      squash = 1 + 0.06 * (1 - Math.abs(u - 0.5) * 1.4);
    } else {
      const u = Math.sin(((hopCycle - 0.72) / 0.28) * Math.PI);
      squash = 1 - 0.055 * u;
    }

    const cheerWave = Math.sin(t * 6.4 + seed);
    const groove = Math.sin(t * 3.2 + seed);

    pose.jumpY = jumpY;
    pose.squashY = squash;
    pose.squashXZ = 1 / Math.sqrt(squash);

    pose.pelvisPos = [groove * 0.036, 0.815 - (1 - Math.min(1, squash)) * 0.42, 0];
    pose.pelvisRot = [-0.03, groove * 0.09, -groove * 0.055];
    pose.chestRot = [-0.07, -groove * 0.1, groove * 0.075];
    pose.headRot = [-0.09 + Math.abs(cheerWave) * 0.045, groove * 0.11, -groove * 0.065];

    pose.handLTarget = [-0.48 + cheerWave * 0.065, 1.92 + Math.sin(t * 6.4) * 0.075, 0.14];
    pose.handRTarget = [0.48 + cheerWave * 0.065, 1.92 + Math.cos(t * 6.4) * 0.075, 0.14];
    pose.elbowLPole = [-0.78, 1.42, -0.14];
    pose.elbowRPole = [0.78, 1.42, -0.14];
    pose.handLRot = [-0.2, 0.2, 0.35 + cheerWave * 0.18];
    pose.handRRot = [-0.2, -0.2, -0.35 + cheerWave * 0.18];
    pose.fingerCurlL = 0.12;
    pose.fingerCurlR = 0.12;

    const airFactor = jumpY / 0.24;
    pose.footLTarget = [-0.2, ankleY + airFactor * 0.05, 0.02 - airFactor * 0.05];
    pose.footRTarget = [0.2, ankleY + airFactor * 0.07, -0.02 - airFactor * 0.09];
    pose.footLRot = [airFactor * 0.24, -0.13, 0];
    pose.footRRot = [airFactor * 0.3, 0.13, 0];

    pose.browLiftL = 0.028;
    pose.browLiftR = 0.028;
    pose.browTiltL = 0.1;
    pose.browTiltR = -0.1;
    pose.mouthMood = 'cheer';
    pose.hairBounceX = -jumpY * 0.2;
    pose.hairBounceZ = -groove * 0.045;
    pose.accessorySwingX = -jumpY * 0.22;
    return pose;
  }

  // 6. FALLING / DEFEAT (Cute Pixar Seated Ground Slump)
  const sigh = Math.sin(t * 1.6 + seed);
  const headShake = Math.sin(t * 2.2 + seed) * 0.075;

  pose.pelvisPos = [0, 0.22, -0.06];
  pose.pelvisRot = [-0.18, 0, 0];
  pose.chestRot = [0.22 + sigh * 0.035, headShake * 0.3, 0];
  pose.headRot = [0.16 + sigh * 0.03, headShake, Math.sin(t * 1.1 + seed) * 0.045];

  pose.footLTarget = [-0.23, 0.15, 0.46];
  pose.footRTarget = [0.23, 0.15, 0.44];
  pose.kneeLPole = [-0.27, 0.44, 0.22];
  pose.kneeRPole = [0.27, 0.44, 0.22];
  pose.footLRot = [-1.05, -0.18, -0.1];
  pose.footRRot = [-1.05, 0.18, 0.1];

  pose.handLTarget = [-0.38, 0.29 + sigh * 0.01, 0.18];
  pose.handRTarget = [0.38, 0.29 + sigh * 0.01, 0.18];
  pose.elbowLPole = [-0.64, 0.56, -0.25];
  pose.elbowRPole = [0.64, 0.56, -0.25];
  pose.fingerCurlL = 0.38;
  pose.fingerCurlR = 0.38;

  pose.browTiltL = 0.22;
  pose.browTiltR = -0.22;
  pose.browLiftL = -0.008;
  pose.browLiftR = -0.008;
  pose.mouthMood = 'pout';
  pose.hairBounceX = 0.03;
  return pose;
}
