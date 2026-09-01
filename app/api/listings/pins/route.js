// Compact map pins for the CURRENT filter — every matching complete listing's
// [id, lat, lng, usd, mode], bounded to Paraguay. Cached per filter combo so the
// heavy unfiltered (~25k) case runs at most once per revalidate window.
import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { select } from '@/lib/db';
import { buildingsParts } from '@/lib/land';
import { getUsdToPyg } from '@/lib/fx';
import { dualPrice } from '@/lib/money';

export const dynamic = 'force-dynamic';

const ilike = (col, v) => `${col}.ilike.%25${encodeURIComponent(String(v))}%25`;
const TYPE_KW = {
  casa: ['casa', 'house'], depto: ['departamento', 'depto', 'apartment', 'flat'],
  duplex: ['duplex', 'dúplex'], oficina: ['oficina', 'office'],
  deposito: ['deposito', 'depósito', 'warehouse', 'galp'], comercial: ['comercial', 'local', 'commercial', 'tienda'],
};

function filterParts(p) {
  const op = p.op === 'alquiler' || p.op === 'venta' ? p.op : 'all';
  const parts = [
    'is_complete=eq.true', 'admin_status=eq.active',
    // Paraguay bbox — never plot mis-geocoded listings abroad.
    'latitude=not.is.null', 'longitude=not.is.null',
    'latitude=gte.-28', 'latitude=lte.-19', 'longitude=gte.-63', 'longitude=lte.-54',
    ...buildingsParts(),
  ];
  if (op === 'alquiler') parts.push('listing_type=eq.rent');
  else if (op === 'venta') parts.push('listing_type=neq.rent');
  if (p.type && TYPE_KW[p.type]) parts.push(`or=(${TYPE_KW[p.type].map((k) => ilike('property_type', k)).join(',')})`);
  if (p.beds) parts.push(`bedrooms=gte.${parseInt(p.beds, 10)}`);
  if (p.priceMin) parts.push(`price_usd=gte.${Number(p.priceMin)}`);
  if (p.priceMax) parts.push(`price_usd=lte.${Number(p.priceMax)}`);
  if (p.barrio) parts.push(`neighborhood=ilike.%25${encodeURIComponent(p.barrio)}%25`);
  if (p.seller === 'owner') parts.push('source_id=is.null');
  else if (p.seller === 'agent') parts.push('source_id=not.is.null');
  if (p.q) parts.push(`or=(${['neighborhood', 'city', 'address', 'property_type'].map((c) => ilike(c, p.q)).join(',')})`);
  return parts;
}

const loadPins = unstable_cache(
  async (key, partsStr) => {
    const rate = await getUsdToPyg();
    const all = [];
    for (let off = 0; ; off += 1000) {
      let rows = [];
      try { rows = await select('properties', `${partsStr}&select=id,latitude,longitude,listing_type,price,currency&order=id&limit=1000&offset=${off}`); }
      catch { break; }
      if (!Array.isArray(rows) || !rows.length) break;
      for (const r of rows) {
        const m = dualPrice(r.price, r.currency, rate);
        all.push({ id: r.id, lat: Number(r.latitude), lng: Number(r.longitude), usd: m.usd, mode: r.listing_type === 'rent' ? 'alquiler' : 'venta' });
      }
      if (rows.length < 1000) break;
    }
    return all;
  },
  ['cl-listing-pins-v1'],
  { revalidate: 120 },
);

export async function GET(req) {
  const sp = req.nextUrl.searchParams;
  const p = Object.fromEntries(['op', 'type', 'beds', 'priceMin', 'priceMax', 'barrio', 'seller', 'q'].map((k) => [k, sp.get(k) || '']));
  const partsStr = filterParts(p).join('&');
  const key = partsStr; // cache per unique filter combo
  const pins = await loadPins(key, partsStr);
  return NextResponse.json({ pins, count: pins.length });
}
