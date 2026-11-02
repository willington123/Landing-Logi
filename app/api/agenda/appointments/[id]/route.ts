import { NextRequest } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { AgendaError, rescheduleAppointment, setAppointmentStatus } from '@/lib/server/agenda';
import { APPOINTMENT_STATUSES } from '@/lib/agenda';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Body: { status } to mark it (confirmada, asistió, no llegó, cancelada) or { date, time, staffId? } to move it.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    const b = await req.json().catch(() => ({}));
    if (b.status !== undefined) {
      if (!APPOINTMENT_STATUSES.includes(b.status)) return fail('Estado inválido.');
      const appointment = await setAppointmentStatus(params.id, b.status);
      if (!appointment) return fail('Cita no encontrada.', 404);
      return ok({ appointment });
    }
    const appointment = await rescheduleAppointment(params.id, String(b.date || ''), String(b.time || ''), String(b.staffId || '') || undefined);
    return ok({ appointment });
  } catch (e) {
    if (e instanceof AgendaError) return fail(e.message);
    return failFrom(e);
  }
}
