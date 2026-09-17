// Central site config for SEO (metadata, sitemap, JSON-LD, footer). Per-country
// values now come from lib/country.js (selected by NEXT_PUBLIC_COUNTRY); the base
// URL stays overridable via APP_PUBLIC_URL. Paraguay defaults are unchanged.
import { COUNTRY } from './country';

export const SITE = (process.env.APP_PUBLIC_URL || COUNTRY.defaultUrl).replace(/\/$/, '');

// #18 Only the real production domain should be indexed by search engines.
// Staging/preview hosts (the default *.apps.airosofts.com) return noindex so
// Google never indexes a test copy that would compete with the real site.
// Flip it on in production: set SITE_INDEXABLE=true, or point APP_PUBLIC_URL at
// a real domain (anything that isn't an apps.airosofts.com host).
// Default to INDEXABLE=true and only opt OUT for a known preview host
// (*.apps.airosofts.com) or an explicit SITE_INDEXABLE=false. This MUST default
// true: statically-prerendered pages (/comprar, /alquilar, /propiedades-en/*,
// /comparar/*, /vender, …) evaluate this at BUILD time, when the per-service
// SITE_INDEXABLE/APP_PUBLIC_URL env may be absent — the old `=== 'true'` default
// then froze `noindex,nofollow` into every static page on production. Runtime
// behavior is unchanged (prod → true, *.apps.airosofts.com → false, and the
// runtime robots.txt still blocks crawling on any non-indexable host).
export const INDEXABLE =
  process.env.SITE_INDEXABLE !== 'false' &&
  !/apps\.airosofts\.com/i.test(process.env.APP_PUBLIC_URL || '');
export const SITE_NAME = COUNTRY.brand;
export const SITE_TAGLINE = COUNTRY.tagline;
export const SITE_DESC = COUNTRY.desc;

// Cities we build dedicated SEO landing pages for (/propiedades-en/<slug>).
export const CITIES = COUNTRY.cities;
export const cityBySlug = (slug) => CITIES.find((c) => c.slug === slug) || null;

// Competitor comparison pages (/comparar/<slug>) — top local real-estate sites.
export const COMPETITORS = COUNTRY.competitors;
export const competitorBySlug = (slug) => COMPETITORS.find((c) => c.slug === slug) || null;
