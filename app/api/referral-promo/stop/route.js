// /api/referral-promo/stop?token=… — the "Para no recibir más estos correos" link in the
// referral-program promo email (lib/automations/referralPromo.js). The signed token names
// the person (purpose 'refpromo_stop', valid a year).
//   GET  → a small page asking to confirm (a link scanner opening the link changes nothing)
//   POST → records the opt-out (email_log event refpromo-stop:<user id>:ev); no more of
//          these emails go to that person. Idempotent.
import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { verifyRenewToken } from '@/lib/promoToken';
import { COUNTRY } from '@/lib/country';
import { stopPromo } from '@/lib/automations/referralPromo';
import { PROMO_STOP_PURPOSE } from '@/lib/referrals/promo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE = (process.env.APP_PUBLIC_URL || COUNTRY.defaultUrl).replace(/\/$/, '');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page({ title, body, form }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex"/><title>${esc(title)}</title></head>
  <body style="margin:0;background:#f9f4ee;font-family:'Space Grotesk',Helvetica,Arial,sans-serif;color:#111">
    <div style="max-width:460px;margin:8vh auto;padding:0 20px">
      <div style="font-size:22px;font-weight:700;letter-spacing:-0.03em;margin-bottom:22px">casa-libre<span style="font-style:italic">${esc(COUNTRY.tld)}</span></div>
      <div style="background:#fff;border:1.5px solid rgba(17,17,17,.12);border-radius:20px;padding:28px 26px">
        <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em">${esc(title)}</div>
        <div style="font-size:14px;color:rgba(17,17,17,.65);margin-top:10px;line-height:1.6">${body}</div>
        ${form ? `<form method="post" style="margin-top:20px"><input type="hidden" name="token" value="${esc(form.token)}"/><button type="submit" style="border:0;cursor:pointer;background:#111;color:#f9f4ee;font-size:14px;font-weight:600;padding:12px 22px;border-radius:999px">${esc(form.label)}</button></form>` : `<div style="margin-top:20px"><a href="${esc(SITE)}" style="display:inline-block;background:#111;color:#f9f4ee;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:999px">Ir a Casa-Libre</a></div>`}
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:rgba(17,17,17,.4);margin-top:16px">Casa-Libre — ${esc(COUNTRY.name)}</div>
    </div>
  </body></html>`;
}
const html = (s, status = 200) => new NextResponse(s, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
const claimOf = (token) => { const c = verifyRenewToken(token); return c && c.purpose === PROMO_STOP_PURPOSE ? c : null; };
const invalid = () => html(page({ title: 'Enlace no válido', body: 'Este enlace venció o no es válido.' }), 400);

export async function GET(req) {
  const token = new URL(req.url).searchParams.get('token');
  if (!claimOf(token)) return invalid();
  return html(page({
    title: 'Dejar de recibir estos correos',
    body: 'Vas a dejar de recibir los correos sobre el programa de referidos de Casa-Libre (invitar a otros a publicar). Tu cuenta y tus publicaciones no cambian.',
    form: { token, label: 'No recibir más estos correos' },
  }));
}

export async function POST(req) {
  const form = await req.formData().catch(() => null);
  const token = form?.get('token') || new URL(req.url).searchParams.get('token');
  const claim = claimOf(String(token || ''));
  if (!claim) return invalid();
  const [user] = await db.select('users', `select=id,email&id=eq.${encodeURIComponent(claim.uid)}&limit=1`).catch(() => []);
  try {
    await stopPromo(db, user || { id: claim.uid, email: '-' });
  } catch {
    return html(page({ title: 'No pudimos guardarlo', body: 'Probá de nuevo en unos minutos.' }), 500);
  }
  return html(page({ title: 'Listo', body: 'No vas a recibir más correos sobre el programa de referidos de Casa-Libre.' }));
}
