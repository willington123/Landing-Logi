'use client';

// Analytics computed only from real data: orders, landings (visits) and settings.
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, TrendingUp, Receipt, CheckCircle2, XCircle, Package, Eye, BarChart3, ExternalLink } from 'lucide-react';
import { logiStore } from '@/lib/store';
import { CLOUD_SYNC_EVENT } from '@/lib/cloud';
import type { LandingPageConfig, OrderItem, OrderStatus } from '@/lib/types';

type Range = 'today' | '7d' | '30d' | 'all';
const RANGES: { id: Range; label: string; days: number | null }[] = [
  { id: 'today', label: 'Hoy', days: 0 },
  { id: '7d', label: '7 días', days: 7 },
  { id: '30d', label: '30 días', days: 30 },
  { id: 'all', label: 'Todo', days: null },
];

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_call: 'Por llamar',
  calling: 'Llamando',
  confirmed_by_voice: 'Confirmado',
  needs_review: 'Por revisar',
  unanswered: 'Sin respuesta',
  retry_scheduled: 'Reintento',
  cancelled: 'Cancelado',
  shipped: 'Enviado',
  delivered: 'Entregado',
};
const STATUS_COLOR: Record<OrderStatus, string> = {
  pending_call: 'bg-amber-400',
  calling: 'bg-sky-400',
  confirmed_by_voice: 'bg-emerald-500',
  needs_review: 'bg-indigo-400',
  unanswered: 'bg-slate-400',
  retry_scheduled: 'bg-purple-400',
  cancelled: 'bg-rose-400',
  shipped: 'bg-teal-500',
  delivered: 'bg-green-600',
};
const CONFIRMED: OrderStatus[] = ['confirmed_by_voice', 'shipped', 'delivered'];

const money = (v: number) => `$${Math.round(v).toLocaleString('es-CO')}`;
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');
const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';

export default function AnalyticsDashboard() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [landings, setLandings] = useState<LandingPageConfig[]>([]);
  const [range, setRange] = useState<Range>('30d');

  useEffect(() => {
    const load = () => {
      setOrders(logiStore.getOrders());
      setLandings(logiStore.getLandings());
    };
    load();
    window.addEventListener(CLOUD_SYNC_EVENT, load);
    return () => window.removeEventListener(CLOUD_SYNC_EVENT, load);
  }, []);

  const filtered = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)!.days;
    if (days === null) return orders;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - days);
    return orders.filter((o) => new Date(o.createdAt) >= start);
  }, [orders, range]);

  const active = filtered.filter((o) => o.status !== 'cancelled');
  const revenue = active.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const units = active.reduce((s, o) => s + (o.units || 0), 0);
  const confirmed = filtered.filter((o) => CONFIRMED.includes(o.status)).length;
  const cancelled = filtered.filter((o) => o.status === 'cancelled').length;
  const totalViews = landings.reduce((s, l) => s + (l.viewsCount || 0), 0);

  // Orders per day (last 14 days, or since the range start if shorter)
  const daily = useMemo(() => {
    const span = range === 'today' ? 1 : range === '7d' ? 7 : 14;
    const days: { key: string; label: string; count: number; amount: number }[] = [];
    for (let i = span - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({ key: d.toDateString(), label: d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }), count: 0, amount: 0 });
    }
    orders.forEach((o) => {
      const k = new Date(o.createdAt).toDateString();
      const day = days.find((x) => x.key === k);
      if (day) {
        day.count += 1;
        if (o.status !== 'cancelled') day.amount += o.totalAmount || 0;
      }
    });
    return days;
  }, [orders, range]);
  const maxDay = Math.max(1, ...daily.map((d) => d.count));

  const byStatus = useMemo(() => {
    const m = new Map<OrderStatus, number>();
    filtered.forEach((o) => m.set(o.status, (m.get(o.status) || 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const byLanding = useMemo(() => {
    return landings
      .map((l) => {
        const lo = filtered.filter((o) => o.landingPageId === l.id);
        const la = lo.filter((o) => o.status !== 'cancelled');
        return { l, orders: lo.length, revenue: la.reduce((s, o) => s + o.totalAmount, 0), views: l.viewsCount || 0 };
      })
      .sort((a, b) => b.revenue - a.revenue || b.views - a.views);
  }, [landings, filtered]);

  const byCampaign = useMemo(() => {
    const m = new Map<string, { source: string; campaign: string; orders: number; revenue: number; confirmed: number }>();
    filtered.forEach((o) => {
      const source = o.utmSource || 'directo';
      const campaign = o.utmCampaign || '—';
      const k = `${source}|${campaign}`;
      const row = m.get(k) || { source, campaign, orders: 0, revenue: 0, confirmed: 0 };
      row.orders += 1;
      if (o.status !== 'cancelled') row.revenue += o.totalAmount || 0;
      if (CONFIRMED.includes(o.status)) row.confirmed += 1;
      m.set(k, row);
    });
    return Array.from(m.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  const pixelDefault = logiStore.getStoreSettings().metaPixelId;
  const withPixel = landings.filter((l) => l.metaPixelId).length;

  const stats = [
    { label: 'Pedidos', value: filtered.length.toLocaleString('es-CO'), hint: 'en el periodo', Icon: ShoppingBag },
    { label: 'Ventas', value: money(revenue), hint: 'sin cancelados', Icon: TrendingUp },
    { label: 'Ticket medio', value: active.length ? money(revenue / active.length) : '—', hint: 'por pedido', Icon: Receipt },
    { label: 'Confirmados', value: pct(confirmed, filtered.length), hint: `${confirmed} de ${filtered.length}`, Icon: CheckCircle2 },
    { label: 'Cancelados', value: pct(cancelled, filtered.length), hint: `${cancelled} pedidos`, Icon: XCircle },
    { label: 'Unidades', value: units.toLocaleString('es-CO'), hint: 'vendidas', Icon: Package },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Rendimiento de tus ventas</h2>
          <p className="text-sm text-slate-500 mt-0.5">Calculado con tus pedidos y visitas reales.</p>
        </div>
        <div className="inline-flex bg-slate-200/60 p-1 rounded-xl text-[13px] font-medium">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`px-3 py-1.5 rounded-lg transition ${range === r.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {orders.length === 0 && (
        <div className={`${card} p-8 text-center`}>
          <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900">Todavía no hay pedidos</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Las métricas aparecerán aquí en cuanto lleguen pedidos desde tus landings. Para ver de qué campaña viene cada venta, añade
            <code className="mx-1 px-1 rounded bg-slate-100">utm_source</code>y<code className="mx-1 px-1 rounded bg-slate-100">utm_campaign</code>
            a los enlaces de tus anuncios.
          </p>
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {stats.map(({ label, value, hint, Icon }) => (
          <div key={label} className={`${card} p-4`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-medium text-slate-500">{label}</span>
              <Icon className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</div>
            <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
          </div>
        ))}
      </section>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className={`${card} p-5 lg:col-span-2`}>
          <h3 className="text-[15px] font-semibold text-slate-900 mb-4">Pedidos por día</h3>
          <div className="flex items-end gap-1.5 h-44">
            {daily.map((d) => (
              <div key={d.key} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${d.label}: ${d.count} pedidos · ${money(d.amount)}`}>
                <span className="text-[10.5px] text-slate-500 tabular-nums">{d.count || ''}</span>
                <div className="w-full rounded-t-md bg-brand-navy/80" style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count ? 4 : 1, opacity: d.count ? 1 : 0.15 }} />
                <span className="text-[10px] text-slate-400 truncate w-full text-center">{d.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={`${card} p-5`}>
          <h3 className="text-[15px] font-semibold text-slate-900 mb-4">Estado de los pedidos</h3>
          {byStatus.length === 0 ? (
            <p className="text-sm text-slate-500">Sin pedidos en este periodo.</p>
          ) : (
            <div className="space-y-3">
              {byStatus.map(([st, n]) => (
                <div key={st}>
                  <div className="flex justify-between text-[13px] mb-1">
                    <span className="text-slate-700">{STATUS_LABEL[st] || st}</span>
                    <span className="text-slate-500 tabular-nums">{n} · {pct(n, filtered.length)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${STATUS_COLOR[st] || 'bg-slate-400'}`} style={{ width: `${(n / filtered.length) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className={card}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-[15px] font-semibold text-slate-900">Por landing</h3>
          <span className="text-xs text-slate-500 inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {totalViews.toLocaleString('es-CO')} visitas en total</span>
        </div>
        {byLanding.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-500">Aún no tienes landings.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 bg-slate-50/70 border-y border-slate-200/80">
                  <th className="text-left font-medium px-5 py-2.5">Landing</th>
                  <th className="text-right font-medium px-3 py-2.5">Visitas</th>
                  <th className="text-right font-medium px-3 py-2.5">Pedidos</th>
                  <th className="text-right font-medium px-3 py-2.5">Conversión</th>
                  <th className="text-right font-medium px-5 py-2.5">Ventas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byLanding.map(({ l, orders: n, revenue: r, views }) => (
                  <tr key={l.id}>
                    <td className="px-5 py-3">
                      <Link href={`/landings/editor/${l.id}`} className="font-medium text-slate-900 hover:underline">{l.productName}</Link>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">{views.toLocaleString('es-CO')}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">{n}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">{pct(n, views)}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold text-slate-900">{money(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="px-5 py-3 text-[11px] text-slate-400 border-t border-slate-100">Las visitas se cuentan una vez por persona y sesión. La conversión usa los pedidos del periodo elegido.</p>
      </section>

      <section className={card}>
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-[15px] font-semibold text-slate-900">Por campaña (UTM)</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Añade <code className="px-1 rounded bg-slate-100">?utm_source=facebook&utm_campaign=nombre</code> al enlace de cada anuncio.
          </p>
        </div>
        {byCampaign.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-500">Sin pedidos en este periodo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 bg-slate-50/70 border-y border-slate-200/80">
                  <th className="text-left font-medium px-5 py-2.5">Fuente</th>
                  <th className="text-left font-medium px-3 py-2.5">Campaña</th>
                  <th className="text-right font-medium px-3 py-2.5">Pedidos</th>
                  <th className="text-right font-medium px-3 py-2.5">Confirmados</th>
                  <th className="text-right font-medium px-5 py-2.5">Ventas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byCampaign.map((c) => (
                  <tr key={`${c.source}|${c.campaign}`}>
                    <td className="px-5 py-3 font-medium text-slate-900">{c.source}</td>
                    <td className="px-3 py-3 text-slate-600">{c.campaign}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">{c.orders}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">{pct(c.confirmed, c.orders)}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold text-slate-900">{money(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={`${card} p-5 flex flex-col sm:flex-row sm:items-center gap-4`}>
        <span className="w-10 h-10 rounded-xl bg-[#0866FF] text-white font-bold flex items-center justify-center flex-shrink-0">f</span>
        <div className="flex-1">
          <h3 className="text-[15px] font-semibold text-slate-900">Píxel de Meta</h3>
          <p className="text-sm text-slate-500">
            {pixelDefault ? `Píxel por defecto: ${pixelDefault}. ` : 'No tienes un píxel por defecto. '}
            {withPixel} de {landings.length} landings lo tienen configurado. Las conversiones y el costo por compra los ves en Meta Ads Manager.
          </p>
        </div>
        <a
          href="https://business.facebook.com/events_manager2"
          target="_blank"
          rel="noreferrer"
          className="h-9 px-3 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:border-slate-300 inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          Events Manager <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </section>
    </div>
  );
}
