// The listing form's fields, read and checked ONE way for both publishing (/api/publish)
// and editing a published listing (/api/account/listings/edit), so the two can never drift:
// type, street address (Google's pick), neighborhood, city, price (dots/commas = thousands),
// currency (Venezuela: bolívares → US$), area range per type, sale / rent price floors,
// bedrooms + bathrooms (houses / apartments), the WhatsApp contact and its proof.
// → { error, status } or { v: { …values } }.
import { normalizeTypeKey, dbType, isLandType, areaRange } from './propertyTypeOptions';
import { cleanStreet, roomCount, cleanCoords, hasRooms } from './listingInput';
import { parsePrice } from './priceInput';
import { getUsdToPyg, getUsdTo } from './fx';
import { COUNTRY } from './country';
import { listingE164, isAccountPhone, checkPhoneProof } from './listingPhone';
import { getUserById } from './users';

const bad = (error, status = 400) => ({ error, status });

// get(name) → the trimmed form value ('' when missing). opts.requireProof(phone) → whether
// this number has to be proven (wa_check from the web form; edits: when the number changed).
export async function readListingFields(get, session, { requireProof = () => get('wa_check') === '1' } = {}) {
  const mode = get('mode') === 'alquiler' ? 'alquiler' : 'venta';
  const ptype = normalizeTypeKey(get('ptype'));
  const neighborhood = get('neighborhood');
  const city = get('city') || 'Asunción';
  // a whole number: dots / commas are thousands marks, never decimals (lib/priceInput.js) —
  // "290.000" used to be read as 290 and rejected as too low
  let price = parsePrice(get('price'));
  // The currency the seller chose (US$ or this country's). Nothing chosen (an older client)
  // → sale in US$, rent in the local currency.
  const wanted = get('currency').toUpperCase();
  let currency = wanted === 'USD' || wanted === COUNTRY.currencyCode ? wanted : (mode === 'alquiler' ? COUNTRY.currencyCode : 'USD');
  // Venezuela (storeLocalAsUsd): a price in bolívares is converted to US$ at the live
  // rate; the amount the seller typed is kept in raw_data.
  let entered = null;
  if (COUNTRY.storeLocalAsUsd && wanted === COUNTRY.currencyCode && Number.isFinite(price) && price > 0) {
    const perUsd = await getUsdTo(wanted);
    if (!perUsd) return bad('fx_unavailable', 503);
    entered = { price, currency: wanted, per_usd: perUsd };
    price = Math.round(price / perUsd);
    currency = 'USD';
  }
  const area = Number(get('area').replace(/[^\d.]/g, '')) || null;
  const description = get('description');
  const contactName = get('contact_name') || session.name || null;
  const contactPhone = get('contact_phone') || null;
  // owner vs. agent — kept for data quality, not shown publicly
  const sellerType = get('seller_type') === 'agent' ? 'agent' : 'owner';
  // the map position of the address picked from the list (or the app's map picker)
  const coords = cleanCoords(get('latitude'), get('longitude'));
  // Street + number — required: a city or neighborhood alone is not an address
  const street = cleanStreet(get('address'), { neighborhood, city });
  const bedrooms = hasRooms(ptype) ? roomCount(get('bedrooms')) : null;
  const bathrooms = hasRooms(ptype) ? roomCount(get('bathrooms')) : null;

  // Completeness — the same bar the marketplace uses to SHOW a listing
  if (!ptype) return bad('missing_type');
  if (!neighborhood) return bad('missing_neighborhood');
  if (!street) return bad('missing_street');
  if (!city) return bad('missing_city');
  if (!Number.isFinite(price) || price <= 0) return bad('missing_price');
  if (String(contactPhone || '').replace(/\D/g, '').length < 6) return bad('missing_contact');
  // The WhatsApp buyers will use must be proven (lib/listingPhone.js): the account's own
  // verified number, or a code sent to it (phone_proof).
  if (requireProof(contactPhone)) {
    const e164 = listingE164(contactPhone, COUNTRY.phonePrefix);
    const owner = e164 ? await getUserById(session.uid).catch(() => null) : null;
    const proven = e164 && (isAccountPhone(owner, e164) || checkPhoneProof(process.env.SESSION_SECRET || 'insecure-dev-secret', get('phone_proof'), session.uid, e164));
    if (!proven) return bad('phone_unverified');
  }

  const property_type = dbType(ptype);
  const isLand = isLandType(ptype);
  const rate = await getUsdToPyg().catch(() => Number(process.env[`${COUNTRY.fxTarget}_PER_USD`]) || COUNTRY.fxFallback);
  const price_usd = currency === 'USD' ? Math.round(price) : rate ? Math.round(price / rate) : null;

  // Area required + plausible for buildings (land has no upper cap); price floors match the
  // gate (sale ≥ US$5.000, rent ≥ the country's monthly floor).
  const range = areaRange(ptype);   // null for land (any size)
  if (range) {
    if (!(Number(area) > 0)) return bad('missing_area');
    if (Number(area) < range[0] || Number(area) > range[1]) return bad('bad_area');
  }
  if (mode === 'venta') {
    if (!(Number(price_usd) >= 5000)) return bad('price_too_low');
  } else {
    const localVal = currency === COUNTRY.currencyCode ? price : Math.round(price * rate);
    if (!(localVal >= COUNTRY.rentFloorLocal)) return bad('price_too_low');
  }

  return { v: { mode, ptype, property_type, isLand, neighborhood, city, price, currency, price_usd, entered, area, description, contactName, contactPhone, sellerType, coords, street, bedrooms, bathrooms } };
}
