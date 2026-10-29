'use client';

// Pedidos: filter bar, summary cards and status tabs.
import React, { useMemo } from 'react';
import { CalendarDays, FilterX, Truck } from 'lucide-react';
import type { OrderItem } from '@/lib/types';
import {
  DATE_LABEL,
  NO_CAMPAIGN,
  STATUS_TABS,
  WA_LABEL,
  activeFilterCount,
  placeKey,
  summarize,
  type DateRange,
  type OrderFilters,
  type StatusTab,
  type WaFilter,
} from '@/lib/order-filters';

const money = (v: number) => (v >= 1_000_000 ? `$${(v / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M` : `$${v.toLocaleString('es-CO')}`);
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)} %`);

const select =
  'h-9 min-w-0 text-[13px] bg-white border border-slate-200 rounded-lg px-2.5 text-slate-700 outline-none focus:border-brand-navy/40 focus:ring-4 focus:ring-brand-navy/10 max-w-full';
const selectOn = 'border-brand-navy/40 bg-brand-navy/[0.04] text-brand-navy font-medium';

export function OrderFilterBar({
  all,
  base,
  filters,
  onChange,
  landingNames,
}: {
  all: OrderItem[]; // every order (for the option lists)
  base: OrderItem[]; // orders matching every filter except the status tab
  filters: OrderFilters;
  onChange: (f: OrderFilters) => void;
  landingNames: Record<string, string>;
}) {
  const set = (patch: Partial<OrderFilters>) => onChange({ ...filters, ...patch });

  const landings = useMemo(() => {
    const count: Record<string, number> = {};
    for (const o of all) if (o.landingPageId) count[o.landingPageId] = (count[o.landingPageId] || 0) + 1;
    const fallback: Record<string, string> = {};
    for (const o of all) if (o.landingPageId && !fallback[o.landingPageId]) fallback[o.landingPageId] = o.productName;
    return Object.keys(count)
      .map((id) => ({ id, name: landingNames[id] || fallback[id] || id, n: count[id] }))
      .sort((a, b) => b.n - a.n);
  }, [all, landingNames]);

  const places = useMemo(() => {
    const cities: Record<string, number> = {};
    const deps: Record<string, number> = {};
    for (const o of all) {
      if (o.city) cities[placeKey(o)] = (cities[placeKey(o)] || 0) + 1;
      if (o.department) deps[o.department.trim()] = (deps[o.department.trim()] || 0) + 1;
    }
    return {
      cities: Object.entries(cities)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => ({ k, label: k.split('|').filter(Boolean).join(', '), n })),
      deps: Object.entries(deps)
        .sort((a, b) => b[1] - a[1])
        .map(([d, n]) => ({ k: `|${d}`, label: d, n })),
    };
  }, [all]);

  const campaigns = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of all) {
      const k = o.utmCampaign || NO_CAMPAIGN;
      c[k] = (c[k] || 0) + 1;
    }
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [all]);

  const tabCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const t of STATUS_TABS) out[t.id] = t.id === 'all' ? base.length : base.filter((o) => t.statuses.includes(o.status)).length;
    return out;
  }, [base]);

  const s = useMemo(() => summarize(base), [base]);
  const nFilters = activeFilterCount(filters);
  const anyWa = all.some((o) => o.whatsapp || o.waFallbackAt || o.confirmedVia === 'whatsapp');

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
          <select value={filters.date} onChange={(e) => set({ date: e.target.value as DateRange })} className={`${select} ${filters.date !== 'all' ? selectOn : ''} w-full sm:w-auto`} aria-label="Fecha">
            {(Object.keys(DATE_LABEL) as DateRange[]).map((d) => (
              <option key={d} value={d}>
                {DATE_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
        {filters.date === 'custom' && (
          <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5 text-xs text-slate-500">
            <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} className={select} aria-label="Desde" />
            a
            <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} className={select} aria-label="Hasta" />
          </div>
        )}
        {landings.length > 1 && (
          <select value={filters.landing} onChange={(e) => set({ landing: e.target.value })} className={`${select} ${filters.landing ? selectOn : ''} sm:max-w-[220px]`} aria-label="Landing">
            <option value="">Todas las landings</option>
            {landings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.n})
              </option>
            ))}
          </select>
        )}
        {places.cities.length > 1 && (
          <select value={filters.place} onChange={(e) => set({ place: e.target.value })} className={`${select} ${filters.place ? selectOn : ''} sm:max-w-[200px]`} aria-label="Ciudad o departamento">
            <option value="">Todas las ciudades</option>
            {places.deps.length > 1 && (
              <optgroup label="Departamento">
                {places.deps.map((p) => (
                  <option key={p.k} value={p.k}>
                    {p.label} ({p.n})
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Ciudad">
              {places.cities.map((p) => (
                <option key={p.k} value={p.k}>
                  {p.label} ({p.n})
                </option>
              ))}
            </optgroup>
          </select>
        )}
        {anyWa && (
          <select value={filters.wa} onChange={(e) => set({ wa: e.target.value as WaFilter })} className={`${select} ${filters.wa ? selectOn : ''}`} aria-label="WhatsApp">
            <option value="">WhatsApp: todos</option>
            {(Object.keys(WA_LABEL) as Exclude<WaFilter, ''>[]).map((k) => (
              <option key={k} value={k}>
                {WA_LABEL[k]}
              </option>
            ))}
          </select>
        )}
        {campaigns.length > 1 && (
          <select value={filters.utm} onChange={(e) => set({ utm: e.target.value })} className={`${select} ${filters.utm ? selectOn : ''} sm:max-w-[200px]`} aria-label="Campaña">
            <option value="">Todas las campañas</option>
            {campaigns.map(([c, n]) => (
              <option key={c} value={c}>
                {c} ({n})
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => set({ noGuide: !filters.noGuide })}
          aria-pressed={filters.noGuide}
          title="Confirmados o enviados que todavía no tienen número de guía"
          className={`h-9 px-3 rounded-lg border text-[13px] inline-flex items-center gap-1.5 transition ${filters.noGuide ? `${selectOn}` : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          <Truck className="w-4 h-4" /> Sin guía
        </button>
        {(nFilters > 0 || filters.status !== 'all') && (
          <button type="button" onClick={() => onChange({ date: 'all', from: '', to: '', status: 'all', landing: '', place: '', wa: '', utm: '', noGuide: false })} className="h-9 px-2.5 rounded-lg text-[13px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center gap-1.5">
            <FilterX className="w-4 h-4" /> Limpiar filtros
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        <Stat label="Pedidos" value={s.total.toLocaleString('es-CO')} hint={s.pending ? `${s.pending} por confirmar` : undefined} />
        <Stat label="Valor (sin cancelados)" value={money(s.value)} />
        <Stat label="Confirmación" value={pct(s.confirmRate)} hint={`${s.confirmed} confirmados`} tone={s.confirmRate !== null && s.confirmRate >= 0.7 ? 'good' : undefined} title="Confirmados, enviados y entregados sobre los pedidos ya decididos (confirmados + cancelados)" />
        <Stat label="Cancelación" value={pct(s.cancelRate)} hint={`${s.cancelled} cancelados`} tone={s.cancelRate !== null && s.cancelRate >= 0.3 ? 'bad' : undefined} title="Cancelados sobre los pedidos ya decididos" />
        <Stat label="Entregados" value={money(s.deliveredValue)} hint={`${s.delivered} pedidos`} className="col-span-2 lg:col-span-1" />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {STATUS_TABS.map((t) => {
          const on = filters.status === t.id;
          const n = tabCounts[t.id];
          if (t.id !== 'all' && !n && !on) return null;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => set({ status: t.id as StatusTab })}
              className={`h-8 px-3 rounded-full text-[13px] font-medium whitespace-nowrap inline-flex items-center gap-1.5 transition ${on ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {t.label}
              <span className={`text-[11px] font-semibold ${on ? 'text-white/70' : 'text-slate-400'}`}>{n}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone, title, className = '' }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad'; title?: string; className?: string }) {
  return (
    <div title={title} className={`rounded-2xl bg-white border border-slate-200/80 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
