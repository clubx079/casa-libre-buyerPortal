// Server-side marketplace search: one page of complete, active building listings
// matching the filters, plus the exact total count. Backs the marketplace so all
// ~25k listings are searchable without shipping them to the browser.
import { NextResponse } from 'next/server';
import { selectWithCount } from '@/lib/db';
import { buildingsParts } from '@/lib/land';
import { getUsdToPyg } from '@/lib/fx';
import { dualPrice } from '@/lib/money';

export const dynamic = 'force-dynamic';

// PostgREST here uses %-wildcards (encoded %25); commas/parens in values are
// percent-encoded so they can't break an or=() group.
const ilike = (col, v) => `${col}.ilike.%25${encodeURIComponent(String(v))}%25`;

// property_type buckets → ilike keywords (land buckets excluded; buildings only).
const TYPE_KW = {
  casa: ['casa', 'house'],
  depto: ['departamento', 'depto', 'apartment', 'flat'],
  duplex: ['duplex', 'dúplex'],
  oficina: ['oficina', 'office'],
  deposito: ['deposito', 'depósito', 'warehouse', 'galp'],
  comercial: ['comercial', 'local', 'commercial', 'tienda'],
};

export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch { b = {}; }
  const op = b.op === 'alquiler' || b.op === 'venta' ? b.op : 'all';
  const type = b.type && b.type !== 'all' ? String(b.type) : null;
  const beds = b.beds && b.beds !== 'all' ? parseInt(b.beds, 10) : null;
  const q = typeof b.q === 'string' && b.q.trim() ? b.q.trim() : null;
  const barrio = typeof b.barrio === 'string' && b.barrio.trim() ? b.barrio.trim() : null;
  const seller = b.seller === 'owner' || b.seller === 'agent' ? b.seller : null;
  const priceMin = Number.isFinite(+b.priceMin) ? +b.priceMin : null; // USD
  const priceMax = Number.isFinite(+b.priceMax) ? +b.priceMax : null; // USD
  const sort = ['relevancia', 'precio_asc', 'precio_desc', 'area_desc'].includes(b.sort) ? b.sort : 'relevancia';
  const page = Math.max(1, parseInt(b.page, 10) || 1);
  const pageSize = Math.min(60, Math.max(1, parseInt(b.pageSize, 10) || 24));

  const parts = [
    'select=id,latitude,longitude,listing_type,price,currency,property_type,city,neighborhood,address,province,bedrooms,bathrooms,parking_spaces,covered_area,floor_area,land_area,source_id,price_usd',
    'is_complete=eq.true',
    'admin_status=eq.active',
    ...buildingsParts(),
  ];
  if (op === 'alquiler') parts.push('listing_type=eq.rent');
  else if (op === 'venta') parts.push('listing_type=neq.rent');
  if (type && TYPE_KW[type]) parts.push(`or=(${TYPE_KW[type].map((k) => ilike('property_type', k)).join(',')})`);
  if (beds) parts.push(`bedrooms=gte.${beds}`);
  if (priceMin != null) parts.push(`price_usd=gte.${priceMin}`);
  if (priceMax != null) parts.push(`price_usd=lte.${priceMax}`);
  if (barrio) parts.push(ilike('neighborhood', barrio).replace('.ilike.', '=ilike.'));
  if (seller === 'owner') parts.push('source_id=is.null');
  else if (seller === 'agent') parts.push('source_id=not.is.null');
  if (q) parts.push(`or=(${['neighborhood', 'city', 'address', 'property_type'].map((c) => ilike(c, q)).join(',')})`);

  if (sort === 'precio_asc') parts.push('order=price_usd.asc.nullslast');
  else if (sort === 'precio_desc') parts.push('order=price_usd.desc.nullslast');
  else if (sort === 'area_desc') parts.push('order=covered_area.desc.nullslast');
  else parts.push('order=created_at.desc');

  const from = (page - 1) * pageSize;
  parts.push(`limit=${pageSize}`);
  parts.push(`offset=${from}`);

  let rows = [], count = 0;
  try { ({ rows, count } = await selectWithCount('properties', parts.join('&'))); }
  catch (e) { return NextResponse.json({ listings: [], count: 0, page, error: e.message }, { status: 200 }); }

  const rate = await getUsdToPyg();
  const num = (v) => (v == null ? null : Number(v));
  const listings = rows.map((r) => {
    const m = dualPrice(r.price, r.currency, rate);
    return {
      id: r.id, lat: num(r.latitude), lng: num(r.longitude),
      mode: r.listing_type === 'rent' ? 'alquiler' : 'venta',
      usd: m.usd, pyg: m.pyg, type: r.property_type || null,
      city: r.city || null, neighborhood: r.neighborhood || null, address: r.address || null, province: r.province || null,
      beds: num(r.bedrooms), baths: num(r.bathrooms), parking: num(r.parking_spaces),
      area: num(r.covered_area) || num(r.floor_area) || num(r.land_area) || null,
      user_published: !r.source_id,
    };
  });

  return NextResponse.json({ listings, count, page, pageSize });
}
