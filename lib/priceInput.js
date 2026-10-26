// The price a seller types in the sell form → a whole number, read the same way in the
// browser and on the server. Prices are whole numbers (US$ or ₲, no cents), and people
// write thousands with dots (290.000), commas (290,000) or nothing (290000) — all three
// are 290000. A dot or comma is NEVER a decimal point: "290.000" used to become 290 and
// the listing was rejected as "price too low".
// The one careful exception: a cents part at the very end ("145000.50", "145000,00") is
// dropped, so a US$ price can't come out 100× too big.
// The form shows the number grouped with commas while typing (290,000). Pure — tested in
// tests/priceInput.test.mjs.

// "290.000" / "290,000" / "290 000" / "US$ 290000" → 290000; "145000.50" → 145000; '' → NaN
export function parsePrice(v) {
  let s = String(v ?? '').replace(/\s+/g, '');
  s = s.replace(/[.,]\d{1,2}$/, '');   // a trailing cents part — a 3-digit group is thousands
  const digits = s.replace(/\D/g, '');
  if (!digits) return NaN;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : NaN;
}

// 290000 → "290,000" (always commas, whatever the site's language)
export const groupPrice = (n) => (Number.isFinite(n) ? String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '');

// What the box shows for a stored value (also an older draft saved as "145.000").
export const priceShown = (v) => groupPrice(parsePrice(v));

// The box changed: typing one character keeps only its digits (a dot or comma typed as a
// thousands mark simply disappears, the commas come back by themselves); a paste is read
// whole, so "145000.00" pasted stays 145,000.
export function nextPriceInput(prev, raw) {
  const pasted = String(raw ?? '').length - String(prev ?? '').length > 1;
  const n = pasted ? parsePrice(raw) : Number(String(raw ?? '').replace(/\D/g, '').slice(0, 15) || NaN);
  return groupPrice(n);
}
