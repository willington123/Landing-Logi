// Sending Konnexa orders to Dropi: on their own when they get confirmed (if the store turned it on) or with the button.
import { db } from '@/lib/server/db';
import { DropiError, createDropiOrder, dropiConfig, type DropiOrderState } from '@/lib/server/dropi';
import type { OrderItem } from '@/lib/types';

const SENDABLE = new Set(['confirmed_by_voice', 'shipped', 'delivered']);

async function readOrder(id: string): Promise<OrderItem | null> {
  const { data } = await (await db()).from('orders').select('data, status').eq('id', id).maybeSingle();
  return data ? { ...(data.data as OrderItem), status: data.status as OrderItem['status'] } : null;
}
async function patchDropi(id: string, state: DropiOrderState) {
  const d = await db();
  const { data: row } = await d.from('orders').select('data').eq('id', id).maybeSingle();
  if (!row) return;
  await d.from('orders').update({ data: { ...(row.data as object), dropi: state } }).eq('id', id);
}

export type SendResult = { ok: true; dropiOrderId: number | string | null; already?: boolean } | { ok: false; error: string };

export async function sendOrderToDropi(orderId: string, opts: { force?: boolean } = {}): Promise<SendResult> {
  const cfg = await dropiConfig();
  if (!cfg) return { ok: false, error: 'Conecta Dropi primero (Integraciones → Dropi).' };
  const order = await readOrder(orderId);
  if (!order) return { ok: false, error: 'Pedido no encontrado.' };
  const prev = (order as any).dropi as DropiOrderState | undefined;
  if (prev?.orderId && !opts.force) return { ok: true, dropiOrderId: prev.orderId, already: true };
  if (prev?.sending && Date.now() - new Date(prev.sending).getTime() < 90_000) return { ok: false, error: 'Este pedido se está enviando a Dropi. Espera un momento.' };
  if (order.status === 'cancelled') return { ok: false, error: 'El pedido está cancelado.' };
  const link = order.landingPageId ? cfg.links[order.landingPageId] : undefined;
  const fail = async (error: string) => {
    await patchDropi(orderId, { ...(prev || {}), sending: undefined, error, at: new Date().toISOString() });
    return { ok: false as const, error };
  };
  if (!link) return fail(`El producto "${order.productName}" no está vinculado a un producto de Dropi. Vincúlalo en Integraciones → Dropi.`);
  if (link.type === 'VARIABLE' && !link.variationId) return fail(`Elige la variante de Dropi para "${order.productName}" (Integraciones → Dropi).`);
  if (!order.address || !order.city) return fail('Al pedido le falta la dirección o la ciudad.');
  await patchDropi(orderId, { ...(prev || {}), sending: new Date().toISOString() });
  try {
    const id = await createDropiOrder(cfg.token, order, link);
    await patchDropi(orderId, { orderId: id, sentAt: new Date().toISOString(), error: null });
    return { ok: true, dropiOrderId: id };
  } catch (e: any) {
    return fail(e instanceof DropiError ? `Dropi: ${e.message}` : 'No pudimos enviar el pedido a Dropi.');
  }
}

// Called after an order changes status. Never throws.
export async function autoSendToDropi(order: OrderItem, from?: string) {
  try {
    if (!SENDABLE.has(order.status) || (from && SENDABLE.has(from))) return;
    if ((order as any).dropi?.orderId) return;
    const cfg = await dropiConfig();
    if (!cfg?.autoSend) return;
    await sendOrderToDropi(order.id);
  } catch (e) {
    console.error('Dropi:', e);
  }
}
