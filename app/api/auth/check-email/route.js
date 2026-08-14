import { NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { email } = await req.json().catch(() => ({}));
  if (!email) return NextResponse.json({ error: 'missing_email' }, { status: 400 });
  const user = await findUserByEmail(email).catch(() => null);
  return NextResponse.json({ exists: !!user });
}
