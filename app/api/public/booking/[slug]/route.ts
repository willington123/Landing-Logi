import { NextRequest } from 'next/server';
import { cloudEnabled, getSettings } from '@/lib/server/db';
import { runWithOrg } from '@/lib/server/tenant';
import { AgendaError, appointmentsForPhone, bookAppointment, findBookingPage, patchAppointmentData } from '@/lib/server/agenda';
import { sendAppointmentTemplate, whatsappEnabled } from '@/lib/server/whatsapp';
import { recordOutbound } from '@/lib/server/wa-store';
import { waConfig } from '@/lib/server/integrations';
import { formatWhen, type AgendaSettings, type Appointment } from '@/lib/agenda';
import { validateName, validatePhone } from '@/lib/order-form';
import { normalizePhone } from '@/lib/phone';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const notFound = () => fail('Esta página de reservas no existe o está apagada.', 404);

// What the booking page shows: business, services, professionals and policies (no customer data).
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    const page = await findBookingPage(params.slug);
    if (!page) return notFound();
    const a = page.agenda;
    return await runWithOrg(page.orgId, async () => {
      const [settings, wa] = await Promise.all([getSettings<{ storeName?: string }>().catch(() => null), waConfig().catch(() => null)]);
      return ok({
        business: {
          name: settings?.storeName?.trim() || 'Reserva tu cita',
          address: a.address,
          policies: a.policies,
          whatsapp: (wa?.displayPhone || '').replace(/\D/g, '') || null,
          timezone: a.timezone,
          maxDaysAhead: a.maxDaysAhead,
        },
        services: a.services.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, price: s.price, description: s.description || '' })),
        staff: a.staff.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, serviceIds: p.serviceIds })),
      });
    });
  } catch (e) {
    return failFrom(e);
  }
}

// Confirmation by WhatsApp right after booking (the reminder template, with Confirmar / Cancelar).
async function notify(a: AgendaSettings, x: Appointment) {
  if (!(await whatsappEnabled())) return;
  const service = a.services.find((s) => s.id === x.serviceId)?.name || 'tu cita';
  const staff = a.staff.find((p) => p.id === x.staffId)?.name;
  const where = [staff && `con ${staff}`, a.address && `en ${a.address}`].filter(Boolean).join(' ') || 'con nosotros';
  const when = formatWhen(x.start, a.timezone);
  const result = await sendAppointmentTemplate(x.phone, { name: a.reminderTemplate, lang: a.templateLang }, [x.customerName.split(/\s+/)[0], service, when, where], x.id);
  await recordOutbound({ phone: x.phone, name: x.customerName, type: 'template', body: `Cita agendada desde la página de reservas: ${service}, ${when}, ${where}.`, result, auto: true }).catch(() => {});
  await patchAppointmentData(x.id, { bookedNotice: { ok: result.ok, error: result.error || null, at: new Date().toISOString() } });
}

// Book from the page. Body: { serviceId, staffId?, date, time, name, phone, notes?, website (honeypot) }.
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    const page = await findBookingPage(params.slug);
    if (!page) return notFound();
    const b = await req.json().catch(() => ({}));
    if (b.website) return fail('No se pudo agendar.'); // bots fill hidden fields
    const name = String(b.name || '').trim().slice(0, 80);
    const phone = String(b.phone || '').trim().slice(0, 30);
    const invalid = validateName(name) || validatePhone(phone, 'Colombia');
    if (invalid) return fail(invalid);
    return await runWithOrg(page.orgId, async () => {
      const digits = normalizePhone(phone, 'Colombia');
      const upcoming = (await appointmentsForPhone(digits)).filter((x) => x.status === 'pending' || x.status === 'confirmed');
      if (upcoming.length >= 3) return fail('Ya tienes 3 citas próximas con este número. Si necesitas otra, escríbenos por WhatsApp.');
      const appointment = await bookAppointment(
        { serviceId: String(b.serviceId || ''), staffId: String(b.staffId || '') || undefined, date: String(b.date || ''), time: String(b.time || ''), customerName: name, phone, notes: String(b.notes || ''), source: 'page', country: 'Colombia' },
        page.agenda,
      );
      await notify(page.agenda, appointment).catch((e) => console.error('Reserva: no se envió la confirmación', e));
      return ok({ appointment: { id: appointment.id, start: appointment.start, staffId: appointment.staffId, serviceId: appointment.serviceId } });
    });
  } catch (e) {
    if (e instanceof AgendaError) return fail(e.message);
    return failFrom(e);
  }
}
