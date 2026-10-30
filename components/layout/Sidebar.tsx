'use client';

import React, { useEffect, useState } from 'react';
import { isCloud, pullFromCloud, CLOUD_SYNC_EVENT, clearLocalData, ensureLocalOrg } from '@/lib/cloud';
import { logiStore } from '@/lib/store';
import { UNREAD_REFRESH_EVENT, playMessageSound, soundOn } from '@/lib/notify';
import { fetchAccount } from '@/lib/account-client';
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
  X,
  LogOut,
  CreditCard,
  ShieldCheck,
  FileText,
  ChevronsUpDown,
  Check,
} from 'lucide-react';

interface AccountInfo {
  user: { id: string; email: string; name: string | null } | null;
  org: { id: string; name: string; role: string } | null;
  orgs: { id: string; name: string; role: string }[];
  platformAdmin?: boolean;
}

// Header's menu button dispatches this event to open the sidebar on mobile.
export const SIDEBAR_TOGGLE_EVENT = 'lp:toggle-sidebar';

const NAV_GROUPS = [
  {
    label: 'Vender',
    items: [
      { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
      { href: '/landings', label: 'Landing pages', icon: Layers },
      { href: '/orders', label: 'Pedidos', icon: ShoppingBag },
    ],
  },
  {
    label: 'Atender',
    items: [
      { href: '/voice-ai', label: 'Llamadas IA', icon: PhoneCall },
      { href: '/crm', label: 'Mensajes', icon: MessageSquare },
      { href: '/plantillas', label: 'Plantillas', icon: FileText },
    ],
  },
  {
    label: 'Crecer',
    items: [
      { href: '/automations', label: 'Automatizaciones', icon: Workflow },
      { href: '/analytics', label: 'Analíticas', icon: BarChart3 },
    ],
  },
  {
    label: 'Cuenta',
    items: [
      { href: '/integrations', label: 'Integraciones', icon: Plug },
      { href: '/plan', label: 'Plan y pagos', icon: CreditCard },
      { href: '/settings', label: 'Configuración', icon: Settings },
    ],
  },
];

export default function Sidebar({ onOpenWizard }: { onOpenWizard?: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [authOn, setAuthOn] = useState(false);
  const [storeName, setStoreName] = useState('');

  useEffect(() => {
    const toggle = () => setOpen((v) => !v);
    window.addEventListener(SIDEBAR_TOGGLE_EVENT, toggle);
    return () => window.removeEventListener(SIDEBAR_TOGGLE_EVENT, toggle);
  }, []);

  // Refresh landings and orders from Supabase (no-op when the cloud is not configured).
  useEffect(() => {
    const readName = () => setStoreName(logiStore.getStoreSettings().storeName);
    readName();
    window.addEventListener(CLOUD_SYNC_EVENT, readName);
    fetch('/api/status')
      .then((r) => r.json())
      .then((d) => setAuthOn(Boolean(d.auth)))
      .catch(() => {});
    isCloud().then(async (cloud) => {
      if (!cloud) return pullFromCloud();
      // Who is signed in, and in which store. The local cache is cleared if it belongs to another store.
      try {
        const res = await fetchAccount();
        if (res.status === 401) {
          clearLocalData();
          window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        const d: any = res.data;
        if (d?.success && d.org) {
          setAccount(d);
          ensureLocalOrg(d.org.id);
        }
      } catch {
        // offline: keep the cached data
      }
      pullFromCloud();
    });
    return () => window.removeEventListener(CLOUD_SYNC_EVENT, readName);
  }, []);

  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [orgMenu, setOrgMenu] = useState(false);
  const switchOrg = async (orgId: string) => {
    const res = await fetch('/api/account/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId }) });
    if (res.ok) {
      clearLocalData();
      window.location.href = '/dashboard';
    }
  };

  // Unread WhatsApp messages: badge on "Mensajes", count in the tab title and a sound when a new one arrives.
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let stop = false;
    const SEEN = 'lp_last_inbound_seen';
    const check = async () => {
      try {
        const d = await fetch('/api/whatsapp/unread', { cache: 'no-store' }).then((r) => r.json());
        if (stop || !d.success) return;
        setUnread(d.unread || 0);
        const last: string | null = d.lastInboundAt;
        let seen: string | null = null;
        try {
          seen = sessionStorage.getItem(SEEN);
        } catch {}
        if (last && (!seen || last > seen)) {
          // First check in this browser tab only remembers; later ones mean a new message arrived.
          if (seen && soundOn()) playMessageSound();
          try {
            sessionStorage.setItem(SEEN, last);
          } catch {}
        } else if (!seen) {
          try {
            sessionStorage.setItem(SEEN, last || new Date(0).toISOString());
          } catch {}
        }
      } catch {
        // offline or no WhatsApp tables yet: try again later
      }
    };
    let t: ReturnType<typeof setInterval> | undefined;
    isCloud().then((cloud) => {
      if (!cloud || stop) return;
      check();
      t = setInterval(check, 20000);
    });
    window.addEventListener(UNREAD_REFRESH_EVENT, check);
    return () => {
      stop = true;
      if (t) clearInterval(t);
      window.removeEventListener(UNREAD_REFRESH_EVENT, check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = unread > 0 ? `(${unread}) ${base}` : base;
  }, [unread, pathname]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    clearLocalData();
    window.location.href = '/login';
  };

  // Close the mobile drawer after navigating.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      )}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 lg:z-30 h-screen w-[248px] flex-shrink-0 bg-white border-r border-slate-200/80 flex flex-col select-none transition-transform duration-200 ${
          open ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="h-16 px-5 flex items-center justify-between">
          <Link href="/dashboard" aria-label="LogiPages, ir al inicio">
            <img src="/brand/logipages-logo.png" alt="LogiPages" className="h-[30px] w-auto" />
          </Link>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1.5 -mr-1.5 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Cerrar menú">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary action */}
        <div className="px-4 pb-4">
          <button
            onClick={() => {
              setOpen(false);
              onOpenWizard?.();
            }}
            className="w-full h-10 rounded-xl bg-brand-gradient text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_8px_20px_-8px_rgba(255,37,43,0.6)] hover:brightness-105 active:scale-[0.98] transition"
          >
            <Sparkles className="w-4 h-4" />
            Crear landing con IA
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em]">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex items-center gap-3 h-9 px-3 rounded-lg text-[13.5px] transition ${
                        active
                          ? 'bg-brand-navy/[0.07] text-brand-navy font-semibold'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-brand-gradient" />}
                      <Icon className={`w-[18px] h-[18px] ${active ? 'text-brand-navy' : 'text-slate-400'}`} strokeWidth={2} />
                      <span className="flex-1">{item.label}</span>
                      {item.href === '/crm' && unread > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#25D366] text-white text-[11px] font-bold flex items-center justify-center">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {account?.platformAdmin && (
          <div className="px-3 pb-2">
            <Link
              href="/admin"
              className={`flex items-center gap-3 h-9 px-3 rounded-lg text-[13.5px] transition ${pathname?.startsWith('/admin') ? 'bg-brand-navy/[0.07] text-brand-navy font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <ShieldCheck className="w-[18px] h-[18px] text-slate-400" /> Admin plataforma
            </Link>
          </div>
        )}
        {/* Account */}
        <div className="p-3 border-t border-slate-200/80">
          <div className="relative">
            <button
              onClick={() => (account && account.orgs.length > 1 ? setOrgMenu((v) => !v) : (window.location.href = '/settings'))}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 transition text-left"
            >
              <img src="/brand/logipages-icon.png" alt="" className="w-9 h-9 rounded-lg border border-slate-200" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 truncate">{account?.org?.name || storeName || 'Mi tienda'}</p>
                <p className="text-xs text-slate-500 truncate">
                  {account?.user ? account.user.name || account.user.email : storeName ? 'Configuración' : 'Pon el nombre de tu tienda'}
                </p>
              </div>
              {account && account.orgs.length > 1 && <ChevronsUpDown className="w-4 h-4 text-slate-400 shrink-0" />}
            </button>
            {orgMenu && account && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-xl border border-slate-200 shadow-lg p-1.5 z-10">
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tus tiendas</p>
                {account.orgs.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => (o.id === account.org?.id ? setOrgMenu(false) : switchOrg(o.id))}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left text-[13px] text-slate-800"
                  >
                    <span className="truncate flex-1">{o.name}</span>
                    {o.id === account.org?.id && <Check className="w-3.5 h-3.5 text-slate-900" />}
                  </button>
                ))}
                <Link href="/settings" className="block mt-1 border-t border-slate-100 px-2 pt-2 pb-1 text-xs font-medium text-slate-600 hover:text-slate-900">
                  Configuración y equipo
                </Link>
              </div>
            )}
          </div>
          {authOn && (
            <button onClick={logout} className="mt-1 w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition">
              <LogOut className="w-4 h-4" /> Cerrar sesión
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
