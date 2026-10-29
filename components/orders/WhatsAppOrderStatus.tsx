'use client';

// Order detail: WhatsApp confirmation status (with a countdown to the fallback template) and a button to send it by hand.
import React, { useEffect, useState } from 'react';
import { Clock, Loader2, MessageCircle } from 'lucide-react';
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

// The fallback template is scheduled and hasn't gone out yet.
export const waFallbackPending = (o: OrderItem) => Boolean(o.waFallbackAt && !o.whatsapp && PENDING.includes(o.status));

// Re-renders every second (for countdowns).
export function useNow(active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function countdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m}:${ss}`;
}

const minsAgo = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? 'hace menos de 1 min' : m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`;
};

// Small label for the orders table: "WhatsApp en 7:12" / "WhatsApp: enviando…" / "WhatsApp falló".
export function WaFallbackBadge({ order, now }: { order: OrderItem; now: number }) {
  if (order.whatsapp && !order.whatsapp.ok && PENDING.includes(order.status))
    return <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-red-600">WhatsApp no enviado</span>;
  if (!waFallbackPending(order)) return null;
  const left = new Date(order.waFallbackAt!).getTime() - now;
  return (
    <span className={`mt-1 inline-flex items-center gap-1 text-[11px] font-semibold ${left > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
      <Clock className="w-3 h-3" />
      {left > 0 ? `WhatsApp en ${countdown(left)}` : 'WhatsApp: enviando…'}
    </span>
  );
}

interface SchedulerInfo {
  lastRunAt?: string;
  lastCronAt?: string;
  lastDeniedAt?: string;
}

// What the automatic check is doing, to explain an overdue template.
function OverdueNote() {
  const [info, setInfo] = useState<SchedulerInfo | null>(null);
  useEffect(() => {
    fetch('/api/scheduler', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);
  if (!info) return null;
  const cronOk = info.lastCronAt && Date.now() - new Date(info.lastCronAt).getTime() < 15 * 60 * 1000;
  const denied = info.lastDeniedAt && (!info.lastCronAt || info.lastDeniedAt > info.lastCronAt);
  if (cronOk) return <p className="text-[11px] text-slate-500">Saldrá en la próxima revisión automática (cada 5 min; última {minsAgo(info.lastCronAt!)}).</p>;
  return (
    <p className="text-[11px] text-amber-800">
      {denied
        ? 'Supabase está llamando a la app pero con una clave que no coincide con CRON_SECRET. Vuelve a copiar el código SQL en Integraciones y ejecútalo otra vez en Supabase.'
        : info.lastCronAt
          ? `La revisión automática de Supabase no responde desde ${minsAgo(info.lastCronAt)}. Revisa Integraciones → Revisión automática.`
          : 'La revisión automática de Supabase todavía no ha llegado nunca. Revisa Integraciones → Revisión automática.'}{' '}
      Mientras tanto, tener abierta esta página también la envía (cada 3 min), o usa el botón de abajo.
    </p>
  );
}

export function WhatsAppOrderStatus({ order, onSent }: { order: OrderItem; onSent?: () => void }) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const pending = waFallbackPending(order);
  const now = useNow(pending);
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
  const left = pending ? new Date(order.waFallbackAt!).getTime() - now : 0;

  return (
    <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-2">
      <span className="text-emerald-800 text-xs font-semibold">WhatsApp</span>
      {wa?.ok && <p className="text-slate-700">Plantilla de confirmación enviada · {time(wa.at)}</p>}
      {wa && !wa.ok && <p className="text-red-600">No se pudo enviar la plantilla: {wa.error}</p>}
      {pending && left > 0 && (
        <div className="space-y-0.5">
          <p className="text-slate-700">
            Esperando que el cliente escriba. Si no lo hace, la plantilla se envía sola en{' '}
            <strong className="tabular-nums text-emerald-800">{countdown(left)}</strong>.
          </p>
          <p className="text-[11px] text-slate-500">Programada para el {time(order.waFallbackAt!)} (puede tardar hasta 5 min más).</p>
        </div>
      )}
      {pending && left <= 0 && (
        <div className="space-y-0.5">
          <p className="text-amber-800">
            Aún no se ha enviado: el tiempo de espera terminó {minsAgo(order.waFallbackAt!)}.
          </p>
          <OverdueNote />
        </div>
      )}
      {!wa && !order.waFallbackAt && <p className="text-slate-500">Aún no se le ha enviado la plantilla de confirmación.</p>}
      {PENDING.includes(order.status) && (
        <button
          onClick={send}
          disabled={busy}
          className="h-9 px-3 rounded-lg bg-[#25D366] hover:bg-[#1ebe5a] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
          {wa?.ok ? 'Reenviar confirmación por WhatsApp' : pending ? 'Enviar ya por WhatsApp' : 'Enviar confirmación por WhatsApp'}
        </button>
      )}
      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  );
}
