'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Soft studio image-based lighting (generated locally, no HDR download).
 * Wraps characters in smooth photographic softbox light so the clay/vinyl materials read
 * like an offline-rendered animated-film still instead of flat real-time shading.
 */
export default function StudioEnvironment({ intensity = 1 }: { intensity?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.035);
    const previous = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    scene.environment = target.texture;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = previous;
      scene.environmentIntensity = previousIntensity;
      target.dispose();
      pmrem.dispose();
      room.dispose();
    };
  }, [gl, scene, intensity]);

  return null;
}
