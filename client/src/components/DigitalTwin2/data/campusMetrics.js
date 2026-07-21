// Analytics overlays for the ZMU Digital Twin — Air Quality (AQI),
// Water usage and Power/Energy consumption.
//
// HONESTY NOTE, same convention the rest of this module already follows
// (see digitalTwin_2.jsx's demoTooltipFields / Block3Viewer's mock panel):
// no live BMS / AQI-sensor / water-meter feed exists for either campus yet,
// so every number here is DERIVED DETERMINISTICALLY from the building's own
// real record (its id, real footprint area, real height/levels and
// category) rather than randomized per render. The same building always
// reads the same value, values scale sensibly with real floor area, and the
// whole thing swaps for a real feed by replacing readBuildingMetrics()
// alone — nothing else in the overlay pipeline knows where the numbers came
// from.
//
// Each overlay maps a building to one of a small number of THRESHOLD BANDS,
// and the band's colour is what tints the building in the 3-D scene (see
// setMetricTint in BuildingLayer.jsx / Campus2BuildingLayer.jsx /
// Campus2ExtraBuildingsLayer.jsx).

// --- deterministic per-building pseudo-random ---------------------------

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// One stable 0..1 draw per (id, salt) pair — different salts give
// independent-looking values for the three overlays without needing three
// separate seeds threaded around.
function unitFor(id, salt) {
  const h = hashString(`${id}::${salt}`);
  return ((h >>> 8) % 100000) / 100000;
}

// A bell-shaped 0..1 draw (mean 0.5, sd ~0.167) — the average of three
// independent uniform draws, i.e. an Irwin–Hall variate.
//
// This matters for realism. A flat uniform draw put ~16% of the campus over
// the critical threshold at once, which read as "half the estate is on
// fire" and is not what a real portfolio looks like: the overwhelming
// majority of buildings sit in a normal band, a modest minority run high,
// and only a couple are genuinely over. The bell reproduces that shape —
// roughly 2% critical, 16% high, the rest normal or low.
function bellFor(id, salt) {
  return (unitFor(id, `${salt}1`) + unitFor(id, `${salt}2`) + unitFor(id, `${salt}3`)) / 3;
}

// --- threshold bands ----------------------------------------------------

// Utility overlays (power/water) are expressed as "% of the building's
// designed/permitted capacity", which is what an FM team actually acts on.
const UTILISATION_BANDS = [
  { key: 'low', label: 'Low', from: 0, to: 50, color: 0x2fd47a, css: '#2fd47a' },
  { key: 'normal', label: 'Normal', from: 50, to: 75, color: 0xf2d64b, css: '#f2d64b' },
  { key: 'high', label: 'High', from: 75, to: 90, color: 0xff9330, css: '#ff9330' },
  { key: 'critical', label: 'Over threshold', from: 90, to: 200, color: 0xff3b46, css: '#ff3b46' },
];

// Standard AQI breakpoints/colours (US EPA categories), so the legend
// matches what anyone reading an AQI number already expects.
const AQI_BANDS = [
  { key: 'good', label: 'Good', from: 0, to: 50, color: 0x00c853, css: '#00c853' },
  { key: 'moderate', label: 'Moderate', from: 50, to: 100, color: 0xf2d64b, css: '#f2d64b' },
  { key: 'sensitive', label: 'Unhealthy (sensitive)', from: 100, to: 150, color: 0xff9330, css: '#ff9330' },
  { key: 'unhealthy', label: 'Unhealthy', from: 150, to: 200, color: 0xff3b46, css: '#ff3b46' },
  { key: 'severe', label: 'Very unhealthy', from: 200, to: 500, color: 0x9b3fd1, css: '#9b3fd1' },
];

export const OVERLAYS = {
  aqi: {
    key: 'aqi',
    label: 'Air quality (AQI)',
    short: 'AQI',
    unit: '',
    bands: AQI_BANDS,
    // The only overlay that also paints an affected-area plume on the
    // ground (see AQIPlumeLayer.js) — air quality is a field over the
    // whole site, not a per-building meter reading.
    hasPlume: true,
  },
  water: {
    key: 'water',
    label: 'Water usage',
    short: 'Water',
    unit: '% of permitted draw',
    bands: UTILISATION_BANDS,
    hasPlume: false,
  },
  power: {
    key: 'power',
    label: 'Power / energy consumption',
    short: 'Energy',
    unit: '% of connected load',
    bands: UTILISATION_BANDS,
    hasPlume: false,
  },
};

export const OVERLAY_KEYS = Object.keys(OVERLAYS);

export function bandFor(overlayKey, value) {
  const bands = OVERLAYS[overlayKey].bands;
  for (const b of bands) if (value < b.to) return b;
  return bands[bands.length - 1];
}

// --- per-building readings ---------------------------------------------

// Category weighting — a lab/sports block genuinely draws more power and
// water per m² than a store or a gate house, so the derived numbers track
// the building's real classification instead of being uniform noise.
const CATEGORY_LOAD = {
  administration: { power: 1.0, water: 0.8 },
  academic: { power: 1.15, water: 0.9 },
  residential: { power: 0.85, water: 1.5 },
  sports: { power: 0.7, water: 1.6 },
  mosque: { power: 0.6, water: 1.3 },
  gate: { power: 0.4, water: 0.3 },
  structure: { power: 0.9, water: 0.9 },
};

/**
 * All three overlay readings for one building record. Pure function of the
 * record — safe to call from render paths, memoized by the caller.
 *
 * @param {{id:string, gross_area?:number, category?:string, height?:number}} record
 */
export function readBuildingMetrics(record) {
  const id = String(record?.id ?? 'unknown');
  const area = Math.max(60, record?.gross_area || 600);
  const cat = CATEGORY_LOAD[record?.category] || CATEGORY_LOAD.structure;

  // Power — connected load derived from real floor area (W/m² is the way
  // an electrical design brief actually sizes a building), then a stable
  // draw for how hard it is currently being used.
  // 65 W/m² connected load and ~11 equivalent full-load hours/day put a
  // typical block near 190–260 kWh/m²/year, which is the right order for an
  // air-conditioning-dominated Gulf campus.
  const wattsPerM2 = 65 * cat.power;
  const connectedLoadKw = (area * wattsPerM2) / 1000;
  const powerPct = 25 + bellFor(id, 'power') * 78; // ~25..103, bell-centred near 64
  const demandKw = connectedLoadKw * (powerPct / 100);
  const dailyKwh = demandKw * 11; // ~11 equivalent full-load hours/day

  // Water — litres/m²/day against a permitted daily draw.
  const litresPerM2 = 6.5 * cat.water;
  const permittedM3 = (area * litresPerM2) / 1000;
  const waterPct = 25 + bellFor(id, 'water') * 76; // ~25..101, bell-centred near 63
  const dailyM3 = permittedM3 * (waterPct / 100);

  // AQI — a local reading at the building, shaped to a realistic Abu Dhabi
  // profile: predominantly Moderate, a meaningful slice in the
  // unhealthy-for-sensitive-groups band, and only a couple of genuinely
  // unhealthy hotspots on a dusty day. (A flat uniform draw made two thirds
  // of the site "Unhealthy"; a steep power curve collapsed nearly
  // everything onto the floor and left the plume with no gradient at all.)
  // PM2.5 is then derived FROM the AQI rather than drawn independently, so
  // the pollutant breakdown can never contradict the headline number.
  const aqi = Math.round(38 + Math.pow(bellFor(id, 'aqi'), 1.6) * 150); // ~38..188
  const pm25 = Math.round(aqi <= 50 ? aqi * 0.24 : 12 + (aqi - 50) * 0.42);
  // PM10-dominated, as a hot dusty Gulf site is.
  const pm10 = Math.round(pm25 * (2.1 + unitFor(id, 'pm10') * 1.1));

  return {
    power: {
      value: Math.round(powerPct),
      demandKw: Math.round(demandKw * 10) / 10,
      connectedLoadKw: Math.round(connectedLoadKw * 10) / 10,
      dailyKwh: Math.round(dailyKwh),
      intensity: Math.round((dailyKwh / area) * 100) / 100, // kWh/m²/day
    },
    water: {
      value: Math.round(waterPct),
      dailyM3: Math.round(dailyM3 * 10) / 10,
      permittedM3: Math.round(permittedM3 * 10) / 10,
      intensity: Math.round((dailyM3 * 1000) / area), // L/m²/day
    },
    aqi: {
      value: aqi,
      pm25,
      pm10,
      co2: Math.round(420 + unitFor(id, 'co2') * 780), // ppm, indoor
    },
  };
}

// The reading a given overlay keys off — the single number that decides the
// building's threshold band and therefore its colour.
export function overlayValue(overlayKey, metrics) {
  return metrics[overlayKey].value;
}

export function overlayColor(overlayKey, record) {
  const metrics = readBuildingMetrics(record);
  return bandFor(overlayKey, overlayValue(overlayKey, metrics)).color;
}

// Short "142 AQI" / "78% of connected load" string for tooltips/panels.
export function overlayReadout(overlayKey, metrics) {
  const v = overlayValue(overlayKey, metrics);
  if (overlayKey === 'aqi') return `AQI ${v}`;
  return `${v}%`;
}

// --- AQI affected-area stations ----------------------------------------

// Air quality is a field, not a per-building meter, so the plume is built
// from monitoring STATIONS scattered across the real site rather than from
// the buildings themselves. Stations sit at real geometry (building
// centroids, sampled so they spread out instead of clustering on the
// densest block) and carry the same deterministic AQI derivation, so the
// plume and the building tint always agree.
//
// Returns a GeoJSON FeatureCollection of Points with {aqi, weight, name}
// — consumed directly by AQIPlumeLayer.js's MapLibre heatmap layer.
export function makeAQIStations(buildingLists, { stride = 3 } = {}) {
  const features = [];
  let n = 0;
  for (const list of buildingLists) {
    for (const b of list || []) {
      if (!b?.centroid) continue;
      if (n++ % stride !== 0) continue;
      const aqi = readBuildingMetrics(b).aqi.value;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [b.centroid[0], b.centroid[1]] },
        properties: {
          aqi,
          name: b.display_name || 'Station',
          // Heatmap weight — normalized so only genuinely elevated readings
          // burn through to the red end of the ramp, matching how an AQI
          // map is read (a "good" station shouldn't glow at all).
          weight: Math.max(0, Math.min(1, (aqi - 35) / 120)),
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}
