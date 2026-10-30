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
    if (!cloudEnabled()) return NextResponse.json({ cloud: false, auth: authEnabled(), capi: false, whatsapp: null, vapi: null });
  const [capi, whatsapp, vapi] = await Promise.all([capiEnabled(), whatsappStatus(), vapiStatus()]);
  return NextResponse.json({ cloud: true, auth: authEnabled(), capi, whatsapp, vapi });
}
