import { NextRequest } from 'next/server';
import { cloudEnabled, db } from '@/lib/server/db';
import { samePhone } from '@/lib/server/wa-store';
import { chatScope, getAgents, getAssignments, getConversationAds, getConversationTags, getTags, myAgent } from '@/lib/server/crm-store';
import { botConfigured, getBotSettings, getBotStates } from '@/lib/server/bot';
import { rangeFromQuery } from '@/lib/server/ads-report';
import { shouldResume } from '@/lib/bot';
import { RETAKE_AFTER_MS, WINDOW_MS, type HomeChat, type HomeData } from '@/lib/home';
import type { OrderItem } from '@/lib/types';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CONFIRMED = new Set(['confirmed_by_voice', 'shipped', 'delivered']);
const LIST_MAX = 50;
const PAGE = 1000;
const MAX_PAGES = 60;

// Supabase returns at most 1000 rows per request.
async function paged<T>(query: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    const { data, error } = await query(p * PAGE, p * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...((data || []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const chunks = <T,>(list: T[], n = 200) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

// Inicio: chats that need a person, chats to pick up again, sales of the period and how much the AI handled alone.
export async function GET(req: NextRequest) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    const { range, fromIso, toIso, since, until } = rangeFromQuery(req.nextUrl.searchParams, 'today');
    const now = Date.now();
    const [states, settings, configured, agents, assign, tagMap, tags, ads, scope] = await Promise.all([
      getBotStates(),
      getBotSettings(),
      botConfigured(),
      getAgents(),
      getAssignments(),
      getConversationTags(),
      getTags(),
      getConversationAds().catch(() => ({}) as Record<string, unknown>),
      chatScope(),
    ]);
    const me = await myAgent(agents);
    // Members who only see their chats get numbers of just those.
    const visible = (id: string) => !scope.restricted || assign[id] === scope.agentId;
    const d = await db();

    // Waiting for a person: the AI handed it over (or hit the daily limit) and nobody has written yet.
    const helpIds = Object.entries(states)
      .filter(([id, s]) => s.paused && (s.reason === 'handoff' || s.reason === 'limit') && visible(id))
      .map(([id]) => id);

    // The AI answered last, the customer has been quiet for 2 h and there's still time inside the 24 h window.
    const { data: quiet, error: quietErr } = await d
      .from('wa_conversations')
      .select('*')
      .gte('last_inbound_at', new Date(now - WINDOW_MS).toISOString())
      .lte('last_inbound_at', new Date(now - RETAKE_AFTER_MS).toISOString())
      .is('order_id', null)
      .order('last_inbound_at', { ascending: false })
      .limit(1000);
    if (quietErr) throw new Error(quietErr.message);
    let retakeRows = (quiet || []).filter(
      (c: any) => c.last_message_at && c.last_message_at > c.last_inbound_at && !states[c.id]?.paused && visible(c.id),
    );
    if (retakeRows.length) {
      // Already ordered from a landing or another chat.
      const { data: recent } = await d.from('orders').select('data').gte('created_at', new Date(now - 2 * 86400_000).toISOString()).limit(1000);
      const orders = (recent || []).map((r: any) => r.data as OrderItem);
      retakeRows = retakeRows.filter((c: any) => !orders.some((o) => samePhone(o as any, c.id)));
    }

    // Conversation rows and linked orders for the lists.
    const helpRows: any[] = [];
    for (const ids of chunks(helpIds)) {
      const { data, error } = await d.from('wa_conversations').select('*').in('id', ids);
      if (error) throw new Error(error.message);
      helpRows.push(...(data || []));
    }
    const sortedHelp = helpRows.sort((a, b) => String(states[b.id]?.pausedAt || '').localeCompare(String(states[a.id]?.pausedAt || '')));
    const shown = [...sortedHelp.slice(0, LIST_MAX), ...retakeRows.slice(0, LIST_MAX)];
    const orderIds = Array.from(new Set(shown.map((c) => c.order_id).filter(Boolean))) as string[];
    const orderById: Record<string, HomeChat['order']> = {};
    if (orderIds.length) {
      const { data, error } = await d.from('orders').select('id, status, data').in('id', orderIds);
      if (error) throw new Error(error.message);
      for (const r of data || []) {
        const o = r.data as OrderItem;
        orderById[r.id] = { number: o.orderNumber, status: r.status, product: o.comboName ? `${o.productName} · ${o.comboName}` : o.productName, total: Number(o.totalAmount) || 0 };
      }
    }
    const tagById = Object.fromEntries(tags.map((t) => [t.id, t]));
    const agentName = (id: string) => agents.find((a) => a.id === assign[id])?.name || null;
    const toChat = (c: any, reason: HomeChat['reason']): HomeChat => ({
      id: c.id,
      name: c.name || (/^\d/.test(c.id) ? `+${c.id}` : 'Cliente'),
      preview: c.last_message || '',
      since: reason === 'retake' ? c.last_message_at : states[c.id]?.pausedAt || c.last_message_at,
      lastInboundAt: c.last_inbound_at,
      waiting: Boolean(c.last_inbound_at && (!c.last_message_at || c.last_inbound_at >= c.last_message_at)),
      note: reason === 'retake' ? '' : states[c.id]?.note || '',
      reason,
      tags: (tagMap[c.id] || []).map((t) => tagById[t]).filter(Boolean).map((t) => ({ name: t.name, color: t.color })),
      order: (c.order_id && orderById[c.order_id]) || null,
      assignee: agentName(c.id),
      fromAd: Boolean((ads as Record<string, unknown>)[c.id]),
    });

    // Chats a person took over and are still with them (they go back to the AI after the hours the store chose).
    const attending = Object.entries(states).filter(
      ([id, s]) => s.paused && s.reason === 'human' && !shouldResume(s, settings, now) && visible(id) && (!me || assign[id] === me.id),
    ).length;

    // Sales of the period.
    const orders = await paged<{ status: string; total: number | string | null }>((a, b) =>
      d.from('orders').select('status, total:data->totalAmount').gte('created_at', fromIso).lte('created_at', toIso).order('created_at', { ascending: true }).range(a, b),
    );
    const confirmed = orders.filter((o) => CONFIRMED.has(o.status));

    // Chats of the period: who answered them.
    const msgs = await paged<{ conversation_id: string; direction: string; type: string; by: string | null }>((a, b) =>
      d
        .from('wa_messages')
        .select('conversation_id, direction, type, by:payload->by->>uid')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: true })
        .range(a, b),
    );
    const chats = new Set<string>();
    const botChats = new Set<string>();
    const teamChats = new Set<string>();
    for (const m of msgs) {
      if (!visible(m.conversation_id)) continue;
      if (m.direction === 'in') chats.add(m.conversation_id);
      else if (m.type === 'bot') botChats.add(m.conversation_id);
      else if (m.by) teamChats.add(m.conversation_id);
    }
    const solo = Array.from(botChats).filter((id) => chats.has(id) && !teamChats.has(id) && !states[id]?.paused).length;
    const teamInPeriod = Array.from(teamChats).filter((id) => chats.has(id)).length;

    const { count: anyChat } = await d.from('wa_conversations').select('id', { count: 'exact', head: true });

    const data: HomeData = {
      range,
      since,
      until,
      hasChats: Boolean(anyChat),
      bot: { enabled: settings.enabled && configured, name: settings.name },
      help: { count: helpIds.length, items: sortedHelp.slice(0, LIST_MAX).map((c) => toChat(c, states[c.id]?.reason === 'limit' ? 'limit' : 'handoff')) },
      retake: { count: retakeRows.length, items: retakeRows.slice(0, LIST_MAX).map((c) => toChat(c, 'retake')) },
      sales: { count: confirmed.length, revenue: confirmed.reduce((n, o) => n + (Number(o.total) || 0), 0) },
      attending: { count: attending, mine: Boolean(me) },
      ai: { chats: chats.size, solo, team: teamInPeriod, waiting: helpIds.filter((id) => chats.has(id)).length },
    };
    return ok(data as unknown as Record<string, unknown>);
  } catch (e) {
    return failFrom(e);
  }
}
