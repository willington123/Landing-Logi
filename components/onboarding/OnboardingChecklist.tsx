'use client';

// "Primeros pasos": a short checklist on the dashboard until the store has finished setting up.
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bot, CalendarDays, Check, ChevronDown, ChevronRight, FileCheck2, Globe, Layers, MessageCircle, Rocket, ShoppingBag, X } from 'lucide-react';

type StepId = 'landing' | 'whatsapp' | 'confirmation' | 'assistant' | 'order' | 'services' | 'staff' | 'booking' | 'appointment';

const APPOINTMENT_STEPS: { id: StepId; title: string; text: string; cta: string; href?: string; Icon: typeof Layers }[] = [
  { id: 'services', title: 'Crea tus servicios', text: 'Lo que ofreces, con su duración y precio.', cta: 'Ir a Agenda', href: '/agenda', Icon: Layers },
  { id: 'staff', title: 'Agrega quién atiende y su horario', text: 'Si eres solo tú, agrégate a ti. Así se calculan las horas libres.', cta: 'Ir a Agenda', href: '/agenda', Icon: CalendarDays },
  { id: 'booking', title: 'Publica tu página de reservas', text: 'Un enlace y un QR para que tus clientes agenden solos.', cta: 'Publicar', href: '/reservas', Icon: Globe },
  { id: 'whatsapp', title: 'Conecta tu WhatsApp', text: 'Para los recordatorios y para que el asistente agende por chat.', cta: 'Conectar', href: '/integrations', Icon: MessageCircle },
  { id: 'assistant', title: 'Enciende el asistente con IA', text: 'Agenda, reprograma y cancela citas por WhatsApp, incluso de noche.', cta: 'Configurar', href: '/automations', Icon: Bot },
  { id: 'appointment', title: 'Recibe tu primera cita', text: 'Comparte tu página de reservas en tu Instagram y tu WhatsApp.', cta: 'Ver la agenda', href: '/agenda', Icon: Check },
];

const STORE_STEPS: { id: StepId; title: string; text: string; cta: string; href?: string; Icon: typeof Layers }[] = [
  { id: 'landing', title: 'Crea tu primera landing', text: 'Sube la foto de tu producto y la IA arma la página en minutos.', cta: 'Crear landing', Icon: Layers },
  { id: 'whatsapp', title: 'Conecta tu WhatsApp', text: 'Para confirmar pedidos y responder a tus clientes desde el panel.', cta: 'Conectar', href: '/integrations', Icon: MessageCircle },
  { id: 'confirmation', title: 'Activa la confirmación de pedidos', text: 'Crea la plantilla con botones Confirmar / Cancelar. Meta la aprueba en minutos.', cta: 'Ir a Plantillas', href: '/plantillas', Icon: FileCheck2 },
  { id: 'assistant', title: 'Enciende el asistente con IA', text: 'Responde dudas y toma pedidos por WhatsApp, incluso de noche.', cta: 'Configurar', href: '/automations', Icon: Bot },
  { id: 'order', title: 'Recibe tu primer pedido', text: 'Pon el enlace de tu landing en tus anuncios o compártelo por WhatsApp.', cta: 'Ver mis landings', href: '/landings', Icon: ShoppingBag },
];

export default function OnboardingChecklist({ onCreateLanding }: { onCreateLanding: () => void }) {
  const [state, setState] = useState<{ steps: Record<StepId, boolean>; dismissed: boolean; type?: string } | null>(null);
  const [open, setOpen] = useState(false); // the full list; folded it's one line with the next step

  useEffect(() => {
    fetch('/api/onboarding', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => d.success && setState({ steps: d.steps, dismissed: d.dismissed, type: d.type }))
      .catch(() => {});
  }, []);

  if (!state || state.dismissed) return null;
  const STEPS = state.type === 'appointments' ? APPOINTMENT_STEPS : STORE_STEPS;
  const done = STEPS.filter((s) => state.steps[s.id]).length;
  if (done === STEPS.length) return null;
  const next = STEPS.find((s) => !state.steps[s.id])!;
  const pct = Math.round((done / STEPS.length) * 100);

  const hide = () => {
    setState((s) => (s ? { ...s, dismissed: true } : s));
    fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dismissed: true }) }).catch(() => {});
  };

  const cta = (s: (typeof STEPS)[number], primary: boolean) =>
    s.href ? (
      <Link
        href={s.href}
        className={`h-9 px-3.5 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1 whitespace-nowrap ${primary ? 'bg-brand-gradient text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
      >
        {s.cta} <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    ) : (
      <button
        onClick={onCreateLanding}
        className={`h-9 px-3.5 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1 whitespace-nowrap ${primary ? 'bg-brand-gradient text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
      >
        {s.cta} <ChevronRight className="w-3.5 h-3.5" />
      </button>
    );

  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-3 px-4 sm:px-5 py-3.5">
        <span className="w-9 h-9 rounded-xl bg-brand-gradient text-white flex items-center justify-center shrink-0">
          <Rocket className="w-[18px] h-[18px]" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-slate-500">
            <span className="font-semibold text-slate-900">Primeros pasos · {done} de {STEPS.length}</span> · Siguiente: <span className="text-slate-800">{next.title}</span>
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden max-w-sm" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de los primeros pasos">
            <div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${Math.max(pct, 4)}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          {cta(next, true)}
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="h-9 px-2.5 rounded-lg text-[13px] text-slate-500 hover:text-slate-900 hover:bg-slate-50 inline-flex items-center gap-1 whitespace-nowrap">
            {open ? 'Ocultar' : 'Ver los pasos'} <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={hide} className="h-9 w-9 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center" aria-label="Ocultar primeros pasos para siempre" title="No mostrar más">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      {open && (
      <ol className="divide-y divide-slate-100 border-t border-slate-100">
        {STEPS.map((s, i) => {
          const isDone = state.steps[s.id];
          const isNext = s.id === next.id;
          const action = cta(s, isNext);
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
      )}
    </section>
  );
}
