// Appointment reminders (24 h and 2 h before) with "Confirmar cita" / "Cancelar cita", and what happens when the
// customer taps them. Inside WhatsApp's 24 h window the reminder is a free message with buttons; outside it, the
// store's approved reminder template.
import { db } from '@/lib/server/db';
import { getAgenda, getAppointment, isAppointmentsBusiness, listAppointments, patchAppointmentData, setAppointmentStatus } from '@/lib/server/agenda';
import { insideServiceWindow, sendAppointmentTemplate, sendButtons, sendText, whatsappEnabled, type InboundMessage, type SendResult } from '@/lib/server/whatsapp';
import { recordOutbound } from '@/lib/server/wa-store';
import { addNote } from '@/lib/server/crm-store';
import { formatWhen, type AgendaSettings, type Appointment } from '@/lib/agenda';

const H = 3600000;
const firstName = (n: string) => (n || '').trim().split(/\s+/)[0] || 'hola';

async function lastInbound(phone: string): Promise<string | null> {
  const { data } = await (await db()).from('wa_conversations').select('last_inbound_at').eq('id', phone).maybeSingle();
  return (data as any)?.last_inbound_at || null;
}

function texts(a: AgendaSettings, x: Appointment) {
  const service = a.services.find((s) => s.id === x.serviceId)?.name || 'tu cita';
  const staff = a.staff.find((p) => p.id === x.staffId)?.name;
  const when = formatWhen(x.start, a.timezone);
  const where = [staff && `con ${staff}`, a.address && `en ${a.address}`].filter(Boolean).join(' ') || 'con nosotros';
  return { service, when, where };
}

// Sends one reminder. Free message with buttons inside the 24 h window, template otherwise.
async function remind(a: AgendaSettings, x: Appointment, kind: 'r24' | 'r2'): Promise<SendResult> {
  const t = texts(a, x);
  const name = firstName(x.customerName);
  const inWindow = insideServiceWindow(await lastInbound(x.phone));
  let result: SendResult;
  let body: string;
  if (inWindow && x.status === 'confirmed' && kind === 'r2') {
    body = `Hola ${name} 👋 Te esperamos ${t.when.split(', ').pop()} para tu cita de ${t.service} ${t.where}.`;
    result = await sendText(x.phone, body);
  } else if (inWindow) {
    body = `Hola ${name} 👋 Te recordamos tu cita de ${t.service} el ${t.when} ${t.where}. ¿Confirmas que asistes?`;
    result = await sendButtons(x.phone, body, [
      { id: `appt_confirm:${x.id}`, title: 'Confirmar cita' },
      { id: `appt_cancel:${x.id}`, title: 'Cancelar cita' },
    ]);
  } else {
    body = `Recordatorio de cita: ${t.service}, ${t.when}, ${t.where}.`;
    result = await sendAppointmentTemplate(x.phone, { name: a.reminderTemplate, lang: a.templateLang }, [name, t.service, t.when, t.where], x.id);
  }
  await recordOutbound({ phone: x.phone, name: x.customerName, type: inWindow ? 'reminder' : 'template', body, result, auto: true }).catch(() => {});
  return result;
}

export async function processAppointmentReminders(now = new Date(), deadline = Date.now() + 40000): Promise<{ sent: number; failed: number }> {
  const out = { sent: 0, failed: 0 };
  if (!(await isAppointmentsBusiness()) || !(await whatsappEnabled())) return out;
  const a = await getAgenda();
  if (!a.reminder24h && !a.reminder2h) return out;
  const list = (await listAppointments(now.toISOString(), new Date(now.getTime() + 25 * H).toISOString())).filter(
    (x) => (x.status === 'pending' || x.status === 'confirmed') && x.phone,
  );
  for (const x of list) {
    if (Date.now() > deadline) break;
    const left = new Date(x.start).getTime() - now.getTime();
    const age = x.createdAt ? now.getTime() - new Date(x.createdAt).getTime() : Infinity;
    const rem = x.reminders || {};
    let kind: 'r24' | 'r2' | null = null;
    // A reminder right after booking is noise: skip it if the appointment was made shortly before.
    if (a.reminder2h && !rem.r2 && left <= 2 * H && left > 15 * 60000) kind = age > 2 * H ? 'r2' : null;
    else if (a.reminder24h && !rem.r24 && left <= 24 * H && left > 3 * H) kind = age > 6 * H ? 'r24' : null;
    if (!kind) continue;
    // Mark it first, so an overlapping run never sends it twice.
    await patchAppointmentData(x.id, { reminders: { ...rem, [kind]: now.toISOString() } });
    const r = await remind(a, x, kind).catch((e) => ({ ok: false, error: String(e?.message || e) }) as SendResult);
    if (r.ok) out.sent++;
    else {
      out.failed++;
      await patchAppointmentData(x.id, { reminders: { ...rem, [kind]: now.toISOString() }, reminderError: r.error || 'no se pudo enviar' });
    }
  }
  return out;
}

// The customer tapped "Confirmar cita" or "Cancelar cita".
export async function appointmentButton(m: InboundMessage & { appt: NonNullable<InboundMessage['appt']> }) {
  const x = await getAppointment(m.appt.id);
  const say = async (text: string) => recordOutbound({ phone: m.from, type: 'text', body: text, result: await sendText(m.from, text) });
  if (!x || x.phone !== m.from || (x.status !== 'pending' && x.status !== 'confirmed')) {
    await say('Esa cita ya no está activa. Si quieres agendar otra, escríbenos por aquí.');
    return;
  }
  const a = await getAgenda();
  const t = texts(a, x);
  if (m.appt.action === 'confirm') {
    await setAppointmentStatus(x.id, 'confirmed');
    await say(`¡Listo, ${firstName(x.customerName)}! Tu cita de ${t.service} quedó confirmada para el ${t.when}. Te esperamos ✅`);
    await addNote(m.from, `✅ El cliente confirmó su cita de ${t.service} (${t.when}).`).catch(() => {});
  } else {
    await setAppointmentStatus(x.id, 'cancelled');
    await say(`Listo, ${firstName(x.customerName)}. Cancelamos tu cita de ${t.service} del ${t.when}. Si quieres, te ayudamos a buscar otro horario: escríbenos por aquí.`);
    await addNote(m.from, `❌ El cliente canceló su cita de ${t.service} (${t.when}).`).catch(() => {});
  }
}
