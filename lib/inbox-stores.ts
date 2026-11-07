'use client';

// One inbox for several stores. Which stores the person sees (remembered in this browser, shared by Inicio and
// Mensajes), and which store the open chat belongs to: requests about that chat name it (x-kx-org) so they go to
// the right store. The server checks the person belongs to it.

export interface InboxStore {
  id: string;
  name: string;
  phone: string | null; // WhatsApp number shown in the panel
  logo: string | null;
  current: boolean; // the store the session is in
  whatsapp: boolean;
}

const KEY = 'kx.bandejas';
export const STORES_EVENT = 'kx:bandejas';

let chatOrg: string | null = null;
export const setChatOrg = (org: string | null) => {
  chatOrg = org;
};
// Headers for a request about the open chat (none when it's the session's store).
export const chatOrgHeaders = (org: string | null = chatOrg): Record<string, string> => (org ? { 'x-kx-org': org } : {});
// An order from another store (Pedidos with several stores) carries it in _org.
export const orderOrgHeaders = (o: { _org?: string | null }): Record<string, string> => (o._org ? { 'x-kx-org': o._org } : {});
// For files the browser loads by itself (photos, audio).
export const withChatOrg = (url: string, org: string | null = chatOrg) => (org ? `${url}${url.includes('?') ? '&' : '?'}kxorg=${encodeURIComponent(org)}` : url);

// null = never chosen (all stores).
export function readSelection(): string[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : null;
  } catch {
    return null;
  }
}
export function saveSelection(ids: string[] | null) {
  try {
    if (ids === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {}
  window.dispatchEvent(new Event(STORES_EVENT));
}
export const selectedStores = (stores: InboxStore[], sel: string[] | null) => (sel === null ? stores : stores.filter((s) => sel.includes(s.id)));

let pending: Promise<InboxStore[]> | null = null;
export function fetchInboxStores(fresh = false): Promise<InboxStore[]> {
  if (!pending || fresh) {
    pending = fetch('/api/inbox/stores', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => (d.success ? (d.stores as InboxStore[]) : []))
      .catch(() => []);
  }
  return pending;
}

// Same colors for a store everywhere (chips in the list and the thread).
const STORE_COLORS = [
  'bg-violet-50 text-violet-700',
  'bg-amber-50 text-amber-800',
  'bg-sky-50 text-sky-700',
  'bg-rose-50 text-rose-700',
  'bg-emerald-50 text-emerald-700',
  'bg-indigo-50 text-indigo-700',
  'bg-orange-50 text-orange-700',
  'bg-teal-50 text-teal-700',
  'bg-pink-50 text-pink-700',
  'bg-lime-50 text-lime-800',
];
export function storeColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return STORE_COLORS[h % STORE_COLORS.length];
}
