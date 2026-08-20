import { SITE, INDEXABLE } from '@/lib/site';

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
