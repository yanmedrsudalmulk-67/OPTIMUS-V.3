'use client';
/** Optional replacement component for licensed production GLB assets.
 * Provide an asset with matching clips; switching state crossfades actions.
 * Procedural characters remain the default and require no external downloads. */
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { CharacterMotion } from './Character';

export default function AnimatedGLTF({
  url,
  motion = 'idle',
  scale = 1,
}: {
  url: string;
  motion?: CharacterMotion;
  scale?: number;
}) {
  const { scene, animations } = useGLTF(url);
  const model = useMemo(() => clone(scene), [scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  useEffect(() => {
    const clip =
      animations.find((a) => a.name.toLowerCase() === motion) ||
      animations.find((a) => a.name.toLowerCase() === 'idle');
    if (!clip) return;
    const action = mixer.clipAction(clip).reset().fadeIn(0.22).play();
    return () => {
      action.fadeOut(0.22);
    };
  }, [animations, mixer, motion]);
  useEffect(
    () => () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
    },
    [mixer, model],
  );
  useFrame((_, delta) => mixer.update(delta));
  return <primitive object={model} scale={scale} />;
}
