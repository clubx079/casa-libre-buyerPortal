// Client fetch for the gated marketplace endpoints (/api/listings/search, /pins,
// /images — see middleware.js). They only answer with the cl_api cookie, which the
// middleware mints on page loads and which lasts 12 h: a tab left open longer, or a
// page restored from the browser cache, gets 403. On 403 we re-mint the cookie by
// asking for the current page (HEAD) and retry; network errors and 5xx are retried
// twice with a short backoff. Returns the last Response (callers check res.ok).
async function refreshToken() {
  try { await fetch(window.location.pathname, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' }); } catch { /* retried below */ }
}

export async function gatedFetch(url, init) {
  let last = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 403 && attempt === 0) { await refreshToken(); continue; }
      if (res.ok || (res.status < 500 && res.status !== 403)) return res;
      last = res;
    } catch (e) { last = e; }
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
  }
  if (last && typeof last.ok === 'boolean') return last;
  throw last || new Error('request failed');
}
