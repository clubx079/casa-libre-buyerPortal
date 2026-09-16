import AppDownloadClient from '@/components/AppDownloadClient';
import Footer from '@/components/Footer';
import { getLandingListings } from '@/lib/listings';
import { typeLabel } from '@/lib/propertyType';
import { fmtUsd } from '@/lib/ui';
import { COUNTRY } from '@/lib/country';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'La app de Casa Libre — muy pronto',
  description:
    'La app de Casa Libre para iOS y Android está en camino: buscá propiedades, guardá favoritos y hablá directo por WhatsApp desde tu teléfono. Mientras tanto, usá la web — gratis.',
  alternates: { canonical: '/descargar' },
};

export default async function DescargarPage() {
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
