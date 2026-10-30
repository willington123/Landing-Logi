'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { KeyRound, Loader2, Lock } from 'lucide-react';
import { AuthHeader, AuthShell, FormError, PasswordField, SubmitButton, TextField, postJson, safeNext } from '@/components/auth/AuthShell';
import { clearLocalData } from '@/lib/cloud';

interface AuthState {
  mode: 'local' | 'cloud';
  needsSetup: boolean;
  setupNeedsPassword?: boolean;
  signupOpen: boolean;
}

function LoginForm() {
  const params = useSearchParams();
  const [state, setState] = useState<AuthState | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // first-time setup
  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/auth/state', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => (d.success ? setState(d) : setStateError(d.error)))
      .catch(() => setStateError('Sin conexión. Recarga la página.'));
  }, []);

  const done = () => {
    clearLocalData(); // never show another account's cached data
    window.location.href = safeNext(params.get('next'));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !state) return;
    setBusy(true);
    setError(null);
    try {
      if (state.needsSetup) await postJson('/api/auth/setup', { name, storeName, email, password, adminPassword });
      else await postJson('/api/auth/login', state.mode === 'local' ? { password } : { email, password });
      done();
      return;
    } catch (err: any) {
      if (err?.data?.needsSetup) setState((s) => (s ? { ...s, needsSetup: true } : s));
      setError(err.message);
    }
    setShake((n) => n + 1);
    setBusy(false);
  };

  if (!state)
    return stateError ? <p className="text-sm text-red-600 max-w-sm text-center">{stateError}</p> : <Loader2 className="w-5 h-5 animate-spin text-slate-300" />;

  const setup = state.needsSetup;
  return (
    <div className="w-full max-w-[380px]">
      <AuthHeader
        icon={setup ? <KeyRound className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
        title={setup ? 'Crea tu cuenta de dueño' : 'Bienvenido de nuevo'}
        subtitle={
          setup
            ? 'Ahora cada persona entra con su correo. Crea la tuya: tus landings, pedidos y mensajes quedan en tu tienda.'
            : state.mode === 'local'
              ? 'Entra con tu contraseña para ver tus pedidos y mensajes.'
              : 'Entra con tu correo y contraseña.'
        }
      />

      <form key={shake} onSubmit={submit} className={`mt-8 space-y-4 ${shake ? 'animate-[lp-shake_0.4s_ease-in-out]' : ''}`}>
        {setup && (
          <>
            <TextField id="name" label="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus placeholder="Ej. Laura Gómez" />
            <TextField id="store" label="Nombre de tu tienda" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Ej. VitaFem (opcional)" />
          </>
        )}
        {state.mode === 'cloud' && (
          <TextField
            id="email"
            label="Correo"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete={setup ? 'email' : 'username'}
            autoFocus={!setup}
            placeholder="tu@correo.com"
            error={Boolean(error)}
          />
        )}
        <PasswordField
          id="password"
          label={setup ? 'Crea una contraseña' : 'Contraseña'}
          value={password}
          onChange={(v) => {
            setPassword(v);
            if (error) setError(null);
          }}
          autoComplete={setup ? 'new-password' : 'current-password'}
          autoFocus={state.mode === 'local'}
          error={Boolean(error)}
          hint={setup ? 'Mínimo 8 caracteres.' : undefined}
        />
        {setup && state.setupNeedsPassword && (
          <PasswordField
            id="admin"
            label="Contraseña actual del panel"
            value={adminPassword}
            onChange={setAdminPassword}
            autoComplete="off"
            hint="La que usabas hasta hoy para entrar (ADMIN_PASSWORD). Confirma que eres el dueño."
          />
        )}
        {!setup && state.mode === 'cloud' && (
          <div className="-mt-1 text-right">
            <Link href={`/recuperar${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="text-[13px] font-medium text-brand-navy hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        )}
        <FormError error={error} />
        <SubmitButton
          busy={busy}
          disabled={!password || (state.mode === 'cloud' && !email) || (setup && (!name || (state.setupNeedsPassword && !adminPassword)))}
          label={setup ? 'Crear mi cuenta' : 'Entrar al panel'}
          busyLabel={setup ? 'Creando…' : 'Entrando…'}
        />
      </form>

      {state.signupOpen && !setup && (
        <p className="mt-6 text-sm text-slate-600 text-center lg:text-left">
          ¿No tienes cuenta?{' '}
          <Link href="/registro" className="font-semibold text-brand-navy hover:underline">
            Crea tu tienda
          </Link>
        </p>
      )}
      <p className="mt-10 text-xs text-slate-400 text-center lg:text-left">
        <Link href="/terminos" className="underline underline-offset-2 hover:text-slate-600">
          Términos
        </Link>
        {' · '}
        <Link href="/privacidad" className="underline underline-offset-2 hover:text-slate-600">
          Privacidad
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={<Loader2 className="w-5 h-5 animate-spin text-slate-300" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
