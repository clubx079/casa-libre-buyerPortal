// The country list the MOBILE APP uses — served with /api/mobile/geo, merged over
// the list built into the app (app: lib/countryPick.js mergeCountries).
//
// To launch a country in the app WITHOUT an app update: add it here (all fields)
// with status 'live', deploy the website. 'soon' shows it greyed in the app's
// country picker; 'hidden' removes it. Paraguay is always live (the fallback).
// Also needed per new country: its site deployed with /api/mobile/*, and its
// domain added to the Google Maps key's allowed websites (or its map is blank).
//
//   regions: ISO codes (Cloudflare CF-IPCountry) that open this country.
export const MOBILE_COUNTRIES = [
  {
    code: 'py', name: 'Paraguay', flag: '🇵🇾', tld: '.py', capital: 'Asunción',
    origin: 'https://casa-libre.com.py', currencyCode: 'PYG', moneyPrefix: 'Gs ', moneyLocale: 'de-DE',
    usdRate: 7300, mapCenter: { latitude: -25.2967, longitude: -57.6359 }, mapZoom: 12, singleZoom: 15,
    phonePrefix: '595', status: 'live', regions: ['PY'],
  },
  {
    code: 'bo', name: 'Bolivia', flag: '🇧🇴', tld: '.bo', capital: 'Santa Cruz de la Sierra',
    origin: 'https://casa-libre.com.bo', currencyCode: 'BOB', moneyPrefix: 'Bs ', moneyLocale: 'es-BO',
    usdRate: 12.5, mapCenter: { latitude: -17.7833, longitude: -63.1821 }, mapZoom: 11, singleZoom: 15,
    phonePrefix: '591', status: 'live', regions: ['BO'],
  },
  {
    code: 'uy', name: 'Uruguay', flag: '🇺🇾', tld: '.uy', capital: 'Montevideo',
    origin: 'https://uy.casa-libre.com', currencyCode: 'UYU', moneyPrefix: '$U ', moneyLocale: 'es-UY',
    usdRate: 40, mapCenter: { latitude: -34.9011, longitude: -56.1645 }, mapZoom: 11, singleZoom: 15,
    phonePrefix: '598', status: 'live', regions: ['UY'],
  },
  {
    code: 've', name: 'Venezuela', flag: '🇻🇪', tld: '.ve', capital: 'Caracas',
    origin: 'https://casa-libre.com.ve', currencyCode: 'VES', moneyPrefix: 'Bs. ', moneyLocale: 'es-VE',
    usdRate: 875, mapCenter: { latitude: 10.4806, longitude: -66.9036 }, mapZoom: 11, singleZoom: 15,
    phonePrefix: '58', status: 'live', regions: ['VE'],
  },
];
