'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CHARACTERS, type Team } from '../../../../packages/shared/src';

export type CharacterMotion =
  'idle' | 'ready' | 'pulling' | 'struggling' | 'sliding' | 'falling' | 'victory' | 'defeat';
export interface CharacterProps {
  characterId: string;
  team?: Team;
  motion?: CharacterMotion;
  facing?: number;
  position?: [number, number, number];
  scale?: number;
  seed?: number;
  holdRope?: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);
const skinTones = [
  '#c98e65',
  '#e2ad84',
  '#a46d50',
  '#d8a17d',
  '#bd815b',
  '#e0ab7b',
  '#b97c56',
  '#d49a6a',
];

function Cross({ color = '#148f78', size = 0.1 }: { color?: string; size?: number }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[size * 0.35, size, 0.013]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh>
        <boxGeometry args={[size, size * 0.35, 0.014]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function Tube({
  points,
  color = '#35494d',
  radius = 0.018,
}: {
  points: [number, number, number][];
  color?: string;
  radius?: number;
}) {
  const pointKey = JSON.stringify(points);
  const geometry = useMemo(() => {
    const coordinates = JSON.parse(pointKey) as [number, number, number][];
    return new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(coordinates.map((p) => new THREE.Vector3(...p))),
      24,
      radius,
      6,
      false,
    );
  }, [pointKey, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
  );
}

/** Four broad, tapered locks form a continuous swept quiff; thin ridges catch
 * the key light. Geometry is merged so hair adds only two draw calls per actor. */
function SweptHair({ color }: { color: string }) {
  const shapes = useMemo(() => {
    const locks: THREE.BufferGeometry[] = [];
    const ridges: THREE.BufferGeometry[] = [];
    const paths: [number, number, number][][] = [
      [
        [-0.4, 0.22, 0.06],
        [-0.43, 0.4, 0.2],
        [-0.12, 0.58, 0.23],
        [0.23, 0.51, -0.04],
      ],
      [
        [-0.34, 0.29, 0.28],
        [-0.32, 0.46, 0.35],
        [0.04, 0.62, 0.28],
        [0.31, 0.51, 0.07],
      ],
      [
        [-0.17, 0.32, 0.34],
        [-0.09, 0.43, 0.4],
        [0.18, 0.57, 0.3],
        [0.34, 0.44, 0.1],
      ],
      [
        [0.18, 0.27, 0.26],
        [0.35, 0.35, 0.29],
        [0.32, 0.51, 0.14],
        [0.16, 0.53, -0.09],
      ],
    ];
    paths.forEach((points, i) => {
      const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
      const lock = new THREE.TubeGeometry(curve, 24, [0.13, 0.135, 0.115, 0.11][i], 10, false);
      const positions = lock.attributes.position;
      for (let ring = 0; ring <= 24; ring++) {
        const center = curve.getPointAt(ring / 24);
        const taper = 0.1 + Math.pow(Math.sin((ring / 24) * Math.PI), 0.55) * 0.9;
        for (let j = 0; j <= 10; j++) {
          const n = ring * 11 + j;
          positions.setXYZ(
            n,
            center.x + (positions.getX(n) - center.x) * taper,
            center.y + (positions.getY(n) - center.y) * taper,
            center.z + (positions.getZ(n) - center.z) * taper,
          );
        }
      }
      lock.computeVertexNormals();
      locks.push(lock);
      for (let strand = 0; strand < 2; strand++) {
        const curve = new THREE.CatmullRomCurve3(
          points.map(
            (p, j) =>
              new THREE.Vector3(
                p[0] + (strand - 0.5) * 0.028,
                p[1] + (j === 1 || j === 2 ? 0.045 : 0.008),
                p[2] + (j === 1 || j === 2 ? 0.098 : 0.012),
              ),
          ),
        );
        ridges.push(new THREE.TubeGeometry(curve, 20, 0.0045, 4, false));
      }
    });
    const body = mergeGeometries(locks)!;
    const detail = mergeGeometries(ridges)!;
    [...locks, ...ridges].forEach((geometry) => geometry.dispose());
    return { body, detail };
  }, []);
  useEffect(
    () => () => {
      shapes.body.dispose();
      shapes.detail.dispose();
    },
    [shapes],
  );
  return (
    <group>
      <mesh geometry={shapes.body} castShadow>
        <meshStandardMaterial color={color} roughness={0.43} />
      </mesh>
      <mesh geometry={shapes.detail}>
        <meshStandardMaterial color="#765137" roughness={0.5} />
      </mesh>
    </group>
  );
}

function CoatPanels({ color }: { color: string }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0.105, 0.75);
    shape.quadraticCurveTo(0.28, 0.8, 0.36, 0.59);
    shape.lineTo(0.35, 0.26);
    shape.lineTo(0.4, -0.23);
    shape.quadraticCurveTo(0.28, -0.28, 0.12, -0.22);
    shape.lineTo(0.13, 0.35);
    shape.lineTo(0.105, 0.75);
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelSize: 0.022,
      bevelThickness: 0.022,
      bevelSegments: 3,
      steps: 1,
      curveSegments: 10,
    });
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group position={[0, 0, 0.19]}>
      {[-1, 1].map((sign) => (
        <mesh key={sign} scale={[sign, 1, 1]} geometry={geometry} castShadow>
          <meshStandardMaterial color={color} roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
function Necktie({ color }: { color: string }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.027, 0.67);
    shape.lineTo(-0.05, 0.39);
    shape.lineTo(0, 0.335);
    shape.lineTo(0.05, 0.39);
    shape.lineTo(0.027, 0.67);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group position={[0, 0, 0.313]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={color} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.69, 0]} rotation={[0, 0, Math.PI / 4]} scale={[0.75, 1, 0.5]}>
        <boxGeometry args={[0.065, 0.065, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    </group>
  );
}

function Segment({
  start,
  end,
  radius,
  color,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius: number;
  color: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const direction = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    if (!ref.current) return;
    direction.copy(end).sub(start);
    ref.current.position.copy(start).add(end).multiplyScalar(0.5);
    const length = direction.length();
    ref.current.quaternion.setFromUnitVectors(UP, direction.normalize());
    ref.current.scale.set(1, length, 1);
  });
  return (
    <mesh ref={ref} castShadow>
      <capsuleGeometry args={[radius, 1 - radius * 2, 5, 16]} />
      <meshStandardMaterial color={color} roughness={0.62} />
    </mesh>
  );
}

/** Articulated, original procedural model. The stable grip targets are independent
 * of the animated chest so the hands remain on the rope during a pull. */
export default function Character({
  characterId,
  team = 'A',
  motion = 'idle',
  facing = 0,
  position = [0, 0, 0],
  scale = 1,
  seed = 0,
  holdRope = false,
}: CharacterProps) {
  const index = Math.max(
    0,
    CHARACTERS.findIndex((c) => c.id === characterId),
  );
  const definition = CHARACTERS[index];
  const skin = skinTones[index];
  const female = ['doctor-f', 'nurse-f', 'midwife'].includes(characterId);
  const doctor =
    characterId.startsWith('doctor') || characterId === 'pharmacist' || characterId === 'analyst';
  const ambulance = characterId === 'ambulance';
  const teamColor = team === 'A' ? '#168f78' : '#4377d8';
  const uniform = ambulance
    ? '#183b48'
    : doctor
      ? '#f7f0df'
      : characterId === 'midwife'
        ? '#f3e8e9'
        : '#e9f0ea';
  const hair = index % 3 === 0 ? '#493224' : index % 3 === 1 ? '#352824' : '#62402a';
  const root = useRef<THREE.Group>(null),
    chest = useRef<THREE.Group>(null),
    head = useRef<THREE.Group>(null),
    eyes = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null),
    legR = useRef<THREE.Group>(null),
    brows = useRef<THREE.Group>(null);
  const handL = useRef<THREE.Mesh>(null),
    handR = useRef<THREE.Mesh>(null),
    sweat = useRef<THREE.Mesh>(null);
  const left = useMemo(
    () => ({
      shoulder: new THREE.Vector3(-0.4, 1.5, 0),
      elbow: new THREE.Vector3(-0.49, 1.19, 0.34),
      hand: new THREE.Vector3(-0.12, 1.05, 0.67),
    }),
    [],
  );
  const right = useMemo(
    () => ({
      shoulder: new THREE.Vector3(0.4, 1.5, 0),
      elbow: new THREE.Vector3(0.49, 1.19, 0.34),
      hand: new THREE.Vector3(0.12, 1.05, 0.67),
    }),
    [],
  );
  const smilePoints = useMemo<[number, number, number][]>(
    () => [
      [-0.145, -0.17, 0.363],
      [-0.07, -0.21, 0.38],
      [0.07, -0.21, 0.38],
      [0.145, -0.17, 0.363],
    ],
    [],
  );
  const stethoscopePoints = useMemo<[number, number, number][]>(
    () => [
      [-0.18, 0.83, 0.24],
      [-0.25, 0.61, 0.3],
      [-0.2, 0.38, 0.32],
      [0, 0.32, 0.35],
      [0.19, 0.4, 0.32],
      [0.22, 0.65, 0.29],
      [0.16, 0.83, 0.24],
    ],
    [],
  );

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime + seed * 2.4;
    const pulling = motion === 'pulling' || motion === 'struggling' || motion === 'sliding';
    const victory = motion === 'victory';
    const falling = motion === 'falling' || motion === 'defeat';
    const effort =
      motion === 'pulling'
        ? -0.3
        : motion === 'struggling'
          ? 0.13
          : motion === 'sliding'
            ? 0.22
            : motion === 'ready'
              ? -0.12
              : 0;
    const breathe = Math.sin(t * 2.4) * 0.012;
    if (root.current) {
      root.current.position.y = position[1] + (victory ? Math.abs(Math.sin(t * 5)) * 0.25 : 0);
      root.current.rotation.z = THREE.MathUtils.damp(
        root.current.rotation.z,
        falling ? (team === 'A' ? -0.9 : 0.9) : 0,
        5,
        dt,
      );
      root.current.scale.y = scale * (1 + breathe * 0.6);
    }
    if (chest.current) {
      chest.current.rotation.x = THREE.MathUtils.damp(
        chest.current.rotation.x,
        effort + (pulling ? Math.sin(t * 8) * 0.055 : breathe),
        8,
        dt,
      );
      chest.current.position.y = 0.85 + (falling ? -0.1 : breathe);
    }
    if (head.current) {
      head.current.rotation.y = Math.sin(t * 0.7) * 0.06;
      head.current.rotation.x = falling ? 0.2 : pulling ? -0.1 : Math.sin(t * 1.3) * 0.025;
    }
    if (eyes.current) {
      const blinkTime = t % 4.6;
      const blink = blinkTime < 0.19 ? 1 - Math.sin((blinkTime / 0.19) * Math.PI) * 0.94 : 1;
      eyes.current.scale.y = THREE.MathUtils.damp(eyes.current.scale.y, blink, 35, dt);
    }
    if (brows.current) brows.current.rotation.z = pulling ? Math.sin(t * 2) * 0.035 : 0;
    if (legL.current) {
      legL.current.rotation.x = pulling
        ? -0.22 + Math.sin(t * 8) * 0.035
        : Math.sin(t * 1.2) * 0.018;
      legL.current.rotation.z = pulling ? -0.14 : -0.07;
    }
    if (legR.current) {
      legR.current.rotation.x = pulling
        ? 0.2 + Math.sin(t * 8 + 1) * 0.035
        : -Math.sin(t * 1.2) * 0.018;
      legR.current.rotation.z = pulling ? 0.14 : 0.07;
    }
    const tilt = chest.current?.rotation.x || 0;
    [left, right].forEach((arm, i) => {
      const sign = i === 0 ? -1 : 1;
      arm.shoulder.set(sign * 0.4, 1.48 + Math.cos(tilt) * 0.05 + breathe, Math.sin(tilt) * 0.65);
      if (holdRope && !falling && !victory) {
        arm.hand.set(sign * 0.12, 1.05, 0.67);
        arm.elbow.set(sign * 0.46, 1.16 + Math.sin(t * 8) * 0.014, 0.34 + Math.sin(tilt) * 0.25);
      } else if (victory) {
        arm.hand.set(sign * 0.53, 2.07 + Math.sin(t * 5) * 0.08, 0.13);
        arm.elbow.set(sign * 0.67, 1.73, 0.1);
      } else {
        arm.hand.set(sign * 0.47, 1.02 + breathe, 0.13);
        arm.elbow.set(sign * 0.52, 1.25, 0.02);
      }
    });
    if (handL.current) handL.current.position.copy(left.hand);
    if (handR.current) handR.current.position.copy(right.hand);
    if (sweat.current) {
      sweat.current.visible = motion === 'struggling' || motion === 'sliding';
      sweat.current.position.y = 1.95 - (t % 1) * 0.2;
      sweat.current.scale.setScalar(0.8 + (t % 1) * 0.3);
    }
  });

  return (
    <group ref={root} position={position} rotation={[0, facing, 0]} scale={scale}>
      <group ref={legL} position={[-0.2, 0.86, 0]}>
        <mesh position={[0, -0.17, 0]} castShadow>
          <capsuleGeometry args={[0.14, 0.24, 8, 16]} />
          <meshStandardMaterial color={doctor ? '#243d48' : teamColor} />
        </mesh>
        <group position={[0, -0.37, 0.015]} rotation={[-0.09, 0, 0]}>
          <mesh position={[0, -0.13, 0]} castShadow>
            <capsuleGeometry args={[0.115, 0.2, 6, 16]} />
            <meshStandardMaterial color={doctor ? '#243d48' : teamColor} />
          </mesh>
          <mesh position={[0, -0.33, 0.085]} scale={[1, 0.65, 1.45]} castShadow>
            <sphereGeometry args={[0.16, 20, 12]} />
            <meshStandardMaterial
              color={ambulance ? '#17272d' : doctor ? '#594334' : '#eef3ee'}
              roughness={0.5}
            />
          </mesh>
          <mesh position={[0, -0.405, 0.085]}>
            <boxGeometry args={[0.25, 0.04, 0.35]} />
            <meshStandardMaterial color={doctor ? '#aa9980' : '#c4d1ce'} />
          </mesh>
        </group>
      </group>
      <group ref={legR} position={[0.2, 0.86, 0]}>
        <mesh position={[0, -0.17, 0]} castShadow>
          <capsuleGeometry args={[0.14, 0.24, 8, 16]} />
          <meshStandardMaterial color={doctor ? '#243d48' : teamColor} />
        </mesh>
        <group position={[0, -0.37, 0.015]} rotation={[0.05, 0, 0]}>
          <mesh position={[0, -0.13, 0]} castShadow>
            <capsuleGeometry args={[0.115, 0.2, 6, 16]} />
            <meshStandardMaterial color={doctor ? '#243d48' : teamColor} />
          </mesh>
          <mesh position={[0, -0.33, 0.085]} scale={[1, 0.65, 1.45]} castShadow>
            <sphereGeometry args={[0.16, 20, 12]} />
            <meshStandardMaterial
              color={ambulance ? '#17272d' : doctor ? '#594334' : '#eef3ee'}
              roughness={0.5}
            />
          </mesh>
          <mesh position={[0, -0.405, 0.085]}>
            <boxGeometry args={[0.25, 0.04, 0.35]} />
            <meshStandardMaterial color={doctor ? '#aa9980' : '#c4d1ce'} />
          </mesh>
        </group>
      </group>
      <group ref={chest} position={[0, 0.85, 0]}>
        <mesh position={[0, 0.42, 0]} scale={[0.4, 0.48, 0.25]} castShadow>
          <sphereGeometry args={[1, 28, 20]} />
          <meshStandardMaterial color={uniform} roughness={0.78} />
        </mesh>
        <mesh position={[0, 0.2, 0]} scale={[0.32, 0.21, 0.215]} castShadow>
          <sphereGeometry args={[1, 24, 16]} />
          <meshStandardMaterial color={uniform} roughness={0.78} />
        </mesh>
        <mesh position={[0, 0.49, 0.24]} scale={[0.17, 0.35, 0.055]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color={doctor ? '#d4e1dc' : definition.color} />
        </mesh>
        {doctor && (
          <>
            <mesh position={[-0.16, 0.61, 0.252]} rotation={[0, 0, -0.26]}>
              <boxGeometry args={[0.12, 0.41, 0.04]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0.16, 0.61, 0.252]} rotation={[0, 0, 0.26]}>
              <boxGeometry args={[0.12, 0.41, 0.04]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <CoatPanels color={uniform} />
            <Necktie color={team === 'A' ? '#a44935' : '#405b87'} />
            {[0.18, 0.32, 0.46].map((y) => (
              <mesh key={y} position={[0.16, y, 0.281]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.024, 0.024, 0.012, 12]} />
                <meshStandardMaterial color="#cbbd9f" roughness={0.45} />
              </mesh>
            ))}
            {[-1, 1].map((sign) => (
              <mesh
                key={sign}
                position={[sign * 0.245, -0.04, 0.267]}
                rotation={[0, sign * 0.17, 0]}
              >
                <boxGeometry args={[0.145, 0.09, 0.025]} />
                <meshStandardMaterial color="#e6ddc9" roughness={0.85} />
              </mesh>
            ))}
            <Tube points={stethoscopePoints} />
            <mesh position={[0.02, 0.32, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.058, 0.058, 0.026, 14]} />
              <meshStandardMaterial color="#879d9e" metalness={0.6} roughness={0.3} />
            </mesh>
          </>
        )}
        <mesh position={[-0.245, 0.37, 0.23]}>
          <boxGeometry args={[0.16, 0.115, 0.025]} />
          <meshStandardMaterial color="#d7e5df" />
        </mesh>
        <mesh position={[-0.245, 0.4, 0.25]}>
          <boxGeometry args={[0.11, 0.018, 0.012]} />
          <meshStandardMaterial color={teamColor} />
        </mesh>
        <mesh position={[-0.245, 0.365, 0.25]}>
          <boxGeometry args={[0.075, 0.012, 0.012]} />
          <meshStandardMaterial color="#819391" />
        </mesh>
        {ambulance && (
          <>
            <mesh position={[0, 0.38, 0.261]}>
              <boxGeometry args={[0.68, 0.055, 0.014]} />
              <meshStandardMaterial color="#d1e59a" emissive="#a3b878" emissiveIntensity={0.1} />
            </mesh>
            <group position={[0.22, 0.66, 0.255]}>
              <Cross color="#f6f2df" size={0.12} />
            </group>
          </>
        )}
        <mesh position={[0, 0.87, 0]}>
          <cylinderGeometry args={[0.12, 0.15, 0.19, 12]} />
          <meshStandardMaterial color={skin} />
        </mesh>
        <group ref={head} position={[0, 1.22, 0.015]}>
          <mesh scale={[1.02, 1.01, 0.9]} castShadow>
            <sphereGeometry args={[0.45, 32, 24]} />
            <meshPhysicalMaterial
              color={skin}
              roughness={0.52}
              clearcoat={0.08}
              clearcoatRoughness={0.7}
            />
          </mesh>
          {[-1, 1].map((sign) => (
            <group key={sign} position={[sign * 0.435, -0.005, 0]}>
              <mesh scale={[0.65, 1, 0.6]}>
                <sphereGeometry args={[0.115, 18, 12]} />
                <meshStandardMaterial color={skin} roughness={0.55} />
              </mesh>
              <mesh position={[sign * 0.008, 0.004, 0.057]} scale={[0.62, 1, 0.3]}>
                <sphereGeometry args={[0.062, 14, 10]} />
                <meshStandardMaterial color="#ba7a61" roughness={0.65} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, -0.055, 0.415]} scale={[1, 0.8, 1.1]}>
            <sphereGeometry args={[0.084, 20, 14]} />
            <meshStandardMaterial color={skin} roughness={0.42} />
          </mesh>
          {[-1, 1].map((sign) => (
            <mesh
              key={sign}
              position={[sign * 0.27, -0.115, 0.323]}
              rotation={[0, sign * 0.45, 0]}
              scale={[1.3, 0.65, 0.25]}
            >
              <sphereGeometry args={[0.09, 18, 12]} />
              <meshStandardMaterial
                color="#d8907b"
                transparent
                opacity={0.28}
                depthWrite={false}
                roughness={0.8}
              />
            </mesh>
          ))}
          <group ref={eyes}>
            {[-1, 1].map((sign) => (
              <group
                key={sign}
                position={[sign * 0.176, 0.082, 0.367]}
                rotation={[0, sign * 0.12, 0]}
              >
                <mesh scale={[0.94, 1.08, 0.48]}>
                  <sphereGeometry args={[0.126, 24, 18]} />
                  <meshPhysicalMaterial color="#fff7e6" roughness={0.25} clearcoat={0.25} />
                </mesh>
                <mesh position={[-sign * 0.009, -0.002, 0.053]} scale={[0.94, 1, 0.35]}>
                  <sphereGeometry args={[0.077, 22, 16]} />
                  <meshStandardMaterial color="#493020" roughness={0.3} />
                </mesh>
                <mesh position={[-sign * 0.009, -0.002, 0.071]} scale={[0.94, 1, 0.26]}>
                  <sphereGeometry args={[0.063, 20, 16]} />
                  <meshStandardMaterial
                    color={index % 3 === 1 ? '#856135' : '#9b6735'}
                    roughness={0.35}
                  />
                </mesh>
                <mesh position={[-sign * 0.009, -0.001, 0.084]} scale={[0.94, 1, 0.24]}>
                  <sphereGeometry args={[0.042, 20, 14]} />
                  <meshStandardMaterial color="#211c19" roughness={0.22} />
                </mesh>
                <mesh position={[-0.026, 0.033, 0.094]}>
                  <sphereGeometry args={[0.018, 12, 10]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
                <mesh position={[0.024, -0.023, 0.092]}>
                  <sphereGeometry args={[0.008, 8, 6]} />
                  <meshBasicMaterial color="#fff6dc" />
                </mesh>
              </group>
            ))}
          </group>
          <group ref={brows}>
            {[-1, 1].map((sign) => (
              <mesh
                key={sign}
                position={[sign * 0.176, 0.258, 0.36]}
                rotation={[
                  0,
                  0,
                  Math.PI / 2 +
                    sign * (motion === 'pulling' || motion === 'struggling' ? 0.22 : -0.09),
                ]}
              >
                <capsuleGeometry args={[0.027, 0.115, 5, 12]} />
                <meshStandardMaterial color={hair} />
              </mesh>
            ))}
          </group>
          <Tube points={smilePoints} color="#754834" radius={0.012} />
          {(motion === 'pulling' || motion === 'struggling') && (
            <mesh position={[0, -0.175, 0.414]} scale={[1, 0.34, 0.24]}>
              <sphereGeometry args={[0.105, 12, 8]} />
              <meshStandardMaterial color="#fff9e9" />
            </mesh>
          )}
          {characterId === 'midwife' ? (
            <>
              <mesh position={[0, 0.1, -0.035]} scale={[1, 1.07, 0.91]} castShadow>
                <sphereGeometry args={[0.46, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.61]} />
                <meshStandardMaterial color="#c98099" />
              </mesh>
              {[-1, 1].map((sign) => (
                <mesh
                  key={sign}
                  position={[sign * 0.34, -0.13, -0.025]}
                  scale={[0.13, 0.39, 0.28]}
                  castShadow
                >
                  <sphereGeometry args={[1, 12, 10]} />
                  <meshStandardMaterial color="#c98099" />
                </mesh>
              ))}
            </>
          ) : (
            <>
              <mesh position={[0, 0.1, -0.045]} scale={[1.04, 1, 0.96]} castShadow>
                <sphereGeometry args={[0.455, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.49]} />
                <meshStandardMaterial color={hair} roughness={0.46} />
              </mesh>
              <SweptHair color={hair} />
              {female &&
                [-1, 1].map((sign) => (
                  <mesh
                    key={sign}
                    position={[sign * 0.335, -0.055, -0.07]}
                    scale={[0.115, 0.31, 0.26]}
                    castShadow
                  >
                    <sphereGeometry args={[1, 12, 10]} />
                    <meshStandardMaterial color={hair} />
                  </mesh>
                ))}
            </>
          )}
          {characterId === 'nurse-f' && (
            <group position={[0, 0.42, -0.025]}>
              <mesh rotation={[0.1, 0, 0]} castShadow>
                <boxGeometry args={[0.61, 0.15, 0.4]} />
                <meshStandardMaterial color="#f6f8ed" />
              </mesh>
              <group position={[0, 0.005, 0.209]}>
                <Cross size={0.105} />
              </group>
            </group>
          )}
          {(characterId === 'doctor-m' ||
            characterId === 'pharmacist' ||
            characterId === 'analyst') && (
            <group position={[0, 0.085, 0.464]}>
              {[-1, 1].map((sign) => (
                <group key={sign} position={[sign * 0.183, 0, 0]}>
                  <mesh scale={[1.1, 0.95, 1]}>
                    <torusGeometry args={[0.146, 0.016, 8, 32]} />
                    <meshStandardMaterial
                      color={characterId === 'analyst' ? '#789a9b' : '#39443c'}
                      roughness={0.34}
                    />
                  </mesh>
                  <mesh scale={[1.1, 0.95, 1]}>
                    <circleGeometry args={[0.137, 28]} />
                    <meshPhysicalMaterial
                      color="#d4eeed"
                      transparent
                      opacity={0.035}
                      depthWrite={false}
                      roughness={0.1}
                    />
                  </mesh>
                  <mesh position={[sign * 0.151, 0.015, -0.105]} rotation={[0, sign * -0.22, 0]}>
                    <boxGeometry args={[0.025, 0.025, 0.22]} />
                    <meshStandardMaterial color="#39443c" roughness={0.34} />
                  </mesh>
                </group>
              ))}
              <Tube
                points={[
                  [-0.038, 0.017, 0],
                  [0, 0.035, 0.008],
                  [0.038, 0.017, 0],
                ]}
                color="#39443c"
                radius={0.014}
              />
            </group>
          )}
          {ambulance && (
            <group position={[0, 0.4, -0.02]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.35, 0.39, 0.19, 18]} />
                <meshStandardMaterial color="#efc150" />
              </mesh>
              <mesh position={[0, -0.08, 0.22]} scale={[1, 0.3, 1]}>
                <sphereGeometry args={[0.32, 12, 8]} />
                <meshStandardMaterial color="#efc150" />
              </mesh>
              <group position={[0, 0.02, 0.354]}>
                <Cross color="#fffef0" size={0.11} />
              </group>
            </group>
          )}
        </group>
      </group>
      {[left, right].map((arm, i) => (
        <group key={i}>
          <Segment start={arm.shoulder} end={arm.elbow} radius={0.14} color={uniform} />
          <Segment start={arm.elbow} end={arm.hand} radius={0.105} color={skin} />
        </group>
      ))}
      <mesh ref={handL} castShadow scale={[1, 0.85, 1]}>
        <sphereGeometry args={[0.135, 20, 14]} />
        <meshStandardMaterial color={characterId === 'analyst' ? '#b3d6e1' : skin} />
      </mesh>
      <mesh ref={handR} castShadow scale={[1, 0.85, 1]}>
        <sphereGeometry args={[0.135, 20, 14]} />
        <meshStandardMaterial color={characterId === 'analyst' ? '#b3d6e1' : skin} />
      </mesh>
      <mesh ref={sweat} position={[0.48, 1.95, 0.27]} rotation={[0, 0, -0.3]}>
        <coneGeometry args={[0.065, 0.16, 8]} />
        <meshStandardMaterial color="#88dbe7" roughness={0.1} />
      </mesh>
    </group>
  );
}
