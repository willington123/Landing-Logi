// WhatsApp AI assistant built on Claude: answers customers with the store's information,
// looks up their orders and hands the chat to a person when needed.
import Anthropic from '@anthropic-ai/sdk';
import { db, getSettings } from '@/lib/server/db';
import { listMessages, samePhone, type WaMessage } from '@/lib/server/wa-store';
import { DEFAULT_BOT, type BotChatState, type BotSettings } from '@/lib/bot';
import type { LandingPageConfig, OrderItem, OrderStatus } from '@/lib/types';

// Claude Opus 5.5 by default; ANTHROPIC_MODEL can name another model.
const MODEL = (process.env.ANTHROPIC_MODEL || '').trim() || 'claude-opus-5-5';
const HISTORY = 30; // messages of the chat sent to the model
const MAX_STEPS = 4; // model calls per customer message (tool use included)

export const botConfigured = () => Boolean((process.env.ANTHROPIC_API_KEY || '').trim());

let client: Anthropic | null = null;
// The key set in Vercel for this app (explicit, so no other credential on the machine is picked up).
const anthropic = () => (client ||= new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY || '').trim(), maxRetries: 2, timeout: 45_000 }));

// ---------- settings and per-chat state (Supabase "settings" table) ----------

async function readSetting<T>(id: string): Promise<T | null> {
  const { data, error } = await db().from('settings').select('data').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as T) ?? null;
}
async function writeSetting(id: string, data: unknown) {
  const { error } = await db().from('settings').upsert({ id, data });
  if (error) throw new Error(error.message);
}

export async function getBotSettings(): Promise<BotSettings> {
  return { ...DEFAULT_BOT, ...((await readSetting<Partial<BotSettings>>('wa_bot')) || {}) };
}
export const saveBotSettings = (s: BotSettings) => writeSetting('wa_bot', s);

export async function getBotStates(): Promise<Record<string, BotChatState>> {
  return (await readSetting<Record<string, BotChatState>>('wa_bot_state')) || {};
}
export async function getBotState(conversationId: string): Promise<BotChatState> {
  return (await getBotStates())[conversationId] || {};
}
export async function setBotState(conversationId: string, patch: Partial<BotChatState> | null) {
  const all = await getBotStates();
  if (patch === null) delete all[conversationId];
  else all[conversationId] = { ...(all[conversationId] || {}), ...patch };
  await writeSetting('wa_bot_state', all);
  return all[conversationId] || {};
}

// ---------- what the assistant knows ----------

const STATUS_TEXT: Record<OrderStatus, string> = {
  pending_call: 'recibido, pendiente de confirmar',
  calling: 'recibido, pendiente de confirmar',
  retry_scheduled: 'recibido, pendiente de confirmar',
  needs_review: 'recibido, en revisión por el equipo',
  unanswered: 'recibido, pendiente de confirmar (no pudimos comunicarnos)',
  confirmed_by_voice: 'confirmado, preparando el despacho',
  shipped: 'despachado, en camino',
  delivered: 'entregado',
  cancelled: 'cancelado',
};

const money = (v: number, currency = 'COP') => `$${Math.round(v || 0).toLocaleString('es-CO')} ${currency}`;

function landingText(l: LandingPageConfig): string {
  const cur = l.currency || 'COP';
  const lines = [`## ${l.productName}`];
  if (l.headline) lines.push(l.headline);
  if (l.subheadline) lines.push(l.subheadline);
  const combos = (l.combos || []).filter((c) => c.promoPrice > 0);
  if (combos.length) {
    lines.push('Ofertas (precio final, pago contraentrega):');
    for (const c of combos) lines.push(`- ${c.name} (${c.units} ${c.units === 1 ? 'unidad' : 'unidades'}): ${money(c.promoPrice, cur)}${c.regularPrice > c.promoPrice ? ` (antes ${money(c.regularPrice, cur)})` : ''}`);
  } else if (l.promoPrice) lines.push(`Precio: ${money(l.promoPrice, cur)}`);
  const benefits = (l.benefits || []).filter((b) => b.title);
  if (benefits.length) lines.push('Beneficios:', ...benefits.map((b) => `- ${b.title}${b.description ? `: ${b.description}` : ''}`));
  const features = (l.features || []).filter((f) => f.title);
  if (features.length) lines.push('Características:', ...features.map((f) => `- ${f.title}${f.description ? `: ${f.description}` : ''}`));
  if (l.shippingCostText) lines.push(`Envío: ${l.shippingCostText}`);
  if (l.guaranteeText || l.guaranteeDays) lines.push(`Garantía: ${l.guaranteeText || ''}${l.guaranteeDays ? ` (${l.guaranteeDays} días)` : ''}`.trim());
  const faqs = (l.faqs || []).filter((f) => f.question && f.answer);
  if (faqs.length) lines.push('Preguntas frecuentes:', ...faqs.map((f) => `- ${f.question} → ${f.answer}`));
  return lines.join('\n');
}

async function storeKnowledge(): Promise<{ storeName: string; products: string }> {
  const [{ data }, settings] = await Promise.all([
    db().from('landings').select('data, published').order('updated_at', { ascending: false }).limit(20),
    getSettings<{ storeName?: string }>().catch(() => null),
  ]);
  const landings = (data || []).filter((r: any) => r.published !== false).map((r: any) => r.data as LandingPageConfig);
  return {
    storeName: settings?.storeName?.trim() || 'nuestra tienda',
    products: landings.length ? landings.map(landingText).join('\n\n') : '(No hay productos publicados todavía.)',
  };
}

function systemPrompt(s: BotSettings, k: { storeName: string; products: string }): string {
  return `Eres ${s.name}, asesora de servicio al cliente de ${k.storeName}, una tienda en línea que vende con pago contraentrega. Atiendes a los clientes por WhatsApp.

Cómo escribes:
- En español, ${s.formal ? 'tratando al cliente de usted' : 'tuteando al cliente'}, con calidez y de forma breve: mensajes cortos como en WhatsApp (1 a 4 frases), sin listas largas ni formato de documento. Puedes usar algún emoji con moderación.
- Una sola respuesta por mensaje del cliente. Si el cliente mandó varios mensajes seguidos, respóndelos juntos.

Qué puedes hacer:
- Resolver dudas sobre los productos, precios, ofertas, envío, pago y garantía usando solo la información de abajo.
- Consultar los pedidos de este cliente con la herramienta consultar_pedidos (solo ve los pedidos hechos con su número de WhatsApp) y decirle en qué estado van, y el número de guía si ya fue despachado.
- Si el cliente quiere comprar, invítalo a hacer el pedido desde la página del producto (ahí elige la oferta y deja sus datos).

Reglas importantes:
- Nunca inventes precios, ofertas, tiempos, políticas ni datos de pedidos. Si algo no está en la información de abajo o en lo que devuelven las herramientas, dile que lo vas a consultar con el equipo y usa pasar_a_humano.
- Usa pasar_a_humano cuando: el cliente pida hablar con una persona; tenga un reclamo, esté molesto o el producto llegó mal; quiera cancelar, cambiar la dirección o modificar un pedido; pida algo que no puedes resolver; o hable de pagos por adelantado, devoluciones de dinero o temas legales. Después de usarla, despídete diciendo que una persona del equipo le escribirá pronto por este mismo chat.
- No pidas datos sensibles (cédula, tarjetas, contraseñas). No compartas datos de otros clientes.
- Si escriben algo que no tiene que ver con la tienda, responde con amabilidad y vuelve al tema.
- No menciones que eres una inteligencia artificial salvo que te lo pregunten; si te lo preguntan, dilo con naturalidad.

# Información del negocio (escrita por la tienda)
${s.businessInfo || '(Sin información adicional.)'}

# Productos
${k.products}`;
}

// ---------- tools ----------

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'consultar_pedidos',
    description:
      'Devuelve los pedidos que este cliente ha hecho con su número de WhatsApp (los más recientes primero): número, fecha, producto, total, estado, ciudad y, si ya se despachó, transportadora y número de guía. No necesita datos: el número del cliente ya se conoce.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  {
    name: 'pasar_a_humano',
    description:
      'Pasa la conversación a una persona del equipo y deja de responder en este chat. Úsala para reclamos, clientes molestos, cancelaciones, cambios de dirección o del pedido, solicitudes de hablar con una persona, o cualquier cosa que no puedas resolver con la información disponible.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: { type: 'string', description: 'Resumen corto para el equipo: qué necesita el cliente.' },
        tipo: { type: 'string', enum: ['reclamo', 'cambio_pedido', 'cancelacion', 'pide_persona', 'otro'] },
      },
      required: ['motivo', 'tipo'],
      additionalProperties: false,
    },
    strict: true,
  },
];

async function ordersFor(phone: string) {
  const { data, error } = await db().from('orders').select('data, status').order('created_at', { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return (data || [])
    .map((r) => ({ ...(r.data as OrderItem), status: r.status as OrderStatus }))
    .filter((o) => samePhone(o, phone))
    .slice(0, 10)
    .map((o) => ({
      pedido: o.orderNumber,
      fecha: new Date(o.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }),
      producto: `${o.productName} - ${o.comboName}`,
      total: money(o.totalAmount),
      estado: STATUS_TEXT[o.status] || o.status,
      ciudad: o.city,
      ...(o.carrier ? { transportadora: o.carrier } : {}),
      ...(o.trackingNumber ? { guia: o.trackingNumber } : {}),
    }));
}

// ---------- the conversation ----------

const MEDIA: Record<string, string> = { image: 'una foto', audio: 'una nota de voz', video: 'un video', document: 'un documento', sticker: 'un sticker' };

function asText(m: WaMessage): string {
  if (m.media) return `[El cliente envió ${MEDIA[m.media.kind] || 'un archivo'}${m.media.caption ? ` con el texto: "${m.media.caption}"` : ''}. No puedes verlo.]`;
  if (m.type === 'template') return `[Plantilla enviada por la tienda] ${m.body}`;
  return m.body;
}

// Chat history → Claude messages (customer = user, store/bot/team = assistant). Starts with the customer.
export function toMessages(history: { direction: 'in' | 'out'; text: string }[]): Anthropic.Beta.BetaMessageParam[] {
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (const h of history) {
    const role = h.direction === 'in' ? 'user' : 'assistant';
    const text = h.text.trim();
    if (!text) continue;
    if (!out.length && role === 'assistant') continue;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content = `${last.content as string}\n${text}`;
    else out.push({ role, content: text });
  }
  // The last turn must be the customer's.
  while (out.length && out[out.length - 1].role === 'assistant') out.pop();
  return out;
}

export interface BotRun {
  reply: string | null;
  handoff: { motivo: string; tipo: string } | null;
  toolCalls: { name: string; input: unknown; result: unknown }[];
  refused?: boolean;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

// Runs the assistant on a conversation. Doesn't send anything: the caller decides.
export async function runBot(opts: {
  settings: BotSettings;
  phone: string; // customer's WhatsApp (digits) for the order lookup
  customerName?: string | null;
  history: { direction: 'in' | 'out'; text: string }[];
}): Promise<BotRun> {
  const knowledge = await storeKnowledge();
  const messages = toMessages(opts.history);
  const run: BotRun = { reply: null, handoff: null, toolCalls: [], usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
  if (!messages.length) return run;

  const now = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    // Stable part first so it is cached between messages.
    { type: 'text', text: systemPrompt(opts.settings, knowledge), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: `Datos de esta conversación: cliente "${opts.customerName || 'sin nombre'}", WhatsApp +${opts.phone}. Fecha y hora en Colombia: ${now}.` },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: 'low' }, // short chat replies
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // if the model declines, Anthropic retries on its recommended fallback model
      system,
      tools: TOOLS,
      messages,
    });
    run.usage.input += response.usage.input_tokens || 0;
    run.usage.output += response.usage.output_tokens || 0;
    run.usage.cacheRead += response.usage.cache_read_input_tokens || 0;
    run.usage.cacheWrite += response.usage.cache_creation_input_tokens || 0;

    if (response.stop_reason === 'refusal') {
      run.refused = true;
      run.handoff = run.handoff || { motivo: 'El asistente no pudo responder este mensaje.', tipo: 'otro' };
      return run;
    }

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');

    if (response.stop_reason !== 'tool_use' || !toolUses.length) {
      run.reply = text || null;
      return run;
    }

    // Keep the full assistant turn (thinking blocks included) and answer every tool call in one message.
    messages.push({ role: 'assistant', content: response.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const t of toolUses) {
      let result: unknown;
      let isError = false;
      try {
        if (t.name === 'consultar_pedidos') {
          const orders = await ordersFor(opts.phone);
          result = orders.length ? { pedidos: orders } : { pedidos: [], nota: 'No hay pedidos con este número de WhatsApp. Puede que el cliente haya usado otro número en el formulario: pídele el número del pedido (empieza por LP-) o pásalo a una persona.' };
        } else if (t.name === 'pasar_a_humano') {
          const input = (t.input || {}) as { motivo?: string; tipo?: string };
          run.handoff = { motivo: String(input.motivo || '').slice(0, 300) || 'Sin detalle', tipo: String(input.tipo || 'otro') };
          result = { ok: true, nota: 'Listo. Despídete diciendo que una persona del equipo le escribirá pronto por este chat.' };
        } else {
          isError = true;
          result = { error: `Herramienta desconocida: ${t.name}` };
        }
      } catch (e: any) {
        isError = true;
        result = { error: e?.message || String(e) };
      }
      run.toolCalls.push({ name: t.name, input: t.input, result });
      results.push({ type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(result), ...(isError ? { is_error: true } : {}) });
    }
    messages.push({ role: 'user', content: results });
  }
  // Too many steps: hand over rather than leave the customer without an answer.
  run.handoff = run.handoff || { motivo: 'El asistente no logró terminar la respuesta.', tipo: 'otro' };
  return run;
}

// History of a stored conversation for runBot.
export async function chatHistory(conversationId: string) {
  const msgs = await listMessages(conversationId, HISTORY);
  return msgs.map((m) => ({ direction: m.direction, text: asText(m) }));
}
