// Remote push notifications for the mobile app, sent through Expo's push service
// (which forwards to FCM for Android and APNs for iOS). The app registers its Expo
// push token after sign-in (POST /api/mobile/push/register); anything on the server
// can then call sendPush() — new notification kinds need no app update, as long as
// they open a screen the app already has (see the app's lib/pushRoutes.js).
//
// Every function takes the db module as its first argument (lib/db in production,
// the in-memory store in tests). Tables: migration 011.

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const CHANNELS = ['listings', 'saved', 'news'];      // = Android channel ids + notification_prefs columns
const TOKEN_RE = /^Expo(nent)?PushToken\[[^\]\s]{10,200}\]$/;
const BATCH = 100;                                          // Expo accepts up to 100 messages per request

export const isExpoToken = (t) => typeof t === 'string' && TOKEN_RE.test(t);
const q = (v) => encodeURIComponent(String(v));
const now = () => new Date().toISOString();

// ---- tokens --------------------------------------------------------------------

// Link a device token to the signed-in user (a phone that changes hands moves to
// the new user). Returns { ok } or { error }.
export async function registerToken(db, userId, { token, platform, appVersion, deviceName } = {}) {
  if (!userId) return { error: 'unauthorized' };
  if (!isExpoToken(token)) return { error: 'invalid_token' };
  const plat = platform === 'ios' ? 'ios' : platform === 'android' ? 'android' : null;
  if (!plat) return { error: 'invalid_platform' };
  const fields = {
    user_id: userId,
    platform: plat,
    app_version: appVersion ? String(appVersion).slice(0, 20) : null,
    device_name: deviceName ? String(deviceName).slice(0, 80) : null,
    enabled: true,
    last_error: null,
    last_seen_at: now(),
  };
  const existing = await db.select('push_tokens', `select=id&token=eq.${q(token)}&limit=1`);
  if (existing.length) await db.update('push_tokens', `id=eq.${existing[0].id}`, fields);
  else await db.insert('push_tokens', [{ token, ...fields }]);
  return { ok: true };
}

// Stop sending to a device (logout). The token alone identifies the phone.
export async function unregisterToken(db, token) {
  if (!isExpoToken(token)) return { error: 'invalid_token' };
  await db.update('push_tokens', `token=eq.${q(token)}`, { enabled: false, last_seen_at: now() });
  return { ok: true };
}

// ---- preferences -----------------------------------------------------------------

export async function getPrefs(db, userId) {
  const rows = await db.select('notification_prefs', `select=listings,saved,news&user_id=eq.${q(userId)}&limit=1`);
  const r = rows[0] || {};
  return Object.fromEntries(CHANNELS.map((c) => [c, r[c] !== false]));   // default: everything on
}

export async function setPrefs(db, userId, patch = {}) {
  const clean = {};
  for (const c of CHANNELS) if (typeof patch[c] === 'boolean') clean[c] = patch[c];
  if (!Object.keys(clean).length) return { error: 'nothing_to_update' };
  const rows = await db.select('notification_prefs', `select=user_id&user_id=eq.${q(userId)}&limit=1`);
  if (rows.length) await db.update('notification_prefs', `user_id=eq.${q(userId)}`, { ...clean, updated_at: now() });
  else await db.insert('notification_prefs', [{ user_id: userId, ...clean }]);
  return { ok: true, prefs: await getPrefs(db, userId) };
}

// ---- sending ---------------------------------------------------------------------

// Only in-app paths the app knows how to open are forwarded (app: lib/pushRoutes.js).
export function cleanData(data = {}) {
  const out = {};
  if (typeof data.url === 'string' && /^\/[A-Za-z0-9/_\-()[\]]{0,120}$/.test(data.url)) out.url = data.url;
  if (typeof data.kind === 'string') out.kind = data.kind.slice(0, 40);
  return out;
}

// Send one notification to one or more users, on every enabled device they have.
//   { userIds, title, body, channel='news', kind='generic', data={url}, dedupeKey }
// Users who switched the channel off are skipped. With dedupeKey the whole send
// happens at most once (push_log unique). Returns a summary; never throws on
// Expo errors (they are logged per message).
export async function sendPush(db, opts, { fetchImpl = globalThis.fetch, accessToken = process.env.EXPO_ACCESS_TOKEN } = {}) {
  const { userIds = [], title, body, channel = 'news', kind = 'generic', data = {}, dedupeKey = null } = opts || {};
  if (!title || !body) return { error: 'title_and_body_required' };
  if (!CHANNELS.includes(channel)) return { error: 'invalid_channel' };
  const ids = [...new Set(userIds.filter(Boolean))];
  const summary = { users: ids.length, sent: 0, failed: 0, skipped: 0, disabledTokens: 0 };
  if (!ids.length) return summary;

  if (dedupeKey) {
    const seen = await db.select('push_log', `select=id&dedupe_key=eq.${q(dedupeKey)}&limit=1`);
    if (seen.length) return { ...summary, duplicate: true };
  }

  // Respect per-user channel switches.
  const prefs = await db.select('notification_prefs', `select=user_id,${channel}&user_id=in.(${ids.map(q).join(',')})`);
  const off = new Set(prefs.filter((p) => p[channel] === false).map((p) => p.user_id));
  const targets = ids.filter((id) => !off.has(id));
  summary.skipped = ids.length - targets.length;
  if (!targets.length) return summary;

  const tokens = await db.select('push_tokens', `select=token,user_id&enabled=eq.true&user_id=in.(${targets.map(q).join(',')})`);
  if (!tokens.length) return { ...summary, noDevices: true };

  const payloadData = cleanData({ ...data, kind });
  const messages = tokens.map((t) => ({ to: t.token, title: String(title).slice(0, 120), body: String(body).slice(0, 400), data: payloadData, sound: 'default', channelId: channel, priority: 'high' }));
  const logRows = [];
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    let tickets = [];
    let batchError = null;
    try {
      const res = await fetchImpl(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(batch) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) batchError = `http_${res.status}:${JSON.stringify(j.errors || j).slice(0, 200)}`;
      tickets = Array.isArray(j.data) ? j.data : [];
    } catch (e) { batchError = `network:${String(e.message || e).slice(0, 200)}`; }

    for (let k = 0; k < batch.length; k++) {
      const m = batch[k];
      const tk = tickets[k];
      const owner = tokens.find((t) => t.token === m.to)?.user_id || null;
      const ok = !batchError && tk?.status === 'ok';
      const err = batchError || (tk ? (tk.details?.error || tk.message || null) : 'no_ticket');
      if (ok) summary.sent++; else summary.failed++;
      logRows.push({ user_id: owner, token: m.to, channel, kind, title: m.title, body: m.body, data: payloadData, status: ok ? 'ok' : 'error', ticket_id: tk?.id || null, error: ok ? null : err });
      // The phone uninstalled the app / revoked permission → stop trying it.
      if (!ok && tk?.details?.error === 'DeviceNotRegistered') {
        await db.update('push_tokens', `token=eq.${q(m.to)}`, { enabled: false, last_error: 'DeviceNotRegistered' });
        summary.disabledTokens++;
      }
    }
  }

  // The dedupe key goes on the first log row only (unique column); the rest share the send.
  if (dedupeKey && logRows.length) logRows[0].dedupe_key = dedupeKey;
  try { await db.insert('push_log', logRows, { returning: 'minimal' }); } catch { /* logging must never fail a send */ }
  return summary;
}
