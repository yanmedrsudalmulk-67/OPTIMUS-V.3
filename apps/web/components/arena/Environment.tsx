'use client';

import { useEffect, useMemo } from 'react';
import Crowd from './Crowd';
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

function Sign({
  text,
  subtitle,
  position,
  width = 3.4,
}: {
  text: string;
  subtitle?: string;
  position: [number, number, number];
  width?: number;
}) {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fff9e9';
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = '#176c62';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 86px sans-serif';
    ctx.fillText(text, 512, subtitle ? 100 : 132, 960);
    if (subtitle) {
      ctx.font = 'bold 37px sans-serif';
      ctx.fillStyle = '#6c8e85';
      ctx.fillText(subtitle, 512, 190, 950);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, [text, subtitle]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return (
    <group position={position}>
      <Box position={[0, 0, -0.03]} size={[width + 0.12, width / 4 + 0.1, 0.15]} color="#548f82" />
      <mesh position={[0, 0, 0.052]}>
        <planeGeometry args={[width, width / 4]} />
        <meshBasicMaterial
          map={texture}
          color={texture ? '#ffffff' : '#fff9e9'}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Hospital() {
  return (
    <group position={[0, 0, -7.1]}>
      <Box position={[0, 1.9, 0]} size={[9.1, 3.8, 1.9]} color="#f5eedd" />
      <Box position={[0, 3.82, 0]} size={[9.35, 0.22, 2.14]} color="#8fbeb3" />
      <Box position={[0, 0.2, 0.1]} size={[9.5, 0.4, 2.16]} color="#c0cec3" />
      <Box position={[0, 2.25, 0.65]} size={[2.6, 4.5, 1.16]} color="#fff8e9" />
      <Box position={[0, 4.53, 0.65]} size={[2.9, 0.18, 1.42]} color="#6aab9c" />
      <Box position={[0, 4.98, 0.67]} size={[0.85, 0.85, 0.2]} color="#258b76" />
      <Box position={[0, 4.98, 0.79]} size={[0.19, 0.6, 0.04]} color="#fff8e5" />
      <Box position={[0, 4.98, 0.79]} size={[0.6, 0.19, 0.04]} color="#fff8e5" />
      <Sign
        text="RUMAH SAKIT"
        subtitle="HEALTHCARE HEROES"
        position={[0, 3.86, 1.27]}
        width={3.35}
      />
      <Box position={[0, 1.07, 1.27]} size={[1.55, 1.72, 0.09]} color="#79afb1" />
      <Box position={[0, 1.07, 1.33]} size={[0.045, 1.72, 0.04]} color="#fff8e8" />
      {[-0.17, 0.17].map((x) => (
        <Box key={x} position={[x, 1.02, 1.37]} size={[0.035, 0.35, 0.03]} color="#ebc475" />
      ))}
      <Box position={[0, 2.11, 1.5]} size={[2.55, 0.21, 1.03]} color="#459d89" />
      <Box position={[0, 2.34, 1.28]} size={[1.75, 0.11, 0.05]} color="#e9b767" />
      {[-3.73, -2.62, 2.62, 3.73].map((x) => (
        <group key={x}>
          {[1.2, 2.66].map((y) => (
            <group key={y}>
              <Box position={[x, y, 0.976]} size={[0.8, 0.95, 0.07]} color="#6c9fa6" />
              <Box
                position={[x + 0.1, y + 0.14, 1.02]}
                size={[0.55, 0.58, 0.015]}
                color="#b3d3cd"
                shadow={false}
              />
              <Box position={[x, y + 0.04, 1.036]} size={[0.045, 0.91, 0.03]} color="#f5f3dd" />
              <Box position={[x, y - 0.1, 1.036]} size={[0.75, 0.045, 0.03]} color="#f5f3dd" />
              <Box position={[x, y - 0.52, 1.07]} size={[0.97, 0.11, 0.2]} color="#d7d6b9" />
            </group>
          ))}
        </group>
      ))}
      <Box position={[0, 0.025, 2]} size={[2.8, 0.05, 2.8]} color="#e4dfca" />
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
  theme?: 'hospital' | 'fantasy';
  quality?: Quality;
  phase?: string;
  paused?: boolean;
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
          <Festival />
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
      <Crowd
        low={quality === 'LOW'}
        phase={phase}
        paused={paused}
        baseHeight={fantasy ? 0 : 0.37}
      />
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
