import * as THREE from 'three';

// Shared geometry/material factory for the small repeated security
// markers used across SecurityLayer.jsx, CCTVLayer.jsx, PatrolLayer.jsx,
// and SecurityAlerts.jsx — one definition per icon kind instead of each
// consuming layer duplicating its own canvas texture / geometry.

export function pulsingBeaconMaterial(color = 0xff3b3b) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.4 });
}

// Call once per frame with the material and elapsed ms to animate a
// beacon's pulse — shared timing function so every beacon in the scene
// (gates, towers, alerts) pulses with the same rhythm.
export function pulseBeacon(material, nowMs, speed = 0.004) {
  const t = (Math.sin(nowMs * speed) + 1) / 2;
  material.emissiveIntensity = 0.5 + t * 0.9;
}

export function checkpointGeometry() {
  const geo = new THREE.RingGeometry(0.5, 0.7, 24);
  geo.rotateX(-Math.PI / 2);
  return geo;
}
export function checkpointMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0xff4d4d, emissive: 0xff4d4d, emissiveIntensity: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
}

export function fenceSensorGeometry() {
  return new THREE.SphereGeometry(0.06, 8, 8);
}
export function fenceSensorMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0xff5c5c, emissive: 0xff2b2b, emissiveIntensity: 0.7, roughness: 0.4 });
}

export function motionDetectorGeometry() {
  return new THREE.ConeGeometry(0.07, 0.1, 6);
}
export function motionDetectorMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x2a2f36, emissive: 0xff2b2b, emissiveIntensity: 0.5, roughness: 0.5 });
}
// Blink timing for motion detectors — a short duty-cycle flash rather than
// a smooth sine pulse, distinct from the beacon rhythm.
export function blinkIntensity(nowMs, phaseOffset = 0) {
  return (Math.floor((nowMs + phaseOffset) / 900) % 4 === 0) ? 1.2 : 0.15;
}

export function assemblyPointGeometry() {
  const geo = new THREE.RingGeometry(1.1, 1.4, 32);
  geo.rotateX(-Math.PI / 2);
  return geo;
}
export function assemblyPointMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x4de2ff, emissive: 0x4de2ff, emissiveIntensity: 0.55, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
}
