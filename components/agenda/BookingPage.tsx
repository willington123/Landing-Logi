'use client';

// Public booking page (konnexa.lat/citas/<slug>): service → professional → day → time → name and WhatsApp.
import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck2, Check, Clock, Loader2, MapPin, MessageCircle } from 'lucide-react';
import { addDays, formatWhen, localParts } from '@/lib/agenda';

interface Info {
  business: {
    name: string;
    address: string;
    policies: string;
    whatsapp: string | null;
    timezone: string;
    maxDaysAhead: number;
    intro?: string;
    color?: string;
    cover?: string | null;
    showPrices?: boolean;
  };
  services: { id: string; name: string; durationMin: number; price: number; description: string }[];
  staff: { id: string; name: string; serviceIds: string[] }[];
}

const money = (v: number) => (v > 0 ? `$${Math.round(v).toLocaleString('es-CO')}` : 'Precio a consultar');
const input = 'w-full h-12 text-[15px] bg-white border border-slate-300 rounded-xl px-4 outline-none focus:border-[var(--bk)] focus:ring-2 focus:ring-slate-900/5';

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-[var(--bk)] text-white text-xs font-bold flex items-center justify-center">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

// `preview`: the editor shows the page live, with its own data and the panel's free-times endpoint; booking is off.
export default function BookingPage({ slug, preview, previewSlotsUrl }: { slug: string; preview?: Info; previewSlotsUrl?: (serviceId: string, date: string, staffId: string) => string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [slotStaff, setSlotStaff] = useState('');
  const [slots, setSlots] = useState<{ time: string; staffId: string }[] | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', notes: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{ start: string; staffId: string } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [autoDay, setAutoDay] = useState(true); // until the customer picks a day, jump to the first one with free times

  useEffect(() => {
    if (preview) return setInfo(preview);
    fetch(`/api/public/booking/${slug}`)
      .then((r) => r.json())
      .then((d) => (d.success ? setInfo(d) : setError(d.error)))
      .catch(() => setError('No pudimos cargar la página. Revisa tu conexión.'));
  }, [slug, preview]);

  const days = useMemo(() => {
    if (!info) return [];
    const today = localParts(new Date(), info.business.timezone).date;
    return Array.from({ length: Math.min(info.business.maxDaysAhead, 30) + 1 }, (_, i) => addDays(today, i));
  }, [info]);

  useEffect(() => {
    if (!serviceId || !date) return;
    setSlots(null);
    setTime('');
    fetch(previewSlotsUrl ? previewSlotsUrl(serviceId, date, staffId) : `/api/public/booking/${slug}/slots?serviceId=${encodeURIComponent(serviceId)}&date=${date}${staffId ? `&staffId=${staffId}` : ''}`)
      .then((r) => r.json())
      .then((d) => {
        const list = d.success ? d.slots : [];
        const i = days.indexOf(date);
        if (!list.length && autoDay && i >= 0 && i < Math.min(days.length - 1, 14)) setDate(days[i + 1]);
        else setSlots(list);
      })
      .catch(() => setSlots([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, serviceId, staffId, date, refresh]);

  if (error) return <main className="min-h-screen flex items-center justify-center p-6 text-center text-slate-600">{error}</main>;
  if (!info) return <main className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></main>;

  const service = info.services.find((s) => s.id === serviceId);
  const color = info.business.color || '#0A6CF0';
  const showPrices = info.business.showPrices !== false;
  const vars = { ['--bk' as any]: color } as React.CSSProperties;
  const people = info.staff.filter((p) => !p.serviceIds.length || p.serviceIds.includes(serviceId));
  const dayLabel = (d: string) => {
    const dt = new Date(`${d}T12:00:00Z`);
    return {
      wd: new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'short' }).format(dt).replace('.', ''),
      n: dt.getUTCDate(),
      m: new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', month: 'short' }).format(dt).replace('.', ''),
    };
  };

  const book = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) return setFormError('Vista previa: aquí tu cliente agenda su cita.');
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/public/booking/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, staffId: staffId || slotStaff, date, time, ...form }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || 'No pudimos agendar. Inténtalo de nuevo.');
      setDone(d.appointment);
    } catch (err: any) {
      setFormError(err.message);
      // The time may have just been taken: refresh the list.
      if (/libre|ocupar/.test(err.message)) setRefresh((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const who = info.staff.find((p) => p.id === done.staffId)?.name;
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-5" style={vars}>
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-7 max-w-md w-full text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
            <Check className="w-7 h-7 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">¡Tu cita quedó agendada!</h1>
          <p className="text-slate-700">
            <strong>{service?.name}</strong>
            <br />
            {formatWhen(done.start, info.business.timezone)}
            {who ? ` · con ${who}` : ''}
          </p>
          {info.business.address && <p className="text-sm text-slate-500">{info.business.address}</p>}
          <p className="text-sm text-slate-600">Te enviaremos un WhatsApp para confirmar tu asistencia y te recordaremos la cita antes.</p>
          {info.business.whatsapp && (
            <a
              href={`https://wa.me/${info.business.whatsapp}?text=${encodeURIComponent(`Hola, agendé una cita de ${service?.name} para el ${formatWhen(done.start, info.business.timezone)}.`)}`}
              className="h-12 rounded-xl bg-[#10C569] text-white font-semibold inline-flex items-center justify-center gap-2 w-full"
            >
              <MessageCircle className="w-5 h-5" /> Escribir por WhatsApp
            </a>
          )}
          {info.business.policies && <p className="text-xs text-slate-400">{info.business.policies}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className={`${preview ? '' : 'min-h-screen'} bg-slate-50`} style={vars}>
      <header
        className="text-white bg-cover bg-center"
        style={{
          backgroundImage: info.business.cover
            ? `linear-gradient(rgba(15,23,42,.35), rgba(15,23,42,.65)), url("${info.business.cover}")`
            : `linear-gradient(135deg, ${color}, ${color}cc 60%, #0f172a)`,
        }}
      >
        <div className="max-w-xl mx-auto px-5 pt-10 pb-8">
          <CalendarCheck2 className="w-8 h-8 mb-3 opacity-90" />
          <h1 className="text-2xl font-bold">{info.business.name}</h1>
          {info.business.intro && <p className="text-white/90 mt-1">{info.business.intro}</p>}
          {info.business.address && (
            <p className="text-white/80 text-sm mt-2 flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> {info.business.address}
            </p>
          )}
        </div>
      </header>

      <div className="max-w-xl mx-auto px-5 py-6 space-y-7">
        <Step n={1} title="Elige el servicio">
          <div className="space-y-2">
            {info.services.map((s) => (
              <button
                key={s.id}
                onClick={() => (setServiceId(s.id), setStaffId(''), setDate(autoDay ? days[0] || '' : date))}
                className={`w-full text-left rounded-2xl border p-4 bg-white transition ${serviceId === s.id ? 'border-[var(--bk)] ring-2 ring-slate-900/5' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{s.name}</p>
                    {s.description && <p className="text-sm text-slate-500 mt-0.5">{s.description}</p>}
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {s.durationMin} min
                    </p>
                  </div>
                  {showPrices && <p className="font-semibold text-slate-900 whitespace-nowrap">{money(s.price)}</p>}
                </div>
              </button>
            ))}
            {!info.services.length && <p className="text-sm text-slate-500">Este negocio aún no tiene servicios para agendar.</p>}
          </div>
        </Step>

        {service && people.length > 1 && (
          <Step n={2} title="¿Con quién?">
            <div className="flex flex-wrap gap-2">
              {[{ id: '', name: 'Cualquiera' }, ...people].map((p) => (
                <button
                  key={p.id || 'any'}
                  onClick={() => setStaffId(p.id)}
                  className={`h-10 px-4 rounded-full border text-sm font-medium ${staffId === p.id ? 'bg-[var(--bk)] border-[var(--bk)] text-white' : 'bg-white border-slate-200 text-slate-700'}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </Step>
        )}

        {service && (
          <Step n={people.length > 1 ? 3 : 2} title="Elige el día">
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5">
              {days.map((d) => {
                const l = dayLabel(d);
                return (
                  <button
                    key={d}
                    onClick={() => (setAutoDay(false), setDate(d))}
                    className={`shrink-0 w-16 rounded-2xl border py-2 text-center ${date === d ? 'bg-[var(--bk)] border-[var(--bk)] text-white' : 'bg-white border-slate-200 text-slate-700'}`}
                  >
                    <p className="text-[11px] uppercase opacity-80">{l.wd}</p>
                    <p className="text-lg font-bold leading-tight">{l.n}</p>
                    <p className="text-[11px] opacity-80">{l.m}</p>
                  </button>
                );
              })}
            </div>
          </Step>
        )}

        {service && date && (
          <Step n={people.length > 1 ? 4 : 3} title="Elige la hora">
            {!slots ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : slots.length ? (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {slots.map((s) => (
                  <button
                    key={s.time}
                    onClick={() => (setTime(s.time), setSlotStaff(s.staffId))}
                    className={`h-11 rounded-xl border text-sm font-semibold ${time === s.time ? 'bg-[var(--bk)] border-[var(--bk)] text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No hay horas libres ese día. Prueba otro día.</p>
            )}
          </Step>
        )}

        {service && date && time && (
          <Step n={people.length > 1 ? 5 : 4} title="Tus datos">
            <form onSubmit={book} className="space-y-3">
              <input className={input} placeholder="Nombre y apellido" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className={input} placeholder="Celular (WhatsApp)" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input className={input} placeholder="¿Algo que debamos saber? (opcional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <input className="hidden" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} aria-hidden="true" />
              <div className="rounded-2xl bg-white border border-slate-200 p-4 text-sm text-slate-700">
                <strong>{service.name}</strong>
                {showPrices && <> · {money(service.price)}</>}
                <br />
                {new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00Z`))}, {time}
                {(staffId || slotStaff) && ` · con ${info.staff.find((p) => p.id === (staffId || slotStaff))?.name || ''}`}
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <button disabled={busy || !form.name || !form.phone} className="h-12 w-full rounded-xl bg-[var(--bk)] text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarCheck2 className="w-5 h-5" />} Agendar cita
              </button>
              {info.business.policies && <p className="text-xs text-slate-500">{info.business.policies}</p>}
            </form>
          </Step>
        )}
        <p className="text-center text-[11px] text-slate-400 pt-4">
          Reservas con <a href="/" className="underline">Konnexa</a>
        </p>
      </div>
    </main>
  );
}
