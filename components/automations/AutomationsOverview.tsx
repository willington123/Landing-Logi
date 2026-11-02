'use client';

// "Lo que Konnexa hace por ti": every automation that really runs, whether it's on, and what it did lately.
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Workflow } from 'lucide-react';

type State = 'on' | 'off' | 'warn';
interface Item {
  id: string;
  when: string;
  does: string;
  state: State;
  detail: string;
  count?: string;
  href: string;
}
interface Overview {
  businessType: 'orders' | 'appointments';
  items: Item[];
  check: { needed: boolean; ok: boolean; lastRunAt: string | null };
}

const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
const PILL: Record<State, { label: string; cls: string; action: string }> = {
  on: { label: 'Encendido', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', action: 'Configurar' },
  warn: { label: 'Falta algo', cls: 'bg-amber-50 text-amber-800 border-amber-200', action: 'Arreglar' },
  off: { label: 'Apagado', cls: 'bg-slate-100 text-slate-600 border-slate-200', action: 'Activar' },
};

function Go({ href, children, strong }: { href: string; children: React.ReactNode; strong?: boolean }) {
  const cls = `hit h-9 px-3 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5 shrink-0 ${strong ? 'bg-brand-gradient text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`;
  if (href.startsWith('#'))
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

export default function AutomationsOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/automations/overview', { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, []);

  const on = data?.items.filter((i) => i.state === 'on').length ?? 0;

  return (
    <section className={`${card} p-5 md:p-6 space-y-4`}>
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-brand-gradient text-white flex items-center justify-center shrink-0">
          <Workflow className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-900">Lo que Konnexa hace por ti</h2>
          <p className="text-[13px] text-slate-600">
            Esto funciona solo, sin que tengas que estar pendiente. {data ? `Tienes ${on} de ${data.items.length} encendidas.` : ''} Los números son de los últimos 30 días.
          </p>
        </div>
      </div>

      {error && <p className="text-[13px] text-red-600">No se pudo cargar: {error}</p>}
      {!data && !error && <div className="h-40 rounded-xl bg-slate-50 animate-pulse" />}

      {data?.check.needed && !data.check.ok && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[13px] text-amber-900 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">
            <strong>La revisión automática no está corriendo.</strong> Los recordatorios, seguimientos y reintentos necesitan que Konnexa revise cada 5 minutos.{' '}
            <Link href="/voice-ai" className="font-semibold underline">
              Activarla en Llamadas IA → Tareas programadas
            </Link>
          </span>
        </div>
      )}

      {data && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {data.items.map((i) => {
            const p = PILL[i.state];
            return (
              <li key={i.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${p.cls}`}>{p.label}</span>
                    <span className="text-[12px] text-slate-500">Cuando: {i.when}</span>
                  </div>
                  <p className="text-[14px] font-semibold text-slate-900 mt-1 flex items-start gap-1.5">
                    <ArrowRight className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                    {i.does}
                  </p>
                  <p className={`text-[12px] mt-0.5 ${i.state === 'warn' ? 'text-amber-800' : 'text-slate-500'}`}>{i.detail}</p>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3">
                  {i.count && i.state !== 'off' && <span className="text-[12px] text-slate-600 sm:text-right">{i.count}</span>}
                  <Go href={i.href} strong={i.state !== 'on'}>
                    {p.action}
                  </Go>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
