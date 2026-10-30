'use client';

// Admin plataforma: every store, its plan and status, manual actions and the plans editor.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, Save, Search } from 'lucide-react';
import { STATUS_LABEL, cop, type Plan, type SubStatus } from '@/lib/plans';

interface Store {
  id: string;
  name: string;
  createdAt: string;
  owner: { email: string; name: string | null } | null;
  plan: string | null;
  status: SubStatus | null;
  accessEndsAt: string | null;
  autoRenew: boolean;
  ordersThisMonth: number;
}
interface Data {
  stores: Store[];
  plans: Plan[];
  summary: { total: number; active: number; trialing: number; mrr: number };
}

async function call(url: string, method = 'GET', body?: unknown) {
  const res = await fetch(url, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.success) throw Object.assign(new Error(d.error || `HTTP ${res.status}`), { status: res.status });
  return d;
}

const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
const input = 'h-9 text-[13px] bg-white border border-slate-200 rounded-lg px-2.5 outline-none focus:border-brand-navy/40 focus:ring-2 focus:ring-brand-navy/10';
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const STATUS_CLS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  trialing: 'bg-sky-50 text-sky-700',
  past_due: 'bg-amber-50 text-amber-700',
  expired: 'bg-red-50 text-red-600',
  canceled: 'bg-slate-100 text-slate-600',
  exempt: 'bg-violet-50 text-violet-700',
};

function StoreActions({ store, plans, onDone }: { store: Store; plans: Plan[]; onDone: (msg: string) => void }) {
  const [action, setAction] = useState('activate');
  const [plan, setPlan] = useState(store.plan || 'pro');
  const [months, setMonths] = useState(1);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async () => {
    if (action === 'expire' && !confirm(`¿Vencer el plan de "${store.name}"? Se bloqueará su panel.`)) return;
    setBusy(true);
    setErr('');
    try {
      await call('/api/admin/stores', 'POST', { orgId: store.id, action, plan, months, days });
      onDone(`Listo: ${store.name} actualizada.`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select className={input} value={action} onChange={(e) => setAction(e.target.value)} aria-label="Acción">
        <option value="activate">Activar plan (pago manual)</option>
        <option value="trial">Dar días de prueba</option>
        <option value="exempt">Sin costo</option>
        <option value="expire">Vencer</option>
      </select>
      {action === 'activate' && (
        <>
          <select className={input} value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Plan">
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select className={input} value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Meses">
            {[1, 2, 3, 6, 12].map((m) => (
              <option key={m} value={m}>
                {m} {m === 1 ? 'mes' : 'meses'}
              </option>
            ))}
          </select>
        </>
      )}
      {action === 'trial' && (
        <input type="number" min={1} max={60} className={`${input} w-20`} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Días" />
      )}
      <button onClick={run} disabled={busy} className="h-9 px-3 rounded-lg bg-brand-navy text-white text-[13px] font-medium disabled:opacity-50 inline-flex items-center gap-1.5">
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Aplicar
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}

function PlansEditor({ plans, onSaved }: { plans: Plan[]; onSaved: (p: Plan[]) => void }) {
  const [draft, setDraft] = useState(plans);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => setDraft(plans), [plans]);

  const set = (id: string, patch: Partial<Plan>) => setDraft((d) => d.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      const d = await call('/api/admin/plans', 'PUT', { plans: draft });
      onSaved(d.plans);
      setMsg('Planes guardados.');
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${card} p-5`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">Planes y precios</h2>
          <p className="text-xs text-slate-500">Deja un límite vacío para que sea ilimitado. Los cambios aplican a los próximos cobros.</p>
        </div>
        <button onClick={save} disabled={busy} className="h-9 px-3 rounded-lg bg-brand-navy text-white text-[13px] font-medium disabled:opacity-50 inline-flex items-center gap-1.5">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Guardar
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {draft.map((p) => (
          <div key={p.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
            <label className="block text-[11px] text-slate-500">
              Nombre
              <input className={`${input} w-full mt-0.5`} value={p.name} onChange={(e) => set(p.id, { name: e.target.value })} />
            </label>
            <label className="block text-[11px] text-slate-500">
              Precio mensual (COP)
              <input type="number" className={`${input} w-full mt-0.5`} value={p.price} onChange={(e) => set(p.id, { price: Number(e.target.value) })} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] text-slate-500">
                Landings
                <input type="number" className={`${input} w-full mt-0.5`} value={p.landings ?? ''} placeholder="∞" onChange={(e) => set(p.id, { landings: numOrNull(e.target.value) })} />
              </label>
              <label className="block text-[11px] text-slate-500">
                Pedidos/mes
                <input type="number" className={`${input} w-full mt-0.5`} value={p.ordersPerMonth ?? ''} placeholder="∞" onChange={(e) => set(p.id, { ordersPerMonth: numOrNull(e.target.value) })} />
              </label>
              <label className="block text-[11px] text-slate-500">
                Personas
                <input type="number" className={`${input} w-full mt-0.5`} value={p.members ?? ''} placeholder="∞" onChange={(e) => set(p.id, { members: numOrNull(e.target.value) })} />
              </label>
              <label className="block text-[11px] text-slate-500">
                Respuestas IA
                <input type="number" className={`${input} w-full mt-0.5`} value={p.aiReplies} onChange={(e) => set(p.id, { aiReplies: Number(e.target.value) })} />
              </label>
            </div>
            <label className="block text-[11px] text-slate-500">
              Beneficios (uno por línea)
              <textarea
                rows={4}
                className="w-full mt-0.5 text-[13px] bg-white border border-slate-200 rounded-lg px-2.5 py-2 outline-none focus:border-brand-navy/40"
                value={p.features.join('\n')}
                onChange={(e) => set(p.id, { features: e.target.value.split('\n') })}
              />
            </label>
          </div>
        ))}
      </div>
      {msg && <p className="mt-3 text-xs text-slate-600">{msg}</p>}
    </section>
  );
}

export default function AdminPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await call('/api/admin/stores'));
      setError('');
    } catch (e: any) {
      if (e.status === 403 || e.status === 401) setDenied(true);
      else setError(e.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const stores = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.stores || []).filter(
      (s) => (!status || s.status === status) && (!term || s.name.toLowerCase().includes(term) || (s.owner?.email || '').toLowerCase().includes(term)),
    );
  }, [data, q, status]);

  if (denied)
    return (
      <div className={`${card} p-8 text-center max-w-md mx-auto`}>
        <Lock className="w-6 h-6 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-800">Solo para administradores de la plataforma</p>
        <p className="text-xs text-slate-500 mt-1">Tu correo debe estar en PLATFORM_ADMIN_EMAILS (variables de Vercel).</p>
      </div>
    );
  if (!data)
    return <div className="py-16 text-center text-sm text-slate-500">{error || <Loader2 className="w-5 h-5 animate-spin mx-auto" />}</div>;

  const planName = (id: string | null) => data.plans.find((p) => p.id === id)?.name || '—';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Tiendas', data.summary.total.toLocaleString('es-CO')],
          ['Pagando', data.summary.active.toLocaleString('es-CO')],
          ['En prueba', data.summary.trialing.toLocaleString('es-CO')],
          ['Ingreso mensual (MRR)', cop(data.summary.mrr)],
        ].map(([label, value]) => (
          <div key={label} className={`${card} p-4`}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-xl font-semibold text-slate-900 tabular-nums mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {notice && <div className="rounded-xl bg-emerald-50 text-emerald-800 text-sm px-4 py-2.5">{notice}</div>}

      <section className={card}>
        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-slate-100">
          <h2 className="text-[15px] font-semibold text-slate-900 mr-auto">Tiendas</h2>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input className={`${input} pl-8 w-56`} placeholder="Buscar tienda o correo" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className={input} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado">
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Tienda</th>
                <th className="px-4 py-2 font-medium">Plan</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 font-medium">Vence</th>
                <th className="px-4 py-2 font-medium text-right">Pedidos mes</th>
                <th className="px-4 py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stores.map((s) => (
                <tr key={s.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.owner?.email || 'Sin dueño'}</p>
                  </td>
                  <td className="px-4 py-3">{planName(s.plan)}</td>
                  <td className="px-4 py-3">
                    {s.status ? (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_CLS[s.status] || ''}`}>{STATUS_LABEL[s.status]}</span>
                    ) : (
                      '—'
                    )}
                    {s.autoRenew && <p className="text-[11px] text-slate-500 mt-0.5">Cobro automático</p>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{s.status === 'exempt' ? '—' : date(s.accessEndsAt)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.ordersThisMonth.toLocaleString('es-CO')}</td>
                  <td className="px-4 py-3">
                    <StoreActions
                      store={s}
                      plans={data.plans}
                      onDone={(m) => {
                        setNotice(m);
                        load();
                      }}
                    />
                  </td>
                </tr>
              ))}
              {!stores.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No hay tiendas con ese filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <PlansEditor plans={data.plans} onSaved={(plans) => setData((d) => (d ? { ...d, plans } : d))} />
    </div>
  );
}
