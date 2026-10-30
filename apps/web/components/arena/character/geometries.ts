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
  const key = `head-v3:${skinHex}:${blushHex}`;
  const cached = geoCache.get(key);
  if (cached) return cached;

  const geo = new THREE.SphereGeometry(1, 56, 42);
  const pos = geo.attributes.position;
  const count = pos.count;
  const colors = new Float32Array(count * 3);

  const skinColor = new THREE.Color(skinHex);
  const blushColor = new THREE.Color(blushHex);
  const shadowWarmth = skinColor.clone().lerp(blushColor, 0.25);
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
      -(Math.pow((nx + 0.52) / 0.28, 2) + Math.pow((ny + 0.2) / 0.22, 2)),
    );
    const rightCheek = Math.exp(
      -(Math.pow((nx - 0.52) / 0.28, 2) + Math.pow((ny + 0.2) / 0.22, 2)),
    );
    const noseGlow = Math.exp(-(Math.pow(nx / 0.18, 2) + Math.pow((ny + 0.04) / 0.16, 2)));
    const frontMask = smoothstep(0.15, 0.72, nz);
    const chinGlow = smoothstep(-0.45, -0.95, ny) * 0.2;

    const blushWeight = Math.min(
      0.38,
      (leftCheek + rightCheek) * frontMask * 0.3 + noseGlow * frontMask * 0.16,
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

/** Cute plump vertical-ovoid button nose right between/below the eyes. */
export function getSculptedNoseGeometry(): THREE.BufferGeometry {
  const key = 'nose-v3';
  const cached = geoCache.get(key);
  if (cached) return cached;

  const geo = new THREE.SphereGeometry(1, 26, 20);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);
    const tipFullness = 1 + 0.11 * smoothstep(0.4, -0.6, ny);
    pos.setXYZ(i, nx * 0.048 * tipFullness, ny * 0.062, nz * 0.054 * (nz > 0 ? 1.08 : 0.72));
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
function makeHairBaseCap(extraBackLength = 0): THREE.BufferGeometry {
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
    if (nz > -0.06 && ny < 0.42) {
      const frontFactor = smoothstep(-0.06, 0.42, nz);
      const sideburn =
        Math.exp(-Math.pow((Math.abs(nx) - 0.9) / 0.16, 2)) *
        (1 - smoothstep(0.06, 0.36, nz)) *
        smoothstep(-0.22, 0.05, ny);
      const lift = (0.42 - ny) * frontFactor * (1 - sideburn * 0.72);
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
  const cachePrefix = `hairstyle-v5:${style}`;

  if (style === 'curly-tousled') {
    const k = `${cachePrefix}:main`;
    if (!geoCache.has(k)) {
      const parts: THREE.BufferGeometry[] = [makeHairBaseCap(0)];

      // Plush, fuller sculpted wavy crown volume so surface curls blend organically into one soft silhouette!
      const crownDome = new THREE.SphereGeometry(1, 44, 32);
      const cpos = crownDome.attributes.position;
      for (let i = 0; i < cpos.count; i++) {
        const nx = cpos.getX(i);
        const ny = cpos.getY(i);
        const nz = cpos.getZ(i);
        const wave =
          1 +
          0.068 * Math.sin(nx * 5.2 + nz * 3.8) * smoothstep(-0.2, 0.6, ny) +
          0.052 * Math.cos(nz * 4.6 - nx * 3.3) * smoothstep(-0.15, 0.7, ny);
        cpos.setXYZ(i, nx * 0.502 * wave, ny * 0.275 * wave + 0.312, nz * 0.438 * wave + 0.008);
      }
      crownDome.computeVertexNormals();
      parts.push(crownDome);

      // Soft, blended, tousled wavy locks + playful upward crown tufts matching the boy in the reference image!
      const locks: { pts: [number, number, number][]; w: number; th: number; tp?: number }[] = [
        // Cute tousled upward-swept crown tuft left-center (signature messy boy tuft in reference!)
        {
          pts: [
            [-0.18, 0.41, 0.05],
            [-0.12, 0.53, 0.09],
            [-0.07, 0.615, 0.07],
          ],
          w: 0.112,
          th: 0.082,
          tp: 0.72,
        },
        // Cute tousled upward-swept crown tuft right-center
        {
          pts: [
            [0.01, 0.42, 0.06],
            [0.08, 0.54, 0.1],
            [0.14, 0.6, 0.08],
          ],
          w: 0.106,
          th: 0.078,
          tp: 0.72,
        },
        // Soft mid-crown wave bridging left to right
        {
          pts: [
            [-0.28, 0.37, 0.12],
            [-0.08, 0.5, 0.21],
            [0.16, 0.48, 0.19],
          ],
          w: 0.132,
          th: 0.092,
        },
        // Fluffy left & right side volume waves (embedded smoothly into crownDome!)
        {
          pts: [
            [-0.35, 0.21, 0.0],
            [-0.47, 0.33, 0.08],
            [-0.36, 0.46, 0.13],
          ],
          w: 0.124,
          th: 0.088,
        },
        {
          pts: [
            [0.35, 0.21, 0.0],
            [0.47, 0.32, 0.08],
            [0.35, 0.45, 0.12],
          ],
          w: 0.124,
          th: 0.088,
        },
        // Natural airy wavy forehead hairline (parted slightly off-center like reference!)
        {
          pts: [
            [-0.41, 0.22, 0.18],
            [-0.28, 0.34, 0.32],
            [-0.12, 0.36, 0.378],
          ],
          w: 0.112,
          th: 0.078,
        },
        {
          pts: [
            [-0.12, 0.39, 0.27],
            [0.02, 0.38, 0.382],
            [0.16, 0.34, 0.378],
          ],
          w: 0.114,
          th: 0.078,
        },
        {
          pts: [
            [0.15, 0.37, 0.27],
            [0.28, 0.34, 0.335],
            [0.4, 0.23, 0.22],
          ],
          w: 0.108,
          th: 0.074,
        },
        // Neat temple sideburns framing right in front of the ears
        {
          pts: [
            [-0.41, 0.23, 0.15],
            [-0.454, 0.11, 0.095],
            [-0.44, 0.01, 0.045],
          ],
          w: 0.076,
          th: 0.056,
        },
        {
          pts: [
            [0.41, 0.23, 0.15],
            [0.454, 0.11, 0.095],
            [0.44, 0.01, 0.045],
          ],
          w: 0.076,
          th: 0.056,
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

  if (style === 'wavy-bob' || style === 'nurse-bob-cap') {
    const hk = `${cachePrefix}:hair`;
    if (!geoCache.has(hk)) {
      const parts: THREE.BufferGeometry[] = [makeHairBaseCap(0.18)];

      const topCrown = new THREE.SphereGeometry(1, 32, 22);
      topCrown.scale(0.46, 0.2, 0.4);
      topCrown.translate(0, 0.32, 0.0);
      parts.push(topCrown);

      // Cute chin-length rounded bob locks framing the cheeks + parted bangs (Variations 3 & 4!)
      for (const sign of [-1, 1]) {
        parts.push(
          makeSculptedHairLock(
            [
              [sign * 0.28, 0.35, 0.12],
              [sign * 0.45, 0.16, 0.1],
              [sign * 0.46, -0.08, 0.09],
              [sign * 0.38, -0.27, 0.13],
            ],
            0.135,
            0.095,
            0.55,
          ),
        );
        parts.push(
          makeSculptedHairLock(
            [
              [sign * 0.24, 0.3, -0.16],
              [sign * 0.41, 0.05, -0.16],
              [sign * 0.37, -0.25, -0.1],
            ],
            0.145,
            0.1,
            0.55,
          ),
        );
      }
      // Soft center-parted curtain bangs above eyebrows
      parts.push(
        makeSculptedHairLock(
          [
            [-0.02, 0.4, 0.27],
            [-0.21, 0.35, 0.38],
            [-0.39, 0.22, 0.27],
          ],
          0.108,
          0.075,
          0.56,
        ),
      );
      parts.push(
        makeSculptedHairLock(
          [
            [-0.01, 0.41, 0.27],
            [0.2, 0.35, 0.385],
            [0.39, 0.22, 0.27],
          ],
          0.11,
          0.076,
          0.56,
        ),
      );

      const merged = mergeCleanGeometries(parts);
      geoCache.set(hk, merged);
    }

    if (style === 'wavy-bob') {
      return { primaryHair: geoCache.get(hk)! };
    }

    // Soft-sculpted rounded nurse cap perched cleanly on top of the wavy bob
    const ck = `${cachePrefix}:cap`;
    if (!geoCache.has(ck)) {
      const shape = new THREE.Shape();
      shape.moveTo(-0.22, 0);
      shape.lineTo(0.22, 0);
      shape.quadraticCurveTo(0.27, 0.12, 0.21, 0.15);
      shape.quadraticCurveTo(0, 0.18, -0.21, 0.15);
      shape.quadraticCurveTo(-0.27, 0.12, -0.22, 0);

      const cap = new THREE.ExtrudeGeometry(shape, {
        depth: 0.19,
        bevelEnabled: true,
        bevelThickness: 0.026,
        bevelSize: 0.024,
        bevelSegments: 5,
        curveSegments: 16,
      });
      cap.rotateX(-0.16);
      cap.translate(0, 0.46, -0.04);
      const capGeo = mergeCleanGeometries([cap]);
      geoCache.set(ck, capGeo);
    }
    return { primaryHair: geoCache.get(hk)!, headwear: geoCache.get(ck)! };
  }

  if (style === 'hijab-draped') {
    const ok = `${cachePrefix}:outer-v6`;
    const ik = `${cachePrefix}:inner-v6`;
    if (!geoCache.has(ok) || !geoCache.has(ik)) {
      const inner = new THREE.SphereGeometry(1, 40, 28);
      const ipos = inner.attributes.position;
      for (let i = 0; i < ipos.count; i++) {
        const nx = ipos.getX(i);
        const ny = ipos.getY(i);
        const nz = ipos.getZ(i);
        const x = nx * 0.426;
        let y = ny * 0.448 + 0.012;
        let z = nz * (nz > 0 ? 0.418 : 0.39) - 0.014;
        if (nz > 0.04 && ny < 0.36) {
          const push = (0.36 - ny) * smoothstep(0.04, 0.44, nz);
          y += push * 0.72;
          z -= push * 0.52;
        }
        ipos.setXYZ(i, x, y, z);
      }
      inner.computeVertexNormals();
      geoCache.set(ik, inner);

      const parts: THREE.BufferGeometry[] = [];
      const hood = new THREE.SphereGeometry(1, 48, 36);
      const hpos = hood.attributes.position;
      for (let i = 0; i < hpos.count; i++) {
        const nx = hpos.getX(i);
        const ny = hpos.getY(i);
        const nz = hpos.getZ(i);
        const lowerFlair = ny < -0.15 ? 1 + 0.08 * smoothstep(-0.15, -0.9, ny) : 1;
        const x = nx * 0.506 * lowerFlair;
        const y = (ny < -0.5 ? ny * 0.54 : ny * 0.484) + 0.012;
        let z = nz * 0.448 * lowerFlair - 0.012;

        if (nz > 0.08) {
          const inFaceWindow =
            (1 - smoothstep(0.69, 0.91, Math.abs(nx))) *
            (1 - smoothstep(0.32, 0.46, ny)) *
            (1 - smoothstep(-0.74, -0.92, ny));
          const retract = inFaceWindow * smoothstep(0.08, 0.52, nz);
          z -= retract * 0.43;
        }
        hpos.setXYZ(i, x, y, z);
      }
      hood.computeVertexNormals();
      parts.push(hood);

      const cowl = new THREE.SphereGeometry(1, 36, 24);
      const cpos = cowl.attributes.position;
      for (let i = 0; i < cpos.count; i++) {
        const nx = cpos.getX(i);
        const ny = cpos.getY(i);
        const nz = cpos.getZ(i);
        const x = nx * 0.345;
        const y = ny * 0.095 - 0.455 - (nz > 0 ? 0.04 * nz : 0);
        const z = nz * 0.268 + 0.015;
        cpos.setXYZ(i, x, y, z);
      }
      cowl.computeVertexNormals();
      parts.push(cowl);

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
  strapAndBag: THREE.BufferGeometry;
  button: THREE.BufferGeometry;
} {
  const bagKey = 'crossbody-bag-v5';
  const btnKey = 'crossbody-btn-v5';
  if (geoCache.has(bagKey) && geoCache.has(btnKey)) {
    return { strapAndBag: geoCache.get(bagKey)!, button: geoCache.get(btnKey)! };
  }

  const parts: THREE.BufferGeometry[] = [];

  const strapCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-0.22, 0.585, 0.08),
      new THREE.Vector3(-0.08, 0.41, 0.305),
      new THREE.Vector3(0.1, 0.22, 0.326),
      new THREE.Vector3(0.22, 0.095, 0.29),
      new THREE.Vector3(0.32, 0.065, 0.175),
      new THREE.Vector3(0.37, 0.09, -0.04),
      new THREE.Vector3(0.24, 0.23, -0.295),
      new THREE.Vector3(0.0, 0.42, -0.292),
      new THREE.Vector3(-0.21, 0.575, -0.09),
    ],
    true,
  );
  const strap = new THREE.TubeGeometry(strapCurve, 48, 0.024, 10, true);
  parts.push(strap);

  const bagShape = new THREE.Shape();
  const bw = 0.122;
  const bh = 0.105;
  const br = 0.042;
  bagShape.moveTo(-bw + br, -bh);
  bagShape.lineTo(bw - br, -bh);
  bagShape.quadraticCurveTo(bw, -bh, bw, -bh + br);
  bagShape.lineTo(bw, bh - br);
  bagShape.quadraticCurveTo(bw, bh, bw - br, bh);
  bagShape.lineTo(-bw + br, bh);
  bagShape.quadraticCurveTo(-bw, bh, -bw, bh - br);
  bagShape.lineTo(-bw, -bh + br);
  bagShape.quadraticCurveTo(-bw, -bh, -bw + prClamp(br), -bh);

  function prClamp(v: number) {
    return v;
  }

  const bagBody = new THREE.ExtrudeGeometry(bagShape, {
    depth: 0.078,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.026,
    bevelSegments: 5,
    curveSegments: 14,
  });

  const flapShape = new THREE.Shape();
  flapShape.moveTo(-bw, 0.01);
  flapShape.quadraticCurveTo(0, -0.05, bw, 0.01);
  flapShape.lineTo(bw, bh);
  flapShape.lineTo(-bw, bh);
  flapShape.closePath();

  const flap = new THREE.ExtrudeGeometry(flapShape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.013,
    bevelSize: 0.013,
    bevelSegments: 4,
    curveSegments: 14,
  });
  flap.translate(0, 0.01, 0.088);

  const bagGroup = mergeCleanGeometries([bagBody, flap]);
  bagGroup.rotateY(0.46);
  bagGroup.rotateZ(-0.06);
  bagGroup.translate(0.242, 0.035, 0.242);
  parts.push(bagGroup);

  const merged = mergeCleanGeometries(parts);

  const btn = new THREE.SphereGeometry(0.021, 16, 12);
  btn.scale(1, 1, 0.6);
  btn.rotateY(0.46);
  btn.translate(0.298, 0.028, 0.342);
  btn.computeVertexNormals();

  geoCache.set(bagKey, merged);
  geoCache.set(btnKey, btn);
  return { strapAndBag: merged, button: btn };
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
