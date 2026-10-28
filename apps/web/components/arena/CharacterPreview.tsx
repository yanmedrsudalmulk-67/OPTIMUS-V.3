'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { getCharacterDefinition, type Team } from '../../../../packages/shared/src';
import Character from './Character';
import WebGLBoundary from './WebGLBoundary';

function PreviewActor({
  characterId,
  team,
  selected,
  reducedMotion,
}: {
  characterId: string;
  team: Team;
  selected: boolean;
  reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const entrance = useRef(0);
  useEffect(() => {
    entrance.current = 0;
  }, [characterId]);
  useFrame((_, delta) => {
    entrance.current = Math.min(1, entrance.current + delta * 3);
    if (group.current) {
      const target = selected ? 1.025 : 1;
      const progress = reducedMotion ? 1 : 1 - Math.pow(1 - entrance.current, 3);
      group.current.scale.setScalar((0.94 + progress * 0.06) * target);
      group.current.position.y = reducedMotion ? 0 : -0.05 * (1 - progress);
    }
  });
  const definition = getCharacterDefinition(characterId);
  return (
    <group ref={group}>
      <Character
        key={characterId}
        characterId={characterId}
        team={team}
        facing={definition.preview.facing}
        motion={selected ? 'ready' : 'idle'}
        animate={!reducedMotion}
      />
    </group>
  );
}

export default function CharacterPreview({
  characterId,
  team = 'A',
  background,
  className,
  selected = false,
  showHint = true,
  reducedMotion: reducedMotionProp,
}: {
  characterId: string;
  team?: Team;
  background?: string;
  className?: string;
  selected?: boolean;
  showHint?: boolean;
  reducedMotion?: boolean;
}) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const reducedMotion = reducedMotionProp ?? prefersReducedMotion;
  const definition = getCharacterDefinition(characterId);
  return (
    <div
      className={className}
      data-testid="character-preview"
      data-character-id={characterId}
      aria-label={`Model 3D ${definition.name}, ${definition.profession}`}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 220,
        background: background ?? 'radial-gradient(ellipse at 45% 36%,#24465f,#091a30 75%)',
        borderRadius: 'inherit',
        position: 'relative',
        touchAction: 'pan-y',
      }}
    >
      <WebGLBoundary compact>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          frameloop={reducedMotion ? 'demand' : 'always'}
          camera={{ position: [0, 1.7, 5.35], fov: 34, near: 0.1, far: 20 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
          onCreated={({ gl }) => {
            gl.setClearColor('#000000', 0);
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
          }}
        >
          <hemisphereLight args={['#e9f5ff', '#718397', 1.8]} />
          <directionalLight
            position={[-3, 5, 4]}
            intensity={3.0}
            color="#ffe7ce"
            castShadow
            shadow-mapSize={512}
            shadow-normalBias={0.03}
          />
          <directionalLight position={[3, 3, -3]} intensity={3.0} color="#60d9ff" />
          <directionalLight
            position={[-3, 2, -2]}
            intensity={1.6}
            color={team === 'A' ? '#47e7b4' : '#739cff'}
          />
          <directionalLight position={[0, 1.5, 4]} intensity={0.35} color="#edf7ff" />
          <Suspense fallback={null}>
            <PreviewActor
              characterId={characterId}
              team={team}
              selected={selected}
              reducedMotion={reducedMotion}
            />
            <ContactShadows
              position={[0, 0.005, 0]}
              opacity={0.4}
              scale={4}
              blur={2.5}
              far={3}
              resolution={128}
              frames={1}
            />
          </Suspense>
          <OrbitControls
            key={characterId}
            target={[0, 1.38, 0]}
            enablePan={false}
            enableZoom={false}
            enableDamping={!reducedMotion}
            minPolarAngle={Math.PI * 0.35}
            maxPolarAngle={Math.PI * 0.55}
            rotateSpeed={0.65}
          />
        </Canvas>
      </WebGLBoundary>
      {showHint && (
        <span
          style={{
            position: 'absolute',
            bottom: 12,
            left: 0,
            right: 0,
            textAlign: 'center',
            pointerEvents: 'none',
            fontSize: 11,
            color: '#bdd7e8',
            letterSpacing: 0.4,
          }}
        >
          Geser untuk memutar karakter 3D
        </span>
      )}
    </div>
  );
}
