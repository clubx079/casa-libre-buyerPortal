import './globals.css';
import PostHogProvider from '@/components/PostHogProvider';
import AuthProvider from '@/components/AuthProvider';
import FavoritesProvider from '@/components/FavoritesProvider';
import { SITE, SITE_NAME, SITE_DESC, INDEXABLE } from '@/lib/site';

export const metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'Casa Libre — Propiedades en Paraguay | Comprar, Alquilar y Publicar',
    template: '%s | Casa Libre',
  },
  description: SITE_DESC,
  keywords: ['propiedades Paraguay', 'casas en Asunción', 'departamentos Paraguay', 'comprar casa Paraguay', 'alquilar departamento Asunción', 'inmuebles Paraguay', 'publicar propiedad gratis'],
  icons: { icon: '/favicon.png', shortcut: '/favicon.png', apple: '/favicon.png' },
  alternates: { canonical: '/' },
  // Google Search Console site ownership verification.
  verification: { google: 'pYOvxtOG8ggKnLLL8itfNb1yBjuAHWeZ6cHzk7Tl87E' },
  openGraph: { title: 'Casa Libre — Propiedades en Paraguay', description: SITE_DESC, url: SITE, siteName: SITE_NAME, locale: 'es_PY', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Casa Libre — Propiedades en Paraguay', description: SITE_DESC },
  // #18 Non-production hosts return noindex,nofollow so staging isn't indexed.
  robots: INDEXABLE
    ? { index: true, follow: true }
    : { index: false, follow: false, googleBot: { index: false, follow: false } },
};

// Site-wide structured data: an Organization entity + a WebSite with a
// sitelinks-searchbox SearchAction. These are the signals Google uses to build
// the brand knowledge panel and sitelinks.
const orgLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE,
  logo: `${SITE}/logo.png`,
  description: SITE_DESC,
  areaServed: { '@type': 'Country', name: 'Paraguay' },
};
const siteLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE,
  inLanguage: 'es-PY',
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/propiedades?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteLd) }} />
        <PostHogProvider>
          <AuthProvider>
            <FavoritesProvider>{children}</FavoritesProvider>
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
