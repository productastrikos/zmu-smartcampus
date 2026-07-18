/**
 * Connection to the real ZMU PostGIS database (zmu_db) — used only by the
 * Digital Twin 2 feature (digitalTwin_2.jsx + its standalone geo API).
 * Kept separate from the CSV-backed server/index.js on purpose.
 */
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.ZMU_PG_HOST || '192.168.0.166',
  port: Number(process.env.ZMU_PG_PORT || 5432),
  user: process.env.ZMU_PG_USER || 'pqadmin',
  password: process.env.ZMU_PG_PASSWORD || 'pqadmin',
  database: process.env.ZMU_PG_DATABASE || 'zmu_db',
  max: 15,
  idleTimeoutMillis: 10000,
});

module.exports = { pool };
