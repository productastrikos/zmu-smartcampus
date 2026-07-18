import * as THREE from 'three';

// The Astriverse/DSO "holographic glass" look: near-transparent cyan body +
// bright glowing cyan edges. No flat opaque colour fills, ever.
export const HOLO = {
  glass: 0x1478ff,
  edge: 0x2be8ff,
  edgeHover: 0xbffdff,
  edgeSelected: 0xffffff,
  glassOpacity: 0.25,
  glassOpacityHover: 0.38,
  glassOpacityFaded: 0.06,
  emissiveIntensity: 0.18,
  emissiveIntensityHover: 0.4,
  emissiveIntensitySelected: 0.48,
};

export function makeGlassMaterial(opacity = HOLO.glassOpacity) {
  return new THREE.MeshPhysicalMaterial({
    color: HOLO.glass,
    metalness: 0.1,
    roughness: 0.25,
    transmission: 0.55,
    transparent: true,
    opacity,
    emissive: new THREE.Color(HOLO.glass),
    emissiveIntensity: HOLO.emissiveIntensity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

export function makeEdgeMaterial(color = HOLO.edge, opacity = 0.9) {
  return new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: true });
}

// A second, slightly-brighter, additive-blended outline behind the crisp
// edge lines to fake a soft neon glow without a full bloom post-process pass
// (a real EffectComposer/UnrealBloomPass would need its own render target
// inside MapLibre's shared GL context — deferred; see BuildingLayer.js).
export function makeGlowEdgeMaterial(color = HOLO.edge, opacity = 0.55) {
  return new THREE.LineBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthTest: true,
  });
}
