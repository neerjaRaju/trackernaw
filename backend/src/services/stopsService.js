const { haversineMeters } = require('./geofenceService');

/**
 * Detect stops in a chronologically-ordered list of location pings.
 *
 * A "stop" is a consecutive cluster of pings where every point is within
 * `radiusM` of the cluster centroid AND the cluster spans at least `minMinutes`.
 *
 * Returns: [{ lat, lng, startedAt, endedAt, durationMin, pings }]
 */
function detectStops(pings, { radiusM = 80, minMinutes = 5 } = {}) {
  const sorted = [...pings].sort((a, b) =>
    new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );
  const stops = [];
  let cluster = [];

  const flush = () => {
    if (cluster.length < 2) { cluster = []; return; }
    const first = cluster[0];
    const last = cluster[cluster.length - 1];
    const durMin = (new Date(last.recordedAt) - new Date(first.recordedAt)) / 60000;
    if (durMin >= minMinutes) {
      // centroid
      const lat = cluster.reduce((s, p) => s + p.lat, 0) / cluster.length;
      const lng = cluster.reduce((s, p) => s + p.lng, 0) / cluster.length;
      stops.push({
        lat, lng,
        startedAt: first.recordedAt,
        endedAt: last.recordedAt,
        durationMin: Math.round(durMin),
        pings: cluster.length,
      });
    }
    cluster = [];
  };

  for (const p of sorted) {
    if (!cluster.length) { cluster.push(p); continue; }
    const centroidLat = cluster.reduce((s, x) => s + x.lat, 0) / cluster.length;
    const centroidLng = cluster.reduce((s, x) => s + x.lng, 0) / cluster.length;
    if (haversineMeters(centroidLat, centroidLng, p.lat, p.lng) <= radiusM) {
      cluster.push(p);
    } else {
      flush();
      cluster.push(p);
    }
  }
  flush();
  return stops;
}

module.exports = { detectStops };
