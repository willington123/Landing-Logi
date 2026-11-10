'use client';

// Inicio: what needs a person right now (chats the AI handed over, chats to pick up again) and how the AI is doing.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Bot, Clock, Loader2, Megaphone, RefreshCw, ShoppingCart, UserRound } from 'lucide-react';
import { TAG_COLORS } from '@/lib/crm';
import { ago, greeting, mergeHome, WINDOW_MS, type HomeChat, type HomeData } from '@/lib/home';
import StorePicker, { useInboxStores } from '@/components/crm/StorePicker';
import { storeColor } from '@/lib/inbox-stores';
import { daysLabel, rangeQuery, todayCo, type RangeValue } from '@/components/ads/DateRangePicker';

const PERIODS: { id: 'today' | 'yesterday' | '7d' | '30d'; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
];
const PREF = 'kx.inicio.range';
const EMPTY: HomeData = {
  range: 'today',
  since: '',
  until: '',
  hasChats: false,
  bot: { enabled: false, name: '' },
  help: { count: 0, items: [] },
  retake: { count: 0, items: [] },
  sales: { count: 0, revenue: 0 },
  attending: { count: 0, mine: false },
  ai: { chats: 0, solo: 0, team: 0, waiting: 0 },
};
const POLL_MS = 60_000;

const ORDER_LABEL: Record<string, string> = {
  pending_call: 'Pendiente',
  retry_scheduled: 'Pendiente',
  needs_review: 'Revisar',
  unanswered: 'No contesta',
  calling: 'Llamando',
  confirmed_by_voice: 'Confirmado',
  cancelled: 'Cancelado',
  shipped: 'En camino',
  delivered: 'Entregado',
  returned: 'Devuelto',
};

const money = (v: number) => `$${(v || 0).toLocaleString('es-CO')}`;
const MEDIA_LABEL: Record<string, string> = { image: '📷 Foto', audio: '🎤 Nota de voz', video: '🎬 Video', document: '📄 Documento', sticker: '🙂 Sticker' };
const preview = (t: string) => {
  const m = /^\[(image|audio|video|document|sticker)\]\s*(.*)$/.exec(t || '');
  return m ? `${MEDIA_LABEL[m[1]]}${m[2] ? `: ${m[2]}` : ''}` : t;
};

function periodWords(v: RangeValue, shown: { since?: string; until?: string }) {
  if (v.range === 'today') return { title: 'hoy', phrase: 'hoy' };
  if (v.range === 'yesterday') return { title: 'ayer', phrase: 'ayer' };
  if (v.range === '7d') return { title: '7 días', phrase: 'en los últimos 7 días' };
  if (v.range === '30d') return { title: '30 días', phrase: 'en los últimos 30 días' };
  const d = daysLabel(shown.since, shown.until);
  return { title: 'del periodo', phrase: d ? `del ${d}` : 'en esas fechas' };
}

function whatToDo(c: HomeChat, now: number) {
  if (c.reason === 'limit') return 'La IA llegó a su límite de respuestas del día con este cliente. Sigue tú la conversación.';
  if (c.reason === 'retake') {
    const left = c.lastInboundAt ? WINDOW_MS - (now - new Date(c.lastInboundAt).getTime()) : 0;
    const h = Math.max(0, Math.floor(left / 3600_000));
    const time = h >= 1 ? `quedan ${h} h` : 'queda menos de 1 h';
    if (c.followUpAt) return `La IA le envió un seguimiento hace ${ago(c.followUpAt, now)} y el cliente no ha respondido. Si quieres insistir, escríbele tú: ${time} para responder gratis.`;
    return `La IA contestó hace ${ago(c.since, now)} y el cliente no volvió a escribir. Nadie le ha hecho seguimiento: escríbele tú, ${time} para responder gratis.`;
  }
  const why = c.note ? `Necesita humano: ${c.note.replace(/\.$/, '')}` : 'La IA pidió una persona';
  return c.waiting && c.lastInboundAt ? `${why}. Lleva ${ago(c.lastInboundAt, now)} esperando y nadie le ha contestado.` : `${why}.`;
}

function ChatRow({ c, now, multi }: { c: HomeChat; now: number; multi: boolean }) {
  const initial = /^[a-zA-ZÀ-ÿñÑ]/.test(c.name.trim()) ? c.name.trim()[0].toUpperCase() : null;
  return (
    <li className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 sm:p-5">
      <div className="flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-4">
        <div className="flex items-start gap-3 min-w-0 lg:flex-[1.4]">
          <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${c.reason === 'retake' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'}`}>{initial || <UserRound className="w-4 h-4" />}</span>
          <div className="min-w-0">
            <p className="flex items-baseline gap-2 min-w-0">
              <span className="text-[15px] font-semibold text-slate-900 truncate">{c.name}</span>
              <span className="text-xs text-slate-400 shrink-0">hace {ago(c.since, now)}</span>
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {c.waiting ? (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">esperando respuesta</span>
              ) : c.reason === 'retake' ? (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">{c.followUpAt ? 'seguimiento enviado' : 'sin seguimiento'}</span>
              ) : null}
              {multi && c.store && <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${storeColor(c.org || '')}`}>{c.store}</span>}
              {c.fromAd && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-800">
                  <Megaphone className="w-3 h-3" /> Anuncio
                </span>
              )}
              {c.assignee && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{c.assignee}</span>}
            </div>
            {c.preview && <p className="mt-1.5 text-[13px] text-slate-600 line-clamp-2">{preview(c.preview)}</p>}
          </div>
        </div>

        {c.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 lg:flex-[0.8] lg:pt-1">
            {c.tags.map((t) => (
              <span key={t.name} className={`text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${TAG_COLORS[t.color]?.chip || TAG_COLORS.slate.chip}`}>
                {t.name}
              </span>
            ))}
          </div>
        )}

        <div className="lg:flex-[0.8] lg:border-l lg:border-slate-100 lg:pl-4 lg:pt-1 text-[13px]">
          {c.order ? (
            <>
              <p className="font-semibold text-slate-900">
                {c.order.number} · {ORDER_LABEL[c.order.status] || c.order.status}
              </p>
              <p className="text-slate-500 truncate">
                {c.order.product} · {money(c.order.total)}
              </p>
            </>
          ) : (
            <p className="text-slate-400">Sin pedido aún</p>
          )}
        </div>

        <Link
          href={`/crm?c=${encodeURIComponent(c.id)}${c.org ? `&org=${encodeURIComponent(c.org)}` : ''}`}
          className="h-10 px-4 rounded-xl bg-brand-blue hover:brightness-105 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 shrink-0 lg:self-center"
        >
          Atender <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <p className="mt-3 text-[13px] text-amber-800">
        <span className="font-semibold">Qué hacer:</span> {whatToDo(c, now)}
      </p>
    </li>
  );
}

export default function AttentionHome({ name, fallback }: { name?: string | null; fallback: React.ReactNode }) {
  const [range, setRangeS] = useState<RangeValue>({ range: 'today' });
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [tab, setTab] = useState<'help' | 'retake'>('help');
  const [now, setNow] = useState(() => Date.now());
  const [datesOpen, setDatesOpen] = useState(false);
  const [since, setSince] = useState(todayCo());
  const [until, setUntil] = useState(todayCo());
  const listRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef(range);
  rangeRef.current = range;

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(PREF) || 'null');
      if (v && (PERIODS.some((p) => p.id === v.range) || (v.range === 'custom' && v.since && v.until))) setRangeS(v);
    } catch {}
  }, []);
  const setRange = (v: RangeValue) => {
    setRangeS(v);
    try {
      localStorage.setItem(PREF, JSON.stringify(v));
    } catch {}
  };

  const { stores, chosen, sel } = useInboxStores();
  const multi = (stores?.length || 0) > 1;
  // The stores to add up: the ones chosen in "Bandejas que ves" (the session's store when there's no list).
  const targets = useMemo(() => (!stores ? null : stores.length ? (chosen || []).map((s) => ({ id: s.id, name: s.name, current: s.current })) : [{ id: '', name: '', current: true }]), [stores, chosen]);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  const load = useCallback(async (r: RangeValue) => {
    const list = targetsRef.current;
    if (!list) return;
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        list.map((s) =>
          fetch(`/api/home?${rangeQuery(r)}`, { cache: 'no-store', headers: s.current ? {} : { 'x-kx-org': s.id } })
            .then((res) => res.json())
            .then((d) => {
              if (!d.success) throw new Error(d.error || 'No se pudo cargar el inicio.');
              return { org: s.id, store: s.name, data: d as HomeData };
            }),
        ),
      );
      if (rangeRef.current !== r || targetsRef.current !== list) return;
      const okParts = results.flatMap((x) => (x.status === 'fulfilled' ? [x.value] : []));
      const firstErr = results.find((x) => x.status === 'rejected') as PromiseRejectedResult | undefined;
      if (!okParts.length && list.length) throw new Error(firstErr?.reason?.message || 'No se pudo cargar el inicio.');
      setData(mergeHome(okParts) || { ...EMPTY, hasChats: true });
      setError(null);
      setUpdatedAt(new Date());
      setNow(Date.now());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!targets) return;
    load(range);
    const t = setInterval(() => document.visibilityState === 'visible' && load(rangeRef.current), POLL_MS);
    return () => clearInterval(t);
  }, [range, load, targets]);

  const goList = (t: 'help' | 'retake') => {
    setTab(t);
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!data && !error) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  // No chats yet (WhatsApp not connected) or no database (local demo): the classic welcome.
  if ((data && !data.hasChats) || (!data && error)) return <>{fallback}</>;

  const first = (name || '').trim().split(/\s+/)[0];
  const words = periodWords(range, { since: data?.since, until: data?.until });
  const dateText =
    range.range === 'today'
      ? new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' })
      : daysLabel(data?.since, data?.until);
  const pct = data && data.ai.chats ? Math.round((data.ai.solo / data.ai.chats) * 100) : 0;
  const list = data ? (tab === 'help' ? data.help : data.retake) : null;
  const card = 'rounded-2xl border p-5 flex flex-col';

  return (
    <div className="space-y-6">
      {/* Greeting and period */}
      <section className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          {stores && multi && <StorePicker stores={stores} sel={sel} className="mb-4" />}
          <h2 className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-900 leading-tight">
            {greeting()}
            {first ? `, ${first}` : ''}
          </h2>
          <p className="text-[15px] text-slate-500 mt-1">Aquí tienes lo que necesita tu atención hoy.</p>
        </div>
        <div className="lg:text-right">
          <div className="relative inline-flex flex-wrap items-center gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setRange({ range: p.id })}
                className={`h-9 px-3.5 rounded-full text-sm font-medium transition ${range.range === p.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setDatesOpen((o) => !o)}
              className={`h-9 px-3.5 rounded-full text-sm font-medium transition ${range.range === 'custom' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              Fechas
            </button>
            {datesOpen && (
              <div className="absolute z-30 top-11 right-0 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 space-y-3 text-left">
                <label className="block text-[12px] text-slate-500">
                  Desde
                  <input type="date" value={since} max={until} onChange={(e) => setSince(e.target.value)} className="mt-1 w-full h-10 rounded-lg border border-slate-200 px-2 text-[14px] text-slate-900" />
                </label>
                <label className="block text-[12px] text-slate-500">
                  Hasta
                  <input type="date" value={until} min={since} max={todayCo()} onChange={(e) => setUntil(e.target.value)} className="mt-1 w-full h-10 rounded-lg border border-slate-200 px-2 text-[14px] text-slate-900" />
                </label>
                <button
                  disabled={!since || !until || since > until}
                  onClick={() => {
                    setRange({ range: 'custom', since, until });
                    setDatesOpen(false);
                  }}
                  className="w-full h-10 rounded-xl bg-brand-gradient text-white text-[13px] font-semibold disabled:opacity-40"
                >
                  Aplicar
                </button>
              </div>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1.5 flex items-center lg:justify-end gap-2">
            <span>{dateText}</span>
            {updatedAt && (
              <button onClick={() => load(range)} className="inline-flex items-center gap-1 hover:text-slate-700" title="Actualizar">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {updatedAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </button>
            )}
          </p>
        </div>
      </section>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}

      {data && (
        <>
          {/* What needs attention */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className={`${card} bg-amber-50/60 border-amber-200`}>
              <div className="flex items-start gap-3">
                <span className="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-slate-900">Necesitan tu ayuda</p>
                  <p className="text-[28px] font-bold text-slate-900 leading-tight tabular-nums">{data.help.count}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-2 flex-1">La IA pidió una persona, el cliente está esperando.</p>
              <button onClick={() => goList('help')} className="mt-4 h-10 rounded-xl bg-amber-100 hover:bg-amber-200/70 text-amber-900 text-sm font-semibold inline-flex items-center justify-center gap-1.5">
                Atender ahora <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className={`${card} bg-violet-50/40 border-violet-100`}>
              <div className="flex items-start gap-3">
                <span className="w-11 h-11 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-slate-900">Por retomar</p>
                  <p className="text-[28px] font-bold text-slate-900 leading-tight tabular-nums">{data.retake.count}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-2 flex-1">La IA contestó y el cliente lleva 2 h sin responder. Escríbeles tú.</p>
              <button onClick={() => goList('retake')} className="mt-4 h-10 rounded-xl bg-violet-100/70 hover:bg-violet-100 text-violet-800 text-sm font-semibold inline-flex items-center justify-center gap-1.5">
                Retomar <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className={`${card} bg-sky-50/40 border-sky-100`}>
              <div className="flex items-start gap-3">
                <span className="w-11 h-11 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-slate-900">Ventas {words.title}</p>
                  <p className="text-[28px] font-bold text-slate-900 leading-tight tabular-nums">{data.sales.count}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-2 flex-1">
                Pedidos confirmados{data.sales.revenue ? ` por ${money(data.sales.revenue)}` : ''}.
              </p>
              <Link href="/orders" className="mt-4 h-10 rounded-xl bg-sky-100/70 hover:bg-sky-100 text-sky-800 text-sm font-semibold inline-flex items-center justify-center gap-1.5">
                Ver mis ventas <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className={`${card} bg-emerald-50/40 border-emerald-100`}>
              <div className="flex items-start gap-3">
                <span className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <UserRound className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-slate-900">Atendiendo</p>
                  <p className="text-[28px] font-bold text-slate-900 leading-tight tabular-nums">{data.attending.count}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-2 flex-1">
                {data.attending.mine ? 'Las que has tomado y siguen abiertas.' : 'Las que tomó tu equipo y siguen abiertas.'}
              </p>
              <Link
                href={data.attending.mine ? '/crm?f=mine' : '/crm'}
                className="mt-4 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5"
              >
                Ver mis chats <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </section>

          {/* What the AI is doing */}
          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="flex items-center gap-3 text-[15px] text-slate-700">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </span>
              {!data.bot.enabled ? (
                <span>El asistente IA está apagado: todas las conversaciones las atiende tu equipo.</span>
              ) : data.ai.solo > 0 ? (
                <span>
                  La IA lleva sola <b className="text-slate-900">{data.ai.solo.toLocaleString('es-CO')}</b> {data.ai.solo === 1 ? 'conversación' : 'conversaciones'} {words.phrase} y van bien. No necesitas hacer nada.
                </span>
              ) : (
                <span>El asistente {data.bot.name} está encendido y responde solo cuando te escriben.</span>
              )}
            </p>
            {data.bot.enabled ? (
              <Link href="/crm" className="text-sm font-semibold text-brand-blue hover:underline inline-flex items-center gap-1 shrink-0">
                Ver conversaciones <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link href="/automations" className="text-sm font-semibold text-brand-blue hover:underline inline-flex items-center gap-1 shrink-0">
                Encender asistente <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">
            {/* Conversations that need attention */}
            <section ref={listRef} className="min-w-0 scroll-mt-24">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-900">Conversaciones que necesitan atención</h3>
                <Link href={tab === 'help' ? '/crm?f=handoff' : '/crm'} className="text-sm font-semibold text-brand-blue hover:underline inline-flex items-center gap-1 shrink-0">
                  Ver todas en la bandeja <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="mt-3 flex gap-1 border-b border-slate-200">
                {(
                  [
                    ['help', 'Necesitan ayuda', data.help.count],
                    ['retake', 'Por retomar', data.retake.count],
                  ] as const
                ).map(([k, label, n]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={`px-4 h-11 text-[15px] font-medium border-b-2 -mb-px transition ${tab === k ? 'border-brand-blue text-brand-blue' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                  >
                    {label} <span className="text-slate-400">({n})</span>
                  </button>
                ))}
              </div>
              {list && list.items.length ? (
                <ul className="mt-4 space-y-3">
                  {list.items.map((c) => (
                    <ChatRow key={`${c.org || ''}|${c.id}`} c={c} now={now} multi={multi} />
                  ))}
                  {list.count > list.items.length && (
                    <li className="text-center text-sm text-slate-500 pt-1">
                      Mostrando {list.items.length} de {list.count}.{' '}
                      <Link href={tab === 'help' ? '/crm?f=handoff' : '/crm'} className="font-semibold text-brand-blue hover:underline">
                        Ver el resto en la bandeja
                      </Link>
                    </li>
                  )}
                </ul>
              ) : (
                <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
                  {tab === 'help' ? '¡Al día! Nadie está esperando a una persona.' : 'No hay chats para retomar en este momento.'}
                </p>
              )}
            </section>

            {/* Impact */}
            <aside className="space-y-3">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
                <h3 className="text-[15px] font-semibold text-slate-900">Tu impacto {words.title}</h3>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[28px] font-bold text-brand-blue tabular-nums leading-tight">{data.sales.count}</p>
                    <p className="text-[13px] text-slate-500">Ventas</p>
                  </div>
                  <div>
                    <p className="text-[28px] font-bold text-brand-blue tabular-nums leading-tight">{pct} %</p>
                    <p className="text-[13px] text-slate-500">IA autónoma</p>
                  </div>
                  <div>
                    <p className="text-[28px] font-bold text-brand-blue tabular-nums leading-tight">{data.ai.team}</p>
                    <p className="text-[13px] text-slate-500">Atendidas por el equipo</p>
                  </div>
                </div>
                <p className="mt-4 rounded-xl bg-blue-50/70 px-4 py-3 text-sm text-slate-700">
                  {data.ai.chats
                    ? `La IA llevó sola ${data.ai.solo} de ${data.ai.chats}.${data.ai.waiting ? ` ${data.ai.waiting} ${data.ai.waiting === 1 ? 'pidió una persona y sigue esperando' : 'pidieron una persona y siguen esperando'}.` : ''}`
                    : 'Todavía no hay conversaciones en este periodo.'}
                </p>
                <p className="mt-3 text-xs text-slate-400">Sobre las conversaciones {words.phrase}.</p>
              </div>
              <p className="text-center text-sm italic text-slate-400">«Si la IA puede hacerlo, el asesor no debería hacerlo.»</p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
