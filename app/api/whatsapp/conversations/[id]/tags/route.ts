import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { setConversationTags } from '@/lib/server/crm-store';

export const dynamic = 'force-dynamic';

// Admin: set the tags of one conversation. Body: { tags: string[] } (tag ids).
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  if (!/^\d{6,20}$/.test(params.id)) return NextResponse.json({ success: false, error: 'Conversación no válida.' }, { status: 400 });
  try {
    const { tags } = await req.json().catch(() => ({}));
    if (!Array.isArray(tags)) return NextResponse.json({ success: false, error: 'Etiquetas inválidas.' }, { status: 400 });
    const saved = await setConversationTags(params.id, tags.map(String).slice(0, 30));
    return NextResponse.json({ success: true, tags: saved });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
