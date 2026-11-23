// GET /api/listings/<id>/share-image?format=story|square|og[&lang=es|en|pt]
// The listing's ready-made social image (next/og, layout in lib/shareImageCard.js): its main
// photo, the price as the site shows it (US$ + ≈ local currency), type + bedrooms + m², area /
// barrio + city, the Casa-Libre brand, the short link (/l/<code>) and — on story / square — a
// QR code of that link (?c=qr).
//   story  1080×1920 (Instagram / Facebook / WhatsApp status)   square 1080×1080 (posts)
//   og     1200×630  (the listing page's Open Graph / Twitter image — link previews)
// Cached: a day in the browser / CDN, a week stale-while-revalidate; the share kit adds a
// version (?v=) that changes with the price / photo, and the rendered PNG is kept in memory.
// Note: next/og fails to load its bundled font on WINDOWS production builds (a Next bug,
// fine on the Linux servers); scripts/share-image-preview.mjs renders the same card locally.
import { ImageResponse } from 'next/og';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { getListing } from '@/lib/listings';
import { publicOrigin } from '@/lib/publicOrigin';
import { COUNTRY } from '@/lib/country';
import { typeLabel } from '@/lib/propertyType';
import { fmtUsd, fmtPyg, isUnverified } from '@/lib/ui';
import { tr } from '@/lib/i18n';
import { shareCode, shareUrl, channelOf, isShareCode } from '@/lib/shareLinks';
import { shareCard, SIZES, photoBox } from '@/lib/shareImageCard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800';
const readPublic = (p) => fs.readFileSync(path.join(process.cwd(), 'public', p));

let FONTS;
function shareFonts() {
  if (FONTS) return FONTS;
  try {
    const dir = path.join(process.cwd(), 'lib', 'fonts');
    FONTS = [
      { name: 'Space Grotesk', data: fs.readFileSync(path.join(dir, 'SpaceGrotesk-Medium.ttf')), weight: 500, style: 'normal' },
      { name: 'Space Grotesk', data: fs.readFileSync(path.join(dir, 'SpaceGrotesk-Bold.ttf')), weight: 700, style: 'normal' },
    ];
  } catch { FONTS = undefined; }
  return FONTS;
}
let LOGO;
const logo = async () => (LOGO ||= `data:image/png;base64,${(await sharp(readPublic('logo.png')).resize(160, 160).png().toBuffer()).toString('base64')}`);

// the photo, cropped to the box, as a JPEG data URL (satori can't read webp)
async function photo(l, origin, w, h) {
  let buf = null;
  if (l.image && !l.no_photo) {
    try {
      const url = /^https?:/i.test(l.image) ? l.image : `${origin}${l.image.startsWith('/') ? '' : '/'}${l.image}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (r.ok) buf = Buffer.from(await r.arrayBuffer());
    } catch { buf = null; }
  }
  if (!buf) { try { buf = readPublic('no-photo/casa-libre-sin-foto-1200x900.jpg'); } catch { return null; } }
  try {
    const out = await sharp(buf).rotate().resize(w, h, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } catch { return null; }
}

export async function GET(req, { params }) {
  const sp = new URL(req.url).searchParams;
  const format = SIZES[sp.get('format')] ? sp.get('format') : 'og';
  const lang = ['es', 'en', 'pt'].includes(sp.get('lang')) ? sp.get('lang') : 'es';
  const l = await getListing(String(params?.id || ''));
  if (!l) return new Response('not found', { status: 404 });
  const origin = publicOrigin(req);
  // the picture's QR = the tracked link of the network it is posted on, and who shared it
  // (?c=ig&s=<sharer>; the app's Instagram button asks for it) — default: the QR channel
  const qrChannel = sp.get('c') ? channelOf(sp.get('c')) : 'qr';
  const sharer = isShareCode(String(sp.get('s') || '')) ? String(sp.get('s')) : null;

  const memo = (globalThis.__clShareImg ||= new Map());
  const key = [l.id, format, lang, l.usd, l.image, l.type, l.beds, l.area, l.neighborhood, l.city, l.mode, origin, qrChannel, sharer].join('|');
  const hit = memo.get(key);
  if (hit) return new Response(hit, { headers: { 'Content-Type': 'image/png', 'Cache-Control': CACHE } });

  const [W, H] = SIZES[format];
  const [photoW, photoH] = photoBox(format);
  const rent = l.mode === 'alquiler';
  const per = rent ? tr(lang, '/mes', '/mo', '/mês') : '';
  const noPrice = isUnverified(l, 'price') || l.usd == null;
  const beds = l.beds ? ` · ${l.beds} ${tr(lang, l.beds === 1 ? 'dormitorio' : 'dormitorios', l.beds === 1 ? 'bedroom' : 'bedrooms', l.beds === 1 ? 'quarto' : 'quartos')}` : '';
  const [img, brandLogo] = await Promise.all([photo(l, origin, photoW, photoH), logo()]);
  const tree = shareCard({
    format, W, H, photoW, photoH, img, logo: brandLogo, tld: COUNTRY.tld, noPrice,
    op: rent ? tr(lang, 'En alquiler', 'For rent', 'Para alugar') : tr(lang, 'En venta', 'For sale', 'À venda'),
    price: noPrice ? tr(lang, 'Consultá el precio', 'Ask for the price', 'Consulte o preço') : `${fmtUsd(l.usd, lang)}${per}`,
    local: !noPrice && fmtPyg(l.pyg, lang) ? `≈ ${fmtPyg(l.pyg, lang)}${per}` : '',
    title: `${typeLabel(l.type, lang) || tr(lang, 'Propiedad', 'Property', 'Imóvel')}${beds}${l.area ? ` · ${Math.round(l.area)} m²` : ''}`,
    place: [...new Set([l.neighborhood, l.city].filter(Boolean))].join(', ') || COUNTRY.name,
    shortLink: `${origin.replace(/^https?:\/\//, '')}/l/${shareCode(l.id)}`,
    qrLink: shareUrl(origin, l.id, qrChannel, sharer),
    scan: tr(lang, 'Escaneá para ver fotos y escribir al dueño', 'Scan to see the photos and message the owner', 'Escaneie para ver as fotos e falar com o dono'),
  });

  const res = new ImageResponse(tree, { width: W, height: H, fonts: shareFonts() });
  const png = Buffer.from(await res.arrayBuffer());
  memo.set(key, png);
  if (memo.size > 300) memo.delete(memo.keys().next().value);
  return new Response(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': CACHE } });
}
