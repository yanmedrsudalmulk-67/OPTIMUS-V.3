'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getRopeFloorRestTarget } from '../../lib/arenaLayout';

interface RopeProps {
  phase?: string;
}

const TUBE_SEGMENTS = 144;
const RADIAL_SEGMENTS = 18;
const BASE_RADIUS = 0.056;
const TWIST_COUNT = 42; // Number of full 3-strand helical spirals along the 14.4m length

/**
 * Creates high-detail procedural hemp fiber canvas texture with coarse grain,
 * twisted strand highlights, and darker crevice shadowing.
 */
function createHempTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#caa369';
  ctx.fillRect(0, 0, w, h);

  for (let x = -w; x < w * 2; x += 32) {
    const grad = ctx.createLinearGradient(x, 0, x + 64, h);
    grad.addColorStop(0, 'rgba(150, 105, 55, 0.45)');
    grad.addColorStop(0.35, 'rgba(238, 205, 148, 0.55)');
    grad.addColorStop(0.7, 'rgba(195, 150, 92, 0.35)');
    grad.addColorStop(1, 'rgba(130, 88, 45, 0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, 48, h);
  }

  let seed = 4289;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 4200; i++) {
    const fx = rnd() * w;
    const fy = rnd() * h;
    const flen = 3 + rnd() * 14;
    const shade = Math.floor(140 + rnd() * 105);
    const alpha = 0.08 + rnd() * 0.22;
    ctx.fillStyle = `rgba(${shade},${Math.floor(shade * 0.82)},${Math.floor(shade * 0.58)},${alpha})`;
    ctx.fillRect(fx, fy, flen, 1.2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 2);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const GOLDEN_COLOR = new THREE.Color('#d4a96a');
const SHADOW_COLOR = new THREE.Color('#784f29');

/**
 * 3-Strand Twisted Hawser-Laid Realistic Tug-of-War Rope.
 * - Held taut / catenary sag during active gameplay.
 * - Drops smoothly onto the arena floor (`y ≈ 0.058`) with relaxed slack S-curve,
 *   grounded whipped end bands, frayed tufts, and flat-resting center ribbon on `FINISHED`.
 */
export default function Rope({ phase }: RopeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const flagGroupRef = useRef<THREE.Group>(null);
  const ribbonDrapeRef = useRef<THREE.Group>(null);
  const flagClothRef = useRef<THREE.Mesh>(null);
  const leftBandRef = useRef<THREE.Group>(null);
  const rightBandRef = useRef<THREE.Group>(null);
  const leftTuftRef = useRef<THREE.Group>(null);
  const rightTuftRef = useRef<THREE.Group>(null);
  const dropProgress = useRef(phase === 'FINISHED' ? 1 : 0);

  const texture = useMemo(() => createHempTexture(), []);

  // 17 Control Points for the Natural Catenary Spline
  const controlPoints = useMemo(
    () => [
      new THREE.Vector3(-7.25, 0.36, 0.46), // 0: Tail left
      new THREE.Vector3(-6.6, 0.76, 0.48), // 1: Band left
      new THREE.Vector3(-5.8, 1.05, 0.5), // 2: Player A3
      new THREE.Vector3(-4.92, 1.03, 0.5), // 3: Span A3-A2
      new THREE.Vector3(-4.05, 1.05, 0.5), // 4: Player A2
      new THREE.Vector3(-3.17, 1.03, 0.5), // 5: Span A2-A1
      new THREE.Vector3(-2.3, 1.05, 0.5), // 6: Player A1
      new THREE.Vector3(-1.15, 0.98, 0.5), // 7: Center span left
      new THREE.Vector3(0.0, 0.94, 0.5), // 8: Center marker
      new THREE.Vector3(1.15, 0.98, 0.5), // 9: Center span right
      new THREE.Vector3(2.3, 1.05, 0.5), // 10: Player B1
      new THREE.Vector3(3.17, 1.03, 0.5), // 11: Span B1-B2
      new THREE.Vector3(4.05, 1.05, 0.5), // 12: Player B2
      new THREE.Vector3(4.92, 1.03, 0.5), // 13: Span B2-B3
      new THREE.Vector3(5.8, 1.05, 0.5), // 14: Player B3
      new THREE.Vector3(6.6, 0.76, 0.48), // 15: Band right
      new THREE.Vector3(7.25, 0.36, 0.46), // 16: Tail right
    ],
    [],
  );

  const spline = useMemo(
    () => new THREE.CatmullRomCurve3(controlPoints, false, 'centripetal', 0.45),
    [controlPoints],
  );

  const geometry = useMemo(() => {
    const totalVertices = (TUBE_SEGMENTS + 1) * (RADIAL_SEGMENTS + 1);
    const positions = new Float32Array(totalVertices * 3);
    const normals = new Float32Array(totalVertices * 3);
    const colors = new Float32Array(totalVertices * 3);
    const uvs = new Float32Array(totalVertices * 2);
    const indices: number[] = [];

    for (let i = 0; i < TUBE_SEGMENTS; i++) {
      for (let j = 0; j < RADIAL_SEGMENTS; j++) {
        const a = i * (RADIAL_SEGMENTS + 1) + j;
        const b = (i + 1) * (RADIAL_SEGMENTS + 1) + j;
        const c = (i + 1) * (RADIAL_SEGMENTS + 1) + (j + 1);
        const d = i * (RADIAL_SEGMENTS + 1) + (j + 1);
        indices.push(a, b, c, a, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  }, []);

  const pennantGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(0.32, 0.52, 6, 16);
    geo.translate(0, -0.26, 0);
    return geo;
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      pennantGeo.dispose();
      texture?.dispose();
    };
  }, [geometry, pennantGeo, texture]);

  const tmpPt = useMemo(() => new THREE.Vector3(), []);
  const tmpNormal = useMemo(() => new THREE.Vector3(), []);
  const tmpBinormal = useMemo(() => new THREE.Vector3(), []);
  const tmpCol = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;
    const isPulling = phase === 'PULL_ANIMATION';
    const isFinished = phase === 'FINISHED';

    // Smoothly drop the entire rope to the floor on FINISHED (no mid-air floating!)
    dropProgress.current = THREE.MathUtils.damp(dropProgress.current, isFinished ? 1 : 0, 7.5, dt);
    const drop = dropProgress.current;
    const activeWeight = 1 - drop;

    const centerSag = isPulling ? 0.025 : 0.11;
    const interPlayerSag = isPulling ? 0.005 : 0.024;
    const jitter = isPulling ? Math.sin(t * 32) * 0.005 : 0;
    const breathe = (isPulling ? 0 : Math.sin(t * 2.2) * 0.008) * activeWeight;

    // Active (held) target heights & Z coordinates
    const heldY = [
      0.36,
      0.76,
      1.05 + breathe * 0.5,
      1.05 - interPlayerSag + breathe * 0.6,
      1.05 + breathe * 0.7,
      1.05 - interPlayerSag + breathe * 0.8,
      1.05 + breathe,
      1.05 - centerSag * 0.68 + breathe * 0.8 + jitter,
      1.05 - centerSag + breathe * 0.9 + jitter,
      1.05 - centerSag * 0.68 + breathe * 0.8 - jitter,
      1.05 + breathe,
      1.05 - interPlayerSag + breathe * 0.8,
      1.05 + breathe * 0.7,
      1.05 - interPlayerSag + breathe * 0.6,
      1.05 + breathe * 0.5,
      0.76,
      0.36,
    ];
    const heldZ = [
      0.46, 0.48, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.48, 0.46,
    ];

    for (let idx = 0; idx < controlPoints.length; idx++) {
      const rest = getRopeFloorRestTarget(idx);
      // Slight gravity wave delay from center outward during drop for natural physics
      const distNorm = Math.abs(idx - 8) / 8;
      const localDrop = THREE.MathUtils.clamp(drop * 1.15 - distNorm * 0.15, 0, 1);
      const eased = localDrop * localDrop * (3 - 2 * localDrop);
      controlPoints[idx].y = THREE.MathUtils.lerp(heldY[idx], rest.y, eased);
      controlPoints[idx].z = THREE.MathUtils.lerp(heldZ[idx], rest.z, eased);
    }

    spline.points = controlPoints;
    spline.updateArcLengths();

    // Update end whipped bands & frayed hemp tufts so they stay glued to the dropped rope
    if (leftBandRef.current) {
      leftBandRef.current.position.copy(controlPoints[1]);
      leftBandRef.current.rotation.set(0, 0, THREE.MathUtils.lerp(0.58, Math.PI / 2, drop));
    }
    if (rightBandRef.current) {
      rightBandRef.current.position.copy(controlPoints[15]);
      rightBandRef.current.rotation.set(0, 0, THREE.MathUtils.lerp(-0.58, -Math.PI / 2, drop));
    }
    if (leftTuftRef.current) {
      leftTuftRef.current.position.copy(controlPoints[0]);
      leftTuftRef.current.rotation.set(0, 0, THREE.MathUtils.lerp(-0.85, -Math.PI / 2, drop));
    }
    if (rightTuftRef.current) {
      rightTuftRef.current.position.copy(controlPoints[16]);
      rightTuftRef.current.rotation.set(0, 0, THREE.MathUtils.lerp(0.85, Math.PI / 2, drop));
    }

    const posAttr = geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = geometry.attributes.color as THREE.BufferAttribute;
    const uvAttr = geometry.attributes.uv as THREE.BufferAttribute;
    const frames = spline.computeFrenetFrames(TUBE_SEGMENTS, false);

    let vIdx = 0;

    for (let i = 0; i <= TUBE_SEGMENTS; i++) {
      const u = i / TUBE_SEGMENTS;
      spline.getPointAt(u, tmpPt);
      tmpNormal.copy(frames.normals[i]);
      tmpBinormal.copy(frames.binormals[i]);

      if (isPulling && activeWeight > 0.5) {
        const strainWave = Math.sin(u * 28 + t * 24) * 0.004;
        tmpPt.y += strainWave;
      }

      const endFray =
        u < 0.035
          ? 1 + Math.pow((0.035 - u) / 0.035, 2) * 0.45
          : u > 0.965
            ? 1 + Math.pow((u - 0.965) / 0.035, 2) * 0.45
            : 1;

      for (let j = 0; j <= RADIAL_SEGMENTS; j++) {
        const theta = (j / RADIAL_SEGMENTS) * Math.PI * 2;
        const strandPhase = 3 * theta + u * TWIST_COUNT * Math.PI * 2;
        const strandDisplacement = Math.cos(strandPhase);
        const r = BASE_RADIUS * (1.0 + 0.22 * strandDisplacement) * endFray;

        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        const vx = tmpPt.x + (tmpNormal.x * cosT + tmpBinormal.x * sinT) * r;
        const vy = Math.max(0.008, tmpPt.y + (tmpNormal.y * cosT + tmpBinormal.y * sinT) * r);
        const vz = tmpPt.z + (tmpNormal.z * cosT + tmpBinormal.z * sinT) * r;

        posAttr.setXYZ(vIdx, vx, vy, vz);
        uvAttr.setXY(vIdx, u * 16, j / RADIAL_SEGMENTS);

        const aoFactor = 0.58 + 0.42 * (0.5 + 0.5 * strandDisplacement);
        tmpCol.copy(SHADOW_COLOR).lerp(GOLDEN_COLOR, aoFactor);
        colAttr.setXYZ(vIdx, tmpCol.r, tmpCol.g, tmpCol.b);

        vIdx++;
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    uvAttr.needsUpdate = true;
    geometry.computeVertexNormals();

    // Update Center Marker Flag Position & lay crimson ribbon flat on floor when dropped
    if (flagGroupRef.current) {
      spline.getPointAt(0.5, tmpPt);
      flagGroupRef.current.position.set(tmpPt.x, tmpPt.y, tmpPt.z);

      if (ribbonDrapeRef.current) {
        // Rotate ribbon forward so it drapes flat along the arena floor instead of clipping under y=0
        ribbonDrapeRef.current.rotation.x = THREE.MathUtils.lerp(0, -Math.PI / 2 + 0.05, drop);
        ribbonDrapeRef.current.position.set(
          0,
          THREE.MathUtils.lerp(-0.05, -0.025, drop),
          THREE.MathUtils.lerp(0.068, 0.078, drop),
        );
      }

      if (flagClothRef.current) {
        const clothPos = pennantGeo.attributes.position as THREE.BufferAttribute;
        const flutterSpeed = isPulling ? 14 : 4.5;
        const flutterAmp = (isPulling ? 0.055 : 0.024) * activeWeight;

        for (let k = 0; k < clothPos.count; k++) {
          const py = clothPos.getY(k);
          const hang = Math.abs(py);
          const waveZ = Math.sin(t * flutterSpeed + hang * 12) * flutterAmp * (hang / 0.44);
          const waveX =
            Math.cos(t * (flutterSpeed * 0.7) + hang * 8) * (flutterAmp * 0.4) * (hang / 0.44);
          clothPos.setZ(k, waveZ);
          clothPos.setX(k, waveX);
        }
        clothPos.needsUpdate = true;
        pennantGeo.computeVertexNormals();
      }
    }
  });

  return (
    <group>
      {/* 1. Main 3-Strand Twisted Hawser Rope Mesh */}
      <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          map={texture ?? undefined}
          vertexColors
          roughness={0.88}
          metalness={0.0}
        />
      </mesh>

      {/* 2. Whipped Cord Rings (dynamically anchored to rope ends) */}
      <group ref={leftBandRef} position={[-6.6, 0.76, 0.48]} rotation={[0, 0, 0.58]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.065, 0.065, 0.085, 18]} />
          <meshStandardMaterial color="#2d2218" roughness={0.7} />
        </mesh>
      </group>
      <group ref={rightBandRef} position={[6.6, 0.76, 0.48]} rotation={[0, 0, -0.58]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.065, 0.065, 0.085, 18]} />
          <meshStandardMaterial color="#2d2218" roughness={0.7} />
        </mesh>
      </group>

      {/* 3. Frayed Hemp Fiber End Tufts (dynamically anchored to rope tips) */}
      {([-1, 1] as const).map((sign) => (
        <group
          key={sign}
          ref={sign === -1 ? leftTuftRef : rightTuftRef}
          position={[sign * 7.25, 0.36, 0.46]}
          rotation={[0, 0, sign * 0.85]}
        >
          {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => {
            const a = (idx / 8) * Math.PI * 2;
            const spread = 0.028;
            return (
              <mesh
                key={idx}
                position={[Math.cos(a) * spread, -0.06 - (idx % 2) * 0.03, Math.sin(a) * spread]}
                rotation={[Math.cos(a) * 0.28, 0, Math.sin(a) * 0.28]}
                castShadow
              >
                <capsuleGeometry args={[0.013, 0.09, 4, 8]} />
                <meshStandardMaterial color="#c2985e" roughness={0.95} />
              </mesh>
            );
          })}
        </group>
      ))}

      {/* 4. Realistic Dynamic Center Marker: Ribbon Collar + Fluttering Crimson Silk Ribbon */}
      <group ref={flagGroupRef} position={[0, 0.94, 0.5]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.072, 0.072, 0.16, 20]} />
          <meshStandardMaterial color="#dc2626" roughness={0.65} />
        </mesh>
        {([-0.078, 0.078] as const).map((ox) => (
          <mesh key={ox} position={[ox, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.072, 0.008, 10, 20]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.7} />
          </mesh>
        ))}

        <group ref={ribbonDrapeRef} position={[0, -0.05, 0.068]}>
          <mesh ref={flagClothRef} geometry={pennantGeo} castShadow receiveShadow>
            <meshStandardMaterial color="#dc2626" roughness={0.65} side={THREE.DoubleSide} />
          </mesh>

          <group position={[0, -0.2, 0.01]}>
            <mesh>
              <boxGeometry args={[0.048, 0.15, 0.008]} />
              <meshStandardMaterial color="#fffbeb" roughness={0.4} />
            </mesh>
            <mesh>
              <boxGeometry args={[0.15, 0.048, 0.008]} />
              <meshStandardMaterial color="#fffbeb" roughness={0.4} />
            </mesh>
          </group>

          <mesh position={[0, -0.52, 0.005]} castShadow>
            <sphereGeometry args={[0.024, 14, 12]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.7} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
