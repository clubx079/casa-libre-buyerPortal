// The share kit of one listing (server): links, captions (AI with a template fallback,
// cached per listing + language) and the image URLs. Used by /api/listings/<id>/share,
// the app's /api/mobile/listings/<id>/share and the /compartir/<id> page.
import 'server-only';
import { unstable_cache } from 'next/cache';
import { createHash } from 'node:crypto';
import * as db from './db';
import { COUNTRY } from './country';
import { typeLabel } from './propertyType';
import { fmtUsd, isUnverified } from './ui';
import { groqFetch } from './aiUsage';
import { shareLinks, shareCode } from './shareLinks';
import { listingFacts, fallbackCaptions, captionPrompt, parseAiCaptions, LANGS } from './shareCaptions';

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

export const priceText = (l, lang = 'es') => (l && l.usd != null && !isUnverified(l, 'price') ? fmtUsd(l.usd, lang) : '');
export const factsOf = (l, lang = 'es') => listingFacts(l, { typeName: typeLabel(l.type, lang) || '', price: priceText(l, lang), country: COUNTRY.name });

// → the model's raw answer, or throws (so unstable_cache never keeps a failure)
async function askAi(factsJson, lang) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('no_ai');
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const { system, user } = captionPrompt(JSON.parse(factsJson), lang);
  const reasoning = /gpt-oss|qwen/i.test(model);
  const body = {
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    temperature: 0.6,
    max_tokens: 1400 + (reasoning ? 1024 : 0),
    response_format: { type: 'json_object' },
  };
  if (reasoning) body.reasoning_effort = 'low';
  const res = await groqFetch({ feature: 'share_captions' })(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`groq_${res.status}`);
  const data = await res.json();
  const choice = data?.choices?.[0];
  if (!choice || choice.finish_reason === 'length') throw new Error('ai_cut');
  const text = String(choice.message?.content || '');
  // only an answer that parses is cached
  if (!parseAiCaptions(text, { links: { copy: 'x' } })) throw new Error('ai_unusable');
  return text;
}
// cached by the facts' hash + language: a price or title change makes new captions
const cachedAi = unstable_cache(async (_id, _hash, factsJson, lang) => askAi(factsJson, lang), ['share-captions-v2'], { revalidate: 30 * 86400 });

// → { captions, source: 'ai' | 'template' }
export async function captionsFor(l, links, lang = 'es') {
  const lg = LANGS.includes(lang) ? lang : 'es';
  const f = factsOf(l, lg);
  const fallback = fallbackCaptions(f, links, lg);
  try {
    const factsJson = JSON.stringify(f);
    const hash = createHash('sha1').update(factsJson).digest('hex').slice(0, 16);
    const text = await cachedAi(String(l.id), hash, factsJson, lg);
    const ai = parseAiCaptions(text, { links, fallback });
    if (ai) return { captions: ai, source: 'ai' };
  } catch { /* AI off / failed → template */ }
  return { captions: fallback, source: 'template' };
}

export const imageUrls = (origin, id, v = '') => {
  const base = `${String(origin).replace(/\/$/, '')}/api/listings/${encodeURIComponent(id)}/share-image`;
  const ver = v ? `&v=${encodeURIComponent(v)}` : '';
  return { story: `${base}?format=story${ver}`, square: `${base}?format=square${ver}`, og: `${base}?format=og${ver}` };
};

// The version tag of the images: changes when what they show changes (price, photo, title).
export const imageVersion = (l) => createHash('sha1').update(JSON.stringify([l.usd, l.image, l.type, l.beds, l.neighborhood, l.city, l.mode])).digest('hex').slice(0, 8);

// The owner + state of a listing (the shaped listing has no owner).
export async function listingOwner(id) {
  const [row] = await db.select('properties', `select=id,created_by,status,admin_status,origin&id=eq.${encodeURIComponent(id)}&limit=1`).catch(() => []);
  return row || null;
}

export async function buildShareKit(l, { origin, lang = 'es', langs = null } = {}) {
  const links = shareLinks(origin, l.id);
  const { captions, source } = await captionsFor(l, links, 'es');
  const out = { code: shareCode(l.id), links, captions, captionSource: source, images: imageUrls(origin, l.id, imageVersion(l)) };
  // other languages, when asked (?lang=en / ?lang=pt / ?lang=all)
  const extra = (langs || [lang]).filter((x) => x !== 'es' && LANGS.includes(x));
  if (extra.length) {
    out.captionsI18n = { es: captions };
    for (const x of extra) out.captionsI18n[x] = (await captionsFor(l, links, x)).captions;
  }
  return out;
}
