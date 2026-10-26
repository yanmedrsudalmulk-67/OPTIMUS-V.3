'use client';
import { Suspense } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import type { Team } from '../../../../packages/shared/src';
import Character from './Character';
import WebGLBoundary from './WebGLBoundary';

export default function CharacterPreview({
  characterId,
  team = 'A',
  background,
  className,
}: {
  characterId: string;
  team?: Team;
  background?: string;
  className?: string;
}) {
  return (
    <div
      className={className}
      data-testid="character-preview"
      style={{
        width: '100%',
        height: '100%',
        minHeight: 220,
        background: background ?? 'radial-gradient(ellipse at 45% 36%,#fff8ed,#e6e5db)',
        borderRadius: 'inherit',
        position: 'relative',
        touchAction: 'pan-y',
      }}
    >
      <WebGLBoundary compact>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [0, 1.7, 5.35], fov: 34, near: 0.1, far: 20 }}
          gl={{ antialias: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
          }}
        >
          <hemisphereLight args={['#fff4e0', '#b5ada0', 1.8]} />
          <directionalLight
            position={[-3, 5, 4]}
            intensity={2.8}
            color="#ffedd0"
            castShadow
            shadow-mapSize={512}
          />
          <directionalLight position={[3, 3, -3]} intensity={1.8} color="#c5deed" />
          <Suspense fallback={null}>
            <Character characterId={characterId} team={team} facing={-0.12} />
            <ContactShadows
              position={[0, 0.005, 0]}
              opacity={0.26}
              scale={4}
              blur={2.5}
              far={3}
              resolution={128}
            />
          </Suspense>
          <OrbitControls
            target={[0, 1.38, 0]}
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI * 0.35}
            maxPolarAngle={Math.PI * 0.55}
            rotateSpeed={0.65}
          />
        </Canvas>
      </WebGLBoundary>
      <span
        style={{
          position: 'absolute',
          bottom: 10,
          left: 0,
          right: 0,
          textAlign: 'center',
          pointerEvents: 'none',
          fontSize: 10,
          color: '#739184',
          letterSpacing: 0.4,
        }}
      >
        Geser untuk memutar karakter
      </span>
    </div>
  );
}
