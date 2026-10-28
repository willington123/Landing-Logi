// WhatsApp business flows: order confirmation and customer replies.
import { updateOrderStatus } from '@/lib/server/db';
import { normalizePhone } from '@/lib/server/meta-capi';
import { confirmTemplateEnabled, formatMoney, sendConfirmTemplate, sendText, type InboundMessage } from '@/lib/server/whatsapp';
import { findPendingOrder, linkConversationOrder, recordInbound, recordOutbound } from '@/lib/server/wa-store';
import type { OrderItem } from '@/lib/types';

const firstName = (name: string) => (name || '').trim().split(/\s+/)[0] || 'cliente';

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

async function reply(phone: string, text: string, orderId?: string) {
  const result = await sendText(phone, text);
  await recordOutbound({ phone, orderId, type: 'text', body: text, result });
}

// Stores an incoming message and acts on "Confirmar pedido" / "Cancelar".
export async function handleInbound(m: InboundMessage) {
  const { isNew } = await recordInbound(m);
  if (!isNew || !m.intent) return; // duplicate delivery or a normal chat message

  const order = await findPendingOrder(m.from, m.orderId);
  if (!order) {
    await reply(
      m.from,
      m.orderId
        ? 'Este pedido ya no está pendiente de confirmación. Si necesitas cambiar algo, escríbenos por aquí.'
        : 'No encontramos un pedido pendiente con este número. Si necesitas ayuda, escríbenos por aquí.',
    );
    return;
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
