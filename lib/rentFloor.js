// Monthly rent floor used by the visibility check (lib/completeness.js) and the
// "Contact seller for price" rule (lib/unverified.js). Paraguay keeps its original
// rule (₲300,000). Elsewhere the local amount is bolivianos, pesos or dollars, where
// 300,000 means something else entirely — it made every rental page in Bolivia and
// Uruguay "not found" — so other countries use the US$ equivalent.
export const RENT_FLOOR_PYG = 300000;
export const RENT_FLOOR_USD = 40;

// l = { usd, pyg } (pyg = the local-currency amount); currencyCode = COUNTRY.currencyCode
export function rentPriceOk(l, currencyCode) {
  if (currencyCode === 'PYG') return Number(l?.pyg) > 0 && Number(l.pyg) >= RENT_FLOOR_PYG;
  return Number(l?.usd) > 0 && Number(l.usd) >= RENT_FLOOR_USD;
}
