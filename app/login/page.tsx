'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, MessageCircle, PhoneCall, Sparkles, Truck } from 'lucide-react';

const FEATURES = [
  { icon: Sparkles, title: 'Landings con IA', text: 'Crea páginas de venta contraentrega en minutos.' },
  { icon: MessageCircle, title: 'Confirmación por WhatsApp', text: 'Tus clientes confirman su pedido en un toque.' },
  { icon: PhoneCall, title: 'Llamadas con IA', text: 'Confirma pedidos por teléfono sin levantar el celular.' },
  { icon: Truck, title: 'Pedidos y despacho', text: 'Filtra, exporta a Excel y lleva el control de cada guía.' },
];

// Left side (desktop): brand panel.
function BrandPanel() {
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

function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const next = params.get('next') || '/dashboard';
        window.location.href = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
        return;
      }
      setError(data.error || 'No se pudo iniciar sesión.');
    } catch {
      setError('Sin conexión. Revisa tu internet e inténtalo de nuevo.');
    }
    setShake((n) => n + 1);
    setBusy(false);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.('CapsLock') ?? false);

  return (
    <div className="w-full max-w-[380px]">
      <img src="/brand/logipages-logo.png" alt="LogiPages" className="lg:hidden h-9 w-auto mx-auto mb-10" />

      <div className="text-center lg:text-left">
        <div className="w-12 h-12 rounded-2xl bg-brand-gradient shadow-glow-red flex items-center justify-center mb-6 mx-auto lg:mx-0">
          <Lock className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Bienvenido de nuevo</h1>
        <p className="text-[15px] text-slate-500 mt-1.5">Entra con tu contraseña para ver tus pedidos y mensajes.</p>
      </div>

      <form key={shake} onSubmit={submit} className={`mt-8 ${shake ? 'animate-[lp-shake_0.4s_ease-in-out]' : ''}`}>
        <label htmlFor="password" className="block text-[13px] font-medium text-slate-700 mb-1.5">
          Contraseña
        </label>
        <div className="relative">
          <input
            id="password"
            type={show ? 'text' : 'password'}
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            onKeyUp={onKey}
            onKeyDown={onKey}
            placeholder="••••••••"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'login-error' : undefined}
            className={`w-full h-12 pl-4 pr-12 rounded-xl border bg-white text-[15px] text-slate-900 placeholder-slate-300 outline-none transition focus:ring-4 ${
              error ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-brand-navy/50 focus:ring-brand-navy/10'
            }`}
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
        <div className="min-h-[22px] mt-1.5">
          {error ? (
            <p id="login-error" role="alert" className="text-[13px] text-red-600">
              {error}
            </p>
          ) : caps ? (
            <p className="text-[13px] text-amber-700">Tienes activadas las mayúsculas (Bloq Mayús).</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={busy || !password}
          className="mt-3 w-full h-12 rounded-xl bg-brand-gradient text-white text-[15px] font-semibold flex items-center justify-center gap-2 shadow-[0_10px_24px_-10px_rgba(255,37,43,0.7)] hover:brightness-105 active:scale-[0.99] transition disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Entrando…
            </>
          ) : (
            <>
              Entrar al panel <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-10 text-xs text-slate-400 text-center lg:text-left">
        Acceso solo para administradores de la tienda ·{' '}
        <Link href="/privacidad" className="underline underline-offset-2 hover:text-slate-600">
          Privacidad
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-white">
      <style>{`@keyframes lp-shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}`}</style>
      <BrandPanel />
      <main className="relative overflow-hidden flex items-center justify-center px-6 py-12 bg-white">
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[560px] h-[420px] rounded-full bg-brand-red/10 blur-3xl lg:hidden" />
        <div className="relative w-full flex justify-center">
          <Suspense fallback={<Loader2 className="w-5 h-5 animate-spin text-slate-300" />}>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
