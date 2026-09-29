// Google Tag Manager dataLayer mirror of our analytics events (see lib/analytics.js
// track()). The ads agency builds its conversions from these, so the payload is an
// explicit allow-list: nothing that identifies a person (email, phone, name) or a
// place too precisely (street address, lat/lng, free-text search) ever goes in.
//
// `mode` is the field the agency splits the Buyer and Rental campaigns on, so it is
// always 'sale' | 'rent' here (our listings use venta / alquiler internally).

export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || '';

export const DATALAYER_PARAMS = [
  'mode',
  'property_id',
  'property_type',
  'type',
  'city',
  'neighborhood',
  'state',
  'province',
  'price',
  'currency',
  'channel',
  'method',
  'provider',
  'operation',
  'price_range',
  'bedrooms',
  'allowed_height',
  'sort',
  'results_count',
  'photos',
  'signed_in',
];

// venta / alquiler (and the filter's 'all') → 'sale' | 'rent' | undefined.
export function normalizeMode(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'venta' || s === 'sale') return 'sale';
  if (s === 'alquiler' || s === 'rent') return 'rent';
  return undefined;
}

// The object pushed for one event. Every allowed key is present (undefined when the
// event doesn't carry it) so a value from an earlier event can't linger in GTM's
// data model and get attributed to this one.
export function dataLayerEvent(event, props = {}) {
  const out = { event };
  for (const k of DATALAYER_PARAMS) {
    const v = props[k];
    out[k] = v === null || v === '' ? undefined : v;
  }
  out.mode = normalizeMode(props.mode ?? props.operation);
  return out;
}

// Push one event; no-op on the server or when GTM isn't configured.
export function pushDataLayer(event, props) {
  if (typeof window === 'undefined' || !GTM_ID) return;
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(dataLayerEvent(event, props));
  } catch { /* analytics must never break the UI */ }
}
