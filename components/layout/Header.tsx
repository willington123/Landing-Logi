'use client';

import React from 'react';
import { Bell, Search, Menu, Globe } from 'lucide-react';
import { SIDEBAR_TOGGLE_EVENT } from './Sidebar';

interface HeaderProps {
  onOpenWizard?: () => void;
  title?: string;
}

export default function Header({ title }: HeaderProps) {
  return (
    <header className="h-16 sticky top-0 z-20 bg-slate-50/80 backdrop-blur-md border-b border-slate-200/70 flex items-center gap-3 px-4 sm:px-6 lg:px-8">
      <button
        onClick={() => window.dispatchEvent(new Event(SIDEBAR_TOGGLE_EVENT))}
        className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-200/60"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>
      <img src="/brand/logipages-icon.png" alt="" className="lg:hidden w-7 h-7 rounded-md" />

      <h1 className="text-[17px] font-semibold text-slate-900 tracking-tight truncate">{title || 'Inicio'}</h1>

      <div className="ml-auto flex items-center gap-2">
        <label className="relative hidden md:block">
          <span className="sr-only">Buscar</span>
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Buscar pedidos, clientes, landings…"
            className="w-72 h-9 text-sm bg-white border border-slate-200 rounded-lg pl-9 pr-3 text-slate-700 placeholder:text-slate-400 outline-none focus:border-brand-navy/40 focus:ring-4 focus:ring-brand-navy/10 transition"
          />
        </label>

        <button className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-slate-200 text-[13px] font-medium text-slate-700 hover:border-slate-300 transition">
          <Globe className="w-4 h-4 text-slate-400" />
          Colombia · COP
        </button>

        <button className="relative w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200 transition" aria-label="Notificaciones">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-brand-red rounded-full ring-2 ring-slate-50" />
        </button>
      </div>
    </header>
  );
}
