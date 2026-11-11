'use client';

// "Avisos en este dispositivo": notices on the phone or computer even with Konnexa closed.
import React, { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2, X } from 'lucide-react';
import { disablePush, enablePush, pushState, type PushMode, type PushState } from '@/lib/push-client';

const HIDE_KEY = 'konnexa_push_banner_hidden';

function usePush() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    pushState().then(setState);
  }, []);
  const run = async (f: () => Promise<PushState>) => {
    setBusy(true);
    setError(null);
    try {
      setState(await f());
    } catch (e: any) {
      setError(e?.message || 'No se pudieron activar los avisos.');
    } finally {
      setBusy(false);
    }
  };
  return { state, busy, error, on: (mode: PushMode = 'all') => run(() => enablePush(mode)), off: () => run(disablePush) };
}

const HELP: Record<string, string> = {
  'ios-install': 'En iPhone: toca Compartir → “Agregar a inicio”, abre Konnexa desde ese ícono y activa los avisos ahí.',
  blocked: 'Los avisos están bloqueados en este navegador. Actívalos en el candado de la barra de direcciones → Notificaciones.',
  unsupported: 'Este navegador no permite avisos. Usa Chrome, Edge o Safari actualizado.',
};

// Row for a settings menu (Mensajes → Filtros avanzados).
export function PushAlertsRow() {
  const { state, busy, error, on, off } = usePush();
  if (!state) return null;
  const icon = busy ? <Loader2 className="w-4 h-4 text-slate-400 animate-spin" /> : state.status === 'on' ? <BellRing className="w-4 h-4 text-emerald-600" /> : <BellOff className="w-4 h-4 text-slate-400" />;
  if (HELP[state.status])
    return (
      <p className="text-[12px] text-slate-500 flex gap-2">
        <BellOff className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" /> <span>Avisos en este dispositivo: {HELP[state.status]}</span>
      </p>
    );
  return (
    <div className="space-y-1.5">
      <button onClick={() => (state.status === 'on' ? off() : on())} disabled={busy} className="w-full text-left text-slate-700 hover:text-slate-900 inline-flex items-center gap-2">
        {icon} Avisos en este dispositivo: {state.status === 'on' ? 'activados' : 'apagados'}
      </button>
      {state.status === 'on' && (
        <select value={state.mode} onChange={(e) => on(e.target.value as PushMode)} disabled={busy} className="ml-6 h-8 text-[12px] border border-slate-200 rounded-lg px-2 bg-white text-slate-700" aria-label="Qué avisar">
          <option value="all">Cada mensaje que espera a una persona</option>
          <option value="handoff">Solo cuando la IA pide un asesor</option>
        </select>
      )}
      {error && <p className="ml-6 text-[12px] text-red-600">{error}</p>}
    </div>
  );
}

// One-line invitation on top of Mensajes while this device has no notices yet.
export function PushAlertsBanner() {
  const { state, busy, error, on } = usePush();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(HIDE_KEY) === '1');
    } catch {
      setHidden(false);
    }
  }, []);
  if (!state || hidden || (state.status !== 'off' && state.status !== 'ios-install')) return null;
  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(HIDE_KEY, '1');
    } catch {}
  };
  return (
    <div className="px-4 py-2.5 border-b border-blue-100 bg-blue-50/70 flex items-center gap-3 text-[13px] text-blue-950">
      <Bell className="w-4 h-4 shrink-0 text-brand-blue" />
      <p className="flex-1 min-w-0">
        {state.status === 'ios-install' ? HELP['ios-install'] : 'Recibe un aviso en este dispositivo cuando un cliente necesite a una persona, aunque Konnexa esté cerrado.'}
        {error && <span className="block text-red-600">{error}</span>}
      </p>
      {state.status === 'off' && (
        <button onClick={() => on()} disabled={busy} className="h-9 px-3 rounded-lg bg-brand-blue text-white text-[13px] font-semibold inline-flex items-center gap-1.5 shrink-0 disabled:opacity-60">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Activar avisos
        </button>
      )}
      <button onClick={hide} className="p-1.5 text-blue-900/50 hover:text-blue-950 shrink-0" aria-label="Ocultar">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Small bell in the Mensajes top bar while this device has no notices yet (replaces the banner).
export function PushAlertsBell() {
  const { state, busy, error, on } = usePush();
  const [open, setOpen] = useState(false);
  if (!state || (state.status !== 'off' && state.status !== 'ios-install')) return null;
  return (
    <span className="relative inline-flex">
      <button
        onClick={() => (state.status === 'off' ? on() : setOpen((v) => !v))}
        disabled={busy}
        title={state.status === 'off' ? 'Activar avisos en este dispositivo: te llega un aviso cuando un cliente necesite a una persona, aunque Konnexa esté cerrado' : HELP['ios-install']}
        aria-label="Activar avisos en este dispositivo"
        className="relative h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-brand-blue hover:border-blue-200 flex items-center justify-center disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-blue" />
      </button>
      {(open || error) && (
        <span className="absolute right-0 top-full mt-2 z-40 w-64 rounded-xl border border-slate-200 bg-white shadow-lg p-3 text-[12px] text-slate-700">
          {error || HELP['ios-install']}
        </span>
      )}
    </span>
  );
}
