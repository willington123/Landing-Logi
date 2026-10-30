'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, UserPlus } from 'lucide-react';
import { AuthHeader, AuthShell, FormError, PasswordField, SubmitButton, TextField, postJson } from '@/components/auth/AuthShell';
import { clearLocalData } from '@/lib/cloud';

interface InviteInfo {
  orgName: string;
  roleLabel: string;
  email: string | null;
  signedInAs: string | null;
}

export default function InvitePage({ params }: { params: { token: string } }) {
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<'new' | 'login'>('new');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/invite?token=${encodeURIComponent(params.token)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => (d.success ? (setInfo(d), d.email && setEmail(d.email)) : setLoadError(d.error)))
      .catch(() => setLoadError('Sin conexión. Recarga la página.'));
  }, [params.token]);

  const accept = async (m: 'session' | 'new' | 'login') => {
    setBusy(true);
    setError(null);
    try {
      await postJson('/api/auth/invite', { token: params.token, mode: m, name, email, password });
      clearLocalData();
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      {!info ? (
        loadError ? (
          <div className="w-full max-w-[380px]">
            <AuthHeader icon={<UserPlus className="w-5 h-5" />} title="Invitación no válida" subtitle={loadError} />
            <Link href="/login" className="mt-8 inline-block text-sm font-semibold text-brand-navy hover:underline">
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
        )
      ) : (
        <div className="w-full max-w-[380px]">
          <AuthHeader
            icon={<UserPlus className="w-5 h-5" />}
            title={`Únete a ${info.orgName}`}
            subtitle={
              <>
                Te invitaron como <strong>{info.roleLabel}</strong>.{info.email ? ` La invitación es para ${info.email}.` : ''}
              </>
            }
          />
          {info.signedInAs && (!info.email || info.email === info.signedInAs) ? (
            <div className="mt-8 space-y-4">
              <p className="text-sm text-slate-600">
                Tienes la sesión abierta como <strong>{info.signedInAs}</strong>.
              </p>
              <FormError error={error} />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  accept('session');
                }}
              >
                <SubmitButton busy={busy} label="Aceptar invitación" busyLabel="Uniéndote…" />
              </form>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                accept(mode);
              }}
              className="mt-8 space-y-4"
            >
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 text-[13px] font-medium">
                {(['new', 'login'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => (setMode(m), setError(null))}
                    className={`h-9 rounded-lg transition ${mode === m ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                  >
                    {m === 'new' ? 'Soy nuevo' : 'Ya tengo cuenta'}
                  </button>
                ))}
              </div>
              {mode === 'new' && <TextField id="name" label="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Ej. Andrés Pérez" />}
              <TextField
                id="email"
                label="Correo"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={Boolean(info.email)}
                autoComplete={mode === 'new' ? 'email' : 'username'}
                placeholder="tu@correo.com"
              />
              <PasswordField
                id="password"
                label={mode === 'new' ? 'Crea una contraseña' : 'Contraseña'}
                value={password}
                onChange={setPassword}
                autoComplete={mode === 'new' ? 'new-password' : 'current-password'}
                hint={mode === 'new' ? 'Mínimo 8 caracteres.' : undefined}
              />
              <FormError error={error} />
              <SubmitButton
                busy={busy}
                disabled={!email || !password || (mode === 'new' && !name)}
                label={mode === 'new' ? 'Crear cuenta y unirme' : 'Entrar y unirme'}
                busyLabel="Uniéndote…"
              />
            </form>
          )}
        </div>
      )}
    </AuthShell>
  );
}
