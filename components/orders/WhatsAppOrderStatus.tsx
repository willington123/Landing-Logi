'use client';

// Order detail: WhatsApp confirmation status and a button to send the template by hand.
import React, { useEffect, useState } from 'react';
import { Loader2, MessageCircle } from 'lucide-react';
import type { OrderItem } from '@/lib/types';

let readyPromise: Promise<boolean> | null = null;
function templateReady(): Promise<boolean> {
  if (!readyPromise) {
    readyPromise = fetch('/api/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => Boolean(d.cloud && d.whatsapp?.confirmTemplate))
      .catch(() => false);
  }
  return readyPromise;
}

const PENDING = ['pending_call', 'retry_scheduled', 'needs_review', 'unanswered'];
const time = (iso: string) => new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function WhatsAppOrderStatus({ order, onSent }: { order: OrderItem; onSent?: () => void }) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    templateReady().then(setReady);
  }, []);
  if (!ready) return null;

  const wa = order.whatsapp;
  const send = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/whatsapp/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.id }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || `HTTP ${res.status}`);
      setMsg({ ok: true, text: 'Enviada. Cuando el cliente toque un botón, el pedido se actualiza solo.' });
      onSent?.();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-2">
      <span className="text-emerald-800 text-xs font-semibold">WhatsApp</span>
      {wa?.ok && <p className="text-slate-700">Plantilla de confirmación enviada · {time(wa.at)}</p>}
      {wa && !wa.ok && <p className="text-red-600">No se pudo enviar la plantilla: {wa.error}</p>}
      {!wa && order.waFallbackAt && <p className="text-slate-700">Si el cliente no escribe, se le enviará la plantilla el {time(order.waFallbackAt)}</p>}
      {!wa && !order.waFallbackAt && <p className="text-slate-500">Aún no se le ha enviado la plantilla de confirmación.</p>}
      {PENDING.includes(order.status) && (
        <button
          onClick={send}
          disabled={busy}
          className="h-9 px-3 rounded-lg bg-[#25D366] hover:bg-[#1ebe5a] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
          {wa?.ok ? 'Reenviar confirmación por WhatsApp' : 'Enviar confirmación por WhatsApp'}
        </button>
      )}
      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  );
}
