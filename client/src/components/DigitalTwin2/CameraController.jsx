import { ringBBox } from './services/ProjectionService';

// Smooth, professional-feeling camera moves on top of MapLibre's own
// damped orbit/zoom/pitch controls (pan = orbit, scroll = zoom, right-drag
// = rotate/pitch — all built in, with MapLibre's own inertia/damping).
const MIN_ZOOM = 15.5;
const MAX_ZOOM = 20;

export function clampZoomLimits(map) {
  map.setMinZoom(MIN_ZOOM);
  map.setMaxZoom(MAX_ZOOM);
}

// Double-click (or programmatic selection) → fly to a building's centroid.
export function flyToBuilding(map, building) {
  if (!building?.centroid) return;
  const [lon, lat] = building.centroid;
  map.flyTo({
    center: [lon, lat],
    zoom: 18.6,
    pitch: 15,
    bearing: map.getBearing(),
    duration: 1400,
    curve: 1.4,
    essential: true,
  });
}

export function flyHome(map, anchor) {
  map.flyTo({ center: anchor, zoom: 18.4, pitch: 15, bearing: 180, duration: 1200, essential: true });
}

// ease-in-out cubic — MapLibre's default flyTo/fitBounds curve doesn't
// accept this directly for the "no abrupt movement" requirement, so it's
// passed explicitly here.
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Captures enough state to return to the exact pre-click view later.
export function captureCameraState(map) {
  return { center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
}
export function restoreCamera(map, saved) {
  if (!saved) return;
  map.easeTo({ ...saved, duration: 900, easing: easeInOutCubic, essential: true });
}

// Smooth ease-in/ease-out flyTo to a building, followed by a gentle
// bearing orbit so the selection feels alive rather than static. Returns
// a cancel() function so the orbit can be stopped cleanly (e.g. on ESC or
// when a different building is clicked) without fighting a later camera
// move.
export function orbitToBuilding(map, building, { onArrive } = {}) {
  if (!building?.centroid) return () => {};
  const [lon, lat] = building.centroid;
  let cancelled = false;
  let rafId = null;

  map.flyTo({
    center: [lon, lat], zoom: 18.6, pitch: 15, bearing: map.getBearing(),
    duration: 1500, easing: easeInOutCubic, essential: true,
  });

  const startOrbit = () => {
    if (cancelled) return;
    onArrive?.();
    const startBearing = map.getBearing();
    const sweep = 30; // degrees
    const durationMs = 2600;
    const t0 = performance.now();
    const step = (now) => {
      if (cancelled) return;
      const t = Math.min(1, (now - t0) / durationMs);
      const eased = easeInOutCubic(t);
      map.setBearing(startBearing + sweep * eased);
      if (t < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  };
  map.once('moveend', startOrbit);

  return () => {
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);
  };
}

// Fly to a person's current position — same shot as flyToBuilding, but the
// caller supplies a live [lon,lat] since people move and buildings don't.
export function flyToPerson(map, lonLat) {
  if (!lonLat) return;
  map.flyTo({
    center: lonLat, zoom: 19, pitch: 15, bearing: map.getBearing(),
    duration: 1400, curve: 1.4, essential: true,
  });
}

// Same smooth flyTo + gentle bearing orbit as orbitToBuilding, but for a
// moving target: `getLonLat()` is re-polled every REFOLLOW_MS so the camera
// keeps gently re-centering on the person as they walk, instead of
// orbiting a point they've since left (orbitToBuilding's fixed-point orbit
// can't do this — a building never moves out from under it). Returns a
// cancel() function, same contract as orbitToBuilding.
const REFOLLOW_MS = 900;
export function orbitToPerson(map, getLonLat, { onArrive } = {}) {
  const start = getLonLat();
  if (!start) return () => {};
  let cancelled = false;
  let rafId = null;
  let followInterval = null;

  map.flyTo({
    center: start, zoom: 19, pitch: 15, bearing: map.getBearing(),
    duration: 1500, easing: easeInOutCubic, essential: true,
  });

  const startOrbit = () => {
    if (cancelled) return;
    onArrive?.();
    const startBearing = map.getBearing();
    const sweep = 30; // degrees
    const durationMs = 2600;
    const t0 = performance.now();
    const step = (now) => {
      if (cancelled) return;
      const t = Math.min(1, (now - t0) / durationMs);
      map.setBearing(startBearing + sweep * easeInOutCubic(t));
      if (t < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);

    followInterval = setInterval(() => {
      if (cancelled) return;
      const lonLat = getLonLat();
      if (lonLat) map.easeTo({ center: lonLat, duration: REFOLLOW_MS, essential: true });
    }, REFOLLOW_MS);
  };
  map.once('moveend', startOrbit);

  return () => {
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (followInterval) clearInterval(followInterval);
  };
}

// Fits the whole loaded dataset (buildings + campus boundary) in view —
// pass whichever real FeatureCollections should define "the whole campus".
export function zoomToFit(map, ...featureCollections) {
  const bbox = ringBBox(...featureCollections);
  if (!bbox) return;
  map.fitBounds(bbox, { padding: 80, pitch: 15, duration: 1200, essential: true });
}
