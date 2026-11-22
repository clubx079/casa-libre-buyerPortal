// /compartir/<id> — a listing's share page: the share kit (image, captions, one tracked link
// per network) and, for the signed-in owner, what the links brought + the reward.
// The "Compartir mi propiedad" button of the share emails lands here (lib/automations/shareListing.js).
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getListing } from '@/lib/listings';
import { typeLabel } from '@/lib/propertyType';
import ShareSheet from '@/components/ShareSheet';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Compartir mi propiedad', robots: { index: false, follow: false } };
}

export default async function CompartirPage({ params }) {
  const l = await getListing(String(params?.id || ''));
  if (!l) notFound();
  const title = [typeLabel(l.type, 'es') || 'Propiedad', l.neighborhood || l.city].filter(Boolean).join(' · ');
  return (
    <main className="max-w-[720px] mx-auto px-5 pt-8 pb-24">
      <Link href={`/propiedad/${l.id}`} className="font-mono text-[12px] text-ink/55 hover:text-ink">← {title}</Link>
      <div className="mt-4 bg-paper border-[1.5px] border-ink rounded-[22px] shadow-hard p-5 sm:p-7">
        <ShareSheet listingId={l.id} inline source="share_page" />
      </div>
    </main>
  );
}
