'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { Quality } from '../../../../packages/shared/src';

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

function Hospital() {
  return (
    <group position={[0, 0, -6]}>
      <Box position={[0, 1.7, 0]} size={[6.7, 3.4, 1.8]} color="#f4f1e4" />
      <Box position={[0, 3.42, 0]} size={[6.95, 0.19, 2.03]} color="#d0dfd8" />
      <Box position={[0, 0.2, 0.11]} size={[7.2, 0.4, 2.04]} color="#c8d6cc" />
      <Box position={[0, 1.98, 0.94]} size={[1.9, 3.55, 0.35]} color="#e0e8dc" />
      <Box position={[0, 3.8, 0.83]} size={[2.15, 0.18, 0.8]} color="#f3f1e6" />
      <Box position={[0, 3, 1.14]} size={[1.17, 1.17, 0.08]} color="#168f78" />
      <Box position={[0, 3, 1.2]} size={[0.19, 0.67, 0.04]} color="#fff8e5" />
      <Box position={[0, 3, 1.2]} size={[0.67, 0.19, 0.04]} color="#fff8e5" />
      <Box position={[0, 0.91, 1.04]} size={[1.1, 1.42, 0.08]} color="#578c92" />
      <Box position={[0, 0.91, 1.09]} size={[0.045, 1.42, 0.04]} color="#e2e9dd" />
      <Box position={[0, 1.73, 1.24]} size={[1.65, 0.18, 0.7]} color="#1c9d83" />
      {[-2.6, -1.6, 1.6, 2.6].map((x, i) => (
        <group key={i}>
          {[1.1, 2.35].map((y) => (
            <group key={y}>
              <Box position={[x, y, 0.918]} size={[0.67, 0.79, 0.04]} color="#91bec2" />
              <Box position={[x, y + 0.04, 0.947]} size={[0.035, 0.71, 0.025]} color="#e7f0e7" />
              <Box position={[x, y - 0.07, 0.947]} size={[0.61, 0.035, 0.025]} color="#e7f0e7" />
              <Box position={[x, y - 0.44, 0.96]} size={[0.8, 0.1, 0.16]} color="#d4dfd2" />
            </group>
          ))}
        </group>
      ))}
      <Box position={[0, 0.025, 2]} size={[2.2, 0.05, 2]} color="#e4dfca" />
    </group>
  );
}

function Ambulance() {
  return (
    <group position={[6.1, 0, -4.7]} rotation={[0, -0.48, 0]} scale={0.85}>
      <Box position={[0, 0.83, 0]} size={[2.3, 1.1, 1.17]} color="#f6f4e6" />
      <Box position={[1.15, 0.57, 0]} size={[0.45, 0.65, 1.13]} color="#f2f0e3" />
      <Box position={[0.75, 1.07, 0.6]} size={[0.63, 0.47, 0.025]} color="#7aaab1" />
      <Box position={[1.15, 0.98, 0]} size={[0.03, 0.52, 1.02]} color="#84aeb2" />
      <Box position={[-0.1, 0.56, 0.602]} size={[2, 0.14, 0.018]} color="#259a83" />
      <Box position={[-0.5, 1, 0.603]} size={[0.12, 0.43, 0.02]} color="#26967f" />
      <Box position={[-0.5, 1, 0.604]} size={[0.43, 0.12, 0.022]} color="#26967f" />
      <Box position={[0.35, 1.43, 0]} size={[0.65, 0.13, 0.32]} color="#416fce" />
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

function Spectator({
  position,
  color,
  index,
}: {
  position: [number, number, number];
  color: string;
  index: number;
}) {
  return (
    <group position={position} scale={0.62}>
      <mesh position={[0, 0.57, 0]} castShadow>
        <capsuleGeometry args={[0.18, 0.34, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.07, 0.015]} castShadow>
        <sphereGeometry args={[0.24, 10, 8]} />
        <meshStandardMaterial color={index % 2 ? '#d3a077' : '#ad7959'} />
      </mesh>
      <mesh position={[0, 1.21, -0.025]}>
        <sphereGeometry args={[0.245, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color="#4b3728" />
      </mesh>
      {[-1, 1].map((sign) => (
        <group key={sign}>
          <mesh position={[sign * 0.1, 0.19, 0]}>
            <capsuleGeometry args={[0.067, 0.22, 3, 6]} />
            <meshStandardMaterial color="#455c60" />
          </mesh>
          <mesh
            position={[sign * 0.23, 0.65, 0.04]}
            rotation={[0, 0, sign * (index % 2 ? 0.8 : -0.3)]}
          >
            <capsuleGeometry args={[0.06, 0.26, 3, 6]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[sign * 0.085, 1.09, 0.218]}>
            <sphereGeometry args={[0.022, 6, 6]} />
            <meshStandardMaterial color="#2e3837" />
          </mesh>
        </group>
      ))}
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
}: {
  theme?: 'hospital' | 'fantasy';
  quality?: Quality;
}) {
  const fantasy = theme === 'fantasy';
  return (
    <group>
      <mesh position={[0, -0.29, 0]} receiveShadow>
        <cylinderGeometry args={[11.4, 11.7, 0.55, 64]} />
        <meshStandardMaterial color={fantasy ? '#84977d' : '#a8bd7d'} roughness={1} />
      </mesh>
      <mesh position={[0, -0.58, 0]}>
        <cylinderGeometry args={[11.65, 11.0, 0.16, 64]} />
        <meshStandardMaterial color="#708b69" roughness={1} />
      </mesh>
      <mesh position={[0, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14.2, 2.7]} />
        <meshStandardMaterial color={fantasy ? '#ccbfa0' : '#d9d0ad'} roughness={1} />
      </mesh>
      <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.055, 3.1]} />
        <meshStandardMaterial color="#fff8df" />
      </mesh>
      {[-7.4, 7.4].map((x) => (
        <mesh key={x} position={[x, 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.07, 2.7]} />
          <meshStandardMaterial color="#f3ecd1" />
        </mesh>
      ))}
      {fantasy ? (
        <>
          <group position={[0, 0, -6.8]}>
            {[-3.1, 0, 3.1].map((x, i) => (
              <group key={i}>
                <Box position={[x, 1.3, 0]} size={[1.7, 2.6, 1.7]} color="#a8b2a4" />
                <mesh position={[x, 3.1, 0]} castShadow>
                  <coneGeometry args={[1.3, 1.45, 4]} />
                  <meshStandardMaterial color={i % 2 ? '#50897b' : '#557c97'} />
                </mesh>
                <Box position={[x, 1.8, 0.87]} size={[0.42, 0.62, 0.04]} color="#485d5a" />
              </group>
            ))}
            <Box position={[0, 0.7, 0]} size={[7, 1.4, 0.8]} color="#9ca899" />
          </group>
          {[
            [-7.7, 0, -4],
            [8.4, 0, -2.8],
            [-6, 0, 4],
            [6, 0, 4],
          ].map((p, i) => (
            <Tree
              key={i}
              position={p as [number, number, number]}
              scale={i > 1 ? 0.8 : 1.25}
              type="pine"
            />
          ))}
        </>
      ) : (
        <>
          <Hospital />
          <Ambulance />
          <Tree position={[-6.6, 0, -5.3]} scale={1.4} />
          <Tree position={[8.3, 0, -2.4]} scale={1.15} />
          <Tree position={[-8.2, 0, -0.3]} scale={1.05} />
          <Tree position={[-7.2, 0, 3.8]} scale={0.65} />
          <Tree position={[7.7, 0, 3.4]} scale={0.62} />
        </>
      )}
      <Flag position={[-8.3, 0, 1.5]} team="A" />
      <Flag position={[8.3, 0, 1.5]} team="B" />
      {Array.from({ length: 10 }, (_, i) => (
        <Spectator
          key={i}
          index={i}
          color={['#eeeede', '#7caf9c', '#7c9eb8', '#deb392', '#d2a1ad'][i % 5]}
          position={[-5.8 + i * 1.28, 0, -2.8 - (i % 2) * 0.15]}
        />
      ))}
      {[
        [-8.8, 0, -2.8],
        [9, 0, 1.6],
        [-4, 0, 4],
        [5.6, 0, 3.4],
        [-8.3, 0, 3],
      ].map((p, i) => (
        <mesh
          key={i}
          position={[p[0], 0.18, p[2]]}
          scale={[0.7, 0.4, 0.5]}
          rotation={[0.15, i, 0.12]}
          castShadow
        >
          <dodecahedronGeometry args={[0.62, 0]} />
          <meshStandardMaterial color={i % 2 ? '#acb49c' : '#a1ad98'} roughness={1} />
        </mesh>
      ))}
      {quality !== 'LOW' && <Grass />}
      {[-1, 1].map((sign) => (
        <group key={sign} position={[sign * 8.8, 0.2, -5.5]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[i * 0.4, 0.12, 0]} scale={[0.5, 0.35, 0.45]} castShadow>
              <icosahedronGeometry args={[0.55, 1]} />
              <meshStandardMaterial color={i % 2 ? '#8aad73' : '#719e71'} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
