import { NextRequest } from 'next/server';
import { db, patchOrderData, updateOrderStatus } from '@/lib/server/db';
import { getConversation, recordOutbound } from '@/lib/server/wa-store';
import { insideServiceWindow, listTemplates, sendMedia, sendTemplate, sendText, whatsappEnabled } from '@/lib/server/whatsapp';
import { GUIDE_PHOTO_PRESET, GUIDE_PRESET } from '@/lib/wa-templates';
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
async function guideTemplate(name = GUIDE_PRESET.name): Promise<{ status: string; lang: string } | null> {
  const list = await listTemplates().catch(() => []);
  const t = list.find((x) => x.name === name && x.status === 'APPROVED') || list.find((x) => x.name === name);
  return t ? { status: t.status, lang: t.language || 'es' } : null;
}
// Only photos uploaded to our own storage (the guide photo button).
const okPhoto = (v: unknown) => {
  const u = String(v ?? '').trim();
  return /^https:\/\/[^\s]+\/storage\/v1\/object\/public\/[^\s]+\/guides\/[^\s]+\.(jpg|png)$/i.test(u) || (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost[^\s]*\/guides\/[^\s]+\.(jpg|png)$/i.test(u)) ? u : null;
};

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
    const photoTpl = whatsapp && !canText ? await guideTemplate(GUIDE_PHOTO_PRESET.name) : null;
    return ok({
      message: await guideMessage(o, carrier, tracking),
      whatsapp,
      canText,
      // Outside the 24 h window the notice goes with the approved "aviso_guia" template (fixed text).
      template: tpl ? { status: tpl.status, preview: guideTemplateText(o, carrier, tracking) } : null,
      templateText: guideTemplateText(o, carrier, tracking),
      photoTemplate: photoTpl ? { status: photoTpl.status } : null,
      photo: o.guidePhoto || null,
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
    // Photo of the label: the one sent now, or the one already saved (null = remove it).
    const photo = b.photo === null ? null : okPhoto(b.photo) || (b.photo === undefined ? o.guidePhoto || null : null);
    if (b.photo && !okPhoto(b.photo)) return fail('La foto de la guía no es válida. Vuelve a subirla.');
    if (b.send && !message) return fail('Escribe el mensaje para el cliente.');

    await patchOrderData(o.id, { carrier: carrier || null, trackingNumber, guidePhoto: photo, guidePhotoPending: false, guideAt: new Date().toISOString(), ...(b.markShipped ? { shippedAt: new Date().toISOString() } : {}) });
    if (b.markShipped && o.status !== 'shipped' && o.status !== 'delivered') await updateOrderStatus(o.id, 'shipped');

    if (!b.send) return ok({ sent: false });
    const phone = chatOf(o);
    const chat = await getConversation(phone).catch(() => null);
    if (!(await whatsappEnabled())) return ok({ sent: false, error: 'La guía quedó guardada, pero WhatsApp no está conectado: no se envió el mensaje.' });
    if (!chat || !insideServiceWindow(chat.last_inbound_at)) {
      // Window closed: an approved template. With a photo, the one that carries it on top (if Meta approved it).
      const vars = guideVars(o, carrier, trackingNumber);
      const text = guideTemplateText(o, carrier, trackingNumber);
      const photoTpl = photo ? await guideTemplate(GUIDE_PHOTO_PRESET.name) : null;
      if (photo && photoTpl?.status === 'APPROVED') {
        const result = await sendTemplate(phone, { name: GUIDE_PHOTO_PRESET.name, lang: photoTpl.lang }, vars, photo);
        await recordOutbound({ phone, name: o.customerName, orderId: o.id, type: 'template', body: `📷 ${text}`, result, by: await whoAmI(), payload: { type: 'image', image: { link: photo } } });
        return result.ok ? ok({ sent: true, template: true, photo: true }) : ok({ sent: false, error: `La guía quedó guardada, pero la plantilla no salió: ${result.error || 'error de WhatsApp'}` });
      }
      const tpl = await guideTemplate();
      if (!tpl || tpl.status !== 'APPROVED')
        return ok({
          sent: false,
          error: tpl
            ? `La guía quedó guardada, pero la plantilla «${GUIDE_PRESET.name}» aún no está aprobada por Meta (${tpl.status}). Cuando la aprueben, podrás enviarla.`
            : 'La guía quedó guardada, pero el cliente no ha escrito en las últimas 24 horas: crea la plantilla «Aviso de guía» en Plantillas para poder avisarle.',
        });
      const result = await sendTemplate(phone, { name: GUIDE_PRESET.name, lang: tpl.lang }, vars);
      await recordOutbound({ phone, name: o.customerName, orderId: o.id, type: 'template', body: text, result, by: await whoAmI() });
      if (!result.ok) return ok({ sent: false, error: `La guía quedó guardada, pero la plantilla no salió: ${result.error || 'error de WhatsApp'}` });
      // The photo goes as soon as the customer writes (that opens the 24 h window).
      if (photo) await patchOrderData(o.id, { guidePhotoPending: true });
      return ok({ sent: true, template: true, photoLater: Boolean(photo) });
    }
    // Inside the window: the photo with the message as its caption, or just the message.
    const result = photo ? await sendMedia(phone, 'image', photo, { caption: message }) : await sendText(phone, message);
    await recordOutbound(
      photo
        ? { phone, name: o.customerName, orderId: o.id, type: 'image', body: `📷 ${message}`, result, by: await whoAmI(), payload: { type: 'image', image: { link: photo, caption: message } } }
        : { phone, name: o.customerName, orderId: o.id, type: 'text', body: message, result, by: await whoAmI() },
    );
    return result.ok ? ok({ sent: true }) : ok({ sent: false, error: `La guía quedó guardada, pero el mensaje no salió: ${result.error || 'error de WhatsApp'}` });
  } catch (e) {
    return failFrom(e);
  }
}
