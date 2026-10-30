'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CHARACTERS, type Team } from '../../../../packages/shared/src';
import AnimatedGLTF from './AnimatedGLTF';
import {
  getFabricMaterial,
  getHairMaterial,
  getHeroProfile,
  getSkinMaterial,
  getStandardPartMaterial,
  getTeamAccent,
} from './character/materials';
import {
  ANKLE_HEIGHT,
  ARM_LOWER_LEN,
  ARM_UPPER_LEN,
  getChunkySneakerGeometries,
  getCrossbodyPouchGeometries,
  getHairStyleGeometries,
  getLeadApronGeometry,
  getOpenCoatGeometry,
  getPelvisSaddleGeometry,
  getRolledSleeveGeometry,
  getSculptedEarGeometry,
  getSculptedHeadGeometry,
  getSculptedNoseGeometry,
  getSkinnedArmGeometry,
  getSkinnedLowerCalfGeometry,
  getSkinnedPantLegGeometry,
  getStethoscopeTubeGeometry,
  getTorsoTunicGeometry,
  LEG_LOWER_LEN,
  LEG_UPPER_LEN,
} from './character/geometries';
import {
  evaluateCharacterPose,
  solveTwoBoneIK,
  type MouthMood,
} from './character/ikAndMotion';

export type CharacterMotion =
  | 'idle'
  | 'ready'
  | 'pulling'
  | 'struggling'
  | 'sliding'
  | 'falling'
  | 'victory'
  | 'defeat';

export interface CharacterProps {
  characterId: string;
  team?: Team;
  motion?: CharacterMotion;
  facing?: number;
  position?: [number, number, number];
  scale?: number;
  seed?: number;
  holdRope?: boolean;
  animate?: boolean;
}

interface LimbRig {
  upperBone: THREE.Bone;
  lowerBone: THREE.Bone;
  endBone: THREE.Bone;
  skeleton: THREE.Skeleton;
  meshes: THREE.SkinnedMesh[];
}

function createArmRig(armMat: THREE.Material): LimbRig {
  const upperBone = new THREE.Bone();
  const lowerBone = new THREE.Bone();
  const endBone = new THREE.Bone();
  upperBone.position.set(0, 0, 0);
  lowerBone.position.set(0, -ARM_UPPER_LEN, 0);
  endBone.position.set(0, -ARM_LOWER_LEN, 0);
  upperBone.add(lowerBone);
  lowerBone.add(endBone);
  upperBone.updateMatrixWorld(true);

  const skeleton = new THREE.Skeleton([upperBone, lowerBone, endBone]);
  const mesh = new THREE.SkinnedMesh(getSkinnedArmGeometry(), armMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.bind(skeleton, new THREE.Matrix4());

  return { upperBone, lowerBone, endBone, skeleton, meshes: [mesh] };
}

function createLegRig(
  shortsStyle: boolean,
  pantMat: THREE.Material,
  calfMat: THREE.Material,
): LimbRig {
  const upperBone = new THREE.Bone();
  const lowerBone = new THREE.Bone();
  const endBone = new THREE.Bone();
  upperBone.position.set(0, 0, 0);
  lowerBone.position.set(0, -LEG_UPPER_LEN, 0);
  endBone.position.set(0, -LEG_LOWER_LEN, 0);
  upperBone.add(lowerBone);
  lowerBone.add(endBone);
  upperBone.updateMatrixWorld(true);

  const skeleton = new THREE.Skeleton([upperBone, lowerBone, endBone]);
  const identity = new THREE.Matrix4();

  const pantMesh = new THREE.SkinnedMesh(getSkinnedPantLegGeometry(shortsStyle), pantMat);
  pantMesh.castShadow = true;
  pantMesh.receiveShadow = false;
  pantMesh.frustumCulled = false;
  pantMesh.bind(skeleton, identity);

  const calfMesh = new THREE.SkinnedMesh(getSkinnedLowerCalfGeometry(shortsStyle), calfMat);
  calfMesh.castShadow = true;
  calfMesh.receiveShadow = false;
  calfMesh.frustumCulled = false;
  calfMesh.bind(skeleton, identity);

  return { upperBone, lowerBone, endBone, skeleton, meshes: [pantMesh, calfMesh] };
}

function MedicalCross({ color = '#159a7c', size = 0.08 }: { color?: string; size?: number }) {
  const mat = useMemo(() => getStandardPartMaterial(color, { roughness: 0.55 }), [color]);
  return (
    <group>
      <mesh material={mat}>
        <boxGeometry args={[size * 0.34, size, 0.012]} />
      </mesh>
      <mesh material={mat}>
        <boxGeometry args={[size, size * 0.34, 0.013]} />
      </mesh>
    </group>
  );
}

/** Dispatch before mounting a renderer, so external GLB heroes remain supported if configured. */
export default function Character(props: CharacterProps) {
  const definition = CHARACTERS.find((hero) => hero.id === props.characterId) || CHARACTERS[0];
  if (!definition.modelPath) return <VinylHeroCharacter {...props} />;
  return (
    <group position={props.position || [0, 0, 0]} rotation={[0, props.facing || 0, 0]}>
      <AnimatedGLTF
        key={definition.modelPath}
        url={definition.modelPath}
        motion={props.motion}
        scale={(props.scale ?? 1) * definition.animationConfig.scale}
        animate={props.animate}
        team={props.team}
        holdRope={props.holdRope}
        seed={props.seed}
      />
    </group>
  );
}

const _shoulderLocal = new THREE.Vector3();
const _targetLocal = new THREE.Vector3();
const _poleLocal = new THREE.Vector3();
const _parentQuat = new THREE.Quaternion();
const _actorQuat = new THREE.Quaternion();
const _desiredFootQuat = new THREE.Quaternion();
const _footEuler = new THREE.Euler();

/**
 * Soft Clay-Vinyl Stylized 3D Healthcare Hero with Vertex-Skinned Seamless Limbs,
 * Subsurface Skin Shading, Two-Bone Analytical IK, and 12-Principles Organic Animation.
 */
function VinylHeroCharacter({
  characterId,
  team = 'A',
  motion = 'idle',
  facing = 0,
  position = [0, 0, 0],
  scale = 1,
  seed = 0,
  holdRope = false,
  animate = true,
}: CharacterProps) {
  const profile = getHeroProfile(characterId);
  const teamAccent = getTeamAccent(team);

  // Materials (cached & shared)
  const headSkinMat = useMemo(() => getSkinMaterial(profile.skin, true), [profile.skin]);
  const limbSkinMat = useMemo(() => getSkinMaterial(profile.skin, false), [profile.skin]);
  // Soft warm 48% blend between skin and blush for nose & inner ear concha (organic clay blend!)
  const noseSkinMat = useMemo(() => {
    const c = new THREE.Color(profile.skin).lerp(new THREE.Color(profile.skinBlush), 0.48);
    return getSkinMaterial(`#${c.getHexString()}`, false);
  }, [profile.skin, profile.skinBlush]);
  const handMat = useMemo(
    () => (profile.glove ? getFabricMaterial(profile.glove, 0.65) : limbSkinMat),
    [profile.glove, limbSkinMat],
  );
  const hairMat = useMemo(
    () => getHairMaterial(profile.hair, profile.hairSheen),
    [profile.hair, profile.hairSheen],
  );
  const topMat = useMemo(() => getFabricMaterial(profile.top, 0.88), [profile.top]);
  const coatMat = useMemo(
    () => (profile.coat ? getFabricMaterial(profile.coat, 0.87) : null),
    [profile.coat],
  );
  const pantsMat = useMemo(() => getFabricMaterial(profile.pants, 0.89), [profile.pants]);
  const shoeUpperMat = useMemo(
    () => getFabricMaterial(profile.shoeUpper, 0.78),
    [profile.shoeUpper],
  );
  const shoeSoleMat = useMemo(
    () => getStandardPartMaterial(profile.shoeSole, { roughness: 0.86 }),
    [profile.shoeSole],
  );
  const laceMat = useMemo(() => getFabricMaterial('#f7f1df', 0.88), []);
  const pouchMat = useMemo(
    () => (profile.pouch ? getFabricMaterial(profile.pouch, 0.84) : null),
    [profile.pouch],
  );
  const pouchBtnMat = useMemo(
    () =>
      getStandardPartMaterial(profile.pouch || '#4c7036', {
        roughness: 0.55,
      }),
    [profile.pouch],
  );
  const headwearMat = useMemo(() => {
    const c = profile.hijabColor || profile.capColor;
    return c ? getFabricMaterial(c, 0.84) : null;
  }, [profile.hijabColor, profile.capColor]);
  const headwearTrimMat = useMemo(() => {
    const c = profile.hijabInner || '#bfe8df';
    return getFabricMaterial(c, 0.86);
  }, [profile.hijabInner]);

  const eyeMat = useMemo(
    () => getStandardPartMaterial('#160e0a', { roughness: 0.14, clearcoat: 0.75 }),
    [],
  );
  const catchlightMat = useMemo(
    () =>
      getStandardPartMaterial('#fffbf2', {
        roughness: 0.1,
        emissive: '#fff9eb',
        emissiveIntensity: 0.45,
      }),
    [],
  );
  const mouthLineMat = useMemo(
    () => getStandardPartMaterial('#4f2618', { roughness: 0.75 }),
    [],
  );
  const mouthOpenMat = useMemo(
    () => getStandardPartMaterial('#521f1d', { roughness: 0.85 }),
    [],
  );
  const tongueMat = useMemo(() => getStandardPartMaterial('#dc766d', { roughness: 0.7 }), []);
  const watchMat = useMemo(
    () => getStandardPartMaterial('#212529', { roughness: 0.34, clearcoat: 0.35 }),
    [],
  );
  const watchBandMat = useMemo(
    () => getStandardPartMaterial('#2d3238', { roughness: 0.72 }),
    [],
  );
  const teamMat = useMemo(
    () => getStandardPartMaterial(teamAccent, { roughness: 0.55 }),
    [teamAccent],
  );
  const badgeCardMat = useMemo(
    () => getStandardPartMaterial('#f5f3ea', { roughness: 0.65 }),
    [],
  );
  const stethoTubeMat = useMemo(
    () => getStandardPartMaterial('#274344', { roughness: 0.52 }),
    [],
  );
  const steelMat = useMemo(
    () => getStandardPartMaterial('#9fb0b2', { roughness: 0.28, metalness: 0.65 }),
    [],
  );
  const glassesFrameMat = useMemo(
    () =>
      getStandardPartMaterial(profile.hasGoggles ? '#3a6873' : '#2a2421', {
        roughness: 0.36,
      }),
    [profile.hasGoggles],
  );
  const gogglesLensMat = useMemo(
    () =>
      getStandardPartMaterial('#bfe9f2', {
        roughness: 0.12,
        transparent: true,
        opacity: 0.28,
        clearcoat: 0.8,
      }),
    [],
  );
  const sweatMat = useMemo(
    () => getStandardPartMaterial('#7fd8ec', { roughness: 0.15, clearcoat: 0.6 }),
    [],
  );

  // Geometries (cached & shared)
  const headGeo = useMemo(
    () => getSculptedHeadGeometry(profile.skin, profile.skinBlush),
    [profile.skin, profile.skinBlush],
  );
  const earGeo = useMemo(() => getSculptedEarGeometry(), []);
  const noseGeo = useMemo(() => getSculptedNoseGeometry(), []);
  const tunicGeo = useMemo(() => getTorsoTunicGeometry(), []);
  const sleeveGeo = useMemo(() => getRolledSleeveGeometry(), []);
  const coatGeo = useMemo(() => (profile.coat ? getOpenCoatGeometry() : null), [profile.coat]);
  const leadApronGeo = useMemo(
    () => (profile.hasLeadApron ? getLeadApronGeometry() : null),
    [profile.hasLeadApron],
  );
  const pelvisGeo = useMemo(() => getPelvisSaddleGeometry(), []);
  const sneakerGeos = useMemo(() => getChunkySneakerGeometries(), []);
  const hairGeos = useMemo(
    () => getHairStyleGeometries(profile.hairStyle),
    [profile.hairStyle],
  );
  const pouchGeos = useMemo(
    () => (profile.pouch ? getCrossbodyPouchGeometries() : null),
    [profile.pouch],
  );
  const stethoGeo = useMemo(
    () => (profile.hasStethoscope ? getStethoscopeTubeGeometry() : null),
    [profile.hasStethoscope],
  );

  // Gently arched sculpted eyebrow geometry + delicate mouth curves matching reference image!
  const faceCurves = useMemo(() => {
    const mk = (pts: [number, number, number][], r: number) =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))),
        16,
        r,
        10,
        false,
      );
    return {
      // Softly arched horizontal eyebrow (centered at 0,0,0 along X)
      brow: mk(
        [
          [-0.042, -0.005, -0.006],
          [-0.015, 0.005, 0.002],
          [0.015, 0.005, 0.002],
          [0.042, -0.005, -0.006],
        ],
        0.0135,
      ),
      // Delicate minimal calm mouth line (matches reference image!)
      gentle: mk(
        [
          [-0.04, -0.172, 0.376],
          [-0.016, -0.165, 0.382],
          [0.016, -0.165, 0.382],
          [0.04, -0.172, 0.376],
        ],
        0.0072,
      ),
      // Warm friendly smile
      smile: mk(
        [
          [-0.058, -0.158, 0.372],
          [-0.022, -0.178, 0.381],
          [0.022, -0.178, 0.381],
          [0.058, -0.158, 0.372],
        ],
        0.0078,
      ),
      // Cute rueful pout
      pout: mk(
        [
          [-0.044, -0.18, 0.374],
          [-0.016, -0.165, 0.382],
          [0.016, -0.165, 0.382],
          [0.044, -0.18, 0.374],
        ],
        0.0076,
      ),
    };
  }, []);
  useEffect(
    () => () => {
      faceCurves.brow.dispose();
      faceCurves.gentle.dispose();
      faceCurves.smile.dispose();
      faceCurves.pout.dispose();
    },
    [faceCurves],
  );

  // Per-instance SkinnedMesh Skeletons for Left/Right Arms & Left/Right Legs
  const armL = useMemo(() => createArmRig(limbSkinMat), [limbSkinMat]);
  const armR = useMemo(() => createArmRig(limbSkinMat), [limbSkinMat]);
  const calfMat = useMemo(
    () => (profile.shortsStyle ? limbSkinMat : laceMat),
    [profile.shortsStyle, limbSkinMat, laceMat],
  );
  const legL = useMemo(
    () => createLegRig(Boolean(profile.shortsStyle), pantsMat, calfMat),
    [profile.shortsStyle, pantsMat, calfMat],
  );
  const legR = useMemo(
    () => createLegRig(Boolean(profile.shortsStyle), pantsMat, calfMat),
    [profile.shortsStyle, pantsMat, calfMat],
  );

  useEffect(
    () => () => {
      armL.skeleton.dispose();
      armR.skeleton.dispose();
      legL.skeleton.dispose();
      legR.skeleton.dispose();
    },
    [armL, armR, legL, legR],
  );

  // Scene graph refs
  const actorRef = useRef<THREE.Group>(null);
  const pelvisRef = useRef<THREE.Group>(null);
  const chestRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const hairGroupRef = useRef<THREE.Group>(null);
  const accessoryGroupRef = useRef<THREE.Group>(null);

  const eyeGroupLRef = useRef<THREE.Group>(null);
  const eyeGroupRRef = useRef<THREE.Group>(null);
  const browLRef = useRef<THREE.Mesh>(null);
  const browRRef = useRef<THREE.Mesh>(null);

  const mouthGentleRef = useRef<THREE.Mesh>(null);
  const mouthSmileRef = useRef<THREE.Mesh>(null);
  const mouthPoutRef = useRef<THREE.Mesh>(null);
  const mouthEffortRef = useRef<THREE.Mesh>(null);
  const mouthCheerRef = useRef<THREE.Group>(null);
  const sweatRef = useRef<THREE.Mesh>(null);

  const fingersLRef = useRef<THREE.Group>(null);
  const fingersRRef = useRef<THREE.Group>(null);

  const initialized = useRef(false);
  const damped = useRef({
    jumpY: 0,
    squashY: 1,
    squashXZ: 1,
    pelvisPos: new THREE.Vector3(0, 0.815, 0),
    pelvisRot: new THREE.Vector3(0, 0, 0),
    chestRot: new THREE.Vector3(0, 0, 0),
    chestBreath: 0,
    headRot: new THREE.Vector3(0, 0, 0),
    handL: new THREE.Vector3(-0.452, 0.758, 0.024),
    handR: new THREE.Vector3(0.452, 0.758, 0.024),
    poleArmL: new THREE.Vector3(-0.72, 1.04, -0.46),
    poleArmR: new THREE.Vector3(0.72, 1.04, -0.46),
    handLRot: new THREE.Vector3(0, 0, 0),
    handRRot: new THREE.Vector3(0, 0, 0),
    curlL: 0.2,
    curlR: 0.2,
    footL: new THREE.Vector3(-0.188, ANKLE_HEIGHT, 0.01),
    footR: new THREE.Vector3(0.188, ANKLE_HEIGHT, -0.008),
    poleLegL: new THREE.Vector3(-0.21, 0.48, 0.65),
    poleLegR: new THREE.Vector3(0.21, 0.48, 0.65),
    footLRot: new THREE.Vector3(0, -0.13, 0),
    footRRot: new THREE.Vector3(0, 0.13, 0),
    blink: 1,
    gazeX: 0,
    gazeY: 0,
    browLiftL: 0.006,
    browLiftR: 0.006,
    browTiltL: 0.085,
    browTiltR: -0.085,
    hairX: 0,
    hairZ: 0,
    accX: 0,
    accZ: 0,
  });

  const applyPose = (elapsedTime: number, dt: number, snap: boolean) => {
    const actor = actorRef.current;
    const pelvis = pelvisRef.current;
    const chest = chestRef.current;
    const head = headRef.current;
    if (!actor || !pelvis || !chest || !head) return;

    const t = (animate ? elapsedTime : 1.15) + seed * 2.37;
    const target = evaluateCharacterPose(t, motion, team, holdRope, seed);
    const s = damped.current;
    const k = snap ? 1000 : 12;
    const kFast = snap ? 1000 : 22;
    const kSpring = snap ? 1000 : 8;

    const dampVec = (v: THREE.Vector3, arr: [number, number, number], lambda: number) => {
      if (snap) {
        v.set(arr[0], arr[1], arr[2]);
      } else {
        v.x = THREE.MathUtils.damp(v.x, arr[0], lambda, dt);
        v.y = THREE.MathUtils.damp(v.y, arr[1], lambda, dt);
        v.z = THREE.MathUtils.damp(v.z, arr[2], lambda, dt);
      }
    };
    const dampNum = (cur: number, next: number, lambda: number) =>
      snap ? next : THREE.MathUtils.damp(cur, next, lambda, dt);

    s.jumpY = dampNum(s.jumpY, target.jumpY, kFast);
    s.squashY = dampNum(s.squashY, target.squashY, kFast);
    s.squashXZ = dampNum(s.squashXZ, target.squashXZ, kFast);

    dampVec(s.pelvisPos, target.pelvisPos, k);
    dampVec(s.pelvisRot, target.pelvisRot, k);
    dampVec(s.chestRot, target.chestRot, k);
    s.chestBreath = dampNum(s.chestBreath, target.chestBreath, k);
    dampVec(s.headRot, target.headRot, k);

    dampVec(s.handL, target.handLTarget, kFast);
    dampVec(s.handR, target.handRTarget, kFast);
    dampVec(s.poleArmL, target.elbowLPole, k);
    dampVec(s.poleArmR, target.elbowRPole, k);
    dampVec(s.handLRot, target.handLRot, k);
    dampVec(s.handRRot, target.handRRot, k);
    s.curlL = dampNum(s.curlL, target.fingerCurlL, kFast);
    s.curlR = dampNum(s.curlR, target.fingerCurlR, kFast);

    dampVec(s.footL, target.footLTarget, kFast);
    dampVec(s.footR, target.footRTarget, kFast);
    dampVec(s.poleLegL, target.kneeLPole, k);
    dampVec(s.poleLegR, target.kneeRPole, k);
    dampVec(s.footLRot, target.footLRot, kFast);
    dampVec(s.footRRot, target.footRRot, kFast);

    s.blink = dampNum(s.blink, target.blink, snap ? 1000 : 38);
    s.gazeX = dampNum(s.gazeX, target.eyeGazeX, kFast);
    s.gazeY = dampNum(s.gazeY, target.eyeGazeY, kFast);
    s.browLiftL = dampNum(s.browLiftL, target.browLiftL, k);
    s.browLiftR = dampNum(s.browLiftR, target.browLiftR, k);
    s.browTiltL = dampNum(s.browTiltL, target.browTiltL, k);
    s.browTiltR = dampNum(s.browTiltR, target.browTiltR, k);

    s.hairX = dampNum(s.hairX, target.hairBounceX, kSpring);
    s.hairZ = dampNum(s.hairZ, target.hairBounceZ, kSpring);
    s.accX = dampNum(s.accX, target.accessorySwingX, kSpring);
    s.accZ = dampNum(s.accZ, target.accessorySwingZ, kSpring);

    // 1. Apply Actor Root, Pelvis, Chest, Head
    actor.position.set(0, s.jumpY, 0);
    actor.scale.set(scale * s.squashXZ, scale * s.squashY, scale * s.squashXZ);

    pelvis.position.copy(s.pelvisPos);
    pelvis.rotation.set(s.pelvisRot.x, s.pelvisRot.y, s.pelvisRot.z);

    chest.rotation.set(s.chestRot.x, s.chestRot.y, s.chestRot.z);
    chest.scale.set(1, 1, 1);

    head.rotation.set(s.headRot.x, s.headRot.y, s.headRot.z);

    if (hairGroupRef.current) {
      hairGroupRef.current.rotation.set(s.hairX, 0, s.hairZ);
    }
    if (accessoryGroupRef.current) {
      accessoryGroupRef.current.rotation.set(s.accX, 0, s.accZ);
    }

    actor.updateMatrixWorld(true);

    // 2. Solve Two-Bone Leg IK (hip in pelvis space -> ankle footTarget in actor space)
    const solveLeg = (
      sign: -1 | 1,
      rig: LimbRig,
      footPos: THREE.Vector3,
      polePos: THREE.Vector3,
      footRot: THREE.Vector3,
    ) => {
      _shoulderLocal.set(sign * 0.185, -0.015, 0);
      _targetLocal.copy(footPos);
      actor.localToWorld(_targetLocal);
      pelvis.worldToLocal(_targetLocal);

      _poleLocal.copy(polePos);
      actor.localToWorld(_poleLocal);
      pelvis.worldToLocal(_poleLocal);

      solveTwoBoneIK(
        _shoulderLocal,
        _targetLocal,
        _poleLocal,
        LEG_UPPER_LEN,
        LEG_LOWER_LEN,
        rig.upperBone,
        rig.lowerBone,
        false,
      );

      rig.upperBone.updateMatrixWorld(true);
      rig.lowerBone.getWorldQuaternion(_parentQuat);
      actor.getWorldQuaternion(_actorQuat);
      _footEuler.set(footRot.x, footRot.y, footRot.z);
      _desiredFootQuat.setFromEuler(_footEuler);
      _actorQuat.multiply(_desiredFootQuat);
      rig.endBone.quaternion.copy(_parentQuat.invert().multiply(_actorQuat));
    };

    solveLeg(-1, legL, s.footL, s.poleLegL, s.footLRot);
    solveLeg(1, legR, s.footR, s.poleLegR, s.footRRot);

    // 3. Solve Two-Bone Arm IK (shoulder in chest space -> wrist handTarget in actor space)
    const solveArm = (
      sign: -1 | 1,
      rig: LimbRig,
      handPos: THREE.Vector3,
      polePos: THREE.Vector3,
      handRot: THREE.Vector3,
      fingerRef: THREE.Group | null,
      curl: number,
    ) => {
      _shoulderLocal.set(sign * 0.295, 0.492, 0.005);
      _targetLocal.copy(handPos);
      actor.localToWorld(_targetLocal);
      chest.worldToLocal(_targetLocal);

      _poleLocal.copy(polePos);
      actor.localToWorld(_poleLocal);
      chest.worldToLocal(_poleLocal);

      solveTwoBoneIK(
        _shoulderLocal,
        _targetLocal,
        _poleLocal,
        ARM_UPPER_LEN,
        ARM_LOWER_LEN,
        rig.upperBone,
        rig.lowerBone,
        true,
      );

      rig.endBone.rotation.set(handRot.x, handRot.y, handRot.z);
      if (fingerRef) {
        fingerRef.rotation.z = -sign * curl;
      }
    };

    solveArm(-1, armL, s.handL, s.poleArmL, s.handLRot, fingersLRef.current, s.curlL);
    solveArm(1, armR, s.handR, s.poleArmR, s.handRRot, fingersRRef.current, s.curlR);

    // 4. Facial Acting (Eyes, Brows, Mouth, Sweat)
    if (eyeGroupLRef.current) {
      eyeGroupLRef.current.scale.y = Math.max(0.08, s.blink);
      eyeGroupLRef.current.position.set(-0.114 + s.gazeX, 0.036 + s.gazeY, 0.376);
    }
    if (eyeGroupRRef.current) {
      eyeGroupRRef.current.scale.y = Math.max(0.08, s.blink);
      eyeGroupRRef.current.position.set(0.114 + s.gazeX, 0.036 + s.gazeY, 0.376);
    }
    // Note: brow geometry lies horizontally along X!
    // Positive rotation.z lifts +X and lowers -X:
    //   For browL (screen left, -X): +browTiltL lifts inner (+X) end -> sweet curious '/' arch!
    //   For browR (screen right, +X): -browTiltR lifts inner (-X) end -> sweet curious '\' arch!
    if (browLRef.current) {
      browLRef.current.position.y = 0.156 + s.browLiftL;
      browLRef.current.rotation.z = s.browTiltL;
    }
    if (browRRef.current) {
      browRRef.current.position.y = 0.156 + s.browLiftR;
      browRRef.current.rotation.z = s.browTiltR;
    }

    const mood: MouthMood = target.mouthMood;
    if (mouthGentleRef.current) mouthGentleRef.current.visible = mood === 'gentle';
    if (mouthSmileRef.current) mouthSmileRef.current.visible = mood === 'smile';
    if (mouthPoutRef.current) mouthPoutRef.current.visible = mood === 'pout';
    if (mouthEffortRef.current) mouthEffortRef.current.visible = mood === 'effort';
    if (mouthCheerRef.current) mouthCheerRef.current.visible = mood === 'cheer';

    if (sweatRef.current) {
      sweatRef.current.visible = target.sweatVisible;
      if (target.sweatVisible) {
        const p = target.sweatProgress;
        sweatRef.current.position.set(0.41, 0.24 - p * 0.22, 0.3);
        sweatRef.current.scale.setScalar((1 - p * 0.35) * 0.9);
      }
    }
  };

  useEffect(() => {
    applyPose(0, 0.016, true);
    initialized.current = true;
  });

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const snap = !initialized.current || !animate;
    applyPose(clock.elapsedTime, dt, snap);
    initialized.current = true;
  });

  const fingerOffsets = [0.036, 0.012, -0.012, -0.035];
  const fingerLengths = [0.054, 0.062, 0.058, 0.046];

  return (
    <group position={position} rotation={[0, facing, 0]}>
      <group ref={actorRef} scale={scale}>
        {/* PELVIS ROOT */}
        <group ref={pelvisRef} position={[0, 0.815, 0]}>
          {/* Unified rounded shorts/trouser pelvis saddle (zero hip gaps!) */}
          <mesh geometry={pelvisGeo} material={pantsMat} castShadow />

          {/* LEFT & RIGHT ARTICULATED SKINNED LEGS + COMPACT CHUNKY DESIGNER SNEAKERS */}
          {(
            [
              [-1, legL],
              [1, legR],
            ] as const
          ).map(([sign, rig]) => (
            <group key={sign} position={[sign * 0.185, -0.015, 0]}>
              {rig.meshes.map((m, idx) => (
                <primitive key={idx} object={m} />
              ))}
              <primitive object={rig.upperBone}>
                <primitive object={rig.lowerBone}>
                  <primitive object={rig.endBone}>
                    <mesh
                      geometry={sneakerGeos.sole}
                      material={shoeSoleMat}
                      castShadow
                      receiveShadow
                    />
                    <mesh
                      geometry={sneakerGeos.upper}
                      material={shoeUpperMat}
                      castShadow
                      receiveShadow
                    />
                    <mesh geometry={sneakerGeos.laces} material={laceMat} castShadow />
                  </primitive>
                </primitive>
              </primitive>
            </group>
          ))}

          {/* CHEST / TORSO */}
          <group ref={chestRef} position={[0, 0.005, 0]}>
            {/* Cozy A-line / pear-bell tee or scrub tunic */}
            <mesh geometry={tunicGeo} material={topMat} castShadow receiveShadow />

            {/* Optional open tailored medical coat / cardigan */}
            {coatGeo && coatMat && (
              <mesh geometry={coatGeo} material={coatMat} castShadow receiveShadow />
            )}

            {/* High-vis reflective chest band + medical emblem for Ambulance Officer */}
            {profile.hasReflective && (
              <group>
                <mesh
                  position={[0, 0.18, 0.016]}
                  scale={[1.08, 1, 0.84]}
                  material={getStandardPartMaterial('#e5ee9d', {
                    roughness: 0.45,
                    emissive: '#b5c96b',
                    emissiveIntensity: 0.1,
                  })}
                >
                  <cylinderGeometry args={[0.388, 0.4, 0.056, 36, 1, true]} />
                </mesh>
                <group position={[0.19, 0.42, 0.285]} rotation={[0, 0.24, 0]}>
                  <MedicalCross color="#fffdf2" size={0.095} />
                </group>
              </group>
            )}

            {/* Radiographer tailored protective cobalt lead-apron vest & dosimeter */}
            {leadApronGeo && (
              <group>
                <mesh
                  geometry={leadApronGeo}
                  material={getFabricMaterial('#2f527a', 0.84)}
                  castShadow
                  receiveShadow
                />
                <mesh
                  position={[0.17, 0.43, 0.305]}
                  rotation={[0, 0.22, 0]}
                  material={getStandardPartMaterial('#f2cf74', { roughness: 0.45 })}
                >
                  <boxGeometry args={[0.078, 0.11, 0.022]} />
                </mesh>
              </group>
            )}

            {/* Secondary-motion Accessories (Crossbody Pouch Bag, Stethoscope, ID Badge) */}
            <group ref={accessoryGroupRef}>
              {pouchGeos && pouchMat && (
                <group>
                  <mesh
                    geometry={pouchGeos.strapAndBag}
                    material={pouchMat}
                    castShadow
                    receiveShadow
                  />
                  <mesh geometry={pouchGeos.button} material={pouchBtnMat} />
                </group>
              )}

              {stethoGeo && (
                <group>
                  <mesh geometry={stethoGeo} material={stethoTubeMat} castShadow />
                  <mesh
                    position={[0.04, 0.16, 0.362]}
                    rotation={[Math.PI / 2 - 0.15, 0, 0]}
                    material={steelMat}
                    castShadow
                  >
                    <cylinderGeometry args={[0.046, 0.046, 0.02, 22]} />
                  </mesh>
                  <mesh
                    position={[0.04, 0.16, 0.373]}
                    rotation={[Math.PI / 2 - 0.15, 0, 0]}
                    material={stethoTubeMat}
                  >
                    <cylinderGeometry args={[0.032, 0.032, 0.008, 18]} />
                  </mesh>
                </group>
              )}

              {/* Crisp Medical ID Card with Team Color Header Stripe */}
              <group
                position={[-0.22, 0.36, profile.coat ? 0.335 : 0.296]}
                rotation={[-0.08, -0.32, 0.03]}
              >
                <mesh material={badgeCardMat} castShadow>
                  <boxGeometry args={[0.1, 0.125, 0.015]} />
                </mesh>
                <mesh position={[0, 0.038, 0.008]} material={teamMat}>
                  <boxGeometry args={[0.084, 0.022, 0.006]} />
                </mesh>
                <mesh
                  position={[0, 0.005, 0.008]}
                  material={getStandardPartMaterial('#9aa8a6', { roughness: 0.7 })}
                >
                  <boxGeometry args={[0.066, 0.009, 0.005]} />
                </mesh>
                <mesh
                  position={[-0.008, -0.018, 0.008]}
                  material={getStandardPartMaterial('#b4bfbd', { roughness: 0.7 })}
                >
                  <boxGeometry args={[0.048, 0.008, 0.005]} />
                </mesh>
              </group>
            </group>

            {/* LEFT & RIGHT ARTICULATED SKINNED ARMS + ROLLED SLEEVES + SMARTWATCH + 5-FINGER HANDS */}
            {(
              [
                [-1, armL, fingersLRef],
                [1, armR, fingersRRef],
              ] as const
            ).map(([sign, rig, fRef]) => (
              <group key={sign} position={[sign * 0.295, 0.492, 0.005]}>
                {rig.meshes.map((m, idx) => (
                  <primitive key={idx} object={m} />
                ))}
                <primitive object={rig.upperBone}>
                  {/* Cozy drop-shoulder rolled short sleeve rotates cleanly with upper arm */}
                  <mesh
                    geometry={sleeveGeo}
                    material={coatMat ?? topMat}
                    castShadow
                    receiveShadow
                  />
                  <primitive object={rig.lowerBone}>
                    {/* Snug chunky dark smartwatch on character's LEFT wrist (sign === +1, viewer's RIGHT — exact match to reference image!) */}
                    {sign === 1 && profile.hasWatch && (
                      <group position={[0, -ARM_LOWER_LEN + 0.044, 0]} rotation={[0, -0.68, 0]}>
                        {/* Snug matte-charcoal silicone strap hugging the 0.062 wrist skin tightly */}
                        <mesh scale={[0.96, 1, 1.06]} material={watchBandMat} castShadow>
                          <cylinderGeometry args={[0.068, 0.066, 0.032, 24]} />
                        </mesh>
                        {/* Sleek rounded rectangular dark smartwatch case on outer wrist */}
                        <mesh position={[0.064, 0, 0]} material={watchMat} castShadow>
                          <boxGeometry args={[0.022, 0.048, 0.052]} />
                        </mesh>
                        <mesh position={[0.064, 0, 0]} material={watchBandMat}>
                          <boxGeometry args={[0.025, 0.04, 0.044]} />
                        </mesh>
                      </group>
                    )}

                    {/* Neat rolled nitrile glove cuff for gloved professions */}
                    {profile.glove && (
                      <mesh
                        position={[0, -ARM_LOWER_LEN + 0.005, 0]}
                        rotation={[Math.PI / 2, 0, 0]}
                        material={handMat}
                        castShadow
                      >
                        <torusGeometry args={[0.064, 0.011, 10, 22]} />
                      </mesh>
                    )}

                    {/* Plump Sculpted 5-Finger Hand blending seamlessly from the forearm */}
                    <primitive object={rig.endBone}>
                      <group position={[0, -0.034, 0]}>
                        <mesh scale={[0.06, 0.072, 0.073]} material={handMat} castShadow>
                          <sphereGeometry args={[1, 20, 16]} />
                        </mesh>
                        {/* Plump forward-facing thumb */}
                        <mesh
                          position={[-sign * 0.016, -0.01, 0.064]}
                          rotation={[0.45, 0, -sign * 0.28]}
                          material={handMat}
                          castShadow
                        >
                          <capsuleGeometry args={[0.021, 0.036, 6, 12]} />
                        </mesh>
                        {/* Articulated 4-finger curl group */}
                        <group ref={fRef} position={[0, -0.042, 0]}>
                          {fingerOffsets.map((fz, idx) => {
                            const len = fingerLengths[idx];
                            return (
                              <mesh
                                key={idx}
                                position={[0, -len * 0.5, fz]}
                                material={handMat}
                                castShadow
                              >
                                <capsuleGeometry
                                  args={[0.0175, Math.max(0.014, len - 0.026), 6, 10]}
                                />
                              </mesh>
                            );
                          })}
                        </group>
                      </group>
                    </primitive>
                  </primitive>
                </primitive>
              </group>
            ))}

            {/* COZY TUCKED SHORT NECK (no giraffe neck gap — chin sits right above crew collar!) */}
            <mesh position={[0, 0.655, 0.006]} material={limbSkinMat} castShadow>
              <capsuleGeometry args={[0.118, 0.07, 8, 18]} />
            </mesh>

            {/* SCULPTED CHUBBY VINYL HEAD & EXPRESSIVE FACE */}
            <group ref={headRef} position={[0, 1.072, 0.016]}>
              {/* Sculpted head with baked airbrushed vertex-color cheek & nose blush (receiveShadow off prevents shadow-map acne on face!) */}
              <mesh geometry={headGeo} material={headSkinMat} castShadow />

              {/* Prominent Low-Set Big Rounded C-Cup Ears (hidden cleanly inside draped hijab!) */}
              {profile.hairStyle !== 'hijab-draped' &&
                ([-1, 1] as const).map((sign) => (
                  <group
                    key={sign}
                    position={[sign * 0.462, -0.046, -0.008]}
                    rotation={[0, -sign * 0.22, sign * 0.06]}
                  >
                    <mesh geometry={earGeo} material={limbSkinMat} castShadow />
                    <mesh
                      position={[0, -0.004, 0.016]}
                      scale={[0.052, 0.072, 0.024]}
                      material={noseSkinMat}
                    >
                      <sphereGeometry args={[1, 16, 12]} />
                    </mesh>
                  </group>
                ))}

              {/* Plump Warm-Peachy Button Nose */}
              <mesh
                position={[0, -0.036, 0.404]}
                geometry={noseGeo}
                material={noseSkinMat}
                castShadow
              />

              {/* Small Expressive Glossy Dark-Espresso Oval Bead Eyes + Crisp Top-Left Catchlights */}
              <group ref={eyeGroupLRef} position={[-0.114, 0.036, 0.376]} rotation={[0, -0.14, 0]}>
                <mesh scale={[0.028, 0.044, 0.022]} material={eyeMat}>
                  <sphereGeometry args={[1, 20, 14]} />
                </mesh>
                <mesh position={[-0.007, 0.013, 0.019]} material={catchlightMat}>
                  <sphereGeometry args={[0.0065, 10, 8]} />
                </mesh>
              </group>
              <group ref={eyeGroupRRef} position={[0.114, 0.036, 0.376]} rotation={[0, 0.14, 0]}>
                <mesh scale={[0.028, 0.044, 0.022]} material={eyeMat}>
                  <sphereGeometry args={[1, 20, 14]} />
                </mesh>
                <mesh position={[-0.007, 0.013, 0.019]} material={catchlightMat}>
                  <sphereGeometry args={[0.0065, 10, 8]} />
                </mesh>
              </group>

              {/* Softly Arched Curious Eyebrows (/ \ sweet innocent look from reference!) */}
              <mesh
                ref={browLRef}
                position={[-0.118, 0.156, 0.362]}
                rotation={[0.12, -0.18, 0.085]}
                geometry={faceCurves.brow}
                material={hairMat}
              />
              <mesh
                ref={browRRef}
                position={[0.118, 0.156, 0.362]}
                rotation={[0.12, 0.18, -0.085]}
                geometry={faceCurves.brow}
                material={hairMat}
              />

              {/* Dynamic Expressive Mouth States */}
              <mesh ref={mouthGentleRef} geometry={faceCurves.gentle} material={mouthLineMat} />
              <mesh
                ref={mouthSmileRef}
                geometry={faceCurves.smile}
                material={mouthLineMat}
                visible={false}
              />
              <mesh
                ref={mouthPoutRef}
                geometry={faceCurves.pout}
                material={mouthLineMat}
                visible={false}
              />
              <mesh
                ref={mouthEffortRef}
                position={[0, -0.17, 0.376]}
                scale={[0.036, 0.042, 0.02]}
                material={mouthOpenMat}
                visible={false}
              >
                <sphereGeometry args={[1, 16, 12]} />
              </mesh>
              <group ref={mouthCheerRef} position={[0, -0.17, 0.376]} visible={false}>
                <mesh scale={[0.062, 0.048, 0.022]} material={mouthOpenMat}>
                  <sphereGeometry args={[1, 18, 12]} />
                </mesh>
                <mesh
                  position={[0, -0.016, 0.012]}
                  scale={[0.036, 0.02, 0.014]}
                  material={tongueMat}
                >
                  <sphereGeometry args={[1, 12, 8]} />
                </mesh>
              </group>

              {/* Cute Round Glasses (Pharmacist — Variation 1/3!) or Translucent Safety Goggles (Analyst) */}
              {(profile.hasGlasses || profile.hasGoggles) && (
                <group position={[0, 0.036, 0.398]}>
                  {([-1, 1] as const).map((sign) => (
                    <group key={sign} position={[sign * 0.124, 0, 0]} rotation={[0, sign * 0.12, 0]}>
                      <mesh scale={[1.04, 0.98, 1]} material={glassesFrameMat} castShadow>
                        <torusGeometry
                          args={[
                            profile.hasGoggles ? 0.098 : 0.092,
                            profile.hasGoggles ? 0.018 : 0.0145,
                            14,
                            36,
                          ]}
                        />
                      </mesh>
                      {profile.hasGoggles && (
                        <mesh scale={[1.04, 0.98, 1]} material={gogglesLensMat}>
                          <circleGeometry args={[0.09, 24]} />
                        </mesh>
                      )}
                      <mesh
                        position={[sign * 0.108, 0.008, -0.148]}
                        rotation={[0, -sign * 0.18, 0]}
                        material={glassesFrameMat}
                      >
                        <boxGeometry args={[0.019, 0.021, 0.26]} />
                      </mesh>
                    </group>
                  ))}
                  <mesh
                    position={[0, 0.01, 0.006]}
                    rotation={[0, 0, Math.PI / 2]}
                    material={glassesFrameMat}
                  >
                    <capsuleGeometry args={[0.012, 0.042, 5, 10]} />
                  </mesh>
                </group>
              )}

              {/* Sculpted Clay-Vinyl Hair & Profession Headwear with Secondary Spring Bounce */}
              <group ref={hairGroupRef}>
                {hairGeos.primaryHair && (
                  <mesh
                    geometry={hairGeos.primaryHair}
                    material={hairMat}
                    castShadow
                    receiveShadow
                  />
                )}
                {hairGeos.headwearTrim && (
                  <mesh
                    geometry={hairGeos.headwearTrim}
                    material={headwearTrimMat}
                    castShadow
                    receiveShadow
                  />
                )}
                {hairGeos.headwear && headwearMat && (
                  <mesh
                    geometry={hairGeos.headwear}
                    material={headwearMat}
                    castShadow
                    receiveShadow
                  />
                )}
                {profile.hairStyle === 'nurse-bob-cap' && (
                  <group position={[0, 0.545, 0.175]} rotation={[-0.16, 0, 0]}>
                    <MedicalCross color={teamAccent} size={0.08} />
                  </group>
                )}
                {profile.hairStyle === 'responder-cap' && (
                  <group position={[0, 0.365, 0.415]} rotation={[-0.22, 0, 0]}>
                    <MedicalCross color="#fffdf0" size={0.09} />
                  </group>
                )}
              </group>

              {/* Animated Struggle Sweat Droplet */}
              <mesh
                ref={sweatRef}
                position={[0.41, 0.24, 0.3]}
                rotation={[0, 0, -0.25]}
                material={sweatMat}
                visible={false}
              >
                <coneGeometry args={[0.042, 0.11, 12]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
