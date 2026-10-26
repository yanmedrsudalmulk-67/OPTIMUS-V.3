'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Shared instanced shapes keep the animated audience inexpensive on phones. */
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
  const skins = ['#edbf9d', '#c78e65', '#ae7253', '#e3a57e'];
  const shirts = ['#eeaf4e', '#65b9ae', '#dd8797', '#77a7d6', '#f4d7a0', '#9a94ca'];
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
      const t = time.current * (excited ? 5.1 : 2.8) + i * 1.7;
      const bounce = Math.max(0, Math.sin(t)) * (excited ? 0.16 : 0.035);
      const y = baseHeight + bounce;
      const skin = skins[i % skins.length];
      const shirt = shirts[i % shirts.length];
      const hair = ['#51342a', '#322a25', '#785135', '#b4783e'][i % 4];
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
      ) => add(x + px * s, y + py * s, z + pz * s, sx * s, sy * s, sz * s, tint, rotation);
      body(0, 0.64, 0, 0.225, 0.29, 0.15, shirt);
      body(0, 0.37, 0, 0.2, 0.135, 0.14, '#556c7d');
      for (const sign of [-1, 1]) {
        body(sign * 0.105, 0.21, 0, 0.073, 0.15, 0.085, '#556c7d');
        body(sign * 0.11, 0.075, 0.065, 0.11, 0.075, 0.16, i % 2 ? '#f6eddb' : '#537e87');
      }
      body(0, 0.9, 0, 0.095, 0.1, 0.095, skin);
      body(0, 1.12, 0.015, 0.275, 0.285, 0.245, skin);
      for (const sign of [-1, 1]) body(sign * 0.273, 1.115, 0.015, 0.052, 0.08, 0.045, skin);
      body(0, 1.3, -0.055, 0.282, 0.135, 0.215, hair);
      body(-0.115, 1.345, 0.07, 0.17, 0.09, 0.15, hair, -0.3);
      body(0.09, 1.34, 0.1, 0.16, 0.08, 0.14, hair, 0.3);
      if (i % 3 === 1) {
        body(-0.31, 1.16, -0.03, 0.1, 0.15, 0.09, hair, -0.3);
        body(0.31, 1.16, -0.03, 0.1, 0.15, 0.09, hair, 0.3);
      }
      const blink = Math.sin(time.current * 0.7 + i * 3.4) > 0.996 ? 0.12 : 1;
      for (const sign of [-1, 1]) {
        body(sign * 0.104, 1.15, 0.231, 0.077, 0.085 * blink, 0.027, '#fff9ef');
        body(sign * 0.105, 1.147, 0.255, 0.041, 0.054 * blink, 0.018, '#624330');
        body(sign * 0.105, 1.148, 0.271, 0.024, 0.036 * blink, 0.01, '#231f20');
        body(sign * 0.105 - 0.012, 1.17, 0.281, 0.011, 0.014 * blink, 0.007, '#ffffff');
        body(sign * 0.16, 1.02, 0.208, 0.045, 0.025, 0.01, '#dc9384');
      }
      body(0, 1.07, 0.253, 0.045, 0.04, 0.045, skin);
      body(0, 0.982, 0.225, 0.067, excited ? 0.045 : 0.025, 0.016, '#944f40');
      body(0, 0.997, 0.239, 0.045, 0.012, 0.007, '#fff4de');
      for (const sign of [-1, 1]) {
        const clap = i % 3 === 0;
        const angle = clap
          ? -sign * (1.12 + Math.sin(t * 1.4) * 0.3)
          : sign * (2.05 + Math.sin(t) * 0.4);
        const shoulderX = sign * 0.21;
        const shoulderY = 0.79;
        const elbowX = shoulderX + Math.sin(angle) * 0.21;
        const elbowY = shoulderY - Math.cos(angle) * 0.21;
        const handX = clap
          ? sign * (0.055 + (1 + Math.sin(t * 1.4)) * 0.05)
          : elbowX + Math.sin(angle + sign * 0.25) * 0.21;
        const handY = clap ? 0.83 : elbowY - Math.cos(angle + sign * 0.25) * 0.21;
        const forward = clap ? 0.22 : 0.04;
        body(
          (shoulderX + elbowX) / 2,
          (shoulderY + elbowY) / 2,
          forward / 2,
          0.083,
          0.16,
          0.08,
          shirt,
          angle,
        );
        const forearmAngle = Math.atan2(handX - elbowX, -(handY - elbowY));
        body(
          (elbowX + handX) / 2,
          (elbowY + handY) / 2,
          forward,
          0.057,
          0.14,
          0.06,
          skin,
          forearmAngle,
        );
        body(handX, handY, forward + 0.01, 0.075, 0.082, 0.06, skin, angle * 0.4);
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
      <sphereGeometry args={[1, low ? 10 : 12, low ? 8 : 10]} />
      <meshStandardMaterial roughness={0.63} metalness={0} />
    </instancedMesh>
  );
}
