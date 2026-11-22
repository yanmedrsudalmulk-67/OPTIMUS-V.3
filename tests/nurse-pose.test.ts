import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type * as THREE from 'three';
import { CHARACTERS } from '../packages/shared/src/index';
import { getHeroProfile } from '../apps/web/components/arena/character/materials';
import {
  getHairStyleGeometries,
  getNurseScrubTopDetailsGeometries,
} from '../apps/web/components/arena/character/geometries';
import { evaluateCharacterPose } from '../apps/web/components/arena/character/ikAndMotion';

function assertValidGeometry(geo: THREE.BufferGeometry | null | undefined, label: string) {
  expect(geo, `${label} should exist`).toBeTruthy();
  const pos = geo!.getAttribute('position');
  expect(pos && pos.count > 12, `${label} should have vertices`).toBe(true);
  for (let i = 0; i < pos.count; i++) {
    expect(
      Number.isFinite(pos.getX(i)) &&
        Number.isFinite(pos.getY(i)) &&
        Number.isFinite(pos.getZ(i)),
      `${label} vertex ${i} must be finite`,
    ).toBe(true);
  }
}

describe('Hero character profiles, geometries, and poses', () => {
  it('nurse-m profile matches PERAWAT PRIA reference sheet and preserves other heroes', () => {
    const nurse = getHeroProfile('nurse-m');
    expect(nurse.hairStyle).toBe('nurse-swept-fluffy');
    expect(nurse.nurseScrubTop).toBe(true);
    expect(nurse.nurseIdCard).toBe(true);
    expect(nurse.shortsStyle).toBe(false);
    expect(nurse.hasWatch).toBe(true);
    expect(nurse.pouch).toBeUndefined();
    expect(nurse.lanyardColor).toBeTruthy();
    expect(nurse.sleeveStripeColor).toBeTruthy();
    expect(nurse.tunicTrim).toBeTruthy();

    // Guard zero regression on Dr. Arga and Midwife
    const doctor = getHeroProfile('doctor-m');
    expect(doctor.confidentSmile).toBe(true);
    expect(doctor.nurseScrubTop).toBeUndefined();
    expect(doctor.nurseIdCard).toBeUndefined();

    const midwife = getHeroProfile('midwife');
    expect(midwife.longSleeves).toBe(true);
    expect(midwife.nurseScrubTop).toBeUndefined();
    expect(midwife.pouch).toBeTruthy();
  });

  it('nurse-m swept hair and scrub top detail geometries build cleanly without NaNs', () => {
    const hair = getHairStyleGeometries('nurse-swept-fluffy');
    assertValidGeometry(hair.primaryHair, 'nurse-swept-fluffy primaryHair');
    expect(hair.headwear).toBeUndefined();

    const scrub = getNurseScrubTopDetailsGeometries();
    assertValidGeometry(scrub.collarWhite, 'collarWhite');
    assertValidGeometry(scrub.collarPiping, 'collarPiping');
    assertValidGeometry(scrub.vNeckInsert, 'vNeckInsert');
    assertValidGeometry(scrub.pocketBody, 'pocketBody');
    assertValidGeometry(scrub.pocketTrim, 'pocketTrim');
    assertValidGeometry(scrub.frontSlit, 'frontSlit');
    assertValidGeometry(scrub.centerPlacket, 'centerPlacket');
    assertValidGeometry(scrub.chestPocketTrim, 'chestPocketTrim');

    const nurseF = getHeroProfile('nurse-f');
    expect(nurseF.hairStyle).toBe('nurse-bob-cap');
    expect(nurseF.nurseScrubTop).toBe(true);
    expect(nurseF.nurseFrontPlacket).toBe(true);
    expect(nurseF.nurseChestPocket).toBe(true);
    expect(nurseF.nurseIdCard).toBe(true);
    expect(nurseF.confidentSmile).toBe(true);
    expect(nurseF.pouch).toBeUndefined();
    expect(nurseF.top).toBe('#f1f5f9');
    expect(nurseF.pants).toBe('#0a6e47');

    const nurseCapHair = getHairStyleGeometries('nurse-bob-cap');
    assertValidGeometry(nurseCapHair.primaryHair, 'nurse-bob-cap primaryHair');
    assertValidGeometry(nurseCapHair.headwear, 'nurse-bob-cap headwear');
    assertValidGeometry(nurseCapHair.headwearTrim, 'nurse-bob-cap headwearTrim');
  });

  it('standing idle pose uses a natural contrapposto stance while rope pose stays firmly braced', () => {
    const idle = evaluateCharacterPose(0.5, 'idle', 'A', false, 0);

    // Staggered feet in Z and asymmetric toe-out
    const footZSpread = Math.abs(idle.footRTarget[2] - idle.footLTarget[2]);
    expect(footZSpread, `expected staggered feet (got spread=${footZSpread})`).toBeGreaterThanOrEqual(
      0.06,
    );
    expect(Math.abs(idle.footLRot[1]).toFixed(3)).not.toBe(Math.abs(idle.footRRot[1]).toFixed(3));

    // Contrapposto hip/chest counter-twist
    expect(idle.pelvisRot[1] * idle.chestRot[1]).toBeLessThan(0);

    // Natural asymmetric relaxed arms (not mirror-locked T/A-pose)
    const handHeightDiff = Math.abs(idle.handLTarget[1] - idle.handRTarget[1]);
    const handZDiff = Math.abs(idle.handLTarget[2] - idle.handRTarget[2]);
    expect(handHeightDiff > 0.02 || handZDiff > 0.04).toBe(true);

    // Battle rope-holding stance stays braced forward with tight grip
    const rope = evaluateCharacterPose(0.5, 'ready', 'A', true, 0);
    expect(rope.handLTarget[2] > 0.35 && rope.handRTarget[2] > 0.5).toBe(true);
    expect(rope.fingerCurlL).toBe(1.35);
    expect(rope.fingerCurlR).toBe(1.35);
  });

  it('all 10 selectable heroes expose dynamic pose artwork PNGs on disk', () => {
    expect(CHARACTERS.length).toBe(10);
    const publicDir = path.resolve(process.cwd(), 'apps/web/public');
    for (const hero of CHARACTERS) {
      expect(hero.poseImagePath).toBe(`/heroes/poses/${hero.id}.png`);
      expect(hero.thumbnailPath).toBe(`/heroes/${hero.id}.webp`);
      const absPosePath = path.join(publicDir, hero.poseImagePath.replace(/^\//, ''));
      expect(fs.existsSync(absPosePath), `Missing pose artwork file: ${absPosePath}`).toBe(true);
      const stat = fs.statSync(absPosePath);
      expect(
        stat.size > 50_000,
        `Pose artwork looks empty/corrupt (${stat.size}B): ${absPosePath}`,
      ).toBe(true);
    }
  });

  it('doctor-f (Dr. Maya) profile & sculpted wavy hair match Start-Game design', () => {
    const maya = getHeroProfile('doctor-f');
    expect(maya.hairStyle).toBe('doctor-f-wavy');
    expect(maya.tailoredLabCoat).toBe(true);
    expect(maya.longSleeves).toBe(true);
    expect(maya.proStethoscope).toBe(true);
    expect(maya.blueCrossBadge).toBe(true);

    const hair = getHairStyleGeometries('doctor-f-wavy');
    assertValidGeometry(hair.primaryHair, 'doctor-f-wavy primaryHair');
    expect(hair.headwear).toBeUndefined();
  });

  it('all 10 heroes strike Start-Game signature gallery idle poses while keeping rope battle poses intact', () => {
    const maya = evaluateCharacterPose(0.5, 'idle', 'A', false, 0, 'doctor-f');
    const arga = evaluateCharacterPose(0.5, 'idle', 'A', false, 0, 'doctor-m');

    // Dr. Maya raises viewer-left fist (-X), Dr. Arga mirrors with viewer-right fist (+X)
    expect(maya.handLTarget[1]).toBeGreaterThan(1.45);
    expect(maya.handRTarget[1]).toBeLessThan(1.0);
    expect(maya.mouthMood).toBe('smile');
    expect(maya.browTiltL < 0 && maya.browTiltR > 0).toBe(true);

    expect(arga.handRTarget[1]).toBeGreaterThan(1.45);
    expect(arga.handLTarget[1]).toBeLessThan(1.0);

    // Every hero idle pose keeps finite, reachable arms within shoulder IK reach
    const shoulderL: [number, number, number] = [-0.295, 1.302, 0.015];
    const shoulderR: [number, number, number] = [0.295, 1.302, 0.015];
    const dist3 = (a: [number, number, number], b: [number, number, number]) =>
      Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

    for (const hero of CHARACTERS) {
      const p = evaluateCharacterPose(0.5, 'idle', 'A', false, 0, hero.id);
      expect(p.mouthMood).toBe('smile');
      const dL = dist3(shoulderL, p.handLTarget);
      const dR = dist3(shoulderR, p.handRTarget);
      expect(dL > 0.15 && dL < 0.62, `${hero.id} left arm reach out of bounds (${dL.toFixed(3)})`).toBe(
        true,
      );
      expect(dR > 0.15 && dR < 0.62, `${hero.id} right arm reach out of bounds (${dR.toFixed(3)})`).toBe(
        true,
      );

      // Rope mode must remain firmly braced on the rope regardless of characterId
      const rope = evaluateCharacterPose(0.5, 'idle', 'A', true, 0, hero.id);
      expect(rope.handLTarget[2] > 0.35 && rope.handRTarget[2] > 0.5).toBe(true);
    }
  });
});
