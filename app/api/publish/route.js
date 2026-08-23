// POST /api/publish — publishes a user-submitted listing straight into the
// marketplace. Inserts a `properties` row (admin_status=active, status=published,
// origin=user) so getListings() picks it up, uploads any photos to B2 and links
// them via property_images. Multipart/form-data.
import { NextResponse } from 'next/server';
import { insert, update } from '@/lib/db';
import { zoneCanonical, dedupeKey } from '@/lib/dedupe';
import { put } from '@/lib/b2';
import { getUsdToPyg } from '@/lib/fx';
import { getSession } from '@/lib/auth';
import { sendListingPublishedEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// mockup Step-1 property types -> canonical property_type stored in the DB
const TYPE_MAP = { casa: 'Casa', departamento: 'Departamento', duplex: 'Dúplex', terreno: 'Terreno' };

const slugify = (s) =>
  String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40);

// Best-effort geocode via OpenStreetMap Nominatim so the listing gets a map pin.
// Never throws — a listing without coords still shows in the list. Tries the
// most specific query first, then falls back to the city.
async function geocodeOne(q) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=py&q=${encodeURIComponent(q)}`,
      { signal: ctrl.signal, cache: 'no-store', headers: { 'User-Agent': 'CasaLibre/1.0 (listings@casalibre.py)' } }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    if (Array.isArray(j) && j[0]) return { lat: Number(j[0].lat), lng: Number(j[0].lon) };
  } catch {}
  return null;
}
async function geocode(neighborhood, city) {
  const queries = [`${neighborhood}, ${city}, Paraguay`, `${city}, Paraguay`];
  for (const q of queries) { const hit = await geocodeOne(q); if (hit) return hit; }
  return null;
}

export async function POST(req) {
  // Require login so every published deal has a known owner.
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let form;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'invalid_form' }, { status: 400 }); }

  const get = (k) => { const v = form.get(k); return v == null ? '' : String(v).trim(); };
  const mode = get('mode') === 'alquiler' ? 'alquiler' : 'venta';
  const ptype = get('ptype').toLowerCase();
  const neighborhood = get('neighborhood');
  const city = get('city') || 'Asunción';
  const priceRaw = get('price').replace(/[^\d.]/g, '');
  const price = Number(priceRaw);
  const currency = get('currency').toUpperCase() === 'PYG' || mode === 'alquiler' ? 'PYG' : 'USD';
  const area = Number(get('area').replace(/[^\d.]/g, '')) || null;
  const description = get('description');
  // Default the public contact to the logged-in user's name/email when not given.
  const contactName = get('contact_name') || session.name || null;
  const contactPhone = get('contact_phone') || null;

  // Completeness validation — a published listing must clear the same bar the
  // marketplace gate uses to SHOW it, so a user's listing is never created
  // "incomplete" and then hidden / 404'd on its own detail page.
  if (!TYPE_MAP[ptype]) return NextResponse.json({ error: 'missing_type' }, { status: 400 });
  if (!neighborhood) return NextResponse.json({ error: 'missing_neighborhood' }, { status: 400 });
  if (!city) return NextResponse.json({ error: 'missing_city' }, { status: 400 });
  if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ error: 'missing_price' }, { status: 400 });
  if (String(contactPhone || '').replace(/\D/g, '').length < 6) return NextResponse.json({ error: 'missing_contact' }, { status: 400 });

  // Listings are FREE — no payment required. Login (above) is the only gate, so
  // every published deal is tied to a known user.

  const property_type = TYPE_MAP[ptype];
  const isLand = ptype === 'terreno';
  const rate = await getUsdToPyg().catch(() => Number(process.env.PYG_PER_USD) || 7300);
  const price_usd = currency === 'USD' ? Math.round(price) : rate ? Math.round(price / rate) : null;

  // Area required + plausible for buildings (land has no upper cap); price floors
  // match the gate (sale ≥ US$5.000, rent ≥ ₲300.000/mes).
  if (!isLand) {
    if (!(Number(area) > 0)) return NextResponse.json({ error: 'missing_area' }, { status: 400 });
    if (Number(area) < 5 || Number(area) > 2000) return NextResponse.json({ error: 'bad_area' }, { status: 400 });
  }
  if (mode === 'venta') {
    if (!(Number(price_usd) >= 5000)) return NextResponse.json({ error: 'price_too_low' }, { status: 400 });
  } else {
    const pygVal = currency === 'PYG' ? price : Math.round(price * rate);
    if (!(pygVal >= 300000)) return NextResponse.json({ error: 'price_too_low' }, { status: 400 });
  }

  const slug = `${slugify(`${property_type}-${neighborhood}`) || 'propiedad'}-${Date.now().toString(36)}`;
  const coords = await geocode(neighborhood, city);

  const row = {
    slug,
    property_type,
    listing_type: mode === 'alquiler' ? 'rent' : 'sale',
    price,
    currency,
    price_usd,
    price_period: mode === 'alquiler' ? 'monthly' : null,
    address: neighborhood,
    neighborhood,
    city,
    province: 'Central',
    country: 'Paraguay',
    [isLand ? 'land_area' : 'covered_area']: area,
    description: description || null,
    contact_name: contactName,
    contact_phone: contactPhone,
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null,
    status: 'published',
    admin_status: 'active',
    property_status: 'available',
    origin: 'user',
    seller_type: 'owner',
    is_delisted: false,
    created_by: session.uid,   // who published this deal
    posted_by: session.uid,
    raw_data: { published_via: 'buyer-portal', user_id: session.uid, user_email: session.email },
  };

  // Ingest-pipeline parity: give the user listing a canonical zone + dedupe
  // fingerprint (same logic as the scraper), so the scraper dedupe DEFERS to this
  // authoritative owner listing instead of re-adding the same property later.
  const zc = zoneCanonical(row);
  row.zone_canonical = zc;
  row.dedupe_key = dedupeKey(row, zc);

  let created;
  try {
    const res = await insert('properties', row, { returning: 'representation' });
    created = Array.isArray(res) ? res[0] : res;
  } catch (e) {
    return NextResponse.json({ error: 'insert_failed', detail: e?.message || String(e) }, { status: 500 });
  }
  const propertyId = created?.id;

  // Upload photos to B2 and link them. Non-fatal: a listing publishes even if a
  // photo fails to upload.
  const files = form.getAll('photos').filter((f) => f && typeof f.arrayBuffer === 'function' && f.size > 0);
  const images = [];
  let firstUrl = null;
  for (let i = 0; i < files.length && i < 20; i++) {
    const f = files[i];
    try {
      const buf = Buffer.from(await f.arrayBuffer());
      const ext = (f.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const stored = await put(`user-uploads/${slug}/${i}.${ext}`, buf, f.type || 'image/jpeg');
      if (i === 0) firstUrl = stored.url;
      images.push({
        property_id: propertyId,
        source_url: stored.url, // no external source for user uploads — reuse the stored URL (NOT NULL column)
        storage_key: stored.key,
        storage_url: stored.url,
        content_type: stored.contentType,
        bytes: stored.bytes,
        is_feature: i === 0,
        position: i,
      });
    } catch {}
  }

  if (images.length) {
    try { await insert('property_images', images, { returning: 'minimal' }); } catch {}
    if (firstUrl && propertyId) { try { await update('properties', `id=eq.${propertyId}`, { feature_image_url: firstUrl }, { returning: 'minimal' }); } catch {} }
  }

  const ref = `CL-${new Date().getFullYear()}-${String(propertyId || '').replace(/\D/g, '').slice(-5).padStart(5, '0') || '00000'}`;

  // Confirmation email to the owner — fire-and-forget, never blocks publish.
  if (session.email) {
    const site = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
    sendListingPublishedEmail(session.email, {
      name: session.name || contactName,
      title: `${property_type} · ${neighborhood}`,
      ref,
      url: propertyId ? `${site}/propiedad/${propertyId}` : null,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, slug, id: propertyId, ref, images: images.length });
}
