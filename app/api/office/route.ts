import { db } from '@/lib/server/db';
import { rawDb } from '@/lib/server/supabase';
import { getAgents, getAssignments, getPresence, getSeen } from '@/lib/server/crm-store';
import { botConfigured, getBotSettings, getBotStates } from '@/lib/server/bot';
import { currentOrgId } from '@/lib/server/tenant';
import { AI_ACTIVE_MS, ONLINE_MS, type OfficeData, type OfficePerson } from '@/lib/office';
import { failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const PRESENCE_MS = 30_000;
const chunks = <T,>(list: T[], n = 200) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
const label = (c: { id: string; name: string | null } | undefined, id: string) => c?.name || (/^\d/.test(id) ? `+${id}` : 'Cliente');

// Oficina: who on the team is working, what the AI is doing and who is waiting for a person. Light reads only.
export async function GET() {
  try {
    const orgId = await currentOrgId();
    const now = Date.now();
    const d = await db();
    const [agents, assign, presence, seen, states, bot, configured, org] = await Promise.all([
      getAgents(),
      getAssignments(),
      getPresence(),
      getSeen(),
      getBotStates(),
      getBotSettings(),
      botConfigured(),
      rawDb().from('organizations').select('name').eq('id', orgId).maybeSingle(),
    ]);

    // Chats the AI is answering now, and chats waiting for a person.
    const { data: recent } = await d
      .from('wa_conversations')
      .select('id, name')
      .gte('last_inbound_at', new Date(now - AI_ACTIVE_MS).toISOString())
      .order('last_inbound_at', { ascending: false })
      .limit(500);
    const aiOn = bot.enabled && configured;
    const aiChats = aiOn ? (recent || []).filter((c: any) => !states[c.id]?.paused) : [];
    const waitingIds = Object.keys(states)
      .filter((id) => states[id].paused && (states[id].reason === 'handoff' || states[id].reason === 'limit'))
      .sort((a, b) => String(states[a].pausedAt || '').localeCompare(String(states[b].pausedAt || '')))
      .slice(0, 60);

    // Names of the chats we show, and which assigned chats had activity today.
    const assignedIds = Object.keys(assign);
    const names: Record<string, { id: string; name: string | null }> = {};
    const activeAssigned = new Set<string>();
    const presenceIds = Object.keys(presence);
    for (const ids of chunks(Array.from(new Set([...waitingIds, ...presenceIds])))) {
      const { data } = await d.from('wa_conversations').select('id, name').in('id', ids);
      for (const c of data || []) names[c.id] = c as any;
    }
    for (const ids of chunks(assignedIds.slice(0, 2000))) {
      const { data } = await d.from('wa_conversations').select('id').in('id', ids).gte('last_message_at', new Date(now - 86400_000).toISOString());
      for (const c of data || []) activeAssigned.add(c.id as string);
    }

    // Who has which chat open (presence is refreshed every 10 s by the open chat).
    const onChat: Record<string, { chat: string; typing: boolean }> = {};
    for (const [chatId, list] of Object.entries(presence)) {
      for (const p of list || []) {
        if (now - new Date(p.at).getTime() < PRESENCE_MS) onChat[p.uid] = { chat: label(names[chatId], chatId), typing: Boolean(p.typing) || Boolean(onChat[p.uid]?.typing) };
      }
    }
    const isOnline = (uid?: string | null) => Boolean(uid && ((seen[uid] && now - new Date(seen[uid]).getTime() < ONLINE_MS) || onChat[uid]));

    const people: OfficePerson[] = agents.map((a) => ({
      id: a.id,
      name: a.name,
      online: isOnline(a.userId),
      available: a.available !== false,
      typing: Boolean(a.userId && onChat[a.userId]?.typing),
      onChat: (a.userId && onChat[a.userId]?.chat) || null,
      assigned: assignedIds.filter((id) => assign[id] === a.id && activeAssigned.has(id)).length,
    }));
    // Someone signed in who isn't on the team list (often the owner) also gets a desk while connected.
    const linked = new Set(agents.map((a) => a.userId).filter(Boolean));
    const extraUids = Object.keys(seen).filter((uid) => !linked.has(uid) && isOnline(uid));
    if (extraUids.length) {
      const { data: users } = await rawDb().from('app_users').select('id, name, email').in('id', extraUids.slice(0, 20));
      for (const u of users || []) {
        people.push({
          id: `u:${u.id}`,
          name: (u.name as string) || String(u.email || '').split('@')[0] || 'Equipo',
          online: true,
          available: true,
          typing: Boolean(onChat[u.id as string]?.typing),
          onChat: onChat[u.id as string]?.chat || null,
          assigned: 0,
        });
      }
    }

    const data: OfficeData = {
      store: { id: orgId, name: (org.data?.name as string) || 'Mi tienda' },
      bot: { enabled: aiOn, name: bot.name },
      ai: { active: aiChats.length, names: aiChats.slice(0, 6).map((c: any) => label(c, c.id)) },
      people,
      waiting: waitingIds.map((id) => ({ id, name: label(names[id], id), since: states[id].pausedAt || null, note: states[id].reason === 'limit' ? 'Límite de respuestas de la IA' : states[id].note || '' })),
      updatedAt: new Date(now).toISOString(),
    };
    return ok(data as unknown as Record<string, unknown>);
  } catch (e) {
    return failFrom(e);
  }
}
