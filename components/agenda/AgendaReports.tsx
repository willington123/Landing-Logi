'use client';

// Agenda reports: totals, by professional, by service, where appointments come from, new vs returning customers.
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { addDays, localParts, type AgendaSettings, type Appointment } from '@/lib/agenda';
import { card } from '@/components/agenda/AgendaSetup';

type Period = 'month' | 'last' | '30d';
const money = (v: number) => `$${Math.round(v).toLocaleString('es-CO')}`;
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—');

async function fetchRange(from: string, to: string): Promise<Appointment[]> {
  const res = await fetch(`/api/agenda/appointments?from=${from}&to=${to}`, { cache: 'no-store' });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
  return d.appointments;
}

function range(period: Period, tz: string) {
  const today = localParts(new Date(), tz).date;
  if (period === '30d') return { from: addDays(today, -29), to: today };
  const first = `${today.slice(0, 8)}01`;
  if (period === 'month') return { from: first, to: today };
  const lastEnd = addDays(first, -1);
  return { from: `${lastEnd.slice(0, 8)}01`, to: lastEnd };
}

export default function AgendaReports({ agenda }: { agenda: AgendaSettings }) {
  const [period, setPeriod] = useState<Period>('month');
  const [list, setList] = useState<Appointment[] | null>(null);
  const [before, setBefore] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const r = useMemo(() => range(period, agenda.timezone), [period, agenda.timezone]);

  useEffect(() => {
    setList(null);
    setError(null);
    Promise.all([fetchRange(r.from, r.to), fetchRange(addDays(r.from, -365), addDays(r.from, -1))])
      .then(([cur, prev]) => {
        setList(cur);
        setBefore(new Set(prev.filter((x) => x.status === 'completed').map((x) => x.phone)));
      })
      .catch((e) => setError(e.message));
  }, [r]);

  const price = (x: Appointment) => agenda.services.find((s) => s.id === x.serviceId)?.price || 0;
  const now = Date.now();
  const stats = useMemo(() => {
    const l = list || [];
    const of = (xs: Appointment[]) => {
      const done = xs.filter((x) => x.status === 'completed');
      const noShow = xs.filter((x) => x.status === 'no_show').length;
      return {
        total: xs.filter((x) => x.status !== 'cancelled').length,
        done: done.length,
        noShow,
        cancelled: xs.filter((x) => x.status === 'cancelled').length,
        revenue: done.reduce((a, x) => a + price(x), 0),
        unmarked: xs.filter((x) => (x.status === 'pending' || x.status === 'confirmed') && new Date(x.end).getTime() < now).length,
      };
    };
    const phones = new Set(l.filter((x) => x.status !== 'cancelled').map((x) => x.phone));
    return {
      all: of(l),
      byStaff: agenda.staff.map((p) => ({ name: p.name, ...of(l.filter((x) => x.staffId === p.id)) })).filter((x) => x.total || x.cancelled),
      byService: agenda.services.map((s) => ({ name: s.name, ...of(l.filter((x) => x.serviceId === s.id)) })).filter((x) => x.total || x.cancelled),
      sources: [
        ['Asistente de WhatsApp', l.filter((x) => x.source === 'whatsapp_bot').length],
        ['Página de reservas', l.filter((x) => x.source === 'page').length],
        ['Panel', l.filter((x) => x.source === 'panel' || !x.source).length],
      ] as [string, number][],
      customers: phones.size,
      returning: Array.from(phones).filter((p) => before.has(p)).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, before, agenda]);

  const th = 'text-left text-[11px] font-semibold text-slate-500 px-3 py-2';
  const td = 'px-3 py-2 text-[13px] text-slate-700';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {([
          ['month', 'Este mes'],
          ['30d', 'Últimos 30 días'],
          ['last', 'Mes pasado'],
        ] as [Period, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setPeriod(k)} className={`h-8 px-3 rounded-full text-[13px] font-medium ${period === k ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {label}
          </button>
        ))}
        <span className="text-xs text-slate-400 self-center ml-1">
          {r.from} a {r.to}
        </span>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!list && !error && <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
      {list && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              ['Citas', String(stats.all.total)],
              ['Asistieron', String(stats.all.done)],
              ['Asistencia', pct(stats.all.done, stats.all.done + stats.all.noShow)],
              ['No llegaron', String(stats.all.noShow)],
              ['Ingresos (asistidas)', money(stats.all.revenue)],
              ['Ticket promedio', stats.all.done ? money(stats.all.revenue / stats.all.done) : '—'],
            ].map(([label, v]) => (
              <div key={label} className={`${card} px-4 py-3`}>
                <p className="text-[11px] text-slate-500">{label}</p>
                <p className="text-lg font-semibold text-slate-900">{v}</p>
              </div>
            ))}
          </div>
          {stats.all.unmarked > 0 && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {stats.all.unmarked} {stats.all.unmarked === 1 ? 'cita ya pasó y no está marcada' : 'citas ya pasaron y no están marcadas'} como "Asistió" o "No llegó". Márcalas en el calendario para que los reportes y el mensaje "vuelve pronto" sean exactos.
            </p>
          )}
          <div className={`${card} overflow-x-auto`}>
            <p className="px-3 pt-3 text-[13px] font-semibold text-slate-900">Por profesional</p>
            <table className="w-full min-w-[520px]">
              <thead>
                <tr>
                  {['Profesional', 'Citas', 'Asistieron', 'No llegaron', 'Canceladas', 'Asistencia', 'Ingresos'].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.byStaff.map((x) => (
                  <tr key={x.name} className="border-t border-slate-100">
                    <td className={`${td} font-medium text-slate-900`}>{x.name}</td>
                    <td className={td}>{x.total}</td>
                    <td className={td}>{x.done}</td>
                    <td className={td}>{x.noShow}</td>
                    <td className={td}>{x.cancelled}</td>
                    <td className={td}>{pct(x.done, x.done + x.noShow)}</td>
                    <td className={td}>{money(x.revenue)}</td>
                  </tr>
                ))}
                {!stats.byStaff.length && (
                  <tr>
                    <td className={`${td} text-slate-400`} colSpan={7}>
                      Sin citas en este periodo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className={`${card} overflow-x-auto`}>
              <p className="px-3 pt-3 text-[13px] font-semibold text-slate-900">Por servicio</p>
              <table className="w-full">
                <thead>
                  <tr>
                    {['Servicio', 'Citas', 'Asistieron', 'Ingresos'].map((h) => (
                      <th key={h} className={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.byService.map((x) => (
                    <tr key={x.name} className="border-t border-slate-100">
                      <td className={`${td} font-medium text-slate-900`}>{x.name}</td>
                      <td className={td}>{x.total}</td>
                      <td className={td}>{x.done}</td>
                      <td className={td}>{money(x.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={`${card} p-3 space-y-3`}>
              <p className="text-[13px] font-semibold text-slate-900">De dónde vienen las citas</p>
              {stats.sources.map(([label, n]) => {
                const total = stats.sources.reduce((a, [, v]) => a + v, 0) || 1;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>{label}</span>
                      <span>{n}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 mt-1">
                      <div className="h-2 rounded-full bg-[#0A6CF0]" style={{ width: `${(n / total) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-slate-600 pt-1 border-t border-slate-100">
                <strong>{stats.customers}</strong> {stats.customers === 1 ? 'cliente' : 'clientes'} en el periodo: <strong>{stats.customers - stats.returning}</strong> {stats.customers - stats.returning === 1 ? 'nuevo' : 'nuevos'} y <strong>{stats.returning}</strong> que ya {stats.returning === 1 ? 'había' : 'habían'} venido antes.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
