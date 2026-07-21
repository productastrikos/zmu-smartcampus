import { HOLO } from './BuildingMaterial';

// Shared plumbing for the analytics overlays (AQI / water / energy) that
// recolour buildings by threshold band — see data/campusMetrics.js.
//
// Every building layer in this module builds its groups the same way
// ({record, glass, edge, glow, baseGlass, baseEdge} in userData) and drives
// hover/selection through its own applyVisualState(), so tinting is just:
// swap the group's BASE colour, remember the original, and let each layer's
// existing visual-state machine keep working untouched. That keeps hover,
// selection, fade and the selected-building pulse behaving identically with
// an overlay on or off.

// A tinted building is deliberately more solid and more emissive than the
// default holographic glass — a 0.25-opacity cyan ghost can't communicate a
// red "over threshold" band.
export const METRIC_TINT = { opacity: 0.66, emissiveIntensity: 0.62 };

/**
 * Apply (or clear, when `color` is null) a metric tint on one building group.
 * @param {THREE.Group} group a building group with the standard userData shape
 * @param {number|null} color 0xRRGGBB threshold-band colour, or null to restore
 */
export function tintGroup(group, color) {
  const ud = group.userData;
  if (ud.origGlass === undefined) {
    ud.origGlass = ud.baseGlass;
    ud.origEdge = ud.baseEdge;
  }
  ud.metricTinted = color != null;
  ud.baseGlass = color != null ? color : ud.origGlass;
  ud.baseEdge = color != null ? color : ud.origEdge;
  ud.glass.color.set(ud.baseGlass);
  ud.glass.emissive.set(ud.baseGlass);
  ud.glass.emissiveIntensity = ud.metricTinted ? METRIC_TINT.emissiveIntensity : HOLO.emissiveIntensity;
  ud.edge.color.set(ud.baseEdge);
  ud.glow.color.set(ud.baseEdge);
}

// The un-hovered, un-selected glass opacity for a group — tint-aware, so a
// layer's own applyVisualState 'default' branch keeps overlay colours solid
// instead of dropping them back to holographic-ghost transparency.
export function defaultGlassOpacity(group, fallback) {
  return group.userData.metricTinted ? METRIC_TINT.opacity : fallback;
}
