'use client';
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import type { Team } from '../../../../packages/shared/src';
import Character from './Character';
import WebGLBoundary from './WebGLBoundary';

export default function CharacterPreview({
  characterId,
  team = 'A',
}: {
  characterId: string;
  team?: Team;
}) {
  return (
    <div
      data-testid="character-preview"
      style={{
        width: '100%',
        height: '100%',
        minHeight: 220,
        background: 'radial-gradient(ellipse at center,#f5f5e8,#e6eee5)',
        borderRadius: 'inherit',
        position: 'relative',
        touchAction: 'pan-y',
      }}
    >
      <WebGLBoundary compact>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [0, 1.8, 4.7], fov: 34, near: 0.1, far: 20 }}
          gl={{ antialias: true }}
        >
          <hemisphereLight args={['#fff7e1', '#94b8a9', 2.6]} />
          <directionalLight position={[-3, 5, 4]} intensity={3} castShadow shadow-mapSize={512} />
          <directionalLight position={[3, 3, -3]} intensity={1.5} color="#b7d9df" />
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
            target={[0, 1.2, 0]}
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
