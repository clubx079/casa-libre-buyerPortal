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

export async function scanImage(bytes, { stamped = false } = {}) {
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
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 40,
        reasoning_effort: 'none',   // a one-word verdict; no step-by-step
        messages: [{ role: 'user', content: [{ type: 'text', text: stamped ? PROMPT + STAMPED : PROMPT }, { type: 'image_url', image_url: { url: dataUrl } }] }],
      }),
    });
    if (!res.ok) return { verdict: 'error', error: `groq_http_${res.status}` };
    const j = await res.json();
    return parseVerdict(j?.choices?.[0]?.message?.content);
  } catch (e) {
    return { verdict: 'error', error: e?.name === 'AbortError' ? 'groq_timeout' : String(e?.message || e).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}
