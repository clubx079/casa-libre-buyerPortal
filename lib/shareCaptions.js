// Captions for "share your listing" — pure parts (tests/shareCaptions.test.mjs):
//   listingFacts(l, …)       the few facts a caption needs, from a shaped listing
//   fallbackCaptions(…)      the deterministic captions (used when the AI is off or fails)
//   captionPrompt(…)         the AI prompt (lib/shareCaptionsAi.js sends it to Groq)
//   parseAiCaptions(…)       the AI's JSON → checked captions, gaps filled from the fallback
// The seller is the speaker ("Vendo…", "escribime"). Brand "Casa-Libre". Never a word about
// commissions. Spanish uses voseo like the site. The link of EACH network is its own
// (/l/<code>?c=<channel>), so the AI writes {{link}} and we put the right one in.
import { CAPTION_CHANNELS } from './shareLinks.js';

export const LANGS = ['es', 'en', 'pt'];
export const LINK_TOKEN = '{{link}}';
export const BANNED = /comisi[oó]n|commission|comiss[aã]o|corretaje|brokerage|gratis para siempre|free forever/i;
const MAX = { x: 280, ig: 2000, tt: 2000, fb: 2000, wa: 1000, li: 1500 };

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const ACCENTS = new RegExp('[\\u0300-\\u036f]', 'g');
const camel = (s) => clean(s).normalize('NFD').replace(ACCENTS, '').replace(/[^A-Za-z0-9 ]/g, '')
  .split(' ').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');

// l: a shaped listing (lib/listings.js) — { mode, beds, area, neighborhood, city }.
// typeName: the type in the caption's language ('Casa', 'House'…); price: the price text
// as the site shows it ('US$ 120.000', '' when unknown / unverified).
export function listingFacts(l = {}, { typeName = '', price = '', country = '' } = {}) {
  return {
    rent: l.mode === 'alquiler',
    type: clean(typeName),
    beds: Number(l.beds) > 0 ? Number(l.beds) : 0,
    area: Number(l.area) > 0 ? Math.round(Number(l.area)) : 0,
    zone: clean(l.neighborhood),
    city: clean(l.city),
    price: clean(price),
    country: clean(country),
  };
}

const WORDS = {
  es: {
    verb: (r) => (r ? 'Alquilo' : 'Vendo'), prop: 'propiedad', bed: (n) => `${n} ${n === 1 ? 'dormitorio' : 'dormitorios'}`, in: 'en', with: 'de',
    perMonth: '/mes',
    see: 'Mirá las fotos y la ubicación en Casa-Libre, y escribime directo por WhatsApp:',
    fbAsk: 'Fotos, ubicación y todos los detalles en Casa-Libre. Si te interesa, o conocés a alguien que esté buscando, escribime directo por WhatsApp desde el link 👇',
    igMore: 'Fotos, ubicación y contacto directo por WhatsApp en Casa-Libre 👉',
    short: 'Fotos y contacto directo en Casa-Libre:',
    liLead: (r) => (r ? 'Estoy alquilando' : 'Estoy vendiendo'),
    liAsk: 'Si conocés a alguien que esté buscando, compartilo. ¡Gracias!',
    tags: (r) => (r ? ['Alquiler', 'AlquilerDePropiedades'] : ['VentaDePropiedades', 'Inmuebles']),
    country: 'Inmuebles',
  },
  en: {
    verb: (r) => (r ? 'For rent:' : 'For sale:'), prop: 'property', bed: (n) => `${n} ${n === 1 ? 'bedroom' : 'bedrooms'}`, in: 'in', with: 'with',
    perMonth: '/mo',
    see: 'See the photos and location on Casa-Libre and message me directly on WhatsApp:',
    fbAsk: 'Photos, location and every detail on Casa-Libre. If you are interested, or know someone who is looking, message me directly on WhatsApp from the link 👇',
    igMore: 'Photos, location and direct WhatsApp contact on Casa-Libre 👉',
    short: 'Photos and direct contact on Casa-Libre:',
    liLead: (r) => (r ? "I'm renting out a" : "I'm selling a"),
    liAsk: 'If you know someone who is looking, please share. Thank you!',
    tags: (r) => (r ? ['ForRent', 'RealEstate'] : ['ForSale', 'RealEstate']),
    country: 'RealEstate',
  },
  pt: {
    verb: (r) => (r ? 'Alugo' : 'Vendo'), prop: 'imóvel', bed: (n) => `${n} ${n === 1 ? 'quarto' : 'quartos'}`, in: 'em', with: 'com',
    perMonth: '/mês',
    see: 'Veja as fotos e a localização no Casa-Libre e fale comigo direto pelo WhatsApp:',
    fbAsk: 'Fotos, localização e todos os detalhes no Casa-Libre. Se tiver interesse, ou conhece alguém que esteja procurando, fale comigo direto pelo WhatsApp pelo link 👇',
    igMore: 'Fotos, localização e contato direto pelo WhatsApp no Casa-Libre 👉',
    short: 'Fotos e contato direto no Casa-Libre:',
    liLead: (r) => (r ? 'Estou alugando' : 'Estou vendendo'),
    liAsk: 'Se você conhece alguém que esteja procurando, compartilhe. Obrigado!',
    tags: (r) => (r ? ['Aluguel', 'Imoveis'] : ['ImoveisAVenda', 'Imoveis']),
    country: 'Imoveis',
  },
};

const wordsOf = (lang) => WORDS[LANGS.includes(lang) ? lang : 'es'];

// "Casa de 3 dormitorios en Villa Morra, Asunción"
export function headlineBody(f, lang = 'es') {
  const w = wordsOf(lang);
  const type = f.type || w.prop;
  const beds = f.beds ? ` ${w.with} ${w.bed(f.beds)}` : '';
  const where = [...new Set([f.zone, f.city].filter(Boolean))].join(', ') || f.country;
  return `${type}${beds}${where ? ` ${w.in} ${where}` : ''}`;
}
// "Vendo Casa de 3 dormitorios en Villa Morra, Asunción"
export const headline = (f, lang = 'es') => `${wordsOf(lang).verb(f.rent)} ${headlineBody(f, lang)}`;

const priceLine = (f, lang) => (f.price ? `${f.price}${f.rent ? wordsOf(lang).perMonth : ''}` : '');

// Instagram / TikTok hashtags: the brand, the city, the area, the operation, the type, the country.
export function hashtags(f, lang = 'es', max = 6) {
  const w = wordsOf(lang);
  const tags = ['CasaLibre', camel(f.city), camel(f.zone), ...w.tags(f.rent), camel(f.type), f.country ? `${w.country}${camel(f.country)}` : '']
    .filter((t) => t && t.length >= 3);
  return [...new Set(tags)].slice(0, max).map((t) => `#${t}`).join(' ');
}

// Lines joined: empty values dropped, BR = one blank line between blocks.
const BR = Symbol('br');
const lines = (...xs) => xs
  .filter((x) => x === BR || (typeof x === 'string' && x))
  .map((x) => (x === BR ? '' : x))
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

// X counts any link as 23 characters; keep the text so text + space + link ≤ 280.
function fitX(text, link) {
  const room = MAX.x - 24;
  const t = text.length > room ? `${text.slice(0, room - 1).trimEnd()}…` : text;
  return `${t} ${link}`.trim();
}

// The deterministic captions → { ig, fb, wa, x, tt, li }, each with its own link.
// links: { ig, fb, wa, x, tt, li, copy } (lib/shareLinks.js shareLinks)
export function fallbackCaptions(f, links = {}, lang = 'es') {
  const w = wordsOf(lang);
  const h = headline(f, lang);
  const p = priceLine(f, lang);
  const area = f.area ? `${f.area} m²` : '';
  const L = (c) => links[c] || links.copy || '';
  return {
    wa: lines(`🏡 *${h}*`, p, BR, w.see, L('wa')),
    fb: lines(`🏡 ${h}${p ? ` · ${p}` : ''}`, BR, w.fbAsk, L('fb')),
    ig: lines(`🏡 ${h}`, p && `💰 ${p}`, area && `📐 ${area}`, BR, `${w.igMore} ${L('ig')}`, BR, hashtags(f, lang)),
    tt: `${h} 🏡${p ? ` ${p}.` : ''} ${w.short} ${L('tt')} ${hashtags(f, lang, 4)}`.trim(),
    x: fitX(`${h}${p ? ` · ${p}` : ''}. ${w.short}`, L('x')),
    li: lines(`${w.liLead(f.rent)} ${headlineBody(f, lang)}${p ? ` (${p})` : ''}.`, `${w.short} ${L('li')}`, BR, w.liAsk),
  };
}

// ── AI ───────────────────────────────────────────────────────────────────────────────
const LANG_NAME = { es: 'Spanish with voseo, like Paraguay and Uruguay ("mirá", "escribime", "tenés")', en: 'English', pt: 'Brazilian Portuguese' };

export function captionPrompt(f, lang = 'es') {
  const facts = [
    `operation: ${f.rent ? 'for rent' : 'for sale'}`,
    f.type && `type: ${f.type}`,
    f.beds && `bedrooms: ${f.beds}`,
    f.area && `area: ${f.area} m²`,
    f.zone && `neighborhood: ${f.zone}`,
    f.city && `city: ${f.city}`,
    f.country && `country: ${f.country}`,
    f.price && `price: ${f.price}${f.rent ? ' per month' : ''}`,
  ].filter(Boolean).join('\n');
  const system = `You write short social media posts for a property owner who is sharing their own listing on Casa-Libre (a real estate marketplace; buyers contact the owner directly on WhatsApp).
Write in ${LANG_NAME[lang] || LANG_NAME.es}, first person (the owner speaks), warm and plain. Use ONLY the facts given; never invent features, never mention commissions, fees or agents, never state a price that is not given.
Name the brand in every post, written exactly "Casa-Libre" (for example "en Casa-Libre"). Put the placeholder {{link}} exactly once in every post, where the reader should click.${lang === 'es' ? '\nVocabulary: "dormitorios" (never "recámaras" or "habitaciones"), "departamento" (never "piso"), "alquiler", "venta". No slang.' : ''}
Hashtags are written without accents or spaces (#Asuncion, not #Asunción).
Example of the tone (WhatsApp):
${fallbackCaptions(f, { wa: LINK_TOKEN }, lang).wa}
Return ONLY a JSON object with these keys:
"ig": Instagram post, 2-5 short lines with 1-3 emojis, then a blank line and 4-6 relevant hashtags (#CasaLibre first, plus city and property hashtags, no spaces inside a hashtag).
"tt": TikTok caption, one or two lines and 3-4 hashtags.
"fb": Facebook post, 2-4 lines, ask friends to share if they know someone looking.
"wa": WhatsApp message, 2-4 lines, the headline in *bold* with asterisks.
"x": X post, max 200 characters before the link, no hashtags except #CasaLibre.
"li": LinkedIn post, 2-3 professional lines.`;
  return { system, user: `Listing facts:\n${facts}` };
}

// The model's answer (a JSON string, maybe wrapped in ``` fences) → captions with the right
// links, or null when nothing usable came back. A caption that breaks a rule (the link
// placeholder twice, a banned word, too long) is replaced by the fallback one.
export function parseAiCaptions(text, { links = {}, fallback = {} } = {}) {
  if (!text) return null;
  let obj;
  try {
    const raw = String(text);
    obj = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  } catch { return null; }
  if (!obj || typeof obj !== 'object') return null;
  const out = {};
  let good = 0;
  for (const c of CAPTION_CHANNELS) {
    const v = typeof obj[c] === 'string' ? obj[c].replace(/\r\n?/g, '\n').trim() : '';
    const link = links[c] || links.copy || '';
    const n = v.split(LINK_TOKEN).length - 1;
    let s = v && !BANNED.test(v) && n <= 1 ? (n === 1 ? v.replace(LINK_TOKEN, link) : `${v}\n${link}`) : '';
    // the brand with its hyphen (a #CasaLibre hashtag stays as it is)
    s = s.replace(/(^|[^#\w])Casa ?Libre\b/g, '$1Casa-Libre');
    // hashtags without accents (#Asunción → #Asuncion)
    s = s.replace(/#[^\s#]+/g, (h) => h.normalize('NFD').replace(ACCENTS, ''));
    // every post names the brand (a hashtag alone doesn't count)
    if (s && !/(^|[^#])Casa-Libre/.test(s)) s = '';
    if (s && c === 'x' && s.replace(link, '').length + 23 > MAX.x) s = '';
    if (s && s.length > MAX[c]) s = '';
    if (s) { out[c] = s; good++; } else if (fallback[c]) out[c] = fallback[c];
  }
  return good ? out : null;
}
