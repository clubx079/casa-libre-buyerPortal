// casa-libre.com.py/casa-limpia/<code> — a person's short tracked link (lib/partnerLinks.js).
import { openPartnerLink } from '@/lib/partnerLinks';

export const dynamic = 'force-dynamic';
export const GET = (req, { params }) => openPartnerLink(req, 'casa-limpia', params.code);
