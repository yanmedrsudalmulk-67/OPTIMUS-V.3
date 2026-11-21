'use client';
/** Animated original/ licensed GLB assets share cached geometry, but never a
 * skeleton, animation mixer, or mutable team-colour material between heroes. */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { CharacterMotion } from './Character';
import type { Team } from '../../../../packages/shared/src';

const clipName = (value: string) => value.toLowerCase().split('|').at(-1)!.replace(/[ _]/g, '-');

export default function AnimatedGLTF({
  url,
  motion = 'idle',
  scale = 1,
  animate = true,
  team = 'A',
  holdRope = false,
  seed = 0,
}: {
  url: string;
  motion?: CharacterMotion;
  scale?: number;
  animate?: boolean;
  team?: Team;
  holdRope?: boolean;
  seed?: number;
}) {
  const { scene, animations } = useGLTF(url);
  const { model, materials, skeletons } = useMemo(() => {
    const model = clone(scene);
    const copies = new Map<THREE.Material, THREE.Material>();
    const skeletons = new Set<THREE.Skeleton>();
    const copyMaterial = (source: THREE.Material) => {
      let material = copies.get(source);
      if (!material) {
        material = source.clone();
        copies.set(source, material);
      }
      return material;
    };
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      object.material = Array.isArray(object.material)
        ? object.material.map(copyMaterial)
        : copyMaterial(object.material);
      if (object instanceof THREE.SkinnedMesh) {
        object.frustumCulled = false;
        skeletons.add(object.skeleton);
      }
    });
    return { model, materials: [...copies.values()], skeletons: [...skeletons] };
  }, [scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const currentAction = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    for (const material of materials) {
      if (material.name.toLowerCase().startsWith('teamaccent') && 'color' in material) {
        (material as THREE.MeshStandardMaterial).color.set(team === 'A' ? '#10b981' : '#2563eb');
      }
    }
  }, [materials, team]);

  useEffect(() => {
    // The rope grip is a separate pose: gallery idle/ready should stay relaxed.
    const requested = holdRope && (motion === 'idle' || motion === 'ready') ? 'rope-ready' : motion;
    const clip =
      animations.find((a) => clipName(a.name) === requested) ||
      animations.find((a) => clipName(a.name) === motion) ||
      animations.find((a) => clipName(a.name) === 'idle');
    if (!clip) return;
    const previous = currentAction.current;
    const action = mixer.clipAction(clip);
    // Finish a fall and hold the last pose; idle, pull, and celebration loop.
    const oneShot = motion === 'falling' || motion === 'defeat';
    action.reset();
    action.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity);
    action.clampWhenFinished = oneShot;
    action.setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (animate && previous && previous !== action) previous.crossFadeTo(action, 0.22, false);
    else {
      mixer.stopAllAction();
      action.reset().setEffectiveWeight(1).play();
    }
    if (!oneShot && animate && clip.duration > 0) {
      action.time = (seed * 0.17) % clip.duration;
    }
    // Reduced-motion/demand rendering still evaluates the chosen pose once.
    // This avoids leaving a frozen character in its modelling/rest pose.
    mixer.update(0);
    action.paused = !animate;
    model.updateMatrixWorld(true);
    model.userData.activeClip = clip.name;
    currentAction.current = action;
  }, [animations, mixer, model, motion, holdRope, animate, seed]);
  useEffect(
    () => () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      currentAction.current = null;
      for (const skeleton of skeletons) skeleton.dispose();
      for (const material of materials) material.dispose();
    },
    [mixer, model, materials, skeletons],
  );
  useFrame((_, delta) => {
    if (animate) mixer.update(Math.min(delta, 0.05));
  });
  // Shared cached geometries/textures belong to useGLTF, not this instance.
  return <primitive object={model} scale={scale} dispose={null} />;
}
