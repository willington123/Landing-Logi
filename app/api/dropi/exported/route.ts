import { NextRequest } from 'next/server';
import { db } from '@/lib/server/db';
import { currentOrgId } from '@/lib/server/tenant';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Marks orders as downloaded in the Dropi Excel: { ids: string[] } (so the next download skips them).
export async function POST(req: NextRequest) {
  try {
    await currentOrgId();
    const b = await req.json().catch(() => ({}));
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter((x: string) => /^[\w-]{1,80}$/.test(x)).slice(0, 1000);
    if (!ids.length) return fail('No hay pedidos.', 400);
    const d = await db();
    const { data, error } = await d.from('orders').select('id, data').in('id', ids);
    if (error) throw new Error(error.message);
    const at = new Date().toISOString();
    await Promise.all(
      (data || []).map((r) => d.from('orders').update({ data: { ...(r.data as any), dropi: { ...((r.data as any)?.dropi || {}), exportedAt: at } } }).eq('id', r.id)),
    );
    return ok({ marked: (data || []).length, at });
  } catch (e) {
    return failFrom(e);
  }
}
