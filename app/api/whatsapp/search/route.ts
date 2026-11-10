import { NextRequest } from 'next/server';
import { cloudEnabled, db } from '@/lib/server/db';
import { chatScope, getAssignments } from '@/lib/server/crm-store';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const MAX = 80;

// Mensajes → search inside every message (both directions, voice notes by their transcript). ?q=palabra
// Newest first; members who only see their chats get only those.
export async function GET(req: NextRequest) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    const q = (req.nextUrl.searchParams.get('q') || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (q.length < 3) return ok({ results: [] });
    // Accents don't matter ("envio" finds "envío"): vowels match any one letter in the database, then the exact
    // comparison without accents is done here.
    const plain = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const needle = plain(q);
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/[aeiouáéíóúü]/gi, '_')}%`;
    const d = await db();
    const { data, error } = await d.from('wa_messages').select('id, conversation_id, direction, body, created_at').ilike('body', pattern).order('created_at', { ascending: false }).limit(MAX * 2);
    if (error) throw new Error(error.message);
    let rows = (data || []).filter((m: any) => m.body && plain(String(m.body)).includes(needle));
    const scope = await chatScope();
    if (scope.restricted) {
      const assign = await getAssignments();
      rows = rows.filter((m: any) => assign[m.conversation_id] === scope.agentId);
    }
    rows = rows.slice(0, MAX);
    const ids = Array.from(new Set(rows.map((m: any) => m.conversation_id)));
    const names: Record<string, string | null> = {};
    if (ids.length) {
      const { data: convs } = await d.from('wa_conversations').select('id, name').in('id', ids);
      for (const c of convs || []) names[c.id] = c.name || null;
    }
    // A short piece of the message around the word.
    const snippet = (body: string) => {
      const text = body.replace(/\s+/g, ' ');
      const i = plain(text).indexOf(needle);
      if (i < 0 || text.length <= 140) return text.slice(0, 140);
      const start = Math.max(0, i - 50);
      return `${start ? '…' : ''}${text.slice(start, start + 140)}${start + 140 < text.length ? '…' : ''}`;
    };
    return ok({
      results: rows.map((m: any) => ({ id: m.id, conversationId: m.conversation_id, name: names[m.conversation_id] || null, direction: m.direction, text: snippet(String(m.body)), at: m.created_at })),
    });
  } catch (e: any) {
    return failFrom(e);
  }
}
