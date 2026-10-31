'use client';

// "Primeros pasos": a short checklist on the dashboard until the store has finished setting up.
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bot, Check, ChevronRight, FileCheck2, Layers, MessageCircle, Rocket, ShoppingBag, X } from 'lucide-react';

type StepId = 'landing' | 'whatsapp' | 'confirmation' | 'assistant' | 'order';

const STEPS: { id: StepId; title: string; text: string; cta: string; href?: string; Icon: typeof Layers }[] = [
  { id: 'landing', title: 'Crea tu primera landing', text: 'Sube la foto de tu producto y la IA arma la página en minutos.', cta: 'Crear landing', Icon: Layers },
  { id: 'whatsapp', title: 'Conecta tu WhatsApp', text: 'Para confirmar pedidos y responder a tus clientes desde el panel.', cta: 'Conectar', href: '/integrations', Icon: MessageCircle },
  { id: 'confirmation', title: 'Activa la confirmación de pedidos', text: 'Crea la plantilla con botones Confirmar / Cancelar. Meta la aprueba en minutos.', cta: 'Ir a Plantillas', href: '/plantillas', Icon: FileCheck2 },
  { id: 'assistant', title: 'Enciende el asistente con IA', text: 'Responde dudas y toma pedidos por WhatsApp, incluso de noche.', cta: 'Configurar', href: '/automations', Icon: Bot },
  { id: 'order', title: 'Recibe tu primer pedido', text: 'Pon el enlace de tu landing en tus anuncios o compártelo por WhatsApp.', cta: 'Ver mis landings', href: '/landings', Icon: ShoppingBag },
];

export default function OnboardingChecklist({ onCreateLanding }: { onCreateLanding: () => void }) {
  const [state, setState] = useState<{ steps: Record<StepId, boolean>; dismissed: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/onboarding', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => d.success && setState({ steps: d.steps, dismissed: d.dismissed }))
      .catch(() => {});
  }, []);

  if (!state || state.dismissed) return null;
  const done = STEPS.filter((s) => state.steps[s.id]).length;
  if (done === STEPS.length) return null;
  const next = STEPS.find((s) => !state.steps[s.id])!;
  const pct = Math.round((done / STEPS.length) * 100);

  const hide = () => {
    setState((s) => (s ? { ...s, dismissed: true } : s));
    fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dismissed: true }) }).catch(() => {});
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="flex items-start gap-4 p-5 sm:p-6 border-b border-slate-100">
        <span className="w-10 h-10 rounded-xl bg-brand-gradient text-white flex items-center justify-center shrink-0">
          <Rocket className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-semibold text-slate-900">Primeros pasos</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            {done} de {STEPS.length} listos. Termínalos para empezar a vender con todo.
          </p>
          <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden max-w-md" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${Math.max(pct, 4)}%` }} />
          </div>
        </div>
        <button onClick={hide} className="text-slate-400 hover:text-slate-700 p-1 -m-1" aria-label="Ocultar primeros pasos" title="Ocultar">
          <X className="w-4 h-4" />
        </button>
      </div>
      <ol className="divide-y divide-slate-100">
        {STEPS.map((s, i) => {
          const isDone = state.steps[s.id];
          const isNext = s.id === next.id;
          const action = s.href ? (
            <Link
              href={s.href}
              className={`h-9 px-3.5 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1 whitespace-nowrap ${
                isNext ? 'bg-brand-gradient text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {s.cta} <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <button
              onClick={onCreateLanding}
              className={`h-9 px-3.5 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1 whitespace-nowrap ${
                isNext ? 'bg-brand-gradient text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {s.cta} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          );
          return (
            <li key={s.id} className={`flex items-center gap-4 px-5 sm:px-6 py-3.5 ${isNext ? 'bg-brand-blue/[0.03]' : ''}`}>
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                  isDone ? 'bg-emerald-500 text-white' : isNext ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {isDone ? <Check className="w-4 h-4" /> : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-[14px] font-medium ${isDone ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{s.title}</p>
                {!isDone && <p className="text-[12.5px] text-slate-500 mt-0.5">{s.text}</p>}
              </div>
              {!isDone && <div className="hidden sm:block">{action}</div>}
              {!isDone && isNext && <div className="sm:hidden">{action}</div>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
