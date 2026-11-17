// The Listing Agreement (Terms §4, /terminos#acuerdo-de-publicacion): the seller ticks
// "I confirm my details are correct and I agree to the Listing Agreement" when they
// publish, edit or renew (extend) a listing. Each acceptance is kept on the listing:
//   raw_data.listing_agreement = { accepted_at, version, ip, via, count, first_accepted_at }
// (the latest acceptance + how many times it was accepted). Pure — tests/listingAgreement.test.mjs.
export const AGREEMENT_VERSION = '2026-11-17';
export const AGREEMENT_URL = '/terminos#acuerdo-de-publicacion';

export function agreementRecord(prev, { ip = null, via = 'publish', now = new Date() } = {}) {
  const p = prev && typeof prev === 'object' ? prev : null;
  const at = now.toISOString();
  return {
    accepted_at: at,
    version: AGREEMENT_VERSION,
    ip: ip ? String(ip).slice(0, 64) : null,
    via,
    count: (Number(p?.count) || (p ? 1 : 0)) + 1,
    first_accepted_at: p?.first_accepted_at || p?.accepted_at || at,
  };
}

// raw_data with the acceptance added (the rest untouched).
export const withAgreement = (raw, opts) => ({ ...(raw || {}), listing_agreement: agreementRecord(raw?.listing_agreement, opts) });

// The form / JSON flag the clients send ('1', 'true', true).
export const agreed = (v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'on';
