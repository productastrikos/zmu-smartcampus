import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';
import {
  orientedBoundingBox, pointInRing, offsetRing, distanceToRing, ringStripMesh, kerbMesh,
  makeAsphaltTexture, makeConcreteTexture, instancedPalmTrees, instancedLampPosts,
  paintLine, ringCentroid,
} from './siteFurniture';

// Campus 2's 3 real parking lots (campus2/parking_lot_1|2|3.geojson, from
// zmu_campus_2_02.txt's "parking lot-1/2/3" polygons) — Phase 3A rebuild.
// The lot's OUTER FOOTPRINT is exactly the real digitized polygon, never
// altered; everything inside it (bay grid, aisles, islands, kerb, lamp
// posts, markings) is procedurally generated within that real boundary,
// aligned to the footprint's own dominant edge via its oriented bounding
// box rather than true-north, the way an actual site plan would be laid
// out along its access road. No literal turning-radius/entry-ramp
// geometry — that would need real access-road survey data this source
// doesn't have — represented instead by a gap left in the kerb ring on
// the lot's most "open" (shortest) edge.
//
// A Three.js "custom" MapLibre layer, same shape as every other layer in
// this module: {id, type:'custom', renderingMode:'3d', onAdd, setLots,
// setVisible, render}.

const BAY_W = 2.5;
const BAY_D = 5.0;
const AISLE_W = 6.5;
// A double-loaded aisle: a row of bays, the drive aisle, then a second row
// facing it. The next module's first row backs directly onto this module's
// second row (bumper-to-bumper), which is how a real surface lot is set out
// — the previous single-row-per-aisle pattern wasted a whole aisle width
// between every row and pushed the grid out of alignment with the lot.
const MODULE_D = BAY_D * 2 + AISLE_W;
const ISLAND_EVERY = 12; // bays per row segment before a landscaped island
const ISLAND_W = 2.4;
const LINE_W = 0.12;
const LINE_COLOR = 0xf2f2f0;
const ACCESSIBLE_COLOR = 0x3fa0ff;
const EV_COLOR = 0x3fd17a;
// Every painted marking is clipped to the real footprint shrunk by this
// much, so no bay line can ever run out over the kerb, the grass buffer or
// the sidewalk — the failure visible before this change.
const PAINT_INSET = 1.0;
const ARROW_SPACING = 17;

function remapUVToWorld(geo, repeatUnit) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / repeatUnit;
    uv[i * 2 + 1] = pos.getY(i) / repeatUnit;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function shapeFromRing(ring) {
  return new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y)));
}

// A rectangle in the lot's OBB frame is only painted if ALL FOUR of its
// corners sit inside the real footprint AND at least PAINT_INSET clear of
// its boundary. The previous version tested the bay's CENTRE only, which is
// what let bays straddling the edge paint half their markings out over the
// kerb, the grass buffer and the sidewalk.
function rectFits(toWorld, u0, v0, u1, v1, ring) {
  for (const [u, v] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]]) {
    const p = toWorld(u, v);
    if (!pointInRing(p, ring)) return false;
    if (distanceToRing(p, ring) < PAINT_INSET) return false;
  }
  return true;
}

// One contiguous run of bays: k+1 shared divider lines (each drawn ONCE —
// previously every bay drew its own left AND right line, so neighbours
// stacked two coincident stripes on the same coordinates) plus a single
// continuous line along the run's rear edge. The aisle-facing edge stays
// open, as it does on a real lot.
function bayRun(group, toWorld, u0, count, vBack, vFront, specials) {
  if (count <= 0) return;
  for (let i = 0; i <= count; i++) {
    const u = u0 + i * BAY_W;
    group.add(paintLine(toWorld(u, vBack), toWorld(u, vFront), LINE_W, LINE_COLOR));
  }
  group.add(paintLine(toWorld(u0, vBack), toWorld(u0 + count * BAY_W, vBack), LINE_W, LINE_COLOR));

  // Accessible / EV bays: their own two dividers re-painted in the accent
  // colour just above the white ones, plus a stub across the stall head, so
  // the bay reads as specially marked rather than merely differently outlined.
  for (const { index, color } of specials) {
    const uL = u0 + index * BAY_W, uR = uL + BAY_W;
    const vMid = vBack + (vFront - vBack) * 0.5;
    group.add(paintLine(toWorld(uL, vBack), toWorld(uL, vFront), LINE_W, color, 0.035));
    group.add(paintLine(toWorld(uR, vBack), toWorld(uR, vFront), LINE_W, color, 0.035));
    group.add(paintLine(toWorld(uL + 0.35, vMid), toWorld(uR - 0.35, vMid), LINE_W * 1.6, color, 0.035));
  }
}

// A drive-aisle direction arrow centred at (u, v) in the OBB frame, pointing
// along ±u. Only ever called for a position already verified to sit inside
// the inset footprint.
function aisleArrow(group, toWorld, u, v, dir) {
  const tip = toWorld(u + dir * 1.5, v);
  group.add(paintLine(toWorld(u - dir * 1.5, v), tip, LINE_W, LINE_COLOR));
  group.add(paintLine(tip, toWorld(u + dir * 0.6, v - 0.62), LINE_W, LINE_COLOR));
  group.add(paintLine(tip, toWorld(u + dir * 0.6, v + 0.62), LINE_W, LINE_COLOR));
}

function buildLot(feature, projection) {
  const group = new THREE.Group();
  const ringLonLat = feature.geometry.coordinates[0];
  const ring = ringLonLat.slice(0, -1).map(([lon, lat]) => projection.projectCoordinate(lon, lat));
  const obb = orientedBoundingBox(ring);
  const cos = Math.cos(obb.angle), sin = Math.sin(obb.angle);
  const toWorld = (u, v) => [obb.center[0] + u * cos - v * sin, obb.center[1] + u * sin + v * cos];

  // Asphalt fill — the real footprint, textured (not a flat colour).
  const asphaltTex = makeAsphaltTexture();
  const asphaltMat = new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.95, metalness: 0.02 });
  const fillGeo = new THREE.ShapeGeometry(shapeFromRing(ring));
  remapUVToWorld(fillGeo, 6);
  fillGeo.translate(0, 0, 0.01);
  group.add(new THREE.Mesh(fillGeo, asphaltMat));

  // Concrete kerb around the real boundary.
  group.add(kerbMesh(ring, { height: 0.15, width: 0.22 }));

  // Grass buffer + sidewalk ring outside the kerb.
  const kerbOuter = offsetRing(ring, 0.22);
  const grassOuter = offsetRing(kerbOuter, 1.4);
  const walkOuter = offsetRing(grassOuter, 1.8);
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x2f6b34, roughness: 0.95 });
  group.add(ringStripMesh(kerbOuter, grassOuter, 0.02, grassMat));
  const concreteTex = makeConcreteTexture();
  const walkMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.9 });
  const walkMesh = ringStripMesh(grassOuter, walkOuter, 0.03, walkMat);
  remapUVToWorld(walkMesh.geometry, 2);
  group.add(walkMesh);

  // Lamp posts every ~18m along the sidewalk ring.
  const lampPoints = [];
  let cum = 0;
  const LAMP_SPACING = 18;
  for (let i = 0; i < walkOuter.length; i++) {
    const a = walkOuter[i], b = walkOuter[(i + 1) % walkOuter.length];
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let d = LAMP_SPACING - (cum % LAMP_SPACING);
    while (d < segLen) {
      const t = d / segLen;
      lampPoints.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      d += LAMP_SPACING;
    }
    cum += segLen;
  }
  group.add(instancedLampPosts(lampPoints));

  // Bay grid + landscaped islands, aligned to the lot's own long axis and
  // clipped to the real footprint (see rectFits) so every marking stays
  // fully on the asphalt, PAINT_INSET clear of the kerb.
  const palmPoints = [];
  const islandMat = new THREE.MeshStandardMaterial({ color: 0x2f6b34, roughness: 0.95 });

  // Whole double-loaded modules, centred within the lot's own OBB so the
  // leftover margin is split evenly top and bottom instead of all landing
  // on one edge (the old loop always started hard against -halfH).
  const span = obb.halfH * 2;
  const moduleCount = Math.max(1, Math.floor(span / MODULE_D));
  const vStart = -obb.halfH + (span - moduleCount * MODULE_D) / 2;

  let bayIndex = 0;

  // One row of bays. `facing` is +1 when the aisle is on the row's +v side
  // (so the bay's open end points that way), -1 when it's on the -v side.
  function layRow(vBack, facing) {
    const vFront = vBack + facing * BAY_D;
    const vLo = Math.min(vBack, vFront), vHi = Math.max(vBack, vFront);
    let u = -obb.halfW;
    let runStart = null, runCount = 0, sinceIsland = 0;
    let specials = [];

    const flushRun = () => {
      if (runCount > 0) bayRun(group, toWorld, runStart, runCount, vBack, vFront, specials);
      runStart = null; runCount = 0; specials = [];
    };

    while (u + BAY_W <= obb.halfW) {
      // A landscaped island terminates the run and takes the next slot.
      if (sinceIsland >= ISLAND_EVERY && rectFits(toWorld, u, vLo, u + ISLAND_W, vHi, ring)) {
        flushRun();
        const islandRing = [
          toWorld(u, vLo + 0.3), toWorld(u + ISLAND_W, vLo + 0.3),
          toWorld(u + ISLAND_W, vHi - 0.3), toWorld(u, vHi - 0.3),
        ];
        const islandGeo = new THREE.ShapeGeometry(shapeFromRing(islandRing));
        islandGeo.translate(0, 0, 0.05);
        group.add(new THREE.Mesh(islandGeo, islandMat));
        group.add(kerbMesh(islandRing, { height: 0.18, width: 0.15 }));
        palmPoints.push(toWorld(u + ISLAND_W / 2, (vLo + vHi) / 2));
        sinceIsland = 0;
        u += ISLAND_W;
        continue;
      }

      if (rectFits(toWorld, u, vLo, u + BAY_W, vHi, ring)) {
        if (runStart === null) runStart = u;
        const isAccessible = bayIndex % 17 === 0;
        const isEV = !isAccessible && bayIndex % 11 === 0;
        if (isAccessible || isEV) specials.push({ index: runCount, color: isAccessible ? ACCESSIBLE_COLOR : EV_COLOR });
        runCount++;
        sinceIsland++;
        bayIndex++;
      } else {
        // Hit the edge of the real footprint — close the run here rather
        // than skipping the slot and re-joining a later, disconnected one.
        flushRun();
        sinceIsland = 0;
      }
      u += BAY_W;
    }
    flushRun();
  }

  for (let m = 0; m < moduleCount; m++) {
    const v0 = vStart + m * MODULE_D;
    layRow(v0 + BAY_D, -1);                 // first row: backs onto v0, opens toward the aisle
    layRow(v0 + BAY_D + AISLE_W, +1);       // second row: opens back toward the same aisle

    // Direction arrows down the aisle centreline, alternating per module —
    // only where the arrow's own footprint is genuinely inside the lot.
    const aisleV = v0 + BAY_D + AISLE_W / 2;
    const dir = m % 2 === 0 ? 1 : -1;
    for (let u = -obb.halfW + ARROW_SPACING / 2; u < obb.halfW; u += ARROW_SPACING) {
      if (rectFits(toWorld, u - 1.6, aisleV - 0.8, u + 1.6, aisleV + 0.8, ring)) {
        aisleArrow(group, toWorld, u, aisleV, dir);
      }
    }
  }

  group.add(instancedPalmTrees(palmPoints));

  // A short zebra crossing at the boundary point nearest the lot's own
  // centroid-to-shortest-edge (a stand-in "entrance" side) connecting to
  // the perimeter sidewalk.
  const centroid = ringCentroid(ring);
  let nearestEdge = null, nearestDist = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const d = Math.hypot(mid[0] - centroid[0], mid[1] - centroid[1]);
    if (d < nearestDist) { nearestDist = d; nearestEdge = [a, b, mid]; }
  }
  if (nearestEdge) {
    const [a, b, mid] = nearestEdge;
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    const tx = dx / len, tz = dz / len;
    // Outward normal — the sign that steps AWAY from the lot interior.
    let nx = -tz, nz = tx;
    if (pointInRing([mid[0] + nx, mid[1] + nz], ring)) { nx = -nx; nz = -nz; }
    // Stripes run across the perimeter walkway (kerb 0.22 + grass 1.4 +
    // sidewalk 1.8 out from the real edge), which is what a crossing
    // actually spans. Previously they were centred ON the boundary, so half
    // of every stripe was painted onto the grass buffer inside the kerb.
    const from = 0.35, to = 3.25;
    for (let s = -2; s <= 2; s++) {
      const off = s * 0.75;
      const p1 = [mid[0] + tx * off + nx * from, mid[1] + tz * off + nz * from];
      const p2 = [mid[0] + tx * off + nx * to, mid[1] + tz * off + nz * to];
      group.add(paintLine(p1, p2, 0.35, LINE_COLOR, 0.06));
    }
  }

  return group;
}

export function createCampus2ParkingLayer({ id, anchor }) {
  const projection = createProjection(anchor);
  let scene, camera, renderer, root, mapRef;
  let visible = true;

  return {
    id,
    type: 'custom',
    renderingMode: '3d',

    onAdd(map, gl) {
      mapRef = map;
      camera = new THREE.Camera();
      scene = new THREE.Scene();
      root = new THREE.Group();
      scene.add(root);
      scene.add(new THREE.AmbientLight(0xdfe8f0, 0.85));
      const sun = new THREE.DirectionalLight(0xffffff, 0.6);
      sun.position.set(40, 70, 100);
      scene.add(sun);
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },

    // `fcs` = array of parking_lot_N.geojson FeatureCollections.
    setLots(fcs) {
      root.clear();
      for (const fc of fcs) {
        for (const f of fc?.features || []) {
          if (f.geometry?.type !== 'Polygon') continue;
          root.add(buildLot(f, projection));
        }
      }
    },

    setVisible(v) { visible = v; },

    render(gl, options) {
      if (!visible || !renderer) return;
      projection.applyToCamera(camera, mapRef, options);
      renderer.resetState();
      renderer.render(scene, camera);
    },
  };
}
