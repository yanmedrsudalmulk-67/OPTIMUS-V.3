'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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

  // Base warm golden-tan hemp color
  ctx.fillStyle = '#caa369';
  ctx.fillRect(0, 0, w, h);

  // Diagonal twisted strand gradient bands
  for (let x = -w; x < w * 2; x += 32) {
    const grad = ctx.createLinearGradient(x, 0, x + 64, h);
    grad.addColorStop(0, 'rgba(150, 105, 55, 0.45)');
    grad.addColorStop(0.35, 'rgba(238, 205, 148, 0.55)');
    grad.addColorStop(0.7, 'rgba(195, 150, 92, 0.35)');
    grad.addColorStop(1, 'rgba(130, 88, 45, 0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, 48, h);
  }

  // Micro-fiber noise & coarse organic hemp grain
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

/**
 * 3-Strand Twisted Hawser-Laid Realistic Tug-of-War Rope.
 * Features:
 * 1. Physical 3-strand helical geometry (not a flat wooden cylinder/tongkat!).
 * 2. Natural catenary gravity sag between players & in the center span.
 * 3. Graceful drooping tail ends (no stiff horizontal poles sticking into the air!).
 * 4. High-frequency physical tension shudder during PULL_ANIMATION.
 * 5. Dynamic fluttering red cloth pennant flag in the center with embroidered cross.
 * 6. Whipped cord binding & frayed hemp fiber tassels at the ends.
 */
export default function Rope({ phase }: RopeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const flagGroupRef = useRef<THREE.Group>(null);
  const flagClothRef = useRef<THREE.Mesh>(null);

  // Procedural hemp texture
  const texture = useMemo(() => createHempTexture(), []);

  // 17 Control Points for the Natural Catenary Spline
  const controlPoints = useMemo(() => {
    const pts = [
      new THREE.Vector3(-7.25, 0.36, 0.46), // Drooping tail end near ground left
      new THREE.Vector3(-6.6, 0.76, 0.48), // Curve up smoothly into hands
      new THREE.Vector3(-5.8, 1.05, 0.5), // Player A3
      new THREE.Vector3(-4.92, 1.03, 0.5), // Span A3-A2 (gentle sag)
      new THREE.Vector3(-4.05, 1.05, 0.5), // Player A2
      new THREE.Vector3(-3.17, 1.03, 0.5), // Span A2-A1 (gentle sag)
      new THREE.Vector3(-2.3, 1.05, 0.5), // Player A1 (front)
      new THREE.Vector3(-1.15, 0.98, 0.5), // Center span left
      new THREE.Vector3(0.0, 0.94, 0.5), // Center marker (lowest catenary dip)
      new THREE.Vector3(1.15, 0.98, 0.5), // Center span right
      new THREE.Vector3(2.3, 1.05, 0.5), // Player B1 (front)
      new THREE.Vector3(3.17, 1.03, 0.5), // Span B1-B2 (gentle sag)
      new THREE.Vector3(4.05, 1.05, 0.5), // Player B2
      new THREE.Vector3(4.92, 1.03, 0.5), // Span B2-B3 (gentle sag)
      new THREE.Vector3(5.8, 1.05, 0.5), // Player B3
      new THREE.Vector3(6.6, 0.76, 0.48), // Curve down smoothly toward ground
      new THREE.Vector3(7.25, 0.36, 0.46), // Drooping tail end near ground right
    ];
    return pts;
  }, []);

  const spline = useMemo(() => {
    return new THREE.CatmullRomCurve3(controlPoints, false, 'centripetal', 0.45);
  }, [controlPoints]);

  // Construct the 3-Strand Twisted Parametric Geometry
  const geometry = useMemo(() => {
    const totalVertices = (TUBE_SEGMENTS + 1) * (RADIAL_SEGMENTS + 1);
    const positions = new Float32Array(totalVertices * 3);
    const normals = new Float32Array(totalVertices * 3);
    const colors = new Float32Array(totalVertices * 3);
    const uvs = new Float32Array(totalVertices * 2);
    const indices: number[] = [];

    // Base mesh index assembly
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

  // Cloth Pennant Geometry (16 segments tall for dynamic waving)
  const pennantGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(0.32, 0.52, 6, 16);
    geo.translate(0, -0.26, 0); // Origin at top ring
    return geo;
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      pennantGeo.dispose();
      texture?.dispose();
    };
  }, [geometry, pennantGeo, texture]);

  // Working vectors (allocated once)
  const tmpPt = useMemo(() => new THREE.Vector3(), []);
  const tmpNormal = useMemo(() => new THREE.Vector3(), []);
  const tmpBinormal = useMemo(() => new THREE.Vector3(), []);

  // Animate dynamic catenary sag, tension shudder, and ribbon flutter
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const isPulling = phase === 'PULL_ANIMATION';
    const isFinished = phase === 'FINISHED';

    // 1. Calculate dynamic sag depths
    // When pulling: rope snaps taut (center sag reduced to 2.5 cm, high tension!).
    // When idle/waiting: natural heavy hemp catenary droop (11 cm center sag).
    // When finished: loose drop (24 cm).
    const centerSag = isFinished ? 0.24 : isPulling ? 0.025 : 0.11;
    const interPlayerSag = isFinished ? 0.05 : isPulling ? 0.005 : 0.024;

    // High-frequency strain vibration when teams pull with intense force
    const jitter = isPulling ? Math.sin(t * 32) * 0.005 : 0;
    // Gentle natural breathing heave in idle
    const breathe = isPulling ? 0 : Math.sin(t * 2.2) * 0.008;

    // Update Spline Control Points
    controlPoints[0].y = 0.36 - (isFinished ? 0.15 : 0); // Tail left near ground
    controlPoints[1].y = 0.76 - (isFinished ? 0.1 : 0);

    controlPoints[2].y = 1.05 + breathe * 0.5; // A3
    controlPoints[3].y = 1.05 - interPlayerSag + breathe * 0.6;
    controlPoints[4].y = 1.05 + breathe * 0.7; // A2
    controlPoints[5].y = 1.05 - interPlayerSag + breathe * 0.8;
    controlPoints[6].y = 1.05 + breathe; // A1 (lead)

    // Center span (4.6m open gap between Team A & Team B)
    controlPoints[7].y = 1.05 - centerSag * 0.68 + breathe * 0.8 + jitter;
    controlPoints[8].y = 1.05 - centerSag + breathe * 0.9 + jitter; // Center marker (lowest dip!)
    controlPoints[9].y = 1.05 - centerSag * 0.68 + breathe * 0.8 - jitter;

    controlPoints[10].y = 1.05 + breathe; // B1 (lead)
    controlPoints[11].y = 1.05 - interPlayerSag + breathe * 0.8;
    controlPoints[12].y = 1.05 + breathe * 0.7; // B2
    controlPoints[13].y = 1.05 - interPlayerSag + breathe * 0.6;
    controlPoints[14].y = 1.05 + breathe * 0.5; // B3

    controlPoints[15].y = 0.76 - (isFinished ? 0.1 : 0);
    controlPoints[16].y = 0.36 - (isFinished ? 0.15 : 0); // Tail right near ground

    spline.points = controlPoints;
    spline.updateArcLengths();

    // 2. Deform the 3-Strand Twisted Hawser Rope Geometry along the Spline
    const posAttr = geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = geometry.attributes.color as THREE.BufferAttribute;
    const uvAttr = geometry.attributes.uv as THREE.BufferAttribute;
    const frames = spline.computeFrenetFrames(TUBE_SEGMENTS, false);

    let vIdx = 0;
    const goldenColor = new THREE.Color('#d4a96a');
    const shadowColor = new THREE.Color('#784f29');
    const tmpCol = new THREE.Color();

    for (let i = 0; i <= TUBE_SEGMENTS; i++) {
      const u = i / TUBE_SEGMENTS;
      spline.getPointAt(u, tmpPt);
      tmpNormal.copy(frames.normals[i]);
      tmpBinormal.copy(frames.binormals[i]);

      // Micro-shudder traveling wave during hard pull
      if (isPulling) {
        const strainWave = Math.sin(u * 28 + t * 24) * 0.004;
        tmpPt.y += strainWave;
      }

      // Slightly flared unraveled ends at the extreme tips
      const endFray =
        u < 0.035
          ? 1 + Math.pow((0.035 - u) / 0.035, 2) * 0.45
          : u > 0.965
            ? 1 + Math.pow((u - 0.965) / 0.035, 2) * 0.45
            : 1;

      for (let j = 0; j <= RADIAL_SEGMENTS; j++) {
        const theta = (j / RADIAL_SEGMENTS) * Math.PI * 2;

        // 3-strand helical phase formula: creates real physical 3-lobed twisting cord!
        const strandPhase = 3 * theta + u * TWIST_COUNT * Math.PI * 2;
        const strandDisplacement = Math.cos(strandPhase);

        // Radius with 3-strand bumps
        const r = BASE_RADIUS * (1.0 + 0.22 * strandDisplacement) * endFray;

        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        const vx = tmpPt.x + (tmpNormal.x * cosT + tmpBinormal.x * sinT) * r;
        const vy = tmpPt.y + (tmpNormal.y * cosT + tmpBinormal.y * sinT) * r;
        const vz = tmpPt.z + (tmpNormal.z * cosT + tmpBinormal.z * sinT) * r;

        posAttr.setXYZ(vIdx, vx, vy, vz);
        uvAttr.setXY(vIdx, u * 16, j / RADIAL_SEGMENTS);

        // Baked ambient occlusion: deep helical valleys between strands are naturally darker
        const aoFactor = 0.58 + 0.42 * (0.5 + 0.5 * strandDisplacement);
        tmpCol.copy(shadowColor).lerp(goldenColor, aoFactor);
        colAttr.setXYZ(vIdx, tmpCol.r, tmpCol.g, tmpCol.b);

        vIdx++;
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    uvAttr.needsUpdate = true;
    geometry.computeVertexNormals();

    // 3. Update Center Marker Flag Position & Dynamic Cloth Flutter
    if (flagGroupRef.current) {
      // Pin to exact center of rope (u = 0.5)
      spline.getPointAt(0.5, tmpPt);
      flagGroupRef.current.position.set(tmpPt.x, tmpPt.y, tmpPt.z);

      // Fluttering cloth simulation on the red pennant flag
      if (flagClothRef.current) {
        const clothPos = pennantGeo.attributes.position as THREE.BufferAttribute;
        const flutterSpeed = isPulling ? 14 : 4.5;
        const flutterAmp = isPulling ? 0.055 : 0.024;

        for (let k = 0; k < clothPos.count; k++) {
          const py = clothPos.getY(k); // 0 at top to -0.44 at tip
          const hang = Math.abs(py);
          // Free end flutters more than the anchored top ring
          const waveZ = Math.sin(t * flutterSpeed + hang * 12) * flutterAmp * (hang / 0.44);
          const waveX = Math.cos(t * (flutterSpeed * 0.7) + hang * 8) * (flutterAmp * 0.4) * (hang / 0.44);
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

      {/* 2. Whipped Cord Rings (Leather/twine band at drooping ends before fray) */}
      <group position={[-6.6, 0.76, 0.48]} rotation={[0, 0, 0.58]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.065, 0.065, 0.085, 18]} />
          <meshStandardMaterial color="#2d2218" roughness={0.7} />
        </mesh>
      </group>
      <group position={[6.6, 0.76, 0.48]} rotation={[0, 0, -0.58]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.065, 0.065, 0.085, 18]} />
          <meshStandardMaterial color="#2d2218" roughness={0.7} />
        </mesh>
      </group>

      {/* 3. Frayed Hemp Fiber End Tufts */}
      {([-1, 1] as const).map((sign) => (
        <group key={sign} position={[sign * 7.25, 0.36, 0.46]} rotation={[0, 0, sign * 0.85]}>
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
        {/* Red Cloth Ribbon Band Wrapped around Rope */}
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.072, 0.072, 0.16, 20]} />
          <meshStandardMaterial color="#dc2626" roughness={0.65} />
        </mesh>
        {/* Brass Ring Trim on sides of collar */}
        {([-0.078, 0.078] as const).map((ox) => (
          <mesh key={ox} position={[ox, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.072, 0.008, 10, 20]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.7} />
          </mesh>
        ))}

        {/* Dynamic Fluttering Crimson Cloth Ribbon (Front-facing at Z = +0.068 so it drapes in front of rope!) */}
        <group position={[0, -0.05, 0.068]}>
          <mesh ref={flagClothRef} geometry={pennantGeo} castShadow receiveShadow>
            <meshStandardMaterial
              color="#dc2626"
              roughness={0.65}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Golden Embroidered Medical Cross on Flag */}
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

          {/* Brass Weight Bead at Ribbon Tip for Realistic Pendulum Gravity */}
          <mesh position={[0, -0.52, 0.005]} castShadow>
            <sphereGeometry args={[0.024, 14, 12]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.7} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
