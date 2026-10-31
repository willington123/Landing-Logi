'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { MailCheck, KeyRound } from 'lucide-react';
import { AuthHeader, AuthShell, FormError, SubmitButton, TextField, postJson } from '@/components/auth/AuthShell';

function ForgotForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson('/api/auth/forgot', { email });
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-[380px]">
      {sent ? (
        <>
          <AuthHeader
            icon={<MailCheck className="w-5 h-5" />}
            title="Revisa tu correo"
            subtitle={
              <>
                Si <b className="text-slate-700">{email}</b> tiene una cuenta, te llegará un enlace para crear una nueva contraseña. Vence en 1 hora. Revisa también la carpeta de spam.
              </>
            }
          />
          <button onClick={() => setSent(false)} className="mt-8 text-sm font-medium text-brand-navy hover:underline">
            Usar otro correo
          </button>
        </>
      ) : (
        <>
          <AuthHeader icon={<KeyRound className="w-5 h-5" />} title="¿Olvidaste tu contraseña?" subtitle="Escribe el correo con el que entras y te enviamos un enlace para crear una nueva." />
          <form onSubmit={submit} className="mt-8 space-y-4">
            <TextField id="email" label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus placeholder="tu@correo.com" />
            <FormError error={error} />
            <SubmitButton busy={busy} disabled={!email} label="Enviar enlace" busyLabel="Enviando…" />
          </form>
        </>
      )}
      <p className="mt-6 text-sm text-slate-600 text-center lg:text-left">
        <Link href="/login" className="font-semibold text-brand-navy hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}

export default function ForgotPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <ForgotForm />
      </Suspense>
    </AuthShell>
  );
}
