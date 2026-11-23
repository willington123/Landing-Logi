import { NextRequest } from 'next/server';
import { db, patchOrderData } from '@/lib/server/db';
import { getConversation, recordOutbound } from '@/lib/server/wa-store';
import { insideServiceWindow, listTemplates, sendTemplate, sendText, whatsappEnabled } from '@/lib/server/whatsapp';
import { NOVELTY_PRESET, noveltyMessage, noveltyTemplateText, noveltyVars, oneLine, type NoveltyFields } from '@/lib/wa-templates';
import { getAgents, myAgent } from '@/lib/server/crm-store';
import { getUser } from '@/lib/server/accounts';
import { sessionUserId } from '@/lib/server/tenant';
import { normalizePhone } from '@/lib/phone';
import { fail, failFrom, ok } from '@/lib/server/http';
import type { OrderItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

// "Avisar novedad": tells the customer about a delivery problem with the carrier's data (name, where to pick it up,
// phone, tracking number, the carrier's novelty). Inside the 24 h window it goes as an editable message; outside,
// with the approved "aviso_novedad" template.

const firstName = (n?: string) => ((n || '').trim().split(/\s+/)[0] || 'cliente').toLowerCase().replace(/^./, (x) => x.toUpperCase());
const chatOf = (o: OrderItem & { whatsapp?: { to?: string } }) => o.whatsapp?.to || o.whatsappFrom || normalizePhone(o.phone);
const KEYS: (keyof NoveltyFields)[] = ['summary', 'name', 'where', 'phone', 'guide', 'novelty', 'carrier'];

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

// The fields sent by the panel, with the order's data where they're empty.
function fieldsOf(raw: Record<string, unknown>, o: OrderItem): NoveltyFields {
  const f = Object.fromEntries(KEYS.map((k) => [k, String(raw[k] ?? '').trim().slice(0, 300)])) as unknown as NoveltyFields;
  return {
    ...f,
    name: f.name || (o.customerName || '').trim(),
    phone: f.phone || (o.phone || '').trim(),
    guide: f.guide || o.trackingNumber || '',
    carrier: f.carrier || o.carrier || '',
  };
}

// Preview: ?f=<json of the fields>
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const o = await loadOrder(params.id);
    if (!o) return fail('Pedido no encontrado.', 404);
    let raw: Record<string, unknown> = {};
    try {
      raw = JSON.parse(req.nextUrl.searchParams.get('f') || '{}');
    } catch {}
    const f = fieldsOf(raw, o);
    const chat = await getConversation(chatOf(o)).catch(() => null);
    const whatsapp = await whatsappEnabled();
    const canText = Boolean(chat && insideServiceWindow(chat.last_inbound_at));
    const tpl = whatsapp && !canText ? await noveltyTemplate() : null;
    const name = firstName(o.customerName);
    return ok({ message: canText ? noveltyMessage(name, f) : noveltyTemplateText(name, f), whatsapp, canText, template: tpl ? { status: tpl.status } : null });
  } catch (e) {
    return failFrom(e);
  }
}

// Body: { fields, message } — message is the edited text (used inside the 24 h window).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const o = await loadOrder(params.id);
    if (!o) return fail('Pedido no encontrado.', 404);
    const b = await req.json().catch(() => ({}));
    const f = fieldsOf(b.fields || {}, o);
    if (!oneLine(f.summary) && !oneLine(f.novelty)) return fail('Escribe cuál es la novedad.');
    const message = String(b.message ?? '').trim().slice(0, 1500);
    const by = await whoAmI();
    const name = firstName(o.customerName);
    const novelty = { reason: 'carrier', fields: f, text: oneLine(f.summary) || oneLine(f.novelty), at: new Date().toISOString(), by: by?.name || null, sent: false as boolean, error: null as string | null };

    const phone = chatOf(o);
    const save = (patch: Partial<typeof novelty>) => patchOrderData(o.id, { novelty: { ...novelty, ...patch }, ...(f.carrier && !o.carrier ? { carrier: f.carrier } : {}) });
    if (!(await whatsappEnabled())) {
      await save({ error: 'WhatsApp no está conectado.' });
      return ok({ sent: false, error: 'La novedad quedó anotada, pero WhatsApp no está conectado: no se envió el mensaje.' });
    }
    const chat = await getConversation(phone).catch(() => null);
    if (chat && insideServiceWindow(chat.last_inbound_at)) {
      const text = message || noveltyMessage(name, f);
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
        : 'El cliente no ha escrito en las últimas 24 horas: crea la plantilla «Aviso de novedad» en Plantillas para poder avisarle.';
      await save({ error });
      return ok({ sent: false, error: `La novedad quedó anotada. ${error}` });
    }
    const result = await sendTemplate(phone, { name: NOVELTY_PRESET.name, lang: tpl.lang }, noveltyVars(name, f));
    await recordOutbound({ phone, name: o.customerName, orderId: o.id, type: 'template', body: noveltyTemplateText(name, f), result, by });
    await save({ sent: result.ok, error: result.ok ? null : result.error || 'error de WhatsApp' });
    return result.ok ? ok({ sent: true, template: true }) : ok({ sent: false, error: `La novedad quedó anotada, pero la plantilla no salió: ${result.error || 'error de WhatsApp'}` });
  } catch (e) {
    return failFrom(e);
  }
}
