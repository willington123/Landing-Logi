'use client';

import React from 'react';
import {
  Bell,
  Search,
  PlusCircle,
  ExternalLink,
  ChevronDown,
  Globe,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  onOpenWizard?: () => void;
  title?: string;
}

export default function Header({ onOpenWizard, title }: HeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-20 flex items-center justify-between px-6">
      {/* Title / Breadcrumb */}
      <div className="flex items-center gap-3">
        {title ? (
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h1>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
            <img
              src="/brand/logipages-logo.png"
              alt="LogiPages"
              className="h-6 w-auto object-contain"
            />
            <span className="text-slate-300">/</span>
            <span className="text-slate-800 font-semibold">Panel de Control</span>
          </div>
        )}
      </div>

      {/* Global Quick Search & Actions */}
      <div className="flex items-center gap-3">
        {/* Search Bar */}
        <div className="relative w-64 hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar pedido, cliente, landing..."
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all"
          />
        </div>

        {/* Store Selector */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition">
          <Globe className="w-3.5 h-3.5 text-brand-navy" />
          <span>Colombia (COP)</span>
          <ChevronDown className="w-3 h-3 text-slate-500" />
        </div>

        {/* Quick CTA to Wizard */}
        <button
          onClick={onOpenWizard}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-brand-gradient hover:opacity-95 text-white rounded-lg text-xs font-bold shadow-sm transition transform active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-200" />
          <span className="hidden sm:inline">Nueva Landing con IA</span>
        </button>

        {/* Notifications */}
        <div className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-red rounded-full ring-2 ring-white"></span>
        </div>
      </div>
    </header>
  );
}
