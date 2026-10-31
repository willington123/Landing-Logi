'use client';

// "Mis tiendas": every store of the person in one table (orders, confirmed sales, ad spend, ROAS, setup).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Bot, Loader2, Megaphone, MessageCircle, RefreshCw, Search } from 'lucide-react';
import { clearLocalData } from '@/lib/cloud';

type Range = 'today' | '7d' | '30d' | 'month';
interface Store {
  id: string;
  name: string;
  role: string;
  plan: { status: string; daysLeft: number | null } | null;
  whatsapp: boolean;
  whatsappPhone: string | null;
  assistant: boolean;
  ads: boolean;
  orders: number;
  confirmed: number;
  cancelled: number;
  revenue: number;
  fromAds: number;
}
interface Spend {
  loading: boolean;
  connected?: boolean;
  spend?: number;
  otherCurrency?: boolean;
  errors?: string[];
}
type SortKey = 'name' | 'orders' | 'confirmed' | 'revenue' | 'spend' | 'roas';

const RANGES: { id: Range; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'month', label: 'Este mes' },
];
const PLAN: Record<string, { label: string; cls: string }> = {
  exempt: { label: 'Sin costo', cls: 'bg-violet-50 text-violet-700' },
  active: { label: 'Activo', cls: 'bg-emerald-50 text-emerald-700' },
  trialing: { label: 'Prueba', cls: 'bg-sky-50 text-sky-700' },
  past_due: { label: 'Pago pendiente', cls: 'bg-amber-50 text-amber-700' },
  expired: { label: 'Vencido', cls: 'bg-red-50 text-red-600' },
  canceled: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-600' },
};
const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

export default function StoresOverview() {
  const [range, setRange] = useState<Range>('7d');
  const [stores, setStores] = useState<Store[] | null>(null);
  const [error, setError] = useState('');
  const [spend, setSpend] = useState<Record<string, Spend>>({});
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'revenue', desc: true });

  const load = useCallback(async (r: Range) => {
    setError('');
    setStores(null);
    setSpend({});
    try {
      const d = await fetch(`/api/overview?range=${r}`, { cache: 'no-store' }).then((res) => res.json());
      if (!d.success) return setError(d.error || 'No se pudo cargar.');
      setStores(d.stores);
      // Spend per store with ads, a few at a time.
      const queue = (d.stores as Store[]).filter((s) => s.ads).map((s) => s.id);
      setSpend(Object.fromEntries(queue.map((id) => [id, { loading: true }])));
      const worker = async () => {
        for (let id = queue.shift(); id; id = queue.shift()) {
          const v = await fetch(`/api/overview/spend?org=${id}&range=${r}`, { cache: 'no-store' })
            .then((res) => res.json())
            .catch(() => ({ success: false }));
          setSpend((s) => ({ ...s, [id!]: v.success ? { loading: false, ...v } : { loading: false, errors: [v.error || 'Error'] } }));
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
    } catch {
      setError('Sin conexión. Intenta de nuevo.');
    }
  }, []);
  useEffect(() => {
    load(range);
  }, [range, load]);

  const open = async (id: string, to = '/dashboard') => {
    const res = await fetch('/api/account/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId: id }) });
    if (res.ok) {
      clearLocalData();
      window.location.href = to;
    }
  };

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = (stores || [])
      .filter((s) => !term || s.name.toLowerCase().includes(term) || (s.whatsappPhone || '').includes(term))
      .map((s) => {
        const sp = spend[s.id];
        const spent = sp?.spend ?? null;
        return { ...s, spent, roas: spent ? s.revenue / spent : null };
      });
    const val = (r: (typeof list)[number]) =>
      sort.key === 'name' ? r.name.toLowerCase() : sort.key === 'spend' ? r.spent ?? -1 : sort.key === 'roas' ? r.roas ?? -1 : (r as any)[sort.key];
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * (sort.desc ? -1 : 1);
    });
  }, [stores, spend, q, sort]);

  const totals = useMemo(() => {
    const t = rows.reduce(
      (a, r) => ({ orders: a.orders + r.orders, confirmed: a.confirmed + r.confirmed, revenue: a.revenue + r.revenue, spend: a.spend + (r.spent || 0), adRevenue: a.adRevenue + (r.spent ? r.revenue : 0) }),
      { orders: 0, confirmed: 0, revenue: 0, spend: 0, adRevenue: 0 },
    );
    // ROAS only over stores that have ad spend (stores without ads would inflate it).
    return { ...t, roas: t.spend ? t.adRevenue / t.spend : null };
  }, [rows]);
  const loadingSpend = Object.values(spend).some((s) => s.loading);

  const th = (key: SortKey, label: string, right = true) => (
    <th className={`px-3 py-2.5 font-medium ${right ? 'text-right' : 'text-left'}`}>
      <button onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== 'name' }))} className="inline-flex items-center gap-1 hover:text-slate-900">
        {label} <ArrowUpDown className={`w-3 h-3 ${sort.key === key ? 'text-slate-900' : 'opacity-40'}`} />
      </button>
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Mis tiendas</h2>
          <p className="text-sm text-slate-500">Todos tus negocios en un vistazo. Haz clic en una tienda para entrar.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl text-[13px] font-medium text-slate-600">
            {RANGES.map((r) => (
              <button key={r.id} onClick={() => setRange(r.id)} className={`px-3 py-1.5 rounded-lg transition ${range === r.id ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}>
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={() => load(range)} className="h-9 w-9 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-slate-900" aria-label="Actualizar">
            <RefreshCw className={`w-4 h-4 ${!stores || loadingSpend ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          ['Tiendas', (stores?.length || 0).toLocaleString('es-CO')],
          ['Pedidos', totals.orders.toLocaleString('es-CO')],
          ['Confirmados', totals.confirmed.toLocaleString('es-CO')],
          ['Ventas confirmadas', cop(totals.revenue)],
          ['Gasto en anuncios', loadingSpend ? '…' : cop(totals.spend)],
          ['ROAS real', loadingSpend ? '…' : totals.roas === null ? '—' : `${totals.roas.toFixed(2)}x`],
        ].map(([k, v]) => (
          <div key={k} className={`${card} p-4`}>
            <p className="text-xs text-slate-500">{k}</p>
            <p className="text-lg font-semibold text-slate-900 tabular-nums mt-0.5">{v}</p>
          </div>
        ))}
      </div>

      <section className={card}>
        <div className="p-3 border-b border-slate-100">
          <div className="relative max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar tienda o número"
              className="w-full h-9 pl-8 pr-3 text-[13px] rounded-lg border border-slate-200 outline-none focus:border-brand-navy/40"
            />
          </div>
        </div>
        {!stores ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    {th('name', 'Tienda', false)}
                    <th className="px-3 py-2.5 font-medium text-left">Conexiones</th>
                    {th('orders', 'Pedidos')}
                    {th('confirmed', 'Confirmados')}
                    {th('revenue', 'Ventas')}
                    {th('spend', 'Gasto')}
                    {th('roas', 'ROAS')}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} onClick={() => open(r.id)} className="cursor-pointer hover:bg-slate-50">
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-900">{r.name}</p>
                        {r.plan && PLAN[r.plan.status] && <span className={`inline-flex mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PLAN[r.plan.status].cls}`}>{PLAN[r.plan.status].label}</span>}
                      </td>
                      <td className="px-3 py-3">
                        <Conn r={r} />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {r.orders}
                        {r.cancelled > 0 && <span className="block text-[11px] text-slate-400">{r.cancelled} cancel.</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-900">{r.confirmed}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{cop(r.revenue)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <SpendCell s={spend[r.id]} ads={r.ads} />
                      </td>
                      <td className={`px-3 py-3 text-right tabular-nums font-semibold ${r.roas === null ? 'text-slate-400' : r.roas >= 2 ? 'text-emerald-700' : r.roas < 1 ? 'text-red-600' : 'text-slate-900'}`}>
                        {r.roas === null ? '—' : `${r.roas.toFixed(2)}x`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="md:hidden divide-y divide-slate-100">
              {rows.map((r) => (
                <li key={r.id} onClick={() => open(r.id)} className="p-4 space-y-2 cursor-pointer active:bg-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900 truncate">{r.name}</p>
                    <Conn r={r} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      ['Pedidos', String(r.orders)],
                      ['Confirmados', String(r.confirmed)],
                      ['Ventas', cop(r.revenue)],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-slate-50 py-1.5">
                        <p className="text-[10px] text-slate-500">{k}</p>
                        <p className="text-[13px] font-semibold tabular-nums text-slate-900">{v}</p>
                      </div>
                    ))}
                  </div>
                  {r.ads && (
                    <p className="text-xs text-slate-500">
                      Gasto: <SpendCell s={spend[r.id]} ads={r.ads} /> · ROAS {r.roas === null ? '—' : `${r.roas.toFixed(2)}x`}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {!rows.length && <p className="py-12 text-center text-sm text-slate-500">Ninguna tienda con ese nombre.</p>}
          </>
        )}
      </section>
      <p className="text-xs text-slate-400">Ventas = pedidos confirmados, enviados o entregados. El gasto se suma solo de las cuentas en pesos (COP).</p>
    </div>
  );
}

function Conn({ r }: { r: Store }) {
  const dot = (on: boolean, Icon: typeof Bot, label: string) => (
    <span title={`${label}: ${on ? 'conectado' : 'sin conectar'}`} className={`w-6 h-6 rounded-md flex items-center justify-center ${on ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-300'}`}>
      <Icon className="w-3.5 h-3.5" />
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1">
      {dot(r.whatsapp, MessageCircle, `WhatsApp${r.whatsappPhone ? ` ${r.whatsappPhone}` : ''}`)}
      {dot(r.assistant, Bot, 'Asistente IA')}
      {dot(r.ads, Megaphone, 'Meta Ads')}
    </span>
  );
}

function SpendCell({ s, ads }: { s?: Spend; ads: boolean }) {
  if (!ads) return <span className="text-slate-300">—</span>;
  if (!s || s.loading) return <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300 inline" />;
  if (s.errors?.length && s.spend === undefined) return <span className="text-red-600 text-xs" title={s.errors.join('\n')}>Error</span>;
  return (
    <span title={s.errors?.length ? s.errors.join('\n') : undefined}>
      {cop(s.spend || 0)}
      {s.otherCurrency && <span className="text-[10px] text-slate-400"> +USD</span>}
      {!!s.errors?.length && <span className="text-red-500"> !</span>}
    </span>
  );
}
