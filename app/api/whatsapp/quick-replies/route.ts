import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { getQuickReplies, saveQuickReplies } from '@/lib/server/crm-store';
import { cleanQuickReplies } from '@/lib/crm';

export const dynamic = 'force-dynamic';

const noDb = () => NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });

// Admin: saved replies for the WhatsApp inbox.
export async function GET() {
  if (!cloudEnabled()) return noDb();
  try {
    return NextResponse.json({ success: true, items: await getQuickReplies() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}

// Admin: replaces the whole list. Body: { items: QuickReply[] }.
export async function PUT(req: NextRequest) {
  if (!cloudEnabled()) return noDb();
  try {
    const { items } = await req.json().catch(() => ({}));
    const clean = cleanQuickReplies(items);
    if (typeof clean === 'string') return NextResponse.json({ success: false, error: clean }, { status: 400 });
    await saveQuickReplies(clean);
    return NextResponse.json({ success: true, items: clean });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}
