import { mulberry32, randomNode, createWalkState, placeInactivePerson } from './MovementEngine';

// Simulated Garmin-wearable roster for the Personnel Tracking layer. No
// real wearable/BMS feed exists (see PersonnelLayer.jsx header), so every
// field here is deterministic demo data — same "clearly-labeled,
// deterministic per entity, not randomized per render" convention as
// digitalTwin_2.jsx's demoTooltipFields() and Block3Viewer.jsx's
// MOCK_FIELDS. Pure, no React/Three imports.

// Status drives marker color (PERSONNEL_COLORS); values match the spec's
// legend. Configurable — callers may mutate these objects. Phase 1 only
// ever assigns 'active'/'inactive' (see roleToStatus below) — the
// emergency/visitor/faculty/security colors are defined here for the
// later phase that reintroduces those distinct marker types, but nothing
// generates them yet, so only green/red appear on the map today.
export const PERSONNEL_COLORS = {
  active: '#3ddc71',    // green — active, moving
  inactive: '#e5484d',  // red — inactive, stationary (last known location)
  emergency: '#3b82f6', // blue — emergency response team (not yet assigned)
  visitor: '#eab308',   // yellow — visitor (not yet assigned)
  faculty: '#a855f7',   // purple — faculty (not yet assigned)
  security: '#f5f5f5',  // white — security patrol (not yet assigned)
};

export const PERSONNEL_SIZES_PX = { active: 10, inactive: 8, selected: 15, hovered: 13 };

// Weighted so cadets dominate campus population, like a real university.
const ROLE_WEIGHTS = { cadet: 0.42, faculty: 0.12, visitor: 0.1, security: 0.1, maintenance: 0.08, medical: 0.07, administration: 0.11 };

const ROLE_DEPARTMENTS = {
  cadet: ['Mechanical Engineering', 'Electrical Engineering', 'Computer Science', 'Civil Engineering', 'Business Administration'],
  faculty: ['Mechanical Engineering', 'Electrical Engineering', 'Computer Science', 'Civil Engineering', 'Humanities'],
  visitor: ['Guest Relations', 'Prospective Student', 'Contractor'],
  security: ['Campus Security'],
  maintenance: ['Facilities Management'],
  medical: ['Campus Medical Center'],
  administration: ['Registrar', 'Admissions', 'Finance & Accounts', 'Human Resources'],
};

// Requested for now: only two marker colors on the map — green (active,
// moving) or red (inactive, static at its last known location) — so every
// role, regardless of department, is split active/inactive by
// ROLE_ACTIVE_RATE rather than mapped to its own legend color. Role still
// drives name/department/rank text and a couple of per-role flavor details
// (patrol speed variance, medical resting heart rate) below.
const ROLE_ACTIVE_RATE = 0.6;

const FIRST_NAMES = [
  'Ahmed', 'Sara', 'Omar', 'Fatima', 'Khalid', 'Mariam', 'Youssef', 'Layla', 'Hassan', 'Noura',
  'Rashid', 'Aisha', 'Faisal', 'Huda', 'Saeed', 'Amina', 'Zayed', 'Salma', 'Tariq', 'Reem',
  'Sultan', 'Maha', 'Abdullah', 'Hessa', 'Majid', 'Alia', 'Ibrahim', 'Wadha', 'Nasser', 'Latifa',
];
const LAST_NAMES = [
  'Al Mansoori', 'Al Nuaimi', 'Al Suwaidi', 'Al Shamsi', 'Al Ketbi', 'Al Marzouqi',
  'Al Falasi', 'Al Zaabi', 'Al Hammadi', 'Al Dhaheri', 'Al Qubaisi', 'Al Blooshi',
];
const RANKS_BY_ROLE = {
  cadet: ['Cadet', 'Officer Cadet'], security: ['Officer', 'Sergeant'], medical: ['Paramedic', 'Nurse'],
};

function weightedPick(rng, weights) {
  const entries = Object.entries(weights);
  let r = rng() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [key, w] of entries) { r -= w; if (r <= 0) return key; }
  return entries[0][0];
}
function pick(list, rng) { return list[Math.floor(rng() * list.length)]; }

function roleToStatus(rng) {
  return rng() < ROLE_ACTIVE_RATE ? 'active' : 'inactive';
}

function makeName(role, rng) {
  const first = pick(FIRST_NAMES, rng);
  const last = pick(LAST_NAMES, rng);
  const rank = RANKS_BY_ROLE[role] ? pick(RANKS_BY_ROLE[role], rng) + ' ' : '';
  return `${rank}${first} ${last}`;
}

function baseHealth(role, rng) {
  const heartRateBase = role === 'medical' ? 82 + rng() * 10 : 68 + rng() * 18;
  return {
    heartRateBase, heartRate: Math.round(heartRateBase),
    spo2Base: 96 + rng() * 3, spo2: 97,
    respiration: 14 + Math.round(rng() * 6),
    stressBase: 15 + rng() * 30, stress: 25,
    bodyBattery: Math.round(55 + rng() * 40),
    calories: Math.round(300 + rng() * 900),
    skinTemp: +(35.8 + rng() * 1.4).toFixed(1),
    sleepScore: Math.round(60 + rng() * 35),
    hydration: pick(['Good', 'Good', 'Good', 'Fair', 'Low'], rng),
    stepsToday: Math.round(1200 + rng() * 9000),
    distanceKm: +(0.8 + rng() * 7).toFixed(1),
  };
}

function baseDevice(rng) {
  const serial = `GT7-${Math.floor(100000 + rng() * 899999)}`;
  return {
    model: 'Garmin tactix 7',
    serial,
    firmware: `v${Math.floor(6 + rng() * 3)}.${Math.floor(rng() * 30)}`,
    connection: pick(['LTE + Bluetooth', 'Wi-Fi + Bluetooth', 'Bluetooth only'], rng),
    gpsAccuracy: `±${(1.5 + rng() * 3).toFixed(1)} m`,
    satelliteLock: pick(['GPS + GLONASS + Galileo', 'GPS + GLONASS', 'GPS only'], rng),
    bluetooth: 'Connected',
    battery: Math.round(55 + rng() * 45),
    signal: pick(['Excellent', 'Excellent', 'Good', 'Fair'], rng),
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Generates the simulated roster once (deterministic for a given seed),
// wiring each mobile person into a starting point on the walk graph and
// each stationary person into a fixed placement near a building.
export function generateRoster({ count = 150, anchor, boundary, buildings, walkGraph, seed = 7 }) {
  const rng = mulberry32(seed);
  const people = [];

  for (let i = 0; i < count; i++) {
    const role = weightedPick(rng, ROLE_WEIGHTS);
    const status = roleToStatus(rng);
    const department = pick(ROLE_DEPARTMENTS[role], rng);
    const id = `ZMU-${1000 + i}`;
    const name = makeName(role, rng);
    const personSeed = rng() * 1000;

    let walk = null, home = null, building = null;
    if (status === 'inactive' || !walkGraph?.nodes?.length) {
      const placed = placeInactivePerson({ anchor, boundary, buildings, rng });
      home = placed.point;
      building = placed.building?.display_name || null;
    } else {
      const startNode = randomNode(walkGraph, rng);
      walk = createWalkState(walkGraph, startNode, rng);
      home = walkGraph.nodes[startNode];
    }

    people.push({
      id, name, role, department, status, building,
      color: PERSONNEL_COLORS[status],
      speedMps: role === 'security' ? 0.9 + rng() * 0.9 : 1 + rng() * 0.6,
      home, walk,
      _pos: home, _heading: 0,
      health: baseHealth(role, rng),
      device: baseDevice(rng),
      seed: personSeed,
      lastUpdatedAt: Date.now(),
    });
  }

  return people;
}

// Gentle per-second live wobble on health/device fields so the panel/
// tooltip feel "live" without recomputing a full random roster. Mutates
// `person` in place. `nowMs` should be a monotonic clock (performance.now()).
export function tickTelemetry(person, nowMs) {
  const t = nowMs / 1000;
  const s = person.seed;
  const h = person.health;

  h.heartRate = Math.round(h.heartRateBase + Math.sin(t * 0.3 + s) * 4);
  h.spo2 = clamp(Math.round(h.spo2Base + Math.sin(t * 0.07 + s)), 90, 100);
  h.stress = clamp(Math.round(h.stressBase + Math.sin(t * 0.13 + s) * 6), 0, 100);
  h.bodyBattery = clamp(+(h.bodyBattery - 0.01).toFixed(1), 5, 100);
  h.calories = h.calories + (person.status === 'inactive' ? 0.2 : 0.6);
  if (person.status !== 'inactive') {
    h.stepsToday += Math.round(1 + Math.abs(Math.sin(t * 0.5 + s)) * 2);
    h.distanceKm = +(h.distanceKm + 0.0008).toFixed(2);
  }

  person.device.battery = clamp(+(person.device.battery - 0.001).toFixed(2), 4, 100);
  person.lastUpdatedAt = nowMs;
}
