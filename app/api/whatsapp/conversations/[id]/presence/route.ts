import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { assertCanSeeChat, getAgents, myAgent, othersOnChat, touchPresence } from '@/lib/server/crm-store';
import { sessionUserId } from '@/lib/server/tenant';
import { getUser } from '@/lib/server/accounts';

export const dynamic = 'force-dynamic';

// "I have this chat open / I'm writing". Body: { typing }. Returns who else is on it.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!cloudEnabled()) return NextResponse.json({ success: true, others: [] });
  if (!/^\d{6,20}$/.test(params.id)) return NextResponse.json({ success: false, error: 'Conversación no válida.' }, { status: 400 });
  try {
    await assertCanSeeChat(params.id);
    const { typing } = await req.json().catch(() => ({}));
    const uid = sessionUserId();
    const agent = await myAgent(await getAgents());
    const user = !agent && uid ? await getUser(uid).catch(() => null) : null;
    await touchPresence(params.id, { name: agent?.name || user?.name || user?.email?.split('@')[0] || 'Alguien del equipo', typing: Boolean(typing) });
    return NextResponse.json({ success: true, others: await othersOnChat(params.id) });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes(e?.status) ? e.status : 500 });
  }
}
