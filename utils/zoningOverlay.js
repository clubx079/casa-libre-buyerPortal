// Asunción zoning over our Google map, in OUR colours, and steady while zooming.
//
// The city's ArcGIS 10 server can't restyle its layer, so each height category is
// requested separately (layerDefs = that category's zone codes) and recoloured on a
// canvas (the server sends Access-Control-Allow-Origin: *, so the canvas stays clean).
//
// Why not map tiles: every zoom step asked the (slow) city server for a fresh set of
// tiles and Google dropped the old ones first, so the colours blinked out on every
// pinch / double-tap. Instead we draw ONE picture covering the visible area (plus a
// margin), pinned to its lat/lng box — Google scales it with the map during any
// gesture. When the map settles, a sharper picture is fetched in the background and
// only swapped in once fully drawn. The colours never disappear.
import { codesFor } from '../lib/zoning/asuncionRules.js';

const R = 6378137;
const EXPORT = 'https://www.asuncion.gov.py/arcgis/rest/services/Mapa_Web/PlanRegulador/MapServer/export';
const MAX_PX = 1400;          // bigger renders get very slow on the city server (2048 px ≈ 27 s, 1400 ≈ 5 s)
const MIN_ZOOM = 10;          // below this the city is a speck — keep the last picture hidden

// Matches the filter's categories (Baja / Media / Alta). "otro" (industrial, parks) isn't drawn.
export const ZONE_COLORS = { baja: '#4F9D7A', media: '#E0A33A', alta: '#C4513A' };
export const ZONE_CATEGORIES = ['baja', 'media', 'alta'];

export const to3857 = (lat, lng) => [
  (lng * Math.PI / 180) * R,
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * R,
];

// bbox = { s, w, n, e } in degrees; size = [width, height] px.
export function exportUrl(bbox, size, codes) {
  const [xmin, ymin] = to3857(bbox.s, bbox.w);
  const [xmax, ymax] = to3857(bbox.n, bbox.e);
  const qs = new URLSearchParams({
    bbox: [xmin, ymin, xmax, ymax].join(','), bboxSR: '3857', imageSR: '3857', size: size.join(','),
    layers: 'show:4', transparent: 'true', format: 'png32', f: 'image',
  });
  if (codes?.length) qs.set('layerDefs', `4:zona_reg IN (${codes.map((c) => `'${c}'`).join(',')})`);
  return `${EXPORT}?${qs}`;
}

// The visible box grown by `pad` (fraction of its size) on each side, and the pixel
// size to request for it — capped so it never exceeds what the server will render.
export function paddedView(bounds, px, pad = 0.5) {
  const dLat = (bounds.n - bounds.s) * pad, dLng = (bounds.e - bounds.w) * pad;
  const box = { s: bounds.s - dLat, n: bounds.n + dLat, w: bounds.w - dLng, e: bounds.e + dLng };
  let [w, h] = [px[0] * (1 + 2 * pad), px[1] * (1 + 2 * pad)];
  const k = Math.min(1, MAX_PX / Math.max(w, h));
  return { box, size: [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))] };
}

const loadImage = (url) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = url;
});

// City shapes → our colour: keep the pixels the city drew, paint them one flat colour.
function paint(canvas, images, colors) {
  const ctx = canvas.getContext('2d');
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width; tmp.height = canvas.height;
  const t = tmp.getContext('2d');
  images.forEach((img, i) => {
    if (!img) return;
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, tmp.width, tmp.height);
    t.drawImage(img, 0, 0, tmp.width, tmp.height);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = colors[i];
    t.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(tmp, 0, 0);
  });
}

// categories: which height groups to paint (all three, or just the one the filter picked).
export function addZoningOverlay(google, map, { categories = ZONE_CATEGORIES, opacity = 0.5 } = {}) {
  const groupsFor = (cats) => cats.filter((c) => ZONE_COLORS[c]).map((c) => ({ color: ZONE_COLORS[c], codes: codesFor(c) }));
  let groups = groupsFor(categories);
  let frame = null;      // { el, box } currently shown
  let seq = 0;
  let listener = null;
  const overlay = new google.maps.OverlayView();

  const place = (f) => {
    const proj = overlay.getProjection();
    if (!proj || !f) return;
    const sw = proj.fromLatLngToDivPixel(new google.maps.LatLng(f.box.s, f.box.w));
    const ne = proj.fromLatLngToDivPixel(new google.maps.LatLng(f.box.n, f.box.e));
    Object.assign(f.el.style, { left: `${sw.x}px`, top: `${ne.y}px`, width: `${ne.x - sw.x}px`, height: `${sw.y - ne.y}px` });
  };

  async function refresh() {
    const my = ++seq;
    const b = map.getBounds();
    const div = map.getDiv();
    if (!b || !div || map.getZoom() < MIN_ZOOM) { if (frame) frame.el.style.display = 'none'; return; }
    if (frame) frame.el.style.display = '';
    const ne = b.getNorthEast(), sw = b.getSouthWest();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { box, size } = paddedView({ n: ne.lat(), e: ne.lng(), s: sw.lat(), w: sw.lng() }, [div.clientWidth * dpr, div.clientHeight * dpr]);
    const images = await Promise.all(groups.map((g) => loadImage(exportUrl(box, size, g.codes))));
    if (my !== seq || !overlay.getMap()) return;           // a newer view (or removal) won
    if (images.every((i) => !i)) return;                    // city server hiccup: keep the old picture
    const el = document.createElement('canvas');
    el.width = size[0]; el.height = size[1];
    el.style.cssText = `position:absolute;opacity:${opacity};pointer-events:none`;
    paint(el, images, groups.map((g) => g.color));
    const next = { el, box };
    overlay.getPanes()?.overlayLayer.appendChild(el);
    place(next);
    if (frame) frame.el.remove();                           // swap only after the new one is drawn
    frame = next;
  }

  overlay.onAdd = () => { listener = map.addListener('idle', refresh); refresh(); };
  overlay.draw = () => place(frame);
  overlay.onRemove = () => {
    seq++;
    if (listener) listener.remove();
    if (frame) frame.el.remove();
    frame = null;
  };
  overlay.setMap(map);
  return {
    remove() { overlay.setMap(null); },
    // Filter changed: repaint in place — the current picture stays until the new one is drawn.
    setCategories(cats) { groups = groupsFor(cats); if (overlay.getMap()) refresh(); },
  };
}
