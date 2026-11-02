// WhatsApp business flows: order confirmation and customer replies.
import { appointmentButton } from '@/lib/server/agenda-reminders';
import { patchOrderData, updateOrderStatus } from '@/lib/server/db';
import { normalizePhone } from '@/lib/server/meta-capi';
import { confirmTemplateEnabled, formatMoney, sendConfirmTemplate, sendText, type InboundMessage } from '@/lib/server/whatsapp';
import { dueWaFallbackOrders, findOrderByNumber, findPendingOrder, linkConversationOrder, recordInbound, recordOutbound } from '@/lib/server/wa-store';
import { getLandingInfo } from '@/lib/server/voice-store';
import { autoSentRecently, getAutoSettings, noteAutoSent } from '@/lib/server/crm-store';
import { fillQuickReply, isWorkingTime, matchRule } from '@/lib/crm';
import { botTakesMessage } from '@/lib/server/bot-inbound';
import type { OrderItem } from '@/lib/types';

const firstName = (name: string) => (name || '').trim().split(/\s+/)[0] || 'cliente';

// Order id used in the buttons of the test message (Integrations → "Enviar mensaje de prueba").
export const TEST_ORDER_ID = 'prueba';

// Sends the confirmation template for a new order. Never throws.
export async function sendOrderConfirmation(order: OrderItem, opts: { currency?: string; country?: string }) {
  if (!(await confirmTemplateEnabled())) return null;
  const to = normalizePhone(order.phone, opts.country);
  const vars = {
    name: firstName(order.customerName),
    product: `${order.productName} - ${order.comboName}`,
    total: formatMoney(order.totalAmount, opts.currency || 'COP'),
    city: order.city,
  };
  const result = await sendConfirmTemplate(to, vars, order.id);
  const body = `Plantilla de confirmación: ${vars.name}, ${vars.product}, ${vars.total}, ${vars.city}. [Confirmar pedido] [Cancelar]`;
  await recordOutbound({ phone: to, name: order.customerName, orderId: order.id, type: 'template', body, result }).catch((e) =>
    console.error('WhatsApp: no se pudo guardar el mensaje enviado', e),
  );
  return { ok: result.ok, to, messageId: result.messageId, error: result.error, at: new Date().toISOString() };
}

// Sends the confirmation template for an order and saves the result on it (manual button and fallback).
export async function sendConfirmationForOrder(order: OrderItem) {
  const landing = await getLandingInfo(order.landingPageId);
  const whatsapp = await sendOrderConfirmation(order, { currency: landing.currency, country: landing.country });
  if (whatsapp) await patchOrderData(order.id, { whatsapp, waFallbackAt: null });
  return whatsapp;
}

// Cron: customers who didn't write after the landing's redirect get the template.
export async function processWaFallback() {
  const out: { sent: number; failed: number; error?: string } = { sent: 0, failed: 0 };
  if (!(await confirmTemplateEnabled())) return { ...out, error: 'La plantilla de confirmación no está configurada.' };
  for (const order of await dueWaFallbackOrders()) {
    // Clear first so an overlapping run can't send it twice.
    await patchOrderData(order.id, { waFallbackAt: null });
    if (order.whatsapp) continue; // a template already went out (e.g. sent by hand)
    const r = await sendConfirmationForOrder(order).catch(async (e: any) => {
      // Keep the reason on the order so the panel shows why it wasn't sent.
      const whatsapp = { ok: false, error: e?.message || String(e), at: new Date().toISOString() };
      await patchOrderData(order.id, { whatsapp }).catch(() => {});
      return whatsapp;
    });
    if (r?.ok) out.sent++;
    else {
      out.failed++;
      out.error = r?.error;
    }
  }
  return out;
}

async function reply(phone: string, text: string, orderId?: string) {
  const result = await sendText(phone, text);
  await recordOutbound({ phone, orderId, type: 'text', body: text, result });
}

const RULE_EVERY_MS = 24 * 3600 * 1000; // the same automatic answer at most once a day per customer
const AWAY_EVERY_MS = 12 * 3600 * 1000; // the out-of-hours message at most once every 12 h

// Keyword answers (e.g. "precio") and the out-of-hours message. Never repeats them to the same customer too often.
export async function autoReply(m: InboundMessage) {
  const cfg = await getAutoSettings();
  const vars = { nombre: firstName(m.profileName || '').replace(/^cliente$/, '') };
  const outbox: { key: string; text: string }[] = [];
  const rule = m.type === 'text' ? matchRule(cfg.rules, m.text) : null;
  if (rule && !(await autoSentRecently(m.from, `rule:${rule.id}`, RULE_EVERY_MS))) outbox.push({ key: `rule:${rule.id}`, text: fillQuickReply(rule.reply, vars) });
  if (cfg.away.enabled && cfg.away.message && !isWorkingTime(cfg.away, cfg.timezone, new Date(m.timestamp)) && !(await autoSentRecently(m.from, 'away', AWAY_EVERY_MS)))
    outbox.push({ key: 'away', text: fillQuickReply(cfg.away.message, vars) });
  if (!outbox.length) return [];
  for (const o of outbox) {
    const result = await sendText(m.from, o.text);
    await recordOutbound({ phone: m.from, type: 'auto', body: o.text, result, auto: true });
  }
  await noteAutoSent(m.from, outbox.map((o) => o.key));
  return outbox.map((o) => o.key);
}

// Stores an incoming message and acts on "Confirmar pedido" / "Cancelar".
export async function handleInbound(m: InboundMessage) {
  const { isNew } = await recordInbound(m);
  if (!isNew) return; // duplicate delivery

  // Buttons on the test message sent from Integrations.
  if (m.orderId === TEST_ORDER_ID) {
    await reply(m.from, 'Mensaje de prueba recibido ✅ La confirmación de pedidos por WhatsApp funciona.');
    return;
  }

  // "Confirmar cita" / "Cancelar cita" on an appointment reminder.
  if (m.appt) {
    await appointmentButton(m as InboundMessage & { appt: NonNullable<InboundMessage['appt']> });
    return;
  }

  // The message names an order (e.g. the landing's pre-filled "Quiero confirmar mi pedido LP-12345"):
  // show that order next to the chat even if no action follows.
  if (m.orderNumber) {
    const named = await findOrderByNumber(m.orderNumber);
    if (named) await linkConversationOrder(m.from, named.id);
  }
  if (!m.intent) {
    // A normal chat message: answer it automatically if a rule or the out-of-hours message applies.
    // The AI assistant answers if it's on; otherwise (or if it fails) the keyword / out-of-hours replies.
    const fallback = () => autoReply(m).catch((e) => console.error('WhatsApp: respuesta automática falló', e));
    const byBot = await botTakesMessage(m, fallback).catch((e) => {
      console.error('Asistente IA: no se pudo iniciar', e);
      return false;
    });
    if (!byBot) await fallback();
    return;
  }

  const order = m.orderNumber ? await findOrderByNumber(m.orderNumber, true) : await findPendingOrder(m.from, m.orderId);
  if (!order) {
    await reply(
      m.from,
      m.orderId || m.orderNumber
        ? 'Este pedido ya no está pendiente de confirmación. Si necesitas cambiar algo, escríbenos por aquí.'
        : 'No encontramos un pedido pendiente con este número. Si necesitas ayuda, escríbenos por aquí.',
    );
    return;
  }
  if (m.orderNumber) {
    await linkConversationOrder(m.from, order.id);
    // Note where the confirmation came from (the WhatsApp number may differ from the one in the form).
    await patchOrderData(order.id, { confirmedVia: 'whatsapp', whatsappFrom: m.from }).catch(() => {});
  }
  await linkConversationOrder(m.from, order.id);
  const name = firstName(order.customerName);
  if (m.intent === 'confirm') {
    await updateOrderStatus(order.id, 'confirmed_by_voice');
    await reply(m.from, `¡Gracias, ${name}! Tu pedido ${order.orderNumber} quedó confirmado. Te avisaremos cuando vaya en camino.`, order.id);
  } else {
    await updateOrderStatus(order.id, 'cancelled');
    await reply(m.from, `Listo, ${name}. Cancelamos tu pedido ${order.orderNumber}. Si fue un error, escríbenos por aquí.`, order.id);
  }
}
