import './globals.css';
import PostHogProvider from '@/components/PostHogProvider';
import AuthProvider from '@/components/AuthProvider';
import FavoritesProvider from '@/components/FavoritesProvider';
import SellFlowProvider from '@/components/SellFlow';
import { SITE, SITE_NAME, SITE_DESC, INDEXABLE } from '@/lib/site';
import { COUNTRY } from '@/lib/country';
import { GTM_ID } from '@/lib/dataLayer';

export const metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: `${COUNTRY.brand} — ${COUNTRY.tagline} | Comprar, Alquilar y Publicar`,
    template: `%s | ${COUNTRY.brand}`,
  },
  description: SITE_DESC,
  keywords: COUNTRY.seoKeywords,
  icons: { icon: '/favicon.png', shortcut: '/favicon.png', apple: '/favicon.png' },
  alternates: { canonical: '/' },
  // Google Search Console site ownership verification (per-country token).
  verification: COUNTRY.gscToken ? { google: COUNTRY.gscToken } : undefined,
  openGraph: { title: `${COUNTRY.brand} — ${COUNTRY.tagline}`, description: SITE_DESC, url: SITE, siteName: SITE_NAME, locale: COUNTRY.ogLocale, type: 'website' },
  twitter: { card: 'summary_large_image', title: `${COUNTRY.brand} — ${COUNTRY.tagline}`, description: SITE_DESC },
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
  areaServed: { '@type': 'Country', name: COUNTRY.name },
};
const siteLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE,
  inLanguage: COUNTRY.locale,
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/propiedades?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
};

// Google Tag Manager — only when NEXT_PUBLIC_GTM_ID is set (build arg). site_country
// is pushed before the container loads so every tag can read it from the start.
const gtmBoot = GTM_ID
  ? `window.dataLayer=window.dataLayer||[];window.dataLayer.push({site_country:${JSON.stringify(COUNTRY.code)}});` +
    `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(GTM_ID)});`
  : null;

export default function RootLayout({ children }) {
  return (
    <html lang={COUNTRY.htmlLang}>
      <body>
        {/* Runtime country → client (read by lib/country.js in the browser). Must run
            before the app bundle hydrates, so it's the first thing in <body>. */}
        <script dangerouslySetInnerHTML={{ __html: `window.__CL_COUNTRY__=${JSON.stringify(COUNTRY.code)}` }} />
        {gtmBoot && (
          <>
            <noscript>
              <iframe src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(GTM_ID)}`} height="0" width="0" style={{ display: 'none', visibility: 'hidden' }} />
            </noscript>
            {/* Plain inline script (not next/script's afterInteractive) so site_country is in
                the dataLayer before any component's first event, e.g. property_viewed. */}
            <script dangerouslySetInnerHTML={{ __html: gtmBoot }} />
          </>
        )}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteLd) }} />
        <PostHogProvider>
          <AuthProvider>
            <SellFlowProvider>
              <FavoritesProvider>{children}</FavoritesProvider>
            </SellFlowProvider>
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
