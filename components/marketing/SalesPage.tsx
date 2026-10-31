// Public sales page of Konnexa (shown at / to visitors who are not signed in).
import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  FileSpreadsheet,
  ImagePlus,
  MessageSquare,
  PhoneCall,
  Send,
  ShieldCheck,
  Sparkles,
  Tags,
  Users,
} from 'lucide-react';
import { TRIAL_DAYS, cop, type Plan } from '@/lib/plans';

export interface SalesPageProps {
  plans: Plan[];
  signupOpen: boolean;
  contactUrl: string | null; // WhatsApp link when sign-up is closed
}

const FEATURES = [
  { icon: ImagePlus, title: 'Landings con IA en minutos', text: 'Sube la foto del producto: la IA escribe los textos, elige colores, crea las imágenes y arma ofertas por cantidad.' },
  { icon: Send, title: 'Confirmación por WhatsApp', text: 'Cada pedido recibe un mensaje con botones para confirmar o cancelar. El estado se actualiza solo en tu panel.' },
  { icon: PhoneCall, title: 'Llamadas con IA', text: 'Un agente de voz llama al cliente, confirma dirección y pedido, y reintenta si no contesta.' },
  { icon: Bot, title: 'Asistente que vende por chat', text: 'Responde dudas con la información de tu negocio y toma el pedido completo dentro de WhatsApp.' },
  { icon: MessageSquare, title: 'Bandeja de WhatsApp para tu equipo', text: 'Respuestas rápidas, etiquetas, notas, historial del cliente y chats asignados a cada asesor.' },
  { icon: FileSpreadsheet, title: 'Pedidos listos para despachar', text: 'Filtros por estado, fecha y ciudad, número de guía y exportación a Excel para la transportadora.' },
  { icon: BarChart3, title: 'Píxel de Meta y analíticas', text: 'Envía las compras confirmadas a Meta (API de conversiones) para que tus anuncios aprendan de ventas reales.' },
  { icon: Users, title: 'Varias personas, una tienda', text: 'Invita a tu equipo con roles. Cada tienda tiene sus datos separados y protegidos.' },
];

const STEPS = [
  { n: '1', title: 'Crea tu landing', text: 'Sube una foto y en minutos tienes una página lista para tus anuncios.' },
  { n: '2', title: 'Recibe pedidos', text: 'El cliente pide contraentrega y el pedido llega a tu panel al instante.' },
  { n: '3', title: 'Confirma y despacha', text: 'WhatsApp y las llamadas con IA confirman por ti. Tú solo despachas los confirmados.' },
];

const FAQ = [
  { q: '¿Necesito tarjeta para la prueba?', a: `No. Tienes ${TRIAL_DAYS} días gratis con todo lo del plan Pro, sin poner tarjeta. Al final eliges si sigues.` },
  { q: '¿Qué pasa cuando termina la prueba?', a: 'Eliges un plan y pagas con tarjeta, PSE, Nequi o Bancolombia. Si no eliges, tus landings siguen recibiendo pedidos 3 días más y nada se borra.' },
  { q: '¿Puedo cancelar cuando quiera?', a: 'Sí. Apagas la renovación automática desde Plan y pagos y sigues usando lo que ya pagaste hasta el final del periodo.' },
  { q: '¿Necesito la API de WhatsApp?', a: 'Para enviar confirmaciones y responder desde el panel, sí: necesitas un número en la API de WhatsApp Business (Meta). Te guiamos para conectarlo desde Integraciones.' },
  { q: '¿Qué es una “respuesta del asistente IA”?', a: 'Cada mensaje que el asistente envía a un cliente. Pro y Escala traen respuestas incluidas cada mes; si se acaban, puedes conectar tu propia clave de Claude.' },
  { q: '¿Qué pasa si paso el límite de pedidos?', a: 'Nunca rechazamos pedidos: tus landings siguen vendiendo y te avisamos para que subas de plan.' },
];

function Logo() {
  return <img src="/brand/konnexa-logo.png" alt="Konnexa" className="h-8 w-auto" />;
}

function Cta({ signupOpen, contactUrl, size = 'lg', label }: { signupOpen: boolean; contactUrl: string | null; size?: 'md' | 'lg'; label?: string }) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient text-white font-semibold shadow-glow-blue transition hover:brightness-105 ${
    size === 'lg' ? 'h-12 px-6 text-[15px]' : 'h-10 px-4 text-sm'
  }`;
  if (signupOpen)
    return (
      <Link href="/registro" className={cls}>
        {label || `Prueba ${TRIAL_DAYS} días gratis`} <ArrowRight className="w-4 h-4" />
      </Link>
    );
  if (contactUrl)
    return (
      <a href={contactUrl} target="_blank" rel="noopener noreferrer" className={cls}>
        Pide tu acceso <ArrowRight className="w-4 h-4" />
      </a>
    );
  return (
    <Link href="/login" className={cls}>
      Entrar <ArrowRight className="w-4 h-4" />
    </Link>
  );
}

// A small, static picture of the panel: orders being confirmed, and the assistant closing a sale.
function HeroMock() {
  const rows = [
    { n: 'LP-58231', who: 'Laura Gómez · Medellín', total: '$129.900', st: 'Confirmado', cls: 'bg-emerald-50 text-emerald-700' },
    { n: 'LP-58230', who: 'Andrés Ruiz · Cali', total: '$89.900', st: 'Llamando…', cls: 'bg-sky-50 text-sky-700' },
    { n: 'LP-58229', who: 'Paola Díaz · Bogotá', total: '$179.800', st: 'WhatsApp enviado', cls: 'bg-amber-50 text-amber-700' },
    { n: 'LP-58228', who: 'Jorge Peña · Pereira', total: '$89.900', st: 'Despachado', cls: 'bg-indigo-50 text-indigo-700' },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_30px_80px_-30px_rgba(15,23,42,0.35)] overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 h-9 border-b border-slate-100 bg-slate-50">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
          <span className="ml-3 text-[11px] text-slate-400">Pedidos</span>
        </div>
        <div className="p-4 grid grid-cols-3 gap-2">
          {[
            ['Pedidos hoy', '48'],
            ['Confirmados', '41'],
            ['Ventas', '$4,9 M'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-[10px] text-slate-500">{k}</p>
              <p className="text-[15px] font-semibold text-slate-900 tabular-nums">{v}</p>
            </div>
          ))}
        </div>
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {rows.map((r) => (
            <li key={r.n} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-slate-900">{r.n}</p>
                <p className="text-[11px] text-slate-500 truncate">{r.who}</p>
              </div>
              <span className="text-[12px] tabular-nums text-slate-700">{r.total}</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${r.cls}`}>{r.st}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute -bottom-8 -left-2 sm:-left-10 w-[250px] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.35)]">
        <p className="text-[10px] font-medium text-emerald-700 flex items-center gap-1">
          <Bot className="w-3 h-3" /> Asistente IA · WhatsApp
        </p>
        <p className="mt-2 text-[11px] bg-slate-100 rounded-xl rounded-tl-sm px-2.5 py-1.5 text-slate-700 w-fit">¿Me llega a Envigado? 🙏</p>
        <p className="mt-1.5 text-[11px] bg-emerald-50 rounded-xl rounded-tr-sm px-2.5 py-1.5 text-slate-800 ml-auto w-fit max-w-[210px]">
          ¡Sí! Llega en 2 a 3 días y pagas al recibir. ¿Te dejo listo el pedido de 2 unidades?
        </p>
      </div>
    </div>
  );
}

export default function SalesPage({ plans, signupOpen, contactUrl }: SalesPageProps) {
  const year = new Date().getFullYear();
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* nav */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
          <Logo />
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <a href="#funciones" className="hover:text-slate-900">Funciones</a>
            <a href="#precios" className="hover:text-slate-900">Precios</a>
            <a href="#preguntas" className="hover:text-slate-900">Preguntas</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="h-10 px-3 inline-flex items-center text-sm font-medium text-slate-700 hover:text-slate-900">
              Entrar
            </Link>
            <span className="hidden sm:inline-flex">
              <Cta signupOpen={signupOpen} contactUrl={contactUrl} size="md" label="Probar gratis" />
            </span>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-glow-gradient" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-24 lg:pt-20 lg:pb-28 grid lg:grid-cols-[1.05fr_1fr] gap-14 items-center">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-blue bg-brand-blue/5 border border-brand-blue/15 rounded-full px-3 py-1">
              <Sparkles className="w-3.5 h-3.5" /> Para tiendas contraentrega en Colombia
            </p>
            <h1 className="mt-5 text-[38px] leading-[1.08] sm:text-5xl font-bold tracking-tight">
              Vende contraentrega <span className="text-transparent bg-clip-text bg-brand-gradient">sin perder pedidos</span>
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed text-slate-600 max-w-xl">
              Crea landings con IA a partir de una foto, confirma cada pedido por WhatsApp y con llamadas de IA, y deja que un asistente cierre ventas en el chat. Todo en un
              solo panel.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center">
              <Cta signupOpen={signupOpen} contactUrl={contactUrl} />
              <a href="#precios" className="h-12 px-5 inline-flex items-center justify-center rounded-xl border border-slate-200 text-[15px] font-medium text-slate-700 hover:bg-slate-50">
                Ver precios
              </a>
            </div>
            <p className="mt-4 text-sm text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> {TRIAL_DAYS} días gratis
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> Sin tarjeta
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> Cancela cuando quieras
              </span>
            </p>
          </div>
          <HeroMock />
        </div>
      </section>

      {/* how it works */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center">Así de simple</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl bg-white border border-slate-200/80 p-6">
                <span className="w-9 h-9 rounded-xl bg-navy-gradient text-white text-sm font-bold inline-flex items-center justify-center">{s.n}</span>
                <h3 className="mt-4 text-[17px] font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-[15px] text-slate-600 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* features */}
      <section id="funciones" className="scroll-mt-20 max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Todo lo que necesitas para vender contraentrega</h2>
          <p className="mt-3 text-[16px] text-slate-600">Menos pedidos falsos, menos devoluciones y más tiempo para lo que importa: vender.</p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200/80 p-5 hover:shadow-[0_10px_30px_-15px_rgba(15,23,42,0.25)] transition">
              <span className="w-10 h-10 rounded-xl bg-brand-blue/[0.07] text-brand-blue inline-flex items-center justify-center">
                <f.icon className="w-5 h-5" />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-[14px] text-slate-600 leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* pricing */}
      <section id="precios" className="scroll-mt-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Precios claros, en pesos</h2>
            <p className="mt-3 text-[16px] text-slate-600">Empieza con {TRIAL_DAYS} días gratis del plan Pro. Sin tarjeta y sin permanencia.</p>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-5 items-stretch">
            {plans.map((p) => (
              <div
                key={p.id}
                className={`relative rounded-2xl bg-white p-6 flex flex-col ${p.highlight ? 'border-2 border-brand-blue/60 shadow-[0_20px_50px_-25px_rgba(10,108,240,0.45)]' : 'border border-slate-200'}`}
              >
                {p.highlight && <span className="absolute -top-3 left-6 text-[11px] font-semibold text-white bg-brand-gradient rounded-full px-2.5 py-1">Más elegido</span>}
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="mt-2">
                  <span className="text-4xl font-bold tracking-tight tabular-nums">{cop(p.price)}</span>
                  <span className="text-slate-500"> /mes</span>
                </p>
                <ul className="mt-5 space-y-2 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="text-[14px] text-slate-700 flex gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 [&>*]:w-full">
                  <Cta signupOpen={signupOpen} contactUrl={contactUrl} size="lg" label="Empezar gratis" />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-slate-500 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Pagos seguros con Wompi (Bancolombia): tarjeta, PSE, Nequi o Bancolombia.
          </p>
        </div>
      </section>

      {/* faq */}
      <section id="preguntas" className="scroll-mt-20 max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center">Preguntas frecuentes</h2>
        <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-[16px] font-medium">
                {f.q}
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 transition group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-[15px] text-slate-600 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* final cta */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-6xl mx-auto rounded-3xl bg-navy-gradient text-white px-6 py-14 text-center relative overflow-hidden">
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[300px] rounded-full bg-brand-blue/30 blur-3xl" />
          <div className="relative">
            <Tags className="w-8 h-8 mx-auto opacity-80" />
            <h2 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight">Tu próxima landing puede estar lista hoy</h2>
            <p className="mt-3 text-white/75 max-w-xl mx-auto">Crea tu tienda, sube la foto de tu producto y empieza a recibir pedidos confirmados.</p>
            <div className="mt-8">
              <Cta signupOpen={signupOpen} contactUrl={contactUrl} />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center gap-4 text-sm text-slate-500">
          <Logo />
          <p className="sm:ml-4">© {year} Konnexa</p>
          <nav className="sm:ml-auto flex gap-5">
            <Link href="/terminos" className="hover:text-slate-800">Términos</Link>
            <Link href="/privacidad" className="hover:text-slate-800">Privacidad</Link>
            <Link href="/login" className="hover:text-slate-800">Entrar</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
