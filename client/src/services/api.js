import { useEffect, useState } from 'react';

// Squadron leaders only ever see their own companies. The scope is derived from
// the logged-in role and appended to every API call as ?squads=…; the server
// filters cadet-level data accordingly. Other roles send nothing (see all).
const AUTH_KEY = 'zmu_auth';
export const ROLE_SQUADS = {
  squadron1: ['Falcon', 'Oryx'],
  squadron2: ['Saqr', 'Ghaf'],
};
function squadQuery() {
  try {
    const u = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
    const sq = u && ROLE_SQUADS[u.role];
    return sq ? sq.join(',') : null;
  } catch { return null; }
}

/** Append the logged-in squadron scope (if any) to an API path. Shared by
 *  fetchApi and the extended-module hook so every request is scoped alike. */
export function withSquads(path) {
  const squads = squadQuery();
  if (!squads) return path;
  return path + (path.includes('?') ? '&' : '?') + `squads=${encodeURIComponent(squads)}`;
}

export async function fetchApi(path) {
  const res = await fetch(`/api${withSquads(path)}`);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

/** Fetch-on-mount hook with loading/error state. */
export function useApi(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let live = true;
    setData(null); setError(null);
    fetchApi(path).then((d) => live && setData(d)).catch((e) => live && setError(e));
    return () => { live = false; };
  }, [path]);
  return { data, error, loading: !data && !error };
}

export const fmt = {
  int: (n) => (n ?? 0).toLocaleString('en-US'),
  k: (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`),
  pct: (n) => `${n}%`,
};
