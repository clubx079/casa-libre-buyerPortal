// Pure helpers for the AI photo check (lib/imageScan.js, lib/listingScan.js) — no I/O,
// so they're unit-tested (tests/scanVerdict.test.mjs).

// properties.status of a user listing while its photos are checked, and after.
// (admin_status is 'inactive' for both, so the marketplace never shows them.)
export const SCAN_STATUS = { scanning: 'scanning', rejected: 'rejected', published: 'published' };
// properties.rejection_reason + the admin Quarantine reason code.
export const IMAGES_REJECTED = 'images_rejected';
export const FAIL_CATEGORIES = ['adult', 'violence', 'hate', 'unrelated'];

// The model's one-line answer → a verdict. "PASS" → pass; "FAIL: adult" → fail/adult
// (an unknown category counts as unrelated); anything else → error (asked again later).
export function parseVerdict(text) {
  const s = String(text || '').replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim().toUpperCase();   // drop any reasoning
  if (s.startsWith('PASS')) return { verdict: 'pass' };
  if (s.startsWith('FAIL')) {
    const c = s.slice(4).replace(/^[\s:–—-]+/, '').split(/[\s,.]/)[0].toLowerCase();
    return { verdict: 'fail', category: FAIL_CATEGORIES.includes(c) ? c : 'unrelated' };
  }
  return { verdict: 'error', error: `unclear_answer: ${String(text || '').slice(0, 60)}` };
}

// One listing's photo verdicts → what happens to it. Any failed photo rejects it (even if
// others couldn't be checked); otherwise any photo we couldn't check means "try again
// later" — never "let it through"; all passed (or no photos) → published.
export function scanOutcome(results = []) {
  if (results.some((r) => r?.verdict === 'fail')) return 'rejected';
  if (results.some((r) => r?.verdict !== 'pass')) return 'retry';
  return 'published';
}
