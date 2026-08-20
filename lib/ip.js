// Best-effort client IP extraction from proxy/CDN headers.
import 'server-only';

export function getClientIP(req) {
  const h = req.headers;
  const cf = h.get('cf-connecting-ip'); if (cf) return cf.trim();
  const xff = h.get('x-forwarded-for'); if (xff) return xff.split(',')[0].trim();
  const xr = h.get('x-real-ip'); if (xr) return xr.trim();
  const xv = h.get('x-vercel-forwarded-for'); if (xv) return xv.split(',')[0].trim();
  return null;
}
