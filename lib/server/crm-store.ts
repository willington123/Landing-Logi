// Server-only storage for CRM quick replies and tags (Supabase "settings" table, no extra migration).
import { db } from '@/lib/server/db';
import { DEFAULT_AUTO, DEFAULT_QUICK_REPLIES, DEFAULT_TAGS, type Agent, type AutoSettings, type CrmTag, type QuickReply } from '@/lib/crm';

async function readSetting<T>(id: string): Promise<T | null> {
  const { data, error } = await db().from('settings').select('data').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as T) ?? null;
}

async function writeSetting(id: string, data: unknown) {
  const { error } = await db().from('settings').upsert({ id, data });
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
