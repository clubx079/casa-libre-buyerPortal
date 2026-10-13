// US$ cents → "≈ ₲ 45.300" in this country's currency — fine print only (paid listings
// are charged in US$).
import 'server-only';
import { getUsdToPyg } from './fx';
import { COUNTRY } from './country';

export async function localPrice(cents) {
  if (COUNTRY.currencyCode === 'USD') return null;   // dollarised (SV): US$ is the local price
  try {
    const rate = await getUsdToPyg();
    if (!(rate > 0)) return null;
    const v = Math.round((cents / 100) * rate);
    return `≈ ${COUNTRY.currencySymbol} ${v.toLocaleString(COUNTRY.locale, { maximumFractionDigits: 0 })}`;
  } catch { return null; }
}
