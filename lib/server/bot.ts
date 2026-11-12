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
import { MODEL_WEIGHT } from '@/lib/plans';
import { DEFAULT_BOT, cleanFollowUp, handoffRulesText, type BotChatState, type BotModel, type BotSettings } from '@/lib/bot';
import type { LandingPageConfig, OrderItem, OrderStatus } from '@/lib/types';
import { photoName, photosToSend, type ProductMedia } from '@/lib/product-media';
import { getAgenda } from '@/lib/server/agenda';
import { AGENDA_TOOLS, AGENDA_TOOL_NAMES, agendaPrompt, runAgendaTool } from '@/lib/server/bot-agenda';
import { addConversationTags, getConversationTags, getTags } from '@/lib/server/crm-store';
import { isOrderTag, type CrmTag } from '@/lib/crm';

// The store picks the model in Automatizaciones (Sonnet by default).
const MODEL_IDS: Record<BotModel, string> = { quality: 'claude-opus-5-5', balanced: 'claude-sonnet-5-5', economy: 'claude-haiku-5-5' };
// Model plus the refusal fallback (Haiku has no server-side fallback, so it goes without it).
export function modelParams(settings: BotSettings) {
  const model = MODEL_IDS[settings.model] || MODEL_IDS.balanced;
  return model === MODEL_IDS.economy ? { model } : { model, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };
}
const HISTORY = 30; // messages of the chat sent to the model
const MAX_STEPS = 4; // model calls per customer message (tool use included)

export const botConfigured = async () => Boolean(await anthropicKey());

// One client per API key (each store can use its own key).
const clients = new Map<string, Anthropic>();
export async function anthropic(): Promise<{ client: Anthropic; source: 'env' | 'store' | 'plan' }> {
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
  returned: 'devuelto (la transportadora no pudo entregarlo)',
  cancelled: 'cancelado',
};

const money = (v: number, currency = 'COP') => `$${Math.round(v || 0).toLocaleString('es-CO')} ${currency}`;

function landingText(l: LandingPageConfig, base: string, media?: ProductMedia): string {
  const cur = l.currency || 'COP';
  const page = base && l.kind !== 'product' && l.slug ? `; página con fotos: ${base}/p/${l.slug}` : '';
  const lines = [`## ${l.productName}`, `(landing_id para crear_pedido: ${l.id}; país: ${l.country || 'Colombia'}${page})`];
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
  if (media?.images.length || media?.audio) {
    lines.push('Material para enviar al cliente con enviar_medios:');
    if (media.images.length) lines.push(`- Fotos (cada una con su nombre; envía por número la que corresponda a lo que pide el cliente): ${media.images.map((m, i) => `[${i + 1}] ${photoName(m)}`).join('; ')}`);
    if (media.audio) lines.push(`- Nota de voz de la tienda explicando el producto${media.audio.seconds ? ` (${media.audio.seconds} s)` : ''}.${media.audio.transcript ? ` Lo que dice: "${media.audio.transcript.replace(/\s+/g, ' ')}"` : ''}`);
  }
  return lines.join('\n');
}

export async function storeKnowledge(): Promise<{ storeName: string; products: string; landings: LandingPageConfig[]; media: Record<string, ProductMedia> }> {
  // Published landings and the products sold only by WhatsApp.
  const [landings, settings, media] = await Promise.all([
    (await import('@/lib/server/products')).sellables(20),
    getSettings<{ storeName?: string }>().catch(() => null),
    (await import('@/lib/server/product-media')).getAllMedia().catch(() => ({}) as Record<string, ProductMedia>),
  ]);
  const base = publicBaseUrl();
  return {
    storeName: settings?.storeName?.trim() || 'nuestra tienda',
    products: landings.length ? landings.map((l) => landingText(l, base, media[l.id])).join('\n\n') : '(No hay productos publicados todavía.)',
    landings,
    media,
  };
}

function systemPrompt(s: BotSettings, k: { storeName: string; products: string }): string {
  const sell = s.takeOrders
    ? `Tu objetivo principal es vender: llevar cada conversación hasta un pedido confirmado aquí mismo en el chat, sin mandar al cliente a otra página.

Cómo cierras la venta:
1. Entiende qué busca y resuelve sus dudas en pocas palabras, conectando los beneficios del producto con lo que te dice. Avanza un paso a la vez: no adelantes precio, ofertas ni pedido de datos si el cliente todavía no ha preguntado ni mostrado interés.
2. Recomienda una oferta concreta (normalmente la marcada como "la más elegida", o la que mejor le sirve) con su precio final. Si es natural, menciona una sola vez el ahorro de llevar más unidades.
3. Resuelve objeciones con hechos reales: pago contraentrega (paga al recibir, sin riesgo), envío, garantía.
4. Solo cuando diga que lo quiere ("lo quiero", "quiero pedirlo", "cómo lo pido", "me lo mandas"), pide los datos del envío en un solo mensaje corto. Si solo pregunta algo (precio, envío a su ciudad, cómo se usa), respóndele eso y pregúntale si quiere pedirlo; no le pidas los datos todavía. Los datos son: nombre y apellido; celular (puede ser este mismo WhatsApp); departamento y ciudad; dirección completa con tipo de vía (calle, carrera, avenida, transversal, diagonal…), números y barrio, y si aplica apartamento o casa. Luego pide solo lo que falte o esté incompleto.
5. Con todo listo, muéstrale un resumen corto (producto y oferta, total a pagar al recibir, nombre, ciudad y dirección) y pregúntale si confirmas el pedido.
6. Solo cuando diga que sí, usa crear_pedido con cliente_confirmo = true. Si la herramienta devuelve un error de datos, pídele al cliente exactamente lo que falta.
7. Cuando el pedido quede creado, confírmale que quedó listo, cuándo le llega y recuérdale tener el dinero listo para pagar al recibir. Agradécele. No le des el número del pedido (es interno); solo si el cliente lo pide.
- Si el cliente quiere ver fotos o más detalles, puedes compartir el enlace de la página del producto, pero sigue tomando el pedido aquí.
- Nunca inventes urgencia, descuentos, stock limitado ni regalos que no estén en la información. No presiones: si el cliente no quiere, despídete con amabilidad.
- Nunca crees dos pedidos para lo mismo. Si el cliente corrige o cambia algo de su pedido (dirección, barrio, nombre, celular, ciudad, la oferta…) antes de que se despache, muéstrale el resumen corregido y, cuando confirme, usa crear_pedido otra vez con TODOS los datos ya corregidos y pedido_adicional = false: el sistema corrige el mismo pedido. Dile que quedó corregido, no que hizo un pedido nuevo.
- pedido_adicional = true solo si el cliente pide claramente un pedido aparte además del que ya tiene (por ejemplo, otro para regalar a otra dirección). Si dudas, pregúntale.`
    : `- Si el cliente quiere comprar, invítalo a hacer el pedido desde la página del producto (ahí elige la oferta y deja sus datos).`;

  return `Eres ${s.name}, asesora de ventas y servicio al cliente de ${k.storeName}, una tienda en línea que vende con pago contraentrega. Atiendes a los clientes por WhatsApp.

Cómo escribes:
- En español, ${s.formal ? 'tratando al cliente de usted' : 'tuteando al cliente'}, con calidez y como una persona por WhatsApp: mensajes cortos de 1 a 3 frases, sin párrafos largos, listas ni formato de documento. Máximo un emoji por mensaje.
- Un mensaje, una idea: no juntes en el mismo mensaje saludo, beneficios, precio y pedido de datos. Termina con una sola pregunta.
- Nada de muletillas ni frases de vendedor de televisión ("o sea", "¡increíble oferta!", "no te lo pierdas").
- Una sola respuesta por mensaje del cliente. Si el cliente mandó varios mensajes seguidos, respóndelos juntos.

Cómo empiezas:
- Si el cliente solo saluda ("hola", "buenas", "info", "buenas tardes"), responde con un saludo corto, preséntate por tu nombre y hazle una pregunta para saber qué busca. Si escribió desde un anuncio o la tienda tiene un solo producto, pregúntale si es por ese producto (nómbralo). En ese primer mensaje no envíes fotos ni nota de voz, no des precios y no pidas datos.
- Ejemplo de primer mensaje: "¡Hola! Soy ${s.name} de ${k.storeName} 😊 ¿Te interesa el {producto}? Cuéntame y te ayudo." (cambia {producto} por el nombre real; no copies el ejemplo palabra por palabra).

${sell}

También puedes:
- Enviar fotos y la nota de voz de un producto con enviar_medios, cuando el producto las tenga (sección Productos, "Material para enviar"). Cada foto tiene un nombre que dice qué es: cuando el cliente pregunte o pida algo que corresponde al nombre de una foto, envíale esa foto (indica su número) además de responderle. Por ejemplo: si pregunta el precio y hay una foto "Precios", envíala; si pide ver el producto o fotos, envía las fotos "Producto"; si pregunta tallas o medidas, la de "Tallas y medidas"; y lo mismo con cualquier otro nombre (cómo se usa, resultados, testimonios, envíos). Envía solo las fotos que corresponden a lo que pidió, no todas. La nota de voz, cuando el cliente confirme que le interesa el producto o pregunte cómo es o cómo funciona. Nunca envíes nada en respuesta a un simple saludo. No digas que las enviaste ni las anuncies ("te dejé fotos", "te mandé un audio", "mira arriba"): el cliente ya las ve en el chat. Si envías solo fotos, acompáñalas con una respuesta corta y una sola pregunta para seguir la conversación (por ejemplo "¿Para qué tipo de piel lo buscas?"). Si envías la nota de voz, no escribas ningún texto en ese turno: la nota de voz ya le explica y el cliente responderá después de escucharla. Cada foto y la nota de voz se envían una sola vez por cliente: si ya se le envió esa misma, no la repitas salvo que el cliente pida de forma explícita que se la reenvíes. Tú ya sabes lo que dice la nota de voz: usa esa información en tus respuestas y no la contradigas. No digas que es una grabación automática; puedes decir "te dejo unas fotos" o "te mando una nota de voz donde te explico".
- Consultar los pedidos de este cliente con consultar_pedidos (solo los hechos con su número de WhatsApp) y decirle en qué estado van y el número de guía si ya fue despachado.

Reglas importantes:
- Nunca inventes precios, ofertas, tiempos, políticas ni datos de pedidos. Los precios son solo los de la sección Productos de abajo, que es la información de este momento: si antes en esta conversación se mencionó otro precio u oferta, ya cambió; usa el de ahora sin comentar el cambio. Si la información del negocio menciona un precio distinto al de la sección Productos, usa el de Productos (es el que se cobra en el pedido). Si algo no está en la información de abajo o en lo que devuelven las herramientas, dile que lo vas a consultar con el equipo y usa pasar_a_humano.
- Usa pasar_a_humano cuando: el cliente pida hablar con una persona; tenga un reclamo, esté molesto o el producto llegó mal; quiera cancelar, cambiar la dirección o modificar un pedido ya hecho; pida algo que no puedes resolver; o hable de pagos por adelantado, devoluciones de dinero o temas legales. Después de usarla, despídete diciendo que una persona del equipo le escribirá pronto por este mismo chat.${handoffRulesText(s)}
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
    'Crea el pedido contraentrega del cliente con la oferta elegida, o corrige el que ya tiene sin despachar del mismo producto (nunca crea uno repetido). Úsala solo después de mostrarle el resumen y que el cliente confirme. El precio lo pone la tienda según la oferta (no lo envíes). Si falta o está mal algún dato, devuelve un error que dice qué pedirle al cliente.',
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
      pedido_adicional: {
        type: 'boolean',
        description:
          'false casi siempre. Si el cliente ya tiene un pedido sin despachar de este producto, crear_pedido CORRIGE ese mismo pedido con los datos nuevos (dirección, nombre, celular, oferta…). true solo si el cliente pidió de forma explícita un SEGUNDO pedido aparte, además del que ya tiene.',
      },
    },
    required: ['landing_id', 'unidades', 'nombre', 'celular', 'departamento', 'ciudad', 'direccion', 'barrio', 'complemento', 'notas', 'cliente_confirmo', 'pedido_adicional'],
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
      'Pasa la conversación a una persona del equipo y deja de responder en este chat. Úsala para reclamos, clientes molestos, cancelaciones, cambios de un pedido que tú no puedes corregir (ya despachado o subido a Dropi), solicitudes de hablar con una persona, o cualquier cosa que no puedas resolver con la información disponible.',
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

// Photos and voice note of a product (WhatsApp chats, products that have them).
const MEDIA_TOOL: Anthropic.Beta.BetaTool = {
  name: 'enviar_medios',
  description:
    'Envía al cliente por WhatsApp fotos y/o la nota de voz de un producto que tenga "Material para enviar". Elige las fotos por su nombre según lo que pidió el cliente (precio → "Precios", ver el producto → "Producto"…). Cada foto y la nota de voz se envían una sola vez por cliente; si ya se envió, no se repite salvo que el cliente pida explícitamente que se la reenvíes.',
  input_schema: {
    type: 'object',
    properties: {
      landing_id: { type: 'string', description: 'landing_id del producto (sección Productos).' },
      que: { type: 'string', enum: ['fotos', 'nota_de_voz', 'ambos'] },
      fotos: { type: 'array', items: { type: 'integer' }, description: 'Números de las fotos que corresponden a lo que pidió el cliente, según su nombre en la lista del producto. Vacío = las fotos "Producto".' },
      reenviar: { type: 'boolean', description: 'true solo si el cliente pidió de forma explícita que se las vuelvas a enviar.' },
    },
    required: ['landing_id', 'que', 'fotos', 'reenviar'],
    additionalProperties: false,
  },
  strict: true,
};

// The store's tags (Mensajes → Etiquetas) the assistant can put on the chat so the team finds it. "Confirmado"
// stays out: the store sets it when the order is created.
export function tagTool(tags: CrmTag[]): Anthropic.Beta.BetaTool | null {
  const names = tags.filter((t) => !isOrderTag(t)).map((t) => t.name);
  if (!names.length) return null;
  return {
    name: 'etiquetar_chat',
    description:
      'Pone etiquetas a este chat para que el equipo de la tienda lo encuentre fácil (el cliente no las ve). Úsala junto con tu respuesta en cuanto quede claro qué pasa en el chat, y solo con etiquetas que el chat aún no tenga. Ejemplos: "Dudas" si pregunta pero todavía no decide, "Reclamo" si se queja, "Cambio de dirección" si pide cambiar datos de su pedido, "VIP" si ya compró varias veces. Si ninguna encaja, no la uses. Nunca le menciones las etiquetas al cliente.',
    input_schema: {
      type: 'object',
      properties: { etiquetas: { type: 'array', items: { type: 'string', enum: names }, description: 'Etiquetas que le quieres poner al chat.' } },
      required: ['etiquetas'],
      additionalProperties: false,
    },
    strict: true,
  };
}

async function sendProductMedia(
  input: { landing_id?: string; que?: string; fotos?: number[]; reenviar?: boolean },
  ctx: { phone: string; landings: LandingPageConfig[]; media: Record<string, ProductMedia>; dryRun: boolean },
) {
  const product = ctx.landings.find((l) => l.id === input.landing_id);
  const media = product ? ctx.media[product.id] : undefined;
  if (!product || !media || (!media.images.length && !media.audio)) return { error: 'Ese producto no tiene fotos ni nota de voz para enviar.' };
  if (/^[mi]\d/.test(ctx.phone)) return { error: 'Las fotos y notas de voz solo se envían por WhatsApp. Describe el producto con palabras.' };
  const wantPhotos = input.que !== 'nota_de_voz' && media.images.length > 0;
  const wantAudio = input.que !== 'fotos' && Boolean(media.audio);
  const state = await getBotState(ctx.phone);
  const sent = state.mediaSent?.[product.id] || {};
  const again = Boolean(input.reenviar);
  const out: { fotos_enviadas: number; nota_de_voz_enviada: boolean; ya_enviado: string[]; fallo?: string[] } = { fotos_enviadas: 0, nota_de_voz_enviada: false, ya_enviado: [] };
  const name = product.productName || product.title;
  const { send: images, skipped } = photosToSend(media.images, input.fotos || [], sent, again);
  const sentImages: Record<string, string> = { ...(sent.images || {}) };
  const { sendAudio, sendImage } = await import('@/lib/server/whatsapp');
  const { recordOutbound } = await import('@/lib/server/wa-store');
  const now = new Date().toISOString();
  const mark: { photos?: string; audio?: string; images?: Record<string, string> } = { ...sent };
  const failed: string[] = [];
  if (wantPhotos) {
    out.ya_enviado.push(...skipped.map((img) => `foto "${photoName(img)}"`));
    for (const img of images) {
      if (ctx.dryRun) {
        out.fotos_enviadas++;
        continue;
      }
      const r = await sendImage(ctx.phone, img.url, img.caption || undefined);
      await recordOutbound({ phone: ctx.phone, type: 'image', body: `📷 ${photoName(img)} · ${name}`, result: r, payload: { type: 'image', image: { link: img.url, caption: img.caption || undefined } } }).catch(() => {});
      if (r.ok) {
        out.fotos_enviadas++;
        sentImages[img.url] = now;
      } else failed.push(`foto: ${r.error}`);
    }
    if (out.fotos_enviadas) {
      mark.photos = now;
      mark.images = sentImages;
    }
  }
  if (wantAudio) {
    if (sent.audio && !again) out.ya_enviado.push('nota de voz');
    else if (ctx.dryRun) out.nota_de_voz_enviada = true;
    else {
      const r = await sendAudio(ctx.phone, media.audio!.url);
      await recordOutbound({ phone: ctx.phone, type: 'audio', body: `🎤 Nota de voz de ${name}`, result: r, payload: { type: 'audio', audio: { link: media.audio!.url } } }).catch(() => {});
      if (r.ok) {
        out.nota_de_voz_enviada = true;
        mark.audio = now;
      } else failed.push(`nota de voz: ${r.error}`);
    }
  }
  if (failed.length) out.fallo = failed;
  if (!ctx.dryRun && (mark.photos !== sent.photos || mark.audio !== sent.audio || mark.images !== sent.images)) await setBotState(ctx.phone, { mediaSent: { ...(state.mediaSent || {}), [product.id]: mark } });
  return {
    ...out,
    nota: out.ya_enviado.length && !out.fotos_enviadas && !out.nota_de_voz_enviada
      ? 'Ya se le había enviado antes: no lo repitas. Sigue la conversación con lo que sabes del producto.'
      : out.nota_de_voz_enviada
        ? 'Listo, ya le llegó la nota de voz. No escribas nada más en este turno: la nota de voz ya le explica y el cliente responderá después de escucharla.'
        : 'Listo, ya los ve en el chat. No digas que los enviaste ni los describas; escribe solo una pregunta corta para seguir la conversación.',
    ...(media.audio?.transcript && wantAudio ? { lo_que_dice_la_nota_de_voz: media.audio.transcript } : {}),
    ...(ctx.dryRun ? { simulador: 'No se envió nada de verdad.' } : {}),
  };
}

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
  pedido_adicional?: boolean;
}

const clean = (v: unknown, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// The customer's newest order of this product that can still change (not shipped, delivered, returned or cancelled).
async function openOrderFor(phone: string, landingId: string): Promise<OrderItem | null> {
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await (await db()).from('orders').select('data, status').gte('created_at', since).order('created_at', { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  const closed: string[] = ['shipped', 'delivered', 'returned', 'cancelled'];
  const row = (data || []).find((r) => {
    const o = r.data as OrderItem;
    return o.landingPageId === landingId && !closed.includes(r.status) && samePhone(o, phone);
  });
  return row ? { ...(row.data as OrderItem), status: row.status as OrderStatus } : null;
}

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

  // The customer already has an order of this product that hasn't left: a new confirmation is a correction of
  // that same order (address, name, phone, offer…), never a second order, unless they asked for another one.
  const open = await openOrderFor(ctx.phone, landing.id);
  if (open && !input.pedido_adicional) {
    if (open.dropi?.orderId || open.inDropi || open.trackingNumber)
      return {
        error: `El pedido ${open.orderNumber} ya se subió a Dropi o a la transportadora: no lo puedes cambiar tú. Usa pasar_a_humano con tipo cambio_pedido y di qué quiere cambiar el cliente.`,
      };
    const changes: Partial<OrderItem> = {
      customerName: name,
      phone,
      department: clean(input.departamento, 80),
      city,
      address: fullAddress,
      notes: clean(input.notas, 300) || open.notes,
      comboName: combo.name,
      units: combo.units,
      totalAmount: total,
    };
    const moved = open.address !== fullAddress || open.city !== city;
    const updated: OrderItem = {
      ...open,
      ...changes,
      ...(moved && !open.previousAddress ? { previousAddress: [open.address, open.city, open.department].filter(Boolean).join(', ') } : {}),
      correctedAt: new Date().toISOString(),
    } as OrderItem;
    const { error } = await (await db()).from('orders').update({ data: updated }).eq('id', open.id);
    if (error) throw new Error(error.message);
    await linkConversationOrder(ctx.phone, open.id).catch(() => {});
    return { ok: true, pedido: open.orderNumber, actualizado: true, ...summary, nota: 'Se corrigió el pedido que el cliente ya tenía con estos datos; no se creó otro. Confírmale que quedó corregido.' };
  }

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
  if (m.media?.kind === 'audio')
    return m.transcript
      ? `[Nota de voz del cliente] ${m.transcript}`
      : '[El cliente envió una nota de voz que no se pudo entender. Pídele con amabilidad que la repita o que la escriba.]';
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
  sentVoice?: boolean; // the product's voice note went out in this run (then no text is sent with it)
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
  const hasMedia = Object.values(knowledge.media || {}).some((m) => m.images.length || m.audio);
  const run: BotRun = { reply: null, handoff: null, toolCalls: [], usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
  if (!messages.length) return run;
  const [storeTags, chatTagIds] = await Promise.all([getTags().catch(() => [] as CrmTag[]), getConversationTags().then((all) => all[opts.phone] || []).catch(() => [] as string[])]);
  const TAG_TOOL = tagTool(storeTags);
  const chatTagNames = storeTags.filter((t) => chatTagIds.includes(t.id)).map((t) => t.name);

  const now = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    // Stable part first so it is cached between messages.
    { type: 'text', text: appointments ? agendaPrompt(opts.settings, appointments, knowledge.storeName) : systemPrompt(opts.settings, knowledge), cache_control: { type: 'ephemeral' } },
    {
      type: 'text',
      text: /^[mi]\d/.test(opts.phone)
        ? `Datos de esta conversación: cliente "${opts.customerName || 'sin nombre'}", escribe por ${opts.phone.startsWith('m') ? 'Messenger' : 'Instagram'} (no tienes su celular: para un pedido o una cita pídeselo; si prefiere, invítalo a seguir por WhatsApp). Fecha y hora en Colombia: ${now}.`
        : `Datos de esta conversación: cliente "${opts.customerName || 'sin nombre'}", WhatsApp +${opts.phone}. Fecha y hora en Colombia: ${now}.`,
    },
  ];
  if (TAG_TOOL) system.push({ type: 'text', text: `Etiquetas que ya tiene este chat: ${chatTagNames.length ? chatTagNames.join(', ') : 'ninguna'}.` });
  if (opts.ad && (opts.ad.headline || opts.ad.body)) {
    // Ad text is written by the store, but keep it short and clearly marked as data.
    const adText = [opts.ad.headline, opts.ad.body].filter(Boolean).join(' — ').replace(/\s+/g, ' ').slice(0, 400);
    system.push({ type: 'text', text: `El cliente escribió desde un anuncio de la tienda. Texto del anuncio (solo como referencia del producto que vio): "${adText}". Úsalo para entender qué producto le interesa.` });
  }

  const ai = await anthropic();
  // Replies paid by the platform count against the plan's monthly allowance.
  const countReply = async () => {
    const org = requestOrgSync();
    if (ai.source === 'plan' && org) await addAiReply(org, MODEL_WEIGHT[opts.settings.model] ?? 1).catch(() => {});
  };
  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await ai.client.beta.messages.create({
      ...modelParams(opts.settings), // if the model declines, Anthropic retries on its recommended fallback model
      max_tokens: 8000,
      output_config: { effort: 'low' }, // short chat replies
      system,
      tools: [
        ...(appointments ? [...AGENDA_TOOLS, ...TOOLS.filter((t) => t.name === 'pasar_a_humano')] : opts.settings.takeOrders ? [...TOOLS, CREATE_ORDER_TOOL] : TOOLS),
        ...(hasMedia && !/^[mi]\d/.test(opts.phone) ? [MEDIA_TOOL] : []),
        ...(TAG_TOOL ? [TAG_TOOL] : []),
      ],
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
        } else if (t.name === 'enviar_medios') {
          result = await sendProductMedia(t.input as any, { phone: opts.phone, landings: knowledge.landings, media: knowledge.media || {}, dryRun: Boolean(opts.dryRun) });
          if ((result as any)?.nota_de_voz_enviada) run.sentVoice = true;
        } else if (t.name === 'consultar_pedidos') {
          const orders = await ordersFor(opts.phone);
          result = orders.length ? { pedidos: orders } : { pedidos: [], nota: 'No hay pedidos con este número de WhatsApp. Puede que el cliente haya usado otro número en el formulario: pídele el número del pedido (empieza por LP-) o pásalo a una persona.' };
        } else if (t.name === 'crear_pedido' && opts.settings.takeOrders) {
          result = await createBotOrder(t.input as CreateOrderInput, { phone: opts.phone, landings: knowledge.landings, dryRun: Boolean(opts.dryRun) });
          if ((result as any).ok && !opts.dryRun) run.order = String((result as any).pedido);
        } else if (t.name === 'etiquetar_chat' && TAG_TOOL) {
          const wanted = new Set(((t.input as any)?.etiquetas || []).map(String));
          const add = storeTags.filter((x) => wanted.has(x.name) && !isOrderTag(x) && !chatTagIds.includes(x.id));
          if (add.length && !opts.dryRun) await addConversationTags({ [opts.phone]: add.map((x) => x.id) });
          chatTagIds.push(...add.map((x) => x.id));
          result = { ok: true, etiquetas: add.map((x) => x.name), nota: 'Listo. No le menciones las etiquetas al cliente.' };
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
    ...modelParams(opts.settings),
    max_tokens: 2000,
    output_config: { effort: 'low' },
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
  if (ai.source === 'plan' && org) await addAiReply(org, MODEL_WEIGHT[opts.settings.model] ?? 1).catch(() => {});
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
