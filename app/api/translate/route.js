// POST /api/translate { id, target: 'es' | 'en' } → { text }
// The "Translate" button under a listing description — website property page and
// the mobile app. Only translates the description of a live listing (looked up by
// id), never text sent by the caller. See lib/translate.js (Groq, cache, limits).
import { NextResponse } from 'next/server';
import { getListing } from '@/lib/listings';
import { getClientIP } from '@/lib/ip';
import { TARGETS, cleanDescription, translateText, createCache, createLimiter } from '@/lib/translate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cache = createCache(2000);
// Cached answers are free; each visitor gets 20 new translations per 10 minutes.
const limiter = createLimiter({ max: 20, windowMs: 10 * 60 * 1000 });

const reply = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch { b = {}; }
  const id = String(b?.id || '').trim();
  const target = String(b?.target || '');
  if (!id || id.length > 120 || !TARGETS[target]) return reply({ error: 'bad_request' }, 400);

  const l = await getListing(id).catch(() => null);
  const text = cleanDescription(l?.description);
  if (!text) return reply({ error: 'not_found' }, 404);

  const hit = cache.get(text, target);
  if (hit) return reply({ text: hit });
  if (!process.env.GROQ_API_KEY) return reply({ error: 'not_configured' }, 503);
  if (!limiter.allow(getClientIP(req))) return reply({ error: 'rate_limited' }, 429);

  const out = await translateText(text, target);
  if (!out) return reply({ error: 'failed' }, 502);
  cache.set(text, target, out);
  return reply({ text: out });
}
