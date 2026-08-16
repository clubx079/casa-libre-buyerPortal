import { SITE } from '@/lib/site';

export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/cuenta', '/api/'] }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
