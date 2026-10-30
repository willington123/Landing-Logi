'use client';

// Trial / payment notices under the header, and a full-screen notice when the plan ended.
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, Clock, CreditCard, LogOut } from 'lucide-react';
import { fetchAccount, type AccountInfo } from '@/lib/account-client';
import { clearLocalData, isCloud } from '@/lib/cloud';

export default function BillingBanner() {
  const pathname = usePathname();
  const [plan, setPlan] = useState<AccountInfo['plan']>(null);
  useEffect(() => {
    isCloud().then((c) => {
      if (c) fetchAccount().then((r) => setPlan(r.data?.plan || null));
    });
  }, []);
  if (!plan || plan.effective === 'exempt') return null;
  const onPlanPage = pathname?.startsWith('/plan') || pathname?.startsWith('/admin');

  if (plan.panelLocked && !onPlanPage) {
    return (
      <div className="fixed inset-0 z-[70] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-7 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-brand-gradient text-white flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">{plan.status === 'trialing' ? 'Tu prueba gratis terminó' : 'Tu plan venció'}</h2>
          <p className="text-sm text-slate-600">
            Tus landings, pedidos y mensajes siguen guardados. Elige un plan para seguir usando el panel.
            {!plan.landingsOff && ' Tus landings siguen recibiendo pedidos unos días más.'}
          </p>
          <Link href="/plan" className="block h-11 leading-[44px] rounded-xl bg-brand-gradient text-white font-semibold">
            Elegir un plan
          </Link>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              clearLocalData();
              window.location.href = '/login';
            }}
            className="text-xs text-slate-400 hover:text-slate-700 inline-flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  if (onPlanPage) return null;
  if (plan.effective === 'trialing' && plan.daysLeft !== null) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-2 bg-indigo-50 border-b border-indigo-100 text-[13px] text-indigo-900 flex items-center gap-2">
        <Clock className="w-4 h-4 shrink-0" />
        <span className="flex-1">
          {plan.daysLeft <= 1 ? 'Tu prueba gratis termina hoy.' : `Te quedan ${plan.daysLeft} días de prueba gratis.`} Tienes todo lo del plan {plan.name}.
        </span>
        <Link href="/plan" className="font-semibold underline underline-offset-2 whitespace-nowrap">
          Elegir plan
        </Link>
      </div>
    );
  }
  if (plan.effective === 'past_due') {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-2 bg-amber-50 border-b border-amber-200 text-[13px] text-amber-900 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="flex-1">No pudimos cobrar tu plan con la tarjeta guardada. Lo intentaremos de nuevo; también puedes pagar ahora.</span>
        <Link href="/plan" className="font-semibold underline underline-offset-2 whitespace-nowrap">
          Pagar
        </Link>
      </div>
    );
  }
  if (plan.effective === 'active' && plan.daysLeft !== null && plan.daysLeft <= 3 && plan.status !== 'past_due') {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-2 bg-slate-100 border-b border-slate-200 text-[13px] text-slate-700 flex items-center gap-2">
        <Clock className="w-4 h-4 shrink-0" />
        <span className="flex-1">Tu plan se renueva o vence en {plan.daysLeft} {plan.daysLeft === 1 ? 'día' : 'días'}.</span>
        <Link href="/plan" className="font-semibold underline underline-offset-2 whitespace-nowrap">
          Ver plan
        </Link>
      </div>
    );
  }
  return null;
}
