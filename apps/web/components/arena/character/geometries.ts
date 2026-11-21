import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HairStyle } from './materials';

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Merges heterogeneous BufferGeometries while STRICTLY preserving smooth per-vertex normals.
 * Crucial: compute smooth vertex normals while each sub-geometry is still indexed (or keep
 * ExtrudeGeometry's analytical bevel normals), THEN expand to non-indexed. Never recompute
 * normals after non-indexed expansion, which would cause flat faceted shading.
 */
function mergeCleanGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const normalized = parts.map((src) => {
    if (src.index) {
      src.computeVertexNormals();
    } else if (!src.getAttribute('normal')) {
      src.computeVertexNormals();
    }
    const g = src.index ? src.toNonIndexed() : src.clone();
    for (const attrName of Object.keys(g.attributes)) {
      if (attrName !== 'position' && attrName !== 'normal') {
        g.deleteAttribute(attrName);
      }
    }
    return g;
  });
  const merged = mergeGeometries(normalized, false);
  normalized.forEach((g) => g.dispose());
  parts.forEach((g) => g.dispose());
  if (!merged) {
    throw new Error('Failed to merge procedural character geometries');
  }
  return merged;
}

const geoCache = new Map<string, THREE.BufferGeometry>();

/**
 * Sculpted soft-vinyl chubby head matching the reference proportions (~41% head+hair to height):
 * rounded cranium, fuller lower cheeks, gentle front face plane, cozy rounded chin,
 * and baked smooth airbrushed vertex-color blush on cheeks, nose bridge, and chin.
 */
export function getSculptedHeadGeometry(skinHex: string, blushHex: string): THREE.BufferGeometry {
  const key = `head-v4:${skinHex}:${blushHex}`;
  const cached = geoCache.get(key);
  if (cached) return cached;

  const geo = new THREE.SphereGeometry(1, 56, 42);
  const pos = geo.attributes.position;
  const count = pos.count;
  const colors = new Float32Array(count * 3);

  const skinColor = new THREE.Color(skinHex);
  const blushColor = new THREE.Color(blushHex);
  const shadowWarmth = skinColor.clone().lerp(blushColor, 0.34);
  const tmpColor = new THREE.Color();

  const rx = 0.452;
  const ry = 0.446;
  const rz = 0.412;

  for (let i = 0; i < count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    // Fuller lower-cheek curve (pear/squircle vinyl boy silhouette from reference)
    const cheekBand = Math.exp(-Math.pow((ny + 0.25) / 0.38, 2));
    const templeTaper = ny > 0.16 ? 0.036 * Math.pow((ny - 0.16) / 0.84, 1.45) : 0;
    const chinSoft = ny < -0.58 ? 0.032 * Math.pow((-ny - 0.58) / 0.42, 1.6) : 0;

    const x = nx * rx * (1 + 0.095 * cheekBand - templeTaper - chinSoft * 0.45);
    const y = ny * ry * (1 - (ny < -0.62 ? 0.038 * Math.pow((-ny - 0.62) / 0.38, 2) : 0));
    let z = nz * rz;

    // Gentle flatter front facial plane + soft chubby cheek volume
    if (nz > 0) {
      z *= 1 - 0.068 * Math.pow(nz, 2) + 0.045 * cheekBand * nz;
    } else {
      z *= 1 + 0.025 * Math.pow(-nz, 1.4);
    }

    pos.setXYZ(i, x, y, z);

    // Seamless vertex-baked airbrushed blush on cheeks, nose bridge, and lower chin
    const leftCheek = Math.exp(
      -(Math.pow((nx + 0.5) / 0.3, 2) + Math.pow((ny + 0.18) / 0.24, 2)),
    );
    const rightCheek = Math.exp(
      -(Math.pow((nx - 0.5) / 0.3, 2) + Math.pow((ny + 0.18) / 0.24, 2)),
    );
    const noseGlow = Math.exp(-(Math.pow(nx / 0.18, 2) + Math.pow((ny + 0.04) / 0.16, 2)));
    const frontMask = smoothstep(0.12, 0.7, nz);
    const chinGlow = smoothstep(-0.42, -0.95, ny) * 0.26;

    const blushWeight = Math.min(
      0.48,
      (leftCheek + rightCheek) * frontMask * 0.38 + noseGlow * frontMask * 0.2,
    );

    tmpColor.copy(skinColor).lerp(shadowWarmth, chinGlow).lerp(blushColor, blushWeight);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geoCache.set(key, geo);
  return geo;
}

/** Prominent low-set rounded C-cup ear with smooth concave inner concha bowl. */
export function getSculptedEarGeometry(): THREE.BufferGeometry {
  const key = 'ear-v3';
  const cached = geoCache.get(key);
  if (cached) return cached;

  const geo = new THREE.SphereGeometry(1, 30, 22);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    const x = nx * 0.098;
    const y = ny * 0.128 * (1 + 0.06 * ny);
    let z = nz * 0.068;

    // Carve smooth concave bowl on the front face of the ear
    if (nz > 0.12) {
      const r2 = nx * nx * 1.15 + ny * ny * 0.85;
      const bowl = Math.max(0, 1 - r2 * 1.4);
      z -= bowl * 0.048 * smoothstep(0.12, 0.85, nz);
    }
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  geoCache.set(key, geo);
  return geo;
}

/** Cute plump rounded button nose matching the reference 3D boy. */
export function getSculptedNoseGeometry(): THREE.BufferGeometry {
  const key = 'nose-v5';
  const cached = geoCache.get(key);
  if (cached) return cached;

  const geo = new THREE.SphereGeometry(1, 32, 24);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);
    const tipFullness = 1 + 0.1 * smoothstep(0.4, -0.5, ny);
    pos.setXYZ(
      i,
      nx * 0.062 * tipFullness,
      ny * 0.068,
      nz * 0.058 * (nz > 0 ? 1.05 : 0.72) * tipFullness,
    );
  }
  geo.computeVertexNormals();
  geoCache.set(key, geo);
  return geo;
}

/**
 * Cozy A-line / pear-bell oversized t-shirt or scrub tunic with double-sewn bottom hem band,
 * wide plush drop-shoulders (blending seamlessly into sleeves!), and thick rib-knit crew collar.
 * Local Y in `chest`: -0.07 (hip/waist hem) up to +0.642 (crew-neck collar right under chin).
 */
export function getTorsoTunicGeometry(): THREE.BufferGeometry {
  const key = 'tunic-v5';
  const cached = geoCache.get(key);
  if (cached) return cached;

  // [y, radiusX, radiusZ, zOffset]
  const rings: [number, number, number, number][] = [
    [-0.072, 0.32, 0.23, 0.006],
    [-0.055, 0.416, 0.296, 0.011],
    [-0.032, 0.432, 0.308, 0.014], // Thick bottom hem band lower
    [0.014, 0.43, 0.306, 0.015], // Thick bottom hem band upper
    [0.025, 0.419, 0.298, 0.014], // Crisp sewn bottom hem groove!
    [0.04, 0.425, 0.303, 0.015],
    [0.16, 0.418, 0.298, 0.017], // Cozy relaxed belly drape
    [0.3, 0.408, 0.286, 0.013],
    [0.43, 0.402, 0.268, 0.008], // Broad cozy upper chest blending seamlessly into drop-shoulders
    [0.52, 0.376, 0.244, 0.005], // Smooth continuous rounded drop-shoulders (matches sleeve dome y=0.588 at x=0.295!)
    [0.584, 0.302, 0.202, 0.004],
    [0.618, 0.205, 0.162, 0.005], // Crew collar base
    [0.628, 0.152, 0.125, 0.005], // Collar inner tuck
  ];

  const sides = 40;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < rings.length; r++) {
    const [y, wx, dz, cz] = rings[r];
    for (let s = 0; s < sides; s++) {
      const phi = (s / sides) * Math.PI * 2;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);
      const x = wx * Math.sign(cosP) * Math.pow(Math.abs(cosP), 0.9);
      const z = cz + dz * Math.sign(sinP) * Math.pow(Math.abs(sinP), 0.93);
      // Gentle natural front crew-neck dip on top two rings so the collar frames the throat nicely!
      const frontDip = r >= rings.length - 3 && sinP > 0 ? -0.022 * sinP : 0;
      positions.push(x, y + frontDip, z);
    }
  }

  for (let r = 0; r < rings.length - 1; r++) {
    for (let s = 0; s < sides; s++) {
      const nextS = (s + 1) % sides;
      const a = r * sides + s;
      const b = r * sides + nextS;
      const c = (r + 1) * sides + nextS;
      const d = (r + 1) * sides + s;
      indices.push(a, d, c, a, c, b);
    }
  }

  // Bottom cap
  const bottomCenterIdx = positions.length / 3;
  positions.push(0, -0.072, 0.006);
  for (let s = 0; s < sides; s++) {
    indices.push(bottomCenterIdx, s, (s + 1) % sides);
  }

  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  bodyGeo.setIndex(indices);
  bodyGeo.computeVertexNormals();

  // Distinct, cozy, thick rounded rib-knit crew-neck collar ring hugging the base of the neck!
  const collarRing = new THREE.TorusGeometry(0.176, 0.024, 16, 36);
  collarRing.rotateX(Math.PI / 2 + 0.13);
  collarRing.scale(1.06, 1, 0.88);
  collarRing.translate(0, 0.618, 0.008);

  const merged = mergeCleanGeometries([bodyGeo, collarRing]);
  geoCache.set(key, merged);
  return merged;
}

/**
 * Seamless drop-shoulder short sleeve with thick rolled cuff & recessed inner shadow cavity.
 * Parented to `upperArmBone`: plump spherical shoulder cap blends right into the torso shoulder!
 */
export function getRolledSleeveGeometry(): THREE.BufferGeometry {
  const key = 'rolled-sleeve-v5';
  const cached = geoCache.get(key);
  if (cached) return cached;

  // Top shoulder dome sits at y = +0.098 above shoulder origin (y=0.492 -> 0.590 in chest),
  // meeting getTorsoTunicGeometry's shoulder slope in ONE continuous curve with zero bump!
  const pts = [
    new THREE.Vector2(0.088, -0.17), // Inner hollow sleeve cavity top
    new THREE.Vector2(0.104, -0.246), // Inner hollow sleeve cavity lip
    new THREE.Vector2(0.145, -0.266), // Rolled cuff bottom inner turn
    new THREE.Vector2(0.176, -0.262), // Rolled cuff bottom outer lip
    new THREE.Vector2(0.185, -0.23), // Thick rolled cuff middle
    new THREE.Vector2(0.179, -0.198), // Thick rolled cuff top
    new THREE.Vector2(0.163, -0.188), // Crisp cuff fold seam groove!
    new THREE.Vector2(0.168, -0.175),
    new THREE.Vector2(0.162, -0.085),
    new THREE.Vector2(0.152, 0.0),
    new THREE.Vector2(0.132, 0.052),
    new THREE.Vector2(0.092, 0.082),
    new THREE.Vector2(0.044, 0.095),
    new THREE.Vector2(0.0, 0.099), // Smooth low-profile drop-shoulder blend dome!
  ];

  const geo = new THREE.LatheGeometry(pts, 32);
  geo.computeVertexNormals();
  geoCache.set(key, geo);
  return geo;
}

/**
 * Tailored open short medical coat / cardigan (matching Variations 3 & 4 in the reference image!).
 * Strictly outward-facing double-walled shell with generous clearance over the tunic (ZERO z-fighting!)
 * plus soft rounded front pockets.
 */
export function getOpenCoatGeometry(): THREE.BufferGeometry {
  const key = 'open-coat-v5';
  const cached = geoCache.get(key);
  if (cached) return cached;

  const parts: THREE.BufferGeometry[] = [];

  // Every ring's inner wall (wx - thickness, dz - thickness) stays strictly outside getTorsoTunicGeometry!
  const thickness = 0.024;
  const rings: [number, number, number, number][] = [
    [-0.1, 0.468, 0.344, 0.013],
    [-0.07, 0.472, 0.348, 0.014],
    [0.06, 0.462, 0.342, 0.015],
    [0.2, 0.448, 0.332, 0.016],
    [0.35, 0.438, 0.318, 0.012],
    [0.48, 0.418, 0.292, 0.008],
    [0.568, 0.348, 0.244, 0.005],
    [0.614, 0.252, 0.198, 0.005],
  ];

  const arcSteps = 34;
  const gapHalfAngle = 0.38; // Clean open front revealing inner tee & stethoscope!
  const startAngle = Math.PI / 2 + gapHalfAngle;
  const totalArc = Math.PI * 2 - gapHalfAngle * 2;

  const positions: number[] = [];
  const indices: number[] = [];
  const stride = arcSteps * 2;

  for (let r = 0; r < rings.length; r++) {
    const [y, wx, dz, cz] = rings[r];
    for (let layer = 0; layer < 2; layer++) {
      const offset = layer === 0 ? 0 : -thickness;
      for (let s = 0; s < arcSteps; s++) {
        const u = s / (arcSteps - 1);
        const phi = startAngle + u * totalArc;
        const cosP = Math.cos(phi);
        const sinP = Math.sin(phi);
        const x = (wx + offset) * Math.sign(cosP) * Math.pow(Math.abs(cosP), 0.9);
        const z = cz + (dz + offset) * Math.sign(sinP) * Math.pow(Math.abs(sinP), 0.93);
        positions.push(x, y, z);
      }
    }
  }

  const pushQuad = (a: number, b: number, c: number, d: number) => {
    indices.push(a, b, c, a, c, d);
  };

  // Correct outward winding: as s increases (phi increases) and r increases (+Y),
  // outward normal is (r+1 - r) x (s+1 - s) -> (a, d, c, b) = (base+s, next+s, next+s+1, base+s+1)!
  for (let r = 0; r < rings.length - 1; r++) {
    const base = r * stride;
    const next = (r + 1) * stride;
    for (let s = 0; s < arcSteps - 1; s++) {
      // Outer coat wall (normals point OUTWARD)
      pushQuad(base + s, next + s, next + s + 1, base + s + 1);
      // Inner coat lining (normals point INWARD)
      pushQuad(
        base + arcSteps + s,
        base + arcSteps + s + 1,
        next + arcSteps + s + 1,
        next + arcSteps + s,
      );
    }
    // Left front vertical lapel edge (s = 0, facing +X/+Z gap)
    pushQuad(base + arcSteps, next + arcSteps, next, base);
    // Right front vertical lapel edge (s = arcSteps - 1, facing -X/+Z gap)
    pushQuad(
      base + arcSteps - 1,
      next + arcSteps - 1,
      next + stride - 1,
      base + stride - 1,
    );
  }

  // Bottom & top hem rims
  const top = (rings.length - 1) * stride;
  for (let s = 0; s < arcSteps - 1; s++) {
    pushQuad(s, s + 1, arcSteps + s + 1, arcSteps + s);
    pushQuad(top + arcSteps + s, top + arcSteps + s + 1, top + s + 1, top + s);
  }

  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  shell.setIndex(indices);
  shell.computeVertexNormals();
  parts.push(shell);

  // Cute rounded front patch pockets on lower left & right coat panels
  for (const sign of [-1, 1]) {
    const pShape = new THREE.Shape();
    const pw = 0.068;
    const ph = 0.068;
    const pr = 0.024;
    pShape.moveTo(-pw + pr, -ph);
    pShape.lineTo(pw - pr, -ph);
    pShape.quadraticCurveTo(pw, -ph, pw, -ph + pr);
    pShape.lineTo(pw, ph - pr * 0.5);
    pShape.quadraticCurveTo(pw, ph, pw - pr * 0.5, ph);
    pShape.lineTo(-pw + pr * 0.5, ph);
    pShape.quadraticCurveTo(-pw, ph, -pw, ph - pr * 0.5);
    pShape.lineTo(-pw, -ph + pr);
    pShape.quadraticCurveTo(-pw, -ph, -pw + pr, -ph);

    const pocket = new THREE.ExtrudeGeometry(pShape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 4,
      curveSegments: 12,
    });
    pocket.rotateY(sign * 0.52);
    pocket.translate(sign * 0.285, 0.045, 0.286);
    parts.push(pocket);
  }

  const merged = mergeCleanGeometries(parts);
  geoCache.set(key, merged);
  return merged;
}

/**
 * Tailored rounded protective X-ray vest apron for Radiographer (replaces raw cylinder!).
 */
export function getLeadApronGeometry(): THREE.BufferGeometry {
  const key = 'lead-apron-v5';
  const cached = geoCache.get(key);
  if (cached) return cached;

  const rings: [number, number, number, number][] = [
    [-0.08, 0.452, 0.334, 0.015],
    [0.05, 0.445, 0.33, 0.016],
    [0.24, 0.415, 0.32, 0.015],
    [0.41, 0.34, 0.3, 0.012],
    [0.53, 0.255, 0.264, 0.008],
    [0.605, 0.21, 0.205, 0.006],
  ];

  const sides = 36;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < rings.length; r++) {
    const [y, wx, dz, cz] = rings[r];
    for (let s = 0; s < sides; s++) {
      const phi = (s / sides) * Math.PI * 2;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);
      const x = wx * Math.sign(cosP) * Math.pow(Math.abs(cosP), 0.9);
      const z = cz + dz * Math.sign(sinP) * Math.pow(Math.abs(sinP), 0.93);
      positions.push(x, y, z);
    }
  }
  for (let r = 0; r < rings.length - 1; r++) {
    for (let s = 0; s < sides; s++) {
      const nextS = (s + 1) % sides;
      const a = r * sides + s;
      const b = r * sides + nextS;
      const c = (r + 1) * sides + nextS;
      const d = (r + 1) * sides + s;
      indices.push(a, d, c, a, c, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geoCache.set(key, geo);
  return geo;
}

/**
 * Unified rounded shorts/trouser pelvis saddle so there is never a hip gap
 * between the shirt hem and the articulated legs.
 */
export function getPelvisSaddleGeometry(): THREE.BufferGeometry {
  const key = 'pelvis-saddle-v4';
  const cached = geoCache.get(key);
  if (cached) return cached;

  const geo = new THREE.SphereGeometry(1, 34, 24);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);
    const x = nx * 0.355 * (1 + 0.08 * (1 - ny * ny));
    const y = ny * 0.115 + 0.015;
    const z = nz * 0.265 + 0.01;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  geoCache.set(key, geo);
  return geo;
}

export const ARM_UPPER_LEN = 0.302;
export const ARM_LOWER_LEN = 0.294;

/**
 * Continuous seamless vertex-skinned arm geometry (UpperArm bone 0 -> Forearm bone 1 -> Hand bone 2).
 * Extends slightly past wrist pivot (-totalLen - 0.024) so forearm blends seamlessly into the palm!
 */
export function getSkinnedArmGeometry(): THREE.BufferGeometry {
  const key = 'skinned-arm-v6';
  const cached = geoCache.get(key);
  if (cached) return cached;

  const totalLen = ARM_UPPER_LEN + ARM_LOWER_LEN; // 0.596
  const startY = -0.11;
  const endY = -totalLen - 0.036;
  const rings = 28;
  const sides = 20;

  const positions: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const y = startY + (endY - startY) * t;
    const u = Math.min(1.06, -y / totalLen);

    const forearmSwell = 0.008 * Math.exp(-Math.pow((u - 0.65) / 0.18, 2));
    // Smoothly transition cross-section at the wrist to match palm [rx=0.060, rz=0.071] with ZERO crease!
    const wristOval = smoothstep(0.76, 1.04, u);
    const baseRadius = 0.098 * (1 - 0.25 * Math.pow(Math.min(1, u), 1.2)) + forearmSwell;
    const radiusX = THREE.MathUtils.lerp(baseRadius, 0.06, wristOval);
    const radiusZ = THREE.MathUtils.lerp(baseRadius * 0.96, 0.071, wristOval);

    const wForearm = smoothstep(0.35, 0.66, u);
    const wWrist = smoothstep(0.84, 1.04, u) * 0.85;
    const w0 = 1 - wForearm;
    const w1 = wForearm * (1 - wWrist);
    const w2 = wForearm * wWrist;

    for (let s = 0; s < sides; s++) {
      const phi = (s / sides) * Math.PI * 2;
      positions.push(Math.cos(phi) * radiusX, y, Math.sin(phi) * radiusZ);
      skinIndices.push(0, 1, 2, 0);
      skinWeights.push(w0, w1, w2, 0);
    }
  }

  // Note: as r goes downward (-Y) and s increases (phi 0 -> PI/2), outward normal is (a, b, c) & (a, c, d)!
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < sides; s++) {
      const nextS = (s + 1) % sides;
      const a = r * sides + s;
      const b = r * sides + nextS;
      const c = (r + 1) * sides + nextS;
      const d = (r + 1) * sides + s;
      indices.push(a, b, c, a, c, d);
    }
  }

  const topCenter = positions.length / 3;
  positions.push(0, startY + 0.015, 0);
  skinIndices.push(0, 1, 2, 0);
  skinWeights.push(1, 0, 0, 0);
  for (let s = 0; s < sides; s++) {
    indices.push(topCenter, (s + 1) % sides, s);
  }
  // Open bottom end (buried inside solid palm sphere) so wrist normals stay 100% vertical & crease-free!

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geoCache.set(key, geo);
  return geo;
}

/**
 * Continuous seamless vertex-skinned long-sleeve cloth arm (UpperArm bone 0 -> Forearm bone 1 -> Hand bone 2).
 * Integrates the smooth drop-shoulder dome (y = +0.099) all the way down to a crisp tailored wrist cuff
 * (y = -totalLen + 0.062) so long sleeves bend organically at the elbow in every animation with zero gaps.
 */
export function getSkinnedLongSleeveArmGeometry(): THREE.BufferGeometry {
  const key = 'skinned-long-sleeve-arm-v1';
  const cached = geoCache.get(key);
  if (cached) return cached;

  const totalLen = ARM_UPPER_LEN + ARM_LOWER_LEN; // 0.596
  const cuffBottomY = -totalLen + 0.062; // -0.534 (cleanly above wrist watch & hand)

  // Profile [y, rx, rz] from smooth drop-shoulder dome down to turned cuff lip + inner cavity tuck
  const profileRings: [number, number, number][] = [
    [0.099, 0.008, 0.008],
    [0.094, 0.046, 0.046],
    [0.081, 0.094, 0.093],
    [0.052, 0.132, 0.13],
    [0.0, 0.15, 0.146],
    [-0.07, 0.148, 0.143],
    [-0.145, 0.138, 0.133],
    [-0.22, 0.128, 0.124],
    [-0.295, 0.122, 0.118], // Soft gentle elbow fullness
    [-0.365, 0.114, 0.11],
    [-0.43, 0.105, 0.102],
    [-0.482, 0.099, 0.096],
    [-0.494, 0.095, 0.092], // Subtle sewn cuff seam groove
    [-0.502, 0.103, 0.1], // Crisp tailored wrist cuff upper
    [-0.524, 0.103, 0.1], // Crisp tailored wrist cuff lower
    [cuffBottomY, 0.097, 0.094], // Rounded bottom cuff turn
    [cuffBottomY + 0.004, 0.075, 0.073], // Inner cuff rim
    [cuffBottomY + 0.036, 0.068, 0.066], // Inner hollow sleeve cavity
  ];

  const sides = 24;
  const positions: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < profileRings.length; r++) {
    const [y, rx, rz] = profileRings[r];
    const u = Math.max(0, Math.min(1.0, -y / totalLen));

    const wForearm = y >= -0.08 ? 0 : smoothstep(0.35, 0.66, u);
    const w0 = 1 - wForearm;
    const w1 = wForearm;

    for (let s = 0; s < sides; s++) {
      const phi = (s / sides) * Math.PI * 2;
      positions.push(Math.cos(phi) * rx, y, Math.sin(phi) * rz);
      skinIndices.push(0, 1, 2, 0);
      skinWeights.push(w0, w1, 0, 0);
    }
  }

  for (let r = 0; r < profileRings.length - 1; r++) {
    for (let s = 0; s < sides; s++) {
      const nextS = (s + 1) % sides;
      const a = r * sides + s;
      const b = r * sides + nextS;
      const c = (r + 1) * sides + nextS;
      const d = (r + 1) * sides + s;
      indices.push(a, b, c, a, c, d);
    }
  }

  // Cap top shoulder apex cleanly
  const topCenter = positions.length / 3;
  positions.push(0, 0.1, 0);
  skinIndices.push(0, 1, 2, 0);
  skinWeights.push(1, 0, 0, 0);
  for (let s = 0; s < sides; s++) {
    indices.push(topCenter, (s + 1) % sides, s);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geoCache.set(key, geo);
  return geo;
}

/**
 * Seamless vertex-skinned bare wrist bridge emerging cleanly from inside a long-sleeve cuff
 * down into the 5-finger palm (`y = -0.475 .. -0.632`).
 */
export function getSkinnedWristBridgeGeometry(): THREE.BufferGeometry {
  const key = 'skinned-wrist-bridge-v1';
  const cached = geoCache.get(key);
  if (cached) return cached;

  const totalLen = ARM_UPPER_LEN + ARM_LOWER_LEN; // 0.596
  const startY = -totalLen + 0.12; // tucked well inside sleeve cavity
  const endY = -totalLen - 0.036; // buried cleanly inside palm sphere
  const rings = 10;
  const sides = 20;

  const positions: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const y = startY + (endY - startY) * t;
    const u = Math.min(1.06, -y / totalLen);
    const wristOval = smoothstep(0.76, 1.04, u);
    const rx = THREE.MathUtils.lerp(0.065, 0.06, wristOval);
    const rz = THREE.MathUtils.lerp(0.064, 0.071, wristOval);

    const wWrist = smoothstep(0.84, 1.04, u) * 0.85;
    const w1 = 1 - wWrist;
    const w2 = wWrist;

    for (let s = 0; s < sides; s++) {
      const phi = (s / sides) * Math.PI * 2;
      positions.push(Math.cos(phi) * rx, y, Math.sin(phi) * rz);
      skinIndices.push(0, 1, 2, 0);
      skinWeights.push(0, w1, w2, 0);
    }
  }

  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < sides; s++) {
      const nextS = (s + 1) % sides;
      const a = r * sides + s;
      const b = r * sides + nextS;
      const c = (r + 1) * sides + nextS;
      const d = (r + 1) * sides + s;
      indices.push(a, b, c, a, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geoCache.set(key, geo);
  return geo;
}

/**
 * Tailored contoured medical tunic placket & rounded hip pockets conforming cleanly to getTorsoTunicGeometry()
 * with zero flat-box clipping or Z-fighting.
 */
export function getMidwifeTunicDetailsGeometries(): {
  placket: THREE.BufferGeometry;
  pocketBody: THREE.BufferGeometry;
  pocketTrim: THREE.BufferGeometry;
} {
  const pkKey = 'midwife-tunic-placket-v1';
  const pbKey = 'midwife-tunic-pocket-body-v1';
  const ptKey = 'midwife-tunic-pocket-trim-v1';
  if (geoCache.has(pkKey) && geoCache.has(pbKey) && geoCache.has(ptKey)) {
    return {
      placket: geoCache.get(pkKey)!,
      pocketBody: geoCache.get(pbKey)!,
      pocketTrim: geoCache.get(ptKey)!,
    };
  }

  // Exact ring profile from getTorsoTunicGeometry() for surface interpolation
  const tunicRings: [number, number, number, number][] = [
    [-0.055, 0.416, 0.296, 0.011],
    [-0.032, 0.432, 0.308, 0.014],
    [0.014, 0.43, 0.306, 0.015],
    [0.025, 0.419, 0.298, 0.014],
    [0.04, 0.425, 0.303, 0.015],
    [0.16, 0.418, 0.298, 0.017],
    [0.3, 0.408, 0.286, 0.013],
    [0.43, 0.402, 0.268, 0.008],
    [0.52, 0.376, 0.244, 0.005],
    [0.584, 0.302, 0.202, 0.004],
  ];

  const sampleTunic = (y: number, phi: number, offset = 0): [number, number, number] => {
    let idx = 0;
    while (idx < tunicRings.length - 2 && tunicRings[idx + 1][0] < y) idx++;
    const r0 = tunicRings[idx];
    const r1 = tunicRings[idx + 1];
    const t = Math.max(0, Math.min(1, (y - r0[0]) / Math.max(1e-5, r1[0] - r0[0])));
    const wx = THREE.MathUtils.lerp(r0[1], r1[1], t) + offset;
    const dz = THREE.MathUtils.lerp(r0[2], r1[2], t) + offset;
    const cz = THREE.MathUtils.lerp(r0[3], r1[3], t);
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);
    const x = wx * Math.sign(cosP) * Math.pow(Math.abs(cosP), 0.9);
    const z = cz + dz * Math.sign(sinP) * Math.pow(Math.abs(sinP), 0.93);
    return [x, y, z];
  };

  // Build contoured extruded-like curved patch on tunic surface
  const buildCurvedPatch = (
    yMin: number,
    yMax: number,
    phiMin: number,
    phiMax: number,
    thickness: number,
    segY: number,
    segP: number,
    roundCorners = false,
  ): THREE.BufferGeometry => {
    const positions: number[] = [];
    const indices: number[] = [];

    const gridStride = (segP + 1) * (segY + 1);
    for (let layer = 0; layer < 2; layer++) {
      for (let j = 0; j <= segY; j++) {
        const v = j / segY;
        const y = THREE.MathUtils.lerp(yMin, yMax, v);
        for (let i = 0; i <= segP; i++) {
          const u = i / segP;
          const phi = THREE.MathUtils.lerp(phiMin, phiMax, u);
          // Soft beveled outer rim thickness for plush clay-cloth read
          const edgeU = Math.min(u, 1 - u);
          const edgeV = Math.min(v, 1 - v);
          const bevel = roundCorners
            ? smoothstep(0, 0.14, edgeU) * smoothstep(0, 0.16, edgeV)
            : smoothstep(0, 0.18, edgeU);
          const off = layer === 0 ? 0.002 + thickness * (0.45 + 0.55 * bevel) : -0.004;
          const [x, py, z] = sampleTunic(y, phi, off);
          positions.push(x, py, z);
        }
      }
    }

    const idxAt = (layer: number, j: number, i: number) =>
      layer * gridStride + j * (segP + 1) + i;
    const pushQuad = (a: number, b: number, c: number, d: number) => {
      indices.push(a, b, c, a, c, d);
    };

    // Front outer surface (outward winding matches tunic: as phi increases and y increases -> (a, d, c, b))
    for (let j = 0; j < segY; j++) {
      for (let i = 0; i < segP; i++) {
        const a = idxAt(0, j, i);
        const b = idxAt(0, j, i + 1);
        const c = idxAt(0, j + 1, i + 1);
        const d = idxAt(0, j + 1, i);
        pushQuad(a, d, c, b);
      }
    }
    // Perimeter side walls so patch has clean sculpted thickness
    for (let i = 0; i < segP; i++) {
      // Bottom rim
      pushQuad(idxAt(0, 0, i), idxAt(0, 0, i + 1), idxAt(1, 0, i + 1), idxAt(1, 0, i));
      // Top rim
      pushQuad(
        idxAt(1, segY, i),
        idxAt(1, segY, i + 1),
        idxAt(0, segY, i + 1),
        idxAt(0, segY, i),
      );
    }
    for (let j = 0; j < segY; j++) {
      // phiMin rim
      pushQuad(idxAt(1, j, 0), idxAt(1, j + 1, 0), idxAt(0, j + 1, 0), idxAt(0, j, 0));
      // phiMax rim
      pushQuad(
        idxAt(0, j, segP),
        idxAt(0, j + 1, segP),
        idxAt(1, j + 1, segP),
        idxAt(1, j, segP),
      );
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  };

  // 1. Center vertical emerald placket stripe hugging tunic contour cleanly from bottom hem up under hijab scarf
  const placket = buildCurvedPatch(-0.048, 0.515, Math.PI / 2 - 0.036, Math.PI / 2 + 0.036, 0.011, 22, 6, false);

  // 2. Front-left patch pocket (viewer's left hip, -X -> phi ~ Math.PI * 0.64..0.82)
  //    + Side-rear left pocket (viewer's right-back, visible in side turnaround behind left arm!)
  const frontPocketBody = buildCurvedPatch(0.015, 0.145, Math.PI * 0.625, Math.PI * 0.805, 0.011, 10, 12, true);
  const frontPocketTrim = buildCurvedPatch(0.128, 0.16, Math.PI * 0.623, Math.PI * 0.807, 0.015, 4, 12, true);

  const sidePocketBody = buildCurvedPatch(0.015, 0.145, -Math.PI * 0.34, -Math.PI * 0.15, 0.011, 10, 12, true);
  const sidePocketTrim = buildCurvedPatch(0.128, 0.16, -Math.PI * 0.342, -Math.PI * 0.148, 0.015, 4, 12, true);

  const pocketBody = mergeCleanGeometries([frontPocketBody, sidePocketBody]);
  const pocketTrim = mergeCleanGeometries([frontPocketTrim, sidePocketTrim]);

  geoCache.set(pkKey, placket);
  geoCache.set(pbKey, pocketBody);
  geoCache.set(ptKey, pocketTrim);

  return { placket, pocketBody, pocketTrim };
}

export const LEG_UPPER_LEN = 0.318;
export const LEG_LOWER_LEN = 0.318;

/**
 * Continuous seamless vertex-skinned shorts/trouser leg with thick rolled cuff!
 * - `shortsStyle = true`: rolled-cuff shorts ending at knee level (`y = -0.345`), exposing chubby lower legs!
 * - `shortsStyle = false`: rolled-cuff medical scrub pants ending cleanly above the sneaker collar (`y = -0.525`).
 */
export function getSkinnedPantLegGeometry(shortsStyle: boolean): THREE.BufferGeometry {
  const key = `skinned-pant-v4:${shortsStyle ? 'short' : 'full'}`;
  const cached = geoCache.get(key);
  if (cached) return cached;

  const totalBoneLen = LEG_UPPER_LEN + LEG_LOWER_LEN; // 0.636
  const startY = 0.065;
  const cuffEnd = shortsStyle ? -0.345 : -0.525;
  const rings = 24;
  const sides = 24;

  const positions: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const y = startY + (cuffEnd - startY) * t;
    const u = Math.max(0, -y / totalBoneLen);

    // Crisp thick rolled cuff band on the bottom of shorts/pants (matching the khaki shorts in reference!)
    const cuffZone = smoothstep(0.74, 0.8, t) * (1 - smoothstep(0.96, 1.0, t) * 0.22);
    const seamDip = Math.exp(-Math.pow((t - 0.73) / 0.025, 2)) * 0.011;
    const baseRadius = shortsStyle
      ? 0.168 * (1 - 0.05 * t)
      : 0.164 * (1 - 0.18 * Math.pow(t, 1.08));
    const radius = baseRadius - seamDip + cuffZone * 0.02;

    const wShin = smoothstep(0.34, 0.64, u);
    const w0 = 1 - wShin;
    const w1 = wShin;

    for (let s = 0; s < sides; s++) {
      const phi = (s / sides) * Math.PI * 2;
      positions.push(Math.cos(phi) * radius, y, Math.sin(phi) * radius * 0.96);
      skinIndices.push(0, 1, 2, 0);
      skinWeights.push(w0, w1, 0, 0);
    }
  }

  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < sides; s++) {
      const nextS = (s + 1) % sides;
      const a = r * sides + s;
      const b = r * sides + nextS;
      const c = (r + 1) * sides + nextS;
      const d = (r + 1) * sides + s;
      indices.push(a, b, c, a, c, d);
    }
  }

  const botCenter = positions.length / 3;
  const wEnd = smoothstep(0.34, 0.64, -cuffEnd / totalBoneLen);
  positions.push(0, cuffEnd + 0.022, 0);
  skinIndices.push(0, 1, 2, 0);
  skinWeights.push(1 - wEnd, wEnd, 0, 0);
  const lastRing = rings * sides;
  for (let s = 0; s < sides; s++) {
    indices.push(botCenter, lastRing + s, lastRing + ((s + 1) % sides));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geoCache.set(key, geo);
  return geo;
}

/**
 * Seamless skinned lower calf & ankle bridging from inside the rolled shorts/trouser cuff
 * cleanly down into the sneaker ankle collar (`y = -0.635`).
 */
export function getSkinnedLowerCalfGeometry(shortsStyle: boolean): THREE.BufferGeometry {
  const key = `skinned-calf-v3:${shortsStyle ? 'short' : 'full'}`;
  const cached = geoCache.get(key);
  if (cached) return cached;

  const totalBoneLen = LEG_UPPER_LEN + LEG_LOWER_LEN; // 0.636
  const startY = shortsStyle ? -0.31 : -0.495;
  const endY = -0.64;
  const rings = 14;
  const sides = 20;

  const positions: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const y = startY + (endY - startY) * t;
    const u = Math.min(1, Math.max(0, -y / totalBoneLen));
    const radius = shortsStyle ? 0.112 * (1 - 0.17 * t) : 0.095 * (1 - 0.08 * t);

    const wShin = smoothstep(0.34, 0.64, u);
    const wAnkle = smoothstep(0.88, 1.0, u) * 0.3;
    const w0 = 1 - wShin;
    const w1 = wShin * (1 - wAnkle);
    const w2 = wShin * wAnkle;

    for (let s = 0; s < sides; s++) {
      const phi = (s / sides) * Math.PI * 2;
      positions.push(Math.cos(phi) * radius, y, Math.sin(phi) * radius * 0.96);
      skinIndices.push(0, 1, 2, 0);
      skinWeights.push(w0, w1, w2, 0);
    }
  }

  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < sides; s++) {
      const nextS = (s + 1) % sides;
      const a = r * sides + s;
      const b = r * sides + nextS;
      const c = (r + 1) * sides + nextS;
      const d = (r + 1) * sides + s;
      indices.push(a, b, c, a, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geoCache.set(key, geo);
  return geo;
}

/**
 * Cute compact low-top chunky cream sneakers matching the reference image (~10% of total height):
 * smooth rounded flat-bottomed cream rubber sole, plump smooth vinyl canvas upper,
 * padded ankle collar, rounded tongue, and 3 crisp cream shoelaces.
 * Origin is `footBone` (ankle pivot at y = ANKLE_HEIGHT = 0.175 above ground y = 0).
 */
export const ANKLE_HEIGHT = 0.175;

export function getChunkySneakerGeometries(): {
  sole: THREE.BufferGeometry;
  upper: THREE.BufferGeometry;
  laces: THREE.BufferGeometry;
} {
  const soleKey = 'sneaker-sole-v3';
  const upperKey = 'sneaker-upper-v3';
  const laceKey = 'sneaker-lace-v3';

  if (geoCache.has(soleKey) && geoCache.has(upperKey) && geoCache.has(laceKey)) {
    return {
      sole: geoCache.get(soleKey)!,
      upper: geoCache.get(upperKey)!,
      laces: geoCache.get(laceKey)!,
    };
  }

  const makeFootShape = (hw: number, back: number, front: number) => {
    const s = new THREE.Shape();
    s.moveTo(-hw * 0.85, -back);
    s.quadraticCurveTo(0, -back - 0.032, hw * 0.85, -back);
    s.bezierCurveTo(hw * 1.04, -back * 0.2, hw * 1.08, front * 0.45, hw * 0.92, front * 0.82);
    s.quadraticCurveTo(0, front * 1.08, -hw * 0.92, front * 0.82);
    s.bezierCurveTo(-hw * 1.08, front * 0.45, -hw * 1.04, -back * 0.2, -hw * 0.85, -back);
    return s;
  };

  // 1. Compact flat-bottomed cream rubber outsole (0.056 thick, touches y = -ANKLE_HEIGHT = -0.175)
  const soleParts: THREE.BufferGeometry[] = [];
  const baseSole = new THREE.ExtrudeGeometry(makeFootShape(0.128, 0.126, 0.228), {
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: 0.011,
    bevelSize: 0.012,
    bevelSegments: 5,
    curveSegments: 22,
  });
  baseSole.rotateX(Math.PI / 2);
  // Extrude Z spans [-0.011, 0.047], so after rotateX(PI/2) Y spans [-0.047, +0.011].
  // Shift Y by -ANKLE_HEIGHT + 0.047 so flat bottom sits strictly at y = -ANKLE_HEIGHT!
  baseSole.translate(0, -ANKLE_HEIGHT + 0.047, 0.032);
  soleParts.push(baseSole);

  // Subtle midsole foxing rim
  const foxing = new THREE.ExtrudeGeometry(makeFootShape(0.124, 0.122, 0.224), {
    depth: 0.016,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 3,
    curveSegments: 22,
  });
  foxing.rotateX(Math.PI / 2);
  foxing.translate(0, -ANKLE_HEIGHT + 0.068, 0.032);
  soleParts.push(foxing);

  const sole = mergeCleanGeometries(soleParts);

  // 2. Smooth plump low-top vinyl sneaker upper (sculpted from smooth deformed spheres + collar torus!)
  const upperParts: THREE.BufferGeometry[] = [];

  // Smooth sculpted shoe body dome (indexed SphereGeometry -> buttery smooth normals!)
  const shoeDome = new THREE.SphereGeometry(1, 36, 24);
  const spos = shoeDome.attributes.position;
  for (let i = 0; i < spos.count; i++) {
    const nx = spos.getX(i);
    const ny = spos.getY(i);
    const nz = spos.getZ(i);

    const toeWiden = 1 + 0.08 * smoothstep(-0.3, 0.6, nz);
    const x = nx * 0.126 * toeWiden;
    // Flatten bottom inside sole, plump rounded toe box & instep on top
    const yNorm = ny < 0 ? ny * 0.35 : Math.pow(ny, 0.82);
    // Taper toe height gently forward while keeping heel/ankle higher
    const heelRise = smoothstep(0.35, -0.75, nz) * 0.036;
    const y = yNorm * 0.095 + heelRise;
    const z = nz > 0 ? nz * 0.228 : nz * 0.132;
    spos.setXYZ(i, x, y, z);
  }
  shoeDome.translate(0, -ANKLE_HEIGHT + 0.072, 0.038);
  shoeDome.computeVertexNormals();
  upperParts.push(shoeDome);

  // Smooth ankle quarter & collar cuff wrapping around the ankle
  const ankleQuarter = new THREE.CylinderGeometry(0.104, 0.122, 0.085, 28, 1, false);
  ankleQuarter.scale(0.96, 1, 1.08);
  ankleQuarter.translate(0, -ANKLE_HEIGHT + 0.145, -0.008);
  upperParts.push(ankleQuarter);

  const collar = new THREE.TorusGeometry(0.102, 0.024, 14, 28);
  collar.rotateX(Math.PI / 2);
  collar.scale(0.96, 1.08, 1);
  collar.translate(0, -ANKLE_HEIGHT + 0.186, -0.008);
  upperParts.push(collar);

  // Cute rounded padded tongue rising slightly in front of ankle
  const tongue = new THREE.CapsuleGeometry(0.052, 0.045, 8, 16);
  tongue.scale(1.12, 1, 0.34);
  tongue.rotateX(-0.42);
  tongue.translate(0, -ANKLE_HEIGHT + 0.178, 0.078);
  upperParts.push(tongue);

  const upper = mergeCleanGeometries(upperParts);

  // 3. Three neat cream shoelace bars across the instep
  const laceParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const zPos = 0.078 + i * 0.044;
    const yPos = -ANKLE_HEIGHT + 0.168 - i * 0.017;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.068, yPos - 0.014, zPos),
      new THREE.Vector3(-0.032, yPos + 0.01, zPos + 0.008),
      new THREE.Vector3(0.032, yPos + 0.01, zPos + 0.008),
      new THREE.Vector3(0.068, yPos - 0.014, zPos),
    ]);
    laceParts.push(new THREE.TubeGeometry(curve, 16, 0.0115, 10, false));
  }
  const laces = mergeCleanGeometries(laceParts);

  geoCache.set(soleKey, sole);
  geoCache.set(upperKey, upper);
  geoCache.set(laceKey, laces);
  return { sole, upper, laces };
}

/**
 * Sculpted closed-end clay hair pillow-lock along a 3D spline!
 * Stays indexed so `mergeCleanGeometries` computes silky-smooth continuous normals!
 * Tapers cleanly to 0 at both root and tip so there are ZERO open tube holes.
 */
function makeSculptedHairLock(
  points: [number, number, number][],
  radiusWidth: number,
  radiusThickness = radiusWidth * 0.72,
  tipPower = 0.62,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const tubularSegments = 24;
  const radialSegments = 14;
  const frames = curve.computeFrenetFrames(tubularSegments, false);

  const positions: number[] = [];
  const indices: number[] = [];
  const pt = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    curve.getPointAt(u, pt);
    // Plump rounded cushion profile (0.68 power keeps tips soft & rounded, never sharp spikes!)
    const env = Math.pow(Math.sin(Math.PI * Math.pow(u, tipPower)), 0.68);
    const N = frames.normals[i];
    const B = frames.binormals[i];

    for (let j = 0; j < radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2;
      const cosT = Math.cos(theta) * radiusThickness * env;
      const sinT = Math.sin(theta) * radiusWidth * env;
      positions.push(
        pt.x + N.x * cosT + B.x * sinT,
        pt.y + N.y * cosT + B.y * sinT,
        pt.z + N.z * cosT + B.z * sinT,
      );
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const nextJ = (j + 1) % radialSegments;
      const a = i * radialSegments + j;
      const b = i * radialSegments + nextJ;
      const c = (i + 1) * radialSegments + nextJ;
      const d = (i + 1) * radialSegments + j;
      indices.push(a, b, c, a, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Plush fitted cranial hair volume hugging the back, crown, temples, and cute neat sideburns
 * right in front of the ears while keeping the forehead & face 100% clean.
 */
function makeHairBaseCap(extraBackLength = 0, hairlineNy = 0.32): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 44, 32);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    const crownVolume = ny > 0 ? 1 + 0.06 * ny : 1;
    const x = nx * 0.482 * crownVolume;
    let y = ny * 0.468 + 0.042;
    let z = nz * 0.436 - 0.024;

    // Retract front lower hemisphere cleanly behind forehead (above eyebrows y = 0.165),
    // while keeping cute rounded temple sideburns right in front of the ears!
    if (nz > -0.06 && ny < hairlineNy) {
      const frontFactor = smoothstep(-0.06, 0.42, nz);
      const sideburn =
        Math.exp(-Math.pow((Math.abs(nx) - 0.9) / 0.16, 2)) *
        (1 - smoothstep(0.06, 0.36, nz)) *
        smoothstep(-0.22, 0.05, ny);
      const lift = (hairlineNy - ny) * frontFactor * (1 - sideburn * 0.72);
      y += lift * 0.52;
      z -= lift * 0.42;
    }

    // Back hairline taper / optional bob length
    if (ny < -0.55 && nz < 0.05 && extraBackLength === 0) {
      const neckTuck = smoothstep(-0.55, -0.95, ny);
      z += neckTuck * 0.06;
      y += neckTuck * 0.08;
    } else if (ny < 0 && nz < 0.18 && extraBackLength > 0) {
      y -= extraBackLength * smoothstep(0.18, -0.45, nz) * smoothstep(0, -0.85, ny);
    }

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Bespoke clay-sculpted hair & headwear geometries matching the reference image & its 4 variations.
 */
export function getHairStyleGeometries(style: HairStyle): {
  primaryHair?: THREE.BufferGeometry;
  headwear?: THREE.BufferGeometry;
  headwearTrim?: THREE.BufferGeometry;
} {
  const cachePrefix = `hairstyle-v8:${style}`;

  if (style === 'curly-tousled') {
    const k = `${cachePrefix}:main`;
    if (!geoCache.has(k)) {
      // 1. Base scalp cap (smooth skull-hugging foundation)
      const parts: THREE.BufferGeometry[] = [makeHairBaseCap(0, 0.32)];

      // 2. Voluminous sculpted crown dome (smooth organic clay volume with harmonic waves)
      const crownDome = new THREE.SphereGeometry(1, 48, 36);
      const cpos = crownDome.attributes.position;
      for (let i = 0; i < cpos.count; i++) {
        const nx = cpos.getX(i);
        const ny = cpos.getY(i);
        const nz = cpos.getZ(i);
        const wave =
          1 +
          0.068 * Math.sin(nx * 4.4 + nz * 3.6) * smoothstep(-0.2, 0.6, ny) +
          0.055 * Math.cos(nz * 4.2 - nx * 3.4) * smoothstep(-0.15, 0.7, ny);
        cpos.setXYZ(i, nx * 0.498 * wave, ny * 0.285 * wave + 0.315, nz * 0.446 * wave + 0.005);
      }
      crownDome.computeVertexNormals();
      parts.push(crownDome);

      // 3. Hand-sculpted chunky Catmull-Rom wavy hair locks & playful crown tufts
      const locks: { pts: [number, number, number][]; w: number; th: number; tp?: number }[] = [
        // --- Playful messy crown tufts flicking upward (signature boy bedhead in reference image!) ---
        {
          pts: [
            [-0.15, 0.46, 0.04],
            [-0.13, 0.58, 0.08],
            [-0.09, 0.68, 0.06],
            [-0.07, 0.73, 0.04],
          ],
          w: 0.095,
          th: 0.075,
          tp: 0.8,
        },
        {
          pts: [
            [-0.03, 0.47, 0.08],
            [-0.05, 0.60, 0.14],
            [0.01, 0.69, 0.12],
            [0.04, 0.74, 0.09],
          ],
          w: 0.092,
          th: 0.072,
          tp: 0.8,
        },
        {
          pts: [
            [0.08, 0.46, 0.06],
            [0.14, 0.58, 0.09],
            [0.18, 0.67, 0.05],
            [0.22, 0.71, 0.02],
          ],
          w: 0.088,
          th: 0.068,
          tp: 0.8,
        },
        {
          pts: [
            [0.22, 0.43, 0.02],
            [0.30, 0.53, 0.04],
            [0.36, 0.62, 0.0],
            [0.40, 0.66, -0.03],
          ],
          w: 0.082,
          th: 0.062,
          tp: 0.78,
        },
        {
          pts: [
            [-0.24, 0.43, 0.02],
            [-0.32, 0.53, 0.04],
            [-0.38, 0.61, 0.0],
            [-0.42, 0.65, -0.03],
          ],
          w: 0.082,
          th: 0.062,
          tp: 0.78,
        },

        // --- Forehead Bangs & Drooping Curls (Drop DOWN past hairline over upper forehead!) ---
        {
          // Center-left signature drooping curl (drops down toward the nose/brow bridge!)
          pts: [
            [-0.14, 0.42, 0.26],
            [-0.10, 0.32, 0.40],
            [-0.05, 0.22, 0.42],
            [-0.02, 0.14, 0.41],
          ],
          w: 0.105,
          th: 0.082,
          tp: 0.68,
        },
        {
          // Center-right drooping curl
          pts: [
            [0.04, 0.43, 0.26],
            [0.09, 0.33, 0.40],
            [0.13, 0.23, 0.41],
            [0.16, 0.15, 0.395],
          ],
          w: 0.102,
          th: 0.078,
          tp: 0.68,
        },
        {
          // Left-center curl curving down-left
          pts: [
            [-0.26, 0.40, 0.24],
            [-0.22, 0.30, 0.37],
            [-0.17, 0.20, 0.39],
            [-0.13, 0.13, 0.38],
          ],
          w: 0.102,
          th: 0.078,
          tp: 0.68,
        },
        {
          // Right-center curl curving down-right
          pts: [
            [0.19, 0.40, 0.24],
            [0.24, 0.30, 0.36],
            [0.28, 0.20, 0.37],
            [0.31, 0.13, 0.35],
          ],
          w: 0.098,
          th: 0.075,
          tp: 0.68,
        },
        {
          // Left temple framing curl
          pts: [
            [-0.38, 0.34, 0.16],
            [-0.36, 0.24, 0.28],
            [-0.31, 0.15, 0.32],
            [-0.26, 0.08, 0.32],
          ],
          w: 0.088,
          th: 0.068,
          tp: 0.68,
        },
        {
          // Right temple framing curl
          pts: [
            [0.36, 0.34, 0.16],
            [0.38, 0.24, 0.26],
            [0.34, 0.15, 0.29],
            [0.29, 0.08, 0.29],
          ],
          w: 0.085,
          th: 0.065,
          tp: 0.68,
        },

        // --- Front-Mid Forehead Overlapping Wave Layer ---
        {
          pts: [
            [-0.34, 0.38, 0.18],
            [-0.18, 0.42, 0.32],
            [0.02, 0.38, 0.35],
            [0.12, 0.31, 0.33],
          ],
          w: 0.118,
          th: 0.09,
        },
        {
          pts: [
            [-0.08, 0.41, 0.30],
            [0.12, 0.43, 0.33],
            [0.28, 0.37, 0.27],
            [0.36, 0.28, 0.20],
          ],
          w: 0.115,
          th: 0.088,
        },

        // --- Mid-Crown & Side Volume ---
        {
          pts: [
            [-0.32, 0.46, 0.06],
            [-0.08, 0.54, 0.18],
            [0.18, 0.51, 0.16],
            [0.32, 0.44, 0.08],
          ],
          w: 0.125,
          th: 0.095,
        },
        {
          pts: [
            [-0.24, 0.48, -0.06],
            [0.0, 0.55, 0.04],
            [0.22, 0.50, -0.04],
          ],
          w: 0.122,
          th: 0.092,
        },

        // --- Side Volume & Temple Sideburns (Framing the ears cleanly) ---
        {
          pts: [
            [-0.41, 0.22, 0.14],
            [-0.45, 0.1, 0.09],
            [-0.42, -0.01, 0.04],
          ],
          w: 0.078,
          th: 0.058,
        },
        {
          pts: [
            [0.41, 0.22, 0.14],
            [0.45, 0.1, 0.09],
            [0.42, -0.01, 0.04],
          ],
          w: 0.078,
          th: 0.058,
        },
        {
          pts: [
            [-0.35, 0.24, 0.01],
            [-0.47, 0.33, 0.07],
            [-0.37, 0.44, 0.11],
          ],
          w: 0.115,
          th: 0.085,
        },
        {
          pts: [
            [0.35, 0.24, 0.01],
            [0.47, 0.33, 0.07],
            [0.37, 0.44, 0.11],
          ],
          w: 0.115,
          th: 0.085,
        },

        // --- Back of Head & Nape Curls (Full, soft 360-degree roundness) ---
        {
          pts: [
            [-0.25, 0.38, -0.21],
            [0.0, 0.46, -0.26],
            [0.25, 0.38, -0.21],
          ],
          w: 0.125,
          th: 0.095,
        },
        {
          pts: [
            [-0.33, 0.28, -0.16],
            [-0.37, 0.16, -0.24],
            [-0.24, 0.04, -0.28],
          ],
          w: 0.11,
          th: 0.082,
        },
        {
          pts: [
            [0.33, 0.28, -0.16],
            [0.37, 0.16, -0.24],
            [0.24, 0.04, -0.28],
          ],
          w: 0.11,
          th: 0.082,
        },
        {
          pts: [
            [-0.14, 0.08, -0.31],
            [0.0, 0.02, -0.34],
            [0.14, 0.08, -0.31],
          ],
          w: 0.102,
          th: 0.078,
        },
      ];

      for (const l of locks) {
        parts.push(makeSculptedHairLock(l.pts, l.w, l.th, l.tp ?? 0.62));
      }

      const merged = mergeCleanGeometries(parts);
      geoCache.set(k, merged);
    }
    return { primaryHair: geoCache.get(k)! };
  }

  if (style === 'curly-fluffy-doctor') {
    const k = `${cachePrefix}:doctor-curls-v2`;
    if (!geoCache.has(k)) {
      const parts: THREE.BufferGeometry[] = [makeHairBaseCap(0, 0.42)];

      // Sculpted organic teardrop/bean curl puff builder (natural swirling clay curls, NOT uniform spheres!)
      const addCurlPuff = (
        cx: number,
        cy: number,
        cz: number,
        rx: number,
        ry: number,
        rz: number,
        rotX = 0,
        rotY = 0,
        rotZ = 0,
        taper = 0.16,
      ) => {
        const puff = new THREE.SphereGeometry(1, 20, 14);
        const p = puff.attributes.position;
        for (let i = 0; i < p.count; i++) {
          let x = p.getX(i);
          let y = p.getY(i);
          let z = p.getZ(i);
          // Subtle asymmetric organic curl taper & wave crease so every lock feels hand-sculpted
          const swell = 1 + taper * y - 0.08 * Math.sin(x * 3.2 + z * 2.5);
          x = x * rx * swell;
          y = y * ry;
          z = z * rz * (1 + 0.06 * Math.cos(y * 2.8));
          p.setXYZ(i, x, y, z);
        }
        if (rotX) puff.rotateX(rotX);
        if (rotY) puff.rotateY(rotY);
        if (rotZ) puff.rotateZ(rotZ);
        puff.translate(cx, cy, cz);
        puff.computeVertexNormals();
        parts.push(puff);
      };

      // Inner plump cranial hair core (keeps zero gaps between overlapping sculpted curl clusters)
      addCurlPuff(0, 0.34, -0.04, 0.475, 0.31, 0.435, 0, 0, 0, 0.04);

      // 1. TOP CROWN LIVELY ASYMMETRIC FLOOFY CURLS (taller sculpted peak matching reference silhouette!)
      const crownPuffs: [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number?,
      ][] = [
        // Heroic lively top-center peaking curls (slightly taller asymmetric crest!)
        [-0.11, 0.665, 0.06, 0.145, 0.135, 0.135, 0.14, 0.1, 0.28, 0.18],
        [0.10, 0.675, 0.05, 0.15, 0.142, 0.138, 0.12, -0.1, -0.22, 0.18],
        [-0.27, 0.585, 0.02, 0.142, 0.125, 0.132, 0.12, 0.25, 0.42, 0.16],
        [0.28, 0.575, 0.02, 0.14, 0.124, 0.13, 0.12, -0.25, -0.4, 0.16],
        [0.01, 0.635, -0.09, 0.16, 0.14, 0.148, -0.14, 0, 0.08, 0.15],
        [-0.20, 0.60, -0.12, 0.15, 0.132, 0.14, -0.12, 0.22, 0.3, 0.15],
        [0.21, 0.59, -0.11, 0.148, 0.13, 0.138, -0.12, -0.22, -0.3, 0.15],
        // Upper front crown wave row
        [-0.38, 0.47, 0.12, 0.138, 0.12, 0.126, 0.22, 0.35, 0.45, 0.16],
        [-0.19, 0.525, 0.215, 0.148, 0.126, 0.134, 0.28, 0.18, 0.26, 0.18],
        [0.03, 0.54, 0.235, 0.152, 0.128, 0.136, 0.28, -0.05, -0.14, 0.18],
        [0.22, 0.515, 0.20, 0.144, 0.122, 0.13, 0.26, -0.2, -0.28, 0.16],
        [0.39, 0.46, 0.11, 0.136, 0.118, 0.124, 0.22, -0.35, -0.45, 0.16],
      ];

      // 2. SCALLOPED CURLY FOREHEAD BANGS (lifted cleanly above eyebrows so bold '\ /' brows shine!)
      const frontBangs: [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number?,
      ][] = [
        [-0.38, 0.315, 0.245, 0.12, 0.102, 0.112, 0.3, 0.42, 0.24, 0.14],
        [-0.23, 0.385, 0.34, 0.128, 0.104, 0.115, 0.36, 0.2, 0.2, 0.16],
        [-0.06, 0.40, 0.375, 0.132, 0.106, 0.118, 0.38, 0.04, 0.12, 0.16],
        [0.11, 0.39, 0.368, 0.128, 0.104, 0.115, 0.38, -0.08, -0.14, 0.16],
        [0.26, 0.37, 0.33, 0.124, 0.102, 0.112, 0.35, -0.22, -0.22, 0.16],
        [0.39, 0.305, 0.235, 0.118, 0.10, 0.108, 0.3, -0.42, -0.26, 0.14],
        // Scalloped curling fringe accents sitting at y=0.315..0.325 (leaving clean forehead above y=0.19!)
        [-0.15, 0.32, 0.372, 0.092, 0.074, 0.086, 0.42, 0.12, 0.22, 0.14],
        [0.03, 0.325, 0.382, 0.096, 0.076, 0.088, 0.44, -0.04, -0.14, 0.14],
        [0.19, 0.31, 0.362, 0.09, 0.072, 0.084, 0.42, -0.15, -0.22, 0.14],
      ];

      // 3. SIDE TEMPLES, ABOVE-EAR CURLS & SIDEBURNS (wrapping cleanly around ears in 3/4 & Side views!)
      const sidePuffs: [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number?,
      ][] = [
        // Left side (-X)
        [-0.47, 0.36, 0.05, 0.134, 0.12, 0.126, 0, 0.22, 0.35, 0.15],
        [-0.48, 0.24, 0.14, 0.115, 0.105, 0.112, 0.1, 0.32, 0.24, 0.12],
        [-0.465, 0.14, 0.04, 0.098, 0.105, 0.098, 0, 0.1, 0.18, 0.1],
        [-0.50, 0.28, -0.11, 0.138, 0.124, 0.132, -0.1, 0.1, 0.24, 0.15],
        [-0.495, 0.11, -0.16, 0.132, 0.122, 0.128, -0.1, 0, 0.18, 0.14],
        [-0.43, -0.05, -0.19, 0.12, 0.11, 0.12, -0.15, 0.2, 0.12, 0.12],
        // Right side (+X)
        [0.47, 0.36, 0.05, 0.134, 0.12, 0.126, 0, -0.22, -0.35, 0.15],
        [0.48, 0.24, 0.14, 0.115, 0.105, 0.112, 0.1, -0.32, -0.24, 0.12],
        [0.465, 0.14, 0.04, 0.098, 0.105, 0.098, 0, -0.1, -0.18, 0.1],
        [0.50, 0.28, -0.11, 0.138, 0.124, 0.132, -0.1, -0.1, -0.24, 0.15],
        [0.495, 0.11, -0.16, 0.132, 0.122, 0.128, -0.1, 0, -0.18, 0.14],
        [0.43, -0.05, -0.19, 0.12, 0.11, 0.12, -0.15, -0.2, -0.12, 0.12],
      ];

      // 4. FULL DENSE BACK-OF-HEAD & NAPE CURL CLUSTERS (matching Tampak Samping & Tampak Belakang!)
      const backPuffs: [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number?,
      ][] = [
        // Upper rear crown
        [-0.32, 0.47, -0.22, 0.148, 0.13, 0.14, -0.22, 0.3, 0.28, 0.16],
        [-0.11, 0.51, -0.28, 0.154, 0.134, 0.146, -0.26, 0.12, 0.14, 0.16],
        [0.13, 0.50, -0.28, 0.152, 0.134, 0.144, -0.26, -0.12, -0.14, 0.16],
        [0.33, 0.46, -0.21, 0.146, 0.128, 0.138, -0.22, -0.3, -0.28, 0.16],
        // Mid rear layer (lush sculpted rear silhouette in Side view!)
        [-0.38, 0.28, -0.29, 0.146, 0.13, 0.144, -0.2, 0.35, 0.18, 0.15],
        [-0.19, 0.32, -0.385, 0.152, 0.134, 0.15, -0.28, 0.15, 0.1, 0.15],
        [0.02, 0.33, -0.405, 0.156, 0.138, 0.152, -0.3, 0, -0.06, 0.15],
        [0.22, 0.31, -0.375, 0.15, 0.132, 0.148, -0.28, -0.15, -0.12, 0.15],
        [0.39, 0.27, -0.28, 0.144, 0.128, 0.142, -0.2, -0.35, -0.18, 0.15],
        // Lower-mid rear layer
        [-0.36, 0.08, -0.34, 0.14, 0.126, 0.138, -0.15, 0.3, 0.12, 0.14],
        [-0.16, 0.10, -0.425, 0.148, 0.132, 0.144, -0.2, 0.12, 0.06, 0.14],
        [0.05, 0.11, -0.435, 0.15, 0.134, 0.146, -0.22, -0.05, -0.06, 0.14],
        [0.23, 0.09, -0.405, 0.144, 0.128, 0.14, -0.2, -0.18, -0.12, 0.14],
        [0.37, 0.07, -0.33, 0.138, 0.124, 0.136, -0.15, -0.3, -0.12, 0.14],
        // Bottom nape fringe curls
        [-0.28, -0.09, -0.32, 0.126, 0.112, 0.124, -0.1, 0.25, 0.08, 0.12],
        [-0.11, -0.11, -0.37, 0.132, 0.116, 0.128, -0.12, 0.1, 0, 0.12],
        [0.09, -0.11, -0.37, 0.132, 0.116, 0.128, -0.12, -0.1, 0, 0.12],
        [0.26, -0.09, -0.32, 0.126, 0.112, 0.124, -0.1, -0.25, -0.08, 0.12],
        [-0.18, -0.22, -0.28, 0.11, 0.094, 0.106, 0, 0.15, 0, 0.1],
        [0.0, -0.23, -0.31, 0.116, 0.096, 0.11, 0, 0, 0, 0.1],
        [0.18, -0.22, -0.28, 0.11, 0.094, 0.106, 0, -0.15, 0, 0.1],
      ];

      for (const p of [...crownPuffs, ...frontBangs, ...sidePuffs, ...backPuffs]) {
        addCurlPuff(...p);
      }

      const merged = mergeCleanGeometries(parts);
      geoCache.set(k, merged);
    }
    return { primaryHair: geoCache.get(k)! };
  }

  if (style === 'nurse-swept-fluffy') {
    const k = `${cachePrefix}:nurse-swept-v2`;
    if (!geoCache.has(k)) {
      const parts: THREE.BufferGeometry[] = [];

      // 1. Full sculpted cranial hair shell covering crown, temples, behind ears, and rear skull down to clean nape!
      const shell = new THREE.SphereGeometry(1, 44, 34);
      const sp = shell.attributes.position;
      for (let i = 0; i < sp.count; i++) {
        const nx = sp.getX(i);
        const ny = sp.getY(i);
        const nz = sp.getZ(i);

        // Keep face opening cleanly clear (front lower hemisphere) while wrapping richly behind ears & down to nape
        const frontMask = smoothstep(0.05, 0.42, nz);
        const lowerCut = THREE.MathUtils.lerp(-0.29, 0.24, frontMask);
        const earWrap = smoothstep(0.18, -0.06, nz) * smoothstep(0.35, 0.85, Math.abs(nx));

        let y = ny;
        if (y < lowerCut) {
          y = lowerCut + (y - lowerCut) * 0.06;
        }
        const rx = 0.518 + (ny > 0.2 ? 0.016 * smoothstep(0.2, 0.7, ny) : 0);
        const ry = y > 0 ? 0.488 + 0.055 * smoothstep(0.1, 0.9, y) : 0.46;
        const rz = nz < 0 ? 0.495 : 0.455;

        let py = y * ry + 0.085;
        if (nz < -0.1 && ny < 0) {
          py -= smoothstep(-0.1, -0.55, nz) * smoothstep(0, -0.65, ny) * 0.095;
        }
        if (earWrap > 0 && ny < 0.05) {
          py -= earWrap * 0.04;
        }
        sp.setXYZ(i, nx * rx, py, nz * rz - 0.018);
      }
      shell.computeVertexNormals();
      parts.push(shell);

      // 2. Plush rounded crown dome cushion for smooth, lush Pixar silhouette (no flat peak!)
      const crownDome = new THREE.SphereGeometry(1, 40, 28);
      const cdPos = crownDome.attributes.position;
      for (let i = 0; i < cdPos.count; i++) {
        const nx = cdPos.getX(i);
        const ny = cdPos.getY(i);
        const nz = cdPos.getZ(i);
        const backBoost = nz < 0 ? 1 + 0.09 * Math.min(1, -nz) : 1;
        cdPos.setXYZ(
          i,
          nx * 0.515,
          ny * 0.30 + 0.325,
          nz * 0.475 * backBoost - 0.025,
        );
      }
      crownDome.computeVertexNormals();
      parts.push(crownDome);

      // 3. Sculpted smooth overlapping swept clay waves (ZERO spiky cones — exact match to Image 1 Front/Side/Back!)
      const waves: { pts: [number, number, number][]; w: number; th: number; tp?: number }[] = [
        // --- A. Plush Swept Voluminous Top Crest Waves ---
        {
          pts: [
            [-0.26, 0.51, 0.08],
            [-0.08, 0.655, 0.09],
            [0.14, 0.635, 0.02],
            [0.32, 0.51, -0.06],
          ],
          w: 0.162,
          th: 0.118,
          tp: 0.48,
        },
        {
          pts: [
            [-0.18, 0.56, -0.08],
            [0.02, 0.67, -0.06],
            [0.22, 0.585, -0.14],
            [0.38, 0.43, -0.22],
          ],
          w: 0.165,
          th: 0.12,
          tp: 0.48,
        },
        {
          pts: [
            [-0.38, 0.42, 0.06],
            [-0.22, 0.555, 0.16],
            [-0.02, 0.58, 0.195],
            [0.18, 0.525, 0.155],
          ],
          w: 0.148,
          th: 0.108,
          tp: 0.48,
        },
        {
          pts: [
            [-0.06, 0.54, 0.175],
            [0.15, 0.565, 0.175],
            [0.33, 0.475, 0.115],
            [0.44, 0.35, 0.02],
          ],
          w: 0.145,
          th: 0.105,
          tp: 0.48,
        },

        // --- B. Neat Plump Rounded Forehead Bangs (smooth scalloped waves above brows — Tampak Depan!) ---
        {
          pts: [
            [-0.40, 0.37, 0.15],
            [-0.39, 0.275, 0.27],
            [-0.34, 0.195, 0.325],
          ],
          w: 0.114,
          th: 0.085,
          tp: 0.52,
        },
        {
          pts: [
            [-0.27, 0.44, 0.235],
            [-0.23, 0.325, 0.365],
            [-0.18, 0.228, 0.388],
          ],
          w: 0.124,
          th: 0.092,
          tp: 0.5,
        },
        {
          pts: [
            [-0.10, 0.46, 0.26],
            [-0.05, 0.34, 0.395],
            [-0.02, 0.238, 0.408],
          ],
          w: 0.128,
          th: 0.094,
          tp: 0.5,
        },
        {
          pts: [
            [0.08, 0.46, 0.26],
            [0.13, 0.34, 0.39],
            [0.16, 0.238, 0.396],
          ],
          w: 0.124,
          th: 0.092,
          tp: 0.5,
        },
        {
          pts: [
            [0.24, 0.43, 0.23],
            [0.29, 0.315, 0.348],
            [0.32, 0.218, 0.354],
          ],
          w: 0.118,
          th: 0.088,
          tp: 0.5,
        },
        {
          pts: [
            [0.38, 0.36, 0.15],
            [0.40, 0.265, 0.258],
            [0.37, 0.185, 0.298],
          ],
          w: 0.108,
          th: 0.082,
          tp: 0.52,
        },

        // --- C. Seamless Tapered Temple Sideburns & Full Behind-Ear Side Waves (Tampak Samping!) ---
        {
          pts: [
            [-0.42, 0.31, 0.15],
            [-0.465, 0.19, 0.135],
            [-0.47, 0.08, 0.11],
            [-0.445, 0.0, 0.085],
          ],
          w: 0.092,
          th: 0.068,
          tp: 0.58,
        },
        {
          pts: [
            [0.42, 0.31, 0.15],
            [0.465, 0.19, 0.135],
            [0.47, 0.08, 0.11],
            [0.445, 0.0, 0.085],
          ],
          w: 0.092,
          th: 0.068,
          tp: 0.58,
        },
        {
          pts: [
            [-0.42, 0.40, 0.04],
            [-0.50, 0.28, -0.09],
            [-0.47, 0.12, -0.23],
            [-0.36, -0.06, -0.32],
          ],
          w: 0.15,
          th: 0.112,
          tp: 0.48,
        },
        {
          pts: [
            [0.42, 0.40, 0.04],
            [0.50, 0.28, -0.09],
            [0.47, 0.12, -0.23],
            [0.36, -0.06, -0.32],
          ],
          w: 0.15,
          th: 0.112,
          tp: 0.48,
        },
        {
          pts: [
            [-0.47, 0.16, -0.14],
            [-0.45, 0.01, -0.22],
            [-0.34, -0.14, -0.29],
          ],
          w: 0.135,
          th: 0.096,
          tp: 0.52,
        },
        {
          pts: [
            [0.47, 0.16, -0.14],
            [0.45, 0.01, -0.22],
            [0.34, -0.14, -0.29],
          ],
          w: 0.135,
          th: 0.096,
          tp: 0.52,
        },

        // --- D. Lush Seamless Layered Swept Back Waves down to Clean Rounded Nape (Tampak Belakang!) ---
        {
          pts: [
            [-0.38, 0.46, -0.16],
            [-0.12, 0.54, -0.31],
            [0.16, 0.49, -0.32],
            [0.39, 0.37, -0.20],
          ],
          w: 0.168,
          th: 0.122,
          tp: 0.46,
        },
        {
          pts: [
            [-0.44, 0.31, -0.21],
            [-0.16, 0.38, -0.39],
            [0.14, 0.35, -0.40],
            [0.43, 0.25, -0.24],
          ],
          w: 0.172,
          th: 0.124,
          tp: 0.46,
        },
        {
          pts: [
            [-0.44, 0.15, -0.27],
            [-0.16, 0.21, -0.44],
            [0.14, 0.19, -0.44],
            [0.42, 0.11, -0.28],
          ],
          w: 0.168,
          th: 0.122,
          tp: 0.48,
        },
        {
          pts: [
            [-0.38, 0.0, -0.30],
            [-0.12, 0.04, -0.43],
            [0.14, 0.02, -0.43],
            [0.38, -0.02, -0.30],
          ],
          w: 0.158,
          th: 0.114,
          tp: 0.5,
        },
        {
          pts: [
            [-0.30, -0.14, -0.28],
            [-0.08, -0.17, -0.38],
            [0.10, -0.17, -0.38],
            [0.30, -0.14, -0.28],
          ],
          w: 0.145,
          th: 0.102,
          tp: 0.52,
        },
      ];

      for (const w of waves) {
        parts.push(makeSculptedHairLock(w.pts, w.w, w.th, w.tp ?? 0.5));
      }

      const merged = mergeCleanGeometries(parts);
      geoCache.set(k, merged);
    }
    return { primaryHair: geoCache.get(k)! };
  }

  if (style === 'parted-fluffy') {
    const k = `${cachePrefix}:main`;
    if (!geoCache.has(k)) {
      const parts: THREE.BufferGeometry[] = [makeHairBaseCap(0)];

      const crownDome = new THREE.SphereGeometry(1, 34, 24);
      crownDome.scale(0.47, 0.23, 0.415);
      crownDome.translate(0.01, 0.3, 0.01);
      parts.push(crownDome);

      // Smooth side-parted swept locks (Variation 1 in reference image!)
      const locks: { pts: [number, number, number][]; w: number; th: number }[] = [
        {
          pts: [
            [-0.3, 0.34, 0.16],
            [-0.08, 0.48, 0.27],
            [0.18, 0.44, 0.28],
            [0.38, 0.28, 0.18],
          ],
          w: 0.135,
          th: 0.092,
        },
        {
          pts: [
            [-0.26, 0.34, 0.26],
            [-0.04, 0.37, 0.388],
            [0.19, 0.33, 0.38],
            [0.36, 0.24, 0.25],
          ],
          w: 0.11,
          th: 0.076,
        },
        {
          pts: [
            [-0.26, 0.35, 0.22],
            [-0.38, 0.28, 0.27],
            [-0.44, 0.14, 0.16],
          ],
          w: 0.098,
          th: 0.07,
        },
        {
          pts: [
            [0.34, 0.27, 0.19],
            [0.44, 0.15, 0.13],
            [0.43, 0.03, 0.06],
          ],
          w: 0.078,
          th: 0.056,
        },
      ];
      for (const l of locks) {
        parts.push(makeSculptedHairLock(l.pts, l.w, l.th, 0.58));
      }

      const merged = mergeCleanGeometries(parts);
      geoCache.set(k, merged);
    }
    return { primaryHair: geoCache.get(k)! };
  }

  if (style === 'doctor-f-wavy') {
    const hk = `${cachePrefix}:doctor-f-wavy-v2`;
    if (!geoCache.has(hk)) {
      const parts: THREE.BufferGeometry[] = [makeHairBaseCap(0.24)];

      // 1. Plush sculpted crown & back cranium volume (lifted cleanly above eyebrows!)
      const crownDome = new THREE.SphereGeometry(1, 36, 26);
      crownDome.scale(0.49, 0.31, 0.455);
      crownDome.translate(0.02, 0.305, -0.055);
      parts.push(crownDome);

      // Soft lower-back hair fullness cradling the nape cleanly
      const napeVolume = new THREE.SphereGeometry(1, 32, 24);
      napeVolume.scale(0.47, 0.34, 0.36);
      napeVolume.translate(0.02, -0.03, -0.18);
      parts.push(napeVolume);

      // 2. Signature voluminous side-parted sweeping wave arching high from left part (-X) across right temple (+X)
      parts.push(
        makeSculptedHairLock(
          [
            [-0.14, 0.475, 0.16],
            [0.09, 0.545, 0.25],
            [0.34, 0.445, 0.23],
            [0.485, 0.2, 0.11],
            [0.475, -0.08, -0.07],
            [0.39, -0.24, -0.2],
          ],
          0.16,
          0.115,
          0.52,
        ),
      );

      // Secondary upper crest wave layering softly behind the primary sweep for rich Pixar clay depth
      parts.push(
        makeSculptedHairLock(
          [
            [-0.16, 0.505, 0.02],
            [0.12, 0.575, 0.09],
            [0.4, 0.41, 0.03],
            [0.5, 0.1, -0.12],
            [0.42, -0.21, -0.24],
          ],
          0.168,
          0.122,
          0.54,
        ),
      );

      // 3. Soft curved left-side curtain wave sweeping smoothly from the part down around left temple (-X)
      parts.push(
        makeSculptedHairLock(
          [
            [-0.12, 0.47, 0.2],
            [-0.31, 0.42, 0.27],
            [-0.46, 0.22, 0.14],
            [-0.47, -0.05, -0.04],
            [-0.38, -0.23, -0.18],
          ],
          0.142,
          0.102,
          0.54,
        ),
      );

      // Left-side rear fullness wave tucking cleanly behind left ear
      parts.push(
        makeSculptedHairLock(
          [
            [-0.22, 0.44, -0.02],
            [-0.44, 0.22, -0.08],
            [-0.47, -0.05, -0.16],
            [-0.36, -0.26, -0.22],
          ],
          0.155,
          0.115,
          0.56,
        ),
      );

      // 4. Sculpted glossy back-cascade waves for clean 360-degree turnaround
      for (const offsetX of [-0.22, 0, 0.22]) {
        parts.push(
          makeSculptedHairLock(
            [
              [offsetX * 0.7, 0.42, -0.22],
              [offsetX * 1.05, 0.16, -0.44],
              [offsetX * 0.95, -0.12, -0.44],
              [offsetX * 0.65, -0.32, -0.32],
            ],
            0.16,
            0.115,
            0.55,
          ),
        );
      }

      // 5. Dr. Maya's signature plush wavy low side-ponytail / chignon peeking cleanly behind lower-right jaw (+X, -Z)!
      const ponytailBase = new THREE.SphereGeometry(1, 30, 22);
      ponytailBase.scale(0.24, 0.23, 0.22);
      ponytailBase.translate(0.37, -0.17, -0.25);
      parts.push(ponytailBase);

      const ponytailFlare = new THREE.SphereGeometry(1, 28, 20);
      ponytailFlare.scale(0.2, 0.175, 0.19);
      ponytailFlare.translate(0.46, -0.24, -0.19);
      parts.push(ponytailFlare);

      parts.push(
        makeSculptedHairLock(
          [
            [0.24, -0.06, -0.36],
            [0.42, -0.15, -0.28],
            [0.52, -0.26, -0.15],
            [0.44, -0.34, -0.06],
          ],
          0.13,
          0.105,
          0.56,
        ),
      );

      const merged = mergeCleanGeometries(parts);
      geoCache.set(hk, merged);
    }
    return { primaryHair: geoCache.get(hk)! };
  }

  if (style === 'wavy-bob' || style === 'nurse-bob-cap') {
    const hk = `${cachePrefix}:hair-v5`;
    if (!geoCache.has(hk)) {
      const parts: THREE.BufferGeometry[] = [makeHairBaseCap(0.24)];

      const topCrown = new THREE.SphereGeometry(1, 34, 24);
      topCrown.scale(0.478, 0.245, 0.425);
      topCrown.translate(0, 0.305, -0.02);
      parts.push(topCrown);

      // Soft lower-back nape & low nurse chignon/bun peeking subtly behind the ears (matching Image 2!)
      const napeBun = new THREE.SphereGeometry(1, 30, 22);
      napeBun.scale(0.41, 0.26, 0.32);
      napeBun.translate(0.03, -0.14, -0.24);
      parts.push(napeBun);

      const sideBunAccent = new THREE.SphereGeometry(1, 26, 18);
      sideBunAccent.scale(0.22, 0.19, 0.2);
      sideBunAccent.translate(0.32, -0.17, -0.21);
      parts.push(sideBunAccent);

      // Signature diagonal side-swept bangs parting from right (+X) and sweeping across forehead to left temple (-X),
      // keeping the forehead & determined eyebrows completely clear and leaving the white nurse cap fully visible above!
      parts.push(
        makeSculptedHairLock(
          [
            [0.16, 0.39, 0.25],
            [-0.06, 0.375, 0.35],
            [-0.28, 0.325, 0.325],
            [-0.435, 0.21, 0.2],
          ],
          0.122,
          0.088,
          0.54,
        ),
      );

      // Secondary layered upper bang sweep for rich sculpted strand groove
      parts.push(
        makeSculptedHairLock(
          [
            [0.18, 0.42, 0.16],
            [-0.08, 0.408, 0.265],
            [-0.33, 0.35, 0.235],
            [-0.46, 0.195, 0.1],
          ],
          0.125,
          0.09,
          0.54,
        ),
      );

      // Right-side parted wave sweeping smoothly from the part (+X) down around the right temple & ear
      parts.push(
        makeSculptedHairLock(
          [
            [0.16, 0.395, 0.235],
            [0.34, 0.34, 0.28],
            [0.455, 0.19, 0.17],
            [0.45, 0.01, 0.04],
          ],
          0.122,
          0.088,
          0.55,
        ),
      );

      // Cheek/ear-framing side locks tucking neatly toward the low back bun
      for (const sign of [-1, 1]) {
        parts.push(
          makeSculptedHairLock(
            [
              [sign * 0.35, 0.3, 0.08],
              [sign * 0.465, 0.12, 0.05],
              [sign * 0.435, -0.09, -0.04],
              [sign * 0.33, -0.21, -0.17],
            ],
            0.128,
            0.092,
            0.55,
          ),
        );
      }

      const merged = mergeCleanGeometries(parts);
      geoCache.set(hk, merged);
    }

    if (style === 'wavy-bob') {
      return { primaryHair: geoCache.get(hk)! };
    }

    // Classic curved white nurse cap with crisp emerald-green top piping stripe (exact match to Image 2!)
    const ck = `${cachePrefix}:cap-v5`;
    const tk = `${cachePrefix}:trim-v5`;
    if (!geoCache.has(ck) || !geoCache.has(tk)) {
      const shape = new THREE.Shape();
      shape.moveTo(-0.235, 0);
      shape.lineTo(0.235, 0);
      shape.quadraticCurveTo(0.29, 0.145, 0.228, 0.188);
      shape.quadraticCurveTo(0, 0.226, -0.228, 0.188);
      shape.quadraticCurveTo(-0.29, 0.145, -0.235, 0);

      const cap = new THREE.ExtrudeGeometry(shape, {
        depth: 0.19,
        bevelEnabled: true,
        bevelThickness: 0.025,
        bevelSize: 0.023,
        bevelSegments: 5,
        curveSegments: 18,
      });
      // Gently curve front face along Z so it hugs the head curvature naturally
      const cpos = cap.attributes.position;
      for (let i = 0; i < cpos.count; i++) {
        const x = cpos.getX(i);
        const y = cpos.getY(i);
        const z = cpos.getZ(i);
        cpos.setXYZ(i, x, y, z - x * x * 0.42);
      }
      cap.rotateX(-0.08);
      cap.translate(0, 0.455, 0.085);
      cap.computeVertexNormals();
      geoCache.set(ck, mergeCleanGeometries([cap]));

      // Crisp emerald-green top piping arch along the upper front rim of the nurse cap
      const stripeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.238, 0.162, 0.196 - 0.238 * 0.238 * 0.42),
        new THREE.Vector3(-0.128, 0.194, 0.2 - 0.128 * 0.128 * 0.42),
        new THREE.Vector3(0, 0.206, 0.202),
        new THREE.Vector3(0.128, 0.194, 0.2 - 0.128 * 0.128 * 0.42),
        new THREE.Vector3(0.238, 0.162, 0.196 - 0.238 * 0.238 * 0.42),
      ]);
      const stripe = new THREE.TubeGeometry(stripeCurve, 26, 0.012, 10, false);
      stripe.rotateX(-0.08);
      stripe.translate(0, 0.455, 0.085);
      stripe.computeVertexNormals();
      geoCache.set(tk, mergeCleanGeometries([stripe]));
    }
    return {
      primaryHair: geoCache.get(hk)!,
      headwear: geoCache.get(ck)!,
      headwearTrim: geoCache.get(tk)!,
    };
  }

  if (style === 'hijab-draped') {
    const ok = `${cachePrefix}:outer-v10`;
    const ik = `${cachePrefix}:inner-v10`;
    if (!geoCache.has(ok) || !geoCache.has(ik)) {
      // Exact sculpted head surface evaluator matching getSculptedHeadGeometry() so inner cap &
      // hijab face rim sit strictly outside the skin with ZERO Z-fighting!
      const evalHeadSurface = (nx: number, ny: number, nz: number): [number, number, number] => {
        const cheekBand = Math.exp(-Math.pow((ny + 0.25) / 0.38, 2));
        const templeTaper = ny > 0.16 ? 0.036 * Math.pow((ny - 0.16) / 0.84, 1.45) : 0;
        const chinSoft = ny < -0.58 ? 0.032 * Math.pow((-ny - 0.58) / 0.42, 1.6) : 0;
        const x = nx * 0.452 * (1 + 0.095 * cheekBand - templeTaper - chinSoft * 0.45);
        const y = ny * 0.446 * (1 - (ny < -0.62 ? 0.038 * Math.pow((-ny - 0.62) / 0.38, 2) : 0));
        let z = nz * 0.412;
        if (nz > 0) {
          z *= 1 - 0.068 * Math.pow(nz, 2) + 0.045 * cheekBand * nz;
        } else {
          z *= 1 + 0.025 * Math.pow(-nz, 1.4);
        }
        return [x, y, z];
      };

      // 1. Smooth matte-white inner underscarf cap (ciput): single-walled outward-facing sculpted shell
      //    extending high enough (elEnd = 1.24) to tuck deeply beneath the emerald hijab arch so
      //    ZERO peach skin can ever peek above the white inner cap!
      const cSegU = 36;
      const cSegV = 14;
      const cPos: number[] = [];
      const cIdx: number[] = [];

      for (let j = 0; j <= cSegV; j++) {
        const v = j / cSegV;
        for (let i = 0; i <= cSegU; i++) {
          const u = i / cSegU;
          const az = (u - 0.5) * 2.2;
          // Gentle classic curved ciput hem sitting cleanly above the eyebrows
          const centerDip = 0.016 * Math.exp(-Math.pow(az / 0.38, 2));
          const elStart = 0.495 - centerDip + 0.055 * Math.pow(Math.abs(az), 1.6);
          const elEnd = 1.24;
          const el =
            v === 0
              ? elStart + 0.012
              : THREE.MathUtils.lerp(elStart, elEnd, Math.max(0, (v - 0.07) / 0.93));

          const cosE = Math.cos(el);
          const sinE = Math.sin(el);
          const nx = Math.sin(az) * cosE;
          const ny = sinE;
          const nz = Math.cos(az) * cosE;
          const [hx, hy, hz] = evalHeadSurface(nx, ny, nz);

          const lift = v === 0 ? 0.002 : 0.015 + 0.004 * smoothstep(0.07, 0.22, v);
          cPos.push(hx + nx * lift, hy + ny * lift, hz + nz * lift);
        }
      }

      for (let j = 0; j < cSegV; j++) {
        for (let i = 0; i < cSegU; i++) {
          const a = j * (cSegU + 1) + i;
          const b = j * (cSegU + 1) + i + 1;
          const c = (j + 1) * (cSegU + 1) + i + 1;
          const d = (j + 1) * (cSegU + 1) + i;
          cIdx.push(a, b, c, a, c, d);
        }
      }

      const inner = new THREE.BufferGeometry();
      inner.setAttribute('position', new THREE.Float32BufferAttribute(cPos, 3));
      inner.setIndex(cIdx);
      inner.computeVertexNormals();
      geoCache.set(ik, inner);

      // 2. Sculpted Plush Emerald Outer Hijab Hood (Polar parameterization around +Z face opening!)
      //    Lowered forehead arch leaves ONLY a slim, delicate crescent of white ciput visible above
      //    the eyebrows, while framing the cheeks snugly and curving into a plush rounded back volume.
      const parts: THREE.BufferGeometry[] = [];
      const hSegA = 64;
      const hSegV = 42;
      const hPos: number[] = [];
      const hIdx: number[] = [];

      for (let j = 0; j <= hSegV; j++) {
        const v = j / hSegV;
        let theta: number;
        let rimDepthScale = 1;
        if (v < 0.1) {
          const t = v / 0.1;
          theta = THREE.MathUtils.lerp(0.83, 0.91, t);
          rimDepthScale = THREE.MathUtils.lerp(0.955, 1.0, smoothstep(0, 1, t));
        } else {
          const t = (v - 0.1) / 0.9;
          theta = THREE.MathUtils.lerp(0.91, Math.PI, t);
        }

        for (let i = 0; i <= hSegA; i++) {
          const alpha = (i / hSegA) * Math.PI * 2;
          const cosA = Math.cos(alpha);
          const sinA = Math.sin(alpha);

          const topFactor = Math.max(0, sinA);
          const botFactor = Math.max(0, -sinA);
          const sideFactor = Math.abs(cosA);

          // Lower forehead opening (-0.175 * topFactor) so emerald arch sits right over upper ciput,
          // exposing only a crisp ~0.045 white inner-cap crescent matching the turnaround sheet!
          const rimMask = Math.exp(-Math.pow((v - 0.1) / 0.28, 2));
          const thetaAdj =
            theta +
            rimMask * (-0.175 * Math.pow(topFactor, 1.15) - 0.025 * sideFactor - 0.035 * botFactor);
          const sT = Math.sin(Math.min(Math.PI, Math.max(0.001, thetaAdj)));
          const cT = Math.cos(Math.min(Math.PI, Math.max(0.001, thetaAdj)));

          const ux = cosA * sT;
          const uy = sinA * sT;
          const uz = cT;

          const backMask = smoothstep(0.15, -0.85, uz);
          const lowerBackTaper = smoothstep(-0.18, -0.92, uy) * backMask;

          // Sleeker, closer-hugging Pixar studio proportions (front & side!)
          const rx =
            0.508 *
            (1 +
              0.04 * Math.exp(-Math.pow((uy + 0.14) / 0.45, 2)) +
              0.025 * backMask -
              0.075 * lowerBackTaper) *
            rimDepthScale;

          const ry =
            0.506 *
            (1 + 0.048 * smoothstep(0.0, 0.9, uy) + 0.028 * backMask) *
            rimDepthScale;

          // Plush rounded rear hijab volume matching Image 2 side turnaround
          const rzFront = 0.448 * rimDepthScale;
          const rzBack = 0.548 * (1 - 0.06 * lowerBackTaper);
          const rz = uz >= 0 ? rzFront : THREE.MathUtils.lerp(rzFront, rzBack, smoothstep(0, -0.7, uz));

          let x = ux * rx;
          let y = uy * ry + 0.02 + 0.018 * backMask * (1 - lowerBackTaper);
          let z = uz * rz - 0.015;

          if (v < 0.14) {
            const [hx, hy, hz] = evalHeadSurface(ux, uy, uz);
            const lipClearance = v < 0.05 ? 0.026 : 0.038;
            const blend = 1 - smoothstep(0.0, 0.14, v);
            x = THREE.MathUtils.lerp(x, hx + ux * lipClearance, blend * 0.72);
            y = THREE.MathUtils.lerp(y, hy + uy * lipClearance, blend * 0.65);
            z = THREE.MathUtils.lerp(z, hz + uz * lipClearance, blend * 0.65);
          }

          if (uy < -0.55 && uz < 0.25) {
            const neckFlow = smoothstep(-0.55, -0.98, uy);
            y -= neckFlow * 0.052;
            z += neckFlow * 0.032;
          }

          hPos.push(x, y, z);
        }
      }

      for (let j = 0; j < hSegV; j++) {
        for (let i = 0; i < hSegA; i++) {
          const a = j * (hSegA + 1) + i;
          const b = j * (hSegA + 1) + i + 1;
          const c = (j + 1) * (hSegA + 1) + i + 1;
          const d = (j + 1) * (hSegA + 1) + i;
          hIdx.push(a, d, c, a, c, b);
        }
      }

      const hood = new THREE.BufferGeometry();
      hood.setAttribute('position', new THREE.Float32BufferAttribute(hPos, 3));
      hood.setIndex(hIdx);
      hood.computeVertexNormals();
      parts.push(hood);

      // 3. Sculpted Organic Layered Draped Neck Scarf Folds wrapping cleanly OVER the tunic collar
      //    so zero white collar fabric pokes through from front or side!
      const makeOrganicScarfLoop = (
        pts: [number, number, number][],
        radiusX: number,
        radiusY: number,
        tubularSegs = 52,
      ): THREE.BufferGeometry => {
        const curve = new THREE.CatmullRomCurve3(
          pts.map((p) => new THREE.Vector3(...p)),
          true,
          'centripetal',
        );
        const tube = new THREE.TubeGeometry(curve, tubularSegs, 1, 18, true);
        const frames = curve.computeFrenetFrames(tubularSegs, true);
        const pos = tube.attributes.position;
        const radialSegs = 18;
        const pCenter = new THREE.Vector3();
        const tmp = new THREE.Vector3();
        for (let tIdx = 0; tIdx <= tubularSegs; tIdx++) {
          const u = tIdx / tubularSegs;
          curve.getPointAt(u % 1, pCenter);
          const frontSwell = 1 + 0.18 * Math.max(0, pCenter.z / 0.28);
          const N = frames.normals[tIdx];
          const B = frames.binormals[tIdx];
          for (let rIdx = 0; rIdx <= radialSegs; rIdx++) {
            const idx = tIdx * (radialSegs + 1) + rIdx;
            const phi = (rIdx / radialSegs) * Math.PI * 2;
            tmp
              .copy(pCenter)
              .addScaledVector(N, Math.cos(phi) * radiusX * frontSwell)
              .addScaledVector(B, Math.sin(phi) * radiusY * frontSwell);
            pos.setXYZ(idx, tmp.x, tmp.y, tmp.z);
          }
        }
        tube.computeVertexNormals();
        return tube;
      };

      // Fold 1: Plush upper chin-hug scarf roll sweeping back cleanly into nape
      parts.push(
        makeOrganicScarfLoop(
          [
            [0.0, -0.435, 0.275],
            [0.255, -0.415, 0.185],
            [0.31, -0.395, -0.02],
            [0.215, -0.375, -0.235],
            [0.0, -0.365, -0.305],
            [-0.215, -0.382, -0.235],
            [-0.31, -0.405, -0.02],
            [-0.255, -0.425, 0.185],
          ],
          0.068,
          0.058,
        ),
      );

      // Fold 2: Wider asymmetric layered scarf wrap draping cleanly over tunic crew collar
      parts.push(
        makeOrganicScarfLoop(
          [
            [0.025, -0.502, 0.302],
            [0.295, -0.472, 0.185],
            [0.345, -0.448, -0.04],
            [0.235, -0.435, -0.265],
            [0.0, -0.445, -0.33],
            [-0.235, -0.442, -0.265],
            [-0.345, -0.458, -0.04],
            [-0.29, -0.482, 0.185],
          ],
          0.074,
          0.06,
        ),
      );

      // Fold 3: Soft sculpted crescent drape resting over upper chest center (exact Image 2 silhouette!)
      const frontDrapeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.295, -0.478, 0.145),
        new THREE.Vector3(-0.175, -0.532, 0.268),
        new THREE.Vector3(0.0, -0.556, 0.312),
        new THREE.Vector3(0.175, -0.528, 0.266),
        new THREE.Vector3(0.295, -0.472, 0.142),
      ]);
      const frontDrape = new THREE.TubeGeometry(frontDrapeCurve, 30, 0.058, 16, false);
      frontDrape.scale(1, 0.78, 1);
      frontDrape.computeVertexNormals();
      parts.push(frontDrape);

      // Inner solid collar baffle tucked inside the scarf folds so NO white tunic collar can peek through!
      const innerCollarCore = new THREE.CylinderGeometry(0.225, 0.285, 0.16, 28);
      innerCollarCore.scale(1.06, 1, 0.92);
      innerCollarCore.translate(0, -0.468, 0.018);
      parts.push(innerCollarCore);

      // Soft rounded nape transition bridging the rear hijab hood seamlessly into the rear scarf folds
      const napeBridge = new THREE.SphereGeometry(1, 24, 18);
      napeBridge.scale(0.32, 0.17, 0.24);
      napeBridge.translate(0, -0.33, -0.21);
      napeBridge.computeVertexNormals();
      parts.push(napeBridge);

      const merged = mergeCleanGeometries(parts);
      geoCache.set(ok, merged);
    }
    return { headwear: geoCache.get(ok)!, headwearTrim: geoCache.get(ik)! };
  }

  if (style === 'surgical-bouffant') {
    const hk = `${cachePrefix}:hair`;
    const ck = `${cachePrefix}:cap`;
    const tk = `${cachePrefix}:trim`;
    if (!geoCache.has(ck)) {
      const wisps: THREE.BufferGeometry[] = [];
      for (const sign of [-1, 1]) {
        wisps.push(
          makeSculptedHairLock(
            [
              [sign * 0.41, 0.22, 0.15],
              [sign * 0.455, 0.08, 0.11],
              [sign * 0.435, -0.06, 0.06],
            ],
            0.068,
            0.05,
            0.6,
          ),
        );
      }
      geoCache.set(hk, mergeCleanGeometries(wisps));

      // Raised slightly (+0.065) so cute arched eyebrows sit cleanly visible below the scrub headband!
      const cap = new THREE.SphereGeometry(1, 40, 28);
      const pos = cap.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const nx = pos.getX(i);
        const ny = pos.getY(i);
        const nz = pos.getZ(i);
        const pleat = 1 + 0.016 * Math.sin(Math.atan2(nx, nz) * 12) * smoothstep(-0.2, 0.5, ny);
        const x = nx * 0.495 * pleat;
        let y = ny * 0.295 + 0.3;
        const z = nz * 0.452 * pleat - 0.022;
        if (ny < -0.25) {
          y = -0.25 * 0.295 + 0.3 - (-ny - 0.25) * 0.05;
        }
        pos.setXYZ(i, x, y, z);
      }
      cap.computeVertexNormals();
      geoCache.set(ck, cap);

      const band = new THREE.TorusGeometry(0.444, 0.04, 14, 36);
      band.rotateX(Math.PI / 2 - 0.1);
      band.scale(1.04, 0.91, 1);
      band.translate(0, 0.268, -0.012);
      band.computeVertexNormals();
      geoCache.set(tk, band);
    }
    return {
      primaryHair: geoCache.get(hk)!,
      headwear: geoCache.get(ck)!,
      headwearTrim: geoCache.get(tk)!,
    };
  }

  // 'responder-cap' (Paramedic rounded tactical cap + curved visor attached cleanly at y = 0.23!)
  const hk = `${cachePrefix}:hair`;
  const ck = `${cachePrefix}:cap`;
  if (!geoCache.has(ck)) {
    geoCache.set(hk, makeHairBaseCap(0));

    const capParts: THREE.BufferGeometry[] = [];
    const crown = new THREE.SphereGeometry(1, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.52);
    crown.scale(0.49, 0.34, 0.45);
    crown.rotateX(-0.08);
    crown.translate(0, 0.21, -0.015);
    capParts.push(crown);

    // Sculpted curved baseball-cap visor centered around origin BEFORE translating up to y = 0.235!
    const visorShape = new THREE.Shape();
    visorShape.moveTo(-0.31, -0.04);
    visorShape.quadraticCurveTo(0, 0.21, 0.31, -0.04);
    visorShape.quadraticCurveTo(0, 0.04, -0.31, -0.04);
    const visor = new THREE.ExtrudeGeometry(visorShape, {
      depth: 0.022,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 3,
      curveSegments: 20,
    });
    visor.rotateX(Math.PI / 2 + 0.14);
    visor.translate(0, 0.245, 0.34);
    capParts.push(visor);

    const btn = new THREE.SphereGeometry(0.036, 14, 10);
    btn.scale(1, 0.5, 1);
    btn.translate(0, 0.55, -0.035);
    capParts.push(btn);

    geoCache.set(ck, mergeCleanGeometries(capParts));
  }
  return { primaryHair: geoCache.get(hk)!, headwear: geoCache.get(ck)! };
}

/**
 * Crossbody medical kit pouch & diagonal strap (direct signature detail from the reference image!).
 * Parented to `chest`: diagonal strap from right shoulder (-X, viewer's left) across chest to
 * left hip (+X, viewer's right) + plump rounded flap pouch with button snap!
 */
export function getCrossbodyPouchGeometries(): {
  strap: THREE.BufferGeometry;
  bagBody: THREE.BufferGeometry;
  lowerPanel: THREE.BufferGeometry;
  flap: THREE.BufferGeometry;
  flapTrim: THREE.BufferGeometry;
  button: THREE.BufferGeometry;
  strapAndBag: THREE.BufferGeometry;
} {
  const strapKey = 'crossbody-strap-v10';
  const bodyKey = 'crossbody-body-v10';
  const lowerKey = 'crossbody-lower-v10';
  const flapKey = 'crossbody-flap-v10';
  const trimKey = 'crossbody-trim-v10';
  const btnKey = 'crossbody-btn-v10';
  const bagKey = 'crossbody-merged-v10';
  if (
    geoCache.has(strapKey) &&
    geoCache.has(bodyKey) &&
    geoCache.has(lowerKey) &&
    geoCache.has(flapKey) &&
    geoCache.has(trimKey) &&
    geoCache.has(btnKey) &&
    geoCache.has(bagKey)
  ) {
    return {
      strap: geoCache.get(strapKey)!,
      bagBody: geoCache.get(bodyKey)!,
      lowerPanel: geoCache.get(lowerKey)!,
      flap: geoCache.get(flapKey)!,
      flapTrim: geoCache.get(trimKey)!,
      button: geoCache.get(btnKey)!,
      strapAndBag: geoCache.get(bagKey)!,
    };
  }

  // Smooth flat-ribbon diagonal crossbody strap emerging seamlessly from under the hijab neck fold
  // across the front chest straight into the top of the pouch, then sweeping neatly behind the left arm!
  const strapCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-0.185, 0.575, 0.155),
      new THREE.Vector3(-0.115, 0.485, 0.272),
      new THREE.Vector3(-0.025, 0.365, 0.304),
      new THREE.Vector3(0.08, 0.24, 0.316),
      new THREE.Vector3(0.17, 0.135, 0.31),
      new THREE.Vector3(0.285, 0.115, 0.205),
      new THREE.Vector3(0.395, 0.125, -0.02),
      new THREE.Vector3(0.295, 0.245, -0.255),
      new THREE.Vector3(0.03, 0.435, -0.28),
      new THREE.Vector3(-0.175, 0.565, -0.085),
    ],
    true,
    'centripetal',
  );
  const strapSegs = 64;
  const strapRadial = 12;
  const strap = new THREE.TubeGeometry(strapCurve, strapSegs, 0.022, strapRadial, true);
  // Flatten cross-section subtly toward surface normal so it reads as a tailored woven strap
  const sFrames = strapCurve.computeFrenetFrames(strapSegs, true);
  const sPos = strap.attributes.position;
  const sCenter = new THREE.Vector3();
  const sTmp = new THREE.Vector3();
  for (let tIdx = 0; tIdx <= strapSegs; tIdx++) {
    const u = tIdx / strapSegs;
    strapCurve.getPointAt(u % 1, sCenter);
    const outDir = new THREE.Vector3(sCenter.x, 0, sCenter.z).normalize();
    const tangent = sFrames.tangents[tIdx];
    const widthDir = new THREE.Vector3().crossVectors(tangent, outDir).normalize();
    const thickDir = new THREE.Vector3().crossVectors(widthDir, tangent).normalize();
    for (let rIdx = 0; rIdx <= strapRadial; rIdx++) {
      const idx = tIdx * (strapRadial + 1) + rIdx;
      const phi = (rIdx / strapRadial) * Math.PI * 2;
      sTmp
        .copy(sCenter)
        .addScaledVector(widthDir, Math.cos(phi) * 0.026)
        .addScaledVector(thickDir, Math.sin(phi) * 0.013);
      sPos.setXYZ(idx, sTmp.x, sTmp.y, sTmp.z);
    }
  }
  strap.computeVertexNormals();

  // Helper for rounded rectangle shape
  const makeRoundedRect = (w: number, h: number, r: number) => {
    const s = new THREE.Shape();
    s.moveTo(-w + r, -h);
    s.lineTo(w - r, -h);
    s.quadraticCurveTo(w, -h, w, -h + r);
    s.lineTo(w, h - r);
    s.quadraticCurveTo(w, h, w - r, h);
    s.lineTo(-w + r, h);
    s.quadraticCurveTo(-w, h, -w, h - r);
    s.lineTo(-w, -h + r);
    s.quadraticCurveTo(-w, -h, -w + r, -h);
    return s;
  };

  const bw = 0.112;
  const bh = 0.102;
  const br = 0.04;
  const rotY = 0.34;
  const rotZ = -0.04;
  const posX = 0.214;
  const posY = 0.062;
  const posZ = 0.264;

  const transformPouch = (g: THREE.BufferGeometry) => {
    g.rotateY(rotY);
    g.rotateZ(rotZ);
    g.translate(posX, posY, posZ);
    return g;
  };

  // 1. Plush emerald-green boxy pouch body (outer shell + rounded emerald piping frame)
  const bagBody = transformPouch(
    new THREE.ExtrudeGeometry(makeRoundedRect(bw, bh, br), {
      depth: 0.072,
      bevelEnabled: true,
      bevelThickness: 0.028,
      bevelSize: 0.025,
      bevelSegments: 6,
      curveSegments: 16,
    }),
  );

  // 2. Plump rounded off-white lower front inset panel framed evenly by emerald body rim
  const lowerPanel = new THREE.ExtrudeGeometry(
    makeRoundedRect(bw - 0.011, bh - 0.014, br * 0.78),
    {
      depth: 0.014,
      bevelEnabled: true,
      bevelThickness: 0.011,
      bevelSize: 0.01,
      bevelSegments: 5,
      curveSegments: 16,
    },
  );
  lowerPanel.translate(0, -0.002, 0.088);
  transformPouch(lowerPanel);

  // 3. Thick plush curved off-white upper flap overhanging lowerPanel
  const flapShape = new THREE.Shape();
  const fw = bw - 0.006;
  const fr = 0.036;
  flapShape.moveTo(-fw + fr, -0.024);
  flapShape.quadraticCurveTo(0, -0.044, fw - fr, -0.024);
  flapShape.quadraticCurveTo(fw, -0.02, fw, 0.015);
  flapShape.lineTo(fw, bh - 0.012);
  flapShape.quadraticCurveTo(fw, bh + 0.008, fw - 0.024, bh + 0.008);
  flapShape.lineTo(-fw + 0.024, bh + 0.008);
  flapShape.quadraticCurveTo(-fw, bh + 0.008, -fw, bh - 0.012);
  flapShape.lineTo(-fw, 0.015);
  flapShape.quadraticCurveTo(-fw, -0.02, -fw + fr, -0.024);

  const flap = new THREE.ExtrudeGeometry(flapShape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.011,
    bevelSegments: 5,
    curveSegments: 16,
  });
  flap.translate(0, 0.014, 0.098);
  transformPouch(flap);

  // 4. Crisp emerald piping rim hugging the curved lower & side borders of the flap
  const trimCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-fw - 0.01, bh - 0.002, 0.109),
    new THREE.Vector3(-fw - 0.012, 0.014, 0.113),
    new THREE.Vector3(-fw + fr * 0.65, -0.024, 0.115),
    new THREE.Vector3(0, -0.036, 0.117),
    new THREE.Vector3(fw - fr * 0.65, -0.024, 0.115),
    new THREE.Vector3(fw + 0.012, 0.014, 0.113),
    new THREE.Vector3(fw + 0.01, bh - 0.002, 0.109),
  ]);
  const flapTrim = new THREE.TubeGeometry(trimCurve, 32, 0.0125, 10, false);
  flapTrim.translate(0, 0.012, 0);
  transformPouch(flapTrim);

  // 5. Crisp domed emerald snap button centered neatly on the flap
  const btn = new THREE.SphereGeometry(0.02, 18, 14);
  btn.scale(1, 1, 0.58);
  btn.translate(0, 0.015, 0.128);
  transformPouch(btn);
  btn.computeVertexNormals();

  const merged = mergeCleanGeometries([
    strap.clone(),
    bagBody.clone(),
    lowerPanel.clone(),
    flap.clone(),
  ]);

  geoCache.set(strapKey, strap);
  geoCache.set(bodyKey, bagBody);
  geoCache.set(lowerKey, lowerPanel);
  geoCache.set(flapKey, flap);
  geoCache.set(trimKey, flapTrim);
  geoCache.set(btnKey, btn);
  geoCache.set(bagKey, merged);

  return {
    strap,
    bagBody,
    lowerPanel,
    flap,
    flapTrim,
    button: btn,
    strapAndBag: merged,
  };
}

/** Draped stethoscope around collar/chest. */
export function getStethoscopeTubeGeometry(): THREE.BufferGeometry {
  const key = 'stetho-tube-v3';
  const cached = geoCache.get(key);
  if (cached) return cached;

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.175, 0.615, 0.08),
    new THREE.Vector3(-0.24, 0.45, 0.285),
    new THREE.Vector3(-0.2, 0.24, 0.342),
    new THREE.Vector3(-0.04, 0.145, 0.352),
    new THREE.Vector3(0.09, 0.2, 0.345),
    new THREE.Vector3(0.2, 0.43, 0.3),
    new THREE.Vector3(0.17, 0.615, 0.08),
  ]);
  const geo = new THREE.TubeGeometry(curve, 36, 0.02, 12, false);
  geo.computeVertexNormals();
  geoCache.set(key, geo);
  return geo;
}

/**
 * Tailored long white Doctor's lab coat matching the reference turnaround sheet:
 * - Longer tailored A-line hem extending cleanly over hips/upper thighs (y = -0.22 .. +0.625)
 * - Clean open front revealing blue dress shirt, green lanyard ID card, brown belt & trousers
 * - Crisp inverted-V center back vent slit (matching Tampak Belakang!)
 * - Sculpted notched lapels, collar, front patch pockets with sewn top hem, and subtle buttons.
 */
export function getTailoredDoctorCoatGeometry(): THREE.BufferGeometry {
  const key = 'tailored-doctor-coat-v2';
  const cached = geoCache.get(key);
  if (cached) return cached;

  const parts: THREE.BufferGeometry[] = [];
  const thickness = 0.024;
  // Slightly longer tailored medical lab coat silhouette extending cleanly over back neckline
  const rings: [number, number, number, number][] = [
    [-0.225, 0.486, 0.354, 0.011],
    [-0.16, 0.478, 0.35, 0.012],
    [-0.08, 0.47, 0.346, 0.013],
    [0.04, 0.462, 0.342, 0.014],
    [0.19, 0.45, 0.333, 0.015],
    [0.35, 0.44, 0.32, 0.012],
    [0.485, 0.42, 0.295, 0.008],
    [0.575, 0.35, 0.248, 0.005],
    [0.642, 0.232, 0.195, 0.005],
  ];

  // Build LEFT and RIGHT coat halves separately so we get BOTH a clean open center front
  // AND a crisp inverted-V back center vent slit at the bottom rear!
  const buildCoatHalf = (side: -1 | 1): THREE.BufferGeometry => {
    const arcSteps = 22;
    const positions: number[] = [];
    const indices: number[] = [];
    const stride = arcSteps * 2;

    for (let r = 0; r < rings.length; r++) {
      const [y, wx, dz, cz] = rings[r];
      // Front open gap: wider near chest collar so blue shirt & lanyard show cleanly, neat parallel gap below
      const frontGap = 0.32 + 0.09 * smoothstep(0.25, 0.64, y);
      // Inverted-V back vent opening at bottom center back (phi = -PI/2, y < -0.025)
      const backVentGap = y < -0.025 ? 0.095 * Math.pow((-0.025 - y) / 0.2, 1.05) : 0;

      const phiStart = side === -1 ? Math.PI / 2 + frontGap : -Math.PI / 2 + backVentGap;
      const phiEnd = side === -1 ? Math.PI * 1.5 - backVentGap : Math.PI / 2 - frontGap;

      for (let layer = 0; layer < 2; layer++) {
        const offset = layer === 0 ? 0 : -thickness;
        for (let s = 0; s < arcSteps; s++) {
          const u = s / (arcSteps - 1);
          const phi = THREE.MathUtils.lerp(phiStart, phiEnd, u);
          const cosP = Math.cos(phi);
          const sinP = Math.sin(phi);
          const x = (wx + offset) * Math.sign(cosP) * Math.pow(Math.abs(cosP), 0.9);
          const z = cz + (dz + offset) * Math.sign(sinP) * Math.pow(Math.abs(sinP), 0.93);
          positions.push(x, y, z);
        }
      }
    }

    const pushQuad = (a: number, b: number, c: number, d: number) => {
      indices.push(a, b, c, a, c, d);
    };

    for (let r = 0; r < rings.length - 1; r++) {
      const base = r * stride;
      const next = (r + 1) * stride;
      for (let s = 0; s < arcSteps - 1; s++) {
        pushQuad(base + s, next + s, next + s + 1, base + s + 1);
        pushQuad(
          base + arcSteps + s,
          base + arcSteps + s + 1,
          next + arcSteps + s + 1,
          next + arcSteps + s,
        );
      }
      pushQuad(base + arcSteps, next + arcSteps, next, base);
      pushQuad(
        base + arcSteps - 1,
        next + arcSteps - 1,
        next + stride - 1,
        base + stride - 1,
      );
    }

    const top = (rings.length - 1) * stride;
    for (let s = 0; s < arcSteps - 1; s++) {
      pushQuad(s, s + 1, arcSteps + s + 1, arcSteps + s);
      pushQuad(top + arcSteps + s, top + arcSteps + s + 1, top + s + 1, top + s);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  };

  parts.push(buildCoatHalf(-1));
  parts.push(buildCoatHalf(1));

  // Crisp folded lab-coat collar rim curving smoothly around back & sides of neck (covers blue shirt back completely!)
  const collarCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.145, 0.565, 0.218),
    new THREE.Vector3(-0.228, 0.625, 0.08),
    new THREE.Vector3(-0.18, 0.652, -0.145),
    new THREE.Vector3(0.0, 0.658, -0.205),
    new THREE.Vector3(0.18, 0.652, -0.145),
    new THREE.Vector3(0.228, 0.625, 0.08),
    new THREE.Vector3(0.145, 0.565, 0.218),
  ]);
  const coatCollar = new THREE.TubeGeometry(collarCurve, 40, 0.04, 14, false);
  coatCollar.scale(1, 0.88, 1);
  coatCollar.computeVertexNormals();
  parts.push(coatCollar);

  // Sculpted notched lapels framing the open V-chest (crisp bevels matching KERAH & STETOSKOP)
  for (const sign of [-1, 1]) {
    const lapelShape = new THREE.Shape();
    lapelShape.moveTo(0, 0);
    lapelShape.lineTo(sign * 0.105, 0.072);
    lapelShape.lineTo(sign * 0.095, 0.152);
    lapelShape.lineTo(sign * 0.048, 0.165);
    lapelShape.lineTo(sign * 0.072, 0.215);
    lapelShape.lineTo(0, 0.258);
    lapelShape.closePath();

    const lapel = new THREE.ExtrudeGeometry(lapelShape, {
      depth: 0.02,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 3,
    });
    lapel.rotateY(sign * 0.26);
    lapel.rotateX(-0.14);
    lapel.translate(sign * 0.148, 0.34, 0.296);
    parts.push(lapel);
  }

  // Tall rounded-bottom patch pockets with crisp sewn top hem (clearly visible in Front & 3/4 views!)
  for (const sign of [-1, 1]) {
    const pShape = new THREE.Shape();
    const pw = 0.074;
    const ph = 0.084;
    const pr = 0.024;
    pShape.moveTo(-pw + pr, -ph);
    pShape.lineTo(pw - pr, -ph);
    pShape.quadraticCurveTo(pw, -ph, pw, -ph + pr);
    pShape.lineTo(pw, ph - pr * 0.4);
    pShape.quadraticCurveTo(pw, ph, pw - pr * 0.4, ph);
    pShape.lineTo(-pw + pr * 0.4, ph);
    pShape.quadraticCurveTo(-pw, ph, -pw, ph - pr * 0.4);
    pShape.lineTo(-pw, -ph + pr);
    pShape.quadraticCurveTo(-pw, -ph, -pw + pr, -ph);

    const pocket = new THREE.ExtrudeGeometry(pShape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelThickness: 0.009,
      bevelSize: 0.009,
      bevelSegments: 4,
      curveSegments: 12,
    });
    pocket.rotateY(sign * 0.42);
    pocket.translate(sign * 0.275, -0.028, 0.302);
    parts.push(pocket);

    const hem = new THREE.BoxGeometry(pw * 1.92, 0.021, 0.019);
    hem.rotateY(sign * 0.42);
    hem.translate(sign * 0.278, 0.044, 0.309);
    parts.push(hem);
  }

  // Two subtle round white buttons on the front right coat edge (SAKU JAS callout)
  for (const by of [0.16, 0.055]) {
    const btn = new THREE.CylinderGeometry(0.016, 0.016, 0.01, 16);
    btn.rotateX(Math.PI / 2);
    btn.rotateY(0.24);
    btn.translate(0.185, by, 0.344);
    parts.push(btn);
  }

  const merged = mergeCleanGeometries(parts);
  geoCache.set(key, merged);
  return merged;
}

/**
 * Crisp folded dress-shirt collar wings + vertical center placket for Dr. Arga's light-blue shirt
 * (KERAH & STETOSKOP callout).
 */
export function getDressShirtCollarGeometry(): THREE.BufferGeometry {
  const key = 'dress-shirt-collar-v2';
  const cached = geoCache.get(key);
  if (cached) return cached;

  const parts: THREE.BufferGeometry[] = [];

  // Left & Right pointed shirt collar wings framing the open V-throat (KERAH & STETOSKOP!)
  for (const sign of [-1, 1]) {
    const wing = new THREE.Shape();
    wing.moveTo(0, -0.015);
    wing.lineTo(sign * 0.095, -0.088);
    wing.lineTo(sign * 0.135, 0.015);
    wing.lineTo(sign * 0.048, 0.078);
    wing.closePath();

    const g = new THREE.ExtrudeGeometry(wing, {
      depth: 0.018,
      bevelEnabled: true,
      bevelThickness: 0.007,
      bevelSize: 0.006,
      bevelSegments: 3,
    });
    g.rotateY(sign * 0.3);
    g.rotateX(-0.24);
    g.translate(sign * 0.018, 0.582, 0.215);
    parts.push(g);
  }

  // Subtle vertical front shirt button placket center strip
  const placket = new THREE.BoxGeometry(0.048, 0.49, 0.02);
  placket.translate(0, 0.295, 0.307);
  parts.push(placket);

  const merged = mergeCleanGeometries(parts);
  geoCache.set(key, merged);
  return merged;
}

/**
 * Realistic multi-part draped doctor's stethoscope matching KERAH & STETOSKOP + TAMPAK BELAKANG:
 * - Continuous black rubber tubing wrapping cleanly OVER the coat collar from front to back with ZERO clipping
 * - Metallic silver binaural Y-fork earpieces on viewer's left (-X) with black rubber eartips
 * - Round brushed-silver acoustic chestpiece diaphragm disc on viewer's right (+X)
 */
export function getProStethoscopeGeometries(): {
  tubing: THREE.BufferGeometry;
  metal: THREE.BufferGeometry;
  eartips: THREE.BufferGeometry;
} {
  const tKey = 'pro-stetho-tubing-v2';
  const mKey = 'pro-stetho-metal-v2';
  const eKey = 'pro-stetho-eartips-v2';
  if (geoCache.has(tKey) && geoCache.has(mKey) && geoCache.has(eKey)) {
    return {
      tubing: geoCache.get(tKey)!,
      metal: geoCache.get(mKey)!,
      eartips: geoCache.get(eKey)!,
    };
  }

  // 1. Main black rubber neck tubing curving smoothly OVER the coat collar & down both front lapels (zero clipping!)
  const mainCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.215, 0.44, 0.326), // Viewer's left lapel -> meets silver Y-binaural fork
    new THREE.Vector3(-0.225, 0.535, 0.278),
    new THREE.Vector3(-0.228, 0.605, 0.165),
    new THREE.Vector3(-0.218, 0.642, 0.01),
    new THREE.Vector3(-0.155, 0.64, -0.175),
    new THREE.Vector3(0.0, 0.635, -0.236), // Cleanly visible black band around back collar!
    new THREE.Vector3(0.155, 0.64, -0.175),
    new THREE.Vector3(0.218, 0.642, 0.01),
    new THREE.Vector3(0.228, 0.605, 0.165),
    new THREE.Vector3(0.226, 0.53, 0.28),
    new THREE.Vector3(0.222, 0.415, 0.332),
    new THREE.Vector3(0.215, 0.32, 0.35), // Viewer's right lapel -> meets silver chestpiece!
  ]);
  const mainTube = new THREE.TubeGeometry(mainCurve, 64, 0.017, 12, false);

  // Small rubber diaphragm pad centered on the silver chestpiece face
  const chestPad = new THREE.CylinderGeometry(0.036, 0.036, 0.008, 20);
  chestPad.rotateX(Math.PI / 2 - 0.14);
  chestPad.rotateZ(-0.18);
  chestPad.translate(0.215, 0.305, 0.373);

  const tubing = mergeCleanGeometries([mainTube, chestPad]);

  // 2. Brushed-silver metallic hardware: left Y-binaural ear-tubes + right acoustic chestpiece bell
  const metalParts: THREE.BufferGeometry[] = [];

  // Left side Y-fork junction hub
  const hub = new THREE.CylinderGeometry(0.017, 0.015, 0.042, 14);
  hub.rotateZ(-0.08);
  hub.translate(-0.214, 0.425, 0.332);
  metalParts.push(hub);

  // Left outer binaural metal arm
  const earArmOut = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.215, 0.41, 0.332),
    new THREE.Vector3(-0.258, 0.365, 0.344),
    new THREE.Vector3(-0.262, 0.29, 0.352),
    new THREE.Vector3(-0.235, 0.265, 0.356),
  ]);
  metalParts.push(new THREE.TubeGeometry(earArmOut, 18, 0.0095, 10, false));

  // Left inner binaural metal arm
  const earArmIn = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.21, 0.41, 0.332),
    new THREE.Vector3(-0.172, 0.365, 0.344),
    new THREE.Vector3(-0.168, 0.292, 0.352),
    new THREE.Vector3(-0.194, 0.268, 0.356),
  ]);
  metalParts.push(new THREE.TubeGeometry(earArmIn, 18, 0.0095, 10, false));

  // Curved metal tension spring bar between binaural arms
  const springCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.246, 0.37, 0.341),
    new THREE.Vector3(-0.213, 0.352, 0.345),
    new THREE.Vector3(-0.18, 0.37, 0.341),
  ]);
  metalParts.push(new THREE.TubeGeometry(springCurve, 12, 0.006, 8, false));

  // Right side metallic acoustic chestpiece disc + stem collar
  const chestStem = new THREE.CylinderGeometry(0.015, 0.017, 0.032, 14);
  chestStem.translate(0.215, 0.332, 0.353);
  metalParts.push(chestStem);

  const chestDisc = new THREE.CylinderGeometry(0.052, 0.052, 0.022, 26);
  chestDisc.rotateX(Math.PI / 2 - 0.14);
  chestDisc.rotateZ(-0.18);
  chestDisc.translate(0.215, 0.305, 0.362);
  metalParts.push(chestDisc);

  const chestRim = new THREE.TorusGeometry(0.045, 0.007, 10, 24);
  chestRim.rotateX(-0.14);
  chestRim.rotateY(0.18);
  chestRim.translate(0.215, 0.305, 0.372);
  metalParts.push(chestRim);

  const metal = mergeCleanGeometries(metalParts);

  // 3. Soft rounded dark rubber eartips on the ends of the binaural ear-tubes
  const tipParts: THREE.BufferGeometry[] = [];
  for (const [tx, ty, tz, rz] of [
    [-0.232, 0.264, 0.357, -0.55],
    [-0.197, 0.267, 0.357, 0.55],
  ]) {
    const tip = new THREE.SphereGeometry(0.017, 14, 10);
    tip.scale(1.15, 0.85, 0.9);
    tip.rotateZ(rz);
    tip.translate(tx, ty, tz);
    tipParts.push(tip);
  }
  const eartips = mergeCleanGeometries(tipParts);

  geoCache.set(tKey, tubing);
  geoCache.set(mKey, metal);
  geoCache.set(eKey, eartips);
  return { tubing, metal, eartips };
}

/**
 * Emerald-green V-shaped neck lanyard strap + metallic silver clip holding Dr. Arga's center ID card
 * (exact match to ID CARD callout!).
 */
export function getDoctorLanyardGeometries(): {
  strap: THREE.BufferGeometry;
  clip: THREE.BufferGeometry;
} {
  const sKey = 'doctor-lanyard-strap-v1';
  const cKey = 'doctor-lanyard-clip-v1';
  if (geoCache.has(sKey) && geoCache.has(cKey)) {
    return { strap: geoCache.get(sKey)!, clip: geoCache.get(cKey)! };
  }

  const leftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.115, 0.565, 0.215),
    new THREE.Vector3(-0.088, 0.45, 0.292),
    new THREE.Vector3(-0.042, 0.34, 0.318),
    new THREE.Vector3(-0.008, 0.258, 0.326),
  ]);
  const rightCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.115, 0.565, 0.215),
    new THREE.Vector3(0.088, 0.45, 0.292),
    new THREE.Vector3(0.042, 0.34, 0.318),
    new THREE.Vector3(0.008, 0.258, 0.326),
  ]);

  const strapL = new THREE.TubeGeometry(leftCurve, 24, 0.013, 8, false);
  strapL.scale(1, 1, 0.55);
  strapL.translate(0, 0, 0.145);
  const strapR = new THREE.TubeGeometry(rightCurve, 24, 0.013, 8, false);
  strapR.scale(1, 1, 0.55);
  strapR.translate(0, 0, 0.145);

  // Use clean direct ribbon tubes without Z-scaling shift
  const cleanStrapL = new THREE.TubeGeometry(leftCurve, 24, 0.012, 10, false);
  const cleanStrapR = new THREE.TubeGeometry(rightCurve, 24, 0.012, 10, false);
  strapL.dispose();
  strapR.dispose();
  const strap = mergeCleanGeometries([cleanStrapL, cleanStrapR]);

  // Metallic silver clip & clasp connecting lanyard V-tip to ID card slot
  const clipParts: THREE.BufferGeometry[] = [];
  const claspBody = new THREE.BoxGeometry(0.028, 0.036, 0.014);
  claspBody.translate(0, 0.244, 0.332);
  clipParts.push(claspBody);
  const claspRing = new THREE.TorusGeometry(0.013, 0.004, 8, 16);
  claspRing.translate(0, 0.222, 0.332);
  clipParts.push(claspRing);
  const clip = mergeCleanGeometries(clipParts);

  geoCache.set(sKey, strap);
  geoCache.set(cKey, clip);
  return { strap, clip };
}

/**
 * Polished dark-brown leather Oxford dress shoes matching the SEPATU callout:
 * - Distinct stepped dress-shoe heel & dark stitched outsole touching y = -ANKLE_HEIGHT
 * - Smooth sculpted burnished leather upper with cap-toe silhouette & ankle collar
 * - Crisp matching dark-brown dress shoelaces across the vamp
 */
export function getDoctorDressShoeGeometries(): {
  sole: THREE.BufferGeometry;
  upper: THREE.BufferGeometry;
  laces: THREE.BufferGeometry;
} {
  const soleKey = 'dress-shoe-sole-v2';
  const upperKey = 'dress-shoe-upper-v2';
  const laceKey = 'dress-shoe-lace-v2';

  if (geoCache.has(soleKey) && geoCache.has(upperKey) && geoCache.has(laceKey)) {
    return {
      sole: geoCache.get(soleKey)!,
      upper: geoCache.get(upperKey)!,
      laces: geoCache.get(laceKey)!,
    };
  }

  const makeOxfordShape = (hw: number, back: number, front: number) => {
    const s = new THREE.Shape();
    s.moveTo(-hw * 0.78, -back);
    s.quadraticCurveTo(0, -back - 0.025, hw * 0.78, -back);
    s.bezierCurveTo(hw * 0.98, -back * 0.15, hw * 1.02, front * 0.48, hw * 0.85, front * 0.84);
    s.quadraticCurveTo(0, front * 1.08, -hw * 0.85, front * 0.84);
    s.bezierCurveTo(-hw * 1.02, front * 0.48, -hw * 0.98, -back * 0.15, -hw * 0.78, -back);
    return s;
  };

  // 1. Sleek continuous dark-brown stitched outsole + integrated flush heel touching y = -ANKLE_HEIGHT
  const soleParts: THREE.BufferGeometry[] = [];
  const baseSole = new THREE.ExtrudeGeometry(makeOxfordShape(0.123, 0.12, 0.232), {
    depth: 0.044,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 4,
    curveSegments: 22,
  });
  baseSole.rotateX(Math.PI / 2);
  baseSole.translate(0, -ANKLE_HEIGHT + 0.052, 0.036);
  soleParts.push(baseSole);

  // Subtle stitched welt ridge around perimeter
  const welt = new THREE.ExtrudeGeometry(makeOxfordShape(0.121, 0.118, 0.228), {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.005,
    bevelSegments: 3,
    curveSegments: 22,
  });
  welt.rotateX(Math.PI / 2);
  welt.translate(0, -ANKLE_HEIGHT + 0.062, 0.036);
  soleParts.push(welt);

  const sole = mergeCleanGeometries(soleParts);

  // 2. Sleek sculpted burnished leather Oxford upper + ankle collar + rounded vamp tongue
  const upperParts: THREE.BufferGeometry[] = [];
  const shoeDome = new THREE.SphereGeometry(1, 36, 24);
  const spos = shoeDome.attributes.position;
  for (let i = 0; i < spos.count; i++) {
    const nx = spos.getX(i);
    const ny = spos.getY(i);
    const nz = spos.getZ(i);
    const toeSculpt = 1 - 0.06 * smoothstep(0.45, 0.95, nz);
    const x = nx * 0.124 * toeSculpt;
    const yNorm = ny < 0 ? ny * 0.3 : Math.pow(ny, 0.84);
    const heelRise = smoothstep(0.32, -0.75, nz) * 0.04;
    const y = yNorm * 0.098 + heelRise;
    const z = nz > 0 ? nz * 0.236 : nz * 0.134;
    spos.setXYZ(i, x, y, z);
  }
  shoeDome.translate(0, -ANKLE_HEIGHT + 0.068, 0.04);
  shoeDome.computeVertexNormals();
  upperParts.push(shoeDome);

  // Sleek low-cut leather ankle collar
  const ankleQuarter = new THREE.CylinderGeometry(0.102, 0.12, 0.075, 28, 1, false);
  ankleQuarter.scale(0.95, 1, 1.08);
  ankleQuarter.translate(0, -ANKLE_HEIGHT + 0.138, -0.006);
  upperParts.push(ankleQuarter);

  const collar = new THREE.TorusGeometry(0.1, 0.019, 14, 28);
  collar.rotateX(Math.PI / 2);
  collar.scale(0.95, 1.08, 1);
  collar.translate(0, -ANKLE_HEIGHT + 0.174, -0.006);
  upperParts.push(collar);

  const tongue = new THREE.CapsuleGeometry(0.048, 0.04, 8, 16);
  tongue.scale(1.1, 1, 0.32);
  tongue.rotateX(-0.46);
  tongue.translate(0, -ANKLE_HEIGHT + 0.168, 0.078);
  upperParts.push(tongue);

  const upper = mergeCleanGeometries(upperParts);

  // 3. Three neat dress-shoe shoelace bars across the instep
  const laceParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const zPos = 0.08 + i * 0.042;
    const yPos = -ANKLE_HEIGHT + 0.16 - i * 0.016;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.062, yPos - 0.012, zPos),
      new THREE.Vector3(-0.028, yPos + 0.008, zPos + 0.007),
      new THREE.Vector3(0.028, yPos + 0.008, zPos + 0.007),
      new THREE.Vector3(0.062, yPos - 0.012, zPos),
    ]);
    laceParts.push(new THREE.TubeGeometry(curve, 16, 0.0095, 10, false));
  }
  const laces = mergeCleanGeometries(laceParts);

  geoCache.set(soleKey, sole);
  geoCache.set(upperKey, upper);
  geoCache.set(laceKey, laces);
  return { sole, upper, laces };
}

/**
 * Tailored short-sleeved white Male Nurse scrub tunic details matching the Perawat Pria turnaround sheet:
 * - Folded white pointed V-neck collar wrapping smoothly around neck & back (collarWhite)
 * - Crisp emerald-green outer piping trim along the collar edge front-to-back (collarPiping)
 * - Emerald-green V-neck inner undershirt peeking inside the open collar (vNeckInsert)
 * - Two symmetric lower hip rounded patch pockets (Left & Right) with emerald-green top bands (pocketBody, pocketTrim)
 * - Clean small inverted-V emerald center hem slit at the bottom of the white tunic (frontSlit)
 */
export function getNurseScrubTopDetailsGeometries(): {
  collarWhite: THREE.BufferGeometry;
  collarPiping: THREE.BufferGeometry;
  vNeckInsert: THREE.BufferGeometry;
  pocketBody: THREE.BufferGeometry;
  pocketTrim: THREE.BufferGeometry;
  frontSlit: THREE.BufferGeometry;
  centerPlacket: THREE.BufferGeometry;
  chestPocketTrim: THREE.BufferGeometry;
} {
  const cwKey = 'nurse-scrub-collar-white-v2';
  const cpKey = 'nurse-scrub-collar-piping-v2';
  const vnKey = 'nurse-scrub-vneck-v2';
  const pbKey = 'nurse-scrub-pocket-body-v2';
  const ptKey = 'nurse-scrub-pocket-trim-v2';
  const fsKey = 'nurse-scrub-front-slit-v2';
  const plKey = 'nurse-scrub-center-placket-v2';
  const chKey = 'nurse-scrub-chest-pocket-v2';

  if (
    geoCache.has(cwKey) &&
    geoCache.has(cpKey) &&
    geoCache.has(vnKey) &&
    geoCache.has(pbKey) &&
    geoCache.has(ptKey) &&
    geoCache.has(fsKey) &&
    geoCache.has(plKey) &&
    geoCache.has(chKey)
  ) {
    return {
      collarWhite: geoCache.get(cwKey)!,
      collarPiping: geoCache.get(cpKey)!,
      vNeckInsert: geoCache.get(vnKey)!,
      pocketBody: geoCache.get(pbKey)!,
      pocketTrim: geoCache.get(ptKey)!,
      frontSlit: geoCache.get(fsKey)!,
      centerPlacket: geoCache.get(plKey)!,
      chestPocketTrim: geoCache.get(chKey)!,
    };
  }

  // Exact ring profile from getTorsoTunicGeometry() for zero-clipping surface-contoured pockets & trim
  const tunicRings: [number, number, number, number][] = [
    [-0.055, 0.416, 0.296, 0.011],
    [-0.032, 0.432, 0.308, 0.014],
    [0.014, 0.43, 0.306, 0.015],
    [0.025, 0.419, 0.298, 0.014],
    [0.04, 0.425, 0.303, 0.015],
    [0.16, 0.418, 0.298, 0.017],
    [0.3, 0.408, 0.286, 0.013],
    [0.43, 0.402, 0.268, 0.008],
    [0.52, 0.376, 0.244, 0.005],
    [0.584, 0.302, 0.202, 0.004],
  ];

  const sampleTunic = (y: number, phi: number, offset = 0): [number, number, number] => {
    let idx = 0;
    while (idx < tunicRings.length - 2 && tunicRings[idx + 1][0] < y) idx++;
    const r0 = tunicRings[idx];
    const r1 = tunicRings[idx + 1];
    const t = Math.max(0, Math.min(1, (y - r0[0]) / Math.max(1e-5, r1[0] - r0[0])));
    const wx = THREE.MathUtils.lerp(r0[1], r1[1], t) + offset;
    const dz = THREE.MathUtils.lerp(r0[2], r1[2], t) + offset;
    const cz = THREE.MathUtils.lerp(r0[3], r1[3], t);
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);
    const x = wx * Math.sign(cosP) * Math.pow(Math.abs(cosP), 0.9);
    const z = cz + dz * Math.sign(sinP) * Math.pow(Math.abs(sinP), 0.93);
    return [x, y, z];
  };

  const buildCurvedPatch = (
    yMin: number,
    yMax: number,
    phiMin: number,
    phiMax: number,
    thickness: number,
    segY: number,
    segP: number,
  ): THREE.BufferGeometry => {
    const positions: number[] = [];
    const indices: number[] = [];
    const gridStride = (segP + 1) * (segY + 1);
    for (let layer = 0; layer < 2; layer++) {
      for (let j = 0; j <= segY; j++) {
        const v = j / segY;
        const y = THREE.MathUtils.lerp(yMin, yMax, v);
        for (let i = 0; i <= segP; i++) {
          const u = i / segP;
          const phi = THREE.MathUtils.lerp(phiMin, phiMax, u);
          const edgeU = Math.min(u, 1 - u);
          const edgeV = Math.min(v, 1 - v);
          const bevel = smoothstep(0, 0.14, edgeU) * smoothstep(0, 0.16, edgeV);
          const off = layer === 0 ? 0.002 + thickness * (0.45 + 0.55 * bevel) : -0.004;
          const [x, py, z] = sampleTunic(y, phi, off);
          positions.push(x, py, z);
        }
      }
    }
    const idxAt = (layer: number, j: number, i: number) =>
      layer * gridStride + j * (segP + 1) + i;
    const pushQuad = (a: number, b: number, c: number, d: number) => {
      indices.push(a, b, c, a, c, d);
    };
    for (let j = 0; j < segY; j++) {
      for (let i = 0; i < segP; i++) {
        pushQuad(idxAt(0, j, i), idxAt(0, j + 1, i), idxAt(0, j + 1, i + 1), idxAt(0, j, i + 1));
      }
    }
    for (let i = 0; i < segP; i++) {
      pushQuad(idxAt(0, 0, i), idxAt(0, 0, i + 1), idxAt(1, 0, i + 1), idxAt(1, 0, i));
      pushQuad(
        idxAt(1, segY, i),
        idxAt(1, segY, i + 1),
        idxAt(0, segY, i + 1),
        idxAt(0, segY, i),
      );
    }
    for (let j = 0; j < segY; j++) {
      pushQuad(idxAt(1, j, 0), idxAt(1, j + 1, 0), idxAt(0, j + 1, 0), idxAt(0, j, 0));
      pushQuad(
        idxAt(0, j, segP),
        idxAt(0, j + 1, segP),
        idxAt(1, j + 1, segP),
        idxAt(1, j, segP),
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  };

  // Helper to build a smooth curved triangular V-patch directly on the tunic surface (zero z-fighting!)
  const buildCurvedVInsert = (): THREE.BufferGeometry => {
    const segY = 12;
    const segU = 12;
    const yMin = 0.455;
    const yMax = 0.595;
    const positions: number[] = [];
    const indices: number[] = [];
    const gridStride = (segU + 1) * (segY + 1);
    for (let layer = 0; layer < 2; layer++) {
      for (let j = 0; j <= segY; j++) {
        const v = j / segY;
        const y = THREE.MathUtils.lerp(yMin, yMax, v);
        // Narrow clean V opening widening smoothly upward toward the neck
        const halfPhi = THREE.MathUtils.lerp(0.025, 0.34, Math.pow(v, 0.92));
        for (let i = 0; i <= segU; i++) {
          const u = i / segU;
          const phi = Math.PI * 0.5 + THREE.MathUtils.lerp(-halfPhi, halfPhi, u);
          const off = layer === 0 ? 0.011 : -0.004;
          const [x, py, z] = sampleTunic(y, phi, off);
          positions.push(x, py, z);
        }
      }
    }
    const idxAt = (layer: number, j: number, i: number) =>
      layer * gridStride + j * (segU + 1) + i;
    const pushQuad = (a: number, b: number, c: number, d: number) => {
      indices.push(a, b, c, a, c, d);
    };
    for (let j = 0; j < segY; j++) {
      for (let i = 0; i < segU; i++) {
        pushQuad(idxAt(0, j, i), idxAt(0, j + 1, i), idxAt(0, j + 1, i + 1), idxAt(0, j, i + 1));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  };

  // 1. Folded White Nurse Scrub Collar (flush continuous neck roll + clean outward-curved left & right lapels!)
  const whiteCollarParts: THREE.BufferGeometry[] = [];
  // Continuous standing & folded neckband wrapping cleanly around back and sides into front collar root
  const backCollarCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.135, 0.588, 0.172),
    new THREE.Vector3(-0.205, 0.605, 0.05),
    new THREE.Vector3(-0.168, 0.614, -0.145),
    new THREE.Vector3(0.0, 0.618, -0.195),
    new THREE.Vector3(0.168, 0.614, -0.145),
    new THREE.Vector3(0.205, 0.605, 0.05),
    new THREE.Vector3(0.135, 0.588, 0.172),
  ]);
  whiteCollarParts.push(new THREE.TubeGeometry(backCollarCurve, 44, 0.036, 14, false));

  // Crisp pointed folded front collar wings (Left & Right) hugging the chest slope outside the emerald V-neck!
  for (const sign of [-1, 1]) {
    const segY = 8;
    const segU = 10;
    const positions: number[] = [];
    const indices: number[] = [];
    const stride = (segU + 1) * (segY + 1);
    for (let layer = 0; layer < 2; layer++) {
      for (let j = 0; j <= segY; j++) {
        const v = j / segY; // 0 = lower pointed lapel tip, 1 = upper collar fold at neck
        const y = THREE.MathUtils.lerp(0.495, 0.602, v);
        // Inner edge runs cleanly down along the V-neck border; outer edge forms the classic sharp folded collar point!
        const innerOffset = THREE.MathUtils.lerp(0.06, 0.30, v);
        const outerOffset = THREE.MathUtils.lerp(0.50, 0.68, smoothstep(0, 0.72, v));
        for (let i = 0; i <= segU; i++) {
          const u = i / segU;
          const phiOffset = THREE.MathUtils.lerp(innerOffset, outerOffset, u);
          const phi = Math.PI * 0.5 - sign * phiOffset;
          const bevel = smoothstep(0, 0.12, Math.min(u, 1 - u)) * smoothstep(0, 0.14, Math.min(v, 1 - v));
          const off = layer === 0 ? 0.017 + 0.014 * bevel : 0.002;
          const [x, py, z] = sampleTunic(y, phi, off);
          positions.push(x, py, z);
        }
      }
    }
    const idxAt = (layer: number, j: number, i: number) => layer * stride + j * (segU + 1) + i;
    const pushQuad = (a: number, b: number, c: number, d: number) => {
      if (sign === 1) indices.push(a, b, c, a, c, d);
      else indices.push(a, c, b, a, d, c);
    };
    for (let j = 0; j < segY; j++) {
      for (let i = 0; i < segU; i++) {
        pushQuad(idxAt(0, j, i), idxAt(0, j + 1, i), idxAt(0, j + 1, i + 1), idxAt(0, j, i + 1));
      }
    }
    for (let i = 0; i < segU; i++) {
      pushQuad(idxAt(0, 0, i), idxAt(0, 0, i + 1), idxAt(1, 0, i + 1), idxAt(1, 0, i));
      pushQuad(idxAt(1, segY, i), idxAt(1, segY, i + 1), idxAt(0, segY, i + 1), idxAt(0, segY, i));
    }
    for (let j = 0; j < segY; j++) {
      pushQuad(idxAt(1, j, 0), idxAt(1, j + 1, 0), idxAt(0, j + 1, 0), idxAt(0, j, 0));
      pushQuad(idxAt(0, j, segU), idxAt(0, j + 1, segU), idxAt(1, j + 1, segU), idxAt(1, j, segU));
    }
    const lapelGeo = new THREE.BufferGeometry();
    lapelGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    lapelGeo.setIndex(indices);
    lapelGeo.computeVertexNormals();
    whiteCollarParts.push(lapelGeo);
  }
  const collarWhite = mergeCleanGeometries(whiteCollarParts);

  // 2. Single Razor-Clean Continuous Emerald-Green Collar Outer Piping Rim (Front lapels + Side + Back neck!)
  const pAt = (y: number, phi: number, off = 0.028) => new THREE.Vector3(...sampleTunic(y, phi, off));
  const fullPipingCurve = new THREE.CatmullRomCurve3([
    // Left lapel lower front border from V-edge out to sharp corner
    pAt(0.495, Math.PI * 0.5 + 0.06, 0.026),
    pAt(0.495, Math.PI * 0.5 + 0.30, 0.028),
    pAt(0.498, Math.PI * 0.5 + 0.50, 0.028),
    // Sweep cleanly up around left shoulder/neck collar edge to back of neck
    pAt(0.552, Math.PI * 0.5 + 0.64, 0.028),
    new THREE.Vector3(-0.228, 0.592, 0.052),
    new THREE.Vector3(-0.184, 0.598, -0.155),
    new THREE.Vector3(0.0, 0.602, -0.214),
    new THREE.Vector3(0.184, 0.598, -0.155),
    new THREE.Vector3(0.228, 0.592, 0.052),
    // Sweep smoothly forward to right lapel outer corner and across right lower border
    pAt(0.552, Math.PI * 0.5 - 0.64, 0.028),
    pAt(0.498, Math.PI * 0.5 - 0.50, 0.028),
    pAt(0.495, Math.PI * 0.5 - 0.30, 0.028),
    pAt(0.495, Math.PI * 0.5 - 0.06, 0.026),
  ]);
  const collarPiping = mergeCleanGeometries([
    new THREE.TubeGeometry(fullPipingCurve, 64, 0.0115, 10, false),
  ]);

  // 3. Flush Curved Emerald-Green V-Neck Inner Undershirt Triangle
  const vNeckInsert = buildCurvedVInsert();

  // 4. Two Symmetric Lower Hip Patch Pockets (Left & Right) with Crisp Emerald-Green Top Trim Bands!
  const leftPocketBody = buildCurvedPatch(
    0.012,
    0.135,
    Math.PI * 0.605,
    Math.PI * 0.785,
    0.012,
    10,
    12,
  );
  const leftPocketTrim = buildCurvedPatch(
    0.118,
    0.15,
    Math.PI * 0.603,
    Math.PI * 0.787,
    0.016,
    4,
    12,
  );
  const rightPocketBody = buildCurvedPatch(
    0.012,
    0.135,
    Math.PI * 0.215,
    Math.PI * 0.395,
    0.012,
    10,
    12,
  );
  const rightPocketTrim = buildCurvedPatch(
    0.118,
    0.15,
    Math.PI * 0.213,
    Math.PI * 0.397,
    0.016,
    4,
    12,
  );
  const pocketBody = mergeCleanGeometries([leftPocketBody, rightPocketBody]);
  const pocketTrim = mergeCleanGeometries([leftPocketTrim, rightPocketTrim]);

  // 5. Small Inverted-V Front Center Hem Slit revealing emerald scrub pants at the tunic center hem
  const slitShape = new THREE.Shape();
  slitShape.moveTo(-0.042, -0.056);
  slitShape.lineTo(0.042, -0.056);
  slitShape.lineTo(0.0, 0.036);
  slitShape.closePath();

  const slitGeo = new THREE.ExtrudeGeometry(slitShape, {
    depth: 0.014,
    bevelEnabled: false,
  });
  slitGeo.translate(0, 0, 0.308);
  const frontSlit = mergeCleanGeometries([slitGeo]);

  // 6. Contoured vertical emerald center placket stripe running from bottom hem up to V-neck (Ners Alya signature!)
  const centerPlacket = buildCurvedPatch(
    -0.052,
    0.47,
    Math.PI * 0.5 - 0.036,
    Math.PI * 0.5 + 0.036,
    0.011,
    20,
    6,
  );

  // 7. Crisp emerald horizontal chest-pocket welt stripe on character's left chest (+X, viewer's right)
  const chestPocketTrim = buildCurvedPatch(
    0.355,
    0.384,
    Math.PI * 0.255,
    Math.PI * 0.395,
    0.014,
    4,
    10,
  );

  geoCache.set(cwKey, collarWhite);
  geoCache.set(cpKey, collarPiping);
  geoCache.set(vnKey, vNeckInsert);
  geoCache.set(pbKey, pocketBody);
  geoCache.set(ptKey, pocketTrim);
  geoCache.set(fsKey, frontSlit);
  geoCache.set(plKey, centerPlacket);
  geoCache.set(chKey, chestPocketTrim);

  return {
    collarWhite,
    collarPiping,
    vNeckInsert,
    pocketBody,
    pocketTrim,
    frontSlit,
    centerPlacket,
    chestPocketTrim,
  };
}
