'use client';

// Prices on the sales page, with "pay several months" discounts.
import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { PREPAY, cop, prepayTotal, type Plan } from '@/lib/plans';

export default function PricingPlans({ plans, cta }: { plans: Plan[]; cta: React.ReactNode }) {
  const [months, setMonths] = useState(1);
  const disc = PREPAY.find((x) => x.months === months)?.discount || 0;
  return (
    <>
      <div className="mt-8 flex justify-center">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 overflow-x-auto max-w-full" role="tablist" aria-label="Meses a pagar">
          {PREPAY.map((x) => (
            <button
              key={x.months}
              role="tab"
              aria-selected={months === x.months}
              onClick={() => setMonths(x.months)}
              className={`h-9 px-3 rounded-lg text-[13px] font-medium whitespace-nowrap ${months === x.months ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {x.label}
              {x.discount > 0 && <span className={`ml-1 text-[11px] font-bold ${months === x.months ? 'text-emerald-300' : 'text-emerald-600'}`}>-{Math.round(x.discount * 100)}%</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-8 grid md:grid-cols-3 gap-5 items-stretch">
        {plans.map((p) => (
          <div
            key={p.id}
            className={`relative rounded-2xl bg-white p-6 flex flex-col ${p.highlight ? 'border-2 border-brand-blue/60 shadow-[0_20px_50px_-25px_rgba(10,108,240,0.45)]' : 'border border-slate-200'}`}
          >
            {p.highlight && <span className="absolute -top-3 left-6 text-[11px] font-semibold text-white bg-brand-gradient rounded-full px-2.5 py-1">Más elegido</span>}
            <h3 className="text-lg font-semibold">{p.name}</h3>
            <p className="mt-2">
              <span className="text-4xl font-bold tracking-tight tabular-nums">{cop(prepayTotal(p.price, months) / months)}</span>
              <span className="text-slate-500"> /mes</span>
              {disc > 0 && <span className="ml-2 text-slate-400 line-through">{cop(p.price)}</span>}
            </p>
            {months > 1 ? (
              <p className="text-[13px] text-emerald-700 mt-1">
                {cop(prepayTotal(p.price, months))} por {months} meses · ahorras {cop(p.price * months - prepayTotal(p.price, months))}
              </p>
            ) : (
              <p className="text-[13px] text-slate-500 mt-1">Pago mes a mes, sin permanencia</p>
            )}
            {p.extraStorePrice > 0 && <p className="text-[13px] text-slate-500">Cada tienda extra: {cop(p.extraStorePrice)}/mes</p>}
            <ul className="mt-5 space-y-2 flex-1">
              {p.features.map((f) => (
                <li key={f} className="text-[14px] text-slate-700 flex gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 [&>*]:w-full">{cta}</div>
          </div>
        ))}
      </div>
    </>
  );
}
