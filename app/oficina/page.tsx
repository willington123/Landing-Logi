'use client';

// Oficina: the team and the AI working, live, as an isometric 3D office. Refreshes every 10 s while visible.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Expand, Loader2, Minimize } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import StorePicker, { useInboxStores } from '@/components/crm/StorePicker';
import { ago } from '@/lib/home';
import type { OfficeData } from '@/lib/office';
import type { OfficeSceneProps, SceneCustomer, ScenePerson } from '@/components/office/OfficeScene';

// The 3D part loads only on this page (and only in the browser).
const OfficeScene = dynamic(() => import('@/components/office/OfficeScene'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-slate-500">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  ),
});

const POLL_MS = 10_000;
const SHIRTS = ['#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b', '#14b8a6', '#ec4899', '#6366f1'];
const shirtOf = (k: string) => {
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return SHIRTS[h % SHIRTS.length];
};

export default function OficinaPage() {
  const router = useRouter();
  const { stores, chosen, sel } = useInboxStores();
  const [parts, setParts] = useState<OfficeData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const seenWaiting = useRef<Set<string> | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const multi = (stores?.length || 0) > 1;
  const targets = useMemo(() => (!stores ? null : stores.length ? (chosen || []).map((s) => ({ id: s.id, current: s.current })) : [{ id: '', current: true }]), [stores, chosen]);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  const load = useCallback(async () => {
    const list = targetsRef.current;
    if (!list) return;
    const results = await Promise.allSettled(
      list.map((s) =>
        fetch('/api/office', { cache: 'no-store', headers: s.current ? {} : { 'x-kx-org': s.id } })
          .then((r) => r.json())
          .then((d) => {
            if (!d.success) throw new Error(d.error || 'Error');
            return d as OfficeData;
          }),
      ),
    );
    if (targetsRef.current !== list) return;
    const okParts = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    const fail = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    setParts(okParts);
    setError(fail ? fail.reason?.message || 'No se pudo cargar una tienda.' : null);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (!targets) return;
    seenWaiting.current = null;
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), POLL_MS);
    return () => clearInterval(t);
  }, [targets, load]);

  useEffect(() => {
    const on = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen?.());

  // Everyone together (a person in several stores shows once).
  const view = useMemo(() => {
    if (!parts) return null;
    const people = new Map<string, ScenePerson & { stores: string[] }>();
    for (const p of parts)
      for (const x of p.people) {
        const k = x.name.trim().toLowerCase();
        const cur = people.get(k);
        if (cur) {
          cur.online ||= x.online;
          cur.typing ||= x.typing;
          cur.onChat ||= x.onChat;
          cur.assigned += x.assigned;
          cur.stores.push(p.store.name);
        } else people.set(k, { key: k, name: x.name, online: x.online, typing: x.typing, onChat: x.onChat, assigned: x.assigned, available: x.available, color: shirtOf(k), stores: [p.store.name] });
      }
    // Connected people first, so they get the desks.
    const team = Array.from(people.values()).sort((a, b) => Number(b.online) - Number(a.online) || b.assigned - a.assigned);
    const robots = parts.flatMap((p) => p.ai.names.map((n, i) => ({ key: `${p.store.id}|${i}`, label: multi ? `${n} · ${p.store.name}` : n })));
    const waitingAll = parts
      .flatMap((p) => p.waiting.map((w) => ({ ...w, org: p.store.id, store: p.store.name })))
      .sort((a, b) => String(a.since || '').localeCompare(String(b.since || '')));
    return {
      team,
      robots,
      aiOn: parts.some((p) => p.bot.enabled),
      aiTotal: parts.reduce((n, p) => n + p.ai.active, 0),
      waitingAll,
    };
  }, [parts, multi]);

  // Customers just handed over walk from the AI zone to the lounge (not on the first load).
  const customers: SceneCustomer[] = useMemo(() => {
    if (!view) return [];
    const first = seenWaiting.current === null;
    const known = seenWaiting.current || new Set<string>();
    const list = view.waitingAll.map((w) => {
      const key = `${w.org}|${w.id}`;
      return { key, name: w.name, wait: w.since ? ago(w.since, now) : '', isNew: !first && !known.has(key) };
    });
    seenWaiting.current = new Set(list.map((c) => c.key));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const openCustomer = (key: string) => {
    const i = key.indexOf('|');
    const org = key.slice(0, i);
    const id = key.slice(i + 1);
    router.push(`/crm?c=${encodeURIComponent(id)}${org ? `&org=${encodeURIComponent(org)}` : ''}`);
  };

  const sceneProps: OfficeSceneProps | null = view
    ? { people: view.team, robots: view.robots, aiOn: view.aiOn, aiTotal: view.aiTotal, customers: customers.slice(0, 6), extraWaiting: Math.max(0, customers.length - 6), onOpenCustomer: openCustomer }
    : null;
  const online = view?.team.filter((p) => p.online).length || 0;

  return (
    <div className="flex h-[calc(100dvh-64px-env(safe-area-inset-bottom))] lg:h-screen bg-slate-50 overflow-hidden">
      <Sidebar onOpenWizard={() => {}} />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header title="Oficina" onOpenWizard={() => {}} />
        <main className="flex-1 min-h-0 p-3 md:p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {stores && multi && <StorePicker stores={stores} sel={sel} />}
            <p className="text-sm text-slate-500 mr-auto">Tu equipo y la IA trabajando, en vivo. Toca a un cliente que espera para atenderlo.</p>
            <button onClick={toggleFull} className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5">
              {full ? <Minimize className="w-4 h-4" /> : <Expand className="w-4 h-4" />} {full ? 'Salir' : 'Pantalla completa'}
            </button>
          </div>
          {error && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">{error}</p>}

          <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-3">
            <div ref={box} className="relative min-h-[360px] rounded-2xl overflow-hidden border border-slate-200 bg-[#b2e3dd]">
              {sceneProps ? <OfficeScene {...sceneProps} /> : <div className="absolute inset-0 flex items-center justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>}
              {view && (
                <div className="absolute left-3 top-3 flex flex-wrap gap-2 pointer-events-none">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-[12px] font-semibold text-slate-700 shadow-sm">👩‍💻 {online} conectados</span>
                  <span className="rounded-full bg-white/90 px-3 py-1 text-[12px] font-semibold text-violet-700 shadow-sm">🤖 IA: {view.aiOn ? view.aiTotal : 'apagada'}</span>
                  <span className="rounded-full bg-white/90 px-3 py-1 text-[12px] font-semibold text-amber-700 shadow-sm">🙋 {view.waitingAll.length} esperando</span>
                </div>
              )}
            </div>

            {/* The same, as a list */}
            <aside className="hidden xl:flex flex-col gap-3 min-h-0 overflow-y-auto">
              <section className="bg-white rounded-2xl border border-slate-200 p-4">
                <h3 className="text-[13px] font-semibold text-slate-900">Esperan a una persona ({view?.waitingAll.length || 0})</h3>
                <ul className="mt-2 space-y-1.5">
                  {(view?.waitingAll || []).slice(0, 20).map((w) => (
                    <li key={`${w.org}|${w.id}`}>
                      <button onClick={() => openCustomer(`${w.org}|${w.id}`)} className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-amber-50">
                        <p className="text-[13px] font-medium text-slate-800 truncate">
                          {w.name} <span className="text-slate-400 font-normal">· {w.since ? ago(w.since, now) : ''}</span>
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{multi ? `${w.store} · ` : ''}{w.note || 'La IA pidió una persona'}</p>
                      </button>
                    </li>
                  ))}
                  {view && !view.waitingAll.length && <li className="text-[12px] text-slate-400">Nadie esperando. 🎉</li>}
                </ul>
              </section>
              <section className="bg-white rounded-2xl border border-slate-200 p-4">
                <h3 className="text-[13px] font-semibold text-slate-900">Equipo</h3>
                <ul className="mt-2 space-y-1.5">
                  {(view?.team || []).map((p) => (
                    <li key={p.key} className="flex items-center gap-2 text-[13px]">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${!p.online ? 'bg-slate-300' : p.available ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      <span className="flex-1 min-w-0 truncate text-slate-800">{p.name}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">{!p.online ? 'desconectado' : p.typing ? 'escribiendo' : p.onChat ? 'en un chat' : 'conectado'}</span>
                    </li>
                  ))}
                  {view && !view.team.length && <li className="text-[12px] text-slate-400">Agrega a tu equipo en Mensajes → Filtros avanzados → Equipo.</li>}
                </ul>
              </section>
              <p className="text-[11px] text-slate-400 px-1">Se actualiza cada 10 segundos. Una persona aparece conectada mientras tiene Konnexa abierto.</p>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
