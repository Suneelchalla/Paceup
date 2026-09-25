/* ============================================================
   PaceUp — Map Module
   Leaflet map initialization, route drawing, markers
   ============================================================ */

const MapManager = (() => {

  let map = null;
  let marker = null;
  let polyline = null;
  let summaryMap = null;

  const runnerIconHtml = `
    <div style="
      width:16px; height:16px;
      border-radius:50%;
      background:#00E676;
      border:3px solid #fff;
      box-shadow:0 0 12px rgba(0,230,118,0.6);
    "></div>`;

  function initRun(containerId, lat, lon) {
    destroy();

    map = L.map(containerId, {
      zoomControl: false,
      attributionControl: false,
      center: [lat, lon],
      zoom: 17,
    });

    // Load OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Runner marker
    const icon = L.divIcon({
      html: runnerIconHtml,
      className: '',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    marker = L.marker([lat, lon], { icon }).addTo(map);

    // Route polyline
    polyline = L.polyline([], {
      color: '#00E676',
      weight: 4,
      opacity: 0.8,
      smoothFactor: 1
    }).addTo(map);
  }

  function addPoint(lat, lon, shouldFollow) {
    if (!map) return;
    const latlng = L.latLng(lat, lon);
    if (marker) marker.setLatLng(latlng);
    if (polyline) polyline.addLatLng(latlng);
    if (shouldFollow) map.panTo(latlng);
  }

  function centerOn(lat, lon) {
    if (map) map.panTo([lat, lon]);
  }

  function destroy() {
    if (map) { map.remove(); map = null; }
    marker = null;
    polyline = null;
  }

  // Summary map for post-run screen
  function initSummary(containerId, positions) {
    if (summaryMap) { summaryMap.remove(); summaryMap = null; }
    if (positions.length < 2) return null;

    summaryMap = L.map(containerId, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      touchZoom: false,
      doubleClickZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(summaryMap);

    const latlngs = positions.map(p => [p.lat, p.lon]);
    const line = L.polyline(latlngs, {
      color: '#00E676',
      weight: 3
    }).addTo(summaryMap);

    summaryMap.fitBounds(line.getBounds().pad(0.15));

    // Start marker (green)
    L.circleMarker(latlngs[0], {
      radius: 6,
      color: '#00E676',
      fillColor: '#00E676',
      fillOpacity: 1
    }).addTo(summaryMap);

    // End marker (red)
    L.circleMarker(latlngs[latlngs.length - 1], {
      radius: 6,
      color: '#FF5252',
      fillColor: '#FF5252',
      fillOpacity: 1
    }).addTo(summaryMap);

    return summaryMap;
  }

  function destroySummary() {
    if (summaryMap) { summaryMap.remove(); summaryMap = null; }
  }

  return {
    initRun,
    addPoint,
    centerOn,
    destroy,
    initSummary,
    destroySummary
  };

})();
