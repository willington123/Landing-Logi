import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { authEnabled } from '@/lib/auth';
import { capiEnabled } from '@/lib/server/meta-capi';
import { whatsappStatus } from '@/lib/server/whatsapp';
import { vapiStatus } from '@/lib/server/vapi';
import { maybeRunScheduled } from '@/lib/server/scheduled';

export const dynamic = 'force-dynamic';

// Tells the panel whether landings and orders are stored in Supabase.
export async function GET(req: NextRequest) {
  // Opening the panel also checks pending scheduled work (at most every few minutes).
  await maybeRunScheduled(req.nextUrl.origin, 'panel');
  return NextResponse.json({ cloud: cloudEnabled(), auth: authEnabled(), capi: capiEnabled(), whatsapp: whatsappStatus(), vapi: vapiStatus() });
}
