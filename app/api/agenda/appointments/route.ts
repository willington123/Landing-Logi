import { NextRequest } from 'next/server';
import { cloudEnabled } from '@/lib/server/db';
import { AgendaError, bookAppointment, getAgenda, listAppointments } from '@/lib/server/agenda';
import { addDays, zonedToUtc } from '@/lib/agenda';
import { fail, failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Appointments between two local dates (?from=2026-11-03&to=2026-11-09, both included).
export async function GET(req: NextRequest) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    const from = req.nextUrl.searchParams.get('from') || '';
    const to = req.nextUrl.searchParams.get('to') || from;
    if (!DATE.test(from) || !DATE.test(to) || to < from) return fail('Fechas inválidas.');
    const a = await getAgenda();
    const list = await listAppointments(zonedToUtc(from, '00:00', a.timezone).toISOString(), zonedToUtc(addDays(to, 1), '00:00', a.timezone).toISOString());
    return ok({ appointments: list });
  } catch (e) {
    return failFrom(e);
  }
}

// New appointment from the panel. Body: { serviceId, staffId?, date, time, customerName, phone, notes? }.
export async function POST(req: NextRequest) {
  if (!cloudEnabled()) return fail('La base de datos no está configurada.', 503);
  try {
    const b = await req.json().catch(() => ({}));
    const appointment = await bookAppointment({
      serviceId: String(b.serviceId || ''),
      staffId: String(b.staffId || '') || undefined,
      date: String(b.date || ''),
      time: String(b.time || ''),
      customerName: String(b.customerName || ''),
      phone: String(b.phone || ''),
      notes: String(b.notes || ''),
      source: 'panel',
    });
    return ok({ appointment });
  } catch (e) {
    if (e instanceof AgendaError) return fail(e.message);
    return failFrom(e);
  }
}
