'use client';

// Period picker: ready-made ranges (Hoy, Ayer, últimos 7 días…) or any two dates.
import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Check, ChevronDown } from 'lucide-react';

export type RangeId = 'today' | 'yesterday' | '7d' | '14d' | '30d' | '90d' | 'month' | 'lastmonth' | 'custom';
export interface RangeValue {
  range: RangeId;
  since?: string; // YYYY-MM-DD, only for custom
  until?: string;
}

export const RANGE_PRESETS: { id: Exclude<RangeId, 'custom'>; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: '7d', label: 'Últimos 7 días' },
  { id: '14d', label: 'Últimos 14 días' },
  { id: '30d', label: 'Últimos 30 días' },
  { id: '90d', label: 'Últimos 90 días' },
  { id: 'month', label: 'Este mes' },
  { id: 'lastmonth', label: 'Mes pasado' },
];
export const RANGE_IDS: RangeId[] = [...RANGE_PRESETS.map((p) => p.id), 'custom'];

const TZ = 'America/Bogota';
export const todayCo = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const fmt = (d: string, year = false) =>
  new Date(`${d}T12:00:00-05:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}), timeZone: TZ }).replace('.', '');
export function daysLabel(since?: string, until?: string) {
  if (!since || !until) return '';
  if (since === until) return fmt(since, since.slice(0, 4) !== todayCo().slice(0, 4));
  const otherYear = since.slice(0, 4) !== until.slice(0, 4) || until.slice(0, 4) !== todayCo().slice(0, 4);
  return `${fmt(since, otherYear)} – ${fmt(until, otherYear)}`;
}

// Query string for the API.
export const rangeQuery = (v: RangeValue) => (v.range === 'custom' && v.since && v.until ? `range=custom&since=${v.since}&until=${v.until}` : `range=${v.range}`);

export default function DateRangePicker({ value, onChange, shown }: { value: RangeValue; onChange: (v: RangeValue) => void; shown?: { since?: string; until?: string } }) {
  const [open, setOpen] = useState(false);
  const today = todayCo();
  const [since, setSince] = useState(value.since || shown?.since || today);
  const [until, setUntil] = useState(value.until || shown?.until || today);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    setSince(value.since || shown?.since || today);
    setUntil(value.until || shown?.until || today);
    const out = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', out);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', out);
      window.removeEventListener('keydown', esc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const preset = RANGE_PRESETS.find((p) => p.id === value.range);
  const label = preset ? preset.label : 'Personalizado';
  const bad = !since || !until || since > until;
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:border-slate-300 inline-flex items-center gap-2 max-w-full"
        aria-expanded={open}
      >
        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="text-slate-900">{label}</span>
        {shown?.since && <span className="text-slate-400 truncate">· {daysLabel(shown.since, shown.until)}</span>}
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 left-0 sm:left-auto sm:right-0 w-[min(calc(100vw-2rem),500px)] bg-white rounded-2xl border border-slate-200 shadow-xl p-3 grid sm:grid-cols-[180px_1fr] gap-3">
          <ul className="grid grid-cols-2 sm:grid-cols-1 gap-1">
            {RANGE_PRESETS.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ range: p.id });
                    setOpen(false);
                  }}
                  className={`w-full h-9 px-3 rounded-lg text-left text-[13px] inline-flex items-center justify-between ${value.range === p.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                >
                  {p.label}
                  {value.range === p.id && <Check className="w-3.5 h-3.5" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="rounded-xl bg-slate-50 p-3 space-y-3 sm:border-l-0">
            <p className="text-[13px] font-semibold text-slate-900">Elegir fechas</p>
            <label className="block text-[12px] text-slate-500">
              Desde
              <input type="date" value={since} max={until || today} onChange={(e) => setSince(e.target.value)} className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-[14px] text-slate-900" />
            </label>
            <label className="block text-[12px] text-slate-500">
              Hasta
              <input type="date" value={until} min={since} max={today} onChange={(e) => setUntil(e.target.value)} className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-[14px] text-slate-900" />
            </label>
            <button
              type="button"
              disabled={bad}
              onClick={() => {
                onChange({ range: 'custom', since, until: until > today ? today : until });
                setOpen(false);
              }}
              className="w-full h-10 rounded-xl bg-brand-gradient text-white text-[13px] font-semibold disabled:opacity-40"
            >
              Aplicar
            </button>
            <p className="text-[11px] text-slate-400">Hasta 400 días. Las fechas son en hora de Colombia.</p>
          </div>
        </div>
      )}
    </div>
  );
}
