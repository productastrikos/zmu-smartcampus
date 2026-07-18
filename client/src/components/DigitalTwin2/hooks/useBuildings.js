import { useEffect, useState } from 'react';
import { GISDataProvider } from '../services/GISDataProvider';

// Loads the real building records (never a data source directly — always
// through GISDataProvider) and hands back the shaped, future-ready array.
export function useBuildings() {
  const [state, setState] = useState({ loading: true, error: null, data: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await GISDataProvider.getBuildings();
        if (!cancelled) setState({ loading: false, error: null, data });
      } catch (e) {
        if (!cancelled) setState({ loading: false, error: String(e.message || e), data: [] });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return state;
}
