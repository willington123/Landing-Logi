// Pedidos: filters, status tabs and the summary above the table.
import type { OrderItem, OrderStatus } from '@/lib/types';

export type DateRange = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'lastMonth' | 'custom';
export type StatusTab = 'all' | 'pending' | 'review' | 'unanswered' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export type WaFilter = '' | 'sent' | 'failed' | 'waiting' | 'confirmed_wa' | 'none';

export interface OrderFilters {
  date: DateRange;
  from: string; // yyyy-mm-dd (custom range)
  to: string;
  status: StatusTab;
  landing: string; // landing id
  place: string; // "city|department" or "|department"
  wa: WaFilter;
  utm: string; // utmCampaign, "(sin campaña)" for none
  noGuide: boolean;
}

export const EMPTY_FILTERS: OrderFilters = { date: 'all', from: '', to: '', status: 'all', landing: '', place: '', wa: '', utm: '', noGuide: false };

export const DATE_LABEL: Record<DateRange, string> = {
  all: 'Todas las fechas',
  today: 'Hoy',
  yesterday: 'Ayer',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  month: 'Este mes',
  lastMonth: 'Mes pasado',
  custom: 'Rango personalizado',
};

export const STATUS_TABS: { id: StatusTab; label: string; statuses: OrderStatus[] }[] = [
  { id: 'all', label: 'Todos', statuses: [] },
  { id: 'pending', label: 'Pendientes', statuses: ['pending_call', 'retry_scheduled', 'calling'] },
  { id: 'review', label: 'Por revisar', statuses: ['needs_review'] },
  { id: 'unanswered', label: 'No contesta', statuses: ['unanswered'] },
  { id: 'confirmed', label: 'Confirmados', statuses: ['confirmed_by_voice'] },
  { id: 'shipped', label: 'Enviados', statuses: ['shipped'] },
  { id: 'delivered', label: 'Entregados', statuses: ['delivered'] },
  { id: 'cancelled', label: 'Cancelados', statuses: ['cancelled'] },
];

export const WA_LABEL: Record<Exclude<WaFilter, ''>, string> = {
  sent: 'Plantilla enviada',
  failed: 'Plantilla falló',
  waiting: 'Esperando que escriba',
  confirmed_wa: 'Confirmó por WhatsApp',
  none: 'Sin WhatsApp',
};

export const NO_CAMPAIGN = '(sin campaña)';
const PENDING: OrderStatus[] = ['pending_call', 'retry_scheduled', 'needs_review', 'unanswered', 'calling'];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const parseDay = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

// [from, to) in the browser's local time; null = no limit.
export function dateBounds(f: Pick<OrderFilters, 'date' | 'from' | 'to'>, now = new Date()): [Date | null, Date | null] {
  const today = startOfDay(now);
  switch (f.date) {
    case 'today':
      return [today, addDays(today, 1)];
    case 'yesterday':
      return [addDays(today, -1), today];
    case '7d':
      return [addDays(today, -6), addDays(today, 1)];
    case '30d':
      return [addDays(today, -29), addDays(today, 1)];
    case 'month':
      return [new Date(today.getFullYear(), today.getMonth(), 1), addDays(today, 1)];
    case 'lastMonth':
      return [new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 1)];
    case 'custom': {
      const a = parseDay(f.from);
      const b = parseDay(f.to);
      return [a, b ? addDays(b, 1) : null];
    }
    default:
      return [null, null];
  }
}

export const placeKey = (o: OrderItem) => `${(o.city || '').trim()}|${(o.department || '').trim()}`;
const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function waState(o: OrderItem): Exclude<WaFilter, ''> {
  if (o.confirmedVia === 'whatsapp') return 'confirmed_wa';
  if (o.waFallbackAt && !o.whatsapp && PENDING.includes(o.status)) return 'waiting';
  if (o.whatsapp) return o.whatsapp.ok ? 'sent' : 'failed';
  return 'none';
}

export function matchesWa(o: OrderItem, wa: WaFilter) {
  if (!wa) return true;
  if (wa === 'sent') return Boolean(o.whatsapp?.ok); // a template went out (whatever happened next)
  return waState(o) === wa;
}

// Everything except the status tab (so the tab counts reflect the other filters).
export function matchesBase(o: OrderItem, f: OrderFilters, search: string, bounds: [Date | null, Date | null]) {
  const t = new Date(o.createdAt).getTime();
  if (bounds[0] && t < bounds[0].getTime()) return false;
  if (bounds[1] && t >= bounds[1].getTime()) return false;
  if (f.landing && o.landingPageId !== f.landing) return false;
  if (f.place) {
    const [city, dep] = f.place.split('|');
    if (city ? placeKey(o) !== f.place : (o.department || '').trim() !== dep) return false;
  }
  if (!matchesWa(o, f.wa)) return false;
  if (f.utm && (o.utmCampaign || NO_CAMPAIGN) !== f.utm) return false;
  if (f.noGuide && (o.trackingNumber || !['confirmed_by_voice', 'shipped'].includes(o.status))) return false;
  const q = norm(search.trim());
  if (q) {
    const hay = [o.orderNumber, o.customerName, o.city, o.department, o.address, o.productName, o.trackingNumber || ''].map(norm);
    if (!hay.some((h) => h.includes(q)) && !(o.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '') || '\u0000')) return false;
  }
  return true;
}

export const inTab = (o: OrderItem, tab: StatusTab) => tab === 'all' || (STATUS_TABS.find((t) => t.id === tab)?.statuses || []).includes(o.status);

export function summarize(list: OrderItem[]) {
  const total = list.length;
  const cancelled = list.filter((o) => o.status === 'cancelled').length;
  const confirmed = list.filter((o) => ['confirmed_by_voice', 'shipped', 'delivered'].includes(o.status)).length;
  const delivered = list.filter((o) => o.status === 'delivered');
  const pending = list.filter((o) => PENDING.includes(o.status)).length;
  return {
    total,
    value: list.filter((o) => o.status !== 'cancelled').reduce((n, o) => n + (o.totalAmount || 0), 0),
    deliveredValue: delivered.reduce((n, o) => n + (o.totalAmount || 0), 0),
    delivered: delivered.length,
    pending,
    confirmed,
    cancelled,
    // Rates over orders already decided (confirmed or cancelled), so new pending orders don't drag them down.
    confirmRate: confirmed + cancelled ? confirmed / (confirmed + cancelled) : null,
    cancelRate: confirmed + cancelled ? cancelled / (confirmed + cancelled) : null,
  };
}

export function activeFilterCount(f: OrderFilters) {
  return (f.date !== 'all' ? 1 : 0) + (f.landing ? 1 : 0) + (f.place ? 1 : 0) + (f.wa ? 1 : 0) + (f.utm ? 1 : 0) + (f.noGuide ? 1 : 0);
}

export function cleanSavedFilters(raw: unknown): OrderFilters {
  const r = (raw || {}) as Partial<OrderFilters>;
  const f = { ...EMPTY_FILTERS };
  if (r.date && r.date in DATE_LABEL) f.date = r.date;
  if (typeof r.from === 'string') f.from = r.from;
  if (typeof r.to === 'string') f.to = r.to;
  if (r.status && STATUS_TABS.some((t) => t.id === r.status)) f.status = r.status;
  if (typeof r.landing === 'string') f.landing = r.landing;
  if (typeof r.place === 'string') f.place = r.place;
  if (r.wa && r.wa in WA_LABEL) f.wa = r.wa;
  if (typeof r.utm === 'string') f.utm = r.utm;
  f.noGuide = Boolean(r.noGuide);
  return f;
}
