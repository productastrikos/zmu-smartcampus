// Pure arc-length parametric position along a polyline — given a real
// polyline (array of [x,z] local-meter points, e.g. one of the real fence
// LineStrings) and an elapsed-time value, returns where a patrol marker
// sits at that moment, looping back and forth along the real route. No
// React/Three imports — consumed by PatrolLayer.jsx's per-frame render.

export function polylineLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return len;
}

// speedMps: real-feeling walking pace in metres/second along the route.
export function positionAtTime(pts, elapsedMs, speedMps = 1.4) {
  const total = polylineLength(pts);
  if (total < 1e-6) return { point: pts[0], heading: 0 };
  const distance = (elapsedMs / 1000) * speedMps;
  const cycle = distance % (total * 2);
  const along = cycle <= total ? cycle : total * 2 - cycle; // ping-pong back and forth along the real route

  let remaining = along;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (remaining <= segLen || i === pts.length - 1) {
      const t = segLen > 1e-6 ? Math.min(1, remaining / segLen) : 0;
      return {
        point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        heading: Math.atan2(b[1] - a[1], b[0] - a[0]),
      };
    }
    remaining -= segLen;
  }
  return { point: pts[pts.length - 1], heading: 0 };
}
