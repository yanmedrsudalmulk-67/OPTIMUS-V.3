'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { imageYToNdcY, type CrowdPlacementMode } from '../../lib/arenaLayout';

export interface CrowdProps {
  low: boolean;
  phase?: string;
  paused?: boolean;
  mode?: CrowdPlacementMode;
  imgAspect?: number;
  anchorImgFrac?: number;
  crowdZ?: number;
  scaleBase?: number;
  spanRatio?: number;
  beachPalette?: boolean;
}

const SKINS = ['#eab087', '#e09a6e', '#d1875a', '#f0bf9c', '#c67d53'];
const HOSPITAL_SHIRTS = ['#16a37f', '#2563eb', '#e06c88', '#0d9488', '#ea7b46', '#6366f1'];
const BEACH_SHIRTS = ['#14b8a6', '#f97316', '#38bdf8', '#ec4899', '#10b981', '#eab308', '#8b5cf6'];
const HAIRS = ['#342016', '#211510', '#5a3622', '#2f1c14', '#6d442b'];
const PANTS = ['#334155', '#475569', '#b89464', '#1e3a5f', '#64748b'];
const CAPS = ['#10b981', '#0ea5e9', '#f43f5e', '#f59e0b', '#14b8a6', '#6366f1'];

/**
 * High-craft instanced 3D vinyl spectator crowd:
 * - Zero mid-body slicing on open arenas (`mode === 'grounded'`), with soft contact shadows under shoes.
 * - Clean waist-aligned stadium cheering behind solid barricades (`mode === 'barricade'`).
 * - 4 distinct energetic animation personalities (jump-cheer, double-clap, stadium wave, fist-pump),
 *   squash-and-stretch hops, head-bobs, caps/hairstyles, and team cheer pom-poms.
 */
export default function Crowd({
  low,
  phase,
  paused = false,
  mode = 'grounded',
  imgAspect = 2.0,
  anchorImgFrac = 0.545,
  crowdZ = -5.6,
  scaleBase = 1.0,
  spanRatio = 0.35,
  beachPalette = false,
}: CrowdProps) {
  const bodyMesh = useRef<THREE.InstancedMesh>(null);
  const shadowMesh = useRef<THREE.InstancedMesh>(null);
  const time = useRef(0);
  const count = low ? 10 : 14;

  const helper = useMemo(() => new THREE.Object3D(), []);
  const shadowHelper = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.6), []);
  const rayPoint = useMemo(() => new THREE.Vector3(), []);
  const rayDir = useMemo(() => new THREE.Vector3(), []);

  // Soft radial contact shadow texture for grounded spectators
  const shadowTex = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
      grad.addColorStop(0, 'rgba(18, 12, 8, 0.42)');
      grad.addColorStop(0.55, 'rgba(18, 12, 8, 0.18)');
      grad.addColorStop(1, 'rgba(18, 12, 8, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  useEffect(
    () => () => {
      shadowTex?.dispose();
    },
    [shadowTex],
  );

  const isVictory = phase === 'FINISHED';
  const isPulling = phase === 'PULL_ANIMATION' || phase === 'COUNTDOWN' || phase === 'ROUND_RESULT';
  const excited = isVictory || isPulling;
  const shirts = beachPalette ? BEACH_SHIRTS : HOSPITAL_SHIRTS;
  const isBarricade = mode === 'barricade';

  useFrame(({ camera, size }, delta) => {
    if (!bodyMesh.current) return;
    if (!paused) time.current += Math.min(delta, 0.05);

    const aspect = size.width / Math.max(1, size.height);
    const anchorNdcY = imageYToNdcY(anchorImgFrac, aspect, imgAspect, 0.72);
    rayPoint.set(0, anchorNdcY, 0.5).unproject(camera);
    rayDir.copy(rayPoint).sub(camera.position);
    const tHit = Math.abs(rayDir.z) > 1e-4 ? (crowdZ - camera.position.z) / rayDir.z : 1;
    const anchorWorldY = camera.position.y + rayDir.y * tHit;

    // In barricade mode, align clip plane flush with top of solid barrier & lift spectators so full chest+arms are clear
    if (isBarricade) {
      clipPlane.constant = -anchorWorldY;
    }
    const resolvedBaseY = isBarricade ? anchorWorldY - 0.44 : anchorWorldY;

    // Fit spectator row cleanly inside backdrop promenade bounds
    const dist = Math.max(1, camera.position.z - crowdZ);
    const persp = camera as THREE.PerspectiveCamera;
    const halfH = dist * Math.tan(((persp.fov || 44) * Math.PI) / 360);
    const visibleHalfW = halfH * aspect;
    const imgWidthScale = aspect < imgAspect ? imgAspect / aspect : 1;
    const halfSpanX = Math.min(visibleHalfW * 0.76, visibleHalfW * imgWidthScale * spanRatio);

    let index = 0;
    const add = (
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      tint: string,
      rx = 0,
      ry = 0,
      rz = 0,
    ) => {
      helper.position.set(x, y, z);
      helper.scale.set(sx, sy, sz);
      helper.rotation.set(rx, ry, rz);
      helper.updateMatrix();
      bodyMesh.current!.setMatrixAt(index, helper.matrix);
      bodyMesh.current!.setColorAt(index++, color.set(tint));
    };

    const speed = isVictory ? 6.4 : isPulling ? 5.2 : 2.8;

    for (let i = 0; i < count; i++) {
      const frac = count > 1 ? i / (count - 1) : 0.5;
      const normX = frac * 2 - 1; // -1..+1
      const x = normX * halfSpanX;
      // Gentle stadium arc with staggered front/back depth rows
      const arcZ = -Math.abs(normX) * (isBarricade ? 0.18 : 0.45);
      const staggerZ = (i % 2) * (isBarricade ? -0.22 : -0.42);
      const z = crowdZ + arcZ + staggerZ;

      const personality = i % 4; // 0: jump-cheer, 1: double-clap, 2: stadium wave, 3: fist-pump
      const phaseOffset = i * 0.62 + (i % 3) * 0.9;
      const t = time.current * speed + phaseOffset;

      // Travelling Mexican wave across crowd
      const waveRaw = Math.sin(time.current * (excited ? 4.4 : 2.3) - i * 0.48);
      const waveLift = Math.max(0, waveRaw);

      // Lively bounce with squash-and-stretch
      const hopWave =
        personality === 2
          ? waveLift
          : Math.max(0, Math.sin(t * (personality === 0 ? 1.1 : 0.95)));
      const hopAmp = isVictory
        ? personality === 0
          ? 0.28
          : 0.21
        : isPulling
          ? 0.16
          : personality === 2
            ? 0.08
            : 0.055;
      const bounce = hopWave * hopAmp;
      const squashY = 1 + hopWave * (excited ? 0.08 : 0.03) - (1 - hopWave) * (excited ? 0.04 : 0.015);
      const squashXZ = 1 / Math.sqrt(Math.max(0.75, squashY));

      const sway = Math.sin(t * 0.55) * (excited ? 0.055 : 0.03);
      const headTurnY = -normX * 0.24 + Math.sin(t * 0.45) * 0.12;
      const headNodX = Math.sin(t * 1.1) * (excited ? 0.1 : 0.045);

      const s = scaleBase * (0.94 + (i % 3) * 0.055);
      const groundY = resolvedBaseY + (isBarricade ? 0 : (i % 2) * 0.04);
      const y = groundY + bounce;

      // Grounded soft contact shadow under each full-body spectator
      if (shadowMesh.current && !isBarricade) {
        const shadowShrink = Math.max(0.55, 1 - bounce * 1.25);
        shadowHelper.position.set(x, groundY + 0.015, z + 0.02);
        shadowHelper.rotation.set(-Math.PI / 2, 0, 0);
        shadowHelper.scale.set(0.68 * s * shadowShrink, 0.42 * s * shadowShrink, 1);
        shadowHelper.updateMatrix();
        shadowMesh.current.setMatrixAt(i, shadowHelper.matrix);
      }

      const skin = SKINS[i % SKINS.length];
      const shirt = shirts[i % shirts.length];
      const hair = HAIRS[i % HAIRS.length];
      const pants = PANTS[i % PANTS.length];
      const teamCheerColor = normX < 0 ? '#10b981' : '#38bdf8';
      const capColor = i % 2 === 0 ? teamCheerColor : CAPS[i % CAPS.length];
      const shoeColor = i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#f5efe0' : '#1e293b';

      const body = (
        px: number,
        py: number,
        pz: number,
        sx: number,
        sy: number,
        sz: number,
        tint: string,
        rx = 0,
        ry = 0,
        rz = 0,
      ) =>
        add(
          x + (px + sway * py * 0.45) * s * squashXZ,
          y + py * s * squashY,
          z + pz * s * squashXZ,
          sx * s * squashXZ,
          sy * s * squashY,
          sz * s * squashXZ,
          tint,
          rx,
          ry,
          rz,
        );

      // Torso + subtle white collar & waist stripe
      body(0, 0.66, 0, 0.245, 0.285, 0.17, shirt, 0, headTurnY * 0.35, sway * 0.65);
      body(0, 0.87, 0.025, 0.125, 0.042, 0.115, '#f8fafc', 0, headTurnY * 0.35, sway * 0.5);
      // Hips / shorts
      body(0, 0.40, 0, 0.22, 0.145, 0.155, pants, 0, headTurnY * 0.2, sway * 0.2);

      // Full legs & sneakers with lively hop knee-tuck
      const legLift = Math.max(0, bounce - 0.05) * 0.45;
      for (const sign of [-1, 1]) {
        const kick = sign * Math.sin(t) * (isVictory ? 0.045 : 0.015);
        body(sign * 0.105, 0.22 + legLift, kick * 0.4, 0.082, 0.155, 0.088, pants, kick * 1.4, 0, 0);
        body(sign * 0.11, 0.075 + legLift, 0.055 + kick, 0.115, 0.072, 0.165, shoeColor);
      }

      // Neck & sculpted round head with expressive turn & nod
      body(0, 0.92, 0, 0.088, 0.085, 0.088, skin);
      body(0, 1.15, 0.018, 0.292, 0.282, 0.255, skin, headNodX, headTurnY, -sway * 0.55);
      for (const sign of [-1, 1]) {
        body(sign * 0.29, 1.12, 0.01, 0.054, 0.078, 0.045, skin);
      }

      // Distinct hairstyles & caps (6 variants)
      const hairVariant = i % 6;
      if (hairVariant === 0 || hairVariant === 4) {
        // Sporty team cap + brim + hair back
        body(0, 1.32, -0.02, 0.305, 0.165, 0.265, capColor, headNodX, headTurnY, -sway * 0.4);
        body(0, 1.29, 0.21, 0.22, 0.034, 0.16, capColor, headNodX + 0.12, headTurnY, -sway * 0.4);
        body(0, 1.19, -0.17, 0.26, 0.15, 0.12, hair);
      } else if (hairVariant === 1) {
        // Sleek bob with cute side locks
        body(0, 1.33, -0.035, 0.315, 0.17, 0.245, hair);
        body(-0.12, 1.38, 0.085, 0.175, 0.11, 0.16, hair, 0, 0, -0.24);
        body(0.11, 1.37, 0.1, 0.17, 0.105, 0.155, hair, 0, 0, 0.24);
        body(-0.295, 1.16, -0.02, 0.092, 0.165, 0.095, hair, 0, 0, -0.18);
        body(0.295, 1.16, -0.02, 0.092, 0.165, 0.095, hair, 0, 0, 0.18);
      } else if (hairVariant === 2) {
        // Curly fluffy puffs
        body(0, 1.35, -0.02, 0.31, 0.18, 0.25, hair);
        body(-0.18, 1.39, 0.04, 0.15, 0.145, 0.15, hair);
        body(0.18, 1.39, 0.04, 0.15, 0.145, 0.15, hair);
        body(0, 1.44, 0.05, 0.16, 0.13, 0.14, hair);
      } else if (hairVariant === 3) {
        // Twin playful buns + headband
        body(0, 1.32, -0.03, 0.305, 0.165, 0.24, hair);
        body(-0.25, 1.42, -0.02, 0.115, 0.115, 0.115, hair);
        body(0.25, 1.42, -0.02, 0.115, 0.115, 0.115, hair);
        body(0, 1.31, 0.16, 0.275, 0.042, 0.11, teamCheerColor);
      } else {
        // Layered crop with lively fringe
        body(0, 1.33, -0.035, 0.31, 0.17, 0.245, hair);
        body(-0.11, 1.385, 0.09, 0.175, 0.11, 0.16, hair, 0, 0, -0.28);
        body(0.11, 1.38, 0.11, 0.17, 0.105, 0.155, hair, 0, 0, 0.28);
      }

      // Expressive blinking eyes, bright catchlights, rosy cheeks, nose, and cheering mouth
      const blink = Math.sin(time.current * 0.85 + i * 3.1) > 0.994 ? 0.14 : 1;
      for (const sign of [-1, 1]) {
        body(sign * 0.094, 1.165, 0.254, 0.031, 0.046 * blink, 0.02, '#160f0c');
        body(sign * 0.094 - 0.008, 1.18, 0.268, 0.01, 0.011 * blink, 0.006, '#fffdf5');
        body(sign * 0.162, 1.072, 0.222, 0.048, 0.026, 0.01, '#e68875');
      }
      body(0, 1.11, 0.266, 0.04, 0.044, 0.042, '#e38a72');
      body(0, 1.02, 0.242, isVictory ? 0.068 : 0.052, excited ? 0.052 : 0.02, 0.016, '#5a291d');

      // Articulated animated arms + optional team cheer pom-poms
      const hasPomPoms = personality === 0 || (personality === 2 && i % 2 === 0);
      for (const sign of [-1, 1]) {
        let armAngle: number;
        let handX: number;
        let handY: number;
        let forward: number;

        const shoulderX = sign * 0.22;
        const shoulderY = 0.80;

        if (personality === 1 && !isVictory) {
          // Rhythmic double clap in front of chest
          const clapBeat = Math.sin(t * 1.65);
          armAngle = -sign * (1.05 + clapBeat * 0.24);
          const elbowX = shoulderX + Math.sin(armAngle) * 0.20;
          const elbowY = shoulderY - Math.cos(armAngle) * 0.20;
          handX = sign * (0.045 + (1 + clapBeat) * 0.065);
          handY = 0.86 + Math.abs(clapBeat) * 0.04;
          forward = 0.23;

          body((shoulderX + elbowX) / 2, (shoulderY + elbowY) / 2, forward * 0.5, 0.084, 0.155, 0.082, shirt, 0, 0, armAngle);
          const foreAng = Math.atan2(handX - elbowX, -(handY - elbowY));
          body((elbowX + handX) / 2, (elbowY + handY) / 2, forward, 0.06, 0.14, 0.062, skin, 0, 0, foreAng);
          body(handX, handY, forward + 0.015, 0.072, 0.076, 0.058, skin, 0, 0, armAngle * 0.35);
        } else {
          // High-energy waving, stadium wave, or alternating fist-pumps
          if (personality === 3) {
            const altPhase = t * 1.15 + (sign > 0 ? Math.PI : 0);
            armAngle = sign * (2.25 + Math.sin(altPhase) * 0.58);
          } else if (personality === 2) {
            armAngle = sign * (1.65 + waveLift * 1.15);
          } else {
            // Double-arm V-cheer pump
            armAngle = sign * (2.42 + Math.sin(t * 1.25) * 0.34);
          }

          const elbowX = shoulderX + Math.sin(armAngle) * 0.21;
          const elbowY = shoulderY - Math.cos(armAngle) * 0.21;
          const wristAngle = armAngle + sign * 0.22;
          handX = elbowX + Math.sin(wristAngle) * 0.21;
          handY = elbowY - Math.cos(wristAngle) * 0.21;
          forward = 0.06;

          body((shoulderX + elbowX) / 2, (shoulderY + elbowY) / 2, forward * 0.5, 0.084, 0.158, 0.082, shirt, 0, 0, armAngle);
          const foreAng = Math.atan2(handX - elbowX, -(handY - elbowY));
          body((elbowX + handX) / 2, (elbowY + handY) / 2, forward, 0.06, 0.142, 0.062, skin, 0, 0, foreAng);
          body(handX, handY, forward + 0.012, 0.072, 0.076, 0.058, skin, 0, 0, armAngle * 0.4);

          if (hasPomPoms) {
            const pomScale = excited ? 0.115 : 0.095;
            body(
              handX + Math.sin(wristAngle) * 0.055,
              handY - Math.cos(wristAngle) * 0.055,
              forward + 0.03,
              pomScale,
              pomScale,
              pomScale,
              teamCheerColor,
            );
          }
        }
      }
    }

    bodyMesh.current.count = index;
    bodyMesh.current.instanceMatrix.needsUpdate = true;
    if (bodyMesh.current.instanceColor) bodyMesh.current.instanceColor.needsUpdate = true;

    if (shadowMesh.current && !isBarricade) {
      shadowMesh.current.count = count;
      shadowMesh.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {!isBarricade && shadowTex && (
        <instancedMesh ref={shadowMesh} args={[undefined, undefined, count]} frustumCulled={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
        </instancedMesh>
      )}
      <instancedMesh
        ref={bodyMesh}
        args={[undefined, undefined, count * 56]}
        frustumCulled={false}
        castShadow={!low && !isBarricade}
      >
        <sphereGeometry args={[1, low ? 12 : 16, low ? 10 : 12]} />
        <meshPhysicalMaterial
          roughness={0.42}
          metalness={0}
          clearcoat={0.3}
          clearcoatRoughness={0.3}
          sheen={0.38}
          sheenRoughness={0.5}
          clippingPlanes={isBarricade ? [clipPlane] : undefined}
        />
      </instancedMesh>
    </group>
  );
}
