/* ============================================================
   PaceUp — GPS Module
   Handles geolocation, distance, pace smoothing
   ============================================================ */

const GPS = (() => {

  // Haversine formula — distance between two lat/lon points in meters
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) *
              Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Smooth pace using a rolling average with outlier rejection
  // Returns average speed in m/s
  function smoothSpeed(speeds, windowSize) {
    if (speeds.length === 0) return 0;
    const w = Math.min(windowSize, speeds.length);
    const recent = speeds.slice(-w);

    // Calculate mean and standard deviation
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const std = Math.sqrt(
      recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length
    );

    // Remove readings > 2 standard deviations from mean
    const filtered = std > 0.1
      ? recent.filter(s => Math.abs(s - mean) < 2 * std)
      : recent;

    if (filtered.length === 0) return mean;
    return filtered.reduce((a, b) => a + b, 0) / filtered.length;
  }

  // Convert speed (m/s) to pace (seconds per km)
  function speedToPace(speed) {
    if (speed <= 0) return 0;
    return 1000 / speed;
  }

  // Process a new GPS position
  // Returns { lat, lon, dist, speed } or null if filtered out
  function processPosition(pos, prevPositions) {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const accuracy = pos.coords.accuracy;
    const timestamp = pos.timestamp;

    // Filter: reject readings with poor accuracy (>25m)
    if (accuracy > 25) return null;

    const prev = prevPositions[prevPositions.length - 1];
    if (!prev) {
      return { lat, lon, dist: 0, speed: 0, ts: timestamp, accuracy };
    }

    const dist = haversine(prev.lat, prev.lon, lat, lon);
    const timeDiff = (timestamp - prev.ts) / 1000; // seconds

    // Filter: impossible time gaps
    if (timeDiff <= 0) return null;

    // Filter: impossible speed (>12 m/s ≈ 43 km/h — not running)
    if (dist / timeDiff > 12) return null;

    // Filter: noise — less than 1m movement
    if (dist < 1) return null;

    const speed = dist / timeDiff;

    return { lat, lon, dist, speed, ts: timestamp, accuracy };
  }

  // Format seconds-per-km into "M:SS" string
  function formatPace(secsPerKm) {
    if (!isFinite(secsPerKm) || secsPerKm <= 0 || secsPerKm > 1800) return '--:--';
    const m = Math.floor(secsPerKm / 60);
    const s = Math.floor(secsPerKm % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  // Format elapsed seconds into "MM:SS" or "H:MM:SS"
  function formatTime(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  // Generate GPX XML from position data
  function generateGPX(positions, name, startTime) {
    const pts = positions.map(p => {
      const t = new Date(p.ts).toISOString();
      return `      <trkpt lat="${p.lat}" lon="${p.lon}"><time>${t}</time></trkpt>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="PaceUp"
     xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <time>${new Date(startTime).toISOString()}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>`;
  }

  return {
    haversine,
    smoothSpeed,
    speedToPace,
    processPosition,
    formatPace,
    formatTime,
    generateGPX
  };

})();
