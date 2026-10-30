import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { getTags, saveTags } from '@/lib/server/crm-store';
import { cleanTags } from '@/lib/crm';

export const dynamic = 'force-dynamic';

const noDb = () => NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });

// Admin: tags available for WhatsApp conversations.
export async function GET() {
  if (!cloudEnabled()) return noDb();
  try {
    return NextResponse.json({ success: true, items: await getTags() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: (e as any)?.status === 401 ? 401 : 500 });
  }
}

// Admin: replaces the whole list. Body: { items: CrmTag[] }. Deleted tags disappear from conversations.
export async function PUT(req: NextRequest) {
  if (!cloudEnabled()) return noDb();
  try {
    const { items } = await req.json().catch(() => ({}));
    const clean = cleanTags(items);
    if (typeof clean === 'string') return NextResponse.json({ success: false, error: clean }, { status: 400 });
    await saveTags(clean);
    return NextResponse.json({ success: true, items: clean });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: (e as any)?.status === 401 ? 401 : 500 });
  }
}
