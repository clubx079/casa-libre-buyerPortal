// Central site config for SEO (metadata, sitemap, JSON-LD, footer). The canonical
// base URL is configurable via APP_PUBLIC_URL; swap it for the real domain
// (e.g. https://casalibre.py) when it goes live.
export const SITE = (process.env.APP_PUBLIC_URL || 'https://casa-libre-buyerportal.apps.airosofts.com').replace(/\/$/, '');
export const SITE_NAME = 'Casa Libre';
export const SITE_TAGLINE = 'Propiedades en Paraguay';
export const SITE_DESC = 'Casa Libre es el marketplace de propiedades en Paraguay. Comprá, alquilá y publicá casas, departamentos, dúplex y locales en Asunción y todo el país — gratis.';

// Cities we build dedicated SEO landing pages for (/propiedades-en/<slug>).
export const CITIES = [
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
];
export const cityBySlug = (slug) => CITIES.find((c) => c.slug === slug) || null;

// Competitor comparison pages (/comparar/<slug>) — top Paraguay real-estate sites.
export const COMPETITORS = [
  { slug: 'infocasas', name: 'InfoCasas', blurb: 'un portal de clasificados con suscripciones pagas para destacar.', blurbEn: 'a classifieds portal with paid subscriptions to feature listings.' },
  { slug: 'clasipar', name: 'Clasipar', blurb: 'un sitio de clasificados general donde las propiedades compiten con todo tipo de avisos.', blurbEn: 'a general classifieds site where properties compete with all kinds of ads.' },
  { slug: 'remax-paraguay', name: 'RE/MAX Paraguay', blurb: 'una red de inmobiliarias con comisiones sobre la venta.', blurbEn: 'a network of real-estate agencies charging commissions on sales.' },
  { slug: 'properati', name: 'Properati', blurb: 'un portal regional de avisos inmobiliarios con planes pagos.', blurbEn: 'a regional real-estate listings portal with paid plans.' },
  { slug: 'mercadolibre-inmuebles', name: 'Mercado Libre Inmuebles', blurb: 'la sección de inmuebles de un marketplace general.', blurbEn: 'the real-estate section of a general marketplace.' },
  { slug: 'century-21-paraguay', name: 'Century 21 Paraguay', blurb: 'una franquicia de inmobiliarias tradicionales.', blurbEn: 'a franchise of traditional real-estate agencies.' },
];
export const competitorBySlug = (slug) => COMPETITORS.find((c) => c.slug === slug) || null;
