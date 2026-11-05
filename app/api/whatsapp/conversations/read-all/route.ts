import { NextResponse } from 'next/server';
import { cloudEnabled, db } from '@/lib/server/db';
import { chatScope, getAssignments } from '@/lib/server/crm-store';
import { getBotStates } from '@/lib/server/bot';

export const dynamic = 'force-dynamic';

// "Marcar todo como leído": every unread chat I can see, except the ones the assistant passed to a person.
export async function POST() {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    const [scope, assign, states] = await Promise.all([chatScope(), getAssignments(), getBotStates()]);
    const d = await db();
    const { data, error } = await d.from('wa_conversations').select('id').gt('unread_count', 0).limit(2000);
    if (error) throw new Error(error.message);
    const ids = (data || [])
      .map((r: any) => r.id as string)
      .filter((id) => (!scope.restricted || assign[id] === scope.agentId) && !(states[id]?.paused && states[id]?.reason === 'handoff'));
    for (let i = 0; i < ids.length; i += 200) {
      const { error: e2 } = await d.from('wa_conversations').update({ unread_count: 0 }).in('id', ids.slice(i, i + 200));
      if (e2) throw new Error(e2.message);
    }
    return NextResponse.json({ success: true, marked: ids.length });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes((e as any)?.status) ? (e as any).status : 500 });
  }
}
