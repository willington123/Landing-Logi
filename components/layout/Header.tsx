'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import BillingBanner from '@/components/billing/BillingBanner';
import { Menu, Globe } from 'lucide-react';
import { SIDEBAR_TOGGLE_EVENT } from './Sidebar';
import { logiStore } from '@/lib/store';
import { CLOUD_SYNC_EVENT } from '@/lib/cloud';

interface HeaderProps {
  onOpenWizard?: () => void;
  title?: string;
}

export default function Header({ title }: HeaderProps) {
  const [currency, setCurrency] = useState('');

  useEffect(() => {
    const read = () => setCurrency(logiStore.getStoreSettings().currency || 'COP');
    read();
    window.addEventListener(CLOUD_SYNC_EVENT, read);
    return () => window.removeEventListener(CLOUD_SYNC_EVENT, read);
  }, []);

  return (
    <>
    <header className="h-16 sticky top-0 z-20 bg-slate-50/80 backdrop-blur-md border-b border-slate-200/70 flex items-center gap-3 px-4 sm:px-6 lg:px-8">
      <button
        onClick={() => window.dispatchEvent(new Event(SIDEBAR_TOGGLE_EVENT))}
        className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-200/60"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>
      <img src="/brand/konnexa-icon.png" alt="" className="lg:hidden w-7 h-7 rounded-md" />

      <h1 className="text-[17px] font-semibold text-slate-900 tracking-tight truncate">{title || 'Inicio'}</h1>

      <div className="ml-auto flex items-center gap-2">
        {currency && (
          <Link
            href="/settings"
            title="Moneda de la tienda (cámbiala en Configuración)"
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-slate-200 text-[13px] font-medium text-slate-700 hover:border-slate-300 transition"
          >
            <Globe className="w-4 h-4 text-slate-400" />
            {currency}
          </Link>
        )}
      </div>
    </header>
    <BillingBanner />
    </>
  );
}
