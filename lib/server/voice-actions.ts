// AI call flows: start a call for an order, apply the customer's answer, close calls and retries.
import { cloudEnabled, db } from '@/lib/server/db';
import { normalizePhone } from '@/lib/phone';
import { nextCallTime, withinCallHours, type VoiceConfig } from '@/lib/voice-config';
import {
  createVapiCall,
  getVapiCall,
  isNoAnswer,
  publicBaseUrl,
  recordingUrl,
  transcriptLines,
  vapiEnabled,
  type CallOrderInfo,
  type ToolResult,
} from '@/lib/server/vapi';
import {
  claimOrderForCall,
  dueOrderIds,
  getCallByVapiId,
  getLandingInfo,
  getOrderCallRow,
  getStoreName,
  getVoiceConfig,
  hasActiveCall,
  insertCall,
  scheduleOrderCall,
  setOrderCallState,
  updateCall,
  type CallRow,
} from '@/lib/server/voice-store';
import type { OrderItem, OrderStatus } from '@/lib/types';

const AUTO_STATUSES: OrderStatus[] = ['pending_call', 'retry_scheduled'];
// A person may also retry orders that need review, went unanswered or got stuck "calling".
const MANUAL_STATUSES: OrderStatus[] = ['pending_call', 'retry_scheduled', 'needs_review', 'unanswered', 'calling'];

export type StartResult = { ok: true; callId: string } | { ok: false; error: string; scheduledAt?: string };

function webhookUrl(origin?: string): string {
  const base = publicBaseUrl(origin);
  return base ? `${base}/api/vapi/webhook` : '';
}

const later = (cfg: VoiceConfig, minutes: number) => nextCallTime(new Date(Date.now() + minutes * 60 * 1000), cfg).toISOString();

async function placeCall(p: { orderId?: string; attempt: number; phone: string; info: CallOrderInfo; cfg: VoiceConfig; origin?: string; isTest?: boolean }): Promise<StartResult> {
  const url = webhookUrl(p.origin);
  const call = await insertCall({ order_id: p.orderId || null, attempt: p.attempt, phone: p.phone, is_test: Boolean(p.isTest) });
  try {
    if (!url) throw new Error('No se conoce la URL pública del sitio. Configura PUBLIC_BASE_URL.');
    const store = await getStoreName();
    const v = await createVapiCall({ phoneE164: p.phone, order: p.info, cfg: p.cfg, store, webhookUrl: url });
    await updateCall(call.id, { vapi_call_id: v.id, status: v.status });
    return { ok: true, callId: call.id };
  } catch (e: any) {
    const error = e?.message || String(e);
    await updateCall(call.id, { status: 'failed', error }).catch(() => {});
    return { ok: false, error };
  }
}

function orderInfo(o: OrderItem, currency: string): CallOrderInfo {
  return {
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    productName: o.productName,
    comboName: o.comboName,
    units: o.units,
    totalAmount: o.totalAmount,
    currency,
    address: o.address,
    city: o.city,
    department: o.department,
    notes: o.notes,
  };
}

// Calls the customer of an order now. `manual` = a person pressed "Llamar" (ignores hours and auto-call).
export async function startOrderCall(orderId: string, opts: { manual: boolean; origin?: string }): Promise<StartResult> {
  if (!vapiEnabled()) return { ok: false, error: 'Vapi no está configurado.' };
  const row = await getOrderCallRow(orderId);
  if (!row) return { ok: false, error: 'Pedido no encontrado.' };
  const cfg = await getVoiceConfig();

  if (!opts.manual) {
    if (row.attempts >= cfg.maxAttempts) {
      await setOrderCallState(orderId, 'unanswered', { nextCallAt: null });
      return { ok: false, error: 'Se alcanzó el máximo de intentos.' };
    }
    if (!withinCallHours(new Date(), cfg)) {
      const at = nextCallTime(new Date(), cfg).toISOString();
      await scheduleOrderCall(orderId, at);
      return { ok: false, error: 'Fuera del horario de llamadas.', scheduledAt: at };
    }
  }
  if (await hasActiveCall(orderId)) return { ok: false, error: 'Ya hay una llamada en curso para este pedido.' };
  if (!(await claimOrderForCall(row, opts.manual ? MANUAL_STATUSES : AUTO_STATUSES))) {
    return { ok: false, error: 'Este pedido ya no está pendiente de confirmación.' };
  }

  const landing = await getLandingInfo(row.order.landingPageId);
  const phone = `+${normalizePhone(row.order.phone, landing.country)}`;
  const result = await placeCall({ orderId, attempt: row.attempts + 1, phone, info: orderInfo(row.order, landing.currency), cfg, origin: opts.origin });
  if (!result.ok) await setOrderCallState(orderId, 'needs_review', { nextCallAt: null, patch: { callNotes: `No se pudo llamar: ${result.error}` } });
  return result;
}

// Test call to the seller's own phone with a sample order. Nothing is changed.
export async function startTestCall(phone: string, origin?: string): Promise<StartResult> {
  if (!vapiEnabled()) return { ok: false, error: 'Vapi no está configurado.' };
  const digits = normalizePhone(phone);
  if (digits.length < 10) return { ok: false, error: 'Escribe un número con indicativo de país, por ejemplo +57 300 123 4567.' };
  const cfg = await getVoiceConfig();
  const info: CallOrderInfo = {
    orderNumber: 'LP-PRUEBA',
    customerName: 'Cliente de prueba',
    productName: 'Producto de prueba',
    comboName: '1 unidad',
    units: 1,
    totalAmount: 89900,
    currency: 'COP',
    address: 'Calle 10 # 20-30',
    city: 'Medellín',
    department: 'Antioquia',
  };
  return placeCall({ attempt: 1, phone: `+${digits}`, info, cfg, origin, isTest: true });
}

// New order from a landing: call now or schedule the first call. Never throws.
export async function onNewOrder(order: OrderItem, origin?: string) {
  try {
    if (!vapiEnabled() || !cloudEnabled()) return null;
    const cfg = await getVoiceConfig();
    if (!cfg.autoCall) return null;
    const at = nextCallTime(new Date(Date.now() + cfg.delayMinutes * 60 * 1000), cfg);
    if (at.getTime() - Date.now() > 60 * 1000) {
      await scheduleOrderCall(order.id, at.toISOString());
      return { scheduledAt: at.toISOString() };
    }
    const r = await startOrderCall(order.id, { manual: false, origin });
    return r.ok ? { callId: r.callId } : { error: r.error, scheduledAt: 'scheduledAt' in r ? r.scheduledAt : undefined };
  } catch (e: any) {
    console.error('Vapi: no se pudo programar la llamada', e);
    return { error: e?.message || String(e) };
  }
}

// The assistant called "registrar_resultado" during the call.
export async function applyToolResult(call: CallRow, r: ToolResult): Promise<string> {
  if (!r.outcome) return 'No entendí el resultado. Usa confirmado, cancelado, volver_a_llamar o revisar.';
  await updateCall(call.id, { outcome: r.outcome, outcome_notes: r.notes || null, corrected_address: r.correctedAddress || null });
  if (call.is_test || !call.order_id) return 'Resultado guardado (llamada de prueba).';

  const row = await getOrderCallRow(call.order_id);
  if (!row) return 'Resultado guardado.';
  const cfg = await getVoiceConfig();
  const notes = r.notes ? { callNotes: r.notes } : {};
  switch (r.outcome) {
    case 'confirmed': {
      const address = r.correctedAddress && r.correctedAddress !== row.order.address ? { address: r.correctedAddress, previousAddress: row.order.address } : {};
      await setOrderCallState(row.order.id, 'confirmed_by_voice', { nextCallAt: null, patch: { ...notes, ...address } });
      return 'Pedido confirmado. Despídete del cliente.';
    }
    case 'cancelled':
      await setOrderCallState(row.order.id, 'cancelled', { nextCallAt: null, patch: notes });
      return 'Pedido cancelado. Despídete con amabilidad.';
    case 'callback':
      if (row.attempts < cfg.maxAttempts) {
        await setOrderCallState(row.order.id, 'retry_scheduled', { nextCallAt: later(cfg, cfg.retryMinutes), patch: notes });
        return 'Listo, se volverá a llamar más tarde. Despídete.';
      }
      await setOrderCallState(row.order.id, 'needs_review', { nextCallAt: null, patch: notes });
      return 'Un asesor se comunicará después. Despídete.';
    default:
      await setOrderCallState(row.order.id, 'needs_review', { nextCallAt: null, patch: notes });
      return 'Un asesor revisará el pedido. Despídete.';
  }
}

// The call ended: store transcript, recording and cost, and decide what happens to the order.
// Reads the call from Vapi with the private key, so a forged webhook can't change anything.
export async function finalizeCall(vapiCallId: string) {
  const call = await getCallByVapiId(vapiCallId);
  if (!call) return;
  let endedReason: string | undefined;
  let summary: string | undefined;
  try {
    const v = await getVapiCall(vapiCallId);
    if (v.status && v.status !== 'ended') return; // not finished yet; a later report or the sweep will close it
    endedReason = v.endedReason;
    summary = v.analysis?.summary;
    const started = v.startedAt ? new Date(v.startedAt).getTime() : 0;
    const ended = v.endedAt ? new Date(v.endedAt).getTime() : 0;
    await updateCall(call.id, {
      status: 'ended',
      ended_reason: v.endedReason || null,
      summary: v.analysis?.summary || null,
      transcript: transcriptLines(v),
      recording_url: recordingUrl(v) || null,
      duration_seconds: started && ended ? Math.max(0, Math.round((ended - started) / 1000)) : null,
      cost: typeof v.cost === 'number' ? v.cost : null,
      started_at: v.startedAt || null,
      ended_at: v.endedAt || null,
    });
  } catch (e: any) {
    await updateCall(call.id, { status: 'ended', error: `No se pudo leer la llamada en Vapi: ${e?.message || e}` });
  }
  if (call.is_test || !call.order_id) return;

  const row = await getOrderCallRow(call.order_id);
  // Only decide if nothing else changed the order meanwhile (tool result, WhatsApp, a person).
  if (!row || row.status !== 'calling') return;
  const cfg = await getVoiceConfig();
  if (isNoAnswer(endedReason)) {
    if (row.attempts < cfg.maxAttempts) await setOrderCallState(row.order.id, 'retry_scheduled', { nextCallAt: later(cfg, cfg.retryMinutes) });
    else await setOrderCallState(row.order.id, 'unanswered', { nextCallAt: null });
    return;
  }
  await setOrderCallState(row.order.id, 'needs_review', { nextCallAt: null, patch: { callNotes: summary || 'La llamada terminó sin una respuesta clara del cliente.' } });
}

// Cron: place due calls and close calls whose webhook never arrived.
export async function processCallQueue(origin?: string) {
  const out = { started: 0, skipped: 0, closed: 0, errors: [] as string[] };
  if (!vapiEnabled() || !cloudEnabled()) return out;

  const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: stale } = await db()
    .from('calls')
    .select('vapi_call_id')
    .in('status', ['queued', 'ringing', 'in-progress', 'forwarding'])
    .lt('created_at', staleBefore)
    .not('vapi_call_id', 'is', null)
    .limit(20);
  for (const s of stale || []) {
    await finalizeCall(s.vapi_call_id as string)
      .then(() => out.closed++)
      .catch((e) => out.errors.push(String(e?.message || e)));
  }

  for (const id of await dueOrderIds(10)) {
    const r = await startOrderCall(id, { manual: false, origin }).catch((e) => ({ ok: false as const, error: String(e?.message || e) }));
    if (r.ok) out.started++;
    else {
      out.skipped++;
      if (!/horario|pendiente|curso/.test(r.error)) out.errors.push(`${id}: ${r.error}`);
    }
  }
  return out;
}
