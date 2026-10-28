'use client';

// "Llamar" button: places a real AI call (Vapi) for an order, after a confirmation step.
import React, { useEffect, useState } from 'react';
import { Loader2, PhoneCall } from 'lucide-react';
import type { OrderItem } from '@/lib/types';

let readyPromise: Promise<boolean> | null = null;
function vapiReady(): Promise<boolean> {
  if (!readyPromise) {
    readyPromise = fetch('/api/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => Boolean(d.cloud && d.vapi?.ready))
      .catch(() => false);
  }
  return readyPromise;
}

export function useVapiReady(): boolean | null {
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    vapiReady().then(setReady);
  }, []);
  return ready;
}

const CALLABLE = ['pending_call', 'retry_scheduled', 'needs_review', 'unanswered', 'calling'];

interface Props {
  order: OrderItem;
  variant?: 'button' | 'icon' | 'wide';
  onCalled?: () => void;
}

export function CallButton({ order, variant = 'button', onCalled }: Props) {
  const ready = useVapiReady();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const callable = CALLABLE.includes(order.status);
  const disabled = !ready || !callable || busy;
  const title = ready === false ? 'Configura Vapi en Llamadas IA para llamar a tus clientes' : !callable ? 'Este pedido ya no está pendiente de confirmación' : `Llamar a ${order.customerName} con la IA`;

  const call = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/calls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.id }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      setMsg({ ok: true, text: 'Llamando…' });
      onCalled?.();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'No se pudo llamar.' });
    } finally {
      setBusy(false);
      setConfirming(false);
      setTimeout(() => setMsg(null), 5000);
    }
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (confirming) {
    return (
      <span onClick={stop} className="inline-flex items-center gap-1.5">
        <span className="text-xs text-slate-600 whitespace-nowrap">¿Llamar ahora?</span>
        <button onClick={call} disabled={busy} className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-60">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />} Sí
        </button>
        <button onClick={() => setConfirming(false)} disabled={busy} className="h-8 px-2 rounded-lg text-xs text-slate-600 hover:bg-slate-100">
          No
        </button>
      </span>
    );
  }

  const base =
    variant === 'icon'
      ? 'h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
      : variant === 'wide'
      ? 'flex-1 h-10 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2'
      : 'h-8 px-3 rounded-lg border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 text-[13px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap';

  return (
    <span onClick={stop} className={`inline-flex flex-col items-end gap-1 ${variant === 'wide' ? 'flex-1' : ''}`}>
      <button
        onClick={() => setConfirming(true)}
        disabled={disabled}
        title={title}
        aria-label={title}
        className={`${base} transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent w-full`}
      >
        <PhoneCall className={variant === 'icon' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        {variant === 'button' && 'Llamar'}
        {variant === 'wide' && 'Llamar con IA para confirmar'}
      </button>
      {msg && <span className={`text-[11px] max-w-[220px] text-right ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</span>}
    </span>
  );
}
