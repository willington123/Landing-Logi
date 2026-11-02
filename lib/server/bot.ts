// WhatsApp AI assistant built on Claude: answers customers with the store's information,
// looks up their orders and hands the chat to a person when needed.
import { reportSale } from '@/lib/server/conversions';
import Anthropic from '@anthropic-ai/sdk';
import { createOrder, db, getSettings } from '@/lib/server/db';
import { linkConversationOrder, listMessages, samePhone, type WaMessage } from '@/lib/server/wa-store';
import { publicBaseUrl } from '@/lib/server/vapi';
import { anthropicKey } from '@/lib/server/integrations';
import { addAiReply } from '@/lib/server/billing';
import { requestOrgSync } from '@/lib/server/tenant';
import { STREET_TYPES, localPhoneDigits, validateName, validatePhone } from '@/lib/order-form';
import { DEFAULT_BOT, cleanFollowUp, type BotChatState, type BotSettings } from '@/lib/bot';
import type { LandingPageConfig, OrderItem, OrderStatus } from '@/lib/types';
import { getAgenda } from '@/lib/server/agenda';
import { AGENDA_TOOLS, AGENDA_TOOL_NAMES, agendaPrompt, runAgendaTool } from '@/lib/server/bot-agenda';

// Claude Opus 5.5 by default; ANTHROPIC_MODEL can name another model.
const MODEL = (process.env.ANTHROPIC_MODEL || '').trim() || 'claude-opus-5-5';
const HISTORY = 30; // messages of the chat sent to the model
const MAX_STEPS = 4; // model calls per customer message (tool use included)

export const botConfigured = async () => Boolean(await anthropicKey());

// One client per API key (each store can use its own key).
const clients = new Map<string, Anthropic>();
async function anthropic(): Promise<{ client: Anthropic; source: 'env' | 'store' | 'plan' }> {
  const k = await anthropicKey();
  if (!k) throw new Error('Falta la clave de Claude (Anthropic) de esta tienda, o se acabaron las respuestas incluidas en el plan este mes.');
  let c = clients.get(k.key);
  if (!c) {
    c = new Anthropic({ apiKey: k.key, maxRetries: 2, timeout: 45_000 });
    clients.set(k.key, c);
  }
  return { client: c, source: k.source };
}

// ---------- settings and per-chat state (Supabase "settings" table) ----------

async function readSetting<T>(id: string): Promise<T | null> {
  const { data, error } = await (await db()).from('settings').select('data').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as T) ?? null;
}
async function writeSetting(id: string, data: unknown) {
  const { error } = await (await db()).from('settings').upsert({ id, data });
  if (error) throw new Error(error.message);
}

export async function getBotSettings(): Promise<BotSettings> {
  const s = (await readSetting<Partial<BotSettings>>('wa_bot')) || {};
  return { ...DEFAULT_BOT, ...s, followUp: cleanFollowUp(s.followUp) };
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

function landingText(l: LandingPageConfig, base: string): string {
  const cur = l.currency || 'COP';
  const lines = [`## ${l.productName}`, `(landing_id para crear_pedido: ${l.id}; país: ${l.country || 'Colombia'}${base ? `; página con fotos: ${base}/p/${l.slug}` : ''})`];
  if (l.headline) lines.push(l.headline);
  if (l.subheadline) lines.push(l.subheadline);
  const combos = (l.combos || []).filter((c) => c.promoPrice > 0);
  if (combos.length) {
    lines.push('Ofertas (precio final, pago contraentrega):');
    const recommended = combos.find((c) => c.isDefault) || combos.find((c) => c.isPopular);
    for (const c of combos)
      lines.push(
        `- ${c.name} (${c.units} ${c.units === 1 ? 'unidad' : 'unidades'}): ${money(c.promoPrice, cur)}${c.regularPrice > c.promoPrice ? ` (antes ${money(c.regularPrice, cur)})` : ''}${c.savingsText ? ` - ${c.savingsText}` : ''}${c === recommended ? ' ← la más elegida' : ''}`,
      );
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

async function storeKnowledge(): Promise<{ storeName: string; products: string; landings: LandingPageConfig[] }> {
  const [{ data }, settings] = await Promise.all([
    (await db()).from('landings').select('data, published').order('updated_at', { ascending: false }).limit(20),
    getSettings<{ storeName?: string }>().catch(() => null),
  ]);
  const landings = (data || []).filter((r: any) => r.published !== false).map((r: any) => r.data as LandingPageConfig);
  const base = publicBaseUrl();
  return {
    storeName: settings?.storeName?.trim() || 'nuestra tienda',
    products: landings.length ? landings.map((l) => landingText(l, base)).join('\n\n') : '(No hay productos publicados todavía.)',
    landings,
  };
}

function systemPrompt(s: BotSettings, k: { storeName: string; products: string }): string {
  const sell = s.takeOrders
    ? `Tu objetivo principal es vender: llevar cada conversación hasta un pedido confirmado aquí mismo en el chat, sin mandar al cliente a otra página.

Cómo cierras la venta:
1. Entiende qué busca y resuelve sus dudas en pocas palabras, conectando los beneficios del producto con lo que te dice.
2. Recomienda una oferta concreta (normalmente la marcada como "la más elegida", o la que mejor le sirve) con su precio final. Si es natural, menciona una sola vez el ahorro de llevar más unidades.
3. Resuelve objeciones con hechos reales: pago contraentrega (paga al recibir, sin riesgo), envío, garantía.
4. En cuanto muestre interés ("me interesa", "lo quiero", "cómo compro", pregunta por envío a su ciudad…), pide los datos del envío en un solo mensaje corto: nombre y apellido; celular (puede ser este mismo WhatsApp); departamento y ciudad; dirección completa con tipo de vía (calle, carrera, avenida, transversal, diagonal…), números y barrio, y si aplica apartamento o casa. Luego pide solo lo que falte o esté incompleto.
5. Con todo listo, muéstrale un resumen corto (producto y oferta, total a pagar al recibir, nombre, ciudad y dirección) y pregúntale si confirmas el pedido.
6. Solo cuando diga que sí, usa crear_pedido con cliente_confirmo = true. Si la herramienta devuelve un error de datos, pídele al cliente exactamente lo que falta.
7. Cuando el pedido quede creado, dale el número de pedido, cuándo le llega y recuérdale tener el dinero listo para pagar al recibir. Agradécele.
- Si el cliente quiere ver fotos o más detalles, puedes compartir el enlace de la página del producto, pero sigue tomando el pedido aquí.
- Nunca inventes urgencia, descuentos, stock limitado ni regalos que no estén en la información. No presiones: si el cliente no quiere, despídete con amabilidad.
- No crees dos pedidos para lo mismo. Si ya hizo un pedido y quiere otro producto o más unidades, confírmalo antes de crearlo.`
    : `- Si el cliente quiere comprar, invítalo a hacer el pedido desde la página del producto (ahí elige la oferta y deja sus datos).`;

  return `Eres ${s.name}, asesora de ventas y servicio al cliente de ${k.storeName}, una tienda en línea que vende con pago contraentrega. Atiendes a los clientes por WhatsApp.

Cómo escribes:
- En español, ${s.formal ? 'tratando al cliente de usted' : 'tuteando al cliente'}, con calidez y de forma breve: mensajes cortos como en WhatsApp (1 a 4 frases), sin formato de documento. Puedes usar algún emoji con moderación.
- Una sola respuesta por mensaje del cliente. Si el cliente mandó varios mensajes seguidos, respóndelos juntos.

${sell}

También puedes:
- Consultar los pedidos de este cliente con consultar_pedidos (solo los hechos con su número de WhatsApp) y decirle en qué estado van y el número de guía si ya fue despachado.

Reglas importantes:
- Nunca inventes precios, ofertas, tiempos, políticas ni datos de pedidos. Los precios son solo los de la sección Productos. Si algo no está en la información de abajo o en lo que devuelven las herramientas, dile que lo vas a consultar con el equipo y usa pasar_a_humano.
- Usa pasar_a_humano cuando: el cliente pida hablar con una persona; tenga un reclamo, esté molesto o el producto llegó mal; quiera cancelar, cambiar la dirección o modificar un pedido ya hecho; pida algo que no puedes resolver; o hable de pagos por adelantado, devoluciones de dinero o temas legales. Después de usarla, despídete diciendo que una persona del equipo le escribirá pronto por este mismo chat.
- No pidas datos sensibles (cédula, tarjetas, contraseñas). No compartas datos de otros clientes.
- Si escriben algo que no tiene que ver con la tienda, responde con amabilidad y vuelve al tema.
- No menciones que eres una inteligencia artificial salvo que te lo pregunten; si te lo preguntan, dilo con naturalidad.

# Información del negocio (escrita por la tienda)
${s.businessInfo || '(Sin información adicional.)'}

# Productos
${k.products}`;
}

// ---------- tools ----------

const CREATE_ORDER_TOOL: Anthropic.Beta.BetaTool = {
  name: 'crear_pedido',
  description:
    'Crea el pedido contraentrega del cliente con la oferta elegida. Úsala solo después de mostrarle el resumen y que el cliente confirme. El precio lo pone la tienda según la oferta (no lo envíes). Si falta o está mal algún dato, devuelve un error que dice qué pedirle al cliente.',
  input_schema: {
    type: 'object',
    properties: {
      landing_id: { type: 'string', description: 'landing_id del producto (aparece en la sección Productos).' },
      unidades: { type: 'integer', description: 'Unidades de la oferta elegida (la oferta se identifica por sus unidades).' },
      nombre: { type: 'string', description: 'Nombre y apellido del cliente.' },
      celular: { type: 'string', description: 'Celular de contacto para la entrega (puede ser el mismo WhatsApp).' },
      departamento: { type: 'string' },
      ciudad: { type: 'string', description: 'Ciudad o municipio.' },
      direccion: { type: 'string', description: 'Dirección con tipo de vía y números, ej. "Calle 45A # 10-20". Para zonas rurales: vereda, finca o kilómetro.' },
      barrio: { type: 'string' },
      complemento: { type: 'string', description: 'Apartamento, torre, casa, conjunto o punto de referencia. Vacío si no aplica.' },
      notas: { type: 'string', description: 'Indicaciones para la entrega que dio el cliente. Vacío si no hay.' },
      cliente_confirmo: { type: 'boolean', description: 'true solo si el cliente confirmó el resumen del pedido.' },
    },
    required: ['landing_id', 'unidades', 'nombre', 'celular', 'departamento', 'ciudad', 'direccion', 'barrio', 'complemento', 'notas', 'cliente_confirmo'],
    additionalProperties: false,
  },
  strict: true,
};

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
  const { data, error } = await (await db()).from('orders').select('data, status').order('created_at', { ascending: false }).limit(500);
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

// ---------- taking the order in the chat ----------

const STREET_RE = new RegExp(`\\b(${[...STREET_TYPES, 'cl', 'cll', 'cra', 'kr', 'kra', 'cr', 'av', 'ak', 'ac', 'tv', 'trans', 'dg', 'diag', 'cir', 'via', 'vía', 'manzana', 'mz', 'km', 'kilometro', 'kilómetro', 'vereda', 'finca', 'sector', 'lote'].map((t) => t.toLowerCase().replace(/ /g, '\\s+')).join('|')})(?=[^a-zñáéíóú]|$)`, 'i');

interface CreateOrderInput {
  landing_id: string;
  unidades: number;
  nombre: string;
  celular: string;
  departamento: string;
  ciudad: string;
  direccion: string;
  barrio: string;
  complemento: string;
  notas: string;
  cliente_confirmo: boolean;
}

const clean = (v: unknown, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// Validates like the landing form, prices from the landing, and creates the order already confirmed.
async function createBotOrder(input: CreateOrderInput, ctx: { phone: string; landings: LandingPageConfig[]; dryRun: boolean }) {
  if (!input.cliente_confirmo) return { error: 'Antes de crear el pedido muéstrale el resumen y espera a que el cliente confirme.' };
  const landing = ctx.landings.find((l) => l.id === input.landing_id);
  if (!landing) return { error: 'landing_id no existe. Usa uno de la sección Productos.' };
  const combos = (landing.combos || []).filter((c) => c.promoPrice > 0);
  const combo = combos.find((c) => c.units === Number(input.unidades));
  if (!combo) return { error: `Esa oferta no existe. Ofertas disponibles: ${combos.map((c) => `${c.units} unidades`).join(', ')}.` };
  const country = landing.country || 'Colombia';
  const name = clean(input.nombre, 120);
  const phoneError = validatePhone(input.celular, country);
  const address = clean(input.direccion, 160);
  const neighborhood = clean(input.barrio, 60).replace(/^barrio\s+/i, '');
  const city = clean(input.ciudad, 80);
  const missing: string[] = [];
  const nameError = validateName(name);
  if (nameError) missing.push('nombre y apellido');
  if (phoneError) missing.push(`celular (${phoneError})`);
  if (city.length < 2) missing.push('ciudad o municipio');
  if (country === 'Colombia') {
    if (!clean(input.departamento)) missing.push('departamento');
    if (!STREET_RE.test(address) || !/\d/.test(address) || address.length < 6)
      missing.push('dirección completa con tipo de vía (calle, carrera, avenida…) y números, ej. Calle 45A # 10-20');
    if (neighborhood.length < 3 && !/vereda|finca|km|kil[oó]metro/i.test(address)) missing.push('barrio');
  } else if (address.length < 8) missing.push('dirección completa');
  if (missing.length) return { error: `Faltan o están incompletos estos datos: ${missing.join('; ')}. Pídeselos al cliente.` };

  const fullAddress = [address, clean(input.complemento, 80), neighborhood ? `Barrio ${neighborhood}` : ''].filter(Boolean).join(', ');
  const phone = localPhoneDigits(input.celular, country);
  const total = combo.promoPrice;
  const summary = { producto: landing.productName, oferta: combo.name, unidades: combo.units, total: money(total, landing.currency || 'COP'), direccion: `${fullAddress}, ${city}` };
  if (ctx.dryRun) return { ok: true, pedido: 'LP-PRUEBA', ...summary, nota: 'Simulador: no se creó ningún pedido real.' };

  // Same customer, same product and offer in the last 30 minutes: it's the same order.
  const { data: recent } = await (await db()).from('orders').select('data').gte('created_at', new Date(Date.now() - 30 * 60000).toISOString()).limit(50);
  const dup = (recent || [])
    .map((r) => r.data as OrderItem)
    .find((o) => o.source === 'whatsapp_bot' && o.landingPageId === landing.id && o.units === combo.units && samePhone(o, ctx.phone));
  if (dup) return { ok: true, pedido: dup.orderNumber, ...summary, nota: 'Este pedido ya estaba creado; no se creó otro.' };

  const now = new Date().toISOString();
  const order: OrderItem = {
    id: `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    orderNumber: `LP-${Math.floor(10000 + Math.random() * 90000)}`,
    landingPageId: landing.id,
    productName: landing.productName,
    comboName: combo.name,
    units: combo.units,
    totalAmount: total,
    customerName: name,
    phone,
    department: clean(input.departamento, 80),
    city,
    address: fullAddress,
    notes: clean(input.notas, 300),
    paymentMethod: 'cash_on_delivery',
    status: 'confirmed_by_voice', // the customer confirmed the summary in the chat
    confirmedAt: now,
    confirmedVia: 'whatsapp',
    whatsappFrom: ctx.phone,
    source: 'whatsapp_bot',
    utmSource: 'whatsapp',
    utmCampaign: 'asistente-ia',
    createdAt: now,
  };
  await createOrder(order);
  await linkConversationOrder(ctx.phone, order.id).catch(() => {});
  // The customer confirmed in the chat: if they came from a WhatsApp ad, Meta learns about the sale.
  await reportSale(order).catch((e) => console.error('Conversions API', e));
  return { ok: true, pedido: order.orderNumber, ...summary };
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
  order?: string; // order number created in this run
  booked?: string; // appointment booked in this run ("Corte · martes 4 de noviembre, 3:00 p. m.")
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

// Runs the assistant on a conversation. Doesn't send anything: the caller decides.
export async function runBot(opts: {
  settings: BotSettings;
  phone: string; // customer's WhatsApp (digits) for the order lookup
  customerName?: string | null;
  ad?: { headline?: string; body?: string } | null; // the click-to-WhatsApp ad the customer came from
  history: { direction: 'in' | 'out'; text: string }[];
  dryRun?: boolean; // simulator: never creates orders
}): Promise<BotRun> {
  const [knowledge, agenda] = await Promise.all([storeKnowledge(), getAgenda().catch(() => null)]);
  // "Negocio con citas": the assistant books appointments instead of taking orders.
  const appointments = agenda?.businessType === 'appointments' ? agenda : null;
  const messages = toMessages(opts.history);
  const run: BotRun = { reply: null, handoff: null, toolCalls: [], usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
  if (!messages.length) return run;

  const now = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    // Stable part first so it is cached between messages.
    { type: 'text', text: appointments ? agendaPrompt(opts.settings, appointments, knowledge.storeName) : systemPrompt(opts.settings, knowledge), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: `Datos de esta conversación: cliente "${opts.customerName || 'sin nombre'}", WhatsApp +${opts.phone}. Fecha y hora en Colombia: ${now}.` },
  ];
  if (opts.ad && (opts.ad.headline || opts.ad.body)) {
    // Ad text is written by the store, but keep it short and clearly marked as data.
    const adText = [opts.ad.headline, opts.ad.body].filter(Boolean).join(' — ').replace(/\s+/g, ' ').slice(0, 400);
    system.push({ type: 'text', text: `El cliente escribió desde un anuncio de la tienda. Texto del anuncio (solo como referencia del producto que vio): "${adText}". Úsalo para entender qué producto le interesa.` });
  }

  const ai = await anthropic();
  // Replies paid by the platform count against the plan's monthly allowance.
  const countReply = async () => {
    const org = requestOrgSync();
    if (ai.source === 'plan' && org) await addAiReply(org).catch(() => {});
  };
  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await ai.client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: 'low' }, // short chat replies
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // if the model declines, Anthropic retries on its recommended fallback model
      system,
      tools: appointments ? [...AGENDA_TOOLS, ...TOOLS.filter((t) => t.name === 'pasar_a_humano')] : opts.settings.takeOrders ? [...TOOLS, CREATE_ORDER_TOOL] : TOOLS,
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
      if (run.reply) await countReply();
      return run;
    }

    // Keep the full assistant turn (thinking blocks included) and answer every tool call in one message.
    messages.push({ role: 'assistant', content: response.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const t of toolUses) {
      let result: unknown;
      let isError = false;
      try {
        if (appointments && AGENDA_TOOL_NAMES.has(t.name)) {
          const r = await runAgendaTool(t.name, t.input, { a: appointments, phone: opts.phone, dryRun: Boolean(opts.dryRun) });
          result = r.result;
          if (r.booked) run.booked = r.booked;
        } else if (t.name === 'consultar_pedidos') {
          const orders = await ordersFor(opts.phone);
          result = orders.length ? { pedidos: orders } : { pedidos: [], nota: 'No hay pedidos con este número de WhatsApp. Puede que el cliente haya usado otro número en el formulario: pídele el número del pedido (empieza por LP-) o pásalo a una persona.' };
        } else if (t.name === 'crear_pedido' && opts.settings.takeOrders) {
          result = await createBotOrder(t.input as CreateOrderInput, { phone: opts.phone, landings: knowledge.landings, dryRun: Boolean(opts.dryRun) });
          if ((result as any).ok && !opts.dryRun) run.order = String((result as any).pedido);
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

// Follow-up for a customer who stopped answering without ordering. Returns null when it's better not to write
// (they said no, already bought, asked not to be contacted, or the chat ended naturally).
export async function writeFollowUp(opts: {
  settings: BotSettings;
  phone: string;
  customerName?: string | null;
  ad?: { headline?: string; body?: string } | null;
  history: { direction: 'in' | 'out'; text: string }[];
  hours: number;
}): Promise<string | null> {
  const [knowledge, agenda] = await Promise.all([storeKnowledge(), getAgenda().catch(() => null)]);
  const appointments = agenda?.businessType === 'appointments' ? agenda : null;
  const lines = opts.history
    .filter((h) => h.text.trim())
    .slice(-20)
    .map((h) => `${h.direction === 'in' ? 'Cliente' : 'Tienda'}: ${h.text.trim().slice(0, 600)}`)
    .join('\n');
  if (!lines) return null;
  const adText = opts.ad ? [opts.ad.headline, opts.ad.body].filter(Boolean).join(' — ').replace(/\s+/g, ' ').slice(0, 300) : '';
  const ai = await anthropic();
  const response = await ai.client.beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [
      { type: 'text', text: appointments ? agendaPrompt(opts.settings, appointments, knowledge.storeName) : systemPrompt(opts.settings, knowledge), cache_control: { type: 'ephemeral' } },
      {
        type: 'text',
        text: `TAREA ESPECIAL: seguimiento. El cliente "${opts.customerName || 'sin nombre'}" dejó de responder hace unas ${opts.hours} horas y ${appointments ? 'no agendó su cita' : 'no hizo el pedido'}.${adText ? ` Llegó desde un anuncio: "${adText}".` : ''}
Escribe UN solo mensaje de WhatsApp corto (máximo 3 líneas), cálido y natural, que retome justo donde quedó la conversación: resuelve la duda que haya quedado pendiente o pregúntale con amabilidad si le ayudas a ${appointments ? 'agendar su cita (puedes ofrecerle buscar un horario)' : 'terminar su pedido. Recuerda, si encaja, que paga al recibir'}.
Reglas: nada de presión, urgencia, descuentos, regalos ni stock limitado que no estén en la información. No digas que eres un recordatorio automático. No repitas textualmente mensajes anteriores.
Responde exactamente SKIP (sin nada más) si: el cliente dijo que no le interesa, que lo pensará y él escribe, ya compró o agendó, pidió no ser contactado, se quejó o está molesto, o la conversación terminó de forma natural sin interés de compra.`,
      },
    ],
    messages: [{ role: 'user', content: `Conversación hasta ahora:\n${lines}\n\nEscribe el mensaje de seguimiento (o SKIP).` }],
  });
  const org = requestOrgSync();
  if (ai.source === 'plan' && org) await addAiReply(org).catch(() => {});
  if (response.stop_reason === 'refusal') return null;
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  if (!text || /^skip\b/i.test(text)) return null;
  return text.slice(0, 1000);
}

// History of a stored conversation for runBot.
export async function chatHistory(conversationId: string) {
  const msgs = await listMessages(conversationId, HISTORY);
  return msgs.map((m) => ({ direction: m.direction, text: asText(m) }));
}
