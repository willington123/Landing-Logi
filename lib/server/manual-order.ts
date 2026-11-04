// "Nuevo pedido": an order typed by the team (sold in a WhatsApp chat). It is created already confirmed.
import { createOrder } from '@/lib/server/db';
import { sellables } from '@/lib/server/products';
import { reportSale } from '@/lib/server/conversions';
import { linkConversationOrder } from '@/lib/server/wa-store';
import { addNote } from '@/lib/server/crm-store';
import { localPhoneDigits, validateName, validatePhone } from '@/lib/order-form';
import type { OrderItem } from '@/lib/types';

export interface ManualOrderInput {
  productId: string;
  units: number;
  total?: number | null; // agreed price (defaults to the offer's price)
  name: string;
  phone: string;
  department: string;
  city: string;
  address: string;
  neighborhood?: string;
  notes?: string;
  conversationId?: string | null; // the chat it was sold in
}

const clean = (v: unknown, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export async function createManualOrder(input: ManualOrderInput, by: string | null): Promise<OrderItem | string> {
  const product = (await sellables()).find((l) => l.id === input.productId);
  if (!product) return 'Elige el producto.';
  const offer = (product.combos || []).filter((c) => c.promoPrice > 0).find((c) => c.units === Number(input.units));
  if (!offer) return 'Elige la oferta (cuántas unidades).';
  const country = product.country || 'Colombia';
  const name = clean(input.name, 120);
  const nameError = validateName(name);
  if (nameError) return `Nombre: ${nameError}`;
  const phoneError = validatePhone(input.phone, country);
  if (phoneError) return `Celular: ${phoneError}`;
  const city = clean(input.city, 80);
  const department = clean(input.department, 80);
  const address = clean(input.address, 160);
  if (country === 'Colombia' && !department) return 'Elige el departamento.';
  if (city.length < 2) return 'Escribe la ciudad o municipio.';
  // Colombia: street and house number (two groups of numbers), unless it's a rural address.
  const rural = /vereda|finca|km|kil[oó]metro|corregimiento/i.test(address);
  const numbers = (address.match(/\d+/g) || []).length;
  if (address.length < 6 || !/\d/.test(address) || (country === 'Colombia' && !rural && numbers < 2))
    return 'Escribe la dirección completa, con calle y número de la casa (ej. Calle 45A # 10-20).';
  const totalIn = Math.round(Number(String(input.total ?? '').replace(/[^\d]/g, '')));
  const total = totalIn >= 1000 ? totalIn : offer.promoPrice;
  const neighborhood = clean(input.neighborhood, 60).replace(/^barrio\s+/i, '');
  const now = new Date().toISOString();
  const order: OrderItem = {
    id: `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    orderNumber: `LP-${Math.floor(10000 + Math.random() * 90000)}`,
    landingPageId: product.id,
    productName: product.productName,
    comboName: offer.name,
    units: offer.units,
    totalAmount: total,
    customerName: name,
    phone: localPhoneDigits(input.phone, country),
    department,
    city,
    address: [address, neighborhood ? `Barrio ${neighborhood}` : ''].filter(Boolean).join(', '),
    notes: clean(input.notes, 300),
    paymentMethod: 'cash_on_delivery',
    status: 'confirmed_by_voice',
    confirmedAt: now,
    confirmedVia: 'manual',
    source: 'manual',
    createdBy: by,
    utmSource: 'whatsapp',
    utmCampaign: 'venta-asesor',
    createdAt: now,
    ...(input.conversationId ? { whatsappFrom: input.conversationId } : {}),
  };
  await createOrder(order);
  if (input.conversationId) {
    await linkConversationOrder(input.conversationId, order.id).catch(() => {});
    await addNote(input.conversationId, `🛒 Pedido ${order.orderNumber} creado a mano${by ? ` por ${by}` : ''}: ${offer.name} de ${product.productName}.`).catch(() => {});
  }
  // A sale (it may come from a WhatsApp ad): Meta learns about it.
  await reportSale(order).catch((e) => console.error('Conversions API', e));
  return order;
}
