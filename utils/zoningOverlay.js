// Asunción zoning on our Google map, from PRE-RENDERED tiles in Casa Libre colours.
// Built once by scripts/build-zoning-tiles.mjs (zooms 11–17; sets all/baja/media/alta)
// and served same-origin by /api/media — the city's slow ArcGIS server (~2.5 s per
// render) is never touched at runtime. index.json lists the tiles that exist, so empty
// tiles are never requested. Zooms above the pre-rendered max reuse the max-zoom tile,
// scaled (block-sized polygons stay clean at 2–8×). Same tiles as the mobile app.

export const ZONING_TILES = '/api/media/zoning/asuncion/v1';
export const ZONE_COLORS = { baja: '#4F9D7A', media: '#E0A33A', alta: '#C4513A' };
export const ZONE_CATEGORIES = ['baja', 'media', 'alta'];
const OPACITY = 0.42;

// Which tile set to draw: one height group when the filter picked one, else 'all'.
export const tileSetFor = (categories) => (Array.isArray(categories) && categories.length === 1 && ZONE_CATEGORIES.includes(categories[0]) ? categories[0] : 'all');

// The pre-rendered tile covering a map tile: beyond maxZoom, the ancestor tile at maxZoom
// plus where this tile sits inside it (d levels deeper → a 2^d × 2^d crop).
export function sourceTile(x, y, zoom, maxZoom) {
  const z = Math.min(zoom, maxZoom), d = zoom - z;
  const sx = x >> d, sy = y >> d, k = 2 ** d;
  return { z, x: sx, y: sy, d, scale: k, ox: (x - sx * k) * 256, oy: (y - sy * k) * 256, key: `${z}/${sx}/${sy}` };
}

let indexPromise = null;
export function loadZoningIndex(base = ZONING_TILES) {
  if (!indexPromise) {
    indexPromise = fetch(`${base}/index.json`, { cache: 'force-cache' })
      .then((r) => { if (!r.ok) throw new Error(`index ${r.status}`); return r.json(); })
      .then((j) => ({ ...j, has: Object.fromEntries(Object.entries(j.sets).map(([k, list]) => [k, new Set(list)])) }))
      .catch((e) => { indexPromise = null; throw e; });
  }
  return indexPromise;
}

// Adds the tile layer. onLoading(bool) reports whether tiles are still downloading
// (drives the spinner on the Zonificación button). Returns { remove, setCategories }.
export function addZoningOverlay(google, map, { categories = ZONE_CATEGORIES, onLoading, base = ZONING_TILES } = {}) {
  let set = tileSetFor(categories);
  let layer = null, index = null, pending = 0, dead = false;
  const report = () => { if (!dead && onLoading) onLoading(!index || pending > 0); };

  const makeLayer = () => ({
    tileSize: new google.maps.Size(256, 256),
    maxZoom: 22,
    name: 'zonificacion',
    getTile(coord, zoom, doc) {
      const el = doc.createElement('div');
      el.style.cssText = 'width:256px;height:256px;position:relative;overflow:hidden;pointer-events:none';
      if (!index || zoom < index.minZoom) return el;
      const t = sourceTile(coord.x, coord.y, zoom, index.maxZoom);
      if (!index.has[set]?.has(t.key)) return el;
      const url = `${base}/${set}/${t.key}.png`;
      const img = new Image();
      pending++; report();
      const done = () => { pending = Math.max(0, pending - 1); report(); };
      img.onload = () => {
        const layerEl = doc.createElement('div');
        layerEl.style.cssText = `position:absolute;left:0;top:0;width:256px;height:256px;opacity:${OPACITY};` +
          `background-image:url("${url}");background-repeat:no-repeat;` +
          `background-size:${256 * t.scale}px ${256 * t.scale}px;background-position:-${t.ox}px -${t.oy}px`;
        el.appendChild(layerEl);
        done();
      };
      img.onerror = done;
      img.src = url;
      return el;
    },
    releaseTile() {},
  });

  const mount = () => {
    if (dead || !index) return;
    if (layer) { const i = map.overlayMapTypes.getArray().indexOf(layer); if (i >= 0) map.overlayMapTypes.removeAt(i); }
    layer = makeLayer();
    map.overlayMapTypes.push(layer);
    report();
  };

  report();
  loadZoningIndex(base).then((j) => { index = j; mount(); }).catch(() => { index = { minZoom: 99, maxZoom: 0, has: {} }; report(); });

  return {
    remove() {
      dead = true;
      if (layer) { const i = map.overlayMapTypes.getArray().indexOf(layer); if (i >= 0) map.overlayMapTypes.removeAt(i); }
      layer = null;
    },
    // Height filter changed: swap to that group's tile set.
    setCategories(cats) { set = tileSetFor(cats); pending = 0; mount(); },
  };
}
