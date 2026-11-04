import { NextRequest } from 'next/server';
import { createManualOrder } from '@/lib/server/manual-order';
import { currentOrgId, sessionUserId } from '@/lib/server/tenant';
import { rawDb } from '@/lib/server/supabase';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// "Nuevo pedido" (Pedidos, or inside a chat in Mensajes).
export async function POST(req: NextRequest) {
  try {
    await currentOrgId();
    const b = await req.json().catch(() => ({}));
    const uid = sessionUserId();
    const { data: me } = uid ? await rawDb().from('app_users').select('name, email').eq('id', uid).maybeSingle() : { data: null };
    const by = (me as any)?.name || (me as any)?.email || null;
    const conv = String(b.conversationId || '');
    const r = await createManualOrder({ ...b, conversationId: /^(?:\d{6,20}|[mi]\d{5,30})$/.test(conv) ? conv : null }, by);
    return typeof r === 'string' ? fail(r, 400) : ok({ order: r });
  } catch (e) {
    return failFrom(e);
  }
}
