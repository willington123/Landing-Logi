'use client';

// Change an order's status from Pedidos: the next steps as buttons in the order detail, and the same change for
// many selected orders at once (e.g. the carrier's delivery report). Uses PATCH /api/orders/[id] { status }, so
// the store's automations for that status run as usual.
import React, { useState } from 'react';
import { CheckCircle2, Loader2, PackageCheck, RotateCcw, Truck, XCircle } from 'lucide-react';
import { orderOrgHeaders } from '@/lib/inbox-stores';
import type { OrderItem, OrderStatus } from '@/lib/types';

export const SETTABLE: { id: OrderStatus; label: string }[] = [
  { id: 'pending_call', label: 'Pendiente' },
  { id: 'confirmed_by_voice', label: 'Confirmado' },
  { id: 'shipped', label: 'Enviado' },
  { id: 'delivered', label: 'Entregado' },
  { id: 'returned', label: 'Devuelto' },
  { id: 'cancelled', label: 'Cancelado' },
];
const label = (s: OrderStatus) => SETTABLE.find((x) => x.id === s)?.label || s;
const PENDING: OrderStatus[] = ['pending_call', 'retry_scheduled', 'calling', 'needs_review', 'unanswered'];

async function setStatus(o: OrderItem, status: OrderStatus) {
  const r = await fetch(`/api/orders/${encodeURIComponent(o.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...orderOrgHeaders(o) }, body: JSON.stringify({ status }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.success === false) throw new Error(d.error || `HTTP ${r.status}`);
}

// The usual next steps for this order.
function nextSteps(s: OrderStatus): { id: OrderStatus; text: string; icon: React.ReactNode; cls: string }[] {
  const confirm = { id: 'confirmed_by_voice' as const, text: 'Confirmar', icon: <CheckCircle2 className="w-3.5 h-3.5" />, cls: 'bg-emerald-600 hover:bg-emerald-700 text-white' };
  const ship = { id: 'shipped' as const, text: 'Enviado', icon: <Truck className="w-3.5 h-3.5" />, cls: 'bg-sky-600 hover:bg-sky-700 text-white' };
  const deliver = { id: 'delivered' as const, text: 'Entregado', icon: <PackageCheck className="w-3.5 h-3.5" />, cls: 'bg-green-600 hover:bg-green-700 text-white' };
  const ret = { id: 'returned' as const, text: 'Devuelto', icon: <RotateCcw className="w-3.5 h-3.5" />, cls: 'bg-orange-50 hover:bg-orange-100 text-orange-800 ring-1 ring-inset ring-orange-200' };
  const cancel = { id: 'cancelled' as const, text: 'Cancelar', icon: <XCircle className="w-3.5 h-3.5" />, cls: 'bg-white border border-slate-200 text-slate-700 hover:bg-red-50 hover:text-red-700' };
  if (PENDING.includes(s)) return [confirm, cancel];
  if (s === 'confirmed_by_voice') return [ship, cancel];
  if (s === 'shipped') return [deliver, ret];
  return [];
}

// In the order detail.
export function OrderStatusActions({ order, onChanged }: { order: OrderItem; onChanged: () => void }) {
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [ask, setAsk] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (s: OrderStatus) => {
    // Cancelling or returning asks once.
    if ((s === 'cancelled' || s === 'returned') && ask !== s) return setAsk(s);
    setBusy(s);
    setError(null);
    try {
      await setStatus(order, s);
      setAsk(null);
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const steps = nextSteps(order.status);
  return (
    <div className="rounded-xl border border-slate-200 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700">Estado del pedido</span>
        <select
          aria-label="Cambiar a otro estado"
          value=""
          onChange={(e) => e.target.value && run(e.target.value as OrderStatus)}
          disabled={busy !== null}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-600"
        >
          <option value="">Cambiar a…</option>
          {SETTABLE.filter((x) => x.id !== order.status).map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
      </div>
      {steps.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {steps.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => run(b.id)}
              disabled={busy !== null}
              className={`h-9 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 transition ${ask === b.id ? 'bg-red-600 hover:bg-red-700 text-white' : b.cls}`}
            >
              {busy === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : b.icon}
              {ask === b.id ? `¿Seguro? ${b.text}` : b.text}
            </button>
          ))}
        </div>
      )}
      {ask && !steps.some((b) => b.id === ask) && (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-slate-600 flex-1">¿Marcarlo como {label(ask)}?</span>
          <button type="button" onClick={() => run(ask)} className="h-8 px-3 rounded-lg bg-red-600 text-white text-[12px] font-semibold">
            Sí, cambiar
          </button>
          <button type="button" onClick={() => setAsk(null)} className="h-8 px-2 text-[12px] text-slate-500">
            No
          </button>
        </div>
      )}
      {error && <p className="text-[12px] text-red-600">{error}</p>}
    </div>
  );
}

// For the selected orders in the list.
export function BulkStatus({ orders, onDone }: { orders: OrderItem[]; onDone: (msg: string) => void }) {
  const [target, setTarget] = useState<OrderStatus | ''>('');
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<{ done: number; failed: number } | null>(null);
  const apply = async () => {
    if (!target) return;
    const todo = orders.filter((o) => o.status !== target);
    setProgress({ done: 0, failed: 0 });
    let done = 0;
    let failed = 0;
    // A few at a time, so a long delivery report doesn't flood the server.
    for (let i = 0; i < todo.length; i += 4) {
      const chunk = todo.slice(i, i + 4);
      const res = await Promise.allSettled(chunk.map((o) => setStatus(o, target)));
      done += res.filter((r) => r.status === 'fulfilled').length;
      failed += res.filter((r) => r.status === 'rejected').length;
      setProgress({ done, failed });
    }
    setProgress(null);
    setConfirming(false);
    setTarget('');
    const skipped = orders.length - todo.length;
    onDone(
      `${done} ${done === 1 ? 'pedido marcado' : 'pedidos marcados'} como ${label(target)}.` +
        (skipped ? ` ${skipped} ya ${skipped === 1 ? 'estaba' : 'estaban'} así.` : '') +
        (failed ? ` ${failed} no se pudieron cambiar: inténtalo de nuevo.` : ''),
    );
  };
  if (progress)
    return (
      <span className="h-8 px-3 text-[13px] text-slate-600 inline-flex items-center gap-1.5">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cambiando {progress.done + progress.failed}/{orders.filter((o) => o.status !== target).length}…
      </span>
    );
  if (confirming && target)
    return (
      <span className="inline-flex items-center gap-2 text-[13px]">
        <span className="text-slate-700">
          ¿Marcar {orders.length} como <strong>{label(target)}</strong>?
        </span>
        <button type="button" onClick={apply} className="h-8 px-3 rounded-lg bg-slate-900 text-white font-medium">
          Sí, cambiar
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="h-8 px-2 text-slate-500">
          No
        </button>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        aria-label="Cambiar estado de los seleccionados"
        value={target}
        onChange={(e) => setTarget(e.target.value as OrderStatus | '')}
        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[13px] text-slate-700"
      >
        <option value="">Cambiar estado a…</option>
        {SETTABLE.map((x) => (
          <option key={x.id} value={x.id}>
            {x.label}
          </option>
        ))}
      </select>
      <button type="button" disabled={!target} onClick={() => setConfirming(true)} className="h-8 px-3 text-[13px] font-medium rounded-lg bg-slate-900 text-white disabled:opacity-40">
        Aplicar
      </button>
    </span>
  );
}
