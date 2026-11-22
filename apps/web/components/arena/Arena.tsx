'use client';

import { memo, Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import Image from 'next/image';
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
import Rope from './Rope';
import StudioEnvironment from './StudioEnvironment';
import WebGLBoundary from './WebGLBoundary';

export interface ArenaProps {
  state?: RoomState | null;
  preview?: boolean;
  theme?: 'hospital' | 'fantasy';
  quality?: Quality;
  className?: string;
}

function imageYToNdcY(
  imgFrac: number,
  containerAspect: number,
  imgAspect: number,
  objPosY = 0.72,
): number {
  const scale = containerAspect > imgAspect ? containerAspect / imgAspect : 1;
  const screenFrac = imgFrac * scale - objPosY * (scale - 1);
  return 1 - 2 * screenFrac;
}

function SceneBackdropSync() {
  const { gl, scene } = useThree();
  useEffect(() => {
    scene.background = null;
    scene.fog = null;
    gl.localClippingEnabled = true;
    gl.setClearColor(0x000000, 0);
  }, [gl, scene]);
  return null;
}

function CameraRig({
  state,
  theme,
}: {
  state?: RoomState | null;
  theme: 'hospital' | 'fantasy';
}) {
  const { size } = useThree();
  const isFantasy = theme === 'fantasy';
  useFrame(({ camera, clock }, delta) => {
    const movement = state?.settings.cameraMotion !== false;
    const pulling = state?.phase === 'PULL_ANIMATION' && movement;
    const shake = pulling ? Math.sin(clock.elapsedTime * 14) * 0.022 : 0;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, shake, 5, delta);

    const aspect = size.width / Math.max(1, size.height);
    const fit = Math.max(1, 1.75 / aspect);
    const targetZ = 12.8 * fit;
    const targetY = 2.65;
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 8, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 8, delta);

    // Lock hero feet (y=0, z=0.05) cleanly inside each 2D arena's glowing floor court
    const courtNdcY = imageYToNdcY(
      isFantasy ? 0.815 : 0.822,
      aspect,
      isFantasy ? 1672 / 941 : 2.0,
      0.72,
    );
    const tanHalfFov = Math.tan((44 * Math.PI) / 360);
    const alpha = Math.atan(-courtNdcY * tanHalfFov);
    const beta = Math.atan2(-camera.position.y, Math.max(1, camera.position.z - 0.05));
    const lookAtY = camera.position.y + Math.tan(beta + alpha) * (camera.position.z + 0.6);
    camera.lookAt(0, lookAtY, -0.6);
  });
  return null;
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

function useSoftShadowTexture() {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
      grad.addColorStop(0, 'rgba(38, 22, 12, 0.48)');
      grad.addColorStop(0.55, 'rgba(38, 22, 12, 0.22)');
      grad.addColorStop(1, 'rgba(38, 22, 12, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    setTexture(tex);
    return () => {
      tex.dispose();
    };
  }, []);
  return texture;
}

function Contestants({ state, labels }: { state?: RoomState | null; labels: LabelRefs }) {
  const group = useRef<THREE.Group>(null);
  const shadowTex = useSoftShadowTexture();
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
            {/* Soft radial ambient occlusion contact shadow beneath hero feet */}
            {shadowTex && (
              <mesh
                position={[0, 0.012, 0.02]}
                rotation={[-Math.PI / 2, 0, 0]}
                scale={[1.25, 0.88, 1]}
              >
                <planeGeometry args={[1.05, 1.05]} />
                <meshBasicMaterial
                  map={shadowTex}
                  transparent
                  depthWrite={false}
                />
              </mesh>
            )}
            <Character
              characterId={characterId}
              team={team}
              facing={team === 'A' ? 0.72 : -0.72}
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

function ArenaInner({ state, preview = false, theme, quality, className }: ArenaProps) {
  const [lowPower, setLowPower] = useState(false);
  const labels = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(
    () => setLowPower(window.innerWidth < 768 || (navigator.hardwareConcurrency || 4) <= 4),
    [],
  );
  const resolved = quality ?? state?.settings.quality ?? 'AUTO';
  const low = resolved === 'LOW' || (resolved === 'AUTO' && lowPower);
  const arenaTheme = theme || state?.settings.arena || 'hospital';
  const isFantasy = arenaTheme === 'fantasy';
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
        background: '#0f172a',
        borderRadius: 'inherit',
      }}
    >
      <Image
        src={isFantasy ? '/images/fantasy-battlefield-bg.png' : '/images/hospital-battle-bg.png'}
        alt={isFantasy ? 'RSUD Al-Mulk Lobby Battlefield' : 'RSUD Al-Mulk Hospital Battle Arena'}
        fill
        priority
        sizes="100vw"
        referrerPolicy="no-referrer"
        style={{
          objectFit: 'cover',
          objectPosition: 'center 72%',
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 0,
        }}
      />
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <WebGLBoundary transparentLoading>
          <Canvas
            shadows={!low}
            dpr={low ? 1 : [1, 1.75]}
            camera={{
              position: [0, 2.65, 12.8],
              fov: 44,
              near: 0.1,
              far: 80,
            }}
            gl={{
              alpha: true,
              antialias: !low,
              powerPreference: low ? 'low-power' : 'high-performance',
              preserveDrawingBuffer: true,
            }}
            onCreated={({ gl }) => {
              gl.debug.checkShaderErrors = false;
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 0.98;
              gl.shadowMap.type = THREE.PCFShadowMap;
              gl.localClippingEnabled = true;
              gl.setClearColor(0x000000, 0);
            }}
          >
            <SceneBackdropSync />
            {/* Controlled Studio IBL reflections so clearcoat hair, eyes, and leather pop without washing out shadows */}
            <StudioEnvironment intensity={isFantasy ? 0.5 : 0.48} />
            <hemisphereLight
              args={[isFantasy ? '#fff5e4' : '#eef8ff', isFantasy ? '#5a6e6a' : '#6c7a89', 0.6]}
            />
            <ambientLight intensity={0.18} />
            {/* Subtle front fill for eye catchlights */}
            <directionalLight
              position={[1.5, 3.4, 10.5]}
              intensity={0.46}
              color="#ffe8cc"
            />
            {/* High-contrast warm golden key light matching both 2D backdrops */}
            <directionalLight
              position={isFantasy ? [0, 11, 6.5] : [-4.5, 11.5, 7.5]}
              color={isFantasy ? '#fff0d4' : '#fff2d6'}
              intensity={2.25}
              castShadow={!low}
              shadow-mapSize={resolved === 'HIGH' ? 2048 : 1024}
              shadow-camera-left={-13}
              shadow-camera-right={13}
              shadow-camera-top={12}
              shadow-camera-bottom={-12}
              shadow-camera-near={1}
              shadow-camera-far={35}
              shadow-bias={-0.0006}
              shadow-normalBias={0.035}
            />
            {/* Cool emerald/sky rim light to match the stadium floodlights & lobby spotlights */}
            <directionalLight
              position={[7.5, 6.5, -8.5]}
              intensity={1.35}
              color={isFantasy ? '#5eead4' : '#7dd3fc'}
            />
            <Suspense fallback={null}>
              <Environment
                theme={arenaTheme}
                quality={low ? 'LOW' : resolved}
                phase={state?.phase}
                paused={state?.paused}
              />
              <Contestants state={state} labels={labels} />
            </Suspense>
            <CameraRig state={state} theme={arenaTheme} />
          </Canvas>
        </WebGLBoundary>
      </div>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 2 }}>
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

const Arena = memo(ArenaInner);
export default Arena;
