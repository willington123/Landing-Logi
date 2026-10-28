import { NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { listConversations } from '@/lib/server/wa-store';
import { whatsappStatus } from '@/lib/server/whatsapp';

export const dynamic = 'force-dynamic';

// Admin: WhatsApp conversations, newest first, with the linked order.
export async function GET() {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    return NextResponse.json({ success: true, conversations: await listConversations(), whatsapp: whatsappStatus() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
