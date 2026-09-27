// Asunción zoning drawn by the city's own map server (Plan Regulador, layer 4) as
// transparent 256px tiles over our Google map. Each tile asks the ArcGIS `export`
// endpoint for exactly that Web Mercator square.
const R = 20037508.342789244;
const EXPORT = 'https://www.asuncion.gov.py/arcgis/rest/services/Mapa_Web/PlanRegulador/MapServer/export';

export function tileBbox3857(x, y, z) {
  const size = (2 * R) / 2 ** z;
  const xmin = -R + x * size, ymax = R - y * size;
  return [xmin, ymax - size, xmin + size, ymax];
}

export function zoningTileUrl(x, y, z) {
  const qs = new URLSearchParams({
    bbox: tileBbox3857(x, y, z).join(','), bboxSR: '3857', imageSR: '3857', size: '256,256',
    layers: 'show:4', transparent: 'true', format: 'png32', f: 'image',
  });
  return `${EXPORT}?${qs}`;
}

// Tiles only at city scale (z ≥ 11) — below that the zones are unreadable anyway.
export function addZoningOverlay(google, map, { opacity = 0.55 } = {}) {
  const layer = new google.maps.ImageMapType({
    getTileUrl: (c, z) => (z >= 11 ? zoningTileUrl(c.x, c.y, z) : null),
    tileSize: new google.maps.Size(256, 256), opacity, name: 'zonificacion',
  });
  map.overlayMapTypes.push(layer);
  return {
    remove() {
      const i = map.overlayMapTypes.getArray().indexOf(layer);
      if (i >= 0) map.overlayMapTypes.removeAt(i);
    },
  };
}
