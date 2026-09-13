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
export const INDEXABLE =
  process.env.SITE_INDEXABLE === 'true' ||
  (!!process.env.APP_PUBLIC_URL && !/apps\.airosofts\.com/i.test(process.env.APP_PUBLIC_URL));
export const SITE_NAME = COUNTRY.brand;
export const SITE_TAGLINE = COUNTRY.tagline;
export const SITE_DESC = COUNTRY.desc;

// Cities we build dedicated SEO landing pages for (/propiedades-en/<slug>).
export const CITIES = COUNTRY.cities;
export const cityBySlug = (slug) => CITIES.find((c) => c.slug === slug) || null;

// Competitor comparison pages (/comparar/<slug>) — top local real-estate sites.
export const COMPETITORS = COUNTRY.competitors;
export const competitorBySlug = (slug) => COMPETITORS.find((c) => c.slug === slug) || null;
