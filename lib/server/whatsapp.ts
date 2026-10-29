// WhatsApp Business Cloud API: sending, webhook signature check and payload parsing.
// Server-only: uses the WhatsApp access token and app secret.
import { createHmac, timingSafeEqual } from 'crypto';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v26.0';

const env = (k: string) => (process.env[k] || '').trim();

export const WHATSAPP_ENV = ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_CONFIRM_TEMPLATE'] as const;

// Can send messages (free text and templates).
export function whatsappEnabled(): boolean {
  return Boolean(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID'));
}

// Can send the automatic order confirmation template.
export function confirmTemplateEnabled(): boolean {
  return whatsappEnabled() && Boolean(env('WHATSAPP_CONFIRM_TEMPLATE'));
}

export function whatsappStatus() {
  return {
    sending: whatsappEnabled(),
    confirmTemplate: confirmTemplateEnabled(),
    webhook: Boolean(env('WHATSAPP_VERIFY_TOKEN') && env('WHATSAPP_APP_SECRET')),
    cron: Boolean(env('CRON_SECRET')), // scheduled task, needed for the fallback template
    missing: WHATSAPP_ENV.filter((k) => !env(k)),
  };
}

export function verifyToken(): string {
  return env('WHATSAPP_VERIFY_TOKEN');
}

// Checks X-Hub-Signature-256 ("sha256=<hex>") against HMAC-SHA256(rawBody, app secret).
export function verifySignature(rawBody: string, header: string | null, secret = env('WHATSAPP_APP_SECRET')): boolean {
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

async function send(body: Record<string, unknown>): Promise<SendResult> {
  if (!whatsappEnabled()) return { ok: false, error: 'WhatsApp no está configurado' };
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('WHATSAPP_TOKEN')}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...body }),
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error?.error_data?.details || data?.error?.message || `HTTP ${res.status}` };
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
export function sendConfirmTemplate(to: string, vars: { name: string; product: string; total: string; city: string }, orderId: string): Promise<SendResult> {
  if (!confirmTemplateEnabled()) return Promise.resolve({ ok: false, error: 'Plantilla de confirmación no configurada' });
  return send({
    to,
    type: 'template',
    template: {
      name: env('WHATSAPP_CONFIRM_TEMPLATE'),
      language: { code: env('WHATSAPP_TEMPLATE_LANG') || 'es' },
      components: [
        { type: 'body', parameters: [param(vars.name), param(vars.product), param(vars.total), param(vars.city)] },
        { type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: `confirm:${orderId}` }] },
        { type: 'button', sub_type: 'quick_reply', index: '1', parameters: [{ type: 'payload', payload: `cancel:${orderId}` }] },
      ],
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
export async function phoneNumberInfo(): Promise<{ ok: true; info: PhoneNumberInfo } | { ok: false; error: string }> {
  if (!whatsappEnabled()) return { ok: false, error: 'WhatsApp no está configurado' };
  try {
    const fields = 'display_phone_number,verified_name,name_status,quality_rating,code_verification_status';
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${env('WHATSAPP_PHONE_NUMBER_ID')}?fields=${fields}`, {
      headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}` },
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
  if (!whatsappEnabled()) return { ok: false, status: 503, error: 'WhatsApp no está configurado' };
  try {
    const auth = { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}` };
    const meta = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, { headers: auth, signal: AbortSignal.timeout(8000), cache: 'no-store' });
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
  raw: unknown;
}

export interface StatusUpdate {
  waMessageId: string;
  recipient: string;
  status: 'sent' | 'delivered' | 'read' | 'failed' | string;
  timestamp: string;
  error?: string;
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
