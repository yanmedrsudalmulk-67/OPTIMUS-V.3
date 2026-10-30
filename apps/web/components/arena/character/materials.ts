import * as THREE from 'three';
import type { Team } from '../../../../../packages/shared/src';

export type HairStyle =
  | 'curly-tousled'
  | 'parted-fluffy'
  | 'wavy-bob'
  | 'hijab-draped'
  | 'surgical-bouffant'
  | 'responder-cap'
  | 'nurse-bob-cap';

export interface HeroVisualProfile {
  skin: string;
  skinBlush: string;
  hair: string;
  hairSheen: string;
  hairStyle: HairStyle;
  top: string;
  coat?: string;
  pants: string;
  shortsStyle?: boolean;
  shoeUpper: string;
  shoeSole: string;
  glove?: string;
  pouch?: string;
  capColor?: string;
  hijabColor?: string;
  hijabInner?: string;
  hasStethoscope?: boolean;
  hasGlasses?: boolean;
  hasGoggles?: boolean;
  hasWatch?: boolean;
  hasReflective?: boolean;
  hasLeadApron?: boolean;
}

export const HERO_PROFILES: Record<string, HeroVisualProfile> = {
  'doctor-m': {
    skin: '#eea87e',
    skinBlush: '#e07a5f',
    hair: '#693f26',
    hairSheen: '#9e6543',
    hairStyle: 'curly-tousled',
    top: '#597441',
    coat: '#f0ebe0',
    pants: '#b38f5d',
    shoeUpper: '#e7d3a1',
    shoeSole: '#f4ecd6',
    hasStethoscope: true,
    hasWatch: true,
  },
  'doctor-f': {
    skin: '#f2b38d',
    skinBlush: '#e47f67',
    hair: '#6e432a',
    hairSheen: '#a36948',
    hairStyle: 'wavy-bob',
    top: '#5c6eb8',
    coat: '#f2ede3',
    pants: '#3a4b66',
    shoeUpper: '#ead8ad',
    shoeSole: '#f5eedb',
    hasStethoscope: true,
    hasWatch: true,
  },
  'nurse-m': {
    skin: '#eca479',
    skinBlush: '#de785c',
    hair: '#663d24',
    hairSheen: '#9b6240',
    hairStyle: 'curly-tousled',
    top: '#587e40',
    pants: '#b99563',
    shortsStyle: true,
    shoeUpper: '#e8d5a3',
    shoeSole: '#f4ecd6',
    pouch: '#4f7338',
    hasWatch: true,
  },
  'nurse-f': {
    skin: '#f1b08a',
    skinBlush: '#e37d65',
    hair: '#543320',
    hairSheen: '#87553a',
    hairStyle: 'nurse-bob-cap',
    capColor: '#f4efe5',
    top: '#448db8',
    pants: '#334d63',
    shoeUpper: '#ebd9ae',
    shoeSole: '#f5eedb',
    pouch: '#326a8c',
    hasWatch: true,
  },
  midwife: {
    skin: '#eda981',
    skinBlush: '#e17b63',
    hair: '#4d2e1e',
    hairSheen: '#7a4c35',
    hairStyle: 'hijab-draped',
    hijabColor: '#cf7b99',
    hijabInner: '#f3e7eb',
    top: '#f2e6e9',
    pants: '#5d4761',
    shoeUpper: '#ecdab2',
    shoeSole: '#f5eedc',
    pouch: '#b55f7e',
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
    roughness: 0.81,
    metalness: 0.0,
    sheen: 0.32,
    sheenRoughness: 0.62,
    sheenColor: new THREE.Color(sheenHex),
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
