// GET /api/mobile/listings/<id>/share — the same share kit for the app (lib/shareApi.js).
// The app signs in with the same cl_session cookie (app/api/auth/mobile-exchange), so the
// owner's stats come exactly as on the website.
import { NextResponse } from 'next/server';
import { shareResponse } from '@/lib/shareApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { 'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}

export function GET(req, { params }) {
  return shareResponse(req, String(params?.id || ''));
}
