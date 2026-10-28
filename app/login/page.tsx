'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock, Loader2 } from 'lucide-react';

function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      const next = params.get('next') || '/dashboard';
      window.location.href = next.startsWith('/') ? next : '/dashboard';
    } else {
      setError(data.error || 'No se pudo iniciar sesión.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-7">
      <img src="/brand/logipages-logo.png" alt="LogiPages" className="h-8 w-auto mx-auto mb-6" />
      <h1 className="text-lg font-semibold text-slate-900 text-center">Entrar al panel</h1>
      <p className="text-sm text-slate-500 text-center mt-1 mb-6">Introduce la contraseña de administrador.</p>
      <label className="relative block">
        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-300 text-sm outline-none focus:border-slate-900"
        />
      </label>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <button disabled={busy || !password} className="mt-4 w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Entrar
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
