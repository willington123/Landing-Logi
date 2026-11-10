// Notices on the phone or computer with Konnexa closed (Web Push). The keys that sign them are created once and
// kept in platform_settings ("push_keys"); each person's devices in "push_subs" ({ userId: [device, …] }).
// A notice goes to the person the chat is assigned to, or else to everyone in the store who may see it.
import webpush from 'web-push';
import { rawDb } from '@/lib/server/supabase';
import { listMembers } from '@/lib/server/accounts';
import { getAgents, getAssignments } from '@/lib/server/crm-store';
import { requestOrgSync } from '@/lib/server/tenant';

export type PushMode = 'all' | 'handoff'; // every message a person must answer, or only "esperan asesor"
export interface PushDevice {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  mode: PushMode;
  ua: string;
  at: string;
}
const MAX_DEVICES = 6;

async function readRow<T>(id: string): Promise<T | null> {
  const { data, error } = await rawDb().from('platform_settings').select('data').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as T) ?? null;
}
async function writeRow(id: string, data: unknown) {
  const { error } = await rawDb().from('platform_settings').upsert({ id, data });
  if (error) throw new Error(error.message);
}

let keys: { publicKey: string; privateKey: string } | null = null;
async function vapid() {
  if (keys) return keys;
  const env = { publicKey: (process.env.VAPID_PUBLIC_KEY || '').trim(), privateKey: (process.env.VAPID_PRIVATE_KEY || '').trim() };
  if (env.publicKey && env.privateKey) return (keys = env);
  let saved = await readRow<{ publicKey: string; privateKey: string }>('push_keys');
  if (!saved?.publicKey) {
    saved = webpush.generateVAPIDKeys();
    await writeRow('push_keys', saved);
    // Two servers may create keys at once: everyone uses the pair that ended up saved.
    saved = (await readRow<{ publicKey: string; privateKey: string }>('push_keys')) || saved;
  }
  return (keys = saved);
}
export const pushPublicKey = async () => (await vapid()).publicKey;

type Subs = Record<string, PushDevice[]>;
const readSubs = async () => (await readRow<Subs>('push_subs')) || {};

const validSub = (s: any) =>
  typeof s?.endpoint === 'string' && /^https:\/\/[\w.-]+\//.test(s.endpoint) && s.endpoint.length < 1000 && typeof s?.keys?.p256dh === 'string' && typeof s?.keys?.auth === 'string' && s.keys.p256dh.length < 200 && s.keys.auth.length < 100;

export async function saveDevice(userId: string, sub: any, mode: PushMode, ua: string) {
  if (!validSub(sub)) throw Object.assign(new Error('Este navegador no entregó una suscripción válida.'), { status: 400 });
  const all = await readSubs();
  // A device belongs to whoever signed in on it last.
  for (const uid of Object.keys(all)) {
    all[uid] = all[uid].filter((d) => d.endpoint !== sub.endpoint);
    if (!all[uid].length) delete all[uid];
  }
  const mine = all[userId] || [];
  mine.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, mode: mode === 'handoff' ? 'handoff' : 'all', ua: ua.slice(0, 120), at: new Date().toISOString() });
  all[userId] = mine.slice(-MAX_DEVICES);
  await writeRow('push_subs', all);
}
export async function removeDevice(userId: string, endpoint: string) {
  const all = await readSubs();
  if (!all[userId]) return;
  all[userId] = all[userId].filter((d) => d.endpoint !== endpoint);
  if (!all[userId].length) delete all[userId];
  await writeRow('push_subs', all);
}
export async function deviceState(userId: string, endpoint: string | null) {
  const mine = (await readSubs())[userId] || [];
  const d = endpoint ? mine.find((x) => x.endpoint === endpoint) : null;
  return { subscribed: Boolean(d), mode: d?.mode || 'all', devices: mine.length };
}

export interface PushNotice {
  kind: 'handoff' | 'message';
  chatId: string;
  title: string;
  body: string;
}

// Who should hear about this chat: its assignee (if that person has an account), else everyone in the store
// except members who only see their own chats.
async function recipients(orgId: string, chatId: string): Promise<string[]> {
  const [members, agents, assign] = await Promise.all([listMembers(orgId), getAgents().catch(() => []), getAssignments().catch(() => ({}) as Record<string, string>)]);
  const inStore = new Set(members.map((m) => m.userId));
  const assignee = agents.find((a) => a.id === assign[chatId]);
  if (assignee?.userId && inStore.has(assignee.userId)) return [assignee.userId];
  const restricted = new Set(agents.filter((a) => a.onlyAssigned && a.userId).map((a) => a.userId as string));
  return members.filter((m) => m.role !== 'member' || !restricted.has(m.userId)).map((m) => m.userId);
}

// Never throws: a notice that can't be sent must not break the reply to the customer.
export async function pushToStore(n: PushNotice, orgId = requestOrgSync()): Promise<number> {
  try {
    if (!orgId) return 0;
    const all = await readSubs();
    if (!Object.keys(all).length) return 0;
    const users = (await recipients(orgId, n.chatId)).filter((u) => all[u]?.length);
    if (!users.length) return 0;
    const k = await vapid();
    const payload = JSON.stringify({ title: n.title.slice(0, 80), body: n.body.replace(/\s+/g, ' ').slice(0, 160), url: `/crm?c=${encodeURIComponent(n.chatId)}`, tag: `chat-${n.chatId}` });
    const gone: string[] = [];
    let sent = 0;
    await Promise.all(
      users.flatMap((u) =>
        all[u]
          .filter((d) => n.kind === 'handoff' || d.mode === 'all')
          .map(async (d) => {
            try {
              await webpush.sendNotification({ endpoint: d.endpoint, keys: d.keys }, payload, {
                vapidDetails: { subject: 'mailto:soporte@konnexa.lat', publicKey: k.publicKey, privateKey: k.privateKey },
                TTL: 3600,
                urgency: 'high',
                timeout: 8000,
              });
              sent++;
            } catch (e: any) {
              if (e?.statusCode === 404 || e?.statusCode === 410) gone.push(d.endpoint); // the device unsubscribed
              else console.error('Aviso push: no se pudo enviar', e?.statusCode || e?.message || e);
            }
          }),
      ),
    );
    if (gone.length) {
      const fresh = await readSubs();
      for (const uid of Object.keys(fresh)) {
        fresh[uid] = fresh[uid].filter((d) => !gone.includes(d.endpoint));
        if (!fresh[uid].length) delete fresh[uid];
      }
      await writeRow('push_subs', fresh);
    }
    return sent;
  } catch (e) {
    console.error('Aviso push', e);
    return 0;
  }
}
