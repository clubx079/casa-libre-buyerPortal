import AppDownloadClient from '@/components/AppDownloadClient';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'La app de Casa Libre — muy pronto',
  description:
    'La app de Casa Libre para iOS y Android está en camino: buscá propiedades, guardá favoritos y hablá directo por WhatsApp desde tu teléfono. Mientras tanto, usá la web — gratis.',
  alternates: { canonical: '/app' },
};

export default function AppPage() {
  return (
    <>
      <AppDownloadClient />
      <Footer />
    </>
  );
}
