/**
 * Extended API — lean.
 *  · Auth: two roles only — executive (high-level view) and superadmin (all).
 *  · IoT: live sensor & device-health inventory per building, with in-memory
 *    add / delete (the differentiator vs a read-only NEST-style view).
 * (The SIS / LMS / stream / merit portals were replaced by redirect links to
 * the real source systems, so their endpoints were removed.)
 */
const path = require('path');

function registerExt(app, express, db) {
  /* ── auth ── */
  const USERS = {
    executive: { username: 'executive', role: 'executive', name: 'Executive Command' },
    superadmin: { username: 'superadmin', role: 'superadmin', name: 'Platform Administrator' },
  };
  app.post('/api/auth/login', express.json(), (req, res) => {
    const { username, password, role } = req.body || {};
    const u = USERS[(username || '').trim().toLowerCase()];
    if (!u) return res.status(401).json({ error: 'Use the Executive or Super Admin demo account' });
    if (!password || !String(password).trim()) return res.status(401).json({ error: 'Password is required' });
    if (role && role !== u.role) return res.status(401).json({ error: 'Selected role does not match this account' });
    res.json({ ...u, email: `${u.username}@zmu.ac.ae` });
  });

  /* ── IoT sensors & device health ──────────────────────────
     Seeded once from the campus buildings; mutated in memory by the
     add/delete levers (resets on restart, like the other demo state). */
  const buildings = (db.buildings || []).map((b) => ({ id: b.building_id, name: b.name }));
  const FLOORS = ['G', 'L1', 'L2', 'L3', 'Roof'];
  const TYPES = {
    environmental: { subtypes: ['Temperature', 'Humidity', 'CO₂', 'Air Quality (PM2.5)'], units: ['°C', '%RH', 'ppm', 'µg/m³'], wireless: true },
    occupancy:     { subtypes: ['PIR Motion', 'People Counter', 'Desk Occupancy'], units: ['', 'persons', ''], wireless: true },
    lighting:      { subtypes: ['Smart Luminaire', 'Daylight Sensor', 'DALI Gateway'], units: ['%', 'lux', ''], wireless: false },
    energy:        { subtypes: ['Power Meter', 'Sub-meter', 'Solar Inverter'], units: ['kW', 'kWh', 'kW'], wireless: false },
    hvac:          { subtypes: ['AHU Controller', 'FCU Thermostat', 'VAV Damper'], units: ['°C', '°C', '%'], wireless: false },
    security:      { subtypes: ['Door Contact', 'Motion Detector', 'Glass-break'], units: ['', '', ''], wireless: true },
    water:         { subtypes: ['Leak Detector', 'Flow Meter'], units: ['', 'L/min'], wireless: true },
  };
  const TYPE_LIST = Object.keys(TYPES);

  let _seed = 0xC0FFEE;
  const rnd = () => { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; };
  const ri = (a, b) => Math.floor(rnd() * (b - a + 1)) + a;
  const rf = (a, b, d = 1) => +(rnd() * (b - a) + a).toFixed(d);
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  let sensors = [];
  let seq = 1;
  const readingFor = (type, subIdx) => {
    const cfg = TYPES[type];
    const unit = cfg.units[subIdx] || '';
    let val;
    switch (type) {
      case 'environmental': val = subIdx === 0 ? rf(20, 26) : subIdx === 1 ? ri(38, 60) : subIdx === 2 ? ri(430, 1100) : rf(4, 32); break;
      case 'occupancy': val = subIdx === 1 ? ri(0, 40) : (rnd() < 0.5 ? 'Clear' : 'Detected'); break;
      case 'lighting': val = subIdx === 0 ? ri(0, 100) : subIdx === 1 ? ri(80, 900) : 'Bus OK'; break;
      case 'energy': val = subIdx === 2 ? rf(0, 12) : rf(2, 48); break;
      case 'hvac': val = subIdx === 2 ? ri(20, 100) : rf(21, 24); break;
      case 'security': val = subIdx === 0 ? (rnd() < 0.92 ? 'Closed' : 'Open') : (rnd() < 0.9 ? 'Secure' : 'Alarm'); break;
      case 'water': val = subIdx === 0 ? (rnd() < 0.96 ? 'Dry' : 'Wet') : rf(0, 40); break;
      default: val = rf(0, 100);
    }
    return { reading: val, unit };
  };
  const makeSensor = (b, type, subIdx, statusHint) => {
    const cfg = TYPES[type];
    const sub = cfg.subtypes[subIdx];
    const wireless = cfg.wireless;
    let status = statusHint || (rnd() < 0.08 ? (rnd() < 0.5 ? 'fault' : 'degraded') : (rnd() < 0.04 ? 'offline' : 'online'));
    const health = status === 'online' ? ri(88, 100) : status === 'degraded' ? ri(60, 82) : status === 'fault' ? ri(28, 55) : ri(0, 20);
    const { reading, unit } = readingFor(type, subIdx);
    return {
      id: `SEN-${String(seq++).padStart(4, '0')}`,
      building_id: b.id, building: b.name, floor: pick(FLOORS),
      type, subtype: sub, name: `${sub} · ${b.id}-${ri(1, 40)}`,
      status, health_pct: health,
      battery_pct: wireless ? (status === 'offline' ? ri(0, 8) : ri(status === 'online' ? 45 : 10, 100)) : null,
      wireless, reading, unit,
      firmware: `v${ri(1, 4)}.${ri(0, 9)}.${ri(0, 9)}`,
      last_seen_min: status === 'offline' ? ri(60, 2880) : ri(0, 5),
      protocol: pick(['LoRaWAN', 'BACnet/IP', 'Zigbee', 'Modbus', 'KNX', 'MQTT']),
    };
  };
  // seed: several sensors per building, biased by building type
  buildings.forEach((b) => {
    const n = ri(5, 8);
    for (let i = 0; i < n; i++) {
      const type = pick(TYPE_LIST);
      makeSensorInto(b, type);
    }
  });
  function makeSensorInto(b, type, statusHint) {
    const cfg = TYPES[type];
    const subIdx = ri(0, cfg.subtypes.length - 1);
    sensors.push(makeSensor(b, type, subIdx, statusHint));
  }
  // guarantee a couple of live "situations" for the demo
  if (sensors[3]) { sensors[3].status = 'fault'; sensors[3].health_pct = 34; }
  if (sensors[7]) { sensors[7].status = 'degraded'; sensors[7].health_pct = 71; }

  const summarise = () => {
    const online = sensors.filter((s) => s.status === 'online').length;
    const faults = sensors.filter((s) => s.status === 'fault' || s.status === 'degraded').length;
    const offline = sensors.filter((s) => s.status === 'offline').length;
    const batt = sensors.filter((s) => s.battery_pct != null);
    const lowBatt = batt.filter((s) => s.battery_pct < 20).length;
    const byType = TYPE_LIST.map((tp) => {
      const list = sensors.filter((s) => s.type === tp);
      return { type: tp, total: list.length, online: list.filter((s) => s.status === 'online').length, faults: list.filter((s) => s.status === 'fault' || s.status === 'degraded').length };
    });
    return {
      kpis: {
        total: sensors.length, online, offline, faults,
        avgHealth: sensors.length ? Math.round(sensors.reduce((a, s) => a + s.health_pct, 0) / sensors.length) : 0,
        uptime: sensors.length ? +((online / sensors.length) * 100).toFixed(1) : 0,
        lowBattery: lowBatt, avgBattery: batt.length ? Math.round(batt.reduce((a, s) => a + s.battery_pct, 0) / batt.length) : 0,
      },
      byType,
      buildings: buildings.map((b) => b.id),
      types: TYPE_LIST,
      typeCatalogue: TYPES,
    };
  };

  app.get('/api/iot/sensors', (req, res) => {
    const { building, type } = req.query;
    let list = sensors;
    if (building && building !== 'ALL') list = list.filter((s) => s.building_id === building);
    if (type && type !== 'ALL') list = list.filter((s) => s.type === type);
    res.json({ ...summarise(), sensors: [...list].sort((a, b) => a.health_pct - b.health_pct) });
  });

  app.post('/api/iot/sensors', express.json(), (req, res) => {
    const { building_id, type, subtype, name, floor } = req.body || {};
    const b = buildings.find((x) => x.id === building_id) || buildings[0];
    if (!TYPES[type]) return res.status(400).json({ error: 'unknown sensor type' });
    const cfg = TYPES[type];
    const subIdx = Math.max(0, cfg.subtypes.indexOf(subtype));
    const s = makeSensor(b, type, subIdx < 0 ? 0 : subIdx, 'online');
    if (name) s.name = name;
    if (floor) s.floor = floor;
    s.health_pct = 100; s.last_seen_min = 0;
    sensors.unshift(s);
    res.json({ ok: true, sensor: s, kpis: summarise().kpis });
  });

  app.delete('/api/iot/sensors/:id', (req, res) => {
    const before = sensors.length;
    sensors = sensors.filter((s) => s.id !== req.params.id);
    if (sensors.length === before) return res.status(404).json({ error: 'unknown sensor' });
    res.json({ ok: true, removed: req.params.id, kpis: summarise().kpis });
  });
}

module.exports = { registerExt };
