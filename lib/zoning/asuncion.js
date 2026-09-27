// Which Plan Regulador zone a point is in, from Asunción's public ArcGIS layer.
// The zone outlines can't be downloaded, but the layer answers spatial queries.
// A 25 m box absorbs addresses geocoded onto the street between two blocks.
import { zoneRule } from './asuncionRules.js';

const QUERY_URL = 'https://www.asuncion.gov.py/arcgis/rest/services/Mapa_Web/PlanRegulador/MapServer/4/query';

export async function lookupAsuncionZone(lat, lng, { fetchImpl = fetch, toleranceM = 25 } = {}) {
  const la = Number(lat), lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  const dLat = toleranceM / 111320;
  const dLng = toleranceM / (111320 * Math.cos((la * Math.PI) / 180));
  const geometry = JSON.stringify({ xmin: lo - dLng, ymin: la - dLat, xmax: lo + dLng, ymax: la + dLat, spatialReference: { wkid: 4326 } });
  const qs = new URLSearchParams({
    geometry, geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
    outFields: 'zona_reg', returnGeometry: 'false', f: 'json',
  });
  const res = await fetchImpl(`${QUERY_URL}?${qs}`, { headers: { 'User-Agent': 'CasaLibre/1.0 (+https://casa-libre.com.py)' } });
  if (!res.ok) throw new Error(`asuncion_zoning_http_${res.status}`);
  const j = JSON.parse(await res.text());   // an HTML error page throws here → retried later
  if (j.error) throw new Error(`asuncion_zoning_${j.error.code || 'error'}`);
  const codes = (j.features || []).map((f) => f?.attributes?.zona_reg).filter(Boolean);
  if (!codes.length) return null;
  const tally = new Map();
  for (const c of codes) tally.set(c, (tally.get(c) || 0) + 1);
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return zoneRule(top);
}
