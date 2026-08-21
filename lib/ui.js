// Small bilingual UI dictionary + formatting for the buyer marketplace.
export const T = {
  es: {
    tabs: [['Comprar', '/propiedades?op=venta', 'venta'], ['Alquilar', '/propiedades?op=alquiler', 'alquiler'], ['Vender', '/publicar', null]],
    cta: 'Publicar gratis', all: 'Todas', venta: 'Venta', alquiler: 'Alquiler',
    results: (n) => `${n} propiedades`, perMonth: '/mes', beds: 'dorm', baths: 'baños',
    noImg: '[ foto ]', backToList: '← Volver', viewSource: 'Ver aviso original ↗',
    contact: 'Contactar', description: 'Descripción', location: 'Ubicación', features: 'Detalles',
    searchable: 'Buscar por ciudad o barrio…', forSale: 'En venta', forRent: 'En alquiler',
    heroTitle1: 'Tu próximo hogar', heroTitle2: 'en Paraguay',
    heroSub: 'Casas, departamentos y más — comprá y alquilá con Casa Libre.',
    heroCta: 'Ver propiedades', featured: 'Destacadas',
  },
  en: {
    tabs: [['Buy', '/propiedades?op=venta', 'venta'], ['Rent', '/propiedades?op=alquiler', 'alquiler'], ['Sell', '/publicar', null]],
    cta: 'List for free', all: 'All', venta: 'For sale', alquiler: 'For rent',
    results: (n) => `${n} listings`, perMonth: '/mo', beds: 'bd', baths: 'ba',
    noImg: '[ photo ]', backToList: '← Back', viewSource: 'View original listing ↗',
    contact: 'Contact', description: 'Description', location: 'Location', features: 'Details',
    searchable: 'Search by city or neighborhood…', forSale: 'For sale', forRent: 'For rent',
    heroTitle1: 'Your next home', heroTitle2: 'in Paraguay',
    heroSub: 'Houses, apartments and more — buy and rent with Casa Libre.',
    heroCta: 'Browse properties', featured: 'Featured',
  },
};

export const loc = (lang) => (lang === 'en' ? 'en-US' : 'es-PY');
export const fmtUsd = (v, lang) => (v == null ? null : 'US$ ' + Number(v).toLocaleString(loc(lang)));
export const fmtPyg = (v, lang) => (v == null ? null : '₲ ' + Number(v).toLocaleString(loc(lang)));
// compact for map pills
// Compact USD for map pins. Rentals/small amounts show the exact value (a
// $420/mo rent must NOT collapse to "US$ 0k"); thousands use "k", millions "M".
export const shortUsd = (v) => {
  if (v == null) return '—';
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 1000) return 'US$ ' + Math.round(n);
  if (n < 1_000_000) return 'US$ ' + Math.round(n / 1000) + 'k';
  return 'US$ ' + (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
};

// --- Singular/plural + label helpers (audit #11) ---
export const plural = (n, sing, plur) => (Number(n) === 1 ? sing : plur);
export const bedWord = (n, lang) =>
  lang === 'en' ? plural(n, 'bedroom', 'bedrooms') : plural(n, 'dormitorio', 'dormitorios');
export const bedAbbr = (lang) => (lang === 'en' ? 'bd' : 'dorm');
export const bathWord = (n, lang) =>
  lang === 'en' ? plural(n, 'bath', 'baths') : plural(n, 'baño', 'baños');
export const parkWord = (n, lang) =>
  lang === 'en' ? plural(n, 'parking space', 'parking spaces') : plural(n, 'cochera', 'cocheras');

// --- Zone title-case (audit #12). Locale-aware; preserves existing accents. ---
export const titleCaseZone = (s) => {
  if (!s) return '';
  return String(s)
    .toLocaleLowerCase('es-PY')
    .replace(/\b([\p{L}])([\p{L}]*)/gu, (_, a, b) => a.toLocaleUpperCase('es-PY') + b)
    .trim();
};

// --- Internal CL ref for tracking + display (audit #5 UI side) ---
export const clRef = (idOrSlug) => {
  const s = String(idOrSlug ?? '');
  if (/^\d+$/.test(s)) return 'CL-' + s.padStart(4, '0');
  const cleaned = s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
  return 'CL-' + (cleaned || '0000');
};

// --- Paraguay phone normalize to wa.me digits (matches Detalle.html normalizePy) ---
export const normalizePy = (phone) => {
  const d = String(phone ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('595')) return d;
  if (d.startsWith('0')) return '595' + d.slice(1);
  return '595' + d;
};
