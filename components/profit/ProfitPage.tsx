'use client';

// Rentabilidad: Resumen (ventas vs pauta, utilidad proyectada y real), Gastos (pauta manual, herramientas, gastos
// fijos con comprobante), Inversión (presupuesto por producto y aportes de socios) y Costos (lo que cuesta cada venta).
import React, { useCallback, useEffect, useState } from 'react';
import DateRangePicker, { RANGE_IDS, rangeQuery, type RangeValue } from '@/components/ads/DateRangePicker';
import type { ProfitConfig, ProfitLedger, ProfitReport } from '@/lib/profit';
import { Spinner, api } from './profit-ui';
import SummaryTab from './SummaryTab';
import ExpensesTab from './ExpensesTab';
import InvestmentTab from './InvestmentTab';
import CostsTab from './CostsTab';

export interface Share {
  partnerId: string;
  name: string;
  contributed: number;
  contributedPct: number;
  share: number;
  profit: number;
}
export interface ProfitData {
  range: string;
  report: ProfitReport;
  config: ProfitConfig;
  ledger: ProfitLedger;
  products: { id: string; name: string }[];
  meta: { connected: boolean; error: string | null; skipped: string[] };
  partners: { projected: Share[]; real: Share[] };
}

type Tab = 'summary' | 'expenses' | 'investment' | 'costs';
const TABS: { id: Tab; label: string }[] = [
  { id: 'summary', label: 'Resumen' },
  { id: 'expenses', label: 'Gastos' },
  { id: 'investment', label: 'Inversión' },
  { id: 'costs', label: 'Costos' },
];
const KEY = 'konnexa_profit_range';

export default function ProfitPage() {
  const [tab, setTab] = useState<Tab>('summary');
  const [range, setRangeS] = useState<RangeValue>({ range: 'month' });
  const [data, setData] = useState<ProfitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ msg: string; status?: number } | null>(null);

  const load = useCallback(async (r: RangeValue) => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<ProfitData>(`/api/profit?${rangeQuery(r)}`));
    } catch (e: any) {
      setError({ msg: e.message, status: e.status });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let r: RangeValue = { range: 'month' };
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && RANGE_IDS.includes(saved.range)) r = saved;
    } catch {}
    setRangeS(r);
    load(r);
  }, [load]);

  const setRange = (v: RangeValue) => {
    setRangeS(v);
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch {}
    load(v);
  };

  if (error?.status === 403)
    return (
      <div className="max-w-lg mx-auto mt-10 bg-white rounded-2xl border border-slate-200 p-6 text-center">
        <p className="text-[15px] font-semibold text-slate-900">Solo el dueño o un administrador ven la rentabilidad</p>
        <p className="mt-1 text-[13px] text-slate-500">Pídele al dueño de la tienda que te dé el rol de administrador en Equipo.</p>
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="inline-flex rounded-xl bg-white border border-slate-200 p-1 overflow-x-auto max-w-full" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`h-9 px-4 rounded-lg text-[13px] font-semibold whitespace-nowrap ${tab === t.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab !== 'investment' && tab !== 'costs' && <DateRangePicker value={range} onChange={setRange} shown={data ? { since: data.report.since, until: data.report.until } : undefined} />}
      </div>

      {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl p-3">No se pudo cargar la rentabilidad: {error.msg}</p>}
      {data?.meta.error && <p className="text-[13px] text-amber-800 bg-amber-50 rounded-xl p-3">No se pudo leer la pauta de Meta: {data.meta.error}</p>}
      {data && data.meta.skipped.length > 0 && <p className="text-[13px] text-amber-800 bg-amber-50 rounded-xl p-3">No se suma la pauta de {data.meta.skipped.join(', ')}: la rentabilidad se calcula en pesos (COP).</p>}

      {!data && loading ? (
        <Spinner />
      ) : data ? (
        <div className={loading ? 'opacity-60 pointer-events-none transition-opacity' : ''}>
          {tab === 'summary' && <SummaryTab data={data} goTo={setTab} />}
          {tab === 'expenses' && <ExpensesTab data={data} reload={() => load(range)} />}
          {tab === 'investment' && <InvestmentTab data={data} reloadAll={() => load(range)} />}
          {tab === 'costs' && <CostsTab data={data} reload={() => load(range)} />}
        </div>
      ) : null}
    </div>
  );
}
