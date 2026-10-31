'use client';

// Creativos: which ads sell (confirmed cash-on-delivery sales) and which spend without selling.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Flame, Image as ImageIcon, Info, Loader2, Megaphone, PlayCircle, RefreshCw, Trophy } from 'lucide-react';

type Range = 'today' | '7d' | '30d' | 'month';
type Flag = 'winner' | 'waste' | 'cancels';
interface Row {
  adId: string;
  name: string;
  campaign: string;
  status: string | null;
  thumb: string | null;
  kind: 'video' | 'image' | 'other' | null;
  spend: number;
  impressions: number;
  clicks: number;
  chats: number;
  metaChats: number;
  orders: number;
  confirmed: number;
  cancelled: number;
  revenue: number;
  cpa: number | null;
  roas: number | null;
  flags: Flag[];
}
interface Report {
  since: string;
  until: string;
  currency: string | null;
  sameCurrency: boolean;
  rows: Row[];
  totals: { spend: number; orders: number; confirmed: number; cancelled: number; revenue: number; chats: number; cpa: number | null; roas: number | null };
  unattributed: number;
  wasteMin: number;
  creativesError?: string | null;
}

const RANGES: { id: Range; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'month', label: 'Este mes' },
];
const FILTERS: { id: 'all' | Flag; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'winner', label: '🏆 Ganadores' },
  { id: 'waste', label: '🔥 Gastan sin vender' },
  { id: 'cancels', label: '⚠️ Se cancelan mucho' },
];
const FLAG: Record<Flag, { label: string; cls: string; Icon: typeof Trophy }> = {
  winner: { label: 'Ganador', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: Trophy },
  waste: { label: 'Gasta sin vender', cls: 'bg-red-50 text-red-700 border-red-200', Icon: Flame },
  cancels: { label: 'Se cancela mucho', cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: AlertTriangle },
};

const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';

export default function CreativesPage() {
  const [range, setRange] = useState<Range>('7d');
  const [filter, setFilter] = useState<'all' | Flag>('all');
  const [state, setState] = useState<{ loading: boolean; connected?: boolean; pending?: boolean; error?: string; expired?: boolean; report?: Report; account?: { name: string | null; currency: string | null } }>({ loading: true });

  const load = useCallback(async (r: Range) => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const res = await fetch(`/api/ads/report?range=${r}`, { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) return setState({ loading: false, error: d.error || `HTTP ${res.status}`, expired: Boolean(d.expired) });
      setState({ loading: false, connected: d.connected, pending: d.pending, report: d.report, account: d.account });
    } catch {
      setState({ loading: false, error: 'Sin conexión. Intenta de nuevo.' });
    }
  }, []);
  useEffect(() => {
    load(range);
  }, [range, load]);

  const money = (n: number) => {
    const cur = state.report?.currency || 'COP';
    return cur === 'COP' ? `$${Math.round(n).toLocaleString('es-CO')}` : `${n.toLocaleString('es-CO', { maximumFractionDigits: 2 })} ${cur}`;
  };
  const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
  const rows = useMemo(() => (state.report?.rows || []).filter((r) => filter === 'all' || r.flags.includes(filter)), [state.report, filter]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: state.report?.rows.length || 0, winner: 0, waste: 0, cancels: 0 };
    for (const r of state.report?.rows || []) r.flags.forEach((f) => c[f]++);
    return c;
  }, [state.report]);

  if (!state.loading && (state.connected === false || state.expired)) {
    return (
      <div className={`${card} p-8 text-center max-w-xl mx-auto`}>
        <Megaphone className="w-8 h-8 text-brand-blue mx-auto" />
        <h2 className="mt-3 text-lg font-semibold text-slate-900">{state.expired ? 'La conexión con Meta Ads venció' : state.pending ? 'Elige tu cuenta publicitaria' : 'Conecta tu cuenta de Meta Ads'}</h2>
        <p className="mt-2 text-sm text-slate-600">
          Konnexa junta el gasto de cada anuncio con los pedidos que realmente se confirmaron, para mostrarte qué creativos venden y cuáles gastan sin vender. Solo lectura: no
          puede cambiar ni gastar en tus anuncios.
        </p>
        <Link href="/integrations" className="mt-5 inline-flex h-11 px-5 items-center rounded-xl bg-brand-gradient text-white text-sm font-semibold">
          Ir a Integraciones
        </Link>
      </div>
    );
  }

  const rep = state.report;
  const t = rep?.totals;
  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Creativos</h2>
          <p className="text-sm text-slate-500">
            {state.account?.name ? `${state.account.name} · ` : ''}Gasto de Meta frente a ventas confirmadas en Konnexa.
          </p>
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
            <RefreshCw className={`w-4 h-4 ${state.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {state.error && <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{state.error}</div>}

      {t && rep && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            ['Gasto en anuncios', money(t.spend)],
            ['Chats desde anuncios', t.chats.toLocaleString('es-CO')],
            ['Pedidos', t.orders.toLocaleString('es-CO')],
            ['Confirmados', t.confirmed.toLocaleString('es-CO')],
            ['Costo por venta', t.cpa === null ? '—' : money(t.cpa)],
            ['ROAS real', t.roas === null ? '—' : `${t.roas.toFixed(2)}x`],
          ].map(([k, v]) => (
            <div key={k} className={`${card} p-4`}>
              <p className="text-xs text-slate-500">{k}</p>
              <p className="text-lg font-semibold text-slate-900 tabular-nums mt-0.5">{v}</p>
            </div>
          ))}
        </div>
      )}

      {rep?.creativesError && (
        <div className="rounded-xl bg-amber-50 text-amber-900 text-[13px] px-4 py-3 flex gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>No pudimos traer las imágenes de los anuncios desde Meta: {rep.creativesError}</p>
        </div>
      )}

      {rep && (rep.unattributed > 0 || !rep.sameCurrency) && (
        <div className="rounded-xl bg-sky-50 text-sky-900 text-[13px] px-4 py-3 flex gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            {rep.unattributed > 0 && (
              <p>
                {rep.unattributed === 1 ? '1 pedido de este periodo no dice' : `${rep.unattributed} pedidos de este periodo no dicen`} de qué anuncio vino. En tus anuncios, en <b>Parámetros de URL</b>, pon:{' '}
                <code className="bg-white/70 rounded px-1">utm_source=facebook&amp;utm_campaign={'{{campaign.name}}'}&amp;utm_content={'{{ad.id}}'}</code>
              </p>
            )}
            {!rep.sameCurrency && <p>Tu cuenta publicitaria cobra en {rep.currency} y tus ventas están en COP, así que no calculamos el ROAS.</p>}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`h-8 px-3 rounded-full text-[12.5px] font-medium border transition ${filter === f.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
          >
            {f.label} <span className="opacity-60">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      <section className={card}>
        {state.loading && !rep ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
          </div>
        ) : !rows.length ? (
          <p className="py-14 text-center text-sm text-slate-500">{filter === 'all' ? 'No hay anuncios con gasto ni pedidos en este periodo.' : 'Ningún anuncio en este grupo. 👌'}</p>
        ) : (
          <>
            {/* desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-2.5 font-medium">Creativo</th>
                    <th className="px-3 py-2.5 font-medium text-right">Gasto</th>
                    <th className="px-3 py-2.5 font-medium text-right">Clics</th>
                    <th className="px-3 py-2.5 font-medium text-right">Chats</th>
                    <th className="px-3 py-2.5 font-medium text-right">Pedidos</th>
                    <th className="px-3 py-2.5 font-medium text-right">Confirmados</th>
                    <th className="px-3 py-2.5 font-medium text-right">Ventas</th>
                    <th className="px-3 py-2.5 font-medium text-right">Costo/venta</th>
                    <th className="px-4 py-2.5 font-medium text-right">ROAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.adId} className={r.flags.includes('waste') ? 'bg-red-50/30' : r.flags.includes('winner') ? 'bg-emerald-50/30' : ''}>
                      <td className="px-4 py-3">
                        <AdCell r={r} />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium">{money(r.spend)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.clicks.toLocaleString('es-CO')}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{Math.max(r.chats, r.metaChats).toLocaleString('es-CO')}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {r.orders}
                        {r.cancelled > 0 && <span className="block text-[11px] text-slate-400">{r.cancelled} cancel.</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-900">{r.confirmed}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{cop(r.revenue)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.cpa === null ? '—' : money(r.cpa)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${r.roas === null ? 'text-slate-400' : r.roas >= 2 ? 'text-emerald-700' : r.roas < 1 ? 'text-red-600' : 'text-slate-900'}`}>
                        {r.roas === null ? '—' : `${r.roas.toFixed(2)}x`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* mobile cards */}
            <ul className="md:hidden divide-y divide-slate-100">
              {rows.map((r) => (
                <li key={r.adId} className="p-4 space-y-3">
                  <AdCell r={r} />
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      ['Gasto', money(r.spend)],
                      ['Confirmados', String(r.confirmed)],
                      ['ROAS', r.roas === null ? '—' : `${r.roas.toFixed(2)}x`],
                      ['Pedidos', String(r.orders)],
                      ['Ventas', cop(r.revenue)],
                      ['Costo/venta', r.cpa === null ? '—' : money(r.cpa)],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-slate-50 py-1.5">
                        <p className="text-[10px] text-slate-500">{k}</p>
                        <p className="text-[13px] font-semibold tabular-nums text-slate-900">{v}</p>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      {rep && (
        <p className="text-xs text-slate-400">
          Confirmados = pedidos confirmados, enviados o entregados. "Gasta sin vender" = gastó al menos {money(rep.wasteMin)} sin ninguna venta confirmada. El gasto viene de Meta y se
          actualiza cada 10 minutos.
        </p>
      )}
    </div>
  );
}

function AdCell({ r }: { r: Row }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="relative w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
        {r.thumb && !broken ? (
          <img src={r.thumb} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        ) : (
          <ImageIcon className="w-5 h-5 text-slate-300" />
        )}
        {r.kind === 'video' && <PlayCircle className="absolute w-5 h-5 text-white drop-shadow" />}
      </div>
      <div className="min-w-0">
        <p className="font-medium text-slate-900 truncate max-w-[280px]" title={r.name}>
          {r.name}
        </p>
        <p className="text-[11px] text-slate-500 truncate max-w-[280px]">
          {r.campaign || `id ${r.adId}`}
          {r.status && r.status !== 'ACTIVE' && <span className="ml-1 text-slate-400">· {r.status === 'PAUSED' ? 'pausado' : r.status.toLowerCase()}</span>}
        </p>
        {r.flags.length > 0 && (
          <div className="mt-1 flex gap-1 flex-wrap">
            {r.flags.map((f) => {
              const F = FLAG[f];
              return (
                <span key={f} className={`inline-flex items-center gap-1 text-[10px] font-semibold border rounded-full px-1.5 py-0.5 ${F.cls}`}>
                  <F.Icon className="w-3 h-3" /> {F.label}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
