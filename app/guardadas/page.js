import MarketingShell from '@/components/MarketingShell';
import GuestSaved from '@/components/GuestSaved';

// Saved properties for visitors who aren't logged in (this browser's saves).
// Signed in → /cuenta/guardadas. Personal, so never indexed.
export const metadata = {
  title: 'Guardadas — Casa Libre',
  robots: { index: false, follow: false },
  alternates: { canonical: '/guardadas' },
};

export default function Page() {
  return (
    <MarketingShell>
      <section className="max-w-[1200px] mx-auto px-5 md:px-11 pt-8 pb-16">
        <GuestSaved />
      </section>
    </MarketingShell>
  );
}
