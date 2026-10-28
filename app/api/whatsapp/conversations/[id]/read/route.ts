import { NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { markConversationRead } from '@/lib/server/wa-store';

export const dynamic = 'force-dynamic';

// Admin: mark a conversation as read.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  if (!/^\d{6,20}$/.test(params.id)) return NextResponse.json({ success: false, error: 'Conversación no válida.' }, { status: 400 });
  try {
    await markConversationRead(params.id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
