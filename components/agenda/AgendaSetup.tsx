'use client';

// Agenda setup: services, professionals (weekly hours and days off) and reminder settings.
import React, { useState } from 'react';
import { CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react';
import { DAY_NAMES, newStaffSchedule, slugify, type AgendaService, type AgendaSettings, type AgendaStaff } from '@/lib/agenda';
import { TIMEZONES } from '@/lib/crm';

export const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
export const input = 'w-full h-9 text-[13px] bg-white border border-slate-200 rounded-lg px-3 outline-none focus:border-brand-navy/40 focus:ring-2 focus:ring-brand-navy/10';
export const primary = 'h-9 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50';
const ghost = 'h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1';
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const WEEK_ORDER = ['1', '2', '3', '4', '5', '6', '0'];

function SaveBar({ busy, msg, onSave, dirty }: { busy: boolean; msg: { ok: boolean; text: string } | null; onSave: () => void; dirty: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={onSave} disabled={busy || !dirty} className={primary}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar cambios
      </button>
      {msg && <span className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</span>}
    </div>
  );
}

export function ServicesEditor({ agenda, onChange }: { agenda: AgendaSettings; onChange: (a: AgendaSettings) => void }) {
  const set = (i: number, patch: Partial<AgendaService>) => onChange({ ...agenda, services: agenda.services.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Lo que ofreces, con su duración y precio. El asistente solo ofrece estos servicios y estos precios.</p>
      {agenda.services.map((s, i) => (
        <div key={s.id} className="rounded-xl border border-slate-200 p-3 grid sm:grid-cols-[1fr_100px_120px_120px_auto] gap-2 items-start">
          <div className="space-y-1.5">
            <input className={input} placeholder="Nombre (ej. Corte + barba)" value={s.name} onChange={(e) => set(i, { name: e.target.value })} />
            <input className={input} placeholder="Descripción corta (opcional)" value={s.description || ''} onChange={(e) => set(i, { description: e.target.value })} />
          </div>
          <label className="block">
            <span className="text-[11px] text-slate-500">Duración (min)</span>
            <input className={input} type="number" min={5} step={5} value={s.durationMin} onChange={(e) => set(i, { durationMin: Number(e.target.value) })} />
          </label>
          <label className="block">
            <span className="text-[11px] text-slate-500">Precio (0 = a consultar)</span>
            <input className={input} type="number" min={0} step={1000} value={s.price} onChange={(e) => set(i, { price: Number(e.target.value) })} />
          </label>
          <label className="block" title="Para el mensaje 'vuelve pronto': cuántos días después de la cita suele volver el cliente. 0 = no enviar.">
            <span className="text-[11px] text-slate-500">Vuelve cada (días)</span>
            <input className={input} type="number" min={0} max={365} value={s.returnAfterDays || 0} onChange={(e) => set(i, { returnAfterDays: Number(e.target.value) })} />
          </label>
          <div className="flex sm:flex-col gap-1.5 sm:pt-4">
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" className="accent-[#0A6CF0]" checked={s.active} onChange={(e) => set(i, { active: e.target.checked })} /> Activo
            </label>
            <button onClick={() => onChange({ ...agenda, services: agenda.services.filter((_, j) => j !== i) })} className="text-xs text-slate-400 hover:text-red-600 inline-flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Quitar
            </button>
          </div>
        </div>
      ))}
      <button onClick={() => onChange({ ...agenda, services: [...agenda.services, { id: uid('srv'), name: '', durationMin: 30, price: 0, active: true }] })} className={ghost}>
        <Plus className="w-3.5 h-3.5" /> Agregar servicio
      </button>
    </div>
  );
}

function StaffCard({ p, agenda, onChange, onRemove }: { p: AgendaStaff; agenda: AgendaSettings; onChange: (p: AgendaStaff) => void; onRemove: () => void }) {
  const [off, setOff] = useState('');
  const setDay = (d: string, ranges: AgendaStaff['schedule'][string]) => {
    const schedule = { ...p.schedule };
    if (ranges.length) schedule[d] = ranges;
    else delete schedule[d];
    onChange({ ...p, schedule });
  };
  return (
    <div className="rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${input} max-w-[260px]`} placeholder="Nombre (ej. Juan)" value={p.name} onChange={(e) => onChange({ ...p, name: e.target.value })} />
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" className="accent-[#0A6CF0]" checked={p.active} onChange={(e) => onChange({ ...p, active: e.target.checked })} /> Atiende
        </label>
        <button onClick={onRemove} className="ml-auto text-xs text-slate-400 hover:text-red-600 inline-flex items-center gap-1">
          <Trash2 className="w-3.5 h-3.5" /> Quitar
        </button>
      </div>
      <div>
        <p className="text-[11px] font-medium text-slate-500 mb-1">Servicios que hace (sin marcar = todos)</p>
        <div className="flex flex-wrap gap-1.5">
          {agenda.services.map((s) => {
            const on = p.serviceIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onChange({ ...p, serviceIds: on ? p.serviceIds.filter((x) => x !== s.id) : [...p.serviceIds, s.id] })}
                className={`h-7 px-2.5 rounded-full text-xs border ${on ? 'bg-[#0A6CF0] border-[#0A6CF0] text-white' : 'bg-white border-slate-200 text-slate-600'}`}
              >
                {s.name || 'Sin nombre'}
              </button>
            );
          })}
          {!agenda.services.length && <span className="text-xs text-slate-400">Primero crea servicios.</span>}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-medium text-slate-500 mb-1">Horario de cada semana</p>
        <div className="space-y-1">
          {WEEK_ORDER.map((d) => {
            const ranges = p.schedule[d] || [];
            return (
              <div key={d} className="flex flex-wrap items-center gap-2 text-xs">
                <label className="w-28 flex items-center gap-1.5 text-slate-700">
                  <input
                    type="checkbox"
                    className="accent-[#0A6CF0]"
                    checked={ranges.length > 0}
                    onChange={(e) => setDay(d, e.target.checked ? [{ start: '09:00', end: '18:00' }] : [])}
                  />
                  {DAY_NAMES[Number(d)]}
                </label>
                {ranges.map((r, k) => (
                  <span key={k} className="inline-flex items-center gap-1">
                    <input type="time" className="h-8 border border-slate-200 rounded-lg px-1.5" value={r.start} onChange={(e) => setDay(d, ranges.map((x, j) => (j === k ? { ...x, start: e.target.value } : x)))} />
                    <span className="text-slate-400">a</span>
                    <input type="time" className="h-8 border border-slate-200 rounded-lg px-1.5" value={r.end} onChange={(e) => setDay(d, ranges.map((x, j) => (j === k ? { ...x, end: e.target.value } : x)))} />
                    {ranges.length > 1 && (
                      <button onClick={() => setDay(d, ranges.filter((_, j) => j !== k))} className="text-slate-400 hover:text-red-600" aria-label="Quitar franja">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </span>
                ))}
                {ranges.length > 0 && ranges.length < 3 && (
                  <button onClick={() => setDay(d, [...ranges, { start: '14:00', end: '18:00' }])} className="text-[#0A6CF0] font-medium">
                    + franja
                  </button>
                )}
                {!ranges.length && <span className="text-slate-400">No atiende</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-medium text-slate-500 mb-1">Días libres (vacaciones, festivos)</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {p.daysOff.map((d) => (
            <span key={d} className="h-7 px-2.5 rounded-full bg-slate-100 text-xs text-slate-700 inline-flex items-center gap-1">
              {d}
              <button onClick={() => onChange({ ...p, daysOff: p.daysOff.filter((x) => x !== d) })} className="text-slate-400 hover:text-red-600" aria-label="Quitar día">
                ×
              </button>
            </span>
          ))}
          <input type="date" className="h-8 border border-slate-200 rounded-lg px-1.5 text-xs" value={off} onChange={(e) => setOff(e.target.value)} />
          <button
            disabled={!off}
            onClick={() => {
              if (off && !p.daysOff.includes(off)) onChange({ ...p, daysOff: [...p.daysOff, off].sort() });
              setOff('');
            }}
            className={ghost}
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

export function StaffEditor({ agenda, onChange }: { agenda: AgendaSettings; onChange: (a: AgendaSettings) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Quién atiende y en qué horario. Si solo eres tú, agrégate a ti. El asistente solo ofrece horas libres dentro de estos horarios.</p>
      {agenda.staff.map((p, i) => (
        <StaffCard
          key={p.id}
          p={p}
          agenda={agenda}
          onChange={(np) => onChange({ ...agenda, staff: agenda.staff.map((x, j) => (j === i ? np : x)) })}
          onRemove={() => onChange({ ...agenda, staff: agenda.staff.filter((_, j) => j !== i) })}
        />
      ))}
      <button
        onClick={() => onChange({ ...agenda, staff: [...agenda.staff, { id: uid('stf'), name: '', serviceIds: [], schedule: newStaffSchedule(), daysOff: [], active: true }] })}
        className={ghost}
      >
        <Plus className="w-3.5 h-3.5" /> Agregar profesional
      </button>
    </div>
  );
}

export function SettingsEditor({ agenda, onChange }: { agenda: AgendaSettings; onChange: (a: AgendaSettings) => void }) {
  const set = (patch: Partial<AgendaSettings>) => onChange({ ...agenda, ...patch });
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <label className="block md:col-span-2">
        <span className="text-xs font-medium text-slate-600">Dirección del negocio</span>
        <input className={input} placeholder="Calle 10 # 20-30, local 4, Medellín" value={agenda.address} onChange={(e) => set({ address: e.target.value })} />
      </label>
      <label className="block md:col-span-2">
        <span className="text-xs font-medium text-slate-600">Políticas (cancelación, llegada, pagos…)</span>
        <textarea className={`${input} h-20 py-2`} value={agenda.policies} onChange={(e) => set({ policies: e.target.value })} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Las citas pueden empezar cada</span>
        <select className={input} value={agenda.slotStepMin} onChange={(e) => set({ slotStepMin: Number(e.target.value) })}>
          {[10, 15, 20, 30, 60].map((m) => (
            <option key={m} value={m}>
              {m} minutos
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Anticipación mínima para agendar</span>
        <select className={input} value={agenda.minNoticeMin} onChange={(e) => set({ minNoticeMin: Number(e.target.value) })}>
          {[0, 30, 60, 120, 240, 720, 1440].map((m) => (
            <option key={m} value={m}>
              {m === 0 ? 'Sin mínimo' : m < 60 ? `${m} minutos` : m < 1440 ? `${m / 60} ${m === 60 ? 'hora' : 'horas'}` : '1 día'}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Se puede agendar hasta</span>
        <select className={input} value={agenda.maxDaysAhead} onChange={(e) => set({ maxDaysAhead: Number(e.target.value) })}>
          {[7, 14, 30, 60, 90].map((d) => (
            <option key={d} value={d}>
              {d} días adelante
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Zona horaria</span>
        <select className={input} value={agenda.timezone} onChange={(e) => set({ timezone: e.target.value })}>
          {TIMEZONES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
        <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
          <input type="checkbox" className="accent-[#0A6CF0]" checked={agenda.bookingEnabled} onChange={(e) => set({ bookingEnabled: e.target.checked })} /> Página de reservas
        </label>
        <p className="text-[11px] text-slate-600">Un enlace para tu Instagram, tu perfil de WhatsApp o tus anuncios: el cliente elige servicio, profesional, día y hora, y agenda sin escribir.</p>
        <div className="flex items-center gap-1 text-[13px]">
          <span className="text-slate-500 whitespace-nowrap">{typeof window !== 'undefined' ? window.location.host : 'konnexa.lat'}/citas/</span>
          <input className={input} placeholder="barberia-el-parche" value={agenda.bookingSlug} onChange={(e) => set({ bookingSlug: slugify(e.target.value) })} />
        </div>
        {agenda.bookingEnabled && agenda.bookingSlug && (
          <a href={`/citas/${agenda.bookingSlug}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#0A6CF0] hover:underline">
            Abrir mi página de reservas (guarda primero) ↗
          </a>
        )}
        <p className="text-[11px] text-slate-500">Al reservar, el cliente recibe la plantilla de recordatorio para confirmar o cancelar.</p>
      </div>
      <div className="md:col-span-2 rounded-xl border border-violet-200 bg-violet-50/40 p-3 space-y-2">
        <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
          <input type="checkbox" className="accent-[#0A6CF0]" checked={agenda.comeBackEnabled} onChange={(e) => set({ comeBackEnabled: e.target.checked })} /> Mensaje "vuelve pronto"
        </label>
        <p className="text-[11px] text-slate-600">
          Si un cliente asistió y ya pasaron los días que pusiste en el servicio ("Vuelve cada"), y no tiene otra cita, le escribimos para que agende. Usa una plantilla de marketing (Plantillas → Vuelve pronto); envíala solo a clientes que te autorizaron a escribirles.
        </p>
        <label className="block">
          <span className="text-[11px] text-slate-500">Plantilla</span>
          <input className={input} value={agenda.comeBackTemplate} onChange={(e) => set({ comeBackTemplate: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} />
        </label>
      </div>
      <div className="md:col-span-2 rounded-xl border border-sky-200 bg-sky-50/50 p-3 space-y-2">
        <p className="text-[13px] font-semibold text-slate-900">Recordatorios por WhatsApp</p>
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" className="accent-[#0A6CF0]" checked={agenda.reminder24h} onChange={(e) => set({ reminder24h: e.target.checked })} /> 24 horas antes, con botones Confirmar cita / Cancelar cita
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" className="accent-[#0A6CF0]" checked={agenda.reminder2h} onChange={(e) => set({ reminder2h: e.target.checked })} /> 2 horas antes
        </label>
        <label className="block">
          <span className="text-[11px] text-slate-500">Plantilla de recordatorio (para clientes que no han escrito en las últimas 24 h)</span>
          <input className={input} value={agenda.reminderTemplate} onChange={(e) => set({ reminderTemplate: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} />
        </label>
        <p className="text-[11px] text-slate-500">
          Créala con un clic en <strong>Plantillas → Nueva plantilla → Recordatorio de citas</strong>. Si el cliente escribió en las últimas 24 horas, el recordatorio sale gratis sin plantilla. Necesita la revisión automática cada 5 minutos.
        </p>
      </div>
    </div>
  );
}

export { SaveBar };
