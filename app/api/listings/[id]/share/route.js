// GET /api/listings/<id>/share — the listing's share kit (lib/shareApi.js has the contract).
import { shareResponse } from '@/lib/shareApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(req, { params }) {
  return shareResponse(req, String(params?.id || ''));
}
