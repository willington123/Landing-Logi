'use client';

// Creativos: which ads sell (confirmed cash-on-delivery sales) and which spend without selling.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, Copy, ExternalLink, Eye, Flame, X, Image as ImageIcon, Info, Loader2, Megaphone, PlayCircle, RefreshCw, Trophy } from 'lucide-react';

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

const URL_PARAMS = 'utm_source=facebook&utm_campaign={{campaign.name}}&utm_content={{ad.id}}';

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          window.prompt('Copia este texto:', text);
        }
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
      className="shrink-0 h-8 px-3 rounded-lg bg-sky-700 text-white text-[12px] font-semibold inline-flex items-center gap-1.5"
    >
      {done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {done ? 'Copiado' : 'Copiar texto'}
    </button>
  );
}

const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';

export default function CreativesPage() {
  const [range, setRange] = useState<Range>('7d');
  const [filter, setFilter] = useState<'all' | Flag>('all');
  const [openAd, setOpenAd] = useState<Row | null>(null);
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
              <div className="space-y-2">
                <p>
                  {rep.unattributed === 1 ? '1 pedido de este periodo no dice' : `${rep.unattributed} pedidos de este periodo no dicen`} de qué anuncio vino. Para que cada pedido
                  quede ligado a su anuncio: en el Administrador de anuncios, pestaña <b>Anuncios</b>, selecciónalos todos → <b>Editar</b> → <b>Seguimiento → Parámetros de URL</b> y
                  pega este texto (una sola vez para todos):
                </p>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <code className="bg-white/80 rounded-lg px-2 py-1.5 text-[12px] break-all">{URL_PARAMS}</code>
                  <CopyButton text={URL_PARAMS} />
                </div>
              </div>
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
                        <AdCell r={r} onOpen={setOpenAd} />
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
                  <AdCell r={r} onOpen={setOpenAd} />
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
      {openAd && <AdPreview r={openAd} money={money} onClose={() => setOpenAd(null)} />}
    </div>
  );
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'activo', cls: 'text-emerald-600' },
  PAUSED: { label: 'pausado', cls: 'text-slate-400' },
  CAMPAIGN_PAUSED: { label: 'campaña pausada', cls: 'text-slate-400' },
  ADSET_PAUSED: { label: 'conjunto pausado', cls: 'text-slate-400' },
  IN_PROCESS: { label: 'en revisión', cls: 'text-amber-600' },
  PENDING_REVIEW: { label: 'en revisión', cls: 'text-amber-600' },
  PREAPPROVED: { label: 'en revisión', cls: 'text-amber-600' },
  DISAPPROVED: { label: 'rechazado', cls: 'text-red-600' },
  WITH_ISSUES: { label: 'con problemas', cls: 'text-red-600' },
  PENDING_BILLING_INFO: { label: 'falta método de pago', cls: 'text-red-600' },
  ARCHIVED: { label: 'archivado', cls: 'text-slate-400' },
  DELETED: { label: 'eliminado', cls: 'text-slate-400' },
};
const statusOf = (s: string | null) => (s ? STATUS_LABEL[s.toUpperCase()] || { label: s.toLowerCase().replace(/_/g, ' '), cls: 'text-slate-400' } : null);

function AdCell({ r, onOpen }: { r: Row; onOpen: (r: Row) => void }) {
  const [broken, setBroken] = useState(false);
  const st = statusOf(r.status);
  return (
    <div className="flex items-center gap-3 min-w-0">
      <button
        type="button"
        onClick={() => onOpen(r)}
        className="group relative w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center ring-1 ring-slate-200 hover:ring-2 hover:ring-brand-blue transition"
        aria-label={`Ver el anuncio ${r.name}`}
        title="Ver el anuncio"
      >
        {r.thumb && !broken ? (
          <img src={r.thumb} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        ) : (
          <ImageIcon className="w-5 h-5 text-slate-300" />
        )}
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition flex items-center justify-center">
          {r.kind === 'video' ? <PlayCircle className="w-7 h-7 text-white drop-shadow" /> : <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 drop-shadow" />}
        </span>
      </button>
      <div className="min-w-0">
        <button type="button" onClick={() => onOpen(r)} className="block font-medium text-slate-900 truncate max-w-[280px] text-left hover:text-brand-blue" title={r.name}>
          {r.name}
        </button>
        <p className="text-[11px] text-slate-500 truncate max-w-[280px]">
          {r.campaign || `id ${r.adId}`}
          {st && <span className={`ml-1 ${st.cls}`}>· {st.label}</span>}
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

const FORMATS = [
  { id: 'MOBILE_FEED_STANDARD', label: 'Facebook', h: 640 },
  { id: 'INSTAGRAM_STANDARD', label: 'Instagram', h: 640 },
  { id: 'INSTAGRAM_STORY', label: 'Historias / Reels', h: 720 },
] as const;

function AdPreview({ r, money, onClose }: { r: Row; money: (n: number) => string; onClose: () => void }) {
  const [format, setFormat] = useState<(typeof FORMATS)[number]['id']>('MOBILE_FEED_STANDARD');
  const [mode, setMode] = useState<'preview' | 'video'>('preview');
  const [data, setData] = useState<{ src: string | null; video: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setData(null);
    setError(null);
    fetch(`/api/ads/preview?adId=${r.adId}&format=${format}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((d) => (d.success ? setData({ src: d.src, video: d.video }) : setError(d.error)))
      .catch(() => setError('Sin conexión. Intenta de nuevo.'));
  }, [r.adId, format]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const h = FORMATS.find((f) => f.id === format)!.h;
  const st = statusOf(r.status);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-[920px] max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold text-slate-900 truncate">{r.name}</h3>
            <p className="text-xs text-slate-500 truncate">
              {r.campaign} {st && <span className={st.cls}>· {st.label}</span>} <span className="text-slate-400">· id {r.adId}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid md:grid-cols-[minmax(0,1fr)_260px] gap-5 p-4 sm:p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[12.5px] font-medium text-slate-600 w-fit max-w-full overflow-x-auto">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setFormat(f.id);
                    setMode('preview');
                  }}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${mode === 'preview' && format === f.id ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
                >
                  {f.label}
                </button>
              ))}
              {data?.video && (
                <button onClick={() => setMode('video')} className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${mode === 'video' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}>
                  Solo video
                </button>
              )}
            </div>
            <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden" style={{ minHeight: 320 }}>
              {error ? (
                <p className="p-6 text-sm text-red-600 text-center">{error}</p>
              ) : !data ? (
                <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
              ) : mode === 'video' && data.video ? (
                <video src={data.video} controls autoPlay playsInline className="max-h-[70vh] w-auto max-w-full bg-black" />
              ) : data.src ? (
                <iframe src={data.src} title="Vista previa del anuncio" className="w-full max-w-[420px] border-0" style={{ height: h }} scrolling="no" />
              ) : data.video ? (
                <video src={data.video} controls playsInline className="max-h-[70vh] w-auto max-w-full bg-black" />
              ) : r.thumb ? (
                <img src={r.thumb} alt="" className="max-h-[60vh] w-auto" referrerPolicy="no-referrer" />
              ) : (
                <p className="p-6 text-sm text-slate-500">Meta no entregó una vista previa para este formato.</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {[
              ['Gasto', money(r.spend)],
              ['Clics', r.clicks.toLocaleString('es-CO')],
              ['Chats', Math.max(r.chats, r.metaChats).toLocaleString('es-CO')],
              ['Pedidos', `${r.orders}${r.cancelled ? ` (${r.cancelled} cancelados)` : ''}`],
              ['Confirmados', String(r.confirmed)],
              ['Ventas confirmadas', `$${Math.round(r.revenue).toLocaleString('es-CO')}`],
              ['Costo por venta', r.cpa === null ? '—' : money(r.cpa)],
              ['ROAS real', r.roas === null ? '—' : `${r.roas.toFixed(2)}x`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[13px]">
                <span className="text-slate-500">{k}</span>
                <span className="font-semibold text-slate-900 tabular-nums">{v}</span>
              </div>
            ))}
            <a
              href={`https://adsmanager.facebook.com/adsmanager/manage/ads?selected_ad_ids=${r.adId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
            >
              Abrir en el Administrador de anuncios <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
