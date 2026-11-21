import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

async function loadDoctor() {
  const bytes = readFileSync('apps/web/public/models/doctor-hero.glb');
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new GLTFLoader().parseAsync(data as ArrayBuffer, '');
}

function jointPose(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const values: number[] = [];
  root.traverse((node) => {
    if (node instanceof THREE.Bone) values.push(...node.matrixWorld.elements);
  });
  return values;
}

describe('Blender doctor asset used by the game', () => {
  it('contains a usable rig, game animation clips and game-scale geometry', async () => {
    const asset = await loadDoctor();
    const meshes: THREE.SkinnedMesh[] = [];
    asset.scene.traverse((node) => {
      if (node instanceof THREE.SkinnedMesh) meshes.push(node);
    });
    expect(meshes.length).toBeGreaterThan(0);
    expect(meshes[0].skeleton.bones.length).toBeGreaterThan(10);
    const names = asset.animations.map((clip) => clip.name);
    for (const name of [
      'idle',
      'ready',
      'pulling',
      'struggling',
      'sliding',
      'falling',
      'victory',
      'defeat',
    ]) {
      expect(names).toContain(name);
      expect(asset.animations.find((clip) => clip.name === name)!.duration).toBeGreaterThan(0.5);
    }
    const size = new THREE.Box3().setFromObject(asset.scene).getSize(new THREE.Vector3());
    expect(size.y).toBeGreaterThan(2.2);
    expect(size.y).toBeLessThan(3.1);
  });

  it('moves real joints and keeps cloned characters independent', async () => {
    const asset = await loadDoctor();
    const first = clone(asset.scene),
      second = clone(asset.scene);
    const mixer = new THREE.AnimationMixer(first);
    const clip = asset.animations.find((animation) => animation.name === 'victory')!;
    const before = jointPose(first),
      secondBefore = jointPose(second);
    mixer.clipAction(clip).play();
    mixer.update(0.55);
    expect(jointPose(first)).not.toEqual(before);
    expect(jointPose(second)).toEqual(secondBefore);
    mixer.stopAllAction();
    mixer.uncacheRoot(first);
  });

  it('keeps the rope grips in reach throughout the ready and pull loops', async () => {
    const asset = await loadDoctor();
    for (const name of ['rope-ready', 'pulling']) {
      const model = clone(asset.scene);
      const mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(asset.animations.find((animation) => animation.name === name)!).play();
      for (const time of [0, 0.5, 1, 1.5]) {
        mixer.setTime(time);
        model.updateMatrixWorld(true);
        for (const [bone, x] of [
          ['HandL', -0.12],
          ['HandR', 0.12],
        ] as const) {
          const hand = model.getObjectByName(bone);
          expect(hand).toBeDefined();
          const position = hand!.getWorldPosition(new THREE.Vector3());
          expect(position.distanceTo(new THREE.Vector3(x, 1.05, 0.67))).toBeLessThan(0.03);
        }
      }
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
    }
  });
});
