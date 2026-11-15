// GET   /api/account/profile — the signed-in user's profile (Settings).
// PATCH /api/account/profile { full_name, phone } — update the user's profile, or
//       { first_name, last_name, job_title, company_name, company_website } — the
//       "Perfil profesional" (lib/sellerProfile.js; full_name is rebuilt from first + last).
//       400 { error: 'invalid', fields: { field: code } } on validation errors. Before
//       migration 022 the new columns don't exist: full_name alone is saved and the answer
//       says { ok: true, pending_migration: true }.
import { NextResponse } from 'next/server';
import { getSession, setSessionCookie } from '@/lib/auth';
import { getUserById, publicUser } from '@/lib/users';
import { update } from '@/lib/db';
import { validateProfile, formValues, isMissingColumnError } from '@/lib/sellerProfile';
import { invalidateSellerProfiles } from '@/lib/sellerPhotos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const u = await getUserById(s.uid);
  if (!u) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({
    full_name: u.full_name || '', phone: u.phone || '', email: u.email, has_password: !!u.password_hash, auth_provider: u.auth_provider || 'email',
    // How this person proves who they are (Settings → "Cómo ingresás")
    phone_verified: !!u.phone_verified_at, email_confirmed: u.auth_provider !== 'whatsapp',
    // "Perfil profesional": saved values, or full_name split when never saved
    ...formValues(u),
  });
}

async function saveProfessional(uid, body) {
  const { patch, errors } = validateProfile(body);
  if (Object.keys(errors).length) return NextResponse.json({ error: 'invalid', fields: errors }, { status: 400 });
  const at = new Date().toISOString();
  const where = `id=eq.${encodeURIComponent(uid)}`;
  let pending = false;
  try {
    await update('users', where, { ...patch, updated_at: at }, { returning: 'minimal' });
  } catch (e) {
    if (!isMissingColumnError(e)) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    // migration 022 not applied yet: keep the name, the rest waits
    pending = true;
    try { await update('users', where, { full_name: patch.full_name, updated_at: at }, { returning: 'minimal' }); }
    catch { return NextResponse.json({ error: 'update_failed' }, { status: 500 }); }
  }
  invalidateSellerProfiles();
  const fresh = await getUserById(uid);
  if (fresh) setSessionCookie(fresh); // refresh name in the session token
  return NextResponse.json({ ok: true, pending_migration: pending, profile: fresh ? formValues(fresh) : null, user: publicUser(fresh) });
}

export async function PATCH(req) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.first_name === 'string') return saveProfessional(s.uid, body);
  const patch = {};
  if (typeof body.full_name === 'string') patch.full_name = body.full_name.trim() || null;
  if (typeof body.phone === 'string') {
    // A verified WhatsApp is the account's sign-in: it can't be swapped by typing a new
    // one here (Settings → "Agregar WhatsApp" proves a number with a code).
    const cur = await getUserById(s.uid);
    if (!cur?.phone_verified_at) patch.phone = body.phone.trim() || null;
    else if ((body.phone.trim() || null) !== (cur.phone || null) && !patch.full_name && typeof body.full_name !== 'string') return NextResponse.json({ error: 'phone_verified' }, { status: 409 });
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  patch.updated_at = new Date().toISOString();
  try {
    await update('users', `id=eq.${encodeURIComponent(s.uid)}`, patch, { returning: 'minimal' });
  } catch (e) {
    return NextResponse.json({ error: 'update_failed', detail: e?.message }, { status: 500 });
  }
  const fresh = await getUserById(s.uid);
  if (fresh) setSessionCookie(fresh); // refresh name in the session token
  return NextResponse.json({ ok: true, user: publicUser(fresh) });
}
