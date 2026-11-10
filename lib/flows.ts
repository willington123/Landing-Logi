// Custom flows: "when X happens → (if …) → (wait) → do Y". Shared by the panel and the server.
import type { OrderStatus } from '@/lib/types';
import type { AppointmentStatus } from '@/lib/agenda';

export type FlowTrigger =
  | { type: 'order_created' }
  | { type: 'order_status'; status: OrderStatus }
  | { type: 'message_keyword'; keywords: string[] }
  | { type: 'chat_idle'; hours: number }
  | { type: 'appointment_created' }
  | { type: 'appointment_status'; status: AppointmentStatus };

export type ConditionField = 'status' | 'product' | 'total' | 'city' | 'department' | 'fromAd' | 'service';
export type ConditionOp = 'is' | 'is_not' | 'gt' | 'lt' | 'contains';
export interface FlowCondition {
  field: ConditionField;
  op: ConditionOp;
  value: string;
}

export type FlowAction =
  | { type: 'send_template'; template: string; lang: string; vars: string[] }
  | { type: 'send_text'; text: string }
  | { type: 'ai_call' }
  | { type: 'set_status'; status: OrderStatus }
  | { type: 'tag_chat'; tagId: string }
  | { type: 'assign_chat'; agentId: string }
  | { type: 'notify_team'; text: string }
  | { type: 'webhook'; url: string };

export interface Flow {
  id: string;
  name: string;
  enabled: boolean;
  trigger: FlowTrigger;
  conditions: FlowCondition[];
  waitMinutes: number; // 0 = right away
  actions: FlowAction[];
  createdAt: string;
}

export interface FlowStats {
  runs: number;
  failed: number;
  lastAt?: string;
  lastError?: string;
}

export interface FlowLogItem {
  at: string;
  flowId: string;
  flowName: string;
  subject: string; // "Pedido LP-123 · Laura", "Chat +57300…"
  ok: boolean;
  skipped?: string; // the conditions didn't match, or nothing to do
  steps: { action: string; ok: boolean; error?: string }[];
}

export const ORDER_STATUS_OPTIONS: { id: OrderStatus; label: string }[] = [
  { id: 'pending_call', label: 'Pendiente' },
  { id: 'confirmed_by_voice', label: 'Confirmado' },
  { id: 'needs_review', label: 'Por revisar' },
  { id: 'unanswered', label: 'No contesta' },
  { id: 'shipped', label: 'Enviado' },
  { id: 'delivered', label: 'Entregado' },
  { id: 'returned', label: 'Devuelto' },
  { id: 'cancelled', label: 'Cancelado' },
];
export const APPT_STATUS_OPTIONS: { id: AppointmentStatus; label: string }[] = [
  { id: 'confirmed', label: 'Confirmada' },
  { id: 'cancelled', label: 'Cancelada' },
  { id: 'completed', label: 'Asistió' },
  { id: 'no_show', label: 'No llegó' },
];
export const statusLabel = (s: string) =>
  ORDER_STATUS_OPTIONS.find((o) => o.id === s)?.label || APPT_STATUS_OPTIONS.find((o) => o.id === s)?.label || ({ pending: 'Pendiente', calling: 'Llamando', retry_scheduled: 'Reintento programado' } as Record<string, string>)[s] || s;

export const TRIGGERS: { type: FlowTrigger['type']; label: string; business: 'orders' | 'appointments' | 'both' }[] = [
  { type: 'order_created', label: 'Entra un pedido', business: 'orders' },
  { type: 'order_status', label: 'Un pedido cambia de estado', business: 'orders' },
  { type: 'appointment_created', label: 'Se agenda una cita', business: 'appointments' },
  { type: 'appointment_status', label: 'Una cita cambia de estado', business: 'appointments' },
  { type: 'message_keyword', label: 'Un cliente escribe una palabra clave', business: 'both' },
  { type: 'chat_idle', label: 'Un cliente lleva horas sin responder', business: 'both' },
];

export const ACTIONS: { type: FlowAction['type']; label: string; needsOrder?: boolean; needsChat?: boolean }[] = [
  { type: 'send_template', label: 'Mandar una plantilla de WhatsApp' },
  { type: 'send_text', label: 'Mandar un mensaje de texto (si escribió en las últimas 24 h)' },
  { type: 'ai_call', label: 'Llamar con la IA', needsOrder: true },
  { type: 'set_status', label: 'Cambiar el estado del pedido', needsOrder: true },
  { type: 'tag_chat', label: 'Poner una etiqueta al chat' },
  { type: 'assign_chat', label: 'Asignar el chat a un asesor' },
  { type: 'notify_team', label: 'Avisarle al equipo por correo' },
  { type: 'webhook', label: 'Enviar los datos a otra app (Make, Zapier, n8n…)' },
];

export const CONDITION_FIELDS: { id: ConditionField; label: string; kind: 'text' | 'number' | 'status' | 'bool'; business: 'orders' | 'appointments' | 'both' }[] = [
  { id: 'status', label: 'Estado actual', kind: 'status', business: 'both' },
  { id: 'product', label: 'Producto', kind: 'text', business: 'orders' },
  { id: 'total', label: 'Valor del pedido', kind: 'number', business: 'orders' },
  { id: 'city', label: 'Ciudad', kind: 'text', business: 'orders' },
  { id: 'department', label: 'Departamento', kind: 'text', business: 'orders' },
  { id: 'service', label: 'Servicio', kind: 'text', business: 'appointments' },
  { id: 'fromAd', label: 'Llegó desde un anuncio', kind: 'bool', business: 'both' },
];

// Words the store can put in messages, template variables and emails.
export const VARIABLES: { token: string; label: string }[] = [
  { token: '{nombre}', label: 'Nombre del cliente' },
  { token: '{pedido}', label: 'Número de pedido' },
  { token: '{producto}', label: 'Producto' },
  { token: '{total}', label: 'Total' },
  { token: '{ciudad}', label: 'Ciudad' },
  { token: '{direccion}', label: 'Dirección' },
  { token: '{guia}', label: 'Número de guía' },
  { token: '{transportadora}', label: 'Transportadora' },
  { token: '{estado}', label: 'Estado' },
  { token: '{telefono}', label: 'Celular' },
  { token: '{servicio}', label: 'Servicio de la cita' },
  { token: '{fecha_cita}', label: 'Fecha y hora de la cita' },
  { token: '{profesional}', label: 'Profesional' },
];

export const WAIT_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 0, label: 'De inmediato' },
  { minutes: 30, label: '30 minutos' },
  { minutes: 60, label: '1 hora' },
  { minutes: 120, label: '2 horas' },
  { minutes: 360, label: '6 horas' },
  { minutes: 1440, label: '1 día' },
  { minutes: 2880, label: '2 días' },
  { minutes: 4320, label: '3 días' },
  { minutes: 7200, label: '5 días' },
  { minutes: 10080, label: '7 días' },
  { minutes: 20160, label: '14 días' },
  { minutes: 43200, label: '30 días' },
];
export const IDLE_HOURS = [1, 2, 3, 6, 12, 20];
export const MAX_FLOWS = 30;

const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const isOrderStatus = (s: unknown): s is OrderStatus => ORDER_STATUS_OPTIONS.some((o) => o.id === s) || s === 'calling' || s === 'retry_scheduled';
const isApptStatus = (s: unknown): s is AppointmentStatus => APPT_STATUS_OPTIONS.some((o) => o.id === s);

// Webhooks only go to public https addresses (never to the server's own network).
export function webhookUrlError(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return 'La dirección del webhook no es válida.';
  }
  if (u.protocol !== 'https:') return 'El webhook debe empezar por https://';
  const h = u.hostname.toLowerCase();
  if (
    h === 'localhost' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) ||
    h.startsWith('[') ||
    !h.includes('.')
  )
    return 'El webhook debe ser una dirección pública de internet.';
  return null;
}

function cleanTrigger(t: any): FlowTrigger | string {
  switch (t?.type) {
    case 'order_created':
    case 'appointment_created':
      return { type: t.type };
    case 'order_status':
      return isOrderStatus(t.status) ? { type: 'order_status', status: t.status } : 'Elige a qué estado cambia el pedido.';
    case 'appointment_status':
      return isApptStatus(t.status) ? { type: 'appointment_status', status: t.status } : 'Elige a qué estado cambia la cita.';
    case 'message_keyword': {
      const keywords = (Array.isArray(t.keywords) ? t.keywords : String(t.keywords || '').split(','))
        .map((k: unknown) => str(k, 40).toLowerCase())
        .filter(Boolean)
        .slice(0, 20);
      return keywords.length ? { type: 'message_keyword', keywords } : 'Escribe al menos una palabra clave.';
    }
    case 'chat_idle': {
      const hours = Number(t.hours);
      return { type: 'chat_idle', hours: IDLE_HOURS.includes(hours) ? hours : 3 };
    }
    default:
      return 'Elige cuándo se activa el flujo.';
  }
}

function cleanAction(a: any): FlowAction | string {
  switch (a?.type) {
    case 'send_template': {
      const template = str(a.template, 120).replace(/[^a-z0-9_]/g, '');
      if (!template) return 'Elige la plantilla de WhatsApp.';
      const vars = (Array.isArray(a.vars) ? a.vars : []).slice(0, 10).map((v: unknown) => str(v, 300));
      const empty = vars.findIndex((v: string) => !v);
      if (empty >= 0) return `Completa la variable {{${empty + 1}}} de la plantilla.`;
      return { type: 'send_template', template, lang: str(a.lang, 12) || 'es', vars };
    }
    case 'send_text': {
      const text = str(a.text, 2000);
      return text ? { type: 'send_text', text } : 'Escribe el mensaje.';
    }
    case 'ai_call':
      return { type: 'ai_call' };
    case 'set_status':
      return isOrderStatus(a.status) ? { type: 'set_status', status: a.status } : 'Elige el nuevo estado del pedido.';
    case 'tag_chat':
      return str(a.tagId, 60) ? { type: 'tag_chat', tagId: str(a.tagId, 60) } : 'Elige la etiqueta.';
    case 'assign_chat':
      return str(a.agentId, 60) ? { type: 'assign_chat', agentId: str(a.agentId, 60) } : 'Elige el asesor.';
    case 'notify_team': {
      const text = str(a.text, 2000);
      return text ? { type: 'notify_team', text } : 'Escribe el aviso para el equipo.';
    }
    case 'webhook': {
      const url = str(a.url, 500);
      const err = webhookUrlError(url);
      return err || { type: 'webhook', url };
    }
    default:
      return 'Acción desconocida.';
  }
}

export function cleanFlow(input: any): Flow | string {
  const name = str(input?.name, 80);
  if (!name) return 'Ponle un nombre al flujo.';
  const trigger = cleanTrigger(input?.trigger);
  if (typeof trigger === 'string') return `${name}: ${trigger}`;
  const conditions: FlowCondition[] = [];
  for (const c of Array.isArray(input?.conditions) ? input.conditions.slice(0, 5) : []) {
    if (!CONDITION_FIELDS.some((f) => f.id === c?.field)) continue;
    const op: ConditionOp = ['is', 'is_not', 'gt', 'lt', 'contains'].includes(c?.op) ? c.op : 'is';
    const value = str(c?.value, 120);
    if (!value) return `${name}: completa el valor de la condición.`;
    conditions.push({ field: c.field, op, value });
  }
  const actions: FlowAction[] = [];
  for (const a of Array.isArray(input?.actions) ? input.actions.slice(0, 5) : []) {
    const clean = cleanAction(a);
    if (typeof clean === 'string') return `${name}: ${clean}`;
    actions.push(clean);
  }
  if (!actions.length) return `${name}: agrega al menos una acción.`;
  // Calls and order status need an order (chats use the order linked to them, if any).
  if (trigger.type.startsWith('appointment') && actions.some((a) => a.type === 'ai_call' || a.type === 'set_status'))
    return `${name}: llamar con IA y cambiar el estado del pedido solo sirven para pedidos.`;
  const wait = Number(input?.waitMinutes);
  return {
    id: str(input?.id, 60) || `flow_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    enabled: input?.enabled !== false,
    trigger,
    conditions,
    waitMinutes: WAIT_OPTIONS.some((w) => w.minutes === wait) ? wait : 0,
    actions,
    createdAt: str(input?.createdAt, 40) || new Date().toISOString(),
  };
}

export function cleanFlows(input: unknown): Flow[] | string {
  if (!Array.isArray(input)) return 'Lista de flujos inválida.';
  if (input.length > MAX_FLOWS) return `Máximo ${MAX_FLOWS} flujos por tienda.`;
  const out: Flow[] = [];
  for (const f of input) {
    const c = cleanFlow(f);
    if (typeof c === 'string') return c;
    if (out.some((x) => x.id === c.id)) c.id = `${c.id}_${out.length}`;
    out.push(c);
  }
  return out;
}

// Ready-made flows the store can add with one click (then pick the template / tag / agent).
export interface FlowRecipe {
  id: string;
  business: 'orders' | 'appointments';
  title: string;
  hint: string;
  flow: Omit<Flow, 'id' | 'createdAt' | 'enabled'>;
}
export const RECIPES: FlowRecipe[] = [
  {
    id: 'shipped',
    business: 'orders',
    title: 'Aviso de envío con la guía',
    hint: 'Cuando marcas un pedido como enviado, le llega al cliente su número de guía.',
    flow: { name: 'Aviso de envío', trigger: { type: 'order_status', status: 'shipped' }, conditions: [], waitMinutes: 0, actions: [{ type: 'send_template', template: '', lang: 'es', vars: ['{nombre}', '{guia}', '{transportadora}'] }] },
  },
  {
    id: 'review',
    business: 'orders',
    title: 'Reseña o recompra',
    hint: '5 días después de entregado, le pide su opinión u ofrece volver a comprar.',
    flow: { name: 'Reseña después de la entrega', trigger: { type: 'order_status', status: 'delivered' }, conditions: [], waitMinutes: 7200, actions: [{ type: 'send_template', template: '', lang: 'es', vars: ['{nombre}', '{producto}'] }] },
  },
  {
    id: 'vip',
    business: 'orders',
    title: 'Pedidos grandes a un asesor',
    hint: 'Los pedidos de más de $300.000 se asignan a una persona y se etiquetan.',
    flow: { name: 'Pedidos grandes', trigger: { type: 'order_created' }, conditions: [{ field: 'total', op: 'gt', value: '300000' }], waitMinutes: 0, actions: [{ type: 'assign_chat', agentId: '' }, { type: 'tag_chat', tagId: '' }] },
  },
  {
    id: 'stuck',
    business: 'orders',
    title: 'Pedido sin confirmar en 2 horas',
    hint: 'Si a las 2 horas sigue pendiente, te avisa por correo para llamarlo.',
    flow: {
      name: 'Pedido sin confirmar',
      trigger: { type: 'order_created' },
      conditions: [{ field: 'status', op: 'is', value: 'pending_call' }],
      waitMinutes: 120,
      actions: [{ type: 'notify_team', text: 'El pedido {pedido} de {nombre} ({telefono}) lleva 2 horas sin confirmar. Total {total}, {ciudad}.' }],
    },
  },
  {
    id: 'returned',
    business: 'orders',
    title: 'Pedido cancelado: avisar al equipo',
    hint: 'Cada cancelación llega a tu correo con los datos del cliente.',
    flow: { name: 'Aviso de cancelación', trigger: { type: 'order_status', status: 'cancelled' }, conditions: [], waitMinutes: 0, actions: [{ type: 'notify_team', text: 'Se canceló el pedido {pedido} de {nombre} ({telefono}): {producto}, {total}.' }] },
  },
  {
    id: 'sheet',
    business: 'orders',
    title: 'Copiar pedidos a otra app',
    hint: 'Manda cada pedido a Make, Zapier o n8n (por ejemplo, a un Google Sheet).',
    flow: { name: 'Pedidos a Google Sheets', trigger: { type: 'order_created' }, conditions: [], waitMinutes: 0, actions: [{ type: 'webhook', url: '' }] },
  },
  {
    id: 'appt_noshow',
    business: 'appointments',
    title: 'No llegó: invitar a reagendar',
    hint: 'Si el cliente no llegó, al día siguiente le escribe para darle otra cita.',
    flow: { name: 'Reagendar a quien no llegó', trigger: { type: 'appointment_status', status: 'no_show' }, conditions: [], waitMinutes: 1440, actions: [{ type: 'send_template', template: '', lang: 'es', vars: ['{nombre}', '{servicio}'] }] },
  },
  {
    id: 'appt_cancel',
    business: 'appointments',
    title: 'Cita cancelada: avisar al equipo',
    hint: 'Para que puedas llenar ese espacio con otro cliente.',
    flow: { name: 'Aviso de cita cancelada', trigger: { type: 'appointment_status', status: 'cancelled' }, conditions: [], waitMinutes: 0, actions: [{ type: 'notify_team', text: 'Se canceló la cita de {nombre} ({telefono}): {servicio}, {fecha_cita} con {profesional}.' }] },
  },
  {
    id: 'appt_thanks',
    business: 'appointments',
    title: 'Gracias por venir',
    hint: 'Cuando marcas "Asistió", 2 horas después le agradece y pide una reseña.',
    flow: { name: 'Gracias por venir', trigger: { type: 'appointment_status', status: 'completed' }, conditions: [], waitMinutes: 120, actions: [{ type: 'send_template', template: '', lang: 'es', vars: ['{nombre}'] }] },
  },
  {
    id: 'appt_sheet',
    business: 'appointments',
    title: 'Copiar citas a otra app',
    hint: 'Manda cada cita nueva a Make, Zapier o n8n.',
    flow: { name: 'Citas a otra app', trigger: { type: 'appointment_created' }, conditions: [], waitMinutes: 0, actions: [{ type: 'webhook', url: '' }] },
  },
];
