import { NextRequest } from 'next/server';
import { db, patchOrderData, updateOrderStatus } from '@/lib/server/db';
import { getConversation, recordOutbound } from '@/lib/server/wa-store';
import { insideServiceWindow, listTemplates, sendTemplate, sendText, whatsappEnabled } from '@/lib/server/whatsapp';
import { GUIDE_PRESET } from '@/lib/wa-templates';
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

// The store's "aviso_guia" template and its state in Meta (APPROVED, PENDING, REJECTED…), or null if not created.
async function guideTemplate(): Promise<{ status: string; lang: string } | null> {
  const list = await listTemplates().catch(() => []);
  const t = list.find((x) => x.name === GUIDE_PRESET.name && x.status === 'APPROVED') || list.find((x) => x.name === GUIDE_PRESET.name);
  return t ? { status: t.status, lang: t.language || 'es' } : null;
}

const firstName = (n?: string) => ((n || '').trim().split(/\s+/)[0] || 'cliente').replace(/^./, (x) => x.toUpperCase());

const guideVars = (o: OrderItem, carrier: string, tracking: string): string[] => [
  firstName(o.customerName),
  [o.productName, o.comboName].filter(Boolean).join(' - ') || 'tu compra',
  carrier || 'la transportadora',
  tracking,
];
const guideTemplateText = (o: OrderItem, carrier: string, tracking: string) => {
  const v = guideVars(o, carrier, tracking);
  return GUIDE_PRESET.body.replace(/\{\{(\d)\}\}/g, (_, i) => v[Number(i) - 1] || '');
};

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
    const whatsapp = await whatsappEnabled();
    const canText = Boolean(chat && insideServiceWindow(chat.last_inbound_at));
    const tpl = whatsapp && !canText ? await guideTemplate() : null;
    return ok({
      message: await guideMessage(o, carrier, tracking),
      whatsapp,
      canText,
      // Outside the 24 h window the notice goes with the approved "aviso_guia" template (fixed text).
      template: tpl ? { status: tpl.status, preview: guideTemplateText(o, carrier, tracking) } : null,
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
    if (!chat || !insideServiceWindow(chat.last_inbound_at)) {
      // Window closed: the approved "aviso_guia" template.
      const tpl = await guideTemplate();
      if (!tpl || tpl.status !== 'APPROVED')
        return ok({
          sent: false,
          error: tpl
            ? `La guía quedó guardada, pero la plantilla «${GUIDE_PRESET.name}» aún no está aprobada por Meta (${tpl.status}). Cuando la aprueben, podrás enviarla.`
            : 'La guía quedó guardada, pero el cliente no ha escrito en las últimas 24 horas: crea la plantilla «Aviso de guía» en Plantillas para poder avisarle.',
        });
      const vars = guideVars(o, carrier, trackingNumber);
      const result = await sendTemplate(phone, { name: GUIDE_PRESET.name, lang: tpl.lang }, vars);
      await recordOutbound({ phone, name: o.customerName, orderId: o.id, type: 'template', body: guideTemplateText(o, carrier, trackingNumber), result, by: await whoAmI() });
      return result.ok ? ok({ sent: true, template: true }) : ok({ sent: false, error: `La guía quedó guardada, pero la plantilla no salió: ${result.error || 'error de WhatsApp'}` });
    }
    const result = await sendText(phone, message);
    await recordOutbound({ phone, name: o.customerName, orderId: o.id, type: 'text', body: message, result, by: await whoAmI() });
    return result.ok ? ok({ sent: true }) : ok({ sent: false, error: `La guía quedó guardada, pero el mensaje no salió: ${result.error || 'error de WhatsApp'}` });
  } catch (e) {
    return failFrom(e);
  }
}
