// Pure geofence math, no React/Three imports. The real fence lines act as
// the geofence boundary. There is no live position feed for anything
// approaching the fence (no sensor exists), so this module only computes
// proximity/crossing state for a given point — it is exercised by
// SecurityAlerts.jsx's explicit "Simulate breach" control, which supplies
// a demo point animated toward/across a real fence segment. Nothing here
// runs continuously against fabricated live positions.

const APPROACH_M = 15;
const CROSS_M = 2.5;

function pointToSegmentDist([px, pz], [x1, z1], [x2, z2]) {
  const dx = x2 - x1, dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  let t = lenSq > 1e-9 ? ((px - x1) * dx + (pz - z1) * dz) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cz = z1 + t * dz;
  return { dist: Math.hypot(px - cx, pz - cz), point: [cx, cz] };
}

// segments: array of [[x,z],[x,z]] pairs (already local meter-space).
export function distanceToFence(point, segments) {
  let best = Infinity, bestPoint = null;
  for (const [a, b] of segments) {
    const { dist, point: p } = pointToSegmentDist(point, a, b);
    if (dist < best) { best = dist; bestPoint = p; }
  }
  return { distance: best, nearestPoint: bestPoint };
}

export function classifyProximity(distanceM) {
  if (distanceM <= CROSS_M) return 'crossing';
  if (distanceM <= APPROACH_M) return 'approaching';
  return 'safe';
}

// Builds a demo breach path: picks the midpoint of a real fence segment,
// computes its outward normal from the segment direction, and returns a
// 3-waypoint path approaching from outside (25m out) to crossing (4m
// inside) that path — the underlying line IS real fence geometry, only
// the "intruder" position along a perpendicular to it is simulated.
export function buildDemoBreachPath(fenceLinePts, segmentIndex = 0) {
  const i = Math.max(1, Math.min(fenceLinePts.length - 1, segmentIndex));
  const a = fenceLinePts[i - 1], b = fenceLinePts[i];
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len, nz = dx / len;
  return {
    fencePoint: mid,
    waypoints: [
      [mid[0] + nx * 25, mid[1] + nz * 25],
      [mid[0] + nx * APPROACH_M * 0.6, mid[1] + nz * APPROACH_M * 0.6],
      [mid[0] + nx * 1, mid[1] + nz * 1],
      [mid[0] - nx * 4, mid[1] - nz * 4],
    ],
  };
}

export function lerpPath(waypoints, t) {
  const n = waypoints.length - 1;
  const scaled = Math.max(0, Math.min(1, t)) * n;
  const i = Math.min(n - 1, Math.floor(scaled));
  const localT = scaled - i;
  const a = waypoints[i], b = waypoints[i + 1];
  return [a[0] + (b[0] - a[0]) * localT, a[1] + (b[1] - a[1]) * localT];
}
