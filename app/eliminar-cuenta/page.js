import MarketingShell from '@/components/MarketingShell';
import DeleteAccountPanel from '@/components/DeleteAccountPanel';

// Public "delete your account" page — the URL Google Play's Data safety form asks
// for (account deletion without reinstalling the app). Linked from /privacidad,
// /cuenta/ajustes and the mobile app's Account screen.
export const metadata = {
  title: 'Eliminar tu cuenta — Casa Libre',
  description: 'Cómo eliminar tu cuenta de Casa Libre y qué pasa con tus datos.',
  alternates: { canonical: '/eliminar-cuenta' },
};

export default function Page() {
  return (
    <MarketingShell>
      <DeleteAccountPanel />
    </MarketingShell>
  );
}
