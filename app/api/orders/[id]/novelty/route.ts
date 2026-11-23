import { NextRequest } from 'next/server';
import { db, patchOrderData } from '@/lib/server/db';
import { getConversation, recordOutbound } from '@/lib/server/wa-store';
import { insideServiceWindow, listTemplates, sendTemplate, sendText, whatsappEnabled } from '@/lib/server/whatsapp';
import { NOVELTY_PRESET, NOVELTY_REASONS, noveltyText } from '@/lib/wa-templates';
import { getAgents, myAgent } from '@/lib/server/crm-store';
import { getUser } from '@/lib/server/accounts';
import { sessionUserId } from '@/lib/server/tenant';
import { normalizePhone } from '@/lib/phone';
import { fail, failFrom, ok } from '@/lib/server/http';
import type { OrderItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

// "Avisar novedad": tells the customer about a delivery problem (pick up at the office, coordinate the delivery,
// incomplete address…). Inside the 24 h window it goes as an editable message; outside, with the approved
// "novedad_envio" template.

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const firstName = (n?: string) => ((n || '').trim().split(/\s+/)[0] || 'cliente').toLowerCase().replace(/^./, (x) => x.toUpperCase());
const chatOf = (o: OrderItem & { whatsapp?: { to?: string } }) => o.whatsapp?.to || o.whatsappFrom || normalizePhone(o.phone);

async function loadOrder(id: string): Promise<OrderItem | null> {
  const { data } = await (await db()).from('orders').select('data, status').eq('id', id).maybeSingle();
  return data ? { ...(data.data as OrderItem), status: data.status as OrderItem['status'] } : null;
}
async function noveltyTemplate(): Promise<{ status: string; lang: string } | null> {
  const list = await listTemplates().catch(() => []);
  const t = list.find((x) => x.name === NOVELTY_PRESET.name && x.status === 'APPROVED') || list.find((x) => x.name === NOVELTY_PRESET.name);
  return t ? { status: t.status, lang: t.language || 'es' } : null;
}
async function whoAmI() {
  const uid = sessionUserId();
  if (!uid) return undefined;
  const agent = await myAgent(await getAgents()).catch(() => null);
  if (agent) return { uid, name: agent.name };
  const user = await getUser(uid).catch(() => null);
  return { uid, name: (user?.name || user?.email?.split('@')[0] || 'Equipo').slice(0, 60) };
}

function vars(o: OrderItem, carrier: string, tracking: string, what: string): string[] {
  return [
    firstName(o.customerName),
    [o.productName, o.comboName].filter(Boolean).join(' - ').replace(/[\r\n\t]+/g, ' ') || 'tu compra',
    carrier || 'la transportadora',
    tracking || 'sin número',
    what,
  ];
}
const fill = (v: string[]) => NOVELTY_PRESET.body.replace(/\{\{(\d)\}\}/g, (_, i) => v[Number(i) - 1] || '');

// Preview: ?reason=…&detail=…&carrier=…
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const o = await loadOrder(params.id);
    if (!o) return fail('Pedido no encontrado.', 404);
    const q = req.nextUrl.searchParams;
    const what = noveltyText(clean(q.get('reason'), 20), clean(q.get('detail'), 300));
    const carrier = clean(q.get('carrier'), 60) || o.carrier || '';
    const chat = await getConversation(chatOf(o)).catch(() => null);
    const whatsapp = await whatsappEnabled();
    const canText = Boolean(chat && insideServiceWindow(chat.last_inbound_at));
    const tpl = whatsapp && !canText ? await noveltyTemplate() : null;
    return ok({ message: fill(vars(o, carrier, o.trackingNumber || '', what || '…')), whatsapp, canText, template: tpl ? { status: tpl.status } : null });
  } catch (e) {
    return failFrom(e);
  }
}

// Body: { reason, detail, carrier, message } — message is the edited text (used inside the 24 h window).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const o = await loadOrder(params.id);
    if (!o) return fail('Pedido no encontrado.', 404);
    const b = await req.json().catch(() => ({}));
    const reason = NOVELTY_REASONS.some((r) => r.id === b.reason) ? String(b.reason) : 'otro';
    const detail = clean(b.detail, 300);
    const what = noveltyText(reason, detail);
    if (!what) return fail('Escribe cuál es la novedad.');
    const carrier = clean(b.carrier, 60) || o.carrier || '';
    const message = clean(b.message, 1000);
    const by = await whoAmI();
    const novelty = { reason, detail, text: what, at: new Date().toISOString(), by: by?.name || null, sent: false as boolean, error: null as string | null };

    const phone = chatOf(o);
    const save = (patch: Partial<typeof novelty>) => patchOrderData(o.id, { novelty: { ...novelty, ...patch }, ...(carrier && !o.carrier ? { carrier } : {}) });
    if (!(await whatsappEnabled())) {
      await save({ error: 'WhatsApp no está conectado.' });
      return ok({ sent: false, error: 'La novedad quedó anotada, pero WhatsApp no está conectado: no se envió el mensaje.' });
    }
    const chat = await getConversation(phone).catch(() => null);
    if (chat && insideServiceWindow(chat.last_inbound_at)) {
      const text = message || fill(vars(o, carrier, o.trackingNumber || '', what));
      const result = await sendText(phone, text);
      await recordOutbound({ phone, name: o.customerName, orderId: o.id, type: 'text', body: text, result, by });
      await save({ sent: result.ok, error: result.ok ? null : result.error || 'error de WhatsApp' });
      return result.ok ? ok({ sent: true }) : ok({ sent: false, error: `La novedad quedó anotada, pero el mensaje no salió: ${result.error || 'error de WhatsApp'}` });
    }
    // Window closed: the approved template (fixed text).
    const tpl = await noveltyTemplate();
    if (!tpl || tpl.status !== 'APPROVED') {
      const error = tpl
        ? `La plantilla «${NOVELTY_PRESET.name}» aún no está aprobada por Meta (${tpl.status}). Cuando la aprueben, podrás enviarla.`
        : 'El cliente no ha escrito en las últimas 24 horas: crea la plantilla «Novedad de envío» en Plantillas para poder avisarle.';
      await save({ error });
      return ok({ sent: false, error: `La novedad quedó anotada. ${error}` });
    }
    const v = vars(o, carrier, o.trackingNumber || '', what);
    const result = await sendTemplate(phone, { name: NOVELTY_PRESET.name, lang: tpl.lang }, v);
    await recordOutbound({ phone, name: o.customerName, orderId: o.id, type: 'template', body: fill(v), result, by });
    await save({ sent: result.ok, error: result.ok ? null : result.error || 'error de WhatsApp' });
    return result.ok ? ok({ sent: true, template: true }) : ok({ sent: false, error: `La novedad quedó anotada, pero la plantilla no salió: ${result.error || 'error de WhatsApp'}` });
  } catch (e) {
    return failFrom(e);
  }
}
