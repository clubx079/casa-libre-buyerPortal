// ONE cron job for every automation in every country. Call it hourly:
//   POST https://casa-libre.com.py/api/cron/tick   Authorization: Bearer <CRON_TICK_SECRET>
// It runs this site's due jobs (lib/cronJobs.js) — each as its own request to the
// site's existing /api/cron/<job> route, so each keeps its own time budget and one
// failure doesn't stop the others — and passes the call on to every other country
// site (lib/country.js profiles) with ?scope=self, so they do the same for their own
// database. Any site can be the one the cron calls. ?jobs=all runs every job now.
//
// CRON_TICK_SECRET must be the same on every country site (it's what one site uses
// to call another); each site's own CRON_SECRET is also accepted here.
import { NextResponse } from 'next/server';
import { COUNTRY, ALL_COUNTRIES } from '@/lib/country';
import { CRON_JOBS, dueJobs, otherSites } from '@/lib/cronJobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Report what finished within this window; anything slower keeps running on its own.
const WAIT_MS = 20000;

function authorized(req) {
  const h = req.headers.get('authorization') || '';
  const is = (s) => !!s && h === `Bearer ${s}`;
  return is(process.env.CRON_TICK_SECRET) || is(process.env.CRON_SECRET);
}

function call(url, secret) {
  const done = fetch(url, { method: 'POST', headers: secret ? { Authorization: `Bearer ${secret}` } : {}, cache: 'no-store' })
    .then(async (r) => ({ status: r.status, result: (await r.text()).slice(0, 400) }))
    .catch((e) => ({ status: 0, error: String(e?.message || e).slice(0, 200) }));
  return Promise.race([done, new Promise((res) => setTimeout(() => res({ status: 'running' }), WAIT_MS))]);
}

async function handle(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const site = (process.env.APP_PUBLIC_URL || url.origin).replace(/\/$/, '');
  const force = url.searchParams.get('jobs') === 'all';
  const passOn = url.searchParams.get('scope') !== 'self';
  const jobs = force ? CRON_JOBS : dueJobs(new Date());
  const tickSecret = process.env.CRON_TICK_SECRET || '';

  const own = jobs.map((j) => call(`${site}${j.path}`, process.env.CRON_SECRET || '').then((r) => [j.name, r]));
  const others = (passOn ? otherSites(ALL_COUNTRIES, COUNTRY.code) : []).map((c) => (tickSecret
    ? call(`${c.url}/api/cron/tick?scope=self${force ? '&jobs=all' : ''}`, tickSecret)
    : Promise.resolve({ status: 'skipped', error: 'CRON_TICK_SECRET is not set on this site' })
  ).then((r) => [c.code, r]));

  const [jobRes, siteRes] = await Promise.all([Promise.all(own), Promise.all(others)]);
  return NextResponse.json({
    ok: true,
    country: COUNTRY.code,
    at: new Date().toISOString(),
    jobs: Object.fromEntries(jobRes),
    ...(passOn ? { countries: Object.fromEntries(siteRes) } : {}),
  });
}

export async function GET(req) { return handle(req); }
export async function POST(req) { return handle(req); }
