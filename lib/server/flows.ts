// Runs the store's custom flows: events from orders, chats and appointments, waits, and the actions.
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { db } from '@/lib/server/db';
import { requestOrgSync } from '@/lib/server/tenant';
import { normalizePhone } from '@/lib/phone';
import { formatMoney } from '@/lib/whatsapp-link';
import { formatWhen, type Appointment } from '@/lib/agenda';
import { statusLabel, webhookUrlError, type Flow, type FlowAction, type FlowCondition, type FlowLogItem, type FlowStats } from '@/lib/flows';
import type { OrderItem } from '@/lib/types';

const FLOWS = 'flows';
const JOBS = 'flow_jobs';
const DONE = 'flow_done';
const STATS = 'flow_stats';
const LOG = 'flow_log';
const MAX_JOBS = 2000;
const IDLE_WINDOW_MS = 6 * 3600000; // a chat counts as idle for 6 h after reaching the flow's hours
const KEYWORD_AGAIN_MS = 24 * 3600000; // the same keyword flow runs at most once a day per chat

async function readSetting<T>(id: string): Promise<T | null> {
  const { data, error } = await (await db()).from('settings').select('data').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as T) ?? null;
}
async function writeSetting(id: string, data: unknown) {
  const { error } = await (await db()).from('settings').upsert({ id, data });
  if (error) throw new Error(error.message);
}

export async function getFlows(): Promise<Flow[]> {
  return (await readSetting<Flow[]>(FLOWS)) || [];
}
export async function saveFlows(flows: Flow[]) {
  await writeSetting(FLOWS, flows);
  // Jobs of deleted flows go away.
  const ids = new Set(flows.map((f) => f.id));
  const jobs = await readJobs();
  if (jobs.some((j) => !ids.has(j.flowId))) await writeSetting(JOBS, jobs.filter((j) => ids.has(j.flowId)));
}
export async function getFlowStats(): Promise<Record<string, FlowStats>> {
  return (await readSetting<Record<string, FlowStats>>(STATS)) || {};
}
export async function getFlowLog(): Promise<FlowLogItem[]> {
  return ((await readSetting<{ items?: FlowLogItem[] }>(LOG))?.items || []).slice(0, 100);
}
export async function pendingJobsCount(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const j of await readJobs()) out[j.flowId] = (out[j.flowId] || 0) + 1;
  return out;
}

// ---------- events ----------

// What a flow runs about. Loaded fresh again when a wait ends.
export interface FlowSubject {
  orderId?: string;
  apptId?: string;
  phone?: string; // conversation id (E.164 digits)
  name?: string;
}

export type FlowEvent =
  | { type: 'order_created'; order: OrderItem }
  | { type: 'order_status'; order: OrderItem; from?: string }
  | { type: 'message'; phone: string; text: string; name?: string }
  | { type: 'appointment_created'; appt: Appointment }
  | { type: 'appointment_status'; appt: Appointment; from?: string };

interface Job {
  id: string;
  flowId: string;
  dueAt: string;
  subject: FlowSubject;
}

// Changes made by a flow don't start other flows (no loops).
const inFlow = new AsyncLocalStorage<boolean>();

const words = (s: string) =>
  ` ${s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')} `;

function matches(flow: Flow, ev: FlowEvent): boolean {
  const t = flow.trigger;
  switch (ev.type) {
    case 'order_created':
      return t.type === 'order_created';
    case 'order_status':
      return t.type === 'order_status' && t.status === ev.order.status && ev.from !== ev.order.status;
    case 'appointment_created':
      return t.type === 'appointment_created';
    case 'appointment_status':
      return t.type === 'appointment_status' && t.status === ev.appt.status && ev.from !== ev.appt.status;
    case 'message': {
      if (t.type !== 'message_keyword') return false;
      const text = words(ev.text);
      return t.keywords.some((k) => k && text.includes(words(k)));
    }
  }
}

function subjectOf(ev: FlowEvent): FlowSubject {
  switch (ev.type) {
    case 'order_created':
    case 'order_status':
      return { orderId: ev.order.id, name: ev.order.customerName };
    case 'appointment_created':
    case 'appointment_status':
      return { apptId: ev.appt.id, phone: ev.appt.phone, name: ev.appt.customerName };
    case 'message':
      return { phone: ev.phone, name: ev.name };
  }
}

// Once per order/appointment/chat moment for each flow.
function doneKey(flow: Flow, ev: FlowEvent): string {
  switch (ev.type) {
    case 'order_created':
      return `${flow.id}:o:${ev.order.id}`;
    case 'order_status':
      return `${flow.id}:o:${ev.order.id}:${ev.order.status}`;
    case 'appointment_created':
      return `${flow.id}:a:${ev.appt.id}`;
    case 'appointment_status':
      return `${flow.id}:a:${ev.appt.id}:${ev.appt.status}`;
    case 'message':
      return `${flow.id}:m:${ev.phone}`;
  }
}

async function claim(keys: { key: string; again?: number }[]): Promise<Set<string>> {
  const done = (await readSetting<Record<string, string>>(DONE)) || {};
  const now = Date.now();
  const ok = new Set<string>();
  for (const { key, again } of keys) {
    const at = done[key] ? new Date(done[key]).getTime() : 0;
    if (at && (!again || now - at < again)) continue;
    done[key] = new Date(now).toISOString();
    ok.add(key);
  }
  if (ok.size) {
    // Keep 90 days of marks.
    const cutoff = now - 90 * 86400000;
    for (const [k, v] of Object.entries(done)) if (new Date(v).getTime() < cutoff) delete done[k];
    await writeSetting(DONE, done);
  }
  return ok;
}

// Called where things happen. Never throws and never blocks the caller for long.
export async function emitFlowEvent(ev: FlowEvent): Promise<void> {
  try {
    if (inFlow.getStore()) return;
    if (!requestOrgSync()) return;
    const flows = (await getFlows()).filter((f) => f.enabled && matches(f, ev));
    if (!flows.length) return;
    const keys = flows.map((f) => ({ key: doneKey(f, ev), again: ev.type === 'message' ? KEYWORD_AGAIN_MS : undefined }));
    const claimed = await claim(keys);
    const subject = subjectOf(ev);
    const later: Job[] = [];
    for (const f of flows) {
      if (!claimed.has(doneKey(f, ev))) continue;
      if (f.waitMinutes > 0) later.push({ id: randomUUID().slice(0, 12), flowId: f.id, dueAt: new Date(Date.now() + f.waitMinutes * 60000).toISOString(), subject });
      else await runFlow(f, subject);
    }
    if (later.length) {
      const jobs = await readJobs();
      await writeSetting(JOBS, [...jobs, ...later].slice(-MAX_JOBS));
    }
  } catch (e) {
    console.error('Flujos:', e);
  }
}

async function readJobs(): Promise<Job[]> {
  return (await readSetting<Job[]>(JOBS)) || [];
}

// ---------- context ----------

interface Ctx {
  order?: OrderItem & { currency?: string; country?: string };
  appt?: Appointment & { serviceName?: string; staffName?: string; when?: string };
  phone?: string; // conversation id
  name?: string;
  conv?: { last_inbound_at: string | null; order_id: string | null } | null;
  fromAd: boolean;
}

async function loadOrder(id: string) {
  const { data } = await (await db()).from('orders').select('data, status').eq('id', id).maybeSingle();
  if (!data) return null;
  const order = { ...(data.data as OrderItem), status: data.status as OrderItem['status'] };
  const { data: l } = order.landingPageId ? await (await db()).from('landings').select('data').eq('id', order.landingPageId).maybeSingle() : { data: null };
  const landing = (l?.data || {}) as { currency?: string; country?: string };
  return { ...order, currency: landing.currency || 'COP', country: landing.country };
}

async function buildCtx(s: FlowSubject): Promise<Ctx | null> {
  const { getConversation } = await import('@/lib/server/wa-store');
  const { getConversationAds } = await import('@/lib/server/crm-store');
  const ctx: Ctx = { fromAd: false, name: s.name };
  if (s.orderId) {
    const order = await loadOrder(s.orderId);
    if (!order) return null;
    ctx.order = order;
    ctx.name = order.customerName;
    ctx.phone = order.whatsappFrom || order.whatsapp?.to || normalizePhone(order.phone, order.country);
    ctx.fromAd = Boolean(order.adId);
  }
  if (s.apptId) {
    const { getAgenda, getAppointment } = await import('@/lib/server/agenda');
    const [appt, agenda] = await Promise.all([getAppointment(s.apptId), getAgenda()]);
    if (!appt) return null;
    ctx.appt = {
      ...appt,
      serviceName: agenda.services.find((x) => x.id === appt.serviceId)?.name,
      staffName: agenda.staff.find((x) => x.id === appt.staffId)?.name,
      when: formatWhen(appt.start, agenda.timezone),
    };
    ctx.name = appt.customerName;
    ctx.phone = appt.phone;
  }
  if (s.phone && !ctx.phone) ctx.phone = s.phone;
  if (ctx.phone) {
    const conv = await getConversation(ctx.phone).catch(() => null);
    ctx.conv = conv ? { last_inbound_at: conv.last_inbound_at, order_id: conv.order_id } : null;
    if (conv?.name && !ctx.name) ctx.name = conv.name;
    // A chat linked to an order works with that order.
    if (!ctx.order && conv?.order_id) ctx.order = (await loadOrder(conv.order_id)) || undefined;
    if (!ctx.fromAd) ctx.fromAd = Boolean((await getConversationAds().catch(() => ({}) as Record<string, unknown>))[ctx.phone]);
  }
  return ctx;
}

const firstName = (n?: string) => (n || '').trim().split(/\s+/)[0] || '';

export function fill(text: string, ctx: Ctx): string {
  const o = ctx.order;
  const a = ctx.appt;
  const vals: Record<string, string> = {
    nombre: firstName(ctx.name),
    pedido: o?.orderNumber || '',
    producto: o ? [o.productName, o.comboName].filter(Boolean).join(' · ') : '',
    total: o ? formatMoney(Number(o.totalAmount) || 0, o.currency) : '',
    ciudad: o?.city || '',
    direccion: o?.address || '',
    guia: o?.trackingNumber || '',
    transportadora: o?.carrier || '',
    estado: statusLabel(a?.status || o?.status || ''),
    telefono: ctx.phone ? `+${ctx.phone}` : '',
    servicio: a?.serviceName || '',
    fecha_cita: a?.when || '',
    profesional: a?.staffName || '',
  };
  return text.replace(/\{([a-z_]+)\}/g, (m, k) => (k in vals ? vals[k] : m));
}

function conditionOk(c: FlowCondition, ctx: Ctx): boolean {
  const o = ctx.order;
  let actual: string | number | boolean;
  switch (c.field) {
    case 'status':
      actual = ctx.appt?.status || o?.status || '';
      break;
    case 'product':
      actual = o ? `${o.productName} ${o.comboName || ''}` : '';
      break;
    case 'total':
      actual = Number(o?.totalAmount) || 0;
      break;
    case 'city':
      actual = o?.city || '';
      break;
    case 'department':
      actual = o?.department || '';
      break;
    case 'service':
      actual = ctx.appt?.serviceName || '';
      break;
    case 'fromAd':
      actual = ctx.fromAd;
      break;
  }
  if (typeof actual === 'boolean') {
    const want = c.value === 'si' || c.value === 'true';
    return c.op === 'is_not' ? actual !== want : actual === want;
  }
  if (typeof actual === 'number') {
    const v = Number(String(c.value).replace(/[^\d.]/g, ''));
    if (c.op === 'gt') return actual > v;
    if (c.op === 'lt') return actual < v;
    return c.op === 'is_not' ? actual !== v : actual === v;
  }
  const a = words(actual).trim();
  const v = words(c.value).trim();
  if (c.op === 'contains') return a.includes(v);
  if (c.op === 'is_not') return a !== v;
  return a === v;
}

// ---------- actions ----------

async function doAction(a: FlowAction, ctx: Ctx, flow: Flow): Promise<{ ok: boolean; error?: string }> {
  const { sendTemplate, sendText } = await import('@/lib/server/whatsapp');
  const { recordOutbound } = await import('@/lib/server/wa-store');
  switch (a.type) {
    case 'send_template': {
      if (!ctx.phone) return { ok: false, error: 'No hay celular del cliente.' };
      const vars = a.vars.map((v) => fill(v, ctx));
      const result = await sendTemplate(ctx.phone, { name: a.template, lang: a.lang }, vars);
      await recordOutbound({ phone: ctx.phone, name: ctx.name, orderId: ctx.order?.id, type: 'template', body: `[${a.template}] ${vars.join(' · ')}`, result, auto: true }).catch(() => {});
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    case 'send_text': {
      if (!ctx.phone) return { ok: false, error: 'No hay celular del cliente.' };
      const last = ctx.conv?.last_inbound_at ? new Date(ctx.conv.last_inbound_at).getTime() : 0;
      if (Date.now() - last > 24 * 3600000) return { ok: false, error: 'El cliente no ha escrito en las últimas 24 h: WhatsApp solo deja mandar plantillas.' };
      const body = fill(a.text, ctx);
      const result = await sendText(ctx.phone, body);
      await recordOutbound({ phone: ctx.phone, name: ctx.name, orderId: ctx.order?.id, type: 'text', body, result, auto: true }).catch(() => {});
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    case 'ai_call': {
      if (!ctx.order) return { ok: false, error: 'Este chat no tiene un pedido.' };
      const { startOrderCall } = await import('@/lib/server/voice-actions');
      const r = await startOrderCall(ctx.order.id, { manual: true });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    case 'set_status': {
      if (!ctx.order) return { ok: false, error: 'Este chat no tiene un pedido.' };
      const { updateOrderStatus } = await import('@/lib/server/db');
      await updateOrderStatus(ctx.order.id, a.status);
      return { ok: true };
    }
    case 'tag_chat': {
      if (!ctx.phone) return { ok: false, error: 'No hay chat.' };
      const { getConversationTags, getTags, setConversationTags } = await import('@/lib/server/crm-store');
      if (!(await getTags()).some((t) => t.id === a.tagId)) return { ok: false, error: 'La etiqueta ya no existe.' };
      const cur = (await getConversationTags())[ctx.phone] || [];
      if (!cur.includes(a.tagId)) await setConversationTags(ctx.phone, [...cur, a.tagId]);
      return { ok: true };
    }
    case 'assign_chat': {
      if (!ctx.phone) return { ok: false, error: 'No hay chat.' };
      const { setAssignment } = await import('@/lib/server/crm-store');
      const r = await setAssignment(ctx.phone, a.agentId);
      return r ? { ok: true } : { ok: false, error: 'El asesor ya no existe.' };
    }
    case 'notify_team': {
      const org = requestOrgSync();
      if (!org) return { ok: false, error: 'Sin tienda.' };
      const { ownerEmails } = await import('@/lib/server/notify');
      const { emailLayout, esc, sendEmail } = await import('@/lib/server/email');
      const to = await ownerEmails(org);
      if (!to.length) return { ok: false, error: 'La tienda no tiene correo del dueño.' };
      const text = fill(a.text, ctx);
      const { html, text: plain } = emailLayout({ title: esc(flow.name), paragraphs: [esc(text)] });
      const r = await sendEmail({ to, subject: `Konnexa · ${flow.name}`, html, text: plain });
      return r.ok ? { ok: true } : { ok: false, error: r.skipped ? 'El envío de correos no está configurado.' : r.error };
    }
    case 'webhook': {
      const err = webhookUrlError(a.url);
      if (err) return { ok: false, error: err };
      const o = ctx.order;
      const ap = ctx.appt;
      const payload = {
        flow: flow.name,
        trigger: flow.trigger.type,
        at: new Date().toISOString(),
        customer: { name: ctx.name || null, phone: ctx.phone ? `+${ctx.phone}` : null, fromAd: ctx.fromAd },
        order: o
          ? {
              id: o.id,
              number: o.orderNumber,
              status: statusLabel(o.status),
              product: o.productName,
              combo: o.comboName,
              units: o.units,
              total: o.totalAmount,
              currency: o.currency,
              city: o.city,
              department: o.department,
              address: o.address,
              carrier: o.carrier || null,
              trackingNumber: o.trackingNumber || null,
              createdAt: o.createdAt,
              adId: o.adId || null,
            }
          : null,
        appointment: ap ? { id: ap.id, status: statusLabel(ap.status), service: ap.serviceName || null, staff: ap.staffName || null, start: ap.start, when: ap.when || null } : null,
      };
      try {
        const res = await fetch(a.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000), cache: 'no-store', redirect: 'manual' });
        return res.ok ? { ok: true } : { ok: false, error: `La otra app respondió ${res.status}` };
      } catch (e: any) {
        return { ok: false, error: e?.name === 'TimeoutError' ? 'La otra app no respondió a tiempo.' : e?.message || String(e) };
      }
    }
  }
}

const ACTION_NAME: Record<FlowAction['type'], string> = {
  send_template: 'Plantilla',
  send_text: 'Mensaje',
  ai_call: 'Llamada IA',
  set_status: 'Estado',
  tag_chat: 'Etiqueta',
  assign_chat: 'Asignar',
  notify_team: 'Correo al equipo',
  webhook: 'Webhook',
};

async function runFlow(flow: Flow, subject: FlowSubject): Promise<void> {
  const item: FlowLogItem = { at: new Date().toISOString(), flowId: flow.id, flowName: flow.name, subject: '', ok: true, steps: [] };
  try {
    const ctx = await buildCtx(subject);
    if (!ctx) {
      item.skipped = 'El pedido o la cita ya no existe.';
    } else {
      item.subject = ctx.order ? `Pedido ${ctx.order.orderNumber} · ${ctx.name || ''}` : ctx.appt ? `Cita · ${ctx.name || ''}` : `Chat +${ctx.phone} · ${ctx.name || ''}`;
      const failed = flow.conditions.find((c) => !conditionOk(c, ctx));
      if (failed) item.skipped = 'No cumplió las condiciones.';
      else
        await inFlow.run(true, async () => {
          for (const a of flow.actions) {
            const r = await doAction(a, ctx, flow).catch((e: any) => ({ ok: false, error: String(e?.message || e) }));
            item.steps.push({ action: ACTION_NAME[a.type], ok: r.ok, ...(r.ok ? {} : { error: String(r.error || 'falló').slice(0, 200) }) });
            if (!r.ok) item.ok = false;
          }
        });
    }
  } catch (e: any) {
    item.ok = false;
    item.steps.push({ action: 'Flujo', ok: false, error: String(e?.message || e).slice(0, 200) });
  }
  await record(flow, item).catch(() => {});
}

async function record(flow: Flow, item: FlowLogItem) {
  const [stats, log] = await Promise.all([getFlowStats(), getFlowLog()]);
  if (!item.skipped) {
    const s = stats[flow.id] || { runs: 0, failed: 0 };
    s.runs++;
    s.lastAt = item.at;
    if (!item.ok) {
      s.failed++;
      s.lastError = item.steps.find((x) => !x.ok)?.error;
    }
    stats[flow.id] = s;
    await writeSetting(STATS, stats);
  }
  await writeSetting(LOG, { items: [item, ...log].slice(0, 100) });
}

// ---------- scheduled (every 5 minutes) ----------

export async function processFlows(now = new Date(), deadline = Date.now() + 40000): Promise<{ ran: number; idle: number }> {
  const out = { ran: 0, idle: 0 };
  const flows = (await getFlows()).filter((f) => f.enabled);
  if (!flows.length) return out;

  // Chats that went quiet: we answered last and the customer hasn't written for the flow's hours.
  for (const f of flows) {
    if (f.trigger.type !== 'chat_idle') continue;
    const to = new Date(now.getTime() - f.trigger.hours * 3600000).toISOString();
    const from = new Date(now.getTime() - f.trigger.hours * 3600000 - IDLE_WINDOW_MS).toISOString();
    const { data } = await (await db())
      .from('wa_conversations')
      .select('id, name, last_message_at, last_inbound_at')
      .gte('last_inbound_at', from)
      .lte('last_inbound_at', to)
      .limit(200);
    const quiet = (data || []).filter((c: any) => c.last_message_at && c.last_inbound_at && c.last_message_at > c.last_inbound_at);
    if (!quiet.length) continue;
    const claimed = await claim(quiet.map((c: any) => ({ key: `${f.id}:i:${c.id}:${c.last_inbound_at}` })));
    const jobs: Job[] = [];
    for (const c of quiet as any[]) {
      if (!claimed.has(`${f.id}:i:${c.id}:${c.last_inbound_at}`)) continue;
      out.idle++;
      const subject = { phone: c.id, name: c.name || undefined };
      if (f.waitMinutes > 0) jobs.push({ id: randomUUID().slice(0, 12), flowId: f.id, dueAt: new Date(now.getTime() + f.waitMinutes * 60000).toISOString(), subject });
      else if (Date.now() < deadline) await runFlow(f, subject);
      else jobs.push({ id: randomUUID().slice(0, 12), flowId: f.id, dueAt: now.toISOString(), subject });
    }
    if (jobs.length) await writeSetting(JOBS, [...(await readJobs()), ...jobs].slice(-MAX_JOBS));
  }

  // Waits that ended. Take them off the list first, so an overlapping run never repeats them.
  const all = await readJobs();
  const due = all.filter((j) => j.dueAt <= now.toISOString()).slice(0, 50);
  if (!due.length) return out;
  const dueIds = new Set(due.map((j) => j.id));
  await writeSetting(JOBS, all.filter((j) => !dueIds.has(j.id)));
  const byId = new Map(flows.map((f) => [f.id, f]));
  const left: Job[] = [];
  for (const j of due) {
    const f = byId.get(j.flowId);
    if (!f) continue; // the flow was turned off or deleted
    if (Date.now() > deadline) {
      left.push(j);
      continue;
    }
    await runFlow(f, j.subject);
    out.ran++;
  }
  if (left.length) await writeSetting(JOBS, [...(await readJobs()), ...left].slice(-MAX_JOBS));
  return out;
}

// Stores with flows (the scheduled run also visits them, even without WhatsApp or calls connected).
export async function orgsWithFlows(): Promise<string[]> {
  const { rawDb } = await import('@/lib/server/supabase');
  const { data } = await rawDb().from('settings').select('org_id, data').eq('id', FLOWS);
  return (data || []).filter((r: any) => Array.isArray(r.data) && r.data.some((f: Flow) => f.enabled)).map((r: any) => r.org_id as string);
}

// Panel "Probar": runs a flow now with the store's latest order / appointment / chat (no wait, no conditions skipped).
export async function testFlow(flow: Flow): Promise<FlowLogItem> {
  let subject: FlowSubject | null = null;
  if (flow.trigger.type.startsWith('order')) {
    const { data } = await (await db()).from('orders').select('id').order('created_at', { ascending: false }).limit(1);
    if (data?.[0]) subject = { orderId: data[0].id as string };
  } else if (flow.trigger.type.startsWith('appointment')) {
    const { data } = await (await db()).from('appointments').select('id').order('created_at', { ascending: false }).limit(1);
    if (data?.[0]) subject = { apptId: data[0].id as string };
  } else {
    const { data } = await (await db()).from('wa_conversations').select('id, name').order('last_message_at', { ascending: false }).limit(1);
    if (data?.[0]) subject = { phone: data[0].id as string, name: (data[0].name as string) || undefined };
  }
  if (!subject) return { at: new Date().toISOString(), flowId: flow.id, flowName: flow.name, subject: '', ok: false, steps: [{ action: 'Prueba', ok: false, error: 'Todavía no hay un pedido, cita o chat para probarlo.' }] };
  await runFlow({ ...flow, name: `${flow.name} (prueba)` }, subject);
  return (await getFlowLog())[0];
}
