// AI photo check for listings published by real users (the sell wizard). Every photo
// goes to a Groq vision model (Groq, as in DeelMap's seller portal; its llama-4-scout is
// no longer offered, so qwen3.8 — GROQ_VISION_MODEL overrides), shrunk to 512px JPEG,
// with a PASS / FAIL prompt.
//
// What fails: 18+ / sexual content, violence or gore, hateful or abusive content, and
// photos that clearly have nothing to do with a property. Property content is judged
// LOOSELY on purpose: rooms, furniture, appliances, decor, gardens, streets and roads,
// views, plans, maps, renders… all pass, and "when unsure, pass".
//
// Never throws. Returns { verdict: 'pass' } | { verdict: 'fail', category } |
// { verdict: 'error', error } — an error (no key, service down, odd answer) means
// "ask again later", never "let it through" (lib/listingScan.js retries).
import 'server-only';
import sharp from 'sharp';
import { parseVerdict } from './scanVerdict';
import { groqFetch } from './aiUsage';
import { parseProfileVerdict } from './profilePhoto';
import { KIND_PROMPT, parseKind } from './profilePhotoKind';

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';

const PROMPT = `You check photos uploaded to a real-estate listing website (houses, apartments, land, offices for sale or rent).
Reply with exactly one line:
PASS
or
FAIL: <category>
Use FAIL only when the photo clearly is one of these:
- adult: nudity or sexual content
- violence: violence, gore, injuries, weapons aimed at people
- hate: hateful, abusive or offensive symbols, gestures or text
- unrelated: has nothing to do with a property, e.g. a selfie or portrait where the person is the subject, a meme, a screenshot of unrelated content, a random object
Be lenient about property content. These all PASS: any room or interior element (furniture, kitchen, bathroom, appliances, decor, wardrobes, windows, floors), building exteriors and facades, gardens, pools, garages, balconies, terraces, views, streets, roads and the neighbourhood, empty lots and land, construction work, floor plans, maps, renders, and documents about the property. People who just happen to appear in a property photo also PASS.
When unsure, reply PASS.`;
// For a STORED copy, which has the site's mascot stamped on it (lib/stampLogo.js: a big faint
// cartoon house in the middle) — the model otherwise judges the mascot. Originals are checked
// whenever we still have them (lib/listingScan.js), since the stamp can still hide a dim photo.
const STAMPED = `
Every photo carries the website's own watermark: a large, faint cartoon house mascot (a house with a face, arms and legs) over the middle of the image. Ignore that watermark completely and judge only the photo underneath it.`;

// Seller profile photos (lib/profilePhotoScan.js): the seller's face, their company / agency
// logo, or any other normal professional image. Same model and call as listing photos; only
// clearly inappropriate or unrelated images fail, and the failure says why.
const PROFILE_PROMPT = `You check PROFILE PICTURES that sellers and real-estate agents upload to a property website. Buyers see the picture next to the seller's name. It may be a photo of the person OR the logo of their company or real-estate agency.
Reply with exactly one line:
PASS
or
FAIL: <category>
Reply PASS for any normal profile picture. All of these PASS: a photo of a person (selfie, headshot, portrait, half or full body, with glasses, hats, uniforms or work clothes, any background, any age or skin tone, old or black-and-white, other people around them); a company, agency, brand or real-estate logo of any shape or colour, with or without text; a business card, banner or sign with a company name; a drawn or illustrated avatar of a person; a team or office photo; a house, building or property photo. When unsure, reply PASS.
Reply FAIL only when the picture clearly is one of these (use the first that fits):
- adult: nudity, underwear, sexual or sexually suggestive content (18+)
- violence: violence, gore, blood, injuries, or weapons being shown off or used
- hate: hateful, extremist or offensive symbols, gestures or text
- junk: clearly unrelated junk with no professional use: a meme or joke picture, a screenshot of a chat, a social-media post or a block of text, or a random everyday object, food or pet on its own`;

// One image + one prompt → the model's one-line answer, parsed by `parse`. Never throws.
// feature/ref go to the AI usage log (lib/aiUsage.js).
async function askVision(bytes, prompt, parse, { feature = 'listing_photo_check', ref = null } = {}) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { verdict: 'error', error: 'no_groq_key' };
  let dataUrl;
  try {
    const jpg = await sharp(bytes).rotate().resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    dataUrl = `data:image/jpeg;base64,${jpg.toString('base64')}`;
  } catch (e) {
    return { verdict: 'error', error: `unreadable_image: ${e?.message || e}`.slice(0, 200) };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await groqFetch({ feature, ref })(ENDPOINT, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 40,
        reasoning_effort: 'none',   // a one-word verdict; no step-by-step
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }],
      }),
    });
    if (!res.ok) return { verdict: 'error', error: `groq_http_${res.status}` };
    const j = await res.json();
    return parse(j?.choices?.[0]?.message?.content);
  } catch (e) {
    return { verdict: 'error', error: e?.name === 'AbortError' ? 'groq_timeout' : String(e?.message || e).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

// ref = what the check was for (the listing), kept in the AI usage log
export async function scanImage(bytes, { stamped = false, ref = null } = {}) {
  return askVision(bytes, stamped ? PROMPT + STAMPED : PROMPT, parseVerdict, { ref });
}

// { verdict: 'pass' } | { verdict: 'fail', category } (lib/profilePhoto.js PROFILE_FAIL_CATEGORIES)
// | { verdict: 'error', error } — an error means "ask again later", never "approve".
export async function scanProfileImage(bytes, { ref = null } = {}) {
  return askVision(bytes, PROFILE_PROMPT, parseProfileVerdict, { feature: 'profile_photo_check', ref });
}

// What an approved profile photo shows: { verdict: 'pass', kind: 'face' | 'logo' | 'other' } or
// { verdict: 'error', error } (ask again later). Used by the "Show your face" automation
// (lib/automations/photoFace.js) — never to approve or reject a photo.
export async function classifyProfileImage(bytes, { ref = null } = {}) {
  return askVision(bytes, KIND_PROMPT, (text) => {
    const kind = parseKind(text);
    return kind ? { verdict: 'pass', kind } : { verdict: 'error', error: `unclear_kind: ${String(text || '').slice(0, 60)}` };
  }, { feature: 'profile_photo_kind', ref });
}
