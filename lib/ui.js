// Small bilingual UI dictionary + formatting for the buyer marketplace.
export const T = {
  es: {
    tabs: [['Comprar', '/propiedades'], ['Alquilar', '/propiedades?op=alquiler'], ['Vender', '/publicar']],
    cta: 'Publicar gratis', all: 'Todas', venta: 'Venta', alquiler: 'Alquiler',
    results: (n) => `${n} propiedades`, perMonth: '/mes', beds: 'dorm', baths: 'baños',
    noImg: 'Foto próximamente', backToList: '← Volver', viewSource: 'Ver aviso original ↗',
    contact: 'Contactar', description: 'Descripción', location: 'Ubicación', features: 'Detalles',
    searchable: 'Buscar por ciudad o barrio…', forSale: 'En venta', forRent: 'En alquiler',
    heroTitle1: 'Tu próximo hogar', heroTitle2: 'en Paraguay',
    heroSub: 'Casas, departamentos y más — comprá y alquilá con Casa Libre.',
    heroCta: 'Ver propiedades', featured: 'Destacadas',
  },
  en: {
    tabs: [['Buy', '/propiedades'], ['Rent', '/propiedades?op=alquiler'], ['Sell', '/publicar']],
    cta: 'List for free', all: 'All', venta: 'For sale', alquiler: 'For rent',
    results: (n) => `${n} listings`, perMonth: '/mo', beds: 'bd', baths: 'ba',
    noImg: 'Photo coming soon', backToList: '← Back', viewSource: 'View original listing ↗',
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
export const shortUsd = (v) => (v == null ? '—' : 'US$ ' + Math.round(v / 1000) + 'k');
