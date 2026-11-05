'use client';

import React, { useEffect, useRef, useState } from 'react';
import { isCloud, pullFromCloud, CLOUD_SYNC_EVENT, clearLocalData, ensureLocalOrg } from '@/lib/cloud';
import { logiStore } from '@/lib/store';
import { UNREAD_REFRESH_EVENT, playHandoffSound, playMessageSound, showNotice, soundOn } from '@/lib/notify';
import { fetchAccount } from '@/lib/account-client';
import InstallApp from '@/components/layout/InstallApp';
import StoreAvatar, { STORE_LOGO_EVENT } from '@/components/layout/StoreAvatar';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Sparkles, Layers, ShoppingBag, PhoneCall, MessageSquare, Workflow, BarChart3, Plug, Settings, X, LogOut, CreditCard, ShieldCheck, FileText, ChevronsUpDown, Check, Megaphone, Plus, Store, CalendarDays, Globe, Menu, Package, Users } from 'lucide-react';

interface AccountInfo {
  user: { id: string; email: string; name: string | null } | null;
  org: { id: string; name: string; role: string; logo?: string | null } | null;
  orgs: { id: string; name: string; role: string; logo?: string | null }[];
  platformAdmin?: boolean;
  businessType?: 'store' | 'appointments';
}

// Header's menu button dispatches this event to open the sidebar on mobile.
export const SIDEBAR_TOGGLE_EVENT = 'lp:toggle-sidebar';

const NAV_GROUPS = [
  {
    label: 'Vender',
    items: [
      { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
      { href: '/landings', label: 'Landing pages', icon: Layers },
      { href: '/productos', label: 'Productos', icon: Package },
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
      { href: '/creativos', label: 'Creativos', icon: Megaphone },
      { href: '/automations', label: 'Automatizaciones', icon: Workflow },
      { href: '/analytics', label: 'Analíticas', icon: BarChart3 },
    ],
  },
  {
    label: 'Cuenta',
    items: [
      { href: '/integrations', label: 'Integraciones', icon: Plug },
      { href: '/equipo', label: 'Equipo', icon: Users },
      { href: '/plan', label: 'Plan y pagos', icon: CreditCard },
      { href: '/settings', label: 'Configuración', icon: Settings },
    ],
  },
];

// "Negocio con citas": Agenda takes the place of Pedidos, and the booking page the place of Landing pages.
function navGroups(type?: 'store' | 'appointments') {
  if (type !== 'appointments') return NAV_GROUPS;
  const swap: Record<string, { href: string; label: string; icon: typeof CalendarDays }> = {
    '/orders': { href: '/agenda', label: 'Agenda', icon: CalendarDays },
    '/landings': { href: '/reservas', label: 'Página de reservas', icon: Globe },
  };
  const order = ['/dashboard', '/agenda', '/reservas'];
  return NAV_GROUPS.map((g) =>
    g.label === 'Vender' ? { ...g, items: g.items.map((i) => swap[i.href] || i).sort((a, b) => order.indexOf(a.href) - order.indexOf(b.href)) } : g,
  );
}

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
  const accountRef = useRef<AccountInfo | null>(null);
  accountRef.current = account;
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
  const [waiting, setWaiting] = useState(0); // chats the assistant passed to a person
  // The store's logo was changed in Configuración: show it right away.
  useEffect(() => {
    const refresh = () =>
      fetchAccount(true).then((r: any) => {
        if (r.data?.success && r.data.org) setAccount(r.data);
      });
    window.addEventListener(STORE_LOGO_EVENT, refresh);
    return () => window.removeEventListener(STORE_LOGO_EVENT, refresh);
  }, []);
  useEffect(() => {
    let stop = false;
    const SEEN = 'lp_last_inbound_seen';
    const SEEN_MINE = 'lp_last_mine_seen';
    const SEEN_HANDOFF = 'lp_last_handoff_seen';
    const check = async () => {
      try {
        const d = await fetch('/api/whatsapp/unread', { cache: 'no-store' }).then((r) => r.json());
        if (stop || !d.success) return;
        setUnread(d.unread || 0);
        // A customer of mine wrote: browser notice (the panel can be in another tab).
        const mine = d.mine as { lastInboundAt: string | null; latest: { id: string; name: string; preview: string } | null } | null;
        if (mine?.lastInboundAt) {
          let seenMine: string | null = null;
          try {
            seenMine = sessionStorage.getItem(SEEN_MINE);
            sessionStorage.setItem(SEEN_MINE, mine.lastInboundAt);
          } catch {}
          const here = window.location.pathname === '/crm' && (window as any).__lpActiveChat === mine.latest?.id && document.visibilityState === 'visible';
          if (seenMine && mine.lastInboundAt > seenMine && mine.latest && !here) showNotice(`${mine.latest.name} te escribió`, mine.latest.preview, `/crm?c=${mine.latest.id}`);
        }
        // The assistant passed a chat to a person: its own sound and a notice, from any page.
        const handoff = d.handoff as { count: number; latest: { id: string; name: string; note: string; at: string | null; assignee?: { name: string; userId: string | null } | null } | null } | null;
        setWaiting(handoff?.count || 0);
        if (handoff?.latest?.at) {
          let seenHandoff: string | null = null;
          try {
            seenHandoff = sessionStorage.getItem(SEEN_HANDOFF);
            sessionStorage.setItem(SEEN_HANDOFF, handoff.latest.at);
          } catch {}
          if (seenHandoff && handoff.latest.at > seenHandoff) {
            if (soundOn()) playHandoffSound();
            const who = handoff.latest.assignee;
            const mine = who?.userId && who.userId === accountRef.current?.user?.id;
            showNotice(
              mine ? `🙋 ${handoff.latest.name} te necesita` : `🙋 ${handoff.latest.name} necesita un asesor`,
              [handoff.latest.note || 'El asistente pasó el chat a una persona.', who && !mine ? `Asignado a ${who.name}.` : ''].filter(Boolean).join(' '),
              `/crm?c=${handoff.latest.id}`,
            );
          }
        } else {
          try {
            if (!sessionStorage.getItem(SEEN_HANDOFF)) sessionStorage.setItem(SEEN_HANDOFF, new Date(0).toISOString());
          } catch {}
        }
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
  // Room at the bottom of every panel page for the phone tab bar.
  useEffect(() => {
    document.body.classList.add('has-tabbar');
    return () => document.body.classList.remove('has-tabbar');
  }, []);

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
          <Link href="/dashboard" aria-label="Konnexa, ir al inicio">
            <img src="/brand/konnexa-logo.png" alt="Konnexa" className="h-[30px] w-auto" />
          </Link>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1.5 -mr-1.5 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Cerrar menú">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary action */}
        <div className="px-4 pb-4">
          {account?.businessType === 'appointments' ? (
            <Link
              href="/reservas"
              onClick={() => setOpen(false)}
              className="w-full h-10 rounded-xl bg-brand-gradient text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_8px_20px_-8px_rgba(10,108,240,0.6)] hover:brightness-105 active:scale-[0.98] transition"
            >
              <CalendarDays className="w-4 h-4" />
              Mi página de reservas
            </Link>
          ) : (
          <button
            onClick={() => {
              setOpen(false);
              onOpenWizard?.();
            }}
            className="w-full h-10 rounded-xl bg-brand-gradient text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_8px_20px_-8px_rgba(10,108,240,0.6)] hover:brightness-105 active:scale-[0.98] transition"
          >
            <Sparkles className="w-4 h-4" />
            Crear landing con IA
          </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 space-y-5">
          {account && account.orgs.length > 1 && (
            <div>
              <Link
                href="/tiendas"
                className={`flex items-center gap-3 h-9 px-3 rounded-lg text-[13.5px] transition ${pathname?.startsWith('/tiendas') ? 'bg-brand-navy/[0.07] text-brand-navy font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Store className="w-[18px] h-[18px] text-slate-400" /> Mis tiendas <span className="ml-auto text-[11px] text-slate-400">{account.orgs.length}</span>
              </Link>
            </div>
          )}
          {navGroups(account?.businessType).map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em]">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href + '/'));
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
                      {item.href === '/crm' && waiting > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center" title={`${waiting} ${waiting === 1 ? 'chat espera' : 'chats esperan'} un asesor`}>
                          🙋 {waiting > 99 ? '99+' : waiting}
                        </span>
                      )}
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
          {account?.platformAdmin && (
            <div>
              <Link
                href="/admin"
                className={`flex items-center gap-3 h-9 px-3 rounded-lg text-[13.5px] transition ${pathname?.startsWith('/admin') ? 'bg-brand-navy/[0.07] text-brand-navy font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <ShieldCheck className="w-[18px] h-[18px] text-slate-400" /> Admin plataforma
              </Link>
            </div>
          )}
        </nav>

        {/* Account */}
        <div className="p-3 border-t border-slate-200/80 space-y-2">
          <InstallApp />
          <div className="relative">
            <button
              onClick={() => (account ? setOrgMenu((v) => !v) : (window.location.href = '/settings'))}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 transition text-left"
            >
              {account?.org ? (
                <StoreAvatar name={account.org.name} logo={account.org.logo} id={account.org.id} />
              ) : (
                <img src="/brand/konnexa-icon.png" alt="" className="w-9 h-9 rounded-lg border border-slate-200" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 truncate">{account?.org?.name || storeName || 'Mi tienda'}</p>
                <p className="text-xs text-slate-500 truncate">
                  {account?.user ? account.user.name || account.user.email : storeName ? 'Configuración' : 'Pon el nombre de tu tienda'}
                </p>
              </div>
              {account && <ChevronsUpDown className="w-4 h-4 text-slate-400 shrink-0" />}
            </button>
            {orgMenu && account && (
              <StoreMenu
                account={account}
                onSwitch={switchOrg}
                onClose={() => setOrgMenu(false)}
              />
            )}
          </div>
          {authOn && (
            <button onClick={logout} className="mt-1 w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition">
              <LogOut className="w-4 h-4" /> Cerrar sesión
            </button>
          )}
        </div>
      </aside>

      {/* Phone: bottom tab bar, like an app. "Más" opens the full menu. */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 grid grid-cols-4 pb-[env(safe-area-inset-bottom)]"
        aria-label="Navegación principal"
      >
        {[
          { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
          account?.businessType === 'appointments' ? { href: '/agenda', label: 'Agenda', icon: CalendarDays } : { href: '/orders', label: 'Pedidos', icon: ShoppingBag },
          { href: '/crm', label: 'Mensajes', icon: MessageSquare },
        ].map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + '/');
          return (
            <Link key={href} href={href} className={`relative h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? 'text-brand-navy' : 'text-slate-500'}`}>
              <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.4 : 2} />
              {label}
              {href === '/crm' && waiting > 0 && (
                <span className="absolute top-2 right-1/2 mr-2 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center" aria-label={`${waiting} esperan asesor`}>
                  {waiting > 99 ? '99+' : waiting}
                </span>
              )}
              {href === '/crm' && unread > 0 && (
                <span className="absolute top-2 left-1/2 ml-2 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-green text-white text-[10px] font-bold flex items-center justify-center">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
          );
        })}
        <button onClick={() => setOpen(true)} className={`h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${open ? 'text-brand-navy' : 'text-slate-500'}`}>
          <Menu className="w-[22px] h-[22px]" />
          Más
        </button>
      </nav>
    </>
  );
}

// Store switcher: search when there are many, and "Nueva tienda" for the platform owner.
function StoreMenu({ account, onSwitch, onClose }: { account: AccountInfo; onSwitch: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [copy, setCopy] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const many = account.orgs.length > 6;
  const term = q.trim().toLowerCase();
  const list = account.orgs.filter((o) => !term || o.name.toLowerCase().includes(term));
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/account/stores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, copySettings: copy }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) {
      setError(d.error || 'No se pudo crear la tienda.');
      setBusy(false);
      return;
    }
    clearLocalData();
    window.location.href = '/integrations?nueva=1';
  };
  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-xl border border-slate-200 shadow-lg p-1.5 z-10">
      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tus tiendas ({account.orgs.length})</p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Cerrar">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {many && (
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar tienda…"
          className="w-full h-8 mb-1 px-2.5 text-[13px] rounded-lg border border-slate-200 outline-none focus:border-brand-navy/40"
        />
      )}
      <div className="max-h-64 overflow-y-auto">
        {list.map((o) => (
          <button
            key={o.id}
            onClick={() => (o.id === account.org?.id ? onClose() : onSwitch(o.id))}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left text-[13px] text-slate-800"
          >
            <StoreAvatar name={o.name} logo={o.logo} id={o.id} className="w-6 h-6 rounded-md text-[11px]" />
            <span className="truncate flex-1">{o.name}</span>
            {o.id === account.org?.id && <Check className="w-3.5 h-3.5 text-slate-900" />}
          </button>
        ))}
        {!list.length && <p className="px-2 py-2 text-xs text-slate-500">Ninguna tienda con ese nombre.</p>}
      </div>
      {account.orgs.length > 1 && (
        <Link href="/tiendas" className="block mt-1 border-t border-slate-100 px-2 pt-2 pb-1 text-xs font-semibold text-brand-navy hover:underline">
          Ver todas mis tiendas
        </Link>
      )}
      {(creating ? (
          <form onSubmit={create} className="mt-1 border-t border-slate-100 p-2 space-y-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la nueva tienda"
              className="w-full h-8 px-2.5 text-[13px] rounded-lg border border-slate-200 outline-none focus:border-brand-navy/40"
            />
            <label className="flex items-start gap-2 text-[11.5px] text-slate-600">
              <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} className="mt-0.5" />
              Copiar respuestas rápidas, etiquetas, respuestas automáticas y asesores de esta tienda
            </label>
            {!account.platformAdmin && <p className="text-[11px] text-slate-500">Arranca con la prueba gratis. Después paga el precio de tienda extra de tu plan (menos que el plan completo).</p>}
            {error && <p className="text-[11.5px] text-red-600">{error}</p>}
            <button disabled={busy || !name.trim()} className="w-full h-8 rounded-lg bg-slate-900 text-white text-[12.5px] font-semibold disabled:opacity-50">
              {busy ? 'Creando…' : 'Crear tienda'}
            </button>
          </form>
        ) : (
          <button onClick={() => setCreating(true)} className="w-full mt-1 border-t border-slate-100 px-2 pt-2 pb-1 text-left text-xs font-semibold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Nueva tienda
          </button>
        ))}
      <Link href="/settings" className="block px-2 pt-1.5 pb-1 text-xs font-medium text-slate-500 hover:text-slate-900">
        Configuración y equipo
      </Link>
    </div>
  );
}
