'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Shared instanced shapes keep the animated audience inexpensive on phones while matching the soft-vinyl aesthetic. */
export default function Crowd({
  low,
  phase,
  paused = false,
  baseHeight = 0.37,
}: {
  low: boolean;
  phase?: string;
  paused?: boolean;
  baseHeight?: number;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const time = useRef(0);
  const count = low ? 8 : 14;
  const helper = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const excited = ['COUNTDOWN', 'PULL_ANIMATION', 'ROUND_RESULT', 'FINISHED'].includes(phase || '');
  const skins = ['#f0af86', '#e39e74', '#d88e64', '#eab28d'];
  const shirts = ['#5a733b', '#478db7', '#cf7b98', '#3f8c71', '#d16640', '#6961a6'];
  useFrame((_, delta) => {
    if (!mesh.current) return;
    if (!paused) time.current += Math.min(delta, 0.05);
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
      const x = -6.35 + (i / (count - 1)) * 12.7;
      const z = -3.5 - (i % 2) * 0.3;
      const t = time.current * (excited ? 4.8 : 2.2) + i * 1.7;
      const bounce = Math.max(0, Math.sin(t)) * (excited ? 0.15 : 0.03);
      const sway = Math.sin(t * 0.55) * 0.035;
      const y = baseHeight + bounce;
      const skin = skins[i % skins.length];
      const shirt = shirts[i % shirts.length];
      const hair = ['#3c2315', '#2d1b12', '#52311f', '#362117'][i % 4];
      const pants = i % 2 === 0 ? '#b28f5e' : '#364a5e';
      const s = 1.1 + (i % 3) * 0.07;
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
      body(0, 1.31, -0.045, 0.3, 0.15, 0.23, hair);
      body(-0.115, 1.36, 0.08, 0.16, 0.095, 0.15, hair, -0.25);
      body(0.095, 1.355, 0.105, 0.155, 0.09, 0.145, hair, 0.25);
      if (i % 3 === 1) {
        body(-0.31, 1.15, -0.02, 0.095, 0.16, 0.095, hair, -0.2);
        body(0.31, 1.15, -0.02, 0.095, 0.16, 0.095, hair, 0.2);
      }
      const blink = Math.sin(time.current * 0.7 + i * 3.4) > 0.996 ? 0.12 : 1;
      for (const sign of [-1, 1]) {
        body(sign * 0.092, 1.148, 0.252, 0.024, 0.036 * blink, 0.018, '#18100c');
        body(sign * 0.092 - 0.007, 1.16, 0.266, 0.007, 0.008 * blink, 0.005, '#fffaf0');
        body(sign * 0.16, 1.055, 0.222, 0.044, 0.024, 0.01, '#df856f');
      }
      body(0, 1.095, 0.264, 0.038, 0.042, 0.042, '#e2886f');
      body(0, 1.005, 0.238, 0.045, excited ? 0.036 : 0.012, 0.014, '#5e2f21');
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
      castShadow={!low}
    >
      <sphereGeometry args={[1, low ? 10 : 14, low ? 8 : 12]} />
      <meshStandardMaterial roughness={0.78} metalness={0} />
    </instancedMesh>
  );
}
