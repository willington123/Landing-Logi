// Server-only storage for CRM quick replies and tags (Supabase "settings" table, no extra migration).
import { db } from '@/lib/server/db';
import type { AdRef } from '@/lib/ads';
import { DEFAULT_AUTO, DEFAULT_QUICK_REPLIES, DEFAULT_TAGS, cleanRouting, type Agent, type AutoSettings, type CrmTag, type QuickReply, type RoutingSettings } from '@/lib/crm';
import { currentRole, sessionUserId } from '@/lib/server/tenant';

async function readSetting<T>(id: string): Promise<T | null> {
  const { data, error } = await (await db()).from('settings').select('data').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as T) ?? null;
}

async function writeSetting(id: string, data: unknown) {
  const { error } = await (await db()).from('settings').upsert({ id, data });
  if (error) throw new Error(error.message);
}

// ---------- quick replies ----------

export async function getQuickReplies(): Promise<QuickReply[]> {
  const d = await readSetting<{ items?: QuickReply[] }>('wa_quick_replies');
  return Array.isArray(d?.items) ? d!.items : DEFAULT_QUICK_REPLIES;
}

export async function saveQuickReplies(items: QuickReply[]) {
  await writeSetting('wa_quick_replies', { items });
}

// ---------- tags ----------

export async function getTags(): Promise<CrmTag[]> {
  const d = await readSetting<{ items?: CrmTag[] }>('wa_tags');
  return Array.isArray(d?.items) ? d!.items : DEFAULT_TAGS;
}

export async function saveTags(items: CrmTag[]) {
  await writeSetting('wa_tags', { items });
}

// Tags on each conversation: { "<phone>": ["tagId", …] }.
export async function getConversationTags(): Promise<Record<string, string[]>> {
  return (await readSetting<Record<string, string[]>>('wa_conv_tags')) || {};
}

export async function setConversationTags(conversationId: string, tagIds: string[]): Promise<string[]> {
  const valid = new Set((await getTags()).map((t) => t.id));
  const clean = Array.from(new Set(tagIds.filter((id) => valid.has(id))));
  const all = await getConversationTags();
  if (clean.length) all[conversationId] = clean;
  else delete all[conversationId];
  await writeSetting('wa_conv_tags', all);
  return clean;
}

// ---------- internal notes (only the team sees them) ----------

export interface CrmNote {
  id: string;
  text: string;
  at: string;
}

async function allNotes(): Promise<Record<string, CrmNote[]>> {
  return (await readSetting<Record<string, CrmNote[]>>('wa_notes')) || {};
}

export async function getNotes(conversationId: string): Promise<CrmNote[]> {
  return (await allNotes())[conversationId] || [];
}

export async function addNote(conversationId: string, text: string): Promise<CrmNote[]> {
  const all = await allNotes();
  const note: CrmNote = { id: `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, text, at: new Date().toISOString() };
  all[conversationId] = [note, ...(all[conversationId] || [])].slice(0, 100);
  await writeSetting('wa_notes', all);
  return all[conversationId];
}

export async function deleteNote(conversationId: string, noteId: string): Promise<CrmNote[]> {
  const all = await allNotes();
  const left = (all[conversationId] || []).filter((n) => n.id !== noteId);
  if (left.length) all[conversationId] = left;
  else delete all[conversationId];
  await writeSetting('wa_notes', all);
  return left;
}

// ---------- team: people who handle chats ----------


export async function getAgents(): Promise<Agent[]> {
  const d = await readSetting<{ items?: Agent[] }>('wa_agents');
  return Array.isArray(d?.items) ? d!.items : [];
}

export async function saveAgents(items: Agent[]) {
  await writeSetting('wa_agents', { items });
}

// Who handles each conversation: { "<phone>": "<agentId>" }.
export async function getAssignments(): Promise<Record<string, string>> {
  return (await readSetting<Record<string, string>>('wa_conv_assign')) || {};
}

export async function setAssignment(conversationId: string, agentId: string | null): Promise<string | null> {
  const all = await getAssignments();
  const valid = agentId && (await getAgents()).some((a) => a.id === agentId) ? agentId : null;
  if (valid) all[conversationId] = valid;
  else delete all[conversationId];
  await writeSetting('wa_conv_assign', all);
  return valid;
}

// ---------- team: who is signed in, what they can see, automatic assignment ----------

export class ChatForbidden extends Error {
  status = 403;
}

// The team person linked to the account that's signed in (null if not linked).
export async function myAgent(agents?: Agent[]): Promise<Agent | null> {
  const uid = sessionUserId();
  if (!uid) return null;
  return (agents || (await getAgents())).find((a) => a.userId === uid) || null;
}

// Members marked "solo sus chats" see only the chats assigned to them. Owners and admins see everything.
export async function chatScope(): Promise<{ restricted: boolean; agentId: string | null }> {
  const agents = await getAgents();
  const me = await myAgent(agents);
  if (!me?.onlyAssigned) return { restricted: false, agentId: me?.id || null };
  const role = await currentRole();
  return { restricted: role === 'member', agentId: me.id };
}

export async function assertCanSeeChat(conversationId: string) {
  const scope = await chatScope();
  if (!scope.restricted) return;
  if ((await getAssignments())[conversationId] !== scope.agentId) throw new ChatForbidden('Este chat está asignado a otra persona del equipo.');
}

export async function getRouting(): Promise<RoutingSettings & { last?: string }> {
  const r = await readSetting<RoutingSettings & { last?: string }>('wa_routing');
  return { ...cleanRouting(r), last: r?.last };
}
export async function saveRouting(r: RoutingSettings) {
  const cur = await getRouting();
  await writeSetting('wa_routing', { ...cleanRouting(r), last: cur.last });
}

// Gives an unassigned chat to the next available person, in turns. Returns who got it (or null).
export async function autoAssign(conversationId: string, moment: 'new' | 'handoff'): Promise<Agent | null> {
  const routing = await getRouting();
  if (!routing.enabled) return null;
  if (routing.when === 'handoff' && moment !== 'handoff') return null;
  const all = await getAssignments();
  if (all[conversationId]) return null;
  const pool = (await getAgents()).filter((a) => a.available !== false);
  if (!pool.length) return null;
  const i = pool.findIndex((a) => a.id === routing.last);
  const next = pool[(i + 1) % pool.length];
  all[conversationId] = next.id;
  await writeSetting('wa_conv_assign', all);
  await writeSetting('wa_routing', { enabled: routing.enabled, when: routing.when, last: next.id });
  return next;
}

// Each person says if they're taking chats now.
export async function setMyAvailability(available: boolean): Promise<Agent | null> {
  const agents = await getAgents();
  const me = await myAgent(agents);
  if (!me) return null;
  const next = agents.map((a) => (a.id === me.id ? { ...a, available } : a));
  await saveAgents(next);
  return { ...me, available };
}

// ---------- who has a chat open (so two people don't answer at once) ----------

export interface Presence {
  uid: string;
  name: string;
  typing: boolean;
  at: string;
}
const PRESENCE_MS = 30_000;

export async function touchPresence(conversationId: string, p: { name: string; typing: boolean }) {
  const uid = sessionUserId();
  if (!uid) return;
  const now = Date.now();
  const all = (await readSetting<Record<string, Presence[]>>('wa_presence')) || {};
  const clean: Record<string, Presence[]> = {};
  for (const [id, list] of Object.entries(all)) {
    const fresh = (list || []).filter((x) => now - new Date(x.at).getTime() < PRESENCE_MS && !(id === conversationId && x.uid === uid));
    if (fresh.length) clean[id] = fresh;
  }
  clean[conversationId] = [...(clean[conversationId] || []), { uid, name: p.name.slice(0, 60), typing: p.typing, at: new Date(now).toISOString() }];
  await writeSetting('wa_presence', clean);
}

// Other people on this chat in the last 30 seconds.
export async function othersOnChat(conversationId: string): Promise<{ name: string; typing: boolean }[]> {
  const uid = sessionUserId();
  const list = ((await readSetting<Record<string, Presence[]>>('wa_presence')) || {})[conversationId] || [];
  const now = Date.now();
  return list.filter((x) => x.uid !== uid && now - new Date(x.at).getTime() < PRESENCE_MS).map((x) => ({ name: x.name, typing: x.typing }));
}

// ---------- automatic replies ----------

export async function getAutoSettings(): Promise<AutoSettings> {
  const d = await readSetting<AutoSettings>('wa_auto');
  if (!d) return DEFAULT_AUTO;
  return { ...DEFAULT_AUTO, ...d, away: { ...DEFAULT_AUTO.away, ...(d.away || {}) }, rules: Array.isArray(d.rules) ? d.rules : [] };
}

export async function saveAutoSettings(s: AutoSettings) {
  await writeSetting('wa_auto', s);
}

// When each automatic reply last went to each customer, so they aren't repeated: { phone: { key: iso } }.
const AUTO_LOG = 'wa_auto_log';
const WEEK = 7 * 24 * 3600 * 1000;

export async function autoSentRecently(conversationId: string, key: string, withinMs: number): Promise<boolean> {
  const log = (await readSetting<Record<string, Record<string, string>>>(AUTO_LOG)) || {};
  const at = log[conversationId]?.[key];
  return Boolean(at && Date.now() - new Date(at).getTime() < withinMs);
}

export async function noteAutoSent(conversationId: string, keys: string[]) {
  const log = (await readSetting<Record<string, Record<string, string>>>(AUTO_LOG)) || {};
  const now = Date.now();
  // Drop entries older than a week so the log stays small.
  for (const [c, entries] of Object.entries(log)) {
    for (const [k, at] of Object.entries(entries)) if (now - new Date(at).getTime() > WEEK) delete entries[k];
    if (!Object.keys(entries).length) delete log[c];
  }
  log[conversationId] = { ...(log[conversationId] || {}) };
  for (const k of keys) log[conversationId][k] = new Date(now).toISOString();
  await writeSetting(AUTO_LOG, log);
}

// ---------- ad each chat came from (click-to-WhatsApp ads) ----------

export async function getConversationAds(): Promise<Record<string, AdRef>> {
  return (await readSetting<Record<string, AdRef>>('wa_conv_ads')) || {};
}

// Last ad wins (the one that brought the customer back). Keeps the newest 5.000 chats.
export async function setConversationAd(conversationId: string, ad: AdRef) {
  const all = await getConversationAds();
  all[conversationId] = ad;
  const keys = Object.keys(all);
  if (keys.length > 5000) {
    keys.sort((a, b) => (all[a].at < all[b].at ? -1 : 1)).slice(0, keys.length - 5000).forEach((k) => delete all[k]);
  }
  await writeSetting('wa_conv_ads', all);
}
