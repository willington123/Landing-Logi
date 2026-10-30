'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Store } from 'lucide-react';
import { AuthHeader, AuthShell, FormError, PasswordField, SubmitButton, TextField, postJson } from '@/components/auth/AuthShell';
import { clearLocalData } from '@/lib/cloud';

export default function SignupPage() {
  const [open, setOpen] = useState<boolean | null>(null);
  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/auth/state', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setOpen(Boolean(d.signupOpen)))
      .catch(() => setOpen(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson('/api/auth/signup', { name, storeName, email, password });
      clearLocalData();
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      {open === null ? (
        <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
      ) : (
        <div className="w-full max-w-[380px]">
          <AuthHeader
            icon={<Store className="w-5 h-5" />}
            title={open ? 'Crea tu tienda' : 'Registro cerrado'}
            subtitle={open ? 'Tu panel para vender contraentrega: landings, pedidos y WhatsApp en un solo lugar.' : 'Por ahora solo se entra con invitación. Pídele el enlace al dueño de la tienda.'}
          />
          {open && (
            <form onSubmit={submit} className="mt-8 space-y-4">
              <TextField id="name" label="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus placeholder="Ej. Laura Gómez" />
              <TextField id="store" label="Nombre de tu tienda" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Ej. VitaFem" />
              <TextField id="email" label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="tu@correo.com" />
              <PasswordField id="password" label="Contraseña" value={password} onChange={setPassword} autoComplete="new-password" hint="Mínimo 8 caracteres." />
              <FormError error={error} />
              <SubmitButton busy={busy} disabled={!name || !storeName || !email || password.length < 8} label="Crear mi tienda" busyLabel="Creando…" />
            </form>
          )}
          <p className="mt-6 text-sm text-slate-600 text-center lg:text-left">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-semibold text-brand-navy hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
