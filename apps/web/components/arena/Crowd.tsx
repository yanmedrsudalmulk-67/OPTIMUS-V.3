'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function imageYToNdcY(
  imgFrac: number,
  containerAspect: number,
  imgAspect = 2.0,
  objPosY = 0.72,
): number {
  const scale = containerAspect > imgAspect ? containerAspect / imgAspect : 1;
  const screenFrac = imgFrac * scale - objPosY * (scale - 1);
  return 1 - 2 * screenFrac;
}

/** Shared instanced shapes keep the animated audience inexpensive on phones while matching the soft-vinyl aesthetic. */
export default function Crowd({
  low,
  phase,
  paused = false,
  baseHeight = 0.37,
  behindBarricade = false,
}: {
  low: boolean;
  phase?: string;
  paused?: boolean;
  baseHeight?: number;
  behindBarricade?: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const time = useRef(0);
  const count = low ? 10 : 14;
  const helper = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.6), []);
  const rayPoint = useMemo(() => new THREE.Vector3(), []);
  const rayDir = useMemo(() => new THREE.Vector3(), []);
  const excited = ['COUNTDOWN', 'PULL_ANIMATION', 'ROUND_RESULT', 'FINISHED'].includes(phase || '');
  const skins = ['#e2986b', '#d98e62', '#ce8256', '#df9b72'];
  const shirts = ['#5a733b', '#478db7', '#cf7b98', '#3f8c71', '#d16640', '#6961a6'];

  useFrame(({ camera, size }, delta) => {
    if (!mesh.current) return;
    if (!paused) time.current += Math.min(delta, 0.05);

    const crowdZ = behindBarricade ? -5.1 : -3.5;
    let resolvedBaseY = baseHeight;
    let halfSpanX = 6.35;

    if (behindBarricade) {
      const aspect = size.width / Math.max(1, size.height);
      const topBarricadeNdcY = imageYToNdcY(0.625, aspect, 2.0, 0.72);
      rayPoint.set(0, topBarricadeNdcY, 0.5).unproject(camera);
      rayDir.copy(rayPoint).sub(camera.position);
      const tHit =
        Math.abs(rayDir.z) > 1e-4 ? (crowdZ - camera.position.z) / rayDir.z : 1;
      const clipY = camera.position.y + rayDir.y * tHit;
      clipPlane.constant = -clipY;
      // Place spectators so their chest, waving arms, and heads cheer above the blue barricade
      resolvedBaseY = clipY - 0.64;

      // Span across the 7 blue RSUD AL-MULK barricade boards (within visible width)
      const dist = Math.max(1, camera.position.z - crowdZ);
      const persp = camera as THREE.PerspectiveCamera;
      const halfH = dist * Math.tan(((persp.fov || 44) * Math.PI) / 360);
      const visibleHalfW = halfH * aspect;
      // Boards span ~80% of the 2:1 image width; clamp neatly inside the green & blue flags
      const imgWidthScale = aspect < 2.0 ? 2.0 / aspect : 1;
      halfSpanX = Math.min(visibleHalfW * 0.78, visibleHalfW * imgWidthScale * 0.37);
    }

    let index = 0;
    const add = (
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      tint: string,
      rotation = 0,
    ) => {
      helper.position.set(x, y, z);
      helper.scale.set(sx, sy, sz);
      helper.rotation.set(0, 0, rotation);
      helper.updateMatrix();
      mesh.current!.setMatrixAt(index, helper.matrix);
      mesh.current!.setColorAt(index++, color.set(tint));
    };
    for (let i = 0; i < count; i++) {
      const x = -halfSpanX + (i / (count - 1)) * (halfSpanX * 2);
      const z = crowdZ - (i % 2) * (behindBarricade ? 0.22 : 0.3);
      const t = time.current * (excited ? 4.8 : 2.2) + i * 1.7;
      const bounce = Math.max(0, Math.sin(t)) * (excited ? 0.16 : 0.04);
      const sway = Math.sin(t * 0.55) * 0.035;
      const y = resolvedBaseY + bounce;
      const skin = skins[i % skins.length];
      const shirt = shirts[i % shirts.length];
      const hair = ['#3c2315', '#2d1b12', '#52311f', '#362117'][i % 4];
      const pants = i % 2 === 0 ? '#b28f5e' : '#364a5e';
      const s = (behindBarricade ? 1.04 : 1.1) + (i % 3) * 0.06;
      const body = (
        px: number,
        py: number,
        pz: number,
        sx: number,
        sy: number,
        sz: number,
        tint: string,
        rotation = 0,
      ) => add(x + (px + sway * py * 0.4) * s, y + py * s, z + pz * s, sx * s, sy * s, sz * s, tint, rotation);

      body(0, 0.63, 0, 0.24, 0.28, 0.165, shirt, sway * 0.5);
      body(0, 0.38, 0, 0.215, 0.14, 0.15, pants);
      for (const sign of [-1, 1]) {
        body(sign * 0.105, 0.21, 0, 0.08, 0.15, 0.088, pants);
        body(sign * 0.11, 0.075, 0.065, 0.118, 0.078, 0.175, '#e8d5a4');
      }
      body(0, 0.9, 0, 0.09, 0.09, 0.09, skin);
      body(0, 1.13, 0.015, 0.295, 0.285, 0.255, skin, -sway * 0.4);
      for (const sign of [-1, 1]) body(sign * 0.295, 1.105, 0.01, 0.056, 0.082, 0.046, skin);
      body(0, 1.32, -0.04, 0.31, 0.165, 0.24, hair);
      body(-0.12, 1.37, 0.085, 0.175, 0.11, 0.16, hair, -0.25);
      body(0.1, 1.365, 0.11, 0.17, 0.105, 0.155, hair, 0.25);
      if (i % 3 === 1) {
        body(-0.31, 1.15, -0.02, 0.095, 0.16, 0.095, hair, -0.2);
        body(0.31, 1.15, -0.02, 0.095, 0.16, 0.095, hair, 0.2);
      }
      const blink = Math.sin(time.current * 0.7 + i * 3.4) > 0.996 ? 0.12 : 1;
      for (const sign of [-1, 1]) {
        body(sign * 0.094, 1.15, 0.254, 0.031, 0.046 * blink, 0.02, '#18100c');
        body(sign * 0.094 - 0.008, 1.164, 0.268, 0.009, 0.01 * blink, 0.006, '#fffaf0');
        body(sign * 0.16, 1.055, 0.222, 0.048, 0.026, 0.01, '#df856f');
      }
      body(0, 1.095, 0.266, 0.042, 0.046, 0.045, '#e2886f');
      body(0, 1.005, 0.24, 0.052, excited ? 0.042 : 0.018, 0.016, '#5e2f21');
      for (const sign of [-1, 1]) {
        const clap = i % 3 === 0;
        const angle = clap
          ? -sign * (1.12 + Math.sin(t * 1.4) * 0.28)
          : sign * (2.05 + Math.sin(t) * 0.36);
        const shoulderX = sign * 0.215;
        const shoulderY = 0.79;
        const elbowX = shoulderX + Math.sin(angle) * 0.2;
        const elbowY = shoulderY - Math.cos(angle) * 0.2;
        const handX = clap
          ? sign * (0.055 + (1 + Math.sin(t * 1.4)) * 0.05)
          : elbowX + Math.sin(angle + sign * 0.25) * 0.2;
        const handY = clap ? 0.83 : elbowY - Math.cos(angle + sign * 0.25) * 0.2;
        const forward = clap ? 0.22 : 0.04;
        body(
          (shoulderX + elbowX) / 2,
          (shoulderY + elbowY) / 2,
          forward / 2,
          0.085,
          0.155,
          0.082,
          shirt,
          angle,
        );
        const forearmAngle = Math.atan2(handX - elbowX, -(handY - elbowY));
        body(
          (elbowX + handX) / 2,
          (elbowY + handY) / 2,
          forward,
          0.06,
          0.138,
          0.062,
          skin,
          forearmAngle,
        );
        body(handX, handY, forward + 0.01, 0.072, 0.078, 0.058, skin, angle * 0.4);
      }
    }
    mesh.current.count = index;
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, count * 42]}
      frustumCulled={false}
      castShadow={!low && !behindBarricade}
    >
      <sphereGeometry args={[1, low ? 12 : 18, low ? 10 : 14]} />
      <meshPhysicalMaterial
        roughness={0.44}
        metalness={0}
        clearcoat={0.28}
        clearcoatRoughness={0.32}
        sheen={0.35}
        sheenRoughness={0.55}
        clippingPlanes={behindBarricade ? [clipPlane] : undefined}
      />
    </instancedMesh>
  );
}
