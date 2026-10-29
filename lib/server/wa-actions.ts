// WhatsApp business flows: order confirmation and customer replies.
import { patchOrderData, updateOrderStatus } from '@/lib/server/db';
import { normalizePhone } from '@/lib/server/meta-capi';
import { confirmTemplateEnabled, formatMoney, sendConfirmTemplate, sendText, type InboundMessage } from '@/lib/server/whatsapp';
import { dueWaFallbackOrders, findOrderByNumber, findPendingOrder, linkConversationOrder, recordInbound, recordOutbound } from '@/lib/server/wa-store';
import { getLandingInfo } from '@/lib/server/voice-store';
import type { OrderItem } from '@/lib/types';

const firstName = (name: string) => (name || '').trim().split(/\s+/)[0] || 'cliente';

// Order id used in the buttons of the test message (Integrations → "Enviar mensaje de prueba").
export const TEST_ORDER_ID = 'prueba';

// Sends the confirmation template for a new order. Never throws.
export async function sendOrderConfirmation(order: OrderItem, opts: { currency?: string; country?: string }) {
  if (!confirmTemplateEnabled()) return null;
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
  const out = { sent: 0, failed: 0 };
  if (!confirmTemplateEnabled()) return out;
  for (const order of await dueWaFallbackOrders()) {
    // Clear first so an overlapping run can't send it twice.
    await patchOrderData(order.id, { waFallbackAt: null });
    if (order.whatsapp) continue; // a template already went out (e.g. sent by hand)
    const r = await sendConfirmationForOrder(order).catch(() => null);
    if (r?.ok) out.sent++;
    else out.failed++;
  }
  return out;
}

async function reply(phone: string, text: string, orderId?: string) {
  const result = await sendText(phone, text);
  await recordOutbound({ phone, orderId, type: 'text', body: text, result });
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

  // The message names an order (e.g. the landing's pre-filled "Quiero confirmar mi pedido LP-12345"):
  // show that order next to the chat even if no action follows.
  if (m.orderNumber) {
    const named = await findOrderByNumber(m.orderNumber);
    if (named) await linkConversationOrder(m.from, named.id);
  }
  if (!m.intent) return; // a normal chat message

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
