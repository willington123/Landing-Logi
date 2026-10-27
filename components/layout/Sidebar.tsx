'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Sparkles,
  Layers,
  ShoppingBag,
  PhoneCall,
  MessageSquare,
  Workflow,
  BarChart3,
  Plug,
  Settings,
  Flame,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/landings', label: 'Mis Landing Pages', icon: Layers },
  { href: '/orders', label: 'Pedidos & Despachos', icon: ShoppingBag, badge: 'COD' },
  { href: '/voice-ai', label: 'Llamadas IA (Voice)', icon: PhoneCall, pulse: true },
  { href: '/crm', label: 'CRM & Mensajes', icon: MessageSquare, badge: '3' },
  { href: '/automations', label: 'Automatizaciones', icon: Workflow },
  { href: '/analytics', label: 'Analíticas & UTMs', icon: BarChart3 },
  { href: '/integrations', label: 'Integraciones', icon: Plug },
  { href: '/settings', label: 'Configuración', icon: Settings },
];

export default function Sidebar({ onOpenWizard }: { onOpenWizard?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-brand-navyDark text-white flex flex-col h-screen sticky top-0 border-r border-slate-800 z-30 select-none">
      {/* Brand Logo Header */}
      <div className="px-4 py-4 border-b border-slate-800/80 flex items-center justify-between bg-black/20">
        <Link href="/dashboard" className="flex items-center gap-2 group w-full">
          <div className="bg-white px-3 py-2 rounded-xl shadow-md border border-white/10 flex items-center justify-between w-full hover:shadow-lg transition">
            <img
              src="/brand/logipages-logo.png"
              alt="LogiPages"
              className="h-6 sm:h-7 w-auto object-contain"
            />
            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-gradient-to-r from-[#FF252B] to-[#FF5A16] text-white uppercase tracking-wider shadow-sm">
              AI
            </span>
          </div>
        </Link>
      </div>

      {/* Main Action CTA */}
      <div className="p-4">
        <button
          onClick={onOpenWizard}
          className="w-full relative group overflow-hidden bg-brand-gradient hover:opacity-95 text-white font-bold py-3 px-4 rounded-xl shadow-glow-orange flex items-center justify-center gap-2 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          <Sparkles className="w-5 h-5 text-amber-200 animate-spin" style={{ animationDuration: '4s' }} />
          <span className="text-sm font-semibold tracking-wide">Crear Landing con IA</span>
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Módulos Principales
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-gradient-to-r from-red-600/90 to-orange-600/90 text-white font-semibold shadow-md'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}>
                  {item.badge}
                </span>
              )}

              {item.pulse && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Footer Info / User Account */}
      <div className="p-4 border-t border-slate-800 bg-black/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-red to-brand-navy flex items-center justify-center text-white font-bold text-xs ring-2 ring-white/10">
            LP
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">Tienda Pro E-commerce</p>
            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Plan Growth
            </p>
          </div>
          <Flame className="w-4 h-4 text-orange-400" />
        </div>
      </div>
    </aside>
  );
}
