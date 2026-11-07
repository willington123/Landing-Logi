'use client';

// In the order detail: whether the order is in Dropi, why it couldn't be sent, and the "Enviar a Dropi" button.
import React, { useEffect, useState } from 'react';
import { orderOrgHeaders } from '@/lib/inbox-stores';
import { CheckCircle2, Loader2, Truck } from 'lucide-react';
import type { OrderItem } from '@/lib/types';

let connected: Promise<boolean> | null = null;
const dropiConnected = () =>
  (connected ||= fetch('/api/integrations/dropi', { cache: 'no-store' })
    .then((r) => r.json())
    .then((d) => Boolean(d?.connected))
    .catch(() => false));

export default function DropiOrderStatus({ order, onSent }: { order: OrderItem; onSent?: () => void }) {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(order.dropi || null);
  useEffect(() => {
    dropiConnected().then(setOn);
  }, []);
  useEffect(() => setState(order.dropi || null), [order.id, order.dropi]);
  if (!on && !state?.orderId) return null;

  const send = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/dropi`, { method: 'POST', headers: orderOrgHeaders(order) });
      const d = await res.json().catch(() => ({}));
      if (d.success) setState({ orderId: d.dropiOrderId, sentAt: new Date().toISOString(), error: null });
      else setState({ ...(state || {}), error: d.error || `HTTP ${res.status}` });
      onSent?.();
    } finally {
      setBusy(false);
    }
  };

  if (state?.orderId)
    return (
      <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center gap-2 text-[13px]">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-emerald-900">
          En Dropi · pedido <b className="font-mono">#{state.orderId}</b>
          {state.sentAt && <span className="text-emerald-700/70"> · {new Date(state.sentAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>}
        </span>
      </div>
    );
  const can = order.status !== 'cancelled';
  return (
    <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-amber-900 text-xs font-semibold inline-flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5" /> Dropi
        </span>
        {can && (
          <button type="button" onClick={send} disabled={busy} className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {state?.error ? 'Reintentar' : 'Enviar a Dropi'}
          </button>
        )}
      </div>
      <p className="text-[12.5px] text-slate-600">{state?.error ? <span className="text-red-600">{state.error}</span> : can ? 'Aún no está en Dropi.' : 'Pedido cancelado: no se envía.'}</p>
    </div>
  );
}
