// The site's PUBLIC address for redirects from route handlers. Behind the hosting proxy
// `req.url` is the container's own address (https://localhost:3000), so a redirect built
// from it sends people to localhost. APP_PUBLIC_URL first, then the proxy's forwarded
// host, then the request itself (local dev).
export function publicOrigin(req) {
  const env = String(process.env.APP_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (env) return env;
  const h = req.headers;
  const host = (h.get('x-forwarded-host') || h.get('host') || '').split(',')[0].trim();
  if (host && !/^(localhost|127\.0\.0\.1)(:|$)/i.test(host)) {
    const proto = (h.get('x-forwarded-proto') || 'https').split(',')[0].trim();
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;
}
