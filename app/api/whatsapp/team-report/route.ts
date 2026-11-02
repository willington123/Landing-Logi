import { NextRequest, NextResponse } from 'next/server';
import { cloudEnabled, db } from '@/lib/server/db';
import { getAgents, getAssignments } from '@/lib/server/crm-store';
import { currentRole } from '@/lib/server/tenant';

export const dynamic = 'force-dynamic';

const CONFIRMED = new Set(['confirmed_by_voice', 'shipped', 'delivered']);

export interface TeamRow {
  key: string;
  name: string;
  color: string | null;
  assigned: number; // chats assigned now
  chats: number; // chats they answered in the period
  messages: number; // replies they sent
  medianReplyMin: number | null; // how long customers waited for their reply (median, minutes)
  orders: number; // orders from their chats in the period
  confirmed: number;
  revenue: number;
}

async function rows<T>(build: (from: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await build(from);
    if (error) throw new Error(error.message);
    out.push(...((data || []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// Owners and admins: what each person on the team did in the last 7 or 30 days.
export async function GET(req: NextRequest) {
  if (!cloudEnabled()) return NextResponse.json({ success: false, error: 'La base de datos no está configurada.' }, { status: 503 });
  try {
    const role = await currentRole();
    if (role !== 'owner' && role !== 'admin') return NextResponse.json({ success: false, error: 'Solo el dueño o un administrador ven el rendimiento del equipo.' }, { status: 403 });
    const days = req.nextUrl.searchParams.get('days') === '30' ? 30 : 7;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const d = await db();
    const [agents, assign, msgs, orders, convs] = await Promise.all([
      getAgents(),
      getAssignments(),
      rows<{ conversation_id: string; direction: 'in' | 'out'; created_at: string; by: { uid?: string; name?: string } | null }>((f) =>
        d.from('wa_messages').select('conversation_id, direction, created_at, by:payload->by').gte('created_at', since).order('created_at', { ascending: true }).range(f, f + 999),
      ),
      rows<{ id: string; status: string; total: number | string | null; from: string | null }>((f) =>
        d.from('orders').select('id, status, total:data->totalAmount, from:data->>whatsappFrom').gte('created_at', since).order('created_at', { ascending: true }).range(f, f + 999),
      ),
      rows<{ id: string; order_id: string | null }>((f) => d.from('wa_conversations').select('id, order_id').not('order_id', 'is', null).range(f, f + 999)),
    ]);

    const table = new Map<string, TeamRow & { waits: number[]; convs: Set<string> }>();
    const row = (key: string, name: string, color: string | null) => {
      if (!table.has(key)) table.set(key, { key, name, color, assigned: 0, chats: 0, messages: 0, medianReplyMin: null, orders: 0, confirmed: 0, revenue: 0, waits: [], convs: new Set() });
      return table.get(key)!;
    };
    for (const a of agents) row(a.id, a.name, a.color);
    const byUser = new Map(agents.filter((a) => a.userId).map((a) => [a.userId as string, a]));
    const keyFor = (by: { uid?: string; name?: string }) => {
      const a = by.uid ? byUser.get(by.uid) : undefined;
      return a ? row(a.id, a.name, a.color) : row(`u:${by.uid || by.name}`, by.name || 'Equipo', null);
    };

    for (const id of Object.values(assign)) if (table.has(id)) table.get(id)!.assigned++;

    // Replies and waiting time: from the first unanswered customer message to the next reply by a person.
    const waiting = new Map<string, number>();
    for (const m of msgs) {
      const t = new Date(m.created_at).getTime();
      if (m.direction === 'in') {
        if (!waiting.has(m.conversation_id)) waiting.set(m.conversation_id, t);
        continue;
      }
      const start = waiting.get(m.conversation_id);
      waiting.delete(m.conversation_id); // any reply (also the assistant's) answers the customer
      if (!m.by || (!m.by.uid && !m.by.name)) continue;
      const r = keyFor(m.by);
      r.messages++;
      r.convs.add(m.conversation_id);
      if (start !== undefined) r.waits.push((t - start) / 60000);
    }

    // Orders from chats: the order linked to the chat, or the chat it was confirmed from.
    const convOfOrder = new Map<string, string>();
    for (const c of convs) if (c.order_id) convOfOrder.set(c.order_id, c.id);
    for (const o of orders) {
      const conv = convOfOrder.get(o.id) || o.from || '';
      const who = conv ? assign[conv] : undefined;
      if (!who || !table.has(who)) continue;
      const r = table.get(who)!;
      r.orders++;
      if (CONFIRMED.has(o.status)) {
        r.confirmed++;
        r.revenue += Number(o.total) || 0;
      }
    }

    const out: TeamRow[] = Array.from(table.values()).map(({ waits, convs, ...r }) => {
      const s = waits.sort((a, b) => a - b);
      return { ...r, chats: convs.size, medianReplyMin: s.length ? Math.round(s[Math.floor(s.length / 2)] * 10) / 10 : null };
    });
    return NextResponse.json({ success: true, days, rows: out.filter((r) => r.messages || r.assigned || r.orders || !r.key.startsWith('u:')) });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: [401, 402, 403].includes(e?.status) ? e.status : 500 });
  }
}
