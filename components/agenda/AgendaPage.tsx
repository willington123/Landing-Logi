'use client';

// Agenda for "Negocio con citas": day view by professional, week view, new appointment, and each appointment's actions.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, MessageSquare, Plus, X } from 'lucide-react';
import { addDays, DAY_NAMES, localParts, STATUS_LABEL, toMin, type AgendaSettings, type Appointment, type AppointmentStatus } from '@/lib/agenda';
import { card, input, primary, SaveBar, ServicesEditor, SettingsEditor, StaffEditor } from '@/components/agenda/AgendaSetup';

type Tab = 'calendar' | 'services' | 'staff' | 'settings';
type View = 'day' | 'week';

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  pending: 'bg-amber-50 border-amber-300 text-amber-900',
  confirmed: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  completed: 'bg-sky-50 border-sky-300 text-sky-900',
  no_show: 'bg-red-50 border-red-300 text-red-900',
  cancelled: 'bg-slate-50 border-slate-200 text-slate-400 line-through',
};
const HOUR_PX = 56;

async function call(url: string, method = 'GET', body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
  return d;
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
// "Lunes, 2 de noviembre"
const dateLabel = (date: string) => cap(new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00Z`)));
const weekStart = (date: string) => {
  const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -((wd + 6) % 7)); // lunes
};

export default function AgendaPage() {
  const [agenda, setAgenda] = useState<AgendaSettings | null>(null);
  const [draft, setDraft] = useState<AgendaSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('calendar');
  const [view, setView] = useState<View>('day');
  const [date, setDate] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [list, setList] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState<{ time?: string; staffId?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    call('/api/agenda/settings')
      .then((d) => {
        setAgenda(d.agenda);
        setDraft(d.agenda);
        setDate(localParts(new Date(), d.agenda.timezone).date);
        if (d.agenda.businessType === 'appointments' && (!d.agenda.services.length || !d.agenda.staff.length)) setTab(d.agenda.services.length ? 'staff' : 'services');
      })
      .catch((e) => setError(e.message));
  }, []);

  const range = useMemo(() => (view === 'day' ? { from: date, to: date } : { from: weekStart(date), to: addDays(weekStart(date), 6) }), [view, date]);
  const load = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    try {
      const d = await call(`/api/agenda/appointments?from=${range.from}&to=${range.to}`);
      setList(d.appointments);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [date, range]);
  useEffect(() => {
    if (agenda?.businessType === 'appointments') load();
  }, [agenda?.businessType, load]);

  const save = async (patch?: Partial<AgendaSettings>) => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const d = await call('/api/agenda/settings', 'PUT', patch || draft);
      setAgenda(d.agenda);
      setDraft(d.agenda);
      setSaveMsg({ ok: true, text: 'Guardado.' });
      return d.agenda as AgendaSettings;
    } catch (e: any) {
      setSaveMsg({ ok: false, text: e.message });
      return null;
    } finally {
      setSaving(false);
    }
  };

  if (error && !agenda) return <p className="text-sm text-red-600">{error}</p>;
  if (!agenda || !draft) return <Loader2 className="w-5 h-5 animate-spin text-slate-400" />;

  if (agenda.businessType !== 'appointments') {
    return (
      <div className={`${card} p-6 max-w-2xl space-y-3`}>
        <CalendarDays className="w-8 h-8 text-[#0A6CF0]" />
        <h2 className="text-lg font-semibold text-slate-900">Agenda para negocios con citas</h2>
        <p className="text-sm text-slate-600">
          Para barberías, consultorios, spas, centros de estética y todo negocio que trabaja con citas. El asistente de WhatsApp agenda, reprograma y cancela citas solo,
          y Konnexa le recuerda la cita al cliente con botones para confirmar o cancelar.
        </p>
        <p className="text-xs text-slate-500">Al activarla, en el menú cambia Pedidos por Agenda y el asistente deja de tomar pedidos y empieza a agendar. Puedes volver a "tienda" cuando quieras.</p>
        <button
          disabled={saving}
          onClick={async () => {
            if (await save({ businessType: 'appointments' })) window.location.reload();
          }}
          className={primary}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />} Activar la agenda
        </button>
        {saveMsg && !saveMsg.ok && <p className="text-xs text-red-600">{saveMsg.text}</p>}
      </div>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(agenda);
  const staff = agenda.staff.filter((p) => p.active && (!staffFilter || p.id === staffFilter));
  const ready = agenda.services.some((s) => s.active) && agenda.staff.some((p) => p.active);
  const TABS: [Tab, string][] = [
    ['calendar', 'Calendario'],
    ['services', `Servicios (${agenda.services.length})`],
    ['staff', `Profesionales (${agenda.staff.length})`],
    ['settings', 'Ajustes'],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`h-9 px-4 rounded-full text-[13px] font-medium ${tab === k ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab !== 'calendar' && (
        <div className={`${card} p-5 space-y-4`}>
          {tab === 'services' && <ServicesEditor agenda={draft} onChange={setDraft} />}
          {tab === 'staff' && <StaffEditor agenda={draft} onChange={setDraft} />}
          {tab === 'settings' && (
            <>
              <SettingsEditor agenda={draft} onChange={setDraft} />
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                ¿Vendes productos contra entrega en vez de citas?
                <button
                  className="font-semibold text-slate-700 hover:underline"
                  onClick={async () => {
                    if (window.confirm('¿Volver a tienda? El menú muestra Pedidos y el asistente vuelve a tomar pedidos. Tus citas no se borran.') && (await save({ businessType: 'store' })))
                      window.location.reload();
                  }}
                >
                  Cambiar a tienda
                </button>
              </div>
            </>
          )}
          <SaveBar busy={saving} msg={saveMsg} dirty={dirty} onSave={() => save()} />
        </div>
      )}

      {tab === 'calendar' && !ready && (
        <div className={`${card} p-5 space-y-2 text-sm text-slate-700`}>
          <p className="font-semibold text-slate-900">Para empezar a recibir citas:</p>
          <ol className="list-decimal pl-5 space-y-1 text-[13px]">
            <li className={agenda.services.some((s) => s.active) ? 'line-through text-slate-400' : ''}>
              Crea tus servicios en la pestaña <button className="font-semibold text-[#0A6CF0]" onClick={() => setTab('services')}>Servicios</button>.
            </li>
            <li className={agenda.staff.some((p) => p.active) ? 'line-through text-slate-400' : ''}>
              Agrega quién atiende y su horario en <button className="font-semibold text-[#0A6CF0]" onClick={() => setTab('staff')}>Profesionales</button>.
            </li>
            <li>
              Crea la plantilla <strong>Recordatorio de citas</strong> en <Link href="/plantillas" className="font-semibold text-[#0A6CF0]">Plantillas</Link>.
            </li>
            <li>
              Enciende el asistente en <Link href="/automations" className="font-semibold text-[#0A6CF0]">Automatizaciones</Link>: él agenda por WhatsApp.
            </li>
          </ol>
        </div>
      )}

      {tab === 'calendar' && ready && (
        <div className={`${card} p-4 space-y-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setDate(addDays(date, view === 'day' ? -1 : -7))} className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50" aria-label="Anterior">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setDate(localParts(new Date(), agenda.timezone).date)} className="h-9 px-3 rounded-lg border border-slate-200 text-[13px] font-medium hover:bg-slate-50">
              Hoy
            </button>
            <button onClick={() => setDate(addDays(date, view === 'day' ? 1 : 7))} className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50" aria-label="Siguiente">
              <ChevronRight className="w-4 h-4" />
            </button>
            <input type="date" className="h-9 border border-slate-200 rounded-lg px-2 text-[13px]" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <span className="text-[15px] font-semibold text-slate-900">
              {view === 'day' ? dateLabel(date) : `Semana del ${dateLabel(range.from).toLowerCase()}`}
            </span>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <select className="h-9 border border-slate-200 rounded-lg px-2 text-[13px]" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                <option value="">Todos los profesionales</option>
                {agenda.staff.filter((p) => p.active).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                {(['day', 'week'] as View[]).map((v) => (
                  <button key={v} onClick={() => setView(v)} className={`h-9 px-3 text-[13px] font-medium ${view === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>
                    {v === 'day' ? 'Día' : 'Semana'}
                  </button>
                ))}
              </div>
              <button onClick={() => setCreating({})} className={primary}>
                <Plus className="w-4 h-4" /> Nueva cita
              </button>
            </div>
          </div>
          <Summary list={list.filter((x) => !staffFilter || x.staffId === staffFilter)} />
          {view === 'day' ? (
            <DayView agenda={agenda} date={date} staff={staff} list={list} onOpen={setOpen} onNew={(time, staffId) => setCreating({ time, staffId })} />
          ) : (
            <WeekView agenda={agenda} from={range.from} list={list.filter((x) => !staffFilter || x.staffId === staffFilter)} onOpen={setOpen} onDay={(d) => (setDate(d), setView('day'))} />
          )}
        </div>
      )}

      {open && (
        <AppointmentModal
          agenda={agenda}
          appt={open}
          onClose={() => setOpen(null)}
          onChanged={(x) => {
            setOpen(x);
            load();
          }}
        />
      )}
      {creating && (
        <NewAppointmentModal
          agenda={agenda}
          date={date}
          preset={creating}
          onClose={() => setCreating(null)}
          onCreated={() => {
            setCreating(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Summary({ list }: { list: Appointment[] }) {
  const n = (s: AppointmentStatus) => list.filter((x) => x.status === s).length;
  const items: [string, number, string][] = [
    ['Citas', list.filter((x) => x.status !== 'cancelled').length, 'text-slate-900'],
    ['Por confirmar', n('pending'), 'text-amber-700'],
    ['Confirmadas', n('confirmed'), 'text-emerald-700'],
    ['Asistieron', n('completed'), 'text-sky-700'],
    ['No llegaron', n('no_show'), 'text-red-700'],
    ['Canceladas', n('cancelled'), 'text-slate-500'],
  ];
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {items.map(([label, v, color]) => (
        <div key={label} className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[11px] text-slate-500">{label}</p>
          <p className={`text-lg font-semibold ${color}`}>{v}</p>
        </div>
      ))}
    </div>
  );
}

function DayView({
  agenda,
  date,
  staff,
  list,
  onOpen,
  onNew,
}: {
  agenda: AgendaSettings;
  date: string;
  staff: AgendaSettings['staff'];
  list: Appointment[];
  onOpen: (a: Appointment) => void;
  onNew: (time: string, staffId: string) => void;
}) {
  const wd = String(new Date(`${date}T12:00:00Z`).getUTCDay());
  const ranges = staff.flatMap((p) => (p.daysOff.includes(date) ? [] : p.schedule[wd] || []));
  const mins = list.map((x) => toMin(localParts(new Date(x.start), agenda.timezone).hhmm));
  const startH = Math.min(8, ...ranges.map((r) => Math.floor(toMin(r.start) / 60)), ...mins.map((m) => Math.floor(m / 60)));
  const endH = Math.max(18, ...ranges.map((r) => Math.ceil(toMin(r.end) / 60)), ...mins.map((m) => Math.ceil(m / 60) + 1));
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);
  if (!staff.length) return <p className="text-sm text-slate-500">No hay profesionales activos.</p>;
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[560px]" style={{ gridTemplateColumns: `52px repeat(${staff.length}, minmax(160px, 1fr))` }}>
        <div />
        {staff.map((p) => (
          <div key={p.id} className="px-2 pb-2 text-[13px] font-semibold text-slate-800 truncate">
            {p.name}
            {p.daysOff.includes(date) ? <span className="ml-1 text-[11px] font-normal text-slate-400">· día libre</span> : !(p.schedule[wd] || []).length && <span className="ml-1 text-[11px] font-normal text-slate-400">· no atiende</span>}
          </div>
        ))}
        <div className="relative" style={{ height: hours.length * HOUR_PX }}>
          {hours.map((h, i) => (
            <div key={h} className="absolute right-2 text-[11px] text-slate-400" style={{ top: i * HOUR_PX - 6 }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {staff.map((p) => {
          const work = p.daysOff.includes(date) ? [] : p.schedule[wd] || [];
          return (
            <div key={p.id} className="relative border-l border-slate-100" style={{ height: hours.length * HOUR_PX }}>
              {hours.map((h, i) => (
                <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: i * HOUR_PX }} />
              ))}
              {work.map((r, i) => (
                <button
                  key={i}
                  onClick={() => onNew(r.start, p.id)}
                  title="Agendar aquí"
                  className="absolute inset-x-0 bg-[#0A6CF0]/[0.04] hover:bg-[#0A6CF0]/[0.08]"
                  style={{ top: ((toMin(r.start) - startH * 60) / 60) * HOUR_PX, height: ((toMin(r.end) - toMin(r.start)) / 60) * HOUR_PX }}
                />
              ))}
              {list
                .filter((x) => x.staffId === p.id)
                .map((x) => {
                  const s = toMin(localParts(new Date(x.start), agenda.timezone).hhmm);
                  const dur = (new Date(x.end).getTime() - new Date(x.start).getTime()) / 60000;
                  const service = agenda.services.find((v) => v.id === x.serviceId);
                  return (
                    <button
                      key={x.id}
                      onClick={() => onOpen(x)}
                      className={`absolute left-1 right-1 rounded-lg border px-2 py-1 text-left overflow-hidden ${STATUS_STYLE[x.status]} ${x.status === 'cancelled' ? 'opacity-50 z-0 right-[45%]' : 'shadow-sm z-10'}`}
                      style={{ top: ((s - startH * 60) / 60) * HOUR_PX + 1, height: Math.max(24, (dur / 60) * HOUR_PX - 2) }}
                    >
                      <p className="text-[12px] font-semibold truncate">
                        {localParts(new Date(x.start), agenda.timezone).hhmm} · {x.customerName}
                      </p>
                      <p className="text-[11px] truncate opacity-80">{service?.name || 'Servicio'}</p>
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ agenda, from, list, onOpen, onDay }: { agenda: AgendaSettings; from: string; list: Appointment[]; onOpen: (a: Appointment) => void; onDay: (d: string) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
      {days.map((d) => {
        const items = list.filter((x) => localParts(new Date(x.start), agenda.timezone).date === d);
        return (
          <div key={d} className="rounded-xl border border-slate-100 bg-slate-50/60 p-2 min-h-[120px]">
            <button onClick={() => onDay(d)} className="text-[12px] font-semibold text-slate-700 hover:text-[#0A6CF0]">
              {DAY_NAMES[new Date(`${d}T12:00:00Z`).getUTCDay()].slice(0, 3)} {Number(d.slice(8))}
            </button>
            <div className="mt-1.5 space-y-1">
              {items.map((x) => (
                <button key={x.id} onClick={() => onOpen(x)} className={`w-full rounded-lg border px-1.5 py-1 text-left ${STATUS_STYLE[x.status]}`}>
                  <p className="text-[11px] font-semibold truncate">
                    {localParts(new Date(x.start), agenda.timezone).hhmm} {x.customerName}
                  </p>
                  <p className="text-[10px] truncate opacity-80">{agenda.services.find((v) => v.id === x.serviceId)?.name}</p>
                </button>
              ))}
              {!items.length && <p className="text-[11px] text-slate-400">—</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SlotPicker({ agenda, serviceId, staffId, date, except, value, onPick }: { agenda: AgendaSettings; serviceId: string; staffId: string; date: string; except?: string; value: string; onPick: (time: string, staffId: string) => void }) {
  const [slots, setSlots] = useState<{ time: string; staffId: string }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!serviceId || !date) return;
    setSlots(null);
    setErr(null);
    call(`/api/agenda/availability?serviceId=${encodeURIComponent(serviceId)}&date=${date}${staffId ? `&staffId=${staffId}` : ''}${except ? `&except=${except}` : ''}`)
      .then((d) => setSlots(d.slots))
      .catch((e) => setErr(e.message));
  }, [serviceId, staffId, date, except]);
  if (err) return <p className="text-xs text-red-600">{err}</p>;
  if (!slots) return <Loader2 className="w-4 h-4 animate-spin text-slate-400" />;
  if (!slots.length) return <p className="text-xs text-slate-500">No hay horarios libres ese día.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {slots.map((s) => (
        <button
          key={s.time}
          type="button"
          onClick={() => onPick(s.time, s.staffId)}
          className={`h-8 px-2.5 rounded-lg text-xs border ${value === s.time ? 'bg-[#0A6CF0] border-[#0A6CF0] text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'}`}
          title={agenda.staff.find((p) => p.id === s.staffId)?.name}
        >
          {s.time}
        </button>
      ))}
    </div>
  );
}

function NewAppointmentModal({ agenda, date, preset, onClose, onCreated }: { agenda: AgendaSettings; date: string; preset: { time?: string; staffId?: string }; onClose: () => void; onCreated: () => void }) {
  const services = agenda.services.filter((s) => s.active);
  const [f, setF] = useState({ serviceId: services[0]?.id || '', staffId: preset.staffId || '', date, time: '', customerName: '', phone: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const staff = agenda.staff.filter((p) => p.active && (!p.serviceIds.length || p.serviceIds.includes(f.serviceId)));
  return (
    <Modal title="Nueva cita" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <label className="block col-span-2">
          <span className="text-[11px] text-slate-500">Servicio</span>
          <select className={input} value={f.serviceId} onChange={(e) => setF({ ...f, serviceId: e.target.value, time: '' })}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.durationMin} min
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] text-slate-500">Profesional</span>
          <select className={input} value={f.staffId} onChange={(e) => setF({ ...f, staffId: e.target.value, time: '' })}>
            <option value="">Cualquiera</option>
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] text-slate-500">Día</span>
          <input type="date" className={input} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value, time: '' })} />
        </label>
      </div>
      <div>
        <p className="text-[11px] text-slate-500 mb-1">Hora libre</p>
        <SlotPicker agenda={agenda} serviceId={f.serviceId} staffId={f.staffId} date={f.date} value={f.time} onPick={(time, staffId) => setF({ ...f, time, staffId: f.staffId || staffId })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className={input} placeholder="Nombre del cliente" value={f.customerName} onChange={(e) => setF({ ...f, customerName: e.target.value })} />
        <input className={input} placeholder="Celular / WhatsApp" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <input className={`${input} col-span-2`} placeholder="Notas (opcional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button
        disabled={busy || !f.time || !f.customerName || !f.phone}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await call('/api/agenda/appointments', 'POST', f);
            onCreated();
          } catch (e: any) {
            setErr(e.message);
          } finally {
            setBusy(false);
          }
        }}
        className={`${primary} w-full`}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agendar
      </button>
      <p className="text-[11px] text-slate-500">El cliente recibe el recordatorio por WhatsApp antes de la cita, con botones para confirmar o cancelar.</p>
    </Modal>
  );
}

function AppointmentModal({ agenda, appt, onClose, onChanged }: { agenda: AgendaSettings; appt: Appointment; onClose: () => void; onChanged: (a: Appointment) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [mv, setMv] = useState({ date: localParts(new Date(appt.start), agenda.timezone).date, time: '', staffId: '' });
  const service = agenda.services.find((s) => s.id === appt.serviceId);
  const staff = agenda.staff.find((p) => p.id === appt.staffId);
  const lp = localParts(new Date(appt.start), agenda.timezone);
  const active = appt.status === 'pending' || appt.status === 'confirmed';
  const act = async (key: string, body: unknown) => {
    setBusy(key);
    setErr(null);
    try {
      const d = await call(`/api/agenda/appointments/${appt.id}`, 'PATCH', body);
      onChanged(d.appointment);
      setMoving(false);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };
  const btn = 'h-9 px-3 rounded-lg border text-[13px] font-medium disabled:opacity-50';
  return (
    <Modal title={appt.customerName || 'Cita'} onClose={onClose}>
      <div className="space-y-1 text-[13px] text-slate-700">
        <p>
          <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[appt.status]}`}>{STATUS_LABEL[appt.status]}</span>
        </p>
        <p>
          <strong>{service?.name || 'Servicio'}</strong> · {service?.durationMin} min{service?.price ? ` · $${service.price.toLocaleString('es-CO')}` : ''}
        </p>
        <p>
          {dateLabel(lp.date)}, {lp.hhmm} {staff && <span>· con {staff.name}</span>}
        </p>
        <p>+{appt.phone}</p>
        {appt.notes && <p className="text-slate-500">Notas: {appt.notes}</p>}
        <p className="text-[11px] text-slate-400">
          {appt.source === 'whatsapp_bot' ? 'Agendada por el asistente de WhatsApp' : appt.source === 'panel' ? 'Agendada desde el panel' : ''}
          {appt.reminders?.r24 ? ' · Recordatorio de 24 h enviado' : ''}
          {appt.reminders?.r2 ? ' · Recordatorio de 2 h enviado' : ''}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {appt.status === 'pending' && (
          <button disabled={!!busy} onClick={() => act('c', { status: 'confirmed' })} className={`${btn} border-emerald-300 text-emerald-800 hover:bg-emerald-50`}>
            Confirmar
          </button>
        )}
        {active && (
          <>
            <button disabled={!!busy} onClick={() => act('d', { status: 'completed' })} className={`${btn} border-sky-300 text-sky-800 hover:bg-sky-50`}>
              Asistió
            </button>
            <button disabled={!!busy} onClick={() => act('n', { status: 'no_show' })} className={`${btn} border-red-300 text-red-700 hover:bg-red-50`}>
              No llegó
            </button>
            <button disabled={!!busy} onClick={() => setMoving((v) => !v)} className={`${btn} border-slate-200 text-slate-700 hover:bg-slate-50`}>
              Reprogramar
            </button>
            <button
              disabled={!!busy}
              onClick={() => window.confirm('¿Cancelar esta cita? El horario queda libre.') && act('x', { status: 'cancelled' })}
              className={`${btn} border-slate-200 text-slate-500 hover:text-red-600`}
            >
              Cancelar
            </button>
          </>
        )}
        {(appt.status === 'completed' || appt.status === 'no_show') && (
          <button disabled={!!busy} onClick={() => act('p', { status: 'confirmed' })} className={`${btn} border-slate-200 text-slate-600 hover:bg-slate-50`}>
            Corregir: volver a confirmada
          </button>
        )}
        <Link href={`/crm?c=${appt.phone}`} className={`${btn} border-slate-200 text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5`}>
          <MessageSquare className="w-4 h-4" /> Abrir chat
        </Link>
      </div>
      {moving && (
        <div className="rounded-xl border border-slate-200 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" className={input} value={mv.date} onChange={(e) => setMv({ ...mv, date: e.target.value, time: '' })} />
            <select className={input} value={mv.staffId} onChange={(e) => setMv({ ...mv, staffId: e.target.value, time: '' })}>
              <option value="">Cualquier profesional</option>
              {agenda.staff
                .filter((p) => p.active && (!p.serviceIds.length || p.serviceIds.includes(appt.serviceId)))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
          <SlotPicker agenda={agenda} serviceId={appt.serviceId} staffId={mv.staffId} date={mv.date} except={appt.id} value={mv.time} onPick={(time, staffId) => setMv({ ...mv, time, staffId: mv.staffId || staffId })} />
          <button disabled={!mv.time || !!busy} onClick={() => act('m', mv)} className={primary}>
            {busy === 'm' ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Mover a {mv.time || '…'}
          </button>
        </div>
      )}
      {err && <p className="text-xs text-red-600">{err}</p>}
    </Modal>
  );
}
