// ─────────────────────────────────────────────────────────────────────────────
// Per-country configuration — the single source of truth for everything that
// differs between Casa Libre's country sites (PY / BO / UY / …). One codebase,
// one deployment per country, selected by the build-time env var:
//
//     NEXT_PUBLIC_COUNTRY = py | bo | uy        (default: py)
//
// It MUST be NEXT_PUBLIC_* so the SAME value is inlined into both the server and
// the client bundle (a plain COUNTRY var is undefined in the browser → hydration
// mismatch). Deployments are separate builds, so the value is baked in per site.
//
// ⚠️ PARAGUAY IS THE DEFAULT AND MUST STAY BYTE-IDENTICAL. Every value in the
// `py` profile below is the exact literal that used to be hardcoded, so with
// NEXT_PUBLIC_COUNTRY unset (or 'py') the live PY site renders exactly as before.
//
// 🚩 BO / UY marked "VERIFY" are best-effort seeds — refine cities, barrios,
// competitors, featured zones, map center/zoom, and FX with real local data.
// ─────────────────────────────────────────────────────────────────────────────

const PROFILES = {
  // ===========================================================================
  // PARAGUAY — canonical. Values copied verbatim from the previously-hardcoded
  // code (lib/site.js, lib/money.js, lib/fx.js, lib/ui.js, utils/gmap.js,
  // app/layout.js, components/Footer.js, components/AddressAutocomplete.js).
  // ===========================================================================
  py: {
    code: 'py',
    name: 'Paraguay',
    brand: 'Casa Libre',
    tld: '.py',                                  // wordmark: casa-libre.py
    defaultUrl: 'https://casa-libre.com.py',
    capital: 'Asunción',

    // Currency
    currencyCode: 'PYG',
    currencySymbol: '₲',                         // lib/ui.js fmtPyg
    currencyPrefix: 'Gs. ',                      // lib/money.js fmtPyg / fmtRate
    currencyName: 'guaraníes',
    notary: 'escribano',                          // PY/UY term; BO/VE say 'notario'                   // spelled-out (plural) for body copy
    decimals: 0,                                 // guaraní has no decimals
    rentFloorLocal: 300000,                      // SellFlow / publish rent floor (₲)

    // FX (USD -> local)
    fxTarget: 'PYG',                             // key read from open.er-api.com rates
    fxFallback: 7300,                            // env PYG_PER_USD fallback
    fxSource: 'open.er-api.com',

    // Locale / language
    locale: 'es-PY',                             // toLocale* + JSON-LD inLanguage
    htmlLang: 'es',                              // <html lang>
    ogLocale: 'es_PY',                           // openGraph.locale
    locales: ['es', 'en'],                       // language toggle set
    defaultLang: 'es',

    // Phone
    phonePrefix: '595',
    phonePlaceholder: '0981 123 456',
    businessWhatsApp: '00000000',                // EmpresasClient placeholder

    // Map
    mapCenter: { lat: -25.293, lng: -57.60 },    // Asunción
    mapZoom: 13,
    mapZoomMobile: 12,
    bounds: { latMin: -28, latMax: -19, lngMin: -63, lngMax: -54 },
    geoCountryCode: 'py',                         // Places componentRestrictions + geocode
    defaultProvince: 'Central',                   // quarantine default department

    // SEO
    gscToken: 'pYOvxtOG8ggKnLLL8itfNb1yBjuAHWeZ6cHzk7Tl87E',
    tagline: 'Propiedades en Paraguay',
    desc: 'Casa Libre reúne todas las propiedades de Paraguay en un solo lugar, en la web y en la app: de inmobiliarias y de dueños particulares. Comprá, alquilá o publicá casas, departamentos, dúplex y locales en Asunción y todo el país, sin comisión.',
    seoKeywords: ['propiedades Paraguay', 'casas en Asunción', 'departamentos Paraguay', 'comprar casa Paraguay', 'alquilar departamento Asunción', 'inmuebles Paraguay', 'publicar propiedad gratis'],

    // Content
    cities: [
      { slug: 'asuncion', name: 'Asunción' },
      { slug: 'luque', name: 'Luque' },
      { slug: 'ciudad-del-este', name: 'Ciudad del Este' },
      { slug: 'san-lorenzo', name: 'San Lorenzo' },
      { slug: 'lambare', name: 'Lambaré' },
      { slug: 'fernando-de-la-mora', name: 'Fernando de la Mora' },
      { slug: 'mariano-roque-alonso', name: 'Mariano Roque Alonso' },
      { slug: 'capiata', name: 'Capiatá' },
      { slug: 'nemby', name: 'Ñemby' },
      { slug: 'encarnacion', name: 'Encarnación' },
      { slug: 'san-bernardino', name: 'San Bernardino' },
      { slug: 'villa-elisa', name: 'Villa Elisa' },
    ],
    featuredZones: ['Villa Morra', 'Carmelitas', 'Recoleta', 'Las Mercedes', 'Barrio Jara'],
    barrios: ['Villa Morra', 'Carmelitas', 'Recoleta', 'Las Mercedes', 'Barrio Jara', 'Ycuá Satí', 'Mburucuyá', 'San Vicente', 'Trinidad', 'Sajonia', 'Los Laureles', 'Ciudad Nueva'],
    competitors: [
      { slug: 'infocasas', name: 'InfoCasas', blurb: 'un portal de clasificados con suscripciones pagas para destacar.', blurbEn: 'a classifieds portal with paid subscriptions to feature listings.' },
      { slug: 'clasipar', name: 'Clasipar', blurb: 'un sitio de clasificados general donde las propiedades compiten con todo tipo de avisos.', blurbEn: 'a general classifieds site where properties compete with all kinds of ads.' },
      { slug: 'remax-paraguay', name: 'RE/MAX Paraguay', blurb: 'una red de inmobiliarias con comisiones sobre la venta.', blurbEn: 'a network of real-estate agencies charging commissions on sales.' },
      { slug: 'properati', name: 'Properati', blurb: 'un portal regional de avisos inmobiliarios con planes pagos.', blurbEn: 'a regional real-estate listings portal with paid plans.' },
      { slug: 'mercadolibre-inmuebles', name: 'Mercado Libre Inmuebles', blurb: 'la sección de inmuebles de un marketplace general.', blurbEn: 'the real-estate section of a general marketplace.' },
      { slug: 'century-21-paraguay', name: 'Century 21 Paraguay', blurb: 'una franquicia de inmobiliarias tradicionales.', blurbEn: 'a franchise of traditional real-estate agencies.' },
    ],

    features: {},                                // per-country UI toggles (e.g. { showXSection: true })
  },

  // ===========================================================================
  // BOLIVIA — 🚩 VERIFY seeds (currency/phone/map correct; cities/zones/competitors to refine)
  // ===========================================================================
  bo: {
    code: 'bo',
    name: 'Bolivia',
    brand: 'Casa Libre',
    tld: '.bo',
    defaultUrl: 'https://casa-libre.com.bo',
    capital: 'Santa Cruz de la Sierra',          // 🚩 main RE market (not political capital)

    currencyCode: 'BOB',
    currencySymbol: 'Bs',
    currencyPrefix: 'Bs ',
    currencyName: 'bolivianos',
    notary: 'notario',
    decimals: 2,
    rentFloorLocal: 300,                         // 🚩 ~US$43 in Bs

    fxTarget: 'BOB',
    fxFallback: 12.5,                            // offline fallback only — live BOB from open.er-api.com (~12.6 market rate; official peg is 6.96 but not the real trading rate)
    fxSource: 'open.er-api.com',

    locale: 'es-BO',
    htmlLang: 'es',
    ogLocale: 'es_BO',
    locales: ['es', 'en'],
    defaultLang: 'es',

    phonePrefix: '591',
    phonePlaceholder: '7 123 4567',              // 🚩 BO mobile
    businessWhatsApp: '',

    mapCenter: { lat: -17.7833, lng: -63.1821 }, // 🚩 Santa Cruz
    mapZoom: 12,
    mapZoomMobile: 11,
    bounds: { latMin: -23, latMax: -9.5, lngMin: -70, lngMax: -57 },
    geoCountryCode: 'bo',
    defaultProvince: 'Santa Cruz',

    gscToken: null,                              // 🚩 add per-property GSC token
    tagline: 'Propiedades en Bolivia',
    desc: 'Casa Libre reúne todas las propiedades de Bolivia en un solo lugar, en la web y en la app: de inmobiliarias y de dueños particulares. Comprá, alquilá o publicá casas, departamentos, dúplex y locales en Santa Cruz y todo el país, sin comisión.',
    seoKeywords: ['propiedades Bolivia', 'casas en Santa Cruz', 'departamentos Bolivia', 'comprar casa Bolivia', 'alquilar departamento Santa Cruz', 'inmuebles Bolivia', 'publicar propiedad gratis'],

    cities: [ // 🚩 VERIFY
      { slug: 'santa-cruz-de-la-sierra', name: 'Santa Cruz de la Sierra' },
      { slug: 'la-paz', name: 'La Paz' },
      { slug: 'cochabamba', name: 'Cochabamba' },
      { slug: 'el-alto', name: 'El Alto' },
      { slug: 'sucre', name: 'Sucre' },
      { slug: 'oruro', name: 'Oruro' },
      { slug: 'tarija', name: 'Tarija' },
      { slug: 'potosi', name: 'Potosí' },
    ],
    featuredZones: ['Equipetrol', 'Las Palmas', 'Urbarí', 'Zona Norte', 'Sirari'], // 🚩 VERIFY
    barrios: ['Equipetrol', 'Las Palmas', 'Urbarí', 'Zona Norte', 'Sirari', 'Polanco', 'Hamacas', 'El Trompillo'], // 🚩 VERIFY
    competitors: [ // 🚩 VERIFY
      { slug: 'infocasas', name: 'InfoCasas', blurb: 'un portal de clasificados con suscripciones pagas para destacar.', blurbEn: 'a classifieds portal with paid subscriptions to feature listings.' },
      { slug: 'ultracasas', name: 'UltraCasas', blurb: 'un portal inmobiliario con planes pagos.', blurbEn: 'a real-estate portal with paid plans.' },
      { slug: 'remax-bolivia', name: 'RE/MAX Bolivia', blurb: 'una red de inmobiliarias con comisiones sobre la venta.', blurbEn: 'a network of real-estate agencies charging commissions on sales.' },
      { slug: 'century-21-bolivia', name: 'Century 21 Bolivia', blurb: 'una franquicia de inmobiliarias tradicionales.', blurbEn: 'a franchise of traditional real-estate agencies.' },
    ],

    features: {},
  },

  // ===========================================================================
  // URUGUAY — 🚩 VERIFY seeds
  // ===========================================================================
  uy: {
    code: 'uy',
    name: 'Uruguay',
    brand: 'Casa Libre',
    tld: '.uy',
    // Uruguay ships on the hub subdomain uy.casa-libre.com (not casa-libre.com.uy).
    defaultUrl: 'https://uy.casa-libre.com',
    capital: 'Montevideo',

    currencyCode: 'UYU',
    currencySymbol: '$U',
    currencyPrefix: '$U ',
    currencyName: 'pesos',
    notary: 'escribano',
    decimals: 2,
    rentFloorLocal: 1500,                        // 🚩 ~US$38 in UYU

    fxTarget: 'UYU',
    fxFallback: 40,                             // 🚩 UYU floats ≈ 40/USD
    fxSource: 'open.er-api.com',

    locale: 'es-UY',
    htmlLang: 'es',
    ogLocale: 'es_UY',
    locales: ['es', 'en'],
    defaultLang: 'es',

    phonePrefix: '598',
    phonePlaceholder: '099 123 456',            // 🚩 UY mobile
    businessWhatsApp: '',

    mapCenter: { lat: -34.9011, lng: -56.1645 }, // 🚩 Montevideo
    mapZoom: 12,
    mapZoomMobile: 11,
    bounds: { latMin: -35.1, latMax: -30, lngMin: -58.5, lngMax: -53 },
    geoCountryCode: 'uy',
    defaultProvince: 'Montevideo',

    gscToken: null,
    tagline: 'Propiedades en Uruguay',
    desc: 'Casa Libre reúne todas las propiedades de Uruguay en un solo lugar, en la web y en la app: de inmobiliarias y de dueños particulares. Comprá, alquilá o publicá casas, departamentos, dúplex y locales en Montevideo y todo el país, sin comisión.',
    seoKeywords: ['propiedades Uruguay', 'casas en Montevideo', 'departamentos Uruguay', 'comprar casa Uruguay', 'alquilar departamento Montevideo', 'inmuebles Uruguay', 'publicar propiedad gratis'],

    cities: [ // 🚩 VERIFY
      { slug: 'montevideo', name: 'Montevideo' },
      { slug: 'punta-del-este', name: 'Punta del Este' },
      { slug: 'maldonado', name: 'Maldonado' },
      { slug: 'canelones', name: 'Canelones' },
      { slug: 'ciudad-de-la-costa', name: 'Ciudad de la Costa' },
      { slug: 'salto', name: 'Salto' },
      { slug: 'colonia-del-sacramento', name: 'Colonia del Sacramento' },
      { slug: 'paysandu', name: 'Paysandú' },
    ],
    featuredZones: ['Pocitos', 'Punta Carretas', 'Carrasco', 'Cordón', 'Centro'], // 🚩 VERIFY
    barrios: ['Pocitos', 'Punta Carretas', 'Carrasco', 'Cordón', 'Centro', 'Malvín', 'Buceo', 'Parque Rodó'], // 🚩 VERIFY
    competitors: [ // 🚩 VERIFY
      { slug: 'infocasas', name: 'InfoCasas', blurb: 'un portal de clasificados con suscripciones pagas para destacar.', blurbEn: 'a classifieds portal with paid subscriptions to feature listings.' },
      { slug: 'mercadolibre-inmuebles', name: 'Mercado Libre Inmuebles', blurb: 'la sección de inmuebles de un marketplace general.', blurbEn: 'the real-estate section of a general marketplace.' },
      { slug: 'gallito', name: 'Gallito', blurb: 'un sitio de clasificados general con avisos inmobiliarios.', blurbEn: 'a general classifieds site with real-estate ads.' },
      { slug: 'century-21-uruguay', name: 'Century 21 Uruguay', blurb: 'una franquicia de inmobiliarias tradicionales.', blurbEn: 'a franchise of traditional real-estate agencies.' },
    ],

    features: {},
  },

  // ===========================================================================
  // VENEZUELA — 🚩 VERIFY seeds. Ships on its own ccTLD casa-libre.com.ve.
  // Real estate here is priced in US DOLLARS in practice (the market ignores the
  // hyperinflationary bolívar), so USD is the PRIMARY currency — no local FX shown.
  // ===========================================================================
  ve: {
    code: 've',
    name: 'Venezuela',
    brand: 'Casa Libre',
    tld: '.ve',
    defaultUrl: 'https://casa-libre.com.ve',
    capital: 'Caracas',

    currencyCode: 'USD',
    currencySymbol: 'US$',
    currencyPrefix: 'US$ ',
    currencyName: 'dólares',
    notary: 'notario',
    decimals: 0,
    rentFloorLocal: 80,                          // ~US$80 min rent

    fxTarget: 'USD',
    fxFallback: 1,                               // prices already in USD → no conversion
    fxSource: 'open.er-api.com',

    locale: 'es-VE',
    htmlLang: 'es',
    ogLocale: 'es_VE',
    locales: ['es', 'en'],
    defaultLang: 'es',

    phonePrefix: '58',
    phonePlaceholder: '0412 123 4567',           // 🚩 VE mobile
    businessWhatsApp: '',

    mapCenter: { lat: 10.4806, lng: -66.9036 },  // 🚩 Caracas
    mapZoom: 12,
    mapZoomMobile: 11,
    bounds: { latMin: 0.6, latMax: 12.3, lngMin: -73.4, lngMax: -59.8 },
    geoCountryCode: 've',
    defaultProvince: 'Distrito Capital',

    gscToken: null,
    tagline: 'Propiedades en Venezuela',
    desc: 'Casa Libre reúne todas las propiedades de Venezuela en un solo lugar, en la web y en la app: de inmobiliarias y de dueños particulares. Compra, alquila o publica casas, apartamentos, terrenos y locales en Caracas, Valencia, Maracaibo y todo el país, sin comisión.',
    seoKeywords: ['propiedades Venezuela', 'apartamentos en Caracas', 'casas en Venezuela', 'comprar apartamento Caracas', 'alquiler Caracas', 'inmuebles Venezuela', 'publicar propiedad gratis'],

    cities: [ // 🚩 VERIFY
      { slug: 'caracas', name: 'Caracas' },
      { slug: 'valencia', name: 'Valencia' },
      { slug: 'maracaibo', name: 'Maracaibo' },
      { slug: 'barquisimeto', name: 'Barquisimeto' },
      { slug: 'maracay', name: 'Maracay' },
      { slug: 'isla-de-margarita', name: 'Isla de Margarita' },
      { slug: 'san-cristobal', name: 'San Cristóbal' },
      { slug: 'puerto-ordaz', name: 'Puerto Ordaz' },
    ],
    featuredZones: ['Las Mercedes', 'La Castellana', 'El Hatillo', 'Los Palos Grandes', 'Chacao'], // 🚩 VERIFY
    barrios: ['Las Mercedes', 'La Castellana', 'El Hatillo', 'Los Palos Grandes', 'Chacao', 'Altamira', 'La Lagunita', 'Baruta'], // 🚩 VERIFY
    competitors: [ // 🚩 VERIFY
      { slug: 'mercadolibre-inmuebles', name: 'Mercado Libre Inmuebles', blurb: 'la sección de inmuebles de un marketplace general.', blurbEn: 'the real-estate section of a general marketplace.' },
      { slug: 'tuinmueble', name: 'Tuinmueble', blurb: 'un portal de clasificados inmobiliarios.', blurbEn: 'a real-estate classifieds portal.' },
      { slug: 'century-21-venezuela', name: 'Century 21 Venezuela', blurb: 'una franquicia de inmobiliarias tradicionales.', blurbEn: 'a franchise of traditional real-estate agencies.' },
      { slug: 'remax-venezuela', name: 'RE/MAX Venezuela', blurb: 'una franquicia inmobiliaria internacional.', blurbEn: 'an international real-estate franchise.' },
    ],

    features: {},
  },
};

// RUNTIME country selection — decided when the app runs, NOT baked at build time,
// so ONE build serves any country (the deployment's env var picks it; no rebuild or
// build-cache dance needed). Defaults to Paraguay so nothing changes for PY.
//   • Server (Node): read the runtime env. `COUNTRY` is a plain var (never inlined
//     at build), so it is always the live value; NEXT_PUBLIC_COUNTRY is accepted too.
//   • Client (browser): read the value the server injected into the HTML at request
//     time as window.__CL_COUNTRY__ (see app/layout.js). Falls back to 'py'.
// Derive the country from a site URL that carries a country TLD (…com.bo → bo).
// We read it from the APP_PUBLIC_URL *env var* (already set per service, e.g.
// https://casa-libre.com.bo) — this does NOT require the domain to resolve in a
// browser; it only reads the configured value. It is a PLAIN var read LIVE at
// runtime, so — unlike NEXT_PUBLIC_COUNTRY, which Next inlines at build and
// freezes — it can never be baked stale.
function codeFromUrl(u) {
  // Accept both domain shapes we deploy:
  //   ccTLD form     — casa-libre.com.py / casa-libre.com.bo / casa-libre.com.uy
  //   subdomain form — uy.casa-libre.com (Uruguay ships as a subdomain of the hub,
  //                    NOT casa-libre.com.uy) — so a leading `uy.` / `bo.` / `py.`
  //                    label must map to that country too, else it falls through to
  //                    the `py` default and the site wrongly renders Paraguay.
  const host = String(u || '').toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  const first = host.split('.')[0];                     // leading label (subdomain)
  if (first === 'bo' || first === 'uy' || first === 'py' || first === 've') return first;
  if (/\.com\.bo$|\.bo$/.test(host)) return 'bo';
  if (/\.com\.uy$|\.uy$/.test(host)) return 'uy';
  if (/\.com\.py$|\.py$/.test(host)) return 'py';
  if (/\.com\.ve$|\.ve$/.test(host)) return 've';
  return null;
}

function resolveCountryCode() {
  if (typeof window !== 'undefined') {
    // Client: trust the value the server stamped into the page.
    return String(window.__CL_COUNTRY__ || 'py').toLowerCase();
  }
  // Server (per request, at runtime). Order of trust:
  //   1. COUNTRY        — explicit plain override, if ever set.
  //   2. APP_PUBLIC_URL — plain runtime var already set per service; carries the TLD.
  //   3. NEXT_PUBLIC_COUNTRY — build-frozen fallback (only right if set at build).
  return String(
    process.env.COUNTRY
    || codeFromUrl(process.env.APP_PUBLIC_URL)
    || process.env.NEXT_PUBLIC_COUNTRY
    || 'py'
  ).toLowerCase();
}
const CODE = resolveCountryCode();

export const COUNTRY = PROFILES[CODE] || PROFILES.py;
export const COUNTRY_CODE = COUNTRY.code;
export function countryConfig(code) {
  return PROFILES[String(code || '').toLowerCase()] || null;
}
export default COUNTRY;
