'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { KeyRound, Loader2, TimerOff } from 'lucide-react';
import { AuthHeader, AuthShell, FormError, PasswordField, SubmitButton, postJson } from '@/components/auth/AuthShell';
import { clearLocalData } from '@/lib/cloud';

function ResetForm() {
  const token = useSearchParams().get('t') || '';
  const [who, setWho] = useState<{ email: string; name: string | null } | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/reset?t=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => (d.success ? setWho({ email: d.email, name: d.name }) : setInvalid(d.error)))
      .catch(() => setInvalid('Sin conexión. Recarga la página.'));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError('Las dos contraseñas no coinciden.');
    setBusy(true);
    setError(null);
    try {
      const d = await postJson('/api/auth/reset', { token, password });
      clearLocalData();
      window.location.href = d.signedIn ? '/dashboard' : '/login';
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (invalid)
    return (
      <div className="w-full max-w-[380px]">
        <AuthHeader icon={<TimerOff className="w-5 h-5" />} title="Enlace vencido" subtitle={invalid} />
        <Link href="/recuperar" className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand-gradient text-white font-semibold">
          Pedir un enlace nuevo
        </Link>
      </div>
    );
  if (!who) return <Loader2 className="w-5 h-5 animate-spin text-slate-300" />;
  return (
    <div className="w-full max-w-[380px]">
      <AuthHeader
        icon={<KeyRound className="w-5 h-5" />}
        title="Crea una nueva contraseña"
        subtitle={
          <>
            Para <b className="text-slate-700">{who.email}</b>. Se cerrarán las sesiones abiertas en otros dispositivos.
          </>
        }
      />
      <form onSubmit={submit} className="mt-8 space-y-4">
        <PasswordField id="password" label="Nueva contraseña" value={password} onChange={setPassword} autoComplete="new-password" autoFocus hint="Mínimo 8 caracteres." />
        <PasswordField id="confirm" label="Repite la contraseña" value={confirm} onChange={setConfirm} autoComplete="new-password" error={Boolean(confirm) && confirm !== password} />
        <FormError error={error} />
        <SubmitButton busy={busy} disabled={password.length < 8 || !confirm} label="Guardar y entrar" busyLabel="Guardando…" />
      </form>
    </div>
  );
}

export default function ResetPage() {
  return (
    <AuthShell>
      <Suspense fallback={<Loader2 className="w-5 h-5 animate-spin text-slate-300" />}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
