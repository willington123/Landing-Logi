// Comments on the store's Facebook Pages and Instagram accounts (posts and ads): public reply, private message
// with a WhatsApp link, and optionally Claude answering questions or hiding spam.
import { rawDb } from '@/lib/server/supabase';
import { db } from '@/lib/server/db';
import { decrypt } from '@/lib/server/secrets';
import { seal, storedIntegrations, updateIntegrations } from '@/lib/server/integrations';
import { requestOrgSync } from '@/lib/server/tenant';
import { GRAPH_VERSION } from '@/lib/server/whatsapp';
import { DEFAULT_SOCIAL, cleanSocial, fillName, matchRule, waLink, type SocialChannel, type SocialRule, type SocialSettings } from '@/lib/social';

const env = (k: string) => (process.env[k] || '').trim();
const GRAPH = () => `${env('META_GRAPH_URL') || 'https://graph.facebook.com'}/${GRAPH_VERSION}`;

// What the store allows when it connects its pages ("Conectar páginas").
export const SOCIAL_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_read_user_content', // the comments people leave on the page
  'pages_manage_engagement',
  'pages_manage_metadata',
  'pages_messaging',
  'instagram_basic',
  'instagram_manage_comments',
  'instagram_manage_messages',
  'business_management',
].join(',');

export class SocialError extends Error {
  userFacing = true;
}

async function graph(method: 'GET' | 'POST' | 'DELETE', path: string, token: string, params: Record<string, unknown> = {}) {
  const url = new URL(`${GRAPH()}/${path}`);
  const init: RequestInit = { method, headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000), cache: 'no-store' };
  if (method === 'GET' || method === 'DELETE') for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  else {
    init.headers = { ...(init.headers as Record<string, string>), 'Content-Type': 'application/json' };
    init.body = JSON.stringify(params);
  }
  const res = await fetch(url.toString(), init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data?.error || {};
    if (e.code === 190) throw new SocialError('La conexión con Facebook venció. Vuelve a conectar tus páginas.');
    if (e.code === 10 || e.code === 200) throw new SocialError(`Facebook no dio el permiso necesario (${e.message || 'permiso'}).`);
    if (e.code === 551 || e.error_subcode === 2018278) throw new SocialError('Ya se le escribió por privado a esta persona por este comentario.');
    throw new SocialError(e.error_user_msg || e.message || `Facebook respondió HTTP ${res.status}`);
  }
  return data;
}

// ---------- connecting pages ----------

export interface PageInfo {
  id: string;
  name: string;
  token: string;
  picture: string | null;
  ig: { id: string; username: string } | null;
}

// Pages the person manages (with their Instagram account), from their long-lived user token.
export async function listPages(userToken: string): Promise<PageInfo[]> {
  const out: PageInfo[] = [];
  let after = '';
  for (let i = 0; i < 10; i++) {
    const d = await graph('GET', 'me/accounts', userToken, { fields: 'id,name,access_token,picture{url},instagram_business_account{id,username}', limit: 100, ...(after ? { after } : {}) });
    for (const p of d.data || [])
      out.push({
        id: String(p.id),
        name: String(p.name || p.id),
        token: String(p.access_token || ''),
        picture: p.picture?.data?.url || null,
        ig: p.instagram_business_account?.id ? { id: String(p.instagram_business_account.id), username: String(p.instagram_business_account.username || '') } : null,
      });
    after = d.paging?.cursors?.after && d.paging?.next ? d.paging.cursors.after : '';
    if (!after) break;
  }
  return out.filter((p) => p.token);
}

// Saves the pages (new ones start off; pages already active stay active with the fresh token).
export async function savePages(pages: PageInfo[]) {
  await updateIntegrations((s) => {
    const before = new Map((s.social?.pages || []).map((p) => [p.id, p]));
    return {
      ...s,
      social: {
        pages: pages.map((p) => ({ id: p.id, name: p.name, token: seal(p.token), picture: p.picture, ig: p.ig, active: before.get(p.id)?.active || false })),
        connectedAt: new Date().toISOString(),
      },
    };
  });
}

// Which store gets the notices of a page / Instagram account.
const indexId = (kind: 'page' | 'ig', id: string) => `social_${kind}:${id}`;

export async function orgForAsset(kind: 'page' | 'ig', id: string): Promise<string | null> {
  if (!/^\d{1,40}$/.test(id)) return null;
  const { data } = await rawDb().from('settings').select('org_id').eq('id', indexId(kind, id)).limit(1);
  return (data?.[0]?.org_id as string) || null;
}

// Turns pages on/off: subscribes the app to each page (Meta then sends its comments) and claims it for this store.
export async function setActivePages(active: string[]): Promise<{ id: string; ok: boolean; error?: string }[]> {
  const d = await db();
  const s = await storedIntegrations(d.orgId);
  const pages = s.social?.pages || [];
  const want = new Set(active);
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const p of pages) {
    const token = decrypt(p.token);
    if (want.has(p.id) && token) {
      // Another store already answers this page.
      const owner = await orgForAsset('page', p.id);
      if (owner && owner !== d.orgId) {
        results.push({ id: p.id, ok: false, error: 'Esta página ya está conectada en otra tienda de Konnexa.' });
        continue;
      }
      try {
        await graph('POST', `${p.id}/subscribed_apps`, token, { subscribed_fields: ['feed'] });
        await rawDb().from('settings').upsert({ org_id: d.orgId, id: indexId('page', p.id), data: { at: new Date().toISOString() } });
        if (p.ig) await rawDb().from('settings').upsert({ org_id: d.orgId, id: indexId('ig', p.ig.id), data: { page: p.id } });
        results.push({ id: p.id, ok: true });
      } catch (e: any) {
        results.push({ id: p.id, ok: false, error: e.message });
      }
    } else if (p.active) {
      await rawDb().from('settings').delete().eq('org_id', d.orgId).eq('id', indexId('page', p.id));
      if (p.ig) await rawDb().from('settings').delete().eq('org_id', d.orgId).eq('id', indexId('ig', p.ig.id));
      if (token) await graph('DELETE', `${p.id}/subscribed_apps`, token).catch(() => {});
    }
  }
  const ok = new Set(results.filter((r) => r.ok).map((r) => r.id));
  await updateIntegrations((x) => (x.social ? { ...x, social: { ...x.social, pages: x.social.pages.map((p) => ({ ...p, active: ok.has(p.id) })) } } : x));
  return results;
}

export async function disconnectSocial() {
  await setActivePages([]);
  await updateIntegrations((s) => {
    const { social, ...rest } = s;
    return rest;
  });
}

// ---------- settings, log and counts ----------

async function readSetting<T>(id: string): Promise<T | null> {
  const { data, error } = await (await db()).from('settings').select('data').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as T) ?? null;
}
async function writeSetting(id: string, data: unknown) {
  const { error } = await (await db()).from('settings').upsert({ id, data });
  if (error) throw new Error(error.message);
}

export async function getSocialSettings(): Promise<SocialSettings> {
  const s = await readSetting<SocialSettings>('social');
  const clean = s ? cleanSocial(s) : DEFAULT_SOCIAL;
  return typeof clean === 'string' ? DEFAULT_SOCIAL : clean;
}
export const saveSocialSettings = (s: SocialSettings) => writeSetting('social', s);

export interface SocialLogItem {
  at: string;
  channel: SocialChannel;
  account: string; // page name or @instagram
  postId: string;
  adId?: string | null;
  who: string;
  text: string;
  rule: string | null; // rule name, 'IA' or null
  done: string[]; // "Respuesta pública", "Privado", "Oculto"
  error?: string;
  skipped?: string;
}
export interface SocialStats {
  comments: number;
  publicReplies: number;
  privateMessages: number;
  hidden: number;
  failed: number;
}

export async function getSocialLog(): Promise<SocialLogItem[]> {
  return ((await readSetting<{ items?: SocialLogItem[] }>('social_log'))?.items || []).slice(0, 200);
}
export async function getSocialStats(): Promise<Record<string, SocialStats>> {
  return (await readSetting<Record<string, SocialStats>>('social_stats')) || {};
}

async function record(item: SocialLogItem, key: string) {
  const [log, stats] = await Promise.all([getSocialLog(), getSocialStats()]);
  await writeSetting('social_log', { items: [item, ...log].slice(0, 200) });
  if (item.skipped) return;
  const s = stats[key] || { comments: 0, publicReplies: 0, privateMessages: 0, hidden: 0, failed: 0 };
  s.comments++;
  if (item.done.includes('Respuesta pública')) s.publicReplies++;
  if (item.done.includes('Privado')) s.privateMessages++;
  if (item.done.includes('Oculto')) s.hidden++;
  if (item.error) s.failed++;
  stats[key] = s;
  await writeSetting('social_stats', stats);
}

// Comment ids already handled (Meta may send the same one twice, above all on ads) and
// "this person already got this rule on this post" marks. Kept 14 days.
async function claim(keys: string[]): Promise<Set<string>> {
  const done = (await readSetting<Record<string, string>>('social_done')) || {};
  const now = Date.now();
  const ok = new Set<string>();
  for (const k of keys) {
    if (done[k]) continue;
    done[k] = new Date(now).toISOString();
    ok.add(k);
  }
  if (ok.size) {
    for (const [k, v] of Object.entries(done)) if (now - new Date(v).getTime() > 14 * 86400000) delete done[k];
    await writeSetting('social_done', done);
  }
  return ok;
}

// ---------- incoming comments ----------

export interface IncomingComment {
  channel: SocialChannel;
  assetId: string; // page id (facebook) or instagram account id
  commentId: string;
  postId: string;
  adId?: string | null;
  text: string;
  fromId: string;
  fromName: string;
}

// Meta's notice → comments (own replies and edits are left out).
export function parseSocialWebhook(body: any): IncomingComment[] {
  const out: IncomingComment[] = [];
  for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
    const assetId = String(entry?.id || '');
    for (const ch of Array.isArray(entry?.changes) ? entry.changes : []) {
      const v = ch?.value || {};
      if (body.object === 'page' && ch.field === 'feed' && v.item === 'comment' && v.verb === 'add' && v.comment_id) {
        if (String(v.from?.id || '') === assetId) continue; // the page itself
        out.push({ channel: 'facebook', assetId, commentId: String(v.comment_id), postId: String(v.post_id || ''), text: String(v.message || ''), fromId: String(v.from?.id || ''), fromName: String(v.from?.name || '') });
      }
      if (body.object === 'instagram' && ch.field === 'comments' && v.id) {
        if (String(v.from?.id || '') === assetId || v.from?.self_ig_scoped_id) continue; // the account itself
        out.push({
          channel: 'instagram',
          assetId,
          commentId: String(v.id),
          postId: String(v.media?.id || ''),
          adId: v.media?.ad_id ? String(v.media.ad_id) : null,
          text: String(v.text || ''),
          fromId: String(v.from?.id || ''),
          fromName: String(v.from?.username || ''),
        });
      }
    }
  }
  return out;
}

async function storeWhatsApp(settings: SocialSettings): Promise<string> {
  if (settings.waNumber) return settings.waNumber;
  const org = requestOrgSync();
  const s = org ? await storedIntegrations(org) : null;
  return (s?.whatsapp?.displayPhone || env('WHATSAPP_DISPLAY_PHONE') || '').replace(/\D/g, '');
}

// What the private message says (with the WhatsApp link at the end).
export async function privateText(rule: SocialRule, name: string, settings: SocialSettings): Promise<string> {
  const parts = [rule.dm ? fillName(rule.dm, name) : ''];
  if (rule.whatsapp) {
    const link = waLink(await storeWhatsApp(settings), rule.waText);
    if (link) parts.push(`👉 Escríbenos por WhatsApp: ${link}`);
  }
  return parts.filter(Boolean).join('\n\n');
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

// Claude decides on comments no rule caught: answer a question, hide spam/insults, or leave it;
// and whether the person shows buying interest (then they also get the private message).
const aiOn = (s: SocialSettings) => s.ai.answer || s.ai.hide; // the private message rides along when the AI already reviews comments

async function aiDecision(c: IncomingComment, settings: SocialSettings): Promise<{ action: 'responder' | 'ocultar' | 'ignorar'; reply: string; interest: boolean }> {
  const { anthropic, getBotSettings, modelParams, storeKnowledge } = await import('@/lib/server/bot');
  const [ai, bot, k] = await Promise.all([anthropic(), getBotSettings(), storeKnowledge()]);
  const allowed = [settings.ai.answer ? '"responder" (es una pregunta o duda sobre los productos, el precio, el envío o el pago, y la información de la tienda la responde)' : '', settings.ai.hide ? '"ocultar" (insultos, groserías, spam, estafas, enlaces sospechosos o ataques)' : '', '"ignorar" (todo lo demás: elogios, etiquetas a amigos, emojis, quejas que debe ver una persona)'].filter(Boolean);
  const res: any = await ai.client.beta.messages.create({
    ...modelParams(bot),
    max_tokens: 1500,
    output_config: {
      effort: 'low',
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: { action: { type: 'string', enum: ['responder', 'ocultar', 'ignorar'] }, reply: { type: 'string' }, interest: { type: 'boolean' } },
          required: ['action', 'reply', 'interest'],
          additionalProperties: false,
        },
      },
    },
    system: [
      {
        type: 'text',
        text: `Eres el community manager de ${k.storeName}. Revisas comentarios públicos en ${c.channel === 'instagram' ? 'Instagram' : 'Facebook'} (publicaciones y anuncios).
Acciones posibles: ${allowed.join('; ')}.
Si respondes: una o dos frases en español, cálidas y cortas, sin inventar nada que no esté en la información de la tienda. Si la pregunta es de precio o de cómo comprar, da el dato si está y ${settings.ai.dm ? 'di que le escribiste al privado' : 'termina invitando a escribir por WhatsApp o por mensaje privado'}. Nunca pidas datos personales en público.
Si no respondes, deja "reply" vacío.
"interest": true si la persona muestra interés de compra o pide información (info, precio, cuánto vale, cómo compro, quiero, envíos, tallas, disponibilidad); false si no (elogios, etiquetas, quejas, spam).

Información de la tienda y sus productos:
${k.products}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: `Comentario de "${c.fromName || 'alguien'}": ${c.text.slice(0, 1000)}` }],
  });
  if (ai.source === 'plan') {
    const org = requestOrgSync();
    if (org) await (await import('@/lib/server/billing')).addAiReply(org).catch(() => {});
  }
  const txt = (res.content || []).find((b: any) => b.type === 'text')?.text || '{}';
  const d = JSON.parse(txt);
  const action = d.action === 'responder' && settings.ai.answer ? 'responder' : d.action === 'ocultar' && settings.ai.hide ? 'ocultar' : 'ignorar';
  return { action, reply: String(d.reply || '').slice(0, 600), interest: action !== 'ocultar' && d.interest === true };
}

// The private message the AI sends to someone interested (same shape as a rule with the WhatsApp link).
const aiRule = (s: SocialSettings): SocialRule => ({
  id: 'ai',
  name: 'IA',
  enabled: true,
  channels: ['facebook', 'instagram'],
  keywords: [],
  postIds: [],
  publicReplies: [],
  dm: s.ai.dmText,
  whatsapp: true,
  waText: s.ai.waText,
});

// Handles one comment for the store in context. Never throws.
export async function handleComment(c: IncomingComment): Promise<SocialLogItem | null> {
  try {
    const org = requestOrgSync();
    if (!org) return null;
    const s = await storedIntegrations(org);
    const page = (s.social?.pages || []).find((p) => p.active && (c.channel === 'facebook' ? p.id === c.assetId : p.ig?.id === c.assetId));
    if (!page) return null;
    const token = decrypt(page.token);
    if (!token) return null;
    if (!(await claim([`c:${c.commentId}`])).size) return null; // already handled (Meta sends some twice)

    const settings = await getSocialSettings();
    const item: SocialLogItem = {
      at: new Date().toISOString(),
      channel: c.channel,
      account: c.channel === 'instagram' ? `@${page.ig?.username || ''}` : page.name,
      postId: c.postId,
      adId: c.adId || null,
      who: c.fromName || c.fromId,
      text: c.text.slice(0, 300),
      rule: null,
      done: [],
    };
    const errors: string[] = [];
    const rule = matchRule(settings.rules, c);
    let key = 'none';
    if (rule) {
      item.rule = rule.name;
      key = rule.id;
      // One answer per person, post and rule (people comment "info" several times).
      if (!(await claim([`p:${rule.id}:${c.postId}:${c.fromId}`])).size) {
        item.skipped = 'Ya se le respondió en esta publicación.';
      } else {
        if (rule.publicReplies.length) {
          const message = fillName(pick(rule.publicReplies), c.fromName);
          await graph('POST', c.channel === 'facebook' ? `${c.commentId}/comments` : `${c.commentId}/replies`, token, { message })
            .then(() => item.done.push('Respuesta pública'))
            .catch((e) => errors.push(`Respuesta pública: ${e.message}`));
        }
        const text = await privateText(rule, c.fromName, settings);
        if (text) {
          await graph('POST', `${page.id}/messages`, token, { recipient: { comment_id: c.commentId }, message: { text } })
            .then(() => item.done.push('Privado'))
            .catch((e) => errors.push(`Privado: ${e.message}`));
        }
      }
    } else if (aiOn(settings)) {
      key = 'ai';
      const d = await aiDecision(c, settings).catch((e) => {
        errors.push(`IA: ${e.message}`);
        return null;
      });
      if (d?.action === 'responder' && d.reply) {
        item.rule = 'IA';
        await graph('POST', c.channel === 'facebook' ? `${c.commentId}/comments` : `${c.commentId}/replies`, token, { message: d.reply })
          .then(() => item.done.push('Respuesta pública'))
          .catch((e) => errors.push(`Respuesta pública: ${e.message}`));
      } else if (d?.action === 'ocultar') {
        item.rule = 'IA';
        await graph('POST', c.commentId, token, c.channel === 'facebook' ? { is_hidden: true } : { hide: true })
          .then(() => item.done.push('Oculto'))
          .catch((e) => errors.push(`Ocultar: ${e.message}`));
      }
      // Interested: private message with the WhatsApp link (once per person and post).
      if (d?.interest && settings.ai.dm && (await claim([`p:ai:${c.postId}:${c.fromId}`])).size) {
        item.rule = 'IA';
        const text = await privateText(aiRule(settings), c.fromName, settings);
        if (text)
          await graph('POST', `${page.id}/messages`, token, { recipient: { comment_id: c.commentId }, message: { text } })
            .then(() => item.done.push('Privado'))
            .catch((e) => errors.push(`Privado: ${e.message}`));
      }
      if (d && !item.done.length && !errors.length) item.skipped = 'La IA lo dejó para una persona.';
    } else {
      item.skipped = 'Ninguna regla aplicó.';
    }
    if (errors.length) item.error = errors.join(' · ').slice(0, 400);
    await record(item, key).catch(() => {});
    return item;
  } catch (e) {
    console.error('Comentarios:', e);
    return null;
  }
}

// Panel "Probar": what would happen with this comment (nothing is posted).
export async function previewComment(text: string, channel: SocialChannel, name: string) {
  const settings = await getSocialSettings();
  const rule = matchRule(settings.rules, { channel, text, postId: '' });
  if (rule)
    return {
      rule: rule.name,
      publicReply: rule.publicReplies.length ? fillName(rule.publicReplies[0], name) : null,
      privateMessage: (await privateText(rule, name, settings)) || null,
      ai: null,
    };
  if (!aiOn(settings)) return { rule: null, publicReply: null, privateMessage: null, ai: null };
  const d = await aiDecision({ channel, assetId: '', commentId: '', postId: '', text, fromId: '', fromName: name }, settings);
  return {
    rule: null,
    publicReply: d.action === 'responder' ? d.reply : null,
    privateMessage: d.interest && settings.ai.dm ? (await privateText(aiRule(settings), name, settings)) || null : null,
    ai: d.action === 'ignorar' && d.interest ? 'privado' : d.action,
  };
}
