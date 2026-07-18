import { createProjection } from '../services/ProjectionService';

// Generates a pedestrian walkway + landscape layout for the campus. This
// is the ONE deliberately synthetic/procedural geometry source in the
// Digital Twin module — every other layer (buildings, roads, fences,
// parking, football ground) comes from real hand-digitized coordinates.
// Walkways/landscape were explicitly requested as generated content since
// no such survey data exists or was asked for.
//
// Pure function, no React/Three imports (besides the shared projection
// math already used by every other layer) — deterministic (seeded RNG)
// so repeated calls with the same input produce the same layout. All
// output geometry is in the SAME local meter-space (x=east, z=north,
// relative to `anchor`) that every Three.js custom layer already uses,
// so callers can render it directly without re-projecting.
//
// Algorithm (pragmatic + bounded, not a full navmesh/A* solver):
//  1. Anchors = centroid of every building/parking polygon/sportsfield/
//     ground.
//  2. Each anchor gets one "primary" connector to the nearest point on
//     the nearest real road centerline.
//  3. A light nearest-neighbor pass adds a few "secondary" connectors
//     between nearby anchors so the network reads as paths, not just
//     spokes off the road.
//  4. Any connector that crosses a building/parking/football/water
//     polygon gets ONE perpendicular detour point routed around that
//     obstacle (not full path search).
//  5. Wherever a walkway crosses a road, a crossing marker (point +
//     road bearing) is recorded.
//  6. Landscape scatter points are rejection-sampled inside the campus
//     boundary, excluding obstacles and a buffer around every walkway.

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ringToLocal(ring, projection) {
  return ring.slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
}
function centroidOf(pts) {
  const x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const z = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [x, z];
}
function pointInPolygon([px, pz], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    const intersect = zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
function pointToSegmentDist([px, pz], [x1, z1], [x2, z2]) {
  const dx = x2 - x1, dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  let t = lenSq > 1e-9 ? ((px - x1) * dx + (pz - z1) * dz) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cz = z1 + t * dz;
  return { dist: Math.hypot(px - cx, pz - cz), point: [cx, cz] };
}
function segmentsIntersect([x1, z1], [x2, z2], [x3, z3], [x4, z4]) {
  const d1x = x2 - x1, d1z = z2 - z1;
  const d2x = x4 - x3, d2z = z4 - z3;
  const denom = d1x * d2z - d1z * d2x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((x3 - x1) * d2z - (z3 - z1) * d2x) / denom;
  const u = ((x3 - x1) * d1z - (z3 - z1) * d1x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { point: [x1 + t * d1x, z1 + t * d1z], bearing: Math.atan2(d2z, d2x) };
}
function segmentIntersectsPolygon(p1, p2, ring) {
  if (pointInPolygon(p1, ring) || pointInPolygon(p2, ring)) return true;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (segmentsIntersect(p1, p2, a, b)) return true;
  }
  return false;
}
function distToSegmentSetMin(p, segments) {
  let best = Infinity, bestPoint = null;
  for (const [a, b] of segments) {
    const { dist, point } = pointToSegmentDist(p, a, b);
    if (dist < best) { best = dist; bestPoint = point; }
  }
  return { dist: best, point: bestPoint };
}

export function generateCampusLayout({ anchor, boundary, roads, buildings, parking, sportsfields, grounds, water, seed = 42 }) {
  const projection = createProjection(anchor);
  const rand = mulberry32(seed);

  const boundaryRing = boundary?.features?.[0] ? ringToLocal(boundary.features[0].geometry.coordinates[0], projection) : null;

  const obstaclePolys = [];
  const pushPolys = (fc) => {
    for (const f of fc?.features || []) {
      if (f.geometry?.type !== 'Polygon') continue;
      obstaclePolys.push(ringToLocal(f.geometry.coordinates[0], projection));
    }
  };
  pushPolys(parking);
  pushPolys(sportsfields);
  pushPolys(water);
  for (const b of buildings || []) if (b.geometry) obstaclePolys.push(ringToLocal(b.geometry.coordinates[0], projection));

  // real road centerlines, as local-space segment lists
  const roadSegments = [];
  for (const f of roads?.features || []) {
    if (f.geometry?.type !== 'LineString') continue;
    const pts = f.geometry.coordinates.map(([lon, lat]) => projection.projectCoordinate(lon, lat));
    for (let i = 1; i < pts.length; i++) roadSegments.push([pts[i - 1], pts[i]]);
  }

  // 1. anchors
  const anchors = [];
  for (const b of buildings || []) {
    if (!b.centroid) continue;
    anchors.push({ kind: 'building', point: projection.projectCoordinate(b.centroid[0], b.centroid[1]) });
  }
  const addCentroidAnchors = (fc, kind) => {
    for (const f of fc?.features || []) {
      if (f.geometry?.type !== 'Polygon') continue;
      anchors.push({ kind, point: centroidOf(ringToLocal(f.geometry.coordinates[0], projection)) });
    }
  };
  addCentroidAnchors(parking, 'parking');
  addCentroidAnchors(sportsfields, 'sportsfield');
  addCentroidAnchors(grounds, 'ground');

  function nearestRoadPoint(p) {
    if (!roadSegments.length) return null;
    return distToSegmentSetMin(p, roadSegments);
  }
  function obstacleContaining(p1, p2) {
    for (const ring of obstaclePolys) if (segmentIntersectsPolygon(p1, p2, ring)) return ring;
    return null;
  }
  function reroute(p1, p2, obstacleRing) {
    const obCentroid = centroidOf(obstacleRing);
    const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    const dx = p2[0] - p1[0], dz = p2[1] - p1[1];
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len, nz = dx / len;
    const toOb = [obCentroid[0] - mid[0], obCentroid[1] - mid[1]];
    const side = nx * toOb[0] + nz * toOb[1] > 0 ? -1 : 1;
    const offset = 12;
    return [p1, [mid[0] + nx * side * offset, mid[1] + nz * side * offset], p2];
  }
  function addWalkway(walkways, p1, p2) {
    const ob = obstacleContaining(p1, p2);
    if (ob) {
      const [a, mid, b] = reroute(p1, p2, ob);
      walkways.push([a, mid]);
      walkways.push([mid, b]);
    } else {
      walkways.push([p1, p2]);
    }
  }

  // 2. primary connectors: anchor -> nearest road point
  const walkways = [];
  for (const a of anchors) {
    const near = nearestRoadPoint(a.point);
    if (near && near.dist < 200) addWalkway(walkways, a.point, near.point);
  }

  // 3. secondary connectors: light nearest-neighbor pass between anchors
  const MAX_LINK_DIST = 45;
  for (let i = 0; i < anchors.length; i++) {
    let bestJ = -1, bestD = Infinity;
    for (let j = 0; j < anchors.length; j++) {
      if (i === j) continue;
      const d = Math.hypot(anchors[i].point[0] - anchors[j].point[0], anchors[i].point[1] - anchors[j].point[1]);
      if (d < bestD) { bestD = d; bestJ = j; }
    }
    if (bestJ >= 0 && bestD < MAX_LINK_DIST && bestJ > i) {
      addWalkway(walkways, anchors[i].point, anchors[bestJ].point);
    }
  }

  // 5. crossings: any walkway segment that crosses a road segment
  const crossings = [];
  for (const [p1, p2] of walkways) {
    for (const [r1, r2] of roadSegments) {
      const hit = segmentsIntersect(p1, p2, r1, r2);
      if (hit) crossings.push({ point: hit.point, bearing: hit.bearing });
    }
  }

  // 6. landscape scatter — rejection sample inside the boundary, outside
  // obstacles/roads/walkways
  const landscapeZones = [];
  if (boundaryRing) {
    const xs = boundaryRing.map((p) => p[0]), zs = boundaryRing.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const KINDS = [
      ['shrub', 0.32], ['palm', 0.1], ['small_palm', 0.1], ['decorative_tree', 0.08],
      ['flower_bed', 0.18], ['ground_light', 0.12], ['stone', 0.1],
    ];
    const pickKind = () => {
      let r = rand(), acc = 0;
      for (const [kind, w] of KINDS) { acc += w; if (r <= acc) return kind; }
      return KINDS[0][0];
    };
    const ATTEMPTS = 900, TARGET = 260;
    let placed = 0;
    for (let i = 0; i < ATTEMPTS && placed < TARGET; i++) {
      const p = [minX + rand() * (maxX - minX), minZ + rand() * (maxZ - minZ)];
      if (!pointInPolygon(p, boundaryRing)) continue;
      if (obstaclePolys.some((ring) => pointInPolygon(p, ring))) continue;
      const nearWalkway = walkways.some(([a, b]) => pointToSegmentDist(p, a, b).dist < 2.5);
      if (nearWalkway) continue;
      const nearRoad = roadSegments.some(([a, b]) => pointToSegmentDist(p, a, b).dist < 4);
      if (nearRoad) continue;
      landscapeZones.push({ point: p, kind: pickKind() });
      placed++;
    }
  }

  return { walkways, crossings, landscapeZones };
}
