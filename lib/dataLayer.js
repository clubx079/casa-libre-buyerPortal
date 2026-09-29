// Google Tag Manager dataLayer mirror of our analytics events (see lib/analytics.js
// track()). Follows casa-libre-tracking-instructions.md (the ads agency's event
// reference): the payload is an explicit allow-list — nothing that identifies a
// person (email, phone, name) or a place too precisely (street address, lat/lng,
// free-text search) ever goes in.
//
// `mode` is the field the agency splits the Buyer and Rental campaigns on, so it is
// always 'sale' | 'rent' here (our listings use venta / alquiler internally).

// Only a well-formed container id is used (it is injected into an inline script).
const RAW_GTM_ID = String(process.env.NEXT_PUBLIC_GTM_ID || '').trim();
export const GTM_ID = /^GTM-[A-Z0-9]{4,12}$/.test(RAW_GTM_ID) ? RAW_GTM_ID : '';

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
    // Owner listings take the neighborhood from Google Places, which can fall back to
    // a street / place name ("Av. España 1234"). A real barrio name has no digits, so
    // anything with a number is dropped rather than risk sending a street address.
    neighborhood: placeName(props.neighborhood),
    city: placeName(props.city),
  };
  const out = { event };
  for (const k of DATALAYER_PARAMS) {
    const v = src[k];
    // 'all' is the filters' "no filter" value — not a real property_type / price band.
    out[k] = v === null || v === '' || v === 'all' ? undefined : v;
  }
  return out;
}

function placeName(v) {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s && !/\d/.test(s) ? s : undefined;
}

// Push one event; no-op on the server, when GTM isn't configured, or for owner events.
export function pushDataLayer(event, props) {
  if (typeof window === 'undefined' || !GTM_ID || isOwnerEvent(event)) return;
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(dataLayerEvent(event, props, window.__CL_COUNTRY__));
  } catch { /* analytics must never break the UI */ }
}
