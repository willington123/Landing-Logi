// Server-only storage for AI calls (Supabase): settings, call log and order call scheduling.
import { randomUUID } from 'crypto';
import { db } from '@/lib/server/db';
import { sanitizeVoiceConfig, type VoiceConfig } from '@/lib/voice-config';
import type { LandingPageConfig, OrderItem, OrderStatus } from '@/lib/types';

// ---------- settings ----------

export async function getVoiceConfig(): Promise<VoiceConfig> {
  const { data, error } = await (await db()).from('settings').select('data').eq('id', 'voice').maybeSingle();
  if (error) throw new Error(error.message);
  return sanitizeVoiceConfig(data?.data);
}

export async function saveVoiceConfig(cfg: VoiceConfig) {
  const { error } = await (await db()).from('settings').upsert({ id: 'voice', data: cfg });
  if (error) throw new Error(error.message);
}

export async function getStoreName(): Promise<string> {
  const { data } = await (await db()).from('settings').select('data').eq('id', 'default').maybeSingle();
  return ((data?.data as { storeName?: string } | undefined)?.storeName || '').trim() || 'nuestra tienda';
}

export async function getLandingInfo(id?: string): Promise<{ country?: string; currency: string }> {
  if (!id) return { currency: 'COP' };
  const { data } = await (await db()).from('landings').select('data').eq('id', id).maybeSingle();
  const l = data?.data as LandingPageConfig | undefined;
  return { country: l?.country, currency: l?.currency || 'COP' };
}

// ---------- orders ----------

export interface OrderCallRow {
  order: OrderItem;
  status: OrderStatus;
  nextCallAt: string | null;
  attempts: number;
}

export async function getOrderCallRow(id: string): Promise<OrderCallRow | null> {
  const { data, error } = await (await db()).from('orders').select('data, status, next_call_at, call_attempts').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { order: { ...(data.data as OrderItem), status: data.status as OrderStatus }, status: data.status as OrderStatus, nextCallAt: data.next_call_at, attempts: data.call_attempts || 0 };
}

// Marks the order as "calling" only if nobody else did it first (optimistic lock on status + attempts).
export async function claimOrderForCall(row: OrderCallRow, allowed: OrderStatus[]): Promise<boolean> {
  if (!allowed.includes(row.status)) return false;
  const { data, error } = await (await db())
    .from('orders')
    .update({ status: 'calling', next_call_at: null, call_attempts: row.attempts + 1, data: { ...row.order, status: 'calling' } })
    .eq('id', row.order.id)
    .eq('status', row.status)
    .eq('call_attempts', row.attempts)
    .select('id');
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}

// Sets status (column + JSON), optional next call time and extra JSON fields.
export async function setOrderCallState(id: string, status: OrderStatus, opts: { nextCallAt?: string | null; patch?: Partial<OrderItem> & Record<string, unknown> } = {}) {
  const { data: row, error: readErr } = await (await db()).from('orders').select('data').eq('id', id).maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!row) return;
  const data = {
    ...(row.data as OrderItem),
    ...(opts.patch || {}),
    status,
    ...(status === 'confirmed_by_voice' ? { confirmedAt: new Date().toISOString() } : {}),
  };
  const update: Record<string, unknown> = { status, data };
  if (opts.nextCallAt !== undefined) update.next_call_at = opts.nextCallAt;
  const { error } = await (await db()).from('orders').update(update).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function scheduleOrderCall(id: string, at: string) {
  const { error } = await (await db()).from('orders').update({ next_call_at: at }).eq('id', id);
  if (error) throw new Error(error.message);
}

// Orders whose scheduled call time has come.
export async function dueOrderIds(limit = 10): Promise<string[]> {
  const { data, error } = await (await db())
    .from('orders')
    .select('id')
    .lte('next_call_at', new Date().toISOString())
    .in('status', ['pending_call', 'retry_scheduled'])
    .order('next_call_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).map((r) => r.id as string);
}

// ---------- call log ----------

export interface CallRow {
  id: string;
  order_id: string | null;
  vapi_call_id: string | null;
  attempt: number;
  phone: string;
  status: string;
  ended_reason: string | null;
  outcome: string | null;
  outcome_notes: string | null;
  corrected_address: string | null;
  summary: string | null;
  transcript: { role: 'agent' | 'customer'; text: string; at?: number }[] | null;
  recording_url: string | null;
  duration_seconds: number | null;
  cost: number | null;
  error: string | null;
  is_test: boolean;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

export async function insertCall(row: Partial<CallRow> & { phone: string }): Promise<CallRow> {
  const full = { id: randomUUID(), status: 'queued', attempt: 1, is_test: false, created_at: new Date().toISOString(), ...row };
  const { error } = await (await db()).from('calls').insert(full);
  if (error) throw new Error(error.message);
  return full as CallRow;
}

export async function updateCall(id: string, patch: Partial<CallRow>) {
  const { error } = await (await db()).from('calls').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getCallByVapiId(vapiId: string): Promise<CallRow | null> {
  const { data, error } = await (await db()).from('calls').select('*').eq('vapi_call_id', vapiId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CallRow) || null;
}

// A call for this order that has not finished yet (avoids calling twice at once).
export async function hasActiveCall(orderId: string): Promise<boolean> {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // stale calls stop blocking after 15 min
  const { data, error } = await (await db()).from('calls').select('id').eq('order_id', orderId).in('status', ['queued', 'ringing', 'in-progress', 'forwarding']).gte('created_at', since).limit(1);
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}

export type OrderBrief = Pick<OrderItem, 'id' | 'orderNumber' | 'customerName' | 'productName' | 'comboName' | 'totalAmount' | 'city' | 'status'>;

export async function listCalls(limit = 100): Promise<(CallRow & { order: OrderBrief | null })[]> {
  const { data, error } = await (await db()).from('calls').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data || []) as CallRow[];
  const ids = Array.from(new Set(rows.map((r) => r.order_id).filter(Boolean) as string[]));
  const orders: Record<string, OrderBrief> = {};
  if (ids.length) {
    const { data: os } = await (await db()).from('orders').select('id, data, status').in('id', ids);
    for (const r of os || []) {
      const o = r.data as OrderItem;
      orders[r.id] = { id: o.id, orderNumber: o.orderNumber, customerName: o.customerName, productName: o.productName, comboName: o.comboName, totalAmount: o.totalAmount, city: o.city, status: r.status as OrderStatus };
    }
  }
  return rows.map((r) => ({ ...r, order: (r.order_id && orders[r.order_id]) || null }));
}
