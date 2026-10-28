import { NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { authEnabled } from '@/lib/auth';
import { capiEnabled } from '@/lib/server/meta-capi';
import { whatsappStatus } from '@/lib/server/whatsapp';
import { vapiStatus } from '@/lib/server/vapi';

export const dynamic = 'force-dynamic';

// Tells the panel whether landings and orders are stored in Supabase.
export async function GET() {
  return NextResponse.json({ cloud: cloudEnabled(), auth: authEnabled(), capi: capiEnabled(), whatsapp: whatsappStatus(), vapi: vapiStatus() });
}
