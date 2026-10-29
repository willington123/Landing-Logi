import { NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { unreadSummary } from '@/lib/server/wa-store';

export const dynamic = 'force-dynamic';

// Admin: unread WhatsApp messages (menu badge and new-message sound).
export async function GET() {
  if (!cloudEnabled()) return NextResponse.json({ success: true, unread: 0, chats: 0, lastInboundAt: null });
  try {
    return NextResponse.json({ success: true, ...(await unreadSummary()) });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
