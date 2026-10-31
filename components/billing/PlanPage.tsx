'use client';

// Plan y pagos: current plan, usage this month, plans, payment (Wompi) and history.
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, CheckCircle2, CreditCard, Landmark, Loader2, Lock, X } from 'lucide-react';
import { STATUS_LABEL, cop, type Plan, type SubStatus } from '@/lib/plans';
import { fetchAccount } from '@/lib/account-client';

interface Billing {
  canManage: boolean;
  subscription: {
    plan: string;
    status: SubStatus;
    effective: SubStatus;
    accessEndsAt: string | null;
    daysLeft: number | null;
    panelLocked: boolean;
    autoRenew: boolean;
    card: { brand: string | null; last4: string } | null;
    retries: number;
  };
  plans: Plan[];
  usage: { landings: number; ordersThisMonth: number; members: number; aiReplies: number };
  payments: { id: string; plan: string; amount_cents: number; status: string; method: string | null; kind: string; created_at: string; error: string | null }[];
  wompi: { configured: boolean; publicKey: string | null; sandbox: boolean; apiUrl: string | null };
}

async function call(url: string, method = 'GET', body?: unknown) {
  const res = await fetch(url, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
  return d;
}

const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
const input = 'w-full h-10 text-[14px] bg-white border border-slate-200 rounded-lg px-3 outline-none focus:border-brand-navy/40 focus:ring-2 focus:ring-brand-navy/10';
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
const PAY_STATUS: Record<string, { label: string; cls: string }> = {
  APPROVED: { label: 'Aprobado', cls: 'text-emerald-700' },
  PENDING: { label: 'Pendiente', cls: 'text-amber-700' },
  DECLINED: { label: 'Rechazado', cls: 'text-red-600' },
  ERROR: { label: 'Error', cls: 'text-red-600' },
  VOIDED: { label: 'Anulado', cls: 'text-slate-500' },
};
const METHOD: Record<string, string> = { CARD: 'Tarjeta', PSE: 'PSE', NEQUI: 'Nequi', BANCOLOMBIA_TRANSFER: 'Bancolombia', MANUAL: 'Manual' };

function Meter({ label, used, limit, soft }: { label: string; used: number; limit: number | null; soft?: boolean }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-[15px] font-semibold text-slate-900 tabular-nums">
        {used.toLocaleString('es-CO')}
        <span className="text-xs font-normal text-slate-500"> / {limit === null ? 'ilimitado' : limit.toLocaleString('es-CO')}</span>
      </p>
      {limit !== null && limit > 0 && (
        <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.max(pct, 2)}%` }} />
        </div>
      )}
      {soft && limit !== null && used >= limit && <p className="text-[10px] text-amber-700 mt-1">Pasaste el límite: los pedidos se siguen recibiendo, pero te conviene subir de plan.</p>}
    </div>
  );
}

// ---------- card payment (tokenized in the browser with Wompi's public key) ----------

function CardForm({ b, plan, onDone, onClose }: { b: Billing; plan: Plan; onDone: (msg: string) => void; onClose: () => void }) {
  const [terms, setTerms] = useState<{ acceptance: { token: string; permalink: string } | null; personal: { token: string; permalink: string } | null } | null>(null);
  const [f, setF] = useState({ number: '', exp: '', cvc: '', holder: '', email: '' });
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sub = b.subscription;
  const laterCharge = sub.effective === 'active' && (sub.daysLeft ?? 0) > 1; // the server saves the card and charges at renewal
  useEffect(() => {
    call('/api/billing/card').then(setTerms).catch((e) => setError(e.message));
    fetchAccount().then((r) => r.data?.user?.email && setF((x) => ({ ...x, email: r.data!.user!.email })));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const [mm, yy] = f.exp.split('/').map((x) => x.trim());
      const api = b.wompi.apiUrl || (b.wompi.sandbox ? 'https://sandbox.wompi.co/v1' : 'https://production.wompi.co/v1');
      const res = await fetch(`${api}/tokens/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${b.wompi.publicKey}` },
        body: JSON.stringify({ number: f.number.replace(/\s/g, ''), cvc: f.cvc, exp_month: mm, exp_year: (yy || '').slice(-2), card_holder: f.holder }),
      });
      const tok = await res.json().catch(() => ({}));
      if (!res.ok || !tok?.data?.id) {
        const msgs = tok?.error?.messages ? Object.values(tok.error.messages).flat().join(' ') : '';
        throw new Error(msgs ? `Revisa la tarjeta: ${msgs}` : 'No se pudo validar la tarjeta. Revisa los datos.');
      }
      const d = await call('/api/billing/card', 'POST', {
        plan: plan.id,
        token: tok.data.id,
        email: f.email,
        acceptanceToken: terms?.acceptance?.token,
        personalToken: terms?.personal?.token,
        brand: tok.data.brand,
        last4: tok.data.last_four,
      });
      onDone(
        d.charged
          ? d.status === 'APPROVED'
            ? '¡Pago aprobado! Tu plan está activo y se renovará solo cada mes.'
            : d.status === 'PENDING'
              ? 'Estamos confirmando el pago con tu banco. Esta página se actualiza sola.'
              : `El pago fue rechazado${d.message ? `: ${d.message}` : ''}. Prueba con otra tarjeta o paga con PSE o Nequi.`
          : d.message,
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold text-slate-900">
          Plan {plan.name} · {cop(plan.price)}/mes
        </p>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Cerrar">
          <X className="w-5 h-5" />
        </button>
      </div>
      <p className="text-xs text-slate-500">
        {laterCharge
          ? `Hoy no se cobra nada: el primer cobro será el ${date(sub.accessEndsAt)}, cuando termine tu periodo pagado. Puedes cancelar cuando quieras.`
          : sub.effective === 'trialing' && sub.daysLeft
            ? `Se cobra hoy y tu mes empieza cuando termine la prueba (${date(sub.accessEndsAt)}), así no pierdes días. Luego se cobra cada mes. Puedes cancelar cuando quieras.`
            : 'Se cobra hoy y luego cada mes en la misma fecha. Puedes cancelar cuando quieras.'}
      </p>
      <input className={input} inputMode="numeric" autoComplete="cc-number" placeholder="Número de la tarjeta" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value.replace(/[^\d ]/g, '').slice(0, 23) })} />
      <div className="grid grid-cols-2 gap-2">
        <input className={input} autoComplete="cc-exp" placeholder="MM/AA" value={f.exp} onChange={(e) => setF({ ...f, exp: e.target.value.replace(/[^\d/]/g, '').slice(0, 5) })} />
        <input className={input} inputMode="numeric" autoComplete="cc-csc" placeholder="CVC" value={f.cvc} onChange={(e) => setF({ ...f, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
      </div>
      <input className={input} autoComplete="cc-name" placeholder="Nombre como aparece en la tarjeta" value={f.holder} onChange={(e) => setF({ ...f, holder: e.target.value })} />
      <input className={input} type="email" autoComplete="email" placeholder="Correo para los comprobantes" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <label className="flex items-start gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5" />
        <span>
          Acepto los{' '}
          {terms?.acceptance?.permalink ? (
            <a href={terms.acceptance.permalink} target="_blank" rel="noreferrer" className="underline">
              términos y condiciones
            </a>
          ) : (
            'términos y condiciones'
          )}
          {terms?.personal?.permalink && (
            <>
              {' '}y la{' '}
              <a href={terms.personal.permalink} target="_blank" rel="noreferrer" className="underline">
                autorización de datos personales
              </a>
            </>
          )}{' '}
          de Wompi, y el cobro mensual automático.
        </span>
      </label>
      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}
      <button
        disabled={busy || !accepted || !terms?.acceptance || f.number.replace(/\s/g, '').length < 13 || !/^\d{2}\/\d{2}$/.test(f.exp) || f.cvc.length < 3 || !f.holder || !f.email}
        className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} {laterCharge ? 'Guardar tarjeta' : `Pagar ${cop(plan.price)}`}
      </button>
      <p className="text-[10px] text-slate-400 text-center">Los datos de la tarjeta van directo a Wompi (Bancolombia). Konnexa no los guarda.</p>
    </form>
  );
}

export default function PlanPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [b, setB] = useState<Billing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [choosing, setChoosing] = useState<Plan | null>(null);
  const [mode, setMode] = useState<'pick' | 'card'>('pick');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => call('/api/billing').then(setB).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  // Back from Wompi's page: /plan?id=<transaction>
  useEffect(() => {
    const id = params.get('id');
    if (!id) return;
    call('/api/billing/verify', 'POST', { id })
      .then((d) => {
        setMsg(
          d.status === 'APPROVED'
            ? { ok: true, text: '¡Pago aprobado! Tu plan está activo.' }
            : d.status === 'PENDING'
              ? { ok: true, text: 'Tu pago está en proceso. Te avisamos aquí apenas Wompi lo confirme.' }
              : { ok: false, text: `El pago no se completó (${d.status}${d.message ? `: ${d.message}` : ''}). Puedes intentarlo de nuevo.` },
        );
        load();
        fetchAccount(true);
      })
      .catch((e) => setMsg({ ok: false, text: e.message }))
      .finally(() => router.replace('/plan'));
  }, [params, router, load]);

  // While a payment is pending, refresh every few seconds.
  const pendingPay = b?.payments.some((p) => p.status === 'PENDING' && Date.now() - new Date(p.created_at).getTime() < 15 * 60000);
  useEffect(() => {
    if (!pendingPay) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [pendingPay, load]);

  if (error) return <p className="text-sm text-red-600 bg-red-50 rounded-xl p-4">{error}</p>;
  if (!b) return <Loader2 className="w-5 h-5 animate-spin text-slate-300" />;

  const s = b.subscription;
  const current = b.plans.find((p) => p.id === s.plan) || b.plans[1];
  const isTrial = s.effective === 'trialing';
  const payCheckout = async (plan: Plan) => {
    setBusy(`checkout-${plan.id}`);
    try {
      const d = await call('/api/billing/checkout', 'POST', { plan: plan.id });
      window.location.href = d.url;
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {msg && <div className={`rounded-xl p-3 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}

      {/* Current plan */}
      <div className={`${card} p-5 space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Tu plan</p>
            <h2 className="text-xl font-bold text-slate-900">
              {s.effective === 'exempt' ? 'Plataforma (sin costo)' : current.name}{' '}
              <span
                className={`align-middle text-xs font-semibold px-2 py-0.5 rounded-full ${
                  s.effective === 'active' || s.effective === 'exempt' ? 'bg-emerald-50 text-emerald-700' : s.effective === 'trialing' ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {STATUS_LABEL[s.effective]}
              </span>
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              {s.effective === 'exempt'
                ? 'Esta es la tienda de la plataforma: no paga.'
                : isTrial
                  ? `Prueba gratis hasta el ${date(s.accessEndsAt)} (${s.daysLeft} ${s.daysLeft === 1 ? 'día' : 'días'}).`
                  : s.effective === 'expired'
                    ? 'Tu plan venció. Elige un plan para seguir.'
                    : s.autoRenew
                      ? `Se renueva el ${date(s.accessEndsAt)}${s.card ? ` con tu tarjeta ${s.card.brand || ''} ···${s.card.last4}` : ''}.`
                      : `Activo hasta el ${date(s.accessEndsAt)}. Sin renovación automática.`}
            </p>
          </div>
          {b.canManage && s.autoRenew && (
            <button
              onClick={() =>
                window.confirm('¿Cancelar la renovación automática? Tu plan sigue activo hasta el final del periodo pagado.') &&
                (setBusy('cancel'), call('/api/billing/cancel', 'POST').then(load).finally(() => setBusy(null)))
              }
              className="text-xs text-slate-500 hover:text-red-600"
            >
              {busy === 'cancel' ? 'Cancelando…' : 'Cancelar renovación automática'}
            </button>
          )}
        </div>
        {s.effective !== 'exempt' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Meter label="Landings" used={b.usage.landings} limit={current.landings} />
            <Meter label="Pedidos este mes" used={b.usage.ordersThisMonth} limit={current.ordersPerMonth} soft />
            <Meter label="Personas del equipo" used={b.usage.members} limit={current.members} />
            <Meter label="Respuestas del asistente IA incluidas" used={b.usage.aiReplies} limit={isTrial ? 100 : current.aiReplies} />
          </div>
        )}
      </div>

      {/* Plans */}
      {s.effective !== 'exempt' && (
        <div className="grid md:grid-cols-3 gap-4">
          {b.plans.map((p) => {
            const isCurrent = p.id === s.plan && s.effective === 'active';
            const payAgain = p.id === s.plan && s.effective === 'past_due';
            return (
              <div key={p.id} className={`${card} p-5 flex flex-col ${p.highlight ? 'ring-2 ring-brand-blue/60' : ''}`}>
                {p.highlight && <span className="self-start text-[11px] font-bold text-white bg-brand-gradient rounded-full px-2.5 py-0.5 mb-2">Más elegido</span>}
                <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
                <p className="mt-1">
                  <span className="text-3xl font-bold text-slate-900">{cop(p.price)}</span>
                  <span className="text-sm text-slate-500"> /mes</span>
                </p>
                <ul className="mt-4 space-y-1.5 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="text-[13px] text-slate-700 flex gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  disabled={!b.canManage || isCurrent}
                  onClick={() => (setChoosing(p), setMode('pick'))}
                  className={`mt-5 h-11 rounded-xl text-sm font-semibold transition disabled:opacity-60 ${
                    p.highlight ? 'bg-brand-gradient text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {isCurrent ? 'Tu plan actual' : payAgain ? `Pagar ${p.name}` : s.effective === 'active' ? `Cambiar a ${p.name}` : `Elegir ${p.name}`}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {!b.canManage && s.effective !== 'exempt' && <p className="text-xs text-slate-500">Solo el dueño o un administrador de la tienda pueden pagar o cambiar el plan.</p>}

      {/* History */}
      {b.payments.length > 0 && (
        <div className={`${card} p-5`}>
          <h3 className="text-[15px] font-semibold text-slate-900 mb-3">Pagos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-100">
                  <th className="py-2 pr-3 font-medium">Fecha</th>
                  <th className="py-2 pr-3 font-medium">Plan</th>
                  <th className="py-2 pr-3 font-medium">Valor</th>
                  <th className="py-2 pr-3 font-medium">Medio</th>
                  <th className="py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {b.payments.map((p) => {
                  const st = PAY_STATUS[p.status] || { label: p.status, cls: 'text-slate-600' };
                  return (
                    <tr key={p.id} className="border-b border-slate-50">
                      <td className="py-2 pr-3 text-slate-700 whitespace-nowrap">{date(p.created_at)}</td>
                      <td className="py-2 pr-3 text-slate-700">{b.plans.find((x) => x.id === p.plan)?.name || p.plan}</td>
                      <td className="py-2 pr-3 text-slate-900 tabular-nums">{cop(p.amount_cents / 100)}</td>
                      <td className="py-2 pr-3 text-slate-600">
                        {METHOD[p.method || ''] || p.method || '—'}
                        {p.kind === 'auto' ? ' · automático' : ''}
                      </td>
                      <td className={`py-2 font-medium ${st.cls}`} title={p.error || undefined}>
                        {st.label}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment choice */}
      {choosing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && setChoosing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            {!b.wompi.configured ? (
              <div className="space-y-3">
                <p className="text-[15px] font-semibold text-slate-900">Plan {choosing.name}</p>
                <p className="text-sm text-slate-600">Los pagos en línea aún no están habilitados. Escríbenos para activar tu plan por transferencia o Nequi.</p>
                <button onClick={() => setChoosing(null)} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold">
                  Entendido
                </button>
              </div>
            ) : mode === 'card' ? (
              <CardForm
                b={b}
                plan={choosing}
                onClose={() => setChoosing(null)}
                onDone={(text) => {
                  setChoosing(null);
                  setMsg({ ok: !/rechazado/i.test(text), text });
                  load();
                  fetchAccount(true);
                }}
              />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-semibold text-slate-900">
                    Plan {choosing.name} · {cop(choosing.price)}/mes
                  </p>
                  <button onClick={() => setChoosing(null)} className="text-slate-400 hover:text-slate-700" aria-label="Cerrar">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <button onClick={() => setMode('card')} className="w-full text-left rounded-xl border border-slate-200 hover:border-slate-300 p-4 flex gap-3">
                  <CreditCard className="w-5 h-5 text-brand-navy shrink-0" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">Tarjeta con cobro automático</span>
                    <span className="block text-xs text-slate-500">Se cobra cada mes sola. Recomendado para no perder el servicio.</span>
                  </span>
                </button>
                <button onClick={() => payCheckout(choosing)} disabled={busy !== null} className="w-full text-left rounded-xl border border-slate-200 hover:border-slate-300 p-4 flex gap-3 disabled:opacity-60">
                  {busy?.startsWith('checkout') ? <Loader2 className="w-5 h-5 animate-spin shrink-0" /> : <Landmark className="w-5 h-5 text-brand-navy shrink-0" />}
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">Pagar un mes con PSE, Nequi o tarjeta</span>
                    <span className="block text-xs text-slate-500">Pagas en la página segura de Wompi. Cada mes pagas de nuevo.</span>
                  </span>
                </button>
                {b.wompi.sandbox && <p className="text-[11px] text-amber-700">Modo de pruebas de Wompi: no se cobra dinero real.</p>}
              </div>
            )}
          </div>
        </div>
      )}
      {s.effective === 'active' && s.card && !s.autoRenew && b.canManage && (
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Tienes una tarjeta guardada. Elige un plan con tarjeta para volver a activar la renovación automática.
        </p>
      )}
    </div>
  );
}
