import { useEffect, useState } from 'react';

export async function fetchApi(path) {
  const res = await fetch(`/api${path}`);
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
