/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Images are served through the /api/media proxy (private Backblaze bucket),
  // rendered with plain <img>, so the next/image optimizer stays unconfigured.

  // #17 Canonical consolidation — permanent (301) redirects fold common English
  // aliases and legacy paths into the single canonical Spanish route per intent,
  // so external links and old URLs don't split ranking signals across duplicates.
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
