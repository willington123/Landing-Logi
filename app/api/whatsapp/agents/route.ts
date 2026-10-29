import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { getAgents, saveAgents } from '@/lib/server/crm-store';
import { cleanAgents } from '@/lib/crm';

export const dynamic = 'force-dynamic';

const noDb = () => NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });

// Admin: people on the team who answer chats.
export async function GET() {
  if (!cloudEnabled()) return noDb();
  try {
    return NextResponse.json({ success: true, items: await getAgents() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// Body: { items: Agent[] }. Chats assigned to someone removed become unassigned.
export async function PUT(req: NextRequest) {
  if (!cloudEnabled()) return noDb();
  try {
    const { items } = await req.json().catch(() => ({}));
    const clean = cleanAgents(items);
    if (typeof clean === 'string') return NextResponse.json({ success: false, error: clean }, { status: 400 });
    await saveAgents(clean);
    return NextResponse.json({ success: true, items: clean });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
