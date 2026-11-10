'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { NO_PRODUCT, type ProfitLine } from '@/lib/profit';
import type { ProfitData } from './ProfitPage';
import { Card, Kpi, cop, dayTxt, pctTxt, roasTxt } from './profit-ui';

type Mode = 'projected' | 'real';

export default function SummaryTab({ data, goTo }: { data: ProfitData; goTo: (t: 'expenses' | 'costs' | 'investment') => void }) {
  const { report, config, products, meta } = data;
  const t = report.total;
  const [mode, setMode] = useState<Mode>('projected');
  const p = t[mode];
  const name = (id: string) => (id === NO_PRODUCT ? 'General (sin producto)' : products.find((x) => x.id === id)?.name || 'Producto borrado');
  const margin = p.revenue ? p.profit / p.revenue : null;
  const missingCosts = report.products.filter((x) => x.productId !== NO_PRODUCT && x.missingCost).map((x) => name(x.productId));
  const unassigned = report.campaigns.filter((c) => !c.productId).length && report.products.find((x) => x.productId === NO_PRODUCT)?.adsMeta;

  return (
    <div className="space-y-5">
      {(!meta.connected || missingCosts.length > 0 || !config.shipping) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900 space-y-1.5">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Para que la utilidad sea exacta
          </p>
          <ul className="list-disc pl-5 space-y-0.5">
            {!meta.connected && (
              <li>
                Conecta tu cuenta publicitaria de Meta en <Link href="/integrations" className="underline font-medium">Integraciones</Link> para traer la pauta sola, o cárgala en{' '}
                <button onClick={() => goTo('expenses')} className="underline font-medium">Gastos</button>.
              </li>
            )}
            {missingCosts.length > 0 && (
              <li>
                Falta el costo de: {missingCosts.slice(0, 4).join(', ')}
                {missingCosts.length > 4 ? ` y ${missingCosts.length - 4} más` : ''}. <button onClick={() => goTo('costs')} className="underline font-medium">Ponerlo</button>
              </li>
            )}
            {!config.shipping && (
              <li>
                Aún no has puesto el valor del flete. <button onClick={() => goTo('costs')} className="underline font-medium">Ponerlo</button>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Ventas confirmadas" value={cop(t.confirmedRevenue)} sub={`${t.confirmed} de ${t.orders} pedidos · ${pctTxt(t.confirmRate)} confirmación`} />
        <Kpi label="Pauta" value={cop(t.ads)} sub={t.adsManual ? `Meta ${cop(t.adsMeta)} · otras ${cop(t.adsManual)}` : meta.connected ? 'Meta (automático)' : 'Cargada a mano'} tone="sky" />
        <Kpi label="ROAS (ventas ÷ pauta)" value={roasTxt(t.roas)} sub={`Proyectado con entregas: ${roasTxt(t.roasProjected)}`} tone="violet" />
        <Kpi label="Costo por venta (CPA)" value={cop(t.cpa)} sub={`Por pedido: ${cop(t.costPerOrder)}`} />
      </div>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-5">
        <Card
          title="Utilidad del periodo"
          right={
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[12px] font-semibold" role="group">
              {(
                [
                  ['projected', 'Proyectada'],
                  ['real', 'Real'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} onClick={() => setMode(id)} aria-pressed={mode === id} className={`h-8 px-3 rounded-md ${mode === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                  {label}
                </button>
              ))}
            </div>
          }
        >
          <p className={`text-[30px] font-bold tabular-nums ${p.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{cop(p.profit)}</p>
          <p className="text-[12px] text-slate-500">
            {mode === 'projected'
              ? `Si se entrega el ${config.deliveryRate}% de lo confirmado. Margen ${pctTxt(margin)}.`
              : `Solo pedidos ya entregados o devueltos. ${t.inTransit ? `Faltan ${t.inTransit} en camino.` : ''} Margen ${pctTxt(margin)}.`}
          </p>
          <dl className="mt-4 space-y-1.5 text-[13px]">
            <Row label={mode === 'projected' ? `Ventas que se cobrarían (${config.deliveryRate}%)` : `Ventas cobradas (${t.delivered} entregados)`} value={p.revenue} plus />
            <Row label="Costo del producto" value={-p.productCost} />
            <Row label={mode === 'real' && t.returned ? `Fletes (incluye ${t.returned} devoluciones)` : 'Fletes'} value={-p.shipping} />
            <Row label="Comisiones" value={-p.commission} />
            <Row label="Pauta" value={-t.ads} />
            <Row label="Herramientas y gastos fijos" value={-t.overhead} />
            <div className="border-t border-slate-200 pt-1.5">
              <Row label="Utilidad" value={p.profit} strong />
            </div>
          </dl>
          {mode === 'real' && t.deliveryRateReal !== null && (
            <p className="mt-3 text-[12px] text-slate-500">
              Entrega real: <b>{pctTxt(t.deliveryRateReal)}</b> ({t.delivered} entregados, {t.returned} devueltos). La proyección usa {config.deliveryRate}%.
            </p>
          )}
        </Card>

        <Card title="Pauta vs ventas por día">
          <DayBars days={report.days} />
        </Card>
      </div>

      <Card title="Por producto" right={unassigned ? <button onClick={() => goTo('costs')} className="text-[12px] font-semibold text-brand-blue">Asignar campañas</button> : undefined}>
        <div className="overflow-x-auto -mx-4 sm:-mx-5">
          <table className="w-full text-[13px] min-w-[760px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="font-semibold px-4 sm:px-5 py-2">Producto</th>
                <th className="font-semibold px-2 py-2 text-right">Pedidos</th>
                <th className="font-semibold px-2 py-2 text-right">Confirmados</th>
                <th className="font-semibold px-2 py-2 text-right">Ventas conf.</th>
                <th className="font-semibold px-2 py-2 text-right">Pauta</th>
                <th className="font-semibold px-2 py-2 text-right">ROAS</th>
                <th className="font-semibold px-2 py-2 text-right">CPA</th>
                <th className="font-semibold px-4 sm:px-5 py-2 text-right">Utilidad {mode === 'projected' ? 'proy.' : 'real'}</th>
              </tr>
            </thead>
            <tbody>
              {report.products.map((x) => (
                <tr key={x.productId} className="border-t border-slate-100">
                  <td className="px-4 sm:px-5 py-2.5 font-medium text-slate-900">
                    {name(x.productId)}
                    {x.productId !== NO_PRODUCT && x.missingCost && <span className="ml-2 text-[11px] font-semibold text-amber-700">sin costo</span>}
                  </td>
                  <Num v={x.orders} />
                  <Num v={x.confirmed} />
                  <td className="px-2 py-2.5 text-right tabular-nums">{cop(x.confirmedRevenue)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{cop(x.ads)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{roasTxt(x.roas)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{cop(x.cpa)}</td>
                  <td className={`px-4 sm:px-5 py-2.5 text-right tabular-nums font-semibold ${x[mode].profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{cop(x[mode].profit)}</td>
                </tr>
              ))}
              {!report.products.length && (
                <tr>
                  <td colSpan={8} className="px-5 py-6 text-center text-slate-500">
                    No hay pedidos ni gastos en este periodo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-slate-500">La pauta de Meta va al producto que más pedidos trajo con ese anuncio. Herramientas y gastos fijos quedan en “General”.</p>
      </Card>

      <Card title="Día a día">
        <div className="overflow-x-auto -mx-4 sm:-mx-5">
          <table className="w-full text-[13px] min-w-[720px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="font-semibold px-4 sm:px-5 py-2">Día</th>
                <th className="font-semibold px-2 py-2 text-right">Pedidos</th>
                <th className="font-semibold px-2 py-2 text-right">Confirmados</th>
                <th className="font-semibold px-2 py-2 text-right">Pauta</th>
                <th className="font-semibold px-2 py-2 text-right">Ventas conf.</th>
                <th className="font-semibold px-2 py-2 text-right">ROAS</th>
                <th className="font-semibold px-2 py-2 text-right">CPA</th>
                <th className="font-semibold px-4 sm:px-5 py-2 text-right">Utilidad proy.</th>
              </tr>
            </thead>
            <tbody>
              {[...report.days].reverse().map((d) => (
                <tr key={d.date} className="border-t border-slate-100">
                  <td className="px-4 sm:px-5 py-2.5 text-slate-700 whitespace-nowrap">{dayTxt(d.date)}</td>
                  <Num v={d.orders} />
                  <Num v={d.confirmed} />
                  <td className="px-2 py-2.5 text-right tabular-nums">{cop(d.ads)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{cop(d.confirmedRevenue)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{roasTxt(d.roas)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{cop(d.cpa)}</td>
                  <td className={`px-4 sm:px-5 py-2.5 text-right tabular-nums font-semibold ${d.projected.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{cop(d.projected.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Num({ v }: { v: number }) {
  return <td className="px-2 py-2.5 text-right tabular-nums">{v.toLocaleString('es-CO')}</td>;
}

function Row({ label, value, plus, strong }: { label: string; value: number; plus?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? 'font-semibold text-slate-900' : 'text-slate-600'}>{label}</dt>
      <dd className={`tabular-nums ${strong ? `font-bold ${value >= 0 ? 'text-emerald-700' : 'text-red-600'}` : value < 0 ? 'text-slate-700' : plus ? 'text-slate-900 font-medium' : 'text-slate-700'}`}>
        {value < 0 ? `− ${cop(-value)}` : cop(value)}
      </dd>
    </div>
  );
}

// Two bars per day: pauta and confirmed sales, on the same scale.
function DayBars({ days }: { days: (ProfitLine & { date: string })[] }) {
  const max = useMemo(() => Math.max(1, ...days.map((d) => Math.max(d.ads, d.confirmedRevenue))), [days]);
  const shown = days.slice(-31);
  if (!shown.some((d) => d.ads || d.confirmedRevenue)) return <p className="text-[13px] text-slate-500 py-10 text-center">Sin pauta ni ventas en este periodo.</p>;
  return (
    <div>
      <div className="flex items-center gap-4 text-[12px] text-slate-600 mb-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-sky-500" /> Pauta
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Ventas confirmadas
        </span>
      </div>
      <div className="h-44 flex items-end gap-[3px]" role="img" aria-label="Pauta y ventas confirmadas por día">
        {shown.map((d) => (
          <div key={d.date} className="flex-1 min-w-0 h-full flex items-end gap-px group relative" title={`${dayTxt(d.date)} · pauta ${cop(d.ads)} · ventas ${cop(d.confirmedRevenue)} · ROAS ${roasTxt(d.roas)}`}>
            <div className="flex-1 rounded-t-sm bg-sky-500/90" style={{ height: `${(d.ads / max) * 100}%` }} />
            <div className="flex-1 rounded-t-sm bg-emerald-500/90" style={{ height: `${(d.confirmedRevenue / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
        <span>{dayTxt(shown[0].date)}</span>
        <span>{dayTxt(shown[shown.length - 1].date)}</span>
      </div>
    </div>
  );
}
