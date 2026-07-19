import { createProjection } from '../services/ProjectionService';

// Pure movement math for the Personnel Tracking layer — no React/Three
// imports, same convention as PatrolAnimation.js/GeofenceEngine.js. Builds
// a walkable node/edge graph out of the walkway/road geometry other layers
// already compute, and steps simulated personnel along it: walk an edge at
// a given speed, arrive at a node, occasionally idle, pick a new neighbor
// (never doubling straight back where avoidable), continue. No teleporting
// and no leaving the graph, so personnel can never cross a building
// footprint or a fence line — the graph itself never goes there (walkway
// segments already route around obstacles, see WalkwayGenerator.js; real
// road centerlines don't cross buildings either).

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export { mulberry32 };

function pointInPolygon([px, pz], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    const intersect = zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Dedupes the flat walkway edge list (see WalkwayGenerator.js — it has no
// shared node IDs) plus real road centerlines into one node/adjacency
// graph, snapping endpoints within GRID metres of each other onto the same
// node so walkway connectors and road segments actually join up.
const GRID = 0.5;

export function buildWalkGraph({ anchor, walkways, roads }) {
  const projection = createProjection(anchor);
  const nodeIndex = new Map();
  const nodes = [];
  const adjSets = [];

  function nodeFor([x, z]) {
    const key = `${Math.round(x / GRID)}_${Math.round(z / GRID)}`;
    let idx = nodeIndex.get(key);
    if (idx === undefined) {
      idx = nodes.length;
      nodes.push([x, z]);
      adjSets.push(new Set());
      nodeIndex.set(key, idx);
    }
    return idx;
  }
  function addEdge(p1, p2) {
    const a = nodeFor(p1), b = nodeFor(p2);
    if (a === b) return;
    adjSets[a].add(b);
    adjSets[b].add(a);
  }

  for (const [p1, p2] of walkways || []) addEdge(p1, p2);

  for (const f of roads?.features || []) {
    if (f.geometry?.type !== 'LineString') continue;
    const pts = f.geometry.coordinates.map(([lon, lat]) => projection.projectCoordinate(lon, lat));
    for (let i = 1; i < pts.length; i++) addEdge(pts[i - 1], pts[i]);
  }

  return { nodes, adj: adjSets.map((s) => [...s]) };
}

export function randomNode(graph, rng) {
  return Math.floor(rng() * graph.nodes.length);
}

function pickNextNeighbor(graph, current, prev, rng) {
  const neighbors = graph.adj[current];
  if (!neighbors.length) return current; // isolated node — nowhere to go
  const nonBacktrack = neighbors.length > 1 && prev != null ? neighbors.filter((n) => n !== prev) : neighbors;
  const pool = nonBacktrack.length ? nonBacktrack : neighbors;
  return pool[Math.floor(rng() * pool.length)];
}

// Per-person walk state: which edge they're on (from -> to), how far along
// it (metres), and — while idling at a node — the timestamp they'll resume.
export function createWalkState(graph, startNode, rng) {
  return {
    from: startNode,
    to: pickNextNeighbor(graph, startNode, null, rng),
    prev: null,
    progress: 0,
    idleUntil: 0,
    heading: 0,
  };
}

const IDLE_CHANCE = 0.35;
const IDLE_MIN_MS = 1000;
const IDLE_MAX_MS = 4000;

// Advances one person's walk state by deltaMs and returns their current
// local [x,z] + heading (radians). Mutates `state` in place (owned
// per-person, not shared) — mirrors PatrolAnimation.positionAtTime's pure
// "where are they now" contract, but driven by accumulated delta so
// idle/pause doesn't cause a jump when movement resumes.
export function stepWalkState(state, graph, deltaMs, speedMps, rng, nowMs) {
  if (nowMs < state.idleUntil) {
    return { point: graph.nodes[state.from], heading: state.heading, idle: true };
  }
  if (state.to === state.from) {
    // Dead-end / isolated node — nothing reachable, stay put rather than
    // spin trying to move along a zero-length edge.
    return { point: graph.nodes[state.from], heading: state.heading, idle: true };
  }

  const a = graph.nodes[state.from], b = graph.nodes[state.to];
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const segLen = Math.hypot(dx, dz) || 1e-6;

  state.progress += speedMps * (deltaMs / 1000);
  if (state.progress >= segLen) {
    state.prev = state.from;
    state.from = state.to;
    state.progress = 0;
    if (rng() < IDLE_CHANCE) state.idleUntil = nowMs + IDLE_MIN_MS + rng() * (IDLE_MAX_MS - IDLE_MIN_MS);
    state.to = pickNextNeighbor(graph, state.from, state.prev, rng);
    return stepWalkState(state, graph, 0, speedMps, rng, nowMs);
  }

  const t = state.progress / segLen;
  const point = [a[0] + dx * t, a[1] + dz * t];
  state.heading = Math.atan2(dz, dx);
  return { point, heading: state.heading, idle: false };
}

const WANDER_IDLE_CHANCE = 0.25;
const WANDER_IDLE_MIN_MS = 1500;
const WANDER_IDLE_MAX_MS = 5000;
const WANDER_ARRIVE_M = 0.5;

// Rejection-sample a random point strictly inside a (real, digitized)
// boundary ring — never outside it, unlike a plain bounding-box pick.
function pickWanderTarget(boundaryRing, rng) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of boundaryRing) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  for (let attempt = 0; attempt < 40; attempt++) {
    const p = [minX + rng() * (maxX - minX), minZ + rng() * (maxZ - minZ)];
    if (pointInPolygon(p, boundaryRing)) return p;
  }
  return boundaryRing[0];
}

// A second, simpler movement mode alongside stepWalkState — free-roam
// straight-line wandering to a sequence of random points strictly inside a
// real boundary ring (rejection-sampled every time, see pickWanderTarget),
// rather than being confined to a road-network graph's own edges. Used for
// Campus 2's personnel, where the real road network is just a handful of
// radials/roundabouts and confining movement to it made every walker
// converge on very few paths (and, when the pool leaned toward the
// perimeter road's own many digitized points, made people appear to walk
// along the boundary/fence line instead of moving around the campus).
export function createWanderState(startPos, boundaryRing, rng) {
  return { pos: startPos, target: pickWanderTarget(boundaryRing, rng), idleUntil: 0, heading: 0 };
}

export function stepWanderState(state, deltaMs, speedMps, rng, boundaryRing, nowMs) {
  if (nowMs < state.idleUntil) return { point: state.pos, heading: state.heading, idle: true };
  const dx = state.target[0] - state.pos[0], dz = state.target[1] - state.pos[1];
  const dist = Math.hypot(dx, dz);
  if (dist < WANDER_ARRIVE_M) {
    if (rng() < WANDER_IDLE_CHANCE) state.idleUntil = nowMs + WANDER_IDLE_MIN_MS + rng() * (WANDER_IDLE_MAX_MS - WANDER_IDLE_MIN_MS);
    state.target = pickWanderTarget(boundaryRing, rng);
    return { point: state.pos, heading: state.heading, idle: true };
  }
  const step = Math.min(dist, (speedMps * deltaMs) / 1000);
  state.pos = [state.pos[0] + (dx / dist) * step, state.pos[1] + (dz / dist) * step];
  state.heading = Math.atan2(dz, dx);
  return { point: state.pos, heading: state.heading, idle: false };
}

// Fixed placement for a stationary (red/inactive) person: near a random
// building, offset a few metres from its centroid, kept inside the campus
// boundary. Chosen once at roster generation and never revisited. Returns
// the owning building record alongside the point so the UI can show a
// real "Current Building" instead of a bare coordinate.
export function placeInactivePerson({ anchor, boundary, buildings, rng }) {
  const projection = createProjection(anchor);
  const boundaryRing = boundary?.features?.[0]?.geometry?.coordinates?.[0]
    ?.map(([lon, lat]) => projection.projectCoordinate(lon, lat));
  const candidates = (buildings || []).filter((b) => b.centroid);
  for (let attempt = 0; attempt < 30 && candidates.length; attempt++) {
    const b = candidates[Math.floor(rng() * candidates.length)];
    const base = projection.projectCoordinate(b.centroid[0], b.centroid[1]);
    const angle = rng() * Math.PI * 2;
    const dist = 4 + rng() * 10;
    const point = [base[0] + Math.cos(angle) * dist, base[1] + Math.sin(angle) * dist];
    if (boundaryRing && !pointInPolygon(point, boundaryRing)) continue;
    return { point, building: b };
  }
  if (candidates.length) {
    const b = candidates[0];
    return { point: projection.projectCoordinate(b.centroid[0], b.centroid[1]), building: b };
  }
  return { point: [0, 0], building: null };
}
