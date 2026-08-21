import EmpresasClient from '@/components/EmpresasClient';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Empresas y profesionales — Casa Libre',
  description:
    'Inmobiliarias, corredores y desarrolladores: publicá tu cartera en Casa Libre, el portal inmobiliario de más rápido crecimiento en Latam. Leads directos por WhatsApp, publicación instantánea, gratis durante el lanzamiento.',
  alternates: { canonical: '/empresas' },
};

export default function EmpresasPage() {
  return (
    <>
      <EmpresasClient />
      <Footer />
    </>
  );
}
