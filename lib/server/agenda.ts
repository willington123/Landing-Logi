// Server side of "Negocio con citas": settings, appointments and free slots of the current store.
import { randomUUID } from 'crypto';
import { db } from '@/lib/server/db';
import { rawDb } from '@/lib/server/supabase';
import { access } from '@/lib/server/billing';
import { normalizePhone } from '@/lib/phone';
import {
  DEFAULT_AGENDA,
  addDays,
  freeSlots,
  localParts,
  zonedToUtc,
  type AgendaSettings,
  type Appointment,
  type AppointmentStatus,
  type Slot,
} from '@/lib/agenda';

export class AgendaError extends Error {
  userFacing = true;
}

// ---------- settings ----------

export async function getAgenda(): Promise<AgendaSettings> {
  const { data } = await (await db()).from('settings').select('data').eq('id', 'agenda').maybeSingle();
  return { ...DEFAULT_AGENDA, ...((data?.data as Partial<AgendaSettings>) || {}) };
}

export async function saveAgenda(a: AgendaSettings) {
  const { error } = await (await db()).from('settings').upsert({ id: 'agenda', data: a });
  if (error) throw new Error(error.message);
}

export async function isAppointmentsBusiness(): Promise<boolean> {
  return (await getAgenda().catch(() => DEFAULT_AGENDA)).businessType === 'appointments';
}

// ---------- appointments ----------

const ACTIVE: AppointmentStatus[] = ['pending', 'confirmed'];

function fromRow(r: any): Appointment {
  const d = (r.data || {}) as any;
  return {
    id: r.id,
    serviceId: r.service_id,
    staffId: r.staff_id,
    start: new Date(r.start_at).toISOString(),
    end: new Date(r.end_at).toISOString(),
    status: r.status,
    customerName: r.customer_name || '',
    phone: r.phone || '',
    notes: d.notes || undefined,
    source: d.source || undefined,
    reminders: d.reminders || undefined,
    createdAt: r.created_at,
  };
}

export async function listAppointments(fromIso: string, toIso: string): Promise<Appointment[]> {
  const { data, error } = await (await db()).from('appointments').select('*').gte('start_at', fromIso).lt('start_at', toIso).order('start_at', { ascending: true }).limit(2000);
  if (error) throw new Error(error.message);
  return (data || []).map(fromRow);
}

export async function getAppointment(id: string): Promise<Appointment | null> {
  if (!/^[\w-]{1,80}$/.test(id)) return null;
  const { data } = await (await db()).from('appointments').select('*').eq('id', id).maybeSingle();
  return data ? fromRow(data) : null;
}

// Upcoming (and today's) appointments of one customer, by WhatsApp number.
export async function appointmentsForPhone(phone: string, includePast = false): Promise<Appointment[]> {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return [];
  let q = (await db()).from('appointments').select('*').eq('phone', digits);
  if (!includePast) q = q.gte('end_at', new Date().toISOString());
  const { data, error } = await q.order('start_at', { ascending: true }).limit(50);
  if (error) throw new Error(error.message);
  return (data || []).map(fromRow);
}

// Appointments that block time (not cancelled) between two instants.
async function busyBetween(fromIso: string, toIso: string, exceptId?: string) {
  const { data, error } = await (await db())
    .from('appointments')
    .select('id, staff_id, start_at, end_at, status')
    .lt('start_at', toIso)
    .gt('end_at', fromIso)
    .in('status', ACTIVE)
    .limit(2000);
  if (error) throw new Error(error.message);
  return (data || []).filter((r: any) => r.id !== exceptId).map((r: any) => ({ staffId: r.staff_id, start: new Date(r.start_at).toISOString(), end: new Date(r.end_at).toISOString() }));
}

// Free slots on a local date ("2026-11-04").
export async function availability(a: AgendaSettings, serviceId: string, date: string, staffId?: string, exceptId?: string): Promise<Slot[]> {
  const from = zonedToUtc(date, '00:00', a.timezone).toISOString();
  const to = zonedToUtc(addDays(date, 1), '00:00', a.timezone).toISOString();
  return freeSlots(a, serviceId, date, await busyBetween(from, to, exceptId), { staffId });
}

// The next days that have free slots, starting at a date (default: today), at most `days` days with slots.
export async function nextAvailability(a: AgendaSettings, serviceId: string, opts: { from?: string; staffId?: string; days?: number } = {}) {
  const today = localParts(new Date(), a.timezone).date;
  let date = opts.from && opts.from > today ? opts.from : today;
  const out: { date: string; slots: Slot[] }[] = [];
  for (let i = 0; i < a.maxDaysAhead + 1 && out.length < (opts.days || 3); i++, date = addDays(date, 1)) {
    const slots = await availability(a, serviceId, date, opts.staffId);
    if (slots.length) out.push({ date, slots });
  }
  return out;
}

export interface BookInput {
  serviceId: string;
  staffId?: string; // empty = any professional free at that time
  date: string; // local "YYYY-MM-DD"
  time: string; // local "HH:MM"
  customerName: string;
  phone: string;
  notes?: string;
  source: Appointment['source'];
  status?: AppointmentStatus;
  country?: string;
}

// Books a slot if it's still free. Throws AgendaError with a message for the person otherwise.
export async function bookAppointment(input: BookInput, a?: AgendaSettings): Promise<Appointment> {
  const agenda = a || (await getAgenda());
  const service = agenda.services.find((s) => s.id === input.serviceId && s.active);
  if (!service) throw new AgendaError('Ese servicio no existe o no está activo.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.time)) throw new AgendaError('Fecha u hora inválida.');
  const name = String(input.customerName || '').trim().slice(0, 80);
  if (name.length < 2) throw new AgendaError('Falta el nombre del cliente.');
  const phone = normalizePhone(input.phone, input.country);
  if (phone.length < 8) throw new AgendaError('Falta un celular válido del cliente.');
  const slots = await availability(agenda, service.id, input.date, input.staffId || undefined);
  const slot = slots.find((s) => s.time === input.time);
  if (!slot) {
    const near = slots.slice(0, 6).map((s) => s.time);
    throw new AgendaError(near.length ? `Ese horario ya no está libre. Horarios libres ese día: ${near.join(', ')}.` : 'Ese día ya no hay horarios libres para ese servicio.');
  }
  const now = new Date().toISOString();
  const row = {
    id: `apt-${randomUUID().slice(0, 12)}`,
    service_id: service.id,
    staff_id: slot.staffId,
    start_at: slot.start,
    end_at: slot.end,
    status: input.status || 'pending',
    customer_name: name,
    phone,
    data: { notes: String(input.notes || '').trim().slice(0, 500) || undefined, source: input.source },
    created_at: now,
    updated_at: now,
  };
  const { error } = await (await db()).from('appointments').insert(row);
  if (error) throw new Error(error.message);
  // Two people booking the same minute: keep the first one.
  const clash = (await busyBetween(slot.start, slot.end, row.id)).filter((b) => b.staffId === slot.staffId);
  if (clash.length) {
    await (await db()).from('appointments').delete().eq('id', row.id);
    throw new AgendaError('Ese horario se acaba de ocupar. Elige otro, por favor.');
  }
  return fromRow(row);
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus): Promise<Appointment | null> {
  const cur = await getAppointment(id);
  if (!cur) return null;
  const { error } = await (await db()).from('appointments').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  return { ...cur, status };
}

// Moves an appointment to another free slot (same service).
export async function rescheduleAppointment(id: string, date: string, time: string, staffId?: string): Promise<Appointment> {
  const cur = await getAppointment(id);
  if (!cur || !ACTIVE.includes(cur.status)) throw new AgendaError('Esa cita no existe o ya no está activa.');
  const agenda = await getAgenda();
  const slots = await availability(agenda, cur.serviceId, date, staffId || undefined, cur.id);
  const slot = slots.find((s) => s.time === time);
  if (!slot) {
    const near = slots.slice(0, 6).map((s) => s.time);
    throw new AgendaError(near.length ? `Ese horario no está libre. Horarios libres ese día: ${near.join(', ')}.` : 'Ese día no hay horarios libres para ese servicio.');
  }
  const { data: row } = await (await db()).from('appointments').select('data').eq('id', id).maybeSingle();
  const data = { ...((row?.data as object) || {}), reminders: {} }; // new time: reminders go out again
  const { error } = await (await db())
    .from('appointments')
    .update({ start_at: slot.start, end_at: slot.end, staff_id: slot.staffId, status: 'pending', data, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  return { ...cur, start: slot.start, end: slot.end, staffId: slot.staffId, status: 'pending', reminders: {} };
}

export async function patchAppointmentData(id: string, patch: Record<string, unknown>) {
  const { data: row } = await (await db()).from('appointments').select('data').eq('id', id).maybeSingle();
  if (!row) return;
  await (await db()).from('appointments').update({ data: { ...(row.data as object), ...patch }, updated_at: new Date().toISOString() }).eq('id', id);
}

// ---------- public booking page ----------

// The store whose booking page is konnexa.lat/citas/<slug> (only if it is on and the store can sell).
export async function findBookingPage(slug: string): Promise<{ orgId: string; agenda: AgendaSettings } | null> {
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const { data, error } = await rawDb().from('settings').select('org_id, data').eq('id', 'agenda').eq('data->>bookingSlug', slug).limit(1);
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  const agenda = { ...DEFAULT_AGENDA, ...(row.data as Partial<AgendaSettings>) };
  if (!agenda.bookingEnabled || agenda.businessType !== 'appointments') return null;
  if ((await access(row.org_id as string)).landingsOff) return null;
  return { orgId: row.org_id as string, agenda };
}

// Another store already uses this booking address.
export async function bookingSlugTaken(slug: string, orgId: string): Promise<boolean> {
  if (!slug) return false;
  const { data } = await rawDb().from('settings').select('org_id').eq('id', 'agenda').eq('data->>bookingSlug', slug).limit(5);
  return (data || []).some((r: any) => r.org_id !== orgId);
}
