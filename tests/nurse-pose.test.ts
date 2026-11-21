import test from 'node:test';
import assert from 'node:assert/strict';
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
  assert.ok(geo, `${label} should exist`);
  const pos = geo.getAttribute('position');
  assert.ok(pos && pos.count > 12, `${label} should have vertices`);
  for (let i = 0; i < pos.count; i++) {
    assert.ok(
      Number.isFinite(pos.getX(i)) &&
        Number.isFinite(pos.getY(i)) &&
        Number.isFinite(pos.getZ(i)),
      `${label} vertex ${i} must be finite`,
    );
  }
}

test('nurse-m profile matches PERAWAT PRIA reference sheet and preserves other heroes', () => {
  const nurse = getHeroProfile('nurse-m');
  assert.equal(nurse.hairStyle, 'nurse-swept-fluffy');
  assert.equal(nurse.nurseScrubTop, true);
  assert.equal(nurse.nurseIdCard, true);
  assert.equal(nurse.shortsStyle, false);
  assert.equal(nurse.hasWatch, true);
  assert.equal(nurse.pouch, undefined);
  assert.ok(nurse.lanyardColor);
  assert.ok(nurse.sleeveStripeColor);
  assert.ok(nurse.tunicTrim);

  // Guard zero regression on Dr. Arga and Midwife
  const doctor = getHeroProfile('doctor-m');
  assert.equal(doctor.confidentSmile, true);
  assert.equal(doctor.nurseScrubTop, undefined);
  assert.equal(doctor.nurseIdCard, undefined);

  const midwife = getHeroProfile('midwife');
  assert.equal(midwife.longSleeves, true);
  assert.equal(midwife.nurseScrubTop, undefined);
  assert.ok(midwife.pouch);
});

test('nurse-m swept hair and scrub top detail geometries build cleanly without NaNs', () => {
  const hair = getHairStyleGeometries('nurse-swept-fluffy');
  assertValidGeometry(hair.primaryHair, 'nurse-swept-fluffy primaryHair');
  assert.equal(hair.headwear, undefined);

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
  assert.equal(nurseF.hairStyle, 'nurse-bob-cap');
  assert.equal(nurseF.nurseScrubTop, true);
  assert.equal(nurseF.nurseFrontPlacket, true);
  assert.equal(nurseF.nurseChestPocket, true);
  assert.equal(nurseF.nurseIdCard, true);
  assert.equal(nurseF.confidentSmile, true);
  assert.equal(nurseF.pouch, undefined);
  assert.equal(nurseF.top, '#f2f6fa');
  assert.equal(nurseF.pants, '#0c8254');

  const nurseCapHair = getHairStyleGeometries('nurse-bob-cap');
  assertValidGeometry(nurseCapHair.primaryHair, 'nurse-bob-cap primaryHair');
  assertValidGeometry(nurseCapHair.headwear, 'nurse-bob-cap headwear');
  assertValidGeometry(nurseCapHair.headwearTrim, 'nurse-bob-cap headwearTrim');
});

test('standing idle pose uses a natural contrapposto stance while rope pose stays firmly braced', () => {
  const idle = evaluateCharacterPose(0.5, 'idle', 'A', false, 0);

  // Staggered feet in Z and asymmetric toe-out
  const footZSpread = Math.abs(idle.footRTarget[2] - idle.footLTarget[2]);
  assert.ok(footZSpread >= 0.06, `expected staggered feet (got spread=${footZSpread})`);
  assert.notEqual(
    Math.abs(idle.footLRot[1]).toFixed(3),
    Math.abs(idle.footRRot[1]).toFixed(3),
    'feet should have natural asymmetric stance rotation',
  );

  // Contrapposto hip/chest counter-twist
  assert.ok(
    idle.pelvisRot[1] * idle.chestRot[1] < 0,
    'pelvis and chest should counter-twist subtly in contrapposto',
  );

  // Natural asymmetric relaxed arms (not mirror-locked T/A-pose)
  const handHeightDiff = Math.abs(idle.handLTarget[1] - idle.handRTarget[1]);
  const handZDiff = Math.abs(idle.handLTarget[2] - idle.handRTarget[2]);
  assert.ok(
    handHeightDiff > 0.02 || handZDiff > 0.04,
    'idle hands should adopt an organic asymmetric pose',
  );

  // Battle rope-holding stance stays braced forward with tight grip
  const rope = evaluateCharacterPose(0.5, 'ready', 'A', true, 0);
  assert.ok(rope.handLTarget[2] > 0.35 && rope.handRTarget[2] > 0.5);
  assert.equal(rope.fingerCurlL, 1.35);
  assert.equal(rope.fingerCurlR, 1.35);
});

test('all 10 selectable heroes expose dynamic pose artwork PNGs on disk', () => {
  assert.equal(CHARACTERS.length, 10);
  const publicDir = path.resolve(process.cwd(), 'apps/web/public');
  for (const hero of CHARACTERS) {
    assert.equal(hero.poseImagePath, `/heroes/poses/${hero.id}.png`);
    assert.equal(hero.thumbnailPath, `/heroes/${hero.id}.webp`);
    const absPosePath = path.join(publicDir, hero.poseImagePath.replace(/^\//, ''));
    assert.ok(fs.existsSync(absPosePath), `Missing pose artwork file: ${absPosePath}`);
    const stat = fs.statSync(absPosePath);
    assert.ok(stat.size > 50_000, `Pose artwork looks empty/corrupt (${stat.size}B): ${absPosePath}`);
  }
});

test('doctor-f (Dr. Maya) profile & sculpted wavy hair match Start-Game design', () => {
  const maya = getHeroProfile('doctor-f');
  assert.equal(maya.hairStyle, 'doctor-f-wavy');
  assert.equal(maya.tailoredLabCoat, true);
  assert.equal(maya.longSleeves, true);
  assert.equal(maya.proStethoscope, true);
  assert.equal(maya.blueCrossBadge, true);

  const hair = getHairStyleGeometries('doctor-f-wavy');
  assertValidGeometry(hair.primaryHair, 'doctor-f-wavy primaryHair');
  assert.equal(hair.headwear, undefined);
});

test('all 10 heroes strike Start-Game signature gallery idle poses while keeping rope battle poses intact', () => {
  const maya = evaluateCharacterPose(0.5, 'idle', 'A', false, 0, 'doctor-f');
  const arga = evaluateCharacterPose(0.5, 'idle', 'A', false, 0, 'doctor-m');

  // Dr. Maya raises viewer-left fist (-X), Dr. Arga mirrors with viewer-right fist (+X)
  assert.ok(maya.handLTarget[1] > 1.45, `Dr. Maya should raise left-screen fist (got y=${maya.handLTarget[1]})`);
  assert.ok(maya.handRTarget[1] < 1.0, `Dr. Maya should plant right-screen hand on hip (got y=${maya.handRTarget[1]})`);
  assert.equal(maya.mouthMood, 'smile');
  assert.ok(maya.browTiltL < 0 && maya.browTiltR > 0, 'Dr. Maya should have determined heroic eyebrows');

  assert.ok(arga.handRTarget[1] > 1.45, `Dr. Arga should raise right-screen fist (got y=${arga.handRTarget[1]})`);
  assert.ok(arga.handLTarget[1] < 1.0, `Dr. Arga should plant left-screen hand on hip (got y=${arga.handLTarget[1]})`);

  // Every hero idle pose keeps finite, reachable arms within shoulder IK reach
  const shoulderL: [number, number, number] = [-0.295, 1.302, 0.015];
  const shoulderR: [number, number, number] = [0.295, 1.302, 0.015];
  const dist3 = (a: [number, number, number], b: [number, number, number]) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  for (const hero of CHARACTERS) {
    const p = evaluateCharacterPose(0.5, 'idle', 'A', false, 0, hero.id);
    assert.equal(p.mouthMood, 'smile', `${hero.id} should have a confident friendly gallery expression`);
    const dL = dist3(shoulderL, p.handLTarget);
    const dR = dist3(shoulderR, p.handRTarget);
    assert.ok(dL > 0.15 && dL < 0.62, `${hero.id} left arm reach out of bounds (${dL.toFixed(3)})`);
    assert.ok(dR > 0.15 && dR < 0.62, `${hero.id} right arm reach out of bounds (${dR.toFixed(3)})`);

    // Rope mode must remain firmly braced on the rope regardless of characterId
    const rope = evaluateCharacterPose(0.5, 'idle', 'A', true, 0, hero.id);
    assert.ok(rope.handLTarget[2] > 0.35 && rope.handRTarget[2] > 0.5, `${hero.id} rope grip intact`);
  }
});
