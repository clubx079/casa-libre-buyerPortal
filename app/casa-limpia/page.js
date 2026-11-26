// casa-libre.com.py/casa-limpia — preview of CasaLimpia as a Casa-Libre service partner:
// company profile, how it shows on a listing, and the founding-partner price with a Stripe
// pay button. Paraguay only (404 elsewhere), kept out of search engines.
import { notFound } from 'next/navigation';
import { getPartner } from '@/lib/partners';
import { partnerPagesOn, confirmPartnerPayment } from '@/lib/partnerServer';
import { COUNTRY } from '@/lib/country';
import PartnerPage from '@/components/partner/PartnerPage';
import './partner.css';

export const dynamic = 'force-dynamic';
const SLUG = 'casa-limpia';

export const metadata = {
  title: 'CasaLimpia en Casa-Libre · Socio de servicios',
  description: 'Vista previa del perfil de CasaLimpia como socio de servicios de Casa-Libre.',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  alternates: { canonical: `/${SLUG}` },
};

export default async function CasaLimpiaPage({ searchParams }) {
  if (!partnerPagesOn()) notFound();
  const partner = getPartner(SLUG);
  const sp = (await searchParams) || {};
  let payState = sp.pago === 'cancelado' ? 'canceled' : sp.pago === 'error' ? 'error' : null;
  if (sp.pago === 'ok' && sp.session_id) {
    const r = await confirmPartnerPayment(partner, sp.session_id);
    payState = r.paid ? 'paid' : 'pending';
  }
  // The short-link list (code → person) stays on the server.
  const { links, ...pagePartner } = partner;
  return <PartnerPage partner={pagePartner} payState={payState} contact={{ whatsapp: COUNTRY.businessWhatsApp, email: COUNTRY.supportEmail }} />;
}
