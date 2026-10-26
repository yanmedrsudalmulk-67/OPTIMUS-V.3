'use client';

import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  CHARACTERS,
  type Player,
  type Quality,
  type RoomState,
  type Team,
} from '../../../../packages/shared/src';
import Character, { type CharacterMotion } from './Character';
import Environment from './Environment';
import WebGLBoundary from './WebGLBoundary';

export interface ArenaProps {
  state?: RoomState | null;
  preview?: boolean;
  theme?: 'hospital' | 'fantasy';
  quality?: Quality;
  className?: string;
}

function CameraRig({ state }: { state?: RoomState | null }) {
  const { size } = useThree();
  useFrame(({ camera, clock }, delta) => {
    const movement = state?.settings.cameraMotion !== false;
    const pulling = state?.phase === 'PULL_ANIMATION' && movement;
    const shake = pulling ? Math.sin(clock.elapsedTime * 14) * 0.022 : 0;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, shake, 5, delta);

    const aspect = size.width / Math.max(1, size.height);
    const fit = Math.max(0.85, 1.35 / aspect);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, 9.5 * fit, 6, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 3.4 * fit, 6, delta);
    camera.lookAt(0, 1.15, 0.2);

  });
  return null;
}

function Rope({ phase }: { phase?: string }) {
  const ref = useRef<THREE.Mesh>(null),
    marker = useRef<THREE.Group>(null);
  const geometry = useMemo(
    () =>
      new THREE.TubeGeometry(
        new THREE.LineCurve3(new THREE.Vector3(-7.1, 1.05, 0.5), new THREE.Vector3(7.1, 1.05, 0.5)),
        72,
        0.047,
        8,
        false,
      ),
    [],
  );
  const texture = useMemo(() => {
    const pixels = new Uint8Array(64 * 64 * 4);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        const line = ((x + y * 2) % 16) / 16;
        const value = 0.7 + Math.sin(line * Math.PI * 2) * 0.2;
        const i = (y * 64 + x) * 4;
        pixels[i] = 218 * value;
        pixels[i + 1] = 175 * value;
        pixels[i + 2] = 115 * value;
        pixels[i + 3] = 255;
      }
    const map = new THREE.DataTexture(pixels, 64, 64, THREE.RGBAFormat);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(30, 1);
    map.needsUpdate = true;
    return map;
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      texture.dispose();
    },
    [geometry, texture],
  );
  useFrame(({ clock }) => {
    const sag = phase === 'FINISHED' ? 0.25 : phase === 'PULL_ANIMATION' ? 0.005 : 0.025;
    const attr = geometry.attributes.position;
    for (let i = 0; i <= 72; i++)
      for (let j = 0; j <= 8; j++) {
        const u = i / 72,
          angle = (j / 8) * Math.PI * 2;
        const y =
          1.05 -
          Math.sin(u * Math.PI) * sag +
          (phase === 'PULL_ANIMATION' ? Math.sin(u * 45 + clock.elapsedTime * 12) * 0.008 : 0);
        attr.setXYZ(
          i * 9 + j,
          -7.1 + u * 14.2,
          y + Math.cos(angle) * 0.047,
          0.5 + Math.sin(angle) * 0.047,
        );
      }
    attr.needsUpdate = true;
    if (marker.current) {
      marker.current.position.y = 1.05 - sag;
      marker.current.rotation.x = Math.sin(clock.elapsedTime * 2) * 0.03;
    }
  });
  return (
    <>
      <mesh ref={ref} geometry={geometry} castShadow>
        <meshStandardMaterial map={texture} color="#d9b27b" roughness={0.95} />
      </mesh>
      <group ref={marker} position={[0, 1.03, 0.5]}>
        <mesh castShadow>
          <boxGeometry args={[0.15, 0.13, 0.12]} />
          <meshStandardMaterial color="#e66151" />
        </mesh>
        <mesh position={[0.012, -0.15, 0]} rotation={[0.08, 0, -0.08]} castShadow>
          <boxGeometry args={[0.15, 0.29, 0.038]} />
          <meshStandardMaterial color="#ee705d" side={THREE.DoubleSide} />
        </mesh>
      </group>
    </>
  );
}

function motionFor(state: RoomState | null | undefined, team: Team): CharacterMotion {
  if (!state) return 'idle';
  if (state.phase === 'FINISHED')
    return state.winner === 'DRAW' ? 'idle' : state.winner === team ? 'victory' : 'falling';
  if (state.paused) return 'ready';
  if (state.phase === 'PULL_ANIMATION') {
    const own = team === 'A' ? state.teamAPower : state.teamBPower;
    const other = team === 'A' ? state.teamBPower : state.teamAPower;
    return own >= other ? 'pulling' : Math.abs(own - other) > 10 ? 'sliding' : 'struggling';
  }
  if (['COUNTDOWN', 'ANSWER_REVEAL', 'ROUND_RESULT'].includes(state.phase)) return 'ready';
  return 'idle';
}

function Confetti({ active }: { active: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    if (!active || !mesh.current) return;
    for (let i = 0; i < 70; i++) {
      const t = (clock.elapsedTime * 0.6 + i * 0.17) % 3;
      dummy.position.set(
        Math.sin(i * 21.4) * 7 + Math.sin(t + i) * 0.4,
        5 - t * 1.5,
        Math.cos(i * 8.7) * 2,
      );
      dummy.rotation.set(t * 2 + i, t + i, t * 3);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
      mesh.current.setColorAt(
        i,
        new THREE.Color(['#ecc257', '#e98171', '#6db8a2', '#6d9bda', '#faf2cc'][i % 5]),
      );
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });
  if (!active) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 70]}>
      <planeGeometry args={[0.09, 0.15]} />
      <meshStandardMaterial side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function Dust({ active }: { active: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current)
      ref.current.children.forEach((child, i) => {
        const t = (clock.elapsedTime * 1.5 + i * 0.13) % 1;
        child.position.y = 0.08 + t * 0.4;
        child.scale.setScalar(0.05 + t * 0.11);
        (child as THREE.Mesh).visible = active;
      });
  });
  return (
    <group ref={ref}>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[-6 + i * 1.05, 0.1, 0.2 + Math.sin(i) * 0.4]}>
          <sphereGeometry args={[1, 6, 4]} />
          <meshStandardMaterial color="#e4d8b5" transparent opacity={0.45} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

type LabelRefs = MutableRefObject<Record<string, HTMLDivElement | null>>;
function NameAnchor({ id, labels }: { id: string; labels: LabelRefs }) {
  const ref = useRef<THREE.Group>(null);
  const point = useMemo(() => new THREE.Vector3(), []);
  const { size } = useThree();
  useFrame(({ camera }) => {
    const element = labels.current[id];
    if (!element || !ref.current) return;
    ref.current.getWorldPosition(point);
    point.project(camera);
    element.style.transform = `translate(-50%,-50%) translate(${(point.x * 0.5 + 0.5) * size.width}px,${(-point.y * 0.5 + 0.5) * size.height}px)`;
    element.style.visibility = point.z > 1 || point.z < -1 ? 'hidden' : 'visible';
  });
  return <group ref={ref} position={[0, 2.95, 0]} />;
}

function Contestants({ state, labels }: { state?: RoomState | null; labels: LabelRefs }) {
  const group = useRef<THREE.Group>(null);
  const slots = useMemo(
    () =>
      ['A', 'B'].flatMap((team) =>
        Array.from({ length: 3 }, (_, index) => ({
          team: team as Team,
          index,
          player: state?.players.filter((p) => p.team === team)[index],
        })),
      ),
    [state?.players],
  );
  useFrame((_, delta) => {
    if (group.current) {
      const target = ((state?.ropePosition || 0) / (state?.settings.winThreshold || 100)) * 2.05;
      group.current.position.x = THREE.MathUtils.damp(group.current.position.x, target, 2.4, delta);
    }
  });
  const sample = ['doctor-m', 'nurse-f', 'ambulance', 'doctor-f', 'analyst', 'pharmacist'];
  return (
    <group ref={group}>
      <Rope phase={state?.phase} />
      {slots.map(({ team, index, player }, i) => {
        const x = team === 'A' ? -5.8 + index * 1.75 : 2.3 + index * 1.75;
        const characterId = player?.characterId || sample[i];
        return (
          <group key={team + index} position={[x, 0, 0.05]}>
            <Character
              characterId={characterId}
              team={team}
              facing={team === 'A' ? 1.05 : -1.05}
              motion={motionFor(state, team)}
              seed={i}
              holdRope
            />
            <NameAnchor id={team + index} labels={labels} />
          </group>
        );
      })}
      {state?.settings.particles !== false && (
        <>
          <Confetti active={state?.phase === 'FINISHED' && state?.winner !== 'DRAW'} />
          <Dust active={state?.phase === 'PULL_ANIMATION'} />
        </>
      )}
    </group>
  );
}

export default function Arena({ state, preview = false, theme, quality, className }: ArenaProps) {
  const [lowPower, setLowPower] = useState(false);
  const labels = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(
    () => setLowPower(window.innerWidth < 768 || (navigator.hardwareConcurrency || 4) <= 4),
    [],
  );
  const resolved = quality ?? state?.settings.quality ?? 'AUTO';
  const low = resolved === 'LOW' || (resolved === 'AUTO' && lowPower);
  const arenaTheme = theme || state?.settings.arena || 'hospital';
  return (
    <div
      className={className}
      data-testid="arena-3d"
      style={{
        width: '100%',
        height: '100%',
        minHeight: 380,
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(#dbe9e8,#e4eee2)',
        borderRadius: 'inherit',
      }}
    >
      <WebGLBoundary>
        <Canvas
          shadows={!low}
          dpr={low ? 1 : [1, 1.7]}

          camera={{ position: [0, 3.5, 9.8], fov: 38, near: 0.1, far: 80 }}

          gl={{ antialias: !low, powerPreference: low ? 'low-power' : 'high-performance' }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
          }}
        >
          <color attach="background" args={[arenaTheme === 'hospital' ? '#dae9e7' : '#d8e6eb']} />
          <fog attach="fog" args={['#dae9e7', 26, 48]} />
          <hemisphereLight args={['#fff3da', '#87a7a0', 2.0]} />
          <ambientLight intensity={0.45} />
          <directionalLight position={[1, 4, 10]} intensity={0.55} color="#fff0da" />
          <directionalLight
            position={[-6, 12, 6]}
            intensity={2.7}
            castShadow={!low}
            shadow-mapSize={resolved === 'HIGH' ? 2048 : 1024}
            shadow-camera-left={-13}
            shadow-camera-right={13}
            shadow-camera-top={12}
            shadow-camera-bottom={-12}
            shadow-camera-near={1}
            shadow-camera-far={35}
            shadow-bias={-0.0007}
            shadow-normalBias={0.04}
          />
          <directionalLight position={[6, 5, -8]} intensity={1.2} color="#b4d2e5" />
          <Suspense fallback={null}>
            <Environment
              theme={arenaTheme}
              quality={low ? 'LOW' : resolved}
              phase={state?.phase}
              paused={state?.paused}
            />
            <Contestants state={state} labels={labels} />
          </Suspense>
          <CameraRig state={state} />
        </Canvas>
      </WebGLBoundary>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {['A', 'B'].flatMap((team) =>
          Array.from({ length: 3 }, (_, i) => {
            const player = state?.players.filter((p) => p.team === team)[i];
            const sample = [
              'doctor-m',
              'nurse-f',
              'ambulance',
              'doctor-f',
              'analyst',
              'pharmacist',
            ][i + (team === 'A' ? 0 : 3)];
            const label =
              player?.name ||
              (preview ? CHARACTERS.find((c) => c.id === sample)?.name : `Slot ${i + 1}`);
            return (
              <div
                key={team + i}
                ref={(node) => {
                  labels.current[team + i] = node;
                }}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  visibility: 'hidden',
                  maxWidth: 125,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  padding: '4px 9px',
                  fontSize: 10,
                  fontWeight: 700,
                  color: team === 'A' ? '#176d57' : '#345fa7',
                  background: !player && !preview ? '#f6faeee0' : '#fffef2ee',
                  border: `1px solid ${team === 'A' ? '#bbd7c4' : '#c7d4e9'}`,
                  borderRadius: 20,
                  boxShadow: '0 2px 6px #21473910',
                  willChange: 'transform',
                }}
              >
                {label}
                {player?.ready ? ' ✓' : ''}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
