import { NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { authEnabled } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Tells the panel whether landings and orders are stored in Supabase.
export async function GET() {
  return NextResponse.json({ cloud: cloudEnabled(), auth: authEnabled() });
}
