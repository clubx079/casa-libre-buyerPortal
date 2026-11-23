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
  // Drawn in the map's OWN layer (an OverlayView in the 'overlayLayer' pane), below every marker:
  // as marker labels they were painted above the price pins and clusters and mixed with them
  // (Omar, Nov 23). Light, small text with a white halo — a map hint, never on top of a pin.
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
  let current = [];
  const ov = new google.maps.OverlayView();
  ov.onAdd = () => { ov.getPanes().overlayLayer.appendChild(box); };
  ov.onRemove = () => { box.remove(); };
  ov.draw = () => {
    const proj = ov.getProjection();
    if (!proj) return;
    box.textContent = '';
    for (const l of current) {
      const pt = proj.fromLatLngToDivPixel(new google.maps.LatLng(l.lat, l.lng));
      if (!pt) continue;
      const el = document.createElement('div');
      el.className = 'cl-barrio-label';
      el.textContent = l.name;
      el.style.cssText = `position:absolute;left:${pt.x}px;top:${pt.y}px;transform:translate(-50%,-50%);color:rgba(17,17,17,0.45);font-size:10.5px;font-weight:600;`;
      box.appendChild(el);
    }
  };
  ov.setMap(map);
  const update = () => {
    const z = map.getZoom(), b = map.getBounds();
    if (!b || z < minZoom || !labels || !labels.length) { current = []; ov.draw(); return; }
    const c = b.getCenter(), skip = hide();
    current = labels.filter((l) => l.id !== skip && b.contains({ lat: l.lat, lng: l.lng }))
      .map((l) => [(l.lat - c.lat()) ** 2 + (l.lng - c.lng()) ** 2, l])
      .sort((a2, b2) => a2[0] - b2[0]).slice(0, max).map((x) => x[1]);
    ov.draw();
  };
  const listener = map.addListener('idle', update);
  update();
  return { update, remove: () => { try { listener.remove(); } catch {} current = []; ov.setMap(null); } };
}
