// "Negocio con citas": services, professionals with schedules, appointments and free slots.
// Shared by the panel and the server (no database access here).

export type BusinessType = 'store' | 'appointments';

export interface AgendaService {
  id: string;
  name: string; // "Corte + barba"
  durationMin: number; // 45
  price: number; // 35000 (0 = a consultar)
  description?: string;
  active: boolean;
  returnAfterDays?: number; // "vuelve pronto": write to the customer this many days after an attended appointment (0 = never)
}

export interface TimeRange {
  start: string; // "09:00"
  end: string; // "13:00"
}

export interface AgendaStaff {
  id: string;
  name: string;
  serviceIds: string[]; // empty = all services
  schedule: Record<string, TimeRange[]>; // "0" (domingo) … "6" (sábado)
  daysOff: string[]; // "2026-12-24"
  active: boolean;
}

export interface AgendaSettings {
  businessType: BusinessType;
  timezone: string;
  address: string; // where the appointment is
  policies: string; // cancellations, arrival, payment… (the assistant tells customers)
  slotStepMin: number; // 15 | 30 | 60: how often a slot can start
  minNoticeMin: number; // book at least this long in advance
  maxDaysAhead: number;
  reminder24h: boolean;
  reminder2h: boolean;
  reminderTemplate: string; // approved WhatsApp template with "Confirmar cita" / "Cancelar cita"
  templateLang: string;
  services: AgendaService[];
  staff: AgendaStaff[];
  bookingEnabled: boolean; // public booking page konnexa.lat/citas/<bookingSlug>
  bookingSlug: string;
  comeBackEnabled: boolean; // "vuelve pronto" messages (marketing template)
  comeBackTemplate: string;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export const APPOINTMENT_STATUSES: AppointmentStatus[] = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'];
export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: 'Agendada',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  completed: 'Asistió',
  no_show: 'No llegó',
};

export interface Appointment {
  id: string;
  serviceId: string;
  staffId: string;
  start: string; // ISO (UTC)
  end: string;
  status: AppointmentStatus;
  customerName: string;
  phone: string;
  notes?: string;
  source?: 'whatsapp_bot' | 'panel' | 'page';
  reminders?: { r24?: string; r2?: string }; // when each reminder went out
  createdAt?: string;
}

const WEEK: Record<string, TimeRange[]> = {
  '1': [{ start: '09:00', end: '18:00' }],
  '2': [{ start: '09:00', end: '18:00' }],
  '3': [{ start: '09:00', end: '18:00' }],
  '4': [{ start: '09:00', end: '18:00' }],
  '5': [{ start: '09:00', end: '18:00' }],
  '6': [{ start: '09:00', end: '14:00' }],
};

export const DEFAULT_AGENDA: AgendaSettings = {
  businessType: 'store',
  timezone: 'America/Bogota',
  address: '',
  policies: 'Si no puedes asistir, avísanos con al menos 3 horas de anticipación para darle el espacio a otra persona.',
  slotStepMin: 30,
  minNoticeMin: 60,
  maxDaysAhead: 30,
  reminder24h: true,
  reminder2h: true,
  reminderTemplate: 'recordatorio_cita',
  templateLang: 'es',
  services: [],
  staff: [],
  bookingEnabled: false,
  bookingSlug: '',
  comeBackEnabled: false,
  comeBackTemplate: 'volver_cita',
};

export const newStaffSchedule = (): Record<string, TimeRange[]> => JSON.parse(JSON.stringify(WEEK));
export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const int = (v: unknown, min: number, max: number, d: number) => {
  const x = Math.round(Number(v));
  return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : d;
};
const id = (v: unknown, prefix: string) => (/^[\w-]{1,40}$/.test(String(v || '')) ? String(v) : `${prefix}-${Math.random().toString(36).slice(2, 9)}`);
export const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function cleanRanges(v: unknown): TimeRange[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((r: any) => ({ start: str(r?.start, 5), end: str(r?.end, 5) }))
    .filter((r) => HHMM.test(r.start) && HHMM.test(r.end) && toMin(r.start) < toMin(r.end))
    .sort((a, b) => toMin(a.start) - toMin(b.start))
    .slice(0, 6);
}

// Validates what the panel sends. Returns an error message for the person, or the clean settings.
export function cleanAgenda(input: any): AgendaSettings | string {
  const services: AgendaService[] = (Array.isArray(input?.services) ? input.services : []).slice(0, 60).map((s: any) => ({
    id: id(s?.id, 'srv'),
    name: str(s?.name, 80),
    durationMin: int(s?.durationMin, 5, 600, 30),
    price: Math.max(0, Math.round(Number(s?.price) || 0)),
    description: str(s?.description, 300) || undefined,
    active: s?.active !== false,
    returnAfterDays: int(s?.returnAfterDays, 0, 365, 0) || undefined,
  }));
  if (services.some((s) => !s.name)) return 'Cada servicio necesita un nombre.';
  const serviceIds = new Set(services.map((s) => s.id));
  const staff: AgendaStaff[] = (Array.isArray(input?.staff) ? input.staff : []).slice(0, 40).map((p: any) => {
    const schedule: Record<string, TimeRange[]> = {};
    for (let d = 0; d < 7; d++) {
      const r = cleanRanges(p?.schedule?.[String(d)]);
      if (r.length) schedule[String(d)] = r;
    }
    return {
      id: id(p?.id, 'stf'),
      name: str(p?.name, 60),
      serviceIds: (Array.isArray(p?.serviceIds) ? p.serviceIds : []).map(String).filter((x: string) => serviceIds.has(x)),
      schedule,
      daysOff: (Array.isArray(p?.daysOff) ? p.daysOff : []).map(String).filter((x: string) => DATE.test(x)).slice(0, 200),
      active: p?.active !== false,
    };
  });
  if (staff.some((p) => !p.name)) return 'Cada profesional necesita un nombre.';
  if (input?.bookingEnabled && slugify(str(input?.bookingSlug, 60)).length < 3) return 'Elige la dirección de tu página de reservas (mínimo 3 letras).';
  const tz = str(input?.timezone, 60) || DEFAULT_AGENDA.timezone;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    return 'Zona horaria inválida.';
  }
  return {
    businessType: input?.businessType === 'appointments' ? 'appointments' : 'store',
    timezone: tz,
    address: str(input?.address, 300),
    policies: str(input?.policies, 2000),
    slotStepMin: [10, 15, 20, 30, 60].includes(Number(input?.slotStepMin)) ? Number(input.slotStepMin) : DEFAULT_AGENDA.slotStepMin,
    minNoticeMin: int(input?.minNoticeMin, 0, 7 * 1440, DEFAULT_AGENDA.minNoticeMin),
    maxDaysAhead: int(input?.maxDaysAhead, 1, 180, DEFAULT_AGENDA.maxDaysAhead),
    reminder24h: input?.reminder24h !== false,
    reminder2h: input?.reminder2h !== false,
    reminderTemplate: str(input?.reminderTemplate, 120).replace(/[^a-z0-9_]/g, '') || DEFAULT_AGENDA.reminderTemplate,
    templateLang: str(input?.templateLang, 10) || 'es',
    services,
    staff,
    bookingEnabled: Boolean(input?.bookingEnabled),
    bookingSlug: slugify(str(input?.bookingSlug, 60)),
    comeBackEnabled: Boolean(input?.comeBackEnabled),
    comeBackTemplate: str(input?.comeBackTemplate, 120).replace(/[^a-z0-9_]/g, '') || DEFAULT_AGENDA.comeBackTemplate,
  };
}

// "Barbería El Parche" → "barberia-el-parche"
export function slugify(v: string): string {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// ---------- time zones ----------

// Minutes the zone is ahead of UTC at that instant (Bogotá = -300).
function tzOffsetMin(date: Date, timeZone: string): number {
  const p = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date);
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') === 24 ? 0 : g('hour'), g('minute'), g('second'));
  return Math.round((asUtc - date.getTime()) / 60000);
}

// "2026-11-04" + "15:30" in the store's zone → the exact instant.
export function zonedToUtc(date: string, hhmm: string, timeZone: string): Date {
  const guess = new Date(`${date}T${hhmm}:00Z`);
  const off = tzOffsetMin(guess, timeZone);
  const first = new Date(guess.getTime() - off * 60000);
  const off2 = tzOffsetMin(first, timeZone); // daylight-saving edge
  return off2 === off ? first : new Date(guess.getTime() - off2 * 60000);
}

// The store's local date ("2026-11-04"), weekday (0 = domingo) and "HH:MM" for an instant.
export function localParts(d: Date, timeZone: string) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value || '';
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(d));
  return { date: `${g('year')}-${g('month')}-${g('day')}`, weekday: wd, hhmm: `${g('hour')}:${g('minute')}` };
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// "martes 4 de noviembre, 3:30 p. m."
export function formatWhen(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('es-CO', { timeZone, weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  const time = new Intl.DateTimeFormat('es-CO', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
  return `${day}, ${time}`;
}

// ---------- free slots ----------

export interface Slot {
  start: string; // ISO
  end: string;
  staffId: string;
  time: string; // local "HH:MM"
}

export const staffForService = (a: AgendaSettings, serviceId: string) =>
  a.staff.filter((p) => p.active && (!p.serviceIds.length || p.serviceIds.includes(serviceId)));

// Free start times on one local date for a service (optionally one professional). With several professionals,
// each time shows once, with the first one free at that time.
export function freeSlots(
  a: AgendaSettings,
  serviceId: string,
  date: string,
  busy: { staffId: string; start: string; end: string }[],
  opts: { staffId?: string; now?: Date } = {},
): Slot[] {
  const service = a.services.find((s) => s.id === serviceId && s.active);
  if (!service) return [];
  const now = opts.now || new Date();
  const earliest = now.getTime() + a.minNoticeMin * 60000;
  const today = localParts(now, a.timezone).date;
  if (date < today || date > addDays(today, a.maxDaysAhead)) return [];
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const people = staffForService(a, serviceId).filter((p) => !opts.staffId || p.id === opts.staffId);
  const byTime = new Map<string, Slot>();
  for (const p of people) {
    if (p.daysOff.includes(date)) continue;
    const mine = busy.filter((b) => b.staffId === p.id).map((b) => [new Date(b.start).getTime(), new Date(b.end).getTime()]);
    for (const r of p.schedule[String(weekday)] || []) {
      for (let m = toMin(r.start); m + service.durationMin <= toMin(r.end); m += a.slotStepMin) {
        const time = fromMin(m);
        if (byTime.has(time)) continue;
        const s = zonedToUtc(date, time, a.timezone).getTime();
        const e = s + service.durationMin * 60000;
        if (s < earliest) continue;
        if (mine.some(([bs, be]) => s < be && e > bs)) continue;
        byTime.set(time, { start: new Date(s).toISOString(), end: new Date(e).toISOString(), staffId: p.id, time });
      }
    }
  }
  return Array.from(byTime.values()).sort((x, y) => x.start.localeCompare(y.start));
}
