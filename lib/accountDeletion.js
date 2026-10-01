// Delete a Casa Libre account — required in-app by Apple (5.1.1(v)) and Google
// Play, which also wants a web page (app/eliminar-cuenta). Used by
// POST /api/account/delete (website + mobile app). Pure: takes the db helpers
// (lib/db.js or the test fake), so it is unit-tested (tests/accountDeletion.test.mjs).
//
// What happens:
//   • the users row is ANONYMISED and switched off (active=false), not deleted —
//     payments cascade-delete with it and are kept for accounting. Its email
//     becomes deleted-<id>@deleted.invalid, so the person can sign up again with
//     their address, old sessions stop working (/api/auth/me drops inactive
//     accounts) and lib/email.js never mails it.
//   • their LISTINGS stay, minus the owner's name, phone and account link. (The
//     marketplace only shows listings with a phone, so they leave the site.)
//   • saved properties, drafts, push devices/preferences/log, sign-in codes are
//     deleted; their name/email is blanked in feedback, contact clicks and the
//     email log; open first-listing automations are stopped.
//
// Order matters: everything else first, the users row LAST — if a step fails the
// account is untouched and still signed in, so the user can simply retry. Every
// step is idempotent. Tables/columns a country database doesn't have are skipped.

const DELETED_DOMAIN = 'deleted.invalid';
export const deletedEmailFor = (uid) => `deleted-${uid}@${DELETED_DOMAIN}`;
export function isDeletedEmail(to) {
  return (Array.isArray(to) ? to : [to]).some((e) => typeof e === 'string' && e.trim().toLowerCase().endsWith(`@${DELETED_DOMAIN}`));
}

const enc = (v) => encodeURIComponent(String(v));
const missingTable = (e) => !!e && (e.status === 404 || e.code === 'PGRST205' || e.code === '42P01');
const missingColumn = (e) => !!e && (e.code === '42703' || e.code === 'PGRST204');
// Only write columns the row really has (older country databases lack some).
const pickExisting = (row, patch) => Object.fromEntries(Object.entries(patch).filter(([k]) => k in row));

function cleanRawData(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const { user_id, user_email, ...rest } = raw;   // eslint-disable-line no-unused-vars
  return { ...rest, owner_account_deleted: true };
}

export async function deleteAccount(db, { uid, email } = {}) {
  if (!uid) return { ok: false, failed: ['no_user'] };
  const id = enc(uid);
  const failed = [];
  const step = async (name, fn) => {
    try { await fn(); } catch (e) { if (!missingTable(e)) failed.push(`${name}: ${e?.message || e}`); }
  };

  // The current address from the account itself (the session may predate an email change).
  let row = null;
  try { [row] = await db.select('users', `select=*&id=eq.${id}&limit=1`); } catch (e) { return { ok: false, failed: [`users: ${e?.message || e}`] }; }
  const current = row?.email && !isDeletedEmail(row.email) ? row.email : email;
  const mail = current && !isDeletedEmail(current) ? String(current).trim().toLowerCase() : null;

  // 1. Listings stay, without the owner's name, phone or account link.
  let listingsKept = 0;
  await step('properties', async () => {
    const own = new Map();
    for (const col of ['created_by', 'posted_by']) {
      try {
        for (const p of await db.select('properties', `select=*&${col}=eq.${id}`)) own.set(String(p.id), p);
      } catch (e) { if (!missingColumn(e)) throw e; }
    }
    for (const p of own.values()) {
      const patch = pickExisting(p, { contact_name: null, contact_phone: null, created_by: null, posted_by: null, raw_data: cleanRawData(p.raw_data) });
      await db.update('properties', `id=eq.${enc(p.id)}`, patch, { returning: 'minimal' });
    }
    listingsKept = own.size;
  });

  // 2. Their own data.
  for (const t of ['favorites', 'listing_drafts', 'push_tokens', 'notification_prefs', 'push_log']) {
    await step(t, () => db.remove(t, `user_id=eq.${id}`));
  }
  await step('automation_runs', () => db.update('automation_runs', `user_id=eq.${id}&status=in.(gifted,reminded)`, { status: 'skipped', skip_reason: 'account_deleted' }, { returning: 'minimal' }));
  await step('listing_view_milestones', () => db.update('listing_view_milestones', `user_id=eq.${id}`, { user_id: null }, { returning: 'minimal' }));

  // 3. Their name / email inside other records (the records themselves stay).
  await step('contact_link_clicks', () => db.update('contact_link_clicks', `buyer_user_id=eq.${id}`, { buyer_user_id: null, buyer_email: null }, { returning: 'minimal' }));
  await step('feedback', () => db.update('feedback', `user_id=eq.${id}`, { user_id: null, name: null, email: null }, { returning: 'minimal' }));
  if (mail) {
    const m = enc(mail);
    await step('email_log', () => db.update('email_log', `to_email=eq.${m}`, { to_email: deletedEmailFor(uid) }, { returning: 'minimal' }));
    await step('contact_link_clicks', () => db.update('contact_link_clicks', `buyer_email=eq.${m}`, { buyer_email: null }, { returning: 'minimal' }));
    await step('feedback', () => db.update('feedback', `email=eq.${m}`, { name: null, email: null }, { returning: 'minimal' }));
    await step('otp_codes', () => db.remove('otp_codes', `identifier=eq.${m}`));
  }

  if (failed.length) return { ok: false, failed };

  // 4. LAST: anonymise + switch off the account (kept for payment records).
  if (row) {
    const patch = {
      ...pickExisting(row, {
        full_name: null, phone: null, password_hash: null, google_id: null, auth_provider: 'deleted', verified: false,
        card_brand: null, card_last4: null, card_exp_month: null, card_exp_year: null, card_pm_id: null,
        registration_ip: null, ip_address: null, updated_at: new Date().toISOString(),
      }),
      email: deletedEmailFor(uid),
      active: false,
    };
    try {
      await db.update('users', `id=eq.${id}`, patch, { returning: 'minimal' });
    } catch (e) {
      return { ok: false, failed: [`users: ${e?.message || e}`] };
    }
  }
  return { ok: true, listingsKept };
}
