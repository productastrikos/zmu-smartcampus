import { useEffect, useState } from 'react';
import { GISDataProvider } from '../services/GISDataProvider';

// Loads every non-building GIS layer at once through GISDataProvider
// (never a data source directly) and hands back one aggregated
// { roads, footpaths, parking, ... } object.
export function useGIS() {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await GISDataProvider.getAllLayers();
        if (!cancelled) setState({ loading: false, error: null, data });
      } catch (e) {
        if (!cancelled) setState({ loading: false, error: String(e.message || e), data: null });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return state;
}
