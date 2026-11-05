import AppDownloadClient from '@/components/AppDownloadClient';
import Footer from '@/components/Footer';
import { getLandingListings } from '@/lib/listings';
import { typeLabel } from '@/lib/propertyType';
import { fmtUsd } from '@/lib/ui';
import { COUNTRY } from '@/lib/country';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { storeForUserAgent } from '@/lib/appStoreFor';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Descargá la app de Casa-Libre — iPhone y Android',
  description:
    'La app de Casa-Libre, gratis en el App Store y en Google Play: buscá propiedades en el mapa, guardá favoritos y hablá directo por WhatsApp con quien publica.',
  alternates: { canonical: '/descargar' },
};

export default async function DescargarPage() {
  // a phone goes straight to its own store; a computer sees the page with both badges
  const store = storeForUserAgent(headers().get('user-agent'));
  if (store) redirect(store);
  // Same running-strip data as the home page.
  let ticker = [];
  try {
    const { listings } = await getLandingListings();
    ticker = listings
      .filter((l) => l.usd)
      .slice(0, 8)
      .map((l) => `${(l.neighborhood || l.city || COUNTRY.name).toUpperCase()} — ${(typeLabel(l.type, 'es') || 'Propiedad').toUpperCase()} — ${fmtUsd(l.usd, 'es')}${l.mode === 'alquiler' ? '/mes' : ''}`);
  } catch { /* ticker falls back to a default line */ }

  return (
    <>
      <AppDownloadClient tickerData={ticker} />
      <Footer />
    </>
  );
}
