'use client';

// Inicio for businesses with appointments: today, what needs confirming, the week, this month's income,
// and the booking link to share.
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck2, CalendarDays, Check, Clock, Copy, Globe, TrendingUp } from 'lucide-react';
import { addDays, localParts, STATUS_LABEL, type AgendaSettings, type Appointment } from '@/lib/agenda';

const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
const money = (v: number) => `$${Math.round(v).toLocaleString('es-CO')}`;

async function get(url: string) {
  const r = await fetch(url, { cache: 'no-store' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

export default function AppointmentsHome() {
  const [agenda, setAgenda] = useState<AgendaSettings | null>(null);
  const [month, setMonth] = useState<Appointment[]>([]);
  const [week, setWeek] = useState<Appointment[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    get('/api/agenda/settings')
      .then(async (d) => {
        const a: AgendaSettings = d.agenda;
        setAgenda(a);
        const today = localParts(new Date(), a.timezone).date;
        const [m, w] = await Promise.all([get(`/api/agenda/appointments?from=${today.slice(0, 8)}01&to=${today}`), get(`/api/agenda/appointments?from=${today}&to=${addDays(today, 6)}`)]);
        setMonth(m.appointments);
        setWeek(w.appointments);
      })
      .catch(() => {});
  }, []);

  if (!agenda) return null;
  const tz = agenda.timezone;
  const today = localParts(new Date(), tz).date;
  const active = (x: Appointment) => x.status !== 'cancelled';
  const todays = week.filter((x) => localParts(new Date(x.start), tz).date === today && active(x)).sort((a, b) => a.start.localeCompare(b.start));
  const toConfirm = week.filter((x) => x.status === 'pending' && new Date(x.start).getTime() > Date.now());
  const income = month.filter((x) => x.status === 'completed').reduce((s, x) => s + (agenda.services.find((v) => v.id === x.serviceId)?.price || 0), 0);
  const link = agenda.bookingEnabled && agenda.bookingSlug ? `${window.location.origin}/citas/${agenda.bookingSlug}` : '';
  const stats = [
    { label: 'Citas hoy', value: String(todays.length), Icon: CalendarDays, tone: 'text-brand-navy bg-brand-navy/[0.07]' },
    { label: 'Por confirmar', value: String(toConfirm.length), Icon: Clock, tone: 'text-amber-600 bg-amber-50' },
    { label: 'Próximos 7 días', value: String(week.filter(active).length), Icon: CalendarCheck2, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Ingresos del mes', value: money(income), Icon: TrendingUp, tone: 'text-brand-blue bg-brand-blue/[0.07]' },
  ];

  return (
    <>
      <section className={`${card} p-6 sm:p-8 flex flex-col md:flex-row md:items-center gap-5`}>
        <div className="flex-1">
          <p className="text-[13px] text-slate-500">Tu negocio con citas</p>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">{link ? 'Comparte tu página y llena tu agenda' : 'Publica tu página de reservas'}</h2>
          <p className="text-sm text-slate-600 mt-1">
            {link ? 'Ponla en tu Instagram y en tu perfil de WhatsApp. El asistente agenda por chat y Konnexa recuerda cada cita.' : 'Un enlace y un código QR para que tus clientes agenden solos, a cualquier hora.'}
          </p>
        </div>
        {link ? (
          <div className="flex flex-col gap-2 md:items-end">
            <span className="font-mono text-xs text-slate-600 break-all">{link}</span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="h-10 px-4 rounded-xl bg-brand-gradient text-white text-sm font-semibold inline-flex items-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copiado' : 'Copiar enlace'}
              </button>
              <Link href="/reservas" className="h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 inline-flex items-center gap-2 hover:bg-slate-50">
                <Globe className="w-4 h-4" /> Editar
              </Link>
            </div>
          </div>
        ) : (
          <Link href="/reservas" className="h-11 px-5 rounded-xl bg-brand-gradient text-white text-sm font-semibold inline-flex items-center gap-2 self-start md:self-auto">
            <Globe className="w-4 h-4" /> Crear mi página de reservas
          </Link>
        )}
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map(({ label, value, Icon, tone }) => (
          <div key={label} className={`${card} p-4 sm:p-5`}>
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-slate-500">{label}</p>
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone}`}>
                <Icon className="w-4 h-4" />
              </span>
            </div>
            <p className="text-2xl font-semibold text-slate-900 mt-2">{value}</p>
          </div>
        ))}
      </section>

      <section className={card}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-[15px] font-semibold text-slate-900">Citas de hoy</h3>
          <Link href="/agenda" className="text-[13px] font-semibold text-brand-blue">
            Ver agenda →
          </Link>
        </div>
        {todays.length ? (
          <ul className="divide-y divide-slate-100">
            {todays.map((x) => (
              <li key={x.id} className="px-5 py-3 flex items-center gap-4 text-[13px]">
                <span className="font-semibold text-slate-900 w-12">{localParts(new Date(x.start), tz).hhmm}</span>
                <span className="flex-1 min-w-0 truncate text-slate-800">
                  {x.customerName} · <span className="text-slate-500">{agenda.services.find((s) => s.id === x.serviceId)?.name}</span>
                </span>
                <span className="text-slate-500 hidden sm:inline">{agenda.staff.find((p) => p.id === x.staffId)?.name}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{STATUS_LABEL[x.status]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-slate-500">No hay citas para hoy.</p>
        )}
      </section>
    </>
  );
}
