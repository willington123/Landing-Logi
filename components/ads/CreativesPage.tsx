'use client';

// Creativos: which ads sell (confirmed cash-on-delivery sales) and which spend without selling.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, ChevronRight, Copy, ExternalLink, Eye, Flame, FlaskConical, LayoutGrid, List, X, Image as ImageIcon, Info, Loader2, Megaphone, PlayCircle, RefreshCw, ShoppingBag, Trophy } from 'lucide-react';

type Range = 'today' | '7d' | '30d' | 'month';
type Flag = 'winner' | 'waste' | 'cancels';
interface Row {
  adId: string;
  accountId: string | null;
  accountName: string | null;
  currency: string | null;
  name: string;
  campaign: string;
  adset?: string;
  status: string | null;
  thumb: string | null;
  thumbs?: string[];
  kind: 'video' | 'image' | 'other' | null;
  previewLink?: string | null;
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
  accounts?: { id: string; name: string | null; currency: string | null; error: string | null }[];
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

type GroupBy = 'ad' | 'adset' | 'campaign';
type Layout = 'table' | 'cards';
const GROUPS: { id: GroupBy; label: string }[] = [
  { id: 'campaign', label: 'Campaña' },
  { id: 'adset', label: 'Conjunto' },
  { id: 'ad', label: 'Anuncio' },
];

// A campaign or an ad set: the sum of its ads.
interface Group {
  key: string;
  level: 'campaign' | 'adset';
  name: string;
  campaign: string;
  accountName: string | null;
  currency: string | null;
  ads: Row[];
  children: Group[];
  spend: number;
  clicks: number;
  chats: number;
  orders: number;
  confirmed: number;
  cancelled: number;
  revenue: number;
  cpa: number | null;
  roas: number | null;
  flags: Flag[];
}

const NO_CAMPAIGN = '(sin campaña)';
const NO_ADSET = '(sin conjunto)';
const isCop = (cur: string | null) => !cur || cur.toUpperCase() === 'COP';

function makeGroup(level: Group['level'], key: string, name: string, ads: Row[], wasteMin: number, children: Group[] = []): Group {
  const g = ads.reduce(
    (a, r) => ({
      spend: a.spend + r.spend,
      clicks: a.clicks + r.clicks,
      chats: a.chats + Math.max(r.chats, r.metaChats),
      orders: a.orders + r.orders,
      confirmed: a.confirmed + r.confirmed,
      cancelled: a.cancelled + r.cancelled,
      revenue: a.revenue + r.revenue,
    }),
    { spend: 0, clicks: 0, chats: 0, orders: 0, confirmed: 0, cancelled: 0, revenue: 0 },
  );
  const currency = ads[0]?.currency ?? null;
  const flags: Flag[] = [];
  if (ads.some((r) => r.flags.includes('winner'))) flags.push('winner');
  if (!g.confirmed && g.spend >= wasteMin && g.spend > 0) flags.push('waste');
  if (g.orders >= 3 && g.cancelled / g.orders >= 0.4) flags.push('cancels');
  return {
    key,
    level,
    name,
    campaign: ads[0]?.campaign || NO_CAMPAIGN,
    accountName: ads[0]?.accountName ?? null,
    currency,
    ads,
    children,
    ...g,
    cpa: g.confirmed && g.spend ? g.spend / g.confirmed : null,
    roas: g.spend && isCop(currency) ? g.revenue / g.spend : null,
    flags,
  };
}

const bySpend = (a: { spend: number; revenue: number }, b: { spend: number; revenue: number }) => b.revenue - a.revenue || b.spend - a.spend;

function groupAds(rows: Row[], by: Exclude<GroupBy, 'ad'>, wasteMin: number): Group[] {
  const adsetsOf = (list: Row[], prefix: string) => {
    const m = new Map<string, Row[]>();
    for (const r of list) {
      const k = r.adset || NO_ADSET;
      m.set(k, [...(m.get(k) || []), r]);
    }
    return Array.from(m).map(([name, ads]) => makeGroup('adset', `${prefix}|${name}`, name, [...ads].sort(bySpend), wasteMin)).sort(bySpend);
  };
  const camps = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.accountId || ''}|${r.campaign || NO_CAMPAIGN}`;
    camps.set(k, [...(camps.get(k) || []), r]);
  }
  if (by === 'adset') return Array.from(camps).flatMap(([k, ads]) => adsetsOf(ads, k)).sort(bySpend);
  return Array.from(camps).map(([k, ads]) => makeGroup('campaign', k, ads[0].campaign || NO_CAMPAIGN, ads, wasteMin, adsetsOf(ads, k))).sort(bySpend);
}

// Performance columns of the cards board.
type Lane = 'winner' | 'cancels' | 'waste' | 'sells' | 'testing';
const LANES: { id: Lane; label: string; hint: string; cls: string; Icon: typeof Trophy }[] = [
  { id: 'winner', label: 'Ganadores', hint: 'Los que más venden con buen ROAS', cls: 'bg-emerald-500', Icon: Trophy },
  { id: 'sells', label: 'Venden', hint: 'Ya tienen ventas confirmadas', cls: 'bg-sky-500', Icon: ShoppingBag },
  { id: 'testing', label: 'En prueba', hint: 'Aún no gastan lo suficiente para juzgarlos', cls: 'bg-slate-400', Icon: FlaskConical },
  { id: 'waste', label: 'Gastan sin vender', hint: 'Gastaron sin ninguna venta confirmada', cls: 'bg-red-500', Icon: Flame },
  { id: 'cancels', label: 'Se cancelan mucho', hint: 'Muchos de sus pedidos se cancelan', cls: 'bg-amber-500', Icon: AlertTriangle },
];
const laneOf = (r: Row): Lane =>
  r.flags.includes('winner') ? 'winner' : r.flags.includes('cancels') ? 'cancels' : r.flags.includes('waste') ? 'waste' : r.confirmed > 0 ? 'sells' : 'testing';

function readPref<T extends string>(key: string, ok: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && ok.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function savePref(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {}
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

  const money = (n: number, cur?: string | null) =>
    !cur || cur.toUpperCase() === 'COP' ? `$${Math.round(n).toLocaleString('es-CO')}` : `${n.toLocaleString('es-CO', { maximumFractionDigits: 2 })} ${cur}`;
  const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
  const [acct, setAcct] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('ad');
  const [layout, setLayout] = useState<Layout>('table');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setGroupBy(readPref('kx.creativos.group', ['ad', 'adset', 'campaign'] as const, 'ad'));
    setLayout(readPref('kx.creativos.layout', ['table', 'cards'] as const, 'table'));
  }, []);
  const pickGroup = (g: GroupBy) => {
    setGroupBy(g);
    setExpanded(new Set());
    savePref('kx.creativos.group', g);
  };
  const pickLayout = (l: Layout) => {
    setLayout(l);
    savePref('kx.creativos.layout', l);
  };
  const toggle = useCallback((k: string) => setExpanded((s) => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    return n;
  }), []);
  const accounts = state.report?.accounts || [];
  const wasteMin = state.report?.wasteMin ?? 0;
  const byAccount = useMemo(() => (state.report?.rows || []).filter((r) => !acct || r.accountId === acct), [state.report, acct]);
  const rows = useMemo(() => byAccount.filter((r) => filter === 'all' || r.flags.includes(filter)), [byAccount, filter]);
  const groups = useMemo(() => (groupBy === 'ad' ? [] : groupAds(byAccount, groupBy, wasteMin)), [byAccount, groupBy, wasteMin]);
  const shownGroups = useMemo(() => groups.filter((g) => filter === 'all' || g.flags.includes(filter)), [groups, filter]);
  const counts = useMemo(() => {
    const list: { flags: Flag[] }[] = groupBy === 'ad' ? byAccount : groups;
    const c: Record<string, number> = { all: list.length, winner: 0, waste: 0, cancels: 0 };
    for (const r of list) r.flags.forEach((f) => c[f]++);
    return c;
  }, [byAccount, groups, groupBy]);
  const empty = groupBy === 'ad' ? !rows.length : !shownGroups.length;
  const unit = groupBy === 'campaign' ? 'campaña' : groupBy === 'adset' ? 'conjunto' : 'anuncio';
  // Totals of what is on screen (COP accounts only; other currencies can't be added to COP sales).
  const view = useMemo(() => {
    const cops = byAccount.filter((r) => !r.currency || r.currency.toUpperCase() === 'COP');
    const t = cops.reduce((a, r) => ({ spend: a.spend + r.spend, orders: a.orders + r.orders, confirmed: a.confirmed + r.confirmed, revenue: a.revenue + r.revenue, chats: a.chats + r.chats }), { spend: 0, orders: 0, confirmed: 0, revenue: 0, chats: 0 });
    return { ...t, cpa: t.confirmed && t.spend ? t.spend / t.confirmed : null, roas: t.spend ? t.revenue / t.spend : null };
  }, [byAccount]);

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
  const t = rep ? view : null;
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

      {rep && (rep.unattributed > 0 || !rep.sameCurrency || accounts.some((a) => a.error)) && (
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
            {!rep.sameCurrency && (
              <p>
                {accounts.filter((a) => a.currency && a.currency !== 'COP').map((a) => a.name || a.id).join(', ') || 'Una cuenta'} cobra en otra moneda: su gasto se muestra en esa
                moneda, pero no se suma a los totales ni tiene ROAS (tus ventas están en COP).
              </p>
            )}
            {accounts.filter((a) => a.error).map((a) => (
              <p key={a.id} className="text-red-700">
                No pudimos leer la cuenta {a.name || a.id}: {a.error}
              </p>
            ))}
          </div>
        </div>
      )}

      {accounts.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-500 mr-1">Cuenta:</span>
          {[{ id: '', name: 'Todas', currency: null, error: null }, ...accounts].map((a) => (
            <button
              key={a.id || 'all'}
              onClick={() => setAcct(a.id)}
              className={`h-8 px-3 rounded-full text-[12.5px] font-medium border transition ${acct === a.id ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
              title={a.id ? `act_${a.id}` : undefined}
            >
              {a.name || `act_${a.id}`}
              {a.currency && a.currency !== 'COP' && <span className="opacity-60"> · {a.currency}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">Ver por:</span>
          <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl text-[13px] font-medium text-slate-600">
            {GROUPS.map((g) => (
              <button key={g.id} onClick={() => pickGroup(g.id)} className={`px-3 py-1.5 rounded-lg transition ${groupBy === g.id ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl text-[13px] font-medium text-slate-600 w-fit">
          {(
            [
              ['table', 'Tabla', List],
              ['cards', 'Tarjetas', LayoutGrid],
            ] as const
          ).map(([id, label, Icon]) => (
            <button key={id} onClick={() => pickLayout(id)} className={`px-3 py-1.5 rounded-lg transition inline-flex items-center gap-1.5 ${layout === id ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

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

      {state.loading && !rep ? (
        <section className={`${card} py-16 flex justify-center`}>
          <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
        </section>
      ) : empty ? (
        <section className={card}>
          <p className="py-14 text-center text-sm text-slate-500">
            {filter === 'all' ? 'No hay anuncios con gasto ni pedidos en este periodo.' : groupBy === 'ad' ? 'Ningún anuncio en este grupo. 👌' : `Ningún ${unit} en este grupo. 👌`}
          </p>
        </section>
      ) : layout === 'cards' ? (
        groupBy === 'ad' ? (
          <Board rows={rows} money={money} cop={cop} onOpen={setOpenAd} />
        ) : (
          <div className="space-y-4">
            {shownGroups.map((g) => (
              <GroupCards key={g.key} g={g} showCampaign={groupBy === 'adset'} money={money} cop={cop} onOpen={setOpenAd} />
            ))}
          </div>
        )
      ) : groupBy === 'ad' ? (
        <section className={card}>
          {/* desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-[13px]">
              <TableHead first="Creativo" />
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <AdTr key={r.adId} r={r} money={money} cop={cop} onOpen={setOpenAd} />
                ))}
              </tbody>
            </table>
          </div>
          {/* mobile cards */}
          <ul className="md:hidden divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.adId} className="p-4 space-y-3">
                <AdCell r={r} onOpen={setOpenAd} />
                <MiniStats m={adMetrics(r)} money={money} cop={cop} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className={card}>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-[13px]">
              <TableHead first={groupBy === 'campaign' ? 'Campaña' : 'Conjunto'} />
              <tbody className="divide-y divide-slate-100">
                {shownGroups.map((g) => (
                  <GroupTrs key={g.key} g={g} depth={0} showCampaign={groupBy === 'adset'} expanded={expanded} toggle={toggle} money={money} cop={cop} onOpen={setOpenAd} />
                ))}
              </tbody>
            </table>
          </div>
          <ul className="md:hidden divide-y divide-slate-100">
            {shownGroups.map((g) => (
              <GroupMobile key={g.key} g={g} depth={0} showCampaign={groupBy === 'adset'} expanded={expanded} toggle={toggle} money={money} cop={cop} onOpen={setOpenAd} />
            ))}
          </ul>
        </section>
      )}
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

type Money = (n: number, cur?: string | null) => string;
interface Metrics {
  spend: number;
  clicks: number;
  chats: number;
  orders: number;
  confirmed: number;
  cancelled: number;
  revenue: number;
  cpa: number | null;
  roas: number | null;
  currency: string | null;
}
const adMetrics = (r: Row): Metrics => ({ ...r, chats: Math.max(r.chats, r.metaChats) });
const roasCls = (roas: number | null) => (roas === null ? 'text-slate-400' : roas >= 2 ? 'text-emerald-700' : roas < 1 ? 'text-red-600' : 'text-slate-900');
const rowTint = (flags: Flag[]) => (flags.includes('waste') ? 'bg-red-50/30' : flags.includes('winner') ? 'bg-emerald-50/30' : '');

function TableHead({ first }: { first: string }) {
  return (
    <thead>
      <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
        <th className="px-4 py-2.5 font-medium">{first}</th>
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
  );
}

function MetricTds({ m, money, cop }: { m: Metrics; money: Money; cop: (n: number) => string }) {
  return (
    <>
      <td className="px-3 py-3 text-right tabular-nums font-medium">{money(m.spend, m.currency)}</td>
      <td className="px-3 py-3 text-right tabular-nums">{m.clicks.toLocaleString('es-CO')}</td>
      <td className="px-3 py-3 text-right tabular-nums">{m.chats.toLocaleString('es-CO')}</td>
      <td className="px-3 py-3 text-right tabular-nums">
        {m.orders}
        {m.cancelled > 0 && <span className="block text-[11px] text-slate-400">{m.cancelled} cancel.</span>}
      </td>
      <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-900">{m.confirmed}</td>
      <td className="px-3 py-3 text-right tabular-nums">{cop(m.revenue)}</td>
      <td className="px-3 py-3 text-right tabular-nums">{m.cpa === null ? '—' : money(m.cpa, m.currency)}</td>
      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${roasCls(m.roas)}`}>{m.roas === null ? '—' : `${m.roas.toFixed(2)}x`}</td>
    </>
  );
}

function MiniStats({ m, money, cop }: { m: Metrics; money: Money; cop: (n: number) => string }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {[
        ['Gasto', money(m.spend, m.currency)],
        ['Confirmados', String(m.confirmed)],
        ['ROAS', m.roas === null ? '—' : `${m.roas.toFixed(2)}x`],
        ['Pedidos', String(m.orders)],
        ['Ventas', cop(m.revenue)],
        ['Costo/venta', m.cpa === null ? '—' : money(m.cpa, m.currency)],
      ].map(([k, v]) => (
        <div key={k} className="rounded-lg bg-slate-50 py-1.5">
          <p className="text-[10px] text-slate-500">{k}</p>
          <p className="text-[13px] font-semibold tabular-nums text-slate-900">{v}</p>
        </div>
      ))}
    </div>
  );
}

function FlagBadges({ flags }: { flags: Flag[] }) {
  if (!flags.length) return null;
  return (
    <div className="mt-1 flex gap-1 flex-wrap">
      {flags.map((f) => {
        const F = FLAG[f];
        return (
          <span key={f} className={`inline-flex items-center gap-1 text-[10px] font-semibold border rounded-full px-1.5 py-0.5 ${F.cls}`}>
            <F.Icon className="w-3 h-3" /> {F.label}
          </span>
        );
      })}
    </div>
  );
}

function AdTr({ r, money, cop, onOpen, depth = 0 }: { r: Row; money: Money; cop: (n: number) => string; onOpen: (r: Row) => void; depth?: number }) {
  return (
    <tr className={depth ? 'bg-slate-50/50' : rowTint(r.flags)}>
      <td className="px-4 py-3" style={depth ? { paddingLeft: 16 + depth * 28 } : undefined}>
        <AdCell r={r} onOpen={onOpen} />
      </td>
      <MetricTds m={adMetrics(r)} money={money} cop={cop} />
    </tr>
  );
}

const groupSub = (g: Group, showCampaign: boolean) =>
  [showCampaign ? g.campaign : '', g.level === 'campaign' ? `${g.children.length} ${g.children.length === 1 ? 'conjunto' : 'conjuntos'}` : '', `${g.ads.length} ${g.ads.length === 1 ? 'anuncio' : 'anuncios'}`, g.accountName || '']
    .filter(Boolean)
    .join(' · ');

// Small stack of the group's ad thumbnails.
function Thumbs({ ads }: { ads: Row[] }) {
  return (
    <div className="flex -space-x-3 shrink-0">
      {ads.slice(0, 3).map((r) => (
        <div key={r.adId} className="relative w-10 h-10 rounded-lg bg-slate-100 overflow-hidden ring-2 ring-white flex items-center justify-center">
          <ImageIcon className="absolute w-4 h-4 text-slate-300" />
          <AdImage r={r} className="relative w-full h-full object-cover" />
        </div>
      ))}
    </div>
  );
}

interface GroupProps {
  g: Group;
  depth: number;
  showCampaign: boolean;
  expanded: Set<string>;
  toggle: (k: string) => void;
  money: Money;
  cop: (n: number) => string;
  onOpen: (r: Row) => void;
}

function GroupTrs({ g, depth, showCampaign, expanded, toggle, money, cop, onOpen }: GroupProps) {
  const open = expanded.has(g.key);
  return (
    <>
      <tr className={`${depth ? 'bg-slate-50/50' : rowTint(g.flags)} cursor-pointer hover:bg-slate-50`} onClick={() => toggle(g.key)}>
        <td className="px-4 py-3" style={depth ? { paddingLeft: 16 + depth * 28 } : undefined}>
          <div className="flex items-center gap-3 min-w-0">
            <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition ${open ? 'rotate-90' : ''}`} />
            <Thumbs ads={g.ads} />
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 truncate max-w-[280px]" title={g.name}>
                {g.name}
              </p>
              <p className="text-[11px] text-slate-500 truncate max-w-[280px]">{groupSub(g, showCampaign)}</p>
              <FlagBadges flags={g.flags} />
            </div>
          </div>
        </td>
        <MetricTds m={g} money={money} cop={cop} />
      </tr>
      {open &&
        (g.level === 'campaign'
          ? g.children.map((c) => <GroupTrs key={c.key} g={c} depth={depth + 1} showCampaign={false} expanded={expanded} toggle={toggle} money={money} cop={cop} onOpen={onOpen} />)
          : g.ads.map((r) => <AdTr key={r.adId} r={r} depth={depth + 1} money={money} cop={cop} onOpen={onOpen} />))}
    </>
  );
}

function GroupMobile({ g, depth, showCampaign, expanded, toggle, money, cop, onOpen }: GroupProps) {
  const open = expanded.has(g.key);
  return (
    <li className={depth ? 'border-l-2 border-slate-200 ml-3' : ''}>
      <button type="button" onClick={() => toggle(g.key)} className="w-full text-left p-4 space-y-3">
        <div className="flex items-center gap-3 min-w-0">
          <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition ${open ? 'rotate-90' : ''}`} />
          <Thumbs ads={g.ads} />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">{g.name}</p>
            <p className="text-[11px] text-slate-500 truncate">{groupSub(g, showCampaign)}</p>
            <FlagBadges flags={g.flags} />
          </div>
        </div>
        <MiniStats m={g} money={money} cop={cop} />
      </button>
      {open && (
        <ul className="divide-y divide-slate-100 pb-2">
          {g.level === 'campaign'
            ? g.children.map((c) => <GroupMobile key={c.key} g={c} depth={depth + 1} showCampaign={false} expanded={expanded} toggle={toggle} money={money} cop={cop} onOpen={onOpen} />)
            : g.ads.map((r) => (
                <li key={r.adId} className="p-4 space-y-3 ml-3 border-l-2 border-slate-200">
                  <AdCell r={r} onOpen={onOpen} />
                  <MiniStats m={adMetrics(r)} money={money} cop={cop} />
                </li>
              ))}
        </ul>
      )}
    </li>
  );
}

// One ad as a card: big image, where it lives and how it sells.
function AdCard({ r, money, cop, onOpen, hideAdset }: { r: Row; money: Money; cop: (n: number) => string; onOpen: (r: Row) => void; hideAdset?: boolean }) {
  const st = statusOf(r.status);
  const m = adMetrics(r);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.05)] overflow-hidden flex flex-col">
      <button type="button" onClick={() => onOpen(r)} className="group relative aspect-square bg-slate-100 flex items-center justify-center overflow-hidden" aria-label={`Ver el anuncio ${r.name}`}>
        <ImageIcon className="absolute w-7 h-7 text-slate-300" />
        <AdImage r={r} className="relative w-full h-full object-cover" />
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
          {r.kind === 'video' ? <PlayCircle className="w-10 h-10 text-white drop-shadow" /> : <Eye className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 drop-shadow" />}
        </span>
        {st && <span className={`absolute top-2 left-2 text-[10px] font-semibold bg-white/90 rounded-full px-2 py-0.5 ${st.cls}`}>{st.label}</span>}
      </button>
      <div className="p-3 space-y-2 flex-1 flex flex-col">
        <div className="min-w-0">
          <button type="button" onClick={() => onOpen(r)} className="block w-full font-medium text-[13px] text-slate-900 truncate text-left hover:text-brand-blue" title={r.name}>
            {r.name}
          </button>
          <p className="text-[11px] text-slate-500 truncate" title={[r.campaign, r.adset].filter(Boolean).join(' · ')}>
            {[r.campaign || `id ${r.adId}`, hideAdset ? '' : r.adset].filter(Boolean).join(' · ')}
          </p>
          <FlagBadges flags={r.flags} />
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[11px] mt-auto">
          {[
            ['Gasto', money(m.spend, m.currency)],
            [`Ventas (${m.confirmed})`, cop(m.revenue)],
            ['ROAS', m.roas === null ? '—' : `${m.roas.toFixed(2)}x`],
            ['Costo/venta', m.cpa === null ? '—' : money(m.cpa, m.currency)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md bg-slate-50 px-2 py-1">
              <p className="text-[10px] text-slate-500">{k}</p>
              <p className={`font-semibold tabular-nums truncate ${k === 'ROAS' ? roasCls(m.roas) : 'text-slate-900'}`}>{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Ads in columns by how they perform, like the orders board.
function Board({ rows, money, cop, onOpen }: { rows: Row[]; money: Money; cop: (n: number) => string; onOpen: (r: Row) => void }) {
  const lanes = LANES.map((l) => ({ ...l, ads: rows.filter((r) => laneOf(r) === l.id) }));
  return (
    <div className="overflow-x-auto -mx-4 px-4 pb-2">
      <div className="flex gap-3 items-start min-w-max xl:min-w-0">
        {lanes.map((l) => {
          const spend = l.ads.filter((r) => isCop(r.currency)).reduce((a, r) => a + r.spend, 0);
          return (
            <div key={l.id} className="w-[240px] shrink-0 xl:w-0 xl:flex-1 xl:min-w-[190px] rounded-2xl bg-slate-100/80 border border-slate-200/70 flex flex-col max-h-[calc(100vh-220px)]">
              <div className="px-3 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${l.cls}`} />
                  <l.Icon className="w-3.5 h-3.5 text-slate-500" />
                  <p className="text-[13px] font-semibold text-slate-800 flex-1">{l.label}</p>
                  <span className="text-[11px] font-semibold text-slate-500 bg-white rounded-full px-2 py-0.5">{l.ads.length}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{l.hint}</p>
                <p className="text-[11px] text-slate-700 font-medium tabular-nums">Gasto {money(spend)}</p>
              </div>
              <div className="px-2 pb-2 space-y-2 overflow-y-auto">
                {l.ads.length ? (
                  l.ads.map((r) => <AdCard key={r.adId} r={r} money={money} cop={cop} onOpen={onOpen} />)
                ) : (
                  <p className="text-[12px] text-slate-400 text-center py-6 px-2">Ningún anuncio aquí</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// A campaign or ad set with its ads as cards.
function GroupCards({ g, showCampaign, money, cop, onOpen }: { g: Group; showCampaign: boolean; money: Money; cop: (n: number) => string; onOpen: (r: Row) => void }) {
  return (
    <section className={`${card} p-4`}>
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate" title={g.name}>
            {g.name}
          </p>
          <p className="text-[11px] text-slate-500 truncate">{groupSub(g, showCampaign)}</p>
          <FlagBadges flags={g.flags} />
        </div>
        <div className="flex gap-2 flex-wrap text-[12px]">
          {[
            ['Gasto', money(g.spend, g.currency)],
            ['Confirmados', String(g.confirmed)],
            ['Ventas', cop(g.revenue)],
            ['Costo/venta', g.cpa === null ? '—' : money(g.cpa, g.currency)],
            ['ROAS', g.roas === null ? '—' : `${g.roas.toFixed(2)}x`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-slate-50 px-2.5 py-1">
              <p className="text-[10px] text-slate-500">{k}</p>
              <p className={`font-semibold tabular-nums ${k === 'ROAS' ? roasCls(g.roas) : 'text-slate-900'}`}>{v}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {g.ads.map((r) => (
          <AdCard key={r.adId} r={r} money={money} cop={cop} onOpen={onOpen} hideAdset={g.level === 'adset'} />
        ))}
      </div>
    </section>
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

// Tries each image Meta gave, best first, until one loads.
function AdImage({ r, className }: { r: Row; className: string }) {
  const list = r.thumbs?.length ? r.thumbs : r.thumb ? [r.thumb] : [];
  const [i, setI] = useState(0);
  if (i >= list.length) return null;
  return <img src={list[i]} alt="" className={className} loading="lazy" referrerPolicy="no-referrer" onError={() => setI((n) => n + 1)} />;
}

function AdCell({ r, onOpen }: { r: Row; onOpen: (r: Row) => void }) {
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
        <ImageIcon className="absolute w-5 h-5 text-slate-300" />
        <AdImage r={r} className="relative w-full h-full object-cover" />
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
          {r.adset && <span className="text-slate-400"> · {r.adset}</span>}
          {r.accountName && <span className="ml-1 text-slate-400">· {r.accountName}</span>}
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

function AdPreview({ r, money, onClose }: { r: Row; money: (n: number, cur?: string | null) => string; onClose: () => void }) {
  const [format, setFormat] = useState<(typeof FORMATS)[number]['id']>('MOBILE_FEED_STANDARD');
  const [mode, setMode] = useState<'preview' | 'video'>('preview');
  const [data, setData] = useState<{ src: string | null; video: string | null; poster?: string | null; previewLink?: string | null; videoLink?: string | null; notes?: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setData(null);
    setError(null);
    fetch(`/api/ads/preview?adId=${r.adId}&format=${format}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((d) => (d.success ? setData({ src: d.src, video: d.video, poster: d.poster, previewLink: d.previewLink, videoLink: d.videoLink, notes: d.notes }) : setError(d.error)))
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
                <video src={data.video} poster={data.poster || r.thumbs?.[0] || undefined} controls autoPlay playsInline className="max-h-[70vh] w-auto max-w-full bg-black" />
              ) : data.src ? (
                <iframe src={data.src} title="Vista previa del anuncio" className="w-full max-w-[420px] border-0" style={{ height: h }} scrolling="no" />
              ) : data.video ? (
                <video src={data.video} poster={data.poster || r.thumbs?.[0] || undefined} controls playsInline className="max-h-[70vh] w-auto max-w-full bg-black" />
              ) : r.thumb ? (
                <AdImage r={r} className="max-h-[60vh] w-auto" />
              ) : (
                <p className="p-6 text-sm text-slate-500">Meta no entregó una vista previa para este formato.</p>
              )}
            </div>
            {data && (
              <div className="mt-2 space-y-1 text-[12px] text-slate-500">
                {mode === 'preview' && data.src && <p>¿La vista previa sale en blanco o no reproduce? Usa “Ver anuncio en Facebook”: abre el anuncio real con tu sesión de Facebook.</p>}
                {(data.notes || []).map((n) => (
                  <p key={n} className="text-amber-700">
                    {n}
                  </p>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {[
              ['Gasto', money(r.spend, r.currency)],
              ['Clics', r.clicks.toLocaleString('es-CO')],
              ['Chats', Math.max(r.chats, r.metaChats).toLocaleString('es-CO')],
              ['Pedidos', `${r.orders}${r.cancelled ? ` (${r.cancelled} cancelados)` : ''}`],
              ['Confirmados', String(r.confirmed)],
              ['Ventas confirmadas', `$${Math.round(r.revenue).toLocaleString('es-CO')}`],
              ['Costo por venta', r.cpa === null ? '—' : money(r.cpa, r.currency)],
              ['ROAS real', r.roas === null ? '—' : `${r.roas.toFixed(2)}x`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[13px]">
                <span className="text-slate-500">{k}</span>
                <span className="font-semibold text-slate-900 tabular-nums">{v}</span>
              </div>
            ))}
            {(data?.previewLink || r.previewLink) && (
              <a
                href={(data?.previewLink || r.previewLink)!}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 h-10 w-full rounded-xl bg-brand-gradient text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5"
              >
                Ver anuncio en Facebook <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {data?.videoLink && (
              <a
                href={data.videoLink}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 w-full rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
              >
                Ver el video en Facebook <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
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
