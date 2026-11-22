'use client';

import { useEffect, useMemo } from 'react';
import Crowd from './Crowd';
import HospitalBuilding from './HospitalBuilding';
import PapercraftTree from './PapercraftTree';
import * as THREE from 'three';
import type { Quality } from '../../../../packages/shared/src';
import { getArenaLayoutConfig, type ArenaThemeId } from '../../lib/arenaLayout';

function Box({
  position,
  size,
  color,
  rotation = [0, 0, 0],
  shadow = true,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  rotation?: [number, number, number];
  shadow?: boolean;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow={shadow} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}

function Tree({
  position,
  scale = 1,
  type = 'round',
}: {
  position: [number, number, number];
  scale?: number;
  type?: 'round' | 'pine';
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.19, 1.5, 7]} />
        <meshStandardMaterial color="#967249" />
      </mesh>
      {type === 'pine' ? (
        <>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 1.15 + i * 0.55, 0]} castShadow>
              <coneGeometry args={[1 - i * 0.2, 1.6, 8]} />
              <meshStandardMaterial color={['#497f65', '#569273', '#6ba082'][i]} />
            </mesh>
          ))}
        </>
      ) : (
        <>
          {[
            [0, 2.1, 0, 0.9],
            [-0.6, 1.8, 0, 0.65],
            [0.6, 1.9, 0.15, 0.7],
            [0, 2.65, 0, 0.62],
          ].map((p, i) => (
            <mesh key={i} position={[p[0], p[1], p[2]]} castShadow>
              <icosahedronGeometry args={[p[3], 2]} />
              <meshStandardMaterial
                color={['#68a474', '#82b17b', '#92bc79', '#a3c67c'][i]}
                roughness={0.9}
              />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

function Flag({ position, team }: { position: [number, number, number]; team: 'A' | 'B' }) {
  const color = team === 'A' ? '#128d73' : '#416fce';
  return (
    <group position={position}>
      <mesh position={[0, 1.35, 0]} castShadow>
        <cylinderGeometry args={[0.033, 0.04, 2.7, 8]} />
        <meshStandardMaterial color="#e4e7d3" metalness={0.4} />
      </mesh>
      <Box position={[0.37, 2.32, 0]} size={[0.72, 0.47, 0.032]} color={color} />
      <Box position={[0.37, 2.32, 0.022]} size={[0.06, 0.23, 0.012]} color="#f3f4df" />
      <Box position={[0.37, 2.32, 0.023]} size={[0.23, 0.06, 0.013]} color="#f3f4df" />
      <mesh position={[0, 2.75, 0]}>
        <sphereGeometry args={[0.075, 8, 8]} />
        <meshStandardMaterial color="#e7b846" />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.22, 0.3, 0.08, 10]} />
        <meshStandardMaterial color="#b3bdab" />
      </mesh>
    </group>
  );
}

function Festival() {
  const cordGeometry = useMemo(
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(
          Array.from(
            { length: 16 },
            (_, i) =>
              new THREE.Vector3(-6.7 + i * 0.9, 3.7 - Math.sin((i / 15) * Math.PI) * 0.52, -4.8),
          ),
        ),
        48,
        0.012,
        5,
        false,
      ),
    [],
  );
  useEffect(() => () => cordGeometry.dispose(), [cordGeometry]);
  const flagGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-0.2, 0, 0, 0, -0.39, 0, 0.2, 0, 0], 3),
    );
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  useEffect(() => () => flagGeometry.dispose(), [flagGeometry]);
  return (
    <group>
      <mesh geometry={cordGeometry}>
        <meshStandardMaterial color="#9b8367" />
      </mesh>
      <Box position={[0, 0.12, -3.62]} size={[14.1, 0.24, 1.55]} color="#c5b28c" />
      <Box position={[0, 0.28, -3.66]} size={[13.8, 0.14, 1.25]} color="#e5d8b9" />
      {[-1, 1].map((sign) => (
        <group key={sign} position={[sign * 7.15, 0, -4.8]}>
          <Box position={[0, 1.9, 0]} size={[0.07, 3.8, 0.07]} color="#af9571" />
          {[0, 1, 2].map((i) => (
            <group key={i} position={[(i - 1) * 0.22, 0.15 + i * 0.1, 0]}>
              <mesh position={[0, 3.6 + i * 0.16, 0]} scale={[0.24, 0.31, 0.24]} castShadow>
                <sphereGeometry args={[1, 16, 12]} />
                <meshStandardMaterial
                  color={['#e4b852', '#83b9bf', '#df8d85'][i]}
                  roughness={0.34}
                />
              </mesh>
              <Box
                position={[0, 3.08 + i * 0.1, 0]}
                size={[0.012, 0.68, 0.012]}
                color="#eee3c9"
                shadow={false}
              />
            </group>
          ))}
        </group>
      ))}
      {Array.from({ length: 16 }, (_, i) => {
        const x = -6.7 + i * 0.9;
        const y = 3.7 - Math.sin((i / 15) * Math.PI) * 0.52;
        return (
          <mesh
            key={i}
            geometry={flagGeometry}
            position={[x, y, -4.8]}
            rotation={[0, 0, Math.cos(i) * 0.08]}
          >
            <meshStandardMaterial
              color={['#60a68f', '#dfad58', '#749fc6', '#dc8e87'][i % 4]}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function Ambulance() {
  return (
    <group position={[7.0, 0, -5.0]} rotation={[0, -0.48, 0]} scale={0.85}>
      <Box position={[0, 0.83, 0]} size={[2.3, 1.1, 1.17]} color="#f6f4e6" />
      <Box position={[1.15, 0.57, 0]} size={[0.45, 0.65, 1.13]} color="#f2f0e3" />
      <Box position={[0.75, 1.07, 0.6]} size={[0.63, 0.47, 0.025]} color="#7aaab1" />
      <Box position={[1.15, 0.98, 0]} size={[0.03, 0.52, 1.02]} color="#84aeb2" />
      <Box position={[-0.1, 0.56, 0.602]} size={[2, 0.14, 0.018]} color="#dc7b34" />
      <Box position={[-0.5, 1, 0.603]} size={[0.12, 0.43, 0.02]} color="#2871a5" />
      <Box position={[-0.5, 1, 0.604]} size={[0.43, 0.12, 0.022]} color="#2871a5" />
      <Box position={[0.35, 1.43, 0]} size={[0.65, 0.13, 0.32]} color="#ce3e31" />
      <Box position={[1.4, 0.53, 0.4]} size={[0.04, 0.17, 0.22]} color="#f6d982" />
      {[-0.65, 0.86].flatMap((x) =>
        [-0.59, 0.59].map((z) => (
          <group key={`${x}${z}`} position={[x, 0.28, z]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.27, 0.27, 0.16, 12]} />
              <meshStandardMaterial color="#34454a" />
            </mesh>
            <mesh position={[0, 0.095, 0]}>
              <cylinderGeometry args={[0.13, 0.13, 0.04, 10]} />
              <meshStandardMaterial color="#c4d0cf" metalness={0.5} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}

function Grass() {
  const positions = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => {
        const x = Math.sin(i * 28.9) * 9.4;
        const z = Math.cos(i * 19.7) * 4.1;
        return [x, 0, z] as [number, number, number];
      }),
    [],
  );
  return (
    <group>
      {positions
        .filter((p) => Math.abs(p[2]) > 1.4)
        .map((p, i) => (
          <mesh key={i} position={[p[0], 0.1, p[2]]} rotation={[0, i, 0]}>
            <coneGeometry args={[0.045, 0.22, 3]} />
            <meshStandardMaterial color={i % 2 ? '#8cab66' : '#79a066'} />
          </mesh>
        ))}
    </group>
  );
}

export default function Environment({
  theme = 'hospital',
  quality = 'AUTO',
  phase,
  paused = false,
}: {
  theme?: ArenaThemeId;
  quality?: Quality;
  phase?: string;
  paused?: boolean;
}) {
  const layout = getArenaLayoutConfig(theme);
  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[28, 18]} />
        <shadowMaterial transparent opacity={0.28} />
      </mesh>
      {layout.crowd.enabled && (
        <Crowd
          low={quality === 'LOW'}
          phase={phase}
          paused={paused}
          mode={layout.crowd.mode}
          imgAspect={layout.imgAspect}
          anchorImgFrac={layout.crowd.anchorImgFrac}
          crowdZ={layout.crowd.crowdZ}
          scaleBase={layout.crowd.scaleBase}
          spanRatio={layout.crowd.spanRatio}
          beachPalette={theme === 'beach'}
        />
      )}
    </group>
  );
}
