// Asunción zoning over our Google map, in OUR colours. The city's ArcGIS 10 server
// can't restyle its layer, so each height category is requested separately
// (layerDefs = that category's zone codes) and used as an alpha MASK over a solid
// colour block — the city draws the shapes, we choose the paint. The server sends
// Access-Control-Allow-Origin: *, which CSS masks need.
import { codesFor } from '../lib/zoning/asuncionRules.js';

const R = 20037508.342789244;
const EXPORT = 'https://www.asuncion.gov.py/arcgis/rest/services/Mapa_Web/PlanRegulador/MapServer/export';

// Matches the filter's categories (Baja / Media / Alta). "otro" (industrial, parks) isn't drawn.
export const ZONE_COLORS = { baja: '#4F9D7A', media: '#E0A33A', alta: '#C4513A' };
export const ZONE_CATEGORIES = ['baja', 'media', 'alta'];

export function tileBbox3857(x, y, z) {
  const size = (2 * R) / 2 ** z;
  const xmin = -R + x * size, ymax = R - y * size;
  return [xmin, ymax - size, xmin + size, ymax];
}

export function zoningTileUrl(x, y, z, codes) {
  const qs = new URLSearchParams({
    bbox: tileBbox3857(x, y, z).join(','), bboxSR: '3857', imageSR: '3857', size: '256,256',
    layers: 'show:4', transparent: 'true', format: 'png32', f: 'image',
  });
  if (codes?.length) qs.set('layerDefs', `4:zona_reg IN (${codes.map((c) => `'${c}'`).join(',')})`);
  return `${EXPORT}?${qs}`;
}

// categories: which height groups to paint (all three, or just the one the filter picked).
export function addZoningOverlay(google, map, { categories = ZONE_CATEGORIES, opacity = 0.5 } = {}) {
  const groups = categories.filter((c) => ZONE_COLORS[c]).map((c) => ({ color: ZONE_COLORS[c], codes: codesFor(c) }));
  const layer = {
    tileSize: new google.maps.Size(256, 256),
    maxZoom: 22,
    name: 'zonificacion',
    getTile(coord, zoom, doc) {
      const tile = doc.createElement('div');
      tile.style.cssText = 'width:256px;height:256px;position:relative;pointer-events:none';
      if (zoom < 11) return tile;   // city scale only
      for (const g of groups) {
        const url = zoningTileUrl(coord.x, coord.y, zoom, g.codes);
        const paint = doc.createElement('div');
        paint.style.cssText = `position:absolute;inset:0;background:${g.color};opacity:${opacity}`;
        paint.style.webkitMaskImage = paint.style.maskImage = `url("${url}")`;
        paint.style.webkitMaskSize = paint.style.maskSize = '256px 256px';
        tile.appendChild(paint);
      }
      return tile;
    },
    releaseTile() {},
  };
  map.overlayMapTypes.push(layer);
  return {
    remove() {
      const i = map.overlayMapTypes.getArray().indexOf(layer);
      if (i >= 0) map.overlayMapTypes.removeAt(i);
    },
  };
}
