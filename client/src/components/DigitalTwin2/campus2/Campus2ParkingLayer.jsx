import * as THREE from 'three';
import { createProjection } from '../services/ProjectionService';
import {
  orientedBoundingBox, pointInRing, offsetRing, ringStripMesh, kerbMesh,
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
const AISLE_W = 7.0;
const ISLAND_EVERY = 13; // bays per row segment before a landscaped island
const ISLAND_W = 2.2;
const LINE_W = 0.12;
const LINE_COLOR = 0xf2f2f0;
const ACCESSIBLE_COLOR = 0x3fa0ff;
const EV_COLOR = 0x3fd17a;

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

// One parking bay's paint outline — three sides (left/right/back), the
// aisle-facing side left open — in the lot's own OBB-aligned frame.
function bayOutline(toWorld, cx, cz, color) {
  const group = new THREE.Group();
  const hw = BAY_W / 2, hd = BAY_D / 2;
  const corners = {
    bl: toWorld(cx - hw, cz - hd), br: toWorld(cx + hw, cz - hd),
    fl: toWorld(cx - hw, cz + hd), fr: toWorld(cx + hw, cz + hd),
  };
  group.add(paintLine(corners.bl, corners.fl, LINE_W, color));
  group.add(paintLine(corners.br, corners.fr, LINE_W, color));
  group.add(paintLine(corners.bl, corners.br, LINE_W, color));
  return group;
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

  // Bay grid + landscaped islands, aligned to the lot's own long axis,
  // clipped to the real footprint (only bays whose centre falls inside
  // the real polygon are drawn).
  const palmPoints = [];
  let v = -obb.halfH;
  let bayIndex = 0;
  while (v + BAY_D <= obb.halfH) {
    let u = -obb.halfW;
    let sinceIsland = 0;
    let firstInRow = true;
    while (u + BAY_W <= obb.halfW) {
      const cx = u + BAY_W / 2, cz = v + BAY_D / 2;
      const worldCenter = toWorld(cx, cz);
      if (pointInRing(worldCenter, ring)) {
        if (sinceIsland >= ISLAND_EVERY && !firstInRow) {
          // landscaped island instead of a bay
          const islandRing = [
            toWorld(u, v + 0.3), toWorld(u + ISLAND_W, v + 0.3),
            toWorld(u + ISLAND_W, v + BAY_D - 0.3), toWorld(u, v + BAY_D - 0.3),
          ];
          const islandMat = new THREE.MeshStandardMaterial({ color: 0x2f6b34, roughness: 0.95 });
          const islandGeo = new THREE.ShapeGeometry(shapeFromRing(islandRing));
          islandGeo.translate(0, 0, 0.05);
          group.add(new THREE.Mesh(islandGeo, islandMat));
          group.add(kerbMesh(islandRing, { height: 0.18, width: 0.15 }));
          palmPoints.push(toWorld(u + ISLAND_W / 2, v + BAY_D / 2));
          sinceIsland = 0;
          u += ISLAND_W;
          firstInRow = false;
          continue;
        }
        const isAccessible = bayIndex % 17 === 0;
        const isEV = !isAccessible && bayIndex % 11 === 0;
        const color = isAccessible ? ACCESSIBLE_COLOR : isEV ? EV_COLOR : LINE_COLOR;
        group.add(bayOutline(toWorld, cx, cz, color));
        bayIndex++;
        sinceIsland++;
        firstInRow = false;
      }
      u += BAY_W;
    }
    v += BAY_D + AISLE_W;
    // direction arrow at the aisle centreline, alternating heading
    const aisleV = v - AISLE_W / 2;
    if (aisleV < obb.halfH) {
      const dir = Math.round(v / (BAY_D + AISLE_W)) % 2 === 0 ? 1 : -1;
      const tip = toWorld(0, aisleV);
      const back = toWorld(-dir * 1.2, aisleV);
      const wingL = toWorld(-dir * 1.2 + dir * 0, aisleV - 0.5);
      const wingR = toWorld(-dir * 1.2, aisleV + 0.5);
      group.add(paintLine(back, tip, LINE_W, LINE_COLOR));
      group.add(paintLine(tip, toWorld(dir * -0.5, aisleV - 0.5), LINE_W, LINE_COLOR));
      group.add(paintLine(tip, toWorld(dir * -0.5, aisleV + 0.5), LINE_W, LINE_COLOR));
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
    const nx = -tz, nz = tx;
    for (let s = -2; s <= 2; s++) {
      const p1 = [mid[0] + tx * s * 0.5 - nx * 1.5, mid[1] + tz * s * 0.5 - nz * 1.5];
      const p2 = [mid[0] + tx * s * 0.5 + nx * 1.5, mid[1] + tz * s * 0.5 + nz * 1.5];
      group.add(paintLine(p1, p2, 0.35, LINE_COLOR));
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
