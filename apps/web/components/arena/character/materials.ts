import * as THREE from 'three';
import type { Team } from '../../../../../packages/shared/src';

export type HairStyle =
  | 'curly-tousled'
  | 'curly-fluffy-doctor'
  | 'doctor-f-wavy'
  | 'nurse-swept-fluffy'
  | 'parted-fluffy'
  | 'wavy-bob'
  | 'hijab-draped'
  | 'surgical-bouffant'
  | 'responder-cap'
  | 'nurse-bob-cap';

export type GalleryHandProp = 'clipboard' | 'pill-bottle' | 'test-tube' | 'first-aid' | 'xray';

export interface HeroVisualProfile {
  skin: string;
  skinBlush: string;
  hair: string;
  hairSheen: string;
  hairStyle: HairStyle;
  top: string;
  tunicTrim?: string;
  nurseScrubTop?: boolean;
  nurseFrontPlacket?: boolean;
  nurseChestPocket?: boolean;
  sleeveStripeColor?: string;
  longSleeves?: boolean;
  innerCuffColor?: string;
  coat?: string;
  tailoredLabCoat?: boolean;
  dressShirtCollar?: boolean;
  lanyardColor?: string;
  nurseIdCard?: boolean;
  beltColor?: string;
  beltBuckleColor?: string;
  pants: string;
  shortsStyle?: boolean;
  shoeUpper: string;
  shoeSole: string;
  shoeLaceColor?: string;
  dressShoes?: boolean;
  glove?: string;
  pouch?: string;
  pouchBody?: string;
  capColor?: string;
  hijabColor?: string;
  hijabInner?: string;
  hasStethoscope?: boolean;
  proStethoscope?: boolean;
  blueCrossBadge?: boolean;
  confidentSmile?: boolean;
  hasGlasses?: boolean;
  hasGoggles?: boolean;
  hasWatch?: boolean;
  hasReflective?: boolean;
  hasLeadApron?: boolean;
  galleryProp?: GalleryHandProp;
}

export const HERO_PROFILES: Record<string, HeroVisualProfile> = {
  'doctor-m': {
    skin: '#ea9b6e',
    skinBlush: '#d64f34',
    hair: '#4a210b',
    hairSheen: '#bd632a',
    hairStyle: 'curly-fluffy-doctor',
    top: '#1d4ed8',
    coat: '#f1f5f9',
    tailoredLabCoat: true,
    dressShirtCollar: true,
    longSleeves: true,
    innerCuffColor: '#1d4ed8',
    lanyardColor: '#16a34a',
    beltColor: '#3d2518',
    beltBuckleColor: '#d4af77',
    pants: '#5c3d28',
    shoeUpper: '#733a18',
    shoeSole: '#2e180c',
    shoeLaceColor: '#3d1e0d',
    dressShoes: true,
    hasStethoscope: true,
    proStethoscope: true,
    confidentSmile: true,
    hasWatch: false,
  },
  'doctor-f': {
    skin: '#ec9f74',
    skinBlush: '#d9563c',
    hair: '#4d260f',
    hairSheen: '#a8602e',
    hairStyle: 'doctor-f-wavy',
    top: '#1d4ed8',
    coat: '#f1f5f9',
    tailoredLabCoat: true,
    longSleeves: true,
    pants: '#1e40af',
    shoeUpper: '#e2e8f0',
    shoeSole: '#f8fafc',
    shoeLaceColor: '#cbd5e1',
    hasStethoscope: true,
    proStethoscope: true,
    blueCrossBadge: true,
    confidentSmile: true,
    hasWatch: false,
  },
  'nurse-m': {
    skin: '#e8986c',
    skinBlush: '#d65237',
    hair: '#572c13',
    hairSheen: '#ad6332',
    hairStyle: 'nurse-swept-fluffy',
    top: '#f1f5f9',
    tunicTrim: '#0d8a5b',
    nurseScrubTop: true,
    sleeveStripeColor: '#0d8a5b',
    lanyardColor: '#0d8a5b',
    nurseIdCard: true,
    pants: '#0a6e47',
    shortsStyle: false,
    shoeUpper: '#e2e8f0',
    shoeSole: '#f8fafc',
    shoeLaceColor: '#cbd5e1',
    confidentSmile: true,
    hasWatch: true,
    galleryProp: 'clipboard',
  },
  'nurse-f': {
    skin: '#ec9f74',
    skinBlush: '#d9563c',
    hair: '#542a12',
    hairSheen: '#ab6132',
    hairStyle: 'nurse-bob-cap',
    capColor: '#f1f5f9',
    hijabInner: '#0d8a5b',
    top: '#f1f5f9',
    tunicTrim: '#0d8a5b',
    nurseScrubTop: true,
    nurseFrontPlacket: true,
    nurseChestPocket: true,
    sleeveStripeColor: '#0d8a5b',
    lanyardColor: '#0d8a5b',
    nurseIdCard: true,
    pants: '#0a6e47',
    shortsStyle: false,
    shoeUpper: '#e2e8f0',
    shoeSole: '#f8fafc',
    shoeLaceColor: '#cbd5e1',
    confidentSmile: true,
    hasWatch: false,
    galleryProp: 'clipboard',
  },
  midwife: {
    skin: '#e8986c',
    skinBlush: '#d65237',
    hair: '#331a0e',
    hairSheen: '#6e3f26',
    hairStyle: 'hijab-draped',
    hijabColor: '#087049',
    hijabInner: '#e2e8f0',
    top: '#e8eef2',
    tunicTrim: '#087049',
    longSleeves: true,
    pants: '#076340',
    shoeUpper: '#e2e8f0',
    shoeSole: '#f8fafc',
    pouch: '#087049',
    pouchBody: '#e8eef2',
    confidentSmile: true,
    hasWatch: true,
  },
  pharmacist: {
    skin: '#e69569',
    skinBlush: '#d45136',
    hair: '#472613',
    hairSheen: '#8f5532',
    hairStyle: 'parted-fluffy',
    top: '#267359',
    coat: '#f1f5f9',
    pants: '#8c6b3f',
    shoeUpper: '#dcc692',
    shoeSole: '#f1f5f9',
    confidentSmile: true,
    hasGlasses: true,
    hasWatch: true,
    galleryProp: 'pill-bottle',
  },
  analyst: {
    skin: '#e39165',
    skinBlush: '#d14f34',
    hair: '#3d2112',
    hairSheen: '#804c2f',
    hairStyle: 'curly-tousled',
    top: '#4f4694',
    coat: '#f1f5f9',
    pants: '#2b3748',
    shoeUpper: '#dcc692',
    shoeSole: '#f1f5f9',
    glove: '#38bdf8',
    confidentSmile: true,
    hasGoggles: true,
    galleryProp: 'test-tube',
  },
  ambulance: {
    skin: '#dc895c',
    skinBlush: '#c94a30',
    hair: '#3b2012',
    hairSheen: '#7a472c',
    hairStyle: 'responder-cap',
    capColor: '#d97706',
    top: '#c73e1d',
    pants: '#222d33',
    shoeUpper: '#354046',
    shoeSole: '#e5dec9',
    pouch: '#2b3732',
    confidentSmile: true,
    hasReflective: true,
    hasWatch: true,
    galleryProp: 'first-aid',
  },
  surgeon: {
    skin: '#e8986c',
    skinBlush: '#d65237',
    hair: '#3f2213',
    hairSheen: '#7d492e',
    hairStyle: 'surgical-bouffant',
    capColor: '#0d9488',
    top: '#0f766e',
    pants: '#115e59',
    shoeUpper: '#e2e8f0',
    shoeSole: '#f8fafc',
    glove: '#5eead4',
  },
  radiographer: {
    skin: '#e39165',
    skinBlush: '#d14f34',
    hair: '#4d2b17',
    hairSheen: '#945935',
    hairStyle: 'parted-fluffy',
    top: '#0284c7',
    pants: '#243444',
    shoeUpper: '#dcc692',
    shoeSole: '#f1f5f9',
    confidentSmile: true,
    hasLeadApron: true,
    hasWatch: true,
    galleryProp: 'xray',
  },
};

export function getHeroProfile(characterId: string): HeroVisualProfile {
  return HERO_PROFILES[characterId] ?? HERO_PROFILES['doctor-m'];
}

export function getTeamAccent(team: Team = 'A'): string {
  return team === 'A' ? '#159a7c' : '#3574dc';
}

const materialCache = new Map<string, THREE.Material>();

const SUBSURFACE_PARSE_PATCH = `
float rawNL_sss = dot( geometryNormal, directLight.direction );
float wrapNL_sss = saturate( ( rawNL_sss + 0.24 ) / 1.24 );
float sssBand = smoothstep( -0.42, 0.14, rawNL_sss ) * ( 1.0 - smoothstep( 0.02, 0.52, rawNL_sss ) );
vec3 sssTint = vec3( 0.95, 0.34, 0.20 );
vec3 skinIrradiance = ( wrapNL_sss * directLight.color ) + ( sssBand * 0.26 * directLight.color * sssTint );
reflectedLight.directDiffuse += skinIrradiance * BRDF_Lambert( material.diffuseContribution );
`;

/**
 * Warm clay-vinyl subsurface skin shader inspired by Spline / Cycles soft vinyl characters.
 * Wraps diffuse key lighting smoothly across cheeks and chin so shadows stay warm peachy-terracotta.
 */
export function getSkinMaterial(hex: string, useVertexColors = false): THREE.MeshPhysicalMaterial {
  const key = `skin-v3:${hex}:${useVertexColors ? 'vc' : 'flat'}`;
  const cached = materialCache.get(key) as THREE.MeshPhysicalMaterial | undefined;
  if (cached) return cached;

  const base = new THREE.Color(hex);
  const sheenTint = base.clone().lerp(new THREE.Color('#ffd6bd'), 0.5);

  const mat = new THREE.MeshPhysicalMaterial({
    color: useVertexColors ? '#ffffff' : hex,
    vertexColors: useVertexColors,
    roughness: 0.44,
    metalness: 0.0,
    sheen: 0.32,
    sheenRoughness: 0.52,
    sheenColor: sheenTint,
    clearcoat: 0.2,
    clearcoatRoughness: 0.34,
  });

  mat.customProgramCacheKey = () => 'clay-vinyl-skin-sss-v3';
  mat.onBeforeCompile = (shader) => {
    const chunk = THREE.ShaderChunk.lights_physical_pars_fragment;
    const target =
      'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );';
    if (chunk && chunk.includes(target)) {
      const patched = chunk.replace(target, SUBSURFACE_PARSE_PATCH);
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_physical_pars_fragment>',
        patched,
      );
    }
  };

  materialCache.set(key, mat);
  return mat;
}

/** Cozy brushed-cotton / vinyl-satin fabric material with soft studio edge sheen. */
export function getFabricMaterial(
  hex: string,
  roughness = 0.72,
  doubleSided = false,
): THREE.MeshPhysicalMaterial {
  const key = `fabric-v2:${hex}:${roughness}:${doubleSided ? '2' : '1'}`;
  const cached = materialCache.get(key) as THREE.MeshPhysicalMaterial | undefined;
  if (cached) return cached;

  const base = new THREE.Color(hex);
  const sheenColor = base.clone().lerp(new THREE.Color('#ffffff'), 0.45);

  const mat = new THREE.MeshPhysicalMaterial({
    color: base,
    roughness: Math.max(0.42, roughness * 0.8),
    metalness: 0.0,
    sheen: 0.44,
    sheenRoughness: 0.62,
    sheenColor,
    clearcoat: 0.1,
    clearcoatRoughness: 0.45,
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });

  materialCache.set(key, mat);
  return mat;
}

/** Glossy sculpted vinyl hair material — rich chestnut base with warm specular curl highlights like Hero Gallery. */
export function getHairMaterial(hex: string, sheenHex: string): THREE.MeshPhysicalMaterial {
  const key = `hair-v2:${hex}:${sheenHex}`;
  const cached = materialCache.get(key) as THREE.MeshPhysicalMaterial | undefined;
  if (cached) return cached;

  const mat = new THREE.MeshPhysicalMaterial({
    color: hex,
    roughness: 0.32,
    metalness: 0.02,
    sheen: 0.65,
    sheenRoughness: 0.38,
    sheenColor: new THREE.Color(sheenHex),
    clearcoat: 0.46,
    clearcoatRoughness: 0.22,
  });

  materialCache.set(key, mat);
  return mat;
}

/** Glossy espresso bead eye material, subtle metallic/rubber trim materials. */
export function getStandardPartMaterial(
  hex: string,
  options: {
    roughness?: number;
    metalness?: number;
    clearcoat?: number;
    emissive?: string;
    emissiveIntensity?: number;
    transparent?: boolean;
    opacity?: number;
  } = {},
): THREE.MeshPhysicalMaterial {
  const key = `part:${hex}:${JSON.stringify(options)}`;
  const cached = materialCache.get(key) as THREE.MeshPhysicalMaterial | undefined;
  if (cached) return cached;

  const mat = new THREE.MeshPhysicalMaterial({
    color: hex,
    roughness: options.roughness ?? 0.55,
    metalness: options.metalness ?? 0.0,
    clearcoat: options.clearcoat ?? 0.0,
    clearcoatRoughness: 0.18,
    emissive: options.emissive ? new THREE.Color(options.emissive) : new THREE.Color('#000000'),
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    depthWrite: !(options.transparent ?? false),
  });

  materialCache.set(key, mat);
  return mat;
}

/** Burnished soft-gloss leather material for Oxford dress shoes and waist belt. */
export function getLeatherMaterial(hex: string): THREE.MeshPhysicalMaterial {
  const key = `leather:${hex}`;
  const cached = materialCache.get(key) as THREE.MeshPhysicalMaterial | undefined;
  if (cached) return cached;

  const mat = new THREE.MeshPhysicalMaterial({
    color: hex,
    roughness: 0.36,
    metalness: 0.04,
    clearcoat: 0.3,
    clearcoatRoughness: 0.32,
    sheen: 0.14,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color('#c88b5a'),
  });

  materialCache.set(key, mat);
  return mat;
}

/**
 * Procedural high-DPI CanvasTexture for Dr. Arga's hanging medical ID Card
 * (mint-green border, doctor avatar portrait box, and crisp info bars).
 */
export function getDoctorIdCardMaterial(): THREE.MeshPhysicalMaterial {
  const key = 'doctor-id-card-v1';
  const cached = materialCache.get(key) as THREE.MeshPhysicalMaterial | undefined;
  if (cached) return cached;

  let map: THREE.CanvasTexture | undefined;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Crisp white card base
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 256, 320);

      // Soft mint green perimeter frame
      ctx.strokeStyle = '#a7e3c4';
      ctx.lineWidth = 14;
      ctx.strokeRect(11, 11, 234, 298);

      // Top lanyard punch slot
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(102, 22, 52, 12, 6);
      ctx.fill();

      // Portrait background box (soft mint green)
      ctx.fillStyle = '#8adbb0';
      ctx.beginPath();
      ctx.roundRect(44, 52, 168, 150, 14);
      ctx.fill();

      // Doctor avatar bust inside portrait box
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.ellipse(128, 206, 56, 44, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#558bd6';
      ctx.beginPath();
      ctx.moveTo(106, 168);
      ctx.lineTo(150, 168);
      ctx.lineTo(128, 204);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f3b38d';
      ctx.beginPath();
      ctx.arc(128, 124, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a2f18';
      ctx.beginPath();
      ctx.arc(128, 102, 34, Math.PI * 0.92, Math.PI * 2.08);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(106, 98, 14, 0, Math.PI * 2);
      ctx.arc(128, 86, 16, 0, Math.PI * 2);
      ctx.arc(150, 98, 14, 0, Math.PI * 2);
      ctx.fill();

      // Horizontal info bars below portrait
      ctx.fillStyle = '#6ec498';
      ctx.beginPath();
      ctx.roundRect(48, 224, 160, 16, 8);
      ctx.fill();

      ctx.fillStyle = '#a3dec0';
      ctx.beginPath();
      ctx.roundRect(48, 252, 108, 12, 6);
      ctx.fill();

      ctx.fillStyle = '#8adbb0';
      ctx.beginPath();
      ctx.roundRect(168, 252, 40, 12, 6);
      ctx.fill();

      ctx.fillStyle = '#c1ebd6';
      ctx.beginPath();
      ctx.roundRect(48, 274, 136, 10, 5);
      ctx.fill();
    }
    map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }

  const mat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    map,
    roughness: 0.35,
    metalness: 0.02,
    clearcoat: 0.35,
    clearcoatRoughness: 0.25,
  });

  materialCache.set(key, mat);
  return mat;
}

/**
 * Procedural high-DPI CanvasTexture for Ners Bima's emerald-green framed vertical nurse ID card
 * matching the Perawat Pria turnaround sheet (crisp emerald border, white interior, subtle bust icon & info lines).
 */
export function getNurseIdCardMaterial(): THREE.MeshPhysicalMaterial {
  const key = 'nurse-id-card-v1';
  const cached = materialCache.get(key) as THREE.MeshPhysicalMaterial | undefined;
  if (cached) return cached;

  let map: THREE.CanvasTexture | undefined;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Emerald green outer plastic holder frame
      ctx.fillStyle = '#0d8a5b';
      ctx.fillRect(0, 0, 256, 320);

      // Crisp rounded white inner badge window
      ctx.fillStyle = '#f9fbfb';
      ctx.beginPath();
      ctx.roundRect(22, 26, 212, 268, 16);
      ctx.fill();

      // Subtle inner portrait window panel
      ctx.fillStyle = '#edf3f0';
      ctx.beginPath();
      ctx.roundRect(48, 52, 160, 148, 12);
      ctx.fill();

      // Stylized clean neutral avatar bust silhouette (exact Perawat Pria ID card look)
      ctx.fillStyle = '#8fa89e';
      ctx.beginPath();
      ctx.arc(128, 114, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(128, 198, 54, 42, 0, Math.PI, Math.PI * 2);
      ctx.fill();

      // Two crisp horizontal info bars below portrait
      ctx.fillStyle = '#9bb5aa';
      ctx.beginPath();
      ctx.roundRect(54, 222, 148, 14, 7);
      ctx.fill();

      ctx.fillStyle = '#c1d5cc';
      ctx.beginPath();
      ctx.roundRect(74, 250, 108, 12, 6);
      ctx.fill();
    }
    map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }

  const mat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    map,
    roughness: 0.34,
    metalness: 0.02,
    clearcoat: 0.35,
    clearcoatRoughness: 0.24,
  });

  materialCache.set(key, mat);
  return mat;
}

/**
 * Procedural high-DPI CanvasTexture for Dr. Maya's Start-Game signature white medical badge
 * with crisp cobalt-blue header clip and bold blue medical cross emblem.
 */
export function getBlueCrossIdBadgeMaterial(): THREE.MeshPhysicalMaterial {
  const key = 'blue-cross-id-badge-v1';
  const cached = materialCache.get(key) as THREE.MeshPhysicalMaterial | undefined;
  if (cached) return cached;

  let map: THREE.CanvasTexture | undefined;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Crisp white rounded card base
      ctx.fillStyle = '#f8fbff';
      ctx.fillRect(0, 0, 256, 300);

      // Soft cobalt border
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 14;
      ctx.strokeRect(10, 10, 236, 280);

      // Top header clip bar
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.roundRect(76, 26, 104, 22, 11);
      ctx.fill();

      // Bold centered royal-blue medical cross
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.roundRect(104, 86, 48, 128, 10);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(64, 126, 128, 48, 10);
      ctx.fill();

      // Subtle footer bar
      ctx.fillStyle = '#93c5fd';
      ctx.beginPath();
      ctx.roundRect(58, 240, 140, 14, 7);
      ctx.fill();
    }
    map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }

  const mat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    map,
    roughness: 0.3,
    metalness: 0.04,
    clearcoat: 0.42,
    clearcoatRoughness: 0.2,
  });

  materialCache.set(key, mat);
  return mat;
}

/**
 * Procedural glowing blue chest X-ray film texture for Rad. Danu's gallery pose prop.
 */
export function getXrayFilmMaterial(): THREE.MeshPhysicalMaterial {
  const key = 'xray-film-v1';
  const cached = materialCache.get(key) as THREE.MeshPhysicalMaterial | undefined;
  if (cached) return cached;

  let map: THREE.CanvasTexture | undefined;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Deep diagnostic radiograph blue-slate film base
      const grad = ctx.createRadialGradient(128, 160, 18, 128, 160, 175);
      grad.addColorStop(0, '#164e7a');
      grad.addColorStop(1, '#081b33');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 320);

      // Crisp light border frame
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, 240, 304);

      // Stylized spine column
      ctx.fillStyle = 'rgba(219, 234, 254, 0.85)';
      ctx.beginPath();
      ctx.roundRect(119, 52, 18, 214, 8);
      ctx.fill();

      // Stylized clavicles + 6 pairs of arched luminous ribs
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.82)';
      ctx.lineCap = 'round';
      ctx.lineWidth = 11;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(128 + s * 14, 68);
        ctx.quadraticCurveTo(128 + s * 62, 54, 128 + s * 84, 78);
        ctx.stroke();
      }
      ctx.lineWidth = 9;
      for (let r = 0; r < 6; r++) {
        const y = 96 + r * 26;
        const spread = 68 + Math.sin((r / 5) * Math.PI) * 20;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(128 + s * 12, y);
          ctx.quadraticCurveTo(128 + s * spread, y - 6, 128 + s * (spread - 14), y + 18);
          ctx.stroke();
        }
      }
    }
    map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }

  const mat = new THREE.MeshPhysicalMaterial({
    color: '#e0f2fe',
    map,
    emissive: new THREE.Color('#38bdf8'),
    emissiveMap: map,
    emissiveIntensity: 0.45,
    roughness: 0.2,
    metalness: 0.05,
    clearcoat: 0.6,
    side: THREE.DoubleSide,
  });

  materialCache.set(key, mat);
  return mat;
}
