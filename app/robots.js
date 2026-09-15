import { SITE, INDEXABLE } from '@/lib/site';

// Generate robots.txt at REQUEST time, not at build time. Coolify provides
// SITE_INDEXABLE / APP_PUBLIC_URL as RUNTIME env (not Docker build args), so a
// static build sees INDEXABLE=false and would freeze `Disallow: /` — even though
// the running, env'd site is indexable (its <meta robots> already renders
// `index,follow` at runtime). force-dynamic makes robots.txt read the live value.
export const dynamic = 'force-dynamic';

export default function robots() {
  // #18 On staging/preview, block all crawling outright (belt-and-suspenders with
  // the noindex meta tag). Production advertises the sitemap and allows crawl.
  if (!INDEXABLE) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/cuenta', '/api/'] }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
