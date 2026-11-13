/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // sharp is a native module used server-side (Casa Libre logo stamping in
  // /api/publish) — keep it external so Next never tries to bundle the binary.
  experimental: { serverComponentsExternalPackages: ['sharp'] },
  // Images are served through the /api/media proxy (private Backblaze bucket),
  // rendered with plain <img>, so the next/image optimizer stays unconfigured.

  // #17 Canonical consolidation — permanent (301) redirects fold common English
  // aliases and legacy paths into the single canonical Spanish route per intent,
  // so external links and old URLs don't split ranking signals across duplicates.
  // Private pages (account dashboard, saved, delete account): never in Google. Sent as a header so it
  // covers client-rendered pages too; robots.txt no longer blocks /cuenta, so Google can read it.
  async headers() {
    const noindex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
    return ['/cuenta', '/cuenta/:path*', '/eliminar-cuenta', '/guardadas'].map((source) => ({ source, headers: noindex }));
  },
  async redirects() {
    return [
      { source: '/buy', destination: '/comprar', permanent: true },
      { source: '/rent', destination: '/alquilar', permanent: true },
      { source: '/sell', destination: '/vender', permanent: true },
      { source: '/properties', destination: '/propiedades', permanent: true },
      { source: '/property/:slug', destination: '/propiedad/:slug', permanent: true },
      { source: '/listings', destination: '/propiedades', permanent: true },
      { source: '/how-it-works', destination: '/como-funciona', permanent: true },
      { source: '/about', destination: '/nuestra-historia', permanent: true },
      { source: '/contact', destination: '/contacto', permanent: true },
      { source: '/faq', destination: '/preguntas-frecuentes', permanent: true },
      { source: '/terms', destination: '/terminos', permanent: true },
      { source: '/privacy', destination: '/privacidad', permanent: true },
    ];
  },
};
module.exports = nextConfig;
