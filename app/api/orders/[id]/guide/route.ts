import { NextRequest } from 'next/server';
import { db, patchOrderData, updateOrderStatus } from '@/lib/server/db';
import { getConversation, recordOutbound } from '@/lib/server/wa-store';
import { insideServiceWindow, sendText, whatsappEnabled } from '@/lib/server/whatsapp';
import { getAgents, getQuickReplies, myAgent } from '@/lib/server/crm-store';
import { getFlows } from '@/lib/server/flows';
import { getUser } from '@/lib/server/accounts';
import { sessionUserId } from '@/lib/server/tenant';
import { normalizePhone } from '@/lib/phone';
import { DEFAULT_QUICK_REPLIES, fillQuickReply } from '@/lib/crm';
import { fail, failFrom, ok } from '@/lib/server/http';
import type { OrderItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

async function loadOrder(id: string): Promise<OrderItem | null> {
  const { data } = await (await db()).from('orders').select('data, status').eq('id', id).maybeSingle();
  return data ? { ...(data.data as OrderItem), status: data.status as OrderItem['status'] } : null;
}

// The customer's WhatsApp chat for this order.
const chatOf = (o: OrderItem & { whatsapp?: { to?: string } }) => o.whatsapp?.to || o.whatsappFrom || normalizePhone(o.phone);

// The store's "guía" quick reply (or the default one), filled with this order.
async function guideMessage(o: OrderItem, carrier: string, trackingNumber: string) {
  const replies = await getQuickReplies().catch(() => DEFAULT_QUICK_REPLIES);
  const body = (replies.find((r) => r.shortcut === 'guia') || DEFAULT_QUICK_REPLIES.find((r) => r.shortcut === 'guia')!).body;
  return fillQuickReply(body, {
    nombre: ((o.customerName || '').trim().split(/\s+/)[0] || '').replace(/^./, (x) => x.toUpperCase()),
    pedido: '', // the tracking notice doesn't show the order number (also when the store's own text has {pedido})
    producto: [o.productName, o.comboName].filter(Boolean).join(' - '),
    total: `$${(o.totalAmount || 0).toLocaleString('es-CO')}`,
    ciudad: o.city,
    direccion: o.address,
    transportadora: carrier,
    guia: trackingNumber,
  });
}

async function whoAmI() {
  const uid = sessionUserId();
  if (!uid) return undefined;
  const agent = await myAgent(await getAgents()).catch(() => null);
  if (agent) return { uid, name: agent.name };
  const user = await getUser(uid).catch(() => null);
  return { uid, name: (user?.name || user?.email?.split('@')[0] || 'Equipo').slice(0, 60) };
}

// Before saving: the message the customer would get, and whether WhatsApp lets us send it now.
// ?carrier=…&tracking=…
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const o = await loadOrder(params.id);
    if (!o) return fail('Pedido no encontrado.', 404);
    const carrier = clean(req.nextUrl.searchParams.get('carrier'), 60);
    const tracking = clean(req.nextUrl.searchParams.get('tracking'), 60);
    const chat = await getConversation(chatOf(o)).catch(() => null);
    const flows = await getFlows().catch(() => []);
    return ok({
      message: await guideMessage(o, carrier, tracking),
      whatsapp: await whatsappEnabled(),
      canText: Boolean(chat && insideServiceWindow(chat.last_inbound_at)),
      // The store's own "Aviso de envío" flow also writes when the order is marked as shipped.
      shippedFlow: flows.some((f) => f.enabled && f.trigger?.type === 'order_status' && (f.trigger as { status?: string }).status === 'shipped'),
    });
  } catch (e) {
    return failFrom(e);
  }
}

// Saves the tracking number; optionally marks the order as shipped and sends the confirmed message.
// Body: { carrier, trackingNumber, markShipped, send, message }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const o = await loadOrder(params.id);
    if (!o) return fail('Pedido no encontrado.', 404);
    const b = await req.json().catch(() => ({}));
    const carrier = clean(b.carrier, 60);
    const trackingNumber = clean(b.trackingNumber, 60);
    if (!trackingNumber) return fail('Escribe el número de guía.');
    const message = clean(b.message, 1000);
    if (b.send && !message) return fail('Escribe el mensaje para el cliente.');

    await patchOrderData(o.id, { carrier: carrier || null, trackingNumber, guideAt: new Date().toISOString(), ...(b.markShipped ? { shippedAt: new Date().toISOString() } : {}) });
    if (b.markShipped && o.status !== 'shipped' && o.status !== 'delivered') await updateOrderStatus(o.id, 'shipped');

    if (!b.send) return ok({ sent: false });
    const phone = chatOf(o);
    const chat = await getConversation(phone).catch(() => null);
    if (!(await whatsappEnabled())) return ok({ sent: false, error: 'La guía quedó guardada, pero WhatsApp no está conectado: no se envió el mensaje.' });
    if (!chat || !insideServiceWindow(chat.last_inbound_at))
      return ok({ sent: false, error: 'La guía quedó guardada, pero el cliente no ha escrito en las últimas 24 horas: WhatsApp no deja enviarle texto libre (solo una plantilla aprobada).' });
    const result = await sendText(phone, message);
    await recordOutbound({ phone, name: o.customerName, orderId: o.id, type: 'text', body: message, result, by: await whoAmI() });
    return result.ok ? ok({ sent: true }) : ok({ sent: false, error: `La guía quedó guardada, pero el mensaje no salió: ${result.error || 'error de WhatsApp'}` });
  } catch (e) {
    return failFrom(e);
  }
}
