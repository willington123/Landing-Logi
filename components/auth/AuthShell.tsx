'use client';

// Shared layout and fields for sign-in, sign-up and invitations.
import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Loader2, MessageCircle, PhoneCall, Sparkles, Truck } from 'lucide-react';

const FEATURES = [
  { icon: Sparkles, title: 'Landings con IA', text: 'Crea páginas de venta contraentrega en minutos.' },
  { icon: MessageCircle, title: 'Confirmación por WhatsApp', text: 'Tus clientes confirman su pedido en un toque.' },
  { icon: PhoneCall, title: 'Llamadas con IA', text: 'Confirma pedidos por teléfono sin levantar el celular.' },
  { icon: Truck, title: 'Pedidos y despacho', text: 'Filtra, exporta a Excel y lleva el control de cada guía.' },
];

// Left side (desktop): brand panel.
export function BrandPanel() {
  return (
    <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-navy-gradient p-12 text-white">
      {/* decoration */}
      <div className="pointer-events-none absolute -top-40 -right-32 w-[520px] h-[520px] rounded-full bg-brand-red/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -left-24 w-[460px] h-[460px] rounded-full bg-brand-orange/20 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '44px 44px' }}
      />

      <img src="/brand/logipages-logo-darkmode.png" alt="LogiPages" className="relative h-9 w-auto self-start" />

      <div className="relative max-w-md">
        <h2 className="text-[34px] leading-[1.15] font-bold tracking-tight">
          Vende contraentrega
          <span className="block bg-brand-gradient bg-clip-text text-transparent">sin perder pedidos.</span>
        </h2>
        <p className="mt-4 text-[15px] text-white/70">Todo tu negocio en un solo panel: desde la landing hasta la entrega.</p>
        <ul className="mt-10 space-y-5">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <span className="w-10 h-10 shrink-0 rounded-xl bg-white/10 ring-1 ring-inset ring-white/15 flex items-center justify-center">
                <Icon className="w-5 h-5 text-white" />
              </span>
              <span>
                <span className="block text-[15px] font-semibold">{title}</span>
                <span className="block text-sm text-white/60">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-white/40">© {new Date().getFullYear()} LogiPages</p>
    </div>
  );
}


export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-white">
      <style>{`@keyframes lp-shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}`}</style>
      <BrandPanel />
      <main className="relative overflow-hidden flex items-center justify-center px-6 py-12 bg-white">
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[560px] h-[420px] rounded-full bg-brand-red/10 blur-3xl lg:hidden" />
        <div className="relative w-full flex justify-center">{children}</div>
      </main>
    </div>
  );
}

export function AuthHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: React.ReactNode }) {
  return (
    <>
      <img src="/brand/logipages-logo.png" alt="LogiPages" className="lg:hidden h-9 w-auto mx-auto mb-10" />
      <div className="text-center lg:text-left">
        <div className="w-12 h-12 rounded-2xl bg-brand-gradient shadow-glow-red flex items-center justify-center mb-6 mx-auto lg:mx-0 text-white">{icon}</div>
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="text-[15px] text-slate-500 mt-1.5">{subtitle}</p>
      </div>
    </>
  );
}

const inputCls = (error?: boolean) =>
  `w-full h-12 px-4 rounded-xl border bg-white text-[15px] text-slate-900 placeholder-slate-300 outline-none transition focus:ring-4 ${
    error ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-brand-navy/50 focus:ring-brand-navy/10'
  }`;

export function TextField({
  id,
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <input id={id} {...props} className={inputCls(error)} />
    </div>
  );
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete = 'current-password',
  autoFocus,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.('CapsLock') ?? false);
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={onKey}
          onKeyDown={onKey}
          placeholder="••••••••"
          className={`${inputCls(error)} pr-12`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {show ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
        </button>
      </div>
      {caps ? <p className="text-[12px] text-amber-700 mt-1">Tienes activadas las mayúsculas (Bloq Mayús).</p> : hint ? <p className="text-[12px] text-slate-400 mt-1">{hint}</p> : null}
    </div>
  );
}

export function SubmitButton({ busy, disabled, label, busyLabel }: { busy: boolean; disabled?: boolean; label: string; busyLabel: string }) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="w-full h-12 rounded-xl bg-brand-gradient text-white text-[15px] font-semibold flex items-center justify-center gap-2 shadow-[0_10px_24px_-10px_rgba(255,37,43,0.7)] hover:brightness-105 active:scale-[0.99] transition disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
    >
      {busy ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" /> {busyLabel}
        </>
      ) : (
        <>
          {label} <ArrowRight className="w-4 h-4" />
        </>
      )}
    </button>
  );
}

export function FormError({ error }: { error: string | null }) {
  return <div className="min-h-[20px]">{error && <p role="alert" className="text-[13px] text-red-600">{error}</p>}</div>;
}

// POST JSON; returns the parsed body or throws with the server's message.
export async function postJson(url: string, body: unknown) {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('Sin conexión. Revisa tu internet e inténtalo de nuevo.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw Object.assign(new Error(data.error || 'Algo salió mal. Inténtalo de nuevo.'), { data });
  return data;
}

export const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
