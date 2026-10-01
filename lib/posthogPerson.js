// Delete a person from PostHog — their profile (email, name, phone, set by
// lib/analytics.js identifyUser), events and session recordings. Called when an
// account is deleted (app/api/account/delete). The site identifies signed-in
// users by their users.id, so that is the distinct_id.
//   POSTHOG_PERSONAL_API_KEY needs the person:write scope (besides query:read for
//   lib/posthogViews.js), plus POSTHOG_PROJECT_ID and POSTHOG_HOST.
// PostHog queues the deletion (202) and reports failures in deletion_errors.
// Never throws → { ok, skipped?, queued?, error? }.
export async function deletePosthogPerson(distinctId, { env = process.env, fetchImpl = fetch } = {}) {
  const host = (env.POSTHOG_HOST || 'https://us.posthog.com').replace(/\/+$/, '');
  const key = env.POSTHOG_PERSONAL_API_KEY;
  const project = env.POSTHOG_PROJECT_ID;
  if (!distinctId) return { ok: false, error: 'no_id' };
  if (!key || !project) return { ok: false, skipped: true, error: 'posthog_not_configured' };
  try {
    const res = await fetchImpl(`${host}/api/projects/${encodeURIComponent(project)}/persons/bulk_delete/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ distinct_ids: [String(distinctId)], delete_events: true, delete_recordings: true }),
      cache: 'no-store',
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: `posthog_${res.status}${res.status === 403 ? '_needs_person_write_scope' : ''}` };
    if (Array.isArray(body.deletion_errors) && body.deletion_errors.length) return { ok: false, error: 'posthog_deletion_errors' };
    return { ok: true, queued: Number(body.persons_queued_for_deletion || body.persons_deleted || 0) };
  } catch (e) {
    return { ok: false, error: `posthog_network: ${e?.message || e}` };
  }
}
