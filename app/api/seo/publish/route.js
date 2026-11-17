// POST /api/seo/publish — called by the admin's SEO pipeline after it changed seo_overrides or
// published a guide: re-read the SEO data now (cache tag 'seo') and ping Bing IndexNow for the changed
// URLs (lib/indexnow.js skips localhost). Auth: Bearer SEO_PUBLISH_SECRET (or CRON_SECRET).
// Body: { urls: ['/alquiler/departamentos/asuncion/baratos', …], indexNow?: boolean }
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { submitToIndexNow } from '@/lib/indexnow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const secret = process.env.SEO_PUBLISH_SECRET || process.env.CRON_SECRET;
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!secret || token !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body = {};
  try { body = await req.json(); } catch { /* empty */ }
  const urls = (Array.isArray(body.urls) ? body.urls : []).map(String).filter((u) => u.startsWith('/')).slice(0, 200);
  revalidateTag('seo');
  const indexNow = body.indexNow === false || !urls.length ? { skipped: true } : await submitToIndexNow([...urls, '/sitemap.xml']);
  return NextResponse.json({ ok: true, revalidated: 'seo', urls: urls.length, indexNow });
}
