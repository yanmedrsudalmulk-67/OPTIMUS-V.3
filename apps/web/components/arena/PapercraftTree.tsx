'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface TreeProps {
  position: [number, number, number];
  scale?: number;
  rotation?: [number, number, number];
  seed?: number;
  pulling?: boolean;
}

/**
 * Creates laid paper-pulp cardstock texture for stylized layered leaf tiers.
 */
function createCardstockTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // Horizontal laid paper ridges
  for (let y = 0; y < size; y += 3) {
    const alpha = (y % 6 === 0 ? 0.05 : 0.025);
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, y, size, 1.2);
  }

  // Organic cardstock fiber specks
  let s = 7183;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < 800; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const len = 2 + rnd() * 5;
    ctx.fillStyle = `rgba(20, 50, 15, ${0.03 + rnd() * 0.05})`;
    ctx.fillRect(x, y, len, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Creates warm honey-chestnut vertical wood grain texture for trunk and branches.
 */
function createBarkTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 128;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Base warm caramel wood
  ctx.fillStyle = '#b06d3b';
  ctx.fillRect(0, 0, w, h);

  // Vertical wood grain striations
  for (let x = 0; x < w; x += 3) {
    const v = Math.sin(x * 0.4) * 0.5 + 0.5;
    const dark = x % 6 === 0;
    ctx.fillStyle = dark ? 'rgba(105, 52, 20, 0.42)' : 'rgba(215, 140, 78, 0.38)';
    ctx.fillRect(x, 0, 1.5 + v * 1.5, h);
  }

  // Wood fibers
  let s = 9413;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < 600; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const len = 4 + rnd() * 14;
    ctx.fillStyle = `rgba(80, 35, 12, ${0.05 + rnd() * 0.1})`;
    ctx.fillRect(x, y, 1.2, len);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Creates a puffy cloud scallop shape with rounded outward bulging arcs.
 */
function createPuffyScallopShape(w: number, h: number, count: number, bulge = 0.2): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i <= count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const x = (w / 2) * Math.cos(theta);
    const y = (h / 2) * Math.sin(theta);
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      const prevTheta = ((i - 1) / count) * Math.PI * 2;
      const midTheta = (prevTheta + theta) / 2;
      const cx = (w / 2 + bulge) * Math.cos(midTheta);
      const cy = (h / 2 + bulge) * Math.sin(midTheta);
      shape.quadraticCurveTo(cx, cy, x, y);
    }
  }
  return shape;
}

/**
 * Creates the stylized branching wooden trunk matching reference image 2:
 * Wide root base, sweeping branches branching out to lower-left, mid-right,
 * mid-left, upper-right, and central apex crown.
 */
function createTrunkShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-0.25, 0);
  shape.lineTo(0.24, 0);

  // Right trunk up to mid-right branch
  shape.quadraticCurveTo(0.2, 0.6, 0.18, 1.1);

  // Mid-right branch out & back
  shape.quadraticCurveTo(0.38, 1.35, 0.76, 1.62);
  shape.lineTo(0.8, 1.74);
  shape.quadraticCurveTo(0.44, 1.62, 0.14, 1.85);

  // Upper-right branch
  shape.quadraticCurveTo(0.34, 2.15, 0.64, 2.44);
  shape.lineTo(0.68, 2.55);
  shape.quadraticCurveTo(0.36, 2.44, 0.1, 2.7);

  // Apex
  shape.lineTo(0.05, 3.25);
  shape.lineTo(-0.05, 3.25);

  // Upper-left branch
  shape.quadraticCurveTo(-0.22, 2.75, -0.44, 2.85);
  shape.lineTo(-0.5, 2.75);
  shape.quadraticCurveTo(-0.26, 2.55, -0.08, 2.35);

  // Mid-left branch
  shape.quadraticCurveTo(-0.36, 2.05, -0.76, 2.08);
  shape.lineTo(-0.82, 1.98);
  shape.quadraticCurveTo(-0.42, 1.85, -0.11, 1.55);

  // Lower-left branch
  shape.quadraticCurveTo(-0.44, 1.25, -0.8, 1.2);
  shape.lineTo(-0.84, 1.08);
  shape.quadraticCurveTo(-0.42, 1.0, -0.16, 0.75);

  // Down to root base
  shape.quadraticCurveTo(-0.19, 0.4, -0.25, 0);
  return shape;
}

/**
 * Creates grass blades tuft fringe at the base of the trunk.
 */
function createGrassTuftShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-0.48, 0);
  const blades = [
    [-0.4, 0.22], [-0.34, 0.02],
    [-0.26, 0.32], [-0.2, 0.03],
    [-0.1, 0.38], [-0.03, 0.04],
    [0.06, 0.35], [0.13, 0.02],
    [0.22, 0.3], [0.29, 0.03],
    [0.39, 0.24], [0.48, 0.0]
  ];
  for (let i = 0; i < blades.length; i += 2) {
    const tip = blades[i];
    const valley = blades[i + 1];
    shape.lineTo(tip[0], tip[1]);
    shape.lineTo(valley[0], valley[1]);
  }
  shape.lineTo(-0.48, 0);
  return shape;
}

/**
 * Stylized 3D Layered Papercraft Tree matching User Reference Image 2:
 * 1. Warm honey-caramel chestnut branched trunk with natural splits.
 * 2. Multi-tier cloud-scalloped papercut leaf canopies with distinct depths and bevels.
 * 3. Rich natural palette: deep teal pine backing, lush forest mid, fresh spring crests, sunny chartreuse highlights.
 * 4. Grass fringe at trunk base.
 * 5. Dynamic breeze animation: soft pendulum trunk sway & independent leaf flutter.
 */
export default function PapercraftTree({
  position,
  scale = 1,
  rotation,
  seed = 0,
  pulling = false,
}: TreeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const boughRefs = useRef<THREE.Group[]>([]);

  const cardstockTex = useMemo(() => createCardstockTexture(), []);
  const barkTex = useMemo(() => createBarkTexture(), []);

  // Compute natural camera-facing Y angle if not explicitly specified
  const baseRotationY = useMemo(() => {
    if (rotation && rotation[1] !== undefined) return rotation[1];
    // Camera is at [0, 3.95, 11.2], angle towards camera
    const dx = 0 - position[0];
    const dz = 11.2 - position[2];
    return Math.atan2(dx, dz);
  }, [rotation, position]);

  // Trunk Geometry
  const trunkGeom = useMemo(() => {
    const s = createTrunkShape();
    return new THREE.ExtrudeGeometry(s, {
      depth: 0.14,
      curveSegments: 5,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.025,
      bevelSegments: 2,
    });
  }, []);

  // Grass Tuft Geometry
  const grassGeom = useMemo(() => {
    const s = createGrassTuftShape();
    return new THREE.ExtrudeGeometry(s, {
      depth: 0.08,
      curveSegments: 3,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.014,
      bevelSegments: 1,
    });
  }, []);

  // Layered Foliage Canopy Geometries
  const canopyGeometries = useMemo(() => {
    const make = (w: number, h: number, count: number, bulge = 0.21, depth = 0.08) => {
      const s = createPuffyScallopShape(w, h, count, bulge);
      return new THREE.ExtrudeGeometry(s, {
        depth,
        curveSegments: 4,
        bevelEnabled: true,
        bevelThickness: 0.022,
        bevelSize: 0.022,
        bevelSegments: 1,
      });
    };

    return {
      // Top Crown
      crownBack: make(1.85, 1.35, 13, 0.22, 0.06),
      crownMid: make(1.7, 1.25, 12, 0.21, 0.08),
      crownFront: make(1.48, 1.08, 10, 0.2, 0.08),
      crownCrest: make(1.18, 0.85, 9, 0.19, 0.08),
      crownPeak: make(0.78, 0.58, 7, 0.18, 0.08),

      // Mid-Left Bough
      midLeftBack: make(1.58, 1.02, 12, 0.22, 0.06),
      midLeftMid: make(1.45, 0.94, 11, 0.21, 0.08),
      midLeftFront: make(1.22, 0.78, 9, 0.2, 0.08),
      midLeftCrest: make(0.9, 0.56, 7, 0.19, 0.08),

      // Lower-Left Accent
      lowLeftBack: make(0.96, 0.68, 8, 0.2, 0.06),
      lowLeftMid: make(0.88, 0.6, 8, 0.19, 0.07),
      lowLeftCrest: make(0.68, 0.46, 6, 0.18, 0.07),

      // Upper-Left Flank
      upLeftBack: make(1.22, 0.86, 10, 0.21, 0.06),
      upLeftMid: make(1.12, 0.78, 9, 0.2, 0.08),
      upLeftCrest: make(0.88, 0.6, 8, 0.19, 0.08),

      // Mid-Right Bough
      midRightBack: make(1.52, 0.98, 12, 0.22, 0.06),
      midRightMid: make(1.38, 0.9, 11, 0.21, 0.08),
      midRightFront: make(1.16, 0.74, 9, 0.2, 0.08),
      midRightCrest: make(0.78, 0.5, 7, 0.19, 0.08),

      // Upper-Right Flank
      upRightBack: make(1.3, 0.88, 10, 0.21, 0.06),
      upRightMid: make(1.18, 0.8, 9, 0.2, 0.08),
      upRightCrest: make(0.92, 0.62, 8, 0.19, 0.08),

      // Deep Rear Silhouette
      deepRearBack: make(1.85, 1.5, 13, 0.23, 0.06),
    };
  }, []);

  // Dispose geometries & textures on unmount
  useEffect(() => {
    return () => {
      trunkGeom.dispose();
      grassGeom.dispose();
      Object.values(canopyGeometries).forEach((g) => g.dispose());
      cardstockTex?.dispose();
      barkTex?.dispose();
    };
  }, [trunkGeom, grassGeom, canopyGeometries, cardstockTex, barkTex]);

  // Living 3D Breeze Animation ("ANIMASI 3D POHON")
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    const speed = pulling ? 2.0 : 1.15;
    const amp = pulling ? 0.038 : 0.024;

    // Whole tree pendulum sway
    const swayZ = Math.sin(t * speed + seed * 2.7) * amp;
    const swayX = Math.cos(t * speed * 0.78 + seed * 1.8) * (amp * 0.55);
    groupRef.current.rotation.z = (rotation ? rotation[2] : 0) + swayZ;
    groupRef.current.rotation.x = (rotation ? rotation[0] : 0) + swayX;
    groupRef.current.rotation.y = baseRotationY;

    // Independent leaf flutter on each canopy cluster
    boughRefs.current.forEach((bough, idx) => {
      if (!bough) return;
      const bSpeed = speed * (1.3 + idx * 0.12);
      bough.rotation.z = Math.sin(t * bSpeed + idx * 1.4 + seed) * (amp * 0.75);
      bough.rotation.x = Math.cos(t * bSpeed * 0.85 + idx * 0.9) * (amp * 0.5);
    });
  });

  // Foliage Materials - Lush, sunny, and vibrant matching Image 2
  const matDarkPine = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1a472a',
        map: cardstockTex ?? undefined,
        roughness: 0.86,
        metalness: 0.03,
      }),
    [cardstockTex],
  );
  const matForestGreen = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#328639',
        map: cardstockTex ?? undefined,
        roughness: 0.82,
        metalness: 0.03,
      }),
    [cardstockTex],
  );
  const matLushGreen = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#46a34c',
        map: cardstockTex ?? undefined,
        roughness: 0.8,
        metalness: 0.02,
      }),
    [cardstockTex],
  );
  const matFreshGreen = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#70be47',
        map: cardstockTex ?? undefined,
        roughness: 0.78,
        metalness: 0.02,
      }),
    [cardstockTex],
  );
  const matLimeHighlight = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#9ed340',
        map: cardstockTex ?? undefined,
        roughness: 0.76,
        metalness: 0.02,
      }),
    [cardstockTex],
  );
  const matSunnyChartreuse = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#c4e03c',
        map: cardstockTex ?? undefined,
        roughness: 0.74,
        metalness: 0.02,
      }),
    [cardstockTex],
  );
  const matBark = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#b06d3b',
        map: barkTex ?? undefined,
        roughness: 0.8,
        metalness: 0.04,
      }),
    [barkTex],
  );
  const matGrass = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#76b835',
        roughness: 0.85,
      }),
    [],
  );

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* 1. Branching Wooden Trunk */}
      <mesh
        geometry={trunkGeom}
        material={matBark}
        position={[0, 0, -0.07]}
        castShadow
        receiveShadow
      />

      {/* 2. Grass Tuft Fringe at Base */}
      <mesh
        geometry={grassGeom}
        material={matGrass}
        position={[0, 0, 0.08]}
        castShadow
      />
      <mesh
        geometry={grassGeom}
        material={matGrass}
        position={[-0.04, 0, -0.09]}
        scale={[0.88, 0.88, 0.88]}
      />

      {/* 3. Deep Rear Canopy Shadow Silhouette */}
      <mesh
        geometry={canopyGeometries.deepRearBack}
        material={matDarkPine}
        position={[0.15, 3.25, -0.15]}
        castShadow
      />

      {/* 4. Lower-Left Accent Cluster */}
      <group
        ref={(el) => {
          if (el) boughRefs.current[0] = el;
        }}
        position={[-0.92, 1.32, 0.06]}
      >
        <mesh geometry={canopyGeometries.lowLeftBack} material={matDarkPine} position={[0, -0.03, -0.03]} castShadow />
        <mesh geometry={canopyGeometries.lowLeftMid} material={matLushGreen} position={[0, 0, 0.02]} castShadow />
        <mesh geometry={canopyGeometries.lowLeftCrest} material={matLimeHighlight} position={[0, 0.06, 0.08]} castShadow />
      </group>

      {/* 5. Mid-Left Bough Cluster */}
      <group
        ref={(el) => {
          if (el) boughRefs.current[1] = el;
        }}
        position={[-0.98, 2.22, 0.04]}
      >
        <mesh geometry={canopyGeometries.midLeftBack} material={matDarkPine} position={[0, -0.04, -0.04]} castShadow />
        <mesh geometry={canopyGeometries.midLeftMid} material={matForestGreen} position={[0, 0, 0.02]} castShadow />
        <mesh geometry={canopyGeometries.midLeftFront} material={matFreshGreen} position={[0, 0.06, 0.08]} castShadow />
        <mesh geometry={canopyGeometries.midLeftCrest} material={matLimeHighlight} position={[0, 0.12, 0.14]} castShadow />
      </group>

      {/* 6. Upper-Left Flank Cluster */}
      <group
        ref={(el) => {
          if (el) boughRefs.current[2] = el;
        }}
        position={[-0.58, 3.08, -0.01]}
      >
        <mesh geometry={canopyGeometries.upLeftBack} material={matDarkPine} position={[0, -0.03, -0.03]} castShadow />
        <mesh geometry={canopyGeometries.upLeftMid} material={matLushGreen} position={[0, 0, 0.02]} castShadow />
        <mesh geometry={canopyGeometries.upLeftCrest} material={matLimeHighlight} position={[0, 0.06, 0.08]} castShadow />
      </group>

      {/* 7. Mid-Right Bough Cluster */}
      <group
        ref={(el) => {
          if (el) boughRefs.current[3] = el;
        }}
        position={[0.86, 1.95, 0.04]}
      >
        <mesh geometry={canopyGeometries.midRightBack} material={matDarkPine} position={[0, -0.04, -0.04]} castShadow />
        <mesh geometry={canopyGeometries.midRightMid} material={matForestGreen} position={[0, 0, 0.02]} castShadow />
        <mesh geometry={canopyGeometries.midRightFront} material={matFreshGreen} position={[0, 0.06, 0.08]} castShadow />
        <mesh geometry={canopyGeometries.midRightCrest} material={matLimeHighlight} position={[0.06, 0.08, 0.14]} castShadow />
      </group>

      {/* 8. Upper-Right Flank Cluster */}
      <group
        ref={(el) => {
          if (el) boughRefs.current[4] = el;
        }}
        position={[0.72, 2.76, -0.02]}
      >
        <mesh geometry={canopyGeometries.upRightBack} material={matDarkPine} position={[0, -0.03, -0.03]} castShadow />
        <mesh geometry={canopyGeometries.upRightMid} material={matForestGreen} position={[0, 0, 0.01]} castShadow />
        <mesh geometry={canopyGeometries.upRightCrest} material={matLimeHighlight} position={[0, 0.06, 0.07]} castShadow />
      </group>

      {/* 9. Top Crown Cluster */}
      <group
        ref={(el) => {
          if (el) boughRefs.current[5] = el;
        }}
        position={[0.02, 3.82, 0.0]}
      >
        <mesh geometry={canopyGeometries.crownBack} material={matDarkPine} position={[0, -0.04, -0.05]} castShadow />
        <mesh geometry={canopyGeometries.crownMid} material={matForestGreen} position={[0, 0, 0.01]} castShadow />
        <mesh geometry={canopyGeometries.crownFront} material={matLushGreen} position={[0, 0.06, 0.07]} castShadow />
        <mesh geometry={canopyGeometries.crownCrest} material={matLimeHighlight} position={[0, 0.14, 0.13]} castShadow />
        <mesh geometry={canopyGeometries.crownPeak} material={matSunnyChartreuse} position={[0, 0.22, 0.18]} castShadow />
      </group>
    </group>
  );
}
