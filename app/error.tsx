'use client';

import React from 'react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
      <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center text-2xl font-black mb-4 border border-red-500/30">
        !
      </div>
      <h1 className="text-xl font-bold mb-2">Algo salió mal</h1>
      <p className="text-xs text-slate-400 max-w-sm mb-6">
        {error?.message || 'Ha ocurrido un error inesperado al cargar esta sección.'}
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
        >
          Reintentar
        </button>
        <Link
          href="/dashboard"
          className="px-4 py-2 bg-brand-gradient text-white rounded-xl text-xs font-bold transition"
        >
          Ir al Inicio
        </Link>
      </div>
    </div>
  );
}
