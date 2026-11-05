// /publicar → the home page with the sell form already open (user, Nov 5 2026: every "list your
// property" link lands there). Every link in the wild points at /publicar — emails, automations,
// WhatsApp replies and template buttons, the Inbox assistant (/r/ai?u=/publicar), marketing pages,
// the mobile app — so this one redirect covers them all, including messages already sent.
import { redirect } from 'next/navigation';
import { publicarTarget } from '@/lib/publicarTarget';

export const dynamic = 'force-dynamic';

export default function PublicarPage({ searchParams }) {
  redirect(publicarTarget(searchParams));
}
