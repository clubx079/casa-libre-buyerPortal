import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = getSession();
  if (!s) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { id: s.uid, email: s.email, full_name: s.name || null } });
}
