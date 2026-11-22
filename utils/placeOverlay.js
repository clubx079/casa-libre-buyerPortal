// Google Maps layers for the place search (desktop + phone marketplace maps):
//  - fitBox: point the camera at a { n, s, e, w } box (outliers already dropped by
//    lib/areaGeom.js), never closer than `maxZoom`.
//  - placeOutline: the picked barrio / city outline + its name above it.
//  - barrioLabels: barrio names on the map once zoomed in, only those in view.
const INK = '#111111';
const BLANK = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');

export function boxToLatLngBounds(google, b) {
  return new google.maps.LatLngBounds({ lat: b.s, lng: b.w }, { lat: b.n, lng: b.e });
}

// Fit the map to a box; a box of a few blocks never zooms in past maxZoom.
export function fitBox(google, map, b, { padding = 48, maxZoom = 16 } = {}) {
  if (!b || ![b.n, b.s, b.e, b.w].every(Number.isFinite)) return;
  map.fitBounds(boxToLatLngBounds(google, b), padding);
  google.maps.event.addListenerOnce(map, 'idle', () => { if (map.getZoom() > maxZoom) map.setZoom(maxZoom); });
}

// The picked place's outline (area.ring = closed [[lng,lat]…]) + a name label at its top.
// Returns { remove() }.
export function placeOutline(google, map, area) {
  const parts = [];
  if (area && Array.isArray(area.ring) && area.ring.length > 2) {
    parts.push(new google.maps.Polygon({
      map, paths: area.ring.map(([lng, lat]) => ({ lat, lng })), clickable: false, zIndex: 1,
      strokeColor: INK, strokeOpacity: 0.85, strokeWeight: 2, fillColor: INK, fillOpacity: 0.05,
    }));
  }
  if (area && Array.isArray(area.label) && area.name) {
    parts.push(new google.maps.Marker({
      map, position: { lat: area.label[1], lng: area.label[0] }, clickable: false, zIndex: 20000,
      icon: { url: BLANK, size: new google.maps.Size(1, 1), anchor: new google.maps.Point(0, 0), labelOrigin: new google.maps.Point(0, -12) },
      label: { text: area.name, color: INK, fontSize: '14px', fontWeight: '700', className: 'cl-place-label' },
    }));
  }
  return { remove: () => parts.forEach((p) => { try { p.setMap(null); } catch {} }) };
}

// Barrio names ([{ id, name, lat, lng }]) on the map from `minZoom`, at most `max` in view
// (the ones nearest the centre). Redrawn when the map settles. Returns { update(), remove() }.
export function barrioLabelLayer(google, map, labels, { minZoom = 14, max = 60, hide = () => null } = {}) {
  const shown = new Map();   // id → Marker
  const clear = (keep) => { for (const [id, mk] of shown) if (!keep || !keep.has(id)) { mk.setMap(null); shown.delete(id); } };
  const update = () => {
    const z = map.getZoom(), b = map.getBounds();
    if (!b || z < minZoom || !labels || !labels.length) { clear(); return; }
    const c = b.getCenter(), skip = hide();
    const inView = labels.filter((l) => l.id !== skip && b.contains({ lat: l.lat, lng: l.lng }))
      .map((l) => [(l.lat - c.lat()) ** 2 + (l.lng - c.lng()) ** 2, l])
      .sort((a, b2) => a[0] - b2[0]).slice(0, max).map((x) => x[1]);
    const keep = new Set(inView.map((l) => l.id));
    clear(keep);
    for (const l of inView) {
      if (shown.has(l.id)) continue;
      shown.set(l.id, new google.maps.Marker({
        map, position: { lat: l.lat, lng: l.lng }, clickable: false, zIndex: 0,
        icon: { url: BLANK, size: new google.maps.Size(1, 1), anchor: new google.maps.Point(0, 0), labelOrigin: new google.maps.Point(0, 0) },
        label: { text: l.name, color: 'rgba(17,17,17,0.62)', fontSize: '11px', fontWeight: '600', className: 'cl-barrio-label' },
      }));
    }
  };
  const listener = map.addListener('idle', update);
  update();
  return { update, remove: () => { try { listener.remove(); } catch {} clear(); } };
}
