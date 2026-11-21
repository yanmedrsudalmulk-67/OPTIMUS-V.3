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
    skin: '#f2ac84',
    skinBlush: '#e3775d',
    hair: '#69361a',
    hairSheen: '#b06535',
    hairStyle: 'curly-fluffy-doctor',
    top: '#558bd6',
    coat: '#eff1f9',
    tailoredLabCoat: true,
    dressShirtCollar: true,
    longSleeves: true,
    innerCuffColor: '#558bd6',
    lanyardColor: '#1a8a52',
    beltColor: '#3d2518',
    beltBuckleColor: '#caa16b',
    pants: '#583f30',
    shoeUpper: '#703f23',
    shoeSole: '#3b2214',
    shoeLaceColor: '#482613',
    dressShoes: true,
    hasStethoscope: true,
    proStethoscope: true,
    confidentSmile: true,
    hasWatch: false,
  },
  'doctor-f': {
    skin: '#f2b189',
    skinBlush: '#e57c63',
    hair: '#5c341a',
    hairSheen: '#9c6036',
    hairStyle: 'doctor-f-wavy',
    top: '#2e64d1',
    coat: '#f3f6fc',
    tailoredLabCoat: true,
    longSleeves: true,
    pants: '#224a9e',
    shoeUpper: '#eef2f7',
    shoeSole: '#ffffff',
    shoeLaceColor: '#d9e3f0',
    hasStethoscope: true,
    proStethoscope: true,
    blueCrossBadge: true,
    hasWatch: false,
  },
  'nurse-m': {
    skin: '#f1ab82',
    skinBlush: '#e3795e',
    hair: '#6b3c20',
    hairSheen: '#a6663d',
    hairStyle: 'nurse-swept-fluffy',
    top: '#edf1f5',
    tunicTrim: '#0d8a5b',
    nurseScrubTop: true,
    sleeveStripeColor: '#0d8a5b',
    lanyardColor: '#0d8a5b',
    nurseIdCard: true,
    pants: '#0c7f53',
    shortsStyle: false,
    shoeUpper: '#ebe0c8',
    shoeSole: '#f6f2e7',
    shoeLaceColor: '#f5efe0',
    hasWatch: true,
    galleryProp: 'clipboard',
  },
  'nurse-f': {
    skin: '#f2b189',
    skinBlush: '#e57b61',
    hair: '#693c21',
    hairSheen: '#a4643b',
    hairStyle: 'nurse-bob-cap',
    capColor: '#f8fafc',
    hijabInner: '#0d8a5b',
    top: '#f2f6fa',
    tunicTrim: '#0d8a5b',
    nurseScrubTop: true,
    nurseFrontPlacket: true,
    nurseChestPocket: true,
    sleeveStripeColor: '#0d8a5b',
    lanyardColor: '#0d8a5b',
    nurseIdCard: true,
    pants: '#0c8254',
    shortsStyle: false,
    shoeUpper: '#eef2f7',
    shoeSole: '#ffffff',
    shoeLaceColor: '#dde6f0',
    confidentSmile: true,
    hasWatch: false,
    galleryProp: 'clipboard',
  },
  midwife: {
    skin: '#efa87f',
    skinBlush: '#e4735a',
    hair: '#3a2014',
    hairSheen: '#6b3f29',
    hairStyle: 'hijab-draped',
    hijabColor: '#097f53',
    hijabInner: '#edf2f5',
    top: '#e6ecef',
    tunicTrim: '#097f53',
    longSleeves: true,
    pants: '#08774d',
    shoeUpper: '#ede0c4',
    shoeSole: '#f1f3f1',
    pouch: '#097d51',
    pouchBody: '#ebf0f2',
    hasWatch: true,
  },
  pharmacist: {
    skin: '#eba77f',
    skinBlush: '#de785e',
    hair: '#573420',
    hairSheen: '#8a5639',
    hairStyle: 'parted-fluffy',
    top: '#3f8c71',
    coat: '#eee8dc',
    pants: '#ae8c5d',
    shoeUpper: '#e8d5a4',
    shoeSole: '#f4ecd5',
    hasGlasses: true,
    hasWatch: true,
    galleryProp: 'pill-bottle',
  },
  analyst: {
    skin: '#e7a178',
    skinBlush: '#da745a',
    hair: '#4a2c1c',
    hairSheen: '#784b33',
    hairStyle: 'curly-tousled',
    top: '#6960a6',
    coat: '#efeae0',
    pants: '#394354',
    shoeUpper: '#e7d4a5',
    shoeSole: '#f4ecd5',
    glove: '#9fd0e0',
    hasGoggles: true,
    galleryProp: 'test-tube',
  },
  ambulance: {
    skin: '#de966c',
    skinBlush: '#cf6b51',
    hair: '#472a1b',
    hairSheen: '#734730',
    hairStyle: 'responder-cap',
    capColor: '#e6aa3a',
    top: '#c95233',
    pants: '#303c42',
    shoeUpper: '#434f56',
    shoeSole: '#eae0c8',
    pouch: '#384640',
    hasReflective: true,
    hasWatch: true,
    galleryProp: 'first-aid',
  },
  surgeon: {
    skin: '#efa982',
    skinBlush: '#e17b62',
    hair: '#4c2d1d',
    hairSheen: '#7a4b33',
    hairStyle: 'surgical-bouffant',
    capColor: '#3ca39c',
    top: '#297a7c',
    pants: '#226163',
    shoeUpper: '#ece2c8',
    shoeSole: '#f6f0df',
    glove: '#a7ded9',
  },
  radiographer: {
    skin: '#e6a076',
    skinBlush: '#d97359',
    hair: '#5e3823',
    hairSheen: '#915b3c',
    hairStyle: 'parted-fluffy',
    top: '#89b2d1',
    pants: '#34485c',
    shoeUpper: '#e7d4a3',
    shoeSole: '#f4ecd5',
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
float wrapNL_sss = saturate( ( rawNL_sss + 0.44 ) / 1.44 );
float sssBand = smoothstep( -0.48, 0.14, rawNL_sss ) * ( 1.0 - smoothstep( 0.04, 0.56, rawNL_sss ) );
vec3 sssTint = vec3( 0.94, 0.36, 0.23 );
vec3 skinIrradiance = ( wrapNL_sss * directLight.color ) + ( sssBand * 0.20 * directLight.color * sssTint );
reflectedLight.directDiffuse += skinIrradiance * BRDF_Lambert( material.diffuseContribution );
`;

/**
 * Warm clay-vinyl subsurface skin shader inspired by Spline / Cycles soft vinyl characters.
 * Wraps diffuse key lighting smoothly across cheeks and chin so shadows stay warm peachy-terracotta.
 */
export function getSkinMaterial(hex: string, useVertexColors = false): THREE.MeshPhysicalMaterial {
  const key = `skin:${hex}:${useVertexColors ? 'vc' : 'flat'}`;
  const cached = materialCache.get(key) as THREE.MeshPhysicalMaterial | undefined;
  if (cached) return cached;

  const base = new THREE.Color(hex);
  const sheenTint = base.clone().lerp(new THREE.Color('#ffdcc8'), 0.55);

  const mat = new THREE.MeshPhysicalMaterial({
    color: useVertexColors ? '#ffffff' : hex,
    vertexColors: useVertexColors,
    roughness: 0.72,
    metalness: 0.0,
    sheen: 0.24,
    sheenRoughness: 0.75,
    sheenColor: sheenTint,
    clearcoat: 0.03,
    clearcoatRoughness: 0.65,
  });

  mat.customProgramCacheKey = () => 'clay-vinyl-skin-sss-v1';
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

/** Cozy brushed-cotton / fleece fabric material with soft velvet edge sheen. */
export function getFabricMaterial(
  hex: string,
  roughness = 0.87,
  doubleSided = false,
): THREE.MeshPhysicalMaterial {
  const key = `fabric:${hex}:${roughness}:${doubleSided ? '2' : '1'}`;
  const cached = materialCache.get(key) as THREE.MeshPhysicalMaterial | undefined;
  if (cached) return cached;

  const base = new THREE.Color(hex);
  const sheenColor = base.clone().lerp(new THREE.Color('#fff9ef'), 0.38);

  const mat = new THREE.MeshPhysicalMaterial({
    color: base,
    roughness,
    metalness: 0.0,
    sheen: 0.34,
    sheenRoughness: 0.78,
    sheenColor,
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });

  materialCache.set(key, mat);
  return mat;
}

/** Plush sculpted hair material — rich matte base with warm chestnut rim sheen, never shiny plastic. */
export function getHairMaterial(hex: string, sheenHex: string): THREE.MeshPhysicalMaterial {
  const key = `hair:${hex}:${sheenHex}`;
  const cached = materialCache.get(key) as THREE.MeshPhysicalMaterial | undefined;
  if (cached) return cached;

  const mat = new THREE.MeshPhysicalMaterial({
    color: hex,
    roughness: 0.7,
    metalness: 0.0,
    sheen: 0.38,
    sheenRoughness: 0.58,
    sheenColor: new THREE.Color(sheenHex),
    clearcoat: 0.04,
    clearcoatRoughness: 0.6,
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
