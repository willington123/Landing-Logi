// wa.me link the customer opens after placing an order, pre-filled with the order details.
import { normalizePhone } from '@/lib/phone';
import type { LandingPageConfig, OrderItem } from '@/lib/types';

export function formatMoney(amount: number, currency = 'COP'): string {
  if (currency === 'EUR') return `${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0)} €`;
  return `$${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(amount || 0)} ${currency}`;
}

type OrderLike = Pick<OrderItem, 'productName' | 'comboName' | 'totalAmount' | 'customerName' | 'phone' | 'city' | 'address'> &
  Partial<Pick<OrderItem, 'orderNumber' | 'department' | 'notes'>>;

export function orderWhatsAppMessage(order: OrderLike, currency = 'COP'): string {
  const field = (label: string, v?: string) => (v?.trim() ? [`${label}: ${v.trim()}`] : []);
  return [
    '¡Hola! Quiero confirmar mi pedido ✅',
    '',
    ...(order.orderNumber ? [`*Pedido:* ${order.orderNumber}`] : []),
    `*Producto:* ${order.productName} - ${order.comboName}`,
    `*Total:* ${formatMoney(order.totalAmount, currency)} (pago contraentrega)`,
    '',
    '*Mis datos:*',
    ...field('Nombre', order.customerName),
    ...field('Celular', order.phone),
    ...field('Departamento', order.department),
    ...field('Ciudad', order.city),
    ...field('Dirección', order.address),
    ...field('Indicaciones', order.notes),
    '',
    'Confirmo que mis datos son correctos.',
  ].join('\n');
}

// Empty string when the landing has no WhatsApp number or the redirect is turned off.
export function orderWhatsAppUrl(config: Pick<LandingPageConfig, 'whatsappNumber' | 'whatsappRedirect' | 'country' | 'currency'>, order: OrderLike): string {
  if (config.whatsappRedirect === false) return '';
  const to = normalizePhone(config.whatsappNumber || '', config.country);
  if (to.length < 8) return '';
  return `https://wa.me/${to}?text=${encodeURIComponent(orderWhatsAppMessage(order, config.currency || 'COP'))}`;
}

// Thank-you screen after the order (when the customer isn't sent to WhatsApp).
export const DEFAULT_THANK_YOU = {
  title: '¡Gracias por tu compra, {nombre}!',
  text: 'Recibimos tu pedido {pedido}. Te contactaremos al {telefono} para confirmar la entrega. Pagarás {total} cuando lo recibas.',
};
export function fillThankYou(text: string, order: OrderLike & { orderNumber?: string }, currency = 'COP'): string {
  const first = ((order.customerName || '').trim().split(/\s+/)[0] || '').replace(/^./, (c) => c.toLocaleUpperCase('es'));
  const vals: Record<string, string> = { nombre: first, pedido: order.orderNumber || '', total: formatMoney(order.totalAmount, currency), telefono: order.phone || '' };
  return text
    .replace(/\{([a-z]+)\}/g, (m, k) => (k in vals ? vals[k] : m))
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
// "Escríbenos por WhatsApp" from the thank-you screen (always available when the landing has a number).
export function storeWhatsAppUrl(config: Pick<LandingPageConfig, 'whatsappNumber' | 'country' | 'currency'>, order: OrderLike): string {
  const to = normalizePhone(config.whatsappNumber || '', config.country);
  if (to.length < 8) return '';
  return `https://wa.me/${to}?text=${encodeURIComponent(orderWhatsAppMessage(order, config.currency || 'COP'))}`;
}
