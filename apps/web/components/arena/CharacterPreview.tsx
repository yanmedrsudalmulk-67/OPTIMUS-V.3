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
    entrance.current = Math.min(1, entrance.current + delta * 2.8);
    if (group.current) {
      const target = selected ? 1.02 : 1;
      const progress = reducedMotion ? 1 : 1 - Math.pow(1 - entrance.current, 3);
      // Subtle springy entrance settle without stiff pop
      const spring = reducedMotion
        ? 1
        : 1 + Math.sin(progress * Math.PI) * 0.018 * (1 - progress);
      group.current.scale.setScalar((0.95 + progress * 0.05) * target * spring);
      group.current.position.y = reducedMotion ? 0 : -0.04 * (1 - progress);
      group.current.rotation.y = reducedMotion ? 0 : (1 - progress) * 0.16;
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
        motion="idle"
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
          dpr={[1, 1.75]}
          frameloop={reducedMotion ? 'demand' : 'always'}
          camera={{ position: [0, 1.28, 4.92], fov: 33, near: 0.1, far: 20 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.setClearColor('#000000', 0);
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.02;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
          }}
        >
          {/* Studio Dome Light with warm peachy ground bounce (eliminates muddy chin shadows) */}
          <hemisphereLight args={['#fff8f0', '#e5c6b3', 1.48]} />
          {/* Soft Warm Key Light */}
          <directionalLight
            position={[-2.8, 4.8, 4.2]}
            intensity={1.9}
            color="#fff0e0"
            castShadow
            shadow-mapSize={1024}
            shadow-bias={-0.0003}
            shadow-normalBias={0.025}
          />
          {/* Frontal Area Fill Light */}
          <directionalLight position={[3.2, 2.5, 3.2]} intensity={0.76} color="#edf5ff" />
          {/* Subtle Rim Light */}
          <directionalLight
            position={[0.4, 3.8, -3.6]}
            intensity={0.92}
            color={team === 'A' ? '#c5f4e0' : '#cce2ff'}
          />
          <Suspense fallback={null}>
            <PreviewActor
              characterId={characterId}
              team={team}
              selected={selected}
              reducedMotion={reducedMotion}
            />
            <ContactShadows
              position={[0, 0.004, 0]}
              opacity={0.42}
              scale={3.6}
              blur={2.2}
              far={2.6}
              resolution={256}
              color="#1b1410"
              frames={reducedMotion ? 1 : Infinity}
            />
          </Suspense>
          <OrbitControls
            key={characterId}
            target={[0, 1.21, 0]}
            enablePan={false}
            enableZoom={false}
            enableDamping={!reducedMotion}
            dampingFactor={0.08}
            minPolarAngle={Math.PI * 0.34}
            maxPolarAngle={Math.PI * 0.56}
            rotateSpeed={0.68}
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
