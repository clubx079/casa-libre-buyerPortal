// /api/account/user-type — "¿Sos vendedor o comprador?" (lib/userType.js, migration 023).
//   GET                         → { user_type, ask }   (ask = show the question now)
//   POST { type, source? }      → stores it for the signed-in account. Only fills an EMPTY
//                                 type (a sell-funnel seller is never turned into a buyer by
//                                 a stray tap); { change: true } replaces it (a settings
//                                 switch later). source: signup_choice (default, the question
//                                 after sign-up) | login_choice (picked on the log-in screen)
//                                 | app_sell (the app's Sell/Publish sign-in).
// Used by the website (AuthModal / UserTypePrompt) and the mobile app (cookie session).
// Before the migration runs: GET says ask:false, POST answers { ok:false, error:'not_set_up' }.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/users';
import { normalizeUserType, shouldAskUserType } from '@/lib/userType';
import { setUserType } from '@/lib/userTypeStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SOURCES = new Set(['signup_choice', 'login_choice', 'app_sell']);
const fail = (error, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function GET() {
  const s = getSession();
  if (!s?.uid) return fail('unauthorized', 401);
  const u = await getUserById(s.uid).catch(() => null);
  if (!u) return fail('unauthorized', 401);
  return NextResponse.json({ ok: true, user_type: normalizeUserType(u.user_type), ask: shouldAskUserType(u) });
}

export async function POST(req) {
  const s = getSession();
  if (!s?.uid) return fail('unauthorized', 401);
  const body = await req.json().catch(() => ({}));
  const type = normalizeUserType(body.type);
  if (!type) return fail('invalid_type');
  const source = SOURCES.has(body.source) ? body.source : 'signup_choice';

  const u = await getUserById(s.uid).catch(() => null);
  if (!u || u.blocked || u.suspended || u.active === false) return fail('unauthorized', 401);
  if (!Object.prototype.hasOwnProperty.call(u, 'user_type')) return fail('not_set_up', 503);

  const current = normalizeUserType(u.user_type);
  if (current && body.change !== true) return NextResponse.json({ ok: true, user_type: current, changed: false });

  const row = await setUserType(u.id, type, source, { onlyIfEmpty: body.change !== true });
  if (!row) {
    // a parallel request filled it first → report what is stored
    const again = await getUserById(s.uid).catch(() => null);
    return NextResponse.json({ ok: true, user_type: normalizeUserType(again?.user_type), changed: false });
  }
  return NextResponse.json({ ok: true, user_type: row.user_type, changed: true });
}
