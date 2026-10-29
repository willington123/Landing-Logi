// Server-only storage for WhatsApp conversations and messages (Supabase).
import { randomUUID } from 'crypto';
import { db } from '@/lib/server/db';
import { normalizePhone } from '@/lib/server/meta-capi';
import type { OrderItem, OrderStatus } from '@/lib/types';
import type { InboundMessage, SendResult, StatusUpdate } from '@/lib/server/whatsapp';

export interface WaConversation {
  id: string; // customer phone, E.164 digits
  name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
  unread_count: number;
  order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WaMessage {
  id: string;
  conversation_id: string;
  wa_message_id: string | null;
  direction: 'in' | 'out';
  type: string;
  body: string;
  status: string | null;
  error: string | null;
  order_id: string | null;
  created_at: string;
  media?: WaMedia | null; // photo, voice note, video, document or sticker sent by the customer
}

export interface WaMedia {
  id: string;
  kind: 'image' | 'audio' | 'video' | 'document' | 'sticker';
  mime?: string;
  caption?: string;
  filename?: string;
}

const MEDIA_KINDS = ['image', 'audio', 'video', 'document', 'sticker'] as const;

// Media details from the raw webhook message saved in "payload".
export function mediaFromPayload(payload: any): WaMedia | null {
  const kind = MEDIA_KINDS.find((k) => k === payload?.type);
  const m = kind && payload?.[kind];
  if (!kind || !m?.id || !/^\d{5,40}$/.test(String(m.id))) return null;
  return { id: String(m.id), kind, mime: m.mime_type, caption: m.caption, filename: m.filename };
}

export const PENDING_STATUSES: OrderStatus[] = ['pending_call', 'retry_scheduled', 'needs_review', 'unanswered'];

const preview = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 160);

async function getConversation(id: string): Promise<WaConversation | null> {
  const { data, error } = await db().from('wa_conversations').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as WaConversation) || null;
}

async function upsertConversation(id: string, patch: Partial<WaConversation>) {
  const existing = await getConversation(id);
  const row = { ...(existing || { id, unread_count: 0 }), ...patch, id, updated_at: new Date().toISOString() };
  const { error } = await db().from('wa_conversations').upsert(row);
  if (error) throw new Error(error.message);
  return row as WaConversation;
}

// Only ids of orders that exist can be linked (test buttons use "prueba"; an order may have been deleted).
async function existingOrderId(id?: string): Promise<string | null> {
  if (!id) return null;
  const { data } = await db().from('orders').select('id').eq('id', id).maybeSingle();
  return (data?.id as string) || null;
}

// Saves a message we sent (template, auto-reply or manual reply).
export async function recordOutbound(p: { phone: string; name?: string; orderId?: string; type: string; body: string; result: SendResult }) {
  const now = new Date().toISOString();
  const existing = await getConversation(p.phone);
  const orderId = await existingOrderId(p.orderId);
  await upsertConversation(p.phone, {
    name: existing?.name || p.name || null,
    order_id: orderId || existing?.order_id || null,
    last_message: preview(p.body),
    last_message_at: now,
  });
  const { error } = await db().from('wa_messages').insert({
    id: randomUUID(),
    conversation_id: p.phone,
    wa_message_id: p.result.messageId || null,
    direction: 'out',
    type: p.type,
    body: p.body,
    status: p.result.ok ? 'sent' : 'failed',
    error: p.result.error || null,
    order_id: orderId || existing?.order_id || null,
    created_at: now,
  });
  if (error) throw new Error(error.message);
}

// Saves an incoming message. Returns false if Meta already delivered it (webhook retry).
export async function recordInbound(m: InboundMessage): Promise<{ isNew: boolean; conversation: WaConversation }> {
  const existing = await getConversation(m.from);
  if (!existing) await upsertConversation(m.from, { name: m.profileName || null });
  const orderId = await existingOrderId(m.orderId);
  const { data, error } = await db()
    .from('wa_messages')
    .upsert(
      {
        id: randomUUID(),
        conversation_id: m.from,
        wa_message_id: m.waMessageId,
        direction: 'in',
        type: m.type,
        body: m.text,
        status: 'received',
        order_id: orderId || existing?.order_id || null,
        payload: m.raw,
        created_at: m.timestamp,
      },
      { onConflict: 'wa_message_id', ignoreDuplicates: true },
    )
    .select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) return { isNew: false, conversation: (existing || (await getConversation(m.from)))! };

  const current = (await getConversation(m.from))!;
  const conversation = await upsertConversation(m.from, {
    name: current.name || m.profileName || null,
    last_message: preview(m.text),
    last_message_at: m.timestamp,
    last_inbound_at: m.timestamp,
    unread_count: (current.unread_count || 0) + 1,
  });
  return { isNew: true, conversation };
}

const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };

// Applies a sent/delivered/read/failed update. Never moves a status backwards.
export async function applyStatus(s: StatusUpdate) {
  const { data: row } = await db().from('wa_messages').select('id, status').eq('wa_message_id', s.waMessageId).maybeSingle();
  if (!row) return;
  if ((STATUS_RANK[s.status] || 0) <= (STATUS_RANK[row.status as string] || 0)) return;
  await db().from('wa_messages').update({ status: s.status, error: s.error || null }).eq('id', row.id);
}

// ---------- orders ----------

const digits = (v: string) => (v || '').replace(/\D/g, '');

export function samePhone(order: OrderItem & { whatsapp?: { to?: string } }, phone: string): boolean {
  if (order.whatsapp?.to === phone) return true;
  if (normalizePhone(order.phone) === phone) return true;
  const d = digits(order.phone);
  return d.length >= 7 && phone.endsWith(d);
}

// The customer's most recent order still waiting for confirmation.
// With a button payload order id, only that order counts (and only if it belongs to this phone),
// so tapping a button on an old message never changes a different order.
export async function findPendingOrder(phone: string, orderId?: string): Promise<OrderItem | null> {
  const { data, error } = await db()
    .from('orders')
    .select('data, status')
    .in('status', PENDING_STATUSES)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  const orders = (data || []).map((r) => ({ ...(r.data as OrderItem), status: r.status as OrderStatus }));
  const mine = orders.filter((o) => samePhone(o, phone));
  if (orderId) return mine.find((o) => o.id === orderId) || null;
  return mine[0] || null;
}

// Order by its public number ("LP-12345"); with pendingOnly, only if it still waits for confirmation.
export async function findOrderByNumber(orderNumber: string, pendingOnly = false): Promise<OrderItem | null> {
  let q = db().from('orders').select('data, status').eq('order_number', orderNumber);
  if (pendingOnly) q = q.in('status', PENDING_STATUSES);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  const r = data?.[0];
  return r ? { ...(r.data as OrderItem), status: r.status as OrderStatus } : null;
}

// ---------- inbox (admin) ----------

export type OrderSummary = Pick<
  OrderItem,
  'id' | 'orderNumber' | 'productName' | 'comboName' | 'totalAmount' | 'status' | 'city' | 'department' | 'address' | 'customerName' | 'phone' | 'createdAt'
>;

async function orderSummaries(ids: string[]): Promise<Record<string, OrderSummary>> {
  if (!ids.length) return {};
  const { data, error } = await db().from('orders').select('id, data, status').in('id', ids);
  if (error) throw new Error(error.message);
  const out: Record<string, OrderSummary> = {};
  for (const r of data || []) {
    const o = r.data as OrderItem;
    out[r.id] = {
      id: o.id,
      orderNumber: o.orderNumber,
      productName: o.productName,
      comboName: o.comboName,
      totalAmount: o.totalAmount,
      status: r.status as OrderStatus,
      city: o.city,
      department: o.department,
      address: o.address,
      customerName: o.customerName,
      phone: o.phone,
      createdAt: o.createdAt,
    };
  }
  return out;
}

export async function listConversations(limit = 200) {
  const { data, error } = await db().from('wa_conversations').select('*').order('last_message_at', { ascending: false, nullsFirst: false }).limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data || []) as WaConversation[];
  const orders = await orderSummaries(Array.from(new Set(rows.map((r) => r.order_id).filter(Boolean) as string[])));
  return rows.map((r) => ({ ...r, order: (r.order_id && orders[r.order_id]) || null }));
}

export async function getConversationWithOrder(id: string) {
  const c = await getConversation(id);
  if (!c) return null;
  const orders = c.order_id ? await orderSummaries([c.order_id]) : {};
  return { ...c, order: (c.order_id && orders[c.order_id]) || null };
}

export async function listMessages(conversationId: string, limit = 300): Promise<WaMessage[]> {
  const { data, error } = await db()
    .from('wa_messages')
    .select('id, conversation_id, wa_message_id, direction, type, body, status, error, order_id, created_at, payload')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || [])
    .map(({ payload, ...m }: any) => ({ ...m, media: m.direction === 'in' ? mediaFromPayload(payload) : null }) as WaMessage)
    .reverse();
}

// For the menu badge and the new-message sound.
export async function unreadSummary() {
  const { data, error } = await db().from('wa_conversations').select('unread_count, last_inbound_at, last_message_at').gt('unread_count', 0).limit(1000);
  if (error) throw new Error(error.message);
  const rows = data || [];
  return {
    unread: rows.reduce((n, r) => n + (Number(r.unread_count) || 0), 0),
    chats: rows.length,
    lastInboundAt: rows.reduce<string | null>((max, r) => (r.last_inbound_at && (!max || r.last_inbound_at > max) ? r.last_inbound_at : max), null),
  };
}

export async function markConversationRead(id: string) {
  const { error } = await db().from('wa_conversations').update({ unread_count: 0 }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function linkConversationOrder(id: string, orderId: string) {
  await db().from('wa_conversations').update({ order_id: orderId }).eq('id', id);
}

// ---------- webhook health (shown in Integrations) ----------

export interface WebhookHealth {
  lastOkAt?: string; // last notice from Meta with a valid signature
  lastMessages?: number;
  lastStatuses?: number;
  lastInvalidAt?: string; // last notice rejected because the signature didn't match WHATSAPP_APP_SECRET
  lastErrorAt?: string;
  lastError?: string; // last error while processing a valid notice (e.g. missing tables)
}

export async function noteWebhook(patch: WebhookHealth) {
  try {
    const { data } = await db().from('settings').select('data').eq('id', 'wa_webhook').maybeSingle();
    await db().from('settings').upsert({ id: 'wa_webhook', data: { ...((data?.data as WebhookHealth) || {}), ...patch } });
  } catch {
    // Diagnostics must never break the webhook.
  }
}

export async function getWebhookHealth(): Promise<WebhookHealth | null> {
  const { data, error } = await db().from('settings').select('data').eq('id', 'wa_webhook').maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as WebhookHealth) || null;
}

// ---------- confirmation mode ----------
// customer_first: the landing sends the customer to WhatsApp and they write first (no template, free).
// template: the confirmation template with buttons is sent to every new order.

export type WaConfirmMode = 'customer_first' | 'template';

export interface WaSettings {
  mode: WaConfirmMode;
  // customer_first only: send the template if the customer hasn't confirmed after this many minutes (0 = never).
  fallbackMinutes: number;
}

const FALLBACK_OPTIONS = [0, 10, 15, 30, 60, 120];

export async function getWaSettings(): Promise<WaSettings> {
  const { data } = await db().from('settings').select('data').eq('id', 'whatsapp').maybeSingle();
  const d = (data?.data || {}) as Partial<WaSettings>;
  return {
    mode: d.mode === 'customer_first' ? 'customer_first' : 'template',
    fallbackMinutes: FALLBACK_OPTIONS.includes(Number(d.fallbackMinutes)) ? Number(d.fallbackMinutes) : 0,
  };
}

export async function getWaMode(): Promise<WaConfirmMode> {
  return (await getWaSettings()).mode;
}

export async function saveWaSettings(input: Partial<WaSettings>) {
  const current = await getWaSettings();
  const next: WaSettings = {
    mode: input.mode === 'customer_first' || input.mode === 'template' ? input.mode : current.mode,
    fallbackMinutes: FALLBACK_OPTIONS.includes(Number(input.fallbackMinutes)) ? Number(input.fallbackMinutes) : current.fallbackMinutes,
  };
  const { error } = await db().from('settings').upsert({ id: 'whatsapp', data: next });
  if (error) throw new Error(error.message);
  return next;
}

// Orders whose fallback template time has come (set in order data as waFallbackAt).
export async function dueWaFallbackOrders(limit = 20): Promise<OrderItem[]> {
  const { data, error } = await db()
    .from('orders')
    .select('data, status')
    .lte('data->>waFallbackAt', new Date().toISOString())
    .in('status', PENDING_STATUSES)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).map((r) => ({ ...(r.data as OrderItem), status: r.status as OrderStatus }));
}

