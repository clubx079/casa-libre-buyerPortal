// Google Tag Manager dataLayer mirror of our analytics events (see lib/analytics.js
// track()). Follows casa-libre-tracking-instructions.md (the ads agency's event
// reference): the payload is an explicit allow-list — nothing that identifies a
// person (email, phone, name) or a place too precisely (street address, lat/lng,
// free-text search) ever goes in.
//
// `mode` is the field the agency splits the Buyer and Rental campaigns on, so it is
// always 'sale' | 'rent' here (our listings use venta / alquiler internally).

export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || '';

// Exactly the parameters in the agency's event reference table.
export const DATALAYER_PARAMS = [
  'site_country',
  'mode',
  'property_id',
  'property_type',
  'city',
  'neighborhood',
  'price',
  'currency',
  'listing_ref',
  'price_range',
  'bedrooms',
  'results_count',
  'method',
];

// Owner-side events never go to the dataLayer: sellers aren't the Buyer / Rental
// campaigns' audience and must not be counted as their conversions.
export const isOwnerEvent = (event) => event === 'listing_created' || /^sell_/.test(String(event));

// venta / alquiler (and the filter's 'all') → 'sale' | 'rent' | undefined.
export function normalizeMode(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'venta' || s === 'sale') return 'sale';
  if (s === 'alquiler' || s === 'rent') return 'rent';
  return undefined;
}

// The object pushed for one event. Every allowed key is present (undefined when the
// event doesn't carry it) so a value from an earlier event can't linger in GTM's
// data model and get attributed to this one. Our internal prop names map onto the
// agency's: type → property_type, ref → listing_ref, operation → mode.
export function dataLayerEvent(event, props = {}, country) {
  const src = {
    ...props,
    site_country: country ?? props.site_country,
    mode: normalizeMode(props.mode ?? props.operation),
    property_type: props.property_type ?? props.type,
    listing_ref: props.listing_ref ?? props.ref,
  };
  const out = { event };
  for (const k of DATALAYER_PARAMS) {
    const v = src[k];
    out[k] = v === null || v === '' ? undefined : v;
  }
  return out;
}

// Push one event; no-op on the server, when GTM isn't configured, or for owner events.
export function pushDataLayer(event, props) {
  if (typeof window === 'undefined' || !GTM_ID || isOwnerEvent(event)) return;
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(dataLayerEvent(event, props, window.__CL_COUNTRY__));
  } catch { /* analytics must never break the UI */ }
}
