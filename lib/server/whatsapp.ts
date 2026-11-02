// WhatsApp Business Cloud API: sending, webhook signature check and payload parsing.
// Server-only. Each store uses its own connection (lib/server/integrations); the store that owns the
// keys in Vercel uses those.
import { adFromReferral, type AdRef } from '@/lib/ads';
import { createHmac, timingSafeEqual } from 'crypto';
import { waConfig, type WaConfig } from '@/lib/server/integrations';

export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v26.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const WHATSAPP_ENV = ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_CONFIRM_TEMPLATE'] as const;

// Can send messages (free text and templates).
export async function whatsappEnabled(): Promise<boolean> {
  return Boolean(await waConfig());
}

// Can send the automatic order confirmation template.
export async function confirmTemplateEnabled(): Promise<boolean> {
  return Boolean((await waConfig())?.confirmTemplate);
}

export async function whatsappStatus() {
  const c = await waConfig();
  return {
    managed: true, // every store can connect its own WhatsApp
    connected: Boolean(c),
    source: c?.source || null, // 'env' (Vercel) or 'store' (connected in the panel)
    mode: c?.mode || null,
    sending: Boolean(c),
    confirmTemplate: Boolean(c?.confirmTemplate),
    templateName: c?.confirmTemplate || null,
    webhook: Boolean(c && c.verifyToken && c.appSecret),
    cron: Boolean((process.env.CRON_SECRET || '').trim()), // scheduled task, needed for the fallback template
    missing: c?.source === 'env' ? WHATSAPP_ENV.filter((k) => !(process.env[k] || '').trim()) : [],
    phoneNumberId: c?.phoneNumberId || null,
    wabaId: c?.wabaId || null,
  };
}

// Checks X-Hub-Signature-256 ("sha256=<hex>") against HMAC-SHA256(rawBody, app secret).
export function verifySignature(rawBody: string, header: string | null, secret: string | null | undefined): boolean {
  if (!secret || !header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  const given = Buffer.from(header.slice(7), 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// ---------- sending ----------

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

const graphError = (data: any, status: number) => data?.error?.error_data?.details || data?.error?.message || `HTTP ${status}`;

async function send(body: Record<string, unknown>, cfg?: WaConfig | null): Promise<SendResult> {
  const c = cfg ?? (await waConfig());
  if (!c) return { ok: false, error: 'WhatsApp no está configurado' };
  try {
    const res = await fetch(`${GRAPH}/${c.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.token}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...body }),
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: graphError(data, res.status) };
    return { ok: true, messageId: data?.messages?.[0]?.id };
  } catch (e: any) {
    return { ok: false, error: e?.name === 'TimeoutError' ? 'WhatsApp no respondió a tiempo' : e?.message || String(e) };
  }
}

export function sendText(to: string, text: string): Promise<SendResult> {
  return send({ to, type: 'text', text: { preview_url: false, body: text.slice(0, 4096) } });
}

// Template params can't contain newlines, tabs or more than 4 spaces in a row.
const param = (v: string) => ({ type: 'text', text: (v || '-').replace(/[\n\t\r]+/g, ' ').replace(/ {4,}/g, '   ').trim().slice(0, 200) || '-' });

// Order confirmation template: {{1}} name, {{2}} product, {{3}} total, {{4}} city.
// The two quick-reply buttons carry the order id so the reply maps to the exact order.
export async function sendConfirmTemplate(to: string, vars: { name: string; product: string; total: string; city: string }, orderId: string): Promise<SendResult> {
  const c = await waConfig();
  if (!c?.confirmTemplate) return { ok: false, error: 'Plantilla de confirmación no configurada' };
  return send({
    to,
    type: 'template',
    template: {
      name: c.confirmTemplate,
      language: { code: c.templateLang || 'es' },
      components: [
        { type: 'body', parameters: [param(vars.name), param(vars.product), param(vars.total), param(vars.city)] },
        { type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: `confirm:${orderId}` }] },
        { type: 'button', sub_type: 'quick_reply', index: '1', parameters: [{ type: 'payload', payload: `cancel:${orderId}` }] },
      ],
    },
  }, c);
}

// Appointment reminder template: {{1}} name, {{2}} service, {{3}} when, {{4}} with whom / where.
// Buttons "Confirmar cita" / "Cancelar cita" carry the appointment id.
export function sendAppointmentTemplate(to: string, t: { name: string; lang: string }, vars: [string, string, string, string], apptId: string): Promise<SendResult> {
  return send({
    to,
    type: 'template',
    template: {
      name: t.name,
      language: { code: t.lang || 'es' },
      components: [
        { type: 'body', parameters: vars.map(param) },
        { type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: `appt_confirm:${apptId}` }] },
        { type: 'button', sub_type: 'quick_reply', index: '1', parameters: [{ type: 'payload', payload: `appt_cancel:${apptId}` }] },
      ],
    },
  });
}

// Free-form message with up to 3 reply buttons (only inside the 24 h window).
export function sendButtons(to: string, body: string, buttons: { id: string; title: string }[]): Promise<SendResult> {
  return send({
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body.slice(0, 1024) },
      action: { buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) } })) },
    },
  });
}

export { formatMoney } from '@/lib/whatsapp-link';

// Meta's default "hello_world" template: works on any number, good for testing the connection.
export function sendHelloWorld(to: string): Promise<SendResult> {
  return send({ to, type: 'template', template: { name: 'hello_world', language: { code: 'en_US' } } });
}

export interface PhoneNumberInfo {
  display_phone_number?: string;
  verified_name?: string;
  name_status?: string;
  quality_rating?: string;
  code_verification_status?: string;
}

// Details of the connected number (also proves the token and the phone number ID work).
export async function phoneNumberInfo(cfg?: { token: string; phoneNumberId: string }): Promise<{ ok: true; info: PhoneNumberInfo } | { ok: false; error: string }> {
  const c = cfg ?? (await waConfig());
  if (!c) return { ok: false, error: 'WhatsApp no está configurado' };
  try {
    const fields = 'display_phone_number,verified_name,name_status,quality_rating,code_verification_status';
    const res = await fetch(`${GRAPH}/${c.phoneNumberId}?fields=${fields}`, {
      headers: { Authorization: `Bearer ${c.token}` },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error?.message || `HTTP ${res.status}` };
    return { ok: true, info: data };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// Downloads a file the customer sent (photo, voice note…). Meta's file URL needs the token and expires in minutes,
// so the panel always goes through this with the media id.
export async function fetchMedia(mediaId: string): Promise<{ ok: true; res: Response; mime: string } | { ok: false; status: number; error: string }> {
  const c = await waConfig();
  if (!c) return { ok: false, status: 503, error: 'WhatsApp no está configurado' };
  try {
    const auth = { Authorization: `Bearer ${c.token}` };
    const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: auth, signal: AbortSignal.timeout(8000), cache: 'no-store' });
    const info = await meta.json().catch(() => ({}));
    if (!meta.ok || !info?.url) return { ok: false, status: meta.status === 404 ? 404 : 502, error: info?.error?.message || 'El archivo ya no está disponible en WhatsApp.' };
    const res = await fetch(info.url, { headers: auth, signal: AbortSignal.timeout(20000), cache: 'no-store' });
    if (!res.ok || !res.body) return { ok: false, status: 502, error: `No se pudo descargar el archivo (HTTP ${res.status}).` };
    return { ok: true, res, mime: info.mime_type || res.headers.get('content-type') || 'application/octet-stream' };
  } catch (e: any) {
    return { ok: false, status: 502, error: e?.name === 'TimeoutError' ? 'WhatsApp no respondió a tiempo' : e?.message || String(e) };
  }
}

// ---------- webhook parsing ----------

export type Intent = 'confirm' | 'cancel' | null;

export interface InboundMessage {
  waMessageId: string;
  from: string; // E.164 digits, no plus
  profileName?: string;
  timestamp: string; // ISO
  type: string;
  text: string; // what the customer wrote or tapped
  intent: Intent;
  orderId?: string; // from a button payload like "confirm:<orderId>"
  orderNumber?: string; // "LP-12345" written in the message (e.g. the landing's pre-filled text)
  appt?: { action: 'confirm' | 'cancel'; id: string }; // tapped Confirmar cita / Cancelar cita
  phoneNumberId?: string; // the store's number that received it (routes the notice to its store)
  ad?: AdRef; // the customer wrote from a click-to-WhatsApp ad
  raw: unknown;
}

export interface StatusUpdate {
  waMessageId: string;
  recipient: string;
  status: 'sent' | 'delivered' | 'read' | 'failed' | string;
  timestamp: string;
  error?: string;
  phoneNumberId?: string;
}

const norm = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9: ]/g, '')
    .trim();

// Reads a button payload ("confirm:<id>") or a reply text ("Confirmar pedido" / "Cancelar").
export function detectIntent(payload: string, text: string, isButton: boolean): { intent: Intent; orderId?: string; orderNumber?: string } {
  if (/^appt_(confirm|cancel):/.test(payload || '')) return { intent: null }; // appointment buttons (handled apart)
  const p = /^(confirm|cancel):([\w-]{1,80})$/.exec(payload || '');
  if (p) return { intent: p[1] as Intent, orderId: p[2] };
  // The landing's pre-filled message: "Quiero confirmar mi pedido ... *Pedido:* LP-12345 ...".
  const code = /\b(LP-\d{3,8})\b/i.exec(text || '');
  if (!isButton && code) {
    const orderNumber = code[1].toUpperCase();
    return /confirm/.test(norm(text)) ? { intent: 'confirm', orderNumber } : { intent: null, orderNumber };
  }
  const t = norm(text || payload || '');
  const confirm = ['confirmar pedido', 'confirmar', 'confirmo', 'confirm'];
  const cancel = ['cancelar', 'cancelar pedido', 'cancel'];
  if (isButton) {
    if (t.startsWith('confirm')) return { intent: 'confirm' };
    if (t.startsWith('cancel')) return { intent: 'cancel' };
  } else {
    // Free text only counts when it is exactly the button wording.
    if (confirm.includes(t)) return { intent: 'confirm' };
    if (cancel.includes(t)) return { intent: 'cancel' };
  }
  return { intent: null };
}

const iso = (ts?: string) => (ts && /^\d+$/.test(ts) ? new Date(Number(ts) * 1000).toISOString() : new Date().toISOString());

export function parseWebhook(body: any): { messages: InboundMessage[]; statuses: StatusUpdate[] } {
  const messages: InboundMessage[] = [];
  const statuses: StatusUpdate[] = [];
  if (body?.object !== 'whatsapp_business_account') return { messages, statuses };

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;
      const v = change.value || {};
      const phoneNumberId = v.metadata?.phone_number_id ? String(v.metadata.phone_number_id) : undefined;
      const names: Record<string, string> = {};
      for (const c of v.contacts || []) if (c?.wa_id) names[c.wa_id] = c.profile?.name;

      for (const m of v.messages || []) {
        if (!m?.id || !m?.from) continue;
        let text = '';
        let payload = '';
        let isButton = false;
        switch (m.type) {
          case 'text':
            text = m.text?.body || '';
            break;
          case 'button': // quick reply on a template
            text = m.button?.text || '';
            payload = m.button?.payload || '';
            isButton = true;
            break;
          case 'interactive': {
            const r = m.interactive?.button_reply || m.interactive?.list_reply;
            text = r?.title || '';
            payload = r?.id || '';
            isButton = true;
            break;
          }
          case 'reaction':
            text = m.reaction?.emoji ? `Reaccionó ${m.reaction.emoji}` : '';
            break;
          default:
            text = m[m.type]?.caption ? `[${m.type}] ${m[m.type].caption}` : `[${m.type}]`;
        }
        const { intent, orderId, orderNumber } = detectIntent(payload, text, isButton);
        const ap = /^appt_(confirm|cancel):([\w-]{1,80})$/.exec(payload || '');
        messages.push({
          waMessageId: m.id,
          from: String(m.from).replace(/\D/g, ''),
          profileName: names[m.from],
          timestamp: iso(m.timestamp),
          type: m.type,
          text,
          intent,
          orderId,
          orderNumber,
          ...(ap ? { appt: { action: ap[1] as 'confirm' | 'cancel', id: ap[2] } } : {}),
          phoneNumberId,
          ad: adFromReferral(m.referral, iso(m.timestamp)) || undefined,
          raw: m,
        });
      }

      for (const s of v.statuses || []) {
        if (!s?.id || !s?.status) continue;
        statuses.push({
          waMessageId: s.id,
          recipient: String(s.recipient_id || '').replace(/\D/g, ''),
          status: s.status,
          timestamp: iso(s.timestamp),
          error: s.errors?.[0] ? [s.errors[0].title || s.errors[0].message, s.errors[0].error_data?.details].filter(Boolean).join(': ') : undefined,
          phoneNumberId,
        });
      }
    }
  }
  return { messages, statuses };
}

// WhatsApp only allows free text within 24 h of the customer's last message.
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
export function insideServiceWindow(lastInboundAt?: string | null): boolean {
  return Boolean(lastInboundAt && Date.now() - new Date(lastInboundAt).getTime() < SERVICE_WINDOW_MS);
}

// ---------- message templates (needs the WhatsApp Business Account id) ----------

export interface WaTemplate {
  id: string;
  name: string;
  language: string;
  status: string; // APPROVED, PENDING, REJECTED, PAUSED, DISABLED
  category: string;
  rejected_reason?: string;
  components?: any[];
}

export async function listTemplates(): Promise<WaTemplate[]> {
  const c = await waConfig();
  if (!c) throw new Error('Conecta WhatsApp primero.');
  if (!c.wabaId) throw new Error('Falta el identificador de la cuenta de WhatsApp Business (WABA ID) en la conexión.');
  const res = await fetch(`${GRAPH}/${c.wabaId}/message_templates?fields=id,name,language,status,category,rejected_reason,components&limit=100`, {
    headers: { Authorization: `Bearer ${c.token}` },
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(graphError(data, res.status));
  return (data.data || []) as WaTemplate[];
}

export async function createTemplate(t: { name: string; language: string; category: 'UTILITY' | 'MARKETING'; body: string; examples: string[]; buttons: string[] }) {
  const c = await waConfig();
  if (!c) throw new Error('Conecta WhatsApp primero.');
  if (!c.wabaId) throw new Error('Falta el identificador de la cuenta de WhatsApp Business (WABA ID) en la conexión.');
  const components: any[] = [{ type: 'BODY', text: t.body, ...(t.examples.length ? { example: { body_text: [t.examples] } } : {}) }];
  if (t.buttons.length) components.push({ type: 'BUTTONS', buttons: t.buttons.map((text) => ({ type: 'QUICK_REPLY', text })) });
  const res = await fetch(`${GRAPH}/${c.wabaId}/message_templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.token}` },
    body: JSON.stringify({ name: t.name, language: t.language, category: t.category, components }),
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.error_user_msg || graphError(data, res.status));
  return data as { id: string; status: string; category: string };
}

export async function deleteTemplate(name: string) {
  const c = await waConfig();
  if (!c?.wabaId) throw new Error('Conecta WhatsApp primero.');
  const res = await fetch(`${GRAPH}/${c.wabaId}/message_templates?name=${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${c.token}` },
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(graphError(data, res.status));
}

// ---------- number health and messaging limits ----------

// How many different customers the number may start conversations with (templates) in a rolling 24 h.
export const LIMIT_TIERS: Record<string, number | null> = {
  TIER_50: 50,
  TIER_250: 250,
  TIER_1K: 1000,
  TIER_2K: 2000,
  TIER_10K: 10000,
  TIER_100K: 100000,
  TIER_UNLIMITED: null, // no limit
};

export interface NumberHealth {
  displayPhone: string | null;
  verifiedName: string | null;
  nameStatus: string | null;
  quality: string | null; // GREEN | YELLOW | RED | UNKNOWN
  tier: string | null; // TIER_250…
  limit: number | null | undefined; // undefined = unknown, null = unlimited
  throughput: string | null; // STANDARD | HIGH
  status: string | null; // CONNECTED, FLAGGED, RESTRICTED…
}

// Meta adds and renames fields over time: the extra ones are asked separately so a missing field never
// breaks the basic check.
export async function numberHealth(): Promise<{ ok: true; health: NumberHealth } | { ok: false; error: string }> {
  const c = await waConfig();
  if (!c) return { ok: false, error: 'WhatsApp no está conectado.' };
  const get = async (fields: string) => {
    const res = await fetch(`${GRAPH}/${c.phoneNumberId}?fields=${fields}`, { headers: { Authorization: `Bearer ${c.token}` }, signal: AbortSignal.timeout(8000), cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(graphError(data, res.status));
    return data as Record<string, any>;
  };
  try {
    const basic = await get('display_phone_number,verified_name,name_status,quality_rating');
    const extra = await get('messaging_limit_tier,throughput,status').catch(() => ({}) as Record<string, any>);
    const tier = typeof extra.messaging_limit_tier === 'string' ? extra.messaging_limit_tier : null;
    return {
      ok: true,
      health: {
        displayPhone: basic.display_phone_number || null,
        verifiedName: basic.verified_name || null,
        nameStatus: basic.name_status || null,
        quality: basic.quality_rating || null,
        tier,
        limit: tier ? (tier in LIMIT_TIERS ? LIMIT_TIERS[tier] : undefined) : undefined,
        throughput: extra.throughput?.level || null,
        status: extra.status || null,
      },
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
