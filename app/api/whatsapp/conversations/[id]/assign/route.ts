import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { setAssignment } from '@/lib/server/crm-store';

export const dynamic = 'force-dynamic';

// Admin: who handles this chat. Body: { agentId: string | null }.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  if (!/^\d{6,20}$/.test(params.id)) return NextResponse.json({ success: false, error: 'Conversación no válida.' }, { status: 400 });
  try {
    const { agentId } = await req.json().catch(() => ({}));
    const assignee = await setAssignment(params.id, typeof agentId === 'string' ? agentId : null);
    return NextResponse.json({ success: true, assignee });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}
